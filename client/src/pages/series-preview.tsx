import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Loader2,
  Scan,
  Sun,
  Contrast
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { getDicomWorkerManager } from '@/lib/dicom-worker-manager';
import { log } from '@/lib/log';

/**
 * Lightweight Series Preview Page
 * 
 * Opens in a popup window to preview a single series without the full viewer interface.
 * Supports basic pan, zoom, scroll, and window/level adjustments.
 */
export default function SeriesPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const seriesId = urlParams.get('seriesId');
  const studyId = urlParams.get('studyId');
  
  // State
  const [images, setImages] = useState<any[]>([]);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [windowLevel, setWindowLevel] = useState({ windowCenter: 40, windowWidth: 400 });
  const [seriesInfo, setSeriesInfo] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isWindowLeveling, setIsWindowLeveling] = useState(false);
  const [wlStart, setWlStart] = useState({ x: 0, y: 0, wc: 0, ww: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Image cache - stores parsed pixel data by sopInstanceUID
  const imageCacheRef = useRef<Map<string, { data: Int16Array | Uint16Array; width: number; height: number; slope?: number; intercept?: number }>>(new Map());

  // Fetch series info
  const { data: series } = useQuery({
    queryKey: [`/api/series/${seriesId}`],
    queryFn: () => fetch(`/api/series/${seriesId}`).then(res => res.json()),
    enabled: !!seriesId
  });

  // Load images for series
  useEffect(() => {
    if (!seriesId) return;
    
    const loadImages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);
        
        // 1. Fetch image list
        const res = await fetch(`/api/series/${seriesId}/images`);
        const imageList = await res.json();
        
        if (!imageList || imageList.length === 0) {
          setError('No images found for this series');
          setIsLoading(false);
          return;
        }
        
        // Sort by instance number
        imageList.sort((a: any, b: any) => (a.instanceNumber || 0) - (b.instanceNumber || 0));
        setImages(imageList);
        log.debug(`Loaded ${imageList.length} images for preview`, 'series-preview');
        
        // 2. Load middle image first for quick display
        const midIndex = Math.floor(imageList.length / 2);
        setCurrentSlice(midIndex);
        
        const midImage = imageList[midIndex];
        await loadImageData(midImage.sopInstanceUID);
        setLoadingProgress(10);
        
        // 3. Preload a few images around the middle
        const preloadCount = Math.min(5, Math.floor(imageList.length / 4));
        for (let i = 1; i <= preloadCount; i++) {
          const beforeIdx = midIndex - i;
          const afterIdx = midIndex + i;
          
          if (beforeIdx >= 0) {
            await loadImageData(imageList[beforeIdx].sopInstanceUID);
          }
          if (afterIdx < imageList.length) {
            await loadImageData(imageList[afterIdx].sopInstanceUID);
          }
          setLoadingProgress(10 + (i / preloadCount) * 40);
        }
        
        setIsLoading(false);
        setLoadingProgress(100);
        
        // Continue loading rest in background
        loadRemainingImages(imageList, midIndex, preloadCount);
        
      } catch (err) {
        log.error(`Failed to load images: ${err}`, 'series-preview');
        setError(`Failed to load images: ${err}`);
        setIsLoading(false);
      }
    };
    
    loadImages();
  }, [seriesId]);

  // Load remaining images in background
  const loadRemainingImages = async (imageList: any[], midIndex: number, preloadCount: number) => {
    const workerManager = getDicomWorkerManager();
    
    for (let i = 0; i < imageList.length; i++) {
      // Skip already loaded images
      if (Math.abs(i - midIndex) <= preloadCount) continue;
      
      if (!imageCacheRef.current.has(imageList[i].sopInstanceUID)) {
        try {
          await loadImageData(imageList[i].sopInstanceUID);
        } catch (e) {
          // Continue loading other images even if one fails
        }
      }
    }
  };

  // Load single image data
  const loadImageData = async (sopInstanceUID: string) => {
    if (imageCacheRef.current.has(sopInstanceUID)) {
      return imageCacheRef.current.get(sopInstanceUID);
    }
    
    try {
      const response = await fetch(`/api/images/${sopInstanceUID}`);
      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const workerManager = getDicomWorkerManager();
      const parsed = await workerManager.parseDicomImage(arrayBuffer);
      
      if (parsed) {
        imageCacheRef.current.set(sopInstanceUID, parsed);
        return parsed;
      }
    } catch (err) {
      log.error(`Failed to load image ${sopInstanceUID}: ${err}`, 'series-preview');
      throw err;
    }
  };

  // Update series info when loaded
  useEffect(() => {
    if (series) {
      setSeriesInfo(series);
      
      // Set default window/level based on modality
      if (series.modality === 'CT') {
        setWindowLevel({ windowCenter: 40, windowWidth: 400 });
      } else if (series.modality === 'PT') {
        setWindowLevel({ windowCenter: 15000, windowWidth: 30000 });
      } else if (series.modality === 'MR') {
        setWindowLevel({ windowCenter: 500, windowWidth: 1000 });
      }
    }
  }, [series]);

  // Render current slice
  const renderSlice = useCallback(async () => {
    if (!canvasRef.current || images.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const image = images[currentSlice];
    if (!image?.sopInstanceUID) return;
    
    try {
      // Load image data if not cached
      let imageData = imageCacheRef.current.get(image.sopInstanceUID);
      if (!imageData) {
        imageData = await loadImageData(image.sopInstanceUID);
      }
      
      if (!imageData || !imageData.data) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
        return;
      }
      
      const { data: pixelData, width, height, slope = 1, intercept = 0 } = imageData;
      
      // Resize canvas to container
      const container = containerRef.current;
      if (container) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        canvas.style.width = `${container.clientWidth}px`;
        canvas.style.height = `${container.clientHeight}px`;
        ctx.scale(dpr, dpr);
      }
      
      const displayWidth = container?.clientWidth || canvas.width;
      const displayHeight = container?.clientHeight || canvas.height;
      
      // Apply window/level and render to ImageData
      const outputImageData = ctx.createImageData(width, height);
      const { windowCenter, windowWidth } = windowLevel;
      const minVal = windowCenter - windowWidth / 2;
      const maxVal = windowCenter + windowWidth / 2;
      
      for (let i = 0; i < pixelData.length; i++) {
        // Apply rescale slope/intercept (HU conversion for CT)
        let value = pixelData[i] * slope + intercept;
        
        // Apply window/level
        let normalized = ((value - minVal) / (maxVal - minVal)) * 255;
        normalized = Math.max(0, Math.min(255, normalized));
        
        outputImageData.data[i * 4] = normalized;
        outputImageData.data[i * 4 + 1] = normalized;
        outputImageData.data[i * 4 + 2] = normalized;
        outputImageData.data[i * 4 + 3] = 255;
      }
      
      // Create temp canvas for the image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(outputImageData, 0, 0);
      }
      
      // Clear and draw with zoom/pan
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      // Calculate centered position with zoom and pan
      const scale = Math.min(displayWidth / width, displayHeight / height) * zoom;
      const drawWidth = width * scale;
      const drawHeight = height * scale;
      const drawX = (displayWidth - drawWidth) / 2 + pan.x;
      const drawY = (displayHeight - drawHeight) / 2 + pan.y;
      
      ctx.imageSmoothingEnabled = zoom < 2;
      ctx.drawImage(tempCanvas, drawX, drawY, drawWidth, drawHeight);
      
    } catch (err) {
      log.error(`Failed to render slice: ${err}`, 'series-preview');
    }
  }, [currentSlice, images, windowLevel, zoom, pan]);

  // Render on state changes
  useEffect(() => {
    renderSlice();
  }, [renderSlice]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => renderSlice();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderSlice]);

  // Mouse handlers for pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !e.shiftKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y });
    } else if (e.button === 0 && e.shiftKey) {
      setIsWindowLeveling(true);
      setWlStart({ 
        x: e.clientX, 
        y: e.clientY, 
        wc: windowLevel.windowCenter, 
        ww: windowLevel.windowWidth 
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan({ x: dragStart.panX + dx, y: dragStart.panY + dy });
    } else if (isWindowLeveling) {
      const dx = e.clientX - wlStart.x;
      const dy = e.clientY - wlStart.y;
      setWindowLevel({
        windowCenter: wlStart.wc - dy * 2,
        windowWidth: Math.max(1, wlStart.ww + dx * 4)
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsWindowLeveling(false);
  };

  // Scroll handler for slices
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
    } else {
      const delta = e.deltaY > 0 ? 1 : -1;
      setCurrentSlice(prev => Math.max(0, Math.min(images.length - 1, prev + delta)));
    }
  };

  // Reset view
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Get modality color and styling
  const getModalityStyle = (modality: string) => {
    switch (modality) {
      case 'CT': return { bg: 'bg-gradient-to-r from-blue-600 to-blue-500', text: 'text-blue-100', glow: 'shadow-blue-500/30' };
      case 'PT': return { bg: 'bg-gradient-to-r from-amber-600 to-amber-500', text: 'text-amber-100', glow: 'shadow-amber-500/30' };
      case 'MR': return { bg: 'bg-gradient-to-r from-purple-600 to-purple-500', text: 'text-purple-100', glow: 'shadow-purple-500/30' };
      default: return { bg: 'bg-gradient-to-r from-gray-600 to-gray-500', text: 'text-gray-100', glow: 'shadow-gray-500/30' };
    }
  };

  if (!seriesId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Scan className="h-16 w-16 mx-auto mb-4 text-gray-600" />
          <h1 className="text-xl font-bold mb-2">No Series Selected</h1>
          <p className="text-gray-400">Please provide a seriesId parameter</p>
        </div>
      </div>
    );
  }

  const modalityStyle = getModalityStyle(seriesInfo?.modality || 'CT');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col select-none overflow-hidden">
      {/* Compact Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50 shadow-lg">
        <div className="flex items-center gap-3">
          {/* Series Info */}
          {seriesInfo ? (
            <>
              <Badge className={`${modalityStyle.bg} ${modalityStyle.text} font-bold px-2.5 py-1 shadow-lg ${modalityStyle.glow}`}>
                {seriesInfo.modality}
              </Badge>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-100">
                  {seriesInfo.seriesDescription || 'Unnamed Series'}
                </span>
                <span className="text-xs text-gray-400">
                  {images.length} slices
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-400">Loading series info...</span>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(prev => Math.min(10, prev * 1.2))}
            className="h-8 w-8 p-0 hover:bg-white/10 rounded-lg transition-all"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
            className="h-8 w-8 p-0 hover:bg-white/10 rounded-lg transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetView}
            className="h-8 w-8 p-0 hover:bg-white/10 rounded-lg transition-all"
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-5 bg-gray-700 mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.close()}
            className="h-8 w-8 p-0 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all"
            title="Close Preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>
      
      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center z-10">
            <Loader2 className="h-10 w-10 animate-spin text-blue-400 mb-4" />
            <p className="text-gray-300 text-sm mb-2">Loading images...</p>
            <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center z-10">
            <div className="text-red-400 text-lg mb-2">⚠️ Error</div>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        )}
        
        {/* Info overlay - top left */}
        {!isLoading && !error && (
          <div className="absolute top-3 left-3 text-xs bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-700/50 space-y-0.5">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500">Slice:</span>
              <span className="font-mono">{currentSlice + 1} / {images.length}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Sun className="h-3 w-3 text-gray-500" />
              <span className="font-mono">{Math.round(windowLevel.windowCenter)}</span>
              <Contrast className="h-3 w-3 text-gray-500 ml-2" />
              <span className="font-mono">{Math.round(windowLevel.windowWidth)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500">Zoom:</span>
              <span className="font-mono">{(zoom * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
        
        {/* Instructions overlay - bottom left */}
        {!isLoading && !error && (
          <div className="absolute bottom-3 left-3 text-[11px] text-gray-500 bg-black/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-800/50">
            <div className="flex items-center gap-4">
              <span>🖱️ Scroll: Slices</span>
              <span>✋ Drag: Pan</span>
              <span>⇧ Shift+Drag: W/L</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Slider */}
      <div className="px-4 py-3 bg-gray-900/80 backdrop-blur-xl border-t border-gray-700/50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentSlice(prev => Math.max(0, prev - 1))}
            disabled={currentSlice <= 0 || isLoading}
            className="h-8 w-8 p-0 hover:bg-white/10 disabled:opacity-30 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Slider
            value={[currentSlice]}
            onValueChange={(v) => setCurrentSlice(v[0])}
            max={Math.max(0, images.length - 1)}
            step={1}
            disabled={isLoading || images.length === 0}
            className="flex-1"
          />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentSlice(prev => Math.min(images.length - 1, prev + 1))}
            disabled={currentSlice >= images.length - 1 || isLoading}
            className="h-8 w-8 p-0 hover:bg-white/10 disabled:opacity-30 rounded-lg"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <span className="text-xs text-gray-400 w-24 text-right font-mono tabular-nums">
            {currentSlice + 1} / {images.length || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
