/**
 * FlexibleFusionLayout - Responsive Multi-Viewport Grid System
 * 
 * This component provides a flexible multi-viewport layout with:
 * - Responsive grid system with layout presets
 * - Primary viewport showing CT with optional fusion overlay
 * - Secondary viewports showing fused versions (CT + different secondaries)
 * - Synchronized scrolling, zoom, pan across all viewports
 * - RT structure visibility per viewport
 * - MPR toggle per viewport
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, Columns2, Rows3, PanelLeftClose, PanelRightClose,
  Box, X, Layers, ArrowLeftRight, Eye, EyeOff, Plus, 
  Maximize2, ZoomIn, ZoomOut, RotateCcw, AlertCircle, RefreshCw,
  ChevronDown, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WorkingViewer } from './working-viewer';
import type { DICOMSeries } from '@/lib/dicom-utils';
import { useViewportToolState } from '@/lib/tool-state-manager';
// OHIF-style viewport components
import { ViewportPaneOHIF } from './viewport-pane-ohif';

export type LayoutPreset = 
  | 'single'            // Single viewport only
  | 'side-by-side'      // 50/50 horizontal
  | 'primary-focus'     // 70/30 horizontal (primary larger)
  | 'secondary-focus'   // 30/70 horizontal (secondary larger)
  | 'vertical-stack'    // vertical arrangement
  | 'triple'            // 3 viewports (1 + 2)
  | 'quad';             // 2x2 grid for multiple secondaries

interface ViewportConfig {
  id: string;
  secondarySeriesId: number | null; // Which secondary to show fused with primary
  showStructures: boolean;
  showMPR: boolean;
  loadError: string | null;
  isRetrying: boolean;
}

interface SyncState {
  currentIndex: number;
  zoom: number;
  panX: number;
  panY: number;
  windowLevel: { window: number; level: number };
  crosshairPos: { x: number; y: number };
}

interface FlexibleFusionLayoutProps {
  primarySeriesId: number;
  secondarySeriesIds: number[]; // All available secondaries for the primary
  studyId: number;
  availableSeries: DICOMSeries[];
  
  // Fusion settings
  fusionOpacity: number;
  onFusionOpacityChange?: (opacity: number) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  onFusionWindowLevelChange?: (wl: { window: number; level: number } | null) => void;
  
  // RT Structure props
  rtStructures?: any;
  structureVisibility?: Map<number, boolean>;
  allStructuresVisible?: boolean;
  selectedForEdit?: number | null;
  selectedStructures?: Set<number>;
  onContourUpdate?: any;
  onRTStructureUpdate?: any;
  contourSettings?: any;
  
  // Brush tool
  brushToolState?: any;
  onBrushSizeChange?: (size: number) => void;
  
  // Window/level
  windowLevel?: { window: number; level: number };
  onWindowLevelChange?: (wl: { window: number; level: number }) => void;
  
  // Image cache
  imageCache?: any;
  
  // Registration
  registrationAssociations?: any;
  
  // Callbacks
  onLayoutChange?: (layout: LayoutPreset) => void;
  onSwapViewports?: () => void;
  
  // Fusion statuses
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  
  // Current selected secondary from FusionControlPanelV2
  selectedFusionSecondaryId: number | null;
  onSecondarySeriesSelect: (id: number | null) => void;
  
  // Current fusion display mode from FusionControlPanelV2
  fusionDisplayMode: 'overlay' | 'side-by-side';
  
  // Current fusion layout preset from FusionControlPanelV2
  fusionLayoutPreset: LayoutPreset;
  
  // MPR
  isMPRVisible?: boolean;
  onMPRToggle?: () => void;
  
  // External zoom sync - allows parent to control zoom across all viewports
  externalZoom?: number;
  onZoomChange?: (zoom: number) => void;
  
  // Exit callback - return to overlay/single mode
  onExitToOverlay?: () => void;
  
  // Viewport assignments callback - reports which secondary series is in which viewport
  // Map key is viewport number (1-indexed), value is secondary series ID (null for primary-only)
  onViewportAssignmentsChange?: (assignments: Map<number, number | null>) => void;
}

const LAYOUT_PRESETS: { id: LayoutPreset; label: string; icon: React.ReactNode; description: string; viewports: number }[] = [
  { 
    id: 'single', 
    label: '1×1', 
    icon: <Maximize2 className="w-4 h-4" />,
    description: 'Single viewport',
    viewports: 1
  },
  { 
    id: 'side-by-side', 
    label: '1×2', 
    icon: <Columns2 className="w-4 h-4" />,
    description: 'Two viewports side-by-side',
    viewports: 2
  },
  { 
    id: 'primary-focus', 
    label: '70/30', 
    icon: <PanelRightClose className="w-4 h-4" />,
    description: 'Primary focus',
    viewports: 2
  },
  { 
    id: 'secondary-focus', 
    label: '30/70', 
    icon: <PanelLeftClose className="w-4 h-4" />,
    description: 'Secondary focus',
    viewports: 2
  },
  { 
    id: 'vertical-stack', 
    label: 'Stack', 
    icon: <Rows3 className="w-4 h-4" />,
    description: 'Vertical stack',
    viewports: 2
  },
  { 
    id: 'triple', 
    label: '1+2', 
    icon: <LayoutGrid className="w-4 h-4" />,
    description: 'Triple view',
    viewports: 3
  },
  { 
    id: 'quad', 
    label: '2×2', 
    icon: <LayoutGrid className="w-4 h-4" />,
    description: '2×2 grid',
    viewports: 4
  },
];

interface ViewportPaneProps {
  config: ViewportConfig;
  isPrimary: boolean;
  primarySeriesId: number;
  studyId: number;
  availableSeries: DICOMSeries[];
  secondarySeriesIds: number[]; // All available secondaries for selection
  syncState: SyncState;
  onSyncUpdate: (updates: Partial<SyncState>) => void;
  onToggleStructures: () => void;
  onToggleMPR: () => void;
  onRemove?: () => void;
  canRemove: boolean;
  onChangeSecondary: (secondaryId: number | null) => void; // Change assigned secondary
  onLoadError: (error: string | null) => void;
  onRetry: () => void;
  // Pass-through props
  fusionOpacity: number;
  onFusionOpacityChange?: (opacity: number) => void;
  rtStructures?: any;
  structureVisibility?: Map<number, boolean>;
  allStructuresVisible?: boolean;
  selectedForEdit?: number | null;
  selectedStructures?: Set<number>;
  onContourUpdate?: any;
  onRTStructureUpdate?: any;
  contourSettings?: any;
  brushToolState?: any;
  onBrushSizeChange?: (size: number) => void;
  windowLevel?: { window: number; level: number };
  onWindowLevelChange?: (wl: { window: number; level: number }) => void;
  imageCache?: any;
  registrationAssociations?: any;
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  style?: React.CSSProperties;
  // Optimization props
  initialImages?: any[];
  pixelDataCache?: React.MutableRefObject<Map<string, any>>;
}

const ViewportPane: React.FC<ViewportPaneProps> = ({
  config,
  isPrimary,
  primarySeriesId,
  studyId,
  availableSeries,
  secondarySeriesIds,
  syncState,
  onSyncUpdate,
  onToggleStructures,
  onToggleMPR,
  onRemove,
  canRemove,
  onChangeSecondary,
  onLoadError,
  onRetry,
  fusionOpacity,
  onFusionOpacityChange,
  rtStructures,
  structureVisibility,
  allStructuresVisible,
  selectedForEdit,
  selectedStructures,
  onContourUpdate,
  onRTStructureUpdate,
  contourSettings,
  brushToolState,
  onBrushSizeChange,
  windowLevel,
  onWindowLevelChange,
  imageCache,
  registrationAssociations,
  fusionSecondaryStatuses,
  fusionManifestLoading,
  fusionManifestPrimarySeriesId,
  style,
  initialImages,
  pixelDataCache,
}) => {
  const viewerRef = useRef<any>(null);
  const [retryKey, setRetryKey] = useState(0);
  
  // Independent tool state per viewport
  const { toolState, setActiveTool, setToolProperty } = useViewportToolState(config.id);

  // Derive brushToolState for WorkingViewer from local independent state
  const localBrushToolState = useMemo(() => ({
    tool: toolState.activeTool,
    brushSize: toolState.toolProperties.brushSize || 20,
    isActive: toolState.isActive ?? true,
    predictionEnabled: toolState.toolProperties.predictionEnabled,
    smartBrushEnabled: toolState.toolProperties.smartBrushEnabled,
    predictionMode: toolState.toolProperties.predictionMode,
    mem3dParams: toolState.toolProperties.mem3dParams,
  }), [toolState]);

  const handleLocalBrushSizeChange = useCallback((size: number) => {
    setToolProperty('brushSize', size);
    if (onBrushSizeChange) onBrushSizeChange(size);
  }, [setToolProperty, onBrushSizeChange]);

  const handleLocalBrushToolChange = useCallback((state: any) => {
    if (state.tool !== undefined) setActiveTool(state.tool);
    if (state.brushSize !== undefined) setToolProperty('brushSize', state.brushSize);
    Object.entries(state).forEach(([k, v]) => {
      if (k !== 'tool' && k !== 'brushSize') setToolProperty(k, v);
    });
  }, [setActiveTool, setToolProperty]);
  
  const handleSliceChange = useCallback((newIndex: number) => {
    onSyncUpdate({ currentIndex: newIndex });
  }, [onSyncUpdate]);
  
  const handleZoomChange = useCallback((zoom: number) => {
    onSyncUpdate({ zoom });
  }, [onSyncUpdate]);
  
  const handlePanChange = useCallback((panX: number, panY: number) => {
    onSyncUpdate({ panX, panY });
  }, [onSyncUpdate]);
  
  const handleWindowLevelChange = useCallback((wl: { window: number; level: number }) => {
    onSyncUpdate({ windowLevel: wl });
    onWindowLevelChange?.(wl);
  }, [onSyncUpdate, onWindowLevelChange]);
  
  const handleCrosshairChange = useCallback((pos: { x: number; y: number }) => {
    onSyncUpdate({ crosshairPos: pos });
  }, [onSyncUpdate]);

  const handleRetry = useCallback(() => {
    onLoadError(null);
    setRetryKey(prev => prev + 1);
    onRetry();
  }, [onLoadError, onRetry]);

  // Get series info for display
  const secondarySeries = config.secondarySeriesId 
    ? availableSeries.find(s => s.id === config.secondarySeriesId) 
    : null;

  const borderColor = isPrimary 
    ? "border-cyan-500/50" 
    : "border-purple-500/50";
  
  const headerBg = isPrimary 
    ? "bg-gradient-to-r from-cyan-900/40 to-transparent text-cyan-300"
    : "bg-gradient-to-r from-purple-900/40 to-transparent text-purple-300";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative flex flex-col rounded-lg overflow-hidden border-2 transition-all duration-200",
        borderColor,
        "bg-black",
        config.loadError && "border-red-500/50"
      )}
      style={style}
    >
      {/* Compact Header Bar */}
      <div className={cn(
        "flex items-center justify-between px-2 py-0.5 text-[10px] font-semibold",
        headerBg
      )}>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={cn(
            "text-[8px] px-1 py-0 h-3.5",
            isPrimary ? "border-cyan-500/40 text-cyan-400" : "border-purple-500/40 text-purple-400"
          )}>
            {isPrimary ? 'PRIMARY' : 'FUSED'}
          </Badge>
          
          {isPrimary ? (
            // Primary viewport - just show the series info
            <span className="truncate max-w-[120px] opacity-80 text-[9px]">
              CT #{primarySeriesId}
            </span>
          ) : (
            // Secondary viewport - show dropdown to select which secondary
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-[9px]"
                  title="Click to change secondary series"
                >
                  <span className="truncate max-w-[100px] opacity-90">
                    {secondarySeries 
                      ? `${secondarySeries.modality || 'SEC'} #${config.secondarySeriesId}` 
                      : 'Select secondary...'}
                  </span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="min-w-[180px] bg-gray-900/95 border-white/20 backdrop-blur-md"
              >
                {secondarySeriesIds.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs text-gray-500">
                    No secondaries available
                  </DropdownMenuItem>
                ) : (
                  secondarySeriesIds.map(secId => {
                    const series = availableSeries.find(s => s.id === secId);
                    const isSelected = config.secondarySeriesId === secId;
                    return (
                      <DropdownMenuItem
                        key={secId}
                        onClick={() => onChangeSecondary(secId)}
                        className={cn(
                          "text-xs cursor-pointer",
                          isSelected && "bg-purple-600/30 text-purple-200"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>
                            {series?.modality || 'SEC'} #{secId}
                            {series?.seriesDescription && (
                              <span className="ml-1 opacity-60 text-[10px]">
                                {series.seriesDescription.slice(0, 20)}
                                {series.seriesDescription.length > 20 ? '...' : ''}
                              </span>
                            )}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-purple-400" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {/* Remove button */}
        {canRemove && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30"
            onClick={onRemove}
            title="Remove Viewport"
          >
            <X className="w-2.5 h-2.5" />
          </Button>
        )}
      </div>
      
      {/* Top-Right Floating Controls */}
      <div className="absolute top-7 right-1 z-20 flex flex-col gap-0.5">
        {/* MPR Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 p-0 rounded shadow-lg backdrop-blur-sm transition-all",
            config.showMPR 
              ? "bg-cyan-600/80 text-white border border-cyan-400/60" 
              : "bg-black/60 text-gray-300 border border-white/20 hover:bg-black/80"
          )}
          onClick={onToggleMPR}
          title={config.showMPR ? "Hide MPR" : "Show MPR"}
        >
          <Box className="w-3 h-3" />
        </Button>
        
        {/* Structure Visibility */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 p-0 rounded shadow-lg backdrop-blur-sm transition-all",
            config.showStructures 
              ? "bg-green-600/80 text-white border border-green-400/60" 
              : "bg-black/60 text-gray-300 border border-white/20 hover:bg-black/80"
          )}
          onClick={onToggleStructures}
          title={config.showStructures ? "Hide Structures" : "Show Structures"}
        >
          {config.showStructures ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </Button>
        
        {/* Opacity Slider - only for fused (non-primary) viewports */}
        {!isPrimary && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/50 rounded-md border border-white/10 backdrop-blur-sm">
            <span className="text-[8px] text-gray-400 uppercase tracking-wide">Opacity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={fusionOpacity}
              onChange={(e) => onFusionOpacityChange?.(parseFloat(e.target.value))}
              className="w-16 h-1 accent-cyan-500 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              title={`Fusion opacity: ${Math.round(fusionOpacity * 100)}%`}
            />
            <span className="text-[9px] text-cyan-300 font-medium min-w-[28px] text-center">
              {Math.round(fusionOpacity * 100)}%
            </span>
          </div>
        )}
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {config.loadError ? (
          /* Error State */
          <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-red-900/20 p-4">
            <AlertCircle className="w-10 h-10 mb-2" />
            <p className="text-xs font-medium text-center mb-2">{config.loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-red-500/50 text-red-300 hover:bg-red-900/30"
              onClick={handleRetry}
              disabled={config.isRetrying}
            >
              {config.isRetrying ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Retry
            </Button>
          </div>
        ) : (
          <WorkingViewer
            key={`viewport-${config.id}-${retryKey}-sec-${config.secondarySeriesId ?? 'none'}`}
            ref={viewerRef}
            seriesId={primarySeriesId}
            studyId={studyId}
            // Cross-viewport ghost contour sync - use config.id for unique viewport identification
            viewportId={config.id}
            // For non-primary viewports, show the primary CT fused with the assigned secondary
            secondarySeriesId={isPrimary ? null : config.secondarySeriesId}
            fusionOpacity={fusionOpacity}
            fusionDisplayMode="overlay" // Always overlay in grid view - side-by-side is the grid itself
            fusionLayoutPreset="overlay"
            rtStructures={config.showStructures ? rtStructures : undefined}
            structureVisibility={config.showStructures ? structureVisibility : new Map()}
            allStructuresVisible={config.showStructures && allStructuresVisible}
            selectedForEdit={selectedForEdit}
            selectedStructures={selectedStructures}
            onContourUpdate={onContourUpdate}
            onRTStructureUpdate={onRTStructureUpdate}
            contourSettings={contourSettings}
            brushToolState={localBrushToolState}
            onBrushSizeChange={handleLocalBrushSizeChange}
            onBrushToolChange={handleLocalBrushToolChange}
            windowLevel={windowLevel}
            onWindowLevelChange={handleWindowLevelChange}
            imageCache={imageCache}
            registrationAssociations={registrationAssociations}
            fusionSecondaryStatuses={fusionSecondaryStatuses}
            fusionManifestLoading={fusionManifestLoading}
            fusionManifestPrimarySeriesId={fusionManifestPrimarySeriesId}
            externalSliceIndex={syncState.currentIndex}
            onSliceIndexChange={handleSliceChange}
            externalZoom={syncState.zoom}
            onZoomChange={handleZoomChange}
            externalPan={{ x: syncState.panX, y: syncState.panY }}
            onPanChange={handlePanChange}
            externalCrosshair={syncState.crosshairPos}
            onCrosshairChange={handleCrosshairChange}
            hideToolbar
            hideSidebar
            compactMode
            isMPRVisible={config.showMPR}
            initialImages={initialImages}
            pixelDataCache={pixelDataCache}
          />
        )}
        
      </div>
    </motion.div>
  );
};

interface CompactToolbarProps {
  currentLayout: LayoutPreset;
  onLayoutChange: (layout: LayoutPreset) => void;
  onSwap: () => void;
  onAddViewport: () => void;
  onAddViewportWithSecondary: (secondaryId: number) => void; // Add viewport with specific secondary
  viewportCount: number;
  maxViewports: number;
  assignedSecondaryIds: number[]; // Which secondaries are already in viewports
  syncState: SyncState;
  onSyncUpdate: (updates: Partial<SyncState>) => void;
  onReset: () => void;
  // Fusion props integrated into toolbar
  fusionOpacity: number;
  onFusionOpacityChange?: (opacity: number) => void;
  secondarySeriesIds: number[];
  availableSeries: DICOMSeries[];
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  // Exit callback
  onExitToOverlay?: () => void;
}

const CompactToolbar: React.FC<CompactToolbarProps> = ({
  currentLayout,
  onLayoutChange,
  onSwap,
  onAddViewport,
  onAddViewportWithSecondary,
  viewportCount,
  maxViewports,
  assignedSecondaryIds,
  syncState,
  onSyncUpdate,
  onReset,
  fusionOpacity,
  onFusionOpacityChange,
  secondarySeriesIds,
  availableSeries,
  fusionSecondaryStatuses,
  onExitToOverlay,
}) => {
  // Get modality color helper
  const getModalityColor = (modality: string) => {
    if (modality === 'PT' || modality === 'PET') return 'yellow';
    if (modality === 'MR' || modality === 'MRI') return 'purple';
    if (modality === 'CT') return 'blue';
    return 'slate';
  };
  
  // Check if a secondary is already assigned to a viewport
  const isSecondaryAssigned = (secId: number) => assignedSecondaryIds.includes(secId);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#0f1219]/95 backdrop-blur-sm border-b border-white/[0.06]">
      {/* Left: Layout presets */}
      <div className="flex items-center gap-1 bg-black/30 rounded-lg p-0.5 border border-white/5">
        {LAYOUT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-md transition-all",
              currentLayout === preset.id
                ? "bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            )}
            onClick={() => onLayoutChange(preset.id)}
            title={`${preset.description} (${preset.viewports} viewport${preset.viewports > 1 ? 's' : ''})`}
          >
            {preset.icon}
          </button>
        ))}
      </div>
      
      <div className="w-px h-5 bg-white/10" />
      
      <div className="flex items-center gap-1">
        {viewportCount >= 2 && (
          <button
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            onClick={onSwap}
            title="Swap viewports"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        )}
        
        {viewportCount < maxViewports && (
          <button
            className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            onClick={onAddViewport}
            title="Add viewport"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      
      {/* Center: Opacity + Available Secondaries */}
      <div className="flex items-center gap-4 flex-1 justify-center">
        {/* Global Opacity Control */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-md border border-white/10">
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">Opacity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={fusionOpacity}
            onChange={(e) => onFusionOpacityChange?.(parseFloat(e.target.value))}
            className="w-20 h-1 accent-cyan-500 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            title={`Global fusion opacity: ${Math.round(fusionOpacity * 100)}%`}
          />
          <span className="text-[10px] text-cyan-300 font-medium min-w-[32px] text-center">
            {Math.round(fusionOpacity * 100)}%
          </span>
        </div>
        
        <div className="w-px h-4 bg-white/20" />
        
        {/* Available Secondaries - Click to add viewport */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Add</span>
          {secondarySeriesIds.length === 0 ? (
            <span className="text-[10px] text-gray-600">No secondaries</span>
          ) : (
            secondarySeriesIds.slice(0, 6).map(secId => {
              const series = availableSeries.find(s => s.id === secId);
              const status = fusionSecondaryStatuses?.get(secId);
              const modality = series?.modality || 'SEC';
              const colorClass = getModalityColor(modality);
              const isAssigned = isSecondaryAssigned(secId);
              const canAdd = viewportCount < maxViewports && !isAssigned;
              const isReady = status?.status === 'ready';
              
              // Color schemes based on modality - matching app theme
              const colorSchemes = {
                yellow: {
                  base: 'text-amber-300 ring-amber-500/30',
                  active: 'bg-amber-500/20 hover:bg-amber-500/30',
                  assigned: 'bg-amber-500/30 ring-amber-400/50',
                  disabled: 'bg-amber-900/10 text-amber-500/40 ring-amber-700/20',
                },
                purple: {
                  base: 'text-purple-300 ring-purple-500/30',
                  active: 'bg-purple-500/20 hover:bg-purple-500/30',
                  assigned: 'bg-purple-500/30 ring-purple-400/50',
                  disabled: 'bg-purple-900/10 text-purple-500/40 ring-purple-700/20',
                },
                blue: {
                  base: 'text-indigo-300 ring-indigo-500/30',
                  active: 'bg-indigo-500/20 hover:bg-indigo-500/30',
                  assigned: 'bg-indigo-500/30 ring-indigo-400/50',
                  disabled: 'bg-indigo-900/10 text-indigo-500/40 ring-indigo-700/20',
                },
                slate: {
                  base: 'text-gray-300 ring-gray-500/30',
                  active: 'bg-gray-500/20 hover:bg-gray-500/30',
                  assigned: 'bg-gray-500/30 ring-gray-400/50',
                  disabled: 'bg-gray-900/10 text-gray-500/40 ring-gray-700/20',
                },
              };
              
              const colors = colorSchemes[colorClass as keyof typeof colorSchemes] || colorSchemes.slate;
              
              return (
                <button
                  key={secId}
                  onClick={() => canAdd && onAddViewportWithSecondary(secId)}
                  disabled={!canAdd || !isReady}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-semibold rounded-md ring-1 transition-all flex items-center gap-1",
                    colors.base,
                    isAssigned 
                      ? colors.assigned + " cursor-default"
                      : canAdd && isReady
                        ? colors.active + " cursor-pointer"
                        : colors.disabled + " cursor-not-allowed"
                  )}
                  title={
                    isAssigned 
                      ? `${modality} is already in a viewport`
                      : !isReady
                        ? `${modality} is loading...`
                        : viewportCount >= maxViewports
                          ? 'Max viewports reached'
                          : `Click to add ${modality} fusion viewport`
                  }
                >
                  {modality}
                  {status?.status === 'loading' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  )}
                  {isAssigned && (
                    <Eye className="w-2.5 h-2.5" />
                  )}
                  {!isAssigned && isReady && canAdd && (
                    <Plus className="w-2.5 h-2.5" />
                  )}
                </button>
              );
            })
          )}
          {viewportCount >= maxViewports && secondarySeriesIds.some(id => !isSecondaryAssigned(id)) && (
            <span className="text-[9px] text-gray-500 ml-1">(max viewports)</span>
          )}
        </div>
      </div>
      
      {/* Right: Zoom controls + Slice info + Reset */}
      <div className="flex items-center gap-3">
        {/* Zoom controls that sync to ALL viewports */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/40 rounded-md border border-white/10">
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">Zoom</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded"
            onClick={() => onSyncUpdate({ zoom: Math.max(0.25, syncState.zoom - 0.25) })}
            title="Zoom out (all viewports)"
          >
            <ZoomOut className="w-3 h-3" />
          </Button>
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.05"
            value={syncState.zoom}
            onChange={(e) => onSyncUpdate({ zoom: parseFloat(e.target.value) })}
            className="w-16 h-1 accent-cyan-500 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            title={`Zoom: ${Math.round(syncState.zoom * 100)}%`}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded"
            onClick={() => onSyncUpdate({ zoom: Math.min(4, syncState.zoom + 0.25) })}
            title="Zoom in (all viewports)"
          >
            <ZoomIn className="w-3 h-3" />
          </Button>
          <span className="text-[10px] text-cyan-300 font-medium min-w-[32px] text-center">
            {Math.round(syncState.zoom * 100)}%
          </span>
        </div>
        
        <div className="w-px h-4 bg-white/20" />
        
        {/* Slice info */}
        <span className="text-[10px] text-gray-500">
          Slice <span className="text-gray-300 font-medium">{syncState.currentIndex + 1}</span>
        </span>
        
        <div className="w-px h-4 bg-white/20" />
        
        {/* Reset button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-white"
          onClick={onReset}
          title="Reset view (zoom, pan, position)"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
        
        {/* Exit to overlay/single button - made more prominent */}
        {onExitToOverlay && (
          <>
            <div className="w-px h-5 bg-red-500/30" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/40 hover:border-red-500/60 rounded-md"
              onClick={onExitToOverlay}
              title="Exit split view and return to single viewport"
            >
              <X className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Exit Split</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export function FlexibleFusionLayout({
  primarySeriesId,
  secondarySeriesIds,
  studyId,
  availableSeries,
  fusionOpacity,
  onFusionOpacityChange,
  fusionWindowLevel,
  onFusionWindowLevelChange,
  rtStructures,
  structureVisibility,
  allStructuresVisible,
  selectedForEdit,
  selectedStructures,
  onContourUpdate,
  onRTStructureUpdate,
  contourSettings,
  brushToolState,
  onBrushSizeChange,
  windowLevel,
  onWindowLevelChange,
  imageCache,
  registrationAssociations,
  onLayoutChange,
  onSwapViewports,
  fusionSecondaryStatuses,
  fusionManifestLoading,
  fusionManifestPrimarySeriesId,
  selectedFusionSecondaryId,
  onSecondarySeriesSelect,
  fusionDisplayMode,
  fusionLayoutPreset,
  isMPRVisible,
  onMPRToggle,
  externalZoom,
  onZoomChange,
  onExitToOverlay,
  onViewportAssignmentsChange,
}: FlexibleFusionLayoutProps) {
  
  // --- Multi-Viewport Optimization State ---
  const [primaryImages, setPrimaryImages] = useState<any[]>([]);
  const [isImagesLoading, setIsImagesLoading] = useState(true);
  const pixelDataCache = useRef<Map<string, any>>(new Map());

  // Load primary images once for all viewports
  useEffect(() => {
    let mounted = true;
    const loadImages = async () => {
      if (!primarySeriesId) return;
      
      setIsImagesLoading(true);
      try {
        const response = await fetch(`/api/series/${primarySeriesId}/images`);
        if (!response.ok) throw new Error('Failed to load images');
        const seriesImages = await response.json();

        // Batch metadata loading for sorting
        let imagesWithMetadata = seriesImages;
        try {
          const batchResponse = await fetch(`/api/series/${primarySeriesId}/batch-metadata`);
          if (batchResponse.ok) {
            const batchMetadata = await batchResponse.json();
            const metadataMap = new Map();
            batchMetadata.forEach((meta: any) => {
              metadataMap.set(meta.sopInstanceUID, meta);
            });
            
            imagesWithMetadata = seriesImages.map((img: any) => {
              const meta = metadataMap.get(img.sopInstanceUID);
              if (meta && !meta.error) {
                return {
                  ...img,
                  parsedSliceLocation: meta.parsedSliceLocation,
                  parsedZPosition: meta.parsedZPosition,
                  parsedInstanceNumber: meta.parsedInstanceNumber ?? img.instanceNumber,
                };
              }
              return {
                ...img,
                parsedSliceLocation: null,
                parsedZPosition: null,
                parsedInstanceNumber: img.instanceNumber,
              };
            });
          }
        } catch (e) {
           console.warn('Batch metadata failed', e);
        }

        // Sort images
        const sorted = imagesWithMetadata.sort((a: any, b: any) => {
           // Primary: slice location
           if (a.parsedSliceLocation !== null && b.parsedSliceLocation !== null) {
             return a.parsedSliceLocation - b.parsedSliceLocation;
           }
           // Secondary: z-position
           if (a.parsedZPosition !== null && b.parsedZPosition !== null) {
             return a.parsedZPosition - b.parsedZPosition;
           }
           // Tertiary: instance number
           if (a.parsedInstanceNumber !== null && b.parsedInstanceNumber !== null) {
             return a.parsedInstanceNumber - b.parsedInstanceNumber;
           }
           // Final fallback: filename
           return (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true });
        });

        if (mounted) {
          setPrimaryImages(sorted);
          setIsImagesLoading(false);
        }
      } catch (err) {
        console.error("Error loading primary images:", err);
        if (mounted) setIsImagesLoading(false);
      }
    };

    loadImages();
    return () => { mounted = false; };
  }, [primarySeriesId]);

  // Get expected viewport count from layout preset
  const expectedViewportCount = useMemo(() => {
    const preset = LAYOUT_PRESETS.find(p => p.id === fusionLayoutPreset);
    return preset?.viewports || 1;
  }, [fusionLayoutPreset]);

  // Initialize viewports based on layout preset and available secondaries
  const [viewports, setViewports] = useState<ViewportConfig[]>(() => {
    const configs: ViewportConfig[] = [
      { id: 'primary', secondarySeriesId: null, showStructures: true, showMPR: false, loadError: null, isRetrying: false }
    ];
    
    // Add secondary viewports based on expected count
    for (let i = 1; i < expectedViewportCount; i++) {
      configs.push({
        id: `secondary-${i}`,
        secondarySeriesId: secondarySeriesIds[i - 1] || null,
        showStructures: true,
        showMPR: false,
        loadError: null,
        isRetrying: false
      });
    }
    
    return configs;
  });

  // Track which viewport is currently active (for OHIF-style hover/active behavior)
  const [activeViewportId, setActiveViewportId] = useState<string>('primary');

  const [syncState, setSyncState] = useState<SyncState>({
    currentIndex: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    windowLevel: windowLevel || { window: 400, level: 40 },
    crosshairPos: { x: 0, y: 0 },
  });

  const maxViewports = 4;

  // Update viewports when layout preset or selected secondary changes
  useEffect(() => {
    setViewports(prev => {
      const newConfigs: ViewportConfig[] = [
        prev[0] || { id: 'primary', secondarySeriesId: null, showStructures: true, showMPR: false, loadError: null, isRetrying: false }
      ];
      
      // Ensure we have enough viewports for the layout
      for (let i = 1; i < expectedViewportCount; i++) {
        const existing = prev[i];
        if (existing) {
          newConfigs.push(existing);
        } else {
          // Create new viewport with next available secondary
          const usedSecondaries = new Set(newConfigs.filter(v => v.secondarySeriesId).map(v => v.secondarySeriesId));
          const availableSecondary = secondarySeriesIds.find(id => !usedSecondaries.has(id));
          newConfigs.push({
            id: `secondary-${i}-${Date.now()}`,
            secondarySeriesId: availableSecondary || selectedFusionSecondaryId || null,
            showStructures: true,
            showMPR: false,
            loadError: null,
            isRetrying: false
          });
        }
      }
      
      // Trim if layout requires fewer viewports
      return newConfigs.slice(0, expectedViewportCount);
    });
  }, [expectedViewportCount, secondarySeriesIds, selectedFusionSecondaryId]);

  // Update sync state when external windowLevel changes
  useEffect(() => {
    if (windowLevel) {
      setSyncState(prev => ({ ...prev, windowLevel: windowLevel }));
    }
  }, [windowLevel]);

  // Report viewport assignments to parent whenever viewports change
  useEffect(() => {
    if (onViewportAssignmentsChange) {
      const assignments = new Map<number, number | null>();
      viewports.forEach((vp, index) => {
        // Viewport number is 1-indexed for display
        assignments.set(index + 1, vp.secondarySeriesId);
      });
      onViewportAssignmentsChange(assignments);
    }
  }, [viewports, onViewportAssignmentsChange]);

  const handleSyncUpdate = useCallback((updates: Partial<SyncState>) => {
    setSyncState(prev => ({ ...prev, ...updates }));
    // Notify parent of zoom changes for external sync (bottom toolbar)
    if (updates.zoom !== undefined && onZoomChange) {
      onZoomChange(updates.zoom);
    }
  }, [onZoomChange]);
  
  // Sync external zoom changes into local state
  useEffect(() => {
    if (externalZoom !== undefined) {
      setSyncState(prev => prev.zoom !== externalZoom ? { ...prev, zoom: externalZoom } : prev);
    }
  }, [externalZoom]);

  const handleActivateViewport = useCallback((viewportId: string) => {
    setActiveViewportId(viewportId);
  }, []);

  const handleToggleStructures = useCallback((viewportId: string) => {
    setViewports(prev => 
      prev.map(vp => 
        vp.id === viewportId ? { ...vp, showStructures: !vp.showStructures } : vp
      )
    );
  }, []);

  const handleToggleMPR = useCallback((viewportId: string) => {
    setViewports(prev => 
      prev.map(vp => 
        vp.id === viewportId ? { ...vp, showMPR: !vp.showMPR } : vp
      )
    );
  }, []);

  const handleRemoveViewport = useCallback((viewportId: string) => {
    if (viewportId === 'primary') return; // Never remove primary
    setViewports(prev => prev.filter(vp => vp.id !== viewportId));
  }, []);

  const handleAddViewport = useCallback(() => {
    if (viewports.length >= maxViewports) return;

    // Find an available secondary series
    const usedSecondaries = new Set(viewports.filter(v => v.secondarySeriesId).map(v => v.secondarySeriesId));
    const availableSecondary = secondarySeriesIds.find(id => !usedSecondaries.has(id));

    setViewports(prev => [
      ...prev,
      { 
        id: `secondary-${Date.now()}`, 
        secondarySeriesId: availableSecondary || null, 
        showStructures: true, 
        showMPR: false,
        loadError: null,
        isRetrying: false
      }
    ]);
  }, [viewports, secondarySeriesIds]);
  
  // Add viewport with a specific secondary series (called from toolbar secondary buttons)
  const handleAddViewportWithSecondary = useCallback((secondaryId: number) => {
    if (viewports.length >= maxViewports) return;
    
    // Check if this secondary is already assigned
    const usedSecondaries = new Set(viewports.filter(v => v.secondarySeriesId).map(v => v.secondarySeriesId));
    if (usedSecondaries.has(secondaryId)) return;

    setViewports(prev => [
      ...prev,
      { 
        id: `secondary-${secondaryId}-${Date.now()}`, 
        secondarySeriesId: secondaryId, 
        showStructures: true, 
        showMPR: false,
        loadError: null,
        isRetrying: false
      }
    ]);
  }, [viewports]);
  
  // Calculate which secondaries are already assigned to viewports
  const assignedSecondaryIds = useMemo(() => 
    viewports
      .filter(v => v.secondarySeriesId !== null)
      .map(v => v.secondarySeriesId as number),
    [viewports]
  );

  const handleResetView = useCallback(() => {
    setSyncState({
      currentIndex: 0,
      zoom: 1,
      panX: 0,
      panY: 0,
      windowLevel: windowLevel || { window: 400, level: 40 },
      crosshairPos: { x: 0, y: 0 },
    });
  }, [windowLevel]);

  const handleSwap = useCallback(() => {
    if (viewports.length < 2) return;
    setViewports(prev => {
      const [first, second, ...rest] = prev;
      return [second, first, ...rest];
    });
    onSwapViewports?.();
  }, [viewports.length, onSwapViewports]);

  const handleLoadError = useCallback((viewportId: string, error: string | null) => {
    setViewports(prev => 
      prev.map(vp => 
        vp.id === viewportId ? { ...vp, loadError: error, isRetrying: false } : vp
      )
    );
  }, []);

  const handleRetry = useCallback((viewportId: string) => {
    setViewports(prev => 
      prev.map(vp => 
        vp.id === viewportId ? { ...vp, isRetrying: true } : vp
      )
    );
  }, []);

  const handleChangeSecondary = useCallback((viewportId: string, secondaryId: number | null) => {
    setViewports(prev => 
      prev.map(vp => 
        vp.id === viewportId 
          ? { ...vp, secondarySeriesId: secondaryId, loadError: null } 
          : vp
      )
    );
  }, []);

  // Get CSS classes for the grid layout
  // Using minmax(0, 1fr) for rows to ensure they divide available space equally
  // and don't overflow based on content height
  const getLayoutClasses = useCallback(() => {
    switch (fusionLayoutPreset) {
      case 'single':
        return "grid-cols-1 grid-rows-[minmax(0,1fr)]";
      case 'side-by-side':
        return "grid-cols-2 grid-rows-[minmax(0,1fr)]";
      case 'primary-focus':
        return "grid-cols-[7fr_3fr] grid-rows-[minmax(0,1fr)]";
      case 'secondary-focus':
        return "grid-cols-[3fr_7fr] grid-rows-[minmax(0,1fr)]";
      case 'vertical-stack':
        return "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]";
      case 'triple':
        return "grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]";
      case 'quad':
        return "grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]";
      default:
        return "grid-cols-1 grid-rows-[minmax(0,1fr)]";
    }
  }, [fusionLayoutPreset]);

  // Get style for triple layout (first viewport spans 2 rows)
  const getViewportStyle = useCallback((index: number): React.CSSProperties => {
    if (fusionLayoutPreset === 'triple' && index === 0) {
      return { gridRow: 'span 2' };
    }
    return {};
  }, [fusionLayoutPreset]);

  return (
    <div className="flex flex-col h-full w-full">
      <CompactToolbar
        currentLayout={fusionLayoutPreset}
        onLayoutChange={onLayoutChange || (() => {})}
        onSwap={handleSwap}
        onAddViewport={handleAddViewport}
        onAddViewportWithSecondary={handleAddViewportWithSecondary}
        viewportCount={viewports.length}
        maxViewports={maxViewports}
        assignedSecondaryIds={assignedSecondaryIds}
        syncState={syncState}
        onSyncUpdate={handleSyncUpdate}
        onReset={handleResetView}
        fusionOpacity={fusionOpacity}
        onFusionOpacityChange={onFusionOpacityChange}
        secondarySeriesIds={secondarySeriesIds}
        availableSeries={availableSeries}
        fusionSecondaryStatuses={fusionSecondaryStatuses}
        onExitToOverlay={onExitToOverlay}
      />
      
      {isImagesLoading ? (
        <div className="flex items-center justify-center flex-1 bg-black text-cyan-500">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading Primary Series...</span>
          </div>
        </div>
      ) : (
        <div className={cn("grid gap-1 flex-1 p-1 min-h-0 overflow-hidden", getLayoutClasses())}>
          <AnimatePresence mode="popLayout">
            {viewports.map((vpConfig, index) => {
              const isPrimary = vpConfig.id === 'primary';
              const isActive = activeViewportId === vpConfig.id;
              
              return (
                <ViewportPaneOHIF
                  key={vpConfig.id}
                  config={vpConfig}
                  isPrimary={isPrimary}
                  isActive={isActive}
                  viewportNumber={index + 1}
                  primarySeriesId={primarySeriesId}
                  studyId={studyId}
                  availableSeries={availableSeries}
                  secondarySeriesIds={secondarySeriesIds}
                  syncState={syncState}
                  onSyncUpdate={handleSyncUpdate}
                  onToggleStructures={() => handleToggleStructures(vpConfig.id)}
                  onToggleMPR={() => handleToggleMPR(vpConfig.id)}
                  onRemove={!isPrimary ? () => handleRemoveViewport(vpConfig.id) : undefined}
                  canRemove={!isPrimary && viewports.length > 1}
                  onChangeSecondary={(secondaryId) => handleChangeSecondary(vpConfig.id, secondaryId)}
                  onLoadError={(error) => handleLoadError(vpConfig.id, error)}
                  onRetry={() => handleRetry(vpConfig.id)}
                  onActivate={() => handleActivateViewport(vpConfig.id)}
                  fusionOpacity={fusionOpacity}
                  onFusionOpacityChange={onFusionOpacityChange}
                  rtStructures={rtStructures}
                  structureVisibility={structureVisibility}
                  allStructuresVisible={allStructuresVisible}
                  selectedForEdit={selectedForEdit}
                  selectedStructures={selectedStructures}
                  onContourUpdate={onContourUpdate}
                  onRTStructureUpdate={onRTStructureUpdate}
                  contourSettings={contourSettings}
                  brushToolState={brushToolState}
                  onBrushSizeChange={onBrushSizeChange}
                  windowLevel={windowLevel}
                  onWindowLevelChange={onWindowLevelChange}
                  imageCache={imageCache}
                  registrationAssociations={registrationAssociations}
                  fusionSecondaryStatuses={fusionSecondaryStatuses}
                  fusionManifestLoading={fusionManifestLoading}
                  fusionManifestPrimarySeriesId={fusionManifestPrimarySeriesId}
                  style={getViewportStyle(index)}
                  initialImages={primaryImages}
                  pixelDataCache={pixelDataCache}
                  orientation="axial"
                  onLoadFusion={isPrimary ? (secondaryId) => handleAddViewportWithSecondary(secondaryId) : undefined}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
