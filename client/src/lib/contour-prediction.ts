/**
 * Next Slice Prediction Algorithm for Medical Imaging Contours
 * 
 * This algorithm predicts contours on adjacent slices based on the current slice's contour.
 * It uses anatomical coherence principles - structures typically change gradually between slices.
 */

import { PredictionHistoryManager, type ContourSnapshot, type TrendAnalysis } from './prediction-history-manager';
import {
  refineContourWithImageData,
  type ImageData,
  type RegionCharacteristics
} from './image-aware-prediction';
import { fastSlicePrediction } from "./fast-slice-prediction";
// SAM prediction mode removed - using server-side SAM for AI tool instead

export type PropagationMode = 'conservative' | 'moderate' | 'aggressive';

export interface PredictionParams {
  currentContour: number[]; // Current slice contour points [x,y,z,x,y,z,...]
  currentSlicePosition: number;
  targetSlicePosition: number;
  anatomicalRegion?: 'head' | 'neck' | 'thorax' | 'abdomen' | 'pelvis';
  predictionMode?: 'geometric' | 'sam' | 'simple' | 'adaptive' | 'trend-based' | 'fast-raycast';
  confidenceThreshold?: number; // 0-1, determines when to stop propagating
  historyManager?: PredictionHistoryManager;
  allContours?: Map<number, number[]>; // All contours in the structure by slice position

  // Image-aware refinement (optional)
  imageData?: {
    currentSlice?: ImageData;
    targetSlice?: ImageData;
    referenceSlices?: { contour: number[]; imageData: ImageData }[];
  };
  coordinateTransforms?: {
    worldToPixel: (x: number, y: number) => [number, number];
    pixelToWorld: (x: number, y: number) => [number, number];
    // Optional 3D-aware variants (preferred when available).
    // Many DICOM series require using Z (slice plane) for correct world<->pixel projection.
    worldToPixel3D?: (x: number, y: number, z: number) => [number, number];
    pixelToWorld3D?: (x: number, y: number, z: number) => [number, number, number];
  };
  enableImageRefinement?: boolean;

  // MEM3D tuning parameters (optional)
  mem3dParams?: import('./fast-slice-prediction').PredictionParams;
  spacing?: [number, number, number]; // [x, y, z] spacing in mm
}

export interface PredictionResult {
  predictedContour: number[];
  confidence: number; // 0-1, how confident we are in the prediction
  adjustments: {
    scale: number;
    centerShift: { x: number; y: number };
    deformation: number; // Amount of shape change
  };
  metadata?: {
    method: string;
    historySize: number;
    trendAnalysis?: TrendAnalysis;
    imageRefinement?: {
      applied: boolean;
      edgeSnapped: boolean;
      validated: boolean;
      similarity?: number;
      regionCharacteristics?: RegionCharacteristics;
    };
    fallbackApplied?: boolean;
    notes?: string;
    qualityScore?: number; // Quality assessment from AI models
    used_slices?: number[]; // Slice positions used in prediction
    distance_to_nearest?: number; // Distance to nearest reference slice
  };
}

/**
 * Calculate the centroid of a contour
 */
function calculateCentroid(points: number[]): { x: number; y: number } {
  let sumX = 0, sumY = 0;
  const numPoints = points.length / 3;
  
  for (let i = 0; i < points.length; i += 3) {
    sumX += points[i];
    sumY += points[i + 1];
  }
  
  return {
    x: sumX / numPoints,
    y: sumY / numPoints
  };
}

/**
 * Calculate the area of a contour using the shoelace formula
 */
function calculateContourArea(points: number[]): number {
  let area = 0;
  const n = points.length / 3;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = points[i * 3];
    const yi = points[i * 3 + 1];
    const xj = points[j * 3];
    const yj = points[j * 3 + 1];
    
    area += xi * yj - xj * yi;
  }
  
  return Math.abs(area) / 2;
}

const TWO_PI = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampVector(
  shift: { x: number; y: number },
  limit: number
): { x: number; y: number } {
  const magnitude = Math.sqrt(shift.x * shift.x + shift.y * shift.y);
  if (magnitude <= limit || magnitude === 0) {
    return shift;
  }
  const scale = limit / magnitude;
  return { x: shift.x * scale, y: shift.y * scale };
}

function buildRadialProfile(
  contour: number[],
  centroid: { x: number; y: number },
  sampleCount = 72
): Float64Array {
  const radii = new Float64Array(sampleCount);
  const weights = new Float64Array(sampleCount);

  for (let i = 0; i < contour.length; i += 3) {
    const dx = contour[i] - centroid.x;
    const dy = contour[i + 1] - centroid.y;
    const radius = Math.sqrt(dx * dx + dy * dy);
    if (!Number.isFinite(radius) || radius === 0) continue;

    const angle = Math.atan2(dy, dx);
    const normalized = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
    const position = (normalized / TWO_PI) * sampleCount;
    const idx = Math.floor(position) % sampleCount;
    const nextIdx = (idx + 1) % sampleCount;
    const frac = position - Math.floor(position);

    radii[idx] += radius * (1 - frac);
    weights[idx] += (1 - frac);
    radii[nextIdx] += radius * frac;
    weights[nextIdx] += frac;
  }

  // Fill gaps by linear interpolation using nearest available values
  for (let i = 0; i < sampleCount; i++) {
    if (weights[i] === 0) {
      // Search outward for nearest populated bins
      let left = i;
      let right = i;
      while (weights[left] === 0 && weights[right] === 0) {
        left = (left - 1 + sampleCount) % sampleCount;
        right = (right + 1) % sampleCount;
        if (left === right) break;
      }
      const leftRadius = weights[left] > 0 ? radii[left] / weights[left] : 0;
      const rightRadius = weights[right] > 0 ? radii[right] / weights[right] : leftRadius;
      radii[i] = (leftRadius + rightRadius) / 2;
      weights[i] = 1;
    } else {
      radii[i] /= weights[i];
    }
  }

  // Smooth profile slightly to avoid jitter
  const smoothed = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const prev = (i - 1 + sampleCount) % sampleCount;
    const next = (i + 1) % sampleCount;
    smoothed[i] = (radii[prev] + radii[i] * 2 + radii[next]) / 4;
  }

  return smoothed;
}

function getProfileValue(
  profile: Float64Array,
  angle: number
): number {
  const sampleCount = profile.length;
  if (sampleCount === 0) return 0;
  const normalized = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  const position = (normalized / TWO_PI) * sampleCount;
  const baseIndex = Math.floor(position) % sampleCount;
  const nextIndex = (baseIndex + 1) % sampleCount;
  const frac = position - Math.floor(position);
  return profile[baseIndex] * (1 - frac) + profile[nextIndex] * frac;
}

function smoothContourInPlace(points: number[], iterations = 1, smoothing = 0.2): void {
  if (points.length < 9) return;
  const totalPoints = points.length / 3;
  const buffer = new Array<number>(points.length);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < totalPoints; i++) {
      const prev = (i - 1 + totalPoints) % totalPoints;
      const next = (i + 1) % totalPoints;

      const idx = i * 3;
      const prevIdx = prev * 3;
      const nextIdx = next * 3;

      const avgX = (points[prevIdx] + points[idx] + points[nextIdx]) / 3;
      const avgY = (points[prevIdx + 1] + points[idx + 1] + points[nextIdx + 1]) / 3;

      buffer[idx] = points[idx] * (1 - smoothing) + avgX * smoothing;
      buffer[idx + 1] = points[idx + 1] * (1 - smoothing) + avgY * smoothing;
      buffer[idx + 2] = points[idx + 2]; // Preserve slice position
    }

    for (let i = 0; i < points.length; i++) {
      points[i] = buffer[i];
    }
  }
}

/**
 * Smooth a contour in world coordinates (returns a new array)
 * Uses 5-point Gaussian-like smoothing for better quality
 */
function smoothContourWorldCoords(points: number[], passes: number = 2): number[] {
  if (points.length < 15) return [...points]; // Need at least 5 points
  
  const totalPoints = points.length / 3;
  let result = [...points];
  
  for (let pass = 0; pass < passes; pass++) {
    const smoothed = new Array<number>(points.length);
    
    for (let i = 0; i < totalPoints; i++) {
      const p2 = ((i - 2) + totalPoints) % totalPoints;
      const p1 = ((i - 1) + totalPoints) % totalPoints;
      const n1 = (i + 1) % totalPoints;
      const n2 = (i + 2) % totalPoints;
      
      const idx = i * 3;
      // Gaussian-like weights: [0.1, 0.2, 0.4, 0.2, 0.1]
      smoothed[idx] = 
        result[p2 * 3] * 0.1 + 
        result[p1 * 3] * 0.2 + 
        result[idx] * 0.4 + 
        result[n1 * 3] * 0.2 + 
        result[n2 * 3] * 0.1;
      
      smoothed[idx + 1] = 
        result[p2 * 3 + 1] * 0.1 + 
        result[p1 * 3 + 1] * 0.2 + 
        result[idx + 1] * 0.4 + 
        result[n1 * 3 + 1] * 0.2 + 
        result[n2 * 3 + 1] * 0.1;
      
      smoothed[idx + 2] = result[idx + 2]; // Preserve Z
    }
    
    result = smoothed;
  }
  
  return result;
}

/**
 * Simple prediction: Direct copy with slight scaling based on anatomical region
 */
function simplePrediction(
  currentContour: number[],
  sliceDistance: number,
  targetZ?: number,
  anatomicalRegion?: string
): PredictionResult {
  // Default scaling factors based on typical anatomical changes
  const scalingFactors: Record<string, number> = {
    head: 0.98,    // Head structures shrink slightly superior to inferior
    neck: 1.02,    // Neck structures expand slightly
    thorax: 1.0,   // Thorax relatively stable
    abdomen: 1.01, // Abdomen slight expansion
    pelvis: 0.99   // Pelvis slight contraction
  };
  
  const scaleFactor = anatomicalRegion ? scalingFactors[anatomicalRegion] || 1.0 : 1.0;
  const scaleAdjustment = 1 + (scaleFactor - 1) * Math.abs(sliceDistance) / 5; // Gradual change
  
  const centroid = calculateCentroid(currentContour);
  const predictedContour: number[] = [];
  
  // Apply scaling around centroid
  for (let i = 0; i < currentContour.length; i += 3) {
    const x = currentContour[i];
    const y = currentContour[i + 1];
    
    // Scale points relative to centroid
    const scaledX = centroid.x + (x - centroid.x) * scaleAdjustment;
    const scaledY = centroid.y + (y - centroid.y) * scaleAdjustment;
    
    const sourceZ = currentContour[i + 2];
    const finalZ = targetZ ?? (sourceZ + sliceDistance);
    predictedContour.push(scaledX, scaledY, finalZ);
  }
  
  return {
    predictedContour,
    confidence: Math.max(0, 1 - Math.abs(sliceDistance) * 0.1), // Confidence decreases with distance
    adjustments: {
      scale: scaleAdjustment,
      centerShift: { x: 0, y: 0 },
      deformation: 0
    }
  };
}

/**
 * Adaptive prediction: Considers contour shape changes and applies smooth deformation
 */
function adaptivePrediction(
  currentContour: number[],
  previousContour: number[] | null,
  sliceDistance: number,
  targetZ: number
): PredictionResult {
  if (!previousContour || previousContour.length < 9) {
    return {
      predictedContour: [],
      confidence: 0,
      adjustments: {
        scale: 1,
        centerShift: { x: 0, y: 0 },
        deformation: 0
      },
      metadata: {
        method: 'adaptive',
        historySize: previousContour ? 1 : 0,
        notes: 'Insufficient reference contours for adaptive prediction.'
      }
    };
  }

  const currentCentroid = calculateCentroid(currentContour);
  const prevCentroid = calculateCentroid(previousContour);

  const currentArea = calculateContourArea(currentContour);
  const prevArea = Math.max(calculateContourArea(previousContour), 1e-3);

  const areaChangeRate = (currentArea - prevArea) / prevArea;
  const sign = Math.sign(sliceDistance) || 1;
  const absDistance = Math.max(1, Math.abs(sliceDistance));

  const scaleLimit = Math.min(0.35 * absDistance, 0.55);
  const scaleAdjustment = clamp(1 + areaChangeRate, 1 - scaleLimit, 1 + scaleLimit);

  const centerShiftTrend = {
    x: currentCentroid.x - prevCentroid.x,
    y: currentCentroid.y - prevCentroid.y
  };
  const projectedShift = {
    x: centerShiftTrend.x * sign,
    y: centerShiftTrend.y * sign
  };
  const shiftLimit = Math.max(1.0, 0.6 * absDistance);
  const limitedShift = clampVector(projectedShift, shiftLimit);

  const predictedCentroid = {
    x: currentCentroid.x + limitedShift.x,
    y: currentCentroid.y + limitedShift.y
  };

  const sampleCount = 96;
  const currentProfile = buildRadialProfile(currentContour, currentCentroid, sampleCount);
  const previousProfile = buildRadialProfile(previousContour, prevCentroid, sampleCount);
  const radialTrendProfile = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    radialTrendProfile[i] = currentProfile[i] - previousProfile[i];
  }

  const predictedContour: number[] = [];
  let totalRadialDiff = 0;
  let radiusSum = 0;

  for (let i = 0; i < currentContour.length; i += 3) {
    const x = currentContour[i];
    const y = currentContour[i + 1];

    const dx = x - currentCentroid.x;
    const dy = y - currentCentroid.y;
    const currentRadius = Math.sqrt(dx * dx + dy * dy) || 0.5;
    const angle = Math.atan2(dy, dx);

    const trendDelta = getProfileValue(radialTrendProfile, angle) * sign;
    const targetBaseRadius = currentRadius * scaleAdjustment + trendDelta;

    const minRadius = Math.max(currentRadius * (1 - scaleLimit), currentRadius * 0.6, 0.5);
    const maxRadius = Math.max(currentRadius * (1 + scaleLimit), minRadius + 0.2);
    const predictedRadius = clamp(targetBaseRadius, minRadius, maxRadius);

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    const predictedX = predictedCentroid.x + cosAngle * predictedRadius;
    const predictedY = predictedCentroid.y + sinAngle * predictedRadius;

    predictedContour.push(predictedX, predictedY, targetZ);

    totalRadialDiff += Math.abs(predictedRadius - currentRadius);
    radiusSum += currentRadius;
  }

  smoothContourInPlace(predictedContour, 2, 0.18);

  const predictedArea = calculateContourArea(predictedContour);
  const areaChange = Math.abs(predictedArea - currentArea) / Math.max(currentArea, 1e-3);
  const averageRadius = radiusSum / Math.max(currentContour.length / 3, 1);
  const radialChange = totalRadialDiff / Math.max(radiusSum, 1);
  const shiftMagnitude = Math.sqrt(limitedShift.x * limitedShift.x + limitedShift.y * limitedShift.y);

  const deformation = areaChange + radialChange * 0.5 + shiftMagnitude * 0.02;
  const confidence = clamp(1 - deformation - Math.abs(sliceDistance) * 0.05, 0, 1);

  return {
    predictedContour,
    confidence,
    adjustments: {
      scale: scaleAdjustment,
      centerShift: limitedShift,
      deformation
    },
    metadata: {
      method: 'adaptive-shape',
      historySize: 2,
      notes: 'Shape-aware adaptive prediction with radial trend continuation.'
    }
  };
}

/**
 * Trend-based prediction using history manager
 * Most accurate when we have multiple slices to analyze trends
 */
function trendBasedPrediction(
  historyManager: PredictionHistoryManager,
  currentSlicePosition: number,
  targetSlicePosition: number
): PredictionResult {
  const trend = historyManager.analyzeTrend();
  const currentSnapshot = historyManager.getContour(currentSlicePosition);
  
  if (!currentSnapshot) {
    // Fallback: try to find nearest contour
    const { before, after } = historyManager.getNearestContours(currentSlicePosition);
    const nearestSnapshot = before || after;
    
    if (!nearestSnapshot) {
      return {
        predictedContour: [],
        confidence: 0,
        adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
        metadata: { method: 'trend-based', historySize: 0 }
      };
    }
    
    // Use nearest as current
    return trendBasedPredictionFromSnapshot(nearestSnapshot, targetSlicePosition, trend, historyManager);
  }
  
  return trendBasedPredictionFromSnapshot(currentSnapshot, targetSlicePosition, trend, historyManager);
}

function trendBasedPredictionFromSnapshot(
  snapshot: ContourSnapshot,
  targetSlicePosition: number,
  trend: TrendAnalysis,
  historyManager: PredictionHistoryManager
): PredictionResult {
  const sliceDistance = targetSlicePosition - snapshot.slicePosition;
  const currentContour = snapshot.contour;
  const currentDescriptor = snapshot.descriptor;
  
  // Predict area change
  const predictedAreaChange = trend.areaChangeRate * sliceDistance;
  const scaleFactor = Math.sqrt(1 + predictedAreaChange);
  
  // Predict centroid shift
  const predictedCentroidShift = {
    x: trend.centroidDrift.x * sliceDistance,
    y: trend.centroidDrift.y * sliceDistance
  };
  
  const newCentroid = {
    x: currentDescriptor.centroid.x + predictedCentroidShift.x,
    y: currentDescriptor.centroid.y + predictedCentroidShift.y
  };
  
  // Generate predicted contour
  const predictedContour: number[] = [];
  for (let i = 0; i < currentContour.length; i += 3) {
    const x = currentContour[i];
    const y = currentContour[i + 1];
    
    // Scale around current centroid, then shift to new centroid
    const dx = x - currentDescriptor.centroid.x;
    const dy = y - currentDescriptor.centroid.y;
    
    const scaledX = newCentroid.x + dx * scaleFactor;
    const scaledY = newCentroid.y + dy * scaleFactor;
    
    // Use targetSlicePosition directly instead of z + sliceDistance to avoid floating point accumulation
    predictedContour.push(scaledX, scaledY, targetSlicePosition);
  }
  
  // Calculate confidence using history manager
  const confidence = historyManager.calculateConfidence(snapshot.slicePosition, targetSlicePosition);
  
  return {
    predictedContour,
    confidence,
    adjustments: {
      scale: scaleFactor,
      centerShift: predictedCentroidShift,
      deformation: Math.abs(predictedAreaChange)
    },
    metadata: {
      method: 'trend-based',
      historySize: historyManager.size(),
      trendAnalysis: trend
    }
  };
}

function isProjectionSane(
  contourWorld: number[],
  imageWidth: number,
  imageHeight: number,
  project: (x: number, y: number, z: number) => [number, number],
  samplePoints = 24
): { ok: boolean; inBoundsRatio: number; nanRatio: number } {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 1 || imageHeight <= 1) {
    return { ok: false, inBoundsRatio: 0, nanRatio: 1 };
  }
  if (!contourWorld || contourWorld.length < 9) {
    return { ok: false, inBoundsRatio: 0, nanRatio: 1 };
  }

  const totalPts = Math.max(1, Math.floor(contourWorld.length / 3));
  const step = Math.max(1, Math.floor(totalPts / samplePoints));
  let tested = 0;
  let inBounds = 0;
  let nan = 0;

  for (let i = 0; i < totalPts; i += step) {
    const idx = i * 3;
    const x = contourWorld[idx];
    const y = contourWorld[idx + 1];
    const z = contourWorld[idx + 2];
    const [px, py] = project(x, y, z);
    tested++;

    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      nan++;
      continue;
    }

    // generous bounds (allow slight overshoot)
    if (px >= -2 && px <= imageWidth + 2 && py >= -2 && py <= imageHeight + 2) {
      inBounds++;
    }
  }

  const nanRatio = tested ? nan / tested : 1;
  const inBoundsRatio = tested ? inBounds / tested : 0;

  // If many points are NaN or most points are out of bounds, projection is not trustworthy.
  const ok = nanRatio < 0.2 && inBoundsRatio >= 0.6;
  return { ok, inBoundsRatio, nanRatio };
}

/**
 * SAM-based prediction - DEPRECATED
 * SAM prediction mode has been removed. Use the AI Tumor Tool for SAM segmentation instead.
 * Falls back to geometric prediction.
 */
async function samPrediction(
  currentContour: number[],
  currentSlicePosition: number,
  targetSlicePosition: number,
  _imageData?: {
    currentSlice?: ImageData;
    targetSlice?: ImageData;
  },
  _coordinateTransforms?: {
    worldToPixel: (x: number, y: number) => [number, number];
    pixelToWorld: (x: number, y: number) => [number, number];
    worldToPixel3D?: (x: number, y: number, z: number) => [number, number];
    pixelToWorld3D?: (x: number, y: number, z: number) => [number, number, number];
  }
): Promise<PredictionResult> {
  console.warn('🤖 SAM prediction mode is deprecated. Falling back to geometric prediction. Use AI Tumor Tool for SAM segmentation.');
  
  // Fall back to geometric prediction
  return geometricBasedPrediction(
    currentContour,
    currentSlicePosition,
    targetSlicePosition,
    'moderate'
  );
    };
  }
}

/**
 * Geometric prediction using intensity-based refinement (fast, client-side)
 * Falls back to simple contour copy if pixel data isn't available
 */
async function geometricPrediction(
  currentContour: number[],
  currentSlicePosition: number,
  targetSlicePosition: number,
  _imageData?: {
    currentSlice?: ImageData;
    targetSlice?: ImageData;
  },
  _coordinateTransforms?: {
    worldToPixel: (x: number, y: number) => [number, number];
    pixelToWorld: (x: number, y: number) => [number, number];
    worldToPixel3D?: (x: number, y: number, z: number) => [number, number];
    pixelToWorld3D?: (x: number, y: number, z: number) => [number, number, number];
  },
  _predictionParams?: import('./fast-slice-prediction').PredictionParams
): Promise<PredictionResult> {
  // World-space deterministic fallback: copy contour and move it to target slice.
  // We keep this function as a thin wrapper; the orchestrator will choose
  // more advanced world-space modes when history is available.
  const copiedContour: number[] = [];
  for (let i = 0; i < currentContour.length; i += 3) {
    copiedContour.push(currentContour[i], currentContour[i + 1], targetSlicePosition);
  }
  const smoothed = smoothContourWorldCoords(copiedContour, 2);
  return {
    predictedContour: smoothed,
    confidence: 0.55,
    adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
    metadata: { method: 'geometric_world_copy', historySize: 0, notes: 'World-space copy + smoothing' },
  };
}

async function mem3dPrediction(
  currentContour: number[],
  currentSlicePosition: number,
  targetSlicePosition: number,
  imageData?: {
    currentSlice?: ImageData;
    targetSlice?: ImageData;
  },
  coordinateTransforms?: {
    worldToPixel: (x: number, y: number) => [number, number];
    pixelToWorld: (x: number, y: number) => [number, number];
    worldToPixel3D?: (x: number, y: number, z: number) => [number, number];
    pixelToWorld3D?: (x: number, y: number, z: number) => [number, number, number];
  },
  predictionParams?: import('./fast-slice-prediction').PredictionParams
): Promise<PredictionResult> {
  if (!imageData?.currentSlice || !imageData?.targetSlice || !coordinateTransforms) {
    return {
      predictedContour: [],
      confidence: 0,
      adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
      metadata: { method: 'mem3d_missing_data', historySize: 0 },
    };
  }

  try {
    // Convert world contour to pixel coordinates
    const pixelPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < currentContour.length; i += 3) {
      const x = currentContour[i];
      const y = currentContour[i + 1];
      const z = currentContour[i + 2];
      const [px, py] = coordinateTransforms.worldToPixel3D
        ? coordinateTransforms.worldToPixel3D(x, y, z)
        : coordinateTransforms.worldToPixel(x, y);
      pixelPoints.push({ x: px, y: py });
    }

    // Run fast slice prediction (client-side, <5ms)
    const sliceDistance = targetSlicePosition - currentSlicePosition;
    const predictedPixels = fastSlicePrediction(
      pixelPoints,
      imageData.currentSlice.pixels,
      imageData.targetSlice.pixels,
      imageData.currentSlice.width || 512,
      imageData.currentSlice.height || 512,
      sliceDistance,
      predictionParams
    );

    if (predictedPixels.length === 0) {
      return {
        predictedContour: [],
        confidence: 0,
        adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
        metadata: { method: 'mem3d_no_result', historySize: 0 },
      };
    }

    // Convert back to world coordinates
    const predictedContour: number[] = [];
    for (const p of predictedPixels) {
      if (coordinateTransforms.pixelToWorld3D) {
        const [worldX, worldY, worldZ] = coordinateTransforms.pixelToWorld3D(p.x, p.y, targetSlicePosition);
        predictedContour.push(worldX, worldY, worldZ);
      } else {
        const [worldX, worldY] = coordinateTransforms.pixelToWorld(p.x, p.y);
        predictedContour.push(worldX, worldY, targetSlicePosition);
      }
    }

    return {
      predictedContour,
      confidence: 0.85,
      adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
      metadata: {
        method: 'mem3d_fast_raycast',
        historySize: 0,
        notes: 'Ultra-fast intensity-based ray casting',
      },
    };
  } catch (error: any) {
    console.error('MEM3D fast prediction failed:', error);
    return {
      predictedContour: [],
      confidence: 0,
      adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
      metadata: { method: 'mem3d_failed', historySize: 0, notes: error.message },
    };
  }
}

/**
 * Main prediction function that orchestrates different prediction modes
 */
export async function predictNextSliceContour(params: PredictionParams): Promise<PredictionResult> {
  const {
    currentContour,
    currentSlicePosition,
    targetSlicePosition,
    anatomicalRegion,
    predictionMode = 'adaptive',
    confidenceThreshold = 0.3,
    historyManager,
    allContours,
    imageData,
    coordinateTransforms,
    enableImageRefinement = true
  } = params;
  
  if (!currentContour || currentContour.length < 9) { // Need at least 3 points
    console.warn('🔮 predictNextSliceContour: REJECTED - currentContour invalid', {
      hasContour: !!currentContour,
      contourLength: currentContour?.length || 0,
      currentSlicePosition,
      targetSlicePosition,
      predictionMode
    });
    return {
      predictedContour: [],
      confidence: 0,
      adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
      metadata: { method: 'none', historySize: 0, notes: `Input contour invalid (length: ${currentContour?.length || 0})` }
    };
  }
  
  console.log('🔮 predictNextSliceContour: ACCEPTED - processing', {
    predictionMode,
    contourLength: currentContour.length,
    points: currentContour.length / 3,
    currentSlicePosition,
    targetSlicePosition,
    sliceDistance: targetSlicePosition - currentSlicePosition
  });
  
  const sliceDistance = targetSlicePosition - currentSlicePosition;
  
  let result: PredictionResult;
  const findNearestContour = (): number[] | null => {
    if (!allContours || allContours.size === 0) return null;
    let bestContour: number[] | null = null;
    let bestDist = Infinity;
    allContours.forEach((contourPoints, slicePos) => {
      const dist = Math.abs(slicePos - currentSlicePosition);
      if (dist > 1e-3 && dist < bestDist) {
        bestDist = dist;
        bestContour = contourPoints;
      }
    });
    return bestContour;
  };
  
  // Select prediction method based on mode
  switch (predictionMode) {
    case 'sam':
      // SAM-based prediction using OHIF's ONNX model
      console.log('🤖 Using SAM prediction mode', {
        contourLength: currentContour.length,
        hasImageData: !!imageData,
        hasCurrentSlice: !!imageData?.currentSlice,
        hasTargetSlice: !!imageData?.targetSlice,
        hasTransforms: !!coordinateTransforms,
      });
      try {
        result = await samPrediction(
          currentContour,
          currentSlicePosition,
          targetSlicePosition,
          imageData,
          coordinateTransforms
        );
        console.log('🤖 SAM prediction result:', {
          contourLength: result.predictedContour.length,
          confidence: result.confidence,
          method: result.metadata?.method,
        });
        
        // NO FALLBACK: If SAM fails, return the failed result so user knows SAM didn't work
        if (result.predictedContour.length < 9 || result.metadata?.method?.includes('missing_data') || result.metadata?.method?.includes('failed')) {
          console.error('🤖 SAM FAILED - NO FALLBACK. Result:', result.metadata?.method, result.metadata?.notes);
          // Return empty result with clear error message
          result = {
            predictedContour: [],
            confidence: 0,
            adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
            metadata: {
              method: 'sam_failed',
              historySize: 0,
              notes: `SAM failed: ${result.metadata?.notes || 'unknown error'}. Check console for details.`,
            },
          };
        }
      } catch (samError: any) {
        console.error('🤖 SAM prediction threw error:', samError);
        // NO FALLBACK: Return error result
        result = {
          predictedContour: [],
          confidence: 0,
          adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
          metadata: {
            method: 'sam_error',
            historySize: 0,
            notes: `SAM error: ${samError.message || samError}`,
          },
        };
      }
      break;
      
    case 'geometric':
      // Shape-based prediction: simple copy from nearest reference with smoothing
      // No trend extrapolation - just copy and smooth for reliability
      {
        console.log('🔮 GEO: geometric prediction', {
          currentPoints: currentContour.length / 3,
          sliceDistance: sliceDistance.toFixed(2),
          from: currentSlicePosition.toFixed(2),
          to: targetSlicePosition.toFixed(2)
        });
        
        // Simple copy + smooth - most reliable approach
        const predictedContour: number[] = [];
        for (let i = 0; i < currentContour.length; i += 3) {
          predictedContour.push(
            currentContour[i],
            currentContour[i + 1],
            targetSlicePosition  // Set Z to target slice
          );
        }
        
        // Apply smoothing
        const smoothed = smoothContourWorldCoords(predictedContour, 2);
        
        result = {
          predictedContour: smoothed,
          confidence: Math.max(0.5, 1 - Math.abs(sliceDistance) * 0.05),
          adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
          metadata: { 
            method: 'geometric_copy', 
            historySize: 1, 
            notes: `Copied from slice ${currentSlicePosition.toFixed(2)}`,
            distance_to_nearest: Math.abs(sliceDistance)
          },
        };
        
        console.log('🔮 GEO: result', {
          points: smoothed.length / 3,
          confidence: result.confidence.toFixed(2)
        });
      }
      break;
      
    case 'fast-raycast':
    default:
      // Default: geometric prediction (was called mem3d/fast-raycast)
      result = await geometricPrediction(
        currentContour,
        currentSlicePosition,
        targetSlicePosition,
        imageData,
        coordinateTransforms,
        params.mem3dParams
      );
      break;
  }

  // NO FALLBACK: If prediction failed, log it but don't silently switch to another method
  if (result.predictedContour.length === 0 || result.confidence === 0) {
    console.warn(`${predictionMode} prediction failed - NOT falling back to another method`);
    // Ensure metadata reflects the failure
    if (result.metadata) {
      result.metadata.fallbackApplied = false;
    }
  }
  
  // Apply image-aware refinement if enabled and image data available
  // Skip refinement for fast-raycast (it handles refinement internally)
  if (enableImageRefinement &&
      predictionMode !== 'geometric' &&
      predictionMode !== 'fast-raycast' &&
      imageData?.targetSlice &&
      coordinateTransforms &&
      result.predictedContour.length > 0) {
    
    try {
      // If transforms look untrustworthy for this slice, skip refinement to avoid
      // turning a reasonable contour into garbage.
      const targetWidth = imageData.targetSlice.width || 512;
      const targetHeight = imageData.targetSlice.height || 512;
      const projectForSanity = (x: number, y: number, z: number): [number, number] =>
        coordinateTransforms.worldToPixel3D
          ? coordinateTransforms.worldToPixel3D(x, y, z)
          : coordinateTransforms.worldToPixel(x, y);
      const sanity = isProjectionSane(result.predictedContour, targetWidth, targetHeight, projectForSanity);
      if (!sanity.ok) {
        if (!result.metadata) {
          result.metadata = { method: predictionMode as string, historySize: 0 };
        }
        result.metadata.imageRefinement = { applied: false, edgeSnapped: false, validated: false };
        result.metadata.notes = `${result.metadata.notes || ''} Skipped image refinement (bad projection: inBoundsRatio=${sanity.inBoundsRatio.toFixed(2)}, nanRatio=${sanity.nanRatio.toFixed(2)}).`.trim();
        return result;
      }

      const worldToPixel2D = (x: number, y: number): [number, number] =>
        coordinateTransforms.worldToPixel3D
          ? coordinateTransforms.worldToPixel3D(x, y, targetSlicePosition)
          : coordinateTransforms.worldToPixel(x, y);
      const pixelToWorld2D = (px: number, py: number): [number, number] => {
        if (coordinateTransforms.pixelToWorld3D) {
          const [wx, wy] = coordinateTransforms.pixelToWorld3D(px, py, targetSlicePosition);
          return [wx, wy];
        }
        return coordinateTransforms.pixelToWorld(px, py);
      };

      const { refinedContour, confidence: imageConfidence, metadata: refinementMetadata } = 
        refineContourWithImageData(
          result.predictedContour,
          imageData.referenceSlices || [],
          imageData.targetSlice,
          worldToPixel2D,
          pixelToWorld2D,
          {
            snapToEdges: true,
            validateSimilarity: imageData.referenceSlices && imageData.referenceSlices.length > 0,
            searchRadius: 10,
            edgeThreshold: 50
          }
        );
      
      // Combine geometric and image-based confidence
      result.predictedContour = refinedContour;
      result.confidence = (result.confidence * 0.5) + (imageConfidence * 0.5);
      
      // Add refinement metadata
      if (!result.metadata) {
        result.metadata = { method: predictionMode as string, historySize: 0 };
      }
      result.metadata.imageRefinement = {
        applied: true,
        edgeSnapped: refinementMetadata.edgeSnapped,
        validated: refinementMetadata.validated,
        similarity: refinementMetadata.similarity,
        regionCharacteristics: refinementMetadata.regionCharacteristics
      };
      
    } catch (error) {
      console.warn('Image refinement failed, using geometric prediction only:', error);
      if (!result.metadata) {
        result.metadata = { method: predictionMode as string, historySize: 0 };
      }
      result.metadata.imageRefinement = {
        applied: false,
        edgeSnapped: false,
        validated: false
      };
    }
  }
  
  // Don't return prediction if confidence is too low
  if (result.confidence < confidenceThreshold) {
    return {
      ...result,
      predictedContour: [],
      confidence: 0
    };
  }
  
  return result;
}

/**
 * Predict contours for multiple adjacent slices based on propagation mode
 */
export async function predictMultipleSlices(
  currentContour: number[],
  currentSlicePosition: number,
  mode: PropagationMode = 'moderate',
  params: Partial<PredictionParams> = {}
): Promise<Map<number, PredictionResult>> {
  const predictions = new Map<number, PredictionResult>();
  
  // Determine target slices based on mode
  let targetOffsets: number[] = [];
  let minConfidence = 0.3;
  
  switch (mode) {
    case 'conservative':
      targetOffsets = [-1, 1]; // Only immediate neighbors
      minConfidence = 0.5;
      break;
    case 'moderate':
      targetOffsets = [-2, -1, 1, 2]; // ±1, ±2
      minConfidence = 0.4;
      break;
    case 'aggressive':
      targetOffsets = [-3, -2, -1, 1, 2, 3]; // Limit to ±3 slices
      minConfidence = 0.3;
      break;
  }
  
  // Sort by absolute distance (closest first)
  targetOffsets.sort((a, b) => Math.abs(a) - Math.abs(b));
  
  for (const offset of targetOffsets) {
    const targetPosition = currentSlicePosition + offset;
    
    const prediction = await predictNextSliceContour({
      currentContour,
      currentSlicePosition,
      targetSlicePosition: targetPosition,
      confidenceThreshold: minConfidence,
      ...params
    });
    
    // Only include if confidence meets threshold
    if (prediction.confidence >= minConfidence && prediction.predictedContour.length > 0) {
      predictions.set(targetPosition, prediction);
    } else {
      // Stop propagating in this direction if confidence too low
      if (mode === 'aggressive') {
        // For aggressive mode, stop propagating further in this direction
        const direction = Math.sign(offset);
        if (direction !== 0) {
          // Remove any predictions further in this direction
          const toRemove: number[] = [];
          for (const pos of predictions.keys()) {
            if (Math.sign(pos - currentSlicePosition) === direction && 
                Math.abs(pos - currentSlicePosition) > Math.abs(offset)) {
              toRemove.push(pos);
            }
          }
          toRemove.forEach(pos => predictions.delete(pos));
        }
        break;
      }
    }
  }
  
  return predictions;
}

/**
 * Get suggested propagation mode based on structure characteristics
 */
export function suggestPropagationMode(historyManager?: PredictionHistoryManager): PropagationMode {
  if (!historyManager || historyManager.size() < 2) {
    return 'conservative';
  }
  
  const trend = historyManager.analyzeTrend();
  
  // Use aggressive if structure is stable and consistent
  if (trend.shapeStability > 0.8 && trend.consistency > 0.7) {
    return 'aggressive';
  }
  
  // Use conservative if structure is changing rapidly
  if (trend.shapeStability < 0.5 || Math.abs(trend.areaChangeRate) > 0.15) {
    return 'conservative';
  }
  
  // Default to moderate
  return 'moderate';
}

/**
 * Apply smooth interpolation between two contours
 */
export function interpolateContours(
  contour1: number[],
  contour2: number[],
  slicePosition1: number,
  slicePosition2: number,
  targetSlicePosition: number
): number[] {
  if (contour1.length !== contour2.length) {
    console.warn('Contours have different point counts, using shape-preserving interpolation');
    // Use shape-preserving interpolation when point counts differ
    return interpolateContoursWithResampling(contour1, contour2, slicePosition1, slicePosition2, targetSlicePosition);
  }
  
  const t = (targetSlicePosition - slicePosition1) / (slicePosition2 - slicePosition1);
  
  // Apply easing function to maintain volume better
  // This reduces shrinkage by using a smoother interpolation curve
  const easedT = easeInOutCubic(t);
  
  const interpolatedContour: number[] = [];
  
  for (let i = 0; i < contour1.length; i += 3) {
    const x = contour1[i] + (contour2[i] - contour1[i]) * easedT;
    const y = contour1[i + 1] + (contour2[i + 1] - contour1[i + 1]) * easedT;
    
    // Use targetSlicePosition directly for consistency and to avoid floating point accumulation
    interpolatedContour.push(x, y, targetSlicePosition);
  }
  
  return interpolatedContour;
}

// Easing function to reduce shrinkage during interpolation
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Shape-preserving interpolation with resampling
function interpolateContoursWithResampling(
  contour1: number[],
  contour2: number[],
  slicePosition1: number,
  slicePosition2: number,
  targetSlicePosition: number
): number[] {
  // Calculate centroids (only X,Y - ignore Z)
  const centroid1 = calculateCentroid(contour1);
  const centroid2 = calculateCentroid(contour2);
  
  const t = (targetSlicePosition - slicePosition1) / (slicePosition2 - slicePosition1);
  const easedT = easeInOutCubic(t);
  
  // Interpolate centroid (X,Y only)
  const interpolatedCentroid = {
    x: centroid1.x + (centroid2.x - centroid1.x) * easedT,
    y: centroid1.y + (centroid2.y - centroid1.y) * easedT
  };
  
  // Calculate average radius to maintain area
  const radius1 = calculateAverageRadius2D(contour1, centroid1);
  const radius2 = calculateAverageRadius2D(contour2, centroid2);
  const interpolatedRadius = radius1 + (radius2 - radius1) * easedT;
  
  // Generate interpolated contour based on the larger contour's shape
  const largerContour = contour1.length >= contour2.length ? contour1 : contour2;
  const largerCentroid = contour1.length >= contour2.length ? centroid1 : centroid2;
  
  const interpolatedContour: number[] = [];
  
  for (let i = 0; i < largerContour.length; i += 3) {
    // Get direction from centroid
    const dx = largerContour[i] - largerCentroid.x;
    const dy = largerContour[i + 1] - largerCentroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    
    // Normalize and scale by interpolated radius
    const x = interpolatedCentroid.x + (dx / dist) * interpolatedRadius;
    const y = interpolatedCentroid.y + (dy / dist) * interpolatedRadius;
    
    // Use targetSlicePosition directly for consistency
    interpolatedContour.push(x, y, targetSlicePosition);
  }
  
  return interpolatedContour;
}

function calculateAverageRadius2D(contour: number[], centroid: { x: number; y: number }): number {
  let sumRadius = 0;
  const pointCount = contour.length / 3;
  
  for (let i = 0; i < contour.length; i += 3) {
    const dx = contour[i] - centroid.x;
    const dy = contour[i + 1] - centroid.y;
    sumRadius += Math.sqrt(dx * dx + dy * dy);
  }
  
  return sumRadius / pointCount;
}
