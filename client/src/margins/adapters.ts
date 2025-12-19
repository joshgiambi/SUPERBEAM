import { Grid, Structure, Mask3D } from './types';

function computeBounds(contours: Array<{ points: number[]; slicePosition: number }>) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const c of contours) {
    const pts = c.points;
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i];
      const y = pts[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (c.slicePosition < minZ) minZ = c.slicePosition;
    if (c.slicePosition > maxZ) maxZ = c.slicePosition;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export function contoursToStructure(
  contours: Array<{ points: number[]; slicePosition: number }>,
  pixelSpacing: [number, number, number],
  paddingMm: number
): Structure {
  const { minX, maxX, minY, maxY, minZ, maxZ } = computeBounds(contours);
  const [xRes, yRes, zRes] = pixelSpacing;
  const padX = Math.ceil(paddingMm / xRes);
  const padY = Math.ceil(paddingMm / yRes);
  const padZ = Math.ceil(paddingMm / zRes);
  const xSize = Math.max(1, Math.ceil((maxX - minX) / xRes) + 1 + 2 * padX);
  const ySize = Math.max(1, Math.ceil((maxY - minY) / yRes) + 1 + 2 * padY);
  const zSize = Math.max(1, Math.ceil((maxZ - minZ) / zRes) + 1 + 2 * padZ);
  const origin = {
    x: minX - padX * xRes,
    y: minY - padY * yRes,
    z: minZ - padZ * zRes
  };
  const grid: Grid = { xSize, ySize, zSize, xRes, yRes, zRes, origin };
  const mask = new Uint8Array(xSize * ySize * zSize);

  // Rasterize each contour into the grid using scanline fill
  for (const c of contours) {
    const zIndex = Math.round((c.slicePosition - origin.z) / zRes);
    if (zIndex < 0 || zIndex >= zSize) continue;
    // Convert to grid coordinates
    const poly: [number, number][] = [];
    const pts = c.points;
    for (let i = 0; i < pts.length; i += 3) {
      const gx = (pts[i] - origin.x) / xRes;
      const gy = (pts[i + 1] - origin.y) / yRes;
      poly.push([gx, gy]);
    }
    if (poly.length < 3) continue;
    const minYg = Math.floor(Math.min(...poly.map(p => p[1])));
    const maxYg = Math.ceil(Math.max(...poly.map(p => p[1])));
    for (let gy = minYg; gy <= maxYg; gy++) {
      if (gy < 0 || gy >= ySize) continue;
      const xs: number[] = [];
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        if ((p1[1] <= gy && p2[1] > gy) || (p2[1] <= gy && p1[1] > gy)) {
          const x = p1[0] + (gy - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1]);
          xs.push(x);
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k < xs.length - 1; k += 2) {
        const x1 = Math.max(0, Math.floor(xs[k]));
        const x2 = Math.min(xSize - 1, Math.ceil(xs[k + 1]));
        const rowOff = zIndex * xSize * ySize + gy * xSize;
        for (let gx = x1; gx <= x2; gx++) mask[rowOff + gx] = 1;
      }
    }
  }
  return { grid, mask: { values: mask, grid } };
}

/**
 * Extract boundary contours using marching squares algorithm
 * This produces cleaner, sub-pixel accurate boundaries
 */
function extractBoundaryContours(slice: Uint8Array, width: number, height: number): number[][] {
  // Build edges using marching squares on a padded grid
  const get = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return slice[x + y * width] ? 1 : 0;
  };
  
  // Collect all boundary edges
  type Edge = { x1: number; y1: number; x2: number; y2: number };
  const edges: Edge[] = [];
  
  for (let y = -1; y < height; y++) {
    for (let x = -1; x < width; x++) {
      // Sample 2x2 cell corners
      const tl = get(x, y);
      const tr = get(x + 1, y);
      const bl = get(x, y + 1);
      const br = get(x + 1, y + 1);
      const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
      
      // Marching squares lookup - each case produces 0, 1, or 2 edges
      // Cell corners: TL(x,y) TR(x+1,y) BL(x,y+1) BR(x+1,y+1)
      // Midpoints: top(x+0.5,y) right(x+1,y+0.5) bottom(x+0.5,y+1) left(x,y+0.5)
      const cx = x + 0.5, cy = y + 0.5; // cell center offset
      
      switch (code) {
        case 0: case 15: break; // all same
        case 1: // BL only
          edges.push({ x1: x, y1: cy + 0.5, x2: cx, y2: y + 1 });
          break;
        case 2: // BR only  
          edges.push({ x1: cx, y1: y + 1, x2: x + 1, y2: cy + 0.5 });
          break;
        case 3: // bottom row
          edges.push({ x1: x, y1: cy + 0.5, x2: x + 1, y2: cy + 0.5 });
          break;
        case 4: // TR only
          edges.push({ x1: x + 1, y1: cy + 0.5, x2: cx, y2: y });
          break;
        case 5: // TR + BL (saddle)
          edges.push({ x1: cx, y1: y, x2: x + 1, y2: cy + 0.5 });
          edges.push({ x1: x, y1: cy + 0.5, x2: cx, y2: y + 1 });
          break;
        case 6: // right column
          edges.push({ x1: cx, y1: y + 1, x2: cx, y2: y });
          break;
        case 7: // all except TL
          edges.push({ x1: x, y1: cy + 0.5, x2: cx, y2: y });
          break;
        case 8: // TL only
          edges.push({ x1: cx, y1: y, x2: x, y2: cy + 0.5 });
          break;
        case 9: // left column
          edges.push({ x1: cx, y1: y, x2: cx, y2: y + 1 });
          break;
        case 10: // TL + BR (saddle)
          edges.push({ x1: cx, y1: y, x2: x, y2: cy + 0.5 });
          edges.push({ x1: x + 1, y1: cy + 0.5, x2: cx, y2: y + 1 });
          break;
        case 11: // all except TR
          edges.push({ x1: cx, y1: y, x2: x + 1, y2: cy + 0.5 });
          break;
        case 12: // top row
          edges.push({ x1: x + 1, y1: cy + 0.5, x2: x, y2: cy + 0.5 });
          break;
        case 13: // all except BR
          edges.push({ x1: x + 1, y1: cy + 0.5, x2: cx, y2: y + 1 });
          break;
        case 14: // all except BL
          edges.push({ x1: cx, y1: y + 1, x2: x, y2: cy + 0.5 });
          break;
      }
    }
  }
  
  if (edges.length === 0) return [];
  
  // Connect edges into contours
  const contours: number[][] = [];
  const used = new Array(edges.length).fill(false);
  const eps = 1e-6;
  
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    
    const pts: number[] = [];
    let current = edges[i];
    used[i] = true;
    pts.push(current.x1, current.y1);
    pts.push(current.x2, current.y2);
    
    // Extend forward from x2,y2
    let changed = true;
    while (changed) {
      changed = false;
      const endX = pts[pts.length - 2];
      const endY = pts[pts.length - 1];
      
      for (let j = 0; j < edges.length; j++) {
        if (used[j]) continue;
        const e = edges[j];
        
        if (Math.abs(e.x1 - endX) < eps && Math.abs(e.y1 - endY) < eps) {
          pts.push(e.x2, e.y2);
          used[j] = true;
          changed = true;
          break;
        }
        if (Math.abs(e.x2 - endX) < eps && Math.abs(e.y2 - endY) < eps) {
          pts.push(e.x1, e.y1);
          used[j] = true;
          changed = true;
          break;
        }
      }
    }
    
    // Extend backward from first point
    changed = true;
    while (changed) {
      changed = false;
      const startX = pts[0];
      const startY = pts[1];
      
      for (let j = 0; j < edges.length; j++) {
        if (used[j]) continue;
        const e = edges[j];
        
        if (Math.abs(e.x2 - startX) < eps && Math.abs(e.y2 - startY) < eps) {
          pts.unshift(e.x1, e.y1);
          used[j] = true;
          changed = true;
          break;
        }
        if (Math.abs(e.x1 - startX) < eps && Math.abs(e.y1 - startY) < eps) {
          pts.unshift(e.x2, e.y2);
          used[j] = true;
          changed = true;
          break;
        }
      }
    }
    
    if (pts.length >= 6) {
      contours.push(pts);
    }
  }
  
  return contours;
}

/**
 * Simplify contour using Douglas-Peucker algorithm
 */
function simplifyContour(points: number[], epsilon: number): number[] {
  if (points.length < 12) return points; // Need at least 4 points (12 values for x,y,z)
  
  const n = points.length / 3;
  if (n < 4) return points;
  
  // Convert to 2D point array for processing
  const pts: [number, number][] = [];
  for (let i = 0; i < points.length; i += 3) {
    pts.push([points[i], points[i + 1]]);
  }
  
  // Find point with maximum distance from line between first and last
  function perpDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }
  
  function simplifyRange(start: number, end: number): number[] {
    if (end - start < 2) {
      return [start];
    }
    
    let maxDist = 0;
    let maxIdx = start;
    
    for (let i = start + 1; i < end; i++) {
      const d = perpDistance(
        pts[i][0], pts[i][1],
        pts[start][0], pts[start][1],
        pts[end][0], pts[end][1]
      );
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    
    if (maxDist > epsilon) {
      const left = simplifyRange(start, maxIdx);
      const right = simplifyRange(maxIdx, end);
      return [...left, ...right.slice(1)];
    } else {
      return [start, end];
    }
  }
  
  const indices = simplifyRange(0, n - 1);
  const z = points[2]; // All points have same Z
  
  const result: number[] = [];
  for (const idx of indices) {
    result.push(pts[idx][0], pts[idx][1], z);
  }
  
  return result;
}

export function structureToContours(
  mask: Mask3D,
  originalSlicePositions: number[],
  toleranceMm?: number,
  includeNewSlices: boolean = true
) : Array<{ points: number[]; slicePosition: number }> {
  const { grid } = mask;
  const contours: Array<{ points: number[]; slicePosition: number }> = [];
  const eps = typeof toleranceMm === 'number' ? toleranceMm : Math.max(grid.zRes * 0.4, 0.1);
  const sliceSet = Array.from(new Set(originalSlicePositions)).sort((a, b) => a - b);
  const used = new Set<number>();
  const xy = grid.xSize * grid.ySize;
  
  for (let zi = 0; zi < grid.zSize; zi++) {
    const zWorld = grid.origin.z + zi * grid.zRes;
    
    // Find nearest unmatched slice within tolerance
    let matchedZ: number | undefined = undefined;
    let bestDelta = Infinity;
    for (const z of sliceSet) {
      if (used.has(z)) continue;
      const d = Math.abs(z - zWorld);
      if (d <= eps && d < bestDelta) { bestDelta = d; matchedZ = z; }
    }
    if (matchedZ === undefined && !includeNewSlices) continue;
    const targetZ = matchedZ !== undefined ? matchedZ : zWorld;
    if (matchedZ !== undefined) used.add(matchedZ);
    
    const slice = mask.values.subarray(zi * xy, zi * xy + xy);
    
    // Extract boundary contours
    const gridContours = extractBoundaryContours(slice, grid.xSize, grid.ySize);
    
    if (gridContours.length === 0) continue;
    
    // Convert to world coordinates and find largest
    let bestContour: number[] = [];
    let bestArea = -Infinity;
    
    for (const gc of gridContours) {
      const worldPts: number[] = [];
      for (let i = 0; i < gc.length; i += 2) {
        const wx = grid.origin.x + gc[i] * grid.xRes;
        const wy = grid.origin.y + gc[i + 1] * grid.yRes;
        worldPts.push(wx, wy, targetZ);
      }
      
      // Calculate area using shoelace
      let area = 0;
      const n = worldPts.length / 3;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += worldPts[i * 3] * worldPts[j * 3 + 1] - worldPts[j * 3] * worldPts[i * 3 + 1];
      }
      area = Math.abs(area) * 0.5;
      
      if (area > bestArea) {
        bestArea = area;
        bestContour = worldPts;
      }
    }
    
    if (bestContour.length >= 9) {
      // Simplify to reduce redundant points while preserving shape
      const simplifyEpsilon = Math.min(grid.xRes, grid.yRes) * 0.25;
      const simplified = simplifyContour(bestContour, simplifyEpsilon);
      
      if (simplified.length >= 9) {
        contours.push({ points: simplified, slicePosition: targetZ });
      } else {
        contours.push({ points: bestContour, slicePosition: targetZ });
      }
    }
  }
  
  return contours;
}


