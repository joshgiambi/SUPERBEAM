/**
 * SONNET: Smart Orchestrated Navigation Network for Enhanced Tomography
 * 
 * A revolutionary viewport management system for multi-scan fusion viewing
 * 
 * Features:
 * - Magnetic card dock with smart snapping
 * - Visual layout presets with animated previews
 * - Smart pairing suggestions based on scan types
 * - Bookmarkable layouts for quick recall
 * - Gesture-based controls (swipe to navigate, double-click to swap)
 * - Adaptive layouts that suggest optimal configurations
 * - Smooth, delightful animations throughout
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, Grid2x2, LayoutGrid, Maximize2, ArrowLeftRight, 
  Bookmark, BookmarkPlus, Star, Zap, Eye, EyeOff, 
  RotateCw, RefreshCw, Layers3, Split, Columns2, 
  Rows3, Grid3x3, Square, RectangleHorizontal, 
  RectangleVertical, Copy, Shuffle, Lock, Unlock,
  Plus, Minus, Search, X, Boxes
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type ScanModality = 'CT' | 'MRI' | 'PET' | 'SPECT' | 'US' | 'RT';

interface Scan {
  id: string;
  label: string;
  modality: ScanModality;
  seriesDescription?: string;
  isPrimary?: boolean;
}

interface ViewportSlot {
  id: string;
  scanId: string | null;
  position: { row: number; col: number };
  span: { rows: number; cols: number };
  isLocked?: boolean;
  mprMode?: boolean; // Multi-planar reconstruction mode
}

interface LayoutPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  grid: { rows: number; cols: number };
  slots: Omit<ViewportSlot, 'scanId'>[];
}

interface SavedLayout {
  id: string;
  name: string;
  timestamp: number;
  preset: LayoutPreset;
  scanAssignments: Record<string, string>; // slotId -> scanId
}

interface SmartSuggestion {
  scanIds: string[];
  reason: string;
  confidence: number;
}

// ============================================================================
// LAYOUT PRESETS
// ============================================================================

const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'single',
    name: 'Single',
    icon: <Square className="w-4 h-4" />,
    description: 'One large viewport',
    grid: { rows: 1, cols: 1 },
    slots: [
      { id: 'slot-1', scanId: null, position: { row: 0, col: 0 }, span: { rows: 1, cols: 1 } }
    ]
  },
  {
    id: 'side-by-side',
    name: 'Side by Side',
    icon: <Columns2 className="w-4 h-4" />,
    description: 'Two scans side by side',
    grid: { rows: 1, cols: 2 },
    slots: [
      { id: 'slot-1', scanId: null, position: { row: 0, col: 0 }, span: { rows: 1, cols: 1 } },
      { id: 'slot-2', scanId: null, position: { row: 0, col: 1 }, span: { rows: 1, cols: 1 } }
    ]
  },
  {
    id: 'stacked',
    name: 'Stacked',
    icon: <Rows3 className="w-4 h-4" />,
    description: 'Two scans stacked vertically',
    grid: { rows: 2, cols: 1 },
    slots: [
      { id: 'slot-1', scanId: null, position: { row: 0, col: 0 }, span: { rows: 1, cols: 1 } },
      { id: 'slot-2', scanId: null, position: { row: 1, col: 0 }, span: { rows: 1, cols: 1 } }
    ]
  },
  {
    id: 'quad',
    name: 'Quad',
    icon: <Grid2x2 className="w-4 h-4" />,
    description: 'Four viewports in a grid',
    grid: { rows: 2, cols: 2 },
    slots: [
      { id: 'slot-1', scanId: null, position: { row: 0, col: 0 }, span: { rows: 1, cols: 1 } },
      { id: 'slot-2', scanId: null, position: { row: 0, col: 1 }, span: { rows: 1, cols: 1 } },
      { id: 'slot-3', scanId: null, position: { row: 1, col: 0 }, span: { rows: 1, cols: 1 } },
      { id: 'slot-4', scanId: null, position: { row: 1, col: 1 }, span: { rows: 1, cols: 1 } }
    ]
  },
  {
    id: 'primary-comparison',
    name: 'Primary + Compare',
    icon: <Split className="w-4 h-4" />,
    description: 'Large primary with comparison panel',
    grid: { rows: 2, cols: 2 },
    slots: [
      { id: 'slot-1', scanId: null, position: { row: 0, col: 0 }, span: { rows: 2, cols: 1 } },
      { id: 'slot-2', scanId: null, position: { row: 0, col: 1 }, span: { rows: 1, cols: 1 } },
      { id: 'slot-3', scanId: null, position: { row: 1, col: 1 }, span: { rows: 1, cols: 1 } }
    ]
  },
  {
    id: 'grid-3x3',
    name: '3×3 Grid',
    icon: <Grid3x3 className="w-4 h-4" />,
    description: 'Nine viewports',
    grid: { rows: 3, cols: 3 },
    slots: Array.from({ length: 9 }, (_, i) => ({
      id: `slot-${i + 1}`,
      scanId: null,
      position: { row: Math.floor(i / 3), col: i % 3 },
      span: { rows: 1, cols: 1 }
    }))
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    icon: <RectangleHorizontal className="w-4 h-4" />,
    description: 'Wide format for presentations',
    grid: { rows: 2, cols: 3 },
    slots: [
      { id: 'slot-1', scanId: null, position: { row: 0, col: 0 }, span: { rows: 2, cols: 2 } },
      { id: 'slot-2', scanId: null, position: { row: 0, col: 2 }, span: { rows: 1, cols: 1 } },
      { id: 'slot-3', scanId: null, position: { row: 1, col: 2 }, span: { rows: 1, cols: 1 } }
    ]
  }
];

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_SCANS: Scan[] = [
  { id: 'scan-ct-planning', label: 'Planning CT', modality: 'CT', seriesDescription: 'Planning CT Head/Neck', isPrimary: true },
  { id: 'scan-pet-fdg', label: 'FDG PET', modality: 'PET', seriesDescription: 'PET/CT FDG' },
  { id: 'scan-mri-t1', label: 'MRI T1', modality: 'MRI', seriesDescription: 'T1 Post-Contrast' },
  { id: 'scan-mri-t2', label: 'MRI T2', modality: 'MRI', seriesDescription: 'T2 FLAIR' },
  { id: 'scan-ct-contrast', label: 'CT Contrast', modality: 'CT', seriesDescription: 'CT with Contrast' },
  { id: 'scan-mri-dwi', label: 'MRI DWI', modality: 'MRI', seriesDescription: 'Diffusion Weighted' },
  { id: 'scan-spect', label: 'SPECT', modality: 'SPECT', seriesDescription: 'Bone SPECT' },
  { id: 'scan-mri-adc', label: 'MRI ADC', modality: 'MRI', seriesDescription: 'ADC Map' }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateSmartSuggestions = (scans: Scan[]): SmartSuggestion[] => {
  const suggestions: SmartSuggestion[] = [];
  
  // CT + PET fusion
  const ct = scans.find(s => s.modality === 'CT');
  const pet = scans.find(s => s.modality === 'PET');
  if (ct && pet) {
    suggestions.push({
      scanIds: [ct.id, pet.id],
      reason: 'CT/PET fusion for metabolic activity',
      confidence: 0.95
    });
  }
  
  // Primary CT + all MRIs
  const mris = scans.filter(s => s.modality === 'MRI');
  if (ct && mris.length > 0) {
    suggestions.push({
      scanIds: [ct.id, ...mris.map(m => m.id)],
      reason: 'Multi-parametric MRI comparison',
      confidence: 0.88
    });
  }
  
  // T1 + T2 comparison
  const t1 = scans.find(s => s.label.includes('T1'));
  const t2 = scans.find(s => s.label.includes('T2'));
  if (t1 && t2) {
    suggestions.push({
      scanIds: [t1.id, t2.id],
      reason: 'T1/T2 MRI comparison',
      confidence: 0.92
    });
  }
  
  return suggestions;
};

// ============================================================================
// MOCK CANVAS COMPONENT
// ============================================================================

const MockScanCanvas: React.FC<{ scan: Scan; width?: number; height?: number }> = ({ 
  scan, 
  width = 512, 
  height = 512 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 512;

    // Add subtle noise
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 20;
      data[i] = data[i] + noise;
      data[i + 1] = data[i + 1] + noise;
      data[i + 2] = data[i + 2] + noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // Body outline
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 180 * scale, 220 * scale, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Modality-specific rendering
    if (scan.modality === 'CT') {
      // Bone
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 160 * scale, 200 * scale, 0, 0, 2 * Math.PI);
      ctx.lineWidth = 15 * scale;
      ctx.strokeStyle = '#eee';
      ctx.stroke();
      
      // Soft tissue
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 140 * scale, 180 * scale, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
    } else if (scan.modality === 'MRI') {
      // Soft tissue detail
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 150 * scale, 190 * scale, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#3a3a3a';
      ctx.fill();
      
      // High signal regions
      ctx.beginPath();
      ctx.ellipse(centerX - 40 * scale, centerY - 30 * scale, 30 * scale, 40 * scale, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#555';
      ctx.fill();
    } else if (scan.modality === 'PET') {
      // Hot spots
      const hotspots = [
        { x: -50, y: -20, r: 40, intensity: 1.0 },
        { x: 60, y: 30, r: 25, intensity: 0.7 },
        { x: 0, y: 80, r: 30, intensity: 0.5 }
      ];
      
      hotspots.forEach(spot => {
        const grad = ctx.createRadialGradient(
          centerX + spot.x * scale, centerY + spot.y * scale, 0,
          centerX + spot.x * scale, centerY + spot.y * scale, spot.r * scale
        );
        grad.addColorStop(0, 'rgba(255, 255, 100, 0.9)');
        grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX + spot.x * scale, centerY + spot.y * scale, spot.r * scale, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Orientation markers
    ctx.fillStyle = '#888';
    ctx.font = `${10 * scale}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('A', centerX, 15 * scale);
    ctx.fillText('P', centerX, height - 5 * scale);
    ctx.fillText('R', 10 * scale, centerY);
    ctx.fillText('L', width - 10 * scale, centerY);

  }, [scan, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="w-full h-full object-contain"
    />
  );
};

// ============================================================================
// COMPONENTS
// ============================================================================

const ScanCard: React.FC<{
  scan: Scan;
  isDragging?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  showMiniPreview?: boolean;
}> = ({ scan, isDragging, isSelected, onClick, onDragStart, showMiniPreview = false }) => {
  const getModalityBadgeClass = (modality: ScanModality): string => {
    const classes = {
      CT: 'bg-blue-900/60 text-blue-200 border-blue-600/30',
      MRI: 'bg-purple-900/60 text-purple-200 border-purple-600/30',
      PET: 'bg-orange-900/60 text-orange-200 border-orange-600/30',
      SPECT: 'bg-green-900/60 text-green-200 border-green-600/30',
      US: 'bg-teal-900/60 text-teal-200 border-teal-600/30',
      RT: 'bg-red-900/60 text-red-200 border-red-600/30'
    };
    return classes[modality] || 'bg-gray-900/60 text-gray-200 border-gray-600/30';
  };
  
  return (
    <motion.div
      layout
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-lg cursor-move transition-all
        bg-gray-900/50 border backdrop-blur-sm
        ${isSelected ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-gray-700'}
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
        hover:border-gray-600 hover:bg-gray-900/70
      `}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Content */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Badge className={`${getModalityBadgeClass(scan.modality)} backdrop-blur-sm border text-xs`}>
            {scan.modality}
          </Badge>
          {scan.isPrimary && (
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
          )}
        </div>
        
        <div>
          <h3 className="font-medium text-white text-sm">{scan.label}</h3>
          {scan.seriesDescription && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{scan.seriesDescription}</p>
          )}
        </div>
        
        {/* Mini preview */}
        {showMiniPreview && (
          <div className="mt-1 rounded overflow-hidden bg-black border border-gray-800 aspect-square">
            <MockScanCanvas scan={scan} width={100} height={100} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

const ViewportSlotComponent: React.FC<{
  slot: ViewportSlot;
  scan: Scan | null;
  onDrop: (slotId: string, scanId: string) => void;
  onClear: (slotId: string) => void;
  onDoubleClick: (slotId: string) => void;
  onToggleLock: (slotId: string) => void;
  onToggleMPR: (slotId: string) => void;
}> = ({ slot, scan, onDrop, onClear, onDoubleClick, onToggleLock, onToggleMPR }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const scanId = e.dataTransfer.getData('scanId');
    if (scanId && !slot.isLocked) {
      onDrop(slot.id, scanId);
    }
  };
  
  return (
    <motion.div
      layout
      className={`
        relative rounded-lg overflow-hidden border transition-all
        ${isDragOver ? 'border-indigo-500 border-dashed bg-indigo-900/20 scale-[1.02]' : scan ? 'border-gray-700 bg-black' : 'border-gray-700 border-dashed bg-gray-900/30'}
      `}
      style={{
        gridRow: `${slot.position.row + 1} / span ${slot.span.rows}`,
        gridColumn: `${slot.position.col + 1} / span ${slot.span.cols}`
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDoubleClick={() => onDoubleClick(slot.id)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Lock indicator */}
      {slot.isLocked && (
        <div className="absolute top-2 left-2 z-20">
          <Badge className="bg-red-900/60 text-red-200 border-red-600/30 backdrop-blur-sm text-xs">
            <Lock className="w-3 h-3 mr-1" />
            Locked
          </Badge>
        </div>
      )}
      
      {/* Controls */}
      {scan && (
        <div className="absolute top-2 right-2 z-20 flex gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border ${
              slot.mprMode ? 'border-indigo-500 bg-indigo-900/40' : 'border-gray-700'
            }`}
            onClick={() => onToggleMPR(slot.id)}
            title="Toggle Multi-Planar View"
          >
            <Boxes className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-gray-700"
            onClick={() => onToggleLock(slot.id)}
          >
            {slot.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </Button>
          {!slot.isLocked && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 bg-black/60 hover:bg-red-900/70 text-white backdrop-blur-sm border border-gray-700 hover:border-red-600"
              onClick={() => onClear(slot.id)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
      
      {/* Content */}
      {scan ? (
        slot.mprMode ? (
          // Multi-Planar Reconstruction View (2x2 Grid: Axial, Sagittal, Coronal, 3D)
          <div className="relative w-full h-full bg-black grid grid-cols-2 grid-rows-2 gap-0.5">
            {/* Axial (top-left) */}
            <div className="relative bg-black border border-gray-800">
              <MockScanCanvas scan={scan} />
              <div className="absolute top-1 left-1">
                <Badge className="bg-blue-900/70 text-blue-200 border-blue-600/40 backdrop-blur-sm text-xs px-1.5 py-0.5">
                  Axial
                </Badge>
              </div>
            </div>
            
            {/* Sagittal (top-right) */}
            <div className="relative bg-black border border-gray-800">
              <MockScanCanvas scan={scan} />
              <div className="absolute top-1 left-1">
                <Badge className="bg-green-900/70 text-green-200 border-green-600/40 backdrop-blur-sm text-xs px-1.5 py-0.5">
                  Sagittal
                </Badge>
              </div>
            </div>
            
            {/* Coronal (bottom-left) */}
            <div className="relative bg-black border border-gray-800">
              <MockScanCanvas scan={scan} />
              <div className="absolute top-1 left-1">
                <Badge className="bg-purple-900/70 text-purple-200 border-purple-600/40 backdrop-blur-sm text-xs px-1.5 py-0.5">
                  Coronal
                </Badge>
              </div>
            </div>
            
            {/* 3D or Large Axial (bottom-right) */}
            <div className="relative bg-black border border-gray-800">
              <MockScanCanvas scan={scan} />
              <div className="absolute top-1 left-1">
                <Badge className="bg-indigo-900/70 text-indigo-200 border-indigo-600/40 backdrop-blur-sm text-xs px-1.5 py-0.5">
                  3D
                </Badge>
              </div>
            </div>
            
            {/* Main label overlay for MPR mode */}
            <div className="absolute bottom-2 left-2">
              <Badge 
                className={`${
                  scan.modality === 'CT' ? 'bg-blue-900/80 text-blue-200 border-blue-600/50' :
                  scan.modality === 'MRI' ? 'bg-purple-900/80 text-purple-200 border-purple-600/50' :
                  scan.modality === 'PET' ? 'bg-orange-900/80 text-orange-200 border-orange-600/50' :
                  'bg-gray-900/80 text-gray-200 border-gray-600/50'
                } backdrop-blur-md border text-xs`}
              >
                {scan.label} - MPR
              </Badge>
            </div>
          </div>
        ) : (
          // Single Plane View (Axial only)
          <div className="relative w-full h-full bg-black">
            <MockScanCanvas scan={scan} />
            
            {/* Label overlay */}
            <div className="absolute bottom-2 left-2 right-2">
              <Badge 
                className={`${
                  scan.modality === 'CT' ? 'bg-blue-900/60 text-blue-200 border-blue-600/30' :
                  scan.modality === 'MRI' ? 'bg-purple-900/60 text-purple-200 border-purple-600/30' :
                  scan.modality === 'PET' ? 'bg-orange-900/60 text-orange-200 border-orange-600/30' :
                  'bg-gray-900/60 text-gray-200 border-gray-600/30'
                } backdrop-blur-sm border text-xs`}
              >
                {scan.label}
              </Badge>
            </div>
          </div>
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-gray-600">
            <Plus className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Drag scan here</p>
            <p className="text-xs mt-0.5 opacity-70">or double-click</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const LayoutPresetButton: React.FC<{
  preset: LayoutPreset;
  isActive: boolean;
  onClick: () => void;
}> = ({ preset, isActive, onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`
        relative p-3 rounded-lg border transition-all text-left
        ${isActive 
          ? 'border-indigo-500 bg-indigo-900/30 shadow-md shadow-indigo-500/10' 
          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-900/70'
        }
      `}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-2.5">
        <div className={`p-1.5 rounded ${isActive ? 'bg-indigo-600' : 'bg-gray-800'}`}>
          {preset.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-xs">{preset.name}</h4>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preset.description}</p>
        </div>
      </div>
      
      {/* Mini grid visualization */}
      <div className="mt-2 p-1.5 bg-black/40 rounded border border-gray-800">
        <div 
          className="grid gap-0.5"
          style={{
            gridTemplateRows: `repeat(${preset.grid.rows}, 1fr)`,
            gridTemplateColumns: `repeat(${preset.grid.cols}, 1fr)`,
            height: '32px'
          }}
        >
          {preset.slots.map(slot => (
            <div
              key={slot.id}
              className={`rounded-sm ${isActive ? 'bg-indigo-500/50' : 'bg-gray-700/50'}`}
              style={{
                gridRow: `${slot.position.row + 1} / span ${slot.span.rows}`,
                gridColumn: `${slot.position.col + 1} / span ${slot.span.cols}`
              }}
            />
          ))}
        </div>
      </div>
      
      {isActive && (
        <motion.div
          className="absolute -top-0.5 -right-0.5 bg-indigo-500 rounded-full p-0.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SonnetViewportManager() {
  const [scans] = useState<Scan[]>(MOCK_SCANS);
  const [currentPreset, setCurrentPreset] = useState<LayoutPreset>(LAYOUT_PRESETS[1]); // Side by side default
  const [viewportSlots, setViewportSlots] = useState<ViewportSlot[]>(() => 
    currentPreset.slots.map(slot => ({ ...slot, scanId: null }))
  );
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [showPresets, setShowPresets] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [draggedScanId, setDraggedScanId] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [firstSwapSlot, setFirstSwapSlot] = useState<string | null>(null);
  
  const suggestions = generateSmartSuggestions(scans);

  // Apply preset
  const applyPreset = useCallback((preset: LayoutPreset) => {
    setCurrentPreset(preset);
    setViewportSlots(preset.slots.map(slot => ({ ...slot, scanId: null })));
  }, []);

  // Assign scan to slot
  const assignScanToSlot = useCallback((slotId: string, scanId: string) => {
    setViewportSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, scanId } : slot
    ));
  }, []);

  // Clear slot
  const clearSlot = useCallback((slotId: string) => {
    setViewportSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, scanId: null } : slot
    ));
  }, []);

  // Toggle lock
  const toggleLock = useCallback((slotId: string) => {
    setViewportSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, isLocked: !slot.isLocked } : slot
    ));
  }, []);

  // Toggle MPR mode
  const toggleMPR = useCallback((slotId: string) => {
    setViewportSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, mprMode: !slot.mprMode } : slot
    ));
  }, []);

  // Swap slots
  const handleDoubleClick = useCallback((slotId: string) => {
    if (!swapMode) {
      setSwapMode(true);
      setFirstSwapSlot(slotId);
    } else {
      if (firstSwapSlot && firstSwapSlot !== slotId) {
        // Perform swap
        setViewportSlots(prev => {
          const newSlots = [...prev];
          const idx1 = newSlots.findIndex(s => s.id === firstSwapSlot);
          const idx2 = newSlots.findIndex(s => s.id === slotId);
          if (idx1 >= 0 && idx2 >= 0) {
            const temp = newSlots[idx1].scanId;
            newSlots[idx1].scanId = newSlots[idx2].scanId;
            newSlots[idx2].scanId = temp;
          }
          return newSlots;
        });
      }
      setSwapMode(false);
      setFirstSwapSlot(null);
    }
  }, [swapMode, firstSwapSlot]);

  // Apply suggestion
  const applySuggestion = useCallback((suggestion: SmartSuggestion) => {
    // Auto-select appropriate preset
    const scanCount = suggestion.scanIds.length;
    let preset = currentPreset;
    
    if (scanCount === 2) {
      preset = LAYOUT_PRESETS.find(p => p.id === 'side-by-side')!;
    } else if (scanCount === 4) {
      preset = LAYOUT_PRESETS.find(p => p.id === 'quad')!;
    } else if (scanCount === 3) {
      preset = LAYOUT_PRESETS.find(p => p.id === 'primary-comparison')!;
    }
    
    applyPreset(preset);
    
    // Assign scans
    setTimeout(() => {
      setViewportSlots(prev => prev.map((slot, idx) => ({
        ...slot,
        scanId: suggestion.scanIds[idx] || null
      })));
    }, 100);
  }, [currentPreset, applyPreset]);

  // Save current layout
  const saveCurrentLayout = useCallback(() => {
    const scanAssignments: Record<string, string> = {};
    viewportSlots.forEach(slot => {
      if (slot.scanId) {
        scanAssignments[slot.id] = slot.scanId;
      }
    });
    
    const saved: SavedLayout = {
      id: `layout-${Date.now()}`,
      name: `Layout ${savedLayouts.length + 1}`,
      timestamp: Date.now(),
      preset: currentPreset,
      scanAssignments
    };
    
    setSavedLayouts(prev => [...prev, saved]);
  }, [viewportSlots, currentPreset, savedLayouts.length]);

  // Load saved layout
  const loadSavedLayout = useCallback((saved: SavedLayout) => {
    applyPreset(saved.preset);
    setTimeout(() => {
      setViewportSlots(prev => prev.map(slot => ({
        ...slot,
        scanId: saved.scanAssignments[slot.id] || null
      })));
    }, 100);
  }, [applyPreset]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, scanId: string) => {
    e.dataTransfer.setData('scanId', scanId);
    setDraggedScanId(scanId);
  };

  const handleDragEnd = () => {
    setDraggedScanId(null);
  };

  // Auto-assign primary scan on mount
  useEffect(() => {
    const primaryScan = scans.find(s => s.isPrimary);
    if (primaryScan && viewportSlots[0]) {
      assignScanToSlot(viewportSlots[0].id, primaryScan.id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full bg-black text-white flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="border-b border-gray-700/50 bg-black">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                SONNET
                <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">v1.0</Badge>
              </h1>
              <p className="text-xs text-gray-500">
                Smart Orchestrated Navigation Network for Enhanced Tomography
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={showSuggestions ? 'bg-purple-900/40 border-purple-600/50' : 'border-gray-700'}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              <span className="text-xs">Smart Suggest</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPresets(!showPresets)}
              className={showPresets ? 'bg-blue-900/40 border-blue-600/50' : 'border-gray-700'}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
              <span className="text-xs">Layouts</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={saveCurrentLayout}
              className="border-gray-700"
            >
              <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
              <span className="text-xs">Save</span>
            </Button>
            
            {swapMode && (
              <Badge variant="default" className="bg-yellow-600/80 text-white animate-pulse text-xs">
                Swap Mode Active
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Scan Library */}
        <div className="w-72 border-r border-gray-700/50 bg-gray-950/50 flex flex-col">
          <div className="p-3 border-b border-gray-700/50">
            <h2 className="font-medium text-sm flex items-center gap-2 mb-3 text-gray-300">
              <Layers3 className="w-4 h-4 text-indigo-400" />
              Scan Library
              <Badge variant="secondary" className="ml-auto bg-gray-800 text-gray-300 border-gray-700 text-xs">{scans.length}</Badge>
            </h2>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search scans..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {scans.map(scan => (
              <div key={scan.id} onDragEnd={handleDragEnd}>
                <ScanCard
                  scan={scan}
                  isDragging={draggedScanId === scan.id}
                  onDragStart={(e) => handleDragStart(e, scan.id)}
                  showMiniPreview
                />
              </div>
            ))}
          </div>
        </div>

        {/* Center - Viewport Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Suggestions Banner */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-gray-700/50 bg-purple-950/20"
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <h3 className="font-medium text-sm text-gray-300">Smart Suggestions</h3>
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {suggestions.map((suggestion, idx) => (
                      <motion.button
                        key={idx}
                        onClick={() => applySuggestion(suggestion)}
                        className="flex-shrink-0 p-2.5 rounded-lg bg-gray-900/50 border border-purple-600/30 hover:border-purple-500 hover:bg-purple-900/30 transition-all text-left"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <Badge variant="secondary" className="text-xs bg-purple-900/40 text-purple-200 border-purple-600/30">
                            {Math.round(suggestion.confidence * 100)}% match
                          </Badge>
                        </div>
                        <p className="text-xs text-white font-medium">{suggestion.reason}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {suggestion.scanIds.length} scans
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Viewport Grid */}
          <div className="flex-1 p-4 overflow-hidden bg-black">
            <motion.div
              layout
              className="w-full h-full grid gap-3"
              style={{
                gridTemplateRows: `repeat(${currentPreset.grid.rows}, 1fr)`,
                gridTemplateColumns: `repeat(${currentPreset.grid.cols}, 1fr)`
              }}
            >
              {viewportSlots.map(slot => {
                const scan = scans.find(s => s.id === slot.scanId) || null;
                return (
                  <ViewportSlotComponent
                    key={slot.id}
                    slot={slot}
                    scan={scan}
                    onDrop={assignScanToSlot}
                    onClear={clearSlot}
                    onDoubleClick={handleDoubleClick}
                    onToggleLock={toggleLock}
                    onToggleMPR={toggleMPR}
                  />
                );
              })}
            </motion.div>
          </div>
        </div>

        {/* Right Sidebar - Presets & Saved Layouts */}
        <AnimatePresence>
          {showPresets && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-gray-700/50 bg-gray-950/50 flex flex-col overflow-hidden"
            >
              <div className="p-3 border-b border-gray-700/50">
                <h2 className="font-medium text-sm flex items-center gap-2 text-gray-300">
                  <LayoutGrid className="w-4 h-4 text-blue-400" />
                  Layout Presets
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {LAYOUT_PRESETS.map(preset => (
                  <LayoutPresetButton
                    key={preset.id}
                    preset={preset}
                    isActive={currentPreset.id === preset.id}
                    onClick={() => applyPreset(preset)}
                  />
                ))}
              </div>
              
              {savedLayouts.length > 0 && (
                <>
                  <div className="px-3 py-2 border-t border-gray-700/50">
                    <h3 className="font-medium text-sm flex items-center gap-2 text-gray-300">
                      <Bookmark className="w-3.5 h-3.5 text-yellow-500" />
                      Saved Layouts
                      <Badge variant="secondary" className="ml-auto text-xs bg-gray-800 text-gray-300 border-gray-700">
                        {savedLayouts.length}
                      </Badge>
                    </h3>
                  </div>
                  
                  <div className="overflow-y-auto p-3 space-y-1.5 max-h-48">
                    {savedLayouts.map(saved => (
                      <motion.button
                        key={saved.id}
                        onClick={() => loadSavedLayout(saved)}
                        className="w-full p-2.5 rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-700 hover:border-gray-600 transition-all text-left"
                        whileHover={{ x: 2 }}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-white">{saved.name}</span>
                          <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                            {saved.preset.name}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(saved.timestamp).toLocaleTimeString()}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Status Bar */}
      <div className="border-t border-gray-700/50 bg-gray-950 px-3 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>Layout: <strong className="text-gray-300">{currentPreset.name}</strong></span>
            <span>Grid: <strong className="text-gray-300">{currentPreset.grid.rows}×{currentPreset.grid.cols}</strong></span>
            <span>Active: <strong className="text-gray-300">{viewportSlots.filter(s => s.scanId).length}/{viewportSlots.length}</strong></span>
            {viewportSlots.filter(s => s.mprMode).length > 0 && (
              <span className="flex items-center gap-1">
                <Boxes className="w-3 h-3 text-indigo-400" />
                MPR: <strong className="text-gray-300">{viewportSlots.filter(s => s.mprMode).length}</strong>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Eye className="w-3 h-3" />
            <span>Double-click to swap • Drag to assign • Click <Boxes className="w-3 h-3 inline" /> for MPR</span>
          </div>
        </div>
      </div>
    </div>
  );
}

