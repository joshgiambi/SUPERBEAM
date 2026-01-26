/**
 * Polygon Utilities Unit Tests
 * 
 * @requirement REQ-CONTOUR-001
 * @risk-class medium
 * @verification VER-POLYGON-001
 * 
 * Tests for polygon calculation functions used in RT structure contour operations.
 * These calculations are critical for accurate contour area, centroid, and 
 * geometric operations used in treatment planning verification.
 */

import {
  calculatePolygonArea,
  calculatePolygonCentroid,
  isPolygonClockwise,
  reversePolygon,
  getPolygonBounds,
  boundingBoxesOverlap,
  contourToPolygon,
  polygonToContour,
  simplifyPolygon,
  findLineIntersection,
} from '../polygon-utils';

describe('Polygon Area Calculations', () => {
  /**
   * @verifies REQ-CONTOUR-001
   * Area calculation is critical for volume estimation in treatment planning
   */
  describe('calculatePolygonArea', () => {
    it('should calculate area of a unit square correctly', () => {
      const square: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      
      const area = calculatePolygonArea(square);
      expect(area).toBeCloseTo(1.0, 10);
    });

    it('should calculate area of a 10x10 square correctly', () => {
      const square: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      
      const area = calculatePolygonArea(square);
      expect(area).toBeCloseTo(100.0, 10);
    });

    it('should calculate area of a right triangle correctly', () => {
      // Triangle with base 3, height 4 => area = 6
      const triangle: [number, number][] = [
        [0, 0],
        [3, 0],
        [0, 4],
      ];
      
      const area = calculatePolygonArea(triangle);
      expect(area).toBeCloseTo(6.0, 10);
    });

    it('should return same area regardless of winding order', () => {
      const clockwise: [number, number][] = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      
      const counterClockwise: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      
      expect(calculatePolygonArea(clockwise)).toBeCloseTo(calculatePolygonArea(counterClockwise), 10);
    });

    it('should handle irregular polygon (L-shape)', () => {
      // L-shaped polygon: 3 unit squares worth of area
      const lShape: [number, number][] = [
        [0, 0],
        [2, 0],
        [2, 1],
        [1, 1],
        [1, 2],
        [0, 2],
      ];
      
      const area = calculatePolygonArea(lShape);
      expect(area).toBeCloseTo(3.0, 10);
    });

    it('should return 0 for a degenerate polygon (line)', () => {
      const line: [number, number][] = [
        [0, 0],
        [1, 1],
      ];
      
      const area = calculatePolygonArea(line);
      expect(area).toBeCloseTo(0, 10);
    });
  });
});

describe('Polygon Centroid Calculations', () => {
  /**
   * @verifies REQ-CONTOUR-002
   * Centroid is used for structure labeling and isocenter calculations
   */
  describe('calculatePolygonCentroid', () => {
    it('should find centroid of a unit square at (0.5, 0.5)', () => {
      const square: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      
      const centroid = calculatePolygonCentroid(square);
      expect(centroid[0]).toBeCloseTo(0.5, 10);
      expect(centroid[1]).toBeCloseTo(0.5, 10);
    });

    it('should find centroid of a rectangle', () => {
      const rectangle: [number, number][] = [
        [0, 0],
        [4, 0],
        [4, 2],
        [0, 2],
      ];
      
      const centroid = calculatePolygonCentroid(rectangle);
      expect(centroid[0]).toBeCloseTo(2.0, 10);
      expect(centroid[1]).toBeCloseTo(1.0, 10);
    });

    it('should find centroid of a triangle', () => {
      // Equilateral-ish triangle centered at origin
      const triangle: [number, number][] = [
        [0, 0],
        [3, 0],
        [1.5, 3],
      ];
      
      const centroid = calculatePolygonCentroid(triangle);
      // Centroid of triangle is at (sum of x / 3, sum of y / 3)
      expect(centroid[0]).toBeCloseTo(1.5, 5);
      expect(centroid[1]).toBeCloseTo(1.0, 5);
    });
  });
});

describe('Polygon Winding Order', () => {
  /**
   * @verifies REQ-CONTOUR-003
   * Winding order affects boolean operations on contours
   */
  describe('isPolygonClockwise', () => {
    it('should identify clockwise polygon', () => {
      const clockwise: [number, number][] = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      
      expect(isPolygonClockwise(clockwise)).toBe(true);
    });

    it('should identify counter-clockwise polygon', () => {
      const counterClockwise: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      
      expect(isPolygonClockwise(counterClockwise)).toBe(false);
    });
  });

  describe('reversePolygon', () => {
    it('should reverse winding order', () => {
      const original: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      
      const reversed = reversePolygon(original);
      
      expect(isPolygonClockwise(original)).not.toBe(isPolygonClockwise(reversed));
    });

    it('should not mutate original array', () => {
      const original: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
      ];
      const originalCopy = JSON.parse(JSON.stringify(original));
      
      reversePolygon(original);
      
      expect(original).toEqual(originalCopy);
    });
  });
});

describe('Bounding Box Operations', () => {
  /**
   * @verifies REQ-CONTOUR-004
   * Bounding boxes are used for fast intersection tests
   */
  describe('getPolygonBounds', () => {
    it('should calculate bounds of a square', () => {
      const square: [number, number][] = [
        [10, 20],
        [30, 20],
        [30, 40],
        [10, 40],
      ];
      
      const bounds = getPolygonBounds(square);
      
      expect(bounds.minX).toBe(10);
      expect(bounds.minY).toBe(20);
      expect(bounds.maxX).toBe(30);
      expect(bounds.maxY).toBe(40);
    });

    it('should handle empty polygon', () => {
      const bounds = getPolygonBounds([]);
      
      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const polygon: [number, number][] = [
        [-10, -20],
        [10, -20],
        [10, 20],
        [-10, 20],
      ];
      
      const bounds = getPolygonBounds(polygon);
      
      expect(bounds.minX).toBe(-10);
      expect(bounds.minY).toBe(-20);
      expect(bounds.maxX).toBe(10);
      expect(bounds.maxY).toBe(20);
    });
  });

  describe('boundingBoxesOverlap', () => {
    it('should detect overlapping boxes', () => {
      const box1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const box2 = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
      
      expect(boundingBoxesOverlap(box1, box2)).toBe(true);
    });

    it('should detect non-overlapping boxes', () => {
      const box1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const box2 = { minX: 20, minY: 20, maxX: 30, maxY: 30 };
      
      expect(boundingBoxesOverlap(box1, box2)).toBe(false);
    });

    it('should detect touching boxes as overlapping', () => {
      const box1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const box2 = { minX: 10, minY: 0, maxX: 20, maxY: 10 };
      
      // Touching at edge should NOT overlap
      expect(boundingBoxesOverlap(box1, box2)).toBe(false);
    });
  });
});

describe('Contour Conversion Functions', () => {
  /**
   * @verifies REQ-CONTOUR-005
   * Conversion between RT structure format and polygon format must preserve data
   */
  describe('contourToPolygon', () => {
    it('should convert 3D contour points to 2D polygon', () => {
      // RT structure format: [x1, y1, z1, x2, y2, z2, ...]
      const contourPoints = [0, 0, 100, 10, 0, 100, 10, 10, 100, 0, 10, 100];
      
      const polygon = contourToPolygon(contourPoints);
      
      expect(polygon.length).toBe(4);
      expect(polygon[0]).toEqual([0, 0]);
      expect(polygon[1]).toEqual([10, 0]);
      expect(polygon[2]).toEqual([10, 10]);
      expect(polygon[3]).toEqual([0, 10]);
    });

    it('should handle empty contour', () => {
      const polygon = contourToPolygon([]);
      expect(polygon.length).toBe(0);
    });
  });

  describe('polygonToContour', () => {
    it('should convert 2D polygon to 3D contour points', () => {
      const polygon: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      const z = 50.5;
      
      const contour = polygonToContour(polygon, z);
      
      expect(contour.length).toBe(12); // 4 points * 3 coords
      expect(contour[0]).toBe(0);  // x1
      expect(contour[1]).toBe(0);  // y1
      expect(contour[2]).toBe(50.5); // z1
      expect(contour[3]).toBe(10); // x2
    });

    it('should preserve round-trip conversion', () => {
      const originalContour = [1.5, 2.5, 100, 3.5, 4.5, 100, 5.5, 6.5, 100];
      
      const polygon = contourToPolygon(originalContour);
      const reconstructed = polygonToContour(polygon, 100);
      
      expect(reconstructed).toEqual(originalContour);
    });
  });
});

describe('Line Intersection', () => {
  /**
   * @verifies REQ-CONTOUR-006
   * Line intersection used in contour editing and clipping operations
   */
  describe('findLineIntersection', () => {
    it('should find intersection of crossing lines', () => {
      const p1: [number, number] = [0, 0];
      const p2: [number, number] = [10, 10];
      const p3: [number, number] = [0, 10];
      const p4: [number, number] = [10, 0];
      
      const intersection = findLineIntersection(p1, p2, p3, p4);
      
      expect(intersection).not.toBeNull();
      expect(intersection![0]).toBeCloseTo(5, 10);
      expect(intersection![1]).toBeCloseTo(5, 10);
    });

    it('should return null for parallel lines', () => {
      const p1: [number, number] = [0, 0];
      const p2: [number, number] = [10, 0];
      const p3: [number, number] = [0, 5];
      const p4: [number, number] = [10, 5];
      
      const intersection = findLineIntersection(p1, p2, p3, p4);
      
      expect(intersection).toBeNull();
    });

    it('should return null for non-intersecting segments', () => {
      const p1: [number, number] = [0, 0];
      const p2: [number, number] = [1, 1];
      const p3: [number, number] = [5, 5];
      const p4: [number, number] = [6, 6];
      
      const intersection = findLineIntersection(p1, p2, p3, p4);
      
      expect(intersection).toBeNull();
    });
  });
});

describe('Polygon Simplification', () => {
  /**
   * @verifies REQ-CONTOUR-007
   * Simplification reduces data while preserving shape accuracy
   */
  describe('simplifyPolygon', () => {
    it('should simplify a polygon with collinear points', () => {
      // A line with intermediate points
      const polygon: [number, number][] = [
        [0, 0],
        [2, 2],
        [4, 4],
        [6, 6],
        [8, 8],
      ];
      
      const simplified = simplifyPolygon(polygon, 0.1);
      
      // Should reduce to just endpoints
      expect(simplified.length).toBe(2);
      expect(simplified[0]).toEqual([0, 0]);
      expect(simplified[simplified.length - 1]).toEqual([8, 8]);
    });

    it('should preserve significant points', () => {
      // Square should not be simplified
      const square: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      
      const simplified = simplifyPolygon(square, 0.1);
      
      // Should preserve all corners
      expect(simplified.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle empty and minimal polygons', () => {
      expect(simplifyPolygon([], 1)).toEqual([]);
      expect(simplifyPolygon([[0, 0]], 1)).toEqual([[0, 0]]);
      expect(simplifyPolygon([[0, 0], [1, 1]], 1)).toEqual([[0, 0], [1, 1]]);
    });
  });
});
