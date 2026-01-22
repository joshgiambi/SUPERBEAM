/**
 * BEV (Beam's Eye View) Renderer
 * 
 * Provides clinical-grade canvas rendering for:
 * - Jaw aperture
 * - MLC leaf positions with variable widths
 * - Wedges and blocks
 * - Projected structures (OARs/targets)
 * - DRR background
 * - Orientation labels and scale
 * - Crosshairs and grid
 */

import { MLCApertureLeaf, calculateMLCAperture, detectMLCModel } from './MLCModels';
import { getBEVOrientationLabels, getBeamDirectionName } from './IEC61217';

export interface BEVRenderOptions {
  // Canvas dimensions
  width: number;
  height: number;
  
  // Scaling
  pixelsPerMm?: number; // If not provided, auto-calculated
  
  // Appearance
  backgroundColor?: string;
  fieldColor?: string;
  jawColor?: string;
  mlcOpenColor?: string;
  mlcClosedColor?: string;
  crosshairColor?: string;
  gridColor?: string;
  
  // Features
  showCrosshairs?: boolean;
  showGrid?: boolean;
  showScale?: boolean;
  showOrientationLabels?: boolean;
  showLeafBoundaries?: boolean;
  showLeafNumbers?: boolean;
  
  // Opacity
  fieldOpacity?: number;
  mlcOpacity?: number;
  drrOpacity?: number;
  structureOpacity?: number;
}

export interface BEVData {
  // Beam identification
  beamName: string;
  beamNumber: number;
  
  // Angles
  gantryAngle: number;
  collimatorAngle: number;
  couchAngle: number;
  
  // Source geometry
  sourceAxisDistance: number;
  
  // Jaw aperture (at isocenter, in mm)
  jawAperture: {
    x1: number; // Left jaw (typically negative)
    x2: number; // Right jaw (typically positive)
    y1: number; // Bottom jaw (typically negative)
    y2: number; // Top jaw (typically positive)
  };
  
  // MLC data (optional)
  mlcAperture?: {
    leafPairCount: number;
    leafWidth: number;
    leaves: Array<{
      y: number; // Y center position
      width: number; // Leaf width
      x1: number; // Bank A position
      x2: number; // Bank B position
    }>;
    leafBoundaries?: number[]; // For accurate positioning
  };
  
  // Wedge (optional)
  wedge?: {
    type: string;
    angle: number;
    orientation: number; // Degrees from Y+ axis
  };
  
  // Block (optional)
  block?: {
    type: string;
    points: Array<{ x: number; y: number }>;
  };
  
  // Control point info
  controlPointIndex?: number;
  totalControlPoints?: number;
  cumulativeMetersetWeight?: number;
}

export interface ProjectedStructure {
  roiNumber: number;
  structureName: string;
  color: [number, number, number];
  projectedContours: Array<Array<{ x: number; y: number }>>;
}

const DEFAULT_OPTIONS: BEVRenderOptions = {
  width: 400,
  height: 400,
  backgroundColor: '#0a0a0f',
  fieldColor: '#3b82f6',
  jawColor: 'rgba(0, 0, 0, 0.9)',
  mlcOpenColor: 'rgba(59, 130, 246, 0.3)',
  mlcClosedColor: 'rgba(10, 10, 20, 0.95)',
  crosshairColor: 'rgba(255, 255, 0, 0.6)',
  gridColor: 'rgba(60, 60, 80, 0.3)',
  showCrosshairs: true,
  showGrid: true,
  showScale: true,
  showOrientationLabels: true,
  showLeafBoundaries: true,
  showLeafNumbers: false,
  fieldOpacity: 0.5,
  mlcOpacity: 0.8,
  drrOpacity: 0.4,
  structureOpacity: 0.7
};

/**
 * Render BEV to a canvas context
 */
export function renderBEV(
  ctx: CanvasRenderingContext2D,
  bev: BEVData,
  options: Partial<BEVRenderOptions> = {},
  drrImage?: HTMLImageElement | ImageBitmap | null,
  structures?: ProjectedStructure[]
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height } = opts;
  
  // Clear canvas
  ctx.fillStyle = opts.backgroundColor!;
  ctx.fillRect(0, 0, width, height);
  
  // Calculate scaling
  const jaw = bev.jawAperture;
  const fieldWidth = Math.abs(jaw.x2 - jaw.x1);
  const fieldHeight = Math.abs(jaw.y2 - jaw.y1);
  const maxFieldDim = Math.max(fieldWidth, fieldHeight, 100); // At least 100mm
  
  // Add margin for labels
  const margin = 40;
  const availableSize = Math.min(width, height) - margin * 2;
  const pixelsPerMm = opts.pixelsPerMm || (availableSize / (maxFieldDim * 1.3)); // 30% margin
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Convert mm to pixels
  const mmToPixel = (mm: number) => mm * pixelsPerMm;
  
  // Draw DRR background if provided
  if (drrImage && opts.drrOpacity! > 0) {
    ctx.save();
    ctx.globalAlpha = opts.drrOpacity!;
    const drrSize = mmToPixel(maxFieldDim * 1.5);
    ctx.drawImage(
      drrImage,
      centerX - drrSize / 2,
      centerY - drrSize / 2,
      drrSize,
      drrSize
    );
    ctx.restore();
  }
  
  // Draw grid if enabled
  if (opts.showGrid) {
    drawGrid(ctx, centerX, centerY, width, height, pixelsPerMm, opts.gridColor!);
  }
  
  // Draw blocked region (outside jaws)
  drawJawBlocking(ctx, centerX, centerY, width, height, jaw, pixelsPerMm, opts.jawColor!);
  
  // Draw MLC or open field
  if (bev.mlcAperture && bev.mlcAperture.leaves.length > 0) {
    drawMLCAperture(ctx, centerX, centerY, bev, pixelsPerMm, opts);
  } else {
    // Draw simple rectangular field
    drawRectangularField(ctx, centerX, centerY, jaw, pixelsPerMm, opts);
  }
  
  // Draw wedge if present
  if (bev.wedge) {
    drawWedge(ctx, centerX, centerY, jaw, bev.wedge, pixelsPerMm);
  }
  
  // Draw block if present
  if (bev.block) {
    drawBlock(ctx, centerX, centerY, bev.block, pixelsPerMm);
  }
  
  // Draw projected structures
  if (structures && structures.length > 0 && opts.structureOpacity! > 0) {
    drawProjectedStructures(ctx, centerX, centerY, structures, pixelsPerMm, opts.structureOpacity!);
  }
  
  // Draw crosshairs
  if (opts.showCrosshairs) {
    drawCrosshairs(ctx, centerX, centerY, width, height, opts.crosshairColor!);
  }
  
  // Draw orientation labels
  if (opts.showOrientationLabels) {
    const labels = getBEVOrientationLabels(
      bev.gantryAngle,
      bev.collimatorAngle,
      bev.couchAngle
    );
    drawOrientationLabels(ctx, width, height, labels);
  }
  
  // Draw scale indicator
  if (opts.showScale) {
    drawScaleIndicator(ctx, width, height, pixelsPerMm, fieldWidth, fieldHeight);
  }
  
  // Draw beam info overlay
  drawBeamInfo(ctx, bev, width);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  pixelsPerMm: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  
  const gridSpacing = pixelsPerMm * 50; // 50mm grid
  
  // Vertical lines
  for (let x = centerX % gridSpacing; x < width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let y = centerY % gridSpacing; y < height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawJawBlocking(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  jaw: BEVData['jawAperture'],
  pixelsPerMm: number,
  color: string
): void {
  ctx.fillStyle = color;
  
  // Convert jaw positions to pixel coordinates
  const jawX1 = centerX + jaw.x1 * pixelsPerMm;
  const jawX2 = centerX + jaw.x2 * pixelsPerMm;
  const jawY1 = centerY - jaw.y2 * pixelsPerMm; // Y is inverted in canvas
  const jawY2 = centerY - jaw.y1 * pixelsPerMm;
  
  // Left block
  ctx.fillRect(0, 0, jawX1, height);
  
  // Right block
  ctx.fillRect(jawX2, 0, width - jawX2, height);
  
  // Top block
  ctx.fillRect(jawX1, 0, jawX2 - jawX1, jawY1);
  
  // Bottom block
  ctx.fillRect(jawX1, jawY2, jawX2 - jawX1, height - jawY2);
}

function drawRectangularField(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  jaw: BEVData['jawAperture'],
  pixelsPerMm: number,
  opts: BEVRenderOptions
): void {
  const x1 = centerX + jaw.x1 * pixelsPerMm;
  const x2 = centerX + jaw.x2 * pixelsPerMm;
  const y1 = centerY - jaw.y2 * pixelsPerMm;
  const y2 = centerY - jaw.y1 * pixelsPerMm;
  
  // Fill open field
  ctx.fillStyle = opts.mlcOpenColor!;
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  
  // Field outline
  ctx.strokeStyle = opts.fieldColor!;
  ctx.lineWidth = 2;
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  
  // Diagonal lines for visibility
  ctx.strokeStyle = `${opts.fieldColor!}40`;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x2, y1);
  ctx.lineTo(x1, y2);
  ctx.stroke();
  
  ctx.setLineDash([]);
}

function drawMLCAperture(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  bev: BEVData,
  pixelsPerMm: number,
  opts: BEVRenderOptions
): void {
  const mlc = bev.mlcAperture!;
  const jaw = bev.jawAperture;
  
  // Convert jaw positions
  const jawX1 = centerX + jaw.x1 * pixelsPerMm;
  const jawX2 = centerX + jaw.x2 * pixelsPerMm;
  const jawY1 = centerY - jaw.y2 * pixelsPerMm;
  const jawY2 = centerY - jaw.y1 * pixelsPerMm;
  
  // Draw each leaf
  for (const leaf of mlc.leaves) {
    const leafWidth = leaf.width || mlc.leafWidth;
    
    // Leaf Y boundaries (in canvas coords, Y is inverted)
    const y1 = centerY - (leaf.y + leafWidth / 2) * pixelsPerMm;
    const y2 = centerY - (leaf.y - leafWidth / 2) * pixelsPerMm;
    
    // Leaf X positions
    const x1 = centerX + leaf.x1 * pixelsPerMm;
    const x2 = centerX + leaf.x2 * pixelsPerMm;
    
    // Clip to jaw aperture
    const clipY1 = Math.max(y1, jawY1);
    const clipY2 = Math.min(y2, jawY2);
    
    if (clipY2 <= clipY1) continue; // Leaf outside jaw
    
    // Draw blocked regions (outside MLC opening)
    ctx.fillStyle = opts.mlcClosedColor!;
    
    // Left blocked region (from jaw to leaf A position)
    if (x1 > jawX1) {
      ctx.fillRect(jawX1, clipY1, x1 - jawX1, clipY2 - clipY1);
    }
    
    // Right blocked region (from leaf B position to jaw)
    if (x2 < jawX2) {
      ctx.fillRect(x2, clipY1, jawX2 - x2, clipY2 - clipY1);
    }
    
    // Draw open field region
    const openX1 = Math.max(x1, jawX1);
    const openX2 = Math.min(x2, jawX2);
    
    if (openX2 > openX1) {
      ctx.fillStyle = opts.mlcOpenColor!;
      ctx.fillRect(openX1, clipY1, openX2 - openX1, clipY2 - clipY1);
    }
    
    // Draw leaf boundary lines
    if (opts.showLeafBoundaries) {
      ctx.strokeStyle = 'rgba(80, 80, 100, 0.4)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(jawX1, clipY2);
      ctx.lineTo(jawX2, clipY2);
      ctx.stroke();
    }
  }
  
  // Draw field outline
  ctx.strokeStyle = opts.fieldColor!;
  ctx.lineWidth = 2;
  ctx.strokeRect(jawX1, jawY1, jawX2 - jawX1, jawY2 - jawY1);
}

function drawWedge(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  jaw: BEVData['jawAperture'],
  wedge: NonNullable<BEVData['wedge']>,
  pixelsPerMm: number
): void {
  const x1 = centerX + jaw.x1 * pixelsPerMm;
  const x2 = centerX + jaw.x2 * pixelsPerMm;
  const y1 = centerY - jaw.y2 * pixelsPerMm;
  const y2 = centerY - jaw.y1 * pixelsPerMm;
  
  const wedgeCenterX = (x1 + x2) / 2;
  const wedgeCenterY = (y1 + y2) / 2;
  
  ctx.save();
  ctx.translate(wedgeCenterX, wedgeCenterY);
  ctx.rotate((wedge.orientation * Math.PI) / 180);
  
  // Draw wedge gradient
  const gradient = ctx.createLinearGradient(0, -(y2 - y1) / 2, 0, (y2 - y1) / 2);
  gradient.addColorStop(0, 'rgba(139, 69, 19, 0.4)');
  gradient.addColorStop(1, 'rgba(139, 69, 19, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(-(x2 - x1) / 2, -(y2 - y1) / 2, x2 - x1, y2 - y1);
  
  // Wedge indicator
  ctx.strokeStyle = 'rgba(139, 69, 19, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-(x2 - x1) / 4, -(y2 - y1) / 3);
  ctx.lineTo(0, (y2 - y1) / 3);
  ctx.lineTo((x2 - x1) / 4, -(y2 - y1) / 3);
  ctx.stroke();
  
  ctx.restore();
  
  // Wedge label
  ctx.fillStyle = 'rgba(139, 69, 19, 0.9)';
  ctx.font = '10px monospace';
  ctx.fillText(`Wedge ${wedge.angle}°`, x1 + 5, y1 + 15);
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  block: NonNullable<BEVData['block']>,
  pixelsPerMm: number
): void {
  if (block.points.length < 3) return;
  
  ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.9)';
  ctx.lineWidth = 1;
  
  ctx.beginPath();
  const first = block.points[0];
  ctx.moveTo(centerX + first.x * pixelsPerMm, centerY - first.y * pixelsPerMm);
  
  for (let i = 1; i < block.points.length; i++) {
    const pt = block.points[i];
    ctx.lineTo(centerX + pt.x * pixelsPerMm, centerY - pt.y * pixelsPerMm);
  }
  
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawProjectedStructures(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  structures: ProjectedStructure[],
  pixelsPerMm: number,
  opacity: number
): void {
  for (const structure of structures) {
    const [r, g, b] = structure.color;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.lineWidth = 1.5;
    
    for (const contour of structure.projectedContours) {
      if (contour.length < 2) continue;
      
      ctx.beginPath();
      ctx.moveTo(
        centerX + contour[0].x * pixelsPerMm,
        centerY - contour[0].y * pixelsPerMm
      );
      
      for (let i = 1; i < contour.length; i++) {
        ctx.lineTo(
          centerX + contour[i].x * pixelsPerMm,
          centerY - contour[i].y * pixelsPerMm
        );
      }
      
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function drawCrosshairs(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  
  // Vertical crosshair
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.stroke();
  
  // Horizontal crosshair
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  
  ctx.setLineDash([]);
  
  // Central cross
  const crossSize = 10;
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(centerX - crossSize, centerY);
  ctx.lineTo(centerX + crossSize, centerY);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - crossSize);
  ctx.lineTo(centerX, centerY + crossSize);
  ctx.stroke();
  
  // Tick marks at 50mm intervals
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
}

function drawOrientationLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  labels: { left: string; right: string; top: string; bottom: string }
): void {
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Colors for anatomical directions
  const getColor = (label: string) => {
    if (label === 'L' || label === 'R') return 'rgba(255, 100, 100, 0.9)'; // Red for L/R
    if (label === 'H' || label === 'F') return 'rgba(100, 200, 255, 0.9)'; // Blue for H/F
    if (label === 'A' || label === 'P') return 'rgba(100, 255, 100, 0.9)'; // Green for A/P
    return 'rgba(200, 200, 200, 0.9)';
  };
  
  // Left label
  ctx.fillStyle = getColor(labels.left);
  ctx.fillText(labels.left, 15, height / 2);
  
  // Right label
  ctx.fillStyle = getColor(labels.right);
  ctx.fillText(labels.right, width - 15, height / 2);
  
  // Top label
  ctx.fillStyle = getColor(labels.top);
  ctx.fillText(labels.top, width / 2, 15);
  
  // Bottom label
  ctx.fillStyle = getColor(labels.bottom);
  ctx.fillText(labels.bottom, width / 2, height - 15);
}

function drawScaleIndicator(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelsPerMm: number,
  fieldWidth: number,
  fieldHeight: number
): void {
  ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  
  // Field size
  ctx.fillText(
    `Field: ${fieldWidth.toFixed(0)}×${fieldHeight.toFixed(0)}mm`,
    5,
    height - 25
  );
  
  // Scale
  ctx.fillText(
    `Scale: ${(pixelsPerMm * 100).toFixed(1)}px/100mm`,
    5,
    height - 10
  );
  
  // Scale bar (50mm)
  const barLength = pixelsPerMm * 50;
  const barY = height - 35;
  const barX = width - barLength - 10;
  
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX + barLength, barY);
  ctx.stroke();
  
  // End caps
  ctx.beginPath();
  ctx.moveTo(barX, barY - 3);
  ctx.lineTo(barX, barY + 3);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(barX + barLength, barY - 3);
  ctx.lineTo(barX + barLength, barY + 3);
  ctx.stroke();
  
  ctx.textAlign = 'center';
  ctx.fillText('50mm', barX + barLength / 2, barY - 8);
}

function drawBeamInfo(
  ctx: CanvasRenderingContext2D,
  bev: BEVData,
  width: number
): void {
  // Header with beam name
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, width, 25);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(bev.beamName, 8, 16);
  
  // Gantry angle
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  const dirName = getBeamDirectionName(bev.gantryAngle);
  ctx.fillText(`G:${bev.gantryAngle.toFixed(1)}° ${dirName}`, width - 8, 16);
  
  // Control point info (if available)
  if (bev.controlPointIndex !== undefined && bev.totalControlPoints !== undefined) {
    ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(
      `CP ${bev.controlPointIndex + 1}/${bev.totalControlPoints}`,
      8,
      38
    );
    
    if (bev.cumulativeMetersetWeight !== undefined) {
      ctx.textAlign = 'right';
      ctx.fillText(
        `MU: ${(bev.cumulativeMetersetWeight * 100).toFixed(1)}%`,
        width - 8,
        38
      );
    }
  }
}

/**
 * Create a BEVData object from API response
 */
export function createBEVDataFromResponse(
  response: any,
  beamName: string = 'Unknown',
  beamNumber: number = 0
): BEVData {
  return {
    beamName: response.beamName || beamName,
    beamNumber: response.beamNumber || beamNumber,
    gantryAngle: response.gantryAngle || 0,
    collimatorAngle: response.collimatorAngle || 0,
    couchAngle: response.couchAngle || response.patientSupportAngle || 0,
    sourceAxisDistance: response.sourceAxisDistance || 1000,
    jawAperture: response.jawAperture || { x1: -100, x2: 100, y1: -100, y2: 100 },
    mlcAperture: response.mlcAperture,
    wedge: response.wedge,
    block: response.block,
    controlPointIndex: response.controlPointIndex,
    totalControlPoints: response.totalControlPoints,
    cumulativeMetersetWeight: response.cumulativeMetersetWeight
  };
}
