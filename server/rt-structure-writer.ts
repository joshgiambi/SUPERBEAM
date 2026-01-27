/**
 * RT Structure Set DICOM Writer
 * Creates valid DICOM RT Structure files using dcmjs
 */

import * as fs from 'fs';
import * as path from 'path';
import dcmjs from 'dcmjs';

const { DicomMetaDictionary, DicomDict } = dcmjs.data;

export interface RTStructureWriteInput {
  // Study/Series info from original CT
  studyInstanceUID: string;
  referencedSeriesInstanceUID: string;
  referencedFrameOfReferenceUID: string;
  referencedSOPInstanceUIDs: string[]; // SOPInstanceUIDs of referenced CT images
  
  // New RT Structure Set info
  seriesInstanceUID: string;
  sopInstanceUID: string;
  structureSetLabel: string;
  
  // Patient info
  patientId?: string;
  patientName?: string;
  
  // Structures
  structures: {
    roiNumber: number;
    structureName: string;
    color: [number, number, number];
    contours: {
      slicePosition: number;
      points: number[]; // Flattened [x1,y1,z1,x2,y2,z2,...]
      referencedSOPInstanceUID?: string;
    }[];
  }[];
}

export class RTStructureWriter {
  /**
   * Generate a new UID
   */
  static generateUID(): string {
    const root = '1.2.826.0.1.3680043.8.498.'; // DICOM standard root for generated UIDs
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `${root}${timestamp}.${random}`;
  }

  /**
   * Write RT Structure Set to DICOM file
   */
  static writeRTStructureSet(input: RTStructureWriteInput, outputPath: string): void {
    console.log(`📝 Writing RT Structure Set to: ${outputPath}`);
    
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');

    // Build the dataset as a plain object
    const dataset: Record<string, any> = {
      // Patient Module
      PatientID: input.patientId || 'UNKNOWN',
      PatientName: input.patientName || 'UNKNOWN',
      PatientBirthDate: '',
      PatientSex: '',

      // General Study Module
      StudyInstanceUID: input.studyInstanceUID,
      StudyDate: dateStr,
      StudyTime: timeStr,
      AccessionNumber: '',
      ReferringPhysicianName: '',
      StudyID: '',

      // RT Series Module
      SeriesInstanceUID: input.seriesInstanceUID,
      SeriesNumber: '1',
      SeriesDate: dateStr,
      SeriesTime: timeStr,
      SeriesDescription: input.structureSetLabel,
      Modality: 'RTSTRUCT',
      OperatorsName: '',

      // Frame of Reference Module
      FrameOfReferenceUID: input.referencedFrameOfReferenceUID,
      PositionReferenceIndicator: '',

      // General Equipment Module
      Manufacturer: 'CONVERGE Medical',
      StationName: 'CONVERGE',
      SoftwareVersions: '1.0',
      
      // SOP Common Module
      SOPClassUID: '1.2.840.10008.5.1.4.1.1.481.3', // RT Structure Set Storage
      SOPInstanceUID: input.sopInstanceUID,
      InstanceCreationDate: dateStr,
      InstanceCreationTime: timeStr,
      
      // Structure Set Module
      StructureSetLabel: input.structureSetLabel,
      StructureSetDate: dateStr,
      StructureSetTime: timeStr,
      
      // Referenced Frame of Reference Sequence
      ReferencedFrameOfReferenceSequence: [{
        FrameOfReferenceUID: input.referencedFrameOfReferenceUID,
        RTReferencedStudySequence: [{
          ReferencedSOPClassUID: '1.2.840.10008.3.1.2.3.1', // Detached Study Management SOP Class (legacy)
          ReferencedSOPInstanceUID: input.studyInstanceUID,
          RTReferencedSeriesSequence: [{
            SeriesInstanceUID: input.referencedSeriesInstanceUID,
            ContourImageSequence: input.referencedSOPInstanceUIDs.map(sopUID => ({
              ReferencedSOPClassUID: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage
              ReferencedSOPInstanceUID: sopUID
            }))
          }]
        }]
      }],
      
      // Structure Set ROI Sequence
      StructureSetROISequence: input.structures.map(structure => ({
        ROINumber: structure.roiNumber.toString(),
        ReferencedFrameOfReferenceUID: input.referencedFrameOfReferenceUID,
        ROIName: structure.structureName,
        ROIGenerationAlgorithm: 'MANUAL'
      })),
      
      // ROI Contour Sequence
      ROIContourSequence: input.structures.map(structure => {
        const contourSequence = structure.contours
          .filter(contour => contour.points.length >= 9) // At least 3 points (9 coordinates)
          .map(contour => {
            // Build contour data string
            const contourDataStr = contour.points.map(p => p.toFixed(6)).join('\\');
            const numPoints = Math.floor(contour.points.length / 3);
            
            const contourItem: Record<string, any> = {
              ContourGeometricType: 'CLOSED_PLANAR',
              NumberOfContourPoints: numPoints.toString(),
              ContourData: contourDataStr
            };
            
            // Add referenced image if available
            if (contour.referencedSOPInstanceUID) {
              contourItem.ContourImageSequence = [{
                ReferencedSOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
                ReferencedSOPInstanceUID: contour.referencedSOPInstanceUID
              }];
            }
            
            return contourItem;
          });
        
        return {
          ReferencedROINumber: structure.roiNumber.toString(),
          ROIDisplayColor: structure.color.join('\\'),
          ContourSequence: contourSequence.length > 0 ? contourSequence : undefined
        };
      }),
      
      // RT ROI Observations Sequence
      RTROIObservationsSequence: input.structures.map(structure => ({
        ObservationNumber: structure.roiNumber.toString(),
        ReferencedROINumber: structure.roiNumber.toString(),
        ROIObservationLabel: structure.structureName,
        RTROIInterpretedType: 'ORGAN',
        ROIInterpreter: ''
      }))
    };

    try {
      // Create meta header for DICOM Part 10 file
      const meta = {
        '00020001': { vr: 'OB', Value: [new Uint8Array([0, 1])] }, // FileMetaInformationVersion
        '00020002': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.481.3'] }, // MediaStorageSOPClassUID (RT Structure Set)
        '00020003': { vr: 'UI', Value: [input.sopInstanceUID] }, // MediaStorageSOPInstanceUID
        '00020010': { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] }, // TransferSyntaxUID (Explicit VR Little Endian)
        '00020012': { vr: 'UI', Value: ['1.2.826.0.1.3680043.8.498'] }, // ImplementationClassUID
        '00020013': { vr: 'SH', Value: ['CONVERGE_RT'] }, // ImplementationVersionName
      };
      
      // Convert natural dataset to tag-based format
      const tagDataset = DicomMetaDictionary.denaturalizeDataset(dataset);
      
      // Create DICOM dictionary with meta and dataset
      const dicomDict = new DicomDict(meta);
      dicomDict.dict = tagDataset;
      
      // Generate the Part 10 buffer
      const buffer = dicomDict.write();
      
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write to file
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      
      console.log(`✅ RT Structure Set written successfully: ${outputPath}`);
      console.log(`   - ${input.structures.length} structures`);
      console.log(`   - ${input.structures.reduce((sum, s) => sum + s.contours.length, 0)} total contours`);
      
    } catch (error) {
      console.error('Error writing RT Structure Set:', error);
      throw error;
    }
  }

  /**
   * Create RT Structure file from existing structure data
   */
  static async createFromExisting(
    originalFilePath: string,
    structures: any[],
    newLabel: string,
    outputPath: string,
    newSeriesInstanceUID?: string,
    newSOPInstanceUID?: string
  ): Promise<{ seriesInstanceUID: string; sopInstanceUID: string }> {
    // Parse the original file to get metadata
    const { RTStructureParser } = await import('./rt-structure-parser');
    const original = RTStructureParser.parseRTStructureSet(originalFilePath);
    
    // Generate new UIDs if not provided
    const seriesUID = newSeriesInstanceUID || this.generateUID();
    const sopUID = newSOPInstanceUID || this.generateUID();
    
    // Get referenced SOP Instance UIDs from original file
    // For now, we'll create an empty array - in practice you'd want to copy these from original
    const referencedSOPInstanceUIDs: string[] = [];
    
    // Convert structures to write format
    const writeStructures = structures.map(s => ({
      roiNumber: s.roiNumber,
      structureName: s.structureName || s.name,
      color: Array.isArray(s.color) ? s.color as [number, number, number] : [255, 0, 0] as [number, number, number],
      contours: (s.contours || []).map((c: any) => ({
        slicePosition: c.slicePosition || c.z,
        points: Array.isArray(c.points) ? c.points : [],
        referencedSOPInstanceUID: c.referencedSOPInstanceUID
      }))
    }));
    
    const input: RTStructureWriteInput = {
      studyInstanceUID: original.studyInstanceUID,
      referencedSeriesInstanceUID: original.referencedSeriesUID || '',
      referencedFrameOfReferenceUID: original.frameOfReferenceUID || '',
      referencedSOPInstanceUIDs,
      seriesInstanceUID: seriesUID,
      sopInstanceUID: sopUID,
      structureSetLabel: newLabel,
      structures: writeStructures
    };
    
    this.writeRTStructureSet(input, outputPath);
    
    return { seriesInstanceUID: seriesUID, sopInstanceUID: sopUID };
  }
}

export default RTStructureWriter;
