/**
 * Data Source Service
 * 
 * Manages different types of DICOM data sources:
 * - local_database: The built-in SQLite database with imported studies
 * - dicomweb: External DICOMweb servers (Orthanc, DCM4CHEE, etc.)
 * - local_folder: Server-side folder scanning for DICOM files
 * - dimse: Traditional DICOM DIMSE connections (C-FIND, C-MOVE)
 */

import { storage } from '../storage';
import { PacsConnection } from '../../shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

// Create require function for loading native modules in ESM
const require = createRequire(import.meta.url);

// DIMSE networking library
let dimse: any = null;
try {
  dimse = require('dicom-dimse-native');
  console.log('[DIMSE] dicom-dimse-native loaded successfully');
} catch (e: any) {
  console.warn('[DIMSE] dicom-dimse-native not available, DIMSE support disabled');
  console.warn('[DIMSE] Load error:', e.message);
}

// DICOMweb query result format (QIDO-RS compatible)
export interface DICOMWebStudyResult {
  '00080005'?: { vr: string; Value?: string[] }; // SpecificCharacterSet
  '00080020'?: { vr: string; Value?: string[] }; // StudyDate
  '00080030'?: { vr: string; Value?: string[] }; // StudyTime
  '00080050'?: { vr: string; Value?: string[] }; // AccessionNumber
  '00080061'?: { vr: string; Value?: string[] }; // ModalitiesInStudy
  '00080090'?: { vr: string; Value?: string[] }; // ReferringPhysicianName
  '00100010'?: { vr: string; Value?: any[] };    // PatientName
  '00100020'?: { vr: string; Value?: string[] }; // PatientID
  '00100030'?: { vr: string; Value?: string[] }; // PatientBirthDate
  '00100040'?: { vr: string; Value?: string[] }; // PatientSex
  '0020000D'?: { vr: string; Value?: string[] }; // StudyInstanceUID
  '00200010'?: { vr: string; Value?: string[] }; // StudyID
  '00201206'?: { vr: string; Value?: number[] }; // NumberOfStudyRelatedSeries
  '00201208'?: { vr: string; Value?: number[] }; // NumberOfStudyRelatedInstances
  '00081030'?: { vr: string; Value?: string[] }; // StudyDescription
}

// Simplified query result for our UI
export interface QueryResult {
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

// Query parameters
export interface QueryParams {
  patientName?: string;
  patientID?: string;
  studyDate?: string;
  studyDescription?: string;
  accessionNumber?: string;
  modality?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query the local database for studies
 */
export async function queryLocalDatabase(params: QueryParams): Promise<QueryResult[]> {
  const allStudies = await storage.getAllStudies();
  
  const filteredStudies = allStudies.filter(study => {
    if (params.patientName && !study.patientName?.toLowerCase().includes(params.patientName.toLowerCase())) return false;
    if (params.patientID && !study.patientID?.includes(params.patientID)) return false;
    if (params.studyDescription && !study.studyDescription?.toLowerCase().includes(params.studyDescription.toLowerCase())) return false;
    if (params.accessionNumber && study.accessionNumber !== params.accessionNumber) return false;
    if (params.modality && study.modality !== params.modality) return false;
    if (params.studyDate) {
      const studyDateStr = study.studyDate?.replace(/-/g, '') || '';
      if (params.studyDate.includes('-')) {
        const [start, end] = params.studyDate.split('-');
        if (studyDateStr < start || studyDateStr > end) return false;
      } else {
        if (!studyDateStr.includes(params.studyDate)) return false;
      }
    }
    return true;
  });

  // Map to query result format
  const results = await Promise.all(filteredStudies.map(async (study) => {
    const seriesList = await storage.getSeriesByStudyId(study.id);
    const totalImages = seriesList.reduce((sum, s) => sum + (s.imageCount || 0), 0);
    
    return {
      patientName: study.patientName || undefined,
      patientID: study.patientID || undefined,
      studyInstanceUID: study.studyInstanceUID,
      studyDate: study.studyDate || undefined,
      studyDescription: study.studyDescription || undefined,
      accessionNumber: study.accessionNumber || undefined,
      modality: study.modality || undefined,
      numberOfStudyRelatedSeries: seriesList.length,
      numberOfStudyRelatedInstances: totalImages
    };
  }));

  // Apply limit and offset
  const start = params.offset || 0;
  const end = params.limit ? start + params.limit : undefined;
  return results.slice(start, end);
}

/**
 * Query a DICOMweb server
 */
export async function queryDICOMwebServer(
  connection: PacsConnection, 
  params: QueryParams
): Promise<QueryResult[]> {
  if (!connection.qidoRoot) {
    throw new Error('QIDO root URL is required for DICOMweb queries');
  }

  // Build QIDO-RS query URL
  const queryParams = new URLSearchParams();
  
  if (params.patientName) {
    // Use fuzzy matching if supported
    queryParams.set('PatientName', connection.supportsFuzzyMatching 
      ? `*${params.patientName}*` 
      : params.patientName);
  }
  if (params.patientID) queryParams.set('PatientID', params.patientID);
  if (params.studyDate) queryParams.set('StudyDate', params.studyDate);
  if (params.studyDescription) {
    queryParams.set('StudyDescription', connection.supportsWildcard 
      ? `*${params.studyDescription}*` 
      : params.studyDescription);
  }
  if (params.accessionNumber) queryParams.set('AccessionNumber', params.accessionNumber);
  if (params.modality) queryParams.set('ModalitiesInStudy', params.modality);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());

  // Include common fields in response
  if (connection.qidoSupportsIncludeField) {
    queryParams.set('includefield', [
      '00080020', // StudyDate
      '00080030', // StudyTime
      '00080050', // AccessionNumber
      '00080061', // ModalitiesInStudy
      '00100010', // PatientName
      '00100020', // PatientID
      '0020000D', // StudyInstanceUID
      '00081030', // StudyDescription
      '00201206', // NumberOfStudyRelatedSeries
      '00201208', // NumberOfStudyRelatedInstances
    ].join(','));
  }

  const url = `${connection.qidoRoot}/studies?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dicom+json',
      },
    });

    if (!response.ok) {
      throw new Error(`QIDO-RS query failed: ${response.status} ${response.statusText}`);
    }

    const dicomResults: DICOMWebStudyResult[] = await response.json();
    
    // Convert DICOM JSON to our simplified format
    return dicomResults.map(result => ({
      patientName: extractPersonName(result['00100010']),
      patientID: result['00100020']?.Value?.[0],
      studyInstanceUID: result['0020000D']?.Value?.[0],
      studyDate: result['00080020']?.Value?.[0],
      studyTime: result['00080030']?.Value?.[0],
      studyDescription: result['00081030']?.Value?.[0],
      accessionNumber: result['00080050']?.Value?.[0],
      modality: result['00080061']?.Value?.join('/'),
      numberOfStudyRelatedSeries: result['00201206']?.Value?.[0],
      numberOfStudyRelatedInstances: result['00201208']?.Value?.[0],
    }));
  } catch (error: any) {
    console.error('DICOMweb query error:', error);
    throw new Error(`Failed to query DICOMweb server: ${error.message}`);
  }
}

/**
 * Scan a local folder for DICOM files
 */
export async function scanLocalFolder(
  connection: PacsConnection,
  params: QueryParams
): Promise<QueryResult[]> {
  if (!connection.folderPath) {
    throw new Error('Folder path is required for local folder scanning');
  }

  if (!fs.existsSync(connection.folderPath)) {
    throw new Error(`Folder not found: ${connection.folderPath}`);
  }

  // For now, we'll scan the folder and try to parse DICOM files
  // This is a simplified implementation - a full implementation would use dcmjs
  const studies = new Map<string, QueryResult>();
  
  const scanDir = async (dirPath: string) => {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.dcm') || !entry.name.includes('.'))) {
        try {
          // Read file header to get basic DICOM info
          const stats = await fs.promises.stat(fullPath);
          
          // For a full implementation, parse the DICOM file here
          // For now, create a placeholder entry
          const studyUID = `folder:${connection.id}:${entry.name}`;
          
          if (!studies.has(studyUID)) {
            studies.set(studyUID, {
              patientName: 'Local File',
              patientID: connection.name,
              studyInstanceUID: studyUID,
              studyDate: stats.mtime.toISOString().split('T')[0].replace(/-/g, ''),
              studyDescription: `Files in ${path.basename(dirPath)}`,
              modality: 'Unknown',
              numberOfStudyRelatedSeries: 1,
              numberOfStudyRelatedInstances: 1,
            });
          } else {
            const existing = studies.get(studyUID)!;
            existing.numberOfStudyRelatedInstances = (existing.numberOfStudyRelatedInstances || 0) + 1;
          }
        } catch (err) {
          // Skip files that can't be read
        }
      }
    }
  };

  await scanDir(connection.folderPath);
  
  // Filter results based on query params
  let results = Array.from(studies.values());
  
  if (params.patientName) {
    results = results.filter(r => r.patientName?.toLowerCase().includes(params.patientName!.toLowerCase()));
  }
  if (params.studyDescription) {
    results = results.filter(r => r.studyDescription?.toLowerCase().includes(params.studyDescription!.toLowerCase()));
  }
  
  return results;
}

/**
 * Query a DIMSE PACS using C-FIND
 * NOTE: The dicom-dimse-native library fires the callback MULTIPLE times during the operation.
 * We need to wait for the final callback (code 0 = success, or status = 'failure').
 */
export async function queryDIMSEServer(
  connection: PacsConnection,
  params: QueryParams
): Promise<QueryResult[]> {
  if (!dimse) {
    throw new Error('DIMSE support not available - dicom-dimse-native library not installed');
  }

  if (!connection.hostname || !connection.port || !connection.aeTitle) {
    throw new Error('Hostname, port, and AE Title are required for DIMSE queries');
  }

  return new Promise((resolve, reject) => {
    const callingAeTitle = connection.callingAeTitle || 'SUPERBEAM';
    let resolved = false;
    let callbackCount = 0;
    
    // Build C-FIND options according to dicom-dimse-native API
    const findOptions = {
      source: {
        aet: callingAeTitle,
        ip: '127.0.0.1',
        port: 11113, // Our local DICOM port
      },
      target: {
        aet: connection.aeTitle,
        ip: connection.hostname,
        port: connection.port,
      },
      tags: [
        { key: '00080052', value: 'STUDY' }, // QueryRetrieveLevel
        { key: '00100010', value: params.patientName ? `*${params.patientName}*` : '' }, // PatientName
        { key: '00100020', value: params.patientID || '' }, // PatientID
        { key: '0020000D', value: '' }, // StudyInstanceUID (return)
        { key: '00080020', value: params.studyDate || '' }, // StudyDate
        { key: '00081030', value: params.studyDescription ? `*${params.studyDescription}*` : '' }, // StudyDescription
        { key: '00080050', value: params.accessionNumber || '' }, // AccessionNumber
        { key: '00080061', value: params.modality || '' }, // ModalitiesInStudy
        { key: '00201206', value: '' }, // NumberOfStudyRelatedSeries (return)
        { key: '00201208', value: '' }, // NumberOfStudyRelatedInstances (return)
      ],
      verbose: true,
    };

    console.log(`[DIMSE] C-FIND query to ${connection.aeTitle}@${connection.hostname}:${connection.port}`);
    console.log(`[DIMSE] Calling AE: ${callingAeTitle}`);
    
    // Set a timeout in case we never get a final callback
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('C-FIND timed out after 30 seconds'));
      }
    }, 30000);
    
    dimse.findScu(findOptions, (result: string) => {
      callbackCount++;
      try {
        const parsed = JSON.parse(result);
        console.log(`[DIMSE] C-FIND callback #${callbackCount}: code=${parsed.code}, status=${parsed.status}`);
        
        // Only process on final status (code 0 = success, or explicit failure)
        if (parsed.code === 0 && parsed.status === 'success') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            
            // Parse the results - container is a JSON STRING that needs to be parsed
            const studies: QueryResult[] = [];
            let container: any[] = [];
            
            if (typeof parsed.container === 'string') {
              try {
                container = JSON.parse(parsed.container);
              } catch (e) {
                console.error('[DIMSE] Failed to parse container string:', e);
              }
            } else if (Array.isArray(parsed.container)) {
              container = parsed.container;
            }
            
            
            for (const study of container) {
              // The container items have a 'tags' array with {key, value} objects
              const getValue = (tag: string): string | undefined => {
                // Try tags array format (dicom-dimse-native specific)
                if (study.tags && Array.isArray(study.tags)) {
                  const found = study.tags.find((t: any) => t.key === tag);
                  if (found) return found.value;
                }
                // Try direct DICOM JSON format
                const element = study[tag];
                if (!element) return undefined;
                if (element.Value && Array.isArray(element.Value)) {
                  const val = element.Value[0];
                  if (typeof val === 'object' && val.Alphabetic) return val.Alphabetic;
                  return val;
                }
                return element.value || element.Value || undefined;
              };

              studies.push({
                patientName: getValue('00100010'),
                patientID: getValue('00100020'),
                studyInstanceUID: getValue('0020000D'),
                studyDate: getValue('00080020'),
                studyDescription: getValue('00081030'),
                accessionNumber: getValue('00080050'),
                modality: getValue('00080061'),
                numberOfStudyRelatedSeries: parseInt(getValue('00201206') || '0') || undefined,
                numberOfStudyRelatedInstances: parseInt(getValue('00201208') || '0') || undefined,
              });
            }

            console.log(`[DIMSE] C-FIND returned ${studies.length} studies`);
            resolve(studies);
          }
        } else if (parsed.status === 'failure') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(new Error(`C-FIND failed: ${parsed.message || 'Unknown error'}`));
          }
        }
        // Ignore 'pending' status callbacks - wait for final result
      } catch (parseError: any) {
        console.error('[DIMSE] Parse error:', parseError, 'Raw result:', result);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Failed to parse C-FIND response: ${parseError.message}`));
        }
      }
    });
  });
}

/**
 * Test DIMSE connection with C-ECHO
 * NOTE: The dicom-dimse-native library fires the callback MULTIPLE times during the operation.
 * We need to wait for the final callback (code 0 = success, or status = 'failure').
 */
async function testDIMSEConnection(connection: PacsConnection): Promise<{
  success: boolean;
  message: string;
  responseTime?: number;
}> {
  const startTime = Date.now();

  if (!dimse) {
    return { success: false, message: 'DIMSE support not available' };
  }

  if (!connection.hostname || !connection.port || !connection.aeTitle) {
    return { success: false, message: 'Hostname, port, and AE Title required' };
  }

  return new Promise((resolve) => {
    const callingAeTitle = connection.callingAeTitle || 'SUPERBEAM';
    let resolved = false;
    let callbackCount = 0;
    
    // Build C-ECHO options according to dicom-dimse-native API
    const echoOptions = {
      source: {
        aet: callingAeTitle,
        ip: '127.0.0.1',
        port: 11113, // Our local DICOM port
      },
      target: {
        aet: connection.aeTitle,
        ip: connection.hostname,
        port: connection.port,
      },
      verbose: true,
    };
    
    console.log(`[DIMSE] C-ECHO to ${connection.aeTitle}@${connection.hostname}:${connection.port}`);
    console.log(`[DIMSE] Calling AE: ${callingAeTitle}`);
    
    // Set a timeout in case we never get a final callback
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          message: 'C-ECHO timed out after 30 seconds',
          responseTime: Date.now() - startTime,
        });
      }
    }, 30000);
    
    dimse.echoScu(echoOptions, (result: string) => {
      callbackCount++;
      try {
        const parsed = JSON.parse(result);
        console.log(`[DIMSE] C-ECHO callback #${callbackCount}: code=${parsed.code}, status=${parsed.status}`);
        
        // Only resolve on final status (code 0 = success, or explicit failure)
        if (parsed.code === 0 && parsed.status === 'success') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              success: true,
              message: `C-ECHO successful to ${connection.aeTitle} (${Date.now() - startTime}ms)`,
              responseTime: Date.now() - startTime,
            });
          }
        } else if (parsed.status === 'failure') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              success: false,
              message: `C-ECHO failed: ${parsed.message || 'Association rejected'}`,
              responseTime: Date.now() - startTime,
            });
          }
        }
        // Ignore 'pending' status callbacks - wait for final result
      } catch (e: any) {
        console.error('[DIMSE] C-ECHO parse error:', e, 'Raw result:', result);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({
            success: false,
            message: `C-ECHO error: ${e.message}`,
            responseTime: Date.now() - startTime,
          });
        }
      }
    });
  });
}

/**
 * Test a data source connection
 */
export async function testDataSource(connection: PacsConnection): Promise<{
  success: boolean;
  message: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    switch (connection.sourceType) {
      case 'local_database':
        // Local database is always available
        const count = (await storage.getAllStudies()).length;
        return {
          success: true,
          message: `Local database connected (${count} studies)`,
          responseTime: Date.now() - startTime,
        };

      case 'dicomweb':
        if (!connection.qidoRoot) {
          return { success: false, message: 'QIDO root URL not configured' };
        }
        
        // Try a simple QIDO query
        const testUrl = `${connection.qidoRoot}/studies?limit=1`;
        const response = await fetch(testUrl, {
          headers: { 'Accept': 'application/dicom+json' },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        
        if (response.ok) {
          return {
            success: true,
            message: `DICOMweb server responding (${response.status})`,
            responseTime: Date.now() - startTime,
          };
        } else {
          return {
            success: false,
            message: `Server returned ${response.status}: ${response.statusText}`,
            responseTime: Date.now() - startTime,
          };
        }

      case 'local_folder':
        if (!connection.folderPath) {
          return { success: false, message: 'Folder path not configured' };
        }
        
        if (!fs.existsSync(connection.folderPath)) {
          return { success: false, message: `Folder not found: ${connection.folderPath}` };
        }
        
        const stats = await fs.promises.stat(connection.folderPath);
        if (!stats.isDirectory()) {
          return { success: false, message: 'Path is not a directory' };
        }
        
        const files = await fs.promises.readdir(connection.folderPath);
        return {
          success: true,
          message: `Folder accessible (${files.length} items)`,
          responseTime: Date.now() - startTime,
        };

      case 'dimse':
        // Use proper DICOM C-ECHO for testing
        return testDIMSEConnection(connection);

      default:
        return { success: false, message: `Unknown source type: ${connection.sourceType}` };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Test failed: ${error.message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Query any data source
 */
export async function queryDataSource(
  connection: PacsConnection,
  params: QueryParams
): Promise<QueryResult[]> {
  switch (connection.sourceType) {
    case 'local_database':
      return queryLocalDatabase(params);
      
    case 'dicomweb':
      return queryDICOMwebServer(connection, params);
      
    case 'local_folder':
      return scanLocalFolder(connection, params);
      
    case 'dimse':
      return queryDIMSEServer(connection, params);
      
    default:
      throw new Error(`Unknown source type: ${connection.sourceType}`);
  }
}

// Helper function to extract person name from DICOM format
function extractPersonName(pnField: any): string | undefined {
  if (!pnField?.Value?.[0]) return undefined;
  
  const pn = pnField.Value[0];
  if (typeof pn === 'string') return pn;
  if (pn.Alphabetic) return pn.Alphabetic;
  if (pn.familyName || pn.givenName) {
    return [pn.familyName, pn.givenName].filter(Boolean).join(', ');
  }
  return undefined;
}

/**
 * Create a default "Local Database" data source
 */
export async function ensureLocalDatabaseSource(): Promise<PacsConnection> {
  const existing = await storage.getAllPacsConnections();
  const localDb = existing.find(c => c.sourceType === 'local_database');
  
  if (localDb) {
    return localDb;
  }
  
  // Create the local database source
  return storage.createPacsConnection({
    name: 'Local Database',
    sourceType: 'local_database',
    aeTitle: 'LOCAL',
    hostname: 'localhost',
    port: 0,
    isActive: true,
  });
}

