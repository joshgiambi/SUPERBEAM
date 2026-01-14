/**
 * RT Dose API Routes
 * 
 * Provides endpoints for loading and serving RT Dose (RTDOSE) data:
 * - GET /api/rt-dose/:seriesId/metadata - Get dose grid metadata
 * - GET /api/rt-dose/:seriesId/frame/:frameIndex - Get dose frame data
 * - GET /api/rt-dose/:seriesId/dvh/:roiNumber - Calculate DVH for structure
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

interface RTDoseMetadata {
  seriesId: number;
  seriesInstanceUID: string;
  doseUnits: 'GY' | 'RELATIVE';
  doseType: 'PHYSICAL' | 'EFFECTIVE' | 'ERROR';
  doseSummationType: string;
  doseGridScaling: number;
  rows: number;
  columns: number;
  numberOfFrames: number;
  pixelSpacing: [number, number];
  gridFrameOffsetVector: number[];
  imagePositionPatient: [number, number, number];
  imageOrientationPatient: [number, number, number, number, number, number];
  referencedRTPlanSequence?: {
    referencedSOPInstanceUID: string;
  };
  maxDose: number;
  minDose: number;
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number;
}

interface DoseFrameData {
  frameIndex: number;
  slicePosition: number;
  width: number;
  height: number;
  doseData: number[];
  minDose: number;
  maxDose: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse DICOM string value
 */
function getDicomString(dataSet: dicomParser.DataSet, tag: string): string | undefined {
  try {
    return dataSet.string(tag)?.trim();
  } catch {
    return undefined;
  }
}

/**
 * Parse DICOM float value
 */
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
 * Parse DICOM integer value
 */
function getDicomInt(dataSet: dicomParser.DataSet, tag: string): number | undefined {
  try {
    return dataSet.uint16(tag);
  } catch {
    return undefined;
  }
}

/**
 * Parse DICOM float array (backslash-separated)
 */
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
 * Load RT Dose DICOM file for a series
 */
async function loadDoseDicom(seriesId: number): Promise<{
  dataSet: dicomParser.DataSet;
  byteArray: Uint8Array;
} | null> {
  try {
    // Get series and first image
    const series = await storage.getSeries(seriesId);
    if (!series || series.modality !== 'RTDOSE') {
      return null;
    }

    const images = await storage.getImagesBySeriesId(seriesId);
    if (!images || images.length === 0) {
      return null;
    }

    // RTDOSE typically has a single multi-frame image
    const firstImage = images[0];
    const filePath = firstImage.filePath;

    if (!fs.existsSync(filePath)) {
      logger.warn(`RT Dose file not found: ${filePath}`);
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);

    return { dataSet, byteArray };
  } catch (error) {
    logger.error(`Error loading RT Dose DICOM: ${error}`);
    return null;
  }
}

/**
 * Extract dose metadata from DICOM dataset
 */
function extractDoseMetadata(
  dataSet: dicomParser.DataSet,
  seriesId: number,
  byteArray: Uint8Array
): RTDoseMetadata | null {
  try {
    const rows = getDicomInt(dataSet, 'x00280010') || 0;
    const columns = getDicomInt(dataSet, 'x00280011') || 0;
    
    if (!rows || !columns) {
      logger.warn('RT Dose missing rows/columns');
      return null;
    }

    const numberOfFrames = parseInt(getDicomString(dataSet, 'x00280008') || '1', 10);
    const doseGridScaling = getDicomFloat(dataSet, 'x3004000e') || 1;
    
    // Parse grid frame offset vector (Z positions of each frame)
    const gridFrameOffsetVector = getDicomFloatArray(dataSet, 'x3004000c') || [];
    
    // Image position and spacing
    const imagePositionPatient = getDicomFloatArray(dataSet, 'x00200032') || [0, 0, 0];
    const imageOrientationPatient = getDicomFloatArray(dataSet, 'x00200037') || [1, 0, 0, 0, 1, 0];
    const pixelSpacing = getDicomFloatArray(dataSet, 'x00280030') || [1, 1];

    // Dose-specific fields
    const doseUnits = getDicomString(dataSet, 'x30040002')?.toUpperCase() as 'GY' | 'RELATIVE' || 'GY';
    const doseType = getDicomString(dataSet, 'x30040004')?.toUpperCase() as 'PHYSICAL' | 'EFFECTIVE' | 'ERROR' || 'PHYSICAL';
    const doseSummationType = getDicomString(dataSet, 'x30040006') || 'PLAN';
    
    const bitsAllocated = getDicomInt(dataSet, 'x00280100') || 16;
    const bitsStored = getDicomInt(dataSet, 'x00280101') || 16;
    const pixelRepresentation = getDicomInt(dataSet, 'x00280103') || 0;

    // Calculate min/max dose from pixel data
    let minDose = Number.POSITIVE_INFINITY;
    let maxDose = Number.NEGATIVE_INFINITY;
    
    const pixelElement = dataSet.elements['x7fe00010'];
    if (pixelElement) {
      const { dataOffset, length } = pixelElement;
      const pixelCount = rows * columns * numberOfFrames;
      const absoluteOffset = byteArray.byteOffset + dataOffset;
      
      if (bitsAllocated === 32) {
        // Handle alignment - Uint32Array requires 4-byte alignment
        let pixelData: Uint32Array;
        if (absoluteOffset % 4 === 0) {
          pixelData = new Uint32Array(byteArray.buffer, absoluteOffset, length / 4);
        } else {
          // Copy to aligned buffer
          const slice = byteArray.slice(dataOffset, dataOffset + length);
          pixelData = new Uint32Array(slice.buffer);
        }
        for (let i = 0; i < pixelData.length && i < pixelCount; i++) {
          const dose = pixelData[i] * doseGridScaling;
          if (dose < minDose) minDose = dose;
          if (dose > maxDose) maxDose = dose;
        }
      } else if (bitsAllocated === 16) {
        // Handle alignment - Uint16Array requires 2-byte alignment
        let pixelData: Uint16Array;
        if (absoluteOffset % 2 === 0) {
          pixelData = new Uint16Array(byteArray.buffer, absoluteOffset, length / 2);
        } else {
          // Copy to aligned buffer
          const slice = byteArray.slice(dataOffset, dataOffset + length);
          pixelData = new Uint16Array(slice.buffer);
        }
        for (let i = 0; i < pixelData.length && i < pixelCount; i++) {
          const dose = pixelData[i] * doseGridScaling;
          if (dose < minDose) minDose = dose;
          if (dose > maxDose) maxDose = dose;
        }
      }
    }

    if (!Number.isFinite(minDose)) minDose = 0;
    if (!Number.isFinite(maxDose)) maxDose = 70;

    return {
      seriesId,
      seriesInstanceUID: getDicomString(dataSet, 'x0020000e') || '',
      doseUnits,
      doseType,
      doseSummationType,
      doseGridScaling,
      rows,
      columns,
      numberOfFrames,
      pixelSpacing: [pixelSpacing[0], pixelSpacing[1]],
      gridFrameOffsetVector,
      imagePositionPatient: [
        imagePositionPatient[0],
        imagePositionPatient[1],
        imagePositionPatient[2],
      ],
      imageOrientationPatient: [
        imageOrientationPatient[0],
        imageOrientationPatient[1],
        imageOrientationPatient[2],
        imageOrientationPatient[3],
        imageOrientationPatient[4],
        imageOrientationPatient[5],
      ],
      minDose,
      maxDose,
      bitsAllocated,
      bitsStored,
      pixelRepresentation,
    };
  } catch (error) {
    logger.error(`Error extracting dose metadata: ${error}`);
    return null;
  }
}

/**
 * Extract a single dose frame
 */
function extractDoseFrame(
  dataSet: dicomParser.DataSet,
  byteArray: Uint8Array,
  metadata: RTDoseMetadata,
  frameIndex: number
): DoseFrameData | null {
  try {
    if (frameIndex < 0 || frameIndex >= metadata.numberOfFrames) {
      return null;
    }

    const pixelElement = dataSet.elements['x7fe00010'];
    if (!pixelElement) {
      logger.warn('RT Dose missing pixel data');
      return null;
    }

    const { dataOffset } = pixelElement;
    const frameSize = metadata.rows * metadata.columns;
    
    // Calculate slice position
    const slicePosition = metadata.gridFrameOffsetVector[frameIndex] !== undefined
      ? metadata.imagePositionPatient[2] + metadata.gridFrameOffsetVector[frameIndex]
      : metadata.imagePositionPatient[2];

    const doseData: number[] = new Array(frameSize);
    let minDose = Number.POSITIVE_INFINITY;
    let maxDose = Number.NEGATIVE_INFINITY;

    if (metadata.bitsAllocated === 32) {
      const frameOffset = dataOffset + (frameIndex * frameSize * 4);
      const absoluteOffset = byteArray.byteOffset + frameOffset;
      
      // Handle alignment - Uint32Array requires 4-byte alignment
      let pixelData: Uint32Array;
      if (absoluteOffset % 4 === 0) {
        pixelData = new Uint32Array(byteArray.buffer, absoluteOffset, frameSize);
      } else {
        // Copy to aligned buffer
        const slice = byteArray.slice(frameOffset, frameOffset + frameSize * 4);
        pixelData = new Uint32Array(slice.buffer);
      }
      
      for (let i = 0; i < frameSize; i++) {
        const dose = pixelData[i] * metadata.doseGridScaling;
        doseData[i] = dose;
        if (dose < minDose) minDose = dose;
        if (dose > maxDose) maxDose = dose;
      }
    } else if (metadata.bitsAllocated === 16) {
      const frameOffset = dataOffset + (frameIndex * frameSize * 2);
      const absoluteOffset = byteArray.byteOffset + frameOffset;
      
      // Handle alignment - Uint16Array requires 2-byte alignment
      let pixelData: Uint16Array;
      if (absoluteOffset % 2 === 0) {
        pixelData = new Uint16Array(byteArray.buffer, absoluteOffset, frameSize);
      } else {
        // Copy to aligned buffer
        const slice = byteArray.slice(frameOffset, frameOffset + frameSize * 2);
        pixelData = new Uint16Array(slice.buffer);
      }
      
      for (let i = 0; i < frameSize; i++) {
        const dose = pixelData[i] * metadata.doseGridScaling;
        doseData[i] = dose;
        if (dose < minDose) minDose = dose;
        if (dose > maxDose) maxDose = dose;
      }
    } else {
      logger.warn(`Unsupported bits allocated: ${metadata.bitsAllocated}`);
      return null;
    }

    if (!Number.isFinite(minDose)) minDose = 0;
    if (!Number.isFinite(maxDose)) maxDose = 0;

    return {
      frameIndex,
      slicePosition,
      width: metadata.columns,
      height: metadata.rows,
      doseData,
      minDose,
      maxDose,
    };
  } catch (error) {
    logger.error(`Error extracting dose frame: ${error}`);
    return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/rt-dose/:seriesId/metadata
 * Returns dose grid metadata including dimensions, spacing, and dose range
 */
router.get('/:seriesId/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    
    if (isNaN(seriesId)) {
      return res.status(400).json({ error: 'Invalid series ID' });
    }

    const result = await loadDoseDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Dose series not found' });
    }

    const metadata = extractDoseMetadata(result.dataSet, seriesId, result.byteArray);
    if (!metadata) {
      return res.status(500).json({ error: 'Failed to parse dose metadata' });
    }

    res.json(metadata);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rt-dose/:seriesId/frame/:frameIndex
 * Returns dose data for a specific frame (slice)
 */
router.get('/:seriesId/frame/:frameIndex', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    const frameIndex = parseInt(req.params.frameIndex, 10);
    
    if (isNaN(seriesId) || isNaN(frameIndex)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const result = await loadDoseDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Dose series not found' });
    }

    const metadata = extractDoseMetadata(result.dataSet, seriesId, result.byteArray);
    if (!metadata) {
      return res.status(500).json({ error: 'Failed to parse dose metadata' });
    }

    const frameData = extractDoseFrame(result.dataSet, result.byteArray, metadata, frameIndex);
    if (!frameData) {
      return res.status(404).json({ error: 'Frame not found' });
    }

    res.json(frameData);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rt-dose/:seriesId/summary
 * Returns summary statistics for the dose distribution
 */
router.get('/:seriesId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = parseInt(req.params.seriesId, 10);
    
    if (isNaN(seriesId)) {
      return res.status(400).json({ error: 'Invalid series ID' });
    }

    const result = await loadDoseDicom(seriesId);
    if (!result) {
      return res.status(404).json({ error: 'RT Dose series not found' });
    }

    const metadata = extractDoseMetadata(result.dataSet, seriesId, result.byteArray);
    if (!metadata) {
      return res.status(500).json({ error: 'Failed to parse dose metadata' });
    }

    // Calculate dose histogram
    const numBins = 100;
    const histogram = new Array(numBins).fill(0);
    const binWidth = metadata.maxDose / numBins;
    
    const pixelElement = result.dataSet.elements['x7fe00010'];
    if (pixelElement) {
      const { dataOffset, length } = pixelElement;
      const totalPixels = metadata.rows * metadata.columns * metadata.numberOfFrames;
      const absoluteOffset = result.byteArray.byteOffset + dataOffset;
      
      if (metadata.bitsAllocated === 32) {
        // Handle alignment - Uint32Array requires 4-byte alignment
        let pixelData: Uint32Array;
        if (absoluteOffset % 4 === 0) {
          pixelData = new Uint32Array(result.byteArray.buffer, absoluteOffset, length / 4);
        } else {
          // Copy to aligned buffer
          const slice = result.byteArray.slice(dataOffset, dataOffset + length);
          pixelData = new Uint32Array(slice.buffer);
        }
        for (let i = 0; i < pixelData.length && i < totalPixels; i++) {
          const dose = pixelData[i] * metadata.doseGridScaling;
          const bin = Math.min(numBins - 1, Math.floor(dose / binWidth));
          if (bin >= 0) histogram[bin]++;
        }
      } else if (metadata.bitsAllocated === 16) {
        // Handle alignment - Uint16Array requires 2-byte alignment
        let pixelData: Uint16Array;
        if (absoluteOffset % 2 === 0) {
          pixelData = new Uint16Array(result.byteArray.buffer, absoluteOffset, length / 2);
        } else {
          // Copy to aligned buffer
          const slice = result.byteArray.slice(dataOffset, dataOffset + length);
          pixelData = new Uint16Array(slice.buffer);
        }
        for (let i = 0; i < pixelData.length && i < totalPixels; i++) {
          const dose = pixelData[i] * metadata.doseGridScaling;
          const bin = Math.min(numBins - 1, Math.floor(dose / binWidth));
          if (bin >= 0) histogram[bin]++;
        }
      }
    }

    res.json({
      seriesId,
      minDose: metadata.minDose,
      maxDose: metadata.maxDose,
      doseUnits: metadata.doseUnits,
      doseType: metadata.doseType,
      numberOfFrames: metadata.numberOfFrames,
      gridSize: {
        rows: metadata.rows,
        columns: metadata.columns,
      },
      histogram: {
        bins: histogram,
        binWidth,
        numBins,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

