/**
 * Bottom Toolbar Prototype V2
 * 
 * Improved arrangement with text labels for contour, boolean, and margin buttons
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Crosshair,
  Ruler,
  Grid3x3,
  Layers,
  Activity,
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
  historyItems?: Array<{ timestamp: number; action: string; structureId?: number }>;
  currentHistoryIndex?: number;
  onSelectHistory?: (index: number) => void;
  className?: string;
  // Context props for adaptive behavior
  hasSecondaries?: boolean;      // Are there secondary series available for fusion?
  hasRTStructures?: boolean;     // Are RT structures loaded?
  viewMode?: 'standard' | 'fusion-layout';  // Current view mode
  // Exit fusion layout callback
  onExitFusionLayout?: () => void;
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
}: BottomToolbarPrototypeV2Props) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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
    
    // Show exit button when in fusion-layout (split view) mode
    // In split view, fusion controls are in the CompactToolbar, so we just show exit
    if (viewMode === 'fusion-layout' && onExitFusionLayout) {
      viewModeTools.push({ id: 'separator', group: 'viewmode' });
      viewModeTools.push({ id: 'exit-split', icon: X, label: 'Exit Split View', group: 'viewmode', variant: 'destructive' });
    }
    
    // Structure tools - only when RT structures are loaded
    const structureTools = [];
    if (hasRTStructures) {
      structureTools.push({ id: 'separator', group: 'structures' });
      structureTools.push({ id: 'localization', icon: Target, label: 'Localize Structure', selectable: true, group: 'structures' });
    }
    
    // Info tools - always available
    const infoTools = [
      { id: 'separator', group: 'info' },
      { id: 'metadata', icon: Info, label: 'DICOM Metadata', group: 'info' },
      { id: 'help', icon: HelpCircle, label: 'Help', group: 'info' },
    ];
    
    return [...baseTools, ...viewModeTools, ...structureTools, ...infoTools];
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
      case 'exit-split':
        onExitFusionLayout?.();
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
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-2 duration-300 ${className || ''}`}>
      {/* Toolbar Container */}
      <div className="relative flex items-center gap-6">
        {/* Undo/Redo/History Group - Separate Container */}
        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-2 py-2 shadow-2xl">
          <div className="flex items-center gap-1.5">
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Undo"
                className="h-8 w-8 p-0 transition-all duration-200 rounded-lg text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-50"
                disabled={!canUndo}
                onClick={onUndo}
              >
                <Undo className="w-4 h-4" />
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Undo
              </div>
            </div>

            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Redo"
                className="h-8 w-8 p-0 transition-all duration-200 rounded-lg text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-50"
                disabled={!canRedo}
                onClick={onRedo}
              >
                <Redo className="w-4 h-4" />
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Redo
              </div>
            </div>

            <div className="relative">
              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 transition-all duration-200 rounded-lg ${showHistory ? 'bg-orange-600/20 text-orange-400 border-[0.5px] border-orange-500/50 shadow-sm' : 'text-white/90 hover:bg-white/20 hover:text-white'} disabled:opacity-50`}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-orange-600/95 via-orange-500/95 to-orange-600/95 border border-orange-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  History
                </div>
              </div>

              {showHistory && (
                <div className="absolute bottom-full left-0 mb-2 bg-black/95 border border-orange-400/50 rounded-lg shadow-2xl backdrop-blur-sm w-96 max-h-96 overflow-y-auto z-[100]">
                  <div className="sticky top-0 bg-gray-900/95 border-b border-orange-400/30 p-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-orange-400" />
                        <span className="text-sm text-orange-200 font-semibold">Edit History</span>
                      </div>
                      <button 
                        className="text-gray-400 hover:text-gray-200 transition-colors"
                        onClick={() => setShowHistory(false)}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    {historyItems.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <History className="w-10 h-10 mx-auto mb-2 text-gray-600" />
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
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                              index === currentHistoryIndex
                                ? 'bg-orange-600/20 text-orange-200 border border-orange-500/50'
                                : 'text-gray-300 hover:bg-gray-800/50'
                            }`}
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
        </div>

        {/* Main Toolbar with Contour/Boolean/Margin attached */}
        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3">
          {/* Main Tool Buttons */}
          <div className="flex items-center gap-1">
            {tools.map((tool, index) => {
              if (tool.id === 'separator') {
                return (
                  <div key={index} className="w-px h-5 bg-white/30 mx-1" />
                );
              }

              const IconComponent = tool.icon!;
              const isActive = tool.selectable && getActiveToolState(tool.id);
              const isExitButton = tool.id === 'exit-split';

              return (
                <div key={tool.id} className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={tool.label}
                    className={`
                      transition-all duration-200 rounded-lg
                      ${isExitButton 
                        ? 'h-8 px-3 gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/40 hover:border-red-500/60 flex items-center'
                        : `h-8 w-8 p-0 text-white/90 ${
                            tool.id === 'mpr' && isActive
                              ? 'bg-green-600/20 text-green-400 border-[0.5px] border-green-500/50 shadow-sm' 
                              : tool.id === 'localization' && isActive
                              ? 'bg-orange-600/20 text-orange-400 border-[0.5px] border-orange-500/50 shadow-sm'
                              : isActive 
                              ? 'bg-blue-600/20 text-blue-400 border-[0.5px] border-blue-500/50 shadow-sm' 
                              : 'hover:bg-white/20 hover:text-white'
                          }`
                      }
                    `}
                    onClick={() => handleToolClick(tool.id)}
                  >
                    <IconComponent className={isExitButton ? "w-3.5 h-3.5" : "w-4 h-4"} />
                    {isExitButton && <span className="text-xs font-medium">Exit Split</span>}
                  </Button>

                  {/* Tooltip */}
                  <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 border text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg ${
                    isExitButton 
                      ? 'bg-gradient-to-br from-red-600/95 via-red-500/95 to-red-600/95 border-red-400/30'
                      : 'bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border-gray-400/30'
                  }`}>
                    {tool.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contour/Boolean/Margin Group - Attached to Main Toolbar */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/20">
            {/* Contour Edit Button */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={onContourEdit}
                className={`h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2 ${
                  isContourEditActive
                    ? 'bg-green-600/20 text-green-300 border-[0.5px] border-green-500/50 shadow-sm'
                    : 'text-white/90 hover:bg-white/20 hover:text-white border-[0.5px] border-transparent'
                }`}
              >
                <Highlighter className="w-4 h-4" />
                <span className="text-sm font-medium">Contour</span>
              </Button>
            </div>
            
            {/* Boolean Operations Button */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={onContourOperations}
                className={`h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2 ${
                  isContourOperationsActive
                    ? 'bg-blue-600/20 text-blue-300 border-[0.5px] border-blue-500/50 shadow-sm'
                    : 'text-white/90 hover:bg-white/20 hover:text-white border-[0.5px] border-transparent'
                }`}
              >
                <SquaresSubtract className="w-4 h-4" />
                <span className="text-sm font-medium">Boolean</span>
              </Button>
            </div>

            {/* Advanced Margin Tool Button */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdvancedMarginTool}
                className={`h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2 ${
                  isAdvancedMarginToolActive
                    ? 'bg-purple-600/20 text-purple-300 border-[0.5px] border-purple-500/50 shadow-sm'
                    : 'text-white/90 hover:bg-white/20 hover:text-white border-[0.5px] border-transparent'
                }`}
              >
                <Expand className="w-4 h-4" />
                <span className="text-sm font-medium">Margin</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

