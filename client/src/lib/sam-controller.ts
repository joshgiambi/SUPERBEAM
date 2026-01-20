/**
 * SAM (Segment Anything Model) Controller
 * 
 * Calls the server-side SAM service (server/mem3d/sam_service.py)
 * which runs on port 5002 and uses PyTorch SAM.
 * 
 * This avoids browser WASM memory limits (180MB model too big for browser).
 * 
 * The server-side approach matches how production medical imaging apps
 * handle heavy AI models - they run on the server, not in the browser.
 */

// SAM service URL - proxied through mem3d-api which routes to port 5002
const SAM_SERVICE_URL = '/api/mem3d';

export interface Point {
  x: number;
  y: number;
}

export interface SAMImageData {
  pixels: Float32Array | Uint16Array | Uint8Array | Int16Array;
  width: number;
  height: number;
}

export interface SAMPredictionResult {
  contour: Point[];
  mask: Uint8Array;
  confidence: number;
  width: number;
  height: number;
}

type LoadingCallback = (stage: string, progress: number) => void;

class SAMController {
  private initialized = false;
  private initializing = false;
  private loadingCallback: LoadingCallback | null = null;
  private serviceAvailable = false;

  /**
   * Set a callback for loading progress updates
   */
  setLoadingCallback(callback: LoadingCallback | null): void {
    this.loadingCallback = callback;
  }

  /**
   * Check if SAM is initialized and ready
   */
  isReady(): boolean {
    return this.initialized && this.serviceAvailable;
  }

  /**
   * Check if SAM is currently initializing
   */
  isInitializing(): boolean {
    return this.initializing;
  }

  /**
   * Initialize SAM by checking if the server-side service is available
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) return;

    this.initializing = true;
    this.loadingCallback?.('Checking SAM service...', 10);

    try {
      
      // Check if SAM service is running
      const response = await fetch(`${SAM_SERVICE_URL}/health`);
      
      if (!response.ok) {
        throw new Error(`SAM service not available: ${response.status}`);
      }

      const health = await response.json();

      // The proxy returns { status, mem3d_service: { model_loaded, ... } }
      const modelLoaded = health.model_loaded || health.mem3d_service?.model_loaded;
      if (!modelLoaded) {
        throw new Error('SAM model not loaded on server. Start the SAM service: python server/mem3d/sam_service.py --model-path <path>');
      }

      this.serviceAvailable = true;
      this.initialized = true;
      this.loadingCallback?.('SAM ready', 100);
      
    } catch (error) {
      console.error('❌ SAM: Service check failed:', error);
      this.loadingCallback?.('SAM service unavailable', -1);
      
      // Provide helpful error message
      console.error('');
      console.error('=== SAM SERVICE NOT RUNNING ===');
      console.error('Start the SAM service with:');
      console.error('  cd server/mem3d && python sam_service.py --model-path ./medsam_vit_b.pth');
      console.error('');
      console.error('Or download the model first:');
      console.error('  python download_medsam.py');
      console.error('================================');
      
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Convert contour to binary mask
   */
  private contourToMask(contour: Point[], width: number, height: number): Uint8Array {
    const mask = new Uint8Array(width * height);
    
    if (contour.length < 3) return mask;

    // Simple scanline fill algorithm
    for (let y = 0; y < height; y++) {
      const intersections: number[] = [];
      
      for (let i = 0; i < contour.length; i++) {
        const p1 = contour[i];
        const p2 = contour[(i + 1) % contour.length];
        
        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const x = p1.x + (y - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
          intersections.push(x);
        }
      }
      
      intersections.sort((a, b) => a - b);
      
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const xStart = Math.max(0, Math.floor(intersections[i]));
        const xEnd = Math.min(width - 1, Math.ceil(intersections[i + 1]));
        
        for (let x = xStart; x <= xEnd; x++) {
          mask[y * width + x] = 1;
        }
      }
    }
    
    return mask;
  }

  /**
   * Convert binary mask to contour points using Moore-Neighbor tracing
   */
  private maskToContour(mask: Uint8Array, width: number, height: number): Point[] {
    // First, threshold the mask - values might be 0-255 or floats
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      binary[i] = mask[i] > 0.5 ? 1 : 0;
    }
    
    // Find the first foreground pixel (starting point)
    let startX = -1, startY = -1;
    outer: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binary[y * width + x] === 1) {
          // Check if it's an edge pixel (has at least one background neighbor)
          const hasBackgroundNeighbor = 
            x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
            binary[y * width + x - 1] === 0 ||
            binary[y * width + x + 1] === 0 ||
            binary[(y - 1) * width + x] === 0 ||
            binary[(y + 1) * width + x] === 0;
          
          if (hasBackgroundNeighbor) {
            startX = x;
            startY = y;
            break outer;
          }
        }
      }
    }
    
    if (startX === -1) {
      console.warn('🤖 SAM: No edge pixels found in mask');
      return [];
    }
    
    // Moore-Neighbor tracing (8-connected boundary tracing)
    // Direction: 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
    const dx = [1, 1, 0, -1, -1, -1, 0, 1];
    const dy = [0, 1, 1, 1, 0, -1, -1, -1];
    
    const contour: Point[] = [];
    let x = startX, y = startY;
    let dir = 7; // Start looking from NE (clockwise from where we came)
    
    const maxIterations = width * height;
    let iterations = 0;
    
    do {
      contour.push({ x, y });
      
      // Find next boundary pixel by checking neighbors clockwise
      let found = false;
      const startDir = (dir + 5) % 8; // Start from 3 positions CCW of current direction
      
      for (let i = 0; i < 8; i++) {
        const checkDir = (startDir + i) % 8;
        const nx = x + dx[checkDir];
        const ny = y + dy[checkDir];
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (binary[ny * width + nx] === 1) {
            x = nx;
            y = ny;
            dir = checkDir;
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      iterations++;
      
    } while ((x !== startX || y !== startY) && iterations < maxIterations);
    
    // Apply Gaussian smoothing to reduce jaggedness
    const smoothed = this.smoothContour(contour, 3);
    
    // Subsample if too many points
    let result = smoothed;
    if (result.length > 150) {
      const step = Math.ceil(result.length / 100);
      const subsampled: Point[] = [];
      for (let i = 0; i < result.length; i += step) {
        subsampled.push(result[i]);
      }
      result = subsampled;
    }
    
    return result;
  }
  
  /**
   * Smooth contour using moving average
   */
  private smoothContour(contour: Point[], windowSize: number): Point[] {
    if (contour.length < windowSize * 2) return contour;
    
    const smoothed: Point[] = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < contour.length; i++) {
      let sumX = 0, sumY = 0, count = 0;
      
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const idx = (i + j + contour.length) % contour.length;
        sumX += contour[idx].x;
        sumY += contour[idx].y;
        count++;
      }
      
      smoothed.push({
        x: sumX / count,
        y: sumY / count,
      });
    }
    
    return smoothed;
  }

  /**
   * Predict contour on target slice using reference contour
   */
  async predictNextSlice(
    referenceContour: Point[],
    referenceImage: SAMImageData,
    targetImage: SAMImageData
  ): Promise<SAMPredictionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.serviceAvailable) {
      throw new Error('SAM service not available');
    }


    // Convert reference contour to mask
    const referenceMask = this.contourToMask(
      referenceContour,
      referenceImage.width,
      referenceImage.height
    );
    
    // Debug: check reference mask
    let refMaskSum = 0;
    for (let i = 0; i < referenceMask.length; i++) {
      refMaskSum += referenceMask[i];
    }

    // Prepare request data
    const requestData = {
      reference_slices: [{
        slice_data: Array.from(referenceImage.pixels),
        mask: Array.from(referenceMask),
        position: 0,
      }],
      target_slice_data: Array.from(targetImage.pixels),
      target_slice_position: 1,
      image_shape: [targetImage.height, targetImage.width],
    };


    const response = await fetch(`${SAM_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SAM prediction failed: ${error}`);
    }

    const result = await response.json();
    
    // Debug: analyze the mask data (avoid stack overflow with large arrays)
    const maskArray = result.predicted_mask as number[] || [];
    let maskSum = 0, maskMin = Infinity, maskMax = -Infinity, nonZeroCount = 0;
    for (let i = 0; i < maskArray.length; i++) {
      const v = maskArray[i];
      maskSum += v;
      if (v < maskMin) maskMin = v;
      if (v > maskMax) maskMax = v;
      if (v > 0) nonZeroCount++;
    }
    if (maskArray.length === 0) { maskMin = 0; maskMax = 0; }
    

    // Convert mask array to Uint8Array
    const maskData = new Uint8Array(result.predicted_mask);
    
    // Convert mask to contour
    const contour = this.maskToContour(maskData, targetImage.width, targetImage.height);

    return {
      contour,
      mask: maskData,
      confidence: result.confidence || 0.8,
      width: targetImage.width,
      height: targetImage.height,
    };
  }

  /**
   * Generate contour from a single click point (for AI tumor tool)
   */
  async pointToContour(
    clickPoint: Point,
    imageData: SAMImageData
  ): Promise<SAMPredictionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.serviceAvailable) {
      throw new Error('SAM service not available');
    }


    // Create a small reference mask around the click point
    const referenceMask = new Uint8Array(imageData.width * imageData.height);
    const radius = 5;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = Math.round(clickPoint.x) + dx;
        const y = Math.round(clickPoint.y) + dy;
        if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
          if (dx * dx + dy * dy <= radius * radius) {
            referenceMask[y * imageData.width + x] = 1;
          }
        }
      }
    }

    // Prepare request data
    const requestData = {
      reference_slices: [{
        slice_data: Array.from(imageData.pixels),
        mask: Array.from(referenceMask),
        position: 0,
      }],
      target_slice_data: Array.from(imageData.pixels),
      target_slice_position: 0,
      image_shape: [imageData.height, imageData.width],
    };

    const response = await fetch(`${SAM_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SAM point-to-contour failed: ${error}`);
    }

    const result = await response.json();

    // Convert mask array to Uint8Array
    const maskData = new Uint8Array(result.predicted_mask);
    
    // Convert mask to contour
    const contour = this.maskToContour(maskData, imageData.width, imageData.height);

    return {
      contour,
      mask: maskData,
      confidence: result.confidence || 0.8,
      width: imageData.width,
      height: imageData.height,
    };
  }

  /**
   * Reset the controller (for debugging)
   */
  reset(): void {
    this.initialized = false;
    this.serviceAvailable = false;
  }

  /**
   * Check if models are cached (always false for server-side)
   */
  async checkModelCache(): Promise<{ encoder: boolean; decoder: boolean }> {
    // Server-side doesn't use browser cache
    return { encoder: false, decoder: false };
  }
}

// Export singleton instance
export const samController = new SAMController();

// Expose for debugging
(window as any).samController = samController;
