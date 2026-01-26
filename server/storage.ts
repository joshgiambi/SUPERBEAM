import fs from "fs";
import path from "path";
import { studies, series, images, patients, pacsConnections, patientTags, registrations, rtStructureSets, rtStructures, rtStructureContours, rtStructureHistory, rtSuperstructures, mediaPreviews, fuseboxRuns, dvhCache, type Study, type Series, type DicomImage, type Patient, type PacsConnection, type PatientTag, type Registration, type InsertStudy, type InsertSeries, type InsertImage, type InsertPatient, type InsertPacsConnection, type InsertPatientTag, type InsertRegistration, type RTStructureSet, type InsertRTStructureSet, type RTStructure, type InsertRTStructure, type RTStructureContour, type InsertRTStructureContour, type RTStructureHistory, type InsertRTStructureHistory, type RTSuperstructure, type InsertRTSuperstructure, type MediaPreview, type DvhCache, type InsertDvhCache } from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, and } from "drizzle-orm";

// In-memory storage for RT structure modifications
interface RTStructureModification {
  structureName?: string;
  color?: number[];
}

const rtStructureModifications = new Map<number, RTStructureModification>();

export interface IStorage {
  // Patient operations
  createPatient(patient: InsertPatient): Promise<Patient>;
  getPatient(id: number): Promise<Patient | undefined>;
  getPatientByID(patientID: string): Promise<Patient | undefined>;
  getAllPatients(): Promise<Patient[]>;
  deletePatient(id: number): Promise<void>;
  deletePatientFully(patientId: number): Promise<void>;

  // Study operations
  createStudy(study: InsertStudy): Promise<Study>;
  getStudy(id: number): Promise<Study | undefined>;
  getStudyByUID(studyInstanceUID: string): Promise<Study | undefined>;
  getAllStudies(): Promise<Study[]>;
  getStudiesByPatient(patientId: number): Promise<Study[]>;
  relinkStudyToPatient(studyId: number, newPatientId: number): Promise<void>;

  // Series operations
  createSeries(series: InsertSeries): Promise<Series>;
  getSeries(id: number): Promise<Series | undefined>;
  getSeriesById(id: number): Promise<Series | undefined>;
  getSeriesByUID(seriesInstanceUID: string): Promise<Series | undefined>;
  getSeriesByStudyId(studyId: number): Promise<Series[]>;
  getSeriesWithImages(seriesId: number): Promise<any>;
  getRTStructuresForStudy(studyId: number): Promise<Series[]>;
  getAllSeries(): Promise<Series[]>;
  deleteSeriesFully(seriesId: number): Promise<void>;

  // Image operations
  createImage(image: InsertImage): Promise<DicomImage>;
  getImage(id: number): Promise<DicomImage | undefined>;
  getImageByUID(sopInstanceUID: string): Promise<DicomImage | undefined>;
  getImagesBySeriesId(seriesId: number): Promise<DicomImage[]>;
  // Update image geometry/metadata fields (partial)
  updateImageGeometry(imageId: number, updates: {
    imagePosition?: string | number[] | null;
    imageOrientation?: string | number[] | null;
    pixelSpacing?: string | number[] | null;
    metadata?: any;
  }): Promise<void>;
  
  // PACS operations
  createPacsConnection(connection: InsertPacsConnection): Promise<PacsConnection>;
  getPacsConnection(id: number): Promise<PacsConnection | undefined>;
  getAllPacsConnections(): Promise<PacsConnection[]>;
  updatePacsConnection(id: number, updates: Partial<InsertPacsConnection>): Promise<PacsConnection>;
  deletePacsConnection(id: number): Promise<void>;
  
  // Update operations
  updateSeriesImageCount(seriesId: number, count: number): Promise<void>;
  updateStudyCounts(studyId: number, seriesCount: number, imageCount: number): Promise<void>;
  
  // RT Structure operations
  updateRTStructureName(structureId: number, name: string): Promise<void>;
  updateRTStructureColor(structureId: number, color: number[]): Promise<void>;
  
  // RT Structure Set operations
  createRTStructureSet(data: InsertRTStructureSet): Promise<RTStructureSet>;
  getRTStructureSet(id: number): Promise<RTStructureSet | null>;
  getRTStructureSetsForPatient(patientId: number): Promise<RTStructureSet[]>;
  getRTStructureSetBySeriesId(seriesId: number): Promise<RTStructureSet | null>;
  updateRTStructureSet(id: number, data: Partial<RTStructureSet>): Promise<void>;
  saveRTStructureSet(seriesId: number, structureSetData: any, actionType: string, actionDetails: any): Promise<void>;
  duplicateRTStructureSet(seriesId: number, newLabel: string): Promise<{ newSeriesId: number; rtStructureSet: RTStructureSet }>;
  restoreFromHistory(seriesId: number, historyId: number): Promise<void>;
  
  // RT Structure operations
  createRTStructure(data: InsertRTStructure): Promise<RTStructure>;
  getRTStructuresBySetId(rtStructureSetId: number): Promise<RTStructure[]>;
  updateRTStructure(id: number, data: Partial<RTStructure>): Promise<void>;
  deleteRTStructure(id: number): Promise<void>;
  
  // RT Structure Contour operations
  createRTStructureContours(data: InsertRTStructureContour[]): Promise<void>;
  getRTStructureContours(rtStructureId: number): Promise<RTStructureContour[]>;
  updateRTStructureContours(rtStructureId: number, contours: InsertRTStructureContour[]): Promise<void>;
  deleteRTStructureContours(rtStructureId: number, slicePositions?: number[]): Promise<void>;
  
  // RT Structure History operations
  createRTStructureHistory(data: InsertRTStructureHistory): Promise<RTStructureHistory>;
  getRTStructureHistory(rtStructureSetId: number, options?: {
    startDate?: Date;
    endDate?: Date;
    actionTypes?: string[];
    structureIds?: number[];
    limit?: number;
    offset?: number;
  }): Promise<RTStructureHistory[]>;
  getRTStructureHistorySnapshot(historyId: number): Promise<RTStructureHistory | null>;
  
  // Registration operations (temporarily disabled for rebuild)
  createRegistration(data: InsertRegistration): Promise<Registration | null>;
  getRegistrationByStudyId(studyId: number): Promise<Registration | null>;
  deleteRegistrationByStudyId(studyId: number): Promise<void>;
  
  // Patient metadata editing
  updatePatientMetadata(patientId: number, metadata: Partial<InsertPatient>): Promise<Patient | null>;
  updateSeriesDescription(seriesId: number, description: string): Promise<Series | null>;
  
  // Patient tagging
  createPatientTag(data: InsertPatientTag): Promise<PatientTag | null>;
  getPatientTags(patientId: number): Promise<PatientTag[]>;
  deletePatientTag(tagId: number): Promise<boolean>;
  generateAnatomicalTags(patientId: number): Promise<PatientTag[]>;
  
  // Clear all data
  clearAll(): void;
}

export class MemStorage {
  private studies: Map<number, Study>;
  private series: Map<number, Series>;
  private images: Map<number, DicomImage>;
  private currentStudyId: number;
  private currentSeriesId: number;
  private currentImageId: number;

  constructor() {
    this.studies = new Map();
    this.series = new Map();
    this.images = new Map();
    this.currentStudyId = 1;
    this.currentSeriesId = 1;
    this.currentImageId = 1;
  }

  async createStudy(insertStudy: InsertStudy): Promise<Study> {
    const id = this.currentStudyId++;
    const study: Study = {
      id,
      studyInstanceUID: insertStudy.studyInstanceUID,
      patientId: (insertStudy as any).patientId ?? null,
      patientName: insertStudy.patientName || null,
      patientID: insertStudy.patientID || null,
      studyDate: insertStudy.studyDate || null,
      studyDescription: insertStudy.studyDescription || null,
      accessionNumber: insertStudy.accessionNumber || null,
      modality: (insertStudy as any).modality ?? null,
      numberOfSeries: (insertStudy as any).numberOfSeries ?? 0,
      numberOfImages: (insertStudy as any).numberOfImages ?? 0,
      isDemo: (insertStudy as any).isDemo ?? false,
      createdAt: new Date(),
    };
    this.studies.set(id, study);
    return study;
  }

  async getStudy(id: number): Promise<Study | undefined> {
    return this.studies.get(id);
  }

  async getStudyByUID(studyInstanceUID: string): Promise<Study | undefined> {
    return Array.from(this.studies.values()).find(
      (study) => study.studyInstanceUID === studyInstanceUID
    );
  }

  async getAllStudies(): Promise<Study[]> {
    return Array.from(this.studies.values());
  }

  async relinkStudyToPatient(studyId: number, newPatientId: number): Promise<void> {
    const study = this.studies.get(studyId);
    if (study) {
      (study as any).patientId = newPatientId;
      this.studies.set(studyId, study);
    }
  }

  async createSeries(insertSeries: InsertSeries): Promise<Series> {
    const id = this.currentSeriesId++;
    const seriesData: Series = {
      id,
      studyId: insertSeries.studyId,
      seriesInstanceUID: insertSeries.seriesInstanceUID,
      seriesDescription: insertSeries.seriesDescription || null,
      modality: insertSeries.modality,
      seriesNumber: insertSeries.seriesNumber || null,
      imageCount: insertSeries.imageCount || 0,
      sliceThickness: insertSeries.sliceThickness || null,
      metadata: insertSeries.metadata || {},
      createdAt: new Date(),
    };
    this.series.set(id, seriesData);
    return seriesData;
  }

  async getSeries(id: number): Promise<Series | undefined> {
    return this.series.get(id);
  }

  async getSeriesByUID(seriesInstanceUID: string): Promise<Series | undefined> {
    return Array.from(this.series.values()).find(
      (series) => series.seriesInstanceUID === seriesInstanceUID
    );
  }

  async getSeriesByStudyId(studyId: number): Promise<Series[]> {
    return Array.from(this.series.values()).filter(
      (series) => series.studyId === studyId
    );
  }

  async createImage(insertImage: InsertImage): Promise<DicomImage> {
    const id = this.currentImageId++;
    const image: DicomImage = {
      id,
      seriesId: insertImage.seriesId,
      sopInstanceUID: insertImage.sopInstanceUID,
      instanceNumber: insertImage.instanceNumber || null,
      filePath: insertImage.filePath,
      fileName: insertImage.fileName,
      fileSize: insertImage.fileSize || null,
      imagePosition: insertImage.imagePosition || null,
      imageOrientation: insertImage.imageOrientation || null,
      pixelSpacing: insertImage.pixelSpacing || null,
      sliceLocation: insertImage.sliceLocation || null,
      windowCenter: insertImage.windowCenter || null,
      windowWidth: insertImage.windowWidth || null,
      metadata: insertImage.metadata || {},
      createdAt: new Date(),
    };
    this.images.set(id, image);
    return image;
  }

  async getImage(id: number): Promise<DicomImage | undefined> {
    return this.images.get(id);
  }

  async getImageByUID(sopInstanceUID: string): Promise<DicomImage | undefined> {
    return Array.from(this.images.values()).find(
      (image) => image.sopInstanceUID === sopInstanceUID
    );
  }

  async getImagesBySeriesId(seriesId: number): Promise<DicomImage[]> {
    return Array.from(this.images.values()).filter(
      (image) => image.seriesId === seriesId
    ).sort((a, b) => (a.instanceNumber || 0) - (b.instanceNumber || 0));
  }

  async updateImageGeometry(imageId: number, updates: {
    imagePosition?: string | number[] | null;
    imageOrientation?: string | number[] | null;
    pixelSpacing?: string | number[] | null;
    metadata?: any;
  }): Promise<void> {
    const img = this.images.get(imageId);
    if (!img) return;
    const next: any = { ...img };
    if (updates.imagePosition !== undefined) next.imagePosition = updates.imagePosition as any;
    if (updates.imageOrientation !== undefined) next.imageOrientation = updates.imageOrientation as any;
    if (updates.pixelSpacing !== undefined) next.pixelSpacing = updates.pixelSpacing as any;
    if (updates.metadata !== undefined) next.metadata = updates.metadata as any;
    this.images.set(imageId, next);
  }

  async updateSeriesImageCount(seriesId: number, count: number): Promise<void> {
    const seriesData = this.series.get(seriesId);
    if (seriesData) {
      seriesData.imageCount = count;
      this.series.set(seriesId, seriesData);
    }
  }

  clearAll(): void {
    this.studies.clear();
    this.series.clear();
    this.images.clear();
    this.currentStudyId = 1;
    this.currentSeriesId = 1;
    this.currentImageId = 1;
  }
}

export class DatabaseStorage implements IStorage {
  // Patient operations
  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const [patient] = await db
      .insert(patients)
      .values(insertPatient)
      .returning();
    return patient;
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient || undefined;
  }

  async getPatientByID(patientID: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.patientID, patientID));
    return patient || undefined;
  }

  async getAllPatients(): Promise<Patient[]> {
    return await db.select().from(patients).orderBy(desc(patients.createdAt));
  }

  async deletePatient(id: number): Promise<void> {
    // Always use full delete to prevent orphaned studies/series/images
    // The simple delete was leaving orphaned records that blocked re-imports
    await this.deletePatientFully(id);
  }

  // Fully delete a patient: images, series, studies, registrations, media, RT data, filesystem, fusion data
  async deletePatientFully(patientId: number): Promise<void> {
    console.log(`🗑️ Starting full deletion of patient ${patientId}`);
    
    // Get patient info for filesystem cleanup
    const patient = await this.getPatient(patientId);
    console.log(`Patient info:`, { id: patient?.id, patientID: patient?.patientID, patientName: patient?.patientName });
    
    // Gather studies and all series IDs for cleanup
    const patientStudies = await this.getStudiesByPatient(patientId);
    const allSeriesIds: number[] = [];
    
    for (const st of patientStudies) {
      const studySeries = await this.getSeriesByStudyId(st.id);
      allSeriesIds.push(...studySeries.map(s => s.id));
    }
    
    // Clean up fusebox_runs table first (foreign key constraints)
    try {
      const { fuseboxRuns } = await import('@shared/schema');
      const { or } = await import('drizzle-orm');
      
      if (allSeriesIds.length > 0) {
        // Delete fusebox_runs that reference any of this patient's series
        await db.delete(fuseboxRuns).where(
          or(
            ...allSeriesIds.map(seriesId => eq(fuseboxRuns.primarySeriesId, seriesId)),
            ...allSeriesIds.map(seriesId => eq(fuseboxRuns.secondarySeriesId, seriesId))
          )
        );
        console.log(`🗑️ Cleaned up fusebox_runs for ${allSeriesIds.length} series`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean up fusebox_runs:', error);
    }
    
    for (const st of patientStudies) {
      // Delete registrations tied to study
      try { await this.deleteRegistrationByStudyId(st.id); } catch {}
      // Gather series for study
      const studySeries = await this.getSeriesByStudyId(st.id);
      for (const ser of studySeries) {
        await this.deleteSeriesFully(ser.id);
      }
      // Delete study record itself
      await db.delete(studies).where(eq(studies.id, st.id));
    }
    // Delete patient tags
    try { await db.delete(patientTags).where(eq(patientTags.patientId, patientId)); } catch {}
    // Finally delete the patient
    await db.delete(patients).where(eq(patients.id, patientId));
    
    // Clean up patient filesystem data (ENABLED for full cleanup)
    try {
      if (patient?.patientID) {
        const patientFolder = path.join('storage', 'patients', patient.patientID);
        if (fs.existsSync(patientFolder)) {
          console.log(`🗑️ Removing patient directory: ${patientFolder}`);
          // Simple, aggressive removal of entire patient directory
          fs.rmSync(patientFolder, { recursive: true, force: true });
          console.log(`✅ Successfully removed patient directory: ${patientFolder}`);
        } else {
          console.log(`⚠️ Patient directory not found: ${patientFolder}`);
        }
      } else {
        console.warn(`⚠️ Patient ${patientId} has no patientID for filesystem cleanup`);
      }
    } catch (error) {
      console.error('❌ Failed to remove patient directory:', error);
    }
    
    // Clean up fusion-related temp files and cache
    try {
      // Clear fusion manifest cache for this patient's series
      const { fusionManifestService } = await import('./fusion/manifest-service.ts');
      for (const study of patientStudies) {
        const studySeries = await this.getSeriesByStudyId(study.id);
        for (const series of studySeries) {
          fusionManifestService.clearCache(series.id);
        }
      }
      
      // Clean up fusion transform cache
      const fusionTransformsDir = path.join('tmp', 'fusebox-transforms');
      if (fs.existsSync(fusionTransformsDir)) {
        const files = fs.readdirSync(fusionTransformsDir);
        for (const file of files) {
          // Remove transform files that reference any of this patient's series
          for (const study of patientStudies) {
            const studySeries = await this.getSeriesByStudyId(study.id);
            for (const series of studySeries) {
              if (file.includes(`${series.id}_`) || file.includes(`_${series.id}_`)) {
                try {
                  fs.unlinkSync(path.join(fusionTransformsDir, file));
                  console.log(`Removed fusion transform: ${file}`);
                } catch {}
              }
            }
          }
        }
      }
      
      // Clean up any remaining fusebox temp directories
      const tmpDir = 'tmp';
      if (fs.existsSync(tmpDir)) {
        const entries = fs.readdirSync(tmpDir);
        for (const entry of entries) {
          if (entry.startsWith('fusebox-')) {
            try {
              const fullPath = path.join(tmpDir, entry);
              fs.rmSync(fullPath, { recursive: true, force: true });
              console.log(`Removed fusebox temp directory: ${entry}`);
            } catch {}
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clean up fusion data:', error);
    }
  }

  // Study operations
  async createStudy(insertStudy: InsertStudy): Promise<Study> {
    const [study] = await db
      .insert(studies)
      .values(insertStudy)
      .returning();
    return study;
  }

  async getStudy(id: number): Promise<Study | undefined> {
    const [study] = await db.select().from(studies).where(eq(studies.id, id));
    return study || undefined;
  }

  async getStudyByUID(studyInstanceUID: string): Promise<Study | undefined> {
    const [study] = await db.select().from(studies).where(eq(studies.studyInstanceUID, studyInstanceUID));
    return study || undefined;
  }

  async getAllStudies(): Promise<Study[]> {
    return await db.select().from(studies).orderBy(desc(studies.createdAt));
  }

  async getStudiesByPatient(patientId: string | number): Promise<Study[]> {
    // If patientId is a string, it's a DICOM patient ID - convert to database ID
    if (typeof patientId === 'string') {
      const patient = await this.getPatientByID(patientId);
      if (!patient) {
        console.log(`No patient found with DICOM ID: ${patientId}`);
        return [];
      }
      return await db.select().from(studies).where(eq(studies.patientId, patient.id)).orderBy(desc(studies.createdAt));
    }
    
    // If patientId is a number, use it directly as database ID
    return await db.select().from(studies).where(eq(studies.patientId, patientId)).orderBy(desc(studies.createdAt));
  }

  async relinkStudyToPatient(studyId: number, newPatientId: number): Promise<void> {
    await db
      .update(studies)
      .set({ patientId: newPatientId })
      .where(eq(studies.id, studyId));
  }

  // Series operations
  async createSeries(insertSeries: InsertSeries): Promise<Series> {
    const [seriesData] = await db
      .insert(series)
      .values(insertSeries)
      .returning();
    return seriesData;
  }

  async getSeries(id: number): Promise<Series | undefined> {
    const [seriesData] = await db.select().from(series).where(eq(series.id, id));
    return seriesData || undefined;
  }

  async getSeriesByUID(seriesInstanceUID: string): Promise<Series | undefined> {
    const [seriesData] = await db.select().from(series).where(eq(series.seriesInstanceUID, seriesInstanceUID));
    return seriesData || undefined;
  }

  async getSeriesByStudyId(studyId: number): Promise<Series[]> {
    return await db.select().from(series).where(eq(series.studyId, studyId));
  }

  // Image operations
  async createImage(insertImage: InsertImage): Promise<DicomImage> {
    const [image] = await db
      .insert(images)
      .values(insertImage)
      .returning();
    return image;
  }

  async getImage(id: number): Promise<DicomImage | undefined> {
    const [image] = await db.select().from(images).where(eq(images.id, id));
    return image || undefined;
  }

  async getImageByUID(sopInstanceUID: string): Promise<DicomImage | undefined> {
    const [image] = await db.select().from(images).where(eq(images.sopInstanceUID, sopInstanceUID));
    return image || undefined;
  }

  async getImagesBySeriesId(seriesId: number): Promise<DicomImage[]> {
    return await db.select().from(images).where(eq(images.seriesId, seriesId));
  }

  async updateImageGeometry(imageId: number, updates: {
    imagePosition?: string | number[] | null;
    imageOrientation?: string | number[] | null;
    pixelSpacing?: string | number[] | null;
    metadata?: any;
  }): Promise<void> {
    const toDbVal = (v: any) => v === undefined ? undefined : v;
    await db
      .update(images)
      .set({
        imagePosition: toDbVal(updates.imagePosition) as any,
        imageOrientation: toDbVal(updates.imageOrientation) as any,
        pixelSpacing: toDbVal(updates.pixelSpacing) as any,
        metadata: toDbVal(updates.metadata) as any,
      })
      .where(eq(images.id, imageId));
  }

  // PACS operations
  async createPacsConnection(insertConnection: InsertPacsConnection): Promise<PacsConnection> {
    const [connection] = await db
      .insert(pacsConnections)
      .values(insertConnection)
      .returning();
    return connection;
  }

  async getPacsConnection(id: number): Promise<PacsConnection | undefined> {
    const [connection] = await db.select().from(pacsConnections).where(eq(pacsConnections.id, id));
    return connection || undefined;
  }

  async getAllPacsConnections(): Promise<PacsConnection[]> {
    return await db.select().from(pacsConnections).orderBy(desc(pacsConnections.createdAt));
  }

  async updatePacsConnection(id: number, updates: Partial<InsertPacsConnection>): Promise<PacsConnection> {
    const [connection] = await db
      .update(pacsConnections)
      .set(updates)
      .where(eq(pacsConnections.id, id))
      .returning();
    return connection;
  }

  async deletePacsConnection(id: number): Promise<void> {
    await db.delete(pacsConnections).where(eq(pacsConnections.id, id));
  }

  // Update operations
  async updateSeriesImageCount(seriesId: number, count: number): Promise<void> {
    await db
      .update(series)
      .set({ imageCount: count })
      .where(eq(series.id, seriesId));
  }

  async updateStudyCounts(studyId: number, seriesCount: number, imageCount: number): Promise<void> {
    await db
      .update(studies)
      .set({ 
        numberOfSeries: seriesCount,
        numberOfImages: imageCount 
      })
      .where(eq(studies.id, studyId));
  }

  async getSeriesWithImages(seriesId: number): Promise<any> {
    const [seriesData] = await db
      .select()
      .from(series)
      .where(eq(series.id, seriesId));

    if (!seriesData) return null;

    const seriesImages = await db
      .select()
      .from(images)
      .where(eq(images.seriesId, seriesId));

    return {
      ...seriesData,
      images: seriesImages
    };
  }

  async getSeriesById(id: number): Promise<Series | undefined> {
    const [seriesData] = await db
      .select()
      .from(series)
      .where(eq(series.id, id));
    return seriesData || undefined;
  }

  async getRTStructuresForStudy(studyId: number): Promise<Series[]> {
    return await db
      .select()
      .from(series)
      .where(eq(series.studyId, studyId));
  }
  
  async getAllSeries(): Promise<Series[]> {
    return await db
      .select()
      .from(series)
      .orderBy(series.studyId, series.seriesNumber);
  }

  // Fully delete a single series: images, mediaPreviews, RT linkage, filesystem, series row
  async deleteSeriesFully(seriesId: number): Promise<void> {
    // Delete images from disk then DB
    const imgs = await this.getImagesBySeriesId(seriesId);
    for (const img of imgs) {
      if (img.filePath) {
        try { fs.unlinkSync(img.filePath); } catch {}
      }
    }
    await db.delete(images).where(eq(images.seriesId, seriesId));

    // Delete media previews
    try {
      const previews = await db.select().from(mediaPreviews).where(eq(mediaPreviews.seriesId, seriesId));
      for (const p of previews as MediaPreview[]) {
        if ((p as any).filePath) {
          try { fs.unlinkSync((p as any).filePath as any); } catch {}
        }
      }
      await db.delete(mediaPreviews).where(eq(mediaPreviews.seriesId, seriesId));
    } catch {}

    // Remove series directory if metadata.localPath recorded
    try {
      const ser = await this.getSeriesById(seriesId);
      const localPath = (ser?.metadata as any)?.localPath;
      if (typeof localPath === 'string' && localPath) {
        try { fs.rmSync(localPath, { recursive: true, force: true }); } catch {}
      }
    } catch {}

    // Delete RT structure sets referencing this series (both as seriesId and referencedSeriesId)
    try {
      // Find all RT structure sets that reference this series (either as the RT series or the referenced CT/MR)
      const rtSetsToDelete = await db.select().from(rtStructureSets).where(
        or(
          eq(rtStructureSets.seriesId, seriesId),
          eq(rtStructureSets.referencedSeriesId, seriesId)
        )
      );
      
      for (const rtSet of rtSetsToDelete) {
        // Delete rt_structure_history first (references rtStructureSetId)
        await db.delete(rtStructureHistory).where(eq(rtStructureHistory.rtStructureSetId, (rtSet as any).id));
        
        // Delete structures and their contours
        const structs = await db.select().from(rtStructures).where(eq(rtStructures.rtStructureSetId, (rtSet as any).id));
        for (const s of structs) {
          await db.delete(rtStructureContours).where(eq(rtStructureContours.rtStructureId, (s as any).id));
        }
        await db.delete(rtStructures).where(eq(rtStructures.rtStructureSetId, (rtSet as any).id));
        await db.delete(rtStructureSets).where(eq(rtStructureSets.id, (rtSet as any).id));
      }
    } catch (error) {
      console.warn(`Failed to delete RT structure sets for series ${seriesId}:`, error);
    }

    // Clean up fusion data for this series
    try {
      // Clear fusion manifest cache
      const { fusionManifestService } = await import('./fusion/manifest-service.ts');
      fusionManifestService.clearCache(seriesId);
      
      // Clean up fusion transform files that reference this series
      const fusionTransformsDir = path.join('tmp', 'fusebox-transforms');
      if (fs.existsSync(fusionTransformsDir)) {
        const files = fs.readdirSync(fusionTransformsDir);
        for (const file of files) {
          if (file.includes(`${seriesId}_`) || file.includes(`_${seriesId}_`)) {
            try {
              fs.unlinkSync(path.join(fusionTransformsDir, file));
              console.log(`Removed fusion transform for series ${seriesId}: ${file}`);
            } catch {}
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to clean up fusion data for series ${seriesId}:`, error);
    }

    // Remove fusebox run history referencing this series to satisfy FK constraints
    try {
      await db
        .delete(fuseboxRuns)
        .where(
          or(
            eq(fuseboxRuns.primarySeriesId, seriesId),
            eq(fuseboxRuns.secondarySeriesId, seriesId),
          ),
        );
    } catch (error) {
      console.warn(`Failed to delete fusebox runs for series ${seriesId}:`, error);
    }

    // Finally delete the series row
    await db.delete(series).where(eq(series.id, seriesId));
  }

  // RT Structure operations
  async updateRTStructureName(structureId: number, name: string): Promise<void> {
    const existing = rtStructureModifications.get(structureId) || {};
    rtStructureModifications.set(structureId, { ...existing, structureName: name });
    console.log(`Updated RT structure ${structureId} name to: ${name}`);
  }

  async updateRTStructureColor(structureId: number, color: number[]): Promise<void> {
    const existing = rtStructureModifications.get(structureId) || {};
    rtStructureModifications.set(structureId, { ...existing, color });
    console.log(`Updated RT structure ${structureId} color to: ${color}`);
  }

  // Registration operations (re-enabled as cache persistence for REG parsing)
  async createRegistration(data: InsertRegistration): Promise<Registration | null> {
    try {
      const normalized: any = { ...data };
      if (normalized && typeof normalized.transformationMatrix !== 'string') {
        try {
          normalized.transformationMatrix = JSON.stringify(normalized.transformationMatrix);
        } catch (_) {
          normalized.transformationMatrix = JSON.stringify([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
          ]);
        }
      }
      if (normalized && normalized.metadata && typeof normalized.metadata !== 'string') {
        try { normalized.metadata = JSON.stringify(normalized.metadata); } catch { normalized.metadata = JSON.stringify({}); }
      }
      const [registration] = await db.insert(registrations).values(normalized).returning();
      return registration;
    } catch (error) {
      console.error('Error creating registration:', error);
      return null;
    }
  }

  async getRegistrationByStudyId(studyId: number): Promise<Registration | null> {
    try {
      const [registration] = await db.select().from(registrations).where(eq(registrations.studyId, studyId));
      return registration || null;
    } catch (error) {
      console.error('Error getting registration:', error);
      return null;
    }
  }

  async deleteRegistrationByStudyId(studyId: number): Promise<void> {
    try {
      await db.delete(registrations).where(eq(registrations.studyId, studyId));
    } catch (error) {
      console.error('Error deleting registration:', error);
      throw error;
    }
  }

  // Patient metadata editing
  async updatePatientMetadata(patientId: number, metadata: Partial<InsertPatient>): Promise<Patient | null> {
    try {
      const [updated] = await db
        .update(patients)
        .set(metadata)
        .where(eq(patients.id, patientId))
        .returning();
      return updated || null;
    } catch (error) {
      console.error('Error updating patient metadata:', error);
      return null;
    }
  }

  async updateSeriesDescription(seriesId: number, description: string): Promise<Series | null> {
    try {
      const [updated] = await db
        .update(series)
        .set({ seriesDescription: description })
        .where(eq(series.id, seriesId))
        .returning();
      return updated || null;
    } catch (error) {
      console.error('Error updating series description:', error);
      return null;
    }
  }

  // Patient tagging
  async createPatientTag(data: InsertPatientTag): Promise<PatientTag | null> {
    try {
      const [tag] = await db.insert(patientTags).values(data).returning();
      return tag;
    } catch (error) {
      console.error('Error creating patient tag:', error);
      return null;
    }
  }

  async getPatientTags(patientId: number): Promise<PatientTag[]> {
    try {
      return await db.select().from(patientTags).where(eq(patientTags.patientId, patientId));
    } catch (error) {
      console.error('Error getting patient tags:', error);
      return [];
    }
  }

  async deletePatientTag(tagId: number): Promise<boolean> {
    try {
      await db.delete(patientTags).where(eq(patientTags.id, tagId));
      return true;
    } catch (error) {
      console.error('Error deleting patient tag:', error);
      return false;
    }
  }

  async generateAnatomicalTags(patientId: number): Promise<PatientTag[]> {
    try {
      // Get all studies for this patient
      const patientStudies = await this.getStudiesByPatient(patientId);
      const tags: PatientTag[] = [];
      const createdTags: PatientTag[] = [];
      
      // For each study, check series for RT structures and determine anatomical sites
      for (const study of patientStudies) {
        const studySeries = await this.getSeriesByStudyId(study.id);
        const rtStructures = studySeries.filter(s => s.modality === 'RTSTRUCT');
        
        // Analyze RT structures to determine anatomical sites
        const anatomicalSites = new Set<string>();
        
        // Common anatomical mapping based on structure names
        const anatomicalMapping: Record<string, string> = {
          'BRAIN': 'Head & Neck',
          'BRAINSTEM': 'Head & Neck',
          'CHIASM': 'Head & Neck',
          'GLOBE': 'Head & Neck',
          'LENS': 'Head & Neck',
          'OPTIC': 'Head & Neck',
          'PAROTID': 'Head & Neck',
          'MANDIBLE': 'Head & Neck',
          'LARYNX': 'Head & Neck',
          'CTVNECK': 'Head & Neck',
          'LUNG': 'Thorax',
          'HEART': 'Thorax',
          'ESOPHAGUS': 'Thorax',
          'LIVER': 'Abdomen',
          'KIDNEY': 'Abdomen',
          'BOWEL': 'Abdomen',
          'BLADDER': 'Pelvis',
          'RECTUM': 'Pelvis',
          'FEMUR': 'Pelvis'
        };
        
        // For now, we'll check if it's head & neck based on common structures
        if (rtStructures.length > 0) {
          anatomicalSites.add('Head & Neck'); // Default for HN-ATLAS dataset
        }
        
        // Check for fusion capability
        const hasCT = studySeries.some(s => s.modality === 'CT');
        const hasMRI = studySeries.some(s => s.modality === 'MR');
        const hasRegistration = null;
        if (hasCT && hasMRI && hasRegistration) {
          const fusionTag = await this.createPatientTag({
            patientId,
            tagType: 'fusion',
            tagValue: 'CT/MRI Fusion Ready',
            color: '#9333ea' // Purple
          });
          if (fusionTag) createdTags.push(fusionTag);
        }
        
        // Add anatomical tags
        for (const site of Array.from(anatomicalSites)) {
          const anatomicalTag = await this.createPatientTag({
            patientId,
            tagType: 'anatomical',
            tagValue: site,
            color: '#10b981' // Green
          });
          if (anatomicalTag) createdTags.push(anatomicalTag);
        }
      }
      
      return createdTags;
    } catch (error) {
      console.error('Error generating anatomical tags:', error);
      return [];
    }
  }

  // RT Structure Set operations
  async createRTStructureSet(data: InsertRTStructureSet): Promise<RTStructureSet> {
    const [result] = await db.insert(rtStructureSets).values(data).returning();
    return result;
  }

  async getRTStructureSet(id: number): Promise<RTStructureSet | null> {
    const [result] = await db.select().from(rtStructureSets).where(eq(rtStructureSets.id, id));
    return result || null;
  }

  async getRTStructureSetsForPatient(patientId: number): Promise<RTStructureSet[]> {
    // First get all studies for the patient
    const patientStudies = await db
      .select({ id: studies.id })
      .from(studies)
      .where(eq(studies.patientId, patientId));
    
    if (patientStudies.length === 0) return [];
    
    const studyIds = patientStudies.map((s: { id: number }) => s.id);
    
    // Get all RT structure sets for those studies
    const result = await db
      .select()
      .from(rtStructureSets)
      .where(eq(rtStructureSets.studyId, studyIds[0])); // TODO: Handle multiple studies
    
    return result;
  }

  async getRTStructureSetBySeriesId(seriesId: number): Promise<RTStructureSet | null> {
    const [result] = await db
      .select()
      .from(rtStructureSets)
      .where(eq(rtStructureSets.seriesId, seriesId));
    return result || null;
  }

  async updateRTStructureSet(id: number, data: Partial<RTStructureSet>): Promise<void> {
    await db
      .update(rtStructureSets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rtStructureSets.id, id));
  }

  // RT Structure operations
  async createRTStructure(data: InsertRTStructure): Promise<RTStructure> {
    const [result] = await db.insert(rtStructures).values(data).returning();
    return result;
  }

  async getRTStructuresBySetId(rtStructureSetId: number): Promise<RTStructure[]> {
    return await db
      .select()
      .from(rtStructures)
      .where(eq(rtStructures.rtStructureSetId, rtStructureSetId));
  }

  async updateRTStructure(id: number, data: Partial<RTStructure>): Promise<void> {
    await db.update(rtStructures).set(data).where(eq(rtStructures.id, id));
  }

  async deleteRTStructure(id: number): Promise<void> {
    // First delete all contours for this structure
    await db.delete(rtStructureContours).where(eq(rtStructureContours.rtStructureId, id));
    // Then delete the structure itself
    await db.delete(rtStructures).where(eq(rtStructures.id, id));
  }

  // RT Structure Contour operations
  async createRTStructureContours(data: InsertRTStructureContour[]): Promise<void> {
    if (data.length === 0) return;
    await db.insert(rtStructureContours).values(data);
  }

  async getRTStructureContours(rtStructureId: number): Promise<RTStructureContour[]> {
    return await db
      .select()
      .from(rtStructureContours)
      .where(eq(rtStructureContours.rtStructureId, rtStructureId));
  }

  async updateRTStructureContours(rtStructureId: number, contours: InsertRTStructureContour[]): Promise<void> {
    // Delete existing contours
    await db.delete(rtStructureContours).where(eq(rtStructureContours.rtStructureId, rtStructureId));
    // Insert new contours
    if (contours.length > 0) {
      await db.insert(rtStructureContours).values(contours);
    }
  }

  async deleteRTStructureContours(rtStructureId: number, slicePositions?: number[]): Promise<void> {
    if (slicePositions && slicePositions.length > 0) {
      // Delete specific slice positions
      // Note: This would need a more complex query with OR conditions
      for (const pos of slicePositions) {
        await db
          .delete(rtStructureContours)
          .where(
            eq(rtStructureContours.rtStructureId, rtStructureId) &&
            eq(rtStructureContours.slicePosition, pos)
          );
      }
    } else {
      // Delete all contours for this structure
      await db.delete(rtStructureContours).where(eq(rtStructureContours.rtStructureId, rtStructureId));
    }
  }

  // RT Structure History operations
  async createRTStructureHistory(data: InsertRTStructureHistory): Promise<RTStructureHistory> {
    const [result] = await db.insert(rtStructureHistory).values(data).returning();
    return result;
  }

  async getRTStructureHistory(
    rtStructureSetId: number,
    options?: {
      startDate?: Date;
      endDate?: Date;
      actionTypes?: string[];
      structureIds?: number[];
      limit?: number;
      offset?: number;
    }
  ): Promise<RTStructureHistory[]> {
    let query = db
      .select()
      .from(rtStructureHistory)
      .where(eq(rtStructureHistory.rtStructureSetId, rtStructureSetId))
      .orderBy(desc(rtStructureHistory.timestamp));

    // TODO: Add filtering by date range, action types, and structure IDs
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  async getRTStructureHistorySnapshot(historyId: number): Promise<RTStructureHistory | null> {
    const [result] = await db
      .select()
      .from(rtStructureHistory)
      .where(eq(rtStructureHistory.id, historyId));
    return result || null;
  }

  // Save RT structure set with all structures and contours to database
  async saveRTStructureSet(seriesId: number, structureSetData: any, actionType: string, actionDetails: any): Promise<void> {
    console.log(`💾 Saving RT structure set for series ${seriesId}...`);
    
    // Get or create RT structure set record
    let rtStructureSet = await this.getRTStructureSetBySeriesId(seriesId);
    
    if (!rtStructureSet) {
      // Create new RT structure set record
      const seriesData = await this.getSeriesById(seriesId);
      if (!seriesData) throw new Error(`Series ${seriesId} not found`);
      
      rtStructureSet = await this.createRTStructureSet({
        seriesId,
        studyId: seriesData.studyId,
        referencedSeriesId: structureSetData.referencedSeriesId || null,
        frameOfReferenceUID: structureSetData.frameOfReferenceUID || null,
        structureSetLabel: structureSetData.structureSetLabel || 'RT Structure Set',
        structureSetDate: structureSetData.structureSetDate || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      });
    } else {
      // Update existing RT structure set
      await this.updateRTStructureSet(rtStructureSet.id, {
        updatedAt: new Date()
      });
    }

    // Delete all existing structures and contours for this set
    const existingStructures = await this.getRTStructuresBySetId(rtStructureSet.id);
    console.log(`🗑️ Deleting ${existingStructures.length} existing structures before save`);
    for (const structure of existingStructures) {
      await this.deleteRTStructure(structure.id);
    }

    // Deduplicate incoming structures by ROI number (keep first occurrence)
    const seenRoiNumbers = new Set<number>();
    const deduplicatedStructures = (structureSetData.structures || []).filter((s: any) => {
      if (seenRoiNumbers.has(s.roiNumber)) {
        console.warn(`⚠️ Skipping duplicate structure with ROI number ${s.roiNumber} (${s.structureName})`);
        return false;
      }
      seenRoiNumbers.add(s.roiNumber);
      return true;
    });
    
    if (deduplicatedStructures.length !== structureSetData.structures?.length) {
      console.warn(`⚠️ Removed ${(structureSetData.structures?.length || 0) - deduplicatedStructures.length} duplicate structures from save data`);
    }

    // Save each structure with its contours
    for (const structure of deduplicatedStructures) {
      const rtStructure = await this.createRTStructure({
        rtStructureSetId: rtStructureSet.id,
        roiNumber: structure.roiNumber,
        structureName: structure.structureName,
        color: structure.color,
        isVisible: structure.isVisible !== undefined ? structure.isVisible : true,
      });

      // Save contours for this structure
      if (structure.contours && structure.contours.length > 0) {
        const contourData = structure.contours.map((contour: any) => ({
          rtStructureId: rtStructure.id,
          slicePosition: contour.slicePosition,
          points: contour.points,
          isPredicted: contour.isPredicted || false,
          predictionConfidence: contour.predictionConfidence || null,
        }));
        
        await this.createRTStructureContours(contourData);
      }
    }

    // Create history entry with snapshot
    await this.createRTStructureHistory({
      rtStructureSetId: rtStructureSet.id,
      userId: null,
      actionType,
      actionDetails: JSON.stringify(actionDetails),
      affectedStructureIds: structureSetData.structures.map((s: any) => s.roiNumber),
      snapshot: JSON.stringify(structureSetData),
    });

    console.log(`✅ Saved RT structure set with ${deduplicatedStructures.length} structures`);
  }

  // Duplicate RT structure set to create a new version
  async duplicateRTStructureSet(seriesId: number, newLabel: string): Promise<{ newSeriesId: number; rtStructureSet: RTStructureSet }> {
    console.log(`📋 Duplicating RT structure set from series ${seriesId}...`);
    
    // Get the original RT structure set
    const originalRTSet = await this.getRTStructureSetBySeriesId(seriesId);
    if (!originalRTSet) {
      throw new Error(`RT structure set not found for series ${seriesId}`);
    }

    // Get the original series to copy metadata
    const originalSeries = await this.getSeriesById(seriesId);
    if (!originalSeries) {
      throw new Error(`Series ${seriesId} not found`);
    }

    // Create a new series for the duplicated RT structure set
    const newSeries = await this.createSeries({
      studyId: originalSeries.studyId,
      seriesInstanceUID: `${originalSeries.seriesInstanceUID}.${Date.now()}`,
      seriesNumber: originalSeries.seriesNumber + 1,
      seriesDescription: newLabel,
      modality: 'RTSTRUCT',
      imageCount: 1,
      sliceThickness: null,
      metadata: originalSeries.metadata
    });

    // Create new RT structure set record
    const newRTSet = await this.createRTStructureSet({
      seriesId: newSeries.id,
      studyId: originalRTSet.studyId,
      referencedSeriesId: originalRTSet.referencedSeriesId,
      frameOfReferenceUID: originalRTSet.frameOfReferenceUID,
      structureSetLabel: newLabel,
      structureSetDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    });

    // Copy all structures
    const originalStructures = await this.getRTStructuresBySetId(originalRTSet.id);
    
    for (const originalStructure of originalStructures) {
      // Create new structure
      const newStructure = await this.createRTStructure({
        rtStructureSetId: newRTSet.id,
        roiNumber: originalStructure.roiNumber,
        structureName: originalStructure.structureName,
        color: originalStructure.color,
        isVisible: originalStructure.isVisible,
      });

      // Copy contours
      const originalContours = await this.getRTStructureContours(originalStructure.id);
      if (originalContours.length > 0) {
        const newContours = originalContours.map(contour => ({
          rtStructureId: newStructure.id,
          slicePosition: contour.slicePosition,
          points: contour.points,
          isPredicted: contour.isPredicted,
          predictionConfidence: contour.predictionConfidence,
        }));
        
        await this.createRTStructureContours(newContours);
      }
    }

    // Create history entry for the duplication
    await this.createRTStructureHistory({
      rtStructureSetId: newRTSet.id,
      userId: null,
      actionType: 'duplicate',
      actionDetails: JSON.stringify({ originalSeriesId: seriesId, newLabel }),
      affectedStructureIds: originalStructures.map(s => s.roiNumber),
      snapshot: JSON.stringify({ 
        structures: originalStructures.map(s => ({ 
          roiNumber: s.roiNumber, 
          structureName: s.structureName 
        })) 
      }),
    });

    console.log(`✅ Created duplicate RT structure set: series ${newSeries.id}`);
    
    return { newSeriesId: newSeries.id, rtStructureSet: newRTSet };
  }

  // Restore RT structure set from a history snapshot
  async restoreFromHistory(seriesId: number, historyId: number): Promise<void> {
    console.log(`⏮️ Restoring RT structure set from history ${historyId}...`);
    
    // Get the history snapshot
    const historySnapshot = await this.getRTStructureHistorySnapshot(historyId);
    if (!historySnapshot) {
      throw new Error(`History snapshot ${historyId} not found`);
    }

    if (!historySnapshot.snapshot) {
      throw new Error(`History snapshot ${historyId} has no data`);
    }

    // Parse the snapshot
    const snapshotData = JSON.parse(historySnapshot.snapshot);
    
    // Save the restored data (this will also create a new history entry)
    await this.saveRTStructureSet(
      seriesId, 
      snapshotData, 
      'restore', 
      { restoredFromHistoryId: historyId, restoredFromTimestamp: historySnapshot.timestamp }
    );

    console.log(`✅ Restored RT structure set from history ${historyId}`);
  }

  // ============================================================================
  // SUPERSTRUCTURE METHODS - Boolean operation lineage and auto-updates
  // ============================================================================

  async getSuperstructuresForStructureSet(rtSeriesId: number) {
    return await db
      .select()
      .from(rtSuperstructures)
      .where(eq(rtSuperstructures.rtSeriesId, rtSeriesId))
      .orderBy(rtSuperstructures.createdAt);
  }

  async createSuperstructure(data: {
    rtStructureRoiNumber: number;
    rtSeriesId: number;
    sourceStructureRoiNumbers: number[];
    sourceStructureNames: string[];
    operationExpression: string;
    operationType: string;
    autoUpdate?: boolean;
  }) {
    const [superstructure] = await db
      .insert(rtSuperstructures)
      .values({
        rtStructureRoiNumber: data.rtStructureRoiNumber,
        rtSeriesId: data.rtSeriesId,
        sourceStructureRoiNumbers: data.sourceStructureRoiNumbers,
        sourceStructureNames: data.sourceStructureNames,
        operationExpression: data.operationExpression,
        operationType: data.operationType,
        autoUpdate: data.autoUpdate ?? true,
      })
      .returning();
    
    return superstructure;
  }

  async getSuperstructureById(id: number) {
    const [superstructure] = await db
      .select()
      .from(rtSuperstructures)
      .where(eq(rtSuperstructures.id, id));
    
    return superstructure || null;
  }

  async updateSuperstructureAutoUpdate(id: number, autoUpdate: boolean) {
    await db
      .update(rtSuperstructures)
      .set({ autoUpdate })
      .where(eq(rtSuperstructures.id, id));
  }

  async deleteSuperstructure(id: number) {
    await db
      .delete(rtSuperstructures)
      .where(eq(rtSuperstructures.id, id));
  }

  async regenerateSuperstructure(superstructureId: number) {
    // This method is a placeholder - actual regeneration logic should be handled
    // by the client-side boolean operation engine and then saved back
    // Here we just update the lastUpdated timestamp
    await db
      .update(rtSuperstructures)
      .set({ lastUpdated: new Date() })
      .where(eq(rtSuperstructures.id, superstructureId));
  }

  async checkAndRegenerateSuperstructures(rtSeriesId: number, modifiedStructureIds: number[]): Promise<number[]> {
    // Get all auto-update enabled superstructures for this RT series
    const superstructures = await db
      .select()
      .from(rtSuperstructures)
      .where(
        and(
          eq(rtSuperstructures.rtSeriesId, rtSeriesId),
          eq(rtSuperstructures.autoUpdate, true)
        )
      );

    // Find superstructures that depend on the modified structures (using ROI numbers)
    const toRegenerate = superstructures.filter(s => 
      s.sourceStructureRoiNumbers.some((roiNum: number) => modifiedStructureIds.includes(roiNum))
    );

    // Update timestamps for these superstructures
    // (Actual regeneration will be triggered client-side)
    const regeneratedIds: number[] = [];
    for (const superstructure of toRegenerate) {
      await this.regenerateSuperstructure(superstructure.id);
      regeneratedIds.push(superstructure.id);
    }

    return regeneratedIds;
  }

  // ============================================================================
  // DVH Cache Operations - Persistent storage for pre-computed DVH data
  // ============================================================================

  /**
   * Get cached DVH data by dose series, structure set series, and prescription dose
   */
  async getDvhCache(doseSeriesId: number, structureSetSeriesId: number, prescriptionDose: number): Promise<DvhCache | null> {
    const [cached] = await db
      .select()
      .from(dvhCache)
      .where(
        and(
          eq(dvhCache.doseSeriesId, doseSeriesId),
          eq(dvhCache.structureSetSeriesId, structureSetSeriesId),
          eq(dvhCache.prescriptionDose, prescriptionDose)
        )
      );
    return cached || null;
  }

  /**
   * Get all cached DVH entries for a dose series (any prescription dose)
   */
  async getDvhCacheByDoseSeries(doseSeriesId: number): Promise<DvhCache[]> {
    return db
      .select()
      .from(dvhCache)
      .where(eq(dvhCache.doseSeriesId, doseSeriesId));
  }

  /**
   * Store DVH data in the cache (upsert - update if exists)
   */
  async saveDvhCache(data: InsertDvhCache): Promise<DvhCache> {
    // Check if entry already exists
    const existing = await this.getDvhCache(
      data.doseSeriesId,
      data.structureSetSeriesId,
      data.prescriptionDose
    );

    if (existing) {
      // Update existing entry
      const [updated] = await db
        .update(dvhCache)
        .set({
          dvhData: data.dvhData,
          computationTimeMs: data.computationTimeMs,
          structureCount: data.structureCount,
          updatedAt: new Date(),
        })
        .where(eq(dvhCache.id, existing.id))
        .returning();
      return updated;
    }

    // Insert new entry
    const [inserted] = await db
      .insert(dvhCache)
      .values({
        doseSeriesId: data.doseSeriesId,
        structureSetSeriesId: data.structureSetSeriesId,
        prescriptionDose: data.prescriptionDose,
        dvhData: data.dvhData,
        computationTimeMs: data.computationTimeMs,
        structureCount: data.structureCount,
      })
      .returning();
    return inserted;
  }

  /**
   * Invalidate DVH cache for a structure set (when structures are modified)
   */
  async invalidateDvhCacheByStructureSet(structureSetSeriesId: number): Promise<number> {
    const result = await db
      .delete(dvhCache)
      .where(eq(dvhCache.structureSetSeriesId, structureSetSeriesId))
      .returning();
    return result.length;
  }

  /**
   * Invalidate DVH cache for a dose series (when dose data changes)
   */
  async invalidateDvhCacheByDoseSeries(doseSeriesId: number): Promise<number> {
    const result = await db
      .delete(dvhCache)
      .where(eq(dvhCache.doseSeriesId, doseSeriesId))
      .returning();
    return result.length;
  }

  /**
   * Delete specific DVH cache entry
   */
  async deleteDvhCache(id: number): Promise<void> {
    await db
      .delete(dvhCache)
      .where(eq(dvhCache.id, id));
  }

  clearAll(): void {
    // This would be implemented as database truncation
    throw new Error('Database clearAll not implemented - use proper migration tools');
  }
}

export const storage = new DatabaseStorage();
