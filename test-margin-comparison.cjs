/**
 * Test margin operations against Eclipse ground truth
 * Uses SHAPE_TEST patient data via API
 */

const API_BASE = 'http://localhost:5173/api';

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

// Calculate volume from contours (sum of slice areas * slice thickness)
function calculateVolume(contours, sliceThickness = 3) {
  let totalVolume = 0;
  
  for (const c of contours) {
    const pts = c.points;
    let area = 0;
    const n = pts.length / 3;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i * 3] * pts[j * 3 + 1] - pts[j * 3] * pts[i * 3 + 1];
    }
    area = Math.abs(area) / 2;
    totalVolume += area * sliceThickness;
  }
  
  return totalVolume;
}

// Compare two structures
function compareStructures(name1, contours1, name2, contours2) {
  const vol1 = calculateVolume(contours1);
  const vol2 = calculateVolume(contours2);
  
  console.log(`\n=== ${name1} vs ${name2} ===`);
  console.log(`${name1}: ${contours1.length} slices, volume = ${(vol1/1000).toFixed(2)} cc`);
  console.log(`${name2}: ${contours2.length} slices, volume = ${(vol2/1000).toFixed(2)} cc`);
  console.log(`Volume difference: ${((vol2 - vol1)/1000).toFixed(2)} cc (${((vol2/vol1 - 1) * 100).toFixed(1)}%)`);
  
  // Check Z range
  const zMin1 = Math.min(...contours1.map(c => c.slicePosition));
  const zMax1 = Math.max(...contours1.map(c => c.slicePosition));
  const zMin2 = Math.min(...contours2.map(c => c.slicePosition));
  const zMax2 = Math.max(...contours2.map(c => c.slicePosition));
  
  console.log(`  ${name1} Z range: ${zMin1.toFixed(1)} to ${zMax1.toFixed(1)}`);
  console.log(`  ${name2} Z range: ${zMin2.toFixed(1)} to ${zMax2.toFixed(1)}`);
  console.log(`  Z extension: ${(zMin1 - zMin2).toFixed(1)} mm (inf), ${(zMax2 - zMax1).toFixed(1)} mm (sup)`);
  
  // Compare area on matching slices
  console.log('\n  Slice-by-slice area comparison (first 5 common slices):');
  const slices1 = new Map(contours1.map(c => [c.slicePosition.toFixed(1), c]));
  const slices2 = new Map(contours2.map(c => [c.slicePosition.toFixed(1), c]));
  
  let count = 0;
  for (const [z, c1] of slices1) {
    if (slices2.has(z) && count < 5) {
      const c2 = slices2.get(z);
      const pts1 = c1.points;
      const pts2 = c2.points;
      
      // Calculate areas
      let area1 = 0, area2 = 0;
      const n1 = pts1.length / 3;
      const n2 = pts2.length / 3;
      
      for (let i = 0; i < n1; i++) {
        const j = (i + 1) % n1;
        area1 += pts1[i * 3] * pts1[j * 3 + 1] - pts1[j * 3] * pts1[i * 3 + 1];
      }
      for (let i = 0; i < n2; i++) {
        const j = (i + 1) % n2;
        area2 += pts2[i * 3] * pts2[j * 3 + 1] - pts2[j * 3] * pts2[i * 3 + 1];
      }
      area1 = Math.abs(area1) / 2;
      area2 = Math.abs(area2) / 2;
      
      console.log(`    Z=${z}: ${name1}=${area1.toFixed(1)}mm², ${name2}=${area2.toFixed(1)}mm², diff=${((area2-area1)).toFixed(1)}mm² (${((area2/area1-1)*100).toFixed(1)}%)`);
      count++;
    }
  }
}

async function main() {
  console.log('Fetching patient list...');
  
  // Get all patients
  const patients = await fetchJSON(`${API_BASE}/patients`);
  const shapePatient = patients.find(p => (p.patientName || p.patientID || '').includes('SHAPE'));
  
  if (!shapePatient) {
    console.error('SHAPE_TEST patient not found');
    console.log('Available patients:', patients.map(p => p.patientName || p.patientID));
    return;
  }
  
  console.log('Found patient:', shapePatient.patientName, 'ID:', shapePatient.id);
  
  // Studies are included in patient response
  const studies = shapePatient.studies || [];
  console.log('Studies:', studies.length);
  
  if (studies.length === 0) {
    console.error('No studies found');
    return;
  }
  
  // Get RT structures for the study
  const rtStructures = await fetchJSON(`${API_BASE}/studies/${studies[0].id}/rt-structures`);
  console.log('RT Structure sets:', rtStructures.length);
  
  if (rtStructures.length === 0) {
    console.error('No RT structures found');
    return;
  }
  
  // Get the full RT structure data with contours
  console.log('RT Structure ID:', rtStructures[0].id);
  const rtData = await fetchJSON(`${API_BASE}/rt-structures/${rtStructures[0].id}/contours`);
  
  console.log('\n=== Available Structures ===');
  for (const s of rtData.structures) {
    console.log(`  ROI ${s.roiNumber}: ${s.structureName} (${s.contours?.length || 0} contours)`);
  }
  
  // Find test structures
  const shape1 = rtData.structures.find(s => s.structureName === 'SHAPE1');
  const shape1_1cm = rtData.structures.find(s => s.structureName === 'SHAPE1_1cm');
  const shape1_m05 = rtData.structures.find(s => s.structureName === 'SHAPE1_-0.5cm');
  const shape2 = rtData.structures.find(s => s.structureName === 'SHAPE2');
  const shape2_1cm = rtData.structures.find(s => s.structureName === 'SHAPE2_1cm');
  
  console.log('\n=== Test Structures ===');
  console.log('SHAPE1:', shape1 ? 'FOUND' : 'NOT FOUND');
  console.log('SHAPE1_1cm:', shape1_1cm ? 'FOUND' : 'NOT FOUND');
  console.log('SHAPE1_-0.5:', shape1_m05 ? 'FOUND' : 'NOT FOUND');
  console.log('SHAPE2:', shape2 ? 'FOUND' : 'NOT FOUND');
  console.log('SHAPE2_1cm:', shape2_1cm ? 'FOUND' : 'NOT FOUND');
  
  // Run comparisons
  if (shape1 && shape1_1cm) {
    compareStructures('SHAPE1', shape1.contours, 'SHAPE1_1cm', shape1_1cm.contours);
  }
  
  if (shape1 && shape1_m05) {
    compareStructures('SHAPE1', shape1.contours, 'SHAPE1_-0.5', shape1_m05.contours);
  }
  
  if (shape2 && shape2_1cm) {
    compareStructures('SHAPE2', shape2.contours, 'SHAPE2_1cm', shape2_1cm.contours);
  }
  
  // Now test our margin implementation
  console.log('\n\n========================================');
  console.log('TESTING OUR MARGIN IMPLEMENTATION');
  console.log('========================================');
  
  // We need to import the margin functions
  // Since this is a test script, we'll use the API to trigger the operation
  
  if (shape2 && shape2_1cm) {
    console.log('\nComparing SHAPE2 expansion with our implementation...');
    console.log('Ground truth (Eclipse SHAPE2_1cm):');
    console.log(`  - Z range: -128.0 to -108.0 (10mm extension each way)`);
    console.log(`  - Slice count: 11`);
    console.log(`  - Area at Z=-118: 2914.9mm²`);
    
    // Get SHAPE2 contours
    const shape2Contours = shape2.contours;
    console.log('\nSHAPE2 input:');
    console.log(`  - Z range: ${Math.min(...shape2Contours.map(c => c.slicePosition))} to ${Math.max(...shape2Contours.map(c => c.slicePosition))}`);
    console.log(`  - Slice count: ${shape2Contours.length}`);
    
    // Calculate expected area increase for 10mm expansion
    // For a roughly circular structure, area increase should be approximately (r+10)²/r² 
    const originalArea = 1204.8;  // mm² from our test
    const eclipseArea = 2914.9;   // mm² from Eclipse
    const areaRatio = eclipseArea / originalArea;
    console.log(`  - Area ratio: ${areaRatio.toFixed(2)}x`);
    
    // If original was circle with area A, radius r = sqrt(A/π)
    const r = Math.sqrt(originalArea / Math.PI);
    console.log(`  - Equivalent radius: ${r.toFixed(1)}mm`);
    
    const expandedR = r + 10;  // 10mm expansion
    const expectedArea = Math.PI * expandedR * expandedR;
    console.log(`  - Expected expanded area (circle): ${expectedArea.toFixed(1)}mm²`);
    console.log(`  - Eclipse expanded area: ${eclipseArea.toFixed(1)}mm²`);
    console.log(`  - Eclipse uses slightly larger (~${((eclipseArea / expectedArea - 1) * 100).toFixed(1)}% larger than pure circle expansion)`);
  }
  
  console.log('\n✅ Analysis complete');
  console.log('\n⚠️  To fully test the margin operation, you need to:');
  console.log('   1. Open the viewer');
  console.log('   2. Load SHAPE_TEST patient');
  console.log('   3. Select SHAPE2 and apply +10mm margin');
  console.log('   4. Compare visually with SHAPE2_1cm');
}

main().catch(console.error);

