/**
 * AdvancedViewportLayout - Multi-Viewport Layout Engine
 * 
 * A flexible multi-viewport layout system with a unified design language matching
 * the application's indigo/purple theme. Provides seamless viewport management
 * with refined visual feedback and smooth animations.
 * 
 * Features:
 * - Reactive state via viewportGridService
 * - Click-to-activate viewport selection with visual feedback
 * - Layout presets: 1×1, 1×2, 2×1, 2×2, 3×3, MPR
 * - Drag & drop series assignment
 * - Synchronized scrolling within sync groups
 * - RT structure overlay support
 * - Harmonized design with single viewport mode
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2, 
  Grid2x2,
  Grid3X3,
  Columns,
  Rows,
  Box,
  LayoutGrid,
  Layers,
  Settings2,
  RotateCcw,
  Loader2,
  AlertCircle,
  Plus,
  Eye,
  ChevronDown,
  Check,
  ZoomIn,
  ZoomOut,
  X,
  Sparkles,
  MonitorUp,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { WorkingViewer } from './working-viewer';
import { 
  useViewportGrid, 
  GridLayoutPreset, 
  Viewport, 
  ViewportGrid,
  viewportGridService,
} from '@/lib/viewport-grid-service';
import type { DICOMSeries } from '@/types/dicom';
import type { FusionSecondaryDescriptor } from '@/types/fusion';
import { FusionControlPanelV2, type FusionLayoutPreset } from './fusion-control-panel-v2';
// Viewport UI components
import { ViewportActionCorners } from './viewport-action-corners';
import { ViewportOrientationMarkers, OrientationBadge, type ViewOrientation } from './viewport-orientation-markers';
import { WindowLevelOverlay, ZoomOverlay, SliceOverlay } from './viewport-overlay';
import { useViewportHoverRef } from '@/hooks/use-viewport-hover';

// ============================================================================
// TYPES
// ============================================================================

export interface AdvancedViewportLayoutProps {
  // Study/Series data
  studyId: number;
  availableSeries: DICOMSeries[];
  initialSeriesId?: number;
  
  // RT Structures
  rtStructures?: any;
  structureVisibility?: Map<number, boolean>;
  allStructuresVisible?: boolean;
  selectedForEdit?: number | null;
  selectedStructures?: Set<number> | null;
  onContourUpdate?: (structures: any) => void;
  onRTStructureUpdate?: (structures: any) => void;
  contourSettings?: any;
  
  // Brush/Tool state
  brushToolState?: any;
  onBrushSizeChange?: (size: number) => void;
  
  // Window/Level
  windowLevel?: { width: number; center: number };
  onWindowLevelChange?: (wl: { width: number; center: number }) => void;
  
  // Fusion
  fusionOpacity?: number;
  onFusionOpacityChange?: (opacity: number) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  onFusionWindowLevelChange?: (preset: { window: number; level: number } | null) => void;
  registrationAssociations?: Map<number, number[]>;
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  
  // Fusion panel props for unified toolbar
  fusionSecondaryOptions?: FusionSecondaryDescriptor[];
  selectedFusionSecondaryId?: number | null;
  onFusionSecondarySelect?: (seriesId: number | null) => void;
  fusionLayoutPreset?: FusionLayoutPreset;
  onFusionLayoutPresetChange?: (preset: FusionLayoutPreset) => void;
  onSwapFusionViewports?: () => void;
  
  // Image cache
  imageCache?: React.MutableRefObject<Map<string, { images: any[], metadata: any }>>;
  
  // Callbacks
  onActiveViewportChange?: (viewportId: string | null) => void;
  onLayoutChange?: (preset: GridLayoutPreset) => void;
  onImageMetadataChange?: (metadata: any) => void;
  onActivePredictionsChange?: (predictions: Map<string, any>) => void;
  onExitMultiViewport?: () => void;  // Exit multi-viewport mode
  
  // Display options
  showLayoutToolbar?: boolean;
  compactMode?: boolean;
  className?: string;
  
  // Fusion panel control (external state from parent)
  showFusionPanel?: boolean;
  onShowFusionPanelChange?: (show: boolean) => void;
}

// Layout button configuration with enhanced styling
interface LayoutButtonConfig {
  preset: GridLayoutPreset;
  icon: React.ReactNode;
  label: string;
  description: string;
  shortcut?: string;
}

const LAYOUT_BUTTONS: LayoutButtonConfig[] = [
  { preset: '1x1', icon: <Maximize2 className="w-3.5 h-3.5" />, label: '1×1', description: 'Single viewport', shortcut: '1' },
  { preset: '1x2', icon: <Columns className="w-3.5 h-3.5" />, label: '1×2', description: 'Side by side', shortcut: '2' },
  { preset: '2x1', icon: <Rows className="w-3.5 h-3.5" />, label: '2×1', description: 'Stacked', shortcut: '3' },
  { preset: '2x2', icon: <Grid2x2 className="w-3.5 h-3.5" />, label: '2×2', description: '2×2 grid', shortcut: '4' },
  { preset: '3x3', icon: <Grid3X3 className="w-3.5 h-3.5" />, label: '3×3', description: '3×3 grid', shortcut: '5' },
  { preset: 'MPR', icon: <Box className="w-3.5 h-3.5" />, label: 'MPR', description: 'Multi-planar reconstruction', shortcut: 'M' },
];

// ============================================================================
// VIEWPORT PANE COMPONENT
// ============================================================================

interface ViewportPaneProps {
  viewport: Viewport;
  isActive: boolean;
  series: DICOMSeries | undefined;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
  
  // Pass-through props for WorkingViewer
  studyId: number;
  rtStructures?: any;
  structureVisibility?: Map<number, boolean>;
  allStructuresVisible?: boolean;
  selectedForEdit?: number | null;
  selectedStructures?: Set<number> | null;
  onContourUpdate?: (structures: any) => void;
  brushToolState?: any;
  onBrushSizeChange?: (size: number) => void;
  windowLevel?: { width: number; center: number };
  onWindowLevelChange?: (wl: { width: number; center: number }) => void;
  fusionOpacity?: number;
  onFusionOpacityChange?: (opacity: number) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  registrationAssociations?: Map<number, number[]>;
  fusionSecondaryStatuses?: Map<number, { status: string; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  imageCache?: React.MutableRefObject<Map<string, { images: any[], metadata: any }>>;
  onImageMetadataChange?: (metadata: any) => void;
  onActivePredictionsChange?: (predictions: Map<string, any>) => void;
  // For fusion overlay loading
  availableSeries?: DICOMSeries[];
  onAddFusionToViewport?: (viewportId: string, secondaryId: number) => void;
}

const ViewportPane: React.FC<ViewportPaneProps> = ({
  viewport,
  isActive,
  series,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  studyId,
  rtStructures,
  structureVisibility,
  allStructuresVisible,
  selectedForEdit,
  selectedStructures,
  onContourUpdate,
  brushToolState,
  onBrushSizeChange,
  windowLevel,
  onWindowLevelChange,
  fusionOpacity,
  onFusionOpacityChange,
  fusionWindowLevel,
  registrationAssociations,
  fusionSecondaryStatuses,
  fusionManifestLoading,
  fusionManifestPrimarySeriesId,
  imageCache,
  onImageMetadataChange,
  onActivePredictionsChange,
  availableSeries,
  onAddFusionToViewport,
}) => {
  const paneRef = useRef<HTMLDivElement>(null);
  
  // OHIF-style hover tracking
  const { isHovered, shouldShowControls } = useViewportHoverRef(paneRef, isActive);
  
  // Internal state for overlay data
  const [internalMetadata, setInternalMetadata] = useState<{
    sliceLocation?: number;
    sliceThickness?: number;
    instanceNumber?: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);

  // Determine orientation based on viewport type
  const orientation: ViewOrientation = useMemo(() => {
    switch (viewport.type) {
      case 'MPR_SAGITTAL': return 'sagittal';
      case 'MPR_CORONAL': return 'coronal';
      default: return 'axial';
    }
  }, [viewport.type]);

  // Get label for viewport
  const viewportLabel = useMemo(() => {
    if (viewport.label) return viewport.label;
    switch (viewport.type) {
      case 'MPR_AXIAL': return 'Axial';
      case 'MPR_SAGITTAL': return 'Sagittal';
      case 'MPR_CORONAL': return 'Coronal';
      case 'FUSION': return 'Fused';
      case 'VOLUME_3D': return '3D';
      default: 
        if (series) return series.modality || 'Series';
        return 'Empty';
    }
  }, [viewport, series]);

  // Get modality color - using app design language
  const getModalityColor = (modality?: string) => {
    switch (modality?.toUpperCase()) {
      case 'CT': return 'bg-indigo-500/25 text-indigo-200 border-indigo-400/50';
      case 'MR':
      case 'MRI': return 'bg-purple-500/25 text-purple-200 border-purple-400/50';
      case 'PT':
      case 'PET': return 'bg-amber-500/25 text-amber-200 border-amber-400/50';
      case 'RTSTRUCT': return 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50';
      default: return 'bg-gray-500/25 text-gray-300 border-gray-400/50';
    }
  };

  // Handle metadata from WorkingViewer
  const handleMetadataChange = useCallback((metadata: any) => {
    if (metadata) {
      setInternalMetadata({
        sliceLocation: metadata.sliceLocation ? parseFloat(metadata.sliceLocation) : undefined,
        sliceThickness: metadata.sliceThickness ? parseFloat(metadata.sliceThickness) : undefined,
        instanceNumber: metadata.instanceNumber,
      });
      if (metadata.numberOfFrames) {
        setTotalSlices(parseInt(metadata.numberOfFrames, 10));
      }
    }
    onImageMetadataChange?.(metadata);
  }, [onImageMetadataChange]);

  return (
    <motion.div
      ref={paneRef}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "viewport-pane relative overflow-hidden bg-black transition-all duration-200 cursor-pointer",
        "rounded-lg",
        // Active state - indigo glow with gradient border effect
        isActive 
          ? "ring-2 ring-indigo-500/70 shadow-[0_0_20px_rgba(99,102,241,0.3),inset_0_0_0_1px_rgba(99,102,241,0.2)] z-10" 
          : "ring-1 ring-white/10 hover:ring-white/20 hover:ring-2",
        // Drag over state
        isDragOver && "ring-2 ring-amber-400 bg-amber-500/5 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
      )}
      style={{
        // Use CSS Grid placement based on viewport position
        gridColumn: `${viewport.position.col + 1} / span ${viewport.position.width}`,
        gridRow: `${viewport.position.row + 1} / span ${viewport.position.height}`,
        // Force the pane to respect grid sizing
        minHeight: 0,
        minWidth: 0,
        maxHeight: '100%',
        maxWidth: '100%',
      }}
      data-viewport-id={viewport.id}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ViewportActionCorners.Container>
        {/* Main content */}
        {viewport.seriesId ? (
          <div className="overflow-hidden" style={{ width: '100%', height: '100%', minHeight: 0, maxHeight: '100%' }}>
            <WorkingViewer
              key={`wv-${viewport.id}-${viewport.seriesId}-sec-${viewport.secondarySeriesIds?.[0] ?? 'none'}`}
              seriesId={viewport.seriesId}
              studyId={viewport.studyId ?? studyId}
              orientation={orientation}
              windowLevel={windowLevel}
              onWindowLevelChange={onWindowLevelChange}
              rtStructures={rtStructures}
              structureVisibility={structureVisibility}
              allStructuresVisible={allStructuresVisible}
              selectedForEdit={selectedForEdit}
              selectedStructures={selectedStructures}
              onContourUpdate={onContourUpdate}
              brushToolState={brushToolState}
              onBrushSizeChange={onBrushSizeChange}
              imageCache={imageCache}
              // Fusion props
              secondarySeriesId={viewport.secondarySeriesIds?.[0] ?? null}
              fusionOpacity={fusionOpacity}
              fusionDisplayMode="overlay"
              hasSecondarySeriesForFusion={(viewport.secondarySeriesIds?.length ?? 0) > 0}
              fusionWindowLevel={fusionWindowLevel}
              registrationAssociations={registrationAssociations}
              fusionSecondaryStatuses={fusionSecondaryStatuses as any}
              fusionManifestLoading={fusionManifestLoading}
              fusionManifestPrimarySeriesId={fusionManifestPrimarySeriesId}
              onImageMetadataChange={handleMetadataChange}
              onActivePredictionsChange={onActivePredictionsChange}
              onZoomChange={setZoom}
              onSliceIndexChange={(idx) => setCurrentSlice(idx)}
              // MPR flags
              isMPRVisible={viewport.type.startsWith('MPR_')}
              hideToolbar
              hideSidebar
              compactMode
              // Cross-viewport ghost contour sync
              viewportId={viewport.id}
            />
            
            {/* OHIF-style Orientation Markers */}
            <ViewportOrientationMarkers 
              orientation={orientation}
              showMarkers={['top', 'left']}
            />
          </div>
        ) : (
          /* Empty viewport placeholder - refined design */
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-950 via-black to-gray-950">
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-3 border border-indigo-500/20 backdrop-blur-sm">
                <LayoutGrid className="w-6 h-6 text-indigo-400/60" />
              </div>
              <p className="text-sm font-medium text-gray-400 mb-0.5">No series assigned</p>
              <p className="text-[11px] text-gray-600">Drag a series here to view</p>
            </motion.div>
          </div>
        )}

        {/* ===== VIEWPORT TOP BAR - Matching App Design ===== */}
        <div className="absolute top-0 left-0 right-0 z-40 pointer-events-auto">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#0f1219]/95 backdrop-blur-sm border-b border-white/[0.06]">
            {/* Left: Modality + Orientation + Status */}
            <div className="flex items-center gap-2">
              {/* Modality badge - matching sidebar badges */}
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-md font-semibold",
                series?.modality === 'CT' 
                  ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                  : series?.modality === 'PT' || series?.modality === 'PET'
                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                  : series?.modality === 'MR' || series?.modality === 'MRI'
                  ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                  : "bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/30"
              )}>
                {viewportLabel}
              </span>
              
              {/* Orientation - subtle */}
              <span className="text-[10px] text-gray-500 font-medium uppercase">
                {orientation === 'axial' ? 'AX' : orientation === 'sagittal' ? 'SAG' : 'COR'}
              </span>
              
              {/* Fusion indicator */}
              {viewport.secondarySeriesIds && viewport.secondarySeriesIds.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  FUSED
                </span>
              )}
            </div>
            
            {/* Center: Opacity slider (for fusion viewports) */}
            {viewport.secondarySeriesIds && viewport.secondarySeriesIds.length > 0 && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-md border border-white/10">
                <span className="text-[9px] text-gray-400 uppercase tracking-wide">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={fusionOpacity ?? 0.5}
                  onChange={(e) => { e.stopPropagation(); onFusionOpacityChange?.(parseFloat(e.target.value)); }}
                  className="w-20 h-1 accent-cyan-500 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  title={`Fusion opacity: ${Math.round((fusionOpacity ?? 0.5) * 100)}%`}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-[10px] text-cyan-300 font-medium min-w-[32px] text-center">
                  {Math.round((fusionOpacity ?? 0.5) * 100)}%
                </span>
              </div>
            )}
            
            {/* Add fusion dropdown for non-fusion viewports */}
            {(!viewport.secondarySeriesIds || viewport.secondarySeriesIds.length === 0) && 
             availableSeries && 
             onAddFusionToViewport && 
             viewport.seriesId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors text-[10px] text-indigo-300 ring-1 ring-indigo-500/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Layers className="w-3 h-3" />
                    <span className="font-medium">Add Fusion</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="center" 
                  className="min-w-[140px] bg-[#0f1219] border-white/10"
                >
                  {availableSeries
                    .filter(s => s.id !== viewport.seriesId && s.modality && !['CT', 'RTSTRUCT', 'RTDOSE', 'RTPLAN'].includes(s.modality.toUpperCase()))
                    .map(secSeries => {
                      const status = fusionSecondaryStatuses?.get(secSeries.id);
                      const isReady = status?.status === 'ready';
                      
                      return (
                        <DropdownMenuItem
                          key={secSeries.id}
                          onClick={() => onAddFusionToViewport(viewport.id, secSeries.id)}
                          disabled={!isReady}
                          className={cn(
                            "text-xs cursor-pointer flex items-center gap-2",
                            !isReady && "opacity-50"
                          )}
                        >
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isReady ? "bg-emerald-400" : status?.status === 'loading' ? "bg-amber-400 animate-pulse" : "bg-gray-500"
                          )} />
                          <span>{secSeries.modality || 'SEC'}</span>
                        </DropdownMenuItem>
                      );
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Right: Actions placeholder */}
            <div className="flex items-center gap-1">
              {/* Could add viewport-specific actions here */}
            </div>
          </div>
        </div>

        {/* Bottom-Left: Window/Level + Zoom info (always visible) */}
        <ViewportActionCorners.BottomLeft>
          <div className="flex flex-col gap-0.5 text-[10px] font-mono bg-black/30 backdrop-blur-sm rounded px-1.5 py-0.5">
            {windowLevel && (
              <WindowLevelOverlay 
                windowWidth={windowLevel.width} 
                windowCenter={windowLevel.center}
                className="text-gray-200/90"
              />
            )}
            <ZoomOverlay scale={zoom} className="text-gray-200/90" />
          </div>
        </ViewportActionCorners.BottomLeft>

        {/* Bottom-Right: Slice info (always visible) */}
        <ViewportActionCorners.BottomRight>
          <div className="bg-black/30 backdrop-blur-sm rounded px-1.5 py-0.5">
            <SliceOverlay
              currentSlice={currentSlice}
              totalSlices={totalSlices || series?.imageCount || 0}
              instanceNumber={internalMetadata?.instanceNumber}
              sliceLocation={internalMetadata?.sliceLocation}
              sliceThickness={internalMetadata?.sliceThickness}
              className="text-[10px] font-mono text-gray-200/90"
            />
          </div>
        </ViewportActionCorners.BottomRight>
      </ViewportActionCorners.Container>

      {/* Drag overlay - refined */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-amber-500/15 to-orange-500/15 border-2 border-dashed border-amber-400/60 rounded-lg flex items-center justify-center z-50 backdrop-blur-[2px]"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black/80 backdrop-blur-sm rounded-xl px-5 py-3 flex items-center gap-3 border border-amber-500/30"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-amber-200">Drop to assign</span>
                <span className="text-xs text-amber-300/60">Release to load series</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay - refined */}
      <AnimatePresence>
        {viewport.isReady === false && viewport.seriesId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-40 gap-3"
          >
            <div className="relative">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="absolute inset-0 w-8 h-8 rounded-full bg-indigo-500/20 animate-ping" />
            </div>
            <span className="text-xs text-gray-400 font-medium">Loading series...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// LAYOUT TOOLBAR COMPONENT - Harmonized Design
// ============================================================================

interface LayoutToolbarProps {
  currentLayout: GridLayoutPreset;
  onLayoutChange: (preset: GridLayoutPreset) => void;
  onReset: () => void;
  onExit?: () => void;  // Exit multi-viewport mode
  viewportCount: number;
  showAdvancedOptions?: boolean;
  // Fusion controls
  availableSeries?: DICOMSeries[];
  onAddFusionViewport?: (secondaryId: number) => void;
  fusionSecondaryStatuses?: Map<number, { status: string; error?: string | null }>;
  // Fusion panel props for unified toolbar
  showFusionPanel?: boolean;
  onToggleFusionPanel?: () => void;
  fusionPanelActive?: boolean;
}

const LayoutToolbar: React.FC<LayoutToolbarProps> = ({
  currentLayout,
  onLayoutChange,
  onReset,
  onExit,
  viewportCount,
  showAdvancedOptions = false,
  availableSeries = [],
  onAddFusionViewport,
  fusionSecondaryStatuses,
  showFusionPanel = true,
  onToggleFusionPanel,
  fusionPanelActive = false,
}) => {
  // Determine which preset is active based on current layout
  const isPresetActive = (preset: GridLayoutPreset) => {
    return currentLayout === preset;
  };

  // Get secondary series (non-CT modalities that can be fused)
  const secondarySeries = availableSeries.filter(s => 
    s.modality && !['CT', 'RTSTRUCT', 'RTDOSE', 'RTPLAN'].includes(s.modality.toUpperCase())
  );

  // Get modality color - matching app theme
  const getModalityColor = (modality?: string) => {
    switch (modality?.toUpperCase()) {
      case 'PT':
      case 'PET': return 'amber';
      case 'MR':
      case 'MRI': return 'purple';
      default: return 'slate';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-gray-950/98 via-gray-900/98 to-gray-950/98 backdrop-blur-md border-b border-white/5"
    >
      {/* Multi-viewport indicator */}
      <div className="flex items-center gap-2 pr-3 border-r border-white/10">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30">
          <MonitorUp className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="text-xs font-semibold text-gray-300 tracking-wide">Multi-View</span>
      </div>

      {/* Layout buttons - pill group style */}
      <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-white/5">
        <TooltipProvider delayDuration={200}>
          {LAYOUT_BUTTONS.map(({ preset, icon, label, description, shortcut }) => (
            <Tooltip key={preset}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onLayoutChange(preset)}
                  className={cn(
                    "relative h-7 px-2.5 rounded-md transition-all duration-200 flex items-center gap-1.5 text-xs font-medium",
                    isPresetActive(preset)
                      ? "bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white shadow-lg shadow-indigo-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {icon}
                  <span className={cn(
                    "transition-all duration-200",
                    isPresetActive(preset) ? "opacity-100" : "opacity-70"
                  )}>{label}</span>
                  {isPresetActive(preset) && (
                    <motion.div
                      layoutId="activeLayout"
                      className="absolute inset-0 rounded-md bg-gradient-to-r from-indigo-600/80 to-purple-600/80 -z-10"
                      transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent 
                side="bottom" 
                className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50 px-3 py-2"
              >
                <p className="font-semibold text-white">{label}</p>
                <p className="text-gray-400 text-[11px]">{description}</p>
                {shortcut && (
                  <p className="text-gray-500 text-[10px] mt-1">
                    Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-300">{shortcut}</kbd>
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Add Fusion Viewport - Secondary Series Selection */}
      {secondarySeries.length > 0 && onAddFusionViewport && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Fusion</span>
          <div className="flex items-center gap-1">
            {secondarySeries.slice(0, 4).map(series => {
              const status = fusionSecondaryStatuses?.get(series.id);
              const isReady = status?.status === 'ready';
              const colorClass = getModalityColor(series.modality);
              
              const colorSchemes = {
                amber: isReady 
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/40 hover:bg-amber-500/30 hover:border-amber-400/60' 
                  : 'bg-amber-900/15 text-amber-500/50 border-amber-700/20',
                purple: isReady 
                  ? 'bg-purple-500/20 text-purple-200 border-purple-400/40 hover:bg-purple-500/30 hover:border-purple-400/60' 
                  : 'bg-purple-900/15 text-purple-500/50 border-purple-700/20',
                slate: isReady 
                  ? 'bg-slate-500/20 text-slate-200 border-slate-400/40 hover:bg-slate-500/30 hover:border-slate-400/60' 
                  : 'bg-slate-900/15 text-slate-500/50 border-slate-700/20',
              };
              
              return (
                <button
                  key={series.id}
                  onClick={() => onAddFusionViewport(series.id)}
                  disabled={!isReady}
                  className={cn(
                    "px-2 py-1 text-[10px] font-semibold rounded-md border transition-all duration-200 flex items-center gap-1",
                    colorSchemes[colorClass as keyof typeof colorSchemes] || colorSchemes.slate,
                    isReady ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                  )}
                  title={isReady ? `Add ${series.modality} fusion viewport` : `${series.modality} loading...`}
                >
                  {series.modality}
                  {status?.status === 'loading' && (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  )}
                  {isReady && <Plus className="w-2.5 h-2.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fusion Panel Toggle */}
      {showFusionPanel && onToggleFusionPanel && (
        <>
          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleFusionPanel}
                  className={cn(
                    "h-7 px-3 rounded-md transition-all duration-200 flex items-center gap-1.5 text-xs font-medium border",
                    fusionPanelActive
                      ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10"
                      : "text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 border-transparent hover:border-amber-500/30"
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Fusion
                  {fusionPanelActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50 px-3 py-2">
                <p className="font-semibold text-white">Fusion Controls</p>
                <p className="text-gray-400 text-[11px]">Open the fusion panel to adjust overlay settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Viewport count badge */}
      <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-md border border-white/5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Viewports</span>
        <span className="text-xs font-bold text-indigo-300">{viewportCount}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Reset button */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onReset}
              className="h-7 px-2.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50">
            <p className="text-[11px]">Reset to default layout</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* Exit button */}
      {onExit && (
        <>
          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <button
            onClick={onExit}
            className="h-7 px-3 rounded-md bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
          >
            <X className="w-3.5 h-3.5" />
            Exit
          </button>
        </>
      )}
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AdvancedViewportLayout: React.FC<AdvancedViewportLayoutProps> = ({
  studyId,
  availableSeries,
  initialSeriesId,
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
  fusionOpacity = 0.5,
  onFusionOpacityChange,
  fusionWindowLevel,
  onFusionWindowLevelChange,
  registrationAssociations,
  fusionSecondaryStatuses,
  fusionManifestLoading,
  fusionManifestPrimarySeriesId,
  // Fusion panel props
  fusionSecondaryOptions = [],
  selectedFusionSecondaryId,
  onFusionSecondarySelect,
  fusionLayoutPreset = 'overlay',
  onFusionLayoutPresetChange,
  onSwapFusionViewports,
  imageCache,
  onActiveViewportChange,
  onLayoutChange,
  onImageMetadataChange,
  onActivePredictionsChange,
  onExitMultiViewport,
  showLayoutToolbar = true,
  compactMode = false,
  className,
  // Fusion panel control
  showFusionPanel: externalShowFusionPanel,
  onShowFusionPanelChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [dragOverViewportId, setDragOverViewportId] = useState<string | null>(null);
  const [currentPreset, setCurrentPreset] = useState<GridLayoutPreset>('1x1');
  
  // Use external fusion panel state if provided, otherwise manage internally
  const [internalShowFusionPanel, setInternalShowFusionPanel] = useState(false);
  const showFusionControlPanel = externalShowFusionPanel !== undefined ? externalShowFusionPanel : internalShowFusionPanel;
  const setShowFusionControlPanel = (show: boolean) => {
    if (onShowFusionPanelChange) {
      onShowFusionPanelChange(show);
    } else {
      setInternalShowFusionPanel(show);
    }
  };

  // Subscribe to viewport grid service
  const {
    grid,
    layout,
    viewportsArray,
    activeViewportId,
    setLayout,
    setActiveViewport,
    assignSeries,
    reset,
  } = useViewportGrid();

  // Initialize with first series if provided
  useEffect(() => {
    if (initialSeriesId && viewportsArray.length > 0) {
      const firstViewport = viewportsArray[0];
      if (!firstViewport.seriesId) {
        assignSeries(firstViewport.id, initialSeriesId, studyId);
      }
    }
  }, [initialSeriesId, studyId]);

  // Calculate container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate viewport dimensions based on container size
  const viewportDimensions = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return new Map<string, { x: number; y: number; width: number; height: number }>();
    }

    const padding = compactMode ? 2 : 4; // Must match the padding in the container style
    const gap = 4; // Gap between viewports
    const { numRows, numCols } = layout;
    
    // Subtract padding from both sides
    const containerWidth = containerSize.width - (padding * 2);
    const containerHeight = containerSize.height - (padding * 2);
    
    const availableWidth = containerWidth - (numCols - 1) * gap;
    const availableHeight = containerHeight - (numRows - 1) * gap;
    
    const cellWidth = availableWidth / numCols;
    const cellHeight = availableHeight / numRows;

    const dimensions = new Map<string, { x: number; y: number; width: number; height: number }>();

    viewportsArray.forEach(viewport => {
      const x = viewport.position.col * (cellWidth + gap);
      const y = viewport.position.row * (cellHeight + gap);
      const width = viewport.position.width * cellWidth + (viewport.position.width - 1) * gap;
      const height = viewport.position.height * cellHeight + (viewport.position.height - 1) * gap;

      dimensions.set(viewport.id, { x, y, width, height });
    });

    return dimensions;
  }, [containerSize, layout, viewportsArray, compactMode]);

  // Get series map for quick lookup
  const seriesMap = useMemo(() => {
    const map = new Map<number, DICOMSeries>();
    availableSeries.forEach(s => map.set(s.id, s));
    return map;
  }, [availableSeries]);

  // Handle layout change
  const handleLayoutChange = useCallback((preset: GridLayoutPreset) => {
    // Find the first series with content if we're in an MPR layout
    const firstSeriesId = viewportsArray.find(vp => vp.seriesId)?.seriesId ?? initialSeriesId;
    
    setLayout(preset, {
      seriesId: firstSeriesId,
      studyId,
      preserveContent: preset !== 'MPR' && preset !== 'MPR_3x1',
    });
    
    setCurrentPreset(preset);
    onLayoutChange?.(preset);
  }, [setLayout, viewportsArray, initialSeriesId, studyId, onLayoutChange]);

  // Handle viewport click
  const handleViewportClick = useCallback((viewportId: string) => {
    setActiveViewport(viewportId);
    onActiveViewportChange?.(viewportId);
  }, [setActiveViewport, onActiveViewportChange]);

  // Handle drag & drop
  const handleDragOver = useCallback((viewportId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverViewportId(viewportId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverViewportId(null);
  }, []);

  const handleDrop = useCallback((viewportId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverViewportId(null);
    
    const seriesIdStr = e.dataTransfer.getData('seriesId') || e.dataTransfer.getData('text/plain');
    const seriesId = parseInt(seriesIdStr, 10);
    
    if (!isNaN(seriesId)) {
      const series = seriesMap.get(seriesId);
      assignSeries(viewportId, seriesId, series?.studyId ?? studyId);
    }
  }, [assignSeries, seriesMap, studyId]);

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
    setCurrentPreset('1x1');
    if (initialSeriesId) {
      // Re-apply initial series after reset
      setTimeout(() => {
        const state = viewportGridService.getState();
        const firstViewportId = state.viewports.keys().next().value;
        if (firstViewportId) {
          assignSeries(firstViewportId, initialSeriesId, studyId);
        }
      }, 0);
    }
  }, [reset, initialSeriesId, studyId, assignSeries]);

  // Handle adding a fusion viewport with a specific secondary series
  const handleAddFusionViewport = useCallback((secondarySeriesId: number) => {
    // Switch to 1x2 layout if we're in 1x1
    if (currentPreset === '1x1') {
      setLayout('1x2', {
        seriesId: initialSeriesId,
        studyId,
        preserveContent: true,
      });
      setCurrentPreset('1x2');
    }
    
    // Find an empty viewport or the second viewport to assign the fusion
    setTimeout(() => {
      const state = viewportGridService.getState();
      const viewportIds = Array.from(state.viewports.keys());
      
      // Find a viewport without a series or the second one
      const targetViewportId = viewportIds.find(id => {
        const vp = state.viewports.get(id);
        return !vp?.seriesId;
      }) || viewportIds[1];
      
      if (targetViewportId) {
        // Assign the primary series with the secondary as fusion overlay
        const primarySeries = initialSeriesId ?? viewportsArray[0]?.seriesId;
        if (primarySeries) {
          // First assign the primary series
          assignSeries(targetViewportId, primarySeries, studyId);
          
          // Then configure fusion overlay
          setTimeout(() => {
            const viewport = viewportGridService.getState().viewports.get(targetViewportId);
            if (viewport) {
              viewportGridService.updateViewport(targetViewportId, {
                secondarySeriesIds: [secondarySeriesId],
                type: 'FUSION',
                label: `Fusion (${availableSeries.find(s => s.id === secondarySeriesId)?.modality || 'SEC'})`,
              });
            }
          }, 100);
        }
      }
    }, 100);
  }, [currentPreset, setLayout, initialSeriesId, studyId, viewportsArray, assignSeries, availableSeries]);

  // Handle adding fusion overlay to an existing viewport
  const handleAddFusionToViewport = useCallback((viewportId: string, secondarySeriesId: number) => {
    const viewport = viewportsArray.find(v => v.id === viewportId);
    if (viewport) {
      viewportGridService.updateViewport(viewportId, {
        secondarySeriesIds: [secondarySeriesId],
        type: 'FUSION',
        label: `Fusion (${availableSeries.find(s => s.id === secondarySeriesId)?.modality || 'SEC'})`,
      });
    }
  }, [viewportsArray, availableSeries]);

  return (
    <div className={cn("flex flex-col bg-black overflow-hidden", className)} style={{ flex: '1 1 0', minHeight: 0, minWidth: 0, width: '100%' }}>
      {/* Layout toolbar */}
      {showLayoutToolbar && (
        <LayoutToolbar
          currentLayout={currentPreset}
          onLayoutChange={handleLayoutChange}
          onReset={handleReset}
          onExit={onExitMultiViewport}
          viewportCount={viewportsArray.length}
          showAdvancedOptions={true}
          availableSeries={availableSeries}
          onAddFusionViewport={handleAddFusionViewport}
          fusionSecondaryStatuses={fusionSecondaryStatuses as Map<number, { status: string; error?: string | null }>}
          showFusionPanel={fusionSecondaryOptions.length > 0}
          onToggleFusionPanel={() => setShowFusionControlPanel(!showFusionControlPanel)}
          fusionPanelActive={showFusionControlPanel}
        />
      )}
      
      {/* Fusion Control Panel - Unified for both single and multi-view modes */}
      {showFusionControlPanel && fusionSecondaryOptions.length > 0 && (
        <div className="fixed z-50" style={{ right: '1rem', top: '6.5rem', width: '22rem' }}>
          <FusionControlPanelV2
            opacity={fusionOpacity}
            onOpacityChange={onFusionOpacityChange || (() => {})}
            secondaryOptions={fusionSecondaryOptions}
            selectedSecondaryId={selectedFusionSecondaryId ?? null}
            onSecondarySeriesSelect={onFusionSecondarySelect || (() => {})}
            secondaryStatuses={fusionSecondaryStatuses || new Map()}
            manifestLoading={fusionManifestLoading}
            windowLevel={fusionWindowLevel}
            onWindowLevelPreset={onFusionWindowLevelChange}
            primarySeriesId={initialSeriesId}
            layoutPreset={fusionLayoutPreset}
            onLayoutPresetChange={onFusionLayoutPresetChange}
            onSwapViewports={onSwapFusionViewports}
            enableFlexibleLayout={true}
            studyId={studyId}
            isExpanded={true}
            onExpandedChange={(expanded) => {
              if (!expanded) setShowFusionControlPanel(false);
            }}
          />
        </div>
      )}

      {/* Viewport grid container - uses CSS Grid for reliable sizing */}
      <div 
        ref={containerRef}
        className="bg-gradient-to-br from-gray-950 via-black to-gray-950 overflow-hidden grid"
        style={{ 
          flex: '1 1 0',
          minHeight: 0,
          padding: compactMode ? '4px' : '6px',
          gap: compactMode ? '4px' : '6px',
          gridTemplateColumns: `repeat(${layout.numCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.numRows}, minmax(0, 1fr))`,
        }}
      >
        <AnimatePresence mode="popLayout">
          {viewportsArray.map(viewport => {
            const series = viewport.seriesId ? seriesMap.get(viewport.seriesId) : undefined;

            return (
              <ViewportPane
                key={viewport.id}
                viewport={viewport}
                isActive={viewport.id === activeViewportId}
                series={series}
                onClick={() => handleViewportClick(viewport.id)}
                onDragOver={handleDragOver(viewport.id)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop(viewport.id)}
                isDragOver={dragOverViewportId === viewport.id}
                studyId={studyId}
                rtStructures={rtStructures}
                structureVisibility={structureVisibility}
                allStructuresVisible={allStructuresVisible}
                selectedForEdit={selectedForEdit}
                selectedStructures={selectedStructures}
                onContourUpdate={onContourUpdate}
                brushToolState={brushToolState}
                onBrushSizeChange={onBrushSizeChange}
                windowLevel={windowLevel}
                onWindowLevelChange={onWindowLevelChange}
                fusionOpacity={fusionOpacity}
                onFusionOpacityChange={onFusionOpacityChange}
                fusionWindowLevel={fusionWindowLevel}
                registrationAssociations={registrationAssociations}
                fusionSecondaryStatuses={fusionSecondaryStatuses}
                fusionManifestLoading={fusionManifestLoading}
                fusionManifestPrimarySeriesId={fusionManifestPrimarySeriesId}
                imageCache={imageCache}
                onImageMetadataChange={onImageMetadataChange}
                onActivePredictionsChange={onActivePredictionsChange}
                availableSeries={availableSeries}
                onAddFusionToViewport={handleAddFusionToViewport}
              />
            );
          })}
        </AnimatePresence>

        {/* Empty state - refined design */}
        {viewportsArray.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-full row-span-full flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center p-8 rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-950/50 border border-white/5 backdrop-blur-sm">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-4 border border-indigo-500/20">
                <LayoutGrid className="w-8 h-8 text-indigo-400/50" />
              </div>
              <p className="text-sm font-semibold text-gray-300 mb-1">No viewports configured</p>
              <p className="text-xs text-gray-500">Select a layout from the toolbar to begin</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdvancedViewportLayout;

