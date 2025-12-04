/**
 * SuperSeg API - Single-click brain tumor segmentation
 * Proxies requests to Python SuperSeg service
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import { logger } from './logger.ts';

const router = express.Router();

// SuperSeg service configuration
const SUPERSEG_SERVICE_URL = process.env.SUPERSEG_SERVICE_URL || 'http://127.0.0.1:5003';

/**
 * Health check for SuperSeg service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${SUPERSEG_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error: any) {
    logger.error('SuperSeg health check failed:', error.message);
    res.status(503).json({
      status: 'error',
      message: 'SuperSeg service unavailable',
      error: error.message,
    });
  }
});

/**
 * Segment tumor from single click point
 * 
 * Request body:
 * {
 *   volume: number[][][],        // 3D MRI volume
 *   click_point: [y, x, z],      // Click coordinates
 *   spacing?: [z, y, x],         // Voxel spacing
 *   slice_axis?: 'first' | 'last' // Which axis is slice dimension
 * }
 * 
 * Response:
 * {
 *   mask: number[][][],          // 3D binary mask
 *   slices_with_tumor: number[], // Slice indices containing tumor
 *   total_voxels: number,        // Total tumor voxels
 *   confidence: number           // Confidence score
 * }
 */
router.post('/segment', async (req: Request, res: Response) => {
  try {
    const { volume, click_point, spacing, slice_axis } = req.body;

    if (!volume || !click_point) {
      return res.status(400).json({
        error: 'Missing required fields: volume, click_point',
      });
    }

    logger.info('🧠 SuperSeg segment request received');
    logger.info(`  Click point: ${JSON.stringify(click_point)}`);
    logger.info(`  Volume shape: ${volume.length}x${volume[0]?.length}x${volume[0]?.[0]?.length}`);

    const startTime = Date.now();

    // Forward to Python service
    const response = await axios.post(
      `${SUPERSEG_SERVICE_URL}/segment`,
      {
        volume,
        click_point,
        spacing,
        slice_axis: slice_axis || 'last',
      },
      {
        timeout: 60000, // 60 second timeout for segmentation
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const duration = Date.now() - startTime;
    logger.info(`✅ SuperSeg segmentation completed in ${duration}ms`);
    logger.info(`  Total voxels: ${response.data.total_voxels}`);
    logger.info(`  Slices: ${response.data.slices_with_tumor?.length || 0}`);

    res.json(response.data);
  } catch (error: any) {
    logger.error('SuperSeg segmentation failed:', error.message);
    
    if (error.response) {
      // Python service returned an error
      res.status(error.response.status).json({
        error: error.response.data?.error || 'Segmentation failed',
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'SuperSeg service is not running. Start it with: ./server/superseg/start-service.sh',
      });
    } else {
      res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  }
});

export default router;



