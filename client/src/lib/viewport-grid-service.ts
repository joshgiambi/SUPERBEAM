// ViewportGridService - Foundation for multi-viewport and MPR support
// Based on OHIF 3.10/3.11 architecture for managing multiple viewports
// Upgraded to support primary/secondary series, fusion, and full MPR

import { BehaviorSubject, Subject } from 'rxjs';
import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ViewportType = 
  | 'STACK'           // Standard 2D stack viewer (axial-only, like CT/MR)
  | 'MPR_AXIAL'       // MPR axial plane
  | 'MPR_SAGITTAL'    // MPR sagittal plane
  | 'MPR_CORONAL'     // MPR coronal plane
  | 'VOLUME_3D'       // 3D volume rendering
  | 'FUSION';         // Fused overlay viewport

export type Orientation = 'axial' | 'sagittal' | 'coronal';

export interface ViewportPosition {
  row: number;
  col: number;
  width: number;     // Grid span (1 = one cell, 2 = two cells, etc.)
  height: number;    // Grid span
}

export interface FusionConfig {
  primarySeriesId: number;
  secondarySeriesIds: number[];    // Support multiple secondaries for multi-fusion
  opacities: number[];             // Per-secondary opacity
  colorMaps?: string[];            // Optional color maps per secondary
  blendMode?: 'overlay' | 'additive' | 'difference';
}

export interface ViewportDisplayOptions {
  windowWidth?: number;
  windowCenter?: number;
  invert?: boolean;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  colormap?: string;
  voi?: { windowWidth: number; windowCenter: number };
}

export interface Viewport {
  // Identity
  id: string;
  positionId?: string;             // Position-based ID for layout persistence
  
  // Content
  studyId: number | null;          // Study this viewport displays
  seriesId: number | null;         // Primary series ID (numeric, from our DB)
  seriesInstanceUID?: string;      // DICOM Series Instance UID (for compatibility)
  
  // Fusion support
  secondarySeriesIds?: number[];   // Secondary series for fusion overlay
  fusionConfig?: FusionConfig;     // Detailed fusion configuration
  
  // Viewport configuration
  type: ViewportType;
  orientation?: Orientation;
  syncGroup?: string;              // For synchronized scrolling/windowing
  
  // Position in grid
  position: ViewportPosition;
  
  // State
  isActive: boolean;
  isReady?: boolean;               // Whether viewport has finished loading
  
  // Display options
  displayOptions?: ViewportDisplayOptions;
  
  // Labels and metadata
  label?: string;                  // User-visible label (e.g., "CT", "PET/CT Fusion")
  displaySetInstanceUIDs?: string[]; // OHIF compatibility
}

export interface ViewportGridLayout {
  numRows: number;
  numCols: number;
  layoutType: 'grid' | 'mpr' | 'fusion' | 'custom';
}

export interface ViewportGrid {
  layout: ViewportGridLayout;
  viewports: Map<string, Viewport>;   // Keyed by viewport ID
  activeViewportId: string | null;
  isHangingProtocolLayout?: boolean;  // Whether this was set by a hanging protocol
}

export type GridLayoutPreset = 
  | '1x1' 
  | '1x2' 
  | '2x1'
  | '2x2' 
  | '1x3' 
  | '3x1'
  | '3x3' 
  | 'MPR'      // Standard 2x2 MPR (axial, sagittal, coronal + reference)
  | 'MPR_3x1'  // MPR in horizontal row
  | 'FUSION_2x1'; // Primary + Fused side by side

// Layout configurations
const LAYOUT_CONFIGS: Record<GridLayoutPreset, ViewportGridLayout> = {
  '1x1': { numRows: 1, numCols: 1, layoutType: 'grid' },
  '1x2': { numRows: 1, numCols: 2, layoutType: 'grid' },
  '2x1': { numRows: 2, numCols: 1, layoutType: 'grid' },
  '2x2': { numRows: 2, numCols: 2, layoutType: 'grid' },
  '1x3': { numRows: 1, numCols: 3, layoutType: 'grid' },
  '3x1': { numRows: 3, numCols: 1, layoutType: 'grid' },
  '3x3': { numRows: 3, numCols: 3, layoutType: 'grid' },
  'MPR': { numRows: 2, numCols: 2, layoutType: 'mpr' },
  'MPR_3x1': { numRows: 1, numCols: 3, layoutType: 'mpr' },
  'FUSION_2x1': { numRows: 1, numCols: 2, layoutType: 'fusion' },
};

// ============================================================================
// EVENTS
// ============================================================================

export type ViewportGridEventType = 
  | 'ACTIVE_VIEWPORT_CHANGED'
  | 'LAYOUT_CHANGED'
  | 'VIEWPORT_UPDATED'
  | 'GRID_STATE_CHANGED'
  | 'VIEWPORTS_READY';

export interface ViewportGridEvent {
  type: ViewportGridEventType;
  payload?: any;
}

// ============================================================================
// SERVICE
// ============================================================================

class ViewportGridService {
  private gridSubject = new BehaviorSubject<ViewportGrid>({
    layout: { numRows: 1, numCols: 1, layoutType: 'grid' },
    viewports: new Map(),
    activeViewportId: null,
  });

  private eventsSubject = new Subject<ViewportGridEvent>();

  // Public observables
  public grid$ = this.gridSubject.asObservable();
  public events$ = this.eventsSubject.asObservable();

  constructor() {
    // Initialize with a default 1x1 layout
    this.setLayout('1x1');
  }

  // =========================================================================
  // STATE ACCESS
  // =========================================================================

  getState(): ViewportGrid {
    return this.gridSubject.value;
  }

  getViewport(viewportId: string): Viewport | undefined {
    return this.getState().viewports.get(viewportId);
  }

  getActiveViewport(): Viewport | undefined {
    const state = this.getState();
    if (!state.activeViewportId) return undefined;
    return state.viewports.get(state.activeViewportId);
  }

  getActiveViewportId(): string | null {
    return this.getState().activeViewportId;
  }

  getNumViewportPanes(): number {
    return this.getState().viewports.size;
  }

  getViewportsInSyncGroup(syncGroup: string): Viewport[] {
    const state = this.getState();
    return Array.from(state.viewports.values()).filter(vp => vp.syncGroup === syncGroup);
  }

  // =========================================================================
  // LAYOUT MANAGEMENT
  // =========================================================================

  /**
   * Set a predefined layout with optional initial series
   */
  setLayout(
    preset: GridLayoutPreset, 
    options?: {
      seriesId?: number;
      studyId?: number;
      secondarySeriesIds?: number[];
      preserveContent?: boolean;
    }
  ): void {
    const config = LAYOUT_CONFIGS[preset];
    const { seriesId, studyId, secondarySeriesIds, preserveContent } = options || {};
    
    const viewports = new Map<string, Viewport>();
    const previousViewports = preserveContent ? this.getState().viewports : new Map();

    if (preset === 'MPR' && seriesId) {
      // Create MPR layout: Axial, Sagittal, Coronal + Reference
      const mprSyncGroup = `mpr-${Date.now()}`;
      
      viewports.set('mpr-axial', {
        id: 'mpr-axial',
        positionId: '0-0',
        studyId: studyId ?? null,
        seriesId,
        type: 'MPR_AXIAL',
        orientation: 'axial',
        position: { row: 0, col: 0, width: 1, height: 1 },
        isActive: true,
        syncGroup: mprSyncGroup,
        label: 'Axial',
      });

      viewports.set('mpr-sagittal', {
        id: 'mpr-sagittal',
        positionId: '0-1',
        studyId: studyId ?? null,
        seriesId,
        type: 'MPR_SAGITTAL',
        orientation: 'sagittal',
        position: { row: 0, col: 1, width: 1, height: 1 },
        isActive: false,
        syncGroup: mprSyncGroup,
        label: 'Sagittal',
      });

      viewports.set('mpr-coronal', {
        id: 'mpr-coronal',
        positionId: '1-0',
        studyId: studyId ?? null,
        seriesId,
        type: 'MPR_CORONAL',
        orientation: 'coronal',
        position: { row: 1, col: 0, width: 1, height: 1 },
        isActive: false,
        syncGroup: mprSyncGroup,
        label: 'Coronal',
      });

      viewports.set('mpr-reference', {
        id: 'mpr-reference',
        positionId: '1-1',
        studyId: studyId ?? null,
        seriesId,
        type: 'STACK',
        position: { row: 1, col: 1, width: 1, height: 1 },
        isActive: false,
        syncGroup: mprSyncGroup,
        label: 'Reference',
      });

    } else if (preset === 'MPR_3x1' && seriesId) {
      // Horizontal MPR layout
      const mprSyncGroup = `mpr-${Date.now()}`;
      
      viewports.set('mpr-axial', {
        id: 'mpr-axial',
        positionId: '0-0',
        studyId: studyId ?? null,
        seriesId,
        type: 'MPR_AXIAL',
        orientation: 'axial',
        position: { row: 0, col: 0, width: 1, height: 1 },
        isActive: true,
        syncGroup: mprSyncGroup,
        label: 'Axial',
      });

      viewports.set('mpr-sagittal', {
        id: 'mpr-sagittal',
        positionId: '0-1',
        studyId: studyId ?? null,
        seriesId,
        type: 'MPR_SAGITTAL',
        orientation: 'sagittal',
        position: { row: 0, col: 1, width: 1, height: 1 },
        isActive: false,
        syncGroup: mprSyncGroup,
        label: 'Sagittal',
      });

      viewports.set('mpr-coronal', {
        id: 'mpr-coronal',
        positionId: '0-2',
        studyId: studyId ?? null,
        seriesId,
        type: 'MPR_CORONAL',
        orientation: 'coronal',
        position: { row: 0, col: 2, width: 1, height: 1 },
        isActive: false,
        syncGroup: mprSyncGroup,
        label: 'Coronal',
      });

    } else if (preset === 'FUSION_2x1' && seriesId && secondarySeriesIds?.length) {
      // Fusion side-by-side layout
      viewports.set('fusion-primary', {
        id: 'fusion-primary',
        positionId: '0-0',
        studyId: studyId ?? null,
        seriesId,
        type: 'STACK',
        position: { row: 0, col: 0, width: 1, height: 1 },
        isActive: true,
        label: 'Primary',
      });

      viewports.set('fusion-overlay', {
        id: 'fusion-overlay',
        positionId: '0-1',
        studyId: studyId ?? null,
        seriesId,
        secondarySeriesIds,
        type: 'FUSION',
        position: { row: 0, col: 1, width: 1, height: 1 },
        isActive: false,
        fusionConfig: {
          primarySeriesId: seriesId,
          secondarySeriesIds,
          opacities: secondarySeriesIds.map(() => 0.5),
        },
        label: 'Fused',
      });

    } else {
      // Standard grid layout
      let viewportIndex = 0;
      for (let row = 0; row < config.numRows; row++) {
        for (let col = 0; col < config.numCols; col++) {
          const positionId = `${row}-${col}`;
          const vpId = `viewport-${viewportIndex}`;
          
          // Try to preserve content from previous viewport at this position
          let existingViewport: Viewport | undefined;
          if (preserveContent) {
            existingViewport = Array.from(previousViewports.values()).find(
              vp => vp.positionId === positionId
            );
          }

          viewports.set(vpId, {
            id: vpId,
            positionId,
            studyId: existingViewport?.studyId ?? (viewportIndex === 0 ? studyId ?? null : null),
            seriesId: existingViewport?.seriesId ?? (viewportIndex === 0 ? seriesId ?? null : null),
            secondarySeriesIds: existingViewport?.secondarySeriesIds ?? 
              (viewportIndex === 0 ? secondarySeriesIds : undefined),
            type: 'STACK',
            position: { row, col, width: 1, height: 1 },
            isActive: viewportIndex === 0,
          });
          viewportIndex++;
        }
      }
    }

    const firstViewportId = viewports.keys().next().value;
    
    this.gridSubject.next({
      layout: config,
      viewports,
      activeViewportId: firstViewportId,
      isHangingProtocolLayout: false,
    });

    this.emitEvent('LAYOUT_CHANGED', { preset, config });
    console.log(`📐 ViewportGrid: Set layout to ${preset} with ${viewports.size} viewports`);
  }

  /**
   * Set a custom layout with explicit viewport options
   */
  setCustomLayout(options: {
    numRows: number;
    numCols: number;
    layoutOptions?: Array<{
      positionId: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    findOrCreateViewport?: (position: number, positionId: string, options: any) => Viewport | null;
    activeViewportId?: string;
    isHangingProtocolLayout?: boolean;
  }): void {
    const { numRows, numCols, layoutOptions = [], findOrCreateViewport, activeViewportId, isHangingProtocolLayout } = options;
    const viewports = new Map<string, Viewport>();

    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const position = col + row * numCols;
        const layoutOption = layoutOptions[position];
        
        let x, y, w, h;
        if (layoutOption) {
          ({ x, y, width: w, height: h } = layoutOption);
        } else {
          w = 1 / numCols;
          h = 1 / numRows;
          x = col * w;
          y = row * h;
        }

        const positionId = layoutOption?.positionId || `${row}-${col}`;
        
        let viewport: Viewport | null = null;
        if (findOrCreateViewport) {
          viewport = findOrCreateViewport(position, positionId, {});
        }

        if (!viewport) {
          const vpId = `viewport-${position}-${Date.now()}`;
          viewport = {
            id: vpId,
            positionId,
            studyId: null,
            seriesId: null,
            type: 'STACK',
            position: { row, col, width: 1, height: 1 },
            isActive: position === 0,
          };
        }

        viewport.positionId = positionId;
        viewports.set(viewport.id, viewport);
      }
    }

    const firstViewportId = activeViewportId || viewports.keys().next().value;

    this.gridSubject.next({
      layout: { numRows, numCols, layoutType: 'custom' },
      viewports,
      activeViewportId: firstViewportId,
      isHangingProtocolLayout: isHangingProtocolLayout ?? false,
    });

    this.emitEvent('LAYOUT_CHANGED', { numRows, numCols });
  }

  // =========================================================================
  // VIEWPORT MANAGEMENT
  // =========================================================================

  setActiveViewport(viewportId: string): void {
    const state = this.getState();
    if (!state.viewports.has(viewportId)) {
      console.warn(`ViewportGrid: Cannot activate unknown viewport ${viewportId}`);
      return;
    }

    const viewports = new Map(state.viewports);
    viewports.forEach((vp, id) => {
      viewports.set(id, { ...vp, isActive: id === viewportId });
    });

    this.gridSubject.next({
      ...state,
      viewports,
      activeViewportId: viewportId,
    });

    this.emitEvent('ACTIVE_VIEWPORT_CHANGED', { viewportId });
    console.log(`🎯 ViewportGrid: Activated viewport ${viewportId}`);
  }

  /**
   * Update a single viewport's properties
   */
  updateViewport(viewportId: string, updates: Partial<Viewport>): void {
    const state = this.getState();
    const viewport = state.viewports.get(viewportId);
    
    if (!viewport) {
      console.warn(`ViewportGrid: Cannot update unknown viewport ${viewportId}`);
      return;
    }

    const viewports = new Map(state.viewports);
    viewports.set(viewportId, { ...viewport, ...updates });

    this.gridSubject.next({
      ...state,
      viewports,
    });

    this.emitEvent('VIEWPORT_UPDATED', { viewportId, updates });
  }

  /**
   * Assign a series to a viewport
   */
  setSeriesForViewport(viewportId: string, seriesId: number, studyId?: number): void {
    this.updateViewport(viewportId, { 
      seriesId, 
      studyId: studyId ?? null,
      isReady: false,
    });
    console.log(`📌 ViewportGrid: Assigned series ${seriesId} to viewport ${viewportId}`);
  }

  /**
   * Set secondary series for fusion
   */
  setSecondarySeriesForViewport(
    viewportId: string, 
    secondarySeriesIds: number[], 
    fusionConfig?: Partial<FusionConfig>
  ): void {
    const viewport = this.getViewport(viewportId);
    if (!viewport) return;

    const updatedFusionConfig: FusionConfig | undefined = secondarySeriesIds.length > 0 ? {
      primarySeriesId: viewport.seriesId ?? 0,
      secondarySeriesIds,
      opacities: fusionConfig?.opacities ?? secondarySeriesIds.map(() => 0.5),
      colorMaps: fusionConfig?.colorMaps,
      blendMode: fusionConfig?.blendMode ?? 'overlay',
    } : undefined;

    this.updateViewport(viewportId, {
      secondarySeriesIds,
      fusionConfig: updatedFusionConfig,
      type: secondarySeriesIds.length > 0 ? 'FUSION' : 'STACK',
    });

    console.log(`🔀 ViewportGrid: Set ${secondarySeriesIds.length} secondary series for viewport ${viewportId}`);
  }

  /**
   * Update fusion opacity for a specific secondary
   */
  setFusionOpacity(viewportId: string, secondaryIndex: number, opacity: number): void {
    const viewport = this.getViewport(viewportId);
    if (!viewport?.fusionConfig) return;

    const opacities = [...viewport.fusionConfig.opacities];
    opacities[secondaryIndex] = Math.max(0, Math.min(1, opacity));

    this.updateViewport(viewportId, {
      fusionConfig: {
        ...viewport.fusionConfig,
        opacities,
      },
    });
  }

  /**
   * Mark a viewport as ready (finished loading)
   */
  setViewportReady(viewportId: string, isReady: boolean): void {
    this.updateViewport(viewportId, { isReady });
    
    // Check if all viewports are ready
    const state = this.getState();
    const allReady = Array.from(state.viewports.values()).every(vp => vp.isReady !== false);
    if (allReady) {
      this.emitEvent('VIEWPORTS_READY', {});
    }
  }

  // =========================================================================
  // SYNC GROUPS
  // =========================================================================

  /**
   * Add viewport to a sync group
   */
  setSyncGroup(viewportId: string, syncGroup: string | undefined): void {
    this.updateViewport(viewportId, { syncGroup });
  }

  /**
   * Get all viewports in the same sync group
   */
  getSyncedViewports(viewportId: string): Viewport[] {
    const viewport = this.getViewport(viewportId);
    if (!viewport?.syncGroup) return [];

    return this.getViewportsInSyncGroup(viewport.syncGroup)
      .filter(vp => vp.id !== viewportId);
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  /**
   * Calculate actual pixel dimensions for each viewport
   */
  calculateViewportDimensions(
    containerWidth: number, 
    containerHeight: number
  ): Map<string, { x: number; y: number; width: number; height: number }> {
    const state = this.getState();
    const { layout, viewports } = state;
    const dimensions = new Map<string, { x: number; y: number; width: number; height: number }>();

    const cellWidth = containerWidth / layout.numCols;
    const cellHeight = containerHeight / layout.numRows;

    viewports.forEach((viewport, id) => {
      const x = viewport.position.col * cellWidth;
      const y = viewport.position.row * cellHeight;
      const width = viewport.position.width * cellWidth;
      const height = viewport.position.height * cellHeight;

      dimensions.set(id, { x, y, width, height });
    });

    return dimensions;
  }

  /**
   * Reset to default 1x1 layout
   */
  reset(): void {
    this.setLayout('1x1');
    this.emitEvent('GRID_STATE_CHANGED', { reset: true });
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  private emitEvent(type: ViewportGridEventType, payload?: any): void {
    this.eventsSubject.next({ type, payload });
  }

  /**
   * Subscribe to grid events
   */
  subscribe(callback: (event: ViewportGridEvent) => void): () => void {
    const subscription = this.events$.subscribe(callback);
    return () => subscription.unsubscribe();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const viewportGridService = new ViewportGridService();

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook to access viewport grid state and actions
 */
export function useViewportGrid() {
  const [grid, setGrid] = useState<ViewportGrid>(viewportGridService.getState());

  useEffect(() => {
    const subscription = viewportGridService.grid$.subscribe(setGrid);
    return () => subscription.unsubscribe();
  }, []);

  const setLayout = useCallback((preset: GridLayoutPreset, options?: {
    seriesId?: number;
    studyId?: number;
    secondarySeriesIds?: number[];
    preserveContent?: boolean;
  }) => {
    viewportGridService.setLayout(preset, options);
  }, []);

  const setActiveViewport = useCallback((viewportId: string) => {
    viewportGridService.setActiveViewport(viewportId);
  }, []);

  const assignSeries = useCallback((viewportId: string, seriesId: number, studyId?: number) => {
    viewportGridService.setSeriesForViewport(viewportId, seriesId, studyId);
  }, []);

  const setSecondarySeriesIds = useCallback((viewportId: string, secondarySeriesIds: number[], config?: Partial<FusionConfig>) => {
    viewportGridService.setSecondarySeriesForViewport(viewportId, secondarySeriesIds, config);
  }, []);

  const updateViewport = useCallback((viewportId: string, updates: Partial<Viewport>) => {
    viewportGridService.updateViewport(viewportId, updates);
  }, []);

  const setViewportReady = useCallback((viewportId: string, isReady: boolean) => {
    viewportGridService.setViewportReady(viewportId, isReady);
  }, []);

  // Computed values
  const activeViewport = grid.activeViewportId 
    ? grid.viewports.get(grid.activeViewportId) 
    : undefined;

  const viewportsArray = Array.from(grid.viewports.values());

  return {
    // State
    grid,
    layout: grid.layout,
    viewports: grid.viewports,
    viewportsArray,
    activeViewportId: grid.activeViewportId,
    activeViewport,
    
    // Actions
    setLayout,
    setActiveViewport,
    assignSeries,
    setSecondarySeriesIds,
    updateViewport,
    setViewportReady,
    reset: () => viewportGridService.reset(),
    
    // Utilities
    getViewport: (id: string) => grid.viewports.get(id),
    getSyncedViewports: (id: string) => viewportGridService.getSyncedViewports(id),
  };
}

/**
 * Hook to subscribe to viewport grid events
 */
export function useViewportGridEvents(callback: (event: ViewportGridEvent) => void) {
  useEffect(() => {
    const unsubscribe = viewportGridService.subscribe(callback);
    return unsubscribe;
  }, [callback]);
}

// Legacy exports for backward compatibility
export type { Viewport, ViewportGrid };
export type GridLayout = GridLayoutPreset;
