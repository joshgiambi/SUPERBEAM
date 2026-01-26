/**
 * BEV (Beam's Eye View) Renderer
 * 
 * Based on RT_BEV_RENDERING_GUIDE.md - exact methodology from C#/WPF conversion
 * 
 * Rendering order:
 * 1. Black background
 * 2. DRR background image (if available)
 * 3. Projected structures
 * 4. Reference points
 * 5. Scale ruler
 * 6. [Apply collimator rotation]
 * 7. Crosshair
 * 8. Jaws (with clipping)
 * 9. MLC field shape
 * 10. Wedges
 * 11. Blocks
 * 12. [Remove collimator rotation]
 * 13. Orientation labels
 * 14. Beam info overlay
 */

// ============================================================================
// TYPES
// ============================================================================

export interface JawPositions {
  x1: number;  // Left jaw (negative mm)
  x2: number;  // Right jaw (positive mm)
  y1: number;  // Bottom/Gun jaw (negative mm)
  y2: number;  // Top/Target jaw (positive mm)
}

export interface MlcLeafPositions {
  bankA: number[];  // Left bank positions (typically negative mm)
  bankB: number[];  // Right bank positions (typically positive mm)
}

export interface MlcModel {
  name: string;
  numLeafPairs: number;
  leafWidths: number[];  // Width of each leaf in mm
  startY: number;        // Y position of first leaf edge (typically -200mm)
}

export interface Wedge {
  id: string;
  type: 'STANDARD' | 'DYNAMIC' | 'MOTORIZED';
  angle: number;      // degrees (15, 30, 45, 60)
  direction: number;  // 0-359 degrees
}

export interface Block {
  id: string;
  type: 'SHIELDING' | 'APERTURE';
  outline: { x: number; y: number }[][];  // Array of contours
}

export interface ProjectedStructure {
  name: string;
  color: string;
  contours: { x: number; y: number }[][];
  visible: boolean;
}

export interface ReferencePoint {
  id: string;
  name: string;
  location: { x: number; y: number };  // In mm
  color: string;
  enabled: boolean;
}

export interface ControlPoint {
  index: number;
  jawPositions: JawPositions;
  leafPositions?: MlcLeafPositions;
  gantryAngle: number;
  collimatorAngle: number;
  couchAngle: number;
  cumulativeMetersetWeight?: number;
}

export interface BevRenderData {
  beamName: string;
  beamNumber: number;
  meterset?: number;
  patientOrientation: string;
  isSetupField: boolean;
  mlcModelName?: string;
  controlPoint: ControlPoint;
  maxJaws: JawPositions;  // Cumulative max opening
  wedges: Wedge[];
  blocks: Block[];
  drrImageData?: ImageData;
  projectedStructures: ProjectedStructure[];
  referencePoints: ReferencePoint[];
}

export interface BevRenderConfig {
  width: number;
  height: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  showCrosshair: boolean;
  showScale: boolean;
  showOrientationLabels: boolean;
  showMlc: boolean;
  showJaws: boolean;
  showDrr: boolean;
  showStructures: boolean;
}

// ============================================================================
// MLC MODELS
// ============================================================================

export const MLC_MODELS: Record<string, MlcModel> = {
  'Millennium120': {
    name: 'Millennium120',
    numLeafPairs: 60,
    leafWidths: [
      ...Array(10).fill(10),   // 10 outer leaves at 10mm
      ...Array(40).fill(5),    // 40 central leaves at 5mm
      ...Array(10).fill(10),   // 10 outer leaves at 10mm
    ],
    startY: 200,  // First leaf starts at +200mm (top of BEV)
  },
  'HD120': {
    name: 'HD120',
    numLeafPairs: 60,
    leafWidths: [
      ...Array(14).fill(5),    // 14 outer leaves at 5mm
      ...Array(32).fill(2.5),  // 32 central leaves at 2.5mm
      ...Array(14).fill(5),    // 14 outer leaves at 5mm
    ],
    startY: 110,
  },
  'Agility': {
    name: 'Agility',
    numLeafPairs: 80,
    leafWidths: Array(80).fill(5),  // All leaves 5mm
    startY: 200,
  },
  'MLCi': {
    name: 'MLCi',
    numLeafPairs: 40,
    leafWidths: Array(40).fill(10),  // All leaves 10mm
    startY: 200,
  },
};

// ============================================================================
// COLORS (from C# original)
// ============================================================================

const COLORS = {
  background: '#000000',
  jawTreatment: '#FFFF00',      // Yellow
  jawSetup: '#2FE7E5',          // Cyan
  mlc: '#FFFF80',               // Light yellow
  wedge: '#FFA500',             // Orange
  block: 'rgba(133, 93, 36, 0.5)',  // Semi-transparent brown
  crosshair: '#FFFF00',         // Yellow
  scale: '#00FF00',             // Green
  orientationLabel: '#FF0000',  // Red
  isocenter: '#FFFFFF',         // White
};

// ============================================================================
// MAIN RENDERER CLASS
// ============================================================================

export class BevRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private center: { x: number; y: number };
  private pixelsPerMm: number;
  private config: BevRenderConfig;

  constructor(canvas: HTMLCanvasElement, config?: Partial<BevRenderConfig>) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.center = { x: this.width / 2, y: this.height / 2 };
    
    // Calculate scale: fit 400mm field to 90% of canvas
    const fieldSizeMm = 400;
    const margin = 0.9;
    this.pixelsPerMm = (Math.min(this.width, this.height) * margin) / fieldSizeMm;

    this.config = {
      width: this.width,
      height: this.height,
      zoomLevel: 1,
      panOffset: { x: 0, y: 0 },
      showCrosshair: true,
      showScale: true,
      showOrientationLabels: true,
      showMlc: true,
      showJaws: true,
      showDrr: true,
      showStructures: true,
      ...config,
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<BevRenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Convert mm position to canvas pixels
   * This is the fundamental coordinate conversion
   */
  private mmToCanvas(mmX: number, mmY: number): { x: number; y: number } {
    return {
      x: this.center.x + mmX * this.pixelsPerMm,
      y: this.center.y - mmY * this.pixelsPerMm,  // Y is inverted in canvas
    };
  }

  /**
   * Main render function - complete pipeline
   */
  render(data: BevRenderData): void {
    const { ctx, width, height, center, config } = this;
    const cp = data.controlPoint;

    // Step 1: Clear with black background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Step 2: Save context and apply zoom/pan
    ctx.save();
    ctx.translate(center.x + config.panOffset.x, center.y + config.panOffset.y);
    ctx.scale(config.zoomLevel, config.zoomLevel);
    ctx.translate(-center.x, -center.y);

    // Step 3: Draw DRR background
    if (config.showDrr && data.drrImageData) {
      this.drawDrrBackground(data.drrImageData);
    }

    // Step 4: Draw projected structures
    if (config.showStructures) {
      this.drawStructures(data.projectedStructures);
    }

    // Step 5: Draw reference points
    this.drawReferencePoints(data.referencePoints);

    // Step 6: Draw scale ruler (before collimator rotation)
    if (config.showScale) {
      this.drawScaleRuler();
    }

    // Step 7: Apply collimator rotation for field elements
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(-cp.collimatorAngle * Math.PI / 180);  // Negative for screen coords
    ctx.translate(-center.x, -center.y);

    // Step 8: Draw crosshair
    if (config.showCrosshair) {
      this.drawCrosshair();
    }

    // Step 9: Draw jaws with MLC clipping
    if (config.showJaws) {
      // Create jaw clip path
      const jawClip = this.createJawClipPath(data.maxJaws);
      
      ctx.save();
      ctx.clip(jawClip);

      // Step 10: Draw MLC (clipped to jaws)
      if (config.showMlc && cp.leafPositions) {
        const mlcModel = data.mlcModelName ? MLC_MODELS[data.mlcModelName] : null;
        if (mlcModel) {
          this.drawMlc(mlcModel, cp.leafPositions, data.maxJaws);
        }
      }

      ctx.restore();  // Remove MLC clipping

      // Draw jaw outline
      this.drawJaws(data.maxJaws, data.isSetupField);
    }

    // Step 11: Draw wedges
    for (const wedge of data.wedges) {
      this.drawWedge(wedge, data.maxJaws);
    }

    // Step 12: Draw blocks
    for (const block of data.blocks) {
      this.drawBlock(block, data.maxJaws);
    }

    ctx.restore();  // Remove collimator rotation

    // Step 13: Draw orientation labels (not rotated with collimator)
    if (config.showOrientationLabels) {
      this.drawOrientationLabels(
        data.patientOrientation,
        cp.gantryAngle,
        cp.couchAngle,
        cp.collimatorAngle
      );
    }

    ctx.restore();  // Remove zoom/pan

    // Step 14: Draw beam info (fixed position)
    this.drawBeamInfo(data);
  }

  // ============================================================================
  // INDIVIDUAL DRAWING METHODS
  // ============================================================================

  /**
   * Draw DRR background image
   */
  private drawDrrBackground(imageData: ImageData): void {
    const { ctx, width, height } = this;

    // Create temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.putImageData(imageData, 0, 0);

    // Draw centered
    const x = (width - imageData.width) / 2;
    const y = (height - imageData.height) / 2;

    ctx.globalAlpha = 0.7;
    ctx.drawImage(tempCanvas, x, y);
    ctx.globalAlpha = 1.0;
  }

  /**
   * Draw projected structures
   */
  private drawStructures(structures: ProjectedStructure[]): void {
    const { ctx, center, pixelsPerMm } = this;

    for (const structure of structures) {
      if (!structure.visible || !structure.contours.length) continue;

      ctx.strokeStyle = structure.color;
      ctx.lineWidth = 1.5;

      for (const contour of structure.contours) {
        if (contour.length < 3) continue;

        ctx.beginPath();
        const start = this.mmToCanvas(contour[0].x, contour[0].y);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < contour.length; i++) {
          const pt = this.mmToCanvas(contour[i].x, contour[i].y);
          ctx.lineTo(pt.x, pt.y);
        }

        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  /**
   * Draw reference points
   */
  private drawReferencePoints(points: ReferencePoint[]): void {
    const { ctx } = this;
    const boxSize = 10;

    for (const point of points) {
      if (!point.enabled) continue;

      const pos = this.mmToCanvas(point.location.x, point.location.y);
      const halfBox = boxSize / 2;

      ctx.strokeStyle = point.color;
      ctx.lineWidth = 1.5;

      // Draw X shape
      ctx.beginPath();
      ctx.moveTo(pos.x - halfBox, pos.y - halfBox);
      ctx.lineTo(pos.x + halfBox, pos.y + halfBox);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos.x - halfBox, pos.y + halfBox);
      ctx.lineTo(pos.x + halfBox, pos.y - halfBox);
      ctx.stroke();
    }
  }

  /**
   * Draw scale ruler (top-right corner)
   */
  private drawScaleRuler(): void {
    const { ctx, width, pixelsPerMm, config } = this;
    const scaleLengthCm = 10;
    const scalePixels = scaleLengthCm * 10 * pixelsPerMm * config.zoomLevel;
    const offset = 15;
    const y = offset;

    const startX = width - offset - scalePixels;

    ctx.strokeStyle = COLORS.scale;
    ctx.lineWidth = 1;

    // Horizontal scale line
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + scalePixels, y);
    ctx.stroke();

    // Tick marks at each cm
    const cmPixels = 10 * pixelsPerMm * config.zoomLevel;
    for (let i = 0; i <= scaleLengthCm; i++) {
      const x = startX + i * cmPixels;
      const tickLen = (i % 5 === 0) ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + tickLen);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = COLORS.orientationLabel;
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${scaleLengthCm} cm`, startX, y + 18);
  }

  /**
   * Draw crosshair with tick marks
   */
  private drawCrosshair(): void {
    const { ctx, center, width, height, pixelsPerMm } = this;

    ctx.strokeStyle = COLORS.crosshair;
    ctx.lineWidth = 0.75;

    // Vertical line through isocenter
    ctx.beginPath();
    ctx.moveTo(center.x, 0);
    ctx.lineTo(center.x, height);
    ctx.stroke();

    // Horizontal line through isocenter
    ctx.beginPath();
    ctx.moveTo(0, center.y);
    ctx.lineTo(width, center.y);
    ctx.stroke();

    // Center point
    ctx.fillStyle = COLORS.isocenter;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Tick marks every 10mm
    const tickIntervalMm = 10;
    const stepPixels = tickIntervalMm * pixelsPerMm;
    const maxExtent = Math.max(width, height);

    let iteration = 0;
    for (let offset = stepPixels; offset < maxExtent; offset += stepPixels) {
      iteration++;
      const tickLength = (iteration % 5 === 0) ? 8 : 4;

      // Horizontal axis ticks
      ctx.beginPath();
      ctx.moveTo(center.x + offset, center.y - tickLength);
      ctx.lineTo(center.x + offset, center.y + tickLength);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(center.x - offset, center.y - tickLength);
      ctx.lineTo(center.x - offset, center.y + tickLength);
      ctx.stroke();

      // Vertical axis ticks
      ctx.beginPath();
      ctx.moveTo(center.x - tickLength, center.y + offset);
      ctx.lineTo(center.x + tickLength, center.y + offset);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(center.x - tickLength, center.y - offset);
      ctx.lineTo(center.x + tickLength, center.y - offset);
      ctx.stroke();
    }
  }

  /**
   * Create jaw clipping path
   */
  private createJawClipPath(jaws: JawPositions): Path2D {
    const tl = this.mmToCanvas(jaws.x1, jaws.y2);
    const br = this.mmToCanvas(jaws.x2, jaws.y1);

    const path = new Path2D();
    path.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    return path;
  }

  /**
   * Draw jaw aperture rectangle
   */
  private drawJaws(jaws: JawPositions, isSetupField: boolean): void {
    const { ctx } = this;

    const color = isSetupField ? COLORS.jawSetup : COLORS.jawTreatment;
    const lineWidth = 2;

    const tl = this.mmToCanvas(jaws.x1, jaws.y2);
    const br = this.mmToCanvas(jaws.x2, jaws.y1);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  /**
   * Draw MLC field shape
   */
  private drawMlc(
    model: MlcModel,
    leafPositions: MlcLeafPositions,
    jaws: JawPositions
  ): void {
    const { ctx, center, pixelsPerMm } = this;

    ctx.strokeStyle = COLORS.mlc;
    ctx.lineWidth = 0.75;

    // Start at top of MLC bank (Y positive in BEV = top of canvas)
    let currentY = model.startY;

    let prevLeft = 0;
    let prevRight = 0;
    let prevCanvasY = 0;
    let drawingStarted = false;

    for (let i = 0; i < model.leafWidths.length; i++) {
      const leafWidth = model.leafWidths[i];
      const nextY = currentY - leafWidth;  // Move down

      // Check if within jaw aperture
      if (currentY < jaws.y1 || nextY > jaws.y2) {
        currentY = nextY;
        continue;
      }

      const leftMm = leafPositions.bankA[i] ?? 0;
      const rightMm = leafPositions.bankB[i] ?? 0;

      // Skip closed leaves (gap < 1mm)
      if (rightMm - leftMm < 1) {
        if (drawingStarted) {
          // Close the shape
          ctx.beginPath();
          ctx.moveTo(prevLeft, prevCanvasY);
          ctx.lineTo(prevRight, prevCanvasY);
          ctx.stroke();
          drawingStarted = false;
        }
        currentY = nextY;
        continue;
      }

      const left = this.mmToCanvas(leftMm, currentY);
      const right = this.mmToCanvas(rightMm, currentY);
      const bottomLeft = this.mmToCanvas(leftMm, nextY);
      const bottomRight = this.mmToCanvas(rightMm, nextY);

      // Draw vertical lines (leaf edges)
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(bottomLeft.x, bottomLeft.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(right.x, right.y);
      ctx.lineTo(bottomRight.x, bottomRight.y);
      ctx.stroke();

      // Draw horizontal connections
      if (drawingStarted) {
        ctx.beginPath();
        ctx.moveTo(prevLeft, left.y);
        ctx.lineTo(left.x, left.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(prevRight, right.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      } else {
        // First visible leaf - draw top horizontal line
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
        drawingStarted = true;
      }

      prevLeft = bottomLeft.x;
      prevRight = bottomRight.x;
      prevCanvasY = bottomLeft.y;
      currentY = nextY;
    }

    // Close the shape at bottom
    if (drawingStarted) {
      ctx.beginPath();
      ctx.moveTo(prevLeft, prevCanvasY);
      ctx.lineTo(prevRight, prevCanvasY);
      ctx.stroke();
    }
  }

  /**
   * Draw wedge triangle
   */
  private drawWedge(wedge: Wedge, jaws: JawPositions): void {
    const { ctx } = this;

    // Normalize direction
    let dir = wedge.direction;
    if (dir >= 315 || dir <= 45) dir = 0;
    else if (dir > 45 && dir < 135) dir = 90;
    else if (dir >= 135 && dir <= 225) dir = 180;
    else dir = 270;

    const tl = this.mmToCanvas(jaws.x1, jaws.y2);
    const tr = this.mmToCanvas(jaws.x2, jaws.y2);
    const bl = this.mmToCanvas(jaws.x1, jaws.y1);
    const br = this.mmToCanvas(jaws.x2, jaws.y1);

    const toeTan = Math.tan(10 * Math.PI / 180);
    const fieldWidth = tr.x - tl.x;
    const fieldHeight = bl.y - tl.y;

    let toeCorner: { x: number; y: number };
    let baseCorner1: { x: number; y: number };
    let baseCorner2: { x: number; y: number };

    switch (dir) {
      case 0:  // IN - thick end at top
        toeCorner = { x: tl.x, y: tl.y };
        baseCorner1 = { x: tl.x - fieldHeight * toeTan, y: bl.y };
        baseCorner2 = { x: tl.x, y: bl.y };
        break;
      case 90:  // RIGHT - thick end at right
        toeCorner = { x: bl.x, y: bl.y };
        baseCorner1 = { x: br.x, y: br.y + fieldWidth * toeTan };
        baseCorner2 = { x: br.x, y: br.y };
        break;
      case 180:  // OUT - thick end at bottom
        toeCorner = { x: br.x, y: br.y };
        baseCorner1 = { x: br.x + fieldHeight * toeTan, y: tr.y };
        baseCorner2 = { x: br.x, y: tr.y };
        break;
      case 270:  // LEFT - thick end at left
      default:
        toeCorner = { x: tr.x, y: tr.y };
        baseCorner1 = { x: tl.x, y: tl.y - fieldWidth * toeTan };
        baseCorner2 = { x: tl.x, y: tl.y };
        break;
    }

    ctx.beginPath();
    ctx.moveTo(toeCorner.x, toeCorner.y);
    ctx.lineTo(baseCorner1.x, baseCorner1.y);
    ctx.lineTo(baseCorner2.x, baseCorner2.y);
    ctx.closePath();

    ctx.strokeStyle = COLORS.wedge;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wedge label
    ctx.fillStyle = COLORS.orientationLabel;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    const labelPos = {
      x: (toeCorner.x + baseCorner1.x + baseCorner2.x) / 3,
      y: (toeCorner.y + baseCorner1.y + baseCorner2.y) / 3,
    };
    ctx.fillText(`W${wedge.angle}°`, labelPos.x, labelPos.y);
  }

  /**
   * Draw block
   */
  private drawBlock(block: Block, jaws: JawPositions): void {
    const { ctx } = this;
    const isAperture = block.type === 'APERTURE';

    ctx.save();

    if (isAperture) {
      // Aperture: fill outside the block opening (even-odd fill)
      const tl = this.mmToCanvas(jaws.x1, jaws.y2);
      const br = this.mmToCanvas(jaws.x2, jaws.y1);

      ctx.beginPath();
      ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

      // Add block contours
      for (const contour of block.outline) {
        if (contour.length < 3) continue;

        const start = this.mmToCanvas(contour[0].x, contour[0].y);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < contour.length; i++) {
          const pt = this.mmToCanvas(contour[i].x, contour[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
      }

      ctx.fillStyle = COLORS.block;
      ctx.fill('evenodd');
      ctx.strokeStyle = COLORS.jawTreatment;
      ctx.lineWidth = 1;
      ctx.stroke();

    } else {
      // Shielding: fill inside the block
      for (const contour of block.outline) {
        if (contour.length < 3) continue;

        ctx.beginPath();
        const start = this.mmToCanvas(contour[0].x, contour[0].y);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < contour.length; i++) {
          const pt = this.mmToCanvas(contour[i].x, contour[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        ctx.fillStyle = COLORS.block;
        ctx.fill();
        ctx.strokeStyle = COLORS.jawTreatment;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Draw orientation labels
   */
  private drawOrientationLabels(
    patientOrientation: string,
    gantryAngle: number,
    couchAngle: number,
    collimatorAngle: number
  ): void {
    const { ctx, center, width, height } = this;
    const radius = Math.min(width, height) / 2 - 20;

    // Determine labels based on patient orientation and gantry angle
    const labels = this.getOrientationLabels(patientOrientation, gantryAngle);

    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const label of labels) {
      // Adjust angle for collimator rotation
      const adjustedAngle = (label.angle - collimatorAngle) * Math.PI / 180;

      const x = center.x + radius * Math.cos(adjustedAngle);
      const y = center.y - radius * Math.sin(adjustedAngle);

      // Draw text with shadow for visibility
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(label.text, x, y);

      ctx.fillStyle = COLORS.orientationLabel;
      ctx.fillText(label.text, x, y);
    }
  }

  /**
   * Get orientation labels based on patient position and gantry
   */
  private getOrientationLabels(
    patientOrientation: string,
    gantryAngle: number
  ): { text: string; angle: number }[] {
    const isHeadFirst = patientOrientation?.startsWith('HF') ?? true;
    const isSupine = patientOrientation === 'HFS' || patientOrientation === 'FFS';

    // Default labels at gantry 0 for HFS
    let rightLabel = isSupine ? 'L' : 'R';
    let leftLabel = isSupine ? 'R' : 'L';
    let topLabel = isHeadFirst ? 'H' : 'F';
    let bottomLabel = isHeadFirst ? 'F' : 'H';

    // Adjust for lateral view
    const isLateral = (gantryAngle > 45 && gantryAngle < 135) || 
                      (gantryAngle > 225 && gantryAngle < 315);
    if (isLateral) {
      if (isSupine) {
        rightLabel = 'A';
        leftLabel = 'P';
      } else {
        rightLabel = 'P';
        leftLabel = 'A';
      }
      if (gantryAngle > 225 && gantryAngle < 315) {
        [rightLabel, leftLabel] = [leftLabel, rightLabel];
      }
    } else if (gantryAngle > 90 && gantryAngle < 270) {
      [rightLabel, leftLabel] = [leftLabel, rightLabel];
    }

    return [
      { text: rightLabel, angle: 0 },    // Right (0°)
      { text: topLabel, angle: 90 },     // Top (90°)
      { text: leftLabel, angle: 180 },   // Left (180°)
      { text: bottomLabel, angle: 270 }, // Bottom (270°)
    ];
  }

  /**
   * Draw beam info overlay
   */
  private drawBeamInfo(data: BevRenderData): void {
    const { ctx, width } = this;
    const cp = data.controlPoint;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, 28);

    // Beam name (left)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(data.beamName, 10, 18);

    // Angles (center)
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `G:${cp.gantryAngle.toFixed(1)}° C:${cp.collimatorAngle.toFixed(1)}° T:${cp.couchAngle.toFixed(1)}°`,
      width / 2,
      18
    );

    // MU (right)
    if (data.meterset) {
      ctx.textAlign = 'right';
      ctx.fillText(`${data.meterset.toFixed(1)} MU`, width - 10, 18);
    }

    // Control point progress (if applicable)
    if (cp.cumulativeMetersetWeight !== undefined) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 28, width, 4);
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, 28, width * cp.cumulativeMetersetWeight, 4);
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate maximum jaw opening across all control points
 */
export function calculateMaxJawOpening(controlPoints: ControlPoint[]): JawPositions {
  let minX1 = Infinity;
  let maxX2 = -Infinity;
  let minY1 = Infinity;
  let maxY2 = -Infinity;

  for (const cp of controlPoints) {
    const jaws = cp.jawPositions;
    if (jaws.x1 < minX1) minX1 = jaws.x1;
    if (jaws.x2 > maxX2) maxX2 = jaws.x2;
    if (jaws.y1 < minY1) minY1 = jaws.y1;
    if (jaws.y2 > maxY2) maxY2 = jaws.y2;
  }

  return { x1: minX1, x2: maxX2, y1: minY1, y2: maxY2 };
}

/**
 * Calculate maximum MLC opening across all control points (CIAO)
 */
export function calculateMaxMlcOpening(
  controlPoints: ControlPoint[]
): MlcLeafPositions | null {
  const first = controlPoints[0]?.leafPositions;
  if (!first) return null;

  const numLeaves = first.bankA.length;
  const maxBankA = new Array(numLeaves).fill(Infinity);
  const maxBankB = new Array(numLeaves).fill(-Infinity);

  for (const cp of controlPoints) {
    if (!cp.leafPositions) continue;
    for (let i = 0; i < numLeaves; i++) {
      if (cp.leafPositions.bankA[i] < maxBankA[i]) {
        maxBankA[i] = cp.leafPositions.bankA[i];
      }
      if (cp.leafPositions.bankB[i] > maxBankB[i]) {
        maxBankB[i] = cp.leafPositions.bankB[i];
      }
    }
  }

  return { bankA: maxBankA, bankB: maxBankB };
}
