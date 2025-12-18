import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RobustImport } from "@/components/dicom/robust-import";
import { PatientCard } from "@/components/patient-manager/patient-card";
import { useParsingSession } from "@/hooks/use-parsing-session";
import { 
  User, 
  Calendar, 
  FileText, 
  Network, 
  Settings, 
  Search, 
  Download, 
  Upload, 
  Database,
  Activity,
  Wifi,
  WifiOff,
  Play,
  Eye,
  AlertTriangle,
  FolderDown,
  Merge,
  CheckSquare,
  Trash2,
  Star,
  Clock,
  Import,
  X,
  Beaker,
  FlaskConical,
  Tag,
  Zap
} from "lucide-react";

interface Patient {
  id: number;
  patientID: string;
  patientName: string;
  patientSex?: string;
  patientAge?: string;
  dateOfBirth?: string;
  createdAt: string;
}

interface Study {
  id: number;
  studyInstanceUID: string;
  patientId: number;
  patientName: string;
  patientID: string;
  studyDate: string;
  studyDescription: string;
  accessionNumber?: string;
  modality: string;
  numberOfSeries: number;
  numberOfImages: number;
  isDemo: boolean;
  createdAt: string;
}

interface PacsConnection {
  id: number;
  name: string;
  sourceType: 'local_database' | 'dicomweb' | 'local_folder' | 'dimse';
  // DIMSE fields
  aeTitle?: string;
  hostname?: string;
  port?: number;
  callingAeTitle?: string;
  // DICOMweb fields
  wadoRoot?: string;
  qidoRoot?: string;
  wadoUri?: string;
  stowUri?: string;
  qidoSupportsIncludeField?: boolean;
  supportsReject?: boolean;
  supportsStow?: boolean;
  supportsFuzzyMatching?: boolean;
  supportsWildcard?: boolean;
  imageRendering?: string;
  thumbnailRendering?: string;
  enableStudyLazyLoad?: boolean;
  // Local folder fields
  folderPath?: string;
  watchFolder?: boolean;
  // Status
  isActive: boolean;
  lastTestedAt?: string;
  lastTestResult?: 'success' | 'failed' | 'pending';
  createdAt: string;
}

interface DICOMQueryResult {
  patientName?: string;
  patientID?: string;
  studyInstanceUID?: string;
  studyDate?: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  modality?: string;
  numberOfStudyRelatedSeries?: number;
  numberOfStudyRelatedInstances?: number;
}

type FusionAssociationStatus = 'ready' | 'pending' | 'missing-secondary' | 'unmapped';

interface SeriesSummary {
  id: number;
  studyId: number;
  seriesInstanceUID: string;
  seriesDescription: string | null;
  modality: string | null;
  seriesNumber: number | null;
  imageCount: number | null;
  sliceThickness?: string | null;
  createdAt: string | null;
}

interface DerivedFusionDetails {
  primarySeriesId: number | null;
  secondarySeriesId: number | null;
  registrationId: string | null;
  transformSource: string | null;
  interpolation: string | null;
  generatedAt: string | null;
  manifestPath: string | null;
  outputDirectory: string | null;
  markers: string[];
}

type DerivedSeriesSummary = SeriesSummary & { fusion: DerivedFusionDetails };

type RegistrationSeriesSummary = SeriesSummary & {
  filePath: string | null;
  fileExists: boolean;
  referencedSeriesInstanceUIDs: string[];
  referencedSeriesIds: number[];
  parsed: {
    matrixRowMajor4x4: number[] | null;
    sourceFrameOfReferenceUid: string | null;
    targetFrameOfReferenceUid: string | null;
    notes: string[];
  } | null;
};

type FusionAssociationSummary = {
  studyId: number | null;
  registrationSeriesId: number | null;
  registrationFilePath: string | null;
  registrationId: string | null;
  primarySeriesId: number | null;
  secondarySeriesId: number | null;
  derivedSeriesId: number | null;
  status: FusionAssociationStatus;
  reason?: string;
  markers: string[];
  transformSource?: string | null;
  registrationSeries: RegistrationSeriesSummary | null;
  primarySeries: SeriesSummary | null;
  secondarySeries: SeriesSummary | null;
  derivedSeries: DerivedSeriesSummary | null;
};

type PatientFusionOverviewDebug = {
  generatedAt: string;
  fusedDirectories: Array<{ studyId: number; path: string; exists: boolean; contents: string[] }>;
  missingPaths: Array<{ seriesId: number; path: string }>;
};

interface PatientFusionOverview {
  patient: {
    id: number;
    patientID: string | null;
    patientName: string | null;
    createdAt: string | null;
  };
  summary: {
    totalStudies: number;
    totalSeries: number;
    registrationSeries: number;
    derivedSeries: number;
  };
  studies: Array<{
    id: number;
    studyInstanceUID: string;
    studyDescription: string | null;
    studyDate: string | null;
    accessionNumber: string | null;
    modalityCounts: Record<string, number>;
    series: SeriesSummary[];
    registrationSeries: RegistrationSeriesSummary[];
    derivedSeries: DerivedSeriesSummary[];
    associations: FusionAssociationSummary[];
  }>;
  registrationSeries: RegistrationSeriesSummary[];
  derivedSeries: DerivedSeriesSummary[];
  associations: FusionAssociationSummary[];
  debug?: PatientFusionOverviewDebug;
}

// Data source configuration schema (OHIF-style)
const dataSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sourceType: z.enum(["dicomweb", "local_folder", "dimse"]).default("dicomweb"),
  // DIMSE fields
  aeTitle: z.string().optional(),
  hostname: z.string().optional(),
  port: z.number().min(1).max(65535).optional(),
  callingAeTitle: z.string().default("SUPERBEAM"),
  // DICOMweb fields
  wadoRoot: z.string().optional(),
  qidoRoot: z.string().optional(),
  wadoUri: z.string().optional(),
  stowUri: z.string().optional(),
  qidoSupportsIncludeField: z.boolean().default(true),
  supportsFuzzyMatching: z.boolean().default(true),
  supportsWildcard: z.boolean().default(true),
  supportsStow: z.boolean().default(false),
  // Local folder fields  
  folderPath: z.string().optional(),
  watchFolder: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.sourceType === 'dicomweb') {
    if (!data.qidoRoot) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "QIDO Root URL is required for DICOMweb sources",
        path: ["qidoRoot"],
      });
    }
  } else if (data.sourceType === 'local_folder') {
    if (!data.folderPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Folder path is required for local folder sources",
        path: ["folderPath"],
      });
    }
  } else if (data.sourceType === 'dimse') {
    if (!data.aeTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AE Title is required for DIMSE sources",
        path: ["aeTitle"],
      });
    }
    if (!data.hostname) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hostname is required for DIMSE sources",
        path: ["hostname"],
      });
    }
    if (!data.port) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Port is required for DIMSE sources",
        path: ["port"],
      });
    }
  }
});

const querySchema = z.object({
  patientName: z.string().optional(),
  patientID: z.string().optional(),
  studyDate: z.string().optional(),
  studyDescription: z.string().optional(),
  accessionNumber: z.string().optional(),
  modality: z.string().optional(),
});

export default function PatientManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPacs, setSelectedPacs] = useState<number | null>(null);
  const [queryResults, setQueryResults] = useState<DICOMQueryResult[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [activeTab, setActiveTab] = useState("patients");
  const [fusionPatientId, setFusionPatientId] = useState<number | null>(null);
  
  // New state for favorites and recent patients
  const [favoritePatients, setFavoritePatients] = useState<Set<number>>(new Set());
  const [recentlyOpenedPatients, setRecentlyOpenedPatients] = useState<number[]>([]);
  const [recentlyImportedPatients, setRecentlyImportedPatients] = useState<Array<{patientId: string | number; importDate: number}>>([]);
  const [hasPendingData, setHasPendingData] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<Set<number>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [exportItems, setExportItems] = useState<any[]>([]);
  const [selectedExportItems, setSelectedExportItems] = useState<Set<string>>(new Set());
  const hasActiveParsingSession = useParsingSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Toggle favorite status for a patient
  const toggleFavorite = (patientId: number) => {
    setFavoritePatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      // Save to localStorage
      localStorage.setItem('favoritePatients', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  // Track when a patient is opened
  const trackPatientOpened = (patientId: number) => {
    setRecentlyOpenedPatients(prev => {
      const newList = [patientId, ...prev.filter(id => id !== patientId)].slice(0, 10);
      localStorage.setItem('recentlyOpenedPatients', JSON.stringify(newList));
      return newList;
    });
  };

  // Track when a patient is imported
  const trackPatientImported = (patientId: number | string, importDate?: number) => {
    const timestamp = importDate || Date.now();
    setRecentlyImportedPatients(prev => {
      const newEntry = { patientId, importDate: timestamp };
      const newList = [newEntry, ...prev.filter(item => item.patientId !== patientId)].slice(0, 10);
      localStorage.setItem('recentlyImportedPatients', JSON.stringify(newList));
      return newList;
    });
  };

  // Load saved data from localStorage on mount and listen for updates
  useEffect(() => {
    const loadStoredData = () => {
      const savedFavorites = localStorage.getItem('favoritePatients');
      if (savedFavorites) {
        setFavoritePatients(new Set(JSON.parse(savedFavorites)));
      }

      const savedRecentlyOpened = localStorage.getItem('recentlyOpenedPatients');
      if (savedRecentlyOpened) {
        setRecentlyOpenedPatients(JSON.parse(savedRecentlyOpened));
      }

      const savedRecentlyImported = localStorage.getItem('recentlyImportedPatients');
      if (savedRecentlyImported) {
        const parsed = JSON.parse(savedRecentlyImported);
        // Handle both old format (array of IDs) and new format (array of objects)
        if (parsed.length > 0 && typeof parsed[0] === 'object' && 'patientId' in parsed[0]) {
          setRecentlyImportedPatients(parsed);
        } else {
          // Convert old format to new format
          const converted = parsed.map((id: number) => ({ patientId: id, importDate: Date.now() }));
          setRecentlyImportedPatients(converted);
          localStorage.setItem('recentlyImportedPatients', JSON.stringify(converted));
        }
      }
    };
    
    loadStoredData();
    
    // Listen for recently imported updates from other components
    const handleRecentlyImportedUpdate = () => {
      const savedRecentlyImported = localStorage.getItem('recentlyImportedPatients');
      if (savedRecentlyImported) {
        setRecentlyImportedPatients(JSON.parse(savedRecentlyImported));
      }
    };
    
    window.addEventListener('recentlyImportedUpdated', handleRecentlyImportedUpdate);
    
    return () => {
      window.removeEventListener('recentlyImportedUpdated', handleRecentlyImportedUpdate);
    };
  }, []);

  // Auto-populate demo data on component mount
  useEffect(() => {
    const populateDemo = async () => {
      try {
        const response = await fetch("/api/populate-demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
          queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
          queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
        }
      } catch (error) {
        console.log("Demo data population skipped:", error);
      }
    };
    populateDemo();
  }, [queryClient]);

  // Check for unprocessed files periodically
  useEffect(() => {
    const checkUnprocessedFiles = async () => {
      try {
        const response = await fetch('/api/unprocessed-files');
        if (response.ok) {
          const data = await response.json();
          setHasPendingData(data.files && data.files.length > 0);
        }
      } catch (error) {
        console.error('Error checking unprocessed files:', error);
      }
    };

    // Check immediately and then every 5 seconds
    checkUnprocessedFiles();
    const interval = setInterval(checkUnprocessedFiles, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch patients
  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch studies
  const { data: studies = [], isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
  });
  
  // Fetch series data for patient cards
  const { data: series = [] } = useQuery<any[]>({
    queryKey: ["/api/series"],
  });

  // Fetch PACS connections
  const { data: pacsConnections = [], isLoading: pacsLoading } = useQuery<PacsConnection[]>({
    queryKey: ["/api/pacs"],
  });

  // Fetch all patient tags for filtering
  const { data: patientTags = [] } = useQuery<any[]>({
    queryKey: ["/api/patient-tags"],
  });

  useEffect(() => {
    if (fusionPatientId == null && patients.length) {
      setFusionPatientId(patients[0].id);
    }
  }, [fusionPatientId, patients]);

  const fusionOverviewQuery = useQuery<PatientFusionOverview>({
    queryKey: fusionPatientId ? ["/api/patients", fusionPatientId, "fusion", "overview"] : ["/api/patients", "fusion", "overview", "idle"],
    queryFn: async () => {
      if (fusionPatientId == null) throw new Error('No patient selected');
      const response = await fetch(`/api/patients/${fusionPatientId}/fusion/overview`);
      if (!response.ok) {
        throw new Error(`Failed to load fusion overview (${response.status})`);
      }
      return (await response.json()) as PatientFusionOverview;
    },
    enabled: fusionPatientId != null,
  });

  const fusionOverview = fusionOverviewQuery.data;
  const fusionOverviewLoading = fusionOverviewQuery.isLoading;
  const fusionOverviewFetching = fusionOverviewQuery.isFetching;
  const fusionStatusStyles: Record<FusionAssociationStatus, { label: string; className: string }> = {
    ready: { label: 'Ready', className: 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200 border' },
    pending: { label: 'Pending', className: 'bg-amber-500/10 border-amber-400/40 text-amber-200 border' },
    'missing-secondary': { label: 'Needs Match', className: 'bg-rose-500/10 border-rose-400/40 text-rose-200 border' },
    unmapped: { label: 'Unmapped', className: 'bg-slate-500/10 border-slate-400/40 text-slate-200 border' },
  };

  const runManifestMutation = useMutation({
    mutationFn: async () => {
      if (fusionPatientId == null) {
        throw new Error('Select a patient first');
      }
      const response = await fetch(`/api/patients/${fusionPatientId}/fusion/run-manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeReady: false }),
      });
      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || `Manifest run failed (${response.status})`);
      }
      return (await response.json()) as { ok: boolean; overview: PatientFusionOverview; runs: any[] };
    },
    onSuccess: (data) => {
      toast({
        title: 'Manifest run requested',
        description: `${data?.runs?.length ?? 0} fusion pair${(data?.runs?.length ?? 0) === 1 ? '' : 's'} queued.`,
      });
      fusionOverviewQuery.refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Manifest run failed',
        description: error?.message || 'Unable to trigger manifest run.',
        variant: 'destructive',
      });
    },
  });

  const clearFusionMutation = useMutation({
    mutationFn: async () => {
      if (fusionPatientId == null) {
        throw new Error('Select a patient first');
      }
      const response = await fetch(`/api/patients/${fusionPatientId}/fusion/clear`, {
        method: 'POST',
      });
      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || `Failed to clear derived data (${response.status})`);
      }
      return (await response.json()) as { ok: boolean; overview: PatientFusionOverview };
    },
    onSuccess: () => {
      toast({
        title: 'Derived series cleared',
        description: 'Fused series removed and manifest cache reset.',
      });
      fusionOverviewQuery.refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Clear failed',
        description: error?.message || 'Unable to clear derived data.',
        variant: 'destructive',
      });
    },
  });

  const handleFusionDebugFetch = useCallback(async () => {
    if (fusionPatientId == null) {
      toast({ title: 'Select a patient', description: 'Choose a patient to inspect fusion data.', variant: 'destructive' });
      return;
    }
    try {
      const response = await fetch(`/api/patients/${fusionPatientId}/fusion/overview?debug=true`, { cache: 'no-store' });
      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || `Debug fetch failed (${response.status})`);
      }
      const payload = await response.json();
      console.groupCollapsed(`Fusion debug for patient ${fusionPatientId}`);
      console.debug(payload);
      console.groupEnd();
      toast({ title: 'Debug data ready', description: 'Inspect console for detailed fusion debug output.' });
    } catch (error: any) {
      toast({
        title: 'Debug fetch failed',
        description: error?.message || 'Unable to load fusion debug data.',
        variant: 'destructive',
      });
    }
  }, [fusionPatientId, toast]);

  // Data source form
  const dataSourceForm = useForm<z.infer<typeof dataSourceSchema>>({
    resolver: zodResolver(dataSourceSchema),
    defaultValues: {
      name: "",
      sourceType: "dicomweb",
      aeTitle: "",
      hostname: "",
      port: 104,
      callingAeTitle: "SUPERBEAM",
      qidoRoot: "",
      wadoRoot: "",
      folderPath: "",
      qidoSupportsIncludeField: true,
      supportsFuzzyMatching: true,
      supportsWildcard: true,
      isActive: true,
    },
  });

  // Watch source type to show/hide relevant fields
  const selectedSourceType = dataSourceForm.watch("sourceType");

  // Query form
  const queryForm = useForm<z.infer<typeof querySchema>>({
    resolver: zodResolver(querySchema),
    defaultValues: {
      patientName: "",
      patientID: "",
      studyDate: "",
      studyDescription: "",
      accessionNumber: "",
      modality: "",
    },
  });

  // Create data source mutation
  const createDataSourceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dataSourceSchema>) => {
      const response = await fetch("/api/pacs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create data source");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pacs"] });
      dataSourceForm.reset();
      toast({ title: "Data source created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create data source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete data source mutation
  const deleteDataSourceMutation = useMutation({
    mutationFn: async (pacsId: number) => {
      const response = await fetch(`/api/pacs/${pacsId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete data source");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pacs"] });
      toast({ title: "Data source deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete data source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test data source connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (pacsId: number) => {
      const response = await fetch(`/api/pacs/${pacsId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to test connection");
      return response.json();
    },
    onSuccess: (data: { success: boolean; message: string; responseTime?: number }, pacsId: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pacs"] });
      const connection = pacsConnections.find(p => p.id === pacsId);
      toast({
        title: data.success ? "Connection successful" : "Connection failed",
        description: data.message + (data.responseTime ? ` (${data.responseTime}ms)` : ''),
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  // Export handler
  const handleExport = async () => {
    if (selectedPatients.size === 0) return;
    
    try {
      // Collect all series for selected patients
      const items = [];
      for (const patientId of selectedPatients) {
        const patient = patients.find(p => p.id === patientId);
        const patientStudies = studies.filter(s => s.patientId === patientId);
        
        for (const study of patientStudies) {
          const studySeries = series.filter(s => s.studyId === study.id);
          for (const s of studySeries) {
            items.push({
              id: `series-${s.id}`,
              type: 'series',
              name: `${patient?.patientName} - ${s.modality} - ${s.seriesDescription || 'Unnamed Series'}`,
              description: `${s.imageCount || 0} images`,
              data: s
            });
          }
        }
      }
      
      setExportItems(items);
      setSelectedExportItems(new Set());
      setShowExportDialog(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load export items",
        variant: "destructive"
      });
    }
  };

  const handleExportConfirm = async () => {
    if (selectedExportItems.size === 0) {
      toast({
        title: "Warning",
        description: "Please select items to export",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // TODO: Implement export API endpoint
      toast({
        title: "Success",
        description: `Exporting ${selectedExportItems.size} items...`,
      });
      setShowExportDialog(false);
      setSelectedPatients(new Set());
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to export files",
        variant: "destructive"
      });
    }
  };

  // Merge handler
  const handleMerge = () => {
    if (selectedPatients.size < 2) return;
    setShowMergeDialog(true);
  };

  const handleMergeConfirm = async (targetPatientId: number | 'new', newPatientName?: string) => {
    try {
      // TODO: Implement merge API endpoint
      toast({
        title: "Success",
        description: (targetPatientId as any) === 'new' 
          ? `Merging patients into new patient: ${newPatientName}`
          : `Merging patients into existing patient`,
      });
      setShowMergeDialog(false);
      setSelectedPatients(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to merge patients",
        variant: "destructive"
      });
    }
  };

  // Delete selected patients handler
  const handleDeleteSelected = async () => {
    if (selectedPatients.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedPatients.size} patient${selectedPatients.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }
    
    const patientIds = Array.from(selectedPatients);
    let successCount = 0;
    let errorCount = 0;
    
    for (const patientId of patientIds) {
      try {
        const response = await fetch(`/api/patients/${patientId}?full=true`, {
          method: "DELETE",
        });
        
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      toast({
        title: "Success",
        description: `Deleted ${successCount} patient${successCount !== 1 ? 's' : ''}`,
      });
      setSelectedPatients(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
    }
    
    if (errorCount > 0) {
      toast({
        title: "Error",
        description: `Failed to delete ${errorCount} patient${errorCount !== 1 ? 's' : ''}`,
        variant: "destructive",
      });
    }
  };

  // Query PACS mutation
  const queryPacsMutation = useMutation({
    mutationFn: async ({ pacsId, queryParams }: { pacsId: number; queryParams: z.infer<typeof querySchema> }) => {
      const response = await fetch(`/api/pacs/${pacsId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryParams),
      });
      if (!response.ok) throw new Error("Failed to query PACS");
      return response.json();
    },
    onSuccess: (data: DICOMQueryResult[]) => {
      setQueryResults(data);
      toast({
        title: "Query completed",
        description: `Found ${data.length} studies`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Query failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get unique tags from all patient tags
  const uniqueTags = [...new Set(patientTags.map(tag => tag.tagValue))];

  // Filter patients and studies
  const filteredPatients = patients.filter(patient => {
    // Search term filter
    const matchesSearch = patient.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.patientID?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tag filter
    const patientTagValues = patientTags
      .filter(tag => tag.patientId === patient.id)
      .map(tag => tag.tagValue);
    
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => patientTagValues.includes(tag));
    
    return matchesSearch && matchesTags;
  });

  const filteredStudies = studies.filter(study =>
    study.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.studyDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.modality?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateDataSource = (data: z.infer<typeof dataSourceSchema>) => {
    createDataSourceMutation.mutate(data);
  };

  const handleTestConnection = (pacsId: number) => {
    testConnectionMutation.mutate(pacsId);
  };

  const handleDeleteDataSource = (pacsId: number) => {
    if (confirm("Are you sure you want to delete this data source?")) {
      deleteDataSourceMutation.mutate(pacsId);
    }
  };

  const handleQueryDataSource = (data: z.infer<typeof querySchema>) => {
    if (!selectedPacs) {
      toast({
        title: "No data source selected",
        description: "Please select a data source first",
        variant: "destructive",
      });
      return;
    }
    
    setIsQuerying(true);
    queryPacsMutation.mutate(
      { pacsId: selectedPacs, queryParams: data },
      {
        onSettled: () => setIsQuerying(false),
      }
    );
  };

  // Helper to get source type icon and label
  const getSourceTypeInfo = (sourceType: string) => {
    switch (sourceType) {
      case 'local_database':
        return { icon: Database, label: 'Local Database', color: 'text-green-500' };
      case 'dicomweb':
        return { icon: Network, label: 'DICOMweb', color: 'text-blue-500' };
      case 'local_folder':
        return { icon: FolderDown, label: 'Local Folder', color: 'text-amber-500' };
      case 'dimse':
        return { icon: Wifi, label: 'DIMSE', color: 'text-purple-500' };
      default:
        return { icon: Network, label: sourceType, color: 'text-gray-500' };
    }
  };

  const handleFileUpload = async (files: File[]) => {
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Upload successful",
        description: `Uploaded ${result.processed} files successfully`,
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload DICOM files",
        variant: "destructive",
      });
    }
  };



  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header matching viewer interface */}
      <header className="fixed top-4 left-4 right-4 bg-gray-950/95 backdrop-blur-xl border border-gray-700/50 rounded-xl px-5 py-2.5 z-50 shadow-xl">
        <div className="flex items-center justify-between w-full">
          {/* Left: Logo */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
                <style>{`
                  @keyframes superWave {
                    0% { 
                      color: white; 
                      filter: drop-shadow(0 0 4px rgba(255,255,255,0.3));
                      transform: translateY(0px);
                    }
                    50% { 
                      color: #06b6d4; 
                      filter: drop-shadow(0 0 12px #06b6d4);
                      transform: translateY(-3px);
                    }
                    100% { 
                      color: white; 
                      filter: drop-shadow(0 0 4px rgba(255,255,255,0.3));
                      transform: translateY(0px);
                    }
                  }
                  @keyframes beamWave {
                    0% { 
                      filter: drop-shadow(0 0 6px currentColor);
                      transform: translateY(0px);
                    }
                    50% { 
                      filter: drop-shadow(0 0 14px currentColor);
                      transform: translateY(-3px);
                    }
                    100% { 
                      filter: drop-shadow(0 0 6px currentColor);
                      transform: translateY(0px);
                    }
                  }
                  .letter-s { animation: superWave 1s ease-in-out forwards; }
                  .letter-u { animation: superWave 1s ease-in-out forwards 0.08s; }
                  .letter-p { animation: superWave 1s ease-in-out forwards 0.16s; }
                  .letter-e1 { animation: superWave 1s ease-in-out forwards 0.24s; }
                  .letter-r { animation: superWave 1s ease-in-out forwards 0.32s; }
                  .letter-b { color: #06b6d4; animation: beamWave 1s ease-in-out forwards 0.4s; }
                  .letter-e2 { color: #ec4899; animation: beamWave 1s ease-in-out forwards 0.48s; }
                  .letter-a { color: #f97316; animation: beamWave 1s ease-in-out forwards 0.56s; }
                  .letter-m { color: #fbbf24; animation: beamWave 1s ease-in-out forwards 0.64s; }
                `}</style>
                <h1 className="text-2xl tracking-wider" style={{ letterSpacing: '0.1em', fontFamily: "'Doto', monospace", fontWeight: 900 }}>
                  <span className="letter-s inline-block">S</span>
                  <span className="letter-u inline-block">U</span>
                  <span className="letter-p inline-block">P</span>
                  <span className="letter-e1 inline-block">E</span>
                  <span className="letter-r inline-block">R</span>
                  <span className="letter-b inline-block">B</span>
                  <span className="letter-e2 inline-block">E</span>
                  <span className="letter-a inline-block">A</span>
                  <span className="letter-m inline-block">M</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/prototypes">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/90 hover:text-purple-400 hover:bg-purple-600/20 hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/20 border border-transparent rounded-lg transition-all duration-200"
                >
                  <Beaker className="h-4 w-4 mr-1.5" />
                  <span className="text-sm font-medium">Prototypes</span>
                </Button>
              </Link>
              <Link href="/ohif-prototypes">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/90 hover:text-cyan-400 hover:bg-cyan-600/20 hover:border-cyan-500/50 hover:shadow-md hover:shadow-cyan-500/20 border border-transparent rounded-lg transition-all duration-200"
                >
                  <FlaskConical className="h-4 w-4 mr-1.5" />
                  <span className="text-sm font-medium">OHIF</span>
                </Button>
              </Link>
              <Link href="/introducing">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/90 hover:text-amber-400 hover:bg-amber-600/20 hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/20 border border-transparent rounded-lg transition-all duration-200"
                >
                  <span className="text-sm font-medium">✨ Intro</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

      {/* Main layout with content and sidebar */}
      <div className="flex flex-1 pt-20 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Unified Control Panel with proper height management */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative flex flex-col h-full overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex-shrink-0 space-y-2">
              {/* Navigation Tabs */}
              <TabsList className="flex w-full h-12 items-center justify-between rounded-lg bg-gray-900/80 p-1 border border-gray-700/40">
                <TabsTrigger value="patients" className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 h-10 text-sm font-medium transition-all duration-200 border border-transparent data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-200 data-[state=active]:border-indigo-400/60 data-[state=active]:shadow-[0_0_12px_rgba(99,102,241,0.4)] text-gray-400 hover:text-white hover:bg-white/5">
                  <User className="h-4 w-4" />
                  Patients
                </TabsTrigger>
                <TabsTrigger value="import" className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 h-10 text-sm font-medium transition-all duration-200 border border-transparent data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-200 data-[state=active]:border-purple-400/60 data-[state=active]:shadow-[0_0_12px_rgba(168,85,247,0.4)] text-gray-400 hover:text-white hover:bg-white/5">
                  <Upload className="h-4 w-4" />
                  Import
                  {hasActiveParsingSession && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
                  {!hasActiveParsingSession && hasPendingData && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
                </TabsTrigger>
                <TabsTrigger value="pacs" className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 h-10 text-sm font-medium transition-all duration-200 border border-transparent data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-200 data-[state=active]:border-blue-400/60 data-[state=active]:shadow-[0_0_12px_rgba(59,130,246,0.4)] text-gray-400 hover:text-white hover:bg-white/5">
                  <Database className="h-4 w-4" />
                  Sources
                </TabsTrigger>
                <TabsTrigger value="query" className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 h-10 text-sm font-medium transition-all duration-200 border border-transparent data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200 data-[state=active]:border-cyan-400/60 data-[state=active]:shadow-[0_0_12px_rgba(34,211,238,0.4)] text-gray-400 hover:text-white hover:bg-white/5">
                  <Search className="h-4 w-4" />
                  Query
                </TabsTrigger>
                <TabsTrigger value="fusion" className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 h-10 text-sm font-medium transition-all duration-200 border border-transparent data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-200 data-[state=active]:border-orange-400/60 data-[state=active]:shadow-[0_0_12px_rgba(251,146,60,0.4)] text-gray-400 hover:text-white hover:bg-white/5">
                  <Merge className="h-4 w-4" />
                  Fusion
                </TabsTrigger>
                <TabsTrigger value="metadata" className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 h-10 text-sm font-medium transition-all duration-200 border border-transparent data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-200 data-[state=active]:border-emerald-400/60 data-[state=active]:shadow-[0_0_12px_rgba(52,211,153,0.4)] text-gray-400 hover:text-white hover:bg-white/5">
                  <FileText className="h-4 w-4" />
                  Metadata
                </TabsTrigger>
              </TabsList>

            </div>

            {/* Tab Content Container */}
            <div className="flex-1 relative overflow-hidden">
              {/* Patients Tab Content */}
              <TabsContent value="patients" className="absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {/* Fixed Search & Filter Card */}
              <div className="flex-shrink-0 px-4 pt-3 pb-3">
                <div className="bg-[#0d1f24] border border-cyan-700/40 rounded-xl overflow-hidden shadow-xl">
                  {/* Header Row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-white font-semibold text-base">Patient Database</span>
                    <Badge variant="outline" className="border-cyan-600/50 text-cyan-300 bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium rounded-md">
                      {filteredPatients.length} / {patients.length}
                    </Badge>
                  </div>
                  
                  {/* Search Row */}
                  <div className="px-4 pb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search patients by name, ID, or study..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10 w-full bg-[#081518] border border-cyan-800/40 text-white placeholder:text-gray-500 
                                 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)] rounded-lg
                                 transition-all duration-200 text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  
                  {/* Quick Tags */}
                  <div className="px-4 pb-4">
                    {selectedTags.length > 0 && (
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => setSelectedTags([])}
                          className="text-[10px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Clear filters
                        </button>
                      </div>
                    )}
                    {uniqueTags.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {uniqueTags.map(tag => {
                          const getTagStyle = (tagName: string) => {
                            const lower = tagName.toLowerCase();
                            if (lower.includes('head') || lower.includes('brain')) {
                              return { 
                                base: 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/50', 
                                selected: 'bg-purple-500/30 border-purple-400 text-purple-100 shadow-[0_0_8px_rgba(168,85,247,0.3)]' 
                              };
                            } else if (lower.includes('chest') || lower.includes('thorax') || lower.includes('lung')) {
                              return { 
                                base: 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50', 
                                selected: 'bg-blue-500/30 border-blue-400 text-blue-100 shadow-[0_0_8px_rgba(59,130,246,0.3)]' 
                              };
                            } else if (lower.includes('abdomen') || lower.includes('pelvis')) {
                              return { 
                                base: 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20 hover:border-green-400/50', 
                                selected: 'bg-green-500/30 border-green-400 text-green-100 shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
                              };
                            } else if (lower.includes('spine') || lower.includes('neck')) {
                              return { 
                                base: 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20 hover:border-orange-400/50', 
                                selected: 'bg-orange-500/30 border-orange-400 text-orange-100 shadow-[0_0_8px_rgba(251,146,60,0.3)]' 
                              };
                            } else {
                              return { 
                                base: 'bg-gray-500/10 border-gray-500/30 text-gray-300 hover:bg-gray-500/20 hover:border-gray-400/50', 
                                selected: 'bg-indigo-500/30 border-indigo-400 text-indigo-100 shadow-[0_0_8px_rgba(99,102,241,0.3)]' 
                              };
                            }
                          };
                          const style = getTagStyle(tag);
                          const isSelected = selectedTags.includes(tag);
                          
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTags(selectedTags.filter(t => t !== tag));
                                } else {
                                  setSelectedTags([...selectedTags, tag]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md border transition-all duration-200 text-xs font-medium ${
                                isSelected ? style.selected : style.base
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic py-1">
                        No tags yet. Add tags to patients for quick filtering.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Patient List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">

            {/* Selection Actions Bar */}
            {selectedPatients.size > 0 && (
              <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between h-10 bg-gray-900/80 backdrop-blur-xl border border-indigo-500/40 rounded-lg px-3">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-indigo-400" />
                    <span className="text-indigo-200 font-medium text-sm">
                      {selectedPatients.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExport}
                      className="h-7 px-2.5 text-xs text-gray-300 hover:text-white hover:bg-indigo-500/20"
                    >
                      <FolderDown className="h-3.5 w-3.5 mr-1.5" />
                      Export
                    </Button>
                    {selectedPatients.size >= 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMerge}
                        className="h-7 px-2.5 text-xs text-gray-300 hover:text-white hover:bg-purple-500/20"
                      >
                        <Merge className="h-3.5 w-3.5 mr-1.5" />
                        Merge
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteSelected}
                      className="h-7 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete
                    </Button>
                    <div className="w-px h-5 bg-gray-700/60 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPatients(new Set())}
                      className="h-7 w-7 p-0 text-gray-500 hover:text-white hover:bg-gray-700/50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {patientsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <svg className="h-12 w-12 animate-spin text-indigo-500 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.64 5.64L4.22 4.22M19.78 19.78l-1.42-1.42M5.64 18.36L4.22 19.78M19.78 4.22l-1.42 1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p className="text-gray-400">Loading patients...</p>
                </div>
              </div>
            ) : filteredPatients.length === 0 ? (
              <Card className="bg-gray-950/90 backdrop-blur-xl border border-gray-600/60 shadow-2xl shadow-black/50">
                <CardContent className="text-center py-16">
                  <div className="bg-gray-800/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="h-12 w-12 text-gray-500" />
                  </div>
                  <p className="text-gray-300 text-lg font-medium">No patients found</p>
                  <p className="text-gray-500 text-sm mt-2">
                    {searchTerm || selectedTags.length > 0 
                      ? "Try adjusting your search or filters" 
                      : "Upload DICOM files to get started"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPatients.map((patient) => {
                  // Get studies and series for this patient
                  const patientStudies = studies.filter(study => study.patientId === patient.id);
                  const patientSeries = series.filter(s => 
                    patientStudies.some(study => study.id === s.studyId)
                  );
                  
                  return (
                    <PatientCard
                      key={patient.id}
                      patient={{
                        ...patient,
                        patientId: patient.patientID,
                        sex: patient.patientSex,
                        age: patient.patientAge
                      }}
                      studies={patientStudies}
                      series={patientSeries}
                      isSelectable={true}
                      isSelected={selectedPatients.has(patient.id)}
                      onSelectionChange={(selected) => {
                        const newSet = new Set(selectedPatients);
                        if (selected) {
                          newSet.add(patient.id);
                        } else {
                          newSet.delete(patient.id);
                        }
                        setSelectedPatients(newSet);
                      }}
                      onUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/series"] });
                      }}
                      isFavorite={favoritePatients.has(patient.id)}
                      onToggleFavorite={() => toggleFavorite(patient.id)}
                      onPatientOpened={() => trackPatientOpened(patient.id)}
                    />
                  );
                })}
              </div>
            )}
              </div>
            </TabsContent>

            {/* Import DICOM Tab */}
            <TabsContent value="import" className="absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-white">Import DICOM Files</h2>
                  <span className="text-xs text-gray-500">Upload and parse DICOM data from your computer</span>
                </div>
                <RobustImport />
              </div>
            </TabsContent>

            {/* Data Sources Tab */}
            <TabsContent value="pacs" className="absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Data Sources</h2>
                <span className="text-xs text-gray-500">Configure DICOM data sources and PACS connections</span>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Network className="h-4 w-4 mr-2" />
                    Add Data Source
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Data Source</DialogTitle>
                    <DialogDescription>
                      Configure a new DICOM data source. Supports DICOMweb servers, DIMSE PACS, and local folders.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...dataSourceForm}>
                    <form onSubmit={dataSourceForm.handleSubmit(handleCreateDataSource)} className="space-y-4">
                      <FormField
                        control={dataSourceForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Hospital PACS" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={dataSourceForm.control}
                        name="sourceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Source Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select source type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="dicomweb">DICOMweb (WADO/QIDO/STOW)</SelectItem>
                                <SelectItem value="dimse">DIMSE (C-FIND/C-MOVE/C-ECHO)</SelectItem>
                                <SelectItem value="local_folder">Local Folder</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose the protocol for connecting to your DICOM source.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* DICOMweb fields */}
                      {selectedSourceType === 'dicomweb' && (
                        <>
                          <FormField
                            control={dataSourceForm.control}
                            name="qidoRoot"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>QIDO Root URL</FormLabel>
                                <FormControl>
                                  <Input placeholder="https://pacs.example.com/dicom-web" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Base URL for QIDO-RS queries (e.g., /studies)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={dataSourceForm.control}
                            name="wadoRoot"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>WADO Root URL (optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Same as QIDO if blank" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Base URL for WADO-RS retrieval. Leave blank to use QIDO URL.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={dataSourceForm.control}
                              name="supportsFuzzyMatching"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel>Fuzzy Matching</FormLabel>
                                  </div>
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value} 
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={dataSourceForm.control}
                              name="supportsWildcard"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel>Wildcards</FormLabel>
                                  </div>
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value} 
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      )}

                      {/* DIMSE fields */}
                      {selectedSourceType === 'dimse' && (
                        <>
                          <FormField
                            control={dataSourceForm.control}
                            name="aeTitle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>AE Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="PACS_SERVER" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={dataSourceForm.control}
                              name="hostname"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Hostname</FormLabel>
                                  <FormControl>
                                    <Input placeholder="pacs.hospital.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={dataSourceForm.control}
                              name="port"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Port</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="104" 
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 104)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={dataSourceForm.control}
                            name="callingAeTitle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Calling AE Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="SUPERBEAM" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Your local AE title (the caller)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {/* Local folder fields */}
                      {selectedSourceType === 'local_folder' && (
                        <>
                          <FormField
                            control={dataSourceForm.control}
                            name="folderPath"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Folder Path</FormLabel>
                                <FormControl>
                                  <Input placeholder="/path/to/dicom/files" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Absolute path to a folder containing DICOM files on the server.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={dataSourceForm.control}
                            name="watchFolder"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Watch for Changes</FormLabel>
                                  <FormDescription>
                                    Auto-import new DICOM files
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Checkbox 
                                    checked={field.value} 
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={createDataSourceMutation.isPending}
                      >
                        {createDataSourceMutation.isPending ? "Creating..." : "Create Data Source"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {pacsLoading ? (
              <div className="text-center py-8">Loading data sources...</div>
            ) : pacsConnections.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Network className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No data sources configured</p>
                  <p className="text-xs text-gray-400 mt-2">Add a DICOMweb server, DIMSE PACS, or local folder</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pacsConnections.map((connection) => {
                  const sourceInfo = getSourceTypeInfo(connection.sourceType);
                  const SourceIcon = sourceInfo.icon;
                  const isLocalDb = connection.sourceType === 'local_database';
                  
                  return (
                    <Card 
                      key={connection.id} 
                      className={`hover:shadow-lg transition-all ${selectedPacs === connection.id ? 'ring-2 ring-primary' : ''}`}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <SourceIcon className={`h-5 w-5 ${sourceInfo.color}`} />
                            {connection.name}
                          </div>
                          <div className="flex items-center gap-1">
                            {connection.lastTestResult === 'success' && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                                <Wifi className="h-3 w-3 mr-1" />
                                Online
                              </Badge>
                            )}
                            {connection.lastTestResult === 'failed' && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Offline
                              </Badge>
                            )}
                            {!connection.lastTestResult && (
                              <Badge variant="outline" className="text-gray-500">
                                Not tested
                              </Badge>
                            )}
                          </div>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {connection.sourceType === 'dicomweb' && (
                            <span className="font-mono">{connection.qidoRoot || 'No URL configured'}</span>
                          )}
                          {connection.sourceType === 'dimse' && (
                            <span>{connection.aeTitle} @ {connection.hostname}:{connection.port}</span>
                          )}
                          {connection.sourceType === 'local_folder' && (
                            <span className="font-mono">{connection.folderPath}</span>
                          )}
                          {connection.sourceType === 'local_database' && (
                            <span>Built-in SQLite database with imported studies</span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(connection.id)}
                            disabled={testConnectionMutation.isPending}
                          >
                            <Activity className="h-3 w-3 mr-1" />
                            Test
                          </Button>
                          <Button
                            variant={selectedPacs === connection.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setSelectedPacs(connection.id);
                              setActiveTab("query");
                            }}
                          >
                            <Search className="h-3 w-3 mr-1" />
                            Query
                          </Button>
                          {!isLocalDb && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDataSource(connection.id)}
                              disabled={deleteDataSourceMutation.isPending}
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
              </div>
            </TabsContent>

            {/* Query Tab */}
            <TabsContent value="query" className="absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-white">Query DICOM Sources</h2>
                  <span className="text-xs text-gray-500">Search and retrieve studies from external sources</span>
                </div>
            {/* Source indicator */}
            {selectedPacs && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                {(() => {
                  const connection = pacsConnections.find(c => c.id === selectedPacs);
                  if (!connection) return null;
                  const info = getSourceTypeInfo(connection.sourceType);
                  const Icon = info.icon;
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${info.color}`} />
                      <span className="text-sm font-medium">Querying: {connection.name}</span>
                      <Badge variant="outline" className="text-xs">{info.label}</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="ml-auto"
                        onClick={() => setSelectedPacs(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  );
                })()}
              </div>
            )}
            
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    DICOM Query
                  </CardTitle>
                  <CardDescription>
                    {selectedPacs ? 'Search for studies in the selected data source' : 'Select a data source to begin querying'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedPacs ? (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <Database className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Select a data source to query</p>
                      </div>
                      <div className="space-y-2">
                        {pacsConnections.map((connection) => {
                          const info = getSourceTypeInfo(connection.sourceType);
                          const Icon = info.icon;
                          return (
                            <Button
                              key={connection.id}
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => setSelectedPacs(connection.id)}
                            >
                              <Icon className={`h-4 w-4 mr-2 ${info.color}`} />
                              {connection.name}
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {info.label}
                              </Badge>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <Form {...queryForm}>
                      <form onSubmit={queryForm.handleSubmit(handleQueryDataSource)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={queryForm.control}
                            name="patientName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Patient Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Smith*" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={queryForm.control}
                            name="patientID"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Patient ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="12345" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={queryForm.control}
                          name="studyDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Study Description</FormLabel>
                              <FormControl>
                                <Input placeholder="CT Chest" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={queryForm.control}
                            name="studyDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Study Date</FormLabel>
                                <FormControl>
                                  <Input placeholder="20240101" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  YYYYMMDD or range
                                </FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={queryForm.control}
                            name="modality"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Modality</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "all"}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="CT">CT</SelectItem>
                                    <SelectItem value="MR">MR</SelectItem>
                                    <SelectItem value="PT">PT</SelectItem>
                                    <SelectItem value="CR">CR</SelectItem>
                                    <SelectItem value="DX">DX</SelectItem>
                                    <SelectItem value="US">US</SelectItem>
                                    <SelectItem value="RTSTRUCT">RTSTRUCT</SelectItem>
                                    <SelectItem value="RTPLAN">RTPLAN</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={queryForm.control}
                          name="accessionNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Accession Number</FormLabel>
                              <FormControl>
                                <Input placeholder="ACC123456" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2">
                          <Button 
                            type="submit" 
                            className="flex-1" 
                            disabled={isQuerying}
                          >
                            <Search className="h-4 w-4 mr-2" />
                            {isQuerying ? "Searching..." : "Search"}
                          </Button>
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => {
                              queryForm.reset();
                              setQueryResults([]);
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Results</span>
                    {queryResults.length > 0 && (
                      <Badge variant="secondary">{queryResults.length} studies</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {queryResults.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        {selectedPacs ? 'Enter search criteria and click Search' : 'Select a data source to begin'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {queryResults.map((result, index) => (
                        <Card key={index} className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {result.patientName || "Unknown Patient"}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                <span>ID: {result.patientID || 'N/A'}</span>
                                <Badge variant="outline" className="text-xs">
                                  {result.modality || 'N/A'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {result.studyDescription || 'No description'}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                <span>{result.studyDate || 'No date'}</span>
                                <span>•</span>
                                <span>{result.numberOfStudyRelatedSeries || 0} series</span>
                                <span>•</span>
                                <span>{result.numberOfStudyRelatedInstances || 0} images</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                <Download className="h-3 w-3 mr-1" />
                                Get
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
              </div>
            </TabsContent>

            <TabsContent value="fusion" className="absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-white">Image Fusion</h2>
                  <span className="text-xs text-gray-500">Manage multi-modality registration and fusion workflows</span>
                </div>
              <Card className="bg-gray-950/90 border border-gray-700/60">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Fusion Manifest Manager</CardTitle>
                    <CardDescription>
                      Review registration files, derived fusion outputs, and trigger manifest runs per patient.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => runManifestMutation.mutate()}
                      disabled={fusionPatientId == null || runManifestMutation.isPending}
                    >
                      {runManifestMutation.isPending ? 'Running…' : 'Run Manifest'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleFusionDebugFetch}
                      disabled={fusionPatientId == null || fusionOverviewFetching}
                    >
                      Debug Data
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => clearFusionMutation.mutate()}
                      disabled={fusionPatientId == null || clearFusionMutation.isPending}
                    >
                      {clearFusionMutation.isPending ? 'Clearing…' : 'Clear Derived'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fusion-patient-select">Patient</Label>
                    <Select
                      value={fusionPatientId != null ? String(fusionPatientId) : undefined}
                      onValueChange={(value) => setFusionPatientId(Number(value))}
                    >
                      <SelectTrigger id="fusion-patient-select" className="w-full bg-black/40 border border-gray-700/70">
                        <SelectValue placeholder="Select a patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={String(patient.id)}>
                            {(patient.patientName && patient.patientName.trim()) || patient.patientID || `Patient ${patient.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {fusionPatientId == null ? (
                    <p className="text-sm text-gray-400">Choose a patient to inspect fusion data.</p>
                  ) : fusionOverviewLoading && !fusionOverview ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.64 5.64L4.22 4.22M19.78 19.78l-1.42-1.42M5.64 18.36L4.22 19.78M19.78 4.22l-1.42 1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Loading fusion overview…
                    </div>
                  ) : fusionOverview ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-gray-700/60 bg-black/30 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-400">Studies</div>
                        <div className="text-xl font-semibold text-white">{fusionOverview.summary.totalStudies}</div>
                      </div>
                      <div className="rounded-lg border border-gray-700/60 bg-black/30 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-400">Series</div>
                        <div className="text-xl font-semibold text-white">{fusionOverview.summary.totalSeries}</div>
                      </div>
                      <div className="rounded-lg border border-gray-700/60 bg-black/30 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-400">Registration Series</div>
                        <div className="text-xl font-semibold text-white">{fusionOverview.summary.registrationSeries}</div>
                      </div>
                      <div className="rounded-lg border border-gray-700/60 bg-black/30 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-400">Derived Series</div>
                        <div className="text-xl font-semibold text-white">{fusionOverview.summary.derivedSeries}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No fusion data found for this patient yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-950/90 border border-gray-700/60">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Associations</CardTitle>
                  <CardDescription>
                    Mapping between primary CT, secondary modalities, registration files, and derived fused series.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {fusionPatientId == null ? (
                    <p className="text-sm text-gray-400">Select a patient to review fusion associations.</p>
                  ) : fusionOverviewLoading && !fusionOverview ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.64 5.64L4.22 4.22M19.78 19.78l-1.42-1.42M5.64 18.36L4.22 19.78M19.78 4.22l-1.42 1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Loading associations…
                    </div>
                  ) : fusionOverview && fusionOverview.associations.length ? (
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[720px] grid-cols-6 gap-px rounded-lg border border-gray-800 bg-gray-800/60 text-xs uppercase tracking-wide text-gray-400">
                        <div className="bg-black/60 px-3 py-2">Status</div>
                        <div className="bg-black/60 px-3 py-2">Primary</div>
                        <div className="bg-black/60 px-3 py-2">Secondary</div>
                        <div className="bg-black/60 px-3 py-2">Registration</div>
                        <div className="bg-black/60 px-3 py-2">Derived</div>
                        <div className="bg-black/60 px-3 py-2">Notes</div>
                      </div>
                      {fusionOverview.associations.map((assoc, index) => {
                        const statusStyle = fusionStatusStyles[assoc.status];
                        const primaryLabel = assoc.primarySeries?.seriesDescription || assoc.primarySeries?.seriesInstanceUID || (assoc.primarySeriesId != null ? `Series #${assoc.primarySeriesId}` : '—');
                        const secondaryLabel = assoc.secondarySeries?.seriesDescription || assoc.secondarySeries?.seriesInstanceUID || (assoc.secondarySeriesId != null ? `Series #${assoc.secondarySeriesId}` : '—');
                        const registrationLabel = assoc.registrationSeries?.seriesDescription || assoc.registrationSeries?.seriesInstanceUID || (assoc.registrationSeriesId != null ? `Series #${assoc.registrationSeriesId}` : '—');
                        const derivedLabel = assoc.derivedSeries?.seriesDescription || (assoc.derivedSeriesId != null ? `Series #${assoc.derivedSeriesId}` : 'Pending');
                        const markerText = assoc.markers?.length ? assoc.markers.join(', ') : null;
                        return (
                          <div key={`${assoc.primarySeriesId}-${assoc.secondarySeriesId}-${assoc.registrationSeriesId}-${index}`} className="grid min-w-[720px] grid-cols-6 gap-px border-b border-gray-800/40 bg-gray-900/60 text-sm">
                            <div className="bg-black/40 px-3 py-2">
                              <Badge className={statusStyle.className}>{statusStyle.label}</Badge>
                            </div>
                            <div className="bg-black/40 px-3 py-2">
                              <div className="font-medium text-gray-100">{primaryLabel || '—'}</div>
                              <div className="text-xs text-gray-500">{assoc.primarySeries?.modality || ''}</div>
                            </div>
                            <div className="bg-black/40 px-3 py-2">
                              <div className="font-medium text-gray-100">{secondaryLabel || '—'}</div>
                              <div className="text-xs text-gray-500">{assoc.secondarySeries?.modality || ''}</div>
                            </div>
                            <div className="bg-black/40 px-3 py-2">
                              <div className="text-gray-100">{registrationLabel || '—'}</div>
                              <div className="text-xs text-gray-500 truncate">{assoc.registrationFilePath || '—'}</div>
                            </div>
                            <div className="bg-black/40 px-3 py-2">
                              <div className="text-gray-100">{derivedLabel}</div>
                              {markerText && <div className="text-xs text-indigo-300">{markerText}</div>}
                            </div>
                            <div className="bg-black/40 px-3 py-2 text-xs text-gray-400">
                              {assoc.reason || assoc.transformSource || '—'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No fusion associations found yet for this patient.</p>
                  )}
                </CardContent>
              </Card>

              {fusionOverview && fusionOverview.studies.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {fusionOverview.studies.map((study) => {
                    const derivedIds = new Set(study.derivedSeries.map((d) => d.id));
                    const registrationIds = new Set(study.registrationSeries.map((r) => r.id));
                    const baselineSeries = study.series.filter((series) => !derivedIds.has(series.id) && !registrationIds.has(series.id));
                    return (
                      <Card key={study.id} className="bg-gray-950/90 border border-gray-700/60">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{study.studyDescription || study.studyInstanceUID}</CardTitle>
                          <CardDescription>
                            {study.studyDate ? `Date ${study.studyDate}` : 'Study'} • {Object.entries(study.modalityCounts).map(([modality, count]) => `${modality}: ${count}`).join(' · ')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">Primary / Original Series</h4>
                            {baselineSeries.length ? (
                              <ul className="space-y-2 text-sm text-gray-200">
                                {baselineSeries.map((series) => (
                                  <li key={series.id} className="rounded border border-gray-800/40 bg-black/30 px-3 py-2">
                                    <div className="font-medium">{series.seriesDescription || series.seriesInstanceUID}</div>
                                    <div className="text-xs text-gray-500">Modality {series.modality || '—'} · Images {series.imageCount ?? '—'}</div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-500">No baseline series recorded.</p>
                            )}
                          </div>

                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-200">Registration Files</h4>
                            {study.registrationSeries.length ? (
                              <ul className="space-y-2 text-sm text-gray-200">
                                {study.registrationSeries.map((series) => (
                                  <li key={series.id} className="rounded border border-sky-900/40 bg-sky-950/20 px-3 py-2">
                                    <div className="font-medium">{series.seriesDescription || series.seriesInstanceUID}</div>
                                    <div className="text-xs text-gray-400 truncate">{series.filePath || 'Missing file'}</div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-500">No REG files detected for this study.</p>
                            )}
                          </div>

                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">Derived Series</h4>
                            {study.derivedSeries.length ? (
                              <ul className="space-y-2 text-sm text-gray-200">
                                {study.derivedSeries.map((series) => (
                                  <li key={series.id} className="rounded border border-emerald-900/40 bg-emerald-950/20 px-3 py-2">
                                    <div className="font-medium">{series.seriesDescription || series.seriesInstanceUID}</div>
                                    <div className="text-xs text-gray-300">Markers: {series.fusion.markers.join(', ')}</div>
                                    {series.fusion.outputDirectory && (
                                      <div className="text-xs text-gray-500 truncate">{series.fusion.outputDirectory}</div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-500">No derived series generated yet.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : fusionPatientId != null && !fusionOverviewLoading ? (
                <Card className="bg-gray-950/90 border border-gray-700/60">
                  <CardContent className="py-6 text-center text-sm text-gray-400">
                    No fusion studies available for this patient yet.
                  </CardContent>
                </Card>
              ) : null}
              </div>
            </TabsContent>

            {/* Metadata Tab */}
            <TabsContent value="metadata" className="absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-white">DICOM Metadata</h2>
                  <span className="text-xs text-gray-500">View and edit DICOM tags and series information</span>
                </div>
                <MetadataViewer />
              </div>
            </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="w-[440px] flex-shrink-0 flex flex-col h-full bg-gray-950/50">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Recently Opened */}
            <div className="bg-cyan-950/40 backdrop-blur-xl border border-cyan-500/25 rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <Clock className="h-4.5 w-4.5 text-cyan-400" />
                <span className="text-cyan-200 font-bold text-sm">Recently Opened</span>
                <span className="ml-auto text-xs text-cyan-400/70 bg-cyan-500/15 px-2 py-0.5 rounded-md font-semibold">{recentlyOpenedPatients.length}</span>
              </div>
              {recentlyOpenedPatients.length === 0 ? (
                <p className="text-cyan-300/40 text-sm py-3 text-center">No recently opened patients</p>
              ) : (
                <div className="space-y-1.5">
                  {recentlyOpenedPatients.slice(0, 5).map(patientId => {
                    const patient = patients.find(p => p.id === patientId);
                    return patient ? (
                      <Link 
                        key={patientId}
                        href={`/enhanced-viewer?patientId=${patient.patientID}`}
                        className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-cyan-500/15 transition-all"
                        onClick={() => trackPatientOpened(patientId)}
                      >
                        <div className="w-1.5 h-6 rounded-full bg-cyan-500/40 group-hover:bg-cyan-400/70 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-sm truncate">{patient.patientName?.replace(/\^/g, ', ')}</div>
                          <div className="text-cyan-300/60 text-xs font-mono mt-0.5">{patient.patientID}</div>
                        </div>
                      </Link>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Favorites */}
            <div className="bg-amber-950/40 backdrop-blur-xl border border-amber-500/25 rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <Star className="h-4.5 w-4.5 text-amber-400" />
                <span className="text-amber-200 font-bold text-sm">Favorites</span>
                <span className="ml-auto text-xs text-amber-400/70 bg-amber-500/15 px-2 py-0.5 rounded-md font-semibold">{favoritePatients.size}</span>
              </div>
              {favoritePatients.size === 0 ? (
                <p className="text-amber-300/40 text-sm py-3 text-center">No favorites yet</p>
              ) : (
                <div className="space-y-1.5">
                  {Array.from(favoritePatients).slice(0, 5).map(patientId => {
                    const patient = patients.find(p => p.id === patientId);
                    return patient ? (
                      <Link 
                        key={patientId}
                        href={`/enhanced-viewer?patientId=${patient.patientID}`}
                        className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-amber-500/15 transition-all"
                        onClick={() => trackPatientOpened(patientId)}
                      >
                        <div className="w-1.5 h-6 rounded-full bg-amber-500/40 group-hover:bg-amber-400/70 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-sm truncate">{patient.patientName?.replace(/\^/g, ', ')}</div>
                          <div className="text-amber-300/60 text-xs font-mono mt-0.5">{patient.patientID}</div>
                        </div>
                      </Link>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Recently Imported */}
            <div className="bg-emerald-950/40 backdrop-blur-xl border border-emerald-500/25 rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <Import className="h-4.5 w-4.5 text-emerald-400" />
                <span className="text-emerald-200 font-bold text-sm">Recently Imported</span>
                <span className="ml-auto text-xs text-emerald-400/70 bg-emerald-500/15 px-2 py-0.5 rounded-md font-semibold">{recentlyImportedPatients.length}</span>
              </div>
              {recentlyImportedPatients.length === 0 ? (
                <p className="text-emerald-300/40 text-sm py-3 text-center">No imports yet</p>
              ) : (
                <div className="space-y-1.5">
                  {recentlyImportedPatients.slice(0, 5).map(importEntry => {
                    const patient = patients.find(p => p.id === importEntry.patientId || p.patientID === importEntry.patientId);
                    return patient ? (
                      <Link 
                        key={importEntry.patientId}
                        href={`/enhanced-viewer?patientId=${patient.patientID}`}
                        className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-emerald-500/15 transition-all"
                        onClick={() => trackPatientOpened(typeof importEntry.patientId === 'number' ? importEntry.patientId : parseInt(importEntry.patientId.toString()))}
                      >
                        <div className="w-1.5 h-6 rounded-full bg-emerald-500/40 group-hover:bg-emerald-400/70 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-sm truncate">{patient.patientName?.replace(/\^/g, ', ')}</div>
                          <div className="text-emerald-300/60 text-xs font-mono mt-0.5">{patient.patientID}</div>
                        </div>
                        <div className="text-xs text-emerald-300/60 font-medium">
                          {new Date(importEntry.importDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </Link>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">Export DICOM Files</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select the series you want to export
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {exportItems.map((item) => (
              <div key={item.id} className="flex items-center space-x-3 p-3 rounded hover:bg-gray-800/50">
                <Checkbox
                  id={item.id}
                  checked={selectedExportItems.has(item.id)}
                  onCheckedChange={(checked) => {
                    const newSet = new Set(selectedExportItems);
                    if (checked) {
                      newSet.add(item.id);
                    } else {
                      newSet.delete(item.id);
                    }
                    setSelectedExportItems(newSet);
                  }}
                  className="border-gray-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <label htmlFor={item.id} className="flex-1 cursor-pointer">
                  <div className="text-white font-medium">{item.name}</div>
                  <div className="text-gray-400 text-sm">{item.description}</div>
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              className="border-gray-600 text-gray-400 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportConfirm}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Export Selected ({selectedExportItems.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Merge Patients</DialogTitle>
            <DialogDescription className="text-gray-400">
              Choose how to merge the selected patients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">Merge Option</Label>
              <Select defaultValue="existing">
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="existing" className="text-white hover:bg-gray-700">
                    Merge into existing patient
                  </SelectItem>
                  <SelectItem value="new" className="text-white hover:bg-gray-700">
                    Merge into new patient
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-white">Selected Patients</Label>
              <div className="bg-gray-800 rounded p-3 space-y-2">
                {Array.from(selectedPatients).map(patientId => {
                  const patient = patients.find(p => p.id === patientId);
                  return patient ? (
                    <div key={patientId} className="text-gray-300">
                      {patient.patientName} (ID: {patient.patientID})
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMergeDialog(false)}
              className="border-gray-600 text-gray-400 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleMergeConfirm('existing')}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Merge Patients
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Metadata Viewer Component
function MetadataViewer() {
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [expandedSeries, setExpandedSeries] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/metadata/all');
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  const toggleSeries = (seriesId: number) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-8 text-center">
        <div className="inline-flex items-center gap-2 text-gray-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.64 5.64L4.22 4.22M19.78 19.78l-1.42-1.42M5.64 18.36L4.22 19.78M19.78 4.22l-1.42 1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Loading metadata...
        </div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-800/50 ring-1 ring-gray-700/50 mb-4">
          <FileText className="h-7 w-7 text-gray-500" />
        </div>
        <p className="text-gray-400 font-medium">No metadata available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-emerald-950/40 via-gray-900/80 to-gray-900/80 rounded-xl border border-emerald-500/20 shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-emerald-500/15 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/30">
              <Database className="h-5 w-5 text-emerald-300" />
            </div>
            <h3 className="text-sm font-medium text-white">DICOM Database Summary</h3>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Patients</p>
              <p className="text-2xl font-bold text-white mt-1">{metadata.summary.totalPatients}</p>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Studies</p>
              <p className="text-2xl font-bold text-white mt-1">{metadata.summary.totalStudies}</p>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Series</p>
              <p className="text-2xl font-bold text-white mt-1">{metadata.summary.totalSeries}</p>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Images</p>
              <p className="text-2xl font-bold text-white mt-1">{metadata.summary.totalImages}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metadata */}
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/30 bg-gray-900/40">
          <h3 className="text-sm font-medium text-white">Detailed DICOM Metadata</h3>
          <p className="text-sm text-gray-400 mt-0.5">Click on series to expand and view image metadata</p>
        </div>
        <div className="p-5">
          <div className="space-y-4">
            {metadata.patients.map((patient: any) => {
              const patientStudies = metadata.studies.filter((s: any) => s.patientId === patient.id);
              const patientSeries = metadata.series.filter((s: any) => 
                patientStudies.some((study: any) => study.id === s.studyId)
              );
              
              return (
                <div key={patient.id} className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/30">
                  <h3 className="text-white font-semibold mb-2">
                    {patient.patientName} (ID: {patient.patientID})
                  </h3>
                  
                  {patientSeries.map((series: any) => (
                    <div key={series.id} className="ml-4 mb-2">
                      <button
                        onClick={() => toggleSeries(series.id)}
                        className="w-full text-left p-2 rounded hover:bg-gray-700/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <Badge className="mr-2" variant="outline">
                              {series.modality}
                            </Badge>
                            <span className="text-gray-300">
                              {series.seriesDescription || 'Series ' + series.seriesNumber}
                            </span>
                            <span className="text-gray-500 ml-2">
                              ({series.imageCount || series.images?.length || 0} images)
                            </span>
                          </div>
                          <span className="text-gray-500">
                            {expandedSeries.has(series.id) ? '▼' : '▶'}
                          </span>
                        </div>
                      </button>
                      
                      {expandedSeries.has(series.id) && series.images && (
                        <div className="ml-8 mt-2 space-y-1 text-sm">
                          <div className="grid grid-cols-2 gap-2 text-gray-400">
                            <div>Series UID: {series.seriesInstanceUID}</div>
                            <div>Slice Thickness: {series.sliceThickness || 'N/A'}</div>
                          </div>
                          {series.metadata && (
                            <div className="mt-2 p-2 bg-gray-900/50 rounded">
                              <pre className="text-xs text-gray-500 overflow-x-auto">
                                {JSON.stringify(series.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          {series.images.slice(0, 3).map((image: any, idx: number) => (
                            <div key={image.id} className="p-2 bg-gray-900/50 rounded">
                              <div className="text-gray-300">
                                Instance #{image.instanceNumber}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                <div>Slice Location: {image.sliceLocation || 'N/A'}</div>
                                <div>Window: {image.windowCenter}/{image.windowWidth}</div>
                                <div>Position: {image.imagePosition || 'N/A'}</div>
                                <div>Orientation: {image.imageOrientation || 'N/A'}</div>
                              </div>
                            </div>
                          ))}
                          {series.images.length > 3 && (
                            <p className="text-gray-500 text-xs">
                              ... and {series.images.length - 3} more images
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
