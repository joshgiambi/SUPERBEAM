/**
 * DoseContext - React Context for RT Dose Visualization State
 * 
 * Provides centralized state management for dose overlay display,
 * following the same patterns as FusionContext.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import {
  RTDoseManager,
  type RTDoseConfig,
  type RTDoseMetadata,
  type DoseOverlayCanvas,
  type IsodoseLine,
  type DoseColormap,
  getDefaultDoseConfig,
} from '@/lib/rt-dose-manager';

// ============================================================================
// Types
// ============================================================================

export type DoseLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DoseOverlayRequest {
  slicePosition: number;
  imageWidth: number;
  imageHeight: number;
}

interface DoseState {
  // Series selection
  availableDoseSeries: Array<{
    id: number;
    seriesInstanceUID: string;
    description: string;
  }>;
  selectedDoseSeriesId: number | null;
  
  // Loading state
  loadStatus: DoseLoadStatus;
  loadError: string | null;
  
  // Dose metadata
  metadata: RTDoseMetadata | null;
  
  // Display configuration
  config: RTDoseConfig;
  
  // Visibility toggle
  isVisible: boolean;
}

type Action =
  | { type: 'reset' }
  | { type: 'setAvailableSeries'; series: DoseState['availableDoseSeries'] }
  | { type: 'setSelectedSeries'; id: number | null }
  | { type: 'setLoadStatus'; status: DoseLoadStatus }
  | { type: 'setLoadError'; error: string | null }
  | { type: 'setMetadata'; metadata: RTDoseMetadata | null }
  | { type: 'updateConfig'; config: Partial<RTDoseConfig> }
  | { type: 'setColormap'; colormap: DoseColormap }
  | { type: 'setOpacity'; opacity: number }
  | { type: 'setThresholds'; thresholds: Partial<RTDoseConfig['thresholds']> }
  | { type: 'setShowIsodose'; show: boolean }
  | { type: 'setIsodoseLevels'; levels: number[] }
  | { type: 'setVisible'; visible: boolean };

const initialState: DoseState = {
  availableDoseSeries: [],
  selectedDoseSeriesId: null,
  loadStatus: 'idle',
  loadError: null,
  metadata: null,
  config: getDefaultDoseConfig(),
  isVisible: true,
};

function doseReducer(state: DoseState, action: Action): DoseState {
  switch (action.type) {
    case 'reset':
      return {
        ...initialState,
        config: state.config, // Preserve user preferences
      };

    case 'setAvailableSeries':
      return { ...state, availableDoseSeries: action.series };

    case 'setSelectedSeries':
      return {
        ...state,
        selectedDoseSeriesId: action.id,
        loadStatus: action.id ? 'loading' : 'idle',
        loadError: null,
        metadata: null,
      };

    case 'setLoadStatus':
      return { ...state, loadStatus: action.status };

    case 'setLoadError':
      return {
        ...state,
        loadStatus: 'error',
        loadError: action.error,
      };

    case 'setMetadata':
      return {
        ...state,
        metadata: action.metadata,
        loadStatus: action.metadata ? 'ready' : 'idle',
      };

    case 'updateConfig':
      return {
        ...state,
        config: { ...state.config, ...action.config },
      };

    case 'setColormap':
      return {
        ...state,
        config: { ...state.config, colormap: action.colormap },
      };

    case 'setOpacity':
      return {
        ...state,
        config: { ...state.config, opacity: Math.max(0, Math.min(1, action.opacity)) },
      };

    case 'setThresholds':
      return {
        ...state,
        config: {
          ...state.config,
          thresholds: { ...state.config.thresholds, ...action.thresholds },
        },
      };

    case 'setShowIsodose':
      return {
        ...state,
        config: { ...state.config, showIsodose: action.show },
      };

    case 'setIsodoseLevels':
      return {
        ...state,
        config: { ...state.config, isodoseLevels: action.levels },
      };

    case 'setVisible':
      return { ...state, isVisible: action.visible };

    default:
      return state;
  }
}

// ============================================================================
// Context Value Interface
// ============================================================================

interface DoseContextValue {
  // State
  availableDoseSeries: DoseState['availableDoseSeries'];
  selectedDoseSeriesId: number | null;
  loadStatus: DoseLoadStatus;
  loadError: string | null;
  metadata: RTDoseMetadata | null;
  config: RTDoseConfig;
  isVisible: boolean;

  // Actions
  setAvailableSeries: (series: DoseState['availableDoseSeries']) => void;
  selectDoseSeries: (seriesId: number | null) => Promise<void>;
  setColormap: (colormap: DoseColormap) => void;
  setOpacity: (opacity: number) => void;
  setPrescriptionDose: (dose: number) => void;
  setThresholds: (min: number, max: number) => void;
  toggleIsodoseLines: () => void;
  setIsodoseLevels: (levels: number[]) => void;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;

  // Overlay access
  getOverlayForSlice: (request: DoseOverlayRequest) => Promise<DoseOverlayCanvas | null>;
  getIsodoseContours: (slicePosition: number) => Promise<IsodoseLine[]>;

  // Utilities
  refreshDoseSeries: () => Promise<void>;
  clearCache: () => void;
  
  // Computed
  hasDoseOverlay: boolean;
  prescriptionDose: number | undefined;
}

const DoseContext = createContext<DoseContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface DoseProviderProps {
  studyId: number | null;
  children: ReactNode;
}

export function DoseProvider({ studyId, children }: DoseProviderProps) {
  const [state, dispatch] = useReducer(doseReducer, initialState);
  const managerRef = useRef<RTDoseManager | null>(null);
  const previousStudyRef = useRef<number | null>(null);

  // Initialize manager on mount
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new RTDoseManager(state.config);
    }
    return () => {
      managerRef.current?.clearCache();
    };
  }, []);

  // Sync config changes to manager
  useEffect(() => {
    managerRef.current?.updateConfig(state.config);
  }, [state.config]);

  // Fetch available dose series when study changes
  useEffect(() => {
    if (studyId === previousStudyRef.current) return;
    previousStudyRef.current = studyId;

    if (!studyId) {
      dispatch({ type: 'reset' });
      return;
    }

    const fetchDoseSeries = async () => {
      try {
        const response = await fetch(`/api/studies/${studyId}/series?modality=RTDOSE`);
        if (!response.ok) {
          dispatch({ type: 'setAvailableSeries', series: [] });
          return;
        }

        const series = await response.json();
        const doseSeries = series.map((s: any) => ({
          id: s.id,
          seriesInstanceUID: s.seriesInstanceUID,
          description: s.seriesDescription || 'RT Dose',
        }));

        dispatch({ type: 'setAvailableSeries', series: doseSeries });

        // Auto-select first dose series if available
        if (doseSeries.length > 0 && !state.selectedDoseSeriesId) {
          dispatch({ type: 'setSelectedSeries', id: doseSeries[0].id });
        }
      } catch (error) {
        console.error('Error fetching dose series:', error);
        dispatch({ type: 'setAvailableSeries', series: [] });
      }
    };

    fetchDoseSeries();
  }, [studyId, state.selectedDoseSeriesId]);

  // Load dose metadata when series is selected
  useEffect(() => {
    if (!state.selectedDoseSeriesId) return;

    const loadDose = async () => {
      dispatch({ type: 'setLoadStatus', status: 'loading' });

      try {
        const metadata = await managerRef.current?.setDoseSeries(state.selectedDoseSeriesId!);
        
        if (metadata) {
          dispatch({ type: 'setMetadata', metadata });

          // Update thresholds based on actual dose range
          if (metadata.maxDose) {
            dispatch({
              type: 'setThresholds',
              thresholds: {
                max: metadata.maxDose * 1.1, // 10% headroom
              },
            });
          }
        } else {
          dispatch({ type: 'setLoadError', error: 'Failed to load dose data' });
        }
      } catch (error) {
        console.error('Error loading dose:', error);
        dispatch({
          type: 'setLoadError',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    loadDose();
  }, [state.selectedDoseSeriesId]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  const setAvailableSeries = useCallback((series: DoseState['availableDoseSeries']) => {
    dispatch({ type: 'setAvailableSeries', series });
  }, []);

  const selectDoseSeries = useCallback(async (seriesId: number | null) => {
    managerRef.current?.clearCache();
    dispatch({ type: 'setSelectedSeries', id: seriesId });
  }, []);

  const setColormap = useCallback((colormap: DoseColormap) => {
    dispatch({ type: 'setColormap', colormap });
  }, []);

  const setOpacity = useCallback((opacity: number) => {
    dispatch({ type: 'setOpacity', opacity });
  }, []);

  const setPrescriptionDose = useCallback((dose: number) => {
    dispatch({ type: 'setThresholds', thresholds: { prescription: dose } });
  }, []);

  const setThresholds = useCallback((min: number, max: number) => {
    dispatch({ type: 'setThresholds', thresholds: { min, max } });
  }, []);

  const toggleIsodoseLines = useCallback(() => {
    dispatch({ type: 'setShowIsodose', show: !state.config.showIsodose });
  }, [state.config.showIsodose]);

  const setIsodoseLevels = useCallback((levels: number[]) => {
    dispatch({ type: 'setIsodoseLevels', levels });
  }, []);

  const setVisible = useCallback((visible: boolean) => {
    dispatch({ type: 'setVisible', visible });
  }, []);

  const toggleVisible = useCallback(() => {
    dispatch({ type: 'setVisible', visible: !state.isVisible });
  }, [state.isVisible]);

  const getOverlayForSlice = useCallback(
    async ({ slicePosition, imageWidth, imageHeight }: DoseOverlayRequest): Promise<DoseOverlayCanvas | null> => {
      if (!state.isVisible || state.loadStatus !== 'ready') return null;
      
      try {
        return await managerRef.current?.getOverlay(slicePosition, imageWidth, imageHeight) ?? null;
      } catch (error) {
        console.warn('Failed to get dose overlay:', error);
        return null;
      }
    },
    [state.isVisible, state.loadStatus]
  );

  const getIsodoseContours = useCallback(
    async (slicePosition: number): Promise<IsodoseLine[]> => {
      if (!state.config.showIsodose || state.loadStatus !== 'ready') return [];
      
      try {
        return await managerRef.current?.getIsodoseContours(slicePosition) ?? [];
      } catch (error) {
        console.warn('Failed to get isodose contours:', error);
        return [];
      }
    },
    [state.config.showIsodose, state.loadStatus]
  );

  const refreshDoseSeries = useCallback(async () => {
    if (!studyId) return;
    
    previousStudyRef.current = null; // Force refresh
    dispatch({ type: 'reset' });
  }, [studyId]);

  const clearCache = useCallback(() => {
    managerRef.current?.clearCache();
  }, []);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<DoseContextValue>(() => ({
    // State
    availableDoseSeries: state.availableDoseSeries,
    selectedDoseSeriesId: state.selectedDoseSeriesId,
    loadStatus: state.loadStatus,
    loadError: state.loadError,
    metadata: state.metadata,
    config: state.config,
    isVisible: state.isVisible,

    // Actions
    setAvailableSeries,
    selectDoseSeries,
    setColormap,
    setOpacity,
    setPrescriptionDose,
    setThresholds,
    toggleIsodoseLines,
    setIsodoseLevels,
    setVisible,
    toggleVisible,

    // Overlay access
    getOverlayForSlice,
    getIsodoseContours,

    // Utilities
    refreshDoseSeries,
    clearCache,

    // Computed
    hasDoseOverlay: state.loadStatus === 'ready' && state.isVisible,
    prescriptionDose: state.config.thresholds.prescription,
  }), [
    state.availableDoseSeries,
    state.selectedDoseSeriesId,
    state.loadStatus,
    state.loadError,
    state.metadata,
    state.config,
    state.isVisible,
    setAvailableSeries,
    selectDoseSeries,
    setColormap,
    setOpacity,
    setPrescriptionDose,
    setThresholds,
    toggleIsodoseLines,
    setIsodoseLevels,
    setVisible,
    toggleVisible,
    getOverlayForSlice,
    getIsodoseContours,
    refreshDoseSeries,
    clearCache,
  ]);

  return <DoseContext.Provider value={value}>{children}</DoseContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useDose(): DoseContextValue {
  const context = useContext(DoseContext);
  if (!context) {
    throw new Error('useDose must be used within a DoseProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if not inside provider
 * Useful for components that may or may not have dose context
 */
export function useDoseOptional(): DoseContextValue | null {
  return useContext(DoseContext) ?? null;
}

