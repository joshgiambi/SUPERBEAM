/**
 * ImageLoadPoolManager - OHIF-style Image Loading Priority Queue
 * 
 * Implements a sophisticated image loading system similar to OHIF 3.10's approach:
 * - Priority queue with three tiers: INTERACTION, PREFETCH, BACKGROUND
 * - Center-out loading for optimal UX during scrolling
 * - requestIdleCallback integration for non-blocking background loading
 * - Max concurrency control to prevent server overwhelming
 * - Abort handling for clean request cancellation
 * 
 * Based on: ohif-viewer/platform/core/src/utilities/imageLoadPoolManager.ts
 */

// Request priority levels (lower number = higher priority)
export enum RequestPriority {
  INTERACTION = 0,  // Current slice - needs immediate loading
  ADJACENT = 1,     // Slices ±1-2 from current - high priority prefetch  
  PREFETCH = 2,     // Center-out prefetch radius (configurable)
  BACKGROUND = 3,   // Background loading when browser is idle
}

export interface ImageLoadRequest {
  id: string;                    // Unique request ID (typically sopInstanceUID)
  priority: RequestPriority;
  distance: number;              // Distance from current slice (for sorting within priority)
  execute: () => Promise<any>;   // The actual load function
  abort?: () => void;            // Optional abort handler
  timestamp: number;             // Request creation time
  retryCount: number;
}

export interface PoolManagerConfig {
  maxConcurrent: number;         // Max concurrent requests
  maxRetries: number;            // Max retry attempts per request
  interactionTimeout: number;    // Timeout for interaction requests (ms)
  prefetchTimeout: number;       // Timeout for prefetch requests (ms)
  backgroundTimeout: number;     // Timeout for background requests (ms)
  idleCallbackTimeout: number;   // requestIdleCallback timeout (ms)
  batchSize: number;             // Number of images to process per batch
  prefetchRadius: number;        // Number of slices to prefetch around current
}

const DEFAULT_CONFIG: PoolManagerConfig = {
  maxConcurrent: 6,              // Matches typical browser connection limit
  maxRetries: 2,
  interactionTimeout: 10000,     // 10s for current slice
  prefetchTimeout: 30000,        // 30s for prefetch
  backgroundTimeout: 60000,      // 60s for background
  idleCallbackTimeout: 2000,     // 2s idle callback timeout
  batchSize: 50,
  prefetchRadius: 10,
};

type RequestCallback = (result: any, error?: Error) => void;

interface QueuedRequest extends ImageLoadRequest {
  callback?: RequestCallback;
  abortController?: AbortController;
}

/**
 * OHIF-style Image Load Pool Manager
 * Singleton pattern for global request management
 */
class ImageLoadPoolManager {
  private static instance: ImageLoadPoolManager;
  
  private config: PoolManagerConfig;
  private queue: Map<string, QueuedRequest> = new Map();
  private activeRequests: Map<string, QueuedRequest> = new Map();
  private completedRequests: Set<string> = new Set();
  private isPaused: boolean = false;
  private currentSliceIndex: number = 0;
  private totalSlices: number = 0;
  
  // PERF FIX: Limit completedRequests set size to prevent unbounded memory growth
  private static readonly MAX_COMPLETED_CACHE = 2000;
  
  // Statistics
  private stats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    cancelledRequests: 0,
    avgLoadTime: 0,
  };

  private constructor(config: Partial<PoolManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<PoolManagerConfig>): ImageLoadPoolManager {
    if (!ImageLoadPoolManager.instance) {
      ImageLoadPoolManager.instance = new ImageLoadPoolManager(config);
    }
    return ImageLoadPoolManager.instance;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PoolManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set the current viewing position for priority calculations
   */
  setCurrentPosition(sliceIndex: number, totalSlices: number): void {
    this.currentSliceIndex = sliceIndex;
    this.totalSlices = totalSlices;
    
    // Re-prioritize queued requests based on new position
    this.reprioritizeQueue();
  }

  /**
   * Calculate priority and distance for an image based on its position
   */
  calculatePriority(sliceIndex: number): { priority: RequestPriority; distance: number } {
    const distance = Math.abs(sliceIndex - this.currentSliceIndex);
    
    if (distance === 0) {
      return { priority: RequestPriority.INTERACTION, distance: 0 };
    } else if (distance <= 2) {
      return { priority: RequestPriority.ADJACENT, distance };
    } else if (distance <= this.config.prefetchRadius) {
      return { priority: RequestPriority.PREFETCH, distance };
    } else {
      return { priority: RequestPriority.BACKGROUND, distance };
    }
  }

  /**
   * Add a request to the queue
   */
  addRequest(
    id: string,
    sliceIndex: number,
    execute: () => Promise<any>,
    callback?: RequestCallback,
    abort?: () => void
  ): void {
    // Skip if already completed or in progress
    if (this.completedRequests.has(id) || this.activeRequests.has(id)) {
      return;
    }

    // Skip if already queued (but update priority if needed)
    if (this.queue.has(id)) {
      const existing = this.queue.get(id)!;
      const { priority, distance } = this.calculatePriority(sliceIndex);
      
      // Only update if new priority is higher (lower number)
      if (priority < existing.priority || 
          (priority === existing.priority && distance < existing.distance)) {
        existing.priority = priority;
        existing.distance = distance;
      }
      return;
    }

    const { priority, distance } = this.calculatePriority(sliceIndex);

    const request: QueuedRequest = {
      id,
      priority,
      distance,
      execute,
      abort,
      callback,
      timestamp: Date.now(),
      retryCount: 0,
      abortController: new AbortController(),
    };

    this.queue.set(id, request);
    this.stats.totalRequests++;

    // Process queue
    this.processQueue();
  }

  /**
   * Add multiple requests for center-out loading
   */
  addCenterOutRequests(
    images: Array<{ id: string; sliceIndex: number }>,
    executeFactory: (id: string) => () => Promise<any>,
    callback?: RequestCallback
  ): void {
    // Sort by distance from current slice (center-out)
    const sorted = [...images].sort((a, b) => {
      const distA = Math.abs(a.sliceIndex - this.currentSliceIndex);
      const distB = Math.abs(b.sliceIndex - this.currentSliceIndex);
      return distA - distB;
    });

    // Add requests in center-out order
    for (const image of sorted) {
      this.addRequest(image.id, image.sliceIndex, executeFactory(image.id), callback);
    }
  }

  /**
   * Process the queue - start new requests up to max concurrent
   */
  private processQueue(): void {
    if (this.isPaused) return;

    // Get sorted queue entries by priority, then distance
    const sortedQueue = Array.from(this.queue.values())
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.distance - b.distance;
      });

    // Start new requests up to max concurrent
    while (this.activeRequests.size < this.config.maxConcurrent && sortedQueue.length > 0) {
      const request = sortedQueue.shift();
      if (!request) break;

      this.queue.delete(request.id);
      this.startRequest(request);
    }

    // Schedule background requests using requestIdleCallback
    if (sortedQueue.length > 0 && this.activeRequests.size < this.config.maxConcurrent) {
      this.scheduleBackgroundProcessing();
    }
  }

  /**
   * Start executing a request
   */
  private async startRequest(request: QueuedRequest): Promise<void> {
    this.activeRequests.set(request.id, request);

    const timeout = this.getTimeoutForPriority(request.priority);
    const startTime = Date.now();

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      // Race between the actual request and timeout
      const result = await Promise.race([
        request.execute(),
        timeoutPromise,
      ]);

      // Success
      this.activeRequests.delete(request.id);
      this.completedRequests.add(request.id);
      this.stats.completedRequests++;
      
      // PERF FIX: Prune completedRequests set if it grows too large
      if (this.completedRequests.size > ImageLoadPoolManager.MAX_COMPLETED_CACHE) {
        // Remove oldest entries (first 20% of the set)
        const toRemove = Math.floor(ImageLoadPoolManager.MAX_COMPLETED_CACHE * 0.2);
        const iterator = this.completedRequests.values();
        for (let i = 0; i < toRemove; i++) {
          const value = iterator.next().value;
          if (value) this.completedRequests.delete(value);
        }
      }
      
      // Update average load time
      const loadTime = Date.now() - startTime;
      this.stats.avgLoadTime = 
        (this.stats.avgLoadTime * (this.stats.completedRequests - 1) + loadTime) / 
        this.stats.completedRequests;

      request.callback?.(result);
      
    } catch (error) {
      this.activeRequests.delete(request.id);

      // Retry if under max retries
      if (request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        this.queue.set(request.id, request);
        console.warn(`[ImageLoadPool] Retrying ${request.id} (attempt ${request.retryCount})`);
      } else {
        this.stats.failedRequests++;
        request.callback?.(null, error as Error);
        console.error(`[ImageLoadPool] Failed to load ${request.id}:`, error);
      }
    }

    // Process more requests
    this.processQueue();
  }

  /**
   * Get timeout based on request priority
   */
  private getTimeoutForPriority(priority: RequestPriority): number {
    switch (priority) {
      case RequestPriority.INTERACTION:
        return this.config.interactionTimeout;
      case RequestPriority.ADJACENT:
      case RequestPriority.PREFETCH:
        return this.config.prefetchTimeout;
      case RequestPriority.BACKGROUND:
        return this.config.backgroundTimeout;
      default:
        return this.config.prefetchTimeout;
    }
  }

  /**
   * Schedule background processing using requestIdleCallback
   */
  private scheduleBackgroundProcessing(): void {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(
        (deadline: IdleDeadline) => {
          // Only process if we have time remaining
          if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
            this.processQueue();
          }
        },
        { timeout: this.config.idleCallbackTimeout }
      );
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Re-prioritize all queued requests based on current viewing position
   */
  private reprioritizeQueue(): void {
    Array.from(this.queue.entries()).forEach(([id, request]) => {
      // Calculate new priority based on current position
      // This requires knowing the slice index for each request
      // For now, we'll just trigger a re-sort on next process
    });
  }

  /**
   * Cancel a specific request
   */
  cancelRequest(id: string): void {
    const queuedRequest = this.queue.get(id);
    if (queuedRequest) {
      queuedRequest.abortController?.abort();
      queuedRequest.abort?.();
      this.queue.delete(id);
      this.stats.cancelledRequests++;
    }

    const activeRequest = this.activeRequests.get(id);
    if (activeRequest) {
      activeRequest.abortController?.abort();
      activeRequest.abort?.();
      this.activeRequests.delete(id);
      this.stats.cancelledRequests++;
    }
  }

  /**
   * Cancel all requests with a given priority or lower
   */
  cancelByPriority(minPriority: RequestPriority): void {
    Array.from(this.queue.entries()).forEach(([id, request]) => {
      if (request.priority >= minPriority) {
        this.cancelRequest(id);
      }
    });
  }

  /**
   * Clear all pending and active requests
   */
  clearAll(): void {
    // Cancel all queued requests
    Array.from(this.queue.keys()).forEach(id => {
      this.cancelRequest(id);
    });
    
    // Cancel all active requests
    Array.from(this.activeRequests.keys()).forEach(id => {
      this.cancelRequest(id);
    });

    this.queue.clear();
    this.activeRequests.clear();
    this.completedRequests.clear();
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    this.processQueue();
  }

  /**
   * Check if a request is completed
   */
  isCompleted(id: string): boolean {
    return this.completedRequests.has(id);
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.size,
      activeRequests: this.activeRequests.size,
      completedCount: this.completedRequests.size,
    };
  }

  /**
   * Get queue status for debugging
   */
  getQueueStatus() {
    const byPriority = {
      [RequestPriority.INTERACTION]: 0,
      [RequestPriority.ADJACENT]: 0,
      [RequestPriority.PREFETCH]: 0,
      [RequestPriority.BACKGROUND]: 0,
    };

    Array.from(this.queue.values()).forEach(request => {
      byPriority[request.priority]++;
    });

    return {
      total: this.queue.size,
      active: this.activeRequests.size,
      byPriority,
      isPaused: this.isPaused,
    };
  }
}

// Export singleton instance getter
export const getImageLoadPoolManager = (config?: Partial<PoolManagerConfig>) => 
  ImageLoadPoolManager.getInstance(config);

/**
 * Helper hook for React components to use the pool manager
 */
export function createImageLoadHelpers(seriesId: number) {
  const poolManager = getImageLoadPoolManager();
  
  return {
    /**
     * Load a single image with appropriate priority
     */
    loadImage: (
      sopInstanceUID: string,
      sliceIndex: number,
      fetchFn: () => Promise<any>,
      onComplete?: (result: any, error?: Error) => void
    ) => {
      poolManager.addRequest(sopInstanceUID, sliceIndex, fetchFn, onComplete);
    },

    /**
     * Prefetch images around the current position (center-out)
     */
    prefetchAround: (
      currentIndex: number,
      images: Array<{ sopInstanceUID: string; index: number }>,
      fetchFactory: (sopInstanceUID: string) => () => Promise<any>,
      onComplete?: (result: any, error?: Error) => void
    ) => {
      poolManager.setCurrentPosition(currentIndex, images.length);
      
      poolManager.addCenterOutRequests(
        images.map(img => ({ id: img.sopInstanceUID, sliceIndex: img.index })),
        fetchFactory,
        onComplete
      );
    },

    /**
     * Update current viewing position (for dynamic prioritization)
     */
    updatePosition: (currentIndex: number, totalSlices: number) => {
      poolManager.setCurrentPosition(currentIndex, totalSlices);
    },

    /**
     * Cancel all requests for this series
     */
    cancelAll: () => {
      poolManager.clearAll();
    },

    /**
     * Get loading statistics
     */
    getStats: () => poolManager.getStats(),
  };
}

/**
 * Stack Context Prefetch - OHIF-style automatic prefetching
 * Automatically prefetches slices around the current scroll position
 */
export function createStackContextPrefetch(
  images: Array<{ sopInstanceUID: string; index: number }>,
  fetchFactory: (sopInstanceUID: string) => () => Promise<any>,
  config: { radius?: number; onProgress?: (loaded: number, total: number) => void } = {}
) {
  const poolManager = getImageLoadPoolManager();
  const { radius = 10, onProgress } = config;
  
  let currentIndex = 0;
  let loadedCount = 0;
  const total = images.length;

  const onComplete = () => {
    loadedCount++;
    onProgress?.(loadedCount, total);
  };

  return {
    /**
     * Called when the scroll position changes
     */
    onScroll: (newIndex: number) => {
      currentIndex = newIndex;
      poolManager.setCurrentPosition(newIndex, images.length);
      
      // Cancel low-priority background requests that are now far away
      poolManager.cancelByPriority(RequestPriority.BACKGROUND);

      // Queue new prefetch requests around current position
      const prefetchIndices: number[] = [];
      for (let offset = -radius; offset <= radius; offset++) {
        const idx = newIndex + offset;
        if (idx >= 0 && idx < images.length) {
          prefetchIndices.push(idx);
        }
      }

      // Sort by distance (center-out)
      prefetchIndices.sort((a, b) => 
        Math.abs(a - currentIndex) - Math.abs(b - currentIndex)
      );

      // Add requests
      for (const idx of prefetchIndices) {
        const image = images[idx];
        if (image && !poolManager.isCompleted(image.sopInstanceUID)) {
          poolManager.addRequest(
            image.sopInstanceUID,
            idx,
            fetchFactory(image.sopInstanceUID),
            onComplete
          );
        }
      }
    },

    /**
     * Initialize prefetching starting from a position
     */
    initialize: (startIndex: number) => {
      currentIndex = startIndex;
      poolManager.setCurrentPosition(startIndex, images.length);
      
      // Queue all images with appropriate priorities
      poolManager.addCenterOutRequests(
        images.map(img => ({ id: img.sopInstanceUID, sliceIndex: img.index })),
        fetchFactory,
        onComplete
      );
    },

    /**
     * Cleanup
     */
    destroy: () => {
      poolManager.clearAll();
    },

    /**
     * Get progress
     */
    getProgress: () => ({ loaded: loadedCount, total }),
  };
}

