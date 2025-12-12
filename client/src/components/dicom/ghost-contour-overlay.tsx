/**
 * GhostContourOverlay - Renders ghost contours from other viewports
 * 
 * This component renders semi-transparent "ghost" versions of contours being
 * drawn in other viewports. This provides visual feedback across viewports
 * when editing contours in a multi-viewport layout.
 * 
 * Features:
 * - Semi-transparent rendering (30-50% opacity)
 * - Dashed stroke for distinction from real contours (previews only)
 * - Animated pulsing effect during active drawing
 * - Auto-hides when no active drawings from other viewports
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useGhostContours, type ActiveDrawingStroke, type ActiveDrawingPoint } from '@/contexts/contour-edit-context';

interface GhostContourOverlayProps {
  /** This viewport's unique ID */
  viewportId: string;
  /** Canvas element reference (main viewport canvas) */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Current Z position (slice position) for this viewport */
  currentSlicePosition: number;
  /** Slice thickness tolerance for showing ghost contours (mm) */
  sliceTolerance?: number;
  /** Whether to show ghost contours */
  enabled?: boolean;
  /** Ghost contour opacity (0-1) */
  ghostOpacity?: number;
  /** Image metadata for coordinate conversion */
  imageMetadata?: {
    imagePosition?: string;
    pixelSpacing?: string;
  } | null;
  /** CT transform ref for zoom/pan */
  ctTransform?: React.RefObject<{ scale: number; offsetX: number; offsetY: number } | null>;
}

const GHOST_DASH_PATTERN = [6, 4];

export const GhostContourOverlay: React.FC<GhostContourOverlayProps> = ({
  viewportId,
  canvasRef,
  currentSlicePosition,
  sliceTolerance = 2.0, // Increased tolerance for better matching
  enabled = true,
  ghostOpacity = 0.6,
  imageMetadata,
  ctTransform,
}) => {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const dashOffsetRef = useRef(0);
  
  // Get ghost strokes from other viewports at this slice
  const ghostStrokes = useGhostContours(viewportId, currentSlicePosition, sliceTolerance);
  
  // Render ghost contours - called on every animation frame
  const render = useCallback(() => {
    const overlay = overlayRef.current;
    const mainCanvas = canvasRef.current;
    if (!overlay || !mainCanvas) return;
    
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    
    // Sync canvas size with main canvas
    if (overlay.width !== mainCanvas.width || overlay.height !== mainCanvas.height) {
      overlay.width = mainCanvas.width;
      overlay.height = mainCanvas.height;
    }
    
    // Clear previous frame
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    if (!enabled || ghostStrokes.length === 0) return;
    
    // Get fresh transform values on every render (refs don't trigger re-renders)
    const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
    
    // Parse image metadata for coordinate conversion
    const imagePosition = imageMetadata?.imagePosition?.split?.('\\')?.map(Number) || [0, 0, 0];
    const pixelSpacing = imageMetadata?.pixelSpacing?.split?.('\\')?.map(Number) || [1, 1];
    const [rowSpacing, colSpacing] = pixelSpacing;
    
    // World to canvas coordinate conversion (same logic as main contour rendering)
    const worldToCanvas = (worldX: number, worldY: number): [number, number] => {
      // Convert world coordinates to pixel coordinates
      const pixelX = (worldX - imagePosition[0]) / colSpacing;
      const pixelY = (worldY - imagePosition[1]) / rowSpacing;
      
      // Apply zoom and pan transform
      const canvasX = pixelX * transform.scale + transform.offsetX;
      const canvasY = pixelY * transform.scale + transform.offsetY;
      
      return [canvasX, canvasY];
    };
    
    // Update dash animation offset for marching ants effect
    dashOffsetRef.current = (dashOffsetRef.current + 0.3) % 20;
    
    // Render each ghost stroke
    for (const stroke of ghostStrokes) {
      renderGhostStroke(ctx, stroke, worldToCanvas, ghostOpacity, dashOffsetRef.current, transform.scale);
    }
  }, [enabled, ghostStrokes, ghostOpacity, canvasRef, imageMetadata, ctTransform]);
  
  // Animation loop for continuous rendering (handles zoom/pan changes via refs)
  useEffect(() => {
    if (!enabled) {
      // Clear overlay when disabled
      const ctx = overlayRef.current?.getContext('2d');
      if (ctx && overlayRef.current) {
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
      return;
    }
    
    // Start animation loop
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      // Render every frame for smooth animation and fresh transform values
      render();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, render]);
  
  // Sync overlay size with main canvas
  useEffect(() => {
    const mainCanvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!mainCanvas || !overlay) return;
    
    const resizeObserver = new ResizeObserver(() => {
      overlay.width = mainCanvas.width;
      overlay.height = mainCanvas.height;
    });
    
    resizeObserver.observe(mainCanvas);
    return () => resizeObserver.disconnect();
  }, [canvasRef]);
  
  // Debug: Log when ghost strokes are received
  useEffect(() => {
    if (ghostStrokes.length > 0) {
      console.log(`🔮 [${viewportId}] Rendering ${ghostStrokes.length} ghost stroke(s) at slice ${currentSlicePosition.toFixed(1)}`);
    }
  }, [ghostStrokes.length, viewportId, currentSlicePosition]);
  
  return (
    <canvas
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 15 }}
    />
  );
};

/**
 * Render a single ghost stroke on the canvas
 */
function renderGhostStroke(
  ctx: CanvasRenderingContext2D,
  stroke: ActiveDrawingStroke,
  worldToCanvas: (x: number, y: number) => [number, number],
  opacity: number,
  dashOffset: number,
  scale: number
) {
  const { points, structureColor, mode, toolType, brushSize } = stroke;
  
  if (!points || points.length === 0) return;
  
  // Create color with opacity
  const [r, g, b] = structureColor;
  const strokeColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  const fillColor = `rgba(${r}, ${g}, ${b}, ${opacity * 0.3})`;
  
  ctx.save();
  
  // Style for ghost contours - dashed, semi-transparent
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = Math.max(2, (mode === 'subtract' ? 3 : 2));
  ctx.setLineDash(GHOST_DASH_PATTERN);
  ctx.lineDashOffset = -dashOffset;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  if (toolType === 'brush' || toolType === 'eraser' || toolType === 'smart_brush') {
    // Brush strokes - render as thick path following the brush points
    const scaledBrushRadius = Math.max(3, ((brushSize || 10) * scale) / 2);
    
    if (points.length === 1) {
      // Single point - draw circle
      const [cx, cy] = worldToCanvas(points[0].x, points[0].y);
      ctx.beginPath();
      ctx.arc(cx, cy, scaledBrushRadius, 0, Math.PI * 2);
      if (mode !== 'subtract') {
        ctx.globalAlpha = opacity * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
    } else {
      // Multiple points - draw as thick line
      ctx.lineWidth = scaledBrushRadius * 2;
      
      ctx.beginPath();
      const [startX, startY] = worldToCanvas(points[0].x, points[0].y);
      ctx.moveTo(startX, startY);
      
      for (let i = 1; i < points.length; i++) {
        const [x, y] = worldToCanvas(points[i].x, points[i].y);
        ctx.lineTo(x, y);
      }
      
      // Draw the thick stroke with fill effect
      if (mode !== 'subtract') {
        ctx.globalAlpha = opacity * 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      
      // Draw outline
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else {
    // Pen tool - render as polygon path
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const [startX, startY] = worldToCanvas(points[0].x, points[0].y);
    ctx.moveTo(startX, startY);
    
    for (let i = 1; i < points.length; i++) {
      const [x, y] = worldToCanvas(points[i].x, points[i].y);
      ctx.lineTo(x, y);
    }
    
    // Close path if points form a closed shape
    if (points.length > 2) {
      const first = points[0];
      const last = points[points.length - 1];
      const dist = Math.hypot(first.x - last.x, first.y - last.y);
      if (dist < 5) {
        ctx.closePath();
        if (mode !== 'subtract') {
          ctx.fill();
        }
      }
    }
    
    ctx.stroke();
    
    // Draw vertices as small dots
    ctx.setLineDash([]);
    ctx.fillStyle = strokeColor;
    for (const point of points) {
      const [x, y] = worldToCanvas(point.x, point.y);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

export default GhostContourOverlay;
