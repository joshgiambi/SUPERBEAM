/**
 * Robust Import Routes
 * 
 * Server-side endpoints for handling large DICOM imports:
 * - Batch uploads (20k+ files)
 * - ZIP archive extraction
 * - Streaming DICOM parsing
 * - Session management
 * - Progress tracking
 */

import { Express, Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import dicomParser from 'dicom-parser';
import yauzl from 'yauzl';
import { storage } from './storage';
import { logger } from './logger';
import { triggerDvhPrecompute } from './dvh-api';

// Types
interface ImportSession {
  sessionId: string;
  status: 'uploading' | 'extracting' | 'scanning' | 'ready' | 'importing' | 'complete' | 'error';
  uploadPath: string;
  totalFiles: number;
  scannedFiles: number;
  currentFile?: string;
  result?: ScanResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ScanResult {
  sessionId: string;
  success: boolean;
  totalFiles: number;
  successCount: number;
  errorCount: number;
  patients: PatientPreview[];
  errors: Array<{ filename: string; error: string }>;
  uploadPath: string;
  parsedData: any[];
  rtstructDetails: any;
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

interface StudyPreview {
  studyInstanceUID: string;
  studyDate: string;
  studyDescription?: string;
  series: SeriesPreview[];
  totalImages: number;
  modalities: string[];
}

interface SeriesPreview {
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  imageCount: number;
  seriesNumber?: number;
}

// Session storage
const importSessions = new Map<string, ImportSession>();

// Configuration
const UPLOAD_BASE_PATH = 'uploads/import-sessions';
const MAX_FILES_PER_SESSION = 50000; // 50k files max
const MAX_SESSION_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB max per session
const IMPORT_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours TTL for import sessions
const IMPORT_SESSION_MAX_COUNT = 20; // Max concurrent import sessions

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_BASE_PATH)) {
  fs.mkdirSync(UPLOAD_BASE_PATH, { recursive: true });
}

// Periodic cleanup of stale import sessions
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of importSessions.entries()) {
    // Clean up sessions older than TTL
    if (now - session.createdAt.getTime() > IMPORT_SESSION_TTL_MS) {
      importSessions.delete(sessionId);
      // Also try to clean up the session directory
      const sessionDir = path.join(UPLOAD_BASE_PATH, sessionId);
      if (fs.existsSync(sessionDir)) {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }
}, 10 * 60 * 1000); // Run every 10 minutes

// Generate session ID
function generateSessionId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Check if file is DICOM
function isDICOMFile(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(132);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 132, 0);
    fs.closeSync(fd);
    return buffer.toString('ascii', 128, 132) === 'DICM';
  } catch {
    return false;
  }
}

// Extract DICOM metadata
function extractDICOMMetadata(filePath: string): any | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray, {
      untilTag: 'x7fe00010' // Stop before pixel data for speed
    });

    const getString = (tag: string) => {
      try {
        return dataSet.string(tag)?.trim() || null;
      } catch {
        return null;
      }
    };

    const getNumber = (tag: string) => {
      try {
        const value = getString(tag);
        return value ? parseFloat(value) : null;
      } catch {
        return null;
      }
    };

    return {
      patientID: getString('x00100020'),
      patientName: getString('x00100010'),
      patientSex: getString('x00100040'),
      patientBirthDate: getString('x00100030'),
      patientAge: getString('x00101010'),
      studyInstanceUID: getString('x0020000d'),
      studyDate: getString('x00080020'),
      studyTime: getString('x00080030'),
      studyDescription: getString('x00081030'),
      seriesInstanceUID: getString('x0020000e'),
      seriesNumber: getNumber('x00200011'),
      seriesDescription: getString('x0008103e'),
      modality: getString('x00080060'),
      sopInstanceUID: getString('x00080018'),
      instanceNumber: getNumber('x00200013'),
      sliceLocation: getNumber('x00201041'),
      imagePositionPatient: getString('x00200032'),
      imageOrientationPatient: getString('x00200037'),
      pixelSpacing: getString('x00280030'),
      rows: getNumber('x00280010'),
      columns: getNumber('x00280011'),
      windowCenter: getNumber('x00281050'),
      windowWidth: getNumber('x00281051'),
      rescaleIntercept: getNumber('x00281052'),
      rescaleSlope: getNumber('x00281053'),
      frameOfReferenceUID: getString('x00200052'),
    };
  } catch (error) {
    return null;
  }
}

// Extract RT Structure metadata
function extractRTStructMetadata(filePath: string): any {
  try {
    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);
    
    const structures: Array<{ name: string; color: [number, number, number] }> = [];
    const structureSetROISequence = dataSet.elements.x30060020;
    const roiContourSequence = dataSet.elements.x30060039;
    
    if (structureSetROISequence && roiContourSequence) {
      const roiSeqItems = structureSetROISequence.items || [];
      const contourSeqItems = roiContourSequence.items || [];
      
      for (let i = 0; i < roiSeqItems.length; i++) {
        const roiItem = roiSeqItems[i];
        const roiName = roiItem.dataSet?.string('x30060026') || `ROI_${i}`;
        
        // Find matching contour item for color
        let color: [number, number, number] = [255, 0, 0];
        if (contourSeqItems[i]) {
          const colorStr = contourSeqItems[i].dataSet?.string('x3006002a');
          if (colorStr) {
            const parts = colorStr.split('\\').map(Number);
            if (parts.length >= 3) {
              color = [parts[0], parts[1], parts[2]];
            }
          }
        }
        
        structures.push({ name: roiName, color });
      }
    }
    
    return {
      structureSetLabel: dataSet.string('x30060002'),
      structureSetDate: dataSet.string('x30060008'),
      structures
    };
  } catch {
    return { structures: [] };
  }
}

// Get all files in directory recursively
function getAllFiles(dirPath: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return fileList;
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      // Only include likely DICOM files
      const ext = path.extname(file).toLowerCase();
      if (ext === '.dcm' || ext === '.ima' || ext === '' || !file.includes('.')) {
        fileList.push(fullPath);
      }
    }
  }
  
  return fileList;
}

// Scan files and build preview
async function scanSessionFiles(sessionId: string): Promise<void> {
  const session = importSessions.get(sessionId);
  if (!session) return;

  session.status = 'scanning';
  session.updatedAt = new Date();

  try {
    const files = getAllFiles(session.uploadPath);
    session.totalFiles = files.length;
    
    const parsedData: any[] = [];
    const rtstructDetails: any = {};
    const errors: Array<{ filename: string; error: string }> = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const filename = path.basename(filePath);
      session.scannedFiles = i + 1;
      session.currentFile = filename;
      session.updatedAt = new Date();

      try {
        if (!isDICOMFile(filePath)) {
          errorCount++;
          errors.push({ filename, error: 'Not a valid DICOM file' });
          continue;
        }

        const metadata = extractDICOMMetadata(filePath);
        if (!metadata) {
          errorCount++;
          errors.push({ filename, error: 'Failed to extract metadata' });
          continue;
        }

        const dicomData = {
          filename,
          fileName: filename,
          filePath,
          ...metadata
        };

        // Special handling for RT structures
        if (metadata.modality === 'RTSTRUCT') {
          const rtMetadata = extractRTStructMetadata(filePath);
          dicomData.structureSetLabel = rtMetadata.structureSetLabel;
          dicomData.structureSetDate = rtMetadata.structureSetDate;
          dicomData.structures = rtMetadata.structures;
          rtstructDetails[filename] = rtMetadata;
        }

        parsedData.push(dicomData);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({ filename, error: (err as Error).message || 'Unknown error' });
      }
    }

    // Build patient preview structure
    const patientMap = new Map<string, PatientPreview>();

    for (const data of parsedData) {
      if (!data.patientID) continue;

      if (!patientMap.has(data.patientID)) {
        patientMap.set(data.patientID, {
          patientID: data.patientID,
          patientName: data.patientName || 'Anonymous',
          studies: [],
          totalImages: 0,
          totalStudies: 0,
          totalSeries: 0,
          rtStructures: []
        });
      }

      const patient = patientMap.get(data.patientID)!;
      patient.totalImages++;

      // Collect RT structures
      if (data.modality === 'RTSTRUCT' && data.structures) {
        patient.rtStructures = [...(patient.rtStructures || []), ...data.structures];
      }

      // Find or create study
      let study = patient.studies.find(s => s.studyInstanceUID === data.studyInstanceUID);
      if (!study) {
        study = {
          studyInstanceUID: data.studyInstanceUID || 'unknown',
          studyDate: data.studyDate || '',
          studyDescription: data.studyDescription,
          series: [],
          totalImages: 0,
          modalities: []
        };
        patient.studies.push(study);
        patient.totalStudies++;
      }
      study.totalImages++;

      if (data.modality && !study.modalities.includes(data.modality)) {
        study.modalities.push(data.modality);
      }

      // Find or create series
      let series = study.series.find(s => s.seriesInstanceUID === data.seriesInstanceUID);
      if (!series) {
        series = {
          seriesInstanceUID: data.seriesInstanceUID || 'unknown',
          seriesDescription: data.seriesDescription || '',
          modality: data.modality || 'OT',
          imageCount: 0,
          seriesNumber: data.seriesNumber
        };
        study.series.push(series);
        patient.totalSeries++;
      }
      series.imageCount++;
    }

    // Store result
    session.result = {
      sessionId,
      success: true,
      totalFiles: files.length,
      successCount,
      errorCount,
      patients: Array.from(patientMap.values()),
      errors: errors.slice(0, 100), // Limit error list
      uploadPath: session.uploadPath,
      parsedData,
      rtstructDetails
    };

    session.status = 'ready';
    session.updatedAt = new Date();

  } catch (error) {
    session.status = 'error';
    session.error = (error as Error).message;
    session.updatedAt = new Date();
  }
}

// Commit session to database
async function commitSession(sessionId: string): Promise<void> {
  const session = importSessions.get(sessionId);
  if (!session || !session.result) {
    throw new Error('Session not found or not ready');
  }

  session.status = 'importing';
  session.updatedAt = new Date();

  try {
    const { parsedData, rtstructDetails } = session.result;

    // Group by patient, study, series
    const patientMap = new Map<string, any>();

    for (const metadata of parsedData) {
      if (!metadata.patientID) continue;

      const patientKey = metadata.patientID;
      const studyKey = metadata.studyInstanceUID || 'UNKNOWN';
      const seriesKey = metadata.seriesInstanceUID || 'UNKNOWN';

      if (!patientMap.has(patientKey)) {
        patientMap.set(patientKey, {
          metadata,
          studies: new Map()
        });
      }

      const patient = patientMap.get(patientKey);
      if (!patient.studies.has(studyKey)) {
        patient.studies.set(studyKey, {
          metadata,
          series: new Map()
        });
      }

      const study = patient.studies.get(studyKey);
      if (!study.series.has(seriesKey)) {
        study.series.set(seriesKey, {
          metadata,
          images: []
        });
      }

      study.series.get(seriesKey).images.push(metadata);
    }

    // Process each patient
    for (const [patientKey, patientData] of patientMap) {
      // Create or get patient
      let patient = await storage.getPatientByID(patientKey);
      
      if (!patient) {
        const firstMetadata = patientData.metadata;
        patient = await storage.createPatient({
          patientID: patientKey,
          patientName: firstMetadata.patientName || 'Unknown',
          patientSex: firstMetadata.patientSex,
          dateOfBirth: firstMetadata.patientBirthDate,
          patientAge: firstMetadata.patientAge
        });
      }

      // Process studies
      for (const [studyKey, studyData] of patientData.studies) {
        let study = await storage.getStudyByUID(studyKey);
        
        if (!study) {
          const firstMetadata = studyData.metadata;
          study = await storage.createStudy({
            studyInstanceUID: studyKey,
            patientId: patient.id,
            patientName: firstMetadata.patientName || patient.patientName,
            patientID: patient.patientID,
            studyDate: firstMetadata.studyDate,
            studyTime: firstMetadata.studyTime,
            studyDescription: firstMetadata.studyDescription,
            modality: firstMetadata.modality,
            numberOfSeries: studyData.series.size,
            numberOfImages: Array.from(studyData.series.values()).reduce(
              (sum: number, s: any) => sum + s.images.length, 0
            )
          });
        }

        // Process series
        for (const [seriesKey, seriesData] of studyData.series) {
          let series = await storage.getSeriesByUID(seriesKey);
          
          if (!series) {
            const firstMetadata = seriesData.metadata;
            series = await storage.createSeries({
              seriesInstanceUID: seriesKey,
              studyId: study.id,
              seriesNumber: firstMetadata.seriesNumber,
              seriesDescription: firstMetadata.seriesDescription,
              modality: firstMetadata.modality,
              imageCount: seriesData.images.length
            });
          }

          // Move files to permanent location and create image records
          for (const imageMetadata of seriesData.images) {
            // Skip if already exists
            const existingImage = await storage.getImageByUID(imageMetadata.sopInstanceUID);
            if (existingImage) continue;

            // Move file to permanent storage
            const permanentDir = path.join(
              'storage',
              patient.patientID,
              study.studyInstanceUID,
              series.seriesInstanceUID
            );

            if (!fs.existsSync(permanentDir)) {
              fs.mkdirSync(permanentDir, { recursive: true });
            }

            const permanentPath = path.join(permanentDir, imageMetadata.filename);
            
            try {
              // Copy file to permanent location
              fs.copyFileSync(imageMetadata.filePath, permanentPath);

              // Create image record
              await storage.createImage({
                sopInstanceUID: imageMetadata.sopInstanceUID || `generated-${Date.now()}-${Math.random()}`,
                seriesId: series.id,
                instanceNumber: imageMetadata.instanceNumber || 1,
                filePath: permanentPath,
                fileName: imageMetadata.filename,
                imagePosition: imageMetadata.imagePositionPatient,
                imageOrientation: imageMetadata.imageOrientationPatient,
                pixelSpacing: imageMetadata.pixelSpacing,
                sliceLocation: imageMetadata.sliceLocation?.toString(),
                windowCenter: imageMetadata.windowCenter?.toString(),
                windowWidth: imageMetadata.windowWidth?.toString(),
                rescaleIntercept: imageMetadata.rescaleIntercept?.toString(),
                rescaleSlope: imageMetadata.rescaleSlope?.toString(),
                rows: imageMetadata.rows,
                columns: imageMetadata.columns,
                metadata: { frameOfReferenceUID: imageMetadata.frameOfReferenceUID }
              });
            } catch (err) {
              logger.error(`Failed to process image ${imageMetadata.filename}: ${err}`, 'import');
            }
          }

          // Update series image count
          await storage.updateSeriesImageCount(series.id, seriesData.images.length);
        }

        // Update study counts
        await storage.updateStudyCounts(
          study.id,
          studyData.series.size,
          Array.from(studyData.series.values()).reduce((sum: number, s: any) => sum + s.images.length, 0)
        );
      }
    }

    // Clean up upload directory
    try {
      fs.rmSync(session.uploadPath, { recursive: true, force: true });
    } catch (err) {
      logger.warn(`Failed to clean up upload directory: ${err}`, 'import');
    }

    session.status = 'complete';
    session.updatedAt = new Date();

    // Trigger DVH pre-computation for any imported RTDOSE series
    // This runs in the background (non-blocking) to prepare DVH data for instant loading
    try {
      for (const [, patientData] of patientMap) {
        for (const [, studyData] of patientData.studies) {
          for (const [seriesKey, seriesData] of studyData.series) {
            if (seriesData.metadata?.modality === 'RTDOSE') {
              const rtDoseSeries = await storage.getSeriesByUID(seriesKey);
              if (rtDoseSeries) {
                logger.info(`Triggering DVH pre-computation for RTDOSE series ${rtDoseSeries.id}`, 'import');
                // This is async/non-blocking - computation happens in background
                triggerDvhPrecompute(rtDoseSeries.id);
              }
            }
          }
        }
      }
    } catch (dvhError) {
      // Don't fail the import if DVH pre-computation fails - it will be computed on-demand
      logger.warn(`DVH pre-computation trigger failed: ${dvhError}`, 'import');
    }

    // Remove from active sessions after a delay
    setTimeout(() => {
      importSessions.delete(sessionId);
    }, 60000);

  } catch (error) {
    session.status = 'error';
    session.error = (error as Error).message;
    session.updatedAt = new Date();
    throw error;
  }
}

// Configure multer for batch uploads
const batchUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const sessionId = req.body.sessionId;
      const session = importSessions.get(sessionId);
      if (!session) {
        cb(new Error('Invalid session'), '');
        return;
      }
      cb(null, session.uploadPath);
    },
    filename: (req, file, cb) => {
      // Preserve directory structure from webkitRelativePath if available
      const relativePath = file.originalname;
      const dir = path.dirname(relativePath);
      const uploadPath = importSessions.get(req.body.sessionId)?.uploadPath;
      
      if (uploadPath && dir && dir !== '.') {
        const fullDir = path.join(uploadPath, dir);
        if (!fs.existsSync(fullDir)) {
          fs.mkdirSync(fullDir, { recursive: true });
        }
      }
      
      cb(null, relativePath);
    }
  }),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB per file
    files: 500 // 500 files per batch
  }
});

// Configure multer for archive uploads
const archiveUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const sessionId = generateSessionId();
      const uploadPath = path.join(UPLOAD_BASE_PATH, sessionId);
      
      fs.mkdirSync(uploadPath, { recursive: true });
      
      // Store session info in request
      (req as any).importSessionId = sessionId;
      (req as any).importUploadPath = uploadPath;
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, 'archive.zip');
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB max for ZIP
  }
});

// Extract ZIP file
async function extractZipFile(zipPath: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let fileCount = 0;
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        // Skip directories
        if (entry.fileName.endsWith('/')) {
          zipfile.readEntry();
          return;
        }
        
        // Skip non-DICOM files
        const ext = path.extname(entry.fileName).toLowerCase();
        if (ext && ext !== '.dcm' && ext !== '.ima') {
          zipfile.readEntry();
          return;
        }
        
        const destFilePath = path.join(destPath, entry.fileName);
        const destDir = path.dirname(destFilePath);
        
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            zipfile.readEntry();
            return;
          }
          
          const writeStream = fs.createWriteStream(destFilePath);
          readStream.pipe(writeStream);
          
          writeStream.on('close', () => {
            fileCount++;
            zipfile.readEntry();
          });
        });
      });
      
      zipfile.on('end', () => {
        // Delete the zip file after extraction
        try {
          fs.unlinkSync(zipPath);
        } catch {}
        resolve(fileCount);
      });
      
      zipfile.on('error', reject);
    });
  });
}

// Register routes
export function registerRobustImportRoutes(app: Express): void {
  
  // Initialize a new upload session
  app.post('/api/import/init-session', async (req, res) => {
    try {
      const { fileCount, totalSize } = req.body;
      
      if (fileCount > MAX_FILES_PER_SESSION) {
        return res.status(400).json({ 
          error: `Maximum ${MAX_FILES_PER_SESSION} files per session. Consider using a ZIP archive.` 
        });
      }
      
      if (totalSize > MAX_SESSION_SIZE_BYTES) {
        return res.status(400).json({ 
          error: `Maximum session size is ${MAX_SESSION_SIZE_BYTES / (1024 * 1024 * 1024)}GB` 
        });
      }
      
      const sessionId = generateSessionId();
      const uploadPath = path.join(UPLOAD_BASE_PATH, sessionId);
      
      fs.mkdirSync(uploadPath, { recursive: true });
      
      const session: ImportSession = {
        sessionId,
        status: 'uploading',
        uploadPath,
        totalFiles: fileCount,
        scannedFiles: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      importSessions.set(sessionId, session);
      
      res.json({ sessionId, uploadPath });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Upload a batch of files
  app.post('/api/import/upload-batch', batchUpload.array('files', 500), async (req, res) => {
    try {
      const { sessionId } = req.body;
      const session = importSessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const files = req.files as Express.Multer.File[];
      
      session.updatedAt = new Date();
      
      res.json({ 
        success: true, 
        filesReceived: files?.length || 0 
      });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Upload and extract ZIP archive
  app.post('/api/import/upload-archive', archiveUpload.single('file'), async (req, res) => {
    try {
      const sessionId = (req as any).importSessionId;
      const uploadPath = (req as any).importUploadPath;
      const file = req.file;
      
      if (!file || !sessionId) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const session: ImportSession = {
        sessionId,
        status: 'extracting',
        uploadPath,
        totalFiles: 0,
        scannedFiles: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      importSessions.set(sessionId, session);
      
      // Send immediate response
      res.json({ sessionId, message: 'Extraction started' });
      
      // Extract in background
      try {
        const extractPath = path.join(uploadPath, 'extracted');
        fs.mkdirSync(extractPath, { recursive: true });
        
        const fileCount = await extractZipFile(file.path, extractPath);
        session.totalFiles = fileCount;
        session.uploadPath = extractPath;
        session.updatedAt = new Date();
        
        // Start scanning
        scanSessionFiles(sessionId);
        
      } catch (err) {
        session.status = 'error';
        session.error = (err as Error).message;
        session.updatedAt = new Date();
      }
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Start scanning uploaded files
  app.post('/api/import/start-scan', async (req, res) => {
    try {
      const { sessionId } = req.body;
      const session = importSessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({ message: 'Scan started' });
      
      // Start scanning in background
      scanSessionFiles(sessionId);
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Get session status
  app.get('/api/import/session/:sessionId', async (req, res) => {
    try {
      const session = importSessions.get(req.params.sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({
        sessionId: session.sessionId,
        status: session.status,
        totalFiles: session.totalFiles,
        scannedFiles: session.scannedFiles,
        currentFile: session.currentFile,
        result: session.result ? {
          ...session.result,
          parsedData: undefined, // Don't send full data to client
          rtstructDetails: undefined
        } : undefined,
        error: session.error
      });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Commit session to database
  app.post('/api/import/commit', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      await commitSession(sessionId);
      
      res.json({ success: true, message: 'Import complete' });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Delete session
  app.delete('/api/import/session/:sessionId', async (req, res) => {
    try {
      const session = importSessions.get(req.params.sessionId);
      
      if (session) {
        // Clean up files
        try {
          fs.rmSync(session.uploadPath, { recursive: true, force: true });
        } catch {}
        
        importSessions.delete(req.params.sessionId);
      }
      
      res.json({ success: true });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Get all pending sessions
  app.get('/api/import/pending-sessions', async (req, res) => {
    try {
      const sessions: any[] = [];
      
      for (const [id, session] of importSessions) {
        if (session.status === 'ready' && session.result) {
          sessions.push({
            ...session.result,
            parsedData: undefined,
            rtstructDetails: undefined
          });
        }
      }
      
      res.json({ sessions });
      
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  logger.info('Robust import routes registered', 'import');
}

