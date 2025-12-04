/**
 * MONAI Client API
 * Thin wrapper for the MONAI propagation backend.
 */

export interface MonaiPredictionRequest {
  reference_contour: number[][];
  reference_slice_data: number[];
  target_slice_data: number[];
  reference_slice_position: number;
  target_slice_position: number;
  image_shape: [number, number];
  spacing?: [number, number, number];
}

export interface MonaiPredictionResult {
  predicted_contour: number[][];
  confidence: number;
  method: string;
  metadata?: any;
}

export interface MonaiHealthStatus {
  status: 'ok' | 'error';
  monai_service?: {
    status: string;
    mode: string;
    device: string;
    monai_available: boolean;
  };
  monai_available: boolean;
  service_url: string;
  error?: string;
}

export class MonaiClient {
  private baseUrl: string;
  private timeout: number;
  private available: boolean | null = null;

  constructor(baseUrl: string = '/api', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async checkHealth(): Promise<MonaiHealthStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/monai/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      this.available = data.status === 'ok' && data.monai_service?.status === 'healthy';
      return data;
    } catch (error: any) {
      console.warn('MONAI health check failed:', error);
      this.available = false;
      return {
        status: 'error',
        monai_available: false,
        service_url: '',
        error: error.message,
      };
    }
  }

  async predict(request: MonaiPredictionRequest): Promise<MonaiPredictionResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(`${this.baseUrl}/monai/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (error: any) {
      console.error('MONAI prediction failed:', error);
      if (error.name === 'AbortError') {
        throw new Error('MONAI prediction timed out.');
      }
      throw new Error(`MONAI prediction failed: ${error.message}`);
    }
  }

  getAvailability(): boolean | null {
    return this.available;
  }
}

export const monaiClient = new MonaiClient();
