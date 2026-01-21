/**
 * DVH (Dose-Volume Histogram) API Routes
 * 
 * Provides endpoints for calculating and serving DVH data:
 * - GET /api/dvh/:doseSeriesId - Get DVH for all structures (instant if pre-computed)
 * - GET /api/dvh/:doseSeriesId/:roiNumber - Get DVH for specific structure
 * - POST /api/dvh/:doseSeriesId/precompute - Trigger background DVH pre-computation
 * - GET /api/dvh/:doseSeriesId/status - Check if DVH is pre-computed
 * 
 * OPTIMIZATION: 
 * - DVH results are stored persistently in the database (survives server restarts)
 * - In-memory cache for active session performance
 * - Background pre-computation when dose data is loaded
 */

import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import dicomParser from 'dicom-parser';
import { storage } from './storage';
import { logger } from './logger';

const router = Router();

// ============================================================================
// IN-MEMORY CACHE - Session-level performance optimization
// (Database cache is the primary persistent storage)
// ============================================================================

interface CachedDVH {
  response: DVHResponse;
  timestamp: number;
}

// In-memory cache keyed by "doseSeriesId:structureSetId:prescriptionDose"
const memoryCache = new Map<string, CachedDVH>();
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for in-memory cache

function getCacheKey(doseSeriesId: number, structureSetId: number, prescriptionDose: number): string {
  return `${doseSeriesId}:${structureSetId}:${prescriptionDose}`;
}

function getMemoryCachedDVH(key: string): DVHResponse | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL_MS) {
    return cached.response;
  }
  if (cached) {
    memoryCache.delete(key);
  }
  return null;
}

function setMemoryCachedDVH(key: string, response: DVHResponse): void {
  memoryCache.set(key, { response, timestamp: Date.now() });
}

// Track in-progress calculations to prevent duplicate work
const inProgressCalculations = new Map<string, Promise<DVHResponse>>();

// Track background pre-computation jobs
const precomputeJobs = new Map<string, { status: string; startTime: number; error?: string }>();

// ============================================================================
// Types
// ============================================================================

interface DVHPoint {
  dose: number;
  volume: number;
}

interface DVHCurve {
  roiNumber: number;
  roiName: string;
  color: string;
  volumeCc: number;
  points: DVHPoint[];
  statistics: {
    min: number;
    max: number;
    mean: number;
    d95: number;
    d50: number;
    d2: number;
    v100?: number;
  };
}

interface DVHResponse {
  doseSeriesId: number;
  structureSetId: number;
  prescriptionDose: number;
  curves: DVHCurve[];
}

interface ContourPoint {
  x: number;
  y: number;
  z: number;
}

interface ROIContour {
  roiNumber: number;
  roiName: string;
  color: string;
  contours: {
    slicePosition: number;
    points: ContourPoint[];
  }[];
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
 * Load RT Dose DICOM file
 */
async function loadDoseDicom(seriesId: number): Promise<{
  dataSet: dicomParser.DataSet;
  byteArray: Uint8Array;
  metadata: {
    rows: number;
    columns: number;
    numberOfFrames: number;
    doseGridScaling: number;
    pixelSpacing: [number, number];
    imagePositionPatient: [number, number, number];
    gridFrameOffsetVector: number[];
    bitsAllocated: number;
    maxDose: number;
  };
} | null> {
  try {
    const series = await storage.getSeries(seriesId);
    if (!series || series.modality !== 'RTDOSE') {
      return null;
    }

    const images = await storage.getImagesBySeriesId(seriesId);
    if (!images || images.length === 0) {
      return null;
    }

    const firstImage = images[0];
    const filePath = firstImage.filePath;

    if (!fs.existsSync(filePath)) {
      logger.warn(`RT Dose file not found: ${filePath}`);
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);

    const rows = getDicomInt(dataSet, 'x00280010') || 0;
    const columns = getDicomInt(dataSet, 'x00280011') || 0;
    const numberOfFrames = parseInt(getDicomString(dataSet, 'x00280008') || '1', 10);
    const doseGridScaling = getDicomFloat(dataSet, 'x3004000e') || 1;
    const gridFrameOffsetVector = getDicomFloatArray(dataSet, 'x3004000c') || [];
    const imagePositionPatient = getDicomFloatArray(dataSet, 'x00200032') || [0, 0, 0];
    const pixelSpacing = getDicomFloatArray(dataSet, 'x00280030') || [1, 1];
    const bitsAllocated = getDicomInt(dataSet, 'x00280100') || 16;

    // Calculate max dose
    let maxDose = 0;
    const pixelElement = dataSet.elements['x7fe00010'];
    if (pixelElement) {
      const { dataOffset, length } = pixelElement;
      const absoluteOffset = byteArray.byteOffset + dataOffset;
      
      if (bitsAllocated === 32) {
        let pixelData: Uint32Array;
        if (absoluteOffset % 4 === 0) {
          pixelData = new Uint32Array(byteArray.buffer, absoluteOffset, length / 4);
        } else {
          const slice = byteArray.slice(dataOffset, dataOffset + length);
          pixelData = new Uint32Array(slice.buffer);
        }
        for (let i = 0; i < pixelData.length; i++) {
          const dose = pixelData[i] * doseGridScaling;
          if (dose > maxDose) maxDose = dose;
        }
      } else if (bitsAllocated === 16) {
        let pixelData: Uint16Array;
        if (absoluteOffset % 2 === 0) {
          pixelData = new Uint16Array(byteArray.buffer, absoluteOffset, length / 2);
        } else {
          const slice = byteArray.slice(dataOffset, dataOffset + length);
          pixelData = new Uint16Array(slice.buffer);
        }
        for (let i = 0; i < pixelData.length; i++) {
          const dose = pixelData[i] * doseGridScaling;
          if (dose > maxDose) maxDose = dose;
        }
      }
    }

    return {
      dataSet,
      byteArray,
      metadata: {
        rows,
        columns,
        numberOfFrames,
        doseGridScaling,
        pixelSpacing: [pixelSpacing[0], pixelSpacing[1]],
        imagePositionPatient: [
          imagePositionPatient[0],
          imagePositionPatient[1],
          imagePositionPatient[2],
        ],
        gridFrameOffsetVector,
        bitsAllocated,
        maxDose,
      },
    };
  } catch (error) {
    logger.error(`Error loading RT Dose DICOM: ${error}`);
    return null;
  }
}

/**
 * Load RT Structure Set DICOM file
 */
async function loadStructureSet(seriesId: number): Promise<ROIContour[] | null> {
  try {
    const series = await storage.getSeries(seriesId);
    if (!series || series.modality !== 'RTSTRUCT') {
      return null;
    }

    const images = await storage.getImagesBySeriesId(seriesId);
    if (!images || images.length === 0) {
      return null;
    }

    const firstImage = images[0];
    const filePath = firstImage.filePath;

    if (!fs.existsSync(filePath)) {
      logger.warn(`RT Structure file not found: ${filePath}`);
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);

    const roiContours: ROIContour[] = [];

    // Parse Structure Set ROI Sequence (3006,0020)
    const roiSequence = dataSet.elements['x30060020'];
    const roiNames: Map<number, string> = new Map();
    
    if (roiSequence) {
      const numItems = roiSequence.items?.length || 0;
      for (let i = 0; i < numItems; i++) {
        const item = roiSequence.items?.[i];
        if (item?.dataSet) {
          const roiNumber = getDicomInt(item.dataSet, 'x30060022') || 0;
          const roiName = getDicomString(item.dataSet, 'x30060026') || `ROI_${roiNumber}`;
          roiNames.set(roiNumber, roiName);
        }
      }
    }

    // Parse ROI Contour Sequence (3006,0039)
    const contourSequence = dataSet.elements['x30060039'];
    if (contourSequence) {
      const numROIs = contourSequence.items?.length || 0;
      
      for (let i = 0; i < numROIs; i++) {
        const roiItem = contourSequence.items?.[i];
        if (!roiItem?.dataSet) continue;

        const roiNumber = getDicomInt(roiItem.dataSet, 'x30060084') || 0;
        const roiName = roiNames.get(roiNumber) || `ROI_${roiNumber}`;
        
        // Parse color (3006,002A)
        const colorArray = getDicomFloatArray(roiItem.dataSet, 'x3006002a') || [255, 0, 0];
        const color = `rgb(${colorArray[0]}, ${colorArray[1]}, ${colorArray[2]})`;

        const contours: { slicePosition: number; points: ContourPoint[] }[] = [];

        // Parse Contour Sequence (3006,0040)
        const contourSeq = roiItem.dataSet.elements['x30060040'];
        if (contourSeq) {
          const numContours = contourSeq.items?.length || 0;
          
          for (let j = 0; j < numContours; j++) {
            const contourItem = contourSeq.items?.[j];
            if (!contourItem?.dataSet) continue;

            const contourData = getDicomFloatArray(contourItem.dataSet, 'x30060050');
            if (!contourData || contourData.length < 3) continue;

            const points: ContourPoint[] = [];
            for (let k = 0; k < contourData.length; k += 3) {
              points.push({
                x: contourData[k],
                y: contourData[k + 1],
                z: contourData[k + 2],
              });
            }

            if (points.length > 0) {
              contours.push({
                slicePosition: points[0].z,
                points,
              });
            }
          }
        }

        if (contours.length > 0) {
          roiContours.push({
            roiNumber,
            roiName,
            color,
            contours,
          });
        }
      }
    }

    return roiContours;
  } catch (error) {
    logger.error(`Error loading RT Structure Set: ${error}`);
    return null;
  }
}

/**
 * Find structure set series for a study
 */
async function findStructureSetForStudy(studyId: number): Promise<number | null> {
  try {
    const allSeries = await storage.getSeriesByStudyId(studyId);
    const structSeries = allSeries.find(s => s.modality === 'RTSTRUCT');
    return structSeries?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get dose value at a specific position
 */
function getDoseAtPosition(
  doseData: {
    dataSet: dicomParser.DataSet;
    byteArray: Uint8Array;
    metadata: {
      rows: number;
      columns: number;
      numberOfFrames: number;
      doseGridScaling: number;
      pixelSpacing: [number, number];
      imagePositionPatient: [number, number, number];
      gridFrameOffsetVector: number[];
      bitsAllocated: number;
    };
  },
  x: number,
  y: number,
  z: number
): number {
  const { metadata, dataSet, byteArray } = doseData;
  
  // Convert patient coordinates to grid indices
  const col = Math.round((x - metadata.imagePositionPatient[0]) / metadata.pixelSpacing[0]);
  const row = Math.round((y - metadata.imagePositionPatient[1]) / metadata.pixelSpacing[1]);
  
  // Find frame index from z position
  let frameIndex = 0;
  if (metadata.gridFrameOffsetVector.length > 0) {
    const zOffset = z - metadata.imagePositionPatient[2];
    let minDist = Math.abs(zOffset - metadata.gridFrameOffsetVector[0]);
    for (let i = 1; i < metadata.gridFrameOffsetVector.length; i++) {
      const dist = Math.abs(zOffset - metadata.gridFrameOffsetVector[i]);
      if (dist < minDist) {
        minDist = dist;
        frameIndex = i;
      }
    }
  }

  // Bounds check
  if (col < 0 || col >= metadata.columns || 
      row < 0 || row >= metadata.rows || 
      frameIndex < 0 || frameIndex >= metadata.numberOfFrames) {
    return 0;
  }

  // Get pixel value
  const pixelElement = dataSet.elements['x7fe00010'];
  if (!pixelElement) return 0;

  const { dataOffset } = pixelElement;
  const frameSize = metadata.rows * metadata.columns;
  const pixelIndex = row * metadata.columns + col;

  if (metadata.bitsAllocated === 32) {
    const offset = dataOffset + (frameIndex * frameSize + pixelIndex) * 4;
    const absoluteOffset = byteArray.byteOffset + offset;
    
    let value: number;
    if (absoluteOffset % 4 === 0) {
      const view = new DataView(byteArray.buffer, absoluteOffset, 4);
      value = view.getUint32(0, true);
    } else {
      value = byteArray[offset] | 
              (byteArray[offset + 1] << 8) | 
              (byteArray[offset + 2] << 16) | 
              (byteArray[offset + 3] << 24);
    }
    return value * metadata.doseGridScaling;
  } else if (metadata.bitsAllocated === 16) {
    const offset = dataOffset + (frameIndex * frameSize + pixelIndex) * 2;
    const absoluteOffset = byteArray.byteOffset + offset;
    
    let value: number;
    if (absoluteOffset % 2 === 0) {
      const view = new DataView(byteArray.buffer, absoluteOffset, 2);
      value = view.getUint16(0, true);
    } else {
      value = byteArray[offset] | (byteArray[offset + 1] << 8);
    }
    return value * metadata.doseGridScaling;
  }

  return 0;
}

/**
 * Check if a point is inside a polygon (ray casting algorithm)
 */
function pointInPolygon(x: number, y: number, polygon: ContourPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Calculate DVH for a single ROI
 */
function calculateDVHForROI(
  roi: ROIContour,
  doseData: {
    dataSet: dicomParser.DataSet;
    byteArray: Uint8Array;
    metadata: {
      rows: number;
      columns: number;
      numberOfFrames: number;
      doseGridScaling: number;
      pixelSpacing: [number, number];
      imagePositionPatient: [number, number, number];
      gridFrameOffsetVector: number[];
      bitsAllocated: number;
      maxDose: number;
    };
  },
  prescriptionDose: number
): DVHCurve {
  const { metadata } = doseData;
  
  // Collect all dose values within the structure
  const doseValues: number[] = [];
  const pixelArea = metadata.pixelSpacing[0] * metadata.pixelSpacing[1]; // mm^2
  
  // Calculate slice thickness from grid frame offsets
  let sliceThickness = 3; // default 3mm
  if (metadata.gridFrameOffsetVector.length > 1) {
    sliceThickness = Math.abs(metadata.gridFrameOffsetVector[1] - metadata.gridFrameOffsetVector[0]);
  }
  
  const voxelVolume = pixelArea * sliceThickness / 1000; // cc (mm^3 / 1000)

  // Sample dose at points within each contour
  for (const contour of roi.contours) {
    if (contour.points.length < 3) continue;
    
    // Get bounding box of contour
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const pt of contour.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    
    // Sample within bounding box with 2x downsampling for speed
    // (doubles step size, 4x faster with minimal accuracy loss)
    const stepX = metadata.pixelSpacing[0] * 2;
    const stepY = metadata.pixelSpacing[1] * 2;
    
    for (let x = minX; x <= maxX; x += stepX) {
      for (let y = minY; y <= maxY; y += stepY) {
        if (pointInPolygon(x, y, contour.points)) {
          const dose = getDoseAtPosition(doseData, x, y, contour.slicePosition);
          doseValues.push(dose);
        }
      }
    }
  }

  // Calculate volume (account for 2x downsampling by multiplying by 4)
  const volumeCc = doseValues.length * voxelVolume * 4;

  // Calculate statistics in single pass
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < doseValues.length; i++) {
    const dose = doseValues[i];
    if (dose < min) min = dose;
    if (dose > max) max = dose;
    sum += dose;
  }
  const mean = doseValues.length > 0 ? sum / doseValues.length : 0;
  
  // Use histogram for DVH curve (O(n) instead of O(n*bins))
  const numBins = 200;
  const maxDoseForBins = Math.max(metadata.maxDose, max, 1) * 1.1;
  const binWidth = maxDoseForBins / numBins;
  
  // Build histogram counts
  const histogram = new Uint32Array(numBins + 1);
  let v100Count = 0;
  
  for (let i = 0; i < doseValues.length; i++) {
    const dose = doseValues[i];
    const bin = Math.min(numBins, Math.floor(dose / binWidth));
    histogram[bin]++;
    if (dose >= prescriptionDose) v100Count++;
  }
  
  const v100 = doseValues.length > 0 ? (v100Count / doseValues.length) * 100 : 0;
  
  // Build cumulative DVH from histogram (sum from high to low)
  const points: DVHPoint[] = new Array(numBins + 1);
  let cumulative = 0;
  for (let i = numBins; i >= 0; i--) {
    cumulative += histogram[i];
    const volumePercent = doseValues.length > 0 ? (cumulative / doseValues.length) * 100 : 0;
    points[i] = {
      dose: i * binWidth,
      volume: volumePercent,
    };
  }
  
  // Calculate percentiles from cumulative histogram
  const totalVoxels = doseValues.length;
  let d95 = 0, d50 = 0, d2 = max;
  if (totalVoxels > 0) {
    const target95 = totalVoxels * 0.05; // 95% of volume receives >= this dose
    const target50 = totalVoxels * 0.50;
    const target2 = totalVoxels * 0.98;
    
    let runningSum = 0;
    for (let i = numBins; i >= 0; i--) {
      runningSum += histogram[i];
      const dose = i * binWidth;
      if (runningSum >= target95 && d95 === 0) d95 = dose;
      if (runningSum >= target50 && d50 === 0) d50 = dose;
      if (runningSum >= target2 && d2 === max) d2 = dose;
    }
  }

  return {
    roiNumber: roi.roiNumber,
    roiName: roi.roiName,
    color: roi.color,
    volumeCc,
    points,
    statistics: {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
      mean,
      d95,
      d50,
      d2,
      v100,
    },
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/dvh/:doseSeriesId/status
 * Check if DVH is pre-computed and available for instant loading
 */
router.get('/:doseSeriesId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doseSeriesId = parseInt(req.params.doseSeriesId, 10);
    const prescriptionDose = parseFloat(req.query.prescriptionDose as string) || 60;
    
    if (isNaN(doseSeriesId)) {
      return res.status(400).json({ error: 'Invalid dose series ID' });
    }

    // Find structure set
    const doseSeries = await storage.getSeries(doseSeriesId);
    if (!doseSeries?.studyId) {
      return res.json({ precomputed: false, reason: 'Dose series not found' });
    }
    
    const structSetId = await findStructureSetForStudy(doseSeries.studyId);
    if (!structSetId) {
      return res.json({ precomputed: false, reason: 'No structure set found' });
    }

    // Check database cache
    const dbCached = await storage.getDvhCache(doseSeriesId, structSetId, prescriptionDose);
    
    // Check if precompute job is running
    const cacheKey = getCacheKey(doseSeriesId, structSetId, prescriptionDose);
    const job = precomputeJobs.get(cacheKey);

    res.json({
      precomputed: !!dbCached,
      structureCount: dbCached?.structureCount || 0,
      computationTimeMs: dbCached?.computationTimeMs || null,
      cachedAt: dbCached?.updatedAt || null,
      jobStatus: job?.status || null,
      jobStartTime: job?.startTime || null,
      jobError: job?.error || null,
    });
  } catch (error) {
    logger.error(`DVH status check error: ${error}`);
    next(error);
  }
});

/**
 * POST /api/dvh/:doseSeriesId/precompute
 * Trigger background DVH pre-computation (non-blocking)
 * Call this when dose data is loaded to ensure instant DVH availability
 */
router.post('/:doseSeriesId/precompute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doseSeriesId = parseInt(req.params.doseSeriesId, 10);
    const prescriptionDose = parseFloat(req.body.prescriptionDose as string) || 60;
    const force = req.body.force === true;
    
    if (isNaN(doseSeriesId)) {
      return res.status(400).json({ error: 'Invalid dose series ID' });
    }

    // Find structure set
    const doseSeries = await storage.getSeries(doseSeriesId);
    if (!doseSeries?.studyId) {
      return res.status(404).json({ error: 'Dose series not found' });
    }
    
    const structSetId = await findStructureSetForStudy(doseSeries.studyId);
    if (!structSetId) {
      return res.status(404).json({ error: 'No structure set found for this dose series' });
    }

    const cacheKey = getCacheKey(doseSeriesId, structSetId, prescriptionDose);

    // Check if already pre-computed (unless forced)
    if (!force) {
      const dbCached = await storage.getDvhCache(doseSeriesId, structSetId, prescriptionDose);
      if (dbCached) {
        return res.json({ 
          status: 'already_computed',
          structureCount: dbCached.structureCount,
          cachedAt: dbCached.updatedAt,
        });
      }
    }

    // Check if job already running
    const existingJob = precomputeJobs.get(cacheKey);
    if (existingJob?.status === 'running') {
      return res.json({ status: 'already_running', startTime: existingJob.startTime });
    }

    // Start background computation
    precomputeJobs.set(cacheKey, { status: 'running', startTime: Date.now() });
    
    // Return immediately - computation happens in background
    res.json({ status: 'started', cacheKey });

    // Background computation (don't await)
    computeAndStoreDVH(doseSeriesId, structSetId, prescriptionDose)
      .then((result) => {
        precomputeJobs.set(cacheKey, { 
          status: 'completed', 
          startTime: precomputeJobs.get(cacheKey)?.startTime || Date.now() 
        });
        logger.info(`DVH pre-computation completed for ${cacheKey}: ${result.curves.length} structures`);
      })
      .catch((error) => {
        precomputeJobs.set(cacheKey, { 
          status: 'failed', 
          startTime: precomputeJobs.get(cacheKey)?.startTime || Date.now(),
          error: error.message,
        });
        logger.error(`DVH pre-computation failed for ${cacheKey}: ${error.message}`);
      });
  } catch (error) {
    logger.error(`DVH precompute error: ${error}`);
    next(error);
  }
});

/**
 * Helper: Compute DVH and store in database
 */
async function computeAndStoreDVH(
  doseSeriesId: number, 
  structSetId: number, 
  prescriptionDose: number
): Promise<DVHResponse> {
  const startTime = Date.now();

  // Load dose data
  const doseData = await loadDoseDicom(doseSeriesId);
  if (!doseData) {
    throw new Error('RT Dose series not found');
  }

  // Load structure set
  const structures = await loadStructureSet(structSetId);
  if (!structures || structures.length === 0) {
    throw new Error('No structures found in structure set');
  }

  // Calculate DVH for each structure
  const curves: DVHCurve[] = [];
  for (const roi of structures) {
    try {
      const curve = calculateDVHForROI(roi, doseData, prescriptionDose);
      curves.push(curve);
    } catch (err) {
      logger.warn(`Failed to calculate DVH for ROI ${roi.roiNumber}: ${err}`);
    }
  }

  const response: DVHResponse = {
    doseSeriesId,
    structureSetId: structSetId,
    prescriptionDose,
    curves,
  };

  const elapsed = Date.now() - startTime;

  // Store in database for persistent caching (with error handling)
  try {
    await storage.saveDvhCache({
      doseSeriesId,
      structureSetSeriesId: structSetId,
      prescriptionDose,
      dvhData: response as any, // JSONB
      computationTimeMs: elapsed,
      structureCount: curves.length,
    });
    logger.info(`DVH computed and stored in ${elapsed}ms (${curves.length} structures)`);
  } catch (dbError) {
    // Database save failed but computation succeeded - log and continue
    logger.warn(`DVH computed in ${elapsed}ms but failed to store: ${dbError}`);
  }

  // Also cache in memory for session performance
  const cacheKey = getCacheKey(doseSeriesId, structSetId, prescriptionDose);
  setMemoryCachedDVH(cacheKey, response);

  return response;
}

/**
 * GET /api/dvh/:doseSeriesId
 * Get DVH for all structures in the associated structure set
 * Returns instantly if pre-computed, otherwise calculates and stores for future use
 */
router.get('/:doseSeriesId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doseSeriesId = parseInt(req.params.doseSeriesId, 10);
    const structureSetIdParam = req.query.structureSetId ? parseInt(req.query.structureSetId as string, 10) : undefined;
    const prescriptionDose = parseFloat(req.query.prescriptionDose as string) || 60;
    
    if (isNaN(doseSeriesId)) {
      return res.status(400).json({ error: 'Invalid dose series ID' });
    }

    // Find structure set first (fast operation)
    let structSetId = structureSetIdParam;
    if (!structSetId) {
      const doseSeries = await storage.getSeries(doseSeriesId);
      if (doseSeries?.studyId) {
        structSetId = await findStructureSetForStudy(doseSeries.studyId) || undefined;
      }
    }

    if (!structSetId) {
      return res.status(404).json({ error: 'No structure set found for this dose series' });
    }

    const cacheKey = getCacheKey(doseSeriesId, structSetId, prescriptionDose);

    // 1. Check in-memory cache first (fastest)
    const memCached = getMemoryCachedDVH(cacheKey);
    if (memCached) {
      logger.info(`DVH memory cache hit: ${cacheKey}`);
      return res.json(memCached);
    }

    // 2. Check database cache (persistent, survives restarts)
    try {
      const dbCached = await storage.getDvhCache(doseSeriesId, structSetId, prescriptionDose);
      if (dbCached) {
        const response = dbCached.dvhData as DVHResponse;
        // Populate memory cache for session performance
        setMemoryCachedDVH(cacheKey, response);
        logger.info(`DVH database cache hit: ${cacheKey}`);
        return res.json(response);
      }
    } catch (dbError) {
      // Database cache unavailable - continue to compute
      logger.warn(`DVH database cache error, will compute: ${dbError}`);
    }

    // 3. Check if calculation is already in progress
    const inProgress = inProgressCalculations.get(cacheKey);
    if (inProgress) {
      logger.info(`DVH calculation already in progress for ${cacheKey}, waiting...`);
      const result = await inProgress;
      return res.json(result);
    }

    // 4. Compute DVH (not cached) - this will also store in database
    logger.info(`DVH not cached, computing: dose=${doseSeriesId}, struct=${structSetId}, rx=${prescriptionDose}`);
    
    const calculationPromise = computeAndStoreDVH(doseSeriesId, structSetId, prescriptionDose);
    inProgressCalculations.set(cacheKey, calculationPromise);

    try {
      const response = await calculationPromise;
      res.json(response);
    } finally {
      inProgressCalculations.delete(cacheKey);
    }
  } catch (error) {
    logger.error(`DVH fetch error: ${error}`);
    next(error);
  }
});

/**
 * DELETE /api/dvh/:doseSeriesId/cache
 * Invalidate DVH cache for a dose series (call when structures are modified)
 */
router.delete('/:doseSeriesId/cache', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doseSeriesId = parseInt(req.params.doseSeriesId, 10);
    
    if (isNaN(doseSeriesId)) {
      return res.status(400).json({ error: 'Invalid dose series ID' });
    }

    // Clear database cache
    const deletedCount = await storage.invalidateDvhCacheByDoseSeries(doseSeriesId);
    
    // Clear memory cache entries for this dose series
    const keysToDelete: string[] = [];
    for (const key of memoryCache.keys()) {
      if (key.startsWith(`${doseSeriesId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => memoryCache.delete(key));

    logger.info(`DVH cache invalidated for dose series ${doseSeriesId}: ${deletedCount} database entries, ${keysToDelete.length} memory entries`);
    
    res.json({ 
      success: true, 
      deletedDatabaseEntries: deletedCount,
      deletedMemoryEntries: keysToDelete.length,
    });
  } catch (error) {
    logger.error(`DVH cache invalidation error: ${error}`);
    next(error);
  }
});

/**
 * DELETE /api/dvh/cache/structure-set/:structureSetSeriesId
 * Invalidate DVH cache when a structure set is modified
 */
router.delete('/cache/structure-set/:structureSetSeriesId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const structureSetSeriesId = parseInt(req.params.structureSetSeriesId, 10);
    
    if (isNaN(structureSetSeriesId)) {
      return res.status(400).json({ error: 'Invalid structure set series ID' });
    }

    // Clear database cache
    const deletedCount = await storage.invalidateDvhCacheByStructureSet(structureSetSeriesId);
    
    // Clear memory cache entries for this structure set
    const keysToDelete: string[] = [];
    for (const key of memoryCache.keys()) {
      const parts = key.split(':');
      if (parts.length >= 2 && parseInt(parts[1]) === structureSetSeriesId) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => memoryCache.delete(key));

    logger.info(`DVH cache invalidated for structure set ${structureSetSeriesId}: ${deletedCount} database entries, ${keysToDelete.length} memory entries`);
    
    res.json({ 
      success: true, 
      deletedDatabaseEntries: deletedCount,
      deletedMemoryEntries: keysToDelete.length,
    });
  } catch (error) {
    logger.error(`DVH cache invalidation error: ${error}`);
    next(error);
  }
});

/**
 * GET /api/dvh/:doseSeriesId/:roiNumber
 * Get DVH for a specific structure
 * First checks if full DVH is cached, then extracts the specific ROI
 */
router.get('/:doseSeriesId/:roiNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doseSeriesId = parseInt(req.params.doseSeriesId, 10);
    const roiNumber = parseInt(req.params.roiNumber, 10);
    const structureSetId = req.query.structureSetId ? parseInt(req.query.structureSetId as string, 10) : undefined;
    const prescriptionDose = parseFloat(req.query.prescriptionDose as string) || 60;
    
    if (isNaN(doseSeriesId) || isNaN(roiNumber)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Find structure set
    let structSetId = structureSetId;
    if (!structSetId) {
      const doseSeries = await storage.getSeries(doseSeriesId);
      if (doseSeries?.studyId) {
        structSetId = await findStructureSetForStudy(doseSeries.studyId) || undefined;
      }
    }

    if (!structSetId) {
      return res.status(404).json({ error: 'No structure set found' });
    }

    const cacheKey = getCacheKey(doseSeriesId, structSetId, prescriptionDose);

    // Check if full DVH is cached - extract single ROI from it
    const memCached = getMemoryCachedDVH(cacheKey);
    if (memCached) {
      const curve = memCached.curves.find(c => c.roiNumber === roiNumber);
      if (curve) {
        return res.json({
          doseSeriesId,
          structureSetId: structSetId,
          prescriptionDose,
          curve,
        });
      }
    }

    // Check database cache (with error handling)
    try {
      const dbCached = await storage.getDvhCache(doseSeriesId, structSetId, prescriptionDose);
      if (dbCached) {
        const response = dbCached.dvhData as DVHResponse;
        setMemoryCachedDVH(cacheKey, response);
        const curve = response.curves.find(c => c.roiNumber === roiNumber);
        if (curve) {
          return res.json({
            doseSeriesId,
            structureSetId: structSetId,
            prescriptionDose,
            curve,
          });
        }
      }
    } catch (dbError) {
      logger.warn(`DVH database cache error for single ROI, will compute: ${dbError}`);
    }

    // No cache - compute just this single ROI
    const doseData = await loadDoseDicom(doseSeriesId);
    if (!doseData) {
      return res.status(404).json({ error: 'RT Dose series not found' });
    }

    const structures = await loadStructureSet(structSetId);
    if (!structures) {
      return res.status(404).json({ error: 'Failed to load structure set' });
    }

    const roi = structures.find(s => s.roiNumber === roiNumber);
    if (!roi) {
      return res.status(404).json({ error: `ROI ${roiNumber} not found` });
    }

    const curve = calculateDVHForROI(roi, doseData, prescriptionDose);

    res.json({
      doseSeriesId,
      structureSetId: structSetId,
      prescriptionDose,
      curve,
    });
  } catch (error) {
    logger.error(`DVH calculation error: ${error}`);
    next(error);
  }
});

/**
 * Export helper function for triggering DVH pre-computation from other modules
 * (e.g., when dose data is imported)
 */
export async function triggerDvhPrecompute(
  doseSeriesId: number, 
  prescriptionDose: number = 60
): Promise<void> {
  try {
    const doseSeries = await storage.getSeries(doseSeriesId);
    if (!doseSeries?.studyId) {
      logger.warn(`Cannot precompute DVH: dose series ${doseSeriesId} not found`);
      return;
    }
    
    const structSetId = await findStructureSetForStudy(doseSeries.studyId);
    if (!structSetId) {
      logger.warn(`Cannot precompute DVH: no structure set found for dose series ${doseSeriesId}`);
      return;
    }

    // Check if already cached
    const existing = await storage.getDvhCache(doseSeriesId, structSetId, prescriptionDose);
    if (existing) {
      logger.info(`DVH already pre-computed for dose=${doseSeriesId}, struct=${structSetId}`);
      return;
    }

    // Compute in background (fire and forget)
    logger.info(`Triggering DVH pre-computation for dose=${doseSeriesId}, struct=${structSetId}`);
    computeAndStoreDVH(doseSeriesId, structSetId, prescriptionDose)
      .then(() => logger.info(`DVH pre-computation complete for dose=${doseSeriesId}`))
      .catch(err => logger.error(`DVH pre-computation failed for dose=${doseSeriesId}: ${err.message}`));
  } catch (error) {
    logger.error(`Error triggering DVH pre-compute: ${error}`);
  }
}

export default router;
