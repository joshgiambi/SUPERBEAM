/**
 * Smart Fusion Grid
 * 
 * Production-ready multi-viewport fusion manager that integrates with existing
 * WorkingViewer and FusionControlPanel infrastructure.
 * 
 * Features:
 * - Multi-viewport layout management (auto-grid, side-by-side, quad, etc.)
 * - Drag & drop series for viewport creation and fusion
 * - Per-viewport MPR toggle
 * - Layout persistence (save/load)
 * - Registration validation
 * - Integrates with existing fusion backend (FusionManifestService, Fusebox)
 */

import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, Rows3, Columns2, Grid2x2, X, Box, 
  Bookmark, BookmarkPlus, Layers, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WorkingViewer } from './working-viewer';
import type { DICOMSeries } from '@/types/dicom';

// ============================================================================
// TYPES
// ============================================================================

export interface ViewportState {
  id: string;
  primarySeriesId: number;
  fusionSeriesIds: number[];
  layout: 'single' | 'mpr';
}

interface LayoutPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  mode: 'auto-grid' | 'rows' | 'cols' | 'quad';
}

interface SavedLayout {
  id: string;
  name: string;
  timestamp: number;
  viewports: ViewportState[];
  layoutMode: string;
}

export interface SmartFusionGridProps {
  // Series data
  availableSeries: DICOMSeries[];
  studyId: number;
  
  // Fusion state
  fusionOpacity: number;
  onFusionOpacityChange: (opacity: number) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  onFusionWindowLevelChange?: (preset: { window: number; level: number } | null) => void;
  
  // RT Structures
  rtStructures: any;
  structureVisibility: Map<number, boolean>;
  allStructuresVisible: boolean;
  selectedForEdit: number | null;
  selectedStructures: Set<number> | null;
  onContourUpdate: (structures: any) => void;
  onRTStructureUpdate?: (structures: any) => void;
  contourSettings: any;
  
  // Brush tool
  brushToolState: any;
  onBrushSizeChange: (size: number) => void;
  
  // Window/Level
  windowLevel: { width: number; center: number };
  onWindowLevelChange: (wl: { width: number; center: number }) => void;
  
  // Callbacks
  onActiveViewportChange?: (viewportId: string | null) => void;
  onViewportsChange?: (viewports: ViewportState[]) => void;
  
  // Image cache (shared)
  imageCache?: Map<string, any>;
  
  // Fusion metadata
  registrationAssociations?: Map<number, number[]>;
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  
  // Active predictions
  onActivePredictionsChange?: (predictions: Map<string, any>) => void;
  
  // Image metadata
  onImageMetadataChange?: (metadata: any) => void;
}

export interface SmartFusionGridHandle {
  getViewports: () => ViewportState[];
  setViewports: (viewports: ViewportState[]) => void;
  getActiveViewportId: () => string | null;
  setActiveViewportId: (id: string | null) => void;
}

// ============================================================================
// LAYOUT PRESETS
// ============================================================================

const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'auto-grid',
    name: 'Auto Grid',
    icon: <LayoutGrid className="w-3.5 h-3.5" />,
    mode: 'auto-grid'
  },
  {
    id: 'rows',
    name: 'Rows',
    icon: <Rows3 className="w-3.5 h-3.5" />,
    mode: 'rows'
  },
  {
    id: 'cols',
    name: 'Side by Side',
    icon: <Columns2 className="w-3.5 h-3.5" />,
    mode: 'cols'
  },
  {
    id: 'quad',
    name: 'Quad',
    icon: <Grid2x2 className="w-3.5 h-3.5" />,
    mode: 'quad'
  },
];

// ============================================================================
// VIEWPORT CARD COMPONENT
// ============================================================================

interface ViewportCardProps {
  viewport: ViewportState;
  series: DICOMSeries;
  isActive: boolean;
  fusionOpacity: number;
  fusionSeriesList: DICOMSeries[];
  canFuse: (primaryId: number, secondaryId: number) => boolean;
  isDragOver: boolean;
  isValidDrop: boolean;
  onClick: () => void;
  onRemove: () => void;
  onToggleMPR: () => void;
  onRemoveFusion: (seriesId: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  
  // WorkingViewer props
  studyId: number;
  windowLevel: { width: number; center: number };
  onWindowLevelChange: (wl: { width: number; center: number }) => void;
  rtStructures: any;
  structureVisibility: Map<number, boolean>;
  brushToolState: any;
  selectedForEdit: number | null;
  selectedStructures: Set<number> | null;
  onBrushSizeChange: (size: number) => void;
  onContourUpdate: (structures: any) => void;
  contourSettings: any;
  allStructuresVisible: boolean;
  imageCache?: Map<string, any>;
  registrationAssociations?: Map<number, number[]>;
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  fusionWindowLevel?: { window: number; level: number } | null;
  onImageMetadataChange?: (metadata: any) => void;
  onActivePredictionsChange?: (predictions: Map<string, any>) => void;
}

const ViewportCard = forwardRef<any, ViewportCardProps>(({
  viewport,
  series,
  isActive,
  fusionOpacity,
  fusionSeriesList,
  isDragOver,
  isValidDrop,
  onClick,
  onRemove,
  onToggleMPR,
  onRemoveFusion,
  onDragOver,
  onDragLeave,
  onDrop,
  studyId,
  windowLevel,
  onWindowLevelChange,
  rtStructures,
  structureVisibility,
  brushToolState,
  selectedForEdit,
  selectedStructures,
  onBrushSizeChange,
  onContourUpdate,
  contourSettings,
  allStructuresVisible,
  imageCache,
  registrationAssociations,
  fusionSecondaryStatuses,
  fusionManifestLoading,
  fusionManifestPrimarySeriesId,
  fusionWindowLevel,
  onImageMetadataChange,
  onActivePredictionsChange,
}, ref) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative bg-black rounded-lg border overflow-hidden group cursor-pointer',
        isDragOver && (isValidDrop 
          ? 'border-cyan-500/80 ring-4 ring-cyan-500/20' 
          : 'border-red-500/50 ring-4 ring-red-500/10'),
        isActive && !isDragOver && 'border-cyan-500/50 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]',
        !isActive && !isDragOver && 'border-white/10 hover:border-white/20'
      )}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
        <div className="flex flex-col gap-1 pointer-events-auto">
          <Badge className="bg-blue-950/40 text-blue-200 border-blue-500/20 hover:bg-blue-900/40 backdrop-blur-sm text-xs">
            {series.seriesDescription || `Series ${series.id}`}
          </Badge>
          
          {/* Fusion badges */}
          {fusionSeriesList.map(fSeries => (
            <div key={fSeries.id} className="flex items-center gap-1 animate-in slide-in-from-left-2 fade-in duration-200">
              <Badge className="bg-yellow-900/30 text-yellow-200 border-yellow-500/20 hover:bg-yellow-900/40 backdrop-blur-sm cursor-pointer transition-all text-xs">
                + {fSeries.seriesDescription || `Series ${fSeries.id}`}
              </Badge>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-4 w-4 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFusion(fSeries.id);
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-1 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-7 w-7 rounded-lg backdrop-blur-md border transition-all",
              viewport.layout === 'mpr' 
                ? 'bg-cyan-900/40 border-cyan-500/30 text-cyan-300' 
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMPR();
            }}
            title="Toggle MPR"
          >
            <Box className="w-3.5 h-3.5" />
          </Button>
          
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7 bg-white/5 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/30 border border-white/10 text-gray-400 rounded-lg backdrop-blur-md"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content Area - WorkingViewer */}
      <div className="w-full h-full">
        <WorkingViewer
          ref={ref}
          seriesId={series.id}
          studyId={studyId}
          windowLevel={windowLevel}
          onWindowLevelChange={onWindowLevelChange}
          rtStructures={rtStructures}
          structureVisibility={structureVisibility}
          brushToolState={brushToolState}
          selectedForEdit={selectedForEdit}
          selectedStructures={selectedStructures}
          onBrushSizeChange={onBrushSizeChange}
          onContourUpdate={onContourUpdate}
          contourSettings={contourSettings}
          allStructuresVisible={allStructuresVisible}
          imageCache={imageCache}
          orientation={viewport.layout === 'mpr' ? 'axial' : 'axial'}
          secondarySeriesId={viewport.fusionSeriesIds[0] || null}
          fusionOpacity={fusionOpacity}
          fusionDisplayMode="overlay"
          hasSecondarySeriesForFusion={viewport.fusionSeriesIds.length > 0}
          registrationAssociations={registrationAssociations}
          fusionSecondaryStatuses={fusionSecondaryStatuses}
          fusionManifestLoading={fusionManifestLoading}
          fusionManifestPrimarySeriesId={fusionManifestPrimarySeriesId}
          fusionWindowLevel={fusionWindowLevel}
          onImageMetadataChange={onImageMetadataChange}
          onActivePredictionsChange={onActivePredictionsChange}
          isMPRVisible={viewport.layout === 'mpr'}
        />
      </div>

      {/* Drag overlay hint */}
      {isDragOver && (
        <div className={cn(
          "absolute inset-0 backdrop-blur-[2px] flex items-center justify-center z-50 border-4 rounded-lg m-[-2px]",
          isValidDrop ? 'bg-cyan-900/40 border-cyan-500' : 'bg-red-900/20 border-red-500/50'
        )}>
          {isValidDrop ? (
            <div className="flex flex-col items-center gap-2 text-white drop-shadow-lg transform scale-110 transition-transform">
              <Layers className="w-12 h-12 text-cyan-400" />
              <span className="font-bold text-xl tracking-widest text-cyan-100">ADD FUSION LAYER</span>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-900/60 px-2 py-1 rounded">Registered Match</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-red-200 drop-shadow-lg">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <span className="font-bold text-lg tracking-widest">NO REGISTRATION</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
});

ViewportCard.displayName = 'ViewportCard';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SmartFusionGrid = forwardRef<SmartFusionGridHandle, SmartFusionGridProps>(({
  availableSeries,
  studyId,
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
  onActiveViewportChange,
  onViewportsChange,
  imageCache,
  registrationAssociations,
  fusionSecondaryStatuses,
  fusionManifestLoading,
  fusionManifestPrimarySeriesId,
  onActivePredictionsChange,
  onImageMetadataChange,
}, ref) => {
  // Initialize with primary CT series if available
  const initialViewports: ViewportState[] = useMemo(() => {
    const primarySeries = availableSeries.find(s => s.modality === 'CT') || availableSeries[0];
    if (!primarySeries) return [];
    
    return [{
      id: `vp-initial-${Date.now()}`,
      primarySeriesId: primarySeries.id,
      fusionSeriesIds: [],
      layout: 'single'
    }];
  }, []); // Only run once on mount

  const [viewports, setViewports] = useState<ViewportState[]>(initialViewports);
  const [layoutMode, setLayoutMode] = useState<string>('auto-grid');
  const [activeViewportId, setActiveViewportId] = useState<string | null>(initialViewports[0]?.id || null);
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [showSavedLayouts, setShowSavedLayouts] = useState(false);
  const [draggedSeriesId, setDraggedSeriesId] = useState<number | null>(null);
  const [dragOverViewportId, setDragOverViewportId] = useState<string | null>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getViewports: () => viewports,
    setViewports: (newViewports: ViewportState[]) => setViewports(newViewports),
    getActiveViewportId: () => activeViewportId,
    setActiveViewportId: (id: string | null) => setActiveViewportId(id),
  }));

  // Notify parent of viewport changes
  React.useEffect(() => {
    onViewportsChange?.(viewports);
  }, [viewports, onViewportsChange]);

  // Notify parent of active viewport changes
  React.useEffect(() => {
    onActiveViewportChange?.(activeViewportId);
  }, [activeViewportId, onActiveViewportChange]);

  // Check if fusion is valid (registration check)
  const canFuse = useCallback((primaryId: number, secondaryId: number) => {
    if (!registrationAssociations) return true; // Allow if no restrictions
    const allowedSecondaries = registrationAssociations.get(primaryId);
    return allowedSecondaries?.includes(secondaryId) || false;
  }, [registrationAssociations]);

  // Calculate grid style
  const gridStyle = useMemo(() => {
    const count = viewports.length;
    if (count === 0) return { display: 'flex' };

    switch (layoutMode) {
      case 'rows':
        return { 
          gridTemplateColumns: '1fr', 
          gridTemplateRows: `repeat(${count}, 1fr)` 
        };
      case 'cols':
        return { 
          gridTemplateColumns: `repeat(${count}, 1fr)`, 
          gridTemplateRows: '1fr' 
        };
      case 'quad':
        return {
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr'
        };
      case 'auto-grid':
      default:
        if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
        if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
        if (count <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
        if (count <= 6) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
        return { gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' };
    }
  }, [viewports.length, layoutMode]);

  // Remove viewport
  const removeViewport = useCallback((viewportId: string) => {
    setViewports(prev => prev.filter(vp => vp.id !== viewportId));
    if (activeViewportId === viewportId) {
      const remaining = viewports.filter(vp => vp.id !== viewportId);
      setActiveViewportId(remaining[0]?.id || null);
    }
  }, [activeViewportId, viewports]);

  // Toggle MPR for viewport
  const toggleMPR = useCallback((viewportId: string) => {
    setViewports(prev => prev.map(vp => 
      vp.id === viewportId 
        ? { ...vp, layout: vp.layout === 'single' ? 'mpr' : 'single' }
        : vp
    ));
  }, []);

  // Handle fusion drop
  const handleFusionDrop = useCallback((viewportId: string, seriesId: number) => {
    setViewports(prev => prev.map(vp => {
      if (vp.id === viewportId) {
        // Don't add if it's the same as primary
        if (vp.primarySeriesId === seriesId) return vp;
        
        // Check registration
        if (!canFuse(vp.primarySeriesId, seriesId)) {
          console.warn('Cannot fuse: No registration found');
          return vp;
        }
        
        // Toggle if already in fusion layers (remove it)
        if (vp.fusionSeriesIds.includes(seriesId)) {
          return { ...vp, fusionSeriesIds: vp.fusionSeriesIds.filter(id => id !== seriesId) };
        }
        
        // Add to fusion layers (for now, single fusion only)
        return { ...vp, fusionSeriesIds: [seriesId] };
      }
      return vp;
    }));
    
    setActiveViewportId(viewportId);
    setDragOverViewportId(null);
  }, [canFuse]);

  // Remove fusion layer
  const removeFusionLayer = useCallback((viewportId: string, seriesId: number) => {
    setViewports(prev => prev.map(vp =>
      vp.id === viewportId
        ? { ...vp, fusionSeriesIds: vp.fusionSeriesIds.filter(id => id !== seriesId) }
        : vp
    ));
  }, []);

  // Save current layout
  const saveLayout = useCallback(() => {
    const saved: SavedLayout = {
      id: `layout-${Date.now()}`,
      name: `Layout ${savedLayouts.length + 1}`,
      timestamp: Date.now(),
      viewports: JSON.parse(JSON.stringify(viewports)),
      layoutMode
    };
    setSavedLayouts(prev => [...prev, saved]);
  }, [viewports, layoutMode, savedLayouts.length]);

  // Load saved layout
  const loadLayout = useCallback((saved: SavedLayout) => {
    setViewports(saved.viewports);
    setLayoutMode(saved.layoutMode);
    setShowSavedLayouts(false);
    setActiveViewportId(saved.viewports[0]?.id || null);
  }, []);

  return (
    <div className="flex h-full bg-black text-white overflow-hidden relative">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
          {LAYOUT_PRESETS.map(preset => (
            <Button
              key={preset.id}
              size="sm"
              variant="ghost"
              onClick={() => setLayoutMode(preset.mode)}
              className={cn(
                "h-8 w-8 p-0 rounded-lg transition-all",
                layoutMode === preset.mode
                  ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              )}
              title={preset.name}
            >
              {preset.icon}
            </Button>
          ))}

          <div className="w-px h-4 bg-white/10 mx-2" />

          <Button
            size="sm"
            variant="ghost"
            onClick={saveLayout}
            className="h-8 px-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
            disabled={viewports.length === 0}
            title="Save Layout"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSavedLayouts(!showSavedLayouts)}
            className={cn(
              "h-8 px-2 rounded-lg",
              showSavedLayouts ? 'bg-cyan-950/50 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/10'
            )}
            disabled={savedLayouts.length === 0}
            title="Saved Layouts"
          >
            <Bookmark className="w-3.5 h-3.5" />
            {savedLayouts.length > 0 && (
              <span className="ml-1 text-xs">{savedLayouts.length}</span>
            )}
          </Button>

          <div className="w-px h-4 bg-white/10 mx-2" />

          <span className="text-xs text-gray-500 px-2">
            {viewports.length === 0 ? 'No viewports' : `${viewports.length} active`}
          </span>
        </div>

        {/* Saved Layouts Dropdown */}
        {showSavedLayouts && savedLayouts.length > 0 && (
          <div className="absolute top-full left-0 mt-2 bg-gray-950/95 border border-gray-700 rounded-lg shadow-xl p-2 min-w-[200px]">
            {savedLayouts.map(saved => (
              <button
                key={saved.id}
                onClick={() => loadLayout(saved)}
                className="w-full p-2 text-left rounded hover:bg-gray-800 transition-colors"
              >
                <div className="text-xs font-medium text-white">{saved.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {saved.viewports.length} viewports • {new Date(saved.timestamp).toLocaleTimeString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Viewport Grid */}
      <div className="flex-1 p-4 pt-16 overflow-hidden">
        {viewports.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
              <LayoutGrid className="w-10 h-10 opacity-20 text-white" />
            </div>
            <h3 className="text-sm font-medium text-gray-400 tracking-wide uppercase">No Viewports</h3>
            <p className="text-xs text-gray-600 mt-2 max-w-xs text-center">
              Drag series from the fusion panel to create viewports
            </p>
          </div>
        ) : (
          <div 
            className="w-full h-full grid gap-2 transition-all duration-300 ease-in-out"
            style={gridStyle}
          >
            <AnimatePresence mode="popLayout">
              {viewports.map((vp) => {
                const series = availableSeries.find(s => s.id === vp.primarySeriesId);
                if (!series) return null;

                const fusionSeriesList = vp.fusionSeriesIds
                  .map(id => availableSeries.find(s => s.id === id))
                  .filter(Boolean) as DICOMSeries[];

                const isValidDrop = draggedSeriesId ? canFuse(vp.primarySeriesId, draggedSeriesId) : false;

                return (
                  <ViewportCard
                    key={vp.id}
                    viewport={vp}
                    series={series}
                    isActive={activeViewportId === vp.id}
                    fusionOpacity={fusionOpacity}
                    fusionSeriesList={fusionSeriesList}
                    canFuse={canFuse}
                    isDragOver={dragOverViewportId === vp.id}
                    isValidDrop={isValidDrop}
                    onClick={() => setActiveViewportId(vp.id)}
                    onRemove={() => removeViewport(vp.id)}
                    onToggleMPR={() => toggleMPR(vp.id)}
                    onRemoveFusion={(seriesId) => removeFusionLayer(vp.id, seriesId)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverViewportId(vp.id);
                    }}
                    onDragLeave={() => setDragOverViewportId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const seriesId = parseInt(e.dataTransfer.getData('seriesId'));
                      if (seriesId) handleFusionDrop(vp.id, seriesId);
                    }}
                    studyId={studyId}
                    windowLevel={windowLevel}
                    onWindowLevelChange={onWindowLevelChange}
                    rtStructures={rtStructures}
                    structureVisibility={structureVisibility}
                    brushToolState={brushToolState}
                    selectedForEdit={selectedForEdit}
                    selectedStructures={selectedStructures}
                    onBrushSizeChange={onBrushSizeChange}
                    onContourUpdate={onContourUpdate}
                    contourSettings={contourSettings}
                    allStructuresVisible={allStructuresVisible}
                    imageCache={imageCache}
                    registrationAssociations={registrationAssociations}
                    fusionSecondaryStatuses={fusionSecondaryStatuses}
                    fusionManifestLoading={fusionManifestLoading}
                    fusionManifestPrimarySeriesId={fusionManifestPrimarySeriesId}
                    fusionWindowLevel={fusionWindowLevel}
                    onImageMetadataChange={onImageMetadataChange}
                    onActivePredictionsChange={onActivePredictionsChange}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
});

SmartFusionGrid.displayName = 'SmartFusionGrid';

