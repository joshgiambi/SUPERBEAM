/**
 * Registration API Routes
 * 
 * Provides REST endpoints for image registration:
 * - POST /api/registration/start - Start a registration job
 * - GET /api/registration/:jobId - Get job status and result
 * - DELETE /api/registration/:jobId - Cancel a running job
 * - GET /api/registration/defaults - Get default params for modality pair
 */

import { Router, Request, Response, NextFunction } from 'express';
import { 
  startRegistrationJob, 
  getRegistrationJob, 
  getAllRegistrationJobs,
  cancelRegistrationJob,
  getDefaultRegistrationParams,
  RegistrationParams,
  RegistrationAlgorithm,
  RegistrationMetric
} from './registration-service';
import { storage } from '../storage';
import { logger } from '../logger';

const router = Router();

/**
 * POST /api/registration/start
 * Start a new registration job
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      primarySeriesId,
      secondarySeriesId,
      algorithm = 'rigid',
      metric = 'mutual-information',
      maxIterations,
      convergenceThreshold,
      samplingPercentage,
      multiResolutionLevels,
      bsplineGridSpacing,
      bsplineOrder,
      useContourConstraints,
      constraintStructureIds,
      landmarkPairs,
      roiCenter,
      roiSize,
    } = req.body;
    
    if (!primarySeriesId || !secondarySeriesId) {
      return res.status(400).json({ 
        error: 'primarySeriesId and secondarySeriesId are required' 
      });
    }
    
    // Validate series exist
    const [primarySeries, secondarySeries] = await Promise.all([
      storage.getSeries(primarySeriesId),
      storage.getSeries(secondarySeriesId),
    ]);
    
    if (!primarySeries) {
      return res.status(404).json({ error: `Primary series ${primarySeriesId} not found` });
    }
    if (!secondarySeries) {
      return res.status(404).json({ error: `Secondary series ${secondarySeriesId} not found` });
    }
    
    // Validate algorithm
    const validAlgorithms: RegistrationAlgorithm[] = [
      'rigid', 'affine', 'bspline', 'demons', 'contour-based', 'landmark-based'
    ];
    if (!validAlgorithms.includes(algorithm)) {
      return res.status(400).json({ 
        error: `Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}` 
      });
    }
    
    // Validate metric
    const validMetrics: RegistrationMetric[] = [
      'mutual-information', 'normalized-correlation', 'mean-squares'
    ];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({ 
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}` 
      });
    }
    
    const params: RegistrationParams = {
      algorithm,
      metric,
      maxIterations,
      convergenceThreshold,
      samplingPercentage,
      multiResolutionLevels,
      bsplineGridSpacing,
      bsplineOrder,
      useContourConstraints,
      constraintStructureIds,
      landmarkPairs,
      roiCenter,
      roiSize,
    };
    
    logger.info(`Starting ${algorithm} registration: primary=${primarySeriesId}, secondary=${secondarySeriesId}`);
    
    const jobId = await startRegistrationJob(primarySeriesId, secondarySeriesId, params);
    
    res.status(202).json({
      jobId,
      status: 'pending',
      message: 'Registration job started',
      pollUrl: `/api/registration/${jobId}`,
    });
    
  } catch (error) {
    logger.error('Failed to start registration job:', error);
    next(error);
  }
});

/**
 * GET /api/registration/:jobId
 * Get the status and result of a registration job
 */
router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    
    const job = getRegistrationJob(jobId);
    if (!job) {
      return res.status(404).json({ error: `Registration job ${jobId} not found` });
    }
    
    res.json({
      id: job.id,
      status: job.status,
      primarySeriesId: job.primarySeriesId,
      secondarySeriesId: job.secondarySeriesId,
      params: job.params,
      progress: job.progress,
      statusMessage: job.statusMessage,
      result: job.result,
      startTime: job.startTime,
      endTime: job.endTime,
      durationMs: job.endTime && job.startTime ? job.endTime - job.startTime : undefined,
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/registration/:jobId
 * Cancel a running registration job
 */
router.delete('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    
    const job = getRegistrationJob(jobId);
    if (!job) {
      return res.status(404).json({ error: `Registration job ${jobId} not found` });
    }
    
    if (job.status !== 'running' && job.status !== 'pending') {
      return res.status(400).json({ 
        error: `Cannot cancel job in ${job.status} state` 
      });
    }
    
    const cancelled = cancelRegistrationJob(jobId);
    if (cancelled) {
      res.json({ message: 'Registration job cancelled', jobId });
    } else {
      res.status(400).json({ error: 'Failed to cancel job' });
    }
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/registration/defaults/:primaryModality/:secondaryModality
 * Get recommended default parameters for a modality pair
 */
router.get('/defaults/:primaryModality/:secondaryModality', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { primaryModality, secondaryModality } = req.params;
    
    const defaults = getDefaultRegistrationParams(primaryModality, secondaryModality);
    
    res.json({
      primaryModality,
      secondaryModality,
      recommendedParams: defaults,
      description: getAlgorithmDescription(defaults.algorithm || 'rigid'),
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/registration/jobs
 * List all registration jobs (for debugging/monitoring)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = getAllRegistrationJobs();
    
    // Return summary info for each job
    const summary = jobs.map(job => ({
      id: job.id,
      status: job.status,
      primarySeriesId: job.primarySeriesId,
      secondarySeriesId: job.secondarySeriesId,
      algorithm: job.params.algorithm,
      progress: job.progress,
      startTime: job.startTime,
      endTime: job.endTime,
    }));
    
    res.json({ 
      totalJobs: jobs.length,
      jobs: summary,
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Get human-readable description of registration algorithm
 */
function getAlgorithmDescription(algorithm: RegistrationAlgorithm): string {
  const descriptions: Record<RegistrationAlgorithm, string> = {
    'rigid': 'Rigid registration with 6 degrees of freedom (3 translation + 3 rotation). Best for same-patient scans with minimal deformation.',
    'affine': 'Affine registration with 12 degrees of freedom. Includes scaling and shearing. Use when patient positioning differs significantly.',
    'bspline': 'B-spline deformable registration. Handles anatomical changes like weight loss, tumor shrinkage, or breathing motion.',
    'demons': 'Demons deformable registration. Fast optical-flow based method for moderate deformations.',
    'contour-based': 'Structure-guided registration using contour correspondence. Best when matching structures are available.',
    'landmark-based': 'Landmark-based registration using anatomical point pairs. Useful for initializing other algorithms.',
  };
  
  return descriptions[algorithm] || 'Unknown algorithm';
}

export default router;
