/**
 * SAM Controller - Now using Standalone ONNX implementation
 * 
 * This replaces the broken @cornerstonejs/ai integration with our own
 * standalone ONNX Runtime Web implementation that works without Cornerstone viewports.
 */

import { samStandalone, type SAMImageData as StandaloneSAMImageData, type Point as StandalonePoint, type SAMPredictionResult as StandaloneSAMResult } from './sam-standalone';

export interface Point {
  x: number;
  y: number;
}

export interface SAMImageData {
  pixels: Float32Array | Uint16Array | Uint8Array | Int16Array;
  width: number;
  height: number;
  windowCenter?: number;
  windowWidth?: number;
  rescaleSlope?: number;
  rescaleIntercept?: number;
}

export interface SAMPredictionResult {
  contour: Point[];
  mask: Uint8Array;
  confidence: number;
  width: number;
  height: number;
}

type LoadingCallback = (stage: string, progress: number) => void;

class SAMOhifController {
  private loadingCallback: LoadingCallback | null = null;

  setLoadingCallback(callback: LoadingCallback | null): void {
    this.loadingCallback = callback;
    // Also set on standalone SAM
    if (callback) {
      // We can't directly set callback on existing instance, but it logs anyway
    }
  }

  isReady(): boolean {
    return samStandalone.isReady();
  }

  isInitializing(): boolean {
    return samStandalone.isInitializing();
  }

  async initialize(): Promise<void> {
    if (samStandalone.isReady()) return;

    console.log('🤖 SAM: Initializing standalone ONNX model...');
    this.loadingCallback?.('Loading SAM models...', 10);

    try {
      await samStandalone.initialize();
      console.log('✅ SAM: Standalone initialization complete');
      this.loadingCallback?.('SAM ready', 100);
    } catch (error: any) {
      console.error('❌ SAM: Standalone initialization failed:', error);
      this.loadingCallback?.('SAM failed', -1);
      throw error;
    }
  }

  /**
   * Predict contour on target slice using reference contour (labelmap assist)
   */
  async predictNextSlice(
    referenceContour: Point[],
    referenceImage: SAMImageData,
    targetImage: SAMImageData
  ): Promise<SAMPredictionResult> {
    if (!samStandalone.isReady()) {
      await this.initialize();
    }

    console.log('🤖 SAM: Propagating contour with standalone SAM...', {
      referencePoints: referenceContour.length,
      targetSize: `${targetImage.width}x${targetImage.height}`,
    });

    // Convert to standalone format
    const standaloneRefImage: StandaloneSAMImageData = {
      pixels: referenceImage.pixels,
      width: referenceImage.width,
      height: referenceImage.height,
      windowCenter: referenceImage.windowCenter,
      windowWidth: referenceImage.windowWidth,
      rescaleSlope: referenceImage.rescaleSlope,
      rescaleIntercept: referenceImage.rescaleIntercept,
    };

    const standaloneTargetImage: StandaloneSAMImageData = {
      pixels: targetImage.pixels,
      width: targetImage.width,
      height: targetImage.height,
      windowCenter: targetImage.windowCenter,
      windowWidth: targetImage.windowWidth,
      rescaleSlope: targetImage.rescaleSlope,
      rescaleIntercept: targetImage.rescaleIntercept,
    };

    // Run propagation
    const result = await samStandalone.propagateContour(
      referenceContour,
      standaloneRefImage,
      standaloneTargetImage
    );

    console.log('🤖 SAM: Propagation result:', {
      contourPoints: result.contour.length,
      confidence: result.confidence,
    });

    return {
      contour: result.contour,
      mask: result.mask,
      confidence: result.confidence,
      width: result.width,
      height: result.height,
    };
  }

  /**
   * One-click segmentation (for AI tumor tool / click-to-segment)
   */
  async clickToSegment(
    clickPoint: Point,
    imageData: SAMImageData,
    cacheKey?: string
  ): Promise<SAMPredictionResult> {
    if (!samStandalone.isReady()) {
      await this.initialize();
    }

    console.log('🤖 SAM: Click-to-segment at', clickPoint);

    const standaloneImage: StandaloneSAMImageData = {
      pixels: imageData.pixels,
      width: imageData.width,
      height: imageData.height,
      windowCenter: imageData.windowCenter,
      windowWidth: imageData.windowWidth,
      rescaleSlope: imageData.rescaleSlope,
      rescaleIntercept: imageData.rescaleIntercept,
    };

    const result = await samStandalone.clickToSegment(
      clickPoint,
      standaloneImage,
      cacheKey
    );

    return {
      contour: result.contour,
      mask: result.mask,
      confidence: result.confidence,
      width: result.width,
      height: result.height,
    };
  }

  /**
   * Segment with multiple include/exclude point prompts
   */
  async segmentWithPrompts(
    includePoints: Point[],
    excludePoints: Point[],
    imageData: SAMImageData,
    cacheKey?: string
  ): Promise<SAMPredictionResult> {
    if (!samStandalone.isReady()) {
      await this.initialize();
    }

    console.log('🤖 SAM: Segment with prompts', {
      includePoints: includePoints.length,
      excludePoints: excludePoints.length,
    });

    const standaloneImage: StandaloneSAMImageData = {
      pixels: imageData.pixels,
      width: imageData.width,
      height: imageData.height,
      windowCenter: imageData.windowCenter,
      windowWidth: imageData.windowWidth,
      rescaleSlope: imageData.rescaleSlope,
      rescaleIntercept: imageData.rescaleIntercept,
    };

    // First encode the image
    const embeddings = await samStandalone.encodeImage(standaloneImage, cacheKey);

    // Then segment with prompts
    const result = await samStandalone.segmentWithPoints(
      embeddings,
      includePoints,
      excludePoints,
      imageData.width,
      imageData.height
    );

    return {
      contour: result.contour,
      mask: result.mask,
      confidence: result.confidence,
      width: result.width,
      height: result.height,
    };
  }

  reset(): void {
    samStandalone.clearCache();
  }

  async checkModelCache(): Promise<{ encoder: boolean; decoder: boolean }> {
    // Models are cached in memory by ONNX Runtime
    return { 
      encoder: samStandalone.isReady(), 
      decoder: samStandalone.isReady() 
    };
  }
}

export const samOhifController = new SAMOhifController();
(window as any).samOhifController = samOhifController;

// Test function
(window as any).testStandaloneSAM = async () => {
  console.log('🧪 Testing Standalone SAM initialization...');
  try {
    await samOhifController.initialize();
    console.log('✅ Standalone SAM ready!');
    return true;
  } catch (e: any) {
    console.error('❌ Standalone SAM failed:', e.message);
    return false;
  }
};

// Keep old test function name for compatibility
(window as any).testOHIFSAM = (window as any).testStandaloneSAM;
