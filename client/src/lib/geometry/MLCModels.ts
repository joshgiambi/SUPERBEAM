/**
 * MLC (Multi-Leaf Collimator) Model Definitions
 * 
 * Implements accurate leaf geometry for common MLC types:
 * - Varian Millennium 120 (60 pairs, variable width 5mm/10mm)
 * - Varian HD120 (60 pairs, variable width 2.5mm/5mm)
 * - Elekta Agility (80 pairs, 5mm uniform)
 * - Elekta MLCi/MLCi2 (40 pairs, 10mm uniform)
 */

export interface MLCLeafGeometry {
  /** Leaf pair index (0-based) */
  index: number;
  /** Y position of leaf center at isocenter (mm) */
  yCenter: number;
  /** Leaf width projected at isocenter (mm) */
  width: number;
  /** Y position of leaf top edge (mm) */
  yTop: number;
  /** Y position of leaf bottom edge (mm) */
  yBottom: number;
}

export interface MLCModel {
  /** Model name */
  name: string;
  /** Manufacturer */
  manufacturer: string;
  /** Number of leaf pairs */
  leafPairCount: number;
  /** Direction of leaf travel: 'X' or 'Y' */
  leafDirection: 'X' | 'Y';
  /** Maximum leaf travel distance (mm) */
  maxLeafTravel: number;
  /** Distance from source to MLC (mm) */
  sourceToMLC: number;
  /** Leaf position boundaries (N+1 values for N leaf pairs) */
  leafPositionBoundaries: number[];
  /** Get geometry for all leaves */
  getLeafGeometries(): MLCLeafGeometry[];
  /** Get leaf index for a given Y position */
  getLeafIndexForY(y: number): number | null;
}

/**
 * Varian Millennium 120 MLC
 * 
 * 60 leaf pairs arranged symmetrically:
 * - 10 pairs at 10mm width on each end (20 total outer pairs)
 * - 40 pairs at 5mm width in center
 * 
 * Coverage: ±200mm in Y direction
 */
export class MillenniumMLC implements MLCModel {
  name = 'Millennium 120';
  manufacturer = 'Varian';
  leafPairCount = 60;
  leafDirection: 'X' = 'X';
  maxLeafTravel = 150; // mm
  sourceToMLC = 510; // mm (approximate)
  
  leafPositionBoundaries: number[];
  
  constructor() {
    // Build leaf boundaries from -200mm to +200mm
    // 10 leaves at 10mm (outer inferior)
    // 40 leaves at 5mm (center)
    // 10 leaves at 10mm (outer superior)
    
    this.leafPositionBoundaries = [];
    let y = -200;
    
    // First 10 leaves: 10mm each
    for (let i = 0; i <= 10; i++) {
      this.leafPositionBoundaries.push(y);
      y += 10;
    }
    
    // Middle 40 leaves: 5mm each (start from -100)
    for (let i = 0; i < 40; i++) {
      y += 5;
      this.leafPositionBoundaries.push(y);
    }
    
    // Last 10 leaves: 10mm each
    for (let i = 0; i < 10; i++) {
      y += 10;
      this.leafPositionBoundaries.push(y);
    }
    
    // Verify we have 61 boundaries for 60 pairs
    if (this.leafPositionBoundaries.length !== 61) {
      console.warn(`Millennium 120: Expected 61 boundaries, got ${this.leafPositionBoundaries.length}`);
    }
  }
  
  getLeafGeometries(): MLCLeafGeometry[] {
    const leaves: MLCLeafGeometry[] = [];
    
    for (let i = 0; i < this.leafPairCount; i++) {
      const yTop = this.leafPositionBoundaries[i];
      const yBottom = this.leafPositionBoundaries[i + 1];
      const width = Math.abs(yBottom - yTop);
      const yCenter = (yTop + yBottom) / 2;
      
      leaves.push({
        index: i,
        yCenter,
        width,
        yTop,
        yBottom
      });
    }
    
    return leaves;
  }
  
  getLeafIndexForY(y: number): number | null {
    for (let i = 0; i < this.leafPairCount; i++) {
      if (y >= this.leafPositionBoundaries[i] && y < this.leafPositionBoundaries[i + 1]) {
        return i;
      }
    }
    return null;
  }
}

/**
 * Varian HD120 MLC (High Definition)
 * 
 * 60 leaf pairs with narrower leaves in center:
 * - 14 pairs at 5mm width on each end (28 total outer pairs)
 * - 32 pairs at 2.5mm width in center
 * 
 * Coverage: ±220mm (10mm) + ±40mm (2.5mm) = ±110mm total
 * Actually: ±110mm coverage with varying widths
 */
export class HD120MLC implements MLCModel {
  name = 'HD120';
  manufacturer = 'Varian';
  leafPairCount = 60;
  leafDirection: 'X' = 'X';
  maxLeafTravel = 150;
  sourceToMLC = 510;
  
  leafPositionBoundaries: number[];
  
  constructor() {
    this.leafPositionBoundaries = [];
    let y = -110;
    
    // First 14 leaves: 5mm each
    for (let i = 0; i <= 14; i++) {
      this.leafPositionBoundaries.push(y);
      if (i < 14) y += 5;
    }
    
    // Middle 32 leaves: 2.5mm each
    for (let i = 0; i < 32; i++) {
      y += 2.5;
      this.leafPositionBoundaries.push(y);
    }
    
    // Last 14 leaves: 5mm each
    for (let i = 0; i < 14; i++) {
      y += 5;
      this.leafPositionBoundaries.push(y);
    }
  }
  
  getLeafGeometries(): MLCLeafGeometry[] {
    const leaves: MLCLeafGeometry[] = [];
    
    for (let i = 0; i < this.leafPairCount; i++) {
      const yTop = this.leafPositionBoundaries[i];
      const yBottom = this.leafPositionBoundaries[i + 1];
      const width = Math.abs(yBottom - yTop);
      const yCenter = (yTop + yBottom) / 2;
      
      leaves.push({
        index: i,
        yCenter,
        width,
        yTop,
        yBottom
      });
    }
    
    return leaves;
  }
  
  getLeafIndexForY(y: number): number | null {
    for (let i = 0; i < this.leafPairCount; i++) {
      if (y >= this.leafPositionBoundaries[i] && y < this.leafPositionBoundaries[i + 1]) {
        return i;
      }
    }
    return null;
  }
}

/**
 * Elekta Agility MLC
 * 
 * 80 leaf pairs, all 5mm width
 * Coverage: ±200mm
 */
export class AgilityMLC implements MLCModel {
  name = 'Agility';
  manufacturer = 'Elekta';
  leafPairCount = 80;
  leafDirection: 'X' = 'X';
  maxLeafTravel = 150;
  sourceToMLC = 352; // mm
  
  leafPositionBoundaries: number[];
  
  constructor() {
    this.leafPositionBoundaries = [];
    for (let i = 0; i <= 80; i++) {
      this.leafPositionBoundaries.push(-200 + i * 5);
    }
  }
  
  getLeafGeometries(): MLCLeafGeometry[] {
    const leaves: MLCLeafGeometry[] = [];
    
    for (let i = 0; i < this.leafPairCount; i++) {
      const yTop = this.leafPositionBoundaries[i];
      const yBottom = this.leafPositionBoundaries[i + 1];
      
      leaves.push({
        index: i,
        yCenter: (yTop + yBottom) / 2,
        width: 5,
        yTop,
        yBottom
      });
    }
    
    return leaves;
  }
  
  getLeafIndexForY(y: number): number | null {
    if (y < -200 || y >= 200) return null;
    return Math.floor((y + 200) / 5);
  }
}

/**
 * Elekta MLCi/MLCi2
 * 
 * 40 leaf pairs, all 10mm width
 * Coverage: ±200mm
 */
export class MLCiMLC implements MLCModel {
  name = 'MLCi';
  manufacturer = 'Elekta';
  leafPairCount = 40;
  leafDirection: 'X' = 'X';
  maxLeafTravel = 125;
  sourceToMLC = 350;
  
  leafPositionBoundaries: number[];
  
  constructor() {
    this.leafPositionBoundaries = [];
    for (let i = 0; i <= 40; i++) {
      this.leafPositionBoundaries.push(-200 + i * 10);
    }
  }
  
  getLeafGeometries(): MLCLeafGeometry[] {
    const leaves: MLCLeafGeometry[] = [];
    
    for (let i = 0; i < this.leafPairCount; i++) {
      const yTop = this.leafPositionBoundaries[i];
      const yBottom = this.leafPositionBoundaries[i + 1];
      
      leaves.push({
        index: i,
        yCenter: (yTop + yBottom) / 2,
        width: 10,
        yTop,
        yBottom
      });
    }
    
    return leaves;
  }
  
  getLeafIndexForY(y: number): number | null {
    if (y < -200 || y >= 200) return null;
    return Math.floor((y + 200) / 10);
  }
}

/**
 * Generic MLC model for when we only have leaf boundaries from DICOM
 */
export class GenericMLC implements MLCModel {
  name = 'Generic';
  manufacturer = 'Unknown';
  leafPairCount: number;
  leafDirection: 'X' | 'Y' = 'X';
  maxLeafTravel = 150;
  sourceToMLC = 500;
  
  leafPositionBoundaries: number[];
  
  constructor(boundaries: number[], direction: 'X' | 'Y' = 'X') {
    this.leafPositionBoundaries = boundaries;
    this.leafPairCount = boundaries.length - 1;
    this.leafDirection = direction;
  }
  
  getLeafGeometries(): MLCLeafGeometry[] {
    const leaves: MLCLeafGeometry[] = [];
    
    for (let i = 0; i < this.leafPairCount; i++) {
      const yTop = this.leafPositionBoundaries[i];
      const yBottom = this.leafPositionBoundaries[i + 1];
      const width = Math.abs(yBottom - yTop);
      const yCenter = (yTop + yBottom) / 2;
      
      leaves.push({
        index: i,
        yCenter,
        width,
        yTop,
        yBottom
      });
    }
    
    return leaves;
  }
  
  getLeafIndexForY(y: number): number | null {
    for (let i = 0; i < this.leafPairCount; i++) {
      if (y >= this.leafPositionBoundaries[i] && y < this.leafPositionBoundaries[i + 1]) {
        return i;
      }
    }
    return null;
  }
}

/**
 * Detect MLC model from DICOM metadata
 * 
 * @param leafPairCount Number of leaf pairs
 * @param leafBoundaries Leaf position boundaries from DICOM
 * @param manufacturerName Optional manufacturer name from DICOM
 * @returns Appropriate MLC model instance
 */
export function detectMLCModel(
  leafPairCount: number,
  leafBoundaries?: number[],
  manufacturerName?: string
): MLCModel {
  // If we have boundaries, create a generic model with actual data
  if (leafBoundaries && leafBoundaries.length >= 2) {
    return new GenericMLC(leafBoundaries);
  }
  
  // Try to detect based on leaf count and manufacturer
  const mfr = (manufacturerName || '').toLowerCase();
  
  if (mfr.includes('varian')) {
    if (leafPairCount === 60) {
      // Check if it's HD120 or Millennium
      // HD120 has narrower central leaves (2.5mm)
      // Without boundaries, assume Millennium as it's more common
      return new MillenniumMLC();
    }
  }
  
  if (mfr.includes('elekta')) {
    if (leafPairCount === 80) {
      return new AgilityMLC();
    }
    if (leafPairCount === 40) {
      return new MLCiMLC();
    }
  }
  
  // Default based on leaf count
  switch (leafPairCount) {
    case 60:
      return new MillenniumMLC();
    case 80:
      return new AgilityMLC();
    case 40:
      return new MLCiMLC();
    default:
      // Create uniform 5mm leaves
      const boundaries: number[] = [];
      const totalWidth = leafPairCount * 5;
      for (let i = 0; i <= leafPairCount; i++) {
        boundaries.push(-totalWidth / 2 + i * 5);
      }
      return new GenericMLC(boundaries);
  }
}

/**
 * Calculate MLC aperture opening at each leaf position
 * 
 * @param leafPositionsA Bank A (X1) leaf positions
 * @param leafPositionsB Bank B (X2) leaf positions
 * @param mlcModel MLC model for geometry
 * @param jawAperture Jaw positions to clip against
 * @returns Array of leaf openings with coordinates
 */
export interface MLCApertureLeaf {
  index: number;
  yCenter: number;
  yTop: number;
  yBottom: number;
  width: number;
  x1: number; // Bank A position (typically negative/left)
  x2: number; // Bank B position (typically positive/right)
  opening: number; // Gap between leaves (x2 - x1)
  isClosed: boolean; // Opening < threshold (e.g., 1mm)
}

export function calculateMLCAperture(
  leafPositionsA: number[],
  leafPositionsB: number[],
  mlcModel: MLCModel,
  jawAperture?: { x1: number; x2: number; y1: number; y2: number }
): MLCApertureLeaf[] {
  const geometries = mlcModel.getLeafGeometries();
  const result: MLCApertureLeaf[] = [];
  
  for (let i = 0; i < geometries.length; i++) {
    const geo = geometries[i];
    
    // Skip leaves outside jaw aperture
    if (jawAperture) {
      if (geo.yBottom < jawAperture.y1 || geo.yTop > jawAperture.y2) {
        continue;
      }
    }
    
    const x1 = leafPositionsA[i] ?? 0;
    const x2 = leafPositionsB[i] ?? 0;
    const opening = x2 - x1;
    
    result.push({
      index: i,
      yCenter: geo.yCenter,
      yTop: geo.yTop,
      yBottom: geo.yBottom,
      width: geo.width,
      x1,
      x2,
      opening,
      isClosed: opening < 1 // Less than 1mm is considered closed
    });
  }
  
  return result;
}
