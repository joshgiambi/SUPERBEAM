/**
 * Simple Contour Prediction with Edge Detection
 * 
 * Algorithm:
 * 1. Find the nearest contour (within max distance)
 * 2. Copy and slightly expand it
 * 3. Snap each point to the nearest intensity edge
 * 4. Smooth the result
 */

export interface SimplePredictionResult {
  contour: number[];  // [x, y, z, x, y, z, ...]
  confidence: number;
  referenceSlice: number;
  targetSlice: number;
  method: string;
}

export interface ImageDataForPrediction {
  pixels: Float32Array | Uint16Array | Uint8Array | Int16Array;
  width: number;
  height: number;
}

export interface CoordinateTransforms {
  worldToPixel: (x: number, y: number) => [number, number];
  pixelToWorld: (px: number, py: number) => [number, number];
}

/**
 * Configuration
 */
const MAX_SLICE_DISTANCE = 3; // Max slices away to use as reference

/**
 * Apply Gaussian-like smoothing to a contour
 */
function smoothContour(points: number[], passes: number = 2): number[] {
  if (points.length < 15) return [...points]; // Need at least 5 points
  
  const numPoints = points.length / 3;
  let result = [...points];
  
  for (let pass = 0; pass < passes; pass++) {
    const smoothed = new Array(points.length);
    
    for (let i = 0; i < numPoints; i++) {
      const p2 = ((i - 2) + numPoints) % numPoints;
      const p1 = ((i - 1) + numPoints) % numPoints;
      const n1 = (i + 1) % numPoints;
      const n2 = (i + 2) % numPoints;
      
      const idx = i * 3;
      
      // Gaussian-like weights: [0.1, 0.2, 0.4, 0.2, 0.1]
      smoothed[idx] = 
        result[p2 * 3] * 0.1 + 
        result[p1 * 3] * 0.2 + 
        result[idx] * 0.4 + 
        result[n1 * 3] * 0.2 + 
        result[n2 * 3] * 0.1;
      
      smoothed[idx + 1] = 
        result[p2 * 3 + 1] * 0.1 + 
        result[p1 * 3 + 1] * 0.2 + 
        result[idx + 1] * 0.4 + 
        result[n1 * 3 + 1] * 0.2 + 
        result[n2 * 3 + 1] * 0.1;
      
      // Keep Z coordinate unchanged
      smoothed[idx + 2] = result[idx + 2];
    }
    
    result = smoothed;
  }
  
  return result;
}

/**
 * Find the nearest contour to a target slice position
 */
export function findNearestContour(
  contours: Array<{ slicePosition: number; points: number[]; isPredicted?: boolean }>,
  targetSlice: number,
  sliceSpacing: number = 2.5
): { slicePosition: number; points: number[]; sliceDistance: number } | null {
  let nearest: { slicePosition: number; points: number[] } | null = null;
  let nearestDist = Infinity;
  
  for (const contour of contours) {
    // Skip predicted contours and invalid ones
    if (contour.isPredicted) continue;
    if (!contour.points || contour.points.length < 9) continue;
    
    const dist = Math.abs(contour.slicePosition - targetSlice);
    
    // Must be at least 0.1mm away (not the same slice)
    if (dist > 0.1 && dist < nearestDist) {
      nearestDist = dist;
      nearest = contour;
    }
  }
  
  if (!nearest) return null;
  
  // Check if within max slice distance
  const sliceDistance = nearestDist / sliceSpacing;
  if (sliceDistance > MAX_SLICE_DISTANCE) {
    console.log(`🔮 Nearest contour is ${sliceDistance.toFixed(1)} slices away (max: ${MAX_SLICE_DISTANCE}), skipping prediction`);
    return null;
  }
  
  return {
    ...nearest,
    sliceDistance
  };
}

/**
 * Get the centroid of a contour
 */
function getCentroid(contour: number[]): { x: number; y: number } {
  let sumX = 0, sumY = 0;
  const numPoints = contour.length / 3;
  
  for (let i = 0; i < contour.length; i += 3) {
    sumX += contour[i];
    sumY += contour[i + 1];
  }
  
  return { x: sumX / numPoints, y: sumY / numPoints };
}

/**
 * Expand contour outward from centroid by a percentage
 */
function expandContour(contour: number[], expansionFactor: number = 1.05): number[] {
  const centroid = getCentroid(contour);
  const expanded: number[] = [];
  
  for (let i = 0; i < contour.length; i += 3) {
    const x = contour[i];
    const y = contour[i + 1];
    const z = contour[i + 2];
    
    // Vector from centroid to point
    const dx = x - centroid.x;
    const dy = y - centroid.y;
    
    // Expand outward
    expanded.push(
      centroid.x + dx * expansionFactor,
      centroid.y + dy * expansionFactor,
      z
    );
  }
  
  return expanded;
}

/**
 * Snap contour points to nearest intensity edges
 * Uses gradient-based edge detection
 */
function snapToEdges(
  contour: number[],
  imageData: ImageDataForPrediction,
  transforms: CoordinateTransforms,
  searchRadius: number = 8 // pixels to search
): number[] {
  const { pixels, width, height } = imageData;
  const result: number[] = [];
  const numPoints = contour.length / 3;
  
  // Get intensity at centroid as reference
  const centroid = getCentroid(contour);
  const [cx, cy] = transforms.worldToPixel(centroid.x, centroid.y);
  const cxi = Math.round(cx), cyi = Math.round(cy);
  const centerIntensity = (cxi >= 0 && cxi < width && cyi >= 0 && cyi < height) 
    ? pixels[cyi * width + cxi] 
    : 0;
  
  // Calculate gradient magnitude at a pixel
  const getGradient = (px: number, py: number): number => {
    const x = Math.round(px), y = Math.round(py);
    if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return 0;
    
    // Sobel gradient
    const gx = 
      -pixels[(y-1) * width + (x-1)] + pixels[(y-1) * width + (x+1)] +
      -2 * pixels[y * width + (x-1)] + 2 * pixels[y * width + (x+1)] +
      -pixels[(y+1) * width + (x-1)] + pixels[(y+1) * width + (x+1)];
    
    const gy = 
      -pixels[(y-1) * width + (x-1)] - 2 * pixels[(y-1) * width + x] - pixels[(y-1) * width + (x+1)] +
       pixels[(y+1) * width + (x-1)] + 2 * pixels[(y+1) * width + x] + pixels[(y+1) * width + (x+1)];
    
    return Math.sqrt(gx * gx + gy * gy);
  };
  
  for (let i = 0; i < numPoints; i++) {
    const idx = i * 3;
    const worldX = contour[idx];
    const worldY = contour[idx + 1];
    const worldZ = contour[idx + 2];
    
    const [px, py] = transforms.worldToPixel(worldX, worldY);
    
    // Calculate normal direction (perpendicular to contour)
    const prevIdx = ((i - 1 + numPoints) % numPoints) * 3;
    const nextIdx = ((i + 1) % numPoints) * 3;
    
    const [prevPx, prevPy] = transforms.worldToPixel(contour[prevIdx], contour[prevIdx + 1]);
    const [nextPx, nextPy] = transforms.worldToPixel(contour[nextIdx], contour[nextIdx + 1]);
    
    // Tangent direction
    const tx = nextPx - prevPx;
    const ty = nextPy - prevPy;
    const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
    
    // Normal direction (perpendicular)
    const nx = -ty / tLen;
    const ny = tx / tLen;
    
    // Search along normal for highest gradient (the edge)
    let bestDist = 0;
    let bestGradient = getGradient(px, py);
    
    // Only search a small range to avoid jumping to distant edges
    for (let d = -searchRadius; d <= searchRadius; d += 0.5) {
      const testPx = px + nx * d;
      const testPy = py + ny * d;
      
      const grad = getGradient(testPx, testPy);
      
      // Prefer edges closer to original position
      const distancePenalty = Math.abs(d) * 0.5;
      const score = grad - distancePenalty;
      
      if (score > bestGradient) {
        bestGradient = score;
        bestDist = d;
      }
    }
    
    // Limit movement to prevent wild jumps
    const maxMove = 3; // pixels
    bestDist = Math.max(-maxMove, Math.min(maxMove, bestDist));
    
    // Apply the displacement
    const finalPx = px + nx * bestDist;
    const finalPy = py + ny * bestDist;
    
    const [finalWorldX, finalWorldY] = transforms.pixelToWorld(finalPx, finalPy);
    result.push(finalWorldX, finalWorldY, worldZ);
  }
  
  return result;
}

/**
 * Predict contour for target slice - simple copy
 */
export function predictContourSimple(
  referenceContour: number[],
  referenceSlice: number,
  targetSlice: number
): SimplePredictionResult {
  if (!referenceContour || referenceContour.length < 9) {
    return {
      contour: [],
      confidence: 0,
      referenceSlice,
      targetSlice,
      method: 'failed'
    };
  }
  
  // Copy contour and set Z to target slice
  const copied: number[] = [];
  for (let i = 0; i < referenceContour.length; i += 3) {
    copied.push(
      referenceContour[i],      // X
      referenceContour[i + 1],  // Y
      targetSlice               // Z = target slice
    );
  }
  
  // Apply smoothing
  const smoothed = smoothContour(copied, 2);
  
  // Calculate confidence based on distance
  const distance = Math.abs(targetSlice - referenceSlice);
  const confidence = Math.max(0.3, 1 - distance * 0.02);
  
  return {
    contour: smoothed,
    confidence,
    referenceSlice,
    targetSlice,
    method: 'simple_copy'
  };
}

/**
 * Predict contour with edge detection refinement
 */
export function predictContourWithEdges(
  referenceContour: number[],
  referenceSlice: number,
  targetSlice: number,
  targetImageData: ImageDataForPrediction,
  transforms: CoordinateTransforms,
  options: {
    searchRadius?: number;
  } = {}
): SimplePredictionResult {
  const {
    searchRadius = 8  // Search 8 pixels for edges, max move of 3px
  } = options;
  
  if (!referenceContour || referenceContour.length < 9) {
    return {
      contour: [],
      confidence: 0,
      referenceSlice,
      targetSlice,
      method: 'failed'
    };
  }
  
  console.log(`🔮 Edge prediction: ${referenceContour.length / 3} points, search=${searchRadius}px`);
  
  // Step 1: Copy contour to target slice (no expansion)
  const copied: number[] = [];
  for (let i = 0; i < referenceContour.length; i += 3) {
    copied.push(
      referenceContour[i],
      referenceContour[i + 1],
      targetSlice
    );
  }
  
  // Step 2: Snap to edges using gradient detection
  const snapped = snapToEdges(copied, targetImageData, transforms, searchRadius);
  
  // Step 3: Smooth the result
  const smoothed = smoothContour(snapped, 2);
  
  // Calculate confidence
  const distance = Math.abs(targetSlice - referenceSlice);
  const confidence = Math.max(0.4, 1 - distance * 0.015);
  
  console.log(`🔮 Edge prediction complete: ${smoothed.length / 3} points`);
  
  return {
    contour: smoothed,
    confidence,
    referenceSlice,
    targetSlice,
    method: 'edge_snap'
  };
}

/**
 * Main prediction function - uses edge detection if image data available
 */
export function generatePrediction(
  contours: Array<{ slicePosition: number; points: number[]; isPredicted?: boolean }>,
  targetSlice: number,
  sliceSpacing: number = 2.5,
  targetImageData?: ImageDataForPrediction,
  transforms?: CoordinateTransforms
): SimplePredictionResult | null {
  // Find nearest contour (with distance limit)
  const nearest = findNearestContour(contours, targetSlice, sliceSpacing);
  
  if (!nearest) {
    console.log(`🔮 No contour found within ${MAX_SLICE_DISTANCE} slices of ${targetSlice.toFixed(2)}`);
    return null;
  }
  
  console.log(`🔮 Predicting for slice ${targetSlice.toFixed(2)} using reference from ${nearest.slicePosition.toFixed(2)} (${nearest.sliceDistance.toFixed(1)} slices, ${nearest.points.length / 3} points)`);
  
  // Use edge detection if we have image data
  if (targetImageData && transforms) {
    return predictContourWithEdges(
      nearest.points,
      nearest.slicePosition,
      targetSlice,
      targetImageData,
      transforms
    );
  }
  
  // Fallback to simple copy
  return predictContourSimple(nearest.points, nearest.slicePosition, targetSlice);
}
