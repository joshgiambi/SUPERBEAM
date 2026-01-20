/**
 * Contour Toolbar V4 Prototype - "Aurora" Edition (Refined)
 * 
 * Clean two-row design with inline tool settings:
 * - Row 1: Structure + Tools + Inline Settings (thinner)
 * - Row 2: Quick action buttons
 * - No floating panels - everything integrated
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
  GripVertical,
  RotateCcw,
} from 'lucide-react';

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

const STORAGE_KEY = 'contour-toolbar-v4-aurora-position';
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
      dragStart.current = { x: e.clientX, y: e.clientY, posX: positionRef.current.x, posY: positionRef.current.y };
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const newPos = {
        x: dragStart.current.posX + (e.clientX - dragStart.current.x),
        y: dragStart.current.posY + (e.clientY - dragStart.current.y),
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
  }, [isDragging, onPositionChange]);

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

interface ContourToolbarV4Props {
  structureName: string;
  structureColor: number[];
  roiNumber: number;
  activeTool: string | null;
  onToolChange: (tool: string | null) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  pixelSpacing?: number;
  smartBrushEnabled: boolean;
  onSmartBrushToggle: (enabled: boolean) => void;
  predictionEnabled: boolean;
  onPredictionToggle: (enabled: boolean) => void;
  hasPrediction: boolean;
  onAcceptPrediction: () => void;
  onRejectPrediction: () => void;
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
  onStructureNameChange: (name: string) => void;
  onStructureColorChange: (color: string) => void;
  onClose: () => void;
  onAiTumorGenerate?: () => void;
  onAiTumorClear?: () => void;
  aiTumorSmoothOutput?: boolean;
  onAiTumorSmoothChange?: (smooth: boolean) => void;
  initialPosition?: Position;
  onPositionChange?: (position: Position) => void;
}

// ============================================================================
// MAIN TOOLBAR
// ============================================================================

export function ContourToolbarV4({
  structureName, structureColor, roiNumber, activeTool, onToolChange,
  brushSize, onBrushSizeChange, pixelSpacing = 1,
  smartBrushEnabled, onSmartBrushToggle, predictionEnabled, onPredictionToggle,
  hasPrediction, onAcceptPrediction, onRejectPrediction,
  canUndo, canRedo, onUndo, onRedo,
  onDeleteSlice, onInterpolate, onDeleteNth, onSmooth,
  onClearAll, onClearAbove, onClearBelow, onOpenBlobTools, onOpenMarginTool,
  onStructureNameChange, onStructureColorChange, onClose,
  onAiTumorGenerate, onAiTumorClear, aiTumorSmoothOutput, onAiTumorSmoothChange,
  initialPosition, onPositionChange,
}: ContourToolbarV4Props) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(structureName);
  const [showNthMenu, setShowNthMenu] = useState(false);
  const [showClearMenu, setShowClearMenu] = useState(false);
  const nthMenuRef = useRef<NodeJS.Timeout | null>(null);
  const clearMenuRef = useRef<NodeJS.Timeout | null>(null);

  const defaultPos = useMemo(() => getStoredPosition() || initialPosition || { x: 0, y: 0 }, [initialPosition]);
  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable(defaultPos, onPositionChange);

  // Color computations
  const accentHex = useMemo(() => rgbToHex(structureColor), [structureColor]);
  const accentRgb = useMemo(() => `rgb(${structureColor.join(',')})`, [structureColor]);
  const [accentHue] = useMemo(() => rgbToHsl(structureColor[0], structureColor[1], structureColor[2]), [structureColor]);

  const brushSizeCm = ((brushSize * pixelSpacing) / 10).toFixed(2);

  const mainTools = [
    { id: 'brush', icon: Brush, label: 'Brush', shortcut: 'B' },
    { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
    { id: 'erase', icon: Scissors, label: 'Erase', shortcut: 'E' },
    { id: 'margin', icon: Maximize2, label: 'Margin', shortcut: 'M' },
    { id: 'interactive-tumor', icon: Sparkles, label: 'AI', shortcut: 'T' },
  ];

  const handleToolClick = (toolId: string) => {
    if (toolId === 'margin') { onOpenMarginTool(); return; }
    onToolChange(activeTool === toolId ? null : toolId);
  };

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== structureName) onStructureNameChange(tempName.trim());
    setIsEditingName(false);
  };

  // Inline settings renderer
  const renderInlineSettings = () => {
    if (!activeTool || activeTool === 'margin') return null;

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
              value={[brushSize]}
              onValueChange={([val]) => onBrushSizeChange(val)}
              max={100}
              min={1}
              step={1}
              className="w-20 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
            />
            <span className="text-xs font-semibold tabular-nums min-w-[38px]" style={{ color: accentRgb }}>
              {brushSizeCm}cm
            </span>
          </div>

          {activeTool === 'brush' && (
            <>
              <button
                onClick={() => onSmartBrushToggle(!smartBrushEnabled)}
                className={cn(
                  'h-6 px-2 flex items-center gap-1 rounded text-[11px] font-medium transition-all',
                  smartBrushEnabled
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-gray-500 hover:text-gray-400 hover:bg-white/5'
                )}
              >
                <Zap className="w-3 h-3" />
                Smart
              </button>

              <button
                onClick={() => onPredictionToggle(!predictionEnabled)}
                className={cn(
                  'h-6 px-2 flex items-center gap-1 rounded text-[11px] font-medium transition-all',
                  predictionEnabled
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'text-gray-500 hover:text-gray-400 hover:bg-white/5'
                )}
              >
                <Sparkles className="w-3 h-3" />
                Predict
              </button>

              <AnimatePresence>
                {predictionEnabled && hasPrediction && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1"
                  >
                    <button
                      onClick={onAcceptPrediction}
                      className="h-6 px-2 flex items-center gap-1 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/30"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={onRejectPrediction}
                      className="h-6 px-2 flex items-center gap-1 rounded bg-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/30"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
          <span className="text-[11px] text-gray-500">Click to place • Right-click to close</span>
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
          
          <div className="flex items-center gap-1.5">
            <MousePointer2 className="w-3 h-3" style={{ color: accentRgb }} />
            <span className="text-[11px] text-gray-400">Click center</span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <Switch
              checked={aiTumorSmoothOutput || false}
              onCheckedChange={(checked) => onAiTumorSmoothChange?.(checked)}
              className="scale-75 data-[state=checked]:bg-emerald-500"
            />
            <span className="text-[11px] text-gray-500">Smooth</span>
          </label>

          <button
            onClick={onAiTumorGenerate}
            className="h-6 px-2.5 flex items-center gap-1.5 rounded text-[11px] font-semibold text-white transition-all"
            style={{ background: accentRgb }}
          >
            <Sparkles className="w-3 h-3" />
            Generate
          </button>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className={cn("fixed z-50 select-none", isDragging && "cursor-grabbing")}
        style={{
          left: `calc(50% + ${position.x}px)`,
          bottom: `calc(96px - ${position.y}px)`,
          transform: 'translateX(-50%)',
        }}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={cn(
            "rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl transition-all",
            isDragging && "ring-2"
          )}
          style={{
            background: `linear-gradient(180deg, hsla(${accentHue}, 12%, 13%, 0.97) 0%, hsla(${accentHue}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentRgb}20, 0 0 60px -15px ${accentRgb}20`,
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
                  input.onchange = (e) => onStructureColorChange((e.target as HTMLInputElement).value);
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
                  className="h-6 w-24 px-1.5 text-xs bg-black/40 border-white/20 text-white rounded"
                />
              ) : (
                <button
                  onClick={() => { setTempName(structureName); setIsEditingName(true); }}
                  className="text-xs font-semibold text-white/90 hover:text-white transition-colors max-w-[100px] truncate"
                >
                  {structureName}
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
                          'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                          isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        )}
                        style={isActive ? {
                          background: `${accentRgb}20`,
                          boxShadow: `inset 0 0 0 1px ${accentRgb}30`,
                        } : {}}
                      >
                        <IconComponent className="w-3.5 h-3.5" style={isActive ? { color: accentRgb } : {}} />
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
                  <button onClick={resetPosition} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Reset position</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
                    <X className="w-3.5 h-3.5" />
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
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={cn(
                      'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                      canUndo ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'
                    )}
                  >
                    <Undo className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={cn(
                      'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                      canRedo ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'
                    )}
                  >
                    <Redo className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Redo</TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-5 bg-white/10" />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onDeleteSlice}
                    className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Delete slice</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onInterpolate}
                    className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                  >
                    <GitBranch className="w-3 h-3" />
                    Interp
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Interpolate</TooltipContent>
              </Tooltip>

              {/* Nth Menu */}
              <div 
                className="relative"
                onMouseEnter={() => { if (nthMenuRef.current) clearTimeout(nthMenuRef.current); setShowNthMenu(true); }}
                onMouseLeave={() => { nthMenuRef.current = setTimeout(() => setShowNthMenu(false), 150); }}
              >
                <button className="h-7 px-2.5 flex items-center gap-1 rounded-md text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all">
                  <Grid3x3 className="w-3 h-3" />
                  Nth
                  <ChevronDown className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {showNthMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-0 mb-1 rounded-lg shadow-xl overflow-hidden"
                      style={{ background: `hsla(${accentHue}, 8%, 12%, 0.98)`, border: `1px solid ${accentRgb}15` }}
                    >
                      {[2, 3, 4].map(n => (
                        <button
                          key={n}
                          onClick={() => { onDeleteNth(n); setShowNthMenu(false); }}
                          className="w-full px-3 py-2 text-left text-xs text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10 transition-colors font-medium whitespace-nowrap"
                        >
                          Every {n === 2 ? '2nd' : n === 3 ? '3rd' : '4th'} slice
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onSmooth}
                    className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    Smooth
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Smooth contours</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenBlobTools}
                    className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-all"
                  >
                    <SplitSquareHorizontal className="w-3 h-3" />
                    Blob
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 border-gray-700 text-xs">Blob tools</TooltipContent>
              </Tooltip>

              {/* Clear Menu */}
              <div 
                className="relative"
                onMouseEnter={() => { if (clearMenuRef.current) clearTimeout(clearMenuRef.current); setShowClearMenu(true); }}
                onMouseLeave={() => { clearMenuRef.current = setTimeout(() => setShowClearMenu(false), 150); }}
              >
                <button className="h-7 px-2.5 flex items-center gap-1 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all">
                  <Eraser className="w-3 h-3" />
                  Clear
                  <ChevronDown className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {showClearMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full right-0 mb-1 rounded-lg shadow-xl overflow-hidden"
                      style={{ background: `hsla(${accentHue}, 8%, 12%, 0.98)`, border: `1px solid ${accentRgb}15` }}
                    >
                      <button onClick={() => { onClearAbove(); setShowClearMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-rose-300/90 hover:text-rose-200 hover:bg-rose-500/10 transition-colors font-medium whitespace-nowrap">
                        Clear above
                      </button>
                      <button onClick={() => { onClearBelow(); setShowClearMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-rose-300/90 hover:text-rose-200 hover:bg-rose-500/10 transition-colors font-medium whitespace-nowrap">
                        Clear below
                      </button>
                      <div className="h-px bg-white/10 mx-2" />
                      <button onClick={() => { onClearAll(); setShowClearMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors font-semibold whitespace-nowrap">
                        Clear all
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

// ============================================================================
// DEMO
// ============================================================================

export function ContourToolbarV4Prototype() {
  const [activeTool, setActiveTool] = useState<string | null>('brush');
  const [brushSize, setBrushSize] = useState(15);
  const [smartBrush, setSmartBrush] = useState(false);
  const [prediction, setPrediction] = useState(false);
  const [hasPrediction, setHasPrediction] = useState(false);
  const [aiSmooth, setAiSmooth] = useState(false);
  const [structureName, setStructureName] = useState('GTV Primary');
  const [structureColor, setStructureColor] = useState([255, 100, 100]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (prediction && activeTool === 'brush') {
      const timer = setTimeout(() => setHasPrediction(true), 1500);
      return () => clearTimeout(timer);
    }
    setHasPrediction(false);
  }, [prediction, activeTool]);

  const structures = [
    { name: 'GTV Primary', color: [255, 100, 100] },
    { name: 'CTV 70Gy', color: [255, 180, 80] },
    { name: 'PTV 54Gy', color: [80, 180, 255] },
    { name: 'Brainstem', color: [180, 100, 255] },
    { name: 'Parotid L', color: [100, 255, 160] },
  ];

  return (
    <div className="space-y-6 p-8 min-h-screen bg-[#0a0a0e]">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <Brush className="w-5 h-5 text-cyan-400" />
            Contour Toolbar V4 — Refined
          </CardTitle>
          <CardDescription className="text-gray-400">
            Thinner layout with inline settings • No floating panels • Clean two-row design
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">Structures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {structures.map((s) => (
                <button
                  key={s.name}
                  onClick={() => { setStructureName(s.name); setStructureColor(s.color); }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                    structureName === s.name
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-gray-800 bg-gray-900/50 text-gray-500 hover:border-gray-700'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: `rgb(${s.color.join(',')})` }} />
                    {s.name}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">Active Tool</CardTitle>
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
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-gray-800 bg-gray-900/50 text-gray-500 hover:border-gray-700'
                  )}
                >
                  {tool || 'None'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-6">
          <button
            onClick={() => setIsVisible(!isVisible)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
              isVisible ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
            )}
          >
            {isVisible ? 'Hide Toolbar' : 'Show Toolbar'}
          </button>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <div className="rounded-xl border border-gray-800 h-[450px] relative flex items-center justify-center bg-[#080810]">
            <span className="text-gray-700 text-sm">DICOM Viewport</span>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {isVisible && (
          <ContourToolbarV4
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
            onAcceptPrediction={() => setHasPrediction(false)}
            onRejectPrediction={() => setHasPrediction(false)}
            canUndo={true}
            canRedo={false}
            onUndo={() => {}}
            onRedo={() => {}}
            onDeleteSlice={() => {}}
            onInterpolate={() => {}}
            onDeleteNth={() => {}}
            onSmooth={() => {}}
            onClearAll={() => {}}
            onClearAbove={() => {}}
            onClearBelow={() => {}}
            onOpenBlobTools={() => {}}
            onOpenMarginTool={() => {}}
            onStructureNameChange={setStructureName}
            onStructureColorChange={(hex) => setStructureColor(hexToRgb(hex))}
            onClose={() => setIsVisible(false)}
            onAiTumorGenerate={() => {}}
            onAiTumorClear={() => {}}
            aiTumorSmoothOutput={aiSmooth}
            onAiTumorSmoothChange={setAiSmooth}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
