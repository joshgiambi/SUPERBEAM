/**
 * SAM Server Client - Server-side Segment Anything Model
 * 
 * This client communicates with the Python SAM service for
 * interactive 2D segmentation using click points.
 */

import { log } from './log';

export interface SAMSegment2DRequest {
  image: number[][];                      // 2D image (H, W)
  click_point: [number, number];          // [y, x] coordinates
  window_center?: number;
  window_width?: number;
}

export interface SAMSegment2DResponse {
  mask: number[][];                       // 2D binary mask
  contour: [number, number][];            // Contour points [x, y]
  confidence: number;
  num_pixels: number;
}

export interface SAMSegment3DRequest {
  volume: number[][][];                   // 3D volume (H, W, D)
  click_point: [number, number, number];  // [y, x, z] coordinates
  window_center?: number;
  window_width?: number;
  slice_axis?: 'first' | 'last';
  mode?: '2d' | '3d';
}

export interface SAMSegment3DResponse {
  mask: number[][][];                     // 3D binary mask
  slices_with_tumor: number[];
  total_voxels: number;
  confidence: number;
}

export interface SAMHealthResponse {
  status: string;
  message?: string;
  device?: string;
  model?: string;
  model_loaded?: boolean;
  starting?: boolean;
}

export interface SAMStartResponse {
  status: 'started' | 'already_running' | 'starting' | 'timeout' | 'error';
  message: string;
  device?: string;
}

class SAMServerClient {
  private baseUrl = '/api/superseg';  // Uses same endpoint (superseg proxy routes to SAM now)

  /**
   * Check if SAM service is available
   */
  async checkHealth(): Promise<SAMHealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();

      // Accept both 'ready' and 'healthy' status
      if (response.ok && (data.status === 'ready' || data.status === 'healthy')) {
        log.info('🔬 SAM server is ready', 'sam');
        return data;
      } else {
        log.warn(`🔬 SAM health check failed: ${JSON.stringify(data)}`, 'sam');
        throw new Error(data.message || 'Service unavailable');
      }
    } catch (error: any) {
      log.error(`🔬 SAM health check error: ${error.message}`, 'sam');
      throw error;
    }
  }

  /**
   * Start the SAM service (if not already running)
   */
  async startServer(): Promise<SAMStartResponse> {
    try {
      log.info('🔬 Requesting SAM server start...', 'sam');

      const response = await fetch(`${this.baseUrl}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start server');
      }

      log.info(`🔬 SAM server start response: ${data.status} - ${data.message}`, 'sam');
      return data;
    } catch (error: any) {
      log.error(`🔬 Failed to start SAM server: ${error.message}`, 'sam');
      throw error;
    }
  }

  /**
   * Segment a single 2D slice with a click point
   */
  async segment2D(request: SAMSegment2DRequest): Promise<SAMSegment2DResponse> {
    try {
      log.info('🔬 Calling SAM 2D segment endpoint', 'sam');
      log.info(`🔬 Click point: [${request.click_point.join(', ')}]`, 'sam');
      log.info(`🔬 Image shape: ${request.image.length}x${request.image[0]?.length}`, 'sam');

      const response = await fetch(`${this.baseUrl}/segment_2d`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Segmentation failed');
      }

      log.info(`🔬 ✅ SAM 2D segmentation successful`, 'sam');
      log.info(`🔬 Contour: ${data.contour?.length ?? 0} points, ${data.num_pixels ?? 0} pixels`, 'sam');
      log.info(`🔬 Confidence: ${(data.confidence * 100).toFixed(1)}%`, 'sam');

      return data;
    } catch (error: any) {
      log.error(`🔬 SAM 2D segmentation failed: ${error.message}`, 'sam');
      throw error;
    }
  }

  /**
   * Segment 3D volume with propagation
   */
  async segment3D(request: SAMSegment3DRequest): Promise<SAMSegment3DResponse> {
    try {
      log.info('🔬 Calling SAM 3D segment endpoint', 'sam');
      log.info(`🔬 Click point: [${request.click_point.join(', ')}]`, 'sam');
      log.info(`🔬 Volume shape: ${request.volume.length}x${request.volume[0]?.length}x${request.volume[0]?.[0]?.length}`, 'sam');

      const response = await fetch(`${this.baseUrl}/segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Segmentation failed');
      }

      log.info(`🔬 ✅ SAM 3D segmentation successful`, 'sam');
      log.info(`🔬 Total voxels: ${data.total_voxels ?? 0}`, 'sam');
      log.info(`🔬 Slices with tumor: ${data.slices_with_tumor?.length ?? 0}`, 'sam');
      log.info(`🔬 Confidence: ${(data.confidence * 100).toFixed(1)}%`, 'sam');

      return data;
    } catch (error: any) {
      log.error(`🔬 SAM 3D segmentation failed: ${error.message}`, 'sam');
      throw error;
    }
  }
}

// Export singleton instance
export const samServerClient = new SAMServerClient();
