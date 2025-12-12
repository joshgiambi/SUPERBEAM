/**
 * V4 Aurora Panels Prototype
 * 
 * Unified design system panels:
 * - Boolean Operations Panel
 * - Margin Operations Panel
 * - Bottom Toolbar (Viewport Controls)
 * 
 * All using the V4 Aurora design language.
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
  Plus,
  Minus,
  X,
  ChevronDown,
  Play,
  Layers,
  Grid3x3,
  Expand,
  Shrink,
  GripVertical,
  RotateCcw,
  Eye,
  EyeOff,
  Maximize2,
  ZoomIn,
  ZoomOut,
  SunMedium,
  Crosshair,
  Move,
  Ruler,
  MousePointer,
  RotateCw,
  FlipHorizontal,
  Save,
  MoreHorizontal,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Box,
  Highlighter,
  SquaresSubtract,
  Undo,
  Redo,
} from 'lucide-react';

// ============================================================================
// SHARED HELPERS
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

// Draggable hook
function useDraggable(storageKey: string, initialPosition: Position = { x: 0, y: 0 }) {
  const [position, setPosition] = useState<Position>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : initialPosition;
    } catch { return initialPosition; }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    }
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      setPosition({
        x: dragStart.current.posX + (e.clientX - dragStart.current.x),
        y: dragStart.current.posY + (e.clientY - dragStart.current.y),
      });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStart.current = null;
      try { localStorage.setItem(storageKey, JSON.stringify(position)); } catch {}
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, storageKey]);

  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    try { localStorage.setItem(storageKey, JSON.stringify({ x: 0, y: 0 })); } catch {}
  }, [storageKey]);

  return { position, isDragging, handleMouseDown, resetPosition };
}

// ============================================================================
// BOOLEAN OPERATIONS PANEL
// ============================================================================

interface BooleanPanelProps {
  availableStructures: Array<{ name: string; color: number[] }>;
  onExecute?: (op: { operation: string; structureA: string; structureB: string; outputName: string; outputColor: string }) => void;
  onClose?: () => void;
}

export function BooleanPanelV4({ availableStructures, onExecute, onClose }: BooleanPanelProps) {
  const [operation, setOperation] = useState<'union' | 'subtract' | 'intersect'>('union');
  const [structureA, setStructureA] = useState<string>('');
  const [structureB, setStructureB] = useState<string>('');
  const [outputName, setOutputName] = useState('');
  const [outputColor, setOutputColor] = useState('#3B82F6');

  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable('boolean-panel-v4-pos');

  // Accent color based on operation type
  const accentColor = useMemo(() => {
    switch (operation) {
      case 'union': return { rgb: 'rgb(34, 197, 94)', hue: 142 }; // green
      case 'subtract': return { rgb: 'rgb(239, 68, 68)', hue: 0 }; // red
      case 'intersect': return { rgb: 'rgb(168, 85, 247)', hue: 270 }; // purple
    }
  }, [operation]);

  const operations = [
    { id: 'union', icon: Plus, label: 'Union', symbol: '∪', desc: 'A + B' },
    { id: 'subtract', icon: Minus, label: 'Subtract', symbol: '−', desc: 'A − B' },
    { id: 'intersect', icon: Grid3x3, label: 'Intersect', symbol: '∩', desc: 'A ∩ B' },
  ];

  const handleExecute = () => {
    if (!structureA || !structureB || !outputName) return;
    onExecute?.({ operation, structureA, structureB, outputName, outputColor });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn("fixed z-50 select-none", isDragging && "cursor-grabbing")}
        style={{
          left: `calc(50% + ${position.x}px)`,
          bottom: `calc(96px - ${position.y}px)`,
          transform: 'translateX(-50%)',
        }}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={cn("rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl", isDragging && "ring-2")}
          style={{
            background: `linear-gradient(180deg, hsla(${accentColor.hue}, 12%, 13%, 0.97) 0%, hsla(${accentColor.hue}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentColor.rgb}20, 0 0 60px -15px ${accentColor.rgb}20`,
            ...(isDragging ? { ringColor: `${accentColor.rgb}40` } : {}),
          }}
        >
          {/* Header Row */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div 
              data-drag-handle
              className="flex items-center justify-center w-6 h-7 cursor-grab active:cursor-grabbing rounded transition-all hover:bg-white/5"
              style={{ color: `${accentColor.rgb}50` }}
            >
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="w-px h-6 bg-white/10" />

            <Layers className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-white">Boolean</span>

            <div className="w-px h-6 bg-white/10" />

            {/* Operation Selector */}
            <div className="flex items-center gap-0.5">
              {operations.map((op) => {
                const isActive = operation === op.id;
                const OpIcon = op.icon;
                return (
                  <Tooltip key={op.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setOperation(op.id as any)}
                        className={cn(
                          'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                          isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        )}
                        style={isActive ? {
                          background: `${accentColor.rgb}20`,
                          boxShadow: `inset 0 0 0 1px ${accentColor.rgb}30`,
                        } : {}}
                      >
                        <OpIcon className="w-3.5 h-3.5" style={isActive ? { color: accentColor.rgb } : {}} />
                        <span>{op.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                      {op.desc}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            <div className="flex-1" />

            <button onClick={resetPosition} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Input Row */}
          <div className="flex items-center gap-3 px-3 py-2" style={{ background: `hsla(${accentColor.hue}, 6%, 8%, 1)` }}>
            {/* Structure A */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold w-4">A</span>
              <select
                value={structureA}
                onChange={(e) => setStructureA(e.target.value)}
                className="h-7 bg-white/5 border border-white/10 text-white text-xs rounded-md px-2 min-w-[120px] focus:outline-none focus:border-white/30"
              >
                <option value="" className="bg-gray-900">Select...</option>
                {availableStructures.map(s => (
                  <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
                ))}
              </select>
            </div>

            {/* Operation Symbol */}
            <span className="text-lg font-light" style={{ color: accentColor.rgb }}>
              {operations.find(o => o.id === operation)?.symbol}
            </span>

            {/* Structure B */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold w-4">B</span>
              <select
                value={structureB}
                onChange={(e) => setStructureB(e.target.value)}
                className="h-7 bg-white/5 border border-white/10 text-white text-xs rounded-md px-2 min-w-[120px] focus:outline-none focus:border-white/30"
              >
                <option value="" className="bg-gray-900">Select...</option>
                {availableStructures.map(s => (
                  <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
                ))}
              </select>
            </div>

            <span className="text-gray-600">=</span>

            {/* Output */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={outputColor}
                onChange={(e) => setOutputColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0"
                style={{ boxShadow: `0 0 10px -2px ${outputColor}60` }}
              />
              <Input
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="Output name"
                className="h-7 w-32 px-2 text-xs bg-white/5 border-white/10 text-white rounded-md"
              />
            </div>

            <div className="flex-1" />

            {/* Execute */}
            <button
              onClick={handleExecute}
              disabled={!structureA || !structureB || !outputName}
              className={cn(
                "h-7 px-4 flex items-center gap-2 rounded-md text-xs font-semibold transition-all",
                structureA && structureB && outputName
                  ? "text-white"
                  : "text-gray-600 cursor-not-allowed"
              )}
              style={structureA && structureB && outputName ? {
                background: accentColor.rgb,
                boxShadow: `0 4px 15px -3px ${accentColor.rgb}50`,
              } : { background: 'rgba(255,255,255,0.05)' }}
            >
              <Play className="w-3 h-3" />
              Run
            </button>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

// ============================================================================
// MARGIN OPERATIONS PANEL
// ============================================================================

interface MarginPanelProps {
  availableStructures: Array<{ name: string; color: number[] }>;
  onExecute?: (op: { structureName: string; marginMm: number; direction: 'expand' | 'shrink'; outputName: string; outputColor: string; outputMode: 'new' | 'same' }) => void;
  onClose?: () => void;
}

export function MarginPanelV4({ availableStructures, onExecute, onClose }: MarginPanelProps) {
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [direction, setDirection] = useState<'expand' | 'shrink'>('expand');
  const [marginMm, setMarginMm] = useState(5);
  const [outputMode, setOutputMode] = useState<'new' | 'same'>('new');
  const [outputName, setOutputName] = useState('');
  const [outputColor, setOutputColor] = useState('#FF6B6B');

  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable('margin-panel-v4-pos');

  // Get selected structure color for accent
  const selectedStructureData = availableStructures.find(s => s.name === selectedStructure);
  const accentRgb = selectedStructureData ? `rgb(${selectedStructureData.color.join(',')})` : 'rgb(59, 130, 246)';
  const [accentHue] = selectedStructureData ? rgbToHsl(selectedStructureData.color[0], selectedStructureData.color[1], selectedStructureData.color[2]) : [210, 0, 0];

  const handleExecute = () => {
    if (!selectedStructure) return;
    if (outputMode === 'new' && !outputName) return;
    onExecute?.({
      structureName: selectedStructure,
      marginMm,
      direction,
      outputName: outputMode === 'same' ? selectedStructure : outputName,
      outputColor,
      outputMode,
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn("fixed z-50 select-none", isDragging && "cursor-grabbing")}
        style={{
          left: `calc(50% + ${position.x}px)`,
          bottom: `calc(96px - ${position.y}px)`,
          transform: 'translateX(-50%)',
        }}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={cn("rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl", isDragging && "ring-2")}
          style={{
            background: `linear-gradient(180deg, hsla(${accentHue}, 12%, 13%, 0.97) 0%, hsla(${accentHue}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentRgb}20, 0 0 60px -15px ${accentRgb}20`,
            ...(isDragging ? { ringColor: `${accentRgb}40` } : {}),
          }}
        >
          {/* Header Row */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div 
              data-drag-handle
              className="flex items-center justify-center w-6 h-7 cursor-grab active:cursor-grabbing rounded transition-all hover:bg-white/5"
              style={{ color: `${accentRgb}50` }}
            >
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="w-px h-6 bg-white/10" />

            <Expand className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-white">Margin</span>

            <div className="w-px h-6 bg-white/10" />

            {/* Structure Selector */}
            <select
              value={selectedStructure}
              onChange={(e) => setSelectedStructure(e.target.value)}
              className="h-7 bg-white/5 border border-white/10 text-white text-xs rounded-md px-2 min-w-[140px] focus:outline-none focus:border-white/30"
            >
              <option value="" className="bg-gray-900">Select structure...</option>
              {availableStructures.map(s => (
                <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
              ))}
            </select>

            <div className="w-px h-6 bg-white/10" />

            {/* Direction Toggle */}
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDirection('expand')}
                    className={cn(
                      'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                      direction === 'expand' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    )}
                    style={direction === 'expand' ? {
                      background: 'rgba(34, 197, 94, 0.2)',
                      boxShadow: 'inset 0 0 0 1px rgba(34, 197, 94, 0.3)',
                    } : {}}
                  >
                    <Expand className="w-3.5 h-3.5" style={direction === 'expand' ? { color: 'rgb(34, 197, 94)' } : {}} />
                    Expand
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Add margin</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDirection('shrink')}
                    className={cn(
                      'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                      direction === 'shrink' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    )}
                    style={direction === 'shrink' ? {
                      background: 'rgba(239, 68, 68, 0.2)',
                      boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.3)',
                    } : {}}
                  >
                    <Shrink className="w-3.5 h-3.5" style={direction === 'shrink' ? { color: 'rgb(239, 68, 68)' } : {}} />
                    Shrink
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Subtract margin</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex-1" />

            <button onClick={resetPosition} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Settings Row */}
          <div className="flex items-center gap-3 px-3 py-2" style={{ background: `hsla(${accentHue}, 6%, 8%, 1)` }}>
            {/* Margin Slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Margin</span>
              <Slider
                value={[marginMm]}
                onValueChange={([val]) => setMarginMm(val)}
                max={50}
                min={1}
                step={1}
                className="w-28 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
              />
              <span className="text-sm font-semibold tabular-nums min-w-[45px]" style={{ color: accentRgb }}>
                {marginMm}<span className="text-xs font-normal text-gray-500 ml-0.5">mm</span>
              </span>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Output Mode */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Output</span>
              <button
                onClick={() => setOutputMode('same')}
                className={cn(
                  'h-6 px-2 rounded text-[11px] font-medium transition-all',
                  outputMode === 'same' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                Same
              </button>
              <button
                onClick={() => setOutputMode('new')}
                className={cn(
                  'h-6 px-2 rounded text-[11px] font-medium transition-all',
                  outputMode === 'new' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                New
              </button>
            </div>

            {/* New Structure Options */}
            <AnimatePresence>
              {outputMode === 'new' && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <input
                    type="color"
                    value={outputColor}
                    onChange={(e) => setOutputColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0"
                    style={{ boxShadow: `0 0 10px -2px ${outputColor}60` }}
                  />
                  <Input
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="New name"
                    className="h-6 w-24 px-2 text-xs bg-white/5 border-white/10 text-white rounded"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1" />

            {/* Execute */}
            <button
              onClick={handleExecute}
              disabled={!selectedStructure || (outputMode === 'new' && !outputName)}
              className={cn(
                "h-7 px-4 flex items-center gap-2 rounded-md text-xs font-semibold transition-all",
                selectedStructure && (outputMode === 'same' || outputName)
                  ? "text-white"
                  : "text-gray-600 cursor-not-allowed"
              )}
              style={selectedStructure && (outputMode === 'same' || outputName) ? {
                background: accentRgb,
                boxShadow: `0 4px 15px -3px ${accentRgb}50`,
              } : { background: 'rgba(255,255,255,0.05)' }}
            >
              <Play className="w-3 h-3" />
              Apply
            </button>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

// ============================================================================
// MAIN BOTTOM TOOLBAR (Always Visible - Different Layer Styling)
// This toolbar is always visible at the bottom of the viewer
// Uses a LIGHTER/MORE TRANSLUCENT style to contrast with the dark contour toolbar
// ============================================================================

interface MainBottomToolbarProps {
  activeTool?: string;
  onToolChange?: (tool: string) => void;
  // Contour mode
  isContourEditActive?: boolean;
  onContourEditToggle?: () => void;
  // Boolean mode
  isBooleanActive?: boolean;
  onBooleanToggle?: () => void;
  // Margin mode
  isMarginActive?: boolean;
  onMarginToggle?: () => void;
  // Undo/Redo
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  // Other actions
  onMPRToggle?: () => void;
  isMPRActive?: boolean;
  onFusionToggle?: () => void;
  isFusionActive?: boolean;
}

export function MainBottomToolbarV4({
  activeTool = 'pan',
  onToolChange,
  isContourEditActive = false,
  onContourEditToggle,
  isBooleanActive = false,
  onBooleanToggle,
  isMarginActive = false,
  onMarginToggle,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onMPRToggle,
  isMPRActive = false,
  onFusionToggle,
  isFusionActive = false,
}: MainBottomToolbarProps) {
  // Tool definitions
  const viewTools = [
    { id: 'zoom-in', icon: ZoomIn, label: 'Zoom In', action: true },
    { id: 'zoom-out', icon: ZoomOut, label: 'Zoom Out', action: true },
    { id: 'fit', icon: Maximize2, label: 'Fit to Window', action: true },
  ];

  const interactionTools = [
    { id: 'pan', icon: Move, label: 'Pan', selectable: true },
    { id: 'crosshair', icon: Crosshair, label: 'Crosshairs', selectable: true },
    { id: 'measure', icon: Ruler, label: 'Measure', selectable: true },
  ];

  const viewModes = [
    { id: 'mpr', icon: Grid3x3, label: 'MPR View', active: isMPRActive, onToggle: onMPRToggle, color: 'emerald' },
    { id: 'fusion', icon: Layers, label: 'Fusion', active: isFusionActive, onToggle: onFusionToggle, color: 'cyan' },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      {/* Fixed bottom toolbar - always visible */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center py-3 px-4"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(20, 24, 33, 0.7) 30%, rgba(20, 24, 33, 0.9) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* ===== LEFT GROUP: Contour/Boolean/Margin ===== */}
          <div 
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onContourEditToggle}
                  className={cn(
                    'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                    isContourEditActive 
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Highlighter className="w-4 h-4" />
                  <span>Contour</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Edit Contours</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onBooleanToggle}
                  className={cn(
                    'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                    isBooleanActive 
                      ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <SquaresSubtract className="w-4 h-4" />
                  <span>Boolean</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Boolean Operations</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onMarginToggle}
                  className={cn(
                    'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                    isMarginActive 
                      ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Expand className="w-4 h-4" />
                  <span>Margin</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Margin Tool</TooltipContent>
            </Tooltip>
          </div>

          {/* ===== CENTER GROUP: View & Interaction Tools ===== */}
          <div 
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {/* View Tools */}
            {viewTools.map((tool) => {
              const ToolIcon = tool.icon;
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onToolChange?.(tool.id)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <ToolIcon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">{tool.label}</TooltipContent>
                </Tooltip>
              );
            })}

            <div className="w-px h-5 bg-white/20 mx-1" />

            {/* Interaction Tools */}
            {interactionTools.map((tool) => {
              const ToolIcon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onToolChange?.(tool.id)}
                      className={cn(
                        'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                        isActive 
                          ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40' 
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <ToolIcon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">{tool.label}</TooltipContent>
                </Tooltip>
              );
            })}

            <div className="w-px h-5 bg-white/20 mx-1" />

            {/* View Modes */}
            {viewModes.map((mode) => {
              const ModeIcon = mode.icon;
              return (
                <Tooltip key={mode.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={mode.onToggle}
                      className={cn(
                        'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                        mode.active 
                          ? mode.color === 'emerald' 
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <ModeIcon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">{mode.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* ===== RIGHT GROUP: Undo/Redo ===== */}
          <div 
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={cn(
                    'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                    canUndo 
                      ? 'text-white/70 hover:text-white hover:bg-white/10' 
                      : 'text-white/30 cursor-not-allowed'
                  )}
                >
                  <Undo className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Undo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={cn(
                    'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                    canRedo 
                      ? 'text-white/70 hover:text-white hover:bg-white/10' 
                      : 'text-white/30 cursor-not-allowed'
                  )}
                >
                  <Redo className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Redo</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// DEMO PAGE
// ============================================================================

export function V4AuroraPanelsPrototype() {
  const [activePanel, setActivePanel] = useState<'boolean' | 'margin' | 'bottom' | null>('bottom');
  const [activeTool, setActiveTool] = useState('pan');
  const [isContourEditActive, setIsContourEditActive] = useState(false);
  const [isBooleanActive, setIsBooleanActive] = useState(false);
  const [isMarginActive, setIsMarginActive] = useState(false);
  const [isMPRActive, setIsMPRActive] = useState(false);
  const [isFusionActive, setIsFusionActive] = useState(false);
  const [canUndo, setCanUndo] = useState(true);
  const [canRedo, setCanRedo] = useState(false);

  const mockStructures = [
    { name: 'GTV', color: [255, 100, 100] },
    { name: 'CTV', color: [255, 180, 80] },
    { name: 'PTV', color: [80, 180, 255] },
    { name: 'Brainstem', color: [180, 100, 255] },
    { name: 'SpinalCord', color: [100, 255, 160] },
    { name: 'Parotid_L', color: [255, 130, 180] },
    { name: 'Parotid_R', color: [180, 255, 130] },
  ];

  return (
    <div className="space-y-6 p-8 min-h-screen bg-[#0a0a0e]">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <Layers className="w-5 h-5 text-purple-400" />
            V4 Aurora Panels
          </CardTitle>
          <CardDescription className="text-gray-400">
            Boolean Operations • Margin Operations • Main Bottom Toolbar (Lighter Glass Style)
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">Active Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'boolean', label: 'Boolean Panel' },
              { id: 'margin', label: 'Margin Panel' },
              { id: 'bottom', label: 'Main Bottom Toolbar' },
              { id: null, label: 'None' },
            ].map((panel) => (
              <button
                key={panel.id || 'none'}
                onClick={() => setActivePanel(panel.id as any)}
                className={cn(
                  'px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all',
                  activePanel === panel.id
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-lg'
                    : 'border-gray-800 bg-gray-900/50 text-gray-500 hover:border-gray-700'
                )}
              >
                {panel.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <div className="rounded-xl border border-gray-800 h-[500px] relative flex items-center justify-center bg-[#080810] overflow-hidden">
            <span className="text-gray-700 text-sm">DICOM Viewport</span>
            
            {/* State indicators */}
            <div className="absolute top-3 left-3 text-[10px] text-gray-600 space-y-1">
              <div>Tool: {activeTool}</div>
              <div>MPR: {isMPRActive ? 'On' : 'Off'} | Fusion: {isFusionActive ? 'On' : 'Off'}</div>
              <div>Contour Edit: {isContourEditActive ? 'Active' : 'Off'}</div>
            </div>

            {/* Note about bottom toolbar */}
            {activePanel === 'bottom' && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 text-center">
                ↓ Main Bottom Toolbar (lighter glass style - always visible)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Floating Panels (Boolean & Margin) */}
      <AnimatePresence>
        {activePanel === 'boolean' && (
          <BooleanPanelV4
            availableStructures={mockStructures}
            onExecute={(op) => console.log('Boolean execute:', op)}
            onClose={() => setActivePanel(null)}
          />
        )}
        
        {activePanel === 'margin' && (
          <MarginPanelV4
            availableStructures={mockStructures}
            onExecute={(op) => console.log('Margin execute:', op)}
            onClose={() => setActivePanel(null)}
          />
        )}
      </AnimatePresence>

      {/* Main Bottom Toolbar */}
      {activePanel === 'bottom' && (
        <MainBottomToolbarV4
          activeTool={activeTool}
          onToolChange={setActiveTool}
          isContourEditActive={isContourEditActive}
          onContourEditToggle={() => setIsContourEditActive(!isContourEditActive)}
          isBooleanActive={isBooleanActive}
          onBooleanToggle={() => setIsBooleanActive(!isBooleanActive)}
          isMarginActive={isMarginActive}
          onMarginToggle={() => setIsMarginActive(!isMarginActive)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => console.log('Undo')}
          onRedo={() => console.log('Redo')}
          isMPRActive={isMPRActive}
          onMPRToggle={() => setIsMPRActive(!isMPRActive)}
          isFusionActive={isFusionActive}
          onFusionToggle={() => setIsFusionActive(!isFusionActive)}
        />
      )}
    </div>
  );
}

