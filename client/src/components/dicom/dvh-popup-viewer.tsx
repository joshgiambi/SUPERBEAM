/**
 * DVH Popup Viewer
 * 
 * A standalone popup window for viewing Dose-Volume Histograms.
 * Fetches real DVH data from the backend API.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
  Zap
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
    d98: number;   // MIM: Dose covering 98% of volume
    d95: number;   // MIM: Dose covering 95% of volume  
    d50: number;   // MIM: Median dose
    d2: number;    // MIM: Near-max dose (2% of volume)
    v100?: number; // Volume receiving 100% of Rx
    v95?: number;  // Volume receiving 95% of Rx
    v50?: number;  // Volume receiving 50% of Rx
    v20?: number;  // Volume receiving 20% of Rx (lung OAR metric)
    v5?: number;   // Volume receiving 5 Gy (low dose bath)
  };
}

// MIM-style dose constraint for pass/fail evaluation
interface DoseConstraint {
  structurePattern: RegExp;
  metric: 'Dmax' | 'Dmean' | 'D95' | 'D98' | 'D50' | 'V20' | 'V5';
  comparator: '<' | '<=' | '>' | '>=';
  value: number;
  unit: 'Gy' | 'cGy' | '%';
  priority: 'required' | 'optimal' | 'informational';
  label: string;
}

// Standard QUANTEC-based constraints
const STANDARD_CONSTRAINTS: DoseConstraint[] = [
  { structurePattern: /spinal.*cord/i, metric: 'Dmax', comparator: '<', value: 50, unit: 'Gy', priority: 'required', label: 'Spinal Cord Max' },
  { structurePattern: /brain.*stem/i, metric: 'Dmax', comparator: '<', value: 54, unit: 'Gy', priority: 'required', label: 'Brainstem Max' },
  { structurePattern: /parotid/i, metric: 'Dmean', comparator: '<', value: 26, unit: 'Gy', priority: 'optimal', label: 'Parotid Mean' },
  { structurePattern: /lung/i, metric: 'V20', comparator: '<', value: 37, unit: '%', priority: 'required', label: 'Lung V20' },
  { structurePattern: /lung/i, metric: 'V5', comparator: '<', value: 65, unit: '%', priority: 'optimal', label: 'Lung V5' },
  { structurePattern: /heart/i, metric: 'Dmean', comparator: '<', value: 26, unit: 'Gy', priority: 'required', label: 'Heart Mean' },
  { structurePattern: /esophagus/i, metric: 'Dmean', comparator: '<', value: 34, unit: 'Gy', priority: 'optimal', label: 'Esophagus Mean' },
  { structurePattern: /rectum/i, metric: 'V50', comparator: '<', value: 50, unit: '%', priority: 'required', label: 'Rectum V50' },
  { structurePattern: /bladder/i, metric: 'V50', comparator: '<', value: 50, unit: '%', priority: 'optimal', label: 'Bladder V50' },
];

// BED calculation parameters
interface BEDParams {
  alphaOverBeta: number;  // α/β ratio (Gy)
  numFractions: number;
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
  numFractions?: number;  // For BED/EQD2 calculations
  enableConstraints?: boolean;  // Show constraint pass/fail indicators
}

// ============================================================================
// COMPONENT
// ============================================================================

// BED/EQD2 calculation helpers (MIM feature)
function calculateBED(dose: number, dosePerFraction: number, alphaOverBeta: number): number {
  return dose * (1 + dosePerFraction / alphaOverBeta);
}

function calculateEQD2(dose: number, dosePerFraction: number, alphaOverBeta: number): number {
  const bed = calculateBED(dose, dosePerFraction, alphaOverBeta);
  return bed / (1 + 2 / alphaOverBeta);
}

// Constraint evaluation helper
function evaluateConstraint(
  curve: DVHCurve,
  constraint: DoseConstraint,
  prescriptionDose: number
): { passed: boolean; value: number; target: number } | null {
  // Check if structure name matches the constraint pattern
  if (!constraint.structurePattern.test(curve.roiName)) {
    return null;
  }

  let actualValue: number;
  switch (constraint.metric) {
    case 'Dmax': actualValue = curve.statistics.max; break;
    case 'Dmean': actualValue = curve.statistics.mean; break;
    case 'D95': actualValue = curve.statistics.d95; break;
    case 'D98': actualValue = curve.statistics.d98; break;
    case 'D50': actualValue = curve.statistics.d50; break;
    case 'V20': actualValue = curve.statistics.v20 ?? 0; break;
    case 'V5': actualValue = curve.statistics.v5 ?? 0; break;
    default: return null;
  }

  const target = constraint.unit === '%' ? constraint.value : constraint.value;
  let passed: boolean;
  
  switch (constraint.comparator) {
    case '<': passed = actualValue < target; break;
    case '<=': passed = actualValue <= target; break;
    case '>': passed = actualValue > target; break;
    case '>=': passed = actualValue >= target; break;
    default: passed = false;
  }

  return { passed, value: actualValue, target };
}

export function DVHPopupViewer({
  isOpen,
  onClose,
  doseSeriesId,
  structureSetId,
  prescriptionDose = 60,
  doseUnit = 'Gy',
  numFractions = 30,
  enableConstraints = true
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
  const [showConstraints, setShowConstraints] = useState(enableConstraints);
  const [showBED, setShowBED] = useState(false);
  const [bedAlphaOverBeta, setBedAlphaOverBeta] = useState(10); // Default: tumor α/β = 10 Gy
  const [statsView, setStatsView] = useState<'basic' | 'extended' | 'constraints'>('basic');
  
  // Calculate dose per fraction
  const dosePerFraction = useMemo(() => prescriptionDose / numFractions, [prescriptionDose, numFractions]);

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

  // Copy stats to clipboard (extended MIM format)
  const copyStats = () => {
    if (!selectedCurves.length) return;
    
    let text = 'Structure\tVolume (cc)\tMin\tMax\tMean\tD98\tD95\tD50\tD2\tV100\tV95\tV50\tV20\tV5\n';
    selectedCurves.forEach(curve => {
      const s = curve.statistics;
      text += `${curve.roiName}\t${curve.volumeCc.toFixed(1)}\t${s.min.toFixed(2)}\t${s.max.toFixed(2)}\t${s.mean.toFixed(2)}\t${(s.d98 || 0).toFixed(2)}\t${s.d95.toFixed(2)}\t${s.d50.toFixed(2)}\t${s.d2.toFixed(2)}\t${(s.v100 || 0).toFixed(1)}%\t${(s.v95 || 0).toFixed(1)}%\t${(s.v50 || 0).toFixed(1)}%\t${(s.v20 || 0).toFixed(1)}%\t${(s.v5 || 0).toFixed(1)}%\n`;
    });
    
    navigator.clipboard.writeText(text);
  };
  
  // Get constraint evaluations for all selected curves
  const constraintEvaluations = useMemo(() => {
    if (!showConstraints || !selectedCurves.length) return [];
    
    const evaluations: Array<{
      curve: DVHCurve;
      constraint: DoseConstraint;
      result: { passed: boolean; value: number; target: number };
    }> = [];
    
    for (const curve of selectedCurves) {
      for (const constraint of STANDARD_CONSTRAINTS) {
        const result = evaluateConstraint(curve, constraint, prescriptionDose);
        if (result) {
          evaluations.push({ curve, constraint, result });
        }
      }
    }
    
    return evaluations;
  }, [selectedCurves, showConstraints, prescriptionDose]);
  
  // Count pass/fail for summary
  const constraintSummary = useMemo(() => {
    const passed = constraintEvaluations.filter(e => e.result.passed).length;
    const failed = constraintEvaluations.filter(e => !e.result.passed).length;
    const required = constraintEvaluations.filter(e => e.constraint.priority === 'required');
    const requiredFailed = required.filter(e => !e.result.passed).length;
    return { passed, failed, total: constraintEvaluations.length, requiredFailed };
  }, [constraintEvaluations]);

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
                  Series {doseSeriesId} • Rx: {prescriptionDose} Gy / {numFractions} fx ({dosePerFraction.toFixed(2)} Gy/fx)
                </p>
              </div>
              {/* Constraint summary badge */}
              {showConstraints && constraintEvaluations.length > 0 && (
                <div className="flex items-center gap-1.5 ml-2">
                  {constraintSummary.requiredFailed > 0 ? (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                      <XCircle className="w-3 h-3 mr-1" />
                      {constraintSummary.requiredFailed} required failed
                    </Badge>
                  ) : constraintSummary.failed > 0 ? (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {constraintSummary.failed} optional failed
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      All constraints met
                    </Badge>
                  )}
                </div>
              )}
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

                {/* Statistics Section with Tabs */}
                <div className="border-t border-gray-700/50 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setShowStats(!showStats)}
                      className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-300"
                    >
                      {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Statistics
                    </button>
                    
                    {showStats && (
                      <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                        {[
                          { id: 'basic', label: 'Basic' },
                          { id: 'extended', label: 'Extended (MIM)' },
                          { id: 'constraints', label: 'Constraints' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setStatsView(tab.id as any)}
                            className={cn(
                              "px-2 py-1 text-[10px] rounded-md transition-all",
                              statsView === tab.id
                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : "text-gray-400 hover:text-gray-300"
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {showStats && selectedCurves.length > 0 && (
                    <>
                      {/* Basic Statistics Table */}
                      {statsView === 'basic' && (
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
                      
                      {/* Extended MIM Statistics Table */}
                      {statsView === 'extended' && (
                        <div className="space-y-3">
                          {/* BED toggle */}
                          <div className="flex items-center gap-4 p-2 bg-gray-800/30 rounded-lg">
                            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showBED}
                                onChange={(e) => setShowBED(e.target.checked)}
                                className="rounded border-gray-600"
                              />
                              <Zap className="w-3 h-3" />
                              Show BED/EQD2
                            </label>
                            {showBED && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">α/β:</span>
                                <select
                                  value={bedAlphaOverBeta}
                                  onChange={(e) => setBedAlphaOverBeta(Number(e.target.value))}
                                  className="h-5 px-1 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300"
                                >
                                  <option value={10}>10 Gy (Tumor)</option>
                                  <option value={3}>3 Gy (Late Effects)</option>
                                  <option value={1.5}>1.5 Gy (Prostate)</option>
                                  <option value={8.5}>8.5 Gy (Breast)</option>
                                </select>
                              </div>
                            )}
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-gray-700/50">
                                  <th className="text-left py-1.5 px-2 font-medium">Structure</th>
                                  <th className="text-right py-1.5 px-2 font-medium">Vol</th>
                                  <th className="text-right py-1.5 px-2 font-medium">D98</th>
                                  <th className="text-right py-1.5 px-2 font-medium">D95</th>
                                  <th className="text-right py-1.5 px-2 font-medium">D50</th>
                                  <th className="text-right py-1.5 px-2 font-medium">D2</th>
                                  <th className="text-right py-1.5 px-2 font-medium">V100</th>
                                  <th className="text-right py-1.5 px-2 font-medium">V95</th>
                                  <th className="text-right py-1.5 px-2 font-medium">V50</th>
                                  <th className="text-right py-1.5 px-2 font-medium">V20</th>
                                  <th className="text-right py-1.5 px-2 font-medium">V5</th>
                                  {showBED && (
                                    <>
                                      <th className="text-right py-1.5 px-2 font-medium text-purple-400">BED</th>
                                      <th className="text-right py-1.5 px-2 font-medium text-purple-400">EQD2</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {selectedCurves.map((curve) => {
                                  const meanBED = showBED ? calculateBED(curve.statistics.mean, dosePerFraction, bedAlphaOverBeta) : 0;
                                  const meanEQD2 = showBED ? calculateEQD2(curve.statistics.mean, dosePerFraction, bedAlphaOverBeta) : 0;
                                  
                                  return (
                                    <tr key={curve.roiNumber} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                      <td className="py-1.5 px-2">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                            style={{ backgroundColor: curve.color }}
                                          />
                                          <span className="text-white truncate max-w-[100px]">{curve.roiName}</span>
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2 text-right text-gray-400 tabular-nums">{curve.volumeCc.toFixed(1)}</td>
                                      <td className="py-1.5 px-2 text-right text-emerald-400 tabular-nums">{(curve.statistics.d98 || 0).toFixed(2)}</td>
                                      <td className="py-1.5 px-2 text-right text-green-400 tabular-nums">{curve.statistics.d95.toFixed(2)}</td>
                                      <td className="py-1.5 px-2 text-right text-cyan-400 tabular-nums">{curve.statistics.d50.toFixed(2)}</td>
                                      <td className="py-1.5 px-2 text-right text-orange-400 tabular-nums">{curve.statistics.d2.toFixed(2)}</td>
                                      <td className="py-1.5 px-2 text-right text-yellow-400 tabular-nums">{(curve.statistics.v100 || 0).toFixed(1)}%</td>
                                      <td className="py-1.5 px-2 text-right text-lime-400 tabular-nums">{(curve.statistics.v95 || 0).toFixed(1)}%</td>
                                      <td className="py-1.5 px-2 text-right text-teal-400 tabular-nums">{(curve.statistics.v50 || 0).toFixed(1)}%</td>
                                      <td className="py-1.5 px-2 text-right text-blue-400 tabular-nums">{(curve.statistics.v20 || 0).toFixed(1)}%</td>
                                      <td className="py-1.5 px-2 text-right text-indigo-400 tabular-nums">{(curve.statistics.v5 || 0).toFixed(1)}%</td>
                                      {showBED && (
                                        <>
                                          <td className="py-1.5 px-2 text-right text-purple-400 tabular-nums">{meanBED.toFixed(1)}</td>
                                          <td className="py-1.5 px-2 text-right text-purple-300 tabular-nums">{meanEQD2.toFixed(1)}</td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      
                      {/* Constraints Evaluation Table */}
                      {statsView === 'constraints' && (
                        <div className="space-y-2">
                          {constraintEvaluations.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-gray-500">
                              <Info className="w-5 h-5 mr-2" />
                              No applicable constraints found for selected structures
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b border-gray-700/50">
                                    <th className="text-left py-1.5 px-2 font-medium">Structure</th>
                                    <th className="text-left py-1.5 px-2 font-medium">Constraint</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Limit</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Actual</th>
                                    <th className="text-center py-1.5 px-2 font-medium">Status</th>
                                    <th className="text-center py-1.5 px-2 font-medium">Priority</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {constraintEvaluations.map((evaluation, idx) => (
                                    <tr 
                                      key={`${evaluation.curve.roiNumber}-${idx}`} 
                                      className={cn(
                                        "border-b border-gray-800/50",
                                        evaluation.result.passed ? "hover:bg-gray-800/30" : "bg-red-500/5 hover:bg-red-500/10"
                                      )}
                                    >
                                      <td className="py-1.5 px-2">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                            style={{ backgroundColor: evaluation.curve.color }}
                                          />
                                          <span className="text-white truncate max-w-[100px]">{evaluation.curve.roiName}</span>
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2 text-gray-300">{evaluation.constraint.label}</td>
                                      <td className="py-1.5 px-2 text-right text-gray-400 tabular-nums">
                                        {evaluation.constraint.comparator} {evaluation.result.target} {evaluation.constraint.unit}
                                      </td>
                                      <td className={cn(
                                        "py-1.5 px-2 text-right tabular-nums font-medium",
                                        evaluation.result.passed ? "text-gray-300" : "text-red-400"
                                      )}>
                                        {evaluation.result.value.toFixed(2)} {evaluation.constraint.unit === '%' ? '%' : 'Gy'}
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        {evaluation.result.passed ? (
                                          <CheckCircle2 className="w-4 h-4 text-green-400 inline" />
                                        ) : (
                                          <XCircle className="w-4 h-4 text-red-400 inline" />
                                        )}
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        <span className={cn(
                                          "px-1.5 py-0.5 rounded text-[9px] font-medium",
                                          evaluation.constraint.priority === 'required' 
                                            ? "bg-red-500/20 text-red-300" 
                                            : evaluation.constraint.priority === 'optimal'
                                            ? "bg-amber-500/20 text-amber-300"
                                            : "bg-gray-500/20 text-gray-400"
                                        )}>
                                          {evaluation.constraint.priority}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          
                          {/* Constraint Summary */}
                          {constraintEvaluations.length > 0 && (
                            <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg text-[10px]">
                              <div className="flex items-center gap-4">
                                <span className="text-gray-400">Summary:</span>
                                <span className="text-green-400">
                                  <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                                  {constraintSummary.passed} passed
                                </span>
                                <span className="text-red-400">
                                  <XCircle className="w-3 h-3 inline mr-0.5" />
                                  {constraintSummary.failed} failed
                                </span>
                              </div>
                              <span className="text-gray-500">
                                QUANTEC-based constraints
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
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



