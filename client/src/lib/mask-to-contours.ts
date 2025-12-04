/**
 * Convert binary mask to DICOM contour points
 * Uses marching squares algorithm to trace contours
 */

export async function maskToContours(mask: number[][]): Promise<number[][]> {
  const height = mask.length;
  const width = mask[0]?.length || 0;

  if (width === 0 || height === 0) {
    return [];
  }

  // Find contours using marching squares
  const contours: number[][][] = [];
  const visited = Array(height).fill(0).map(() => Array(width).fill(false));

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      if (mask[y][x] > 0 && !visited[y][x]) {
        const contour = traceContour(mask, visited, x, y);
        if (contour.length > 0) {
          contours.push(contour);
        }
      }
    }
  }

  // Convert contours to DICOM format [x1, y1, z1, x2, y2, z2, ...]
  // Note: z is 0 for 2D contours (will be set by caller based on slice position)
  return contours.map(contour => {
    const points: number[] = [];
    for (const [x, y] of contour) {
      points.push(x, y, 0);
    }
    return points;
  });
}

function traceContour(
  mask: number[][],
  visited: boolean[][],
  startX: number,
  startY: number
): Array<[number, number]> {
  const height = mask.length;
  const width = mask[0].length;
  const contour: Array<[number, number]> = [];

  // Use 8-connectivity to trace boundary
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let x = startX;
  let y = startY;
  let dir = 0;

  const maxSteps = width * height; // Prevent infinite loops
  let steps = 0;

  do {
    visited[y][x] = true;
    contour.push([x, y]);

    // Look for next boundary pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const nextDir = (dir + i) % 8;
      const nx = x + dx[nextDir];
      const ny = y + dy[nextDir];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny][nx] > 0) {
        x = nx;
        y = ny;
        dir = (nextDir + 6) % 8; // Turn right
        found = true;
        break;
      }
    }

    if (!found) break;

    steps++;
    if (steps > maxSteps) {
      console.warn('Contour tracing exceeded max steps');
      break;
    }

    // Stop when we return to start
  } while (x !== startX || y !== startY || contour.length < 3);

  // Simplify contour (remove collinear points)
  return simplifyContour(contour);
}

function simplifyContour(contour: Array<[number, number]>): Array<[number, number]> {
  if (contour.length < 3) return contour;

  const simplified: Array<[number, number]> = [contour[0]];

  for (let i = 1; i < contour.length - 1; i++) {
    const prev = contour[i - 1];
    const curr = contour[i];
    const next = contour[i + 1];

    // Check if current point is collinear with prev and next
    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];

    const cross = dx1 * dy2 - dy1 * dx2;

    // Keep point if not collinear or if it's far from prev
    if (Math.abs(cross) > 0.5 || Math.abs(dx1) > 2 || Math.abs(dy1) > 2) {
      simplified.push(curr);
    }
  }

  simplified.push(contour[contour.length - 1]);

  return simplified;
}
