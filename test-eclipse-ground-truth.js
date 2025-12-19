/**
 * Eclipse Ground Truth Validation Test Script
 * 
 * Tests margin operations and interpolation against Eclipse TPS exports.
 * 
 * Test Cases:
 * 1. SHAPE1 shrink 0.5cm -> compare with SHAPE1_-0.5cm
 * 2. SHAPE1 expand 1cm -> compare with SHAPE1_1cm
 * 3. SHAPE2 expand 1cm -> compare with SHAPE2_1cm
 * 4. TARGET1 interpolate -> compare with TARGET1_INTERP
 */

// Use native fetch (Node 18+)

const API_BASE = 'http://localhost:5173';
const RT_STRUCT_ID = 3669;

// Structure name to ROI number mapping
const STRUCTURES = {
  SHAPE1: 42,
  'SHAPE1_1cm': 43,
  'SHAPE1_-0.5cm': 44,
  SHAPE2: 45,
  'SHAPE2_1cm': 46,
  TARGET1: 40,
  TARGET1_INTERP: 41,
};

async function fetchStructures() {
  const res = await fetch(`${API_BASE}/api/rt-structures/${RT_STRUCT_ID}/contours`);
  const data = await res.json();
  return data.structures || [];
}

function getStructureByName(structures, name) {
  return structures.find(s => s.structureName === name);
}

function computeSliceZPositions(contours) {
  const zSet = new Set();
  for (const c of contours) {
    zSet.add(c.slicePosition);
  }
  return Array.from(zSet).sort((a, b) => a - b);
}

// Calculate polygon area using shoelace formula
function polygonArea(points) {
  // points is [x, y, z, x, y, z, ...]
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

// Calculate centroid of polygon
function polygonCentroid(points) {
  const n = points.length / 3;
  if (n === 0) return { x: 0, y: 0 };
  
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    cx += points[i * 3];
    cy += points[i * 3 + 1];
  }
  return { x: cx / n, y: cy / n };
}

// Get total volume (sum of slice areas * slice thickness)
function calculateVolume(contours, sliceThickness = 3.0) {
  let totalArea = 0;
  for (const c of contours) {
    totalArea += polygonArea(c.points);
  }
  return totalArea * sliceThickness;
}

// Get bounding box
function getBoundingBox(contours) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  for (const c of contours) {
    const pts = c.points;
    for (let i = 0; i < pts.length; i += 3) {
      if (pts[i] < minX) minX = pts[i];
      if (pts[i] > maxX) maxX = pts[i];
      if (pts[i + 1] < minY) minY = pts[i + 1];
      if (pts[i + 1] > maxY) maxY = pts[i + 1];
    }
    if (c.slicePosition < minZ) minZ = c.slicePosition;
    if (c.slicePosition > maxZ) maxZ = c.slicePosition;
  }
  
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

// Group contours by slice Z position
function groupByZ(contours, tolerance = 0.1) {
  const groups = new Map();
  for (const c of contours) {
    const z = Math.round(c.slicePosition / tolerance) * tolerance;
    if (!groups.has(z)) groups.set(z, []);
    groups.get(z).push(c);
  }
  return groups;
}

// Calculate Dice coefficient for two polygon sets on the same slice
// Simplified: compare areas if centroids are close
function compareTwoSlices(contoursA, contoursB) {
  const areaA = contoursA.reduce((sum, c) => sum + polygonArea(c.points), 0);
  const areaB = contoursB.reduce((sum, c) => sum + polygonArea(c.points), 0);
  
  // Simple area ratio (not true Dice, but useful for comparison)
  const minArea = Math.min(areaA, areaB);
  const maxArea = Math.max(areaA, areaB);
  const areaRatio = maxArea > 0 ? minArea / maxArea : 0;
  
  // Compare centroids
  const centroidsA = contoursA.map(c => polygonCentroid(c.points));
  const centroidsB = contoursB.map(c => polygonCentroid(c.points));
  
  // Simple centroid difference (use first contour of each)
  const cA = centroidsA[0] || { x: 0, y: 0 };
  const cB = centroidsB[0] || { x: 0, y: 0 };
  const centroidDist = Math.sqrt((cA.x - cB.x) ** 2 + (cA.y - cB.y) ** 2);
  
  return { areaA, areaB, areaRatio, centroidDist };
}

// Main comparison function between two structures
function compareStructures(structA, structB, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Comparing: ${description}`);
  console.log(`${'='.repeat(60)}`);
  
  const contoursA = structA.contours || [];
  const contoursB = structB.contours || [];
  
  console.log(`Structure A: ${structA.structureName}, ${contoursA.length} contours`);
  console.log(`Structure B: ${structB.structureName}, ${contoursB.length} contours`);
  
  const zPositionsA = computeSliceZPositions(contoursA);
  const zPositionsB = computeSliceZPositions(contoursB);
  
  console.log(`\nZ-range A: ${zPositionsA[0]?.toFixed(2)} to ${zPositionsA[zPositionsA.length - 1]?.toFixed(2)} mm (${zPositionsA.length} slices)`);
  console.log(`Z-range B: ${zPositionsB[0]?.toFixed(2)} to ${zPositionsB[zPositionsB.length - 1]?.toFixed(2)} mm (${zPositionsB.length} slices)`);
  
  const boxA = getBoundingBox(contoursA);
  const boxB = getBoundingBox(contoursB);
  
  console.log(`\nBounding Box A: X[${boxA.minX.toFixed(1)}, ${boxA.maxX.toFixed(1)}], Y[${boxA.minY.toFixed(1)}, ${boxA.maxY.toFixed(1)}]`);
  console.log(`Bounding Box B: X[${boxB.minX.toFixed(1)}, ${boxB.maxX.toFixed(1)}], Y[${boxB.minY.toFixed(1)}, ${boxB.maxY.toFixed(1)}]`);
  
  const volA = calculateVolume(contoursA);
  const volB = calculateVolume(contoursB);
  const volDiffPercent = ((volB - volA) / volA * 100).toFixed(2);
  
  console.log(`\nVolume A: ${(volA / 1000).toFixed(2)} cm³`);
  console.log(`Volume B: ${(volB / 1000).toFixed(2)} cm³`);
  console.log(`Volume Difference: ${volDiffPercent}%`);
  
  // Compare slice by slice
  const groupsA = groupByZ(contoursA);
  const groupsB = groupByZ(contoursB);
  
  // Find common slices and compare
  const commonSlices = [];
  const tolerance = 1.0; // mm
  
  for (const zA of groupsA.keys()) {
    for (const zB of groupsB.keys()) {
      if (Math.abs(zA - zB) < tolerance) {
        commonSlices.push({ zA, zB });
        break;
      }
    }
  }
  
  console.log(`\nCommon slices: ${commonSlices.length}`);
  
  let totalAreaRatio = 0;
  let totalCentroidDist = 0;
  let sliceComparisons = 0;
  
  const sliceDetails = [];
  
  for (const { zA, zB } of commonSlices) {
    const contA = groupsA.get(zA);
    const contB = groupsB.get(zB);
    
    if (contA && contB) {
      const comparison = compareTwoSlices(contA, contB);
      totalAreaRatio += comparison.areaRatio;
      totalCentroidDist += comparison.centroidDist;
      sliceComparisons++;
      
      sliceDetails.push({
        z: zA,
        areaA: comparison.areaA,
        areaB: comparison.areaB,
        areaRatio: comparison.areaRatio,
        centroidDist: comparison.centroidDist
      });
    }
  }
  
  if (sliceComparisons > 0) {
    const avgAreaRatio = totalAreaRatio / sliceComparisons;
    const avgCentroidDist = totalCentroidDist / sliceComparisons;
    
    console.log(`\nSlice-by-slice comparison (${sliceComparisons} slices):`);
    console.log(`  Average Area Ratio: ${(avgAreaRatio * 100).toFixed(2)}%`);
    console.log(`  Average Centroid Distance: ${avgCentroidDist.toFixed(2)} mm`);
    
    // Show worst slices
    sliceDetails.sort((a, b) => a.areaRatio - b.areaRatio);
    console.log(`\n  Worst matching slices (by area ratio):`);
    for (let i = 0; i < Math.min(3, sliceDetails.length); i++) {
      const s = sliceDetails[i];
      console.log(`    Z=${s.z.toFixed(1)}mm: ratio=${(s.areaRatio * 100).toFixed(1)}%, areas=${s.areaA.toFixed(0)}/${s.areaB.toFixed(0)} mm²`);
    }
  }
  
  return {
    structureA: structA.structureName,
    structureB: structB.structureName,
    contoursA: contoursA.length,
    contoursB: contoursB.length,
    volumeA: volA,
    volumeB: volB,
    volumeDiffPercent: parseFloat(volDiffPercent),
    avgAreaRatio: sliceComparisons > 0 ? totalAreaRatio / sliceComparisons : 0,
    avgCentroidDist: sliceComparisons > 0 ? totalCentroidDist / sliceComparisons : 0,
    commonSlices: sliceComparisons
  };
}

// Analyze what the margin operation SHOULD produce
function analyzeExpectedMarginEffect(structA, marginMm, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analyzing Expected Margin Effect: ${description}`);
  console.log(`${'='.repeat(60)}`);
  
  const contours = structA.contours || [];
  console.log(`Source structure: ${structA.structureName}, ${contours.length} contours`);
  
  // For each slice, estimate expected area change
  let totalOriginalArea = 0;
  let totalExpectedArea = 0;
  
  for (const c of contours) {
    const area = polygonArea(c.points);
    const perimeter = estimatePerimeter(c.points);
    
    // Approximate area change: A' ≈ A + perimeter * margin + π * margin²
    // For expansion: +margin
    // For shrinking: -margin (negative margin)
    const expectedChange = perimeter * marginMm + Math.PI * marginMm * marginMm;
    const expectedArea = area + expectedChange;
    
    totalOriginalArea += area;
    totalExpectedArea += Math.max(0, expectedArea); // Can't have negative area
  }
  
  console.log(`\nOriginal total area: ${totalOriginalArea.toFixed(2)} mm² (${(totalOriginalArea / 100).toFixed(2)} cm²)`);
  console.log(`Expected total area after ${marginMm}mm margin: ${totalExpectedArea.toFixed(2)} mm² (${(totalExpectedArea / 100).toFixed(2)} cm²)`);
  console.log(`Expected change: ${((totalExpectedArea - totalOriginalArea) / totalOriginalArea * 100).toFixed(1)}%`);
  
  // For expansion, expect more slices (Z extension)
  const zPositions = computeSliceZPositions(contours);
  const zRange = zPositions[zPositions.length - 1] - zPositions[0];
  const newZRange = zRange + 2 * Math.abs(marginMm);
  const expectedExtraSlices = Math.ceil(Math.abs(marginMm) / 3.0) * 2; // Assuming ~3mm slice thickness
  
  console.log(`\nZ-range: ${zRange.toFixed(1)}mm -> expected ${newZRange.toFixed(1)}mm`);
  if (marginMm > 0) {
    console.log(`Expected extra slices from Z-expansion: ~${expectedExtraSlices}`);
  }
  
  return {
    originalArea: totalOriginalArea,
    expectedArea: totalExpectedArea,
    marginMm,
    expectedExtraSlices: marginMm > 0 ? expectedExtraSlices : 0
  };
}

function estimatePerimeter(points) {
  const n = points.length / 3;
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j * 3] - points[i * 3];
    const dy = points[j * 3 + 1] - points[i * 3 + 1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Eclipse Ground Truth Validation Test                         ║');
  console.log('║   Testing Margin & Interpolation against TPS exports           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Fetching RT structures from API...');
  const structures = await fetchStructures();
  console.log(`Loaded ${structures.length} structures\n`);
  
  // Get the test structures
  const shape1 = getStructureByName(structures, 'SHAPE1');
  const shape1_1cm = getStructureByName(structures, 'SHAPE1_1cm');
  const shape1_shrink = getStructureByName(structures, 'SHAPE1_-0.5cm');
  const shape2 = getStructureByName(structures, 'SHAPE2');
  const shape2_1cm = getStructureByName(structures, 'SHAPE2_1cm');
  const target1 = getStructureByName(structures, 'TARGET1');
  const target1_interp = getStructureByName(structures, 'TARGET1_INTERP');
  
  const results = [];
  
  // ═══════════════════════════════════════════════════════════════════
  // TEST 1: SHAPE1 shrink by 0.5cm
  // ═══════════════════════════════════════════════════════════════════
  if (shape1 && shape1_shrink) {
    console.log('\n' + '█'.repeat(70));
    console.log('█ TEST 1: SHAPE1 shrink by 0.5cm vs SHAPE1_-0.5cm (Eclipse)');
    console.log('█'.repeat(70));
    
    // First, analyze what we expect
    const expected = analyzeExpectedMarginEffect(shape1, -5, 'SHAPE1 shrink 0.5cm');
    
    // Compare with Eclipse ground truth
    const result = compareStructures(shape1, shape1_shrink, 'SHAPE1 (original) vs SHAPE1_-0.5cm (Eclipse shrunk)');
    result.test = 'SHAPE1 shrink 0.5cm';
    result.marginMm = -5;
    results.push(result);
  } else {
    console.log('\n⚠ TEST 1 SKIPPED: Missing SHAPE1 or SHAPE1_-0.5cm');
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // TEST 2: SHAPE1 expand by 1cm
  // ═══════════════════════════════════════════════════════════════════
  if (shape1 && shape1_1cm) {
    console.log('\n' + '█'.repeat(70));
    console.log('█ TEST 2: SHAPE1 expand by 1cm vs SHAPE1_1cm (Eclipse)');
    console.log('█'.repeat(70));
    
    // Analyze expected change
    const expected = analyzeExpectedMarginEffect(shape1, 10, 'SHAPE1 expand 1cm');
    
    // Compare with Eclipse ground truth  
    const result = compareStructures(shape1, shape1_1cm, 'SHAPE1 (original) vs SHAPE1_1cm (Eclipse expanded)');
    result.test = 'SHAPE1 expand 1cm';
    result.marginMm = 10;
    results.push(result);
  } else {
    console.log('\n⚠ TEST 2 SKIPPED: Missing SHAPE1 or SHAPE1_1cm');
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // TEST 3: SHAPE2 expand by 1cm
  // ═══════════════════════════════════════════════════════════════════
  if (shape2 && shape2_1cm) {
    console.log('\n' + '█'.repeat(70));
    console.log('█ TEST 3: SHAPE2 expand by 1cm vs SHAPE2_1cm (Eclipse)');
    console.log('█'.repeat(70));
    
    // Analyze expected change
    const expected = analyzeExpectedMarginEffect(shape2, 10, 'SHAPE2 expand 1cm');
    
    // Compare with Eclipse ground truth
    const result = compareStructures(shape2, shape2_1cm, 'SHAPE2 (original) vs SHAPE2_1cm (Eclipse expanded)');
    result.test = 'SHAPE2 expand 1cm';
    result.marginMm = 10;
    results.push(result);
  } else {
    console.log('\n⚠ TEST 3 SKIPPED: Missing SHAPE2 or SHAPE2_1cm');
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // TEST 4: TARGET1 interpolation
  // ═══════════════════════════════════════════════════════════════════
  if (target1 && target1_interp) {
    console.log('\n' + '█'.repeat(70));
    console.log('█ TEST 4: TARGET1 interpolation vs TARGET1_INTERP (Eclipse)');
    console.log('█'.repeat(70));
    
    console.log('\nAnalyzing interpolation structure:');
    const contours1 = target1.contours || [];
    const contoursInterp = target1_interp.contours || [];
    
    const z1 = computeSliceZPositions(contours1);
    const zInterp = computeSliceZPositions(contoursInterp);
    
    console.log(`TARGET1: ${contours1.length} contours on ${z1.length} slices`);
    console.log(`TARGET1_INTERP: ${contoursInterp.length} contours on ${zInterp.length} slices`);
    console.log(`\nSlice gap analysis:`);
    
    for (let i = 0; i < z1.length - 1; i++) {
      const gap = z1[i + 1] - z1[i];
      console.log(`  Gap ${i + 1}: ${gap.toFixed(1)}mm (${Math.round(gap / 3) - 1} slices to interpolate)`);
    }
    
    const result = compareStructures(target1, target1_interp, 'TARGET1 (sparse) vs TARGET1_INTERP (Eclipse interpolated)');
    result.test = 'TARGET1 interpolation';
    results.push(result);
    
    // Additional analysis: check which slices are new in interpolated version
    const originalZ = new Set(z1.map(z => Math.round(z * 10) / 10));
    const newSlices = zInterp.filter(z => !originalZ.has(Math.round(z * 10) / 10));
    console.log(`\nNew interpolated slices: ${newSlices.length}`);
    console.log(`Z positions: ${newSlices.slice(0, 10).map(z => z.toFixed(1)).join(', ')}${newSlices.length > 10 ? '...' : ''}`);
  } else {
    console.log('\n⚠ TEST 4 SKIPPED: Missing TARGET1 or TARGET1_INTERP');
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('                          SUMMARY');
  console.log('═'.repeat(70));
  
  console.log('\nTest Results:');
  console.log('─'.repeat(70));
  
  for (const r of results) {
    const status = r.avgAreaRatio > 0.8 ? '✓' : '⚠';
    console.log(`\n${status} ${r.test}`);
    console.log(`   Contours: ${r.contoursA} → ${r.contoursB}`);
    console.log(`   Volume: ${(r.volumeA / 1000).toFixed(2)} → ${(r.volumeB / 1000).toFixed(2)} cm³ (${r.volumeDiffPercent > 0 ? '+' : ''}${r.volumeDiffPercent}%)`);
    console.log(`   Avg Area Match: ${(r.avgAreaRatio * 100).toFixed(1)}%`);
    console.log(`   Avg Centroid Dist: ${r.avgCentroidDist.toFixed(2)} mm`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('Note: These comparisons show the Eclipse ground truth structures.');
  console.log('To validate our margin implementation, we need to apply our margin');
  console.log('operations to SHAPE1/SHAPE2 and compare with the Eclipse results.');
  console.log('═'.repeat(70) + '\n');
  
  return results;
}

// Run the tests
runTests().catch(console.error);

