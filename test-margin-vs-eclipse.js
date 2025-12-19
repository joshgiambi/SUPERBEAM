/**
 * Margin & Interpolation Validation Against Eclipse Ground Truth
 * 
 * This script applies our margin and interpolation implementations 
 * to test structures and compares against Eclipse TPS results.
 * 
 * Requirements:
 * - Server running at localhost:5173
 * - SHAPE_TEST patient data loaded
 */

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FROM MARGIN IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════

// Grid and Structure types (inline)
function idx(x, y, z, grid) {
  return x + y * grid.xSize + z * grid.xSize * grid.ySize;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTOUR TO STRUCTURE CONVERSION (from adapters.ts)
// ═══════════════════════════════════════════════════════════════════════

function computeBounds(contours) {
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

function contoursToStructure(contours, pixelSpacing, paddingMm) {
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
  const grid = { xSize, ySize, zSize, xRes, yRes, zRes, origin };
  const mask = new Uint8Array(xSize * ySize * zSize);

  // Rasterize each contour into the grid using scanline fill
  for (const c of contours) {
    const zIndex = Math.round((c.slicePosition - origin.z) / zRes);
    if (zIndex < 0 || zIndex >= zSize) continue;
    const poly = [];
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
      const xs = [];
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

// ═══════════════════════════════════════════════════════════════════════
// DISTANCE TRANSFORM (simplified from distanceTransform.ts)
// ═══════════════════════════════════════════════════════════════════════

const InfinityVal = 1e10;

function distanceTransform3D(dt, grid) {
  const { xSize, ySize, zSize, xRes, yRes, zRes } = grid;
  const xy = xSize * ySize;
  
  // X-axis pass
  for (let z = 0; z < zSize; z++) {
    for (let y = 0; y < ySize; y++) {
      const row = z * xy + y * xSize;
      // Forward
      for (let x = 1; x < xSize; x++) {
        const cur = dt.values[row + x];
        const prev = dt.values[row + x - 1] + xRes * xRes;
        if (prev < cur) dt.values[row + x] = prev;
      }
      // Backward
      for (let x = xSize - 2; x >= 0; x--) {
        const cur = dt.values[row + x];
        const next = dt.values[row + x + 1] + xRes * xRes;
        if (next < cur) dt.values[row + x] = next;
      }
    }
  }
  
  // Y-axis pass
  for (let z = 0; z < zSize; z++) {
    for (let x = 0; x < xSize; x++) {
      // Forward
      for (let y = 1; y < ySize; y++) {
        const i = z * xy + y * xSize + x;
        const prev = dt.values[i - xSize] + yRes * yRes;
        if (prev < dt.values[i]) dt.values[i] = prev;
      }
      // Backward
      for (let y = ySize - 2; y >= 0; y--) {
        const i = z * xy + y * xSize + x;
        const next = dt.values[i + xSize] + yRes * yRes;
        if (next < dt.values[i]) dt.values[i] = next;
      }
    }
  }
  
  // Z-axis pass
  for (let y = 0; y < ySize; y++) {
    for (let x = 0; x < xSize; x++) {
      // Forward
      for (let z = 1; z < zSize; z++) {
        const i = z * xy + y * xSize + x;
        const prev = dt.values[i - xy] + zRes * zRes;
        if (prev < dt.values[i]) dt.values[i] = prev;
      }
      // Backward
      for (let z = zSize - 2; z >= 0; z--) {
        const i = z * xy + y * xSize + x;
        const next = dt.values[i + xy] + zRes * zRes;
        if (next < dt.values[i]) dt.values[i] = next;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MARGIN OPERATIONS (from margin.ts)
// ═══════════════════════════════════════════════════════════════════════

function expandGrid(grid, extraX, extraY, extraZ) {
  return {
    xSize: grid.xSize + 2 * extraX,
    ySize: grid.ySize + 2 * extraY,
    zSize: grid.zSize + 2 * extraZ,
    xRes: grid.xRes,
    yRes: grid.yRes,
    zRes: grid.zRes,
    origin: {
      x: grid.origin.x - extraX * grid.xRes,
      y: grid.origin.y - extraY * grid.yRes,
      z: grid.origin.z - extraZ * grid.zRes
    }
  };
}

function initializeInfinityMapInside0(structure, expandedGrid) {
  const eg = expandedGrid;
  const og = structure.grid;
  const dt = { values: new Float32Array(eg.xSize * eg.ySize * eg.zSize).fill(InfinityVal), grid: eg };
  const xy = eg.xSize * eg.ySize;
  
  // Map original mask to expanded grid
  const offsetX = Math.round((og.origin.x - eg.origin.x) / eg.xRes);
  const offsetY = Math.round((og.origin.y - eg.origin.y) / eg.yRes);
  const offsetZ = Math.round((og.origin.z - eg.origin.z) / eg.zRes);
  
  for (let oz = 0; oz < og.zSize; oz++) {
    for (let oy = 0; oy < og.ySize; oy++) {
      for (let ox = 0; ox < og.xSize; ox++) {
        const oi = ox + oy * og.xSize + oz * og.xSize * og.ySize;
        if (structure.mask.values[oi] === 1) {
          const ex = ox + offsetX;
          const ey = oy + offsetY;
          const ez = oz + offsetZ;
          if (ex >= 0 && ex < eg.xSize && ey >= 0 && ey < eg.ySize && ez >= 0 && ez < eg.zSize) {
            dt.values[ex + ey * eg.xSize + ez * xy] = 0;
          }
        }
      }
    }
  }
  
  return dt;
}

function getJustOutsideVoxels(structure, expandedGrid) {
  const eg = expandedGrid;
  const og = structure.grid;
  const ring = new Uint8Array(eg.xSize * eg.ySize * eg.zSize);
  const xy = eg.xSize * eg.ySize;
  
  const offsetX = Math.round((og.origin.x - eg.origin.x) / eg.xRes);
  const offsetY = Math.round((og.origin.y - eg.origin.y) / eg.yRes);
  const offsetZ = Math.round((og.origin.z - eg.origin.z) / eg.zRes);
  
  // Create expanded mask
  const expandedMask = new Uint8Array(eg.xSize * eg.ySize * eg.zSize);
  for (let oz = 0; oz < og.zSize; oz++) {
    for (let oy = 0; oy < og.ySize; oy++) {
      for (let ox = 0; ox < og.xSize; ox++) {
        const oi = ox + oy * og.xSize + oz * og.xSize * og.ySize;
        if (structure.mask.values[oi] === 1) {
          const ex = ox + offsetX;
          const ey = oy + offsetY;
          const ez = oz + offsetZ;
          if (ex >= 0 && ex < eg.xSize && ey >= 0 && ey < eg.ySize && ez >= 0 && ez < eg.zSize) {
            expandedMask[ex + ey * eg.xSize + ez * xy] = 1;
          }
        }
      }
    }
  }
  
  // Find 6-connected outside neighbors of inside voxels
  for (let z = 0; z < eg.zSize; z++) {
    for (let y = 0; y < eg.ySize; y++) {
      for (let x = 0; x < eg.xSize; x++) {
        const i = x + y * eg.xSize + z * xy;
        if (expandedMask[i] !== 1) continue;
        
        // Check 6 neighbors
        const neighbors = [
          [x - 1, y, z], [x + 1, y, z],
          [x, y - 1, z], [x, y + 1, z],
          [x, y, z - 1], [x, y, z + 1]
        ];
        
        for (const [nx, ny, nz] of neighbors) {
          if (nx < 0 || nx >= eg.xSize || ny < 0 || ny >= eg.ySize || nz < 0 || nz >= eg.zSize) continue;
          const ni = nx + ny * eg.xSize + nz * xy;
          if (expandedMask[ni] === 0) {
            ring[ni] = 1;
          }
        }
      }
    }
  }
  
  return ring;
}

function negateInside(dt, structure, expandedGrid) {
  const eg = expandedGrid;
  const og = structure.grid;
  const xy = eg.xSize * eg.ySize;
  
  const offsetX = Math.round((og.origin.x - eg.origin.x) / eg.xRes);
  const offsetY = Math.round((og.origin.y - eg.origin.y) / eg.yRes);
  const offsetZ = Math.round((og.origin.z - eg.origin.z) / eg.zRes);
  
  for (let oz = 0; oz < og.zSize; oz++) {
    for (let oy = 0; oy < og.ySize; oy++) {
      for (let ox = 0; ox < og.xSize; ox++) {
        const oi = ox + oy * og.xSize + oz * og.xSize * og.ySize;
        if (structure.mask.values[oi] === 1) {
          const ex = ox + offsetX;
          const ey = oy + offsetY;
          const ez = oz + offsetZ;
          if (ex >= 0 && ex < eg.xSize && ey >= 0 && ey < eg.ySize && ez >= 0 && ez < eg.zSize) {
            dt.values[ex + ey * eg.xSize + ez * xy] = -dt.values[ex + ey * eg.xSize + ez * xy];
          }
        }
      }
    }
  }
}

function marginSymmetric(structure, marginMM, eclipseFudge = true) {
  if (!structure?.mask?.values?.length || marginMM === 0) {
    return cloneStructure(structure);
  }

  const g = structure.grid;
  
  if (marginMM > 0) {
    // Outer: expand grid, inside=0, run DT, threshold <= r^2
    // Apply Eclipse fudge factor if requested
    let effectiveMargin = marginMM;
    if (eclipseFudge) {
      // Eclipse uses a slightly larger margin (half voxel extra)
      const avgRes = (g.xRes + g.yRes + g.zRes) / 3;
      effectiveMargin = Math.max(g.xRes, marginMM + avgRes / 2);
    }
    
    const extraX = Math.ceil(effectiveMargin / g.xRes) + 1;
    const extraY = Math.ceil(effectiveMargin / g.yRes) + 1;
    const extraZ = Math.ceil(effectiveMargin / g.zRes) + 1;
    const eg = expandGrid(g, extraX, extraY, extraZ);
    const dt = initializeInfinityMapInside0(structure, eg);
    distanceTransform3D(dt, eg);
    
    // Threshold: distance² <= margin²
    const thresholdSq = effectiveMargin * effectiveMargin;
    const mask = new Uint8Array(eg.xSize * eg.ySize * eg.zSize);
    for (let i = 0; i < dt.values.length; i++) {
      mask[i] = dt.values[i] <= thresholdSq ? 1 : 0;
    }
    return { grid: eg, mask: { values: mask, grid: eg } };
  } else {
    // Inner (erosion): expand grid by 1 voxel band, ring seeds=0 outside
    const extraX = 1, extraY = 1, extraZ = 1;
    const eg = expandGrid(g, extraX, extraY, extraZ);
    const ring = getJustOutsideVoxels(structure, eg);
    const dt = { values: new Float32Array(eg.xSize * eg.ySize * eg.zSize), grid: eg };
    for (let i = 0; i < dt.values.length; i++) dt.values[i] = ring[i] ? 0 : InfinityVal;
    distanceTransform3D(dt, eg);
    negateInside(dt, structure, eg);
    const thr = marginMM * marginMM; // marginMM is negative, so -marginMM² is positive threshold
    const mask = new Uint8Array(eg.xSize * eg.ySize * eg.zSize);
    for (let i = 0; i < dt.values.length; i++) {
      // Inside voxels that are far enough from edge: distance < |margin|
      mask[i] = dt.values[i] < thr ? 1 : 0;
    }
    return { grid: eg, mask: { values: mask, grid: eg } };
  }
}

function cloneStructure(structure) {
  return {
    grid: { ...structure.grid, origin: { ...structure.grid.origin } },
    mask: { values: new Uint8Array(structure.mask.values), grid: structure.grid }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STRUCTURE TO CONTOURS CONVERSION
// ═══════════════════════════════════════════════════════════════════════

function structureToContours(mask, originalSlicePositions, toleranceMm, includeNewSlices = true) {
  const grid = mask.grid;
  const contours = [];
  const eps = typeof toleranceMm === 'number' ? toleranceMm : Math.max(grid.zRes * 0.4, 0.1);
  const sliceSet = Array.from(new Set(originalSlicePositions)).sort((a, b) => a - b);
  const used = new Set();
  const xy = grid.xSize * grid.ySize;
  
  for (let zi = 0; zi < grid.zSize; zi++) {
    const zWorld = grid.origin.z + zi * grid.zRes;
    let matchedZ = undefined;
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
    
    // Check if slice has any content
    let hasContent = false;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 1) { hasContent = true; break; }
    }
    if (!hasContent) continue;
    
    // Simple contour extraction: find boundary pixels
    const points = [];
    for (let y = 1; y < grid.ySize - 1; y++) {
      for (let x = 1; x < grid.xSize - 1; x++) {
        const i = x + y * grid.xSize;
        if (slice[i] === 1) {
          // Check if on boundary (has at least one 0 neighbor)
          if (slice[i - 1] === 0 || slice[i + 1] === 0 || 
              slice[i - grid.xSize] === 0 || slice[i + grid.xSize] === 0) {
            const wx = grid.origin.x + x * grid.xRes;
            const wy = grid.origin.y + y * grid.yRes;
            points.push(wx, wy, targetZ);
          }
        }
      }
    }
    
    if (points.length >= 9) {
      contours.push({ points, slicePosition: targetZ });
    }
  }
  
  return contours;
}

// ═══════════════════════════════════════════════════════════════════════
// POLAR INTERPOLATION (from fast-polar-interpolation.ts)
// ═══════════════════════════════════════════════════════════════════════

function centroid(poly) {
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

function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function principalAxis(pts, c) {
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) {
    const dx = x - c[0];
    const dy = y - c[1];
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  
  const a = sxx, b = sxy, d = syy;
  const T = a + d;
  const D = Math.sqrt(Math.max(0, (a - d) * (a - d) + 4 * b * b));
  const l1 = 0.5 * (T + D);
  
  let vx = b, vy = l1 - a;
  const len = Math.hypot(vx, vy) || 1;
  vx /= len;
  vy /= len;
  
  return [vx, vy];
}

function polarSample(poly, center, baseAngle, bins) {
  const twopi = Math.PI * 2;
  const radii = new Array(bins).fill(0);
  const n = poly.length;
  
  if (n < 3) return radii;
  
  for (let k = 0; k < bins; k++) {
    const ang = baseAngle + (k / bins) * twopi;
    const dir = [Math.cos(ang), Math.sin(ang)];
    let rMax = 0;
    
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      
      const ux = dir[0], uy = dir[1];
      const px = p[0] - center[0], py = p[1] - center[1];
      const ex = q[0] - p[0], ey = q[1] - p[1];
      
      const det = ux * (-ey) - (-ex) * uy;
      if (Math.abs(det) < 1e-12) continue;
      
      const invDet = 1 / det;
      const u = (px * (-ey) - (-ex) * py) * invDet;
      const v = (ux * py - uy * px) * invDet;
      
      if (u >= 0 && v >= 0 && v <= 1) {
        if (u > rMax) rMax = u;
      }
    }
    
    if (rMax <= 0) {
      for (let i = 0; i < n; i++) {
        const dx = poly[i][0] - center[0];
        const dy = poly[i][1] - center[1];
        const u = dx * dir[0] + dy * dir[1];
        if (u > rMax) rMax = u;
      }
    }
    
    radii[k] = rMax;
  }
  
  return radii;
}

function to2D(points) {
  const result = [];
  for (let i = 0; i < points.length; i += 3) {
    result.push([points[i], points[i + 1]]);
  }
  return result;
}

function fastPolarInterpolate(contour1, z1, contour2, z2, targetZ, bins = 128) {
  if (!contour1?.length || !contour2?.length) return [];
  
  const t = (targetZ - z1) / (z2 - z1);
  if (!(t > 0 && t < 1)) return [];
  
  const poly1 = to2D(contour1);
  const poly2 = to2D(contour2);
  
  if (poly1.length < 3 || poly2.length < 3) return [];
  
  const c1 = centroid(poly1);
  const c2 = centroid(poly2);
  const ci = [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t
  ];
  
  const axis1 = principalAxis(poly1, c1);
  const baseAngle = Math.atan2(axis1[1], axis1[0]);
  
  const radii1 = polarSample(poly1, c1, baseAngle, bins);
  const radii2 = polarSample(poly2, c2, baseAngle, bins);
  
  const radiiInterp = new Array(bins);
  for (let i = 0; i < bins; i++) {
    radiiInterp[i] = radii1[i] + (radii2[i] - radii1[i]) * t;
  }
  
  // Convert back to cartesian
  const twopi = Math.PI * 2;
  const points = [];
  for (let i = 0; i < bins; i++) {
    const ang = baseAngle + (i / bins) * twopi;
    const r = radiiInterp[i];
    const x = ci[0] + r * Math.cos(ang);
    const y = ci[1] + r * Math.sin(ang);
    points.push(x, y, targetZ);
  }
  
  return points;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPARISON METRICS
// ═══════════════════════════════════════════════════════════════════════

function calculateDiceCoefficient(maskA, maskB) {
  // Both masks should have same size
  if (maskA.length !== maskB.length) {
    console.warn('Mask sizes differ for Dice calculation');
    return 0;
  }
  
  let intersection = 0;
  let sumA = 0;
  let sumB = 0;
  
  for (let i = 0; i < maskA.length; i++) {
    const a = maskA[i] === 1 ? 1 : 0;
    const b = maskB[i] === 1 ? 1 : 0;
    if (a && b) intersection++;
    sumA += a;
    sumB += b;
  }
  
  if (sumA + sumB === 0) return 1.0; // Both empty
  return (2 * intersection) / (sumA + sumB);
}

function calculateVolumeFromMask(mask, grid) {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) count++;
  }
  const voxelVolume = grid.xRes * grid.yRes * grid.zRes;
  return count * voxelVolume;
}

function polygonAreaFromPoints(points) {
  const n = points.length / 3;
  if (n < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i * 3] * points[j * 3 + 1];
    area -= points[j * 3] * points[i * 3 + 1];
  }
  return Math.abs(area) / 2;
}

// ═══════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5173';
const RT_STRUCT_ID = 3669;

async function fetchStructures() {
  const res = await fetch(`${API_BASE}/api/rt-structures/${RT_STRUCT_ID}/contours`);
  const data = await res.json();
  return data.structures || [];
}

function getStructureByName(structures, name) {
  return structures.find(s => s.structureName === name);
}

async function testMarginOperation(source, groundTruth, marginMm, description) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`TEST: ${description}`);
  console.log(`${'═'.repeat(70)}`);
  
  const srcContours = source.contours.map(c => ({
    points: c.points,
    slicePosition: c.slicePosition
  }));
  
  const gtContours = groundTruth.contours.map(c => ({
    points: c.points,
    slicePosition: c.slicePosition
  }));
  
  console.log(`\nSource: ${source.structureName} (${srcContours.length} contours)`);
  console.log(`Ground Truth: ${groundTruth.structureName} (${gtContours.length} contours)`);
  console.log(`Margin: ${marginMm}mm`);
  
  // Use common pixel spacing (from typical CT)
  const pixelSpacing = [0.976, 0.976, 2.0]; // mm
  const paddingMm = Math.abs(marginMm) + 10;
  
  console.log('\n1. Converting source contours to voxel structure...');
  const structure = contoursToStructure(srcContours, pixelSpacing, paddingMm);
  console.log(`   Grid size: ${structure.grid.xSize} x ${structure.grid.ySize} x ${structure.grid.zSize}`);
  console.log(`   Origin: (${structure.grid.origin.x.toFixed(1)}, ${structure.grid.origin.y.toFixed(1)}, ${structure.grid.origin.z.toFixed(1)})`);
  
  const srcVolume = calculateVolumeFromMask(structure.mask.values, structure.grid);
  console.log(`   Source volume: ${(srcVolume / 1000).toFixed(2)} cm³`);
  
  console.log('\n2. Applying margin operation...');
  const marginResult = marginSymmetric(structure, marginMm, true);
  console.log(`   Result grid: ${marginResult.grid.xSize} x ${marginResult.grid.ySize} x ${marginResult.grid.zSize}`);
  
  const resultVolume = calculateVolumeFromMask(marginResult.mask.values, marginResult.grid);
  console.log(`   Result volume: ${(resultVolume / 1000).toFixed(2)} cm³`);
  
  console.log('\n3. Converting ground truth to voxel structure...');
  // Convert ground truth to same grid for comparison
  const gtStructure = contoursToStructure(gtContours, pixelSpacing, paddingMm);
  const gtVolume = calculateVolumeFromMask(gtStructure.mask.values, gtStructure.grid);
  console.log(`   Ground truth volume: ${(gtVolume / 1000).toFixed(2)} cm³`);
  
  // Volume comparison
  const volumeDiff = Math.abs(resultVolume - gtVolume);
  const volumeDiffPercent = (volumeDiff / gtVolume * 100).toFixed(1);
  
  console.log('\n4. Comparing results...');
  console.log(`   Our result volume: ${(resultVolume / 1000).toFixed(2)} cm³`);
  console.log(`   Eclipse volume:    ${(gtVolume / 1000).toFixed(2)} cm³`);
  console.log(`   Difference:        ${(volumeDiff / 1000).toFixed(2)} cm³ (${volumeDiffPercent}%)`);
  
  // Z-range comparison
  const srcZs = srcContours.map(c => c.slicePosition).sort((a, b) => a - b);
  const gtZs = gtContours.map(c => c.slicePosition).sort((a, b) => a - b);
  
  console.log(`\n   Source Z-range:    ${srcZs[0]?.toFixed(1)} to ${srcZs[srcZs.length - 1]?.toFixed(1)} mm (${srcZs.length} slices)`);
  console.log(`   Eclipse Z-range:   ${gtZs[0]?.toFixed(1)} to ${gtZs[gtZs.length - 1]?.toFixed(1)} mm (${gtZs.length} slices)`);
  
  // Expected Z extension
  const expectedZStart = srcZs[0] - Math.abs(marginMm);
  const expectedZEnd = srcZs[srcZs.length - 1] + Math.abs(marginMm);
  console.log(`   Expected Z-range:  ${expectedZStart?.toFixed(1)} to ${expectedZEnd?.toFixed(1)} mm`);
  
  // Verdict
  const status = parseFloat(volumeDiffPercent) < 20 ? '✓ PASS' : '⚠ NEEDS REVIEW';
  console.log(`\n   Status: ${status}`);
  
  return {
    test: description,
    marginMm,
    sourceVolume: srcVolume,
    resultVolume,
    groundTruthVolume: gtVolume,
    volumeDiffPercent: parseFloat(volumeDiffPercent),
    status
  };
}

async function testInterpolation(source, groundTruth, description) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`TEST: ${description}`);
  console.log(`${'═'.repeat(70)}`);
  
  const srcContours = source.contours.map(c => ({
    points: c.points,
    slicePosition: c.slicePosition
  }));
  
  const gtContours = groundTruth.contours.map(c => ({
    points: c.points,
    slicePosition: c.slicePosition
  }));
  
  console.log(`\nSource: ${source.structureName} (${srcContours.length} contours)`);
  console.log(`Ground Truth: ${groundTruth.structureName} (${gtContours.length} contours)`);
  
  // Get source Z positions
  const srcZs = Array.from(new Set(srcContours.map(c => c.slicePosition))).sort((a, b) => a - b);
  const gtZs = Array.from(new Set(gtContours.map(c => c.slicePosition))).sort((a, b) => a - b);
  
  console.log(`\nSource slices: ${srcZs.length} (Z: ${srcZs[0]?.toFixed(1)} to ${srcZs[srcZs.length - 1]?.toFixed(1)} mm)`);
  console.log(`Ground truth slices: ${gtZs.length} (Z: ${gtZs[0]?.toFixed(1)} to ${gtZs[gtZs.length - 1]?.toFixed(1)} mm)`);
  
  // Find which slices need interpolation
  const sliceThickness = 2.0; // mm
  const interpolatedContours = [...srcContours];
  let interpolatedCount = 0;
  
  console.log('\n1. Interpolating between source slices...');
  
  // Group source contours by Z
  const byZ = new Map();
  for (const c of srcContours) {
    if (!byZ.has(c.slicePosition)) byZ.set(c.slicePosition, []);
    byZ.get(c.slicePosition).push(c);
  }
  
  for (let i = 0; i < srcZs.length - 1; i++) {
    const z1 = srcZs[i];
    const z2 = srcZs[i + 1];
    const gap = z2 - z1;
    const numSlices = Math.floor(gap / sliceThickness) - 1;
    
    if (numSlices > 0) {
      const contours1 = byZ.get(z1) || [];
      const contours2 = byZ.get(z2) || [];
      
      for (let j = 1; j <= numSlices; j++) {
        const targetZ = z1 + j * sliceThickness;
        
        // Get largest contour from each slice
        const c1 = contours1.reduce((best, c) => {
          const area = polygonAreaFromPoints(c.points);
          return area > (best.area || 0) ? { contour: c, area } : best;
        }, {}).contour;
        
        const c2 = contours2.reduce((best, c) => {
          const area = polygonAreaFromPoints(c.points);
          return area > (best.area || 0) ? { contour: c, area } : best;
        }, {}).contour;
        
        if (c1 && c2) {
          const interpPoints = fastPolarInterpolate(c1.points, z1, c2.points, z2, targetZ, 128);
          if (interpPoints.length >= 9) {
            interpolatedContours.push({ points: interpPoints, slicePosition: targetZ });
            interpolatedCount++;
          }
        }
      }
    }
  }
  
  console.log(`   Interpolated ${interpolatedCount} new slices`);
  console.log(`   Total contours: ${interpolatedContours.length}`);
  
  // Compare with ground truth
  const interpZs = Array.from(new Set(interpolatedContours.map(c => c.slicePosition))).sort((a, b) => a - b);
  
  console.log('\n2. Comparing with Eclipse ground truth...');
  console.log(`   Our slices: ${interpZs.length}`);
  console.log(`   Eclipse slices: ${gtZs.length}`);
  
  // Check keyframe preservation
  let keyframeMatches = 0;
  for (const srcZ of srcZs) {
    const gtMatch = gtZs.find(z => Math.abs(z - srcZ) < 0.5);
    if (gtMatch !== undefined) keyframeMatches++;
  }
  console.log(`   Keyframe preservation: ${keyframeMatches}/${srcZs.length}`);
  
  // Calculate total area on matching slices
  let ourTotalArea = 0;
  let gtTotalArea = 0;
  let matchingSlices = 0;
  
  for (const z of interpZs) {
    const gtZ = gtZs.find(gz => Math.abs(gz - z) < 1.0);
    if (gtZ !== undefined) {
      const ourContour = interpolatedContours.find(c => Math.abs(c.slicePosition - z) < 0.5);
      const gtContour = gtContours.find(c => Math.abs(c.slicePosition - gtZ) < 0.5);
      
      if (ourContour && gtContour) {
        ourTotalArea += polygonAreaFromPoints(ourContour.points);
        gtTotalArea += polygonAreaFromPoints(gtContour.points);
        matchingSlices++;
      }
    }
  }
  
  const areaDiffPercent = gtTotalArea > 0 ? Math.abs(ourTotalArea - gtTotalArea) / gtTotalArea * 100 : 0;
  
  console.log(`\n3. Area comparison on matching slices (${matchingSlices}):`);
  console.log(`   Our total area:     ${ourTotalArea.toFixed(0)} mm²`);
  console.log(`   Eclipse total area: ${gtTotalArea.toFixed(0)} mm²`);
  console.log(`   Difference:         ${areaDiffPercent.toFixed(1)}%`);
  
  const status = areaDiffPercent < 15 ? '✓ PASS' : '⚠ NEEDS REVIEW';
  console.log(`\n   Status: ${status}`);
  
  return {
    test: description,
    sourceSlices: srcZs.length,
    interpolatedSlices: interpolatedCount,
    totalSlices: interpZs.length,
    groundTruthSlices: gtZs.length,
    areaDiffPercent,
    status
  };
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   MARGIN & INTERPOLATION VALIDATION VS ECLIPSE                     ║');
  console.log('║   Applying our implementations and comparing with TPS ground truth ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Fetching structures from API...');
  const structures = await fetchStructures();
  console.log(`Loaded ${structures.length} structures\n`);
  
  const shape1 = getStructureByName(structures, 'SHAPE1');
  const shape1_1cm = getStructureByName(structures, 'SHAPE1_1cm');
  const shape1_shrink = getStructureByName(structures, 'SHAPE1_-0.5cm');
  const shape2 = getStructureByName(structures, 'SHAPE2');
  const shape2_1cm = getStructureByName(structures, 'SHAPE2_1cm');
  const target1 = getStructureByName(structures, 'TARGET1');
  const target1_interp = getStructureByName(structures, 'TARGET1_INTERP');
  
  const results = [];
  
  // Test 1: SHAPE1 shrink 0.5cm
  if (shape1 && shape1_shrink) {
    const r = await testMarginOperation(shape1, shape1_shrink, -5, 'SHAPE1 shrink by 0.5cm');
    results.push(r);
  }
  
  // Test 2: SHAPE1 expand 1cm
  if (shape1 && shape1_1cm) {
    const r = await testMarginOperation(shape1, shape1_1cm, 10, 'SHAPE1 expand by 1cm');
    results.push(r);
  }
  
  // Test 3: SHAPE2 expand 1cm
  if (shape2 && shape2_1cm) {
    const r = await testMarginOperation(shape2, shape2_1cm, 10, 'SHAPE2 expand by 1cm');
    results.push(r);
  }
  
  // Test 4: TARGET1 interpolation
  if (target1 && target1_interp) {
    const r = await testInterpolation(target1, target1_interp, 'TARGET1 interpolation');
    results.push(r);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('                          FINAL SUMMARY');
  console.log('═'.repeat(70));
  
  for (const r of results) {
    console.log(`\n${r.status} ${r.test}`);
    if (r.volumeDiffPercent !== undefined) {
      console.log(`   Volume difference: ${r.volumeDiffPercent.toFixed(1)}%`);
    }
    if (r.areaDiffPercent !== undefined) {
      console.log(`   Area difference: ${r.areaDiffPercent.toFixed(1)}%`);
    }
  }
  
  console.log('\n' + '═'.repeat(70) + '\n');
}

runAllTests().catch(console.error);

