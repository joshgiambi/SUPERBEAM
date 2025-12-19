/**
 * First-Principles Shape & Pattern Prediction
 * 
 * Approach: "Profile-Guided Elastic Deformation"
 * 
 * Instead of relying on generic "edges" (which exist everywhere inside organs) or 
 * complex optical flow (which drifts), this algorithm uses the SPECIFIC intensity 
 * profile of the user's existing contour to find the corresponding boundary on the next slice.
 * 
 * 1. Signature Extraction: For every point on the reference contour, we extract a 
 *    1D intensity profile perpendicular to the boundary (e.g., "Dark-to-Light transition").
 * 2. Profile Scanning: We scan along the normal vector in the target image to find 
 *    where this specific transition pattern occurs.
 * 3. Elastic Constraint: The independent point matches are smoothed heavily to 
 *    preserve the structural integrity of the organ (preventing points from flying off).
 */

import { ImageData } from './image-aware-prediction';

// --- Types ---

export interface Point {
  x: number;
  y: number;
}

export interface PredictionContext {
  currentContour: Point[]; // World coordinates
  referenceImage: ImageData;
  targetImage: ImageData;
  worldToPixel: (x: number, y: number) => [number, number];
  pixelToWorld: (x: number, y: number) => [number, number];
}

export interface RobustConfig {
  profileLength: number; // Length of intensity profile (pixels). Odd number.
  searchRadius: number;  // How far to search for match (pixels).
  smoothnessSigma: number; // Strength of shape preservation (neighbors smoothing).
  edgeAttraction: number; // 0-1: How much to favor strong gradients vs just profile matching.
}

export const DEFAULT_CONFIG: RobustConfig = {
  profileLength: 15,     // 7 pixels in, 7 pixels out. Captures the "transition".
  searchRadius: 12,      // Look +/- 12 pixels along normal.
  smoothnessSigma: 4.0,  // Strong smoothing to keep points together.
  edgeAttraction: 0.3    // Slight bias towards sharp edges, but rely mostly on profile.
};

// --- Math Helpers ---

function getPixelValue(img: ImageData, x: number, y: number): number {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= img.width || iy < 0 || iy >= img.height) return -1000;
  return img.pixels[iy * img.width + ix];
}

// Gaussian smoothing of a 1D array (circular boundary conditions for closed contours)
function smoothArray(values: number[], sigma: number): number[] {
  const n = values.length;
  const result = new Array(n).fill(0);
  const kernelRadius = Math.ceil(sigma * 3);
  const kernel = new Array(kernelRadius * 2 + 1);
  
  let kernelSum = 0;
  for (let i = -kernelRadius; i <= kernelRadius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + kernelRadius] = w;
    kernelSum += w;
  }
  
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -kernelRadius; k <= kernelRadius; k++) {
      const idx = (i + k + n) % n; // Wrap around
      sum += values[idx] * kernel[k + kernelRadius];
    }
    result[i] = sum / kernelSum;
  }
  
  return result;
}

function resampleContour(points: Point[], spacing: number = 2.0): Point[] {
  if (points.length < 2) return points;
  
  const lengths: number[] = [0];
  let totalLen = 0;
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const dist = Math.hypot(next.x - curr.x, next.y - curr.y);
    totalLen += dist;
    lengths.push(totalLen);
  }
  
  const count = Math.ceil(totalLen / spacing);
  const newPoints: Point[] = [];
  const step = totalLen / count;
  
  let srcIdx = 0;
  for (let i = 0; i < count; i++) {
    const targetDist = i * step;
    while (srcIdx < lengths.length - 1 && lengths[srcIdx + 1] < targetDist) {
      srcIdx++;
    }
    const segmentStart = lengths[srcIdx];
    const segmentLen = lengths[srcIdx + 1] - segmentStart;
    const t = segmentLen > 0 ? (targetDist - segmentStart) / segmentLen : 0;
    
    const p1 = points[srcIdx % points.length];
    const p2 = points[(srcIdx + 1) % points.length];
    
    newPoints.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    });
  }
  return newPoints;
}

// --- Core Logic ---

export function robustPredict(
  ctx: PredictionContext, 
  config: Partial<RobustConfig> = {}
): Point[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // 1. Convert to Pixel Space & Resample
  // We need dense, even spacing to run the profile physics correctly.
  const rawPixelPoints = ctx.currentContour.map(p => {
    const [px, py] = ctx.worldToPixel(p.x, p.y);
    return { x: px, y: py };
  });
  
  const points = resampleContour(rawPixelPoints, 2.0); // 2px spacing
  const n = points.length;
  
  if (n < 10) return rawPixelPoints; // Too small to process
  
  // Arrays to store our calculations
  const normals: Point[] = new Array(n);
  const displacements: number[] = new Array(n).fill(0);
  
  // 2. Compute Normals and Reference Profiles
  // We pre-calculate the "Signature" of the boundary at every point.
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    
    // Tangent
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    
    // Normal (rotated 90 deg) - pointing OUTWARDS (assuming CW/CCW consistency)
    // We don't actually care if it's in or out, as long as it's consistent scanning.
    normals[i] = { x: -ty / len, y: tx / len };
    
    const p = points[i];
    const normal = normals[i];
    
    // Extract Reference Profile
    const refProfile: number[] = [];
    const halfLen = Math.floor(cfg.profileLength / 2);
    
    for (let k = -halfLen; k <= halfLen; k++) {
      refProfile.push(getPixelValue(ctx.referenceImage, p.x + normal.x * k, p.y + normal.y * k));
    }
    
    // 3. Search for Match in Target Image
    // Scan along the normal line in the target image to find the most similar profile.
    let bestScore = Infinity;
    let bestOffset = 0;
    
    for (let offset = -cfg.searchRadius; offset <= cfg.searchRadius; offset++) {
      // Extract Target Profile candidate
      const centerX = p.x + normal.x * offset;
      const centerY = p.y + normal.y * offset;
      
      let ssd = 0; // Sum of Squared Differences
      let validPixels = 0;
      
      for (let k = -halfLen; k <= halfLen; k++) {
        const valRef = refProfile[k + halfLen];
        const valTgt = getPixelValue(ctx.targetImage, centerX + normal.x * k, centerY + normal.y * k);
        
        if (valRef > -1000 && valTgt > -1000) {
          const diff = valRef - valTgt;
          ssd += diff * diff;
          validPixels++;
        }
      }
      
      if (validPixels > 0) {
        const normalizedSSD = ssd / validPixels;
        
        // Distance penalty: We prefer the contour NOT to move if possible.
        // This acts as a spring force to the original position.
        const distancePenalty = Math.abs(offset) * 100; // Weight of 100 HU per pixel of movement
        
        const totalScore = normalizedSSD + distancePenalty;
        
        if (totalScore < bestScore) {
          bestScore = totalScore;
          bestOffset = offset;
        }
      }
    }
    
    displacements[i] = bestOffset;
  }
  
  // 4. Smooth Displacements (Elasticity)
  // This is the "Rubber Band" effect. Individual points might match noise, 
  // but the average of neighbors will match the structure.
  const smoothedDisplacements = smoothArray(displacements, cfg.smoothnessSigma);
  
  // 5. Apply Deformations
  const prediction: Point[] = [];
  for (let i = 0; i < n; i++) {
    const d = smoothedDisplacements[i];
    const p = points[i];
    const normal = normals[i];
    
    // Clamp movement to prevent explosions
    const clampedD = Math.max(-cfg.searchRadius, Math.min(cfg.searchRadius, d));
    
    prediction.push({
      x: p.x + normal.x * clampedD,
      y: p.y + normal.y * clampedD
    });
  }
  
  // 6. Convert back to World Coordinates
  return prediction.map(p => {
    const [wx, wy] = ctx.pixelToWorld(p.x, p.y);
    return { x: wx, y: wy };
  });
}
