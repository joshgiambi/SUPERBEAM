/**
 * Fusion Viewport Grid - HYBRID PROTOTYPE
 * 
 * Combines Smart Fusion's multi-viewport fusion with SONNET's layout saving
 * Integrates with existing FusionControlPanelV2
 * 
 * Key features:
 * - CT scan loaded by default (primary)
 * - Per-viewport fusion management
 * - Works with existing FusionControlPanelV2 (rendered in sidebar)
 * - Layout saving/loading
 * - MPR support per viewport
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutGrid, Rows3, Columns2, X, Layers, Box, 
  Bookmark, BookmarkPlus, Grid2x2, CheckCircle2, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FusionControlPanelV2 } from './fusion-control-panel-v2';

// ============================================================================
// TYPES
// ============================================================================

interface ViewportState {
  id: string;
  primarySeriesId: number;
  fusionSeriesIds: number[];
  layout: 'single' | 'mpr';
}

interface LayoutPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  mode: 'auto-grid' | 'rows' | 'cols' | 'quad' | 'side-by-side' | 'single';
}

interface SavedLayout {
  id: string;
  name: string;
  timestamp: number;
  viewports: ViewportState[];
  layoutMode: string;
}

interface FusionViewportGridProps {
  // Series data would come from parent
  availableSeries?: any[];
  selectedSeries?: any;
  onSeriesSelect?: (series: any) => void;
  
  // Fusion state
  fusionOpacity?: number;
  onFusionOpacityChange?: (opacity: number) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  onFusionWindowLevelChange?: (preset: { window: number; level: number } | null) => void;
  
  // For integration with existing components
  onActiveViewportChange?: (viewportId: string | null) => void;
}

// ============================================================================
// MOCK DATA FOR PROTOTYPE
// ============================================================================

interface SeriesData {
  id: number;
  modality: string;
  description: string;
  date: string;
  imageCount: number;
}

const MOCK_SERIES: SeriesData[] = [
  { id: 1, modality: 'CT', description: 'Planning CT 3mm', date: 'Jan 15, 2024', imageCount: 120 },
  { id: 101, modality: 'PT', description: 'FDG PET Whole Body', date: 'Jan 15, 2024', imageCount: 120 },
  { id: 102, modality: 'MR', description: 'T1 Post Contrast', date: 'Jan 14, 2024', imageCount: 60 },
  { id: 103, modality: 'MR', description: 'T2 FLAIR', date: 'Jan 14, 2024', imageCount: 60 },
  { id: 104, modality: 'CT', description: 'Prior CT (2023)', date: 'Dec 10, 2023', imageCount: 110 },
];

const MOCK_SECONDARY_OPTIONS = [
  {
    secondarySeriesId: 101,
    secondaryModality: 'PET',
    secondaryDescription: 'FDG PET Whole Body',
    windowCenter: [500],
    windowWidth: [1000],
  },
  {
    secondarySeriesId: 102,
    secondaryModality: 'MR',
    secondaryDescription: 'T1 Post Contrast',
    windowCenter: [300],
    windowWidth: [600],
  },
  {
    secondarySeriesId: 103,
    secondaryModality: 'MR',
    secondaryDescription: 'T2 FLAIR',
    windowCenter: [1000],
    windowWidth: [2000],
  },
];

const MOCK_SECONDARY_STATUSES = new Map([
  [101, { status: 'ready' as const, error: null }],
  [102, { status: 'ready' as const, error: null }],
  [103, { status: 'ready' as const, error: null }],
]);

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
// MOCK CANVAS (Replace with actual WorkingViewer integration)
// ============================================================================

const MockCanvas: React.FC<{ 
  seriesId: number; 
  fusionSeriesIds: number[];
  opacity?: number;
  orientation?: 'axial' | 'sagittal' | 'coronal';
}> = ({ seriesId, fusionSeriesIds, opacity = 0.5, orientation = 'axial' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Base anatomy
    ctx.beginPath();
    ctx.ellipse(cx, cy, 120, 140, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fusion overlay if any
    if (fusionSeriesIds.length > 0) {
      ctx.globalAlpha = opacity;
      const grad = ctx.createRadialGradient(cx - 40, cy - 30, 0, cx - 40, cy - 30, 50);
      grad.addColorStop(0, 'rgba(255, 255, 0, 1)');
      grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx - 40, cy - 30, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Orientation marker
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(orientation === 'axial' ? 'A' : orientation === 'sagittal' ? 'S' : 'C', cx, 15);

  }, [seriesId, fusionSeriesIds, opacity, orientation]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={400} 
      className="w-full h-full object-contain"
    />
  );
};

// ============================================================================
// VIEWPORT COMPONENT
// ============================================================================

const ViewportComponent: React.FC<{
  viewport: ViewportState;
  isActive: boolean;
  fusionOpacity: number;
  onRemove: () => void;
  onToggleMPR: () => void;
  onRemoveFusion: (seriesId: number) => void;
  onFusionDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}> = ({ viewport, isActive, fusionOpacity, onRemove, onToggleMPR, onRemoveFusion, onFusionDrop, onClick }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative bg-black rounded-lg border overflow-hidden group cursor-pointer',
        isDragOver && 'border-purple-500/50 ring-2 ring-purple-500/20',
        isActive && 'border-indigo-500/50 shadow-lg shadow-indigo-500/10',
        !isActive && !isDragOver && 'border-gray-700 hover:border-gray-600'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onFusionDrop(e);
      }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start z-20 bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
        <div className="flex flex-col gap-1 pointer-events-auto">
          <Badge className="bg-blue-900/60 text-blue-200 border-blue-600/30 backdrop-blur-sm text-xs">
            {viewport.primarySeriesId === 1 ? 'Planning CT' : `Series ${viewport.primarySeriesId}`}
          </Badge>
          
          {/* Fusion badges */}
          {viewport.fusionSeriesIds.map(fid => {
            const fusionSeries = MOCK_SECONDARY_OPTIONS.find(s => s.secondarySeriesId === fid);
            const fusionLabel = fusionSeries ? `${fusionSeries.secondaryModality} #${fid}` : `Series ${fid}`;
            
            return (
            <div key={fid} className="flex items-center gap-1">
              <Badge className={cn(
                "bg-yellow-900/40 text-yellow-200 border-yellow-600/40 backdrop-blur-sm text-xs cursor-pointer",
                isActive && "ring-1 ring-yellow-500/50"
              )}>
                + {fusionLabel}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-4 w-4 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFusion(fid);
                }}
              >
                <X className="w-2.5 h-2.5" />
              </Button>
            </div>
            );
          })}
        </div>

        <div className="flex gap-1 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-6 w-6 rounded backdrop-blur-sm border transition-all",
              viewport.layout === 'mpr' 
                ? 'bg-indigo-900/40 border-indigo-500/30 text-indigo-300' 
                : 'bg-black/60 border-gray-700 text-gray-400 hover:text-white'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMPR();
            }}
          >
            <Box className="w-3 h-3" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 bg-black/60 hover:bg-red-900/70 border border-gray-700 text-gray-400 hover:text-red-400 rounded backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full h-full">
        {viewport.layout === 'mpr' ? (
          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-[1px] bg-gray-800">
            {['axial', 'sagittal', 'coronal', '3d'].map((view, idx) => (
              <div key={view} className="relative bg-black">
                {view !== '3d' ? (
                  <MockCanvas 
                    seriesId={viewport.primarySeriesId} 
                    fusionSeriesIds={viewport.fusionSeriesIds}
                    opacity={fusionOpacity}
                    orientation={view as any}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <Box className="w-6 h-6 text-gray-700" />
                  </div>
                )}
                <div className={cn(
                  "absolute bottom-1 right-1 text-xs font-mono px-1 rounded",
                  idx === 0 && "text-blue-400 bg-black/40",
                  idx === 1 && "text-green-400 bg-black/40",
                  idx === 2 && "text-purple-400 bg-black/40",
                  idx === 3 && "text-gray-500 bg-black/40"
                )}>
                  {view === '3d' ? '3D' : view.charAt(0).toUpperCase() + view.slice(1)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative w-full h-full">
            <MockCanvas 
              seriesId={viewport.primarySeriesId} 
              fusionSeriesIds={viewport.fusionSeriesIds}
              opacity={fusionOpacity}
            />
          </div>
        )}
      </div>

      {/* Drag overlay hint */}
      {isDragOver && (
        <div className="absolute inset-0 bg-purple-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-2 text-white">
            <Layers className="w-8 h-8" />
            <span className="font-semibold text-sm">Add Fusion Layer</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FusionViewportGrid({
  availableSeries = [],
  selectedSeries,
  onSeriesSelect,
  fusionOpacity: externalFusionOpacity = 0.5,
  onFusionOpacityChange,
  fusionWindowLevel: externalFusionWindowLevel,
  onFusionWindowLevelChange,
  onActiveViewportChange
}: FusionViewportGridProps) {
  // Initialize with CT scan loaded (series 1 - Planning CT)
  const [viewports, setViewports] = useState<ViewportState[]>([
    {
      id: 'vp-initial',
      primarySeriesId: 1,
      fusionSeriesIds: [],
      layout: 'single'
    }
  ]);
  
  const [layoutMode, setLayoutMode] = useState<string>('auto-grid');
  const [activeViewportId, setActiveViewportId] = useState<string | null>('vp-initial');
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [showSavedLayouts, setShowSavedLayouts] = useState(false);
  
  // Fusion state for FusionControlPanelV2
  const [fusionOpacity, setFusionOpacity] = useState(externalFusionOpacity);
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<number | null>(null);
  const [fusionWindowLevel, setFusionWindowLevel] = useState<{ window: number; level: number } | null>(null);
  const [fusionDisplayMode, setFusionDisplayMode] = useState<'overlay' | 'side-by-side'>('overlay');

  // Sidebar ref for fusion panel portal
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Expose sidebar ref for fusion panel
  useEffect(() => {
    if (sidebarRef.current) {
      (window as any).__workingViewerSidebarRef = { current: sidebarRef.current };
    }
  }, []);

  // Notify parent of active viewport changes
  useEffect(() => {
    onActiveViewportChange?.(activeViewportId);
  }, [activeViewportId, onActiveViewportChange]);

  // When secondary series is selected via FusionControlPanelV2, add to active viewport
  const handleSecondarySeriesSelect = useCallback((seriesId: number | null) => {
    setSelectedSecondaryId(seriesId);
    
    if (seriesId && activeViewportId) {
      setViewports(prev => prev.map(vp => {
        if (vp.id === activeViewportId) {
          // Toggle fusion layer
          if (vp.fusionSeriesIds.includes(seriesId)) {
            return { ...vp, fusionSeriesIds: vp.fusionSeriesIds.filter(id => id !== seriesId) };
          } else {
            return { ...vp, fusionSeriesIds: [...vp.fusionSeriesIds, seriesId] };
          }
        }
        return vp;
      }));
    }
  }, [activeViewportId]);

  // Toggle series (add/remove viewport)
  const toggleSeries = useCallback((seriesId: number) => {
    const existing = viewports.find(vp => vp.primarySeriesId === seriesId);
    
    if (existing) {
      // Remove viewport
      setViewports(prev => prev.filter(vp => vp.primarySeriesId !== seriesId));
      if (activeViewportId === existing.id) {
        setActiveViewportId(viewports[0]?.id || null);
      }
    } else {
      // Add new viewport
      const newViewport: ViewportState = {
        id: `vp-${Date.now()}`,
        primarySeriesId: seriesId,
        fusionSeriesIds: [],
        layout: 'single'
      };
      setViewports(prev => [...prev, newViewport]);
      setActiveViewportId(newViewport.id);
    }
  }, [viewports, activeViewportId]);

  // Remove viewport
  const removeViewport = useCallback((viewportId: string) => {
    setViewports(prev => prev.filter(vp => vp.id !== viewportId));
    if (activeViewportId === viewportId) {
      setActiveViewportId(null);
    }
  }, [activeViewportId]);

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
        if (vp.primarySeriesId === seriesId) {
          return vp;
        }
        // Toggle if already in fusion layers
        if (vp.fusionSeriesIds.includes(seriesId)) {
          return { ...vp, fusionSeriesIds: vp.fusionSeriesIds.filter(id => id !== seriesId) };
        }
        // Add to fusion layers
        setActiveViewportId(viewportId);
        return { ...vp, fusionSeriesIds: [...vp.fusionSeriesIds, seriesId] };
      }
      return vp;
    }));
  }, []);

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
  }, []);

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


  return (
    <div className="flex h-full bg-black text-white overflow-hidden">
      {/* Main Viewport Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Info Banner */}
        <div className="absolute top-3 left-3 z-50">
          <div className="bg-gray-950/90 backdrop-blur-xl border border-gray-700 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400">
              <span className="text-indigo-400 font-semibold">HYBRID:</span> 
              <span className="text-green-400 font-semibold"> Click</span> series badges above to add viewport • 
              <span className="text-yellow-400 font-semibold"> Drag</span> series onto viewports to add fusion • 
              Check FusionControlPanelV2 in right sidebar →
            </p>
          </div>
        </div>

        {/* Available Series Strip (Draggable) */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 max-w-4xl">
          <div className="bg-gray-950/90 backdrop-blur-xl border border-gray-700 rounded-lg px-3 py-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Available Series:</span>
              <div className="flex gap-2 flex-wrap">
                {MOCK_SERIES.map(series => {
                  const isViewed = viewports.some(vp => vp.primarySeriesId === series.id);
                  const modalityColors = {
                    'CT': 'bg-blue-900/40 border-blue-600/40 text-blue-200',
                    'PT': 'bg-amber-900/40 border-amber-600/40 text-amber-200',
                    'PET': 'bg-amber-900/40 border-amber-600/40 text-amber-200',
                    'MR': 'bg-purple-900/40 border-purple-600/40 text-purple-200'
                  };
                  const colorClass = modalityColors[series.modality as keyof typeof modalityColors] || 'bg-gray-800/40 border-gray-600/40 text-gray-300';
                  
                  return (
                    <div
                      key={series.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('seriesId', series.id.toString());
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => toggleSeries(series.id)}
                      className={cn(
                        "px-2 py-1 rounded border text-xs font-medium cursor-move transition-all hover:scale-105 flex items-center gap-1",
                        colorClass,
                        isViewed && "ring-1 ring-white/30"
                      )}
                    >
                      {isViewed ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Circle className="w-3 h-3 opacity-40" />
                      )}
                      <span>{series.modality}</span>
                      <span className="opacity-70">#{series.id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Toolbar */}
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-950/90 backdrop-blur-xl border border-gray-700 rounded-lg shadow-xl">
            {LAYOUT_PRESETS.map(preset => (
              <Button
                key={preset.id}
                size="sm"
                variant="ghost"
                onClick={() => setLayoutMode(preset.mode)}
                className={cn(
                  "h-7 w-7 p-0 rounded transition-all",
                  layoutMode === preset.mode
                    ? 'bg-indigo-900/50 text-indigo-400 border border-indigo-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
                title={preset.name}
              >
                {preset.icon}
              </Button>
            ))}

            <div className="w-px h-4 bg-gray-700 mx-1" />

            <Button
              size="sm"
              variant="ghost"
              onClick={saveLayout}
              className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              disabled={viewports.length === 0}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSavedLayouts(!showSavedLayouts)}
              className={cn(
                "h-7 px-2 rounded",
                showSavedLayouts ? 'bg-indigo-900/50 text-indigo-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
              disabled={savedLayouts.length === 0}
            >
              <Bookmark className="w-3.5 h-3.5" />
              {savedLayouts.length > 0 && (
                <span className="ml-1 text-xs">{savedLayouts.length}</span>
              )}
            </Button>

            <div className="w-px h-4 bg-gray-700 mx-1" />

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
        <div className="flex-1 p-3 pt-40 overflow-hidden">
          {viewports.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
              <LayoutGrid className="w-16 h-16 opacity-20 mb-4" />
              <h3 className="text-sm font-medium text-gray-400">No viewports active</h3>
              <p className="text-xs text-gray-600 mt-2">Select series from the sidebar to begin</p>
            </div>
          ) : (
            <div className="w-full h-full grid gap-2" style={gridStyle}>
              <AnimatePresence mode="popLayout">
                {viewports.map(viewport => (
                  <ViewportComponent
                    key={viewport.id}
                    viewport={viewport}
                    isActive={activeViewportId === viewport.id}
                    fusionOpacity={fusionOpacity}
                    onRemove={() => removeViewport(viewport.id)}
                    onToggleMPR={() => toggleMPR(viewport.id)}
                    onRemoveFusion={(seriesId) => removeFusionLayer(viewport.id, seriesId)}
                    onFusionDrop={(e) => {
                      const seriesId = parseInt(e.dataTransfer.getData('seriesId'));
                      if (seriesId) handleFusionDrop(viewport.id, seriesId);
                    }}
                    onClick={() => setActiveViewportId(viewport.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Container for FusionControlPanelV2 portal */}
      <div
        ref={sidebarRef}
        className="w-96 flex-shrink-0 flex flex-col gap-3 relative overflow-y-auto p-3"
        style={{ minHeight: 0 }}
      >
        {/* FusionControlPanelV2 renders here */}
      </div>

      {/* Render FusionControlPanelV2 - it will portal into sidebar */}
      <FusionControlPanelV2
        opacity={fusionOpacity}
        onOpacityChange={setFusionOpacity}
        secondaryOptions={MOCK_SECONDARY_OPTIONS}
        selectedSecondaryId={selectedSecondaryId}
        onSecondarySeriesSelect={handleSecondarySeriesSelect}
        secondaryStatuses={MOCK_SECONDARY_STATUSES}
        manifestLoading={false}
        manifestError={null}
        windowLevel={fusionWindowLevel}
        onWindowLevelPreset={setFusionWindowLevel}
        displayMode={fusionDisplayMode}
        onDisplayModeChange={setFusionDisplayMode}
        primarySeriesId={activeViewportId ? viewports.find(vp => vp.id === activeViewportId)?.primarySeriesId || null : null}
      />
    </div>
  );
}

