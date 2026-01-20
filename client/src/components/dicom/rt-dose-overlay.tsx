/**
 * RTDoseOverlay - React component for displaying RT Dose overlays
 * 
 * Renders dose color wash and isodose lines on a canvas overlay,
 * synchronized with the main DICOM viewport.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDoseOptional } from '@/dose/dose-context';
import type { IsodoseLine, DoseOverlayCanvas } from '@/lib/rt-dose-manager';

interface RTDoseOverlayProps {
  /** Reference to the main viewport canvas for positioning */
  viewportRef: React.RefObject<HTMLDivElement>;
  
  /** Current slice Z position in patient coordinates */
  slicePosition: number;
  
  /** Image dimensions in pixels */
  imageWidth: number;
  imageHeight: number;
  
  /** Canvas dimensions (may differ from image) */
  canvasWidth: number;
  canvasHeight: number;
  
  /** Viewport transform */
  zoom: number;
  panX: number;
  panY: number;
  
  /** Optional callback when dose value at mouse position changes */
  onDoseHover?: (dose: number | null, position: { x: number; y: number } | null) => void;
  
  /** DICOM metadata for coordinate transformation */
  imageMetadata?: {
    imagePosition?: number[] | string;
    pixelSpacing?: number[] | string;
    imageOrientation?: number[] | string;
  };
}

export function RTDoseOverlay({
  viewportRef,
  slicePosition,
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
  zoom,
  panX,
  panY,
  onDoseHover,
  imageMetadata,
}: RTDoseOverlayProps) {
  const doseContext = useDoseOptional();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isodoseCanvasRef = useRef<HTMLCanvasElement>(null);
  const [overlay, setOverlay] = useState<DoseOverlayCanvas | null>(null);
  const [isodoseLines, setIsodoseLines] = useState<IsodoseLine[]>([]);
  
  // Load dose overlay for current slice
  useEffect(() => {
    if (!doseContext || !doseContext.hasDoseOverlay) {
      setOverlay(null);
      return;
    }

    let cancelled = false;

    const loadOverlay = async () => {
      try {
        const result = await doseContext.getOverlayForSlice({
          slicePosition,
          imageWidth: canvasWidth,
          imageHeight: canvasHeight,
        });

        if (!cancelled) {
          setOverlay(result);
        }
      } catch (error) {
        console.warn('Failed to load dose overlay:', error);
        if (!cancelled) {
          setOverlay(null);
        }
      }
    };

    loadOverlay();

    return () => {
      cancelled = true;
    };
  }, [doseContext, slicePosition, canvasWidth, canvasHeight]);

  // Load isodose contours
  useEffect(() => {
    if (!doseContext || !doseContext.config.showIsodose) {
      setIsodoseLines([]);
      return;
    }

    let cancelled = false;

    const loadIsodose = async () => {
      try {
        const lines = await doseContext.getIsodoseContours(slicePosition);
        if (!cancelled) {
          setIsodoseLines(lines);
        }
      } catch (error) {
        console.warn('Failed to load isodose contours:', error);
        if (!cancelled) {
          setIsodoseLines([]);
        }
      }
    };

    loadIsodose();

    return () => {
      cancelled = true;
    };
  }, [doseContext, slicePosition]);

  // Render dose color wash
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !overlay) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!overlay.hasSignal) return;

    // Apply viewport transform
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2 + panX, -canvas.height / 2 + panY);

    // Draw dose overlay
    ctx.globalAlpha = doseContext?.config.opacity ?? 0.5;
    ctx.drawImage(overlay.canvas, 0, 0, canvas.width, canvas.height);

    ctx.restore();
  }, [overlay, zoom, panX, panY, doseContext?.config.opacity]);

  // Render isodose lines
  useEffect(() => {
    const canvas = isodoseCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isodoseLines.length === 0) return;

    // Apply viewport transform
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2 + panX, -canvas.height / 2 + panY);

    // Get scale factors from dose grid to canvas
    const scaleX = canvas.width / imageWidth;
    const scaleY = canvas.height / imageHeight;

    // Draw each isodose line
    const lineWidth = (doseContext?.config.isodoseLineWidth ?? 2) / zoom;

    for (const line of isodoseLines) {
      const [r, g, b] = line.color;
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const contour of line.contours) {
        if (contour.length < 4) continue;

        ctx.beginPath();
        ctx.moveTo(contour[0] * scaleX, contour[1] * scaleY);

        for (let i = 2; i < contour.length; i += 2) {
          ctx.lineTo(contour[i] * scaleX, contour[i + 1] * scaleY);
        }

        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [isodoseLines, zoom, panX, panY, imageWidth, imageHeight, doseContext?.config.isodoseLineWidth]);

  // Mouse hover for dose readout
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onDoseHover || !overlay?.hasSignal) {
      onDoseHover?.(null, null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Transform mouse position to image coordinates
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Reverse the viewport transform
    const imageX = (x - centerX) / zoom + centerX - panX;
    const imageY = (y - centerY) / zoom + centerY - panY;

    // Check if within image bounds
    if (imageX < 0 || imageX >= canvas.width || imageY < 0 || imageY >= canvas.height) {
      onDoseHover(null, null);
      return;
    }

    // Get dose value from overlay canvas pixel
    const overlayCtx = overlay.canvas.getContext('2d');
    if (!overlayCtx) {
      onDoseHover(null, null);
      return;
    }

    // For now, just report position - actual dose lookup requires dose data access
    onDoseHover(null, { x: imageX, y: imageY });
  }, [overlay, onDoseHover, zoom, panX, panY]);

  const handleMouseLeave = useCallback(() => {
    onDoseHover?.(null, null);
  }, [onDoseHover]);

  // Don't render if no dose context or not visible
  if (!doseContext || !doseContext.hasDoseOverlay) {
    return null;
  }

  return (
    <>
      {/* Dose color wash canvas */}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="absolute inset-0 pointer-events-none"
        style={{ 
          zIndex: 10,
          mixBlendMode: 'screen',
        }}
      />
      
      {/* Isodose lines canvas (on top) */}
      <canvas
        ref={isodoseCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="absolute inset-0"
        style={{ zIndex: 11 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </>
  );
}

// ============================================================================
// Dose Legend Component
// ============================================================================

interface DoseLegendProps {
  position?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function DoseLegend({ position = 'right', className = '' }: DoseLegendProps) {
  const doseContext = useDoseOptional();
  
  if (!doseContext || !doseContext.hasDoseOverlay) {
    return null;
  }

  const { config, metadata } = doseContext;
  const { thresholds, colormap, isodoseLevels, showIsodose } = config;
  const prescription = thresholds.prescription || thresholds.max;

  // Generate gradient stops for the colorbar
  const getGradientStops = () => {
    const stops: string[] = [];
    const numStops = 10;
    
    for (let i = 0; i <= numStops; i++) {
      const normalized = i / numStops;
      // Using CSS variables would be cleaner, but for now just use the key colors
      const colors: Record<string, string[]> = {
        rainbow: ['#000080', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff8000', '#ff0000'],
        hot: ['#000000', '#b40000', '#ff5000', '#ffb400', '#ffff64', '#ffffff'],
        jet: ['#000080', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000', '#800000'],
        cool: ['#00ffff', '#00c8ff', '#8080ff', '#c840ff', '#ff00ff'],
        dosimetry: ['#0000b4', '#00b4ff', '#00ff00', '#ffff00', '#ff8000', '#ff0000', '#ff0080'],
        grayscale: ['#282828', '#808080', '#ffffff'],
      };
      
      const palette = colors[colormap] || colors.rainbow;
      const idx = Math.floor(normalized * (palette.length - 1));
      stops.push(palette[Math.min(idx, palette.length - 1)]);
    }
    
    return stops.join(', ');
  };

  const isVertical = position === 'left' || position === 'right';

  return (
    <div
      className={`
        flex gap-2 p-2 bg-black/60 backdrop-blur-sm rounded-lg
        ${isVertical ? 'flex-col items-center w-16' : 'flex-row items-end h-12'}
        ${className}
      `}
    >
      {/* Colorbar */}
      <div
        className={`
          rounded-sm
          ${isVertical ? 'w-4 h-32' : 'h-4 w-32'}
        `}
        style={{
          background: isVertical
            ? `linear-gradient(to top, ${getGradientStops()})`
            : `linear-gradient(to right, ${getGradientStops()})`,
        }}
      />
      
      {/* Labels */}
      <div
        className={`
          flex text-[10px] text-white/80 font-mono
          ${isVertical ? 'flex-col justify-between h-32' : 'flex-row justify-between w-32'}
        `}
      >
        <span>{thresholds.max?.toFixed(0) || '?'} Gy</span>
        <span className="text-yellow-400">
          {prescription?.toFixed(0) || '?'} Gy
        </span>
        <span>{thresholds.min?.toFixed(1) || '0'} Gy</span>
      </div>

      {/* Isodose legend */}
      {showIsodose && (
        <div className={`
          flex gap-1 flex-wrap
          ${isVertical ? 'flex-col' : 'flex-row ml-4'}
        `}>
          {isodoseLevels.slice(0, 5).map((level) => (
            <div
              key={level}
              className="flex items-center gap-1"
            >
              <div
                className="w-3 h-[2px]"
                style={{
                  backgroundColor: getIsodoseColorCSS(level),
                }}
              />
              <span className="text-[9px] text-white/70">{level}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getIsodoseColorCSS(percentage: number): string {
  const colors: Record<number, string> = {
    107: '#ff0080',
    105: '#ff0000',
    100: '#ff8000',
    95: '#ffff00',
    90: '#00ff00',
    80: '#00ffff',
    70: '#0080ff',
    50: '#0000ff',
    30: '#8000ff',
    10: '#404040',
  };
  
  // Find closest
  const levels = Object.keys(colors).map(Number).sort((a, b) => b - a);
  for (const level of levels) {
    if (percentage >= level - 2) {
      return colors[level];
    }
  }
  return '#404040';
}

// ============================================================================
// Dose Control Panel Component
// ============================================================================

interface DoseControlPanelProps {
  className?: string;
  compact?: boolean;
}

export function DoseControlPanel({ className = '', compact = false }: DoseControlPanelProps) {
  const doseContext = useDoseOptional();
  
  if (!doseContext) {
    return null;
  }

  const {
    availableDoseSeries,
    selectedDoseSeriesId,
    loadStatus,
    config,
    isVisible,
    selectDoseSeries,
    setColormap,
    setOpacity,
    setPrescriptionDose,
    toggleIsodoseLines,
    toggleVisible,
  } = doseContext;

  if (availableDoseSeries.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={toggleVisible}
          className={`
            px-2 py-1 text-xs rounded transition-colors
            ${isVisible 
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' 
              : 'bg-gray-700 text-gray-400 border border-gray-600'
            }
          `}
        >
          Dose
        </button>
        
        {isVisible && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-16 h-1 accent-orange-500"
            title="Dose opacity"
          />
        )}
      </div>
    );
  }

  return (
    <div className={`
      flex flex-col gap-3 p-3 bg-[#1a1d24] rounded-lg border border-white/10
      ${className}
    `}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/90">RT Dose</h3>
        <button
          onClick={toggleVisible}
          className={`
            w-8 h-4 rounded-full transition-colors relative
            ${isVisible ? 'bg-orange-500' : 'bg-gray-600'}
          `}
        >
          <div
            className={`
              absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform
              ${isVisible ? 'translate-x-4' : 'translate-x-0.5'}
            `}
          />
        </button>
      </div>

      {isVisible && (
        <>
          {/* Series selector */}
          {availableDoseSeries.length > 1 && (
            <select
              value={selectedDoseSeriesId || ''}
              onChange={(e) => selectDoseSeries(parseInt(e.target.value) || null)}
              className="w-full px-2 py-1 text-xs bg-[#0f1219] border border-white/10 rounded text-white"
            >
              {availableDoseSeries.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.description}
                </option>
              ))}
            </select>
          )}

          {/* Colormap selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60 w-16">Colormap</label>
            <select
              value={config.colormap}
              onChange={(e) => setColormap(e.target.value as any)}
              className="flex-1 px-2 py-1 text-xs bg-[#0f1219] border border-white/10 rounded text-white"
            >
              <option value="rainbow">Rainbow</option>
              <option value="hot">Hot</option>
              <option value="jet">Jet</option>
              <option value="cool">Cool</option>
              <option value="dosimetry">Dosimetry</option>
              <option value="grayscale">Grayscale</option>
            </select>
          </div>

          {/* Opacity slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60 w-16">Opacity</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-orange-500"
            />
            <span className="text-xs text-white/60 w-8">
              {Math.round(config.opacity * 100)}%
            </span>
          </div>

          {/* Prescription dose */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60 w-16">Rx Dose</label>
            <input
              type="number"
              value={config.thresholds.prescription || ''}
              onChange={(e) => setPrescriptionDose(parseFloat(e.target.value) || 0)}
              className="flex-1 px-2 py-1 text-xs bg-[#0f1219] border border-white/10 rounded text-white"
              placeholder="Gy"
              step={0.5}
            />
            <span className="text-xs text-white/60">Gy</span>
          </div>

          {/* Isodose toggle */}
          <button
            onClick={toggleIsodoseLines}
            className={`
              px-3 py-1.5 text-xs rounded transition-colors
              ${config.showIsodose
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'bg-gray-700/50 text-gray-400 border border-gray-600'
              }
            `}
          >
            {config.showIsodose ? '◉ Isodose Lines' : '○ Show Isodose'}
          </button>

          {/* Status indicator */}
          {loadStatus === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Loading dose data...
            </div>
          )}
          
          {loadStatus === 'error' && (
            <div className="text-xs text-red-400">
              Failed to load dose data
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RTDoseOverlay;




