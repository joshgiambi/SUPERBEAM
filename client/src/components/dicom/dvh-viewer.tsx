/**
 * DVH Viewer Component
 * 
 * Displays Dose Volume Histogram for RT structures with:
 * - Interactive cumulative DVH chart
 * - Structure selection
 * - Key dose statistics table (Dmin, Dmax, Dmean, D95, D50, D2, V100, V95)
 * - Export to CSV
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Loader2, Download, X, BarChart3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface DVHPoint {
  dose: number;
  dosePercent: number;
  volumePercent: number;
}

interface DVHStatistics {
  Dmin: number;
  Dmax: number;
  Dmean: number;
  D98: number;
  D95: number;
  D50: number;
  D2: number;
  V100?: number;
  V95?: number;
  V50?: number;
}

interface DVHStructureResult {
  structureId: number;
  structureName: string;
  color: [number, number, number];
  volumeCc: number;
  totalVoxels: number;
  cumulativeDVH: DVHPoint[];
  statistics: DVHStatistics;
}

interface StructureInfo {
  roiNumber: number;
  structureName: string;
  color: [number, number, number];
  contourCount?: number;
}

interface DVHViewerProps {
  /** RT Dose series ID */
  doseSeriesId: number;
  /** RT Structure series ID */
  rtStructSeriesId: number;
  /** Available structures (from RTSTRUCT) */
  structures?: StructureInfo[];
  /** Prescription dose in Gy (for % calculations) */
  prescriptionDose?: number;
  /** Callback when viewer is closed */
  onClose?: () => void;
  /** Optional className for styling */
  className?: string;
  /** Whether to show as floating panel vs inline */
  floating?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function DVHViewer({
  doseSeriesId,
  rtStructSeriesId,
  structures: providedStructures,
  prescriptionDose: initialPrescription = 60,
  onClose,
  className,
  floating = false
}: DVHViewerProps) {
  // State
  const [dvhData, setDvhData] = useState<DVHStructureResult[]>([]);
  const [structures, setStructures] = useState<StructureInfo[]>(providedStructures || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<number[]>([]);
  const [xAxisMode, setXAxisMode] = useState<'absolute' | 'percent'>('absolute');
  const [showGrid, setShowGrid] = useState(true);
  const [prescriptionDose, setPrescriptionDose] = useState(initialPrescription);
  const [showStatistics, setShowStatistics] = useState(true);
  const [binWidth, setBinWidth] = useState(0.1);

  // Load available structures if not provided
  useEffect(() => {
    if (providedStructures && providedStructures.length > 0) {
      setStructures(providedStructures);
      return;
    }

    const loadStructures = async () => {
      try {
        const response = await fetch(`/api/dvh/structures/${rtStructSeriesId}`);
        if (response.ok) {
          const data = await response.json();
          setStructures(data.structures || []);
        }
      } catch (err) {
        console.warn('Failed to load structures:', err);
      }
    };

    if (rtStructSeriesId) {
      loadStructures();
    }
  }, [rtStructSeriesId, providedStructures]);

  // Calculate DVH when selection changes
  const calculateDVH = useCallback(async () => {
    if (!doseSeriesId || !rtStructSeriesId || selectedStructures.length === 0) {
      setDvhData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dvh/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doseSeriesId,
          rtStructSeriesId,
          structureIds: selectedStructures,
          prescriptionDose,
          binWidth
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setDvhData(data.structures || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate DVH');
      setDvhData([]);
    } finally {
      setLoading(false);
    }
  }, [doseSeriesId, rtStructSeriesId, selectedStructures, prescriptionDose, binWidth]);

  // Recalculate when dependencies change
  useEffect(() => {
    calculateDVH();
  }, [calculateDVH]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (dvhData.length === 0) return [];

    // Find max dose across all structures
    const maxDose = Math.max(...dvhData.map(d => d.statistics.Dmax), 1);
    const numPoints = Math.ceil(maxDose / binWidth) + 1;

    const data: Record<string, number>[] = [];
    for (let i = 0; i < numPoints; i++) {
      const dose = i * binWidth;
      const point: Record<string, number> = {
        dose: parseFloat(dose.toFixed(2)),
        dosePercent: prescriptionDose ? parseFloat(((dose / prescriptionDose) * 100).toFixed(1)) : 0
      };

      for (const struct of dvhData) {
        // Find closest DVH point
        const dvhPoint = struct.cumulativeDVH.find(p => Math.abs(p.dose - dose) < binWidth / 2);
        point[`vol_${struct.structureId}`] = dvhPoint?.volumePercent ?? 0;
      }

      data.push(point);
    }

    return data;
  }, [dvhData, prescriptionDose, binWidth]);

  // Toggle structure selection
  const toggleStructure = (structureId: number) => {
    setSelectedStructures(prev =>
      prev.includes(structureId)
        ? prev.filter(id => id !== structureId)
        : [...prev, structureId]
    );
  };

  // Select all structures
  const selectAllStructures = () => {
    setSelectedStructures(structures.map(s => s.roiNumber));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedStructures([]);
  };

  // Export DVH as CSV
  const exportCSV = () => {
    if (dvhData.length === 0) return;

    const headers = [
      'Dose (Gy)',
      'Dose (% Rx)',
      ...dvhData.map(d => `${d.structureName} Vol(%)`)
    ];

    const rows = chartData.map(point => [
      point.dose.toFixed(2),
      point.dosePercent.toFixed(1),
      ...dvhData.map(d => (point[`vol_${d.structureId}`] ?? 0).toFixed(2))
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DVH_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format dose value for display
  const formatDose = (dose: number, unit: 'Gy' | 'cGy' = 'Gy') => {
    const value = unit === 'cGy' ? dose * 100 : dose;
    return `${value.toFixed(2)} ${unit}`;
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm mb-2">
          {xAxisMode === 'percent' ? `${label}% of Rx` : `${label} Gy`}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.stroke }}
            />
            <span className="text-gray-400">{entry.name}:</span>
            <span className="text-white font-medium">{entry.value?.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className={cn(
      "bg-gray-900 border-gray-700",
      floating && "fixed bottom-4 right-4 w-[700px] max-h-[600px] overflow-hidden shadow-2xl z-50",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <CardTitle className="text-base font-semibold text-white">
            Dose Volume Histogram
          </CardTitle>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={calculateDVH}
            disabled={loading || selectedStructures.length === 0}
            className="h-7 px-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={dvhData.length === 0}
            className="h-7 px-2"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            CSV
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 overflow-y-auto max-h-[500px]">
        {/* Structure Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Structures</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={selectAllStructures} className="h-6 px-2 text-xs">
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-6 px-2 text-xs">
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 p-2 bg-gray-800/50 rounded-lg max-h-24 overflow-y-auto">
            {structures.map(struct => (
              <label
                key={struct.roiNumber}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors text-xs",
                  selectedStructures.includes(struct.roiNumber)
                    ? "bg-gray-700"
                    : "hover:bg-gray-700/50"
                )}
              >
                <Checkbox
                  checked={selectedStructures.includes(struct.roiNumber)}
                  onCheckedChange={() => toggleStructure(struct.roiNumber)}
                  className="h-3 w-3"
                />
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: `rgb(${struct.color.join(',')})` }}
                />
                <span className="text-gray-200 truncate max-w-[100px]" title={struct.structureName}>
                  {struct.structureName}
                </span>
              </label>
            ))}
            {structures.length === 0 && (
              <span className="text-gray-500 text-xs">No structures available</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">X-Axis:</span>
            <Select value={xAxisMode} onValueChange={(v: 'absolute' | 'percent') => setXAxisMode(v)}>
              <SelectTrigger className="w-28 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">Dose (Gy)</SelectItem>
                <SelectItem value="percent">% of Rx</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Rx:</span>
            <input
              type="number"
              value={prescriptionDose}
              onChange={(e) => setPrescriptionDose(parseFloat(e.target.value) || 60)}
              className="w-16 h-7 px-2 text-xs bg-gray-800 border border-gray-700 rounded"
              step="0.1"
            />
            <span className="text-xs text-gray-500">Gy</span>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <Checkbox checked={showGrid} onCheckedChange={(c) => setShowGrid(!!c)} className="h-3 w-3" />
            Grid
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* DVH Chart */}
        <div className="h-64 w-full bg-gray-800/30 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <span className="ml-2 text-gray-400">Calculating DVH...</span>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
                <XAxis
                  dataKey={xAxisMode === 'percent' ? 'dosePercent' : 'dose'}
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  label={{
                    value: xAxisMode === 'percent' ? 'Dose (% Rx)' : 'Dose (Gy)',
                    position: 'bottom',
                    offset: 0,
                    style: { fontSize: 11, fill: '#9ca3af' }
                  }}
                />
                <YAxis
                  stroke="#6b7280"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  label={{
                    value: 'Volume (%)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: '#9ca3af' }
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 10 }}
                  formatter={(value) => <span className="text-gray-300">{value}</span>}
                />

                {/* Reference lines */}
                {prescriptionDose > 0 && xAxisMode === 'absolute' && (
                  <ReferenceLine
                    x={prescriptionDose}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    label={{ value: 'Rx', position: 'top', fill: '#f59e0b', fontSize: 10 }}
                  />
                )}
                {xAxisMode === 'percent' && (
                  <ReferenceLine
                    x={100}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    label={{ value: '100%', position: 'top', fill: '#f59e0b', fontSize: 10 }}
                  />
                )}

                {/* DVH curves */}
                {dvhData.map(struct => (
                  <Line
                    key={struct.structureId}
                    type="monotone"
                    dataKey={`vol_${struct.structureId}`}
                    name={struct.structureName}
                    stroke={`rgb(${struct.color.join(',')})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <BarChart3 className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-sm">Select structures to calculate DVH</p>
            </div>
          )}
        </div>

        {/* Statistics Table */}
        {dvhData.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowStatistics(!showStatistics)}
              className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white"
            >
              {showStatistics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Dose Statistics
            </button>

            {showStatistics && (
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400 text-xs font-medium">Structure</TableHead>
                      <TableHead className="text-gray-400 text-xs font-medium text-right">Vol (cc)</TableHead>
                      <TableHead className="text-gray-400 text-xs font-medium text-right">Dmin</TableHead>
                      <TableHead className="text-gray-400 text-xs font-medium text-right">Dmax</TableHead>
                      <TableHead className="text-gray-400 text-xs font-medium text-right">Dmean</TableHead>
                      <TableHead className="text-gray-400 text-xs font-medium text-right">D95</TableHead>
                      <TableHead className="text-gray-400 text-xs font-medium text-right">D50</TableHead>
                      <TableHead className="text-gray-400 text-xs font-medium text-right">D2</TableHead>
                      {prescriptionDose > 0 && (
                        <>
                          <TableHead className="text-gray-400 text-xs font-medium text-right">V100</TableHead>
                          <TableHead className="text-gray-400 text-xs font-medium text-right">V95</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dvhData.map(struct => (
                      <TableRow key={struct.structureId} className="border-gray-800">
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: `rgb(${struct.color.join(',')})` }}
                            />
                            <span className="text-xs text-gray-200 truncate max-w-[100px]">
                              {struct.structureName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right text-gray-300">
                          {struct.volumeCc.toFixed(1)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right text-gray-300">
                          {struct.statistics.Dmin.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right text-gray-300">
                          {struct.statistics.Dmax.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right text-gray-300">
                          {struct.statistics.Dmean.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right text-gray-300">
                          {struct.statistics.D95.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right text-gray-300">
                          {struct.statistics.D50.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right text-gray-300">
                          {struct.statistics.D2.toFixed(2)}
                        </TableCell>
                        {prescriptionDose > 0 && (
                          <>
                            <TableCell className="py-2 text-xs text-right text-gray-300">
                              {struct.statistics.V100?.toFixed(1) ?? '-'}%
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right text-gray-300">
                              {struct.statistics.V95?.toFixed(1) ?? '-'}%
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DVHViewer;

