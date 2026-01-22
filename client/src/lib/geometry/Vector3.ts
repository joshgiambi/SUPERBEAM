/**
 * Vector3 - 3D Vector class for RT Plan geometry calculations
 * 
 * Implements IEC 61217 coordinate system operations for:
 * - DICOM Patient coordinates
 * - IEC Fixed coordinates
 * - Gantry/Collimator/Couch transformations
 */

export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  // Factory methods
  static fromArray(arr: number[] | [number, number, number]): Vector3 {
    return new Vector3(arr[0] || 0, arr[1] || 0, arr[2] || 0);
  }

  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static unitX(): Vector3 {
    return new Vector3(1, 0, 0);
  }

  static unitY(): Vector3 {
    return new Vector3(0, 1, 0);
  }

  static unitZ(): Vector3 {
    return new Vector3(0, 0, 1);
  }

  // Conversion
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v: Vector3): Vector3 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  set(x: number, y: number, z: number): Vector3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  // Basic operations (mutating)
  add(v: Vector3): Vector3 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: Vector3): Vector3 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s: number): Vector3 {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  divideScalar(s: number): Vector3 {
    if (s === 0) {
      console.warn('Vector3.divideScalar: Division by zero');
      return this.set(0, 0, 0);
    }
    return this.multiplyScalar(1 / s);
  }

  negate(): Vector3 {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  // Properties
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) {
      return this.set(0, 0, 0);
    }
    return this.divideScalar(len);
  }

  // Dot and cross products
  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vector3): Vector3 {
    const ax = this.x, ay = this.y, az = this.z;
    const bx = v.x, by = v.y, bz = v.z;

    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;

    return this;
  }

  // Distance
  distanceTo(v: Vector3): number {
    return Math.sqrt(this.distanceToSquared(v));
  }

  distanceToSquared(v: Vector3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  // Angle between vectors
  angleTo(v: Vector3): number {
    const denominator = Math.sqrt(this.lengthSquared() * v.lengthSquared());
    if (denominator === 0) return Math.PI / 2;

    const theta = this.dot(v) / denominator;
    // Clamp to avoid numerical issues with acos
    return Math.acos(Math.max(-1, Math.min(1, theta)));
  }

  // Linear interpolation
  lerp(v: Vector3, alpha: number): Vector3 {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }

  // Apply 4x4 transformation matrix (column-major order)
  applyMatrix4(m: number[]): Vector3 {
    const x = this.x, y = this.y, z = this.z;
    const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);

    this.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
    this.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
    this.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;

    return this;
  }

  // Apply rotation only from 4x4 matrix (ignores translation)
  applyMatrix4Rotation(m: number[]): Vector3 {
    const x = this.x, y = this.y, z = this.z;

    this.x = m[0] * x + m[4] * y + m[8] * z;
    this.y = m[1] * x + m[5] * y + m[9] * z;
    this.z = m[2] * x + m[6] * y + m[10] * z;

    return this;
  }

  // Rotate around axis (Rodrigues' rotation formula)
  rotateAround(axis: Vector3, angle: number): Vector3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = 1 - cos;

    const ax = axis.x, ay = axis.y, az = axis.z;
    const x = this.x, y = this.y, z = this.z;

    // Rodrigues' rotation formula
    this.x = (t * ax * ax + cos) * x + (t * ax * ay - sin * az) * y + (t * ax * az + sin * ay) * z;
    this.y = (t * ax * ay + sin * az) * x + (t * ay * ay + cos) * y + (t * ay * az - sin * ax) * z;
    this.z = (t * ax * az - sin * ay) * x + (t * ay * az + sin * ax) * y + (t * az * az + cos) * z;

    return this;
  }

  // Project onto plane with given normal
  projectOnPlane(planeNormal: Vector3): Vector3 {
    const d = this.dot(planeNormal);
    this.x -= planeNormal.x * d;
    this.y -= planeNormal.y * d;
    this.z -= planeNormal.z * d;
    return this;
  }

  // Project onto vector (result is on the line defined by v)
  projectOnVector(v: Vector3): Vector3 {
    const denominator = v.lengthSquared();
    if (denominator === 0) return this.set(0, 0, 0);

    const scalar = v.dot(this) / denominator;
    return this.copy(v).multiplyScalar(scalar);
  }

  // Reflect across plane with given normal
  reflect(normal: Vector3): Vector3 {
    const d = 2 * this.dot(normal);
    this.x -= normal.x * d;
    this.y -= normal.y * d;
    this.z -= normal.z * d;
    return this;
  }

  // Equality check with tolerance
  equals(v: Vector3, tolerance: number = 1e-10): boolean {
    return (
      Math.abs(this.x - v.x) <= tolerance &&
      Math.abs(this.y - v.y) <= tolerance &&
      Math.abs(this.z - v.z) <= tolerance
    );
  }

  // String representation
  toString(precision: number = 3): string {
    return `Vector3(${this.x.toFixed(precision)}, ${this.y.toFixed(precision)}, ${this.z.toFixed(precision)})`;
  }
}

// Standalone helper functions (non-mutating)
export function addVectors(a: Vector3, b: Vector3): Vector3 {
  return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
}

export function subVectors(a: Vector3, b: Vector3): Vector3 {
  return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function scaleVector(v: Vector3, s: number): Vector3 {
  return new Vector3(v.x * s, v.y * s, v.z * s);
}

export function normalizeVector(v: Vector3): Vector3 {
  return v.clone().normalize();
}

export function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return new Vector3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

export function dotProduct(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function lerpVectors(a: Vector3, b: Vector3, t: number): Vector3 {
  return new Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t
  );
}
