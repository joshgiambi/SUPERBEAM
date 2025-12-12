/**
 * ContourEditContext - Cross-Viewport Contour Edit State Synchronization
 * 
 * This context enables real-time sharing of in-progress drawing operations across
 * multiple viewports. When a user draws with the pen or brush tool in one viewport,
 * other viewports display "ghost contours" showing the active drawing path.
 * 
 * Key features:
 * - Broadcasts active drawing strokes to all viewports
 * - Supports pen tool paths and brush strokes
 * - Tracks slice position for proper Z-based filtering
 * - Ghost contours appear semi-transparent in non-active viewports
 * - Clears automatically when drawing completes
 */

import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';

// Types for different drawing operations
export type DrawingToolType = 'pen' | 'brush' | 'eraser' | 'smart_brush';

export interface ActiveDrawingPoint {
  x: number;  // World X coordinate
  y: number;  // World Y coordinate
  z: number;  // World Z coordinate (slice position)
}

export interface ActiveDrawingStroke {
  /** Unique ID for this drawing operation */
  id: string;
  /** Source viewport ID (to avoid rendering ghost in source viewport) */
  sourceViewportId: string;
  /** Tool being used */
  toolType: DrawingToolType;
  /** Structure being edited (ROI number) */
  structureId: number;
  /** Structure color [R, G, B] */
  structureColor: [number, number, number];
  /** Z position (slice position in mm) */
  slicePosition: number;
  /** Points in the current stroke (world coordinates) */
  points: ActiveDrawingPoint[];
  /** Whether this is an additive or subtractive operation */
  mode: 'add' | 'subtract';
  /** Brush size (for brush tools) */
  brushSize?: number;
  /** Timestamp for cleanup */
  timestamp: number;
}

export interface CompletedContourEdit {
  /** Unique ID */
  id: string;
  /** Source viewport ID */
  sourceViewportId: string;
  /** Structure being edited */
  structureId: number;
  /** Z position */
  slicePosition: number;
  /** Final contour points (flat array [x,y,z,x,y,z,...]) */
  contourPoints: number[];
  /** Operation type */
  action: 'add_contour' | 'modify_contour' | 'delete_contour' | 'brush_stroke' | 'erase_stroke';
  /** Timestamp */
  timestamp: number;
}

interface ContourEditState {
  /** Currently active drawing strokes (can have multiple for different structures) */
  activeStrokes: Map<string, ActiveDrawingStroke>;
  /** Recently completed edits (for cross-viewport sync) */
  recentEdits: CompletedContourEdit[];
  /** Whether any viewport is actively drawing */
  isDrawing: boolean;
  /** The viewport ID that is currently drawing */
  activeDrawingViewportId: string | null;
}

type Action =
  | { type: 'startStroke'; stroke: ActiveDrawingStroke }
  | { type: 'updateStroke'; strokeId: string; points: ActiveDrawingPoint[] }
  | { type: 'endStroke'; strokeId: string }
  | { type: 'clearStrokes'; viewportId?: string }
  | { type: 'addCompletedEdit'; edit: CompletedContourEdit }
  | { type: 'clearOldEdits'; maxAge: number }
  | { type: 'reset' };

const initialState: ContourEditState = {
  activeStrokes: new Map(),
  recentEdits: [],
  isDrawing: false,
  activeDrawingViewportId: null,
};

function contourEditReducer(state: ContourEditState, action: Action): ContourEditState {
  switch (action.type) {
    case 'startStroke': {
      const newStrokes = new Map(state.activeStrokes);
      newStrokes.set(action.stroke.id, action.stroke);
      return {
        ...state,
        activeStrokes: newStrokes,
        isDrawing: true,
        activeDrawingViewportId: action.stroke.sourceViewportId,
      };
    }
    
    case 'updateStroke': {
      const stroke = state.activeStrokes.get(action.strokeId);
      if (!stroke) return state;
      
      const newStrokes = new Map(state.activeStrokes);
      newStrokes.set(action.strokeId, {
        ...stroke,
        points: action.points,
        timestamp: Date.now(),
      });
      return {
        ...state,
        activeStrokes: newStrokes,
      };
    }
    
    case 'endStroke': {
      const newStrokes = new Map(state.activeStrokes);
      newStrokes.delete(action.strokeId);
      return {
        ...state,
        activeStrokes: newStrokes,
        isDrawing: newStrokes.size > 0,
        activeDrawingViewportId: newStrokes.size > 0 ? state.activeDrawingViewportId : null,
      };
    }
    
    case 'clearStrokes': {
      if (action.viewportId) {
        const newStrokes = new Map(state.activeStrokes);
        for (const [id, stroke] of newStrokes) {
          if (stroke.sourceViewportId === action.viewportId) {
            newStrokes.delete(id);
          }
        }
        return {
          ...state,
          activeStrokes: newStrokes,
          isDrawing: newStrokes.size > 0,
          activeDrawingViewportId: newStrokes.size > 0 ? state.activeDrawingViewportId : null,
        };
      }
      return {
        ...state,
        activeStrokes: new Map(),
        isDrawing: false,
        activeDrawingViewportId: null,
      };
    }
    
    case 'addCompletedEdit': {
      // Keep only last 20 edits for memory
      const recentEdits = [action.edit, ...state.recentEdits].slice(0, 20);
      return {
        ...state,
        recentEdits,
      };
    }
    
    case 'clearOldEdits': {
      const cutoff = Date.now() - action.maxAge;
      const recentEdits = state.recentEdits.filter(edit => edit.timestamp > cutoff);
      return {
        ...state,
        recentEdits,
      };
    }
    
    case 'reset':
      return initialState;
      
    default:
      return state;
  }
}

interface ContourEditContextValue {
  /** Active drawing strokes from all viewports */
  activeStrokes: Map<string, ActiveDrawingStroke>;
  /** Recent completed edits */
  recentEdits: CompletedContourEdit[];
  /** Whether any viewport is drawing */
  isDrawing: boolean;
  /** The viewport that is drawing */
  activeDrawingViewportId: string | null;
  
  /** Start a new drawing stroke */
  startStroke: (stroke: Omit<ActiveDrawingStroke, 'id' | 'timestamp'>) => string;
  /** Update points in an active stroke */
  updateStroke: (strokeId: string, points: ActiveDrawingPoint[]) => void;
  /** End a drawing stroke */
  endStroke: (strokeId: string) => void;
  /** Clear all strokes from a viewport */
  clearStrokes: (viewportId?: string) => void;
  /** Record a completed edit (for sync) */
  addCompletedEdit: (edit: Omit<CompletedContourEdit, 'id' | 'timestamp'>) => void;
  
  /** Get active strokes for a specific slice position (with tolerance) */
  getStrokesAtSlice: (slicePosition: number, tolerance: number, excludeViewportId?: string) => ActiveDrawingStroke[];
  /** Get active strokes for a specific structure */
  getStrokesForStructure: (structureId: number, excludeViewportId?: string) => ActiveDrawingStroke[];
}

const ContourEditContext = createContext<ContourEditContextValue | undefined>(undefined);

interface ContourEditProviderProps {
  children: ReactNode;
}

export function ContourEditProvider({ children }: ContourEditProviderProps) {
  const [state, dispatch] = useReducer(contourEditReducer, initialState);
  const strokeIdCounter = useRef(0);
  
  // Cleanup old edits periodically
  const lastCleanupRef = useRef(Date.now());
  if (Date.now() - lastCleanupRef.current > 60000) {
    lastCleanupRef.current = Date.now();
    dispatch({ type: 'clearOldEdits', maxAge: 60000 });
  }
  
  const startStroke = useCallback((stroke: Omit<ActiveDrawingStroke, 'id' | 'timestamp'>): string => {
    const id = `stroke-${++strokeIdCounter.current}-${Date.now()}`;
    console.log(`🎨 [ContourEditContext] Starting stroke from viewport "${stroke.sourceViewportId}" at slice ${stroke.slicePosition}, tool: ${stroke.toolType}`);
    dispatch({
      type: 'startStroke',
      stroke: {
        ...stroke,
        id,
        timestamp: Date.now(),
      },
    });
    return id;
  }, []);
  
  const updateStroke = useCallback((strokeId: string, points: ActiveDrawingPoint[]) => {
    dispatch({ type: 'updateStroke', strokeId, points });
  }, []);
  
  const endStroke = useCallback((strokeId: string) => {
    dispatch({ type: 'endStroke', strokeId });
  }, []);
  
  const clearStrokes = useCallback((viewportId?: string) => {
    dispatch({ type: 'clearStrokes', viewportId });
  }, []);
  
  const addCompletedEdit = useCallback((edit: Omit<CompletedContourEdit, 'id' | 'timestamp'>) => {
    const id = `edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    dispatch({
      type: 'addCompletedEdit',
      edit: {
        ...edit,
        id,
        timestamp: Date.now(),
      },
    });
  }, []);
  
  const getStrokesAtSlice = useCallback((
    slicePosition: number, 
    tolerance: number,
    excludeViewportId?: string
  ): ActiveDrawingStroke[] => {
    const result: ActiveDrawingStroke[] = [];
    const totalStrokes = state.activeStrokes.size;
    for (const stroke of state.activeStrokes.values()) {
      // Skip strokes from the requesting viewport
      if (excludeViewportId && stroke.sourceViewportId === excludeViewportId) {
        continue;
      }
      // Check if stroke is at the same slice (within tolerance)
      if (Math.abs(stroke.slicePosition - slicePosition) <= tolerance) {
        result.push(stroke);
      }
    }
    if (totalStrokes > 0) {
      console.log(`🔍 [ContourEditContext] getStrokesAtSlice: ${totalStrokes} total strokes, ${result.length} matching for viewport "${excludeViewportId}" at slice ${slicePosition.toFixed(1)} (±${tolerance})`);
    }
    return result;
  }, [state.activeStrokes]);
  
  const getStrokesForStructure = useCallback((
    structureId: number,
    excludeViewportId?: string
  ): ActiveDrawingStroke[] => {
    const result: ActiveDrawingStroke[] = [];
    for (const stroke of state.activeStrokes.values()) {
      if (excludeViewportId && stroke.sourceViewportId === excludeViewportId) {
        continue;
      }
      if (stroke.structureId === structureId) {
        result.push(stroke);
      }
    }
    return result;
  }, [state.activeStrokes]);
  
  const value = useMemo<ContourEditContextValue>(() => ({
    activeStrokes: state.activeStrokes,
    recentEdits: state.recentEdits,
    isDrawing: state.isDrawing,
    activeDrawingViewportId: state.activeDrawingViewportId,
    startStroke,
    updateStroke,
    endStroke,
    clearStrokes,
    addCompletedEdit,
    getStrokesAtSlice,
    getStrokesForStructure,
  }), [
    state.activeStrokes,
    state.recentEdits,
    state.isDrawing,
    state.activeDrawingViewportId,
    startStroke,
    updateStroke,
    endStroke,
    clearStrokes,
    addCompletedEdit,
    getStrokesAtSlice,
    getStrokesForStructure,
  ]);
  
  return (
    <ContourEditContext.Provider value={value}>
      {children}
    </ContourEditContext.Provider>
  );
}

export function useContourEdit(): ContourEditContextValue {
  const context = useContext(ContourEditContext);
  if (!context) {
    throw new Error('useContourEdit must be used within a ContourEditProvider');
  }
  return context;
}

/**
 * Safe version of useContourEdit that returns null if provider is not available.
 * Use this in tools that may render outside the provider.
 */
export function useContourEditSafe(): ContourEditContextValue | null {
  const context = useContext(ContourEditContext);
  return context ?? null;
}

/**
 * Hook to get ghost contours for rendering in a specific viewport
 * Returns strokes from OTHER viewports that should be displayed as ghosts
 */
export function useGhostContours(
  viewportId: string,
  currentSlicePosition: number,
  sliceTolerance: number = 0.5
): ActiveDrawingStroke[] {
  const context = useContourEditSafe();
  return useMemo(
    () => {
      if (!context) return [];
      return context.getStrokesAtSlice(currentSlicePosition, sliceTolerance, viewportId);
    },
    [context, currentSlicePosition, sliceTolerance, viewportId]
  );
}

