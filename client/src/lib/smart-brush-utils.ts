/**
 * Smart brush utilities for adaptive contouring
 * Uses gradient-based edge detection for robust border finding.
 */

interface Point {
  x: number;
  y: number;
}

/**
 * Calculate Sobel gradient magnitude at a pixel
 */
function getGradientMagnitude(
  pixelData: Float32Array | Uint16Array | Uint8Array | Int16Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  const xi = Math.round(x);
  const yi = Math.round(y);
  
  if (xi < 1 || xi >= width - 1 || yi < 1 || yi >= height - 1) {
    return 0;
  }
  
  // Sobel operator for gradient
  const gx = 
    -pixelData[(yi-1) * width + (xi-1)] + pixelData[(yi-1) * width + (xi+1)] +
    -2 * pixelData[yi * width + (xi-1)] + 2 * pixelData[yi * width + (xi+1)] +
    -pixelData[(yi+1) * width + (xi-1)] + pixelData[(yi+1) * width + (xi+1)];
  
  const gy = 
    -pixelData[(yi-1) * width + (xi-1)] - 2 * pixelData[(yi-1) * width + xi] - pixelData[(yi-1) * width + (xi+1)] +
     pixelData[(yi+1) * width + (xi-1)] + 2 * pixelData[(yi+1) * width + xi] + pixelData[(yi+1) * width + (xi+1)];
  
  return Math.sqrt(gx * gx + gy * gy);
}

/**
 * Creates a refined adaptive preview using gradient-based edge detection.
 * Finds actual edges instead of just intensity changes.
 */
export function createAdaptivePreview(
  pixelData: Float32Array | Uint16Array | Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): Point[] {
  const cx = Math.round(centerX);
  const cy = Math.round(centerY);
  
  if (cx < 0 || cx >= width || cy < 0 || cy >= height || !pixelData || pixelData.length === 0) {
    return createCirclePoints(centerX, centerY, radius);
  }
  
  try {
    const numRays = 48;
    const shapePoints: Point[] = [];
    
    // Minimum distance from center (don't collapse to nothing)
    const minDistance = radius * 0.3;
    
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      
      // Find the strongest edge along this ray
      let bestDistance = radius;
      let bestGradient = 0;
      
      const step = 1.0;
      for (let d = minDistance; d <= radius; d += step) {
        const x = cx + dx * d;
        const y = cy + dy * d;
        
        if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) {
          break;
        }
        
        const gradient = getGradientMagnitude(pixelData, width, height, x, y);
        
        // Prefer edges closer to center (slight bias)
        const distanceBias = 1 - (d / radius) * 0.1;
        const score = gradient * distanceBias;
        
        if (score > bestGradient) {
          bestGradient = score;
          bestDistance = d;
        }
      }
      
      // If no significant edge found, use the full radius
      // A "significant" gradient is one that's notably above the noise floor
      const gradientThreshold = 20; // Minimum gradient to consider as an edge
      if (bestGradient < gradientThreshold) {
        bestDistance = radius;
      }
      
      shapePoints.push({
        x: centerX + dx * bestDistance,
        y: centerY + dy * bestDistance
      });
    }
    
    // Multi-pass smoothing for less jagged appearance
    let smoothedPoints = [...shapePoints];
    const smoothingPasses = 3;
    
    for (let pass = 0; pass < smoothingPasses; pass++) {
      const passPoints: Point[] = [];
      for (let i = 0; i < smoothedPoints.length; i++) {
        const prev = smoothedPoints[(i - 1 + smoothedPoints.length) % smoothedPoints.length];
        const curr = smoothedPoints[i];
        const next = smoothedPoints[(i + 1) % smoothedPoints.length];
        
        // Gaussian-like weighted average
        passPoints.push({
          x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
          y: prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25
        });
      }
      smoothedPoints = passPoints;
    }
    
    return smoothedPoints;
    
  } catch (error) {
    console.warn("Error in adaptive preview, falling back to circle:", error);
    return createCirclePoints(centerX, centerY, radius);
  }
}

/**
 * A fallback function to create a simple circle.
 */
function createCirclePoints(cx: number, cy: number, radius: number): Point[] {
  const points: Point[] = [];
  const numPoints = 32;
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    });
  }
  
  return points;
}
