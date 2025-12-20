/**
 * Improved Contour Prediction with Interpolation and Scaling
 * 
 * Algorithm:
 * 1. Find contours on both sides of target slice (if available)
 * 2. Interpolate between them based on position
 * 3. Apply scaling based on observed area trends
 * 4. Optionally refine with edge detection
 * 5. Apply adaptive smoothing
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
const MAX_SLICE_DISTANCE = 5; // Increased max slices away to use as reference

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
 * Find contours on both sides of target slice for interpolation
 */
export function findBracketingContours(
  contours: Array<{ slicePosition: number; points: number[]; isPredicted?: boolean }>,
  targetSlice: number,
  sliceSpacing: number = 2.5
): { 
  before: { slicePosition: number; points: number[]; distance: number } | null;
  after: { slicePosition: number; points: number[]; distance: number } | null;
} {
  let before: { slicePosition: number; points: number[] } | null = null;
  let after: { slicePosition: number; points: number[] } | null = null;
  let beforeDist = Infinity;
  let afterDist = Infinity;
  
  for (const contour of contours) {
    if (contour.isPredicted) continue;
    if (!contour.points || contour.points.length < 9) continue;
    
    const dist = contour.slicePosition - targetSlice;
    
    // Skip if too close (same slice)
    if (Math.abs(dist) < 0.1) continue;
    
    // Check if within max distance
    const sliceCount = Math.abs(dist) / sliceSpacing;
    if (sliceCount > MAX_SLICE_DISTANCE) continue;
    
    if (dist < 0 && Math.abs(dist) < beforeDist) {
      // Before target (lower Z)
      beforeDist = Math.abs(dist);
      before = contour;
    } else if (dist > 0 && dist < afterDist) {
      // After target (higher Z)
      afterDist = dist;
      after = contour;
    }
  }
  
  return {
    before: before ? { ...before, distance: beforeDist } : null,
    after: after ? { ...after, distance: afterDist } : null
  };
}

/**
 * Calculate area of a contour using shoelace formula
 */
function calculateArea(contour: number[]): number {
  let area = 0;
  const n = contour.length / 3;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = contour[i * 3];
    const yi = contour[i * 3 + 1];
    const xj = contour[j * 3];
    const yj = contour[j * 3 + 1];
    area += xi * yj - xj * yi;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Resample a contour to have a specific number of points
 * This ensures both contours have same point count for interpolation
 */
function resampleContour(contour: number[], targetPointCount: number): number[] {
  const numPoints = contour.length / 3;
  if (numPoints === targetPointCount) return [...contour];
  
  // Calculate total perimeter
  let totalLength = 0;
  const lengths: number[] = [0];
  
  for (let i = 0; i < numPoints; i++) {
    const j = (i + 1) % numPoints;
    const dx = contour[j * 3] - contour[i * 3];
    const dy = contour[j * 3 + 1] - contour[i * 3 + 1];
    totalLength += Math.sqrt(dx * dx + dy * dy);
    lengths.push(totalLength);
  }
  
  // Sample at equal intervals
  const result: number[] = [];
  const z = contour[2]; // Use Z from first point
  
  for (let i = 0; i < targetPointCount; i++) {
    const targetDist = (i / targetPointCount) * totalLength;
    
    // Find segment containing this distance
    let segIdx = 0;
    for (let s = 0; s < numPoints; s++) {
      if (lengths[s + 1] >= targetDist) {
        segIdx = s;
        break;
      }
    }
    
    // Interpolate within segment
    const segStart = lengths[segIdx];
    const segEnd = lengths[segIdx + 1];
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (targetDist - segStart) / segLen : 0;
    
    const nextIdx = (segIdx + 1) % numPoints;
    const x = contour[segIdx * 3] + t * (contour[nextIdx * 3] - contour[segIdx * 3]);
    const y = contour[segIdx * 3 + 1] + t * (contour[nextIdx * 3 + 1] - contour[segIdx * 3 + 1]);
    
    result.push(x, y, z);
  }
  
  return result;
}

/**
 * Interpolate between two contours
 * t=0 gives contour1, t=1 gives contour2
 */
function interpolateContours(
  contour1: number[], 
  contour2: number[], 
  t: number,
  targetZ: number
): number[] {
  // Resample both to same point count (use average)
  const n1 = contour1.length / 3;
  const n2 = contour2.length / 3;
  const targetCount = Math.round((n1 + n2) / 2);
  
  const resampled1 = resampleContour(contour1, targetCount);
  const resampled2 = resampleContour(contour2, targetCount);
  
  // Align contours by finding best rotation offset
  // (minimize total distance between corresponding points)
  const centroid1 = getCentroid(resampled1);
  const centroid2 = getCentroid(resampled2);
  
  // Try different rotational alignments
  let bestOffset = 0;
  let bestScore = Infinity;
  
  for (let offset = 0; offset < targetCount; offset += Math.max(1, Math.floor(targetCount / 16))) {
    let score = 0;
    for (let i = 0; i < targetCount; i++) {
      const j = (i + offset) % targetCount;
      const dx = resampled1[i * 3] - resampled2[j * 3];
      const dy = resampled1[i * 3 + 1] - resampled2[j * 3 + 1];
      score += dx * dx + dy * dy;
    }
    if (score < bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }
  
  // Interpolate with best alignment
  const result: number[] = [];
  const oneMinusT = 1 - t;
  
  for (let i = 0; i < targetCount; i++) {
    const j = (i + bestOffset) % targetCount;
    const x = resampled1[i * 3] * oneMinusT + resampled2[j * 3] * t;
    const y = resampled1[i * 3 + 1] * oneMinusT + resampled2[j * 3 + 1] * t;
    result.push(x, y, targetZ);
  }
  
  return result;
}

/**
 * Scale a contour around its centroid
 */
function scaleContour(contour: number[], scaleFactor: number): number[] {
  const centroid = getCentroid(contour);
  const result: number[] = [];
  
  for (let i = 0; i < contour.length; i += 3) {
    const dx = contour[i] - centroid.x;
    const dy = contour[i + 1] - centroid.y;
    result.push(
      centroid.x + dx * scaleFactor,
      centroid.y + dy * scaleFactor,
      contour[i + 2]
    );
  }
  
  return result;
}

/**
 * Build a radial profile of a contour (distance from centroid at each angle)
 */
function buildRadialProfile(contour: number[], numSamples: number = 72): Float64Array {
  const centroid = getCentroid(contour);
  const profile = new Float64Array(numSamples);
  const counts = new Float64Array(numSamples);
  
  // Accumulate radii at each angle bin
  for (let i = 0; i < contour.length; i += 3) {
    const dx = contour[i] - centroid.x;
    const dy = contour[i + 1] - centroid.y;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const bin = Math.floor((normalizedAngle / (2 * Math.PI)) * numSamples) % numSamples;
    
    profile[bin] += radius;
    counts[bin]++;
  }
  
  // Average and fill gaps
  for (let i = 0; i < numSamples; i++) {
    if (counts[i] > 0) {
      profile[i] /= counts[i];
    }
  }
  
  // Fill gaps by interpolating from neighbors
  for (let i = 0; i < numSamples; i++) {
    if (counts[i] === 0) {
      // Find nearest filled bins
      let prevIdx = i - 1;
      let nextIdx = i + 1;
      while (prevIdx >= 0 && counts[prevIdx] === 0) prevIdx--;
      while (nextIdx < numSamples && counts[nextIdx] === 0) nextIdx++;
      
      if (prevIdx >= 0 && nextIdx < numSamples) {
        const t = (i - prevIdx) / (nextIdx - prevIdx);
        profile[i] = profile[prevIdx] * (1 - t) + profile[nextIdx] * t;
      } else if (prevIdx >= 0) {
        profile[i] = profile[prevIdx];
      } else if (nextIdx < numSamples) {
        profile[i] = profile[nextIdx];
      }
    }
  }
  
  return profile;
}

/**
 * Reconstruct contour from radial profile
 */
function profileToContour(
  profile: Float64Array, 
  centroid: { x: number; y: number }, 
  targetZ: number
): number[] {
  const result: number[] = [];
  const numSamples = profile.length;
  
  for (let i = 0; i < numSamples; i++) {
    const angle = (i / numSamples) * 2 * Math.PI;
    const radius = profile[i];
    const x = centroid.x + Math.cos(angle) * radius;
    const y = centroid.y + Math.sin(angle) * radius;
    result.push(x, y, targetZ);
  }
  
  return result;
}

interface TrendData {
  areaChangePerMm: number;
  centroidDriftPerMm: { x: number; y: number };
  profileTrendPerMm: Float64Array | null;
  numContours: number;
}

/**
 * Analyze trends from multiple contours on one side
 */
function analyzeTrends(
  contours: Array<{ slicePosition: number; points: number[]; isPredicted?: boolean }>,
  direction: 'before' | 'after', // Which side of target we're looking at
  targetSlice: number
): TrendData {
  // Filter and sort contours
  const validContours = contours
    .filter(c => !c.isPredicted && c.points && c.points.length >= 9)
    .map(c => ({
      ...c,
      area: calculateArea(c.points),
      centroid: getCentroid(c.points),
      profile: buildRadialProfile(c.points, 72)
    }))
    .filter(c => direction === 'before' 
      ? c.slicePosition < targetSlice 
      : c.slicePosition > targetSlice)
    .sort((a, b) => direction === 'before' 
      ? b.slicePosition - a.slicePosition  // Closest first for 'before'
      : a.slicePosition - b.slicePosition); // Closest first for 'after'
  
  if (validContours.length < 2) {
    return {
      areaChangePerMm: 0,
      centroidDriftPerMm: { x: 0, y: 0 },
      profileTrendPerMm: null,
      numContours: validContours.length
    };
  }
  
  // Use weighted linear regression for trends (weight by proximity)
  // For simplicity, use adjacent pairs and average
  let totalAreaChange = 0;
  let totalCentroidDriftX = 0;
  let totalCentroidDriftY = 0;
  let totalDistance = 0;
  const profileTrend = new Float64Array(72);
  let profilePairs = 0;
  
  for (let i = 1; i < Math.min(validContours.length, 4); i++) { // Use up to 4 contours
    const prev = validContours[i - 1];
    const curr = validContours[i];
    const dist = Math.abs(curr.slicePosition - prev.slicePosition);
    
    if (dist < 0.1) continue; // Skip if same slice
    
    // Direction: positive means "moving toward target"
    const sign = direction === 'before' ? -1 : 1;
    
    // Area change
    const areaChange = (curr.area - prev.area) / Math.max(prev.area, 1);
    totalAreaChange += areaChange * sign;
    
    // Centroid drift
    totalCentroidDriftX += (curr.centroid.x - prev.centroid.x) * sign;
    totalCentroidDriftY += (curr.centroid.y - prev.centroid.y) * sign;
    
    // Profile change (shape deformation)
    for (let j = 0; j < 72; j++) {
      profileTrend[j] += (curr.profile[j] - prev.profile[j]) * sign;
    }
    profilePairs++;
    
    totalDistance += dist;
  }
  
  if (totalDistance < 0.1) {
    return {
      areaChangePerMm: 0,
      centroidDriftPerMm: { x: 0, y: 0 },
      profileTrendPerMm: null,
      numContours: validContours.length
    };
  }
  
  // Normalize by distance
  const areaChangePerMm = totalAreaChange / totalDistance;
  const centroidDriftPerMm = {
    x: totalCentroidDriftX / totalDistance,
    y: totalCentroidDriftY / totalDistance
  };
  
  // Normalize profile trend
  if (profilePairs > 0) {
    for (let j = 0; j < 72; j++) {
      profileTrend[j] /= totalDistance;
    }
  }
  
  return {
    areaChangePerMm,
    centroidDriftPerMm,
    profileTrendPerMm: profilePairs > 0 ? profileTrend : null,
    numContours: validContours.length
  };
}

/**
 * Smart single-reference prediction with trend extrapolation
 * Uses area, centroid, and shape trends to predict the next slice
 */
export function predictContourSmart(
  contours: Array<{ slicePosition: number; points: number[]; isPredicted?: boolean }>,
  referenceContour: { slicePosition: number; points: number[] },
  targetSlice: number,
  sliceSpacing: number = 2.5
): SimplePredictionResult {
  const distToTarget = targetSlice - referenceContour.slicePosition;
  const direction = distToTarget > 0 ? 'after' : 'before';
  
  // Analyze trends from contours on the same side as reference
  const trends = analyzeTrends(contours, direction === 'after' ? 'before' : 'after', referenceContour.slicePosition);
  
  console.log(`🔮 Smart prediction: ${trends.numContours} contours for trend, dist=${distToTarget.toFixed(2)}mm`);
  
  // Get reference contour properties
  const refCentroid = getCentroid(referenceContour.points);
  const refProfile = buildRadialProfile(referenceContour.points, 72);
  const refArea = calculateArea(referenceContour.points);
  
  // Predict new centroid
  const predictedCentroid = {
    x: refCentroid.x + trends.centroidDriftPerMm.x * distToTarget,
    y: refCentroid.y + trends.centroidDriftPerMm.y * distToTarget
  };
  
  // Clamp centroid movement to reasonable range (max 10mm)
  const maxDrift = 10;
  const driftX = predictedCentroid.x - refCentroid.x;
  const driftY = predictedCentroid.y - refCentroid.y;
  const driftMag = Math.sqrt(driftX * driftX + driftY * driftY);
  if (driftMag > maxDrift) {
    const scale = maxDrift / driftMag;
    predictedCentroid.x = refCentroid.x + driftX * scale;
    predictedCentroid.y = refCentroid.y + driftY * scale;
  }
  
  // Predict new profile (shape)
  const predictedProfile = new Float64Array(72);
  let hasProfileTrend = false;
  
  if (trends.profileTrendPerMm) {
    hasProfileTrend = true;
    for (let i = 0; i < 72; i++) {
      const trendDelta = trends.profileTrendPerMm[i] * distToTarget;
      // Clamp individual radius changes to ±30%
      const maxChange = refProfile[i] * 0.3;
      const clampedDelta = Math.max(-maxChange, Math.min(maxChange, trendDelta));
      predictedProfile[i] = Math.max(0.5, refProfile[i] + clampedDelta);
    }
  } else {
    // Fallback: use area-based uniform scaling
    const predictedAreaChange = trends.areaChangePerMm * distToTarget;
    const scaleFactor = Math.sqrt(Math.max(0.5, Math.min(2.0, 1 + predictedAreaChange)));
    
    for (let i = 0; i < 72; i++) {
      predictedProfile[i] = refProfile[i] * scaleFactor;
    }
  }
  
  // Reconstruct contour from predicted profile and centroid
  const predictedContour = profileToContour(predictedProfile, predictedCentroid, targetSlice);
  
  // Apply smoothing
  const smoothed = smoothContour(predictedContour, 3);
  
  // Calculate confidence
  const sliceDistance = Math.abs(distToTarget) / sliceSpacing;
  let confidence = Math.max(0.3, 1 - sliceDistance * 0.12);
  
  // Boost confidence if we have good trend data
  if (trends.numContours >= 3) {
    confidence = Math.min(0.9, confidence + 0.15);
  } else if (trends.numContours >= 2) {
    confidence = Math.min(0.85, confidence + 0.08);
  }
  
  const method = hasProfileTrend 
    ? `smart_profile_${trends.numContours}ref` 
    : `smart_scale_${trends.numContours}ref`;
  
  console.log(`🔮 Smart prediction result: method=${method}, centroid drift=(${(predictedCentroid.x - refCentroid.x).toFixed(2)}, ${(predictedCentroid.y - refCentroid.y).toFixed(2)}), confidence=${confidence.toFixed(2)}`);
  
  return {
    contour: smoothed,
    confidence,
    referenceSlice: referenceContour.slicePosition,
    targetSlice,
    method
  };
}

/**
 * Improved prediction - uses interpolation when possible, smart extrapolation otherwise
 */
export function predictContourInterpolated(
  contours: Array<{ slicePosition: number; points: number[]; isPredicted?: boolean }>,
  targetSlice: number,
  sliceSpacing: number = 2.5
): SimplePredictionResult | null {
  const { before, after } = findBracketingContours(contours, targetSlice, sliceSpacing);
  
  // Case 1: We have contours on both sides - user has interpolation button for this
  // Just return null to let their interpolation handle it, or use simple copy
  if (before && after) {
    // User said they have interpolation - so we focus on single-reference case
    // But still provide a fallback in case they want this
    const totalDist = before.distance + after.distance;
    const t = before.distance / totalDist;
    
    const interpolated = interpolateContours(before.points, after.points, t, targetSlice);
    const smoothed = smoothContour(interpolated, 2);
    
    const maxDist = Math.max(before.distance, after.distance);
    const confidence = Math.max(0.6, 1 - (maxDist / sliceSpacing) * 0.08);
    
    return {
      contour: smoothed,
      confidence,
      referenceSlice: t < 0.5 ? before.slicePosition : after.slicePosition,
      targetSlice,
      method: 'interpolated'
    };
  }
  
  // Case 2: Only have contour on one side - use SMART prediction
  const reference = before || after;
  if (!reference) {
    console.log(`🔮 No reference contours found within ${MAX_SLICE_DISTANCE} slices`);
    return null;
  }
  
  // Use the new smart prediction with trend analysis
  return predictContourSmart(
    contours, 
    { slicePosition: reference.slicePosition, points: reference.points },
    targetSlice,
    sliceSpacing
  );
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
 * Main prediction function - uses interpolation with optional edge refinement
 */
export function generatePrediction(
  contours: Array<{ slicePosition: number; points: number[]; isPredicted?: boolean }>,
  targetSlice: number,
  sliceSpacing: number = 2.5,
  targetImageData?: ImageDataForPrediction,
  transforms?: CoordinateTransforms
): SimplePredictionResult | null {
  // First try interpolated prediction (new improved method)
  const interpolatedResult = predictContourInterpolated(contours, targetSlice, sliceSpacing);
  
  if (!interpolatedResult || interpolatedResult.contour.length < 9) {
    console.log(`🔮 Interpolated prediction failed, falling back to nearest contour`);
    
    // Fallback to original method
    const nearest = findNearestContour(contours, targetSlice, sliceSpacing);
    if (!nearest) {
      console.log(`🔮 No contour found within ${MAX_SLICE_DISTANCE} slices of ${targetSlice.toFixed(2)}`);
      return null;
    }
    
    return predictContourSimple(nearest.points, nearest.slicePosition, targetSlice);
  }
  
  console.log(`🔮 Prediction: ${interpolatedResult.method} with ${interpolatedResult.contour.length / 3} points`);
  
  // Optionally refine with edge detection if we have image data
  // Only do this for non-interpolated results (interpolated is usually good enough)
  if (targetImageData && transforms && interpolatedResult.method !== 'interpolated') {
    const edgeResult = predictContourWithEdges(
      interpolatedResult.contour,
      interpolatedResult.referenceSlice,
      targetSlice,
      targetImageData,
      transforms,
      { searchRadius: 5 } // Smaller search radius when we already have a good prediction
    );
    
    if (edgeResult.contour.length >= 9) {
      edgeResult.method = `${interpolatedResult.method}+edge`;
      edgeResult.confidence = Math.max(edgeResult.confidence, interpolatedResult.confidence);
      return edgeResult;
    }
  }
  
  return interpolatedResult;
}
