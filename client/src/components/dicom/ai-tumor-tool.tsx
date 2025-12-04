/**
 * AI Tumor Tool - Single-Click Brain Metastasis Segmentation
 *
 * This tool uses a U-Net model trained on T2 FLAIR MRI for brain metastases.
 * User clicks once on the tumor, and the AI propagates through 3D volume.
 * 
 * Workflow:
 * 1. User clicks on fused MRI view
 * 2. Extract MRI volume data
 * 3. Run U-Net segmentation on MRI
 * 4. Transform contours from MRI space to CT space using registration matrix
 * 5. Create contours on the CT series
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supersegClient } from '@/lib/superseg-client';
import { log } from '@/lib/log';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Loader2, MousePointer2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDicomWorkerManager } from '@/lib/dicom-worker-manager';
import { gaussianSmoothContour as smoothContour } from '@/lib/contour-smooth-simple';

const parseDICOMVector = (value: unknown, expectedLength?: number): number[] | null => {
  if (Array.isArray(value)) {
    const parsed = value
      .map((component) => Number(component))
      .filter((component) => Number.isFinite(component));
    if (parsed.length === 0) return null;
    if (expectedLength && parsed.length < expectedLength) return null;
    return parsed;
  }
  if (typeof value === 'string') {
    const parsed = value
      .split('\\')
      .map((component) => Number(component.trim()))
      .filter((component) => Number.isFinite(component));
    if (parsed.length === 0) return null;
    if (expectedLength && parsed.length < expectedLength) return null;
    return parsed;
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getSlicePositionFromImage = (image: any): number | null => {
  const candidates = [
    image?.parsedSliceLocation,
    image?.parsedZPosition,
    image?.sliceLocation,
  ];
  for (const candidate of candidates) {
    const numeric = toNumber(candidate);
    if (numeric !== null) return numeric;
  }
  const positionVector =
    parseDICOMVector(image?.imagePosition, 3)
    || parseDICOMVector(image?.metadata?.imagePositionPatient, 3);
  if (positionVector && positionVector.length >= 3) {
    return positionVector[2];
  }
  return null;
};

const getPixelSpacingFromImage = (image: any): [number, number] | null => {
  const spacingVector =
    parseDICOMVector(image?.pixelSpacing, 2)
    || parseDICOMVector(image?.metadata?.pixelSpacing, 2);
  if (spacingVector && spacingVector.length >= 2) {
    const rowSpacing = Number(spacingVector[0]);
    const columnSpacing = Number(spacingVector[1]);
    if (Number.isFinite(rowSpacing) && Number.isFinite(columnSpacing)) {
      return [rowSpacing, columnSpacing];
    }
  }
  return null;
};

const dotProduct = (a: number[], b: number[]): number => {
  return (
    (a[0] || 0) * (b[0] || 0)
    + (a[1] || 0) * (b[1] || 0)
    + (a[2] || 0) * (b[2] || 0)
  );
};

const crossProduct = (a: number[], b: number[]): number[] => [
  (a[1] || 0) * (b[2] || 0) - (a[2] || 0) * (b[1] || 0),
  (a[2] || 0) * (b[0] || 0) - (a[0] || 0) * (b[2] || 0),
  (a[0] || 0) * (b[1] || 0) - (a[1] || 0) * (b[0] || 0),
];

const normalizeVector = (vec: number[]): number[] | null => {
  const length = Math.hypot(vec[0] || 0, vec[1] || 0, vec[2] || 0);
  if (!Number.isFinite(length) || length === 0) return null;
  return vec.map((component) => component / length);
};

const getOrientationVectors = (
  image: any,
): { rowDir: number[]; colDir: number[]; normal: number[] } | null => {
  const orientation =
    parseDICOMVector(image?.imageOrientationPatient, 6)
    || parseDICOMVector(image?.imageOrientation, 6)
    || parseDICOMVector(image?.metadata?.imageOrientationPatient, 6)
    || parseDICOMVector(image?.metadata?.imageOrientation, 6);

  if (!orientation || orientation.length < 6) {
    return null;
  }

  const rowDir = normalizeVector(orientation.slice(0, 3));
  const colDir = normalizeVector(orientation.slice(3, 6));
  if (!rowDir || !colDir) {
    return null;
  }

  const normalRaw = crossProduct(rowDir, colDir);
  const normal = normalizeVector(normalRaw) ?? normalRaw;

  return { rowDir, colDir, normal };
};

const getImagePosition = (image: any): number[] | null => (
  parseDICOMVector(image?.imagePosition, 3)
  || parseDICOMVector(image?.imagePositionPatient, 3)
  || parseDICOMVector(image?.metadata?.imagePositionPatient, 3)
  || parseDICOMVector(image?.metadata?.imagePosition, 3)
);

const worldToPixelIndices = (
  point: { x: number; y: number; z: number },
  image: any,
): { column: number; row: number; sliceOffsetMm: number } | null => {
  const imagePosition = getImagePosition(image);
  const spacing = getPixelSpacingFromImage(image);
  const orientation = getOrientationVectors(image);

  if (!imagePosition || !spacing || !orientation) {
    return null;
  }

  const diff = [
    point.x - imagePosition[0],
    point.y - imagePosition[1],
    point.z - imagePosition[2],
  ];

  const [rowSpacing, columnSpacing] = spacing;
  // DICOM: rowDir is X axis (direction along which columns increase)
  //        colDir is Y axis (direction along which rows increase)
  // So: column index uses rowDir, row index uses colDir
  const column = dotProduct(diff, orientation.rowDir) / columnSpacing;
  const row = dotProduct(diff, orientation.colDir) / rowSpacing;
  const sliceOffsetMm = dotProduct(diff, orientation.normal);

  if (!Number.isFinite(column) || !Number.isFinite(row)) {
    return null;
  }

  return { column, row, sliceOffsetMm };
};

const projectWorldToPixelNaive = (
  point: { x: number; y: number; z: number },
  image: any,
): { column: number; row: number } | null => {
  const imagePosition = getImagePosition(image);
  const spacing = getPixelSpacingFromImage(image);

  if (!imagePosition || !spacing) {
    return null;
  }

  const [rowSpacing, columnSpacing] = spacing;

  const column = (point.x - imagePosition[0]) / columnSpacing;
  const row = (point.y - imagePosition[1]) / rowSpacing;

  if (!Number.isFinite(column) || !Number.isFinite(row)) {
    return null;
  }

  return { column, row };
};

const pixelToWorldPoint = (
  pixel: { column: number; row: number },
  image: any,
): [number, number, number] | null => {
  const imagePosition = getImagePosition(image);
  const spacing = getPixelSpacingFromImage(image);
  const orientation = getOrientationVectors(image);

  if (!imagePosition || !spacing || !orientation) {
    return null;
  }

  const [rowSpacing, columnSpacing] = spacing;

  // DICOM pixel-to-world transform:
  // world = imagePosition + rowDir * columnSpacing * column + colDir * rowSpacing * row
  const worldX =
    imagePosition[0]
    + orientation.rowDir[0] * columnSpacing * pixel.column
    + orientation.colDir[0] * rowSpacing * pixel.row;
  const worldY =
    imagePosition[1]
    + orientation.rowDir[1] * columnSpacing * pixel.column
    + orientation.colDir[1] * rowSpacing * pixel.row;
  const worldZ =
    imagePosition[2]
    + orientation.rowDir[2] * columnSpacing * pixel.column
    + orientation.colDir[2] * rowSpacing * pixel.row;

  if (
    !Number.isFinite(worldX)
    || !Number.isFinite(worldY)
    || !Number.isFinite(worldZ)
  ) {
    return null;
  }

  return [worldX, worldY, worldZ];
};

const applyRegistrationMatrix = (
  matrix: number[] | null | undefined,
  point: [number, number, number],
): [number, number, number] => {
  if (!Array.isArray(matrix) || matrix.length < 12) {
    return point;
  }

  const [x, y, z] = point;

  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3],
    matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7],
    matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11],
  ];
};

const invertRegistrationMatrix = (
  matrix: number[] | null | undefined,
): number[] | null => {
  if (!Array.isArray(matrix) || matrix.length < 12) {
    return null;
  }

  const r11 = matrix[0];
  const r12 = matrix[1];
  const r13 = matrix[2];
  const t1 = matrix[3];

  const r21 = matrix[4];
  const r22 = matrix[5];
  const r23 = matrix[6];
  const t2 = matrix[7];

  const r31 = matrix[8];
  const r32 = matrix[9];
  const r33 = matrix[10];
  const t3 = matrix[11];

  const det =
    r11 * (r22 * r33 - r23 * r32)
    - r12 * (r21 * r33 - r23 * r31)
    + r13 * (r21 * r32 - r22 * r31);

  if (!Number.isFinite(det) || Math.abs(det) < 1e-8) {
    return null;
  }

  const invDet = 1 / det;

  const m00 = (r22 * r33 - r23 * r32) * invDet;
  const m01 = -(r12 * r33 - r13 * r32) * invDet;
  const m02 = (r12 * r23 - r13 * r22) * invDet;

  const m10 = -(r21 * r33 - r23 * r31) * invDet;
  const m11 = (r11 * r33 - r13 * r31) * invDet;
  const m12 = -(r11 * r23 - r13 * r21) * invDet;

  const m20 = (r21 * r32 - r22 * r31) * invDet;
  const m21 = -(r11 * r32 - r12 * r31) * invDet;
  const m22 = (r11 * r22 - r12 * r21) * invDet;

  const invT0 = -(m00 * t1 + m01 * t2 + m02 * t3);
  const invT1 = -(m10 * t1 + m11 * t2 + m12 * t3);
  const invT2 = -(m20 * t1 + m21 * t2 + m22 * t3);

  return [m00, m01, m02, invT0, m10, m11, m12, invT1, m20, m21, m22, invT2];
};

interface AITumorToolProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  brushSize: number;
  selectedStructure: {
    structureName: string;
    color: number[];
    roiNumber: number;
  } | null | undefined;
  currentSlicePosition: number;
  zoom: number;
  panX: number;
  panY: number;
  imageMetadata?: any;
  onContourUpdate?: (payload: any) => void;
  dicomImages: any[]; // All DICOM images in the series (metadata only)
  currentIndex: number;
  ctTransform: { scale: number; offsetX: number; offsetY: number };
  worldToCanvas: (worldX: number, worldY: number) => [number, number];
  canvasToWorld: (canvasX: number, canvasY: number) => [number, number];
  imageCacheRef: React.RefObject<Map<string, any>>; // Cache with actual pixel data
  
  // Fusion-specific props
  secondarySeriesId?: number | null;
  registrationMatrix?: number[] | null;
  onShowPrimarySeries?: () => void;
  smoothOutput?: boolean; // Whether to apply 2x smoothing to output
  onSegmentTrigger?: () => void; // External trigger for Generate button
  onClearTrigger?: () => void; // External trigger for Clear button
}

export function AITumorTool({
  canvasRef,
  isActive,
  selectedStructure,
  currentSlicePosition,
  imageMetadata,
  onContourUpdate,
  dicomImages,
  currentIndex,
  worldToCanvas,
  canvasToWorld,
  imageCacheRef,
  secondarySeriesId,
  registrationMatrix,
  onShowPrimarySeries,
  smoothOutput = false,
  onSegmentTrigger,
  onClearTrigger,
}: AITumorToolProps) {
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [clickPoint, setClickPoint] = useState<{
    x: number;
    y: number;
    z: number;
    sliceIndex?: number;
    pixelX?: number;
    pixelY?: number;
    canvasX?: number;
    canvasY?: number;
  } | null>(null);
  const { toast } = useToast();
  
  // Store handleSegment and handleClear in refs so they can be accessed in event listeners
  const handleSegmentRef = useRef<(() => Promise<void>) | null>(null);
  const handleClearRef = useRef<(() => void) | null>(null);

  // Check service availability when tool is activated
  useEffect(() => {
    if (isActive && serviceAvailable === null) {
      checkServiceHealth();
    }
  }, [isActive]);

  const checkServiceHealth = async () => {
    try {
      await supersegClient.checkHealth();
      setServiceAvailable(true);
      log.info('[ai-tumor] SuperSeg service is available');
    } catch (error) {
      setServiceAvailable(false);
      log.error('[ai-tumor] SuperSeg service is not available', error);
      toast({
        title: 'AI Service Unavailable',
        description: 'SuperSeg service is not running. Please start it first.',
        variant: 'destructive',
      });
    }
  };

  // Handle canvas click
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (!isActive || !canvasRef.current || isProcessing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Convert canvas to world coordinates
    const [worldX, worldY] = canvasToWorld(canvasX, canvasY);

    log.info(`[ai-tumor] Clicked at canvas (${canvasX}, ${canvasY}) -> world (${worldX}, ${worldY})`);

    // Calculate pixel coordinates from world coordinates using current image metadata
    let pixelX: number | undefined;
    let pixelY: number | undefined;

    if (imageMetadata) {
      const orientedPixel = worldToPixelIndices(
        { x: worldX, y: worldY, z: currentSlicePosition },
        imageMetadata
      );
      if (orientedPixel) {
        pixelX = orientedPixel.column;
        pixelY = orientedPixel.row;
        log.info(`[ai-tumor] World to pixel: (${worldX.toFixed(1)}, ${worldY.toFixed(1)}) -> (${pixelX.toFixed(1)}, ${pixelY.toFixed(1)})`);
      }
    }

    const newClickPoint = {
      x: worldX,
      y: worldY,
      z: currentSlicePosition,
      pixelX,
      pixelY,
      sliceIndex: currentIndex,
      canvasX,
      canvasY,
    };

    setClickPoint(newClickPoint);
    log.info(`[ai-tumor] Click point set: ${JSON.stringify(newClickPoint)}`);

    // Visual feedback - draw click marker
    drawClickMarker(canvasX, canvasY);

    // Show toast confirmation
    toast({
      title: 'Click Registered',
      description: `Point: (${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${currentSlicePosition.toFixed(1)})`,
      duration: 2000,
    });

  }, [isActive, canvasRef, isProcessing, canvasToWorld, currentSlicePosition, currentIndex, imageMetadata, toast]);

  // Draw click marker on canvas
  const drawClickMarker = (canvasX: number, canvasY: number) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw a magenta circle at click point
    ctx.save();
    ctx.strokeStyle = '#FF00FF';
    ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(canvasX - 15, canvasY);
    ctx.lineTo(canvasX + 15, canvasY);
    ctx.moveTo(canvasX, canvasY - 15);
    ctx.lineTo(canvasX, canvasY + 15);
    ctx.stroke();
    
    ctx.restore();
  };

  // Attach/detach canvas click listener and custom event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) {
      console.log('🧠 AITumorTool: Not attaching listeners - canvas:', !!canvas, 'isActive:', isActive);
      return;
    }

    console.log('🧠 AITumorTool: Attaching event listeners to canvas');

    // Listen for toolbar button triggers
    const handleSegmentEvent = () => {
      console.log('🧠 AITumorTool: Received ai-tumor-segment event');
      if (handleSegmentRef.current) {
        console.log('🧠 AITumorTool: Calling handleSegment');
        handleSegmentRef.current();
      } else {
        console.error('🧠 AITumorTool: handleSegmentRef.current is null!');
      }
    };
    
    const handleClearEvent = () => {
      console.log('🧠 AITumorTool: Received ai-tumor-clear event');
      if (handleClearRef.current) {
        handleClearRef.current();
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('ai-tumor-segment', handleSegmentEvent);
    canvas.addEventListener('ai-tumor-clear', handleClearEvent);
    
    console.log('🧠 AITumorTool: Event listeners attached successfully');
    
    return () => {
      console.log('🧠 AITumorTool: Removing event listeners');
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('ai-tumor-segment', handleSegmentEvent);
      canvas.removeEventListener('ai-tumor-clear', handleClearEvent);
    };
  }, [isActive, canvasRef, handleCanvasClick]);

  // Run segmentation
  const handleSegment = async () => {
    if (!clickPoint || !selectedStructure || !imageMetadata) {
      toast({
        title: 'Cannot Segment',
        description: 'Please select a structure and click on the tumor',
        variant: 'destructive',
      });
      return;
    }

    if (serviceAvailable === false) {
      toast({
        title: 'Service Unavailable',
        description: 'SuperSeg service is not running',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      log.info('[ai-tumor] 🧠 Starting tumor segmentation...');
      
      // Determine which series to extract volume from
      const isFusionMode = secondarySeriesId != null;
      const volumeSeriesImages = isFusionMode 
        ? await getSecondarySeriesImages(secondarySeriesId!)
        : dicomImages;

      if (!volumeSeriesImages || volumeSeriesImages.length === 0) {
        throw new Error('No images available for segmentation');
      }

      log.info(`[ai-tumor] Extracting volume from ${volumeSeriesImages.length} images (fusion: ${isFusionMode})`);
      
      // Check modality - SuperSeg model was trained on T2-FLAIR MRI
      const firstImage = volumeSeriesImages[0];
      const modality = firstImage?.modality || firstImage?.metadata?.modality || 'UNKNOWN';
      const seriesDescription = (firstImage?.seriesDescription || firstImage?.metadata?.seriesDescription || '').toLowerCase();
      
      console.log(`🧠 Image modality: ${modality}, series: "${seriesDescription}"`);
      
      if (modality !== 'MR') {
        toast({
          title: 'Warning: Not MRI',
          description: `This model is trained on T2-FLAIR MRI. Current modality: ${modality}`,
          variant: 'destructive',
        });
      }
      
      if (!seriesDescription.includes('flair') && !seriesDescription.includes('t2')) {
        console.warn(`⚠️ Series "${seriesDescription}" may not be T2-FLAIR. Model performance may be poor.`);
        toast({
          title: 'Warning: May not be T2-FLAIR',
          description: `Model expects T2-FLAIR MRI. Current series: ${seriesDescription || 'Unknown'}`,
        });
      }

      // Extract 3D volume
      const {
        volume,
        spacing,
        dimensions,
        sortedImages,
      } = await extractVolumeData(volumeSeriesImages);

      log.info(`[ai-tumor] Volume extracted: ${dimensions.width}x${dimensions.height}x${dimensions.depth}`);
      log.info(`[ai-tumor] Spacing: ${spacing.join(', ')}`);

      // Map click point to volume coordinates
      const currentPrimaryImage = dicomImages?.[currentIndex] ?? null;
      const currentSecondaryImage = null;

      const volumeClickPoint = isFusionMode
        ? mapClickToSecondaryVolume(clickPoint, sortedImages, dimensions, currentSecondaryImage)
        : mapClickToPrimaryVolume(clickPoint, sortedImages, dimensions, currentPrimaryImage);

      log.info(`[ai-tumor] Volume click point: ${volumeClickPoint.join(', ')}`);
      console.log(`🧠 Sending to AI: click_point=[${volumeClickPoint.join(', ')}], volume_shape=[${dimensions.height}, ${dimensions.width}, ${dimensions.depth}]`);

      // Sample pixel values AROUND the click point to verify data integrity
      const [clickY, clickX, clickZ] = volumeClickPoint;
      const sampleRadius = 5;
      let clickMin = Infinity, clickMax = -Infinity, clickZeros = 0, clickTotal = 0;
      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
          const y = clickY + dy;
          const x = clickX + dx;
          if (y >= 0 && y < dimensions.height && x >= 0 && x < dimensions.width && clickZ >= 0 && clickZ < dimensions.depth) {
            const val = volume[y]?.[x]?.[clickZ] ?? 0;
            if (val === 0) clickZeros++;
            if (val < clickMin) clickMin = val;
            if (val > clickMax) clickMax = val;
            clickTotal++;
          }
        }
      }
      console.log(`🧠 Pixel values at CLICK LOCATION (${clickY},${clickX},${clickZ}) ±${sampleRadius}: min=${clickMin}, max=${clickMax}, zeros=${clickZeros}/${clickTotal}`);
      
      // CRITICAL DEBUG: Check if the mapped coordinates actually point to the tumor
      const clickPixelValue = volume[clickY]?.[clickX]?.[clickZ] ?? -999;
      console.log(`🧠 ⚠️ COORDINATE VERIFICATION: volume[${clickY}][${clickX}][${clickZ}] = ${clickPixelValue}`);
      console.log(`🧠   If this value is LOW (near 0) but you clicked on BRIGHT tumor, coordinates are WRONG!`);
      console.log(`🧠   Tumor pixels should be HIGH values (>300 for MRI)`);
      
      if (clickMin === 0 && clickMax === 0) {
        console.error(`🧠 CRITICAL: All pixels at click location are ZERO - you clicked on black background or data is wrong!`);
      } else {
        console.log(`🧠 ✅ Volume data looks valid at click location - sending to AI...`);
      }

      // Sample a few more locations to verify volume integrity
      const midY = Math.floor(dimensions.height / 2);
      const midX = Math.floor(dimensions.width / 2);
      let centerMin = Infinity, centerMax = -Infinity;
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const val = volume[midY + dy]?.[midX + dx]?.[clickZ] ?? 0;
          if (val < centerMin) centerMin = val;
          if (val > centerMax) centerMax = val;
        }
      }
      console.log(`🧠 Volume at CENTER of slice ${clickZ}: min=${centerMin}, max=${centerMax}`);

      // Call SuperSeg API
      const result = await supersegClient.segment({
        volume,
        click_point: volumeClickPoint as [number, number, number],
        spacing,
        slice_axis: 'last', // Volume is (H, W, D)
      });

      // Validate result
      if (!result || !result.mask) {
        throw new Error('Invalid response from SuperSeg service - no mask returned');
      }

      log.info(`[ai-tumor] Segmentation complete: ${result.total_voxels} voxels, confidence ${result.confidence}`);
      log.info(`[ai-tumor] Slices with tumor: ${result.slices_with_tumor?.join(', ')}`);
      log.info(`[ai-tumor] Mask dimensions: ${result.mask?.length}x${result.mask?.[0]?.length}x${result.mask?.[0]?.[0]?.length}`);

      // Find first non-zero voxel in returned mask to verify AI output
      let firstY = -1, firstX = -1, firstZ = -1;
      if (result.mask && Array.isArray(result.mask) && result.mask.length > 0) {
        for (let y = 0; y < result.mask.length && firstY === -1; y++) {
          if (result.mask[y] && Array.isArray(result.mask[y])) {
            for (let x = 0; x < result.mask[y].length; x++) {
              if (result.mask[y][x] && Array.isArray(result.mask[y][x])) {
                for (let z = 0; z < result.mask[y][x].length; z++) {
                  if (result.mask[y][x][z] > 0) {
                    firstY = y; firstX = x; firstZ = z;
                    break;
                  }
                }
              }
              if (firstY !== -1) break;
            }
          }
        }
      }
      console.log(`🧠 AI returned mask - first non-zero voxel at (Y=${firstY}, X=${firstX}, Z=${firstZ})`);
      console.log(`🧠 Volume center would be at (Y=${Math.floor(dimensions.height/2)}, X=${Math.floor(dimensions.width/2)}, Z=${Math.floor(dimensions.depth/2)})`);
      console.log(`🧠 ⚠️ LOCATION CHECK: Click was at [${volumeClickPoint.join(', ')}], AI predicted at [${firstY}, ${firstX}, ${firstZ}]`);
      
      const clickDistY = Math.abs(firstY - volumeClickPoint[0]);
      const clickDistX = Math.abs(firstX - volumeClickPoint[1]);
      const clickDistZ = Math.abs(firstZ - volumeClickPoint[2]);
      const totalDist = Math.sqrt(clickDistY*clickDistY + clickDistX*clickDistX + clickDistZ*clickDistZ);
      
      if (totalDist > 50) {
        console.error(`🧠 ❌ MAJOR PROBLEM: Prediction is ${totalDist.toFixed(0)} pixels away from click! Expected near [${volumeClickPoint.join(', ')}]`);
      } else {
        console.log(`🧠 ✅ Prediction is ${totalDist.toFixed(0)} pixels from click - reasonable`);
      }

      if (result.total_voxels > 0) {
        let minY = dimensions.height;
        let maxY = 0;
        let minX = dimensions.width;
        let maxX = 0;
        let minZ = dimensions.depth;
        let maxZ = 0;

        for (let z = 0; z < dimensions.depth; z++) {
          for (let y = 0; y < dimensions.height; y++) {
            for (let x = 0; x < dimensions.width; x++) {
              if (result.mask[y]?.[x]?.[z]) {
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (z < minZ) minZ = z;
                if (z > maxZ) maxZ = z;
              }
            }
          }
        }

        log.info(`[ai-tumor] Mask bounding box: Y=[${minY}, ${maxY}], X=[${minX}, ${maxX}], Z=[${minZ}, ${maxZ}]`);
        console.log(`🧠 Mask bounding box: Y=[${minY}, ${maxY}], X=[${minX}, ${maxX}], Z=[${minZ}, ${maxZ}]`);
      }

      if (result.total_voxels === 0) {
        toast({
          title: 'No Tumor Found',
          description: 'No tumor detected at the clicked location',
          variant: 'destructive',
        });
        return;
      }

      // Transpose mask from (H, W, D) to (D, H, W) format that handleApply3DMask expects
      // IMPORTANT: The server returns mask[y][x][z] where y=row, x=column
      log.info(`[ai-tumor] Transposing mask from (H=${dimensions.height}, W=${dimensions.width}, D=${dimensions.depth}) to (D, H, W) format...`);
      const maskDHW: number[][][] = [];
      for (let z = 0; z < dimensions.depth; z++) {
        const sliceMask: number[][] = [];
        for (let y = 0; y < dimensions.height; y++) {
          const row: number[] = [];
          for (let x = 0; x < dimensions.width; x++) {
            // Server mask is [row][column][slice] = [y][x][z]
            row.push(result.mask[y]?.[x]?.[z] || 0);
          }
          sliceMask.push(row);
        }
        maskDHW.push(sliceMask);
      }

      log.info(`[ai-tumor] Transposed mask shape: ${maskDHW.length}x${maskDHW[0]?.length}x${maskDHW[0]?.[0]?.length}`);

      // Verify transpose correctness by checking first non-zero voxel in transposed mask
      let transposeFirstZ = -1, transposeFirstY = -1, transposeFirstX = -1;
      for (let z = 0; z < maskDHW.length && transposeFirstZ === -1; z++) {
        for (let y = 0; y < maskDHW[z].length; y++) {
          for (let x = 0; x < maskDHW[z][y].length; x++) {
            if (maskDHW[z][y][x] > 0) {
              transposeFirstZ = z; transposeFirstY = y; transposeFirstX = x;
              break;
            }
          }
          if (transposeFirstZ !== -1) break;
        }
      }
      console.log(`🧠 After transpose: first non-zero voxel at slice=${transposeFirstZ}, y=${transposeFirstY}, x=${transposeFirstX}`);
      console.log(`🧠 This should match viewer slice ${transposeFirstZ} at pixel (${transposeFirstX}, ${transposeFirstY})`);
      
      // CRITICAL: Check if there's a coordinate mismatch between model output and display
      console.log(`🧠 🔍 COORDINATE SYSTEM CHECK:`);
      console.log(`🧠   User clicked at: [y=${volumeClickPoint[0]}, x=${volumeClickPoint[1]}, z=${volumeClickPoint[2]}]`);
      console.log(`🧠   Model predicted at: [y=${firstY}, x=${firstX}, z=${firstZ}]`);
      console.log(`🧠   After transpose shows at: slice=${transposeFirstZ}, pixel=(${transposeFirstX}, ${transposeFirstY})`);
      console.log(`🧠   If these don't align with your click, there's a COORDINATE TRANSFORM BUG`);

      // Send mask to parent using apply_3d_mask action
      if (onContourUpdate) {
        // Include source images so handler can map mask slices to world positions
        const payload = {
          action: 'apply_3d_mask',
          structureId: selectedStructure.roiNumber,
          mask: maskDHW,
          confidence: result.confidence,
          sourceImages: sortedImages, // Images the mask was created from (sorted order)
          isFusionMode, // Whether mask is from secondary series
          smoothOutput, // Whether to apply double smoothing
        };

        log.info(`[ai-tumor] Calling onContourUpdate with payload (${volumeSeriesImages.length} source images, fusion: ${isFusionMode}, smooth: ${smoothOutput})`);
        log.info(`[ai-tumor] Payload keys: ${Object.keys(payload).join(', ')}`);
        log.info(`[ai-tumor] Action field: "${payload.action}"`);
        log.info(`[ai-tumor] Structure ID: ${payload.structureId}`);

        onContourUpdate(payload);

        log.info(`[ai-tumor] onContourUpdate called successfully`);

        toast({
          title: 'Segmentation Complete',
          description: `Generated ${result.slices_with_tumor.length} slices with ${result.total_voxels} voxels (${Math.round(result.confidence * 100)}% confidence)`,
        });

        // If in fusion mode, switch back to primary (CT) view to show results
        if (isFusionMode && onShowPrimarySeries) {
          setTimeout(() => {
            onShowPrimarySeries();
          }, 500);
        }
      } else {
        log.warn(`[ai-tumor] onContourUpdate not available`);
      }

      // Clear click point
      setClickPoint(null);

    } catch (error: any) {
      log.error('[ai-tumor] Segmentation failed: ' + (error?.message || String(error)));
      toast({
        title: 'Segmentation Failed',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Get secondary series images for fusion mode
  const getSecondarySeriesImages = async (seriesId: number): Promise<any[]> => {
    try {
      const response = await fetch(`/api/series/${seriesId}/images`);
      if (!response.ok) throw new Error('Failed to fetch secondary series images');
      const data = await response.json();
      // API returns array directly, not wrapped in {images: [...]}
      const images = Array.isArray(data) ? data : (data.images || []);
      log.info(`[ai-tumor] Fetched ${images.length} secondary series images`, 'ai-tumor');
      return images;
    } catch (error: any) {
      log.error('[ai-tumor] Failed to get secondary series images: ' + (error?.message || String(error)));
      return [];
    }
  };

  // Extract 3D volume from DICOM images
  const extractVolumeData = async (images: any[]): Promise<{
    volume: number[][][];
    spacing: [number, number, number];
    dimensions: { width: number; height: number; depth: number };
    sortedImages: any[];
  }> => {
    // Sort images by slice location (Z position)
    const sortedImages = [...images].sort((a, b) => {
      const posA = getSlicePositionFromImage(a);
      const posB = getSlicePositionFromImage(b);
      if (posA != null && posB != null) return posA - posB;
      // Fallback to instance number if no position
      const instA = toNumber(a.instanceNumber) ?? 0;
      const instB = toNumber(b.instanceNumber) ?? 0;
      return instA - instB;
    });

    console.log(`🧠 Building volume from ${sortedImages.length} slices`);
    if (sortedImages.length > 0) {
      const first = sortedImages[0];
      const last = sortedImages[sortedImages.length - 1];
      console.log(`🧠 First slice: z=${getSlicePositionFromImage(first)}, instance=${first.instanceNumber}`);
      console.log(`🧠 Last slice: z=${getSlicePositionFromImage(last)}, instance=${last.instanceNumber}`);
    }

    const depth = sortedImages.length;
    let width = 0;
    let height = 0;
    const volume: number[][][] = [];
    const volumeImageMap: any[] = []; // Track which images were successfully added

    // Check for missing slices before processing
    const missingSlices: Array<{ index: number; sopInstanceUID: string | null }> = [];
    for (let z = 0; z < depth; z++) {
      const img = sortedImages[z];
      if (!img) {
        missingSlices.push({ index: z, sopInstanceUID: null });
        continue;
      }
      const cacheKey = img.sopInstanceUID || img.SOPInstanceUID;
      if (!cacheKey) {
        missingSlices.push({ index: z, sopInstanceUID: null });
        continue;
      }
      const cachedImage = imageCacheRef.current?.get(cacheKey);
      if (!cachedImage || !cachedImage.data) {
        missingSlices.push({ index: z, sopInstanceUID: cacheKey });
      }
    }

    if (missingSlices.length > 0) {
      console.log(`🧠 Pre-loading ${missingSlices.length}/${depth} uncached slices...`);
      toast({
        title: 'Loading Volume Data',
        description: `Loading ${missingSlices.length} slices... This may take a moment.`,
      });
      
      // Load missing slices using DICOM worker (same approach as working-viewer)
      const workerManager = getDicomWorkerManager();
      let loadedCount = 0;
      
      for (const { index, sopInstanceUID } of missingSlices) {
        if (!sopInstanceUID) {
          log.error(`[ai-tumor] Slice ${index} has no sopInstanceUID`);
          continue;
        }
        
        try {
          const response = await fetch(`/api/images/${sopInstanceUID}`);
          if (!response.ok) {
            log.error(`[ai-tumor] Failed to fetch slice ${index}: HTTP ${response.status}`);
            continue;
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const imageData = await workerManager.parseDicomImage(arrayBuffer);
          
          if (imageData && imageData.data) {
            imageCacheRef.current?.set(sopInstanceUID, imageData);
            loadedCount++;
            if (loadedCount % 10 === 0) {
              console.log(`🧠 Loaded ${loadedCount}/${missingSlices.length} slices...`);
            }
          } else {
            log.error(`[ai-tumor] Failed to parse slice ${index}`);
          }
        } catch (error) {
          log.error(`[ai-tumor] Error loading slice ${index}: ${error}`);
        }
      }
      
      console.log(`🧠 ✓ Pre-loaded ${loadedCount}/${missingSlices.length} slices. Cache size: ${imageCacheRef.current?.size ?? 0}`);
      
      if (loadedCount < missingSlices.length) {
        const stillMissing = missingSlices.length - loadedCount;
        throw new Error(`Failed to load ${stillMissing} slices. Check console for details.`);
      }
    }

    for (let z = 0; z < depth; z++) {
      const img = sortedImages[z];

      if (!img) {
        log.warn(`[ai-tumor] Missing image at index ${z}`);
        continue;
      }

      let pixelData: Uint16Array | Uint8Array | Int16Array | Float32Array;
      let sliceWidth: number;
      let sliceHeight: number;

      // Cache is stored with sopInstanceUID as the key - prioritize that
      const cacheKey = img.sopInstanceUID || img.SOPInstanceUID;
      if (!cacheKey) {
        log.error(`[ai-tumor] Image at index ${z} has no sopInstanceUID (id: ${img.id})`);
        continue;
      }

      const cachedImage = imageCacheRef.current?.get(cacheKey);

      if (!cachedImage || !cachedImage.data) {
        log.error(`[ai-tumor] No cached data for slice ${z}/${depth} (sopInstanceUID: ${cacheKey}) even after pre-loading. Please view all slices first.`);
        throw new Error(`Failed to load pixel data for slice ${z+1}/${depth}. Missing cache entry for sopInstanceUID: ${cacheKey}`);
      }

      // Use cached data
      pixelData = cachedImage.data;
      sliceWidth = cachedImage.columns || cachedImage.width || 512;
      sliceHeight = cachedImage.rows || cachedImage.height || 512;

      // Validate pixel data
      if (!pixelData || pixelData.length === 0) {
        log.error(`[ai-tumor] Cached image ${cacheKey} has empty pixel data`);
        continue;
      }

      const expectedPixels = sliceWidth * sliceHeight;
      if (pixelData.length < expectedPixels) {
        log.error(`[ai-tumor] Cached image ${cacheKey} has insufficient pixel data: ${pixelData.length} < ${expectedPixels}`);
        continue;
      }

      width = sliceWidth ?? width;
      height = sliceHeight ?? height;
      const effectiveWidth = width || sliceWidth || 0;
      const effectiveHeight = height || sliceHeight || 0;

      if (!effectiveWidth || !effectiveHeight) {
        log.error(`[ai-tumor] Missing image dimensions for slice ${z}`);
        continue;
      }

      // Get DICOM rescale parameters for proper intensity scaling
      const rescaleSlope = toNumber(img.rescaleSlope) ?? 1.0;
      const rescaleIntercept = toNumber(img.rescaleIntercept) ?? 0.0;
      
      // Log rescale params for first slice to verify
      if (z === 0) {
        console.log(`🧠 DICOM Rescale: slope=${rescaleSlope}, intercept=${rescaleIntercept}`);
      }

      // Convert to 2D array with rescale transformation applied
      const slice: number[][] = [];
      for (let y = 0; y < effectiveHeight; y++) {
        const row: number[] = [];
        for (let x = 0; x < effectiveWidth; x++) {
          const idx = y * effectiveWidth + x;
          const rawValue = pixelData[idx] || 0;
          // Apply DICOM rescale: real_value = raw_value * slope + intercept
          const scaledValue = rawValue * rescaleSlope + rescaleIntercept;
          row.push(scaledValue);
        }
        slice.push(row);
      }
      volume.push(slice);
      volumeImageMap.push(img); // Track successful addition
    }

    // Validate that we have slices
    const actualDepth = volume.length;
    if (actualDepth === 0) {
      throw new Error('No valid slices found in volume. All slices may be missing from cache.');
    }

    if (actualDepth < depth) {
      log.warn(`[ai-tumor] Volume built with ${actualDepth}/${depth} slices. Some slices were skipped.`);
    }

    // Check pixel data integrity BEFORE transpose/downsample - sample from CENTER not corner
    // Use actual volume depth, not sortedImages.length, since slices may have been skipped
    let minVal = Infinity, maxVal = -Infinity, zeroCount = 0, totalCount = 0;
    const midZ = Math.floor(actualDepth / 2);
    const midY = Math.floor(height / 2);
    const midX = Math.floor(width / 2);
    const sampleRadius = 30;

    // Validate indices before accessing
    if (midZ >= 0 && midZ < actualDepth && volume[midZ]) {
      // Sample center region of middle slice
      for (let y = midY - sampleRadius; y < midY + sampleRadius && y < height; y++) {
        if (y < 0 || y >= volume[midZ].length) continue;
        for (let x = midX - sampleRadius; x < midX + sampleRadius && x < width; x++) {
          if (x < 0 || x >= volume[midZ][y]?.length) continue;
          const val = volume[midZ][y][x] ?? 0;
          if (val === 0) zeroCount++;
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
          totalCount++;
        }
      }
      console.log(`🧠 Volume pixel check (CENTER of slice ${midZ}/${actualDepth}, ${sampleRadius*2}x${sampleRadius*2} region): min=${minVal}, max=${maxVal}, zeros=${zeroCount}/${totalCount}`);
      if (minVal === maxVal || (minVal === 0 && maxVal === 0)) {
        console.error(`🧠 CRITICAL: All CENTER pixels are ${minVal} - data is blank or wrong!`);
        // Check if this is a rescale issue
        if (minVal === 0 && maxVal === 0) {
          console.error(`🧠 Possible causes: 1) All pixels are actually zero, 2) Rescale parameters are wrong, 3) Wrong cache entry`);
        }
      } else {
        console.log(`🧠 Pixel data looks valid - ${Math.round((1 - zeroCount/totalCount) * 100)}% non-zero in center region`);
      }
    } else {
      log.warn(`[ai-tumor] Cannot check pixel integrity - invalid slice index ${midZ} (volume depth: ${actualDepth})`);
    }

    // Transpose to (H, W, D) format (no downsampling to preserve fidelity)
    // Use actualDepth instead of depth since some slices may have been skipped
    const volumeHWD: number[][][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[][] = [];
      for (let x = 0; x < width; x++) {
        const col: number[] = [];
        for (let z = 0; z < actualDepth; z++) {
          if (volume[z] && volume[z][y] && volume[z][y][x] !== undefined) {
            col.push(volume[z][y][x]);
          } else {
            // Fill with zero if slice was skipped
            col.push(0);
          }
        }
        row.push(col);
      }
      volumeHWD.push(row);
    }

    // Calculate spacing - use volumeImageMap which only contains successfully loaded images
    if (volumeImageMap.length === 0) {
      throw new Error('No images available for volume extraction');
    }

    const pixelSpacing =
      getPixelSpacingFromImage(sortedImages[0]) ?? [1, 1];

    let zSpacing = 1;
    const zPositions = sortedImages
      .map((img) => getSlicePositionFromImage(img))
      .filter((pos): pos is number => pos != null);
    if (zPositions.length >= 2) {
      let total = 0;
      let count = 0;
      for (let i = 1; i < zPositions.length; i++) {
        const diff = Math.abs(zPositions[i] - zPositions[i - 1]);
        if (Number.isFinite(diff) && diff > 1e-6) {
          total += diff;
          count += 1;
        }
      }
      if (count > 0) {
        zSpacing = total / count;
      }
    } else {
      const fallbackThickness = toNumber(sortedImages[0]?.sliceThickness);
      if (fallbackThickness !== null) {
        zSpacing = fallbackThickness;
      }
    }

    const spacing: [number, number, number] = [
      zSpacing,
      pixelSpacing[0] ?? 1,
      pixelSpacing[1] ?? 1,
    ];

    return {
      volume: volumeHWD,
      spacing,
      dimensions: { width, height, depth },
      sortedImages,
    };
  };

  // Map click point to primary volume coordinates
  const getImageUniqueKey = (image: any): string | null => {
    if (!image) return null;
    return (
      image.sopInstanceUID
      || image.SOPInstanceUID
      || image.id
      || image.imageId
      || image.imageid
      || image.seriesInstanceUid
      || image.instanceNumber
      || null
    );
  };

  const mapClickToPrimaryVolume = (
    click: { x: number; y: number; z: number; pixelX?: number; pixelY?: number; sliceIndex?: number },
    sortedImages: any[],
    dims: { width: number; height: number; depth: number },
    currentImage: any | null | undefined
  ): [number, number, number] => {
    // Find the slice index corresponding to the click z position
    let sliceIndex = sortedImages.findIndex((img) => {
      const zPos = getSlicePositionFromImage(img);
      return zPos != null && Math.abs(zPos - click.z) < 1.0;
    });

    let fallbackIndex = Math.floor(sortedImages.length / 2);

    if (currentImage) {
      const currentKey = getImageUniqueKey(currentImage);
      if (currentKey != null) {
        const matchedIndex = sortedImages.findIndex((img) => getImageUniqueKey(img) === currentKey);
        if (matchedIndex >= 0) {
          fallbackIndex = matchedIndex;
          if (sliceIndex < 0) {
            sliceIndex = matchedIndex;
          }
        }
      }
    }

    if (sliceIndex < 0 && Number.isInteger(click.sliceIndex)) {
      fallbackIndex = Math.max(0, Math.min(sortedImages.length - 1, click.sliceIndex!));
    }

    const z = sliceIndex >= 0
      ? sliceIndex
      : Math.max(0, Math.min(sortedImages.length - 1, fallbackIndex));
    
    // Get the image metadata for this slice
    const sliceImage = sortedImages[z];
    if (!sliceImage) {
      // Fallback to center of image
      return [Math.floor(dims.height / 2), Math.floor(dims.width / 2), z];
    }

    let pixelX: number | null = null;
    let pixelY: number | null = null;

    if (Number.isFinite(click.pixelX) && Number.isFinite(click.pixelY)) {
      pixelX = Math.round(click.pixelX!);
      pixelY = Math.round(click.pixelY!);
      log.info(
        `[ai-tumor] Using canvas-derived pixel: (${click.pixelX?.toFixed(1)}, ${click.pixelY?.toFixed(1)}) → downsampled (${pixelX}, ${pixelY})`,
      );
    }

    if (pixelX === null || pixelY === null) {
      // Fallback to DICOM orientation metadata if available
      const orientedPixel = worldToPixelIndices(click, sliceImage);
      if (orientedPixel) {
        pixelX = Math.round(orientedPixel.column);
        pixelY = Math.round(orientedPixel.row);

        log.info(
          `[ai-tumor] Orientation fallback: world(${click.x.toFixed(1)}, ${click.y.toFixed(1)}, ${click.z.toFixed(1)}) → pixel(${pixelX}, ${pixelY}) (downsampled)`,
        );
      }
    }

    if (pixelX === null || pixelY === null) {
      log.warn('[ai-tumor] Unable to determine click pixel, using image center');
      pixelX = Math.floor(dims.width / 2);
      pixelY = Math.floor(dims.height / 2);
    }

    // Clamp to valid range
    const x = Math.max(0, Math.min(dims.width - 1, pixelX));
    const y = Math.max(0, Math.min(dims.height - 1, pixelY));

    log.info(`[ai-tumor] Final pixel coordinates: x=${x}, y=${y}, z=${z}`);
    console.log(`🧠 CRITICAL CHECK - Mapped click to volume position:`);
    console.log(`🧠   World: (${click.x.toFixed(1)}, ${click.y.toFixed(1)}, ${click.z.toFixed(1)})`);
    console.log(`🧠   Pixel: column=${pixelX}, row=${pixelY}`);
    console.log(`🧠   Final: [y=${y}, x=${x}, z=${z}] for ${dims.height}x${dims.width}x${dims.depth} volume`);
    console.log(`🧠   AI will receive: click_point=[${y}, ${x}, ${z}]`);

    return [y, x, z]; // SuperSeg expects [y, x, z]
  };

  // Map click point to secondary (MRI) volume coordinates
  const mapClickToSecondaryVolume = (
    click: { x: number; y: number; z: number; pixelX?: number; pixelY?: number; sliceIndex?: number },
    secondaryImagesSorted: any[],
    dims: { width: number; height: number; depth: number },
    currentSecondaryImage: any | null | undefined
  ): [number, number, number] => {
    let targetPoint = click;

    if (registrationMatrix) {
      const inverseMatrix = invertRegistrationMatrix(registrationMatrix);
      if (inverseMatrix) {
        const [mriX, mriY, mriZ] = applyRegistrationMatrix(
          inverseMatrix,
          [click.x, click.y, click.z],
        );
        targetPoint = { x: mriX, y: mriY, z: mriZ };
        log.info(
          `[ai-tumor] Secondary: transformed CT world (${click.x.toFixed(1)}, ${click.y.toFixed(1)}, ${click.z.toFixed(1)}) → MRI world (${mriX.toFixed(1)}, ${mriY.toFixed(1)}, ${mriZ.toFixed(1)})`,
        );
      } else {
        log.warn('[ai-tumor] Secondary: registration matrix not invertible, using CT coordinates');
      }
    }

    // Find the slice index
    let sliceIndex = secondaryImagesSorted.findIndex((img) => {
      const zPos = getSlicePositionFromImage(img);
      return zPos != null && Math.abs(zPos - targetPoint.z) < 1.0;
    });

    let fallbackIndex = Math.floor(secondaryImagesSorted.length / 2);

    if (currentSecondaryImage) {
      const currentKey = getImageUniqueKey(currentSecondaryImage);
      if (currentKey != null) {
        const matchedIdx = secondaryImagesSorted.findIndex((img) => getImageUniqueKey(img) === currentKey);
        if (matchedIdx >= 0) {
          fallbackIndex = matchedIdx;
          if (sliceIndex < 0) {
            sliceIndex = matchedIdx;
          }
        }
      }
    }

    if (sliceIndex < 0 && Number.isInteger(click.sliceIndex)) {
      fallbackIndex = Math.max(0, Math.min(secondaryImagesSorted.length - 1, click.sliceIndex!));
    }

    const z = sliceIndex >= 0
      ? sliceIndex
      : Math.max(0, Math.min(secondaryImagesSorted.length - 1, fallbackIndex));
    
    // Get the image metadata for this slice
    const sliceImage = secondaryImagesSorted[z];
    if (!sliceImage) {
      // Fallback to center
      return [Math.floor(dims.height / 2), Math.floor(dims.width / 2), z];
    }

    let pixelX: number | null = null;
    let pixelY: number | null = null;

    if (Number.isFinite(click.pixelX) && Number.isFinite(click.pixelY)) {
      pixelX = Math.round(click.pixelX!);
      pixelY = Math.round(click.pixelY!);
      log.info(
        `[ai-tumor] Secondary: Using canvas-derived pixel (${click.pixelX?.toFixed(1)}, ${click.pixelY?.toFixed(1)}) → downsampled (${pixelX}, ${pixelY})`,
      );
    }

    if (pixelX === null || pixelY === null) {
      const orientedPixel = worldToPixelIndices(targetPoint, sliceImage);
      if (orientedPixel) {
        pixelX = Math.round(orientedPixel.column);
        pixelY = Math.round(orientedPixel.row);
        log.info(
          `[ai-tumor] Secondary: Orientation fallback → pixel(${pixelX}, ${pixelY}) (downsampled)`,
        );
      }
    }

    if (pixelX === null || pixelY === null) {
      log.warn('[ai-tumor] Secondary: Unable to project click, using center');
      pixelX = Math.floor(dims.width / 2);
      pixelY = Math.floor(dims.height / 2);
    }
    
    // Clamp to valid range
    const x = Math.max(0, Math.min(dims.width - 1, pixelX));
    const y = Math.max(0, Math.min(dims.height - 1, pixelY));

    log.info(`[ai-tumor] Secondary final: (${x}, ${y}, ${z})`);

    return [y, x, z];
  };

  // Convert 3D binary mask to contour polygons per slice
  const convertMaskToContours = (
    mask: number[][][],
    images: any[],
    dims: { width: number; height: number; depth: number }
  ): Record<string, number[][][]> => {
    const contours: Record<string, number[][][]> = {};
    
    try {
      log.info(`[ai-tumor] convertMaskToContours: processing ${dims.depth} slices`);

      // Transpose mask from (H, W, D) to (D, H, W) for slice iteration
      for (let z = 0; z < dims.depth; z++) {
        const sliceMask: number[][] = [];
        for (let y = 0; y < dims.height; y++) {
          const row: number[] = [];
          for (let x = 0; x < dims.width; x++) {
            row.push(mask[y]?.[x]?.[z] || 0);
          }
          sliceMask.push(row);
        }

        // Count pixels in this slice
        const pixelCount = sliceMask.flat().filter(p => p > 0).length;
        
        if (pixelCount > 0) {
          log.info(`[ai-tumor] Slice ${z} has ${pixelCount} tumor pixels, extracting contours...`);
          
          // Extract contours from this slice using marching squares
          const sliceContours = extractContoursFromMask(sliceMask);
          
          log.info(`[ai-tumor] Slice ${z} generated ${sliceContours.length} contours with ${sliceContours.reduce((sum, c) => sum + c.length, 0)} total points`);
          
          if (sliceContours.length > 0) {
            const img = images[z];
            const slicePosition = img?.imagePosition?.[2] || img?.sliceLocation || z;
            contours[slicePosition.toString()] = sliceContours;
            log.info(`[ai-tumor] Added contours for slice position ${slicePosition}`);
          }
        }
      }

      log.info(`[ai-tumor] convertMaskToContours complete: ${Object.keys(contours).length} slices`);
    } catch (error: any) {
      log.error(`[ai-tumor] convertMaskToContours failed: ${error.message}`);
    }

    return contours;
  };

  // Extract contours from binary mask using marching squares (simplified)
  const extractContoursFromMask = (mask: number[][]): number[][][] => {
    const contours: number[][][] = [];
    const height = mask.length;
    const width = mask[0]?.length || 0;

    // Find all connected components
    const visited = Array(height).fill(0).map(() => Array(width).fill(false));
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x] > 0 && !visited[y][x]) {
          const contour = traceContour(mask, visited, x, y);
          if (contour.length >= 3) {
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  };

  // Trace contour boundary (simplified boundary following)
  const traceContour = (
    mask: number[][],
    visited: boolean[][],
    startX: number,
    startY: number
  ): number[][] => {
    const contour: number[][] = [];
    const height = mask.length;
    const width = mask[0].length;

    // Flood fill to find component, then extract boundary
    const stack: [number, number][] = [[startX, startY]];
    const component: [number, number][] = [];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[y][x] || mask[y][x] === 0) continue;

      visited[y][x] = true;
      component.push([x, y]);

      // 4-connectivity
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Extract boundary points (simplified - just use component boundary)
    const boundarySet = new Set<string>();
    for (const [x, y] of component) {
      // Check if on boundary (has at least one empty neighbor)
      const neighbors = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
      ];
      
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || mask[ny][nx] === 0) {
          boundarySet.add(`${x},${y}`);
          break;
        }
      }
    }

    // Convert to array of [x, y] points
    for (const key of boundarySet) {
      const [x, y] = key.split(',').map(Number);
      contour.push([x, y]);
    }

    return contour;
  };

  // Transform contours from MRI space to CT space
  const transformContoursToCtSpace = (
    mriContours: Record<string, number[][][]>,
    regMatrix: number[],
    mriImages: any[],
    ctImages: any[]
  ): Record<string, number[][][]> => {
    log.info('[ai-tumor] 🐟 FUSION: Transforming MRI contours to CT space');
    
    const ctContours: Record<string, number[][][]> = {};

    // Registration matrix is 4x4 row-major
    // Transform: CT_world = M * MRI_world
    
    for (const [mriSlicePos, sliceContours] of Object.entries(mriContours)) {
      for (const contour of sliceContours) {
        const transformedContour: number[][] = [];

        for (const [x, y] of contour) {
          // Convert MRI pixel to world coordinates using orientation-aware transform
          const mriImage = mriImages.find((img) => (
            Math.abs((img.imagePosition?.[2] || img.sliceLocation) - parseFloat(mriSlicePos)) < 0.01
          ));

          if (!mriImage) continue;

          const mriWorld = pixelToWorldPoint({ column: x, row: y }, mriImage);
          if (!mriWorld) continue;

          // Apply registration matrix to map from MRI to CT space
          const [ctWorldX, ctWorldY, ctWorldZ] = applyRegistrationMatrix(regMatrix, mriWorld);

          transformedContour.push([ctWorldX, ctWorldY, ctWorldZ]);
        }

        if (transformedContour.length >= 3) {
          // Add to nearest CT slice based on transformed world Z
          const ctSliceTargetZ = transformedContour[0]?.[2] ?? parseFloat(mriSlicePos);
          const nearestCtSlice = ctImages.reduce((prev, curr) => {
            const prevZ = prev.imagePosition?.[2] ?? prev.sliceLocation ?? ctSliceTargetZ;
            const currZ = curr.imagePosition?.[2] ?? curr.sliceLocation ?? ctSliceTargetZ;
            const prevDist = Math.abs(prevZ - ctSliceTargetZ);
            const currDist = Math.abs(currZ - ctSliceTargetZ);
            return currDist < prevDist ? curr : prev;
          });

          const ctSlicePos = (nearestCtSlice.imagePosition?.[2] || nearestCtSlice.sliceLocation).toString();
          if (!ctContours[ctSlicePos]) {
            ctContours[ctSlicePos] = [];
          }

          // Store XY only to match legacy format
          const contourXY = transformedContour.map(([ctX, ctY]) => [ctX, ctY]);
          ctContours[ctSlicePos].push(contourXY);
        }
      }
    }

    log.info(`[ai-tumor] Transformed to ${Object.keys(ctContours).length} CT slices`);

    return ctContours;
  };

  // Clear click point
  const handleClear = () => {
    setClickPoint(null);
    // Trigger canvas redraw to remove marker
    if (canvasRef.current) {
      const event = new Event('render');
      canvasRef.current.dispatchEvent(event);
    }
  };
  
  // Update refs for external access
  handleSegmentRef.current = handleSegment;
  handleClearRef.current = handleClear;

  // UI is now rendered inline in the contour toolbar
  // This component only handles the logic (click handling, segmentation)
  return null;
}
