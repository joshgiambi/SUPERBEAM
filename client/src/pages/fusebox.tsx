/**
 * FuseBox - Standalone Fusion Registration Editor
 * 
 * Opens in a new browser window for comprehensive fusion evaluation and editing.
 * Uses actual DICOM rendering via WorkingViewer components.
 * 
 * Features:
 * - Side-by-side synchronized viewports (Primary + Secondary with fusion)
 * - Opacity control for fusion blending
 * - Linked navigation (scroll, zoom, pan)
 * - Future: Manual registration adjustments
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  X,
  RotateCcw,
  Save,
  Grid3X3,
  Crosshair,
  Layers,
  Move,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
  SunMedium,
  AlertTriangle,
  Target,
  Link,
  Link2Off,
  Hand,
  CircuitBoard,
  Layers3,
  Gauge,
  Undo2,
  Redo2,
  GripHorizontal,
  Ruler,
  Wand2,
  Cpu,
  RefreshCw,
  Eye,
  EyeOff,
  Scan,
  Check,
} from 'lucide-react';
import { WorkingViewer } from '@/components/dicom/working-viewer';
import { MPRFloating } from '@/components/dicom/mpr-floating';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { fetchFusionManifest } from '@/lib/fusion-utils';

// ============================================================================
// TYPES
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface TransformState {
  translation: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  transform: TransformState;
  description: string;
}

interface FuseBoxData {
  primarySeriesId: number;
  primaryModality: string;
  primaryDescription: string;
  primarySliceCount: number;
  secondarySeriesId: number;
  secondaryModality: string;
  secondaryDescription: string;
  secondarySliceCount: number;
  currentOpacity: number;
  studyId?: number;
  registrationId?: string;
}

type AutoRegistrationType = 'rigid' | 'contourBased' | 'landmarkBased' | 'intensityBased' | 'deformable';

// ============================================================================
// DATA LOADING
// ============================================================================

const getFuseBoxData = (): FuseBoxData | null => {
  try {
    const data = sessionStorage.getItem('fusebox-data');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to parse fusebox data:', e);
  }
  return null;
};

const INITIAL_TRANSFORM: TransformState = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getModalityColor = (modality: string): string => {
  const mod = modality?.toUpperCase() || '';
  if (mod === 'PT' || mod === 'PET') return 'amber';
  if (mod === 'MR' || mod === 'MRI') return 'purple';
  if (mod === 'CT') return 'cyan';
  return 'gray';
};

const formatNumber = (val: number, decimals: number = 1): string => {
  return val.toFixed(decimals);
};

// ============================================================================
// NUMERIC INPUT COMPONENT
// ============================================================================

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  unit?: string;
  color?: 'red' | 'green' | 'blue' | 'amber';
}

function NumericInput({ 
  value, onChange, min = -100, max = 100, step = 0.5, 
  label, unit = 'mm', color = 'blue'
}: NumericInputProps) {
  const colorClasses = {
    red: 'border-red-500/30 focus:border-red-400 text-red-300',
    green: 'border-green-500/30 focus:border-green-400 text-green-300',
    blue: 'border-blue-500/30 focus:border-blue-400 text-blue-300',
    amber: 'border-amber-500/30 focus:border-amber-400 text-amber-300',
  }[color];

  const labelColorClass = {
    red: 'text-red-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
  }[color];

  return (
    <div className="flex items-center gap-1">
      <span className={cn("text-xs font-bold w-4 text-center", labelColorClass)}>{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={formatNumber(value)}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))}
        step={step}
        className={cn(
          "h-6 w-14 px-1.5 rounded-md bg-[#0d1117]/80 border text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-offset-0",
          colorClasses
        )}
      />
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

// ============================================================================
// AUTO REGISTRATION BUTTON
// ============================================================================

interface AutoRegButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  isRunning?: boolean;
  disabled?: boolean;
}

function AutoRegButton({ onClick, icon, label, description, isRunning = false, disabled = false }: AutoRegButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isRunning}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all w-full",
        isRunning
          ? "bg-purple-500/20 border-purple-500/30 text-purple-300"
          : disabled
          ? "bg-[#0d1117]/50 border-white/5 text-gray-600 cursor-not-allowed"
          : "bg-[#0d1117]/80 border-white/10 text-gray-200 hover:border-purple-500/30 hover:bg-purple-500/10"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-lg",
        isRunning ? "bg-purple-500/20" : "bg-white/5"
      )}>
        {isRunning ? (
          <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
        ) : (
          <span className="text-purple-400">{icon}</span>
        )}
      </div>
      <div className="flex-1 text-left">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[9px] text-gray-500">{description}</div>
      </div>
      {!isRunning && <ChevronRight className="w-4 h-4 text-gray-500" />}
    </button>
  );
}

// ============================================================================
// MAIN FUSEBOX COMPONENT
// ============================================================================

function FuseBoxContent() {
  // Load data from sessionStorage
  const fuseboxData = useMemo(() => getFuseBoxData(), []);
  
  // Sync state between viewports
  const [syncedSliceIndex, setSyncedSliceIndex] = useState(1);
  const [syncedZoom, setSyncedZoom] = useState(1);
  const [syncedPan, setSyncedPan] = useState({ x: 0, y: 0 });
  const [isLinked, setIsLinked] = useState(true);
  
  // Fusion settings
  const [fusionOpacity, setFusionOpacity] = useState(fuseboxData?.currentOpacity ?? 0.5);
  const [showFusion, setShowFusion] = useState(true);
  
  // Window/Level state
  const [primaryWindowLevel, setPrimaryWindowLevel] = useState({ window: 400, level: 40 });
  const [secondaryWindowLevel, setSecondaryWindowLevel] = useState({ window: 600, level: 300 });
  
  // Transform state (for future manual registration)
  const [currentTransform, setCurrentTransform] = useState<TransformState>({ ...INITIAL_TRANSFORM });
  const [originalTransform] = useState<TransformState>({ ...INITIAL_TRANSFORM });
  
  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Auto registration state
  const [isAutoRegistering, setIsAutoRegistering] = useState(false);
  const [autoRegType, setAutoRegType] = useState<AutoRegistrationType | null>(null);
  
  // Panel state
  const [activePanel, setActivePanel] = useState<'controls' | 'transform' | 'autoReg'>('controls');
  
  // Drag state for translation
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'translate' | 'pan'>('translate');
  
  // Crosshair position for MPR slice selection - initialized to center of image
  const [crosshairPos, setCrosshairPos] = useState({ x: 256, y: 256 });
  
  // Compute the coronal slice index based on crosshair Y position
  const coronalSliceIndex = useMemo(() => {
    return Math.max(0, crosshairPos.y) || 256;
  }, [crosshairPos.y]);
  
  // Compute the sagittal slice index based on crosshair X position
  const sagittalSliceIndex = useMemo(() => {
    return Math.max(0, crosshairPos.x) || 256;
  }, [crosshairPos.x]);
  
  // Image cache ref for WorkingViewer
  const imageCache = useRef(new Map());
  
  // Images loaded from the primary axial viewer (for MPRFloating)
  const [primaryImages, setPrimaryImages] = useState<any[]>([]);
  
  // Cache readiness counter - increments to trigger MPRFloating re-renders when cache populates
  const [mprCacheVersion, setMprCacheVersion] = useState(0);
  
  // Poll for cache readiness when primaryImages are set
  useEffect(() => {
    if (primaryImages.length === 0) return;
    
    const cache = (window as any).__WV_CACHE__ as Map<string, any> | undefined;
    if (!cache) return;
    
    // Check how many images are cached
    const checkCacheReady = () => {
      let cachedCount = 0;
      for (const img of primaryImages) {
        if (cache.has(img.sopInstanceUID)) {
          cachedCount++;
        }
      }
      return cachedCount;
    };
    
    // If already have enough cached, trigger one update
    const initialCount = checkCacheReady();
    if (initialCount >= Math.min(10, primaryImages.length)) {
      console.log(`[FuseBox] MPR cache ready: ${initialCount}/${primaryImages.length} images`);
      setMprCacheVersion(v => v + 1);
      return;
    }
    
    // Poll until cache is populated
    let pollCount = 0;
    const maxPolls = 30; // 3 seconds max
    const pollInterval = setInterval(() => {
      pollCount++;
      const cachedCount = checkCacheReady();
      console.log(`[FuseBox] MPR cache poll ${pollCount}: ${cachedCount}/${primaryImages.length} images`);
      
      if (cachedCount >= Math.min(10, primaryImages.length) || pollCount >= maxPolls) {
        clearInterval(pollInterval);
        setMprCacheVersion(v => v + 1);
      }
    }, 100);
    
    return () => clearInterval(pollInterval);
  }, [primaryImages]);
  
  // Fusion manifest loading state
  const [fusionManifestLoading, setFusionManifestLoading] = useState(true);
  const [fusionManifestError, setFusionManifestError] = useState<string | null>(null);
  
  // Create fusion status map based on loading state
  const fusionSecondaryStatuses = useMemo(() => {
    const statusMap = new Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>();
    if (fuseboxData?.secondarySeriesId) {
      if (fusionManifestLoading) {
        statusMap.set(fuseboxData.secondarySeriesId, { status: 'loading', error: null });
      } else if (fusionManifestError) {
        statusMap.set(fuseboxData.secondarySeriesId, { status: 'error', error: fusionManifestError });
      } else {
        statusMap.set(fuseboxData.secondarySeriesId, { status: 'ready', error: null });
      }
    }
    return statusMap;
  }, [fuseboxData?.secondarySeriesId, fusionManifestLoading, fusionManifestError]);
  
  // Initialize fusion manifest on mount
  useEffect(() => {
    if (!fuseboxData?.primarySeriesId || !fuseboxData?.secondarySeriesId) return;
    
    let cancelled = false;
    
    const initFusion = async () => {
      setFusionManifestLoading(true);
      setFusionManifestError(null);
      
      try {
        console.log('[FuseBox] Fetching fusion manifest for primary:', fuseboxData.primarySeriesId, 'secondary:', fuseboxData.secondarySeriesId);
        
        // Fetch and cache the fusion manifest
        const manifest = await fetchFusionManifest(fuseboxData.primarySeriesId, {
          secondarySeriesIds: [fuseboxData.secondarySeriesId],
          preload: true,
        });
        
        if (cancelled) return;
        
        console.log('[FuseBox] Fusion manifest loaded:', manifest);
        
        // Check if secondary is ready
        const secondary = manifest.secondaries.find(s => s.secondarySeriesId === fuseboxData.secondarySeriesId);
        console.log('[FuseBox] Secondary status:', secondary?.status, 'descriptor:', secondary);
        if (secondary?.status === 'ready') {
          console.log('[FuseBox] Fusion manifest ready, enabling secondary overlay');
          setFusionManifestLoading(false);
        } else if (secondary?.status === 'error') {
          setFusionManifestError(secondary.error || 'Fusion failed to load');
          setFusionManifestLoading(false);
        } else {
          // Poll for readiness if still loading
          const pollInterval = setInterval(async () => {
            if (cancelled) {
              clearInterval(pollInterval);
              return;
            }
            
            try {
              const updated = await fetchFusionManifest(fuseboxData.primarySeriesId, {
                secondarySeriesIds: [fuseboxData.secondarySeriesId],
              });
              
              const sec = updated.secondaries.find(s => s.secondarySeriesId === fuseboxData.secondarySeriesId);
              if (sec?.status === 'ready') {
                clearInterval(pollInterval);
                setFusionManifestLoading(false);
              } else if (sec?.status === 'error') {
                clearInterval(pollInterval);
                setFusionManifestError(sec.error || 'Fusion failed');
                setFusionManifestLoading(false);
              }
            } catch (e) {
              console.error('[FuseBox] Poll error:', e);
            }
          }, 1000);
          
          // Stop polling after 30 seconds
          setTimeout(() => {
            clearInterval(pollInterval);
            if (fusionManifestLoading) {
              setFusionManifestError('Fusion loading timed out');
              setFusionManifestLoading(false);
            }
          }, 30000);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[FuseBox] Failed to load fusion manifest:', error);
        setFusionManifestError(error instanceof Error ? error.message : 'Failed to load fusion');
        setFusionManifestLoading(false);
      }
    };
    
    initFusion();
    
    return () => {
      cancelled = true;
    };
  }, [fuseboxData?.primarySeriesId, fuseboxData?.secondarySeriesId]);
  
  // Check if we have valid data
  const hasValidData = fuseboxData && fuseboxData.primarySeriesId && fuseboxData.secondarySeriesId;
  
  // Check if transform has changed
  const hasChanges = useMemo(() => {
    return (
      currentTransform.translation.x !== originalTransform.translation.x ||
      currentTransform.translation.y !== originalTransform.translation.y ||
      currentTransform.translation.z !== originalTransform.translation.z ||
      currentTransform.rotation.x !== originalTransform.rotation.x ||
      currentTransform.rotation.y !== originalTransform.rotation.y ||
      currentTransform.rotation.z !== originalTransform.rotation.z
    );
  }, [currentTransform, originalTransform]);
  
  // Handlers
  const addToHistory = useCallback((transform: TransformState, description: string) => {
    const entry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      timestamp: Date.now(),
      transform: { ...transform },
      description,
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), entry]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);
  
  const handleReset = useCallback(() => {
    setCurrentTransform({ ...originalTransform });
    addToHistory(originalTransform, 'Reset to original');
  }, [originalTransform, addToHistory]);
  
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setCurrentTransform({ ...history[historyIndex - 1].transform });
    }
  }, [history, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setCurrentTransform({ ...history[historyIndex + 1].transform });
    }
  }, [history, historyIndex]);
  
  const handleSave = useCallback(() => {
    console.log('Saving transform:', currentTransform);
    
    // Send message to parent window
    if (window.opener) {
      window.opener.postMessage({
        type: 'fusebox-save',
        transform: currentTransform,
        registrationId: fuseboxData?.registrationId,
      }, '*');
    }
    
    alert(`Registration saved!\n\nTranslation: (${currentTransform.translation.x}, ${currentTransform.translation.y}, ${currentTransform.translation.z}) mm\nRotation: (${currentTransform.rotation.x}, ${currentTransform.rotation.y}, ${currentTransform.rotation.z})°`);
  }, [currentTransform, fuseboxData]);
  
  // Auto registration handler
  const handleAutoRegister = useCallback((type: AutoRegistrationType) => {
    setIsAutoRegistering(true);
    setAutoRegType(type);
    
    setTimeout(() => {
      let newTransform = { ...currentTransform };
      
      if (type === 'rigid') {
        newTransform.translation = { x: -2.5, y: 1.8, z: -0.5 };
        newTransform.rotation = { x: 0, y: 0, z: 0.3 };
      } else if (type === 'contourBased') {
        newTransform.translation = { x: -1.2, y: 2.1, z: 0.3 };
        newTransform.rotation = { x: 0.1, y: -0.2, z: 0.5 };
      } else if (type === 'landmarkBased') {
        newTransform.translation = { x: -1.8, y: 1.5, z: 0 };
        newTransform.rotation = { x: 0, y: 0, z: 0.2 };
      }
      
      setCurrentTransform(newTransform);
      addToHistory(newTransform, `Auto ${type} registration`);
      setIsAutoRegistering(false);
      setAutoRegType(null);
    }, 2000);
  }, [currentTransform, addToHistory]);

  const updateTranslation = (axis: 'x' | 'y' | 'z', value: number) => {
    setCurrentTransform(prev => ({
      ...prev,
      translation: { ...prev.translation, [axis]: value },
    }));
  };

  // Drag handlers for translation
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (dragMode !== 'translate') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, [dragMode]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || dragMode !== 'translate') return;
    
    // Calculate delta in pixels
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Convert pixels to mm (approximate - assumes ~1 pixel per mm at default zoom)
    // This scaling factor can be adjusted based on actual pixel spacing and zoom level
    const scaleFactor = 0.5; // Adjust sensitivity
    
    setCurrentTransform(prev => ({
      ...prev,
      translation: {
        x: prev.translation.x + (deltaX * scaleFactor),
        y: prev.translation.y + (deltaY * scaleFactor),
        z: prev.translation.z,
      },
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, dragMode]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      // Add to history when drag ends
      if (currentTransform.translation.x !== 0 || currentTransform.translation.y !== 0) {
        addToHistory(currentTransform, 'Manual translation drag');
      }
    }
  }, [isDragging, currentTransform, addToHistory]);

  const updateRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    setCurrentTransform(prev => ({
      ...prev,
      rotation: { ...prev.rotation, [axis]: value },
    }));
  };
  
  // Set window title
  useEffect(() => {
    if (fuseboxData) {
      document.title = `FuseBox - ${fuseboxData.primaryModality} ↔ ${fuseboxData.secondaryModality}`;
    } else {
      document.title = 'FuseBox - Fusion Editor';
    }
  }, [fuseboxData]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) handleRedo();
            else handleUndo();
            e.preventDefault();
          }
          break;
        case 'Escape':
          window.close();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // No data state
  if (!hasValidData) {
    return (
      <div 
        className="h-screen w-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #0d1117 0%, #0a0e14 100%)' }}
      >
        <div className="text-center p-8 bg-[#0d1117]/80 rounded-2xl border border-white/10 backdrop-blur-xl">
          <CircuitBoard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Fusion Data</h2>
          <p className="text-gray-400 mb-4">
            FuseBox requires fusion data to be passed from the main viewer.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please open FuseBox from the viewer toolbar when a fusion is active.
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  const primaryColor = getModalityColor(fuseboxData.primaryModality);
  const secondaryColor = getModalityColor(fuseboxData.secondaryModality);

  return (
    <TooltipProvider delayDuration={150}>
      <div 
        className="h-screen w-screen p-3 flex flex-col overflow-hidden bg-black"
      >
        <div 
          className="flex-1 flex flex-col rounded-2xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(13, 17, 23, 0.98) 0%, rgba(10, 14, 20, 0.99) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-700/20">
              <CircuitBoard className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-100">FuseBox</span>
              <Badge 
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
              >
                Registration Editor
              </Badge>
            </div>
          </div>
          
          {/* Header actions */}
          <div className="flex items-center gap-1.5">
            {hasChanges && (
              <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-300 text-[10px] mr-1">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Unsaved
              </Badge>
            )}
            
            {isAutoRegistering && (
              <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-300 text-[10px] animate-pulse mr-1">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Registering...
              </Badge>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className={cn(
                    "h-7 px-2.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors",
                    historyIndex > 0 ? "text-gray-300 hover:bg-white/10 hover:text-gray-100" : "text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Undo2 className="w-3 h-3" />
                  Undo
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">⌘Z</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className={cn(
                    "h-7 px-2.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors",
                    historyIndex < history.length - 1 ? "text-gray-300 hover:bg-white/10 hover:text-gray-100" : "text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Redo2 className="w-3 h-3" />
                  Redo
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">⌘⇧Z</TooltipContent>
            </Tooltip>
            
            <div className="h-4 w-px bg-white/10" />
            
            <button
              onClick={() => window.close()}
              className="h-7 px-2.5 text-xs rounded-lg flex items-center gap-1.5 text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-3 h-3" />
              Close
            </button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Viewports Area */}
          <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
            {/* Viewport Toolbar */}
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Fusion status indicator */}
                {fusionManifestLoading && (
                  <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-300 text-[10px]">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Loading fusion...
                  </Badge>
                )}
                {fusionManifestError && (
                  <Badge className="bg-red-500/20 border-red-500/30 text-red-300 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {fusionManifestError}
                  </Badge>
                )}
                
                {/* Fusion + Link toggle group */}
                <div className="flex items-center gap-0.5 p-0.5 bg-[#0d1117]/80 border border-white/10 rounded-lg">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowFusion(!showFusion)}
                        disabled={fusionManifestLoading || !!fusionManifestError}
                        className={cn(
                          "px-2.5 py-1.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium",
                          fusionManifestLoading || fusionManifestError
                            ? "text-gray-600 cursor-not-allowed"
                            : showFusion 
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                              : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        {showFusion ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        Fusion
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle fusion overlay</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsLinked(!isLinked)}
                        className={cn(
                          "px-2.5 py-1.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium",
                          isLinked 
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        {isLinked ? <Link className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                        Link
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{isLinked ? 'Viewports linked' : 'Viewports unlinked'}</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDragMode(dragMode === 'translate' ? 'pan' : 'translate')}
                        className={cn(
                          "px-2.5 py-1.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium",
                          dragMode === 'translate' 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        <Move className="w-3 h-3" />
                        Translate
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {dragMode === 'translate' 
                        ? 'Drag fusion viewport to adjust translation (active)' 
                        : 'Click to enable drag-to-translate mode'}
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                {/* Opacity control */}
                {showFusion && (
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-[10px] text-gray-500">Opacity:</span>
                    <Slider
                      value={[fusionOpacity * 100]}
                      onValueChange={([v]) => setFusionOpacity(v / 100)}
                      min={0}
                      max={100}
                      step={5}
                      className="w-24"
                    />
                    <span className="text-[10px] text-purple-400 font-mono w-8">{Math.round(fusionOpacity * 100)}%</span>
                  </div>
                )}
              </div>
              
              {/* Quick opacity presets */}
              <div className="flex items-center gap-0.5 p-0.5 bg-[#0d1117]/80 border border-white/10 rounded-lg">
                {[0, 25, 50, 75, 100].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setFusionOpacity(preset / 100)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                      Math.round(fusionOpacity * 100) === preset
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
            
            {/* Viewport Grid - Axial on top (~70%), Coronal on bottom (~30%) */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* Top row - Axial views (70%) */}
              <div className="flex-[7] grid grid-cols-2 gap-3 min-h-0">
              {/* Primary viewport - Axial */}
              <div className="relative rounded-xl overflow-hidden border border-cyan-500/40 bg-[#0a0e14] flex flex-col shadow-lg shadow-cyan-500/5">
                <div className="absolute top-2 left-2 z-10">
                  <Badge className={cn(
                    "text-[10px] font-semibold",
                    primaryColor === 'cyan' ? 'bg-cyan-600/80 text-white border-cyan-400/50' :
                    primaryColor === 'purple' ? 'bg-purple-600/80 text-white border-purple-400/50' :
                    primaryColor === 'amber' ? 'bg-amber-600/80 text-white border-amber-400/50' :
                    'bg-gray-600/80 text-white border-gray-400/50'
                  )}>
                    {fuseboxData.primaryModality} • Axial
                  </Badge>
                </div>
                <div className="flex-1 min-h-0">
                  <WorkingViewer
                    seriesId={fuseboxData.primarySeriesId}
                    studyId={fuseboxData.studyId}
                    windowLevel={primaryWindowLevel}
                    onWindowLevelChange={setPrimaryWindowLevel}
                    imageCache={imageCache}
                    orientation="axial"
                    hideToolbar
                    hideSidebar
                    compactMode
                    externalSliceIndex={isLinked ? syncedSliceIndex : undefined}
                    onSliceIndexChange={isLinked ? setSyncedSliceIndex : undefined}
                    externalZoom={isLinked ? syncedZoom : undefined}
                    onZoomChange={isLinked ? setSyncedZoom : undefined}
                    externalPan={isLinked ? syncedPan : undefined}
                    onPanChange={isLinked ? (x, y) => setSyncedPan({ x, y }) : undefined}
                    externalCrosshair={crosshairPos}
                    onCrosshairChange={setCrosshairPos}
                    onImagesLoaded={(imgs) => {
                      console.log('[FuseBox] Primary axial images loaded:', imgs.length);
                      setPrimaryImages(imgs);
                    }}
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-0.5 pointer-events-none">
                  <span className="text-[9px] font-medium text-cyan-400">Primary</span>
                </div>
              </div>
              
              {/* Fusion viewport - Axial (with translation drag) */}
              <div 
                className={cn(
                  "relative rounded-xl overflow-hidden border border-purple-500/40 bg-[#0a0e14] flex flex-col shadow-lg shadow-purple-500/5",
                  dragMode === 'translate' && "cursor-move",
                  isDragging && "border-purple-400/60"
                )}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
              >
                {dragMode === 'translate' && (
                  <div className="absolute top-2 right-2 z-20">
                    <Badge className="bg-purple-500/30 border-purple-400/50 text-purple-200 text-[9px]">
                      <Move className="w-3 h-3 mr-1" />
                      Drag to translate
                    </Badge>
                  </div>
                )}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                  <Badge className={cn(
                    "text-[10px] font-semibold",
                    primaryColor === 'cyan' ? 'bg-cyan-600/80 text-white border-cyan-400/50' :
                    primaryColor === 'purple' ? 'bg-purple-600/80 text-white border-purple-400/50' :
                    primaryColor === 'amber' ? 'bg-amber-600/80 text-white border-amber-400/50' :
                    'bg-gray-600/80 text-white border-gray-400/50'
                  )}>
                    Axial
                  </Badge>
                  {showFusion && (
                    <>
                      <span className="text-gray-500">+</span>
                      <Badge className={cn(
                        "text-[10px] font-semibold",
                        secondaryColor === 'cyan' ? 'bg-cyan-600/80 text-white border-cyan-400/50' :
                        secondaryColor === 'purple' ? 'bg-purple-600/80 text-white border-purple-400/50' :
                        secondaryColor === 'amber' ? 'bg-amber-600/80 text-white border-amber-400/50' :
                        'bg-gray-600/80 text-white border-gray-400/50'
                      )}>
                        {fuseboxData.secondaryModality} ({Math.round(fusionOpacity * 100)}%)
                      </Badge>
                    </>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <WorkingViewer
                    seriesId={fuseboxData.primarySeriesId}
                    studyId={fuseboxData.studyId}
                    windowLevel={primaryWindowLevel}
                    onWindowLevelChange={setPrimaryWindowLevel}
                    imageCache={imageCache}
                    orientation="axial"
                    hideToolbar
                    hideSidebar
                    compactMode
                    secondarySeriesId={showFusion && !fusionManifestLoading && !fusionManifestError ? fuseboxData.secondarySeriesId : null}
                    fusionOpacity={fusionOpacity}
                    fusionDisplayMode="overlay"
                    hasSecondarySeriesForFusion={showFusion && !fusionManifestLoading && !fusionManifestError}
                    fusionWindowLevel={secondaryWindowLevel}
                    fusionSecondaryStatuses={fusionSecondaryStatuses}
                    fusionManifestLoading={fusionManifestLoading}
                    fusionManifestPrimarySeriesId={fuseboxData.primarySeriesId}
                    fusionTranslation={currentTransform.translation}
                    externalSliceIndex={isLinked ? syncedSliceIndex : undefined}
                    onSliceIndexChange={isLinked ? setSyncedSliceIndex : undefined}
                    externalZoom={isLinked ? syncedZoom : undefined}
                    onZoomChange={isLinked ? setSyncedZoom : undefined}
                    externalPan={isLinked ? syncedPan : undefined}
                    onPanChange={isLinked ? (x, y) => setSyncedPan({ x, y }) : undefined}
                    externalCrosshair={crosshairPos}
                    onCrosshairChange={setCrosshairPos}
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-0.5 pointer-events-none">
                  <span className="text-[9px] font-medium text-purple-400">Fusion</span>
                </div>
              </div>
              </div>
              
              {/* Bottom row - MPR views for each side (30%) */}
              <div className="flex-[3] grid grid-cols-2 gap-3 min-h-0">
                {/* Primary side MPR: Coronal + Sagittal */}
                <div className="grid grid-cols-2 gap-1.5 min-h-0">
                  {/* Primary Coronal */}
                  <div className="relative rounded-lg overflow-hidden border border-cyan-500/30 bg-[#0a0e14] flex flex-col">
                    <div className="absolute top-1 left-1 z-10">
                      <Badge className="bg-cyan-600/80 text-white border-cyan-400/50 text-[8px] font-semibold px-1.5 py-0">
                        Coronal
                      </Badge>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      {primaryImages.length > 0 ? (
                        <MPRFloating
                          key={`primary-coronal-${mprCacheVersion}`}
                          images={primaryImages}
                          orientation="coronal"
                          sliceIndex={Math.max(0, Math.min(coronalSliceIndex, (primaryImages[0]?.rows || 512) - 1))}
                          windowWidth={primaryWindowLevel.window}
                          windowCenter={primaryWindowLevel.level}
                          crosshairPos={crosshairPos}
                          currentZIndex={syncedSliceIndex}
                          onClick={(e) => {
                            // Convert click to crosshair update
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = Math.floor((e.clientX - rect.left) / rect.width * (primaryImages[0]?.columns || 512));
                            setCrosshairPos(prev => ({ ...prev, x }));
                          }}
                        />
                      ) : (
                        <div className="text-gray-500 text-xs">Loading MPR...</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Primary Sagittal */}
                  <div className="relative rounded-lg overflow-hidden border border-cyan-500/30 bg-[#0a0e14] flex flex-col">
                    <div className="absolute top-1 left-1 z-10">
                      <Badge className="bg-cyan-600/80 text-white border-cyan-400/50 text-[8px] font-semibold px-1.5 py-0">
                        Sagittal
                      </Badge>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      {primaryImages.length > 0 ? (
                        <MPRFloating
                          key={`primary-sagittal-${mprCacheVersion}`}
                          images={primaryImages}
                          orientation="sagittal"
                          sliceIndex={Math.max(0, Math.min(sagittalSliceIndex, (primaryImages[0]?.columns || 512) - 1))}
                          windowWidth={primaryWindowLevel.window}
                          windowCenter={primaryWindowLevel.level}
                          crosshairPos={crosshairPos}
                          currentZIndex={syncedSliceIndex}
                          onClick={(e) => {
                            // Convert click to crosshair update
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = Math.floor((e.clientX - rect.left) / rect.width * (primaryImages[0]?.rows || 512));
                            setCrosshairPos(prev => ({ ...prev, y }));
                          }}
                        />
                      ) : (
                        <div className="text-gray-500 text-xs">Loading MPR...</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Fusion side MPR: Coronal + Sagittal */}
                <div className="grid grid-cols-2 gap-1.5 min-h-0">
                  {/* Fusion Coronal */}
                  <div className="relative rounded-lg overflow-hidden border border-purple-500/30 bg-[#0a0e14] flex flex-col">
                    <div className="absolute top-1 left-1 z-10">
                      <Badge className="bg-purple-600/80 text-white border-purple-400/50 text-[8px] font-semibold px-1.5 py-0">
                        Coronal
                      </Badge>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      {primaryImages.length > 0 ? (
                        <MPRFloating
                          key={`fusion-coronal-${mprCacheVersion}`}
                          images={primaryImages}
                          orientation="coronal"
                          sliceIndex={Math.max(0, Math.min(coronalSliceIndex, (primaryImages[0]?.rows || 512) - 1))}
                          windowWidth={primaryWindowLevel.window}
                          windowCenter={primaryWindowLevel.level}
                          crosshairPos={crosshairPos}
                          currentZIndex={syncedSliceIndex}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = Math.floor((e.clientX - rect.left) / rect.width * (primaryImages[0]?.columns || 512));
                            setCrosshairPos(prev => ({ ...prev, x }));
                          }}
                        />
                      ) : (
                        <div className="text-gray-500 text-xs">Loading MPR...</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Fusion Sagittal */}
                  <div className="relative rounded-lg overflow-hidden border border-purple-500/30 bg-[#0a0e14] flex flex-col">
                    <div className="absolute top-1 left-1 z-10">
                      <Badge className="bg-purple-600/80 text-white border-purple-400/50 text-[8px] font-semibold px-1.5 py-0">
                        Sagittal
                      </Badge>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      {primaryImages.length > 0 ? (
                        <MPRFloating
                          key={`fusion-sagittal-${mprCacheVersion}`}
                          images={primaryImages}
                          orientation="sagittal"
                          sliceIndex={Math.max(0, Math.min(sagittalSliceIndex, (primaryImages[0]?.columns || 512) - 1))}
                          windowWidth={primaryWindowLevel.window}
                          windowCenter={primaryWindowLevel.level}
                          crosshairPos={crosshairPos}
                          currentZIndex={syncedSliceIndex}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = Math.floor((e.clientX - rect.left) / rect.width * (primaryImages[0]?.rows || 512));
                            setCrosshairPos(prev => ({ ...prev, y }));
                          }}
                        />
                      ) : (
                        <div className="text-gray-500 text-xs">Loading MPR...</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Control Panel */}
          <div className="w-72 border-l border-white/5 flex flex-col shrink-0">
            {/* Panel Tabs - styled like DVH toggle buttons */}
            <div className="p-3 pb-0 flex-shrink-0">
              <div className="flex items-center gap-0.5 p-0.5 bg-[#0d1117]/80 border border-white/10 rounded-lg">
                {[
                  { id: 'controls', label: 'Controls', icon: <SunMedium className="w-3 h-3" /> },
                  { id: 'transform', label: 'Transform', icon: <Move className="w-3 h-3" /> },
                  { id: 'autoReg', label: 'Auto Reg', icon: <Wand2 className="w-3 h-3" /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActivePanel(tab.id as any)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all",
                      activePanel === tab.id
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {/* Controls Panel */}
              {activePanel === 'controls' && (
                <div className="space-y-4">
                  {/* Fusion Info */}
                  <div className="rounded-xl bg-[#0d1117]/80 border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-gray-200">Fusion Info</span>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Primary:</span>
                        <span className="text-cyan-400">{fuseboxData.primaryModality}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Secondary:</span>
                        <span className="text-purple-400">{fuseboxData.secondaryModality}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Opacity:</span>
                        <span className="text-white">{Math.round(fusionOpacity * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Opacity Slider */}
                  <div className="rounded-xl bg-[#0d1117]/80 border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Layers3 className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold text-gray-200">Fusion Opacity</span>
                    </div>
                    <Slider
                      value={[fusionOpacity * 100]}
                      onValueChange={([v]) => setFusionOpacity(v / 100)}
                      min={0}
                      max={100}
                      step={1}
                      className="my-2"
                    />
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Primary only</span>
                      <span className="text-purple-400 font-mono">{Math.round(fusionOpacity * 100)}%</span>
                      <span className="text-gray-500">Secondary only</span>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="rounded-xl bg-[#0d1117]/80 border border-white/10 p-3 space-y-2">
                    <div className="text-xs font-semibold text-gray-200 mb-2">Quick Actions</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setFusionOpacity(0)}
                        className="px-2 py-1.5 rounded-lg text-[10px] bg-[#0d1117]/80 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                      >
                        Primary Only
                      </button>
                      <button
                        onClick={() => setFusionOpacity(1)}
                        className="px-2 py-1.5 rounded-lg text-[10px] bg-[#0d1117]/80 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                      >
                        Secondary Only
                      </button>
                      <button
                        onClick={() => setFusionOpacity(0.5)}
                        className="px-2 py-1.5 rounded-lg text-[10px] bg-[#0d1117]/80 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                      >
                        50/50 Blend
                      </button>
                      <button
                        onClick={() => setShowFusion(!showFusion)}
                        className="px-2 py-1.5 rounded-lg text-[10px] bg-[#0d1117]/80 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                      >
                        {showFusion ? 'Hide Fusion' : 'Show Fusion'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Transform Panel */}
              {activePanel === 'transform' && (
                <div className="space-y-3">
                  <div className="text-[10px] text-gray-500 mb-2">
                    Manual registration adjustments (coming soon)
                  </div>
                  
                  {/* Translation */}
                  <div className="rounded-xl bg-[#0d1117]/80 border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Move className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-gray-200">Translation (mm)</span>
                    </div>
                    <div className="space-y-1.5">
                      <NumericInput value={currentTransform.translation.x} onChange={(v) => updateTranslation('x', v)} label="X" color="red" />
                      <NumericInput value={currentTransform.translation.y} onChange={(v) => updateTranslation('y', v)} label="Y" color="green" />
                      <NumericInput value={currentTransform.translation.z} onChange={(v) => updateTranslation('z', v)} label="Z" color="blue" />
                    </div>
                    
                    {/* Quick nudge */}
                    <div className="flex items-center justify-center gap-1 pt-2">
                      <div className="grid grid-cols-3 gap-0.5">
                        <div />
                        <button onClick={() => updateTranslation('y', currentTransform.translation.y - 1)} className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-green-400 border border-white/5">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <div />
                        <button onClick={() => updateTranslation('x', currentTransform.translation.x - 1)} className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-red-400 border border-white/5">
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button onClick={() => { updateTranslation('x', 0); updateTranslation('y', 0); updateTranslation('z', 0); }} className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 border border-white/5">
                          <Target className="w-2.5 h-2.5" />
                        </button>
                        <button onClick={() => updateTranslation('x', currentTransform.translation.x + 1)} className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-red-400 border border-white/5">
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <div />
                        <button onClick={() => updateTranslation('y', currentTransform.translation.y + 1)} className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-green-400 border border-white/5">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <div />
                      </div>
                      <div className="flex flex-col gap-0.5 ml-2">
                        <button onClick={() => updateTranslation('z', currentTransform.translation.z + 1)} className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-blue-400 text-[8px] font-bold border border-white/5">+Z</button>
                        <button onClick={() => updateTranslation('z', currentTransform.translation.z - 1)} className="w-5 h-5 flex items-center justify-center rounded-md bg-[#0d1117]/80 hover:bg-white/10 text-gray-400 hover:text-blue-400 text-[8px] font-bold border border-white/5">-Z</button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Rotation */}
                  <div className="rounded-xl bg-[#0d1117]/80 border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <RotateCw className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold text-gray-200">Rotation (°)</span>
                    </div>
                    <div className="space-y-1.5">
                      <NumericInput value={currentTransform.rotation.x} onChange={(v) => updateRotation('x', v)} label="X" unit="°" color="red" min={-180} max={180} />
                      <NumericInput value={currentTransform.rotation.y} onChange={(v) => updateRotation('y', v)} label="Y" unit="°" color="green" min={-180} max={180} />
                      <NumericInput value={currentTransform.rotation.z} onChange={(v) => updateRotation('z', v)} label="Z" unit="°" color="blue" min={-180} max={180} />
                    </div>
                  </div>
                  
                  <div className="text-[9px] text-amber-400/70 flex items-center gap-1 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <AlertTriangle className="w-3 h-3" />
                    Transform values do not yet apply to actual registration
                  </div>
                </div>
              )}
              
              {/* Auto Registration Panel */}
              {activePanel === 'autoReg' && (
                <div className="space-y-3">
                  <div className="text-[10px] text-gray-500 mb-2">
                    Automatic registration methods (placeholders)
                  </div>
                  
                  <AutoRegButton
                    onClick={() => handleAutoRegister('rigid')}
                    icon={<Cpu className="w-4 h-4" />}
                    label="Automatic Rigid Registration"
                    description="Mutual information-based alignment"
                    isRunning={isAutoRegistering && autoRegType === 'rigid'}
                    disabled={isAutoRegistering}
                  />
                  
                  <AutoRegButton
                    onClick={() => handleAutoRegister('contourBased')}
                    icon={<Layers3 className="w-4 h-4" />}
                    label="Contour-Based Registration"
                    description="Align using structure contours"
                    isRunning={isAutoRegistering && autoRegType === 'contourBased'}
                    disabled={isAutoRegistering}
                  />
                  
                  <AutoRegButton
                    onClick={() => handleAutoRegister('landmarkBased')}
                    icon={<Target className="w-4 h-4" />}
                    label="Landmark-Based Registration"
                    description="Align using anatomical landmarks"
                    isRunning={isAutoRegistering && autoRegType === 'landmarkBased'}
                    disabled={isAutoRegistering}
                  />
                  
                  <AutoRegButton
                    onClick={() => handleAutoRegister('intensityBased')}
                    icon={<Scan className="w-4 h-4" />}
                    label="Intensity-Based Registration"
                    description="Pixel value correlation matching"
                    isRunning={isAutoRegistering && autoRegType === 'intensityBased'}
                    disabled={isAutoRegistering}
                  />
                  
                  <div className="text-[9px] text-amber-400/70 flex items-center gap-1 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 mt-4">
                    <AlertTriangle className="w-3 h-3" />
                    Auto-registration currently applies mock transforms only
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="p-3 border-t border-white/5 space-y-2 shrink-0">
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={cn(
                  "w-full h-9 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition-all",
                  hasChanges
                    ? "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-[#0d1117]/80 text-gray-500 cursor-not-allowed border border-white/5"
                )}
              >
                <Save className="w-4 h-4" />
                Save Registration
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={!hasChanges}
                  className={cn(
                    "flex-1 h-8 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors border",
                    hasChanges ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20" : "bg-[#0d1117]/80 border-white/5 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  onClick={() => window.close()}
                  className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors border bg-[#0d1117]/80 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-1.5 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-500 shrink-0">
          <div className="flex gap-3">
            <span><kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">⌘Z</kbd> Undo</span>
            <span><kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">Esc</kbd> Close</span>
          </div>
          <div className="text-gray-600">Superbeam FuseBox v1.0</div>
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Wrap with QueryClientProvider since this is a standalone page
export default function FuseBox() {
  return (
    <QueryClientProvider client={queryClient}>
      <FuseBoxContent />
    </QueryClientProvider>
  );
}
