/**
 * Bottom Toolbar Prototype V2
 * 
 * V4 Aurora Edition - Improved arrangement with text labels for contour, boolean, and margin buttons
 * Using the V4 Aurora design language with dark gradients, subtle glows, and refined styling.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Crosshair,
  Ruler,
  Grid3x3,
  Layers,
  Target,
  Info,
  HelpCircle,
  Highlighter,
  SquaresSubtract,
  Expand,
  Undo,
  Redo,
  History,
  X
} from 'lucide-react';

interface BottomToolbarPrototypeV2Props {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToWindow?: () => void;
  onPan?: () => void;
  onMeasure?: () => void;
  onCrosshairs?: () => void;
  onContourEdit?: () => void;
  onContourOperations?: () => void;
  onAdvancedMarginTool?: () => void;
  isContourEditActive?: boolean;
  isContourOperationsActive?: boolean;
  isAdvancedMarginToolActive?: boolean;
  isPanActive?: boolean;
  isMeasureActive?: boolean;
  isCrosshairsActive?: boolean;
  onMPRToggle?: () => void;
  isMPRActive?: boolean;
  onFusionToggle?: () => void;
  isFusionActive?: boolean;
  onLocalization?: () => void;
  isLocalizationActive?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  historyItems?: Array<{ timestamp: number; action: string; structureId?: number; structureName?: string; slicePosition?: number }>;
  currentHistoryIndex?: number;
  onSelectHistory?: (index: number) => void;
  className?: string;
  // Context props for adaptive behavior
  hasSecondaries?: boolean;      // Are there secondary series available for fusion?
  hasRTStructures?: boolean;     // Are RT structures loaded?
  viewMode?: 'standard' | 'fusion-layout';  // Current view mode
  // Exit fusion layout callback
  onExitFusionLayout?: () => void;
  // Positioning props - offset to center relative to viewer area (accounting for sidebar)
  viewerOffsetLeft?: number;     // Left offset in pixels (e.g., sidebar width)
}

export function BottomToolbarPrototypeV2({
  onZoomIn,
  onZoomOut,
  onFitToWindow,
  onPan,
  onMeasure,
  onCrosshairs,
  onContourEdit,
  onContourOperations,
  onAdvancedMarginTool,
  isContourEditActive = false,
  isContourOperationsActive = false,
  isAdvancedMarginToolActive = false,
  isPanActive = false,
  isMeasureActive = false,
  isCrosshairsActive = false,
  onMPRToggle,
  isMPRActive = false,
  onFusionToggle,
  isFusionActive = false,
  onLocalization,
  isLocalizationActive = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  historyItems = [],
  currentHistoryIndex = -1,
  onSelectHistory,
  className,
  // Context props for adaptive behavior
  hasSecondaries = false,
  hasRTStructures = false,
  viewMode = 'standard',
  onExitFusionLayout,
  // Positioning - offset to center relative to viewer (accounts for sidebar)
  viewerOffsetLeft = 0,
}: BottomToolbarPrototypeV2Props) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // Visual tuning: nudge the whole toolbar slightly to the right from true center.
  // Increase/decrease this if you want it more/less offset.
  const centerNudgePx = 24;

  // Build adaptive tools list based on context
  const tools = useMemo(() => {
    const baseTools = [
      // Core navigation tools - always shown
      { id: 'zoom-in', icon: ZoomIn, label: 'Zoom In', group: 'navigation' },
      { id: 'zoom-out', icon: ZoomOut, label: 'Zoom Out', group: 'navigation' },
      { id: 'fit', icon: Maximize2, label: 'Fit to Window', group: 'navigation' },
      { id: 'separator', group: 'navigation' },
      { id: 'pan', icon: Hand, label: 'Pan', selectable: true, group: 'tools' },
      { id: 'crosshairs', icon: Crosshair, label: 'Crosshairs', selectable: true, group: 'tools' },
      { id: 'measure', icon: Ruler, label: 'Measure', selectable: true, group: 'tools' },
    ];
    
    // View mode tools - contextual
    const viewModeTools = [];
    
    // Only show MPR in standard mode (not in multi-viewport where it's handled differently)
    if (viewMode === 'standard') {
      viewModeTools.push({ id: 'separator', group: 'viewmode' });
      viewModeTools.push({ id: 'mpr', icon: Grid3x3, label: 'MPR View', selectable: true, group: 'viewmode' });
    }
    
    // Show fusion toggle in standard mode (split view has CompactToolbar with integrated controls)
    if (hasSecondaries && viewMode === 'standard') {
      viewModeTools.push({ id: 'fusion', icon: Layers, label: 'Fusion Panel', selectable: true, group: 'viewmode' });
    }
    
    
    // Structure tools - only when RT structures are loaded
    const structureTools = [];
    if (hasRTStructures) {
      structureTools.push({ id: 'separator', group: 'structures' });
      structureTools.push({ id: 'localization', icon: Target, label: 'Localize Structure', selectable: true, group: 'structures' });
    }
    
    // Info tools are now in a separate right subpanel, so removed from main array
    
    return [...baseTools, ...viewModeTools, ...structureTools];
  }, [viewMode, hasSecondaries, hasRTStructures]);

  const handleToolClick = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (tool?.selectable) {
      setActiveTool(activeTool === toolId ? null : toolId);
    }
    
    // Call appropriate handler
    switch (toolId) {
      case 'zoom-in':
        onZoomIn?.();
        break;
      case 'zoom-out':
        onZoomOut?.();
        break;
      case 'fit':
        onFitToWindow?.();
        break;
      case 'pan':
        onPan?.();
        break;
      case 'measure':
        onMeasure?.();
        break;
      case 'crosshairs':
        onCrosshairs?.();
        break;
      case 'mpr':
        onMPRToggle?.();
        break;
      case 'fusion':
        onFusionToggle?.();
        break;
      case 'localization':
        onLocalization?.();
        break;
    }
  };

  const getActiveToolState = (toolId: string) => {
    switch (toolId) {
      case 'mpr':
        return isMPRActive;
      case 'fusion':
        return isFusionActive;
      case 'localization':
        return isLocalizationActive;
      case 'pan':
        return isPanActive;
      case 'measure':
        return isMeasureActive;
      case 'crosshairs':
        return isCrosshairsActive;
      default:
        return activeTool === toolId;
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* 
        IMPORTANT: Framer Motion sets an inline `transform` during animation.
        If we put Tailwind's `-translate-x-1/2` on the motion element, it gets overwritten,
        causing the toolbar to appear shifted to the right.
        So we center with a non-animated wrapper, and animate only the inner content.
      */}
      <div
        className={`fixed bottom-6 left-1/2 z-40 ${className || ''}`}
        style={{ transform: `translateX(calc(-50% + ${centerNudgePx}px))` }}
      >
        <motion.div 
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.4, 
            ease: [0.16, 1, 0.3, 1], // Custom spring-like easing
            opacity: { duration: 0.3 },
            scale: { duration: 0.35 }
          }}
        >
          {/* Toolbar Container */}
          <div className="relative flex items-center gap-3">
          {/* Undo/Redo/History Group - Separate Container */}
          <div 
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 32, 44, 0.95) 0%, rgba(20, 22, 30, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
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
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Undo (Ctrl+Z)</TooltipContent>
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
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Redo (Ctrl+Y)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={cn(
                      'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                      showHistory 
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' 
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <History className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Edit History</TooltipContent>
              </Tooltip>

              {/* History Dropdown */}
              {showHistory && (
                <div 
                  className="absolute bottom-full left-0 mb-2 w-80 max-h-80 overflow-y-auto rounded-xl z-[100]"
                  style={{
                    background: 'linear-gradient(180deg, rgba(30, 32, 44, 0.98) 0%, rgba(20, 22, 30, 0.99) 100%)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5), 0 0 40px -10px rgba(251, 191, 36, 0.15)',
                  }}
                >
                  <div 
                    className="sticky top-0 p-3 border-b"
                    style={{
                      background: 'rgba(30, 32, 44, 0.98)',
                      borderColor: 'rgba(251, 191, 36, 0.2)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-amber-200 font-semibold">Edit History</span>
                      </div>
                      <button 
                        className="text-gray-400 hover:text-white transition-colors h-6 w-6 flex items-center justify-center rounded-md hover:bg-white/10"
                        onClick={() => setShowHistory(false)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-2">
                    {historyItems.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <History className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                        <p className="text-xs font-medium">No history yet</p>
                        <p className="text-[10px] mt-1 text-gray-500">Edit actions will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {historyItems.map((item, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              onSelectHistory?.(index);
                              setShowHistory(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-lg text-xs transition-all',
                              index === currentHistoryIndex
                                ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                                : 'text-gray-300 hover:bg-white/5 hover:text-white'
                            )}
                          >
                            <div className="font-medium">{item.action}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {item.structureName || `Structure ${item.structureId}`}
                              {item.slicePosition !== undefined && ` • Slice ${item.slicePosition.toFixed(1)}`}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Toolbar with Contour/Boolean/Margin attached */}
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 32, 44, 0.95) 0%, rgba(20, 22, 30, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            }}
          >
            {/* Main Tool Buttons */}
            <div className="flex items-center gap-0.5">
              {tools.map((tool, index) => {
                if (tool.id === 'separator') {
                  return (
                    <div key={index} className="w-px h-5 bg-white/10 mx-1.5" />
                  );
                }

                const IconComponent = tool.icon!;
                const isActive = tool.selectable && getActiveToolState(tool.id);

                // Determine active color scheme based on tool type
                const getActiveStyles = () => {
                  if (tool.id === 'mpr' && isActive) {
                    return 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40';
                  }
                  if (tool.id === 'fusion' && isActive) {
                    return 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40';
                  }
                  if (tool.id === 'localization' && isActive) {
                    return 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40';
                  }
                  if (isActive) {
                    return 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40';
                  }
                  return 'text-white/70 hover:text-white hover:bg-white/10';
                };

                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleToolClick(tool.id)}
                        className={cn(
                          'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                          getActiveStyles()
                        )}
                      >
                        <IconComponent className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">{tool.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Separator before Contour/Boolean/Margin */}
            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Contour/Boolean/Margin Group */}
            <div className="flex items-center gap-1">
              {/* Contour Edit Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onContourEdit}
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
              
              {/* Boolean Operations Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onContourOperations}
                    className={cn(
                      'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                      isContourOperationsActive 
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

              {/* Advanced Margin Tool Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onAdvancedMarginTool}
                    className={cn(
                      'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                      isAdvancedMarginToolActive 
                        ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40' 
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <Expand className="w-4 h-4" />
                    <span>Margin</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Advanced Margins</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Info/Help Group - Right Subpanel (mirrors Undo/History on left) */}
          <div 
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 32, 44, 0.95) 0%, rgba(20, 22, 30, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Info className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">DICOM Metadata</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all text-white/70 hover:text-white hover:bg-white/10"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">Help & Shortcuts</TooltipContent>
            </Tooltip>
          </div>
        </div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}

