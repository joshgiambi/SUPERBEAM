/**
 * SAM API - Single-click interactive segmentation
 * Proxies requests to Python SAM (Segment Anything Model) service
 * 
 * Note: This replaces SuperSeg. SAM works on ALL image types.
 * SuperSeg only worked on brain MRI FLAIR.
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import { logger } from './logger.ts';

const router = express.Router();

// Track if we're currently starting the SAM service
let samStarting = false;

// SAM service configuration (same port as old SuperSeg)
const SAM_SERVICE_URL = process.env.SAM_SERVICE_URL || process.env.SUPERSEG_SERVICE_URL || 'http://127.0.0.1:5003';

/**
 * Health check for SAM service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${SAM_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    res.json(response.data);
  } catch (error: any) {
    logger.error('🔬 SAM health check failed:', error.message);
    res.status(503).json({
      status: 'error',
      message: 'SAM service unavailable. Start with: ./start-superseg.sh',
      error: error.message,
      starting: samStarting,
    });
  }
});

/**
 * Start the SAM service (if not already running)
 */
router.post('/start', async (req: Request, res: Response) => {
  // First check if already running
  // Note: SAM service can return 'ready' or 'healthy' status
  try {
    const healthCheck = await axios.get(`${SAM_SERVICE_URL}/health`, { timeout: 2000 });
    if (healthCheck.data?.status === 'healthy' || healthCheck.data?.status === 'ready') {
      return res.json({ 
        status: 'already_running', 
        message: 'SAM service is already running',
        device: healthCheck.data.device,
      });
    }
  } catch {
    // Not running, proceed to start
  }

  if (samStarting) {
    return res.json({ 
      status: 'starting', 
      message: 'SAM service is already starting...' 
    });
  }

  samStarting = true;
  logger.info('🔬 Starting SAM service...');

  try {
    // Get the project root directory (parent of server/)
    const projectRoot = path.resolve(__dirname, '..');
    const startScript = path.join(projectRoot, 'start-superseg.sh');

    logger.info(`🔬 Running: ${startScript} --force`);

    // Spawn the start script in background with --force flag for non-interactive mode
    const child = spawn('bash', [startScript, '--force'], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
    });

    child.unref(); // Allow parent to exit independently

    // Wait a bit and check if it started
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Poll for health up to 60 seconds
    // Note: SAM service can return 'ready' or 'healthy' status
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      try {
        const healthCheck = await axios.get(`${SAM_SERVICE_URL}/health`, { timeout: 2000 });
        if (healthCheck.data?.status === 'healthy' || healthCheck.data?.status === 'ready') {
          samStarting = false;
          logger.info('🔬 ✅ SAM service started successfully');
          return res.json({ 
            status: 'started', 
            message: 'SAM service started successfully',
            device: healthCheck.data.device,
          });
        }
      } catch {
        // Not ready yet
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    samStarting = false;
    logger.error('🔬 SAM service failed to start within timeout');
    res.status(500).json({ 
      status: 'timeout', 
      message: 'SAM service did not start within 60 seconds. Check server logs.' 
    });

  } catch (error: any) {
    samStarting = false;
    logger.error('🔬 Failed to start SAM service:', error.message);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

/**
 * Segment 2D slice with single click point
 * This is the primary endpoint for interactive segmentation.
 * 
 * Request body:
 * {
 *   image: number[][],           // 2D image (H, W)
 *   click_point: [y, x],         // Click coordinates
 *   window_center?: number,      // Optional windowing
 *   window_width?: number        // Optional windowing
 * }
 * 
 * Response:
 * {
 *   mask: number[][],            // 2D binary mask
 *   contour: [x, y][],           // Contour points
 *   confidence: number,          // Confidence score
 *   num_pixels: number           // Number of segmented pixels
 * }
 */
router.post('/segment_2d', async (req: Request, res: Response) => {
  try {
    const { image, click_point, click_points, point_labels, window_center, window_width } = req.body;

    // Support both single-point and multi-point modes
    const hasClickPoint = click_point && Array.isArray(click_point);
    const hasClickPoints = click_points && Array.isArray(click_points) && click_points.length > 0;
    
    if (!image || (!hasClickPoint && !hasClickPoints)) {
      return res.status(400).json({
        error: 'Missing required fields: image, and either click_point or click_points',
      });
    }

    // Forward to Python SAM service - only include fields that exist
    const requestBody: any = { image };
    if (window_center !== undefined) requestBody.window_center = window_center;
    if (window_width !== undefined) requestBody.window_width = window_width;
    
    if (hasClickPoints) {
      requestBody.click_points = click_points;
      if (point_labels) requestBody.point_labels = point_labels;
    } else if (hasClickPoint) {
      requestBody.click_point = click_point;
    }
    
    const response = await axios.post(
      `${SAM_SERVICE_URL}/segment_2d`,
      requestBody,
      {
        timeout: 30000, // 30 second timeout for 2D segmentation
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    res.json(response.data);
  } catch (error: any) {
    logger.error('🔬 SAM 2D segmentation failed:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data?.error || 'Segmentation failed',
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'SAM service is not running. Start it with: ./start-superseg.sh',
      });
    } else {
      res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  }
});

/**
 * Segment 3D volume with single click point (with propagation)
 * 
 * Request body:
 * {
 *   volume: number[][][],        // 3D volume
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
    const { volume, click_point, spacing, slice_axis, window_center, window_width, mode } = req.body;

    if (!volume || !click_point) {
      return res.status(400).json({
        error: 'Missing required fields: volume, click_point',
      });
    }

    // Forward to Python SAM service
    const response = await axios.post(
      `${SAM_SERVICE_URL}/segment`,
      {
        volume,
        click_point,
        spacing,
        slice_axis: slice_axis || 'last',
        window_center,
        window_width,
        mode: mode || '3d',
      },
      {
        timeout: 120000, // 120 second timeout for 3D segmentation
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    res.json(response.data);
  } catch (error: any) {
    logger.error('🔬 SAM 3D segmentation failed:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data?.error || 'Segmentation failed',
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'SAM service is not running. Start it with: ./start-superseg.sh',
      });
    } else {
      res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  }
});

export default router;










