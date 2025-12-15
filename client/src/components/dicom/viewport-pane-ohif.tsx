/**
 * ViewportPaneOHIF - OHIF-style viewport pane with action corners and overlays
 * 
 * This is a comprehensive viewport component that integrates:
 * - ViewportActionCorners for positioned UI elements
 * - ViewportActionBar for topbar controls (shown on hover)
 * - ViewportOverlay for metadata display at corners
 * - ViewportOrientationMarkers for anatomical directions
 * - Hover state tracking for interactive UI
 * 
 * Designed to be used in multi-viewport layouts like FlexibleFusionLayout.
 */

import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { pillClass } from '@/lib/pills';
import { useViewportHoverRef } from '@/hooks/use-viewport-hover';
import { ViewportActionCorners } from './viewport-action-corners';
import { ViewportActionBar, WINDOW_LEVEL_PRESETS } from './viewport-action-bar';
import { 
  ViewportOverlay, 
  WindowLevelOverlay, 
  ZoomOverlay, 
  SliceOverlay,
  PatientInfoOverlay,
  OrientationLabel 
} from './viewport-overlay';
import { 
  ViewportOrientationMarkers, 
  OrientationBadge,
  type ViewOrientation 
} from './viewport-orientation-markers';
import { WorkingViewer } from './working-viewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  X, Eye, EyeOff, Box, ChevronDown, Check, 
  RefreshCw, AlertCircle, Maximize2, Layers, Plus, SunMedium
} from 'lucide-react';

// Window/Level presets per modality
const MODALITY_WINDOW_PRESETS: Record<string, Array<{ label: string; window: number; level: number }>> = {
  CT: [
    { label: 'Soft Tissue', window: 400, level: 40 },
    { label: 'Lung', window: 1500, level: -600 },
    { label: 'Bone', window: 1800, level: 400 },
    { label: 'Brain', window: 80, level: 40 },
    { label: 'Liver', window: 150, level: 30 },
  ],
  MR: [
    { label: 'T1', window: 600, level: 300 },
    { label: 'T2', window: 2000, level: 1000 },
    { label: 'FLAIR', window: 1800, level: 900 },
    { label: 'Spine', window: 1200, level: 600 },
  ],
  MRI: [
    { label: 'T1', window: 600, level: 300 },
    { label: 'T2', window: 2000, level: 1000 },
    { label: 'FLAIR', window: 1800, level: 900 },
    { label: 'Spine', window: 1200, level: 600 },
  ],
  PT: [
    { label: 'Standard', window: 20000, level: 10000 },
    { label: 'High Uptake', window: 30000, level: 15000 },
  ],
  PET: [
    { label: 'Standard', window: 20000, level: 10000 },
    { label: 'High Uptake', window: 30000, level: 15000 },
  ],
};
import { Slider } from '@/components/ui/slider';
import type { DICOMSeries } from '@/lib/dicom-utils';

interface ViewportConfig {
  id: string;
  secondarySeriesId: number | null;
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

interface ViewportPaneOHIFProps {
  config: ViewportConfig;
  isPrimary: boolean;
  isActive?: boolean;
  viewportNumber?: number;  // 1-indexed viewport number for display
  primarySeriesId: number;
  studyId: number;
  availableSeries: DICOMSeries[];
  secondarySeriesIds: number[];
  syncState: SyncState;
  onSyncUpdate: (updates: Partial<SyncState>) => void;
  onToggleStructures: () => void;
  onToggleMPR: () => void;
  onRemove?: () => void;
  canRemove: boolean;
  onChangeSecondary: (secondaryId: number | null) => void;
  onLoadFusion?: (secondaryId: number) => void;  // Load fusion overlay on this viewport
  onLoadError: (error: string | null) => void;
  onRetry: () => void;
  onActivate?: () => void;
  // Pass-through props for WorkingViewer
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
  onBrushToolChange?: (state: any) => void;
  windowLevel?: { window: number; level: number };
  onWindowLevelChange?: (wl: { window: number; level: number }) => void;
  imageCache?: any;
  registrationAssociations?: any;
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  style?: React.CSSProperties;
  // Image loading optimization
  initialImages?: any[];
  pixelDataCache?: React.MutableRefObject<Map<string, any>>;
  // Orientation (for MPR)
  orientation?: ViewOrientation;
  // Metadata for overlays
  imageMetadata?: {
    patientName?: string;
    patientId?: string;
    studyDate?: string;
    seriesDescription?: string;
    instanceNumber?: number;
    sliceLocation?: number;
    sliceThickness?: number;
    totalSlices?: number;
  };
}

export function ViewportPaneOHIF({
  config,
  isPrimary,
  isActive = false,
  viewportNumber,
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
  onLoadFusion,
  onLoadError,
  onRetry,
  onActivate,
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
  onBrushToolChange,
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
  orientation = 'axial',
  imageMetadata,
}: ViewportPaneOHIFProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [retryKey, setRetryKey] = useState(0);
  
  // Track internal state for overlays
  const [internalZoom, setInternalZoom] = useState(syncState.zoom);
  const [internalSliceIndex, setInternalSliceIndex] = useState(syncState.currentIndex);
  const [totalSlices, setTotalSlices] = useState(initialImages?.length || 0);
  
  // State for image metadata received from WorkingViewer
  const [internalMetadata, setInternalMetadata] = useState<{
    instanceNumber?: number;
    sliceLocation?: number;
    sliceThickness?: number;
    patientName?: string;
    patientId?: string;
    studyDate?: string;
    seriesDescription?: string;
    modality?: string;
  } | null>(null);
  
  // Hover state tracking
  const { isHovered, shouldShowControls } = useViewportHoverRef(paneRef, isActive);
  
  // Get series info for display
  const secondarySeries = config.secondarySeriesId 
    ? availableSeries.find(s => s.id === config.secondarySeriesId) 
    : null;
    
  const primarySeries = availableSeries.find(s => s.id === primarySeriesId);

  // Update internal state when sync state changes
  useEffect(() => {
    setInternalZoom(syncState.zoom);
    setInternalSliceIndex(syncState.currentIndex);
  }, [syncState.zoom, syncState.currentIndex]);

  // Handlers
  const handleSliceChange = useCallback((newIndex: number) => {
    setInternalSliceIndex(newIndex);
    onSyncUpdate({ currentIndex: newIndex });
  }, [onSyncUpdate]);
  
  const handleZoomChange = useCallback((zoom: number) => {
    setInternalZoom(zoom);
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

  const handleImageCountChange = useCallback((count: number) => {
    setTotalSlices(count);
  }, []);

  // Handle metadata updates from WorkingViewer
  const handleImageMetadataChange = useCallback((metadata: any) => {
    if (metadata) {
      setInternalMetadata({
        instanceNumber: metadata.instanceNumber,
        sliceLocation: metadata.sliceLocation ? parseFloat(metadata.sliceLocation) : undefined,
        sliceThickness: metadata.sliceThickness ? parseFloat(metadata.sliceThickness) : undefined,
        patientName: metadata.patientName,
        patientId: metadata.patientId,
        studyDate: metadata.studyDate,
        seriesDescription: metadata.seriesDescription,
        modality: metadata.modality,
      });
      // Also update total slices if available
      if (metadata.numberOfFrames) {
        setTotalSlices(parseInt(metadata.numberOfFrames, 10));
      }
    }
  }, []);

  // Border color based on state - colored borders for multi-viewer
  const borderColor = isPrimary 
    ? isActive 
      ? "ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)]" 
      : "ring-1 ring-cyan-600/50"
    : isActive 
      ? "ring-2 ring-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.2)]" 
      : "ring-1 ring-purple-600/50";

  return (
    <motion.div
      ref={paneRef}
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "viewport-pane relative flex flex-col rounded-lg overflow-hidden transition-all duration-200",
        borderColor,
        "bg-black",
        config.loadError && "ring-red-500/50"
      )}
      style={style}
      data-viewport-id={config.id}
      onClick={onActivate}
    >
      <ViewportActionCorners.Container>
        {/* Main viewport content */}
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
              secondarySeriesId={isPrimary ? null : config.secondarySeriesId}
              fusionOpacity={fusionOpacity}
              fusionDisplayMode="overlay"
              fusionLayoutPreset="overlay"
              rtStructures={config.showStructures ? rtStructures : undefined}
              structureVisibility={config.showStructures ? structureVisibility : new Map()}
              allStructuresVisible={config.showStructures && allStructuresVisible}
              selectedForEdit={selectedForEdit}
              selectedStructures={selectedStructures}
              onContourUpdate={onContourUpdate}
              onRTStructureUpdate={onRTStructureUpdate}
              contourSettings={contourSettings}
              brushToolState={brushToolState}
              onBrushSizeChange={onBrushSizeChange}
              onBrushToolChange={onBrushToolChange}
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
              orientation={orientation}
              hideToolbar
              hideSidebar
              compactMode
              isMPRVisible={config.showMPR}
              initialImages={initialImages}
              pixelDataCache={pixelDataCache}
              onImageMetadataChange={handleImageMetadataChange}
              viewportId={config.id}
            />
          )}
          
          {/* Orientation markers */}
          <ViewportOrientationMarkers
            orientation={orientation}
            showMarkers={['top', 'left']}
          />
          
        </div>

        {/* ===== ALWAYS VISIBLE: Modality badge at top-left ===== */}
        <div className="absolute top-2 left-2 z-30 pointer-events-auto flex items-center gap-1.5">
          {isPrimary ? (
            <Badge className="bg-cyan-600/80 text-white border border-cyan-400/60 backdrop-blur-sm shadow-lg shadow-cyan-500/20 rounded-full px-2.5 font-semibold">
              {primarySeries?.modality || 'CT'}
            </Badge>
          ) : (
            <Badge className={cn(
              "border backdrop-blur-sm shadow-lg flex items-center gap-1.5 rounded-full px-2.5 font-semibold",
              secondarySeries?.modality === 'PT' || secondarySeries?.modality === 'PET'
                ? "bg-amber-600/80 text-white border-amber-400/60 shadow-amber-500/20"
                : secondarySeries?.modality === 'MR' || secondarySeries?.modality === 'MRI'
                ? "bg-purple-600/80 text-white border-purple-400/60 shadow-purple-500/20"
                : "bg-blue-600/80 text-white border-blue-400/60 shadow-blue-500/20"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                fusionSecondaryStatuses?.get(config.secondarySeriesId!)?.status === 'ready'
                  ? "bg-emerald-400"
                  : fusionSecondaryStatuses?.get(config.secondarySeriesId!)?.status === 'loading'
                  ? "bg-amber-400 animate-pulse"
                  : "bg-gray-400"
              )} />
              {secondarySeries?.modality || 'SEC'}
            </Badge>
          )}

          {typeof viewportNumber === 'number' && Number.isFinite(viewportNumber) && (
            <span className={pillClass('gray')}>
              VP {viewportNumber}
            </span>
          )}
        </div>

        {/* ===== VIEWPORT TOP BAR - Floating with hover effect ===== */}
        <AnimatePresence>
          {shouldShowControls && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-2 left-2 right-2 z-40 pointer-events-auto"
            >
              <div className="backdrop-blur-xl border rounded-xl px-3 py-2 shadow-xl flex items-center justify-between"
                style={{ backgroundColor: '#1e2533f0', borderColor: '#4a5568a0' }}
              >
                {/* Left: Windowing dropdown + Series info */}
                <div className="flex items-center gap-2">
                  {/* Window/Level dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-600/70 text-white border border-orange-400/50 backdrop-blur-sm hover:bg-orange-600/90 transition-colors cursor-pointer shadow-sm shadow-orange-500/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SunMedium className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">W/L</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="start" 
                      className="min-w-[140px] bg-gray-900/95 border-gray-700 backdrop-blur-md"
                    >
                      <div className="px-2 py-1.5 text-[10px] text-gray-400 uppercase tracking-wide border-b border-gray-700/50">
                        {isPrimary ? (primarySeries?.modality || 'CT') : (secondarySeries?.modality || 'SEC')} Presets
                      </div>
                      {(MODALITY_WINDOW_PRESETS[(isPrimary ? primarySeries?.modality : secondarySeries?.modality)?.toUpperCase() || 'CT'] || MODALITY_WINDOW_PRESETS.CT).map((preset) => (
                        <DropdownMenuItem
                          key={preset.label}
                          onClick={() => onWindowLevelChange?.({ window: preset.window, level: preset.level })}
                          className="text-xs cursor-pointer flex items-center justify-between py-2"
                        >
                          <span>{preset.label}</span>
                          <span className="text-[9px] text-gray-500">W:{preset.window} L:{preset.level}</span>
                        </DropdownMenuItem>
                      ))}
                      {syncState.windowLevel && (
                        <>
                          <div className="border-t border-gray-700/50 my-1" />
                          <div className="px-2 py-1 text-[9px] text-gray-500">
                            Current: W:{Math.round(syncState.windowLevel.window)} L:{Math.round(syncState.windowLevel.level)}
                          </div>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {isPrimary ? (
                    /* Primary viewport: Static badge */
                    <Badge className="bg-cyan-600/80 text-white border border-cyan-400/60 backdrop-blur-sm rounded-full px-2.5 font-semibold shadow-sm shadow-cyan-500/20">
                      {primarySeries?.modality || 'CT'} {orientation !== 'axial' && `- ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}`}
                    </Badge>
                  ) : (
                    /* Secondary viewport: Clickable dropdown with series info */
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1 rounded-full border backdrop-blur-sm transition-colors cursor-pointer font-semibold shadow-sm",
                            secondarySeries?.modality === 'PT' || secondarySeries?.modality === 'PET'
                              ? "bg-amber-600/80 text-white border-amber-400/60 hover:bg-amber-600/90 shadow-amber-500/20"
                              : secondarySeries?.modality === 'MR' || secondarySeries?.modality === 'MRI'
                              ? "bg-purple-600/80 text-white border-purple-400/60 hover:bg-purple-600/90 shadow-purple-500/20"
                              : "bg-blue-600/80 text-white border-blue-400/60 hover:bg-blue-600/90 shadow-blue-500/20"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            fusionSecondaryStatuses?.get(config.secondarySeriesId!)?.status === 'ready'
                              ? "bg-emerald-400"
                              : fusionSecondaryStatuses?.get(config.secondarySeriesId!)?.status === 'loading'
                              ? "bg-amber-400 animate-pulse"
                              : "bg-gray-400"
                          )} />
                          <span className="text-xs font-medium">
                            {secondarySeries?.modality || 'SEC'} Fusion
                          </span>
                          {secondarySeries?.seriesDescription && (
                            <span className="text-[10px] opacity-70 max-w-[100px] truncate">
                              {secondarySeries.seriesDescription}
                            </span>
                          )}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="start" 
                        className="min-w-[200px] bg-gray-900/95 border-gray-700 backdrop-blur-md"
                      >
                        <div className="px-2 py-1.5 text-[10px] text-gray-400 uppercase tracking-wide border-b border-gray-700/50">
                          Switch Fusion Series
                        </div>
                        {secondarySeriesIds.map(secId => {
                          const series = availableSeries.find(s => s.id === secId);
                          const isSelected = config.secondarySeriesId === secId;
                          const status = fusionSecondaryStatuses?.get(secId);
                          const isReady = status?.status === 'ready';
                          
                          return (
                            <DropdownMenuItem
                              key={secId}
                              onClick={() => onChangeSecondary(secId)}
                              className={cn(
                                "text-xs cursor-pointer flex items-center gap-2 py-2",
                                isSelected && "bg-purple-600/30"
                              )}
                            >
                              <span className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0",
                                isReady ? "bg-emerald-400" : status?.status === 'loading' ? "bg-amber-400 animate-pulse" : "bg-gray-500"
                              )} />
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-medium">{series?.modality || 'SEC'}</span>
                                {series?.seriesDescription && (
                                  <span className="text-[10px] text-gray-400 truncate">{series.seriesDescription}</span>
                                )}
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  
                  {/* Slice info */}
                  <Badge variant="outline" className="border-gray-500/50 text-gray-300 bg-gray-800/40 backdrop-blur-sm text-[10px]">
                    {internalSliceIndex + 1} / {totalSlices || initialImages?.length || '?'}
                  </Badge>
                </div>
                
                {/* Center: Opacity control (for fusion viewports) - pill style */}
                {!isPrimary && config.secondarySeriesId && (
                  <div className="flex items-center gap-1">
                    <Badge className={cn(
                      "flex items-center gap-2 border backdrop-blur-sm cursor-pointer select-none",
                      secondarySeries?.modality === 'PT' || secondarySeries?.modality === 'PET'
                        ? "bg-yellow-900/40 text-yellow-200 border-yellow-600/30"
                        : "bg-purple-900/40 text-purple-200 border-purple-600/30"
                    )}>
                      <span className="text-[10px] font-medium opacity-70">Opacity</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={fusionOpacity}
                        onChange={(e) => { e.stopPropagation(); onFusionOpacityChange?.(parseFloat(e.target.value)); }}
                        className={cn(
                          "w-16 h-1 rounded-full appearance-none cursor-pointer",
                          secondarySeries?.modality === 'PT' || secondarySeries?.modality === 'PET'
                            ? "accent-yellow-400"
                            : "accent-purple-400"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={cn(
                        "text-[10px] font-medium tabular-nums min-w-[28px]",
                        secondarySeries?.modality === 'PT' || secondarySeries?.modality === 'PET'
                          ? "text-yellow-300"
                          : "text-purple-300"
                      )}>
                        {Math.round(fusionOpacity * 100)}%
                      </span>
                    </Badge>
                  </div>
                )}
                
                {/* Right: Action buttons */}
                <div className="flex items-center gap-1">
                  {/* MPR Toggle */}
                  <button
                    className={cn(
                      "h-6 w-6 flex items-center justify-center rounded-lg border transition-all",
                      config.showMPR 
                        ? "bg-cyan-900/60 text-cyan-200 border-cyan-600/30" 
                        : "text-gray-400 border-transparent hover:text-white hover:bg-white/10"
                    )}
                    onClick={(e) => { e.stopPropagation(); onToggleMPR(); }}
                    title={config.showMPR ? "Hide MPR" : "Show MPR"}
                  >
                    <Box className="w-3.5 h-3.5" />
                  </button>
                  
                  {/* Structure Visibility */}
                  <button
                    className={cn(
                      "h-6 w-6 flex items-center justify-center rounded-lg border transition-all",
                      config.showStructures 
                        ? "bg-green-900/60 text-green-200 border-green-600/30" 
                        : "text-gray-400 border-transparent hover:text-white hover:bg-white/10"
                    )}
                    onClick={(e) => { e.stopPropagation(); onToggleStructures(); }}
                    title={config.showStructures ? "Hide Structures" : "Show Structures"}
                  >
                    {config.showStructures ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  
                  {/* Remove button */}
                  {canRemove && onRemove && (
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 border border-transparent transition-all"
                      onClick={(e) => { e.stopPropagation(); onRemove(); }}
                      title="Remove Viewport"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom-Left: Window/Level and Zoom info */}
        <ViewportActionCorners.BottomLeft>
          <div className="flex flex-col gap-0.5 text-[10px] font-mono text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            <WindowLevelOverlay 
              windowWidth={syncState.windowLevel.window} 
              windowCenter={syncState.windowLevel.level} 
            />
            <ZoomOverlay scale={internalZoom} />
          </div>
        </ViewportActionCorners.BottomLeft>

        {/* Bottom-Right: Slice info */}
        <ViewportActionCorners.BottomRight>
          <SliceOverlay
            currentSlice={internalSliceIndex}
            totalSlices={totalSlices || initialImages?.length || 0}
            instanceNumber={internalMetadata?.instanceNumber}
            sliceLocation={internalMetadata?.sliceLocation}
            sliceThickness={internalMetadata?.sliceThickness}
            className="text-[10px] font-mono text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          />
        </ViewportActionCorners.BottomRight>

      </ViewportActionCorners.Container>
    </motion.div>
  );
}

export default ViewportPaneOHIF;

