/**
 * Fast Arc-Length Interpolation for Contours
 * 
 * Uses arc-length parameterization for robust interpolation that works
 * with any contour shape (star-shaped, concave, irregular).
 * 
 * Much more robust than polar ray-casting for complex shapes.
 */

type Vec2 = [number, number];

/**
 * Calculate polygon centroid using shoelace formula
 */
function centroid(poly: Vec2[]): Vec2 {
  let a = 0, cx = 0, cy = 0;
  const n = poly.length;
  if (n === 0) return [0, 0];
  
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const c = x1 * y2 - x2 * y1;
    a += c;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    let sx = 0, sy = 0;
    for (const [x, y] of poly) { sx += x; sy += y; }
    return [sx / Math.max(1, n), sy / Math.max(1, n)];
  }
  
  return [cx / (6 * a), cy / (6 * a)];
}

/**
 * Calculate polygon area using shoelace formula
 */
function area(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

/**
 * Calculate cumulative arc lengths for a polygon
 */
function cumulativeArcLengths(poly: Vec2[]): number[] {
  const n = poly.length;
  const lengths = new Array(n + 1);
  lengths[0] = 0;
  
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    lengths[i + 1] = lengths[i] + Math.sqrt(dx * dx + dy * dy);
  }
  
  return lengths;
}

/**
 * Sample a polygon at uniform arc-length intervals
 */
function resampleByArcLength(poly: Vec2[], numSamples: number): Vec2[] {
  const n = poly.length;
  if (n < 3) return poly;
  
  const cumLengths = cumulativeArcLengths(poly);
  const totalLength = cumLengths[n];
  
  if (totalLength < 1e-9) return poly;
  
  const samples: Vec2[] = [];
  
  for (let i = 0; i < numSamples; i++) {
    const targetLen = (i / numSamples) * totalLength;
    
    // Find segment containing this arc length
    let segIdx = 0;
    for (let j = 1; j <= n; j++) {
      if (cumLengths[j] >= targetLen) {
        segIdx = j - 1;
        break;
      }
    }
    
    // Interpolate within segment
    const segStart = cumLengths[segIdx];
    const segEnd = cumLengths[segIdx + 1];
    const segLen = segEnd - segStart;
    
    let localT = 0;
    if (segLen > 1e-9) {
      localT = (targetLen - segStart) / segLen;
    }
    
    const p = poly[segIdx];
    const q = poly[(segIdx + 1) % n];
    
    samples.push([
      p[0] + (q[0] - p[0]) * localT,
      p[1] + (q[1] - p[1]) * localT
    ]);
  }
  
  return samples;
}

/**
 * Find the best starting point alignment between two polygons
 * Minimizes total point-to-point distance
 */
function findBestRotation(poly1: Vec2[], poly2: Vec2[]): number {
  const n = poly1.length;
  if (n !== poly2.length || n < 3) return 0;
  
  let bestOffset = 0;
  let bestDist = Infinity;
  
  // Try every possible starting offset (sample a subset for speed)
  const step = Math.max(1, Math.floor(n / 16));
  
  for (let offset = 0; offset < n; offset += step) {
    let totalDist = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + offset) % n;
      const dx = poly1[i][0] - poly2[j][0];
      const dy = poly1[i][1] - poly2[j][1];
      totalDist += dx * dx + dy * dy;
    }
    
    if (totalDist < bestDist) {
      bestDist = totalDist;
      bestOffset = offset;
    }
  }
  
  // Refine around best offset
  for (let delta = -step; delta <= step; delta++) {
    const offset = (bestOffset + delta + n) % n;
    let totalDist = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + offset) % n;
      const dx = poly1[i][0] - poly2[j][0];
      const dy = poly1[i][1] - poly2[j][1];
      totalDist += dx * dx + dy * dy;
    }
    
    if (totalDist < bestDist) {
      bestDist = totalDist;
      bestOffset = offset;
    }
  }
  
  return bestOffset;
}

/**
 * Convert flat 3D points array to 2D Vec2 array
 */
function to2D(points: number[]): Vec2[] {
  const result: Vec2[] = [];
  for (let i = 0; i < points.length; i += 3) {
    result.push([points[i], points[i + 1]]);
  }
  return result;
}

/**
 * Fast arc-length interpolation between two contours
 * 
 * Uses centroid-normalized interpolation to prevent bulging:
 * 1. Center both contours at origin (remove position)
 * 2. Interpolate the centered shapes
 * 3. Apply area correction to match expected area
 * 4. Move result to interpolated centroid position
 * 
 * @param contour1 - First contour points [x,y,z,...]
 * @param z1 - Z position of first contour
 * @param contour2 - Second contour points [x,y,z,...]
 * @param z2 - Z position of second contour
 * @param targetZ - Target Z position for interpolation
 * @param numSamples - Number of points in output (default: 128)
 * @returns Interpolated contour points [x,y,z,...]
 */
export function fastPolarInterpolate(
  contour1: number[],
  z1: number,
  contour2: number[],
  z2: number,
  targetZ: number,
  numSamples: number = 128
): number[] {
  if (!contour1?.length || !contour2?.length) return [];
  
  const t = (targetZ - z1) / (z2 - z1);
  if (!(t > 0 && t < 1)) return [];
  
  // Convert to 2D
  const poly1 = to2D(contour1);
  const poly2 = to2D(contour2);
  
  if (poly1.length < 3 || poly2.length < 3) return [];
  
  // Calculate centroids and areas of source polygons
  const c1 = centroid(poly1);
  const c2 = centroid(poly2);
  const area1 = area(poly1);
  const area2 = area(poly2);
  
  // Expected area at target Z (linear interpolation)
  const expectedArea = area1 + (area2 - area1) * t;
  
  // Interpolated centroid position
  const targetCx = c1[0] + (c2[0] - c1[0]) * t;
  const targetCy = c1[1] + (c2[1] - c1[1]) * t;
  
  // Center polygons at origin for shape-only interpolation
  const centered1: Vec2[] = poly1.map(([x, y]) => [x - c1[0], y - c1[1]]);
  const centered2: Vec2[] = poly2.map(([x, y]) => [x - c2[0], y - c2[1]]);
  
  // Resample both centered polygons to same number of points using arc-length
  const resampled1 = resampleByArcLength(centered1, numSamples);
  const resampled2 = resampleByArcLength(centered2, numSamples);
  
  // Find best rotation alignment
  const offset = findBestRotation(resampled1, resampled2);
  
  // Interpolate point-by-point (shape only, centered at origin)
  const interpolated: Vec2[] = [];
  
  for (let i = 0; i < numSamples; i++) {
    const j = (i + offset) % numSamples;
    const p1 = resampled1[i];
    const p2 = resampled2[j];
    
    const x = p1[0] + (p2[0] - p1[0]) * t;
    const y = p1[1] + (p2[1] - p1[1]) * t;
    
    interpolated.push([x, y]);
  }
  
  // Calculate actual area of interpolated polygon
  const actualArea = area(interpolated);
  
  // Always apply area correction (no threshold - always match expected area)
  let corrected = interpolated;
  if (actualArea > 1e-9 && expectedArea > 1e-9) {
    const scaleFactor = Math.sqrt(expectedArea / actualArea);
    corrected = interpolated.map(([x, y]) => [
      x * scaleFactor,
      y * scaleFactor
    ] as Vec2);
  }
  
  // Convert back to 3D result, repositioning at interpolated centroid
  const result: number[] = [];
  for (const [x, y] of corrected) {
    result.push(x + targetCx, y + targetCy, targetZ);
  }
  
  return result;
}

/**
 * Fast polar interpolation for multi-loop contours
 * Handles structures with multiple contours per slice by taking the largest
 * 
 * @param contoursA - Array of contours at z1
 * @param z1 - Z position of first slice
 * @param contoursB - Array of contours at z2
 * @param z2 - Z position of second slice
 * @param targetZ - Target Z position
 * @param bins - Number of angular bins (default: 128)
 * @returns Interpolated contour points [x,y,z,...]
 */
export function fastPolarInterpolateMulti(
  contoursA: Array<{ points: number[] }>,
  z1: number,
  contoursB: Array<{ points: number[] }>,
  z2: number,
  targetZ: number,
  bins: number = 128
): number[] {
  if (!contoursA?.length || !contoursB?.length) return [];
  
  // Select largest contour from each slice by area
  let largestA = contoursA[0];
  let maxAreaA = 0;
  for (const c of contoursA) {
    const poly = to2D(c.points);
    const a = area(poly);
    if (a > maxAreaA) {
      maxAreaA = a;
      largestA = c;
    }
  }
  
  let largestB = contoursB[0];
  let maxAreaB = 0;
  for (const c of contoursB) {
    const poly = to2D(c.points);
    const a = area(poly);
    if (a > maxAreaB) {
      maxAreaB = a;
      largestB = c;
    }
  }
  
  return fastPolarInterpolate(largestA.points, z1, largestB.points, z2, targetZ, bins);
}

