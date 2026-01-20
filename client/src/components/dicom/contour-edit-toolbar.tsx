/**
 * Contour Edit Toolbar - V4 Aurora Edition
 * 
 * Clean two-row design with inline tool settings:
 * - Row 1: Structure info + Tools + Inline Settings
 * - Row 2: Quick action buttons (undo/redo, delete, interpolate, etc.)
 * - Draggable with position memory
 * - Adaptive color theming based on structure color
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Brush,
  Pen,
  Scissors,
  X,
  Check,
  Trash2,
  Undo,
  Redo,
  GitBranch,
  Grid3x3,
  Eraser,
  ChevronDown,
  Sparkles,
  Zap,
  SplitSquareHorizontal,
  GripVertical,
  RotateCcw,
  MousePointer2,
  MousePointerClick,
  Layers,
  Eye,
  EyeOff,
  Split,
  Circle,
  Loader2
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { undoRedoManager } from '@/lib/undo-system';
import { log } from '@/lib/log';
import { useToast } from '@/hooks/use-toast';
import { samServerClient } from '@/lib/sam-server-client';
import { SmartNthSettingsDialog } from './smart-nth-settings-dialog';
// Prediction tuning panel removed: GEO prediction is now deterministic world-space propagation.

// ============================================================================
// HELPERS
// ============================================================================

interface Position { x: number; y: number; }

const rgbToHex = (rgb: number[]) => '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');
const hexToRgb = (hex: string): number[] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255, 255, 255];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};

const STORAGE_KEY = 'contour-toolbar-v4-position';
const getStoredPosition = (): Position | null => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
};
const savePosition = (pos: Position) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch {}
};

// ============================================================================
// DRAGGABLE HOOK
// ============================================================================

function useDraggable(initialPosition: Position, onPositionChange?: (pos: Position) => void) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);  // Ref for immediate access
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const positionRef = useRef(position);
  
  // Keep refs in sync with state
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Global mousemove handler
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !dragStart.current) return;
    const newPos = {
      x: dragStart.current.posX + (e.clientX - dragStart.current.x),
      y: dragStart.current.posY + (e.clientY - dragStart.current.y),
    };
    positionRef.current = newPos;
    setPosition(newPos);
  }, []);

  // Global mouseup handler - ALWAYS stops dragging
  const handleGlobalMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      setIsDragging(false);
      isDraggingRef.current = false;
      if (dragStart.current) {
        savePosition(positionRef.current);
        onPositionChange?.(positionRef.current);
      }
      dragStart.current = null;
    }
  }, [onPositionChange]);

  // Mount global listeners ONCE and keep them active
  useEffect(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    document.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
    document.addEventListener('pointerup', handleGlobalMouseUp, { capture: true });
    window.addEventListener('blur', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
      document.removeEventListener('pointerup', handleGlobalMouseUp, { capture: true });
      window.removeEventListener('blur', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      e.preventDefault();
      e.stopPropagation();
      dragStart.current = { x: e.clientX, y: e.clientY, posX: positionRef.current.x, posY: positionRef.current.y };
      setIsDragging(true);
      isDraggingRef.current = true;
    }
  }, []);

  const resetPosition = useCallback(() => {
    const newPos = { x: 0, y: 0 };
    setPosition(newPos);
    positionRef.current = newPos;
    savePosition(newPos);
  }, []);

  return { position, isDragging, handleMouseDown, resetPosition };
}

// ============================================================================
// PROPS
// ============================================================================

interface ContourEditToolbarProps {
  selectedStructure: {
    structureName: string;
    color: number[];
    roiNumber: number;
  } | null;
  isVisible: boolean;
  onClose: () => void;
  onStructureNameChange: (name: string) => void;
  onStructureColorChange: (color: string) => void;
  onToolChange?: (toolState: {
    tool: string | null;
    brushSize: number;
    isActive: boolean;
    predictionEnabled?: boolean;
    smartBrushEnabled?: boolean;
    predictionMode?: 'geometric' | 'nitro' | 'sam';
    aiTumorSmoothOutput?: boolean;
    aiTumorUseSAM?: boolean;
    aiTumor3DMode?: boolean;
  }) => void;
  currentSlicePosition?: number;
  onContourUpdate?: (updatedStructures: any) => void;
  onAutoZoomSettingsChange?: (settings: {
    autoZoomEnabled: boolean;
    autoLocalizeEnabled: boolean;
    zoomFillFactor: number;
  }) => void;
  availableStructures?: Array<{
    roiNumber: number;
    structureName: string;
    color: number[];
  }>;
  onTargetStructureSelect?: (structureId: number | null) => void;
  seriesId?: number;
  imageMetadata?: any;
  onOpenBooleanOperations?: () => void;
  onOpenAdvancedMarginTool?: () => void;
  activePredictions?: Map<number, any>;
  propagationMode?: 'conservative' | 'moderate' | 'aggressive';
  onPropagationModeChange?: (mode: 'conservative' | 'moderate' | 'aggressive') => void;
  workingViewerRef?: React.RefObject<any>;
  // Positioning prop for viewport centering (accounts for sidebar)
  viewerOffsetLeft?: number;
}

// ============================================================================
// MAIN TOOLBAR
// ============================================================================

export function ContourEditToolbar({ 
  selectedStructure, 
  isVisible, 
  onClose,
  onStructureNameChange,
  onStructureColorChange,
  onToolChange,
  currentSlicePosition,
  onContourUpdate,
  availableStructures = [],
  onTargetStructureSelect,
  seriesId,
  imageMetadata,
  onOpenBooleanOperations,
  onOpenAdvancedMarginTool,
  activePredictions,
  propagationMode = 'moderate',
  onPropagationModeChange,
  workingViewerRef,
  viewerOffsetLeft = 0,
}: ContourEditToolbarProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(selectedStructure?.structureName || '');
  const [brushThickness, setBrushThickness] = useState([9]);
  const [smartBrush, setSmartBrush] = useState(false);
  const [isPredictionEnabled, setIsPredictionEnabled] = useState(false);
  const [predictionMode, setPredictionMode] = useState<'geometric' | 'nitro' | 'sam'>('sam'); // Always SAM
  const [samLoading, setSamLoading] = useState(false);
  const [aiTumorSmoothOutput, setAiTumorSmoothOutput] = useState(false);
  const [aiTumor3DMode, setAiTumor3DMode] = useState(false);
  const [samServerStatus, setSamServerStatus] = useState<'unknown' | 'healthy' | 'unavailable' | 'starting'>('unknown');
  // Always use SAM (browser-based, universal) - SuperSeg 3D removed as it only works on brain MRI FLAIR
  const aiTumorUseSAM = true;

  // Check SAM server health when interactive-tumor tool is activated
  useEffect(() => {
    if (activeTool === 'interactive-tumor') {
      setSamServerStatus('unknown');
      samServerClient.checkHealth()
        .then(() => setSamServerStatus('healthy'))
        .catch(() => setSamServerStatus('unavailable'));
    }
  }, [activeTool]);

  // Track shift key for multi-point SAM mode hint
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  useEffect(() => {
    if (activeTool !== 'interactive-tumor') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool]);

  const handleStartSamServer = async () => {
    setSamServerStatus('starting');
    toast({
      title: 'Starting SAM Server',
      description: 'This may take up to 60 seconds...',
    });
    try {
      const result = await samServerClient.startServer();
      if (result.status === 'started' || result.status === 'already_running') {
        setSamServerStatus('healthy');
        toast({
          title: 'SAM Server Ready',
          description: result.message,
        });
      } else if (result.status === 'starting') {
        // Still starting, keep polling
        setTimeout(async () => {
          try {
            await samServerClient.checkHealth();
            setSamServerStatus('healthy');
            toast({ title: 'SAM Server Ready' });
          } catch {
            setSamServerStatus('unavailable');
          }
        }, 5000);
      } else {
        setSamServerStatus('unavailable');
        toast({
          title: 'Server Start Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      setSamServerStatus('unavailable');
      toast({
        title: 'Server Start Failed',
        description: e.message,
        variant: 'destructive',
      });
    }
  };
  const [hideOtherContours, setHideOtherContours] = useState(false);
  
  // Dissect tool state
  const [dissectLineCount, setDissectLineCount] = useState(1); // 1 or 2 lines
  const [dissectPoints, setDissectPoints] = useState<Array<{x: number, y: number}>>([]);
  
  // SmartNth dialog
  const [showSmartNthDialog, setShowSmartNthDialog] = useState(false);
  const [totalSlicesForSmartNth, setTotalSlicesForSmartNth] = useState(0);

  // Position for dragging
  const defaultPos = useMemo(() => getStoredPosition() || { x: 0, y: 0 }, []);
  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable(defaultPos);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Sync temp name when structure changes
  useEffect(() => {
    setTempName(selectedStructure?.structureName || '');
  }, [selectedStructure?.structureName]);

  // Color computations
  const accentHex = useMemo(() => selectedStructure ? rgbToHex(selectedStructure.color) : '#ffffff', [selectedStructure]);
  const accentRgb = useMemo(() => selectedStructure ? `rgb(${selectedStructure.color.join(',')})` : 'rgb(255,255,255)', [selectedStructure]);
  const [accentHue] = useMemo(() => selectedStructure ? rgbToHsl(selectedStructure.color[0], selectedStructure.color[1], selectedStructure.color[2]) : [0, 0, 100], [selectedStructure]);

  // Pixel spacing for brush size display
  const pixelSpacing = useMemo(() => {
    const spacing = imageMetadata?.pixelSpacing?.split('\\').map(Number) || [0.9765625, 0.9765625];
    return (spacing[0] + spacing[1]) / 2;
  }, [imageMetadata]);
  
  const brushSizeCm = ((brushThickness[0] * pixelSpacing) / 10).toFixed(2);

  const sliceSpacing = useMemo(() => {
    let spacing = 2.5;
    const parsedSpacing = parseFloat(imageMetadata?.spacingBetweenSlices ?? imageMetadata?.sliceThickness);
    if (!Number.isNaN(parsedSpacing) && parsedSpacing > 0) {
      spacing = parsedSpacing;
    }
    return spacing;
  }, [imageMetadata?.spacingBetweenSlices, imageMetadata?.sliceThickness]);

  const normalizedCurrentSlice = useMemo(() => {
    if (currentSlicePosition == null || !Number.isFinite(currentSlicePosition)) return null;
    return Math.round(currentSlicePosition * 1000) / 1000;
  }, [currentSlicePosition]);

  const hasPredictionForCurrentSlice = useMemo(() => {
    if (!isPredictionEnabled || !activePredictions || activePredictions.size === 0) return false;
    if (normalizedCurrentSlice == null) return false;
    const tolerance = sliceSpacing * 0.4;
    return Array.from(activePredictions.keys()).some(slicePos => 
      Math.abs(slicePos - normalizedCurrentSlice) <= tolerance
    );
  }, [isPredictionEnabled, activePredictions, normalizedCurrentSlice, sliceSpacing]);

  // Undo/Redo
  const canUndo = undoRedoManager.canUndo();
  const canRedo = undoRedoManager.canRedo();

  // Keyboard shortcuts
  useEffect(() => {
    if (!isVisible) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'Delete' || e.key === 'Del') {
        e.preventDefault();
        handleDeleteCurrentSlice();
      }
      if (e.key.toLowerCase() === 'a' && hasPredictionForCurrentSlice) {
        e.preventDefault();
        handleAcceptPrediction();
      }
      if (e.key.toLowerCase() === 'x' && hasPredictionForCurrentSlice) {
        e.preventDefault();
        handleRejectPrediction();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, hasPredictionForCurrentSlice, selectedStructure, currentSlicePosition]);

  // Sync brush size from external updates
  useEffect(() => {
    const handler = (e: any) => {
      const newSize = Number(e?.detail?.brushSize);
      if (Number.isFinite(newSize)) {
        setBrushThickness([newSize]);
      }
    };
    window.addEventListener('brush:size:update', handler as EventListener);
    return () => window.removeEventListener('brush:size:update', handler as EventListener);
  }, []);

  // Notify parent when prediction mode changes
  useEffect(() => {
    if (onToolChange && activeTool === 'brush' && isPredictionEnabled) {
      onToolChange({
        tool: 'brush',
        brushSize: brushThickness[0],
        isActive: true,
        smartBrushEnabled: smartBrush,
        predictionEnabled: isPredictionEnabled,
        predictionMode: predictionMode,
      });
    }
  }, [predictionMode, onToolChange, activeTool, isPredictionEnabled, brushThickness, smartBrush]);

  // Mutations
  const updateNameMutation = useMutation({
    mutationFn: async ({ structureId, name }: { structureId: number; name: string }) => {
      const response = await fetch(`/api/rt-structures/${structureId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error('Failed to update structure name');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Structure name updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rt-structures'] });
    },
    onError: () => {
      toast({ title: "Failed to update structure name", variant: "destructive" });
    }
  });

  const updateColorMutation = useMutation({
    mutationFn: async ({ structureId, color }: { structureId: number; color: number[] }) => {
      const response = await fetch(`/api/rt-structures/${structureId}/color`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color })
      });
      if (!response.ok) throw new Error('Failed to update structure color');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Structure color updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rt-structures'] });
    },
    onError: () => {
      toast({ title: "Failed to update structure color", variant: "destructive" });
    }
  });

  // Tool handlers
  const handleToolClick = (toolId: string) => {
    const newTool = activeTool === toolId ? null : toolId;
    setActiveTool(newTool);
    
    // Clear dissect points when switching away from dissect tool
    if (activeTool === 'dissect' && newTool !== 'dissect') {
      setDissectPoints([]);
    }
    
    if (onToolChange) {
      onToolChange({
        tool: newTool,
        brushSize: brushThickness[0],
        isActive: newTool !== null,
        predictionEnabled: isPredictionEnabled,
        predictionMode: predictionMode,
        smartBrushEnabled: smartBrush,
        aiTumorSmoothOutput: aiTumorSmoothOutput
      });
    }
  };

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== selectedStructure?.structureName && selectedStructure) {
      onStructureNameChange(tempName.trim());
      updateNameMutation.mutate({ structureId: selectedStructure.roiNumber, name: tempName.trim() });
    }
    setIsEditingName(false);
  };

  const handleColorChange = (hexColor: string) => {
    if (!selectedStructure) return;
    const rgbColor = hexToRgb(hexColor);
    onStructureColorChange(hexColor);
    updateColorMutation.mutate({ structureId: selectedStructure.roiNumber, color: rgbColor });
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (!seriesId) return;
    const previousState = undoRedoManager.undo();
    if (previousState) {
      log.debug(`Undoing to: ${previousState.action} on structure ${previousState.structureId}`, 'toolbar');
      if (onContourUpdate) {
        onContourUpdate(previousState.rtStructures);
      }
      toast({ 
        title: `Undone: ${previousState.action}`,
        description: `${previousState.structureName || `Structure ${previousState.structureId}`}`
      });
    }
  };

  const handleRedo = () => {
    if (!seriesId) return;
    const nextState = undoRedoManager.redo();
    if (nextState) {
      log.debug(`Redoing to: ${nextState.action} on structure ${nextState.structureId}`, 'toolbar');
      if (onContourUpdate) {
        onContourUpdate(nextState.rtStructures);
      }
      toast({ 
        title: `Redone: ${nextState.action}`,
        description: `${nextState.structureName || `Structure ${nextState.structureId}`}`
      });
    }
  };

  // Action handlers
  const handleDeleteCurrentSlice = () => {
    if (!selectedStructure || currentSlicePosition == null) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'delete_slice',
        structureId: selectedStructure.roiNumber,
        slicePosition: currentSlicePosition
      });
    }
    toast({ title: `Deleted contour from current slice` });
  };

  const handleInterpolate = () => {
    if (!selectedStructure) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'interpolate',
        structureId: selectedStructure.roiNumber
      });
    }
    toast({ title: "Interpolating...", description: `Processing ${selectedStructure.structureName}` });
  };

  const handleDeleteEveryNthSlice = (n: number) => {
    if (!selectedStructure) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'delete_nth_slice',
        structureId: selectedStructure.roiNumber,
        nth: n
      });
    }
    toast({ title: `Deleted every ${n === 2 ? '2nd' : n === 3 ? '3rd' : '4th'} slice for ${selectedStructure.structureName}` });
  };

  const handleOpenSmartNthDialog = () => {
    if (!selectedStructure) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'get_slice_count',
        structureId: selectedStructure.roiNumber,
        callback: (count: number) => {
          setTotalSlicesForSmartNth(count);
          setShowSmartNthDialog(true);
        }
      });
    }
  };

  const handleApplySmartNth = (threshold: number) => {
    if (!selectedStructure) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'smart_nth_slice',
        structureId: selectedStructure.roiNumber,
        threshold: threshold
      });
    }
    toast({ 
      title: `SmartNth applied to ${selectedStructure.structureName}`,
      description: `Removed slices with <${threshold}% area change (max gap: 3)`
    });
  };

  const handleSmooth = () => {
    if (!selectedStructure) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'smooth',
        structureId: selectedStructure.roiNumber,
        smoothingFactor: 0.35,
        triggerAnimation: true
      });
    }
    toast({ title: `Smoothed ${selectedStructure.structureName}` });
  };

  const handleClearAll = () => {
    if (!selectedStructure) return;
    if (onContourUpdate) {
      onContourUpdate({ action: 'clear_all', structureId: selectedStructure.roiNumber });
    }
    toast({ title: `Cleared all contours for ${selectedStructure.structureName}` });
  };

  const handleClearAbove = () => {
    if (!selectedStructure || currentSlicePosition == null) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'clear_above',
        structureId: selectedStructure.roiNumber,
        slicePosition: currentSlicePosition
      });
    }
    toast({ title: `Cleared contours above current slice` });
  };

  const handleClearBelow = () => {
    if (!selectedStructure || currentSlicePosition == null) return;
    if (onContourUpdate) {
      onContourUpdate({
        action: 'clear_below',
        structureId: selectedStructure.roiNumber,
        slicePosition: currentSlicePosition
      });
    }
    toast({ title: `Cleared contours below current slice` });
  };

  const handleAcceptPrediction = () => {
    if (onContourUpdate) {
      onContourUpdate({
        action: 'accept_predictions',
        structureId: selectedStructure?.roiNumber,
        slicePosition: currentSlicePosition
      });
    }
    toast({ title: 'Prediction accepted (A)' });
  };

  const handleRejectPrediction = () => {
    if (onContourUpdate) {
      onContourUpdate({ 
        action: 'reject_predictions', 
        structureId: selectedStructure?.roiNumber,
        slicePosition: currentSlicePosition
      });
    }
    toast({ title: 'Prediction rejected (X)' });
  };

  // Tool definitions
  const mainTools = [
    { id: 'brush', icon: Brush, label: 'Brush', shortcut: 'B' },
    { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
    { id: 'erase', icon: Scissors, label: 'Erase', shortcut: 'E' },
    { id: 'dissect', icon: Split, label: 'Dissect', shortcut: 'D' },
    { id: 'interactive-tumor', icon: Sparkles, label: 'AI', shortcut: 'T' },
  ];

  // Inline settings renderer
  const renderInlineSettings = () => {
    if (!activeTool) return null;

    if (activeTool === 'brush' || activeTool === 'erase') {
      return (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 overflow-hidden"
        >
          <div className="w-px h-5 bg-white/10" />
          
          <div className="flex items-center gap-2">
            <Slider
              value={brushThickness}
              onValueChange={(val) => {
                setBrushThickness(val);
                if (onToolChange && activeTool) {
                  onToolChange({
                    tool: activeTool,
                    brushSize: val[0],
                    isActive: true,
                    predictionEnabled: isPredictionEnabled,
                    predictionMode: predictionMode,
                    smartBrushEnabled: smartBrush
                  });
                }
              }}
              max={100}
              min={1}
              step={1}
              className="w-20 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
            />
            <span className="text-sm font-semibold tabular-nums min-w-[42px]" style={{ color: accentRgb }}>
              {brushSizeCm}cm
            </span>
          </div>

          {activeTool === 'brush' && (
            <>
              <button
                onClick={() => {
                  const enabled = !smartBrush;
                  setSmartBrush(enabled);
                  if (onToolChange) {
                    onToolChange({
                      tool: 'brush',
                      brushSize: brushThickness[0],
                      isActive: true,
                      smartBrushEnabled: enabled,
                      predictionEnabled: isPredictionEnabled,
                      predictionMode: predictionMode,
                    });
                  }
                }}
                className={cn(
                  'h-7 px-2.5 flex items-center gap-1.5 rounded text-xs font-medium transition-all border',
                  smartBrush
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'text-gray-500 hover:text-gray-400 hover:bg-white/5 border-white/10'
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Smart
              </button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={async () => {
                      const willEnable = !isPredictionEnabled;
                      if (willEnable) {
                        // Check SAM server health before enabling
                        setSamLoading(true);
                        try {
                          await samServerClient.checkHealth();
                          setIsPredictionEnabled(true);
                          setPredictionMode('sam'); // Always SAM
                          if (onToolChange) {
                            onToolChange({
                              tool: 'brush',
                              brushSize: brushThickness[0],
                              isActive: true,
                              smartBrushEnabled: smartBrush,
                              predictionEnabled: true,
                              predictionMode: 'sam',
                            });
                          }
                          toast({
                            title: 'SAM Prediction Enabled',
                            description: 'Navigate to a slice without contour to see prediction',
                          });
                        } catch (err) {
                          console.error('SAM server not available:', err);
                          toast({ 
                            title: "SAM Server Offline", 
                            description: "Start the SAM server from AI Status Panel",
                            variant: "destructive" 
                          });
                        } finally {
                          setSamLoading(false);
                        }
                      } else {
                        setIsPredictionEnabled(false);
                        if (onToolChange) {
                          onToolChange({
                            tool: 'brush',
                            brushSize: brushThickness[0],
                            isActive: true,
                            smartBrushEnabled: smartBrush,
                            predictionEnabled: false,
                            predictionMode: 'sam',
                          });
                        }
                      }
                    }}
                    disabled={samLoading}
                    className={cn(
                      'h-7 px-2.5 flex items-center gap-1.5 rounded text-xs font-medium transition-all border',
                      isPredictionEnabled
                        ? 'bg-violet-500/20 text-violet-400 border-violet-500/40'
                        : 'text-gray-500 hover:text-gray-400 hover:bg-white/5 border-white/10',
                      samLoading && 'opacity-50 cursor-wait'
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {samLoading ? 'Checking...' : 'Predict'}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium">SAM Next-Slice Prediction</p>
                  <p className="mt-1 text-gray-400">Uses centroid of previous contour as click point for AI segmentation</p>
                </TooltipContent>
              </Tooltip>

              {/* Accept/Reject buttons - always visible when prediction enabled, greyed out when no prediction */}
              {isPredictionEnabled && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleAcceptPrediction}
                    disabled={!hasPredictionForCurrentSlice}
                    className={cn(
                      "h-7 px-2.5 flex items-center gap-1 rounded text-xs font-medium transition-all border",
                      hasPredictionForCurrentSlice
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                        : "bg-transparent text-gray-600 border-white/10 cursor-not-allowed"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRejectPrediction}
                    disabled={!hasPredictionForCurrentSlice}
                    className={cn(
                      "h-7 px-2.5 flex items-center gap-1 rounded text-xs font-medium transition-all border",
                      hasPredictionForCurrentSlice
                        ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                        : "bg-transparent text-gray-600 border-white/10 cursor-not-allowed"
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      );
    }

    if (activeTool === 'pen') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 overflow-hidden"
        >
          <div className="w-px h-5 bg-white/10" />
          <span className="text-xs text-gray-500">Click to place • Right-click to close</span>
        </motion.div>
      );
    }

    if (activeTool === 'interactive-tumor') {
      return (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 overflow-hidden"
        >
          <div className="w-px h-5 bg-white/10" />
          
          {/* Server Status + Start Button */}
          {samServerStatus === 'unavailable' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleStartSamServer}
                  className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Start Server
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                <p className="font-medium text-amber-300">SAM Server Offline</p>
                <p className="mt-1 text-gray-400">Click to start the SAM server. May take ~60s to load model.</p>
              </TooltipContent>
            </Tooltip>
          ) : samServerStatus === 'starting' ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 text-amber-300/70 text-[10px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Starting...</span>
            </div>
          ) : samServerStatus === 'healthy' ? (
            <div className="flex items-center gap-1.5">
              <MousePointer2 className="w-3.5 h-3.5" style={{ color: accentRgb }} />
              <span className="text-xs text-gray-400">Click to segment</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <MousePointer2 className="w-3.5 h-3.5" style={{ color: accentRgb }} />
              <span className="text-xs text-gray-500">Checking server...</span>
            </div>
          )}

          {/* 2D/3D Mode Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center bg-black/30 rounded-md p-0.5">
                <button
                  onClick={() => {
                    setAiTumor3DMode(false);
                    if (onToolChange) {
                      onToolChange({
                        tool: 'interactive-tumor',
                        brushSize: 0,
                        isActive: true,
                        aiTumorSmoothOutput,
                        aiTumorUseSAM: true,
                        aiTumor3DMode: false,
                      });
                    }
                  }}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-all",
                    !aiTumor3DMode
                      ? "bg-purple-500/30 text-purple-200"
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  2D
                </button>
                <button
                  onClick={() => {
                    setAiTumor3DMode(true);
                    if (onToolChange) {
                      onToolChange({
                        tool: 'interactive-tumor',
                        brushSize: 0,
                        isActive: true,
                        aiTumorSmoothOutput,
                        aiTumorUseSAM: true,
                        aiTumor3DMode: true,
                      });
                    }
                  }}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-all",
                    aiTumor3DMode
                      ? "bg-blue-500/30 text-blue-200"
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  3D
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[220px]">
              <p className="font-medium">{aiTumor3DMode ? '3D Propagation' : '2D Single Slice'}</p>
              <p className="mt-1 text-gray-400">
                {aiTumor3DMode 
                  ? 'Click to segment and auto-propagate through all slices' 
                  : 'Click to segment only the current slice'}
              </p>
            </TooltipContent>
          </Tooltip>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <Switch
              checked={aiTumorSmoothOutput}
              onCheckedChange={(checked) => {
                setAiTumorSmoothOutput(checked);
                if (onToolChange) {
                  onToolChange({
                    tool: 'interactive-tumor',
                    brushSize: 0,
                    isActive: true,
                    aiTumorSmoothOutput: checked,
                    aiTumorUseSAM: true,
                    aiTumor3DMode,
                  });
                }
              }}
              className="scale-75 data-[state=checked]:bg-emerald-500"
            />
            <span className="text-xs text-gray-500">Smooth</span>
          </label>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const canvas = workingViewerRef?.current?.canvasRef?.current;
                  if (canvas) {
                    const eventName = aiTumor3DMode ? 'ai-tumor-segment-3d' : 'ai-tumor-segment';
                    const event = new Event(eventName);
                    canvas.dispatchEvent(event);
                  } else {
                    toast({ title: 'Canvas Error', description: 'Canvas reference not available.', variant: 'destructive' });
                  }
                }}
                className="h-8 px-3 flex items-center gap-2 rounded-md text-sm font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 hover:text-emerald-200 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Retry
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Re-run {aiTumor3DMode ? '3D propagation' : '2D segmentation'} on current click point
            </TooltipContent>
          </Tooltip>
          
          {/* Multi-point mode hint - compact */}
          <AnimatePresence mode="wait">
            {isShiftHeld ? (
              <motion.div
                key="shift-active"
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/20 text-[10px]"
              >
                <span className="text-purple-300">⇧</span>
                <span className="text-green-400">L+</span>
                <span className="text-red-400">R−</span>
                <span className="text-gray-400">drag</span>
              </motion.div>
            ) : (
              <motion.span
                key="shift-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                className="text-[9px] text-gray-500"
              >
                ⇧ multi
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      );
    }

    if (activeTool === 'dissect') {
      const pointsNeeded = dissectLineCount * 2;
      const pointsPlaced = dissectPoints.length;
      const canGenerate = pointsPlaced >= 2 && pointsPlaced % 2 === 0;
      
      return (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 overflow-hidden"
        >
          <div className="w-px h-6 bg-white/10" />
          
          <div className="flex items-center gap-1.5">
            <Split className="w-4 h-4" style={{ color: accentRgb }} />
            <span className="text-sm text-gray-400 font-medium">Click to place points</span>
          </div>

          {/* Line count selector */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded p-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setDissectLineCount(1);
                    setDissectPoints([]);
                  }}
                  className={cn(
                    'h-7 px-2.5 rounded text-xs font-semibold transition-all',
                    dissectLineCount === 1
                      ? 'bg-cyan-500/30 text-cyan-300'
                      : 'text-gray-500 hover:text-gray-400'
                  )}
                >
                  1 Line
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">
                Single bisecting line (2 points)
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setDissectLineCount(2);
                    setDissectPoints([]);
                  }}
                  className={cn(
                    'h-7 px-2.5 rounded text-xs font-semibold transition-all',
                    dissectLineCount === 2
                      ? 'bg-cyan-500/30 text-cyan-300'
                      : 'text-gray-500 hover:text-gray-400'
                  )}
                >
                  2 Lines
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">
                Two bisecting lines (4 points)
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Points indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20">
            <Circle className="w-3.5 h-3.5" style={{ color: accentRgb }} />
            <span className="text-xs font-semibold tabular-nums" style={{ color: pointsPlaced >= pointsNeeded ? accentRgb : 'rgb(156, 163, 175)' }}>
              {pointsPlaced}/{pointsNeeded}
            </span>
          </div>

          {/* Clear points button */}
          {pointsPlaced > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDissectPoints([])}
                  className="h-8 px-2.5 flex items-center gap-1.5 rounded text-xs font-medium text-gray-500 hover:text-gray-400 hover:bg-white/5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Clear all points</TooltipContent>
            </Tooltip>
          )}

          {/* Generate button */}
          <button
            onClick={() => {
              if (!canGenerate) {
                toast({ title: 'Place points first', description: `Need at least 2 points (1 line) to dissect.`, variant: 'destructive' });
                return;
              }
              onContourUpdate?.({ 
                action: 'dissect_contour', 
                structureId: selectedStructure.roiNumber,
                lines: dissectPoints,
                lineCount: dissectLineCount
              });
              toast({ title: 'Dissecting contour...', description: `Using ${pointsPlaced / 2} line(s)` });
              setDissectPoints([]);
            }}
            disabled={!canGenerate}
            className={cn(
              "h-8 px-3 flex items-center gap-2 rounded-md text-sm font-semibold transition-all",
              canGenerate 
                ? "text-cyan-300 bg-cyan-500/20 hover:bg-cyan-500/30 hover:text-cyan-200" 
                : "text-gray-500 bg-gray-700/50 cursor-not-allowed"
            )}
          >
            <Split className="w-3.5 h-3.5" />
            Generate
          </button>
        </motion.div>
      );
    }

    return null;
  };

  if (!isVisible || !selectedStructure) return null;

  return (
    <TooltipProvider delayDuration={200}>
      {/* 
        IMPORTANT: Framer Motion writes an inline `transform` for animation (scale/translateY).
        If we also use `transform` for horizontal drag/centering, Motion will overwrite it,
        making horizontal drag appear broken. 
        So: outer wrapper handles positioning + drag translateX, inner motion handles animation.
      */}
      <div
        className={cn("fixed z-50 select-none", isDragging && "cursor-grabbing")}
        style={{
          bottom: `calc(96px - ${position.y}px)`,
          left: `calc(${viewerOffsetLeft}px + 16px + ${position.x}px)`,
        }}
        onMouseDown={(e) => {
          // Stop all mouse events from propagating to canvas below
          e.stopPropagation();
          handleMouseDown(e);
        }}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <div 
            className={cn(
              "rounded-2xl overflow-hidden backdrop-blur-xl transition-all",
              isDragging && "ring-2"
            )}
            style={{
              background: `linear-gradient(180deg, hsla(${accentHue}, 12%, 13%, 0.97) 0%, hsla(${accentHue}, 8%, 9%, 0.99) 100%)`,
              boxShadow: `
                0 8px 24px -4px rgba(0, 0, 0, 0.6),
                0 16px 48px -8px rgba(0, 0, 0, 0.4),
                0 0 0 1px ${accentRgb}15,
                0 0 40px -10px ${accentRgb}15
              `,
              ...(isDragging ? { ringColor: `${accentRgb}40` } : {}),
            }}
          >
            {/* ===== ROW 1: Tools + Inline Settings ===== */}
            <div className="flex items-center gap-3 px-3 py-2">
              {/* Drag Handle */}
              <div 
                data-drag-handle
                className="flex items-center justify-center w-6 h-7 cursor-grab active:cursor-grabbing rounded transition-all hover:bg-white/5"
                style={{ color: `${accentRgb}50` }}
              >
                <GripVertical className="w-4 h-4" />
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Structure Color + Name */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = accentHex;
                    input.onchange = (e) => handleColorChange((e.target as HTMLInputElement).value);
                    input.click();
                  }}
                  className="w-4 h-4 rounded cursor-pointer transition-transform hover:scale-110"
                  style={{ 
                    backgroundColor: accentRgb,
                    boxShadow: `0 0 12px -2px ${accentRgb}60`,
                  }}
                />
                {isEditingName ? (
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleNameSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                    autoFocus
                    className="h-7 w-28 px-2 text-sm bg-black/40 border-white/20 text-white rounded"
                  />
                ) : (
                  <button
                    onClick={() => { setTempName(selectedStructure.structureName); setIsEditingName(true); }}
                    className="text-sm font-semibold text-white/90 hover:text-white transition-colors max-w-[120px] truncate"
                  >
                    {selectedStructure.structureName}
                  </button>
                )}
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Tool Buttons */}
              <div className="flex items-center gap-0.5">
                {mainTools.map((tool) => {
                  const IconComponent = tool.icon;
                  const isActive = activeTool === tool.id;
                  return (
                    <Tooltip key={tool.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleToolClick(tool.id)}
                          className={cn(
                            'h-8 px-3 flex items-center gap-2 rounded-md transition-all text-sm font-medium',
                            isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                          )}
                          style={isActive ? {
                            background: `${accentRgb}20`,
                            boxShadow: `inset 0 0 0 1px ${accentRgb}30`,
                          } : {}}
                        >
                          <IconComponent className="w-4 h-4" style={isActive ? { color: accentRgb } : {}} />
                          <span>{tool.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                        {tool.label} ({tool.shortcut})
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Inline Settings */}
              <AnimatePresence mode="wait">
                {renderInlineSettings()}
              </AnimatePresence>

              <div className="flex-1" />

              {/* Utilities */}
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={resetPosition} className="h-8 w-8 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Reset position</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Close (Esc)</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* ===== ROW 2: Quick Actions ===== */}
            <div 
              className="flex items-center gap-3 px-3 py-2"
              style={{ background: `hsla(${accentHue}, 6%, 8%, 1)` }}
            >
            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md transition-all',
                      canUndo ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'
                    )}
                  >
                    <Undo className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Undo (Ctrl+Z)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md transition-all',
                      canRedo ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'
                    )}
                  >
                    <Redo className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Redo (Ctrl+Y)</TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                    <button
                    onClick={handleDeleteCurrentSlice}
                    className="h-9 px-3.5 flex items-center gap-2 rounded-md text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Delete slice (Del)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                    <button
                    onClick={handleInterpolate}
                    className="h-9 px-3.5 flex items-center gap-2 rounded-md text-sm font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                  >
                    <GitBranch className="w-4 h-4" />
                    Interp
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Interpolate</TooltipContent>
              </Tooltip>

              {/* Smooth - moved before Nth */}
              <Tooltip>
                <TooltipTrigger asChild>
                    <button
                    onClick={handleSmooth}
                    className="h-9 px-3.5 flex items-center gap-2 rounded-md text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Smooth
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Smooth contours</TooltipContent>
              </Tooltip>

              {/* Nth Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 px-3.5 flex items-center gap-2 rounded-md text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all">
                    <Grid3x3 className="w-4 h-4" />
                    Nth
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  side="top" 
                  align="start"
                  sideOffset={8}
                  collisionPadding={16}
                  className="min-w-[140px] bg-gray-900/98 border-gray-700/50 backdrop-blur-xl"
                >
                  {[2, 3, 4].map(n => (
                    <DropdownMenuItem
                      key={n}
                      onSelect={() => handleDeleteEveryNthSlice(n)}
                      className="text-sm text-amber-300/90 hover:text-amber-200 focus:text-amber-200 focus:bg-amber-500/10 font-medium cursor-pointer"
                    >
                      Every {n === 2 ? '2nd' : n === 3 ? '3rd' : '4th'} slice
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onSelect={handleOpenSmartNthDialog}
                    className="text-sm text-amber-200 hover:text-amber-100 focus:text-amber-100 focus:bg-amber-500/10 font-semibold cursor-pointer"
                  >
                    SmartNth...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Blob Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 px-3.5 flex items-center gap-2 rounded-md text-sm font-medium text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-all">
                    <SplitSquareHorizontal className="w-4 h-4" />
                    Blob
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  side="top" 
                  align="start"
                  sideOffset={8}
                  collisionPadding={16}
                  className="min-w-[200px] bg-gray-900/98 border-gray-700/50 backdrop-blur-xl"
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      onContourUpdate?.({ action: 'open_remove_blobs_dialog', structureId: selectedStructure.roiNumber });
                    }}
                    className="flex items-center gap-2 text-sm text-violet-300/90 hover:text-violet-200 focus:text-violet-200 focus:bg-violet-500/10 font-medium cursor-pointer"
                  >
                    <MousePointerClick className="w-4 h-4" />
                    Separator Tool
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      onContourUpdate?.({ action: 'separate_blobs', structureId: selectedStructure.roiNumber });
                    }}
                    className="flex items-center gap-2 text-sm text-violet-300/90 hover:text-violet-200 focus:text-violet-200 focus:bg-violet-500/10 font-medium cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    Separate All Blobs
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      const newState = !hideOtherContours;
                      setHideOtherContours(newState);
                      onContourUpdate?.({ 
                        action: 'toggle_other_contours_visibility', 
                        structureId: selectedStructure.roiNumber,
                        hideOthers: newState
                      });
                    }}
                    className="flex items-center gap-2 text-sm text-violet-300/90 hover:text-violet-200 focus:text-violet-200 focus:bg-violet-500/10 font-medium cursor-pointer"
                  >
                    {hideOtherContours ? (
                      <>
                        <Eye className="w-4 h-4" />
                        Show Other Contours
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Hide Other Contours
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Clear Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 px-3.5 flex items-center gap-2 rounded-md text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all">
                    <Eraser className="w-4 h-4" />
                    Clear
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  side="top" 
                  align="end"
                  sideOffset={8}
                  collisionPadding={16}
                  className="min-w-[140px] bg-gray-900/98 border-gray-700/50 backdrop-blur-xl"
                >
                  <DropdownMenuItem
                    onSelect={handleClearAbove}
                    className="text-sm text-rose-300/90 hover:text-rose-200 focus:text-rose-200 focus:bg-rose-500/10 font-medium cursor-pointer"
                  >
                    Clear above
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={handleClearBelow}
                    className="text-sm text-rose-300/90 hover:text-rose-200 focus:text-rose-200 focus:bg-rose-500/10 font-medium cursor-pointer"
                  >
                    Clear below
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onSelect={handleClearAll}
                    className="text-sm text-rose-400 hover:text-rose-300 focus:text-rose-300 focus:bg-rose-500/10 font-semibold cursor-pointer"
                  >
                    Clear all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* SmartNth Settings Dialog */}
      <SmartNthSettingsDialog
        isOpen={showSmartNthDialog}
        onClose={() => setShowSmartNthDialog(false)}
        onApply={handleApplySmartNth}
        structureName={selectedStructure?.structureName || ''}
        totalSlices={totalSlicesForSmartNth}
      />

      {/* Prediction tuning removed (GEO uses deterministic world-space propagation). */}
    </TooltipProvider>
  );
}
