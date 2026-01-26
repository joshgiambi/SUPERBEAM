import React, { useRef, useEffect, useState, useCallback } from 'react';
import { combineContours, subtractContours, offsetContour, offsetOpenPath, debugPenToolDelete } from '../../lib/clipper-boolean-operations';
import { subtractContourSimple, doPolygonsIntersectSimple } from '../../lib/simple-polygon-operations';
import { polygonUnion } from '../../lib/polygon-union';

interface PenToolV2Props {
  isActive: boolean;
  selectedStructure: number | null;
  rtStructures: any;
  currentSlicePosition: number;
  imageMetadata: any;
  onContourUpdate: (payload: any) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  ctTransform: React.RefObject<any>;
}

interface Point {
  x: number;
  y: number;
}

// Helper function to check if two polygons intersect
function doPolygonsIntersect(polygon1: number[], polygon2: number[]): boolean {
  // Convert flat arrays to points
  const points1: [number, number][] = [];
  const points2: [number, number][] = [];
  
  for (let i = 0; i < polygon1.length; i += 3) {
    points1.push([polygon1[i], polygon1[i + 1]]);
  }
  
  for (let i = 0; i < polygon2.length; i += 3) {
    points2.push([polygon2[i], polygon2[i + 1]]);
  }
  
  // Check if any point from polygon1 is inside polygon2 or vice versa
  for (const point of points1) {
    if (isPointInPolygon(point, points2)) {
      return true;
    }
  }
  
  for (const point of points2) {
    if (isPointInPolygon(point, points1)) {
      return true;
    }
  }
  
  // Check if any edges intersect
  for (let i = 0; i < points1.length; i++) {
    const a1 = points1[i];
    const a2 = points1[(i + 1) % points1.length];
    
    for (let j = 0; j < points2.length; j++) {
      const b1 = points2[j];
      const b2 = points2[(j + 1) % points2.length];
      
      if (doSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  
  return false;
}

// Helper function to check if a point is inside a polygon
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  const [x, y] = point;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Helper function to check if two line segments intersect
function doSegmentsIntersect(a1: [number, number], a2: [number, number], b1: [number, number], b2: [number, number]): boolean {
  const ccw = (A: [number, number], B: [number, number], C: [number, number]) => {
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
  };
  
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}

// Eclipse Pen Tool V2 - Clean implementation with proper boolean operations
export default function PenToolV2({
  isActive,
  selectedStructure,
  rtStructures,
  currentSlicePosition,
  imageMetadata,
  onContourUpdate,
  canvasRef,
  ctTransform
}: PenToolV2Props) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Drawing state
  const [vertices, setVertices] = useState<Point[]>([]);
  const [mousePosition, setMousePosition] = useState<Point | null>(null);
  const [isDrawingContinuous, setIsDrawingContinuous] = useState(false);
  const [firstPointMode, setFirstPointMode] = useState<'inside' | 'outside' | null>(null);
  const [hasCrossedBoundary, setHasCrossedBoundary] = useState(false);
  const [shouldComplete, setShouldComplete] = useState(false);
  
  // Eclipse-style vertex morphing state
  const [hoveredVertex, setHoveredVertex] = useState<{ contourIdx: number; pointIdx: number } | null>(null);
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [draggedVertex, setDraggedVertex] = useState<{
    contourIdx: number;
    pointIdx: number;
    originalContour: number[];
    originalSlicePosition: number;
  } | null>(null);
  // Live preview of morphed contour (world coordinates)
  const [morphPreviewContour, setMorphPreviewContour] = useState<number[] | null>(null);
  
  // Morphing constants
  const VERTEX_HIT_RADIUS = 12; // pixels - how close to click on a vertex
  const CONTOUR_HOVER_DISTANCE = 20; // pixels - how close to contour to show vertices
  const INFLUENCE_RADIUS_WORLD = 30; // mm - soft falloff radius for nearby vertices
  const VERTEX_DISPLAY_RADIUS = 100; // pixels - only show vertices within this radius of cursor
  const MIN_VERTEX_SPACING = 25; // pixels - minimum spacing between displayed vertices

  // Get contours at current slice
  const getContoursAtCurrentSlice = useCallback(() => {
    if (!selectedStructure || !rtStructures?.structures) return [];
    
    const structure = rtStructures.structures.find((s: any) => s.roiNumber === selectedStructure);
    if (!structure?.contours) return [];
    
    // Filter contours at current slice position
    const tolerance = 1.5; // mm tolerance for slice matching
    const contours = structure.contours.filter((contour: any) => {
      return Math.abs(contour.slicePosition - currentSlicePosition) <= tolerance;
    });
    
    // Convert contours to the format expected by boolean operations
    return contours.map((contour: any) => ({
      points: contour.points,
      slicePosition: contour.slicePosition
    }));
  }, [selectedStructure, rtStructures, currentSlicePosition]);

  // Initialize overlay canvas
  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    const mainCanvas = canvasRef.current;
    let overlay = overlayCanvasRef.current;
    
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.style.position = 'absolute';
      
      // Position the overlay canvas exactly on top of the main canvas
      const mainRect = mainCanvas.getBoundingClientRect();
      const parentRect = mainCanvas.parentElement!.getBoundingClientRect();
      overlay.style.top = `${mainRect.top - parentRect.top}px`;
      overlay.style.left = `${mainRect.left - parentRect.left}px`;
      
      // Match CSS dimensions to main canvas
      const computedStyle = window.getComputedStyle(mainCanvas);
      overlay.style.width = computedStyle.width;
      overlay.style.height = computedStyle.height;
      
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '10';
      overlay.className = 'pen-tool-overlay';
      
      mainCanvas.parentElement?.appendChild(overlay);
      (overlayCanvasRef as any).current = overlay;
    }
    
    overlay.width = mainCanvas.width;
    overlay.height = mainCanvas.height;
    
    // Update position in case main canvas moved
    const mainRect = mainCanvas.getBoundingClientRect();
    const parentRect = mainCanvas.parentElement!.getBoundingClientRect();
    overlay.style.top = `${mainRect.top - parentRect.top}px`;
    overlay.style.left = `${mainRect.left - parentRect.left}px`;
    
    // CRITICAL: Match CSS dimensions to main canvas so coordinates align
    const computedStyle = window.getComputedStyle(mainCanvas);
    overlay.style.width = computedStyle.width;
    overlay.style.height = computedStyle.height;

    return () => {
      const overlayElement = document.querySelector('.pen-tool-overlay');
      if (overlayElement && overlayElement.parentElement) {
        overlayElement.parentElement.removeChild(overlayElement);
      }
      (overlayCanvasRef as any).current = null;
    };
  }, [isActive, canvasRef]);

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = useCallback((canvasX: number, canvasY: number) => {
    if (!imageMetadata) return { x: 0, y: 0, z: currentSlicePosition };
    
    const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
    
    // FIX: Debug coordinate transformation
    console.log('🖊️ PEN TOOL canvasToWorld:', {
      canvasPoint: { x: canvasX, y: canvasY },
      transform: { scale: transform.scale, offsetX: transform.offsetX, offsetY: transform.offsetY }
    });
    
    // Convert canvas to pixel coordinates (undo zoom/pan)
    const pixelX = (canvasX - transform.offsetX) / transform.scale;
    const pixelY = (canvasY - transform.offsetY) / transform.scale;
    
    console.log('🖊️ PEN TOOL pixelCoords:', { pixelX, pixelY });
    
    // Parse DICOM metadata
    const imagePosition = imageMetadata.imagePosition.split('\\').map(Number);
    const pixelSpacing = imageMetadata.pixelSpacing.split('\\').map(Number);
    const [rowSpacing, colSpacing] = pixelSpacing;
    
    // Convert to world coordinates
    const worldX = imagePosition[0] + (pixelX * colSpacing);
    const worldY = imagePosition[1] + (pixelY * rowSpacing);
    
    console.log('🖊️ PEN TOOL worldCoords:', { worldX, worldY, z: currentSlicePosition });
    
    return { x: worldX, y: worldY, z: currentSlicePosition };
  }, [imageMetadata, currentSlicePosition, ctTransform]);

  // Convert world coordinates to canvas coordinates  
  const worldToCanvas = useCallback((worldX: number, worldY: number) => {
    if (!imageMetadata) return { x: 0, y: 0 };
    
    const transform = ctTransform?.current || { scale: 1, offsetX: 0, offsetY: 0 };
    
    // Parse DICOM metadata
    const imagePosition = imageMetadata.imagePosition.split('\\').map(Number);
    const pixelSpacing = imageMetadata.pixelSpacing.split('\\').map(Number);
    const [rowSpacing, colSpacing] = pixelSpacing;
    
    // Convert world to pixel coordinates
    const pixelX = (worldX - imagePosition[0]) / colSpacing;
    const pixelY = (worldY - imagePosition[1]) / rowSpacing;
    
    // Apply zoom/pan transform
    const canvasX = transform.offsetX + (pixelX * transform.scale);
    const canvasY = transform.offsetY + (pixelY * transform.scale);
    
    return { x: canvasX, y: canvasY };
  }, [imageMetadata, ctTransform]);

  // Find the nearest vertex to the cursor (for Eclipse-style morphing)
  const findNearestVertex = useCallback((canvasX: number, canvasY: number): { contourIdx: number; pointIdx: number } | null => {
    const contours = getContoursAtCurrentSlice();
    if (contours.length === 0) return null;
    
    let nearestVertex: { contourIdx: number; pointIdx: number; distance: number } | null = null;
    let isNearBoundary = false;
    
    // First, check if cursor is near any contour boundary
    for (let contourIdx = 0; contourIdx < contours.length; contourIdx++) {
      const contour = contours[contourIdx];
      const points = contour.points;
      if (!points || points.length < 9) continue;
      
      // Check distance to each edge segment
      for (let i = 0; i < points.length; i += 3) {
        const j = (i + 3) % points.length;
        const p1 = worldToCanvas(points[i], points[i + 1]);
        const p2 = worldToCanvas(points[j], points[j + 1]);
        
        // Distance from point to line segment
        const A = canvasX - p1.x;
        const B = canvasY - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
          xx = p1.x;
          yy = p1.y;
        } else if (param > 1) {
          xx = p2.x;
          yy = p2.y;
        } else {
          xx = p1.x + param * C;
          yy = p1.y + param * D;
        }
        
        const dx = canvasX - xx;
        const dy = canvasY - yy;
        const distToEdge = Math.sqrt(dx * dx + dy * dy);
        
        if (distToEdge < CONTOUR_HOVER_DISTANCE) {
          isNearBoundary = true;
          break;
        }
      }
      
      if (isNearBoundary) break;
    }
    
    // Only check for vertices if we're near a contour boundary
    if (!isNearBoundary) return null;
    
    // Find the nearest vertex
    for (let contourIdx = 0; contourIdx < contours.length; contourIdx++) {
      const contour = contours[contourIdx];
      const points = contour.points;
      if (!points || points.length < 9) continue;
      
      for (let i = 0; i < points.length; i += 3) {
        const canvasPos = worldToCanvas(points[i], points[i + 1]);
        const dx = canvasX - canvasPos.x;
        const dy = canvasY - canvasPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < VERTEX_HIT_RADIUS) {
          if (!nearestVertex || distance < nearestVertex.distance) {
            nearestVertex = { contourIdx, pointIdx: i, distance };
          }
        }
      }
    }
    
    return nearestVertex ? { contourIdx: nearestVertex.contourIdx, pointIdx: nearestVertex.pointIdx } : null;
  }, [getContoursAtCurrentSlice, worldToCanvas, CONTOUR_HOVER_DISTANCE, VERTEX_HIT_RADIUS]);

  // Determine initial operation mode based on first click
  const determineInitialMode = useCallback((firstWorldPoint: Point): 'inside' | 'outside' => {
    if (!selectedStructure || !rtStructures?.structures) return 'outside';
    
    const structure = rtStructures.structures.find(
      (s: any) => s.roiNumber === selectedStructure
    );
    
    if (!structure || !structure.contours) return 'outside';
    
    const tolerance = 1.5;
    const contoursAtSlice = structure.contours.filter(
      (c: any) => Math.abs(c.slicePosition - currentSlicePosition) <= tolerance
    );
    
    if (contoursAtSlice.length === 0) return 'outside';
    
    // Check if first point is inside any existing contour
    for (const contour of contoursAtSlice) {
      const contourPoints: [number, number][] = [];
      for (let i = 0; i < contour.points.length; i += 3) {
        contourPoints.push([contour.points[i], contour.points[i + 1]]);
      }
      
      if (isPointInPolygon([firstWorldPoint.x, firstWorldPoint.y], contourPoints)) {
        return 'inside';
      }
    }
    
    return 'outside';
  }, [selectedStructure, rtStructures, currentSlicePosition]);
  
  // Determine final operation based on polygon path
  const determineFinalOperation = useCallback((vertices: Point[]): 'union' | 'subtract' | 'new' => {
    if (!selectedStructure || !rtStructures?.structures || vertices.length < 3) return 'new';
    
    const structure = rtStructures.structures.find(
      (s: any) => s.roiNumber === selectedStructure
    );
    
    if (!structure || !structure.contours) return 'new';
    
    const tolerance = 1.5;
    const contoursAtSlice = structure.contours.filter(
      (c: any) => Math.abs(c.slicePosition - currentSlicePosition) <= tolerance
    );
    
    if (contoursAtSlice.length === 0) return 'new';
    
    // Convert vertices to world coordinates
    const worldVertices: number[] = [];
    vertices.forEach(v => {
      const world = canvasToWorld(v.x, v.y);
      worldVertices.push(world.x, world.y, world.z);
    });
    
    // Create a proper closed polygon for intersection test
    const closedWorldVertices = [...worldVertices];
    if (closedWorldVertices.length >= 9) {
      // Ensure polygon is closed by adding first point at end if needed
      const firstX = closedWorldVertices[0];
      const firstY = closedWorldVertices[1];
      const lastX = closedWorldVertices[closedWorldVertices.length - 3];
      const lastY = closedWorldVertices[closedWorldVertices.length - 2];
      
      if (firstX !== lastX || firstY !== lastY) {
        closedWorldVertices.push(firstX, firstY, closedWorldVertices[2]);
      }
    }
    
    // Check if polygon intersects with any existing contour
    let intersectsAny = false;
    let crossesIntoContour = false;
    
    for (const contour of contoursAtSlice) {
      if (doPolygonsIntersect(closedWorldVertices, contour.points)) {
        intersectsAny = true;
        
        // Check if the polygon crosses from outside to inside
        // by checking if some vertices are inside and some are outside
        let hasInsideVertex = false;
        let hasOutsideVertex = false;
        
        for (let i = 0; i < closedWorldVertices.length; i += 3) {
          const vertex = [closedWorldVertices[i], closedWorldVertices[i + 1]] as [number, number];
          const contourPoints: [number, number][] = [];
          for (let j = 0; j < contour.points.length; j += 3) {
            contourPoints.push([contour.points[j], contour.points[j + 1]]);
          }
          
          if (isPointInPolygon(vertex, contourPoints)) {
            hasInsideVertex = true;
          } else {
            hasOutsideVertex = true;
          }
          
          if (hasInsideVertex && hasOutsideVertex) {
            crossesIntoContour = true;
            break;
          }
        }
        
        if (crossesIntoContour) break;
      }
    }
    
    // Determine based on first point and intersection
    const firstWorld = canvasToWorld(vertices[0].x, vertices[0].y);
    const firstInside = determineInitialMode(firstWorld) === 'inside';
    
    if (firstInside) {
      return 'union'; // Started inside = always union
    } else if (crossesIntoContour) {
      return 'subtract'; // Started outside + crosses into contour = subtract (carve hole)
    } else if (intersectsAny) {
      return 'new'; // Started outside + just touches edge = new blob
    } else {
      return 'new'; // Started outside + no crossing = new blob
    }
  }, [selectedStructure, rtStructures, currentSlicePosition, canvasToWorld, determineInitialMode]);

  // Check if point is near first vertex (for closing polygon)
  const isNearFirstVertex = useCallback((point: Point): boolean => {
    if (vertices.length < 3) return false;
    
    const firstVertex = vertices[0];
    const distance = Math.sqrt(
      Math.pow(point.x - firstVertex.x, 2) + Math.pow(point.y - firstVertex.y, 2)
    );
    
    return distance < 20; // 20 pixel tolerance for easier closing
  }, [vertices]);

  // Get structure color
  const getStructureColor = useCallback(() => {
    if (!selectedStructure || !rtStructures?.structures) return '#00ff00';
    
    const structure = rtStructures.structures.find(
      (s: any) => s.roiNumber === selectedStructure
    );
    
    if (structure?.color) {
      const [r, g, b] = structure.color;
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    return '#00ff00';
  }, [selectedStructure, rtStructures]);

  // Get lighter version of structure color for point outlines
  const getLighterStructureColor = useCallback(() => {
    if (!selectedStructure || !rtStructures?.structures) return 'rgba(144, 255, 144, 0.9)';
    
    const structure = rtStructures.structures.find(
      (s: any) => s.roiNumber === selectedStructure
    );
    
    if (structure?.color) {
      const [r, g, b] = structure.color;
      // Lighten by blending toward white (increase each channel by 40% toward 255)
      const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.5));
      return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
    }
    
    return 'rgba(144, 255, 144, 0.9)';
  }, [selectedStructure, rtStructures]);

  // Check if new polygon crosses existing contours
  const doesPolygonCrossExisting = useCallback((newVertices: Point[]): boolean => {
    const contours = getContoursAtCurrentSlice();
    if (contours.length === 0) return false;
    
    // Convert vertices to world coordinates for intersection testing
    const worldVertices = newVertices.map(v => canvasToWorld(v.x, v.y));
    
    for (const contour of contours) {
      // Convert contour points to 2D array for intersection testing
      const contourPoints: [number, number][] = [];
      for (let i = 0; i < contour.points.length; i += 3) {
        contourPoints.push([contour.points[i], contour.points[i + 1]]);
      }
      
      // Check if any edge of new polygon crosses any edge of existing contour
      for (let i = 0; i < worldVertices.length; i++) {
        const p1 = worldVertices[i];
        const p2 = worldVertices[(i + 1) % worldVertices.length];
        
        for (let j = 0; j < contourPoints.length; j++) {
          const p3 = contourPoints[j];
          const p4 = contourPoints[(j + 1) % contourPoints.length];
          
          // Line intersection check
          if (doLinesIntersect(p1, p2, p3, p4)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [getContoursAtCurrentSlice, canvasToWorld]);

  // Line intersection helper
  const doLinesIntersect = (p1: Point, p2: Point, p3: [number, number], p4: [number, number]): boolean => {
    const denom = (p1.x - p2.x) * (p3[1] - p4[1]) - (p1.y - p2.y) * (p3[0] - p4[0]);
    if (Math.abs(denom) < 1e-10) return false; // Parallel lines
    
    const t = ((p1.x - p3[0]) * (p3[1] - p4[1]) - (p1.y - p3[1]) * (p3[0] - p4[0])) / denom;
    const u = -((p1.x - p2.x) * (p1.y - p3[1]) - (p1.y - p2.y) * (p1.x - p3[0])) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };

  // Handle mouse events
  const handleMouseDown = useCallback(async (event: MouseEvent) => {
    if (!isActive || !selectedStructure || !canvasRef.current) return;
    
    // FIX: Scale coordinates to account for CSS vs actual canvas dimensions
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasPoint = {
      x: ((event.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((event.clientY - rect.top) / rect.height) * canvasRef.current.height
    };

    if (event.button === 0) { // Left click
      // ECLIPSE-STYLE: Check if clicking on an existing vertex for morphing
      // Only do this if we're not already drawing a new polygon
      if (vertices.length === 0) {
        const nearVertex = findNearestVertex(canvasPoint.x, canvasPoint.y);
        if (nearVertex) {
          const contours = getContoursAtCurrentSlice();
          const contour = contours[nearVertex.contourIdx];
          if (contour && contour.points) {
            console.log('🔷 Starting vertex drag at index', nearVertex.pointIdx);
            setIsDraggingVertex(true);
            setDraggedVertex({
              contourIdx: nearVertex.contourIdx,
              pointIdx: nearVertex.pointIdx,
              originalContour: [...contour.points],
              originalSlicePosition: contour.slicePosition
            });
            return; // Don't start a new polygon
          }
        }
      }
      
      if (isNearFirstVertex(canvasPoint) && vertices.length >= 3) {
        // Close polygon by clicking near first vertex
        setShouldComplete(true);
        return;
      }
      
      // Determine initial mode on first click
      if (vertices.length === 0) {
        const worldPoint = canvasToWorld(canvasPoint.x, canvasPoint.y);
        const mode = determineInitialMode(worldPoint);
        setFirstPointMode(mode);
        console.log(`🔷 First point is ${mode} existing contour`);
      }
      
      // Add vertex
      setVertices((prev: Point[]) => [...prev, canvasPoint]);
      
      // Start continuous drawing if holding down
      setIsDrawingContinuous(true);
      
    } else if (event.button === 2) { // Right click
      event.preventDefault();
      if (vertices.length >= 3) {
        setShouldComplete(true);
      }
    }
  }, [isActive, selectedStructure, vertices.length, firstPointMode, isNearFirstVertex, canvasToWorld, determineInitialMode, findNearestVertex, getContoursAtCurrentSlice]);

  const handleMouseMove = useCallback(async (event: MouseEvent) => {
    if (!isActive || !canvasRef.current) return;
    
    // FIX: Scale coordinates to account for CSS vs actual canvas dimensions
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasPoint = {
      x: ((event.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((event.clientY - rect.top) / rect.height) * canvasRef.current.height
    };
    
    setMousePosition(canvasPoint);
    
    // ECLIPSE-STYLE: Handle vertex dragging with soft falloff
    if (isDraggingVertex && draggedVertex && selectedStructure && rtStructures?.structures) {
      // Convert canvas position to world coordinates
      const worldPos = canvasToWorld(canvasPoint.x, canvasPoint.y);
      
      // Create new contour with morphed vertices (preview only)
      const newContour = [...draggedVertex.originalContour];
      
      // Get original dragged vertex position
      const draggedX = draggedVertex.originalContour[draggedVertex.pointIdx];
      const draggedY = draggedVertex.originalContour[draggedVertex.pointIdx + 1];
      
      // Calculate delta movement
      const deltaX = worldPos.x - draggedX;
      const deltaY = worldPos.y - draggedY;
      
      // Update dragged vertex to new position
      newContour[draggedVertex.pointIdx] = worldPos.x;
      newContour[draggedVertex.pointIdx + 1] = worldPos.y;
      
      // Apply soft falloff to nearby vertices (Eclipse-style morphing)
      for (let i = 0; i < newContour.length; i += 3) {
        if (i === draggedVertex.pointIdx) continue;
        
        const vx = draggedVertex.originalContour[i];
        const vy = draggedVertex.originalContour[i + 1];
        const distance = Math.sqrt((vx - draggedX) ** 2 + (vy - draggedY) ** 2);
        
        if (distance < INFLUENCE_RADIUS_WORLD && distance > 0) {
          // Smooth falloff using cosine interpolation (smoother than linear)
          const t = distance / INFLUENCE_RADIUS_WORLD;
          const influence = 0.5 * (1 + Math.cos(Math.PI * t)); // Cosine falloff: 1 at center, 0 at edge
          
          newContour[i] += deltaX * influence;
          newContour[i + 1] += deltaY * influence;
        }
      }
      
      // Save preview contour for rendering (don't update actual structure until mouse up)
      setMorphPreviewContour(newContour);
      
      return; // Don't process other mouse move logic while dragging vertex
    }
    
    // ECLIPSE-STYLE: Update hovered vertex when not drawing
    if (!isDrawingContinuous && vertices.length === 0) {
      const nearVertex = findNearestVertex(canvasPoint.x, canvasPoint.y);
      setHoveredVertex(nearVertex);
    } else {
      setHoveredVertex(null);
    }
    
    // Check if crossing boundary when drawing from outside
    if (firstPointMode === 'outside' && vertices.length > 1 && !hasCrossedBoundary) {
      const testVertices = [...vertices, canvasPoint];
      const worldTestPoints: number[] = [];
      testVertices.forEach(v => {
        const w = canvasToWorld(v.x, v.y);
        worldTestPoints.push(w.x, w.y, w.z);
      });
      
      const contours = getContoursAtCurrentSlice();
      for (const contour of contours) {
        if (doPolygonsIntersect(worldTestPoints, contour.points)) {
          setHasCrossedBoundary(true);
          console.log('🔷 Pen crossed into existing contour - will subtract');
          break;
        }
      }
    }
    
    // Add points during continuous drawing with better spacing
    if (isDrawingContinuous && vertices.length > 0) {
      // Check if we're near first vertex to close
      if (vertices.length >= 3 && isNearFirstVertex(canvasPoint)) {
        setShouldComplete(true);
        setIsDrawingContinuous(false);
        return;
      }
      
      const lastVertex = vertices[vertices.length - 1];
      const distance = Math.sqrt(
        Math.pow(canvasPoint.x - lastVertex.x, 2) + Math.pow(canvasPoint.y - lastVertex.y, 2)
      );
      
      // Add point if moved enough distance (smoother drawing with larger threshold)
      if (distance > 15) {
        setVertices((prev: Point[]) => [...prev, canvasPoint]);
      }
    }
  }, [isActive, isDrawingContinuous, vertices, isNearFirstVertex, isDraggingVertex, draggedVertex, 
      selectedStructure, rtStructures, canvasToWorld, onContourUpdate, findNearestVertex,
      firstPointMode, hasCrossedBoundary, getContoursAtCurrentSlice, INFLUENCE_RADIUS_WORLD]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (event.button === 0) { // Left button
      setIsDrawingContinuous(false);
      
      // ECLIPSE-STYLE: Complete vertex drag and apply the morphed contour
      if (isDraggingVertex && draggedVertex && morphPreviewContour && selectedStructure && rtStructures?.structures) {
        console.log('🔷 Completing vertex drag - applying morphed contour');
        
        const structure = rtStructures.structures.find((s: any) => s.roiNumber === selectedStructure);
        if (structure) {
          // Find and update the contour in the structure with the preview
          const tolerance = 1.5;
          const contourIndex = structure.contours.findIndex((c: any) => 
            Math.abs(c.slicePosition - draggedVertex.originalSlicePosition) <= tolerance
          );
          
          if (contourIndex !== -1) {
            structure.contours[contourIndex] = {
              ...structure.contours[contourIndex],
              points: morphPreviewContour,
              numberOfPoints: morphPreviewContour.length / 3
            };
            
            // Trigger save
            onContourUpdate({
              action: "update_rt_structures",
              structureId: selectedStructure
            });
          }
        }
        
        // Clear states
        setIsDraggingVertex(false);
        setDraggedVertex(null);
        setMorphPreviewContour(null);
      }
    }
  }, [isDraggingVertex, draggedVertex, morphPreviewContour, onContourUpdate, selectedStructure, rtStructures]);

  const handleContextMenu = useCallback((event: Event) => {
    if (isActive) {
      event.preventDefault();
    }
  }, [isActive]);

  // Complete polygon with direct structure updates (like brush tool)
  const completePolygon = useCallback(async () => {
    if (vertices.length < 3 || !selectedStructure || !rtStructures?.structures) {
      console.log(`🔷 Cannot complete: vertices=${vertices.length}, selectedStructure=${selectedStructure}`);
      return;
    }
    
    // Find the structure we're editing
    const structure = rtStructures.structures.find((s: any) => s.roiNumber === selectedStructure);
    if (!structure) {
      console.log('🔷 ERROR: Structure not found');
      return;
    }
    
    // Convert vertices to world coordinates
    const worldPoints: number[] = [];
    const polygon2D: number[] = [];
    
    vertices.forEach(vertex => {
      const world = canvasToWorld(vertex.x, vertex.y);
      worldPoints.push(world.x, world.y, world.z);
      polygon2D.push(world.x, world.y);
    });
    
    // Determine final operation mode based on polygon path
    const currentMode = determineFinalOperation(vertices);
    console.log(`🔷 PenToolV2: ${currentMode} operation with ${vertices.length} vertices`);
    
    // Get ALL existing contours at current slice (not just one)
    const tolerance = 1.5;
    const existingOnSlice = structure.contours.filter((c: any) => 
      Math.abs(c.slicePosition - currentSlicePosition) <= tolerance
    );
    
    // Apply operations directly to the structure
    if (currentMode === 'new' || existingOnSlice.length === 0) {
      // Just add new contour
      structure.contours.push({
        slicePosition: currentSlicePosition,
        points: worldPoints,
        numberOfPoints: worldPoints.length / 3
      });
      
    } else if (currentMode === 'union' && existingOnSlice.length > 0) {
      // Use same approach as brush tool - check intersections and merge
      const intersectingContours: any[] = [];
      const nonIntersectingContours: any[] = [];
      
      // Check which contours intersect with the new pen polygon
      for (const contour of existingOnSlice) {
        if (contour.points && contour.points.length >= 9) {
          // Check if pen polygon intersects with this contour
          const intersects = doPolygonsIntersect(worldPoints, contour.points);
          if (intersects) {
            intersectingContours.push(contour);
          } else {
            nonIntersectingContours.push(contour);
          }
        }
      }
      
      // Remove all existing contours at this slice
      structure.contours = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - currentSlicePosition) > tolerance
      );
      
      if (intersectingContours.length > 0) {
        // Union pen polygon with intersecting contours using polygonUnion
        const polygonsToUnion: number[][] = [];
        
        // Add intersecting contours
        for (const contour of intersectingContours) {
          polygonsToUnion.push(contour.points);
        }
        
        // Add the new pen polygon
        polygonsToUnion.push(worldPoints);
        
        // Perform union of intersecting polygons
        const unionResult = polygonUnion(polygonsToUnion);
        
        // Add the unified contour
        if (unionResult.length >= 9) {
          structure.contours.push({
            slicePosition: currentSlicePosition,
            points: unionResult,
            numberOfPoints: unionResult.length / 3,
          });
        }
        
        // Re-add non-intersecting contours as separate blobs
        for (const contour of nonIntersectingContours) {
          structure.contours.push({
            slicePosition: currentSlicePosition,
            points: contour.points,
            numberOfPoints: contour.numberOfPoints,
          });
        }
      } else {
        // Pen polygon doesn't intersect - create separate blob
        structure.contours.push({
          slicePosition: currentSlicePosition,
          points: worldPoints,
          numberOfPoints: worldPoints.length / 3
        });
        
        // Re-add all existing contours unchanged
        for (const contour of existingOnSlice) {
          structure.contours.push({
            slicePosition: currentSlicePosition,
            points: contour.points,
            numberOfPoints: contour.numberOfPoints,
          });
        }
      }
      console.log('🔷 Applied union operation using polygonUnion');
      
    } else if (currentMode === 'subtract' && existingOnSlice.length > 0) {
      console.log('🔷 ===== PERFORMING SUBTRACT OPERATION =====');
      console.log('🔷 Existing contours on slice:', existingOnSlice.length);
      const newContours: any[] = [];
      
      // Create closed polygon from vertices (close the polygon for proper subtraction)
      const closedWorldPoints: number[] = [];
      for (const vertex of vertices as Point[]) {
        // Convert canvas coordinates to world coordinates
        const world = canvasToWorld(vertex.x, vertex.y);
        closedWorldPoints.push(world.x, world.y, world.z);
        console.log('🔷 Vertex:', vertex.x, vertex.y, '-> World:', world.x, world.y, world.z);
      }
      
      // Close the polygon by adding the first point at the end if not already closed
      if (closedWorldPoints.length >= 9) {
        const firstX = closedWorldPoints[0];
        const firstY = closedWorldPoints[1]; 
        const firstZ = closedWorldPoints[2];
        const lastX = closedWorldPoints[closedWorldPoints.length - 3];
        const lastY = closedWorldPoints[closedWorldPoints.length - 2];
        
        // Only close if not already closed
        if (firstX !== lastX || firstY !== lastY) {
          closedWorldPoints.push(firstX, firstY, firstZ);
          console.log('🔷 Closed polygon by adding first point');
        } else {
          console.log('🔷 Polygon already closed');
        }
      }
      
      console.log('🔷 Created closed polygon with', closedWorldPoints.length / 3, 'points');
      console.log('🔷 Delete polygon points:', closedWorldPoints);
      
      // Process each existing contour
      for (let contourIndex = 0; contourIndex < existingOnSlice.length; contourIndex++) {
        const contour = existingOnSlice[contourIndex];
        console.log(`🔷 Processing contour ${contourIndex + 1}/${existingOnSlice.length}`);
        
        if (contour.points && contour.points.length >= 9) {
          console.log('🔷 Contour has', contour.points.length / 3, 'points');
          console.log('🔷 Contour points:', contour.points.slice(0, 12), '... (showing first 4 points)');
          
          // Check if the polygons intersect using simple method first
          const intersectsSimple = doPolygonsIntersectSimple(closedWorldPoints, contour.points);
          console.log('🔷 Polygons intersect (simple check):', intersectsSimple);
          
          if (intersectsSimple) {
            try {
              // Try simple subtraction first - much more reliable!
              console.log('🔷 Attempting SIMPLE subtraction (polygon-clipping library)...');
              console.log('🔷   - Original contour:', contour.points.length / 3, 'points');
              console.log('🔷   - Delete polygon:', closedWorldPoints.length / 3, 'points');
              
              let subtracted = subtractContourSimple(contour.points, closedWorldPoints);
              console.log('🔷 Simple subtraction result:', subtracted.length, 'contours');
              
              // If simple method fails or returns unchanged contour, try complex method as fallback
              const isUnchanged = subtracted.length === 1 && subtracted[0].length === contour.points.length;
              
              if (subtracted.length === 0 || isUnchanged) {
                console.log('🔷 ⚠️ Simple method failed/unchanged, trying complex clipper method as fallback...');
                
                // Optional debug mode for complex method
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔷 Running debug analysis...');
                  const debugResult = await debugPenToolDelete(contour.points, closedWorldPoints);
                  console.log('🔷 Debug result:', debugResult);
                }
                
                subtracted = await subtractContours(contour.points, closedWorldPoints);
                console.log('🔷 Complex fallback result:', subtracted.length, 'contours');
              } else {
                console.log('🔷 ✅ Simple subtraction succeeded!');
              }
              console.log('🔷 Final subtraction result:', subtracted.length, 'contours');
              
              if (subtracted.length === 0) {
                console.log('🔷 ⚠️  Subtraction returned empty result!');
              }
              
              // Add valid results
              let validResults = 0;
              for (const res of subtracted) {
                if (res.length >= 9) { // Valid contour with at least 3 points
                  newContours.push({
                    slicePosition: currentSlicePosition,
                    points: res,
                    numberOfPoints: res.length / 3
                  });
                  validResults++;
                  console.log('🔷 ✅ Added subtracted contour with', res.length / 3, 'points');
                } else {
                  console.log('🔷 ❌ Rejected subtracted contour with', res.length / 3, 'points (too small)');
                }
              }
              
              if (validResults === 0) {
                console.log('🔷 ⚠️  No valid results from subtraction, contour completely removed');
              }
              
            } catch (error) {
              console.error('🔷 ❌ Subtraction failed with error:', error);
              console.error('🔷 ❌ Error details:', error instanceof Error ? error.message : String(error));
              // Keep original contour if subtraction fails
              newContours.push(contour);
              console.log('🔷 ↩️  Kept original contour due to error');
            }
          } else {
            // No intersection, keep original contour
            console.log('🔷 ➡️  No intersection, keeping original contour');
            newContours.push(contour);
          }
        } else {
          console.log('🔷 ❌ Invalid contour, skipping (length:', contour.points?.length || 0, ')');
        }
      }
      
      console.log('🔷 ===== SUBTRACT OPERATION SUMMARY =====');
      console.log('🔷 Original contours:', existingOnSlice.length);
      console.log('🔷 Result contours:', newContours.length);
      console.log('🔷 Contours removed:', existingOnSlice.length - newContours.length);
      
      // Remove old contours and add new
      const originalCount = structure.contours.length;
      structure.contours = structure.contours.filter(
        (c: any) => Math.abs(c.slicePosition - currentSlicePosition) > tolerance
      );
      const afterFilterCount = structure.contours.length;
      console.log('🔷 Filtered out', originalCount - afterFilterCount, 'contours from other slices');
      
      structure.contours.push(...newContours);
      console.log('🔷 Final structure has', structure.contours.length, 'total contours');
      
      console.log('🔷 ========================================');
    }
    
    // Verify we're not creating overlapping contours
    console.log(`🔷 Operation complete - Mode: ${currentMode}, Original contours: ${existingOnSlice.length}, Final contours: ${structure.contours.filter((c: any) => Math.abs(c.slicePosition - currentSlicePosition) <= tolerance).length}`);
    
    // Send simple update to trigger save
    if (onContourUpdate) {
      onContourUpdate({
        action: "update_rt_structures",
        structureId: selectedStructure
      });
    }
    
    // Reset state
    setVertices((prev: Point[]) => []);
    setIsDrawingContinuous(false);
    setFirstPointMode(null);
    setHasCrossedBoundary(false);
    setMousePosition(null);
    
    // CRITICAL FIX: Clear overlay canvas immediately after completing polygon
    // This ensures the preview disappears and the final contour is visible
    requestAnimationFrame(() => {
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
        }
      }
    });
    
    console.log('🔷 PenToolV2: Direct update completed');
  }, [vertices, selectedStructure, currentSlicePosition, canvasToWorld, 
      rtStructures, onContourUpdate, determineFinalOperation]);

  // Reset state on slice change
  useEffect(() => {
    setVertices((prev: Point[]) => []);
    setIsDrawingContinuous(false);
    setFirstPointMode(null);
    setHasCrossedBoundary(false);
    setMousePosition(null);
    setShouldComplete(false);
    // Reset morphing state on slice change
    setHoveredVertex(null);
    setIsDraggingVertex(false);
    setDraggedVertex(null);
    setMorphPreviewContour(null);
    // Clear overlay canvas when slice changes
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }
  }, [currentSlicePosition]);

  // Execute completion when shouldComplete is set
  useEffect(() => {
    if (shouldComplete) {
      completePolygon();
      setShouldComplete(false);
    }
  }, [shouldComplete, completePolygon]);

  // Set up event listeners
  useEffect(() => {
    if (!isActive || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isActive, handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu]);

  // Draw overlay with Eclipse-style visual feedback
  const drawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !isActive) return;
    
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    const structureColor = getStructureColor();
    const lighterColor = getLighterStructureColor();
    const pulseTime = Date.now() / 150; // For animations
    
    // ECLIPSE-STYLE: Draw vertex indicators when hovering near contour
    if ((hoveredVertex || isDraggingVertex) && vertices.length === 0) {
      const contours = getContoursAtCurrentSlice();
      
      // If dragging, draw the LIVE PREVIEW of the morphed contour
      if (isDraggingVertex && morphPreviewContour && morphPreviewContour.length >= 9) {
        // Draw the morphed contour preview (bright, prominent)
        ctx.strokeStyle = structureColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        
        for (let i = 0; i < morphPreviewContour.length; i += 3) {
          const canvasPos = worldToCanvas(morphPreviewContour[i], morphPreviewContour[i + 1]);
          if (i === 0) {
            ctx.moveTo(canvasPos.x, canvasPos.y);
          } else {
            ctx.lineTo(canvasPos.x, canvasPos.y);
          }
        }
        ctx.closePath();
        ctx.stroke();
        
        // Draw semi-transparent fill to make the shape more visible
        ctx.fillStyle = structureColor;
        ctx.globalAlpha = 0.15;
        ctx.fill();
        
        // Draw vertices on the preview contour
        ctx.globalAlpha = 1;
        for (let i = 0; i < morphPreviewContour.length; i += 3) {
          const canvasPos = worldToCanvas(morphPreviewContour[i], morphPreviewContour[i + 1]);
          const isDraggedPoint = draggedVertex && draggedVertex.pointIdx === i;
          
          if (isDraggedPoint) {
            // Dragged vertex - large pulsing white circle with glow
            const pulseSize = 10 + Math.sin(pulseTime) * 2;
            
            // Glow effect
            ctx.shadowColor = structureColor;
            ctx.shadowBlur = 15;
            
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = structureColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(canvasPos.x, canvasPos.y, pulseSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.shadowBlur = 0;
          } else {
            // Check if this vertex is within influence radius (show it moving)
            const draggedX = draggedVertex?.originalContour[draggedVertex.pointIdx] || 0;
            const draggedY = draggedVertex?.originalContour[draggedVertex.pointIdx + 1] || 0;
            const origX = draggedVertex?.originalContour[i] || 0;
            const origY = draggedVertex?.originalContour[i + 1] || 0;
            const distFromDragged = Math.sqrt((origX - draggedX) ** 2 + (origY - draggedY) ** 2);
            const isInfluenced = distFromDragged < INFLUENCE_RADIUS_WORLD;
            
            // Vertex dot - larger with lighter outline for visibility
            ctx.fillStyle = isInfluenced ? '#ffff00' : structureColor;
            ctx.strokeStyle = lighterColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(canvasPos.x, canvasPos.y, isInfluenced ? 5 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        
        // Draw influence radius circle around dragged point
        if (draggedVertex && mousePosition) {
          const dragCanvasPos = worldToCanvas(
            morphPreviewContour[draggedVertex.pointIdx], 
            morphPreviewContour[draggedVertex.pointIdx + 1]
          );
          ctx.strokeStyle = lighterColor;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          const pixelSpacing = imageMetadata?.pixelSpacing?.split('\\').map(Number) || [1, 1];
          const avgSpacing = (pixelSpacing[0] + pixelSpacing[1]) / 2;
          const transform = ctTransform?.current || { scale: 1 };
          const influenceRadiusCanvas = (INFLUENCE_RADIUS_WORLD / avgSpacing) * transform.scale;
          ctx.arc(dragCanvasPos.x, dragCanvasPos.y, influenceRadiusCanvas, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        
      } else {
        // Not dragging - show hover state with vertex indicators
        // Only show vertices near the cursor, spaced apart for easy selection
        
        if (!mousePosition) {
          ctx.globalAlpha = 1;
          return;
        }
        
        for (let contourIdx = 0; contourIdx < contours.length; contourIdx++) {
          const contour = contours[contourIdx];
          const points = contour.points;
          if (!points || points.length < 9) continue;
          
          // Draw subtle contour outline near cursor
          ctx.strokeStyle = structureColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          
          for (let i = 0; i < points.length; i += 3) {
            const canvasPos = worldToCanvas(points[i], points[i + 1]);
            if (i === 0) {
              ctx.moveTo(canvasPos.x, canvasPos.y);
            } else {
              ctx.lineTo(canvasPos.x, canvasPos.y);
            }
          }
          ctx.closePath();
          ctx.stroke();
          
          // Calculate which vertices to display:
          // 1. Only within VERTEX_DISPLAY_RADIUS of cursor
          // 2. Spaced at least MIN_VERTEX_SPACING apart
          // 3. Always include the hovered vertex (closest to cursor)
          
          const verticesToDraw: { idx: number; canvasPos: { x: number; y: number }; distToCursor: number }[] = [];
          
          // First pass: collect vertices within display radius
          for (let i = 0; i < points.length; i += 3) {
            const canvasPos = worldToCanvas(points[i], points[i + 1]);
            const dx = canvasPos.x - mousePosition.x;
            const dy = canvasPos.y - mousePosition.y;
            const distToCursor = Math.sqrt(dx * dx + dy * dy);
            
            if (distToCursor < VERTEX_DISPLAY_RADIUS) {
              verticesToDraw.push({ idx: i, canvasPos, distToCursor });
            }
          }
          
          // Sort by distance to cursor (closest first)
          verticesToDraw.sort((a, b) => a.distToCursor - b.distToCursor);
          
          // Second pass: filter to ensure spacing, but always keep the closest one
          const finalVertices: typeof verticesToDraw = [];
          
          for (const vertex of verticesToDraw) {
            const isHoveredVertex = hoveredVertex && 
                                   hoveredVertex.contourIdx === contourIdx && 
                                   hoveredVertex.pointIdx === vertex.idx;
            
            // Always include hovered vertex (closest)
            if (isHoveredVertex || finalVertices.length === 0) {
              finalVertices.push(vertex);
              continue;
            }
            
            // Check spacing from already-added vertices
            let tooClose = false;
            for (const existing of finalVertices) {
              const dx = vertex.canvasPos.x - existing.canvasPos.x;
              const dy = vertex.canvasPos.y - existing.canvasPos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < MIN_VERTEX_SPACING) {
                tooClose = true;
                break;
              }
            }
            
            if (!tooClose) {
              finalVertices.push(vertex);
            }
          }
          
          // Draw the selected vertices
          for (const vertex of finalVertices) {
            const isHovered = hoveredVertex && 
                             hoveredVertex.contourIdx === contourIdx && 
                             hoveredVertex.pointIdx === vertex.idx;
            
            if (isHovered) {
              // HOVERED VERTEX - Large pulsing circle with glow
              const pulseSize = 9 + Math.sin(pulseTime) * 3;
              
              // Glow effect
              ctx.shadowColor = lighterColor;
              ctx.shadowBlur = 12;
              
              ctx.fillStyle = lighterColor;
              ctx.strokeStyle = structureColor;
              ctx.lineWidth = 3;
              ctx.globalAlpha = 1;
              ctx.beginPath();
              ctx.arc(vertex.canvasPos.x, vertex.canvasPos.y, pulseSize, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              
              ctx.shadowBlur = 0;
              
              // Draw "grab" text hint
              ctx.font = '11px sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText('drag to morph', vertex.canvasPos.x, vertex.canvasPos.y - 18);
            } else {
              // Nearby vertex - visible dot with lighter outline
              // Fade based on distance to cursor
              const fadeAlpha = Math.max(0.4, 1 - (vertex.distToCursor / VERTEX_DISPLAY_RADIUS) * 0.6);
              
              ctx.fillStyle = structureColor;
              ctx.strokeStyle = lighterColor;
              ctx.lineWidth = 1.5;
              ctx.globalAlpha = fadeAlpha;
              ctx.beginPath();
              ctx.arc(vertex.canvasPos.x, vertex.canvasPos.y, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
        }
      }
      
      ctx.globalAlpha = 1;
    }
    
    // Draw completed vertices (for new polygon drawing)
    if (vertices.length > 0) {
      ctx.strokeStyle = structureColor;
      ctx.fillStyle = structureColor;
      ctx.lineWidth = 2;
      
      // Draw polygon edges
      ctx.beginPath();
      vertices.forEach((vertex: Point, index: number) => {
        if (index === 0) {
          ctx.moveTo(vertex.x, vertex.y);
        } else {
          ctx.lineTo(vertex.x, vertex.y);
        }
      });
      
      // Draw preview line to mouse
      if (mousePosition && vertices.length > 0) {
        // Always draw preview line to mouse position
        ctx.lineTo(mousePosition.x, mousePosition.y);
      }
      
      ctx.stroke();
      
      // Always draw pulsating first vertex with color coding
      if (vertices.length > 0) {
        const firstVertex = vertices[0];
        const pulseRadius = 4 + Math.sin(Date.now() / 200) * 2;
        ctx.beginPath();
        ctx.arc(firstVertex.x, firstVertex.y, pulseRadius, 0, 2 * Math.PI);
        
        // Color based on mode: green=inside, yellow=outside, red=crossed boundary
        let vertexColor = '#ffff00'; // Default yellow (outside)
        let lighterVertexColor = '#ffff99'; // Lighter yellow
        if (firstPointMode === 'inside') {
          vertexColor = '#00ff00'; // Green
          lighterVertexColor = '#99ff99'; // Lighter green
        } else if (firstPointMode === 'outside' && hasCrossedBoundary) {
          vertexColor = '#ff0000'; // Red (crossed boundary)
          lighterVertexColor = '#ff9999'; // Lighter red
        }
        
        ctx.fillStyle = vertexColor;
        ctx.fill();
        ctx.strokeStyle = lighterVertexColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [isActive, vertices, mousePosition, firstPointMode, hasCrossedBoundary, getStructureColor, getLighterStructureColor,
      isNearFirstVertex, hoveredVertex, isDraggingVertex, draggedVertex, getContoursAtCurrentSlice, 
      worldToCanvas, imageMetadata, ctTransform, INFLUENCE_RADIUS_WORLD, morphPreviewContour]);

  // Draw overlay when state changes
  useEffect(() => {
    if (isActive && (vertices.length > 0 || mousePosition || hoveredVertex || isDraggingVertex || morphPreviewContour)) {
      drawOverlay();
    }
  }, [isActive, drawOverlay, vertices.length, mousePosition, hoveredVertex, isDraggingVertex, morphPreviewContour]);
  
  // Continuous animation loop for hover/drag pulse effects
  useEffect(() => {
    if (!isActive || (!hoveredVertex && !isDraggingVertex)) return;
    
    let animationId: number;
    const animate = () => {
      drawOverlay();
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, hoveredVertex, isDraggingVertex, drawOverlay]);
  
  // Update cursor based on hover/drag state
  useEffect(() => {
    if (!canvasRef.current || !isActive) return;
    
    if (isDraggingVertex) {
      canvasRef.current.style.cursor = 'grabbing';
    } else if (hoveredVertex) {
      canvasRef.current.style.cursor = 'grab';
    } else {
      canvasRef.current.style.cursor = 'crosshair';
    }
  }, [isActive, hoveredVertex, isDraggingVertex, canvasRef]);

  // Reset when switching structures or becoming inactive
  useEffect(() => {
    if (!isActive) {
      setVertices((prev: Point[]) => []);
      setIsDrawingContinuous(false);
      setFirstPointMode(null);
      setHasCrossedBoundary(false);
      setMousePosition(null);
      // Reset morphing state
      setHoveredVertex(null);
      setIsDraggingVertex(false);
      setDraggedVertex(null);
      setMorphPreviewContour(null);
      // Clear overlay canvas when becoming inactive
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
        }
      }
      // Reset cursor
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
    }
  }, [isActive, selectedStructure, canvasRef]);

  return null; // This component only handles interactions
}