/**
 * Beam Overlay Renderer
 * 
 * Renders RT Plan beam geometry onto CT slice images (CIAO - CT Image And Overlay)
 * 
 * Features:
 * - Divergent field line projection from source through isocenter to slice plane
 * - MLC aperture outline at slice intersection
 * - Isocenter markers
 * - Beam direction indicators
 * - Support for all slice orientations (axial, coronal, sagittal)
 */

import {
  Vec3,
  vec3Subtract,
  vec3Normalize,
  vec3Scale,
  vec3Add,
  calculateSourcePosition,
  applyCollimatorRotation,
} from './rt-coordinate-transforms';
import type { BEVProjection, BeamSummary } from '@/types/rt-plan';

export interface SliceGeometry {
  /** Slice position in world coordinates (for axial: Z value, etc.) */
  slicePosition: number;
  /** Slice orientation */
  orientation: 'axial' | 'coronal' | 'sagittal';
  /** Image position (DICOM Image Position Patient) */
  imagePosition: Vec3;
  /** Pixel spacing [row spacing, column spacing] in mm */
  pixelSpacing: [number, number];
  /** Image dimensions in pixels */
  dimensions: { width: number; height: number };
  /** Image orientation vectors [row direction, column direction] */
  imageOrientation?: [Vec3, Vec3];
}

export interface BeamOverlayOptions {
  /** Opacity of the beam overlay (0-1) */
  opacity: number;
  /** Whether to draw field outline */
  showFieldOutline: boolean;
  /** Whether to draw isocenter marker */
  showIsocenter: boolean;
  /** Whether to draw beam direction arrow */
  showBeamDirection: boolean;
  /** Whether to draw beam label */
  showLabels: boolean;
  /** Highlight selected beam */
  selectedBeamNumber: number | null;
  /** Line width for field outline */
  lineWidth: number;
  /** Arrow length in pixels */
  arrowLength: number;
}

const DEFAULT_OPTIONS: BeamOverlayOptions = {
  opacity: 0.7,
  showFieldOutline: true,
  showIsocenter: true,
  showBeamDirection: true,
  showLabels: true,
  selectedBeamNumber: null,
  lineWidth: 2,
  arrowLength: 80,
};

const BEAM_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

/**
 * Get beam color by index
 */
export function getBeamColor(index: number): string {
  return BEAM_COLORS[index % BEAM_COLORS.length];
}

/**
 * Calculate where a ray from source through a point intersects a plane
 */
function rayPlaneIntersection(
  source: Vec3,
  point: Vec3,
  planeNormal: Vec3,
  planePoint: Vec3
): Vec3 | null {
  const rayDir = vec3Normalize(vec3Subtract(point, source));
  
  // Plane equation: dot(normal, P - planePoint) = 0
  // Ray: P = source + t * rayDir
  // t = dot(normal, planePoint - source) / dot(normal, rayDir)
  
  const denom = planeNormal[0] * rayDir[0] + planeNormal[1] * rayDir[1] + planeNormal[2] * rayDir[2];
  
  if (Math.abs(denom) < 1e-10) {
    return null; // Ray parallel to plane
  }
  
  const diff = vec3Subtract(planePoint, source);
  const t = (planeNormal[0] * diff[0] + planeNormal[1] * diff[1] + planeNormal[2] * diff[2]) / denom;
  
  if (t < 0) {
    return null; // Intersection behind source
  }
  
  return vec3Add(source, vec3Scale(rayDir, t));
}

/**
 * Convert world coordinates to pixel coordinates on a slice
 */
function worldToSlicePixels(
  worldPos: Vec3,
  slice: SliceGeometry
): { x: number; y: number } | null {
  const imgPos = slice.imagePosition;
  const spacing = slice.pixelSpacing;
  
  let x: number, y: number;
  
  switch (slice.orientation) {
    case 'axial':
      // For axial: X maps to columns, Y maps to rows
      x = (worldPos[0] - imgPos[0]) / spacing[1];
      y = (worldPos[1] - imgPos[1]) / spacing[0];
      break;
    case 'coronal':
      // For coronal: X maps to columns, Z maps to rows (inverted)
      x = (worldPos[0] - imgPos[0]) / spacing[1];
      y = (imgPos[2] - worldPos[2]) / spacing[0];
      break;
    case 'sagittal':
      // For sagittal: Y maps to columns, Z maps to rows (inverted)
      x = (worldPos[1] - imgPos[1]) / spacing[1];
      y = (imgPos[2] - worldPos[2]) / spacing[0];
      break;
    default:
      return null;
  }
  
  return { x, y };
}

/**
 * Get plane normal for slice orientation
 */
function getPlaneNormal(orientation: 'axial' | 'coronal' | 'sagittal'): Vec3 {
  switch (orientation) {
    case 'axial': return [0, 0, 1];
    case 'coronal': return [0, 1, 0];
    case 'sagittal': return [1, 0, 0];
  }
}

/**
 * Get plane point for slice
 */
function getPlanePoint(slice: SliceGeometry): Vec3 {
  switch (slice.orientation) {
    case 'axial':
      return [0, 0, slice.slicePosition];
    case 'coronal':
      return [0, slice.slicePosition, 0];
    case 'sagittal':
      return [slice.slicePosition, 0, 0];
  }
}

/**
 * Project field aperture corners from isocenter plane to slice plane
 */
function projectFieldToSlice(
  bev: BEVProjection,
  slice: SliceGeometry
): Array<{ x: number; y: number }> | null {
  const source = bev.sourcePosition;
  const iso = bev.isocenterPosition;
  const jaw = bev.jawAperture;
  const collAngle = bev.collimatorAngle;
  const gantryAngle = bev.gantryAngle;
  
  const planeNormal = getPlaneNormal(slice.orientation);
  const planePoint = getPlanePoint(slice);
  
  // Define corners of jaw aperture at isocenter plane (BEV coordinates)
  const bevCorners = [
    { x: jaw.x1, y: jaw.y1 },
    { x: jaw.x2, y: jaw.y1 },
    { x: jaw.x2, y: jaw.y2 },
    { x: jaw.x1, y: jaw.y2 },
  ];
  
  const gantryRad = (gantryAngle * Math.PI) / 180;
  const cosG = Math.cos(gantryRad);
  const sinG = Math.sin(gantryRad);
  
  const projectedCorners: Array<{ x: number; y: number }> = [];
  
  for (const corner of bevCorners) {
    // Apply collimator rotation in BEV space
    const rotated = applyCollimatorRotation(corner, collAngle);
    
    // Convert BEV coordinates to world coordinates at isocenter plane
    // BEV X is perpendicular to beam (crossline), BEV Y is along patient (inline/superior)
    // For gantry at 0° (AP beam): BEV X = patient X, BEV Y = patient Z
    const worldAtIso: Vec3 = [
      iso[0] + rotated.x * cosG,
      iso[1] + rotated.x * sinG,
      iso[2] + rotated.y, // BEV Y maps to patient Z
    ];
    
    // Project from source through this point to the slice plane
    const intersection = rayPlaneIntersection(
      source,
      worldAtIso,
      planeNormal,
      planePoint
    );
    
    if (!intersection) continue;
    
    // Convert to pixel coordinates
    const pixel = worldToSlicePixels(intersection, slice);
    if (pixel) {
      projectedCorners.push(pixel);
    }
  }
  
  return projectedCorners.length >= 3 ? projectedCorners : null;
}

/**
 * Draw beam overlay on a canvas
 */
export function drawBeamOverlay(
  ctx: CanvasRenderingContext2D,
  beams: BeamSummary[],
  bevProjections: BEVProjection[],
  slice: SliceGeometry,
  canvasTransform: {
    scale: number;
    offsetX: number;
    offsetY: number;
  },
  options: Partial<BeamOverlayOptions> = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  ctx.save();
  ctx.globalAlpha = opts.opacity;
  
  for (let i = 0; i < bevProjections.length; i++) {
    const bev = bevProjections[i];
    const beam = beams.find(b => b.beamNumber === bev.beamNumber);
    if (!beam) continue;
    
    const isSelected = opts.selectedBeamNumber === bev.beamNumber;
    const color = getBeamColor(i);
    
    // Transform coordinates from slice pixels to canvas
    const toCanvas = (p: { x: number; y: number }) => ({
      x: canvasTransform.offsetX + p.x * canvasTransform.scale,
      y: canvasTransform.offsetY + p.y * canvasTransform.scale,
    });
    
    // Convert isocenter to slice pixels
    const isoPixel = worldToSlicePixels(bev.isocenterPosition, slice);
    if (!isoPixel) continue;
    
    const isoCanvas = toCanvas(isoPixel);
    
    // Check if isocenter is within reasonable bounds
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    if (isoCanvas.x < -200 || isoCanvas.x > canvasWidth + 200 ||
        isoCanvas.y < -200 || isoCanvas.y > canvasHeight + 200) {
      continue;
    }
    
    // --- Draw field outline ---
    if (opts.showFieldOutline) {
      const fieldCorners = projectFieldToSlice(bev, slice);
      
      if (fieldCorners && fieldCorners.length >= 3) {
        ctx.beginPath();
        const first = toCanvas(fieldCorners[0]);
        ctx.moveTo(first.x, first.y);
        
        for (let j = 1; j < fieldCorners.length; j++) {
          const pt = toCanvas(fieldCorners[j]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        
        // Fill with semi-transparent color
        ctx.fillStyle = `${color}25`;
        ctx.fill();
        
        // Stroke outline
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? opts.lineWidth * 1.5 : opts.lineWidth;
        ctx.setLineDash(isSelected ? [] : [6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // --- Draw beam direction arrow ---
    if (opts.showBeamDirection) {
      const gantryRad = (bev.gantryAngle * Math.PI) / 180;
      
      // Calculate beam entry direction in 2D (projected onto slice)
      let beamDirX: number, beamDirY: number;
      
      switch (slice.orientation) {
        case 'axial':
          // For axial view, show beam direction in XY plane
          beamDirX = Math.sin(gantryRad);
          beamDirY = -Math.cos(gantryRad);
          break;
        case 'coronal':
          // For coronal view, project onto XZ plane
          beamDirX = Math.sin(gantryRad);
          beamDirY = 0; // Simplified - actual depends on gantry angle
          break;
        case 'sagittal':
          // For sagittal view, project onto YZ plane
          beamDirX = -Math.cos(gantryRad);
          beamDirY = 0;
          break;
      }
      
      const arrowLen = isSelected ? opts.arrowLength * 1.2 : opts.arrowLength;
      
      // Arrow from source direction to isocenter
      const entryX = isoCanvas.x - beamDirX * arrowLen;
      const entryY = isoCanvas.y - beamDirY * arrowLen;
      
      // Draw beam line
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : [8, 4]);
      ctx.beginPath();
      ctx.moveTo(entryX, entryY);
      ctx.lineTo(isoCanvas.x, isoCanvas.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw arrowhead at isocenter
      const headLen = isSelected ? 15 : 10;
      const angle = Math.atan2(isoCanvas.y - entryY, isoCanvas.x - entryX);
      ctx.beginPath();
      ctx.moveTo(isoCanvas.x, isoCanvas.y);
      ctx.lineTo(
        isoCanvas.x - headLen * Math.cos(angle - Math.PI / 6),
        isoCanvas.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(isoCanvas.x, isoCanvas.y);
      ctx.lineTo(
        isoCanvas.x - headLen * Math.cos(angle + Math.PI / 6),
        isoCanvas.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
      
      // Exit indicator (dashed, lighter)
      ctx.globalAlpha = opts.opacity * 0.5;
      ctx.setLineDash([4, 4]);
      const exitX = isoCanvas.x + beamDirX * (arrowLen * 0.5);
      const exitY = isoCanvas.y + beamDirY * (arrowLen * 0.5);
      ctx.beginPath();
      ctx.moveTo(isoCanvas.x, isoCanvas.y);
      ctx.lineTo(exitX, exitY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = opts.opacity;
    }
    
    // --- Draw isocenter marker ---
    if (opts.showIsocenter) {
      // Outer ring
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(isoCanvas.x, isoCanvas.y, isSelected ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(isoCanvas.x, isoCanvas.y, isSelected ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // --- Draw label ---
    if (opts.showLabels && (isSelected || beams.length <= 6)) {
      ctx.font = isSelected ? 'bold 12px system-ui' : '10px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      const labelText = `${bev.beamName} (G${bev.gantryAngle.toFixed(0)}°)`;
      const gantryRad = (bev.gantryAngle * Math.PI) / 180;
      const labelOffset = opts.arrowLength + 15;
      
      let labelX: number, labelY: number;
      switch (slice.orientation) {
        case 'axial':
          labelX = isoCanvas.x - Math.sin(gantryRad) * labelOffset;
          labelY = isoCanvas.y + Math.cos(gantryRad) * labelOffset - 5;
          break;
        default:
          labelX = isoCanvas.x;
          labelY = isoCanvas.y - labelOffset;
      }
      
      // Background for readability
      const metrics = ctx.measureText(labelText);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        labelX - metrics.width / 2 - 4,
        labelY - 14,
        metrics.width + 8,
        18
      );
      
      ctx.fillStyle = color;
      ctx.fillText(labelText, labelX, labelY);
    }
  }
  
  ctx.restore();
}

/**
 * Check if a beam intersects with the current slice
 */
export function beamIntersectsSlice(
  bev: BEVProjection,
  slice: SliceGeometry,
  tolerance: number = 50 // mm tolerance for considering beam relevance
): boolean {
  const iso = bev.isocenterPosition;
  
  switch (slice.orientation) {
    case 'axial':
      return Math.abs(iso[2] - slice.slicePosition) <= tolerance;
    case 'coronal':
      return Math.abs(iso[1] - slice.slicePosition) <= tolerance;
    case 'sagittal':
      return Math.abs(iso[0] - slice.slicePosition) <= tolerance;
  }
}

export default {
  drawBeamOverlay,
  beamIntersectsSlice,
  getBeamColor,
};
