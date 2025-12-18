/**
 * ViewportScrollSync - Ref-based scroll synchronization for multi-viewport
 * 
 * Key optimizations:
 * 1. Bypasses React state during active scrolling (zero re-renders)
 * 2. Uses direct callbacks instead of React context
 * 3. Debounces sync to React state for final position persistence
 * 4. Supports rapid scrolling without frame drops
 * 
 * Architecture:
 * - Module-level singleton for cross-viewport communication
 * - Each viewport registers callbacks for position updates
 * - Scroll events update all viewports directly (no React)
 * - After scroll stops, syncs final position to React state
 */

export interface ViewportSyncState {
  sliceIndex: number;
  zoom: number;
  panX: number;
  panY: number;
  windowLevel: { width: number; center: number };
}

export interface SyncOptions {
  /** If true, don't notify the source viewport back */
  skipSource?: boolean;
  /** If true, update immediately without debounce */
  immediate?: boolean;
}

type ViewportUpdateCallback = (state: Partial<ViewportSyncState>) => void;
type ReactStateSyncCallback = (state: ViewportSyncState) => void;

interface ViewportRegistration {
  id: string;
  onUpdate: ViewportUpdateCallback;
  canvasRedraw?: () => void; // Direct canvas redraw function
}

class ViewportScrollSyncManager {
  private viewports: Map<string, ViewportRegistration> = new Map();
  private currentState: ViewportSyncState = {
    sliceIndex: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    windowLevel: { width: 350, center: 40 },
  };
  
  private isScrolling: boolean = false;
  private scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  private reactSyncCallback: ReactStateSyncCallback | null = null;
  private lastScrollTime: number = 0;
  
  // Scroll debounce settings
  private readonly SCROLL_END_DELAY_MS = 100; // Time after last scroll to sync to React
  private readonly MIN_SCROLL_INTERVAL_MS = 8; // ~120fps max update rate

  /**
   * Register a viewport to receive sync updates
   */
  register(
    viewportId: string,
    onUpdate: ViewportUpdateCallback,
    canvasRedraw?: () => void
  ): () => void {
    this.viewports.set(viewportId, { id: viewportId, onUpdate, canvasRedraw });
    
    // Immediately sync current state to new viewport
    onUpdate(this.currentState);
    
    // Return unregister function
    return () => {
      this.viewports.delete(viewportId);
    };
  }

  /**
   * Set the callback to sync final state to React
   */
  setReactSyncCallback(callback: ReactStateSyncCallback | null): void {
    this.reactSyncCallback = callback;
  }

  /**
   * Get current sync state
   */
  getState(): ViewportSyncState {
    return { ...this.currentState };
  }

  /**
   * Update state from a viewport scroll/interaction
   * This is the HOT PATH - must be as fast as possible
   */
  update(
    sourceViewportId: string,
    updates: Partial<ViewportSyncState>,
    options: SyncOptions = {}
  ): void {
    const now = performance.now();
    
    // Throttle updates to prevent overwhelming
    if (!options.immediate && now - this.lastScrollTime < this.MIN_SCROLL_INTERVAL_MS) {
      return;
    }
    this.lastScrollTime = now;

    // Update internal state
    Object.assign(this.currentState, updates);

    // Mark as scrolling
    this.isScrolling = true;

    // Clear existing scroll end timer
    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
    }

    // Notify all OTHER viewports directly (bypass React)
    for (const [viewportId, registration] of this.viewports) {
      if (options.skipSource && viewportId === sourceViewportId) {
        continue;
      }
      
      try {
        // Call the direct canvas redraw if available (fastest path)
        if (registration.canvasRedraw) {
          registration.canvasRedraw();
        } else {
          // Fall back to update callback
          registration.onUpdate(updates);
        }
      } catch (e) {
        console.error(`Viewport sync error for ${viewportId}:`, e);
      }
    }

    // Set timer to sync to React after scrolling stops
    this.scrollEndTimer = setTimeout(() => {
      this.onScrollEnd();
    }, this.SCROLL_END_DELAY_MS);
  }

  /**
   * Called when scrolling has stopped
   */
  private onScrollEnd(): void {
    this.isScrolling = false;
    this.scrollEndTimer = null;

    // Sync final state to React for persistence
    if (this.reactSyncCallback) {
      this.reactSyncCallback(this.currentState);
    }
  }

  /**
   * Force immediate sync to React (for programmatic changes)
   */
  forceReactSync(): void {
    if (this.reactSyncCallback) {
      this.reactSyncCallback(this.currentState);
    }
  }

  /**
   * Check if currently scrolling
   */
  isActivelyScrolling(): boolean {
    return this.isScrolling;
  }

  /**
   * Set state without triggering viewport updates (for initialization)
   */
  setState(state: Partial<ViewportSyncState>): void {
    Object.assign(this.currentState, state);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.viewports.clear();
    this.reactSyncCallback = null;
    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = null;
    }
    this.isScrolling = false;
  }

  /**
   * Get number of registered viewports
   */
  getViewportCount(): number {
    return this.viewports.size;
  }
}

// Singleton instance
export const viewportScrollSync = new ViewportScrollSyncManager();

/**
 * Create a scroll handler that syncs across viewports
 * Use this in the wheel event handler
 */
export function createSyncedScrollHandler(
  viewportId: string,
  getCurrentIndex: () => number,
  getMaxIndex: () => number,
  setLocalIndex: (index: number) => void,
  scheduleRender: () => void
): (deltaY: number) => void {
  return (deltaY: number) => {
    const currentIndex = getCurrentIndex();
    const maxIndex = getMaxIndex();
    
    // Calculate new index
    let newIndex: number;
    if (deltaY > 0) {
      newIndex = Math.max(0, currentIndex - 1); // Scroll down → previous slice
    } else {
      newIndex = Math.min(maxIndex - 1, currentIndex + 1); // Scroll up → next slice
    }
    
    if (newIndex === currentIndex) return;
    
    // Update local state immediately (no React)
    setLocalIndex(newIndex);
    
    // Schedule canvas redraw
    scheduleRender();
    
    // Notify other viewports
    viewportScrollSync.update(viewportId, { sliceIndex: newIndex });
  };
}

/**
 * React hook to integrate with ViewportScrollSync
 * Call this in the parent layout component
 */
export function useViewportScrollSync(
  onStateChange: (state: ViewportSyncState) => void
): {
  sync: ViewportScrollSyncManager;
  currentState: ViewportSyncState;
} {
  // Set up the React sync callback
  viewportScrollSync.setReactSyncCallback(onStateChange);
  
  return {
    sync: viewportScrollSync,
    currentState: viewportScrollSync.getState(),
  };
}



