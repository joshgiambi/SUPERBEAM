/**
 * Margin Operations Toolbar - Aurora Edition V2
 * 
 * Matches the bottom toolbar margin button styling with:
 * - Cyan accent color throughout
 * - Compact, professional design
 * - Template library with popups
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ColorPickerPopover } from '@/components/ui/color-picker';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Expand,
  Shrink,
  X,
  Play,
  GripVertical,
  RotateCcw,
  IterationCw,
  Plus,
  Library,
  Save,
  Trash2,
  FolderOpen,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface MarginTemplate {
  id: string;
  name: string;
  direction: 'expand' | 'shrink';
  marginMm: number;
  selectedStructure?: string;
  outputColor?: string;
  createdAt: number;
}

interface MarginOperationsPrototypeProps {
  availableStructures?: string[];
  selectedForEdit?: number | null;
  structures?: Array<{ roiNumber: number; structureName: string; color: number[] }>;
  onExecute?: (operation: {
    type: 'uniform' | 'anisotropic';
    structureName: string;
    parameters: any;
    outputName: string;
    outputColor: string;
    direction?: 'expand' | 'shrink';
    saveAsSuperstructure?: boolean;
    outputMode: 'new' | 'same';
  }) => void | Promise<void>;
  onClose?: () => void;
  viewerOffsetLeft?: number;
}

interface Position { x: number; y: number; }

// ============================================================================
// HELPERS
// ============================================================================

const STORAGE_KEY = 'margin-toolbar-aurora-v2-position';
const TEMPLATE_KEY = 'margin-templates-simple';

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
  
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

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
    document.addEventListener('mousemove', handleGlobalMouseMove, { capture: true });
    document.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
    document.addEventListener('pointerup', handleGlobalMouseUp, { capture: true });
    window.addEventListener('blur', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true });
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
// MAIN COMPONENT
// ============================================================================

export function MarginOperationsPrototype({ 
  availableStructures = [],
  selectedForEdit,
  structures = [],
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
  const [direction, setDirection] = useState<'expand' | 'shrink'>('expand');
  const [marginMm, setMarginMm] = useState(10); // Default 10mm
  const [outputMode, setOutputMode] = useState<'new' | 'same'>('new');
  const [outputName, setOutputName] = useState('');
  const [outputColor, setOutputColor] = useState('#22C55E'); // Green default
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(false);

  // Template management - simple implementation
  const [templates, setTemplates] = useState<MarginTemplate[]>(() => {
    try {
      const data = localStorage.getItem(TEMPLATE_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Direction-based accent color - cyan for expand, red for shrink
  const directionColor = direction === 'expand' 
    ? { rgb: 'rgb(34, 211, 238)', hue: 187 }   // Cyan
    : { rgb: 'rgb(239, 68, 68)', hue: 0 };     // Red

  // Refs for popup positioning
  const libraryButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-select structure when selectedForEdit changes
  useEffect(() => {
    if (selectedForEdit && structures.length > 0) {
      const struct = structures.find(s => s.roiNumber === selectedForEdit);
      if (struct) {
        setSelectedStructure(struct.structureName);
      }
    }
  }, [selectedForEdit, structures]);

  // Auto-generate output name
  useEffect(() => {
    if (outputMode === 'new' && selectedStructure) {
      const suffix = direction === 'expand' ? `+${marginMm}mm` : `-${marginMm}mm`;
      setOutputName(`${selectedStructure}_${suffix}`);
    }
  }, [selectedStructure, direction, marginMm, outputMode]);

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

  // Get structure color for display
  const getStructureColor = (name: string) => {
    const struct = structures.find(s => s.structureName === name);
    return struct ? `rgb(${struct.color.join(',')})` : 'rgb(128,128,128)';
  };

  const canExecute = selectedStructure && (outputMode === 'same' || outputName);

  // Save template - includes structure and color
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const newTemplate: MarginTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      direction,
      marginMm,
      selectedStructure: selectedStructure || undefined,
      outputColor,
      createdAt: Date.now(),
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(updated));
    setTemplateName('');
    setShowSaveDialog(false);
  };

  // Load template - restores all saved settings
  const loadTemplate = (template: MarginTemplate) => {
    flushSync(() => {
      setDirection(template.direction);
      setMarginMm(template.marginMm);
      if (template.selectedStructure) {
        setSelectedStructure(template.selectedStructure);
      }
      if (template.outputColor) {
        setOutputColor(template.outputColor);
      }
    });
    setShowLibrary(false);
  };

  // Delete template
  const deleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(updated));
  };

  const handleExecute = () => {
    if (!selectedStructure || !canExecute) return;
    
    const actualMargin = direction === 'expand' ? marginMm : -marginMm;
    
    const operationPayload = {
      type: 'uniform' as const,
      structureName: selectedStructure,
      parameters: { margin: actualMargin },
      outputName: outputMode === 'same' ? selectedStructure : outputName,
      outputColor,
      direction,
      saveAsSuperstructure: outputMode === 'new' ? saveAsSuperstructure : false,
      outputMode
    };
    
    onExecute?.(operationPayload);
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Main toolbar container */}
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
              "rounded-2xl backdrop-blur-xl shadow-2xl min-w-[600px]",
              isDragging && "ring-2"
            )}
            style={{
              background: `linear-gradient(180deg, hsla(${directionColor.hue}, 15%, 14%, 0.97) 0%, hsla(${directionColor.hue}, 10%, 10%, 0.99) 100%)`,
              boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${directionColor.rgb}20, 0 0 60px -15px ${directionColor.rgb}15`,
              ...(isDragging ? { ringColor: `${directionColor.rgb}40` } : {}),
            }}
          >
            {/* ===== ROW 1: Header ===== */}
            <div className="flex items-center gap-3 px-3 py-2">
              {/* Drag Handle */}
              <div 
                data-drag-handle
                className="flex items-center justify-center w-6 h-7 cursor-grab active:cursor-grabbing rounded transition-all hover:bg-white/5"
                style={{ color: `${directionColor.rgb}50` }}
              >
                <GripVertical className="w-4 h-4" />
              </div>

              <div className="w-px h-6 bg-white/10" />

              <Expand className="w-4 h-4" style={{ color: directionColor.rgb }} />
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
                  {availableStructures.map(name => (
                    <option key={name} value={name} className="bg-gray-900">{name}</option>
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
                        direction === 'expand' 
                          ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                    >
                      <Expand className="w-3.5 h-3.5" />
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
                        direction === 'shrink' 
                          ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                    >
                      <Shrink className="w-3.5 h-3.5" />
                      Shrink
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Subtract margin (contract)</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex-1" />

              {/* Library Button + Popup */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      ref={libraryButtonRef}
                      onClick={() => { setShowLibrary(!showLibrary); setShowSaveDialog(false); }}
                      className={cn(
                        "h-7 w-7 flex items-center justify-center rounded-lg transition-all",
                        showLibrary 
                          ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40" 
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <Library className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                    Template library ({templates.length})
                  </TooltipContent>
                </Tooltip>
                
                {/* Library Popup - positioned absolutely relative to button */}
                {showLibrary && (
                  <div 
                    className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-cyan-500/40 shadow-2xl z-50"
                    style={{ background: '#0f1419' }}
                  >
                    <div className="px-3 py-2.5 border-b border-cyan-900/50 flex items-center justify-between" style={{ background: '#0c1a22' }}>
                      <div className="flex items-center gap-2">
                        <Library className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-white">Margin Templates</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/30 text-cyan-300">{templates.length}</span>
                      </div>
                      <button 
                        onClick={() => setShowLibrary(false)} 
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="p-2 max-h-64 overflow-y-auto">
                      {templates.length === 0 ? (
                        <div className="py-8 text-center">
                          <FolderOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                          <p className="text-sm text-gray-400">No saved templates</p>
                          <p className="text-xs text-gray-500 mt-1">Save margin settings to reuse them</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {templates.map(template => (
                            <div
                              key={template.id}
                              className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-cyan-950/40 transition-colors group"
                              style={{ background: '#131d24' }}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {template.outputColor && (
                                  <div 
                                    className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                                    style={{ backgroundColor: template.outputColor }}
                                  />
                                )}
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{template.name}</div>
                                  <div className="text-xs text-gray-400">
                                    {template.selectedStructure && <span className="text-cyan-400">{template.selectedStructure} → </span>}
                                    {template.direction === 'expand' ? 'Expand' : 'Shrink'} {template.marginMm}mm
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  loadTemplate(template);
                                }}
                                className="h-7 px-3 text-xs font-medium rounded-lg bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50 border border-cyan-500/40 transition-colors"
                              >
                                Load
                              </button>
                              <button
                                onClick={() => deleteTemplate(template.id)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    ref={saveButtonRef}
                    onClick={() => { setShowSaveDialog(!showSaveDialog); setShowLibrary(false); }}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-lg transition-all",
                      showSaveDialog 
                        ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40" 
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                  Save as template
                </TooltipContent>
              </Tooltip>

              <button onClick={resetPosition} className="h-7 w-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-red-500/20 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ===== ROW 2: Settings ===== */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-t border-white/5" style={{ background: `hsla(${directionColor.hue}, 8%, 8%, 0.8)` }}>
              {/* Margin Distance */}
              <div className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-1.5 border border-white/[0.06]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Distance</span>
                <Slider
                  value={[marginMm]}
                  onValueChange={([val]) => setMarginMm(val)}
                  max={30}
                  min={1}
                  step={0.5}
                  className="w-24 [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-md"
                  style={{ '--slider-thumb-color': directionColor.rgb } as any}
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
                      'px-2.5 h-7 text-[11px] font-medium transition-all',
                      outputMode === 'same' 
                        ? 'bg-white/15 text-white' 
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    Same
                  </button>
                  <button
                    onClick={() => setOutputMode('new')}
                    className={cn(
                      'px-2.5 h-7 text-[11px] font-medium transition-all flex items-center gap-1',
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
                      label=""
                      compact
                      swatchSize="md"
                      side="top"
                      align="start"
                      accentHue={180}
                    />
                    <Input
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="New structure name"
                      className="h-7 w-36 px-2 text-xs bg-black/20 border-white/10 text-white rounded-lg placeholder:text-gray-600"
                    />
                    
                    {/* Superstructure Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            checked={saveAsSuperstructure}
                            onCheckedChange={setSaveAsSuperstructure}
                            className="scale-75 data-[state=checked]:bg-cyan-500"
                          />
                          <IterationCw 
                            className={cn("w-3.5 h-3.5 transition-colors", saveAsSuperstructure ? "text-cyan-400" : "text-gray-600")} 
                            onClick={() => setSaveAsSuperstructure(!saveAsSuperstructure)}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs max-w-[200px]">
                        Auto-update: Re-apply margin when source changes
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1" />

              {/* Execute Button - matches bottom toolbar margin button style */}
              <button
                onClick={handleExecute}
                disabled={!canExecute}
                className={cn(
                  "h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium",
                  canExecute
                    ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 hover:bg-cyan-500/30"
                    : "text-gray-600 cursor-not-allowed bg-white/5"
                )}
              >
                <Play className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Save Dialog Popup */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="fixed z-[60] w-64 rounded-xl border border-cyan-500/40 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ 
              background: '#0f1419',
              bottom: `calc(96px - ${position.y}px + 56px)`,
              left: `calc(${viewerOffsetLeft}px + 16px + ${position.x}px + 455px)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2.5 border-b border-cyan-900/50 flex items-center gap-2" style={{ background: '#0c1a22' }}>
              <Save className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">Save Template</span>
            </div>
            <div className="p-3 space-y-3">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name..."
                className="h-9 bg-gray-800 border-gray-700 text-white text-sm rounded-lg"
                onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
                autoFocus
              />
              <div className="text-xs text-gray-400">
                {direction === 'expand' ? 'Expand' : 'Shrink'} {marginMm}mm
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 h-8 text-sm font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplate}
                  disabled={!templateName.trim()}
                  className={cn(
                    "flex-1 h-8 text-sm font-medium rounded-lg transition-colors",
                    templateName.trim()
                      ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/50"
                      : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
                  )}
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
