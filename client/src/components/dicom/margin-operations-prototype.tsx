/**
 * Margin Operations Toolbar - Aurora Edition
 * 
 * Matching the ContourEditToolbar Aurora design:
 * - Draggable with position memory
 * - Aurora glass effect styling
 * - Compact two-row layout
 * - Intuitive margin controls
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Play,
  X,
  Expand,
  Maximize2,
  Minimize2,
  Save,
  Library,
  Trash2,
  GripVertical,
  RotateCcw,
  ChevronDown,
  IterationCw,
  Layers
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface MarginOperationsPrototypeProps {
  availableStructures?: string[];
  onExecute?: (operation: {
    type: 'uniform' | 'anisotropic';
    structureName: string;
    parameters: any;
    outputName: string;
    outputColor: string;
    direction?: 'expand' | 'shrink';
    saveAsSuperstructure?: boolean;
    outputMode: 'new' | 'same';
  }) => void;
  onClose?: () => void;
  viewerOffsetLeft?: number;
}

interface MarginTemplate {
  id: string;
  name: string;
  selectedStructure: string;
  operationType: 'uniform' | 'anisotropic';
  marginDirection: 'expand' | 'shrink';
  uniformMargin?: number;
  anisotropicMargins?: {
    left: number;
    right: number;
    anterior: number;
    posterior: number;
    superior: number;
    inferior: number;
  };
  outputName: string;
  outputColor: string;
  saveAsSuperstructure: boolean;
  createdAt: number;
}

interface Position { x: number; y: number; }

// ============================================================================
// HELPERS
// ============================================================================

const STORAGE_KEY = 'margin-toolbar-aurora-position';

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
  const isDraggingRef = useRef(false);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const positionRef = useRef(position);
  
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !dragStart.current) return;
    const newPos = {
      x: dragStart.current.posX + (e.clientX - dragStart.current.x),
      y: dragStart.current.posY + (e.clientY - dragStart.current.y),
    };
    positionRef.current = newPos;
    setPosition(newPos);
  }, []);

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
// COMPONENT
// ============================================================================

export function MarginOperationsPrototype({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute,
  onClose,
  viewerOffsetLeft = 0
}: MarginOperationsPrototypeProps) {
  
  // Position management
  const storedPos = getStoredPosition();
  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable(
    storedPos || { x: 0, y: 0 }
  );

  // Core state
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [operationType, setOperationType] = useState<'uniform' | 'anisotropic'>('uniform');
  const [marginDirection, setMarginDirection] = useState<'expand' | 'shrink'>('expand');
  
  // Uniform margin
  const [uniformMargin, setUniformMargin] = useState(5);
  
  // Anisotropic margins
  const [anisotropicMargins, setAnisotropicMargins] = useState({
    left: 5, right: 5,
    anterior: 5, posterior: 5,
    superior: 5, inferior: 5
  });
  
  // Output configuration
  const [outputMode, setOutputMode] = useState<'new' | 'same'>('new');
  const [outputName, setOutputName] = useState('PTV');
  const [outputColor, setOutputColor] = useState('#FF6B6B');
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(false);
  
  // Template management
  const [templates, setTemplates] = useState<MarginTemplate[]>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Aurora accent color - use a teal/cyan theme for margin operations
  const accentHue = 175; // Teal
  const accentRgb = 'rgb(20, 184, 166)'; // teal-500

  // Load templates
  useEffect(() => {
    const savedTemplates = localStorage.getItem('marginOperationsTemplates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to load margin templates:', e);
      }
    }
  }, []);
  
  // Save templates
  useEffect(() => {
    if (templates.length > 0) {
      localStorage.setItem('marginOperationsTemplates', JSON.stringify(templates));
    } else {
      localStorage.removeItem('marginOperationsTemplates');
    }
  }, [templates]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  const handleExecute = () => {
    if (!selectedStructure) return;
    if (outputMode === 'new' && !outputName) return;
    
    const parameters = operationType === 'uniform' 
      ? { margin: marginDirection === 'expand' ? uniformMargin : -uniformMargin }
      : { 
          left: marginDirection === 'expand' ? anisotropicMargins.left : -anisotropicMargins.left,
          right: marginDirection === 'expand' ? anisotropicMargins.right : -anisotropicMargins.right,
          anterior: marginDirection === 'expand' ? anisotropicMargins.anterior : -anisotropicMargins.anterior,
          posterior: marginDirection === 'expand' ? anisotropicMargins.posterior : -anisotropicMargins.posterior,
          superior: marginDirection === 'expand' ? anisotropicMargins.superior : -anisotropicMargins.superior,
          inferior: marginDirection === 'expand' ? anisotropicMargins.inferior : -anisotropicMargins.inferior
        };
    
    onExecute?.({
      type: operationType,
      structureName: selectedStructure,
      parameters,
      outputName: outputMode === 'same' ? selectedStructure : outputName,
      outputColor,
      direction: marginDirection,
      saveAsSuperstructure: outputMode === 'new' ? saveAsSuperstructure : false,
      outputMode
    });
  };

  const isValid = selectedStructure && 
    (outputMode === 'same' || outputName) && 
    (operationType === 'uniform' ? uniformMargin > 0 : 
     anisotropicMargins.left > 0 || anisotropicMargins.right > 0 || 
     anisotropicMargins.anterior > 0 || anisotropicMargins.posterior > 0 ||
     anisotropicMargins.superior > 0 || anisotropicMargins.inferior > 0);

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    
    const template: MarginTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      selectedStructure,
      operationType,
      marginDirection,
      uniformMargin: operationType === 'uniform' ? uniformMargin : undefined,
      anisotropicMargins: operationType === 'anisotropic' ? { ...anisotropicMargins } : undefined,
      outputName,
      outputColor,
      saveAsSuperstructure,
      createdAt: Date.now()
    };
    
    setTemplates([...templates, template]);
    setTemplateName('');
    setShowSaveTemplateDialog(false);
  };

  const loadTemplate = (template: MarginTemplate) => {
    setSelectedStructure(template.selectedStructure);
    setOperationType(template.operationType);
    setMarginDirection(template.marginDirection);
    if (template.uniformMargin !== undefined) {
      setUniformMargin(template.uniformMargin);
    }
    if (template.anisotropicMargins) {
      setAnisotropicMargins(template.anisotropicMargins);
    }
    setOutputName(template.outputName);
    setOutputColor(template.outputColor);
    setSaveAsSuperstructure(template.saveAsSuperstructure);
    setShowTemplateLibrary(false);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  // Render anisotropic margin input
  const renderAnisotropicInput = (
    key: keyof typeof anisotropicMargins, 
    label: string, 
    colors: { bg: string; border: string; text: string; focus: string }
  ) => (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={anisotropicMargins[key]}
        onChange={(e) => setAnisotropicMargins({ ...anisotropicMargins, [key]: parseFloat(e.target.value) || 0 })}
        min="0"
        step="0.5"
        className={cn(
          "w-11 text-[11px] h-6 px-1.5 rounded text-center font-medium tabular-nums",
          "focus:outline-none focus:ring-1 transition-all",
          colors.bg, colors.border, colors.text, colors.focus
        )}
      />
      <span className={cn("text-[10px] font-bold w-3", colors.text)}>{label}</span>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn("fixed z-50 select-none", isDragging && "cursor-grabbing")}
        style={{
          bottom: `calc(96px - ${position.y}px)`,
          left: `calc(${viewerOffsetLeft}px + 16px + ${position.x}px)`,
        }}
        onMouseDown={(e) => {
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
              isDragging && "ring-2 ring-teal-500/40"
            )}
            style={{
              background: `linear-gradient(180deg, hsla(${accentHue}, 25%, 12%, 0.97) 0%, hsla(${accentHue}, 20%, 8%, 0.99) 100%)`,
              boxShadow: `
                0 8px 24px -4px rgba(0, 0, 0, 0.6),
                0 16px 48px -8px rgba(0, 0, 0, 0.4),
                0 0 0 1px ${accentRgb}15,
                0 0 40px -10px ${accentRgb}15
              `,
            }}
          >
            {/* ===== ROW 1: Source + Operation Type + Direction + Margins ===== */}
            <div className="flex items-center gap-2.5 px-3 py-2">
              {/* Drag Handle */}
              <div 
                data-drag-handle
                className="flex items-center justify-center w-5 h-7 cursor-grab active:cursor-grabbing rounded transition-all hover:bg-white/5"
                style={{ color: `${accentRgb}50` }}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Icon + Title */}
              <div className="flex items-center gap-1.5">
                <Expand className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-[11px] font-semibold text-teal-300">Margin</span>
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Structure Selection */}
              <select
                value={selectedStructure}
                onChange={(e) => setSelectedStructure(e.target.value)}
                className="bg-black/30 border border-white/10 text-white text-[11px] h-6 px-2 rounded focus:outline-none focus:border-teal-500/60 min-w-[100px]"
              >
                <option value="" className="bg-gray-900">Source...</option>
                {availableStructures.map(name => (
                  <option key={name} value={name} className="bg-gray-900">{name}</option>
                ))}
              </select>

              <div className="w-px h-6 bg-white/10" />

              {/* Operation Type: Uniform / Anisotropic */}
              <div className="flex items-center gap-0.5 bg-black/20 rounded-md p-0.5">
                <button
                  onClick={() => setOperationType('uniform')}
                  className={cn(
                    'h-5 px-2 rounded text-[10px] font-medium transition-all',
                    operationType === 'uniform'
                      ? 'bg-teal-500/30 text-teal-300'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  Uniform
                </button>
                <button
                  onClick={() => setOperationType('anisotropic')}
                  className={cn(
                    'h-5 px-2 rounded text-[10px] font-medium transition-all',
                    operationType === 'anisotropic'
                      ? 'bg-teal-500/30 text-teal-300'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  Aniso
                </button>
              </div>

              {/* Direction: Expand / Shrink */}
              <div className="flex items-center gap-0.5 bg-black/20 rounded-md p-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMarginDirection('expand')}
                      className={cn(
                        'h-5 px-1.5 rounded text-[10px] font-medium transition-all flex items-center gap-1',
                        marginDirection === 'expand'
                          ? 'bg-emerald-500/30 text-emerald-300'
                          : 'text-gray-500 hover:text-gray-300'
                      )}
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Expand outward</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMarginDirection('shrink')}
                      className={cn(
                        'h-5 px-1.5 rounded text-[10px] font-medium transition-all flex items-center gap-1',
                        marginDirection === 'shrink'
                          ? 'bg-orange-500/30 text-orange-300'
                          : 'text-gray-500 hover:text-gray-300'
                      )}
                    >
                      <Minimize2 className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Shrink inward</TooltipContent>
                </Tooltip>
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Margin Values */}
              <AnimatePresence mode="wait">
                {operationType === 'uniform' ? (
                  <motion.div
                    key="uniform"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="number"
                      value={uniformMargin}
                      onChange={(e) => setUniformMargin(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.5"
                      className="w-14 bg-black/30 border border-white/10 text-white text-[11px] h-6 px-2 rounded focus:outline-none focus:border-teal-500/60 tabular-nums text-center font-medium"
                    />
                    <span className="text-[10px] text-gray-500 font-medium">mm</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="anisotropic"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5"
                  >
                    {renderAnisotropicInput('left', 'L', { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300', focus: 'focus:ring-blue-500/50' })}
                    {renderAnisotropicInput('right', 'R', { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-300', focus: 'focus:ring-orange-500/50' })}
                    {renderAnisotropicInput('anterior', 'A', { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300', focus: 'focus:ring-green-500/50' })}
                    {renderAnisotropicInput('posterior', 'P', { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-300', focus: 'focus:ring-purple-500/50' })}
                    {renderAnisotropicInput('superior', 'S', { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-300', focus: 'focus:ring-cyan-500/50' })}
                    {renderAnisotropicInput('inferior', 'I', { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-300', focus: 'focus:ring-yellow-500/50' })}
                    <span className="text-[10px] text-gray-500 font-medium ml-0.5">mm</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1" />

              {/* Utilities */}
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={resetPosition} 
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Reset position</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={onClose} 
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-red-500/20 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Close (Esc)</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* ===== ROW 2: Output Configuration + Actions ===== */}
            <div className="flex items-center gap-2.5 px-3 py-2 border-t border-white/5">
              {/* Output Mode: New / Same */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 font-medium">Output:</span>
                <div className="flex items-center gap-0.5 bg-black/20 rounded-md p-0.5">
                  <button
                    onClick={() => setOutputMode('new')}
                    className={cn(
                      'h-5 px-2 rounded text-[10px] font-medium transition-all',
                      outputMode === 'new'
                        ? 'bg-blue-500/30 text-blue-300'
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    New
                  </button>
                  <button
                    onClick={() => setOutputMode('same')}
                    className={cn(
                      'h-5 px-2 rounded text-[10px] font-medium transition-all',
                      outputMode === 'same'
                        ? 'bg-amber-500/30 text-amber-300'
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    Same
                  </button>
                </div>
              </div>

              {/* Output Name (only for new) */}
              <AnimatePresence mode="wait">
                {outputMode === 'new' && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5"
                  >
                    <Input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="Name"
                      className="w-28 h-6 px-2 text-[11px] bg-black/30 border-white/10 text-white rounded focus:border-teal-500/60"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Color Picker */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = outputColor;
                    input.onchange = (e) => setOutputColor((e.target as HTMLInputElement).value);
                    input.click();
                  }}
                  className="w-5 h-5 rounded cursor-pointer transition-transform hover:scale-110 border border-white/20"
                  style={{ 
                    backgroundColor: outputColor,
                    boxShadow: `0 0 8px -2px ${outputColor}60`,
                  }}
                />
              </div>

              {/* Auto-update (superstructure) - only for new */}
              <AnimatePresence mode="wait">
                {outputMode === 'new' && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setSaveAsSuperstructure(!saveAsSuperstructure)}>
                          <Switch
                            checked={saveAsSuperstructure}
                            onCheckedChange={setSaveAsSuperstructure}
                            className="scale-75 data-[state=checked]:bg-cyan-500"
                          />
                          <IterationCw className={cn("w-3 h-3 transition-colors", saveAsSuperstructure ? "text-cyan-400" : "text-gray-600")} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                        Auto-update: Re-apply margin when source structure changes
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1" />

              {/* Template buttons */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowSaveTemplateDialog(true)}
                      disabled={!isValid}
                      className={cn(
                        "h-6 px-2 flex items-center gap-1 rounded text-[10px] font-medium transition-all border",
                        isValid
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
                          : "bg-transparent text-gray-600 border-white/10 cursor-not-allowed"
                      )}
                    >
                      <Save className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Save as template</TooltipContent>
                </Tooltip>

                <div className="relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowTemplateLibrary(!showTemplateLibrary)}
                        className={cn(
                          "h-6 px-2 flex items-center gap-1 rounded text-[10px] font-medium transition-all border",
                          showTemplateLibrary
                            ? "bg-purple-500/30 text-purple-300 border-purple-500/40"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30"
                        )}
                      >
                        <Library className="w-3 h-3" />
                        {templates.length > 0 && (
                          <span className="text-[9px] bg-purple-500/40 px-1 rounded">{templates.length}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Template library</TooltipContent>
                  </Tooltip>

                  {/* Template Library Dropdown */}
                  <AnimatePresence>
                    {showTemplateLibrary && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full right-0 mb-2 w-72 max-h-64 overflow-y-auto rounded-xl border border-purple-500/30 shadow-2xl z-50"
                        style={{
                          background: `linear-gradient(180deg, hsla(270, 25%, 12%, 0.98) 0%, hsla(270, 20%, 8%, 0.99) 100%)`,
                        }}
                      >
                        <div className="sticky top-0 flex items-center justify-between px-3 py-2 border-b border-purple-500/20 backdrop-blur-xl">
                          <div className="flex items-center gap-1.5">
                            <Library className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-[11px] text-purple-300 font-semibold">Templates</span>
                          </div>
                          <button
                            onClick={() => setShowTemplateLibrary(false)}
                            className="text-gray-500 hover:text-white transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-2">
                          {templates.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                              <Library className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-[11px]">No saved templates</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {templates.map((template) => (
                                <div
                                  key={template.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                                >
                                  <div className="flex-1 min-w-0 mr-2">
                                    <div className="text-[11px] text-white font-medium truncate">
                                      {template.name}
                                    </div>
                                    <div className="text-[9px] text-gray-500">
                                      {template.operationType === 'uniform' ? 'Uni' : 'Aniso'} • {template.marginDirection}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => loadTemplate(template)}
                                      className="h-5 px-2 rounded text-[10px] font-medium bg-purple-500/30 text-purple-300 hover:bg-purple-500/40 transition-all"
                                    >
                                      Load
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Delete "${template.name}"?`)) {
                                          deleteTemplate(template.id);
                                        }
                                      }}
                                      className="h-5 w-5 flex items-center justify-center rounded text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Apply button */}
              <button
                onClick={handleExecute}
                disabled={!isValid}
                className={cn(
                  "h-6 px-3 flex items-center gap-1.5 rounded-md text-[11px] font-semibold transition-all",
                  isValid 
                    ? "text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 hover:text-emerald-200" 
                    : "text-gray-500 bg-gray-700/30 cursor-not-allowed"
                )}
              >
                <Play className="w-3 h-3" />
                Apply
              </button>
            </div>
          </div>
        </motion.div>

        {/* Save Template Dialog */}
        <AnimatePresence>
          {showSaveTemplateDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
              onClick={() => {
                setShowSaveTemplateDialog(false);
                setTemplateName('');
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-xl border border-teal-500/30 p-4 w-80 shadow-2xl"
                style={{
                  background: `linear-gradient(180deg, hsla(${accentHue}, 25%, 12%, 0.98) 0%, hsla(${accentHue}, 20%, 8%, 0.99) 100%)`,
                }}
              >
                <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                  <Save className="w-4 h-4 text-teal-400" />
                  Save Template
                </h3>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="w-full bg-black/30 border border-white/10 text-white text-sm h-8 px-3 rounded-lg focus:outline-none focus:border-teal-500/60 mb-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && templateName.trim()) {
                      saveTemplate();
                    } else if (e.key === 'Escape') {
                      setShowSaveTemplateDialog(false);
                      setTemplateName('');
                    }
                  }}
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowSaveTemplateDialog(false);
                      setTemplateName('');
                    }}
                    className="h-7 px-3 rounded text-[11px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTemplate}
                    disabled={!templateName.trim()}
                    className={cn(
                      "h-7 px-3 rounded text-[11px] font-medium transition-all",
                      templateName.trim()
                        ? "bg-teal-500/30 text-teal-300 hover:bg-teal-500/40"
                        : "bg-gray-700/30 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
