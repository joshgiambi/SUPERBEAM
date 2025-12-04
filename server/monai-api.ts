/**
 * MONAI API Integration
 * Express routes for communicating with the MONAI propagation service.
 */

import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

const MONAI_SERVICE_URL = process.env.MONAI_SERVICE_URL || 'http://127.0.0.1:5005';
const MONAI_TIMEOUT = parseInt(process.env.MONAI_TIMEOUT || '30000', 10);

interface MonaiPredictionRequest {
  reference_contour: number[][];
  reference_slice_data: number[];
  target_slice_data: number[];
  reference_slice_position: number;
  target_slice_position: number;
  image_shape: [number, number];
  spacing?: [number, number, number];
}

/**
 * Health check
 */
router.get('/monai/health', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${MONAI_SERVICE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`MONAI service returned ${response.status}`);
    }

    const data = await response.json();
    res.json({
      status: 'ok',
      monai_service: data,
      service_url: MONAI_SERVICE_URL,
    });
  } catch (error: any) {
    console.error('MONAI health check failed:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      monai_available: false,
      service_url: MONAI_SERVICE_URL,
    });
  }
});

/**
 * Predict next slice using MONAI
 */
router.post('/monai/predict', async (req: Request, res: Response) => {
  try {
    const requestData: MonaiPredictionRequest = req.body;
    const requiredFields: Array<keyof MonaiPredictionRequest> = [
      'reference_contour',
      'reference_slice_data',
      'target_slice_data',
      'reference_slice_position',
      'target_slice_position',
      'image_shape',
    ];

    for (const field of requiredFields) {
      if (!(field in requestData)) {
        return res.status(400).json({ error: `Missing field: ${field}` });
      }
    }

    const response = await fetch(`${MONAI_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(MONAI_TIMEOUT),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `MONAI service returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('MONAI prediction failed:', error);
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return res.status(504).json({ error: 'MONAI prediction timed out', timeout: MONAI_TIMEOUT });
    }

    res.status(500).json({
      error: error.message || 'Prediction failed',
      fallback_available: true,
    });
  }
});

export default router;
