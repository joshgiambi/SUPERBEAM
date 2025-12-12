/**
 * Contour Toolbar V2 Prototype
 * 
 * Modern redesign of the contouring toolbar adopting the design language
 * from the Unified Fusion/Layout Toolbar:
 * - Dark #0f1219 background with backdrop blur
 * - Minimal height (~44px) to maximize scan viewing area
 * - Grouped button segments with subtle dark containers
 * - Clean separators and consistent icon sizing
 * - Structure color accents without overwhelming the UI
 * 
 * All existing functionality preserved in a more compact layout.
 */

import React, { useState, useMemo } from 'react';
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
  Palette,
  Settings2,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ContourToolbarV2Props {
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
  pixelSpacing?: number; // mm per pixel for size display

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ContourToolbarV2({
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
}: ContourToolbarV2Props) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(structureName);

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

  // Render tool-specific inline settings
  const renderToolSettings = () => {
    if (!activeTool) return null;

    if (activeTool === 'brush') {
      return (
        <>
          <div className="w-px h-5 bg-white/10" />
          
          {/* Brush Size */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-md border border-white/10">
            <span className="text-[9px] text-gray-400 uppercase tracking-wide">Size</span>
            <Slider
              value={[brushSize]}
              onValueChange={([val]) => onBrushSizeChange(val)}
              max={100}
              min={1}
              step={1}
              className="w-20 [&>span:first-child]:h-1 [&>span:first-child]:bg-gray-700 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
            />
            <span 
              className="text-[10px] font-medium min-w-[40px] text-center tabular-nums"
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
                  'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                  smartBrushEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                )}
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Smart Brush (edge-aware)</TooltipContent>
          </Tooltip>

          {/* Prediction Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onPredictionToggle(!predictionEnabled)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                  predictionEnabled
                    ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">AI Prediction</TooltipContent>
          </Tooltip>

          {/* Prediction Accept/Reject */}
          {predictionEnabled && hasPrediction && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onAcceptPrediction}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Accept (A)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onRejectPrediction}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Reject (X)</TooltipContent>
              </Tooltip>
            </>
          )}

          {predictionEnabled && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-cyan-500/30 text-cyan-300 bg-cyan-950/30">
              Raycast ~50ms
            </Badge>
          )}
        </>
      );
    }

    if (activeTool === 'pen') {
      return (
        <>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-[10px] text-gray-400">Eclipse Pen • Click to place vertices, right-click to close</span>
        </>
      );
    }

    if (activeTool === 'erase') {
      return (
        <>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-[10px] text-gray-400">Using brush size • Hold Shift with brush for quick erase</span>
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
          
          {/* Smooth toggle */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded-md border border-white/5">
            <Switch
              checked={aiTumorSmoothOutput || false}
              onCheckedChange={(checked) => onAiTumorSmoothChange?.(checked)}
              className="data-[state=checked]:bg-emerald-500 scale-75"
            />
            <span className="text-[10px] text-gray-400">Smooth</span>
          </div>

          <button
            onClick={onAiTumorGenerate}
            className="h-7 px-3 flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-500/80 border border-emerald-500/50 text-white rounded-md transition-colors text-xs font-medium"
          >
            <Sparkles className="w-3 h-3" />
            Generate
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAiTumorClear}
                className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear point</TooltipContent>
          </Tooltip>
        </>
      );
    }

    return null;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0f1219]/95 backdrop-blur-sm border-b border-white/[0.06]">
        {/* Left Section: Structure Info */}
        <div className="flex items-center gap-2">
          {/* Structure Color Dot + Name */}
          <div className="flex items-center gap-2 pl-1">
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
                  className="w-3.5 h-3.5 rounded-sm border border-white/30 cursor-pointer hover:border-white/60 transition-all hover:scale-110"
                  style={{ backgroundColor: structureColorRgb }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">Change color</TooltipContent>
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
                <TooltipContent side="bottom">Click to rename</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="w-px h-5 bg-white/10" />

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
                        'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs',
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
                      <span className="font-medium">{tool.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{tool.label} ({tool.shortcut})</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Inline Tool Settings */}
          {renderToolSettings()}
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={cn(
                    'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                    canUndo
                      ? 'text-gray-400 hover:text-white hover:bg-white/10'
                      : 'text-gray-600 cursor-not-allowed'
                  )}
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={cn(
                    'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                    canRedo
                      ? 'text-gray-400 hover:text-white hover:bg-white/10'
                      : 'text-gray-600 cursor-not-allowed'
                  )}
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Redo (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Quick Actions */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onDeleteSlice}
                  className="h-7 px-2 flex items-center gap-1 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Del</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Delete current slice (Del)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onInterpolate}
                  className="h-7 px-2 flex items-center gap-1 rounded-md text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all text-xs"
                >
                  <GitBranch className="w-3 h-3" />
                  <span>Interp</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Interpolate missing slices</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSmooth}
                  className="h-7 px-2 flex items-center gap-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all text-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Smooth</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Smooth contours</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px] bg-gray-900/95 border-gray-700">
              <div className="px-2 py-1.5 text-[10px] text-gray-400 uppercase border-b border-gray-700/50">
                Delete Operations
              </div>
              <DropdownMenuItem onClick={() => onDeleteNth(2)} className="text-xs cursor-pointer text-orange-400">
                <Grid3x3 className="w-3.5 h-3.5 mr-2" />
                Delete every 2nd slice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteNth(3)} className="text-xs cursor-pointer text-orange-400">
                <Grid3x3 className="w-3.5 h-3.5 mr-2" />
                Delete every 3rd slice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteNth(4)} className="text-xs cursor-pointer text-orange-400">
                <Grid3x3 className="w-3.5 h-3.5 mr-2" />
                Delete every 4th slice
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <div className="px-2 py-1.5 text-[10px] text-gray-400 uppercase">
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

              <DropdownMenuSeparator />
              
              <div className="px-2 py-1.5 text-[10px] text-gray-400 uppercase">
                Blob Tools
              </div>
              <DropdownMenuItem onClick={onOpenBlobTools} className="text-xs cursor-pointer text-purple-400">
                <SplitSquareHorizontal className="w-3.5 h-3.5 mr-2" />
                Blob operations...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-white/10" />

          {/* Close Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClose}
                className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close toolbar (Esc)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// DEMO COMPONENT FOR PROTOTYPE PAGE
// ============================================================================

export function ContourToolbarV2Prototype() {
  const [activeTool, setActiveTool] = useState<string | null>('brush');
  const [brushSize, setBrushSize] = useState(15);
  const [smartBrush, setSmartBrush] = useState(false);
  const [prediction, setPrediction] = useState(false);
  const [hasPrediction, setHasPrediction] = useState(false);
  const [aiSmooth, setAiSmooth] = useState(false);
  const [structureName, setStructureName] = useState('GTV Primary');
  const [structureColor, setStructureColor] = useState([255, 100, 100]);

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
            Contour Toolbar V2 Prototype
          </CardTitle>
          <CardDescription>
            Modern redesign adopting the Unified Fusion/Layout Toolbar design language.
            Minimal height, dark subpanel, structure color accents.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-gray-400 space-y-2">
          <p><strong className="text-white">Key Improvements:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Reduced height from ~80px to ~44px for maximum scan visibility</li>
            <li>Dark #0f1219 background matching fusion toolbar</li>
            <li>Grouped tool buttons with subtle container styling</li>
            <li>Structure color used as accent, not background</li>
            <li>Inline tool settings appear contextually</li>
            <li>Less common actions moved to "More" dropdown</li>
          </ul>
        </CardContent>
      </Card>

      {/* Structure Selector Demo */}
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

      {/* Tool State Demo */}
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

      {/* Main Toolbar Demo */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">CONTOUR TOOLBAR V2</CardTitle>
          <CardDescription>Positioned at top of viewport area</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-black rounded-xl border border-gray-800 overflow-hidden">
            {/* Toolbar */}
            <ContourToolbarV2
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
              onClose={() => console.log('Close')}
              onAiTumorGenerate={() => console.log('Generate AI tumor')}
              onAiTumorClear={() => console.log('Clear AI point')}
              aiTumorSmoothOutput={aiSmooth}
              onAiTumorSmoothChange={setAiSmooth}
            />

            {/* Mock Viewport */}
            <div className="h-64 bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
              <div className="text-gray-600 text-sm">
                DICOM Viewport Area
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison with Old Toolbar */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Design Comparison</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <h4 className="text-red-400 font-medium">Old Toolbar</h4>
            <ul className="text-gray-400 space-y-1">
              <li>• ~80px height</li>
              <li>• Hue-tinted background per structure</li>
              <li>• All actions visible (cluttered)</li>
              <li>• Two-row layout</li>
              <li>• Settings in separate panels</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-emerald-400 font-medium">New Toolbar V2</h4>
            <ul className="text-gray-400 space-y-1">
              <li>• ~44px height (45% smaller)</li>
              <li>• Consistent dark #0f1219 background</li>
              <li>• Primary actions visible, rest in dropdown</li>
              <li>• Single-row layout</li>
              <li>• Inline contextual settings</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

