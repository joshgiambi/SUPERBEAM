import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Ruler, Target, Trash2, X, LayoutPanelLeft, PanelRightDashed, Maximize2, User } from "lucide-react";
import { SimpleBrushTool } from "./simple-brush-tool";
import { AITumorTool } from "./ai-tumor-tool";
import { PenToolUnifiedV2 } from "./pen-tool-unified-v2";
import { EclipsePlanarContourTool } from "./eclipse-planar-contour-tool";
import { PenTool } from "./pen-tool";
import PenToolV2 from "./pen-tool-v2";
import { GhostContourOverlay } from "./ghost-contour-overlay";

import { MeasurementTool } from "./measurement-tool";
import { MPRFloating } from './mpr-floating';
import { BrushOperation } from "@shared/schema";
import { growContour } from "@/lib/contour-grow";
import { gaussianSmoothContour as smoothContour } from "@/lib/contour-smooth-simple";
import { 
  applyRippleAnimation, 
  createDefaultAnimationState, 
  isAnimationActive, 
  getAnimationProgress,
  type RippleAnimationState 
} from "@/lib/smooth-ripple-animation";
import {
  addBrushToContour,
  eraseBrushFromContour,
  mergeBrushWithContour,
  brushStrokeToPolishedPolygon,
} from "@/lib/brush-to-polygon";
import { applyDirectionalGrow } from "@/lib/contour-directional-grow";
import { naiveCombineContours as combineContours, naiveSubtractContours as subtractContours } from "@/lib/contour-boolean-operations";
import { predictNextSliceContour, type PredictionResult, type PropagationMode } from "@/lib/contour-prediction";
import { generatePrediction, findNearestContour, findBracketingContours, predictContourWithEdges, predictContourSimple, predictContourInterpolated, predictContourSmart, type SimplePredictionResult, type ImageDataForPrediction, type CoordinateTransforms } from "@/lib/simple-contour-prediction";
import { PredictionHistoryManager, type ContourSnapshot } from "@/lib/prediction-history-manager";
import { PredictionOverlay } from "./prediction-overlay";
import { getFusedSlice, getFusedSliceSmart, fuseboxSliceToImageData, clearFusionSlices, getFusionManifest } from "@/lib/fusion-utils";
import type { FuseboxSlice } from "@/lib/fusion-utils";
import { performPolygonUnion, polygonUnion } from "@/lib/polygon-union";
import { doPolygonsIntersectSimple, unionMultipleContoursSimple, growContourSimple } from "@/lib/simple-polygon-operations";
import { undoRedoManager } from "@/lib/undo-system";
import { attachDiceDebug } from "@/lib/dice-utils";
import { 
  isGPUAccelerationAvailable,
  initializeCornerstone3D,
  render16BitImageGPU
} from "@/lib/cornerstone3d-adapter";
import { log } from '@/lib/log';
import { createOrUpdateGPUViewport, hideGPUViewport, cleanupGPUViewports } from "@/lib/gpu-viewport-manager";
import { getDicomWorkerManager, destroyDicomWorkerManager } from '@/lib/dicom-worker-manager';
import { getSliceZ, sameSlice, getSpacing, getRescaleParams, SLICE_TOL_MM } from "@/lib/dicom-spatial-helpers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { RegistrationAssociation, RegistrationTransformCandidate, RegistrationSeriesDetail } from '@/types/fusion';
import { useToast } from '@/hooks/use-toast';
import { BlobManagementDialog } from './blob-management-dialog';
import { AnimatePresence } from 'framer-motion';
import { groupStructureBlobs, computeBlobVolumeCc, createContourKey, type Blob, type BlobContour } from '@/lib/blob-operations';
import { useUserSettings } from './user-settings-panel';
import { getImageLoadPoolManager, createStackContextPrefetch, RequestPriority } from '@/lib/image-load-pool-manager';
import { globalSeriesCache, type CachedImage } from '@/lib/global-series-cache';
import { globalFusionCache } from '@/lib/global-fusion-cache';
import { viewportScrollSync } from '@/lib/viewport-scroll-sync';

const PREDICTION_DEBUG = false;

const normalizeSlicePosition = (value: number): number => {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1000) / 1000;
};

const createDirectCopyContour = (sourceContour: number[], targetSlice: number): number[] => {
  if (!Array.isArray(sourceContour) || sourceContour.length < 9) return [];
  const copied = [...sourceContour];
  for (let i = 2; i < copied.length; i += 3) {
    copied[i] = targetSlice;
  }
  return copied;
};

// Debug flags - more granular control over logging
const DEBUG = false; // TEMP: disabled permanently - console spam was causing performance issues
const RT_STRUCTURE_DEBUG = false; // Set to true when specifically debugging RT structures

// Typed preview contour interface for consistency
type PreviewContour = { 
  points: number[]; 
  slicePosition: number; 
  meta?: { margin?: number; type?: string };
};

type RegistrationOption = {
  id: string | null;
  label: string;
  relationship: RegistrationAssociation['relationship'];
  regFile: string | null;
  matrix: number[] | null;
  association: RegistrationAssociation;
  candidate?: RegistrationTransformCandidate | null;
  sourceDetail: RegistrationSeriesDetail | null;
  targetDetail: RegistrationSeriesDetail | null;
};

// Global pending fetches map to prevent race conditions in multi-viewport scenarios
// Key: sopInstanceUID, Value: Promise resolving to imageData
const globalPendingFetches = new Map<string, Promise<any>>();

const IDENTITY_MATRIX_4X4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

const cloneIdentityMatrix = () => Array.from(IDENTITY_MATRIX_4X4);

const matricesEqual = (a: number[] | null, b: number[] | null) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  }
  return true;
};

// Using doPolygonsIntersectSimple from simple-polygon-operations for consistency

interface WorkingViewerProps {
  seriesId: number;
  studyId?: number;
  windowLevel?: { window: number; level: number };
  onWindowLevelChange?: (windowLevel: {
    window: number;
    level: number;
  }) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  rtStructures?: any;
  structureVisibility?: Map<number, boolean>;
  brushToolState?: {
    tool: string | null;
    brushSize: number;
    isActive: boolean;
    predictionEnabled?: boolean;
    smartBrushEnabled?: boolean;
    predictionMode?: 'geometric' | 'nitro' | 'sam' | 'fast' | 'balanced' | 'segvol' | 'fast-raycast';
    mem3dParams?: import('@/lib/fast-slice-prediction').PredictionParams;
  };
  selectedForEdit?: number | null;
  selectedStructures?: Set<number>;
  onBrushSizeChange?: (size: number) => void;
  onBrushToolChange?: (state: {
    tool: string | null;
    brushSize: number;
    isActive: boolean;
    predictionEnabled?: boolean;
    smartBrushEnabled?: boolean;
    predictionMode?: 'geometric' | 'nitro' | 'sam' | 'fast' | 'balanced' | 'segvol' | 'fast-raycast';
    mem3dParams?: import('@/lib/fast-slice-prediction').PredictionParams;
  }) => void;
  onContourUpdate?: (updatedStructures: any) => void;
  onRTStructureUpdate?: (structures: any) => Promise<void>;
  contourSettings?: { width: number; opacity: number };
  autoZoomLevel?: number;
  autoLocalizeTarget?: { x: number; y: number; z: number };
  onSlicePositionChange?: (slicePosition: number) => void;
  secondarySeriesId?: number | null;
  fusionOpacity?: number;
  fusionDisplayMode?: 'overlay' | 'side-by-side';
  fusionLayoutPreset?: 'overlay' | 'side-by-side' | 'primary-focus' | 'secondary-focus' | 'vertical-stack' | 'quad';
  onSecondarySeriesSelect?: (id: number | null) => void;
  onFusionOpacityChange?: (opacity: number) => void;
  hasSecondarySeriesForFusion?: boolean;
  onImageMetadataChange?: (metadata: any) => void;
  allStructuresVisible?: boolean;
  imageCache?: React.MutableRefObject<Map<string, { images: any[], metadata: any }>>;
  orientation?: 'axial' | 'sagittal' | 'coronal';
  onMPRToggle?: () => void;
  isMPRVisible?: boolean;
  onActivePredictionsChange?: (predictions: Map<number, any>) => void;
  availableSeries?: Array<{
    id: number;
    modality?: string;
    seriesDescription?: string;
    imageCount?: number;
    studyId?: number;
  }>;
  allowedSecondaryIds?: number[];
  registrationAssociations?: Map<number, RegistrationAssociation[]>;
  fusionWindowLevel?: { window: number; level: number } | null;
  fusionSecondaryStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionManifestLoading?: boolean;
  fusionManifestPrimarySeriesId?: number | null;
  
  // External synchronization props for multi-viewport layouts
  externalSliceIndex?: number;
  onSliceIndexChange?: (index: number) => void;
  externalZoom?: number;
  onZoomChange?: (zoom: number) => void;
  externalPan?: { x: number; y: number };
  onPanChange?: (x: number, y: number) => void;
  externalCrosshair?: { x: number; y: number };
  onCrosshairChange?: (pos: { x: number; y: number }) => void;
  
  // Layout control props for flexible layouts
  hideToolbar?: boolean;
  hideSidebar?: boolean;
  compactMode?: boolean;
  
  // Performance optimization props for multi-viewport
  initialImages?: any[];
  pixelDataCache?: React.MutableRefObject<Map<string, any>>;
  
  /** Unique viewport ID for cross-viewport ghost contour synchronization */
  viewportId?: string;
  
  // RT Dose overlay props
  doseSeriesId?: number | null;
  doseOpacity?: number;
  doseVisible?: boolean;
  doseColormap?: 'rainbow' | 'hot' | 'jet' | 'cool' | 'dosimetry' | 'grayscale';
  showIsodose?: boolean;
  prescriptionDose?: number;
}

// Expose sidebar ref globally for fusion panel placement
(window as any).__workingViewerSidebarRef = { current: null };

const WorkingViewer = forwardRef(function WorkingViewerComponent(props: WorkingViewerProps, ref: any) {
  const {
    seriesId,
    studyId,
    windowLevel: externalWindowLevel,
    onWindowLevelChange,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    rtStructures: externalRTStructures,
    structureVisibility: externalStructureVisibility,
    brushToolState,
    selectedForEdit,
    selectedStructures,
    onBrushSizeChange,
    onBrushToolChange,
    onContourUpdate,
    onRTStructureUpdate,
    contourSettings,
    autoZoomLevel,
    autoLocalizeTarget,
    onSlicePositionChange,
    secondarySeriesId: externalSecondarySeriesId,
    fusionOpacity: externalFusionOpacity = 0.5,
    fusionDisplayMode = 'overlay',
    onSecondarySeriesSelect,
    onFusionOpacityChange,
    hasSecondarySeriesForFusion,
    onImageMetadataChange,
    allStructuresVisible = true,
    imageCache,
    orientation = 'axial',
    availableSeries,
    registrationAssociations,
    fusionWindowLevel,
    fusionSecondaryStatuses,
    fusionManifestLoading = false,
    fusionManifestPrimarySeriesId = null,
    onMPRToggle,
    isMPRVisible = false,
    onActivePredictionsChange,
    // External sync props
    externalSliceIndex,
    onSliceIndexChange,
    externalZoom,
    onZoomChange,
    externalPan,
    onPanChange,
    externalCrosshair,
    onCrosshairChange,
    // Layout control props
    hideToolbar = false,
    hideSidebar = false,
    compactMode = false,
    // Cross-viewport ghost contour sync
    viewportId = `viewport-${seriesId || 'default'}`,
    // RT Dose overlay props
    doseSeriesId,
    doseOpacity = 0.5,
    doseVisible = true,
    doseColormap = 'rainbow',
    showIsodose = false,
    prescriptionDose = 60,
  } = props;
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fusionOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const doseOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const contoursOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Ref-based index for high-frequency scroll updates (bypasses React during rapid scrolling)
  const currentIndexRef = useRef(currentIndex);
  // Track if we are actively scrolling (to ignore stale external sync)
  const isLocalScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep ref in sync (only when NOT actively scrolling)
  useEffect(() => {
    if (!isLocalScrollingRef.current) {
      currentIndexRef.current = currentIndex;
    }
  }, [currentIndex]);
  
  // Register with viewport scroll sync for multi-viewport synchronization
  useEffect(() => {
    // Handler for when other viewports update the position
    const handleSyncUpdate = (state: { sliceIndex?: number; zoom?: number; panX?: number; panY?: number }) => {
      // Ignore slice sync if we're actively scrolling (we're the source, not the follower)
      if (state.sliceIndex !== undefined && state.sliceIndex !== currentIndexRef.current && !isLocalScrollingRef.current) {
        console.log(`[SyncUpdate] External sync: ${currentIndexRef.current} → ${state.sliceIndex}`);
        currentIndexRef.current = state.sliceIndex;
        // Sync React state after a short debounce (handled by scroll sync manager)
        setCurrentIndex(state.sliceIndex);
      }
      if (state.zoom !== undefined) setZoom(state.zoom);
      if (state.panX !== undefined) setPanX(state.panX);
      if (state.panY !== undefined) setPanY(state.panY);
    };
    
    // Register viewport and get unregister function
    const unregister = viewportScrollSync.register(
      viewportId,
      handleSyncUpdate,
      () => scheduleRender() // Direct canvas redraw callback
    );
    
    return unregister;
  }, [viewportId]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // RT Dose state
  const [doseFrames, setDoseFrames] = useState<Map<number, Float32Array>>(new Map());
  const [doseMetadata, setDoseMetadata] = useState<{
    rows: number;
    columns: number;
    frames: number;
    gridFrameOffsetVector: number[];
    doseGridScaling: number;
    maxDose: number;
    imagePositionPatient: [number, number, number];
    pixelSpacing: [number, number];
    sliceThickness: number;
  } | null>(null);
  const doseFramesRef = useRef(doseFrames);
  const doseMetadataRef = useRef(doseMetadata);
  useEffect(() => { doseFramesRef.current = doseFrames; }, [doseFrames]);
  useEffect(() => { doseMetadataRef.current = doseMetadata; }, [doseMetadata]);
  // Use external RT structures if provided, otherwise load our own
  const [localRTStructures, setLocalRTStructures] =
    useState(externalRTStructures);
  const rtStructures = localRTStructures || externalRTStructures;
  // Ref to always get latest rtStructures for immediate rendering
  const rtStructuresRef = useRef(rtStructures);
  useEffect(() => {
    rtStructuresRef.current = rtStructures;
  }, [rtStructures]);
  
  // Track the previous external structures reference to detect external changes
  const prevExternalStructuresRef = useRef<any>(null);
  
  // Sync local RT structures when external structures change (e.g., from undo/redo or other viewports)
  // This ensures all viewports share the same structure state
  useEffect(() => {
    if (!externalRTStructures) {
      // Don't clear local structures just because external became null temporarily
      // This prevents flickering when parent re-renders
      return;
    }
    
    // Skip if this is the same external reference we already processed
    if (externalRTStructures === prevExternalStructuresRef.current) {
      return;
    }
    
    // Update our tracking ref
    prevExternalStructuresRef.current = externalRTStructures;
    
    // Always sync external changes - the parent is the source of truth
    // This enables undo/redo and cross-viewport sync
    setLocalRTStructures(externalRTStructures);
  }, [externalRTStructures]);
  
  // Force render trigger to ensure immediate canvas updates
  const [forceRenderTrigger, setForceRenderTrigger] = useState(0);
  const structureVisibility = externalStructureVisibility || new Map();
  // Use prop directly instead of local state
  const showStructures = allStructuresVisible ?? true;
  const [renderTrigger, setRenderTrigger] = useState(0);
  
  // Re-render when allStructuresVisible changes - ensures RT structure toggle works
  useEffect(() => {
    // Trigger a render update by incrementing forceRenderTrigger
    setForceRenderTrigger(prev => prev + 1);
  }, [allStructuresVisible]);
  const [animationTime, setAnimationTime] = useState(0);
  const [predictedContours, setPredictedContours] = useState<Map<string, any>>(new Map());
  const [previewContours, setPreviewContours] = useState<PreviewContour[]>([]);
  const [testPredictionAdded, setTestPredictionAdded] = useState(false);
  const [imageMetadata, setImageMetadata] = useState<any>(null);
  const [dicomPixelData, setDicomPixelData] = useState<any>(null);
  
  // Next slice prediction state
  const [activePredictions, setActivePredictions] = useState<Map<number, PredictionResult>>(new Map());
  const predictionRequestIdRef = useRef<number>(0); // Track current prediction request to ignore stale results
  const updateActivePredictions = useCallback((predictions: Map<number, PredictionResult>) => {
    setActivePredictions(predictions);
    // Expose predictions for debugging
    (window as any).__activePredictions = predictions;
    if (predictions.size > 0) {
      for (const [slicePos, pred] of predictions.entries()) {
        console.log(`🔮 PREDICTION SET: slice=${slicePos.toFixed(2)}, contourLength=${pred.predictedContour?.length || 0}, confidence=${(pred.confidence * 100).toFixed(1)}%, method=${pred.metadata?.method || 'unknown'}`);
      }
    }
    if (onActivePredictionsChange) {
      onActivePredictionsChange(predictions);
    }
  }, [onActivePredictionsChange]);
  const predictionHistoryManagerRef = useRef<Map<number, PredictionHistoryManager>>(new Map()); // One per structure
const [propagationMode, setPropagationMode] = useState<PropagationMode>('moderate');
const lastPredictionSliceRef = useRef<number | null>(null);
const lastViewedContourSliceRef = useRef<number | null>(null);
  const [predictionTrigger, setPredictionTrigger] = useState(0); // Force update counter
  
  // Smooth animation state - using clean animation module
  const [smoothAnimation, setSmoothAnimation] = useState<RippleAnimationState>(
    createDefaultAnimationState()
  );
  
  // GPU acceleration state for hybrid rendering
  const [isGPUMode, setIsGPUMode] = useState(false);
  const [gpuCheckComplete, setGpuCheckComplete] = useState(false);
  const [cornerstone3DInitialized, setCornerstone3DInitialized] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState({ loaded: 0, total: 0 });
  // Blob tools dialog state
  const [blobDialogOpen, setBlobDialogOpen] = useState(false);
  const [blobDialogData, setBlobDialogData] = useState<null | {
    structureId: number;
    blobs: Blob[];
  }>(null);
  const [highlightedBlobId, setHighlightedBlobId] = useState<number | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMeasurementToolActive, setIsMeasurementToolActive] = useState(false);
  const [isLoadingMPR, setIsLoadingMPR] = useState(false);
  const [viewportLayout, setViewportLayout] = useState<'axial-only' | 'floating' | 'grid'>('axial-only');
  // Use external MPR visibility state or fallback to internal state
  const mprVisible = props.isMPRVisible ?? false;
  
  // Sync viewportLayout with mprVisible - when MPR is toggled on via toolbar, show floating layout
  useEffect(() => {
    if (mprVisible && viewportLayout === 'axial-only') {
      setViewportLayout('floating');
    } else if (!mprVisible && viewportLayout === 'floating') {
      setViewportLayout('axial-only');
    }
  }, [mprVisible]);
  
  const secondarySeriesId = externalSecondarySeriesId; // Use external prop directly instead of local state
  const fusionOpacity = externalFusionOpacity !== undefined ? externalFusionOpacity : 0.5;
  const [registrationMatrix, setRegistrationMatrix] = useState<number[] | null>(null);
  const registrationMatrixRef = useRef<number[] | null>(null);
  const [secondaryModality, setSecondaryModality] = useState<string>('MR');
  const [fuseboxTransformSource, setFuseboxTransformSource] = useState<FuseboxSlice['transformSource'] | null>(null);
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [registrationAssociationsForPrimary, setRegistrationAssociationsForPrimary] = useState<RegistrationAssociation[]>([]);
  // Fusion debug support
  const [showFusionDebug, setShowFusionDebug] = useState(false);
  const [fusionDebugText, setFusionDebugText] = useState('');
  const [fusionLogs, setFusionLogs] = useState<string[]>([]);
  const [showRegDetails, setShowRegDetails] = useState(false);
  const [regDetailsText, setRegDetailsText] = useState('');
  const [lastResolveInfo, setLastResolveInfo] = useState<any>(null);
  const fusionIssueRef = useRef<string | null>(null);
  const missingMatrixLogRef = useRef(false);
  // ⚠️ FUSION CACHE - See warning block near line ~4500 before modifying cache clearing behavior
  // This cache stores pre-rendered canvas elements. It is intentionally cleared on secondary/registration
  // changes. DO NOT try to "optimize" by preserving this cache - it causes severe performance issues.
  const fuseboxCacheRef = useRef<Map<string, {
    canvas: HTMLCanvasElement;
    slice: FuseboxSlice;
    timestamp: number;
    hasSignal: boolean;
  }>>(new Map());
  // CT transform for fusion coordinate system alignment
  const ctTransform = useRef<{scale: number, offsetX: number, offsetY: number, imageWidth: number, imageHeight: number} | null>(null);
  const scheduleRenderRef = useRef<(() => void) | null>(null);
  const fusionRequestTokenRef = useRef(0);
  const fusionPrefetchSetRef = useRef<Set<string>>(new Set());

  const parseImagePosition = useCallback((image: any): [number, number, number] | null => {
    if (!image) return null;
    const direct = Array.isArray(image.imagePositionPatient) ? image.imagePositionPatient : null;
    if (direct && direct.length >= 3) {
      const coords = direct.map((value: any) => Number(value)) as [number, number, number];
      if (coords.every((value) => Number.isFinite(value))) return coords;
    }
    const metaArray = Array.isArray(image.metadata?.imagePositionPatient) ? image.metadata.imagePositionPatient : null;
    if (metaArray && metaArray.length >= 3) {
      const coords = metaArray.map((value: any) => Number(value)) as [number, number, number];
      if (coords.every((value) => Number.isFinite(value))) return coords;
    }
    const rawString = typeof image.imagePosition === 'string'
      ? image.imagePosition
      : (typeof image.metadata?.imagePosition === 'string' ? image.metadata.imagePosition : null);
    if (rawString) {
      const parts = rawString.split('\\').map((part: string) => Number(part.trim()));
      if (parts.length >= 3 && parts.every((value) => Number.isFinite(value))) {
        return [parts[0], parts[1], parts[2]];
      }
    }
    return null;
  }, []);

  const registrationOptions = useMemo<RegistrationOption[]>(() => {
    if (secondarySeriesId == null) {
      console.log('registrationOptions: no secondary selected');
      return [];
    }
    const secondaryId = Number(secondarySeriesId);
    if (!Number.isFinite(secondaryId)) {
      console.log('registrationOptions: secondary not finite', secondarySeriesId);
      return [];
    }

    const describeSeries = (detail: RegistrationSeriesDetail | null | undefined) => {
      if (!detail) return null;
      const modality = detail.modality ? detail.modality.toUpperCase() : null;
      const description = detail.description?.trim();
      const fallbackId = detail.id != null ? `Series ${detail.id}` : null;
      if (modality && description) return `${modality} · ${description}`;
      if (modality) return `${modality} · ${description || fallbackId || detail.uid || 'Series'}`;
      if (description) return description;
      if (fallbackId) return fallbackId;
      if (detail.uid) return detail.uid;
      return null;
    };

    const options: RegistrationOption[] = [];
    const seenOptionKeys = new Set<string>();

    for (const assoc of registrationAssociationsForPrimary) {
      const siblingIds = Array.isArray(assoc.siblingSeriesIds)
        ? assoc.siblingSeriesIds.map((id: any) => Number(id)).filter(Number.isFinite)
        : [];
      const sourceIds = Array.isArray(assoc.sourcesSeriesIds)
        ? assoc.sourcesSeriesIds.map((id: any) => Number(id)).filter(Number.isFinite)
        : [];

      const isShared = assoc.relationship === 'shared-frame' && siblingIds.includes(secondaryId);
      const isRegistered = assoc.relationship === 'registered' && sourceIds.includes(secondaryId);
      if (!isShared && !isRegistered) continue;

      const sourceDetail = Array.isArray(assoc.sourceSeriesDetails)
        ? assoc.sourceSeriesDetails.find(detail => detail?.id === secondaryId) || null
        : null;
      const targetDetail = assoc.targetSeriesDetail ?? null;
      const sourceLabel = describeSeries(sourceDetail) ?? `Series ${secondaryId}`;
      const targetLabel = describeSeries(targetDetail) ?? 'Primary CT';

      if (assoc.relationship === 'shared-frame') {
        const key = `${assoc.regFile || 'shared'}:${secondaryId}:shared`;
        if (seenOptionKeys.has(key)) continue;
        seenOptionKeys.add(key);
        options.push({
          id: null,
          label: `Shared FoR · ${sourceLabel}`,
          relationship: assoc.relationship,
          regFile: assoc.regFile,
          matrix: cloneIdentityMatrix(),
          association: assoc,
          candidate: null,
          sourceDetail,
          targetDetail,
        });
        continue;
      }

      const candidates = Array.isArray(assoc.transformCandidates) ? assoc.transformCandidates : [];
      if (!candidates.length) {
        const key = `${assoc.regFile || 'reg'}:${secondaryId}:default`;
        if (seenOptionKeys.has(key)) continue;
        seenOptionKeys.add(key);
        const baseName = assoc.regFile ? assoc.regFile.split(/[\\/]/).pop() : null;
        options.push({
          id: null,
          label: baseName ? `${sourceLabel} → ${targetLabel} (${baseName})` : `${sourceLabel} → ${targetLabel}`,
          relationship: assoc.relationship,
          regFile: assoc.regFile,
          matrix: null,
          association: assoc,
          candidate: null,
          sourceDetail,
          targetDetail,
        });
        continue;
      }

      candidates.forEach((cand, idx) => {
        if (!Array.isArray(cand.matrix) || cand.matrix.length !== 16) return;
        const regFile = cand.regFile || assoc.regFile;
        const suffixIndex = typeof cand.id === 'string' && cand.id.includes('::')
          ? Number(cand.id.split('::')[1])
          : idx;
        const candidateNumber = Number.isFinite(suffixIndex) ? (Number(suffixIndex) + 1) : (idx + 1);
        const candidateLabel = candidates.length > 1 ? ` (candidate ${candidateNumber})` : '';
        const label = `${sourceLabel} → ${targetLabel}${candidateLabel}`;
        const key = `${regFile || 'reg'}:${secondaryId}:${cand.id ?? candidateNumber}`;
        if (seenOptionKeys.has(key)) return;
        seenOptionKeys.add(key);
        options.push({
          id: cand.id ?? `${regFile || 'reg'}::${candidateNumber}`,
          label,
          relationship: assoc.relationship,
          regFile: regFile ?? null,
          matrix: cand.matrix.slice(),
          association: assoc,
          candidate: cand,
          sourceDetail,
          targetDetail,
        });
      });
    }
    console.log('registration options', { secondaryId, options, registrationAssociationsForPrimary });
    return options;
  }, [registrationAssociationsForPrimary, secondarySeriesId]);

  const buildFuseboxCacheKey = useCallback(
    (sopInstanceUID: string, secondaryId: number, registrationId: string | null) =>
      `${sopInstanceUID}:${secondaryId}:${registrationId ?? 'default'}`,
    [],
  );

  const clearFusionOverlayCanvas = useCallback(() => {
    const overlayCanvas = fusionOverlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }, []);

  const updateFusionOverlayCanvas = useCallback(
    (
      overlaySource: HTMLCanvasElement | null,
      transform: { scale: number; offsetX: number; offsetY: number; imageWidth: number; imageHeight: number } | null,
      hasSignal: boolean,
    ) => {
      const overlayCanvas = fusionOverlayCanvasRef.current;
      const baseCanvas = canvasRef.current;
      if (!overlayCanvas || !baseCanvas) return;
      const ctx = overlayCanvas.getContext('2d');
      if (!ctx) return;

      if (overlayCanvas.width !== baseCanvas.width || overlayCanvas.height !== baseCanvas.height) {
        overlayCanvas.width = baseCanvas.width;
        overlayCanvas.height = baseCanvas.height;
      }

      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      if (!overlaySource || !transform || !hasSignal) return;

      // IMPROVED: Use the exact same positioning logic as primary image
      // This ensures perfect 1:1 alignment between primary CT and fusion overlay
      const targetWidth = transform.imageWidth * transform.scale;
      const targetHeight = transform.imageHeight * transform.scale;
      if (targetWidth === 0 || targetHeight === 0) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw overlay using same position and size as primary image
      // This guarantees pixel-perfect alignment
      ctx.drawImage(
        overlaySource,
        0,
        0,
        overlaySource.width,
        overlaySource.height,
        transform.offsetX,
        transform.offsetY,
        targetWidth,
        targetHeight,
      );
    },
    [canvasRef, fusionOverlayCanvasRef],
  );

  const convertSliceToCanvas = useCallback(
    (slice: FuseboxSlice, defaultModality: string) => {
      const { imageData, hasSignal } = fuseboxSliceToImageData(
        slice,
        slice.secondaryModality ?? defaultModality,
        fusionWindowLevel,
      );
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = slice.width;
      overlayCanvas.height = slice.height;
      const overlayCtx = overlayCanvas.getContext('2d');
      if (!overlayCtx) return null;
      overlayCtx.putImageData(imageData, 0, 0);
      return { canvas: overlayCanvas, slice, hasSignal };
    },
    [fusionWindowLevel],
  );

  useEffect(() => {
    const entries = Array.from(fuseboxCacheRef.current.entries());
    if (!entries.length) return;
    const updatedCache = new Map<string, { canvas: HTMLCanvasElement; slice: FuseboxSlice; timestamp: number; hasSignal: boolean }>();
    entries.forEach(([key, value]) => {
      const updated = convertSliceToCanvas(value.slice, value.slice.secondaryModality ?? secondaryModality ?? '');
      if (updated) {
        updatedCache.set(key, { ...updated, timestamp: Date.now() });
      }
    });
    if (updatedCache.size) {
      fuseboxCacheRef.current = updatedCache;
      setRenderTrigger((prev) => prev + 1);
      // Force canvas repaint when fusion window level changes
      scheduleRenderRef.current?.();
    }
  }, [convertSliceToCanvas, secondaryModality]);

  // Fusion cache/prefetch tuning:
  // - We keep a capped in-memory cache (LRU-ish via timestamp) for seamless swapping.
  // - We also prefetch a wider radius around the current slice.
  // NOTE: Storing canvases is memory-heavy; cap protects against runaway usage.
  const FUSION_CACHE_MAX_ITEMS = 400;
  const FUSION_PREFETCH_RADIUS = 8;

  const pruneFuseboxCache = useCallback(() => {
    const cache = fuseboxCacheRef.current;
    if (cache.size <= FUSION_CACHE_MAX_ITEMS) return;
    const entries = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const removeCount = cache.size - FUSION_CACHE_MAX_ITEMS;
    for (let i = 0; i < removeCount; i++) {
      const key = entries[i]?.[0];
      if (key) cache.delete(key);
    }
  }, []);

  const prefetchFusionSlices = useCallback(
    (centerIndex: number) => {
      if (!secondarySeriesId || !images.length) return;
      // Gate prefetch on manifest readiness to avoid 'manifest not loaded' errors
      const status = fusionSecondaryStatuses?.get(secondarySeriesId);
      const manifestMatches = Number(fusionManifestPrimarySeriesId) === Number(seriesId);
      const localManifest = getFusionManifest(seriesId);
      const localReady = !!localManifest && localManifest.secondaries.some((s) => s.secondarySeriesId === secondarySeriesId && s.status === 'ready');
      if (fusionManifestLoading || status?.status !== 'ready' || !manifestMatches || !localReady) {
        return;
      }

      const registrationId = selectedRegistrationId ?? null;

      for (let offset = -FUSION_PREFETCH_RADIUS; offset <= FUSION_PREFETCH_RADIUS; offset += 1) {
        const targetIndex = centerIndex + offset;
        if (targetIndex < 0 || targetIndex >= images.length) continue;
        const targetImage = images[targetIndex];
        const sop = targetImage?.sopInstanceUID;
        if (!sop) continue;
        const key = buildFuseboxCacheKey(sop, secondarySeriesId, registrationId);
        if (fuseboxCacheRef.current.has(key) || fusionPrefetchSetRef.current.has(key)) continue;

        fusionPrefetchSetRef.current.add(key);
        const instNumber = Number(targetImage.instanceNumber ?? targetImage.metadata?.instanceNumber ?? NaN);
        const preferredIndex = Number.isFinite(instNumber) ? instNumber - 1 : targetIndex;
        const preferredPosition = parseImagePosition(targetImage);
        getFusedSlice(seriesId, secondarySeriesId, sop)
          .catch((error) => {
            if (error instanceof Error && error.message.includes('not found in manifest')) {
              return getFusedSliceSmart(
                seriesId,
                secondarySeriesId,
                sop,
                Number.isFinite(instNumber) ? instNumber : null,
                preferredIndex,
                preferredPosition,
              );
            }
            throw error;
          })
          .then((slice) => {
            const prepared = convertSliceToCanvas(slice, secondaryModality);
            if (prepared) {
              fuseboxCacheRef.current.set(key, { ...prepared, timestamp: Date.now() });
              pruneFuseboxCache();
            }
          })
          .catch((error) => {
            if (import.meta.env.DEV) {
              console.warn('Fusion prefetch failed', error);
            }
          })
          .finally(() => {
            fusionPrefetchSetRef.current.delete(key);
          });
      }
    },
    [
      buildFuseboxCacheKey,
      convertSliceToCanvas,
      images,
      pruneFuseboxCache,
      secondaryModality,
      secondarySeriesId,
      selectedRegistrationId,
      seriesId,
      // NOTE: fusionManifestLoading, fusionSecondaryStatuses, and fusionManifestPrimarySeriesId
      // are intentionally excluded from deps to avoid infinite loop during preload progress updates
    ],
  );

  useEffect(() => {
    const activeSeriesId = seriesId;
    return () => {
      fuseboxCacheRef.current.clear();
      clearFusionSlices(activeSeriesId);
      
      // Cleanup ImageLoadPoolManager prefetch state
      if (stackPrefetchRef.current) {
        stackPrefetchRef.current.destroy();
        stackPrefetchRef.current = null;
      }
      prefetchCompleteRef.current = false;
    };
  }, [seriesId]);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  
  // External sync: Slice index
  // IGNORE during active local scrolling to prevent feedback loops from stale state
  useEffect(() => {
    if (externalSliceIndex !== undefined && images.length > 0) {
      // If we're actively scrolling, ignore external sync (it's just stale feedback)
      if (isLocalScrollingRef.current) {
        return;
      }
      const clampedIndex = Math.max(0, Math.min(externalSliceIndex, images.length - 1));
      if (clampedIndex !== currentIndexRef.current) {
        console.log(`[ExternalSync] Applying external index: ${currentIndexRef.current} → ${clampedIndex}`);
        currentIndexRef.current = clampedIndex;
        setCurrentIndex(clampedIndex);
      }
    }
  }, [externalSliceIndex, images.length]);
  
  // OHIF-style: Update ImageLoadPoolManager position for dynamic prioritization
  // This ensures center-out loading always prioritizes slices near the current view
  useEffect(() => {
    if (images.length > 0 && stackPrefetchRef.current) {
      // Notify the prefetch helper of the scroll position change
      stackPrefetchRef.current.onScroll(currentIndex);
    }
    
    // Also update the global pool manager position
    const poolManager = getImageLoadPoolManager();
    poolManager.setCurrentPosition(currentIndex, images.length);
  }, [currentIndex, images.length]);
  
  // External sync: Zoom
  useEffect(() => {
    if (externalZoom !== undefined && externalZoom !== zoom) {
      setZoom(externalZoom);
    }
  }, [externalZoom]);
  
  // External sync: Pan
  useEffect(() => {
    if (externalPan !== undefined && (externalPan.x !== panX || externalPan.y !== panY)) {
      setPanX(externalPan.x);
      setPanY(externalPan.y);
    }
  }, [externalPan?.x, externalPan?.y]);
  
  // External sync: Crosshair
  useEffect(() => {
    if (externalCrosshair !== undefined && 
        (externalCrosshair.x !== crosshairPos.x || externalCrosshair.y !== crosshairPos.y)) {
      setCrosshairPos(externalCrosshair);
    }
  }, [externalCrosshair?.x, externalCrosshair?.y]);
  
  // Notify parent of internal state changes (for sync)
  const notifySliceChange = useCallback((index: number) => {
    onSliceIndexChange?.(index);
  }, [onSliceIndexChange]);
  
  const notifyZoomChange = useCallback((z: number) => {
    onZoomChange?.(z);
  }, [onZoomChange]);
  
  const notifyPanChange = useCallback((x: number, y: number) => {
    onPanChange?.(x, y);
  }, [onPanChange]);
  
  const notifyCrosshairChange = useCallback((pos: { x: number; y: number }) => {
    onCrosshairChange?.(pos);
  }, [onCrosshairChange]);
  
  const compileFusionDebug = useCallback(() => {
    try {
      const primaryFirst: any = images?.[0];
      const pFoR = (primaryFirst?.metadata?.frameOfReferenceUID || primaryFirst?.frameOfReferenceUID || primaryFirst?.imageMetadata?.frameOfReferenceUID || '');
      const cacheSnapshot = Array.from(fuseboxCacheRef.current.entries()).map(([key, entry]) => ({
        key,
        sliceIndex: entry.slice.sliceIndex,
        modality: entry.slice.secondaryModality,
        dimensions: `${entry.slice.width}x${entry.slice.height}`,
        ageMs: Date.now() - entry.timestamp,
        hasSignal: entry.hasSignal,
        transformSource: entry.slice.transformSource,
      }));

      let derivedReason: string = fusionIssueRef.current || 'manual';
      if (!fusionIssueRef.current) {
        if (!secondarySeriesId) {
          derivedReason = 'no-secondary-series';
        } else if (cacheSnapshot.length === 0) {
          derivedReason = 'waiting-for-cache';
        } else {
          derivedReason = 'ok';
        }
      }

      const debug = {
        reason: derivedReason,
        primarySeriesId: seriesId,
        secondarySeriesId,
        primaryFoR: pFoR,
        registrationMatrixLength: registrationMatrix?.length || 0,
        registrationMatrix,
        resolve: lastResolveInfo,
        cacheSize: cacheSnapshot.length,
        cache: cacheSnapshot,
        transformSource: fuseboxTransformSource,
        ctTransform: ctTransform.current,
        registrationId: selectedRegistrationId,
        registrationOptions,
        logs: fusionLogs.slice(-50),
      };
      
      // Assign to window for debugging
      (window as any).__fusion = debug;
      console.log('🐟 FUSION: Assigned debug to window.__fusion', debug.reason);
      
      return JSON.stringify(debug, null, 2);
    } catch (e) {
      return `Failed to compile debug: ${String(e)}`;
    }
  }, [images, seriesId, secondarySeriesId, registrationMatrix, lastResolveInfo, fusionLogs, fuseboxTransformSource, selectedRegistrationId, registrationOptions]);

  const pushFusionLog = useCallback((msg: string, data?: any) => {
    const line = `[${new Date().toISOString()}] ${msg}${data !== undefined ? ' ' + (()=>{ try { return JSON.stringify(data); } catch { return String(data); } })() : ''}`;
    setFusionLogs(prev => {
      const next = [...prev, line];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  const handleRegistrationSelect = useCallback((registrationId: string | null) => {
    setSelectedRegistrationId(registrationId);
    fuseboxCacheRef.current.clear();
    clearFusionSlices(seriesId);
    setFuseboxTransformSource(null);
    scheduleRenderRef.current?.();
  }, [seriesId]);

  const openFusionDebug = useCallback((reason: string) => {
    fusionIssueRef.current = reason;
    const txt = compileFusionDebug();
    setFusionDebugText(txt);
    setShowFusionDebug(true);
  }, [compileFusionDebug]);

  const openRegDetails = useCallback(async () => {
    try {
      const lines: string[] = [];
      lines.push('=== Current Applied Registration (viewer) ===');
      if (registrationMatrix && registrationMatrix.length === 16) {
        const R = [
          [registrationMatrix[0], registrationMatrix[1], registrationMatrix[2]],
          [registrationMatrix[4], registrationMatrix[5], registrationMatrix[6]],
          [registrationMatrix[8], registrationMatrix[9], registrationMatrix[10]],
        ];
        const T = [registrationMatrix[3], registrationMatrix[7], registrationMatrix[11]];
        const sy = Math.sqrt(R[0][0]*R[0][0] + R[1][0]*R[1][0]);
        let rx=0, ry=0, rz=0; if (sy>1e-6){ rx=Math.atan2(R[2][1],R[2][2]); ry=Math.atan2(-R[2][0],sy); rz=Math.atan2(R[1][0],R[0][0]); }
        const deg=(r:number)=> (r*180/Math.PI);
        lines.push(`T (mm): [${T.map(v=>v.toFixed(4)).join(', ')}]`);
        lines.push(`R (deg ZYX): [${deg(rx).toFixed(4)}, ${deg(ry).toFixed(4)}, ${deg(rz).toFixed(4)}]`);
      } else {
        lines.push('No registration matrix applied');
      }

      if (seriesId && secondarySeriesId) {
        lines.push('');
        lines.push('=== Candidates from DICOM REG (server) ===');
        const url = `/api/registration/inspect-all?primarySeriesId=${seriesId}&secondarySeriesId=${secondarySeriesId}`;
        const r = await fetch(url, { cache: 'no-store' as RequestCache });
        if (r.ok) {
          const data = await r.json();
          const cands: any[] = data?.candidates || [];
          if (cands.length === 0) {
            lines.push('No candidates found');
          } else {
            cands.forEach((c, idx) => {
              const file = (c.file||'').split('/').pop();
              const asT = c.asIs?.translationMm || [];
              const asR = c.asIs?.rotationDegZYX || {};
              const ivT = c.inverted?.translationMm || [];
              const ivR = c.inverted?.rotationDegZYX || {};
              lines.push(`-- Candidate ${idx+1}: ${file}`);
              lines.push(`   FoR src=${c.sourceFoR||'?'}, tgt=${c.targetFoR||'?'}`);
              lines.push(`   asIs  T (mm): [${asT.map((v:number)=>v.toFixed(4)).join(', ')}]  R(deg ZYX): [${(asR.x??0).toFixed(4)}, ${(asR.y??0).toFixed(4)}, ${(asR.z??0).toFixed(4)}]`);
              lines.push(`   inv   T (mm): [${ivT.map((v:number)=>v.toFixed(4)).join(', ')}]  R(deg ZYX): [${(ivR.x??0).toFixed(4)}, ${(ivR.y??0).toFixed(4)}, ${(ivR.z??0).toFixed(4)}]`);
            });
          }
        } else {
          lines.push(`Failed to fetch candidates: ${r.status}`);
        }
      }

      setRegDetailsText(lines.join('\n'));
      setShowRegDetails(true);
    } catch (e: any) {
      setRegDetailsText(`Failed to compile REG details: ${String(e?.message||e)}`);
      setShowRegDetails(true);
    }
  }, [registrationMatrix, seriesId, secondarySeriesId]);

  // Crosshair position for MPR views (in pixel coordinates)
  // Initialize to center of first image, fallback to 256 for 512x512 default
  const [crosshairPos, setCrosshairPos] = useState(() => {
    const defaultWidth = 512;
    const defaultHeight = 512;
    return { x: defaultWidth / 2, y: defaultHeight / 2 };
  });
  const [crosshairMode, setCrosshairMode] = useState(false);
  const [isPanMode, setIsPanMode] = useState(true); // Pan mode is default
  
  // Update crosshair position to image center when images load
  useEffect(() => {
    if (images.length > 0 && images[0]) {
      const imageWidth = images[0].columns || images[0].width || 512;
      const imageHeight = images[0].rows || images[0].height || 512;
      setCrosshairPos(prev => {
        // Only update if the dimensions are different from current calculation
        const expectedX = imageWidth / 2;
        const expectedY = imageHeight / 2;
        if (Math.abs(prev.x - expectedX) > 1 || Math.abs(prev.y - expectedY) > 1) {
          if (DEBUG) console.log(`🐟 FUSION: Updating crosshair position to image center: ${expectedX}, ${expectedY}`);
          return { x: expectedX, y: expectedY };
        }
        return prev;
      });
    }
  }, [images]);
  
  // Monitor currentIndex changes to detect unexpected auto-scrolling
  const lastCurrentIndex = useRef<number>(0);
  useEffect(() => {
    const prev = lastCurrentIndex.current;
    const current = currentIndex;
    
    // Detect large jumps that weren't triggered by user navigation
    const jumpSize = Math.abs(current - prev);
    if (DEBUG && jumpSize > 10 && images.length > 0) {
      console.warn(`🚨 UNEXPECTED SLICE JUMP: ${prev} → ${current} (jump: ${jumpSize})`);
      console.trace('Slice jump stack trace');
    }
    
    lastCurrentIndex.current = current;
  }, [currentIndex, images.length]);
  
  // Render scheduling to prevent redundant renders
  const needsRenderRef = useRef(false);
  const displayCurrentImageRef = useRef<() => Promise<void>>();
  const prefetchCompleteRef = useRef(false);
  
  // Frame rate limiting for smoother scrolling
  const lastRenderTimeRef = useRef<number>(0);
  const RENDER_THROTTLE_MS = 16; // 60fps max
  const fusionRenderDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  // NOTE: We no longer hide the fusion overlay during scrolling.
  // Instead, we show cached fusion data and only skip network fetches.
  // This provides a much better user experience in multi-viewport mode.
  
  const scheduleRender = useCallback((immediate = false) => {
    if (needsRenderRef.current && !immediate) return;
    needsRenderRef.current = true;
    
    // For immediate renders (editing operations), skip all throttling
    if (immediate) {
      needsRenderRef.current = false;
      if (displayCurrentImageRef.current) {
        displayCurrentImageRef.current();
      }
      lastRenderTimeRef.current = performance.now();
      return;
    }
    
    // Throttle renders during rapid scrolling
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    
    if (timeSinceLastRender < RENDER_THROTTLE_MS) {
      // Delay render to maintain frame rate
      setTimeout(() => {
        needsRenderRef.current = false;
        if (displayCurrentImageRef.current) {
          displayCurrentImageRef.current();
        }
        lastRenderTimeRef.current = performance.now();
      }, RENDER_THROTTLE_MS - timeSinceLastRender);
    } else {
      requestAnimationFrame(async () => {
        needsRenderRef.current = false;
        if (displayCurrentImageRef.current) {
          await displayCurrentImageRef.current();
        }
        lastRenderTimeRef.current = performance.now();
      });
    }
  }, []);

  const interactionEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const markInteracting = useCallback(() => {
    isScrollingRef.current = true;
    if (interactionEndTimerRef.current) {
      clearTimeout(interactionEndTimerRef.current);
    }
    interactionEndTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      // Force a render at rest so fusion can update with full quality.
      scheduleRender();
    }, 120);
  }, [scheduleRender]);

  useEffect(() => {
    scheduleRenderRef.current = scheduleRender;
    return () => {
      if (scheduleRenderRef.current === scheduleRender) {
        scheduleRenderRef.current = null;
      }
    };
  }, [scheduleRender]);

  useEffect(() => {
    const overlay = fusionOverlayCanvasRef.current;
    if (!overlay) return;
    const clamped = Math.max(0, Math.min(1, fusionOpacity));
    overlay.style.opacity = `${clamped}`;
    overlay.style.visibility = clamped === 0 ? 'hidden' : 'visible';
  }, [fusionOpacity]);

  // Dose overlay opacity effect
  useEffect(() => {
    const doseOverlay = doseOverlayCanvasRef.current;
    if (!doseOverlay) return;
    const clamped = Math.max(0, Math.min(1, doseOpacity));
    doseOverlay.style.opacity = `${clamped}`;
    doseOverlay.style.visibility = (clamped === 0 || !doseVisible) ? 'hidden' : 'visible';
  }, [doseOpacity, doseVisible]);

  useEffect(() => {
    if (!secondarySeriesId) {
      clearFusionOverlayCanvas();
    }
  }, [secondarySeriesId, clearFusionOverlayCanvas]);

  // Fetch dose metadata when doseSeriesId changes
  useEffect(() => {
    if (!doseSeriesId) {
      setDoseMetadata(null);
      setDoseFrames(new Map());
      // Clear dose canvas
      const doseCanvas = doseOverlayCanvasRef.current;
      if (doseCanvas) {
        const ctx = doseCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, doseCanvas.width, doseCanvas.height);
      }
      return;
    }

    // Fetch metadata first
    const fetchDoseMetadata = async () => {
      try {
        const metaRes = await fetch(`/api/rt-dose/${doseSeriesId}/metadata`);
        if (!metaRes.ok) {
          console.error('Failed to fetch dose metadata:', metaRes.status);
          return;
        }
        const meta = await metaRes.json();
        // Calculate dose Z range from gridFrameOffsetVector
        const doseOriginZ = meta.imagePositionPatient?.[2] || 0;
        const offsets = meta.gridFrameOffsetVector || [];
        const doseZRange = offsets.length > 0 
          ? { min: doseOriginZ + Math.min(...offsets), max: doseOriginZ + Math.max(...offsets) }
          : { min: doseOriginZ, max: doseOriginZ };
        console.log('[Dose] Loaded metadata:', {
          rows: meta.rows,
          columns: meta.columns,
          frames: meta.numberOfFrames,
          origin: meta.imagePositionPatient,
          spacing: meta.pixelSpacing,
          maxDose: meta.maxDose,
          doseZRange,
          gridFrameOffsets: offsets.length > 0 ? `${offsets[0]} to ${offsets[offsets.length-1]}` : 'none'
        });
        setDoseMetadata(meta);
        // Clear frames cache when metadata changes
        setDoseFrames(new Map());
      } catch (err) {
        console.error('Error fetching dose metadata:', err);
      }
    };

    fetchDoseMetadata();
  }, [doseSeriesId]);

  // Helper to find the correct dose frame index for a given CT slice Z position
  const findDoseFrameForSlice = useCallback((ctSliceZ: number): number | null => {
    const meta = doseMetadataRef.current;
    if (!meta || !meta.gridFrameOffsetVector || meta.gridFrameOffsetVector.length === 0) {
      return null;
    }

    const doseOriginZ = meta.imagePositionPatient[2];
    
    // Find the closest dose frame to the CT slice position
    let bestFrameIndex = -1;
    let bestDistance = Infinity;
    
    for (let i = 0; i < meta.gridFrameOffsetVector.length; i++) {
      const doseFrameZ = doseOriginZ + meta.gridFrameOffsetVector[i];
      const distance = Math.abs(doseFrameZ - ctSliceZ);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestFrameIndex = i;
      }
    }
    
    // Only return if within reasonable tolerance (half the dose slice spacing)
    const doseSliceSpacing = meta.gridFrameOffsetVector.length > 1 
      ? Math.abs(meta.gridFrameOffsetVector[1] - meta.gridFrameOffsetVector[0])
      : 2.5;
    
    if (bestDistance <= doseSliceSpacing) {
      return bestFrameIndex;
    }
    
    return null; // CT slice is outside dose grid coverage
  }, []);

  // Prefetch ALL dose frames when metadata loads
  // RT Dose typically has 50-150 frames, so prefetching all is feasible
  // This ensures smooth scrolling without waiting for frame fetches
  useEffect(() => {
    if (!doseSeriesId || !doseMetadata) {
      return;
    }

    const meta = doseMetadata;
    if (!meta.gridFrameOffsetVector || meta.gridFrameOffsetVector.length === 0) {
      console.log('[Dose] No gridFrameOffsetVector in metadata');
      return;
    }

    const totalFrames = meta.gridFrameOffsetVector.length;
    console.log('[Dose] Prefetching all dose frames:', { totalFrames, doseSeriesId });

    let cancelled = false;

    // Fetch all frames in parallel batches
    const fetchAllFrames = async () => {
      const BATCH_SIZE = 8; // Fetch 8 frames at a time
      const newFrames = new Map<number, Float32Array>();

      for (let batchStart = 0; batchStart < totalFrames && !cancelled; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalFrames);
        const batchPromises: Promise<void>[] = [];

        for (let frameIndex = batchStart; frameIndex < batchEnd; frameIndex++) {
          // Skip if already cached
          if (doseFramesRef.current.has(frameIndex)) {
            continue;
          }

          batchPromises.push(
            (async () => {
              try {
                const frameRes = await fetch(`/api/rt-dose/${doseSeriesId}/frame/${frameIndex}`);
                if (frameRes.ok && !cancelled) {
                  const frameJson = await frameRes.json();
                  if (frameJson.doseData && Array.isArray(frameJson.doseData)) {
                    const frameData = new Float32Array(frameJson.doseData);
                    newFrames.set(frameIndex, frameData);
                  }
                }
              } catch (err) {
                console.warn(`[Dose] Failed to fetch frame ${frameIndex}:`, err);
              }
            })()
          );
        }

        await Promise.all(batchPromises);

        // Update state after each batch to enable progressive rendering
        if (!cancelled && newFrames.size > 0) {
          setDoseFrames(prev => {
            const updated = new Map(prev);
            newFrames.forEach((data, idx) => updated.set(idx, data));
            return updated;
          });
          console.log('[Dose] Loaded frames batch:', { batchStart, batchEnd, totalLoaded: newFrames.size });
        }
      }

      if (!cancelled) {
        console.log('[Dose] All dose frames prefetched:', { totalFrames, cached: doseFramesRef.current.size });
      }
    };

    fetchAllFrames();

    return () => {
      cancelled = true;
    };
  }, [doseSeriesId, doseMetadata]);

  // Draw dose overlay when frame data, slice position, or settings change
  const drawDoseOverlay = useCallback(() => {
    console.log('[Dose] drawDoseOverlay called');
    const doseCanvas = doseOverlayCanvasRef.current;
    const baseCanvas = canvasRef.current;
    if (!doseCanvas || !baseCanvas || !doseMetadataRef.current || !doseVisible) {
      console.log('[Dose] Early return:', { doseCanvas: !!doseCanvas, baseCanvas: !!baseCanvas, metadata: !!doseMetadataRef.current, doseVisible });
      return;
    }

    const ctx = doseCanvas.getContext('2d');
    if (!ctx) {
      console.log('[Dose] No 2d context');
      return;
    }

    // Match canvas dimensions
    if (doseCanvas.width !== baseCanvas.width || doseCanvas.height !== baseCanvas.height) {
      doseCanvas.width = baseCanvas.width;
      doseCanvas.height = baseCanvas.height;
    }

    const meta = doseMetadataRef.current;
    const frames = doseFramesRef.current;

    // Get current CT image for spatial alignment
    // CRITICAL: Use currentIndexRef.current, not currentIndex state, 
    // because during scrolling only the ref is updated (OHIF pattern)
    const activeIndex = currentIndexRef.current;
    const currentImage = images[activeIndex];
    if (!currentImage) {
      console.log('[Dose] No current image for index', activeIndex);
      return;
    }

    const ctSliceZ = currentImage.sliceZ ?? currentImage.parsedSliceLocation ?? currentImage.parsedZPosition;
    if (ctSliceZ == null) {
      console.log('[Dose] No CT slice Z position');
      return;
    }

    // Find the correct dose frame for this CT slice
    const frameIndex = findDoseFrameForSlice(ctSliceZ);
    console.log('[Dose] Frame lookup:', { ctSliceZ, frameIndex, activeIndex, availableFrames: Array.from(frames.keys()) });
    if (frameIndex === null) {
      console.log('[Dose] No dose frame for CT slice:', ctSliceZ);
      return;
    }

    const frameData = frames.get(frameIndex);
    if (!frameData || !meta.rows || !meta.columns) {
      console.log('[Dose] Missing frame data:', { frameIndex, hasFrameData: !!frameData, rows: meta.rows, cols: meta.columns, framesSize: frames.size, availableFrames: Array.from(frames.keys()) });
      return;
    }
    
    // IMPORTANT: Clear canvas AFTER all validation checks pass
    // This prevents erasing a valid overlay when a second call returns early
    ctx.clearRect(0, 0, doseCanvas.width, doseCanvas.height);
    
    // Find actual max dose in this frame for intelligent normalization
    let frameMaxDose = 0;
    for (let i = 0; i < frameData.length; i++) {
      if (frameData[i] > frameMaxDose) frameMaxDose = frameData[i];
    }
    
    console.log('[Dose] Drawing frame:', { 
      frameIndex, ctSliceZ, activeIndex, frameDataLength: frameData.length, 
      rows: meta.rows, cols: meta.columns,
      frameMaxDose, metaMaxDose: meta.maxDose, prescriptionDose
    });

    // Smart normalization: use prescription dose if close to data range, otherwise use actual data max
    // This ensures the colormap spans the actual dose range for visibility
    let maxDose: number;
    if (prescriptionDose > 0 && frameMaxDose > 0) {
      // If prescription dose is within 2x of actual max, use it (clinical relevance)
      // Otherwise, use actual max to ensure full colormap utilization
      const ratio = frameMaxDose / prescriptionDose;
      if (ratio >= 0.3 && ratio <= 2.0) {
        maxDose = prescriptionDose;
      } else {
        maxDose = frameMaxDose;
        console.log('[Dose] Using frame max dose for normalization (prescription dose too different):', { frameMaxDose, prescriptionDose, ratio });
      }
    } else {
      maxDose = frameMaxDose > 0 ? frameMaxDose : (meta.maxDose || 60);
    }
    const { rows: doseRows, columns: doseCols } = meta;

    // Get CT image geometry
    const ctImagePosition = parseImagePosition(currentImage) || [0, 0, 0];
    // Parse CT pixel spacing - can be string "row\\col" or array [row, col]
    // DICOM pixel spacing is [row spacing, column spacing] = [Y, X]
    let ctPixelSpacingY = 1, ctPixelSpacingX = 1;
    const rawCtSpacing = currentImage.pixelSpacing || currentImage.metadata?.pixelSpacing;
    if (typeof rawCtSpacing === 'string') {
      const parts = rawCtSpacing.split('\\').map(parseFloat);
      ctPixelSpacingY = parts[0] || 1;
      ctPixelSpacingX = parts[1] || parts[0] || 1;
    } else if (Array.isArray(rawCtSpacing)) {
      ctPixelSpacingY = rawCtSpacing[0] || 1;
      ctPixelSpacingX = rawCtSpacing[1] || rawCtSpacing[0] || 1;
    }
    const ctRows = currentImage.rows || currentImage.metadata?.rows || 512;
    const ctCols = currentImage.columns || currentImage.metadata?.columns || 512;

    // Get dose grid geometry
    const doseOrigin = meta.imagePositionPatient;
    const dosePixelSpacing = meta.pixelSpacing; // [row, col] = [Y, X]
    const dosePixelSpacingY = dosePixelSpacing[0] || 1;
    const dosePixelSpacingX = dosePixelSpacing[1] || dosePixelSpacing[0] || 1;

    // Get the current CT transform (scale, offset) from the rendering system
    // This ensures perfect alignment with the CT image
    const transform = ctTransform.current;
    if (!transform) {
      console.warn('[Dose] No CT transform available - skipping overlay');
      return;
    }

    // Calculate spatial alignment: where does the dose grid fall on the CT image?
    // CT image covers: [ctImagePosition[0], ctImagePosition[0] + ctCols * ctPixelSpacingX] in X
    //                  [ctImagePosition[1], ctImagePosition[1] + ctRows * ctPixelSpacingY] in Y
    // Dose grid covers: [doseOrigin[0], doseOrigin[0] + doseCols * dosePixelSpacingX] in X
    //                   [doseOrigin[1], doseOrigin[1] + doseRows * dosePixelSpacingY] in Y

    // Convert dose grid position to CT pixel coordinates
    const doseStartXInCT = (doseOrigin[0] - ctImagePosition[0]) / ctPixelSpacingX;
    const doseStartYInCT = (doseOrigin[1] - ctImagePosition[1]) / ctPixelSpacingY;
    const doseWidthInCT = (doseCols * dosePixelSpacingX) / ctPixelSpacingX;
    const doseHeightInCT = (doseRows * dosePixelSpacingY) / ctPixelSpacingY;

    // Create ImageData for the dose overlay at dose resolution
    const imageData = ctx.createImageData(doseCols, doseRows);
    const data = imageData.data;

    let nonZeroPixels = 0;

    // Apply colormap
    for (let i = 0; i < frameData.length; i++) {
      const doseValue = frameData[i];
      const normalizedDose = Math.min(1, doseValue / maxDose);

      // Skip only true zero doses - show all non-zero for debugging
      // OHIF colormap starts at 0, we need to show everything for proper rendering
      if (doseValue <= 0) {
        data[i * 4] = 0;
        data[i * 4 + 1] = 0;
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 0;
        continue;
      }

      nonZeroPixels++;

      // Apply colormap - clinical isodose style: Green(low) → Yellow → Orange → Red(prescription dose)
      // Scaled to full range (0-100% of prescription dose) for clinical relevance
      let r = 0, g = 0, b = 0;
      if (doseColormap === 'rainbow' || doseColormap === 'dosimetry') {
        // Clinical isodose colormap scaled to 0-100% of Rx dose:
        // 0-20%: Green → Yellow-Green
        // 20-40%: Yellow-Green → Yellow  
        // 40-60%: Yellow → Orange
        // 60-80%: Orange → Red-Orange
        // 80-100%+: Red-Orange → Red (prescription dose is pure red)
        if (normalizedDose < 0.2) {
          // 0% → 20%: Green to Yellow-Green
          const t = normalizedDose / 0.2;
          r = Math.floor(255 * 0.5 * t); // 0 → 127
          g = 255;
          b = 0;
        } else if (normalizedDose < 0.4) {
          // 20% → 40%: Yellow-Green to Yellow
          const t = (normalizedDose - 0.2) / 0.2;
          r = Math.floor(255 * (0.5 + 0.5 * t)); // 127 → 255
          g = 255;
          b = 0;
        } else if (normalizedDose < 0.6) {
          // 40% → 60%: Yellow to Orange
          const t = (normalizedDose - 0.4) / 0.2;
          r = 255;
          g = Math.floor(255 * (1 - 0.34 * t)); // 255 → 168
          b = 0;
        } else if (normalizedDose < 0.8) {
          // 60% → 80%: Orange to Red-Orange
          const t = (normalizedDose - 0.6) / 0.2;
          r = 255;
          g = Math.floor(255 * (0.66 - 0.33 * t)); // 168 → 84
          b = 0;
        } else if (normalizedDose < 1.0) {
          // 80% → 100%: Red-Orange to Red (prescription dose)
          const t = (normalizedDose - 0.8) / 0.2;
          r = 255;
          g = Math.floor(255 * (0.33 - 0.33 * t)); // 84 → 0
          b = 0;
        } else {
          // 100%+ (above prescription): Pure Red for hotspots
          r = 255; g = 0; b = 0;
        }
      } else if (doseColormap === 'hot') {
        // Hot: black -> red -> orange -> yellow -> white
        if (normalizedDose < 0.33) {
          r = Math.floor(255 * normalizedDose / 0.33); g = 0; b = 0;
        } else if (normalizedDose < 0.67) {
          r = 255; g = Math.floor(255 * (normalizedDose - 0.33) / 0.34); b = 0;
        } else {
          r = 255; g = 255; b = Math.floor(255 * (normalizedDose - 0.67) / 0.33);
        }
      } else {
        // Grayscale/Mono
        const gray = Math.floor(255 * normalizedDose);
        r = gray; g = gray; b = gray;
      }

      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      // OHIF-style opacity ramp with minimum visibility for low doses
      // Use sqrt for better visibility at low doses
      const alpha = Math.floor(220 * Math.sqrt(normalizedDose));
      // Ensure minimum alpha of 30 for any non-zero dose
      data[i * 4 + 3] = Math.max(30, Math.min(200, alpha));
    }

    if (nonZeroPixels === 0) {
      console.log('[Dose] No non-zero pixels, frameIndex:', frameIndex, 'maxDose:', maxDose, 'frameDataLength:', frameData?.length);
      return; // No dose data to display
    }

    // Sample dose values to understand the distribution
    const sampleDoseValues = Array.from(frameData.slice(0, 20));
    const maxFrameDose = Math.max(...frameData);
    const minFrameDose = Math.min(...frameData.filter(v => v > 0) || [0]);
    console.log('[Dose] Drawing overlay:', { 
      frameIndex,
      nonZeroPixels,
      totalPixels: frameData.length,
      doseOrigin,
      ctOrigin: ctImagePosition,
      doseStartInCT: [doseStartXInCT, doseStartYInCT],
      doseSizeInCT: [doseWidthInCT, doseHeightInCT],
      transform: { scale: transform.scale, offsetX: transform.offsetX, offsetY: transform.offsetY },
      maxDoseUsed: maxDose,
      maxFrameDose,
      minFrameDose,
      doseGridSize: { rows: doseRows, cols: doseCols },
      ctGridSize: { rows: ctRows, cols: ctCols },
      pixelSpacing: { ctX: ctPixelSpacingX, ctY: ctPixelSpacingY, doseX: dosePixelSpacingX, doseY: dosePixelSpacingY },
      sampleDoseValues: sampleDoseValues.slice(0, 5)
    });

    // Draw to offscreen canvas first, then scale to viewport with proper alignment
    const offscreen = document.createElement('canvas');
    offscreen.width = doseCols;
    offscreen.height = doseRows;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imageData, 0, 0);

      // Use the SAME transform as the CT image (from ctTransform.current)
      // This ensures pixel-perfect alignment with the underlying CT
      const { scale, offsetX, offsetY } = transform;
      
      // Calculate where dose grid should be drawn relative to CT image
      // transform.offsetX/Y is where the CT image origin (0,0 pixel) is on the canvas
      // doseStartXInCT/YInCT is where dose grid starts in CT pixel coordinates
      const doseDrawX = offsetX + (doseStartXInCT * scale);
      const doseDrawY = offsetY + (doseStartYInCT * scale);
      const doseDrawWidth = doseWidthInCT * scale;
      const doseDrawHeight = doseHeightInCT * scale;

      // Enable high-quality smoothing to reduce pixelation
      // RT Dose grids are typically lower resolution than CT (e.g., 128x128 vs 512x512)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, doseDrawX, doseDrawY, doseDrawWidth, doseDrawHeight);
      
      // === ISODOSE LINE RENDERING ===
      // Draw isodose contour lines at standard clinical levels (% of prescription dose)
      if (showIsodose) {
        // Standard clinical isodose levels with MIM-style colors
        const isodoseLevels = [
          { percent: 107, color: '#ff0080', lineWidth: 2 }, // Hot pink - overdose
          { percent: 105, color: '#ff0000', lineWidth: 2 }, // Red
          { percent: 100, color: '#ff8800', lineWidth: 2 }, // Orange - prescription
          { percent: 95, color: '#ffff00', lineWidth: 2 },  // Yellow
          { percent: 90, color: '#00ff00', lineWidth: 2 },  // Green
          { percent: 80, color: '#00ffff', lineWidth: 2 },  // Cyan
          { percent: 70, color: '#0088ff', lineWidth: 2 },  // Light blue
          { percent: 50, color: '#0000ff', lineWidth: 1 },  // Blue
          { percent: 30, color: '#8800ff', lineWidth: 1 },  // Purple
        ];
        
        // For each isodose level, find contour pixels using marching squares-like edge detection
        for (const level of isodoseLevels) {
          const threshold = (level.percent / 100) * maxDose;
          
          ctx.strokeStyle = level.color;
          ctx.lineWidth = level.lineWidth;
          ctx.beginPath();
          
          // Simple edge detection: find pixels where dose crosses the threshold
          for (let row = 0; row < doseRows - 1; row++) {
            for (let col = 0; col < doseCols - 1; col++) {
              const idx = row * doseCols + col;
              const v00 = frameData[idx];
              const v10 = frameData[idx + 1];
              const v01 = frameData[idx + doseCols];
              const v11 = frameData[idx + doseCols + 1];
              
              // Check if threshold crosses any edge of this cell
              const above00 = v00 >= threshold;
              const above10 = v10 >= threshold;
              const above01 = v01 >= threshold;
              const above11 = v11 >= threshold;
              
              // If all corners are same (all above or all below), no contour in this cell
              if (above00 === above10 && above10 === above01 && above01 === above11) {
                continue;
              }
              
              // Calculate pixel position in canvas coordinates
              const cellX = doseDrawX + (col / doseCols) * doseDrawWidth;
              const cellY = doseDrawY + (row / doseRows) * doseDrawHeight;
              const cellW = doseDrawWidth / doseCols;
              const cellH = doseDrawHeight / doseRows;
              
              // Simple approach: draw small line segments where contour crosses edges
              // Left edge (v00 to v01)
              if (above00 !== above01) {
                const t = (threshold - v00) / (v01 - v00);
                const py = cellY + t * cellH;
                ctx.moveTo(cellX, py);
                ctx.lineTo(cellX + cellW * 0.5, cellY + cellH * 0.5);
              }
              
              // Top edge (v00 to v10)
              if (above00 !== above10) {
                const t = (threshold - v00) / (v10 - v00);
                const px = cellX + t * cellW;
                ctx.moveTo(px, cellY);
                ctx.lineTo(cellX + cellW * 0.5, cellY + cellH * 0.5);
              }
              
              // Right edge (v10 to v11)
              if (above10 !== above11) {
                const t = (threshold - v10) / (v11 - v10);
                const py = cellY + t * cellH;
                ctx.moveTo(cellX + cellW, py);
                ctx.lineTo(cellX + cellW * 0.5, cellY + cellH * 0.5);
              }
              
              // Bottom edge (v01 to v11)
              if (above01 !== above11) {
                const t = (threshold - v01) / (v11 - v01);
                const px = cellX + t * cellW;
                ctx.moveTo(px, cellY + cellH);
                ctx.lineTo(cellX + cellW * 0.5, cellY + cellH * 0.5);
              }
            }
          }
          
          ctx.stroke();
        }
        
        console.log('[Dose] Drew isodose lines for', isodoseLevels.length, 'levels');
      }
    }
  }, [doseVisible, doseColormap, prescriptionDose, images, currentIndex, findDoseFrameForSlice, parseImagePosition, showIsodose]);

  // Trigger dose redraw when relevant states change
  useEffect(() => {
    console.log('[Dose] Redraw useEffect triggered:', { doseSeriesId, doseVisible, framesSize: doseFrames.size, currentIndex });
    if (doseSeriesId && doseVisible && doseFrames.size > 0) {
      console.log('[Dose] Calling drawDoseOverlay from redraw useEffect');
      drawDoseOverlay();
    }
  }, [doseSeriesId, doseVisible, doseFrames, currentIndex, drawDoseOverlay]);
  
  // Abort controller for series changes
  const seriesAbortRef = useRef<AbortController | null>(null);
  
  // Optimized rendering with cached LUT and offscreen canvas
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedLUTRef = useRef<{ key: string; lut: Uint8Array } | null>(null);
  
  // Secondary image prefetch optimization
  const secondaryPrefetchCompleteRef = useRef(false);

  // Missing caches/levels used later in the file
  const imageCacheRef = useRef<Map<string, any>>(new Map());
  const mprCacheRef = useRef<Map<string, any>>(new Map());
  const [currentWindowLevel, setCurrentWindowLevel] = useState<{ width: number; center: number }>(
    props.windowLevel ? { width: props.windowLevel.window, center: props.windowLevel.level } : { width: 350, center: 40 }
  );

  // Keep internal window/level in sync with prop changes from sidebar sliders/presets
  useEffect(() => {
    if (props.windowLevel) {
      const nextWidth = props.windowLevel.window;
      const nextCenter = props.windowLevel.level;
      // Only update if values actually changed to avoid unnecessary renders
      if (
        nextWidth !== currentWindowLevel.width ||
        nextCenter !== currentWindowLevel.center
      ) {
        setCurrentWindowLevel({ width: nextWidth, center: nextCenter });
      }
    }
  }, [props.windowLevel?.window, props.windowLevel?.level]);
  const updateWindowLevel = ({ width, center }: { width: number; center: number }) => {
    setCurrentWindowLevel({ width, center });
    onWindowLevelChange && onWindowLevelChange({ window: width, level: center });
  };

  // Save contour updates using debounced save
  // Optionally pass modifiedRoiNumbers to trigger auto-update for dependent superstructures
  const saveContourUpdates = (updatedStructures: any, action?: string, modifiedRoiNumbers?: number[]) => {
    log.debug(`Queuing save for ${action || 'unknown action'}`, 'viewer');
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current(updatedStructures);
    } else {
      log.warn('Debounced save not initialized', 'viewer');
    }
    
    // Emit event to trigger auto-updates for dependent superstructures
    if (modifiedRoiNumbers && modifiedRoiNumbers.length > 0) {
      window.dispatchEvent(new CustomEvent('structure:modified', {
        detail: { roiNumbers: modifiedRoiNumbers }
      }));
    }
  };

  // Handle boolean operations (combine/subtract) between structures
  const handleBooleanOperation = async (payload: any) => {
    if (!rtStructures) {
      log.error('RT structures not available for boolean operation', 'viewer');
      return;
    }

    const { operation, sourceStructureId, targetStructureId, slicePosition } = payload;
    log.debug(`🔶 Performing ${operation} op between ${sourceStructureId} and ${targetStructureId} @ slice ${slicePosition}`, 'viewer');

    // Create a deep copy of RT structures to avoid mutation
    const updatedRTStructures = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));

    // Find the source and target structures
    const sourceStructure = updatedRTStructures.structures?.find(
      (s: any) => s.roiNumber === sourceStructureId,
    );
    const targetStructure = updatedRTStructures.structures?.find(
      (s: any) => s.roiNumber === targetStructureId,
    );

    if (!sourceStructure || !targetStructure) {
      log.error('Source or target structure not found', 'viewer');
      return;
    }

    // Find contours on the specified slice for both structures
    const sourceContour = sourceStructure.contours?.find(
      (c: any) => Math.abs(c.slicePosition - slicePosition) < SLICE_TOL_MM,
    );
    const targetContour = targetStructure.contours?.find(
      (c: any) => Math.abs(c.slicePosition - slicePosition) < SLICE_TOL_MM,
    );

    if (!sourceContour || !sourceContour.points || sourceContour.points.length < 9) {
      log.warn(`No source contour found on slice ${slicePosition}`, 'viewer');
      return;
    }

    if (!targetContour || !targetContour.points || targetContour.points.length < 9) {
      log.warn(`No target contour found on slice ${slicePosition}`, 'viewer');
      return;
    }

    try {
      let resultContours: number[][];

      // Import the boolean operations
      const { combineContours, subtractContours } = await import('@/lib/clipper-boolean-operations');

      if (operation === 'combine') {
        // Combine the two contours
        resultContours = await combineContours(sourceContour.points, targetContour.points);
        log.debug(`🔶 Combine returned ${resultContours.length} contours`, 'viewer');
      } else if (operation === 'subtract') {
        // Subtract target from source
        resultContours = await subtractContours(sourceContour.points, targetContour.points);
        log.debug(`🔶 Subtract returned ${resultContours.length} contours`, 'viewer');
      } else {
        log.error(`Unknown boolean operation: ${operation}`, 'viewer');
        return;
      }

      // Remove the source contour from current slice
      const sourceContourIndex = sourceStructure.contours.findIndex(
        (c: any) => Math.abs(c.slicePosition - slicePosition) < SLICE_TOL_MM
      );
      
      if (sourceContourIndex >= 0) {
        sourceStructure.contours.splice(sourceContourIndex, 1);
      }

      // Add all result contours
      if (resultContours && resultContours.length > 0) {
        resultContours.forEach((contourPoints: number[]) => {
          if (contourPoints.length >= 9) {
            sourceStructure.contours.push({
              slicePosition: slicePosition,
              points: contourPoints,
              numberOfPoints: contourPoints.length / 3,
            });
          }
        });
        
        log.debug(`✅ Boolean ${operation} completed: ${resultContours.length} contours`, 'viewer');
      } else {
        log.debug(`✅ Boolean ${operation} completed: empty`, 'viewer');
      }

      // Update local structures and save to server
      setLocalRTStructures(updatedRTStructures);
      saveContourUpdates(updatedRTStructures, 'boolean_operation');
      
      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(updatedRTStructures);
      }

      // Save state to undo system
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          'boolean_operation', 
          sourceStructureId, 
          updatedRTStructures,
          slicePosition,
          sourceStructure.structureName
        );
      }

    } catch (error) {
      log.error(`Error performing ${operation} op: ${String(error)}`, 'viewer');
    }
  };

  // Handle Eclipse TPS margin operation (single slice legacy)
  const handleMarginOperation = (payload: any) => {
    log.debug('🔹 handleMarginOperation called', 'viewer');
    
    if (!localRTStructures && !rtStructures) {
      log.error('RT structures not available for margin operation', 'viewer');
      return;
    }

    const structures = localRTStructures || rtStructures;
    const { structureId } = payload;
    
    // For single slice margin operations (legacy)
    if (payload.slicePosition !== undefined) {
      log.debug('🔹 Single slice margin operation (legacy)', 'viewer');
      
      const { slicePosition, marginParams } = payload;
      const updatedRTStructures = structuredClone ? structuredClone(structures) : JSON.parse(JSON.stringify(structures));
      
      const structure = updatedRTStructures.structures?.find(
        (s: any) => s.roiNumber === structureId,
      );
      
      if (!structure) {
        log.error(`Structure ${structureId} not found`, 'viewer');
        return;
      }
      
      const contour = structure.contours.find(
        (c: any) => Math.abs(c.slicePosition - slicePosition) <= SLICE_TOL_MM,
      );
      
      if (!contour || !contour.points || contour.points.length === 0) {
        log.warn(`No contour found for structure ${structureId} at slice ${slicePosition}`, 'viewer');
        return;
      }
      
      try {
        const marginValueMm = marginParams.marginValues.uniform;
        
        const grownContour = growContour(
          {
            points: contour.points,
            slicePosition: slicePosition,
          },
          marginValueMm,
        );
        
        let smoothingFactor = 0.15;
        if (marginParams.interpolationType === 'SMOOTH') {
          smoothingFactor = 0.25;
        } else if (marginParams.interpolationType === 'DISCRETE') {
          smoothingFactor = 0.05;
        }
        
        const smoothedContour = smoothContour(grownContour, smoothingFactor);
        
        contour.points = smoothedContour.points;
        contour.numberOfPoints = smoothedContour.points.length / 3;
        
        setLocalRTStructures(updatedRTStructures);
        saveContourUpdates(updatedRTStructures, 'apply_margin');
        
        if (onContourUpdate) {
          onContourUpdate(updatedRTStructures);
        }
        
        log.debug(`Applied margin of ${marginValueMm}mm to structure ${structureId}`, 'viewer');
      } catch (error) {
        log.error(`Error applying margin operation: ${String(error)}`, 'viewer');
      }
    }
  };

  // Handle grow contour operation using medical imaging algorithms
  const handleGrowContour = (payload: any) => {
    if (!localRTStructures) {
      console.error("RT structures not available for growing");
      return;
    }

    const { structureId, slicePosition, distance, direction = 'all' } = payload;
    const isGrowing = distance > 0;
    if (RT_STRUCTURE_DEBUG) {
      console.log(
        `${isGrowing ? 'Growing' : 'Shrinking'} contour for structure ${structureId} by ${Math.abs(distance)}mm ${direction !== 'all' ? `in ${direction} direction` : 'in all directions'} at slice ${slicePosition}`,
      );
    }

    // Create a deep copy of RT structures to avoid mutation
    const updatedRTStructures = structuredClone ? structuredClone(localRTStructures) : JSON.parse(JSON.stringify(localRTStructures));

    // Find the target structure
    const structure = updatedRTStructures.structures?.find(
      (s: any) => s.roiNumber === structureId,
    );
    if (!structure) {
      console.error(`Structure ${structureId} not found`);
      return;
    }

    // Find the contour for the specified slice
    const contour = structure.contours?.find(
      (c: any) => Math.abs(c.slicePosition - slicePosition) < SLICE_TOL_MM,
    );

    if (!contour || !contour.points || contour.points.length < 9) {
      console.warn(
        `No contour found on slice ${slicePosition} or insufficient points`,
      );
      return;
    }

    try {
      let updatedPoints: number[];
      
      if (direction === 'all') {
        // For single slice operations, still use 2D for speed
        // But note this is a single-slice operation, not volumetric
        updatedPoints = growContourSimple(contour.points, distance);
      } else {
        // Use directional grow/shrink
        updatedPoints = applyDirectionalGrow(
          contour.points,
          distance,
          direction,
          imageMetadata?.imageOrientation
        );
        
        // Apply smoothing
        const smoothedContour = smoothContour(
          {
            points: updatedPoints,
            slicePosition: slicePosition,
          },
          0.15
        );
        updatedPoints = smoothedContour.points;
      }

      // Update the contour with grown/shrunk points
      contour.points = updatedPoints;
      contour.numberOfPoints = updatedPoints.length / 3;

      // Update local structures and save to server
      setLocalRTStructures(updatedRTStructures);
      saveContourUpdates(updatedRTStructures, 'grow_contour');
      
      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(updatedRTStructures);
      }

      console.log(`Successfully ${isGrowing ? 'grew' : 'shrunk'} contour by ${Math.abs(distance)}mm`);
    } catch (error) {
      console.error(`Error ${isGrowing ? 'growing' : 'shrinking'} contour:`, error);
    }
  };

  // Handle advanced margin execution operation
  const handleAdvancedMarginExecution = async (payload: any) => {
    console.log('🔹 🎯 Working Viewer: handleAdvancedMarginExecution called with payload:', payload);
    
    // Use local structures or props structures
    const structures = localRTStructures || rtStructures;
    
    if (!structures) {
      console.error("🔹 ❌ RT structures not available for margin execution");
      return;
    }
    
    const { structureId, targetStructureId, parameters, outputName, outputColor, saveAsSuperstructure, superstructureInfo } = payload;
    
    console.log(`🔹 📊 Executing margin operation for structure ${structureId} with parameters:`, parameters);
    console.log(`🔹 Target structure ID: ${targetStructureId || 'same structure'}`);
    console.log(`🔹 Output name: ${outputName || 'auto-generated'}, Output color:`, outputColor);
    console.log(`🔹 Save as superstructure: ${saveAsSuperstructure}`);
    
    try {
      // Create a deep copy of RT structures
      const updatedRTStructures = structuredClone ? structuredClone(structures) : JSON.parse(JSON.stringify(structures));
      
      // Find the source structure
      const sourceStructure = updatedRTStructures.structures?.find(
        (s: any) => s.roiNumber === structureId,
      );
      
      if (!sourceStructure) {
        console.error(`Source structure ${structureId} not found`);
        return;
      }
      
      // Determine target structure
      let targetStructure = sourceStructure;
      const marginValue = parameters.marginValues?.uniform || parameters.margin || 5;
      
      if (targetStructureId === 'new') {
        // Create a new structure for the margin result
        const maxRoi = Math.max(0, ...updatedRTStructures.structures.map((s: any) => s.roiNumber || 0));
        
        // Use provided name or auto-generate
        const marginSuffix = marginValue >= 0 ? `+${marginValue}mm` : `${marginValue}mm`;
        const newName = outputName || `${sourceStructure.structureName}${marginSuffix}`;
        
        // Use provided color or generate a contrasting color
        let newColor: [number, number, number];
        if (outputColor && Array.isArray(outputColor) && outputColor.length === 3) {
          newColor = outputColor as [number, number, number];
        } else {
          // Generate a contrasting color (shift hue from source)
          const sourceColor = sourceStructure.color || [255, 0, 0];
          newColor = [
            (sourceColor[0] + 128) % 256,
            (sourceColor[1] + 64) % 256,
            sourceColor[2]
          ];
        }
        
        targetStructure = {
          roiNumber: maxRoi + 1,
          structureName: newName,
          color: newColor,
          contours: []
        };
        updatedRTStructures.structures.push(targetStructure);
        console.log(`🔹 Created new structure "${newName}" with roiNumber ${maxRoi + 1} and color [${newColor.join(', ')}]`);
      } else if (targetStructureId && targetStructureId !== structureId) {
        targetStructure = updatedRTStructures.structures?.find(
          (s: any) => s.roiNumber === targetStructureId,
        );
        if (!targetStructure) {
          console.error(`Target structure ${targetStructureId} not found`);
          return;
        }
      }
      
      console.log(`🔹 Applying margin of ${marginValue}mm to ${sourceStructure.contours?.length || 0} contours`);

      // Uniform margin: use DT-based margin-worker (same as preview) for accurate Eclipse-like results
      if (parameters?.marginType === 'UNIFORM') {
        try {
          console.log('🔹 Using DT-based margin-worker for accurate margin execution');
          const worker = new Worker(new URL('@/margins/margin-worker.ts', import.meta.url), { type: 'module' });
          const px = imageMetadata?.pixelSpacing || [1, 1];
          const th = imageMetadata?.sliceThickness || 2;
          const spacing: [number, number, number] = [px[1] ?? px[0], px[0], th];
          const jobId = `exec-${Date.now()}`;
          const padding = Math.abs(marginValue) + 5;
          const srcContours = sourceStructure.contours || [];
          
          const workerPromise: Promise<any> = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              try { worker.terminate(); } catch {}
              reject(new Error('Margin worker timeout'));
            }, 30000); // 30 second timeout
            
            worker.onmessage = (ev: MessageEvent<any>) => {
              if (!ev.data || ev.data.jobId !== jobId) return;
              clearTimeout(timeout);
              try { worker.terminate(); } catch {}
              if (ev.data.ok) resolve(ev.data.contours); else reject(ev.data.error);
            };
            worker.onerror = (err) => {
              clearTimeout(timeout);
              try { worker.terminate(); } catch {}
              reject(err);
            };
          });
          
          worker.postMessage({ jobId, kind: 'UNIFORM', contours: srcContours, spacing, padding, margin: marginValue });
          const workerContours = await workerPromise;
          
          const processedContours = (workerContours || []).map((c: any) => ({
            slicePosition: c.slicePosition,
            points: c.points,
            numberOfPoints: c.points.length / 3
          }));
          targetStructure.contours = processedContours;
          console.log(`🔹 ✅ DT margin worker produced ${processedContours.length} contours`);
        } catch (e2) {
          console.warn('DT margin worker failed, falling back to clipper offset:', e2);
          const { offsetContour } = await import('@/lib/clipper-boolean-operations');
          const processedContours: any[] = [];
          for (const contour of sourceStructure.contours || []) {
            if (!contour.points || contour.points.length < 9) continue;
            try {
              const outs = await offsetContour(contour.points, marginValue);
              outs?.forEach(out => {
                if (out.length >= 9) {
                  processedContours.push({
                    slicePosition: contour.slicePosition,
                    points: out,
                    numberOfPoints: out.length / 3
                  });
                }
              });
            } catch (err) {
              console.warn('Offset execution failed; preserving original contour:', err);
              processedContours.push({
                slicePosition: contour.slicePosition,
                points: contour.points,
                numberOfPoints: contour.points.length / 3
              });
            }
          }
          targetStructure.contours = processedContours;
        }

        // Persist to undo/redo
        if (seriesId) {
          undoRedoManager.saveState(
            seriesId, 
            'apply_margin', 
            structureId, 
            updatedRTStructures,
            undefined, // Margin applies to all slices
            sourceStructure.structureName
          );
        }
        setLocalRTStructures(updatedRTStructures);
        saveContourUpdates(updatedRTStructures, 'apply_margin');
        if (onContourUpdate) {
          onContourUpdate(updatedRTStructures);
        }
        console.log(`✅ Successfully applied uniform margin to structure ${targetStructure.roiNumber}`);
        
        // Create superstructure if requested (for auto-update functionality)
        if (saveAsSuperstructure && superstructureInfo && targetStructureId === 'new') {
          try {
            const superstructurePayload = {
              rtStructureRoiNumber: targetStructure.roiNumber,
              rtSeriesId: superstructureInfo.rtSeriesId,
              sourceStructureRoiNumbers: [superstructureInfo.sourceStructureRoiNumber],
              sourceStructureNames: [superstructureInfo.sourceStructureName],
              operationExpression: superstructureInfo.operationExpression,
              operationType: 'margin',
              autoUpdate: true
            };
            
            console.log('🔹 Creating margin superstructure:', superstructurePayload);
            
            const response = await fetch('/api/superstructures', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(superstructurePayload)
            });
            
            if (response.ok) {
              console.log('✅ Margin superstructure created successfully');
              window.dispatchEvent(new CustomEvent('superstructures:reload', {
                detail: { rtSeriesId: superstructureInfo.rtSeriesId }
              }));
            } else {
              console.error('Failed to create margin superstructure:', await response.text());
            }
          } catch (err) {
            console.error('Error creating margin superstructure:', err);
          }
        }
        
        return;
      }
      
      // Use DT-based margin-worker for accurate directional/anisotropic margins
      let processedContours: any[] = [];
      
      try {
        console.log(`🔹 Using DT-based margin-worker for ${parameters?.marginType || 'directional'} margin`);
        const worker = new Worker(new URL('@/margins/margin-worker.ts', import.meta.url), { type: 'module' });
        const px = imageMetadata?.pixelSpacing || [1, 1];
        const th = imageMetadata?.sliceThickness || 2;
        const spacing: [number, number, number] = [px[1] ?? px[0], px[0], th];
        const jobId = `exec-dir-${Date.now()}`;
        const padding = Math.abs(marginValue) + 10;
        const srcContours = sourceStructure.contours || [];
        
        // Prepare directional margins if available
        const perSide = parameters?.marginValues || { post: marginValue, ant: marginValue, left: marginValue, right: marginValue, sup: marginValue, inf: marginValue };
        const kind = parameters?.marginType === 'ANISOTROPIC' ? 'ANISOTROPIC' : 'DIRECTIONAL';
        
        const workerPromise: Promise<any> = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            try { worker.terminate(); } catch {}
            reject(new Error('Margin worker timeout'));
          }, 30000);
          
          worker.onmessage = (ev: MessageEvent<any>) => {
            if (!ev.data || ev.data.jobId !== jobId) return;
            clearTimeout(timeout);
            try { worker.terminate(); } catch {}
            if (ev.data.ok) resolve(ev.data.contours); else reject(ev.data.error);
          };
          worker.onerror = (err) => {
            clearTimeout(timeout);
            try { worker.terminate(); } catch {}
            reject(err);
          };
        });
        
        worker.postMessage({ jobId, kind, contours: srcContours, spacing, padding, perSide });
        const workerContours = await workerPromise;
        
        processedContours = (workerContours || []).map((c: any) => ({
          slicePosition: c.slicePosition,
          points: c.points,
          numberOfPoints: c.points.length / 3
        }));
        
        console.log(`🔹 ✅ DT margin worker produced ${processedContours.length} contours`);
        
      } catch (error) {
        console.warn('🔹 ⚠️ DT margin worker failed, falling back to clipper offset:', error);
        
        // Fallback to clipper offset for robustness
        const { offsetContour } = await import('@/lib/clipper-boolean-operations');
        
        for (const contour of sourceStructure.contours || []) {
          if (!contour.points || contour.points.length < 9) continue;
          
          try {
            const outs = await offsetContour(contour.points, marginValue);
            outs?.forEach(out => {
              if (out.length >= 9) {
                processedContours.push({
                  slicePosition: contour.slicePosition,
                  points: out,
                  numberOfPoints: out.length / 3
                });
              }
            });
          } catch (err) {
            console.warn(`Failed to process contour at slice ${contour.slicePosition}:`, err);
          }
        }
      }
      
      // Apply results to target structure
      targetStructure.contours = processedContours;
      
      console.log(`🔹 ✅ Applied simple/3D margin, generated ${processedContours.length} contours`);
      
      // Save to undo/redo and persist
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          'apply_margin', 
          structureId, 
          updatedRTStructures,
          undefined, // Margin applies to all slices
          targetStructure.structureName
        );
      }
      setLocalRTStructures(updatedRTStructures);
      saveContourUpdates(updatedRTStructures, 'apply_margin');
      
      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(updatedRTStructures);
      }
      
      console.log(`✅ Successfully applied simple margin to structure ${targetStructure.roiNumber}`);
      
      // Create superstructure if requested (for auto-update functionality)
      if (saveAsSuperstructure && superstructureInfo && targetStructureId === 'new') {
        try {
          const superstructurePayload = {
            rtStructureRoiNumber: targetStructure.roiNumber,
            rtSeriesId: superstructureInfo.rtSeriesId,
            sourceStructureRoiNumbers: [superstructureInfo.sourceStructureRoiNumber],
            sourceStructureNames: [superstructureInfo.sourceStructureName],
            operationExpression: superstructureInfo.operationExpression,
            operationType: 'margin',
            autoUpdate: true
          };
          
          console.log('🔹 Creating margin superstructure:', superstructurePayload);
          
          const response = await fetch('/api/superstructures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(superstructurePayload)
          });
          
          if (response.ok) {
            console.log('✅ Margin superstructure created successfully');
            window.dispatchEvent(new CustomEvent('superstructures:reload', {
              detail: { rtSeriesId: superstructureInfo.rtSeriesId }
            }));
          } else {
            console.error('Failed to create margin superstructure:', await response.text());
          }
        } catch (err) {
          console.error('Error creating margin superstructure:', err);
        }
      }
    } catch (error) {
      console.error("🔹 ❌ Error applying simple margin operation:", error);
    }
  };

  // Handle grow structure operation - works on ALL slices
  const handleGrowStructure = (payload: any) => {
    if (!localRTStructures) {
      console.error("RT structures not available for structure growing");
      return;
    }

    const { structureId, distance, direction = 'all' } = payload;
    const isGrowing = distance > 0;
    if (RT_STRUCTURE_DEBUG) {
      console.log(
        `🔹 ${isGrowing ? 'Growing' : 'Shrinking'} ENTIRE STRUCTURE ${structureId} by ${Math.abs(distance)}mm on ALL slices`,
      );
    }

    // Create a deep copy of RT structures to avoid mutation
    const updatedRTStructures = structuredClone ? structuredClone(localRTStructures) : JSON.parse(JSON.stringify(localRTStructures));

    // Find the target structure
    const structure = updatedRTStructures.structures?.find(
      (s: any) => s.roiNumber === structureId,
    );
    if (!structure) {
      console.error(`Structure ${structureId} not found`);
      return;
    }

    // Get all contours for this structure
    const allContours = structure.contours || [];
    if (allContours.length === 0) {
      console.error(`No contours found for structure ${structureId}`);
      return;
    }

    try {
      let processedSlices = 0;
      
      for (const contour of allContours) {
        if (!contour.points || contour.points.length < 9) continue;
        
        let updatedPoints: number[];
        
        if (direction === 'all') {
          // Use new simple polygon grow/shrink algorithm for better results
          updatedPoints = growContourSimple(contour.points, distance);
        } else {
          // Use directional grow/shrink
          updatedPoints = applyDirectionalGrow(
            contour.points,
            distance,
            direction,
            imageMetadata?.imageOrientation
          );
          
          // Apply smoothing
          const smoothedContour = smoothContour(
            {
              points: updatedPoints,
              slicePosition: contour.slicePosition,
            },
            0.15
          );
          updatedPoints = smoothedContour.points;
        }

        // Update the contour with grown/shrunk points
        contour.points = updatedPoints;
        contour.numberOfPoints = updatedPoints.length / 3;
        processedSlices++;
      }

      // Update local structures and save to server
      setLocalRTStructures(updatedRTStructures);
      saveContourUpdates(updatedRTStructures, 'grow_structure');
      
      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(updatedRTStructures);
      }

      console.log(`🔹 ✅ Successfully ${isGrowing ? 'grew' : 'shrunk'} structure ${structureId} on ${processedSlices} slices by ${Math.abs(distance)}mm`);
    } catch (error) {
      console.error(`🔹 ❌ Error ${isGrowing ? 'growing' : 'shrinking'} structure:`, error);
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPanX, setLastPanX] = useState(0);
  const [lastPanY, setLastPanY] = useState(0);

  // Simple debounce implementation
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    const debounced = (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
    debounced.cancel = () => clearTimeout(timeout);
    return debounced;
  };

  // Create debounced save function
  const debouncedSaveRef = useRef<any>(null);
  const lastSavedHashRef = useRef<string>("");
  
  // Initialize debounced save on mount
  useEffect(() => {
    const saveToServer = async (structures: any) => {
      if (!structures) return;
      
      // Create hash of structures to check for changes
      const structuresHash = JSON.stringify({
        count: structures.structures?.length || 0,
        contourCounts: structures.structures?.map((s: any) => ({
          id: s.roiNumber,
          count: s.contours?.length || 0
        }))
      });
      
      // Skip if no changes since last save
      if (structuresHash === lastSavedHashRef.current) {
        console.log("Skipping save - no changes detected");
        return;
      }
      
      try {
        console.log("Saving contour updates to server...");
        if (onRTStructureUpdate) {
          await onRTStructureUpdate(structures);
        }
        lastSavedHashRef.current = structuresHash;

        // Check for superstructures that need auto-regeneration
        if (structures.seriesId && structures.structures) {
          try {
            const modifiedStructureIds = structures.structures.map((s: any) => s.roiNumber);
            const response = await fetch('/api/superstructures/check-auto-update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rtStructureSetId: structures.seriesId,
                modifiedStructureIds
              })
            });

            if (response.ok) {
              const result = await response.json();
              if (result.regeneratedCount > 0) {
                console.log(`🔄 Auto-regenerated ${result.regeneratedCount} superstructure(s)`);
                // TODO: Optionally reload structures to show updated superstructures
              }
            }
          } catch (autoUpdateError) {
            console.warn('Failed to check superstructure auto-updates:', autoUpdateError);
            // Don't fail the save if auto-update check fails
          }
        }
      } catch (error) {
        console.error("Failed to save contour updates:", error);
      }
    };
    
    // Create debounced function with 500ms delay
    debouncedSaveRef.current = debounce(saveToServer, 500);
    
    return () => {
      if (debouncedSaveRef.current?.cancel) {
        debouncedSaveRef.current.cancel();
      }
    };
  }, [onRTStructureUpdate]);

  // Helper to extract image data for prediction
  const extractImageDataForPrediction = useCallback((imageIndex: number) => {
    if (!images || imageIndex < 0 || imageIndex >= images.length) {
      console.warn(`📊 Pixel data extraction failed: Invalid index ${imageIndex} (images length: ${images?.length || 0})`);
      return null;
    }

    const img = images[imageIndex];
    if (!img?.sopInstanceUID) {
      console.warn(`📊 Pixel data extraction failed: Image at index ${imageIndex} has no sopInstanceUID`);
      return null;
    }

    // Get the cached image data with pixel data
    const cachedImage = imageCacheRef.current.get(img.sopInstanceUID);
    if (!cachedImage || !cachedImage.data) {
      console.warn(`📊 Pixel data extraction failed: Image at index ${imageIndex} has no pixelData property in cache (cached: ${!!cachedImage}, has data: ${!!cachedImage?.data})`);
      return null;
    }

    try {
      // Extract pixel data and metadata from cached image
      const pixelData = cachedImage.data;
      const width = cachedImage.columns || cachedImage.width || 512;
      const height = cachedImage.rows || cachedImage.height || 512;

      if (PREDICTION_DEBUG) {
        const sample = Array.from(pixelData.slice(0, 100)) as number[];
        const minVal = Math.min(...sample);
        const maxVal = Math.max(...sample);
        console.log(`📊 Pixel data extracted for image ${imageIndex}: ${pixelData.length} pixels, range: [${minVal.toFixed(1)}, ${maxVal.toFixed(1)}]`);
      }

      return {
        pixels: pixelData, // Float32Array or Uint16Array
        width: width,
        height: height,
        rescaleSlope: cachedImage.rescaleSlope || 1,
        rescaleIntercept: cachedImage.rescaleIntercept || 0,
        windowCenter: cachedImage.windowCenter,
        windowWidth: cachedImage.windowWidth
      };
    } catch (error) {
      console.warn('📊 Failed to extract image data for prediction:', error);
      return null;
    }
  }, [images]);

  // Generate prediction for current slice
  const generatePredictionForCurrentSlice = useCallback(async (structureId: number, slicePosition: number) => {
    const requestId = ++predictionRequestIdRef.current;
    
    // Get structure
    if (!rtStructures?.structures) {
      updateActivePredictions(new Map());
      return;
    }
    
    const structure = rtStructures.structures.find((s: any) => s.roiNumber === structureId);
    if (!structure || !structure.contours || structure.contours.length === 0) {
      updateActivePredictions(new Map());
      return;
    }
    
    // Check if this slice already has a real contour
    const hasContour = structure.contours.some((c: any) => 
      !c.isPredicted && 
      c.points?.length >= 9 && 
      Math.abs(c.slicePosition - slicePosition) < 0.5
    );
    
    if (hasContour) {
      updateActivePredictions(new Map());
      return;
    }
    
    // Calculate slice spacing for distance limit
    let sliceSpacing = 2.5;
    if (imageMetadata) {
      const spacing = getSpacing(imageMetadata);
      sliceSpacing = spacing.z || 2.5;
    } else if (images && images.length >= 2) {
      const z0 = images[0]?.sliceZ || images[0]?.parsedSliceLocation || 0;
      const z1 = images[1]?.sliceZ || images[1]?.parsedSliceLocation || 1;
      sliceSpacing = Math.abs(z1 - z0) || 2.5;
    }
    
    // Check prediction mode
    const predictionMode = brushToolState?.predictionMode || 'geometric';
    let finalContour: number[] = [];
    let method = 'simple_copy';
    let confidence = 0.5;
    let referenceSlice = slicePosition;
    
    // Try to get image data for edge detection (geometric mode)
    const targetSliceData = extractImageDataForPrediction(currentIndex);
    
    // Build coordinate transforms
    let coordinateTransforms: CoordinateTransforms | null = null;
    if (imageMetadata) {
      const ps = imageMetadata?.pixelSpacing || [1, 1];
      const ipp = imageMetadata?.imagePosition || [0, 0, 0];
      const rowSpacing = Array.isArray(ps) ? (ps[0] || 1) : 1;
      const colSpacing = Array.isArray(ps) ? (ps[1] || 1) : 1;
      const imagePositionX = Array.isArray(ipp) ? (ipp[0] || 0) : 0;
      const imagePositionY = Array.isArray(ipp) ? (ipp[1] || 0) : 0;
      
      coordinateTransforms = {
        worldToPixel: (x: number, y: number): [number, number] => {
          const px = (x - imagePositionX) / colSpacing;
          const py = (y - imagePositionY) / rowSpacing;
          return [px, py];
        },
        pixelToWorld: (px: number, py: number): [number, number] => {
          const x = px * colSpacing + imagePositionX;
          const y = py * rowSpacing + imagePositionY;
          return [x, y];
        },
      };
    }
    
    // Handle different prediction modes
    if (predictionMode === 'geometric') {
      // GEO mode: Simple copy from nearest contour (fast, basic)
      const nearest = findNearestContour(structure.contours, slicePosition, sliceSpacing);
      if (!nearest) {
        updateActivePredictions(new Map());
        return;
      }
      
      referenceSlice = nearest.slicePosition;
      
      // Use edge detection if we have image data
      if (targetSliceData?.pixels && coordinateTransforms) {
        const edgeResult = predictContourWithEdges(
          nearest.points,
          nearest.slicePosition,
          slicePosition,
          {
            pixels: targetSliceData.pixels,
            width: targetSliceData.width,
            height: targetSliceData.height
          },
          coordinateTransforms
        );
        
        if (edgeResult.contour.length >= 9) {
          finalContour = edgeResult.contour;
          method = edgeResult.method;
          confidence = edgeResult.confidence;
        }
      }
      
      // Fallback to simple copy if edge detection didn't work
      if (finalContour.length < 9) {
        const simpleResult = predictContourSimple(nearest.points, nearest.slicePosition, slicePosition);
        finalContour = simpleResult.contour;
        method = simpleResult.method;
        confidence = simpleResult.confidence;
      }
      
      console.log(`🔮 GEO: ${method}, ${finalContour.length / 3} points`);
      
    } else if (predictionMode === 'nitro') {
      // NITRO mode: Smart prediction with trend analysis
      const smartResult = predictContourInterpolated(structure.contours, slicePosition, sliceSpacing);
      
      if (smartResult && smartResult.contour.length >= 9) {
        finalContour = smartResult.contour;
        method = smartResult.method;
        confidence = smartResult.confidence;
        referenceSlice = smartResult.referenceSlice;
        
        console.log(`🚀 NITRO: ${method}, ${finalContour.length / 3} points, confidence=${confidence.toFixed(2)}`);
      } else {
        // Fallback to simple copy if smart prediction failed
        const nearest = findNearestContour(structure.contours, slicePosition, sliceSpacing);
        if (!nearest) {
          updateActivePredictions(new Map());
          return;
        }
        
        referenceSlice = nearest.slicePosition;
        const simpleResult = predictContourSimple(nearest.points, nearest.slicePosition, slicePosition);
        finalContour = simpleResult.contour;
        method = 'nitro_fallback';
        confidence = simpleResult.confidence;
        
        console.log(`🚀 NITRO: fallback to simple copy, ${finalContour.length / 3} points`);
      }
      
    } else {
      // For other modes (SAM), use the nearest contour approach
      const nearest = findNearestContour(structure.contours, slicePosition, sliceSpacing);
      if (!nearest) {
        updateActivePredictions(new Map());
        return;
      }
      
      referenceSlice = nearest.slicePosition;
      const simpleResult = predictContourSimple(nearest.points, nearest.slicePosition, slicePosition);
      finalContour = simpleResult.contour;
      method = simpleResult.method;
      confidence = simpleResult.confidence;
    }
    
    // Store reference info for SAM path
    const simpleResult = {
      contour: finalContour,
      confidence,
      referenceSlice,
      targetSlice: slicePosition,
      method
    };
    
    if (predictionMode === 'sam') {
      // SAM mode - NO FALLBACK. If SAM fails, show nothing.
      try {
        console.log('🤖 Using SAM prediction mode - NO FALLBACK');
        
        // Find reference slice index (where the contour came from)
        const referenceSliceIdx = images?.findIndex((img: any) => {
          const imgZ = img.sliceZ ?? img.parsedSliceLocation ?? img.parsedZPosition;
          return imgZ != null && Math.abs(imgZ - simpleResult.referenceSlice) < 0.5;
        }) ?? -1;
        
        // Find target slice index
        const targetSliceIdx = currentIndex;
        
        // Extract pixel data for both slices
        const currentSliceData = referenceSliceIdx >= 0 ? extractImageDataForPrediction(referenceSliceIdx) : null;
        const targetSliceData = extractImageDataForPrediction(targetSliceIdx);
        
        console.log('🤖 SAM: Image data check:', {
          referenceSliceIdx,
          targetSliceIdx,
          hasCurrentSlice: !!currentSliceData,
          hasTargetSlice: !!targetSliceData,
          currentPixels: currentSliceData?.pixels?.length || 0,
          targetPixels: targetSliceData?.pixels?.length || 0,
        });
        
        if (!currentSliceData || !targetSliceData) {
          console.error('🤖 SAM FAILED - NO PIXEL DATA. Reference:', !!currentSliceData, 'Target:', !!targetSliceData);
          updateActivePredictions(new Map());
          return;
        }
        
        // Build coordinate transforms from image metadata
        const ps = imageMetadata?.pixelSpacing || [1, 1];
        const ipp = imageMetadata?.imagePosition || [0, 0, 0];
        const rowSpacing = ps[0] || 1;
        const colSpacing = ps[1] || 1;
        const imagePositionX = ipp[0] || 0;
        const imagePositionY = ipp[1] || 0;
        
        const coordinateTransforms = {
          worldToPixel: (x: number, y: number): [number, number] => {
            const px = (x - imagePositionX) / colSpacing;
            const py = (y - imagePositionY) / rowSpacing;
            return [px, py];
          },
          pixelToWorld: (px: number, py: number): [number, number] => {
            const x = px * colSpacing + imagePositionX;
            const y = py * rowSpacing + imagePositionY;
            return [x, y];
          },
        };
        
        const samResult = await predictNextSliceContour({
          currentContour: simpleResult.contour,
          currentSlicePosition: simpleResult.referenceSlice,
          targetSlicePosition: slicePosition,
          predictionMode: 'sam',
          confidenceThreshold: 0.2,
          imageData: {
            currentSlice: currentSliceData,
            targetSlice: targetSliceData,
          },
          coordinateTransforms,
        });
        
        if (requestId !== predictionRequestIdRef.current) return;
        
        if (samResult.predictedContour?.length >= 9 && !samResult.metadata?.method?.includes('failed')) {
          finalContour = samResult.predictedContour;
          method = samResult.metadata?.method || 'sam';
          confidence = samResult.confidence;
          console.log(`🤖 SAM succeeded: ${finalContour.length / 3} points`);
        } else {
          // SAM FAILED - NO FALLBACK - show nothing
          console.error('🤖 SAM FAILED - NO FALLBACK. Method:', samResult.metadata?.method, 'Notes:', samResult.metadata?.notes);
          updateActivePredictions(new Map());
          return;
        }
      } catch (err) {
        // SAM ERROR - NO FALLBACK - show nothing
        console.error('🤖 SAM ERROR - NO FALLBACK:', err);
        updateActivePredictions(new Map());
        return;
      }
    }
    
    // Check if still current request
    if (requestId !== predictionRequestIdRef.current) {
      return;
    }
    
    // Convert to PredictionResult format and store
    const normalizedSlice = normalizeSlicePosition(slicePosition);
    const predictions = new Map<number, PredictionResult>();
    predictions.set(normalizedSlice, {
      predictedContour: finalContour,
      confidence,
      adjustments: { scale: 1, centerShift: { x: 0, y: 0 }, deformation: 0 },
      metadata: {
        method,
        historySize: 1,
        notes: `From slice ${simpleResult.referenceSlice.toFixed(2)}`,
        distance_to_nearest: Math.abs(simpleResult.targetSlice - simpleResult.referenceSlice)
      }
    });
    
    updateActivePredictions(predictions);
    scheduleRender();
  }, [rtStructures?.structures, scheduleRender, updateActivePredictions, brushToolState?.predictionMode, images, currentIndex, extractImageDataForPrediction, imageMetadata]);

  // Auto-regenerate prediction when slice changes (if prediction enabled)
  useEffect(() => {
    // Debug helper
    const selectedStructure = rtStructures?.structures?.find((s: any) => s.roiNumber === selectedForEdit);
    
    // Get first prediction data for debug
    let firstPrediction = null;
    if (activePredictions.size > 0) {
      const [slicePos, pred] = activePredictions.entries().next().value;
      firstPrediction = {
        slicePosition: slicePos,
        contourLength: pred?.predictedContour?.length || 0,
        confidence: pred?.confidence,
        method: pred?.metadata?.method,
        samplePoints: pred?.predictedContour?.slice(0, 12) // First 4 XYZ points
      };
    }
    
    (window as any).predictionDebug = {
      enabled: brushToolState?.predictionEnabled,
      selectedForEdit,
      hasStructures: !!rtStructures?.structures,
      structureCount: rtStructures?.structures?.length || 0,
      hasImages: images?.length > 0,
      currentIndex,
      activePredictions: activePredictions.size,
      trigger: predictionTrigger,
      selectedStructureName: selectedStructure?.structureName,
      selectedStructureContours: selectedStructure?.contours?.length || 0,
      predictionMode: brushToolState?.predictionMode,
      firstPrediction
    };
    
    console.log(`🔮 useEffect: predictionEnabled=${brushToolState?.predictionEnabled}, selectedForEdit=${selectedForEdit}, hasStructures=${!!rtStructures?.structures}`);
    
    if (!brushToolState?.predictionEnabled || !selectedForEdit || !rtStructures?.structures) {
      // Don't clear predictions - let them persist even when prediction mode is toggled
      // This prevents flashing/disappearing predictions
      // updateActivePredictions(new Map());
      console.log('🔮 useEffect: Skipping - prediction not enabled or no structure selected');
      return;
    }
    if (!images || images.length === 0 || !images[currentIndex]) {
      // Only clear if we have no images at all
      console.log('🔮 useEffect: Skipping - no images');
      updateActivePredictions(new Map());
      return;
    }
    
    const rawSlicePos =
      images[currentIndex].sliceZ ??
      images[currentIndex].parsedSliceLocation ??
      images[currentIndex].parsedZPosition ??
      currentIndex;
    const parsedSlicePos =
      typeof rawSlicePos === "string" ? parseFloat(rawSlicePos) : rawSlicePos;
    const currentSlicePos = normalizeSlicePosition(
      Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
    );
    
    // Track last viewed contoured slice for prioritization
    if (rtStructures?.structures && selectedForEdit) {
      const structure = rtStructures.structures.find((s: any) => s.roiNumber === selectedForEdit);
      if (structure) {
        const hasRealContour = structure.contours?.some((c: any) => 
          !c.isPredicted && Math.abs(c.slicePosition - currentSlicePos) <= SLICE_TOL_MM
        );
        if (hasRealContour) {
          lastViewedContourSliceRef.current = currentSlicePos;
        }
      }
    }
    
    // Generate prediction for THIS slice only
    generatePredictionForCurrentSlice(selectedForEdit, currentSlicePos);
  }, [
    currentIndex, 
    selectedForEdit, 
    brushToolState?.predictionEnabled, 
    rtStructures?.structures, // Changed from rtStructures to trigger on structure updates
    images, 
    generatePredictionForCurrentSlice,
    predictionTrigger // Manual trigger for forcing updates
  ]);

  // Handle prediction trigger from brush tool
  const handlePredictionTrigger = async (payload: {
    structureId: number;
    slicePosition: number;
  }) => {
    // After drawing, update prediction for next slice
    if (images && images.length > 0) {
      const rawSlicePos =
        images[currentIndex]?.sliceZ ??
        images[currentIndex]?.parsedSliceLocation ??
        images[currentIndex]?.parsedZPosition ??
        currentIndex;
      const parsedSlicePos =
        typeof rawSlicePos === "string" ? parseFloat(rawSlicePos) : rawSlicePos;
      const currentSlicePos = normalizeSlicePosition(
        Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
      );
      generatePredictionForCurrentSlice(payload.structureId, currentSlicePos);
    }
  };
  
  // Handle rejecting predictions
  const handleRejectPredictions = async (payload: { structureId?: number }) => {
    // Simply clear predictions
    updateActivePredictions(new Map());
    scheduleRender();
    log.debug('Rejected predictions', 'viewer');
  };
  
  // Handle accepting prediction(s)
  const handleAcceptPredictions = async (payload: { structureId?: number; slicePosition?: number }) => {
    if (!rtStructures || !rtStructures.structures || activePredictions.size === 0) return;
    
    const structureId = payload.structureId || selectedForEdit;
    if (!structureId) return;
    
    const structure = rtStructures.structures.find((s: any) => s.roiNumber === structureId);
    if (!structure) return;
    
    const targetSlice = payload.slicePosition != null && Number.isFinite(payload.slicePosition)
      ? normalizeSlicePosition(payload.slicePosition)
      : null;
    
    // Create updated structures with prediction applied
    const updatedStructures = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
    const updatedStructure = updatedStructures.structures.find((s: any) => s.roiNumber === structureId);
    
    if (!updatedStructure) return;
    
    let acceptedCount = 0;
    
    // Accept all predictions if no specific slice provided
    for (const [slicePosition, prediction] of activePredictions.entries()) {
      if (targetSlice != null && Math.abs(slicePosition - targetSlice) > SLICE_TOL_MM) {
        continue;
      }
      if (prediction.predictedContour && prediction.predictedContour.length >= 9) {
        // Remove any existing predicted contours on this slice
        updatedStructure.contours = updatedStructure.contours.filter(
          (c: any) =>
            !c.isPredicted || Math.abs(c.slicePosition - slicePosition) > SLICE_TOL_MM
        );
        
        // Add the prediction as a new contour
        updatedStructure.contours.push({
          slicePosition,
          points: prediction.predictedContour,
          numberOfPoints: prediction.predictedContour.length / 3
        });
        lastViewedContourSliceRef.current = slicePosition;
        
        acceptedCount++;
      }
    }
    
    // Clear predictions
    updateActivePredictions(new Map());
    
    // Update structures
    setLocalRTStructures(updatedStructures);
    saveContourUpdates(updatedStructures, 'accept_prediction');
    
    if (onContourUpdate) {
      onContourUpdate(updatedStructures);
    }
    
    // Force immediate render
    setForceRenderTrigger(prev => prev + 1);
    scheduleRender();
    
    // Force prediction regeneration so next scroll uses the new contour
    setPredictionTrigger(prev => prev + 1);
    
    toast({
      title: `Accepted ${acceptedCount} prediction${acceptedCount > 1 ? 's' : ''}`,
      description: `Added ${acceptedCount} contour${acceptedCount > 1 ? 's' : ''}`
    });
  };

  // Handle 3D mask application from AI tumor tool
  const handleApply3DMask = async (payload: {
    structureId: number;
    mask: number[][][];
    confidence: number;
    startSlice?: number;
    downsampleFactor?: number;
    sourceImages?: any[]; // Images the mask was created from
    isFusionMode?: boolean;
    smoothOutput?: boolean; // Whether to apply double smoothing
  }) => {
    if (!rtStructures || !rtStructures.structures) return;

    const { structureId, mask, confidence, startSlice = 0, downsampleFactor = 1, sourceImages, isFusionMode, smoothOutput = false } = payload;
    const structure = rtStructures.structures.find((s: any) => s.roiNumber === structureId);
    if (!structure) return;

    // Use sourceImages if provided (from AI tumor tool), otherwise use global images with startSlice
    const imagesToUse = sourceImages || images;
    const maskStartIndex = sourceImages ? 0 : startSlice; // If using sourceImages, mask index 0 = sourceImages[0]

    log.debug(`Converting 3D mask to contours for structure ${structureId} (downsample: ${downsampleFactor}x)`, 'viewer');
    log.debug(`Mask shape: [${mask.length}, ${mask[0]?.length || 0}, ${mask[0]?.[0]?.length || 0}], using ${sourceImages ? 'sourceImages' : 'global images'}, startIndex: ${maskStartIndex}`, 'viewer');

    // Create updated structures
    const updatedStructures = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
    const updatedStructure = updatedStructures.structures.find((s: any) => s.roiNumber === structureId);
    if (!updatedStructure) {
      log.error(`Structure ${structureId} not found in updated structures`, 'viewer');
      return;
    }

    // Get image metadata for coordinate conversion
    const pixelSpacing = imageMetadata?.pixelSpacing?.split('\\').map(Number) || [1, 1];
    const [imagePositionX, imagePositionY] = imageMetadata?.imagePosition?.split('\\').map(Number) || [0, 0];

    let contoursAdded = 0;
    let slicesProcessed = 0;
    let slicesWithMask = 0;

    // Process each slice in the mask
    for (let z = 0; z < mask.length; z++) {
      slicesProcessed++;
      const sliceMask = mask[z];
      if (!sliceMask || sliceMask.length === 0) {
        log.debug(`Slice ${z}: Empty mask`, 'viewer');
        continue;
      }

      const height = sliceMask.length;
      const width = sliceMask[0]?.length || 0;
      if (width === 0) {
        log.debug(`Slice ${z}: Zero width`, 'viewer');
        continue;
      }

      // Convert 2D array to Uint8Array for marching squares
      const maskData = new Uint8Array(width * height);
      let nonZeroPixels = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value = sliceMask[y][x] > 0 ? 1 : 0;
          maskData[x + y * width] = value;
          if (value > 0) nonZeroPixels++;
        }
      }

      if (nonZeroPixels === 0) {
        log.debug(`Slice ${z}: No positive mask pixels`, 'viewer');
        continue;
      }

      slicesWithMask++;
      log.debug(`Slice ${z}: ${width}x${height}, ${nonZeroPixels} positive pixels`, 'viewer');

      // Find contours using marching squares algorithm
      const pixelContours = marchingSquares(maskData, width, height);

      if (pixelContours.length < 6) {
        log.debug(`Slice ${z}: Contour too small (${pixelContours.length / 2} points)`, 'viewer');
        continue;
      }

      log.debug(`Slice ${z}: Found contour with ${pixelContours.length / 2} points`, 'viewer');

      // Get the actual image for this slice to get correct Z position AND coordinate metadata
      const imageIndex = maskStartIndex + z;
      if (!imagesToUse || imageIndex >= imagesToUse.length) {
        log.error(`Image index ${imageIndex} out of bounds (total: ${imagesToUse?.length})`, 'viewer');
        continue;
      }

      const sliceImage = imagesToUse[imageIndex];

      // Log image properties for first slice to debug what we're getting
      if (contoursAdded === 0) {
        console.log(`🧠 First slice image properties:`, Object.keys(sliceImage).join(', '));
      }

      const slicePosition = sliceImage.sliceZ ?? sliceImage.parsedSliceLocation ?? sliceImage.parsedZPosition ?? 0;

      // Use the same metadata extraction helper that works in ai-tumor-tool
      const parseDICOMVector = (val: any, expectedLength: number): number[] | null => {
        if (Array.isArray(val) && val.length >= expectedLength) return val;
        if (typeof val === 'string') {
          const parsed = val.split('\\').map((s: string) => parseFloat(s)).filter((n: number) => Number.isFinite(n));
          if (parsed.length >= expectedLength) return parsed;
        }
        return null;
      };

      const sliceImagePosition = parseDICOMVector(sliceImage.imagePosition, 3)
        || parseDICOMVector(sliceImage.imagePositionPatient, 3)
        || parseDICOMVector(sliceImage.metadata?.imagePositionPatient, 3)
        || parseDICOMVector(sliceImage.metadata?.imagePosition, 3)
        || [0, 0, slicePosition];

      const slicePixelSpacing = parseDICOMVector(sliceImage.pixelSpacing, 2)
        || parseDICOMVector(sliceImage.metadata?.pixelSpacing, 2)
        || [1, 1];

      const sliceOrientation = parseDICOMVector(sliceImage.imageOrientationPatient, 6)
        || parseDICOMVector(sliceImage.imageOrientation, 6)
        || parseDICOMVector(sliceImage.metadata?.imageOrientationPatient, 6)
        || parseDICOMVector(sliceImage.metadata?.imageOrientation, 6)
        || [1, 0, 0, 0, 1, 0];

      // DICOM ImageOrientationPatient: first 3 = row direction (X axis), last 3 = column direction (Y axis)
      // "row direction" = direction along which columns increase (horizontal for standard axial)
      // "column direction" = direction along which rows increase (vertical for standard axial)
      const rowDir = [sliceOrientation[0], sliceOrientation[1], sliceOrientation[2]];
      const colDir = [sliceOrientation[3], sliceOrientation[4], sliceOrientation[5]];
      // DICOM PixelSpacing: [0] = row spacing (vertical), [1] = column spacing (horizontal)
      const rowSpacing = slicePixelSpacing[0];
      const colSpacing = slicePixelSpacing[1];

      if (contoursAdded === 0 && slicesWithMask === 1) {
        // Log metadata for first slice with tumor
        console.log(`🧠 First tumor slice (${z}) metadata:`, {
          imageIndex,
          slicePosition,
          pixelSpacing: slicePixelSpacing,
          imagePosition: sliceImagePosition,
          orientation: sliceOrientation,
          rowDir,
          colDir,
          maskDimensions: {width, height},
          imageDimensions: {
            columns: sliceImage.columns,
            rows: sliceImage.rows
          },
          downsampleFactor,
          startSlice,
          firstPixelCoord: [pixelContours[0], pixelContours[1]]
        });
      }

      log.debug(`Slice ${z}: Image index ${imageIndex}, slicePosition: ${slicePosition}`, 'viewer');

      // Convert pixel coordinates to world coordinates
      // Need to account for downsampling - mask is at lower resolution
      const worldContour: number[] = [];
      for (let i = 0; i < pixelContours.length; i += 2) {
        // Marching squares returns (x, y) where x=column, y=row
        const downsampledColumn = pixelContours[i];
        const downsampledRow = pixelContours[i + 1];

        // Upsample back to original resolution
        const column = downsampledColumn * downsampleFactor;
        const row = downsampledRow * downsampleFactor;

        // DICOM pixel-to-world transform using orientation vectors:
        // world = imagePosition + rowDir * colSpacing * column + colDir * rowSpacing * row
        // (rowDir goes with column because it's the direction along which columns increase)
        // (colDir goes with row because it's the direction along which rows increase)
        const worldX = sliceImagePosition[0] + (rowDir[0] * colSpacing * column) + (colDir[0] * rowSpacing * row);
        const worldY = sliceImagePosition[1] + (rowDir[1] * colSpacing * column) + (colDir[1] * rowSpacing * row);
        const worldZ = sliceImagePosition[2] + (rowDir[2] * colSpacing * column) + (colDir[2] * rowSpacing * row);

        worldContour.push(worldX, worldY, worldZ);
      }
      
      // Apply smoothing if requested (2x smoothing as specified)
      let finalContour = worldContour;
      if (smoothOutput) {
        // Apply smoothing twice for smoother output
        const contourObj = { points: worldContour, slicePosition };
        const smoothed1 = smoothContour(contourObj, 0.25);
        const smoothed2 = smoothContour(smoothed1, 0.25);
        finalContour = smoothed2.points;
        log.debug(`Slice ${z}: Applied 2x smoothing (${worldContour.length / 3} → ${finalContour.length / 3} points)`, 'viewer');
      }

      // Add contour to structure
      updatedStructure.contours.push({
        slicePosition,
        points: finalContour,
        numberOfPoints: finalContour.length / 3
      });

      contoursAdded++;
    }

    log.debug(`Processed ${slicesProcessed} slices, ${slicesWithMask} had masks, added ${contoursAdded} contours`, 'viewer');

    if (contoursAdded === 0) {
      log.error('No contours were created from the mask!', 'viewer');
      toast({
        title: `Segmentation failed`,
        description: `No contours created from mask. Check console for details.`,
        variant: 'destructive'
      });
      return;
    }

    // Update structures
    setLocalRTStructures(updatedStructures);
    saveContourUpdates(updatedStructures, 'apply_3d_mask');

    if (onContourUpdate) {
      onContourUpdate(updatedStructures);
    }

    // Force immediate render
    setForceRenderTrigger(prev => prev + 1);
    scheduleRender();

    toast({
      title: `Segmentation applied`,
      description: `Added ${contoursAdded} contours (confidence: ${(confidence * 100).toFixed(1)}%)`
    });
  };

  // Marching squares algorithm for contour tracing
  function marchingSquares(data: Uint8Array, width: number, height: number): number[] {
    const contours: number[] = [];
    const visited = new Uint8Array(width * height);

    // Find first boundary pixel
    let startX = -1, startY = -1;
    for (let y = 0; y < height && startX === -1; y++) {
      for (let x = 0; x < width && startX === -1; x++) {
        const index = x + y * width;
        if (data[index] === 1 && !visited[index]) {
          // Check if it's a boundary pixel
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
              data[index - 1] === 0 || data[index + 1] === 0 ||
              data[index - width] === 0 || data[index + width] === 0) {
            startX = x;
            startY = y;
          }
        }
      }
    }

    if (startX === -1) return contours;

    // Trace boundary using Moore neighborhood
    let x = startX, y = startY;
    let dir = 0;
    const maxSteps = width * height;
    let steps = 0;

    do {
      contours.push(x, y);
      visited[x + y * width] = 1;

      // Find next boundary pixel
      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (dir + 6 + i) % 8;
        let nx = x, ny = y;

        switch (newDir) {
          case 0: nx++; break;
          case 1: nx++; ny++; break;
          case 2: ny++; break;
          case 3: nx--; ny++; break;
          case 4: nx--; break;
          case 5: nx--; ny--; break;
          case 6: ny--; break;
          case 7: nx++; ny--; break;
        }

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = nx + ny * width;
          if (data[nIndex] === 1) {
            x = nx;
            y = ny;
            dir = newDir;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
      steps++;
    } while ((x !== startX || y !== startY) && steps < maxSteps);

    return contours;
  }

  // Handle contour updates from brush tool and other contour editing operations
  const handleContourUpdate = async (payload: any) => {
    // Handle margin toolbar operations
    if (payload && payload.type && payload.type.includes('margin')) {
      console.log("🔹 Margin execution request from toolbar:", payload);
      await handleAdvancedMarginExecution({
        action: 'execute_margin',
        structureId: payload.structureId,
        targetStructureId: payload.targetStructureId,
        parameters: payload.parameters
      });
      return;
    }

    // Handle refresh action from undo/redo
    if (payload && payload.action === 'refresh' && payload.rtStructures) {
      console.log('Refreshing RT structures from undo/redo');
      setLocalRTStructures(payload.rtStructures);
      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(payload.rtStructures);
      }
      return;
    }

    // Handle advanced margin execution operations
    if (payload && payload.action === "execute_margin") {
      console.log("🔹 Advanced margin execution request:", payload);
      await handleAdvancedMarginExecution(payload);
      return;
    }
    
    // Handle prediction trigger from brush tool
    if (payload && payload.action === "trigger_prediction") {
      log.debug('Prediction trigger received', 'viewer');
      await handlePredictionTrigger(payload);
      return;
    }
    
    // Handle accept/reject prediction actions
    if (payload && payload.action === "accept_predictions") {
      log.debug('Accepting predictions', 'viewer');
      await handleAcceptPredictions(payload);
      return;
    }
    
    if (payload && payload.action === "reject_predictions") {
      log.debug('Rejecting predictions', 'viewer');
      await handleRejectPredictions(payload);
      return;
    }

    // Handle 3D mask application from AI tumor tool
    if (payload && payload.action === "apply_3d_mask") {
      log.debug('Applying 3D segmentation mask', 'viewer');
      await handleApply3DMask(payload);
      return;
    }

    // Special handling for undo/redo results which return full RT structures
    if (payload && payload.structures && !payload.action) {
      console.log('Applying undo/redo result with', payload.structures.length, 'structures');
      
      // Optimize update to only change modified structures
      setLocalRTStructures((prevStructures: any) => {
        if (!prevStructures) return payload;
        
        // Create a new object with the same reference for unchanged properties
        const updatedStructures = {
          ...prevStructures,
          structures: prevStructures.structures.map((oldStruct: any) => {
            // Find the corresponding structure in the new data
            const newStruct = payload.structures.find((s: any) => s.roiNumber === oldStruct.roiNumber);
            
            // If structure wasn't changed, keep the same reference
            if (newStruct && JSON.stringify(oldStruct) === JSON.stringify(newStruct)) {
              return oldStruct;
            }
            
            // If structure was changed or removed, use the new one
            return newStruct || oldStruct;
          })
        };
        
        // Add any new structures that weren't in the old data
        payload.structures.forEach((newStruct: any) => {
          if (!updatedStructures.structures.find((s: any) => s.roiNumber === newStruct.roiNumber)) {
            updatedStructures.structures.push(newStruct);
          }
        });
        
        return updatedStructures;
      });
      
      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(payload);
      }
      return;
    }
    
    // Check if two polygons intersect by checking if any points are close
    const checkPolygonIntersection = (polygon1: number[], polygon2: number[]) => {
      const threshold = 2.0; // Distance threshold in world coordinates (mm) - reduced for more accurate contours
      
      // Check each point in polygon1 against polygon2
      for (let i = 0; i < polygon1.length; i += 3) {
        const p1x = polygon1[i];
        const p1y = polygon1[i + 1];
        
        for (let j = 0; j < polygon2.length; j += 3) {
          const p2x = polygon2[j];
          const p2y = polygon2[j + 1];
          
          const distance = Math.sqrt(
            Math.pow(p1x - p2x, 2) + Math.pow(p1y - p2y, 2)
          );
          
          if (distance < threshold) {
            return true; // Found intersection
          }
        }
      }
      
      return false; // No intersection found
    };
    log.debug('Handling contour update', 'viewer');

    if (!rtStructures || !rtStructures.structures) {
      log.error('No RT structures available', 'viewer');
      return;
    }

    // Handle refresh action for undo/redo
    if (payload.action === "refresh") {
      log.debug('Refreshing RT structures after undo/redo', 'viewer');
      // Update with the RT structures from the payload
      if (payload.rtStructures) {
        setLocalRTStructures(payload.rtStructures);
        // Force re-render of the canvas
        if (images.length > 0) {
          // Immediate render after polygon union
          scheduleRender(true); // immediate=true
        }
      }
      return;
    }

    // Create a deep copy to avoid mutations - OPTIMIZED for performance
    let updatedStructures: any;
    
    // OPTIMIZATION: For high-frequency brush operations, avoid deep cloning the entire RT structure set
    // This eliminates the lag when "letting off" the mouse button
    if (payload.action === "brush_stroke" || payload.action === "erase_stroke" || payload.action === "smart_brush_stroke") {
      // Shallow copy the root object and structures array
      updatedStructures = { ...rtStructures, structures: [...rtStructures.structures] };
      
      // Find the specific structure index
      const structIndex = updatedStructures.structures.findIndex((s: any) => s.roiNumber === payload.structureId);
      
      if (structIndex !== -1) {
        // Deep clone ONLY the modified structure
        updatedStructures.structures[structIndex] = structuredClone 
          ? structuredClone(updatedStructures.structures[structIndex]) 
          : JSON.parse(JSON.stringify(updatedStructures.structures[structIndex]));
      }
    } else {
      // Fallback to full deep clone for other operations to ensure safety
      updatedStructures = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
    }

    if (payload.action === "brush_stroke") {
      // Handle brush stroke - add points to contour
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) {
        log.error(`Structure ${payload.structureId} not found`, 'viewer');
        return;
      }

      // Convert brush stroke to polished polygon for smooth edges
      let brushPolygon: number[];
      
      // CRITICAL FIX: The brush size should NOT be converted to world coordinates here
      // The brush size is already in screen pixels and should remain that way
      // The polygon creation function will handle coordinate transformation internally
      
      log.debug(`Brush size: ${payload.brushSize}px (pixel units)`, 'viewer');
      log.debug('Sample brush point coordinates present', 'viewer');
      
      // TEMPORARILY DISABLED: Polishing causing structure morphing/shrinking
      // Use unpolished brush stroke until polishing is fixed
      brushPolygon = addBrushToContour(
        [], // Empty array to get just the brush polygon
        payload.points,
        payload.brushSize, // Use pixel size directly - let polygon function handle conversion
      );
      log.debug('Using unpolished brush stroke (polishing temporarily disabled)', 'viewer');
      
      // TODO: Fix polishing ClipperLib compatibility issue
      // The polishing function is failing with "Error polishing contour" 
      // and causing structures to morph/shrink when multiple strokes are added

      // Collect all contours on this slice
      const existingOnSlice = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - payload.slicePosition) <= SLICE_TOL_MM
      );

      // Check if brush stroke intersects with any existing contour
      let intersectsWithExisting = false;
      const intersectingContours: any[] = [];
      const nonIntersectingContours: any[] = [];
      
      for (const contour of existingOnSlice) {
        if (contour.points && contour.points.length >= 9) {
          // Check if brush polygon intersects with this contour
          const intersects = doPolygonsIntersectSimple(brushPolygon, contour.points);
          if (intersects) {
            intersectsWithExisting = true;
            intersectingContours.push(contour);
          } else {
            nonIntersectingContours.push(contour);
          }
        }
      }

      if (intersectsWithExisting) {
        // Union brush with intersecting contours only
        const polygonsToUnion: number[][] = [];
        
        // Add intersecting contours
        for (const contour of intersectingContours) {
          polygonsToUnion.push(contour.points);
        }
        
        // Add the new brush polygon
        polygonsToUnion.push(brushPolygon);

        // Perform union of intersecting polygons using simple operations
        const unionResults = unionMultipleContoursSimple(polygonsToUnion);
        
        // FIX #1: Only modify structure if union succeeded
        if (unionResults && unionResults.length > 0) {
          // Union succeeded - remove ALL existing contours at this slice and replace with union result
          structure.contours = structure.contours.filter(
            (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
          );
          
          // Add all unified contours (there can be multiple disjoint polygons)
          for (const polygon of unionResults) {
            if (polygon && polygon.length >= 9) {
              structure.contours.push({
                slicePosition: payload.slicePosition,
                points: polygon,
                numberOfPoints: polygon.length / 3,
              });
            }
          }
          
          // Re-add non-intersecting contours as separate blobs
          for (const contour of nonIntersectingContours) {
            structure.contours.push({
              slicePosition: payload.slicePosition,
              points: contour.points,
              numberOfPoints: contour.numberOfPoints,
            });
          }
        } else {
          // FIX #1: DEFENSIVE FALLBACK - union failed, don't remove anything
          // Just add the brush polygon as a separate blob, all existing contours remain untouched
          console.warn('🔸 BRUSH FIX: Union failed - adding brush as separate blob, preserving all existing contours');
          structure.contours.push({
            slicePosition: payload.slicePosition,
            points: brushPolygon,
            numberOfPoints: brushPolygon.length / 3,
          });
          // Note: existingOnSlice contours remain in structure.contours, no removal happened
        }
      } else {
        // FIX #2: No intersection - remove old contours from slice first, then add new + existing
        // This prevents duplicates that were created by the old logic
        structure.contours = structure.contours.filter(
          (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
        );
        
        // Add brush as new separate contour
        structure.contours.push({
          slicePosition: payload.slicePosition,
          points: brushPolygon,
          numberOfPoints: brushPolygon.length / 3,
        });
        
        // Re-add all existing contours unchanged
        for (const contour of existingOnSlice) {
          structure.contours.push({
            slicePosition: payload.slicePosition,
            points: contour.points,
            numberOfPoints: contour.numberOfPoints,
          });
        }
      }

      console.log(`Structure now has ${structure.contours.length} contours`);
      lastViewedContourSliceRef.current = payload.slicePosition;
      
      // Single state update with new object reference for immediate React detection
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      setLocalRTStructures(newStructures);
      
      // Pass updated structures to parent (for sidebar updates)
      if (onContourUpdate) {
        onContourUpdate(newStructures);
      }
      
      // Save state to undo system
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          'add_brush_stroke', 
          payload.structureId, 
          newStructures,
          payload.slicePosition,
          structure.structureName
        );
      }
      saveContourUpdates(newStructures, 'add_brush_stroke', [payload.structureId]);
      
      // Force immediate render - bypass throttling for editing operations
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      
      // Force prediction regeneration to use the new contour
      setPredictionTrigger(prev => prev + 1);
      console.log('🎯 BRUSH: Immediate render + prediction trigger');
      
    } else if (payload.action === "smart_brush_stroke") {
      // Handle smart brush stroke - add already processed contour points
      if (false) console.log("🎯 Processing smart brush stroke:", payload);
      
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) {
        console.error(`Structure ${payload.structureId} not found`);
        return;
      }

      // The smart brush now provides a pre-unified polygon. We will process it
      // with the same robust logic as a regular brush stroke to correctly handle
      // intersections and the creation of multiple blobs.
      const brushPolygon: number[] = payload.points;

      // Collect all contours on this slice
      const existingOnSlice = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - payload.slicePosition) <= SLICE_TOL_MM
      );

      // Check if brush stroke intersects with any existing contour
      let intersectsWithExisting = false;
      const intersectingContours: any[] = [];
      const nonIntersectingContours: any[] = [];

      for (const contour of existingOnSlice) {
        if (contour.points && contour.points.length >= 9) {
          const intersects = doPolygonsIntersectSimple(brushPolygon, contour.points);
          if (intersects) {
            intersectsWithExisting = true;
            intersectingContours.push(contour);
          } else {
            nonIntersectingContours.push(contour);
          }
        }
      }

      // FIX #3: Apply defensive pattern - don't remove contours until operation succeeds
      if (intersectsWithExisting) {
        // If the new stroke intersects, union it with all intersecting contours
        const polygonsToUnion = [brushPolygon, ...intersectingContours.map(c => c.points)];
        const unionResults = unionMultipleContoursSimple(polygonsToUnion);
        
        // FIX #3: Only modify structure if union succeeded
        if (unionResults && unionResults.length > 0) {
          // Union succeeded - remove existing contours and add union results
          structure.contours = structure.contours.filter(
            (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
          );
          
          // Add the new unified contour(s)
          unionResults.forEach((polygonPoints: number[]) => {
            if (polygonPoints.length >= 9) {
              structure.contours.push({
                slicePosition: payload.slicePosition,
                points: polygonPoints,
                numberOfPoints: polygonPoints.length / 3,
              });
            }
          });
          
          // Re-add the contours that did not intersect
          for (const contour of nonIntersectingContours) {
            structure.contours.push(contour);
          }
        } else {
          // FIX #3: DEFENSIVE FALLBACK - union failed, don't remove anything
          // Just add the brush polygon as a separate blob
          console.warn('🔸 SMART BRUSH FIX: Union failed - adding as separate blob, preserving all existing contours');
          structure.contours.push({
            slicePosition: payload.slicePosition,
            points: brushPolygon,
            numberOfPoints: brushPolygon.length / 3,
          });
          // Note: existingOnSlice contours remain in structure.contours, no removal happened
        }
      } else {
        // No intersection - remove old contours from slice first, then add new + existing
        structure.contours = structure.contours.filter(
          (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
        );
        
        // Add the new brush stroke as a new contour
        structure.contours.push({
          slicePosition: payload.slicePosition,
          points: brushPolygon,
          numberOfPoints: brushPolygon.length / 3,
        });
        
        // Re-add all the other existing contours as they were
        for (const contour of existingOnSlice) {
          structure.contours.push(contour);
        }
      }

      if (false) console.log(`Structure now has ${structure.contours.length} contours after smart brush`);
      lastViewedContourSliceRef.current = payload.slicePosition;
      
      // Single state update with new object reference for immediate React detection
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      setLocalRTStructures(newStructures);
      
      // Pass updated structures to parent (for sidebar updates)
      if (onContourUpdate) {
        onContourUpdate(newStructures);
      }
      
      // Save state to undo system
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          'smart_brush_stroke', 
          payload.structureId, 
          newStructures,
          payload.slicePosition,
          structure.structureName
        );
      }
      saveContourUpdates(newStructures, 'smart_brush_stroke', [payload.structureId]);
      
      // Force immediate render - bypass throttling for editing operations
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      
      // Force prediction regeneration to use the new contour
      setPredictionTrigger(prev => prev + 1);
      console.log('🎯 SMART BRUSH: Immediate render + prediction trigger');
    } else if (payload.action === "erase_stroke") {
      // Handle erase stroke - subtract points from contour
      console.log("🔹 Processing erase stroke:", payload);
      
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) {
        console.error(`Structure ${payload.structureId} not found`);
        return;
      }

      // Convert erase stroke to polygon for subtraction
      const erasePolygon = addBrushToContour(
        [], // Empty array to get just the erase polygon
        payload.points,
        payload.brushSize,
      );
      
      console.log(`Erase polygon created with ${erasePolygon.length / 3} points`);

      // FIX #4: Use consistent tolerance constant
      const existingOnSlice = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - payload.slicePosition) <= SLICE_TOL_MM
      );

      // FIX #4: DEFENSIVE - Don't remove contours until we process them all
      const newContours: any[] = [];

      // Process each existing contour - subtract the erase area
      for (const contour of existingOnSlice) {
        if (contour.points && contour.points.length >= 9) {
          // Check if erase polygon intersects with this contour
          // For erase operations, we want to be more aggressive in detecting intersections
          // to ensure quick delete strokes work properly
          let intersects = doPolygonsIntersectSimple(erasePolygon, contour.points);
          
          // IMPROVED: If polygon intersection fails, fall back to point-in-polygon check
          // This catches cases where quick strokes are inside the contour but bbox check fails
          if (!intersects && erasePolygon.length >= 3) {
            // Check if any erase polygon point is inside the contour
            for (let i = 0; i < erasePolygon.length; i += 3) {
              const testPoint = [erasePolygon[i], erasePolygon[i + 1]];
              // Simple point-in-polygon test
              let inside = false;
              for (let j = 0, k = contour.points.length - 3; j < contour.points.length; k = j, j += 3) {
                const xi = contour.points[j], yi = contour.points[j + 1];
                const xj = contour.points[k], yj = contour.points[k + 1];
                const intersectTest = ((yi > testPoint[1]) !== (yj > testPoint[1])) &&
                  (testPoint[0] < (xj - xi) * (testPoint[1] - yi) / (yj - yi) + xi);
                if (intersectTest) inside = !inside;
              }
              if (inside) {
                intersects = true;
                console.log(`🔹 ERASE: Point-in-polygon test found intersection (fallback)`);
                break;
              }
            }
          }
          
          console.log(`🔹 ERASE: Contour with ${contour.points.length / 3} points, intersects: ${intersects}`);
          
          if (intersects) {
            // Subtract erase area from this contour
            const { subtractContourSimple } = await import('@/lib/simple-polygon-operations');
            const subtractResults = subtractContourSimple(contour.points, erasePolygon);
            
            console.log(`🔹 ERASE: Subtraction returned ${subtractResults.length} result contours`);
            
            // IMPROVED FIX: Empty result means contour was completely erased - that's SUCCESS!
            if (subtractResults && subtractResults.length > 0) {
              // Add resulting contours (there may be multiple after subtraction)
              let validResultsAdded = 0;
              for (const resultContour of subtractResults) {
                if (resultContour.length >= 9) {
                  newContours.push({
                    slicePosition: payload.slicePosition,
                    points: resultContour,
                    numberOfPoints: resultContour.length / 3,
                  });
                  validResultsAdded++;
                  console.log(`🔹 ERASE: Added result contour with ${resultContour.length / 3} points`);
                } else {
                  console.log(`🔹 ERASE: Skipped tiny result contour with ${resultContour.length / 3} points`);
                }
              }
              if (validResultsAdded === 0) {
                console.log(`✅ ERASE: All result contours too small - contour completely erased`);
              }
            } else if (subtractResults && subtractResults.length === 0) {
              // Empty result = contour was completely erased, don't add it back
              console.log(`✅ ERASE: Subtraction returned empty - contour completely erased`);
            } else {
              // Only preserve if subtraction actually failed (returned null/undefined)
              console.warn('🔸 ERASE: Subtraction operation failed - preserving original contour');
              newContours.push(contour);
            }
          } else {
            // No intersection - keep original contour
            console.log(`🔹 ERASE: No intersection, keeping original contour`);
            newContours.push(contour);
          }
        }
      }

      // Only now update the structure with processed contours
      structure.contours = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
      );
      structure.contours.push(...newContours);

      console.log(`Erase completed - structure now has ${structure.contours.length} contours`);

      // Single state update with new object reference for immediate React detection
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      setLocalRTStructures(newStructures);

      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(newStructures);
      }

      // Save state to undo system
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          'erase_brush_stroke', 
          payload.structureId, 
          newStructures,
          payload.slicePosition,
          structure.structureName
        );
      }
      saveContourUpdates(newStructures, 'erase_brush_stroke', [payload.structureId]);
      
      // Force immediate render - bypass throttling for editing operations
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      
      // Force prediction regeneration after erase
      setPredictionTrigger(prev => prev + 1);
      console.log('🎯 ERASE: Immediate render + prediction trigger');
    } else if (
      payload.action === "add_pen_stroke" ||
      payload.action === "cut_pen_stroke"
    ) {
      // Handle pen tool operations
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // FIX #6: Use consistent tolerance across all tools
      const tolerance = SLICE_TOL_MM; // Use same 0.5mm tolerance as brush tools
      
      if (payload.action === "add_pen_stroke") {
        // FIX #5: Use proper union instead of concatenation to avoid invalid multi-loop contours
        const existingOnSlice = structure.contours.filter(
          (c: any) => Math.abs(c.slicePosition - payload.slicePosition) <= tolerance
        );
        
        if (existingOnSlice.length > 0) {
          // PROPER UNION: Use polygon operations instead of concatenation
          const polygonsToUnion = [payload.points, ...existingOnSlice.map(c => c.points)];
          const unionResults = unionMultipleContoursSimple(polygonsToUnion);
          
          if (unionResults && unionResults.length > 0) {
            // Remove old contours from this slice
            structure.contours = structure.contours.filter(
              (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > tolerance
            );
            
            // Add union results
            for (const polygon of unionResults) {
              if (polygon && polygon.length >= 9) {
                structure.contours.push({
                  slicePosition: payload.slicePosition,
                  points: polygon,
                  numberOfPoints: polygon.length / 3,
                });
              }
            }
            console.log('🎯 PEN FIX: Union succeeded, merged pen stroke with existing contours');
          } else {
            // FIX #5: DEFENSIVE FALLBACK - union failed, add as separate blob
            console.warn('🔸 PEN FIX: Union failed - adding pen stroke as separate blob');
            structure.contours.push({
              slicePosition: payload.slicePosition,
              points: payload.points,
              numberOfPoints: payload.points.length / 3,
            });
          }
        } else {
          // No existing contour - just add new one
          structure.contours.push({
            slicePosition: payload.slicePosition,
            points: payload.points,
            numberOfPoints: payload.points.length / 3,
          });
        }
      } else if (payload.action === "cut_pen_stroke") {
        // TODO: Implement contour cutting logic
        console.log("Cut pen stroke not yet implemented");
      }

      setLocalRTStructures(updatedStructures);
      // Save state to new undo system
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          payload.action, 
          payload.structureId, 
          updatedStructures,
          payload.slicePosition,
          structure.structureName
        );
      }
      // Save contour updates to server
      saveContourUpdates(updatedStructures, payload.action, [payload.structureId]);
      
      // Immediate render for pen tool operations
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      console.log('🎯 PEN: Immediate render triggered');
    } else if (payload.action === "pen_boolean_operation") {
      // Handle pen tool boolean operations (union/subtract)
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // Find contour on current slice - use tight tolerance to prevent multi-slice operations
      const tolerance = 0.1;
      const contourIndex = structure.contours.findIndex(
        (c: any) =>
          Math.abs(c.slicePosition - payload.slicePosition) <= tolerance,
      );

      if (payload.operation === 'union' && contourIndex >= 0) {
        // For union, use polygon union to merge overlapping areas properly
        const existingContour = structure.contours[contourIndex];
        const existingPolygons: number[][][] = [];
        
        // Convert existing contour points to polygons
        for (let i = 0; i < existingContour.points.length; i += 3) {
          if (i === 0 || (i > 0 && existingContour.points[i-3] === undefined)) {
            // Start of a new polygon
            existingPolygons.push([]);
          }
          existingPolygons[existingPolygons.length - 1].push([
            existingContour.points[i],
            existingContour.points[i+1]
          ]);
        }
        
        // Convert new pen stroke to polygon
        const newPolygon = [];
        for (let i = 0; i < payload.points.length; i += 3) {
          newPolygon.push([payload.points[i], payload.points[i+1]]);
        }
        
        // Perform polygon union
        const allPolygons = [...existingPolygons, newPolygon];
        const unionResult = performPolygonUnion(allPolygons);
        
        // Convert union result back to points array
        const unionPoints: number[] = [];
        unionResult.forEach(polygon => {
          polygon.forEach(([x, y]) => {
            unionPoints.push(x, y, payload.slicePosition);
          });
        });
        
        // Update contour with union result
        structure.contours[contourIndex] = {
          slicePosition: payload.slicePosition,
          points: unionPoints,
          numberOfPoints: unionPoints.length / 3,
        };
        
        console.log('Pen union operation completed');
      } else if (payload.operation === 'separate') {
        // For separate blobs, always create a new contour object
        // This keeps them visually separate without complex NaN handling
        structure.contours.push({
          slicePosition: payload.slicePosition,
          points: payload.points,
          numberOfPoints: payload.points.length / 3,
        });
        console.log('Added separate blob as new contour');
      } else if (payload.operation === 'union' && contourIndex === -1) {
        // First contour on slice
        structure.contours.push({
          slicePosition: payload.slicePosition,
          points: payload.points,
          numberOfPoints: payload.points.length / 3,
        });
      } else if (payload.operation === 'new') {
        // Handle the simple case - just add new contour from resultContours
        if (payload.resultContours && payload.resultContours.length > 0) {
          // resultContours is an array of polygons
          // For 'new' operation, we expect a single polygon
          const polygon = payload.resultContours[0];
          const points = [];
          
          // Convert polygon points to flat array
          for (let i = 0; i < polygon.length; i += 2) {
            points.push(polygon[i], polygon[i + 1], payload.slicePosition);
          }
          
          structure.contours.push({
            slicePosition: payload.slicePosition,
            points: points,
            numberOfPoints: points.length / 3,
          });
        }
      } else if (payload.operation === 'subtract') {
        // For subtraction, calculate the result using ClipperLib
        console.log('🔴 STARTING SUBTRACTION OPERATION:', {
          contourIndex,
          existingContoursAtSlice: structure.contours.filter((c: any) => 
            Math.abs(c.slicePosition - payload.slicePosition) <= tolerance
          ).length,
          slicePosition: payload.slicePosition
        });
        
        if (contourIndex >= 0) {
          // Get the existing contour to subtract from
          const existingContour = structure.contours[contourIndex];
          
          // Convert points to polygons for ClipperLib
          const existingPolygon = [];
          for (let i = 0; i < existingContour.points.length; i += 3) {
            existingPolygon.push([existingContour.points[i], existingContour.points[i+1]]);
          }
          
          const newPolygon = [];
          for (let i = 0; i < payload.points.length; i += 3) {
            newPolygon.push([payload.points[i], payload.points[i+1]]);
          }
          
          // Perform subtraction using ClipperLib
          const subtractResult = subtractContours(
            existingContour.points,
            payload.points
          );
          
          console.log('📐 Subtraction result:', {
            existingPoints: existingContour.points.length / 3,
            newPoints: payload.points.length / 3,
            resultPoints: subtractResult.length / 3
          });
          
          // Remove the original contour
          structure.contours.splice(contourIndex, 1);
          
          if (subtractResult.length === 0) {
            console.log('🗑️ Subtraction resulted in empty contour, removed slice');
          } else {
            // Add the subtraction result as new contour
            structure.contours.push({
              slicePosition: payload.slicePosition,
              points: subtractResult,
              numberOfPoints: subtractResult.length / 3,
            });
            console.log(`✅ Pen subtraction completed, replaced contour with ${subtractResult.length / 3} points`);
          }
        } else {
          console.warn('⚠️ Subtraction operation called but no existing contour found');
        }
      }

      setLocalRTStructures(updatedStructures);
      
      // Pass updated structures to parent (for sidebar updates)
      if (onContourUpdate) {
        onContourUpdate(updatedStructures);
      }
      
      saveContourUpdates(updatedStructures, 'pen_boolean_operation', [payload.structureId]);
      
      // Immediate render for pen boolean operations
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      console.log('🎯 PEN BOOLEAN: Immediate render triggered');
    } else if (payload.action === "update_rt_structures") {
      // Simple update after pen tool operations - structure already modified directly
      setLocalRTStructures(updatedStructures);
      
      // Pass updated structures to parent (for sidebar updates)
      if (onContourUpdate) {
        onContourUpdate(updatedStructures);
      }
      
      // Save state to undo system
      if (seriesId && payload.structureId) {
        undoRedoManager.saveState(seriesId, 'pen_tool', payload.structureId, updatedStructures);
      }
      // Save to server
      saveContourUpdates(updatedStructures, 'pen_tool', [payload.structureId]);
      
      // Immediate render for pen update operations
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      console.log('🎯 PEN UPDATE: Immediate render triggered');
    } else if (payload.action === "replace_contour") {
      // Handle contour replacement (morphing)
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // Find and replace the contour on current slice
      const contourIndex = structure.contours.findIndex(
        (c: any) =>
          Math.abs(c.slicePosition - payload.slicePosition) <= SLICE_TOL_MM,
      );

      if (contourIndex >= 0) {
        // Replace existing contour with new points
        structure.contours[contourIndex] = {
          slicePosition: payload.slicePosition,
          points: payload.points,
          numberOfPoints: payload.points.length / 3,
        };
        console.log(
          `Replaced contour at slice ${payload.slicePosition} with ${payload.points.length / 3} points`,
        );
      } else {
        // Create new contour if none exists
        structure.contours.push({
          slicePosition: payload.slicePosition,
          points: payload.points,
          numberOfPoints: payload.points.length / 3,
        });
        console.log(
          `Created new contour at slice ${payload.slicePosition} with ${payload.points.length / 3} points`,
        );
      }

      setLocalRTStructures(updatedStructures);
    } else if (payload.action === "merge_contours") {
      // Handle boolean merge operation (union) - properly merges multiple contours into one
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // Replace all contours at this slice with the merged result
      
      // Remove all existing contours at this slice
      structure.contours = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
      );

      // Add the merged contours from the boolean operation
      if (payload.contours && payload.contours.length > 0) {
        payload.contours.forEach((contourPoints: number[]) => {
          if (contourPoints.length >= 9) {
            structure.contours.push({
              slicePosition: payload.slicePosition,
              points: contourPoints,
              numberOfPoints: contourPoints.length / 3,
            });
          }
        });
        console.log(`Merged contours at slice ${payload.slicePosition}: ${payload.contours.length} contours added`);
      }

      setLocalRTStructures(updatedStructures);
      saveContourUpdates(updatedStructures, 'merge_contours');
    } else if (payload.action === "subtract_contours") {
      // Handle boolean subtract operation (difference)
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // Replace all contours at this slice with the subtraction result
      
      // Remove all existing contours at this slice
      structure.contours = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
      );

      // Add the resulting contours from the boolean operation
      if (payload.contours && payload.contours.length > 0) {
        payload.contours.forEach((contourPoints: number[]) => {
          if (contourPoints.length >= 9) {
            structure.contours.push({
              slicePosition: payload.slicePosition,
              points: contourPoints,
              numberOfPoints: contourPoints.length / 3,
            });
          }
        });
        console.log(`Subtraction result at slice ${payload.slicePosition}: ${payload.contours.length} contours added`);
      } else {
        console.log(`Subtraction result at slice ${payload.slicePosition}: all contours removed`);
      }

      setLocalRTStructures(updatedStructures);
      saveContourUpdates(updatedStructures, 'subtract_contours');
    } else if (payload.action === "grow_contour") {
      // Handle contour growing
      handleGrowContour(payload);
    } else if (payload.action === "apply_grow_contour") {
      // Handle applying grow/shrink operation (single slice - legacy)
      console.log("🔹 Applying grow/shrink operation:", payload);
      handleGrowContour(payload);
    } else if (payload.action === "apply_grow_structure") {
      // Handle applying grow/shrink to entire structure
      console.log("🔹 Applying grow/shrink to ENTIRE STRUCTURE:", payload);
      handleGrowStructure(payload);
    } else if (payload.action === "apply_margin") {
      // Handle margin operation (Eclipse TPS style)
      handleMarginOperation(payload);
    } else if (payload.action === "boolean_operation") {
      // Handle boolean operations (combine/subtract)
      await handleBooleanOperation(payload);
    } else if (payload.action === "delete_slice") {
      // Handle delete slice action - only delete the contour for the selected structure
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) {
        console.warn(`Structure ${payload.structureId} not found for delete operation`);
        return;
      }

      // Log current state before deletion
      console.log(`Before delete: Structure ${payload.structureId} has ${structure.contours.length} contours`);
      
      // Remove contour at specified slice position for this structure only - tight tolerance
      const originalLength = structure.contours.length;
      structure.contours = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - payload.slicePosition) > SLICE_TOL_MM
      );

      const deletedCount = originalLength - structure.contours.length;
      console.log(`Deleted ${deletedCount} contour(s) for structure ${payload.structureId} (${structure.structureName}) at slice ${payload.slicePosition}`);
      console.log(`After delete: Structure ${payload.structureId} has ${structure.contours.length} contours`);
      
      // Trigger prediction regeneration after deletion if prediction enabled
      if (brushToolState?.predictionEnabled && deletedCount > 0) {
        const normalizedSlice = normalizeSlicePosition(payload.slicePosition);
        generatePredictionForCurrentSlice(payload.structureId, normalizedSlice);
        // Force prediction update by incrementing trigger
        setPredictionTrigger(prev => prev + 1);
      }
      
      // Log all structures to verify others are not affected
      console.log("All structures after delete:", updatedStructures.structures.map((s: any) => ({
        id: s.roiNumber,
        name: s.structureName,
        contourCount: s.contours.length
      })));
      
      // Create new object reference to trigger React updates
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      
      setLocalRTStructures(newStructures);
      // Pass the full updated structures to parent
      if (onContourUpdate) {
        onContourUpdate(newStructures);
      }
      saveContourUpdates(newStructures, 'delete_slice', [payload.structureId]);
      
      // Force immediate render to show deletion
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      
      // Check for blob separation after deletion
      if (structure.contours.length > 0) {
        const blobs = groupStructureBlobs(structure, SLICE_TOL_MM);
        if (blobs.length > 1) {
          console.log(`⚠️ Slice deletion created ${blobs.length} separate blobs in ${structure.structureName}`);
          toast({
            title: "Multiple blobs detected",
            description: `Deleting this slice split ${structure.structureName} into ${blobs.length} separate parts. Use the Blob menu to manage them.`,
            duration: 5000
          });
        }
      }
    } else if (payload.action === "clear_all") {
      // Handle clear all slices action
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // Clear all contours for this structure
      structure.contours = [];

      console.log(`Cleared all contours for structure ${payload.structureId}`);
      
      // Create new object reference to trigger React updates
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      
      setLocalRTStructures(newStructures);
      saveContourUpdates(newStructures, 'clear_all', [payload.structureId]);
      
      // Force immediate render
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender();
    } else if (payload.action === "interpolate") {
      // Handle interpolate missing slices (fast polar interpolation, non-blocking)
      const structure = updatedStructures.structures.find((s: any) => s.roiNumber === payload.structureId);
      if (!structure || !structure.contours || structure.contours.length < 2) {
        console.log("Not enough contours to interpolate");
        toast({ title: "Not enough contours", description: "Need at least 2 contours to interpolate", variant: "destructive" });
        return;
      }

      // Group contours by slice position
      const byZ = new Map<number, any[]>();
      for (const c of structure.contours) {
        const arr = byZ.get(c.slicePosition) || [];
        arr.push(c);
        byZ.set(c.slicePosition, arr);
      }
      const zKeys = Array.from(byZ.keys()).sort((a, b) => a - b);

      // Build CT Z array (mm) for real slice targeting
      const zArrayRaw: number[] = images.map((img: any) => {
        let z = img.parsedSliceLocation ?? img.parsedZPosition;
        if (z == null) {
          const m = img.imageMetadata || img;
          if (m?.sliceLocation != null) z = parseFloat(m.sliceLocation);
          else if (m?.imagePosition) {
            const pos = typeof m.imagePosition === 'string' ? m.imagePosition.split('\\').map(Number) : m.imagePosition;
            if (Array.isArray(pos) && pos.length >= 3) z = Number(pos[2]);
          }
        }
        return Number(z);
      }).filter((z: any) => Number.isFinite(z));
      const zArray = [...zArrayRaw].sort((a, b) => a - b);
      const tol = SLICE_TOL_MM;

      // Show toast immediately
      toast({ title: "Interpolating...", description: "Processing slices" });

      // Import arc-length interpolation (robust for all contour shapes)
      const { fastPolarInterpolateMulti } = await import('@/lib/fast-polar-interpolation');

      const newContours: any[] = [];
      let interpolatedCount = 0;
      
      // Process each gap between contoured slices
      for (let i = 0; i < zKeys.length - 1; i++) {
        const zA = zKeys[i];
        const zB = zKeys[i + 1];
        const listA = byZ.get(zA)!;
        const listB = byZ.get(zB)!;
        
        // Keep original contours from slice A
        newContours.push(...listA);
        
        const zMin = Math.min(zA, zB) + tol;
        const zMax = Math.max(zA, zB) - tol;
        
        // Find all slices between zA and zB
        for (const z of zArray) {
          if (z > zMin && z < zMax) {
            try {
              // Use arc-length interpolation (works with any contour shape)
              const pts = fastPolarInterpolateMulti(
                listA.map((c: any) => ({ points: c.points })),
                zA,
                listB.map((c: any) => ({ points: c.points })),
                zB,
                z,
                128 // number of output points
              );
              
              if (pts && pts.length >= 9) {
                newContours.push({ 
                  slicePosition: z, 
                  points: pts, 
                  numberOfPoints: pts.length / 3 
                });
                interpolatedCount++;
              }
            } catch (error) {
              console.error(`Failed to interpolate at z=${z}:`, error);
            }
          }
        }
      }
      
      // Add last slice's original contours
      const lastZ = zKeys[zKeys.length - 1];
      newContours.push(...(byZ.get(lastZ) || []));
      
      // Update structure with all contours (original + interpolated)
      structure.contours = newContours;
      console.log(`Interpolated ${interpolatedCount} new slices for structure ${payload.structureId}`);
      
      // Create new object reference to trigger React updates
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      
      setLocalRTStructures(newStructures);
      saveContourUpdates(newStructures, 'interpolate', [payload.structureId]);
      
      // Force immediate render
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      
      toast({ 
        title: "Interpolation complete", 
        description: `Added ${interpolatedCount} interpolated slices` 
      });
    } else if (payload.action === "delete_nth_slice") {
      // Handle delete every nth slice
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // Sort contours by slice position
      const sortedContours = [...structure.contours].sort((a: any, b: any) => a.slicePosition - b.slicePosition);
      
      // Keep only contours that are not at nth positions
      const filteredContours = sortedContours.filter((_, index) => {
        // Keep the first contour (index 0), delete every nth after that
        return index === 0 || (index % payload.nth) !== 0;
      });
      
      structure.contours = filteredContours;
      const deletedCount = sortedContours.length - filteredContours.length;
      console.log(`Deleted ${deletedCount} contours (every ${payload.nth} slice) for structure ${payload.structureId}`);
      
      // Create new object reference to trigger React updates
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      
      setLocalRTStructures(newStructures);
      saveContourUpdates(newStructures, 'delete_nth_slice');
      
      // Force immediate render
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender();
      
      // Check for blob separation after deletion
      if (structure.contours.length > 0) {
        const blobs = groupStructureBlobs(structure, SLICE_TOL_MM);
        if (blobs.length > 1) {
          console.log(`⚠️ Deleting every ${payload.nth} slice created ${blobs.length} separate blobs in ${structure.structureName}`);
          toast({
            title: "Multiple blobs detected",
            description: `Deleting slices split ${structure.structureName} into ${blobs.length} separate parts. Use the Blob menu to manage them.`,
            duration: 5000
          });
        }
      }
    } else if (payload.action === "get_slice_count") {
      // Handle request for slice count (for SmartNth dialog)
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;
      
      if (payload.callback && typeof payload.callback === 'function') {
        payload.callback(structure.contours.length);
      }
    } else if (payload.action === "smart_nth_slice") {
      // Handle smart nth slice deletion
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      // Sort contours by slice position
      const sortedContours = [...structure.contours].sort((a: any, b: any) => a.slicePosition - b.slicePosition);
      
      if (sortedContours.length <= 1) {
        console.log('Not enough contours for SmartNth operation');
        return;
      }
      
      // Area calculation using shoelace formula
      const areaOf = (pts: number[]) => {
        let area = 0;
        for (let i = 0; i < pts.length; i += 3) {
          const j = (i + 3) % pts.length;
          area += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
        }
        return Math.abs(area / 2);
      };
      
      // Calculate areas for all contours
      const contoursWithArea = sortedContours.map((contour: any) => ({
        contour,
        area: areaOf(contour.points)
      }));
      
      // Determine which slices to keep
      const keepFlags = new Array(contoursWithArea.length).fill(false);
      keepFlags[0] = true; // Always keep first slice
      
      let consecutiveRemoved = 0;
      const thresholdPercent = payload.threshold || 30;
      
      for (let i = 1; i < contoursWithArea.length; i++) {
        const currentArea = contoursWithArea[i].area;
        const prevArea = contoursWithArea[i - 1].area;
        const nextArea = i < contoursWithArea.length - 1 ? contoursWithArea[i + 1].area : null;
        
        // Calculate percent change from previous
        const changeFromPrev = prevArea > 0 ? Math.abs((currentArea - prevArea) / prevArea) * 100 : 0;
        
        // Calculate percent change to next (if exists)
        const changeToNext = nextArea !== null && currentArea > 0 
          ? Math.abs((nextArea - currentArea) / currentArea) * 100 
          : 0;
        
        // Keep slice if:
        // 1. Significant change from previous slice (this is the change point)
        // 2. Significant change to next slice (before the change point)
        // 3. Previous slice was a significant change (after the change point)
        // 4. We've already removed 3 consecutive slices (max gap enforcement)
        const isSignificantChange = changeFromPrev > thresholdPercent;
        const nextIsSignificantChange = changeToNext > thresholdPercent;
        const prevWasSignificantChange = i > 1 && prevArea > 0 && contoursWithArea[i - 2].area > 0
          ? Math.abs((prevArea - contoursWithArea[i - 2].area) / contoursWithArea[i - 2].area) * 100 > thresholdPercent
          : false;
        
        if (isSignificantChange || nextIsSignificantChange || prevWasSignificantChange || consecutiveRemoved >= 3) {
          keepFlags[i] = true;
          consecutiveRemoved = 0;
        } else {
          consecutiveRemoved++;
        }
      }
      
      // Filter contours based on keep flags
      const filteredContours = sortedContours.filter((_: any, index: number) => keepFlags[index]);
      
      const deletedCount = sortedContours.length - filteredContours.length;
      console.log(`SmartNth: Deleted ${deletedCount} contours (threshold: ${thresholdPercent}%) for structure ${payload.structureId}`);
      console.log(`SmartNth: Kept ${filteredContours.length} out of ${sortedContours.length} slices`);
      
      structure.contours = filteredContours;
      setLocalRTStructures(updatedStructures);
      saveContourUpdates(updatedStructures, 'smart_nth_slice');
    } else if (payload.action === "clear_below") {
      // Handle clear below current slice
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      const originalCount = structure.contours.length;
      structure.contours = structure.contours.filter(
        (c: any) => c.slicePosition >= payload.slicePosition
      );
      
      const deletedCount = originalCount - structure.contours.length;
      console.log(`Cleared ${deletedCount} contours below slice ${payload.slicePosition} for structure ${payload.structureId}`);
      
      // Create new object reference to trigger React updates
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      
      setLocalRTStructures(newStructures);
      saveContourUpdates(newStructures, 'clear_below');
      
      // Force immediate render
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
    } else if (payload.action === "clear_above") {
      // Handle clear above current slice
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) return;

      const originalCount = structure.contours.length;
      structure.contours = structure.contours.filter(
        (c: any) => c.slicePosition <= payload.slicePosition
      );
      
      const deletedCount = originalCount - structure.contours.length;
      console.log(`Cleared ${deletedCount} contours above slice ${payload.slicePosition} for structure ${payload.structureId}`);
      
      // Create new object reference to trigger React updates
      const newStructures = { ...updatedStructures, structures: [...updatedStructures.structures] };
      
      setLocalRTStructures(newStructures);
      saveContourUpdates(newStructures, 'clear_above');
      
      // Force immediate render
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
    } else if (payload.action === "smooth") {
      // Handle contour smoothing
      const structure = updatedStructures.structures.find(
        (s: any) => s.roiNumber === payload.structureId,
      );
      if (!structure) {
        console.error(`Structure ${payload.structureId} not found`);
        return;
      }

      // Apply smoothing to all contours in the structure
      const { smoothContour } = await import('@/lib/contour-smooth-simple');
      const smoothingFactor = payload.smoothingFactor || 0.15;
      
      let smoothedCount = 0;
      structure.contours = structure.contours.map((contour: any) => {
        if (contour.points && contour.points.length >= 9) {
          const smoothedContour = smoothContour(
            {
              points: contour.points,
              slicePosition: contour.slicePosition
            },
            smoothingFactor
          );
          
          smoothedCount++;
          return {
            ...contour,
            points: smoothedContour.points,
            numberOfPoints: smoothedContour.points.length / 3
          };
        }
        return contour;
      });

      console.log(`Applied smoothing to ${smoothedCount} contours in structure ${payload.structureId} with factor ${smoothingFactor}`);
      
      setLocalRTStructures(updatedStructures);
      
      // Trigger ripple animation if requested
      if (payload.triggerAnimation) {
        setSmoothAnimation({
          structureId: payload.structureId,
          startTime: Date.now(),
          duration: 350 // Fast, snappy glow pulse
        });
        console.log(`🌊 Smooth border glow animation triggered for structure ${payload.structureId}`);
      }
      
      // Pass the updated structures up to parent component
      if (onContourUpdate) {
        onContourUpdate(updatedStructures);
      }

      // Save state to undo system
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          'smooth', 
          payload.structureId, 
          updatedStructures,
          undefined, // Smooth applies to all slices
          structure.structureName
        );
      }
      saveContourUpdates(updatedStructures, 'smooth');
      
      // Force immediate render to show smoothed contours
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
    } else if (payload.action === 'open_remove_blobs_dialog') {
      const structure = updatedStructures.structures.find((s: any) => s.roiNumber === payload.structureId);
      if (!structure || !Array.isArray(structure.contours)) return;
      const blobs = groupStructureBlobs(structure, SLICE_TOL_MM).map((b, idx) => ({
        id: idx + 1,
        volumeCc: computeBlobVolumeCc(b, imageMetadata),
        contours: b
      }));
      if (!blobs || blobs.length <= 1) {
        toast({ title: "No blobs to remove", description: "Only one blob detected in this structure", variant: "destructive" });
        return;
      }
      
      // Sort blobs by volume (smallest first)
      blobs.sort((a, b) => a.volumeCc - b.volumeCc);
      
      console.log(`Opening blob dialog with ${blobs.length} blobs`);
      setBlobDialogData({ structureId: payload.structureId, blobs });
      setBlobDialogOpen(true);
    } else if (payload.action === 'separate_blobs') {
      const structure = updatedStructures.structures.find((s: any) => s.roiNumber === payload.structureId);
      if (!structure || !Array.isArray(structure.contours)) return;
      const blobs = groupStructureBlobs(structure, SLICE_TOL_MM);
      if (!blobs || blobs.length <= 1) {
        console.log('No blobs to separate (only one blob detected)');
        toast({ title: "No separation needed", description: "Only one blob detected in this structure", variant: "destructive" });
        return;
      }
      const baseName = String(structure.structureName || 'Structure');
      const color = Array.isArray(structure.color) ? structure.color : [0, 255, 0];
      const maxRoi = Math.max(0, ...updatedStructures.structures.map((s: any) => s.roiNumber || 0));
      let nextRoi = maxRoi + 1;
      blobs.forEach((blobContours, index) => {
        updatedStructures.structures.push({
          roiNumber: nextRoi++,
          structureName: `${baseName}_${index + 1}`,
          color,
          contours: blobContours
        });
      });
      structure.contours = [];
      console.log(`Separated ${blobs.length} blobs from structure ${payload.structureId}`);
      
      setLocalRTStructures(updatedStructures);
      
      // Pass updated structures to parent component
      if (onContourUpdate) {
        onContourUpdate(updatedStructures);
      }
      
      if (seriesId) {
        undoRedoManager.saveState(
          seriesId, 
          'separate_blobs', 
          payload.structureId, 
          updatedStructures,
          undefined, // Applies to all slices
          structure.structureName
        );
      }
      saveContourUpdates(updatedStructures, 'separate_blobs');
      
      // Force immediate render to show separated blobs
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender(true); // immediate=true
      
      // Show success toast
      toast({ title: "Blobs separated", description: `Created ${blobs.length} new structures from ${baseName}` });
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleContourUpdate,
    canvasRef, // Expose canvas ref for toolbar to access
    setPanMode: () => {
      setIsPanMode(true);
      setCrosshairMode(false);
      console.log('Pan mode activated');
    },
    setCrosshairMode: () => {
      setIsPanMode(false);
      setCrosshairMode(true);
      console.log('Crosshair mode activated');
    },
    forceRender: () => {
      // Force immediate render - used for show/hide all structures
      try {
        scheduleRender();
        console.log('🎯 Force render triggered');
      } catch(e) {
        console.warn('Force render failed:', e);
      }
    },
    openFusionDebug,
    getActivePredictions: () => activePredictions,
    getPropagationMode: () => propagationMode,
    setPropagationMode: (mode: PropagationMode) => setPropagationMode(mode),
    navigateToSlice: (targetZ: number) => {
      if (!images || images.length === 0) {
        console.warn('🎯 Cannot navigate: no images available');
        return;
      }

      console.log(`🎯 Navigating to Z position: ${targetZ.toFixed(1)}`);

      // Find the closest slice to the target Z position
      let closestIndex = 0;
      let closestDistance = Infinity;

      images.forEach((image, index) => {
        // Get Z position from image metadata
        let imageZ = index; // fallback to index (synthetic)
        
        if (image.imageMetadata?.imagePosition || image.imagePosition) {
          const pos = Array.isArray(image.imagePosition)
            ? image.imagePosition
            : (typeof image.imagePosition === 'string' ? image.imagePosition.split("\\").map(Number) : (Array.isArray(image.imageMetadata?.imagePosition) ? image.imageMetadata.imagePosition : String(image.imageMetadata?.imagePosition||'').split("\\").map(Number)));
          if (pos && pos.length >= 3 && isFinite(pos[2])) imageZ = pos[2];
        } else if (image.parsedSliceLocation !== undefined && image.parsedSliceLocation !== null) {
          imageZ = image.parsedSliceLocation;
        } else if (image.parsedZPosition !== undefined && image.parsedZPosition !== null) {
          imageZ = image.parsedZPosition;
        } else if (image.imageMetadata?.sliceLocation !== undefined) {
          const parsed = parseFloat(image.imageMetadata.sliceLocation);
          if (!isNaN(parsed)) {
            imageZ = parsed;
          }
        } else if (image.imageMetadata?.imagePosition) {
          const imagePos = typeof image.imageMetadata.imagePosition === 'string'
            ? image.imageMetadata.imagePosition.split("\\")
            : image.imageMetadata.imagePosition;
          if (imagePos && imagePos.length >= 3) {
            const parsed = parseFloat(imagePos[2]);
            if (!isNaN(parsed)) {
              imageZ = parsed;
            }
          }
        }

        const distance = Math.abs(imageZ - targetZ);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      // Navigate to the closest slice
      setCurrentIndex(closestIndex);
    },
  }), [rtStructures, images, setCurrentIndex]);

  // Handle auto-zoom when autoZoomLevel prop changes - DISABLED FOR DEBUGGING
  /*
  useEffect(() => {
    if (autoZoomLevel && autoZoomLevel !== zoom) {
      setZoom(autoZoomLevel);
      if (images.length > 0) {
        scheduleRender();
      }
    }
  }, [autoZoomLevel, zoom, images.length]);
  */

  // Handle auto-localize when autoLocalizeTarget prop changes
  useEffect(() => {
    if (autoLocalizeTarget) {
      const { x, y, z } = autoLocalizeTarget;
      
      console.log(`🎯 Auto-localize to: x=${x.toFixed(1)}, y=${y.toFixed(1)}, z=${z.toFixed(1)}`);
      
      // STEP 1: Navigate to the correct Z slice first
      if (z !== undefined && images.length > 0) {
        let closestIndex = 0;
        let closestDistance = Infinity;

        images.forEach((image, index) => {
          // Get Z position from image metadata
          let imageZ = index;
          if (image.parsedSliceLocation !== null && image.parsedSliceLocation !== undefined) {
            imageZ = image.parsedSliceLocation;
          } else if (image.parsedZPosition !== null && image.parsedZPosition !== undefined) {
            imageZ = image.parsedZPosition;
          } else if (image.sliceZ !== undefined) {
            imageZ = typeof image.sliceZ === 'string' ? parseFloat(image.sliceZ) : image.sliceZ;
          }

          const distance = Math.abs(imageZ - z);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });
        
        console.log(`🎯 Navigating to slice index ${closestIndex} (Z=${z.toFixed(1)})`);
        setCurrentIndex(closestIndex);
      }
      
      // STEP 2: Convert world coordinates to pan offsets for centering
      // Scale the coordinates appropriately for the canvas
      const scaleFactor = 0.1; // Adjust this value as needed
      setPanX(-x * scaleFactor);
      setPanY(-y * scaleFactor);
      setLastPanX(-x * scaleFactor);
      setLastPanY(-y * scaleFactor);
      
      if (images.length > 0) {
        scheduleRender();
      }
    }
  }, [autoLocalizeTarget, images.length]);

  useEffect(() => {
    loadImages();
  }, [seriesId]);

  useEffect(() => {
    if (!registrationAssociations) {
      setRegistrationAssociationsForPrimary([]);
      return;
    }
    const list = registrationAssociations.get(seriesId) || [];
    console.log('registration associations for primary', { seriesId, list });
    setRegistrationAssociationsForPrimary(list);
  }, [registrationAssociations, seriesId]);

  useEffect(() => {
    if (secondarySeriesId == null) {
      setSelectedRegistrationId(null);
      return;
    }
    if (!registrationOptions.length) {
      setSelectedRegistrationId(null);
      return;
    }
    const hasSelected = registrationOptions.some(opt => (opt.id ?? null) === (selectedRegistrationId ?? null));
    if (!hasSelected) {
      setSelectedRegistrationId(registrationOptions[0].id ?? null);
    }
  }, [secondarySeriesId, registrationOptions, selectedRegistrationId]);

  // Apply registration matrix derived from association graph instead of resolve endpoint
  useEffect(() => {
    if (!seriesId || secondarySeriesId == null) {
      if (registrationMatrixRef.current !== null) {
        registrationMatrixRef.current = null;
        setRegistrationMatrix(null);
      }
      setLastResolveInfo({
        status: 204,
        ok: false,
        data: {
          reason: !seriesId ? 'missing-primary-series' : 'missing-secondary-series',
          primarySeriesId: seriesId ?? null,
          secondarySeriesId: secondarySeriesId ?? null,
        },
      });
      return;
    }

    if (!registrationOptions.length) {
      if (registrationMatrixRef.current !== null) {
        registrationMatrixRef.current = null;
        setRegistrationMatrix(null);
      }
      setLastResolveInfo({
        status: 404,
        ok: false,
        data: {
          reason: 'no-registration-options',
          primarySeriesId: seriesId,
          secondarySeriesId,
        },
      });
      return;
    }

    const selectedOption = registrationOptions.find(opt => (opt.id ?? null) === (selectedRegistrationId ?? null))
      ?? registrationOptions[0];

    if (!selectedOption) {
      if (registrationMatrixRef.current !== null) {
        registrationMatrixRef.current = null;
        setRegistrationMatrix(null);
      }
      setLastResolveInfo({
        status: 404,
        ok: false,
        data: {
          reason: 'registration-option-not-found',
          primarySeriesId: seriesId,
          secondarySeriesId,
          registrationId: selectedRegistrationId ?? null,
        },
      });
      return;
    }

    const derivedMatrix = Array.isArray(selectedOption.matrix) && selectedOption.matrix.length === 16
      ? selectedOption.matrix.slice()
      : (selectedOption.relationship === 'shared-frame' ? cloneIdentityMatrix() : null);

    if (derivedMatrix) {
      if (!matricesEqual(registrationMatrixRef.current, derivedMatrix)) {
        registrationMatrixRef.current = derivedMatrix;
        setRegistrationMatrix(derivedMatrix);
      } else if (registrationMatrixRef.current === null) {
        registrationMatrixRef.current = derivedMatrix;
        setRegistrationMatrix(derivedMatrix);
      }
      setLastResolveInfo({
        status: 200,
        ok: true,
        data: {
          source: 'associations',
          registrationId: selectedOption.id ?? null,
          relationship: selectedOption.relationship,
          regFile: selectedOption.regFile ?? null,
          targetSeriesId: selectedOption.association?.targetSeriesId ?? null,
          sourceSeriesIds: selectedOption.association?.sourcesSeriesIds ?? [],
        },
      });
    } else {
      if (registrationMatrixRef.current !== null) {
        registrationMatrixRef.current = null;
        setRegistrationMatrix(null);
      }
      setLastResolveInfo({
        status: 422,
        ok: false,
        data: {
          source: 'associations',
          registrationId: selectedOption.id ?? null,
          relationship: selectedOption.relationship,
          reason: 'missing-matrix',
        },
      });
    }
  }, [seriesId, secondarySeriesId, registrationOptions, selectedRegistrationId]);
  
  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║  FUSION CACHE CLEARING - DO NOT "OPTIMIZE" WITHOUT TESTING                   ║
  // ╠══════════════════════════════════════════════════════════════════════════════╣
  // ║  The cache clearing behavior below is INTENTIONAL and CRITICAL for           ║
  // ║  correct fusion overlay rendering. Previous attempts to "optimize" by        ║
  // ║  not clearing the cache caused SEVERE scroll performance degradation.        ║
  // ║                                                                              ║
  // ║  Architecture:                                                               ║
  // ║  - fuseboxCacheRef (local): Stores pre-rendered HTMLCanvasElement objects    ║
  // ║  - globalFusionCache: Stores raw FuseboxSlice data (shared across viewports) ║
  // ║                                                                              ║
  // ║  Why we clear the LOCAL cache on secondary/registration changes:             ║
  // ║  1. The warm prefetch quickly repopulates from globalFusionCache             ║
  // ║  2. Prevents stale overlay data from wrong registration showing              ║
  // ║  3. Memory management - canvas objects are large                             ║
  // ║                                                                              ║
  // ║  What happens if you try to "preserve" the cache:                            ║
  // ║  - Scroll performance becomes ABYSMAL                                        ║
  // ║  - Every scroll frame triggers expensive convertSliceToCanvas calls          ║
  // ║  - The prefetch/warm logic breaks and competes with render loop              ║
  // ║                                                                              ║
  // ║  TESTED AND WORKING AS OF: December 2024                                     ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  
  // Re-render fusion overlay when registration matrix updates
  useEffect(() => {
    fuseboxCacheRef.current.clear();
    clearFusionSlices(seriesId);
    setFuseboxTransformSource(null);
    scheduleRender();
  }, [registrationMatrix, secondarySeriesId, selectedRegistrationId, scheduleRender, seriesId]);

  // Handle secondary series changes - clear cache and load metadata
  useEffect(() => {
    if (!secondarySeriesId) {
      setSecondaryModality('MR');
      setFuseboxTransformSource(null);
      fuseboxCacheRef.current.clear();
      clearFusionSlices(seriesId);
      return;
    }

    let cancelled = false;
    const loadMetadata = async () => {
      try {
        const response = await fetch(`/api/series/${secondarySeriesId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.modality) {
          setSecondaryModality(data.modality);
        }
      } catch {}
    };

    // Clear local canvas cache - the warm prefetch will repopulate from global cache
    // DO NOT remove this clear() call - see warning block above
    fuseboxCacheRef.current.clear();
    clearFusionSlices(seriesId);
    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [secondarySeriesId, seriesId]);

  // Auto-trigger background loading when primary images and registration are ready
  // TEMPORARILY DISABLED to fix scrolling and flashing issues
  // useEffect(() => {
  //   if (images.length > 0 && registrationMatrix && registrationMatrix.length === 16) {
  //     // Small delay to ensure primary is fully loaded before starting background tasks
  //     const timer = setTimeout(() => {
  //       startBackgroundLoading();
  //     }, 1000);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [images.length, registrationMatrix, startBackgroundLoading]);

  useEffect(() => {
    if (images.length > 0 && !isPreloading) {
      // Immediate rendering for smooth scrolling - this is critical for DICOM viewer performance
      scheduleRender();
      
      // Load metadata for current image with minimal delay
      const currentImage = images[currentIndex];
      if (currentImage?.id) {
        setTimeout(() => {
          loadImageMetadata(currentImage.id);
        }, 5); // Minimal delay only for metadata
      }
    }
  }, [images, currentIndex, isPreloading]);

  // Separate effect for window level changes - only re-render, don't reload metadata
  useEffect(() => {
    if (images.length > 0 && !isPreloading) {
      // Clear MPR cache on window/level change for proper updates
      if (mprCacheRef.current.size > 0) {
        if (DEBUG) console.log('Clearing MPR cache due to window/level change');
        mprCacheRef.current.clear();
      }
      scheduleRender();
    }
  }, [currentWindowLevel, zoom, panX, panY, images.length, isPreloading, fusionDisplayMode]);

  const loadImages = async () => {
    try {
      // 1. Check for externally provided initial images (Fixed FlexibleFusionLayout optimization)
      if (props.initialImages && props.initialImages.length > 0) {
        console.log(`Using provided initial images for series ${seriesId}`);
        setImages(props.initialImages);
        
        // Setup initial state similar to a fresh load
        const midpointIndex = Math.floor(props.initialImages.length / 2);
        setCurrentIndex(midpointIndex);
        setIsLoading(false);
        
        // Schedule initial render
        setTimeout(() => {
          displayCurrentImage();
        }, 10);
        
        // Start background prefetching (if enabled)
        startBackgroundPrefetch(props.initialImages);
        return;
      }

      // 2. Check if images are already cached
      if (imageCache?.current.has(seriesId.toString())) {
        const cached = imageCache.current.get(seriesId.toString());
        if (cached) {
          console.log(`Using cached images for series ${seriesId}`);
          setImages(cached.images);
          setCurrentIndex(0);
          setIsLoading(false);
          // Schedule initial render
          setTimeout(() => {
            displayCurrentImage();
          }, 10);
          // Start background prefetching for remaining images
          startBackgroundPrefetch(cached.images);
          return;
        }
      }
      
      setIsLoading(true);
      setError(null);

      // Check GPU acceleration availability for Cornerstone3D migration
      if (!gpuCheckComplete) {
        const gpuAvailable = isGPUAccelerationAvailable();
        console.log(`🖥️ GPU acceleration available: ${gpuAvailable ? 'YES ✅' : 'NO ❌'}`);
        setIsGPUMode(gpuAvailable);
        setGpuCheckComplete(true);
        
        if (gpuAvailable) {
          console.log('GPU acceleration detected - ready for Cornerstone3D migration phase');
          // Initialize Cornerstone3D in the next steps
        } else {
          console.log('No GPU acceleration - will continue using Cornerstone Core');
        }
      }

      // Cancel any existing series load
      if (seriesAbortRef.current) {
        seriesAbortRef.current.abort();
      }
      
      // Create new abort controller for this series
      seriesAbortRef.current = new AbortController();
      const signal = seriesAbortRef.current.signal;

      const response = await fetch(`/api/series/${seriesId}/images`, { signal });
      if (!response.ok) {
        throw new Error(`Failed to load images: ${response.statusText}`);
      }

      const seriesImages = await response.json();

      // Use batch metadata parsing for much better performance (1 request vs 300+)
      console.log(`📊 Loading metadata for ${seriesImages.length} images using batch API...`);
      let imagesWithMetadata;
      try {
        const batchResponse = await fetch(`/api/series/${seriesId}/batch-metadata`, { signal });
        if (batchResponse.ok) {
          const batchMetadata = await batchResponse.json();
          
          // Create lookup map for faster matching
          const metadataMap = new Map();
          batchMetadata.forEach((meta: any) => {
            metadataMap.set(meta.sopInstanceUID, meta);
          });
          
          // Merge batch metadata with series images
          imagesWithMetadata = seriesImages.map((img: any) => {
            const metadata = metadataMap.get(img.sopInstanceUID);
            if (metadata && !metadata.error) {
              return {
                ...img,
                parsedSliceLocation: metadata.parsedSliceLocation,
                parsedZPosition: metadata.parsedZPosition,
                parsedInstanceNumber: metadata.parsedInstanceNumber ?? img.instanceNumber,
              };
            } else {
              return {
                ...img,
                parsedSliceLocation: null,
                parsedZPosition: null,
                parsedInstanceNumber: img.instanceNumber,
              };
            }
          });
          
          console.log(`✅ Batch metadata loaded successfully for ${imagesWithMetadata.length} images`);
        } else {
          throw new Error('Batch metadata endpoint failed');
        }
      } catch (error) {
        console.warn('Batch metadata loading failed, falling back to individual parsing:', error);
        
        // Fallback to individual metadata parsing if batch fails
        const workerManager = getDicomWorkerManager();
        imagesWithMetadata = await Promise.all(
          seriesImages.map(async (img: any) => {
            try {
              const response = await fetch(`/api/images/${img.sopInstanceUID}`, { signal });
              const arrayBuffer = await response.arrayBuffer();
              const metadata = await workerManager.parseDicomMetadata(arrayBuffer);

              return {
                ...img,
                parsedSliceLocation: metadata.parsedSliceLocation,
                parsedZPosition: metadata.parsedZPosition,
                parsedInstanceNumber: metadata.parsedInstanceNumber ?? img.instanceNumber,
              };
            } catch (error) {
              console.warn(`Failed to parse DICOM metadata for ${img.fileName}:`, error);
              return {
                ...img,
                parsedSliceLocation: null,
                parsedZPosition: null,
                parsedInstanceNumber: img.instanceNumber,
              };
            }
          }),
        );
      }

      // Sort by spatial position - prefer slice location, then z-position, then instance number
      const sortedImages = imagesWithMetadata.sort((a: any, b: any) => {
        // Primary: slice location
        if (a.parsedSliceLocation !== null && b.parsedSliceLocation !== null) {
          return a.parsedSliceLocation - b.parsedSliceLocation;
        }

        // Secondary: z-position from image position
        if (a.parsedZPosition !== null && b.parsedZPosition !== null) {
          return a.parsedZPosition - b.parsedZPosition;
        }

        // Tertiary: instance number
        if (
          a.parsedInstanceNumber !== null &&
          b.parsedInstanceNumber !== null
        ) {
          return a.parsedInstanceNumber - b.parsedInstanceNumber;
        }

        // Final fallback: filename
        return a.fileName.localeCompare(b.fileName, undefined, {
          numeric: true,
        });
      });

      setImages(sortedImages);
      
      // Start at midpoint of scan (more clinically relevant)
      const midpointIndex = Math.floor(sortedImages.length / 2);
      setCurrentIndex(midpointIndex);
      
      // Cache the sorted images
      if (imageCache?.current) {
        imageCache.current.set(seriesId.toString(), {
          images: sortedImages,
          metadata: null // TODO: Add metadata if needed
        });
        console.log(`Cached ${sortedImages.length} images for series ${seriesId}`);
      }

      // Load the midpoint image before removing loading screen
      if (sortedImages.length > 0) {
        try {
          const midImage = sortedImages[midpointIndex];
          const imageData = await fetchAndParseImage(midImage.sopInstanceUID, signal);
          if (imageData) {
            // Midpoint image loaded, now we can remove loading screen
            setIsLoading(false);
            // Schedule initial render
            setTimeout(() => {
              displayCurrentImage();
            }, 10);
          }
        } catch (err) {
          console.error('Failed to load midpoint image:', err);
        }
      }

      // OHIF 3.10-style background prefetching - runs after initial display
      // This doesn't block the UI and loads remaining images in background
      setTimeout(() => {
        console.log('📚 Starting OHIF-style background prefetching...');
        startBackgroundPrefetch(sortedImages);
      }, 100); // Small delay to ensure UI is responsive
    } catch (error: any) {
      // Don't show error for aborted requests (happens when switching series)
      if (error.name === 'AbortError') {
        console.log('Series load aborted (user switched series)');
        return;
      }
      setError(error.message);
      setIsLoading(false);
    }
  };

  const parseDicomImage = async (arrayBuffer: ArrayBuffer) => {
    try {
      // Use web worker for 65% performance improvement
      const workerManager = getDicomWorkerManager();
      const result = await workerManager.parseDicomImage(arrayBuffer);
      return result;
    } catch (error) {
      console.error("Error parsing DICOM image:", error);
      return null;
    }
  };

  // Single fetch/parse function to avoid double fetching
  // Uses global pending fetches map to prevent race conditions in multi-viewport scenarios
  const fetchAndParseImage = async (sopInstanceUID: string, signal?: AbortSignal) => {
    // 1. Check shared pixel cache first (if provided)
    if (props.pixelDataCache?.current?.has(sopInstanceUID)) {
      return props.pixelDataCache.current.get(sopInstanceUID);
    }

    // 2. Check local cache
    if (imageCacheRef.current.has(sopInstanceUID)) {
      return imageCacheRef.current.get(sopInstanceUID);
    }
    
    // 3. Check if another viewer is already fetching this image (race condition prevention)
    if (globalPendingFetches.has(sopInstanceUID)) {
      // Wait for the existing fetch to complete
      return globalPendingFetches.get(sopInstanceUID);
    }
    
    // 4. Start new fetch and register in pending map
    const fetchPromise = (async () => {
      try {
        const response = await fetch(`/api/images/${sopInstanceUID}`, { signal });
        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const imageData = await parseDicomImage(arrayBuffer);
        
        if (imageData) {
          // Update local cache
          imageCacheRef.current.set(sopInstanceUID, imageData);
          
          // Update shared cache (if provided)
          if (props.pixelDataCache?.current) {
            props.pixelDataCache.current.set(sopInstanceUID, imageData);
          }
          
          // Populate global cache for MPR
          if (!((window as any).__WV_CACHE__)) {
            (window as any).__WV_CACHE__ = new Map();
          }
          (window as any).__WV_CACHE__.set(sopInstanceUID, {
            data: imageData.data,
            width: imageData.width,
            height: imageData.height
          });
        }
        
        return imageData;
      } finally {
        // Clean up pending fetch entry
        globalPendingFetches.delete(sopInstanceUID);
      }
    })();
    
    // Register the promise before awaiting
    globalPendingFetches.set(sopInstanceUID, fetchPromise);
    
    return fetchPromise;
  };
  
  // Batch fetch multiple images at once for better performance
  const fetchBatchImages = async (sopInstanceUIDs: string[], signal?: AbortSignal): Promise<Map<string, any>> => {
    const results = new Map<string, any>();
    const pendingPromises: Promise<void>[] = [];
    
    // Filter out already cached images and pending fetches
    const uncachedUIDs = sopInstanceUIDs.filter(uid => {
      // Check shared cache first
      if (props.pixelDataCache?.current?.has(uid)) {
        results.set(uid, props.pixelDataCache.current.get(uid));
        return false;
      }
      // Check local cache
      if (imageCacheRef.current.has(uid)) {
        results.set(uid, imageCacheRef.current.get(uid));
        return false;
      }
      // Check if another viewer is already fetching this image
      if (globalPendingFetches.has(uid)) {
        // Wait for the pending fetch and add result
        pendingPromises.push(
          globalPendingFetches.get(uid)!.then(imageData => {
            if (imageData) results.set(uid, imageData);
          }).catch(() => {})
        );
        return false;
      }
      return true;
    });
    
    // Wait for any pending fetches
    if (pendingPromises.length > 0) {
      await Promise.all(pendingPromises);
    }
    
    if (uncachedUIDs.length === 0) {
      return results;
    }
    
    try {
      const response = await fetch('/api/images/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopInstanceUIDs: uncachedUIDs }),
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Batch fetch failed: ${response.status}`);
      }
      
      const batchData = await response.json();
      
      // Process batch results in parallel
      await Promise.all(Object.entries(batchData).map(async ([uid, result]: [string, any]) => {
        if (result.data) {
          // Convert base64 back to ArrayBuffer
          const binaryString = atob(result.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const imageData = await parseDicomImage(bytes.buffer);
          if (imageData) {
            // Update local cache
            imageCacheRef.current.set(uid, imageData);
            
            // Update shared cache
            if (props.pixelDataCache?.current) {
              props.pixelDataCache.current.set(uid, imageData);
            }

            results.set(uid, imageData);
            
            // Populate global cache for MPR
            if (!((window as any).__WV_CACHE__)) {
              (window as any).__WV_CACHE__ = new Map();
            }
            (window as any).__WV_CACHE__.set(uid, {
              data: imageData.data,
              width: imageData.width,
              height: imageData.height
            });
          }
        }
      }));
      
      // Add cached images to results
      sopInstanceUIDs.forEach(uid => {
        const cached = imageCacheRef.current.get(uid);
        if (cached && !results.has(uid)) {
          results.set(uid, cached);
          
          // Populate global cache for MPR
          if (!((window as any).__WV_CACHE__)) {
            (window as any).__WV_CACHE__ = new Map();
          }
          if (!((window as any).__WV_CACHE__).has(uid)) {
            (window as any).__WV_CACHE__.set(uid, {
              data: cached.data,
              width: cached.width,
              height: cached.height
            });
          }
        }
      });
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Batch fetch error:', error);
      }
      throw error;
    }
    
    return results;
  };

  // OHIF 3.10-style background prefetch using ImageLoadPoolManager
  // This provides priority queue, center-out loading, and requestIdleCallback integration
  const stackPrefetchRef = useRef<ReturnType<typeof createStackContextPrefetch> | null>(null);
  
  const startBackgroundPrefetch = async (imageList: any[]) => {
    if (!imageList || imageList.length === 0 || prefetchCompleteRef.current) {
      return;
    }

    console.log(`🚀 OHIF-style background prefetch starting for ${imageList.length} images (using ImageLoadPoolManager)`);
    
    const poolManager = getImageLoadPoolManager({
      maxConcurrent: 6,        // Browser connection limit
      prefetchRadius: 10,      // Slices to prioritize around current
      batchSize: 50,           // Match server batch size
    });
    
    setPrefetchProgress({ loaded: imageCacheRef.current.size, total: imageList.length });
    
    // Create fetch factory for the pool manager
    const fetchFactory = (sopInstanceUID: string) => async () => {
      // Check cache first
      if (imageCacheRef.current.has(sopInstanceUID)) {
        return imageCacheRef.current.get(sopInstanceUID);
      }
      
      // Fetch the image
      const result = await fetchAndParseImage(sopInstanceUID, seriesAbortRef.current?.signal);
      return result;
    };
    
    // Progress tracking
    let loadedCount = imageCacheRef.current.size;
    const onProgress = (loaded: number, total: number) => {
      loadedCount = loaded + imageCacheRef.current.size;
      setPrefetchProgress({ loaded: loadedCount, total: imageList.length });
      
      // Check completion threshold (95%)
      if (loadedCount / imageList.length >= 0.95) {
        prefetchCompleteRef.current = true;
        console.log(`✅ Background prefetch sufficient: ${loadedCount}/${imageList.length} images`);
        setPrefetchProgress({ loaded: 0, total: 0 }); // Hide progress
      }
    };
    
    // Create stack context prefetch helper
    stackPrefetchRef.current = createStackContextPrefetch(
      imageList.map((img, idx) => ({ sopInstanceUID: img.sopInstanceUID, index: idx })),
      fetchFactory,
      { radius: 10, onProgress }
    );
    
    // Initialize prefetching starting from current index
    stackPrefetchRef.current.initialize(currentIndex);
    
    // Auto-hide progress after timeout
    setTimeout(() => {
      if (!prefetchCompleteRef.current) {
        console.log('⏱️ Background prefetch timeout - hiding progress indicator');
        prefetchCompleteRef.current = true;
        setPrefetchProgress({ loaded: 0, total: 0 });
      }
    }, 30000);
  };

  const preloadAllImages = async (imageList: any[]) => {
    console.log("Starting to preload all images with batch fetching...");
    if (!imageList || imageList.length === 0) {
      console.warn("No images to preload");
      setIsPreloading(false);
      return;
    }
    setIsPreloading(true);
    
    const BATCH_SIZE = 50; // Increased batch size for faster loading
    let loadedCount = 0;
    
    // Prioritize loading images near current index first
    const prioritizedList = [...imageList];
    const currentIdx = currentIndex;
    
    // Sort by distance from current index
    prioritizedList.sort((a, b) => {
      const aIdx = imageList.indexOf(a);
      const bIdx = imageList.indexOf(b);
      const aDist = Math.abs(aIdx - currentIdx);
      const bDist = Math.abs(bIdx - currentIdx);
      return aDist - bDist;
    });
    
    // Process images in batches
    for (let i = 0; i < prioritizedList.length; i += BATCH_SIZE) {
      const batch = prioritizedList.slice(i, i + BATCH_SIZE);
      const batchUIDs = batch.map(img => img.sopInstanceUID);
      
      try {
        // Fetch entire batch at once
        const batchResults = await fetchBatchImages(batchUIDs, seriesAbortRef.current?.signal);
        loadedCount += batchResults.size;
        
        console.log(`Batch loaded ${batchResults.size} images. Total: ${loadedCount}/${imageList.length} (${Math.round(loadedCount/imageList.length * 100)}%)`);
        
        // Check if current image was in this batch
        const currentImageUID = imageList[currentIndex]?.sopInstanceUID;
        if (currentImageUID && batchResults.has(currentImageUID)) {
          await displayCurrentImage();
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Batch loading aborted (user switched series)');
          break;
        }
        console.error(`Failed to load batch:`, error);
        
        // Fallback to individual loading for failed batch
        for (const image of batch) {
          try {
            await fetchAndParseImage(image.sopInstanceUID, seriesAbortRef.current?.signal);
            loadedCount++;
          } catch (individualError: any) {
            if (individualError.name !== 'AbortError') {
              console.error(`Failed to load individual image:`, individualError);
            }
          }
        }
      }
    }
    
    setIsPreloading(false);
    console.log(
      `Batch loading complete: ${imageCacheRef.current.size}/${imageList.length} images cached`,
    );
  };

  const loadImageMetadata = async (imageId: number) => {
    try {
      const response = await fetch(`/api/images/${imageId}/metadata`);
      if (response.ok) {
        const metadata = await response.json();
        console.log("Image metadata:", metadata);
        setImageMetadata(metadata);
        
        // Notify parent component of metadata change
        if (onImageMetadataChange) {
          onImageMetadataChange(metadata);
        }

        // Frame of Reference UIDs are verified during data import
      }
    } catch (error) {
      console.error("Failed to load image metadata:", error);
    }
  };

  // Helper function to create MPR volume from axial slices
  const createMPRVolume = (images: any[]) => {
    if (!images || images.length === 0) return null;
    
    // For a complete MPR implementation, we would:
    // 1. Sort images by Z position
    // 2. Create a 3D volume array
    // 3. Fill voxels with pixel data from each slice
    // 4. Handle spacing between slices
    
    // For now, return sorted images
    return images.sort((a, b) => {
      const zA = parseFloat(a.parsedZPosition || a.parsedSliceLocation || '0');
      const zB = parseFloat(b.parsedZPosition || b.parsedSliceLocation || '0');
      return zA - zB;
    });
  };

  // Helper function to reconstruct MPR slice from volume
  const reconstructMPRSlice = async (orientation: string, sliceIndex: number) => {
    if (!images || images.length === 0) return null;
    
    if (orientation === 'axial') {
      // Standard axial view
      return images[sliceIndex];
    }
    
    // Check cache first
    const cacheKey = `${orientation}-${sliceIndex}`;
    const cached = mprCacheRef.current.get(cacheKey);
    if (cached) {
      console.log(`Using cached MPR data for ${cacheKey}`);
      return cached;
    }
    
    // For MPR reconstruction, we need all images loaded with pixel data
    // Sort images by Z position
    const sortedImages = [...images].sort((a, b) => {
      const zA = parseFloat(a.parsedZPosition || a.parsedSliceLocation || '0');
      const zB = parseFloat(b.parsedZPosition || b.parsedSliceLocation || '0');
      return zA - zB;
    });
    
    // Get dimensions from first image - need to load pixel data from cache
    const firstImageData = imageCacheRef.current.get(sortedImages[0].sopInstanceUID);
    if (!firstImageData) {
      console.error("First image not in cache for MPR reconstruction");
      return null;
    }
    
    const width = firstImageData.width || 512;
    const height = firstImageData.height || 512;
    const numSlices = sortedImages.length;
    
    // Get pixel spacing and slice thickness for proper aspect ratio
    const firstImage = sortedImages[0];
    const pixelSpacing = firstImage.pixelSpacing?.split('\\').map(parseFloat) || [1, 1];
    const sliceThickness = parseFloat(firstImage.sliceThickness || '2.0');
    
    console.log(`MPR reconstruction: ${orientation}, slice ${sliceIndex}, volume ${width}x${height}x${numSlices}`);
    console.log(`Pixel spacing: ${pixelSpacing[0]}x${pixelSpacing[1]}, slice thickness: ${sliceThickness}`);
    
    // Create synthetic image for MPR view with proper dimensions
    let mprWidth, mprHeight;
    if (orientation === 'sagittal') {
      mprWidth = height; // Y dimension of axial
      mprHeight = numSlices; // Z dimension
    } else { // coronal
      mprWidth = width; // X dimension of axial
      mprHeight = numSlices; // Z dimension
    }
    
    const mprImage = {
      ...sortedImages[0],
      sopInstanceUID: `mpr-${orientation}-${sliceIndex}`,
      pixelData: new Uint16Array(mprWidth * mprHeight),
      columns: mprWidth,
      rows: mprHeight,
      orientation: orientation,
      // Update pixel spacing for MPR views
      pixelSpacing: orientation === 'sagittal' 
        ? `${pixelSpacing[1]}\\${sliceThickness}` // Y spacing x slice thickness
        : `${pixelSpacing[0]}\\${sliceThickness}` // X spacing x slice thickness
    };
    
    let pixelsSet = 0;
    
    // For sagittal: slice through X axis (left-right view)
    // For coronal: slice through Y axis (front-back view)
    if (orientation === 'sagittal') {
      // Sagittal view: fix X coordinate, vary Y and Z
      const x = Math.min(sliceIndex, width - 1);
      
      // Fill pixel data by sampling from axial slices
      // Reverse Z-axis to fix upside-down orientation (following OHIF convention)
      for (let z = 0; z < numSlices; z++) {
        const axialZ = numSlices - 1 - z; // Reverse Z for proper anatomical orientation
        const axialImage = sortedImages[axialZ];
        const axialImageData = imageCacheRef.current.get(axialImage.sopInstanceUID);
        
        if (axialImageData && axialImageData.data) {
          for (let y = 0; y < height; y++) {
            const srcIndex = y * width + x;
            const dstIndex = z * mprWidth + y;
            // Convert Float32 to Uint16, handling negative values properly
            const floatValue = axialImageData.data[srcIndex] || 0;
            const pixelValue = Math.max(0, Math.min(65535, Math.round(floatValue)));
            mprImage.pixelData[dstIndex] = pixelValue;
            if (pixelValue > 0) pixelsSet++;
          }
        }
      }
    } else if (orientation === 'coronal') {
      // Coronal view: fix Y coordinate, vary X and Z
      const y = Math.min(sliceIndex, height - 1);
      
      // Fill pixel data by sampling from axial slices
      // Reverse Z-axis to fix upside-down orientation (following OHIF convention)
      for (let z = 0; z < numSlices; z++) {
        const axialZ = numSlices - 1 - z; // Reverse Z for proper anatomical orientation
        const axialImage = sortedImages[axialZ];
        const axialImageData = imageCacheRef.current.get(axialImage.sopInstanceUID);
        
        if (axialImageData && axialImageData.data) {
          for (let x = 0; x < width; x++) {
            const srcIndex = y * width + x;
            const dstIndex = z * mprWidth + x;
            // Convert Float32 to Uint16, handling negative values properly
            const floatValue = axialImageData.data[srcIndex] || 0;
            const pixelValue = Math.max(0, Math.min(65535, Math.round(floatValue)));
            mprImage.pixelData[dstIndex] = pixelValue;
            if (pixelValue > 0) pixelsSet++;
          }
        }
      }
    }
    
    console.log(`MPR ${orientation}: ${pixelsSet} pixels set out of ${mprWidth * mprHeight}`);
    
    // Cache the result for performance
    mprCacheRef.current.set(cacheKey, mprImage);
    
    return mprImage;
  };

  // Helper function to get slice for specific orientation
  const getMPRSlice = (orientation: string, sliceIndex: number) => {
    if (!images || images.length === 0) return null;
    
    if (orientation === 'axial') {
      // Standard axial view
      return images[sliceIndex];
    }
    
    // For sagittal and coronal, return a promise for async reconstruction
    return reconstructMPRSlice(orientation, sliceIndex);
  };

  const renderMPRCanvas = async (
    canvas: HTMLCanvasElement, 
    targetOrientation: 'sagittal' | 'coronal',
    currentSliceIndex: number,
    windowWidth: number,
    windowCenter: number
  ) => {
    if (!canvas || images.length === 0 || !images[0]) {
      console.warn(`MPR render skipped - no canvas or images`);
      return;
    }
    
    console.log(`MPR renderMPRCanvas called for ${targetOrientation} at index ${currentSliceIndex}, canvas: ${canvas.width}x${canvas.height}`);
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error(`MPR render failed - no 2D context for ${targetOrientation}`);
      return;
    }

    try {
      // Clear canvas first
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Enable smooth scaling for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      console.log(`Reconstructing ${targetOrientation} slice at index ${currentSliceIndex}`);
      const reconstructedImage = await reconstructMPRSlice(targetOrientation, currentSliceIndex);
      
      if (!reconstructedImage || !reconstructedImage.pixelData) {
        console.error(`No reconstructed image or pixel data for ${targetOrientation}`);
        return;
      }
      
      // Get pixel data from reconstructed image
      const pixelData = reconstructedImage.pixelData;
      
      // Fix typescript error and improve performance
      const pixelArray = pixelData as Uint16Array;
      let minVal = 65535, maxVal = 0;
      let hasData = false;
      for (let i = 0; i < pixelArray.length; i++) {
        const val = pixelArray[i];
        if (val > 0) {
          hasData = true;
          minVal = Math.min(minVal, val);
          maxVal = Math.max(maxVal, val);
        }
      }
      
      if (!hasData) {
        console.warn(`MPR ${targetOrientation} has no pixel data!`);
        minVal = 0;
      }
      
      console.log(`MPR pixel data stats: min=${minVal}, max=${maxVal}, hasData=${hasData}`);
      
      // Use larger canvas size for better resolution
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const imageData = ctx.createImageData(canvasWidth, canvasHeight);
      const data = imageData.data;
      
      // Get proper dimensions
      const sourceWidth = reconstructedImage.columns || 512;
      const sourceHeight = reconstructedImage.rows || 512;
      
      // For sagittal: width=imageHeight (Y), height=numSlices (Z)
      // For coronal: width=imageWidth (X), height=numSlices (Z)
      let displayWidth = sourceWidth;
      let displayHeight = sourceHeight;
      
      if (targetOrientation === 'sagittal') {
        // Sagittal view shows Y (horizontal) x Z (vertical)
        displayWidth = sourceHeight; // Y dimension (512)
        displayHeight = images.length; // Z dimension (number of slices)
      } else if (targetOrientation === 'coronal') {
        // Coronal view shows X (horizontal) x Z (vertical)
        displayWidth = sourceWidth; // X dimension (512)
        displayHeight = images.length; // Z dimension (number of slices)
      }
      
      // Calculate scale to fit canvas while preserving physical aspect ratio
      // Both sagittal and coronal should have the same display height
      
      // Use default pixel spacing for aspect ratio calculation
      const pixelSpacingX = 0.9765625;
      const pixelSpacingY = 0.9765625;
      const sliceThickness = 2.0; // Typical slice thickness for CT
      
      // Calculate physical dimensions in mm
      let physicalWidth, physicalHeight;
      
      if (targetOrientation === 'sagittal') {
        // Sagittal: Y (horizontal) x Z (vertical)
        physicalWidth = displayWidth * pixelSpacingY;
        physicalHeight = displayHeight * sliceThickness;
      } else if (targetOrientation === 'coronal') {
        // Coronal: X (horizontal) x Z (vertical)
        physicalWidth = displayWidth * pixelSpacingX;
        physicalHeight = displayHeight * sliceThickness;
      } else {
        physicalWidth = displayWidth;
        physicalHeight = displayHeight;
      }
      
      // Calculate scale to fill the canvas properly while maintaining aspect ratio
      const aspectRatio = physicalWidth / physicalHeight;
      let scaledWidth, scaledHeight, scale;
      
      // For sagittal/coronal views, prioritize filling the height (superior-inferior dimension)
      // This makes the body anatomy display properly in a tall, rectangular format
      if (aspectRatio < (canvasWidth / canvasHeight)) {
        // Height-constrained (typical for body scans)
        scaledHeight = canvasHeight;
        scaledWidth = scaledHeight * aspectRatio;
        scale = canvasHeight / displayHeight;
      } else {
        // Width-constrained
        scaledWidth = canvasWidth;
        scaledHeight = scaledWidth / aspectRatio;
        scale = canvasWidth / displayWidth;
      }
      
      // Center the image
      const offsetX = (canvasWidth - scaledWidth) / 2;
      const offsetY = (canvasHeight - scaledHeight) / 2;
      
      // Clear the data array first (ensure black background)
      data.fill(0);
      
      // Use the same window/level settings as the axial view
      const min = windowCenter - windowWidth / 2;
      const max = windowCenter + windowWidth / 2;
      
      console.log(`MPR ${targetOrientation} using window/level: W=${windowWidth}, C=${windowCenter}`);
      console.log(`MPR canvas size: ${canvasWidth}x${canvasHeight}, display size: ${displayWidth}x${displayHeight}, scale: ${scale}`);
      
      // Render pixels with proper scaling and aspect ratio
      for (let y = 0; y < canvasHeight; y++) {
        for (let x = 0; x < canvasWidth; x++) {
          // Check if we're within the scaled image bounds
          if (x >= offsetX && x < offsetX + scaledWidth && 
              y >= offsetY && y < offsetY + scaledHeight) {
            
            // Calculate source coordinates
            const sourceX = Math.floor(((x - offsetX) / scale));
            const sourceY = Math.floor(((y - offsetY) / scale));
            
            // Ensure source coords are within bounds
            if (sourceX >= 0 && sourceX < displayWidth && 
                sourceY >= 0 && sourceY < displayHeight) {
              
              const sourceIndex = sourceY * sourceWidth + sourceX;
              const pixelValue = pixelArray[sourceIndex] || 0;
              
              // Apply window/level
              let normalizedValue;
              if (pixelValue <= min) {
                normalizedValue = 0;
              } else if (pixelValue >= max) {
                normalizedValue = 255;
              } else {
                normalizedValue = Math.round(((pixelValue - min) / windowWidth) * 255);
              }
              
              const destIndex = (y * canvasWidth + x) * 4;
              data[destIndex] = normalizedValue;     // R
              data[destIndex + 1] = normalizedValue; // G
              data[destIndex + 2] = normalizedValue; // B
              data[destIndex + 3] = 255;            // A
            }
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // Draw crosshairs on MPR views
      if (crosshairPos) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        
        if (targetOrientation === 'sagittal') {
          // Draw vertical line at coronal position and horizontal line at axial position
          // Vertical line corresponds to coronal slice position
          const coronalPos = Math.floor(crosshairPos.y);
          const lineX = offsetX + (coronalPos * scale);
          
          ctx.beginPath();
          ctx.moveTo(lineX, 0);
          ctx.lineTo(lineX, canvasHeight);
          ctx.stroke();
          
          // Horizontal line corresponds to axial slice position (inverted Z)
          const axialPos = displayHeight - 1 - currentIndex;
          const lineY = offsetY + (axialPos * scale);
          
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(canvasWidth, lineY);
          ctx.stroke();
          
        } else if (targetOrientation === 'coronal') {
          // Draw vertical line at sagittal position and horizontal line at axial position
          // Vertical line corresponds to sagittal slice position
          const sagittalPos = Math.floor(crosshairPos.x);
          const lineX = offsetX + (sagittalPos * scale);
          
          ctx.beginPath();
          ctx.moveTo(lineX, 0);
          ctx.lineTo(lineX, canvasHeight);
          ctx.stroke();
          
          // Horizontal line corresponds to axial slice position (inverted Z)
          const axialPos = displayHeight - 1 - currentIndex;
          const lineY = offsetY + (axialPos * scale);
          
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(canvasWidth, lineY);
          ctx.stroke();
        }
        
        ctx.restore();
      }
      
      console.log(`✓ ${targetOrientation} MPR rendered`);
    } catch (error) {
      console.error(`Error rendering ${targetOrientation} MPR:`, error);
    }
  };

  const displayCurrentImage = async () => {
    if (!canvasRef.current || images.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      // OPTIMIZED: Use ref for index during rapid scrolling to avoid stale closures
      const activeIndex = currentIndexRef.current;
      
      // Get the appropriate slice based on orientation
      let currentImage;
      if (orientation === 'axial') {
        // Ensure currentIndex is valid
        const safeIndex = Math.max(0, Math.min(activeIndex, images.length - 1));
        currentImage = images[safeIndex];
      } else {
        // For sagittal/coronal, use MPR reconstruction
        const mprSlice = await getMPRSlice(orientation, activeIndex);
        currentImage = mprSlice;
      }
      
      if (!currentImage) {
        console.error("No image available for orientation:", orientation);
        setError("Unable to display image. Please try refreshing.");
        return;
      }
      const cacheKey = currentImage.sopInstanceUID;

      // Only clear canvas when NOT scrolling to prevent flashing
      // During scrolling, the new image will draw over the old one anyway
      // The black border areas are only visible with certain zoom/pan states
      if (!isScrollingRef.current) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      let imageData;
      
      // Check if this is an MPR reconstructed image (synthetic)
      if (orientation !== 'axial' && currentImage.pixelData) {
        // For MPR slices, use the reconstructed pixel data directly
        imageData = {
          width: currentImage.columns || currentImage.width || 512,
          height: currentImage.rows || currentImage.height || 512,
          data: currentImage.pixelData
        };
      } else {
        // For axial slices, use the cache
        imageData = imageCacheRef.current.get(cacheKey);

        if (!imageData || !imageData.data) {
          // Try to reload the image if it's not in cache
          console.warn(
            "Image not in cache, attempting to reload:",
            cacheKey,
          );
          
          try {
            // Use single fetch/parse function to avoid double fetching
            const reloadedImageData = await fetchAndParseImage(currentImage.sopInstanceUID);
            
            if (reloadedImageData) {
              imageData = reloadedImageData;
              console.log("Successfully reloaded image:", cacheKey);
            } else {
              throw new Error("Failed to parse reloaded image");
            }
          } catch (reloadError) {
            console.error("Failed to reload image:", reloadError);
            throw new Error(`Image not available: ${reloadError instanceof Error ? reloadError.message : 'Unknown error'}`);
          }
        }
      }

      // NOTE: Do NOT resize the canvas here; changing canvas.width/height clears context and is very expensive.
      // The canvas intrinsic size is set by the JSX attributes. Interactions should only redraw.
      await render16BitImage(ctx, cacheKey, imageData.data, imageData.width, imageData.height);
      
      // Render secondary image overlay for fusion if available
      if (secondarySeriesId) {
        // Fusion overlay rendering
        try {
          await renderFusionOverlayNew(ctx, currentImage);
        } catch (fusionError: any) {
          console.error("🐟 FUSION: ERROR in renderFusionOverlayNew:", fusionError);
          // Continue without fusion rather than failing entire image display
        }
      } else {
        if (DEBUG) console.log('🐟 FUSION: No secondarySeriesId in main render');
      }

      // Render RT structures and crosshairs on separate canvas above fusion
      const contoursCanvas = contoursOverlayCanvasRef.current;
      if (contoursCanvas) {
        const contoursCtx = contoursCanvas.getContext('2d');
        if (contoursCtx) {
          // Clear the contours overlay canvas
          contoursCtx.clearRect(0, 0, contoursCanvas.width, contoursCanvas.height);
          
          // Draw RT structures if available
          if (rtStructures) {
            try {
              // Pass currentImage with its metadata attached
              const imageWithMetadata = {
                ...currentImage,
                imageMetadata: imageMetadata // Use the actual imageMetadata state variable
              };
              renderRTStructures(contoursCtx, contoursCanvas, imageWithMetadata);
            } catch (rtError) {
              console.warn("Error drawing RT structures:", rtError);
              // Don't let RT structure errors prevent image display
            }
          }
          
          // Draw crosshairs on contours overlay if in axial view
          if (orientation === 'axial') {
            // Convert crosshair pixel coordinates to canvas coordinates
            const imageWidth = currentImage.columns || currentImage.width || 512;
            const imageHeight = currentImage.rows || currentImage.height || 512;
            
            // Calculate scale with zoom factor (same as render16BitImage)
            const baseScale = Math.min(canvas.width / imageWidth, canvas.height / imageHeight);
            const totalScale = baseScale * zoom;
            const scaledWidth = imageWidth * totalScale;
            const scaledHeight = imageHeight * totalScale;
            
            // Center position with pan offset
            const imageX = (canvas.width - scaledWidth) / 2 + panX;
            const imageY = (canvas.height - scaledHeight) / 2 + panY;
            
            // Convert crosshair pixel position to canvas position
            const crosshairCanvasX = imageX + (crosshairPos.x * totalScale);
            const crosshairCanvasY = imageY + (crosshairPos.y * totalScale);
            
            // Draw crosshairs on contours overlay
            contoursCtx.save();
            contoursCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)'; // Cyan color
            contoursCtx.lineWidth = 1;
            contoursCtx.setLineDash([5, 5]); // Dashed line
            
            // Vertical line
            contoursCtx.beginPath();
            contoursCtx.moveTo(crosshairCanvasX, 0);
            contoursCtx.lineTo(crosshairCanvasX, canvas.height);
            contoursCtx.stroke();
            
            // Horizontal line
            contoursCtx.beginPath();
            contoursCtx.moveTo(0, crosshairCanvasY);
            contoursCtx.lineTo(canvas.width, crosshairCanvasY);
            contoursCtx.stroke();
            
            // Draw center point
            contoursCtx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            contoursCtx.beginPath();
            contoursCtx.arc(crosshairCanvasX, crosshairCanvasY, 3, 0, 2 * Math.PI);
            contoursCtx.fill();
            
            contoursCtx.restore();
          }
        }
      }
      
      // Draw dose overlay (OHIF pattern: render all overlays in same render pass)
      // This ensures dose updates correctly during scrolling since we use currentIndexRef
      if (doseSeriesId && doseVisible) {
        try {
          drawDoseOverlay();
        } catch (doseError) {
          console.warn("Error drawing dose overlay:", doseError);
        }
      }
      
      // Render MPR views if canvases are available
      if (orientation === 'axial' && sagittalCanvasRef.current && coronalCanvasRef.current) {
        try {
          // Use crosshair position for MPR slice indices
          // Ensure crosshair is within bounds
          const sagittalSliceIndex = Math.max(0, Math.min(crosshairPos.x, (images[0]?.columns || 512) - 1));
          const coronalSliceIndex = Math.max(0, Math.min(crosshairPos.y, (images[0]?.rows || 512) - 1));
          
          console.log(`Rendering MPR views - Sagittal: ${sagittalSliceIndex}, Coronal: ${coronalSliceIndex}, W=${currentWindowLevel.width}, C=${currentWindowLevel.center}`);
          
          // Render MPR views asynchronously with same window/level as axial
          await Promise.all([
            renderMPRCanvas(sagittalCanvasRef.current, 'sagittal', sagittalSliceIndex, currentWindowLevel.width, currentWindowLevel.center),
            renderMPRCanvas(coronalCanvasRef.current, 'coronal', coronalSliceIndex, currentWindowLevel.width, currentWindowLevel.center)
          ]);
        } catch (mprError) {
          console.warn("Error rendering MPR views:", mprError);
        }
      }
    } catch (error: any) {
      console.error("Error displaying image:", error);
      console.error("Error details:", error.message, error.stack);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "red";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        "Error loading DICOM",
        canvas.width / 2,
        canvas.height / 2 - 10,
      );
      ctx.fillText(error.message || "Unknown error", canvas.width / 2, canvas.height / 2 + 10);
    }
  };

  // ============================================================================
  // FAST CPU RENDER PATH (major perf win)
  // - Cache the “base” grayscale render per-slice + window/level (ImageBitmap if available)
  // - During pan/zoom, just drawImage() the cached base
  // ============================================================================
  const BASE_BITMAP_CACHE_LIMIT = 48;
  const baseBitmapCacheRef = useRef<
    Map<string, { bitmap: ImageBitmap | HTMLCanvasElement; lastUsed: number }>
  >(new Map());
  const baseBitmapGenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseBitmapGenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const reusableRgbaRef = useRef<{ w: number; h: number; rgba: Uint8ClampedArray; imageData: ImageData } | null>(null);

  const evictOldestBaseBitmaps = useCallback(() => {
    const cache = baseBitmapCacheRef.current;
    if (cache.size <= BASE_BITMAP_CACHE_LIMIT) return;

    const entries = Array.from(cache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const toRemove = entries.slice(0, Math.max(0, cache.size - BASE_BITMAP_CACHE_LIMIT));
    for (const [key, entry] of toRemove) {
      const bmp: any = entry.bitmap;
      if (bmp && typeof bmp.close === 'function') {
        try { bmp.close(); } catch { /* ignore */ }
      }
      cache.delete(key);
    }
  }, []);

  const getReusableImageData = useCallback((w: number, h: number) => {
    const existing = reusableRgbaRef.current;
    if (existing && existing.w === w && existing.h === h) return existing;

    const rgba = new Uint8ClampedArray(w * h * 4);
    const imageData = new ImageData(rgba, w, h);
    const next = { w, h, rgba, imageData };
    reusableRgbaRef.current = next;
    return next;
  }, []);

  const getOrCreateBaseBitmap = useCallback(async (
    baseKey: string,
    pixelArray: Float32Array,
    width: number,
    height: number,
    lut: Uint8Array,
  ): Promise<ImageBitmap | HTMLCanvasElement | null> => {
    const cache = baseBitmapCacheRef.current;
    const cached = cache.get(baseKey);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.bitmap;
    }

    if (!baseBitmapGenCanvasRef.current) {
      baseBitmapGenCanvasRef.current = document.createElement('canvas');
    }
    const genCanvas = baseBitmapGenCanvasRef.current;
    if (genCanvas.width !== width || genCanvas.height !== height) {
      genCanvas.width = width;
      genCanvas.height = height;
      baseBitmapGenCtxRef.current = genCanvas.getContext('2d');
    }
    const genCtx = baseBitmapGenCtxRef.current || genCanvas.getContext('2d');
    if (!genCtx) return null;
    baseBitmapGenCtxRef.current = genCtx;

    const { rgba, imageData } = getReusableImageData(width, height);
    const n = pixelArray.length;
    for (let i = 0; i < n; i++) {
      let pv = (pixelArray[i] + 32768.5) | 0;
      if (pv < 0) pv = 0;
      else if (pv > 65535) pv = 65535;
      const gray = lut[pv];
      const j = i << 2;
      rgba[j] = gray;
      rgba[j + 1] = gray;
      rgba[j + 2] = gray;
      rgba[j + 3] = 255;
    }
    genCtx.putImageData(imageData, 0, 0);

    let bitmap: ImageBitmap | HTMLCanvasElement;
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(genCanvas);
      } catch {
        // Fall back to copying the generator canvas into a standalone canvas
        // (so cache entries don't all point at the same mutable generator canvas).
        const copy = document.createElement('canvas');
        copy.width = width;
        copy.height = height;
        const copyCtx = copy.getContext('2d');
        copyCtx?.drawImage(genCanvas, 0, 0);
        bitmap = copy;
      }
    } else {
      const copy = document.createElement('canvas');
      copy.width = width;
      copy.height = height;
      const copyCtx = copy.getContext('2d');
      copyCtx?.drawImage(genCanvas, 0, 0);
      bitmap = copy;
    }

    cache.set(baseKey, { bitmap, lastUsed: performance.now() });
    evictOldestBaseBitmaps();
    return bitmap;
  }, [evictOldestBaseBitmaps, getReusableImageData]);

  const render16BitImage = async (
    ctx: CanvasRenderingContext2D,
    sopInstanceUID: string,
    pixelArray: Float32Array,
    width: number,
    height: number,
  ) => {
    // Get rescale parameters for proper HU conversion
    const { slope, intercept } = getRescaleParams(imageMetadata);

    // Apply window/level settings
    const { width: windowWidth, center: windowCenter } = currentWindowLevel;
    const min = windowCenter - windowWidth / 2;
    const max = windowCenter + windowWidth / 2;
    
    // Create/update cached LUT if window/level changed
    const lutKey = `${windowWidth}-${windowCenter}-${slope}-${intercept}`;
    let lut: Uint8Array;
    
    if (cachedLUTRef.current?.key === lutKey) {
      lut = cachedLUTRef.current.lut;
    } else {
      // Build new LUT
      lut = new Uint8Array(65536);
      for (let i = 0; i < 65536; i++) {
        const hu = (i - 32768) * slope + intercept;
        let normalizedValue;
        if (hu <= min) {
          normalizedValue = 0;
        } else if (hu >= max) {
          normalizedValue = 255;
        } else {
          normalizedValue = ((hu - min) / windowWidth) * 255;
        }
        lut[i] = Math.max(0, Math.min(255, normalizedValue));
      }
      cachedLUTRef.current = { key: lutKey, lut };
    }

    const baseKey = `${sopInstanceUID}|${width}x${height}|${lutKey}`;
    const base = await getOrCreateBaseBitmap(baseKey, pixelArray, width, height, lut);
    if (!base) return;

    // Scale and draw to the main canvas with zoom and pan
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Calculate scale with zoom factor
    const baseScale = Math.min(canvasWidth / width, canvasHeight / height);
    const totalScale = baseScale * zoom;
    const scaledWidth = width * totalScale;
    const scaledHeight = height * totalScale;

    // Center the image on canvas with pan offset
    const x = (canvasWidth - scaledWidth) / 2 + panX;
    const y = (canvasHeight - scaledHeight) / 2 + panY;

    // Store CT transform for fusion overlay to use the same coordinate system
    ctTransform.current = {
      scale: totalScale,
      offsetX: x,
      offsetY: y,
      imageWidth: width,
      imageHeight: height
    };

    const smooth = !isScrollingRef.current;
    ctx.imageSmoothingEnabled = smooth;
    ctx.imageSmoothingQuality = smooth ? "high" : "low";
    ctx.drawImage(base as any, x, y, scaledWidth, scaledHeight);
  };

  const render8BitImage = (
    ctx: CanvasRenderingContext2D,
    pixelArray: Uint8Array,
    width: number,
    height: number,
  ) => {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < pixelArray.length; i++) {
      const gray = pixelArray[i];
      const pixelIndex = i * 4;
      data[pixelIndex] = gray; // R
      data[pixelIndex + 1] = gray; // G
      data[pixelIndex + 2] = gray; // B
      data[pixelIndex + 3] = 255; // A
    }

    ctx.putImageData(imageData, 0, 0);
  };
  
  // NOTE: We intentionally do NOT age-expire fusion cache entries anymore.
  // The previous short TTL caused fused overlays to disappear/reload, making switching feel laggy.
  // We cap memory via `FUSION_CACHE_MAX_ITEMS` in `pruneFuseboxCache()`.

  useEffect(() => {
    if (!secondarySeriesId) return;
    prefetchFusionSlices(currentIndex);
  }, [secondarySeriesId, selectedRegistrationId, currentIndex, prefetchFusionSlices]);

  // Background warm prefetch: progressively load fused slices so switching feels instant.
  // Runs only once fusion is "ready" for the selected secondary.
  useEffect(() => {
    if (!secondarySeriesId || !images.length) return;
    if (fusionManifestLoading) return;

    const status = fusionSecondaryStatuses?.get(secondarySeriesId);
    const manifestMatches = Number(fusionManifestPrimarySeriesId) === Number(seriesId);
    const localManifest = getFusionManifest(seriesId);
    const localReady = !!localManifest && localManifest.secondaries.some(
      (s) => s.secondarySeriesId === secondarySeriesId && s.status === 'ready'
    );
    if (status?.status !== 'ready' || !manifestMatches || !localReady) return;

    let cancelled = false;
    const primaryId = seriesId;
    const secondaryId = secondarySeriesId;
    const registrationId = selectedRegistrationId ?? null;

    // Center-out order from currentIndex
    const order: number[] = [];
    for (let d = 0; d < images.length; d++) {
      const a = currentIndex - d;
      const b = currentIndex + d;
      if (a >= 0) order.push(a);
      if (b !== a && b < images.length) order.push(b);
    }

    const MAX_CONCURRENT = 2;
    let inFlight = 0;
    let ptr = 0;

    const pump = () => {
      if (cancelled) return;
      if (isScrollingRef.current) {
        setTimeout(pump, 200);
        return;
      }

      while (!cancelled && inFlight < MAX_CONCURRENT && ptr < order.length) {
        const idx = order[ptr++];
        const img = images[idx];
        const sop = img?.sopInstanceUID;
        if (!sop) continue;

        const key = buildFuseboxCacheKey(sop, secondaryId, registrationId);
        if (fuseboxCacheRef.current.has(key) || fusionPrefetchSetRef.current.has(key)) continue;
        
        // Check global cache first (shared across viewports)
        const globalSlice = globalFusionCache.getSlice(primaryId, secondaryId, sop, registrationId);
        if (globalSlice) {
          // Found in global cache - convert and store locally
          const prepared = convertSliceToCanvas(globalSlice, globalSlice.secondaryModality ?? secondaryModality);
          if (prepared) {
            fuseboxCacheRef.current.set(key, { ...prepared, timestamp: Date.now() });
          }
          continue;
        }

        fusionPrefetchSetRef.current.add(key);
        inFlight++;

        (async () => {
          try {
            let slice: FuseboxSlice;
            const preferredPosition = parseImagePosition(img);
            try {
              slice = await getFusedSlice(primaryId, secondaryId, sop);
            } catch {
              const instNumber = Number(img.instanceNumber ?? img.metadata?.instanceNumber ?? NaN);
              const preferredIndex = Number.isFinite(instNumber) ? instNumber - 1 : idx;
              slice = await getFusedSliceSmart(
                primaryId,
                secondaryId,
                sop,
                Number.isFinite(instNumber) ? instNumber : null,
                preferredIndex,
                preferredPosition,
              );
            }

            if (cancelled) return;
            
            // Store in global cache for sharing across viewports
            globalFusionCache.addSlice(primaryId, secondaryId, sop, slice, registrationId);
            
            const prepared = convertSliceToCanvas(slice, secondaryModality);
            if (prepared) {
              fuseboxCacheRef.current.set(key, { ...prepared, timestamp: Date.now() });
              pruneFuseboxCache();
            }
          } catch {
            // Ignore warm errors; on-demand render will still attempt.
          } finally {
            fusionPrefetchSetRef.current.delete(key);
            inFlight--;

            if (!cancelled) {
              if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => pump(), { timeout: 1000 });
              } else {
                setTimeout(pump, 0);
              }
            }
          }
        })();
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => pump(), { timeout: 1000 });
    } else {
      setTimeout(pump, 0);
    }

    return () => {
      cancelled = true;
    };
  }, [
    secondarySeriesId,
    seriesId,
    selectedRegistrationId,
    images,
    currentIndex,
    fusionManifestLoading,
    fusionSecondaryStatuses,
    fusionManifestPrimarySeriesId,
    buildFuseboxCacheKey,
    convertSliceToCanvas,
    pruneFuseboxCache,
    secondaryModality,
  ]);

  useEffect(() => {
    if (secondarySeriesId) return;
    fusionPrefetchSetRef.current.clear();
  }, [secondarySeriesId]);

  const renderFusionOverlayNew = async (_ctx: CanvasRenderingContext2D, primaryImage: any) => {
    const requestToken = ++fusionRequestTokenRef.current;
    const ensureActive = () => requestToken === fusionRequestTokenRef.current;

    if (!secondarySeriesId || fusionOpacity === 0) {
      if (ensureActive()) {
        clearFusionOverlayCanvas();
        setFuseboxTransformSource(null);
      }
      return;
    }

    // During scrolling, we still show cached fusion data but skip network fetches.
    // This provides a smoother user experience in multi-viewport mode.
    const isScrolling = isScrollingRef.current;

    if (fusionManifestLoading) {
      // Gate rendering while the manifest is still loading
      if (ensureActive()) {
        fusionIssueRef.current = 'manifest-not-ready';
        setFuseboxTransformSource(null);
      }
      return;
    }

    const status = fusionSecondaryStatuses?.get(secondarySeriesId);
    // Normalize ID comparison to avoid string/number mismatch gating overlays forever
    const manifestMatches = Number(fusionManifestPrimarySeriesId) === Number(seriesId);
    const localManifest = getFusionManifest(seriesId);
    const localReady = !!localManifest && localManifest.secondaries.some((s) => s.secondarySeriesId === secondarySeriesId && s.status === 'ready');
    if (status?.status !== 'ready' || !manifestMatches || !localReady) {
      if (ensureActive()) {
        fusionIssueRef.current = 'manifest-not-ready';
        clearFusionOverlayCanvas();
        setFuseboxTransformSource(null);
      }
      return;
    }

    const hasRegistrationMatrix = Array.isArray(registrationMatrix) && registrationMatrix.length === 16;

    if (!primaryImage?.sopInstanceUID) {
      if (ensureActive()) {
        clearFusionOverlayCanvas();
        setFuseboxTransformSource(null);
      }
      return;
    }

    const transform = ctTransform.current;
    if (!transform) {
      clearFusionOverlayCanvas();
      return;
    }

    if (hasRegistrationMatrix) {
      missingMatrixLogRef.current = false;
    } else if (!missingMatrixLogRef.current) {
      pushFusionLog('Proceeding without client-side matrix; expecting helper output', {
        primary: seriesId,
        secondary: secondarySeriesId,
        registrationId: selectedRegistrationId ?? null,
      });
      missingMatrixLogRef.current = true;
    }

    const cacheKey = buildFuseboxCacheKey(
      primaryImage.sopInstanceUID,
      secondarySeriesId,
      selectedRegistrationId ?? null,
    );
    let cached = fuseboxCacheRef.current.get(cacheKey);

    // Check global fusion cache first (shared across all viewports)
    if (!cached) {
      const globalSlice = globalFusionCache.getSlice(
        seriesId,
        secondarySeriesId,
        primaryImage.sopInstanceUID,
        selectedRegistrationId ?? null
      );
      if (globalSlice) {
        // Found in global cache - convert to canvas and store locally
        const prepared = convertSliceToCanvas(globalSlice, globalSlice.secondaryModality ?? secondaryModality);
        if (prepared) {
          cached = { ...prepared, timestamp: Date.now() };
          fuseboxCacheRef.current.set(cacheKey, cached);
        }
      }
    }

    if (!cached) {
      // During scrolling, skip network fetches - just keep showing whatever overlay is there
      // This prevents blank frames during rapid scrolling
      if (isScrolling) {
        // Don't clear the overlay, don't fetch - just return and keep showing current overlay
        return;
      }
      
      try {
        // Try exact SOP match first; if not found, fall back by instance number or index
        let slice: FuseboxSlice;
        const preferredPosition = parseImagePosition(primaryImage);
        try {
          slice = await getFusedSlice(seriesId, secondarySeriesId, primaryImage.sopInstanceUID);
        } catch (e) {
          const instNumber = Number(primaryImage.instanceNumber ?? primaryImage.metadata?.instanceNumber ?? NaN);
          const index = Number.isFinite(instNumber) ? instNumber - 1 : currentIndex;
          slice = await getFusedSliceSmart(
            seriesId,
            secondarySeriesId,
            primaryImage.sopInstanceUID,
            Number.isFinite(instNumber) ? instNumber : null,
            index,
            preferredPosition,
          );
        }

        if (slice.registrationId && slice.registrationId !== selectedRegistrationId && ensureActive()) {
          setSelectedRegistrationId(slice.registrationId);
        }

        if (slice.secondaryModality && slice.secondaryModality !== secondaryModality && ensureActive()) {
          setSecondaryModality(slice.secondaryModality);
        }

        // Store in global cache for sharing across viewports
        globalFusionCache.addSlice(
          seriesId,
          secondarySeriesId,
          primaryImage.sopInstanceUID,
          slice,
          selectedRegistrationId ?? null
        );

        const prepared = convertSliceToCanvas(slice, secondaryModality);
        if (!prepared) {
          if (ensureActive()) {
            fusionIssueRef.current = 'overlay-canvas-error';
            clearFusionOverlayCanvas();
            setFuseboxTransformSource(null);
          }
          return;
        }
        cached = { ...prepared, timestamp: Date.now() };
        fuseboxCacheRef.current.set(cacheKey, cached);
        pruneFuseboxCache();
        if (!prepared.hasSignal) {
          pushFusionLog('Fused slice had no visible signal', {
            sop: primaryImage.sopInstanceUID,
            min: slice.min,
            max: slice.max,
          });
        }
      } catch (error) {
        if (ensureActive()) {
          console.error('Fused overlay load failed:', error);
          fusionIssueRef.current = 'fusebox-fetch-error';
          clearFusionOverlayCanvas();
          setFuseboxTransformSource(null);
        }
        return;
      }
    }

    if (!cached) {
      if (ensureActive()) {
        clearFusionOverlayCanvas();
        setFuseboxTransformSource(null);
      }
      return;
    }

    if (!cached.hasSignal) {
      if (ensureActive()) {
        fusionIssueRef.current = 'empty-fusebox-slice';
        clearFusionOverlayCanvas();
        setFuseboxTransformSource(cached.slice.transformSource ?? null);
      }
      return;
    }

    if (!ensureActive()) return;

    const source = cached.slice.transformSource ?? null;
    setFuseboxTransformSource(source);
    fusionIssueRef.current = null;

    updateFusionOverlayCanvas(cached.canvas, transform, cached.hasSignal);
    prefetchFusionSlices(currentIndex);
  };

  // Coordinate transformation functions for pen tool with CT transform applied
  // Using useCallback to ensure functions always use latest ctTransform value
  const worldToCanvas = useCallback((worldX: number, worldY: number, worldZ?: number): [number, number] => {
    if (!imageMetadata) return [0, 0];
    
    const [imagePositionX, imagePositionY] = imageMetadata.imagePosition.split("\\").map(parseFloat);
    const [rowSpacing, colSpacing] = imageMetadata.pixelSpacing.split("\\").map(parseFloat);
    
    // Convert world coordinates to raw pixel coordinates
    const pixelX = (worldX - imagePositionX) / colSpacing;
    const pixelY = (worldY - imagePositionY) / rowSpacing;
    
    // Apply CT transform to match the rendered canvas
    // Always get fresh ctTransform value to avoid stale closure
    const transform = ctTransform.current || { scale: 1, offsetX: 0, offsetY: 0 };
    const canvasX = (pixelX * transform.scale) + transform.offsetX;
    const canvasY = (pixelY * transform.scale) + transform.offsetY;
    
    return [canvasX, canvasY];
  }, [imageMetadata]); // Re-create when imageMetadata changes
  
  const canvasToWorld = useCallback((canvasX: number, canvasY: number): [number, number] => {
    if (!imageMetadata) return [0, 0];
    
    const [imagePositionX, imagePositionY] = imageMetadata.imagePosition.split("\\").map(parseFloat);
    const [rowSpacing, colSpacing] = imageMetadata.pixelSpacing.split("\\").map(parseFloat);
    
    // Apply inverse CT transform to get raw pixel coordinates
    // Always get fresh ctTransform value to avoid stale closure
    const transform = ctTransform.current || { scale: 1, offsetX: 0, offsetY: 0 };
    const pixelX = (canvasX - transform.offsetX) / transform.scale;
    const pixelY = (canvasY - transform.offsetY) / transform.scale;
    
    // Convert pixel coordinates to world coordinates
    const worldX = imagePositionX + (pixelX * colSpacing);
    const worldY = imagePositionY + (pixelY * rowSpacing);
    
    return [worldX, worldY];
  }, [imageMetadata]); // Re-create when imageMetadata changes

  const renderRTStructures = useCallback((
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    currentImage: any,
  ) => {
    // Always get the absolute latest rtStructures from ref for immediate updates
    const structuresRef = rtStructuresRef.current;
    if (!structuresRef || !currentImage) return;

    // FIXED: Get current slice position from actual DICOM metadata with fallbacks
    // Use ref-based index for performance during rapid scrolling
    let currentSlicePosition: number = currentIndexRef.current + 1; // Default fallback

    // Priority 1: Use parsed slice location from DICOM (check for null/undefined)
    if (
      currentImage.parsedSliceLocation !== undefined &&
      currentImage.parsedSliceLocation !== null
    ) {
      currentSlicePosition = currentImage.parsedSliceLocation;
    }
    // Priority 2: Use parsed Z position from DICOM (check for null/undefined)
    else if (
      currentImage.parsedZPosition !== undefined &&
      currentImage.parsedZPosition !== null
    ) {
      currentSlicePosition = currentImage.parsedZPosition;
    }
    // Priority 3: Extract from image metadata directly
    else if (currentImage.imageMetadata && currentImage.imageMetadata.sliceLocation !== undefined) {
      const parsed = parseFloat(currentImage.imageMetadata.sliceLocation);
      if (!isNaN(parsed)) {
        currentSlicePosition = parsed;
      }
    }
    // Priority 4: Extract Z from image position
    else if (currentImage.imageMetadata && currentImage.imageMetadata.imagePosition) {
      const imagePos = typeof currentImage.imageMetadata.imagePosition === 'string'
        ? currentImage.imageMetadata.imagePosition.split("\\")
        : currentImage.imageMetadata.imagePosition;
      if (imagePos && imagePos.length >= 3) {
        const parsed = parseFloat(imagePos[2]);
        if (!isNaN(parsed)) {
          currentSlicePosition = parsed;
        }
      }
    }

    // Note: currentSlicePosition already has a fallback initialization, no need for additional check

    // CRITICAL DEBUG: Disabled for performance - was causing excessive console spam
    // Slice position calculation debug logs removed
    // if (DEBUG) console.log(
    //   `📋 Available structures:`,
    //   structuresRef?.structures?.map((s: any) => s.structureName) || [],
    // );

    // Get all RT structure Z positions to check coordinate space
    const allRTZPositions: number[] = [];
    if (structuresRef?.structures) {
      structuresRef.structures.forEach((structure: any) => {
        structure.contours.forEach((contour: any) => {
          allRTZPositions.push(contour.slicePosition);
        });
      });
    }

    if (allRTZPositions.length > 0) {
      const rtZMin = Math.min(...allRTZPositions);
      const rtZMax = Math.max(...allRTZPositions);
      if (DEBUG) console.log(
        `🎯 RT coordinate range: ${rtZMin.toFixed(1)} to ${rtZMax.toFixed(1)}mm`,
      );
      if (DEBUG) console.log(
        `🎯 Current CT slice ${currentSlicePosition}mm should show structures at RT positions near this value`,
      );
    }

    // Save context state
    ctx.save();

    // Apply global contour settings
    const lineWidth = contourSettings?.width || 3;
    const fillOpacity = (contourSettings?.opacity || 30) / 100;

    // Set line width
    ctx.lineWidth = lineWidth;
    // Keep stroke at full opacity - only fill should be affected by opacity setting
    ctx.globalAlpha = 1;

    if (structuresRef?.structures) {
      structuresRef.structures.forEach((structure: any) => {
      // Check if this structure is visible or if it's selected for editing/selection
      const isVisible = structureVisibility.get(structure.roiNumber);
      const isSelectedForEdit = selectedForEdit === structure.roiNumber;
      const isSelectedStructure = selectedStructures?.has(structure.roiNumber) || false;
      
      // Debug visibility map - only when specifically debugging RT structures
      if (RT_STRUCTURE_DEBUG) {
        console.log(`🔍 Structure ${structure.structureName} (${structure.roiNumber}) visibility:`, {
          isVisible,
          visibilityMapHasKey: structureVisibility.has(structure.roiNumber),
          allStructuresVisible,
          willShow: isSelectedForEdit || isSelectedStructure || 
                   (allStructuresVisible ? isVisible !== false : isVisible === true),
          isSelectedForEdit,
          isSelectedStructure,
          selectedStructuresSet: selectedStructures ? Array.from(selectedStructures) : []
        });
      }

      // Priority 1: Always show if selected (checkbox) or being edited
      if (isSelectedForEdit || isSelectedStructure) {
        // Continue to render - these always show
      } else {
        // Priority 2: For non-selected structures, check visibility rules
        // If all structures are hidden, only show structures with explicit visibility true
        if (!allStructuresVisible && isVisible !== true) {
          return;
        }
        // If all structures visible, hide only those explicitly set to false
        if (allStructuresVisible && isVisible === false) {
          return;
        }
      }

      // Use the structure's actual color, not hardcoded yellow
      const color = structure.color || [255, 255, 0]; // fallback to yellow only if no color
      const [r, g, b] = color;
      
      // Check if this structure is currently animating from smooth operation
      const isAnimating = smoothAnimation.structureId === structure.roiNumber;
      const animProgress = isAnimating ? 
        Math.min(1, (Date.now() - smoothAnimation.startTime) / smoothAnimation.duration) : 0;
      
      // Default styles (will be overridden per-contour for animation)
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillOpacity})`;
      
      // Store animation state for use in drawContour
      const rippleAnimationState = isAnimating && animProgress < 1 ? {
        progress: animProgress,
        structureColor: { r, g, b },
        baseOpacity: fillOpacity
      } : null;
      
      // Keep animating by triggering re-render
      if (isAnimating && animProgress < 1) {
        setTimeout(() => {
          setForceRenderTrigger(prev => prev + 1);
          scheduleRender();
        }, 16); // ~60fps
      } else if (isAnimating && animProgress >= 1) {
        // Animation complete, clear it
        setSmoothAnimation({ structureId: null, startTime: 0, duration: 400 });
      }

      // Determine an effective slice tolerance based on metadata to prevent flicker
      const metaTol = (() => {
        const meta = currentImage?.imageMetadata;
        if (!meta) return SLICE_TOL_MM;
        const sbs = parseFloat(meta.spacingBetweenSlices ?? '');
        const sth = parseFloat(meta.sliceThickness ?? '');
        const zCand = Number.isFinite(sbs) ? sbs * 0.45 : (Number.isFinite(sth) ? sth * 0.45 : 0);
        return Math.max(SLICE_TOL_MM, zCand || 0);
      })();

      structure.contours.forEach((contour: any) => {
        // Debug: Log what contours are being considered for drawing
        const positionDiff = Math.abs(
          contour.slicePosition - currentSlicePosition,
        );
        if (positionDiff <= metaTol) {
          // Check if this contour belongs to the highlighted blob (using unique contour keys)
          const contourKey = createContourKey(contour);
          const highlightedBlob = highlightedBlobId !== null && 
                                  blobDialogData?.structureId === structure.roiNumber ?
                                  blobDialogData?.blobs?.find(b => b.id === highlightedBlobId) : null;
          const isHighlightedBlob = highlightedBlob?.contours.some((c: any) => 
            createContourKey(c) === contourKey
          ) || false;
          
          if (isHighlightedBlob) {
            // Override with red highlighting
            ctx.save();
            ctx.strokeStyle = 'rgb(255, 50, 50)'; // Bright red
            ctx.fillStyle = 'rgba(255, 50, 50, 0.3)'; // Red fill
            ctx.lineWidth = lineWidth * 2.5; // Much thicker
            ctx.shadowColor = 'rgba(255, 50, 50, 0.9)';
            ctx.shadowBlur = 20;
            drawContour(ctx, contour, canvas.width, canvas.height, currentImage, animationTime, null);
            ctx.restore();
          } else {
            if (RT_STRUCTURE_DEBUG) {
              console.log(
                `✓ Drawing ${structure.structureName} contour at RT ${contour.slicePosition.toFixed(1)}mm (CT slice: ${currentSlicePosition.toFixed(1)}mm, diff: ${positionDiff.toFixed(1)}mm)`,
              );
            }
            drawContour(ctx, contour, canvas.width, canvas.height, currentImage, animationTime, rippleAnimationState);
          }
        }
      });
    });
    }

    // Render preview contours with dashed yellow styling (FOR ALL SLICES - true 3D preview)
    if (previewContours && previewContours.length > 0) {
      let renderedPreviewCount = 0;
      
      // Set preview contour styling - bright yellow and dashed
      ctx.strokeStyle = '#FFFF00'; // Bright yellow
      ctx.fillStyle = 'rgba(255, 255, 0, 0.12)'; // Slightly lighter fill
      ctx.lineWidth = 1.25; // Thin dashed line per spec
      
      // Set dashed line pattern
      ctx.setLineDash([8, 4]); // 8px dash, 4px gap
      ctx.lineDashOffset = animationTime * 0.1; // Animated dashes
      
      previewContours.forEach((contour: any) => {
        // Check if this is the new format with slice position
        if (contour.slicePosition !== undefined) {
          const positionDiff = Math.abs(contour.slicePosition - currentSlicePosition);
          
          // Show preview only on the current slice to avoid layered jagged lines
          if (positionDiff <= SLICE_TOL_MM) {
            drawContour(ctx, { points: contour.points, isPreview: true }, canvas.width, canvas.height, currentImage, animationTime);
            renderedPreviewCount++;
            
            // Log when we're showing preview on current slice vs other slices
            if (positionDiff <= SLICE_TOL_MM) {
              console.log(`🔹 🎯 Showing preview on CURRENT slice ${currentSlicePosition.toFixed(1)} (diff: ${positionDiff.toFixed(1)}mm)`);
            }
          }
        } else {
          // Fallback for old format (array of points) - always show
          drawContour(ctx, { points: contour, isPreview: true }, canvas.width, canvas.height, currentImage, animationTime);
          renderedPreviewCount++;
        }
      });
      
      console.log(`🔹 🌐 Rendered ${renderedPreviewCount} preview contours for 3D visualization (current slice: ${currentSlicePosition.toFixed(1)})`);
      
      // Reset line dash for other elements
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    // Restore context state
    ctx.restore();
  }, [structureVisibility, showStructures, highlightedBlobId, blobDialogData, smoothAnimation, previewContours, animationTime]);

  const drawContour = (
    ctx: CanvasRenderingContext2D,
    contour: any,
    canvasWidth: number,
    canvasHeight: number,
    currentImage: any,
    animationTime?: number,
    rippleAnimationState?: { progress: number; structureColor: { r: number; g: number; b: number }; baseOpacity: number } | null,
  ) => {
    if (contour.points.length < 6) return; // Need at least 2 points (x,y,z each)

    ctx.beginPath();

    // Get image metadata from current image
    const imgMetadata = currentImage?.imageMetadata;
    if (!imgMetadata) {
      console.warn("No image metadata available for contour drawing");
      return;
    }
    
    // Debug logging disabled unless DEBUG is true
    if (DEBUG && contour.points.length >= 6) {
      console.log('Drawing contour with metadata:', {
        imagePosition: imgMetadata.imagePosition,
        pixelSpacing: imgMetadata.pixelSpacing,
        firstWorldPoint: [contour.points[0], contour.points[1], contour.points[2]],
        canvasSize: [canvasWidth, canvasHeight],
        zoom: zoom,
        pan: [panX, panY]
      });
    }

    // Parse DICOM metadata with defensive checks
    const imagePosition = imgMetadata.imagePosition
      ?.split("\\")
      .map(Number)
      .filter((n: number) => Number.isFinite(n)) || [-300, -300, 0];

    const pixelSpacing = imgMetadata.pixelSpacing
      ?.split("\\")
      .map(Number)
      .filter((n: number) => Number.isFinite(n)) || [1.171875, 1.171875];

    // Parse Image Orientation Patient - CRITICAL for MRI registration
    const imageOrientation = imgMetadata.imageOrientation
      ?.split("\\")
      .map(Number)
      .filter((n: number) => Number.isFinite(n)) || [1, 0, 0, 0, 1, 0]; // Default to identity

    // Clamp spacing to avoid zeros
    const EPSILON = 1e-6;
    const rowSpacing = Math.abs(pixelSpacing[0]) > EPSILON ? pixelSpacing[0] : 1;
    const columnSpacing = Math.abs(pixelSpacing[1]) > EPSILON ? pixelSpacing[1] : 1;

    // Get image dimensions from metadata or use defaults
    const imageWidth = Number(imgMetadata.columns || imgMetadata.width) || 512;
    const imageHeight = Number(imgMetadata.rows || imgMetadata.height) || 512;

    // REUSE the transform established by render16BitImage instead of recalculating
    const transform = ctTransform.current ?? {
      scale: Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight) * zoom,
      offsetX: (canvasWidth - imageWidth * Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight) * zoom) / 2 + panX,
      offsetY: (canvasHeight - imageHeight * Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight) * zoom) / 2 + panY,
      imageWidth,
      imageHeight
    };

    // Set up animated dashed line for predicted contours
    if (contour.isPredicted && animationTime !== undefined) {
      const dashLength = 8;
      const gapLength = 6;
      const animationSpeed = 0.002; // Adjust for speed
      const offset = (animationTime * animationSpeed) % (dashLength + gapLength);
      ctx.setLineDash([dashLength, gapLength]);
      ctx.lineDashOffset = -offset;
    } else {
      // Solid line for confirmed contours
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    // Normalize orientation vectors to unit length - CRITICAL for accurate registration
    const normalizeVector = (vec: number[]): number[] => {
      const mag = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
      if (mag < EPSILON) return vec; // Return as-is if too small
      return [vec[0] / mag, vec[1] / mag, vec[2] / mag];
    };

    // Extract row and column direction cosines from Image Orientation Patient
    // DICOM standard: first 3 values = row direction (X), last 3 = column direction (Y)
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

    // Helper function for dot product
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    // Convert DICOM world coordinates to canvas coordinates
    for (let i = 0; i < contour.points.length; i += 3) {
      const worldX = contour.points[i]; // DICOM X coordinate
      const worldY = contour.points[i + 1]; // DICOM Y coordinate
      const worldZ = contour.points[i + 2]; // DICOM Z coordinate

      // Relative position from image origin
      const rel = [
        worldX - imagePosition[0],
        worldY - imagePosition[1],
        worldZ - imagePosition[2],
      ];

      // Project onto image plane using orientation vectors (handles oblique/rotated scans)
      // This is ESSENTIAL for MRI which often has non-standard orientations
      const pixelX = dot(rel, rowCosines) / columnSpacing;
      const pixelY = dot(rel, colCosines) / rowSpacing;

      // Apply the established transform to map pixel coordinates to canvas
      const canvasX = transform.offsetX + (pixelX * transform.scale);
      const canvasY = transform.offsetY + (pixelY * transform.scale);

      if (i === 0) {
        ctx.moveTo(canvasX, canvasY);
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }

    // Close the contour
    ctx.closePath();

    // Apply radial ripple animation if active
    if (rippleAnimationState && !contour.isPreview && !contour.isPredicted) {
      // Use clean animation module for ripple effect
      applyRippleAnimation({
        ctx,
        contourPoints: contour.points,
        structureColor: rippleAnimationState.structureColor,
        baseOpacity: rippleAnimationState.baseOpacity,
        progress: rippleAnimationState.progress,
        imagePosition,
        pixelSpacing: [rowSpacing, columnSpacing],
        imageX: transform.offsetX,
        imageY: transform.offsetY,
        totalScale: transform.scale
      });
    } else {
      // Normal rendering (no animation)
      // Fill only for confirmed contours; skip fill for previews
      // Also use reduced opacity for predictions
      if (contour.isPreview) {
        // No fill for preview to match thin dashed outline spec
      } else if (contour.isPredicted) {
        const originalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = originalAlpha * 0.3; // Very subtle fill for predictions
        ctx.fill();
        ctx.globalAlpha = originalAlpha;
      } else {
        ctx.fill();
      }
      
      ctx.stroke();
    }

    // Reset line dash for subsequent drawing operations
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  };

  const loadDicomParser = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.dicomParser) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://unpkg.com/dicom-parser@1.8.21/dist/dicomParser.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load dicom-parser"));
      document.head.appendChild(script);
    });
  };

  const goToPrevious = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0 && prevIndex < images.length) {
      console.log(`📍 Navigate: ${currentIndex} → ${prevIndex}`);
      setCurrentIndex(prevIndex);
      notifySliceChange(prevIndex);
    }
  };

  const goToNext = () => {
    // Get max slices based on orientation
    let maxSlices = images.length;
    if (orientation === 'sagittal' && images.length > 0) {
      // Sagittal slices = width of axial images
      maxSlices = images[0]?.columns || 512;
    } else if (orientation === 'coronal' && images.length > 0) {
      // Coronal slices = height of axial images
      maxSlices = images[0]?.rows || 512;
    }
    
    // Add protection against unexpected navigation
    const nextIndex = currentIndex + 1;
    if (nextIndex < maxSlices && nextIndex >= 0) {
      console.log(`📍 Navigate: ${currentIndex} → ${nextIndex} (max: ${maxSlices})`);
      setCurrentIndex(nextIndex);
      notifySliceChange(nextIndex);
    }
  };

  // MPR click handlers for navigation
  const handleSagittalClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (images.length === 0) return;
    
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert click position to slice index
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const volumeHeight = images[0]?.rows || 512;
    const volumeDepth = images.length;
    
    // Click Y position maps to axial Y coordinate
    const axialY = Math.floor((y / canvasHeight) * volumeHeight);
    // Click X position maps to axial Z index (slice)
    const axialZ = Math.floor((x / canvasWidth) * volumeDepth);
    
    // Update crosshair position
    const newCrosshair = { ...crosshairPos, y: axialY };
    setCrosshairPos(newCrosshair);
    notifyCrosshairChange(newCrosshair);
    
    // Navigate to the clicked axial slice
    if (axialZ >= 0 && axialZ < images.length) {
      setCurrentIndex(axialZ);
      notifySliceChange(axialZ);
    }
  };

  const handleCoronalClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (images.length === 0) return;
    
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert click position to slice index
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const volumeWidth = images[0]?.columns || 512;
    const volumeDepth = images.length;
    
    // Click X position maps to axial X coordinate
    const axialX = Math.floor((x / canvasWidth) * volumeWidth);
    // Click Y position maps to axial Z index (slice)
    const axialZ = Math.floor((y / canvasHeight) * volumeDepth);
    
    // Update crosshair position
    const newCrosshair = { ...crosshairPos, x: axialX };
    setCrosshairPos(newCrosshair);
    notifyCrosshairChange(newCrosshair);
    
    // Navigate to the clicked axial slice
    if (axialZ >= 0 && axialZ < images.length) {
      setCurrentIndex(axialZ);
      notifySliceChange(axialZ);
    }
  };

  // Notify parent when slice position changes
  useEffect(() => {
    if (images.length > 0 && images[currentIndex] && onSlicePositionChange) {
      const rawSlicePos =
        images[currentIndex].sliceZ ??
        images[currentIndex].parsedSliceLocation ??
        images[currentIndex].parsedZPosition ??
        currentIndex;
      const parsedSlicePos =
        typeof rawSlicePos === "string" ? parseFloat(rawSlicePos) : rawSlicePos;
      const normalizedSlicePos = normalizeSlicePosition(
        Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
      );
      onSlicePositionChange(normalizedSlicePos);
    }
    
    // Clear preview contours when slice changes to prevent showing same preview on different slices
    setPreviewContours([]);
  }, [currentIndex, images, onSlicePositionChange]);
  
  // Set the displayCurrentImageRef to point to displayCurrentImage
  useEffect(() => {
    displayCurrentImageRef.current = displayCurrentImage;
  });

  // Force re-render when rtStructures change or forceRenderTrigger is set
  useEffect(() => {
    if (images.length > 0 && forceRenderTrigger > 0) {
      console.log('🎯 forceRenderTrigger detected, re-rendering immediately');
      displayCurrentImage();
    }
  }, [forceRenderTrigger, rtStructures]);

  // Watch for crosshair position changes and update MPR views
  useEffect(() => {
    if (orientation === 'axial' && images.length > 0 && sagittalCanvasRef.current && coronalCanvasRef.current) {
      // Update MPR views when crosshair position changes
      const updateMPRViews = async () => {
        try {
          setIsLoadingMPR(true);
          
          // Convert window/level props to width/center terminology used by renderMPRCanvas
          const windowWidth = props.windowLevel?.window || 350;
          const windowCenter = props.windowLevel?.level || 40;
          
          // Clamp crosshair position to valid range
          const sagittalSliceIndex = Math.max(0, Math.min(crosshairPos.x, (images[0]?.columns || 512) - 1));
          const coronalSliceIndex = Math.max(0, Math.min(crosshairPos.y, (images[0]?.rows || 512) - 1));
          
          // Render MPR views with current window/level settings
          await Promise.all([
            sagittalCanvasRef.current && renderMPRCanvas(sagittalCanvasRef.current, 'sagittal', sagittalSliceIndex, windowWidth, windowCenter),
            coronalCanvasRef.current && renderMPRCanvas(coronalCanvasRef.current, 'coronal', coronalSliceIndex, windowWidth, windowCenter)
          ].filter(Boolean));
        } catch (error) {
          console.error("Error updating MPR views:", error);
        } finally {
          setIsLoadingMPR(false);
        }
      };
      
      updateMPRViews();
    }
  }, [crosshairPos, orientation, images.length, props.windowLevel]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Check if any drawing tool or measurement tool is active - if so, skip pan functionality
    const isDrawingToolActive =
      (brushToolState?.isActive &&
       (brushToolState?.tool === "brush" ||
        brushToolState?.tool === "pen" ||
        brushToolState?.tool === "planar-contour" ||
        brushToolState?.tool === "interactive-tumor")) ||
      isMeasurementToolActive;

    // Only prevent default and stop propagation if drawing/measurement tool is NOT active
    if (!isDrawingToolActive) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (e.button === 0 && !isDrawingToolActive) {
      // Left click - crosshair mode or pan mode
      if (crosshairMode && canvasRef.current && images[currentIndex]) {
        // In crosshair mode, update crosshair position
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Convert canvas coordinates to image pixel coordinates
        const canvasWidth = canvasRef.current.width;
        const canvasHeight = canvasRef.current.height;
        const imageWidth = images[currentIndex]?.columns || 512;
        const imageHeight = images[currentIndex]?.rows || 512;
        
        // Calculate scale with zoom factor (same as render16BitImage)
        const baseScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
        const totalScale = baseScale * zoom;
        const scaledWidth = imageWidth * totalScale;
        const scaledHeight = imageHeight * totalScale;
        
        // Center position with pan offset
        const imageX = (canvasWidth - scaledWidth) / 2 + panX;
        const imageY = (canvasHeight - scaledHeight) / 2 + panY;
        
        // Convert canvas coordinates to image pixel coordinates
        const pixelX = Math.floor((canvasX - imageX) / totalScale);
        const pixelY = Math.floor((canvasY - imageY) / totalScale);
        
        // Check if within image bounds
        if (pixelX >= 0 && pixelX < imageWidth && pixelY >= 0 && pixelY < imageHeight) {
          setCrosshairPos({ x: pixelX, y: pixelY });
          console.log(`Crosshair repositioned to: ${pixelX}, ${pixelY}`);
          scheduleRender(); // Re-render to show new crosshair position
        }
      } else {
        // Pan mode
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setLastPanX(panX);
        setLastPanY(panY);
      }
    } else if (e.button === 2 && !isDrawingToolActive) {
      // Right click for window/level (disabled during drawing mode)
      const startX = e.clientX;
      const startY = e.clientY;
      const startWindow = currentWindowLevel.width;
      const startCenter = currentWindowLevel.center;

      const handleWindowLevelDrag = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        markInteracting();
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const newWidth = Math.max(1, startWindow + deltaX * 2);
        const newCenter = startCenter - deltaY * 1.5;

        updateWindowLevel({ width: newWidth, center: newCenter });
      };

      const handleWindowLevelEnd = (endEvent: MouseEvent) => {
        endEvent.preventDefault();
        document.removeEventListener("mousemove", handleWindowLevelDrag);
        document.removeEventListener("mouseup", handleWindowLevelEnd);
      };

      document.addEventListener("mousemove", handleWindowLevelDrag);
      document.addEventListener("mouseup", handleWindowLevelEnd);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Skip pan functionality if any drawing tool or measurement tool is active
    const isDrawingToolActive =
      (brushToolState?.isActive &&
       (brushToolState?.tool === "brush" ||
        brushToolState?.tool === "pen" ||
        brushToolState?.tool === "planar-contour" ||
        brushToolState?.tool === "interactive-tumor")) ||
      isMeasurementToolActive;

    // NOTE: Crosshair position is now only updated on click when in crosshair mode,
    // not on mouse move. This prevents the crosshair from following the mouse cursor.

    // Only handle pan if drawing/measurement tool is NOT active
    if (isDragging && !isDrawingToolActive) {
      markInteracting();
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      const newPanX = lastPanX + deltaX;
      const newPanY = lastPanY + deltaY;
      setPanX(newPanX);
      setPanY(newPanY);
      notifyPanChange(newPanX, newPanY);
    }
  };

  const handleCanvasMouseUp = () => {
    // Skip pan functionality if any drawing tool or measurement tool is active
    const isDrawingToolActive =
      (brushToolState?.isActive &&
       (brushToolState?.tool === "brush" ||
        brushToolState?.tool === "pen" ||
        brushToolState?.tool === "planar-contour" ||
        brushToolState?.tool === "interactive-tumor")) ||
      isMeasurementToolActive;

    if (!isDrawingToolActive) {
      setIsDragging(false);
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Always handle wheel events
    e.preventDefault();
    e.stopPropagation();
    markInteracting();

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+scroll for zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
      setZoom(newZoom);
      notifyZoomChange(newZoom);
    } else {
      // Mark as actively scrolling to ignore stale external sync
      isLocalScrollingRef.current = true;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isLocalScrollingRef.current = false;
      }, 200); // Clear after 200ms of no scrolling
      
      // Simple slice scrolling - move 1 slice per scroll event
      const maxIndex = images.length - 1;
      const current = currentIndexRef.current;
      let newIndex: number;
      
      if (e.deltaY > 0) {
        // Scroll down → towards feet (previous)
        newIndex = Math.max(0, current - 1);
      } else {
        // Scroll up → towards head (next)
        newIndex = Math.min(maxIndex, current + 1);
      }
      
      if (newIndex !== current) {
        // Update ref immediately (no React re-render)
        currentIndexRef.current = newIndex;
        
        // Schedule canvas redraw using existing throttled system
        scheduleRender();
        
        // Notify parent through scroll sync (debounced React state update)
        // Use skipSource to prevent feedback loop to ourselves
        viewportScrollSync.update(viewportId, { sliceIndex: newIndex }, { skipSource: true });
        
        // Also notify via callback for components not using scroll sync
        notifySliceChange(newIndex);
      }
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(5, prev * 1.2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.1, prev / 1.2));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Expose zoom functions to parent component via imperative handle
  useEffect(() => {
    // Always expose zoom functions for toolbar access
    (window as any).currentViewerZoom = {
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      resetZoom: handleResetZoom,
    };

    return () => {
      delete (window as any).currentViewerZoom;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow Up → towards head (superior) → increase index
      // Arrow Down → towards feet (inferior) → decrease index
      // Left/Right maintain previous next/back behavior
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") goToPrevious();
      if (e.key === "ArrowRight" || e.key === "ArrowUp") goToNext();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, images]);

  // Listen for slice navigation events from topbar arrows
  useEffect(() => {
    const handleNavigateSlice = (e: CustomEvent<{ direction: 'prev' | 'next' }>) => {
      if (e.detail.direction === 'prev') {
        goToPrevious();
      } else if (e.detail.direction === 'next') {
        goToNext();
      }
    };

    window.addEventListener('navigate:slice', handleNavigateSlice as EventListener);

    return () => {
      window.removeEventListener('navigate:slice', handleNavigateSlice as EventListener);
    };
  }, [currentIndex, images]);

  // Listen for viewer reset event from topbar
  useEffect(() => {
    const handleViewerReset = () => {
      // Reset zoom
      setZoom(1);
      // Reset pan
      setPanX(0);
      setPanY(0);
      setLastPanX(0);
      setLastPanY(0);
      // Reset to first slice
      setCurrentIndex(0);
      notifySliceChange(0);
      // Reset crosshair to center
      if (images.length > 0 && images[0]) {
        const centerX = Math.floor((images[0].columns || 512) / 2);
        const centerY = Math.floor((images[0].rows || 512) / 2);
        setCrosshairPos({ x: centerX, y: centerY });
        notifyCrosshairChange({ x: centerX, y: centerY });
      }
      console.log('🔄 Viewer reset to default state');
    };

    window.addEventListener('viewer:reset', handleViewerReset);

    return () => {
      window.removeEventListener('viewer:reset', handleViewerReset);
    };
  }, [images]);

  // Animation loop for dashed borders on predicted contours
  useEffect(() => {
    let animationFrameId: number;
    
    const animate = (timestamp: number) => {
      setAnimationTime(timestamp);
      
      // Check if we need to keep animating (if there are predicted contours)
      const hasPredictedContours = rtStructures?.structures?.some((structure: any) =>
        structure.contours?.some((contour: any) => contour.isPredicted)
      );
      
      if (hasPredictedContours) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    // Start animation if there are predicted contours
    const hasPredictedContours = rtStructures?.structures?.some((structure: any) =>
      structure.contours?.some((contour: any) => contour.isPredicted)
    );
    
    if (hasPredictedContours) {
      animationFrameId = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [rtStructures]); // Re-run when RT structures change

  // Animation loop for animated dashed preview contours
  useEffect(() => {
    if (!previewContours || previewContours.length === 0) return;

    let rafId: number | null = null;
    const animate = (ts: number) => {
      setAnimationTime(ts);
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender();
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [previewContours.length, scheduleRender]);

  // Test function to add a predicted contour for demonstration
  const addTestPredictedContour = () => {
    if (!rtStructures || !rtStructures.structures || testPredictionAdded) return;
    
    console.log("🎯 Adding test predicted contour to demonstrate animated dashed borders");
    
    // Find the TEST structure (roiNumber 943)
    const testStructure = rtStructures.structures.find((s: any) => s.roiNumber === 943);
    if (!testStructure) {
      console.log("TEST structure not found, skipping prediction demo");
      return;
    }
    
    // Create a simple circular predicted contour on a different slice
    const currentSlice = images.length > 0 && images[currentIndex] 
      ? (images[currentIndex].parsedSliceLocation || images[currentIndex].parsedZPosition || currentIndex)
      : -115;
    
    const predictedSlice = currentSlice + 3; // 3mm away
    
    // Create a circular contour in world coordinates
    const centerX = -50; // World coordinates
    const centerY = 50;
    const radius = 20;
    const points: number[] = [];
    
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(x, y, predictedSlice);
    }
    
    // Add the predicted contour
    const predictedContour = {
      slicePosition: predictedSlice,
      points: points,
      numberOfPoints: points.length / 3,
      isPredicted: true,
      predictionConfidence: 0.85
    };
    
    // Deep copy and add the predicted contour
    const updatedStructures = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
    const updatedTestStructure = updatedStructures.structures.find((s: any) => s.roiNumber === 943);
    if (updatedTestStructure) {
      updatedTestStructure.contours.push(predictedContour);
      setLocalRTStructures(updatedStructures);
      setTestPredictionAdded(true);
      
      console.log(`✅ Added predicted contour to slice ${predictedSlice} with animated dashed border`);
      console.log(`Navigate to slice ${predictedSlice} to see the animated prediction!`);
    }
  };

  // Add test predicted contour when RT structures are loaded
  useEffect(() => {
    if (rtStructures && !testPredictionAdded) {
      // Add a small delay to ensure everything is loaded
      setTimeout(() => {
        addTestPredictedContour();
      }, 1000);
    }
  }, [rtStructures, testPredictionAdded]);

  // Handle prediction confirmation - convert dashed predicted contours to solid confirmed contours
  const handlePredictionConfirm = (structureId: number, slicePosition: number) => {
    if (!rtStructures) return;
    
    if (false) console.log(`🔄 Confirming prediction for structure ${structureId} at slice ${slicePosition}`);
    
    // Deep copy the structures
    const updatedStructures = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
    
    // Find the structure and contour to confirm
    const structure = updatedStructures.structures.find((s: any) => s.roiNumber === structureId);
    if (!structure) {
      console.error(`Structure ${structureId} not found`);
      return;
    }
    
    const contour = structure.contours.find((c: any) => 
      c.isPredicted && Math.abs(c.slicePosition - slicePosition) <= 1.5
    );
    
    if (!contour) {
      console.error(`Predicted contour not found for structure ${structureId} at slice ${slicePosition}`);
      return;
    }
    
    // Convert predicted contour to confirmed contour
    contour.isPredicted = false;
    delete contour.predictionConfidence;
    
    console.log(`✅ Confirmed contour for structure ${structureId} - changed from dashed to solid border`);
    
    // Update local state
    setLocalRTStructures(updatedStructures);
    
    // Save to server
    saveContourUpdates(updatedStructures);
    
    // Notify parent component
    if (onContourUpdate) {
      onContourUpdate(updatedStructures);
    }
  };


  // Store the last localized blob for window resize recalculation
  const lastLocalizedBlobRef = useRef<{ blobId: number; contours: BlobContour[] } | null>(null);
  
  // Handle blob deletion from dialog
  const handleBlobsDelete = (blobIds: number[]) => {
    if (!blobDialogData || !blobDialogData.structureId) return;
    
    const structure = (localRTStructures || rtStructures)?.structures?.find(
      (s: any) => s.roiNumber === blobDialogData.structureId
    );
    if (!structure) return;
    
    // Collect contour keys to remove
    const keysToRemove = new Set<string>();
    blobDialogData.blobs.forEach((b) => {
      if (blobIds.includes(b.id)) {
        b.contours.forEach((c) => {
          keysToRemove.add(createContourKey(c));
        });
      }
    });
    
    // Clone and filter
    const updated = structuredClone ? structuredClone(localRTStructures || rtStructures) : JSON.parse(JSON.stringify(localRTStructures || rtStructures));
    const s = updated.structures.find((x: any) => x.roiNumber === blobDialogData.structureId);
    if (!s) return;
    
    s.contours = s.contours.filter((c: any) => !keysToRemove.has(createContourKey(c)));
    
    setLocalRTStructures(updated);
    if (seriesId) {
      undoRedoManager.saveState(
        seriesId, 
        'remove_blobs', 
        blobDialogData.structureId, 
        updated,
        undefined, // Applies to multiple slices
        s.structureName
      );
    }
    saveContourUpdates(updated, 'remove_blobs');
    
    // Clear highlighted blob if it was deleted
    if (highlightedBlobId && blobIds.includes(highlightedBlobId)) {
      setHighlightedBlobId(null);
      lastLocalizedBlobRef.current = null;
    }
    
    // Force immediate render
    setForceRenderTrigger(prev => prev + 1);
    scheduleRender(true); // immediate=true
  };
  
  // Handle blob localization from dialog
  const handleBlobLocalize = (blobId: number, contours: BlobContour[]) => {
    setHighlightedBlobId(blobId);
    lastLocalizedBlobRef.current = { blobId, contours };
    localizeToBlobContours(contours);
  };
  
  // Recalculate blob position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (lastLocalizedBlobRef.current && highlightedBlobId !== null) {
        // Recalculate zoom and pan to keep blob centered
        setTimeout(() => {
          localizeToBlobContours(lastLocalizedBlobRef.current!.contours);
        }, 100); // Small delay to ensure canvas has resized
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [highlightedBlobId, imageMetadata]);

  // Localize to a specific blob by navigating to its middle slice, zooming, and centering view
  const localizeToBlobContours = (contours: Array<{slicePosition: number; points: number[]}>) => {
    if (!contours.length) return;
    
    // Find middle slice
    const slicePositions = contours.map(c => c.slicePosition).sort((a, b) => a - b);
    const middleSlice = slicePositions[Math.floor(slicePositions.length / 2)];
    
    // Get contours at middle slice for bounding box calculation
    const middleSliceContours = contours.filter(c => Math.abs(c.slicePosition - middleSlice) < 0.5);
    
    // Calculate bounding box of the blob at middle slice (in world/mm coordinates)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    middleSliceContours.forEach(c => {
      for (let i = 0; i < c.points.length; i += 3) {
        minX = Math.min(minX, c.points[i]);
        maxX = Math.max(maxX, c.points[i]);
        minY = Math.min(minY, c.points[i + 1]);
        maxY = Math.max(maxY, c.points[i + 1]);
      }
    });
    
    // Navigate to middle slice
    const targetIndex = images.findIndex(img => 
      Math.abs((img.parsedSliceLocation ?? img.parsedZPosition ?? 0) - middleSlice) < 0.5
    );
    
    if (targetIndex >= 0) {
      setCurrentIndex(targetIndex);
      
      // Calculate zoom and pan to center blob at 50% of viewport
      if (canvasRef.current && isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
        const canvas = canvasRef.current;
        
        // Blob dimensions in world coordinates (mm)
        const blobWidthMm = maxX - minX;
        const blobHeightMm = maxY - minY;
        const blobCenterX = (minX + maxX) / 2;
        const blobCenterY = (minY + maxY) / 2;
        
        // Get pixel spacing (mm per pixel)
        const pixelSpacingX = parseFloat(imageMetadata?.pixelSpacing?.split?.('\\')[1]) || 1; // Column spacing
        const pixelSpacingY = parseFloat(imageMetadata?.pixelSpacing?.split?.('\\')[0]) || 1; // Row spacing
        
        // Image dimensions
        const imageWidth = 512;
        const imageHeight = 512;
        
        // Convert blob size from mm to pixels (at zoom 1.0)
        const blobWidthPixels = blobWidthMm / pixelSpacingX;
        const blobHeightPixels = blobHeightMm / pixelSpacingY;
        
        // Target: blob should take up ~10-15% of viewport (8x padding factor) for maximum context
        const paddingFactor = 8.0;
        
        // Calculate base scale (same as render function)
        const baseScale = Math.min(canvas.width / imageWidth, canvas.height / imageHeight);
        
        // Calculate zoom needed to fit blob in viewport (blob should be 50% of screen)
        const targetWidthPixels = blobWidthPixels * paddingFactor;
        const targetHeightPixels = blobHeightPixels * paddingFactor;
        const zoomX = (canvas.width / targetWidthPixels) / baseScale;
        const zoomY = (canvas.height / targetHeightPixels) / baseScale;
        const newZoom = Math.max(0.5, Math.min(zoomX, zoomY, 8)); // Between 0.5x and 8x
        
        // Apply zoom
        setZoom(newZoom);
        
        // Convert blob center from world to pixel coordinates
        const imagePositionX = parseFloat(imageMetadata?.imagePosition?.split?.('\\')[0]) || -300;
        const imagePositionY = parseFloat(imageMetadata?.imagePosition?.split?.('\\')[1]) || -300;
        const blobCenterPixelX = (blobCenterX - imagePositionX) / pixelSpacingX;
        const blobCenterPixelY = (blobCenterY - imagePositionY) / pixelSpacingY;
        
        // Calculate where the blob center will be on the canvas after applying zoom
        const totalScale = baseScale * newZoom;
        const scaledWidth = imageWidth * totalScale;
        const scaledHeight = imageHeight * totalScale;
        
        // Target: center blob at 65% horizontal, 50% vertical (spotlight position)
        const targetX = canvas.width * 0.65;
        const targetY = canvas.height * 0.50;
        
        // Calculate pan offset needed to place blob center at target position
        const imageBaseX = (canvas.width - scaledWidth) / 2;
        const imageBaseY = (canvas.height - scaledHeight) / 2;
        const blobCanvasX = imageBaseX + (blobCenterPixelX * totalScale);
        const blobCanvasY = imageBaseY + (blobCenterPixelY * totalScale);
        
        const newPanX = targetX - blobCanvasX;
        const newPanY = targetY - blobCanvasY;
        
        // Apply pan
        setPanX(newPanX);
        setPanY(newPanY);
        
        console.log(`🎯 Localized: blob=(${blobWidthMm.toFixed(1)}x${blobHeightMm.toFixed(1)})mm, zoom=${newZoom.toFixed(2)}x, pan=(${newPanX.toFixed(0)}, ${newPanY.toFixed(0)})`);
        toast({ 
          title: "Localized to blob", 
          description: `Slice ${targetIndex + 1} - ${newZoom.toFixed(1)}x zoom - ${blobWidthMm.toFixed(0)}×${blobHeightMm.toFixed(0)}mm` 
        });
      } else {
        console.log(`Localized to blob at slice ${middleSlice} (index ${targetIndex})`);
        toast({ title: "Localized to blob", description: `Navigated to slice ${targetIndex + 1}` });
      }
      
      // Force re-render
      setForceRenderTrigger(prev => prev + 1);
      scheduleRender();
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full bg-black border-gray-700 flex items-center justify-center">
        <div className="text-center">
          {/* Medical-themed loading animation */}
          <div className="relative w-24 h-24 mx-auto mb-4">
            {/* Outer ring with gradient */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-border animate-spin"></div>
            
            {/* Inner ring rotating opposite direction */}
            <div className="absolute inset-2 rounded-full border-4 border-transparent bg-gradient-to-l from-cyan-500 via-blue-500 to-indigo-500 bg-clip-border animate-spin" style={{ animationDirection: 'reverse' }}></div>
            
            {/* Center pulse effect */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 animate-pulse"></div>
            
            {/* Medical cross icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-white z-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 3V21H15V3H9ZM3 9V15H21V9H3Z" />
              </svg>
            </div>
          </div>
          
          <p className="text-white text-lg font-medium mb-2">Loading medical images...</p>
          <p className="text-indigo-300 text-sm">Preparing visualization</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full bg-black border-gray-700 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="mb-2">Error loading CT scan:</p>
          <p className="text-sm">{error}</p>
          <Button
            onClick={loadImages}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`h-full bg-black ${hideToolbar ? 'border-0' : 'border-gray-700'} flex flex-col overflow-hidden`} style={{ minHeight: 0, maxHeight: '100%' }}>
      {/* Header with modern toolbar styling - hidden in multi-viewport mode */}
      {!hideToolbar && (
      <div className="p-3 border-b border-gray-700/50">
        <div 
          className="backdrop-blur-md border rounded-xl px-4 py-3 shadow-lg flex items-center justify-between"
          style={{ 
            backgroundColor: '#1a1a1a95',
            borderColor: '#4a5568'
          }}
        >
          <div className="flex items-center space-x-2">
            <Badge className="bg-blue-900/60 text-blue-200 border border-blue-600/30 backdrop-blur-sm">
              CT Scan {orientation !== 'axial' && `- ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}`}
            </Badge>
            {images.length > 0 && (
              <>
                <Badge
                  variant="outline"
                  className="border-gray-500/50 text-gray-300 bg-gray-800/40 backdrop-blur-sm"
                >
                  {currentIndex + 1} / {(() => {
                    let maxSlices = images.length;
                    if (orientation === 'sagittal' && images.length > 0) {
                      maxSlices = images[0]?.columns || 512;
                    } else if (orientation === 'coronal' && images.length > 0) {
                      maxSlices = images[0]?.rows || 512;
                    }
                    return maxSlices;
                  })()}
                </Badge>
                
                {/* Window/Level/Z position pills */}
                <Badge className="bg-cyan-900/40 text-cyan-200 border border-cyan-600/30 backdrop-blur-sm">
                  W: {Math.round(currentWindowLevel.width)}
                </Badge>
                <Badge className="bg-orange-900/40 text-orange-200 border border-orange-600/30 backdrop-blur-sm">
                  L: {Math.round(currentWindowLevel.center)}
                </Badge>
                {images[currentIndex] && orientation === 'axial' && (
                  <Badge className="bg-purple-900/40 text-purple-200 border border-purple-600/30 backdrop-blur-sm">
                    Z: {images[currentIndex].parsedSliceLocation?.toFixed(1) ||
                        images[currentIndex].parsedZPosition?.toFixed(1) ||
                        (currentIndex + 1)}
                  </Badge>
                )}
              </>
            )}
            {secondarySeriesId && (
              <Badge className={`flex items-center gap-1 border backdrop-blur-sm ${
                secondaryModality === 'PT' 
                  ? 'bg-yellow-900/40 text-yellow-200 border-yellow-600/30' 
                  : secondaryModality === 'CT'
                  ? 'bg-blue-900/40 text-blue-200 border-blue-600/30'
                  : 'bg-purple-900/40 text-purple-200 border-purple-600/30'
              }`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  secondaryModality === 'PT' 
                    ? 'bg-yellow-400' 
                    : secondaryModality === 'CT'
                    ? 'bg-blue-400'
                    : 'bg-purple-400'
                }`} />
                {secondaryModality === 'PT' ? 'PT' : secondaryModality === 'CT' ? 'CT' : 'MR'} Fusion
                <span className={
                  secondaryModality === 'PT' 
                    ? 'text-yellow-300' 
                    : secondaryModality === 'CT'
                    ? 'text-blue-300'
                    : 'text-purple-300'
                }>
                  ({Math.round(fusionOpacity * 100)}%)
                </span>
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {rtStructures && (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-800/50 rounded-lg">
                <Badge 
                  variant={showStructures ? "default" : "secondary"}
                  className={`${
                    showStructures 
                      ? 'bg-green-600/80 text-white border-green-500/50' 
                      : 'bg-gray-700/50 text-gray-300'
                  }`}
                >
                  RT ({rtStructures?.structures?.length || 0})
                </Badge>
                <span className="text-xs text-gray-400">
                  {showStructures ? 'Visible' : 'Hidden'}
                </span>
              </div>
            )}
            
            {/* Background Loading Progress */}
            {prefetchProgress.total > 0 && prefetchProgress.loaded > 0 && prefetchProgress.loaded < prefetchProgress.total && !isLoading && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800/50 rounded-lg">
                <div className="w-24 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-400 h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(prefetchProgress.loaded / prefetchProgress.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-300">
                  {Math.round((prefetchProgress.loaded / prefetchProgress.total) * 100)}% ({prefetchProgress.loaded}/{prefetchProgress.total})
                </span>
              </div>
            )}
            
            <Button
              size="sm"
              variant={isMeasurementToolActive ? "default" : "ghost"}
              onClick={() => {
                setIsMeasurementToolActive(!isMeasurementToolActive);
                if (brushToolState?.isActive) {
                  // Disable brush/pen tools when measurement is active
                  if (onBrushToolChange) {
                    onBrushToolChange({
                      ...brushToolState,
                      isActive: false
                    });
                  }
                }
              }}
              className={`h-8 px-3 transition-all duration-200 rounded-lg text-gray-300 ${
                isMeasurementToolActive 
                  ? 'bg-blue-600/80 hover:bg-blue-700/80 text-white border border-blue-500/50 shadow-sm backdrop-blur-sm' 
                  : 'hover:bg-gray-700/50 hover:text-white'
              }`}
              title="Measurement Tool"
            >
              <Ruler className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="h-8 px-3 transition-all duration-200 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={goToNext}
              disabled={currentIndex === (() => {
                let maxSlices = images.length;
                if (orientation === 'sagittal' && images.length > 0) {
                  maxSlices = images[0]?.columns || 512;
                } else if (orientation === 'coronal' && images.length > 0) {
                  maxSlices = images[0]?.rows || 512;
                }
                return maxSlices - 1;
              })()}
              className="h-8 px-3 transition-all duration-200 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            {/* Viewport Layout Buttons - Hidden in compactMode (viewport mode uses FlexibleFusionLayout) */}
            {orientation === 'axial' && images.length > 0 && !compactMode && (
              <>
                <div className="relative group">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewportLayout('axial-only')}
                    className={`h-8 px-4 transition-all duration-200 rounded-lg flex items-center gap-2 border-[0.5px] ${
                      viewportLayout === 'axial-only'
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500/50 shadow-sm'
                        : 'bg-gray-800/40 text-gray-300 border-gray-600/40 hover:bg-purple-600/10 hover:text-purple-300 hover:border-purple-500/30'
                    }`}
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Axial</span>
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    Axial Only
                  </div>
                </div>
                <div className="relative group">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewportLayout('floating')}
                    className={`h-8 px-4 transition-all duration-200 rounded-lg flex items-center gap-2 border-[0.5px] ${
                      viewportLayout === 'floating'
                        ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm'
                        : 'bg-gray-800/40 text-gray-300 border-gray-600/40 hover:bg-blue-600/10 hover:text-blue-300 hover:border-blue-500/30'
                    }`}
                  >
                    <PanelRightDashed className="w-4 h-4" />
                    <span className="text-sm font-medium">Float</span>
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    Axial + Floating Windows
                  </div>
                </div>
                <div className="relative group">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewportLayout('grid')}
                    className={`h-8 px-4 transition-all duration-200 rounded-lg flex items-center gap-2 border-[0.5px] ${
                      viewportLayout === 'grid'
                        ? 'bg-green-600/20 text-green-300 border-green-500/50 shadow-sm'
                        : 'bg-gray-800/40 text-gray-300 border-gray-600/40 hover:bg-green-600/10 hover:text-green-300 hover:border-green-500/30'
                    }`}
                  >
                    <LayoutPanelLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Grid</span>
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-green-600/95 via-green-500/95 to-green-600/95 border border-green-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    Multi-View Grid
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Canvas with Right Sidebar */}
      <div className={`flex-1 ${hideSidebar ? 'p-0' : 'pr-4 pt-4 pb-4 pl-0'} relative overflow-hidden min-h-0`}>
        <div className={`w-full h-full flex ${hideSidebar ? 'gap-0' : 'gap-4'} min-h-0`}>
          {/* Main Canvas Area - conditionally split for grid layout */}
          {viewportLayout === 'grid' && orientation === 'axial' && images.length > 0 ? (
            <>
              {/* Grid Layout: Axial on left, Sagittal + Coronal stacked on right */}
              <div className="flex-1 flex items-center justify-center relative overflow-hidden min-w-0 min-h-0">
                {/* Axial view (main) */}
                <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                  {fusionDisplayMode === 'side-by-side' && secondarySeriesId ? (
                    /* Side-by-Side Layout for Axial - supports different split ratios */
                    <div className={`w-full h-full gap-2 ${
                      props.fusionLayoutPreset === 'vertical-stack' ? 'flex flex-col' : 'flex'
                    }`}>
                      {/* Primary Canvas Container - flex ratio based on layout preset */}
                      <div className={`relative flex items-center justify-center bg-black ${
                        props.fusionLayoutPreset === 'primary-focus' ? 'flex-[7]' :
                        props.fusionLayoutPreset === 'secondary-focus' ? 'flex-[3]' :
                        'flex-1'
                      }`}>
                        <canvas
                          ref={canvasRef}
                          width={1536}
                          height={1536}
                          onMouseDown={handleCanvasMouseDown}
                          onMouseMove={(e) => {
                            handleCanvasMouseMove(e);
                          }}
                          onMouseUp={handleCanvasMouseUp}
                          onWheel={(e) => {
                            handleCanvasWheel(e);
                          }}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`max-w-full max-h-full object-contain rounded ${
                            brushToolState?.isActive && brushToolState?.tool === "brush"
                              ? "cursor-none"
                              : brushToolState?.isActive && (brushToolState?.tool === "pen" || brushToolState?.tool === "pen-original")
                              ? ""
                              : "cursor-move"
                          }`}
                          style={{
                            backgroundColor: "black",
                            imageRendering: "auto",
                            userSelect: "none",
                          }}
                        />
                        {/* Dose Overlay Canvas */}
                        <canvas
                          ref={doseOverlayCanvasRef}
                          width={1536}
                          height={1536}
                          className="pointer-events-none absolute max-w-full max-h-full object-contain"
                          style={{
                            visibility: (!doseVisible || doseOpacity === 0) ? 'hidden' : 'visible',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 3,
                            opacity: Math.max(0, Math.min(1, doseOpacity)),
                            mixBlendMode: 'screen',
                          }}
                        />
                        <canvas
                          ref={contoursOverlayCanvasRef}
                          width={1536}
                          height={1536}
                          className="pointer-events-none absolute max-w-full max-h-full object-contain"
                          style={{
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 4,
                          }}
                        />
                      </div>
                      
                      {/* Secondary/Fusion Canvas Container - flex ratio based on layout preset */}
                      <div className={`relative flex items-center justify-center bg-black ${
                        props.fusionLayoutPreset === 'primary-focus' ? 'flex-[3]' :
                        props.fusionLayoutPreset === 'secondary-focus' ? 'flex-[7]' :
                        'flex-1'
                      }`}>
                        <canvas
                          ref={fusionOverlayCanvasRef}
                          width={1536}
                          height={1536}
                          className="max-w-full max-h-full object-contain rounded"
                          style={{
                            backgroundColor: "black",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Overlay Layout for Axial */
                    <div className="relative w-full h-full flex items-center justify-center">
                      <canvas
                        ref={canvasRef}
                        width={1536}
                        height={1536}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={(e) => {
                          handleCanvasMouseMove(e);
                        }}
                        onMouseUp={handleCanvasMouseUp}
                        onWheel={(e) => {
                          handleCanvasWheel(e);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`max-w-full max-h-full object-contain rounded ${
                          brushToolState?.isActive && brushToolState?.tool === "brush"
                            ? "cursor-none"
                            : brushToolState?.isActive && (brushToolState?.tool === "pen" || brushToolState?.tool === "pen-original")
                            ? ""
                            : "cursor-move"
                        }`}
                        style={{
                          backgroundColor: "black",
                          imageRendering: "auto",
                          userSelect: "none",
                        }}
                      />
                      <canvas
                        ref={fusionOverlayCanvasRef}
                        width={1536}
                        height={1536}
                        className="pointer-events-none absolute max-w-full max-h-full object-contain"
                        style={{
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 1,
                        }}
                      />
                      {/* Dose Overlay Canvas */}
                      <canvas
                        ref={doseOverlayCanvasRef}
                        width={1536}
                        height={1536}
                        className="pointer-events-none absolute max-w-full max-h-full object-contain"
                        style={{
                          visibility: (!doseVisible || doseOpacity === 0) ? 'hidden' : 'visible',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 3,
                          opacity: Math.max(0, Math.min(1, doseOpacity)),
                          mixBlendMode: 'screen',
                        }}
                      />
                      <canvas
                        ref={contoursOverlayCanvasRef}
                        width={1536}
                        height={1536}
                        className="pointer-events-none absolute max-w-full max-h-full object-contain"
                        style={{
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 4,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: Sagittal + Coronal stacked */}
              <div className="flex-shrink-0 flex flex-col gap-2" style={{ width: '400px' }}>
                {/* Sagittal view */}
                <div className="flex-1 min-h-0 relative bg-black">
                  <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white/90 font-bold border border-white/20">
                    Sagittal
                  </div>
                  <div className="w-full h-full flex items-center justify-center">
                    <MPRFloating
                      images={images}
                      orientation="sagittal"
                      sliceIndex={Math.max(0, Math.min(crosshairPos.x, (images[0]?.columns || 512) - 1))}
                      windowWidth={currentWindowLevel.width}
                      windowCenter={currentWindowLevel.center}
                      crosshairPos={crosshairPos}
                      rtStructures={rtStructures}
                      structureVisibility={structureVisibility}
                      currentZIndex={currentIndex}
                      onClick={handleSagittalClick}
                    />
                    {isLoadingMPR && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
                        <div className="w-8 h-8 border-2 border-gray-600 border-t-yellow-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Coronal view */}
                <div className="flex-1 min-h-0 relative bg-black">
                  <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white/90 font-bold border border-white/20">
                    Coronal
                  </div>
                  <div className="w-full h-full flex items-center justify-center">
                    <MPRFloating
                      images={images}
                      orientation="coronal"
                      sliceIndex={Math.max(0, Math.min(crosshairPos.y, (images[0]?.rows || 512) - 1))}
                      windowWidth={currentWindowLevel.width}
                      windowCenter={currentWindowLevel.center}
                      crosshairPos={crosshairPos}
                      rtStructures={rtStructures}
                      structureVisibility={structureVisibility}
                      currentZIndex={currentIndex}
                      onClick={handleCoronalClick}
                    />
                    {isLoadingMPR && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
                        <div className="w-8 h-8 border-2 border-gray-600 border-t-yellow-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
          /* Normal Layout */
          <div className="flex-1 flex items-center justify-center relative overflow-hidden min-w-0 min-h-0">
            {fusionDisplayMode === 'side-by-side' && secondarySeriesId ? (
              /* Side-by-Side Layout - supports different split ratios */
              <div className={`w-full h-full gap-2 ${
                props.fusionLayoutPreset === 'vertical-stack' ? 'flex flex-col' : 'flex'
              }`}>
                {/* Primary Canvas Container - flex ratio based on layout preset */}
                <div className={`relative flex items-center justify-center bg-black ${
                  props.fusionLayoutPreset === 'primary-focus' ? 'flex-[7]' :
                  props.fusionLayoutPreset === 'secondary-focus' ? 'flex-[3]' :
                  'flex-1'
                }`}>
              <canvas
                ref={canvasRef}
                width={1536}
                height={1536}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={(e) => {
                  handleCanvasMouseMove(e);
                }}
                onMouseUp={handleCanvasMouseUp}
                onWheel={(e) => {
                  handleCanvasWheel(e);
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`max-w-full max-h-full object-contain rounded ${
                  brushToolState?.isActive && brushToolState?.tool === "brush"
                    ? "cursor-none"
                    : brushToolState?.isActive && (brushToolState?.tool === "pen" || brushToolState?.tool === "pen-original")
                    ? ""
                    : "cursor-move"
                }`}
                style={{
                  backgroundColor: "black",
                  imageRendering: "auto",
                  userSelect: "none",
                }}
              />
              {/* Dose Overlay Canvas */}
              <canvas
                ref={doseOverlayCanvasRef}
                width={1536}
                height={1536}
                className="pointer-events-none absolute max-w-full max-h-full object-contain"
                style={{
                  visibility: (!doseVisible || doseOpacity === 0) ? 'hidden' : 'visible',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 3,
                  opacity: Math.max(0, Math.min(1, doseOpacity)),
                  mixBlendMode: 'screen',
                }}
              />
              <canvas
                ref={contoursOverlayCanvasRef}
                width={1536}
                height={1536}
                className="pointer-events-none absolute max-w-full max-h-full object-contain"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 4,
                }}
              />
              
              {/* Prediction Overlay */}
              {activePredictions.size > 0 && selectedForEdit && images.length > 0 && images[currentIndex] && (() => {
                const rawSlicePos =
                  images[currentIndex].sliceZ ??
                  images[currentIndex].parsedSliceLocation ??
                  images[currentIndex].parsedZPosition ??
                  currentIndex;
                const parsedSlicePos =
                  typeof rawSlicePos === "string"
                    ? parseFloat(rawSlicePos)
                    : rawSlicePos;
                const currentSlicePos = normalizeSlicePosition(
                  Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
                );
                const structure = rtStructures?.structures?.find((s: any) => s.roiNumber === selectedForEdit);
                const hasContour = structure?.contours?.some((c: any) => 
                  !c.isPredicted && Math.abs(c.slicePosition - currentSlicePos) <= SLICE_TOL_MM
                ) || false;
                
                return (
                  <>
                    <PredictionOverlay
                      canvasRef={canvasRef}
                      predictions={activePredictions}
                      currentSlicePosition={currentSlicePos}
                      selectedStructureColor={structure?.color || [255, 255, 255]}
                      ctTransform={ctTransform.current || { scale: 1, offsetX: 0, offsetY: 0 }}
                  worldToCanvas={worldToCanvas}
                  imageMetadata={imageMetadata}
                  showLabels={true}
                  hasContourOnCurrentSlice={hasContour}
                />
              </>
            );
              })()}
            </div>
            
            {/* Secondary/Fusion Canvas Container - flex ratio based on layout preset */}
            <div className={`relative flex items-center justify-center bg-black ${
              props.fusionLayoutPreset === 'primary-focus' ? 'flex-[3]' :
              props.fusionLayoutPreset === 'secondary-focus' ? 'flex-[7]' :
              'flex-1'
            }`}>
              <canvas
                ref={fusionOverlayCanvasRef}
                width={1536}
                height={1536}
                className="max-w-full max-h-full object-contain rounded"
                style={{
                  backgroundColor: "black",
                }}
              />
            </div>
          </div>
        ) : (
          /* Overlay Layout */
          <div className="relative w-full h-full flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={1536}
              height={1536}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={(e) => {
                handleCanvasMouseMove(e);
                // Crosshair position is only updated on click in crosshair mode
                // Not on mouse move
              }}
              onMouseUp={handleCanvasMouseUp}
              onWheel={(e) => {
                // Always handle wheel events for scrolling, even when pen tool is active
                handleCanvasWheel(e);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`max-w-full max-h-full object-contain rounded ${
                brushToolState?.isActive && brushToolState?.tool === "brush"
                  ? "cursor-none"
                  : brushToolState?.isActive && (brushToolState?.tool === "pen" || brushToolState?.tool === "pen-original")
                  ? ""
                  : "cursor-move"
              }`}
              style={{
                backgroundColor: "black",
                imageRendering: "auto",
                userSelect: "none",
                opacity: secondarySeriesId && fusionDisplayMode === 'overlay' ? (1 - fusionOpacity) : 1,
                transition: 'opacity 120ms ease-out',
              }}
            />

            <canvas
              ref={fusionOverlayCanvasRef}
              width={1536}
              height={1536}
              className="pointer-events-none absolute max-w-full max-h-full object-contain"
              style={{
                visibility: fusionOpacity === 0 ? 'hidden' : 'visible',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                opacity: Math.max(0, Math.min(1, fusionOpacity)),
              }}
            />

            {/* Dose Overlay Canvas */}
            <canvas
              ref={doseOverlayCanvasRef}
              width={1536}
              height={1536}
              className="pointer-events-none absolute max-w-full max-h-full object-contain"
              style={{
                visibility: (!doseVisible || doseOpacity === 0) ? 'hidden' : 'visible',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                opacity: Math.max(0, Math.min(1, doseOpacity)),
              }}
            />

            <canvas
              ref={contoursOverlayCanvasRef}
              width={1536}
              height={1536}
              className="pointer-events-none absolute max-w-full max-h-full object-contain"
              style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 4,
              }}
            />
            
            {/* Prediction Overlay */}
            {activePredictions.size > 0 && selectedForEdit && images.length > 0 && images[currentIndex] && (() => {
              const rawSlicePos =
                images[currentIndex].sliceZ ??
                images[currentIndex].parsedSliceLocation ??
                images[currentIndex].parsedZPosition ??
                currentIndex;
              const parsedSlicePos =
                typeof rawSlicePos === "string"
                  ? parseFloat(rawSlicePos)
                  : rawSlicePos;
              const currentSlicePos = normalizeSlicePosition(
                Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
              );
              const structure = rtStructures?.structures?.find((s: any) => s.roiNumber === selectedForEdit);
              const hasContour = structure?.contours?.some((c: any) => 
                !c.isPredicted && Math.abs(c.slicePosition - currentSlicePos) <= SLICE_TOL_MM
              ) || false;
              
              return (
                <>
                  <PredictionOverlay
                    canvasRef={canvasRef}
                    predictions={activePredictions}
                    currentSlicePosition={currentSlicePos}
                    selectedStructureColor={structure?.color || [255, 255, 255]}
                    ctTransform={ctTransform.current || { scale: 1, offsetX: 0, offsetY: 0 }}
                    worldToCanvas={worldToCanvas}
                    imageMetadata={imageMetadata}
                    showLabels={true}
                    hasContourOnCurrentSlice={hasContour}
                  />
                </>
              );
            })()}
          </div>
        )}
          
          {/* Compact MPR Overlay - shown when sidebar is hidden but MPR is enabled */}
          {hideSidebar && mprVisible && orientation === 'axial' && images.length > 0 && (
            <div className="absolute bottom-2 right-2 flex gap-2 z-30">
              {/* Sagittal mini view */}
              <div className="w-32 h-32 bg-black/90 rounded-lg border border-cyan-500/50 overflow-hidden shadow-lg">
                <div className="text-[10px] text-cyan-400 font-semibold px-1.5 py-0.5 bg-black/80 border-b border-cyan-500/30">
                  Sagittal
                </div>
                <div className="w-full h-[calc(100%-20px)]">
                  <MPRFloating
                    images={images}
                    orientation="sagittal"
                    sliceIndex={Math.max(0, Math.min(crosshairPos.x, (images[0]?.columns || 512) - 1))}
                    windowWidth={currentWindowLevel.width}
                    windowCenter={currentWindowLevel.center}
                    crosshairPos={crosshairPos}
                    rtStructures={rtStructures}
                    currentZIndex={currentIndex}
                    onClick={handleSagittalClick}
                  />
                </div>
              </div>
              
              {/* Coronal mini view */}
              <div className="w-32 h-32 bg-black/90 rounded-lg border border-purple-500/50 overflow-hidden shadow-lg">
                <div className="text-[10px] text-purple-400 font-semibold px-1.5 py-0.5 bg-black/80 border-b border-purple-500/30">
                  Coronal
                </div>
                <div className="w-full h-[calc(100%-20px)]">
                  <MPRFloating
                    images={images}
                    orientation="coronal"
                    sliceIndex={Math.max(0, Math.min(crosshairPos.y, (images[0]?.rows || 512) - 1))}
                    windowWidth={currentWindowLevel.width}
                    windowCenter={currentWindowLevel.center}
                    crosshairPos={crosshairPos}
                    rtStructures={rtStructures}
                    currentZIndex={currentIndex}
                    onClick={handleCoronalClick}
                  />
                </div>
              </div>
            </div>
          )}
          </div>
          )}

          {/* Invisible Right Sidebar - 24rem width for MPR windows and Fusion panel - hidden in compact mode */}
          {!hideSidebar && (
          <div 
            ref={(el) => {
              // Expose sidebar ref for fusion panel placement
              if (el && (window as any).__workingViewerSidebarRef) {
                (window as any).__workingViewerSidebarRef.current = el;
              }
            }}
            className="w-96 flex-shrink-0 flex flex-col gap-3 relative overflow-y-auto" 
            style={{ minHeight: 0 }}
          >
            {/* Fusion panel will be rendered here via portal */}

            {/* MPR windows will be rendered here - only in floating layout mode */}
            {orientation === 'axial' && images.length > 0 && mprVisible && viewportLayout === 'floating' && (
              <>
                {/* Sagittal view */}
                <div className="mpr-window">
                  <div className="mpr-window-header flex justify-between items-center">
                    <span className="font-bold">Sagittal</span>
                  </div>
                  <div className="mpr-canvas-container">
                    <MPRFloating
                      images={images}
                      orientation="sagittal"
                      sliceIndex={Math.max(0, Math.min(crosshairPos.x, (images[0]?.columns || 512) - 1))}
                      windowWidth={currentWindowLevel.width}
                      windowCenter={currentWindowLevel.center}
                      crosshairPos={crosshairPos}
                      rtStructures={rtStructures}
                      currentZIndex={currentIndex}
                      onClick={handleSagittalClick}
                    />
                    {isLoadingMPR && (
                      <div className="mpr-loading">
                        <div className="mpr-loading-spinner" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Coronal view */}
                <div className="mpr-window">
                  <div className="mpr-window-header flex justify-between items-center">
                    <span className="font-bold">Coronal</span>
                  </div>
                  <div className="mpr-canvas-container">
                    <MPRFloating
                      images={images}
                      orientation="coronal"
                      sliceIndex={Math.max(0, Math.min(crosshairPos.y, (images[0]?.rows || 512) - 1))}
                      windowWidth={currentWindowLevel.width}
                      windowCenter={currentWindowLevel.center}
                      crosshairPos={crosshairPos}
                      rtStructures={rtStructures}
                      currentZIndex={currentIndex}
                      onClick={handleCoronalClick}
                    />
                    {isLoadingMPR && (
                      <div className="mpr-loading">
                        <div className="mpr-loading-spinner" />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          )}
        </div>

        {/* Ghost Contour Overlay Container - needs relative positioning for absolute child */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
          {/* Ghost Contour Overlay - shows strokes from other viewports */}
          <GhostContourOverlay
            viewportId={viewportId}
            canvasRef={canvasRef}
            currentSlicePosition={(() => {
              if (images.length === 0 || !images[currentIndex]) return 0;
              const rawSlicePos =
                images[currentIndex].sliceZ ??
                images[currentIndex].parsedSliceLocation ??
                images[currentIndex].parsedZPosition ??
                0;
              const parsedSlicePos =
                typeof rawSlicePos === "string"
                  ? parseFloat(rawSlicePos)
                  : rawSlicePos;
              return Number.isFinite(parsedSlicePos) ? parsedSlicePos : 0;
            })()}
            sliceTolerance={imageMetadata?.sliceThickness ? parseFloat(imageMetadata.sliceThickness) / 2 : 1.0}
            enabled={true}
            ghostOpacity={0.5}
            imageMetadata={imageMetadata}
            ctTransform={ctTransform}
          />
        </div>
          
          {/* Simple Brush Tool overlay */}
          {brushToolState?.isActive &&
            brushToolState?.tool === "brush" && (
              <SimpleBrushTool
                canvasRef={canvasRef}
                isActive={brushToolState.isActive}
                brushSize={brushToolState.brushSize}
                selectedStructure={selectedForEdit}
                rtStructures={rtStructures}
                currentSlicePosition={(() => {
                  if (images.length === 0 || !images[currentIndex]) return currentIndex;
                  const rawSlicePos =
                    images[currentIndex].sliceZ ??
                    images[currentIndex].parsedSliceLocation ??
                    images[currentIndex].parsedZPosition ??
                    currentIndex;
                  const parsedSlicePos =
                    typeof rawSlicePos === "string"
                      ? parseFloat(rawSlicePos)
                      : rawSlicePos;
                  return normalizeSlicePosition(
                    Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
                  );
                })()}
                onContourUpdate={(payload: any) => {
                  // Handle different types of contour updates
                  if (payload.action === "grow_contour") {
                    handleGrowContour(payload);
                  } else {
                    handleContourUpdate(payload);
                  }
                }}
                zoom={zoom}
                panX={panX}
                panY={panY}
                imageMetadata={imageMetadata}
                smoothingEnabled={true}
                enableSmartMode={true}
                predictionEnabled={brushToolState.predictionEnabled ?? false}
                smartBrushEnabled={!!brushToolState.smartBrushEnabled}
                ctTransform={ctTransform}
                dicomImage={images.length > 0 && images[currentIndex] ? images[currentIndex] : null}
                onBrushModeChange={(mode: BrushOperation) => {
                  console.log("Brush mode changed:", mode);
                }}
                onBrushSizeChange={(newSize: number) => {
                  if (onBrushSizeChange) {
                    onBrushSizeChange(newSize);
                  }
                  if (onBrushToolChange) {
                    onBrushToolChange({
                      ...brushToolState,
                      brushSize: newSize
                    });
                  }
                }}
                onPreviewUpdate={(contours: any[] | null) => {
                  setPreviewContours(contours || []);
                }}
                activePredictions={activePredictions}
                viewportId={viewportId}
              />
            )}

          {/* Erase Tool overlay - works like brush but erases */}
          {brushToolState?.isActive &&
            brushToolState?.tool === "erase" && (
              <SimpleBrushTool
                canvasRef={canvasRef}
                isActive={brushToolState.isActive}
                brushSize={brushToolState.brushSize}
                selectedStructure={selectedForEdit}
                rtStructures={rtStructures}
                currentSlicePosition={(() => {
                  if (images.length === 0 || !images[currentIndex]) return currentIndex;
                  const rawSlicePos =
                    images[currentIndex].sliceZ ??
                    images[currentIndex].parsedSliceLocation ??
                    images[currentIndex].parsedZPosition ??
                    currentIndex;
                  const parsedSlicePos =
                    typeof rawSlicePos === "string"
                      ? parseFloat(rawSlicePos)
                      : rawSlicePos;
                  return normalizeSlicePosition(
                    Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
                  );
                })()}
                onContourUpdate={(payload: any) => {
                  // Handle different types of contour updates
                  if (payload.action === "grow_contour") {
                    handleGrowContour(payload);
                  } else {
                    handleContourUpdate(payload);
                  }
                }}
                zoom={zoom}
                panX={panX}
                panY={panY}
                imageMetadata={imageMetadata}
                smoothingEnabled={true}
                enableSmartMode={true}
                predictionEnabled={brushToolState.predictionEnabled ?? false}
                smartBrushEnabled={!!brushToolState.smartBrushEnabled}
                ctTransform={ctTransform}
                dicomImage={images.length > 0 && images[currentIndex] ? images[currentIndex] : null}
                isEraseMode={true} // Pass erase mode flag
                onBrushModeChange={(mode: BrushOperation) => {
                  console.log("Erase mode changed:", mode);
                }}
                onBrushSizeChange={(newSize: number) => {
                  if (onBrushSizeChange) {
                    onBrushSizeChange(newSize);
                  }
                  if (onBrushToolChange) {
                    onBrushToolChange({
                      ...brushToolState,
                      brushSize: newSize
                    });
                  }
                }}
                onPreviewUpdate={(contours: any[] | null) => {
                  setPreviewContours(contours || []);
                }}
                activePredictions={activePredictions}
                viewportId={viewportId}
              />
            )}

          {/* Eclipse Pen Tool V2 - Clean implementation with proper boolean operations */}
          {brushToolState?.isActive &&
            brushToolState?.tool === "pen" &&
            selectedForEdit && (
              <PenToolV2
                isActive={brushToolState.isActive}
                selectedStructure={selectedForEdit}
                rtStructures={rtStructures}
                currentSlicePosition={(() => {
                  if (images.length === 0 || !images[currentIndex]) return currentIndex;
                  const rawSlicePos =
                    images[currentIndex].sliceZ ??
                    images[currentIndex].parsedSliceLocation ??
                    images[currentIndex].parsedZPosition ??
                    currentIndex;
                  const parsedSlicePos =
                    typeof rawSlicePos === "string"
                      ? parseFloat(rawSlicePos)
                      : rawSlicePos;
                  return normalizeSlicePosition(
                    Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
                  );
                })()}
                imageMetadata={imageMetadata}
                onContourUpdate={(payload: any) => {
                  handleContourUpdate(payload);
                }}
                canvasRef={canvasRef}
                ctTransform={ctTransform}
              />
            )}

          {/* Eclipse Planar Contour Tool - Using PenToolUnifiedV2 */}
          {brushToolState?.isActive &&
            brushToolState?.tool === "planar-contour" &&
            selectedForEdit && (
              <PenToolUnifiedV2
                canvasRef={canvasRef}
                isActive={brushToolState.isActive}
                selectedStructure={selectedForEdit}
                rtStructures={rtStructures}
                onContourUpdate={(payload: any) => {
                  handleContourUpdate(payload);
                }}
                imageMetadata={imageMetadata}
                worldToCanvas={worldToCanvas}
                canvasToWorld={canvasToWorld}
                viewportId={viewportId}
              />
            )}

          {/* Original Pen Tool overlay */}
          {brushToolState?.isActive &&
            brushToolState?.tool === "pen-original" &&
            selectedForEdit && (
              <PenTool
                canvasRef={canvasRef}
                isActive={brushToolState.isActive}
                selectedStructure={selectedForEdit}
                rtStructures={rtStructures}
                currentSlicePosition={(() => {
                  if (images.length === 0 || !images[currentIndex]) return currentIndex;
                  const rawSlicePos =
                    images[currentIndex].sliceZ ??
                    images[currentIndex].parsedSliceLocation ??
                    images[currentIndex].parsedZPosition ??
                    currentIndex;
                  const parsedSlicePos =
                    typeof rawSlicePos === "string"
                      ? parseFloat(rawSlicePos)
                      : rawSlicePos;
                  return Number.isFinite(parsedSlicePos)
                    ? parsedSlicePos
                    : currentIndex;
                })()}
                onContourUpdate={(payload: any) => {
                  handleContourUpdate(payload);
                }}
                zoom={zoom}
                panX={panX}
                panY={panY}
                imageMetadata={imageMetadata}
              />
            )}

          {/* AI Tumor Tool - Interactive 3D segmentation with single click */}
          {brushToolState?.isActive &&
            brushToolState?.tool === "interactive-tumor" && selectedForEdit && (
              <AITumorTool
                canvasRef={canvasRef}
                isActive={brushToolState.isActive}
                brushSize={brushToolState.brushSize}
                selectedStructure={
                  rtStructures?.structures?.find((s: any) => s.roiNumber === selectedForEdit) ||
                  { structureName: 'Unknown', color: [255, 255, 255], roiNumber: selectedForEdit }
                }
                currentSlicePosition={(() => {
                  if (images.length === 0 || !images[currentIndex]) return currentIndex;
                  const rawSlicePos =
                    images[currentIndex].sliceZ ??
                    images[currentIndex].parsedSliceLocation ??
                    images[currentIndex].parsedZPosition ??
                    currentIndex;
                  const parsedSlicePos =
                    typeof rawSlicePos === "string"
                      ? parseFloat(rawSlicePos)
                      : rawSlicePos;
                  return normalizeSlicePosition(
                    Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
                  );
                })()}
                zoom={zoom}
                panX={panX}
                panY={panY}
                imageMetadata={imageMetadata}
                onContourUpdate={(payload: any) => {
                  handleContourUpdate(payload);
                }}
                dicomImages={images}
                currentIndex={currentIndex}
                ctTransform={ctTransform.current || { scale: 1, offsetX: 0, offsetY: 0 }}
                worldToCanvas={worldToCanvas}
                canvasToWorld={canvasToWorld}
                imageCacheRef={imageCacheRef}
                secondarySeriesId={secondarySeriesId}
                registrationMatrix={registrationMatrix}
                smoothOutput={(brushToolState as any)?.aiTumorSmoothOutput ?? false}
                useSAM={(brushToolState as any)?.aiTumorUseSAM ?? false}
                onShowPrimarySeries={() => {
                  // Switch back to primary series to show CT contours
                  if (onSecondarySeriesSelect) {
                    onSecondarySeriesSelect(null);
                  }
                }}
              />
            )}

          {/* Measurement Tool overlay */}
          {isMeasurementToolActive && (
            <MeasurementTool
              canvasRef={canvasRef}
              isActive={isMeasurementToolActive}
              imageMetadata={imageMetadata}
              ctTransform={ctTransform.current ? {
                current: {
                  scale: ctTransform.current.scale,
                  offsetX: ctTransform.current.offsetX,
                  offsetY: ctTransform.current.offsetY
                }
              } as React.MutableRefObject<{ scale: number; offsetX: number; offsetY: number }> : null}
              currentSlicePosition={(() => {
                if (images.length === 0 || !images[currentIndex]) return currentIndex;
                const rawSlicePos =
                  images[currentIndex].sliceZ ??
                  images[currentIndex].parsedSliceLocation ??
                  images[currentIndex].parsedZPosition ??
                  currentIndex;
                const parsedSlicePos =
                  typeof rawSlicePos === "string"
                    ? parseFloat(rawSlicePos)
                    : rawSlicePos;
                return normalizeSlicePosition(
                  Number.isFinite(parsedSlicePos) ? parsedSlicePos : currentIndex
                );
              })()}
              onMeasurementComplete={(distance, unit) => {
                console.log(`Measurement completed: ${distance.toFixed(1)} ${unit}`);
              }}
            />
          )}

          {/* Blob removal dialog */}
          <BlobManagementDialog
            isOpen={blobDialogOpen}
            onClose={() => {
              setBlobDialogOpen(false);
              setHighlightedBlobId(null);
              lastLocalizedBlobRef.current = null;
            }}
            blobs={blobDialogData?.blobs || []}
            structureId={blobDialogData?.structureId || 0}
            structureName={rtStructures?.structures?.find((s: any) => s.roiNumber === blobDialogData?.structureId)?.structureName || 'Structure'}
            structureColor={rtStructures?.structures?.find((s: any) => s.roiNumber === blobDialogData?.structureId)?.color}
            onDeleteBlobs={handleBlobsDelete}
            onLocalize={handleBlobLocalize}
            onToggleOtherContours={(hide) => {
              // Structure visibility is managed by parent component via externalStructureVisibility prop
              // This callback currently can't modify visibility - would need onStructureVisibilityChange prop
              console.log('[BlobManagement] Toggle other contours requested:', hide ? 'hide' : 'show');
              scheduleRender(true);
            }}
            imageMetadata={imageMetadata}
          />

        {/* Fusion Debug Aid */}
        <AlertDialog open={showFusionDebug} onOpenChange={(open) => setShowFusionDebug(open)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Fusion Debug Info</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-gray-300">Copy and paste this back for analysis.</p>
              <textarea
                readOnly
                value={fusionDebugText}
                className="w-full h-64 p-2 text-xs bg-black/60 border border-gray-600 rounded-md text-gray-200 font-mono"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction onClick={() => { try { navigator.clipboard.writeText(fusionDebugText); } catch {} }}>Copy</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* REG Details popup */}
        <AlertDialog open={showRegDetails} onOpenChange={(open) => setShowRegDetails(open)}>
          <AlertDialogContent className="max-w-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Registration Details (for Eclipse compare)</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-2">
              <textarea
                readOnly
                value={regDetailsText}
                className="w-full h-80 p-2 text-xs bg-black/60 border border-gray-600 rounded-md text-gray-200 font-mono"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction onClick={() => { try { navigator.clipboard.writeText(regDetailsText); } catch {} }}>Copy</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </Card>
  );
});

WorkingViewer.displayName = 'WorkingViewer';

export { WorkingViewer };

declare global {
  interface Window {
    dicomParser: any;
    workingViewerZoomIn?: () => void;
    workingViewerZoomOut?: () => void;
    workingViewerResetZoom?: () => void;
  }
}
