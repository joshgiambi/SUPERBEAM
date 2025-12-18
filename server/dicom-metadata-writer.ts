/**
 * DICOM Metadata Writer
 * 
 * Uses dicom-parser for reading and manual byte manipulation for writing
 * to update specific DICOM metadata fields while preserving pixel data and other content.
 * 
 * This approach modifies only specific text-based metadata tags without
 * re-encoding the entire DICOM file, which preserves image data integrity.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dicomParser from 'dicom-parser';

// DICOM tag definitions for metadata we can edit
export const DICOM_TAGS = {
  // Patient Information
  PATIENT_NAME: 'x00100010',
  PATIENT_ID: 'x00100020',
  PATIENT_SEX: 'x00100040',
  PATIENT_AGE: 'x00101010',
  PATIENT_BIRTH_DATE: 'x00100030',
  
  // Series Information
  SERIES_DESCRIPTION: 'x0008103e',
  SERIES_NUMBER: 'x00200011',
  
  // Study Information  
  STUDY_DESCRIPTION: 'x00081030',
  STUDY_DATE: 'x00080020',
};

// Editable metadata fields
export interface EditablePatientMetadata {
  patientName?: string;
  patientID?: string;
  patientSex?: string;
  patientAge?: string;
  patientBirthDate?: string;
}

export interface EditableSeriesMetadata {
  seriesDescription?: string;
}

/**
 * Result of a DICOM file update operation
 */
export interface DicomUpdateResult {
  success: boolean;
  filePath: string;
  error?: string;
  updatedFields?: string[];
}

/**
 * DicomMetadataWriter class for updating DICOM file metadata
 */
export class DicomMetadataWriter {
  
  /**
   * Update patient metadata in a single DICOM file
   * Uses a write-with-padding approach for safe metadata modification
   */
  static updatePatientMetadata(filePath: string, metadata: EditablePatientMetadata): DicomUpdateResult {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, filePath, error: 'File not found' };
      }

      // Read the original file
      const originalBuffer = fs.readFileSync(filePath);
      let dataSet: dicomParser.DataSet;
      
      try {
        dataSet = dicomParser.parseDicom(originalBuffer);
      } catch (parseError) {
        return { success: false, filePath, error: `Failed to parse DICOM: ${parseError}` };
      }

      // Build a map of tag updates
      const updates: Map<string, string> = new Map();
      const updatedFields: string[] = [];

      if (metadata.patientName !== undefined) {
        updates.set(DICOM_TAGS.PATIENT_NAME, this.formatPatientName(metadata.patientName));
        updatedFields.push('patientName');
      }
      if (metadata.patientID !== undefined) {
        updates.set(DICOM_TAGS.PATIENT_ID, metadata.patientID);
        updatedFields.push('patientID');
      }
      if (metadata.patientSex !== undefined) {
        updates.set(DICOM_TAGS.PATIENT_SEX, metadata.patientSex);
        updatedFields.push('patientSex');
      }
      if (metadata.patientAge !== undefined) {
        updates.set(DICOM_TAGS.PATIENT_AGE, metadata.patientAge);
        updatedFields.push('patientAge');
      }
      if (metadata.patientBirthDate !== undefined) {
        updates.set(DICOM_TAGS.PATIENT_BIRTH_DATE, metadata.patientBirthDate);
        updatedFields.push('patientBirthDate');
      }

      if (updates.size === 0) {
        return { success: true, filePath, updatedFields: [] };
      }

      // Perform the updates
      const modifiedBuffer = this.updateDicomBuffer(originalBuffer, dataSet, updates);
      
      if (!modifiedBuffer) {
        return { success: false, filePath, error: 'Failed to modify DICOM buffer' };
      }

      // Create backup before writing
      const backupPath = filePath + '.bak';
      fs.copyFileSync(filePath, backupPath);

      try {
        // Write the modified buffer
        fs.writeFileSync(filePath, modifiedBuffer);
        
        // Verify the write was successful by re-parsing
        const verifyBuffer = fs.readFileSync(filePath);
        dicomParser.parseDicom(verifyBuffer);
        
        // Remove backup after successful verification
        fs.unlinkSync(backupPath);
        
        return { success: true, filePath, updatedFields };
      } catch (writeError) {
        // Restore from backup on failure
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, filePath);
          fs.unlinkSync(backupPath);
        }
        return { success: false, filePath, error: `Write failed: ${writeError}` };
      }
      
    } catch (error) {
      return { success: false, filePath, error: `Unexpected error: ${error}` };
    }
  }

  /**
   * Update series metadata in a single DICOM file
   */
  static updateSeriesMetadata(filePath: string, metadata: EditableSeriesMetadata): DicomUpdateResult {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, filePath, error: 'File not found' };
      }

      const originalBuffer = fs.readFileSync(filePath);
      let dataSet: dicomParser.DataSet;
      
      try {
        dataSet = dicomParser.parseDicom(originalBuffer);
      } catch (parseError) {
        return { success: false, filePath, error: `Failed to parse DICOM: ${parseError}` };
      }

      const updates: Map<string, string> = new Map();
      const updatedFields: string[] = [];

      if (metadata.seriesDescription !== undefined) {
        updates.set(DICOM_TAGS.SERIES_DESCRIPTION, metadata.seriesDescription);
        updatedFields.push('seriesDescription');
      }

      if (updates.size === 0) {
        return { success: true, filePath, updatedFields: [] };
      }

      const modifiedBuffer = this.updateDicomBuffer(originalBuffer, dataSet, updates);
      
      if (!modifiedBuffer) {
        return { success: false, filePath, error: 'Failed to modify DICOM buffer' };
      }

      const backupPath = filePath + '.bak';
      fs.copyFileSync(filePath, backupPath);

      try {
        fs.writeFileSync(filePath, modifiedBuffer);
        
        const verifyBuffer = fs.readFileSync(filePath);
        dicomParser.parseDicom(verifyBuffer);
        
        fs.unlinkSync(backupPath);
        
        return { success: true, filePath, updatedFields };
      } catch (writeError) {
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, filePath);
          fs.unlinkSync(backupPath);
        }
        return { success: false, filePath, error: `Write failed: ${writeError}` };
      }
      
    } catch (error) {
      return { success: false, filePath, error: `Unexpected error: ${error}` };
    }
  }

  /**
   * Update DICOM buffer with new metadata values
   * Uses in-place modification where possible, or rebuilds elements if needed
   */
  private static updateDicomBuffer(
    originalBuffer: Buffer,
    dataSet: dicomParser.DataSet,
    updates: Map<string, string>
  ): Buffer | null {
    try {
      // Create a working copy
      const buffer = Buffer.from(originalBuffer);
      
      // Iterate using forEach for compatibility
      updates.forEach((newValue, tag) => {
        const element = dataSet.elements[tag];
        
        if (!element) {
          console.warn(`Tag ${tag} not found in DICOM file, skipping...`);
          return; // Skip to next item in forEach
        }

        // Get VR for this element
        const vr = element.vr || this.getDefaultVR(tag);
        
        // Encode the new value
        const encodedValue = this.encodeValue(newValue, vr);
        
        if (encodedValue.length === element.length) {
          // Same length - in-place update
          encodedValue.copy(buffer, element.dataOffset);
        } else if (encodedValue.length < element.length) {
          // Shorter - pad with spaces and in-place update
          const paddedValue = this.padValue(encodedValue, element.length, vr);
          paddedValue.copy(buffer, element.dataOffset);
        } else {
          // Longer value - need more complex handling
          // For now, truncate to original length (with warning)
          console.warn(`New value for ${tag} is longer than original (${encodedValue.length} vs ${element.length}), truncating...`);
          const truncated = encodedValue.subarray(0, element.length);
          truncated.copy(buffer, element.dataOffset);
        }
      });
      
      return buffer;
    } catch (error) {
      console.error('Error updating DICOM buffer:', error);
      return null;
    }
  }

  /**
   * Get default VR for a tag
   */
  private static getDefaultVR(tag: string): string {
    const vrMap: Record<string, string> = {
      [DICOM_TAGS.PATIENT_NAME]: 'PN',
      [DICOM_TAGS.PATIENT_ID]: 'LO',
      [DICOM_TAGS.PATIENT_SEX]: 'CS',
      [DICOM_TAGS.PATIENT_AGE]: 'AS',
      [DICOM_TAGS.PATIENT_BIRTH_DATE]: 'DA',
      [DICOM_TAGS.SERIES_DESCRIPTION]: 'LO',
      [DICOM_TAGS.STUDY_DESCRIPTION]: 'LO',
    };
    return vrMap[tag] || 'LO';
  }

  /**
   * Encode a string value for DICOM
   */
  private static encodeValue(value: string, vr: string): Buffer {
    // For text VRs, use ASCII encoding (DICOM default)
    let encoded = Buffer.from(value, 'ascii');
    
    // DICOM requires even-length values
    if (encoded.length % 2 !== 0) {
      const padChar = this.getPadCharacter(vr);
      encoded = Buffer.concat([encoded, Buffer.from([padChar])]);
    }
    
    return encoded;
  }

  /**
   * Pad a value to a specific length
   */
  private static padValue(value: Buffer, targetLength: number, vr: string): Buffer {
    if (value.length >= targetLength) {
      return value;
    }
    
    const padChar = this.getPadCharacter(vr);
    const padding = Buffer.alloc(targetLength - value.length, padChar);
    return Buffer.concat([value, padding]);
  }

  /**
   * Get the appropriate padding character for a VR
   */
  private static getPadCharacter(vr: string): number {
    // UI (Unique Identifier) uses null (0x00) padding
    if (vr === 'UI') {
      return 0x00;
    }
    // Most text VRs use space (0x20) padding
    return 0x20;
  }

  /**
   * Format patient name for DICOM (Last^First^Middle format)
   */
  private static formatPatientName(name: string): string {
    if (!name) return '';
    
    // If already in DICOM format (contains ^), return as-is
    if (name.includes('^')) {
      return name;
    }
    
    // Try to parse "First Last" or "Last, First" formats
    const commaMatch = name.match(/^([^,]+),\s*(.+)$/);
    if (commaMatch) {
      // "Last, First" format
      return `${commaMatch[1].trim()}^${commaMatch[2].trim()}`;
    }
    
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0];
    } else if (parts.length === 2) {
      // Assume "First Last" format
      return `${parts[1]}^${parts[0]}`;
    } else {
      // Assume "First Middle Last" format
      return `${parts[parts.length - 1]}^${parts[0]}^${parts.slice(1, -1).join(' ')}`;
    }
  }

  /**
   * Batch update patient metadata across multiple files
   */
  static async batchUpdatePatientMetadata(
    filePaths: string[],
    metadata: EditablePatientMetadata,
    onProgress?: (current: number, total: number, result: DicomUpdateResult) => void
  ): Promise<{ success: number; failed: number; results: DicomUpdateResult[] }> {
    const results: DicomUpdateResult[] = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const result = this.updatePatientMetadata(filePath, metadata);
      results.push(result);
      
      if (result.success) {
        success++;
      } else {
        failed++;
      }

      if (onProgress) {
        onProgress(i + 1, filePaths.length, result);
      }
    }

    return { success, failed, results };
  }

  /**
   * Batch update series metadata across multiple files
   */
  static async batchUpdateSeriesMetadata(
    filePaths: string[],
    metadata: EditableSeriesMetadata,
    onProgress?: (current: number, total: number, result: DicomUpdateResult) => void
  ): Promise<{ success: number; failed: number; results: DicomUpdateResult[] }> {
    const results: DicomUpdateResult[] = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const result = this.updateSeriesMetadata(filePath, metadata);
      results.push(result);
      
      if (result.success) {
        success++;
      } else {
        failed++;
      }

      if (onProgress) {
        onProgress(i + 1, filePaths.length, result);
      }
    }

    return { success, failed, results };
  }
}

export default DicomMetadataWriter;

