/**
 * SAM (Segment Anything Model) Controller
 * 
 * Client-side SAM inference using ONNX Runtime Web.
 * Uses the same SAM-B models as OHIF's @cornerstonejs/ai package.
 * 
 * Two use cases:
 * 1. Next slice prediction - propagate contour from reference to target slice
 * 2. Point to contour - generate contour from a single click point
 */

import * as ort from 'onnxruntime-web';

// SAM model URLs from HuggingFace (same as OHIF uses)
const SAM_MODELS = {
  encoder: {
    url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx',
    size: 180, // MB
  },
  decoder: {
    url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx',
    size: 17, // MB
  },
};

// SAM input image size
const SAM_IMAGE_SIZE = 1024;

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
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;
  private initialized = false;
  private initializing = false;
  private cachedEmbedding: ort.Tensor | null = null;
  private cachedImageHash: string | null = null;
  private loadingCallback: LoadingCallback | null = null;

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
    return this.initialized;
  }

  /**
   * Check if SAM is currently initializing
   */
  isInitializing(): boolean {
    return this.initializing;
  }

  /**
   * Initialize SAM models (downloads ~200MB on first use)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) {
      // Wait for ongoing initialization
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializing = true;

    try {
      console.log('🤖 SAM: Initializing ONNX Runtime...');
      this.loadingCallback?.('Initializing ONNX Runtime', 0);

      // Configure ONNX Runtime for WebAssembly
      ort.env.wasm.numThreads = 4;
      ort.env.wasm.simd = true;

      // Load encoder model
      console.log(`🤖 SAM: Loading encoder model (${SAM_MODELS.encoder.size}MB)...`);
      this.loadingCallback?.('Loading SAM encoder', 10);
      
      const encoderResponse = await fetch(SAM_MODELS.encoder.url);
      if (!encoderResponse.ok) {
        throw new Error(`Failed to fetch encoder: ${encoderResponse.statusText}`);
      }
      const encoderBuffer = await encoderResponse.arrayBuffer();
      this.loadingCallback?.('Creating encoder session', 50);
      this.encoderSession = await ort.InferenceSession.create(encoderBuffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      // Load decoder model
      console.log(`🤖 SAM: Loading decoder model (${SAM_MODELS.decoder.size}MB)...`);
      this.loadingCallback?.('Loading SAM decoder', 60);
      
      const decoderResponse = await fetch(SAM_MODELS.decoder.url);
      if (!decoderResponse.ok) {
        throw new Error(`Failed to fetch decoder: ${decoderResponse.statusText}`);
      }
      const decoderBuffer = await decoderResponse.arrayBuffer();
      this.loadingCallback?.('Creating decoder session', 90);
      this.decoderSession = await ort.InferenceSession.create(decoderBuffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.initialized = true;
      this.loadingCallback?.('SAM ready', 100);
      console.log('✅ SAM: Models loaded and ready');
    } catch (error) {
      console.error('❌ SAM: Failed to initialize:', error);
      this.loadingCallback?.('Failed to load SAM', -1);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Preprocess image for SAM encoder
   */
  private preprocessImage(imageData: SAMImageData): Float32Array {
    const { pixels, width, height } = imageData;
    
    // Normalize to 0-255 range
    let minVal = Infinity, maxVal = -Infinity;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] < minVal) minVal = pixels[i];
      if (pixels[i] > maxVal) maxVal = pixels[i];
    }
    const range = maxVal - minVal || 1;

    // Resize to SAM_IMAGE_SIZE x SAM_IMAGE_SIZE and convert to RGB float tensor
    // SAM expects [1, 3, 1024, 1024] tensor with normalized pixel values
    const output = new Float32Array(3 * SAM_IMAGE_SIZE * SAM_IMAGE_SIZE);
    
    const scaleX = width / SAM_IMAGE_SIZE;
    const scaleY = height / SAM_IMAGE_SIZE;

    for (let y = 0; y < SAM_IMAGE_SIZE; y++) {
      for (let x = 0; x < SAM_IMAGE_SIZE; x++) {
        // Bilinear interpolation
        const srcX = x * scaleX;
        const srcY = y * scaleY;
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, width - 1);
        const y1 = Math.min(y0 + 1, height - 1);
        const dx = srcX - x0;
        const dy = srcY - y0;

        const v00 = pixels[y0 * width + x0];
        const v01 = pixels[y0 * width + x1];
        const v10 = pixels[y1 * width + x0];
        const v11 = pixels[y1 * width + x1];

        const value = v00 * (1 - dx) * (1 - dy) + 
                      v01 * dx * (1 - dy) + 
                      v10 * (1 - dx) * dy + 
                      v11 * dx * dy;

        // Normalize to 0-255 and apply ImageNet normalization
        const normalized = ((value - minVal) / range) * 255;
        
        // ImageNet mean/std normalization (SAM was trained on ImageNet-normalized images)
        const mean = [123.675, 116.28, 103.53];
        const std = [58.395, 57.12, 57.375];
        
        const idx = y * SAM_IMAGE_SIZE + x;
        output[0 * SAM_IMAGE_SIZE * SAM_IMAGE_SIZE + idx] = (normalized - mean[0]) / std[0]; // R
        output[1 * SAM_IMAGE_SIZE * SAM_IMAGE_SIZE + idx] = (normalized - mean[1]) / std[1]; // G
        output[2 * SAM_IMAGE_SIZE * SAM_IMAGE_SIZE + idx] = (normalized - mean[2]) / std[2]; // B
      }
    }

    return output;
  }

  /**
   * Generate image embedding using SAM encoder
   */
  private async getImageEmbedding(imageData: SAMImageData): Promise<ort.Tensor> {
    if (!this.encoderSession) {
      throw new Error('SAM encoder not initialized');
    }

    // Simple hash for caching
    const hash = `${imageData.width}_${imageData.height}_${imageData.pixels[0]}_${imageData.pixels[imageData.pixels.length - 1]}`;
    
    if (this.cachedImageHash === hash && this.cachedEmbedding) {
      console.log('🤖 SAM: Using cached embedding');
      return this.cachedEmbedding;
    }

    console.log('🤖 SAM: Generating image embedding...');
    const preprocessed = this.preprocessImage(imageData);
    const inputTensor = new ort.Tensor('float32', preprocessed, [1, 3, SAM_IMAGE_SIZE, SAM_IMAGE_SIZE]);

    const results = await this.encoderSession.run({ image: inputTensor });
    const embedding = results['image_embeddings'];

    // Cache the embedding
    this.cachedEmbedding = embedding;
    this.cachedImageHash = hash;

    return embedding;
  }

  /**
   * Create mask prompt from reference contour
   */
  private contourToMaskPrompt(contour: Point[], width: number, height: number): Float32Array {
    // Create a low-resolution mask (256x256) as SAM expects
    const maskSize = 256;
    const mask = new Float32Array(maskSize * maskSize);

    if (contour.length < 3) return mask;

    // Scale contour to mask size
    const scaleX = maskSize / width;
    const scaleY = maskSize / height;

    // Fill polygon using scanline algorithm
    const scaledContour = contour.map(p => ({
      x: Math.round(p.x * scaleX),
      y: Math.round(p.y * scaleY),
    }));

    // Simple polygon fill
    for (let y = 0; y < maskSize; y++) {
      const intersections: number[] = [];
      
      for (let i = 0; i < scaledContour.length; i++) {
        const p1 = scaledContour[i];
        const p2 = scaledContour[(i + 1) % scaledContour.length];
        
        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const x = p1.x + (y - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
          intersections.push(x);
        }
      }
      
      intersections.sort((a, b) => a - b);
      
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const x1 = Math.max(0, Math.floor(intersections[i]));
        const x2 = Math.min(maskSize - 1, Math.ceil(intersections[i + 1]));
        for (let x = x1; x <= x2; x++) {
          mask[y * maskSize + x] = 1.0;
        }
      }
    }

    return mask;
  }

  /**
   * Get centroid and bounding box of contour
   */
  private getContourProperties(contour: Point[]): { centroid: Point; bbox: [number, number, number, number] } {
    let sumX = 0, sumY = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const p of contour) {
      sumX += p.x;
      sumY += p.y;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return {
      centroid: { x: sumX / contour.length, y: sumY / contour.length },
      bbox: [minX, minY, maxX, maxY],
    };
  }

  /**
   * Convert binary mask to contour points
   */
  private maskToContour(mask: Uint8Array, width: number, height: number): Point[] {
    // Find contour using simple edge detection
    const contour: Point[] = [];
    const visited = new Set<string>();

    // Find first edge pixel
    let startX = -1, startY = -1;
    outer: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] > 0) {
          // Check if it's an edge pixel
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
              mask[y * width + x - 1] === 0 || mask[y * width + x + 1] === 0 ||
              mask[(y - 1) * width + x] === 0 || mask[(y + 1) * width + x] === 0) {
            startX = x;
            startY = y;
            break outer;
          }
        }
      }
    }

    if (startX < 0) return contour;

    // Trace contour using Moore neighborhood
    const directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1],
    ];

    let x = startX, y = startY;
    let dir = 0;
    let maxIterations = width * height;
    let iterations = 0;

    do {
      const key = `${x},${y}`;
      if (!visited.has(key)) {
        contour.push({ x, y });
        visited.add(key);
      }

      // Find next edge pixel
      let found = false;
      for (let i = 0; i < 8; i++) {
        const nextDir = (dir + i) % 8;
        const nx = x + directions[nextDir][0];
        const ny = y + directions[nextDir][1];

        if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx] > 0) {
          // Check if it's still an edge
          let isEdge = nx === 0 || nx === width - 1 || ny === 0 || ny === height - 1;
          if (!isEdge) {
            for (const [dx, dy] of directions) {
              const checkX = nx + dx, checkY = ny + dy;
              if (checkX >= 0 && checkX < width && checkY >= 0 && checkY < height) {
                if (mask[checkY * width + checkX] === 0) {
                  isEdge = true;
                  break;
                }
              }
            }
          }

          if (isEdge) {
            x = nx;
            y = ny;
            dir = (nextDir + 5) % 8; // Turn back
            found = true;
            break;
          }
        }
      }

      if (!found) break;
      iterations++;
    } while ((x !== startX || y !== startY) && iterations < maxIterations);

    return contour;
  }

  /**
   * Use Case 1: Predict contour on target slice using reference contour
   */
  async predictNextSlice(
    referenceContour: Point[],
    referenceImage: SAMImageData,
    targetImage: SAMImageData
  ): Promise<SAMPredictionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.decoderSession) {
      throw new Error('SAM decoder not initialized');
    }

    console.log('🤖 SAM: Predicting next slice...', {
      initialized: this.initialized,
      hasEncoder: !!this.encoderSession,
      hasDecoder: !!this.decoderSession,
      contourPoints: referenceContour.length,
      imageSize: `${targetImage.width}x${targetImage.height}`,
    });

    // Get embedding for target image
    let embedding;
    try {
      embedding = await this.getImageEmbedding(targetImage);
      console.log('🤖 SAM: Got image embedding');
    } catch (embeddingError) {
      console.error('🤖 SAM: Failed to get embedding:', embeddingError);
      throw embeddingError;
    }

    // Create mask prompt from reference contour
    const maskPrompt = this.contourToMaskPrompt(referenceContour, referenceImage.width, referenceImage.height);

    // Get properties for point prompt
    const { centroid, bbox } = this.getContourProperties(referenceContour);

    // Scale to SAM coordinate space
    const scaleX = SAM_IMAGE_SIZE / targetImage.width;
    const scaleY = SAM_IMAGE_SIZE / targetImage.height;

    // Create point prompt (centroid)
    const pointCoords = new Float32Array([centroid.x * scaleX, centroid.y * scaleY]);
    const pointLabels = new Float32Array([1]); // Positive point

    // Create box prompt (bounding box)
    const boxPrompt = new Float32Array([
      bbox[0] * scaleX, bbox[1] * scaleY,
      bbox[2] * scaleX, bbox[3] * scaleY,
    ]);

    // Run decoder
    console.log('🤖 SAM: Preparing decoder inputs...', {
      centroid,
      bbox,
      scaleX,
      scaleY,
    });

    const decoderInputs: Record<string, ort.Tensor> = {
      image_embeddings: embedding,
      point_coords: new ort.Tensor('float32', pointCoords, [1, 1, 2]),
      point_labels: new ort.Tensor('float32', pointLabels, [1, 1]),
      mask_input: new ort.Tensor('float32', maskPrompt, [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', new Float32Array([1]), [1]),
      orig_im_size: new ort.Tensor('float32', new Float32Array([targetImage.height, targetImage.width]), [2]),
    };

    console.log('🤖 SAM: Running decoder...');
    let results;
    try {
      results = await this.decoderSession.run(decoderInputs);
      console.log('🤖 SAM: Decoder completed, outputs:', Object.keys(results));
    } catch (decoderError) {
      console.error('🤖 SAM: Decoder failed:', decoderError);
      throw decoderError;
    }
    
    const masks = results['masks'];
    const scores = results['iou_predictions'];
    
    if (!masks || !scores) {
      console.error('🤖 SAM: Missing expected outputs. Available:', Object.keys(results));
      throw new Error('SAM decoder returned unexpected outputs');
    }

    // Get best mask (highest IoU score)
    const scoresData = scores.data as Float32Array;
    let bestIdx = 0;
    let bestScore = scoresData[0];
    for (let i = 1; i < scoresData.length; i++) {
      if (scoresData[i] > bestScore) {
        bestScore = scoresData[i];
        bestIdx = i;
      }
    }

    // Extract mask
    const maskData = masks.data as Float32Array;
    const maskHeight = masks.dims[2];
    const maskWidth = masks.dims[3];
    const maskOffset = bestIdx * maskHeight * maskWidth;
    
    const binaryMask = new Uint8Array(targetImage.width * targetImage.height);
    
    // Resize mask to original image size
    const mScaleX = maskWidth / targetImage.width;
    const mScaleY = maskHeight / targetImage.height;
    
    for (let y = 0; y < targetImage.height; y++) {
      for (let x = 0; x < targetImage.width; x++) {
        const mx = Math.floor(x * mScaleX);
        const my = Math.floor(y * mScaleY);
        const value = maskData[maskOffset + my * maskWidth + mx];
        binaryMask[y * targetImage.width + x] = value > 0 ? 255 : 0;
      }
    }

    // Convert mask to contour
    const contour = this.maskToContour(binaryMask, targetImage.width, targetImage.height);

    console.log(`🤖 SAM: Prediction complete, confidence=${bestScore.toFixed(3)}, contour points=${contour.length}`);

    return {
      contour,
      mask: binaryMask,
      confidence: bestScore,
      width: targetImage.width,
      height: targetImage.height,
    };
  }

  /**
   * Use Case 2: Generate contour from a single click point
   */
  async pointToContour(
    clickPoint: Point,
    imageData: SAMImageData
  ): Promise<SAMPredictionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.decoderSession) {
      throw new Error('SAM decoder not initialized');
    }

    console.log('🤖 SAM: Generating contour from point...');

    // Get embedding for image
    const embedding = await this.getImageEmbedding(imageData);

    // Scale point to SAM coordinate space
    const scaleX = SAM_IMAGE_SIZE / imageData.width;
    const scaleY = SAM_IMAGE_SIZE / imageData.height;

    const pointCoords = new Float32Array([clickPoint.x * scaleX, clickPoint.y * scaleY]);
    const pointLabels = new Float32Array([1]); // Positive point

    // Run decoder with just point prompt (no mask)
    const decoderInputs: Record<string, ort.Tensor> = {
      image_embeddings: embedding,
      point_coords: new ort.Tensor('float32', pointCoords, [1, 1, 2]),
      point_labels: new ort.Tensor('float32', pointLabels, [1, 1]),
      mask_input: new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
      orig_im_size: new ort.Tensor('float32', new Float32Array([imageData.height, imageData.width]), [2]),
    };

    const results = await this.decoderSession.run(decoderInputs);
    const masks = results['masks'];
    const scores = results['iou_predictions'];

    // Get best mask
    const scoresData = scores.data as Float32Array;
    let bestIdx = 0;
    let bestScore = scoresData[0];
    for (let i = 1; i < scoresData.length; i++) {
      if (scoresData[i] > bestScore) {
        bestScore = scoresData[i];
        bestIdx = i;
      }
    }

    // Extract and resize mask
    const maskData = masks.data as Float32Array;
    const maskHeight = masks.dims[2];
    const maskWidth = masks.dims[3];
    const maskOffset = bestIdx * maskHeight * maskWidth;
    
    const binaryMask = new Uint8Array(imageData.width * imageData.height);
    
    const mScaleX = maskWidth / imageData.width;
    const mScaleY = maskHeight / imageData.height;
    
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const mx = Math.floor(x * mScaleX);
        const my = Math.floor(y * mScaleY);
        const value = maskData[maskOffset + my * maskWidth + mx];
        binaryMask[y * imageData.width + x] = value > 0 ? 255 : 0;
      }
    }

    // Convert mask to contour
    const contour = this.maskToContour(binaryMask, imageData.width, imageData.height);

    console.log(`🤖 SAM: Point-to-contour complete, confidence=${bestScore.toFixed(3)}, contour points=${contour.length}`);

    return {
      contour,
      mask: binaryMask,
      confidence: bestScore,
      width: imageData.width,
      height: imageData.height,
    };
  }

  /**
   * Clear cached embeddings
   */
  clearCache(): void {
    this.cachedEmbedding = null;
    this.cachedImageHash = null;
  }
}

// Export singleton instance
export const samController = new SAMController();

