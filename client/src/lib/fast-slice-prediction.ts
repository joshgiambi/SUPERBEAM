/**
 * Fast next-slice prediction using nearest contour copying with geometric adjustments
 * Simple, predictable approach: copy nearest slice and apply minor adjustments
 */

interface Point {
  x: number;
  y: number;
}

export interface PredictionParams {
  // Simplified parameters for nearest-contour approach
  scaleAdjustmentFactor: number;  // How much to scale based on distance (0.01 = 1% per mm)
  maxScaleChange: number;  // Maximum scale change allowed (0.2 = ±20%)
  centroidDriftFactor: number;  // How much centroid can drift (pixels per mm)
  smoothingPasses: number;  // Number of smoothing passes
  useIntensityRefinement: boolean;  // Whether to use intensity-based edge refinement
  intensityTolerance: number;  // HU tolerance for intensity refinement
}

export const DEFAULT_PARAMS: PredictionParams = {
  scaleAdjustmentFactor: 0.005,  // 0.5% scale change per mm
  maxScaleChange: 0.15,  // ±15% max scale change
  centroidDriftFactor: 0.5,  // 0.5 pixels drift per mm
  smoothingPasses: 3,
  useIntensityRefinement: false,  // Keep it simple by default
  intensityTolerance: 150,  // HU tolerance for edge detection
};

/**
 * Predict contour on next slice by copying nearest contour with geometric adjustments
 * Simple, predictable approach based on nearest neighbor interpolation
 */
export function fastSlicePrediction(
  referenceContourPixels: Point[],  // Reference contour in pixel coordinates
  referencePixelData: Float32Array | Uint16Array | Uint8Array,
  targetPixelData: Float32Array | Uint16Array | Uint8Array,
  width: number,
  height: number,
  sliceDistance: number,
  params: PredictionParams = DEFAULT_PARAMS
): Point[] {

  console.log('🎯 Nearest-Contour Prediction - Distance:', sliceDistance, 'mm');

  if (referenceContourPixels.length < 3) {
    return [];
  }
  
  // STEP 2: Calculate reference contour centroid for geometric adjustments
  let sumX = 0, sumY = 0;
  for (const p of referenceContourPixels) {
    sumX += p.x;
    sumY += p.y;
  }
  const refCentroidX = sumX / referenceContourPixels.length;
  const refCentroidY = sumY / referenceContourPixels.length;
  
  console.log('🎯 Reference centroid:', { x: refCentroidX.toFixed(1), y: refCentroidY.toFixed(1) });
  
  // STEP 3: Apply geometric adjustments based on slice distance
  const absDistance = Math.abs(sliceDistance);
  
  // Calculate scale adjustment: structures typically shrink/grow slightly between slices
  // Use conservative adjustment factor to avoid dramatic changes
  const scaleChange = absDistance * params.scaleAdjustmentFactor;
  const clampedScaleChange = Math.min(scaleChange, params.maxScaleChange);
  
  // For most anatomy, structures get smaller moving superior (positive Z)
  // This is a general trend but user can adjust via params
  const scaleFactor = sliceDistance > 0 
    ? (1 - clampedScaleChange)  // Moving up → slightly smaller
    : (1 + clampedScaleChange); // Moving down → slightly larger
  
  // Calculate centroid drift: allow minor positional shifts
  const driftX = sliceDistance * params.centroidDriftFactor * (Math.random() - 0.5) * 0.5;
  const driftY = sliceDistance * params.centroidDriftFactor * (Math.random() - 0.5) * 0.5;
  
  console.log('🎯 Adjustments:', { 
    scaleFactor: scaleFactor.toFixed(3), 
    drift: { x: driftX.toFixed(2), y: driftY.toFixed(2) } 
  });
  
  // STEP 4: Apply transformations to copied contour
  for (let i = 0; i < predictedPoints.length; i++) {
    // Translate to origin (relative to centroid)
    const relX = predictedPoints[i].x - refCentroidX;
    const relY = predictedPoints[i].y - refCentroidY;
    
    // Apply scale
    const scaledX = relX * scaleFactor;
    const scaledY = relY * scaleFactor;
    
    // Translate back and add drift
    predictedPoints[i].x = refCentroidX + scaledX + driftX;
    predictedPoints[i].y = refCentroidY + scaledY + driftY;
  }
  
  // STEP 5: Apply smoothing for clinical-quality contours
  let smoothedPoints = [...predictedPoints];

  for (let pass = 0; pass < params.smoothingPasses; pass++) {
    const passPoints: Point[] = [];
    for (let i = 0; i < smoothedPoints.length; i++) {
      // Use 5-point window for stronger smoothing
      const prev2 = smoothedPoints[(i - 2 + smoothedPoints.length) % smoothedPoints.length];
      const prev = smoothedPoints[(i - 1 + smoothedPoints.length) % smoothedPoints.length];
      const curr = smoothedPoints[i];
      const next = smoothedPoints[(i + 1) % smoothedPoints.length];
      const next2 = smoothedPoints[(i + 2) % smoothedPoints.length];

      // Weighted average with emphasis on current point
      passPoints.push({
        x: (prev2.x * 0.05 + prev.x * 0.2 + curr.x * 0.5 + next.x * 0.2 + next2.x * 0.05),
        y: (prev2.y * 0.05 + prev.y * 0.2 + curr.y * 0.5 + next.y * 0.2 + next2.y * 0.05)
      });
    }
    smoothedPoints = passPoints;
  }

  return smoothedPoints;
}
