/**
 * SuperSeg Client - Single-click brain tumor segmentation
 * 
 * This client communicates with the SuperSeg U-Net service for
 * brain metastasis segmentation using single-point clicks.
 */

import { log } from './log';

export interface SuperSegSegmentRequest {
  volume: number[][][];           // 3D MRI volume (H, W, D) or (D, H, W)
  click_point: [number, number, number]; // [y, x, z] coordinates
  spacing?: [number, number, number];    // [z, y, x] voxel spacing
  slice_axis?: 'first' | 'last';         // Which axis is slice dimension
}

export interface SuperSegSegmentResponse {
  mask: number[][][];             // 3D binary mask
  slices_with_tumor: number[];    // Slice indices with tumor
  total_voxels: number;           // Total tumor voxels
  confidence: number;             // Confidence score
}

export interface SuperSegHealthResponse {
  status: string;
  message: string;
  device?: string;
  model?: string;
}

class SuperSegClient {
  private baseUrl = '/api/superseg';

  /**
   * Check if SuperSeg service is available
   */
  async checkHealth(): Promise<SuperSegHealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();

      if (response.ok) {
        log.info('SuperSeg service is ready', 'superseg');
        return data;
      } else {
        log.warn(`SuperSeg service health check failed: ${JSON.stringify(data)}`, 'superseg');
        throw new Error(data.message || 'Service unavailable');
      }
    } catch (error: any) {
      log.error(`SuperSeg health check error: ${error.message}`, 'superseg');
      throw error;
    }
  }

  /**
   * Segment tumor from single point click
   * 
   * @param request Segmentation request with volume and click point
   * @returns Segmentation result with 3D mask
   */
  async segment(request: SuperSegSegmentRequest): Promise<SuperSegSegmentResponse> {
    try {
      log.info('🧠 Calling SuperSeg segment endpoint', 'superseg');
      log.debug(`  Click point: ${JSON.stringify(request.click_point)}`, 'superseg');
      log.debug(`  Volume shape: ${request.volume.length}x${request.volume[0]?.length}x${request.volume[0]?.[0]?.length}`, 'superseg');

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

      log.info(`✅ SuperSeg segmentation successful`, 'superseg');
      log.debug(`  Total voxels: ${data.total_voxels ?? 0}`, 'superseg');
      log.debug(`  Slices with tumor: ${data.slices_with_tumor?.length ?? 0}`, 'superseg');
      log.debug(`  Confidence: ${data.confidence?.toFixed(2) ?? 'N/A'}`, 'superseg');

      return data;
    } catch (error: any) {
      log.error(`SuperSeg segmentation failed: ${error.message}`, 'superseg');
      throw error;
    }
  }
}

// Export singleton instance
export const supersegClient = new SuperSegClient();

