/**
 * RT Plan TypeScript Types
 * 
 * Types for RT Plan beam data, BEV projections, and visualization
 * Based on ClearCheck RT Plan visualization specification
 */

/**
 * Wedge information
 */
export interface BeamWedge {
  wedgeNumber: number;
  wedgeType: 'STANDARD' | 'DYNAMIC' | 'MOTORIZED';
  wedgeID?: string;
  wedgeAngle: number; // Typically 15, 30, 45, or 60 degrees
  wedgeOrientation: number; // Direction in degrees (0, 90, 180, 270)
  sourceToWedgeTrayDistance?: number;
  wedgeFactor?: number;
}

/**
 * Block information (aperture or shielding)
 */
export interface BeamBlock {
  blockNumber: number;
  blockType: 'APERTURE' | 'SHIELDING';
  blockName?: string;
  blockTrayID?: string;
  materialID?: string;
  blockThickness?: number;
  blockTransmission?: number;
  sourceToBlockTrayDistance?: number;
  blockData: Array<{ x: number; y: number }>;
}

/**
 * Applicator information (electron cones, etc.)
 */
export interface BeamApplicator {
  applicatorID: string;
  applicatorType: 'ELECTRON_SQUARE' | 'ELECTRON_RECT' | 'ELECTRON_CIRCULAR' | 'SRS_CONE' | 'CUSTOM';
  applicatorDescription?: string;
  apertureShape?: 'CIRCULAR' | 'RECTANGULAR' | 'CUSTOM';
  apertureDimension?: { x: number; y: number } | number;
}

export interface RTPlanMetadata {
  seriesId: number;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  planLabel: string;
  planName: string;
  planDate?: string;
  planTime?: string;
  planDescription?: string;
  planGeometry?: string;
  treatmentMachineName?: string;
  numberOfBeams: number;
  numberOfFractions?: number;
  prescribedDose?: number;
  referencedStructureSetUID?: string;
  referencedDoseUID?: string;
}

export interface BeamLimitingDevice {
  type: 'MLCX' | 'MLCY' | 'ASYMX' | 'ASYMY' | 'X' | 'Y';
  numberOfLeafJawPairs: number;
  leafPositionBoundaries?: number[];
}

export interface ControlPoint {
  controlPointIndex: number;
  nominalBeamEnergy?: number;
  gantryAngle: number;
  gantryRotationDirection?: 'CW' | 'CC' | 'NONE';
  beamLimitingDeviceAngle?: number;
  patientSupportAngle?: number;
  tableTopVerticalPosition?: number;
  tableTopLongitudinalPosition?: number;
  tableTopLateralPosition?: number;
  isocenterPosition: [number, number, number];
  sourceToSurfaceDistance?: number;
  cumulativeMetersetWeight?: number;
  jawPositions?: {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  };
  mlcPositions?: {
    leafPairCount: number;
    leafPositionsA: number[];
    leafPositionsB: number[];
  };
}

export interface RTBeam {
  beamNumber: number;
  beamName: string;
  beamDescription?: string;
  beamType: 'STATIC' | 'DYNAMIC';
  radiationType: 'PHOTON' | 'ELECTRON' | 'PROTON' | 'NEUTRON' | 'ION';
  treatmentMachineName?: string;
  manufacturer?: string;
  institutionName?: string;
  primaryDosimeterUnit?: string;
  sourceAxisDistance: number;
  numberOfControlPoints: number;
  controlPoints: ControlPoint[];
  beamLimitingDevices: BeamLimitingDevice[];
  numberOfWedges?: number;
  numberOfCompensators?: number;
  numberOfBoli?: number;
  numberOfBlocks?: number;
  // Detailed wedge/block/applicator data
  wedges?: BeamWedge[];
  blocks?: BeamBlock[];
  applicator?: BeamApplicator;
  // Summary values
  gantryAngle: number;
  collimatorAngle: number;
  couchAngle: number;
  isocenterPosition: [number, number, number];
  fieldSizeX?: number;
  fieldSizeY?: number;
}

export interface BeamSummary {
  beamNumber: number;
  beamName: string;
  beamType: 'STATIC' | 'DYNAMIC';
  radiationType: string;
  gantryAngle: number;
  collimatorAngle: number;
  couchAngle: number;
  isocenterPosition: [number, number, number];
  fieldSizeX?: number;
  fieldSizeY?: number;
  sourceAxisDistance: number;
  numberOfControlPoints: number;
  nominalEnergy?: number;
  treatmentMachineName?: string;
}

export interface BEVProjection {
  beamNumber: number;
  beamName: string;
  gantryAngle: number;
  collimatorAngle: number;
  couchAngle: number;
  isocenterPosition: [number, number, number];
  sourceAxisDistance: number;
  aperturePolygon: { x: number; y: number }[];
  jawAperture: {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  };
  mlcAperture?: {
    leafPairCount: number;
    leafWidth: number; // Average leaf width
    leaves: { y: number; width: number; x1: number; x2: number }[];
  };
  beamDirectionVector: [number, number, number];
  sourcePosition: [number, number, number];
  // Wedge visualization data
  wedges?: Array<{
    wedgeAngle: number;
    wedgeOrientation: number; // 0, 90, 180, or 270 degrees
    wedgeType: string;
  }>;
  // Block visualization data
  blocks?: Array<{
    blockType: 'APERTURE' | 'SHIELDING';
    contour: { x: number; y: number }[];
  }>;
  // Applicator visualization
  applicator?: {
    type: string;
    shape?: 'CIRCULAR' | 'RECTANGULAR' | 'CUSTOM';
    dimension?: { x: number; y: number } | number;
  };
}

export interface RTPlanSummary {
  metadata: RTPlanMetadata;
  beams: BeamSummary[];
  bevProjections: BEVProjection[];
}

// Beam colors for visualization (cyclic)
export const BEAM_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

export function getBeamColor(beamIndex: number): string {
  return BEAM_COLORS[beamIndex % BEAM_COLORS.length];
}
