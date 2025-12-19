import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import dicomParser from 'dicom-parser';
import { storage } from '../storage.ts';

export type FuseboxTransformSource = 'matrix' | 'helper-generated' | 'helper-cache' | 'helper-regenerated' | 'matrix-fallback' | 'matrix-validated';

export type FuseboxTransformInfo = {
  matrix?: number[];
  filePath?: string;
  transformFile?: string;
  transformSource?: FuseboxTransformSource;
  registrationId?: string;
};

export type FuseboxLogLevel = 'debug' | 'info' | 'warn';
export type FuseboxLogEmitter = (level: FuseboxLogLevel, message: string, data: Record<string, unknown>) => void;

const defaultEmit: FuseboxLogEmitter = (level, message, data) => {
  const payload = JSON.stringify({ level, message, ...data });
  if (level === 'warn') {
    console.warn(payload);
  } else if (level === 'info') {
    console.info(payload);
  } else {
    console.debug(payload);
  }
};

export const fuseboxHelperMetrics = {
  attempts: 0,
  cacheHits: 0,
  conversions: 0,
  failures: 0,
  disabled: 0,
};

let resolvedFuseboxPython: string | null = null;
const fuseboxPythonFailureLogged = new Set<string>();
let fuseboxPythonFallbackLogged = false;

const createFuseboxError = (code: string, message: string, context: Record<string, unknown>) => {
  const error = new Error(message);
  (error as any).code = code;
  (error as any).context = context;
  return error;
};

function logHelper(emit: FuseboxLogEmitter, level: FuseboxLogLevel, message: string, data: Record<string, unknown>) {
  (emit || defaultEmit)(level, message, data);
}

export const parseMinimalDicomMeta = (filePath: string): {
  frameOfReference?: string | null;
  imageOrientation?: number[];
  imagePosition?: number[];
  pixelSpacing?: number[];
  rows?: number;
  cols?: number;
} | null => {
  try {
    const bytes = fs.readFileSync(filePath);
    const data = (dicomParser as any).parseDicom(new Uint8Array(bytes));
    const arr = (tag: string): number[] => {
      try {
        const value = data.string?.(tag);
        return value ? value.split('\\').map(Number).filter(v => Number.isFinite(v)) : [];
      } catch {
        return [];
      }
    };
    const str = (tag: string): string | null => {
      try {
        const value = data.string?.(tag);
        return value ? String(value).trim() : null;
      } catch {
        return null;
      }
    };
    const u16 = (tag: string): number | undefined => {
      try {
        const value = data.uint16?.(tag);
        return Number.isFinite(value) ? Number(value) : undefined;
      } catch {
        return undefined;
      }
    };
    return {
      frameOfReference: str('x00200052'),
      imageOrientation: arr('x00200037'),
      imagePosition: arr('x00200032'),
      pixelSpacing: arr('x00280030'),
      rows: u16('x00280010'),
      cols: u16('x00280011'),
    };
  } catch {
    return null;
  }
};

export function sortImagesByInstance(imagesList: any[]): any[] {
  return imagesList
    .slice()
    .sort((a, b) => {
      const ai = Number((a.instanceNumber ?? a.metadata?.instanceNumber ?? 0) as number);
      const bi = Number((b.instanceNumber ?? b.metadata?.instanceNumber ?? 0) as number);
      if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
      return String(a.fileName || a.sopInstanceUID || '').localeCompare(String(b.fileName || b.sopInstanceUID || ''));
    });
}

export const resolveFuseboxPython = (emit?: FuseboxLogEmitter): string => {
  if (resolvedFuseboxPython) return resolvedFuseboxPython;
  const emitter = emit || defaultEmit;

  const candidateList = [
    process.env.FUSEBOX_PYTHON,
    process.env.SIMPLEITK_PYTHON,
    process.env.PYTHON,
    path.join(process.cwd(), 'sam_env', 'bin', 'python'),
    'python3',
    'python',
  ]
    .filter((candidate): candidate is string => !!candidate)
    .filter((candidate, index, arr) => arr.indexOf(candidate) === index);

  for (const candidate of candidateList) {
    try {
      const check = spawnSync(candidate, ['-c', 'import numpy; import SimpleITK'], { encoding: 'utf-8' });
      if (check.status === 0) {
        resolvedFuseboxPython = candidate;
        logHelper(emitter, 'info', 'Resolved Fusebox python interpreter', { candidate });
        return candidate;
      }
      if (!fuseboxPythonFailureLogged.has(candidate)) {
        fuseboxPythonFailureLogged.add(candidate);
        logHelper(emitter, 'warn', 'Fusebox python candidate missing numpy/SimpleITK', {
          candidate,
          status: check.status,
          stderr: check.stderr,
        });
      }
    } catch (err: any) {
      if (!fuseboxPythonFailureLogged.has(candidate)) {
        fuseboxPythonFailureLogged.add(candidate);
        logHelper(emitter, 'warn', 'Fusebox python candidate unavailable', {
          candidate,
          err: err?.message || err,
        });
      }
    }
  }

  const fallback = candidateList[0] || 'python3';
  resolvedFuseboxPython = fallback;
  if (!fuseboxPythonFallbackLogged) {
    fuseboxPythonFallbackLogged = true;
    logHelper(emitter, 'warn', 'Falling back to default Fusebox python without dependency validation', {
      fallback,
      candidates: candidateList,
    });
  }
  return fallback;
};

const maybeAttachHelperOutput = async (
  info: FuseboxTransformInfo | null,
  regPath: string | undefined,
  candidateId: string | undefined,
  primaryFoR: string | null,
  secondaryFoR: string | null,
  emit: FuseboxLogEmitter,
  primarySeriesId: number,
  secondarySeriesId: number,
): Promise<FuseboxTransformInfo | null> => {
  if (!info || info.transformFile || !regPath) return info;

  const regFileName = path.basename(regPath);
  const problematicRegFiles: string[] = [];
  if (problematicRegFiles.includes(regFileName)) {
    logHelper(emit, 'info', 'Skipping helper for pathological REG file, using matrix-only', {
      primarySeriesId,
      secondarySeriesId,
      regFile: regFileName,
      candidateId,
    });
    info.transformSource = 'matrix-validated';
    return info;
  }

  const helper = process.env.DICOM_REG_CONVERTER;
  if (!helper) {
    fuseboxHelperMetrics.disabled += 1;
    logHelper(emit, 'warn', 'Fusebox helper not configured; using matrix transform', {
      primarySeriesId,
      secondarySeriesId,
      regFile: regPath,
      candidateId,
    });
    return {
      ...info,
      transformSource: info.transformSource ?? 'matrix-fallback',
    };
  }
  if (!primaryFoR || !secondaryFoR) {
    throw createFuseboxError('FUSEBOX_MISSING_FOR', 'Frame of Reference UID missing for helper conversion', {
      primarySeriesId,
      secondarySeriesId,
      primaryFoR,
      secondaryFoR,
    });
  }

  fuseboxHelperMetrics.attempts += 1;
  const cacheDir = path.join(process.cwd(), 'tmp', 'fusebox-transforms');
  await fs.promises.mkdir(cacheDir, { recursive: true });
  const cacheKey = `${primarySeriesId}_${secondarySeriesId}_${primaryFoR}_${secondaryFoR}`;
  const cachePath = path.join(cacheDir, `${cacheKey}.h5`);

  if (fs.existsSync(cachePath)) {
    fuseboxHelperMetrics.cacheHits += 1;
    logHelper(emit, 'info', 'Using cached fusebox helper transform', {
      primarySeriesId,
      secondarySeriesId,
      cachePath,
    });
    return {
      ...info,
      transformFile: cachePath,
      transformSource: 'helper-cache',
    };
  }

  return await new Promise<FuseboxTransformInfo | null>((resolve) => {
    let stdout = '';
    let stderr = '';
    const fallback = () => {
      fuseboxHelperMetrics.failures += 1;
      if (info) {
        logHelper(emit, 'warn', 'Fusebox helper failed; falling back to matrix transform', {
          primarySeriesId,
          secondarySeriesId,
          regFile: regPath,
          candidateId,
          stdout,
          stderr,
        });
        resolve({
          ...info,
          transformSource: info.transformSource ?? 'matrix-fallback',
        });
      } else {
        resolve(null);
      }
    };

    const args = ['--input', regPath, '--output', cachePath];
    if (primaryFoR) args.push('--fixed', primaryFoR);
    if (secondaryFoR) args.push('--moving', secondaryFoR);
    const child = spawn(helper, args, {
      cwd: process.cwd(),
      env: process.env,
    });
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', () => fallback());
    child.on('close', (code) => {
      if (code !== 0 || !fs.existsSync(cachePath)) {
        fallback();
        return;
      }
      fuseboxHelperMetrics.conversions += 1;
      logHelper(emit, 'info', 'Fusebox helper produced transform', {
        primarySeriesId,
        secondarySeriesId,
        cachePath,
      });
      resolve({
        ...info,
        transformFile: cachePath,
        transformSource: 'helper-generated',
      });
    });
  });
};

export const collectSeriesFiles = async (seriesId: number): Promise<string[]> => {
  const images = await storage.getImagesBySeriesId(seriesId);
  if (!images?.length) return [];
  const ordered = sortImagesByInstance(images);
  return ordered
    .map((img: any) => (img.filePath ? path.resolve(img.filePath) : null))
    .filter((p): p is string => !!p && fs.existsSync(p));
};

export async function resolveFuseboxTransform(
  primarySeriesId: number,
  secondarySeriesId: number,
  registrationId?: string,
  emit?: FuseboxLogEmitter,
): Promise<FuseboxTransformInfo | null> {
  const logger = emit || defaultEmit;
  const primarySeries = await storage.getSeriesById(primarySeriesId);
  const secondarySeries = await storage.getSeriesById(secondarySeriesId);
  if (!primarySeries || !secondarySeries) return null;

  const [primaryImages, secondaryImages] = await Promise.all([
    storage.getImagesBySeriesId(primarySeriesId),
    storage.getImagesBySeriesId(secondarySeriesId),
  ]);
  if (!primaryImages?.length || !secondaryImages?.length) return null;

  const primaryMeta = primaryImages[0]?.filePath ? parseMinimalDicomMeta(primaryImages[0].filePath) : null;
  const secondaryMeta = secondaryImages[0]?.filePath ? parseMinimalDicomMeta(secondaryImages[0].filePath) : null;
  const primaryFoR = primaryMeta?.frameOfReference || null;
  const secondaryFoR = secondaryMeta?.frameOfReference || null;
  
  // Get Series Instance UIDs for direction detection
  const primarySeriesUID = (primarySeries as any).seriesInstanceUID || null;
  const secondarySeriesUID = (secondarySeries as any).seriesInstanceUID || null;

  // Check for registration files FIRST before using identity transform
  // This is important for CT-CT fusion where both scans may share the same FoR
  // but require a transformation matrix from the registration file
  const { parseDicomRegistrationFromFile } = await import('../registration/reg-parser.ts');
  const { findRegFileForStudy, findAllRegFilesForPatient } = await import('../registration/reg-resolver.ts');

  const study = await storage.getStudy(primarySeries.studyId);
  const patientDbId = study?.patientId ?? null;
  const patientDicomId = study?.patientID || (await (async () => {
    if (!study?.patientId) return null;
    const patient = await storage.getPatient(study.patientId);
    return patient?.patientID ?? null;
  })());

  const candidates: Array<{ 
    regFile: string; 
    studyId: number; 
    matrix?: number[]; 
    transformSource?: FuseboxTransformSource; 
    registrationId?: string;
    sourceFoR?: string;
    targetFoR?: string;
    wasInverted?: boolean;
  }> = [];

  const regFiles = patientDbId != null
    ? await findAllRegFilesForPatient(patientDbId)
    : (await (async () => {
        const resolved = await findRegFileForStudy(primarySeries.studyId);
        return resolved ? [resolved] : [];
      })());

  // Helper to invert a 4x4 rigid transformation matrix (rotation + translation)
  const invertMatrix4x4 = (mat: number[]): number[] => {
    // For rigid transforms: M^-1 = [R^T | -R^T * t]
    const R = [
      [mat[0], mat[1], mat[2]],
      [mat[4], mat[5], mat[6]],
      [mat[8], mat[9], mat[10]]
    ];
    const Rt = [
      [R[0][0], R[1][0], R[2][0]],
      [R[0][1], R[1][1], R[2][1]],
      [R[0][2], R[1][2], R[2][2]]
    ];
    const t = [mat[3], mat[7], mat[11]];
    const tin = [
      -(Rt[0][0]*t[0] + Rt[0][1]*t[1] + Rt[0][2]*t[2]),
      -(Rt[1][0]*t[0] + Rt[1][1]*t[1] + Rt[1][2]*t[2]),
      -(Rt[2][0]*t[0] + Rt[2][1]*t[1] + Rt[2][2]*t[2])
    ];
    return [
      Rt[0][0], Rt[0][1], Rt[0][2], tin[0],
      Rt[1][0], Rt[1][1], Rt[1][2], tin[1],
      Rt[2][0], Rt[2][1], Rt[2][2], tin[2],
      0, 0, 0, 1
    ];
  };

  for (const reg of regFiles) {
    const parsed = parseDicomRegistrationFromFile(reg.filePath);
    if (!parsed) continue;

    // Determine direction from REG file metadata
    // The REG file specifies target series UID (fixed volume) and source series UIDs (moving volume)
    // Matrix transforms FROM source TO target coordinate systems
    // For fusion: we need secondary → primary (moving → fixed)
    // So if secondary matches source and primary matches target, use matrix as-is
    // If reversed, invert the matrix
    
    // Get FoR info from the REG file
    const targetFoRFromReg = parsed.targetFrameOfReferenceUid;
    const sourceFoRFromReg = parsed.sourceFrameOfReferenceUid;
    
    // Determine which of our series is the registration "target" (fixed reference)
    // by matching the FoR from the REG file to our series' FoRs
    let regTargetSeriesUID: string | null = null;
    let regSourceSeriesUID: string | null = null;
    
    // Match based on Frame of Reference
    // The registration's target FoR should match the "fixed" volume
    if (targetFoRFromReg && primaryFoR && secondaryFoR) {
      if (targetFoRFromReg === primaryFoR) {
        // Primary's FoR matches the REG's target → Primary is the fixed/target
        regTargetSeriesUID = primarySeriesUID;
        regSourceSeriesUID = secondarySeriesUID;
      } else if (targetFoRFromReg === secondaryFoR) {
        // Secondary's FoR matches the REG's target → Secondary is the fixed/target
        regTargetSeriesUID = secondarySeriesUID;
        regSourceSeriesUID = primarySeriesUID;
      }
    }
    
    // Log the direction detection for debugging
    if (regTargetSeriesUID && regSourceSeriesUID) {
      logHelper(logger, 'debug', 'Registration direction determined from FoR match', {
        primarySeriesId,
        secondarySeriesId,
        regTargetSeriesUID,
        regSourceSeriesUID,
        targetFoRFromReg,
        primaryFoR,
        secondaryFoR,
      });
    }

    // Process candidates with direction information
    if (parsed.candidates?.length) {
      parsed.candidates.forEach((candidate, index) => {
        if (candidate.matrix?.length === 16) {
          let finalMatrix = candidate.matrix.slice();
          let wasInverted = false;
          
          // Try FoR-based direction detection first (if FoRs are different)
          if (candidate.sourceFoR && candidate.targetFoR && candidate.sourceFoR !== candidate.targetFoR && primaryFoR && secondaryFoR) {
            const matrixGoesSecondaryToPrimary = 
              candidate.sourceFoR === secondaryFoR && candidate.targetFoR === primaryFoR;
            const matrixGoesPrimaryToSecondary = 
              candidate.sourceFoR === primaryFoR && candidate.targetFoR === secondaryFoR;
            
            if (matrixGoesSecondaryToPrimary) {
              finalMatrix = candidate.matrix.slice();
            } else if (matrixGoesPrimaryToSecondary) {
              finalMatrix = invertMatrix4x4(candidate.matrix);
              wasInverted = true;
            }
          }
          // If FoRs are same (common in CT-CT fusion), use series UID direction
          else if (regTargetSeriesUID && regSourceSeriesUID && primarySeriesUID && secondarySeriesUID) {
            // Matrix transforms FROM source TO target
            // We want: secondary → primary
            const matrixGoesSecondaryToPrimary = 
              regSourceSeriesUID === secondarySeriesUID && regTargetSeriesUID === primarySeriesUID;
            const matrixGoesPrimaryToSecondary = 
              regSourceSeriesUID === primarySeriesUID && regTargetSeriesUID === secondarySeriesUID;
            
            if (matrixGoesSecondaryToPrimary) {
              finalMatrix = candidate.matrix.slice();
            } else if (matrixGoesPrimaryToSecondary) {
              finalMatrix = invertMatrix4x4(candidate.matrix);
              wasInverted = true;
            }
          }
          
          candidates.push({
            regFile: reg.filePath,
            studyId: reg.studyId,
            matrix: finalMatrix,
            transformSource: 'matrix',
            registrationId: `${path.basename(reg.filePath)}#${index}${wasInverted ? '-inv' : ''}`,
            sourceFoR: candidate.sourceFoR,
            targetFoR: candidate.targetFoR,
            wasInverted,
          });
        }
      });
    }
    
    // Fallback: use top-level matrix if no candidates (legacy format)
    if (!parsed.candidates?.length && parsed.matrixRowMajor4x4) {
      let finalMatrix = parsed.matrixRowMajor4x4.slice();
      let wasInverted = false;
      
      // Try FoR-based direction first
      if (parsed.sourceFrameOfReferenceUid && parsed.targetFrameOfReferenceUid && 
          parsed.sourceFrameOfReferenceUid !== parsed.targetFrameOfReferenceUid && 
          primaryFoR && secondaryFoR) {
        const matrixGoesPrimaryToSecondary = 
          parsed.sourceFrameOfReferenceUid === primaryFoR && parsed.targetFrameOfReferenceUid === secondaryFoR;
        
        if (matrixGoesPrimaryToSecondary) {
          finalMatrix = invertMatrix4x4(parsed.matrixRowMajor4x4);
          wasInverted = true;
        }
      }
      // Fallback to series UID direction
      else if (regTargetSeriesUID && regSourceSeriesUID && primarySeriesUID && secondarySeriesUID) {
        const matrixGoesPrimaryToSecondary = 
          regSourceSeriesUID === primarySeriesUID && regTargetSeriesUID === secondarySeriesUID;
        
        if (matrixGoesPrimaryToSecondary) {
          finalMatrix = invertMatrix4x4(parsed.matrixRowMajor4x4);
          wasInverted = true;
        }
      }
      
      candidates.push({
        regFile: reg.filePath,
        studyId: reg.studyId,
        matrix: finalMatrix,
        transformSource: 'matrix',
        wasInverted,
      });
    }
  }

  // Helper to check if a matrix is identity (or near-identity)
  const isIdentityMatrix = (matrix: number[] | undefined): boolean => {
    if (!matrix || matrix.length !== 16) return false;
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const tolerance = 0.001;
    return matrix.every((val, idx) => Math.abs(val - identity[idx]) < tolerance);
  };

  // Sort candidates to prefer non-identity matrices (actual registration transforms)
  // This is crucial for CT-CT fusion where both identity and registration matrices may exist
  const sortedCandidates = [...candidates].sort((a, b) => {
    const aIsIdentity = isIdentityMatrix(a.matrix);
    const bIsIdentity = isIdentityMatrix(b.matrix);
    if (aIsIdentity && !bIsIdentity) return 1;  // Non-identity first
    if (!aIsIdentity && bIsIdentity) return -1;
    return 0;
  });

  // Log candidate matrix selection for debugging
  if (sortedCandidates.length > 0) {
    logHelper(logger, 'info', 'Registration matrix candidates found', {
      primarySeriesId,
      secondarySeriesId,
      primarySeriesUID,
      secondarySeriesUID,
      primaryFoR,
      secondaryFoR,
      totalCandidates: sortedCandidates.length,
      selectedIsIdentity: isIdentityMatrix(sortedCandidates[0]?.matrix),
      selectedWasInverted: sortedCandidates[0]?.wasInverted,
      selectedTranslation: sortedCandidates[0]?.matrix ? [
        sortedCandidates[0].matrix[3],  // tx
        sortedCandidates[0].matrix[7],  // ty
        sortedCandidates[0].matrix[11], // tz
      ] : null,
    });
  }

  let fallbackMatrix: FuseboxTransformInfo | null = null;
  let helperError: Error | null = null;

  for (const cand of sortedCandidates) {
    const candidateId = cand.registrationId || `matrix-${path.basename(cand.regFile)}`;
    if (registrationId && registrationId !== candidateId) continue;
    const info: FuseboxTransformInfo = {
      matrix: cand.matrix ? cand.matrix.slice() : undefined,
      filePath: cand.regFile,
      transformSource: cand.transformSource,
      registrationId: candidateId,
    };
    try {
      const maybe = await maybeAttachHelperOutput(info, cand.regFile, candidateId, primaryFoR, secondaryFoR, logger, primarySeriesId, secondarySeriesId);
      if (maybe?.transformFile) return maybe;
      if (!fallbackMatrix) fallbackMatrix = maybe ?? info;
      else if (maybe && maybe.transformSource === 'matrix-validated') fallbackMatrix = maybe;
    } catch (err: any) {
      helperError = err;
    }
  }

  if (fallbackMatrix && (fallbackMatrix.transformFile || fallbackMatrix.transformSource === 'matrix-validated')) {
    return fallbackMatrix;
  }

  // If we have any registration matrix at all (even without helper validation), use it
  // Prefer non-identity matrices from registration files
  if (sortedCandidates.length > 0) {
    const bestCandidate = sortedCandidates[0]; // Already sorted with non-identity first
    logHelper(logger, 'info', 'Using registration matrix from file (no helper validation)', {
      primarySeriesId,
      secondarySeriesId,
      registrationId: bestCandidate.registrationId,
      isIdentity: isIdentityMatrix(bestCandidate.matrix),
    });
    return {
      matrix: bestCandidate.matrix?.slice(),
      filePath: bestCandidate.regFile,
      transformSource: 'matrix',
      registrationId: bestCandidate.registrationId,
    };
  }

  // Only use identity transform as last resort when:
  // 1. No registration files found
  // 2. Frame of Reference UIDs match
  if (primaryFoR && secondaryFoR && primaryFoR === secondaryFoR) {
    logHelper(logger, 'info', 'No registration file found - using identity transform for matching Frame of Reference', {
      primarySeriesId,
      secondarySeriesId,
      frameOfReferenceUID: primaryFoR,
    });
    return {
      matrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
      transformSource: 'matrix',
      registrationId: 'identity-frame-of-reference',
    };
  }

  if (helperError) throw helperError;

  throw createFuseboxError('FUSEBOX_NO_TRANSFORM', 'No registration transform produced a helper output', {
    primarySeriesId,
    secondarySeriesId,
  });
}

export async function runFuseboxResample(config: Record<string, any>, emit?: FuseboxLogEmitter): Promise<any> {
  const python = resolveFuseboxPython(emit);
  const scriptPath = path.resolve('scripts', 'fusebox_resample.py');
  const tmpBase = path.join(process.cwd(), 'tmp');
  await fs.promises.mkdir(tmpBase, { recursive: true });
  const tmpDir = await fs.promises.mkdtemp(path.join(tmpBase, 'fusebox-'));
  const configPath = path.join(tmpDir, 'config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(config), 'utf-8');

  return new Promise((resolve) => {
    const child = spawn(python, [scriptPath, '--config', configPath], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', async (code) => {
      try { await fs.promises.rm(tmpDir, { recursive: true, force: true }); } catch {}
      if (code !== 0) {
        resolve({ error: stderr.trim() || stdout.trim() || `fusebox exited with code ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (err) {
        resolve({ error: `Failed to parse fusebox output: ${(err as Error).message}` });
      }
    });
  });
}

export async function runFuseboxInspectTransform(transformPath: string, emit?: FuseboxLogEmitter): Promise<any> {
  const python = resolveFuseboxPython(emit);
  const scriptPath = path.resolve('scripts', 'fusebox_inspect_transform.py');

  return new Promise((resolve) => {
    const child = spawn(python, [scriptPath, transformPath], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: stderr.trim() || stdout.trim() || `inspect transform exited with code ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (err) {
        resolve({ ok: false, error: `Failed to parse inspect output: ${(err as Error).message}` });
      }
    });
  });
}
