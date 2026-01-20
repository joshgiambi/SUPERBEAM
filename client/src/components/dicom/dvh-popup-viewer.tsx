/**
 * DVH Popup Viewer
 * 
 * A standalone popup window for viewing Dose-Volume Histograms.
 * Fetches real DVH data from the backend API.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Download,
  Copy,
  X,
  Check,
  Loader2,
  RefreshCw,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDoseWithUnit, type DoseUnit } from '@/lib/rt-dose-manager';

// ============================================================================
// TYPES
// ============================================================================

interface DVHPoint {
  dose: number;
  volume: number;
}

interface DVHCurve {
  roiNumber: number;
  roiName: string;
  color: string;
  volumeCc: number;
  points: DVHPoint[];
  statistics: {
    min: number;
    max: number;
    mean: number;
    d95: number;
    d50: number;
    d2: number;
    v100?: number;
  };
}

interface DVHData {
  doseSeriesId: number;
  structureSetId: number;
  prescriptionDose: number;
  curves: DVHCurve[];
}

interface DVHPopupViewerProps {
  isOpen: boolean;
  onClose: () => void;
  doseSeriesId: number;
  structureSetId?: number;
  prescriptionDose?: number;
  doseUnit?: DoseUnit;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DVHPopupViewer({
  isOpen,
  onClose,
  doseSeriesId,
  structureSetId,
  prescriptionDose = 60,
  doseUnit = 'Gy'
}: DVHPopupViewerProps) {
  const [dvhData, setDvhData] = useState<DVHData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'cumulative' | 'differential'>('cumulative');
  const [xAxisUnit, setXAxisUnit] = useState<'Gy' | 'percent'>('Gy');
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showStats, setShowStats] = useState(true);

  // Fetch DVH data from backend
  const fetchDVH = useCallback(async () => {
    if (!doseSeriesId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (structureSetId) params.append('structureSetId', structureSetId.toString());
      params.append('prescriptionDose', prescriptionDose.toString());
      
      const response = await fetch(`/api/dvh/${doseSeriesId}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch DVH: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDvhData(data);
      
      // Select all structures by default
      if (data.curves) {
        setSelectedStructures(new Set(data.curves.map((c: DVHCurve) => c.roiNumber)));
      }
    } catch (err) {
      console.error('DVH fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load DVH data');
    } finally {
      setLoading(false);
    }
  }, [doseSeriesId, structureSetId, prescriptionDose]);

  useEffect(() => {
    if (isOpen && doseSeriesId) {
      fetchDVH();
    }
  }, [isOpen, doseSeriesId, fetchDVH]);

  const toggleStructure = (roiNumber: number) => {
    setSelectedStructures(prev => {
      const next = new Set(prev);
      if (next.has(roiNumber)) {
        next.delete(roiNumber);
      } else {
        next.add(roiNumber);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (dvhData?.curves) {
      setSelectedStructures(new Set(dvhData.curves.map(c => c.roiNumber)));
    }
  };

  const selectNone = () => {
    setSelectedStructures(new Set());
  };

  const selectedCurves = useMemo(() => {
    if (!dvhData?.curves) return [];
    return dvhData.curves.filter(c => selectedStructures.has(c.roiNumber));
  }, [dvhData, selectedStructures]);

  // Calculate chart bounds
  const chartBounds = useMemo(() => {
    if (!selectedCurves.length) return { maxDose: 80, maxVolume: 100 };
    
    let maxDose = 0;
    selectedCurves.forEach(curve => {
      curve.points.forEach(p => {
        if (p.dose > maxDose) maxDose = p.dose;
      });
    });
    
    // Round up to nice number
    maxDose = Math.ceil(maxDose / 10) * 10 + 10;
    
    return { maxDose, maxVolume: 100 };
  }, [selectedCurves]);

  // Export DVH data as CSV
  const exportCSV = () => {
    if (!dvhData) return;
    
    let csv = 'Structure,Dose (Gy),Volume (%)\n';
    selectedCurves.forEach(curve => {
      curve.points.forEach(p => {
        csv += `${curve.roiName},${p.dose.toFixed(3)},${p.volume.toFixed(3)}\n`;
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
    if (!selectedCurves.length) return;
    
    let text = 'Structure\tVolume (cc)\tMin\tMax\tMean\tD95\tD50\tD2\n';
    selectedCurves.forEach(curve => {
      const s = curve.statistics;
      text += `${curve.roiName}\t${curve.volumeCc.toFixed(1)}\t${s.min.toFixed(2)}\t${s.max.toFixed(2)}\t${s.mean.toFixed(2)}\t${s.d95.toFixed(2)}\t${s.d50.toFixed(2)}\t${s.d2.toFixed(2)}\n`;
    });
    
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden bg-[#0d1117]/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <CardHeader className="pb-3 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-green-500/20">
                <BarChart3 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-white">
                  Dose Volume Histogram
                </CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">
                  Series {doseSeriesId} • Rx: {prescriptionDose} Gy
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchDVH}
                disabled={loading}
                className="h-8 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportCSV}
                disabled={!dvhData}
                className="h-8 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={copyStats}
                disabled={!selectedCurves.length}
                className="h-8 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy Stats
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
              <span className="ml-3 text-gray-400">Loading DVH data...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Failed to load DVH</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && dvhData && (
            <div className="flex gap-4">
              {/* Structure List */}
              <div className="w-[200px] flex-shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Structures</span>
                  <div className="flex gap-1">
                    <button
                      onClick={selectAll}
                      className="text-[10px] px-1.5 py-0.5 rounded text-cyan-400 hover:bg-cyan-500/20"
                    >
                      All
                    </button>
                    <button
                      onClick={selectNone}
                      className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:bg-gray-500/20"
                    >
                      None
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                  {dvhData.curves.map((curve) => (
                    <button
                      key={curve.roiNumber}
                      onClick={() => toggleStructure(curve.roiNumber)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all",
                        selectedStructures.has(curve.roiNumber)
                          ? "bg-gray-800/80 border border-gray-600"
                          : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: curve.color }}
                      />
                      <span className="text-xs text-white truncate flex-1">{curve.roiName}</span>
                      {selectedStructures.has(curve.roiNumber) && (
                        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Area */}
              <div className="flex-1 space-y-3">
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
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="rounded border-gray-600"
                      />
                      Grid
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLegend}
                        onChange={(e) => setShowLegend(e.target.checked)}
                        className="rounded border-gray-600"
                      />
                      Legend
                    </label>
                  </div>
                </div>

                {/* SVG Chart */}
                <div className="relative h-[320px] bg-gray-900/50 rounded-xl border border-gray-700/50 p-4">
                  {selectedCurves.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <Info className="w-5 h-5 mr-2" />
                      Select structures to display DVH curves
                    </div>
                  ) : (
                    <>
                      {/* Y Axis Labels */}
                      <div className="absolute left-0 top-4 bottom-8 w-10 flex flex-col justify-between text-[10px] text-gray-500 text-right pr-2">
                        <span>100</span>
                        <span>75</span>
                        <span>50</span>
                        <span>25</span>
                        <span>0</span>
                      </div>
                      
                      {/* X Axis Labels */}
                      <div className="absolute left-10 right-4 bottom-0 h-6 flex justify-between text-[10px] text-gray-500">
                        <span>0</span>
                        <span>{xAxisUnit === 'Gy' ? Math.round(chartBounds.maxDose * 0.25) : '25%'}</span>
                        <span>{xAxisUnit === 'Gy' ? Math.round(chartBounds.maxDose * 0.5) : '50%'}</span>
                        <span>{xAxisUnit === 'Gy' ? Math.round(chartBounds.maxDose * 0.75) : '75%'}</span>
                        <span>{xAxisUnit === 'Gy' ? chartBounds.maxDose : '100%'}</span>
                      </div>
                      
                      {/* Grid Lines */}
                      {showGrid && (
                        <svg className="absolute left-10 top-4 right-4 bottom-8" preserveAspectRatio="none">
                          {[0, 25, 50, 75, 100].map((v) => (
                            <line
                              key={`h-${v}`}
                              x1="0"
                              y1={`${100 - v}%`}
                              x2="100%"
                              y2={`${100 - v}%`}
                              stroke="#374151"
                              strokeWidth="1"
                              strokeDasharray="3,3"
                            />
                          ))}
                          {[0, 25, 50, 75, 100].map((v) => (
                            <line
                              key={`v-${v}`}
                              x1={`${v}%`}
                              y1="0"
                              x2={`${v}%`}
                              y2="100%"
                              stroke="#374151"
                              strokeWidth="1"
                              strokeDasharray="3,3"
                            />
                          ))}
                        </svg>
                      )}

                      {/* Prescription Line */}
                      <div 
                        className="absolute top-4 bottom-8 w-px bg-orange-500/60"
                        style={{ 
                          left: `calc(${(prescriptionDose / chartBounds.maxDose) * 100}% + 40px)` 
                        }}
                      >
                        <span className="absolute -top-4 left-1 text-[9px] text-orange-400 whitespace-nowrap">
                          Rx {prescriptionDose} Gy
                        </span>
                      </div>
                      
                      {/* DVH Curves */}
                      <svg className="absolute left-10 top-4 right-4 bottom-8" preserveAspectRatio="none">
                        {selectedCurves.map((curve) => {
                          const maxDoseForAxis = xAxisUnit === 'Gy' 
                            ? chartBounds.maxDose 
                            : prescriptionDose;
                          
                          const pathData = curve.points.map((p, i) => {
                            const xVal = xAxisUnit === 'Gy' 
                              ? p.dose 
                              : (p.dose / prescriptionDose) * 100;
                            const x = (xVal / (xAxisUnit === 'Gy' ? chartBounds.maxDose : 100)) * 100;
                            const y = 100 - p.volume;
                            return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                          }).join(' ');
                          
                          return (
                            <path
                              key={curve.roiNumber}
                              d={pathData}
                              fill="none"
                              stroke={curve.color}
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          );
                        })}
                      </svg>

                      {/* Legend */}
                      {showLegend && selectedCurves.length > 0 && (
                        <div className="absolute top-2 right-2 bg-gray-900/90 rounded-lg p-2 space-y-1 border border-gray-700/50">
                          {selectedCurves.slice(0, 8).map((curve) => (
                            <div key={curve.roiNumber} className="flex items-center gap-2">
                              <div
                                className="w-6 h-0.5"
                                style={{ backgroundColor: curve.color }}
                              />
                              <span className="text-[10px] text-white">{curve.roiName}</span>
                            </div>
                          ))}
                          {selectedCurves.length > 8 && (
                            <span className="text-[9px] text-gray-500">+{selectedCurves.length - 8} more</span>
                          )}
                        </div>
                      )}

                      {/* Axis Labels */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-400">
                        Dose ({xAxisUnit === 'Gy' ? 'Gy' : '% Rx'})
                      </div>
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 -rotate-90 text-xs text-gray-400 whitespace-nowrap">
                        Volume (%)
                      </div>
                    </>
                  )}
                </div>

                {/* Statistics Table */}
                <div className="border-t border-gray-700/50 pt-3">
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-300 mb-2"
                  >
                    {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Statistics
                  </button>
                  
                  {showStats && selectedCurves.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-700/50">
                            <th className="text-left py-1.5 px-2 font-medium">Structure</th>
                            <th className="text-right py-1.5 px-2 font-medium">Vol (cc)</th>
                            <th className="text-right py-1.5 px-2 font-medium">Min</th>
                            <th className="text-right py-1.5 px-2 font-medium">Max</th>
                            <th className="text-right py-1.5 px-2 font-medium">Mean</th>
                            <th className="text-right py-1.5 px-2 font-medium">D95</th>
                            <th className="text-right py-1.5 px-2 font-medium">D50</th>
                            <th className="text-right py-1.5 px-2 font-medium">D2</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCurves.map((curve) => (
                            <tr key={curve.roiNumber} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="py-1.5 px-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: curve.color }}
                                  />
                                  <span className="text-white truncate max-w-[120px]">{curve.roiName}</span>
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-right text-gray-400 tabular-nums">{curve.volumeCc.toFixed(1)}</td>
                              <td className="py-1.5 px-2 text-right text-blue-400 tabular-nums">{curve.statistics.min.toFixed(2)}</td>
                              <td className="py-1.5 px-2 text-right text-red-400 tabular-nums">{curve.statistics.max.toFixed(2)}</td>
                              <td className="py-1.5 px-2 text-right text-gray-300 tabular-nums">{curve.statistics.mean.toFixed(2)}</td>
                              <td className="py-1.5 px-2 text-right text-green-400 tabular-nums">{curve.statistics.d95.toFixed(2)}</td>
                              <td className="py-1.5 px-2 text-right text-cyan-400 tabular-nums">{curve.statistics.d50.toFixed(2)}</td>
                              <td className="py-1.5 px-2 text-right text-orange-400 tabular-nums">{curve.statistics.d2.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DVHPopupViewer;


