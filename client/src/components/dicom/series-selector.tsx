import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layers3, Palette, Settings, Search, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, ChevronUp, Minimize2, Maximize2, FolderTree, X, Plus, Edit3, Link, Folder, ArrowUpDown, ArrowUp, ArrowDown, Zap, Bug, Loader2, AlertTriangle, SplitSquareHorizontal, History, Save, Network, IterationCw, GitMerge, Boxes, Star } from 'lucide-react';
import { DICOMSeries, WindowLevel, WINDOW_LEVEL_PRESETS } from '@/lib/dicom-utils';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { pillClass, pillClassForModality } from '@/lib/pills';
import { StructureBlobList } from './structure-blob-list';
import { groupStructureBlobs, computeBlobVolumeCc, createContourKey, type Blob } from '@/lib/blob-operations';
import { SaveAsNewDialog } from './save-as-new-dialog';
import { RTStructureHistoryModal } from './rt-structure-history-modal';
import { useSuperstructures } from './SuperstructureManager';

interface SeriesSelectorProps {
  series: DICOMSeries[];
  selectedSeries: DICOMSeries | null;
  onSeriesSelect: (series: DICOMSeries) => void;
  windowLevel: WindowLevel;
  onWindowLevelChange: (windowLevel: WindowLevel) => void;
  studyId?: number;
  studyIds?: number[];
  regAssociations?: Record<number, number[]>;
  regCtacSeriesIds?: number[];
  rtStructures?: any;
  onRTStructureLoad?: (rtStructures: any) => void;
  onStructureVisibilityChange?: (structureId: number, visible: boolean) => void;
  onStructureColorChange?: (structureId: number, color: [number, number, number]) => void;
  onStructureSelection?: (structureId: number, selected: boolean) => void;
  selectedForEdit?: number | null;
  onSelectedForEditChange?: (roiNumber: number | null) => void;
  onContourSettingsChange?: (settings: { width: number; opacity: number }) => void;
  onAutoZoom?: (zoom: number) => void;
  onAutoLocalize?: (x: number, y: number, z: number) => void;
  secondarySeriesId?: number | null;
  onSecondarySeriesSelect?: (seriesId: number | null) => void;
  onRebuildFusionManifest?: () => void;
  onAllStructuresVisibilityChange?: (allVisible: boolean) => void;
  preventRTLoading?: boolean;
  localizationMode?: boolean;
  loadedRTSeriesId?: number | null;
  onLoadedRTSeriesIdChange?: (id: number | null) => void;
  previewStructureInfo?: { targetName: string; isNewStructure: boolean } | null;
  highlightedStructures?: { inputs: string[]; output: string };
  secondaryLoadingStates?: Map<number, {progress: number, isLoading: boolean}>;
  currentlyLoadingSecondary?: number | null;
  fusionStatuses?: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  fusionCandidatesByPrimary?: Map<number, number[]>;
  fusionSiblingMap?: Map<number, Map<'PET' | 'MR', Map<number, number[]>>>;
  // Multi-viewport state
  viewportAssignments?: Map<number, number | null>;  // Map of viewport number (1-indexed) → secondary series ID
  isInSplitView?: boolean;  // Whether we're in split-view mode (FlexibleFusionLayout)
  // External structure visibility state (for sync with topbar toggle)
  externalStructureVisibility?: Map<number, boolean>;
}

export function SeriesSelector({
  series,
  selectedSeries,
  onSeriesSelect,
  windowLevel,
  onWindowLevelChange,
  studyId,
  studyIds,
  regAssociations,
  regCtacSeriesIds = [],
  rtStructures,
  onRTStructureLoad,
  onStructureVisibilityChange,
  onStructureColorChange,
  onStructureSelection,
  selectedForEdit: externalSelectedForEdit,
  onSelectedForEditChange,
  onContourSettingsChange,
  onAutoZoom,
  onAutoLocalize,
  secondarySeriesId,
  onSecondarySeriesSelect,
  onRebuildFusionManifest,
  onAllStructuresVisibilityChange,
  preventRTLoading = false,
  localizationMode = false,
  loadedRTSeriesId,
  onLoadedRTSeriesIdChange,
  previewStructureInfo,
  highlightedStructures = { inputs: [], output: '' },
  secondaryLoadingStates,
  currentlyLoadingSecondary,
  fusionStatuses,
  fusionCandidatesByPrimary,
  fusionSiblingMap,
  viewportAssignments,
  isInSplitView = false,
  externalStructureVisibility,
}: SeriesSelectorProps) {
  
  // Debug logging removed for performance
  const [rtSeries, setRTSeries] = useState<any[]>([]);
  const [selectedRTSeries, setSelectedRTSeries] = useState<any>(null);
  const [userSelectedPrimaryCT, setUserSelectedPrimaryCT] = useState<number | null>(null); // User-selected primary CT for hierarchy
  const [structureVisibility, setStructureVisibility] = useState<Map<number, boolean>>(new Map());
  const [selectedStructures, setSelectedStructures] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Map<string, boolean>>(new Map());
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [groupingEnabled, setGroupingEnabled] = useState(true);
  const [hoveredRegSeries, setHoveredRegSeries] = useState<number | null>(null);
  const [otherSeriesExpanded, setOtherSeriesExpanded] = useState(false);
  const [accordionValues, setAccordionValues] = useState<string[]>(["series"]); // Control which accordion sections are open
  const [windowLevelExpanded, setWindowLevelExpanded] = useState(true); // Track window/level accordion state
  const [showSaveAsNewDialog, setShowSaveAsNewDialog] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [saveAsNewSeriesId, setSaveAsNewSeriesId] = useState<number | null>(null);
  const [historySeriesId, setHistorySeriesId] = useState<number | null>(null);
  const [seriesHistoryStatus, setSeriesHistoryStatus] = useState<Map<number, boolean>>(new Map());
  const [expandedSuperstructures, setExpandedSuperstructures] = useState<Set<number>>(new Set());
  // Calculate allVisible dynamically based on current visibility state
  const allVisible = useMemo(() => {
    if (!rtStructures?.structures || structureVisibility.size === 0) return true;
    return rtStructures.structures.every((structure: any) => 
      structureVisibility.get(structure.roiNumber) === true
    );
  }, [rtStructures?.structures, structureVisibility]);
  const [localSelectedForEdit, setLocalSelectedForEdit] = useState<number | null>(null);
  const [showStructureSettings, setShowStructureSettings] = useState(false);
  const [showAddContour, setShowAddContour] = useState(false);
  const [showContourOperations, setShowContourOperations] = useState(false);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
  const [autoLocalizeEnabled, setAutoLocalizeEnabled] = useState(true);
  const [zoomFillFactor, setZoomFillFactor] = useState([40]); // 40% fill factor
  const [contourWidth, setContourWidth] = useState([2]);
  const [contourOpacity, setContourOpacity] = useState([10]);
  const [showNewStructureDialog, setShowNewStructureDialog] = useState(false);
  const [newStructureName, setNewStructureName] = useState('');
  const [newStructureColor, setNewStructureColor] = useState('#FF0000');
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'position'>('az'); // Sorting mode: A-Z, Z-A, or by superior Z-slice
  const [expandedBlobStructures, setExpandedBlobStructures] = useState<Set<number>>(new Set()); // Track which structures have blob list expanded
  const [rtSeriesWithSuperstructures, setRTSeriesWithSuperstructures] = useState<Set<number>>(new Set()); // Track which RT series have superstructures
  const { toast } = useToast();
  
  // Helper: Get viewport number for a given secondary series ID (returns null if not in any viewport)
  const getViewportForSeries = (seriesId: number): number | null => {
    if (!viewportAssignments || viewportAssignments.size === 0) return null;
    for (const [vpNum, secId] of viewportAssignments.entries()) {
      if (secId === seriesId) return vpNum;
    }
    return null;
  };
  
  // Helper: Open series preview in a lightweight popup window
  const openSeriesPreview = (seriesItem: DICOMSeries) => {
    const previewUrl = `/preview?seriesId=${seriesItem.id}&studyId=${seriesItem.studyId}`;
    const popupWidth = 700;
    const popupHeight = 600;
    const left = (window.screen.width - popupWidth) / 2;
    const top = (window.screen.height - popupHeight) / 2;
    
    window.open(
      previewUrl,
      `preview-${seriesItem.id}`,
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`
    );
  };
  
  // Superstructure management
  const {
    superstructures,
    isLoading: superstructuresLoading,
    regenerateSuperstructure,
    deleteSuperstructure,
    toggleAutoUpdate,
    checkAndRegenerateAutoUpdates,
    reload: reloadSuperstructures
  } = useSuperstructures(rtStructures?.seriesId || null);
  
  // Load superstructures for all RT series to determine which have superstructures
  useEffect(() => {
    const loadAllSuperstructures = async () => {
      const seriesWithSuperstructures = new Set<number>();
      
      for (const rtS of rtSeries) {
        try {
          const response = await fetch(`/api/superstructures/${rtS.id}`);
          if (response.ok) {
            const superstructures = await response.json();
            if (superstructures && superstructures.length > 0) {
              seriesWithSuperstructures.add(rtS.id);
            }
          }
        } catch (error) {
          // Silently fail - series might not have superstructures
        }
      }
      
      setRTSeriesWithSuperstructures(seriesWithSuperstructures);
    };
    
    if (rtSeries.length > 0) {
      loadAllSuperstructures();
    }
  }, [rtSeries]);
  
  // Listen for superstructure reload events
  useEffect(() => {
    const handleReload = (event: CustomEvent) => {
      console.log('🔄 Superstructure reload event received!');
      setTimeout(() => {
        console.log('🔄 Triggering reload now...');
        reloadSuperstructures();
        // Also refresh the RT series superstructures map
        const loadAllSuperstructures = async () => {
          const seriesWithSuperstructures = new Set<number>();
          for (const rtS of rtSeries) {
            try {
              const response = await fetch(`/api/superstructures/${rtS.id}`);
              if (response.ok) {
                const superstructures = await response.json();
                if (superstructures && superstructures.length > 0) {
                  seriesWithSuperstructures.add(rtS.id);
                }
              }
            } catch (error) {
              // Silently fail
            }
          }
          setRTSeriesWithSuperstructures(seriesWithSuperstructures);
        };
        if (rtSeries.length > 0) {
          loadAllSuperstructures();
        }
      }, 500); // Small delay to ensure structure is saved
    };
    
    window.addEventListener('superstructures:reload' as any, handleReload);
    return () => {
      window.removeEventListener('superstructures:reload' as any, handleReload);
    };
  }, [reloadSuperstructures, rtSeries]);
  
  // Listen for structure modification events to trigger auto-updates
  useEffect(() => {
    const handleStructureModified = async (event: CustomEvent) => {
      const { roiNumbers } = event.detail || {};
      if (!roiNumbers || roiNumbers.length === 0) return;
      
      console.log('🔄 Structure modification detected, checking for auto-updates...', roiNumbers);
      
      try {
        await checkAndRegenerateAutoUpdates(roiNumbers);
      } catch (error) {
        console.error('Failed to auto-update superstructures:', error);
      }
    };
    
    window.addEventListener('structure:modified' as any, handleStructureModified);
    return () => {
      window.removeEventListener('structure:modified' as any, handleStructureModified);
    };
  }, [checkAndRegenerateAutoUpdates]);
  
  // Debug superstructures changes
  useEffect(() => {
    console.log('📊 Superstructures state updated:', {
      count: superstructures.length,
      superstructures,
      rtStructuresSeriesId: rtStructures?.seriesId
    });
    
    if (superstructures.length > 0) {
      superstructures.forEach((ss: any) => {
        console.log(`  - ROI ${ss.rtStructureRoiNumber}: ${ss.operationExpression} (auto-update: ${ss.autoUpdate})`);
      });
    } else {
      console.log('  - No superstructures loaded');
    }
  }, [superstructures, rtStructures?.seriesId]);
  
  // Detect blobs for all structures - recalculate when rtStructures object changes
  // Uses JSON stringify to deep-compare the structures array
  const structureBlobsMap = useMemo(() => {
    const map = new Map<number, Blob[]>();
    
    if (!rtStructures?.structures) return map;
    
    rtStructures.structures.forEach((structure: any) => {
      // Use exact same tolerance as blob dialog (SLICE_TOL_MM is default)
      const blobContours = groupStructureBlobs(structure);
      
      // Only show blob features if >1 blob detected (same check as dialog)
      if (blobContours.length > 1) {
        const blobs: Blob[] = blobContours.map((contours, idx) => ({
          id: idx + 1,
          volumeCc: computeBlobVolumeCc(contours, { 
            pixelSpacing: '1.171875\\1.171875',
            sliceThickness: '3'
          }),
          contours
        }));
        map.set(structure.roiNumber, blobs);
      }
    });
    
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtStructures]);

  const seriesById = useMemo(() => {
    const map = new Map<number, DICOMSeries>();
    series.forEach((entry) => {
      if (!entry) return;
      const numericId = Number(entry.id);
      if (Number.isFinite(numericId)) {
        map.set(numericId, entry);
      }
    });
    return map;
  }, [series]);

  const getCandidatesForPrimary = (primaryId: number): number[] => {
    if (fusionCandidatesByPrimary && fusionCandidatesByPrimary.has(primaryId)) {
      return fusionCandidatesByPrimary.get(primaryId) ?? [];
    }
    const fallback = regAssociations?.[primaryId];
    if (Array.isArray(fallback)) {
      return fallback;
    }
    return [];
  };

  const formatSeriesLabel = (item: { seriesDescription?: string | null; seriesNumber?: number | null; id?: number }) => {
    const rawDescription = (item.seriesDescription || '').trim();
    const seriesNumber = typeof item.seriesNumber === 'number' ? `#${item.seriesNumber}` : null;
    const fallback = item.id != null ? `Series ${item.id}` : 'Series';
    const baseLabel = rawDescription.length
      ? (rawDescription.length > 60 ? `${rawDescription.slice(0, 57)}…` : rawDescription)
      : fallback;
    return seriesNumber ? `${seriesNumber} · ${baseLabel}` : baseLabel;
  };

  // Subtle pill styling is centralized in `@/lib/pills` (keeps pills consistent across the app)
  
  // Use external selectedForEdit if provided, otherwise use local state
  const selectedForEdit = externalSelectedForEdit !== undefined ? externalSelectedForEdit : localSelectedForEdit;

  // Notify parent when contour settings change
  useEffect(() => {
    if (onContourSettingsChange) {
      onContourSettingsChange({
        width: contourWidth[0],
        opacity: contourOpacity[0]
      });
    }
  }, [contourWidth, contourOpacity, onContourSettingsChange]);

  // Handler for structure editing selection
  const handleStructureEditSelection = (roiNumber: number) => {
    const newSelected = selectedForEdit === roiNumber ? null : roiNumber;
    
    if (onSelectedForEditChange) {
      onSelectedForEditChange(newSelected);
    } else {
      setLocalSelectedForEdit(newSelected);
    }
    
    // Enable auto-localize when selecting a structure for editing
    if (newSelected && rtStructures?.structures) {
      const structure = rtStructures.structures.find((s: any) => s.roiNumber === newSelected);
      if (structure && (autoZoomEnabled || autoLocalizeEnabled)) {
        applyAutoZoomAndLocalize(structure);
      }
    }
  };

  // Calculate contour centroid and apply auto-zoom/localize
  const applyAutoZoomAndLocalize = (structure: any) => {
    if (!structure.contours || structure.contours.length === 0) return;
    
    let totalX = 0, totalY = 0, totalZ = 0, totalPoints = 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    // Calculate centroid and bounding box across all contours
    structure.contours.forEach((contour: any) => {
      if (contour.points && contour.points.length >= 6) {
        for (let i = 0; i < contour.points.length; i += 3) {
          const x = contour.points[i];
          const y = contour.points[i + 1];
          const z = contour.points[i + 2];
          
          totalX += x;
          totalY += y;
          totalZ += z;
          totalPoints++;
          
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        }
      }
    });
    
    if (totalPoints === 0) return;
    
    const centroidX = totalX / totalPoints;
    const centroidY = totalY / totalPoints;
    const centroidZ = totalZ / totalPoints;
    
    // Calculate zoom level based on bounding box size
    if (autoZoomEnabled) {
      const width = maxX - minX;
      const height = maxY - minY;
      const maxDimension = Math.max(width, height);
      
      if (maxDimension > 0) {
        // Calculate zoom to fit structure with fill factor
        const fillFactor = zoomFillFactor[0] / 100;
        const targetZoom = (300 * fillFactor) / maxDimension; // Assuming 300px viewport
        
        if (onAutoZoom) {
          const finalZoom = Math.max(0.5, Math.min(5, targetZoom));
          console.log('Calling onAutoZoom with zoom:', finalZoom);
          onAutoZoom(finalZoom);
        } else {
          console.log('onAutoZoom callback not available');
        }
      }
    }
    
    // Pan to centroid
    if (autoLocalizeEnabled && onAutoLocalize) {
      console.log('Calling onAutoLocalize with centroid:', centroidX, centroidY, centroidZ);
      onAutoLocalize(centroidX, centroidY, centroidZ);
    } else {
      console.log('onAutoLocalize not available or disabled. autoLocalizeEnabled:', autoLocalizeEnabled, 'onAutoLocalize:', !!onAutoLocalize);
    }
  };

  // Check history availability for RT series
  useEffect(() => {
    if (rtSeries.length === 0) return;
    
    const checkHistoryStatus = async () => {
      const statusMap = new Map<number, boolean>();
      
      for (const rtS of rtSeries) {
        try {
          const response = await fetch(`/api/rt-structures/${rtS.id}/history?limit=1`);
          if (response.ok) {
            const data = await response.json();
            statusMap.set(rtS.id, data.history && data.history.length > 0);
          } else {
            statusMap.set(rtS.id, false);
          }
        } catch (error) {
          statusMap.set(rtS.id, false);
        }
      }
      
      setSeriesHistoryStatus(statusMap);
    };
    
    checkHistoryStatus();
  }, [rtSeries]);

  // Load RT structure series for all studies (memoized to prevent excessive API calls)
  const rtSeriesLoadedRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    if (preventRTLoading) {
      console.log('Skipping RT structure loading - handled by parent component');
      return;
    }
    
    const studyIdsToLoad = studyIds || (studyId ? [studyId] : []);
    if (studyIdsToLoad.length === 0) return;
    
    // Check if all studies are already loaded
    const needsLoading = studyIdsToLoad.some(id => !rtSeriesLoadedRef.current.has(id));
    if (!needsLoading) {
      console.log('RT series already loaded for all studies:', studyIdsToLoad);
      return;
    }
    
    let isCancelled = false;
    
    const loadRTSeries = async () => {
      try {
        const allRTSeries: any[] = [];
        
        // Load RT structures for each study (only once per study)
        for (const id of studyIdsToLoad) {
          if (isCancelled) break;
          
          // Skip if already loaded
          if (rtSeriesLoadedRef.current.has(id)) continue;
          
          const response = await fetch(`/api/studies/${id}/rt-structures`);
          if (response.ok) {
            const rtSeriesData = await response.json();
            allRTSeries.push(...rtSeriesData);
            rtSeriesLoadedRef.current.add(id); // Mark as loaded
          }
        }
        
        if (!isCancelled) {
          // De-duplicate by composite key id|seriesInstanceUID to avoid duplicates from patient-wide lookup
          const unique = new Map<string, any>();
          for (const rt of allRTSeries) {
            const key = `${Number(rt?.id) || 0}|${rt?.seriesInstanceUID || ''}`;
            if (!unique.has(key)) unique.set(key, rt);
          }
          const deduped = Array.from(unique.values());
          setRTSeries(deduped);
          console.log(`✅ Loaded RT series for studies: ${studyIdsToLoad.join(',')}`);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error loading RT series:', error);
        }
      }
    };
    
    loadRTSeries();
    
    return () => {
      isCancelled = true;
    };
  }, [studyId, studyIds?.join(','), preventRTLoading]); // Stable dependency for studyIds array

  // Initialize structure visibility when RT structures are loaded
  useEffect(() => {
    if (rtStructures?.structures) {
      const visibilityMap = new Map();
      rtStructures.structures.forEach((structure: any) => {
        visibilityMap.set(structure.roiNumber, true);
      });
      setStructureVisibility(visibilityMap);
    }
  }, [rtStructures]);

  // Sync with external visibility state (from topbar toggle)
  useEffect(() => {
    if (externalStructureVisibility && externalStructureVisibility.size > 0) {
      setStructureVisibility(new Map(externalStructureVisibility));
    }
  }, [externalStructureVisibility]);

  // Auto-select most recent RT structure set and sync with loadedRTSeriesId
  useEffect(() => {
    if (rtSeries.length > 0 && selectedSeries) {
      // Filter RT series to only those that reference the currently selected primary series
      const matchingRTSeries = rtSeries.filter((rtS: any) => 
        rtS.referencedSeriesId === selectedSeries.id
      );
      
      console.log(`🔍 RT series check for primary ${selectedSeries.id}:`, {
        total: rtSeries.length,
        matching: matchingRTSeries.length,
        selectedRTSeriesId: selectedRTSeries?.id,
        selectedRTReferencesCurrentSeries: selectedRTSeries?.referencedSeriesId === selectedSeries.id
      });
      
      if (matchingRTSeries.length === 0) {
        // No RT structure sets reference this series, clear selection
        if (selectedRTSeries) {
          console.log(`⚠️ No RT structure sets reference primary series ${selectedSeries.id}, clearing selection`);
          setSelectedRTSeries(null);
          // Also notify parent to clear loaded RT series
          if (onLoadedRTSeriesIdChange) {
            onLoadedRTSeriesIdChange(null);
          }
        }
        return;
      }
      
      // Check if current selection is valid for this series
      const currentSelectionValid = selectedRTSeries && 
                                    selectedRTSeries.referencedSeriesId === selectedSeries.id;
      
      if (currentSelectionValid) {
        // Current selection is valid, keep it
        console.log(`✅ Current RT selection (${selectedRTSeries.id}) is valid for series ${selectedSeries.id}`);
        return;
      }
      
      // No valid selection, auto-select the most recent RT that references this series
      const mostRecentRT = matchingRTSeries.reduce((latest, current) => {
        // Prefer by series date/time first, then by series number
        const latestDate = latest.seriesDate || latest.createdAt || '';
        const currentDate = current.seriesDate || current.createdAt || '';
        
        if (currentDate > latestDate) return current;
        if (currentDate === latestDate && (current.seriesNumber || 0) > (latest.seriesNumber || 0)) return current;
        return latest;
      });
      
      console.log(`🎯 Auto-selecting most recent RT structure set for series ${selectedSeries.id}: ${mostRecentRT.seriesDescription} (ID: ${mostRecentRT.id})`);
      handleRTSeriesSelect(mostRecentRT);
    }
  }, [rtSeries, selectedSeries]);

  async function handleRTSeriesSelect(rtSeries: any) {
    try {
      setSelectedRTSeries(rtSeries);
      // Notify parent about the loaded RT series ID regardless of click vs. auto-select
      if (onLoadedRTSeriesIdChange) {
        onLoadedRTSeriesIdChange(rtSeries?.id ?? null);
      }
      
      // Auto-expand structures accordion section when an RT structure set is selected
      setAccordionValues(prev => {
        if (!prev.includes('structures')) {
          return [...prev, 'structures'];
        }
        return prev;
      });
      
      // Load RT structure contours
      const response = await fetch(`/api/rt-structures/${rtSeries.id}/contours`);
      if (response.ok) {
        const rtStructData = await response.json();
        // Ensure seriesId is present on the in-memory object
        if (rtStructData && (rtStructData.seriesId === undefined || rtStructData.seriesId === null)) {
          rtStructData.seriesId = Number(rtSeries?.id) || null;
        }
        if (onRTStructureLoad) {
          onRTStructureLoad(rtStructData);
        }
      } else {
        console.error('Failed to fetch RT contours:', response.status);
      }
    } catch (error) {
      console.error('Error loading RT structure contours:', error);
    }
  }

  const handleStructureVisibilityToggle = (structureId: number) => {
    const currentVisibility = structureVisibility.get(structureId);
    const newVisibility = currentVisibility === undefined ? true : !currentVisibility;
    
    console.log('Eye icon clicked:', { 
      structureId, 
      currentVisibility, 
      newVisibility,
      allVisible 
    });
    
    setStructureVisibility(prev => new Map(prev.set(structureId, newVisibility)));
    
    if (onStructureVisibilityChange) {
      onStructureVisibilityChange(structureId, newVisibility);
    }
  };

  const handleStructureSelection = (structureId: number, selected: boolean) => {
    const newSelection = new Set(selectedStructures);
    if (selected) {
      newSelection.add(structureId);
    } else {
      newSelection.delete(structureId);
    }
    setSelectedStructures(newSelection);
    
    if (onStructureSelection) {
      onStructureSelection(structureId, selected);
    }
  };

  const handleDeleteStructure = async (structureId: number) => {
    console.log('🗑️ Delete structure:', structureId);

    if (!rtStructures || !onRTStructureLoad) {
      console.warn('Cannot delete structure: rtStructures or onRTStructureLoad not available');
      return;
    }

    // Check if this structure is a source for any superstructures (using ROI numbers)
    const affectedSuperstructures = superstructures.filter((ss: any) => 
      ss.sourceStructureRoiNumbers?.includes(structureId)
    );
    
    if (affectedSuperstructures.length > 0) {
      const structureName = rtStructures.structures.find((s: any) => s.roiNumber === structureId)?.structureName;
      const affectedNames = affectedSuperstructures.map((ss: any) => {
        const targetStruct = rtStructures.structures.find((s: any) => s.roiNumber === ss.rtStructureRoiNumber);
        return targetStruct?.structureName || 'Unknown';
      });
      
      const message = `Deleting "${structureName}" will affect ${affectedSuperstructures.length} superstructure(s):\n\n${affectedNames.join('\n')}\n\nThese will no longer auto-update but will remain as regular structures.\n\nContinue with deletion?`;
      
      if (!window.confirm(message)) {
        return;
      }
      
      // Delete the superstructure metadata (but keep the structures themselves)
      for (const ss of affectedSuperstructures) {
        try {
          await fetch(`/api/superstructures/${ss.id}`, { method: 'DELETE' });
          console.log(`✅ Removed superstructure metadata for ${ss.id}`);
        } catch (error) {
          console.error('Error deleting superstructure metadata:', error);
        }
      }
      
      // Superstructures will be automatically refreshed by the hook on next render
    }

    // Deep clone the rtStructures
    const updated = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));

    // Remove the structure from the structures array
    updated.structures = updated.structures.filter((s: any) => s.roiNumber !== structureId);

    // Update the RT structures
    onRTStructureLoad(updated);

    // Remove from selected structures if it was selected
    if (selectedStructures.has(structureId)) {
      const newSelection = new Set(selectedStructures);
      newSelection.delete(structureId);
      setSelectedStructures(newSelection);
    }

    // Clear edit selection if this structure was being edited
    if (externalSelectedForEdit === structureId && onSelectedForEditChange) {
      onSelectedForEditChange(null);
    }

    toast({
      title: "Structure deleted",
      description: `Removed structure ${structureId}`
    });
  };
  
  // Blob management handlers
  const handleBlobLocalize = (structureId: number, blobId: number, contours: any[]) => {
    console.log(`🎯 Sidebar: Localize blob ${blobId} of structure ${structureId}`);
    
    if (!contours.length) return;
    
    // Find middle slice
    const slicePositions = contours.map(c => c.slicePosition).sort((a, b) => a - b);
    const middleSlice = slicePositions[Math.floor(slicePositions.length / 2)];
    const middleContours = contours.filter(c => Math.abs(c.slicePosition - middleSlice) < 0.5);
    
    // Calculate centroid and bounding box (matching main autolocalize mode)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let totalX = 0, totalY = 0, totalPoints = 0;
    
    middleContours.forEach(c => {
      for (let i = 0; i < c.points.length; i += 3) {
        const x = c.points[i];
        const y = c.points[i + 1];
        
        // Update bounding box
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        
        // Accumulate for centroid calculation
        totalX += x;
        totalY += y;
        totalPoints++;
      }
    });
    
    if (totalPoints === 0 || !isFinite(minX) || !isFinite(maxX)) {
      console.warn('🎯 Cannot localize: invalid blob contours');
      return;
    }
    
    // Calculate proper centroid (not bounding box center)
    const centroidX = totalX / totalPoints;
    const centroidY = totalY / totalPoints;
    
    // Calculate blob dimensions for zoom
    const blobWidthMm = maxX - minX;
    const blobHeightMm = maxY - minY;
    const maxDimension = Math.max(blobWidthMm, blobHeightMm);
    
    if (maxDimension > 0) {
      // Calculate zoom to fit blob with fill factor (matching main autolocalize)
      const fillFactor = zoomFillFactor[0] / 100;
      const targetZoom = (300 * fillFactor) / maxDimension; // Assuming 300px viewport
      const finalZoom = Math.max(0.5, Math.min(5, targetZoom));
      
      console.log(`🎯 Blob: ${blobWidthMm.toFixed(1)}x${blobHeightMm.toFixed(1)}mm, centroid: (${centroidX.toFixed(1)}, ${centroidY.toFixed(1)}), zoom: ${finalZoom.toFixed(2)}x`);
      
      // Apply zoom first, then localize to centroid (matching main autolocalize order)
      if (onAutoZoom) {
        onAutoZoom(finalZoom);
      }
      if (onAutoLocalize) {
        onAutoLocalize(centroidX, centroidY, middleSlice);
      }
    } else {
      // Fallback: just localize without zoom
      if (onAutoLocalize) {
        onAutoLocalize(centroidX, centroidY, middleSlice);
      }
    }
  };
  
  const handleBlobDelete = (structureId: number, blobId: number) => {
    console.log(`🗑️ Delete blob ${blobId} of structure ${structureId}`);
    
    if (!rtStructures || !onRTStructureLoad) return;
    
    const blobs = structureBlobsMap.get(structureId);
    if (!blobs) return;
    
    const blobToDelete = blobs.find(b => b.id === blobId);
    if (!blobToDelete) return;
    
    // Remove contours belonging to this blob
    const keysToRemove = new Set(blobToDelete.contours.map(c => createContourKey(c)));
    
    const updated = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
    const structure = updated.structures.find((s: any) => s.roiNumber === structureId);
    
    if (structure) {
      structure.contours = structure.contours.filter((c: any) => !keysToRemove.has(createContourKey(c)));
      onRTStructureLoad(updated);
      toast({ title: "Blob deleted", description: `Removed blob ${blobId}` });
    }
  };
  
  const handleBlobSeparate = (structureId: number, blobId: number) => {
    console.log(`🔀 Separate blob ${blobId} of structure ${structureId}`);
    
    if (!rtStructures || !onRTStructureLoad) return;
    
    const structure = rtStructures.structures.find((s: any) => s.roiNumber === structureId);
    const blobs = structureBlobsMap.get(structureId);
    if (!structure || !blobs) return;
    
    const blobToSeparate = blobs.find(b => b.id === blobId);
    if (!blobToSeparate) return;
    
    // Create new structure from this blob
    const updated = structuredClone ? structuredClone(rtStructures) : JSON.parse(JSON.stringify(rtStructures));
    const maxRoi = Math.max(0, ...updated.structures.map((s: any) => s.roiNumber || 0));
    const newStructure = {
      roiNumber: maxRoi + 1,
      structureName: `${structure.structureName}_${blobId}`,
      color: structure.color,
      contours: blobToSeparate.contours
    };
    
    // Remove contours from original structure
    const keysToRemove = new Set(blobToSeparate.contours.map(c => createContourKey(c)));
    const origStructure = updated.structures.find((s: any) => s.roiNumber === structureId);
    if (origStructure) {
      origStructure.contours = origStructure.contours.filter((c: any) => !keysToRemove.has(createContourKey(c)));
    }
    
    // Add new structure
    updated.structures.push(newStructure);
    
    onRTStructureLoad(updated);
    toast({ 
      title: "Blob separated", 
      description: `Created ${newStructure.structureName}` 
    });
  };

  const handleCreateNewStructure = async () => {
    if (!newStructureName.trim()) {
      toast({ 
        title: "Structure name is required", 
        variant: "destructive" 
      });
      return;
    }

    if (!studyId) {
      toast({ 
        title: "No study selected", 
        variant: "destructive" 
      });
      return;
    }

    // Convert hex color to RGB array
    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [255, 0, 0];
    };

    const rgbColor = hexToRgb(newStructureColor);

    try {
      console.log('Creating structure with:', {
        studyId,
        structureName: newStructureName.trim(),
        color: rgbColor
      });

      // Call API to create new structure
      const response = await fetch('/api/rt-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyId: studyId,
          structureName: newStructureName.trim(),
          color: rgbColor
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create structure error:', errorText);
        throw new Error(errorText || 'Failed to create structure');
      }

      const newStructure = await response.json();
      console.log('New structure created:', newStructure);
      
      // Reload RT structures to include the new one
      if (selectedRTSeries && onRTStructureLoad) {
        console.log('Reloading RT structures for series:', selectedRTSeries.id);
        const structuresResponse = await fetch(`/api/rt-structures/${selectedRTSeries.id}/contours`);
        if (structuresResponse.ok) {
          const data = await structuresResponse.json();
          console.log('Reloaded structures:', data);
          onRTStructureLoad(data);
        } else {
          console.error('Failed to reload structures:', structuresResponse.status);
        }
      } else {
        console.log('Cannot reload structures - selectedRTSeries:', selectedRTSeries, 'onRTStructureLoad:', !!onRTStructureLoad);
      }

      toast({ 
        title: `Structure "${newStructureName}" created successfully`,
        variant: "default" 
      });

      // Reset form and close dialog
      setNewStructureName('');
      setNewStructureColor('#FF0000');
      setShowNewStructureDialog(false);
    } catch (error) {
      console.error('Error creating structure:', error);
      toast({ 
        title: "Failed to create structure", 
        variant: "destructive" 
      });
    }
  };

  const handleCreateBlankStructureSet = async () => {
    if (!studyId || !selectedSeries) {
      toast({ 
        title: "No scan selected", 
        description: "Please select a scan first",
        variant: "destructive" 
      });
      return;
    }

    try {
      const response = await fetch('/api/rt-structure-sets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyId: studyId,
          seriesId: selectedSeries.id,
          label: `New Structure Set - ${new Date().toLocaleDateString()}`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create structure set error:', errorText);
        throw new Error(errorText || 'Failed to create structure set');
      }

      const { rtSeriesId, structureSet } = await response.json();
      console.log('New blank structure set created:', { rtSeriesId, structureSet });
      
      // Load the new structure set
      if (onRTStructureLoad) {
        if (structureSet && (structureSet.seriesId === undefined || structureSet.seriesId === null)) {
          structureSet.seriesId = Number(rtSeriesId) || null;
        }
        onRTStructureLoad(structureSet);
      }

      // Find and select the RT series that was created/used
      const allSeries = await fetch(`/api/studies/${studyId}/series`).then(r => r.json());
      const rtSeries = allSeries.find((s: any) => s.id === rtSeriesId);
      
      if (rtSeries) {
        setSelectedRTSeries(rtSeries);
        if (onLoadedRTSeriesIdChange) {
          onLoadedRTSeriesIdChange(rtSeries?.id ?? null);
        }
      }

      toast({ 
        title: "Blank structure set created",
        description: "You can now add structures to this set",
        variant: "default" 
      });
    } catch (error) {
      console.error('Error creating blank structure set:', error);
      toast({ 
        title: "Failed to create structure set", 
        variant: "destructive" 
      });
    }
  };

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups(prev => {
      const newMap = new Map(prev);
      newMap.set(groupName, !newMap.get(groupName));
      return newMap;
    });
  };

  const toggleAllExpansion = () => {
    if (!rtStructures?.structures) return;
    
    const filteredStructures = rtStructures.structures.filter((structure: any) =>
      structure.structureName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const { groups, specialGroups } = groupStructures(filteredStructures);
    
    setExpandedGroups(prev => {
      const newMap = new Map(prev);
      const shouldExpand = allCollapsed;
      
      // Add regular groups
      Array.from(groups.keys()).forEach(groupName => {
        newMap.set(groupName, shouldExpand);
      });
      
      // Add special groups
      Array.from(specialGroups.keys()).forEach(groupName => {
        newMap.set(groupName, shouldExpand);
      });
      
      return newMap;
    });
    
    setAllCollapsed(!allCollapsed);
  };

  // Group structures by base name and special categories
  const groupStructures = (structures: any[]) => {
    const groups: Map<string, any[]> = new Map();
    const specialGroups: Map<string, any[]> = new Map([
      ['GTV', []],
      ['CTV', []],
      ['PTV', []],
      ['Planning Structures', []]
    ]);
    const ungrouped: any[] = [];

    structures.forEach(structure => {
      const name = structure.structureName;
      
      // Check for special prefixes first
      if (name.startsWith('GTV')) {
        specialGroups.get('GTV')!.push(structure);
      } else if (name.startsWith('CTV')) {
        specialGroups.get('CTV')!.push(structure);
      } else if (name.startsWith('PTV') && !name.startsWith('zzPTV')) {
        specialGroups.get('PTV')!.push(structure);
      } else if (name.startsWith('zz')) {
        specialGroups.get('Planning Structures')!.push(structure);
      } else {
        // Regular L/R grouping
        const baseName = name.replace(/_[LR]$/, '');
        
        if (name.endsWith('_L') || name.endsWith('_R')) {
          if (!groups.has(baseName)) {
            groups.set(baseName, []);
          }
          groups.get(baseName)!.push(structure);
        } else {
          ungrouped.push(structure);
        }
      }
    });

    // Sort special groups
    specialGroups.forEach((structures, key) => {
      structures.sort((a, b) => a.structureName.localeCompare(b.structureName));
    });

    // Remove empty special groups
    const nonEmptySpecialGroups = new Map();
    specialGroups.forEach((structures, key) => {
      if (structures.length > 0) {
        nonEmptySpecialGroups.set(key, structures);
      }
    });

    return { groups, ungrouped, specialGroups: nonEmptySpecialGroups };
  };

  // Function to sort structures based on current mode
  const sortStructures = (structures: any[]) => {
    const sorted = [...structures];
    
    switch (sortMode) {
      case 'az':
        // Sort A-Z alphabetically
        return sorted.sort((a, b) => a.structureName.localeCompare(b.structureName));
      
      case 'za':
        // Sort Z-A reverse alphabetically
        return sorted.sort((a, b) => b.structureName.localeCompare(a.structureName));
      
      case 'position':
        // Sort by most superior Z-slice (highest Z value first)
        return sorted.sort((a, b) => {
          // Get the maximum Z position for each structure
          const getMaxZ = (structure: any) => {
            if (!structure.contourData || structure.contourData.length === 0) return -Infinity;
            
            let maxZ = -Infinity;
            structure.contourData.forEach((contour: any) => {
              if (contour.slicePosition && contour.slicePosition > maxZ) {
                maxZ = contour.slicePosition;
              }
            });
            return maxZ;
          };
          
          const maxZA = getMaxZ(a);
          const maxZB = getMaxZ(b);
          
          // Sort by highest Z first (most superior)
          return maxZB - maxZA;
        });
      
      default:
        return sorted;
    }
  };

  const filteredStructures = rtStructures?.structures?.filter((structure: any) =>
    structure.structureName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Apply sorting to filtered structures
  const sortedStructures = sortStructures(filteredStructures);
  const { groups, ungrouped } = groupStructures(sortedStructures);

  const toggleGrouping = () => {
    setGroupingEnabled(!groupingEnabled);
  };

  const toggleAllVisibility = () => {
    if (!rtStructures?.structures) return;
    
    const shouldShow = !allVisible;
    
    // Update all visibility states at once
    setStructureVisibility(prev => {
      const newMap = new Map(prev);
      rtStructures.structures.forEach((structure: any) => {
        newMap.set(structure.roiNumber, shouldShow);
      });
      return newMap;
    });
    
    // Call parent callback for each structure
    rtStructures.structures.forEach((structure: any) => {
      if (onStructureVisibilityChange) {
        onStructureVisibilityChange(structure.roiNumber, shouldShow);
      }
    });
    
    // Notify parent about all structures visibility change
    if (onAllStructuresVisibilityChange) {
      onAllStructuresVisibilityChange(shouldShow);
    }
  };

  const toggleGroupVisibility = (groupStructures: any[]) => {
    const allGroupVisible = groupStructures.every(structure => 
      structureVisibility.get(structure.roiNumber) ?? true
    );
    
    setStructureVisibility(prev => {
      const newMap = new Map(prev);
      const shouldShow = !allGroupVisible;
      
      groupStructures.forEach(structure => {
        newMap.set(structure.roiNumber, shouldShow);
      });
      
      return newMap;
    });
  };

  const handleWindowChange = (values: number[]) => {
    onWindowLevelChange({ window: values[0], level: windowLevel.level });
  };

  const handleLevelChange = (values: number[]) => {
    onWindowLevelChange({ window: windowLevel.window, level: values[0] });
  };

  const applyPreset = (preset: WindowLevel) => {
    onWindowLevelChange(preset);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-full flex flex-col space-y-4">
        {/* Main Series and Structures Panel */}
        <Card className="flex-1 bg-gray-950/95 border border-gray-600/60 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="flex-1 overflow-hidden flex flex-col">
              <Accordion 
                type="multiple" 
                value={accordionValues}
                onValueChange={setAccordionValues}
                className="h-full flex flex-col"
              >
            
            {/* Series Section */}
            <AccordionItem value="series" className="border-gray-800/50">
              <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center text-gray-100 font-semibold text-sm">
                  <Layers3 className="w-4 h-4 mr-2.5 text-blue-400" />
                  Series
                </div>
              </AccordionTrigger>
              
              {/* Summary when collapsed - always rendered to prevent layout shift */}
              <div 
                className={`px-4 space-y-1.5 border-t border-gray-800/50 bg-gray-900/30 overflow-hidden transition-opacity duration-150 ease-out ${
                  accordionValues.includes('series') ? 'hidden' : 'py-2 animate-fade-in'
                }`}
              >
                  {selectedSeries && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className={pillClassForModality(selectedSeries.modality)}>
                        {selectedSeries.modality}
                      </Badge>
                      <span className="text-gray-200 truncate font-medium">
                        {formatSeriesLabel(selectedSeries)} ({selectedSeries.imageCount})
                      </span>
                    </div>
                  )}
                  
                  {(() => {
                    // Multi-viewport mode: show ALL active fusion overlays (one per viewport assignment)
                    if (isInSplitView && viewportAssignments && viewportAssignments.size > 0) {
                      const activeAssignments = Array.from(viewportAssignments.entries())
                        .filter(([vpNum, secId]) => Number.isFinite(vpNum) && secId != null && Number.isFinite(secId))
                        .map(([vpNum, secId]) => {
                          const seriesEntry = seriesById.get(Number(secId)) || series.find((s) => s.id === secId);
                          return { vpNum: Number(vpNum), seriesEntry };
                        })
                        .filter((x) => Boolean(x.seriesEntry)) as Array<{ vpNum: number; seriesEntry: DICOMSeries }>;

                      if (activeAssignments.length === 0) return null;

                      const maxShown = 4;
                      const shown = activeAssignments.slice(0, maxShown);
                      const remaining = activeAssignments.length - shown.length;

                      return (
                        <div className="space-y-1">
                          {shown.map(({ vpNum, seriesEntry }) => (
                            <div key={`${vpNum}-${seriesEntry.id}`} className="flex items-center gap-2 text-xs pl-4 border-l-2 border-blue-500/40">
                              <Zap className="h-3 w-3 text-blue-400" />
                              <span className={cn(pillClass('blue'), 'h-5 px-2')}>
                                VP {vpNum}
                              </span>
                              <Badge className={pillClassForModality(seriesEntry.modality)}>
                                {seriesEntry.modality}
                              </Badge>
                              <span className="text-gray-200 truncate font-medium">
                                {formatSeriesLabel(seriesEntry)}
                              </span>
                            </div>
                          ))}
                          {remaining > 0 && (
                            <div className="text-[10px] text-gray-400 pl-4">
                              +{remaining} more fusion overlay{remaining === 1 ? '' : 's'}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Single-viewport mode: keep legacy single fusion summary
                    if (secondarySeriesId) {
                      const secondarySeries = seriesById.get(Number(secondarySeriesId)) || series.find((s) => s.id === secondarySeriesId);
                      if (!secondarySeries) return null;
                      const modality = secondarySeries.modality?.toUpperCase();
                      return (
                        <div className="flex items-center gap-2 text-xs pl-4 border-l-2 border-blue-500/40">
                          <Zap className="h-3 w-3 text-blue-400" />
                          <Badge className={pillClassForModality(modality)}>
                            {secondarySeries.modality}
                          </Badge>
                          <span className="text-gray-200 truncate font-medium">
                            {formatSeriesLabel(secondarySeries)}
                          </span>
                        </div>
                      );
                    }

                    return null;
                  })()}
                  
                  {selectedRTSeries && (
                    <div className="flex items-center gap-2 text-xs pl-4 border-l-2 border-green-500/40">
                      <Badge className={pillClassForModality('RT')}>
                        RT
                      </Badge>
                      <span className="text-gray-200 truncate font-medium">
                        {selectedRTSeries.seriesDescription || 'Structure Set'}
                      </span>
                    </div>
                  )}
                  
                  {!selectedSeries && (
                    <div className="text-xs text-gray-500 italic">No series selected</div>
                  )}
              </div>
              
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-1 max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  {/* Organize series hierarchically */}
                  {(() => {
                    // Build top-level modality buckets
                    const modalityOf = (entry: DICOMSeries) => (entry.modality || '').toUpperCase();
                    const mrSeries = series.filter(s => modalityOf(s) === 'MR');
                    const ptSeries = series.filter(s => ['PT', 'PET', 'NM'].includes(modalityOf(s)));
                    const regSeries = series.filter(s => modalityOf(s) === 'REG');
                    const otherSeries = series.filter(s => !['CT', 'MR', 'PT', 'PET', 'NM', 'REG', 'RTSTRUCT'].includes(modalityOf(s)));

                    // Helper: get all planning CTs (CTs referenced by RT structures or that are registration primaries)
                    const getAllPlanningCTs = () => {
                      const allCTSeries = series.filter(s => modalityOf(s) === 'CT');
                      if (allCTSeries.length === 0) return [];

                      // Gather signals
                      const regPrimaryIds = new Set<number>(
                        regAssociations ? Object.keys(regAssociations).map(k => Number(k)).filter(n => Number.isFinite(n)) : []
                      );
                      const planningCTIds = new Set<number>((rtSeries || [])
                        .map((r: any) => Number(r?.referencedSeriesId))
                        .filter((id: number) => Number.isFinite(id))
                      );
                      const ptStudyIdsAll = new Set<number>(ptSeries.map(s => s.studyId));

                      // Score CTs with weighted criteria
                      const scoreCT = (ct: any) => {
                        let score = 0;
                        // Strong signal: referenced by RTSTRUCT
                        if (planningCTIds.has(ct.id)) score += 1000;
                        // Strong signal: is a REG primary
                        if (regPrimaryIds.has(ct.id)) score += 500 + (regAssociations?.[ct.id]?.length || 0) * 5;
                        // Prefer non-PET study CTs
                        if (!ptStudyIdsAll.has(ct.studyId)) score += 100;
                        // Avoid CTACs if provided by server
                        if (regCtacSeriesIds?.includes?.(ct.id)) score -= 200;
                        // Prefer larger image counts
                        score += Math.min(200, (ct.imageCount || 0));
                        return score;
                      };

                      // Sort by score descending
                      const sorted = [...allCTSeries].sort((a, b) => scoreCT(b) - scoreCT(a));
                      
                      // Return ALL CTs that are either:
                      // 1. Referenced by an RT structure, OR
                      // 2. A registration primary, OR
                      // 3. The highest-scoring CT (at minimum show one)
                      const planningCTs = sorted.filter((ct, idx) => 
                        planningCTIds.has(ct.id) || 
                        regPrimaryIds.has(ct.id) || 
                        idx === 0  // Always include the best CT
                      );
                      
                      // De-duplicate while preserving order
                      const seen = new Set<number>();
                      return planningCTs.filter(ct => {
                        if (seen.has(ct.id)) return false;
                        seen.add(ct.id);
                        return true;
                      });
                    };

                    const allPlanningCTs = getAllPlanningCTs();
                    
                    // If user has selected a primary CT, put it first; otherwise use default ordering
                    const ctSeriesTop = userSelectedPrimaryCT && allPlanningCTs.some(ct => ct.id === userSelectedPrimaryCT)
                      ? [
                          allPlanningCTs.find(ct => ct.id === userSelectedPrimaryCT)!,
                          ...allPlanningCTs.filter(ct => ct.id !== userSelectedPrimaryCT)
                        ]
                      : allPlanningCTs;
                    
                    // Determine if we have multiple planning CTs (show star icons)
                    const hasMultiplePlanningCTs = allPlanningCTs.length > 1;
                    
                    // When user has selected a primary, show only that one at top level
                    // The other CTs will be nested as secondaries under it
                    const displayedPrimaryCTs = userSelectedPrimaryCT && hasMultiplePlanningCTs
                      ? ctSeriesTop.slice(0, 1)  // Only show the user-selected primary (first in reordered list)
                      : ctSeriesTop;             // Default: show all planning CTs
                    
                    // CTs that should appear as nested secondaries (when user has selected a primary)
                    const nestedSecondaryCTs = userSelectedPrimaryCT && hasMultiplePlanningCTs
                      ? ctSeriesTop.slice(1)     // All CTs except the primary
                      : [];

                    // Determine primary list: if any planning CTs exist, show them; otherwise fallback to MR/PT/other
                    const primarySeries = displayedPrimaryCTs.length > 0
                      ? displayedPrimaryCTs
                      : (mrSeries.length > 0 ? mrSeries : (ptSeries.length > 0 ? ptSeries : otherSeries));

                    return (
                      <>
                        {/* Primary Series (CT, MR, PT, or others) */}
                        {primarySeries.map((seriesItem) => {
                          const candidateIds = getCandidatesForPrimary(seriesItem.id);
                          const candidateSet = new Set<number>(candidateIds);
                          const candidateSetWithPrimary = new Set<number>(candidateSet);
                          candidateSetWithPrimary.add(seriesItem.id);

                          const perPrimarySiblingMap = fusionSiblingMap?.get(seriesItem.id);
                          const petMapForPrimary = perPrimarySiblingMap?.get('PET');
                          const mrMapForPrimary = perPrimarySiblingMap?.get('MR');

                          const ctIdsLinkedToPet = new Set<number>();
                          petMapForPrimary?.forEach((ctList) => {
                            ctList.forEach((ctId) => {
                              if (Number.isFinite(ctId)) ctIdsLinkedToPet.add(ctId);
                            });
                          });

                          const explicitMrAssoc = mrSeries.filter((s) => candidateSet.has(s.id));
                          const mrAssoc = explicitMrAssoc.length > 0 ? explicitMrAssoc : mrSeries;

                          let ptAssoc: DICOMSeries[] = [];
                          if (petMapForPrimary && petMapForPrimary.size) {
                            ptAssoc = Array.from(petMapForPrimary.keys())
                              .map((petId) => seriesById.get(petId))
                              .filter((entry): entry is DICOMSeries => Boolean(entry));
                          }
                          if (!ptAssoc.length) {
                            const explicitPtAssoc = ptSeries.filter((s) => candidateSet.has(s.id));
                            ptAssoc = explicitPtAssoc.length > 0 ? explicitPtAssoc : ptSeries;
                          }

                          const additionalMrAssoc: DICOMSeries[] = [];
                          if (mrMapForPrimary && mrMapForPrimary.size) {
                            mrMapForPrimary.forEach((linkedIds, mrId) => {
                              const mrEntry = seriesById.get(mrId);
                              if (mrEntry && !additionalMrAssoc.includes(mrEntry)) {
                                additionalMrAssoc.push(mrEntry);
                              }
                              linkedIds.forEach((linkedId) => {
                                const linkedEntry = seriesById.get(linkedId);
                                if (
                                  linkedEntry &&
                                  linkedEntry.modality &&
                                  (linkedEntry.modality.toUpperCase() === 'MR' || linkedEntry.modality.toUpperCase() === 'PT' || linkedEntry.modality.toUpperCase() === 'PET') &&
                                  !additionalMrAssoc.includes(linkedEntry)
                                ) {
                                  additionalMrAssoc.push(linkedEntry);
                                }
                              });
                            });
                          }

                          const fusionReadyMr = Array.from(new Map([...mrAssoc, ...additionalMrAssoc].map((entry) => [entry.id, entry])).values());

                          const ctCandidatesForPet = series.filter(
                            (s) => modalityOf(s) === 'CT' && candidateSetWithPrimary.has(s.id),
                          );

                          const hasExplicitPetCandidates = Boolean(petMapForPrimary && petMapForPrimary.size);

                          const registeredCtAssocFromReg = series.filter((s) => {
                            if (modalityOf(s) !== 'CT') return false;
                            if (!candidateSet.has(s.id)) return false;
                            if (ctIdsLinkedToPet.has(s.id)) return false;
                            if (ptAssoc.length && ptAssoc.some((pet) => Number(pet.studyId) === Number(s.studyId))) return false;
                            return true;
                          });
                          
                          // Combine registration-derived CTs with user-demoted planning CTs
                          // nestedSecondaryCTs are planning CTs that were moved under the user-selected primary
                          const nestedSecondaryCtIds = new Set(nestedSecondaryCTs.map(ct => ct.id));
                          const registeredCtAssoc = [
                            // First: show nestedSecondaryCTs (user-demoted planning CTs)
                            ...nestedSecondaryCTs.filter(ct => ct.id !== seriesItem.id),
                            // Then: show registration-derived CTs (excluding those already in nestedSecondaryCTs)
                            ...registeredCtAssocFromReg.filter(ct => !nestedSecondaryCtIds.has(ct.id))
                          ];
                          return (
                            <div key={seriesItem.id} className="space-y-1">
                            {/* Primary Series Card */}
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('seriesId', seriesItem.id.toString());
                                e.dataTransfer.effectAllowed = 'copy';
                              }}
                              className={`
                                group relative py-1.5 px-2 min-h-9 rounded-lg border cursor-pointer transition-all duration-150
                                ${selectedSeries?.id === seriesItem.id
                                  ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-400/50 shadow-sm shadow-blue-500/10'
                                  : hoveredRegSeries && (ctSeriesTop.length > 0 || mrSeries.length > 0 || ptSeries.length > 0)
                                  ? 'bg-gradient-to-r from-green-500/15 to-green-600/10 border-green-400/40'
                                  : 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-800/50 hover:border-gray-600/40'
                                }
                              `}
                              onClick={() => onSeriesSelect(seriesItem)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Badge 
                                    className={cn("flex-shrink-0", pillClassForModality(seriesItem.modality))}
                                  >
                                    {seriesItem.modality}
                                    {modalityOf(seriesItem) === 'CT' && ctSeriesTop.length > 0 && seriesItem.id === ctSeriesTop[0].id ? ' • Planning' : ''}
                                  </Badge>
                                  <span className={`
                                    text-xs font-medium truncate
                                    ${selectedSeries?.id === seriesItem.id ? 'text-blue-100' : 'text-gray-200'}
                                    group-hover:text-white transition-colors
                                  `}>
                                    {formatSeriesLabel(seriesItem)}
                                  </span>
                                  <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                                    {seriesItem.imageCount}
                                  </span>
                                </div>
                                
                                {selectedSeries?.id === seriesItem.id && (
                                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                )}
                                
                                {/* Star icon for switching primary CT - only show when multiple planning CTs exist */}
                                {hasMultiplePlanningCTs && modalityOf(seriesItem) === 'CT' && (
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className={cn(
                                            "flex-shrink-0 p-1 rounded transition-all duration-150",
                                            userSelectedPrimaryCT === seriesItem.id
                                              ? "text-yellow-400 hover:text-yellow-300"
                                              : "text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Toggle: if already primary, clear selection (back to default)
                                            if (userSelectedPrimaryCT === seriesItem.id) {
                                              setUserSelectedPrimaryCT(null);
                                            } else {
                                              setUserSelectedPrimaryCT(seriesItem.id);
                                            }
                                          }}
                                        >
                                          <Star 
                                            className="h-3.5 w-3.5" 
                                            fill={userSelectedPrimaryCT === seriesItem.id ? "currentColor" : "none"}
                                          />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="bg-gray-800 border-gray-700 text-white text-xs">
                                        <p>
                                          {userSelectedPrimaryCT === seriesItem.id
                                            ? "Current primary CT - click to reset"
                                            : "Set as primary CT (reorganize hierarchy)"
                                          }
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                {formatSeriesLabel(seriesItem)} ({seriesItem.imageCount} images)
                              </div>
                            </div>

                            {/* Nested Series - Secondary/Fusion Options */}
                            <div className="ml-3 space-y-2">
                              {/* RT Structure Series nested under CT - FIRST, show those that reference this primary CT */}
                              {rtSeries && rtSeries.length > 0 && rtSeries.filter((rtS: any) => {
                                const isMatch = rtS.referencedSeriesId === seriesItem.id || (!rtS.referencedSeriesId && rtSeries.length === 1);
                                return isMatch;
                              }).length > 0 && (
                                <div className="space-y-2 border-l-2 border-green-500/40 pl-2">
                                  {rtSeries.filter((rtS: any) => 
                                    rtS.referencedSeriesId === seriesItem.id || (!rtS.referencedSeriesId && rtSeries.length === 1)
                                  ).map((rtS: any) => (
                                    <Button
                                      key={rtS.id}
                                      variant="ghost"
                                      className={cn(
                                        "group w-full px-2 py-1.5 min-h-9 text-left justify-between text-xs leading-3 rounded-lg transition-all duration-150 border backdrop-blur-sm",
                                        selectedRTSeries?.id === rtS.id 
                                          ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-400/60 shadow-md shadow-green-500/20 text-gray-200' 
                                          : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30 text-gray-300'
                                      )}
                                      onClick={() => handleRTSeriesSelect(rtS)}
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Badge className={cn("flex-shrink-0", pillClassForModality('RT'))}>
                                          RT
                                        </Badge>
                                        <span className={cn(
                                          "truncate text-xs leading-tight",
                                          selectedRTSeries?.id === rtS.id ? "text-green-200" : "text-gray-300"
                                        )}>
                                          {rtS.seriesDescription || 'Structure Set'}
                                        </span>
                                      </div>
                                      
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className={`flex-shrink-0 transition-colors p-1 ${
                                              seriesHistoryStatus.get(rtS.id)
                                                ? 'text-blue-400 hover:text-blue-300 cursor-pointer'
                                                : 'text-gray-600 cursor-not-allowed'
                                            }`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (seriesHistoryStatus.get(rtS.id)) {
                                                setHistorySeriesId(rtS.id);
                                                setShowHistoryModal(true);
                                              }
                                            }}
                                          >
                                            <History className="h-3.5 w-3.5" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{seriesHistoryStatus.get(rtS.id) ? 'View History' : 'No history available'}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </Button>
                                  ))}
                                </div>
                              )}
                              
                              {/* Registered CT secondaries (REG-derived only; PET/CT CTs are shown under PET) */}
                              {(() => {
                                if (registeredCtAssoc.length === 0) return null;
                                return (
                                  <div className="space-y-2 border-l-2 border-blue-500/40 pl-2">
                                    <div className="text-[10px] text-blue-300/80 uppercase tracking-wider font-semibold px-1 pb-0.5">Registered CT</div>
                                    {registeredCtAssoc.map((ctS) => {
                                      const loadingState = secondaryLoadingStates?.get(ctS.id);
                                      const fusionStatus = fusionStatuses?.get(ctS.id);
                                      const isLoading = Boolean(loadingState?.isLoading || fusionStatus?.status === 'loading');
                                      const isReady = fusionStatus?.status === 'ready';
                                      const hasError = fusionStatus?.status === 'error';
                                      const progress = Math.max(0, Math.min(100, loadingState?.progress ?? 0));
                                      const statusLabel = hasError
                                        ? `Fusion failed${fusionStatus?.error ? `: ${fusionStatus.error}` : ''}`
                                        : isLoading
                                          ? `Preparing overlay${progress ? ` (${Math.round(progress)}%)` : ''}`
                                          : isReady
                                            ? 'Activate fusion overlay'
                                            : 'Fusion overlay unavailable';
                                      const buttonDisabled = !isReady;

                                      return (
                                        <div key={ctS.id} className="space-y-1">
                                          <div
                                            className={cn(
                                              "group relative overflow-hidden w-full py-1.5 px-2 min-h-9 rounded-lg transition-all duration-150 border text-left text-xs cursor-pointer backdrop-blur-sm",
                                              secondarySeriesId === ctS.id
                                                ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-400/60 shadow-md shadow-blue-500/20'
                                                : hasError
                                                  ? 'bg-amber-900/15 border-amber-500/30'
                                                  : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                            )}
                                            onClick={() => {
                                              if (onSecondarySeriesSelect) onSecondarySeriesSelect(ctS.id);
                                            }}
                                          >
                                            {isLoading && (
                                              <div
                                                className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-cyan-400/10 transition-all duration-300"
                                                style={{ width: `${progress}%` }}
                                              />
                                            )}
                                            <div className="relative z-10 flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <Badge variant="outline" className={cn(
                                                  "flex-shrink-0",
                                                  pillClassForModality('CT')
                                                )}>CT</Badge>
                                                {/*
                                                  Multi-viewport mode: we show the active viewport (VP #) in the right-side action slot
                                                  instead of duplicating it inline here.
                                                */}
                                                <span className={cn(
                                                  "truncate text-xs font-medium",
                                                  (isInSplitView ? Boolean(getViewportForSeries(ctS.id)) : secondarySeriesId === ctS.id) ? "text-blue-100" : "text-gray-200"
                                                )}>
                                                  {formatSeriesLabel(ctS)}
                                                </span>
                                                <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                                                  {ctS.imageCount}
                                                </span>
                                              </div>
                                              
                                            {onSecondarySeriesSelect && (
                                              <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    {(() => {
                                                      const assignedVp = isInSplitView ? getViewportForSeries(ctS.id) : null;
                                                      const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === ctS.id;

                                                      // Multi-viewport: show VP assignment instead of a pulsing "active fusion" icon.
                                                      if (isInSplitView && assignedVp) {
                                                        return (
                                                          <span className={cn(pillClass('blue'), "h-7 px-2.5 flex-shrink-0")}>
                                                            VP {assignedVp}
                                                          </span>
                                                        );
                                                      }

                                                      // Single viewport: keep a clear active-state toggle.
                                                      if (isActiveFusion) {
                                                        return (
                                                          <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 flex-shrink-0 bg-blue-600 hover:bg-blue-700 animate-pulse"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              if (onSecondarySeriesSelect) {
                                                                onSecondarySeriesSelect(null);
                                                              }
                                                            }}
                                                          >
                                                            <Zap className="h-3.5 w-3.5 text-white" />
                                                          </Button>
                                                        );
                                                      }

                                                      return (
                                                        <Button
                                                          size="icon"
                                                          variant="ghost"
                                                          className={`h-7 w-7 flex-shrink-0 ${isLoading ? 'cursor-wait' : hasError ? 'hover:bg-amber-700/30' : 'hover:bg-blue-700/30'}`}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Only rebuild manifest if not ready yet
                                                            if (!isReady && onRebuildFusionManifest) {
                                                              onRebuildFusionManifest();
                                                            }
                                                            onSecondarySeriesSelect(ctS.id);
                                                          }}
                                                          disabled={false}
                                                        >
                                                          {isLoading ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-200" />
                                                          ) : hasError ? (
                                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                                                          ) : (
                                                            <Zap className="h-3.5 w-3.5 text-blue-300" />
                                                          )}
                                                        </Button>
                                                      );
                                                    })()}
                                                  </TooltipTrigger>
                                                  <TooltipContent className="bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg shadow-lg">
                                                    {(() => {
                                                      const assignedVp = isInSplitView ? getViewportForSeries(ctS.id) : null;
                                                      const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === ctS.id;
                                                      const message = isInSplitView && assignedVp
                                                        ? `Assigned to VP ${assignedVp}`
                                                        : (isActiveFusion ? 'Fusion Active - Click to disable' : (isReady ? statusLabel : 'Click to initialize fusion'));
                                                      return <p className="font-medium">{message}</p>;
                                                    })()}
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            )}
                                          </div>
                                        </div>
                                        {/* RT Structure nested under this secondary CT */}
                                        {rtSeries && rtSeries.filter((rtS: any) => rtS.referencedSeriesId === ctS.id).length > 0 && (
                                          <div className="ml-3 space-y-1 border-l-2 border-green-500/30 pl-2 mt-1">
                                            {rtSeries.filter((rtS: any) => rtS.referencedSeriesId === ctS.id).map((rtS: any) => (
                                              <Button
                                                key={rtS.id}
                                                variant="ghost"
                                                className={cn(
                                                  "group w-full px-2 py-1 min-h-7 text-left justify-between text-xs leading-3 rounded-lg transition-all duration-150 border backdrop-blur-sm",
                                                  selectedRTSeries?.id === rtS.id 
                                                    ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-400/60 shadow-md shadow-green-500/20 text-gray-200' 
                                                    : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30 text-gray-300'
                                                )}
                                                onClick={() => handleRTSeriesSelect(rtS)}
                                              >
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                  <Badge className={cn("flex-shrink-0 text-[10px] px-1.5", pillClassForModality('RT'))}>
                                                    RT
                                                  </Badge>
                                                  <span className={cn(
                                                    "truncate text-[11px] leading-tight",
                                                    selectedRTSeries?.id === rtS.id ? "text-green-200" : "text-gray-300"
                                                  )}>
                                                    {rtS.seriesDescription || 'Structure Set'}
                                                  </span>
                                                </div>
                                              </Button>
                                            ))}
                                          </div>
                                        )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              
                              {/* Registration and MR Series that can be fused (REG-preferred; fallback: all MR) */}
                              {(() => {
                                if (fusionReadyMr.length === 0) return null;
                                return (
                                 <div className="space-y-2 border-l-2 border-purple-500/40 pl-2 mt-1">
                                   <div className="text-[10px] text-purple-300 mb-1 uppercase tracking-wider flex items-center gap-1">
                                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                     </svg>
                                     Fusion-Ready MRI (Registered)
                                   </div>
                                   
                                   {/* MR Series that can be fused */}
                                   {fusionReadyMr.map((mrS) => {
                                     const loadingState = secondaryLoadingStates?.get(mrS.id);
                                     const isCurrentlyLoading = currentlyLoadingSecondary === mrS.id;
                                     const progress = Math.max(0, Math.min(100, loadingState?.progress ?? 0));
                                     const fusionStatus = fusionStatuses?.get(mrS.id);
                                     const isReady = fusionStatus?.status === 'ready';
                                     const hasError = fusionStatus?.status === 'error';
                                     const isLoading = Boolean(loadingState?.isLoading || isCurrentlyLoading || fusionStatus?.status === 'loading');
                                     const statusLabel = hasError
                                       ? `Fusion failed${fusionStatus?.error ? `: ${fusionStatus.error}` : ''}`
                                       : isLoading
                                         ? `Preparing overlay${progress ? ` (${Math.round(progress)}%)` : ''}`
                                         : isReady
                                           ? 'Enable fusion overlay'
                                           : 'Fusion overlay unavailable';

                                     return (
                                      <div key={mrS.id} className="space-y-1">
                                        {/* Secondary MR Series Card */}
                                        <div
                                          className={cn(
                                            "group relative overflow-hidden w-full py-1.5 px-2 min-h-9 rounded-lg transition-all duration-150 border text-left text-xs cursor-pointer backdrop-blur-sm",
                                            secondarySeriesId === mrS.id
                                              ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/10 border-purple-400/60 shadow-md shadow-purple-500/20'
                                              : selectedSeries?.id === mrS.id
                                              ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/10 border-purple-400/60 shadow-md shadow-purple-500/20'
                                              : hoveredRegSeries
                                              ? 'bg-gradient-to-br from-green-500/15 via-green-500/8 to-green-600/12 border-green-400/50 shadow-sm shadow-green-500/15'
                                              : hasError
                                              ? 'bg-amber-900/15 border-amber-500/30'
                                              : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                          )}
                                          onClick={() => {
                                            if (!isReady) return;
                                            if (onSecondarySeriesSelect) onSecondarySeriesSelect(mrS.id);
                                          }}
                                        >
                                          {/* Loading progress background */}
                                          {isLoading && (
                                            <div 
                                              className="absolute inset-0 bg-gradient-to-r from-green-500/40 to-green-500/10 transition-all duration-300"
                                              style={{ width: `${progress}%` }}
                                            />
                                          )}
                                          
                                          <div className="relative z-10 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <Badge variant="outline" className={cn(
                                                "flex-shrink-0",
                                                pillClassForModality('MR')
                                              )}>
                                                MR
                                              </Badge>
                                              {/*
                                                Multi-viewport mode: we show the active viewport (VP #) in the right-side action slot
                                                instead of duplicating it inline here.
                                              */}
                                              <span className={cn(
                                                "truncate text-xs font-medium",
                                                ((isInSplitView ? Boolean(getViewportForSeries(mrS.id)) : secondarySeriesId === mrS.id) || selectedSeries?.id === mrS.id)
                                                  ? "text-purple-100"
                                                  : "text-gray-200"
                                              )}>
                                                {formatSeriesLabel(mrS)}
                                              </span>
                                              <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                                                {mrS.imageCount}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      className="h-6 w-6 hover:bg-purple-700/30"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openSeriesPreview(mrS);
                                                      }}
                                                    >
                                                      <Maximize2 className="h-3.5 w-3.5 text-purple-300" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent className="bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 text-white text-xs rounded-lg shadow-lg">
                                                    <p>Quick Preview</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                              <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    {(() => {
                                                      const assignedVp = isInSplitView ? getViewportForSeries(mrS.id) : null;
                                                      const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === mrS.id;

                                                      if (isInSplitView && assignedVp) {
                                                        return (
                                                          <span className={cn(pillClass('blue'), "h-6 px-2.5 flex-shrink-0")}>
                                                            VP {assignedVp}
                                                          </span>
                                                        );
                                                      }

                                                      if (isActiveFusion) {
                                                        return (
                                                          <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6 bg-blue-600 hover:bg-blue-700 animate-pulse"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              if (onSecondarySeriesSelect) {
                                                                onSecondarySeriesSelect(null);
                                                              }
                                                            }}
                                                          >
                                                            <Zap className="h-3.5 w-3.5 text-white" />
                                                          </Button>
                                                        );
                                                      }

                                                      return (
                                                        <Button
                                                          size="icon"
                                                          variant="ghost"
                                                          className={`h-6 w-6 ${isLoading ? 'cursor-wait' : hasError ? 'hover:bg-amber-700/30' : 'hover:bg-blue-700/30'}`}
                                                          disabled={false}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!isReady && onRebuildFusionManifest) {
                                                              onRebuildFusionManifest();
                                                            }
                                                            if (onSecondarySeriesSelect) {
                                                              onSecondarySeriesSelect(mrS.id);
                                                            }
                                                          }}
                                                        >
                                                          {isLoading ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-200" />
                                                          ) : hasError ? (
                                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                                                          ) : (
                                                            <Zap className="h-3.5 w-3.5 text-blue-300" />
                                                          )}
                                                        </Button>
                                                      );
                                                    })()}
                                                  </TooltipTrigger>
                                                  <TooltipContent className="bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg shadow-lg">
                                                    {(() => {
                                                      const assignedVp = isInSplitView ? getViewportForSeries(mrS.id) : null;
                                                      const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === mrS.id;
                                                      if (isInSplitView && assignedVp) {
                                                        return <p className="font-medium">Assigned to VP {assignedVp}</p>;
                                                      }
                                                      return (
                                                        <>
                                                          <p className="font-medium">{isActiveFusion ? 'Fusion Active - Click to disable' : statusLabel}</p>
                                                          {isLoading && <p className="text-[10px] opacity-80">Preparing fused MRI…</p>}
                                                        </>
                                                      );
                                                    })()}
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </div>
                                          </div>
                                        </div>

                                        {/* RT Structure Series nested below */}
                                        {rtSeries && rtSeries.length > 0 && rtSeries
                                          .filter((rtS: any) => rtS.referencedSeriesId === mrS.id)
                                          .map((rtS: any) => (
                                            <div key={rtS.id} className="pl-3">
                                              <Button
                                                variant={selectedRTSeries?.id === rtS.id ? "default" : "ghost"}
                                                className={cn(
                                                  "group w-full px-2 py-1.5 h-auto text-left justify-start text-xs leading-3 border rounded-lg transition-all duration-150 backdrop-blur-sm",
                                                  selectedRTSeries?.id === rtS.id 
                                                    ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-400/60 shadow-md shadow-green-500/20 text-gray-200' 
                                                    : 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-800/50 hover:border-gray-600/40 text-gray-300'
                                                )}
                                                onClick={() => handleRTSeriesSelect(rtS)}
                                              >
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                  <Badge variant="outline" className={cn(
                                                    "text-xs font-semibold px-2 py-0.5 flex-shrink-0",
                                                    selectedRTSeries?.id === rtS.id
                                                      ? "border-green-400/80 text-green-300 bg-green-500/20"
                                                      : "border-green-500/60 text-green-400 bg-green-500/10"
                                                  )}>
                                                    RT
                                                  </Badge>
                                                  <span className={cn(
                                                    "truncate text-xs",
                                                    selectedRTSeries?.id === rtS.id ? "text-green-200" : "text-gray-300"
                                                  )}>
                                                    {rtS.seriesDescription || 'Structure Set'}
                                                  </span>
                                                </div>
                                              </Button>
                                            </div>
                                          ))
                                        }
                                      </div>
                                   );
                                   })}
                                 </div>
                                );
                              })()}
                              
                              {/* PET Series that can be fused with CT (REG preferred; fallback: all PET for patient) */}
                              {(() => {
                                if (ptAssoc.length === 0) return null;
                                return (
                                  <div className="space-y-2 border-l-2 border-yellow-500/40 pl-2">
                                    <div className="text-xs text-yellow-300 mb-1 font-semibold uppercase tracking-wider flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      PET/CT Fusion
                                    </div>
                                    
                                    {/* PT + Related CT cards as siblings */}
                                   {ptAssoc.flatMap((ptS) => {
                                     const ptStudyIdNumber = Number(ptS?.studyId);
                                     let ctSiblings: DICOMSeries[] = [];

                                     const linkedCtIds = petMapForPrimary?.get(ptS.id) ?? null;
                                     if (linkedCtIds && linkedCtIds.length) {
                                       ctSiblings = linkedCtIds
                                         .map((ctId) => (Number.isFinite(ctId) ? seriesById.get(Number(ctId)) : undefined))
                                         .filter((entry): entry is DICOMSeries => Boolean(entry))
                                         .filter((ctEntry) => ctEntry.id !== seriesItem.id);
                                     }

                                     if (!ctSiblings.length) {
                                       ctSiblings = series.filter((ctCandidate) => {
                                         if (modalityOf(ctCandidate) !== 'CT') return false;
                                         if (ctCandidate.id === seriesItem.id) return false;
                                         const ctStudyIdNumber = Number(ctCandidate?.studyId);
                                         if (!Number.isFinite(ptStudyIdNumber) || !Number.isFinite(ctStudyIdNumber)) {
                                           return false;
                                         }
                                         if (ctStudyIdNumber !== ptStudyIdNumber) return false;
                                         if (petMapForPrimary && petMapForPrimary.size && !candidateSetWithPrimary.has(ctCandidate.id)) {
                                           return false;
                                         }
                                         return true;
                                       });
                                     }
                                     const loadingState = secondaryLoadingStates?.get(ptS.id);
                                     const isCurrentlyLoading = currentlyLoadingSecondary === ptS.id;
                                     const fusionStatus = fusionStatuses?.get(ptS.id);
                                     const progress = Math.max(0, Math.min(100, loadingState?.progress ?? 0));
                                     const isLoading = Boolean(loadingState?.isLoading || isCurrentlyLoading || fusionStatus?.status === 'loading');
                                     const isReady = fusionStatus?.status === 'ready';
                                     const hasError = fusionStatus?.status === 'error';
                                     const statusLabel = hasError
                                       ? `Fusion failed${fusionStatus?.error ? `: ${fusionStatus.error}` : ''}`
                                       : isLoading
                                         ? (progress ? `Preparing overlay (${Math.round(progress)}%)` : 'Preparing overlay')
                                         : isReady
                                           ? 'Enable PET fusion'
                                           : 'Fusion overlay unavailable';

                                      const petCard = (
                                      <div
                                        key={`pt-${ptS.id}`}
                                        className={cn(
                                          "group relative overflow-hidden w-full py-1.5 px-2 min-h-9 rounded-lg transition-all duration-150 border text-left text-xs cursor-pointer backdrop-blur-sm",
                                          secondarySeriesId === ptS.id
                                            ? 'bg-gradient-to-br from-yellow-500/25 via-yellow-500/15 to-yellow-600/20 border-yellow-400/60 shadow-md shadow-yellow-500/20'
                                            : selectedSeries?.id === ptS.id
                                            ? 'bg-gradient-to-br from-yellow-500/25 via-yellow-500/15 to-yellow-600/20 border-yellow-400/60 shadow-md shadow-yellow-500/20'
                                            : hasError
                                            ? 'bg-amber-900/15 border-amber-500/30'
                                            : hoveredRegSeries
                                            ? 'bg-gradient-to-br from-green-500/15 via-green-500/8 to-green-600/12 border-green-400/50 shadow-sm shadow-green-500/15'
                                            : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                        )}
                                        onClick={() => {
                                          if (!isReady) return;
                                          if (onSecondarySeriesSelect) onSecondarySeriesSelect(ptS.id);
                                        }}
                                      >
                                        {/* Loading progress background */}
                                        {isLoading && (
                                          <div 
                                            className="absolute inset-0 bg-gradient-to-r from-yellow-500/40 to-yellow-500/10 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                          />
                                        )}
                                        
                                        <div className="relative z-10 flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <Badge variant="outline" className={cn(
                                              "flex-shrink-0",
                                              pillClassForModality('PT')
                                            )}>PT</Badge>
                                            {/*
                                              Multi-viewport mode: we show the active viewport (VP #) in the right-side fusion slot
                                              instead of duplicating it inline here.
                                            */}
                                            <span className={cn(
                                              "truncate text-xs font-medium",
                                              ((isInSplitView ? Boolean(getViewportForSeries(ptS.id)) : secondarySeriesId === ptS.id) || selectedSeries?.id === ptS.id)
                                                ? "text-yellow-100"
                                                : "text-gray-200"
                                            )}>{formatSeriesLabel(ptS)}</span>
                                            <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                                              {ptS.imageCount}
                                            </span>
                                          </div>
                                           <div className="flex items-center gap-1">
                                             <TooltipProvider delayDuration={0}>
                                               <Tooltip>
                                                 <TooltipTrigger asChild>
                                                   <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-yellow-700/30"
                                                     onClick={(e) => { e.stopPropagation(); openSeriesPreview(ptS); }}
                                                   >
                                                     <Maximize2 className="h-3.5 w-3.5 text-yellow-300" />
                                                   </Button>
                                                 </TooltipTrigger>
                                                 <TooltipContent className="bg-gradient-to-br from-yellow-600/95 via-yellow-500/95 to-yellow-600/95 border border-yellow-400/30 text-white text-xs rounded-lg shadow-lg">
                                                   <p>Quick Preview</p>
                                                 </TooltipContent>
                                               </Tooltip>
                                             </TooltipProvider>
                                             <TooltipProvider delayDuration={0}>
                                               <Tooltip>
                                                 <TooltipTrigger asChild>
                                                   {(() => {
                                                     const assignedVp = isInSplitView ? getViewportForSeries(ptS.id) : null;
                                                     const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === ptS.id;

                                                     if (isInSplitView && assignedVp) {
                                                       return (
                                                         <span className={cn(pillClass('blue'), "h-6 px-2.5 flex-shrink-0")}>
                                                           VP {assignedVp}
                                                         </span>
                                                       );
                                                     }

                                                     if (isActiveFusion) {
                                                       return (
                                                         <Button
                                                           size="icon"
                                                           variant="ghost"
                                                           className="h-6 w-6 bg-blue-600 hover:bg-blue-700 animate-pulse"
                                                           onClick={(e) => { e.stopPropagation(); if (onSecondarySeriesSelect) onSecondarySeriesSelect(null); }}
                                                         >
                                                           <Zap className="h-3.5 w-3.5 text-white" />
                                                         </Button>
                                                       );
                                                     }

                                                     return (
                                                       <Button
                                                         size="icon"
                                                         variant="ghost"
                                                         className={`h-6 w-6 ${isLoading ? 'cursor-wait' : hasError ? 'hover:bg-amber-700/30' : 'hover:bg-blue-700/30'}`}
                                                         disabled={false}
                                                         onClick={(e) => {
                                                           e.stopPropagation();
                                                           // Only rebuild manifest if not ready yet
                                                           if (!isReady && onRebuildFusionManifest) {
                                                             onRebuildFusionManifest();
                                                           }
                                                           if (onSecondarySeriesSelect) onSecondarySeriesSelect(ptS.id);
                                                         }}
                                                       >
                                                         {isLoading ? (
                                                           <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-200" />
                                                         ) : hasError ? (
                                                           <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                                                         ) : (
                                                           <Zap className="h-3.5 w-3.5 text-blue-300" />
                                                         )}
                                                       </Button>
                                                     );
                                                   })()}
                                                 </TooltipTrigger>
                                                 <TooltipContent className="bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg shadow-lg">
                                                   {(() => {
                                                     const assignedVp = isInSplitView ? getViewportForSeries(ptS.id) : null;
                                                     const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === ptS.id;
                                                     if (isInSplitView && assignedVp) {
                                                       return <p className="font-medium">Assigned to VP {assignedVp}</p>;
                                                     }
                                                     return (
                                                       <>
                                                         <p className="font-medium">{isActiveFusion ? 'Disable fusion' : statusLabel}</p>
                                                         {isLoading ? (
                                                           <p className="text-[10px] opacity-80">Preparing fused PET…</p>
                                                         ) : isReady ? (
                                                           <p className="text-[10px] opacity-80">Projects PET signals onto the planning CT</p>
                                                         ) : null}
                                                       </>
                                                     );
                                                   })()}
                                                 </TooltipContent>
                                               </Tooltip>
                                             </TooltipProvider>
                                           </div>
                                         </div>
                                       </div>
                                     );

                                     const ctCards = ctSiblings.map((ctS) => {
                                       const rtForCt = (rtSeries || []).filter((rtS: any) => rtS.referencedSeriesId === ctS.id);
                                       const loadingState = secondaryLoadingStates?.get(ctS.id);
                                       const isCurrentlyLoading = currentlyLoadingSecondary === ctS.id;
                                       const progress = Math.max(0, Math.min(100, loadingState?.progress ?? 0));
                                       const fusionStatusCt = fusionStatuses?.get(ctS.id);
                                       const isReadyCt = fusionStatusCt?.status === 'ready';
                                       const hasErrorCt = fusionStatusCt?.status === 'error';
                                       const isLoadingCt = Boolean(loadingState?.isLoading || isCurrentlyLoading || fusionStatusCt?.status === 'loading');
                                       const statusLabelCt = hasErrorCt
                                         ? `Fusion failed${fusionStatusCt?.error ? `: ${fusionStatusCt.error}` : ''}`
                                         : isLoadingCt
                                           ? (progress ? `Preparing overlay (${Math.round(progress)}%)` : 'Preparing overlay')
                                           : isReadyCt
                                             ? 'Activate fusion overlay'
                                             : 'Fusion overlay unavailable';

                                      return (
                                        <div key={`ptct-${ptS.id}-${ctS.id}`} className="space-y-1">
                                          {/* Secondary CT Series Card */}
                                          <div
                                            className={cn(
                                              "group relative overflow-hidden w-full py-1.5 px-2 min-h-9 rounded-lg transition-all duration-150 border text-left text-xs cursor-pointer backdrop-blur-sm",
                                              secondarySeriesId === ctS.id
                                                ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-400/60 shadow-md shadow-blue-500/20'
                                                : selectedSeries?.id === ctS.id
                                                  ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-400/60 shadow-md shadow-blue-500/20'
                                                  : hasErrorCt
                                                    ? 'bg-amber-900/15 border-amber-500/30'
                                                    : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                            )}
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               if (!isReadyCt) return;
                                               if (onSecondarySeriesSelect) onSecondarySeriesSelect(ctS.id);
                                             }}
                                           >
                                             {isLoadingCt && (
                                               <div
                                                 className="absolute inset-0 bg-gradient-to-r from-blue-500/40 to-blue-500/10 transition-all duration-300"
                                                 style={{ width: `${progress}%` }}
                                               />
                                             )}

                                             <div className="relative z-10 flex items-center justify-between gap-2">
                                               <div className="flex items-center gap-2 flex-1 min-w-0">
                                                 <Badge variant="outline" className={cn(
                                                  "flex-shrink-0",
                                                  pillClassForModality('CT')
                                                 )}>CT</Badge>
                                                <span className={cn(
                                                  "truncate text-xs font-medium",
                                                  ((isInSplitView ? Boolean(getViewportForSeries(ctS.id)) : secondarySeriesId === ctS.id) || selectedSeries?.id === ctS.id)
                                                    ? "text-blue-100"
                                                    : "text-gray-200"
                                                )}>{formatSeriesLabel(ctS)}</span>
                                              <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                                                 {ctS.imageCount}
                                                </span>
                                               </div>
                                               <div className="flex items-center gap-1">
                                                 <TooltipProvider delayDuration={0}>
                                                   <Tooltip>
                                                     <TooltipTrigger asChild>
                                                       <Button
                                                         size="icon"
                                                         variant="ghost"
                                                         className="h-6 w-6 hover:bg-blue-700/30"
                                                         onClick={(e) => {
                                                           e.stopPropagation();
                                                           openSeriesPreview(ctS);
                                                         }}
                                                       >
                                                         <Maximize2 className="h-3.5 w-3.5 text-blue-300" />
                                                       </Button>
                                                     </TooltipTrigger>
                                                     <TooltipContent className="bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg shadow-lg">
                                                       <p>Quick Preview</p>
                                                     </TooltipContent>
                                                   </Tooltip>
                                                 </TooltipProvider>
                                                <TooltipProvider delayDuration={0}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      {(() => {
                                                        const assignedVp = isInSplitView ? getViewportForSeries(ctS.id) : null;
                                                        const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === ctS.id;

                                                        if (isInSplitView && assignedVp) {
                                                          return (
                                                            <span className={cn(pillClass('blue'), "h-6 px-2.5 flex-shrink-0")}>
                                                              VP {assignedVp}
                                                            </span>
                                                          );
                                                        }

                                                        if (isActiveFusion) {
                                                          return (
                                                            <Button
                                                              size="icon"
                                                              variant="ghost"
                                                              className="h-6 w-6 bg-blue-600 hover:bg-blue-700 animate-pulse"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (onSecondarySeriesSelect) onSecondarySeriesSelect(null);
                                                              }}
                                                            >
                                                              <Zap className="h-3.5 w-3.5 text-white" />
                                                            </Button>
                                                          );
                                                        }

                                                        return (
                                                          <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className={`h-6 w-6 ${isReadyCt ? 'hover:bg-blue-700/30' : 'cursor-not-allowed opacity-60'}`}
                                                            disabled={!isReadyCt}
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              if (onRebuildFusionManifest) {
                                                                onRebuildFusionManifest();
                                                              }
                                                              if (onSecondarySeriesSelect) onSecondarySeriesSelect(ctS.id);
                                                            }}
                                                          >
                                                            {isLoadingCt ? (
                                                              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-200" />
                                                            ) : hasErrorCt ? (
                                                              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                                                            ) : (
                                                              <Zap className="h-3.5 w-3.5 text-blue-300" />
                                                            )}
                                                          </Button>
                                                        );
                                                      })()}
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg shadow-lg">
                                                      {(() => {
                                                        const assignedVp = isInSplitView ? getViewportForSeries(ctS.id) : null;
                                                        const isActiveFusion = isInSplitView ? Boolean(assignedVp) : secondarySeriesId === ctS.id;
                                                        if (isInSplitView && assignedVp) {
                                                          return <p className="font-medium">Assigned to VP {assignedVp}</p>;
                                                        }
                                                        return <p className="font-medium">{isActiveFusion ? 'Disable fusion' : statusLabelCt}</p>;
                                                      })()}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                               </div>
                                             </div>
                                           </div>

                                          {/* RT Structure Series nested below */}
                                          {rtForCt.length > 0 && rtForCt.map((rtS: any) => {
                                            const hasSuperstructures = rtSeriesWithSuperstructures.has(rtS.id);
                                            return (
                                            <div key={rtS.id} className="pl-3">
                                              <Button
                                                variant={selectedRTSeries?.id === rtS.id ? 'default' : 'ghost'}
                                                className={cn(
                                                  "group w-full px-2 py-1.5 min-h-9 text-left justify-between text-xs leading-3 border rounded-lg transition-all duration-150 backdrop-blur-sm",
                                                  selectedRTSeries?.id === rtS.id
                                                    ? hasSuperstructures
                                                      ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-400/60 shadow-md shadow-blue-500/20 text-gray-200'
                                                      : 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-400/60 shadow-md shadow-green-500/20 text-gray-200'
                                                    : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30 text-gray-300'
                                                )}
                                                onClick={() => handleRTSeriesSelect(rtS)}
                                              >
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                  <Badge variant="outline" className={cn(
                                                    "flex-shrink-0",
                                                    pillClassForModality('RT')
                                                  )}>
                                                    RT
                                                  </Badge>
                                                  <span className={cn(
                                                    "truncate text-xs leading-tight",
                                                    selectedRTSeries?.id === rtS.id ? "text-green-200" : "text-gray-300"
                                                  )}>{rtS.seriesDescription || 'Structure Set'}</span>
                                                  {hasSuperstructures && (
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <Boxes className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p className="text-xs">Contains superstructures</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                </div>
                                                
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <div
                                                      className={`flex-shrink-0 transition-colors p-1 ${
                                                        seriesHistoryStatus.get(rtS.id)
                                                          ? 'text-blue-400 hover:text-blue-300 cursor-pointer'
                                                          : 'text-gray-600 cursor-not-allowed'
                                                      }`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (seriesHistoryStatus.get(rtS.id)) {
                                                          setHistorySeriesId(rtS.id);
                                                          setShowHistoryModal(true);
                                                        }
                                                      }}
                                                    >
                                                      <History className="h-3.5 w-3.5" />
                                                    </div>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <p>{seriesHistoryStatus.get(rtS.id) ? 'View History' : 'No history available'}</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </Button>
                                            </div>
                                            );
                                          })}
                                        </div>
                                      );
                                     });
                                     return [petCard, ...ctCards];
                                   })}
                                  </div>
                                );
                              })()}
                            </div>
                            </div>
                          );
                        })}
                        
                        {/* MR Series as standalone when no CT present */}
                        {ctSeriesTop.length === 0 && mrSeries.length > 0 && mrSeries.map((seriesItem) => (
                          <div key={seriesItem.id} className="space-y-1">
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('seriesId', seriesItem.id.toString());
                                e.dataTransfer.effectAllowed = 'copy';
                              }}
                              className={`
                                group relative py-1.5 px-2 min-h-9 rounded-lg border cursor-pointer transition-all duration-150
                                ${selectedSeries?.id === seriesItem.id
                                  ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/10 border-purple-400/50 shadow-sm shadow-purple-500/10'
                                  : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                }
                              `}
                              onClick={() => onSeriesSelect(seriesItem)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Badge 
                                    className={cn("flex-shrink-0", pillClassForModality(seriesItem.modality))}
                                  >
                                    {seriesItem.modality}
                                  </Badge>
                                  <span className={`
                                    text-xs font-medium truncate
                                    ${selectedSeries?.id === seriesItem.id ? 'text-purple-100' : 'text-gray-200'}
                                    group-hover:text-white transition-colors
                                  `}>
                                    {formatSeriesLabel(seriesItem)}
                                  </span>
                                  <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                                    {seriesItem.imageCount}
                                  </span>
                                </div>
                                
                                {selectedSeries?.id === seriesItem.id && (
                                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                )}
                              </div>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                {formatSeriesLabel(seriesItem)} ({seriesItem.imageCount} images)
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Other modalities grouped under collapsible dropdown */}
                        {primarySeries !== otherSeries && otherSeries.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {/* Other Series Header */}
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-800/40 to-gray-800/30 border border-gray-700/40 cursor-pointer hover:bg-gray-700/50 hover:border-gray-600/50 transition-all"
                              onClick={() => setOtherSeriesExpanded(!otherSeriesExpanded)}
                            >
                              {otherSeriesExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-xs text-gray-300 font-semibold">
                                Other Series ({otherSeries.length})
                              </span>
                            </div>
                            
                            {/* Collapsible Content */}
                            {otherSeriesExpanded && (
                              <div className="ml-3 space-y-1 pl-3 border-l-2 border-gray-700/40">
                                {otherSeries.map((seriesItem) => (
                                  <div key={seriesItem.id}>
                                    <div
                                      className={`
                                        group relative py-1 px-2 rounded-lg border cursor-pointer transition-all duration-150 backdrop-blur-sm
                                        ${selectedSeries?.id === seriesItem.id
                                          ? 'bg-gradient-to-r from-blue-500/25 to-blue-600/20 border-blue-400/60 shadow-md shadow-blue-500/20'
                                          : 'bg-gradient-to-r from-blue-500/8 to-blue-600/5 border-blue-500/30 hover:border-blue-400/50 hover:bg-blue-500/15'
                                        }
                                      `}
                                      onClick={() => onSeriesSelect(seriesItem)}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <Badge 
                                            className={cn("flex-shrink-0", pillClassForModality(seriesItem.modality))}
                                          >
                                            {seriesItem.modality}
                                          </Badge>
                                          <span className={`
                                            text-xs font-medium truncate
                                            ${selectedSeries?.id === seriesItem.id ? 'text-blue-100' : 'text-gray-200'}
                                          `}>
                                            {formatSeriesLabel(seriesItem)}
                                          </span>
                                          <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                                            {seriesItem.imageCount}
                                          </span>
                                        </div>
                                      </div>
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                        {formatSeriesLabel(seriesItem)} ({seriesItem.imageCount} images)
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Registration Series - Simple pill-shaped display */}
                        {/* Registration series are hidden from the selection list now that associations drive fusion */}
                      </>
                    );
                  })()}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Structures Section */}
            <AccordionItem value="structures" className="border-gray-800/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-800/30">
                <div className="flex items-center text-gray-100 font-medium text-sm">
                  <Palette className="w-4 h-4 mr-2 text-green-400" />
                  Structures
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 flex flex-col h-full">
                {rtStructures?.structures ? (
                  <>
                    {/* Search Bar - Fixed at top */}
                    <div className="relative mb-2 mr-1 flex-shrink-0">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                      <Input
                        placeholder="Search structures..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-600/40 text-white placeholder-gray-400 rounded-lg transition-all duration-150 focus:outline-none focus:ring-0 focus:border-blue-500/60 focus:bg-gray-800/90 hover:border-gray-500/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      />
                    </div>

                    {/* Control Buttons Row - Fixed at top */}
                    <div className="flex space-x-2 mb-4 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleAllVisibility}
                            className="bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 rounded-lg backdrop-blur-sm transition-all duration-150"
                          >
                            {allVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border-blue-400/30">
                          <p>{allVisible ? 'Hide all structures' : 'Show all structures'}</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleGrouping}
                            className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 rounded-lg backdrop-blur-sm transition-all duration-150"
                          >
                            <FolderTree className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-gradient-to-br from-yellow-600/95 via-yellow-500/95 to-yellow-600/95 border-yellow-400/30">
                          <p>{groupingEnabled ? 'Show flat list' : 'Group by L/R pairs'}</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {groupingEnabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleAllExpansion}
                              className="bg-gray-500/10 border border-gray-500/30 text-gray-400 hover:bg-gray-500/20 rounded-lg backdrop-blur-sm transition-all duration-150"
                            >
                              {allCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border-gray-400/30">
                            <p>{allCollapsed ? 'Expand all groups' : 'Collapse all groups'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Cycle through sort modes: az -> za -> position -> az
                              const nextMode = sortMode === 'az' ? 'za' : sortMode === 'za' ? 'position' : 'az';
                              setSortMode(nextMode);
                            }}
                            className="bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 rounded-lg backdrop-blur-sm transition-all duration-150 ml-auto"
                          >
                            {sortMode === 'az' ? <ArrowDown className="w-4 h-4" /> : 
                             sortMode === 'za' ? <ArrowUp className="w-4 h-4" /> : 
                             <ArrowUpDown className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-gradient-to-br from-orange-600/95 via-orange-500/95 to-orange-600/95 border-orange-400/30">
                          <p>Sort: {sortMode === 'az' ? 'A-Z' : sortMode === 'za' ? 'Z-A' : 'By Position'}</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowNewStructureDialog(true)}
                            className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-lg backdrop-blur-sm transition-all duration-150"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-gradient-to-br from-green-600/95 via-green-500/95 to-green-600/95 border-green-400/30">
                          <p>Create new structure</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowStructureSettings(!showStructureSettings)}
                            className="bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 rounded-lg backdrop-blur-sm transition-all duration-150"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border-purple-400/30">
                          <p>Structure Settings</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (selectedRTSeries) {
                                setSaveAsNewSeriesId(selectedRTSeries.id);
                                setShowSaveAsNewDialog(true);
                              }
                            }}
                            disabled={!selectedRTSeries}
                            className="bg-gray-500/10 border border-gray-500/30 text-gray-400 hover:bg-gray-500/20 rounded-lg backdrop-blur-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border-gray-400/30">
                          <p>Save As New</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Structure Settings Panel */}
                    {showStructureSettings && (
                      <div className="mb-4 p-4 backdrop-blur-md border border-purple-500/40 rounded-xl shadow-lg bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-purple-500/10 space-y-4 transition-all duration-300">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Settings className="w-4 h-4 text-purple-300" />
                            <h4 className="text-sm font-semibold text-purple-200">Global Structure Settings</h4>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowStructureSettings(false)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-gray-200">Contour Width</Label>
                              <span className="text-xs text-purple-300 font-medium">{contourWidth[0]}px</span>
                            </div>
                            <Slider
                              value={contourWidth}
                              onValueChange={setContourWidth}
                              max={8}
                              min={1}
                              step={1}
                              className="w-full"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-gray-200">Contour Opacity</Label>
                              <span className="text-xs text-purple-300 font-medium">{contourOpacity[0]}%</span>
                            </div>
                            <Slider
                              value={contourOpacity}
                              onValueChange={setContourOpacity}
                              max={100}
                              min={0}
                              step={5}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Add Contour Dialog */}
                    {showAddContour && (
                      <div className="mb-4 p-3 bg-black/30 border border-blue-500/30 rounded-lg space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-blue-400">Add New Contour</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddContour(false)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-gray-300 mb-1 block">Contour Name</Label>
                            <Input
                              placeholder="Enter contour name..."
                              className="bg-black/20 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs text-gray-300 mb-1 block">Color</Label>
                            <div className="flex space-x-2">
                              <Input
                                type="color"
                                defaultValue="#ff6b6b"
                                className="w-12 h-8 p-1 border-gray-600 bg-black/20"
                              />
                              <Input
                                placeholder="#ff6b6b"
                                className="flex-1 bg-black/20 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-gray-300 mb-1 block">Type</Label>
                            <Input
                              placeholder="Placeholder for contour type..."
                              disabled
                              className="bg-gray-800/50 border-gray-700 text-gray-500 placeholder-gray-500"
                            />
                          </div>
                          
                          <div className="flex space-x-2 pt-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => {
                                // Handle create contour logic here
                                setShowAddContour(false);
                              }}
                            >
                              Create
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                              onClick={() => setShowAddContour(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Contour Operations Dialog */}
                    {showContourOperations && (
                      <div className="mb-4 p-3 bg-black/30 border border-orange-500/30 rounded-lg space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-orange-400">Contour Operations</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowContourOperations(false)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full bg-red-600/80 hover:bg-red-700 border-red-500 text-white"
                            onClick={() => {
                              // Handle delete current slice contour
                              console.log('Delete current slice contour');
                            }}
                          >
                            Delete Current Slice
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full bg-red-600/80 hover:bg-red-700 border-red-500 text-white"
                            onClick={() => {
                              // Handle delete nth slice contour
                              console.log('Delete nth slice contour');
                            }}
                          >
                            Delete Nth Slice
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full bg-red-700/80 hover:bg-red-800 border-red-600 text-white"
                            onClick={() => {
                              // Handle clear all slices
                              console.log('Clear all slices');
                            }}
                          >
                            Clear All Slices
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Structures List - Grouped and Individual - Scrollable */}
                    <div className={`space-y-1 overflow-y-auto flex-1 min-h-0 ${
                      windowLevelExpanded && accordionValues.includes('series') ? 'max-h-[40vh]' : 
                      !windowLevelExpanded && accordionValues.includes('series') ? 'max-h-[65vh]' :
                      windowLevelExpanded && !accordionValues.includes('series') ? 'max-h-[50vh]' : 'max-h-[75vh]'
                    }`} style={{ paddingBottom: '4rem', scrollPaddingBottom: '2rem' }}>
                      {rtStructures?.structures && (() => {
                        // Filter and sort structures
                        const filtered = rtStructures.structures.filter((structure: any) =>
                          structure.structureName.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        const sorted = sortStructures(filtered);
                        const { groups, ungrouped, specialGroups } = groupStructures(sorted);
                        
                        if (!groupingEnabled) {
                          // Show all structures as individual rows with reduced height
                          return sorted.map((structure: any) => {
                            // Check if this structure is in preview mode
                            const isInPreview = previewStructureInfo?.targetName && 
                              structure.structureName.toLowerCase() === previewStructureInfo.targetName.toLowerCase();
                            
                            const isSuperstructure = superstructures.find(
                              (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                            );
                              
                            return (
                              <div key={structure.roiNumber}>
                                <div 
                                  className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg border transition-all duration-150 backdrop-blur-sm ${
                                    selectedStructures.has(structure.roiNumber) 
                                      ? 'border-yellow-500/60 bg-yellow-500/10' 
                                      : selectedForEdit === structure.roiNumber
                                      ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                                      : isSuperstructure
                                      ? 'border-cyan-400/50 bg-gray-800/20 hover:bg-gray-700/30'
                                      : 'border-gray-700/30 bg-gray-800/20 hover:bg-gray-700/30'
                                  } ${
                                    isInPreview ? 'preview-structure-highlight' : ''
                                  }`}
                                  >
                              <Checkbox
                                checked={selectedStructures.has(structure.roiNumber)}
                                onCheckedChange={(checked) => handleStructureSelection(structure.roiNumber, !!checked)}
                                className="h-3 w-3 border-yellow-500/60 data-[state=checked]:bg-yellow-500"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStructureVisibilityToggle(structure.roiNumber)}
                                className="p-0.5 h-5 w-5 hover:bg-gray-600/50 rounded-lg"
                              >
                                {structureVisibility.get(structure.roiNumber) ?? true ? (
                                  <Eye className="w-3 h-3 text-blue-400" />
                                ) : (
                                  <EyeOff className="w-3 h-3 text-gray-500" />
                                )}
                              </Button>
                              <div 
                                className="w-3 h-3 rounded border border-gray-600/50"
                                style={{ backgroundColor: `rgb(${structure.color.join(',')})` }}
                              />
                              <span 
                                className="text-xs text-gray-100 font-medium flex-1 truncate cursor-pointer hover:text-green-400 transition-colors"
                                onClick={() => handleStructureEditSelection(structure.roiNumber)}
                              >
                                {structure.structureName}
                              </span>
                              
                              {/* Superstructure indicator */}
                              {(() => {
                                const superstructure = superstructures.find(
                                  (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                                );
                                if (!superstructure) return null;
                                
                                const isExpanded = expandedSuperstructures.has(structure.roiNumber);
                                
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newExpanded = new Set(expandedSuperstructures);
                                          if (isExpanded) {
                                            newExpanded.delete(structure.roiNumber);
                                          } else {
                                            newExpanded.add(structure.roiNumber);
                                          }
                                          setExpandedSuperstructures(newExpanded);
                                        }}
                                        className={`p-0.5 h-5 w-5 rounded-lg opacity-70 hover:opacity-100 ${
                                          isExpanded ? 'bg-cyan-500/30' : 'hover:bg-cyan-500/20'
                                        }`}
                                      >
                                        <IterationCw className="w-3 h-3 text-cyan-400" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Superstructure - {isExpanded ? 'Hide' : 'Show'} dependencies</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })()}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStructure(structure.roiNumber)}
                                className="p-0.5 h-5 w-5 hover:bg-red-500/30 rounded-lg opacity-70 hover:opacity-100"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </Button>
                            </div>
                            
                            {/* Superstructure dependencies - shown when expanded */}
                            {(() => {
                              const superstructure = superstructures.find(
                                (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                              );
                              if (!superstructure || !expandedSuperstructures.has(structure.roiNumber)) return null;
                              
                              // Get step color function (matching boolean pipeline)
                              const getStepColor = (stepIndex: number): { bg: string; border: string; text: string } => {
                                const colors = [
                                  { bg: 'bg-cyan-500/40', border: 'border-cyan-400/60', text: 'text-cyan-200' },
                                  { bg: 'bg-purple-600/40', border: 'border-purple-400/60', text: 'text-purple-200' },
                                  { bg: 'bg-blue-600/40', border: 'border-blue-400/60', text: 'text-blue-200' },
                                  { bg: 'bg-green-600/40', border: 'border-green-400/60', text: 'text-green-200' },
                                  { bg: 'bg-yellow-600/40', border: 'border-yellow-400/60', text: 'text-yellow-200' },
                                  { bg: 'bg-red-600/40', border: 'border-red-400/60', text: 'text-red-200' },
                                  { bg: 'bg-pink-600/40', border: 'border-pink-400/60', text: 'text-pink-200' },
                                  { bg: 'bg-orange-600/40', border: 'border-orange-400/60', text: 'text-orange-200' },
                                ];
                                return colors[stepIndex % colors.length];
                              };
                              
                              // Format operation expression with symbols
                              const formatExpression = (expr: string): string => {
                                return expr
                                  .replace(/union/gi, '∪')
                                  .replace(/intersect/gi, '∩')
                                  .replace(/subtract/gi, '−')
                                  .replace(/xor/gi, '⊕');
                              };
                              
                              return (
                                <div className="ml-6 mt-2 mb-2">
                                  <div className="bg-gray-800/40 border border-gray-600/50 rounded-lg p-3">
                                    <div className="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">
                                      Auto-updating from:
                                    </div>
                                    <div className="space-y-2 mb-3">
                                      {superstructure.sourceStructureNames?.map((name: string, idx: number) => {
                                        const stepColor = getStepColor(idx);
                                        return (
                                          <div key={idx} className="flex items-center gap-2">
                                            {/* Step Number Circle */}
                                            <div className={`w-5 h-5 rounded-full ${stepColor.bg} border ${stepColor.border} flex items-center justify-center text-[10px] font-bold ${stepColor.text} flex-shrink-0`}>
                                              {idx + 1}
                                            </div>
                                            <span className="text-xs text-gray-200 font-medium">{name}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="pt-3 border-t border-gray-700/50">
                                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">
                                        Operation:
                                      </div>
                                      <div className="text-xs text-gray-300 font-mono bg-gray-900/50 px-2 py-1.5 rounded border border-gray-700/50">
                                        {formatExpression(superstructure.operationExpression)}
                                      </div>
                                      {superstructure.autoUpdate && (
                                        <div className="mt-2 flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                          <span className="text-[10px] text-cyan-300 font-medium">Auto-update enabled</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            </div>
                          );
                        });
                        }
                        
                        return (
                          <>
                            {/* Special Groups (GTV, CTV, PTV, Planning) */}
                            {Array.from(specialGroups.entries()).map(([groupName, groupStructures]) => (
                              <div key={groupName}>
                                {/* Special Group Header */}
                                <div>
                                  <div 
                                    className="backdrop-blur-sm bg-gray-900/50 border border-gray-700/50 rounded-lg shadow-lg flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-800/50"
                                    onClick={() => toggleGroupExpansion(groupName)}
                                  >
                                    <div className="flex items-center space-x-2">
                                      {expandedGroups.get(groupName) ? (
                                        <ChevronDown className="w-3 h-3 text-gray-400" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-gray-400" />
                                      )}
                                      <span className="text-xs font-medium text-white">
                                        {groupName}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleGroupVisibility(groupStructures);
                                        }}
                                        className="p-0.5 h-5 w-5 hover:bg-gray-700 rounded-lg"
                                      >
                                        {groupStructures.every((structure: any) => 
                                          structureVisibility.get(structure.roiNumber) ?? true
                                        ) ? (
                                          <Eye className="w-3 h-3 text-blue-400" />
                                        ) : (
                                          <EyeOff className="w-3 h-3 text-gray-500" />
                                        )}
                                      </Button>
                                      <Badge variant="outline" className={`text-xs border ${
                                        groupName === 'GTV' ? 'border-red-500/60 text-red-400' :
                                        groupName === 'CTV' ? 'border-orange-500/60 text-orange-400' :
                                        groupName === 'PTV' ? 'border-yellow-500/60 text-yellow-400' :
                                        'border-purple-500/60 text-purple-400'
                                      }`}>
                                        {groupStructures.length}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  {/* Special Group Nested Items */}
                                  {expandedGroups.get(groupName) && (
                                    <div className="mt-1 ml-4 space-y-1 relative">
                                      {/* Vertical connection line */}
                                      <div className="absolute left-0 top-0 bottom-0 w-px bg-blue-400/30 -ml-2"></div>
                                      {groupStructures.map((structure: any, index: number) => {
                                        // Check if this structure is in preview mode
                                        const isInPreview = previewStructureInfo?.targetName && 
                                          structure.structureName.toLowerCase() === previewStructureInfo.targetName.toLowerCase();
                                        
                                        const isSuperstructure = superstructures.find(
                                          (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                                        );
                                        
                                        return (
                                          <div className="relative" key={`wrapper-${structure.roiNumber}`}>
                                            <div 
                                              className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg border transition-all duration-150 backdrop-blur-sm ${
                                                selectedForEdit === structure.roiNumber
                                                  ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20' 
                                                : selectedStructures.has(structure.roiNumber) 
                                                ? 'border-yellow-500/60 bg-yellow-500/10' 
                                                : isSuperstructure
                                                ? 'border-cyan-400/50 bg-gray-800/20 hover:bg-gray-700/30'
                                                : 'border-gray-700/30 bg-gray-800/20 hover:bg-gray-700/30'
                                            } ${
                                              isInPreview ? 'preview-structure-highlight' : ''
                                            }`}
                                          >
                                          <Checkbox
                                            checked={selectedStructures.has(structure.roiNumber)}
                                            onCheckedChange={(checked) => handleStructureSelection(structure.roiNumber, !!checked)}
                                            className="h-3 w-3 border-yellow-500/60 data-[state=checked]:bg-yellow-500"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleStructureVisibilityToggle(structure.roiNumber)}
                                            className="p-0.5 h-5 w-5 hover:bg-gray-600/50 rounded-lg"
                                          >
                                            {structureVisibility.get(structure.roiNumber) ?? true ? (
                                              <Eye className="w-3 h-3 text-blue-400" />
                                            ) : (
                                              <EyeOff className="w-3 h-3 text-gray-500" />
                                            )}
                                          </Button>
                                          <div 
                                            className="w-3 h-3 rounded border border-gray-600/50"
                                            style={{ backgroundColor: `rgb(${structure.color.join(',')})` }}
                                          />
                                          <span 
                                            className="text-xs text-gray-100 font-medium flex-1 truncate cursor-pointer hover:text-green-400 transition-colors"
                                            onClick={() => handleStructureEditSelection(structure.roiNumber)}
                                          >
                                            {structure.structureName}
                                          </span>
                                          
                                          {/* Blob indicator icon */}
                                          {structureBlobsMap.has(structure.roiNumber) && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const next = new Set(expandedBlobStructures);
                                                if (next.has(structure.roiNumber)) {
                                                  next.delete(structure.roiNumber);
                                                } else {
                                                  next.add(structure.roiNumber);
                                                }
                                                setExpandedBlobStructures(next);
                                              }}
                                              className="p-0.5 h-5 w-5 hover:bg-purple-500/30 rounded-lg opacity-70 hover:opacity-100"
                                              title={`${structureBlobsMap.get(structure.roiNumber)?.length} blobs detected`}
                                            >
                                              <SplitSquareHorizontal className="w-3 h-3 text-purple-400" />
                                            </Button>
                                          )}
                                          
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteStructure(structure.roiNumber)}
                                            className="p-0.5 h-5 w-5 hover:bg-red-500/30 rounded-lg opacity-70 hover:opacity-100"
                                          >
                                            <Trash2 className="w-3 h-3 text-red-400" />
                                          </Button>
                                        </div>
                                        
                                        {/* Expandable blob list */}
                                        {expandedBlobStructures.has(structure.roiNumber) && structureBlobsMap.has(structure.roiNumber) && (
                                          <StructureBlobList
                                            structureId={structure.roiNumber}
                                            structureName={structure.structureName}
                                            blobs={structureBlobsMap.get(structure.roiNumber) || []}
                                            onLocalize={(blobId, contours) => handleBlobLocalize(structure.roiNumber, blobId, contours)}
                                            onDelete={(blobId) => handleBlobDelete(structure.roiNumber, blobId)}
                                            onSeparate={(blobId) => handleBlobSeparate(structure.roiNumber, blobId)}
                                          />
                                        )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Regular Grouped Structures with Nested Items */}
                            {Array.from(groups.entries()).map(([groupName, groupStructures]) => (
                              <div key={groupName}>
                                {/* Group Header */}
                                <div>
                                  <div 
                                    className="backdrop-blur-sm bg-gray-800/30 border border-gray-700/50 rounded-lg flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-gray-800/50"
                                    onClick={() => toggleGroupExpansion(groupName)}
                                  >
                                    <div className="flex items-center space-x-2">
                                      {expandedGroups.get(groupName) ? (
                                        <ChevronDown className="w-3 h-3 text-gray-400" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-gray-400" />
                                      )}
                                      <div className="flex items-center space-x-1">
                                        {groupStructures.map((structure, index) => (
                                          <div 
                                            key={index}
                                            className="w-2.5 h-2.5 rounded border border-gray-600/50"
                                            style={{ backgroundColor: `rgb(${structure.color.join(',')})` }}
                                          />
                                        ))}
                                      </div>
                                      <span className="text-xs text-gray-100 font-medium">{groupName}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleGroupVisibility(groupStructures);
                                        }}
                                        className="p-0.5 h-5 w-5 hover:bg-gray-700 rounded"
                                      >
                                        {groupStructures.every((structure: any) => 
                                          structureVisibility.get(structure.roiNumber) ?? true
                                        ) ? (
                                          <Eye className="w-3 h-3 text-blue-400" />
                                        ) : (
                                          <EyeOff className="w-3 h-3 text-gray-500" />
                                        )}
                                      </Button>
                                      <Badge variant="outline" className="text-xs border-gray-600/50 text-gray-400">
                                        {groupStructures.length}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  {/* Nested structures directly under this group */}
                                  {expandedGroups.get(groupName) && (
                                    <div className="mt-1 ml-4 space-y-1 relative">
                                      {/* Vertical connection line */}
                                      <div className="absolute left-0 top-0 bottom-0 w-px bg-blue-400/30 -ml-2"></div>
                                      {groupStructures.map((structure: any, index: number) => {
                                        // Check if this structure is in preview mode
                                        const isInPreview = previewStructureInfo?.targetName && 
                                          structure.structureName.toLowerCase() === previewStructureInfo.targetName.toLowerCase();
                                        
                                        const isSuperstructure = superstructures.find(
                                          (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                                        );
                                        
                                        return (
                                          <div className="relative" key={`wrapper-nested-${structure.roiNumber}`}>
                                            <div 
                                              className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg border transition-all duration-150 backdrop-blur-sm ${
                                                selectedStructures.has(structure.roiNumber) 
                                                  ? 'border-yellow-500/60 bg-yellow-500/10' 
                                                  : selectedForEdit === structure.roiNumber
                                                  ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20' 
                                                : isSuperstructure
                                                ? 'border-cyan-400/50 bg-gray-800/20 hover:bg-gray-700/30'
                                                : 'border-gray-700/30 bg-gray-800/20 hover:bg-gray-700/30'
                                            } ${
                                              isInPreview ? 'preview-structure-highlight' : ''
                                            }`}
                                          >
                                          <Checkbox
                                            checked={selectedStructures.has(structure.roiNumber)}
                                            onCheckedChange={(checked) => handleStructureSelection(structure.roiNumber, !!checked)}
                                            className="h-3 w-3 border-yellow-500/60 data-[state=checked]:bg-yellow-500"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleStructureVisibilityToggle(structure.roiNumber)}
                                            className="p-0.5 h-5 w-5 hover:bg-gray-600/50 rounded-lg"
                                          >
                                            {structureVisibility.get(structure.roiNumber) ?? true ? (
                                              <Eye className="w-3 h-3 text-blue-400" />
                                            ) : (
                                              <EyeOff className="w-3 h-3 text-gray-500" />
                                            )}
                                          </Button>
                                          <div 
                                            className="w-3 h-3 rounded border border-gray-600/50"
                                            style={{ backgroundColor: `rgb(${structure.color.join(',')})` }}
                                          />
                                          <span 
                                            className="text-xs text-gray-100 font-medium flex-1 truncate cursor-pointer hover:text-green-400 transition-colors"
                                            onClick={() => handleStructureEditSelection(structure.roiNumber)}
                                          >
                                            {structure.structureName}
                                          </span>
                                          
                                          {/* Superstructure indicator (mutually exclusive with blob mode) */}
                                          {(() => {
                                            const superstructure = superstructures.find(
                                              (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                                            );
                                            
                                    // If superstructure, show GitMerge icon in a collapsible dropdown style
                                    if (superstructure) {
                                      const isExpanded = expandedSuperstructures.has(structure.roiNumber);
                                      
                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const newExpanded = new Set(expandedSuperstructures);
                                                if (isExpanded) {
                                                  newExpanded.delete(structure.roiNumber);
                                                } else {
                                                  newExpanded.add(structure.roiNumber);
                                                }
                                                setExpandedSuperstructures(newExpanded);
                                              }}
                                              className={`p-0.5 h-5 w-5 rounded-lg opacity-70 hover:opacity-100 ${
                                                isExpanded ? 'bg-cyan-500/30' : 'hover:bg-cyan-500/20'
                                              }`}
                                            >
                                              <GitMerge className="w-3 h-3 text-cyan-400" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Superstructure - {isExpanded ? 'Collapse' : 'Expand'}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    }
                                            
                                            // Otherwise, show blob icon if blobs detected
                                            if (structureBlobsMap.has(structure.roiNumber)) {
                                              return (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    const next = new Set(expandedBlobStructures);
                                                    if (next.has(structure.roiNumber)) {
                                                      next.delete(structure.roiNumber);
                                                    } else {
                                                      next.add(structure.roiNumber);
                                                    }
                                                    setExpandedBlobStructures(next);
                                                  }}
                                                  className="p-0.5 h-5 w-5 hover:bg-purple-500/30 rounded-lg opacity-70 hover:opacity-100"
                                                  title={`${structureBlobsMap.get(structure.roiNumber)?.length} blobs detected`}
                                                >
                                                  <SplitSquareHorizontal className="w-3 h-3 text-purple-400" />
                                                </Button>
                                              );
                                            }
                                            
                                            return null;
                                          })()}
                                          
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteStructure(structure.roiNumber)}
                                            className="p-0.5 h-5 w-5 hover:bg-red-500/30 rounded-lg opacity-70 hover:opacity-100"
                                          >
                                            <Trash2 className="w-3 h-3 text-red-400" />
                                          </Button>
                                        </div>
                                        
                                        {/* Superstructure dependencies - dropdown style like blobs */}
                                        {expandedSuperstructures.has(structure.roiNumber) && (() => {
                                          const superstructure = superstructures.find(
                                            (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                                          );
                                          if (!superstructure) return null;
                                          
                                          return (
                                            <div className="ml-6 mt-1">
                                              <div className="p-2 bg-cyan-900/10 border border-cyan-500/30 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <GitMerge className="w-3 h-3 text-cyan-400" />
                                                  <div className="text-[10px] text-cyan-300 font-semibold">
                                                    AUTO-UPDATING FROM:
                                                  </div>
                                                </div>
                                                <div className="space-y-1.5 ml-1">
                                                  {superstructure.sourceStructureNames?.map((name: string, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-2 text-[10px]">
                                                      <ChevronRight className="w-2.5 h-2.5 text-cyan-400" />
                                                      <span className="text-gray-200 font-medium">{name}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-cyan-500/20">
                                                  <div className="text-[10px] text-cyan-300 font-mono">
                                                    {superstructure.operationExpression}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                        
                                        {/* Expandable blob list - only show if NOT a superstructure */}
                                        {!superstructures.find((ss: any) => ss.rtStructureRoiNumber === structure.roiNumber) && 
                                         expandedBlobStructures.has(structure.roiNumber) && 
                                         structureBlobsMap.has(structure.roiNumber) && (
                                          <StructureBlobList
                                            structureId={structure.roiNumber}
                                            structureName={structure.structureName}
                                            blobs={structureBlobsMap.get(structure.roiNumber) || []}
                                            onLocalize={(blobId, contours) => handleBlobLocalize(structure.roiNumber, blobId, contours)}
                                            onDelete={(blobId) => handleBlobDelete(structure.roiNumber, blobId)}
                                            onSeparate={(blobId) => handleBlobSeparate(structure.roiNumber, blobId)}
                                          />
                                        )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Ungrouped Structures */}
                            {ungrouped.map((structure: any) => {
                              // Check if this structure is in preview mode
                              const isInPreview = previewStructureInfo?.targetName && 
                                structure.structureName.toLowerCase() === previewStructureInfo.targetName.toLowerCase();
                              
                              const isSuperstructure = superstructures.find(
                                (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                              );
                              
                              return (
                                <div key={structure.roiNumber}>
                                  <div 
                                    className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg border transition-all duration-150 backdrop-blur-sm ${
                                      selectedForEdit === structure.roiNumber
                                        ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20' 
                                        : selectedStructures.has(structure.roiNumber) 
                                        ? 'border-yellow-500/60 bg-yellow-500/10'
                                        : isSuperstructure
                                        ? 'border-cyan-400/50 bg-gray-800/20 hover:bg-gray-700/30' 
                                        : 'border-gray-700/50 bg-gray-800/30 hover:bg-gray-700/50'
                                    } ${
                                      isInPreview ? 'preview-structure-highlight' : ''
                                    }`}
                                  >
                                  <Checkbox
                                    checked={selectedStructures.has(structure.roiNumber)}
                                    onCheckedChange={(checked) => handleStructureSelection(structure.roiNumber, !!checked)}
                                    className="h-3 w-3 border-yellow-500/60 data-[state=checked]:bg-yellow-500"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStructureVisibilityToggle(structure.roiNumber)}
                                    className="p-0.5 h-5 w-5 hover:bg-gray-600/50 rounded-lg"
                                  >
                                    {structureVisibility.get(structure.roiNumber) ?? true ? (
                                      <Eye className="w-3 h-3 text-blue-400" />
                                    ) : (
                                      <EyeOff className="w-3 h-3 text-gray-500" />
                                    )}
                                  </Button>
                                  <div 
                                    className="w-3 h-3 rounded border border-gray-600/50"
                                    style={{ backgroundColor: `rgb(${structure.color.join(',')})` }}
                                  />
                                  <span 
                                    className="text-xs text-gray-100 font-medium flex-1 truncate cursor-pointer hover:text-green-400 transition-colors"
                                    onClick={() => handleStructureEditSelection(structure.roiNumber)}
                                  >
                                    {structure.structureName}
                                  </span>
                                  
                                  {/* Superstructure indicator (mutually exclusive with blob mode) */}
                                  {(() => {
                                    const superstructure = superstructures.find(
                                      (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                                    );
                                    
                                    // If superstructure, show IterationCw icon instead of blob icon
                                    if (superstructure) {
                                    
                                      const isExpanded = expandedSuperstructures.has(structure.roiNumber);
                                      
                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const newExpanded = new Set(expandedSuperstructures);
                                                if (isExpanded) {
                                                  newExpanded.delete(structure.roiNumber);
                                                } else {
                                                  newExpanded.add(structure.roiNumber);
                                                }
                                                setExpandedSuperstructures(newExpanded);
                                              }}
                                              className={`p-0.5 h-5 w-5 rounded-lg opacity-70 hover:opacity-100 ${
                                                isExpanded ? 'bg-cyan-500/30' : 'hover:bg-cyan-500/20'
                                              }`}
                                            >
                                              <IterationCw className="w-3 h-3 text-cyan-400" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Superstructure - {isExpanded ? 'Hide' : 'Show'} dependencies</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    }
                                    
                                    // Otherwise, show blob icon if blobs detected
                                    if (structureBlobsMap.has(structure.roiNumber)) {
                                      return (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const next = new Set(expandedBlobStructures);
                                            if (next.has(structure.roiNumber)) {
                                              next.delete(structure.roiNumber);
                                            } else {
                                              next.add(structure.roiNumber);
                                            }
                                            setExpandedBlobStructures(next);
                                          }}
                                          className="p-0.5 h-5 w-5 hover:bg-purple-500/30 rounded-lg opacity-70 hover:opacity-100"
                                          title={`${structureBlobsMap.get(structure.roiNumber)?.length} blobs detected`}
                                        >
                                          <SplitSquareHorizontal className="w-3 h-3 text-purple-400" />
                                        </Button>
                                      );
                                    }
                                    
                                    return null;
                                  })()}
                                  
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteStructure(structure.roiNumber)}
                                    className="p-0.5 h-5 w-5 hover:bg-red-500/30 rounded-lg opacity-70 hover:opacity-100"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </Button>
                                </div>
                                
                                {/* Superstructure dependencies - Minimal dropdown */}
                                {expandedSuperstructures.has(structure.roiNumber) && (() => {
                                  const superstructure = superstructures.find(
                                    (ss: any) => ss.rtStructureRoiNumber === structure.roiNumber
                                  );
                                  if (!superstructure) return null;
                                  
                                  // Get step color function (matching boolean pipeline)
                                  const getStepColor = (stepIndex: number): { bg: string; border: string; text: string } => {
                                    const colors = [
                                      { bg: 'bg-cyan-500/40', border: 'border-cyan-400/60', text: 'text-cyan-200' },
                                      { bg: 'bg-purple-600/40', border: 'border-purple-400/60', text: 'text-purple-200' },
                                      { bg: 'bg-blue-600/40', border: 'border-blue-400/60', text: 'text-blue-200' },
                                      { bg: 'bg-green-600/40', border: 'border-green-400/60', text: 'text-green-200' },
                                      { bg: 'bg-yellow-600/40', border: 'border-yellow-400/60', text: 'text-yellow-200' },
                                      { bg: 'bg-red-600/40', border: 'border-red-400/60', text: 'text-red-200' },
                                      { bg: 'bg-pink-600/40', border: 'border-pink-400/60', text: 'text-pink-200' },
                                      { bg: 'bg-orange-600/40', border: 'border-orange-400/60', text: 'text-orange-200' },
                                    ];
                                    return colors[stepIndex % colors.length];
                                  };
                                  
                                  // Format operation expression with symbols
                                  const formatExpression = (expr: string): string => {
                                    return expr
                                      .replace(/union/gi, '∪')
                                      .replace(/intersect/gi, '∩')
                                      .replace(/subtract/gi, '−')
                                      .replace(/xor/gi, '⊕');
                                  };
                                  
                                  return (
                                    <div className="ml-6 mt-2 mb-2">
                                      <div className="bg-gray-800/40 border border-gray-600/50 rounded-lg p-3">
                                        <div className="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">
                                          Auto-updating from:
                                        </div>
                                        <div className="space-y-2 mb-3">
                                          {superstructure.sourceStructureNames?.map((name: string, idx: number) => {
                                            const stepColor = getStepColor(idx);
                                            return (
                                              <div key={idx} className="flex items-center gap-2">
                                                {/* Step Number Circle */}
                                                <div className={`w-5 h-5 rounded-full ${stepColor.bg} border ${stepColor.border} flex items-center justify-center text-[10px] font-bold ${stepColor.text} flex-shrink-0`}>
                                                  {idx + 1}
                                                </div>
                                                <span className="text-xs text-gray-200 font-medium">{name}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="pt-3 border-t border-gray-700/50">
                                          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">
                                            Operation:
                                          </div>
                                          <div className="text-xs text-gray-300 font-mono bg-gray-900/50 px-2 py-1.5 rounded border border-gray-700/50">
                                            {formatExpression(superstructure.operationExpression)}
                                          </div>
                                          {superstructure.autoUpdate && (
                                            <div className="mt-2 flex items-center gap-1.5">
                                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                              <span className="text-[10px] text-cyan-300 font-medium">Auto-update enabled</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                                
                                {/* Expandable blob list - only show if NOT a superstructure */}
                                {!superstructures.find((ss: any) => ss.rtStructureRoiNumber === structure.roiNumber) && 
                                 expandedBlobStructures.has(structure.roiNumber) && 
                                 structureBlobsMap.has(structure.roiNumber) && (
                                  <div className="mt-1">
                                    <StructureBlobList
                                      structureId={structure.roiNumber}
                                      structureName={structure.structureName}
                                      blobs={structureBlobsMap.get(structure.roiNumber) || []}
                                      onLocalize={(blobId, contours) => handleBlobLocalize(structure.roiNumber, blobId, contours)}
                                      onDelete={(blobId) => handleBlobDelete(structure.roiNumber, blobId)}
                                      onSeparate={(blobId) => handleBlobSeparate(structure.roiNumber, blobId)}
                                    />
                                  </div>
                                )}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    {selectedRTSeries ? (
                      <div className="text-gray-500 text-sm">Loading structures...</div>
                    ) : selectedSeries ? (
                      <div className="space-y-4">
                        <div className="text-gray-500 text-sm">No structure set loaded</div>
                        <Button
                          onClick={handleCreateBlankStructureSet}
                          className="bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 rounded-lg backdrop-blur-sm transition-all duration-150"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Structure Set
                        </Button>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">Select a scan to create structures</div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
        </CardContent>
      </Card>

      {/* Window/Level Controls - Redesigned */}
      <Card className="bg-gray-950/95 border border-gray-700/50 rounded-xl overflow-hidden shadow-xl">
        <CardContent className="p-0">
          <Accordion 
            type="single" 
            collapsible 
            defaultValue="window-level"
            onValueChange={(value) => {
              setWindowLevelExpanded(value === "window-level");
            }}
          >
            <AccordionItem value="window-level" className="border-gray-800/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5">
                <div className="flex items-center gap-2 text-gray-200 font-medium text-sm">
                  <Settings className="w-4 h-4 text-orange-400" />
                  <span>Window/Level</span>
                  <span className="text-xs text-gray-500 font-normal ml-auto">
                    {Math.round(windowLevel.window)}/{Math.round(windowLevel.level)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <div className="space-y-4">
                  {/* Window Width */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-300">Window Width</label>
                      <span className="text-xs font-semibold text-white bg-gray-800/50 px-2 py-0.5 rounded">
                        {Math.round(windowLevel.window)}
                      </span>
                    </div>
                    <Slider
                      value={[windowLevel.window]}
                      onValueChange={handleWindowChange}
                      min={1}
                      max={2000}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Window Level */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-300">Window Level</label>
                      <span className="text-xs font-semibold text-white bg-gray-800/50 px-2 py-0.5 rounded">
                        {Math.round(windowLevel.level)}
                      </span>
                    </div>
                    <Slider
                      value={[windowLevel.level]}
                      onValueChange={handleLevelChange}
                      min={-1000}
                      max={1000}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
                
                {/* Preset Buttons - Cleaner grid */}
                <div className="mt-4 pt-4 border-t border-gray-800/50">
                  <h5 className="text-xs font-medium text-gray-400 mb-2.5 uppercase tracking-wide">Presets</h5>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(() => {
                      const modality = (selectedSeries?.modality || '').toUpperCase();
                      
                      // Filter presets based on modality
                      const filteredPresets = Object.entries(WINDOW_LEVEL_PRESETS).filter(([name]) => {
                        const presetName = name.toLowerCase();
                        
                        // MRI presets
                        if (modality === 'MR') {
                          return presetName.includes('mri') || presetName === 'brain';
                        }
                        // CT presets
                        else if (modality === 'CT') {
                          return !presetName.includes('mri') && presetName !== 'full range';
                        }
                        // PET/PT - show full range
                        else if (modality === 'PT' || modality === 'PET') {
                          return presetName === 'full range';
                        }
                        // Default - show common presets
                        return !presetName.includes('mri');
                      });
                      
                      return filteredPresets.map(([name, preset]) => {
                        const isActive = Math.abs(windowLevel.window - preset.window) < 1 && 
                                       Math.abs(windowLevel.level - preset.level) < 1;
                        return (
                          <Button
                            key={name}
                            variant="outline"
                            size="sm"
                            className={`text-xs py-1.5 px-2 h-auto transition-all ${
                              isActive 
                                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                                : 'bg-gray-800/30 border-gray-700/50 text-gray-300 hover:bg-gray-700/40 hover:text-white hover:border-gray-600/50'
                            }`}
                            onClick={() => applyPreset(preset as WindowLevel)}
                          >
                            {name}
                          </Button>
                        );
                      });
                    })()}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* New Structure Dialog - Glassmorphic Styling */}
      <Dialog open={showNewStructureDialog} onOpenChange={setShowNewStructureDialog}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900/95 border border-gray-700/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Create New Structure</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new anatomical structure to the current RT Structure Set.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="structure-name" className="text-right text-gray-300">
                Name
              </Label>
              <Input
                id="structure-name"
                value={newStructureName}
                onChange={(e) => setNewStructureName(e.target.value)}
                className="col-span-3 bg-gray-800/50 border-gray-600/50 text-white placeholder-gray-500 focus:bg-gray-800/70 focus:border-green-500/50 backdrop-blur-sm"
                placeholder="e.g., LIVER, HEART, PTV"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="structure-color" className="text-right text-gray-300">
                Color
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <div className="relative">
                  <Input
                    id="structure-color"
                    type="color"
                    value={newStructureColor}
                    onChange={(e) => setNewStructureColor(e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer bg-gray-800/50 border-gray-600/50 rounded-lg"
                  />
                </div>
                <span className="text-sm text-gray-400 bg-gray-800/30 px-3 py-1 rounded-lg backdrop-blur-sm border border-gray-700/30">
                  {newStructureColor.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewStructureDialog(false);
                setNewStructureName('');
                setNewStructureColor('#FF0000');
              }}
              className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white backdrop-blur-sm"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNewStructure}
              className="bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 hover:text-green-300 backdrop-blur-sm transition-all duration-150"
            >
              Create Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save As New Dialog */}
      {saveAsNewSeriesId && selectedRTSeries && (
        <SaveAsNewDialog
          open={showSaveAsNewDialog}
          onOpenChange={setShowSaveAsNewDialog}
          seriesId={saveAsNewSeriesId}
          currentLabel={selectedRTSeries.seriesDescription || 'RT Structure Set'}
          structureCount={rtStructures?.structures?.length || 0}
          onSaveSuccess={(newSeriesId) => {
            console.log('New RT structure set created:', newSeriesId);
            // Reload RT series to show the new structure set
            if (studyIds && studyIds.length > 0) {
              const loadRTForStudy = async (studyId: number) => {
                try {
                  const response = await fetch(`/api/studies/${studyId}/rt-structures`);
                  if (response.ok) {
                    const rtData = await response.json();
                    setRTSeries(prev => {
                      const filtered = prev.filter((rt: any) => rt.studyId !== studyId);
                      return [...filtered, ...rtData];
                    });
                  }
                } catch (error) {
                  console.error('Error reloading RT structures:', error);
                }
              };
              studyIds.forEach(id => loadRTForStudy(id));
            }
            // Refresh history status for the original series (it now has history)
            if (saveAsNewSeriesId) {
              setSeriesHistoryStatus(prev => new Map(prev).set(saveAsNewSeriesId, true));
            }
          }}
        />
      )}

      {/* History Modal */}
      {historySeriesId && selectedRTSeries && (
        <RTStructureHistoryModal
          open={showHistoryModal}
          onOpenChange={setShowHistoryModal}
          seriesId={historySeriesId}
          structureSetLabel={selectedRTSeries.seriesDescription || 'RT Structure Set'}
          onRestore={() => {
            console.log('RT structure set restored from history');
            // Reload RT structures after restore
            if (selectedRTSeries) {
              handleRTSeriesSelect(selectedRTSeries);
            }
          }}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
