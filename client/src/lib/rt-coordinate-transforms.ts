/**
 * RT Coordinate Transformation Utilities
 * 
 * Handles coordinate transformations between:
 * - DICOM Patient Coordinate System (PCS)
 * - IEC Equipment Coordinate System
 * - Beam's Eye View (BEV) coordinates
 * - Image pixel coordinates
 * 
 * DICOM Patient Coordinate System:
 * - X: Increases from patient's right to left
 * - Y: Increases from anterior (front) to posterior (back)
 * - Z: Increases from inferior (feet) to superior (head)
 * 
 * IEC Fixed Coordinate System (room coordinates):
 * - X: Points to the right when facing the gantry
 * - Y: Points toward the gantry
 * - Z: Points upward (same as patient Z in supine HFS)
 * 
 * BEV Coordinate System:
 * - Origin at isocenter
 * - X: Parallel to jaw X motion (crossline)
 * - Y: Parallel to jaw Y motion (inline)
 */

export type Vec3 = [number, number, number];
export type Matrix3x3 = [Vec3, Vec3, Vec3];
export type Matrix4x4 = [[number, number, number, number], 
                          [number, number, number, number],
                          [number, number, number, number],
                          [number, number, number, number]];

/**
 * Patient position/orientation types
 */
export type PatientPosition = 
  | 'HFS'  // Head First Supine (most common)
  | 'HFP'  // Head First Prone
  | 'FFS'  // Feet First Supine
  | 'FFP'  // Feet First Prone
  | 'HFDR' // Head First Decubitus Right
  | 'HFDL' // Head First Decubitus Left
  | 'FFDR' // Feet First Decubitus Right
  | 'FFDL';// Feet First Decubitus Left

/**
 * Vector operations
 */
export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Matrix operations
 */
export function mat3Identity(): Matrix3x3 {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

export function mat3Multiply(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
  const result: Matrix3x3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

export function mat3TransformVec3(m: Matrix3x3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/**
 * Create rotation matrix around X axis
 */
export function mat3RotationX(angleDeg: number): Matrix3x3 {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

/**
 * Create rotation matrix around Y axis
 */
export function mat3RotationY(angleDeg: number): Matrix3x3 {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

/**
 * Create rotation matrix around Z axis
 */
export function mat3RotationZ(angleDeg: number): Matrix3x3 {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

/**
 * Get transformation matrix from DICOM Patient Coordinates to IEC Equipment Coordinates
 * based on patient position
 */
export function getPatientToEquipmentMatrix(position: PatientPosition): Matrix3x3 {
  switch (position) {
    case 'HFS': // Head First Supine (most common)
      // DICOM X → IEC X (patient left)
      // DICOM Y → IEC -Z (posterior → down in IEC when supine)
      // DICOM Z → IEC -Y (superior → toward gantry)
      return [
        [1, 0, 0],
        [0, 0, -1],
        [0, 1, 0],
      ];
    case 'HFP': // Head First Prone
      return [
        [-1, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
      ];
    case 'FFS': // Feet First Supine
      return [
        [-1, 0, 0],
        [0, 0, -1],
        [0, -1, 0],
      ];
    case 'FFP': // Feet First Prone
      return [
        [1, 0, 0],
        [0, 0, 1],
        [0, -1, 0],
      ];
    case 'HFDR': // Head First Decubitus Right
      return [
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 1],
      ];
    case 'HFDL': // Head First Decubitus Left
      return [
        [0, 1, 0],
        [-1, 0, 0],
        [0, 0, 1],
      ];
    default:
      return mat3Identity(); // Default to identity for unknown positions
  }
}

/**
 * Create gantry rotation matrix
 * Gantry rotates around the Z axis in IEC coordinates
 * 0° = beam from +Y (toward patient from gantry)
 * 90° = beam from +X (patient's left)
 * 180° = beam from -Y (from below/behind patient)
 * 270° = beam from -X (patient's right)
 */
export function getGantryRotationMatrix(gantryAngleDeg: number): Matrix3x3 {
  return mat3RotationZ(-gantryAngleDeg); // Negative because IEC uses opposite rotation sense
}

/**
 * Create collimator rotation matrix
 * Collimator rotates around the beam axis (Y in IEC gantry coords after gantry rotation)
 */
export function getCollimatorRotationMatrix(collimatorAngleDeg: number): Matrix3x3 {
  return mat3RotationY(-collimatorAngleDeg);
}

/**
 * Create couch (patient support) rotation matrix
 * Couch rotates around the Z axis in IEC room coordinates
 * 0° = no rotation
 * 90° = patient rotated CCW when viewed from above
 */
export function getCouchRotationMatrix(couchAngleDeg: number): Matrix3x3 {
  return mat3RotationZ(-couchAngleDeg);
}

/**
 * Calculate source position in patient coordinates
 * 
 * @param isocenter - Isocenter position in DICOM patient coordinates [x, y, z]
 * @param gantryAngle - Gantry angle in degrees
 * @param couchAngle - Couch angle in degrees
 * @param sad - Source to Axis Distance in mm (typically 1000)
 * @param patientPosition - Patient position (default HFS)
 */
export function calculateSourcePosition(
  isocenter: Vec3,
  gantryAngle: number,
  couchAngle: number,
  sad: number = 1000,
  patientPosition: PatientPosition = 'HFS'
): Vec3 {
  // Convert gantry angle to radians
  const gantryRad = (gantryAngle * Math.PI) / 180;
  const couchRad = (couchAngle * Math.PI) / 180;
  
  // In IEC coordinates:
  // Gantry at 0° means source is at +Y direction (toward gantry) from isocenter
  // The beam points from source toward isocenter (-Y direction)
  
  // Source offset in IEC gantry coordinates (before gantry rotation)
  // Source is at +Y direction, SAD mm away from isocenter
  let sourceOffset: Vec3 = [0, sad, 0];
  
  // Apply gantry rotation (around Z axis)
  // At gantry 0°: source at +Y
  // At gantry 90°: source at +X
  sourceOffset = [
    sourceOffset[0] * Math.cos(gantryRad) - sourceOffset[1] * Math.sin(gantryRad),
    sourceOffset[0] * Math.sin(gantryRad) + sourceOffset[1] * Math.cos(gantryRad),
    sourceOffset[2],
  ];
  
  // Apply couch rotation (around Z axis in room coordinates)
  if (couchAngle !== 0) {
    sourceOffset = [
      sourceOffset[0] * Math.cos(couchRad) + sourceOffset[1] * Math.sin(couchRad),
      -sourceOffset[0] * Math.sin(couchRad) + sourceOffset[1] * Math.cos(couchRad),
      sourceOffset[2],
    ];
  }
  
  // Transform from IEC to DICOM patient coordinates based on patient position
  // For HFS: IEC X = DICOM X, IEC Y = -DICOM Z, IEC Z = DICOM Y
  let sourcePatient: Vec3;
  switch (patientPosition) {
    case 'HFS':
      sourcePatient = [
        isocenter[0] + sourceOffset[0],
        isocenter[1] - sourceOffset[2],
        isocenter[2] - sourceOffset[1],
      ];
      break;
    case 'HFP':
      sourcePatient = [
        isocenter[0] - sourceOffset[0],
        isocenter[1] + sourceOffset[2],
        isocenter[2] - sourceOffset[1],
      ];
      break;
    case 'FFS':
      sourcePatient = [
        isocenter[0] - sourceOffset[0],
        isocenter[1] - sourceOffset[2],
        isocenter[2] + sourceOffset[1],
      ];
      break;
    case 'FFP':
      sourcePatient = [
        isocenter[0] + sourceOffset[0],
        isocenter[1] + sourceOffset[2],
        isocenter[2] + sourceOffset[1],
      ];
      break;
    default:
      sourcePatient = vec3Add(isocenter, sourceOffset);
  }
  
  return sourcePatient;
}

/**
 * Calculate beam direction vector (unit vector from source to isocenter)
 */
export function calculateBeamDirection(
  sourcePosition: Vec3,
  isocenter: Vec3
): Vec3 {
  const dir = vec3Subtract(isocenter, sourcePosition);
  return vec3Normalize(dir);
}

/**
 * Project a point at the isocenter plane to the detector plane along the beam
 * Used for BEV calculations
 * 
 * @param pointAtIso - Point in BEV coordinates (mm at isocenter plane, relative to isocenter)
 * @param collimatorAngle - Collimator angle in degrees
 * @returns Point with collimator rotation applied
 */
export function applyCollimatorRotation(
  pointAtIso: { x: number; y: number },
  collimatorAngle: number
): { x: number; y: number } {
  const rad = (collimatorAngle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  return {
    x: pointAtIso.x * cos - pointAtIso.y * sin,
    y: pointAtIso.x * sin + pointAtIso.y * cos,
  };
}

/**
 * Calculate the intersection of a ray with a plane (axial slice)
 * 
 * @param rayOrigin - Origin of the ray (source position)
 * @param rayDirection - Direction of the ray (normalized)
 * @param planeZ - Z position of the axial plane
 * @returns Intersection point [x, y, z] or null if no intersection
 */
export function rayPlaneIntersection(
  rayOrigin: Vec3,
  rayDirection: Vec3,
  planeZ: number
): Vec3 | null {
  // For an axial plane, the normal is [0, 0, 1]
  // Plane equation: z = planeZ
  
  // Parametric ray: P = O + t * D
  // z = rayOrigin[2] + t * rayDirection[2] = planeZ
  // t = (planeZ - rayOrigin[2]) / rayDirection[2]
  
  if (Math.abs(rayDirection[2]) < 1e-10) {
    // Ray is parallel to the plane
    return null;
  }
  
  const t = (planeZ - rayOrigin[2]) / rayDirection[2];
  
  if (t < 0) {
    // Intersection is behind the ray origin
    return null;
  }
  
  return [
    rayOrigin[0] + t * rayDirection[0],
    rayOrigin[1] + t * rayDirection[1],
    planeZ,
  ];
}

/**
 * Calculate field corner positions at a given plane (divergent beam)
 * 
 * @param source - Source position
 * @param isocenter - Isocenter position
 * @param jawAperture - Jaw aperture at isocenter plane
 * @param collimatorAngle - Collimator angle in degrees
 * @param gantryAngle - Gantry angle in degrees
 * @param sad - Source to Axis Distance
 * @param planeZ - Z position of the plane to project to
 * @returns Array of corner positions [x, y] on the plane
 */
export function projectFieldToPlane(
  source: Vec3,
  isocenter: Vec3,
  jawAperture: { x1: number; x2: number; y1: number; y2: number },
  collimatorAngle: number,
  gantryAngle: number,
  sad: number,
  planeZ: number
): Array<{ x: number; y: number }> | null {
  const corners: Array<{ x: number; y: number }> = [];
  
  // Define corners of the jaw aperture at isocenter plane (in BEV coordinates)
  const bevCorners = [
    { x: jawAperture.x1, y: jawAperture.y1 },
    { x: jawAperture.x2, y: jawAperture.y1 },
    { x: jawAperture.x2, y: jawAperture.y2 },
    { x: jawAperture.x1, y: jawAperture.y2 },
  ];
  
  const gantryRad = (gantryAngle * Math.PI) / 180;
  
  for (const corner of bevCorners) {
    // Apply collimator rotation
    const rotatedCorner = applyCollimatorRotation(corner, collimatorAngle);
    
    // Convert BEV coordinates to patient coordinates at isocenter
    // BEV X is perpendicular to beam axis (IEC X after gantry rotation)
    // BEV Y is along the couch (IEC Z)
    
    // For HFS patient:
    // IEC X rotated by gantry angle → patient coordinates
    const cosG = Math.cos(gantryRad);
    const sinG = Math.sin(gantryRad);
    
    // Point at isocenter plane in patient coordinates
    const pointAtIso: Vec3 = [
      isocenter[0] + rotatedCorner.x * cosG,
      isocenter[1] + rotatedCorner.x * sinG,
      isocenter[2] + rotatedCorner.y, // BEV Y maps to patient Z for HFS
    ];
    
    // Calculate ray direction from source through this point
    const rayDir = vec3Normalize(vec3Subtract(pointAtIso, source));
    
    // Find intersection with the plane
    const intersection = rayPlaneIntersection(source, rayDir, planeZ);
    
    if (intersection) {
      corners.push({ x: intersection[0], y: intersection[1] });
    }
  }
  
  return corners.length === 4 ? corners : null;
}

/**
 * Get orientation labels for BEV based on gantry and couch angles
 * Returns labels for the four cardinal directions in the BEV image
 * 
 * @param gantryAngle - Gantry angle in degrees
 * @param couchAngle - Couch angle in degrees
 * @param patientPosition - Patient position
 */
export function getBEVOrientationLabels(
  gantryAngle: number,
  couchAngle: number,
  patientPosition: PatientPosition = 'HFS'
): {
  right: string;
  left: string;
  top: string;
  bottom: string;
} {
  // For HFS patient at gantry 0° (AP beam):
  // Right = Patient Left (L)
  // Left = Patient Right (R)
  // Top = Superior (H = Head)
  // Bottom = Inferior (F = Feet)
  
  // At gantry 90° (Left lateral):
  // Right = Posterior (P)
  // Left = Anterior (A)
  // Top = Superior (H)
  // Bottom = Inferior (F)
  
  const labels = {
    right: 'L',
    left: 'R',
    top: 'H',
    bottom: 'F',
  };
  
  // Adjust based on gantry angle quadrant
  const normalizedAngle = ((gantryAngle % 360) + 360) % 360;
  
  if (normalizedAngle >= 45 && normalizedAngle < 135) {
    // Left lateral region (gantry ~90°)
    labels.right = 'P';
    labels.left = 'A';
  } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
    // PA region (gantry ~180°)
    labels.right = 'R';
    labels.left = 'L';
  } else if (normalizedAngle >= 225 && normalizedAngle < 315) {
    // Right lateral region (gantry ~270°)
    labels.right = 'A';
    labels.left = 'P';
  }
  // else: AP region (gantry ~0° or ~360°) - use defaults
  
  // Adjust for couch rotation
  if (Math.abs(couchAngle) > 10) {
    // For significant couch rotations, the labels become more complex
    // This is a simplified handling
  }
  
  // Adjust for patient position
  if (patientPosition === 'HFP' || patientPosition === 'FFP') {
    // Prone - swap A and P
    if (labels.right === 'A') labels.right = 'P';
    else if (labels.right === 'P') labels.right = 'A';
    if (labels.left === 'A') labels.left = 'P';
    else if (labels.left === 'P') labels.left = 'A';
  }
  
  if (patientPosition === 'FFS' || patientPosition === 'FFP') {
    // Feet first - swap H and F, swap L and R for gantry 0/180
    [labels.top, labels.bottom] = [labels.bottom, labels.top];
  }
  
  return labels;
}

/**
 * Convert pixel coordinates to world (DICOM patient) coordinates
 */
export function pixelToWorld(
  pixelX: number,
  pixelY: number,
  imagePosition: Vec3,
  pixelSpacing: [number, number],
  imageOrientation: [Vec3, Vec3]
): Vec3 {
  const rowDir = imageOrientation[0];
  const colDir = imageOrientation[1];
  
  return [
    imagePosition[0] + pixelX * pixelSpacing[1] * rowDir[0] + pixelY * pixelSpacing[0] * colDir[0],
    imagePosition[1] + pixelX * pixelSpacing[1] * rowDir[1] + pixelY * pixelSpacing[0] * colDir[1],
    imagePosition[2] + pixelX * pixelSpacing[1] * rowDir[2] + pixelY * pixelSpacing[0] * colDir[2],
  ];
}

/**
 * Convert world (DICOM patient) coordinates to pixel coordinates
 */
export function worldToPixel(
  worldPos: Vec3,
  imagePosition: Vec3,
  pixelSpacing: [number, number],
  imageOrientation: [Vec3, Vec3]
): { x: number; y: number } | null {
  const rowDir = imageOrientation[0];
  const colDir = imageOrientation[1];
  
  // Calculate offset from image position
  const offset = vec3Subtract(worldPos, imagePosition);
  
  // Project onto row and column directions
  const x = vec3Dot(offset, rowDir) / pixelSpacing[1];
  const y = vec3Dot(offset, colDir) / pixelSpacing[0];
  
  return { x, y };
}

export default {
  vec3Add,
  vec3Subtract,
  vec3Scale,
  vec3Dot,
  vec3Cross,
  vec3Length,
  vec3Normalize,
  mat3Identity,
  mat3Multiply,
  mat3TransformVec3,
  mat3RotationX,
  mat3RotationY,
  mat3RotationZ,
  getPatientToEquipmentMatrix,
  getGantryRotationMatrix,
  getCollimatorRotationMatrix,
  getCouchRotationMatrix,
  calculateSourcePosition,
  calculateBeamDirection,
  applyCollimatorRotation,
  rayPlaneIntersection,
  projectFieldToPlane,
  getBEVOrientationLabels,
  pixelToWorld,
  worldToPixel,
};
