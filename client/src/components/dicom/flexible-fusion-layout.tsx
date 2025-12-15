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
import { FusionDropdown } from './unified-fusion-topbar';
import type { FusionLayoutPreset } from './fusion-control-panel-v2';
// Performance optimizations
import { viewportScrollSync, type ViewportSyncState } from '@/lib/viewport-scroll-sync';
import { globalFusionCache } from '@/lib/global-fusion-cache';

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
  // Fusion dropdown props (for right side)
  selectedFusionSecondaryId?: number | null;
  onSecondarySeriesSelect?: (id: number | null) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  onFusionWindowLevelChange?: (wl: { window: number; level: number } | null) => void;
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
  selectedFusionSecondaryId,
  onSecondarySeriesSelect,
  fusionWindowLevel,
  onFusionWindowLevelChange,
}) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Get modality color helper
  const getModalityColor = (modality: string) => {
    if (modality === 'PT' || modality === 'PET') return 'amber';
    if (modality === 'MR' || modality === 'MRI') return 'purple';
    if (modality === 'CT') return 'blue';
    return 'slate';
  };
  
  // Check if a secondary is already assigned to a viewport
  const isSecondaryAssigned = (secId: number) => assignedSecondaryIds.includes(secId);
  
  // Get available scans for adding
  const availableScansForAdd = secondarySeriesIds.filter(id => !isSecondaryAssigned(id)).map(secId => {
    const series = availableSeries.find(s => s.id === secId);
    const status = fusionSecondaryStatuses?.get(secId);
    return {
      id: secId,
      modality: series?.modality || 'SEC',
      description: series?.seriesDescription || `Series ${secId}`,
      isReady: status?.status === 'ready' || status?.status === 'idle',
    };
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center h-12 px-4 bg-gray-950/95 backdrop-blur-md border border-gray-600/40 rounded-xl shadow-lg"
    >
      {/* Left section: Layout buttons + Swap + Add */}
      <div className="flex items-center gap-2">
        {/* Layout preset buttons */}
        <div className="flex items-center gap-0.5">
          {LAYOUT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onLayoutChange(preset.id)}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-md transition-all duration-150",
                currentLayout === preset.id
                  ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/30"
                  : "text-gray-500 hover:text-gray-300"
              )}
              title={`${preset.description} (${preset.viewports} viewports)`}
            >
              {preset.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* Swap button */}
        {viewportCount >= 2 && (
          <button
            onClick={onSwap}
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Swap viewports"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        )}

        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* Add viewport button with dialog */}
        <div className="relative">
          <button
            onClick={() => setShowAddDialog(!showAddDialog)}
            disabled={viewportCount >= maxViewports}
            className={cn(
              "h-7 px-3 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-all duration-200",
              showAddDialog
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                : viewportCount >= maxViewports
                  ? "bg-gray-800/30 text-gray-600 border-gray-700/30 cursor-not-allowed"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAddDialog && "rotate-180")} />
          </button>
          
          {/* Add Viewport Dialog */}
          <AnimatePresence>
            {showAddDialog && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-72 z-50"
              >
                <div className="bg-gray-950 border border-gray-800/50 rounded-xl shadow-xl p-3">
                  <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    Add Viewport
                  </div>
                  <div className="text-[10px] text-gray-500 mb-3">
                    Select a scan to add to a new viewport
                  </div>
                  
                  {availableScansForAdd.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {availableScansForAdd.map((scan) => {
                        const colorClass = getModalityColor(scan.modality);
                        const dotColor = colorClass === 'amber' ? 'bg-amber-400' : colorClass === 'purple' ? 'bg-purple-400' : 'bg-cyan-400';
                        const textColor = colorClass === 'amber' ? 'text-amber-400' : colorClass === 'purple' ? 'text-purple-400' : 'text-cyan-400';
                        return (
                          <button
                            key={scan.id}
                            onClick={() => {
                              onAddViewportWithSecondary(scan.id);
                              setShowAddDialog(false);
                            }}
                            disabled={!scan.isReady}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left",
                              scan.isReady
                                ? "bg-gray-900/50 border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600/50"
                                : "bg-gray-900/30 border-gray-800/30 opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className={cn("w-2.5 h-2.5 rounded-full", dotColor)} />
                            <span className={cn("font-semibold text-xs", textColor)}>
                              {scan.modality}
                            </span>
                            <span className="text-gray-400 text-xs truncate flex-1">
                              {scan.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-xs">
                      All available scans are loaded
                    </div>
                  )}
                  
                  <div className="flex justify-end mt-3 pt-2 border-t border-gray-800">
                    <button
                      onClick={() => setShowAddDialog(false)}
                      className="h-7 px-3 rounded-lg text-gray-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center section: Global Opacity Slider */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2 px-4">
          <Layers className="w-4 h-4 text-amber-400" />
          <div className="relative w-40">
            {/* Track */}
            <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                style={{ width: `${fusionOpacity * 100}%` }}
              />
            </div>
            {/* Thumb */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-amber-400 shadow-lg pointer-events-none"
              style={{ left: `calc(${fusionOpacity * 100}% - 8px)` }}
            />
            {/* Input */}
            <input
              type="range"
              min="0"
              max="100"
              value={fusionOpacity * 100}
              onChange={(e) => onFusionOpacityChange?.(parseInt(e.target.value) / 100)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-[10px] font-semibold text-amber-300 w-8">
            {Math.round(fusionOpacity * 100)}%
          </span>
          
          {/* Reset opacity button */}
          <button
            onClick={() => onFusionOpacityChange?.(0.5)}
            className="h-6 w-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            title="Reset opacity to 50%"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right section: Reset + Exit */}
      <div className="flex items-center gap-2">
        {/* Slice info */}
        <span className="text-[10px] text-gray-500 mr-2">
          Slice <span className="text-gray-300 font-medium">{syncState.currentIndex + 1}</span>
        </span>
        
        {/* Reset button */}
        <button
          onClick={onReset}
          className="h-7 px-2.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
          title="Reset view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        
        {/* Exit button */}
        {onExitToOverlay && (
          <button
            onClick={onExitToOverlay}
            className="h-7 px-3 rounded-md bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
            title="Exit split view"
          >
            <X className="w-3.5 h-3.5" />
            Exit
          </button>
        )}
      </div>
    </motion.div>
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

  // Preload fusion data for all secondary series when entering multi-viewport mode
  // This dramatically improves scrolling performance by sharing cached fusion slices across viewports
  const [fusionPreloadProgress, setFusionPreloadProgress] = useState<Map<number, number>>(new Map());
  
  useEffect(() => {
    if (isImagesLoading || !primaryImages.length || !secondarySeriesIds.length) return;
    
    // Start preloading fusion data for each secondary series
    const preloadPromises = secondarySeriesIds.map(async (secondaryId) => {
      // Check if already preloading or mostly loaded
      if (globalFusionCache.isPreloading(primarySeriesId, secondaryId)) {
        console.log(`[FlexibleFusionLayout] Already preloading fusion for secondary ${secondaryId}`);
        return;
      }
      
      const existingProgress = globalFusionCache.getProgress(primarySeriesId, secondaryId);
      if (existingProgress > 0.9) {
        console.log(`[FlexibleFusionLayout] Fusion already loaded for secondary ${secondaryId} (${(existingProgress * 100).toFixed(0)}%)`);
        return;
      }
      
      console.log(`[FlexibleFusionLayout] 🚀 Starting fusion preload for secondary ${secondaryId} (${primaryImages.length} slices)`);
      
      try {
        await globalFusionCache.preloadFusionPair(
          primarySeriesId,
          secondaryId,
          primaryImages.map((img, idx) => ({
            sopInstanceUID: img.sopInstanceUID,
            instanceNumber: img.instanceNumber ?? img.parsedInstanceNumber,
            imagePosition: img.imagePositionPatient ?? img.metadata?.imagePositionPatient,
            metadata: img.metadata,
          })),
          null, // registrationId - use default
          {
            onProgress: (loaded, total) => {
              setFusionPreloadProgress(prev => {
                const next = new Map(prev);
                next.set(secondaryId, loaded / total);
                return next;
              });
            },
          }
        );
        console.log(`[FlexibleFusionLayout] ✅ Fusion preload complete for secondary ${secondaryId}`);
      } catch (error) {
        console.warn(`[FlexibleFusionLayout] Failed to preload fusion for secondary ${secondaryId}:`, error);
      }
    });
    
    // Start all preloads in parallel
    Promise.allSettled(preloadPromises);
    
    // No cleanup needed - preloading should continue even if component unmounts
    // The global cache persists across component lifecycles
  }, [primarySeriesId, secondarySeriesIds, primaryImages, isImagesLoading]);

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

  // Ref-based sync state for high-frequency scroll updates (bypasses React during scrolling)
  const syncStateRef = useRef<SyncState>(syncState);
  
  // Keep ref in sync with state (for when React state is the source of truth)
  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);

  // Register React state sync callback with the scroll sync manager
  useEffect(() => {
    viewportScrollSync.setReactSyncCallback((state: ViewportSyncState) => {
      // Only update React state when scrolling has stopped
      setSyncState(prev => ({
        ...prev,
        currentIndex: state.sliceIndex,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        windowLevel: state.windowLevel.width !== undefined 
          ? { window: state.windowLevel.width, level: state.windowLevel.center }
          : prev.windowLevel,
      }));
    });
    
    // Initialize scroll sync with current state
    viewportScrollSync.setState({
      sliceIndex: syncState.currentIndex,
      zoom: syncState.zoom,
      panX: syncState.panX,
      panY: syncState.panY,
      windowLevel: { width: syncState.windowLevel.window, center: syncState.windowLevel.level },
    });
    
    return () => {
      viewportScrollSync.setReactSyncCallback(null);
    };
  }, []);

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

  const handleSyncUpdate = useCallback((updates: Partial<SyncState>, sourceViewportId?: string) => {
    // Update the ref immediately (for other viewports to read)
    Object.assign(syncStateRef.current, updates);
    
    // Convert to ViewportSyncState format and use ref-based sync
    const syncUpdates: Partial<ViewportSyncState> = {};
    if (updates.currentIndex !== undefined) syncUpdates.sliceIndex = updates.currentIndex;
    if (updates.zoom !== undefined) syncUpdates.zoom = updates.zoom;
    if (updates.panX !== undefined) syncUpdates.panX = updates.panX;
    if (updates.panY !== undefined) syncUpdates.panY = updates.panY;
    if (updates.windowLevel !== undefined) {
      syncUpdates.windowLevel = { 
        width: updates.windowLevel.window, 
        center: updates.windowLevel.level 
      };
    }
    
    // Use the ref-based sync system (bypasses React during rapid scrolling)
    viewportScrollSync.update(
      sourceViewportId || 'unknown',
      syncUpdates,
      { skipSource: true }
    );
    
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

  // Build secondary descriptors for the FusionDropdown
  const secondaryDescriptors = useMemo(() => {
    return secondarySeriesIds.map(secId => {
      const series = availableSeries.find(s => s.id === secId);
      return {
        secondarySeriesId: secId,
        secondaryModality: series?.modality || 'CT',
        secondarySeriesDescription: series?.seriesDescription || `Series ${secId}`,
        registrationType: 'rigid' as const,
      };
    });
  }, [secondarySeriesIds, availableSeries]);
  
  const selectedSecondaryDescriptor = useMemo(() => {
    if (!selectedFusionSecondaryId) return null;
    return secondaryDescriptors.find(d => d.secondarySeriesId === selectedFusionSecondaryId) || null;
  }, [selectedFusionSecondaryId, secondaryDescriptors]);
  
  // Fusion dropdown state
  const [isFusionPanelOpen, setIsFusionPanelOpen] = useState(false);
  const fusionPanelRef = useRef<HTMLDivElement>(null);
  
  // Close fusion panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fusionPanelRef.current && !fusionPanelRef.current.contains(e.target as Node)) {
        setIsFusionPanelOpen(false);
      }
    };
    if (isFusionPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFusionPanelOpen]);
  
  const handleSecondaryChange = useCallback((sec: typeof secondaryDescriptors[0] | null) => {
    onSecondarySeriesSelect?.(sec?.secondarySeriesId ?? null);
  }, [onSecondarySeriesSelect]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar row: Multi-viewport bar on left + Fusion dropdown on right */}
      <div className="flex items-start gap-2 p-2">
        {/* Left: CompactToolbar */}
        <div className="flex-1">
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
            selectedFusionSecondaryId={selectedFusionSecondaryId}
            onSecondarySeriesSelect={onSecondarySeriesSelect}
            fusionWindowLevel={fusionWindowLevel}
            onFusionWindowLevelChange={onFusionWindowLevelChange}
          />
        </div>
        
        {/* Right: Fusion Dropdown (same as in UnifiedFusionTopbar) */}
        <div className="flex-shrink-0" ref={fusionPanelRef}>
          <FusionDropdown
            isOpen={isFusionPanelOpen}
            onToggle={() => setIsFusionPanelOpen(!isFusionPanelOpen)}
            hasFusionActive={!!selectedFusionSecondaryId}
            selectedSecondary={selectedSecondaryDescriptor}
            fusionOpacity={fusionOpacity}
            onFusionOpacityChange={onFusionOpacityChange || (() => {})}
            onSecondaryChange={handleSecondaryChange}
            availableSecondaries={secondaryDescriptors}
            secondaryStatuses={fusionSecondaryStatuses || new Map()}
            manifestLoading={fusionManifestLoading}
            fusionLayoutPreset={fusionLayoutPreset as FusionLayoutPreset}
            onLayoutPresetChange={(preset) => onLayoutChange?.(preset as LayoutPreset)}
            fusionWindowLevel={fusionWindowLevel}
            onFusionWindowLevelChange={onFusionWindowLevelChange}
          />
        </div>
      </div>
      
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
