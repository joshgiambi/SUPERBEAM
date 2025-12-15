/**
 * GlobalFusionCache - Shared fusion overlay cache for multi-viewport performance
 * 
 * Key optimizations:
 * 1. Single shared cache across ALL viewports (no duplicate fetching)
 * 2. Eager preloading of fusion data when entering multi-viewport mode
 * 3. Memory-efficient with LRU eviction
 * 4. Window/level independent storage (stores raw slice data, re-renders on WL change)
 * 
 * Architecture:
 * - Module-level singleton for zero re-render overhead
 * - Stores FuseboxSlice data (raw pixel data) not rendered canvases
 * - Each viewport can render from shared data with its own window/level
 */

import { getFusedSlice, getFusedSliceSmart, type FuseboxSlice } from './fusion-utils';

export interface CachedFusionSlice {
  slice: FuseboxSlice;
  timestamp: number;
}

export interface FusionCacheEntry {
  primarySeriesId: number;
  secondarySeriesId: number;
  registrationId: string | null;
  slices: Map<string, CachedFusionSlice>; // key: primarySopInstanceUID
  isPreloading: boolean;
  preloadProgress: number;
  totalSlices: number;
}

export type FusionCacheEventType = 'progress' | 'complete' | 'error' | 'slice-loaded';
export interface FusionCacheEvent {
  type: FusionCacheEventType;
  primarySeriesId: number;
  secondarySeriesId: number;
  progress?: number;
  error?: Error;
  sopInstanceUID?: string;
}

type FusionCacheEventListener = (event: FusionCacheEvent) => void;

// Configuration
const MAX_CACHED_FUSIONS = 3; // Keep up to 3 fusion pairs in memory
const MAX_SLICES_PER_FUSION = 500; // Max slices to cache per fusion pair
const CONCURRENT_PRELOAD = 4; // Parallel requests during preload

/**
 * Build a unique cache key for a fusion pair + registration
 */
export function buildFusionPairKey(
  primarySeriesId: number,
  secondarySeriesId: number,
  registrationId: string | null
): string {
  return `${primarySeriesId}:${secondarySeriesId}:${registrationId ?? 'default'}`;
}

/**
 * Build a cache key for a specific slice within a fusion pair
 */
export function buildFusionSliceKey(
  primarySopInstanceUID: string,
  secondarySeriesId: number,
  registrationId: string | null
): string {
  return `${primarySopInstanceUID}:${secondarySeriesId}:${registrationId ?? 'default'}`;
}

class GlobalFusionCacheManager {
  private cache: Map<string, FusionCacheEntry> = new Map();
  private preloadAbortControllers: Map<string, AbortController> = new Map();
  private listeners: Set<FusionCacheEventListener> = new Set();
  private estimatedSliceCount: number = 0;

  /**
   * Get cached fusion slice if available
   */
  getSlice(
    primarySeriesId: number,
    secondarySeriesId: number,
    primarySopInstanceUID: string,
    registrationId: string | null = null
  ): FuseboxSlice | null {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    const entry = this.cache.get(pairKey);
    if (!entry) return null;
    
    const cached = entry.slices.get(primarySopInstanceUID);
    if (cached) {
      cached.timestamp = Date.now(); // Update LRU timestamp
      return cached.slice;
    }
    return null;
  }

  /**
   * Check if a fusion pair is being preloaded
   */
  isPreloading(
    primarySeriesId: number,
    secondarySeriesId: number,
    registrationId: string | null = null
  ): boolean {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    const entry = this.cache.get(pairKey);
    return entry?.isPreloading ?? false;
  }

  /**
   * Get preload progress for a fusion pair (0-1)
   */
  getProgress(
    primarySeriesId: number,
    secondarySeriesId: number,
    registrationId: string | null = null
  ): number {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    const entry = this.cache.get(pairKey);
    return entry?.preloadProgress ?? 0;
  }

  /**
   * Get cached slice count for a fusion pair
   */
  getCachedSliceCount(
    primarySeriesId: number,
    secondarySeriesId: number,
    registrationId: string | null = null
  ): number {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    const entry = this.cache.get(pairKey);
    return entry?.slices.size ?? 0;
  }

  /**
   * Add a single fusion slice to the cache
   * Called by WorkingViewer when it fetches a slice
   */
  addSlice(
    primarySeriesId: number,
    secondarySeriesId: number,
    primarySopInstanceUID: string,
    slice: FuseboxSlice,
    registrationId: string | null = null
  ): void {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    
    let entry = this.cache.get(pairKey);
    if (!entry) {
      entry = {
        primarySeriesId,
        secondarySeriesId,
        registrationId,
        slices: new Map(),
        isPreloading: false,
        preloadProgress: 0,
        totalSlices: 0,
      };
      this.cache.set(pairKey, entry);
      this.evictIfNeeded();
    }
    
    if (!entry.slices.has(primarySopInstanceUID)) {
      entry.slices.set(primarySopInstanceUID, {
        slice,
        timestamp: Date.now(),
      });
      this.estimatedSliceCount++;
      
      // Emit event for subscribers
      this.emit({
        type: 'slice-loaded',
        primarySeriesId,
        secondarySeriesId,
        sopInstanceUID: primarySopInstanceUID,
      });
    }
  }

  /**
   * Preload all fusion slices for a primary/secondary pair
   * Call this before entering multi-viewport mode for smooth scrolling
   */
  async preloadFusionPair(
    primarySeriesId: number,
    secondarySeriesId: number,
    primaryImages: Array<{
      sopInstanceUID: string;
      instanceNumber?: number;
      imagePosition?: number[];
      metadata?: { imagePositionPatient?: number[] };
    }>,
    registrationId: string | null = null,
    options: {
      onProgress?: (loaded: number, total: number) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<void> {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    
    // Check if already preloading
    let entry = this.cache.get(pairKey);
    if (entry?.isPreloading) {
      console.log(`[GlobalFusionCache] Already preloading ${pairKey}`);
      return;
    }

    // Check if already fully loaded
    if (entry && entry.slices.size >= primaryImages.length * 0.95) {
      console.log(`[GlobalFusionCache] Already loaded ${pairKey} (${entry.slices.size}/${primaryImages.length})`);
      return;
    }

    // Cancel any existing preload for this pair
    const existingController = this.preloadAbortControllers.get(pairKey);
    if (existingController) {
      existingController.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    this.preloadAbortControllers.set(pairKey, abortController);

    // Initialize or update cache entry
    if (!entry) {
      entry = {
        primarySeriesId,
        secondarySeriesId,
        registrationId,
        slices: new Map(),
        isPreloading: true,
        preloadProgress: 0,
        totalSlices: primaryImages.length,
      };
      this.cache.set(pairKey, entry);
      this.evictIfNeeded();
    } else {
      entry.isPreloading = true;
      entry.totalSlices = primaryImages.length;
    }

    console.log(`[GlobalFusionCache] Starting preload for ${pairKey}: ${primaryImages.length} slices`);

    const total = primaryImages.length;
    let loaded = entry.slices.size;
    let errors = 0;

    // Helper to parse image position
    const parsePosition = (img: typeof primaryImages[0]): [number, number, number] | null => {
      const pos = img.imagePosition || img.metadata?.imagePositionPatient;
      if (Array.isArray(pos) && pos.length >= 3) {
        const coords = pos.map(Number).filter(Number.isFinite);
        if (coords.length >= 3) return coords as [number, number, number];
      }
      return null;
    };

    // Filter out already cached images
    const uncachedImages = primaryImages.filter(img => !entry!.slices.has(img.sopInstanceUID));

    // Load in batches with controlled concurrency
    for (let i = 0; i < uncachedImages.length; i += CONCURRENT_PRELOAD) {
      if (abortController.signal.aborted || options.signal?.aborted) {
        console.log(`[GlobalFusionCache] Preload aborted for ${pairKey}`);
        break;
      }

      const batch = uncachedImages.slice(i, i + CONCURRENT_PRELOAD);
      const results = await Promise.allSettled(
        batch.map(async (img, batchIdx) => {
          const idx = primaryImages.findIndex(p => p.sopInstanceUID === img.sopInstanceUID);
          const position = parsePosition(img);
          const instNumber = img.instanceNumber;

          try {
            let slice: FuseboxSlice;
            try {
              // Try exact SOP match first
              slice = await getFusedSlice(primarySeriesId, secondarySeriesId, img.sopInstanceUID);
            } catch {
              // Fallback to smart matching
              slice = await getFusedSliceSmart(
                primarySeriesId,
                secondarySeriesId,
                img.sopInstanceUID,
                instNumber ?? null,
                idx,
                position
              );
            }
            return { sopInstanceUID: img.sopInstanceUID, slice };
          } catch (error) {
            // Don't throw - we'll continue with other slices
            return null;
          }
        })
      );

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { sopInstanceUID, slice } = result.value;
          entry!.slices.set(sopInstanceUID, { slice, timestamp: Date.now() });
          this.estimatedSliceCount++;
          loaded++;
        } else {
          errors++;
        }
      }

      // Update progress
      entry!.preloadProgress = loaded / total;
      options.onProgress?.(loaded, total);
      this.emit({ type: 'progress', primarySeriesId, secondarySeriesId, progress: entry!.preloadProgress });
    }

    // Mark preload complete
    entry!.isPreloading = false;
    this.preloadAbortControllers.delete(pairKey);

    console.log(`[GlobalFusionCache] Preload complete for ${pairKey}: ${loaded}/${total} (${errors} errors)`);
    this.emit({ type: 'complete', primarySeriesId, secondarySeriesId, progress: 1 });
  }

  /**
   * Cancel ongoing preload for a fusion pair
   */
  cancelPreload(
    primarySeriesId: number,
    secondarySeriesId: number,
    registrationId: string | null = null
  ): void {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    const controller = this.preloadAbortControllers.get(pairKey);
    if (controller) {
      controller.abort();
      this.preloadAbortControllers.delete(pairKey);
    }
    
    const entry = this.cache.get(pairKey);
    if (entry) {
      entry.isPreloading = false;
    }
  }

  /**
   * Evict least recently used fusion pairs if we have too many
   */
  private evictIfNeeded(): void {
    while (this.cache.size > MAX_CACHED_FUSIONS) {
      // Find LRU entry (not currently preloading)
      let lruKey: string | null = null;
      let lruTime = Infinity;

      for (const [key, entry] of this.cache) {
        if (entry.isPreloading) continue;
        
        // Find oldest slice timestamp in this entry
        let oldestTimestamp = Infinity;
        for (const [, cached] of entry.slices) {
          if (cached.timestamp < oldestTimestamp) {
            oldestTimestamp = cached.timestamp;
          }
        }
        
        if (oldestTimestamp < lruTime) {
          lruTime = oldestTimestamp;
          lruKey = key;
        }
      }

      if (!lruKey) break;

      const evictedEntry = this.cache.get(lruKey);
      if (evictedEntry) {
        this.estimatedSliceCount -= evictedEntry.slices.size;
        console.log(`[GlobalFusionCache] Evicting ${lruKey} (${evictedEntry.slices.size} slices)`);
        this.cache.delete(lruKey);
      }
    }
  }

  /**
   * Clear all cached data for a fusion pair
   */
  clearPair(
    primarySeriesId: number,
    secondarySeriesId: number,
    registrationId: string | null = null
  ): void {
    const pairKey = buildFusionPairKey(primarySeriesId, secondarySeriesId, registrationId);
    this.cancelPreload(primarySeriesId, secondarySeriesId, registrationId);
    
    const entry = this.cache.get(pairKey);
    if (entry) {
      this.estimatedSliceCount -= entry.slices.size;
      this.cache.delete(pairKey);
    }
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    for (const [key] of this.cache) {
      const [primary, secondary] = key.split(':').map(Number);
      this.cancelPreload(primary, secondary);
    }
    this.cache.clear();
    this.estimatedSliceCount = 0;
  }

  /**
   * Subscribe to cache events
   */
  subscribe(listener: FusionCacheEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: FusionCacheEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[GlobalFusionCache] Event listener error:', e);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cachedPairs: number;
    totalSlices: number;
    entries: Array<{
      primarySeriesId: number;
      secondarySeriesId: number;
      sliceCount: number;
      isPreloading: boolean;
      progress: number;
    }>;
  } {
    return {
      cachedPairs: this.cache.size,
      totalSlices: this.estimatedSliceCount,
      entries: Array.from(this.cache.entries()).map(([, entry]) => ({
        primarySeriesId: entry.primarySeriesId,
        secondarySeriesId: entry.secondarySeriesId,
        sliceCount: entry.slices.size,
        isPreloading: entry.isPreloading,
        progress: entry.preloadProgress,
      })),
    };
  }
}

// Singleton instance
export const globalFusionCache = new GlobalFusionCacheManager();

// React hook for fusion cache progress
export function useGlobalFusionCacheProgress(
  primarySeriesId: number,
  secondarySeriesId: number,
  registrationId: string | null = null
): {
  isPreloading: boolean;
  progress: number;
  cachedSlices: number;
} {
  const isPreloading = globalFusionCache.isPreloading(primarySeriesId, secondarySeriesId, registrationId);
  const progress = globalFusionCache.getProgress(primarySeriesId, secondarySeriesId, registrationId);
  const cachedSlices = globalFusionCache.getCachedSliceCount(primarySeriesId, secondarySeriesId, registrationId);
  
  return { isPreloading, progress, cachedSlices };
}

