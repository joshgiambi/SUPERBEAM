/**
 * V4 Aurora Panels V2 Prototype
 * 
 * Enhanced versions with full production functionality:
 * - Boolean Operations Panel with Expression + Panel modes and multi-step pipeline
 * - Margin Operations Panel with Uniform, Anisotropic, and Directional modes
 * 
 * All using the V4 Aurora design language.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ChevronUp,
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
  Move,
  ArrowLeftRight,
  Palette,
  Check,
  Type,
  LayoutGrid,
  Trash2,
  Copy,
  Box,
  CircleDot,
  Axis3D,
  ArrowUpDown,
  Save,
  Library,
  FolderOpen,
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
  '#FF0000', '#FF6B6B', '#FF8C00', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF69B4',
  '#E74C3C', '#F39C12', '#27AE60', '#3498DB', '#8E44AD', '#E91E63', '#00BCD4', '#CDDC39',
  '#C0392B', '#D35400', '#16A085', '#2980B9', '#7B1FA2', '#AD1457', '#0097A7', '#689F38',
  '#FFCDD2', '#FFE0B2', '#C8E6C9', '#B3E5FC', '#E1BEE7', '#F8BBD9', '#B2EBF2', '#DCEDC8',
];

// ============================================================================
// DRAGGABLE HOOK (optimized to prevent lag)
// ============================================================================

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
  
  // Keep ref in sync
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
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
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
                    "w-7 h-7 rounded-md border transition-all hover:scale-110 hover:z-10 relative",
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
              <input
                type="color"
                value={customColor}
                onChange={handleCustomChange}
                className="w-8 h-8 rounded-md cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/30"
              />
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

// ============================================================================
// AUTO-UPDATE TOGGLE COMPONENT
// ============================================================================

interface AutoUpdateToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  accentHue?: number;
}

function AutoUpdateToggle({ enabled, onChange, accentHue = 270 }: AutoUpdateToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          onClick={() => onChange(!enabled)}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-lg transition-all cursor-pointer border",
            enabled
              ? "bg-purple-600/25 border-purple-400/50 text-purple-200"
              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
          )}
        >
          <Switch
            checked={enabled}
            onCheckedChange={onChange}
            className="scale-[0.65] data-[state=checked]:bg-purple-500"
          />
          <span className="text-[10px] font-medium whitespace-nowrap">Auto-Update</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs max-w-[200px]">
        When enabled, the output structure will automatically update when source structures change
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// STYLED DROP-UP SELECT COMPONENT
// ============================================================================

interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; color?: string }>;
  placeholder?: string;
  className?: string;
  showColorDot?: boolean;
  getColor?: (value: string) => string;
}

function StyledSelect({ value, onChange, options, placeholder = 'Select...', className, showColorDot, getColor }: StyledSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-7 px-2 flex items-center gap-1.5 rounded-lg text-xs transition-all border min-w-[100px] justify-between",
          "bg-black/30 border-white/10 text-white hover:border-white/20"
        )}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {showColorDot && getColor && value && (
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getColor(value) }}
            />
          )}
          <span className="truncate">
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronUp className={cn("w-3 h-3 flex-shrink-0 text-gray-500 transition-transform", !isOpen && "rotate-180")} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-0 mb-1 w-full min-w-[140px] max-h-[200px] overflow-y-auto rounded-lg border border-white/10 shadow-xl z-50"
            style={{ background: 'linear-gradient(180deg, rgba(30, 30, 35, 0.98) 0%, rgba(20, 20, 25, 0.99) 100%)' }}
          >
            {options.length === 0 ? (
              <div className="px-2 py-2 text-[10px] text-gray-500 text-center">No options</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-2 py-1.5 flex items-center gap-1.5 text-xs text-left transition-colors",
                    value === opt.value 
                      ? "bg-white/10 text-white" 
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {showColorDot && getColor && (
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: opt.color || getColor(opt.value) }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <Check className="w-3 h-3 ml-auto text-cyan-400" />}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// BOOLEAN OPERATIONS PANEL V2
// ============================================================================

type BooleanOp = 'union' | 'subtract' | 'intersect' | 'xor';
type BooleanMode = 'expression' | 'panel';

interface BooleanStep {
  id: string;
  operation: BooleanOp;
  structureA: string;
  structureB: string;
  result: string;
}

interface BooleanTemplate {
  id: string;
  name: string;
  mode: BooleanMode;
  expression?: string;
  steps?: BooleanStep[];
  createdAt: number;
}

const BOOL_TEMPLATE_STORAGE_KEY = 'v4-aurora-boolean-templates';

function loadBooleanTemplates(): BooleanTemplate[] {
  try {
    const stored = localStorage.getItem(BOOL_TEMPLATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveBooleanTemplates(templates: BooleanTemplate[]) {
  try {
    localStorage.setItem(BOOL_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch {}
}

interface BooleanPanelV2Props {
  availableStructures: Array<{ name: string; color: number[] }>;
  onExecute?: (config: { 
    mode: BooleanMode;
    steps: BooleanStep[];
    expression?: string;
    outputMode: 'existing' | 'new';
    outputName: string; 
    outputColor: string;
    autoUpdate: boolean;
  }) => void;
  onPreview?: (config: any) => void;
  onClose?: () => void;
}

export function BooleanPanelV4v2({ availableStructures, onExecute, onPreview, onClose }: BooleanPanelV2Props) {
  // Mode: expression or panel
  const [mode, setMode] = useState<BooleanMode>('panel');
  
  // Expression mode state
  const [expression, setExpression] = useState('');
  const [syntaxErrors, setSyntaxErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Panel mode state (multi-step)
  const [steps, setSteps] = useState<BooleanStep[]>([
    { id: '1', operation: 'union', structureA: '', structureB: '', result: 'Step1' }
  ]);
  
  // Shared state
  const [outputMode, setOutputMode] = useState<'existing' | 'new'>('new');
  const [outputExisting, setOutputExisting] = useState<string>('');
  const [outputName, setOutputName] = useState('');
  const [outputColor, setOutputColor] = useState('#3B82F6');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState(true);
  
  // Template management
  const [templates, setTemplates] = useState<BooleanTemplate[]>(() => loadBooleanTemplates());
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable('boolean-panel-v4v2-pos');

  // Convert steps to expression when switching to expression mode
  const stepsToExpression = useCallback((stepsList: BooleanStep[]) => {
    if (stepsList.length === 0) return '';
    
    let expr = '';
    for (let i = 0; i < stepsList.length; i++) {
      const step = stepsList[i];
      if (!step.structureA || !step.structureB) continue;
      
      const opSymbol = operations.find(o => o.id === step.operation)?.symbol || '∪';
      
      if (i === 0) {
        expr = `${step.structureA} ${opSymbol} ${step.structureB}`;
      } else {
        // Chain operations using previous result
        expr = `(${expr}) ${opSymbol} ${step.structureB}`;
      }
    }
    return expr;
  }, []);

  // Parse expression to steps (basic parsing for simple expressions)
  const expressionToSteps = useCallback((expr: string): BooleanStep[] => {
    if (!expr.trim()) return [{ id: '1', operation: 'union', structureA: '', structureB: '', result: 'Step1' }];
    
    // Simple parser: extract operands and operators
    const tokens = expr.match(/[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\−\-]/g) || [];
    const operands: string[] = [];
    const ops: BooleanOp[] = [];
    
    for (const token of tokens) {
      if (['∪', '∩', '⊕', '−', '-'].includes(token)) {
        const opId = token === '∪' ? 'union' : token === '∩' ? 'intersect' : token === '⊕' ? 'xor' : 'subtract';
        ops.push(opId);
      } else if (/^[A-Za-z]/.test(token)) {
        operands.push(token);
      }
    }
    
    if (operands.length < 2) {
      return [{ id: '1', operation: 'union', structureA: operands[0] || '', structureB: '', result: 'Step1' }];
    }
    
    const newSteps: BooleanStep[] = [];
    for (let i = 0; i < operands.length - 1; i++) {
      newSteps.push({
        id: String(i + 1),
        operation: ops[i] || 'union',
        structureA: i === 0 ? operands[0] : `Step${i}`,
        structureB: operands[i + 1],
        result: `Step${i + 1}`,
      });
    }
    
    return newSteps.length > 0 ? newSteps : [{ id: '1', operation: 'union', structureA: '', structureB: '', result: 'Step1' }];
  }, []);

  // Mode switch handler with synchronization
  const handleModeSwitch = useCallback((newMode: BooleanMode) => {
    if (newMode === mode) return;
    
    if (newMode === 'expression' && steps.some(s => s.structureA && s.structureB)) {
      // Convert steps to expression
      const expr = stepsToExpression(steps);
      setExpression(expr);
    } else if (newMode === 'panel' && expression.trim()) {
      // Convert expression to steps
      const newSteps = expressionToSteps(expression);
      setSteps(newSteps);
    }
    
    setMode(newMode);
  }, [mode, steps, expression, stepsToExpression, expressionToSteps]);

  // Template management functions
  const saveTemplate = useCallback(() => {
    if (!templateName.trim()) return;
    
    const newTemplate: BooleanTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      mode,
      expression: mode === 'expression' ? expression : undefined,
      steps: mode === 'panel' ? steps : undefined,
      createdAt: Date.now(),
    };
    
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveBooleanTemplates(updated);
    setTemplateName('');
    setShowSaveDialog(false);
  }, [templateName, mode, expression, steps, templates]);

  const loadTemplate = useCallback((template: BooleanTemplate) => {
    setMode(template.mode);
    if (template.expression) setExpression(template.expression);
    if (template.steps) setSteps(template.steps);
    setShowLibrary(false);
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveBooleanTemplates(updated);
  }, [templates]);

  // Get structure colors for display
  const getStructureColor = (name: string) => {
    const struct = availableStructures.find(s => s.name === name);
    return struct ? `rgb(${struct.color.join(',')})` : 'rgb(128,128,128)';
  };

  const structureNames = availableStructures.map(s => s.name);

  // Get all available inputs (structures + previous step results)
  const getAvailableInputs = (stepIndex: number) => {
    const inputs = [...structureNames];
    for (let i = 0; i < stepIndex; i++) {
      if (steps[i].result) {
        inputs.push(steps[i].result);
      }
    }
    return inputs;
  };

  // Operation definitions
  const operations = [
    { id: 'union', symbol: '∪', label: 'Union', desc: 'A + B', color: 'rgb(34, 197, 94)' },
    { id: 'subtract', symbol: '−', label: 'Subtract', desc: 'A − B', color: 'rgb(239, 68, 68)' },
    { id: 'intersect', symbol: '∩', label: 'Intersect', desc: 'A ∩ B', color: 'rgb(168, 85, 247)' },
    { id: 'xor', symbol: '⊕', label: 'XOR', desc: 'A ⊕ B', color: 'rgb(234, 179, 8)' },
  ];

  const getOpColor = (op: BooleanOp) => operations.find(o => o.id === op)?.color || 'rgb(128,128,128)';
  const getOpSymbol = (op: BooleanOp) => operations.find(o => o.id === op)?.symbol || '?';

  // Step management
  const addStep = () => {
    const newId = String(steps.length + 1);
    const lastResult = steps[steps.length - 1]?.result || '';
    setSteps([...steps, { 
      id: newId, 
      operation: 'union', 
      structureA: lastResult, 
      structureB: '', 
      result: `Step${newId}` 
    }]);
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(s => s.id !== id));
    }
  };

  const updateStep = (id: string, updates: Partial<BooleanStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Expression validation
  useEffect(() => {
    if (mode !== 'expression' || !expression) {
      setSyntaxErrors([]);
      return;
    }
    const errors: string[] = [];
    const trimmed = expression.trim();
    
    // Basic validation
    const tokens = trimmed.match(/[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=]/g) || [];
    const isOp = (t: string) => ['∪', '∩', '⊕', '-'].includes(t);
    
    // Check parentheses
    let balance = 0;
    for (const t of tokens) {
      if (t === '(') balance++;
      if (t === ')') balance--;
      if (balance < 0) errors.push('Parentheses are misordered');
    }
    if (balance !== 0) errors.push('Unbalanced parentheses');
    
    // Check for unknown structures
    const identifiers = tokens.filter(t => /^[A-Za-z][A-Za-z0-9_#-]*$/.test(t));
    const unknown = identifiers.filter(name => 
      !structureNames.some(s => s.toLowerCase() === name.toLowerCase())
    );
    if (unknown.length > 0) {
      errors.push(`Unknown: ${Array.from(new Set(unknown)).join(', ')}`);
    }
    
    setSyntaxErrors(errors);
  }, [expression, mode, structureNames]);

  // Expression input handlers
  const insertOperator = (op: string) => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart || expression.length;
      const end = inputRef.current.selectionEnd || expression.length;
      const newValue = expression.slice(0, start) + ` ${op} ` + expression.slice(end);
      setExpression(newValue);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        const newPos = start + op.length + 2;
        inputRef.current?.setSelectionRange(newPos, newPos);
      });
    }
  };

  const insertChar = (char: string) => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart || expression.length;
      const end = inputRef.current.selectionEnd || expression.length;
      const newValue = expression.slice(0, start) + char + expression.slice(end);
      setExpression(newValue);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        const newPos = start + char.length;
        inputRef.current?.setSelectionRange(newPos, newPos);
      });
    }
  };

  // Handle keyboard shortcuts: + for union, - for subtract
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '+') {
      e.preventDefault();
      insertOperator('∪');
    } else if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      insertOperator('−');
    }
  };

  // Render expression with syntax highlighting
  const renderExpressionPills = () => {
    if (!expression) return null;
    const tokens = expression.match(/[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=]|\s+/g) || [];
    
    return (
      <span className="whitespace-pre">
        {tokens.map((token, i) => {
          if (/^\s+$/.test(token)) return <span key={i}>{token}</span>;
          
          const isValidStructure = structureNames.some(s => s.toLowerCase() === token.toLowerCase());
          const isOperator = ['∪', '∩', '⊕', '-'].includes(token);
          const isParens = ['(', ')'].includes(token);
          const isEquals = token === '=';
          
          if (isValidStructure) {
            const color = getStructureColor(token);
            return (
              <span
                key={i}
                className="inline-flex items-center rounded px-1 py-0.5 text-[11px] font-medium border align-middle mx-0.5"
                style={{ color, borderColor: color, backgroundColor: `${color}15` }}
              >
                {token}
              </span>
            );
          }
          if (isOperator) {
            const op = operations.find(o => o.symbol === token);
            return <span key={i} className="font-bold mx-1" style={{ color: op?.color }}>{token}</span>;
          }
          if (isParens) return <span key={i} className="text-gray-400 font-medium">{token}</span>;
          if (isEquals) return <span key={i} className="text-purple-400 font-bold mx-1">{token}</span>;
          
          // Unknown identifier
          return (
            <span key={i} className="inline-flex items-center rounded px-1 py-0.5 text-[11px] font-medium border border-red-400/60 text-red-300 bg-red-900/20 align-middle mx-0.5">
              {token}
            </span>
          );
        })}
      </span>
    );
  };

  const canExecute = mode === 'expression' 
    ? expression.trim() && syntaxErrors.length === 0
    : steps.every(s => s.structureA && s.structureB) && (outputMode === 'existing' ? outputExisting : outputName);

  const handleExecute = () => {
    if (!canExecute) return;
    onExecute?.({
      mode,
      steps,
      expression: mode === 'expression' ? expression : undefined,
      outputMode,
      outputName: outputMode === 'existing' ? outputExisting : outputName,
      outputColor,
      autoUpdate,
    });
    setIsPreviewActive(false);
  };

  // Accent color for the panel
  const accentColor = { rgb: 'rgb(168, 85, 247)', hue: 270 }; // Purple for boolean

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
          className={cn("rounded-2xl backdrop-blur-xl shadow-2xl", isDragging && "ring-2")}
          style={{
            background: `linear-gradient(180deg, hsla(${accentColor.hue}, 12%, 13%, 0.97) 0%, hsla(${accentColor.hue}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentColor.rgb}20, 0 0 60px -15px ${accentColor.rgb}20`,
            minWidth: mode === 'expression' ? '720px' : '800px',
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

            {/* Mode Toggle */}
            <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-white/[0.06]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleModeSwitch('expression')}
                    className={cn(
                      'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                      mode === 'expression' 
                        ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-500/40' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    )}
                  >
                    <Type className="w-3.5 h-3.5" />
                    Expression
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                  Type boolean expressions with syntax highlighting (auto-syncs with panel)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleModeSwitch('panel')}
                    className={cn(
                      'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                      mode === 'panel' 
                        ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/40' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Panel
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                  Visual step-by-step builder with dropdowns (auto-syncs with expression)
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Save & Library */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowSaveDialog(true)}
                    disabled={mode === 'expression' ? !expression.trim() : !steps.some(s => s.structureA && s.structureB)}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-lg transition-all border",
                      "bg-blue-900/30 border-blue-500/40 text-blue-300",
                      "hover:bg-blue-800/40 hover:border-blue-400/60 hover:text-blue-200",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Save as template</TooltipContent>
              </Tooltip>
              
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowLibrary(!showLibrary)}
                      className={cn(
                        "h-7 w-7 flex items-center justify-center rounded-lg transition-all border",
                        showLibrary 
                          ? "bg-purple-700/40 border-purple-400/60 text-purple-200" 
                          : "bg-purple-900/30 border-purple-500/40 text-purple-300 hover:bg-purple-800/40 hover:border-purple-400/60 hover:text-purple-200"
                      )}
                    >
                      <Library className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                    Template library ({templates.length})
                  </TooltipContent>
                </Tooltip>
                
                {/* Library Popup */}
                <AnimatePresence>
                  {showLibrary && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-72 max-h-64 overflow-y-auto rounded-xl border border-purple-500/30 shadow-2xl z-50"
                      style={{ background: 'linear-gradient(180deg, rgba(30, 20, 40, 0.98) 0%, rgba(20, 15, 30, 0.99) 100%)' }}
                    >
                      <div className="sticky top-0 px-3 py-2 border-b border-white/10 backdrop-blur-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Library className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs font-medium text-purple-200">Templates</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{templates.length}</span>
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="text-gray-500 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="p-2">
                        {templates.length === 0 ? (
                          <div className="py-6 text-center">
                            <FolderOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">No saved templates</p>
                            <p className="text-[10px] text-gray-600 mt-1">Save your operations to reuse them</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {templates.map(template => (
                              <div
                                key={template.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-white font-medium truncate">{template.name}</div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    {template.mode === 'expression' ? 'Expression' : `${template.steps?.length || 0} steps`}
                                  </div>
                                </div>
                                <button
                                  onClick={() => loadTemplate(template)}
                                  className="h-6 px-2 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
                                >
                                  Load
                                </button>
                                <button
                                  onClick={() => deleteTemplate(template.id)}
                                  className="h-6 w-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Save Dialog */}
                <AnimatePresence>
                  {showSaveDialog && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-blue-500/30 shadow-2xl z-50"
                      style={{ background: 'linear-gradient(180deg, rgba(20, 30, 50, 0.98) 0%, rgba(15, 20, 35, 0.99) 100%)' }}
                    >
                      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
                        <Save className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-medium text-blue-200">Save Template</span>
                      </div>
                      <div className="p-3 space-y-3">
                        <Input
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Template name..."
                          className="h-8 bg-black/30 border-white/10 text-white text-xs rounded-lg"
                          onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowSaveDialog(false)}
                            className="flex-1 h-7 text-xs font-medium rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveTemplate}
                            disabled={!templateName.trim()}
                            className="flex-1 h-7 text-xs font-semibold rounded-lg bg-blue-600/80 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1" />

            {/* Auto-Update Toggle */}
            <AutoUpdateToggle enabled={autoUpdate} onChange={setAutoUpdate} />

            <button onClick={resetPosition} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content Area - Mode Dependent */}
          <div className="px-3 py-2.5" style={{ background: `hsla(${accentColor.hue}, 6%, 8%, 1)` }}>
            <AnimatePresence mode="wait">
              {mode === 'expression' ? (
                <motion.div
                  key="expression"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-3"
                >
                  {/* Expression Input */}
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={expression}
                      onChange={(e) => setExpression(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter boolean expression (e.g., CTV ∪ GTV − SpinalCord) — use + for Union, - for Subtract"
                      className="w-full h-9 bg-black/30 border-white/10 text-white text-sm rounded-lg pr-8 font-mono"
                      style={{ 
                        color: expression ? 'transparent' : undefined,
                        caretColor: 'white',
                      }}
                    />
                    {expression && (
                      <div className="absolute inset-0 pointer-events-none flex items-center text-sm font-mono px-3">
                        {renderExpressionPills()}
                      </div>
                    )}
                    {syntaxErrors.length > 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400">
                        <span className="text-xs">⚠</span>
                      </div>
                    )}
                  </div>

                  {/* Syntax errors */}
                  {syntaxErrors.length > 0 && (
                    <div className="px-2 py-1.5 bg-red-950/40 border border-red-500/30 rounded-lg">
                      <div className="text-[10px] text-red-300 space-y-0.5">
                        {syntaxErrors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Operator Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {operations.map(op => (
                      <button
                        key={op.id}
                        onClick={() => insertOperator(op.symbol)}
                        className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium transition-all border hover:scale-105"
                        style={{ 
                          backgroundColor: `${op.color}15`, 
                          borderColor: `${op.color}40`,
                          color: op.color,
                        }}
                        title={`${op.label} (${op.id === 'union' ? 'or press +' : op.id === 'subtract' ? 'or press -' : ''})`}
                      >
                        <span className="font-bold">{op.symbol}</span>
                        {op.label}
                      </button>
                    ))}
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    {/* Separate bracket buttons */}
                    <button
                      onClick={() => insertChar('(')}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-sm font-bold transition-all border bg-gray-800/50 border-gray-600/40 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                      title="Open parenthesis"
                    >
                      (
                    </button>
                    <button
                      onClick={() => insertChar(')')}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-sm font-bold transition-all border bg-gray-800/50 border-gray-600/40 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                      title="Close parenthesis"
                    >
                      )
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-2"
                >
                  {/* Steps Header */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpandedSteps(!expandedSteps)}
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      {expandedSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span className="font-medium">{steps.length} Step{steps.length !== 1 ? 's' : ''}</span>
                    </button>
                    <button
                      onClick={addStep}
                      className="h-6 px-2 flex items-center gap-1 rounded text-[10px] font-medium bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/10"
                    >
                      <Plus className="w-3 h-3" />
                      Add Step
                    </button>
                  </div>

                  {/* Steps List */}
                  <AnimatePresence>
                    {expandedSteps && (
                      <div className="space-y-2">
                        {steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.06] transition-colors"
                          >
                            <span className="text-[10px] text-gray-600 font-mono w-5">#{index + 1}</span>

                            {/* Structure A - using styled drop-up select */}
                            <StyledSelect
                              value={step.structureA}
                              onChange={(val) => updateStep(step.id, { structureA: val })}
                              options={[
                                { value: '', label: 'Select A...' },
                                ...getAvailableInputs(index).map(name => ({ value: name, label: name }))
                              ]}
                              placeholder="Select A..."
                              showColorDot
                              getColor={getStructureColor}
                              className="min-w-[100px]"
                            />

                            {/* Operation - styled drop-up */}
                            <StyledSelect
                              value={step.operation}
                              onChange={(val) => updateStep(step.id, { operation: val as BooleanOp })}
                              options={operations.map(op => ({ 
                                value: op.id, 
                                label: `${op.symbol} ${op.label}`,
                                color: op.color,
                              }))}
                              className="min-w-[90px]"
                            />

                            {/* Structure B - using styled drop-up select */}
                            <StyledSelect
                              value={step.structureB}
                              onChange={(val) => updateStep(step.id, { structureB: val })}
                              options={[
                                { value: '', label: 'Select B...' },
                                ...getAvailableInputs(index).map(name => ({ value: name, label: name }))
                              ]}
                              placeholder="Select B..."
                              showColorDot
                              getColor={getStructureColor}
                              className="min-w-[100px]"
                            />

                            <span className="text-gray-600">=</span>

                            {/* Result Name */}
                            <Input
                              value={step.result}
                              onChange={(e) => updateStep(step.id, { result: e.target.value })}
                              className="h-7 w-28 px-2 text-xs bg-black/30 border-white/10 text-cyan-300 rounded font-mono"
                              placeholder="Result"
                            />

                            {steps.length > 1 && (
                              <button
                                onClick={() => removeStep(step.id)}
                                className="h-6 w-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Row - Output & Actions */}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-white/[0.06]" style={{ background: `hsla(${accentColor.hue}, 8%, 10%, 1)` }}>
            {/* Output Mode */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]">
              <span className="text-[10px] text-gray-500 uppercase">Output</span>
              <div className="flex items-center bg-black/30 rounded overflow-hidden border border-white/[0.06]">
                <button
                  onClick={() => setOutputMode('existing')}
                  className={cn(
                    'px-2 h-6 text-[10px] font-medium transition-all',
                    outputMode === 'existing' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  Existing
                </button>
                <button
                  onClick={() => setOutputMode('new')}
                  className={cn(
                    'px-2 h-6 text-[10px] font-medium transition-all',
                    outputMode === 'new' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  New
                </button>
              </div>
            </div>

            {/* Output Selection */}
            {outputMode === 'existing' ? (
              <StyledSelect
                value={outputExisting}
                onChange={setOutputExisting}
                options={[
                  { value: '', label: 'Select target...' },
                  ...structureNames.map(name => ({ value: name, label: name }))
                ]}
                placeholder="Select target..."
                showColorDot
                getColor={getStructureColor}
                className="min-w-[120px]"
              />
            ) : (
              <div className="flex items-center gap-2">
                <ColorPickerPopover
                  color={outputColor}
                  onChange={setOutputColor}
                  accentHue={accentColor.hue}
                />
                <Input
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="New structure name"
                  className="h-7 w-36 px-2 text-xs bg-black/30 border-white/10 text-white rounded-lg"
                />
              </div>
            )}

            <div className="flex-1" />

            {/* Preview */}
            <button
              onClick={() => {
                onPreview?.({ mode, steps, expression, outputMode, outputName: outputMode === 'existing' ? outputExisting : outputName, outputColor });
                setIsPreviewActive(true);
              }}
              className={cn(
                "h-7 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all border",
                isPreviewActive
                  ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-200"
                  : "bg-yellow-900/20 border-yellow-600/40 text-yellow-300 hover:bg-yellow-900/30"
              )}
            >
              <Eye className={cn("w-3 h-3", isPreviewActive && "animate-pulse")} />
              Preview
            </button>

            {/* Execute */}
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
// MARGIN OPERATIONS PANEL V2
// ============================================================================

type MarginMode = 'uniform' | 'anisotropic' | 'directional';

interface MarginTemplate {
  id: string;
  name: string;
  mode: MarginMode;
  direction: 'expand' | 'shrink';
  uniformMargin: number;
  anisotropicMargins: { x: number; y: number; z: number };
  directionalMargins: { superior: number; inferior: number; anterior: number; posterior: number; left: number; right: number };
  createdAt: number;
}

const MARGIN_TEMPLATE_STORAGE_KEY = 'v4-aurora-margin-templates';

function loadMarginTemplates(): MarginTemplate[] {
  try {
    const stored = localStorage.getItem(MARGIN_TEMPLATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveMarginTemplates(templates: MarginTemplate[]) {
  try {
    localStorage.setItem(MARGIN_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch {}
}

interface MarginPanelV2Props {
  availableStructures: Array<{ name: string; color: number[] }>;
  onExecute?: (config: { 
    structureName: string;
    mode: MarginMode;
    direction: 'expand' | 'shrink';
    values: {
      uniform?: number;
      anisotropic?: { x: number; y: number; z: number };
      directional?: { superior: number; inferior: number; anterior: number; posterior: number; left: number; right: number };
    };
    outputMode: 'same' | 'different' | 'new';
    outputName: string; 
    outputColor: string;
    autoUpdate: boolean;
  }) => void;
  onPreview?: (config: any) => void;
  onClose?: () => void;
}

export function MarginPanelV4v2({ availableStructures, onExecute, onPreview, onClose }: MarginPanelV2Props) {
  // Source structure
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  
  // Margin mode
  const [marginMode, setMarginMode] = useState<MarginMode>('uniform');
  const [direction, setDirection] = useState<'expand' | 'shrink'>('expand');
  
  // Margin values
  const [uniformMargin, setUniformMargin] = useState(10);
  const [anisotropicMargins, setAnisotropicMargins] = useState({ x: 5, y: 5, z: 5 });
  const [directionalMargins, setDirectionalMargins] = useState({
    superior: 5, inferior: 5,
    anterior: 5, posterior: 5,
    left: 5, right: 5
  });
  
  // Output settings
  const [outputMode, setOutputMode] = useState<'same' | 'different' | 'new'>('same');
  const [outputDifferent, setOutputDifferent] = useState<string>('');
  const [outputName, setOutputName] = useState('');
  const [outputColor, setOutputColor] = useState('#22C55E');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Template management
  const [marginTemplates, setMarginTemplates] = useState<MarginTemplate[]>(() => loadMarginTemplates());
  const [showMarginLibrary, setShowMarginLibrary] = useState(false);
  const [showMarginSaveDialog, setShowMarginSaveDialog] = useState(false);
  const [marginTemplateName, setMarginTemplateName] = useState('');

  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable('margin-panel-v4v2-pos');

  // Template management functions
  const saveMarginTemplate = useCallback(() => {
    if (!marginTemplateName.trim()) return;
    
    const newTemplate: MarginTemplate = {
      id: Date.now().toString(),
      name: marginTemplateName.trim(),
      mode: marginMode,
      direction,
      uniformMargin,
      anisotropicMargins,
      directionalMargins,
      createdAt: Date.now(),
    };
    
    const updated = [...marginTemplates, newTemplate];
    setMarginTemplates(updated);
    saveMarginTemplates(updated);
    setMarginTemplateName('');
    setShowMarginSaveDialog(false);
  }, [marginTemplateName, marginMode, direction, uniformMargin, anisotropicMargins, directionalMargins, marginTemplates]);

  const loadMarginTemplate = useCallback((template: MarginTemplate) => {
    setMarginMode(template.mode);
    setDirection(template.direction);
    setUniformMargin(template.uniformMargin);
    setAnisotropicMargins(template.anisotropicMargins);
    setDirectionalMargins(template.directionalMargins);
    setShowMarginLibrary(false);
  }, []);

  const deleteMarginTemplate = useCallback((id: string) => {
    const updated = marginTemplates.filter(t => t.id !== id);
    setMarginTemplates(updated);
    saveMarginTemplates(updated);
  }, [marginTemplates]);

  // Get structure color
  const getStructureColor = (name: string) => {
    const struct = availableStructures.find(s => s.name === name);
    return struct ? `rgb(${struct.color.join(',')})` : 'rgb(128,128,128)';
  };

  const selectedStructureData = availableStructures.find(s => s.name === selectedStructure);
  const accentRgb = selectedStructureData ? `rgb(${selectedStructureData.color.join(',')})` : 'rgb(59, 130, 246)';
  
  // Direction-based accent color
  const directionColor = direction === 'expand' 
    ? { rgb: 'rgb(34, 197, 94)', hue: 142 }
    : { rgb: 'rgb(239, 68, 68)', hue: 0 };

  const canExecute = selectedStructure && (
    outputMode === 'same' || 
    (outputMode === 'different' && outputDifferent) ||
    (outputMode === 'new' && outputName)
  );

  // Auto-generate output name
  useEffect(() => {
    if (outputMode === 'new' && selectedStructure && !outputName) {
      const sign = direction === 'expand' ? '+' : '-';
      const val = marginMode === 'uniform' ? uniformMargin : 'custom';
      setOutputName(`${selectedStructure}_${sign}${val}mm`);
    }
  }, [selectedStructure, direction, uniformMargin, marginMode, outputMode]);

  const handleExecute = () => {
    if (!canExecute) return;
    const targetName = outputMode === 'same' 
      ? selectedStructure 
      : outputMode === 'different' 
        ? outputDifferent 
        : outputName;
    
    onExecute?.({
      structureName: selectedStructure,
      mode: marginMode,
      direction,
      values: {
        uniform: marginMode === 'uniform' ? (direction === 'shrink' ? -uniformMargin : uniformMargin) : undefined,
        anisotropic: marginMode === 'anisotropic' ? anisotropicMargins : undefined,
        directional: marginMode === 'directional' ? directionalMargins : undefined,
      },
      outputMode,
      outputName: targetName,
      outputColor,
      autoUpdate,
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
      mode: marginMode,
      direction,
      values: {
        uniform: marginMode === 'uniform' ? (direction === 'shrink' ? -uniformMargin : uniformMargin) : undefined,
        anisotropic: marginMode === 'anisotropic' ? anisotropicMargins : undefined,
        directional: marginMode === 'directional' ? directionalMargins : undefined,
      },
      outputName: targetName,
      outputColor,
    });
    setIsPreviewActive(true);
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
          className={cn("rounded-2xl backdrop-blur-xl shadow-2xl", isDragging && "ring-2")}
          style={{
            background: `linear-gradient(180deg, hsla(${directionColor.hue}, 12%, 13%, 0.97) 0%, hsla(${directionColor.hue}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${directionColor.rgb}20, 0 0 60px -15px ${directionColor.rgb}20`,
            minWidth: marginMode === 'directional' ? '720px' : '680px',
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

            {/* Source Structure */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]">
              <span className="text-[10px] text-gray-500 uppercase">Source</span>
              <StyledSelect
                value={selectedStructure}
                onChange={setSelectedStructure}
                options={[
                  { value: '', label: 'Select...' },
                  ...availableStructures.map(s => ({ value: s.name, label: s.name }))
                ]}
                placeholder="Select..."
                showColorDot
                getColor={getStructureColor}
                className="min-w-[110px]"
              />
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Direction Toggle */}
            <div className="flex items-center bg-black/20 rounded-lg p-0.5 border border-white/[0.06]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDirection('expand')}
                    className={cn(
                      'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
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
                      'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
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

            {/* Save & Library */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowMarginSaveDialog(true)}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-lg transition-all border",
                      "bg-blue-900/30 border-blue-500/40 text-blue-300",
                      "hover:bg-blue-800/40 hover:border-blue-400/60 hover:text-blue-200"
                    )}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Save as template</TooltipContent>
              </Tooltip>
              
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowMarginLibrary(!showMarginLibrary)}
                      className={cn(
                        "h-7 w-7 flex items-center justify-center rounded-lg transition-all border",
                        showMarginLibrary 
                          ? "bg-cyan-700/40 border-cyan-400/60 text-cyan-200" 
                          : "bg-cyan-900/30 border-cyan-500/40 text-cyan-300 hover:bg-cyan-800/40 hover:border-cyan-400/60 hover:text-cyan-200"
                      )}
                    >
                      <Library className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                    Template library ({marginTemplates.length})
                  </TooltipContent>
                </Tooltip>
                
                {/* Library Popup */}
                <AnimatePresence>
                  {showMarginLibrary && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-2 w-72 max-h-64 overflow-y-auto rounded-xl border border-cyan-500/30 shadow-2xl z-50"
                      style={{ background: 'linear-gradient(180deg, rgba(20, 35, 40, 0.98) 0%, rgba(15, 25, 30, 0.99) 100%)' }}
                    >
                      <div className="sticky top-0 px-3 py-2 border-b border-white/10 backdrop-blur-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Library className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-xs font-medium text-cyan-200">Margin Templates</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">{marginTemplates.length}</span>
                        </div>
                        <button onClick={() => setShowMarginLibrary(false)} className="text-gray-500 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="p-2">
                        {marginTemplates.length === 0 ? (
                          <div className="py-6 text-center">
                            <FolderOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">No saved templates</p>
                            <p className="text-[10px] text-gray-600 mt-1">Save margin settings to reuse them</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {marginTemplates.map(template => (
                              <div
                                key={template.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-white font-medium truncate">{template.name}</div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    {template.mode} · {template.direction === 'expand' ? '+' : '-'}
                                    {template.mode === 'uniform' ? `${template.uniformMargin}mm` : 'custom'}
                                  </div>
                                </div>
                                <button
                                  onClick={() => loadMarginTemplate(template)}
                                  className="h-6 px-2 text-[10px] font-medium rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                                >
                                  Load
                                </button>
                                <button
                                  onClick={() => deleteMarginTemplate(template.id)}
                                  className="h-6 w-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Save Dialog */}
                <AnimatePresence>
                  {showMarginSaveDialog && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-blue-500/30 shadow-2xl z-50"
                      style={{ background: 'linear-gradient(180deg, rgba(20, 30, 50, 0.98) 0%, rgba(15, 20, 35, 0.99) 100%)' }}
                    >
                      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
                        <Save className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-medium text-blue-200">Save Margin Template</span>
                      </div>
                      <div className="p-3 space-y-3">
                        <Input
                          value={marginTemplateName}
                          onChange={(e) => setMarginTemplateName(e.target.value)}
                          placeholder="Template name..."
                          className="h-8 bg-black/30 border-white/10 text-white text-xs rounded-lg"
                          onKeyDown={(e) => e.key === 'Enter' && saveMarginTemplate()}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowMarginSaveDialog(false)}
                            className="flex-1 h-7 text-xs font-medium rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveMarginTemplate}
                            disabled={!marginTemplateName.trim()}
                            className="flex-1 h-7 text-xs font-semibold rounded-lg bg-blue-600/80 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Auto-Update Toggle */}
            <AutoUpdateToggle enabled={autoUpdate} onChange={setAutoUpdate} />

            <button onClick={resetPosition} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Margin Mode & Settings */}
          <div className="px-3 py-2.5" style={{ background: `hsla(${directionColor.hue}, 6%, 8%, 1)` }}>
            {/* Mode Selector */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] text-gray-500 uppercase font-medium">Mode</span>
              <div className="flex items-center bg-black/20 rounded-lg p-0.5 border border-white/[0.06]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMarginMode('uniform')}
                      className={cn(
                        'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                        marginMode === 'uniform' 
                          ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                    >
                      <CircleDot className="w-3.5 h-3.5" />
                      Uniform
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Same margin in all directions</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMarginMode('anisotropic')}
                      className={cn(
                        'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                        marginMode === 'anisotropic' 
                          ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/40' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                    >
                      <Axis3D className="w-3.5 h-3.5" />
                      Anisotropic
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Different margins for X, Y, Z axes</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMarginMode('directional')}
                      className={cn(
                        'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                        marginMode === 'directional' 
                          ? 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Directional
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Individual margins for 6 directions</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Mode-specific controls */}
            <AnimatePresence mode="wait">
              {marginMode === 'uniform' && (
                <motion.div
                  key="uniform"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-4 p-3 bg-black/20 rounded-lg border border-white/[0.06]"
                >
                  <span className="text-xs text-gray-400">Distance</span>
                  <Slider
                    value={[uniformMargin]}
                    onValueChange={([val]) => setUniformMargin(val)}
                    max={30}
                    min={1}
                    step={0.5}
                    className="w-40 [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-white"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={uniformMargin}
                      onChange={(e) => setUniformMargin(parseFloat(e.target.value) || 0)}
                      className="h-7 w-16 px-2 text-xs text-center bg-black/30 border-white/10 text-white rounded font-mono"
                      step="0.5"
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                </motion.div>
              )}

              {marginMode === 'anisotropic' && (
                <motion.div
                  key="anisotropic"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-3 bg-black/20 rounded-lg border border-white/[0.06] space-y-2"
                >
                  <div className="text-[10px] text-gray-500 mb-2">Set margins for each axis (mm)</div>
                  {[
                    { key: 'x', label: 'X (Left/Right)', color: 'text-red-400' },
                    { key: 'y', label: 'Y (Ant/Post)', color: 'text-green-400' },
                    { key: 'z', label: 'Z (Sup/Inf)', color: 'text-blue-400' },
                  ].map(axis => (
                    <div key={axis.key} className="flex items-center gap-3">
                      <span className={cn("text-xs w-24", axis.color)}>{axis.label}</span>
                      <Slider
                        value={[anisotropicMargins[axis.key as keyof typeof anisotropicMargins]]}
                        onValueChange={([val]) => setAnisotropicMargins(prev => ({ ...prev, [axis.key]: val }))}
                        max={20}
                        min={-10}
                        step={0.5}
                        className="w-28 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white"
                      />
                      <Input
                        type="number"
                        value={anisotropicMargins[axis.key as keyof typeof anisotropicMargins]}
                        onChange={(e) => setAnisotropicMargins(prev => ({ ...prev, [axis.key]: parseFloat(e.target.value) || 0 }))}
                        className="h-6 w-14 px-1 text-xs text-center bg-black/30 border-white/10 text-white rounded font-mono"
                        step="0.5"
                      />
                      <span className="text-[10px] text-gray-600">mm</span>
                    </div>
                  ))}
                </motion.div>
              )}

              {marginMode === 'directional' && (
                <motion.div
                  key="directional"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-3 bg-black/20 rounded-lg border border-white/[0.06]"
                >
                  <div className="text-[10px] text-gray-500 mb-2">Set margins for each direction (mm)</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      { key: 'superior', label: 'Superior (+Z)', color: 'text-blue-400' },
                      { key: 'inferior', label: 'Inferior (-Z)', color: 'text-blue-300' },
                      { key: 'anterior', label: 'Anterior (-Y)', color: 'text-green-400' },
                      { key: 'posterior', label: 'Posterior (+Y)', color: 'text-green-300' },
                      { key: 'left', label: 'Left (+X)', color: 'text-red-400' },
                      { key: 'right', label: 'Right (-X)', color: 'text-red-300' },
                    ].map(dir => (
                      <div key={dir.key} className="flex items-center gap-2">
                        <span className={cn("text-[11px] w-24", dir.color)}>{dir.label}</span>
                        <Input
                          type="number"
                          value={directionalMargins[dir.key as keyof typeof directionalMargins]}
                          onChange={(e) => setDirectionalMargins(prev => ({ ...prev, [dir.key]: parseFloat(e.target.value) || 0 }))}
                          className="h-6 w-14 px-1 text-xs text-center bg-black/30 border-white/10 text-white rounded font-mono"
                          step="0.5"
                        />
                        <span className="text-[10px] text-gray-600">mm</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Row - Output & Actions */}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-white/[0.06]" style={{ background: `hsla(${directionColor.hue}, 8%, 10%, 1)` }}>
            {/* Output Mode */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/[0.06]">
              <span className="text-[10px] text-gray-500 uppercase">Target</span>
              <div className="flex items-center bg-black/30 rounded overflow-hidden border border-white/[0.06]">
                <button
                  onClick={() => setOutputMode('same')}
                  className={cn(
                    'px-2 h-6 text-[10px] font-medium transition-all',
                    outputMode === 'same' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  Same
                </button>
                <button
                  onClick={() => setOutputMode('different')}
                  className={cn(
                    'px-2 h-6 text-[10px] font-medium transition-all',
                    outputMode === 'different' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  Existing
                </button>
                <button
                  onClick={() => setOutputMode('new')}
                  className={cn(
                    'px-2 h-6 text-[10px] font-medium transition-all flex items-center gap-0.5',
                    outputMode === 'new' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <Plus className="w-2.5 h-2.5" />
                  New
                </button>
              </div>
            </div>

            {/* Output Selection */}
            <AnimatePresence mode="wait">
              {outputMode === 'different' && (
                <motion.div
                  key="different"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <StyledSelect
                    value={outputDifferent}
                    onChange={setOutputDifferent}
                    options={[
                      { value: '', label: 'Select target...' },
                      ...availableStructures
                        .filter(s => s.name !== selectedStructure)
                        .map(s => ({ value: s.name, label: s.name }))
                    ]}
                    placeholder="Select target..."
                    showColorDot
                    getColor={getStructureColor}
                    className="min-w-[120px]"
                  />
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
                    className="h-7 w-40 px-2 text-xs bg-black/30 border-white/10 text-white rounded-lg"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1" />

            {/* Preview */}
            <button
              onClick={handlePreview}
              disabled={!selectedStructure}
              className={cn(
                "h-7 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all border",
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

            {/* Execute */}
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
// DEMO PAGE
// ============================================================================

export function V4AuroraPanelsV2Demo() {
  const [activePanel, setActivePanel] = useState<'boolean' | 'margin' | null>('boolean');
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
            V4 Aurora Panels V2
          </CardTitle>
          <CardDescription className="text-gray-400">
            Enhanced panels with Expression/Panel modes, multi-step pipeline, and anisotropic margins
            <br />
            <span className="text-cyan-400">Now with Auto-Update toggle for both panels!</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">Select Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'boolean', label: 'Boolean Panel V2', color: 'purple' },
              { id: 'margin', label: 'Margin Panel V2', color: 'cyan' },
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
            
            {/* Operation Log */}
            {lastOperation && (
              <div className="absolute top-3 right-3 max-w-[300px] p-2 bg-black/60 rounded-lg border border-white/10">
                <div className="text-[10px] text-gray-500 uppercase mb-1">Last Operation</div>
                <div className="text-xs text-cyan-300 font-mono break-all">{lastOperation}</div>
              </div>
            )}

            {/* Panel instructions */}
            {activePanel === 'boolean' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center space-y-2">
                <div className="text-sm text-purple-400 font-medium">Boolean Operations Panel V2</div>
                <div className="text-xs text-gray-500 max-w-[350px]">
                  <strong>Expression Mode:</strong> Type boolean expressions with syntax highlighting
                  <br />
                  <strong>Panel Mode:</strong> Visual multi-step builder with dropdowns
                  <br /><br />
                  Includes Auto-Update toggle for superstructure tracking!
                </div>
              </div>
            )}
            {activePanel === 'margin' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center space-y-2">
                <div className="text-sm text-cyan-400 font-medium">Margin Tool Panel V2</div>
                <div className="text-xs text-gray-500 max-w-[350px]">
                  <strong>Uniform:</strong> Same margin in all directions
                  <br />
                  <strong>Anisotropic:</strong> Different margins for X, Y, Z axes
                  <br />
                  <strong>Directional:</strong> Individual margins for 6 directions
                  <br /><br />
                  Includes Auto-Update toggle for superstructure tracking!
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Floating Panels */}
      <AnimatePresence>
        {activePanel === 'boolean' && (
          <BooleanPanelV4v2
            availableStructures={mockStructures}
            onExecute={(config) => {
              console.log('Boolean execute:', config);
              setLastOperation(`Boolean: ${config.mode} mode, ${config.steps?.length || 0} steps, output → ${config.outputName}`);
            }}
            onPreview={(config) => {
              console.log('Boolean preview:', config);
              setLastOperation(`Preview: ${config.mode} mode`);
            }}
            onClose={() => setActivePanel(null)}
          />
        )}
        
        {activePanel === 'margin' && (
          <MarginPanelV4v2
            availableStructures={mockStructures}
            onExecute={(config) => {
              console.log('Margin execute:', config);
              const sign = config.direction === 'expand' ? '+' : '-';
              setLastOperation(`Margin: ${config.structureName} ${config.mode} ${sign}mm → ${config.outputName}`);
            }}
            onPreview={(config) => {
              console.log('Margin preview:', config);
              const sign = config.direction === 'expand' ? '+' : '-';
              setLastOperation(`Preview: ${config.structureName} ${config.mode} ${sign}mm`);
            }}
            onClose={() => setActivePanel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

