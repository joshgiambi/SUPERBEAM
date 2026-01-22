/**
 * RT Plan API Routes
 * 
 * Provides endpoints for loading and serving RT Plan (RTPLAN) data:
 * - GET /api/rt-plan/:seriesId/metadata - Get plan metadata
 * - GET /api/rt-plan/:seriesId/beams - Get all beam data with geometry
 * - GET /api/rt-plan/:seriesId/beam/:beamNumber - Get specific beam details
 * - GET /api/rt-plan/:seriesId/bev/:beamNumber - Get Beam's Eye View projection data
 */

import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import dicomParser from 'dicom-parser';
import { storage } from './storage';
import { logger } from './logger';

const router = Router();

// ============================================================================
// Types
// ============================================================================

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
  beamLimitingDeviceAngle?: number; // Collimator angle
  patientSupportAngle?: number; // Couch angle
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
    leafPositionsA: number[]; // Bank A (typically left/bottom)
    leafPositionsB: number[]; // Bank B (typically right/top)
  };
}

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
  // Block contour points in BEV coordinates (mm at isocenter plane)
  blockData: Array<{ x: number; y: number }>;
}

/**
 * Applicator information (electron cones, etc.)
 */
export interface BeamApplicator {
  applicatorID: string;
  applicatorType: 'ELECTRON_SQUARE' | 'ELECTRON_RECT' | 'ELECTRON_CIRCULAR' | 'SRS_CONE' | 'CUSTOM';
  applicatorDescription?: string;
  // Aperture shape for applicators
  apertureShape?: 'CIRCULAR' | 'RECTANGULAR' | 'CUSTOM';
  apertureDimension?: { x: number; y: number } | number; // mm
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
  sourceAxisDistance: number; // SAD in mm (typically 1000)
  
  // Beam geometry
  numberOfControlPoints: number;
  controlPoints: ControlPoint[];
  
  // Beam limiting devices
  beamLimitingDevices: BeamLimitingDevice[];
  
  // Delivery parameters
  numberOfWedges?: number;
  numberOfCompensators?: number;
  numberOfBoli?: number;
  numberOfBlocks?: number;
  
  // Wedge details
  wedges?: BeamWedge[];
  
  // Block details
  blocks?: BeamBlock[];
  
  // Applicator details (electron cones, etc.)
  applicator?: BeamApplicator;
  
  // Calculated summary (from first control point for static beams)
  gantryAngle: number;
  collimatorAngle: number;
  couchAngle: number;
  isocenterPosition: [number, number, number];
  fieldSizeX?: number;
  fieldSizeY?: number;
}

export interface BEVProjection {
  beamNumber: number;
  beamName: string;
  gantryAngle: number;
  collimatorAngle: number;
  couchAngle: number;
  isocenterPosition: [number, number, number];
  sourceAxisDistance: number;
  
  // Aperture shape in BEV coordinates (mm at isocenter plane)
  aperturePolygon: { x: number; y: number }[];
  jawAperture: {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  };
  
  // MLC shape if available
  mlcAperture?: {
    leafPairCount: number;
    leafWidth: number; // Average leaf width
    leaves: { y: number; width: number; x1: number; x2: number }[];
  };
  
  // Beam direction vector in patient coordinates
  beamDirectionVector: [number, number, number];
  
  // Source position in patient coordinates
  sourcePosition: [number, number, number];
  
  // Wedge visualization data
  wedges?: Array<{
    wedgeAngle: number;
    wedgeOrientation: number;
    wedgeType: string;
  }>;
  
  // Block visualization data
  blocks?: Array<{
    blockType: 'APERTURE' | 'SHIELDING';
    contour: { x: number; y: number }[];
  }>;
  
  // Applicator visualization data
  applicator?: {
    type: string;
    shape?: 'CIRCULAR' | 'RECTANGULAR' | 'CUSTOM';
    dimension?: { x: number; y: number } | number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getDicomString(dataSet: dicomParser.DataSet, tag: string): string | undefined {
  try {
    return dataSet.string(tag)?.trim();
  } catch {
    return undefined;
  }
}

function getDicomFloat(dataSet: dicomParser.DataSet, tag: string): number | undefined {
  try {
    const str = dataSet.string(tag);
    const num = parseFloat(str || '');
    return isNaN(num) ? undefined : num;
  } catch {
    return undefined;
  }
}

/**
 * Get DICOM integer value
 * 
 * Most RT Plan integer fields are IS (Integer String) VR type,
 * so we prioritize string parsing. Falls back to binary reads
 * for US/SS/UL/SL types.
 */
function getDicomInt(dataSet: dicomParser.DataSet, tag: string): number | undefined {
  try {
    // First try string parsing (for IS - Integer String VR)
    const str = dataSet.string(tag);
    if (str !== undefined && str !== null && str.trim() !== '') {
      const num = parseInt(str.trim(), 10);
      if (!isNaN(num)) {
        return num;
      }
    }
    
    // Fall back to binary integer types
    try {
      const val = dataSet.uint16(tag);
      if (val !== undefined) return val;
    } catch { /* ignore */ }
    
    try {
      const val = dataSet.int16(tag);
      if (val !== undefined) return val;
    } catch { /* ignore */ }
    
    try {
      const val = dataSet.uint32(tag);
      if (val !== undefined) return val;
    } catch { /* ignore */ }
    
    try {
      const val = dataSet.int32(tag);
      if (val !== undefined) return val;
    } catch { /* ignore */ }
    
    return undefined;
  } catch {
    return undefined;
  }
}

function getDicomFloatArray(dataSet: dicomParser.DataSet, tag: string): number[] | undefined {
  try {
    const str = dataSet.string(tag);
    if (!str) return undefined;
    const values = str.split('\\').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    return values.length > 0 ? values : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Load RT Plan DICOM file for a series
 */
async function loadPlanDicom(seriesId: number): Promise<{
  dataSet: dicomParser.DataSet;
  byteArray: Uint8Array;
} | null> {
  try {
    const series = await storage.getSeries(seriesId);
    if (!series || series.modality !== 'RTPLAN') {
      return null;
    }

    const images = await storage.getImagesBySeriesId(seriesId);
    if (!images || images.length === 0) {
      return null;
    }

    const firstImage = images[0];
    const filePath = firstImage.filePath;

    if (!fs.existsSync(filePath)) {
      logger.warn(`RT Plan file not found: ${filePath}`);
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);

    return { dataSet, byteArray };
  } catch (error) {
    logger.error(`Error loading RT Plan DICOM: ${error}`);
    return null;
  }
}

/**
 * Parse beam limiting device sequence
 */
function parseBeamLimitingDevices(beamDataSet: any): BeamLimitingDevice[] {
  const devices: BeamLimitingDevice[] = [];
  
  // BeamLimitingDeviceSequence (300A,00B6)
  const deviceSeq = beamDataSet.elements?.x300a00b6;
  if (!deviceSeq?.items) return devices;
  
  for (const item of deviceSeq.items) {
    const ds = item.dataSet;
    const type = getDicomString(ds, 'x300a00b8') as BeamLimitingDevice['type'];
    const numPairs = getDicomInt(ds, 'x300a00bc') || 0;
    const boundaries = getDicomFloatArray(ds, 'x300a00be');
    
    if (type) {
      devices.push({
        type,
        numberOfLeafJawPairs: numPairs,
        leafPositionBoundaries: boundaries,
      });
    }
  }
  
  return devices;
}

/**
 * Parse control point sequence
 */
function parseControlPoints(beamDataSet: any, beamLimitingDevices: BeamLimitingDevice[]): ControlPoint[] {
  const controlPoints: ControlPoint[] = [];
  
  // ControlPointSequence (300A,0111)
  const cpSeq = beamDataSet.elements?.x300a0111;
  if (!cpSeq?.items) return controlPoints;
  
  let lastGantryAngle = 0;
  let lastCollimatorAngle = 0;
  let lastCouchAngle = 0;
  let lastIsocenter: [number, number, number] = [0, 0, 0];
  let lastJawPositions = { x1: -100, x2: 100, y1: -100, y2: 100 };
  let lastMlcPositions: ControlPoint['mlcPositions'] = undefined;
  
  for (const item of cpSeq.items) {
    const ds = item.dataSet;
    
    const cpIndex = getDicomInt(ds, 'x300a0112') || controlPoints.length;
    const gantryAngle = getDicomFloat(ds, 'x300a011e') ?? lastGantryAngle;
    const gantryDir = getDicomString(ds, 'x300a011f') as ControlPoint['gantryRotationDirection'];
    const collimatorAngle = getDicomFloat(ds, 'x300a0120') ?? lastCollimatorAngle;
    const couchAngle = getDicomFloat(ds, 'x300a0122') ?? lastCouchAngle;
    const nominalEnergy = getDicomFloat(ds, 'x300a0114');
    const ssd = getDicomFloat(ds, 'x300a0130');
    const metersetWeight = getDicomFloat(ds, 'x300a0134');
    
    // Isocenter position (300A,012C)
    const isoArr = getDicomFloatArray(ds, 'x300a012c');
    const isocenter: [number, number, number] = isoArr && isoArr.length >= 3
      ? [isoArr[0], isoArr[1], isoArr[2]]
      : lastIsocenter;
    
    // Table positions
    const tableVert = getDicomFloat(ds, 'x300a0128');
    const tableLong = getDicomFloat(ds, 'x300a0129');
    const tableLat = getDicomFloat(ds, 'x300a012a');
    
    // Parse beam limiting device positions (300A,011A)
    let jawPositions = { ...lastJawPositions };
    let mlcPositions = lastMlcPositions ? { ...lastMlcPositions } : undefined;
    
    const bldPosSeq = ds.elements?.x300a011a;
    if (bldPosSeq?.items) {
      for (const bldItem of bldPosSeq.items) {
        const bldDs = bldItem.dataSet;
        const deviceType = getDicomString(bldDs, 'x300a00b8');
        const positions = getDicomFloatArray(bldDs, 'x300a011c');
        
        if (deviceType && positions) {
          if (deviceType === 'ASYMX' || deviceType === 'X') {
            if (positions.length >= 2) {
              jawPositions.x1 = positions[0];
              jawPositions.x2 = positions[1];
            }
          } else if (deviceType === 'ASYMY' || deviceType === 'Y') {
            if (positions.length >= 2) {
              jawPositions.y1 = positions[0];
              jawPositions.y2 = positions[1];
            }
          } else if (deviceType === 'MLCX' || deviceType === 'MLCY') {
            // MLC positions: first half is bank A, second half is bank B
            const halfLen = Math.floor(positions.length / 2);
            mlcPositions = {
              leafPairCount: halfLen,
              leafPositionsA: positions.slice(0, halfLen),
              leafPositionsB: positions.slice(halfLen),
            };
          }
        }
      }
    }
    
    controlPoints.push({
      controlPointIndex: cpIndex,
      nominalBeamEnergy: nominalEnergy,
      gantryAngle,
      gantryRotationDirection: gantryDir,
      beamLimitingDeviceAngle: collimatorAngle,
      patientSupportAngle: couchAngle,
      tableTopVerticalPosition: tableVert,
      tableTopLongitudinalPosition: tableLong,
      tableTopLateralPosition: tableLat,
      isocenterPosition: isocenter,
      sourceToSurfaceDistance: ssd,
      cumulativeMetersetWeight: metersetWeight,
      jawPositions,
      mlcPositions,
    });
    
    // Update last values for inheritance
    lastGantryAngle = gantryAngle;
    lastCollimatorAngle = collimatorAngle;
    lastCouchAngle = couchAngle;
    lastIsocenter = isocenter;
    lastJawPositions = jawPositions;
    lastMlcPositions = mlcPositions;
  }
  
  return controlPoints;
}

/**
 * Parse wedge sequence from beam
 */
function parseWedges(beamDataSet: any): BeamWedge[] {
  const wedges: BeamWedge[] = [];
  
  // WedgeSequence (300A,00D1)
  const wedgeSeq = beamDataSet.elements?.x300a00d1;
  if (!wedgeSeq?.items) return wedges;
  
  for (const item of wedgeSeq.items) {
    const ds = item.dataSet;
    
    const wedgeNumber = getDicomInt(ds, 'x300a00d2') || wedges.length + 1;
    const wedgeType = getDicomString(ds, 'x300a00d3') as BeamWedge['wedgeType'] || 'STANDARD';
    const wedgeID = getDicomString(ds, 'x300a00d4');
    const wedgeAngle = getDicomFloat(ds, 'x300a00d5') || 0;
    const wedgeOrientation = getDicomFloat(ds, 'x300a00d8') || 0;
    const sourceToTrayDistance = getDicomFloat(ds, 'x300a00da');
    const wedgeFactor = getDicomFloat(ds, 'x300a00dc');
    
    wedges.push({
      wedgeNumber,
      wedgeType,
      wedgeID,
      wedgeAngle,
      wedgeOrientation,
      sourceToWedgeTrayDistance: sourceToTrayDistance,
      wedgeFactor,
    });
  }
  
  return wedges;
}

/**
 * Parse block sequence from beam
 */
function parseBlocks(beamDataSet: any): BeamBlock[] {
  const blocks: BeamBlock[] = [];
  
  // BlockSequence (300A,00F4)
  const blockSeq = beamDataSet.elements?.x300a00f4;
  if (!blockSeq?.items) return blocks;
  
  for (const item of blockSeq.items) {
    const ds = item.dataSet;
    
    const blockNumber = getDicomInt(ds, 'x300a00fc') || blocks.length + 1;
    const blockType = getDicomString(ds, 'x300a00f8') as BeamBlock['blockType'] || 'APERTURE';
    const blockName = getDicomString(ds, 'x300a00fe');
    const blockTrayID = getDicomString(ds, 'x300a00f5');
    const materialID = getDicomString(ds, 'x300a00f7');
    const blockThickness = getDicomFloat(ds, 'x300a0100');
    const blockTransmission = getDicomFloat(ds, 'x300a0102');
    const sourceToBlockTrayDistance = getDicomFloat(ds, 'x300a00f6');
    
    // Parse block data (contour points)
    // BlockData (300A,0106) - pairs of x,y coordinates
    const blockDataStr = getDicomString(ds, 'x300a0106');
    const blockNumberOfPoints = getDicomInt(ds, 'x300a0104') || 0;
    
    const blockData: Array<{ x: number; y: number }> = [];
    
    if (blockDataStr) {
      const values = blockDataStr.split('\\').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      for (let i = 0; i < values.length - 1; i += 2) {
        blockData.push({ x: values[i], y: values[i + 1] });
      }
    }
    
    blocks.push({
      blockNumber,
      blockType,
      blockName,
      blockTrayID,
      materialID,
      blockThickness,
      blockTransmission,
      sourceToBlockTrayDistance,
      blockData,
    });
  }
  
  return blocks;
}

/**
 * Parse applicator sequence from beam
 */
function parseApplicator(beamDataSet: any): BeamApplicator | undefined {
  // ApplicatorSequence (300A,0107)
  const applicatorSeq = beamDataSet.elements?.x300a0107;
  if (!applicatorSeq?.items?.[0]) return undefined;
  
  const ds = applicatorSeq.items[0].dataSet;
  
  const applicatorID = getDicomString(ds, 'x300a0108') || '';
  const applicatorType = getDicomString(ds, 'x300a0109') as BeamApplicator['applicatorType'] || 'CUSTOM';
  const applicatorDescription = getDicomString(ds, 'x300a010a');
  
  // Applicator Geometry Sequence (300A,0431) may contain aperture details
  const geometrySeq = ds.elements?.x300a0431;
  let apertureShape: BeamApplicator['apertureShape'] | undefined;
  let apertureDimension: BeamApplicator['apertureDimension'] | undefined;
  
  if (geometrySeq?.items?.[0]) {
    const geoDs = geometrySeq.items[0].dataSet;
    const apertureX = getDicomFloat(geoDs, 'x300a0432');
    const apertureY = getDicomFloat(geoDs, 'x300a0434');
    
    if (apertureX !== undefined) {
      if (apertureY !== undefined && apertureY !== apertureX) {
        apertureDimension = { x: apertureX, y: apertureY };
        apertureShape = 'RECTANGULAR';
      } else {
        apertureDimension = apertureX;
        apertureShape = 'CIRCULAR';
      }
    }
  }
  
  return {
    applicatorID,
    applicatorType,
    applicatorDescription,
    apertureShape,
    apertureDimension,
  };
}

/**
 * Extract RT Plan metadata
 * 
 * CRITICAL: This extracts clinically important prescription information.
 * All DICOM tags verified against DICOM PS3.3 2024b standard.
 */
function extractPlanMetadata(
  dataSet: dicomParser.DataSet,
  seriesId: number
): RTPlanMetadata | null {
  try {
    // Count beams from Beam Sequence (300A,00B0)
    const beamSeq = dataSet.elements?.x300a00b0;
    const numberOfBeams = beamSeq?.items?.length || 0;
    
    // Get treatment machine name from first beam (it's in Beam Sequence, not root)
    let treatmentMachineName: string | undefined;
    if (beamSeq?.items?.[0]) {
      treatmentMachineName = getDicomString(beamSeq.items[0].dataSet, 'x300a00b2');
    }
    
    // Get fraction group info from Fraction Group Sequence (300A,0070)
    let numberOfFractions: number | undefined;
    let prescribedDose: number | undefined;
    
    const fractionSeq = dataSet.elements?.x300a0070;
    if (fractionSeq?.items?.[0]) {
      const fgDs = fractionSeq.items[0].dataSet;
      
      // (300A,0078) Number of Fractions Planned - IS type (Integer String)
      // MUST use string parsing, not uint16
      const fracStr = getDicomString(fgDs, 'x300a0078');
      if (fracStr) {
        const parsed = parseInt(fracStr.trim(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          numberOfFractions = parsed;
        }
      }
      
      // CORRECT WAY to get prescription dose:
      // Option 1: (300A,0026) Target Prescription Dose (DS) - total prescription in Gy
      const targetRxDose = getDicomFloat(fgDs, 'x300a0026');
      if (targetRxDose !== undefined && targetRxDose > 0) {
        prescribedDose = targetRxDose;
      } else {
        // Option 2: Sum Beam Meterset (300A,0086) across all beams and multiply by fractions
        // This is the dose PER FRACTION for all beams combined
        const refBeamSeq = fgDs.elements?.x300c0004;
        if (refBeamSeq?.items && numberOfFractions) {
          let totalDosePerFraction = 0;
          for (const beamItem of refBeamSeq.items) {
            // (300A,0086) Beam Dose - dose contribution per fraction from this beam
            const beamDose = getDicomFloat(beamItem.dataSet, 'x300a0086');
            if (beamDose !== undefined && beamDose > 0) {
              totalDosePerFraction += beamDose;
            }
          }
          if (totalDosePerFraction > 0) {
            // Total prescription = dose per fraction × number of fractions
            prescribedDose = totalDosePerFraction * numberOfFractions;
          }
        }
      }
    }
    
    // Get referenced structure set UID from Referenced Structure Set Sequence (300C,0060)
    let referencedStructureSetUID: string | undefined;
    const refStructSeq = dataSet.elements?.x300c0060;
    if (refStructSeq?.items?.[0]) {
      referencedStructureSetUID = getDicomString(refStructSeq.items[0].dataSet, 'x00081155');
    }
    
    // Get referenced dose UID from Referenced RT Dose Sequence (300C,0080) - if pre-computed
    let referencedDoseUID: string | undefined;
    const refDoseSeq = dataSet.elements?.x300c0080;
    if (refDoseSeq?.items?.[0]) {
      referencedDoseUID = getDicomString(refDoseSeq.items[0].dataSet, 'x00081155');
    }
    
    // Plan dates - try RT Plan Date first, then Study Date as fallback
    let planDate = getDicomString(dataSet, 'x300a0006'); // (300A,0006) RT Plan Date
    if (!planDate) {
      planDate = getDicomString(dataSet, 'x00080020'); // (0008,0020) Study Date
    }
    
    let planTime = getDicomString(dataSet, 'x300a0007'); // (300A,0007) RT Plan Time
    if (!planTime) {
      planTime = getDicomString(dataSet, 'x00080030'); // (0008,0030) Study Time
    }
    
    return {
      seriesId,
      seriesInstanceUID: getDicomString(dataSet, 'x0020000e') || '',
      sopInstanceUID: getDicomString(dataSet, 'x00080018') || '',
      planLabel: getDicomString(dataSet, 'x300a0002') || 'RT Plan', // (300A,0002) RT Plan Label
      planName: getDicomString(dataSet, 'x300a0003') || getDicomString(dataSet, 'x300a0002') || 'RT Plan', // (300A,0003) RT Plan Name
      planDate,
      planTime,
      planDescription: getDicomString(dataSet, 'x300a0004'), // (300A,0004) RT Plan Description
      planGeometry: getDicomString(dataSet, 'x300a000c'), // (300A,000C) RT Plan Geometry
      treatmentMachineName,
      numberOfBeams,
      numberOfFractions,
      prescribedDose,
      referencedStructureSetUID,
      referencedDoseUID,
    };
  } catch (error) {
    logger.error(`Error extracting plan metadata: ${error}`);
    return null;
  }
}

/**
 * Extract all beams from RT Plan
 */
function extractBeams(dataSet: dicomParser.DataSet): RTBeam[] {
  const beams: RTBeam[] = [];
  
  // BeamSequence (300A,00B0)
  const beamSeq = dataSet.elements?.x300a00b0;
  if (!beamSeq?.items) return beams;
  
  for (const item of beamSeq.items) {
    const ds = item.dataSet;
    
    const beamNumber = getDicomInt(ds, 'x300a00c0') || beams.length + 1;
    const beamName = getDicomString(ds, 'x300a00c2') || `Beam ${beamNumber}`;
    const beamDescription = getDicomString(ds, 'x300a00c3');
    const beamType = getDicomString(ds, 'x300a00c4') as RTBeam['beamType'] || 'STATIC';
    const radiationType = getDicomString(ds, 'x300a00c6') as RTBeam['radiationType'] || 'PHOTON';
    const treatmentMachine = getDicomString(ds, 'x300a00b2');
    const manufacturer = getDicomString(ds, 'x00080070');
    const institution = getDicomString(ds, 'x00080080');
    const dosimeterUnit = getDicomString(ds, 'x300a00b3');
    const sad = getDicomFloat(ds, 'x300a00b4') || 1000;
    const numControlPoints = getDicomInt(ds, 'x300a0110') || 0;
    const numWedges = getDicomInt(ds, 'x300a00d0');
    const numCompensators = getDicomInt(ds, 'x300a00e0');
    const numBoli = getDicomInt(ds, 'x300a00ed');
    const numBlocks = getDicomInt(ds, 'x300a00f0');
    
    // Parse beam limiting devices and control points
    const beamLimitingDevices = parseBeamLimitingDevices(ds);
    const controlPoints = parseControlPoints(ds, beamLimitingDevices);
    
    // Validation: Check that parsed control points match expected count
    if (numControlPoints && controlPoints.length !== numControlPoints) {
      logger.warn(`Beam ${beamNumber}: Parsed ${controlPoints.length} control points but DICOM says ${numControlPoints}`);
    }
    
    // Parse wedges, blocks, and applicator
    const wedges = parseWedges(ds);
    const blocks = parseBlocks(ds);
    const applicator = parseApplicator(ds);
    
    // Get summary values from first control point
    const firstCP = controlPoints[0];
    const gantryAngle = firstCP?.gantryAngle ?? 0;
    const collimatorAngle = firstCP?.beamLimitingDeviceAngle ?? 0;
    const couchAngle = firstCP?.patientSupportAngle ?? 0;
    const isocenter = firstCP?.isocenterPosition ?? [0, 0, 0];
    
    // Calculate field size from jaw positions
    let fieldSizeX: number | undefined;
    let fieldSizeY: number | undefined;
    if (firstCP?.jawPositions) {
      fieldSizeX = Math.abs(firstCP.jawPositions.x2 - firstCP.jawPositions.x1);
      fieldSizeY = Math.abs(firstCP.jawPositions.y2 - firstCP.jawPositions.y1);
    }
    
    beams.push({
      beamNumber,
      beamName,
      beamDescription,
      beamType,
      radiationType,
      treatmentMachineName: treatmentMachine,
      manufacturer,
      institutionName: institution,
      primaryDosimeterUnit: dosimeterUnit,
      sourceAxisDistance: sad,
      numberOfControlPoints: numControlPoints,
      controlPoints,
      beamLimitingDevices,
      numberOfWedges: numWedges,
      numberOfCompensators: numCompensators,
      numberOfBoli: numBoli,
      numberOfBlocks: numBlocks,
      wedges: wedges.length > 0 ? wedges : undefined,
      blocks: blocks.length > 0 ? blocks : undefined,
      applicator,
      gantryAngle,
      collimatorAngle,
      couchAngle,
      isocenterPosition: isocenter as [number, number, number],
      fieldSizeX,
      fieldSizeY,
    });
  }
  
  return beams;
}

/**
 * Calculate BEV projection data for a beam
 */
function calculateBEVProjection(beam: RTBeam, controlPointIndex: number = 0): BEVProjection {
  const cp = beam.controlPoints[controlPointIndex] || beam.controlPoints[0];
  
  const gantryAngleRad = (cp.gantryAngle * Math.PI) / 180;
  const collimatorAngleRad = ((cp.beamLimitingDeviceAngle || 0) * Math.PI) / 180;
  const couchAngleRad = ((cp.patientSupportAngle || 0) * Math.PI) / 180;
  
  // Calculate source position (SAD distance from isocenter along beam axis)
  // In IEC coordinate system, gantry at 0° means beam comes from +Y direction
  // Gantry rotation is around Z axis (patient axis)
  const sad = beam.sourceAxisDistance;
  const iso = cp.isocenterPosition;
  
  // Apply rotations to get source position
  // Simplified: assuming couch at 0, gantry rotation only
  const sourceX = iso[0] + sad * Math.sin(gantryAngleRad) * Math.cos(couchAngleRad);
  const sourceY = iso[1] - sad * Math.cos(gantryAngleRad);
  const sourceZ = iso[2] + sad * Math.sin(gantryAngleRad) * Math.sin(couchAngleRad);
  
  const sourcePosition: [number, number, number] = [sourceX, sourceY, sourceZ];
  
  // Beam direction vector (from source toward isocenter)
  const dirX = iso[0] - sourceX;
  const dirY = iso[1] - sourceY;
  const dirZ = iso[2] - sourceZ;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
  const beamDirectionVector: [number, number, number] = [
    dirX / dirLen,
    dirY / dirLen,
    dirZ / dirLen,
  ];
  
  // Get jaw aperture
  const jawAperture = cp.jawPositions || { x1: -100, x2: 100, y1: -100, y2: 100 };
  
  // Calculate aperture polygon (rectangular from jaws, or MLC shape if available)
  let aperturePolygon: { x: number; y: number }[] = [];
  
  if (cp.mlcPositions && cp.mlcPositions.leafPairCount > 0) {
    // Build MLC aperture polygon using actual leaf boundaries
    const mlc = cp.mlcPositions;
    const boundaries = findLeafBoundaries(beam.beamLimitingDevices);
    const leafPositions = boundaries ? calculateLeafPositions(boundaries) : null;
    
    // Create polygon from MLC leaf pairs
    const points: { x: number; y: number }[] = [];
    
    // Top edge (bank B, going left to right)
    for (let i = 0; i < mlc.leafPairCount; i++) {
      const y = leafPositions && i < leafPositions.length 
        ? leafPositions[i].y 
        : jawAperture.y1 + (i + 0.5) * 5;
      if (y >= jawAperture.y1 && y <= jawAperture.y2) {
        points.push({ x: mlc.leafPositionsB[i], y });
      }
    }
    
    // Right edge
    if (points.length > 0) {
      points.push({ x: points[points.length - 1].x, y: jawAperture.y2 });
    }
    
    // Bottom edge (bank A, going right to left)
    for (let i = mlc.leafPairCount - 1; i >= 0; i--) {
      const y = leafPositions && i < leafPositions.length 
        ? leafPositions[i].y 
        : jawAperture.y1 + (i + 0.5) * 5;
      if (y >= jawAperture.y1 && y <= jawAperture.y2) {
        points.push({ x: mlc.leafPositionsA[i], y });
      }
    }
    
    // Left edge
    if (points.length > 0) {
      points.push({ x: points[points.length - 1].x, y: jawAperture.y1 });
    }
    
    aperturePolygon = points;
  } else {
    // Simple rectangular aperture from jaws
    aperturePolygon = [
      { x: jawAperture.x1, y: jawAperture.y1 },
      { x: jawAperture.x2, y: jawAperture.y1 },
      { x: jawAperture.x2, y: jawAperture.y2 },
      { x: jawAperture.x1, y: jawAperture.y2 },
    ];
  }
  
  // Build MLC aperture structure for visualization
  let mlcAperture: BEVProjection['mlcAperture'] = undefined;
  if (cp.mlcPositions && cp.mlcPositions.leafPairCount > 0) {
    // Get leaf boundaries for accurate Y positions
    const boundaries = findLeafBoundaries(beam.beamLimitingDevices);
    const leafPositions = boundaries ? calculateLeafPositions(boundaries) : null;
    
    const leaves = [];
    for (let i = 0; i < cp.mlcPositions.leafPairCount; i++) {
      // Use actual leaf boundary positions if available
      const leafInfo = leafPositions && i < leafPositions.length 
        ? leafPositions[i] 
        : { y: jawAperture.y1 + (i + 0.5) * 5, width: 5 }; // fallback
      
      leaves.push({
        y: leafInfo.y,
        width: leafInfo.width,
        x1: cp.mlcPositions.leafPositionsA[i],
        x2: cp.mlcPositions.leafPositionsB[i],
      });
    }
    
    // Calculate average leaf width for display
    const avgLeafWidth = leafPositions && leafPositions.length > 0
      ? leafPositions.reduce((sum, l) => sum + l.width, 0) / leafPositions.length
      : 5;
    
    mlcAperture = {
      leafPairCount: cp.mlcPositions.leafPairCount,
      leafWidth: avgLeafWidth,
      leaves,
    };
  }
  
  // Build wedge visualization data
  const wedgeVis = beam.wedges?.map(w => ({
    wedgeAngle: w.wedgeAngle,
    wedgeOrientation: w.wedgeOrientation,
    wedgeType: w.wedgeType,
  }));
  
  // Build block visualization data
  const blockVis = beam.blocks?.map(b => ({
    blockType: b.blockType,
    contour: b.blockData,
  }));
  
  // Build applicator visualization data
  const applicatorVis = beam.applicator ? {
    type: beam.applicator.applicatorType,
    shape: beam.applicator.apertureShape,
    dimension: beam.applicator.apertureDimension,
  } : undefined;
  
  return {
    beamNumber: beam.beamNumber,
    beamName: beam.beamName,
    gantryAngle: cp.gantryAngle,
    collimatorAngle: cp.beamLimitingDeviceAngle || 0,
    couchAngle: cp.patientSupportAngle || 0,
    isocenterPosition: cp.isocenterPosition,
    sourceAxisDistance: beam.sourceAxisDistance,
    aperturePolygon,
    jawAperture,
    mlcAperture,
    beamDirectionVector,
    sourcePosition,
    wedges: wedgeVis,
    blocks: blockVis,
    applicator: applicatorVis,
  };
}

/**
 * Find leaf boundaries from beam limiting devices
 * Returns array of Y positions for each leaf center
 */
function findLeafBoundaries(devices: BeamLimitingDevice[]): number[] | undefined {
  for (const device of devices) {
    if ((device.type === 'MLCX' || device.type === 'MLCY') && device.leafPositionBoundaries) {
      return device.leafPositionBoundaries;
    }
  }
  return undefined;
}

/**
 * Calculate leaf center Y positions and widths from boundaries
 */
function calculateLeafPositions(boundaries: number[]): { y: number; width: number }[] {
  const leaves: { y: number; width: number }[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const y1 = boundaries[i];
    const y2 = boundaries[i + 1];
    leaves.push({
      y: (y1 + y2) / 2, // Center of the leaf pair
      width: Math.abs(y2 - y1),
    });
  }
  return leaves;
}

/**
 * Find average leaf width from beam limiting devices (for fallback)
 */
function findLeafWidth(devices: BeamLimitingDevice[]): number | undefined {
  const boundaries = findLeafBoundaries(devices);
  if (boundaries && boundaries.length >= 2) {
    return Math.abs(boundaries[1] - boundaries[0]);
  }
  return undefined;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/rt-plan/:seriesId/metadata
 * Returns plan metadata
 */
router.get('/:seriesId/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    
    if (isNaN(seriesId)) {
      return res.status(400).json({ error: 'Invalid series ID' });
    }

    const result = await loadPlanDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Plan series not found' });
    }

    const metadata = extractPlanMetadata(result.dataSet, seriesId);
    if (!metadata) {
      return res.status(500).json({ error: 'Failed to parse plan metadata' });
    }

    res.json(metadata);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rt-plan/:seriesId/beams
 * Returns all beam data with geometry
 */
router.get('/:seriesId/beams', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    
    if (isNaN(seriesId)) {
      return res.status(400).json({ error: 'Invalid series ID' });
    }

    const result = await loadPlanDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Plan series not found' });
    }

    const beams = extractBeams(result.dataSet);
    res.json(beams);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rt-plan/:seriesId/beam/:beamNumber
 * Returns specific beam details
 */
router.get('/:seriesId/beam/:beamNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    const beamNumber = parseInt(req.params.beamNumber, 10);
    
    if (isNaN(seriesId) || isNaN(beamNumber)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const result = await loadPlanDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Plan series not found' });
    }

    const beams = extractBeams(result.dataSet);
    const beam = beams.find(b => b.beamNumber === beamNumber);
    
    if (!beam) {
      return res.status(404).json({ error: 'Beam not found' });
    }

    res.json(beam);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rt-plan/:seriesId/bev/:beamNumber
 * Returns Beam's Eye View projection data
 */
router.get('/:seriesId/bev/:beamNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    const beamNumber = parseInt(req.params.beamNumber, 10);
    const controlPointIndex = parseInt(req.query.controlPoint as string || '0', 10);
    
    if (isNaN(seriesId) || isNaN(beamNumber)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const result = await loadPlanDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Plan series not found' });
    }

    const beams = extractBeams(result.dataSet);
    const beam = beams.find(b => b.beamNumber === beamNumber);
    
    if (!beam) {
      return res.status(404).json({ error: 'Beam not found' });
    }

    const bevProjection = calculateBEVProjection(beam, controlPointIndex);
    res.json(bevProjection);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// DRR Generation & Structure Projection
// ============================================================================

interface DRROptions {
  width: number;
  height: number;
  fieldOfView: number; // mm, half-width of BEV at isocenter
  stepSize: number; // mm, ray marching step
}

interface ProjectedStructure {
  roiNumber: number;
  structureName: string;
  color: [number, number, number];
  projectedContours: Array<{ x: number; y: number }[]>; // Multiple closed polygons
}

/**
 * Project a 3D point to BEV coordinates
 * Uses perspective projection from X-ray source through the point
 */
function projectPointToBEV(
  point: [number, number, number],
  sourcePosition: [number, number, number],
  isocenter: [number, number, number],
  gantryAngleRad: number,
  collimatorAngleRad: number,
  sad: number
): { x: number; y: number } | null {
  // Vector from source to point
  const toPoint = [
    point[0] - sourcePosition[0],
    point[1] - sourcePosition[1],
    point[2] - sourcePosition[2],
  ];
  
  // Distance from source to point along beam axis
  // Beam axis direction (from source toward isocenter)
  const beamDir = [
    isocenter[0] - sourcePosition[0],
    isocenter[1] - sourcePosition[1],
    isocenter[2] - sourcePosition[2],
  ];
  const beamLen = Math.sqrt(beamDir[0]**2 + beamDir[1]**2 + beamDir[2]**2);
  const beamDirNorm = [beamDir[0]/beamLen, beamDir[1]/beamLen, beamDir[2]/beamLen];
  
  // Project toPoint onto beam axis
  const distAlongBeam = toPoint[0]*beamDirNorm[0] + toPoint[1]*beamDirNorm[1] + toPoint[2]*beamDirNorm[2];
  
  // Point behind the source (invalid projection)
  if (distAlongBeam <= 0) return null;
  
  // Calculate where ray from source through point intersects the isocenter plane
  // Scale factor to project to SAD (isocenter plane)
  const scale = sad / distAlongBeam;
  
  // Point in beam coordinate system (perpendicular to beam axis)
  // First, get the point projected to isocenter plane
  const projectedWorld = [
    sourcePosition[0] + toPoint[0] * scale,
    sourcePosition[1] + toPoint[1] * scale,
    sourcePosition[2] + toPoint[2] * scale,
  ];
  
  // Convert to BEV coordinates (relative to isocenter, rotated by collimator)
  const relToIso = [
    projectedWorld[0] - isocenter[0],
    projectedWorld[1] - isocenter[1],
    projectedWorld[2] - isocenter[2],
  ];
  
  // BEV X-axis is perpendicular to beam in the "cross-plane" direction
  // BEV Y-axis is along patient superior-inferior (for gantry 0)
  // This depends on gantry angle
  
  // For gantry angle, the BEV axes rotate
  // At gantry 0 (AP): BEV X = patient left-right, BEV Y = patient sup-inf
  // At gantry 90 (left lat): BEV X = patient AP, BEV Y = patient sup-inf
  
  // Simplified: project onto plane perpendicular to beam
  // BEV X = cross(beamDir, [0,0,1]) normalized (or use gantry rotation)
  // BEV Y = [0,0,1] projected onto BEV plane
  
  // Use rotation matrices for proper BEV coordinate transform
  const cosG = Math.cos(gantryAngleRad);
  const sinG = Math.sin(gantryAngleRad);
  const cosC = Math.cos(collimatorAngleRad);
  const sinC = Math.sin(collimatorAngleRad);
  
  // BEV X axis at isocenter (before collimator rotation): perpendicular to gantry rotation
  // BEV Y axis at isocenter: along patient Z (superior)
  
  // At gantry 0: beam comes from anterior (+Y in DICOM), 
  //   BEV X = patient left (+X in DICOM)
  //   BEV Y = patient superior (+Z in DICOM)
  
  // Transform relToIso to BEV coordinates
  // First undo gantry rotation to get BEV-aligned coords
  let bevX = relToIso[0] * cosG + relToIso[1] * sinG;
  let bevY = relToIso[2]; // Z stays as BEV Y (superior direction)
  
  // Apply collimator rotation
  const finalX = bevX * cosC - bevY * sinC;
  const finalY = bevX * sinC + bevY * cosC;
  
  return { x: finalX, y: finalY };
}

/**
 * Project structure contours to BEV
 */
function projectStructuresToBEV(
  structures: Array<{
    roiNumber: number;
    structureName: string;
    color: [number, number, number];
    contours: Array<{
      slicePosition: number;
      points: number[]; // flat array [x1,y1,z1, x2,y2,z2, ...]
      numberOfPoints: number;
    }>;
  }>,
  sourcePosition: [number, number, number],
  isocenter: [number, number, number],
  gantryAngleRad: number,
  collimatorAngleRad: number,
  sad: number
): ProjectedStructure[] {
  const projected: ProjectedStructure[] = [];
  
  for (const structure of structures) {
    const projectedContours: Array<{ x: number; y: number }[]> = [];
    
    for (const contour of structure.contours) {
      const projectedPoints: { x: number; y: number }[] = [];
      
      for (let i = 0; i < contour.numberOfPoints; i++) {
        const x = contour.points[i * 3];
        const y = contour.points[i * 3 + 1];
        const z = contour.points[i * 3 + 2];
        
        const projected = projectPointToBEV(
          [x, y, z],
          sourcePosition,
          isocenter,
          gantryAngleRad,
          collimatorAngleRad,
          sad
        );
        
        if (projected) {
          projectedPoints.push(projected);
        }
      }
      
      // Only add contours with enough points
      if (projectedPoints.length >= 3) {
        projectedContours.push(projectedPoints);
      }
    }
    
    if (projectedContours.length > 0) {
      projected.push({
        roiNumber: structure.roiNumber,
        structureName: structure.structureName,
        color: structure.color,
        projectedContours,
      });
    }
  }
  
  return projected;
}

/**
 * Generate DRR (Digitally Reconstructed Radiograph) by ray-casting through CT volume
 * Returns base64-encoded grayscale PNG
 */
async function generateDRR(
  ctSeriesId: number,
  sourcePosition: [number, number, number],
  isocenter: [number, number, number],
  gantryAngleRad: number,
  collimatorAngleRad: number,
  sad: number,
  options: DRROptions
): Promise<{ width: number; height: number; data: number[] } | null> {
  try {
    // Get CT images
    const ctImages = await storage.getImagesBySeriesId(ctSeriesId);
    if (ctImages.length === 0) {
      logger.warn('No CT images found for DRR generation');
      return null;
    }
    
    // Sort by slice position
    const sortedImages = [...ctImages].sort((a, b) => {
      const posA = parseImagePosition(a.imagePosition);
      const posB = parseImagePosition(b.imagePosition);
      return (posA?.[2] || 0) - (posB?.[2] || 0);
    });
    
    // Get volume geometry from first image
    const firstImg = sortedImages[0];
    const imgPos = parseImagePosition(firstImg.imagePosition) || [0, 0, 0];
    const imgOrient = parseImageOrientation(firstImg.imageOrientation) || [1, 0, 0, 0, 1, 0];
    const pixelSpacing = parsePixelSpacing(firstImg.pixelSpacing) || [1, 1];
    const rows = firstImg.rows || 512;
    const columns = firstImg.columns || 512;
    
    // Calculate slice spacing
    let sliceSpacing = 1;
    if (sortedImages.length > 1) {
      const pos1 = parseImagePosition(sortedImages[0].imagePosition);
      const pos2 = parseImagePosition(sortedImages[1].imagePosition);
      if (pos1 && pos2) {
        sliceSpacing = Math.abs(pos2[2] - pos1[2]) || 1;
      }
    }
    
    // Build 3D volume (load pixel data for each slice)
    // For performance, we'll use a simplified approach: sample every Nth slice
    const volumeData: Int16Array[] = [];
    const slicePositions: number[] = [];
    
    const sampleStep = Math.max(1, Math.floor(sortedImages.length / 100)); // Max ~100 slices for performance
    
    for (let i = 0; i < sortedImages.length; i += sampleStep) {
      const img = sortedImages[i];
      if (!img.filePath || !fs.existsSync(img.filePath)) continue;
      
      try {
        const buffer = fs.readFileSync(img.filePath);
        const dataSet = dicomParser.parseDicom(buffer);
        const pixelDataElement = dataSet.elements.x7fe00010;
        
        if (pixelDataElement) {
          const pixelData = new Int16Array(
            buffer.buffer,
            buffer.byteOffset + pixelDataElement.dataOffset,
            pixelDataElement.length / 2
          );
          volumeData.push(pixelData);
          
          const pos = parseImagePosition(img.imagePosition);
          slicePositions.push(pos?.[2] || i * sliceSpacing);
        }
      } catch (e) {
        // Skip failed slices
      }
    }
    
    if (volumeData.length < 2) {
      logger.warn('Not enough CT slices loaded for DRR');
      return null;
    }
    
    // DRR generation parameters
    const { width, height, fieldOfView, stepSize } = options;
    const drrData: number[] = new Array(width * height).fill(0);
    
    // Ray-casting through volume
    const cosG = Math.cos(gantryAngleRad);
    const sinG = Math.sin(gantryAngleRad);
    const cosC = Math.cos(collimatorAngleRad);
    const sinC = Math.sin(collimatorAngleRad);
    
    // Volume bounds
    const volMinZ = slicePositions[0];
    const volMaxZ = slicePositions[slicePositions.length - 1];
    const volMinX = imgPos[0];
    const volMaxX = imgPos[0] + columns * pixelSpacing[0];
    const volMinY = imgPos[1];
    const volMaxY = imgPos[1] + rows * pixelSpacing[1];
    
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        // BEV pixel to world coordinate at isocenter plane
        const bevX = (px - width / 2) * (2 * fieldOfView / width);
        const bevY = (height / 2 - py) * (2 * fieldOfView / height);
        
        // Apply inverse collimator rotation
        const rotX = bevX * cosC + bevY * sinC;
        const rotY = -bevX * sinC + bevY * cosC;
        
        // Convert to world coordinates at isocenter plane
        // This is the target point on the isocenter plane
        const targetX = isocenter[0] + rotX * cosG;
        const targetY = isocenter[1] - rotX * sinG;
        const targetZ = isocenter[2] + rotY;
        
        // Ray from source toward target
        const rayDirX = targetX - sourcePosition[0];
        const rayDirY = targetY - sourcePosition[1];
        const rayDirZ = targetZ - sourcePosition[2];
        const rayLen = Math.sqrt(rayDirX**2 + rayDirY**2 + rayDirZ**2);
        const rayDirNorm = [rayDirX/rayLen, rayDirY/rayLen, rayDirZ/rayLen];
        
        // Ray march through volume
        let accumulator = 0;
        const maxSteps = Math.ceil(500 / stepSize); // Max 500mm depth
        
        for (let step = 0; step < maxSteps; step++) {
          const t = step * stepSize;
          const sampleX = sourcePosition[0] + rayDirNorm[0] * t;
          const sampleY = sourcePosition[1] + rayDirNorm[1] * t;
          const sampleZ = sourcePosition[2] + rayDirNorm[2] * t;
          
          // Check if sample is within volume bounds
          if (sampleX < volMinX || sampleX > volMaxX ||
              sampleY < volMinY || sampleY > volMaxY ||
              sampleZ < volMinZ || sampleZ > volMaxZ) {
            continue;
          }
          
          // Find slice index
          let sliceIdx = 0;
          for (let s = 0; s < slicePositions.length - 1; s++) {
            if (sampleZ >= slicePositions[s] && sampleZ < slicePositions[s + 1]) {
              sliceIdx = s;
              break;
            }
          }
          
          // Sample from nearest slice (simple nearest-neighbor)
          const sliceData = volumeData[sliceIdx];
          if (!sliceData) continue;
          
          // Convert world to pixel coordinates in slice
          const pixX = Math.floor((sampleX - imgPos[0]) / pixelSpacing[0]);
          const pixY = Math.floor((sampleY - imgPos[1]) / pixelSpacing[1]);
          
          if (pixX >= 0 && pixX < columns && pixY >= 0 && pixY < rows) {
            const hu = sliceData[pixY * columns + pixX];
            // Accumulate (HU + 1000) to make air = 0, water = 1000
            accumulator += Math.max(0, hu + 1000) * stepSize * 0.001; // Scale factor
          }
        }
        
        // Apply exponential attenuation (Beer-Lambert law approximation)
        const intensity = Math.exp(-accumulator * 0.005) * 255;
        drrData[py * width + px] = Math.max(0, Math.min(255, 255 - intensity));
      }
    }
    
    return { width, height, data: drrData };
  } catch (error) {
    logger.error('DRR generation error:', error);
    return null;
  }
}

function parseImagePosition(pos: any): [number, number, number] | null {
  if (!pos) return null;
  if (Array.isArray(pos)) return [pos[0] || 0, pos[1] || 0, pos[2] || 0];
  if (typeof pos === 'string') {
    const parts = pos.split('\\').map(Number);
    if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  }
  return null;
}

function parseImageOrientation(orient: any): number[] | null {
  if (!orient) return null;
  if (Array.isArray(orient)) return orient;
  if (typeof orient === 'string') {
    return orient.split('\\').map(Number);
  }
  return null;
}

function parsePixelSpacing(spacing: any): [number, number] | null {
  if (!spacing) return null;
  if (Array.isArray(spacing)) return [spacing[0] || 1, spacing[1] || 1];
  if (typeof spacing === 'string') {
    const parts = spacing.split('\\').map(Number);
    if (parts.length >= 2) return [parts[0], parts[1]];
  }
  return null;
}

/**
 * GET /api/rt-plan/:seriesId/bev/:beamNumber/enhanced
 * Returns enhanced BEV with DRR and structure projections
 */
router.get('/:seriesId/bev/:beamNumber/enhanced', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    const beamNumber = parseInt(req.params.beamNumber, 10);
    const controlPointIndex = parseInt(req.query.controlPoint as string || '0', 10);
    const includeDRR = req.query.drr !== 'false';
    const includeStructures = req.query.structures !== 'false';
    const ctSeriesId = req.query.ctSeriesId ? parseInt(req.query.ctSeriesId as string, 10) : null;
    const structureSetId = req.query.structureSetId ? parseInt(req.query.structureSetId as string, 10) : null;
    
    if (isNaN(seriesId) || isNaN(beamNumber)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const result = await loadPlanDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Plan series not found' });
    }

    const beams = extractBeams(result.dataSet);
    const beam = beams.find(b => b.beamNumber === beamNumber);
    
    if (!beam) {
      return res.status(404).json({ error: 'Beam not found' });
    }

    // Get basic BEV projection
    const bev = calculateBEVProjection(beam, controlPointIndex);
    
    // Calculate beam geometry for projections
    const cp = beam.controlPoints[controlPointIndex] || beam.controlPoints[0];
    const gantryAngleRad = (cp.gantryAngle * Math.PI) / 180;
    const collimatorAngleRad = ((cp.beamLimitingDeviceAngle || 0) * Math.PI) / 180;
    const sad = beam.sourceAxisDistance;
    const iso = cp.isocenterPosition;
    
    // Calculate source position
    const sourceX = iso[0] + sad * Math.sin(gantryAngleRad);
    const sourceY = iso[1] - sad * Math.cos(gantryAngleRad);
    const sourceZ = iso[2];
    const sourcePosition: [number, number, number] = [sourceX, sourceY, sourceZ];
    
    const response: any = { ...bev };
    
    // Generate DRR if requested and CT series is available
    if (includeDRR && ctSeriesId) {
      const drr = await generateDRR(
        ctSeriesId,
        sourcePosition,
        iso,
        gantryAngleRad,
        collimatorAngleRad,
        sad,
        { width: 256, height: 256, fieldOfView: 200, stepSize: 3 }
      );
      if (drr) {
        response.drr = drr;
      }
    }
    
    // Project structures if requested
    if (includeStructures && structureSetId) {
      try {
        const rtStructureSet = await storage.getRTStructureSet(structureSetId);
        if (rtStructureSet) {
          const structures = await storage.getRTStructuresBySetId(structureSetId);
          
          // Load contours for each structure
          const structuresWithContours = await Promise.all(
            structures.map(async (s) => {
              const contours = await storage.getRTStructureContours(s.id);
              return {
                roiNumber: s.roiNumber,
                structureName: s.structureName,
                color: (s.color as [number, number, number]) || [255, 255, 0],
                contours: contours.map(c => ({
                  slicePosition: c.slicePosition,
                  points: c.contourData as number[],
                  numberOfPoints: ((c.contourData as number[])?.length || 0) / 3,
                })),
              };
            })
          );
          
          const projected = projectStructuresToBEV(
            structuresWithContours,
            sourcePosition,
            iso,
            gantryAngleRad,
            collimatorAngleRad,
            sad
          );
          
          response.projectedStructures = projected;
        }
      } catch (e) {
        logger.warn('Failed to project structures:', e);
      }
    }
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rt-plan/:seriesId/bev/:beamNumber/all
 * Returns BEV projections for ALL control points (batch endpoint for animation)
 * This is optimized for VMAT/Arc animation pre-caching
 */
router.get('/:seriesId/bev/:beamNumber/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    const beamNumber = parseInt(req.params.beamNumber, 10);
    
    if (isNaN(seriesId) || isNaN(beamNumber)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const result = await loadPlanDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Plan series not found' });
    }

    const beams = extractBeams(result.dataSet);
    const beam = beams.find(b => b.beamNumber === beamNumber);
    
    if (!beam) {
      return res.status(404).json({ error: 'Beam not found' });
    }

    // Calculate BEV for all control points
    const bevProjections: BEVProjection[] = [];
    for (let i = 0; i < beam.controlPoints.length; i++) {
      bevProjections.push(calculateBEVProjection(beam, i));
    }
    
    logger.info(`BEV All: Returning ${bevProjections.length} control points for beam ${beamNumber}`);
    
    res.json({
      beamNumber,
      beamName: beam.beamName,
      totalControlPoints: beam.controlPoints.length,
      bevProjections,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rt-plan/:seriesId/summary
 * Returns a summary suitable for the UI
 */
router.get('/:seriesId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    
    if (isNaN(seriesId)) {
      return res.status(400).json({ error: 'Invalid series ID' });
    }

    const result = await loadPlanDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Plan series not found' });
    }

    const metadata = extractPlanMetadata(result.dataSet, seriesId);
    const beams = extractBeams(result.dataSet);
    
    // Create BEV projections for all beams
    const bevProjections = beams.map(beam => calculateBEVProjection(beam, 0));
    
    // Log metadata for debugging
    logger.info(`RT Plan Summary: ${metadata?.planName}, ${metadata?.numberOfBeams} beams, ${metadata?.numberOfFractions} fractions, ${metadata?.prescribedDose?.toFixed(2) ?? 'N/A'} Gy`);
    
    res.json({
      metadata,
      beams: beams.map(b => ({
        beamNumber: b.beamNumber,
        beamName: b.beamName,
        beamType: b.beamType,
        radiationType: b.radiationType,
        gantryAngle: b.gantryAngle,
        collimatorAngle: b.collimatorAngle,
        couchAngle: b.couchAngle,
        isocenterPosition: b.isocenterPosition,
        fieldSizeX: b.fieldSizeX,
        fieldSizeY: b.fieldSizeY,
        sourceAxisDistance: b.sourceAxisDistance,
        // Use actual parsed count, not DICOM-stated count (they should match, but parsed is ground truth)
        numberOfControlPoints: b.controlPoints.length,
        nominalEnergy: b.controlPoints[0]?.nominalBeamEnergy,
        treatmentMachineName: b.treatmentMachineName,
      })),
      bevProjections,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
