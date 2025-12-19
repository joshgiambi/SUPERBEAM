/**
 * Simple Shape-Based Contour Prediction
 * 
 * No edge detection. No intensity matching. Just reliable shape propagation.
 * 
 * Strategy:
 * - Copy the contour to the target slice
 * - Apply gentle smoothing
 * - That's it.
 * 
 * For better results, the caller should use interpolation when contours
 * exist on both sides of the target slice.
 */

interface Point {
  x: number;
  y: number;
}

export interface PredictionParams {
  smoothingPasses: number;   // Number of smoothing passes
  smoothingStrength: number; // 0-1: how much to smooth
}

export const DEFAULT_PARAMS: PredictionParams = {
  smoothingPasses: 2,
  smoothingStrength: 0.3,
};

/**
 * Gaussian-weighted 5-point smoothing
 */
function smoothPoints(points: Point[], strength: number = 0.3): Point[] {
  const n = points.length;
  if (n < 5) return points.map(p => ({ ...p }));
  
  const result: Point[] = [];
  
  for (let i = 0; i < n; i++) {
    const p2 = points[(i - 2 + n) % n];
    const p1 = points[(i - 1 + n) % n];
    const p0 = points[i];
    const n1 = points[(i + 1) % n];
    const n2 = points[(i + 2) % n];
    
    // Weighted average with Gaussian-like weights
    const avgX = p2.x * 0.1 + p1.x * 0.2 + p0.x * 0.4 + n1.x * 0.2 + n2.x * 0.1;
    const avgY = p2.y * 0.1 + p1.y * 0.2 + p0.y * 0.4 + n1.y * 0.2 + n2.y * 0.1;
    
    // Blend between original and smoothed based on strength
    result.push({
      x: p0.x * (1 - strength) + avgX * strength,
      y: p0.y * (1 - strength) + avgY * strength
    });
  }
  
  return result;
}

/**
 * Main prediction function - simple copy with smoothing
 */
export function fastSlicePrediction(
  referenceContour: Point[],
  _referencePixels: Float32Array | Uint16Array | Uint8Array | Int16Array,
  _targetPixels: Float32Array | Uint16Array | Uint8Array | Int16Array,
  _width: number,
  _height: number,
  sliceDistance: number,
  params: PredictionParams = DEFAULT_PARAMS
): Point[] {
  
  if (referenceContour.length < 3) {
    console.warn('📐 PREDICT: Not enough points');
    return [];
  }
  
  const { smoothingPasses, smoothingStrength } = params;
  
  // Just copy the contour
  let result = referenceContour.map(p => ({ x: p.x, y: p.y }));
  
  // Apply smoothing passes
  for (let pass = 0; pass < smoothingPasses; pass++) {
    result = smoothPoints(result, smoothingStrength);
  }
  
  console.log(`📐 PREDICT: Copied ${result.length} points (distance: ${sliceDistance.toFixed(1)}mm)`);
  
  return result;
}

/**
 * Legacy function for backward compatibility
 */
export function predictContourOnSlice(
  referenceContour: Point[],
  referenceData: Float32Array | Uint16Array | Uint8Array | Int16Array,
  targetData: Float32Array | Uint16Array | Uint8Array | Int16Array,
  width: number,
  height: number,
  sliceDistance: number,
  params?: Partial<PredictionParams>
): Point[] {
  return fastSlicePrediction(
    referenceContour,
    referenceData,
    targetData,
    width,
    height,
    sliceDistance,
    { ...DEFAULT_PARAMS, ...params }
  );
}
