/**
 * Fusion Editor Popup Prototype v2.0
 * 
 * A comprehensive fusion registration editing system inspired by professional 
 * applications like MIM Maestro, Varian Eclipse, and RayStation.
 * 
 * Features:
 * - Side-by-side synchronized viewports (Primary CT + Secondary)
 * - Professional evaluation tools: Swipe, Spyglass, Flicker, Checkerboard, etc.
 * - Manual translation/rotation adjustments
 * - Automatic registration placeholders (Rigid, Contour-based, Landmark)
 * - MPR multi-planar views
 * - Contour overlay from RT structures
 * - Registration quality metrics
 * - Undo/Redo history
 * - Keyboard shortcuts
 * 
 * Designed for radiation oncology workflow where accurate image fusion
 * is critical for treatment planning.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
  Grid3X3,
  Crosshair,
  Layers,
  Move,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
  SplitSquareHorizontal,
  Blend,
  CheckSquare,
  SunMedium,
  Info,
  AlertTriangle,
  Check,
  History,
  Sparkles,
  Target,
  Link,
  Link2Off,
  Hand,
  Diff,
  Play,
  Pause,
  Circle,
  Square,
  Scan,
  Wand2,
  Cpu,
  Box,
  Layers3,
  Magnet,
  Milestone,
  Gauge,
  FlipHorizontal,
  FlipVertical,
  Palette,
  Thermometer,
  Activity,
  Undo2,
  Redo2,
  MousePointer,
  GripHorizontal,
  Ruler,
  Pencil,
  CircleDot,
  Hexagon,
  Brain,
  Bone,
  Heart,
  Zap,
  RefreshCw,
  Settings2,
  ChevronDown as ChevronDownIcon,
  MoreHorizontal,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface TransformState {
  translation: Vector3;  // in mm
  rotation: Vector3;     // in degrees
  scale: Vector3;        // scaling factor (1.0 = no scale)
}

interface SeriesInfo {
  id: number;
  modality: string;
  description: string;
  sliceCount: number;
  sliceThickness: number;
  spacing: [number, number];
}

interface Landmark {
  id: string;
  name: string;
  primaryPosition: Vector3;
  secondaryPosition: Vector3 | null;
  color: string;
}

interface RTStructure {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  type: 'target' | 'oar' | 'external' | 'other';
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  transform: TransformState;
  description: string;
}

interface RegistrationMetrics {
  mutualInformation: number;
  normalizedCrossCorrelation: number;
  meanSquaredError: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

// Evaluation/comparison modes - inspired by MIM, Eclipse, RayStation
type EvaluationMode = 
  | 'overlay'           // Standard opacity blend
  | 'checkerboard'      // Alternating pattern
  | 'swipe'             // Horizontal/vertical curtain
  | 'spyglass'          // Circular lens showing secondary
  | 'flicker'           // Auto-toggle between images
  | 'difference'        // Subtraction/difference view
  | 'edges'             // Edge detection overlay
  | 'colorFusion'       // Color-coded channels (CT=cyan, MR=orange)
  | 'subtraction'       // Mathematical subtraction
  | 'jacobian';         // Deformation grid visualization

type ViewportTool = 'pan' | 'zoom' | 'crosshair' | 'translate' | 'landmark' | 'measure' | 'windowLevel';
type ViewPlane = 'axial' | 'sagittal' | 'coronal';
type AutoRegistrationType = 'rigid' | 'contourBased' | 'landmarkBased' | 'intensityBased' | 'deformable';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_PRIMARY: SeriesInfo = {
  id: 54,
  modality: 'CT',
  description: 'Head_Neck C+ 2.0mm',
  sliceCount: 287,
  sliceThickness: 2.0,
  spacing: [0.488, 0.488],
};

const MOCK_SECONDARY: SeriesInfo = {
  id: 50,
  modality: 'MR',
  description: 'T1 AXIAL POST GAD',
  sliceCount: 192,
  sliceThickness: 3.0,
  spacing: [0.469, 0.469],
};

const INITIAL_TRANSFORM: TransformState = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

const MOCK_STRUCTURES: RTStructure[] = [
  { id: 'gtv', name: 'GTV', color: '#ff4444', visible: true, type: 'target' },
  { id: 'ctv', name: 'CTV', color: '#ff8844', visible: true, type: 'target' },
  { id: 'ptv', name: 'PTV', color: '#ffaa44', visible: false, type: 'target' },
  { id: 'brainstem', name: 'Brainstem', color: '#44ff44', visible: true, type: 'oar' },
  { id: 'spinalcord', name: 'Spinal Cord', color: '#4444ff', visible: true, type: 'oar' },
  { id: 'parotid_l', name: 'Parotid L', color: '#ff44ff', visible: false, type: 'oar' },
  { id: 'parotid_r', name: 'Parotid R', color: '#44ffff', visible: false, type: 'oar' },
  { id: 'external', name: 'External', color: '#888888', visible: false, type: 'external' },
];

const MOCK_LANDMARKS: Landmark[] = [
  { id: 'lm1', name: 'Landmark 1', primaryPosition: { x: 120, y: 150, z: 100 }, secondaryPosition: { x: 122, y: 148, z: 101 }, color: '#ff6b6b' },
  { id: 'lm2', name: 'Landmark 2', primaryPosition: { x: 200, y: 180, z: 100 }, secondaryPosition: { x: 198, y: 182, z: 99 }, color: '#4ecdc4' },
  { id: 'lm3', name: 'Landmark 3', primaryPosition: { x: 160, y: 220, z: 100 }, secondaryPosition: null, color: '#ffe66d' },
];

const WINDOW_PRESETS = {
  CT: [
    { label: 'Soft Tissue', window: 400, level: 40, icon: Heart },
    { label: 'Lung', window: 1500, level: -600, icon: Activity },
    { label: 'Bone', window: 1800, level: 400, icon: Bone },
    { label: 'Brain', window: 80, level: 40, icon: Brain },
  ],
  MR: [
    { label: 'T1', window: 600, level: 300, icon: Circle },
    { label: 'T2', window: 2000, level: 1000, icon: CircleDot },
    { label: 'FLAIR', window: 1800, level: 900, icon: Hexagon },
  ],
  PT: [
    { label: 'Standard', window: 20000, level: 10000, icon: Zap },
    { label: 'High SUV', window: 30000, level: 15000, icon: Thermometer },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getModalityColor = (modality: string): string => {
  const mod = modality?.toUpperCase() || '';
  if (mod === 'PT' || mod === 'PET') return 'amber';
  if (mod === 'MR' || mod === 'MRI') return 'purple';
  if (mod === 'CT') return 'cyan';
  return 'gray';
};

const formatNumber = (val: number, decimals: number = 1): string => {
  return val.toFixed(decimals);
};

const getQualityColor = (quality: string): string => {
  switch (quality) {
    case 'excellent': return 'text-green-400';
    case 'good': return 'text-cyan-400';
    case 'fair': return 'text-amber-400';
    case 'poor': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

// ============================================================================
// NUMERIC INPUT COMPONENT
// ============================================================================

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  unit?: string;
  color?: 'red' | 'green' | 'blue' | 'amber';
  compact?: boolean;
}

function NumericInput({ 
  value, onChange, min = -100, max = 100, step = 0.5, 
  label, unit = 'mm', color = 'blue', compact = false 
}: NumericInputProps) {
  const colorClasses = {
    red: 'border-red-500/30 focus:border-red-400 text-red-300',
    green: 'border-green-500/30 focus:border-green-400 text-green-300',
    blue: 'border-blue-500/30 focus:border-blue-400 text-blue-300',
    amber: 'border-amber-500/30 focus:border-amber-400 text-amber-300',
  }[color];

  const labelColorClass = {
    red: 'text-red-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
  }[color];

  return (
    <div className="flex items-center gap-1">
      <span className={cn("text-xs font-bold w-4 text-center", labelColorClass)}>{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={formatNumber(value)}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))}
        step={step}
        className={cn(
          "h-6 px-1.5 rounded bg-gray-900/60 border text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-offset-0",
          compact ? "w-12" : "w-14",
          colorClasses
        )}
      />
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
      {!compact && <span className="text-[10px] text-gray-500">{unit}</span>}
    </div>
  );
}

// ============================================================================
// EVALUATION MODE BUTTON COMPONENT
// ============================================================================

interface EvalModeButtonProps {
  mode: EvaluationMode;
  currentMode: EvaluationMode;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  shortcut?: string;
}

function EvalModeButton({ mode, currentMode, onClick, icon, label, description, shortcut }: EvalModeButtonProps) {
  const isActive = mode === currentMode;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all min-w-[48px]",
            isActive
              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/10"
              : "bg-gray-900/40 border-gray-700/50 text-gray-400 hover:bg-gray-800/60 hover:text-gray-300"
          )}
        >
          {icon}
          <span className="text-[8px] font-medium leading-tight">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-gray-900 border-gray-700 max-w-[200px]">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-gray-400">{description}</p>
        {shortcut && (
          <p className="text-[9px] text-gray-500 mt-1">
            <kbd className="px-1 py-0.5 bg-gray-800 rounded">{shortcut}</kbd>
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// AUTO REGISTRATION BUTTON COMPONENT
// ============================================================================

interface AutoRegButtonProps {
  type: AutoRegistrationType;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  isRunning?: boolean;
  disabled?: boolean;
}

function AutoRegButton({ type, onClick, icon, label, description, isRunning = false, disabled = false }: AutoRegButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled || isRunning}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full",
            isRunning
              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
              : disabled
              ? "bg-gray-800/30 border-gray-700/30 text-gray-600 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-purple-500/30 text-purple-300 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10"
          )}
        >
          {isRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            icon
          )}
          <div className="flex-1 text-left">
            <div className="text-xs font-semibold">{label}</div>
            <div className="text-[9px] text-gray-500">{description}</div>
          </div>
          {!isRunning && <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="bg-gray-900 border-gray-700 max-w-[250px]">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-gray-400 mt-1">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// MOCK VIEWPORT CANVAS - Simulated DICOM Display
// ============================================================================

interface ViewportCanvasProps {
  series: SeriesInfo;
  isPrimary?: boolean;
  sliceIndex: number;
  evalMode: EvaluationMode;
  blendOpacity: number;
  showGrid: boolean;
  showCrosshair: boolean;
  showContours: boolean;
  transform?: TransformState;
  secondarySeries?: SeriesInfo | null;
  viewportTool: ViewportTool;
  isLinked: boolean;
  viewPlane: ViewPlane;
  swipePosition?: number;
  spyglassPosition?: { x: number; y: number };
  flickerState?: boolean;
  structures?: RTStructure[];
  landmarks?: Landmark[];
}

function ViewportCanvas({ 
  series, 
  isPrimary = false, 
  sliceIndex, 
  evalMode, 
  blendOpacity, 
  showGrid, 
  showCrosshair,
  showContours,
  transform,
  secondarySeries,
  viewportTool,
  isLinked,
  viewPlane,
  swipePosition = 50,
  spyglassPosition,
  flickerState,
  structures = [],
  landmarks = [],
}: ViewportCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = getModalityColor(series.modality);
  
  // Draw mock DICOM with grid, crosshair, and overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear and fill background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Flicker mode - show appropriate image
    if (evalMode === 'flicker' && !isPrimary && !flickerState) {
      return; // Don't draw secondary in flicker off state
    }
    
    // Draw gradient based on modality
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, width / 2
    );
    
    if (series.modality === 'CT') {
      gradient.addColorStop(0, '#2a4a6a');
      gradient.addColorStop(0.6, '#1a2a3a');
      gradient.addColorStop(1, '#0a1520');
    } else if (series.modality === 'MR') {
      gradient.addColorStop(0, '#4a2a6a');
      gradient.addColorStop(0.6, '#2a1a3a');
      gradient.addColorStop(1, '#150a20');
    } else {
      gradient.addColorStop(0, '#6a4a2a');
      gradient.addColorStop(0.6, '#3a2a1a');
      gradient.addColorStop(1, '#201510');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Simulate anatomy shapes based on view plane
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffffff';
    
    if (viewPlane === 'axial') {
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, 120, 100, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (viewPlane === 'sagittal') {
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, 80, 120, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, 100, 120, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Apply transform offset for secondary
    if (transform && !isPrimary) {
      ctx.translate(transform.translation.x * 2, transform.translation.y * 2);
      ctx.rotate((transform.rotation.z * Math.PI) / 180);
    }
    
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2 - 20, 60, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Draw swipe/curtain effect
    if (evalMode === 'swipe' && !isPrimary) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, (width * swipePosition) / 100, height);
      ctx.restore();
    }
    
    // Draw spyglass effect
    if (evalMode === 'spyglass' && spyglassPosition && !isPrimary) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(spyglassPosition.x, spyglassPosition.y, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Draw spyglass border
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(spyglassPosition.x, spyglassPosition.y, 60, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw checkerboard pattern
    if (evalMode === 'checkerboard' && !isPrimary) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      const checkerSize = 30;
      for (let x = 0; x < width; x += checkerSize) {
        for (let y = 0; y < height; y += checkerSize) {
          if ((Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0) {
            ctx.fillStyle = 'white';
            ctx.fillRect(x, y, checkerSize, checkerSize);
          }
        }
      }
      ctx.restore();
    }
    
    // Draw contours
    if (showContours && structures.length > 0) {
      ctx.save();
      structures.filter(s => s.visible).forEach((structure) => {
        ctx.strokeStyle = structure.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        
        // Draw mock contour based on structure type
        ctx.beginPath();
        if (structure.type === 'target') {
          ctx.ellipse(width / 2 + 20, height / 2 - 10, 30, 25, 0, 0, Math.PI * 2);
        } else if (structure.type === 'oar') {
          ctx.ellipse(width / 2 - 40, height / 2 + 30, 20, 15, 0.3, 0, Math.PI * 2);
        }
        ctx.stroke();
      });
      ctx.restore();
    }
    
    // Draw landmarks
    if (landmarks.length > 0) {
      ctx.save();
      landmarks.forEach((lm) => {
        const pos = isPrimary ? lm.primaryPosition : lm.secondaryPosition;
        if (!pos) return;
        
        // Simple mock - draw at fixed positions scaled to canvas
        const x = (pos.x / 300) * width;
        const y = (pos.y / 300) * height;
        
        ctx.fillStyle = lm.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        // Draw crosshair marker
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x, y + 8);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    
    // Draw grid overlay
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      
      for (let x = gridSize; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = gridSize; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    
    // Draw crosshair
    if (showCrosshair) {
      ctx.strokeStyle = isPrimary ? 'rgba(34, 211, 238, 0.6)' : 'rgba(192, 132, 252, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      
      ctx.setLineDash([]);
    }
    
  }, [series, isPrimary, sliceIndex, evalMode, blendOpacity, showGrid, showCrosshair, showContours, transform, viewPlane, swipePosition, spyglassPosition, flickerState, structures, landmarks]);
  
  const cursorClass = {
    pan: 'cursor-grab',
    zoom: 'cursor-zoom-in',
    crosshair: 'cursor-crosshair',
    translate: 'cursor-move',
    landmark: 'cursor-crosshair',
    measure: 'cursor-crosshair',
    windowLevel: 'cursor-ns-resize',
  }[viewportTool];
  
  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className={cn("w-full h-full rounded-lg", cursorClass)}
      />
      
      {/* Series badge */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
        <Badge className={cn(
          "text-[10px] font-semibold",
          color === 'cyan' ? 'bg-cyan-600/80 text-white border-cyan-400/50' :
          color === 'purple' ? 'bg-purple-600/80 text-white border-purple-400/50' :
          color === 'amber' ? 'bg-amber-600/80 text-white border-amber-400/50' :
          'bg-gray-600/80 text-white border-gray-400/50'
        )}>
          {series.modality} • {viewPlane.charAt(0).toUpperCase() + viewPlane.slice(1)}
        </Badge>
        
        <div className="flex items-center gap-1">
          {isLinked && (
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 bg-cyan-500/10 text-[9px]">
              <Link className="w-2.5 h-2.5 mr-1" />
              Linked
            </Badge>
          )}
        </div>
      </div>
      
      {/* Slice info */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <Badge variant="outline" className="border-gray-600/50 bg-gray-900/70 text-gray-300 text-[10px] backdrop-blur-sm">
          {sliceIndex} / {series.sliceCount}
        </Badge>
        <Badge variant="outline" className="border-gray-600/50 bg-gray-900/70 text-gray-300 text-[10px] backdrop-blur-sm">
          Z: {((sliceIndex - series.sliceCount / 2) * series.sliceThickness).toFixed(1)}mm
        </Badge>
      </div>
      
      {/* Transform indicator for secondary */}
      {!isPrimary && transform && (transform.translation.x !== 0 || transform.translation.y !== 0 || transform.translation.z !== 0) && (
        <div className="absolute top-10 left-2 flex flex-col gap-0.5">
          {transform.translation.x !== 0 && (
            <Badge className="bg-red-500/20 border-red-500/30 text-red-300 text-[8px]">
              ΔX: {transform.translation.x > 0 ? '+' : ''}{formatNumber(transform.translation.x)}
            </Badge>
          )}
          {transform.translation.y !== 0 && (
            <Badge className="bg-green-500/20 border-green-500/30 text-green-300 text-[8px]">
              ΔY: {transform.translation.y > 0 ? '+' : ''}{formatNumber(transform.translation.y)}
            </Badge>
          )}
          {transform.translation.z !== 0 && (
            <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-300 text-[8px]">
              ΔZ: {transform.translation.z > 0 ? '+' : ''}{formatNumber(transform.translation.z)}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REGISTRATION METRICS PANEL
// ============================================================================

function RegistrationMetricsPanel({ metrics }: { metrics: RegistrationMetrics }) {
  return (
    <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-gray-200">Registration Quality</span>
        <Badge className={cn(
          "ml-auto text-[9px]",
          metrics.quality === 'excellent' ? "bg-green-500/20 border-green-500/30 text-green-300" :
          metrics.quality === 'good' ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300" :
          metrics.quality === 'fair' ? "bg-amber-500/20 border-amber-500/30 text-amber-300" :
          "bg-red-500/20 border-red-500/30 text-red-300"
        )}>
          {metrics.quality.toUpperCase()}
        </Badge>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-1.5 rounded bg-gray-900/40">
          <div className="text-[9px] text-gray-500 uppercase">MI</div>
          <div className="text-xs font-mono text-gray-300">{metrics.mutualInformation.toFixed(3)}</div>
        </div>
        <div className="p-1.5 rounded bg-gray-900/40">
          <div className="text-[9px] text-gray-500 uppercase">NCC</div>
          <div className="text-xs font-mono text-gray-300">{metrics.normalizedCrossCorrelation.toFixed(3)}</div>
        </div>
        <div className="p-1.5 rounded bg-gray-900/40">
          <div className="text-[9px] text-gray-500 uppercase">MSE</div>
          <div className="text-xs font-mono text-gray-300">{metrics.meanSquaredError.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN FUSION EDITOR POPUP PROTOTYPE
// ============================================================================

export function FusionEditorPopupPrototype() {
  // State
  const [isOpen, setIsOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Transform state
  const [currentTransform, setCurrentTransform] = useState<TransformState>({ ...INITIAL_TRANSFORM });
  const [originalTransform] = useState<TransformState>({ ...INITIAL_TRANSFORM });
  
  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // View state
  const [sliceIndex, setSliceIndex] = useState(143);
  const [evalMode, setEvalMode] = useState<EvaluationMode>('overlay');
  const [blendOpacity, setBlendOpacity] = useState(0.5);
  const [showGrid, setShowGrid] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [isLinked, setIsLinked] = useState(true);
  const [viewportTool, setViewportTool] = useState<ViewportTool>('pan');
  const [viewPlane, setViewPlane] = useState<ViewPlane>('axial');
  
  // Swipe/Spyglass state
  const [swipePosition, setSwipePosition] = useState(50);
  const [spyglassPosition, setSpyglassPosition] = useState({ x: 200, y: 200 });
  
  // Flicker state
  const [flickerState, setFlickerState] = useState(true);
  const [flickerSpeed, setFlickerSpeed] = useState(500);
  const [isFlickering, setIsFlickering] = useState(false);
  
  // Structures and landmarks
  const [structures, setStructures] = useState<RTStructure[]>(MOCK_STRUCTURES);
  const [landmarks, setLandmarks] = useState<Landmark[]>(MOCK_LANDMARKS);
  
  // Auto registration state
  const [isAutoRegistering, setIsAutoRegistering] = useState(false);
  const [autoRegType, setAutoRegType] = useState<AutoRegistrationType | null>(null);
  
  // Window/Level state
  const [primaryWL, setPrimaryWL] = useState({ window: 400, level: 40 });
  const [secondaryWL, setSecondaryWL] = useState({ window: 600, level: 300 });
  
  // Panels state
  const [activePanel, setActivePanel] = useState<'transform' | 'autoReg' | 'structures' | 'landmarks'>('transform');
  
  // Mock metrics
  const [metrics] = useState<RegistrationMetrics>({
    mutualInformation: 0.847,
    normalizedCrossCorrelation: 0.923,
    meanSquaredError: 12.4,
    quality: 'good',
  });
  
  // Check if transform has changed
  const hasChanges = useMemo(() => {
    return (
      currentTransform.translation.x !== originalTransform.translation.x ||
      currentTransform.translation.y !== originalTransform.translation.y ||
      currentTransform.translation.z !== originalTransform.translation.z ||
      currentTransform.rotation.x !== originalTransform.rotation.x ||
      currentTransform.rotation.y !== originalTransform.rotation.y ||
      currentTransform.rotation.z !== originalTransform.rotation.z
    );
  }, [currentTransform, originalTransform]);
  
  // Handlers
  const addToHistory = useCallback((transform: TransformState, description: string) => {
    const entry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      timestamp: Date.now(),
      transform: { ...transform },
      description,
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), entry]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);
  
  const handleTransformChange = useCallback((newTransform: TransformState) => {
    setCurrentTransform(newTransform);
  }, []);
  
  const handleReset = useCallback(() => {
    setCurrentTransform({ ...originalTransform });
    addToHistory(originalTransform, 'Reset to original');
  }, [originalTransform, addToHistory]);
  
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setCurrentTransform({ ...history[historyIndex - 1].transform });
    }
  }, [history, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setCurrentTransform({ ...history[historyIndex + 1].transform });
    }
  }, [history, historyIndex]);
  
  const handleSave = useCallback(() => {
    console.log('Saving transform:', currentTransform);
    alert(`Registration saved!\n\nTranslation: (${currentTransform.translation.x}, ${currentTransform.translation.y}, ${currentTransform.translation.z}) mm\nRotation: (${currentTransform.rotation.x}, ${currentTransform.rotation.y}, ${currentTransform.rotation.z})°`);
  }, [currentTransform]);
  
  const handleSliceChange = useCallback((delta: number) => {
    setSliceIndex(prev => Math.max(1, Math.min(MOCK_PRIMARY.sliceCount, prev + delta)));
  }, []);
  
  // Auto registration handlers
  const handleAutoRegister = useCallback((type: AutoRegistrationType) => {
    setIsAutoRegistering(true);
    setAutoRegType(type);
    
    // Simulate registration process
    setTimeout(() => {
      // Apply mock transform based on type
      let newTransform = { ...currentTransform };
      
      if (type === 'rigid') {
        newTransform.translation = { x: -2.5, y: 1.8, z: -0.5 };
        newTransform.rotation = { x: 0, y: 0, z: 0.3 };
      } else if (type === 'contourBased') {
        newTransform.translation = { x: -1.2, y: 2.1, z: 0.3 };
        newTransform.rotation = { x: 0.1, y: -0.2, z: 0.5 };
      } else if (type === 'landmarkBased') {
        newTransform.translation = { x: -1.8, y: 1.5, z: 0 };
        newTransform.rotation = { x: 0, y: 0, z: 0.2 };
      }
      
      setCurrentTransform(newTransform);
      addToHistory(newTransform, `Auto ${type} registration`);
      setIsAutoRegistering(false);
      setAutoRegType(null);
    }, 2000);
  }, [currentTransform, addToHistory]);
  
  // Flicker effect
  useEffect(() => {
    if (evalMode === 'flicker' && isFlickering) {
      const interval = setInterval(() => {
        setFlickerState(prev => !prev);
      }, flickerSpeed);
      return () => clearInterval(interval);
    }
  }, [evalMode, isFlickering, flickerSpeed]);
  
  // Auto-start flicker when mode selected
  useEffect(() => {
    if (evalMode === 'flicker') {
      setIsFlickering(true);
    } else {
      setIsFlickering(false);
    }
  }, [evalMode]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowUp':
          if (e.shiftKey) handleSliceChange(10);
          else handleSliceChange(1);
          e.preventDefault();
          break;
        case 'ArrowDown':
          if (e.shiftKey) handleSliceChange(-10);
          else handleSliceChange(-1);
          e.preventDefault();
          break;
        case 'g':
          setShowGrid(prev => !prev);
          break;
        case 'c':
          setShowCrosshair(prev => !prev);
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) setEvalMode('swipe');
          break;
        case 'o':
          setEvalMode('overlay');
          break;
        case 'k':
          setEvalMode('checkerboard');
          break;
        case 'f':
          setEvalMode('flicker');
          break;
        case 'd':
          setEvalMode('difference');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) handleRedo();
            else handleUndo();
            e.preventDefault();
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSliceChange, handleUndo, handleRedo]);

  const updateTranslation = (axis: 'x' | 'y' | 'z', value: number) => {
    handleTransformChange({
      ...currentTransform,
      translation: { ...currentTransform.translation, [axis]: value },
    });
  };

  const updateRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    handleTransformChange({
      ...currentTransform,
      rotation: { ...currentTransform.rotation, [axis]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Design Notes Card */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Info className="w-4 h-4 text-blue-400" />
            Fusion Editor v2.0 - Professional Tools
          </CardTitle>
          <CardDescription className="text-xs text-gray-400">
            Enhanced with professional evaluation tools inspired by MIM Maestro, Eclipse, and RayStation.
            Includes 10 evaluation modes, automatic registration, landmark-based alignment, and quality metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2 text-[9px]">
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">Swipe/Curtain</Badge>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400">Spyglass Lens</Badge>
            <Badge variant="outline" className="border-green-500/30 text-green-400">Flicker/Blink</Badge>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400">Checkerboard</Badge>
            <Badge variant="outline" className="border-pink-500/30 text-pink-400">Color Fusion</Badge>
            <Badge variant="outline" className="border-red-500/30 text-red-400">Difference</Badge>
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">Auto Rigid</Badge>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400">Contour-Based</Badge>
            <Badge variant="outline" className="border-teal-500/30 text-teal-400">Landmark</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Toggle Button (when closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-purple-600/20 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400/50 transition-all flex items-center justify-center gap-2"
        >
          <Layers className="w-4 h-4" />
          Open Fusion Editor
        </button>
      )}

      {/* Main Editor Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "bg-gray-950/98 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden",
              isFullscreen ? "fixed inset-4 z-50" : "relative"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 bg-gradient-to-r from-gray-900/50 to-gray-800/30">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-lg border border-cyan-500/30">
                  <Layers className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Fusion Registration Editor</h2>
                  <p className="text-[10px] text-gray-500">
                    {MOCK_PRIMARY.modality} → {MOCK_SECONDARY.modality} • {MOCK_PRIMARY.description}
                  </p>
                </div>
              </div>
              
              {/* Undo/Redo and Status */}
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className={cn(
                          "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                          historyIndex > 0 ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-600 cursor-not-allowed"
                        )}
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Undo (⌘Z)</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className={cn(
                          "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                          historyIndex < history.length - 1 ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-600 cursor-not-allowed"
                        )}
                      >
                        <Redo2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <div className="w-px h-5 bg-gray-700" />
                
                {hasChanges && (
                  <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-300 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Unsaved
                  </Badge>
                )}
                
                {isAutoRegistering && (
                  <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-300 text-[10px] animate-pulse">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Registering...
                  </Badge>
                )}
                
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex h-[600px]">
              {/* Left Side - Viewports */}
              <div className="flex-1 p-3 flex flex-col gap-2">
                {/* Evaluation Mode Toolbar */}
                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-900/40 rounded-xl border border-gray-800/50">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Evaluation:</span>
                  <TooltipProvider delayDuration={150}>
                    <div className="flex gap-0.5">
                      <EvalModeButton
                        mode="overlay"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('overlay')}
                        icon={<Layers className="w-3.5 h-3.5" />}
                        label="Overlay"
                        description="Standard opacity blending"
                        shortcut="O"
                      />
                      <EvalModeButton
                        mode="swipe"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('swipe')}
                        icon={<GripHorizontal className="w-3.5 h-3.5" />}
                        label="Swipe"
                        description="Drag curtain to compare images"
                        shortcut="S"
                      />
                      <EvalModeButton
                        mode="spyglass"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('spyglass')}
                        icon={<Circle className="w-3.5 h-3.5" />}
                        label="Spyglass"
                        description="Circular lens to peek at secondary"
                      />
                      <EvalModeButton
                        mode="flicker"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('flicker')}
                        icon={<Zap className="w-3.5 h-3.5" />}
                        label="Flicker"
                        description="Rapid toggle between images"
                        shortcut="F"
                      />
                      <EvalModeButton
                        mode="checkerboard"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('checkerboard')}
                        icon={<CheckSquare className="w-3.5 h-3.5" />}
                        label="Checker"
                        description="Alternating checkerboard pattern"
                        shortcut="K"
                      />
                      <EvalModeButton
                        mode="difference"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('difference')}
                        icon={<Diff className="w-3.5 h-3.5" />}
                        label="Diff"
                        description="Highlight misalignment areas"
                        shortcut="D"
                      />
                      <EvalModeButton
                        mode="colorFusion"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('colorFusion')}
                        icon={<Palette className="w-3.5 h-3.5" />}
                        label="Color"
                        description="Color-coded channel fusion"
                      />
                      <EvalModeButton
                        mode="edges"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('edges')}
                        icon={<Hexagon className="w-3.5 h-3.5" />}
                        label="Edges"
                        description="Edge detection overlay"
                      />
                      <EvalModeButton
                        mode="subtraction"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('subtraction')}
                        icon={<Minus className="w-3.5 h-3.5" />}
                        label="Subtract"
                        description="Mathematical image subtraction"
                      />
                      <EvalModeButton
                        mode="jacobian"
                        currentMode={evalMode}
                        onClick={() => setEvalMode('jacobian')}
                        icon={<Grid3X3 className="w-3.5 h-3.5" />}
                        label="Grid"
                        description="Deformation grid visualization"
                      />
                    </div>
                  </TooltipProvider>
                  
                  {/* Mode-specific controls */}
                  {evalMode === 'flicker' && (
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                      <button
                        onClick={() => setIsFlickering(!isFlickering)}
                        className={cn(
                          "h-6 w-6 flex items-center justify-center rounded",
                          isFlickering ? "bg-green-500/20 text-green-400" : "bg-gray-800 text-gray-400"
                        )}
                      >
                        {isFlickering ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-500">Speed:</span>
                        <input
                          type="range"
                          min="100"
                          max="1000"
                          step="100"
                          value={1100 - flickerSpeed}
                          onChange={(e) => setFlickerSpeed(1100 - parseInt(e.target.value))}
                          className="w-16 h-1 bg-gray-700 rounded-full appearance-none"
                        />
                      </div>
                    </div>
                  )}
                  
                  {evalMode === 'overlay' && (
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                      <span className="text-[9px] text-gray-500">Opacity:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={blendOpacity * 100}
                        onChange={(e) => setBlendOpacity(parseInt(e.target.value) / 100)}
                        className="w-20 h-1 bg-gray-700 rounded-full appearance-none accent-purple-500"
                      />
                      <span className="text-[10px] text-purple-400 font-mono w-8">{Math.round(blendOpacity * 100)}%</span>
                    </div>
                  )}
                </div>
                
                {/* Viewport Toolbar */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-1">
                    <TooltipProvider delayDuration={150}>
                      {/* Tool Selection */}
                      {[
                        { tool: 'pan' as ViewportTool, icon: <Hand className="w-3.5 h-3.5" />, label: 'Pan' },
                        { tool: 'zoom' as ViewportTool, icon: <ZoomIn className="w-3.5 h-3.5" />, label: 'Zoom' },
                        { tool: 'windowLevel' as ViewportTool, icon: <SunMedium className="w-3.5 h-3.5" />, label: 'W/L' },
                        { tool: 'translate' as ViewportTool, icon: <Move className="w-3.5 h-3.5" />, label: 'Translate' },
                        { tool: 'landmark' as ViewportTool, icon: <Target className="w-3.5 h-3.5" />, label: 'Landmark' },
                        { tool: 'measure' as ViewportTool, icon: <Ruler className="w-3.5 h-3.5" />, label: 'Measure' },
                      ].map(({ tool, icon, label }) => (
                        <Tooltip key={tool}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setViewportTool(tool)}
                              className={cn(
                                "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                                viewportTool === tool ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "text-gray-400 hover:bg-white/10"
                              )}
                            >
                              {icon}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{label}</TooltipContent>
                        </Tooltip>
                      ))}
                      
                      <div className="w-px h-5 bg-gray-700/50 mx-1" />
                      
                      {/* View Toggles */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setShowGrid(!showGrid)}
                            className={cn(
                              "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                              showGrid ? "bg-green-500/20 text-green-400 border border-green-500/40" : "text-gray-400 hover:bg-white/10"
                            )}
                          >
                            <Grid3X3 className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Grid (G)</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setShowCrosshair(!showCrosshair)}
                            className={cn(
                              "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                              showCrosshair ? "bg-green-500/20 text-green-400 border border-green-500/40" : "text-gray-400 hover:bg-white/10"
                            )}
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Crosshair (C)</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setShowContours(!showContours)}
                            className={cn(
                              "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                              showContours ? "bg-green-500/20 text-green-400 border border-green-500/40" : "text-gray-400 hover:bg-white/10"
                            )}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Show Contours</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setIsLinked(!isLinked)}
                            className={cn(
                              "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                              isLinked ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "text-gray-400 hover:bg-white/10"
                            )}
                          >
                            {isLinked ? <Link className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{isLinked ? 'Linked' : 'Unlinked'}</TooltipContent>
                      </Tooltip>
                      
                      <div className="w-px h-5 bg-gray-700/50 mx-1" />
                      
                      {/* MPR View Plane */}
                      {['axial', 'sagittal', 'coronal'].map((plane) => (
                        <Tooltip key={plane}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setViewPlane(plane as ViewPlane)}
                              className={cn(
                                "h-7 px-2 flex items-center justify-center rounded-lg transition-colors text-[10px] font-medium",
                                viewPlane === plane ? "bg-purple-500/20 text-purple-400 border border-purple-500/40" : "text-gray-400 hover:bg-white/10"
                              )}
                            >
                              {plane.charAt(0).toUpperCase()}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{plane.charAt(0).toUpperCase() + plane.slice(1)}</TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                  
                  {/* Slice Navigation */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSliceChange(-10)} className="h-6 px-1.5 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/10">-10</button>
                    <button onClick={() => handleSliceChange(-1)} className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <Badge variant="outline" className="border-gray-600 bg-gray-900/50 text-white font-mono text-[10px] min-w-[70px] justify-center">
                      {sliceIndex} / {MOCK_PRIMARY.sliceCount}
                    </Badge>
                    <button onClick={() => handleSliceChange(1)} className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleSliceChange(10)} className="h-6 px-1.5 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/10">+10</button>
                  </div>
                </div>
                
                {/* Viewports */}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  {/* Primary Viewport */}
                  <div className="relative rounded-xl overflow-hidden border-2 border-cyan-500/30 bg-black">
                    <ViewportCanvas
                      series={MOCK_PRIMARY}
                      isPrimary={true}
                      sliceIndex={sliceIndex}
                      evalMode={evalMode}
                      blendOpacity={blendOpacity}
                      showGrid={showGrid}
                      showCrosshair={showCrosshair}
                      showContours={showContours}
                      viewportTool={viewportTool}
                      isLinked={isLinked}
                      viewPlane={viewPlane}
                      structures={structures}
                      landmarks={landmarks}
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1">
                      <span className="text-[9px] font-medium text-cyan-400">Primary (Reference)</span>
                    </div>
                  </div>
                  
                  {/* Secondary Viewport */}
                  <div className="relative rounded-xl overflow-hidden border-2 border-purple-500/30 bg-black">
                    <ViewportCanvas
                      series={MOCK_SECONDARY}
                      isPrimary={false}
                      sliceIndex={sliceIndex}
                      evalMode={evalMode}
                      blendOpacity={blendOpacity}
                      showGrid={showGrid}
                      showCrosshair={showCrosshair}
                      showContours={showContours}
                      transform={currentTransform}
                      secondarySeries={MOCK_SECONDARY}
                      viewportTool={viewportTool}
                      isLinked={isLinked}
                      viewPlane={viewPlane}
                      swipePosition={swipePosition}
                      spyglassPosition={spyglassPosition}
                      flickerState={flickerState}
                      structures={structures}
                      landmarks={landmarks}
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1">
                      <span className="text-[9px] font-medium text-purple-400">Secondary (Adjustable)</span>
                    </div>
                    
                    {/* Swipe handle */}
                    {evalMode === 'swipe' && (
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-cyan-400 cursor-ew-resize"
                        style={{ left: `${swipePosition}%` }}
                        onMouseDown={(e) => {
                          const startX = e.clientX;
                          const startPos = swipePosition;
                          const handleMove = (e: MouseEvent) => {
                            const delta = ((e.clientX - startX) / 400) * 100;
                            setSwipePosition(Math.max(0, Math.min(100, startPos + delta)));
                          };
                          const handleUp = () => {
                            document.removeEventListener('mousemove', handleMove);
                            document.removeEventListener('mouseup', handleUp);
                          };
                          document.addEventListener('mousemove', handleMove);
                          document.addEventListener('mouseup', handleUp);
                        }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center">
                          <GripHorizontal className="w-4 h-4 text-gray-900" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Registration Metrics */}
                <RegistrationMetricsPanel metrics={metrics} />
              </div>
              
              {/* Right Side - Controls Panel */}
              <div className="w-72 border-l border-gray-800/50 bg-gray-900/30 flex flex-col">
                {/* Panel Tabs */}
                <div className="flex border-b border-gray-800/50">
                  {[
                    { id: 'transform', label: 'Transform', icon: <Move className="w-3.5 h-3.5" /> },
                    { id: 'autoReg', label: 'Auto Reg', icon: <Wand2 className="w-3.5 h-3.5" /> },
                    { id: 'structures', label: 'Contours', icon: <Layers3 className="w-3.5 h-3.5" /> },
                    { id: 'landmarks', label: 'Landmarks', icon: <Target className="w-3.5 h-3.5" /> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActivePanel(tab.id as any)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors border-b-2",
                        activePanel === tab.id
                          ? "text-cyan-400 border-cyan-400 bg-cyan-500/5"
                          : "text-gray-500 border-transparent hover:text-gray-300"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
                
                {/* Panel Content */}
                <div className="flex-1 overflow-y-auto p-3">
                  {/* Transform Panel */}
                  {activePanel === 'transform' && (
                    <div className="space-y-3">
                      {/* Translation */}
                      <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Move className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-semibold text-gray-200">Translation (mm)</span>
                        </div>
                        <div className="space-y-1.5">
                          <NumericInput value={currentTransform.translation.x} onChange={(v) => updateTranslation('x', v)} label="X" color="red" compact />
                          <NumericInput value={currentTransform.translation.y} onChange={(v) => updateTranslation('y', v)} label="Y" color="green" compact />
                          <NumericInput value={currentTransform.translation.z} onChange={(v) => updateTranslation('z', v)} label="Z" color="blue" compact />
                        </div>
                        
                        {/* Quick nudge */}
                        <div className="flex items-center justify-center gap-1 pt-2">
                          <div className="grid grid-cols-3 gap-0.5">
                            <div />
                            <button onClick={() => updateTranslation('y', currentTransform.translation.y - 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-green-400">
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <div />
                            <button onClick={() => updateTranslation('x', currentTransform.translation.x - 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-red-400">
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button onClick={() => { updateTranslation('x', 0); updateTranslation('y', 0); updateTranslation('z', 0); }} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-cyan-700/60 text-gray-400 hover:text-cyan-400">
                              <Target className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => updateTranslation('x', currentTransform.translation.x + 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-red-400">
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            <div />
                            <button onClick={() => updateTranslation('y', currentTransform.translation.y + 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-green-400">
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <div />
                          </div>
                          <div className="flex flex-col gap-0.5 ml-2">
                            <button onClick={() => updateTranslation('z', currentTransform.translation.z + 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-blue-400 text-[8px] font-bold">+Z</button>
                            <button onClick={() => updateTranslation('z', currentTransform.translation.z - 1)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-blue-400 text-[8px] font-bold">-Z</button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Rotation */}
                      <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-semibold text-gray-200">Rotation (°)</span>
                        </div>
                        <div className="space-y-1.5">
                          <NumericInput value={currentTransform.rotation.x} onChange={(v) => updateRotation('x', v)} label="X" unit="°" color="red" min={-180} max={180} compact />
                          <NumericInput value={currentTransform.rotation.y} onChange={(v) => updateRotation('y', v)} label="Y" unit="°" color="green" min={-180} max={180} compact />
                          <NumericInput value={currentTransform.rotation.z} onChange={(v) => updateRotation('z', v)} label="Z" unit="°" color="blue" min={-180} max={180} compact />
                        </div>
                        <div className="flex gap-1 pt-1 flex-wrap">
                          {[-5, -1, 1, 5].map((deg) => (
                            <button
                              key={deg}
                              onClick={() => updateRotation('z', currentTransform.rotation.z + deg)}
                              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white border border-gray-700/50"
                            >
                              {deg > 0 ? '+' : ''}{deg}°
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Window/Level */}
                      <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <SunMedium className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-semibold text-gray-200">Window/Level</span>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[9px] text-cyan-400">Primary (CT)</span>
                          <div className="flex flex-wrap gap-1">
                            {WINDOW_PRESETS.CT.slice(0, 4).map((p) => (
                              <button key={p.label} onClick={() => setPrimaryWL({ window: p.window, level: p.level })}
                                className={cn("px-1.5 py-0.5 rounded text-[9px] border", primaryWL.window === p.window ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white")}
                              >{p.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[9px] text-purple-400">Secondary (MR)</span>
                          <div className="flex flex-wrap gap-1">
                            {WINDOW_PRESETS.MR.map((p) => (
                              <button key={p.label} onClick={() => setSecondaryWL({ window: p.window, level: p.level })}
                                className={cn("px-1.5 py-0.5 rounded text-[9px] border", secondaryWL.window === p.window ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white")}
                              >{p.label}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Auto Registration Panel */}
                  {activePanel === 'autoReg' && (
                    <div className="space-y-3">
                      <div className="text-[10px] text-gray-500 mb-2">
                        Select an automatic registration method. Results can be refined manually.
                      </div>
                      
                      <AutoRegButton
                        type="rigid"
                        onClick={() => handleAutoRegister('rigid')}
                        icon={<Cpu className="w-4 h-4" />}
                        label="Automatic Rigid Registration"
                        description="Mutual information-based alignment"
                        isRunning={isAutoRegistering && autoRegType === 'rigid'}
                        disabled={isAutoRegistering}
                      />
                      
                      <AutoRegButton
                        type="contourBased"
                        onClick={() => handleAutoRegister('contourBased')}
                        icon={<Layers3 className="w-4 h-4" />}
                        label="Contour-Based Registration"
                        description="Align using structure contours"
                        isRunning={isAutoRegistering && autoRegType === 'contourBased'}
                        disabled={isAutoRegistering}
                      />
                      
                      <AutoRegButton
                        type="landmarkBased"
                        onClick={() => handleAutoRegister('landmarkBased')}
                        icon={<Target className="w-4 h-4" />}
                        label="Landmark-Based Registration"
                        description="Align using anatomical landmarks"
                        isRunning={isAutoRegistering && autoRegType === 'landmarkBased'}
                        disabled={isAutoRegistering || landmarks.filter(l => l.secondaryPosition).length < 3}
                      />
                      
                      <AutoRegButton
                        type="intensityBased"
                        onClick={() => handleAutoRegister('intensityBased')}
                        icon={<Scan className="w-4 h-4" />}
                        label="Intensity-Based Registration"
                        description="Pixel value correlation matching"
                        isRunning={isAutoRegistering && autoRegType === 'intensityBased'}
                        disabled={isAutoRegistering}
                      />
                      
                      <div className="border-t border-gray-700/50 pt-3 mt-3">
                        <AutoRegButton
                          type="deformable"
                          onClick={() => handleAutoRegister('deformable')}
                          icon={<Box className="w-4 h-4" />}
                          label="Deformable Registration"
                          description="Non-rigid B-spline transformation"
                          isRunning={isAutoRegistering && autoRegType === 'deformable'}
                          disabled={isAutoRegistering}
                        />
                        <div className="text-[9px] text-amber-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Advanced - Use with caution
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Structures Panel */}
                  {activePanel === 'structures' && (
                    <div className="space-y-2">
                      <div className="text-[10px] text-gray-500 mb-2">
                        Toggle contour visibility for alignment verification.
                      </div>
                      {structures.map((structure) => (
                        <button
                          key={structure.id}
                          onClick={() => setStructures(prev => prev.map(s => s.id === structure.id ? { ...s, visible: !s.visible } : s))}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all",
                            structure.visible
                              ? "bg-gray-800/40 border-gray-700/50"
                              : "bg-gray-900/40 border-gray-800/50 opacity-50"
                          )}
                        >
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: structure.color }} />
                          <span className="text-xs text-gray-300 flex-1 text-left">{structure.name}</span>
                          {structure.visible ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                        </button>
                      ))}
                      <button className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Load RT Structure Set
                      </button>
                    </div>
                  )}
                  
                  {/* Landmarks Panel */}
                  {activePanel === 'landmarks' && (
                    <div className="space-y-2">
                      <div className="text-[10px] text-gray-500 mb-2">
                        Place corresponding landmarks on both images for alignment.
                      </div>
                      {landmarks.map((lm) => (
                        <div
                          key={lm.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/50"
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lm.color }} />
                          <span className="text-xs text-gray-300 flex-1">{lm.name}</span>
                          {lm.secondaryPosition ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Badge variant="outline" className="text-[8px] border-amber-500/30 text-amber-400">Needs Pair</Badge>
                          )}
                        </div>
                      ))}
                      <button className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Add Landmark
                      </button>
                      <div className="text-[9px] text-gray-500 text-center">
                        {landmarks.filter(l => l.secondaryPosition).length} / {landmarks.length} paired
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="p-3 border-t border-gray-800/50 space-y-2">
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className={cn(
                      "w-full h-9 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all",
                      hasChanges
                        ? "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-lg shadow-cyan-500/20"
                        : "bg-gray-800/50 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    <Save className="w-4 h-4" />
                    Save Registration
                  </button>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      disabled={!hasChanges}
                      className={cn(
                        "flex-1 h-8 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors border",
                        hasChanges ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20" : "bg-gray-800/30 border-gray-700/50 text-gray-500 cursor-not-allowed"
                      )}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors border bg-gray-800/30 border-gray-700/50 text-gray-400 hover:bg-gray-700/50 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer - Keyboard Shortcuts */}
            <div className="px-4 py-1.5 border-t border-gray-800/50 bg-gray-900/30 flex items-center justify-between text-[9px] text-gray-500">
              <div className="flex gap-3">
                <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">↑↓</kbd> Slices</span>
                <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">G</kbd> Grid</span>
                <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">C</kbd> Crosshair</span>
                <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">O</kbd><kbd className="px-1 py-0.5 bg-gray-800 rounded">S</kbd><kbd className="px-1 py-0.5 bg-gray-800 rounded">K</kbd><kbd className="px-1 py-0.5 bg-gray-800 rounded">F</kbd><kbd className="px-1 py-0.5 bg-gray-800 rounded">D</kbd> Eval modes</span>
                <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘Z</kbd> Undo</span>
              </div>
              <div className="text-gray-600">Superbeam Fusion Editor v2.0</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FusionEditorPopupPrototype;
