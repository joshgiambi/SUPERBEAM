export interface DICOMSeries {
  id: number;
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  // Optional linkage populated by callers when combining study+series
  studyId?: number;
  seriesNumber?: number;
  imageCount: number;
  sliceThickness?: string;
  frameOfReferenceUID?: string | null;
  images: DICOMImage[];
}

export interface DICOMImage {
  id: number;
  sopInstanceUID: string;
  instanceNumber?: number;
  filePath: string;
  fileName: string;
  windowCenter?: string;
  windowWidth?: string;
}

export interface DICOMStudy {
  id: number;
  studyInstanceUID: string;
  patientName?: string;
  patientID?: string;
  studyDate?: string;
  studyDescription?: string;
  series: DICOMSeries[];
}

export interface WindowLevel {
  window: number;
  level: number;
}

export const WINDOW_LEVEL_PRESETS: Record<string, WindowLevel> = {
  'Soft Tissue': { window: 400, level: 40 },
  'Lung': { window: 1500, level: -600 },
  'Bone': { window: 1800, level: 400 },
  'Brain': { window: 80, level: 40 },
  'Liver': { window: 150, level: 30 },
  'Mediastinum': { window: 350, level: 50 },
  'Full Range': { window: 4096, level: 1024 },
  // MRI presets
  'MRI Brain T1': { window: 600, level: 300 },
  'MRI Brain T2': { window: 2000, level: 1000 },
  'MRI Brain FLAIR': { window: 1800, level: 900 },
  'MRI Spine': { window: 1200, level: 600 },
  'MRI Auto': { window: 2000, level: 1000 }, // Good default for most MRI
};

export function isDICOMFile(file: File): boolean {
  // Check file extension
  const validExtensions = ['.dcm', '.dicom', '.ima', '.img'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  // Files without extension might still be DICOM (common in medical imaging)
  const hasNoExtension = fileName.indexOf('.') === -1;
  
  // Also check for numeric filenames (common DICOM pattern)
  const isNumericFilename = /^\d+$/.test(file.name);
  
  // Accept if has valid extension, no extension, or is numeric filename
  return hasValidExtension || hasNoExtension || isNumericFilename;
}

export function createImageId(sopInstanceUID: string): string {
  return `wadouri:/api/dicom/${sopInstanceUID}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown';
  
  try {
    // DICOM dates are in YYYYMMDD format
    if (dateString.length === 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      return date.toLocaleDateString();
    }
    
    return new Date(dateString).toLocaleDateString();
  } catch (error) {
    return dateString;
  }
}

export function getModalityDisplayName(modality: string): string {
  const modalityNames: Record<string, string> = {
    'CT': 'Computed Tomography',
    'MR': 'Magnetic Resonance',
    'PT': 'Positron Emission Tomography',
    'NM': 'Nuclear Medicine',
    'US': 'Ultrasound',
    'XA': 'X-Ray Angiography',
    'RF': 'Radiofluoroscopy',
    'DX': 'Digital Radiography',
    'CR': 'Computed Radiography',
    'MG': 'Mammography',
    'OT': 'Other',
  };
  
  return modalityNames[modality] || modality;
}

export function sortImagesByInstance(images: DICOMImage[]): DICOMImage[] {
  return [...images].sort((a, b) => {
    const aInstance = a.instanceNumber || 0;
    const bInstance = b.instanceNumber || 0;
    return aInstance - bInstance;
  });
}

export function calculateWindowLevel(windowCenter: string, windowWidth: string): WindowLevel {
  const center = parseFloat(windowCenter) || 40;
  const width = parseFloat(windowWidth) || 400;

  return {
    level: center,
    window: width
  };
}

// ============================================================================
// 4DCT (4-Dimensional CT) Utility Functions
// ============================================================================

/**
 * Regular expressions for identifying 4DCT phase series
 * Matches patterns like:
 * - "4D 2.0 B30f 0 - 90  TRIGGER_DELAY 60%"
 * - "Phase 10%"
 * - "CT 4D 0%"
 * - "Resp 30%"
 */
const FOUR_DCT_PATTERNS = [
  /TRIGGER_DELAY\s*(\d+)%/i,           // TRIGGER_DELAY XX%
  /(?:^|[\s_-])(\d+)%\s*$/,            // Ends with XX%
  /phase\s*(\d+)%/i,                    // Phase XX%
  /(?:4D|4-D|4DCT)[^%]*?(\d+)%/i,      // 4D/4DCT with XX%
  /resp(?:iratory)?\s*(\d+)%/i,        // Respiratory XX%
  /gated?\s*(\d+)%/i,                  // Gated XX%
];

/**
 * Pattern to extract base description by removing the phase percentage
 */
const PHASE_REMOVAL_PATTERNS = [
  /\s*TRIGGER_DELAY\s*\d+%\s*/gi,
  /\s*Phase\s*\d+%\s*/gi,
  /\s*\d+%\s*$/gi,
];

/**
 * Check if a series is a 4DCT phase based on its description
 * @param seriesDescription - The series description to check
 * @returns True if this appears to be a 4DCT phase
 */
export function is4DCTSeries(seriesDescription: string | null | undefined): boolean {
  if (!seriesDescription) return false;
  return FOUR_DCT_PATTERNS.some(pattern => pattern.test(seriesDescription));
}

/**
 * Extract the phase percentage from a 4DCT series description
 * @param seriesDescription - The series description
 * @returns Phase percentage (0-100) or null if not found
 */
export function extract4DCTPhasePercentage(seriesDescription: string | null | undefined): number | null {
  if (!seriesDescription) return null;
  
  for (const pattern of FOUR_DCT_PATTERNS) {
    const match = seriesDescription.match(pattern);
    if (match && match[1]) {
      const percentage = parseInt(match[1], 10);
      if (percentage >= 0 && percentage <= 100) {
        return percentage;
      }
    }
  }
  return null;
}

/**
 * Get the base description for grouping 4DCT phases
 * Removes the phase percentage part to allow grouping related phases
 * @param seriesDescription - The series description
 * @returns Base description for grouping
 */
export function get4DCTBaseDescription(seriesDescription: string | null | undefined): string {
  if (!seriesDescription) return '';
  
  let base = seriesDescription;
  for (const pattern of PHASE_REMOVAL_PATTERNS) {
    base = base.replace(pattern, ' ');
  }
  // Normalize whitespace
  return base.trim().replace(/\s+/g, ' ');
}

/**
 * Interface for a grouped 4DCT collection
 */
export interface FourDCTGroup {
  /** Unique identifier for this 4DCT group (based on base description) */
  groupId: string;
  /** Base description (e.g., "4D 2.0 B30f 0 - 90") */
  baseDescription: string;
  /** Display name for the group */
  displayName: string;
  /** Array of phase series, sorted by phase percentage */
  phases: Array<{
    series: DICOMSeries;
    phasePercentage: number;
  }>;
  /** Total number of phases (typically 10 for respiratory 4DCT) */
  phaseCount: number;
}

/**
 * Group 4DCT series into collections by their base description
 * @param allSeries - Array of all series to scan
 * @returns Array of 4DCT groups and array of non-4DCT series
 */
export function group4DCTSeries(allSeries: DICOMSeries[]): {
  fourDCTGroups: FourDCTGroup[];
  nonFourDCTSeries: DICOMSeries[];
} {
  const fourDCTMap = new Map<string, FourDCTGroup>();
  const nonFourDCTSeries: DICOMSeries[] = [];
  
  for (const series of allSeries) {
    // Only check CT modality
    if (series.modality !== 'CT') {
      nonFourDCTSeries.push(series);
      continue;
    }
    
    const phasePercentage = extract4DCTPhasePercentage(series.seriesDescription);
    
    if (phasePercentage !== null) {
      const baseDescription = get4DCTBaseDescription(series.seriesDescription);
      const groupId = `4dct-${baseDescription.toLowerCase().replace(/\s+/g, '-')}`;
      
      if (!fourDCTMap.has(groupId)) {
        fourDCTMap.set(groupId, {
          groupId,
          baseDescription,
          displayName: `4DCT: ${baseDescription || 'Unnamed'}`,
          phases: [],
          phaseCount: 0,
        });
      }
      
      const group = fourDCTMap.get(groupId)!;
      group.phases.push({ series, phasePercentage });
      group.phaseCount = group.phases.length;
    } else {
      nonFourDCTSeries.push(series);
    }
  }
  
  // Sort phases within each group by percentage
  for (const group of fourDCTMap.values()) {
    group.phases.sort((a, b) => a.phasePercentage - b.phasePercentage);
  }
  
  return {
    fourDCTGroups: Array.from(fourDCTMap.values()),
    nonFourDCTSeries,
  };
}

/**
 * Get phase label for display (e.g., "0%", "10%", "20%")
 * @param phasePercentage - The phase percentage
 * @returns Formatted phase label
 */
export function formatPhaseLabel(phasePercentage: number): string {
  return `${phasePercentage}%`;
}

/**
 * Interface for a grouped 4DCT collection from fusion secondary descriptors
 */
export interface FourDCTFusionGroup {
  /** Unique identifier for this 4DCT group */
  groupId: string;
  /** Base description (e.g., "4D 2.0 B30f 0 - 90") */
  baseDescription: string;
  /** Display name for the group */
  displayName: string;
  /** Array of phase descriptors, sorted by phase percentage */
  phases: Array<{
    descriptor: any; // FusionSecondaryDescriptor - using any to avoid circular import
    phasePercentage: number;
  }>;
  /** Total number of phases */
  phaseCount: number;
}

/**
 * Group fusion secondary descriptors by 4DCT phases
 * @param descriptors - Array of FusionSecondaryDescriptor
 * @returns Object with 4DCT groups and non-4DCT descriptors
 */
export function group4DCTFusionDescriptors(descriptors: any[]): {
  fourDCTGroups: FourDCTFusionGroup[];
  nonFourDCTDescriptors: any[];
} {
  const fourDCTMap = new Map<string, FourDCTFusionGroup>();
  const nonFourDCTDescriptors: any[] = [];
  
  for (const descriptor of descriptors) {
    // Only check CT modality
    const modality = (descriptor.secondaryModality || '').toUpperCase();
    if (modality !== 'CT') {
      nonFourDCTDescriptors.push(descriptor);
      continue;
    }
    
    const seriesDescription = descriptor.secondarySeriesDescription || '';
    const phasePercentage = extract4DCTPhasePercentage(seriesDescription);
    
    if (phasePercentage !== null) {
      const baseDescription = get4DCTBaseDescription(seriesDescription);
      const groupId = `4dct-fusion-${baseDescription.toLowerCase().replace(/\s+/g, '-')}`;
      
      if (!fourDCTMap.has(groupId)) {
        fourDCTMap.set(groupId, {
          groupId,
          baseDescription,
          displayName: `4DCT: ${baseDescription || 'Unnamed'}`,
          phases: [],
          phaseCount: 0,
        });
      }
      
      const group = fourDCTMap.get(groupId)!;
      group.phases.push({ descriptor, phasePercentage });
      group.phaseCount = group.phases.length;
    } else {
      nonFourDCTDescriptors.push(descriptor);
    }
  }
  
  // Sort phases within each group by percentage
  for (const group of fourDCTMap.values()) {
    group.phases.sort((a, b) => a.phasePercentage - b.phasePercentage);
  }
  
  return {
    fourDCTGroups: Array.from(fourDCTMap.values()),
    nonFourDCTDescriptors,
  };
}

/**
 * Helper functions for safe metadata parsing
 * These ensure MRI and CT metadata are handled consistently
 */

/**
 * Parse a value (string or array) into a numeric array
 * @param value - String with backslash delimiters or array of values
 * @param expectedLength - Expected number of elements
 * @returns Array of finite numbers or null if parsing fails
 */
export function parseNumericArray(value: unknown, expectedLength?: number): number[] | null {
  if (Array.isArray(value)) {
    const parsed = value.map((component) => Number(component)).filter((component) => Number.isFinite(component));
    if (!parsed.length) return null;
    if (expectedLength && parsed.length < expectedLength) return null;
    return parsed;
  }
  if (typeof value === 'string') {
    const parsed = value
      .split('\\')
      .map((component) => Number(component.trim()))
      .filter((component) => Number.isFinite(component));
    if (!parsed.length) return null;
    if (expectedLength && parsed.length < expectedLength) return null;
    return parsed;
  }
  return null;
}

/**
 * Parse a value into a single finite number
 * @param value - Value to parse
 * @returns Finite number or null
 */
export function parseNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Normalize metadata for contour rendering
 * Walks through metadata candidates and defensively parses values
 * @param metadataCandidates - Array of potential metadata sources
 * @returns Normalized metadata with safe defaults
 */
export interface NormalizedMetadata {
  imagePosition: number[];
  pixelSpacing: number[];
  imageOrientation: number[];
  columns: number;
  rows: number;
}

const EPSILON = 1e-6; // Minimum value for spacing to avoid division by zero

export function normalizeMetadata(metadataCandidates: any[]): NormalizedMetadata {
  let imagePosition: number[] | null = null;
  let pixelSpacing: number[] | null = null;
  let imageOrientation: number[] | null = null;
  let columns: number | null = null;
  let rows: number | null = null;

  // Walk through candidates to find valid values
  for (const meta of metadataCandidates) {
    if (!meta) continue;

    if (!imagePosition) {
      imagePosition =
        parseNumericArray(meta.imagePosition, 3) ||
        parseNumericArray(meta.imagePositionPatient, 3);
    }
    if (!pixelSpacing) {
      pixelSpacing =
        parseNumericArray(meta.pixelSpacing, 2) ||
        parseNumericArray(meta.pixelSpacingXY, 2);
    }
    if (!imageOrientation) {
      imageOrientation =
        parseNumericArray(meta.imageOrientation, 6) ||
        parseNumericArray(meta.imageOrientationPatient, 6);
    }
    if (columns == null) {
      columns = parseNumber(meta.columns) ?? parseNumber(meta.width) ?? null;
    }
    if (rows == null) {
      rows = parseNumber(meta.rows) ?? parseNumber(meta.height) ?? null;
    }

    if (imagePosition && pixelSpacing && imageOrientation && columns != null && rows != null) {
      break;
    }
  }

  // Apply safe defaults
  if (!imagePosition) {
    imagePosition = [0, 0, 0];
  }
  if (!pixelSpacing || pixelSpacing.length < 2) {
    pixelSpacing = [1, 1];
  }
  if (!imageOrientation || imageOrientation.length < 6) {
    imageOrientation = [1, 0, 0, 0, 1, 0]; // Identity orientation
  }

  // Clamp spacing to avoid zeros (use epsilon as minimum)
  const rowSpacing = Math.abs(pixelSpacing[0]) > EPSILON ? pixelSpacing[0] : 1;
  const columnSpacing = Math.abs(pixelSpacing[1]) > EPSILON ? pixelSpacing[1] : 1;

  // Normalize orientation vectors to unit length
  const normalizeVector = (vec: number[]): number[] => {
    const mag = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
    if (mag < EPSILON) return vec; // Return as-is if too small
    return [vec[0] / mag, vec[1] / mag, vec[2] / mag];
  };

  const rowCosines = normalizeVector([
    imageOrientation[0],
    imageOrientation[1],
    imageOrientation[2],
  ]);
  const colCosines = normalizeVector([
    imageOrientation[3],
    imageOrientation[4],
    imageOrientation[5],
  ]);

  return {
    imagePosition,
    pixelSpacing: [rowSpacing, columnSpacing],
    imageOrientation: [...rowCosines, ...colCosines],
    columns: columns ?? 512,
    rows: rows ?? 512,
  };
}
