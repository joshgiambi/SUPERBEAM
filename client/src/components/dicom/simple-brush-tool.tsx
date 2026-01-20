import React, { useRef, useEffect, useState, useCallback } from "react";
import { canvasToWorld } from "@/lib/dicom-coordinates";
import { createAdaptivePreview } from "@/lib/smart-brush-utils";
import { combineContours } from "@/lib/clipper-boolean-operations";
import { log } from '@/lib/log';
import { useContourEditSafe, type ActiveDrawingPoint } from '@/contexts/contour-edit-context';

/**
 * Check if a canvas point is inside a predicted contour
 */
function isPointInPrediction(
  canvasX: number,
  canvasY: number,
  predictionContour: number[],
  imageMetadata: any,
  ctTransform: { scale: number; offsetX: number; offsetY: number }
): boolean {
  if (!predictionContour || predictionContour.length < 9) return false;
  if (!imageMetadata) return false;
  
  // Convert prediction world coords to canvas coords
  const [imagePositionX, imagePositionY] = imageMetadata.imagePosition.split("\\").map(parseFloat);
  const [rowSpacing, colSpacing] = imageMetadata.pixelSpacing.split("\\").map(parseFloat);
  
  const canvasPoints: [number, number][] = [];
  for (let i = 0; i < predictionContour.length; i += 3) {
    const worldX = predictionContour[i];
    const worldY = predictionContour[i + 1];
    
    // Convert to pixel
    const pixelX = (worldX - imagePositionX) / colSpacing;
    const pixelY = (worldY - imagePositionY) / rowSpacing;
    
    // Apply CT transform
    const canvasX = pixelX * ctTransform.scale + ctTransform.offsetX;
    const canvasY = pixelY * ctTransform.scale + ctTransform.offsetY;
    
    canvasPoints.push([canvasX, canvasY]);
  }
  
  // Ray casting algorithm for point-in-polygon test
  let inside = false;
  for (let i = 0, j = canvasPoints.length - 1; i < canvasPoints.length; j = i++) {
    const xi = canvasPoints[i][0];
    const yi = canvasPoints[i][1];
    const xj = canvasPoints[j][0];
    const yj = canvasPoints[j][1];
    
    const intersect = ((yi > canvasY) !== (yj > canvasY)) &&
      (canvasX < (xj - xi) * (canvasY - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

interface SimpleBrushToolProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  brushSize: number;
  selectedStructure: number | null;
  rtStructures: any;
  currentSlicePosition: number;
  onContourUpdate: (updatedStructures: any) => void;
  zoom: number;
  panX: number;
  panY: number;
  imageMetadata?: any;
  smoothingEnabled?: boolean;
  enableSmartMode?: boolean;
  onBrushModeChange?: (mode: any) => void;
  predictionEnabled?: boolean;
  smartBrushEnabled?: boolean;
  onBrushSizeChange?: (size: number) => void;
  ctTransform: React.RefObject<{ 
    scale: number; 
    offsetX: number; 
    offsetY: number;
    imageWidth?: number;
    imageHeight?: number;
  }>;
  isEraseMode?: boolean; // New prop for erase mode
  dicomImage?: any; // For accessing pixel data
  onPreviewUpdate?: (previewContours: any[] | null) => void; // New prop for smart brush preview
  activePredictions?: Map<number, any>; // Active predictions for smart click behavior
  /** Unique viewport ID for cross-viewport ghost contour sync */
  viewportId?: string;
}

export function SimpleBrushTool({
  canvasRef,
  isActive,
  brushSize,
  selectedStructure,
  rtStructures,
  currentSlicePosition,
  onContourUpdate,
  zoom,
  panX,
  panY,
  imageMetadata,
  predictionEnabled = false,
  smartBrushEnabled = false,
  onBrushSizeChange,
  ctTransform,
  isEraseMode = false,
  dicomImage = null,
  onPreviewUpdate,
  activePredictions,
  viewportId = 'default-viewport',
}: SimpleBrushToolProps) {
  log.debug(`SimpleBrushTool render: active=${isActive} selected=${selectedStructure} erase=${isEraseMode}`, 'brush');
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false); // Immediate tracking for drawing state
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const brushPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const animationFrameRef = useRef<number | null>(null);
  
  // For smart brush - collect adaptive shapes while drawing
  const adaptiveShapesRef = useRef<Array<{ x: number; y: number }[]>>([]);
  
  // Cross-viewport contour edit context for ghost contours (safe - returns null if no provider)
  const contourEditContext = useContourEditSafe();
  const activeStrokeIdRef = useRef<string | null>(null);
  
  // Shift key detection for temporary erase mode in brush tool
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isTemporaryEraseMode, setIsTemporaryEraseMode] = useState(false);
  
  // Right-click diameter adjustment state
  const [isAdjustingSize, setIsAdjustingSize] = useState(false);
  const [sizeAdjustStart, setSizeAdjustStart] = useState<{ x: number; y: number; size: number } | null>(null);
  const [adjustedBrushSize, setAdjustedBrushSize] = useState(brushSize);
  const sliderOverlayRef = useRef<HTMLDivElement | null>(null);
  
  // Smart brush preview state - just the morphing shape points
  const [adaptivePreviewPoints, setAdaptivePreviewPoints] = useState<{x: number, y: number}[] | null>(null);
  const previousPreviewPointsRef = useRef<{x: number, y: number}[] | null>(null);
  
  // Performance optimization: minimal throttle for fluid drawing
  const lastUpdateTime = useRef(0);
  const lastDrawTime = useRef(0);
  // Very low throttle for maximum fluidity during drawing
  const updateThrottle = isDrawing ? 8 : 16;  // 8ms = ~120fps when drawing

  // Update adjusted brush size when prop changes
  useEffect(() => {
    setAdjustedBrushSize(brushSize);
  }, [brushSize]);
  
  // Broadcast brush stroke to other viewports for ghost contour rendering
  useEffect(() => {
    if (!contourEditContext || !selectedStructure || !isActive) return;
    
    // Get structure color for ghost rendering
    const structure = rtStructures?.structures?.find((s: any) => s.roiNumber === selectedStructure);
    const structureColor: [number, number, number] = structure?.color || [255, 255, 0];
    
    if (isDrawing && brushPointsRef.current.length > 0) {
      // Convert brush points to world coordinates for cross-viewport sync
      const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
      const imagePosition = imageMetadata?.imagePosition?.split?.('\\')?.map(Number) || [0, 0, 0];
      const pixelSpacing = imageMetadata?.pixelSpacing?.split?.('\\')?.map(Number) || [1, 1];
      const [rowSpacing, colSpacing] = pixelSpacing;
      
      const drawingPoints: ActiveDrawingPoint[] = brushPointsRef.current.map(pt => {
        const pixelX = (pt.x - transform.offsetX) / transform.scale;
        const pixelY = (pt.y - transform.offsetY) / transform.scale;
        return {
          x: imagePosition[0] + (pixelX * colSpacing),
          y: imagePosition[1] + (pixelY * rowSpacing),
          z: currentSlicePosition,
        };
      });
      
      const isInEraseState = isEraseMode || isTemporaryEraseMode;
      
      if (!activeStrokeIdRef.current) {
        // Start a new stroke
        activeStrokeIdRef.current = contourEditContext.startStroke({
          sourceViewportId: viewportId,
          toolType: isInEraseState ? 'eraser' : (smartBrushEnabled ? 'smart_brush' : 'brush'),
          structureId: selectedStructure,
          structureColor,
          slicePosition: currentSlicePosition,
          points: drawingPoints,
          mode: isInEraseState ? 'subtract' : 'add',
          brushSize: brushSize,
        });
      } else {
        // Update existing stroke
        contourEditContext.updateStroke(activeStrokeIdRef.current, drawingPoints);
      }
    } else if (!isDrawing && activeStrokeIdRef.current) {
      // Drawing ended - end the stroke
      contourEditContext.endStroke(activeStrokeIdRef.current);
      activeStrokeIdRef.current = null;
    }
  }, [isDrawing, selectedStructure, isActive, currentSlicePosition, isEraseMode, isTemporaryEraseMode, smartBrushEnabled, brushSize, viewportId, contourEditContext, rtStructures, imageMetadata, ctTransform]);
  
  // Cleanup ghost stroke when tool deactivates
  useEffect(() => {
    if (!isActive && contourEditContext && activeStrokeIdRef.current) {
      contourEditContext.endStroke(activeStrokeIdRef.current);
      activeStrokeIdRef.current = null;
    }
  }, [isActive, contourEditContext]);

  // Handle shift key for temporary erase mode (only for brush tool, not erase tool)
  useEffect(() => {
    if (!isActive || isEraseMode) return; // Only work for brush tool, not erase tool
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !isShiftPressed) {
        setIsShiftPressed(true);
        setIsTemporaryEraseMode(true);
        log.debug('🔹 Temporary erase mode activated (Shift held)', 'brush');
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && isShiftPressed) {
        setIsShiftPressed(false);
        setIsTemporaryEraseMode(false);
        log.debug('🔹 Temporary erase mode deactivated (Shift released)', 'brush');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, isEraseMode, isShiftPressed]);

  // Create overlay canvas for cursor and brush strokes
  useEffect(() => {
    if (!canvasRef.current || !isActive) {
      // Clean up overlay canvas when not active
      if (overlayCanvasRef.current && overlayCanvasRef.current.parentElement) {
        overlayCanvasRef.current.parentElement.removeChild(
          overlayCanvasRef.current,
        );
        overlayCanvasRef.current = null;
      }
      // Clean up slider overlay
      if (sliderOverlayRef.current && sliderOverlayRef.current.parentElement) {
        sliderOverlayRef.current.parentElement.removeChild(
          sliderOverlayRef.current,
        );
        sliderOverlayRef.current = null;
      }
      return;
    }

    const mainCanvas = canvasRef.current;

    // Create overlay canvas if it doesn't exist
    if (!overlayCanvasRef.current) {
      log.debug('Creating overlay canvas','brush');
      const overlayCanvas = document.createElement("canvas");
      overlayCanvas.style.position = "absolute";
      
      // Position the overlay canvas exactly on top of the main canvas
      const mainRect = mainCanvas.getBoundingClientRect();
      const parentRect = mainCanvas.parentElement!.getBoundingClientRect();
      overlayCanvas.style.top = `${mainRect.top - parentRect.top}px`;
      overlayCanvas.style.left = `${mainRect.left - parentRect.left}px`;
      
      overlayCanvas.style.pointerEvents = "none"; // Allow events to pass through for scrolling
      overlayCanvas.style.zIndex = "10";
      overlayCanvas.width = mainCanvas.width;
      overlayCanvas.height = mainCanvas.height;

      // Match canvas styling
      const computedStyle = window.getComputedStyle(mainCanvas);
      overlayCanvas.style.width = computedStyle.width;
      overlayCanvas.style.height = computedStyle.height;
      overlayCanvas.style.imageRendering = "auto";

      // Ensure the container can stack canvases
      const parent = mainCanvas.parentElement as HTMLElement | null;
      if (parent && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      mainCanvas.parentElement?.appendChild(overlayCanvas);
      overlayCanvasRef.current = overlayCanvas;
    }

    // Update overlay canvas size and position if main canvas size changes
    if (
      overlayCanvasRef.current.width !== mainCanvas.width ||
      overlayCanvasRef.current.height !== mainCanvas.height
    ) {
      overlayCanvasRef.current.width = mainCanvas.width;
      overlayCanvasRef.current.height = mainCanvas.height;
      
      // Also update position in case main canvas moved
      const mainRect = mainCanvas.getBoundingClientRect();
      const parentRect = mainCanvas.parentElement!.getBoundingClientRect();
      overlayCanvasRef.current.style.top = `${mainRect.top - parentRect.top}px`;
      overlayCanvasRef.current.style.left = `${mainRect.left - parentRect.left}px`;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, canvasRef]);

  // Get structure color - red for erase modes, structure color for normal mode
  const getStructureColor = () => {
    // Determine if we're in any erase mode
    const isInEraseMode = isEraseMode || isTemporaryEraseMode;
    
    if (isInEraseMode) {
      return "#ff4444"; // Bright red for erase mode
    }
    
    if (!selectedStructure || !rtStructures?.structures) return "#00ff00";
    const structure = rtStructures.structures.find(
      (s: any) => s.roiNumber === selectedStructure,
    );
    if (!structure?.color) return "#00ff00";
    return `rgb(${structure.color.join(",")})`;
  };

  // Draw cursor and brush strokes
  const drawOverlay = () => {
    if (!overlayCanvasRef.current || !isActive) {
      // console.log('drawOverlay: early return', { hasOverlay: !!overlayCanvasRef.current, isActive });
      return;
    }

    const ctx = overlayCanvasRef.current.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    const structureColor = getStructureColor();

    if (cursorPosition) {
        const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
        const pixelSpacing = imageMetadata?.pixelSpacing ? imageMetadata.pixelSpacing.split('\\').map(Number)[0] : 0.9765625;
        const liveBrushSize = isAdjustingSize ? adjustedBrushSize : brushSize;
        const cursorRadiusInScreenPixels = liveBrushSize * pixelSpacing / (pixelSpacing / transform.scale);

        if (smartBrushEnabled && adaptivePreviewPoints && adaptivePreviewPoints.length > 2 && !isEraseMode && !isTemporaryEraseMode) {
            ctx.save();
            ctx.beginPath();
            adaptivePreviewPoints.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            ctx.fillStyle = structureColor;
            ctx.globalAlpha = 0.3; // Semi-transparent fill
            ctx.fill();

            // 2. Draw the outline for the adaptive shape using the same path.
            ctx.strokeStyle = structureColor;
            ctx.lineWidth = 2; // A thin, clean line
            ctx.globalAlpha = 0.8; // A more solid line for better visibility
            ctx.setLineDash([6, 3]); // Dashed line to indicate smart brush
            ctx.stroke();

            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(cursorPosition.x, cursorPosition.y, cursorRadiusInScreenPixels, 0, 2 * Math.PI);
            ctx.strokeStyle = structureColor;
            ctx.lineWidth = 2;
            if (smartBrushEnabled) ctx.setLineDash([6, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(cursorPosition.x, cursorPosition.y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = structureColor;
        ctx.fill();
    }

    // Draw the preview of the entire brush path - optimized for performance
    if (isDrawing) {
        // Show brush path preview for: regular brush OR smart brush in erase mode
        const isSmartBrushErasing = smartBrushEnabled && (isEraseMode || isTemporaryEraseMode);
        if ((!smartBrushEnabled || isSmartBrushErasing) && brushPointsRef.current.length > 0) {
            // Regular brush path preview - optimized rendering
            ctx.strokeStyle = structureColor;
            const pixelSpacing = imageMetadata?.pixelSpacing ? imageMetadata.pixelSpacing.split('\\').map(Number)[0] : 0.9765625;
            const brushSizeInMM = brushSize * pixelSpacing;
            const zoomScale = ctTransform?.current?.scale || 1;
            const strokeWidthInScreenPixels = (brushSizeInMM / pixelSpacing) * zoomScale * 2;
            
            ctx.lineWidth = strokeWidthInScreenPixels;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.globalAlpha = 0.5; // Reduced opacity for better performance
            
            // Optimized path drawing - use Path2D for better performance
            const path = new Path2D();
            const points = brushPointsRef.current;
            if (points.length > 0) {
                path.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    path.lineTo(points[i].x, points[i].y);
                }
            }
            ctx.stroke(path);
            ctx.globalAlpha = 1.0;
        } else if (smartBrushEnabled && adaptiveShapesRef.current.length > 0) {
            // Smart brush path preview - optimized with Path2D
            ctx.save();
            ctx.fillStyle = structureColor;
            ctx.globalAlpha = 0.25; // Reduced opacity for better performance

            // Draw each collected adaptive shape using Path2D
            const shapes = adaptiveShapesRef.current;
            for (const shape of shapes) {
                if (shape.length > 2) {
                    const path = new Path2D();
                    path.moveTo(shape[0].x, shape[0].y);
                    for (let i = 1; i < shape.length; i++) {
                        path.lineTo(shape[i].x, shape[i].y);
                    }
                    path.closePath();
                    ctx.fill(path);
                }
            }
            ctx.restore();
        }
    }
  };

  // Optimized drawing with requestAnimationFrame for smooth active drawing
  useEffect(() => {
    if (!isActive) return;
    
    // Use rAF only when actively drawing for maximum smoothness
    if (isDrawing || isAdjustingSize) {
      const animate = () => {
        const now = performance.now();
        // Target 120fps during active drawing (8.3ms per frame)
        if (now - lastDrawTime.current >= 8) {
          drawOverlay();
          lastDrawTime.current = now;
        }
        if (isDrawingRef.current || isAdjustingSize) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // When not drawing, single draw on state change
      drawOverlay();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    cursorPosition,
    isActive,
    brushSize,
    isDrawing,
    isAdjustingSize,
    adjustedBrushSize,
    isEraseMode,
    isTemporaryEraseMode,
    adaptivePreviewPoints,
    smartBrushEnabled,
  ]);

  // Handle mouse events
  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    const canvas = canvasRef.current; // Use the main canvas for events

    const getCanvasCoords = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      return { x, y };
    };

    // This is the fix for the right-click-to-resize functionality.
    // The previous logic was preventing the mouse move events from being
    // correctly processed when adjusting the brush size.
    const handleMouseMove = (e: MouseEvent) => {
        if (isAdjustingSize && sizeAdjustStart) {
            e.preventDefault();
            e.stopPropagation();
            
            const deltaX = e.clientX - sizeAdjustStart.x;
            const pixelSpacing = imageMetadata?.pixelSpacing ? imageMetadata.pixelSpacing.split('\\').map(Number)[0] : 0.9765625;
            
            // Allow minimum of 0.1 cm (1mm) - same as slider
            const minSizeCm = 0.1;
            const minPixels = (minSizeCm * 10) / pixelSpacing; // Convert 0.1cm to pixels
            const maxPixels = 102;
            
            const deltaCm = deltaX / 50;
            const baseSizeCm = (sizeAdjustStart.size * pixelSpacing) / 10;
            const newSizeCm = Math.max(minSizeCm, Math.min(10, baseSizeCm + deltaCm));
            const newSizePixels = Math.max(minPixels, Math.min(maxPixels, (newSizeCm * 10) / pixelSpacing));
            
            // Allow fractional pixels for precise 0.1 cm minimum
            setAdjustedBrushSize(newSizePixels);
            
            // Update slider overlay with live feedback
            if (sliderOverlayRef.current) {
              const sizeText = sliderOverlayRef.current.querySelector("#brush-size-text") as HTMLElement;
              const sliderFill = sliderOverlayRef.current.querySelector("#brush-slider-fill") as HTMLElement;
              
              if (sizeText) {
                const sizeCm = (newSizePixels * pixelSpacing) / 10;
                sizeText.innerHTML = `
                  <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px; color: rgba(156, 163, 175, 1); text-transform: uppercase; letter-spacing: 0.5px;">Brush Size</div>
                  <div style="font-size: 24px; font-weight: 700; margin-bottom: 2px; color: rgba(255, 255, 255, 1); line-height: 1.2;">${sizeCm.toFixed(2)} cm</div>
                  <div style="font-size: 11px; color: rgba(156, 163, 175, 0.8); margin-top: 2px;">${newSizePixels.toFixed(1)} px</div>
                `;
              }
              
              if (sliderFill) {
                // Map size to slider width (0-100%) for 0.1cm to 10cm range
                const currentSizeCm = (newSizePixels * pixelSpacing) / 10;
                const percentage = ((currentSizeCm - 0.1) / (10 - 0.1)) * 100;
                // Direct update for real-time responsiveness (no transition during drag)
                sliderFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
              }
            }
            return;
        }

        // Performance optimization: minimal throttle during drawing for maximum fluidity
        const now = performance.now();
        if (!isAdjustingSize && !isDrawingRef.current && now - lastUpdateTime.current < updateThrottle) {
            return;
        }
        // When actively drawing, skip throttle entirely for maximum responsiveness
        if (!isDrawingRef.current) {
          lastUpdateTime.current = now;
        }

        const coords = getCanvasCoords(e);
        
        // Always update cursor position state for accurate rendering
        setCursorPosition(coords);
        
        // Update cursor style based on prediction hover
        if (predictionEnabled && activePredictions && activePredictions.size > 0 && canvasRef.current) {
          // Calculate adaptive tolerance
          let sliceSpacing = 2.5;
          if (imageMetadata?.spacingBetweenSlices) {
            sliceSpacing = parseFloat(imageMetadata.spacingBetweenSlices);
          } else if (imageMetadata?.sliceThickness) {
            sliceSpacing = parseFloat(imageMetadata.sliceThickness);
          }
          const tolerance = sliceSpacing * 0.4;
          
          let currentPrediction = null;
          for (const [slicePos, prediction] of activePredictions.entries()) {
            if (Math.abs(slicePos - currentSlicePosition) <= tolerance) {
              currentPrediction = prediction;
              break;
            }
          }
          
          if (currentPrediction && currentPrediction.predictedContour) {
            const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
            const isInside = isPointInPrediction(
              coords.x,
              coords.y,
              currentPrediction.predictedContour,
              imageMetadata,
              transform
            );
            
            // Change cursor to indicate accept/reject behavior
            if (isInside) {
              canvasRef.current.style.cursor = 'pointer'; // Click to accept
            } else {
              canvasRef.current.style.cursor = 'not-allowed'; // Click to reject
            }
          }
        } else if (canvasRef.current && !isAdjustingSize) {
          // Reset to default crosshair
          canvasRef.current.style.cursor = 'crosshair';
        }

        if (smartBrushEnabled && !isEraseMode && !isTemporaryEraseMode && canvasRef.current) {
            try {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
                    
                    const imageWidth = transform.imageWidth || imageMetadata?.Columns || 512;
                    const imageHeight = transform.imageHeight || imageMetadata?.Rows || 512;
                    const scaledWidth = imageWidth * transform.scale;
                    const scaledHeight = imageHeight * transform.scale;
                    // FIX: transform.offsetX already includes centering offset, don't double-count
                    const imageStartX = transform.offsetX;
                    const imageStartY = transform.offsetY;

                    const cursorXOnImage = coords.x - imageStartX;
                    const cursorYOnImage = coords.y - imageStartY;
                    
                    if (cursorXOnImage < 0 || cursorXOnImage >= scaledWidth || cursorYOnImage < 0 || cursorYOnImage >= scaledHeight) {
                        setAdaptivePreviewPoints(null);
                        return;
                    }
                    
                    const imageData = ctx.getImageData(
                        Math.floor(imageStartX),
                        Math.floor(imageStartY),
                        Math.ceil(scaledWidth),
                        Math.ceil(scaledHeight)
                    );
                    const grayscaleData = new Float32Array(scaledWidth * scaledHeight);
                    for (let i = 0; i < grayscaleData.length; i++) {
                        grayscaleData[i] = imageData.data[i * 4];
                    }
                    
                    // This is the core fix: The brush radius must be scaled by the zoom level
                    // to match the coordinate space of the preview.
                    const radiusInCanvasPixels = brushSize * transform.scale;
                    
                    const previewPoints = createAdaptivePreview(
                        grayscaleData,
                        Math.ceil(scaledWidth),
                        Math.ceil(scaledHeight),
                        cursorXOnImage,
                        cursorYOnImage,
                        radiusInCanvasPixels
                    );
                    
                    let canvasPreviewPoints = previewPoints.map(p => ({
                        x: p.x + imageStartX,
                        y: p.y + imageStartY
                    }));
                    
                    // Light temporal smoothing
                    if (previousPreviewPointsRef.current && previousPreviewPointsRef.current.length === canvasPreviewPoints.length) {
                        const blendFactor = 0.7;
                        canvasPreviewPoints = canvasPreviewPoints.map((point, i) => {
                            const prevPoint = previousPreviewPointsRef.current![i];
                            return {
                                x: prevPoint.x * blendFactor + point.x * (1 - blendFactor),
                                y: prevPoint.y * blendFactor + point.y * (1 - blendFactor)
                            };
                        });
                    }
                    
                    if (canvasPreviewPoints.length > 2) {
                        previousPreviewPointsRef.current = canvasPreviewPoints;
                        setAdaptivePreviewPoints(canvasPreviewPoints);
                        
                        if (isDrawingRef.current) {
                            adaptiveShapesRef.current.push(canvasPreviewPoints);
                        }
                    }
                }
            } catch (error) {
                log.warn(`Error creating adaptive preview: ${String(error)}`, 'brush');
                setAdaptivePreviewPoints(null);
            }
        } else {
            setAdaptivePreviewPoints(null);
        }

        if (isDrawingRef.current && selectedStructure) {
            // Collect brush points when:
            // 1. Smart brush is disabled (regular brush mode)
            // 2. Smart brush is enabled but in erase mode (shift held)
            const shouldCollectBrushPoints = !smartBrushEnabled || isEraseMode || isTemporaryEraseMode;
            
            if (shouldCollectBrushPoints) {
                const lastPoint = brushPointsRef.current[brushPointsRef.current.length - 1];
                if (!lastPoint) {
                  brushPointsRef.current.push(coords);
                } else {
                  const dx = coords.x - lastPoint.x;
                  const dy = coords.y - lastPoint.y;
                  const dist = Math.hypot(dx, dy);
                  const scale = (ctTransform?.current?.scale || 1);
                  // Larger step size for faster drawing with fewer points
                  const step = Math.max(2, Math.min((brushSize * scale) * 0.3, 6)); // canvas pixels
                  const steps = Math.max(1, Math.ceil(dist / step));
                  for (let i = 1; i <= steps; i++) {
                    brushPointsRef.current.push({
                      x: lastPoint.x + (dx * i) / steps,
                      y: lastPoint.y + (dy * i) / steps,
                    });
                  }
                }
            }
        }
    };

    const handleMouseDown = (e: MouseEvent) => {
      log.debug(`🖱️ Mouse down event triggered, button:${e.button} selected:${selectedStructure} adjusting:${isAdjustingSize}`, 'brush');
      if (e.button === 0 && selectedStructure && !isAdjustingSize) {
        const coords = getCanvasCoords(e);
        
        // Check if predictions are active and handle smart click behavior
        if (predictionEnabled && activePredictions && activePredictions.size > 0) {
          
          // Calculate adaptive tolerance based on slice spacing
          let sliceSpacing = 2.5;
          if (imageMetadata?.spacingBetweenSlices) {
            sliceSpacing = parseFloat(imageMetadata.spacingBetweenSlices);
          } else if (imageMetadata?.sliceThickness) {
            sliceSpacing = parseFloat(imageMetadata.sliceThickness);
          }
          const tolerance = sliceSpacing * 0.4;
          
          // Find prediction for current slice
          let currentPrediction = null;
          for (const [slicePos, prediction] of activePredictions.entries()) {
            if (Math.abs(slicePos - currentSlicePosition) <= tolerance) {
              currentPrediction = prediction;
              break;
            }
          }
          
          if (currentPrediction && currentPrediction.predictedContour) {
            // Convert prediction to canvas coordinates for hit testing
            const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
            
            // Check if click is inside prediction polygon
            const isInside = isPointInPrediction(
              coords.x, 
              coords.y, 
              currentPrediction.predictedContour,
              imageMetadata,
              transform
            );
            
              if (isInside) {
                // Click inside -> Accept prediction
                e.preventDefault();
                e.stopPropagation();
                if (onContourUpdate) {
                  onContourUpdate({
                    action: 'accept_predictions',
                    structureId: selectedStructure,
                    slicePosition: currentSlicePosition
                  });
                }
                return; // Don't start drawing
              } else {
                // Click outside -> Reject prediction
              e.preventDefault();
              e.stopPropagation();
              if (onContourUpdate) {
                onContourUpdate({
                  action: 'reject_predictions',
                  structureId: selectedStructure
                });
              }
              // Continue to drawing mode after rejecting
            }
          }
        }
        
        log.debug("✅ Entering drawing mode", 'brush');
        // Left click and structure selected
        e.preventDefault();
        e.stopPropagation();
        
        // Set both state and ref for immediate access
        setIsDrawing(true);
        isDrawingRef.current = true;
        log.debug("✅ Set isDrawing to true (state and ref)", 'brush');
        
        // Reuse coords from above (already declared at line 648)
        log.debug(`✅ Got canvas coords: ${coords.x},${coords.y}`, 'brush');
        brushPointsRef.current = [coords];
        adaptiveShapesRef.current = []; // Clear adaptive shapes for new stroke
        
        const isInEraseState = isEraseMode || isTemporaryEraseMode;
        log.debug(`🎨 Smart brush enabled: ${smartBrushEnabled}, erase mode: ${isInEraseState}`, 'brush');
        if (smartBrushEnabled && !isInEraseState) {
          log.debug("🎨 Smart brush stroke started - adaptive shapes cleared", 'brush');
        }
        
        // Collect brush points for: regular brush OR smart brush in erase mode
        if (!smartBrushEnabled || isInEraseState) {
          addBrushPoint(coords.x, coords.y);
        }
      } else if (e.button === 2) {
        // Right click - start diameter adjustment
        e.preventDefault();
        e.stopPropagation();
        log.debug('Right-click detected, starting diameter adjustment','brush');
        setIsAdjustingSize(true);
        setSizeAdjustStart({ x: e.clientX, y: e.clientY, size: brushSize });
        setAdjustedBrushSize(brushSize);
        
        // Create slider overlay - add offset to ensure it's above cursor
        try {
          // Get brush cursor size to add appropriate offset
          const brushDiameter = brushSize * 2; // Canvas scale factor
          const offsetY = Math.max(40, brushDiameter / 2); // At least 40px offset, or half brush diameter
          createSliderOverlay(e.clientX, e.clientY - offsetY);
        } catch (error) {
          console.error('Error creating slider overlay:', error);
        }
      }
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (isDrawingRef.current) {
        log.debug(`🛑 Mouse up - finalizing stroke. Smart brush enabled: ${smartBrushEnabled}, Adaptive shapes collected: ${adaptiveShapesRef.current.length}`,'brush');
        
        // Set drawing state to false first to stop preview updates
        setIsDrawing(false);
        isDrawingRef.current = false;
        
        // Clear adaptive preview points and preview callback
        if (smartBrushEnabled) {
          setAdaptivePreviewPoints(null);
          if (onPreviewUpdate) {
            onPreviewUpdate(null);
          }
        }
        
        // CRITICAL FIX: Await the finalization before clearing the overlay
        // This ensures the contour update has been sent before we clear the preview
        await finalizeBrushStroke();
        
        // Now clear overlay canvas after finalization is complete
        // Use a small delay to ensure React has processed the state update
        requestAnimationFrame(() => {
          if (overlayCanvasRef.current) {
            const ctx = overlayCanvasRef.current.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }
          }
          
          // Update cursor position to current mouse location to prevent snapping
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
            const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
            setCursorPosition({ x, y });
          }
          drawOverlay();
        });
      }
      
      if (isAdjustingSize) {
        // Apply the new brush size and sync with main toolbar
        if (onBrushSizeChange && adjustedBrushSize !== brushSize) {
          onBrushSizeChange(adjustedBrushSize);
          log.debug(`Right-click slider: Updated brush size from ${brushSize}px to ${adjustedBrushSize}px`,'brush');
        }
        setIsAdjustingSize(false);
        setSizeAdjustStart(null);
        
        // Remove slider overlay
        if (sliderOverlayRef.current && sliderOverlayRef.current.parentElement) {
          sliderOverlayRef.current.parentElement.removeChild(sliderOverlayRef.current);
          sliderOverlayRef.current = null;
        }
      }
    };

    const handleMouseLeave = async () => {
      setCursorPosition(null);
      setAdaptivePreviewPoints(null);
      // Clear preview when mouse leaves
      if (onPreviewUpdate) {
        onPreviewUpdate(null);
      }
      if (isDrawingRef.current) {
        // Set state first to stop any new updates
        setIsDrawing(false);
        isDrawingRef.current = false;
        
        // CRITICAL FIX: Await finalization before clearing overlay
        await finalizeBrushStroke();
        
        // Clear overlay canvas after finalization is complete
        requestAnimationFrame(() => {
          if (overlayCanvasRef.current) {
            const ctx = overlayCanvasRef.current.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }
          }
        });
        return; // Already set isDrawing to false above
      }
      setIsDrawing(false);
      isDrawingRef.current = false;
    };

    // Prevent context menu on right click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Handle wheel events - don't prevent them so scrolling works
    const handleWheel = (e: WheelEvent) => {
      // Don't prevent default or stop propagation - let it bubble to parent
      // This allows the parent canvas to handle slice navigation
    };
    
    // Add wheel listener to explicitly allow scrolling
    canvas.addEventListener("wheel", handleWheel, { passive: true });

    // Add event listeners to the main canvas
    canvas.addEventListener("mousemove", handleMouseMove, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown, { passive: false });
    canvas.addEventListener("mouseup", handleMouseUp, { passive: false });
    canvas.addEventListener("mouseleave", handleMouseLeave, { passive: false });
    canvas.addEventListener("contextmenu", handleContextMenu, { passive: false });
    // Also listen for mouseup on window to catch when mouse is released outside canvas
    window.addEventListener("mouseup", handleMouseUp);
    // Also listen for mousemove on window for size adjustment
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isActive, isDrawing, brushSize, selectedStructure, isAdjustingSize, adjustedBrushSize, onBrushSizeChange, imageMetadata, sizeAdjustStart, smartBrushEnabled, isEraseMode, isTemporaryEraseMode, currentSlicePosition, onContourUpdate, predictionEnabled, activePredictions]);

  const addBrushPoint = (x: number, y: number) => {
    if (!selectedStructure || !rtStructures?.structures || !imageMetadata) return;

    // Get current zoom/pan transform
    const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
    
    // Convert canvas coordinates to pixel coordinates by inverting the zoom/pan transform
    const pixelX = (x - transform.offsetX) / transform.scale;
    const pixelY = (y - transform.offsetY) / transform.scale;

    // Parse DICOM metadata
    const imagePosition = imageMetadata.imagePosition.split('\\').map(Number);
    const pixelSpacing = imageMetadata.pixelSpacing.split('\\').map(Number);
    const [rowSpacing, colSpacing] = pixelSpacing;
    
    // Convert pixel coordinates to world coordinates
    const worldX = imagePosition[0] + (pixelX * colSpacing);
    const worldY = imagePosition[1] + (pixelY * rowSpacing);
    const worldZ = currentSlicePosition;

    console.log(
      `Brush point: Canvas(${x.toFixed(1)}, ${y.toFixed(1)}) -> Pixel(${pixelX.toFixed(1)}, ${pixelY.toFixed(1)}) -> World(${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${worldZ})`,
    );
  };

  // Helper function to calculate contour area
  const calculateContourArea = (contour: number[]): number => {
    let area = 0;
    const n = contour.length / 3;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x1 = contour[i * 3];
      const y1 = contour[i * 3 + 1];
      const x2 = contour[j * 3];
      const y2 = contour[j * 3 + 1];
      area += (x1 * y2 - x2 * y1);
    }
    
    return Math.abs(area / 2);
  };

  const finalizeBrushStroke = async () => {
    try {
        if (!selectedStructure || !rtStructures?.structures) {
            return;
        }

        const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
        const isInEraseMode = isEraseMode || isTemporaryEraseMode;

        if (smartBrushEnabled && adaptiveShapesRef.current.length > 0 && !isInEraseMode) {
            console.log(`🎨 Finalizing smart brush with ${adaptiveShapesRef.current.length} adaptive shapes`);
            
            const adaptivePolygons: number[][] = [];
            adaptiveShapesRef.current.forEach((shape) => {
                if (shape.length > 2) {
                    const worldPoints: number[] = [];
                    shape.forEach(p => {
                        const pixelX = (p.x - transform.offsetX) / transform.scale;
                        const pixelY = (p.y - transform.offsetY) / transform.scale;
                        const worldPoint = pixelToWorld(pixelX, pixelY, imageMetadata, currentSlicePosition);
                        worldPoints.push(worldPoint[0], worldPoint[1], worldPoint[2]);
                    });
                    adaptivePolygons.push(worldPoints);
                }
            });

            if (adaptivePolygons.length === 0) {
            log.debug("No valid adaptive shapes to create contour", 'brush');
                return;
            }
            
            const { polygonUnion } = await import('@/lib/polygon-union');
            const unifiedPolygon = polygonUnion(adaptivePolygons);

            if (onContourUpdate) {
                onContourUpdate({
                    action: "smart_brush_stroke",
                    structureId: selectedStructure,
                    slicePosition: currentSlicePosition,
                    points: unifiedPolygon,
                });
                
                // Trigger prediction if enabled
                if (predictionEnabled) {
                    onContourUpdate({
                        action: 'trigger_prediction',
                        structureId: selectedStructure,
                        slicePosition: currentSlicePosition
                    });
                }
            }
        } else if (smartBrushEnabled && brushPointsRef.current.length > 0 && isInEraseMode) {
            // Smart brush ERASE mode - works exactly like standard brush erase
            console.log(`🔴 Finalizing smart brush ERASE with ${brushPointsRef.current.length} points`);
            
            const worldPoints = brushPointsRef.current.map((point) => {
                const pixelX = (point.x - transform.offsetX) / transform.scale;
                const pixelY = (point.y - transform.offsetY) / transform.scale;
                return pixelToWorld(pixelX, pixelY, imageMetadata, currentSlicePosition);
            });
            
            // Apply same decimation as standard brush
            const decimateByDistance = (pts: [number, number, number][], minDistMm = 0.5) => {
              if (pts.length <= 2) return pts;
              const out: [number, number, number][] = [pts[0]];
              let last = pts[0];
              for (let i = 1; i < pts.length - 1; i++) {
                const p = pts[i];
                const dx = p[0] - last[0];
                const dy = p[1] - last[1];
                const dist = Math.hypot(dx, dy);
                if (dist >= minDistMm) {
                  out.push(p);
                  last = p;
                }
              }
              out.push(pts[pts.length - 1]);
              return out;
            };
            const filteredPoints = decimateByDistance(worldPoints);
            
            if (onContourUpdate) {
                onContourUpdate({
                    action: "erase_stroke",
                    structureId: selectedStructure,
                    slicePosition: currentSlicePosition,
                    pointCount: filteredPoints.length,
                    points: filteredPoints,
                    brushSize: brushSize,
                    isEraseMode: true,
                });
            }
        } else if (!smartBrushEnabled && brushPointsRef.current.length > 0) {
            log.debug(`Finalizing regular brush with ${brushPointsRef.current.length} points`, 'brush');

            // Regular brush mode - convert all brush points to world coordinates
            const worldPoints = brushPointsRef.current.map((point) => {
                const pixelX = (point.x - transform.offsetX) / transform.scale;
                const pixelY = (point.y - transform.offsetY) / transform.scale;
                return pixelToWorld(pixelX, pixelY, imageMetadata, currentSlicePosition);
            });

            // Light decimation to prevent lumpy/sawtooth contours on fast strokes
            const decimateByDistance = (pts: [number, number, number][], minDistMm = 0.5) => {
              if (pts.length <= 2) return pts;
              const out: [number, number, number][] = [pts[0]];
              let last = pts[0];
              for (let i = 1; i < pts.length - 1; i++) {
                const p = pts[i];
                const dx = p[0] - last[0];
                const dy = p[1] - last[1];
                const dist = Math.hypot(dx, dy);
                if (dist >= minDistMm) {
                  out.push(p);
                  last = p;
                }
              }
              out.push(pts[pts.length - 1]);
              return out;
            };
            const filteredPoints = decimateByDistance(worldPoints);

            const actionType = isInEraseMode ? "erase_stroke" : "brush_stroke";
            
            // Notify parent component with the brush/erase stroke data
            if (onContourUpdate) {
              onContourUpdate({
                action: actionType,
                structureId: selectedStructure,
                slicePosition: currentSlicePosition,
                pointCount: filteredPoints.length,
                points: filteredPoints,
                brushSize: brushSize,
                predictionEnabled: predictionEnabled,
                isEraseMode: isInEraseMode,
              });
              
              // Trigger prediction if enabled and not in erase mode
              if (predictionEnabled && !isInEraseMode) {
                onContourUpdate({
                  action: 'trigger_prediction',
                  structureId: selectedStructure,
                  slicePosition: currentSlicePosition
                });
              }
            }
        }
    } catch (error) {
        log.error(`Error in finalizeBrushStroke: ${String(error)}`, 'brush');
    } finally {
        brushPointsRef.current = [];
        adaptiveShapesRef.current = [];
    }
};

const pixelToWorld = (pixelX: number, pixelY: number, imageMetadata: any, slicePosition: number): [number, number, number] => {
    const imagePosition = imageMetadata.imagePosition.split('\\').map(Number);
    const pixelSpacing = imageMetadata.pixelSpacing.split('\\').map(Number);
    const [rowSpacing, colSpacing] = pixelSpacing;

    const worldX = imagePosition[0] + (pixelX * colSpacing);
    const worldY = imagePosition[1] + (pixelY * rowSpacing);
    
    return [worldX, worldY, slicePosition];
};

  // Create slider overlay for diameter adjustment
  const createSliderOverlay = (x: number, y: number) => {
    if (!canvasRef.current) {
      console.error('Canvas ref not available for slider overlay');
      return;
    }
    
    // Remove any existing overlay first
    if (sliderOverlayRef.current && sliderOverlayRef.current.parentElement) {
      sliderOverlayRef.current.parentElement.removeChild(sliderOverlayRef.current);
      sliderOverlayRef.current = null;
    }
    
    const mainCanvas = canvasRef.current;
    const pixelSpacing = imageMetadata?.pixelSpacing ? imageMetadata.pixelSpacing.split('\\').map(Number)[0] : 1.171875;
    
    // Create overlay div
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";  // Use fixed positioning for viewport-relative placement
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y - 120}px`;  // Position well above cursor (120px offset)
    overlay.style.width = "280px";
    overlay.style.height = "auto";  // Auto height for better content fit
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "10000";  // Higher z-index
    overlay.style.transform = "translateX(-140px)";  // Center the 280px wide overlay
    
    // Create inner content with modern styling
    const content = document.createElement("div");
    content.style.backgroundColor = "rgba(17, 24, 39, 0.95)"; // gray-950/95
    content.style.color = "white";
    content.style.padding = "12px 16px";
    content.style.borderRadius = "12px";
    content.style.fontSize = "14px";
    content.style.fontFamily = "system-ui, -apple-system, sans-serif";
    content.style.textAlign = "center";
    content.style.border = "0.5px solid rgba(107, 114, 128, 0.6)"; // gray-600/60
    content.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)";
    content.style.backdropFilter = "blur(12px)";
    (content.style as any).webkitBackdropFilter = "blur(12px)"; // Safari support
    
    // Size text - show both cm and px like settings panel
    const sizeText = document.createElement("div");
    const sizeCm = (brushSize * pixelSpacing) / 10; // Convert pixels to cm
    sizeText.innerHTML = `
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px; color: rgba(156, 163, 175, 1); text-transform: uppercase; letter-spacing: 0.5px;">Brush Size</div>
      <div style="font-size: 24px; font-weight: 700; margin-bottom: 2px; color: rgba(255, 255, 255, 1); line-height: 1.2;">${sizeCm.toFixed(2)} cm</div>
      <div style="font-size: 11px; color: rgba(156, 163, 175, 0.8); margin-top: 2px;">${brushSize} px</div>
    `;
    sizeText.style.marginBottom = "10px";
    sizeText.style.userSelect = "none";
    content.appendChild(sizeText);
    
    // Slider bar with improved styling
    const sliderBar = document.createElement("div");
    sliderBar.style.width = "100%";
    sliderBar.style.height = "8px";
    sliderBar.style.backgroundColor = "rgba(75, 85, 99, 0.5)"; // gray-600/50
    sliderBar.style.borderRadius = "4px";
    sliderBar.style.position = "relative";
    sliderBar.style.overflow = "hidden";
    sliderBar.style.border = "0.5px solid rgba(107, 114, 128, 0.3)";
    
    const sliderFill = document.createElement("div");
    sliderFill.style.height = "100%";
    sliderFill.style.width = "50%";
    sliderFill.style.backgroundColor = "#3b82f6"; // blue-500
    sliderFill.style.borderRadius = "4px";
    sliderFill.style.boxShadow = "0 0 8px rgba(59, 130, 246, 0.4)";
    sliderFill.style.willChange = "width"; // Optimize for frequent updates
    sliderBar.appendChild(sliderFill);
    
    content.appendChild(sliderBar);
    overlay.appendChild(content);
    
    // Store references
    overlay.dataset.sizeText = "";
    overlay.dataset.sliderFill = "";
    sizeText.id = "brush-size-text";
    sliderFill.id = "brush-slider-fill";
    
    document.body.appendChild(overlay);
    sliderOverlayRef.current = overlay;
    console.log('Slider overlay created successfully');
  };
  
  // Update slider overlay
  const updateSliderOverlay = (x: number, y: number, sizePixels: number, pixelSpacing: number) => {
    if (!sliderOverlayRef.current) return;
    
    const sizeText = sliderOverlayRef.current.querySelector("#brush-size-text") as HTMLElement;
    const sliderFill = sliderOverlayRef.current.querySelector("#brush-slider-fill") as HTMLElement;
    
    if (sizeText) {
      const sizeCm = (sizePixels * pixelSpacing) / 10;
      sizeText.innerHTML = `
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px; color: rgba(156, 163, 175, 1); text-transform: uppercase; letter-spacing: 0.5px;">Brush Size</div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 2px; color: rgba(255, 255, 255, 1); line-height: 1.2;">${sizeCm.toFixed(2)} cm</div>
        <div style="font-size: 11px; color: rgba(156, 163, 175, 0.8); margin-top: 2px;">${Math.round(sizePixels)} px</div>
      `;
    }
    
    if (sliderFill) {
      // Map size to slider width (0-100%) - medical range 1-102px to cover 1mm-100mm
      const minSize = 1;
      const maxSize = 102;
      const percentage = ((sizePixels - minSize) / (maxSize - minSize)) * 100;
      // Direct update for real-time responsiveness
      sliderFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }
  };

  return null; // This component only handles interactions, no visual rendering
}
