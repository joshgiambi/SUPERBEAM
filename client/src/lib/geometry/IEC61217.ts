/**
 * IEC 61217 Coordinate System Transformations
 * 
 * Implements the standard coordinate systems for radiotherapy:
 * 
 * DICOM Patient Coordinate System:
 * - X: Patient Left (L)
 * - Y: Patient Posterior (P)
 * - Z: Patient Superior (S)
 * 
 * IEC 61217 Fixed Coordinate System:
 * - X_f: toward observer, standing at foot of treatment table
 * - Y_f: toward the gantry (away from patient head for HFS)
 * - Z_f: upward (toward ceiling)
 * 
 * IEC Gantry Coordinate System (rotates with gantry):
 * - At gantry 0°: coincides with IEC Fixed
 * - Rotates around Z_f axis
 * 
 * IEC Beam Limiting Device (BLD) Coordinate System:
 * - Further rotated by collimator angle around beam axis
 * 
 * Patient Support (Couch) Coordinate System:
 * - Rotates around Z axis (isocenter vertical)
 */

import { Vector3 } from './Vector3';
import { Matrix4 } from './Matrix4';

// Patient orientation types as per DICOM
export type PatientPosition = 'HFS' | 'HFP' | 'FFS' | 'FFP' | 'HFDR' | 'HFDL' | 'FFDR' | 'FFDL';

/**
 * Get the transformation matrix from DICOM Patient to IEC Fixed coordinates
 * 
 * This transformation depends on patient orientation on the table
 */
export function getDICOMToIECMatrix(patientPosition: PatientPosition): Matrix4 {
  const m = new Matrix4();
  
  switch (patientPosition) {
    case 'HFS': // Head First Supine (most common)
      // DICOM: +X=Left, +Y=Posterior, +Z=Superior
      // IEC:   +X=Right, +Y=Toward gantry (inferior for HFS), +Z=Up
      // So: IEC_X = -DICOM_X, IEC_Y = -DICOM_Z, IEC_Z = -DICOM_Y
      m.set(
        -1, 0, 0, 0,
        0, 0, -1, 0,
        0, -1, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    case 'HFP': // Head First Prone
      // Patient is face down
      // IEC_X = DICOM_X, IEC_Y = -DICOM_Z, IEC_Z = DICOM_Y
      m.set(
        1, 0, 0, 0,
        0, 0, -1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    case 'FFS': // Feet First Supine
      // IEC_X = DICOM_X, IEC_Y = DICOM_Z, IEC_Z = -DICOM_Y
      m.set(
        1, 0, 0, 0,
        0, 0, 1, 0,
        0, -1, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    case 'FFP': // Feet First Prone
      // IEC_X = -DICOM_X, IEC_Y = DICOM_Z, IEC_Z = DICOM_Y
      m.set(
        -1, 0, 0, 0,
        0, 0, 1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    case 'HFDR': // Head First Decubitus Right
      m.set(
        0, -1, 0, 0,
        0, 0, -1, 0,
        1, 0, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    case 'HFDL': // Head First Decubitus Left
      m.set(
        0, 1, 0, 0,
        0, 0, -1, 0,
        -1, 0, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    case 'FFDR': // Feet First Decubitus Right
      m.set(
        0, 1, 0, 0,
        0, 0, 1, 0,
        1, 0, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    case 'FFDL': // Feet First Decubitus Left
      m.set(
        0, -1, 0, 0,
        0, 0, 1, 0,
        -1, 0, 0, 0,
        0, 0, 0, 1
      );
      break;
      
    default:
      // Default to HFS
      m.set(
        -1, 0, 0, 0,
        0, 0, -1, 0,
        0, -1, 0, 0,
        0, 0, 0, 1
      );
  }
  
  return m;
}

/**
 * Get the transformation matrix from IEC Fixed to IEC Gantry coordinates
 * 
 * @param gantryAngleDeg - Gantry angle in degrees (IEC convention)
 *   0° = beam coming from ceiling (anterior for supine)
 *   90° = beam from patient's left (for HFS)
 *   180° = beam from floor (posterior for supine)
 *   270° = beam from patient's right (for HFS)
 */
export function getGantryTransformMatrix(gantryAngleDeg: number): Matrix4 {
  const m = new Matrix4();
  const rad = (gantryAngleDeg * Math.PI) / 180;
  
  // Gantry rotates around the Z axis (vertical)
  // Positive angles = clockwise when viewed from above
  m.makeRotationZ(-rad);
  
  return m;
}

/**
 * Get the transformation matrix from IEC Gantry to Beam Limiting Device (BLD) coordinates
 * 
 * @param collimatorAngleDeg - Collimator angle in degrees
 *   0° = collimator aligned with gantry
 *   Positive = clockwise when viewed from source
 */
export function getCollimatorTransformMatrix(collimatorAngleDeg: number): Matrix4 {
  const m = new Matrix4();
  const rad = (collimatorAngleDeg * Math.PI) / 180;
  
  // Collimator rotates around the beam central axis (Y in gantry coordinates)
  m.makeRotationY(-rad);
  
  return m;
}

/**
 * Get the transformation matrix for patient support (couch) rotation
 * 
 * @param couchAngleDeg - Couch angle in degrees
 *   0° = couch aligned with gantry
 *   Positive = counter-clockwise when viewed from above (IEC convention)
 */
export function getCouchTransformMatrix(couchAngleDeg: number): Matrix4 {
  const m = new Matrix4();
  const rad = (couchAngleDeg * Math.PI) / 180;
  
  // Couch rotates around the Z axis
  m.makeRotationZ(rad);
  
  return m;
}

/**
 * Calculate source position given beam geometry
 * 
 * @param isocenter - Isocenter position in DICOM patient coordinates
 * @param gantryAngleDeg - Gantry angle in degrees
 * @param couchAngleDeg - Couch (patient support) angle in degrees
 * @param sad - Source to Axis Distance in mm
 * @param patientPosition - Patient orientation
 * @returns Source position in DICOM patient coordinates
 */
export function calculateSourcePosition(
  isocenter: Vector3,
  gantryAngleDeg: number,
  couchAngleDeg: number,
  sad: number,
  patientPosition: PatientPosition = 'HFS'
): Vector3 {
  const gantryRad = (gantryAngleDeg * Math.PI) / 180;
  const couchRad = (couchAngleDeg * Math.PI) / 180;
  
  // In IEC coordinates, at gantry 0, source is at (0, -SAD, 0)
  // relative to isocenter (beam coming from +Y direction toward -Y)
  
  // Apply gantry rotation to the source offset
  // Source offset in IEC Fixed coordinates (before gantry rotation):
  // At gantry 0: source is at (0, 0, +SAD) in IEC Fixed (beam comes from ceiling)
  
  // Actually in IEC 61217:
  // - At gantry 0°, beam is vertical, coming from above (+Z_f direction toward -Z_f)
  // - Source is at (0, 0, +SAD) relative to isocenter in IEC Fixed
  
  // Source position in IEC Gantry coordinates (rotated with gantry):
  // Source is always at (0, -SAD, 0) in IEC Gantry coords (along -Y_g axis)
  
  // To get source in IEC Fixed: apply inverse gantry rotation
  let sourceX_iec = sad * Math.sin(gantryRad) * Math.cos(couchRad);
  let sourceY_iec = -sad * Math.sin(gantryRad) * Math.sin(couchRad);
  let sourceZ_iec = sad * Math.cos(gantryRad);
  
  // Convert from IEC to DICOM (inverse of DICOM to IEC)
  // For HFS: DICOM_X = -IEC_X, DICOM_Y = -IEC_Z, DICOM_Z = -IEC_Y
  let sourceX, sourceY, sourceZ;
  
  switch (patientPosition) {
    case 'HFS':
      sourceX = -sourceX_iec;
      sourceY = -sourceZ_iec;
      sourceZ = -sourceY_iec;
      break;
    case 'HFP':
      sourceX = sourceX_iec;
      sourceY = sourceZ_iec;
      sourceZ = -sourceY_iec;
      break;
    case 'FFS':
      sourceX = sourceX_iec;
      sourceY = -sourceZ_iec;
      sourceZ = sourceY_iec;
      break;
    case 'FFP':
      sourceX = -sourceX_iec;
      sourceY = sourceZ_iec;
      sourceZ = sourceY_iec;
      break;
    default:
      // Default HFS
      sourceX = -sourceX_iec;
      sourceY = -sourceZ_iec;
      sourceZ = -sourceY_iec;
  }
  
  // Add isocenter offset
  return new Vector3(
    isocenter.x + sourceX,
    isocenter.y + sourceY,
    isocenter.z + sourceZ
  );
}

/**
 * Calculate beam direction unit vector
 * 
 * @param gantryAngleDeg - Gantry angle in degrees
 * @param couchAngleDeg - Couch angle in degrees
 * @param patientPosition - Patient orientation
 * @returns Beam direction unit vector in DICOM patient coordinates
 */
export function calculateBeamDirection(
  gantryAngleDeg: number,
  couchAngleDeg: number,
  patientPosition: PatientPosition = 'HFS'
): Vector3 {
  const gantryRad = (gantryAngleDeg * Math.PI) / 180;
  const couchRad = (couchAngleDeg * Math.PI) / 180;
  
  // Beam direction in IEC Fixed (from source toward isocenter)
  const dirX_iec = -Math.sin(gantryRad) * Math.cos(couchRad);
  const dirY_iec = Math.sin(gantryRad) * Math.sin(couchRad);
  const dirZ_iec = -Math.cos(gantryRad);
  
  // Convert to DICOM
  let dirX, dirY, dirZ;
  
  switch (patientPosition) {
    case 'HFS':
      dirX = -dirX_iec;
      dirY = -dirZ_iec;
      dirZ = -dirY_iec;
      break;
    case 'HFP':
      dirX = dirX_iec;
      dirY = dirZ_iec;
      dirZ = -dirY_iec;
      break;
    case 'FFS':
      dirX = dirX_iec;
      dirY = -dirZ_iec;
      dirZ = dirY_iec;
      break;
    case 'FFP':
      dirX = -dirX_iec;
      dirY = dirZ_iec;
      dirZ = dirY_iec;
      break;
    default:
      dirX = -dirX_iec;
      dirY = -dirZ_iec;
      dirZ = -dirY_iec;
  }
  
  return new Vector3(dirX, dirY, dirZ).normalize();
}

/**
 * Get the complete transformation from DICOM patient coordinates 
 * to Beam Limiting Device (BLD/collimator) coordinates
 * 
 * This is used for projecting structures into BEV
 */
export function getDICOMToBLDMatrix(
  isocenter: Vector3,
  gantryAngleDeg: number,
  collimatorAngleDeg: number,
  couchAngleDeg: number,
  patientPosition: PatientPosition = 'HFS'
): Matrix4 {
  // Step 1: Translate to isocenter-centered coordinates
  const toIsocenter = new Matrix4().makeTranslation(
    -isocenter.x,
    -isocenter.y,
    -isocenter.z
  );
  
  // Step 2: DICOM Patient to IEC Fixed
  const dicomToIec = getDICOMToIECMatrix(patientPosition);
  
  // Step 3: Apply couch rotation (rotates patient relative to gantry)
  const couchMatrix = getCouchTransformMatrix(-couchAngleDeg); // Inverse for world-to-BLD
  
  // Step 4: Apply gantry rotation
  const gantryMatrix = getGantryTransformMatrix(-gantryAngleDeg); // Inverse
  
  // Step 5: Apply collimator rotation  
  const collimatorMatrix = getCollimatorTransformMatrix(-collimatorAngleDeg); // Inverse
  
  // Combine transformations: apply in order
  const result = new Matrix4();
  result.copy(toIsocenter);
  result.premultiply(dicomToIec);
  result.premultiply(couchMatrix);
  result.premultiply(gantryMatrix);
  result.premultiply(collimatorMatrix);
  
  return result;
}

/**
 * Project a 3D point to BEV (2D) coordinates using perspective projection
 * 
 * @param point - 3D point in DICOM patient coordinates
 * @param source - Source position in DICOM patient coordinates
 * @param isocenter - Isocenter position in DICOM patient coordinates
 * @param gantryAngleDeg - Gantry angle
 * @param collimatorAngleDeg - Collimator angle
 * @param sad - Source to Axis Distance
 * @param patientPosition - Patient orientation
 * @returns 2D BEV coordinates {x, y} in mm at isocenter plane, or null if behind source
 */
export function projectPointToBEV(
  point: Vector3,
  source: Vector3,
  isocenter: Vector3,
  gantryAngleDeg: number,
  collimatorAngleDeg: number,
  couchAngleDeg: number,
  sad: number,
  patientPosition: PatientPosition = 'HFS'
): { x: number; y: number } | null {
  // Transform point to BLD coordinates
  const bldMatrix = getDICOMToBLDMatrix(
    isocenter,
    gantryAngleDeg,
    collimatorAngleDeg,
    couchAngleDeg,
    patientPosition
  );
  
  // Transform the point
  const pointBLD = bldMatrix.transformPoint(point);
  
  // In BLD coordinates:
  // - Origin is at isocenter
  // - Source is at (0, -SAD, 0) -- actually at (0, 0, SAD) depending on convention
  // - Beam travels along +Y axis (toward isocenter)
  
  // For perspective projection from source to isocenter plane:
  // Source in BLD is at Y = -SAD (behind isocenter)
  // Isocenter plane is at Y = 0
  
  const sourceY = -sad; // Source is at Y = -SAD in BLD coordinates
  const pointY = pointBLD.y;
  
  // Check if point is between source and isocenter plane
  if (pointY <= sourceY) {
    // Point is behind or at the source, can't project
    return null;
  }
  
  // Perspective projection factor
  // How much to scale based on distance from source
  const t = (0 - sourceY) / (pointY - sourceY); // t to reach isocenter plane
  
  // Projected coordinates on isocenter plane
  const projectedX = pointBLD.x * t;
  const projectedZ = pointBLD.z * t; // Z in BLD maps to Y in BEV
  
  return { x: projectedX, y: projectedZ };
}

/**
 * Get BEV orientation labels based on gantry, collimator, and couch angles
 * 
 * Returns labels for Left, Right, Top, Bottom of the BEV view
 */
export function getBEVOrientationLabels(
  gantryAngleDeg: number,
  collimatorAngleDeg: number,
  couchAngleDeg: number,
  patientPosition: PatientPosition = 'HFS'
): { left: string; right: string; top: string; bottom: string } {
  // Default for gantry 0 (AP beam, collimator 0, supine patient)
  // Left = Patient's Right (R)
  // Right = Patient's Left (L)
  // Top = Patient's Head (H) / Superior
  // Bottom = Patient's Feet (F) / Inferior
  
  // Effective rotation combines gantry and collimator
  const effectiveAngle = (gantryAngleDeg + collimatorAngleDeg + 360) % 360;
  
  // Base labels for HFS at gantry 0
  const baseLabels = ['R', 'H', 'L', 'F']; // Right, Head, Left, Feet (clockwise from left)
  
  // Rotate labels based on collimator angle
  const collRotSteps = Math.round(collimatorAngleDeg / 90) % 4;
  
  // Adjust for gantry angle quadrant
  let gantryQuadrant = 0;
  if (gantryAngleDeg >= 45 && gantryAngleDeg < 135) gantryQuadrant = 1;  // Left lateral
  else if (gantryAngleDeg >= 135 && gantryAngleDeg < 225) gantryQuadrant = 2; // PA
  else if (gantryAngleDeg >= 225 && gantryAngleDeg < 315) gantryQuadrant = 3; // Right lateral
  
  // For lateral beams, swap L/R with H/F perspective
  let labels: string[];
  
  if (gantryQuadrant === 0 || gantryQuadrant === 2) {
    // AP or PA beam
    labels = ['R', 'H', 'L', 'F'];
    if (gantryQuadrant === 2) {
      // PA: flip left/right
      labels = ['L', 'H', 'R', 'F'];
    }
  } else {
    // Lateral beams
    if (gantryQuadrant === 1) {
      // Left lateral (beam from patient's left)
      labels = ['A', 'H', 'P', 'F']; // Anterior, Head, Posterior, Feet
    } else {
      // Right lateral (beam from patient's right)
      labels = ['P', 'H', 'A', 'F'];
    }
  }
  
  // Apply collimator rotation
  const rotateLabels = (arr: string[], steps: number): string[] => {
    const n = arr.length;
    const s = ((steps % n) + n) % n;
    return [...arr.slice(s), ...arr.slice(0, s)];
  };
  
  const rotated = rotateLabels(labels, collRotSteps);
  
  return {
    left: rotated[0],
    top: rotated[1],
    right: rotated[2],
    bottom: rotated[3]
  };
}

/**
 * Convert gantry angle to human-readable beam direction
 */
export function getBeamDirectionName(gantryAngleDeg: number): string {
  const normalized = ((gantryAngleDeg % 360) + 360) % 360;
  
  if (normalized >= 350 || normalized < 10) return 'AP (Anterior)';
  if (normalized >= 10 && normalized < 80) return 'LAO';
  if (normalized >= 80 && normalized < 100) return 'Left Lateral';
  if (normalized >= 100 && normalized < 170) return 'LPO';
  if (normalized >= 170 && normalized < 190) return 'PA (Posterior)';
  if (normalized >= 190 && normalized < 260) return 'RPO';
  if (normalized >= 260 && normalized < 280) return 'Right Lateral';
  if (normalized >= 280 && normalized < 350) return 'RAO';
  
  return `${Math.round(normalized)}°`;
}
