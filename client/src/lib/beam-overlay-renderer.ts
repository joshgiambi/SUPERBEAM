/**
 * Beam Overlay Renderer
 * 
 * Renders radiation beam overlays on CT slices - only when slice is near isocenter
 * Based on clinical TPS behavior where beams only appear on relevant slices
 */

import type { BeamSummary, BEVProjection } from '@/types/rt-plan';
import { getBeamColor } from '@/types/rt-plan';

const DEG_TO_RAD = Math.PI / 180;

// Colors
const ISOCENTER_COLOR = '#FF0000';
const BEAM_LINE_COLOR = '#FFFF00';

export interface SliceGeometry {
  slicePosition: number;
  orientation: 'axial' | 'coronal' | 'sagittal';
  imagePosition: [number, number, number];
  pixelSpacing: [number, number];
  dimensions: { width: number; height: number };
}

export interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface BeamOverlayOptions {
  opacity?: number;
  showFieldOutline?: boolean;
  showIsocenter?: boolean;
  showBeamDirection?: boolean;
  showLabels?: boolean;
  selectedBeamNumber?: number | null;
  lineWidth?: number;
  arrowLength?: number;
  /** Tolerance in mm for showing beam on slice (default 10mm) */
  sliceTolerance?: number;
}

/**
 * Check if a slice is near the isocenter (within tolerance)
 */
function isSliceNearIsocenter(
  isocenter: [number, number, number],
  slice: SliceGeometry,
  tolerance: number
): boolean {
  const [ix, iy, iz] = isocenter;
  
  if (slice.orientation === 'axial') {
    // For axial, check Z distance
    return Math.abs(iz - slice.slicePosition) <= tolerance;
  } else if (slice.orientation === 'coronal') {
    // For coronal, check Y distance  
    return Math.abs(iy - slice.slicePosition) <= tolerance;
  } else {
    // For sagittal, check X distance
    return Math.abs(ix - slice.slicePosition) <= tolerance;
  }
}

/**
 * Convert patient coordinates to image pixels
 */
function patientToImagePixels(
  point: [number, number, number],
  slice: SliceGeometry
): { x: number; y: number } {
  const [px, py, pz] = point;
  const [ipx, ipy, ipz] = slice.imagePosition;
  const [rowSpacing, colSpacing] = slice.pixelSpacing;

  if (slice.orientation === 'axial') {
    return {
      x: (px - ipx) / colSpacing,
      y: (py - ipy) / rowSpacing,
    };
  } else if (slice.orientation === 'coronal') {
    return {
      x: (px - ipx) / colSpacing,
      y: (ipz - pz) / rowSpacing,
    };
  } else {
    return {
      x: (py - ipy) / colSpacing,
      y: (ipz - pz) / rowSpacing,
    };
  }
}

/**
 * Convert image pixels to canvas coordinates
 */
function imageToCanvas(
  pos: { x: number; y: number },
  transform: CanvasTransform
): { x: number; y: number } {
  return {
    x: transform.offsetX + pos.x * transform.scale,
    y: transform.offsetY + pos.y * transform.scale,
  };
}

/**
 * Calculate beam direction for display
 */
function getBeamDirection(
  gantryAngle: number,
  couchAngle: number,
  orientation: 'axial' | 'coronal' | 'sagittal'
): { dx: number; dy: number } {
  const gRad = gantryAngle * DEG_TO_RAD;
  const cRad = couchAngle * DEG_TO_RAD;

  // IEC 61217: Gantry 0° = beam from anterior (Y+), 90° = from left (X+)
  const bx = Math.cos(cRad) * Math.sin(gRad);
  const by = -Math.cos(gRad);
  const bz = Math.sin(cRad) * Math.sin(gRad);

  let dx: number, dy: number;
  if (orientation === 'axial') {
    dx = bx;
    dy = by;
  } else if (orientation === 'coronal') {
    dx = bx;
    dy = -bz;
  } else {
    dx = by;
    dy = -bz;
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0.001) {
    dx /= len;
    dy /= len;
  }
  return { dx, dy };
}

/**
 * Main draw function - only draws beams near current slice
 */
export function drawBeamOverlay(
  ctx: CanvasRenderingContext2D,
  beams: BeamSummary[],
  bevProjections: BEVProjection[],
  slice: SliceGeometry,
  transform: CanvasTransform,
  options: BeamOverlayOptions = {}
): void {
  const {
    opacity = 0.9,
    showIsocenter = true,
    showBeamDirection = true,
    showLabels = true,
    selectedBeamNumber = null,
    lineWidth = 2,
    sliceTolerance = 15,  // Only show beams within 15mm of slice
  } = options;

  if (!beams?.length || !bevProjections?.length) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Track which isocenters are on this slice
  const visibleIsocenters = new Map<string, { x: number; y: number; selected: boolean }>();

  // Process each beam
  bevProjections.forEach((bev, index) => {
    const beam = beams.find(b => b.beamNumber === bev.beamNumber);
    if (!beam) return;

    // CRITICAL: Only show beam if current slice is near the isocenter
    if (!isSliceNearIsocenter(bev.isocenterPosition, slice, sliceTolerance)) {
      return;  // Skip this beam - it's not on this slice
    }

    const isSelected = selectedBeamNumber === bev.beamNumber;
    const color = getBeamColor(index);

    // Convert isocenter to canvas coordinates
    const isoImgPx = patientToImagePixels(bev.isocenterPosition, slice);
    const isoCanvas = imageToCanvas(isoImgPx, transform);

    // Skip if way outside canvas
    if (isoCanvas.x < -100 || isoCanvas.x > ctx.canvas.width + 100 ||
        isoCanvas.y < -100 || isoCanvas.y > ctx.canvas.height + 100) {
      return;
    }

    // Store isocenter
    const isoKey = bev.isocenterPosition.map(v => v.toFixed(1)).join(',');
    if (!visibleIsocenters.has(isoKey) || isSelected) {
      visibleIsocenters.set(isoKey, { x: isoCanvas.x, y: isoCanvas.y, selected: isSelected });
    }

    // Draw beam line
    if (showBeamDirection) {
      drawBeamLine(ctx, bev, isoCanvas, isoImgPx, slice, transform, color, isSelected, lineWidth);
    }

    // Draw arc path for VMAT beams
    if (bev.isArc && bev.finalGantryAngle !== undefined) {
      drawArcPath(ctx, bev, isoCanvas, isoImgPx, slice, transform, color, isSelected, lineWidth);
    }

    // Draw label
    if (showLabels) {
      drawLabel(ctx, bev, isoCanvas, slice.orientation, color, isSelected);
    }
  });

  // Draw isocenter markers for visible isocenters
  if (showIsocenter) {
    for (const iso of visibleIsocenters.values()) {
      drawIsocenter(ctx, iso.x, iso.y, iso.selected ? 8 : 6);
    }
  }

  ctx.restore();
}

/**
 * Draw beam direction line
 */
function drawBeamLine(
  ctx: CanvasRenderingContext2D,
  bev: BEVProjection,
  isoCanvas: { x: number; y: number },
  isoImgPx: { x: number; y: number },
  slice: SliceGeometry,
  transform: CanvasTransform,
  color: string,
  isSelected: boolean,
  lineWidth: number
): void {
  const { dx, dy } = getBeamDirection(bev.gantryAngle, bev.couchAngle, slice.orientation);

  // Calculate line length based on image bounds
  const maxLen = Math.min(
    isoImgPx.x, slice.dimensions.width - isoImgPx.x,
    isoImgPx.y, slice.dimensions.height - isoImgPx.y
  );
  const lineLen = Math.max(maxLen * 0.6, 50) * transform.scale;

  // Entry point (source side)
  const entryX = isoCanvas.x - dx * lineLen;
  const entryY = isoCanvas.y - dy * lineLen;

  // Exit point
  const exitX = isoCanvas.x + dx * lineLen * 0.5;
  const exitY = isoCanvas.y + dy * lineLen * 0.5;

  // Draw entry line
  ctx.strokeStyle = color;
  ctx.lineWidth = isSelected ? lineWidth + 1 : lineWidth;
  ctx.beginPath();
  ctx.moveTo(entryX, entryY);
  ctx.lineTo(isoCanvas.x, isoCanvas.y);
  ctx.stroke();

  // Arrowhead at isocenter
  const angle = Math.atan2(dy, dx);
  const headLen = isSelected ? 12 : 9;
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

  // Exit line (dashed)
  ctx.setLineDash([5, 5]);
  ctx.globalAlpha *= 0.5;
  ctx.beginPath();
  ctx.moveTo(isoCanvas.x, isoCanvas.y);
  ctx.lineTo(exitX, exitY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha *= 2;
}

/**
 * Draw arc path for VMAT
 */
function drawArcPath(
  ctx: CanvasRenderingContext2D,
  bev: BEVProjection,
  isoCanvas: { x: number; y: number },
  isoImgPx: { x: number; y: number },
  slice: SliceGeometry,
  transform: CanvasTransform,
  color: string,
  isSelected: boolean,
  lineWidth: number
): void {
  if (!bev.finalGantryAngle) return;

  const couchRad = bev.couchAngle * DEG_TO_RAD;
  
  // Arc radius
  const maxR = Math.min(
    isoImgPx.x, slice.dimensions.width - isoImgPx.x,
    isoImgPx.y, slice.dimensions.height - isoImgPx.y
  );
  const radius = Math.max(maxR * 0.5, 60) * transform.scale;

  let radiusX = radius, radiusY = radius, rotation = 0;
  
  if (slice.orientation === 'axial' && Math.abs(bev.couchAngle) > 1) {
    radiusY = radius * Math.abs(Math.cos(couchRad));
    rotation = -couchRad;
  } else if (slice.orientation === 'coronal') {
    radiusY = Math.max(radius * Math.abs(Math.sin(couchRad)), radius * 0.2);
  } else if (slice.orientation === 'sagittal') {
    radiusX = Math.max(radius * Math.abs(Math.sin(couchRad)), radius * 0.2);
  }

  // Calculate sweep
  const dir = bev.gantryRotationDirection || 'CW';
  let sweep = bev.finalGantryAngle - bev.gantryAngle;
  if (dir === 'CW' && sweep < 0) sweep += 360;
  if (dir === 'CC' && sweep > 0) sweep -= 360;

  const startA = (bev.gantryAngle - 90) * DEG_TO_RAD;
  const endA = startA + sweep * DEG_TO_RAD;

  ctx.save();
  ctx.translate(isoCanvas.x, isoCanvas.y);
  ctx.rotate(rotation);

  // Arc
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = isSelected ? lineWidth + 1 : lineWidth;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, startA, endA, sweep < 0);
  ctx.stroke();

  // Start dot
  ctx.fillStyle = '#00FFFF';
  ctx.beginPath();
  ctx.arc(radiusX * Math.cos(startA), radiusY * Math.sin(startA), 4, 0, Math.PI * 2);
  ctx.fill();

  // End arrow
  const endX = radiusX * Math.cos(endA);
  const endY = radiusY * Math.sin(endA);
  const tang = endA + (sweep >= 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - 10 * Math.cos(tang - 0.4), endY - 10 * Math.sin(tang - 0.4));
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - 10 * Math.cos(tang + 0.4), endY - 10 * Math.sin(tang + 0.4));
  ctx.stroke();

  // Avoidance sectors
  if (bev.avoidanceSectors?.length) {
    ctx.strokeStyle = '#FF6B6B';
    ctx.setLineDash([6, 4]);
    for (const s of bev.avoidanceSectors) {
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX + 6, radiusY + 6, 0, (s.startAngle - 90) * DEG_TO_RAD, (s.endAngle - 90) * DEG_TO_RAD);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Draw beam label
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  bev: BEVProjection,
  isoCanvas: { x: number; y: number },
  orientation: 'axial' | 'coronal' | 'sagittal',
  color: string,
  isSelected: boolean
): void {
  const { dx, dy } = getBeamDirection(bev.gantryAngle, bev.couchAngle, orientation);
  
  // Position label along beam entry direction
  const dist = isSelected ? 90 : 70;
  const lx = isoCanvas.x - dx * dist;
  const ly = isoCanvas.y - dy * dist;

  // Text
  const isArc = bev.isArc && bev.finalGantryAngle;
  const text = isArc 
    ? `${bev.beamName} (${Math.abs(bev.finalGantryAngle! - bev.gantryAngle).toFixed(0)}°)`
    : `${bev.beamName} G${bev.gantryAngle.toFixed(0)}°`;

  ctx.save();
  ctx.translate(lx, ly);
  
  // Rotate to follow beam direction, keeping text readable
  let rot = Math.atan2(dy, dx) + Math.PI / 2;
  if (rot > Math.PI / 2) rot -= Math.PI;
  if (rot < -Math.PI / 2) rot += Math.PI;
  ctx.rotate(rot);

  ctx.font = isSelected ? 'bold 13px system-ui' : '11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const w = ctx.measureText(text).width + 10;
  
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(-w / 2, -10, w, 20);
  ctx.strokeStyle = color;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeRect(-w / 2, -10, w, 20);

  // Text
  ctx.fillStyle = isSelected ? '#FFFFFF' : color;
  ctx.fillText(text, 0, 0);

  ctx.restore();
}

/**
 * Draw isocenter marker
 */
function drawIsocenter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.strokeStyle = ISOCENTER_COLOR;
  ctx.lineWidth = 2;

  // Circle
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair
  const len = size * 1.6;
  ctx.beginPath();
  ctx.moveTo(x - len, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x, y - len);
  ctx.lineTo(x, y + len);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = ISOCENTER_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Check if slice is near isocenter (exported for external use)
 */
export function sliceIntersectsIsocenter(
  slice: SliceGeometry,
  isocenter: [number, number, number],
  tolerance: number = 15
): boolean {
  return isSliceNearIsocenter(isocenter, slice, tolerance);
}
