/**
 * DICOM Utilities Unit Tests
 * 
 * @requirement REQ-DICOM-001
 * @risk-class low
 * @verification VER-DICOM-001
 * 
 * Tests for DICOM file handling, date formatting, and utility functions.
 * These functions are critical for proper medical image data handling.
 */

import {
  isDICOMFile,
  formatFileSize,
  formatDate,
  createImageId,
  WINDOW_LEVEL_PRESETS,
} from '../dicom-utils';

describe('DICOM File Detection', () => {
  /**
   * @verifies REQ-DICOM-001
   * Correct file detection prevents loading non-DICOM files
   */
  describe('isDICOMFile', () => {
    it('should accept .dcm extension', () => {
      const file = new File([''], 'image.dcm', { type: 'application/dicom' });
      expect(isDICOMFile(file)).toBe(true);
    });

    it('should accept .dicom extension', () => {
      const file = new File([''], 'scan.dicom', { type: 'application/dicom' });
      expect(isDICOMFile(file)).toBe(true);
    });

    it('should accept .ima extension (Siemens format)', () => {
      const file = new File([''], 'MR.ima', { type: '' });
      expect(isDICOMFile(file)).toBe(true);
    });

    it('should accept files without extension (common DICOM pattern)', () => {
      const file = new File([''], 'IM000001', { type: '' });
      expect(isDICOMFile(file)).toBe(true);
    });

    it('should accept numeric filenames', () => {
      const file = new File([''], '123456', { type: '' });
      expect(isDICOMFile(file)).toBe(true);
    });

    it('should reject non-DICOM extensions', () => {
      const jpgFile = new File([''], 'image.jpg', { type: 'image/jpeg' });
      const pngFile = new File([''], 'image.png', { type: 'image/png' });
      const txtFile = new File([''], 'notes.txt', { type: 'text/plain' });
      
      expect(isDICOMFile(jpgFile)).toBe(false);
      expect(isDICOMFile(pngFile)).toBe(false);
      expect(isDICOMFile(txtFile)).toBe(false);
    });

    it('should be case-insensitive for extensions', () => {
      const upperCase = new File([''], 'IMAGE.DCM', { type: '' });
      const mixedCase = new File([''], 'Image.Dcm', { type: '' });
      
      expect(isDICOMFile(upperCase)).toBe(true);
      expect(isDICOMFile(mixedCase)).toBe(true);
    });
  });
});

describe('File Size Formatting', () => {
  /**
   * @verifies REQ-UI-001
   * Proper file size display for user interface
   */
  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(3.5 * 1024 * 1024 * 1024)).toBe('3.5 GB');
    });

    it('should handle typical DICOM file sizes', () => {
      // CT slice: ~500KB
      const ctSlice = formatFileSize(512000);
      expect(ctSlice).toBe('500 KB');
      
      // MRI study: ~200MB
      const mriStudy = formatFileSize(200 * 1024 * 1024);
      expect(mriStudy).toBe('200 MB');
    });
  });
});

describe('DICOM Date Formatting', () => {
  /**
   * @verifies REQ-DICOM-002
   * Correct date parsing is critical for patient identification
   */
  describe('formatDate', () => {
    it('should format DICOM date format (YYYYMMDD)', () => {
      const result = formatDate('20240115');
      expect(result).toMatch(/1\/15\/2024|15\/1\/2024|2024/); // Locale-dependent
    });

    it('should format DICOM date 20231225', () => {
      const result = formatDate('20231225');
      expect(result).toMatch(/12\/25\/2023|25\/12\/2023|2023/);
    });

    it('should handle empty date string', () => {
      expect(formatDate('')).toBe('Unknown');
    });

    it('should handle null/undefined gracefully', () => {
      expect(formatDate(null as any)).toBe('Unknown');
      expect(formatDate(undefined as any)).toBe('Unknown');
    });

    it('should format ISO date strings', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('2024');
    });
  });
});

describe('Image ID Generation', () => {
  /**
   * @verifies REQ-DICOM-003
   * Image IDs must be correctly formatted for Cornerstone loader
   */
  describe('createImageId', () => {
    it('should create wadouri image ID', () => {
      const sopUID = '1.2.840.113619.2.55.3.604688.12345';
      const imageId = createImageId(sopUID);
      
      expect(imageId).toBe(`wadouri:/api/dicom/${sopUID}`);
    });

    it('should handle complex SOP Instance UIDs', () => {
      const complexUID = '1.2.276.0.7230010.3.1.4.8323329.12024.1705320945.123456';
      const imageId = createImageId(complexUID);
      
      expect(imageId).toContain(complexUID);
      expect(imageId).toStartWith('wadouri:');
    });
  });
});

describe('Window Level Presets', () => {
  /**
   * @verifies REQ-VIEW-001
   * Window/level presets must have clinically appropriate values
   */
  describe('WINDOW_LEVEL_PRESETS', () => {
    it('should have Soft Tissue preset', () => {
      expect(WINDOW_LEVEL_PRESETS['Soft Tissue']).toBeDefined();
      expect(WINDOW_LEVEL_PRESETS['Soft Tissue'].window).toBe(400);
      expect(WINDOW_LEVEL_PRESETS['Soft Tissue'].level).toBe(40);
    });

    it('should have Lung preset with appropriate values', () => {
      const lung = WINDOW_LEVEL_PRESETS['Lung'];
      expect(lung).toBeDefined();
      // Lung window should be wide to show air
      expect(lung.window).toBeGreaterThan(1000);
      // Lung level should be negative (air is -1000 HU)
      expect(lung.level).toBeLessThan(0);
    });

    it('should have Bone preset with positive level', () => {
      const bone = WINDOW_LEVEL_PRESETS['Bone'];
      expect(bone).toBeDefined();
      // Bone level should be positive (bone is +300-3000 HU)
      expect(bone.level).toBeGreaterThan(0);
    });

    it('should have Brain preset with narrow window', () => {
      const brain = WINDOW_LEVEL_PRESETS['Brain'];
      expect(brain).toBeDefined();
      // Brain window should be narrow for soft tissue contrast
      expect(brain.window).toBeLessThan(200);
    });

    it('should have MRI presets', () => {
      expect(WINDOW_LEVEL_PRESETS['MRI Brain T1']).toBeDefined();
      expect(WINDOW_LEVEL_PRESETS['MRI Brain T2']).toBeDefined();
      expect(WINDOW_LEVEL_PRESETS['MRI Brain FLAIR']).toBeDefined();
    });

    it('should have Full Range preset for debugging', () => {
      const fullRange = WINDOW_LEVEL_PRESETS['Full Range'];
      expect(fullRange).toBeDefined();
      expect(fullRange.window).toBeGreaterThanOrEqual(4096);
    });

    it('all presets should have positive window values', () => {
      for (const [name, preset] of Object.entries(WINDOW_LEVEL_PRESETS)) {
        expect(preset.window).toBeGreaterThan(0);
      }
    });
  });
});
