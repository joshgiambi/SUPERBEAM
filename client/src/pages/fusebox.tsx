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
  Box,
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
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={formatNumber(value)}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))}
        step={step}
        className={cn(
          "h-6 w-14 px-1.5 rounded bg-gray-900/60 border text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-offset-0",
          colorClasses
        )}
      />
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
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
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full",
        isRunning
          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
          : disabled
          ? "bg-gray-800/30 border-gray-700/30 text-gray-600 cursor-not-allowed"
          : "bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-purple-500/30 text-purple-300 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10"
      )}
    >
      {isRunning ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        icon
      )}
      <div className="flex-1 text-left">
        <div className="text-xs font-semibold">{label}</div>
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
  
  // Image cache ref for WorkingViewer
  const imageCache = useRef(new Map());
  
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
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-900/50 rounded-2xl border border-gray-700/50">
          <Box className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Fusion Data</h2>
          <p className="text-gray-400 mb-4">
            FuseBox requires fusion data to be passed from the main viewer.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please open FuseBox from the viewer toolbar when a fusion is active.
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
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
      <div className="h-screen w-screen bg-gray-950 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 bg-gradient-to-r from-gray-900/80 to-gray-800/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30">
              <Box className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                FuseBox
                <Badge className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-cyan-500/30 text-cyan-300 text-[9px]">
                  Registration Editor
                </Badge>
              </h1>
              <p className="text-[10px] text-gray-400">
                {fuseboxData.primaryModality} ({fuseboxData.primaryDescription}) → {fuseboxData.secondaryModality} ({fuseboxData.secondaryDescription})
              </p>
            </div>
          </div>
          
          {/* Header actions */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
                    historyIndex > 0 ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Undo (⌘Z)</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
                    historyIndex < history.length - 1 ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>
            
            <div className="w-px h-5 bg-gray-700" />
            
            {hasChanges && (
              <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-300 text-[10px]">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Unsaved
              </Badge>
            )}
            
            {isAutoRegistering && (
              <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-300 text-[10px] animate-pulse">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Registering...
              </Badge>
            )}
            
            <div className="w-px h-5 bg-gray-700" />
            
            <button
              onClick={() => window.close()}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Viewports Area */}
          <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
            {/* Viewport Toolbar */}
            <div className="flex items-center justify-between px-2 shrink-0">
              <div className="flex items-center gap-2">
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
                
                {/* Fusion toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowFusion(!showFusion)}
                      disabled={fusionManifestLoading || !!fusionManifestError}
                      className={cn(
                        "h-8 px-3 flex items-center gap-2 rounded-lg transition-colors text-xs font-medium",
                        fusionManifestLoading || fusionManifestError
                          ? "text-gray-600 cursor-not-allowed"
                          : showFusion 
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" 
                            : "text-gray-400 hover:bg-white/10"
                      )}
                    >
                      {showFusion ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Fusion
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle fusion overlay</TooltipContent>
                </Tooltip>
                
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
                
                <div className="w-px h-5 bg-gray-700/50" />
                
                {/* Link toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsLinked(!isLinked)}
                      className={cn(
                        "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                        isLinked ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "text-gray-400 hover:bg-white/10"
                      )}
                    >
                      {isLinked ? <Link className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isLinked ? 'Viewports linked' : 'Viewports unlinked'}</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Quick opacity presets */}
              <div className="flex items-center gap-1">
                {[0, 25, 50, 75, 100].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setFusionOpacity(preset / 100)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                      Math.round(fusionOpacity * 100) === preset
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
            
            {/* Side-by-side viewports */}
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
              {/* Primary viewport (no fusion) */}
              <div className="relative rounded-xl overflow-hidden border-2 border-cyan-500/30 bg-black flex flex-col">
                <div className="absolute top-2 left-2 z-10">
                  <Badge className={cn(
                    "text-[10px] font-semibold",
                    primaryColor === 'cyan' ? 'bg-cyan-600/80 text-white border-cyan-400/50' :
                    primaryColor === 'purple' ? 'bg-purple-600/80 text-white border-purple-400/50' :
                    primaryColor === 'amber' ? 'bg-amber-600/80 text-white border-amber-400/50' :
                    'bg-gray-600/80 text-white border-gray-400/50'
                  )}>
                    {fuseboxData.primaryModality} • Primary
                  </Badge>
                </div>
                <div className="flex-1 min-h-0">
                  <WorkingViewer
                    seriesId={fuseboxData.primarySeriesId}
                    studyId={fuseboxData.studyId}
                    windowLevel={primaryWindowLevel}
                    onWindowLevelChange={setPrimaryWindowLevel}
                    imageCache={imageCache}
                    hideToolbar
                    hideSidebar
                    compactMode
                    externalSliceIndex={isLinked ? syncedSliceIndex : undefined}
                    onSliceIndexChange={isLinked ? setSyncedSliceIndex : undefined}
                    externalZoom={isLinked ? syncedZoom : undefined}
                    onZoomChange={isLinked ? setSyncedZoom : undefined}
                    externalPan={isLinked ? syncedPan : undefined}
                    onPanChange={isLinked ? (x, y) => setSyncedPan({ x, y }) : undefined}
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1 pointer-events-none">
                  <span className="text-[9px] font-medium text-cyan-400">Primary (Reference)</span>
                </div>
              </div>
              
              {/* Secondary viewport with fusion overlay */}
              <div className="relative rounded-xl overflow-hidden border-2 border-purple-500/30 bg-black flex flex-col">
                <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                  <Badge className={cn(
                    "text-[10px] font-semibold",
                    primaryColor === 'cyan' ? 'bg-cyan-600/80 text-white border-cyan-400/50' :
                    primaryColor === 'purple' ? 'bg-purple-600/80 text-white border-purple-400/50' :
                    primaryColor === 'amber' ? 'bg-amber-600/80 text-white border-amber-400/50' :
                    'bg-gray-600/80 text-white border-gray-400/50'
                  )}>
                    {fuseboxData.primaryModality}
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
                    hideToolbar
                    hideSidebar
                    compactMode
                    // Fusion props - only enable when fusion manifest is ready
                    secondarySeriesId={showFusion && !fusionManifestLoading && !fusionManifestError ? fuseboxData.secondarySeriesId : null}
                    fusionOpacity={fusionOpacity}
                    fusionDisplayMode="overlay"
                    hasSecondarySeriesForFusion={showFusion && !fusionManifestLoading && !fusionManifestError}
                    fusionWindowLevel={secondaryWindowLevel}
                    // Fusion manifest status props - required for fusion rendering
                    fusionSecondaryStatuses={fusionSecondaryStatuses}
                    fusionManifestLoading={fusionManifestLoading}
                    fusionManifestPrimarySeriesId={fuseboxData.primarySeriesId}
                    // Sync props
                    externalSliceIndex={isLinked ? syncedSliceIndex : undefined}
                    onSliceIndexChange={isLinked ? setSyncedSliceIndex : undefined}
                    externalZoom={isLinked ? syncedZoom : undefined}
                    onZoomChange={isLinked ? setSyncedZoom : undefined}
                    externalPan={isLinked ? syncedPan : undefined}
                    onPanChange={isLinked ? (x, y) => setSyncedPan({ x, y }) : undefined}
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1 pointer-events-none">
                  <span className="text-[9px] font-medium text-purple-400">With Fusion Overlay</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Control Panel */}
          <div className="w-72 border-l border-gray-800/50 bg-gray-900/30 flex flex-col shrink-0">
            {/* Panel Tabs */}
            <div className="flex border-b border-gray-800/50 shrink-0">
              {[
                { id: 'controls', label: 'Controls', icon: <SunMedium className="w-3.5 h-3.5" /> },
                { id: 'transform', label: 'Transform', icon: <Move className="w-3.5 h-3.5" /> },
                { id: 'autoReg', label: 'Auto Reg', icon: <Wand2 className="w-3.5 h-3.5" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActivePanel(tab.id as any)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors border-b-2",
                    activePanel === tab.id
                      ? "text-cyan-400 border-cyan-400 bg-cyan-500/5"
                      : "text-gray-500 border-transparent hover:text-gray-300"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {/* Controls Panel */}
              {activePanel === 'controls' && (
                <div className="space-y-4">
                  {/* Fusion Info */}
                  <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
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
                  <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
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
                  <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
                    <div className="text-xs font-semibold text-gray-200 mb-2">Quick Actions</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setFusionOpacity(0)}
                        className="px-2 py-1.5 rounded text-[10px] bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border border-gray-700/50 transition-colors"
                      >
                        Primary Only
                      </button>
                      <button
                        onClick={() => setFusionOpacity(1)}
                        className="px-2 py-1.5 rounded text-[10px] bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border border-gray-700/50 transition-colors"
                      >
                        Secondary Only
                      </button>
                      <button
                        onClick={() => setFusionOpacity(0.5)}
                        className="px-2 py-1.5 rounded text-[10px] bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border border-gray-700/50 transition-colors"
                      >
                        50/50 Blend
                      </button>
                      <button
                        onClick={() => setShowFusion(!showFusion)}
                        className="px-2 py-1.5 rounded text-[10px] bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border border-gray-700/50 transition-colors"
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
                  <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
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
                        <button onClick={() => updateTranslation('y', currentTransform.translation.y - 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-green-400">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <div />
                        <button onClick={() => updateTranslation('x', currentTransform.translation.x - 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-red-400">
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button onClick={() => { updateTranslation('x', 0); updateTranslation('y', 0); updateTranslation('z', 0); }} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-cyan-700/60 text-gray-400 hover:text-cyan-400">
                          <Target className="w-2.5 h-2.5" />
                        </button>
                        <button onClick={() => updateTranslation('x', currentTransform.translation.x + 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-red-400">
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <div />
                        <button onClick={() => updateTranslation('y', currentTransform.translation.y + 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-green-400">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <div />
                      </div>
                      <div className="flex flex-col gap-0.5 ml-2">
                        <button onClick={() => updateTranslation('z', currentTransform.translation.z + 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-blue-400 text-[8px] font-bold">+Z</button>
                        <button onClick={() => updateTranslation('z', currentTransform.translation.z - 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-blue-400 text-[8px] font-bold">-Z</button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Rotation */}
                  <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
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
                  
                  <div className="text-[9px] text-amber-400/70 flex items-center gap-1 p-2 bg-amber-500/10 rounded border border-amber-500/20">
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
                  
                  <div className="text-[9px] text-amber-400/70 flex items-center gap-1 p-2 bg-amber-500/10 rounded border border-amber-500/20 mt-4">
                    <AlertTriangle className="w-3 h-3" />
                    Auto-registration currently applies mock transforms only
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="p-3 border-t border-gray-800/50 space-y-2 shrink-0">
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={cn(
                  "w-full h-9 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all",
                  hasChanges
                    ? "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-gray-800/50 text-gray-500 cursor-not-allowed"
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
                    hasChanges ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20" : "bg-gray-800/30 border-gray-700/50 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  onClick={() => window.close()}
                  className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors border bg-gray-800/30 border-gray-700/50 text-gray-400 hover:bg-gray-700/50 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-1.5 border-t border-gray-800/50 bg-gray-900/30 flex items-center justify-between text-[9px] text-gray-500 shrink-0">
          <div className="flex gap-3">
            <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘Z</kbd> Undo</span>
            <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> Close</span>
          </div>
          <div className="text-gray-600">Superbeam FuseBox v1.0</div>
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
