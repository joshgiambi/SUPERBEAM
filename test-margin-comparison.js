/**
 * Test margin operations against Eclipse ground truth
 * Uses SHAPE_TEST patient data
 */

const Database = require('better-sqlite3');

const db = new Database('./db.sqlite3');

// Find SHAPE_TEST patient and RT structures
const patient = db.prepare(`SELECT * FROM patients WHERE name LIKE '%SHAPE%'`).get();
console.log('Patient:', patient);

if (!patient) {
  console.error('SHAPE_TEST patient not found');
  process.exit(1);
}

// Get studies for this patient
const studies = db.prepare(`SELECT * FROM studies WHERE patient_id = ?`).all(patient.id);
console.log('Studies:', studies);

// Get RT structure sets
const rtSeries = db.prepare(`
  SELECT rs.* FROM rt_series rs 
  JOIN studies s ON rs.study_id = s.id 
  WHERE s.patient_id = ?
`).all(patient.id);
console.log('RT Series:', rtSeries);

if (rtSeries.length === 0) {
  console.error('No RT series found');
  process.exit(1);
}

// Get structures from the RT series
const structures = db.prepare(`
  SELECT * FROM rt_structures WHERE rt_series_id = ?
`).all(rtSeries[0].id);

console.log('\n=== Available Structures ===');
for (const s of structures) {
  console.log(`  ROI ${s.roi_number}: ${s.structure_name}`);
}

// Find the test structures
const shape1 = structures.find(s => s.structure_name === 'SHAPE1');
const shape1_plus1cm = structures.find(s => s.structure_name === 'SHAPE1_1cm');
const shape1_minus05 = structures.find(s => s.structure_name === 'SHAPE1_-0.5');
const shape2 = structures.find(s => s.structure_name === 'SHAPE2');
const shape2_plus1cm = structures.find(s => s.structure_name === 'SHAPE2_1cm');

console.log('\n=== Test Structures Found ===');
console.log('SHAPE1:', shape1 ? `ROI ${shape1.roi_number}` : 'NOT FOUND');
console.log('SHAPE1_1cm:', shape1_plus1cm ? `ROI ${shape1_plus1cm.roi_number}` : 'NOT FOUND');
console.log('SHAPE1_-0.5:', shape1_minus05 ? `ROI ${shape1_minus05.roi_number}` : 'NOT FOUND');
console.log('SHAPE2:', shape2 ? `ROI ${shape2.roi_number}` : 'NOT FOUND');
console.log('SHAPE2_1cm:', shape2_plus1cm ? `ROI ${shape2_plus1cm.roi_number}` : 'NOT FOUND');

// Get contours for a structure
function getContours(structureId) {
  const rows = db.prepare(`
    SELECT slice_position, points FROM rt_contours WHERE rt_structure_id = ?
  `).all(structureId);
  
  return rows.map(r => ({
    slicePosition: r.slice_position,
    points: JSON.parse(r.points)
  }));
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
function compareStructures(name1, struct1Id, name2, struct2Id) {
  const contours1 = getContours(struct1Id);
  const contours2 = getContours(struct2Id);
  
  const vol1 = calculateVolume(contours1);
  const vol2 = calculateVolume(contours2);
  
  console.log(`\n=== ${name1} vs ${name2} ===`);
  console.log(`${name1}: ${contours1.length} slices, volume = ${(vol1/1000).toFixed(2)} cc`);
  console.log(`${name2}: ${contours2.length} slices, volume = ${(vol2/1000).toFixed(2)} cc`);
  console.log(`Volume difference: ${((vol2 - vol1)/1000).toFixed(2)} cc (${((vol2/vol1 - 1) * 100).toFixed(1)}%)`);
  
  // Compare slice by slice
  const slices1 = new Map(contours1.map(c => [c.slicePosition.toFixed(1), c]));
  const slices2 = new Map(contours2.map(c => [c.slicePosition.toFixed(1), c]));
  
  console.log(`\nSlice comparison:`);
  console.log(`  ${name1} slices: ${[...slices1.keys()].slice(0, 5).join(', ')}...`);
  console.log(`  ${name2} slices: ${[...slices2.keys()].slice(0, 5).join(', ')}...`);
  
  // Check Z range
  const zMin1 = Math.min(...contours1.map(c => c.slicePosition));
  const zMax1 = Math.max(...contours1.map(c => c.slicePosition));
  const zMin2 = Math.min(...contours2.map(c => c.slicePosition));
  const zMax2 = Math.max(...contours2.map(c => c.slicePosition));
  
  console.log(`  ${name1} Z range: ${zMin1.toFixed(1)} to ${zMax1.toFixed(1)}`);
  console.log(`  ${name2} Z range: ${zMin2.toFixed(1)} to ${zMax2.toFixed(1)}`);
  console.log(`  Z extension: ${(zMin1 - zMin2).toFixed(1)} mm (inf), ${(zMax2 - zMax1).toFixed(1)} mm (sup)`);
}

// Run comparisons
if (shape1 && shape1_plus1cm) {
  compareStructures('SHAPE1', shape1.id, 'SHAPE1_1cm', shape1_plus1cm.id);
}

if (shape1 && shape1_minus05) {
  compareStructures('SHAPE1', shape1.id, 'SHAPE1_-0.5', shape1_minus05.id);
}

if (shape2 && shape2_plus1cm) {
  compareStructures('SHAPE2', shape2.id, 'SHAPE2_1cm', shape2_plus1cm.id);
}

db.close();
console.log('\n✅ Analysis complete');

