/**
 * Block Matching (Optical Flow) Prediction Engine
 * 
 * "Video Game Style" Motion Estimation for Medical Contours
 * 
 * Principle:
 * Instead of trying to find "edges" (which are noisy and ambiguous), we track the 
 * TISSUE TEXTURE itself. We assume the tissue inside/around the contour moves
 * coherently to the next slice.
 * 
 * 1. Divide contour into key points.
 * 2. For each point, grab a texture patch from the current slice.
 * 3. "Search" for that same texture patch in the next slice (Block Matching).
 * 4. This gives us a "Motion Vector" for every point.
 * 5. Smooth these vectors to ensure the contour deforms organically (like a soft body).
 */

import { ImageData } from './image-aware-prediction';

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

export interface BlockMatchConfig {
  blockSize: number; // Size of texture patch (odd number, e.g. 9)
  searchRadius: number; // How far to look for the patch (e.g. 12)
  vectorSmoothing: number; // Sigma for smoothing the motion field
  gridSampling: number; // Distance between samples (pixels)
}

const DEFAULT_CONFIG: BlockMatchConfig = {
  blockSize: 11,      // 11x11 patch (good for texture capture)
  searchRadius: 10,   // Search +/- 10 pixels
  vectorSmoothing: 2.0, // Strong smoothing for coherent motion
  gridSampling: 2.0     // Sample every 2 pixels along contour
};

// --- Helpers ---

function getPixelIntensity(img: ImageData, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= img.width || iy < 0 || iy >= img.height) return -1000;
  const idx = iy * img.width + ix;
  return img.pixels[idx]; // Raw pixel value (faster)
}

/**
 * Find the best match for a patch from imgA within a window in imgB
 * Returns the displacement vector {dx, dy}
 */
function findBestMatch(
  x: number, y: number,
  imgA: ImageData,
  imgB: ImageData,
  blockSize: number,
  searchRadius: number
): { dx: number, dy: number, score: number } {
  const halfBlock = Math.floor(blockSize / 2);
  
  let bestSAD = Infinity;
  let bestDX = 0;
  let bestDY = 0;
  
  // Extract Template (Patch from Image A)
  // Optimization: We could cache this, but for just a contour it's fast enough
  const template: number[] = [];
  for (let py = -halfBlock; py <= halfBlock; py++) {
    for (let px = -halfBlock; px <= halfBlock; px++) {
      template.push(getPixelIntensity(imgA, x + px, y + py));
    }
  }
  
  // Search in Image B
  for (let dy = -searchRadius; dy <= searchRadius; dy += 2) { // Step 2 optimization
    for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
      
      let sad = 0; // Sum of Absolute Differences
      let tIdx = 0;
      
      // Compare patches
      // We can also break early if SAD exceeds bestSAD
      for (let py = -halfBlock; py <= halfBlock; py++) {
        for (let px = -halfBlock; px <= halfBlock; px++) {
          const valB = getPixelIntensity(imgB, x + dx + px, y + dy + py);
          sad += Math.abs(template[tIdx++] - valB);
        }
      }
      
      if (sad < bestSAD) {
        bestSAD = sad;
        bestDX = dx;
        bestDY = dy;
      }
    }
  }
  
  // Refine (Sub-pixel check around best integer match) if needed
  // For now, integer precision is likely fine for "robustness"
  
  return { dx: bestDX, dy: bestDY, score: bestSAD };
}

/**
 * Smooth a field of vectors using a Gaussian kernel
 * This is CRITICAL for preventing "explosions"
 */
function smoothVectors(vectors: {dx: number, dy: number}[], sigma: number): {dx: number, dy: number}[] {
  const n = vectors.length;
  const smoothed: {dx: number, dy: number}[] = [];
  
  // Simple 1D Gaussian kernel approximation
  // sigma=1 -> [0.25, 0.5, 0.25] roughly
  // We'll use a wider window based on sigma
  const window = Math.ceil(sigma * 3);
  
  for (let i = 0; i < n; i++) {
    let sumDX = 0;
    let sumDY = 0;
    let sumWeight = 0;
    
    for (let j = -window; j <= window; j++) {
      const idx = (i + j + n) % n; // Circular buffer
      
      // Gaussian weight
      const weight = Math.exp(-(j * j) / (2 * sigma * sigma));
      
      sumDX += vectors[idx].dx * weight;
      sumDY += vectors[idx].dy * weight;
      sumWeight += weight;
    }
    
    smoothed.push({
      dx: sumDX / sumWeight,
      dy: sumDY / sumWeight
    });
  }
  
  return smoothed;
}

// --- Validation ---

function isSimplePolygon(points: Point[]): boolean {
  // Check for self-intersection
  // O(N^2) naive check is fine for N < 200
  const n = points.length;
  if (n < 4) return true;
  
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // Adjacent
      
      const p3 = points[j];
      const p4 = points[(j + 1) % n];
      
      if (linesIntersect(p1, p2, p3, p4)) {
        return false;
      }
    }
  }
  return true;
}

function linesIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const det = (b.x - a.x) * (d.y - c.y) - (d.x - c.x) * (b.y - a.y);
  if (det === 0) return false;
  
  const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
  const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
  
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

function calculateArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

// --- Main Pipeline ---

export function blockMatchingPrediction(ctx: PredictionContext): Point[] {
  // 1. Resample contour to pixel-dense spacing
  // We need dense points to track texture well
  // Just use the vertices we have if they are dense enough, or upsample
  const contourPixels = ctx.currentContour.map(p => {
    const [px, py] = ctx.worldToPixel(p.x, p.y);
    return { x: px, y: py };
  });
  
  const vectors: {dx: number, dy: number}[] = [];
  
  // 2. Compute Motion Vectors (Block Matching)
  for (let i = 0; i < contourPixels.length; i++) {
    const p = contourPixels[i];
    
    // Find where this texture patch went
    const match = findBestMatch(
      p.x, p.y,
      ctx.referenceImage,
      ctx.targetImage,
      DEFAULT_CONFIG.blockSize,
      DEFAULT_CONFIG.searchRadius
    );
    
    vectors.push({ dx: match.dx, dy: match.dy });
  }
  
  // 3. Regularize Motion (Smooth the vector field)
  // This is the "Video Game" magic - coherent motion
  const smoothedVectors = smoothVectors(vectors, DEFAULT_CONFIG.vectorSmoothing);
  
  // 4. Apply Motion
  const predictedPixels: Point[] = [];
  for (let i = 0; i < contourPixels.length; i++) {
    predictedPixels.push({
      x: contourPixels[i].x + smoothedVectors[i].dx,
      y: contourPixels[i].y + smoothedVectors[i].dy
    });
  }
  
  // 5. Validation
  const initialArea = calculateArea(contourPixels);
  const predictedArea = calculateArea(predictedPixels);
  
  // Check 1: Area Explosion
  const areaRatio = predictedArea / (initialArea + 1);
  if (areaRatio > 1.4 || areaRatio < 0.6) {
    console.warn(`⚠️ BlockMatching: Area explosion detected (ratio ${areaRatio.toFixed(2)}). Reverting to simple copy.`);
    // Fallback: Just simple copy (zero motion)
    return ctx.currentContour;
  }
  
  // Check 2: Self Intersection
  if (!isSimplePolygon(predictedPixels)) {
    console.warn("⚠️ BlockMatching: Self-intersection detected. Reverting to smoothed copy.");
    // Fallback: return geometric copy (maybe just smoothed)
    return ctx.currentContour;
  }
  
  // 6. Convert back to World
  return predictedPixels.map(p => {
    const [wx, wy] = ctx.pixelToWorld(p.x, p.y);
    return { x: wx, y: wy };
  });
}



