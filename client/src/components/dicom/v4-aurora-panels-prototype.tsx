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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  ArrowLeftRight,
  Palette,
  Check,
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

// ============================================================================
// PREDEFINED STRUCTURE COLORS (Medical/RT Standard)
// ============================================================================

const PRESET_COLORS = [
  // Row 1 - Primary colors
  '#FF0000', '#FF6B6B', '#FF8C00', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF69B4',
  // Row 2 - Secondary/Muted
  '#E74C3C', '#F39C12', '#27AE60', '#3498DB', '#8E44AD', '#E91E63', '#00BCD4', '#CDDC39',
  // Row 3 - Dark/Professional
  '#C0392B', '#D35400', '#16A085', '#2980B9', '#7B1FA2', '#AD1457', '#0097A7', '#689F38',
  // Row 4 - Pastel/Light
  '#FFCDD2', '#FFE0B2', '#C8E6C9', '#B3E5FC', '#E1BEE7', '#F8BBD9', '#B2EBF2', '#DCEDC8',
];

// ============================================================================
// COLOR PICKER POPOVER COMPONENT
// ============================================================================

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  accentHue?: number;
}

function ColorPickerPopover({ color, onChange, label = 'Color', accentHue = 210 }: ColorPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(color);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomColor(color);
  }, [color]);

  const handlePresetClick = (preset: string) => {
    onChange(preset);
    setIsOpen(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 h-7 px-2 rounded-lg transition-all hover:bg-white/10 group"
          style={{
            background: isOpen ? `hsla(${accentHue}, 20%, 20%, 0.5)` : 'transparent',
            border: `1px solid ${isOpen ? `hsla(${accentHue}, 60%, 50%, 0.4)` : 'rgba(255,255,255,0.15)'}`,
          }}
        >
          <div 
            className="w-5 h-5 rounded-md border border-white/30 shadow-inner transition-transform group-hover:scale-105"
            style={{ 
              backgroundColor: color,
              boxShadow: `0 0 8px -2px ${color}60, inset 0 1px 2px rgba(255,255,255,0.1)`,
            }}
          />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</span>
          <ChevronDown className={cn("w-3 h-3 text-gray-500 transition-transform", isOpen && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 bg-transparent border-0 shadow-none"
        side="top" 
        sideOffset={8}
        align="start"
      >
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl overflow-hidden backdrop-blur-xl"
          style={{
            background: `linear-gradient(180deg, hsla(${accentHue}, 15%, 12%, 0.98) 0%, hsla(${accentHue}, 10%, 8%, 0.99) 100%)`,
            boxShadow: `0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px -15px ${color}30`,
          }}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-300">Choose Color</span>
            </div>
            <div 
              className="w-6 h-6 rounded-md border border-white/20"
              style={{ backgroundColor: color }}
            />
          </div>

          {/* Preset Colors Grid */}
          <div className="p-3">
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-7 h-7 rounded-md border transition-all hover:scale-110 hover:z-10 relative group/swatch",
                    color.toLowerCase() === preset.toLowerCase()
                      ? "border-white ring-2 ring-white/30 scale-105"
                      : "border-white/20 hover:border-white/40"
                  )}
                  style={{ 
                    backgroundColor: preset,
                    boxShadow: color.toLowerCase() === preset.toLowerCase() 
                      ? `0 0 12px -2px ${preset}80` 
                      : `0 2px 4px -2px rgba(0,0,0,0.4)`,
                  }}
                  title={preset}
                >
                  {color.toLowerCase() === preset.toLowerCase() && (
                    <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Color Section */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.06]">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="color"
                  value={customColor}
                  onChange={handleCustomChange}
                  className="w-8 h-8 rounded-md cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/30"
                />
              </div>
              <div className="flex-1">
                <Input
                  value={customColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setCustomColor(val);
                      if (val.length === 7) onChange(val);
                    }
                  }}
                  className="h-7 px-2 text-xs font-mono bg-white/5 border-white/10 text-white rounded-md uppercase"
                  placeholder="#FFFFFF"
                />
              </div>
              <span className="text-[9px] text-gray-500 uppercase">Custom</span>
            </div>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

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
        try { localStorage.setItem(storageKey, JSON.stringify(positionRef.current)); } catch {}
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
  }, [isDragging, storageKey]);

  const resetPosition = useCallback(() => {
    const newPos = { x: 0, y: 0 };
    setPosition(newPos);
    positionRef.current = newPos;
    try { localStorage.setItem(storageKey, JSON.stringify(newPos)); } catch {}
  }, [storageKey]);

  return { position, isDragging, handleMouseDown, resetPosition };
}

// ============================================================================
// BOOLEAN OPERATIONS PANEL
// ============================================================================

interface BooleanPanelProps {
  availableStructures: Array<{ name: string; color: number[] }>;
  onExecute?: (op: { 
    operation: string; 
    structureA: string; 
    structureB: string; 
    outputMode: 'existing' | 'new';
    outputName: string; 
    outputColor: string;
    saveAsSuperstructure?: boolean;
  }) => void;
  onPreview?: (op: { 
    operation: string; 
    structureA: string; 
    structureB: string; 
    outputName: string; 
    outputColor: string;
  }) => void;
  onClose?: () => void;
}

export function BooleanPanelV4({ availableStructures, onExecute, onPreview, onClose }: BooleanPanelProps) {
  const [operation, setOperation] = useState<'union' | 'subtract' | 'intersect' | 'xor'>('union');
  const [structureA, setStructureA] = useState<string>('');
  const [structureB, setStructureB] = useState<string>('');
  const [outputMode, setOutputMode] = useState<'existing' | 'new'>('new');
  const [outputExisting, setOutputExisting] = useState<string>('');
  const [outputName, setOutputName] = useState('');
  const [outputColor, setOutputColor] = useState('#3B82F6');
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(true);
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable('boolean-panel-v4-pos');

  // Get structure colors for display
  const getStructureColor = (name: string) => {
    const struct = availableStructures.find(s => s.name === name);
    return struct ? `rgb(${struct.color.join(',')})` : 'rgb(128,128,128)';
  };

  // Accent color based on operation type
  const accentColor = useMemo(() => {
    switch (operation) {
      case 'union': return { rgb: 'rgb(34, 197, 94)', hue: 142 }; // green
      case 'subtract': return { rgb: 'rgb(239, 68, 68)', hue: 0 }; // red
      case 'intersect': return { rgb: 'rgb(168, 85, 247)', hue: 270 }; // purple
      case 'xor': return { rgb: 'rgb(234, 179, 8)', hue: 45 }; // yellow
    }
  }, [operation]);

  const operations = [
    { id: 'union', icon: Plus, label: 'Union', symbol: '∪', desc: 'A + B', color: 'rgb(34, 197, 94)' },
    { id: 'subtract', icon: Minus, label: 'Subtract', symbol: '−', desc: 'A − B', color: 'rgb(239, 68, 68)' },
    { id: 'intersect', icon: Grid3x3, label: 'Intersect', symbol: '∩', desc: 'A ∩ B', color: 'rgb(168, 85, 247)' },
    { id: 'xor', icon: X, label: 'XOR', symbol: '⊕', desc: 'A ⊕ B', color: 'rgb(234, 179, 8)' },
  ];

  const canExecute = structureA && structureB && (outputMode === 'existing' ? outputExisting : outputName);

  const handleExecute = () => {
    if (!canExecute) return;
    onExecute?.({ 
      operation, 
      structureA, 
      structureB, 
      outputMode,
      outputName: outputMode === 'existing' ? outputExisting : outputName, 
      outputColor,
      saveAsSuperstructure,
    });
    setIsPreviewActive(false);
  };

  const handlePreview = () => {
    if (!structureA || !structureB) return;
    const targetName = outputMode === 'existing' ? outputExisting : (outputName || 'Preview');
    onPreview?.({ operation, structureA, structureB, outputName: targetName, outputColor });
    setIsPreviewActive(true);
  };

  const handleSwapStructures = () => {
    const temp = structureA;
    setStructureA(structureB);
    setStructureB(temp);
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
          className={cn("rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl min-w-[720px]", isDragging && "ring-2")}
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
            <span className="text-sm font-semibold text-white">Boolean Operations</span>

            <div className="w-px h-6 bg-white/10" />

            {/* Operation Selector */}
            <div className="flex items-center gap-0.5 bg-black/20 rounded-lg p-0.5">
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
                          background: `${op.color}25`,
                          boxShadow: `inset 0 0 0 1px ${op.color}40`,
                        } : {}}
                      >
                        <OpIcon className="w-3.5 h-3.5" style={isActive ? { color: op.color } : {}} />
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

            {/* Superstructure Toggle */}
            <div 
              onClick={() => setSaveAsSuperstructure(!saveAsSuperstructure)}
              className={cn(
                "flex items-center gap-1.5 h-7 px-2.5 rounded-lg transition-all cursor-pointer border",
                saveAsSuperstructure
                  ? "bg-purple-600/20 border-purple-400/50 text-purple-200"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              )}
            >
              <Switch
                checked={saveAsSuperstructure}
                onCheckedChange={setSaveAsSuperstructure}
                className="scale-75"
              />
              <span className="text-[10px] font-medium whitespace-nowrap">Auto-Update</span>
            </div>

            <button onClick={resetPosition} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Input Row */}
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: `hsla(${accentColor.hue}, 6%, 8%, 1)` }}>
            {/* Structure A */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]">
              <div 
                className="w-2.5 h-2.5 rounded-full border border-white/30"
                style={{ backgroundColor: structureA ? getStructureColor(structureA) : 'transparent' }}
              />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">A</span>
              <select
                value={structureA}
                onChange={(e) => setStructureA(e.target.value)}
                className="h-7 bg-transparent border-0 text-white text-xs rounded-md px-1 min-w-[110px] focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-gray-900">Select...</option>
                {availableStructures.map(s => (
                  <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSwapStructures}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Swap A ↔ B</TooltipContent>
            </Tooltip>

            {/* Operation Symbol */}
            <span className="text-xl font-light px-1" style={{ color: accentColor.rgb }}>
              {operations.find(o => o.id === operation)?.symbol}
            </span>

            {/* Structure B */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]">
              <div 
                className="w-2.5 h-2.5 rounded-full border border-white/30"
                style={{ backgroundColor: structureB ? getStructureColor(structureB) : 'transparent' }}
              />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">B</span>
              <select
                value={structureB}
                onChange={(e) => setStructureB(e.target.value)}
                className="h-7 bg-transparent border-0 text-white text-xs rounded-md px-1 min-w-[110px] focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-gray-900">Select...</option>
                {availableStructures.map(s => (
                  <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
                ))}
              </select>
            </div>

            <span className="text-gray-600 text-lg">=</span>

            {/* Output Mode Toggle */}
            <div className="flex items-center bg-black/20 rounded-lg border border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setOutputMode('existing')}
                className={cn(
                  "px-2 h-7 text-[10px] font-medium transition-all",
                  outputMode === 'existing' 
                    ? "bg-white/10 text-white" 
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                Existing
              </button>
              <button
                onClick={() => setOutputMode('new')}
                className={cn(
                  "px-2 h-7 text-[10px] font-medium transition-all",
                  outputMode === 'new' 
                    ? "bg-white/10 text-white" 
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                New
              </button>
            </div>

            {/* Output Selection */}
            <AnimatePresence mode="wait">
              {outputMode === 'existing' ? (
                <motion.div
                  key="existing"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]"
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full border border-white/30"
                    style={{ backgroundColor: outputExisting ? getStructureColor(outputExisting) : 'transparent' }}
                  />
                  <select
                    value={outputExisting}
                    onChange={(e) => setOutputExisting(e.target.value)}
                    className="h-7 bg-transparent border-0 text-white text-xs rounded-md px-1 min-w-[100px] focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-gray-900">Select output...</option>
                    {availableStructures.map(s => (
                      <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
                    ))}
                  </select>
                </motion.div>
              ) : (
                <motion.div
                  key="new"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <ColorPickerPopover
                    color={outputColor}
                    onChange={setOutputColor}
                    accentHue={accentColor.hue}
                  />
                  <Input
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="New structure name"
                    className="h-7 w-36 px-2 text-xs bg-black/20 border-white/10 text-white rounded-lg placeholder:text-gray-600"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1" />

            {/* Preview Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handlePreview}
                  disabled={!structureA || !structureB}
                  className={cn(
                    "h-7 px-3 flex items-center gap-1.5 rounded-md text-xs font-medium transition-all border",
                    isPreviewActive
                      ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-200"
                      : structureA && structureB
                        ? "bg-yellow-900/20 border-yellow-600/40 text-yellow-300 hover:bg-yellow-900/30"
                        : "bg-white/5 border-white/10 text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Eye className={cn("w-3 h-3", isPreviewActive && "animate-pulse")} />
                  Preview
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                Preview operation result
              </TooltipContent>
            </Tooltip>

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={!canExecute}
              className={cn(
                "h-7 px-4 flex items-center gap-2 rounded-lg text-xs font-semibold transition-all",
                canExecute
                  ? "text-white shadow-lg"
                  : "text-gray-600 cursor-not-allowed bg-white/5"
              )}
              style={canExecute ? {
                background: `linear-gradient(135deg, ${accentColor.rgb} 0%, ${accentColor.rgb}CC 100%)`,
                boxShadow: `0 4px 15px -3px ${accentColor.rgb}50`,
              } : {}}
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
// MARGIN OPERATIONS PANEL
// ============================================================================

interface MarginPanelProps {
  availableStructures: Array<{ name: string; color: number[] }>;
  onExecute?: (op: { 
    structureName: string; 
    marginMm: number; 
    direction: 'expand' | 'shrink'; 
    outputMode: 'same' | 'different' | 'new';
    outputName: string; 
    outputColor: string;
  }) => void;
  onPreview?: (op: { 
    structureName: string; 
    marginMm: number; 
    direction: 'expand' | 'shrink'; 
    outputName: string; 
    outputColor: string;
  }) => void;
  onClose?: () => void;
}

export function MarginPanelV4({ availableStructures, onExecute, onPreview, onClose }: MarginPanelProps) {
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [direction, setDirection] = useState<'expand' | 'shrink'>('expand');
  const [marginMm, setMarginMm] = useState(10);
  const [outputMode, setOutputMode] = useState<'same' | 'different' | 'new'>('same');
  const [outputDifferent, setOutputDifferent] = useState<string>('');
  const [outputName, setOutputName] = useState('');
  const [outputColor, setOutputColor] = useState('#22C55E');
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable('margin-panel-v4-pos');

  // Get structure color for display
  const getStructureColor = (name: string) => {
    const struct = availableStructures.find(s => s.name === name);
    return struct ? `rgb(${struct.color.join(',')})` : 'rgb(128,128,128)';
  };

  // Get selected structure color for accent
  const selectedStructureData = availableStructures.find(s => s.name === selectedStructure);
  const accentRgb = selectedStructureData ? `rgb(${selectedStructureData.color.join(',')})` : 'rgb(59, 130, 246)';
  const [accentHue] = selectedStructureData ? rgbToHsl(selectedStructureData.color[0], selectedStructureData.color[1], selectedStructureData.color[2]) : [210, 0, 0];

  // Direction-based accent color
  const directionColor = direction === 'expand' 
    ? { rgb: 'rgb(34, 197, 94)', hue: 142 }
    : { rgb: 'rgb(239, 68, 68)', hue: 0 };

  const canExecute = selectedStructure && (
    outputMode === 'same' || 
    (outputMode === 'different' && outputDifferent) ||
    (outputMode === 'new' && outputName)
  );

  const handleExecute = () => {
    if (!canExecute) return;
    const targetName = outputMode === 'same' 
      ? selectedStructure 
      : outputMode === 'different' 
        ? outputDifferent 
        : outputName;
    
    onExecute?.({
      structureName: selectedStructure,
      marginMm: direction === 'shrink' ? -marginMm : marginMm,
      direction,
      outputMode,
      outputName: targetName,
      outputColor,
    });
    setIsPreviewActive(false);
  };

  const handlePreview = () => {
    if (!selectedStructure) return;
    const targetName = outputMode === 'same' 
      ? selectedStructure 
      : outputMode === 'different' 
        ? outputDifferent 
        : (outputName || 'Preview');
    
    onPreview?.({
      structureName: selectedStructure,
      marginMm: direction === 'shrink' ? -marginMm : marginMm,
      direction,
      outputName: targetName,
      outputColor,
    });
    setIsPreviewActive(true);
  };

  // Auto-generate output name when creating new structure
  useEffect(() => {
    if (outputMode === 'new' && selectedStructure && !outputName) {
      const suffix = direction === 'expand' ? `+${marginMm}mm` : `-${marginMm}mm`;
      setOutputName(`${selectedStructure}_${suffix}`);
    }
  }, [selectedStructure, direction, marginMm, outputMode]);

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
          className={cn("rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl min-w-[680px]", isDragging && "ring-2")}
          style={{
            background: `linear-gradient(180deg, hsla(${directionColor.hue}, 12%, 13%, 0.97) 0%, hsla(${directionColor.hue}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${directionColor.rgb}20, 0 0 60px -15px ${directionColor.rgb}20`,
            ...(isDragging ? { ringColor: `${directionColor.rgb}40` } : {}),
          }}
        >
          {/* Header Row */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div 
              data-drag-handle
              className="flex items-center justify-center w-6 h-7 cursor-grab active:cursor-grabbing rounded transition-all hover:bg-white/5"
              style={{ color: `${directionColor.rgb}50` }}
            >
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="w-px h-6 bg-white/10" />

            <Expand className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-white">Margin Tool</span>

            <div className="w-px h-6 bg-white/10" />

            {/* Source Structure Selector */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]">
              <div 
                className="w-2.5 h-2.5 rounded-full border border-white/30"
                style={{ backgroundColor: selectedStructure ? getStructureColor(selectedStructure) : 'transparent' }}
              />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Source</span>
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="h-7 bg-transparent border-0 text-white text-xs rounded-md px-1 min-w-[120px] focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-gray-900">Select structure...</option>
                {availableStructures.map(s => (
                  <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
                ))}
              </select>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Direction Toggle */}
            <div className="flex items-center gap-0.5 bg-black/20 rounded-lg p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDirection('expand')}
                    className={cn(
                      'h-7 px-3 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                      direction === 'expand' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    )}
                    style={direction === 'expand' ? {
                      background: 'rgba(34, 197, 94, 0.25)',
                      boxShadow: 'inset 0 0 0 1px rgba(34, 197, 94, 0.4)',
                    } : {}}
                  >
                    <Expand className="w-3.5 h-3.5" style={direction === 'expand' ? { color: 'rgb(34, 197, 94)' } : {}} />
                    Expand
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Add margin (grow)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDirection('shrink')}
                    className={cn(
                      'h-7 px-3 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                      direction === 'shrink' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    )}
                    style={direction === 'shrink' ? {
                      background: 'rgba(239, 68, 68, 0.25)',
                      boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.4)',
                    } : {}}
                  >
                    <Shrink className="w-3.5 h-3.5" style={direction === 'shrink' ? { color: 'rgb(239, 68, 68)' } : {}} />
                    Shrink
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Subtract margin (contract)</TooltipContent>
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
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: `hsla(${directionColor.hue}, 6%, 8%, 1)` }}>
            {/* Margin Distance */}
            <div className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-1.5 border border-white/[0.06]">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Distance</span>
              <Slider
                value={[marginMm]}
                onValueChange={([val]) => setMarginMm(val)}
                max={30}
                min={1}
                step={0.5}
                className="w-32 [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-md"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={marginMm}
                  onChange={(e) => setMarginMm(parseFloat(e.target.value) || 0)}
                  className="h-7 w-16 px-2 text-xs text-center bg-black/30 border-white/10 text-white rounded-md font-mono"
                  step="0.5"
                  min="0"
                  max="50"
                />
                <span className="text-xs text-gray-500">mm</span>
              </div>
            </div>

            <div className="w-px h-8 bg-white/10" />

            {/* Output Mode Toggle */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Target</span>
              <div className="flex items-center bg-black/30 rounded-md overflow-hidden border border-white/[0.06]">
                <button
                  onClick={() => setOutputMode('same')}
                  className={cn(
                    'px-2 h-7 text-[10px] font-medium transition-all',
                    outputMode === 'same' 
                      ? 'bg-white/15 text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  Same
                </button>
                <button
                  onClick={() => setOutputMode('different')}
                  className={cn(
                    'px-2 h-7 text-[10px] font-medium transition-all',
                    outputMode === 'different' 
                      ? 'bg-white/15 text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  Existing
                </button>
                <button
                  onClick={() => setOutputMode('new')}
                  className={cn(
                    'px-2 h-7 text-[10px] font-medium transition-all flex items-center gap-1',
                    outputMode === 'new' 
                      ? 'bg-white/15 text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              </div>
            </div>

            {/* Output Selection based on mode */}
            <AnimatePresence mode="wait">
              {outputMode === 'different' && (
                <motion.div
                  key="different"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]"
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full border border-white/30"
                    style={{ backgroundColor: outputDifferent ? getStructureColor(outputDifferent) : 'transparent' }}
                  />
                  <select
                    value={outputDifferent}
                    onChange={(e) => setOutputDifferent(e.target.value)}
                    className="h-7 bg-transparent border-0 text-white text-xs rounded-md px-1 min-w-[100px] focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-gray-900">Select target...</option>
                    {availableStructures
                      .filter(s => s.name !== selectedStructure)
                      .map(s => (
                        <option key={s.name} value={s.name} className="bg-gray-900">{s.name}</option>
                      ))}
                  </select>
                </motion.div>
              )}
              
              {outputMode === 'new' && (
                <motion.div
                  key="new"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <ColorPickerPopover
                    color={outputColor}
                    onChange={setOutputColor}
                    accentHue={directionColor.hue}
                  />
                  <Input
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="New structure name"
                    className="h-7 w-40 px-2 text-xs bg-black/20 border-white/10 text-white rounded-lg placeholder:text-gray-600"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1" />

            {/* Preview Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handlePreview}
                  disabled={!selectedStructure}
                  className={cn(
                    "h-7 px-3 flex items-center gap-1.5 rounded-md text-xs font-medium transition-all border",
                    isPreviewActive
                      ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-200"
                      : selectedStructure
                        ? "bg-yellow-900/20 border-yellow-600/40 text-yellow-300 hover:bg-yellow-900/30"
                        : "bg-white/5 border-white/10 text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Eye className={cn("w-3 h-3", isPreviewActive && "animate-pulse")} />
                  Preview
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                Preview margin result
              </TooltipContent>
            </Tooltip>

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={!canExecute}
              className={cn(
                "h-7 px-4 flex items-center gap-2 rounded-lg text-xs font-semibold transition-all",
                canExecute
                  ? "text-white shadow-lg"
                  : "text-gray-600 cursor-not-allowed bg-white/5"
              )}
              style={canExecute ? {
                background: `linear-gradient(135deg, ${directionColor.rgb} 0%, ${directionColor.rgb}CC 100%)`,
                boxShadow: `0 4px 15px -3px ${directionColor.rgb}50`,
              } : {}}
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
  const [lastOperation, setLastOperation] = useState<string>('');

  const mockStructures = [
    { name: 'GTV', color: [255, 100, 100] },
    { name: 'CTV', color: [255, 180, 80] },
    { name: 'PTV', color: [80, 180, 255] },
    { name: 'Brainstem', color: [180, 100, 255] },
    { name: 'SpinalCord', color: [100, 255, 160] },
    { name: 'Parotid_L', color: [255, 130, 180] },
    { name: 'Parotid_R', color: [180, 255, 130] },
    { name: 'BODY', color: [128, 255, 255] },
    { name: 'Mandible', color: [255, 255, 100] },
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
            Boolean Operations • Margin Operations • Main Bottom Toolbar
            <br />
            <span className="text-cyan-400">Now with full production functionality and styled color picker popouts!</span>
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
              { id: 'boolean', label: 'Boolean Panel', color: 'purple' },
              { id: 'margin', label: 'Margin Panel', color: 'cyan' },
              { id: 'bottom', label: 'Main Bottom Toolbar', color: 'emerald' },
              { id: null, label: 'None', color: 'gray' },
            ].map((panel) => (
              <button
                key={panel.id || 'none'}
                onClick={() => setActivePanel(panel.id as any)}
                className={cn(
                  'px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all',
                  activePanel === panel.id
                    ? panel.color === 'purple' 
                      ? 'border-purple-500/40 bg-purple-500/10 text-purple-300 shadow-lg'
                      : panel.color === 'cyan'
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-lg'
                        : panel.color === 'emerald'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-lg'
                          : 'border-gray-500/40 bg-gray-500/10 text-gray-300 shadow-lg'
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

            {/* Operation Log */}
            {lastOperation && (
              <div className="absolute top-3 right-3 max-w-[300px] p-2 bg-black/60 rounded-lg border border-white/10">
                <div className="text-[10px] text-gray-500 uppercase mb-1">Last Operation</div>
                <div className="text-xs text-cyan-300 font-mono break-all">{lastOperation}</div>
              </div>
            )}

            {/* Note about bottom toolbar */}
            {activePanel === 'bottom' && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 text-center">
                ↓ Main Bottom Toolbar (lighter glass style - always visible)
              </div>
            )}

            {/* Panel instructions */}
            {activePanel === 'boolean' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center space-y-2">
                <div className="text-sm text-purple-400 font-medium">Boolean Operations Panel</div>
                <div className="text-xs text-gray-500 max-w-[300px]">
                  Select two structures (A and B), choose an operation, and specify output.
                  <br />Click the color swatch to open the styled color picker.
                </div>
              </div>
            )}
            {activePanel === 'margin' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center space-y-2">
                <div className="text-sm text-cyan-400 font-medium">Margin Tool Panel</div>
                <div className="text-xs text-gray-500 max-w-[300px]">
                  Select a source structure, choose expand/shrink, set distance and output target.
                  <br />Click the color swatch to open the styled color picker.
                </div>
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
            onExecute={(op) => {
              console.log('Boolean execute:', op);
              setLastOperation(`Boolean ${op.operation}: ${op.structureA} ${op.operation === 'union' ? '∪' : op.operation === 'subtract' ? '−' : op.operation === 'intersect' ? '∩' : '⊕'} ${op.structureB} → ${op.outputName}`);
            }}
            onPreview={(op) => {
              console.log('Boolean preview:', op);
              setLastOperation(`Preview: ${op.structureA} ${op.operation === 'union' ? '∪' : op.operation === 'subtract' ? '−' : op.operation === 'intersect' ? '∩' : '⊕'} ${op.structureB}`);
            }}
            onClose={() => setActivePanel(null)}
          />
        )}
        
        {activePanel === 'margin' && (
          <MarginPanelV4
            availableStructures={mockStructures}
            onExecute={(op) => {
              console.log('Margin execute:', op);
              const sign = op.direction === 'expand' ? '+' : '-';
              setLastOperation(`Margin: ${op.structureName} ${sign}${Math.abs(op.marginMm)}mm → ${op.outputName}`);
            }}
            onPreview={(op) => {
              console.log('Margin preview:', op);
              const sign = op.direction === 'expand' ? '+' : '-';
              setLastOperation(`Preview: ${op.structureName} ${sign}${Math.abs(op.marginMm)}mm`);
            }}
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

