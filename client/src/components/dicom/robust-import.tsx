/**
 * Robust DICOM Import Component
 * 
 * Designed for large patient datasets (20k+ files, up to 2GB per patient)
 * Features:
 * - Chunked upload with progress tracking
 * - ZIP file extraction support (recommended for large datasets)
 * - Clear 2-stage workflow: Scan/Preview → Commit to Database
 * - Streaming server-side parsing
 * - Session recovery for interrupted uploads
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  FolderOpen, 
  FileArchive, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Scan,
  X,
  ChevronDown,
  ChevronRight,
  FileCheck,
  Trash2,
  RefreshCw,
  HardDrive,
  Users,
  Layers,
  Image as ImageIcon,
  Clock,
  Activity
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

// Types
interface ScanProgress {
  phase: 'uploading' | 'extracting' | 'scanning' | 'complete' | 'error';
  uploadProgress: number;
  filesUploaded: number;
  totalFiles: number;
  currentFile?: string;
  bytesUploaded: number;
  totalBytes: number;
}

interface SeriesPreview {
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  imageCount: number;
  seriesNumber?: number;
}

interface StudyPreview {
  studyInstanceUID: string;
  studyDate: string;
  studyDescription?: string;
  series: SeriesPreview[];
  totalImages: number;
  modalities: string[];
}

interface PatientPreview {
  patientID: string;
  patientName: string;
  studies: StudyPreview[];
  totalImages: number;
  totalStudies: number;
  totalSeries: number;
  rtStructures?: Array<{ name: string; color: [number, number, number] }>;
}

interface ScanResult {
  sessionId: string;
  success: boolean;
  totalFiles: number;
  successCount: number;
  errorCount: number;
  patients: PatientPreview[];
  errors?: Array<{ filename: string; error: string }>;
  uploadPath: string;
}

interface ImportState {
  stage: 'idle' | 'scanning' | 'preview' | 'importing' | 'success' | 'error';
  progress?: ScanProgress;
  result?: ScanResult;
  error?: string;
}

export function RobustImport() {
  const [state, setState] = useState<ImportState>({ stage: 'idle' });
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [pendingSessions, setPendingSessions] = useState<ScanResult[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load pending sessions on mount
  useEffect(() => {
    loadPendingSessions();
    const interval = setInterval(loadPendingSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingSessions = async () => {
    try {
      const response = await fetch('/api/import/pending-sessions');
      if (response.ok) {
        const data = await response.json();
        setPendingSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading pending sessions:', error);
    }
  };

  // Handle ZIP file upload
  const handleZipUpload = async (file: File) => {
    setState({
      stage: 'scanning',
      progress: {
        phase: 'uploading',
        uploadProgress: 0,
        filesUploaded: 0,
        totalFiles: 0,
        bytesUploaded: 0,
        totalBytes: file.size
      }
    });

    try {
      abortControllerRef.current = new AbortController();
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'zip');

      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState(prev => ({
              ...prev,
              progress: {
                ...prev.progress!,
                uploadProgress: Math.round((e.loaded / e.total) * 100),
                bytesUploaded: e.loaded,
                totalBytes: e.total
              }
            }));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText || 'Upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('POST', '/api/import/upload-archive');
        xhr.send(formData);
      });

      const uploadResult = await uploadPromise;

      setState(prev => ({
        ...prev,
        progress: { ...prev.progress!, phase: 'extracting' }
      }));

      await pollScanProgress(uploadResult.sessionId);

    } catch (error) {
      if ((error as Error).message === 'Upload cancelled') {
        setState({ stage: 'idle' });
      } else {
        setState({
          stage: 'error',
          error: (error as Error).message || 'Upload failed'
        });
      }
    }
  };

  // Handle folder/file upload
  const handleFilesUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const dicomFiles = files.filter(f => 
      f.name.toLowerCase().endsWith('.dcm') || 
      !f.name.includes('.') ||
      f.name.toLowerCase().endsWith('.ima')
    );

    if (dicomFiles.length === 0) {
      toast({
        title: "No DICOM files found",
        description: "Please select a folder containing .dcm files or a ZIP archive",
        variant: "destructive"
      });
      return;
    }

    const totalSize = dicomFiles.reduce((sum, f) => sum + f.size, 0);

    setState({
      stage: 'scanning',
      progress: {
        phase: 'uploading',
        uploadProgress: 0,
        filesUploaded: 0,
        totalFiles: dicomFiles.length,
        bytesUploaded: 0,
        totalBytes: totalSize
      }
    });

    try {
      abortControllerRef.current = new AbortController();

      const initResponse = await fetch('/api/import/init-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileCount: dicomFiles.length,
          totalSize 
        })
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize upload session');
      }

      const { sessionId } = await initResponse.json();

      const BATCH_SIZE = 100;
      let uploadedCount = 0;
      let uploadedBytes = 0;

      for (let i = 0; i < dicomFiles.length; i += BATCH_SIZE) {
        const batch = dicomFiles.slice(i, Math.min(i + BATCH_SIZE, dicomFiles.length));
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        
        batch.forEach(file => {
          formData.append('files', file, file.webkitRelativePath || file.name);
        });

        const batchSize = batch.reduce((sum, f) => sum + f.size, 0);

        const response = await fetch('/api/import/upload-batch', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to upload batch: ${await response.text()}`);
        }

        uploadedCount += batch.length;
        uploadedBytes += batchSize;

        setState(prev => ({
          ...prev,
          progress: {
            ...prev.progress!,
            uploadProgress: Math.round((uploadedBytes / totalSize) * 100),
            filesUploaded: uploadedCount,
            bytesUploaded: uploadedBytes,
            currentFile: batch[batch.length - 1]?.name
          }
        }));
      }

      setState(prev => ({
        ...prev,
        progress: { ...prev.progress!, phase: 'scanning' }
      }));

      await fetch('/api/import/start-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      await pollScanProgress(sessionId);

    } catch (error) {
      if ((error as Error).message?.includes('abort') || 
          (error as Error).name === 'AbortError') {
        setState({ stage: 'idle' });
      } else {
        setState({
          stage: 'error',
          error: (error as Error).message || 'Upload failed'
        });
      }
    }
  };

  // Poll for scan progress
  const pollScanProgress = async (sessionId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/import/session/${sessionId}`);
        if (!response.ok) {
          throw new Error('Failed to get session status');
        }

        const session = await response.json();

        if (session.status === 'scanning') {
          setState(prev => ({
            ...prev,
            progress: {
              phase: 'scanning',
              uploadProgress: 100,
              filesUploaded: session.scannedFiles || 0,
              totalFiles: session.totalFiles || 0,
              bytesUploaded: prev.progress?.bytesUploaded || 0,
              totalBytes: prev.progress?.totalBytes || 0,
              currentFile: session.currentFile
            }
          }));
          setTimeout(poll, 200);
        } else if (session.status === 'complete' || session.status === 'ready') {
          setState({
            stage: 'preview',
            result: session.result
          });
          loadPendingSessions();
        } else if (session.status === 'error') {
          setState({
            stage: 'error',
            error: session.error || 'Scan failed'
          });
        } else {
          setTimeout(poll, 500);
        }
      } catch (error) {
        setState({
          stage: 'error',
          error: (error as Error).message || 'Failed to check progress'
        });
      }
    };

    poll();
  };

  // Handle import to database
  const handleImport = async () => {
    if (!state.result) return;

    setState(prev => ({ ...prev, stage: 'importing' }));

    try {
      const response = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.result.sessionId })
      });

      if (!response.ok) {
        throw new Error(await response.text() || 'Import failed');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/series'] });

      // Track recently imported patients with timestamps
      if (state.result.patients && state.result.patients.length > 0) {
        const importTimestamp = Date.now();
        state.result.patients.forEach(patient => {
          const recentlyImported = JSON.parse(localStorage.getItem('recentlyImportedPatients') || '[]');
          // Use patientID (uppercase D) to match the PatientPreview interface
          const patientId = patient.patientID;
          const newEntry = { patientId, importDate: importTimestamp };
          const updated = [newEntry, ...recentlyImported.filter((item: any) => item.patientId !== patientId)].slice(0, 10);
          localStorage.setItem('recentlyImportedPatients', JSON.stringify(updated));
        });
        // Trigger event to update patient manager
        window.dispatchEvent(new Event('recentlyImportedUpdated'));
      }

      setState({ stage: 'success', result: state.result });

      toast({
        title: "Import successful!",
        description: `Imported ${state.result.patients.length} patient(s) with ${state.result.totalFiles} images`,
      });

      loadPendingSessions();

    } catch (error) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: (error as Error).message || 'Import failed'
      }));
    }
  };

  // Handle session import from pending list
  const handlePendingSessionImport = async (session: ScanResult) => {
    setState({
      stage: 'preview',
      result: session
    });
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/import/session/${sessionId}`, {
        method: 'DELETE'
      });
      loadPendingSessions();
      if (state.result?.sessionId === sessionId) {
        setState({ stage: 'idle' });
      }
      toast({
        title: "Session deleted",
        description: "Upload session and files have been removed"
      });
    } catch (error) {
      toast({
        title: "Failed to delete session",
        variant: "destructive"
      });
    }
  };

  // Cancel current operation
  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setState({ stage: 'idle' });
  };

  // Reset to idle
  const handleReset = () => {
    setState({ stage: 'idle' });
  };

  // Toggle patient expansion
  const togglePatient = (patientId: string) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  // Dropzone config
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length === 1 && acceptedFiles[0].name.toLowerCase().endsWith('.zip')) {
        handleZipUpload(acceptedFiles[0]);
      } else {
        handleFilesUpload(acceptedFiles);
      }
    },
    accept: {
      'application/zip': ['.zip'],
      'application/dicom': ['.dcm'],
      'application/octet-stream': ['.dcm', '.ima']
    },
    noClick: state.stage !== 'idle',
    noKeyboard: state.stage !== 'idle',
    disabled: state.stage !== 'idle'
  });

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Handle folder selection
  const handleFolderClick = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesUpload(Array.from(files));
    }
    e.target.value = '';
  };

  // Get modality badge style
  const getModalityStyle = (modality: string) => {
    switch (modality) {
      case 'CT': return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
      case 'MR': return 'bg-green-500/20 border-green-500/40 text-green-300';
      case 'PT': case 'PET': return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
      case 'RTSTRUCT': return 'bg-purple-500/20 border-purple-500/40 text-purple-300';
      case 'RTDOSE': return 'bg-orange-500/20 border-orange-500/40 text-orange-300';
      case 'RTPLAN': return 'bg-red-500/20 border-red-500/40 text-red-300';
      default: return 'bg-gray-500/20 border-gray-500/40 text-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        // @ts-ignore - webkitdirectory is not in React types
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderChange}
      />

      {/* Main Upload Zone */}
      <Card className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-xl overflow-hidden">
        <div
          {...getRootProps()}
          className={`p-6 text-center transition-all duration-200 ${
            isDragActive ? 'bg-purple-500/10 border-purple-400' : ''
          } ${state.stage !== 'idle' ? 'pointer-events-none' : 'cursor-pointer hover:bg-gray-800/50'}`}
        >
          <input {...getInputProps()} />

          {/* Idle State */}
          {state.stage === 'idle' && (
            <div className="space-y-5">
              <div className="flex justify-center">
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <Upload className={`w-10 h-10 ${isDragActive ? 'text-purple-300' : 'text-purple-400'}`} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {isDragActive ? 'Drop files here' : 'Import DICOM Files'}
                </h3>
                <p className="text-sm text-gray-400">
                  Supports large datasets with 20,000+ files (up to 2GB per patient)
                </p>
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={(e) => { e.stopPropagation(); handleFolderClick(); }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-sm"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Select Folder
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileArchive className="w-4 h-4 mr-2" />
                  Upload ZIP Archive
                </Button>
              </div>

              <div className="pt-4 border-t border-gray-700/50">
                <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Up to 2GB per patient</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>20,000+ files supported</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileArchive className="w-3.5 h-3.5" />
                    <span>ZIP recommended for large datasets</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scanning State */}
          {state.stage === 'scanning' && state.progress && (
            <div className="space-y-5 py-2">
              <div className="flex justify-center">
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {state.progress.phase === 'uploading' && 'Uploading Files...'}
                  {state.progress.phase === 'extracting' && 'Extracting Archive...'}
                  {state.progress.phase === 'scanning' && 'Scanning DICOM Files...'}
                </h3>
                
                {state.progress.phase === 'uploading' && (
                  <div className="space-y-3 mt-4 max-w-md mx-auto">
                    <Progress value={state.progress.uploadProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{state.progress.filesUploaded.toLocaleString()} / {state.progress.totalFiles.toLocaleString()} files</span>
                      <span>{formatBytes(state.progress.bytesUploaded)} / {formatBytes(state.progress.totalBytes)}</span>
                    </div>
                  </div>
                )}

                {state.progress.phase === 'scanning' && (
                  <div className="space-y-3 mt-4 max-w-md mx-auto">
                    <Progress 
                      value={state.progress.totalFiles > 0 
                        ? (state.progress.filesUploaded / state.progress.totalFiles) * 100 
                        : 0
                      } 
                      className="h-2" 
                    />
                    <div className="text-xs text-gray-400">
                      <span>Scanned {state.progress.filesUploaded.toLocaleString()} files</span>
                      {state.progress.currentFile && (
                        <span className="block mt-1 text-gray-500 truncate max-w-sm mx-auto">
                          {state.progress.currentFile}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {state.progress.phase === 'extracting' && (
                  <p className="text-sm text-gray-400 mt-2">Please wait while the archive is extracted...</p>
                )}
              </div>

              <Button
                variant="outline"
                onClick={handleCancel}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}

          {/* Importing State */}
          {state.stage === 'importing' && (
            <div className="space-y-5 py-2">
              <div className="flex justify-center">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <Database className="w-10 h-10 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Importing to Database...</h3>
                <p className="text-sm text-gray-400">Moving files to permanent storage and creating database records</p>
              </div>
            </div>
          )}

          {/* Success State */}
          {state.stage === 'success' && state.result && (
            <div className="space-y-5 py-2">
              <div className="flex justify-center">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-emerald-400 mb-1">
                  Import Complete! 🎉
                </h3>
                <p className="text-gray-300">
                  Successfully imported{' '}
                  <span className="text-emerald-400 font-semibold">{state.result.patients.length}</span> patient(s) with{' '}
                  <span className="text-emerald-400 font-semibold">{state.result.totalFiles.toLocaleString()}</span> images
                </p>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <Button
                  onClick={() => setLocation('/')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  Go to Patient Manager
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Import More Files
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {state.stage === 'error' && (
            <div className="space-y-5 py-2">
              <div className="flex justify-center">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                  <AlertCircle className="w-10 h-10 text-red-400" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-red-400 mb-1">Import Failed</h3>
                <p className="text-sm text-gray-400">{state.error}</p>
              </div>

              <Button
                onClick={handleReset}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Preview State - Show patient breakdown */}
      {state.stage === 'preview' && state.result && (
        <Card className="bg-gray-900/80 backdrop-blur-xl border border-purple-500/30 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Scan className="w-5 h-5 text-purple-400" />
              Scan Complete - Ready to Import
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs">
              Review the detected patients and studies before committing to the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-950/60 border border-gray-700/50 rounded-lg p-3 text-center">
                <Users className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{state.result.patients.length}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Patients</div>
              </div>
              <div className="bg-gray-950/60 border border-gray-700/50 rounded-lg p-3 text-center">
                <FileCheck className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{state.result.successCount.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Files Parsed</div>
              </div>
              <div className="bg-gray-950/60 border border-gray-700/50 rounded-lg p-3 text-center">
                <ImageIcon className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-white">{state.result.totalFiles.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Total Images</div>
              </div>
              {state.result.errorCount > 0 && (
                <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3 text-center">
                  <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                  <div className="text-xl font-bold text-red-400">{state.result.errorCount}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Errors</div>
                </div>
              )}
            </div>

            <Separator className="bg-gray-700/50" />

            {/* Patient List */}
            <ScrollArea className="h-[320px] pr-2">
              <div className="space-y-2">
                {state.result.patients.map((patient) => (
                  <div 
                    key={patient.patientID} 
                    className="border border-gray-700/50 rounded-lg bg-gray-950/40 overflow-hidden"
                  >
                    <button
                      onClick={() => togglePatient(patient.patientID)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-800/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {expandedPatients.has(patient.patientID) ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <div>
                          <h4 className="text-white font-medium text-sm">{patient.patientName || 'Anonymous'}</h4>
                          <p className="text-xs text-gray-500">ID: {patient.patientID}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-purple-400">{patient.totalStudies} studies</p>
                          <p className="text-[10px] text-gray-500">{patient.totalImages.toLocaleString()} images</p>
                        </div>
                        <div className="flex gap-1">
                          {Array.from(new Set(patient.studies.flatMap(s => s.modalities))).slice(0, 4).map(mod => (
                            <Badge 
                              key={mod} 
                              variant="outline" 
                              className={`text-[10px] px-1.5 py-0 ${getModalityStyle(mod)}`}
                            >
                              {mod}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {expandedPatients.has(patient.patientID) && (
                      <div className="px-3 pb-3 pl-10 space-y-2">
                        {patient.studies.map((study) => (
                          <div 
                            key={study.studyInstanceUID}
                            className="bg-gray-900/60 rounded-lg p-2.5 border border-gray-700/30"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-white font-medium text-xs">
                                  {study.studyDescription || 'Study'}
                                </p>
                                <p className="text-[10px] text-gray-500">{study.studyDate}</p>
                              </div>
                              <p className="text-[10px] text-gray-400">{study.totalImages} images</p>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {study.series.map((series) => (
                                <Badge 
                                  key={series.seriesInstanceUID}
                                  variant="secondary"
                                  className="text-[10px] bg-gray-800/60 text-gray-300 border-gray-600/50"
                                >
                                  {series.modality}: {series.seriesDescription || `Series ${series.seriesNumber || ''}`} ({series.imageCount})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* RT Structures if present */}
                        {patient.rtStructures && patient.rtStructures.length > 0 && (
                          <div className="mt-2 p-2.5 bg-purple-900/20 rounded-lg border border-purple-500/20">
                            <p className="text-[10px] text-purple-300 mb-1.5">RT Structures:</p>
                            <div className="flex flex-wrap gap-1">
                              {patient.rtStructures.slice(0, 8).map((struct, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: `rgba(${struct.color[0]}, ${struct.color[1]}, ${struct.color[2]}, 0.2)`,
                                    color: `rgb(${Math.min(255, struct.color[0] + 50)}, ${Math.min(255, struct.color[1] + 50)}, ${Math.min(255, struct.color[2] + 50)})`
                                  }}
                                >
                                  {struct.name}
                                </span>
                              ))}
                              {patient.rtStructures.length > 8 && (
                                <span className="text-[10px] text-gray-500">
                                  +{patient.rtStructures.length - 8} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-3 border-t border-gray-700/50">
              <Button
                variant="outline"
                onClick={() => handleDeleteSession(state.result!.sessionId)}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Discard
              </Button>
              <Button
                onClick={handleImport}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                <Database className="w-4 h-4 mr-2" />
                Import to Database
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Sessions */}
      {pendingSessions.length > 0 && state.stage === 'idle' && (
        <Card className="bg-gray-900/80 backdrop-blur-xl border border-amber-500/30 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-300 text-sm">
              <Clock className="w-4 h-4" />
              Pending Import Sessions
            </CardTitle>
            <CardDescription className="text-amber-200/60 text-xs">
              These scans are ready to be imported into the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingSessions.map((session) => (
                <div 
                  key={session.sessionId}
                  className="flex items-center justify-between p-3 bg-gray-950/40 rounded-lg border border-amber-500/20"
                >
                  <div>
                    <p className="text-white font-medium text-sm">
                      {session.patients.length} patient(s) • {session.totalFiles.toLocaleString()} files
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.patients.map(p => p.patientName || p.patientID).join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handlePendingSessionImport(session)}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8"
                    >
                      <Database className="w-3.5 h-3.5 mr-1.5" />
                      Review & Import
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSession(session.sessionId)}
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
