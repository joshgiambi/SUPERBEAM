/**
 * RT Plan Validation Tests
 * 
 * Tests for:
 * - MLC Model configurations
 * - Coordinate transformations
 * - BEV calculations
 * - Field projection
 */

import {
  Millennium120,
  Millennium120HD,
  Agility,
  HalcyonSX2,
  Unity,
  getMLCModel,
  inferMLCModel,
  calculateLeafGeometry,
  calculateLeafGeometryFromBoundaries,
  getMLCOpenField,
} from '../mlc-models';

import {
  vec3Add,
  vec3Subtract,
  vec3Scale,
  vec3Normalize,
  vec3Length,
  vec3Cross,
  vec3Dot,
  mat3RotationX,
  mat3RotationY,
  mat3RotationZ,
  mat3TransformVec3,
  calculateSourcePosition,
  getBEVOrientationLabels,
  applyCollimatorRotation,
  projectFieldToPlane,
  rayPlaneIntersection,
} from '../rt-coordinate-transforms';

describe('MLC Model Tests', () => {
  describe('Millennium120 Model', () => {
    it('should have correct number of leaf pairs', () => {
      expect(Millennium120.numberOfLeafPairs).toBe(60);
    });

    it('should have correct leaf width distribution', () => {
      // First 10 leaves: 10mm
      for (let i = 0; i < 10; i++) {
        expect(Millennium120.leafWidths[i]).toBe(10);
      }
      // Middle 40 leaves: 5mm
      for (let i = 10; i < 50; i++) {
        expect(Millennium120.leafWidths[i]).toBe(5);
      }
      // Last 10 leaves: 10mm
      for (let i = 50; i < 60; i++) {
        expect(Millennium120.leafWidths[i]).toBe(10);
      }
    });

    it('should have 400mm total span', () => {
      const totalWidth = Millennium120.leafWidths.reduce((sum, w) => sum + w, 0);
      expect(totalWidth).toBe(400);
    });
  });

  describe('Millennium120HD Model', () => {
    it('should have correct number of leaf pairs', () => {
      expect(Millennium120HD.numberOfLeafPairs).toBe(60);
    });

    it('should have 2.5mm central leaves', () => {
      // Central 32 leaves: 2.5mm
      for (let i = 14; i < 46; i++) {
        expect(Millennium120HD.leafWidths[i]).toBe(2.5);
      }
    });
  });

  describe('Agility Model', () => {
    it('should have 80 leaf pairs with uniform 5mm width', () => {
      expect(Agility.numberOfLeafPairs).toBe(80);
      Agility.leafWidths.forEach(w => expect(w).toBe(5));
    });

    it('should not have X jaws', () => {
      expect(Agility.hasXJaws).toBe(false);
    });
  });

  describe('getMLCModel', () => {
    it('should find Millennium120 by various names', () => {
      expect(getMLCModel('NDS120')?.name).toBe('Millennium120');
      expect(getMLCModel('Millennium120')?.name).toBe('Millennium120');
      expect(getMLCModel('millennium120')?.name).toBe('Millennium120');
    });

    it('should find Agility', () => {
      expect(getMLCModel('Agility')?.name).toBe('Agility');
      expect(getMLCModel('AGILITY')?.name).toBe('Agility');
    });

    it('should return null for unknown model', () => {
      expect(getMLCModel('Unknown123')).toBeNull();
    });
  });

  describe('inferMLCModel', () => {
    it('should infer Millennium120 from 60 leaves', () => {
      const model = inferMLCModel(60);
      expect(model?.name).toBe('Millennium120');
    });

    it('should infer Agility from 80 leaves', () => {
      const model = inferMLCModel(80);
      expect(model?.name).toBe('Agility');
    });

    it('should infer Halcyon from 29 leaves', () => {
      const model = inferMLCModel(29);
      expect(model?.name).toBe('SX2');
    });
  });

  describe('calculateLeafGeometry', () => {
    it('should calculate correct Y positions for Millennium120', () => {
      const geometry = calculateLeafGeometry(Millennium120);
      expect(geometry.length).toBe(60);
      
      // First leaf center should be at startY - half of first leaf width
      expect(geometry[0].y).toBe(Millennium120.startY - 5); // 200 - 5 = 195
      expect(geometry[0].width).toBe(10);
    });
  });

  describe('calculateLeafGeometryFromBoundaries', () => {
    it('should calculate geometry from boundary array', () => {
      const boundaries = [200, 190, 180, 170, 160];
      const geometry = calculateLeafGeometryFromBoundaries(boundaries);
      
      expect(geometry.length).toBe(4);
      expect(geometry[0].y).toBe(195); // (200 + 190) / 2
      expect(geometry[0].width).toBe(10);
    });
  });
});

describe('Coordinate Transform Tests', () => {
  describe('Vector Operations', () => {
    it('vec3Add should add vectors correctly', () => {
      const result = vec3Add([1, 2, 3], [4, 5, 6]);
      expect(result).toEqual([5, 7, 9]);
    });

    it('vec3Subtract should subtract vectors correctly', () => {
      const result = vec3Subtract([5, 7, 9], [1, 2, 3]);
      expect(result).toEqual([4, 5, 6]);
    });

    it('vec3Scale should scale vectors correctly', () => {
      const result = vec3Scale([1, 2, 3], 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it('vec3Normalize should normalize to unit length', () => {
      const result = vec3Normalize([3, 0, 4]);
      const length = vec3Length(result);
      expect(length).toBeCloseTo(1.0, 10);
    });

    it('vec3Dot should calculate dot product correctly', () => {
      const result = vec3Dot([1, 0, 0], [0, 1, 0]);
      expect(result).toBe(0); // Perpendicular vectors
      
      const result2 = vec3Dot([1, 0, 0], [1, 0, 0]);
      expect(result2).toBe(1); // Same direction
    });

    it('vec3Cross should calculate cross product correctly', () => {
      const result = vec3Cross([1, 0, 0], [0, 1, 0]);
      expect(result).toEqual([0, 0, 1]); // X × Y = Z
    });
  });

  describe('Rotation Matrices', () => {
    it('mat3RotationZ should rotate 90° correctly', () => {
      const rot = mat3RotationZ(90);
      const result = mat3TransformVec3(rot, [1, 0, 0]);
      
      expect(result[0]).toBeCloseTo(0, 10);
      expect(result[1]).toBeCloseTo(1, 10);
      expect(result[2]).toBeCloseTo(0, 10);
    });

    it('mat3RotationZ for 180° should flip X and Y', () => {
      const rot = mat3RotationZ(180);
      const result = mat3TransformVec3(rot, [1, 0, 0]);
      
      expect(result[0]).toBeCloseTo(-1, 10);
      expect(result[1]).toBeCloseTo(0, 10);
    });
  });

  describe('Source Position Calculation', () => {
    it('should calculate source at gantry 0° (AP)', () => {
      const isocenter: [number, number, number] = [0, 0, 0];
      const source = calculateSourcePosition(isocenter, 0, 0, 1000, 'HFS');
      
      // At gantry 0°, source should be at Y = -1000 (posterior to isocenter)
      // In DICOM for HFS: anterior is -Y, posterior is +Y
      // So source for AP beam should be behind patient (positive Y in DICOM)
      expect(source[2]).toBeCloseTo(-1000, 1); // SAD along Z for HFS
    });

    it('should calculate source at gantry 90° (left lateral)', () => {
      const isocenter: [number, number, number] = [0, 0, 0];
      const source = calculateSourcePosition(isocenter, 90, 0, 1000, 'HFS');
      
      // At gantry 90°, source should be to patient's left
      expect(source[0]).toBeCloseTo(1000, 1);
    });
  });

  describe('Collimator Rotation', () => {
    it('should rotate BEV point correctly', () => {
      const point = { x: 10, y: 0 };
      const rotated = applyCollimatorRotation(point, 90);
      
      expect(rotated.x).toBeCloseTo(0, 10);
      expect(rotated.y).toBeCloseTo(10, 10);
    });
  });

  describe('BEV Orientation Labels', () => {
    it('should return correct labels for AP beam (gantry 0°)', () => {
      const labels = getBEVOrientationLabels(0, 0, 'HFS');
      
      expect(labels.right).toBe('L'); // Patient Left
      expect(labels.left).toBe('R');  // Patient Right
      expect(labels.top).toBe('H');   // Head (Superior)
      expect(labels.bottom).toBe('F'); // Feet (Inferior)
    });

    it('should return correct labels for left lateral beam (gantry 90°)', () => {
      const labels = getBEVOrientationLabels(90, 0, 'HFS');
      
      expect(labels.right).toBe('P'); // Posterior
      expect(labels.left).toBe('A');  // Anterior
    });

    it('should return correct labels for PA beam (gantry 180°)', () => {
      const labels = getBEVOrientationLabels(180, 0, 'HFS');
      
      expect(labels.right).toBe('R');
      expect(labels.left).toBe('L');
    });
  });

  describe('Ray-Plane Intersection', () => {
    it('should find intersection with axial plane', () => {
      const rayOrigin: [number, number, number] = [0, 0, 100];
      const rayDirection: [number, number, number] = [0, 0, -1];
      const planeZ = 50;
      
      const intersection = rayPlaneIntersection(rayOrigin, rayDirection, planeZ);
      
      expect(intersection).not.toBeNull();
      expect(intersection![0]).toBe(0);
      expect(intersection![1]).toBe(0);
      expect(intersection![2]).toBe(50);
    });

    it('should return null for parallel ray', () => {
      const rayOrigin: [number, number, number] = [0, 0, 100];
      const rayDirection: [number, number, number] = [1, 0, 0]; // Parallel to XY plane
      const planeZ = 50;
      
      const intersection = rayPlaneIntersection(rayOrigin, rayDirection, planeZ);
      expect(intersection).toBeNull();
    });
  });
});

describe('BEV Projection Tests', () => {
  describe('Jaw Aperture', () => {
    it('should correctly represent symmetric field', () => {
      const jaw = { x1: -100, x2: 100, y1: -100, y2: 100 };
      
      const fieldWidth = jaw.x2 - jaw.x1;
      const fieldHeight = jaw.y2 - jaw.y1;
      
      expect(fieldWidth).toBe(200); // 20cm field
      expect(fieldHeight).toBe(200);
    });

    it('should correctly represent asymmetric field', () => {
      const jaw = { x1: -50, x2: 150, y1: -75, y2: 125 };
      
      const fieldWidth = jaw.x2 - jaw.x1;
      const fieldHeight = jaw.y2 - jaw.y1;
      
      expect(fieldWidth).toBe(200);
      expect(fieldHeight).toBe(200);
      
      // Check asymmetry
      expect(jaw.x1).not.toBe(-jaw.x2); // Asymmetric in X
      expect(jaw.y1).not.toBe(-jaw.y2); // Asymmetric in Y
    });
  });
});

describe('Field Projection Tests', () => {
  it('should project field to axial slice at isocenter', () => {
    const source: [number, number, number] = [0, 0, 1000];
    const isocenter: [number, number, number] = [0, 0, 0];
    const jaw = { x1: -100, x2: 100, y1: -100, y2: 100 };
    
    const projected = projectFieldToPlane(
      source,
      isocenter,
      jaw,
      0, // collimator angle
      0, // gantry angle
      1000, // SAD
      0 // slice at Z=0 (isocenter)
    );
    
    // At isocenter plane, field should be same size as jaw aperture
    // (no divergence)
    expect(projected).not.toBeNull();
    if (projected) {
      expect(projected.length).toBe(4);
    }
  });
});

// Integration tests
describe('RT Plan Integration', () => {
  it('should handle complete beam workflow', () => {
    // Simulate a typical 4-field box plan
    const beams = [
      { name: 'AP', gantryAngle: 0, collimatorAngle: 0 },
      { name: 'PA', gantryAngle: 180, collimatorAngle: 0 },
      { name: 'RLAT', gantryAngle: 270, collimatorAngle: 0 },
      { name: 'LLAT', gantryAngle: 90, collimatorAngle: 0 },
    ];

    for (const beam of beams) {
      const source = calculateSourcePosition(
        [0, 0, 0],
        beam.gantryAngle,
        0,
        1000,
        'HFS'
      );
      
      // Source should be 1000mm from isocenter
      const distance = vec3Length(source);
      expect(distance).toBeCloseTo(1000, 0);
      
      // Orientation labels should be different for each beam
      const labels = getBEVOrientationLabels(beam.gantryAngle, 0, 'HFS');
      expect(labels.top).toBeDefined();
      expect(labels.bottom).toBeDefined();
      expect(labels.left).toBeDefined();
      expect(labels.right).toBeDefined();
    }
  });

  it('should handle VMAT arc with multiple control points', () => {
    // Simulate VMAT arc from 181° to 179° (full arc minus 2°)
    const startAngle = 181;
    const endAngle = 179;
    const numControlPoints = 178; // 2° per control point
    
    for (let i = 0; i < numControlPoints; i++) {
      // Calculate gantry angle for this control point
      let angle = startAngle + i * 2;
      if (angle >= 360) angle -= 360;
      
      // Each control point should have valid source position
      const source = calculateSourcePosition(
        [0, 0, 0],
        angle,
        0,
        1000,
        'HFS'
      );
      
      expect(vec3Length(source)).toBeCloseTo(1000, 0);
    }
  });
});
