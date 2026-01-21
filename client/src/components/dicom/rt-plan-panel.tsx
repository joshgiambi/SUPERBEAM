/**
 * RT Plan Panel - Beam visualization and BEV (Beam's Eye View)
 * 
 * Sub-tab component for the dose control panel that displays:
 * - Plan metadata
 * - Beam list with angles and field sizes
 * - Interactive Beam's Eye View (BEV) visualization
 * - Beam overlay controls for the main viewer
 */

import { useState, useEffect, useRef, useMemo, useCallback, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Crosshair,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Target,
  Zap,
  RotateCw,
  Maximize2,
  Grid,
  Move,
  Play,
  Pause,
  Info,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  RTPlanMetadata,
  BeamSummary,
  BEVProjection,
  RTPlanSummary,
} from '@/types/rt-plan';
import { getBeamColor } from '@/types/rt-plan';

interface RTPlanPanelProps {
  // Plan series selection
  planSeriesOptions: { id: number; seriesDescription: string }[];
  selectedPlanSeriesId: number | null;
  onPlanSeriesSelect: (seriesId: number | null) => void;
  
  // Beam visibility
  showBeamOverlay: boolean;
  onShowBeamOverlayChange: (show: boolean) => void;
  
  // Selected beam for highlighting
  selectedBeamNumber: number | null;
  onSelectBeam: (beamNumber: number | null) => void;
  
  // Beam overlay settings
  beamOverlayOpacity: number;
  onBeamOverlayOpacityChange: (opacity: number) => void;
  
  // Callback to expose beam data for overlay rendering
  onBeamsLoaded?: (beams: BeamSummary[], bevProjections: BEVProjection[]) => void;
  
  // Loading state
  isLoading?: boolean;
  
  // Expand/collapse BEV
  expandBEV?: boolean;
  onToggleExpandBEV?: () => void;
}

export function RTPlanPanel({
  planSeriesOptions,
  selectedPlanSeriesId,
  onPlanSeriesSelect,
  showBeamOverlay,
  onShowBeamOverlayChange,
  selectedBeamNumber,
  onSelectBeam,
  beamOverlayOpacity,
  onBeamOverlayOpacityChange,
  onBeamsLoaded,
  isLoading: externalLoading = false,
  expandBEV = false,
  onToggleExpandBEV,
}: RTPlanPanelProps) {
  const [planData, setPlanData] = useState<RTPlanSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [bevZoom, setBevZoom] = useState(1);
  const [controlPointIndex, setControlPointIndex] = useState(0);
  const [animatingArc, setAnimatingArc] = useState(false);
  const bevCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Store refs to callbacks to avoid re-fetching when callbacks change
  const onBeamsLoadedRef = useRef(onBeamsLoaded);
  const onSelectBeamRef = useRef(onSelectBeam);
  
  // Keep refs updated
  useEffect(() => {
    onBeamsLoadedRef.current = onBeamsLoaded;
    onSelectBeamRef.current = onSelectBeam;
  }, [onBeamsLoaded, onSelectBeam]);
  
  // Load plan data when series selected - only depends on selectedPlanSeriesId
  useEffect(() => {
    console.log('[RTPlanPanel] useEffect triggered, selectedPlanSeriesId:', selectedPlanSeriesId);
    
    if (!selectedPlanSeriesId) {
      console.log('[RTPlanPanel] No plan series selected, clearing data');
      setPlanData(null);
      return;
    }
    
    const loadPlanData = async () => {
      console.log('[RTPlanPanel] Loading plan data for series:', selectedPlanSeriesId);
      setIsLoading(true);
      setLoadError(null);
      
      try {
        const url = `/api/rt-plan/${selectedPlanSeriesId}/summary`;
        console.log('[RTPlanPanel] Fetching:', url);
        
        const response = await fetch(url);
        console.log('[RTPlanPanel] Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[RTPlanPanel] API error:', errorText);
          throw new Error(`Failed to load RT Plan: ${response.status} - ${errorText}`);
        }
        
        const data: RTPlanSummary = await response.json();
        console.log('[RTPlanPanel] Loaded plan data:', {
          planName: data.metadata?.planName,
          beamCount: data.beams?.length,
          bevCount: data.bevProjections?.length,
        });
        
        setPlanData(data);
        
        // Notify parent of loaded beams
        if (onBeamsLoadedRef.current && data.beams && data.bevProjections) {
          console.log('[RTPlanPanel] Notifying parent of loaded beams');
          onBeamsLoadedRef.current(data.beams, data.bevProjections);
        }
        
        // Select first beam by default
        if (data.beams && data.beams.length > 0) {
          console.log('[RTPlanPanel] Auto-selecting first beam:', data.beams[0].beamNumber);
          onSelectBeamRef.current(data.beams[0].beamNumber);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[RTPlanPanel] Load error:', errorMsg);
        setLoadError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPlanData();
  }, [selectedPlanSeriesId]); // Only re-fetch when series changes
  
  // Get selected beam data
  const selectedBeam = useMemo(() => {
    if (!planData || selectedBeamNumber === null) return null;
    return planData.beams.find(b => b.beamNumber === selectedBeamNumber) || null;
  }, [planData, selectedBeamNumber]);
  
  // Initial BEV from plan data (first control point)
  const initialBEV = useMemo(() => {
    if (!planData || selectedBeamNumber === null) return null;
    return planData.bevProjections.find(b => b.beamNumber === selectedBeamNumber) || null;
  }, [planData, selectedBeamNumber]);
  
  // Pre-cached BEV data for all control points (commercial-grade animation)
  const [bevCache, setBevCache] = useState<Map<number, BEVProjection>>(new Map());
  const [bevLoading, setBevLoading] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<{ loaded: number; total: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Reset state when beam changes
  useEffect(() => {
    setControlPointIndex(0);
    setBevCache(new Map());
    setCacheProgress(null);
    setAnimatingArc(false);
    
    // Abort any pending fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [selectedBeamNumber]);
  
  // Pre-load ALL control point BEV data when beam is selected (for smooth animation)
  // Uses batch endpoint for fast single-request loading
  useEffect(() => {
    if (!selectedPlanSeriesId || selectedBeamNumber === null || !selectedBeam) {
      return;
    }
    
    const numCP = selectedBeam.numberOfControlPoints;
    
    // Skip if only 1-2 control points (static field, no animation needed)
    if (numCP <= 2) {
      // Just use initial BEV
      if (initialBEV) {
        setBevCache(new Map([[0, initialBEV]]));
      }
      return;
    }
    
    // Pre-fetch all control points in a single batch request
    const fetchAllControlPoints = async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      setBevLoading(true);
      setCacheProgress({ loaded: 0, total: numCP });
      
      try {
        // Use batch endpoint for single-request loading
        const response = await fetch(
          `/api/rt-plan/${selectedPlanSeriesId}/bev/${selectedBeamNumber}/all`,
          { signal: controller.signal }
        );
        
        if (response.ok) {
          const data = await response.json() as {
            beamNumber: number;
            beamName: string;
            totalControlPoints: number;
            bevProjections: BEVProjection[];
          };
          
          // Build cache from batch response
          const newCache = new Map<number, BEVProjection>();
          data.bevProjections.forEach((bev, idx) => {
            newCache.set(idx, bev);
          });
          
          setBevCache(newCache);
          console.log(`[BEV Cache] Loaded ${data.totalControlPoints} control points in single request`);
        } else {
          // Fallback: fetch individually if batch endpoint fails
          console.warn('[BEV Cache] Batch endpoint failed, falling back to individual requests');
          await fetchIndividualControlPoints(controller, numCP);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[BEV Cache] Batch fetch error:', err);
          // Try individual requests as fallback
          const controller2 = new AbortController();
          abortControllerRef.current = controller2;
          await fetchIndividualControlPoints(controller2, numCP);
        }
      } finally {
        setBevLoading(false);
        setCacheProgress(null);
      }
    };
    
    // Fallback function for individual fetches
    const fetchIndividualControlPoints = async (controller: AbortController, total: number) => {
      const newCache = new Map<number, BEVProjection>();
      if (initialBEV) {
        newCache.set(0, initialBEV);
      }
      
      const batchSize = 10;
      for (let i = 0; i < total; i += batchSize) {
        if (controller.signal.aborted) break;
        
        const batch = Array.from({ length: Math.min(batchSize, total - i) }, (_, j) => i + j);
        
        const results = await Promise.all(
          batch.map(async (cpIdx) => {
            if (cpIdx === 0 && initialBEV) return { cpIdx, bev: initialBEV };
            
            try {
              const res = await fetch(
                `/api/rt-plan/${selectedPlanSeriesId}/bev/${selectedBeamNumber}?controlPoint=${cpIdx}`,
                { signal: controller.signal }
              );
              if (res.ok) {
                return { cpIdx, bev: await res.json() as BEVProjection };
              }
            } catch { /* ignore */ }
            return null;
          })
        );
        
        for (const r of results) {
          if (r) newCache.set(r.cpIdx, r.bev);
        }
        
        setBevCache(new Map(newCache));
        setCacheProgress({ loaded: Math.min(i + batchSize, total), total });
      }
    };
    
    fetchAllControlPoints();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedPlanSeriesId, selectedBeamNumber, selectedBeam, initialBEV]);
  
  // Get current BEV from cache or fall back to initial
  const selectedBEV = useMemo(() => {
    const cached = bevCache.get(controlPointIndex);
    if (cached) return cached;
    return initialBEV;
  }, [bevCache, controlPointIndex, initialBEV]);
  
  // Helper function to get orientation labels based on gantry/couch angles
  const getOrientationLabels = useCallback((gantryAngle: number, couchAngle: number) => {
    // For HFS patient at gantry 0° (AP beam):
    // Right = Patient Left (L), Left = Patient Right (R)
    // Top = Superior (H = Head), Bottom = Inferior (F = Feet)
    const labels = { right: 'L', left: 'R', top: 'H', bottom: 'F' };
    const normalizedAngle = ((gantryAngle % 360) + 360) % 360;
    
    if (normalizedAngle >= 45 && normalizedAngle < 135) {
      // Left lateral (gantry ~90°)
      labels.right = 'P'; labels.left = 'A';
    } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
      // PA (gantry ~180°)
      labels.right = 'R'; labels.left = 'L';
    } else if (normalizedAngle >= 225 && normalizedAngle < 315) {
      // Right lateral (gantry ~270°)
      labels.right = 'A'; labels.left = 'P';
    }
    return labels;
  }, []);

  // Draw BEV visualization with enhanced features
  const drawBEV = useCallback(() => {
    const canvas = bevCanvasRef.current;
    if (!canvas || !selectedBEV) {
      console.log('[BEV] Cannot draw - canvas:', !!canvas, 'selectedBEV:', !!selectedBEV);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('[BEV] Cannot get 2D context');
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
      console.log('[BEV] Canvas has zero dimensions:', rect);
      return;
    }
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Calculate field size to determine appropriate scale
    const jaw = selectedBEV.jawAperture;
    const fieldWidth = Math.abs(jaw.x2 - jaw.x1);
    const fieldHeight = Math.abs(jaw.y2 - jaw.y1);
    const maxFieldDim = Math.max(fieldWidth, fieldHeight, 50);
    
    const autoScaleField = maxFieldDim + 100;
    const baseFieldSize = Math.max(autoScaleField, 200);
    const fieldScale = (Math.min(width, height) - 60) / (baseFieldSize / bevZoom);
    
    const beamIndex = planData?.beams.findIndex(b => b.beamNumber === selectedBeamNumber) || 0;
    const beamColor = getBeamColor(beamIndex);
    
    // --- Background ---
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);
    
    // --- Grid (50mm spacing) ---
    ctx.strokeStyle = 'rgba(70, 70, 90, 0.4)';
    ctx.lineWidth = 0.5;
    const gridSpacing = 50;
    for (let x = -200; x <= 200; x += gridSpacing) {
      const px = centerX + x * fieldScale;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    for (let y = -200; y <= 200; y += gridSpacing) {
      const py = centerY - y * fieldScale;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }
    
    // --- Crosshairs with tick marks ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    
    // Main crosshair lines
    ctx.beginPath();
    ctx.moveTo(centerX, 30);
    ctx.lineTo(centerX, height - 20);
    ctx.moveTo(30, centerY);
    ctx.lineTo(width - 30, centerY);
    ctx.stroke();
    
    // Tick marks every 10mm (small), 50mm (large)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    const tickSmall = 3;
    const tickLarge = 6;
    
    for (let mm = -200; mm <= 200; mm += 10) {
      if (mm === 0) continue;
      const px = centerX + mm * fieldScale;
      const py = centerY - mm * fieldScale;
      const isMajor = mm % 50 === 0;
      const tickSize = isMajor ? tickLarge : tickSmall;
      
      // Horizontal axis ticks (X)
      if (px > 30 && px < width - 30) {
        ctx.beginPath();
        ctx.moveTo(px, centerY - tickSize);
        ctx.lineTo(px, centerY + tickSize);
        ctx.stroke();
      }
      // Vertical axis ticks (Y)
      if (py > 30 && py < height - 20) {
        ctx.beginPath();
        ctx.moveTo(centerX - tickSize, py);
        ctx.lineTo(centerX + tickSize, py);
        ctx.stroke();
      }
    }
    
    // --- Draw blocks if present ---
    if (selectedBEV.blocks && selectedBEV.blocks.length > 0) {
      for (const block of selectedBEV.blocks) {
        if (block.contour.length < 3) continue;
        
        ctx.beginPath();
        ctx.moveTo(
          centerX + block.contour[0].x * fieldScale,
          centerY - block.contour[0].y * fieldScale
        );
        for (let i = 1; i < block.contour.length; i++) {
          ctx.lineTo(
            centerX + block.contour[i].x * fieldScale,
            centerY - block.contour[i].y * fieldScale
          );
        }
        ctx.closePath();
        
        if (block.blockType === 'SHIELDING') {
          ctx.fillStyle = 'rgba(80, 80, 100, 0.7)';
          ctx.strokeStyle = 'rgba(120, 120, 150, 0.9)';
        } else {
          // Aperture block
          ctx.fillStyle = 'rgba(30, 30, 40, 0.5)';
          ctx.strokeStyle = 'rgba(100, 100, 130, 0.8)';
        }
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    
    // --- Jaw aperture rectangle ---
    ctx.strokeStyle = 'rgba(150, 150, 180, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      centerX + jaw.x1 * fieldScale,
      centerY - jaw.y2 * fieldScale,
      (jaw.x2 - jaw.x1) * fieldScale,
      (jaw.y2 - jaw.y1) * fieldScale
    );
    
    // --- MLC aperture ---
    if (selectedBEV.mlcAperture && selectedBEV.mlcAperture.leaves.length > 0) {
      const mlc = selectedBEV.mlcAperture;
      const jawX1 = centerX + jaw.x1 * fieldScale;
      const jawX2 = centerX + jaw.x2 * fieldScale;
      const jawY1 = centerY - jaw.y2 * fieldScale;
      const jawY2 = centerY - jaw.y1 * fieldScale;
      
      // Blocked regions (outside MLC opening)
      ctx.fillStyle = 'rgba(15, 15, 25, 0.95)';
      for (const leaf of mlc.leaves) {
        const leafWidth = leaf.width || mlc.leafWidth;
        const y1 = centerY - (leaf.y + leafWidth / 2) * fieldScale;
        const y2 = centerY - (leaf.y - leafWidth / 2) * fieldScale;
        const x1 = centerX + leaf.x1 * fieldScale;
        const x2 = centerX + leaf.x2 * fieldScale;
        
        const clipY1 = Math.max(y1, jawY1);
        const clipY2 = Math.min(y2, jawY2);
        
        if (clipY2 > clipY1) {
          if (x1 > jawX1) ctx.fillRect(jawX1, clipY1, x1 - jawX1, clipY2 - clipY1);
          if (x2 < jawX2) ctx.fillRect(x2, clipY1, jawX2 - x2, clipY2 - clipY1);
        }
      }
      
      // Open field regions
      ctx.fillStyle = `${beamColor}45`;
      ctx.strokeStyle = beamColor;
      ctx.lineWidth = 1;
      
      for (const leaf of mlc.leaves) {
        const leafWidth = leaf.width || mlc.leafWidth;
        const y1 = centerY - (leaf.y + leafWidth / 2) * fieldScale;
        const y2 = centerY - (leaf.y - leafWidth / 2) * fieldScale;
        const x1 = centerX + leaf.x1 * fieldScale;
        const x2 = centerX + leaf.x2 * fieldScale;
        
        const clipY1 = Math.max(y1, jawY1);
        const clipY2 = Math.min(y2, jawY2);
        
        if (clipY2 > clipY1 && x2 > x1) {
          ctx.fillRect(x1, clipY1, x2 - x1, clipY2 - clipY1);
          ctx.strokeRect(x1, clipY1, x2 - x1, clipY2 - clipY1);
        }
      }
      
      // Leaf boundaries
      ctx.strokeStyle = 'rgba(80, 80, 100, 0.4)';
      ctx.lineWidth = 0.5;
      for (const leaf of mlc.leaves) {
        const leafWidth = leaf.width || mlc.leafWidth;
        const y = centerY - (leaf.y + leafWidth / 2) * fieldScale;
        ctx.beginPath();
        ctx.moveTo(jawX1, y);
        ctx.lineTo(jawX2, y);
        ctx.stroke();
      }
    } else {
      // Simple rectangular field (no MLC)
      const aperX = centerX + jaw.x1 * fieldScale;
      const aperY = centerY - jaw.y2 * fieldScale;
      const aperW = (jaw.x2 - jaw.x1) * fieldScale;
      const aperH = (jaw.y2 - jaw.y1) * fieldScale;
      
      ctx.fillStyle = `${beamColor}55`;
      ctx.fillRect(aperX, aperY, aperW, aperH);
      ctx.strokeStyle = beamColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(aperX, aperY, aperW, aperH);
    }
    
    // --- Wedge indicator ---
    if (selectedBEV.wedges && selectedBEV.wedges.length > 0) {
      for (const wedge of selectedBEV.wedges) {
        const wedgeRad = (wedge.wedgeOrientation * Math.PI) / 180;
        const wedgeColor = '#FF8C00'; // Dark orange
        const wedgeLength = Math.min(fieldWidth, fieldHeight) * 0.4 * fieldScale;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-wedgeRad);
        
        // Draw wedge triangle indicator
        ctx.beginPath();
        ctx.moveTo(0, -wedgeLength * 0.3);
        ctx.lineTo(-wedgeLength * 0.15, wedgeLength * 0.3);
        ctx.lineTo(wedgeLength * 0.15, wedgeLength * 0.3);
        ctx.closePath();
        
        ctx.fillStyle = `${wedgeColor}60`;
        ctx.fill();
        ctx.strokeStyle = wedgeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Wedge angle label
        ctx.fillStyle = wedgeColor;
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${wedge.wedgeAngle}°W`, 0, wedgeLength * 0.5);
        
        ctx.restore();
      }
    }
    
    // --- Central axis marker ---
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = beamColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Inner dot
    ctx.fillStyle = beamColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // --- Orientation labels ---
    const orientLabels = getOrientationLabels(selectedBEV.gantryAngle, selectedBEV.couchAngle);
    ctx.font = 'bold 14px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Right
    ctx.fillText(orientLabels.right, width - 18, centerY);
    // Left
    ctx.fillText(orientLabels.left, 18, centerY);
    // Top (superior in BEV)
    ctx.fillText(orientLabels.top, centerX, 18);
    // Bottom
    ctx.fillText(orientLabels.bottom, centerX, height - 10);
    
    // --- Beam name header ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, 28);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(selectedBEV.beamName, centerX, 6);
    
    // --- Bottom info bar ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, height - 24, width, 24);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${fieldWidth.toFixed(0)}×${fieldHeight.toFixed(0)}mm`, 8, height - 12);
    
    ctx.textAlign = 'right';
    ctx.fillText(
      `G${selectedBEV.gantryAngle.toFixed(1)}° C${selectedBEV.collimatorAngle.toFixed(1)}° T${selectedBEV.couchAngle.toFixed(1)}°`,
      width - 8,
      height - 12
    );
    
  }, [selectedBEV, bevZoom, planData, selectedBeamNumber, getOrientationLabels]);
  
  // Redraw BEV when dependencies change
  useEffect(() => {
    // Use requestAnimationFrame to ensure canvas is in DOM with dimensions
    const rafId = requestAnimationFrame(() => {
      drawBEV();
    });
    return () => cancelAnimationFrame(rafId);
  }, [drawBEV, selectedBEV, bevZoom]);
  
  // Also redraw when planData changes (initial load)
  useEffect(() => {
    if (planData && selectedBEV) {
      const timeoutId = setTimeout(() => {
        drawBEV();
      }, 100); // Small delay to ensure DOM is ready
      return () => clearTimeout(timeoutId);
    }
  }, [planData, selectedBEV, drawBEV]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => drawBEV();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawBEV]);
  
  // Smooth animation using requestAnimationFrame (commercial-grade)
  const animationFrameRef = useRef<number | null>(null);
  const lastAnimationTimeRef = useRef<number>(0);
  
  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    
    if (!animatingArc || !selectedBeam) {
      cleanup();
      return;
    }
    
    const maxCP = selectedBeam.numberOfControlPoints - 1;
    
    if (maxCP <= 1) {
      console.log('[Animation] Not enough control points to animate:', maxCP);
      setAnimatingArc(false);
      return;
    }
    
    // Animation settings for smooth playback
    // Complete arc rotation in ~8 seconds for commercial presentation
    const totalDurationMs = 8000;
    const msPerControlPoint = totalDurationMs / maxCP;
    
    console.log('[Animation] Starting smooth arc animation:', { 
      maxCP, 
      totalDurationMs, 
      msPerCP: msPerControlPoint.toFixed(1),
      cachedFrames: bevCache.size 
    });
    
    const animate = (timestamp: number) => {
      if (!lastAnimationTimeRef.current) {
        lastAnimationTimeRef.current = timestamp;
      }
      
      const elapsed = timestamp - lastAnimationTimeRef.current;
      
      if (elapsed >= msPerControlPoint) {
        lastAnimationTimeRef.current = timestamp;
        
        setControlPointIndex(prev => {
          const next = prev + 1;
          if (next > maxCP) {
            return 0; // Loop
          }
          return next;
        });
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    lastAnimationTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return cleanup;
  }, [animatingArc, selectedBeam, bevCache.size]);
  
  // Format angle for display
  const formatAngle = (angle: number) => `${angle.toFixed(1)}°`;
  
  // No plan series available
  if (planSeriesOptions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
        No RT Plan found for this study
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Plan Series Selector */}
      {planSeriesOptions.length > 1 && (
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Plan Series</span>
          <div className="space-y-1.5">
            {planSeriesOptions.map((plan) => {
              const isActive = plan.id === selectedPlanSeriesId;
              return (
                <button
                  key={plan.id}
                  onClick={() => onPlanSeriesSelect(isActive ? null : plan.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 ring-1 ring-blue-500/30'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    isActive ? "text-blue-200" : "text-zinc-400"
                  )}>
                    {plan.seriesDescription || 'RT Plan'}
                  </span>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Auto-select single plan */}
      {planSeriesOptions.length === 1 && !selectedPlanSeriesId && (
        <Button
          variant="ghost"
          onClick={() => onPlanSeriesSelect(planSeriesOptions[0].id)}
          className="w-full h-8 text-xs rounded-lg text-zinc-200 hover:bg-zinc-500/20"
        >
          <Zap className="w-3.5 h-3.5 mr-1.5" />
          Load Plan: {planSeriesOptions[0].seriesDescription || 'RT Plan'}
        </Button>
      )}
      
      {/* Loading State */}
      {(isLoading || externalLoading) && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin mr-2" />
          <span className="text-sm text-zinc-400">Loading plan data...</span>
        </div>
      )}
      
      {/* Error State */}
      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {loadError}
        </div>
      )}
      
      {/* Plan Data Display */}
      {planData && !isLoading && (
        <>
          {/* Plan Metadata - Clinical Information */}
          <div className="rounded-xl bg-black/30 border border-zinc-600/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-100">
                {planData.metadata.planName || planData.metadata.planLabel || 'RT Plan'}
              </span>
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-300">
                {planData.metadata.numberOfBeams} {planData.metadata.numberOfBeams === 1 ? 'Beam' : 'Beams'}
              </Badge>
            </div>
            
            {/* Plan Date & Machine */}
            <div className="text-[10px] text-zinc-500">
              {planData.metadata.planDate ? (
                // Format DICOM date (YYYYMMDD) to readable format
                (() => {
                  const d = planData.metadata.planDate;
                  if (d.length === 8) {
                    return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
                  }
                  return d;
                })()
              ) : (
                <span className="text-zinc-600">Date not specified</span>
              )}
              {' • '}
              {planData.metadata.treatmentMachineName || <span className="text-zinc-600">Machine not specified</span>}
            </div>
            
            {/* Prescription Info - Critical Clinical Data */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-700/50">
              <div>
                <div className="text-[9px] text-zinc-500 uppercase">Fractions</div>
                <div className="text-xs font-medium text-zinc-200">
                  {planData.metadata.numberOfFractions !== undefined && planData.metadata.numberOfFractions !== null ? (
                    planData.metadata.numberOfFractions
                  ) : (
                    <span className="text-amber-500/80">Not in DICOM</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 uppercase">Prescription</div>
                <div className="text-xs font-medium text-zinc-200">
                  {planData.metadata.prescribedDose !== undefined && planData.metadata.prescribedDose !== null ? (
                    `${planData.metadata.prescribedDose.toFixed(2)} Gy`
                  ) : (
                    <span className="text-amber-500/80">Not in DICOM</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Warning for missing critical data */}
            {(!planData.metadata.numberOfFractions || !planData.metadata.prescribedDose) && (
              <div className="text-[9px] text-amber-500/70 bg-amber-500/10 rounded px-2 py-1 mt-1">
                ⚠ Some prescription data not found in RT Plan DICOM. Verify in TPS.
              </div>
            )}
          </div>
          
          {/* Beam Overlay Toggle */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-zinc-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Beam Overlay</span>
            </div>
            <button
              onClick={() => onShowBeamOverlayChange(!showBeamOverlay)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-all duration-200",
                showBeamOverlay 
                  ? "bg-gradient-to-r from-blue-600 to-blue-500" 
                  : "bg-zinc-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200",
                  showBeamOverlay ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>
          
          {/* Beam Overlay Opacity */}
          {showBeamOverlay && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Overlay Opacity</span>
                <span className="text-xs text-zinc-300 tabular-nums">{Math.round(beamOverlayOpacity * 100)}%</span>
              </div>
              <Slider
                value={[beamOverlayOpacity]}
                min={0.1}
                max={1}
                step={0.05}
                onValueChange={([v]) => onBeamOverlayOpacityChange(v)}
                className="[&_[role=slider]]:bg-blue-400 [&_[role=slider]]:border-blue-500"
              />
            </div>
          )}
          
          {/* Beam List */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Beams</span>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {planData.beams.map((beam, index) => {
                const isSelected = beam.beamNumber === selectedBeamNumber;
                const color = getBeamColor(index);
                
                return (
                  <button
                    key={beam.beamNumber}
                    onClick={() => onSelectBeam(isSelected ? null : beam.beamNumber)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200',
                      isSelected
                        ? 'bg-zinc-700/50 ring-1 ring-zinc-500/50'
                        : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color, boxShadow: isSelected ? `0 0 8px ${color}` : 'none' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-xs font-medium truncate",
                          isSelected ? "text-white" : "text-zinc-300"
                        )}>
                          {beam.beamName}
                        </span>
                        <span className="text-[10px] text-zinc-500 ml-2">
                          G{formatAngle(beam.gantryAngle)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span>{beam.radiationType}</span>
                        {beam.nominalEnergy && <span>{beam.nominalEnergy}MV</span>}
                        {beam.fieldSizeX && beam.fieldSizeY && (
                          <span>{beam.fieldSizeX.toFixed(0)}×{beam.fieldSizeY.toFixed(0)}mm</span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Eye className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* BEV (Beam's Eye View) */}
          {selectedBeam && selectedBEV && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Beam's Eye View
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setBevZoom(Math.max(0.5, bevZoom - 0.25))}
                    className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200"
                    disabled={bevZoom <= 0.5}
                  >
                    <span className="text-xs">-</span>
                  </Button>
                  <span className="text-[10px] text-zinc-400 w-8 text-center">{bevZoom.toFixed(2)}×</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setBevZoom(Math.min(3, bevZoom + 0.25))}
                    className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200"
                    disabled={bevZoom >= 3}
                  >
                    <span className="text-xs">+</span>
                  </Button>
                  {onToggleExpandBEV && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onToggleExpandBEV}
                      className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div 
                className={cn(
                  "rounded-xl border border-zinc-600/30 overflow-hidden bg-[#0a0a0f] relative",
                  expandBEV ? "h-80" : "h-48"
                )}
              >
                <canvas
                  ref={bevCanvasRef}
                  className="w-full h-full"
                  style={{ display: 'block' }}
                />
                {/* Pre-caching progress overlay */}
                {cacheProgress && (
                  <div className="absolute bottom-8 left-2 right-2 bg-black/70 rounded px-2 py-1">
                    <div className="flex items-center justify-between text-[9px] text-zinc-400 mb-1">
                      <span>Pre-loading control points...</span>
                      <span>{cacheProgress.loaded}/{cacheProgress.total}</span>
                    </div>
                    <div className="h-1 bg-zinc-700 rounded overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-150"
                        style={{ width: `${(cacheProgress.loaded / cacheProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* Animation indicator */}
                {animatingArc && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-green-500/20 border border-green-500/30 px-2 py-1 rounded text-[10px] text-green-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>
              
              {/* Beam Details */}
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-zinc-800/30 rounded-lg px-2 py-1.5">
                  <div className="text-zinc-500">Gantry</div>
                  <div className="text-zinc-200 font-medium">{formatAngle(selectedBEV.gantryAngle)}</div>
                </div>
                <div className="bg-zinc-800/30 rounded-lg px-2 py-1.5">
                  <div className="text-zinc-500">Collimator</div>
                  <div className="text-zinc-200 font-medium">{formatAngle(selectedBEV.collimatorAngle)}</div>
                </div>
                <div className="bg-zinc-800/30 rounded-lg px-2 py-1.5">
                  <div className="text-zinc-500">Couch</div>
                  <div className="text-zinc-200 font-medium">{formatAngle(selectedBEV.couchAngle)}</div>
                </div>
              </div>
              
              {/* Isocenter Position */}
              <div className="bg-zinc-800/30 rounded-lg px-2 py-1.5 text-[10px]">
                <div className="text-zinc-500 mb-1">Isocenter Position (mm)</div>
                <div className="flex gap-3 text-zinc-300">
                  <span>X: {selectedBEV.isocenterPosition[0].toFixed(1)}</span>
                  <span>Y: {selectedBEV.isocenterPosition[1].toFixed(1)}</span>
                  <span>Z: {selectedBEV.isocenterPosition[2].toFixed(1)}</span>
                </div>
              </div>
              
              {/* VMAT/Arc Controls - Professional Animation Interface */}
              {selectedBeam.numberOfControlPoints > 2 && (
                <div className="space-y-2 bg-zinc-800/20 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[9px] px-1.5 py-0.5",
                          selectedBeam.beamType === 'DYNAMIC' 
                            ? "border-purple-500/40 text-purple-300" 
                            : "border-zinc-500/40 text-zinc-400"
                        )}
                      >
                        {selectedBeam.beamType === 'DYNAMIC' ? 'VMAT ARC' : 'STEP & SHOOT'}
                      </Badge>
                      <span className="text-[10px] text-zinc-400">
                        CP {controlPointIndex + 1}/{selectedBeam.numberOfControlPoints}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setAnimatingArc(false);
                          setControlPointIndex(0);
                        }}
                        className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200"
                        title="Reset to start"
                      >
                        <RotateCw className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setControlPointIndex(Math.max(0, controlPointIndex - 1))}
                        className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200"
                        disabled={controlPointIndex === 0 || animatingArc}
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAnimatingArc(!animatingArc)}
                        className={cn(
                          "h-7 w-7 rounded-full transition-all",
                          animatingArc 
                            ? "bg-green-500/20 text-green-300 hover:bg-green-500/30" 
                            : "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                        )}
                        disabled={bevCache.size < selectedBeam.numberOfControlPoints * 0.5}
                        title={bevCache.size < selectedBeam.numberOfControlPoints * 0.5 ? "Loading frames..." : animatingArc ? "Pause" : "Play"}
                      >
                        {animatingArc ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setControlPointIndex(Math.min(selectedBeam.numberOfControlPoints - 1, controlPointIndex + 1))}
                        className="h-6 w-6 rounded text-zinc-400 hover:text-zinc-200"
                        disabled={controlPointIndex === selectedBeam.numberOfControlPoints - 1 || animatingArc}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Arc Progress Bar with Gantry Angle */}
                  <div className="relative">
                    <Slider
                      value={[controlPointIndex]}
                      min={0}
                      max={selectedBeam.numberOfControlPoints - 1}
                      step={1}
                      onValueChange={([v]) => {
                        if (!animatingArc) setControlPointIndex(v);
                      }}
                      disabled={animatingArc}
                      className={cn(
                        "[&_[role=slider]]:bg-blue-400 [&_[role=slider]]:border-blue-500",
                        animatingArc && "[&_[role=slider]]:bg-green-400 [&_[role=slider]]:border-green-500"
                      )}
                    />
                  </div>
                  
                  {/* Gantry angle range display */}
                  <div className="flex justify-between text-[9px] text-zinc-500">
                    <span>G: {selectedBEV?.gantryAngle.toFixed(1)}°</span>
                    <span className="text-zinc-600">
                      {bevCache.size}/{selectedBeam.numberOfControlPoints} frames cached
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* More Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showDetails ? 'Less' : 'More Details'}
          </button>
          
          {/* Advanced Details */}
          {showDetails && selectedBeam && (
            <div className="rounded-xl bg-black/30 border border-zinc-600/20 p-3 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Beam Details</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-zinc-500">Type: </span>
                  <span className="text-zinc-300">{selectedBeam.beamType}</span>
                </div>
                <div>
                  <span className="text-zinc-500">SAD: </span>
                  <span className="text-zinc-300">{selectedBeam.sourceAxisDistance}mm</span>
                </div>
                <div>
                  <span className="text-zinc-500">Energy: </span>
                  <span className="text-zinc-300">{selectedBeam.nominalEnergy || 'N/A'} MV</span>
                </div>
                <div>
                  <span className="text-zinc-500">Control Points: </span>
                  <span className="text-zinc-300">{selectedBeam.numberOfControlPoints}</span>
                </div>
              </div>
              {selectedBeam.treatmentMachineName && (
                <div className="text-[10px]">
                  <span className="text-zinc-500">Machine: </span>
                  <span className="text-zinc-300">{selectedBeam.treatmentMachineName}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RTPlanPanel;
