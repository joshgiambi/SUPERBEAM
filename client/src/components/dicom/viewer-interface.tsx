import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SeriesSelector } from './series-selector';
import { WorkingViewer } from './working-viewer';
import { FlexibleFusionLayout } from './flexible-fusion-layout';
import { BottomToolbarPrototypeV2 } from './bottom-toolbar-prototype-v2';
import { ContourEditToolbar } from './contour-edit-toolbar';
import { FusionControlPanelV2, type FusionLayoutPreset } from './fusion-control-panel-v2';
import { RadiationTherapyPanel } from './radiation-therapy-panel';
import type { DoseColormap, RTDoseMetadata } from '@/lib/rt-dose-manager';
import type { BeamSummary, BEVProjection } from '@/types/rt-plan';
import { UnifiedFusionTopbar } from './unified-fusion-topbar';
import { ErrorModal } from './error-modal';
import { BooleanPipelinePrototypeCombined } from './boolean-pipeline-prototype-combined';
import { X, Target, Bookmark, Save, LayoutGrid } from 'lucide-react';
import { undoRedoManager } from '@/lib/undo-system';
import { log } from '@/lib/log';
import { Button } from '@/components/ui/button';
import { MarginOperationsPrototype } from './margin-operations-prototype';
import { useToast } from '@/hooks/use-toast';
import { contoursToVIP } from '@/boolean/integrate';
import { union as vipUnion, intersect as vipIntersect, subtract as vipSubtract } from '@/boolean/vipBoolean';
import { vipToRectContours } from '@/boolean/simpleContours';
import { DICOMSeries, DICOMStudy, WindowLevel, WINDOW_LEVEL_PRESETS } from '@/lib/dicom-utils';
import type { RegistrationAssociation, RegistrationSeriesDetail } from '@/types/fusion';
import type { FusionManifest, FusionSecondaryDescriptor } from '@/types/fusion';
import { fetchFusionManifest, preloadFusionSecondary, getFusionManifest, clearFusionCaches } from '@/lib/fusion-utils';
import { cornerstoneConfig } from '@/lib/cornerstone-config';
import { LoadingProgress } from './loading-progress';
import { fusionLayoutService, useFusionLayoutService } from '@/lib/fusion-layout-service';
import { ContourEditProvider } from '@/contexts/contour-edit-context';
import { globalSeriesCache } from '@/lib/global-series-cache';
import { globalFusionCache } from '@/lib/global-fusion-cache';
import { useRTAutoSave } from '@/hooks/useRTAutoSave';

// TypeScript declaration for cornerstone
declare global {
  interface Window {
    cornerstone: any;
  }
}


interface ViewerInterfaceProps {
  studyData: any;
  onContourSettingsChange?: (settings: { width: number; opacity: number }) => void;
  contourSettings?: { width: number; opacity: number };
  onLoadedRTSeriesChange?: (seriesId: number | null) => void;
}

export function ViewerInterface({ studyData, onContourSettingsChange, contourSettings, onLoadedRTSeriesChange }: ViewerInterfaceProps) {
  const { toast } = useToast();
  const [selectedSeries, setSelectedSeries] = useState<DICOMSeries | null>(null);
  const [windowLevel, setWindowLevel] = useState<WindowLevel>(WINDOW_LEVEL_PRESETS['Soft Tissue']);
  const [error, setError] = useState<any>(null);
  const [series, setSeries] = useState<DICOMSeries[]>([]);
  const [visibleSeries, setVisibleSeries] = useState<DICOMSeries[]>([]);
  const [regAssociations, setRegAssociations] = useState<Record<number, number[]>>({});
  const [registrationRelationshipMap, setRegistrationRelationshipMap] = useState<Map<number, RegistrationAssociation[]>>(new Map());
  // Single-view mode only; MPR uses floating windows inside WorkingViewer
  const [activeToolMode, setActiveToolMode] = useState<'pan' | 'crosshairs' | 'measure'>('pan'); // Default to pan mode
  
  // Shared image cache to prevent reloading when switching modes
  const imageCache = useRef<Map<string, { images: any[], metadata: any }>>(new Map());
  
  const [rtStructures, setRTStructures] = useState<any>(null);
  const [structureVisibility, setStructureVisibility] = useState<Map<number, boolean>>(new Map());
  const [selectedStructures, setSelectedStructures] = useState<Set<number>>(new Set());
  const [selectedStructureColors, setSelectedStructureColors] = useState<string[]>([]);
  const [selectedForEdit, setSelectedForEdit] = useState<number | null>(null);
  const [isContourEditMode, setIsContourEditMode] = useState(false);
  const [brushToolState, setBrushToolState] = useState({
    tool: null as string | null,
    brushSize: 3,
    isActive: false,
    predictionEnabled: false
  });
  const [currentSlicePosition, setCurrentSlicePosition] = useState<number>(0); // Z position (mm)
  const [currentSliceIndex, setCurrentSliceIndex] = useState<number>(0); // Slice index (0-based)
  const [autoZoomLevel, setAutoZoomLevel] = useState<number | undefined>(undefined);
  const [autoLocalizeTarget, setAutoLocalizeTarget] = useState<{ x: number; y: number; z: number } | undefined>(undefined);
  const workingViewerRef = useRef<any>(null);
  const [imageMetadata, setImageMetadata] = useState<any>(null);
  const [activePredictions, setActivePredictions] = useState<Map<number, any>>(new Map());
  
  // Fusion state
  const [showFusionPanel, setShowFusionPanel] = useState(false);
  const [secondarySeriesId, setSecondarySeriesId] = useState<number | null>(null);
  const [fusionOpacity, setFusionOpacity] = useState(0.5);
  const [fusionDisplayMode, setFusionDisplayMode] = useState<'overlay' | 'side-by-side'>('overlay');
  
  // RT Dose state
  const [showDosePanel, setShowDosePanel] = useState(false);
  const [selectedDoseSeriesId, setSelectedDoseSeriesId] = useState<number | null>(null);
  const [doseSeries, setDoseSeries] = useState<any[]>([]);
  const [doseOpacity, setDoseOpacity] = useState(0.5);
  const [doseColormap, setDoseColormap] = useState<DoseColormap>('rainbow');
  const [showIsodose, setShowIsodose] = useState(false);
  const [doseVisible, setDoseVisible] = useState(true);
  const [doseMetadata, setDoseMetadata] = useState<RTDoseMetadata | null>(null);
  const [doseLoading, setDoseLoading] = useState(false);
  const [prescriptionDose, setPrescriptionDose] = useState(60);
  const [dosePanelMinimized, setDosePanelMinimized] = useState(false);
  
  // RT Plan / Beam state
  const [planSeries, setPlanSeries] = useState<any[]>([]);
  const [selectedPlanSeriesId, setSelectedPlanSeriesId] = useState<number | null>(null);
  const [showBeamOverlay, setShowBeamOverlay] = useState(false);
  const [selectedBeamNumber, setSelectedBeamNumber] = useState<number | null>(null);
  const [beamOverlayOpacity, setBeamOverlayOpacity] = useState(0.7);
  const [loadedBeams, setLoadedBeams] = useState<BeamSummary[]>([]);
  const [loadedBEVProjections, setLoadedBEVProjections] = useState<BEVProjection[]>([]);
  // Flexible fusion layout state
  const [fusionLayoutPreset, setFusionLayoutPreset] = useState<FusionLayoutPreset>('overlay');
  const [enableFlexibleLayout, setEnableFlexibleLayout] = useState(true); // Enable by default
  // Secondary loading states for visual feedback
  const [secondaryLoadingStates, setSecondaryLoadingStates] = useState<Map<number, {progress: number, isLoading: boolean}>>(new Map());
  const [currentlyLoadingSecondary, setCurrentlyLoadingSecondary] = useState<number | null>(null);
  const [fusionManifest, setFusionManifest] = useState<FusionManifest | null>(null);
  const [fusionManifestError, setFusionManifestError] = useState<string | null>(null);
  const [fusionManifestLoading, setFusionManifestLoading] = useState(false);
  const [fusionWindowLevel, setFusionWindowLevel] = useState<{ window: number; level: number } | null>(null);
  const fusionManifestRequestRef = useRef(0);
  const [manifestActionStatus, setManifestActionStatus] = useState<string | null>(null);
  const [fusionDebugSnapshot, setFusionDebugSnapshot] = useState<string | null>(null);
  
  // All structures visibility state for syncing between RT button and hide all button
  const [allStructuresVisible, setAllStructuresVisible] = useState(true);
  
  // Track loaded RT series for selection state
  const [loadedRTSeriesId, setLoadedRTSeriesId] = useState<number | null>(null);
  
  // Auto-save RT structures with 5-second debounce
  const { saveStatus, lastSaved, error: autoSaveError, saveNow } = useRTAutoSave({
    seriesId: loadedRTSeriesId,
    structures: rtStructures?.structures || null,
    enabled: !!loadedRTSeriesId && !!rtStructures?.structures,
    debounceMs: 5000,
    onSaveSuccess: () => {
      console.log('✅ RT structures auto-saved successfully');
    },
    onSaveError: (error) => {
      console.error('❌ RT structures auto-save failed:', error);
      toast({
        title: 'Auto-save failed',
        description: error.message || 'Failed to save RT structures',
        variant: 'destructive',
      });
    }
  });
  
  // MPR visibility state
  const [mprVisible, setMprVisible] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  // Synced state for multi-viewport layouts (FlexibleFusionLayout and side-by-side)
  const [syncedZoom, setSyncedZoom] = useState(1);
  const [syncedPan, setSyncedPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [syncedSliceIdx, setSyncedSliceIdx] = useState(0);
  
  // Viewport assignments state - tracks which secondary series is in which viewport (1-indexed)
  // Map key is viewport number, value is secondary series ID (null for primary-only)
  const [viewportAssignments, setViewportAssignments] = useState<Map<number, number | null>>(new Map());
  
  // Handler to exit from split view back to overlay mode
  const handleExitToOverlay = useCallback(() => {
    setFusionLayoutPreset('overlay');
    setFusionDisplayMode('overlay');
    setViewportAssignments(new Map()); // Clear assignments when exiting
  }, []);
  
  // Note: We intentionally do NOT auto-open the fusion panel when secondary changes.
  // This allows quick-swap in minimized mode without opening the full panel.
  // The panel only opens when user explicitly clicks the Fusion button.
  
  // Load fusion layout preference on mount and when study changes
  useEffect(() => {
    const studyId = studyData?.study?.id;
    if (studyId) {
      const savedLayout = fusionLayoutService.getLayoutForStudy(studyId);
      setFusionLayoutPreset(savedLayout);
      // Sync display mode with layout preset
      if (savedLayout === 'overlay') {
        setFusionDisplayMode('overlay');
      } else {
        setFusionDisplayMode('side-by-side');
      }
    }
  }, [studyData?.study?.id]);
  
  // Save fusion layout preference when it changes
  const handleLayoutPresetChange = useCallback((preset: FusionLayoutPreset) => {
    setFusionLayoutPreset(preset);
    // Sync display mode
    if (preset === 'overlay') {
      setFusionDisplayMode('overlay');
    } else {
      setFusionDisplayMode('side-by-side');
    }
    // Persist to storage
    const studyId = studyData?.study?.id;
    if (studyId) {
      fusionLayoutService.setLayoutForStudy(studyId, preset);
    }
  }, [studyData?.study?.id]);
  
  // Handle viewport swap
  const handleSwapViewports = useCallback(() => {
    // This would be implemented when using FlexibleFusionLayout directly
    console.log('Swap viewports requested');
  }, []);
  
  // Boolean operations state
  const [showBooleanOperations, setShowBooleanOperations] = useState(false);
  const [showMarginToolbar, setShowMarginToolbar] = useState(false);
  const [showLocalizationTool, setShowLocalizationTool] = useState(true);
  const [previewStructureInfo, setPreviewStructureInfo] = useState<{ targetName: string; isNewStructure: boolean } | null>(null);
  const [highlightedStructures, setHighlightedStructures] = useState<{ inputs: string[]; output: string }>({ inputs: [], output: '' });

  // Use a stable patient identifier - prefer patient.id, fall back to first study's patientId
  const stablePatientId = useMemo(() => {
    return studyData?.patient?.id ?? studyData?.studies?.[0]?.patientId ?? null;
  }, [studyData?.patient?.id, studyData?.studies]);
  
  // Track previous patient ID to detect real changes
  const prevPatientIdRef = useRef<number | null>(null);
  
  // Clear RT structures when patient truly changes (not on initial load)
  useEffect(() => {
    // Skip if this is the initial load (prevPatientIdRef is null and we're setting it for the first time)
    if (prevPatientIdRef.current === null && stablePatientId !== null) {
      prevPatientIdRef.current = stablePatientId;
      log.debug(`Initial patient ID set: ${stablePatientId}`, 'viewer-interface');
      return;
    }
    
    // Only clear if the patient ID actually changed to a different value
    if (prevPatientIdRef.current !== stablePatientId && stablePatientId !== null) {
      log.debug(`Patient changed from ${prevPatientIdRef.current} to ${stablePatientId}, clearing RT structures`, 'viewer-interface');
      prevPatientIdRef.current = stablePatientId;
      setRTStructures(null);
      setStructureVisibility(new Map());
      setSelectedStructures(new Set());
      setSelectedForEdit(null);
      setSelectedStructureColors([]);
      setIsContourEditMode(false);
      setLoadedRTSeriesId(null);  // Clear loaded RT series ID
    }
  }, [stablePatientId]);

  // Notify parent when loaded RT series changes
  useEffect(() => {
    if (onLoadedRTSeriesChange) {
      onLoadedRTSeriesChange(loadedRTSeriesId);
    }
  }, [loadedRTSeriesId, onLoadedRTSeriesChange]);

  // Automatically enter contour edit mode when a structure is selected for editing
  // BUT NOT when margin toolbar is open - just update the selected structure for margin tool
  useEffect(() => {
    if (selectedForEdit && rtStructures) {
      // Only enter contour edit mode if margin toolbar is NOT open
      if (!showMarginToolbar) {
        setIsContourEditMode(true);
      }
    } else {
      setIsContourEditMode(false);
    }
  }, [selectedForEdit, rtStructures, showMarginToolbar]);

  // Fetch series data for all studies
  const DERIVED_DESCRIPTION_KEYWORDS = useMemo(
    () => [
      'resampled',
      're-sampled',
      'fused',
      'fusion',
      'helper cache',
      'helper-cache',
      'fusion manifest',
      'qa fusion',
      'qcfx',
      'qgfx',
      'manifest overlay',
      'resample cache',
    ],
    [],
  );

  const DERIVED_UID_MARKERS = useMemo(
    () => ['.fused', '.fusion', '.resampled', '.resample', '_fused', '_fusion', '_resamp', '-fused', '-fusion'],
    [],
  );

  const shouldHideSeries = useCallback(
    (entry: any): boolean => {
      if (!entry) return true;
      const modality = (entry.modality || '').toUpperCase();

      if (['RTSTRUCT', 'RT', 'REG'].includes(modality)) {
        return false;
      }

      if (['DERIVED', 'SECONDARY', 'OT'].includes(modality)) {
        return true;
      }

      const metadata = (entry?.metadata ?? {}) as Record<string, any>;
      const description = (entry.seriesDescription || '').toLowerCase();
      const uid = (entry.seriesInstanceUID || '').toLowerCase();

      const derivedByKeywords = DERIVED_DESCRIPTION_KEYWORDS.some((keyword) => description.includes(keyword));
      const derivedByUid = DERIVED_UID_MARKERS.some((marker) => uid.includes(marker));
      const flaggedFusion = Boolean(metadata?.fusion);
      const fusionCandidateModality = ['PT', 'PET', 'MR', 'NM'].includes(modality);

      if (flaggedFusion && !fusionCandidateModality) {
        return true;
      }

      if ((derivedByKeywords || derivedByUid) && !fusionCandidateModality) {
        // Hide derived CT/resampled overlays, but keep PET/MR secondaries available.
        return true;
      }

      return false;
    },
    [DERIVED_DESCRIPTION_KEYWORDS, DERIVED_UID_MARKERS],
  );

  const { data: seriesData, isLoading } = useQuery({
    queryKey: ['/api/studies', studyData.studies?.map((s: any) => s.id), 'series'],
    queryFn: async () => {
      if (!studyData.studies || studyData.studies.length === 0) throw new Error('No studies');
      
      // Fetch series for all studies and combine them
      const allSeries = [] as any[];
      for (const study of studyData.studies) {
        const response = await fetch(`/api/studies/${study.id}/series`);
        if (!response.ok) {
          throw new Error(`Failed to fetch series for study ${study.id}: ${response.statusText}`);
        }
        const series = await response.json();
        const extractFoR = (input: unknown): string | null => {
          if (typeof input === 'string') {
            const trimmed = input.trim();
            return trimmed.length ? trimmed : null;
          }
          return null;
        };
        // Add study info to each series for reference
        allSeries.push(
          ...series.map((s: any) => {
            const foFromRoot = extractFoR(s?.frameOfReferenceUID ?? s?.frame_of_reference_uid);
            const foFromMetadata = extractFoR(s?.metadata?.frameOfReferenceUID ?? s?.metadata?.FrameOfReferenceUID ?? s?.metadata?.frame_of_reference_uid);
            return {
              ...s,
              studyId: study.id,
              studyDate: study.studyDate,
              frameOfReferenceUID: foFromRoot ?? foFromMetadata ?? null,
            };
          }),
        );
      }
      return allSeries;
    },
    enabled: !!studyData.studies?.length,
  });

  // Fetch REG associations for this patient and build primary->secondary mapping by series IDs
  const [regCtacIds, setRegCtacIds] = useState<number[]>([]);
  useEffect(() => {
    const loadAssociations = async () => {
      try {
        // Patient ID will be resolved later using more sophisticated logic
        if (!seriesData || !Array.isArray(seriesData) || seriesData.length === 0) return;

        const ensureString = (value: unknown): string | null => {
          if (typeof value !== 'string') return null;
          const trimmed = value.trim();
          return trimmed ? trimmed : null;
        };

        const normalizeSeriesId = (value: unknown): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'bigint') {
            const asNumber = Number(value);
            return Number.isFinite(asNumber) ? asNumber : null;
          }
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? parsed : null;
          }
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };

        const normalizeSeriesIdArray = (values: unknown[]): number[] => {
          const ids: number[] = [];
          for (const value of values) {
            const id = normalizeSeriesId(value);
            if (id != null) ids.push(id);
          }
          return ids;
        };

        const normalizeSeriesDetail = (detail: any): RegistrationSeriesDetail | null => {
          if (!detail) return null;
          const id = normalizeSeriesId(detail.id ?? detail.seriesId ?? detail.series_id);
          const uid = ensureString(detail.uid ?? detail.seriesInstanceUID ?? detail.seriesInstanceUid);
          const description = ensureString(detail.description ?? detail.seriesDescription);
          const modality = ensureString(detail.modality);
          const studyId = normalizeSeriesId(detail.studyId ?? detail.study_id);
          const imageCountRaw = detail.imageCount ?? detail.instances ?? detail.image_count;
          const imageCountNumber = Number(imageCountRaw);
          const imageCount = Number.isFinite(imageCountNumber) ? imageCountNumber : null;
          if (id == null && !uid) return null;
          return {
            id,
            uid,
            description,
            modality,
            studyId,
            imageCount,
          };
        };

        const seriesEntries: [string, any][] = [];
        (seriesData as any[]).forEach(ser => {
          const uid = ensureString(ser.seriesInstanceUID ?? ser.seriesInstanceUid ?? ser.uid);
          if (uid) seriesEntries.push([uid, ser]);
        });
        const uidToSeries = new Map<string, any>(seriesEntries);

        const fromSeriesRecord = (ser: any): RegistrationSeriesDetail => ({
          id: normalizeSeriesId(ser.id),
          uid: ensureString(ser.seriesInstanceUID ?? ser.seriesInstanceUid ?? ser.uid),
          description: ensureString(ser.seriesDescription ?? ser.description),
          modality: ensureString(ser.modality),
          studyId: normalizeSeriesId(ser.studyId ?? ser.study_id),
          imageCount: Number.isFinite(Number(ser.imageCount)) ? Number(ser.imageCount) : null,
        });

        const resolveDetailById = (id: number | string | null | undefined): RegistrationSeriesDetail | null => {
          const normalizedId = normalizeSeriesId(id);
          if (normalizedId == null) return null;
          const ser = (seriesData as any[]).find(s => normalizeSeriesId(s.id) === normalizedId);
          if (!ser) return null;
          return { ...fromSeriesRecord(ser), id: normalizedId };
        };

        const resolveDetailByUid = (uid: string | null | undefined): RegistrationSeriesDetail | null => {
          const normalizedUid = ensureString(uid);
          if (!normalizedUid) return null;
          const ser = uidToSeries.get(normalizedUid);
          if (!ser) return null;
          return fromSeriesRecord(ser);
        };

        const resolveDetailFromAssociation = (detail: any): RegistrationSeriesDetail | null => {
          if (!detail) return null;
          const explicitId = normalizeSeriesId(detail.id ?? detail.seriesId ?? detail.series_id);
          if (explicitId != null) {
            const resolved = resolveDetailById(explicitId);
            if (resolved) return resolved;
          }
          const resolvedByUid = resolveDetailByUid(detail.uid ?? detail.seriesInstanceUID ?? detail.seriesInstanceUid);
          if (resolvedByUid) return resolvedByUid;
          const normalized = normalizeSeriesDetail(detail);
          if (!normalized) return null;
          if (normalized.id != null && !normalized.uid) {
            return {
              ...normalized,
              uid: resolveDetailById(normalized.id)?.uid ?? normalized.uid,
            };
          }
          return normalized;
        };

        const resolvePatientIdentifier = (): number | null => {
          // Always prefer the numeric database patient ID for API calls
          // The server expects the database ID, not the DICOM Patient ID string
          const patient = studyData?.patient;
          if (patient && Number.isFinite(patient.id)) {
            return patient.id as number;
          }
          
          // Fallback: try URL patientId if it's numeric
          const urlPatientId = typeof window !== 'undefined'
            ? new URL(window.location.href).searchParams.get('patientId')
            : null;
          if (urlPatientId) {
            const parsed = Number(urlPatientId.trim());
            if (Number.isFinite(parsed)) return parsed;
          }

          // Fallback: get from study's patientId
          const studyWithPatientId = Array.isArray(studyData?.studies)
            ? studyData.studies.find((st: any) => Number.isFinite(st?.patientId))
            : null;
          if (studyWithPatientId && Number.isFinite(studyWithPatientId.patientId)) {
            return studyWithPatientId.patientId as number;
          }
          return null;
        };

        const patientIdentifier = resolvePatientIdentifier();

        // Try patient-wide first, then per-study if empty
        const tryFetch = async (url: string) => {
          try {
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) return { associations: [] as any[], ctacSeriesIds: [] as number[] };
            const j = await r.json();
            const assocs = Array.isArray(j?.associations) ? j.associations : [];
            const ctac = Array.isArray(j?.ctacSeriesIds) ? j.ctacSeriesIds : [];
            return { associations: assocs, ctacSeriesIds: ctac };
          } catch { return { associations: [] as any[], ctacSeriesIds: [] as number[] }; }
        };

        let result = patientIdentifier != null
          ? await tryFetch(`/api/registration/associations?patientId=${encodeURIComponent(String(patientIdentifier))}`)
          : { associations: [] as any[], ctacSeriesIds: [] as number[] };
        let associations = result.associations;
        const ctacUnion = new Set<number>();
        (result.ctacSeriesIds || []).forEach((id: unknown) => {
          const normalized = normalizeSeriesId(id);
          if (normalized != null) ctacUnion.add(normalized);
        });
        if (import.meta.env.DEV) {
          console.log('📎 Registration fetch context', {
            patientIdentifier,
            associationsFromPatient: associations.length,
            ctacCount: ctacUnion.size,
          });
        }
        if (!associations.length && Array.isArray(studyData?.studies)) {
          const results = await Promise.all(
            studyData.studies.map((st: any) => tryFetch(`/api/registration/associations?studyId=${st.id}`))
          );
          associations = results.flatMap(r => r.associations);
          results.forEach(r => (r.ctacSeriesIds || []).forEach((id: unknown) => {
            const normalized = normalizeSeriesId(id);
            if (normalized != null) ctacUnion.add(normalized);
          }));
        }
        const allowedFusionModalities = new Set(['CT', 'PT', 'PET', 'MR', 'NM']);
        const filterDetailsByModality = (details: (RegistrationSeriesDetail | null)[]) => {
          const unique = new Map<number, RegistrationSeriesDetail>();
          const filtered: RegistrationSeriesDetail[] = [];
          for (const detail of details) {
            if (!detail) continue;
            const modality = detail.modality ? detail.modality.toUpperCase() : '';
            if (!allowedFusionModalities.has(modality)) continue;
            const detailId = normalizeSeriesId(detail.id);
            if (detailId != null) {
              if (unique.has(detailId)) continue;
              const normalizedDetail = { ...detail, id: detailId };
              unique.set(detailId, normalizedDetail);
              filtered.push(normalizedDetail);
              continue;
            }
            filtered.push(detail);
          }
          return filtered;
        };

        const mapping: Record<number, number[]> = {};
        const associationMap = new Map<number, RegistrationAssociation[]>();
        for (const a of associations) {
          // Resolve target detail and ensure modality is eligible
          let primaryDetail: RegistrationSeriesDetail | null = null;
          if (a?.targetSeriesDetail) {
            primaryDetail = resolveDetailFromAssociation(a.targetSeriesDetail);
          }
          if (!primaryDetail) {
            primaryDetail = resolveDetailById(a?.targetSeriesId ?? null);
          }
          if (!primaryDetail && a?.target) {
            primaryDetail = resolveDetailByUid(a.target);
          }
          if (!primaryDetail) continue;
          const targetModality = primaryDetail.modality ? primaryDetail.modality.toUpperCase() : '';
          if (!allowedFusionModalities.has(targetModality)) continue;

          const primaryId = normalizeSeriesId(primaryDetail.id ?? a?.targetSeriesId ?? a?.targetSeriesDetail?.id);
          if (primaryId == null) continue;
          if (!primaryDetail.id || primaryDetail.id !== primaryId) {
            primaryDetail = { ...primaryDetail, id: primaryId };
          }

          let secondaryIds: number[] = Array.isArray(a?.sourcesSeriesIds)
            ? normalizeSeriesIdArray(a.sourcesSeriesIds)
            : [];

          let resolvedDetails: RegistrationSeriesDetail[] = [];
          if (Array.isArray(a?.sourceSeriesDetails) && a.sourceSeriesDetails.length) {
            resolvedDetails = a.sourceSeriesDetails
              .map((detail: any) => resolveDetailFromAssociation(detail))
              .filter((detail): detail is RegistrationSeriesDetail => !!detail);
            if (!secondaryIds.length) {
              secondaryIds = resolvedDetails
                .map(detail => normalizeSeriesId(detail.id))
                .filter((id): id is number => id != null);
            }
          }

          if (!resolvedDetails.length && Array.isArray(a?.sources)) {
            resolvedDetails = a.sources
              .map(uid => resolveDetailByUid(uid))
              .filter((detail): detail is RegistrationSeriesDetail => !!detail);
          }

          if (!secondaryIds.length) {
            secondaryIds = resolvedDetails
              .map(detail => normalizeSeriesId(detail.id))
              .filter((id): id is number => id != null);
          }

          if (!secondaryIds.length && Array.isArray(a?.siblingSeriesIds)) {
            secondaryIds = normalizeSeriesIdArray(a.siblingSeriesIds);
          }

          if (!resolvedDetails.length && secondaryIds.length) {
            resolvedDetails = secondaryIds
              .map(id => resolveDetailById(id))
              .filter((detail): detail is RegistrationSeriesDetail => !!detail);
          }

          if (import.meta.env.DEV) {
            console.log('🔍 Association candidate', {
              primaryId,
              targetDetail: primaryDetail,
              secondaryIdsInitial: secondaryIds.slice(),
              resolvedDetailsInitial: resolvedDetails,
              rawAssociation: a,
            });
          }

          const filteredDetails = filterDetailsByModality(resolvedDetails);
          const filteredIds = filteredDetails
            .map(detail => normalizeSeriesId(detail.id))
            .filter((id): id is number => id != null);

          const candidateIds = filteredIds.length ? filteredIds : secondaryIds;
          const detailsById = new Map<number, RegistrationSeriesDetail>();
          filteredDetails.forEach(detail => {
            const id = normalizeSeriesId(detail.id);
            if (id != null) detailsById.set(id, { ...detail, id });
          });
          resolvedDetails.forEach(detail => {
            const id = normalizeSeriesId(detail.id);
            if (id != null && !detailsById.has(id)) {
              detailsById.set(id, { ...detail, id });
            }
          });

          const validSecondaryIds: number[] = [];
          const validSecondaryDetails: RegistrationSeriesDetail[] = [];
          const seenSecondary = new Set<number>();

          for (const rawId of candidateIds) {
            const normalizedId = normalizeSeriesId(rawId);
            if (normalizedId == null) continue;
            if (seenSecondary.has(normalizedId)) continue;

            let detail = detailsById.get(normalizedId) ?? resolveDetailById(normalizedId);
            const seriesRecord = (seriesData as any[]).find(s => normalizeSeriesId(s.id) === normalizedId);
            const modality = ensureString(detail?.modality ?? seriesRecord?.modality)?.toUpperCase() ?? '';
            if (!allowedFusionModalities.has(modality)) continue;

            seenSecondary.add(normalizedId);
            validSecondaryIds.push(normalizedId);
            const hydratedDetail: RegistrationSeriesDetail = {
              id: normalizedId,
              uid: ensureString(detail?.uid ?? seriesRecord?.seriesInstanceUID ?? seriesRecord?.seriesInstanceUid) ?? null,
              description: ensureString(detail?.description ?? seriesRecord?.seriesDescription) ?? null,
              modality,
              studyId: normalizeSeriesId(detail?.studyId ?? seriesRecord?.studyId ?? seriesRecord?.study_id),
              imageCount: (() => {
                const raw = detail?.imageCount ?? seriesRecord?.imageCount;
                const parsed = Number(raw);
                return Number.isFinite(parsed) ? parsed : null;
              })(),
            };
            validSecondaryDetails.push(hydratedDetail);
          }

          if (import.meta.env.DEV) {
            console.log('🔍 Filtered association details', {
              primaryId,
              filteredIds,
              candidateIds,
              validSecondaryIds,
              validSecondaryDetails,
            });
          }

          if (!validSecondaryIds.length) continue;

          secondaryIds = validSecondaryIds;

          if (secondaryIds.length) {
            const prev = mapping[primaryId as number] || [];
            const combined = Array.from(new Set([...prev, ...secondaryIds]));
            mapping[primaryId as number] = combined;
            
            // Add bidirectional mapping: each source should also know about the target
            // This enables fusion to work regardless of which series is selected as primary
            for (const sourceId of secondaryIds) {
              const sourcePrev = mapping[sourceId] || [];
              if (!sourcePrev.includes(primaryId as number)) {
                mapping[sourceId] = [...sourcePrev, primaryId as number];
              }
            }
          }

          const entry: RegistrationAssociation = {
            ...a,
            targetSeriesId: primaryId as number,
            targetSeriesDetail: primaryDetail,
            sourcesSeriesIds: secondaryIds,
            sourceSeriesDetails: validSecondaryDetails,
          };
          const existing = associationMap.get(primaryId as number) || [];
          existing.push(entry);
          associationMap.set(primaryId as number, existing);
        }

        if (import.meta.env.DEV) {
          console.log('📎 Registration mapping built', mapping, associationMap);
        }
        setRegAssociations(mapping);
        setRegistrationRelationshipMap(associationMap);
        setRegCtacIds(Array.from(ctacUnion));

        // Auto-select best primary candidate if nothing selected yet
        if (!selectedSeries && Object.keys(mapping).length > 0) {
          const ptStudyIds = new Set<number>((seriesData as any[])
            .filter(s => (s.modality || '').toUpperCase() === 'PT')
            .map(s => s.studyId));

          const primaryIds = Object.keys(mapping).map(Number).sort((a, b) => (mapping[b]?.length || 0) - (mapping[a]?.length || 0));
          const preferred = primaryIds.find(pid => {
            const ser = (seriesData as any[]).find(s => s.id === pid);
            if (!ser) return false;
            const modality = (ser.modality || '').toUpperCase();
            if (modality !== 'CT') return false;
            // Prefer CT not in PT study and not marked CTAC by server
            if (ptStudyIds.has(ser.studyId)) return false;
            if (ctacUnion.has(ser.id)) return false;
            return true;
          });
          const chosenId = preferred ?? primaryIds[0];
          const chosen = (seriesData as any[]).find(s => s.id === chosenId);
          if (chosen) await handleSeriesSelect(chosen);
        }
      } catch {
        // Silent fail; UI falls back to heuristic
      }
    };
    loadAssociations();
  }, [studyData?.patient?.id, seriesData]);

  useEffect(() => {
    if (seriesData && Array.isArray(seriesData)) {
      setSeries(seriesData);
      setVisibleSeries(seriesData.filter((entry) => !shouldHideSeries(entry)));
      
      // Auto-select planning CT if no series is selected yet
      if (!selectedSeries && seriesData.length > 0) {
        // Use the same planning CT selection logic as in series-selector.tsx
        const ctSeries = seriesData.filter((s) => s.modality === 'CT' && !shouldHideSeries(s));
        
        if (ctSeries.length > 0) {
          // Score CT series to find the best planning CT
          const scoreCT = (ct: any) => {
            let score = 0;
            // Prefer larger image counts (indicates comprehensive scan)
            score += Math.min(200, (ct.imageCount || 0));
            // Prefer series with certain keywords in description
            const desc = (ct.seriesDescription || '').toLowerCase();
            if (desc.includes('planning') || desc.includes('plan')) score += 100;
            if (desc.includes('ctac')) score -= 200; // Avoid CTAC
            return score;
          };

          // Pick best CT by score
          const bestCT = [...ctSeries].sort((a, b) => scoreCT(b) - scoreCT(a))[0];
          if (bestCT) {
            console.log(`🎯 Auto-selecting planning CT: ${bestCT.seriesDescription} (ID: ${bestCT.id})`);
            handleSeriesSelect(bestCT);
          }
        }
      }
    }
  }, [seriesData, selectedSeries, shouldHideSeries]);

  // Extract RT Dose and RT Plan series from loaded series
  useEffect(() => {
    if (seriesData && Array.isArray(seriesData)) {
      // RT Dose series
      const doseSeriesData = seriesData.filter(
        (s: any) => s.modality?.toUpperCase() === 'RTDOSE'
      );
      setDoseSeries(doseSeriesData);
      if (doseSeriesData.length > 0) {
        console.log(`📊 Found ${doseSeriesData.length} RT Dose series`);
      }
      
      // RT Plan series
      const planSeriesData = seriesData.filter(
        (s: any) => s.modality?.toUpperCase() === 'RTPLAN'
      );
      setPlanSeries(planSeriesData);
      if (planSeriesData.length > 0) {
        console.log(`⚡ Found ${planSeriesData.length} RT Plan series`);
        // Auto-select first plan (regardless of dose)
        if (planSeriesData.length >= 1 && !selectedPlanSeriesId) {
          setSelectedPlanSeriesId(planSeriesData[0].id);
          console.log(`⚡ Auto-selected RT Plan series: ${planSeriesData[0].id}`);
        }
      }
    }
  }, [seriesData]);

  // Load dose metadata when dose series is selected
  useEffect(() => {
    if (!selectedDoseSeriesId) {
      setDoseMetadata(null);
      return;
    }

    let isCancelled = false;
    setDoseLoading(true);

    const loadDoseMetadata = async () => {
      try {
        const response = await fetch(`/api/rt-dose/${selectedDoseSeriesId}/metadata`);
        if (!response.ok) {
          throw new Error('Failed to load dose metadata');
        }
        const metadata = await response.json();
        if (!isCancelled) {
          setDoseMetadata(metadata);
          // Auto-set prescription based on max dose
          if (metadata.maxDose && metadata.maxDose > 0) {
            // Assume prescription is about 95% of max for most plans
            const estimatedRx = Math.round(metadata.maxDose * 0.95);
            setPrescriptionDose(estimatedRx);
          }
        }
      } catch (error) {
        console.error('Error loading dose metadata:', error);
      } finally {
        if (!isCancelled) {
          setDoseLoading(false);
        }
      }
    };

    loadDoseMetadata();

    return () => {
      isCancelled = true;
    };
  }, [selectedDoseSeriesId]);

  const handleSeriesSelect = async (seriesData: DICOMSeries) => {
    try {
      // Fetch images for the selected series
      const response = await fetch(`/api/series/${seriesData.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch series images');
      }
      
      const seriesWithImages = await response.json();
      setSelectedSeries(seriesWithImages);
      
      // Apply default window/level based on modality and series description
      if (seriesWithImages.images?.length > 0) {
        const modality = (seriesWithImages.modality || '').toUpperCase();
        const description = (seriesWithImages.seriesDescription || '').toLowerCase();
        
        let autoWindowLevel: WindowLevel | null = null;
        
        // Smart MRI window/level detection
        if (modality === 'MR') {
          console.log(`🧠 Detecting MRI window/level for series: "${description}"`);
          
          // Detect sequence type from description
          if (description.includes('t1') && !description.includes('t2')) {
            autoWindowLevel = WINDOW_LEVEL_PRESETS['MRI Brain T1'];
            console.log('📊 Applied T1 MRI preset');
          } else if (description.includes('t2') && !description.includes('flair')) {
            autoWindowLevel = WINDOW_LEVEL_PRESETS['MRI Brain T2'];
            console.log('📊 Applied T2 MRI preset');
          } else if (description.includes('flair')) {
            autoWindowLevel = WINDOW_LEVEL_PRESETS['MRI Brain FLAIR'];
            console.log('📊 Applied FLAIR MRI preset');
          } else if (description.includes('spine')) {
            autoWindowLevel = WINDOW_LEVEL_PRESETS['MRI Spine'];
            console.log('📊 Applied Spine MRI preset');
          } else {
            autoWindowLevel = WINDOW_LEVEL_PRESETS['MRI Auto'];
            console.log('📊 Applied default MRI preset');
          }
        }
        // CT uses DICOM window/level or defaults
        else if (modality === 'CT') {
          const firstImage = seriesWithImages.images[0];
          if (firstImage.windowCenter && firstImage.windowWidth) {
            autoWindowLevel = {
              level: parseFloat(firstImage.windowCenter),
              window: parseFloat(firstImage.windowWidth)
            };
            console.log('📊 Applied CT DICOM window/level');
          } else {
            autoWindowLevel = WINDOW_LEVEL_PRESETS['Soft Tissue'];
            console.log('📊 Applied CT default preset');
          }
        }
        // Other modalities
        else {
          const firstImage = seriesWithImages.images[0];
          if (firstImage.windowCenter && firstImage.windowWidth) {
            autoWindowLevel = {
              level: parseFloat(firstImage.windowCenter),
              window: parseFloat(firstImage.windowWidth)
            };
            console.log(`📊 Applied ${modality} DICOM window/level`);
          }
        }
        
        if (autoWindowLevel) {
          setWindowLevel(autoWindowLevel);
        }
      }
      
      // Note: RT structure auto-loading is now handled by SeriesSelector component
      // which properly filters by referencedSeriesId to ensure the RT structure
      // belongs to the selected primary CT series

      await initializeFusionForSeries(seriesData);
      
    } catch (error) {
      log.error(`Error selecting series: ${String(error)}`, 'viewer-interface');
      setError({
        title: 'Error Loading Series',
        message: 'Failed to load the selected series.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Check if we're in multi-viewport mode (FlexibleFusionLayout)
  const isInFlexibleFusionLayout = fusionLayoutPreset !== 'overlay' && secondarySeriesId !== null;
  
  // State for preload progress
  const [preloadProgress, setPreloadProgress] = useState<{ loaded: number; total: number } | null>(null);
  
  // Eager preload when entering multi-viewport mode for smooth scrolling
  useEffect(() => {
    if (!isInFlexibleFusionLayout || !selectedSeries?.id) return;
    
    // Check if already loaded or loading
    if (globalSeriesCache.isFullyLoaded(selectedSeries.id) || globalSeriesCache.isLoading(selectedSeries.id)) {
      return;
    }
    
    // Start preloading the primary series
    const preloadPrimarySeries = async () => {
      try {
        // First, get the image list for the series
        const response = await fetch(`/api/dicom/series/${selectedSeries.id}/images`);
        if (!response.ok) {
          console.warn('Failed to fetch image list for preload');
          return;
        }
        
        const imageList = await response.json();
        if (!Array.isArray(imageList) || imageList.length === 0) return;
        
        console.log(`🚀 Starting eager preload for multi-viewport mode: ${imageList.length} images`);
        setPreloadProgress({ loaded: 0, total: imageList.length });
        
        // Create fetch function for each image
        const fetchImage = async (sopInstanceUID: string) => {
          try {
            const imageResponse = await fetch(`/api/dicom/images/${sopInstanceUID}/pixel-data`);
            if (!imageResponse.ok) return null;
            
            const arrayBuffer = await imageResponse.arrayBuffer();
            // Basic parsing - the full parsing happens in WorkingViewer
            return {
              sopInstanceUID,
              data: new Float32Array(arrayBuffer),
              width: 512, // Will be updated when actually used
              height: 512,
              metadata: {},
              timestamp: Date.now(),
            } as any;
          } catch (error) {
            console.warn(`Failed to preload image ${sopInstanceUID}:`, error);
            return null;
          }
        };
        
        // Use global cache for preloading
        await globalSeriesCache.preloadSeries(
          selectedSeries.id,
          imageList.map((img: any, idx: number) => ({ 
            sopInstanceUID: img.sopInstanceUID, 
            sliceIndex: idx 
          })),
          fetchImage,
          {
            priority: 'high',
            onProgress: (loaded, total) => {
              setPreloadProgress({ loaded, total });
              if (loaded >= total) {
                // Preload complete, hide progress after a brief delay
                setTimeout(() => setPreloadProgress(null), 500);
              }
            }
          }
        );
        
        console.log('✅ Multi-viewport preload complete');
      } catch (error) {
        console.error('Preload failed:', error);
        setPreloadProgress(null);
      }
    };
    
    preloadPrimarySeries();
  }, [isInFlexibleFusionLayout, selectedSeries?.id]);

  // Preload fusion data when a secondary is selected (before entering multi-viewport mode)
  // This dramatically improves scrolling performance by sharing fusion slices across viewports
  const [fusionPreloadProgress, setFusionPreloadProgress] = useState<number>(0);
  
  useEffect(() => {
    if (!secondarySeriesId || !selectedSeries?.id) return;
    
    // Check if already preloading or mostly loaded
    if (globalFusionCache.isPreloading(selectedSeries.id, secondarySeriesId)) {
      return;
    }
    
    const existingProgress = globalFusionCache.getProgress(selectedSeries.id, secondarySeriesId);
    if (existingProgress > 0.9) {
      setFusionPreloadProgress(1);
      return;
    }
    
    // Get image list for preloading
    const preloadFusion = async () => {
      try {
        const response = await fetch(`/api/series/${selectedSeries.id}/images`);
        if (!response.ok) return;
        
        const imageList = await response.json();
        if (!Array.isArray(imageList) || imageList.length === 0) return;
        
        console.log(`[ViewerInterface] 🚀 Starting fusion preload for secondary ${secondarySeriesId}`);
        
        await globalFusionCache.preloadFusionPair(
          selectedSeries.id,
          secondarySeriesId,
          imageList.map((img: any) => ({
            sopInstanceUID: img.sopInstanceUID,
            instanceNumber: img.instanceNumber,
            imagePosition: img.imagePositionPatient,
            metadata: img.metadata,
          })),
          null, // registrationId
          {
            onProgress: (loaded, total) => {
              setFusionPreloadProgress(loaded / total);
            },
          }
        );
        
        console.log(`[ViewerInterface] ✅ Fusion preload complete for secondary ${secondarySeriesId}`);
        setFusionPreloadProgress(1);
      } catch (error) {
        console.warn('[ViewerInterface] Fusion preload failed:', error);
      }
    };
    
    preloadFusion();
  }, [secondarySeriesId, selectedSeries?.id]);

  const handleZoomIn = () => {
    try {
      // If in FlexibleFusionLayout, use synced zoom state
      if (isInFlexibleFusionLayout) {
        setSyncedZoom(prev => Math.min(4, prev + 0.25));
      } else if ((window as any).currentViewerZoom?.zoomIn) {
        (window as any).currentViewerZoom.zoomIn();
      }
    } catch (error) {
      log.warn(`Error zooming in: ${String(error)}`, 'viewer-interface');
    }
  };

  const handleZoomOut = () => {
    try {
      // If in FlexibleFusionLayout, use synced zoom state
      if (isInFlexibleFusionLayout) {
        setSyncedZoom(prev => Math.max(0.25, prev - 0.25));
      } else if ((window as any).currentViewerZoom?.zoomOut) {
        (window as any).currentViewerZoom.zoomOut();
      }
    } catch (error) {
      log.warn(`Error zooming out: ${String(error)}`, 'viewer-interface');
    }
  };

  const handleResetZoom = () => {
    try {
      // If in FlexibleFusionLayout, reset synced zoom
      if (isInFlexibleFusionLayout) {
        setSyncedZoom(1);
      } else if ((window as any).currentViewerZoom?.resetZoom) {
        (window as any).currentViewerZoom.resetZoom();
      }
    } catch (error) {
      log.warn(`Error resetting zoom: ${String(error)}`, 'viewer-interface');
    }
  };

  const setActiveTool = (toolName: string) => {
    try {
      const cornerstoneTools = cornerstoneConfig.getCornerstoneTools();
      const elements = document.querySelectorAll('.cornerstone-viewport');
      
      elements.forEach((element: any) => {
        if (element) {
          cornerstoneTools.setToolActiveForElement(element, toolName, { mouseButtonMask: 1 });
        }
      });
    } catch (error) {
      log.warn(`Error setting active tool: ${String(error)}`, 'viewer-interface');
    }
  };

  const handlePanTool = () => {
    if (workingViewerRef.current?.setPanMode) {
      workingViewerRef.current.setPanMode();
      setActiveToolMode('pan');
    }
  };
  
  const handleMeasureTool = () => {
    setActiveTool('Length');
    setActiveToolMode('measure');
  };
  const handleAnnotateTool = () => setActiveTool('ArrowAnnotate');
  
  const handleCrosshairsTool = () => {
    if (workingViewerRef.current?.setCrosshairMode) {
      workingViewerRef.current.setCrosshairMode();
      setActiveToolMode('crosshairs');
    }
  };

  const handleRotate = () => {
    try {
      if (!window.cornerstone) {
        log.warn('Cornerstone not available for rotation','viewer-interface');
        return;
      }
      const cornerstone = window.cornerstone;
      const elements = document.querySelectorAll('.cornerstone-viewport');
      
      elements.forEach((element: any) => {
        if (element) {
          const viewport = cornerstone.getViewport(element);
          if (viewport) {
            viewport.rotation += 90;
            cornerstone.setViewport(element, viewport);
          }
        }
      });
    } catch (error) {
      console.warn('Error rotating image:', error);
    }
  };

  const handleFlip = () => {
    try {
      if (!window.cornerstone) {
        console.warn('Cornerstone not available for flip');
        return;
      }
      const cornerstone = window.cornerstone;
      const elements = document.querySelectorAll('.cornerstone-viewport');
      
      elements.forEach((element: any) => {
        if (element) {
          const viewport = cornerstone.getViewport(element);
          if (viewport) {
            viewport.hflip = !viewport.hflip;
            cornerstone.setViewport(element, viewport);
          }
        }
      });
    } catch (error) {
      log.warn(`Error flipping image: ${String(error)}`, 'viewer-interface');
    }
  };

  const handleRTStructureLoad = (rtStructData: any) => {
    log.debug('Loading RT structures', 'viewer-interface');
    setRTStructures(rtStructData);
    // Initialize visibility for all structures
    const visibilityMap = new Map();
    rtStructData.structures.forEach((structure: any) => {
      visibilityMap.set(structure.roiNumber, true);
    });
    setStructureVisibility(visibilityMap);
  };
  
  const handleRTSeriesSelect = async (rtSeries: any) => {
    try {
      console.log('Auto-loading RT structures for series:', rtSeries.id);
      
      // Track which RT series is loaded
      setLoadedRTSeriesId(rtSeries.id);
      
      // Load RT structure contours
      const response = await fetch(`/api/rt-structures/${rtSeries.id}/contours`);
      if (response.ok) {
        const rtStructData = await response.json();
        if (rtStructData && (rtStructData.seriesId === undefined || rtStructData.seriesId === null)) {
          rtStructData.seriesId = Number(rtSeries?.id) || null;
        }
        log.debug('RT structures loaded successfully', 'viewer-interface');
        handleRTStructureLoad(rtStructData);
      } else {
        log.error(`Failed to load RT structures: ${response.status}`, 'viewer-interface');
      }
    } catch (error) {
      log.error(`Error loading RT structure contours: ${String(error)}`, 'viewer-interface');
    }
  };

  const handleStructureSelection = (structureId: number, selected: boolean) => {
    log.debug(`handleStructureSelection: ${structureId} -> ${selected}`, 'viewer-interface');
    
    const newSelection = new Set(selectedStructures);
    if (selected) {
      newSelection.add(structureId);
    } else {
      newSelection.delete(structureId);
    }
    setSelectedStructures(newSelection);
    
    log.debug(`Updated selectedStructures: ${Array.from(newSelection).join(',')}`, 'viewer-interface');
    
    // Update selected structure colors for viewer border
    if (rtStructures?.structures) {
      const colors = Array.from(newSelection).map(id => {
        const structure = rtStructures.structures.find((s: any) => s.roiNumber === id);
        return structure ? `rgb(${structure.color.join(',')})` : '';
      }).filter(Boolean);
      setSelectedStructureColors(colors);
    }
  };

  const handleStructureVisibilityChange = (structureId: number, visible: boolean) => {
    log.debug(`handleStructureVisibilityChange: ${structureId} -> ${visible}`, 'viewer-interface');
    
    setStructureVisibility(prev => {
      const next = new Map(prev);
      next.set(structureId, visible);
      console.log('Updated structureVisibility map:', Array.from(next.entries()));
      return next;
    });
  };

  const handleAllStructuresVisibilityChange = (allVisible: boolean) => {
    setAllStructuresVisible(allVisible);
    // FIX: Trigger immediate render to show visibility changes
    setTimeout(() => {
      if (workingViewerRef.current?.forceRender) {
        workingViewerRef.current.forceRender();
      }
    }, 10);
  };

  const handleStructureColorChange = (structureId: number, color: [number, number, number]) => {
    if (rtStructures) {
      const updatedStructures = { ...rtStructures };
      const structure = updatedStructures.structures.find((s: any) => s.roiNumber === structureId);
      if (structure) {
        structure.color = color;
        setRTStructures(updatedStructures);
      }
    }
  };

  const getDefaultFusionWindow = useCallback((modality?: string | null) => {
    const mode = (modality || '').toUpperCase();
    switch (mode) {
      case 'MR':
        // MRI: return null to use auto windowing based on actual pixel data min/max
        return null;
      case 'PT':
      case 'PET':
        // Standard PET SUV windowing: 0-5 SUV range (common clinical setting)
        // Many DICOM PET files store SUV scaled by 1000
        return { window: 5000, level: 2500 };
      case 'CT':
        return { window: 400, level: 40 };
      default:
        return null;
    }
  }, []);

  const resetFusionState = useCallback((options?: { clearCache?: boolean; primarySeriesId?: number | null }) => {
    const { clearCache = false, primarySeriesId = null } = options ?? {};
    if (clearCache) {
      try {
        if (primarySeriesId != null) {
          clearFusionCaches(primarySeriesId);
        } else {
          clearFusionCaches();
        }
      } catch {}
    }
    setFusionManifest(null);
    setFusionManifestError(null);
    setFusionManifestLoading(false);
    setSecondarySeriesId(null);
    setShowFusionPanel(false);
    setSecondaryLoadingStates(new Map());
    setCurrentlyLoadingSecondary(null);
    setFusionWindowLevel(null);
  }, []);

  const fusionDescriptorMap = useMemo(() => {
    const map = new Map<number, FusionSecondaryDescriptor>();
    if (fusionManifest?.secondaries?.length) {
      fusionManifest.secondaries.forEach((secondary) => {
        map.set(secondary.secondarySeriesId, secondary);
      });
    }
    return map;
  }, [fusionManifest]);

  const fusionSecondaryStatuses = useMemo(() => {
    const map = new Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>();
    fusionDescriptorMap.forEach((secondary) => {
      const loadingState = secondaryLoadingStates.get(secondary.secondarySeriesId);
      if (loadingState?.isLoading) {
        map.set(secondary.secondarySeriesId, { status: 'loading' });
      } else if (secondary.status === 'error') {
        map.set(secondary.secondarySeriesId, { status: 'error', error: secondary.error ?? null });
      } else if (secondary.status === 'ready') {
        map.set(secondary.secondarySeriesId, { status: 'ready' });
      } else if (secondary.status === 'generating' || secondary.status === 'pending') {
        map.set(secondary.secondarySeriesId, { status: 'loading' });
      } else {
        map.set(secondary.secondarySeriesId, { status: 'idle' });
      }
    });
    return map;
  }, [fusionDescriptorMap, secondaryLoadingStates]);

  const seriesById = useMemo(() => {
    const map = new Map<number, DICOMSeries>();
    series.forEach((entry) => {
      if (!entry) return;
      const parsedId = Number(entry.id);
      if (Number.isFinite(parsedId)) {
        map.set(parsedId, entry);
      }
    });
    return map;
  }, [series]);

  const visibleSeriesIdSet = useMemo(() => {
    const set = new Set<number>();
    visibleSeries.forEach((entry) => {
      if (!entry) return;
      const parsedId = Number(entry.id);
      if (Number.isFinite(parsedId)) {
        set.add(parsedId);
      }
    });
    return set;
  }, [visibleSeries]);

  const seriesByFoR = useMemo(() => {
    const map = new Map<string, number[]>();
    const sanitizeFo = (value: unknown): string | null => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
      }
      return null;
    };

    visibleSeries.forEach((entry) => {
      if (!entry) return;
      const id = Number(entry.id);
      if (!Number.isFinite(id)) return;
      const fo = sanitizeFo(entry.frameOfReferenceUID ?? (entry as any)?.metadata?.frameOfReferenceUID);
      if (!fo) return;
      const list = map.get(fo) ?? [];
      list.push(id);
      map.set(fo, list);
    });

    return map;
  }, [visibleSeries]);

  const getCandidateSecondaryIds = useCallback(
    (primarySeriesId: number): number[] => {
      const normalizeSeriesId = (value: unknown): number | null => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'bigint') {
          const asNumber = Number(value);
          return Number.isFinite(asNumber) ? asNumber : null;
        }
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return null;
          const parsed = Number(trimmed);
          return Number.isFinite(parsed) ? parsed : null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const allowedModalities = new Set(['CT', 'PT', 'PET', 'MR', 'NM']);

      const shouldIncludeSeries = (seriesId: number): boolean => {
        if (seriesId === primarySeriesId) return false;
        const entry = seriesById.get(seriesId);
        if (!entry) return false;
        if (shouldHideSeries(entry)) return false;
        const modality = (entry.modality || '').toUpperCase();
        return allowedModalities.has(modality);
      };

      const enqueueNeighbor = (
        neighborId: number | null,
        queue: number[],
        visited: Set<number>,
        results: Set<number>,
      ) => {
        if (neighborId == null) return;
        if (!Number.isFinite(neighborId)) return;
        const id = Number(neighborId);
        if (shouldIncludeSeries(id)) {
          results.add(id);
        }
        if (!visited.has(id)) {
          visited.add(id);
          queue.push(id);
        }
      };

      const visited = new Set<number>([primarySeriesId]);
      const results = new Set<number>();
      const queue: number[] = [primarySeriesId];

      while (queue.length) {
        const current = queue.shift()!;

        const direct = regAssociations?.[current] ?? [];
        direct.forEach((neighbor) => {
          enqueueNeighbor(normalizeSeriesId(neighbor), queue, visited, results);
        });

        const relations = registrationRelationshipMap.get(current) ?? [];
        relations.forEach((assoc) => {
          const neighborIds = new Set<number>();
          const targetId = normalizeSeriesId(assoc.targetSeriesId);
          if (targetId != null && targetId !== current) neighborIds.add(targetId);
          if (Array.isArray(assoc.sourcesSeriesIds)) {
            assoc.sourcesSeriesIds.forEach((id) => {
              const normalized = normalizeSeriesId(id);
              if (normalized != null) neighborIds.add(normalized);
            });
          }
          if (Array.isArray(assoc.siblingSeriesIds)) {
            assoc.siblingSeriesIds.forEach((id) => {
              const normalized = normalizeSeriesId(id);
              if (normalized != null) neighborIds.add(normalized);
            });
          }
          neighborIds.forEach((id) => enqueueNeighbor(id, queue, visited, results));
        });
      }

      // Also include series that share Frame of Reference with the primary
      const primaryEntry = seriesById.get(primarySeriesId);
      const primaryFoR = typeof primaryEntry?.frameOfReferenceUID === 'string' ? primaryEntry.frameOfReferenceUID.trim() : '';
      if (primaryFoR) {
        const foMatches = seriesByFoR.get(primaryFoR) ?? [];
        foMatches.forEach((secondaryId) => {
          if (secondaryId !== primarySeriesId && shouldIncludeSeries(secondaryId)) {
            results.add(secondaryId);
          }
        });
      }

      // Fallback: if no MR or PT candidates found, include all visible MR and PT series
      // This enables fusion even without explicit registration (using identity transform)
      const fusionableModalities = new Set(['PT', 'PET', 'MR', 'NM']);
      const hasFusionableResults = Array.from(results.values()).some((id) => {
        const entry = seriesById.get(id);
        const modality = (entry?.modality || '').toUpperCase();
        return fusionableModalities.has(modality);
      });

      if (!hasFusionableResults) {
        // No fusionable series found through registration - add all MR/PT series as fallback
        visibleSeriesIdSet.forEach((seriesId) => {
          if (seriesId === primarySeriesId) return;
          const entry = seriesById.get(seriesId);
          if (!entry) return;
          const modality = (entry.modality || '').toUpperCase();
          if (fusionableModalities.has(modality) && shouldIncludeSeries(seriesId)) {
            results.add(seriesId);
          }
        });
      }

      const candidateIds = Array.from(results.values()).filter((id) => shouldIncludeSeries(id));
      if (import.meta.env.DEV) {
        const candidateDetails = candidateIds.map(id => {
          const entry = seriesById.get(id);
          return {
            id,
            modality: entry?.modality || 'unknown',
            description: entry?.seriesDescription || 'no desc'
          };
        });
        const ptCandidates = candidateDetails.filter(c => c.modality?.toUpperCase() === 'PT' || c.modality?.toUpperCase() === 'PET');
        
        console.log('🔍 FUSION CANDIDATES DEBUG:', {
          primarySeriesId,
          totalCandidates: candidateIds.length,
          ptCandidates: ptCandidates.length,
          candidateDetails,
          ptDetails: ptCandidates
        });
        
        log.debug(
          `Fusion candidates for primary ${primarySeriesId} (patient ${studyData?.patient?.id ?? 'unknown'}): ${candidateIds.join(', ')}`,
          'viewer-interface',
        );
      }
      return candidateIds;
    },
    [
      regAssociations,
      registrationRelationshipMap,
      seriesById,
      seriesByFoR,
      visibleSeriesIdSet,
      shouldHideSeries,
      studyData?.patient?.id,
    ],
  );

  const fusionCandidatesByPrimary = useMemo(() => {
    const map = new Map<number, number[]>();
    series.forEach((entry) => {
      if (!entry) return;
      const parsedId = Number(entry.id);
      if (!Number.isFinite(parsedId)) return;
      map.set(parsedId, getCandidateSecondaryIds(parsedId));
    });
    return map;
  }, [series, getCandidateSecondaryIds]);

  useEffect(() => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return;
    (window as any).__fusionCandidates = Array.from(
      fusionCandidatesByPrimary.entries(),
    ).map(([primaryId, candidateIds]) => ({ primaryId, candidateIds }));
  }, [fusionCandidatesByPrimary]);

  useEffect(() => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return;
    (window as any).__currentFusionManifest = fusionManifest;
  }, [fusionManifest]);

  const fusionSiblingMap = useMemo(() => {
    const normalizeSeriesIdLocal = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'bigint') {
        const asNumber = Number(value);
        return Number.isFinite(asNumber) ? asNumber : null;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const modalityOf = (id: number | null): string => {
      if (id == null) return '';
      const entry = seriesById.get(id);
      return (entry?.modality || '').toUpperCase();
    };

    const map = new Map<number, Map<'PET' | 'MR', Map<number, number[]>>>();

    registrationRelationshipMap.forEach((associations, primaryId) => {
      const petMapping = new Map<number, Set<number>>();
      const mrMapping = new Map<number, Set<number>>();

      (associations ?? []).forEach((assoc) => {
        const petIds = new Set<number>();
        const ctIds = new Set<number>();
        const mrIds = new Set<number>();

        const registerByModality = (rawId: unknown, modality: string | null | undefined) => {
          const normalizedId = normalizeSeriesIdLocal(rawId);
          if (normalizedId == null || normalizedId === primaryId) return;
          const resolvedModality = (modality || modalityOf(normalizedId)).toUpperCase();
          if (!resolvedModality) return;
          if (!visibleSeriesIdSet.has(normalizedId)) return;
          if (resolvedModality === 'CT') {
            ctIds.add(normalizedId);
          } else if (resolvedModality === 'PT' || resolvedModality === 'PET' || resolvedModality === 'NM') {
            petIds.add(normalizedId);
          } else if (resolvedModality === 'MR') {
            mrIds.add(normalizedId);
          }
        };

        if (Array.isArray(assoc.sourceSeriesDetails)) {
          assoc.sourceSeriesDetails.forEach((detail) => {
            registerByModality(detail?.id, detail?.modality);
          });
        }

        if (Array.isArray(assoc.sourcesSeriesIds)) {
          assoc.sourcesSeriesIds.forEach((value) => {
            registerByModality(value, null);
          });
        }

        if (Array.isArray(assoc.siblingSeriesIds)) {
          assoc.siblingSeriesIds.forEach((value) => {
            registerByModality(value, null);
          });
        }

        if (petIds.size) {
          petIds.forEach((petId) => {
            const entry = petMapping.get(petId) ?? new Set<number>();
            ctIds.forEach((ctId) => entry.add(ctId));
            petMapping.set(petId, entry);
          });
        }

        if (mrIds.size) {
          mrIds.forEach((mrId) => {
            const entry = mrMapping.get(mrId) ?? new Set<number>();
            // MR siblings may include other MR series within same FoR or PET-driven MR matches
            mrIds.forEach((otherMrId) => {
              if (otherMrId !== mrId) entry.add(otherMrId);
            });
            // also allow CT siblings when PET present
            if (petIds.size) {
              ctIds.forEach((ctId) => entry.add(ctId));
            }
            mrMapping.set(mrId, entry);
          });
        }
      });

      const primaryEntry = seriesById.get(primaryId);
      const primaryFoR = typeof primaryEntry?.frameOfReferenceUID === 'string' ? primaryEntry.frameOfReferenceUID.trim() : '';
      if (primaryFoR) {
        const foMatches = seriesByFoR.get(primaryFoR) ?? [];
        const ctFoRIds = new Set<number>();
        ctFoRIds.add(primaryId);
        const petFoRIds = new Set<number>();
        const mrFoRIds = new Set<number>();

        foMatches.forEach((secondaryId) => {
          if (secondaryId === primaryId) return;
          if (!visibleSeriesIdSet.has(secondaryId)) return;
          const entry = seriesById.get(secondaryId);
          if (!entry) return;
          const modality = (entry.modality || '').toUpperCase();
          if (modality === 'CT') {
            ctFoRIds.add(secondaryId);
          } else if (['PT', 'PET', 'NM'].includes(modality)) {
            petFoRIds.add(secondaryId);
          } else if (modality === 'MR') {
            mrFoRIds.add(secondaryId);
          }
        });

        if (petFoRIds.size) {
          if (!ctFoRIds.size) {
            ctFoRIds.add(primaryId);
          }
          petFoRIds.forEach((petId) => {
            const entry = petMapping.get(petId) ?? new Set<number>();
            ctFoRIds.forEach((ctId) => entry.add(ctId));
            petMapping.set(petId, entry);
          });
        }

        if (mrFoRIds.size) {
          mrFoRIds.forEach((mrId) => {
            const entry = mrMapping.get(mrId) ?? new Set<number>();
            mrFoRIds.forEach((otherMrId) => {
              if (otherMrId !== mrId) entry.add(otherMrId);
            });
            entry.add(primaryId);
            petFoRIds.forEach((petId) => entry.add(petId));
            mrMapping.set(mrId, entry);
          });
        }
      }

      if (petMapping.size || mrMapping.size) {
        const forPrimary = new Map<'PET' | 'MR', Map<number, number[]>>();
        if (petMapping.size) {
          const petArrayMap = new Map<number, number[]>();
          petMapping.forEach((set, petId) => {
            petArrayMap.set(petId, Array.from(set.values()));
          });
          forPrimary.set('PET', petArrayMap);
        }
        if (mrMapping.size) {
          const mrArrayMap = new Map<number, number[]>();
          mrMapping.forEach((set, mrId) => {
            mrArrayMap.set(mrId, Array.from(set.values()));
          });
          forPrimary.set('MR', mrArrayMap);
        }
        map.set(primaryId, forPrimary);
      }
    });

    return map;
  }, [registrationRelationshipMap, seriesById, seriesByFoR, visibleSeriesIdSet]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const entries = Array.from(fusionCandidatesByPrimary.entries()).map(([primaryId, ids]) => ({
        primaryId,
        candidateIds: ids,
      }));
      console.debug('Fusion candidate map', entries);
    }
  }, [fusionCandidatesByPrimary]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const modalities = visibleSeries.map((entry) => ({
        id: entry.id,
        modality: entry.modality,
        description: entry.seriesDescription,
      }));
      console.debug('Visible series after derived filter', modalities);
    }
  }, [visibleSeries]);

  useEffect(() => {
    if (!fusionDescriptorMap.size || secondarySeriesId == null) {
      return;
    }
    const descriptor = fusionDescriptorMap.get(secondarySeriesId);
    if (!descriptor) return;
    const defaultWindow = getDefaultFusionWindow(descriptor.secondaryModality);
    // FIX: Set window/level immediately to prevent bright flash on PT/PET
    // Use direct state update instead of batched to ensure it applies before render
    setFusionWindowLevel(defaultWindow);
    
    // Force immediate render with correct windowing
    setTimeout(() => {
      if (workingViewerRef.current?.forceRender) {
        workingViewerRef.current.forceRender();
      }
    }, 1);
  }, [fusionManifest, secondarySeriesId, getDefaultFusionWindow]);

  useEffect(() => {
    if (secondarySeriesId == null) {
      setFusionWindowLevel(null);
    }
  }, [secondarySeriesId]);

  useEffect(() => {
    if (secondarySeriesId == null) return;
    const status = fusionSecondaryStatuses.get(secondarySeriesId);
    if (status?.status === 'error') {
      setSecondarySeriesId(null);
    }
  }, [secondarySeriesId, fusionSecondaryStatuses]);

  const preloadAllFusionSecondaries = useCallback(
    async (primarySeriesId: number, manifest: FusionManifest, requestToken: number) => {
      const readySecondaries = manifest.secondaries.filter((sec) => sec.status === 'ready');
      if (!readySecondaries.length) {
        setSecondaryLoadingStates(new Map());
        setCurrentlyLoadingSecondary(null);
        return;
      }

      const loadingMap = new Map<number, { progress: number; isLoading: boolean }>();
      readySecondaries.forEach((sec) => {
        loadingMap.set(sec.secondarySeriesId, { progress: 0, isLoading: true });
      });
      setSecondaryLoadingStates(loadingMap);

      for (const secondary of readySecondaries) {
        if (fusionManifestRequestRef.current !== requestToken) break;
        setCurrentlyLoadingSecondary(secondary.secondarySeriesId);
        try {
          await preloadFusionSecondary(primarySeriesId, secondary.secondarySeriesId, ({ completed, total }) => {
            if (fusionManifestRequestRef.current !== requestToken) return;
            setSecondaryLoadingStates((prev) => {
              const next = new Map(prev);
              const fraction = total ? (completed / total) * 100 : 100;
              next.set(secondary.secondarySeriesId, { isLoading: true, progress: fraction });
              return next;
            });
          });
          if (fusionManifestRequestRef.current !== requestToken) break;
          setSecondaryLoadingStates((prev) => {
            const next = new Map(prev);
            next.set(secondary.secondarySeriesId, { isLoading: false, progress: 100 });
            return next;
          });
        } catch (error: any) {
          if (fusionManifestRequestRef.current !== requestToken) break;
          console.error('Fusion preload failed', error);
          setFusionManifestError(error?.message || String(error));
          setSecondaryLoadingStates((prev) => {
            const next = new Map(prev);
            next.set(secondary.secondarySeriesId, { isLoading: false, progress: 0 });
            return next;
          });
        }
      }

      if (fusionManifestRequestRef.current === requestToken) {
        setCurrentlyLoadingSecondary(null);
      }
    },
    [],
  );

  const pollFusionManifestUntilReady = useCallback(
    async (
      primarySeriesId: number,
      requestedSecondaryIds: number[],
      requestToken: number,
      attempt: number = 0,
    ): Promise<FusionManifest | null> => {
      if (fusionManifestRequestRef.current !== requestToken) return null;
      const MAX_ATTEMPTS = 8;
      if (attempt >= MAX_ATTEMPTS) {
        return null;
      }

      const delayMs = Math.min(4000, 500 * Math.pow(2, attempt));
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (fusionManifestRequestRef.current !== requestToken) return null;

      try {
        const refreshed = await fetchFusionManifest(primarySeriesId, {
          preload: true,
          secondarySeriesIds: requestedSecondaryIds,
          force: true,
        });
        if (fusionManifestRequestRef.current !== requestToken) return null;
        setFusionManifest(refreshed);
        const relevantIds = requestedSecondaryIds.length ? new Set(requestedSecondaryIds) : null;
        const pending = refreshed.secondaries.filter((sec) => {
          if (sec.status === 'ready' || sec.status === 'error') return false;
          if (relevantIds && !relevantIds.has(sec.secondarySeriesId)) return false;
          return true;
        });
        if (pending.length) {
          return pollFusionManifestUntilReady(primarySeriesId, requestedSecondaryIds, requestToken, attempt + 1);
        }
        return refreshed;
      } catch (error) {
        console.error('Failed to refresh fusion manifest', error);
        return null;
      }
    },
    [],
  );

  const initializeFusionForSeries = useCallback(
    async (seriesEntry: DICOMSeries | null) => {
      const requestToken = ++fusionManifestRequestRef.current;
      if (!seriesEntry) {
        resetFusionState({ clearCache: true });
        return;
      }

      const modality = (seriesEntry.modality || '').toUpperCase();
      if (modality !== 'CT') {
        resetFusionState({ clearCache: true, primarySeriesId: seriesEntry.id });
        return;
      }

      resetFusionState({ clearCache: true, primarySeriesId: seriesEntry.id });
      setFusionManifestLoading(true);
      setFusionManifestError(null);

      try {
        const candidateSecondaryIds = getCandidateSecondaryIds(seriesEntry.id);
        let manifest = await fetchFusionManifest(seriesEntry.id, {
          preload: true,
          secondarySeriesIds: candidateSecondaryIds,
        });
        if (fusionManifestRequestRef.current !== requestToken) return;
        setFusionManifest(manifest);

        if (!manifest.secondaries.length) {
          setShowFusionPanel(false);
          setSecondarySeriesId(null);
          setSecondaryLoadingStates(new Map());
          return;
        }

        const relevantIds = candidateSecondaryIds.length
          ? candidateSecondaryIds
          : manifest.secondaries.map((sec) => sec.secondarySeriesId);
        const pending = manifest.secondaries.filter(
          (sec) =>
            relevantIds.includes(sec.secondarySeriesId) &&
            sec.status !== 'ready' &&
            sec.status !== 'error',
        );

        if (pending.length) {
          const refreshed = await pollFusionManifestUntilReady(seriesEntry.id, relevantIds, requestToken);
          if (fusionManifestRequestRef.current !== requestToken) return;
          if (refreshed) {
            manifest = refreshed;
          }
        }

        if (fusionManifestRequestRef.current !== requestToken) return;

        const pendingAfterPoll = manifest.secondaries.some(
          (sec) =>
            relevantIds.includes(sec.secondarySeriesId) &&
            sec.status !== 'ready' &&
            sec.status !== 'error',
        );
        if (pendingAfterPoll) {
          setFusionManifestError((prev) => prev ?? 'Fusion cache is still generating. Please retry shortly.');
        }

        // Keep any user selection; panel will reflect actual readiness via badges
        setShowFusionPanel(true);

        await preloadAllFusionSecondaries(seriesEntry.id, manifest, requestToken);

        // Auto-select a READY secondary once preload completes, gated by the active token
        if (fusionManifestRequestRef.current === requestToken) {
          try {
            // Prefer secondaries marked 'ready' in the manifest
            const readyIds = manifest.secondaries
              .filter((sec) => sec.status === 'ready')
              .map((sec) => sec.secondarySeriesId);

            // Fall back: intersect with currently allowed descriptors if available
            // Note: fusionDescriptorMap is derived via useMemo and may not be updated synchronously here,
            // so prefer manifest readiness as the primary signal.
            const candidate = readyIds[0] ?? null;

            if (candidate != null) {
              setSecondarySeriesId(candidate);
            }
          } catch {}
        }
      } catch (error: any) {
        if (fusionManifestRequestRef.current !== requestToken) return;
        console.error('Failed to initialize fusion manifest', error);
        setFusionManifest(null);
        setFusionManifestError(error?.message || String(error));
        setShowFusionPanel(false);
        setSecondarySeriesId(null);
      } finally {
        if (fusionManifestRequestRef.current === requestToken) {
          setFusionManifestLoading(false);
        }
      }
    },
    [getCandidateSecondaryIds, pollFusionManifestUntilReady, preloadAllFusionSecondaries, resetFusionState],
  );

  // Prevent manifest init deathloops by gating on candidate set changes and a short cooldown
  const prevCandidateKeyRef = useRef<string | null>(null);
  const lastInitAtRef = useRef<number>(0);

  useEffect(() => {
    if (!selectedSeries) return;
    const modality = (selectedSeries.modality || '').toUpperCase();
    if (modality !== 'CT') return;
    if (fusionManifestLoading) return;

    const candidateSecondaryIds = getCandidateSecondaryIds(selectedSeries.id);
    const manifestMatchesSeries = fusionManifest?.primarySeriesId === selectedSeries.id;
    const manifestIds = manifestMatchesSeries ? new Set(fusionManifest.secondaries.map((sec) => sec.secondarySeriesId)) : null;
    const hasMissing = manifestIds ? candidateSecondaryIds.some((id) => !manifestIds.has(id)) : candidateSecondaryIds.length > 0;

    // Build a stable key for current candidates
    const candidateKey = candidateSecondaryIds.slice().sort((a, b) => a - b).join(',');
    const unchangedCandidates = prevCandidateKeyRef.current === candidateKey;
    const withinCooldown = Date.now() - lastInitAtRef.current < 5000; // 5s cooldown

    // Only (re)initialize if:
    // - manifest is for a different series, or
    // - there are genuinely new candidates not in the current manifest
    // And avoid tight loops when candidates/associations flicker
    if (!manifestMatchesSeries || hasMissing) {
      if (unchangedCandidates && withinCooldown) return;
      prevCandidateKeyRef.current = candidateKey;
      lastInitAtRef.current = Date.now();
      initializeFusionForSeries(selectedSeries);
    }
  }, [getCandidateSecondaryIds, regAssociations, selectedSeries, fusionManifest, fusionManifestLoading, initializeFusionForSeries]);

  // Check and regenerate superstructures that depend on a modified structure
  const checkAndRegenerateSuperstructures = async (modifiedStructureId: number) => {
    if (!rtStructures?.seriesId) return;
    
    try {
      // Fetch all superstructures for this RT set
      const response = await fetch(`/api/superstructures/${rtStructures.seriesId}`);
      if (!response.ok) return;
      
      const allSuperstructures = await response.json();
      
      // Find superstructures that depend on the modified structure (using ROI numbers)
      const dependentSuperstructures = allSuperstructures.filter((ss: any) => 
        ss.autoUpdate && ss.sourceStructureRoiNumbers?.includes(modifiedStructureId)
      );
      
      if (dependentSuperstructures.length === 0) return;
      
      console.log(`🔄 Found ${dependentSuperstructures.length} superstructure(s) to regenerate after modifying structure ${modifiedStructureId}`);
      
      // Regenerate each dependent superstructure
      for (const ss of dependentSuperstructures) {
        try {
          console.log(`🔄 Regenerating superstructure: ${ss.operationExpression}`);
          const regenResponse = await fetch(`/api/superstructures/${ss.id}/regenerate`, {
            method: 'POST'
          });
          
          if (regenResponse.ok) {
            // Reload RT structures to show updated contours
            const rtResponse = await fetch(`/api/rt-structures/${rtStructures.seriesId}/contours`);
            if (rtResponse.ok) {
              const updatedRTStructures = await rtResponse.json();
              setRTStructures(updatedRTStructures);
              console.log(`✅ Superstructure regenerated and reloaded`);
            }
          }
        } catch (error) {
          console.error(`Error regenerating superstructure ${ss.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking for dependent superstructures:', error);
    }
  };

  const handleContourUpdate = async (payload: any) => {
    console.log('Contour update received:', payload);
    console.log('Payload type:', typeof payload);
    console.log('Payload.action:', payload?.action);
    console.log('Payload has action?', !!payload?.action);
    
    // Check if this is an action payload from ContourEditToolbar or full structures from WorkingViewer
    if (payload && payload.action) {
      // This is an action payload from ContourEditToolbar
      // Pass it directly to WorkingViewer's handleContourUpdate
      console.log(`✓ Received action: ${payload.action} for structure ${payload.structureId}`);
      if (workingViewerRef.current && workingViewerRef.current.handleContourUpdate) {
        workingViewerRef.current.handleContourUpdate(payload);
      }
      
      // Check if we need to trigger superstructure regeneration
      if (payload.structureId && rtStructures?.seriesId) {
        await checkAndRegenerateSuperstructures(payload.structureId);
      }
      
      return;
    }
    
    console.log('⚠️ Payload has no action field, treating as RT structures');
    
    // This is the full updated RT structures from WorkingViewer after processing
    if (payload && payload.structures) {
      console.log('📥 Updating rtStructures state with:', {
        structureCount: payload.structures?.length,
        structureNames: payload.structures?.map((s: any) => s.structureName),
        timestamp: new Date().toISOString()
      });
      setRTStructures(payload);
      console.log('✅ setRTStructures called - sidebar should update now');
    } else {
      console.warn('⚠️ Payload has no structures field, not updating state:', payload);
    }
  };

  // Undo/Redo handlers for bottom toolbar
  const handleGlobalUndo = () => {
    const prev = undoRedoManager.undo();
    if (prev) {
      console.log(`🔄 Global Undo: reverting to "${prev.action}" on structure ${prev.structureId}`);
      setRTStructures(prev.rtStructures);
      toast({
        title: `Undone: ${prev.action}`,
        description: prev.structureName || `Structure ${prev.structureId}`,
      });
    }
  };

  const handleGlobalRedo = () => {
    const next = undoRedoManager.redo();
    if (next) {
      console.log(`🔄 Global Redo: re-applying "${next.action}" on structure ${next.structureId}`);
      setRTStructures(next.rtStructures);
      toast({
        title: `Redone: ${next.action}`,
        description: next.structureName || `Structure ${next.structureId}`,
      });
    }
  };

  const handleJumpToHistory = (index: number) => {
    const state = undoRedoManager.jumpTo(index);
    if (state) {
      setRTStructures(state.rtStructures);
    }
  };

  const triggerFusionDebug = useCallback(() => {
    try {
      workingViewerRef.current?.openFusionDebug?.('manual');
    } catch (error) {
      console.warn('Unable to open fusion debug panel', error);
    }
  }, []);

  const captureFusionDebug = useCallback(() => {
    try {
      const payload = (window as any)?.__fusion;
      if (!payload) {
        setFusionDebugSnapshot('window.__fusion is empty');
        return;
      }
      setFusionDebugSnapshot(JSON.stringify(payload, null, 2));
    } catch (error: any) {
      setFusionDebugSnapshot(`Failed to read window.__fusion: ${error?.message || String(error)}`);
    }
  }, []);

  const handleRebuildManifest = useCallback(async () => {
    if (!selectedSeries) {
      setManifestActionStatus('Select a primary series first.');
      return;
    }

    setManifestActionStatus('Initializing fusion…');
    setFusionDebugSnapshot(null);

    try {
      // Trigger full fusion initialization for current series
      await initializeFusionForSeries(selectedSeries);
      setManifestActionStatus('Fusion initialized successfully');
      setTimeout(() => setManifestActionStatus(null), 3000);
      return;
    } catch (error: any) {
      setManifestActionStatus(`Failed: ${error?.message || String(error)}`);
      setTimeout(() => setManifestActionStatus(null), 5000);
    }
  }, [selectedSeries, initializeFusionForSeries]);

  // Subscribe to undo manager changes to refresh toolbar state
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
    items: [] as Array<{ timestamp: number; action: string; structureId: number }>,
    index: -1
  });

  useEffect(() => {
    const update = () => {
      try {
        setHistoryState({
          canUndo: undoRedoManager.canUndo(),
          canRedo: undoRedoManager.canRedo(),
          items: undoRedoManager.getHistory().map(h => ({ timestamp: h.timestamp, action: h.action, structureId: h.structureId })),
          index: undoRedoManager.getCurrentIndex()
        });
      } catch {}
    };
    update();
    const unsubscribe = undoRedoManager.subscribe(update);
    return () => unsubscribe();
  }, [selectedSeries?.id]);

  // Auto-zoom functionality based on structure bounds
  const getStructureBounds = (structure: any) => {
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;
    let zSum = 0, xSum = 0, ySum = 0, n = 0;

    for (const contour of structure.contours) {
      for (let i = 0; i < contour.points.length; i += 3) {
        const x = contour.points[i];
        const y = contour.points[i + 1];
        const z = contour.points[i + 2];
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
        xSum += x;
        ySum += y;
        zSum += z;
        n++;
      }
    }

    return {
      centroid: { x: xSum / n, y: ySum / n, z: zSum / n },
      widthMM: xMax - xMin,
      heightMM: yMax - yMin
    };
  };

  const getAutoZoomForBounds = (widthMM: number, heightMM: number, canvasWidth: number, canvasHeight: number, pixelSpacing: [number, number]) => {
    const fillFactor = 0.4; // target % of canvas to fill
    const targetPixelWidth = canvasWidth * fillFactor;
    const targetPixelHeight = canvasHeight * fillFactor;

    const widthInPixels = widthMM / pixelSpacing[0];
    const heightInPixels = heightMM / pixelSpacing[1];

    const zoomX = targetPixelWidth / widthInPixels;
    const zoomY = targetPixelHeight / heightInPixels;

    return Math.min(zoomX, zoomY, 5); // cap max zoom at 5x
  };

  // Auto-zoom effect disabled per user request
  // useEffect(() => {
  //   if (!selectedForEdit || !rtStructures?.structures) return;

  //   const structure = rtStructures.structures.find((s: any) => s.roiNumber === selectedForEdit);
  //   if (!structure || !structure.contours || structure.contours.length === 0) return;

  //   try {
  //     const { centroid, widthMM, heightMM } = getStructureBounds(structure);
      
  //     // Only auto-zoom if we have valid bounds
  //     if (isFinite(widthMM) && isFinite(heightMM) && widthMM > 0 && heightMM > 0) {
  //       console.log(`Auto-zooming to structure ${structure.structureName}: ${widthMM.toFixed(1)}mm x ${heightMM.toFixed(1)}mm`);
        
  //       // Focus on the structure's centroid slice
  //       const newSlice = Math.round(centroid.z);
        
  //       // For now, we'll just log the auto-zoom intent
  //       // The actual zoom/pan implementation would need to be integrated 
  //       // with the WorkingViewer component's zoom and pan state
  //       console.log(`Centering on slice ${newSlice}, structure centroid:`, centroid);
  //       console.log(`Recommended zoom for structure size: ${widthMM.toFixed(1)}mm x ${heightMM.toFixed(1)}mm`);
  //     }
  //   } catch (error) {
  //     console.warn('Error calculating auto-zoom for structure:', error);
  //   }
  // }, [selectedForEdit, rtStructures]);

  // Handle structure localization
  const handleStructureLocalization = useCallback((structureId: number) => {
    if (!rtStructures?.structures || !workingViewerRef.current) {
      log.warn('🎯 Cannot localize: missing structures or viewer ref', 'viewer-interface');
      return;
    }

    const structure = rtStructures.structures.find((s: any) => s.roiNumber === structureId);
    if (!structure || !structure.contours || structure.contours.length === 0) {
      console.warn(`🎯 Cannot localize: structure ${structureId} not found or has no contours`);
      return;
    }

    console.log(`🎯 Localizing to structure "${structure.structureName}"...`);

    // Calculate structure bounds and centroid
    let minZ = Infinity, maxZ = -Infinity;
    let totalX = 0, totalY = 0, totalZ = 0, totalPoints = 0;
    
    structure.contours.forEach((contour: any) => {
      if (contour.points && contour.points.length >= 6) {
        // Track Z bounds for finding middle slice
        if (contour.slicePosition !== undefined) {
          minZ = Math.min(minZ, contour.slicePosition);
          maxZ = Math.max(maxZ, contour.slicePosition);
        }
        
        // Calculate centroid
        for (let i = 0; i < contour.points.length; i += 3) {
          totalX += contour.points[i];
          totalY += contour.points[i + 1];
          totalZ += contour.points[i + 2];
          totalPoints++;
        }
      }
    });
    
    if (totalPoints === 0) {
      console.warn(`🎯 Cannot localize: structure ${structureId} has no valid points`);
      return;
    }

    // Calculate centroid
    const centroidX = totalX / totalPoints;
    const centroidY = totalY / totalPoints;
    const centroidZ = totalZ / totalPoints;
    
    // Use middle Z slice if we have slice position bounds, otherwise use centroid Z
    const targetZ = (minZ !== Infinity && maxZ !== -Infinity) ? (minZ + maxZ) / 2 : centroidZ;
    
    console.log(`🎯 Localizing to "${structure.structureName}":`, {
      centroid: `(${centroidX.toFixed(1)}, ${centroidY.toFixed(1)}, ${centroidZ.toFixed(1)})`,
      sliceBounds: minZ !== Infinity ? `${minZ.toFixed(1)} to ${maxZ.toFixed(1)}` : 'unknown',
      targetZ: targetZ.toFixed(1)
    });
    
    // Navigate to the structure by finding the closest slice
    if (workingViewerRef.current && workingViewerRef.current.navigateToSlice) {
      workingViewerRef.current.navigateToSlice(targetZ);
    } else {
      console.warn('🎯 WorkingViewer navigateToSlice method not available');
    }
    
    console.log(`🎯 ✅ Localization completed for "${structure.structureName}"`);
  }, [rtStructures, workingViewerRef]);

  // Handle localization button toggle
  const handleLocalizationToggle = useCallback(() => {
    const newState = !showLocalizationTool;
    setShowLocalizationTool(newState);
    
    if (newState) {
      console.log('🎯 Localization mode ACTIVATED - click any structure to navigate to its center');
    } else {
      console.log('🎯 Localization mode DEACTIVATED');
    }
  }, [showLocalizationTool]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border border-dicom-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-dicom-yellow">Loading study...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="animate-in fade-in-50 duration-500">
      <div className="flex gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
        
        {/* Series Selector - Responsive Width */}
        <div className="w-full md:w-96 h-full overflow-hidden flex-shrink-0 hidden md:block">
          <SeriesSelector
            series={visibleSeries}
            selectedSeries={selectedSeries}
            onSeriesSelect={handleSeriesSelect}
            windowLevel={windowLevel}
            onWindowLevelChange={setWindowLevel}
            studyId={studyData.studies[0]?.id}
            studyIds={studyData.studies.map((s: any) => s.id)}
            regAssociations={regAssociations}
            regCtacSeriesIds={regCtacIds}
            rtStructures={rtStructures}
            onRTStructureLoad={handleRTStructureLoad}
            onStructureVisibilityChange={handleStructureVisibilityChange}
            externalStructureVisibility={structureVisibility}
            onStructureColorChange={handleStructureColorChange}
            onStructureSelection={handleStructureSelection}
            selectedForEdit={selectedForEdit}
            onSelectedForEditChange={(structureId) => {
              setSelectedForEdit(structureId);
              
              // If localization mode is active, auto-navigate to the selected structure
              if (showLocalizationTool && structureId && rtStructures?.structures) {
                handleStructureLocalization(structureId);
              }
            }}
            onContourSettingsChange={onContourSettingsChange}
            onAutoZoom={(zoom) => {
              // Set auto-zoom level for WorkingViewer
              setAutoZoomLevel(zoom);
              // Clear after a short delay to allow component to react
              setTimeout(() => setAutoZoomLevel(undefined), 100);
            }}
            onAutoLocalize={(x, y, z) => {
              // Set auto-localize target for WorkingViewer
              setAutoLocalizeTarget({ x, y, z });
              // Clear after a short delay to allow component to react
              setTimeout(() => setAutoLocalizeTarget(undefined), 100);
            }}
            secondarySeriesId={secondarySeriesId}
            onSecondarySeriesSelect={setSecondarySeriesId}
            onRebuildFusionManifest={handleRebuildManifest}
            preventRTLoading={false}
            onAllStructuresVisibilityChange={handleAllStructuresVisibilityChange}
            // Pass localization mode to highlight when active
            localizationMode={showLocalizationTool}
            // Pass preview state for highlighting
            previewStructureInfo={previewStructureInfo}
            // Pass highlighted structures for boolean operations
            highlightedStructures={highlightedStructures}
            loadedRTSeriesId={loadedRTSeriesId}
            onLoadedRTSeriesIdChange={setLoadedRTSeriesId}
            secondaryLoadingStates={secondaryLoadingStates}
            currentlyLoadingSecondary={currentlyLoadingSecondary}
            fusionStatuses={fusionSecondaryStatuses}
            fusionCandidatesByPrimary={fusionCandidatesByPrimary}
            fusionSiblingMap={fusionSiblingMap}
            viewportAssignments={viewportAssignments}
            isInSplitView={fusionLayoutPreset !== 'overlay' && secondarySeriesId !== null}
            // RT Dose props
            selectedDoseSeriesId={selectedDoseSeriesId}
            onDoseSeriesSelect={setSelectedDoseSeriesId}
            onShowDosePanel={setShowDosePanel}
          />
        </div>

        {/* DICOM Viewer with Dynamic Border - Flexible Width */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 0, minWidth: 0 }}>
          {selectedSeries ? (
            <div className="flex-1 flex flex-col relative h-full" style={{ minHeight: 0 }}>
              
              {/* Unified Fusion Topbar - Above viewport, combines topbar info with fusion dropdown */}
              {/* ALWAYS show for overlay and side-by-side modes, hide when in true multi-viewport mode */}
              {!(fusionLayoutPreset !== 'overlay' && fusionLayoutPreset !== 'side-by-side' && secondarySeriesId) && (
                <UnifiedFusionTopbar
                  primaryModality={selectedSeries?.modality || 'CT'}
                  primarySeriesDescription={selectedSeries?.seriesDescription}
                  currentSlice={currentSliceIndex + 1}
                  totalSlices={selectedSeries?.imageCount || selectedSeries?.images?.length || 1}
                  windowLevel={windowLevel ? { window: windowLevel.window, level: windowLevel.level } : undefined}
                  zPosition={currentSlicePosition}
                  orientation="axial"
                  // Slice navigation - directly update state, working-viewer will respond via externalSliceIndex
                  onPrevSlice={() => {
                    if (currentSliceIndex > 0) {
                      const newIndex = currentSliceIndex - 1;
                      setCurrentSliceIndex(newIndex);
                      setSyncedSliceIdx(newIndex);
                    }
                  }}
                  onNextSlice={() => {
                    const maxSlice = (selectedSeries?.imageCount || selectedSeries?.images?.length || 1) - 1;
                    if (currentSliceIndex < maxSlice) {
                      const newIndex = currentSliceIndex + 1;
                      setCurrentSliceIndex(newIndex);
                      setSyncedSliceIdx(newIndex);
                    }
                  }}
                  onReset={() => {
                    // Reset to first slice
                    setCurrentSliceIndex(0);
                    setSyncedSliceIdx(0);
                    // Reset window/level to default
                    if (selectedSeries?.modality === 'CT') {
                      setWindowLevel({ window: 400, level: 40 }); // Default CT soft tissue
                    }
                  }}
                  rtStructuresCount={rtStructures?.structures?.length || 0}
                  rtStructuresVisible={allStructuresVisible}
                  onToggleStructures={() => {
                    const newVisible = !allStructuresVisible;
                    handleAllStructuresVisibilityChange(newVisible);
                    // Also update individual structure visibility to stay in sync with series-selector
                    if (rtStructures?.structures) {
                      setStructureVisibility(prev => {
                        const newMap = new Map(prev);
                        rtStructures.structures.forEach((structure: any) => {
                          newMap.set(structure.roiNumber, newVisible);
                        });
                        return newMap;
                      });
                    }
                  }}
                  showMPR={mprVisible}
                  onToggleMPR={() => setMprVisible(!mprVisible)}
                  secondarySeriesId={secondarySeriesId}
                  onSecondarySeriesSelect={setSecondarySeriesId}
                  fusionOpacity={fusionOpacity}
                  onFusionOpacityChange={setFusionOpacity}
                  fusionWindowLevel={fusionWindowLevel}
                  onFusionWindowLevelChange={setFusionWindowLevel}
                  secondaryOptions={fusionManifest?.secondaries || []}
                  secondaryStatuses={fusionSecondaryStatuses}
                  manifestLoading={fusionManifestLoading}
                  manifestError={fusionManifestError}
                  hasPotentialFusions={(registrationRelationshipMap.get(selectedSeries?.id ?? 0)?.length ?? 0) > 0}
                  fusionLayoutPreset={fusionLayoutPreset}
                  onLayoutPresetChange={handleLayoutPresetChange}
                  isExpanded={showFusionPanel}
                  onExpandedChange={setShowFusionPanel}
                  className="z-20"
                />
              )}
              
              {/* Dynamic Border Based on Selected Structures */}
              <div 
                className="absolute inset-0 rounded-lg pointer-events-none transition-all duration-300"
                style={{
                  border: selectedStructureColors.length > 0 
                    ? `2px solid ${selectedStructureColors[0]}` 
                    : '1px solid rgba(75, 85, 99, 0.3)',
                  boxShadow: selectedStructureColors.length > 0 
                    ? `0 0 20px ${selectedStructureColors[0]}33, inset 0 0 0 1px ${selectedStructureColors[0]}22`
                    : 'none',
                  zIndex: 1
                }}
              />
              
              {/* Multi-color border effect for multiple selections */}
              {selectedStructureColors.length > 1 && (
                <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ zIndex: 1 }}>
                  {selectedStructureColors.map((color, index) => (
                    <div
                      key={index}
                      className="absolute inset-0 rounded-lg transition-all duration-300"
                      style={{
                        border: `2px solid ${color}`,
                        transform: `scale(${1 - (index * 0.015)})`,
                        opacity: 0.85 - (index * 0.2),
                        boxShadow: index === 0 ? `0 0 15px ${color}40` : 'none'
                      }}
                    />
                  ))}
                </div>
              )}
              
              {/* Main Viewer - FlexibleFusionLayout OR Side-by-Side OR WorkingViewer */}
              {/* ContourEditProvider enables cross-viewport ghost contour synchronization */}
              <ContourEditProvider>
              
              {/* Preload progress indicator for multi-viewport mode */}
              {preloadProgress && preloadProgress.total > 0 && preloadProgress.loaded < preloadProgress.total && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 border border-cyan-500/30 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-cyan-400">
                    Preloading for smooth scrolling... {Math.round((preloadProgress.loaded / preloadProgress.total) * 100)}%
                  </span>
                  <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-150"
                      style={{ width: `${(preloadProgress.loaded / preloadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Multi-viewport modes (triple, quad, etc.) use FlexibleFusionLayout - NOT side-by-side */}
              {fusionLayoutPreset !== 'overlay' && fusionLayoutPreset !== 'side-by-side' && secondarySeriesId ? (
                <FlexibleFusionLayout
                  primarySeriesId={selectedSeries.id}
                  secondarySeriesIds={Array.from(fusionDescriptorMap.keys())}
                  studyId={selectedSeries.studyId ?? studyData.studies[0]?.id}
                  availableSeries={series}
                  fusionOpacity={fusionOpacity}
                  onFusionOpacityChange={setFusionOpacity}
                  fusionWindowLevel={fusionWindowLevel}
                  onFusionWindowLevelChange={setFusionWindowLevel}
                  rtStructures={rtStructures}
                  structureVisibility={structureVisibility}
                  allStructuresVisible={allStructuresVisible}
                  selectedForEdit={selectedForEdit}
                  selectedStructures={selectedStructures}
                  onContourUpdate={handleContourUpdate}
                  onRTStructureUpdate={setRTStructures}
                  contourSettings={contourSettings}
                  brushToolState={brushToolState}
                  onBrushSizeChange={(size) => {
                    setBrushToolState(prev => ({ ...prev, brushSize: size }));
                    try {
                      const evt = new CustomEvent('brush:size:update', { detail: { brushSize: size } });
                      window.dispatchEvent(evt);
                    } catch {}
                  }}
                  windowLevel={windowLevel}
                  onWindowLevelChange={setWindowLevel}
                  imageCache={imageCache}
                  registrationAssociations={registrationRelationshipMap}
                  onLayoutChange={(layout) => {
                    handleLayoutPresetChange(layout as FusionLayoutPreset);
                  }}
                  onSwapViewports={handleSwapViewports}
                  fusionSecondaryStatuses={fusionSecondaryStatuses}
                  fusionManifestLoading={fusionManifestLoading}
                  fusionManifestPrimarySeriesId={fusionManifest?.primarySeriesId ?? null}
                  selectedFusionSecondaryId={secondarySeriesId}
                  onSecondarySeriesSelect={setSecondarySeriesId}
                  fusionDisplayMode={fusionDisplayMode}
                  fusionLayoutPreset={fusionLayoutPreset}
                  isMPRVisible={mprVisible}
                  onMPRToggle={() => setMprVisible(!mprVisible)}
                  externalZoom={syncedZoom}
                  onZoomChange={setSyncedZoom}
                  initialSliceIndex={currentSliceIndex}
                  onExitToOverlay={handleExitToOverlay}
                  onViewportAssignmentsChange={setViewportAssignments}
                />
              ) : fusionLayoutPreset === 'side-by-side' && secondarySeriesId ? (
                /* Side-by-Side: Two viewports - left=primary only, right=secondary only */
                /* Primary viewport drives sync (scroll, zoom, pan), secondary follows */
                <div className="flex-1 flex gap-1" style={{ minHeight: 0 }}>
                  {/* Left: Primary CT only - DRIVES sync */}
                  <div className="flex-1 relative" style={{ minHeight: 0 }}>
                    <WorkingViewer 
                      viewportId={`sbs-primary-${selectedSeries.id}`}
                      seriesId={selectedSeries.id}
                      studyId={selectedSeries.studyId ?? studyData.studies[0]?.id}
                      windowLevel={windowLevel}
                      onWindowLevelChange={setWindowLevel}
                      rtStructures={rtStructures}
                      structureVisibility={structureVisibility}
                      brushToolState={brushToolState}
                      selectedForEdit={selectedForEdit}
                      selectedStructures={selectedStructures}
                      onBrushSizeChange={(size) => {
                        setBrushToolState(prev => ({ ...prev, brushSize: size }));
                        try {
                          const evt = new CustomEvent('brush:size:update', { detail: { brushSize: size } });
                          window.dispatchEvent(evt);
                        } catch {}
                      }}
                      onContourUpdate={handleContourUpdate}
                      onSlicePositionChange={setCurrentSlicePosition}
                      onSliceIndexChange={(idx) => {
                        setCurrentSliceIndex(idx);
                        setSyncedSliceIdx(idx); // Sync to secondary
                      }}
                      contourSettings={contourSettings}
                      autoZoomLevel={autoZoomLevel}
                      autoLocalizeTarget={autoLocalizeTarget}
                      secondarySeriesId={null}
                      fusionOpacity={0}
                      fusionDisplayMode="overlay"
                      fusionLayoutPreset="overlay"
                      onSecondarySeriesSelect={() => {}}
                      onFusionOpacityChange={() => {}}
                      hasSecondarySeriesForFusion={false}
                      onImageMetadataChange={setImageMetadata}
                      allStructuresVisible={allStructuresVisible}
                      imageCache={imageCache}
                      onMPRToggle={() => setMprVisible(!mprVisible)}
                      isMPRVisible={mprVisible}
                      allowedSecondaryIds={[]}
                      registrationAssociations={registrationRelationshipMap}
                      availableSeries={series}
                      fusionWindowLevel={null}
                      fusionSecondaryStatuses={fusionSecondaryStatuses}
                      fusionManifestLoading={false}
                      fusionManifestPrimarySeriesId={null}
                      onActivePredictionsChange={setActivePredictions}
                      // Bidirectional sync - both drives and follows
                      externalSliceIndex={syncedSliceIdx}
                      externalZoom={syncedZoom}
                      externalPan={syncedPan}
                      onZoomChange={setSyncedZoom}
                      onPanChange={(x, y) => setSyncedPan({ x, y })}
                      hideSidebar
                      hideToolbar
                      // RT Dose props
                      doseSeriesId={selectedDoseSeriesId}
                      doseOpacity={doseOpacity}
                      doseVisible={doseVisible}
                      doseColormap={doseColormap}
                      showIsodose={showIsodose}
                      prescriptionDose={prescriptionDose}
                      // RT Plan / Beam overlay props
                      showBeamOverlay={showBeamOverlay}
                      selectedBeamNumber={selectedBeamNumber}
                      beamOverlayOpacity={beamOverlayOpacity}
                      beams={loadedBeams}
                      bevProjections={loadedBEVProjections}
                    />
                  </div>
                  {/* Right: Secondary scan only - BIDIRECTIONAL sync with primary */}
                  <div className="flex-1 relative" style={{ minHeight: 0 }}>
                    <WorkingViewer 
                      viewportId={`sbs-secondary-${selectedSeries.id}`}
                      seriesId={selectedSeries.id}
                      studyId={selectedSeries.studyId ?? studyData.studies[0]?.id}
                      windowLevel={windowLevel}
                      onWindowLevelChange={setWindowLevel}
                      rtStructures={rtStructures}
                      structureVisibility={structureVisibility}
                      brushToolState={brushToolState}
                      selectedForEdit={selectedForEdit}
                      selectedStructures={selectedStructures}
                      onBrushSizeChange={(size) => {
                        setBrushToolState(prev => ({ ...prev, brushSize: size }));
                        try {
                          const evt = new CustomEvent('brush:size:update', { detail: { brushSize: size } });
                          window.dispatchEvent(evt);
                        } catch {}
                      }}
                      onContourUpdate={handleContourUpdate}
                      onSlicePositionChange={setCurrentSlicePosition}
                      onSliceIndexChange={(idx) => {
                        setCurrentSliceIndex(idx);
                        setSyncedSliceIdx(idx); // Sync back to primary (bidirectional)
                      }}
                      contourSettings={contourSettings}
                      autoZoomLevel={autoZoomLevel}
                      autoLocalizeTarget={autoLocalizeTarget}
                      secondarySeriesId={secondarySeriesId}
                      fusionOpacity={1}
                      fusionDisplayMode="overlay"
                      fusionLayoutPreset="overlay"
                      onSecondarySeriesSelect={setSecondarySeriesId}
                      onFusionOpacityChange={() => {}}
                      hasSecondarySeriesForFusion={fusionDescriptorMap.size > 0}
                      onImageMetadataChange={() => {}}
                      allStructuresVisible={allStructuresVisible}
                      imageCache={imageCache}
                      onMPRToggle={() => {}}
                      isMPRVisible={false}
                      allowedSecondaryIds={Array.from(fusionDescriptorMap.keys())}
                      registrationAssociations={registrationRelationshipMap}
                      availableSeries={series}
                      fusionWindowLevel={fusionWindowLevel}
                      fusionSecondaryStatuses={fusionSecondaryStatuses}
                      fusionManifestLoading={fusionManifestLoading}
                      fusionManifestPrimarySeriesId={fusionManifest?.primarySeriesId ?? null}
                      onActivePredictionsChange={() => {}}
                      // Bidirectional sync - both drives and follows
                      externalSliceIndex={syncedSliceIdx}
                      externalZoom={syncedZoom}
                      externalPan={syncedPan}
                      onZoomChange={setSyncedZoom}
                      onPanChange={(x, y) => setSyncedPan({ x, y })}
                      hideSidebar
                      hideToolbar
                      // RT Dose props
                      doseSeriesId={selectedDoseSeriesId}
                      doseOpacity={doseOpacity}
                      doseVisible={doseVisible}
                      doseColormap={doseColormap}
                      showIsodose={showIsodose}
                      prescriptionDose={prescriptionDose}
                      // RT Plan / Beam overlay props
                      showBeamOverlay={showBeamOverlay}
                      selectedBeamNumber={selectedBeamNumber}
                      beamOverlayOpacity={beamOverlayOpacity}
                      beams={loadedBeams}
                      bevProjections={loadedBEVProjections}
                    />
                  </div>
                </div>
              ) : (
                <WorkingViewer 
                  ref={workingViewerRef}
                  seriesId={selectedSeries.id}
                  studyId={selectedSeries.studyId ?? studyData.studies[0]?.id}
                  windowLevel={windowLevel}
                  onWindowLevelChange={setWindowLevel}
                  rtStructures={rtStructures}
                  structureVisibility={structureVisibility}
                  brushToolState={brushToolState}
                  selectedForEdit={selectedForEdit}
                  selectedStructures={selectedStructures}
                  onBrushSizeChange={(size) => {
                    setBrushToolState(prev => ({ ...prev, brushSize: size }));
                    try {
                      const evt = new CustomEvent('brush:size:update', { detail: { brushSize: size } });
                      window.dispatchEvent(evt);
                    } catch {}
                  }}
                  onContourUpdate={handleContourUpdate}
                  onSlicePositionChange={setCurrentSlicePosition}
                  onSliceIndexChange={(idx) => {
                    setCurrentSliceIndex(idx);
                    // Keep syncedSliceIdx in sync so side-by-side mode starts at same slice
                    setSyncedSliceIdx(idx);
                  }}
                  // Pass external slice index for topbar navigation control
                  externalSliceIndex={currentSliceIndex}
                  contourSettings={contourSettings}
                  autoZoomLevel={autoZoomLevel}
                  autoLocalizeTarget={autoLocalizeTarget}
                  secondarySeriesId={secondarySeriesId}
                  fusionOpacity={fusionOpacity}
                  fusionDisplayMode={fusionDisplayMode}
                  fusionLayoutPreset={fusionLayoutPreset}
                  onSecondarySeriesSelect={setSecondarySeriesId}
                  onFusionOpacityChange={setFusionOpacity}
                  hasSecondarySeriesForFusion={fusionDescriptorMap.size > 0}
                  onImageMetadataChange={setImageMetadata}
                  allStructuresVisible={allStructuresVisible}
                  imageCache={imageCache}
                  onMPRToggle={() => setMprVisible(!mprVisible)}
                  isMPRVisible={mprVisible}
                  // Mirror associations from Series panel: restrict Fusion choices
                  allowedSecondaryIds={Array.from(fusionDescriptorMap.keys())}
                  registrationAssociations={registrationRelationshipMap}
                  availableSeries={series}
                  fusionWindowLevel={fusionWindowLevel}
                  fusionSecondaryStatuses={fusionSecondaryStatuses}
                  fusionManifestLoading={fusionManifestLoading}
                  fusionManifestPrimarySeriesId={fusionManifest?.primarySeriesId ?? null}
                  onActivePredictionsChange={setActivePredictions}
                  hideSidebar
                  // Always hide internal toolbar - UnifiedFusionTopbar is now the main topbar
                  hideToolbar
                  // RT Dose props
                  doseSeriesId={selectedDoseSeriesId}
                  doseOpacity={doseOpacity}
                  doseVisible={doseVisible}
                  doseColormap={doseColormap}
                  showIsodose={showIsodose}
                  prescriptionDose={prescriptionDose}
                  // RT Plan / Beam overlay props
                  showBeamOverlay={showBeamOverlay}
                  selectedBeamNumber={selectedBeamNumber}
                  beamOverlayOpacity={beamOverlayOpacity}
                  beams={loadedBeams}
                  bevProjections={loadedBEVProjections}
                />
              )}
              </ContourEditProvider>
              
              {/* Structure Tags on Right Side - Responsive */}
              {selectedStructures.size > 0 && rtStructures?.structures && (
                <div className="absolute right-2 sm:right-4 top-2 sm:top-4 space-y-2 z-10 max-h-[calc(100vh-12rem)] overflow-y-auto">
                  <div className="space-y-2 max-w-[200px] sm:max-w-[250px]">
                    {Array.from(selectedStructures).map(structureId => {
                      const structure = rtStructures.structures.find((s: any) => s.roiNumber === structureId);
                      if (!structure) return null;
                      
                      return (
                        <div 
                          key={structureId}
                          className="flex items-center space-x-2 bg-black/80 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border"
                          style={{ borderColor: `rgb(${structure.color.join(',')})` }}
                        >
                          <div 
                            className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full border border-gray-400 flex-shrink-0"
                            style={{ backgroundColor: `rgb(${structure.color.join(',')})` }}
                          />
                          <span className="text-xs sm:text-sm text-white font-medium truncate">
                            {structure.structureName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-950 via-black to-gray-950 rounded-lg border border-white/5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center border border-indigo-500/20">
                  <LayoutGrid className="w-7 h-7 text-indigo-400/50" />
                </div>
                <p className="text-sm font-medium text-gray-400">Select a series to view</p>
                <p className="text-xs text-gray-600">Choose from the sidebar on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Floating Toolbar - Outside animate-in container so fixed positioning works correctly */}
      {selectedSeries && (
        <BottomToolbarPrototypeV2
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToWindow={handleResetZoom}
          onPan={handlePanTool}
          onMeasure={handleMeasureTool}
          onCrosshairs={handleCrosshairsTool}
          onContourEdit={() => {
            // Close boolean operations toolbar when opening contour edit
            setShowBooleanOperations(false);
            // Close margin toolbar when opening contour edit
            setShowMarginToolbar(false);
            
            // If no structure is selected, select the first one or last loaded
            if (!selectedForEdit && rtStructures?.structures && rtStructures.structures.length > 0) {
              // Try to get the last loaded structure or default to first
              const lastStructure = rtStructures.structures[rtStructures.structures.length - 1];
              setSelectedForEdit(lastStructure.roiNumber);
            }
            
            setIsContourEditMode(true);
          }}
          onContourOperations={() => {
            // Close contour edit toolbar when opening boolean operations
            setIsContourEditMode(false);
            // Close margin toolbar when opening boolean operations
            setShowMarginToolbar(false);
            setShowBooleanOperations(true);
          }}
          onAdvancedMarginTool={() => {
            // Close contour edit toolbar when opening margin toolbar
            setIsContourEditMode(false);
            // Close boolean operations toolbar when opening margin toolbar
            setShowBooleanOperations(false);
            setShowMarginToolbar(true);
          }}
          onMPRToggle={() => setMprVisible(!mprVisible)}
          isMPRActive={mprVisible}
          onFusionToggle={() => setShowFusionPanel(!showFusionPanel)}
          isFusionActive={showFusionPanel}
          isPanActive={activeToolMode === 'pan'}
          isCrosshairsActive={activeToolMode === 'crosshairs'}
          isMeasureActive={activeToolMode === 'measure'}
          isContourEditActive={isContourEditMode}
          isContourOperationsActive={showBooleanOperations}
          isAdvancedMarginToolActive={showMarginToolbar}
          onLocalization={handleLocalizationToggle}
          isLocalizationActive={showLocalizationTool}
          className="toolbar-custom"
          onUndo={handleGlobalUndo}
          onRedo={handleGlobalRedo}
          canUndo={undoRedoManager.canUndo()}
          canRedo={undoRedoManager.canRedo()}
          historyItems={undoRedoManager.getHistory().map(h => ({ timestamp: h.timestamp, action: h.action, structureId: h.structureId }))}
          currentHistoryIndex={undoRedoManager.getCurrentIndex()}
          onSelectHistory={handleJumpToHistory}
          // Context props for adaptive toolbar
          hasSecondaries={fusionDescriptorMap.size > 0}
          hasRTStructures={!!(rtStructures?.structures && rtStructures.structures.length > 0)}
          viewMode={
            (fusionLayoutPreset !== 'overlay' && secondarySeriesId) 
              ? 'fusion-layout' 
              : 'standard'
          }
          onExitFusionLayout={handleExitToOverlay}
          // Offset to center toolbar relative to viewer (sidebar is md:w-96 = 384px)
          viewerOffsetLeft={384}
          // FuseBox props - show when fusion secondary is active
          hasFusionActive={secondarySeriesId !== null}
          onFuseBoxOpen={() => {
            // Store fusion data in sessionStorage for the new window
            const selectedSecondary = fusionManifest?.secondaries.find(s => s.secondarySeriesId === secondarySeriesId);
            const fuseboxData = {
              primarySeriesId: selectedSeries?.id ?? 0,
              primaryModality: selectedSeries?.modality || 'CT',
              primaryDescription: selectedSeries?.seriesDescription || 'Primary Series',
              primarySliceCount: imageMetadata?.totalSlices ?? 287,
              secondarySeriesId: secondarySeriesId,
              secondaryModality: selectedSecondary?.secondaryModality || 'MR',
              secondaryDescription: selectedSecondary?.secondarySeriesDescription || 'Secondary Series',
              secondarySliceCount: selectedSecondary?.sliceCount ?? 192,
              currentOpacity: fusionOpacity,
              studyId: selectedSeries?.studyId ?? studyData?.studies?.[0]?.id, // Pass study ID for DICOM loading
              registrationId: null, // TODO: Pass selected registration ID
            };
            sessionStorage.setItem('fusebox-data', JSON.stringify(fuseboxData));
            
            // Open FuseBox in a new window
            const windowFeatures = 'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no';
            window.open('/fusebox', 'FuseBox', windowFeatures);
          }}
        />
      )}

      {/* Contour Edit Toolbar and Fusion Control are handled inside WorkingViewer */}

      {/* Contour Edit Toolbar - V4 Aurora Edition */}
      {isContourEditMode && rtStructures && rtStructures.structures && rtStructures.structures.length > 0 && !showBooleanOperations && !showMarginToolbar && (
        <ContourEditToolbar
          selectedStructure={selectedForEdit ? rtStructures.structures.find((s: any) => s.roiNumber === selectedForEdit) : rtStructures.structures[0]}
          isVisible={isContourEditMode}
          onClose={() => {
            setIsContourEditMode(false);
            setSelectedForEdit(null);
          }}
          onStructureNameChange={(name: string) => {
            // Update structure name locally so UI reflects immediately
            if (!rtStructures || !selectedForEdit) return;
            setRTStructures((prev: any) => {
              if (!prev?.structures) return prev;
              const updated = structuredClone ? structuredClone(prev) : JSON.parse(JSON.stringify(prev));
              const s = updated.structures.find((x: any) => x.roiNumber === selectedForEdit);
              if (s) s.structureName = name;
              return updated;
            });
          }}
          onStructureColorChange={(color: string) => {
            // Update structure color locally so UI reflects immediately
            if (!rtStructures || !selectedForEdit) return;
            const hex = color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const rgb: [number, number, number] = [
              Number.isFinite(r) ? r : 255,
              Number.isFinite(g) ? g : 255,
              Number.isFinite(b) ? b : 255,
            ];
            setRTStructures((prev: any) => {
              if (!prev?.structures) return prev;
              const updated = structuredClone ? structuredClone(prev) : JSON.parse(JSON.stringify(prev));
              const s = updated.structures.find((x: any) => x.roiNumber === selectedForEdit);
              if (s) s.color = rgb;
              return updated;
            });
            // Also refresh the selected border colors if this structure is selected
            setSelectedStructureColors((prevColors: string[]) => {
              if (!selectedStructures.has(selectedForEdit)) return prevColors;
              const next = Array.from(selectedStructures).map(id => {
                const st = (rtStructures?.structures || []).find((x: any) => x.roiNumber === id);
                const use = id === selectedForEdit ? rgb : st?.color;
                return use ? `rgb(${use.join(',')})` : '';
              }).filter(Boolean);
              return next;
            });
          }}
          onToolChange={(toolState) => {
            // Use functional update to avoid stale closure issues
            setBrushToolState((prev) => ({
              ...prev,
              ...toolState,
              predictionEnabled: toolState.predictionEnabled ?? prev.predictionEnabled
            }));
          }}
          currentSlicePosition={currentSlicePosition}
          onContourUpdate={handleContourUpdate}
          availableStructures={rtStructures.structures}
          onTargetStructureSelect={(structureId) => {
            // Handle target structure selection for boolean operations
            console.log('Target structure selected:', structureId);
          }}
          seriesId={selectedSeries?.id}
          imageMetadata={imageMetadata}
          onOpenBooleanOperations={() => {
            setIsContourEditMode(false);
            setShowMarginToolbar(false);
            setShowBooleanOperations(true);
          }}
          onOpenAdvancedMarginTool={() => {
            setIsContourEditMode(false);
            setShowBooleanOperations(false);
            setShowMarginToolbar(true);
          }}
          activePredictions={activePredictions}
          workingViewerRef={workingViewerRef}
        />
      )}

      {/* Boolean Operations Toolbar (integrated panel mode toggle inside) */}
      {showBooleanOperations && !showMarginToolbar && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50" style={{ animationName: 'fadeInScale', animationDuration: '300ms', animationTimingFunction: 'ease-out', animationFillMode: 'both', width: '1200px', minWidth: '1200px', maxWidth: '1200px' }}>
          <BooleanPipelinePrototypeCombined
            availableStructures={rtStructures?.structures?.map((s: any) => s.structureName) || []}
            onClose={() => {
              setShowBooleanOperations(false);
              setPreviewStructureInfo(null);
              // Clear preview contours when closing
              if (workingViewerRef.current) {
                workingViewerRef.current.handleContourUpdate({ action: 'clear_preview' });
              }
            }}
            onExecute={async (steps: any[], outputConfig: any) => {
              try {
                if (!rtStructures?.structures) {
                  console.warn('No RT structures loaded');
                  return;
                }

                // Build a map of structure names to structures
                const structuresByName: Record<string, any> = {};
                for (const s of rtStructures.structures) {
                  structuresByName[s.structureName.toLowerCase()] = s;
                }

                // Process steps sequentially - each step uses the result of previous steps
                const stepResults: Record<string, Map<number, number[][]>> = {}; // step result name -> slice map
                const SLICE_TOL = 1.0;

                const { combineContours, subtractContours, intersectContours, xorContours } = await import('@/lib/clipper-boolean-operations');
                
                const mapFromStructure = (struct: any): Map<number, number[][]> => {
                  const m = new Map<number, number[][]>();
                  for (const c of struct?.contours || []) {
                    if (!c?.points || c.points.length < 9 || typeof c.slicePosition !== 'number') continue;
                    let key: number | null = null;
                    for (const k of Array.from(m.keys())) {
                      if (Math.abs(k - c.slicePosition) <= SLICE_TOL) {
                        key = k;
                        break;
                      }
                    }
                    const useKey = key !== null ? key : c.slicePosition;
                    const arr = m.get(useKey) || [];
                    arr.push(c.points);
                    m.set(useKey, arr);
                  }
                  return m;
                };

                const unionReduce = async (contours: number[][]): Promise<number[][]> => {
                  if (contours.length <= 1) return contours;
                  let acc: number[][] = [contours[0]];
                  for (let i = 1; i < contours.length; i++) {
                    const next = contours[i];
                    const newAcc: number[][] = [];
                    for (const a of acc) {
                      newAcc.push(...await combineContours(a, next));
                    }
                    acc = newAcc.length ? newAcc : acc;
                  }
                  return acc;
                };

                const applyBinary = async (op: string, A: Map<number, number[][]>, B: Map<number, number[][]>): Promise<Map<number, number[][]>> => {
                  const result = new Map<number, number[][]>();
                  const keys: number[] = [];
                  const pushTol = (v: number) => {
                    for (const k of keys) {
                      if (Math.abs(k - v) <= SLICE_TOL) return;
                    }
                    keys.push(v);
                  };
                  Array.from(A.keys()).forEach(pushTol);
                  Array.from(B.keys()).forEach(pushTol);
                  keys.sort((a, b) => a - b);

                  for (const k of keys) {
                    const getNear = (m: Map<number, number[][]>): number[][] => {
                      const out: number[][] = [];
                      for (const mk of Array.from(m.keys())) {
                        if (Math.abs(mk - k) <= SLICE_TOL) {
                          out.push(...(m.get(mk) || []));
                        }
                      }
                      return out;
                    };
                    const aList = await unionReduce(getNear(A));
                    const bList = await unionReduce(getNear(B));
                    
                    if ((aList?.length || 0) === 0 && (bList?.length || 0) === 0) continue;

                    let acc: number[][] = [];
                    if (!aList || aList.length === 0) {
                      if (op === 'union' || op === 'xor') acc = bList;
                    } else if (!bList || bList.length === 0) {
                      if (op === 'union' || op === 'xor' || op === 'subtract') acc = aList;
                    } else {
                      if (op === 'union') {
                        const combined: number[][] = [];
                        for (const a of aList) {
                          for (const b of bList) {
                            combined.push(...await combineContours(a, b));
                          }
                        }
                        acc = await unionReduce(combined);
                      } else if (op === 'intersect') {
                        const inters: number[][] = [];
                        for (const a of aList) {
                          for (const b of bList) {
                            inters.push(...await intersectContours(a, b));
                          }
                        }
                        acc = await unionReduce(inters);
                      } else if (op === 'subtract') {
                        let cur: number[][] = aList;
                        for (const b of bList) {
                          const next: number[][] = [];
                          for (const a of cur) {
                            next.push(...await subtractContours(a, b));
                          }
                          cur = next;
                        }
                        acc = await unionReduce(cur);
                      } else if (op === 'xor') {
                        const xored: number[][] = [];
                        for (const a of aList) {
                          for (const b of bList) {
                            xored.push(...await xorContours(a, b));
                          }
                        }
                        acc = await unionReduce(xored);
                      }
                    }

                    if (acc && acc.length > 0) {
                      result.set(k, acc);
                    }
                  }
                  return result;
                };

                // Process each step
                for (const step of steps) {
                  // Handle both panel mode (has inputA/inputB) and expression mode (has expression)
                  if (step.expression) {
                    // Expression mode - parse the expression
                    // For now, skip expression mode and rely on panel mode conversion
                    // TODO: Implement expression parsing if needed
                    console.warn('Expression mode not yet fully supported in integration');
                    continue;
                  }

                  let inputA: Map<number, number[][]>;
                  let inputB: Map<number, number[][]>;
                  
                  // Get input A - could be a structure name or a previous step result
                  if (step.inputA && stepResults[step.inputA]) {
                    inputA = stepResults[step.inputA];
                  } else if (step.inputA) {
                    const structA = structuresByName[step.inputA.toLowerCase()];
                    if (!structA) {
                      console.error(`Structure ${step.inputA} not found`);
                      continue;
                    }
                    inputA = mapFromStructure(structA);
                  } else {
                    continue;
                  }

                  // Get input B - could be a structure name or a previous step result
                  if (step.inputB && stepResults[step.inputB]) {
                    inputB = stepResults[step.inputB];
                  } else if (step.inputB) {
                    const structB = structuresByName[step.inputB.toLowerCase()];
                    if (!structB) {
                      console.error(`Structure ${step.inputB} not found`);
                      continue;
                    }
                    inputB = mapFromStructure(structB);
                  } else {
                    continue;
                  }

                  // Apply the operation
                  const opMap: Record<string, string> = {
                    'union': 'union',
                    'intersect': 'intersect',
                    'subtract': 'subtract',
                    'xor': 'xor'
                  };
                  const op = opMap[step.operation] || 'union';
                  const result = await applyBinary(op, inputA, inputB);
                  stepResults[step.result] = result;
                }

                // Get the final result (last step's result)
                const finalStep = steps[steps.length - 1];
                const finalResult = stepResults[finalStep.result];
                if (!finalResult) {
                  console.error('No final result computed');
                  return;
                }

                // Convert final result to contours array
                const contours: any[] = [];
                for (const [slicePosition, contourList] of finalResult.entries()) {
                  for (const points of contourList) {
                    if (points && points.length >= 9) {
                      contours.push({
                        slicePosition,
                        points,
                        numberOfPoints: points.length / 3
                      });
                    }
                  }
                }
                contours.sort((a, b) => a.slicePosition - b.slicePosition);

                // Parse output color
                const hex = (outputConfig.color || '#FF6B6B').replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16) || 255;
                const g = parseInt(hex.substring(2, 4), 16) || 107;
                const b = parseInt(hex.substring(4, 6), 16) || 107;
                const targetColor: [number, number, number] = [r, g, b];

                // Update or create target structure
                const updated = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
                let targetStruct = updated.structures.find((s: any) => s.structureName?.toLowerCase() === outputConfig.name.toLowerCase());
                
                if (!targetStruct) {
                  const maxRoi = Math.max(0, ...updated.structures.map((s: any) => s.roiNumber || 0));
                  targetStruct = {
                    roiNumber: maxRoi + 1,
                    structureName: outputConfig.name,
                    color: targetColor,
                    contours: []
                  };
                  updated.structures.push(targetStruct);
                } else {
                  targetStruct.color = targetColor;
                }

                targetStruct.contours = contours;
                setStructureVisibility(prev => {
                  const next = new Map(prev);
                  next.set(targetStruct.roiNumber, true);
                  return next;
                });
                setRTStructures(updated);
                handleContourUpdate(updated);

                // Create superstructure if auto-update enabled
                if (outputConfig.saveAsSuperstructure) {
                  const sourceStructureNames = steps.map(s => s.inputA).filter((name, idx, arr) => arr.indexOf(name) === idx);
                  const sourceStructureIds = sourceStructureNames
                    .map(name => {
                      const struct = structuresByName[name.toLowerCase()];
                      return struct?.roiNumber;
                    })
                    .filter(id => id !== undefined);

                  const rtStructureSetId = loadedRTSeriesId || rtStructures?.seriesId;
                  if (rtStructureSetId && sourceStructureIds.length > 0) {
                    try {
                      const operationExpression = steps.map(s => `${s.inputA} ${s.operation === 'union' ? '∪' : s.operation === 'intersect' ? '∩' : s.operation === 'xor' ? '⊕' : '−'} ${s.inputB}`).join(' → ');
                      const createSuperstructurePayload = {
                        rtStructureRoiNumber: targetStruct.roiNumber,
                        rtSeriesId: rtStructureSetId,
                        sourceStructureRoiNumbers: sourceStructureIds,
                        sourceStructureNames: sourceStructureNames,
                        operationExpression,
                        operationType: steps.length === 1 ? steps[0].operation : 'complex',
                        autoUpdate: true
                      };

                      const response = await fetch('/api/superstructures', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(createSuperstructurePayload)
                      });

                      if (response.ok) {
                        window.dispatchEvent(new CustomEvent('superstructures:reload', {
                          detail: { rtSeriesId: rtStructureSetId }
                        }));
                        toast({
                          title: '✅ Superstructure created!',
                          description: `${outputConfig.name} will auto-update when inputs change`
                        });
                      }
                    } catch (err) {
                      console.error('Error creating superstructure:', err);
                    }
                  }
                }

                setShowBooleanOperations(false);
                setPreviewStructureInfo(null);
                if (workingViewerRef.current) {
                  workingViewerRef.current.setPreviewContours?.([]);
                }
              } catch (err) {
                console.error('Boolean pipeline execution failed:', err);
                toast({
                  title: 'Error executing boolean pipeline',
                  description: String(err),
                  variant: 'destructive'
                });
              }
            }}
          />
        </div>
      )}
      
      {/* Legacy Boolean Operations Toolbar - Removed (was dead code) */}
      {false && showBooleanOperations && !showMarginToolbar && (
        null as any /* BooleanOperationsToolbar removed */
        /* Original props were:
          isVisible={showBooleanOperations}
          onClose={() => {
            setShowBooleanOperations(false);
            setPreviewStructureInfo(null);
            // Clear preview contours when closing
            if (workingViewerRef.current) {
              workingViewerRef.current.handleContourUpdate({ action: 'clear_preview' });
            }
          }}
          availableStructures={rtStructures?.structures?.map((s: any) => s.structureName) || []}
            structures={rtStructures?.structures}
            grid={{
              xSize: imageMetadata?.columns || 512,
              ySize: imageMetadata?.rows || 512,
              zSize: Math.max(1, Math.round((selectedSeries?.images?.length || 1))),
              xRes: imageMetadata?.pixelSpacing?.[0] || 1,
              yRes: imageMetadata?.pixelSpacing?.[1] || 1,
              zRes: imageMetadata?.sliceThickness || 1,
              origin: { x: 0, y: 0, z: 0 }
            } as any}
            structureColors={(rtStructures?.structures || []).reduce((acc: Record<string, string>, s: any) => {
              if (s?.structureName && Array.isArray(s?.color)) {
                acc[s.structureName] = `rgb(${s.color.join(',')})`;
              }
              return acc;
            }, {})}
            onPreview={(target, contours) => {
              // Handle preview by updating working viewer with preview contours
              if (workingViewerRef.current && contours.length > 0) {
                // Show preview contours in yellow
                const previewContoursForViewer = contours.map((c: any) => ({
                  slicePosition: c.slicePosition,
                  points: c.points,
                  numberOfPoints: c.numberOfPoints,
                  color: [255, 223, 0] // Yellow for preview
                }));
                workingViewerRef.current.setPreviewContours?.(previewContoursForViewer);
              } else if (workingViewerRef.current) {
                // Clear preview if no contours
                workingViewerRef.current.setPreviewContours?.([]);
              }
            }}
            onPreviewStateChange={(previewInfo) => {
              setPreviewStructureInfo(previewInfo.targetName ? previewInfo : null);
              if (!previewInfo.targetName && workingViewerRef.current) {
                // Clear preview when state is cleared
                workingViewerRef.current.setPreviewContours?.([]);
              }
            }}
            onApply={async (target, contours, metadata) => {
              console.log('🔵 onApply called with:', { target, contoursCount: contours?.length, metadata });
              
              if (!rtStructures?.structures) return;
              const updated = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
              let targetStruct = updated.structures.find((s: any) => s.structureName?.toLowerCase() === (target.name || '').toLowerCase());
              const isNewStructure = !targetStruct;
              
              if (!targetStruct) {
                const maxRoi = Math.max(0, ...updated.structures.map((s: any) => s.roiNumber || 0));
                targetStruct = {
                  roiNumber: maxRoi + 1,
                  structureName: target.name,
                  color: target.color || [0, 255, 0],
                  contours: []
                };
                updated.structures.push(targetStruct);
              } else if (target.color) {
                targetStruct.color = target.color;
              }
              // Clear and replace contours to reflect new boolean result
              targetStruct.contours = Array.isArray(contours) ? contours : [];
              // Ensure visibility on
              setStructureVisibility(prev => {
                const next = new Map(prev);
                next.set(targetStruct.roiNumber, true);
                return next;
              });
              setRTStructures(updated);
              handleContourUpdate(updated);
              
              // Create superstructure if metadata provided and auto-update enabled
              // Get RT series ID from the rtStructures object or loadedRTSeriesId state
              // CRITICAL: If both are null, we add it to the rtStructures object by inspecting what's loaded
              let rtStructureSetId = loadedRTSeriesId || rtStructures?.seriesId;
              
              // If still null, this is a fatal issue - log everything for debugging
              if (!rtStructureSetId) {
                console.error('🚨 CRITICAL: Cannot determine RT structure set ID!', {
                  loadedRTSeriesId,
                  rtStructuresSeriesId: rtStructures?.seriesId,
                  rtStructuresKeys: rtStructures ? Object.keys(rtStructures) : [],
                  rtStructuresSample: rtStructures ? {
                    hasStructures: !!rtStructures.structures,
                    structureCount: rtStructures.structures?.length,
                    firstStructure: rtStructures.structures?.[0]
                  } : null
                });
              }
              
              console.log('🔍 Superstructure creation check:', {
                saveAsSuperstructure: metadata?.saveAsSuperstructure,
                loadedRTSeriesId,
                rtStructuresSeriesId: rtStructures?.seriesId,
                finalRtStructureSetId: rtStructureSetId,
                willCreate: !!(metadata?.saveAsSuperstructure && metadata.sourceStructureNames && rtStructureSetId)
              });
              
              if (metadata?.saveAsSuperstructure && metadata.sourceStructureNames && rtStructureSetId) {
                try {
                  const sourceStructureIds = metadata.sourceStructureNames
                    .map(name => updated.structures.find((s: any) => s.structureName === name)?.roiNumber)
                    .filter(id => id !== undefined);
                  
                  const operationExpression = `${metadata.sourceStructureNames[0]} ${
                    metadata.operationType === 'union' ? '∪' : 
                    metadata.operationType === 'intersect' ? '∩' : 
                    metadata.operationType === 'xor' ? '⊕' :
                    '−'
                  } ${metadata.sourceStructureNames[1]}`;
                  
                  const createSuperstructurePayload = {
                    rtStructureRoiNumber: targetStruct.roiNumber,
                    rtSeriesId: rtStructureSetId, // This is actually the series ID
                    sourceStructureRoiNumbers: sourceStructureIds,
                    sourceStructureNames: metadata.sourceStructureNames,
                    operationExpression,
                    operationType: metadata.operationType,
                    autoUpdate: true
                  };
                  
                  console.log('🏗️ Creating superstructure from panel mode:', createSuperstructurePayload);
                  
                  toast({
                    title: '🏗️ Creating superstructure...',
                    description: `${operationExpression} → ${target.name}`
                  });
                  
                  const response = await fetch('/api/superstructures', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createSuperstructurePayload)
                  });
                  
                  if (response.ok) {
                    const superstructure = await response.json();
                    console.log('✅ Superstructure created:', superstructure);
                    
                    toast({
                      title: '✅ Superstructure created!',
                      description: `${target.name} will auto-update when inputs change`
                    });
                    
                    // Trigger SeriesSelector to reload superstructures
                    window.dispatchEvent(new CustomEvent('superstructures:reload', {
                      detail: { rtSeriesId: rtStructureSetId }
                    }));
                  } else {
                    const errorText = await response.text();
                    console.warn('Failed to create superstructure:', errorText);
                    toast({
                      title: 'Failed to create superstructure',
                      description: errorText,
                      variant: 'destructive'
                    });
                  }
                } catch (err) {
                  console.error('Error creating superstructure:', err);
                  toast({
                    title: 'Error creating superstructure',
                    description: String(err),
                    variant: 'destructive'
                  });
                }
              } else {
                // Show why superstructure wasn't created
                if (!metadata?.saveAsSuperstructure) {
                  console.log('ℹ️ Superstructure creation skipped - Auto-Update is OFF');
                } else if (!rtStructureSetId) {
                  console.warn('⚠️ Cannot create superstructure - RT structure set ID not found');
                  toast({
                    title: 'Cannot create superstructure',
                    description: 'RT structure set ID not found. Try reloading the RT structures.',
                    variant: 'destructive'
                  });
                }
              }
              
              setShowBooleanOperations(false);
              setPreviewStructureInfo(null);
              // Clear preview contours after applying
              if (workingViewerRef.current) {
                workingViewerRef.current.setPreviewContours?.([]);
              }
            }}
            onExecuteOperation={async (expression, newStructure, saveAsSuperstructure = true) => {
              try {
                if (!rtStructures?.structures) {
                  console.warn('No RT structures loaded');
                  return;
                }
              
              const structuresByName: Record<string, any> = {};
              for (const s of rtStructures.structures) {
                structuresByName[s.structureName.toLowerCase()] = s;
              }

              // Tokenize expression
              const raw = expression.trim();
              const tokens: string[] = (raw.match(/[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=]/g) || []) as string[];
              let outputName: string | null = null;
              let rhsTokens = tokens;
              const eqIndex = tokens.indexOf('=');
              if (eqIndex > -1) {
                // Preserve original LHS label including spaces
                const rawEqIndex = raw.indexOf('=');
                const lhsLabel = raw.slice(0, rawEqIndex).trim();
                outputName = lhsLabel || null;
                rhsTokens = tokens.slice(eqIndex + 1);
              }

              // Shunting-yard to RPN
              const precedence: Record<string, number> = { '∪': 1, '∩': 1, '⊕': 1, '-': 1 };
              const isOp = (t: string) => Object.prototype.hasOwnProperty.call(precedence, t);
              const output: string[] = [];
              const ops: string[] = [];
              for (const t of rhsTokens) {
                if (/^[A-Za-z][A-Za-z0-9_#-]*$/.test(t)) {
                  output.push(t);
                } else if (isOp(t)) {
                  while (ops.length && isOp(ops[ops.length - 1]) && precedence[ops[ops.length - 1]] >= precedence[t]) {
                    output.push(ops.pop() as string);
                  }
                  ops.push(t);
                } else if (t === '(') {
                  ops.push(t);
                } else if (t === ')') {
                  while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop() as string);
                  ops.pop();
                }
              }
              while (ops.length) output.push(ops.pop() as string);

              // Helpers to get slice maps for a structure name
              const SLICE_TOL = 1.0; // mm tolerance for aligning slice positions
              type SliceMap = Map<number, number[][]>; // slice -> list of contours

              const getSliceMapForStructure = (name: string): SliceMap => {
                const s = structuresByName[name.toLowerCase()];
                const map: SliceMap = new Map();
                if (!s?.contours) return map;
                for (const c of s.contours) {
                  if (!c?.points || c.points.length < 9 || typeof c.slicePosition !== 'number') continue;
                  // Find an existing bucket within tolerance, otherwise create a new one
                  let bucketKey: number | null = null;
                  for (const existingKey of Array.from(map.keys())) {
                    if (Math.abs(existingKey - c.slicePosition) <= SLICE_TOL) {
                      bucketKey = existingKey;
                      break;
                    }
                  }
                  const key = bucketKey !== null ? bucketKey : c.slicePosition;
                  const arr = map.get(key) || [];
                  arr.push(c.points);
                  map.set(key, arr);
                }
                return map;
              };

              // Merge multiple contours into one set by union folding
              const { combineContours, subtractContours, intersectContours, xorContours } = await import('@/lib/clipper-boolean-operations');
              const unionReduce = async (contours: number[][]): Promise<number[][]> => {
                if (contours.length <= 1) return contours;
                let acc: number[][] = [contours[0]];
                for (let i = 1; i < contours.length; i++) {
                  const next = contours[i];
                  const newAcc: number[][] = [];
                  for (const a of acc) {
                    const res = await combineContours(a, next);
                    newAcc.push(...res);
                  }
                  acc = newAcc.length ? newAcc : acc;
                }
                return acc;
              };

              const applyBinary = async (op: string, A: SliceMap, B: SliceMap): Promise<SliceMap> => {
                const result: SliceMap = new Map();
                // Build union of slice keys and apply tolerance grouping across A and B
                const combinedKeys: number[] = [];
                const pushWithTolerance = (val: number) => {
                  for (let i = 0; i < combinedKeys.length; i++) {
                    if (Math.abs(combinedKeys[i] - val) <= SLICE_TOL) {
                      return; // already represented
                    }
                  }
                  combinedKeys.push(val);
                };
                Array.from(A.keys()).forEach(pushWithTolerance);
                Array.from(B.keys()).forEach(pushWithTolerance);
                combinedKeys.sort((a, b) => a - b);
                const getNearContours = (m: SliceMap, key: number): number[][] => {
                  const aggregated: number[][] = [];
                  for (const mk of Array.from(m.keys())) {
                    if (Math.abs(mk - key) <= SLICE_TOL) {
                      const arr = m.get(mk) || [];
                      aggregated.push(...arr);
                    }
                  }
                  return aggregated;
                };
                for (const k of combinedKeys) {
                  const aContours = await unionReduce(getNearContours(A, k));
                  const bContours = await unionReduce(getNearContours(B, k));
                  if ((aContours?.length || 0) === 0 && (bContours?.length || 0) === 0) continue;
                  // If side empty, handle identity
                  if (!aContours || aContours.length === 0) {
                    if (op === '∪' || op === '⊕') { if (bContours.length) result.set(k, bContours); }
                    // intersect/subtract with empty yields empty
                    continue;
                  }
                  if (!bContours || bContours.length === 0) {
                    if (op === '∪' || op === '⊕' || op === '-') { if (aContours.length) result.set(k, aContours); }
                    // intersect with empty is empty
                    continue;
                  }
                  // Reduce to single representative by folding pairwise
                  let mergedA = aContours;
                  let mergedB = bContours;
                  // Execute op for each pair; start with first pair and fold
                  let acc: number[][] = [];
                  const opFunc = op === '∪' ? combineContours : op === '∩' ? intersectContours : op === '⊕' ? xorContours : subtractContours;
                  // Simplify by union-reduce each side to one or few, then run op across all combinations
                  const left = await unionReduce(mergedA);
                  const right = await unionReduce(mergedB);
                  for (const la of left) {
                    for (const rb of right) {
                      const res = await opFunc(la, rb);
                      acc.push(...res);
                    }
                  }
                  // Union-reduce result to clean overlaps
                  const cleaned = await unionReduce(acc);
                  if (cleaned && cleaned.length) result.set(k, cleaned);
                }
                return result;
              };

              // Evaluate RPN
              const stack: SliceMap[] = [];
              for (const t of output) {
                if (/^[A-Za-z][A-Za-z0-9_#-]*$/.test(t)) {
                  stack.push(getSliceMapForStructure(t));
                } else if (['∪','∩','⊕','-'].includes(t)) {
                  const b = stack.pop();
                  const a = stack.pop();
                  if (!a || !b) throw new Error('Malformed expression');
                  const r = await applyBinary(t, a, b);
                  stack.push(r);
                }
              }
              if (stack.length !== 1) throw new Error('Malformed expression');
              const finalMap = stack[0];

              // Build contours array for structure from finalMap via VIP rectangles
              // Convert finalMap -> VIP structure then back to contours (rects)
              const gridGuess = {
                xSize: imageMetadata?.columns || 512,
                ySize: imageMetadata?.rows || 512,
                zSize: Math.max(1, Math.round((selectedSeries?.images?.length || 1))),
                xRes: imageMetadata?.pixelSpacing?.[0] || 1,
                yRes: imageMetadata?.pixelSpacing?.[1] || 1,
                zRes: imageMetadata?.sliceThickness || 1,
                origin: { x: 0, y: 0, z: 0 }
              } as any;
              const vips = Array.from(finalMap.entries()).reduce((acc: any[][][], [z, contourList]) => {
                const rows: any[][] = acc[z] || (acc[z] = []);
                // Raster per-row by slicing points' y; for now, approximate whole rows per contour as a rectangle span
                // Convert raw contour points to mask then VIP rows
                // Quick path: assume contours already in grid, build runs per y
                const mask2D = new Uint8Array(gridGuess.xSize * gridGuess.ySize);
                for (const pts of contourList) {
                  // Fill rectangle span across rows based on y from points
                  for (let i = 1; i < pts.length; i += 3) {
                    // not used; keeping interface consistent
                  }
                }
                return acc;
              }, [] as any[][][]);
              // Fall back: simple conversion using rectangles for each raw contour
              const rectContours = Array.from(finalMap.entries()).map(([slicePosition, contours]) => {
                return contours.map(points => ({ slicePosition: slicePosition as number, points, numberOfPoints: points.length / 3 }));
              }).flat();
              rectContours.sort((a, b) => (a.slicePosition as number) - (b.slicePosition as number));
              const newContours = rectContours;

              // Determine output target
              let targetName = outputName;
              let targetColor: [number, number, number] | null = null;
            if (newStructure?.createNewStructure) {
                targetName = newStructure.name || outputName || 'Combined';
                // parse hex color to rgb
                const hex = (newStructure.color || '#3B82F6').replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16) || 59;
                const g = parseInt(hex.substring(2, 4), 16) || 130;
                const b = parseInt(hex.substring(4, 6), 16) || 246;
                targetColor = [r, g, b];
              }

              const updated = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
              let targetStruct = targetName ? updated.structures.find((s: any) => s.structureName.toLowerCase() === targetName!.toLowerCase()) : null;
              if (!targetStruct) {
                // Create new if requested or if assignment provided without existing
                const maxRoi = Math.max(0, ...updated.structures.map((s: any) => s.roiNumber || 0));
                targetStruct = {
                  roiNumber: maxRoi + 1,
                  structureName: targetName || 'Combined',
                  color: targetColor || [0, 255, 0],
                  contours: [] as any[]
                };
                updated.structures.push(targetStruct);
              }
              if (targetColor) {
                targetStruct.color = targetColor;
              }
              targetStruct.contours = newContours;

              // Update state and close
              setRTStructures(updated);
              // Also notify handler so any listeners update
              handleContourUpdate(updated);

              // Create superstructure metadata for tracking and auto-updates
              try {
                // Extract source structure names and IDs from expression
                const sourceNames = rhsTokens.filter(t => /^[A-Za-z][A-Za-z0-9_#-]*$/.test(t));
                const uniqueSourceNames = Array.from(new Set(sourceNames));
                const sourceStructureIds = uniqueSourceNames
                  .map(name => structuresByName[name.toLowerCase()]?.roiNumber)
                  .filter(id => id !== undefined);
                
                const sourceStructureNames = uniqueSourceNames
                  .map(name => structuresByName[name.toLowerCase()]?.structureName)
                  .filter(name => name !== undefined);

                // Determine operation type
                let operationType: 'union' | 'intersect' | 'subtract' | 'xor' | 'complex' = 'complex';
                const hasUnion = rhsTokens.includes('∪');
                const hasIntersect = rhsTokens.includes('∩');
                const hasSubtract = rhsTokens.includes('-');
                const hasXor = rhsTokens.includes('⊕');
                const opCount = [hasUnion, hasIntersect, hasSubtract, hasXor].filter(Boolean).length;
                
                if (opCount === 1) {
                  if (hasUnion) operationType = 'union';
                  else if (hasIntersect) operationType = 'intersect';
                  else if (hasSubtract) operationType = 'subtract';
                  else if (hasXor) operationType = 'xor';
                }

                // Create superstructure if we have valid source structures AND user enabled auto-update
                console.log('🔍 Checking superstructure creation conditions:', {
                  saveAsSuperstructure,
                  sourceStructureIdsLength: sourceStructureIds.length,
                  rtStructuresSeriesId: rtStructures?.seriesId,
                  targetStructRoiNumber: targetStruct?.roiNumber
                });
                
                if (saveAsSuperstructure && sourceStructureIds.length > 0 && rtStructures?.seriesId && targetStruct?.roiNumber) {
                  const createSuperstructurePayload = {
                    rtStructureId: targetStruct.roiNumber,
                    rtStructureSetId: rtStructures.seriesId, // Using seriesId as structure set ID
                    sourceStructureIds,
                    sourceStructureNames,
                    operationExpression: expression,
                    operationType,
                    autoUpdate: true
                  };

                  console.log('🏗️ Creating superstructure:', createSuperstructurePayload);

                  const response = await fetch('/api/superstructures', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createSuperstructurePayload)
                  });

                  if (response.ok) {
                    const superstructure = await response.json();
                    console.log('✅ Superstructure created:', superstructure);
                    
                    // Trigger SeriesSelector to reload superstructures via event
                    window.dispatchEvent(new CustomEvent('superstructures:reload', {
                      detail: { rtStructureSetId: rtStructures.seriesId }
                    }));
                  } else {
                    console.warn('Failed to create superstructure:', response.statusText);
                  }
                } else if (!saveAsSuperstructure) {
                  console.log('ℹ️ Superstructure creation skipped (user disabled auto-update)');
                }
              } catch (superErr) {
                console.warn('Failed to create superstructure metadata:', superErr);
                // Don't fail the whole operation if superstructure creation fails
              }

            setShowBooleanOperations(false);
              } catch (err) {
                console.error('Boolean operation failed:', err);
              }
          }}
        */ /* End of original BooleanOperationsToolbar props */
      )}


      {/* RT Radiation Therapy Panel - Combined Dose + Plan visualization */}
      {/* Show when RT data is available (dose or plan series exist) */}
      {(doseSeries.length > 0 || planSeries.length > 0) && (
        <RadiationTherapyPanel
          // Dose props
          doseSeriesOptions={doseSeries.map((d: any) => ({
            id: d.id,
            seriesDescription: d.seriesDescription || 'RT Dose',
            maxDose: doseMetadata?.maxDose,
            doseType: doseMetadata?.doseType,
          }))}
          selectedDoseSeriesId={selectedDoseSeriesId}
          onDoseSeriesSelect={setSelectedDoseSeriesId}
          doseOpacity={doseOpacity}
          onDoseOpacityChange={setDoseOpacity}
          doseColormap={doseColormap}
          onColormapChange={setDoseColormap}
          showIsodose={showIsodose}
          onShowIsodoseChange={setShowIsodose}
          isodoseLevels={[30, 50, 70, 80, 90, 95, 100, 105]}
          prescriptionDose={prescriptionDose}
          doseVisible={doseVisible}
          onDoseVisibilityChange={setDoseVisible}
          doseLoading={doseLoading}
          doseMetadata={doseMetadata}
          
          // Plan props
          planSeriesOptions={planSeries.map((p: any) => ({
            id: p.id,
            seriesDescription: p.seriesDescription || 'RT Plan',
          }))}
          selectedPlanSeriesId={selectedPlanSeriesId}
          onPlanSeriesSelect={setSelectedPlanSeriesId}
          showBeamOverlay={showBeamOverlay}
          onShowBeamOverlayChange={setShowBeamOverlay}
          selectedBeamNumber={selectedBeamNumber}
          onSelectBeam={setSelectedBeamNumber}
          beamOverlayOpacity={beamOverlayOpacity}
          onBeamOverlayOpacityChange={setBeamOverlayOpacity}
          onBeamsLoaded={(beams, bevs) => {
            setLoadedBeams(beams);
            setLoadedBEVProjections(bevs);
            console.log(`⚡ Loaded ${beams.length} beams from RT Plan`);
          }}
          
          // Panel state
          minimized={dosePanelMinimized}
          onToggleMinimized={setDosePanelMinimized}
          fusionPanelVisible={secondarySeriesId !== null}
          structureSetId={loadedRTSeriesId || undefined}
          
          // Actions
          onLocalizeMaxDose={() => {
            if (doseMetadata?.maxDose) {
              toast({
                title: 'Maximum Dose',
                description: `Max dose: ${doseMetadata.maxDose.toFixed(2)} Gy`,
              });
            }
          }}
          onOpenBEDCalculator={() => {
            const params = new URLSearchParams();
            params.set('prescriptionDose', prescriptionDose.toString());
            if (doseMetadata?.maxDose) {
              params.set('maxDose', doseMetadata.maxDose.toString());
            }
            
            const width = 420;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            
            window.open(
              `/bed-calculator?${params.toString()}`,
              'BED Calculator',
              `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
            );
          }}
        />
      )}

      {/* Fusion Control Panel - Deprecated: UnifiedFusionTopbar now handles fusion controls */}
      {/* Keep this for fallback but never show since UnifiedFusionTopbar is always active */}
      {false && (
        <FusionControlPanelV2
          opacity={fusionOpacity}
          onOpacityChange={setFusionOpacity}
          secondaryOptions={fusionManifest?.secondaries || []}
          selectedSecondaryId={secondarySeriesId}
          onSecondarySeriesSelect={setSecondarySeriesId}
          secondaryStatuses={fusionSecondaryStatuses}
          manifestLoading={fusionManifestLoading}
          manifestError={fusionManifestError}
          windowLevel={fusionWindowLevel}
          onWindowLevelPreset={(preset) => setFusionWindowLevel(preset)}
          displayMode={fusionDisplayMode}
          onDisplayModeChange={setFusionDisplayMode}
          primarySeriesId={selectedSeries?.id}
          layoutPreset={fusionLayoutPreset}
          onLayoutPresetChange={handleLayoutPresetChange}
          onSwapViewports={handleSwapViewports}
          enableFlexibleLayout={enableFlexibleLayout}
          studyId={studyData?.study?.id}
          onLoadBookmark={(bookmark) => {
            log.debug(`Loading bookmark: ${bookmark.name}`, 'viewer-interface');
          }}
          isExpanded={showFusionPanel}
          onExpandedChange={setShowFusionPanel}
        />
      )}

      {/* Margin Toolbar - Aurora Edition (self-positioning, draggable) */}
      {showMarginToolbar && rtStructures && !showBooleanOperations && !isContourEditMode && (
        <MarginOperationsPrototype
          availableStructures={rtStructures.structures?.map((s: any) => s.structureName) || []}
          selectedForEdit={selectedForEdit}
          structures={rtStructures.structures}
          onClose={() => setShowMarginToolbar(false)}
          onExecute={async (operation) => {
            // Handle execute operation
            console.log('🔶 MARGIN: ========== NEW MARGIN OPERATION ==========');
            console.log('🔶 MARGIN: Viewer Interface received operation:', operation);
            console.log('🔶 MARGIN: Looking for structure named:', operation.structureName);
            console.log('🔶 MARGIN: Available structures:', rtStructures.structures?.map((s: any) => ({ 
              name: s.structureName, 
              roiNumber: s.roiNumber, 
              contourCount: s.contours?.length,
              hasContours: (s.contours?.length || 0) > 0
            })));
            const sourceStructure = rtStructures.structures?.find((s: any) => s.structureName === operation.structureName);
            const structureId = sourceStructure?.roiNumber;
            console.log('🔶 MARGIN: Source structure found?', !!sourceStructure, 'name:', sourceStructure?.structureName, 'roiNumber:', structureId, 'contourCount:', sourceStructure?.contours?.length);
            
            if (!sourceStructure) {
              console.error('🔶 MARGIN ERROR: Source structure NOT FOUND! Name:', operation.structureName);
              console.error('🔶 MARGIN ERROR: Available names:', rtStructures.structures?.map((s: any) => s.structureName));
            }
            
            if (workingViewerRef.current && structureId !== undefined && structureId !== null) {
              console.log('🔶 MARGIN: Calling handleContourUpdate');
              // Convert operation parameters to the format expected by working viewer
              const parameters = operation.type === 'uniform' 
                ? { 
                    margin: operation.parameters.margin,
                    marginType: 'UNIFORM'
                  }
                : {
                    marginType: 'ANISOTROPIC',
                    marginValues: {
                      left: operation.parameters.left,
                      right: operation.parameters.right,
                      ant: operation.parameters.anterior,
                      post: operation.parameters.posterior,
                      sup: operation.parameters.superior,
                      inf: operation.parameters.inferior
                    }
                  };
              
              // Parse output color from hex to RGB array
              const hexColor = (operation.outputColor || '#FF6B6B').replace('#', '');
              const outputColorRGB: [number, number, number] = [
                parseInt(hexColor.substring(0, 2), 16) || 255,
                parseInt(hexColor.substring(2, 4), 16) || 107,
                parseInt(hexColor.substring(4, 6), 16) || 107
              ];
              
              // Determine target: 'new' for new structure, or structureId for same structure
              const targetStructureId = operation.outputMode === 'same' ? structureId : 'new';
              
              // Build margin expression for superstructure
              const marginValue = operation.type === 'uniform' 
                ? Math.abs(operation.parameters.margin)
                : Math.max(
                    Math.abs(operation.parameters.left || 0),
                    Math.abs(operation.parameters.right || 0),
                    Math.abs(operation.parameters.anterior || 0),
                    Math.abs(operation.parameters.posterior || 0),
                    Math.abs(operation.parameters.superior || 0),
                    Math.abs(operation.parameters.inferior || 0)
                  );
              const marginExpression = operation.type === 'uniform'
                ? `${operation.structureName} ${operation.direction === 'expand' ? '+' : '-'}${marginValue}mm`
                : `${operation.structureName} ${operation.direction === 'expand' ? '+' : '-'}${marginValue}mm (anisotropic)`;
              
              // Show processing toast BEFORE starting the operation
              toast({
                title: "Processing margin operation...",
                description: `Applying ${marginValue}mm ${operation.direction || 'expansion'} to ${operation.structureName}`,
              });
              
              // Keep toolbar open so user can do multiple operations
              // setShowMarginToolbar(false);
              
              try {
                // Build superstructure info
                const willCreateSuperstructure = operation.saveAsSuperstructure && operation.outputMode === 'new';
                const superstructureInfo = willCreateSuperstructure ? {
                  rtSeriesId: loadedRTSeriesId || rtStructures?.seriesId,
                  sourceStructureName: operation.structureName,
                  sourceStructureRoiNumber: structureId,
                  operationExpression: marginExpression,
                  operationType: 'margin',
                  marginType: operation.type,
                  marginDirection: operation.direction,
                  marginParameters: parameters
                } : undefined;
                
                console.log('🔶 MARGIN: Superstructure decision:', {
                  'operation.saveAsSuperstructure': operation.saveAsSuperstructure,
                  'operation.outputMode': operation.outputMode,
                  willCreateSuperstructure,
                  superstructureInfo
                });
                
                // AWAIT the async margin operation - this is critical!
                await workingViewerRef.current.handleContourUpdate({
                  action: 'execute_margin',
                  structureId: structureId,
                  targetStructureId: targetStructureId,
                  parameters: parameters,
                  outputName: operation.outputMode === 'same' ? operation.structureName : (operation.outputName || `${operation.structureName}_margin`),
                  outputColor: outputColorRGB,
                  // Superstructure info for margin operations
                  saveAsSuperstructure: willCreateSuperstructure,
                  superstructureInfo
                });
                
                // Show success toast AFTER operation completes
                toast({
                  title: "Margin operation complete",
                  description: operation.outputMode === 'same' 
                    ? `Updated structure: ${operation.structureName}` 
                    : operation.saveAsSuperstructure
                    ? `Created auto-updating structure: ${operation.outputName}`
                    : `Created new structure: ${operation.outputName}`,
                });
              } catch (error) {
                console.error('🔶 MARGIN ERROR:', error);
                toast({
                  title: "Margin operation failed",
                  description: error instanceof Error ? error.message : "Unknown error occurred",
                  variant: "destructive"
                });
              }
            } else {
              console.error('🔶 MARGIN ERROR: Operation failed:', {
                hasWorkingViewerRef: !!workingViewerRef.current,
                structureId,
                structureName: operation.structureName,
                availableStructures: rtStructures.structures?.map((s: any) => s.structureName)
              });
              toast({
                title: "Margin operation failed",
                description: !workingViewerRef.current 
                  ? "Viewer not ready" 
                  : `Could not find structure "${operation.structureName}"`,
                variant: "destructive"
              });
            }
          }}
        />
      )}





      {/* Error Modal */}
      <ErrorModal
        isOpen={!!error}
        onClose={() => setError(null)}
        onRetry={() => {
          setError(null);
          if (selectedSeries) {
            handleSeriesSelect(selectedSeries);
          }
        }}
        error={error || { title: '', message: '' }}
      />
      
      {/* Background Loading Progress */}
      <LoadingProgress 
        loadingStates={secondaryLoadingStates as any}
        className="animate-in slide-in-from-right-2 duration-300"
      />
    </>
  );
}
