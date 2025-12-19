/**
 * Standalone SAM (Segment Anything Model) for Browser
 * 
 * This bypasses the Cornerstone viewport integration and runs SAM directly
 * using ONNX Runtime Web. It provides the same functionality as OHIF's
 * implementation but works with any image data.
 * 
 * Based on the @cornerstonejs/ai ONNXSegmentationController approach but
 * decoupled from Cornerstone viewports.
 */

import * as ort from 'onnxruntime-web';

// Types
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

export interface SAMConfig {
  modelName: 'sam_b' | 'sam_l' | 'sam_h';
  modelUrls?: {
    encoder: string;
    decoder: string;
  };
  executionProvider?: 'webgpu' | 'wasm' | 'cpu';
  onProgress?: (stage: string, progress: number) => void;
}

export interface SAMPredictionResult {
  mask: Uint8Array;
  contour: Point[];
  confidence: number;
  width: number;
  height: number;
}

// Local model paths (preferred - faster, no external dependency)
const LOCAL_MODEL_URLS = {
  sam_b: {
    encoder: '/sam/sam_vit_b_encoder.onnx',
    decoder: '/sam/sam_vit_b_decoder.onnx',
  },
  sam_l: {
    encoder: '/sam/sam_vit_l_encoder.onnx',
    decoder: '/sam/sam_vit_l_decoder.onnx',
  },
  sam_h: {
    encoder: '/sam/sam_vit_h_encoder.onnx', 
    decoder: '/sam/sam_vit_h_decoder.onnx',
  },
};

// Fallback to HuggingFace CDN if local models not available
const HUGGINGFACE_MODEL_URLS = {
  sam_b: {
    encoder: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx',
    decoder: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx',
  },
  sam_l: {
    encoder: 'https://huggingface.co/schmuell/sam-l-fp16/resolve/main/sam_vit_l_01ec64.encoder-fp16.onnx',
    decoder: 'https://huggingface.co/schmuell/sam-l-fp16/resolve/main/sam_vit_l_01ec64.decoder.onnx',
  },
  sam_h: {
    encoder: 'https://huggingface.co/schmuell/sam-h-fp16/resolve/main/sam_vit_h_4b8939.encoder-fp16.onnx',
    decoder: 'https://huggingface.co/schmuell/sam-h-fp16/resolve/main/sam_vit_h_4b8939.decoder.onnx',
  },
};

/**
 * Check if a local model file exists by making a HEAD request
 */
async function checkLocalModelExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get model URLs, preferring local files with HuggingFace fallback
 */
async function getModelUrls(modelName: 'sam_b' | 'sam_l' | 'sam_h'): Promise<{ encoder: string; decoder: string }> {
  const localUrls = LOCAL_MODEL_URLS[modelName];
  
  // Check if local encoder exists
  const localEncoderExists = await checkLocalModelExists(localUrls.encoder);
  
  if (localEncoderExists) {
    console.log('🤖 SAM: Using local models from /sam/');
    return localUrls;
  }
  
  console.log('🤖 SAM: Local models not found, using HuggingFace CDN');
  console.log('   💡 Run: node scripts/download-sam-models.js to download local models');
  return HUGGINGFACE_MODEL_URLS[modelName];
}

// SAM model input size
const MODEL_SIZE = 1024;

/**
 * Clone an ONNX tensor (required for reusing embeddings)
 */
function cloneTensor(t: ort.Tensor): ort.Tensor {
  return new ort.Tensor(t.type, Float32Array.from(t.data as Float32Array), t.dims);
}

/**
 * Prepare SAM decoder input feeds
 */
function createDecoderFeed(
  embeddings: ort.Tensor,
  points: number[],
  labels: number[],
  modelSize: [number, number] = [MODEL_SIZE, MODEL_SIZE]
): Record<string, ort.Tensor> {
  const maskInput = new ort.Tensor(
    new Float32Array(256 * 256),
    [1, 1, 256, 256]
  );
  const hasMask = new ort.Tensor(new Float32Array([0]), [1]);
  const originalImageSize = new ort.Tensor(new Float32Array(modelSize), [2]);
  const pointCoords = new ort.Tensor(
    new Float32Array(points),
    [1, points.length / 2, 2]
  );
  const pointLabels = new ort.Tensor(
    new Float32Array(labels),
    [1, labels.length]
  );

  return {
    image_embeddings: cloneTensor(embeddings),
    point_coords: pointCoords,
    point_labels: pointLabels,
    mask_input: maskInput,
    has_mask_input: hasMask,
    orig_im_size: originalImageSize,
  };
}

/**
 * Normalize DICOM pixel data to 0-255 RGB for SAM encoder
 */
function normalizePixelData(
  pixels: Float32Array | Uint16Array | Uint8Array | Int16Array,
  width: number,
  height: number,
  windowCenter?: number,
  windowWidth?: number,
  rescaleSlope: number = 1,
  rescaleIntercept: number = 0
): Float32Array {
  // Apply modality LUT (rescale)
  let min = Infinity;
  let max = -Infinity;
  const rescaled = new Float32Array(pixels.length);
  
  for (let i = 0; i < pixels.length; i++) {
    const value = pixels[i] * rescaleSlope + rescaleIntercept;
    rescaled[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  // Apply VOI LUT (windowing)
  const wc = windowCenter ?? (min + max) / 2;
  const ww = windowWidth ?? ((max - min) || 1);
  const low = wc - ww / 2;
  const high = wc + ww / 2;

  // SAM expects normalized RGB input in NCHW format
  // For grayscale medical images, we replicate to 3 channels
  const normalized = new Float32Array(3 * width * height);
  
  for (let i = 0; i < width * height; i++) {
    // Apply window/level and normalize to 0-255
    let value = rescaled[i];
    value = Math.max(low, Math.min(high, value));
    value = ((value - low) / (high - low)) * 255;
    
    // SAM ImageNet normalization: (x - mean) / std
    // ImageNet means: [123.675, 116.28, 103.53]
    // ImageNet stds: [58.395, 57.12, 57.375]
    const r = (value - 123.675) / 58.395;
    const g = (value - 116.28) / 57.12;
    const b = (value - 103.53) / 57.375;
    
    // NCHW format: channel, height, width
    normalized[i] = r;                        // R channel
    normalized[width * height + i] = g;       // G channel
    normalized[2 * width * height + i] = b;   // B channel
  }

  return normalized;
}

/**
 * Resize image data to model input size using bilinear interpolation
 */
function resizeImage(
  data: Float32Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Float32Array {
  const resized = new Float32Array(3 * dstWidth * dstHeight);
  
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;
  
  for (let c = 0; c < 3; c++) {
    const srcOffset = c * srcWidth * srcHeight;
    const dstOffset = c * dstWidth * dstHeight;
    
    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;
        
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, srcWidth - 1);
        const y1 = Math.min(y0 + 1, srcHeight - 1);
        
        const xLerp = srcX - x0;
        const yLerp = srcY - y0;
        
        const v00 = data[srcOffset + y0 * srcWidth + x0];
        const v01 = data[srcOffset + y0 * srcWidth + x1];
        const v10 = data[srcOffset + y1 * srcWidth + x0];
        const v11 = data[srcOffset + y1 * srcWidth + x1];
        
        const top = v00 * (1 - xLerp) + v01 * xLerp;
        const bottom = v10 * (1 - xLerp) + v11 * xLerp;
        const value = top * (1 - yLerp) + bottom * yLerp;
        
        resized[dstOffset + y * dstWidth + x] = value;
      }
    }
  }
  
  return resized;
}

/**
 * Convert binary mask to contour using Moore-Neighbor tracing
 */
function maskToContour(mask: Uint8Array, width: number, height: number): Point[] {
  // Threshold mask
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    binary[i] = mask[i] > 0.5 ? 1 : 0;
  }

  // Find starting edge pixel
  let startX = -1, startY = -1;
  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binary[y * width + x] === 1) {
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

  if (startX === -1) return [];

  // Moore-Neighbor tracing
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];
  const contour: Point[] = [];
  let x = startX, y = startY;
  let dir = 7;
  const maxIterations = width * height;
  let iterations = 0;

  do {
    contour.push({ x, y });
    let found = false;
    const startDir = (dir + 5) % 8;
    
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

  // Smooth and subsample
  const smoothed = smoothContour(contour, 3);
  if (smoothed.length > 150) {
    const step = Math.ceil(smoothed.length / 100);
    const subsampled: Point[] = [];
    for (let i = 0; i < smoothed.length; i += step) {
      subsampled.push(smoothed[i]);
    }
    return subsampled;
  }
  
  return smoothed;
}

/**
 * Smooth contour using moving average
 */
function smoothContour(contour: Point[], windowSize: number): Point[] {
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
    smoothed.push({ x: sumX / count, y: sumY / count });
  }
  
  return smoothed;
}

/**
 * Convert contour to binary mask
 */
function contourToMask(contour: Point[], width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  if (contour.length < 3) return mask;

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
 * Standalone SAM Model Controller
 */
export class SAMStandalone {
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;
  private config: SAMConfig;
  private initialized = false;
  private initializing = false;
  private cachedEmbeddings: Map<string, ort.Tensor> = new Map();
  
  constructor(config: Partial<SAMConfig> = {}) {
    this.config = {
      modelName: config.modelName || 'sam_b',
      executionProvider: config.executionProvider || 'wasm',
      onProgress: config.onProgress,
      modelUrls: config.modelUrls,
    };
  }

  /**
   * Check if SAM is ready for inference
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Check if SAM is currently loading
   */
  isInitializing(): boolean {
    return this.initializing;
  }

  /**
   * Initialize SAM by loading ONNX models
   */
  async initialize(): Promise<void> {
    if (this.initialized || this.initializing) return;
    
    this.initializing = true;
    this.config.onProgress?.('Initializing ONNX Runtime...', 5);

    try {
      // Configure ONNX Runtime
      ort.env.wasm.wasmPaths = '/ort/';
      
      // Try to use WebGPU if available, fall back to WASM
      let executionProviders: ort.InferenceSession.ExecutionProviderConfig[];
      
      if (this.config.executionProvider === 'webgpu') {
        try {
          // Check if WebGPU is available
          const gpu = (navigator as any).gpu;
          if (gpu) {
            const adapter = await gpu.requestAdapter();
            if (adapter) {
              executionProviders = ['webgpu', 'wasm'];
              console.log('🤖 SAM: Using WebGPU acceleration');
            } else {
              executionProviders = ['wasm'];
              console.log('🤖 SAM: WebGPU adapter not available, using WASM');
            }
          } else {
            executionProviders = ['wasm'];
            console.log('🤖 SAM: WebGPU not available, using WASM');
          }
        } catch {
          executionProviders = ['wasm'];
          console.log('🤖 SAM: WebGPU check failed, using WASM');
        }
      } else {
        executionProviders = ['wasm'];
      }

      // Get model URLs (prefer local, fallback to HuggingFace)
      const urls = this.config.modelUrls || await getModelUrls(this.config.modelName);
      
      // Load encoder model
      this.config.onProgress?.('Downloading SAM encoder (~180MB)...', 10);
      console.log('🤖 SAM: Loading encoder from', urls.encoder);
      
      const encoderResponse = await this.fetchWithProgress(urls.encoder, (progress) => {
        this.config.onProgress?.(`Downloading encoder: ${Math.round(progress * 100)}%`, 10 + progress * 40);
      });
      
      this.config.onProgress?.('Initializing encoder...', 55);
      this.encoderSession = await ort.InferenceSession.create(encoderResponse, {
        executionProviders,
        graphOptimizationLevel: 'all',
      });
      
      // Load decoder model
      this.config.onProgress?.('Downloading SAM decoder (~17MB)...', 60);
      console.log('🤖 SAM: Loading decoder from', urls.decoder);
      
      const decoderResponse = await this.fetchWithProgress(urls.decoder, (progress) => {
        this.config.onProgress?.(`Downloading decoder: ${Math.round(progress * 100)}%`, 60 + progress * 30);
      });
      
      this.config.onProgress?.('Initializing decoder...', 95);
      this.decoderSession = await ort.InferenceSession.create(decoderResponse, {
        executionProviders,
        graphOptimizationLevel: 'all',
      });

      this.initialized = true;
      this.config.onProgress?.('SAM ready!', 100);
      console.log('✅ SAM: Standalone model loaded and ready');
      
    } catch (error) {
      console.error('❌ SAM: Failed to initialize:', error);
      this.config.onProgress?.('SAM initialization failed', -1);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Fetch with progress tracking
   */
  private async fetchWithProgress(
    url: string,
    onProgress?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (!total || !response.body) {
      return response.arrayBuffer();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      received += value.length;
      onProgress?.(received / total);
    }

    const arrayBuffer = new Uint8Array(received);
    let position = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(chunk, position);
      position += chunk.length;
    }

    return arrayBuffer.buffer;
  }

  /**
   * Encode an image and cache the embeddings
   */
  async encodeImage(
    imageData: SAMImageData,
    cacheKey?: string
  ): Promise<ort.Tensor> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check cache first
    if (cacheKey && this.cachedEmbeddings.has(cacheKey)) {
      console.log('🤖 SAM: Using cached embeddings for', cacheKey);
      return this.cachedEmbeddings.get(cacheKey)!;
    }

    console.log('🤖 SAM: Encoding image...', {
      width: imageData.width,
      height: imageData.height,
    });

    // Normalize and resize image
    const normalized = normalizePixelData(
      imageData.pixels,
      imageData.width,
      imageData.height,
      imageData.windowCenter,
      imageData.windowWidth,
      imageData.rescaleSlope,
      imageData.rescaleIntercept
    );

    // Resize to model input size if needed
    let input = normalized;
    if (imageData.width !== MODEL_SIZE || imageData.height !== MODEL_SIZE) {
      input = resizeImage(
        normalized,
        imageData.width,
        imageData.height,
        MODEL_SIZE,
        MODEL_SIZE
      );
    }

    // Create input tensor [1, 3, 1024, 1024]
    const inputTensor = new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]);

    // Run encoder - SAM uses 'input_image' as the input name
    const startTime = performance.now();
    const results = await this.encoderSession!.run({
      input_image: inputTensor,
    });
    const elapsed = performance.now() - startTime;
    console.log(`🤖 SAM: Encoder completed in ${elapsed.toFixed(0)}ms`);

    // Get embeddings (different models use different output names)
    const embeddings = results.image_embeddings || results.embeddings;
    
    if (!embeddings) {
      throw new Error('Encoder did not produce embeddings');
    }

    // Cache embeddings
    if (cacheKey) {
      this.cachedEmbeddings.set(cacheKey, embeddings);
    }

    return embeddings;
  }

  /**
   * Segment using point prompts
   */
  async segmentWithPoints(
    embeddings: ort.Tensor,
    includePoints: Point[],
    excludePoints: Point[],
    imageWidth: number,
    imageHeight: number
  ): Promise<SAMPredictionResult> {
    if (!this.initialized) {
      throw new Error('SAM not initialized');
    }

    // Scale points to model coordinates
    const scaleX = MODEL_SIZE / imageWidth;
    const scaleY = MODEL_SIZE / imageHeight;

    // Prepare point arrays (format: [x1, y1, x2, y2, ...])
    const points: number[] = [];
    const labels: number[] = [];

    for (const p of includePoints) {
      points.push(p.x * scaleX, p.y * scaleY);
      labels.push(1); // Include label
    }

    for (const p of excludePoints) {
      points.push(p.x * scaleX, p.y * scaleY);
      labels.push(0); // Exclude label
    }

    // Ensure we have at least one point
    if (points.length === 0) {
      return {
        mask: new Uint8Array(imageWidth * imageHeight),
        contour: [],
        confidence: 0,
        width: imageWidth,
        height: imageHeight,
      };
    }

    // Create decoder feed
    const feed = createDecoderFeed(embeddings, points, labels);

    // Run decoder
    const startTime = performance.now();
    const results = await this.decoderSession!.run(feed);
    const elapsed = performance.now() - startTime;
    console.log(`🤖 SAM: Decoder completed in ${elapsed.toFixed(0)}ms`);

    // Get mask output
    const maskOutput = results.masks || results.output;
    if (!maskOutput) {
      throw new Error('Decoder did not produce mask');
    }

    const maskData = maskOutput.data as Float32Array;

    // Process mask (it's MODEL_SIZE x MODEL_SIZE, needs resizing back)
    const mask = this.processMask(maskData, imageWidth, imageHeight);
    const contour = maskToContour(mask, imageWidth, imageHeight);

    // Calculate confidence from mask
    let maskSum = 0;
    for (let i = 0; i < mask.length; i++) {
      maskSum += mask[i];
    }
    const confidence = maskSum > 0 ? 0.85 : 0;

    return {
      mask,
      contour,
      confidence,
      width: imageWidth,
      height: imageHeight,
    };
  }

  /**
   * Process model output mask and resize to original dimensions
   */
  private processMask(
    maskData: Float32Array,
    targetWidth: number,
    targetHeight: number
  ): Uint8Array {
    // Mask is MODEL_SIZE x MODEL_SIZE, need to resize and threshold
    const resized = new Uint8Array(targetWidth * targetHeight);
    const scaleX = MODEL_SIZE / targetWidth;
    const scaleY = MODEL_SIZE / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIdx = srcY * MODEL_SIZE + srcX;
        
        // Threshold at 0 (SAM outputs logits)
        resized[y * targetWidth + x] = maskData[srcIdx] > 0 ? 1 : 0;
      }
    }

    return resized;
  }

  /**
   * Propagate contour to next slice (labelmap assist)
   * Uses existing contour as prompt for new slice
   */
  async propagateContour(
    referenceContour: Point[],
    referenceImage: SAMImageData,
    targetImage: SAMImageData
  ): Promise<SAMPredictionResult> {
    // Encode target image
    const targetEmbeddings = await this.encodeImage(targetImage);

    // Use contour points as include prompts
    // Sample points along the contour (every N points)
    const sampleRate = Math.max(1, Math.floor(referenceContour.length / 10));
    const includePoints: Point[] = [];
    
    for (let i = 0; i < referenceContour.length; i += sampleRate) {
      includePoints.push(referenceContour[i]);
    }

    // Also add centroid as a strong include point
    if (referenceContour.length > 0) {
      let cx = 0, cy = 0;
      for (const p of referenceContour) {
        cx += p.x;
        cy += p.y;
      }
      includePoints.unshift({
        x: cx / referenceContour.length,
        y: cy / referenceContour.length,
      });
    }

    // Run segmentation
    return this.segmentWithPoints(
      targetEmbeddings,
      includePoints,
      [],
      targetImage.width,
      targetImage.height
    );
  }

  /**
   * One-click segmentation (click to segment)
   */
  async clickToSegment(
    clickPoint: Point,
    imageData: SAMImageData,
    cacheKey?: string
  ): Promise<SAMPredictionResult> {
    const embeddings = await this.encodeImage(imageData, cacheKey);
    
    return this.segmentWithPoints(
      embeddings,
      [clickPoint],
      [],
      imageData.width,
      imageData.height
    );
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cachedEmbeddings.clear();
  }

  /**
   * Reset and cleanup
   */
  async dispose(): Promise<void> {
    this.clearCache();
    
    if (this.encoderSession) {
      await this.encoderSession.release();
      this.encoderSession = null;
    }
    
    if (this.decoderSession) {
      await this.decoderSession.release();
      this.decoderSession = null;
    }
    
    this.initialized = false;
  }
}

// Export singleton instance
export const samStandalone = new SAMStandalone({
  modelName: 'sam_b',
  executionProvider: 'wasm', // WebGPU is faster but may not be available
  onProgress: (stage, progress) => {
    console.log(`🤖 SAM: ${stage} (${progress}%)`);
  },
});

// Expose for debugging
(window as any).samStandalone = samStandalone;

