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
  PanelLeftClose,
  PanelRightClose,
  BookmarkPlus,
  Bookmark,
  Focus,
  Minimize2,
  Save,
  FolderOpen,
  Trash2,
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
  { preset: '1x2', icon: <Columns className="w-3.5 h-3.5" />, label: 'Side by Side', description: 'Multi-viewport side by side', shortcut: '2' },
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
          <div className="flex items-center justify-between px-2.5 py-1.5 backdrop-blur-xl border-b"
            style={{ backgroundColor: '#1e2533f0', borderColor: '#4a5568a0' }}
          >
            {/* Left: Modality + Orientation + Status */}
            <div className="flex items-center gap-2">
              {/* Modality badge - vibrant pill style */}
              <span className={cn(
                "text-[10px] px-2.5 py-0.5 rounded-full font-semibold shadow-sm",
                series?.modality === 'CT' 
                  ? "bg-blue-600/80 text-white border border-blue-400/60 shadow-blue-500/20"
                  : series?.modality === 'PT' || series?.modality === 'PET'
                  ? "bg-amber-600/80 text-white border border-amber-400/60 shadow-amber-500/20"
                  : series?.modality === 'MR' || series?.modality === 'MRI'
                  ? "bg-purple-600/80 text-white border border-purple-400/60 shadow-purple-500/20"
                  : "bg-gray-600/80 text-white border border-gray-400/60 shadow-gray-500/20"
              )}>
                {viewportLabel}
              </span>
              
              {/* Orientation - subtle */}
              <span className="text-[10px] text-gray-300 font-medium uppercase">
                {orientation === 'axial' ? 'AX' : orientation === 'sagittal' ? 'SAG' : 'COR'}
              </span>
              
              {/* Fusion indicator */}
              {viewport.secondarySeriesIds && viewport.secondarySeriesIds.length > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-emerald-600/80 text-white border border-emerald-400/60 shadow-sm shadow-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  FUSED
                </span>
              )}
            </div>
            
            {/* Center: Opacity slider (for fusion viewports) */}
            {viewport.secondarySeriesIds && viewport.secondarySeriesIds.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/30 rounded-full border border-cyan-400/50 shadow-sm shadow-cyan-500/20">
                <span className="text-[9px] text-white uppercase tracking-wide font-semibold">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={fusionOpacity ?? 0.5}
                  onChange={(e) => { e.stopPropagation(); onFusionOpacityChange?.(parseFloat(e.target.value)); }}
                  className="w-20 h-1 accent-cyan-400 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  title={`Fusion opacity: ${Math.round((fusionOpacity ?? 0.5) * 100)}%`}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-[10px] text-white font-semibold min-w-[32px] text-center">
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
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/80 hover:bg-indigo-600/90 transition-colors text-[10px] text-white border border-indigo-400/60 shadow-sm shadow-indigo-500/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Layers className="w-3 h-3" />
                    <span className="font-semibold">Add Fusion</span>
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

interface ViewportOpacity {
  viewportId: string;
  viewportNumber: number;
  modality: string;
  opacity: number;
}

// Saved layout preset interface
interface SavedLayoutPreset {
  id: string;
  name: string;
  layout: GridLayoutPreset;
  viewportConfigs: Array<{
    seriesId?: number;
    secondarySeriesIds?: number[];
    modality?: string;
  }>;
  createdAt: string;
}

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
  // Global opacity slider
  viewportOpacities?: ViewportOpacity[];
  onGlobalOpacityChange?: (opacity: number) => void;
  onResetAllOpacities?: () => void;
  // Focus controls
  onFocusLeft?: () => void;
  onFocusRight?: () => void;
  // Single/Maximize - temporary maximize of one viewport
  isMaximized?: boolean;
  maximizedViewportId?: string | null;
  onToggleMaximize?: () => void;
  // Add viewport
  onAddViewport?: (seriesId: number) => void;
  // Save/Load with persistence
  savedLayouts?: SavedLayoutPreset[];
  onSaveLayout?: (name: string) => void;
  onLoadLayout?: (preset: SavedLayoutPreset) => void;
  onDeleteLayout?: (id: string) => void;
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
  viewportOpacities = [],
  onGlobalOpacityChange,
  onResetAllOpacities,
  onFocusLeft,
  onFocusRight,
  isMaximized = false,
  maximizedViewportId,
  onToggleMaximize,
  onAddViewport,
  savedLayouts = [],
  onSaveLayout,
  onLoadLayout,
  onDeleteLayout,
}) => {
  const [hoveredNub, setHoveredNub] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  
  // Calculate if we need to show multiple nubs (different opacity values)
  const uniqueOpacities = new Set(viewportOpacities.map(v => Math.round(v.opacity * 100)));
  const showMultipleNubs = uniqueOpacities.size > 1 && viewportOpacities.length > 1;
  
  // Average opacity for the main slider
  const averageOpacity = viewportOpacities.length > 0
    ? viewportOpacities.reduce((sum, v) => sum + v.opacity, 0) / viewportOpacities.length
    : 0.5;
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

      {/* Single/Maximize button - temporarily expands one viewport */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleMaximize}
              className={cn(
                "h-7 px-3 rounded-md transition-all duration-200 flex items-center gap-1.5 text-xs font-medium border",
                isMaximized
                  ? "bg-gradient-to-r from-cyan-600/30 to-blue-600/30 text-cyan-300 border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                  : "text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10 border-transparent hover:border-cyan-500/30"
              )}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Focus className="w-3.5 h-3.5" />}
              <span>Single</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50 px-3 py-2">
            <p className="font-semibold text-white">{isMaximized ? 'Restore Layout' : 'Maximize Active Viewport'}</p>
            <p className="text-gray-400 text-[11px]">{isMaximized ? 'Return to multi-viewport layout' : 'Temporarily expand the active viewport'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Separator */}
      <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

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
                    isPresetActive(preset) && !isMaximized
                      ? "bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white shadow-lg shadow-indigo-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {icon}
                  <span className={cn(
                    "transition-all duration-200",
                    isPresetActive(preset) && !isMaximized ? "opacity-100" : "opacity-70"
                  )}>{label}</span>
                  {isPresetActive(preset) && !isMaximized && (
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

      {/* Focus left/right buttons */}
      {(onFocusLeft || onFocusRight) && (
        <>
          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onFocusLeft}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Enlarge Left</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onFocusRight}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Enlarge Right</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}

      {/* Separator */}
      <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Add Viewport Button with Series Dropdown */}
      {availableSeries.length > 0 && onAddViewport && (
        <div className="relative">
          <button
            onClick={() => setShowAddDialog(!showAddDialog)}
            className={cn(
              "h-7 px-3 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-all duration-200",
              showAddDialog
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAddDialog && "rotate-180")} />
          </button>
          
          {/* Add Viewport Dialog - positioned below */}
          <AnimatePresence>
            {showAddDialog && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-72 z-50"
              >
                <div className="bg-gray-950 border border-gray-800/50 rounded-xl shadow-xl p-3">
                  <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    Add Series to New Viewport
                  </div>
                  <div className="text-[10px] text-gray-500 mb-3">
                    Select a series to add to the layout
                  </div>
                  
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {availableSeries.map((series) => {
                      const colorClass = getModalityColor(series.modality);
                      return (
                        <button
                          key={series.id}
                          onClick={() => {
                            onAddViewport(series.id);
                            setShowAddDialog(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left",
                            "bg-gray-900/50 border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600/50"
                          )}
                        >
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            colorClass === 'amber' ? "bg-amber-400" :
                            colorClass === 'purple' ? "bg-purple-400" : "bg-cyan-400"
                          )} />
                          <span className={cn(
                            "font-semibold text-xs",
                            colorClass === 'amber' ? "text-amber-400" :
                            colorClass === 'purple' ? "text-purple-400" : "text-cyan-400"
                          )}>
                            {series.modality}
                          </span>
                          <span className="text-gray-400 text-xs truncate flex-1">
                            {series.seriesDescription || `Series ${series.seriesNumber}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  
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
      )}

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

      {/* Center: Global Opacity Slider */}
      <div className="flex-1 flex justify-center">
        {viewportOpacities.length > 0 && (
          <div className="flex items-center gap-2 px-4">
            <Layers className="w-4 h-4 text-yellow-400" />
            <div className="relative w-40">
              {/* Track */}
              <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                  style={{ width: `${averageOpacity * 100}%` }}
                />
              </div>
              
              {/* Nubs for each viewport (only if different opacities) */}
              {showMultipleNubs ? (
                viewportOpacities.map((vp) => (
                  <div
                    key={vp.viewportId}
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ left: `calc(${vp.opacity * 100}% - 6px)` }}
                    onMouseEnter={() => setHoveredNub(vp.viewportId)}
                    onMouseLeave={() => setHoveredNub(null)}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 shadow-md cursor-pointer transition-transform",
                      hoveredNub === vp.viewportId ? "scale-125" : "",
                      vp.modality === 'PT' ? "bg-amber-400 border-amber-200" :
                      vp.modality === 'MR' ? "bg-purple-400 border-purple-200" :
                      "bg-cyan-400 border-cyan-200"
                    )} />
                    {/* Tooltip on hover */}
                    {hoveredNub === vp.viewportId && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-gray-900 border border-gray-700 rounded text-[9px] text-white whitespace-nowrap">
                        Viewport {vp.viewportNumber}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                /* Single thumb when all opacities are the same */
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-yellow-400 shadow-lg pointer-events-none"
                  style={{ left: `calc(${averageOpacity * 100}% - 8px)` }}
                />
              )}
              
              {/* Invisible range input for interaction */}
              <input
                type="range"
                min="0"
                max="100"
                value={averageOpacity * 100}
                onChange={(e) => onGlobalOpacityChange?.(parseInt(e.target.value) / 100)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[10px] font-semibold text-yellow-300 w-8">
              {Math.round(averageOpacity * 100)}%
            </span>
            
            {/* Reset button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onResetAllOpacities}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Reset all to 50%</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Viewport count badge */}
      <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-md border border-white/5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Viewports</span>
        <span className="text-xs font-bold text-indigo-300">{viewportCount}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Save/Load Buttons */}
      <div className="relative flex items-center gap-2">
        {/* Save button */}
        <button 
          onClick={() => {
            setShowSaveDialog(!showSaveDialog);
            setShowLoadDialog(false);
          }}
          className={cn(
            "h-7 px-3 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-all duration-200",
            showSaveDialog 
              ? "bg-amber-500/20 text-amber-300 border-amber-400/50" 
              : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40"
          )}
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
        
        {/* Save Dialog Popup */}
        <AnimatePresence>
          {showSaveDialog && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-72 z-50"
            >
              <div className="bg-gray-950 border border-gray-800/50 rounded-xl shadow-xl p-3">
                <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Save className="w-4 h-4 text-amber-400" />
                  Save Custom Layout Preset
                </div>
                <p className="text-[10px] text-gray-500 mb-3">
                  Save this layout configuration to use across any patient
                </p>
                <input
                  type="text"
                  placeholder="My Custom Layout..."
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
                <div className="text-[10px] text-gray-600 mt-2">
                  Current: {currentLayout} layout with {viewportCount} viewport{viewportCount !== 1 ? 's' : ''}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      if (layoutName.trim()) {
                        onSaveLayout?.(layoutName.trim());
                        setShowSaveDialog(false);
                        setLayoutName('');
                      }
                    }}
                    disabled={!layoutName.trim()}
                    className={cn(
                      "flex-1 h-7 rounded-lg text-xs font-medium transition-colors",
                      layoutName.trim()
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                        : "bg-gray-800/50 text-gray-500 border border-gray-700/30 cursor-not-allowed"
                    )}
                  >
                    Save Preset
                  </button>
                  <button
                    onClick={() => { setShowSaveDialog(false); setLayoutName(''); }}
                    className="h-7 px-3 rounded-lg text-gray-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load button */}
        <button 
          onClick={() => {
            setShowLoadDialog(!showLoadDialog);
            setShowSaveDialog(false);
          }}
          className={cn(
            "h-7 px-3 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-all duration-200",
            showLoadDialog 
              ? "bg-blue-500/20 text-blue-300 border-blue-400/50" 
              : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40"
          )}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Load</span>
        </button>
        
        {/* Load Dialog Popup */}
        <AnimatePresence>
          {showLoadDialog && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-80 z-50"
            >
              <div className="bg-gray-950 border border-gray-800/50 rounded-xl shadow-xl p-3">
                <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  Load Saved Layout Preset
                </div>
                
                {savedLayouts.length > 0 ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {savedLayouts.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/60 border border-gray-800/50 hover:bg-gray-800/80 hover:border-gray-700/50 transition-all group"
                      >
                        <button
                          onClick={() => {
                            onLoadLayout?.(preset);
                            setShowLoadDialog(false);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="text-xs font-medium text-white">{preset.name}</div>
                          <div className="text-[10px] text-gray-500">
                            {preset.layout} • {preset.viewportConfigs.length} viewport{preset.viewportConfigs.length !== 1 ? 's' : ''} • {new Date(preset.createdAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLayout?.(preset.id);
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete preset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Save className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <p className="text-xs text-gray-500">No saved presets yet</p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      Save your current layout to create a reusable preset
                    </p>
                  </div>
                )}
                
                <div className="flex justify-end mt-3 pt-2 border-t border-gray-800">
                  <button
                    onClick={() => setShowLoadDialog(false)}
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
  const [currentPreset, setCurrentPreset] = useState<GridLayoutPreset>('1x2');
  
  // Maximize/Focus state - temporarily show single viewport while staying in multi-viewport mode
  const [isMaximized, setIsMaximized] = useState(false);
  const [maximizedViewportId, setMaximizedViewportId] = useState<string | null>(null);
  const [preMaximizeLayout, setPreMaximizeLayout] = useState<GridLayoutPreset | null>(null);
  
  // Saved layout presets - persist to localStorage
  const [savedLayouts, setSavedLayouts] = useState<SavedLayoutPreset[]>(() => {
    try {
      const stored = localStorage.getItem('superbeam-multiviewport-presets');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
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
  
  // Save layouts to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('superbeam-multiviewport-presets', JSON.stringify(savedLayouts));
    } catch (e) {
      console.warn('Failed to save layout presets to localStorage:', e);
    }
  }, [savedLayouts]);

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

  // Handle toggle maximize - temporarily expand active viewport while staying in multi-viewport mode
  const handleToggleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore previous layout
      if (preMaximizeLayout) {
        setLayout(preMaximizeLayout, {
          studyId,
          preserveContent: true,
        });
        setCurrentPreset(preMaximizeLayout);
      }
      setIsMaximized(false);
      setMaximizedViewportId(null);
      setPreMaximizeLayout(null);
    } else {
      // Save current layout and switch to 1x1 temporarily
      setPreMaximizeLayout(currentPreset);
      setMaximizedViewportId(activeViewportId);
      
      // Get the active viewport's series
      const activeVp = viewportsArray.find(vp => vp.id === activeViewportId);
      if (activeVp?.seriesId) {
        setLayout('1x1', {
          seriesId: activeVp.seriesId,
          studyId,
          secondarySeriesIds: activeVp.secondarySeriesIds,
          preserveContent: false,
        });
      } else {
        setLayout('1x1', { studyId, preserveContent: true });
      }
      setIsMaximized(true);
    }
  }, [isMaximized, preMaximizeLayout, currentPreset, activeViewportId, viewportsArray, studyId, setLayout]);

  // Handle add viewport with a specific series
  const handleAddViewport = useCallback((seriesId: number) => {
    // Determine which layout to use based on current viewport count
    const numViewports = viewportsArray.length;
    let newLayout: GridLayoutPreset = currentPreset;
    
    if (numViewports === 1) {
      newLayout = '1x2';
    } else if (numViewports === 2) {
      newLayout = '2x2';
    } else if (numViewports <= 4) {
      newLayout = '2x2';
    } else {
      newLayout = '3x3';
    }
    
    // If we need to expand the layout
    if (newLayout !== currentPreset) {
      setLayout(newLayout, {
        studyId,
        preserveContent: true,
      });
      setCurrentPreset(newLayout);
    }
    
    // Find an empty viewport to assign the series to
    setTimeout(() => {
      const state = viewportGridService.getState();
      const viewportIds = Array.from(state.viewports.keys());
      
      // Find a viewport without a series
      const emptyViewportId = viewportIds.find(id => {
        const vp = state.viewports.get(id);
        return !vp?.seriesId;
      });
      
      if (emptyViewportId) {
        assignSeries(emptyViewportId, seriesId, studyId);
      }
    }, 100);
  }, [viewportsArray.length, currentPreset, studyId, setLayout, assignSeries]);

  // Handle save layout preset
  const handleSaveLayout = useCallback((name: string) => {
    const newPreset: SavedLayoutPreset = {
      id: `preset-${Date.now()}`,
      name,
      layout: currentPreset,
      viewportConfigs: viewportsArray.map(vp => ({
        seriesId: vp.seriesId ?? undefined,
        secondarySeriesIds: vp.secondarySeriesIds,
        modality: availableSeries.find(s => s.id === vp.seriesId)?.modality,
      })),
      createdAt: new Date().toISOString(),
    };
    
    setSavedLayouts(prev => [...prev, newPreset]);
    console.log('📁 Saved layout preset:', newPreset);
  }, [currentPreset, viewportsArray, availableSeries]);

  // Handle load layout preset
  const handleLoadLayout = useCallback((preset: SavedLayoutPreset) => {
    setLayout(preset.layout, {
      studyId,
      preserveContent: false,
    });
    setCurrentPreset(preset.layout);
    
    // Attempt to restore series assignments if they exist in the current study
    setTimeout(() => {
      const state = viewportGridService.getState();
      const viewportIds = Array.from(state.viewports.keys());
      
      preset.viewportConfigs.forEach((config, index) => {
        if (viewportIds[index] && config.modality) {
          // Find a series with matching modality
          const matchingSeries = availableSeries.find(s => s.modality === config.modality);
          if (matchingSeries) {
            assignSeries(viewportIds[index], matchingSeries.id, studyId);
            
            // If there were secondary series, try to restore fusion
            if (config.secondarySeriesIds?.length) {
              const secondaryModalities = config.secondarySeriesIds.map(id => 
                availableSeries.find(s => s.id === id)?.modality
              ).filter(Boolean);
              
              // Find matching secondary series by modality
              secondaryModalities.forEach(mod => {
                const matchingSecondary = availableSeries.find(s => 
                  s.modality === mod && s.id !== matchingSeries.id
                );
                if (matchingSecondary) {
                  viewportGridService.updateViewport(viewportIds[index], {
                    secondarySeriesIds: [matchingSecondary.id],
                    type: 'FUSION',
                  });
                }
              });
            }
          }
        }
      });
    }, 100);
    
    console.log('📂 Loaded layout preset:', preset);
  }, [studyId, setLayout, availableSeries, assignSeries]);

  // Handle delete layout preset
  const handleDeleteLayout = useCallback((id: string) => {
    setSavedLayouts(prev => prev.filter(p => p.id !== id));
    console.log('🗑️ Deleted layout preset:', id);
  }, []);

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
          // Maximize/Focus controls
          isMaximized={isMaximized}
          maximizedViewportId={maximizedViewportId}
          onToggleMaximize={handleToggleMaximize}
          // Add viewport
          onAddViewport={handleAddViewport}
          // Save/Load with persistence
          savedLayouts={savedLayouts}
          onSaveLayout={handleSaveLayout}
          onLoadLayout={handleLoadLayout}
          onDeleteLayout={handleDeleteLayout}
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

