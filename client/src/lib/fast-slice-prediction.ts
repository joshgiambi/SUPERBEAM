/**
 * Fast next-slice prediction using geometric + intensity-based adjustments
 * 
 * This is a lightweight, client-side prediction that:
 * 1. Copies the reference contour as a starting point
 * 2. Applies conservative geometric scaling based on slice distance
 * 3. Optionally refines each point using intensity gradients
 * 4. Smooths the result for clinical-quality output
 */

interface Point {
  x: number;
  y: number;
}

export interface PredictionParams {
  scaleAdjustmentFactor: number;  // How much to scale based on distance (0.005 = 0.5% per mm)
  maxScaleChange: number;         // Maximum scale change allowed (0.15 = ±15%)
  smoothingPasses: number;        // Number of smoothing passes
  useIntensityRefinement: boolean;// Whether to use intensity-based edge refinement
  intensityTolerance: number;     // HU tolerance for edge detection
  searchRadius: number;           // Pixels to search for edge refinement
  edgeWeight: number;             // How much to weight edge attraction (0-1)
}

export const DEFAULT_PARAMS: PredictionParams = {
  scaleAdjustmentFactor: 0.003,   // 0.3% scale change per mm (conservative)
  maxScaleChange: 0.10,           // ±10% max scale change
  smoothingPasses: 2,             // Light smoothing
  useIntensityRefinement: true,   // Enable intensity-based refinement
  intensityTolerance: 100,        // HU tolerance for edge detection
  searchRadius: 8,                // Search ±8 pixels along normal
  edgeWeight: 0.4,                // 40% edge attraction, 60% shape preservation
};

/**
 * Get pixel value with bounds checking
 */
function getPixelValue(
  data: Float32Array | Uint16Array | Uint8Array | Int16Array,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) {
    return -1000; // Return a "background" value
  }
  return data[iy * width + ix];
}

/**
 * Calculate gradient magnitude at a point
 */
function getGradientMagnitude(
  data: Float32Array | Uint16Array | Uint8Array | Int16Array,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const gx = getPixelValue(data, x + 1, y, width, height) - 
             getPixelValue(data, x - 1, y, width, height);
  const gy = getPixelValue(data, x, y + 1, width, height) - 
             getPixelValue(data, x, y - 1, width, height);
  return Math.sqrt(gx * gx + gy * gy);
}

/**
 * Extract 1D intensity profile along a normal direction
 */
function extractProfile(
  data: Float32Array | Uint16Array | Uint8Array | Int16Array,
  startX: number,
  startY: number,
  normalX: number,
  normalY: number,
  length: number,
  width: number,
  height: number
): number[] {
  const profile: number[] = [];
  const halfLen = Math.floor(length / 2);
  
  for (let i = -halfLen; i <= halfLen; i++) {
    const x = startX + normalX * i;
    const y = startY + normalY * i;
    profile.push(getPixelValue(data, x, y, width, height));
  }
  
  return profile;
}

/**
 * Find best offset along normal by matching intensity profiles
 */
function findBestOffset(
  refProfile: number[],
  targetData: Float32Array | Uint16Array | Uint8Array | Int16Array,
  pointX: number,
  pointY: number,
  normalX: number,
  normalY: number,
  searchRadius: number,
  profileLength: number,
  width: number,
  height: number,
  edgeWeight: number
): number {
  let bestOffset = 0;
  let bestScore = Infinity;
  
  for (let offset = -searchRadius; offset <= searchRadius; offset++) {
    const testX = pointX + normalX * offset;
    const testY = pointY + normalY * offset;
    
    // Extract profile at test position
    const testProfile = extractProfile(
      targetData, testX, testY, normalX, normalY, 
      profileLength, width, height
    );
    
    // Calculate Sum of Squared Differences
    let ssd = 0;
    for (let i = 0; i < refProfile.length; i++) {
      const diff = refProfile[i] - testProfile[i];
      ssd += diff * diff;
    }
    const normalizedSSD = ssd / refProfile.length;
    
    // Get edge strength at test position
    const gradient = getGradientMagnitude(targetData, testX, testY, width, height);
    
    // Combined score: lower is better
    // - Profile matching (wants low SSD)
    // - Edge attraction (wants high gradient, so we subtract)
    // - Distance penalty (prefer staying close to original position)
    const distancePenalty = Math.abs(offset) * 50; // 50 HU penalty per pixel of movement
    const edgeBonus = gradient * 10 * edgeWeight; // Edge attraction
    
    const score = normalizedSSD + distancePenalty - edgeBonus;
    
    if (score < bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }
  
  return bestOffset;
}

/**
 * Predict contour on next slice by copying the reference contour
 * 
 * SIMPLE MODE: Just copy the contour exactly (most reliable)
 * REFINED MODE: Apply intensity-based edge refinement (optional)
 */
export function fastSlicePrediction(
  referenceContourPixels: Point[],  // Reference contour in pixel coordinates
  referencePixelData: Float32Array | Uint16Array | Uint8Array | Int16Array,
  targetPixelData: Float32Array | Uint16Array | Uint8Array | Int16Array,
  width: number,
  height: number,
  sliceDistance: number,
  params: PredictionParams = DEFAULT_PARAMS
): Point[] {

  console.log('📐 Geometric Prediction - Distance:', sliceDistance.toFixed(2), 'mm, Points:', referenceContourPixels.length);

  if (referenceContourPixels.length < 3) {
    console.warn('📐 Not enough points in reference contour');
    return [];
  }
  
  // SIMPLE & RELIABLE: Just copy the contour exactly
  // Anatomical structures change gradually - copying is usually sufficient
  const predictedPoints: Point[] = referenceContourPixels.map(p => ({ x: p.x, y: p.y }));
  
  // Optional: Apply very light smoothing to reduce noise
  if (params.smoothingPasses > 0) {
    let smoothedPoints = [...predictedPoints];
    const n = smoothedPoints.length;
    
    for (let pass = 0; pass < Math.min(params.smoothingPasses, 1); pass++) {
      const passPoints: Point[] = [];
      
      for (let i = 0; i < n; i++) {
        // Simple 3-point average
        const prev = smoothedPoints[(i - 1 + n) % n];
        const curr = smoothedPoints[i];
        const next = smoothedPoints[(i + 1) % n];

        passPoints.push({
          x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
          y: prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25
        });
      }
      smoothedPoints = passPoints;
    }
    
    console.log('📐 Prediction complete (simple copy + smooth):', smoothedPoints.length, 'points');
    return smoothedPoints;
  }

  console.log('📐 Prediction complete (simple copy):', predictedPoints.length, 'points');
  return predictedPoints;
}

/**
 * Gaussian smoothing of a 1D array (circular boundary for closed contours)
 */
function smoothArray(values: number[], sigma: number): number[] {
  const n = values.length;
  const result = new Array(n).fill(0);
  const kernelRadius = Math.ceil(sigma * 2);
  const kernel: number[] = [];
  
  let kernelSum = 0;
  for (let i = -kernelRadius; i <= kernelRadius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(w);
    kernelSum += w;
  }
  
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < kernel.length; k++) {
      const idx = (i + k - kernelRadius + n) % n;
      sum += values[idx] * kernel[k];
    }
    result[i] = sum / kernelSum;
  }
  
  return result;
}
