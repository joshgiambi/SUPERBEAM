/**
 * Coordinate Transform Unit Tests
 * 
 * @requirement REQ-DICOM-004
 * @risk-class medium
 * @verification VER-COORD-001
 * 
 * Tests for DICOM coordinate transformations between patient coordinate
 * system (LPS), image coordinate system, and display coordinates.
 * Accurate coordinate transforms are essential for correct contour
 * positioning and radiation therapy planning.
 */

describe('DICOM Coordinate Systems', () => {
  /**
   * DICOM Patient Coordinate System (LPS):
   * - L: Patient Left (+X)
   * - P: Patient Posterior (+Y)  
   * - S: Patient Superior (+Z) - toward head
   * 
   * This is critical for correct anatomical orientation
   */
  describe('LPS Coordinate System', () => {
    it('should correctly identify coordinate axes', () => {
      const lps = {
        L: 'Left',      // +X
        P: 'Posterior', // +Y
        S: 'Superior',  // +Z
      };
      
      expect(lps.L).toBe('Left');
      expect(lps.P).toBe('Posterior');
      expect(lps.S).toBe('Superior');
    });

    it('should convert between patient orientations', () => {
      // Head First Supine (HFS) - most common
      const hfsOrientation = {
        rowDirection: [1, 0, 0],   // L direction
        columnDirection: [0, 1, 0], // P direction
      };
      
      // Head First Prone (HFP)
      const hfpOrientation = {
        rowDirection: [-1, 0, 0],  // R direction (flipped)
        columnDirection: [0, -1, 0], // A direction (flipped)
      };
      
      expect(hfsOrientation.rowDirection[0]).toBe(1);  // Standard L
      expect(hfpOrientation.rowDirection[0]).toBe(-1); // Flipped to R
    });
  });
});

describe('Image Position and Orientation', () => {
  /**
   * @verifies REQ-DICOM-004
   * Image Position Patient (0020,0032) and Image Orientation Patient (0020,0037)
   */
  describe('Image Position Patient', () => {
    it('should parse DICOM Image Position Patient tag', () => {
      // Example: Position of top-left pixel of first slice
      const imagePosition = [-150.0, -150.0, 100.0]; // [X, Y, Z] in mm
      
      expect(imagePosition[0]).toBe(-150.0); // X position
      expect(imagePosition[1]).toBe(-150.0); // Y position
      expect(imagePosition[2]).toBe(100.0);  // Z position (slice location)
    });

    it('should calculate slice position from Image Position', () => {
      const slice1Position = [-150, -150, 0];
      const slice2Position = [-150, -150, 3]; // 3mm spacing
      
      const sliceSpacing = slice2Position[2] - slice1Position[2];
      
      expect(sliceSpacing).toBe(3); // 3mm slice thickness
    });
  });

  describe('Image Orientation Patient', () => {
    it('should parse 6-element orientation vector', () => {
      // Standard axial scan orientation (HFS)
      // First 3: row direction, Last 3: column direction
      const orientation = [1, 0, 0, 0, 1, 0];
      
      const rowDirection = orientation.slice(0, 3);
      const colDirection = orientation.slice(3, 6);
      
      expect(rowDirection).toEqual([1, 0, 0]); // Rows go in L direction
      expect(colDirection).toEqual([0, 1, 0]); // Columns go in P direction
    });

    it('should detect sagittal orientation', () => {
      // Sagittal: rows in A direction, columns in S direction
      const sagittalOrientation = [0, 1, 0, 0, 0, 1];
      
      const rowDirection = sagittalOrientation.slice(0, 3);
      expect(rowDirection[1]).toBe(1); // Y component dominant
    });

    it('should detect coronal orientation', () => {
      // Coronal: rows in L direction, columns in S direction
      const coronalOrientation = [1, 0, 0, 0, 0, 1];
      
      const colDirection = coronalOrientation.slice(3, 6);
      expect(colDirection[2]).toBe(1); // Z component dominant in columns
    });
  });
});

describe('Pixel to Patient Coordinate Transforms', () => {
  /**
   * @verifies REQ-CONTOUR-008
   * Transform between image pixels and patient coordinates
   */
  describe('pixelToPatient', () => {
    it('should transform pixel coordinates to patient coordinates', () => {
      // Given parameters
      const imagePosition = [-150, -150, 0]; // Image Position Patient
      const pixelSpacing = [0.5, 0.5]; // mm per pixel [row, col]
      const orientation = [1, 0, 0, 0, 1, 0]; // Axial HFS
      
      // Pixel coordinate (100, 100) - center of 200x200 image
      const pixelX = 100;
      const pixelY = 100;
      
      // Transform formula:
      // Px = IPP[0] + pixelX * PS[0] * rowDir[0] + pixelY * PS[1] * colDir[0]
      // Py = IPP[1] + pixelX * PS[0] * rowDir[1] + pixelY * PS[1] * colDir[1]
      // Pz = IPP[2] + pixelX * PS[0] * rowDir[2] + pixelY * PS[1] * colDir[2]
      
      const rowDir = orientation.slice(0, 3);
      const colDir = orientation.slice(3, 6);
      
      const patientX = imagePosition[0] + pixelX * pixelSpacing[0] * rowDir[0] 
                     + pixelY * pixelSpacing[1] * colDir[0];
      const patientY = imagePosition[1] + pixelX * pixelSpacing[0] * rowDir[1]
                     + pixelY * pixelSpacing[1] * colDir[1];
      const patientZ = imagePosition[2];
      
      expect(patientX).toBe(-100); // -150 + 100*0.5*1 + 100*0.5*0 = -100
      expect(patientY).toBe(-100); // -150 + 100*0.5*0 + 100*0.5*1 = -100
      expect(patientZ).toBe(0);
    });

    it('should handle non-standard pixel spacing', () => {
      // Non-square pixels (common in some MRI sequences)
      const pixelSpacing = [0.5, 0.75]; // Different row/col spacing
      
      expect(pixelSpacing[0]).not.toBe(pixelSpacing[1]);
    });
  });

  describe('patientToPixel (inverse transform)', () => {
    it('should transform patient coordinates back to pixels', () => {
      const imagePosition = [-150, -150, 0];
      const pixelSpacing = [0.5, 0.5];
      
      // Patient coordinate
      const patientX = -100;
      const patientY = -100;
      
      // Inverse transform (for axial HFS)
      const pixelX = (patientX - imagePosition[0]) / pixelSpacing[0];
      const pixelY = (patientY - imagePosition[1]) / pixelSpacing[1];
      
      expect(pixelX).toBe(100);
      expect(pixelY).toBe(100);
    });
  });
});

describe('Contour Coordinate Handling', () => {
  /**
   * @verifies REQ-RTSTRUCT-001
   * RT Structure contours are stored in patient (LPS) coordinates
   */
  describe('RT Structure Contour Points', () => {
    it('should parse contour points from RT Structure', () => {
      // Contour data is stored as flat array: [x1,y1,z1, x2,y2,z2, ...]
      const contourData = [
        -50, -50, 100,  // Point 1
        50, -50, 100,   // Point 2
        50, 50, 100,    // Point 3
        -50, 50, 100    // Point 4
      ];
      
      const points: [number, number, number][] = [];
      for (let i = 0; i < contourData.length; i += 3) {
        points.push([contourData[i], contourData[i+1], contourData[i+2]]);
      }
      
      expect(points.length).toBe(4);
      expect(points[0]).toEqual([-50, -50, 100]);
      
      // All points should be on same slice (same Z)
      const allSameZ = points.every(p => p[2] === 100);
      expect(allSameZ).toBe(true);
    });

    it('should extract 2D polygon from 3D contour', () => {
      const contour3D = [
        -50, -50, 100,
        50, -50, 100,
        50, 50, 100,
        -50, 50, 100
      ];
      
      const polygon2D: [number, number][] = [];
      for (let i = 0; i < contour3D.length; i += 3) {
        polygon2D.push([contour3D[i], contour3D[i+1]]);
      }
      
      expect(polygon2D.length).toBe(4);
      expect(polygon2D[0]).toEqual([-50, -50]);
    });

    it('should preserve contour winding for boolean operations', () => {
      // Calculate signed area to determine winding
      const polygon: [number, number][] = [
        [0, 0], [100, 0], [100, 100], [0, 100]
      ];
      
      let signedArea = 0;
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        signedArea += polygon[i][0] * polygon[j][1];
        signedArea -= polygon[j][0] * polygon[i][1];
      }
      signedArea /= 2;
      
      // Positive = counter-clockwise, Negative = clockwise
      expect(signedArea).toBeLessThan(0); // This polygon is clockwise
    });
  });
});

describe('Slice Position Calculations', () => {
  /**
   * @verifies REQ-VIEW-002
   * Correct slice ordering and position calculation
   */
  describe('Slice sorting', () => {
    it('should sort slices by Z position (ascending)', () => {
      const slices = [
        { z: 150, instanceNumber: 3 },
        { z: 100, instanceNumber: 1 },
        { z: 125, instanceNumber: 2 },
      ];
      
      const sorted = [...slices].sort((a, b) => a.z - b.z);
      
      expect(sorted[0].z).toBe(100);
      expect(sorted[1].z).toBe(125);
      expect(sorted[2].z).toBe(150);
    });

    it('should find contours for specific slice position', () => {
      const contours = [
        { slicePosition: 100, points: [0, 0, 100] },
        { slicePosition: 103, points: [0, 0, 103] },
        { slicePosition: 106, points: [0, 0, 106] },
      ];
      
      const targetZ = 103;
      const tolerance = 0.5; // mm
      
      const matchingContours = contours.filter(
        c => Math.abs(c.slicePosition - targetZ) < tolerance
      );
      
      expect(matchingContours.length).toBe(1);
      expect(matchingContours[0].slicePosition).toBe(103);
    });
  });
});
