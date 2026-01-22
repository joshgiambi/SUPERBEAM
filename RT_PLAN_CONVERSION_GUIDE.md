# Converting RT Plan Overlay & BEV Rendering to React/TypeScript

## Complete Implementation Guide

This document provides exhaustive, step-by-step instructions for converting the C#/WPF RT Plan overlay and Beam's Eye View rendering system to a modern React/TypeScript web application.

---

## Table of Contents

1. [Project Architecture Overview](#1-project-architecture-overview)
2. [Project Setup](#2-project-setup)
3. [TypeScript Type Definitions](#3-typescript-type-definitions)
4. [DICOM Parsing Layer](#4-dicom-parsing-layer)
5. [Mathematical Utilities](#5-mathematical-utilities)
6. [Coordinate Transformation System](#6-coordinate-transformation-system)
7. [MLC Model Implementation](#7-mlc-model-implementation)
8. [Canvas Rendering Engine](#8-canvas-rendering-engine)
9. [BEV Renderer Component](#9-bev-renderer-component)
10. [CT Slice Overlay Renderer](#10-ct-slice-overlay-renderer)
11. [React Component Architecture](#11-react-component-architecture)
12. [State Management](#12-state-management)
13. [Performance Optimization](#13-performance-optimization)
14. [Testing Strategy](#14-testing-strategy)
15. [Complete Code Examples](#15-complete-code-examples)

---

## 1. Project Architecture Overview

### Recommended Directory Structure

```
src/
├── components/
│   ├── BevViewer/
│   │   ├── BevViewer.tsx
│   │   ├── BevCanvas.tsx
│   │   ├── BevControls.tsx
│   │   ├── BevOverlays.tsx
│   │   └── index.ts
│   ├── CtSliceViewer/
│   │   ├── CtSliceViewer.tsx
│   │   ├── CtCanvas.tsx
│   │   ├── SliceControls.tsx
│   │   └── index.ts
│   └── common/
│       ├── ColorBar.tsx
│       ├── ScaleRuler.tsx
│       └── OrientationMarkers.tsx
├── core/
│   ├── dicom/
│   │   ├── DicomParser.ts
│   │   ├── RtPlanParser.ts
│   │   ├── RtStructParser.ts
│   │   └── RtDoseParser.ts
│   ├── geometry/
│   │   ├── Vector3.ts
│   │   ├── Matrix4.ts
│   │   ├── Quaternion.ts
│   │   ├── Rectangle.ts
│   │   └── transforms.ts
│   ├── models/
│   │   ├── Beam.ts
│   │   ├── ControlPoint.ts
│   │   ├── MlcModel.ts
│   │   ├── Structure.ts
│   │   ├── Plan.ts
│   │   └── types.ts
│   └── rendering/
│       ├── BevRenderer.ts
│       ├── CtRenderer.ts
│       ├── MlcRenderer.ts
│       ├── StructureProjector.ts
│       ├── IsodoseRenderer.ts
│       └── FieldLineRenderer.ts
├── hooks/
│   ├── useBevRenderer.ts
│   ├── useCtRenderer.ts
│   ├── useDicomLoader.ts
│   └── useCanvasInteraction.ts
├── stores/
│   ├── planStore.ts
│   ├── viewerStore.ts
│   └── settingsStore.ts
├── utils/
│   ├── colorUtils.ts
│   ├── mathUtils.ts
│   └── dicomUtils.ts
└── types/
    ├── dicom.types.ts
    ├── geometry.types.ts
    ├── rendering.types.ts
    └── index.ts
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI Framework | React 18+ | Component architecture |
| Language | TypeScript 5+ | Type safety |
| Rendering | HTML5 Canvas / WebGL | 2D/3D graphics |
| DICOM Parsing | dcmjs / cornerstone | DICOM file handling |
| State Management | Zustand | Lightweight state |
| Math Library | gl-matrix / mathjs | Vector/matrix operations |
| Build Tool | Vite | Fast development |

---

## 2. Project Setup

### Step 2.1: Initialize the Project

```bash
# Create new Vite React TypeScript project
npm create vite@latest rt-plan-viewer -- --template react-ts

cd rt-plan-viewer

# Install dependencies
npm install

# Install required packages
npm install dcmjs cornerstone-core cornerstone-wado-image-loader
npm install zustand immer
npm install gl-matrix
npm install @types/gl-matrix

# Install dev dependencies
npm install -D @types/node vitest @testing-library/react
```

### Step 2.2: Configure TypeScript

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["components/*"],
      "@core/*": ["core/*"],
      "@hooks/*": ["hooks/*"],
      "@stores/*": ["stores/*"],
      "@types/*": ["types/*"],
      "@utils/*": ["utils/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Step 2.3: Configure Vite

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@core': path.resolve(__dirname, './src/core'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  optimizeDeps: {
    exclude: ['dcmjs'],
  },
});
```

---

## 3. TypeScript Type Definitions

### Step 3.1: Create Geometry Types

Create `src/types/geometry.types.ts`:

```typescript
/**
 * 3D Vector representation
 * Used throughout for positions, directions, and offsets
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 2D Point for canvas/image coordinates
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Axis-aligned rectangle
 * Used for jaw positions, field bounds, etc.
 */
export interface Rectangle {
  x: number;      // Left edge
  y: number;      // Top edge
  width: number;
  height: number;
}

/**
 * Jaw positions in IEC 61217 coordinates
 * X1/X2: Left/Right jaws (perpendicular to gantry rotation)
 * Y1/Y2: Top/Bottom jaws (parallel to gantry rotation axis)
 * Values in mm, relative to isocenter
 */
export interface JawPositions {
  x1: number;  // Left jaw position (typically negative)
  x2: number;  // Right jaw position (typically positive)
  y1: number;  // Bottom jaw position
  y2: number;  // Top jaw position
}

/**
 * 4x4 transformation matrix (column-major order for WebGL compatibility)
 */
export type Matrix4 = Float32Array;  // 16 elements

/**
 * Quaternion for rotations
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Bounding box in 3D
 */
export interface BoundingBox3D {
  min: Vector3;
  max: Vector3;
}

/**
 * Line segment for MLC/field rendering
 */
export interface LineSegment {
  start: Point2D;
  end: Point2D;
  style: 'solid' | 'dashed' | 'dotted';
}
```

### Step 3.2: Create DICOM Types

Create `src/types/dicom.types.ts`:

```typescript
import { Vector3, JawPositions } from './geometry.types';

/**
 * Patient orientation in DICOM
 */
export type PatientOrientation =
  | 'HFS'  // Head First Supine
  | 'HFP'  // Head First Prone
  | 'FFS'  // Feet First Supine
  | 'FFP'  // Feet First Prone
  | 'HFDL' // Head First Decubitus Left
  | 'HFDR' // Head First Decubitus Right
  | 'FFDL' // Feet First Decubitus Left
  | 'FFDR'; // Feet First Decubitus Right

/**
 * Gantry rotation direction
 */
export type GantryDirection = 'NONE' | 'CW' | 'CC';

/**
 * Radiation type
 */
export type RadiationType = 'PHOTON' | 'ELECTRON' | 'PROTON';

/**
 * Beam type
 */
export type BeamType = 'STATIC' | 'DYNAMIC';

/**
 * MLC plan type (matching Eclipse conventions)
 */
export type MlcPlanType =
  | 'NotDefined'
  | 'Static'
  | 'DoseDynamic'   // IMRT sliding window
  | 'ArcDynamic'    // Conformal arc
  | 'VMAT';         // Volumetric modulated arc

/**
 * Treatment delivery type
 */
export type TreatmentDeliveryType = 'TREATMENT' | 'SETUP' | 'VERIFICATION';

/**
 * Block type
 */
export type BlockType = 'SHIELDING' | 'APERTURE';

/**
 * Wedge type
 */
export type WedgeType = 'STANDARD' | 'DYNAMIC' | 'MOTORIZED';

/**
 * Single control point data
 */
export interface ControlPoint {
  index: number;
  metersetWeight: number;        // 0.0 to 1.0
  gantryAngle: number;           // degrees
  gantryDirection: GantryDirection;
  collimatorAngle: number;       // degrees
  patientSupportAngle: number;   // couch angle, degrees
  isocenterPosition: Vector3;    // DICOM patient coordinates, mm
  jawPositions: JawPositions;    // mm
  leafPositions: number[][] | null;  // [bank][leaf], mm from centerline
  // leafPositions[0] = left bank (typically negative values)
  // leafPositions[1] = right bank (typically positive values)
}

/**
 * Wedge information
 */
export interface Wedge {
  id: string;
  type: WedgeType;
  angle: number;        // degrees (15, 30, 45, 60)
  direction: number;    // orientation angle (0, 90, 180, 270)
  factor?: number;      // wedge transmission factor
}

/**
 * Block information
 */
export interface Block {
  id: string;
  type: BlockType;
  material: string;
  thickness: number;    // mm
  outline: Point2D[][]; // Array of contours, each contour is array of points
}

/**
 * Applicator (cone) information
 */
export interface Applicator {
  id: string;
  type: string;         // e.g., "ELECTRON_SQUARE", "SRS_CONE"
  description?: string;
}

/**
 * Complete beam definition
 */
export interface Beam {
  beamNumber: number;
  beamName: string;
  beamDescription?: string;
  beamType: BeamType;
  radiationType: RadiationType;
  treatmentDeliveryType: TreatmentDeliveryType;
  treatmentMachineName: string;
  
  // Geometry
  sourceAxisDistance: number;     // SAD, typically 1000mm
  isocenterPosition: Vector3;
  
  // Control points
  controlPoints: ControlPoint[];
  
  // Collimation
  mlcModel?: string;              // e.g., "Millennium120", "Agility"
  mlcPlanType: MlcPlanType;
  
  // Modifiers
  wedges: Wedge[];
  blocks: Block[];
  applicator?: Applicator;
  
  // Dosimetry
  meterset: number;               // Total MU
  
  // Computed properties
  isArc: boolean;
  arcLength?: number;             // degrees, if arc
}

/**
 * Reference to structure set
 */
export interface ReferencedStructureSet {
  sopInstanceUid: string;
}

/**
 * Complete RT Plan
 */
export interface RtPlan {
  sopInstanceUid: string;
  rtPlanLabel: string;
  rtPlanName?: string;
  rtPlanDescription?: string;
  rtPlanDate?: Date;
  
  // Patient info
  patientId: string;
  patientName: string;
  
  // Frame of reference
  frameOfReferenceUid: string;
  
  // Treatment info
  treatmentOrientation: PatientOrientation;
  
  // References
  referencedStructureSetUid?: string;
  
  // Beams
  beams: Beam[];
  
  // Prescription
  prescribedDose?: number;        // cGy
  numberOfFractions?: number;
}

/**
 * DRR image data
 */
export interface DrrImage {
  width: number;
  height: number;
  pixelData: Uint16Array | Int16Array;
  xResolution: number;    // mm per pixel
  yResolution: number;    // mm per pixel
  windowCenter: number;
  windowWidth: number;
  patientOrientation: PatientOrientation;
}
```

### Step 3.3: Create Rendering Types

Create `src/types/rendering.types.ts`:

```typescript
import { Point2D, Vector3, LineSegment, Rectangle } from './geometry.types';
import { Beam, ControlPoint } from './dicom.types';

/**
 * BEV rendering configuration
 */
export interface BevRenderConfig {
  // Canvas dimensions
  width: number;
  height: number;
  
  // View settings
  zoomLevel: number;
  panOffset: Point2D;
  
  // Colors
  crosshairColor: string;
  jawColor: string;
  setupJawColor: string;
  mlcColor: string;
  wedgeColor: string;
  blockColor: string;
  labelColor: string;
  scaleColor: string;
  
  // Line widths
  crosshairWidth: number;
  jawWidth: number;
  mlcWidth: number;
  
  // Display options
  showCrosshair: boolean;
  showTickMarks: boolean;
  showJawLabels: boolean;
  showOrientationLabels: boolean;
  showScale: boolean;
  showStructures: boolean;
  showReferencePoints: boolean;
  showDrrImage: boolean;
  showApprovalStatus: boolean;
  
  // Font settings
  labelFontSize: number;
  orientationFontSize: number;
}

/**
 * CT slice rendering configuration
 */
export interface CtRenderConfig {
  // Canvas dimensions
  width: number;
  height: number;
  
  // View settings
  zoomLevel: number;
  panOffset: Point2D;
  
  // Window/Level
  windowWidth: number;
  windowCenter: number;
  
  // Display options
  showStructures: boolean;
  showIsodoses: boolean;
  showFieldLines: boolean;
  showSetupFieldLines: boolean;
  showIsocenter: boolean;
  showReferencePoints: boolean;
  showUserOrigin: boolean;
  
  // Isodose display
  isodoseDisplayMode: 'lines' | 'colorwash' | 'both';
  colorwashOpacity: number;
  colorwashMinDose: number;
  colorwashMaxDose: number;
}

/**
 * Slice orientation
 */
export type SliceOrientation = 'transverse' | 'coronal' | 'sagittal';

/**
 * Structure display settings
 */
export interface StructureDisplaySettings {
  structureId: string;
  visible: boolean;
  color: string;
  lineWidth: number;
  fillOpacity: number;
  filled: boolean;
}

/**
 * Isodose display settings
 */
export interface IsodoseDisplaySettings {
  doseLevel: number;      // percentage or absolute
  isAbsolute: boolean;
  color: string;
  lineWidth: number;
  visible: boolean;
}

/**
 * Reference point data
 */
export interface ReferencePointDisplay {
  id: string;
  name: string;
  location: Vector3;
  color: string;
  visible: boolean;
}

/**
 * Computed field shape for rendering
 */
export interface FieldShape {
  jawRect: Rectangle;
  mlcOutline: LineSegment[];
  blockOutlines: Point2D[][];
  applicatorRect?: Rectangle;
  isCircularApplicator: boolean;
}

/**
 * Projected structure contour on BEV
 */
export interface ProjectedStructure {
  structureId: string;
  contours: Point2D[][];
  color: string;
  lineWidth: number;
}

/**
 * BEV image data ready for rendering
 */
export interface BevImageData {
  beam: Beam;
  controlPointIndex: number;
  
  // DRR background
  drrImage?: ImageData;
  
  // Geometric elements
  fieldShape: FieldShape;
  wedgeTriangles: Point2D[][];
  
  // Overlays
  projectedStructures: ProjectedStructure[];
  referencePoints: ReferencePointDisplay[];
  
  // Labels
  orientationLabels: {
    label: string;
    position: Point2D;
    rotation: number;
  }[];
}

/**
 * CT slice image data ready for rendering
 */
export interface CtSliceImageData {
  // Base CT image
  ctPixelData: ImageData;
  
  // Overlay data
  structureContours: {
    structureId: string;
    contours: Point2D[][];
    color: string;
    lineWidth: number;
    filled: boolean;
    fillOpacity: number;
  }[];
  
  // Isodose contours
  isodoseContours: {
    doseLevel: number;
    contours: Point2D[][];
    color: string;
    lineWidth: number;
  }[];
  
  // Field lines
  fieldProjections: {
    beamId: string;
    outline: Point2D[];
    color: string;
    isSetup: boolean;
  }[];
  
  // Markers
  isocenterPositions: Point2D[];
  referencePoints: {
    id: string;
    position: Point2D;
    color: string;
  }[];
}

/**
 * Canvas rendering context wrapper
 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  devicePixelRatio: number;
  
  // Coordinate conversion (world/mm to canvas pixels)
  worldToCanvas: (point: Point2D) => Point2D;
  canvasToWorld: (point: Point2D) => Point2D;
  
  // Current transform state
  currentZoom: number;
  currentPan: Point2D;
}
```

### Step 3.4: Create Index Export

Create `src/types/index.ts`:

```typescript
export * from './geometry.types';
export * from './dicom.types';
export * from './rendering.types';
```

---

## 4. DICOM Parsing Layer

### Step 4.1: Create Base DICOM Parser

Create `src/core/dicom/DicomParser.ts`:

```typescript
import dcmjs from 'dcmjs';

/**
 * Base DICOM parser utilities
 * Handles low-level DICOM file reading and tag extraction
 */
export class DicomParser {
  protected dataset: any;
  
  constructor(arrayBuffer: ArrayBuffer) {
    const dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer);
    this.dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
      dicomData.dict
    );
  }
  
  /**
   * Get a tag value by keyword
   */
  protected getValue<T>(keyword: string, defaultValue?: T): T | undefined {
    const value = this.dataset[keyword];
    if (value === undefined || value === null) {
      return defaultValue;
    }
    return value as T;
  }
  
  /**
   * Get a numeric value
   */
  protected getNumber(keyword: string, defaultValue?: number): number | undefined {
    const value = this.getValue<string | number>(keyword);
    if (value === undefined) return defaultValue;
    return typeof value === 'number' ? value : parseFloat(value);
  }
  
  /**
   * Get a string value
   */
  protected getString(keyword: string, defaultValue?: string): string | undefined {
    const value = this.getValue<string>(keyword);
    return value ?? defaultValue;
  }
  
  /**
   * Get a sequence (array of items)
   */
  protected getSequence(keyword: string): any[] {
    const seq = this.getValue<any[]>(keyword);
    return seq ?? [];
  }
  
  /**
   * Get a Vector3 from three consecutive values
   */
  protected getVector3(keyword: string): Vector3 | undefined {
    const values = this.getValue<number[]>(keyword);
    if (!values || values.length < 3) return undefined;
    return { x: values[0], y: values[1], z: values[2] };
  }
  
  /**
   * Get a 2D array (like MLC leaf positions)
   */
  protected get2DArray(keyword: string, numBanks: number, leavesPerBank: number): number[][] | null {
    const values = this.getValue<number[]>(keyword);
    if (!values || values.length !== numBanks * leavesPerBank) return null;
    
    const result: number[][] = [];
    for (let bank = 0; bank < numBanks; bank++) {
      const bankValues: number[] = [];
      for (let leaf = 0; leaf < leavesPerBank; leaf++) {
        bankValues.push(values[bank * leavesPerBank + leaf]);
      }
      result.push(bankValues);
    }
    return result;
  }
  
  /**
   * Parse date string to Date object
   */
  protected parseDate(dateStr?: string): Date | undefined {
    if (!dateStr) return undefined;
    // DICOM date format: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }
}
```

### Step 4.2: Create RT Plan Parser

Create `src/core/dicom/RtPlanParser.ts`:

```typescript
import { DicomParser } from './DicomParser';
import {
  RtPlan,
  Beam,
  ControlPoint,
  Wedge,
  Block,
  Applicator,
  JawPositions,
  GantryDirection,
  RadiationType,
  BeamType,
  MlcPlanType,
  TreatmentDeliveryType,
  WedgeType,
  BlockType,
  PatientOrientation,
} from '@types';

/**
 * Parser for RT Plan DICOM files
 * Extracts all beam and control point information needed for BEV rendering
 */
export class RtPlanParser extends DicomParser {
  /**
   * Parse the complete RT Plan
   */
  public parse(): RtPlan {
    const beamSequence = this.getSequence('BeamSequence');
    const fractionGroupSequence = this.getSequence('FractionGroupSequence');
    
    // Get meterset values from fraction group sequence
    const metersetMap = this.buildMetersetMap(fractionGroupSequence);
    
    const beams = beamSequence.map((beamItem: any) => 
      this.parseBeam(beamItem, metersetMap)
    );
    
    // Parse referenced structure set
    const refStructSeq = this.getSequence('ReferencedStructureSetSequence');
    const referencedStructureSetUid = refStructSeq[0]?.ReferencedSOPInstanceUID;
    
    return {
      sopInstanceUid: this.getString('SOPInstanceUID') ?? '',
      rtPlanLabel: this.getString('RTPlanLabel') ?? 'Unknown',
      rtPlanName: this.getString('RTPlanName'),
      rtPlanDescription: this.getString('RTPlanDescription'),
      rtPlanDate: this.parseDate(this.getString('RTPlanDate')),
      
      patientId: this.getString('PatientID') ?? '',
      patientName: this.getString('PatientName') ?? '',
      
      frameOfReferenceUid: this.getString('FrameOfReferenceUID') ?? '',
      treatmentOrientation: this.parseTreatmentOrientation(),
      
      referencedStructureSetUid,
      
      beams,
      
      prescribedDose: this.parsePrescribedDose(),
      numberOfFractions: this.parseNumberOfFractions(),
    };
  }
  
  /**
   * Build map of beam number to meterset value
   */
  private buildMetersetMap(fractionGroupSequence: any[]): Map<number, number> {
    const map = new Map<number, number>();
    
    for (const fg of fractionGroupSequence) {
      const refBeamSeq = fg.ReferencedBeamSequence ?? [];
      for (const refBeam of refBeamSeq) {
        const beamNumber = refBeam.ReferencedBeamNumber;
        const meterset = refBeam.BeamMeterset;
        if (beamNumber !== undefined && meterset !== undefined) {
          map.set(beamNumber, parseFloat(meterset));
        }
      }
    }
    
    return map;
  }
  
  /**
   * Parse a single beam
   */
  private parseBeam(beamItem: any, metersetMap: Map<number, number>): Beam {
    const beamNumber = parseInt(beamItem.BeamNumber ?? '0');
    const controlPointSequence = beamItem.ControlPointSequence ?? [];
    
    // Parse control points
    const controlPoints = this.parseControlPoints(controlPointSequence, beamItem);
    
    // Determine if this is an arc beam
    const firstCp = controlPoints[0];
    const isArc = firstCp?.gantryDirection !== 'NONE';
    
    // Calculate arc length if applicable
    let arcLength: number | undefined;
    if (isArc && controlPoints.length >= 2) {
      const lastCp = controlPoints[controlPoints.length - 1];
      arcLength = this.calculateArcLength(
        firstCp.gantryAngle,
        lastCp.gantryAngle,
        firstCp.gantryDirection
      );
    }
    
    // Get MLC model from beam limiting device sequence
    const mlcModel = this.extractMlcModel(beamItem);
    
    // Parse modifiers
    const wedges = this.parseWedges(beamItem.WedgeSequence ?? []);
    const blocks = this.parseBlocks(beamItem.BlockSequence ?? []);
    const applicator = this.parseApplicator(beamItem.ApplicatorSequence?.[0]);
    
    return {
      beamNumber,
      beamName: beamItem.BeamName ?? `Beam ${beamNumber}`,
      beamDescription: beamItem.BeamDescription,
      beamType: (beamItem.BeamType as BeamType) ?? 'STATIC',
      radiationType: (beamItem.RadiationType as RadiationType) ?? 'PHOTON',
      treatmentDeliveryType: this.parseTreatmentDeliveryType(beamItem),
      treatmentMachineName: beamItem.TreatmentMachineName ?? 'Unknown',
      
      sourceAxisDistance: parseFloat(beamItem.SourceAxisDistance ?? '1000'),
      isocenterPosition: firstCp?.isocenterPosition ?? { x: 0, y: 0, z: 0 },
      
      controlPoints,
      
      mlcModel,
      mlcPlanType: this.determineMlcPlanType(controlPoints, beamItem),
      
      wedges,
      blocks,
      applicator,
      
      meterset: metersetMap.get(beamNumber) ?? 0,
      
      isArc,
      arcLength,
    };
  }
  
  /**
   * Parse all control points for a beam
   */
  private parseControlPoints(
    controlPointSequence: any[],
    beamItem: any
  ): ControlPoint[] {
    const controlPoints: ControlPoint[] = [];
    
    // Track values that may be inherited from previous control points
    let currentGantryAngle = 0;
    let currentGantryDirection: GantryDirection = 'NONE';
    let currentCollimatorAngle = 0;
    let currentPatientSupportAngle = 0;
    let currentIsocenter: Vector3 = { x: 0, y: 0, z: 0 };
    let currentJaws: JawPositions = { x1: -100, x2: 100, y1: -100, y2: 100 };
    let currentLeafPositions: number[][] | null = null;
    
    // Get number of MLC leaves from beam limiting device sequence
    const numLeaves = this.getNumberOfMlcLeaves(beamItem);
    
    for (let i = 0; i < controlPointSequence.length; i++) {
      const cpItem = controlPointSequence[i];
      
      // Update values if present in this control point
      if (cpItem.GantryAngle !== undefined) {
        currentGantryAngle = parseFloat(cpItem.GantryAngle);
      }
      if (cpItem.GantryRotationDirection !== undefined) {
        currentGantryDirection = cpItem.GantryRotationDirection as GantryDirection;
      }
      if (cpItem.BeamLimitingDeviceAngle !== undefined) {
        currentCollimatorAngle = parseFloat(cpItem.BeamLimitingDeviceAngle);
      }
      if (cpItem.PatientSupportAngle !== undefined) {
        currentPatientSupportAngle = parseFloat(cpItem.PatientSupportAngle);
      }
      if (cpItem.IsocenterPosition) {
        const iso = cpItem.IsocenterPosition;
        currentIsocenter = { x: iso[0], y: iso[1], z: iso[2] };
      }
      
      // Parse beam limiting device positions (jaws and MLC)
      const bldPositionSequence = cpItem.BeamLimitingDevicePositionSequence ?? [];
      for (const bldPos of bldPositionSequence) {
        const type = bldPos.RTBeamLimitingDeviceType;
        const positions = bldPos.LeafJawPositions;
        
        if (type === 'X' || type === 'ASYMX') {
          currentJaws = {
            ...currentJaws,
            x1: positions[0],
            x2: positions[1],
          };
        } else if (type === 'Y' || type === 'ASYMY') {
          currentJaws = {
            ...currentJaws,
            y1: positions[0],
            y2: positions[1],
          };
        } else if (type === 'MLCX' || type === 'MLCY') {
          // MLC leaf positions: first half is bank A, second half is bank B
          const halfLength = positions.length / 2;
          currentLeafPositions = [
            positions.slice(0, halfLength),      // Bank A (typically left/negative)
            positions.slice(halfLength),          // Bank B (typically right/positive)
          ];
        }
      }
      
      controlPoints.push({
        index: i,
        metersetWeight: parseFloat(cpItem.CumulativeMetersetWeight ?? '0'),
        gantryAngle: currentGantryAngle,
        gantryDirection: currentGantryDirection,
        collimatorAngle: currentCollimatorAngle,
        patientSupportAngle: currentPatientSupportAngle,
        isocenterPosition: { ...currentIsocenter },
        jawPositions: { ...currentJaws },
        leafPositions: currentLeafPositions ? 
          currentLeafPositions.map(bank => [...bank]) : null,
      });
    }
    
    return controlPoints;
  }
  
  /**
   * Parse wedge sequence
   */
  private parseWedges(wedgeSequence: any[]): Wedge[] {
    return wedgeSequence.map((w: any) => ({
      id: w.WedgeID ?? 'Unknown',
      type: (w.WedgeType as WedgeType) ?? 'STANDARD',
      angle: parseFloat(w.WedgeAngle ?? '0'),
      direction: parseFloat(w.WedgeOrientation ?? '0'),
      factor: w.WedgeFactor ? parseFloat(w.WedgeFactor) : undefined,
    }));
  }
  
  /**
   * Parse block sequence
   */
  private parseBlocks(blockSequence: any[]): Block[] {
    return blockSequence.map((b: any) => {
      // Parse block outline (array of contours)
      const blockData = b.BlockData ?? [];
      const numContours = parseInt(b.BlockNumberOfPoints ?? '0');
      
      // BlockData is a flat array: x1,y1,x2,y2,...
      const contour: Point2D[] = [];
      for (let i = 0; i < blockData.length; i += 2) {
        contour.push({ x: blockData[i], y: blockData[i + 1] });
      }
      
      return {
        id: b.BlockName ?? 'Block',
        type: (b.BlockType as BlockType) ?? 'SHIELDING',
        material: b.MaterialID ?? 'Unknown',
        thickness: parseFloat(b.BlockThickness ?? '0'),
        outline: contour.length > 0 ? [contour] : [],
      };
    });
  }
  
  /**
   * Parse applicator
   */
  private parseApplicator(applicatorItem: any): Applicator | undefined {
    if (!applicatorItem) return undefined;
    
    return {
      id: applicatorItem.ApplicatorID ?? 'Unknown',
      type: applicatorItem.ApplicatorType ?? 'UNKNOWN',
      description: applicatorItem.ApplicatorDescription,
    };
  }
  
  /**
   * Extract MLC model name from beam limiting device sequence
   */
  private extractMlcModel(beamItem: any): string | undefined {
    const bldSequence = beamItem.BeamLimitingDeviceSequence ?? [];
    for (const bld of bldSequence) {
      const type = bld.RTBeamLimitingDeviceType;
      if (type === 'MLCX' || type === 'MLCY') {
        // The actual model name often needs to be inferred from number of leaves
        // or machine name, as DICOM doesn't have a standard tag for MLC model
        const numLeaves = parseInt(bld.NumberOfLeafJawPairs ?? '0');
        return this.inferMlcModel(numLeaves, beamItem.TreatmentMachineName);
      }
    }
    return undefined;
  }
  
  /**
   * Infer MLC model from leaf count and machine name
   */
  private inferMlcModel(numLeaves: number, machineName?: string): string {
    // Common configurations
    if (numLeaves === 60) return 'Millennium120';  // 60 pairs = 120 leaves
    if (numLeaves === 80) return 'Agility';
    if (numLeaves === 52) return 'Millennium80';
    
    // Check machine name for hints
    if (machineName) {
      const upper = machineName.toUpperCase();
      if (upper.includes('HALCYON')) return 'SX2';
      if (upper.includes('ETHOS')) return 'SX2';
      if (upper.includes('UNITY')) return 'Unity';
      if (upper.includes('ELEKTA') || upper.includes('SYNERGY')) return 'Agility';
    }
    
    return `MLC${numLeaves * 2}`;  // Generic name based on leaf count
  }
  
  /**
   * Get number of MLC leaf pairs
   */
  private getNumberOfMlcLeaves(beamItem: any): number {
    const bldSequence = beamItem.BeamLimitingDeviceSequence ?? [];
    for (const bld of bldSequence) {
      if (bld.RTBeamLimitingDeviceType === 'MLCX' || 
          bld.RTBeamLimitingDeviceType === 'MLCY') {
        return parseInt(bld.NumberOfLeafJawPairs ?? '0');
      }
    }
    return 0;
  }
  
  /**
   * Determine MLC plan type from control point analysis
   */
  private determineMlcPlanType(controlPoints: ControlPoint[], beamItem: any): MlcPlanType {
    if (controlPoints.length === 0) return 'NotDefined';
    
    const firstCp = controlPoints[0];
    const isArc = firstCp.gantryDirection !== 'NONE';
    
    if (controlPoints.length === 2) {
      return 'Static';
    }
    
    // Check if this is VMAT (varying MU delivery rate)
    if (isArc && controlPoints.length > 2) {
      // Check for varying meterset increments
      let lastIncrement = controlPoints[1].metersetWeight - controlPoints[0].metersetWeight;
      for (let i = 2; i < controlPoints.length; i++) {
        const increment = controlPoints[i].metersetWeight - controlPoints[i-1].metersetWeight;
        if (Math.abs(increment - lastIncrement) > 0.0001) {
          return 'VMAT';
        }
        lastIncrement = increment;
      }
      return 'ArcDynamic';  // Conformal arc (constant MU/degree)
    }
    
    // Static gantry with multiple control points = IMRT or FiF
    return 'DoseDynamic';
  }
  
  /**
   * Parse treatment delivery type
   */
  private parseTreatmentDeliveryType(beamItem: any): TreatmentDeliveryType {
    const type = beamItem.TreatmentDeliveryType;
    if (type === 'SETUP') return 'SETUP';
    if (type === 'VERIFICATION') return 'VERIFICATION';
    return 'TREATMENT';
  }
  
  /**
   * Parse treatment orientation from patient setup sequence
   */
  private parseTreatmentOrientation(): PatientOrientation {
    const patientSetupSeq = this.getSequence('PatientSetupSequence');
    if (patientSetupSeq.length > 0) {
      const position = patientSetupSeq[0].PatientPosition;
      if (position) {
        return position as PatientOrientation;
      }
    }
    return 'HFS';  // Default to Head First Supine
  }
  
  /**
   * Calculate arc length between two gantry angles
   */
  private calculateArcLength(
    startAngle: number,
    stopAngle: number,
    direction: GantryDirection
  ): number {
    if (direction === 'NONE') return 0;
    
    if (direction === 'CW') {
      // Clockwise: angles increase
      if (stopAngle < startAngle) {
        return (360 - startAngle) + stopAngle;
      }
      return stopAngle - startAngle;
    } else {
      // Counter-clockwise: angles decrease
      if (startAngle < stopAngle) {
        return (360 - stopAngle) + startAngle;
      }
      return startAngle - stopAngle;
    }
  }
  
  /**
   * Parse prescribed dose from dose reference sequence
   */
  private parsePrescribedDose(): number | undefined {
    const doseRefSeq = this.getSequence('DoseReferenceSequence');
    for (const doseRef of doseRefSeq) {
      if (doseRef.TargetPrescriptionDose !== undefined) {
        return parseFloat(doseRef.TargetPrescriptionDose) * 100;  // Gy to cGy
      }
    }
    return undefined;
  }
  
  /**
   * Parse number of fractions
   */
  private parseNumberOfFractions(): number | undefined {
    const fractionGroupSeq = this.getSequence('FractionGroupSequence');
    if (fractionGroupSeq.length > 0) {
      const numFx = fractionGroupSeq[0].NumberOfFractionsPlanned;
      return numFx ? parseInt(numFx) : undefined;
    }
    return undefined;
  }
}
```

---

## 5. Mathematical Utilities

### Step 5.1: Create Vector3 Class

Create `src/core/geometry/Vector3.ts`:

```typescript
import { Vector3 as IVector3 } from '@types';

/**
 * 3D Vector class with all necessary operations for BEV rendering
 */
export class Vector3 implements IVector3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}
  
  /**
   * Create from interface
   */
  static from(v: IVector3): Vector3 {
    return new Vector3(v.x, v.y, v.z);
  }
  
  /**
   * Create from array
   */
  static fromArray(arr: number[]): Vector3 {
    return new Vector3(arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0);
  }
  
  /**
   * Clone this vector
   */
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
  
  /**
   * Copy values from another vector
   */
  copy(v: IVector3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  
  /**
   * Set components
   */
  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  
  /**
   * Add another vector
   */
  add(v: IVector3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  
  /**
   * Subtract another vector
   */
  sub(v: IVector3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  
  /**
   * Multiply by scalar
   */
  multiplyScalar(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  
  /**
   * Divide by scalar
   */
  divideScalar(s: number): this {
    return this.multiplyScalar(1 / s);
  }
  
  /**
   * Dot product
   */
  dot(v: IVector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  
  /**
   * Cross product (returns new vector)
   */
  cross(v: IVector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  
  /**
   * Length/magnitude
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  
  /**
   * Length squared (faster for comparisons)
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  
  /**
   * Normalize to unit length
   */
  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.divideScalar(len);
    }
    return this;
  }
  
  /**
   * Distance to another vector
   */
  distanceTo(v: IVector3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Negate
   */
  negate(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  
  /**
   * Linear interpolation
   */
  lerp(v: IVector3, t: number): this {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
  
  /**
   * Apply a 4x4 matrix transformation
   */
  applyMatrix4(m: Float32Array): this {
    const x = this.x, y = this.y, z = this.z;
    const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
    
    this.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
    this.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
    this.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
    
    return this;
  }
  
  /**
   * Apply quaternion rotation
   */
  applyQuaternion(q: { x: number; y: number; z: number; w: number }): this {
    const x = this.x, y = this.y, z = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    
    // Calculate quat * vector
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    
    // Calculate result * inverse quat
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    
    return this;
  }
  
  /**
   * Rotate around X axis
   */
  rotateX(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const y = this.y;
    const z = this.z;
    this.y = y * cos - z * sin;
    this.z = y * sin + z * cos;
    return this;
  }
  
  /**
   * Rotate around Y axis
   */
  rotateY(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = this.x;
    const z = this.z;
    this.x = x * cos + z * sin;
    this.z = -x * sin + z * cos;
    return this;
  }
  
  /**
   * Rotate around Z axis
   */
  rotateZ(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = this.x;
    const y = this.y;
    this.x = x * cos - y * sin;
    this.y = x * sin + y * cos;
    return this;
  }
  
  /**
   * Convert to array
   */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }
  
  /**
   * Check equality within tolerance
   */
  equals(v: IVector3, tolerance: number = 1e-6): boolean {
    return (
      Math.abs(this.x - v.x) <= tolerance &&
      Math.abs(this.y - v.y) <= tolerance &&
      Math.abs(this.z - v.z) <= tolerance
    );
  }
  
  /**
   * String representation
   */
  toString(): string {
    return `Vector3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }
}

// Static helpers for common operations without mutation

export function addVectors(a: IVector3, b: IVector3): Vector3 {
  return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
}

export function subVectors(a: IVector3, b: IVector3): Vector3 {
  return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function scaleVector(v: IVector3, s: number): Vector3 {
  return new Vector3(v.x * s, v.y * s, v.z * s);
}

export function dotProduct(a: IVector3, b: IVector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossProduct(a: IVector3, b: IVector3): Vector3 {
  return new Vector3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

export function normalizeVector(v: IVector3): Vector3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return new Vector3(0, 0, 0);
  return new Vector3(v.x / len, v.y / len, v.z / len);
}
```

### Step 5.2: Create Matrix4 Utilities

Create `src/core/geometry/Matrix4.ts`:

```typescript
import { mat4, quat } from 'gl-matrix';

/**
 * 4x4 Matrix utilities for coordinate transformations
 * Uses gl-matrix internally for performance
 */
export class Matrix4 {
  public elements: Float32Array;
  
  constructor() {
    this.elements = mat4.create();
  }
  
  /**
   * Set to identity matrix
   */
  identity(): this {
    mat4.identity(this.elements);
    return this;
  }
  
  /**
   * Create rotation matrix from axis and angle
   */
  makeRotationAxis(axis: { x: number; y: number; z: number }, angle: number): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const x = axis.x, y = axis.y, z = axis.z;
    
    this.elements[0] = t * x * x + c;
    this.elements[1] = t * x * y + s * z;
    this.elements[2] = t * x * z - s * y;
    this.elements[3] = 0;
    
    this.elements[4] = t * x * y - s * z;
    this.elements[5] = t * y * y + c;
    this.elements[6] = t * y * z + s * x;
    this.elements[7] = 0;
    
    this.elements[8] = t * x * z + s * y;
    this.elements[9] = t * y * z - s * x;
    this.elements[10] = t * z * z + c;
    this.elements[11] = 0;
    
    this.elements[12] = 0;
    this.elements[13] = 0;
    this.elements[14] = 0;
    this.elements[15] = 1;
    
    return this;
  }
  
  /**
   * Create rotation around X axis
   */
  makeRotationX(angle: number): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    mat4.identity(this.elements);
    this.elements[5] = c;
    this.elements[6] = s;
    this.elements[9] = -s;
    this.elements[10] = c;
    
    return this;
  }
  
  /**
   * Create rotation around Y axis
   */
  makeRotationY(angle: number): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    mat4.identity(this.elements);
    this.elements[0] = c;
    this.elements[2] = -s;
    this.elements[8] = s;
    this.elements[10] = c;
    
    return this;
  }
  
  /**
   * Create rotation around Z axis
   */
  makeRotationZ(angle: number): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    mat4.identity(this.elements);
    this.elements[0] = c;
    this.elements[1] = s;
    this.elements[4] = -s;
    this.elements[5] = c;
    
    return this;
  }
  
  /**
   * Create translation matrix
   */
  makeTranslation(x: number, y: number, z: number): this {
    mat4.fromTranslation(this.elements, [x, y, z]);
    return this;
  }
  
  /**
   * Multiply this matrix by another (this = this * m)
   */
  multiply(m: Matrix4): this {
    mat4.multiply(this.elements, this.elements, m.elements);
    return this;
  }
  
  /**
   * Pre-multiply (this = m * this)
   */
  premultiply(m: Matrix4): this {
    mat4.multiply(this.elements, m.elements, this.elements);
    return this;
  }
  
  /**
   * Invert this matrix
   */
  invert(): this {
    mat4.invert(this.elements, this.elements);
    return this;
  }
  
  /**
   * Transpose this matrix
   */
  transpose(): this {
    mat4.transpose(this.elements, this.elements);
    return this;
  }
  
  /**
   * Clone this matrix
   */
  clone(): Matrix4 {
    const m = new Matrix4();
    m.elements = new Float32Array(this.elements);
    return m;
  }
  
  /**
   * Copy from another matrix
   */
  copy(m: Matrix4): this {
    this.elements.set(m.elements);
    return this;
  }
  
  /**
   * Set from rotation quaternion
   */
  makeRotationFromQuaternion(q: { x: number; y: number; z: number; w: number }): this {
    const quaternion = quat.fromValues(q.x, q.y, q.z, q.w);
    mat4.fromQuat(this.elements, quaternion);
    return this;
  }
  
  /**
   * Get the determinant
   */
  determinant(): number {
    return mat4.determinant(this.elements);
  }
}

/**
 * Create gantry rotation matrix
 * Rotates around Z axis (IEC 61217 gantry rotation)
 */
export function createGantryRotationMatrix(angleDegreees: number): Matrix4 {
  const m = new Matrix4();
  m.makeRotationZ(angleDegreees * Math.PI / 180);
  return m;
}

/**
 * Create collimator rotation matrix
 * Rotates around Y axis in beam coordinate system
 */
export function createCollimatorRotationMatrix(angleDegrees: number): Matrix4 {
  const m = new Matrix4();
  // Collimator rotation is around the beam central axis
  // In IEC 61217, this is a rotation around -Y when gantry is at 0
  m.makeRotationY(-angleDegrees * Math.PI / 180);
  return m;
}

/**
 * Create couch (patient support) rotation matrix
 * Rotates around -Y axis (vertical axis, looking down from above)
 */
export function createCouchRotationMatrix(angleDegrees: number): Matrix4 {
  const m = new Matrix4();
  m.makeRotationY(-angleDegrees * Math.PI / 180);
  return m;
}
```

---

## 6. Coordinate Transformation System

### Step 6.1: Create Transform Utilities

Create `src/core/geometry/transforms.ts`:

```typescript
import { Vector3, subVectors, normalizeVector, crossProduct } from './Vector3';
import { Matrix4, createGantryRotationMatrix, createCollimatorRotationMatrix, createCouchRotationMatrix } from './Matrix4';
import { PatientOrientation, Point2D } from '@types';

/**
 * Coordinate transformation utilities for RT Plan rendering
 * 
 * Coordinate Systems:
 * - DICOM Patient: Right-handed, X=patient left, Y=posterior, Z=superior
 * - IEC 61217 Fixed: Right-handed, X=right(from gantry perspective), Y=down, Z=toward gantry
 * - BEV: 2D projection at isocenter plane, origin at isocenter
 * - Image/Canvas: Origin top-left, Y increases downward
 */

/**
 * Get the patient orientation transformation matrix
 * Transforms from DICOM patient coordinates to IEC fixed coordinates
 */
export function getPatientOrientationMatrix(orientation: PatientOrientation): Matrix4 {
  const m = new Matrix4().identity();
  
  // The matrix transforms from DICOM to IEC fixed coordinates
  // DICOM: +X = patient left, +Y = patient posterior, +Z = patient superior
  // IEC Fixed: +X = right (looking at gantry), +Y = down, +Z = toward gantry
  
  switch (orientation) {
    case 'HFS':  // Head First Supine (most common)
      // Patient lies on back, head toward gantry
      // DICOM X -> IEC -X, DICOM Y -> IEC -Y, DICOM Z -> IEC +Z
      m.elements[0] = -1;  // X' = -X
      m.elements[5] = -1;  // Y' = -Y
      m.elements[10] = 1;  // Z' = Z
      break;
      
    case 'HFP':  // Head First Prone
      // Patient lies on stomach, head toward gantry
      m.elements[0] = 1;   // X' = X
      m.elements[5] = 1;   // Y' = Y
      m.elements[10] = 1;  // Z' = Z
      break;
      
    case 'FFS':  // Feet First Supine
      // Patient lies on back, feet toward gantry
      m.elements[0] = 1;   // X' = X
      m.elements[5] = -1;  // Y' = -Y
      m.elements[10] = -1; // Z' = -Z
      break;
      
    case 'FFP':  // Feet First Prone
      m.elements[0] = -1;
      m.elements[5] = 1;
      m.elements[10] = -1;
      break;
      
    case 'HFDL': // Head First Decubitus Left
      m.elements[0] = 0;
      m.elements[1] = -1;
      m.elements[4] = -1;
      m.elements[5] = 0;
      m.elements[10] = 1;
      break;
      
    case 'HFDR': // Head First Decubitus Right
      m.elements[0] = 0;
      m.elements[1] = 1;
      m.elements[4] = 1;
      m.elements[5] = 0;
      m.elements[10] = 1;
      break;
      
    case 'FFDL': // Feet First Decubitus Left
      m.elements[0] = 0;
      m.elements[1] = 1;
      m.elements[4] = -1;
      m.elements[5] = 0;
      m.elements[10] = -1;
      break;
      
    case 'FFDR': // Feet First Decubitus Right
      m.elements[0] = 0;
      m.elements[1] = -1;
      m.elements[4] = 1;
      m.elements[5] = 0;
      m.elements[10] = -1;
      break;
  }
  
  return m;
}

/**
 * Calculate the source position for a given beam configuration
 */
export function calculateSourcePosition(
  isocenter: Vector3,
  gantryAngle: number,
  sourceAxisDistance: number,
  patientOrientation: PatientOrientation
): Vector3 {
  // Start with unit vector pointing from iso toward gantry (at gantry 0)
  // In IEC fixed coordinates, this is +Z direction
  const sourceDirection = new Vector3(0, 0, 1);
  
  // Apply gantry rotation (around Z axis in IEC coordinates)
  // At gantry 0: source is at +Y (above patient in IEC)
  // Gantry rotates clockwise when viewed from above (looking at -Y)
  const gantryRad = gantryAngle * Math.PI / 180;
  
  // Source direction after gantry rotation
  // The source moves in a circle around the Z axis
  sourceDirection.x = Math.sin(gantryRad);
  sourceDirection.y = -Math.cos(gantryRad);  // Negative because gantry 0 = source at -Y in beam coords
  sourceDirection.z = 0;
  
  // Apply patient orientation
  const orientMatrix = getPatientOrientationMatrix(patientOrientation);
  sourceDirection.applyMatrix4(orientMatrix.elements);
  
  // Source position is isocenter - SAD * direction
  return new Vector3(
    isocenter.x - sourceAxisDistance * sourceDirection.x,
    isocenter.y - sourceAxisDistance * sourceDirection.y,
    isocenter.z - sourceAxisDistance * sourceDirection.z
  );
}

/**
 * Project a 3D point onto the BEV (isocenter plane)
 * Returns 2D coordinates in mm relative to isocenter
 */
export function projectPointToBev(
  point: Vector3,
  sourcePosition: Vector3,
  isocenter: Vector3,
  gantryAngle: number,
  collimatorAngle: number,
  patientOrientation: PatientOrientation
): Point2D {
  // Ray from source through point
  const rayDirection = subVectors(point, sourcePosition).normalize();
  
  // Find intersection with isocenter plane
  // The isocenter plane is perpendicular to source-isocenter line
  const centralAxis = normalizeVector(subVectors(isocenter, sourcePosition));
  
  // Distance from source to isocenter plane along ray
  const sourceToIso = subVectors(isocenter, sourcePosition);
  const denom = rayDirection.dot(centralAxis);
  
  if (Math.abs(denom) < 1e-10) {
    // Ray is parallel to plane, no intersection
    return { x: NaN, y: NaN };
  }
  
  const t = sourceToIso.dot(centralAxis) / denom;
  
  // Intersection point in 3D
  const intersection = new Vector3(
    sourcePosition.x + rayDirection.x * t,
    sourcePosition.y + rayDirection.y * t,
    sourcePosition.z + rayDirection.z * t
  );
  
  // Convert to BEV coordinates (relative to isocenter, in isocenter plane)
  // Need to define X and Y axes in the isocenter plane
  const bevX = getBevXAxis(gantryAngle, patientOrientation);
  const bevY = getBevYAxis(gantryAngle, patientOrientation);
  
  // Apply collimator rotation to BEV axes
  const collRad = collimatorAngle * Math.PI / 180;
  const rotatedBevX = new Vector3(
    bevX.x * Math.cos(collRad) - bevY.x * Math.sin(collRad),
    bevX.y * Math.cos(collRad) - bevY.y * Math.sin(collRad),
    bevX.z * Math.cos(collRad) - bevY.z * Math.sin(collRad)
  );
  const rotatedBevY = new Vector3(
    bevX.x * Math.sin(collRad) + bevY.x * Math.cos(collRad),
    bevX.y * Math.sin(collRad) + bevY.y * Math.cos(collRad),
    bevX.z * Math.sin(collRad) + bevY.z * Math.cos(collRad)
  );
  
  // Project intersection onto BEV axes
  const relativePos = subVectors(intersection, isocenter);
  
  return {
    x: relativePos.dot(rotatedBevX),
    y: relativePos.dot(rotatedBevY),
  };
}

/**
 * Get the BEV X axis direction in patient coordinates
 * X axis is perpendicular to gantry rotation axis and central beam axis
 */
function getBevXAxis(gantryAngle: number, patientOrientation: PatientOrientation): Vector3 {
  // At gantry 0, BEV X points in patient left direction (DICOM +X for HFS)
  const gantryRad = gantryAngle * Math.PI / 180;
  
  // BEV X rotates with gantry
  const bevX = new Vector3(
    Math.cos(gantryRad),
    Math.sin(gantryRad),
    0
  );
  
  // Apply patient orientation
  const orientMatrix = getPatientOrientationMatrix(patientOrientation);
  const invertedOrient = orientMatrix.clone().invert();
  bevX.applyMatrix4(invertedOrient.elements);
  
  return bevX;
}

/**
 * Get the BEV Y axis direction in patient coordinates
 * Y axis is along gantry rotation axis (patient superior-inferior for HFS)
 */
function getBevYAxis(gantryAngle: number, patientOrientation: PatientOrientation): Vector3 {
  // BEV Y is along the gantry rotation axis
  // This doesn't change with gantry angle
  const bevY = new Vector3(0, 0, -1);  // Points toward patient feet in IEC
  
  // Apply patient orientation
  const orientMatrix = getPatientOrientationMatrix(patientOrientation);
  const invertedOrient = orientMatrix.clone().invert();
  bevY.applyMatrix4(invertedOrient.elements);
  
  return bevY;
}

/**
 * Convert mm position in BEV to canvas pixel coordinates
 */
export function bevToCanvas(
  bevPoint: Point2D,
  canvasWidth: number,
  canvasHeight: number,
  pixelsPerMm: number,
  zoomLevel: number,
  panOffset: Point2D
): Point2D {
  // Canvas center is isocenter
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // Apply zoom and scale
  const scale = pixelsPerMm * zoomLevel;
  
  return {
    x: centerX + bevPoint.x * scale + panOffset.x,
    y: centerY - bevPoint.y * scale + panOffset.y,  // Y inverted for canvas
  };
}

/**
 * Convert canvas pixel coordinates to mm position in BEV
 */
export function canvasToBev(
  canvasPoint: Point2D,
  canvasWidth: number,
  canvasHeight: number,
  pixelsPerMm: number,
  zoomLevel: number,
  panOffset: Point2D
): Point2D {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const scale = pixelsPerMm * zoomLevel;
  
  return {
    x: (canvasPoint.x - centerX - panOffset.x) / scale,
    y: -(canvasPoint.y - centerY - panOffset.y) / scale,  // Y inverted
  };
}

/**
 * Get orientation labels for BEV based on gantry angle and patient position
 */
export function getBevOrientationLabels(
  gantryAngle: number,
  couchAngle: number,
  patientOrientation: PatientOrientation
): { label: string; angle: number }[] {
  // Returns labels to place at 0, 90, 180, 270 degrees around the image
  const labels: { label: string; angle: number }[] = [];
  
  // Base labels depend on patient orientation and gantry angle
  // This is a simplified version - full implementation would handle all cases
  
  const isHeadFirst = patientOrientation.startsWith('HF');
  const isSupine = patientOrientation.endsWith('S') || 
                   patientOrientation === 'HFS' || 
                   patientOrientation === 'FFS';
  
  // Determine which anatomical direction is at each position
  const gantryRad = gantryAngle * Math.PI / 180;
  
  // At gantry 0, looking down the beam:
  // - Right side of image is patient's left (L)
  // - Left side of image is patient's right (R)
  // - Top is superior (H) for HF, inferior (F) for FF
  // - Bottom is inferior (F) for HF, superior (H) for FF
  
  // These rotate with gantry angle
  const positions = [
    { angle: 0, baseLabel: 'R' },    // Right side of image
    { angle: 90, baseLabel: isHeadFirst ? 'H' : 'F' },   // Top
    { angle: 180, baseLabel: 'L' },  // Left side
    { angle: 270, baseLabel: isHeadFirst ? 'F' : 'H' },  // Bottom
  ];
  
  // Adjust for gantry rotation - the patient anatomy rotates relative to image
  for (const pos of positions) {
    labels.push({
      label: pos.baseLabel,
      angle: pos.angle,
    });
  }
  
  return labels;
}
```

---

## 7. MLC Model Implementation

### Step 7.1: Create MLC Model Base Class

Create `src/core/models/MlcModel.ts`:

```typescript
import { Point2D, LineSegment, JawPositions } from '@types';

/**
 * Configuration for a specific MLC model
 */
export interface MlcModelConfig {
  name: string;
  numLeafPairs: number;
  leafWidths: number[];       // Width of each leaf in mm
  startY: number;             // Y position of first leaf edge (typically negative)
  maxLeafSpan: number;        // Maximum leaf travel from centerline
  minLeafGap: number;         // Minimum gap between opposing leaves
  maxLeafOvertravel: number;  // Maximum leaf can extend past centerline
}

/**
 * Abstract base class for MLC models
 * Subclasses implement specific linac MLC configurations
 */
export abstract class MlcModel {
  public abstract readonly config: MlcModelConfig;
  
  /**
   * Get the Y position of a specific leaf row (top edge)
   */
  getLeafRowY(rowIndex: number): number {
    let y = this.config.startY;
    for (let i = 0; i < rowIndex && i < this.config.leafWidths.length; i++) {
      y += this.config.leafWidths[i];
    }
    return y;
  }
  
  /**
   * Get the Y position of the bottom edge of a leaf row
   */
  getLeafRowBottomY(rowIndex: number): number {
    return this.getLeafRowY(rowIndex) + this.config.leafWidths[rowIndex];
  }
  
  /**
   * Compute the MLC outline as line segments
   * 
   * @param leafPositions - [2][numLeaves] array, [0]=left bank, [1]=right bank
   * @param jawPositions - Jaw positions to clip to
   * @param scale - Pixels per mm
   * @param isocenter - Isocenter position in image coordinates
   */
  computeMlcOutline(
    leafPositions: number[][],
    jawPositions: JawPositions,
    scale: number,
    isocenter: Point2D
  ): LineSegment[] {
    const segments: LineSegment[] = [];
    
    if (!leafPositions || leafPositions.length !== 2) {
      return segments;
    }
    
    const leftBank = leafPositions[0];
    const rightBank = leafPositions[1];
    const numLeaves = Math.min(leftBank.length, rightBank.length);
    
    // Find the range of leaves within the jaw aperture
    let firstVisibleLeaf = -1;
    let lastVisibleLeaf = -1;
    
    for (let i = 0; i < numLeaves; i++) {
      const leafTopY = this.getLeafRowY(i);
      const leafBottomY = this.getLeafRowBottomY(i);
      
      // Check if this leaf row is within Y jaw aperture
      // Note: In BEV, Y1 is typically negative (below iso), Y2 is positive
      if (leafBottomY >= jawPositions.y1 && leafTopY <= jawPositions.y2) {
        if (firstVisibleLeaf === -1) firstVisibleLeaf = i;
        lastVisibleLeaf = i;
      }
    }
    
    if (firstVisibleLeaf === -1) {
      return segments;  // No leaves visible
    }
    
    // Track previous positions for horizontal connections
    let prevLeftX = NaN;
    let prevRightX = NaN;
    let prevY = NaN;
    
    for (let i = firstVisibleLeaf; i <= lastVisibleLeaf; i++) {
      const leafTopY = this.getLeafRowY(i);
      const leafBottomY = this.getLeafRowBottomY(i);
      
      // Get leaf positions, clipped to jaw aperture
      let leftX = Math.max(leftBank[i], jawPositions.x1);
      let rightX = Math.min(rightBank[i], jawPositions.x2);
      
      // Skip if leaves are closed beyond minimum gap
      if (rightX - leftX < this.config.minLeafGap) {
        // Draw horizontal line connecting previous to next open leaf
        continue;
      }
      
      // Clip Y positions to jaw aperture
      const clippedTopY = Math.max(leafTopY, jawPositions.y1);
      const clippedBottomY = Math.min(leafBottomY, jawPositions.y2);
      
      // Convert to image coordinates
      const imgLeftX = isocenter.x + leftX * scale;
      const imgRightX = isocenter.x + rightX * scale;
      const imgTopY = isocenter.y - clippedTopY * scale;  // Y inverted
      const imgBottomY = isocenter.y - clippedBottomY * scale;
      
      // Draw vertical lines (leaf edges)
      segments.push({
        start: { x: imgLeftX, y: imgTopY },
        end: { x: imgLeftX, y: imgBottomY },
        style: 'solid',
      });
      segments.push({
        start: { x: imgRightX, y: imgTopY },
        end: { x: imgRightX, y: imgBottomY },
        style: 'solid',
      });
      
      // Draw horizontal connections to previous leaf row
      if (!isNaN(prevLeftX) && i > firstVisibleLeaf) {
        const prevImgY = isocenter.y - prevY * scale;
        const imgY = isocenter.y - clippedTopY * scale;
        
        // Left bank connection
        const prevImgLeftX = isocenter.x + prevLeftX * scale;
        segments.push({
          start: { x: prevImgLeftX, y: imgY },
          end: { x: imgLeftX, y: imgY },
          style: 'solid',
        });
        
        // Right bank connection
        const prevImgRightX = isocenter.x + prevRightX * scale;
        segments.push({
          start: { x: prevImgRightX, y: imgY },
          end: { x: imgRightX, y: imgY },
          style: 'solid',
        });
      }
      
      prevLeftX = leftX;
      prevRightX = rightX;
      prevY = clippedBottomY;
    }
    
    // Draw closing horizontal line at bottom
    if (!isNaN(prevLeftX)) {
      const imgY = isocenter.y - prevY * scale;
      const imgLeftX = isocenter.x + prevLeftX * scale;
      const imgRightX = isocenter.x + prevRightX * scale;
      segments.push({
        start: { x: imgLeftX, y: imgY },
        end: { x: imgRightX, y: imgY },
        style: 'solid',
      });
    }
    
    return segments;
  }
  
  /**
   * Compute the maximum field opening across all control points
   * Returns the most open position for each leaf
   */
  computeMaxOpenField(
    controlPointLeafPositions: number[][][]
  ): number[][] {
    if (controlPointLeafPositions.length === 0) {
      return [];
    }
    
    const numLeaves = this.config.numLeafPairs;
    const maxLeft: number[] = new Array(numLeaves).fill(Infinity);
    const maxRight: number[] = new Array(numLeaves).fill(-Infinity);
    
    for (const cpLeaves of controlPointLeafPositions) {
      if (!cpLeaves || cpLeaves.length !== 2) continue;
      
      const leftBank = cpLeaves[0];
      const rightBank = cpLeaves[1];
      
      for (let i = 0; i < numLeaves; i++) {
        if (leftBank[i] < maxLeft[i]) maxLeft[i] = leftBank[i];
        if (rightBank[i] > maxRight[i]) maxRight[i] = rightBank[i];
      }
    }
    
    return [maxLeft, maxRight];
  }
}
```

### Step 7.2: Create Specific MLC Models

Create `src/core/models/mlc/Millennium120.ts`:

```typescript
import { MlcModel, MlcModelConfig } from '../MlcModel';

/**
 * Varian Millennium 120 MLC
 * 
 * Configuration:
 * - 60 leaf pairs (120 total leaves)
 * - Central 40 pairs: 5mm width at isocenter
 * - Outer 20 pairs (10 each side): 10mm width at isocenter
 * - Maximum field size: 40cm x 40cm
 * - Maximum leaf span: 14.5cm from centerline
 */
export class Millennium120 extends MlcModel {
  public readonly config: MlcModelConfig;
  
  constructor() {
    super();
    
    // Build leaf width array
    // 10 outer leaves (10mm) + 40 central leaves (5mm) + 10 outer leaves (10mm)
    const leafWidths: number[] = [];
    
    // First 10 leaves: 10mm each
    for (let i = 0; i < 10; i++) {
      leafWidths.push(10);
    }
    
    // Central 40 leaves: 5mm each
    for (let i = 0; i < 40; i++) {
      leafWidths.push(5);
    }
    
    // Last 10 leaves: 10mm each
    for (let i = 0; i < 10; i++) {
      leafWidths.push(10);
    }
    
    // Total Y coverage: 10*10 + 40*5 + 10*10 = 400mm = 40cm
    // StartY should be -200mm (half of 400mm)
    
    this.config = {
      name: 'Millennium120',
      numLeafPairs: 60,
      leafWidths,
      startY: -200,           // Top of first leaf at -200mm
      maxLeafSpan: 145,       // Max leaf travel: 14.5cm from center
      minLeafGap: 0.5,        // 0.5mm minimum gap
      maxLeafOvertravel: 145, // Leaves can extend 14.5cm past centerline
    };
  }
}

/**
 * Varian Millennium 120 HD (High Definition)
 * 
 * Configuration:
 * - 60 leaf pairs (120 total leaves)
 * - Central 32 pairs: 2.5mm width at isocenter
 * - Outer 28 pairs (14 each side): 5mm width at isocenter
 * - Designed for SRS/SBRT treatments
 */
export class Millennium120HD extends MlcModel {
  public readonly config: MlcModelConfig;
  
  constructor() {
    super();
    
    const leafWidths: number[] = [];
    
    // First 14 leaves: 5mm each
    for (let i = 0; i < 14; i++) {
      leafWidths.push(5);
    }
    
    // Central 32 leaves: 2.5mm each
    for (let i = 0; i < 32; i++) {
      leafWidths.push(2.5);
    }
    
    // Last 14 leaves: 5mm each
    for (let i = 0; i < 14; i++) {
      leafWidths.push(5);
    }
    
    // Total Y coverage: 14*5 + 32*2.5 + 14*5 = 220mm = 22cm
    
    this.config = {
      name: 'Millennium120HD',
      numLeafPairs: 60,
      leafWidths,
      startY: -110,
      maxLeafSpan: 145,
      minLeafGap: 0.5,
      maxLeafOvertravel: 145,
    };
  }
}
```

Create `src/core/models/mlc/Agility.ts`:

```typescript
import { MlcModel, MlcModelConfig } from '../MlcModel';

/**
 * Elekta Agility MLC
 * 
 * Configuration:
 * - 80 leaf pairs (160 total leaves)
 * - All leaves: 5mm width at isocenter
 * - No backup jaws in X direction (MLC defines field edge)
 * - Maximum field size: 40cm x 40cm
 */
export class Agility extends MlcModel {
  public readonly config: MlcModelConfig;
  
  constructor() {
    super();
    
    // All 80 leaves are 5mm wide
    const leafWidths: number[] = new Array(80).fill(5);
    
    this.config = {
      name: 'Agility',
      numLeafPairs: 80,
      leafWidths,
      startY: -200,           // -200mm to +200mm coverage
      maxLeafSpan: 200,       // 20cm from center
      minLeafGap: 0.5,
      maxLeafOvertravel: 200,
    };
  }
}
```

Create `src/core/models/mlc/index.ts`:

```typescript
import { MlcModel } from '../MlcModel';
import { Millennium120, Millennium120HD } from './Millennium120';
import { Agility } from './Agility';

/**
 * Factory function to create MLC model from name
 */
export function createMlcModel(modelName?: string): MlcModel | null {
  if (!modelName) return null;
  
  const normalizedName = modelName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  switch (normalizedName) {
    case 'MILLENNIUM120':
    case 'NDS120':
      return new Millennium120();
      
    case 'MILLENNIUM120HD':
    case 'NDS120HD':
      return new Millennium120HD();
      
    case 'AGILITY':
      return new Agility();
      
    default:
      console.warn(`Unknown MLC model: ${modelName}`);
      return null;
  }
}

export { MlcModel } from '../MlcModel';
export { Millennium120, Millennium120HD } from './Millennium120';
export { Agility } from './Agility';
```

---

## 8. Canvas Rendering Engine

### Step 8.1: Create Base Renderer

Create `src/core/rendering/BaseRenderer.ts`:

```typescript
import { Point2D } from '@types';

/**
 * Base class for canvas-based renderers
 * Provides common drawing utilities and state management
 */
export abstract class BaseRenderer {
  protected ctx: CanvasRenderingContext2D;
  protected width: number;
  protected height: number;
  protected devicePixelRatio: number;
  
  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D rendering context');
    }
    
    this.ctx = ctx;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Set up high-DPI canvas
    const rect = canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    canvas.width = this.width * this.devicePixelRatio;
    canvas.height = this.height * this.devicePixelRatio;
    
    ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
  }
  
  /**
   * Clear the canvas
   */
  protected clear(color: string = '#000000'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  
  /**
   * Draw a line between two points
   */
  protected drawLine(
    start: Point2D,
    end: Point2D,
    color: string,
    lineWidth: number = 1,
    dash?: number[]
  ): void {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    
    if (dash) {
      this.ctx.setLineDash(dash);
    } else {
      this.ctx.setLineDash([]);
    }
    
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
  }
  
  /**
   * Draw a rectangle outline
   */
  protected drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    lineWidth: number = 1
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.setLineDash([]);
    this.ctx.strokeRect(x, y, width, height);
  }
  
  /**
   * Draw a filled rectangle
   */
  protected fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
  }
  
  /**
   * Draw an ellipse
   */
  protected drawEllipse(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    color: string,
    lineWidth: number = 1,
    fill: boolean = false
  ): void {
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    
    if (fill) {
      this.ctx.fillStyle = color;
      this.ctx.fill();
    } else {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }
  
  /**
   * Draw a polyline (connected line segments)
   */
  protected drawPolyline(
    points: Point2D[],
    color: string,
    lineWidth: number = 1,
    closed: boolean = false,
    dash?: number[]
  ): void {
    if (points.length < 2) return;
    
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    
    if (dash) {
      this.ctx.setLineDash(dash);
    } else {
      this.ctx.setLineDash([]);
    }
    
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    
    if (closed) {
      this.ctx.closePath();
    }
    
    this.ctx.stroke();
  }
  
  /**
   * Draw a filled polygon
   */
  protected fillPolygon(
    points: Point2D[],
    fillColor: string,
    strokeColor?: string,
    lineWidth: number = 1
  ): void {
    if (points.length < 3) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.closePath();
    
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }
  
  /**
   * Draw text
   */
  protected drawText(
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: number = 12,
    fontFamily: string = 'Arial',
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'top'
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }
  
  /**
   * Draw text with shadow/outline for visibility
   */
  protected drawTextWithShadow(
    text: string,
    x: number,
    y: number,
    textColor: string,
    shadowColor: string = '#000000',
    fontSize: number = 12,
    fontFamily: string = 'Arial',
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'top'
  ): void {
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    
    // Draw shadow/outline
    this.ctx.strokeStyle = shadowColor;
    this.ctx.lineWidth = 3;
    this.ctx.strokeText(text, x, y);
    
    // Draw text
    this.ctx.fillStyle = textColor;
    this.ctx.fillText(text, x, y);
  }
  
  /**
   * Draw an image
   */
  protected drawImage(
    imageData: ImageData,
    x: number = 0,
    y: number = 0,
    width?: number,
    height?: number
  ): void {
    // Create temporary canvas for ImageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.putImageData(imageData, 0, 0);
    
    if (width !== undefined && height !== undefined) {
      this.ctx.drawImage(tempCanvas, x, y, width, height);
    } else {
      this.ctx.drawImage(tempCanvas, x, y);
    }
  }
  
  /**
   * Save current context state
   */
  protected save(): void {
    this.ctx.save();
  }
  
  /**
   * Restore previous context state
   */
  protected restore(): void {
    this.ctx.restore();
  }
  
  /**
   * Apply transform
   */
  protected transform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ): void {
    this.ctx.transform(a, b, c, d, e, f);
  }
  
  /**
   * Translate origin
   */
  protected translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }
  
  /**
   * Rotate around origin
   */
  protected rotate(angle: number): void {
    this.ctx.rotate(angle);
  }
  
  /**
   * Scale
   */
  protected scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }
  
  /**
   * Set clipping region
   */
  protected clip(path: Path2D): void {
    this.ctx.clip(path);
  }
  
  /**
   * Create rectangle path for clipping
   */
  protected createRectPath(x: number, y: number, width: number, height: number): Path2D {
    const path = new Path2D();
    path.rect(x, y, width, height);
    return path;
  }
}
```

---

---

## 9. BEV Renderer Component

### Step 9.1: Create the BEV Renderer Class

Create `src/core/rendering/BevRenderer.ts`:

```typescript
import { BaseRenderer } from './BaseRenderer';
import { 
  BevRenderConfig, 
  BevImageData, 
  Point2D, 
  LineSegment,
  Rectangle,
  JawPositions,
  ControlPoint,
  Beam,
  Wedge,
} from '@types';
import { createMlcModel, MlcModel } from '@core/models/mlc';
import { bevToCanvas, canvasToBev } from '@core/geometry/transforms';

/**
 * Default BEV rendering configuration
 */
export const defaultBevConfig: BevRenderConfig = {
  width: 512,
  height: 512,
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  
  crosshairColor: '#00FF00',
  jawColor: '#FFFF00',
  setupJawColor: '#FFAA00',
  mlcColor: '#00FFFF',
  wedgeColor: '#FF00FF',
  blockColor: '#FF6600',
  labelColor: '#FFFFFF',
  scaleColor: '#FFFFFF',
  
  crosshairWidth: 1,
  jawWidth: 2,
  mlcWidth: 1,
  
  showCrosshair: true,
  showTickMarks: true,
  showJawLabels: true,
  showOrientationLabels: true,
  showScale: true,
  showStructures: true,
  showReferencePoints: true,
  showDrrImage: true,
  showApprovalStatus: false,
  
  labelFontSize: 12,
  orientationFontSize: 16,
};

/**
 * BEV (Beam's Eye View) Renderer
 * 
 * Renders the view from the radiation source, showing:
 * - DRR background image
 * - Jaw aperture
 * - MLC leaf positions
 * - Wedge indicators
 * - Block outlines
 * - Structure projections
 * - Crosshair and scale
 * - Orientation labels
 */
export class BevRenderer extends BaseRenderer {
  private config: BevRenderConfig;
  private mlcModel: MlcModel | null = null;
  
  // Pixels per mm at isocenter (SAD = 1000mm)
  // This scales geometry to image space
  private pixelsPerMm: number = 1;
  
  // Center of the canvas in pixels
  private center: Point2D = { x: 0, y: 0 };
  
  constructor(canvas: HTMLCanvasElement, config: Partial<BevRenderConfig> = {}) {
    super(canvas);
    this.config = { ...defaultBevConfig, ...config };
    this.updateLayout();
  }
  
  /**
   * Update layout calculations after resize or config change
   */
  private updateLayout(): void {
    this.center = {
      x: this.width / 2,
      y: this.height / 2,
    };
    
    // Calculate scale: fit 400mm x 400mm field to canvas
    // Leave 10% margin
    const margin = 0.9;
    const fieldSizeMm = 400;
    this.pixelsPerMm = (Math.min(this.width, this.height) * margin) / fieldSizeMm;
  }
  
  /**
   * Set the MLC model for this beam
   */
  setMlcModel(modelName: string | undefined): void {
    this.mlcModel = createMlcModel(modelName);
  }
  
  /**
   * Update render configuration
   */
  updateConfig(config: Partial<BevRenderConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Main render function - renders complete BEV
   */
  render(data: BevImageData): void {
    // Clear canvas with black background
    this.clear('#000000');
    
    this.save();
    
    // Apply zoom and pan
    this.translate(this.center.x + this.config.panOffset.x, 
                   this.center.y + this.config.panOffset.y);
    this.scale(this.config.zoomLevel, this.config.zoomLevel);
    this.translate(-this.center.x, -this.center.y);
    
    // 1. Draw DRR background (if available and enabled)
    if (this.config.showDrrImage && data.drrImage) {
      this.drawDrrBackground(data.drrImage);
    }
    
    // 2. Apply collimator rotation for all beam elements
    this.save();
    const collAngle = data.beam.controlPoints[data.controlPointIndex]?.collimatorAngle ?? 0;
    this.translate(this.center.x, this.center.y);
    this.rotate(-collAngle * Math.PI / 180);  // Negative because canvas Y is inverted
    this.translate(-this.center.x, -this.center.y);
    
    // 3. Draw projected structures
    if (this.config.showStructures) {
      this.drawStructures(data.projectedStructures);
    }
    
    // 4. Draw reference points
    if (this.config.showReferencePoints) {
      this.drawReferencePoints(data.referencePoints);
    }
    
    // 5. Draw field elements (jaws, MLC, blocks, wedges)
    this.drawFieldElements(data);
    
    this.restore();  // Restore from collimator rotation
    
    // 6. Draw crosshair (not rotated with collimator)
    if (this.config.showCrosshair) {
      this.drawCrosshair();
    }
    
    // 7. Draw scale (fixed position)
    if (this.config.showScale) {
      this.drawScale();
    }
    
    // 8. Draw orientation labels
    if (this.config.showOrientationLabels) {
      this.drawOrientationLabels(data.orientationLabels, collAngle);
    }
    
    this.restore();  // Restore from zoom/pan
    
    // 9. Draw labels that should not zoom (fixed screen position)
    this.drawFixedLabels(data);
  }
  
  /**
   * Draw DRR background image
   */
  private drawDrrBackground(drrImage: ImageData): void {
    // Calculate position to center DRR at isocenter
    const drrWidthMm = drrImage.width;  // Assume 1:1 for simplicity
    const drrHeightMm = drrImage.height;
    
    const drawWidth = drrWidthMm * this.pixelsPerMm;
    const drawHeight = drrHeightMm * this.pixelsPerMm;
    
    const x = this.center.x - drawWidth / 2;
    const y = this.center.y - drawHeight / 2;
    
    this.drawImage(drrImage, x, y, drawWidth, drawHeight);
  }
  
  /**
   * Draw projected structure contours
   */
  private drawStructures(structures: BevImageData['projectedStructures']): void {
    for (const struct of structures) {
      for (const contour of struct.contours) {
        // Convert mm coordinates to canvas pixels
        const canvasPoints = contour.map(p => this.mmToCanvas(p));
        this.drawPolyline(canvasPoints, struct.color, struct.lineWidth, true);
      }
    }
  }
  
  /**
   * Draw reference points as markers
   */
  private drawReferencePoints(refPoints: BevImageData['referencePoints']): void {
    const markerSize = 5;  // pixels
    
    for (const rp of refPoints) {
      if (!rp.visible) continue;
      
      // Project reference point location to BEV coordinates
      // (This would be done in data preparation, here we just draw)
      const canvasPos = this.mmToCanvas(rp.location);
      
      // Draw cross marker
      this.drawLine(
        { x: canvasPos.x - markerSize, y: canvasPos.y },
        { x: canvasPos.x + markerSize, y: canvasPos.y },
        rp.color,
        2
      );
      this.drawLine(
        { x: canvasPos.x, y: canvasPos.y - markerSize },
        { x: canvasPos.x, y: canvasPos.y + markerSize },
        rp.color,
        2
      );
      
      // Draw name label
      this.drawText(
        rp.name,
        canvasPos.x + markerSize + 2,
        canvasPos.y,
        rp.color,
        10,
        'Arial',
        'left',
        'middle'
      );
    }
  }
  
  /**
   * Draw all field-defining elements
   */
  private drawFieldElements(data: BevImageData): void {
    const cp = data.beam.controlPoints[data.controlPointIndex];
    if (!cp) return;
    
    const isSetup = data.beam.treatmentDeliveryType === 'SETUP';
    const jawColor = isSetup ? this.config.setupJawColor : this.config.jawColor;
    
    // Draw jaw outline
    this.drawJaws(cp.jawPositions, jawColor);
    
    // Draw MLC
    if (cp.leafPositions && this.mlcModel) {
      this.drawMlc(cp.leafPositions, cp.jawPositions);
    }
    
    // Draw blocks
    for (const blockOutline of data.fieldShape.blockOutlines) {
      this.drawBlock(blockOutline);
    }
    
    // Draw wedge indicators
    for (const wedge of data.beam.wedges) {
      this.drawWedge(wedge, cp.jawPositions);
    }
    
    // Draw applicator (if present)
    if (data.fieldShape.applicatorRect) {
      this.drawApplicator(data.fieldShape.applicatorRect, data.fieldShape.isCircularApplicator);
    }
    
    // Draw jaw labels
    if (this.config.showJawLabels) {
      this.drawJawLabels(cp.jawPositions, jawColor);
    }
  }
  
  /**
   * Draw jaw aperture outline
   */
  private drawJaws(jaws: JawPositions, color: string): void {
    // Convert jaw positions to canvas coordinates
    const topLeft = this.mmToCanvas({ x: jaws.x1, y: jaws.y2 });
    const bottomRight = this.mmToCanvas({ x: jaws.x2, y: jaws.y1 });
    
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    
    this.drawRect(topLeft.x, topLeft.y, width, height, color, this.config.jawWidth);
  }
  
  /**
   * Draw MLC leaf positions
   */
  private drawMlc(leafPositions: number[][], jaws: JawPositions): void {
    if (!this.mlcModel) return;
    
    const isocenterCanvas = this.mmToCanvas({ x: 0, y: 0 });
    const scale = this.pixelsPerMm * this.config.zoomLevel;
    
    const segments = this.mlcModel.computeMlcOutline(
      leafPositions,
      jaws,
      scale,
      isocenterCanvas
    );
    
    for (const seg of segments) {
      this.drawLine(seg.start, seg.end, this.config.mlcColor, this.config.mlcWidth);
    }
  }
  
  /**
   * Draw block outline
   */
  private drawBlock(outline: Point2D[]): void {
    if (outline.length < 3) return;
    
    const canvasPoints = outline.map(p => this.mmToCanvas(p));
    
    // Fill with semi-transparent color
    this.fillPolygon(
      canvasPoints,
      `${this.config.blockColor}40`,  // 25% opacity
      this.config.blockColor,
      2
    );
  }
  
  /**
   * Draw wedge indicator triangle
   */
  private drawWedge(wedge: Wedge, jaws: JawPositions): void {
    // Calculate wedge triangle based on direction
    // Direction 0 = thick end at Y2 (top)
    // Direction 90 = thick end at X2 (right)
    // Direction 180 = thick end at Y1 (bottom)
    // Direction 270 = thick end at X1 (left)
    
    const trianglePoints = this.getWedgeTrianglePoints(wedge.direction, jaws);
    
    this.fillPolygon(
      trianglePoints.map(p => this.mmToCanvas(p)),
      `${this.config.wedgeColor}60`,  // 38% opacity
      this.config.wedgeColor,
      2
    );
    
    // Draw wedge angle label
    const labelPos = this.getWedgeLabelPosition(wedge.direction, jaws);
    const canvasPos = this.mmToCanvas(labelPos);
    this.drawTextWithShadow(
      `${wedge.angle}°`,
      canvasPos.x,
      canvasPos.y,
      this.config.labelColor,
      '#000000',
      this.config.labelFontSize,
      'Arial',
      'center',
      'middle'
    );
  }
  
  /**
   * Calculate wedge triangle vertices
   */
  private getWedgeTrianglePoints(direction: number, jaws: JawPositions): Point2D[] {
    // Wedge covers portion of field, triangle indicates thickness gradient
    const triangleHeight = 30;  // mm - visual indicator size
    
    switch (direction) {
      case 0:  // Thick end at top (Y2)
        return [
          { x: jaws.x1, y: jaws.y2 },
          { x: jaws.x2, y: jaws.y2 },
          { x: (jaws.x1 + jaws.x2) / 2, y: jaws.y2 - triangleHeight },
        ];
      case 90:  // Thick end at right (X2)
        return [
          { x: jaws.x2, y: jaws.y1 },
          { x: jaws.x2, y: jaws.y2 },
          { x: jaws.x2 - triangleHeight, y: (jaws.y1 + jaws.y2) / 2 },
        ];
      case 180:  // Thick end at bottom (Y1)
        return [
          { x: jaws.x1, y: jaws.y1 },
          { x: jaws.x2, y: jaws.y1 },
          { x: (jaws.x1 + jaws.x2) / 2, y: jaws.y1 + triangleHeight },
        ];
      case 270:  // Thick end at left (X1)
        return [
          { x: jaws.x1, y: jaws.y1 },
          { x: jaws.x1, y: jaws.y2 },
          { x: jaws.x1 + triangleHeight, y: (jaws.y1 + jaws.y2) / 2 },
        ];
      default:
        return [];
    }
  }
  
  /**
   * Get position for wedge label
   */
  private getWedgeLabelPosition(direction: number, jaws: JawPositions): Point2D {
    const offset = 20;  // mm from field edge
    
    switch (direction) {
      case 0:
        return { x: (jaws.x1 + jaws.x2) / 2, y: jaws.y2 + offset };
      case 90:
        return { x: jaws.x2 + offset, y: (jaws.y1 + jaws.y2) / 2 };
      case 180:
        return { x: (jaws.x1 + jaws.x2) / 2, y: jaws.y1 - offset };
      case 270:
        return { x: jaws.x1 - offset, y: (jaws.y1 + jaws.y2) / 2 };
      default:
        return { x: 0, y: 0 };
    }
  }
  
  /**
   * Draw applicator outline (electron cone or SRS cone)
   */
  private drawApplicator(rect: Rectangle, isCircular: boolean): void {
    if (isCircular) {
      // Draw circle
      const canvasCenter = this.mmToCanvas({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      const radiusX = (rect.width / 2) * this.pixelsPerMm * this.config.zoomLevel;
      const radiusY = (rect.height / 2) * this.pixelsPerMm * this.config.zoomLevel;
      
      this.drawEllipse(canvasCenter.x, canvasCenter.y, radiusX, radiusY, this.config.jawColor, 2);
    } else {
      // Draw rectangle
      const topLeft = this.mmToCanvas({ x: rect.x, y: rect.y + rect.height });
      const bottomRight = this.mmToCanvas({ x: rect.x + rect.width, y: rect.y });
      
      this.drawRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y,
        this.config.jawColor,
        2
      );
    }
  }
  
  /**
   * Draw jaw position labels
   */
  private drawJawLabels(jaws: JawPositions, color: string): void {
    const labelOffset = 15;  // pixels from jaw edge
    const fontSize = 11;
    
    // X1 label (left)
    const x1Pos = this.mmToCanvas({ x: jaws.x1, y: (jaws.y1 + jaws.y2) / 2 });
    this.drawTextWithShadow(
      `X1: ${jaws.x1.toFixed(1)}`,
      x1Pos.x - labelOffset,
      x1Pos.y,
      color,
      '#000000',
      fontSize,
      'Arial',
      'right',
      'middle'
    );
    
    // X2 label (right)
    const x2Pos = this.mmToCanvas({ x: jaws.x2, y: (jaws.y1 + jaws.y2) / 2 });
    this.drawTextWithShadow(
      `X2: ${jaws.x2.toFixed(1)}`,
      x2Pos.x + labelOffset,
      x2Pos.y,
      color,
      '#000000',
      fontSize,
      'Arial',
      'left',
      'middle'
    );
    
    // Y1 label (bottom)
    const y1Pos = this.mmToCanvas({ x: (jaws.x1 + jaws.x2) / 2, y: jaws.y1 });
    this.drawTextWithShadow(
      `Y1: ${jaws.y1.toFixed(1)}`,
      y1Pos.x,
      y1Pos.y + labelOffset,
      color,
      '#000000',
      fontSize,
      'Arial',
      'center',
      'top'
    );
    
    // Y2 label (top)
    const y2Pos = this.mmToCanvas({ x: (jaws.x1 + jaws.x2) / 2, y: jaws.y2 });
    this.drawTextWithShadow(
      `Y2: ${jaws.y2.toFixed(1)}`,
      y2Pos.x,
      y2Pos.y - labelOffset,
      color,
      '#000000',
      fontSize,
      'Arial',
      'center',
      'bottom'
    );
  }
  
  /**
   * Draw crosshair at isocenter
   */
  private drawCrosshair(): void {
    const crosshairLength = 20;  // pixels
    const dotRadius = 3;
    
    // Horizontal line
    this.drawLine(
      { x: this.center.x - crosshairLength, y: this.center.y },
      { x: this.center.x + crosshairLength, y: this.center.y },
      this.config.crosshairColor,
      this.config.crosshairWidth
    );
    
    // Vertical line
    this.drawLine(
      { x: this.center.x, y: this.center.y - crosshairLength },
      { x: this.center.x, y: this.center.y + crosshairLength },
      this.config.crosshairColor,
      this.config.crosshairWidth
    );
    
    // Center dot
    this.drawEllipse(
      this.center.x,
      this.center.y,
      dotRadius,
      dotRadius,
      this.config.crosshairColor,
      1,
      true
    );
    
    // Tick marks if enabled
    if (this.config.showTickMarks) {
      this.drawTickMarks();
    }
  }
  
  /**
   * Draw tick marks on crosshair (1cm intervals)
   */
  private drawTickMarks(): void {
    const tickSize = 4;
    const intervalMm = 10;  // 1cm
    const maxExtent = 200;  // mm from center
    
    for (let mm = intervalMm; mm <= maxExtent; mm += intervalMm) {
      const pixelOffset = mm * this.pixelsPerMm * this.config.zoomLevel;
      
      // Right ticks
      this.drawLine(
        { x: this.center.x + pixelOffset, y: this.center.y - tickSize },
        { x: this.center.x + pixelOffset, y: this.center.y + tickSize },
        this.config.crosshairColor,
        this.config.crosshairWidth
      );
      
      // Left ticks
      this.drawLine(
        { x: this.center.x - pixelOffset, y: this.center.y - tickSize },
        { x: this.center.x - pixelOffset, y: this.center.y + tickSize },
        this.config.crosshairColor,
        this.config.crosshairWidth
      );
      
      // Top ticks
      this.drawLine(
        { x: this.center.x - tickSize, y: this.center.y - pixelOffset },
        { x: this.center.x + tickSize, y: this.center.y - pixelOffset },
        this.config.crosshairColor,
        this.config.crosshairWidth
      );
      
      // Bottom ticks
      this.drawLine(
        { x: this.center.x - tickSize, y: this.center.y + pixelOffset },
        { x: this.center.x + tickSize, y: this.center.y + pixelOffset },
        this.config.crosshairColor,
        this.config.crosshairWidth
      );
    }
  }
  
  /**
   * Draw scale bar
   */
  private drawScale(): void {
    const scaleLength = 50;  // mm
    const scalePx = scaleLength * this.pixelsPerMm * this.config.zoomLevel;
    
    const startX = this.width - 20 - scalePx;
    const startY = this.height - 30;
    
    // Scale bar
    this.drawLine(
      { x: startX, y: startY },
      { x: startX + scalePx, y: startY },
      this.config.scaleColor,
      2
    );
    
    // End caps
    this.drawLine(
      { x: startX, y: startY - 5 },
      { x: startX, y: startY + 5 },
      this.config.scaleColor,
      2
    );
    this.drawLine(
      { x: startX + scalePx, y: startY - 5 },
      { x: startX + scalePx, y: startY + 5 },
      this.config.scaleColor,
      2
    );
    
    // Label
    this.drawText(
      `${scaleLength} mm`,
      startX + scalePx / 2,
      startY + 10,
      this.config.scaleColor,
      10,
      'Arial',
      'center',
      'top'
    );
  }
  
  /**
   * Draw orientation labels (L/R/H/F)
   */
  private drawOrientationLabels(
    labels: BevImageData['orientationLabels'],
    collAngle: number
  ): void {
    const labelRadius = Math.min(this.width, this.height) / 2 - 25;
    
    for (const label of labels) {
      // Position label around circle, adjusted for collimator rotation
      const adjustedAngle = (label.angle - collAngle) * Math.PI / 180;
      
      const x = this.center.x + labelRadius * Math.cos(adjustedAngle - Math.PI / 2);
      const y = this.center.y + labelRadius * Math.sin(adjustedAngle - Math.PI / 2);
      
      this.drawTextWithShadow(
        label.label,
        x,
        y,
        this.config.labelColor,
        '#000000',
        this.config.orientationFontSize,
        'Arial',
        'center',
        'middle'
      );
    }
  }
  
  /**
   * Draw fixed-position labels (beam info, etc.)
   */
  private drawFixedLabels(data: BevImageData): void {
    const beam = data.beam;
    const cp = beam.controlPoints[data.controlPointIndex];
    
    // Beam name and info in top-left
    let y = 15;
    const lineHeight = 16;
    
    this.drawText(beam.beamName, 10, y, this.config.labelColor, 14, 'Arial');
    y += lineHeight;
    
    this.drawText(
      `Gantry: ${cp?.gantryAngle?.toFixed(1) ?? '-'}°`,
      10, y, this.config.labelColor, 12, 'Arial'
    );
    y += lineHeight;
    
    this.drawText(
      `Collimator: ${cp?.collimatorAngle?.toFixed(1) ?? '-'}°`,
      10, y, this.config.labelColor, 12, 'Arial'
    );
    y += lineHeight;
    
    this.drawText(
      `Couch: ${cp?.patientSupportAngle?.toFixed(1) ?? '-'}°`,
      10, y, this.config.labelColor, 12, 'Arial'
    );
    
    // MU in top-right
    this.drawText(
      `${beam.meterset.toFixed(1)} MU`,
      this.width - 10,
      15,
      this.config.labelColor,
      14,
      'Arial',
      'right'
    );
    
    // Control point indicator for dynamic beams
    if (beam.controlPoints.length > 2) {
      this.drawText(
        `CP ${data.controlPointIndex + 1}/${beam.controlPoints.length}`,
        this.width - 10,
        35,
        this.config.labelColor,
        12,
        'Arial',
        'right'
      );
    }
  }
  
  /**
   * Convert mm position (relative to isocenter) to canvas pixels
   */
  private mmToCanvas(mmPoint: Point2D): Point2D {
    return {
      x: this.center.x + mmPoint.x * this.pixelsPerMm * this.config.zoomLevel,
      y: this.center.y - mmPoint.y * this.pixelsPerMm * this.config.zoomLevel,  // Y inverted
    };
  }
  
  /**
   * Convert canvas pixels to mm position (relative to isocenter)
   */
  private canvasToMm(canvasPoint: Point2D): Point2D {
    return {
      x: (canvasPoint.x - this.center.x) / (this.pixelsPerMm * this.config.zoomLevel),
      y: -(canvasPoint.y - this.center.y) / (this.pixelsPerMm * this.config.zoomLevel),  // Y inverted
    };
  }
}
```

### Step 9.2: Create Structure Projector

Create `src/core/rendering/StructureProjector.ts`:

```typescript
import { Vector3, subVectors, normalizeVector, crossProduct } from '@core/geometry/Vector3';
import { Point2D, PatientOrientation } from '@types';
import { calculateSourcePosition, projectPointToBev } from '@core/geometry/transforms';

/**
 * Structure mesh data
 */
export interface StructureMesh {
  vertices: Vector3[];
  triangles: number[];  // Indices into vertices, grouped in 3s
}

/**
 * Projects 3D structure contours onto the BEV plane
 */
export class StructureProjector {
  private sourcePosition: Vector3;
  private isocenter: Vector3;
  private gantryAngle: number;
  private collimatorAngle: number;
  private patientOrientation: PatientOrientation;
  private sad: number;
  
  constructor(
    isocenter: Vector3,
    gantryAngle: number,
    collimatorAngle: number,
    patientOrientation: PatientOrientation,
    sad: number = 1000
  ) {
    this.isocenter = isocenter;
    this.gantryAngle = gantryAngle;
    this.collimatorAngle = collimatorAngle;
    this.patientOrientation = patientOrientation;
    this.sad = sad;
    
    this.sourcePosition = calculateSourcePosition(
      Vector3.from(isocenter),
      gantryAngle,
      sad,
      patientOrientation
    );
  }
  
  /**
   * Project structure mesh to BEV contours
   * Returns array of 2D contours in mm coordinates relative to isocenter
   */
  projectMesh(mesh: StructureMesh): Point2D[][] {
    const contours: Point2D[][] = [];
    
    // Find silhouette edges of the mesh as seen from source
    const silhouetteEdges = this.findSilhouetteEdges(mesh);
    
    // Connect silhouette edges into contours
    const edgeContours = this.connectEdges(silhouetteEdges);
    
    // Project contours to BEV plane
    for (const edgeContour of edgeContours) {
      const projectedContour: Point2D[] = [];
      
      for (const vertex of edgeContour) {
        const projected = projectPointToBev(
          Vector3.from(vertex),
          this.sourcePosition,
          Vector3.from(this.isocenter),
          this.gantryAngle,
          this.collimatorAngle,
          this.patientOrientation
        );
        
        if (!isNaN(projected.x) && !isNaN(projected.y)) {
          projectedContour.push(projected);
        }
      }
      
      if (projectedContour.length >= 3) {
        contours.push(projectedContour);
      }
    }
    
    return contours;
  }
  
  /**
   * Find silhouette edges of mesh
   * A silhouette edge is shared by a front-facing and back-facing triangle
   */
  private findSilhouetteEdges(mesh: StructureMesh): [Vector3, Vector3][] {
    const edges: [Vector3, Vector3][] = [];
    const viewDir = normalizeVector(subVectors(this.isocenter, this.sourcePosition));
    
    // Build edge-triangle adjacency
    const edgeMap = new Map<string, { triangles: number[]; vertices: [number, number] }>();
    
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const triIndex = i / 3;
      const v0 = mesh.triangles[i];
      const v1 = mesh.triangles[i + 1];
      const v2 = mesh.triangles[i + 2];
      
      // Add edges (sorted to ensure consistent key)
      const addEdge = (a: number, b: number) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { triangles: [], vertices: [Math.min(a, b), Math.max(a, b)] });
        }
        edgeMap.get(key)!.triangles.push(triIndex);
      };
      
      addEdge(v0, v1);
      addEdge(v1, v2);
      addEdge(v2, v0);
    }
    
    // Compute triangle facing (front or back)
    const triangleFacing: boolean[] = [];
    
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const v0 = mesh.vertices[mesh.triangles[i]];
      const v1 = mesh.vertices[mesh.triangles[i + 1]];
      const v2 = mesh.vertices[mesh.triangles[i + 2]];
      
      // Triangle normal
      const edge1 = subVectors(v1, v0);
      const edge2 = subVectors(v2, v0);
      const normal = crossProduct(edge1, edge2).normalize();
      
      // Front-facing if normal points toward source
      const toSource = normalizeVector(subVectors(this.sourcePosition, v0));
      const facing = normal.dot(toSource) > 0;
      triangleFacing.push(facing);
    }
    
    // Find silhouette edges (different facing on adjacent triangles)
    for (const [key, edgeData] of edgeMap) {
      const { triangles: triIndices, vertices } = edgeData;
      
      if (triIndices.length === 2) {
        // Interior edge
        if (triangleFacing[triIndices[0]] !== triangleFacing[triIndices[1]]) {
          // Silhouette edge!
          edges.push([mesh.vertices[vertices[0]], mesh.vertices[vertices[1]]]);
        }
      } else if (triIndices.length === 1) {
        // Boundary edge - always include
        edges.push([mesh.vertices[vertices[0]], mesh.vertices[vertices[1]]]);
      }
    }
    
    return edges;
  }
  
  /**
   * Connect silhouette edges into closed contours
   */
  private connectEdges(edges: [Vector3, Vector3][]): Vector3[][] {
    if (edges.length === 0) return [];
    
    const contours: Vector3[][] = [];
    const used = new Set<number>();
    
    // Build adjacency map
    const adjacency = new Map<string, number[]>();
    
    const vertexKey = (v: Vector3) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    
    for (let i = 0; i < edges.length; i++) {
      const [v0, v1] = edges[i];
      const key0 = vertexKey(v0);
      const key1 = vertexKey(v1);
      
      if (!adjacency.has(key0)) adjacency.set(key0, []);
      if (!adjacency.has(key1)) adjacency.set(key1, []);
      
      adjacency.get(key0)!.push(i);
      adjacency.get(key1)!.push(i);
    }
    
    // Follow edges to build contours
    while (used.size < edges.length) {
      // Find unused edge to start
      let startEdge = -1;
      for (let i = 0; i < edges.length; i++) {
        if (!used.has(i)) {
          startEdge = i;
          break;
        }
      }
      
      if (startEdge === -1) break;
      
      const contour: Vector3[] = [edges[startEdge][0], edges[startEdge][1]];
      used.add(startEdge);
      
      // Follow chain in both directions
      let currentVertex = edges[startEdge][1];
      
      while (true) {
        const key = vertexKey(currentVertex);
        const connectedEdges = adjacency.get(key) ?? [];
        
        let nextEdge = -1;
        for (const edgeIdx of connectedEdges) {
          if (!used.has(edgeIdx)) {
            nextEdge = edgeIdx;
            break;
          }
        }
        
        if (nextEdge === -1) break;
        
        used.add(nextEdge);
        
        // Get next vertex
        const [v0, v1] = edges[nextEdge];
        const nextVertex = v0.equals(currentVertex) ? v1 : v0;
        
        // Check if we've closed the loop
        if (nextVertex.equals(contour[0], 0.001)) {
          break;
        }
        
        contour.push(nextVertex);
        currentVertex = nextVertex;
      }
      
      if (contour.length >= 3) {
        contours.push(contour);
      }
    }
    
    return contours;
  }
}
```

---

## 10. CT Slice Overlay Renderer

### Step 10.1: Create CT Renderer Class

Create `src/core/rendering/CtRenderer.ts`:

```typescript
import { BaseRenderer } from './BaseRenderer';
import {
  CtRenderConfig,
  CtSliceImageData,
  Point2D,
  SliceOrientation,
} from '@types';

/**
 * Default CT slice rendering configuration
 */
export const defaultCtConfig: CtRenderConfig = {
  width: 512,
  height: 512,
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  windowWidth: 400,
  windowCenter: 40,
  showStructures: true,
  showIsodoses: true,
  showFieldLines: true,
  showSetupFieldLines: false,
  showIsocenter: true,
  showReferencePoints: true,
  showUserOrigin: false,
  isodoseDisplayMode: 'lines',
  colorwashOpacity: 0.5,
  colorwashMinDose: 0,
  colorwashMaxDose: 100,
};

/**
 * CT Slice Renderer with overlay support
 * 
 * Renders:
 * - CT image data with window/level
 * - Structure contours
 * - Isodose lines or colorwash
 * - Field projections (beam outlines)
 * - Isocenter markers
 * - Reference points
 */
export class CtRenderer extends BaseRenderer {
  private config: CtRenderConfig;
  private pixelsPerMm: number = 1;
  private center: Point2D = { x: 0, y: 0 };
  private imageOrigin: Point2D = { x: 0, y: 0 };  // Top-left of image in DICOM coords
  
  constructor(canvas: HTMLCanvasElement, config: Partial<CtRenderConfig> = {}) {
    super(canvas);
    this.config = { ...defaultCtConfig, ...config };
    this.updateLayout();
  }
  
  /**
   * Update layout calculations
   */
  private updateLayout(): void {
    this.center = {
      x: this.width / 2,
      y: this.height / 2,
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<CtRenderConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Set the scale factor (pixels per mm)
   */
  setScale(pixelsPerMm: number, imageOrigin: Point2D): void {
    this.pixelsPerMm = pixelsPerMm;
    this.imageOrigin = imageOrigin;
  }
  
  /**
   * Main render function
   */
  render(data: CtSliceImageData): void {
    // Clear canvas
    this.clear('#000000');
    
    this.save();
    
    // Apply zoom and pan
    this.translate(this.center.x + this.config.panOffset.x,
                   this.center.y + this.config.panOffset.y);
    this.scale(this.config.zoomLevel, this.config.zoomLevel);
    this.translate(-this.center.x, -this.center.y);
    
    // 1. Draw CT background
    this.drawCtImage(data.ctPixelData);
    
    // 2. Draw isodoses (behind structures if using colorwash)
    if (this.config.showIsodoses && data.isodoseContours.length > 0) {
      if (this.config.isodoseDisplayMode === 'colorwash' ||
          this.config.isodoseDisplayMode === 'both') {
        this.drawIsodoseColorwash(data.isodoseContours);
      }
    }
    
    // 3. Draw structures
    if (this.config.showStructures) {
      this.drawStructures(data.structureContours);
    }
    
    // 4. Draw isodose lines (on top of structures)
    if (this.config.showIsodoses && data.isodoseContours.length > 0) {
      if (this.config.isodoseDisplayMode === 'lines' ||
          this.config.isodoseDisplayMode === 'both') {
        this.drawIsodoseLines(data.isodoseContours);
      }
    }
    
    // 5. Draw field lines
    if (this.config.showFieldLines || this.config.showSetupFieldLines) {
      this.drawFieldProjections(data.fieldProjections);
    }
    
    // 6. Draw isocenter markers
    if (this.config.showIsocenter) {
      this.drawIsocenters(data.isocenterPositions);
    }
    
    // 7. Draw reference points
    if (this.config.showReferencePoints) {
      this.drawReferencePoints(data.referencePoints);
    }
    
    this.restore();
    
    // Draw fixed overlays (window/level info, etc.)
    this.drawOverlayInfo();
  }
  
  /**
   * Draw CT image data
   */
  private drawCtImage(ctData: ImageData): void {
    // Center the image
    const x = this.center.x - ctData.width / 2;
    const y = this.center.y - ctData.height / 2;
    
    this.drawImage(ctData, x, y);
  }
  
  /**
   * Draw structure contours
   */
  private drawStructures(structures: CtSliceImageData['structureContours']): void {
    for (const struct of structures) {
      for (const contour of struct.contours) {
        const canvasPoints = contour.map(p => this.dicomToCanvas(p));
        
        if (struct.filled && struct.fillOpacity > 0) {
          // Fill with transparency
          const fillColor = this.colorWithOpacity(struct.color, struct.fillOpacity);
          this.fillPolygon(canvasPoints, fillColor, struct.color, struct.lineWidth);
        } else {
          // Outline only
          this.drawPolyline(canvasPoints, struct.color, struct.lineWidth, true);
        }
      }
    }
  }
  
  /**
   * Draw isodose lines
   */
  private drawIsodoseLines(isodoses: CtSliceImageData['isodoseContours']): void {
    for (const isodose of isodoses) {
      for (const contour of isodose.contours) {
        const canvasPoints = contour.map(p => this.dicomToCanvas(p));
        this.drawPolyline(canvasPoints, isodose.color, isodose.lineWidth, true);
      }
    }
  }
  
  /**
   * Draw isodose colorwash
   * This creates a filled overlay showing dose distribution
   */
  private drawIsodoseColorwash(isodoses: CtSliceImageData['isodoseContours']): void {
    // Sort isodoses by dose level (highest first for proper layering)
    const sorted = [...isodoses].sort((a, b) => b.doseLevel - a.doseLevel);
    
    for (const isodose of sorted) {
      const fillColor = this.colorWithOpacity(isodose.color, this.config.colorwashOpacity);
      
      for (const contour of isodose.contours) {
        const canvasPoints = contour.map(p => this.dicomToCanvas(p));
        this.fillPolygon(canvasPoints, fillColor);
      }
    }
  }
  
  /**
   * Draw field projection lines (beam outline on CT slice)
   */
  private drawFieldProjections(projections: CtSliceImageData['fieldProjections']): void {
    for (const proj of projections) {
      // Skip setup fields if not enabled
      if (proj.isSetup && !this.config.showSetupFieldLines) continue;
      if (!proj.isSetup && !this.config.showFieldLines) continue;
      
      const canvasPoints = proj.outline.map(p => this.dicomToCanvas(p));
      
      // Use dashed line for setup fields
      const dash = proj.isSetup ? [5, 5] : undefined;
      this.drawPolyline(canvasPoints, proj.color, 2, true, dash);
    }
  }
  
  /**
   * Draw isocenter markers
   */
  private drawIsocenters(positions: Point2D[]): void {
    const markerSize = 8;
    const color = '#FF0000';  // Red for isocenter
    
    for (const pos of positions) {
      const canvasPos = this.dicomToCanvas(pos);
      
      // Cross marker
      this.drawLine(
        { x: canvasPos.x - markerSize, y: canvasPos.y },
        { x: canvasPos.x + markerSize, y: canvasPos.y },
        color,
        2
      );
      this.drawLine(
        { x: canvasPos.x, y: canvasPos.y - markerSize },
        { x: canvasPos.x, y: canvasPos.y + markerSize },
        color,
        2
      );
      
      // Circle around cross
      this.drawEllipse(canvasPos.x, canvasPos.y, markerSize, markerSize, color, 1);
    }
  }
  
  /**
   * Draw reference point markers
   */
  private drawReferencePoints(refPoints: CtSliceImageData['referencePoints']): void {
    const markerSize = 5;
    
    for (const rp of refPoints) {
      const canvasPos = this.dicomToCanvas(rp.position);
      
      // Diamond marker
      const points: Point2D[] = [
        { x: canvasPos.x, y: canvasPos.y - markerSize },
        { x: canvasPos.x + markerSize, y: canvasPos.y },
        { x: canvasPos.x, y: canvasPos.y + markerSize },
        { x: canvasPos.x - markerSize, y: canvasPos.y },
      ];
      
      this.fillPolygon(points, rp.color, rp.color, 1);
      
      // Label
      this.drawText(
        rp.id,
        canvasPos.x + markerSize + 3,
        canvasPos.y,
        rp.color,
        10,
        'Arial',
        'left',
        'middle'
      );
    }
  }
  
  /**
   * Draw overlay information (window/level, etc.)
   */
  private drawOverlayInfo(): void {
    // Window/Level in top-left
    this.drawText(
      `W: ${this.config.windowWidth.toFixed(0)} L: ${this.config.windowCenter.toFixed(0)}`,
      10,
      15,
      '#FFFFFF',
      12,
      'Arial'
    );
    
    // Zoom level
    this.drawText(
      `Zoom: ${(this.config.zoomLevel * 100).toFixed(0)}%`,
      10,
      30,
      '#FFFFFF',
      12,
      'Arial'
    );
  }
  
  /**
   * Convert DICOM coordinates to canvas pixels
   */
  private dicomToCanvas(dicomPoint: Point2D): Point2D {
    return {
      x: this.center.x + (dicomPoint.x - this.imageOrigin.x) * this.pixelsPerMm * this.config.zoomLevel,
      y: this.center.y + (dicomPoint.y - this.imageOrigin.y) * this.pixelsPerMm * this.config.zoomLevel,
    };
  }
  
  /**
   * Add opacity to a hex color
   */
  private colorWithOpacity(hexColor: string, opacity: number): string {
    // Convert hex to rgba
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  /**
   * Apply window/level to raw CT data
   * Returns ImageData ready for display
   */
  static applyWindowLevel(
    rawPixels: Int16Array,
    width: number,
    height: number,
    windowWidth: number,
    windowCenter: number
  ): ImageData {
    const imageData = new ImageData(width, height);
    const data = imageData.data;
    
    const windowMin = windowCenter - windowWidth / 2;
    const windowMax = windowCenter + windowWidth / 2;
    
    for (let i = 0; i < rawPixels.length; i++) {
      const hu = rawPixels[i];
      
      // Apply window/level
      let value: number;
      if (hu <= windowMin) {
        value = 0;
      } else if (hu >= windowMax) {
        value = 255;
      } else {
        value = ((hu - windowMin) / windowWidth) * 255;
      }
      
      // Set RGBA (grayscale)
      const pixelIndex = i * 4;
      data[pixelIndex] = value;      // R
      data[pixelIndex + 1] = value;  // G
      data[pixelIndex + 2] = value;  // B
      data[pixelIndex + 3] = 255;    // A
    }
    
    return imageData;
  }
}
```

---

## 11. React Component Architecture

### Step 11.1: Create BEV Viewer Component

Create `src/components/BevViewer/BevViewer.tsx`:

```typescript
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { BevRenderer, defaultBevConfig } from '@core/rendering/BevRenderer';
import { useBevRenderer } from '@hooks/useBevRenderer';
import { useCanvasInteraction } from '@hooks/useCanvasInteraction';
import { usePlanStore } from '@stores/planStore';
import { useViewerStore } from '@stores/viewerStore';
import { BevControls } from './BevControls';
import './BevViewer.css';

interface BevViewerProps {
  beamIndex: number;
  controlPointIndex?: number;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * BEV Viewer Component
 * 
 * Displays the Beam's Eye View for a selected beam,
 * with interactive pan/zoom and overlay controls.
 */
export const BevViewer: React.FC<BevViewerProps> = ({
  beamIndex,
  controlPointIndex = 0,
  width = 512,
  height = 512,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<BevRenderer | null>(null);
  
  // Store hooks
  const plan = usePlanStore((state) => state.currentPlan);
  const structures = usePlanStore((state) => state.structures);
  const bevConfig = useViewerStore((state) => state.bevConfig);
  const updateBevConfig = useViewerStore((state) => state.updateBevConfig);
  
  // Local state
  const [actualControlPoint, setActualControlPoint] = useState(controlPointIndex);
  
  // Get current beam
  const beam = plan?.beams[beamIndex];
  
  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    
    rendererRef.current = new BevRenderer(canvasRef.current, bevConfig);
    
    return () => {
      rendererRef.current = null;
    };
  }, []);
  
  // Update renderer config when store changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateConfig(bevConfig);
    }
  }, [bevConfig]);
  
  // Prepare and render BEV data
  const { bevImageData, isLoading, error } = useBevRenderer(
    beam,
    actualControlPoint,
    structures
  );
  
  // Render when data changes
  useEffect(() => {
    if (rendererRef.current && bevImageData && !isLoading) {
      // Set MLC model
      rendererRef.current.setMlcModel(beam?.mlcModel);
      
      // Render
      rendererRef.current.render(bevImageData);
    }
  }, [bevImageData, isLoading, beam?.mlcModel]);
  
  // Canvas interaction (pan/zoom)
  const { handlers, transform } = useCanvasInteraction(
    canvasRef,
    (zoom, pan) => {
      updateBevConfig({
        zoomLevel: zoom,
        panOffset: pan,
      });
    }
  );
  
  // Control point navigation for dynamic beams
  const handleControlPointChange = useCallback((index: number) => {
    if (beam && index >= 0 && index < beam.controlPoints.length) {
      setActualControlPoint(index);
    }
  }, [beam]);
  
  // Reset view
  const handleResetView = useCallback(() => {
    updateBevConfig({
      zoomLevel: 1.0,
      panOffset: { x: 0, y: 0 },
    });
  }, [updateBevConfig]);
  
  if (!beam) {
    return (
      <div className={`bev-viewer ${className}`}>
        <div className="bev-viewer__empty">No beam selected</div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className={`bev-viewer ${className}`}
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bev-viewer__canvas"
        onMouseDown={handlers.onMouseDown}
        onMouseMove={handlers.onMouseMove}
        onMouseUp={handlers.onMouseUp}
        onMouseLeave={handlers.onMouseLeave}
        onWheel={handlers.onWheel}
      />
      
      {isLoading && (
        <div className="bev-viewer__loading">Loading...</div>
      )}
      
      {error && (
        <div className="bev-viewer__error">{error.message}</div>
      )}
      
      <BevControls
        beam={beam}
        controlPointIndex={actualControlPoint}
        onControlPointChange={handleControlPointChange}
        onResetView={handleResetView}
        config={bevConfig}
        onConfigChange={updateBevConfig}
      />
    </div>
  );
};

export default BevViewer;
```

### Step 11.2: Create BEV Controls Component

Create `src/components/BevViewer/BevControls.tsx`:

```typescript
import React from 'react';
import { Beam, BevRenderConfig } from '@types';
import './BevControls.css';

interface BevControlsProps {
  beam: Beam;
  controlPointIndex: number;
  onControlPointChange: (index: number) => void;
  onResetView: () => void;
  config: BevRenderConfig;
  onConfigChange: (config: Partial<BevRenderConfig>) => void;
}

/**
 * Controls panel for BEV viewer
 */
export const BevControls: React.FC<BevControlsProps> = ({
  beam,
  controlPointIndex,
  onControlPointChange,
  onResetView,
  config,
  onConfigChange,
}) => {
  const numControlPoints = beam.controlPoints.length;
  const isDynamic = numControlPoints > 2;
  
  return (
    <div className="bev-controls">
      {/* Control Point Navigation */}
      {isDynamic && (
        <div className="bev-controls__cp-nav">
          <button
            onClick={() => onControlPointChange(controlPointIndex - 1)}
            disabled={controlPointIndex <= 0}
            className="bev-controls__btn"
          >
            ◀
          </button>
          
          <span className="bev-controls__cp-label">
            CP {controlPointIndex + 1} / {numControlPoints}
          </span>
          
          <button
            onClick={() => onControlPointChange(controlPointIndex + 1)}
            disabled={controlPointIndex >= numControlPoints - 1}
            className="bev-controls__btn"
          >
            ▶
          </button>
          
          {/* Slider for quick navigation */}
          <input
            type="range"
            min={0}
            max={numControlPoints - 1}
            value={controlPointIndex}
            onChange={(e) => onControlPointChange(parseInt(e.target.value))}
            className="bev-controls__slider"
          />
        </div>
      )}
      
      {/* Display Options */}
      <div className="bev-controls__options">
        <label className="bev-controls__checkbox">
          <input
            type="checkbox"
            checked={config.showStructures}
            onChange={(e) => onConfigChange({ showStructures: e.target.checked })}
          />
          <span>Structures</span>
        </label>
        
        <label className="bev-controls__checkbox">
          <input
            type="checkbox"
            checked={config.showReferencePoints}
            onChange={(e) => onConfigChange({ showReferencePoints: e.target.checked })}
          />
          <span>Ref Points</span>
        </label>
        
        <label className="bev-controls__checkbox">
          <input
            type="checkbox"
            checked={config.showJawLabels}
            onChange={(e) => onConfigChange({ showJawLabels: e.target.checked })}
          />
          <span>Jaw Labels</span>
        </label>
        
        <label className="bev-controls__checkbox">
          <input
            type="checkbox"
            checked={config.showDrrImage}
            onChange={(e) => onConfigChange({ showDrrImage: e.target.checked })}
          />
          <span>DRR</span>
        </label>
      </div>
      
      {/* Reset Button */}
      <button
        onClick={onResetView}
        className="bev-controls__reset"
      >
        Reset View
      </button>
    </div>
  );
};

export default BevControls;
```

### Step 11.3: Create Canvas Interaction Hook

Create `src/hooks/useCanvasInteraction.ts`:

```typescript
import { useCallback, useState, useRef, RefObject } from 'react';
import { Point2D } from '@types';

interface InteractionState {
  isDragging: boolean;
  startPos: Point2D;
  lastPos: Point2D;
}

interface InteractionHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
}

interface TransformState {
  zoom: number;
  pan: Point2D;
}

/**
 * Hook for handling canvas pan/zoom interactions
 */
export function useCanvasInteraction(
  canvasRef: RefObject<HTMLCanvasElement>,
  onChange: (zoom: number, pan: Point2D) => void,
  options: {
    minZoom?: number;
    maxZoom?: number;
    zoomSensitivity?: number;
  } = {}
): {
  handlers: InteractionHandlers;
  transform: TransformState;
  reset: () => void;
} {
  const {
    minZoom = 0.1,
    maxZoom = 10,
    zoomSensitivity = 0.001,
  } = options;
  
  const [transform, setTransform] = useState<TransformState>({
    zoom: 1,
    pan: { x: 0, y: 0 },
  });
  
  const stateRef = useRef<InteractionState>({
    isDragging: false,
    startPos: { x: 0, y: 0 },
    lastPos: { x: 0, y: 0 },
  });
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    stateRef.current.isDragging = true;
    stateRef.current.startPos = { x: e.clientX, y: e.clientY };
    stateRef.current.lastPos = { x: e.clientX, y: e.clientY };
    
    // Prevent text selection
    e.preventDefault();
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!stateRef.current.isDragging) return;
    
    const dx = e.clientX - stateRef.current.lastPos.x;
    const dy = e.clientY - stateRef.current.lastPos.y;
    
    stateRef.current.lastPos = { x: e.clientX, y: e.clientY };
    
    setTransform((prev) => {
      const newPan = {
        x: prev.pan.x + dx,
        y: prev.pan.y + dy,
      };
      
      onChange(prev.zoom, newPan);
      
      return { ...prev, pan: newPan };
    });
  }, [onChange]);
  
  const handleMouseUp = useCallback(() => {
    stateRef.current.isDragging = false;
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    stateRef.current.isDragging = false;
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = -e.deltaY * zoomSensitivity;
    
    setTransform((prev) => {
      let newZoom = prev.zoom * (1 + delta);
      newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
      
      // Zoom toward mouse position
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const zoomRatio = newZoom / prev.zoom;
        
        const newPan = {
          x: mouseX - (mouseX - prev.pan.x) * zoomRatio,
          y: mouseY - (mouseY - prev.pan.y) * zoomRatio,
        };
        
        // Recalculate to zoom toward mouse
        const dx = (mouseX - centerX - prev.pan.x) * (1 - zoomRatio);
        const dy = (mouseY - centerY - prev.pan.y) * (1 - zoomRatio);
        
        const adjustedPan = {
          x: prev.pan.x + dx,
          y: prev.pan.y + dy,
        };
        
        onChange(newZoom, adjustedPan);
        
        return { zoom: newZoom, pan: adjustedPan };
      }
      
      onChange(newZoom, prev.pan);
      return { ...prev, zoom: newZoom };
    });
  }, [canvasRef, minZoom, maxZoom, zoomSensitivity, onChange]);
  
  const reset = useCallback(() => {
    setTransform({ zoom: 1, pan: { x: 0, y: 0 } });
    onChange(1, { x: 0, y: 0 });
  }, [onChange]);
  
  return {
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onWheel: handleWheel,
    },
    transform,
    reset,
  };
}
```

### Step 11.4: Create BEV Renderer Hook

Create `src/hooks/useBevRenderer.ts`:

```typescript
import { useState, useEffect, useMemo } from 'react';
import { Beam, BevImageData, StructureMesh, ProjectedStructure } from '@types';
import { StructureProjector } from '@core/rendering/StructureProjector';
import { Vector3 } from '@core/geometry/Vector3';
import { getBevOrientationLabels } from '@core/geometry/transforms';

interface Structure {
  id: string;
  name: string;
  color: string;
  mesh: StructureMesh;
  visible: boolean;
}

/**
 * Hook for preparing BEV rendering data
 */
export function useBevRenderer(
  beam: Beam | undefined,
  controlPointIndex: number,
  structures: Structure[]
): {
  bevImageData: BevImageData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [bevImageData, setBevImageData] = useState<BevImageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Memoize structure projector
  const projector = useMemo(() => {
    if (!beam) return null;
    
    const cp = beam.controlPoints[controlPointIndex];
    if (!cp) return null;
    
    return new StructureProjector(
      Vector3.from(cp.isocenterPosition),
      cp.gantryAngle,
      cp.collimatorAngle,
      'HFS',  // TODO: Get from plan
      beam.sourceAxisDistance
    );
  }, [beam, controlPointIndex]);
  
  useEffect(() => {
    if (!beam || !projector) {
      setBevImageData(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Use async to allow UI updates
    const prepareData = async () => {
      try {
        const cp = beam.controlPoints[controlPointIndex];
        
        // Project visible structures
        const projectedStructures: ProjectedStructure[] = [];
        
        for (const struct of structures) {
          if (!struct.visible) continue;
          
          const contours = projector.projectMesh(struct.mesh);
          
          if (contours.length > 0) {
            projectedStructures.push({
              structureId: struct.id,
              contours,
              color: struct.color,
              lineWidth: 1,
            });
          }
        }
        
        // Get orientation labels
        const orientationLabels = getBevOrientationLabels(
          cp.gantryAngle,
          cp.patientSupportAngle,
          'HFS'  // TODO: Get from plan
        );
        
        // Build field shape
        const fieldShape = {
          jawRect: {
            x: cp.jawPositions.x1,
            y: cp.jawPositions.y1,
            width: cp.jawPositions.x2 - cp.jawPositions.x1,
            height: cp.jawPositions.y2 - cp.jawPositions.y1,
          },
          mlcOutline: [],  // Will be computed by renderer
          blockOutlines: beam.blocks.map(b => b.outline[0] || []),
          applicatorRect: undefined,
          isCircularApplicator: false,
        };
        
        // Handle applicator
        if (beam.applicator) {
          // Parse applicator size from ID (e.g., "A10" = 10x10, "C10" = 10cm cone)
          const sizeMatch = beam.applicator.id.match(/(\d+)/);
          const size = sizeMatch ? parseFloat(sizeMatch[1]) * 10 : 100;  // mm
          
          fieldShape.applicatorRect = {
            x: -size / 2,
            y: -size / 2,
            width: size,
            height: size,
          };
          
          fieldShape.isCircularApplicator = beam.applicator.id.startsWith('C');
        }
        
        // Build wedge triangles
        const wedgeTriangles: Point2D[][] = [];
        // (Triangles computed by renderer based on wedge direction)
        
        const data: BevImageData = {
          beam,
          controlPointIndex,
          drrImage: undefined,  // TODO: Load DRR if available
          fieldShape,
          wedgeTriangles,
          projectedStructures,
          referencePoints: [],  // TODO: Add reference point support
          orientationLabels,
        };
        
        setBevImageData(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };
    
    prepareData();
  }, [beam, controlPointIndex, structures, projector]);
  
  return { bevImageData, isLoading, error };
}
```

---

## 12. State Management

### Step 12.1: Create Plan Store

Create `src/stores/planStore.ts`:

```typescript
import { create } from 'zustand';
import { RtPlan, Beam, ControlPoint } from '@types';

interface StructureData {
  id: string;
  name: string;
  color: string;
  mesh: StructureMesh;
  visible: boolean;
  lineWidth: number;
  filled: boolean;
  fillOpacity: number;
}

interface PlanState {
  // Data
  currentPlan: RtPlan | null;
  structures: StructureData[];
  selectedBeamIndex: number;
  selectedControlPointIndex: number;
  
  // Loading states
  isPlanLoading: boolean;
  isStructuresLoading: boolean;
  error: Error | null;
  
  // Actions
  setPlan: (plan: RtPlan) => void;
  clearPlan: () => void;
  setStructures: (structures: StructureData[]) => void;
  updateStructureVisibility: (structureId: string, visible: boolean) => void;
  updateStructureColor: (structureId: string, color: string) => void;
  selectBeam: (index: number) => void;
  selectControlPoint: (index: number) => void;
  setLoading: (key: 'plan' | 'structures', loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  // Initial state
  currentPlan: null,
  structures: [],
  selectedBeamIndex: 0,
  selectedControlPointIndex: 0,
  isPlanLoading: false,
  isStructuresLoading: false,
  error: null,
  
  // Actions
  setPlan: (plan) => set({
    currentPlan: plan,
    selectedBeamIndex: 0,
    selectedControlPointIndex: 0,
    error: null,
  }),
  
  clearPlan: () => set({
    currentPlan: null,
    structures: [],
    selectedBeamIndex: 0,
    selectedControlPointIndex: 0,
  }),
  
  setStructures: (structures) => set({ structures }),
  
  updateStructureVisibility: (structureId, visible) => set((state) => ({
    structures: state.structures.map((s) =>
      s.id === structureId ? { ...s, visible } : s
    ),
  })),
  
  updateStructureColor: (structureId, color) => set((state) => ({
    structures: state.structures.map((s) =>
      s.id === structureId ? { ...s, color } : s
    ),
  })),
  
  selectBeam: (index) => {
    const { currentPlan } = get();
    if (!currentPlan || index < 0 || index >= currentPlan.beams.length) return;
    
    set({
      selectedBeamIndex: index,
      selectedControlPointIndex: 0,  // Reset to first CP
    });
  },
  
  selectControlPoint: (index) => {
    const { currentPlan, selectedBeamIndex } = get();
    const beam = currentPlan?.beams[selectedBeamIndex];
    if (!beam || index < 0 || index >= beam.controlPoints.length) return;
    
    set({ selectedControlPointIndex: index });
  },
  
  setLoading: (key, loading) => {
    if (key === 'plan') {
      set({ isPlanLoading: loading });
    } else {
      set({ isStructuresLoading: loading });
    }
  },
  
  setError: (error) => set({ error }),
}));
```

### Step 12.2: Create Viewer Store

Create `src/stores/viewerStore.ts`:

```typescript
import { create } from 'zustand';
import { BevRenderConfig, CtRenderConfig, Point2D, SliceOrientation } from '@types';
import { defaultBevConfig } from '@core/rendering/BevRenderer';
import { defaultCtConfig } from '@core/rendering/CtRenderer';

interface ViewerState {
  // BEV config
  bevConfig: BevRenderConfig;
  
  // CT config
  ctConfig: CtRenderConfig;
  
  // CT slice selection
  sliceOrientation: SliceOrientation;
  sliceLocation: number;  // mm
  
  // Actions
  updateBevConfig: (config: Partial<BevRenderConfig>) => void;
  resetBevConfig: () => void;
  
  updateCtConfig: (config: Partial<CtRenderConfig>) => void;
  resetCtConfig: () => void;
  
  setSliceOrientation: (orientation: SliceOrientation) => void;
  setSliceLocation: (location: number) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  // Initial state
  bevConfig: { ...defaultBevConfig },
  ctConfig: { ...defaultCtConfig },
  sliceOrientation: 'transverse',
  sliceLocation: 0,
  
  // BEV actions
  updateBevConfig: (config) => set((state) => ({
    bevConfig: { ...state.bevConfig, ...config },
  })),
  
  resetBevConfig: () => set({ bevConfig: { ...defaultBevConfig } }),
  
  // CT actions
  updateCtConfig: (config) => set((state) => ({
    ctConfig: { ...state.ctConfig, ...config },
  })),
  
  resetCtConfig: () => set({ ctConfig: { ...defaultCtConfig } }),
  
  // Slice navigation
  setSliceOrientation: (orientation) => set({ sliceOrientation: orientation }),
  setSliceLocation: (location) => set({ sliceLocation: location }),
}));
```

---

## 13. Performance Optimization

### Step 13.1: Web Worker for Heavy Computation

Create `src/workers/structureProjection.worker.ts`:

```typescript
// Web Worker for structure projection
// Offloads CPU-intensive mesh projection from main thread

import { StructureMesh, Point2D, Vector3 } from '@types';

interface ProjectionRequest {
  type: 'project';
  meshes: {
    id: string;
    mesh: StructureMesh;
  }[];
  sourcePosition: Vector3;
  isocenter: Vector3;
  gantryAngle: number;
  collimatorAngle: number;
}

interface ProjectionResponse {
  type: 'result';
  projections: {
    id: string;
    contours: Point2D[][];
  }[];
}

self.onmessage = (e: MessageEvent<ProjectionRequest>) => {
  if (e.data.type === 'project') {
    const { meshes, sourcePosition, isocenter, gantryAngle, collimatorAngle } = e.data;
    
    const projections = meshes.map(({ id, mesh }) => {
      // Perform projection calculation
      const contours = projectMeshToContours(
        mesh,
        sourcePosition,
        isocenter,
        gantryAngle,
        collimatorAngle
      );
      
      return { id, contours };
    });
    
    self.postMessage({ type: 'result', projections } as ProjectionResponse);
  }
};

function projectMeshToContours(
  mesh: StructureMesh,
  sourcePosition: Vector3,
  isocenter: Vector3,
  gantryAngle: number,
  collimatorAngle: number
): Point2D[][] {
  // Implementation of mesh projection algorithm
  // (Similar to StructureProjector but standalone)
  
  // ... projection logic ...
  
  return [];
}
```

### Step 13.2: Use Web Worker from Hook

Update `src/hooks/useBevRenderer.ts` to use Web Worker:

```typescript
import { useRef, useEffect, useState } from 'react';

export function useBevRenderer(/* ... */) {
  const workerRef = useRef<Worker | null>(null);
  
  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(
      new URL('../workers/structureProjection.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    return () => {
      workerRef.current?.terminate();
    };
  }, []);
  
  // Use worker for projection
  const projectStructures = useCallback((meshes: StructureMesh[]) => {
    return new Promise<Point2D[][]>((resolve) => {
      if (!workerRef.current) {
        resolve([]);
        return;
      }
      
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'result') {
          resolve(e.data.projections);
        }
      };
      
      workerRef.current.postMessage({
        type: 'project',
        meshes,
        // ... other params
      });
    });
  }, []);
  
  // ... rest of hook
}
```

### Step 13.3: Canvas Optimization Tips

```typescript
/**
 * Performance optimization strategies for canvas rendering
 */

// 1. Use requestAnimationFrame for smooth updates
function optimizedRender(renderer: BevRenderer, data: BevImageData) {
  requestAnimationFrame(() => {
    renderer.render(data);
  });
}

// 2. Batch multiple updates
class RenderScheduler {
  private pending = false;
  private data: BevImageData | null = null;
  
  schedule(renderer: BevRenderer, data: BevImageData) {
    this.data = data;
    
    if (!this.pending) {
      this.pending = true;
      requestAnimationFrame(() => {
        if (this.data) {
          renderer.render(this.data);
        }
        this.pending = false;
      });
    }
  }
}

// 3. Use OffscreenCanvas for background rendering
async function renderOffscreen(
  width: number,
  height: number,
  renderFn: (ctx: OffscreenCanvasRenderingContext2D) => void
): Promise<ImageBitmap> {
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');
  
  renderFn(ctx);
  
  return offscreen.transferToImageBitmap();
}

// 4. Cache static elements (scale, crosshair, labels)
class CachedBevRenderer extends BevRenderer {
  private staticCache: ImageBitmap | null = null;
  
  private renderStaticElements(): ImageBitmap {
    // Render crosshair, scale, orientation labels to offscreen canvas
    // Return cached bitmap
  }
  
  render(data: BevImageData) {
    // Draw dynamic elements
    super.render(data);
    
    // Composite cached static elements
    if (this.staticCache) {
      this.ctx.drawImage(this.staticCache, 0, 0);
    }
  }
}

// 5. Debounce resize events
function useDebounceResize(delay: number = 100) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const timeoutRef = useRef<number>();
  
  useEffect(() => {
    const handleResize = () => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, delay);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [delay]);
  
  return size;
}
```

---

## 14. Testing Strategy

### Step 14.1: Unit Tests for Geometry

Create `src/core/geometry/__tests__/Vector3.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Vector3, addVectors, crossProduct, normalizeVector } from '../Vector3';

describe('Vector3', () => {
  describe('constructor', () => {
    it('should create vector with default values', () => {
      const v = new Vector3();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
      expect(v.z).toBe(0);
    });
    
    it('should create vector with specified values', () => {
      const v = new Vector3(1, 2, 3);
      expect(v.x).toBe(1);
      expect(v.y).toBe(2);
      expect(v.z).toBe(3);
    });
  });
  
  describe('operations', () => {
    it('should calculate correct length', () => {
      const v = new Vector3(3, 4, 0);
      expect(v.length()).toBe(5);
    });
    
    it('should normalize correctly', () => {
      const v = new Vector3(3, 0, 0);
      v.normalize();
      expect(v.x).toBe(1);
      expect(v.y).toBe(0);
      expect(v.z).toBe(0);
    });
    
    it('should calculate dot product', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = new Vector3(4, 5, 6);
      expect(v1.dot(v2)).toBe(32);  // 1*4 + 2*5 + 3*6 = 32
    });
    
    it('should calculate cross product', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const result = v1.cross(v2);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(1);
    });
  });
  
  describe('rotation', () => {
    it('should rotate around Z axis', () => {
      const v = new Vector3(1, 0, 0);
      v.rotateZ(Math.PI / 2);  // 90 degrees
      expect(v.x).toBeCloseTo(0);
      expect(v.y).toBeCloseTo(1);
      expect(v.z).toBeCloseTo(0);
    });
  });
});
```

### Step 14.2: Integration Tests for DICOM Parser

Create `src/core/dicom/__tests__/RtPlanParser.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { RtPlanParser } from '../RtPlanParser';
import fs from 'fs';
import path from 'path';

describe('RtPlanParser', () => {
  let parser: RtPlanParser;
  
  beforeAll(() => {
    // Load test DICOM file
    const testFile = path.join(__dirname, 'fixtures', 'test-rtplan.dcm');
    const buffer = fs.readFileSync(testFile);
    parser = new RtPlanParser(buffer.buffer);
  });
  
  it('should parse plan metadata', () => {
    const plan = parser.parse();
    expect(plan.rtPlanLabel).toBeDefined();
    expect(plan.patientId).toBeDefined();
  });
  
  it('should parse beams correctly', () => {
    const plan = parser.parse();
    expect(plan.beams.length).toBeGreaterThan(0);
    
    const beam = plan.beams[0];
    expect(beam.beamNumber).toBeDefined();
    expect(beam.beamName).toBeDefined();
    expect(beam.controlPoints.length).toBeGreaterThan(0);
  });
  
  it('should parse control points with jaw positions', () => {
    const plan = parser.parse();
    const cp = plan.beams[0].controlPoints[0];
    
    expect(cp.jawPositions).toBeDefined();
    expect(typeof cp.jawPositions.x1).toBe('number');
    expect(typeof cp.jawPositions.x2).toBe('number');
    expect(typeof cp.jawPositions.y1).toBe('number');
    expect(typeof cp.jawPositions.y2).toBe('number');
  });
  
  it('should determine arc vs static beam correctly', () => {
    const plan = parser.parse();
    
    for (const beam of plan.beams) {
      const isArc = beam.controlPoints.length > 2 &&
                    beam.controlPoints[0].gantryDirection !== 'NONE';
      expect(beam.isArc).toBe(isArc);
    }
  });
});
```

### Step 14.3: Component Tests

Create `src/components/BevViewer/__tests__/BevViewer.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BevViewer } from '../BevViewer';
import { usePlanStore } from '@stores/planStore';

// Mock stores
vi.mock('@stores/planStore');
vi.mock('@stores/viewerStore');

describe('BevViewer', () => {
  it('should show empty state when no beam selected', () => {
    vi.mocked(usePlanStore).mockReturnValue({
      currentPlan: null,
      structures: [],
    });
    
    render(<BevViewer beamIndex={0} />);
    
    expect(screen.getByText('No beam selected')).toBeInTheDocument();
  });
  
  it('should render canvas when beam is available', () => {
    vi.mocked(usePlanStore).mockReturnValue({
      currentPlan: {
        beams: [{
          beamNumber: 1,
          beamName: 'Test Beam',
          controlPoints: [{ /* ... */ }],
          // ... other beam properties
        }],
      },
      structures: [],
    });
    
    render(<BevViewer beamIndex={0} />);
    
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
  
  it('should handle zoom via mouse wheel', () => {
    // ... test implementation
  });
});
```

---

## 15. Complete Code Examples

### Step 15.1: Main Application Entry

Create `src/App.tsx`:

```typescript
import React, { useEffect } from 'react';
import { BevViewer } from '@components/BevViewer';
import { CtSliceViewer } from '@components/CtSliceViewer';
import { BeamSelector } from '@components/BeamSelector';
import { StructureList } from '@components/StructureList';
import { usePlanStore } from '@stores/planStore';
import { useDicomLoader } from '@hooks/useDicomLoader';
import './App.css';

function App() {
  const { loadPlan, loadStructures } = useDicomLoader();
  const plan = usePlanStore((state) => state.currentPlan);
  const selectedBeamIndex = usePlanStore((state) => state.selectedBeamIndex);
  const error = usePlanStore((state) => state.error);
  
  // Handle file drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files);
    
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      
      // Detect file type and load appropriately
      // (Implementation depends on DICOM SOP class detection)
      await loadPlan(buffer);
    }
  };
  
  return (
    <div className="app" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <header className="app__header">
        <h1>RT Plan Viewer</h1>
        {plan && <span>{plan.rtPlanLabel}</span>}
      </header>
      
      <main className="app__main">
        {!plan ? (
          <div className="app__dropzone">
            <p>Drop DICOM RT Plan file here</p>
          </div>
        ) : (
          <div className="app__layout">
            {/* Left panel: Structure list */}
            <aside className="app__sidebar">
              <StructureList />
              <BeamSelector />
            </aside>
            
            {/* Center: Viewers */}
            <div className="app__viewers">
              <div className="app__viewer-row">
                <BevViewer
                  beamIndex={selectedBeamIndex}
                  width={512}
                  height={512}
                />
                <CtSliceViewer
                  orientation="transverse"
                  width={512}
                  height={512}
                />
              </div>
              <div className="app__viewer-row">
                <CtSliceViewer
                  orientation="coronal"
                  width={512}
                  height={512}
                />
                <CtSliceViewer
                  orientation="sagittal"
                  width={512}
                  height={512}
                />
              </div>
            </div>
          </div>
        )}
      </main>
      
      {error && (
        <div className="app__error">
          Error: {error.message}
        </div>
      )}
    </div>
  );
}

export default App;
```

### Step 15.2: CSS Styles

Create `src/App.css`:

```css
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #1a1a2e;
  color: #eaeaea;
  font-family: 'Inter', system-ui, sans-serif;
}

.app__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background-color: #16213e;
  border-bottom: 1px solid #0f3460;
}

.app__header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #00fff5;
}

.app__main {
  flex: 1;
  display: flex;
  padding: 1rem;
}

.app__dropzone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #0f3460;
  border-radius: 12px;
  margin: 2rem;
}

.app__dropzone p {
  font-size: 1.25rem;
  color: #7a7a9d;
}

.app__layout {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.app__sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.app__viewers {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.app__viewer-row {
  display: flex;
  gap: 1rem;
}

.app__error {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  background-color: #e94560;
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
}

/* BEV Viewer Styles */
.bev-viewer {
  position: relative;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
}

.bev-viewer__canvas {
  display: block;
  cursor: grab;
}

.bev-viewer__canvas:active {
  cursor: grabbing;
}

.bev-viewer__loading,
.bev-viewer__error,
.bev-viewer__empty {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  color: #eaeaea;
}

.bev-viewer__error {
  color: #e94560;
}

/* BEV Controls */
.bev-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bev-controls__cp-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bev-controls__btn {
  padding: 0.25rem 0.5rem;
  background-color: #0f3460;
  border: none;
  border-radius: 4px;
  color: #eaeaea;
  cursor: pointer;
  transition: background-color 0.2s;
}

.bev-controls__btn:hover:not(:disabled) {
  background-color: #1a5fab;
}

.bev-controls__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bev-controls__cp-label {
  font-size: 0.875rem;
  min-width: 80px;
  text-align: center;
}

.bev-controls__slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: #0f3460;
  border-radius: 2px;
}

.bev-controls__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #00fff5;
  border-radius: 50%;
  cursor: pointer;
}

.bev-controls__options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bev-controls__checkbox {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.bev-controls__checkbox input {
  cursor: pointer;
}

.bev-controls__reset {
  padding: 0.25rem 0.75rem;
  background-color: transparent;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #eaeaea;
  cursor: pointer;
  align-self: flex-end;
  font-size: 0.75rem;
}

.bev-controls__reset:hover {
  background-color: #0f3460;
}
```

---

## Summary Checklist

### Phase 1: Setup (Day 1-2)
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure TypeScript paths and aliases
- [ ] Install dependencies (dcmjs, zustand, gl-matrix)
- [ ] Create directory structure

### Phase 2: Core Types (Day 2-3)
- [ ] Define geometry types (Vector3, Point2D, Matrix4, etc.)
- [ ] Define DICOM types (RtPlan, Beam, ControlPoint, etc.)
- [ ] Define rendering types (configs, image data structures)

### Phase 3: DICOM Parsing (Day 3-5)
- [ ] Implement base DicomParser class
- [ ] Implement RtPlanParser with full control point parsing
- [ ] Implement RtStructParser for structure sets
- [ ] Add test fixtures and unit tests

### Phase 4: Geometry & Transforms (Day 5-7)
- [ ] Implement Vector3 class with all operations
- [ ] Implement Matrix4 utilities
- [ ] Implement coordinate transformations
- [ ] Implement patient orientation handling

### Phase 5: MLC Models (Day 7-8)
- [ ] Implement base MlcModel class
- [ ] Implement Millennium120 model
- [ ] Implement Agility model
- [ ] Add MLC outline computation

### Phase 6: Canvas Rendering (Day 8-12)
- [ ] Implement BaseRenderer with drawing utilities
- [ ] Implement BevRenderer with all elements
- [ ] Implement CtRenderer with overlays
- [ ] Implement StructureProjector

### Phase 7: React Components (Day 12-15)
- [ ] Create BevViewer component
- [ ] Create CtSliceViewer component
- [ ] Create control panels
- [ ] Implement interaction hooks

### Phase 8: State Management (Day 15-16)
- [ ] Set up Zustand stores
- [ ] Implement plan store
- [ ] Implement viewer store
- [ ] Connect components to stores

### Phase 9: Optimization (Day 16-18)
- [ ] Add Web Worker for mesh projection
- [ ] Implement render scheduling
- [ ] Add canvas caching
- [ ] Profile and optimize

### Phase 10: Testing & Polish (Day 18-20)
- [ ] Write unit tests for all core modules
- [ ] Write integration tests for parsers
- [ ] Write component tests
- [ ] Final UI polish

---

## Key Differences from C#/WPF

| Aspect | C#/WPF | React/TypeScript |
|--------|--------|------------------|
| Rendering | DrawingContext, Geometry | Canvas 2D API |
| Data Binding | XAML Binding | React state/props |
| Threading | Thread, Dispatcher | Web Workers, async |
| Collections | ObservableCollection | Array + useState |
| MVVM | INotifyPropertyChanged | Zustand stores |
| Path Geometry | PathFigure, PathSegment | Path2D or manual |
| Transforms | TransformGroup | ctx.transform() |
| Bitmaps | WriteableBitmap | ImageData |
| Events | RoutedEvent | React synthetic events |

This guide provides a complete roadmap for converting the RT Plan overlay and BEV rendering functionality to a modern React/TypeScript application. Follow the phases in order, and refer to the code examples for implementation details.
