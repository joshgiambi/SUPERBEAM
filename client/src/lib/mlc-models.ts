/**
 * MLC Model Definitions
 * 
 * Defines multi-leaf collimator configurations for different treatment machines.
 * Based on ClearCheck RT Plan visualization specification.
 * 
 * Each MLC model contains:
 * - Leaf widths at isocenter plane (mm)
 * - Y position boundaries for each leaf pair
 * - Maximum leaf travel distance
 * - Machine-specific characteristics
 */

export interface LeafGeometry {
  /** Y position of leaf center at isocenter plane (mm) */
  y: number;
  /** Width of the leaf at isocenter plane (mm) */
  width: number;
  /** Index of the leaf pair (0-based) */
  index: number;
}

export interface MLCModel {
  /** Model identifier/name */
  name: string;
  /** Manufacturer name */
  manufacturer: string;
  /** Number of leaf pairs */
  numberOfLeafPairs: number;
  /** Array of leaf widths at isocenter (mm), from superior to inferior */
  leafWidths: number[];
  /** Y position of the first (superior) leaf boundary */
  startY: number;
  /** Maximum leaf travel from centerline (mm) */
  maxLeafSpan: number;
  /** Total MLC span in Y direction (mm) */
  totalSpanY: number;
  /** Whether this MLC has an X jaw (some MLCs like Agility don't) */
  hasXJaws: boolean;
  /** Whether this is a dual-layer MLC (like Halcyon) */
  isDualLayer: boolean;
  /** Description of the MLC */
  description: string;
}

/**
 * Varian Millennium 120 MLC
 * 
 * 60 leaf pairs total:
 * - Central 40 pairs: 5mm width
 * - Outer 10 pairs on each side: 10mm width
 * Total span: 400mm
 */
export const Millennium120: MLCModel = {
  name: 'Millennium120',
  manufacturer: 'Varian',
  numberOfLeafPairs: 60,
  leafWidths: [
    // Superior 10 pairs: 10mm each
    ...Array(10).fill(10),
    // Central 40 pairs: 5mm each
    ...Array(40).fill(5),
    // Inferior 10 pairs: 10mm each
    ...Array(10).fill(10),
  ],
  startY: 200, // Superior boundary
  maxLeafSpan: 160, // mm from centerline
  totalSpanY: 400,
  hasXJaws: true,
  isDualLayer: false,
  description: 'Varian Millennium 120 leaf MLC with mixed 5/10mm leaf widths',
};

/**
 * Varian Millennium 120 HD (High Definition)
 * 
 * 60 leaf pairs total:
 * - Central 32 pairs: 2.5mm width
 * - Outer 14 pairs on each side: 5mm width
 * Total central region: 80mm
 */
export const Millennium120HD: MLCModel = {
  name: 'Millennium120HD',
  manufacturer: 'Varian',
  numberOfLeafPairs: 60,
  leafWidths: [
    // Superior 14 pairs: 5mm each
    ...Array(14).fill(5),
    // Central 32 pairs: 2.5mm each (HD region)
    ...Array(32).fill(2.5),
    // Inferior 14 pairs: 5mm each
    ...Array(14).fill(5),
  ],
  startY: 110, // Superior boundary
  maxLeafSpan: 150,
  totalSpanY: 220,
  hasXJaws: true,
  isDualLayer: false,
  description: 'Varian High-Definition 120 leaf MLC with 2.5mm central leaves',
};

/**
 * Elekta Agility MLC
 * 
 * 80 leaf pairs, all 5mm width
 * No X-jaws - MLC acts as primary collimator
 * Total span: 400mm
 */
export const Agility: MLCModel = {
  name: 'Agility',
  manufacturer: 'Elekta',
  numberOfLeafPairs: 80,
  leafWidths: Array(80).fill(5),
  startY: 200,
  maxLeafSpan: 200,
  totalSpanY: 400,
  hasXJaws: false, // Agility uses MLC as primary collimator
  isDualLayer: false,
  description: 'Elekta Agility 160 leaf MLC (80 pairs), 5mm uniform leaf width',
};

/**
 * Varian Halcyon SX2 Dual-Layer MLC
 * 
 * Two staggered MLC layers for improved penumbra
 * 29 leaf pairs per layer (proximal and distal)
 * Effective resolution better than physical leaf width
 */
export const HalcyonSX2: MLCModel = {
  name: 'SX2',
  manufacturer: 'Varian',
  numberOfLeafPairs: 29,
  leafWidths: Array(29).fill(10),
  startY: 140,
  maxLeafSpan: 280,
  totalSpanY: 280,
  hasXJaws: false, // Uses dual-layer MLC for collimation
  isDualLayer: true,
  description: 'Varian Halcyon dual-layer stacked MLC',
};

/**
 * Elekta Unity MR-Linac MLC
 * 
 * 80 leaf pairs, 7.175mm width
 * MLC oriented perpendicular to conventional
 */
export const Unity: MLCModel = {
  name: 'Unity',
  manufacturer: 'Elekta',
  numberOfLeafPairs: 80,
  leafWidths: Array(80).fill(7.175),
  startY: 286,
  maxLeafSpan: 240,
  totalSpanY: 574,
  hasXJaws: true,
  isDualLayer: false,
  description: 'Elekta Unity MR-Linac MLC with 7.175mm leaves',
};

/**
 * Standard Varian 40 leaf pair MLC (older models)
 */
export const Standard40: MLCModel = {
  name: 'Standard40',
  manufacturer: 'Varian',
  numberOfLeafPairs: 40,
  leafWidths: Array(40).fill(10),
  startY: 200,
  maxLeafSpan: 160,
  totalSpanY: 400,
  hasXJaws: true,
  isDualLayer: false,
  description: 'Standard 40 leaf pair MLC with 10mm uniform leaves',
};

// Map of all available MLC models
export const MLC_MODELS: Record<string, MLCModel> = {
  'NDS120': Millennium120,
  'MILLENNIUM120': Millennium120,
  'Millennium120': Millennium120,
  'NDS120HD': Millennium120HD,
  'MILLENNIUM120HD': Millennium120HD,
  'Millennium120HD': Millennium120HD,
  'AGILITY': Agility,
  'Agility': Agility,
  'SX2': HalcyonSX2,
  'Halcyon': HalcyonSX2,
  'HALCYON': HalcyonSX2,
  'UNITY': Unity,
  'Unity': Unity,
  'NDS40': Standard40,
  'Standard40': Standard40,
};

/**
 * Get MLC model by name/identifier
 * Returns a default model if not found
 */
export function getMLCModel(modelName: string | undefined): MLCModel | null {
  if (!modelName) return null;
  
  // Try direct lookup
  const model = MLC_MODELS[modelName.toUpperCase()];
  if (model) return model;
  
  // Try partial match
  const upperName = modelName.toUpperCase();
  for (const [key, value] of Object.entries(MLC_MODELS)) {
    if (upperName.includes(key.toUpperCase()) || key.toUpperCase().includes(upperName)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Infer MLC model from leaf count and boundaries
 */
export function inferMLCModel(
  leafCount: number,
  leafBoundaries?: number[]
): MLCModel | null {
  // Try to infer from leaf count
  if (leafCount === 60) {
    // Check if HD based on boundaries
    if (leafBoundaries && leafBoundaries.length > 1) {
      const firstGap = Math.abs(leafBoundaries[1] - leafBoundaries[0]);
      if (firstGap <= 3) {
        return Millennium120HD; // 2.5mm leaves
      }
    }
    return Millennium120;
  }
  
  if (leafCount === 80) {
    // Could be Agility or Unity - check boundaries
    if (leafBoundaries && leafBoundaries.length > 1) {
      const avgWidth = Math.abs(leafBoundaries[leafBoundaries.length - 1] - leafBoundaries[0]) / leafCount;
      if (avgWidth > 6) {
        return Unity; // 7.175mm leaves
      }
    }
    return Agility;
  }
  
  if (leafCount === 29) {
    return HalcyonSX2;
  }
  
  if (leafCount === 40) {
    return Standard40;
  }
  
  return null;
}

/**
 * Calculate leaf geometry (Y positions and widths) from MLC model
 */
export function calculateLeafGeometry(model: MLCModel): LeafGeometry[] {
  const leaves: LeafGeometry[] = [];
  let currentY = model.startY;
  
  for (let i = 0; i < model.numberOfLeafPairs; i++) {
    const width = model.leafWidths[i];
    currentY -= width / 2; // Move to center of leaf
    
    leaves.push({
      y: currentY,
      width: width,
      index: i,
    });
    
    currentY -= width / 2; // Move to bottom edge of leaf
  }
  
  return leaves;
}

/**
 * Calculate leaf geometry from DICOM leaf position boundaries
 * This uses the actual boundaries from the DICOM file rather than model assumptions
 */
export function calculateLeafGeometryFromBoundaries(
  boundaries: number[]
): LeafGeometry[] {
  const leaves: LeafGeometry[] = [];
  
  for (let i = 0; i < boundaries.length - 1; i++) {
    const y1 = boundaries[i];
    const y2 = boundaries[i + 1];
    const width = Math.abs(y2 - y1);
    const center = (y1 + y2) / 2;
    
    leaves.push({
      y: center,
      width: width,
      index: i,
    });
  }
  
  return leaves;
}

/**
 * Get the maximum open field for a given MLC model based on leaf positions
 */
export function getMLCOpenField(
  model: MLCModel,
  leafPositionsA: number[],
  leafPositionsB: number[]
): { minX: number; maxX: number; minY: number; maxY: number } {
  const geometry = calculateLeafGeometry(model);
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  
  for (let i = 0; i < geometry.length; i++) {
    const posA = leafPositionsA[i] ?? 0;
    const posB = leafPositionsB[i] ?? 0;
    
    // If leaves are open (not fully retracted/closed)
    if (posB > posA) {
      const leaf = geometry[i];
      const leafTop = leaf.y + leaf.width / 2;
      const leafBottom = leaf.y - leaf.width / 2;
      
      minX = Math.min(minX, posA);
      maxX = Math.max(maxX, posB);
      minY = Math.min(minY, leafBottom);
      maxY = Math.max(maxY, leafTop);
    }
  }
  
  return { minX, maxX, minY, maxY };
}

export default {
  Millennium120,
  Millennium120HD,
  Agility,
  HalcyonSX2,
  Unity,
  Standard40,
  getMLCModel,
  inferMLCModel,
  calculateLeafGeometry,
  calculateLeafGeometryFromBoundaries,
  getMLCOpenField,
};
