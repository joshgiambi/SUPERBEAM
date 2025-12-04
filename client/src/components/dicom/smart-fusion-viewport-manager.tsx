import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, 
  Rows, 
  Columns, 
  X, 
  Layers, 
  Maximize2, 
  Settings,
  Activity,
  Scan,
  Brain,
  CheckCircle2,
  Circle,
  GripVertical,
  Plus,
  Box,
  Grid3X3,
  Zap,
  ChevronDown,
  SplitSquareHorizontal,
  Layers2,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

// --- Types ---

type SeriesType = 'CT' | 'PET' | 'MRI' | 'DOSE';
type Orientation = 'axial' | 'sagittal' | 'coronal';

interface Series {
  id: string;
  type: SeriesType;
  description: string;
  modality: string;
  date: string;
  imageCount: number;
  color: string;
  registeredWith: string[]; // ID of series this is registered to
}

interface ViewportState {
  id: string;
  primarySeriesId: string;
  fusionSeriesIds: string[];
  layout: 'single' | 'mpr';
}

// --- Mock Data ---

const MOCK_SERIES: Series[] = [
  { 
    id: 'ct-1', 
    type: 'CT', 
    description: 'Planning CT 3mm', 
    modality: 'CT', 
    date: 'Jan 15, 2024', 
    imageCount: 120, 
    color: '#3b82f6',
    registeredWith: ['pet-1', 'dose-1', 'mri-t1', 'mri-t2'] 
  },
  { 
    id: 'pet-1', 
    type: 'PET', 
    description: 'Whole Body PET', 
    modality: 'PT', 
    date: 'Jan 15, 2024', 
    imageCount: 120, 
    color: '#eab308',
    registeredWith: ['ct-1'] 
  },
  { 
    id: 'mri-t1', 
    type: 'MRI', 
    description: 'Axial T1 Brain', 
    modality: 'MR', 
    date: 'Jan 14, 2024', 
    imageCount: 60, 
    color: '#a855f7',
    registeredWith: ['ct-1']
  },
  { 
    id: 'mri-t2', 
    type: 'MRI', 
    description: 'Axial T2 FLAIR', 
    modality: 'MR', 
    date: 'Jan 14, 2024', 
    imageCount: 60, 
    color: '#d946ef',
    registeredWith: ['ct-1']
  },
  { 
    id: 'dose-1', 
    type: 'DOSE', 
    description: 'RT Dose Plan', 
    modality: 'RTDOSE', 
    date: 'Jan 16, 2024', 
    imageCount: 1, 
    color: '#ef4444',
    registeredWith: ['ct-1']
  },
  { 
    id: 'ct-2', 
    type: 'CT', 
    description: 'Prior CT (2023)', 
    modality: 'CT', 
    date: 'Dec 10, 2023', 
    imageCount: 110, 
    color: '#64748b',
    registeredWith: [] // Not registered to current session
  },
];

// --- Mock Fusion Control Panel ---
// Updated to fit the "Right Sidebar" paradigm and look more integrated

const IntegratedFusionToolbar = ({ 
    seriesId,
    opacity,
    onOpacityChange,
    colormap,
    onColormapChange,
    onRemove
}: { 
    seriesId: string | null;
    opacity: number;
    onOpacityChange: (v: number) => void;
    colormap: string;
    onColormapChange: (v: string) => void;
    onRemove: () => void;
}) => {
    if (!seriesId) return null;
    
    const series = MOCK_SERIES.find(s => s.id === seriesId);
    if (!series) return null;

    return (
        <div className="w-full rounded-xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden">
            <div className="bg-cyan-950/40 px-3 py-2 border-b border-cyan-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                    <span className="text-xs font-bold text-cyan-100 tracking-wide">ACTIVE FUSION</span>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-900/40"
                    onClick={onRemove}
                >
                    <X className="w-3.5 h-3.5" />
                </Button>
            </div>

            <div className="p-3 space-y-4">
                {/* Series Info */}
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-black border border-white/10 shrink-0 overflow-hidden">
                        <MockCanvas series={series} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="h-4 px-1 text-[9px] border-white/20 text-gray-300 rounded-sm">
                                {series.modality}
                            </Badge>
                        </div>
                        <p className="text-xs font-medium text-gray-200 truncate">{series.description}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="space-y-3">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Opacity</span>
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 px-1.5 rounded border border-cyan-500/20">
                                {Math.round(opacity * 100)}%
                            </span>
                        </div>
                        <Slider 
                            value={[opacity]} 
                            onValueChange={([v]) => onOpacityChange(v)}
                            max={1} 
                            step={0.01} 
                            className="w-full [&>.relative>.absolute]:bg-cyan-500" 
                        />
                    </div>

                    <div className="space-y-2">
                         <div className="flex items-center gap-1">
                            <Palette className="w-3 h-3 text-gray-500" />
                            <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Colormap</span>
                         </div>
                         <div className="grid grid-cols-2 gap-1.5">
                             {['Hot Iron', 'Rainbow', 'PET', 'Grayscale'].map(cm => (
                                 <button
                                    key={cm}
                                    onClick={() => onColormapChange(cm)}
                                    className={cn(
                                        "h-6 text-[10px] rounded border transition-all duration-200",
                                        colormap === cm 
                                            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm" 
                                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                    )}
                                 >
                                     {cm}
                                 </button>
                             ))}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Canvas Component (Visuals) ---

const MockCanvas = ({ 
    series, 
    isFusion = false,
    orientation = 'axial'
}: { 
    series: Series | null, 
    isFusion?: boolean,
    orientation?: Orientation
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !series) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw anatomy based on type
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 300;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    if (series.type === 'CT' || series.type === 'MRI') {
        if (orientation === 'axial') {
            // Axial: Round Head
            ctx.beginPath();
            ctx.ellipse(0, 0, 80, 100, 0, 0, Math.PI * 2);
            ctx.strokeStyle = isFusion ? `rgba(255,255,255,0.5)` : '#444';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            if (!isFusion) {
                ctx.fillStyle = '#111';
                ctx.fill();
                // Brain Structure
                ctx.beginPath();
                ctx.ellipse(0, 0, 70, 85, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#222';
                ctx.fill();
            }
        } else if (orientation === 'sagittal') {
            // Sagittal: Tall Oval (Side Profile)
            ctx.beginPath();
            ctx.ellipse(0, 0, 90, 110, 0, 0, Math.PI * 2); // Wider/Taller
            ctx.strokeStyle = isFusion ? `rgba(255,255,255,0.5)` : '#444';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (!isFusion) {
                ctx.fillStyle = '#111';
                ctx.fill();
                // Spine Hint
                ctx.fillStyle = '#333';
                ctx.fillRect(30, -120, 20, 240);
            }
        } else if (orientation === 'coronal') {
            // Coronal: Wide (Front Face)
            ctx.beginPath();
            ctx.ellipse(0, 0, 85, 100, 0, 0, Math.PI * 2);
            ctx.strokeStyle = isFusion ? `rgba(255,255,255,0.5)` : '#444';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (!isFusion) {
                ctx.fillStyle = '#111';
                ctx.fill();
                // Eyes Hint
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.arc(-30, -20, 15, 0, Math.PI * 2);
                ctx.arc(30, -20, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        }

    } else if (series.type === 'PET') {
        // Hotspot logic
        ctx.globalAlpha = 0.6;
        
        let hotspotX = 20;
        let hotspotY = -20;

        // Move hotspot based on orientation to show 3D consistency
        if (orientation === 'sagittal') { hotspotX = 10; hotspotY = -30; }
        if (orientation === 'coronal') { hotspotX = -20; hotspotY = -20; }

        const grad = ctx.createRadialGradient(hotspotX, hotspotY, 0, hotspotX, hotspotY, 40);
        grad.addColorStop(0, 'rgba(255, 255, 0, 1)');
        grad.addColorStop(0.4, 'rgba(255, 0, 0, 0.6)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(hotspotX, hotspotY, 40, 0, Math.PI * 2);
        ctx.fill();
    } else if (series.type === 'DOSE') {
        // Isodose lines
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = series.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.stroke();
    }

    ctx.restore();
  }, [series, isFusion, orientation]);

  return <canvas ref={canvasRef} width={400} height={400} className="w-full h-full object-contain" />;
};

// --- Main Component ---

export function SmartFusionViewportManager() {
  const [activeViewports, setActiveViewports] = useState<ViewportState[]>([]);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'rows' | 'cols'>('grid');
  const [dragOverViewportId, setDragOverViewportId] = useState<string | null>(null);
  const [draggedSeriesId, setDraggedSeriesId] = useState<string | null>(null);
  
  // Fusion Panel State
  const [activeFusionViewportId, setActiveFusionViewportId] = useState<string | null>(null);
  const [activeFusionSeriesId, setActiveFusionSeriesId] = useState<string | null>(null);
  const [fusionOpacity, setFusionOpacity] = useState(0.5);
  const [fusionColormap, setFusionColormap] = useState('Hot Iron');

  // Toggle a series visibility (Add/Remove Viewport)
  const toggleSeries = (seriesId: string) => {
    setActiveViewports(prev => {
      const existing = prev.find(vp => vp.primarySeriesId === seriesId);
      if (existing) {
        // Remove
        if (activeFusionViewportId === existing.id) {
            setActiveFusionViewportId(null);
            setActiveFusionSeriesId(null);
        }
        return prev.filter(vp => vp.primarySeriesId !== seriesId);
      } else {
        // Add new viewport
        return [...prev, { 
            id: `vp-${Date.now()}`, 
            primarySeriesId: seriesId, 
            fusionSeriesIds: [],
            layout: 'single'
        }];
      }
    });
  };

  // Toggle MPR Mode for a viewport
  const toggleMPR = (viewportId: string) => {
      setActiveViewports(prev => prev.map(vp => {
          if (vp.id === viewportId) {
              return { ...vp, layout: vp.layout === 'single' ? 'mpr' : 'single' };
          }
          return vp;
      }));
  };

  // Check if fusion is valid (registration check)
  const canFuse = (primaryId: string, secondaryId: string) => {
      const primary = MOCK_SERIES.find(s => s.id === primaryId);
      return primary?.registeredWith.includes(secondaryId);
  };

  // Handle dropping a series onto a viewport to FUSE it
  const handleFusionDrop = (e: React.DragEvent, targetViewportId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const seriesId = e.dataTransfer.getData('seriesId');
    if (!seriesId) return;

    setActiveViewports(prev => {
        const vp = prev.find(v => v.id === targetViewportId);
        if (!vp) return prev;

        // Check registration
        if (!canFuse(vp.primarySeriesId, seriesId)) {
             // Shake animation or error toast could go here
             console.log("Cannot fuse: Registration missing");
             return prev;
        }

        // Update viewport
        const updated = prev.map(v => {
            if (v.id === targetViewportId) {
                if (v.fusionSeriesIds.includes(seriesId) || v.primarySeriesId === seriesId) return v;
                
                // Auto-select this fusion
                setActiveFusionViewportId(targetViewportId);
                setActiveFusionSeriesId(seriesId);
                
                return { ...v, fusionSeriesIds: [...v.fusionSeriesIds, seriesId] };
            }
            return v;
        });
        return updated;
    });
    setDragOverViewportId(null);
    setDraggedSeriesId(null);
  };

  const removeFusionLayer = (viewportId: string, seriesId: string) => {
      setActiveViewports(prev => prev.map(vp => {
          if (vp.id === viewportId) {
              if (activeFusionSeriesId === seriesId) setActiveFusionSeriesId(null);
              return { ...vp, fusionSeriesIds: vp.fusionSeriesIds.filter(id => id !== seriesId) };
          }
          return vp;
      }));
  };

  // Layout Logic
  const getGridStyle = () => {
      const count = activeViewports.length;
      if (count === 0) return { display: 'flex', alignItems: 'center', justifyContent: 'center' };
      
      if (layoutMode === 'rows') return { gridTemplateColumns: '1fr', gridTemplateRows: `repeat(${count}, 1fr)` };
      if (layoutMode === 'cols') return { gridTemplateColumns: `repeat(${count}, 1fr)`, gridTemplateRows: '1fr' };
      
      // Auto Grid
      if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
      if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
      if (count <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
      if (count <= 6) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
      return { gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' };
  };

  // Derive what to show in the Fusion Panel
  const currentPanelSeriesId = activeFusionSeriesId || 
    (activeFusionViewportId && activeViewports.find(v => v.id === activeFusionViewportId)?.fusionSeriesIds.slice(-1)[0]) || 
    null;

  return (
    <div className="flex h-full bg-black text-white overflow-hidden font-sans selection:bg-cyan-500/30 relative">
      
      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-black relative bg-[url('/grid-pattern.svg')] bg-repeat opacity-100">
          
          {/* Floating Toolbar (Unified Style) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
               <TooltipProvider>
                   <Tooltip>
                       <TooltipTrigger asChild>
                            <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setLayoutMode('grid')}
                                className={`h-8 w-8 p-0 rounded-lg transition-all ${layoutMode === 'grid' ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </Button>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="text-xs bg-black border-white/10">Auto Grid</TooltipContent>
                   </Tooltip>

                   <Tooltip>
                       <TooltipTrigger asChild>
                            <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setLayoutMode('rows')}
                                className={`h-8 w-8 p-0 rounded-lg transition-all ${layoutMode === 'rows' ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <Rows className="w-4 h-4" />
                            </Button>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="text-xs bg-black border-white/10">Row by Row</TooltipContent>
                   </Tooltip>

                   <Tooltip>
                       <TooltipTrigger asChild>
                            <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setLayoutMode('cols')}
                                className={`h-8 w-8 p-0 rounded-lg transition-all ${layoutMode === 'cols' ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <Columns className="w-4 h-4" />
                            </Button>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="text-xs bg-black border-white/10">Side by Side</TooltipContent>
                   </Tooltip>
               </TooltipProvider>

               <div className="w-px h-4 bg-white/10 mx-2" />
               
               <span className="text-[10px] text-gray-500 font-medium px-1">
                   {activeViewports.length === 0 ? 'No Selection' : `${activeViewports.length} Active`}
               </span>
            </div>
          </div>

          {/* Viewport Grid */}
          <div className="flex-1 p-4 pt-16 overflow-hidden relative">
              {activeViewports.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 animate-in fade-in duration-500">
                      <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                        <Scan className="w-10 h-10 opacity-20 text-white" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-400 tracking-wide uppercase">Workspace Empty</h3>
                      <p className="text-xs text-gray-600 mt-2 max-w-xs text-center">
                          Select series from the sidebar to begin
                      </p>
                  </div>
              ) : (
                <div 
                    className="w-full h-full grid gap-2 transition-all duration-300 ease-in-out"
                    style={getGridStyle()}
                >
                    <AnimatePresence mode='popLayout'>
                        {activeViewports.map((vp) => {
                            const primary = MOCK_SERIES.find(s => s.id === vp.primarySeriesId)!;
                            const isActiveForFusion = activeFusionViewportId === vp.id;
                            
                            // Determine if this viewport is a valid target for the currently dragged item
                            const isDropTarget = draggedSeriesId && canFuse(vp.primarySeriesId, draggedSeriesId);
                            const isDragOver = dragOverViewportId === vp.id;

                            return (
                                <motion.div
                                    layout
                                    key={vp.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className={`
                                        relative bg-black rounded-xl border overflow-hidden group flex flex-col shadow-2xl transition-colors
                                        ${isDragOver 
                                            ? (isDropTarget ? 'border-cyan-500/80 ring-4 ring-cyan-500/20' : 'border-red-500/50 ring-4 ring-red-500/10')
                                            : isActiveForFusion 
                                                ? 'border-cyan-500/50 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]' 
                                                : 'border-white/10 hover:border-white/20'
                                        }
                                    `}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverViewportId(vp.id);
                                    }}
                                    onDragLeave={() => setDragOverViewportId(null)}
                                    onDrop={(e) => handleFusionDrop(e, vp.id)}
                                    onClick={() => {
                                        if (vp.fusionSeriesIds.length > 0) {
                                            setActiveFusionViewportId(vp.id);
                                            // Keep current series selection if valid, else pick last
                                            if (!activeFusionSeriesId || !vp.fusionSeriesIds.includes(activeFusionSeriesId)) {
                                                setActiveFusionSeriesId(vp.fusionSeriesIds[vp.fusionSeriesIds.length - 1]);
                                            }
                                        }
                                    }}
                                >
                                    {/* Viewport Header */}
                                    <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
                                        <div className="flex flex-col gap-1 pointer-events-auto">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-blue-950/40 text-blue-200 border-blue-500/20 hover:bg-blue-900/40 backdrop-blur-sm">
                                                    {primary.description}
                                                </Badge>
                                            </div>
                                            
                                            {/* Fusion Badges */}
                                            {vp.fusionSeriesIds.map(fid => {
                                                const fSeries = MOCK_SERIES.find(s => s.id === fid);
                                                if (!fSeries) return null;
                                                const isBadgeActive = activeFusionSeriesId === fid && isActiveForFusion;

                                                return (
                                                    <div key={fid} className="flex items-center gap-1 animate-in slide-in-from-left-2 fade-in duration-200">
                                                        <Badge 
                                                            className={`
                                                                bg-yellow-900/30 text-yellow-200 border-yellow-500/20 hover:bg-yellow-900/40 backdrop-blur-sm cursor-pointer transition-all
                                                                ${isBadgeActive ? 'ring-1 ring-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)] bg-yellow-900/50 text-yellow-100' : ''}
                                                            `}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveFusionViewportId(vp.id);
                                                                setActiveFusionSeriesId(fid);
                                                            }}
                                                        >
                                                            + {fSeries.description}
                                                        </Badge>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-4 w-4 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-full"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeFusionLayer(vp.id, fid);
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex gap-1 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className={`h-7 w-7 rounded-lg backdrop-blur-md border transition-all ${
                                                                vp.layout === 'mpr' 
                                                                ? 'bg-cyan-900/40 border-cyan-500/30 text-cyan-300' 
                                                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleMPR(vp.id);
                                                            }}
                                                        >
                                                            <Box className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="text-xs bg-black border-white/10">Toggle MPR</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-7 w-7 bg-white/5 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/30 border border-white/10 text-gray-400 rounded-lg backdrop-blur-md"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSeries(primary.id);
                                                }}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 relative overflow-hidden">
                                        {vp.layout === 'single' ? (
                                            // Single View
                                            <div className="absolute inset-0">
                                                <div className="absolute inset-0">
                                                    <MockCanvas series={primary} orientation="axial" />
                                                </div>
                                                {vp.fusionSeriesIds.map((fid, idx) => {
                                                    const fSeries = MOCK_SERIES.find(s => s.id === fid);
                                                    return (
                                                        <div key={fid} className="absolute inset-0 mix-blend-screen" style={{ zIndex: idx + 1, opacity: fid === activeFusionSeriesId ? fusionOpacity : 0.5 }}>
                                                            <MockCanvas series={fSeries || null} isFusion orientation="axial" />
                                                        </div>
                                                    );
                                                })}
                                                <div className="absolute bottom-2 right-2 text-[10px] font-mono text-gray-400 bg-black/50 px-1.5 rounded border border-white/5">
                                                    Axial
                                                </div>
                                            </div>
                                        ) : (
                                            // MPR 3-View Layout
                                            <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-[1px] bg-zinc-800">
                                                {/* Top Left: Axial */}
                                                <div className="relative bg-black">
                                                    <div className="absolute inset-0">
                                                        <MockCanvas series={primary} orientation="axial" />
                                                    </div>
                                                    {vp.fusionSeriesIds.map((fid) => (
                                                        <div key={fid} className="absolute inset-0 mix-blend-screen" style={{ opacity: fid === activeFusionSeriesId ? fusionOpacity : 0.5 }}>
                                                            <MockCanvas series={MOCK_SERIES.find(s=>s.id===fid)!} isFusion orientation="axial" />
                                                        </div>
                                                    ))}
                                                    <div className="absolute bottom-1 right-1 text-[10px] text-blue-400 font-mono bg-black/40 px-1 rounded">Axial</div>
                                                </div>
                                                
                                                {/* Top Right: Sagittal */}
                                                <div className="relative bg-black">
                                                    <div className="absolute inset-0">
                                                        <MockCanvas series={primary} orientation="sagittal" />
                                                    </div>
                                                    {vp.fusionSeriesIds.map((fid) => (
                                                        <div key={fid} className="absolute inset-0 mix-blend-screen" style={{ opacity: fid === activeFusionSeriesId ? fusionOpacity : 0.5 }}>
                                                            <MockCanvas series={MOCK_SERIES.find(s=>s.id===fid)!} isFusion orientation="sagittal" />
                                                        </div>
                                                    ))}
                                                    <div className="absolute bottom-1 right-1 text-[10px] text-yellow-400 font-mono bg-black/40 px-1 rounded">Sagittal</div>
                                                </div>

                                                {/* Bottom Left: Coronal */}
                                                <div className="relative bg-black">
                                                    <div className="absolute inset-0">
                                                        <MockCanvas series={primary} orientation="coronal" />
                                                    </div>
                                                    {vp.fusionSeriesIds.map((fid) => (
                                                        <div key={fid} className="absolute inset-0 mix-blend-screen" style={{ opacity: fid === activeFusionSeriesId ? fusionOpacity : 0.5 }}>
                                                            <MockCanvas series={MOCK_SERIES.find(s=>s.id===fid)!} isFusion orientation="coronal" />
                                                        </div>
                                                    ))}
                                                    <div className="absolute bottom-1 right-1 text-[10px] text-green-400 font-mono bg-black/40 px-1 rounded">Coronal</div>
                                                </div>

                                                {/* Bottom Right: 3D / MIP */}
                                                <div className="relative bg-zinc-900 flex items-center justify-center">
                                                    <Box className="w-8 h-8 text-zinc-700" />
                                                    <span className="text-xs text-zinc-600 mt-2 absolute bottom-2">3D Ref</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Drag Overlay Hint */}
                                    {isDragOver && (
                                        <div className={`absolute inset-0 backdrop-blur-[2px] flex items-center justify-center z-50 border-4 rounded-xl m-[-2px] ${isDropTarget ? 'bg-cyan-900/40 border-cyan-500' : 'bg-red-900/20 border-red-500/50'}`}>
                                            {isDropTarget ? (
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
                        })}
                    </AnimatePresence>
                </div>
              )}
          </div>
      </div>
      
      {/* --- Sidebar: Series Selector (Right) --- */}
      <div className="w-72 bg-black/80 border-l border-white/10 flex flex-col shrink-0 z-20 backdrop-blur-xl relative">
        
        {/* FUSION TOOLBAR (Integrated Contextual Panel) */}
        {currentPanelSeriesId ? (
            <div className="p-3 border-b border-white/10 bg-black/50">
                <IntegratedFusionToolbar 
                    seriesId={currentPanelSeriesId}
                    opacity={fusionOpacity}
                    onOpacityChange={setFusionOpacity}
                    colormap={fusionColormap}
                    onColormapChange={setFusionColormap}
                    onRemove={() => {
                        if (activeFusionViewportId && activeFusionSeriesId) {
                            removeFusionLayer(activeFusionViewportId, activeFusionSeriesId);
                        }
                    }}
                />
            </div>
        ) : (
             // Placeholder or Global Settings could go here
             null
        )}

        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-white/5">
            <div className="w-8 h-8 bg-cyan-900/30 border border-cyan-500/30 rounded-lg flex items-center justify-center shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]">
                <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
                <h2 className="font-bold text-xs tracking-wider text-gray-100 uppercase">Study Browser</h2>
                <p className="text-[10px] text-gray-500">Select scans to view</p>
            </div>
        </div>

        <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
                {MOCK_SERIES.map(series => {
                    const isViewed = activeViewports.some(vp => vp.primarySeriesId === series.id);
                    
                    return (
                        <div 
                            key={series.id}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('seriesId', series.id);
                                setDraggedSeriesId(series.id);
                                e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onDragEnd={() => setDraggedSeriesId(null)}
                            onClick={() => toggleSeries(series.id)}
                            className={`
                                relative group p-2 rounded-lg border transition-all duration-200 cursor-pointer select-none
                                ${isViewed 
                                    ? 'bg-cyan-950/30 border-cyan-500/40 shadow-[0_0_10px_-5px_rgba(6,182,212,0.2)]' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                }
                            `}
                        >
                            {/* Status Indicator */}
                            <div className="absolute top-2 right-2">
                                {isViewed ? (
                                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                ) : (
                                    <Circle className="w-4 h-4 text-gray-700 group-hover:text-gray-500" />
                                )}
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-14 h-14 bg-black rounded border border-white/10 relative shrink-0 overflow-hidden">
                                    <MockCanvas series={series} />
                                </div>
                                <div className="flex-1 min-w-0 py-0.5">
                                    <Badge variant="outline" className="mb-1 h-4 px-1 text-[9px] border-white/20 text-gray-400 font-normal rounded-sm">
                                        {series.modality}
                                    </Badge>
                                    <h3 className={`text-xs font-medium truncate ${isViewed ? 'text-cyan-100' : 'text-gray-300'}`}>
                                        {series.description}
                                    </h3>
                                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                                        {series.imageCount} IMG • {series.date}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Hint for Drag */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-0 flex items-center justify-center pointer-events-none transition-opacity">
                                <span className="text-[10px] font-medium text-white bg-black/80 px-2 py-1 rounded border border-white/10">
                                    Drag to Fuse
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
      </div>
    </div>
  );
}
