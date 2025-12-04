/**
 * SegVol client for AI Tumor tool
 * Adapts scribble-based interactions to SegVol's point-based prompts
 */

import { log } from './log';

interface SegVolResponse {
  prediction: number[][][];  // 3D binary mask
  confidence?: number;
  error?: string;
}

export interface ScribblePrompt {
  slice: number;
  points: Array<[number, number]>;
  label: number;  // 1 = tumor, 0 = background
}

class SegVolTumorClient {
  private baseUrl = '/api/segvol';

  async checkHealth(): Promise<{ segvol_available: boolean; device?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        return { segvol_available: false };
      }
      const data = await response.json();
      return { 
        segvol_available: data.status === 'healthy',
        device: data.device 
      };
    } catch (error) {
      log.error(`SegVol health check failed: ${error}`, 'segvol-tumor');
      return { segvol_available: false };
    }
  }

  async segmentFromScribbles({
    volume,
    scribbles,
    spacing
  }: {
    volume: number[][][];
    scribbles: ScribblePrompt[];
    spacing: [number, number, number];
  }): Promise<{
    mask: number[][][];
    confidence: number;
  }> {
    try {
      // Convert scribbles to point prompts for SegVol
      // Strategy: Sample points along each scribble path
      const pointPrompts: Array<{ coords: [number, number, number]; label: number }> = [];
      
      for (const scribble of scribbles) {
        const sampledPoints = this.samplePointsFromScribble(scribble.points, 5); // Sample 5 points per scribble
        
        for (const [x, y] of sampledPoints) {
          pointPrompts.push({
            coords: [scribble.slice, y, x],  // SegVol expects [z, y, x]
            label: scribble.label
          });
        }
      }

      log.debug(`Converted ${scribbles.length} scribbles to ${pointPrompts.length} point prompts`, 'segvol-tumor');

      // Prepare request
      const requestData = {
        volume: volume,
        point_prompts: pointPrompts,
        box_prompt: null,  // Could compute bounding box from scribbles if needed
        modality: 'CT',  // Assume CT for now
        spacing: spacing,
        use_zoom: true,  // Enable zooming for better accuracy
        point_prompt_group: true  // Treat all points as one object
      };

      const response = await fetch(`${this.baseUrl}/segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SegVol segmentation failed: ${error}`);
      }

      const result: SegVolResponse = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        mask: result.prediction,
        confidence: result.confidence || 0.85
      };

    } catch (error) {
      log.error(`SegVol segmentation error: ${error}`, 'segvol-tumor');
      throw error;
    }
  }

  private samplePointsFromScribble(points: Array<[number, number]>, numSamples: number): Array<[number, number]> {
    if (points.length === 0) return [];
    if (points.length <= numSamples) return points;

    // Sample evenly along the scribble path
    const sampled: Array<[number, number]> = [];
    const step = (points.length - 1) / (numSamples - 1);
    
    for (let i = 0; i < numSamples; i++) {
      const index = Math.round(i * step);
      sampled.push(points[index]);
    }

    return sampled;
  }
}

export const segvolTumorClient = new SegVolTumorClient();



