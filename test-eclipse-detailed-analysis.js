/**
 * Detailed Slice-by-Slice Analysis of Eclipse Ground Truth
 * 
 * This script performs detailed geometric analysis of:
 * 1. Margin expansion/shrinking behavior
 * 2. Interpolation quality
 * 
 * Without reimplementing the margin algorithm, we analyze what Eclipse does
 * to understand the expected behavior and verify our implementation matches.
 */

const API_BASE = 'http://localhost:5173';
const RT_STRUCT_ID = 3669;

// ═══════════════════════════════════════════════════════════════════════
// GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════════════

function polygonArea(points) {
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

function polygonPerimeter(points) {
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

function polygonBoundingBox(points) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  const n = points.length / 3;
  for (let i = 0; i < n; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

// Estimate the "equivalent radius" of a polygon (as if it were a circle)
function equivalentRadius(area) {
  return Math.sqrt(area / Math.PI);
}

// ═══════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

async function fetchStructures() {
  const res = await fetch(`${API_BASE}/api/rt-structures/${RT_STRUCT_ID}/contours`);
  const data = await res.json();
  return data.structures || [];
}

function getStructureByName(structures, name) {
  return structures.find(s => s.structureName === name);
}

function groupContoursByZ(contours, tolerance = 0.5) {
  const groups = new Map();
  for (const c of contours) {
    const z = Math.round(c.slicePosition * 10) / 10; // Round to 0.1mm
    if (!groups.has(z)) groups.set(z, []);
    groups.get(z).push(c);
  }
  return groups;
}

// ═══════════════════════════════════════════════════════════════════════
// MARGIN ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

function analyzeMarginOperation(source, result, marginMm, title) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`MARGIN ANALYSIS: ${title}`);
  console.log(`${'═'.repeat(70)}\n`);
  
  const srcContours = source.contours || [];
  const resContours = result.contours || [];
  
  const srcByZ = groupContoursByZ(srcContours);
  const resByZ = groupContoursByZ(resContours);
  
  const srcZs = Array.from(srcByZ.keys()).sort((a, b) => a - b);
  const resZs = Array.from(resByZ.keys()).sort((a, b) => a - b);
  
  console.log(`Source: ${source.structureName}`);
  console.log(`  Contours: ${srcContours.length}`);
  console.log(`  Z-range: ${srcZs[0]?.toFixed(1)} to ${srcZs[srcZs.length - 1]?.toFixed(1)} mm (${srcZs.length} slices)`);
  
  console.log(`\nResult: ${result.structureName}`);
  console.log(`  Contours: ${resContours.length}`);
  console.log(`  Z-range: ${resZs[0]?.toFixed(1)} to ${resZs[resZs.length - 1]?.toFixed(1)} mm (${resZs.length} slices)`);
  
  // Z-extension analysis
  const srcZMin = srcZs[0];
  const srcZMax = srcZs[srcZs.length - 1];
  const resZMin = resZs[0];
  const resZMax = resZs[resZs.length - 1];
  
  const zExtensionSup = Math.abs(resZMax - srcZMax);
  const zExtensionInf = Math.abs(srcZMin - resZMin);
  
  console.log(`\nZ-EXTENSION (for ${marginMm}mm margin):`);
  console.log(`  Expected: ~${Math.abs(marginMm)}mm each direction`);
  console.log(`  Actual Superior: ${zExtensionSup.toFixed(1)}mm`);
  console.log(`  Actual Inferior: ${zExtensionInf.toFixed(1)}mm`);
  console.log(`  Match: ${Math.abs(zExtensionSup - Math.abs(marginMm)) < 2 && Math.abs(zExtensionInf - Math.abs(marginMm)) < 2 ? '✓' : '⚠'}`);
  
  // Analyze slice-by-slice
  console.log(`\n${'─'.repeat(70)}`);
  console.log('SLICE-BY-SLICE ANALYSIS:');
  console.log(`${'─'.repeat(70)}`);
  console.log(`${'Z(mm)'.padStart(10)} ${'SrcArea'.padStart(10)} ${'ResArea'.padStart(10)} ${'ΔArea%'.padStart(10)} ${'SrcR'.padStart(8)} ${'ResR'.padStart(8)} ${'ΔR(mm)'.padStart(8)}`);
  console.log(`${'─'.repeat(70)}`);
  
  const sliceAnalysis = [];
  
  // Find matching slices
  for (const srcZ of srcZs) {
    // Find closest result slice
    let closestResZ = null;
    let closestDist = Infinity;
    for (const resZ of resZs) {
      const dist = Math.abs(resZ - srcZ);
      if (dist < closestDist) {
        closestDist = dist;
        closestResZ = resZ;
      }
    }
    
    if (closestResZ !== null && closestDist < 1.0) {
      const srcConts = srcByZ.get(srcZ) || [];
      const resConts = resByZ.get(closestResZ) || [];
      
      // Use largest contour on each slice
      let srcArea = 0, resArea = 0;
      for (const c of srcConts) srcArea = Math.max(srcArea, polygonArea(c.points));
      for (const c of resConts) resArea = Math.max(resArea, polygonArea(c.points));
      
      const srcRadius = equivalentRadius(srcArea);
      const resRadius = equivalentRadius(resArea);
      const deltaRadius = resRadius - srcRadius;
      const deltaAreaPercent = srcArea > 0 ? ((resArea - srcArea) / srcArea * 100) : 0;
      
      console.log(
        `${srcZ.toFixed(1).padStart(10)} ` +
        `${srcArea.toFixed(0).padStart(10)} ` +
        `${resArea.toFixed(0).padStart(10)} ` +
        `${(deltaAreaPercent > 0 ? '+' : '') + deltaAreaPercent.toFixed(1).padStart(9)} ` +
        `${srcRadius.toFixed(1).padStart(8)} ` +
        `${resRadius.toFixed(1).padStart(8)} ` +
        `${(deltaRadius > 0 ? '+' : '') + deltaRadius.toFixed(1).padStart(7)}`
      );
      
      sliceAnalysis.push({
        z: srcZ,
        srcArea,
        resArea,
        srcRadius,
        resRadius,
        deltaRadius,
        deltaAreaPercent
      });
    }
  }
  
  // Summary statistics
  if (sliceAnalysis.length > 0) {
    const avgDeltaRadius = sliceAnalysis.reduce((s, a) => s + a.deltaRadius, 0) / sliceAnalysis.length;
    const minDeltaRadius = Math.min(...sliceAnalysis.map(a => a.deltaRadius));
    const maxDeltaRadius = Math.max(...sliceAnalysis.map(a => a.deltaRadius));
    
    console.log(`${'─'.repeat(70)}`);
    console.log(`\nRADIUS CHANGE STATISTICS:`);
    console.log(`  Expected margin: ${marginMm}mm`);
    console.log(`  Average ΔRadius: ${avgDeltaRadius.toFixed(2)}mm`);
    console.log(`  Min ΔRadius:     ${minDeltaRadius.toFixed(2)}mm`);
    console.log(`  Max ΔRadius:     ${maxDeltaRadius.toFixed(2)}mm`);
    console.log(`  Error from expected: ${(avgDeltaRadius - marginMm).toFixed(2)}mm`);
    
    // Check if margin is applied correctly
    const marginMatch = Math.abs(avgDeltaRadius - marginMm) < 2; // Within 2mm
    console.log(`\n  VERDICT: ${marginMatch ? '✓ Margin matches within 2mm tolerance' : '⚠ Margin differs significantly'}`);
    
    return {
      expectedMargin: marginMm,
      avgActualMargin: avgDeltaRadius,
      error: avgDeltaRadius - marginMm,
      zExtensionSup,
      zExtensionInf,
      sliceCount: sliceAnalysis.length,
      passed: marginMatch
    };
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// INTERPOLATION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

function analyzeInterpolation(sparse, interpolated, title) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`INTERPOLATION ANALYSIS: ${title}`);
  console.log(`${'═'.repeat(70)}\n`);
  
  const sparseContours = sparse.contours || [];
  const interpContours = interpolated.contours || [];
  
  const sparseByZ = groupContoursByZ(sparseContours);
  const interpByZ = groupContoursByZ(interpContours);
  
  const sparseZs = Array.from(sparseByZ.keys()).sort((a, b) => a - b);
  const interpZs = Array.from(interpByZ.keys()).sort((a, b) => a - b);
  
  console.log(`Sparse (keyframes): ${sparse.structureName}`);
  console.log(`  Slices: ${sparseZs.length}`);
  console.log(`  Z-range: ${sparseZs[0]?.toFixed(1)} to ${sparseZs[sparseZs.length - 1]?.toFixed(1)} mm`);
  
  console.log(`\nInterpolated: ${interpolated.structureName}`);
  console.log(`  Slices: ${interpZs.length}`);
  console.log(`  Z-range: ${interpZs[0]?.toFixed(1)} to ${interpZs[interpZs.length - 1]?.toFixed(1)} mm`);
  
  // Identify keyframes vs interpolated
  const keyframeZs = new Set(sparseZs.map(z => Math.round(z * 10) / 10));
  const newSlices = interpZs.filter(z => !keyframeZs.has(Math.round(z * 10) / 10));
  
  console.log(`\nSLICE BREAKDOWN:`);
  console.log(`  Keyframes: ${sparseZs.length}`);
  console.log(`  Interpolated: ${newSlices.length}`);
  console.log(`  Total: ${interpZs.length}`);
  
  // Analyze gaps and interpolation
  console.log(`\n${'─'.repeat(70)}`);
  console.log('GAP ANALYSIS:');
  console.log(`${'─'.repeat(70)}`);
  
  let totalGapSlices = 0;
  const sliceThickness = 2.0; // mm
  
  for (let i = 0; i < sparseZs.length - 1; i++) {
    const z1 = sparseZs[i];
    const z2 = sparseZs[i + 1];
    const gap = z2 - z1;
    const expectedSlices = Math.max(0, Math.floor(gap / sliceThickness) - 1);
    
    // Count actual interpolated slices in this gap
    const actualSlices = newSlices.filter(z => z > z1 && z < z2).length;
    
    console.log(`  Gap ${i + 1}: Z=${z1.toFixed(0)} to ${z2.toFixed(0)} (${gap.toFixed(0)}mm)`);
    console.log(`    Expected: ${expectedSlices} slices, Actual: ${actualSlices} slices`);
    
    totalGapSlices += actualSlices;
  }
  
  // Analyze keyframe preservation
  console.log(`\n${'─'.repeat(70)}`);
  console.log('KEYFRAME PRESERVATION:');
  console.log(`${'─'.repeat(70)}`);
  console.log(`${'Z(mm)'.padStart(10)} ${'SparseArea'.padStart(12)} ${'InterpArea'.padStart(12)} ${'Match%'.padStart(10)}`);
  
  let perfectMatches = 0;
  for (const z of sparseZs) {
    const sparseConts = sparseByZ.get(z) || [];
    
    // Find matching interpolated slice
    let interpZ = null;
    for (const iz of interpZs) {
      if (Math.abs(iz - z) < 0.5) {
        interpZ = iz;
        break;
      }
    }
    
    if (interpZ !== null) {
      const interpConts = interpByZ.get(interpZ) || [];
      
      let sparseArea = 0, interpArea = 0;
      for (const c of sparseConts) sparseArea = Math.max(sparseArea, polygonArea(c.points));
      for (const c of interpConts) interpArea = Math.max(interpArea, polygonArea(c.points));
      
      const match = sparseArea > 0 ? (Math.min(sparseArea, interpArea) / Math.max(sparseArea, interpArea) * 100) : 0;
      
      console.log(
        `${z.toFixed(1).padStart(10)} ` +
        `${sparseArea.toFixed(0).padStart(12)} ` +
        `${interpArea.toFixed(0).padStart(12)} ` +
        `${match.toFixed(1).padStart(9)}%`
      );
      
      if (match > 99) perfectMatches++;
    }
  }
  
  console.log(`\n  Keyframes preserved: ${perfectMatches}/${sparseZs.length}`);
  
  // Analyze smoothness of interpolation
  console.log(`\n${'─'.repeat(70)}`);
  console.log('INTERPOLATION SMOOTHNESS:');
  console.log(`${'─'.repeat(70)}`);
  
  const allAreas = [];
  for (const z of interpZs) {
    const conts = interpByZ.get(z) || [];
    let maxArea = 0;
    for (const c of conts) maxArea = Math.max(maxArea, polygonArea(c.points));
    allAreas.push({ z, area: maxArea });
  }
  
  // Calculate area changes between consecutive slices
  const areaChanges = [];
  for (let i = 1; i < allAreas.length; i++) {
    const prev = allAreas[i - 1];
    const curr = allAreas[i];
    const change = Math.abs(curr.area - prev.area);
    const changePercent = prev.area > 0 ? (change / prev.area * 100) : 0;
    areaChanges.push(changePercent);
  }
  
  const avgChange = areaChanges.reduce((s, c) => s + c, 0) / areaChanges.length;
  const maxChange = Math.max(...areaChanges);
  
  console.log(`  Average area change between slices: ${avgChange.toFixed(1)}%`);
  console.log(`  Maximum area change between slices: ${maxChange.toFixed(1)}%`);
  console.log(`  Smoothness: ${avgChange < 15 ? '✓ Good' : '⚠ Rough'}`);
  
  return {
    keyframes: sparseZs.length,
    interpolated: newSlices.length,
    total: interpZs.length,
    keyframesPreserved: perfectMatches,
    avgAreaChange: avgChange,
    maxAreaChange: maxChange,
    passed: perfectMatches === sparseZs.length && avgChange < 15
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   DETAILED ECLIPSE GROUND TRUTH ANALYSIS                           ║');
  console.log('║   Understanding Margin and Interpolation Behavior                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Fetching structures...');
  const structures = await fetchStructures();
  console.log(`Loaded ${structures.length} structures\n`);
  
  const shape1 = getStructureByName(structures, 'SHAPE1');
  const shape1_1cm = getStructureByName(structures, 'SHAPE1_1cm');
  const shape1_shrink = getStructureByName(structures, 'SHAPE1_-0.5cm');
  const shape2 = getStructureByName(structures, 'SHAPE2');
  const shape2_1cm = getStructureByName(structures, 'SHAPE2_1cm');
  const target1 = getStructureByName(structures, 'TARGET1');
  const target1_interp = getStructureByName(structures, 'TARGET1_INTERP');
  
  const results = {
    margins: [],
    interpolation: null
  };
  
  // Margin analysis
  if (shape1 && shape1_shrink) {
    const r = analyzeMarginOperation(shape1, shape1_shrink, -5, 'SHAPE1 → SHAPE1_-0.5cm (shrink 5mm)');
    if (r) results.margins.push({ name: 'SHAPE1 shrink 0.5cm', ...r });
  }
  
  if (shape1 && shape1_1cm) {
    const r = analyzeMarginOperation(shape1, shape1_1cm, 10, 'SHAPE1 → SHAPE1_1cm (expand 10mm)');
    if (r) results.margins.push({ name: 'SHAPE1 expand 1cm', ...r });
  }
  
  if (shape2 && shape2_1cm) {
    const r = analyzeMarginOperation(shape2, shape2_1cm, 10, 'SHAPE2 → SHAPE2_1cm (expand 10mm)');
    if (r) results.margins.push({ name: 'SHAPE2 expand 1cm', ...r });
  }
  
  // Interpolation analysis
  if (target1 && target1_interp) {
    const r = analyzeInterpolation(target1, target1_interp, 'TARGET1 → TARGET1_INTERP');
    results.interpolation = r;
  }
  
  // Final Summary
  console.log('\n' + '═'.repeat(70));
  console.log('                         FINAL SUMMARY');
  console.log('═'.repeat(70));
  
  console.log('\nMARGIN OPERATIONS:');
  for (const m of results.margins) {
    const status = m.passed ? '✓' : '⚠';
    console.log(`  ${status} ${m.name}`);
    console.log(`      Expected: ${m.expectedMargin}mm, Actual avg: ${m.avgActualMargin.toFixed(1)}mm (error: ${m.error.toFixed(1)}mm)`);
    console.log(`      Z-extension: Sup=${m.zExtensionSup.toFixed(1)}mm, Inf=${m.zExtensionInf.toFixed(1)}mm`);
  }
  
  if (results.interpolation) {
    const i = results.interpolation;
    const status = i.passed ? '✓' : '⚠';
    console.log(`\nINTERPOLATION:`);
    console.log(`  ${status} TARGET1 interpolation`);
    console.log(`      Keyframes: ${i.keyframes}, Interpolated: ${i.interpolated}, Total: ${i.total}`);
    console.log(`      Keyframes preserved: ${i.keyframesPreserved}/${i.keyframes}`);
    console.log(`      Smoothness: avg ${i.avgAreaChange.toFixed(1)}% area change, max ${i.maxAreaChange.toFixed(1)}%`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('KEY FINDINGS FOR IMPLEMENTATION:');
  console.log('═'.repeat(70));
  console.log(`
1. MARGIN EXPANSION (10mm):
   - Eclipse adds ~10mm to equivalent radius on each slice
   - Extends Z-range by ~10mm in both directions
   - Creates new slices in the extended Z-range

2. MARGIN SHRINKING (-5mm):
   - Eclipse reduces equivalent radius by ~5mm
   - Removes slices where structure would be too small
   - Z-range shrinks from both ends

3. INTERPOLATION:
   - Eclipse preserves keyframe slices exactly
   - Creates smooth transitions between keyframes
   - Uses ~2mm slice spacing for interpolated slices
`);
  
  console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);

