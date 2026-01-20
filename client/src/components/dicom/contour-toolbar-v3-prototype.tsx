/**
 * Contour Toolbar V3 Prototype
 * 
 * Elegant redesign with:
 * - Dark #0f1219 subpanel matching Unified Fusion Toolbar
 * - Draggable anywhere on screen with position memory
 * - Minimal height while preserving all functionality
 * - Compact single-row layout with contextual inline settings
 * - Subtle structure color accents without overwhelming the UI
 * - Grip handle for dragging
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Brush,
  Pen,
  Scissors,
  Maximize2,
  Sparkles,
  X,
  ChevronDown,
  Undo,
  Redo,
  Trash2,
  GitBranch,
  Grid3x3,
  Eraser,
  SplitSquareHorizontal,
  Zap,
  Check,
  MousePointer2,
  Info,
  MoreHorizontal,
  GripVertical,
  RotateCcw,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Position {
  x: number;
  y: number;
}

interface ContourToolbarV3Props {
  // Structure info
  structureName: string;
  structureColor: number[]; // RGB
  roiNumber: number;

  // Tool state
  activeTool: string | null;
  onToolChange: (tool: string | null) => void;

  // Brush settings
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  pixelSpacing?: number;

  // Smart features
  smartBrushEnabled: boolean;
  onSmartBrushToggle: (enabled: boolean) => void;
  predictionEnabled: boolean;
  onPredictionToggle: (enabled: boolean) => void;
  hasPrediction: boolean;
  onAcceptPrediction: () => void;
  onRejectPrediction: () => void;

  // Actions
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSlice: () => void;
  onInterpolate: () => void;
  onDeleteNth: (n: number) => void;
  onSmooth: () => void;
  onClearAll: () => void;
  onClearAbove: () => void;
  onClearBelow: () => void;
  onOpenBlobTools: () => void;
  onOpenMarginTool: () => void;

  // Structure editing
  onStructureNameChange: (name: string) => void;
  onStructureColorChange: (color: string) => void;

  // Close
  onClose: () => void;

  // AI Tumor specific
  onAiTumorGenerate?: () => void;
  onAiTumorClear?: () => void;
  aiTumorSmoothOutput?: boolean;
  onAiTumorSmoothChange?: (smooth: boolean) => void;

  // Draggable
  initialPosition?: Position;
  onPositionChange?: (position: Position) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const rgbToHex = (rgb: number[]) => {
  return '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');
};

const hexToRgb = (hex: string): number[] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [255, 255, 255];
};

const STORAGE_KEY = 'contour-toolbar-v3-position';

const getStoredPosition = (): Position | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load toolbar position:', e);
  }
  return null;
};

const savePosition = (position: Position) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch (e) {
    console.warn('Failed to save toolbar position:', e);
  }
};

// ============================================================================
// DRAGGABLE HOOK
// ============================================================================

function useDraggable(
  ref: React.RefObject<HTMLDivElement>,
  initialPosition: Position,
  onPositionChange?: (position: Position) => void
) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const positionRef = useRef(position);
  
  // Keep ref in sync with state to avoid stale closures
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        posX: positionRef.current.x,
        posY: positionRef.current.y,
      };
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      
      const newPos = {
        x: dragStart.current.posX + deltaX,
        y: dragStart.current.posY + deltaY,
      };
      
      positionRef.current = newPos;
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (dragStart.current) {
        savePosition(positionRef.current);
        onPositionChange?.(positionRef.current);
      }
      dragStart.current = null;
    };

    // CRITICAL FIX: Add multiple event listeners to catch all cases where drag should end
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointerup', handleMouseUp);  // Better cross-browser support
    document.addEventListener('pointercancel', handleMouseUp);  // Handle touch cancellation
    window.addEventListener('blur', handleMouseUp);  // Handle window losing focus

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
      window.removeEventListener('blur', handleMouseUp);
    };
  }, [isDragging, position, onPositionChange]);

  return { position, isDragging, handleMouseDown, setPosition };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ContourToolbarV3({
  structureName,
  structureColor,
  roiNumber,
  activeTool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  pixelSpacing = 1,
  smartBrushEnabled,
  onSmartBrushToggle,
  predictionEnabled,
  onPredictionToggle,
  hasPrediction,
  onAcceptPrediction,
  onRejectPrediction,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDeleteSlice,
  onInterpolate,
  onDeleteNth,
  onSmooth,
  onClearAll,
  onClearAbove,
  onClearBelow,
  onOpenBlobTools,
  onOpenMarginTool,
  onStructureNameChange,
  onStructureColorChange,
  onClose,
  onAiTumorGenerate,
  onAiTumorClear,
  aiTumorSmoothOutput,
  onAiTumorSmoothChange,
  initialPosition,
  onPositionChange,
}: ContourToolbarV3Props) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(structureName);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Get stored position or use initial/default
  const defaultPosition = useMemo(() => {
    const stored = getStoredPosition();
    if (stored) return stored;
    if (initialPosition) return initialPosition;
    // Default: centered at bottom
    return { x: 0, y: 0 };
  }, [initialPosition]);

  const { position, isDragging, handleMouseDown, setPosition } = useDraggable(
    toolbarRef,
    defaultPosition,
    onPositionChange
  );

  const structureColorHex = useMemo(() => rgbToHex(structureColor), [structureColor]);
  const structureColorRgb = useMemo(() => `rgb(${structureColor.join(',')})`, [structureColor]);

  // Calculate brush size in cm
  const brushSizeCm = useMemo(() => {
    const sizeMm = brushSize * pixelSpacing;
    return (sizeMm / 10).toFixed(2);
  }, [brushSize, pixelSpacing]);

  const mainTools = [
    { id: 'brush', icon: Brush, label: 'Brush', shortcut: 'B' },
    { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
    { id: 'erase', icon: Scissors, label: 'Erase', shortcut: 'E' },
    { id: 'margin', icon: Maximize2, label: 'Margin', shortcut: 'M' },
    { id: 'interactive-tumor', icon: Sparkles, label: 'AI Tumor', shortcut: 'T' },
  ];

  const handleToolClick = (toolId: string) => {
    if (toolId === 'margin') {
      onOpenMarginTool();
      return;
    }
    onToolChange(activeTool === toolId ? null : toolId);
  };

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== structureName) {
      onStructureNameChange(tempName.trim());
    }
    setIsEditingName(false);
  };

  const resetPosition = () => {
    const newPos = { x: 0, y: 0 };
    setPosition(newPos);
    savePosition(newPos);
  };

  // Render tool-specific inline settings
  const renderToolSettings = () => {
    if (!activeTool) return null;

    if (activeTool === 'brush') {
      return (
        <>
          <div className="w-px h-5 bg-white/10" />
          
          {/* Brush Size */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-lg border border-white/5">
            <span className="text-[9px] text-gray-500 uppercase tracking-wide font-medium">Size</span>
            <Slider
              value={[brushSize]}
              onValueChange={([val]) => onBrushSizeChange(val)}
              max={100}
              min={1}
              step={1}
              className="w-20 [&>span:first-child]:h-1 [&>span:first-child]:bg-gray-700 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
            />
            <span 
              className="text-[10px] font-semibold min-w-[40px] text-center tabular-nums"
              style={{ color: structureColorRgb }}
            >
              {brushSizeCm}cm
            </span>
          </div>

          {/* Smart Brush Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onSmartBrushToggle(!smartBrushEnabled)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center rounded-lg transition-all',
                  smartBrushEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                )}
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-900 border-gray-700">Smart Brush</TooltipContent>
          </Tooltip>

          {/* Prediction Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onPredictionToggle(!predictionEnabled)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center rounded-lg transition-all',
                  predictionEnabled
                    ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-900 border-gray-700">AI Prediction</TooltipContent>
          </Tooltip>

          {/* Prediction Accept/Reject */}
          {predictionEnabled && hasPrediction && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onAcceptPrediction}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900 border-gray-700">Accept (A)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onRejectPrediction}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900 border-gray-700">Reject (X)</TooltipContent>
              </Tooltip>
            </>
          )}

          {predictionEnabled && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-cyan-500/30 text-cyan-300 bg-cyan-950/30">
              ~50ms
            </Badge>
          )}
        </>
      );
    }

    if (activeTool === 'pen') {
      return (
        <>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-[10px] text-gray-400">Click to place • Right-click to close</span>
        </>
      );
    }

    if (activeTool === 'erase') {
      return (
        <>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-[10px] text-gray-400">Using brush size • Hold Shift for quick erase</span>
        </>
      );
    }

    if (activeTool === 'interactive-tumor') {
      return (
        <>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <MousePointer2 className="w-3.5 h-3.5" style={{ color: structureColorRgb }} />
            <span className="text-[10px] text-gray-300">Click tumor center</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded-lg border border-white/5">
            <Switch
              checked={aiTumorSmoothOutput || false}
              onCheckedChange={(checked) => onAiTumorSmoothChange?.(checked)}
              className="data-[state=checked]:bg-emerald-500 scale-75"
            />
            <span className="text-[10px] text-gray-400">Smooth</span>
          </div>

          <button
            onClick={onAiTumorGenerate}
            className="h-7 px-3 flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-500/80 border border-emerald-500/50 text-white rounded-lg transition-colors text-xs font-medium"
          >
            <Sparkles className="w-3 h-3" />
            Generate
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAiTumorClear}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-900 border-gray-700">Clear point</TooltipContent>
          </Tooltip>
        </>
      );
    }

    return null;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        ref={toolbarRef}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          "fixed z-50 select-none",
          isDragging && "cursor-grabbing"
        )}
        style={{
          left: `calc(50% + ${position.x}px)`,
          bottom: `calc(96px - ${position.y}px)`,
          transform: 'translateX(-50%)',
        }}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-xl border shadow-2xl backdrop-blur-xl transition-all",
            "bg-[#0f1219]/95 border-white/[0.08]",
            isDragging && "ring-2 ring-white/20"
          )}
        >
          {/* Drag Handle */}
          <div 
            data-drag-handle
            className="flex items-center justify-center w-6 h-8 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition-colors"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Structure Color & Name */}
          <div className="flex items-center gap-2 px-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = structureColorHex;
                    input.onchange = (e) => onStructureColorChange((e.target as HTMLInputElement).value);
                    input.click();
                  }}
                  className="w-4 h-4 rounded border border-white/30 cursor-pointer hover:border-white/60 transition-all hover:scale-110 shadow-sm"
                  style={{ backgroundColor: structureColorRgb }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900 border-gray-700">Change color</TooltipContent>
            </Tooltip>

            {isEditingName ? (
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                autoFocus
                className="h-6 w-28 px-1.5 text-xs bg-black/40 border-white/20 text-white focus:border-white/40"
              />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setTempName(structureName);
                      setIsEditingName(true);
                    }}
                    className="text-xs font-medium text-white/90 hover:text-white transition-colors max-w-[100px] truncate"
                  >
                    {structureName}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900 border-gray-700">Click to rename</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Tool Buttons */}
          <div className="flex items-center gap-0.5 bg-black/30 rounded-lg p-0.5 border border-white/5">
            {mainTools.map((tool) => {
              const IconComponent = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleToolClick(tool.id)}
                      className={cn(
                        'h-7 px-2 flex items-center gap-1.5 rounded-md transition-all text-xs',
                        isActive
                          ? 'text-white'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                      style={isActive ? {
                        backgroundColor: `${structureColorRgb}20`,
                        boxShadow: `inset 0 0 0 1px ${structureColorRgb}60`,
                      } : {}}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      <span className="font-medium hidden sm:inline">{tool.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900 border-gray-700">{tool.label} ({tool.shortcut})</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Inline Tool Settings */}
          {renderToolSettings()}

          <div className="w-px h-6 bg-white/10" />

          {/* Quick Actions */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={cn(
                    'h-7 w-7 flex items-center justify-center rounded-lg transition-all',
                    canUndo
                      ? 'text-gray-400 hover:text-white hover:bg-white/10'
                      : 'text-gray-700 cursor-not-allowed'
                  )}
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900 border-gray-700">Undo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={cn(
                    'h-7 w-7 flex items-center justify-center rounded-lg transition-all',
                    canRedo
                      ? 'text-gray-400 hover:text-white hover:bg-white/10'
                      : 'text-gray-700 cursor-not-allowed'
                  )}
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900 border-gray-700">Redo</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Action Buttons */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onDeleteSlice}
                  className="h-7 px-2 flex items-center gap-1 rounded-lg text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden md:inline">Del</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900 border-gray-700">Delete slice</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onInterpolate}
                  className="h-7 px-2 flex items-center gap-1 rounded-lg text-blue-400/80 hover:text-blue-300 hover:bg-blue-500/10 transition-all text-xs"
                >
                  <GitBranch className="w-3 h-3" />
                  <span className="hidden md:inline">Interp</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900 border-gray-700">Interpolate</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSmooth}
                  className="h-7 px-2 flex items-center gap-1 rounded-lg text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all text-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden md:inline">Smooth</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900 border-gray-700">Smooth contours</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px] bg-[#0f1219] border-white/10">
              <div className="px-2 py-1.5 text-[10px] text-gray-500 uppercase border-b border-white/5">
                Delete Operations
              </div>
              <DropdownMenuItem onClick={() => onDeleteNth(2)} className="text-xs cursor-pointer text-orange-400">
                <Grid3x3 className="w-3.5 h-3.5 mr-2" />
                Every 2nd slice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteNth(3)} className="text-xs cursor-pointer text-orange-400">
                <Grid3x3 className="w-3.5 h-3.5 mr-2" />
                Every 3rd slice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteNth(4)} className="text-xs cursor-pointer text-orange-400">
                <Grid3x3 className="w-3.5 h-3.5 mr-2" />
                Every 4th slice
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-white/5" />
              
              <div className="px-2 py-1.5 text-[10px] text-gray-500 uppercase">
                Clear
              </div>
              <DropdownMenuItem onClick={onClearAbove} className="text-xs cursor-pointer text-red-400">
                <Eraser className="w-3.5 h-3.5 mr-2" />
                Clear above current
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClearBelow} className="text-xs cursor-pointer text-red-400">
                <Eraser className="w-3.5 h-3.5 mr-2" />
                Clear below current
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClearAll} className="text-xs cursor-pointer text-red-500 font-medium">
                <Eraser className="w-3.5 h-3.5 mr-2" />
                Clear all slices
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-white/5" />
              
              <div className="px-2 py-1.5 text-[10px] text-gray-500 uppercase">
                Tools
              </div>
              <DropdownMenuItem onClick={onOpenBlobTools} className="text-xs cursor-pointer text-purple-400">
                <SplitSquareHorizontal className="w-3.5 h-3.5 mr-2" />
                Blob operations
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-white/5" />

              <DropdownMenuItem onClick={resetPosition} className="text-xs cursor-pointer text-gray-400">
                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                Reset toolbar position
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-white/10" />

          {/* Close Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClose}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-900 border-gray-700">Close (Esc)</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

// ============================================================================
// DEMO COMPONENT FOR PROTOTYPE PAGE
// ============================================================================

export function ContourToolbarV3Prototype() {
  const [activeTool, setActiveTool] = useState<string | null>('brush');
  const [brushSize, setBrushSize] = useState(15);
  const [smartBrush, setSmartBrush] = useState(false);
  const [prediction, setPrediction] = useState(false);
  const [hasPrediction, setHasPrediction] = useState(false);
  const [aiSmooth, setAiSmooth] = useState(false);
  const [structureName, setStructureName] = useState('GTV Primary');
  const [structureColor, setStructureColor] = useState([255, 100, 100]);
  const [isVisible, setIsVisible] = useState(true);

  // Simulate predictions appearing
  React.useEffect(() => {
    if (prediction && activeTool === 'brush') {
      const timer = setTimeout(() => setHasPrediction(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setHasPrediction(false);
    }
  }, [prediction, activeTool]);

  const handleColorChange = (hex: string) => {
    setStructureColor(hexToRgb(hex));
  };

  const mockStructures = [
    { name: 'GTV Primary', color: [255, 100, 100] },
    { name: 'CTV 70Gy', color: [255, 200, 100] },
    { name: 'PTV 54Gy', color: [100, 200, 255] },
    { name: 'Brainstem', color: [150, 100, 255] },
    { name: 'Parotid L', color: [100, 255, 150] },
  ];

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brush className="w-5 h-5 text-cyan-400" />
            Contour Toolbar V3 - Draggable Edition
          </CardTitle>
          <CardDescription>
            Elegant dark design with drag-anywhere functionality. Grab the handle to move!
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-gray-400 space-y-2">
          <p><strong className="text-white">New Features:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><span className="text-cyan-300">Draggable</span> - Grab the grip handle to move anywhere</li>
            <li><span className="text-cyan-300">Position Memory</span> - Remembers where you left it</li>
            <li><span className="text-cyan-300">Reset Position</span> - Available in the "More" menu</li>
            <li>Dark #0f1219 background matching fusion toolbar</li>
            <li>Single-row compact layout (~40px height)</li>
            <li>Structure color as subtle accent</li>
            <li>Contextual inline tool settings</li>
          </ul>
        </CardContent>
      </Card>

      {/* Structure Selector */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Test Different Structures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {mockStructures.map((s) => (
              <button
                key={s.name}
                onClick={() => {
                  setStructureName(s.name);
                  setStructureColor(s.color);
                }}
                className={cn(
                  'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                  structureName === s.name
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: `rgb(${s.color.join(',')})` }}
                  />
                  {s.name}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tool States */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Active Tool States</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[null, 'brush', 'pen', 'erase', 'interactive-tumor'].map((tool) => (
              <button
                key={tool || 'none'}
                onClick={() => setActiveTool(tool)}
                className={cn(
                  'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                  activeTool === tool
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                    : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                )}
              >
                {tool || 'No tool'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Visibility Toggle */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Toolbar Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setIsVisible(!isVisible)}
            variant={isVisible ? "default" : "outline"}
            className={isVisible ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {isVisible ? 'Hide Toolbar' : 'Show Toolbar'}
          </Button>
        </CardContent>
      </Card>

      {/* Simulated Viewport Area */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">SIMULATED VIEWPORT</CardTitle>
          <CardDescription>The toolbar floats above this area - try dragging it!</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-black rounded-xl border border-gray-800 overflow-hidden h-[500px] relative">
            {/* Mock viewport content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-600">
                <div className="text-sm mb-2">DICOM Viewport Area</div>
                <div className="text-xs text-gray-700">Drag the toolbar by its grip handle</div>
              </div>
            </div>
            
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />
          </div>
        </CardContent>
      </Card>

      {/* The Actual Toolbar */}
      <AnimatePresence>
        {isVisible && (
          <ContourToolbarV3
            structureName={structureName}
            structureColor={structureColor}
            roiNumber={1}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            pixelSpacing={0.9765625}
            smartBrushEnabled={smartBrush}
            onSmartBrushToggle={setSmartBrush}
            predictionEnabled={prediction}
            onPredictionToggle={setPrediction}
            hasPrediction={hasPrediction}
            onAcceptPrediction={() => {
              setHasPrediction(false);
              console.log('Accept prediction');
            }}
            onRejectPrediction={() => {
              setHasPrediction(false);
              console.log('Reject prediction');
            }}
            canUndo={true}
            canRedo={false}
            onUndo={() => console.log('Undo')}
            onRedo={() => console.log('Redo')}
            onDeleteSlice={() => console.log('Delete slice')}
            onInterpolate={() => console.log('Interpolate')}
            onDeleteNth={(n) => console.log(`Delete every ${n}th slice`)}
            onSmooth={() => console.log('Smooth')}
            onClearAll={() => console.log('Clear all')}
            onClearAbove={() => console.log('Clear above')}
            onClearBelow={() => console.log('Clear below')}
            onOpenBlobTools={() => console.log('Open blob tools')}
            onOpenMarginTool={() => console.log('Open margin tool')}
            onStructureNameChange={setStructureName}
            onStructureColorChange={handleColorChange}
            onClose={() => setIsVisible(false)}
            onAiTumorGenerate={() => console.log('Generate AI tumor')}
            onAiTumorClear={() => console.log('Clear AI point')}
            aiTumorSmoothOutput={aiSmooth}
            onAiTumorSmoothChange={setAiSmooth}
          />
        )}
      </AnimatePresence>

      {/* Comparison */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Design Comparison</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-xs">
          <div className="space-y-2">
            <h4 className="text-red-400 font-medium">Original Toolbar</h4>
            <ul className="text-gray-400 space-y-1">
              <li>• ~80px height</li>
              <li>• Fixed position</li>
              <li>• Hue-tinted background</li>
              <li>• Two-row layout</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-yellow-400 font-medium">V2 Toolbar</h4>
            <ul className="text-gray-400 space-y-1">
              <li>• ~44px height</li>
              <li>• Fixed position</li>
              <li>• Dark background</li>
              <li>• Single-row layout</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-emerald-400 font-medium">V3 Toolbar (NEW)</h4>
            <ul className="text-gray-400 space-y-1">
              <li>• ~40px height</li>
              <li>• <span className="text-cyan-300">Draggable!</span></li>
              <li>• Position memory</li>
              <li>• Grip handle</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







