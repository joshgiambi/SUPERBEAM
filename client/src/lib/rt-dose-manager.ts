/**
 * RTDoseManager - Radiotherapy Dose Visualization Manager
 * 
 * Handles RT Dose (RTDOSE) display following OHIF/Cornerstone3D patterns:
 * - Multiple colormap options (rainbow, hot, jet, cool, dosimetry)
 * - Isodose line extraction
 * - Dose-volume histogram (DVH) support
 * - Prescription dose normalization
 * 
 * DICOM RT Dose IOD Reference: 
 * https://dicom.nema.org/medical/dicom/current/output/html/part03.html#sect_A.18
 */

// ============================================================================
// Types
// ============================================================================

export type DoseColormap = 'rainbow' | 'hot' | 'jet' | 'cool' | 'dosimetry' | 'grayscale';
export type DoseUnit = 'Gy' | 'cGy';
export type DoseDisplayMode = 'lines_only' | 'colorwash_only' | 'lines_and_colorwash' | 'banded_with_lines';
export type NormalizationSource = 'prescription' | 'max_dose' | 'user_entered' | 'point_dose';

export interface RTDoseConfig {
  doseSeriesId: number;
  colormap: DoseColormap;
  opacity: number;                   // 0-1 global overlay opacity
  opacityTable?: number[];           // Per-level opacity (advanced)
  thresholds: {
    min: number;                     // Gy - below this is transparent
    max: number;                     // Gy - clamped to max color
    prescription?: number;           // Gy - reference dose for percentage display
  };
  showIsodose: boolean;
  isodoseLevels: number[];           // Percentage of prescription or absolute Gy
  isodoseLineWidth: number;
  usePercentage: boolean;            // Display as % of prescription vs absolute Gy
  
  // NEW: Enhanced dose display options (MIM-inspired)
  doseUnit: DoseUnit;                // Gy or cGy display
  displayMode: DoseDisplayMode;      // Lines only, wash only, both, or banded
  showValuesOnLines: boolean;        // Show dose values directly on isodose lines
  normalizationSource: NormalizationSource; // Where normalization value comes from
  clipToStructure?: number;          // Structure ID to clip dose display to (optional)
}

export interface RTDoseMetadata {
  seriesId: number;
  seriesInstanceUID: string;
  doseUnits: 'GY' | 'RELATIVE';      // (3004,0002) Dose Units
  doseType: 'PHYSICAL' | 'EFFECTIVE' | 'ERROR';  // (3004,0004) Dose Type
  doseSummationType: 'PLAN' | 'MULTI_PLAN' | 'FRACTION' | 'BEAM' | 'BRACHY' | 'CONTROL_POINT';
  doseGridScaling: number;           // (3004,000E) Dose Grid Scaling
  rows: number;
  columns: number;
  numberOfFrames: number;
  pixelSpacing: [number, number];
  gridFrameOffsetVector: number[];   // Z positions of each dose plane
  imagePositionPatient: [number, number, number];
  imageOrientationPatient: [number, number, number, number, number, number];
  referencedRTPlanSequence?: {
    referencedSOPInstanceUID: string;
  };
  maxDose?: number;                  // Computed max dose in Gy
  minDose?: number;                  // Computed min dose in Gy
}

export interface RTDoseSlice {
  frameIndex: number;
  slicePosition: number;             // Z position in patient coordinates
  width: number;
  height: number;
  doseData: Float32Array;            // Dose values in Gy
  minDose: number;
  maxDose: number;
}

export interface IsodoseLine {
  level: number;                     // Dose value in Gy
  percentage: number;                // Percentage of prescription
  color: [number, number, number];   // RGB color
  contours: number[][];              // Array of contour paths [[x1,y1,x2,y2,...], ...]
}

export interface DoseOverlayCanvas {
  canvas: HTMLCanvasElement;
  hasSignal: boolean;
  timestamp: number;
  frameIndex: number;
  slicePosition: number;
}

// ============================================================================
// Colormap Definitions
// ============================================================================

type ColorStop = { t: number; c: [number, number, number, number] };

const COLORMAPS: Record<DoseColormap, ColorStop[]> = {
  // Rainbow: Classic dose wash
  rainbow: [
    { t: 0.00, c: [0, 0, 128, 0] },       // Transparent below threshold
    { t: 0.05, c: [0, 0, 255, 180] },     // Blue
    { t: 0.25, c: [0, 255, 255, 200] },   // Cyan
    { t: 0.45, c: [0, 255, 0, 210] },     // Green
    { t: 0.65, c: [255, 255, 0, 220] },   // Yellow
    { t: 0.85, c: [255, 128, 0, 235] },   // Orange
    { t: 1.00, c: [255, 0, 0, 255] },     // Red (hot spots)
  ],

  // Hot: Dark to bright (similar to Eclipse)
  hot: [
    { t: 0.00, c: [0, 0, 0, 0] },
    { t: 0.10, c: [45, 0, 0, 150] },
    { t: 0.30, c: [180, 0, 0, 200] },
    { t: 0.50, c: [255, 80, 0, 220] },
    { t: 0.70, c: [255, 180, 0, 235] },
    { t: 0.85, c: [255, 255, 100, 245] },
    { t: 1.00, c: [255, 255, 255, 255] },
  ],

  // Jet: MATLAB-style
  jet: [
    { t: 0.00, c: [0, 0, 128, 0] },
    { t: 0.10, c: [0, 0, 255, 180] },
    { t: 0.35, c: [0, 255, 255, 200] },
    { t: 0.50, c: [0, 255, 0, 215] },
    { t: 0.65, c: [255, 255, 0, 230] },
    { t: 0.90, c: [255, 0, 0, 245] },
    { t: 1.00, c: [128, 0, 0, 255] },
  ],

  // Cool: Blue to magenta
  cool: [
    { t: 0.00, c: [0, 255, 255, 0] },
    { t: 0.20, c: [0, 200, 255, 160] },
    { t: 0.50, c: [128, 128, 255, 200] },
    { t: 0.75, c: [200, 64, 255, 230] },
    { t: 1.00, c: [255, 0, 255, 255] },
  ],

  // Dosimetry: Clinical standard with discrete bands
  dosimetry: [
    { t: 0.00, c: [0, 0, 0, 0] },
    { t: 0.10, c: [0, 0, 180, 160] },     // 10% - Dark blue
    { t: 0.30, c: [0, 180, 255, 180] },   // 30% - Light blue
    { t: 0.50, c: [0, 255, 0, 200] },     // 50% - Green
    { t: 0.70, c: [255, 255, 0, 220] },   // 70% - Yellow
    { t: 0.90, c: [255, 128, 0, 235] },   // 90% - Orange
    { t: 0.95, c: [255, 0, 0, 245] },     // 95% - Red
    { t: 1.00, c: [255, 0, 128, 255] },   // 100%+ - Pink/Magenta (hot spot)
    { t: 1.07, c: [255, 255, 255, 255] }, // 107%+ - White (critical hot spot)
  ],

  // Grayscale: For overlays where color isn't needed
  grayscale: [
    { t: 0.00, c: [0, 0, 0, 0] },
    { t: 0.10, c: [40, 40, 40, 150] },
    { t: 0.50, c: [128, 128, 128, 200] },
    { t: 1.00, c: [255, 255, 255, 255] },
  ],
};

// Standard isodose colors (matching Eclipse/Pinnacle conventions)
export const ISODOSE_COLORS: Record<number, [number, number, number]> = {
  107: [255, 0, 128],    // 107% - Magenta/Pink (hot spot warning)
  105: [255, 0, 0],      // 105% - Red
  100: [255, 128, 0],    // 100% - Orange (prescription)
  95: [255, 255, 0],     // 95% - Yellow
  90: [0, 255, 0],       // 90% - Green
  80: [0, 255, 255],     // 80% - Cyan
  70: [0, 128, 255],     // 70% - Light blue
  50: [0, 0, 255],       // 50% - Blue
  30: [128, 0, 255],     // 30% - Purple
  10: [64, 64, 64],      // 10% - Gray
};

// ============================================================================
// Colormap Application
// ============================================================================

/**
 * Apply a colormap to a normalized dose value (0-1)
 */
export function applyDoseColormap(
  normalized: number,
  colormap: DoseColormap = 'rainbow'
): [number, number, number, number] {
  const stops = COLORMAPS[colormap] || COLORMAPS.rainbow;
  
  if (normalized <= stops[0].t) {
    return [stops[0].c[0], stops[0].c[1], stops[0].c[2], stops[0].c[3]];
  }
  
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (normalized <= b.t) {
      const w = (normalized - a.t) / (b.t - a.t);
      return [
        Math.round(a.c[0] + w * (b.c[0] - a.c[0])),
        Math.round(a.c[1] + w * (b.c[1] - a.c[1])),
        Math.round(a.c[2] + w * (b.c[2] - a.c[2])),
        Math.round(a.c[3] + w * (b.c[3] - a.c[3])),
      ];
    }
  }
  
  const last = stops[stops.length - 1];
  return [last.c[0], last.c[1], last.c[2], last.c[3]];
}

/**
 * Get isodose line color for a given percentage
 */
export function getIsodoseColor(percentage: number): [number, number, number] {
  // Find closest standard level
  const levels = Object.keys(ISODOSE_COLORS).map(Number).sort((a, b) => b - a);
  for (const level of levels) {
    if (percentage >= level - 2) {
      return ISODOSE_COLORS[level];
    }
  }
  // Default gray for very low doses
  return [64, 64, 64];
}

// ============================================================================
// RTDoseManager Class
// ============================================================================

export class RTDoseManager {
  private cache = new Map<string, DoseOverlayCanvas>();
  private metadata: RTDoseMetadata | null = null;
  private doseData: Map<number, RTDoseSlice> = new Map();
  private config: RTDoseConfig;
  private maxCacheSize = 100;

  constructor(config?: Partial<RTDoseConfig>) {
    this.config = {
      doseSeriesId: 0,
      colormap: 'rainbow',
      opacity: 0.5,
      thresholds: {
        min: 0.5,    // Ignore doses below 0.5 Gy
        max: 70,     // Clamp at 70 Gy
        prescription: 60,  // Common prescription dose
      },
      showIsodose: false,
      isodoseLevels: [30, 50, 70, 80, 90, 95, 100, 105],
      isodoseLineWidth: 2,
      usePercentage: true,
      // NEW: Enhanced options
      doseUnit: 'Gy',
      displayMode: 'lines_and_colorwash',
      showValuesOnLines: false,
      normalizationSource: 'prescription',
      ...config,
    };
  }

  /**
   * Set the dose series to display
   */
  async setDoseSeries(seriesId: number): Promise<RTDoseMetadata | null> {
    if (seriesId === this.config.doseSeriesId && this.metadata) {
      return this.metadata;
    }

    this.clearCache();
    this.doseData.clear();
    this.config.doseSeriesId = seriesId;

    try {
      // Fetch dose metadata from server
      const response = await fetch(`/api/rt-dose/${seriesId}/metadata`);
      if (!response.ok) {
        console.warn(`Failed to load RT Dose metadata: ${response.status}`);
        return null;
      }
      
      this.metadata = await response.json();
      return this.metadata;
    } catch (error) {
      console.error('Error loading RT Dose metadata:', error);
      return null;
    }
  }

  /**
   * Get dose overlay for a specific slice position
   */
  async getOverlay(
    slicePosition: number,
    imageWidth: number,
    imageHeight: number
  ): Promise<DoseOverlayCanvas | null> {
    if (!this.metadata || !this.config.doseSeriesId) return null;

    const cacheKey = `${slicePosition}:${imageWidth}:${imageHeight}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Find the closest dose frame for this slice position
      const frameIndex = this.findClosestFrame(slicePosition);
      if (frameIndex < 0) return null;

      // Load dose data for this frame
      const doseSlice = await this.loadDoseFrame(frameIndex);
      if (!doseSlice) return null;

      // Create overlay canvas
      const canvas = this.createDoseOverlayCanvas(doseSlice, imageWidth, imageHeight);
      if (!canvas) return null;

      const result: DoseOverlayCanvas = {
        canvas,
        hasSignal: doseSlice.maxDose > this.config.thresholds.min,
        timestamp: Date.now(),
        frameIndex,
        slicePosition: doseSlice.slicePosition,
      };

      // Cache it
      this.cache.set(cacheKey, result);
      this.pruneCache();

      return result;
    } catch (error) {
      console.warn(`Dose overlay unavailable for position ${slicePosition}:`, error);
      return null;
    }
  }

  /**
   * Get isodose contours for a specific slice
   */
  async getIsodoseContours(slicePosition: number): Promise<IsodoseLine[]> {
    if (!this.metadata || !this.config.showIsodose) return [];

    const frameIndex = this.findClosestFrame(slicePosition);
    if (frameIndex < 0) return [];

    const doseSlice = await this.loadDoseFrame(frameIndex);
    if (!doseSlice) return [];

    return this.extractIsodoseLines(doseSlice);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RTDoseConfig>) {
    const needsCacheInvalidation = 
      config.colormap !== undefined && config.colormap !== this.config.colormap ||
      config.thresholds !== undefined;

    Object.assign(this.config, config);

    if (needsCacheInvalidation) {
      this.clearCache();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RTDoseConfig {
    return { ...this.config };
  }

  /**
   * Get dose metadata
   */
  getMetadata(): RTDoseMetadata | null {
    return this.metadata;
  }

  /**
   * Clear all cached overlays
   */
  clearCache() {
    this.cache.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private findClosestFrame(slicePosition: number): number {
    if (!this.metadata || !this.metadata.gridFrameOffsetVector?.length) {
      return -1;
    }

    const imageOriginZ = this.metadata.imagePositionPatient[2];
    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;

    this.metadata.gridFrameOffsetVector.forEach((offset, index) => {
      const frameZ = imageOriginZ + offset;
      const distance = Math.abs(frameZ - slicePosition);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    // Only return if within reasonable tolerance (half slice spacing)
    const sliceSpacing = this.metadata.gridFrameOffsetVector.length > 1
      ? Math.abs(this.metadata.gridFrameOffsetVector[1] - this.metadata.gridFrameOffsetVector[0])
      : 3.0;

    return closestDistance <= sliceSpacing * 0.6 ? closestIndex : -1;
  }

  private async loadDoseFrame(frameIndex: number): Promise<RTDoseSlice | null> {
    if (this.doseData.has(frameIndex)) {
      return this.doseData.get(frameIndex)!;
    }

    if (!this.metadata) return null;

    try {
      const response = await fetch(
        `/api/rt-dose/${this.config.doseSeriesId}/frame/${frameIndex}`,
        { cache: 'no-store' }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to load dose frame ${frameIndex}`);
      }

      const data = await response.json();
      
      const slice: RTDoseSlice = {
        frameIndex,
        slicePosition: data.slicePosition,
        width: data.width,
        height: data.height,
        doseData: new Float32Array(data.doseData),
        minDose: data.minDose,
        maxDose: data.maxDose,
      };

      this.doseData.set(frameIndex, slice);
      return slice;
    } catch (error) {
      console.error(`Error loading dose frame ${frameIndex}:`, error);
      return null;
    }
  }

  private createDoseOverlayCanvas(
    doseSlice: RTDoseSlice,
    targetWidth: number,
    targetHeight: number
  ): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Create image data at dose resolution first
    const imageData = new ImageData(doseSlice.width, doseSlice.height);
    const buffer = imageData.data;

    const { min: minThreshold, max: maxThreshold, prescription } = this.config.thresholds;
    const range = maxThreshold - minThreshold;

    for (let i = 0; i < doseSlice.doseData.length; i++) {
      const dose = doseSlice.doseData[i];
      const offset = i * 4;

      // Skip doses below threshold
      if (dose < minThreshold) {
        buffer[offset] = 0;
        buffer[offset + 1] = 0;
        buffer[offset + 2] = 0;
        buffer[offset + 3] = 0;
        continue;
      }

      // Normalize to 0-1 range
      let normalized = (dose - minThreshold) / range;
      normalized = Math.max(0, Math.min(1.15, normalized)); // Allow slight overshoot for hot spots

      // Apply colormap
      const [r, g, b, a] = applyDoseColormap(normalized, this.config.colormap);
      buffer[offset] = r;
      buffer[offset + 1] = g;
      buffer[offset + 2] = b;
      buffer[offset + 3] = Math.round(a * this.config.opacity);
    }

    // Draw at native resolution then scale
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = doseSlice.width;
    tempCanvas.height = doseSlice.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // Scale to target size with smooth interpolation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    return canvas;
  }

  private extractIsodoseLines(doseSlice: RTDoseSlice): IsodoseLine[] {
    const lines: IsodoseLine[] = [];
    const { prescription } = this.config.thresholds;

    for (const levelPercent of this.config.isodoseLevels) {
      const doseThreshold = this.config.usePercentage && prescription
        ? (levelPercent / 100) * prescription
        : levelPercent;

      const contours = this.marchingSquaresContour(
        doseSlice.doseData,
        doseSlice.width,
        doseSlice.height,
        doseThreshold
      );

      if (contours.length > 0) {
        lines.push({
          level: doseThreshold,
          percentage: levelPercent,
          color: getIsodoseColor(levelPercent),
          contours,
        });
      }
    }

    return lines;
  }

  /**
   * Simple marching squares implementation for isodose extraction
   */
  private marchingSquaresContour(
    data: Float32Array,
    width: number,
    height: number,
    threshold: number
  ): number[][] {
    const contours: number[][] = [];
    const visited = new Set<string>();

    // Scan for contour start points
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const idx = y * width + x;
        const tl = data[idx] >= threshold ? 1 : 0;
        const tr = data[idx + 1] >= threshold ? 1 : 0;
        const bl = data[idx + width] >= threshold ? 1 : 0;
        const br = data[idx + width + 1] >= threshold ? 1 : 0;
        
        const config = (tl << 3) | (tr << 2) | (br << 1) | bl;
        
        // Skip if all same (no edge) or already visited
        if (config === 0 || config === 15) continue;
        
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        // Trace contour from this cell
        const contour = this.traceContour(data, width, height, x, y, threshold, visited);
        if (contour.length >= 6) { // At least 3 points
          contours.push(contour);
        }
      }
    }

    return contours;
  }

  private traceContour(
    data: Float32Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number,
    visited: Set<string>
  ): number[] {
    const contour: number[] = [];
    let x = startX;
    let y = startY;
    let prevDir = -1;
    const maxIterations = width * height;
    let iterations = 0;

    do {
      const key = `${x},${y}`;
      if (visited.has(key) && contour.length > 4) break;
      visited.add(key);

      const idx = y * width + x;
      const tl = data[idx] >= threshold ? 1 : 0;
      const tr = data[idx + 1] >= threshold ? 1 : 0;
      const bl = data[idx + width] >= threshold ? 1 : 0;
      const br = data[idx + width + 1] >= threshold ? 1 : 0;
      
      const config = (tl << 3) | (tr << 2) | (br << 1) | bl;

      // Interpolate edge crossing point
      const edgePoint = this.getEdgePoint(data, width, x, y, config, threshold);
      if (edgePoint) {
        contour.push(edgePoint[0], edgePoint[1]);
      }

      // Move to next cell based on configuration
      const nextDir = this.getNextDirection(config, prevDir);
      if (nextDir < 0) break;

      switch (nextDir) {
        case 0: y--; break; // Up
        case 1: x++; break; // Right
        case 2: y++; break; // Down
        case 3: x--; break; // Left
      }
      prevDir = nextDir;

      if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) break;
      iterations++;
    } while (iterations < maxIterations && (x !== startX || y !== startY || contour.length < 4));

    return contour;
  }

  private getEdgePoint(
    data: Float32Array,
    width: number,
    x: number,
    y: number,
    config: number,
    threshold: number
  ): [number, number] | null {
    const idx = y * width + x;
    const tl = data[idx];
    const tr = data[idx + 1];
    const bl = data[idx + width];
    const br = data[idx + width + 1];

    // Return interpolated point based on configuration
    // This is a simplified version - full implementation would handle all 16 cases
    switch (config) {
      case 1: case 14: // Bottom-left edge
        return [x + this.lerp(bl, br, threshold), y + 1];
      case 2: case 13: // Right edge
        return [x + 1, y + this.lerp(tr, br, threshold)];
      case 4: case 11: // Top edge
        return [x + this.lerp(tl, tr, threshold), y];
      case 8: case 7: // Left edge
        return [x, y + this.lerp(tl, bl, threshold)];
      default:
        return [x + 0.5, y + 0.5];
    }
  }

  private lerp(v0: number, v1: number, threshold: number): number {
    if (Math.abs(v1 - v0) < 0.0001) return 0.5;
    return (threshold - v0) / (v1 - v0);
  }

  private getNextDirection(config: number, prevDir: number): number {
    // Simplified direction lookup
    const dirLookup: Record<number, number> = {
      1: 3, 2: 2, 3: 2, 4: 0, 6: 1, 7: 0,
      8: 3, 9: 3, 11: 1, 12: 0, 13: 0, 14: 1,
    };
    return dirLookup[config] ?? -1;
  }

  private pruneCache() {
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize + 10);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format dose value for display
 */
export function formatDose(
  dose: number,
  prescription?: number,
  usePercentage: boolean = false
): string {
  if (usePercentage && prescription && prescription > 0) {
    const percent = (dose / prescription) * 100;
    return `${percent.toFixed(1)}%`;
  }
  return `${dose.toFixed(2)} Gy`;
}

/**
 * Get dose statistics for a region
 */
export function calculateDoseStatistics(
  doseData: Float32Array,
  mask?: Uint8Array
): {
  min: number;
  max: number;
  mean: number;
  d95: number;
  d50: number;
  v100?: number;
} {
  const values: number[] = [];
  
  for (let i = 0; i < doseData.length; i++) {
    if (!mask || mask[i] > 0) {
      values.push(doseData[i]);
    }
  }

  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, d95: 0, d50: 0 };
  }

  values.sort((a, b) => b - a); // Sort descending

  const min = values[values.length - 1];
  const max = values[0];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  // D95 = dose covering 95% of volume (5th percentile from top)
  const d95Index = Math.floor(values.length * 0.05);
  const d95 = values[d95Index] || min;
  
  // D50 = median dose
  const d50Index = Math.floor(values.length * 0.5);
  const d50 = values[d50Index] || mean;

  return { min, max, mean, d95, d50 };
}

/**
 * Default configuration for quick start
 */
export function getDefaultDoseConfig(): RTDoseConfig {
  return {
    doseSeriesId: 0,
    colormap: 'rainbow',
    opacity: 0.5,
    thresholds: {
      min: 0.5,
      max: 70,
      prescription: 60,
    },
    showIsodose: false,
    isodoseLevels: [30, 50, 70, 80, 90, 95, 100, 105],
    isodoseLineWidth: 2,
    usePercentage: true,
    // Enhanced options
    doseUnit: 'Gy',
    displayMode: 'lines_and_colorwash',
    showValuesOnLines: false,
    normalizationSource: 'prescription',
  };
}

/**
 * Format dose value for display with unit conversion
 */
export function formatDoseWithUnit(
  dose: number,
  unit: DoseUnit = 'Gy',
  prescription?: number,
  usePercentage: boolean = false
): string {
  if (usePercentage && prescription && prescription > 0) {
    const percent = (dose / prescription) * 100;
    return `${percent.toFixed(1)}%`;
  }
  
  if (unit === 'cGy') {
    return `${(dose * 100).toFixed(1)} cGy`;
  }
  return `${dose.toFixed(2)} Gy`;
}

/**
 * Snap dose value to nearest isodose band (for banded display mode)
 */
export function snapToBand(normalizedValue: number, isodoseLevels: number[]): number {
  const percentOfRx = normalizedValue * 100;
  const sortedLevels = [...isodoseLevels].sort((a, b) => b - a);
  
  for (let i = 0; i < sortedLevels.length; i++) {
    if (percentOfRx >= sortedLevels[i]) {
      return sortedLevels[i] / 100;
    }
  }
  return 0;
}


