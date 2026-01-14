/**
 * DVH Viewer Page
 * 
 * Standalone DVH viewer matching the prototype design.
 * Opens in a popup window from the Dose Control Panel.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Download,
  Copy,
  RefreshCw,
  Loader2,
  Check
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DVHPoint {
  dose: number;
  volume: number;
}

interface DVHStatistics {
  min: number;
  max: number;
  mean: number;
  d95: number;
  d50: number;
  d2: number;
  v100?: number;
}

interface DVHCurve {
  roiNumber: number;
  roiName: string;
  color: string;
  volumeCc: number;
  points: DVHPoint[];
  statistics: DVHStatistics;
}

interface DVHData {
  doseSeriesId: number;
  structureSetId: number;
  prescriptionDose: number;
  curves: DVHCurve[];
}

interface StructureDisplay {
  roiNumber: number;
  roiName: string;
  color: string;
  volumeCc: number;
  statistics: DVHStatistics;
  selected: boolean;
  points: DVHPoint[];
}

// ============================================================================
// Constants
// ============================================================================

const DVH_CHART_WIDTH = 520;
const DVH_CHART_HEIGHT = 280;
const DVH_PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

// ============================================================================
// Component
// ============================================================================

export default function DVHViewerPage() {
  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const doseSeriesId = parseInt(params.get('doseSeriesId') || '0', 10);
  const structureSetId = params.get('structureSetId') ? parseInt(params.get('structureSetId')!, 10) : undefined;
  const initialPrescriptionDose = parseFloat(params.get('prescriptionDose') || '60');
  const doseUnit = (params.get('doseUnit') || 'Gy') as 'Gy' | 'cGy';

  // State
  const [structures, setStructures] = useState<StructureDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cumulative' | 'differential'>('cumulative');
  const [xAxisUnit, setXAxisUnit] = useState<'Gy' | 'percent'>('Gy');
  const [yAxisUnit, setYAxisUnit] = useState<'percent' | 'cc'>('percent');
  const [prescriptionDose, setPrescriptionDose] = useState(initialPrescriptionDose);
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number; dose: number; volume: number } | null>(null);
  const [dxxQuery, setDxxQuery] = useState('93');
  const [vxxQuery, setVxxQuery] = useState('100');

  // Chart dimensions
  const plotWidth = DVH_CHART_WIDTH - DVH_PADDING.left - DVH_PADDING.right;
  const plotHeight = DVH_CHART_HEIGHT - DVH_PADDING.top - DVH_PADDING.bottom;

  // Calculate max dose for chart
  const maxDoseForChart = useMemo(() => {
    const selectedStructs = structures.filter(s => s.selected);
    if (selectedStructs.length === 0) return 80;
    
    let maxDose = 0;
    selectedStructs.forEach(s => {
      if (s.statistics.max > maxDose) maxDose = s.statistics.max;
    });
    return Math.ceil(maxDose / 10) * 10 + 10;
  }, [structures]);

  // Coordinate scaling functions
  const scaleX = useCallback((dose: number) => {
    const maxDose = xAxisUnit === 'percent' ? 120 : maxDoseForChart;
    return DVH_PADDING.left + (dose / maxDose) * plotWidth;
  }, [xAxisUnit, maxDoseForChart, plotWidth]);

  const scaleY = useCallback((volume: number) => {
    return DVH_PADDING.top + (1 - volume / 100) * plotHeight;
  }, [plotHeight]);

  const unscaleX = useCallback((px: number) => {
    const maxDose = xAxisUnit === 'percent' ? 120 : maxDoseForChart;
    return Math.max(0, ((px - DVH_PADDING.left) / plotWidth) * maxDose);
  }, [xAxisUnit, maxDoseForChart, plotWidth]);

  const unscaleY = useCallback((py: number) => {
    return Math.max(0, Math.min(100, (1 - (py - DVH_PADDING.top) / plotHeight) * 100));
  }, [plotHeight]);

  // Fetch DVH data
  const fetchDVH = useCallback(async () => {
    if (!doseSeriesId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const urlParams = new URLSearchParams();
      if (structureSetId) urlParams.append('structureSetId', structureSetId.toString());
      urlParams.append('prescriptionDose', prescriptionDose.toString());
      
      const response = await fetch(`/api/dvh/${doseSeriesId}?${urlParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch DVH: ${response.statusText}`);
      }
      
      const data: DVHData = await response.json();
      
      // Convert to display format with selection state
      const displayStructures: StructureDisplay[] = data.curves.map(curve => ({
        roiNumber: curve.roiNumber,
        roiName: curve.roiName,
        color: curve.color,
        volumeCc: curve.volumeCc,
        statistics: curve.statistics,
        selected: true, // Select all by default
        points: curve.points,
      }));
      
      setStructures(displayStructures);
    } catch (err) {
      console.error('DVH fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load DVH data');
    } finally {
      setLoading(false);
    }
  }, [doseSeriesId, structureSetId, prescriptionDose]);

  useEffect(() => {
    if (doseSeriesId) {
      fetchDVH();
    }
  }, [doseSeriesId, fetchDVH]);

  // Toggle structure selection
  const toggleStructure = (roiNumber: number) => {
    setStructures(prev => prev.map(s => 
      s.roiNumber === roiNumber ? { ...s, selected: !s.selected } : s
    ));
  };

  // Get selected structures
  const selectedStructures = useMemo(() => structures.filter(s => s.selected), [structures]);

  // Generate tick values
  const xTicks = useMemo(() => {
    if (xAxisUnit === 'percent') {
      return [0, 20, 40, 60, 80, 100, 120];
    }
    const ticks = [];
    for (let i = 0; i <= maxDoseForChart; i += 10) {
      ticks.push(i);
    }
    return ticks;
  }, [xAxisUnit, maxDoseForChart]);
  
  const yTicks = [0, 25, 50, 75, 100];

  // Generate path for a structure's DVH curve
  const generatePath = useCallback((struct: StructureDisplay) => {
    if (!struct.points || struct.points.length === 0) return '';
    
    return struct.points.map((p, i) => {
      const doseVal = xAxisUnit === 'percent' ? (p.dose / prescriptionDose) * 100 : p.dose;
      const x = scaleX(doseVal);
      const y = scaleY(p.volume);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [xAxisUnit, prescriptionDose, scaleX, scaleY]);

  // Query Dxx value (dose at which X% of volume receives that dose or more)
  const getDxxValue = useCallback((struct: StructureDisplay, percentVolume: number) => {
    if (!struct.points || struct.points.length === 0) return 0;
    
    for (let i = 0; i < struct.points.length - 1; i++) {
      if (struct.points[i].volume >= percentVolume && struct.points[i + 1].volume < percentVolume) {
        // Linear interpolation
        const p1 = struct.points[i];
        const p2 = struct.points[i + 1];
        const ratio = (percentVolume - p2.volume) / (p1.volume - p2.volume);
        return p1.dose * ratio + p2.dose * (1 - ratio);
      }
    }
    return struct.points[0]?.dose || 0;
  }, []);

  // Query Vxx value (volume receiving X% of Rx dose)
  const getVxxValue = useCallback((struct: StructureDisplay, percentDose: number) => {
    if (!struct.points || struct.points.length === 0) return 0;
    
    const targetDose = (percentDose / 100) * prescriptionDose;
    
    for (let i = 0; i < struct.points.length - 1; i++) {
      if (struct.points[i].dose <= targetDose && struct.points[i + 1].dose > targetDose) {
        // Linear interpolation
        const p1 = struct.points[i];
        const p2 = struct.points[i + 1];
        const ratio = (targetDose - p1.dose) / (p2.dose - p1.dose);
        return p1.volume + ratio * (p2.volume - p1.volume);
      }
    }
    
    // If target dose is beyond all points
    if (struct.points.length > 0 && targetDose >= struct.points[struct.points.length - 1].dose) {
      return 0;
    }
    return struct.points[0]?.volume || 100;
  }, [prescriptionDose]);

  // Handle mouse move for crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (x >= DVH_PADDING.left && x <= DVH_CHART_WIDTH - DVH_PADDING.right &&
        y >= DVH_PADDING.top && y <= DVH_CHART_HEIGHT - DVH_PADDING.bottom) {
      setCursorPosition({
        x,
        y,
        dose: unscaleX(x),
        volume: unscaleY(y)
      });
    } else {
      setCursorPosition(null);
    }
  };

  // Export CSV
  const exportCSV = () => {
    let csv = 'Structure,Dose (Gy),Volume (%)\n';
    selectedStructures.forEach(struct => {
      struct.points.forEach(p => {
        csv += `${struct.roiName},${p.dose.toFixed(3)},${p.volume.toFixed(3)}\n`;
      });
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dvh_series_${doseSeriesId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy stats to clipboard
  const copyStats = () => {
    let text = 'Structure\tVolume (cc)\tMin\tMax\tMean\tD' + dxxQuery + '\tD50\tV' + vxxQuery + '\n';
    selectedStructures.forEach(struct => {
      const s = struct.statistics;
      const dxx = getDxxValue(struct, parseFloat(dxxQuery));
      const vxx = getVxxValue(struct, parseFloat(vxxQuery));
      text += `${struct.roiName}\t${struct.volumeCc.toFixed(1)}\t${s.min.toFixed(2)}\t${s.max.toFixed(2)}\t${s.mean.toFixed(2)}\t${dxx.toFixed(1)} Gy\t${s.d50.toFixed(1)}\t${vxx.toFixed(1)}%\n`;
    });
    navigator.clipboard.writeText(text);
  };

  // Set window title
  useEffect(() => {
    document.title = `DVH Viewer - Series ${doseSeriesId}`;
  }, [doseSeriesId]);

  return (
    <div className="min-h-screen bg-[#0a0e14] p-6">
      <Card className="w-[900px] mx-auto bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-400" />
              <CardTitle className="text-base font-semibold text-white">Dose Volume Histogram</CardTitle>
              <Badge variant="outline" className="text-[9px] text-green-400 border-green-500/30">
                {viewMode === 'cumulative' ? 'Cumulative' : 'Differential'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={fetchDVH}
                disabled={loading}
                className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={exportCSV}
                disabled={selectedStructures.length === 0}
                className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={copyStats}
                disabled={selectedStructures.length === 0}
                className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
              <span className="ml-2 text-gray-400">Loading DVH data...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="flex gap-4">
              {/* Structure List */}
              <div className="w-[180px] space-y-2">
                <div className="text-xs text-gray-400 font-medium mb-2">Structures</div>
                <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                  {structures.map((struct) => (
                    <button
                      key={struct.roiNumber}
                      onClick={() => toggleStructure(struct.roiNumber)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all",
                        struct.selected
                          ? "bg-gray-800/80 border border-gray-600"
                          : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: struct.color }}
                      />
                      <span className="text-xs text-white truncate flex-1">{struct.roiName}</span>
                      {struct.selected && <Check className="w-3 h-3 text-green-400" />}
                    </button>
                  ))}
                  {structures.length === 0 && !loading && (
                    <div className="text-xs text-gray-500 py-4 text-center">
                      No structures found
                    </div>
                  )}
                </div>
                
                {/* Query Values */}
                <div className="pt-2 border-t border-gray-700/50 space-y-2">
                  <div className="text-[10px] text-gray-500 font-medium">Query Values</div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-cyan-400 w-6">D</span>
                    <Input
                      type="number"
                      value={dxxQuery}
                      onChange={(e) => setDxxQuery(e.target.value)}
                      className="h-6 w-14 text-xs bg-gray-800/50 border-gray-700 px-1 text-white"
                      min={0}
                      max={100}
                    />
                    <span className="text-[10px] text-gray-500">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-purple-400 w-6">V</span>
                    <Input
                      type="number"
                      value={vxxQuery}
                      onChange={(e) => setVxxQuery(e.target.value)}
                      className="h-6 w-14 text-xs bg-gray-800/50 border-gray-700 px-1 text-white"
                      min={0}
                      max={200}
                    />
                    <span className="text-[10px] text-gray-500">%</span>
                  </div>
                </div>
              </div>

              {/* DVH Chart Area */}
              <div className="flex-1 space-y-2">
                {/* Chart Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                      <button
                        onClick={() => setViewMode('cumulative')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-all",
                          viewMode === 'cumulative'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        Cumulative
                      </button>
                      <button
                        onClick={() => setViewMode('differential')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-all",
                          viewMode === 'differential'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        Differential
                      </button>
                    </div>
                    <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                      <button
                        onClick={() => setXAxisUnit('Gy')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-all",
                          xAxisUnit === 'Gy'
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        Gy
                      </button>
                      <button
                        onClick={() => setXAxisUnit('percent')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-all",
                          xAxisUnit === 'percent'
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        % Rx
                      </button>
                    </div>
                    <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                      <button
                        onClick={() => setYAxisUnit('percent')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-all",
                          yAxisUnit === 'percent'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        % Vol
                      </button>
                      <button
                        onClick={() => setYAxisUnit('cc')}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md transition-all",
                          yAxisUnit === 'cc'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "text-gray-400 hover:text-gray-300"
                        )}
                      >
                        cc
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="rounded border-gray-600 bg-gray-800"
                      />
                      Grid
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLegend}
                        onChange={(e) => setShowLegend(e.target.checked)}
                        className="rounded border-gray-600 bg-gray-800"
                      />
                      Legend
                    </label>
                  </div>
                </div>

                {/* SVG Chart */}
                <div className="relative bg-gray-900/50 rounded-lg border border-gray-700/50">
                  <svg 
                    width={DVH_CHART_WIDTH} 
                    height={DVH_CHART_HEIGHT}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setCursorPosition(null)}
                    className="cursor-crosshair"
                  >
                    {/* Background */}
                    <rect
                      x={DVH_PADDING.left}
                      y={DVH_PADDING.top}
                      width={plotWidth}
                      height={plotHeight}
                      fill="#111827"
                    />
                    
                    {/* Grid Lines */}
                    {showGrid && (
                      <g className="grid-lines">
                        {/* Horizontal grid lines */}
                        {yTicks.map((v) => (
                          <line
                            key={`h-${v}`}
                            x1={DVH_PADDING.left}
                            y1={scaleY(v)}
                            x2={DVH_CHART_WIDTH - DVH_PADDING.right}
                            y2={scaleY(v)}
                            stroke="#374151"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                        ))}
                        {/* Vertical grid lines */}
                        {xTicks.map((v) => (
                          <line
                            key={`v-${v}`}
                            x1={scaleX(v)}
                            y1={DVH_PADDING.top}
                            x2={scaleX(v)}
                            y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                            stroke="#374151"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                        ))}
                      </g>
                    )}

                    {/* Prescription line (100% dose) */}
                    <line
                      x1={scaleX(xAxisUnit === 'percent' ? 100 : prescriptionDose)}
                      y1={DVH_PADDING.top}
                      x2={scaleX(xAxisUnit === 'percent' ? 100 : prescriptionDose)}
                      y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                      stroke="#f97316"
                      strokeWidth="1.5"
                      strokeDasharray="5,3"
                    />
                    <text
                      x={scaleX(xAxisUnit === 'percent' ? 100 : prescriptionDose) + 3}
                      y={DVH_PADDING.top + 12}
                      fill="#f97316"
                      fontSize="9"
                    >
                      Rx
                    </text>

                    {/* DVH Curves */}
                    {selectedStructures.map((struct) => (
                      <path
                        key={struct.roiNumber}
                        d={generatePath(struct)}
                        fill="none"
                        stroke={struct.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}

                    {/* X-Axis */}
                    <line
                      x1={DVH_PADDING.left}
                      y1={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                      x2={DVH_CHART_WIDTH - DVH_PADDING.right}
                      y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                      stroke="#6b7280"
                      strokeWidth="1"
                    />
                    {xTicks.map((v) => (
                      <g key={`xt-${v}`}>
                        <line
                          x1={scaleX(v)}
                          y1={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                          x2={scaleX(v)}
                          y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom + 4}
                          stroke="#6b7280"
                          strokeWidth="1"
                        />
                        <text
                          x={scaleX(v)}
                          y={DVH_CHART_HEIGHT - DVH_PADDING.bottom + 14}
                          fill="#9ca3af"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {v}
                        </text>
                      </g>
                    ))}
                    <text
                      x={DVH_CHART_WIDTH / 2}
                      y={DVH_CHART_HEIGHT - 5}
                      fill="#9ca3af"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      Dose ({xAxisUnit === 'Gy' ? 'Gy' : '% Rx'})
                    </text>

                    {/* Y-Axis */}
                    <line
                      x1={DVH_PADDING.left}
                      y1={DVH_PADDING.top}
                      x2={DVH_PADDING.left}
                      y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                      stroke="#6b7280"
                      strokeWidth="1"
                    />
                    {yTicks.map((v) => (
                      <g key={`yt-${v}`}>
                        <line
                          x1={DVH_PADDING.left - 4}
                          y1={scaleY(v)}
                          x2={DVH_PADDING.left}
                          y2={scaleY(v)}
                          stroke="#6b7280"
                          strokeWidth="1"
                        />
                        <text
                          x={DVH_PADDING.left - 8}
                          y={scaleY(v) + 3}
                          fill="#9ca3af"
                          fontSize="10"
                          textAnchor="end"
                        >
                          {v}
                        </text>
                      </g>
                    ))}
                    <text
                      x={12}
                      y={DVH_CHART_HEIGHT / 2}
                      fill="#9ca3af"
                      fontSize="11"
                      textAnchor="middle"
                      transform={`rotate(-90, 12, ${DVH_CHART_HEIGHT / 2})`}
                    >
                      Volume ({yAxisUnit === 'percent' ? '%' : 'cc'})
                    </text>

                    {/* Interactive Cursor */}
                    {cursorPosition && (
                      <g className="cursor-display">
                        <line
                          x1={cursorPosition.x}
                          y1={DVH_PADDING.top}
                          x2={cursorPosition.x}
                          y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                          stroke="#22d3ee"
                          strokeWidth="1"
                          strokeDasharray="3,2"
                        />
                        <line
                          x1={DVH_PADDING.left}
                          y1={cursorPosition.y}
                          x2={DVH_CHART_WIDTH - DVH_PADDING.right}
                          y2={cursorPosition.y}
                          stroke="#22d3ee"
                          strokeWidth="1"
                          strokeDasharray="3,2"
                        />
                        <rect
                          x={cursorPosition.x + 8}
                          y={cursorPosition.y - 30}
                          width="85"
                          height="26"
                          rx="4"
                          fill="#1f2937"
                          stroke="#374151"
                        />
                        <text
                          x={cursorPosition.x + 14}
                          y={cursorPosition.y - 18}
                          fill="#22d3ee"
                          fontSize="10"
                        >
                          D: {cursorPosition.dose.toFixed(1)} {xAxisUnit === 'Gy' ? 'Gy' : '%'}
                        </text>
                        <text
                          x={cursorPosition.x + 14}
                          y={cursorPosition.y - 8}
                          fill="#a78bfa"
                          fontSize="10"
                        >
                          V: {cursorPosition.volume.toFixed(1)}%
                        </text>
                      </g>
                    )}

                    {/* Legend */}
                    {showLegend && selectedStructures.length > 0 && (
                      <g transform={`translate(${DVH_CHART_WIDTH - DVH_PADDING.right - 90}, ${DVH_PADDING.top + 5})`}>
                        <rect
                          x="0"
                          y="0"
                          width="85"
                          height={Math.min(selectedStructures.length, 8) * 16 + 8}
                          rx="4"
                          fill="#111827"
                          fillOpacity="0.9"
                          stroke="#374151"
                        />
                        {selectedStructures.slice(0, 8).map((struct, idx) => (
                          <g key={struct.roiNumber} transform={`translate(6, ${idx * 16 + 12})`}>
                            <line
                              x1="0"
                              y1="0"
                              x2="20"
                              y2="0"
                              stroke={struct.color}
                              strokeWidth="2"
                            />
                            <text
                              x="26"
                              y="3"
                              fill="#e5e7eb"
                              fontSize="9"
                            >
                              {struct.roiName.length > 10 ? struct.roiName.slice(0, 10) + '...' : struct.roiName}
                            </text>
                          </g>
                        ))}
                      </g>
                    )}
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Table */}
          {selectedStructures.length > 0 && (
            <div className="border-t border-gray-700/50 pt-4">
              <div className="text-xs text-gray-400 font-medium mb-2">Statistics</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700/50">
                      <th className="text-left py-1.5 px-2">Structure</th>
                      <th className="text-left py-1.5 px-2">Vol (cc)</th>
                      <th className="text-left py-1.5 px-2">Min</th>
                      <th className="text-left py-1.5 px-2">Max</th>
                      <th className="text-left py-1.5 px-2">Mean</th>
                      <th className="text-left py-1.5 px-2 text-cyan-400">D{dxxQuery}</th>
                      <th className="text-left py-1.5 px-2">D50</th>
                      <th className="text-left py-1.5 px-2 text-purple-400">V{vxxQuery}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStructures.map((struct) => {
                      const dxx = getDxxValue(struct, parseFloat(dxxQuery));
                      const vxx = getVxxValue(struct, parseFloat(vxxQuery));
                      return (
                        <tr key={struct.roiNumber} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-sm"
                                style={{ backgroundColor: struct.color }}
                              />
                              <span className="text-white">{struct.roiName}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-gray-400">{struct.volumeCc.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-gray-400">{struct.statistics.min.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-gray-400">{struct.statistics.max.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-gray-400">{struct.statistics.mean.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-cyan-400 font-medium">
                            {dxx.toFixed(1)} Gy
                          </td>
                          <td className="py-1.5 px-2 text-gray-400">{struct.statistics.d50.toFixed(1)}</td>
                          <td className="py-1.5 px-2 text-purple-400 font-medium">
                            {vxx.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
