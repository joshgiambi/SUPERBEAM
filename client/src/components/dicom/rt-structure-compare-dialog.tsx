/**
 * RT Structure Set Comparison Dialog
 * 
 * Floating window for comparing structure sets using metrics like DSC, Hausdorff Distance, etc.
 * Matches structures by name and displays comparison metrics in a table.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Download,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Target,
  Layers,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface StructureSetInfo {
  id: number;
  label: string;
  color: string;
}

interface ComparisonMetric {
  structureName: string;
  structureColor: string;
  setAVolumeCc: number | null;
  setBVolumeCc: number | null;
  setCVolumeCc: number | null;
  diceAB: number | null;
  diceAC: number | null;
  diceBC: number | null;
  hausdorffAB: number | null;
  hausdorffAC: number | null;
  hausdorffBC: number | null;
  meanSurfaceDistAB: number | null;
  meanSurfaceDistAC: number | null;
  meanSurfaceDistBC: number | null;
  volumeDiffAB: number | null;
  volumeDiffAC: number | null;
  volumeDiffBC: number | null;
}

interface ComparisonData {
  setA: StructureSetInfo;
  setB: StructureSetInfo;
  setC: StructureSetInfo | null;
  metrics: ComparisonMetric[];
  computedAt: string;
}

interface RTStructureCompareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  structureSetIds: number[];
  structureSetLabels: Record<number, string>;
}

// ============================================================================
// HELPERS
// ============================================================================

const formatMetric = (value: number | null, decimals = 3): string => {
  if (value === null || value === undefined) return '—';
  return value.toFixed(decimals);
};

const getMetricColor = (value: number | null, type: 'dice' | 'distance' | 'volumeDiff'): string => {
  if (value === null) return 'text-zinc-500';
  
  if (type === 'dice') {
    if (value >= 0.9) return 'text-emerald-400';
    if (value >= 0.8) return 'text-green-400';
    if (value >= 0.7) return 'text-yellow-400';
    if (value >= 0.5) return 'text-orange-400';
    return 'text-red-400';
  }
  
  if (type === 'distance') {
    if (value <= 2) return 'text-emerald-400';
    if (value <= 5) return 'text-green-400';
    if (value <= 10) return 'text-yellow-400';
    if (value <= 20) return 'text-orange-400';
    return 'text-red-400';
  }
  
  if (type === 'volumeDiff') {
    const absVal = Math.abs(value);
    if (absVal <= 5) return 'text-emerald-400';
    if (absVal <= 10) return 'text-green-400';
    if (absVal <= 20) return 'text-yellow-400';
    if (absVal <= 50) return 'text-orange-400';
    return 'text-red-400';
  }
  
  return 'text-zinc-300';
};

const SET_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

// ============================================================================
// COMPONENT
// ============================================================================

export function RTStructureCompareDialog({
  isOpen,
  onClose,
  structureSetIds,
  structureSetLabels,
}: RTStructureCompareDialogProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (structureSetIds.length < 2) {
      setError('Select at least 2 structure sets to compare');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('setA', structureSetIds[0].toString());
      params.append('setB', structureSetIds[1].toString());
      if (structureSetIds[2]) {
        params.append('setC', structureSetIds[2].toString());
      }

      const response = await fetch(`/api/rt-structures/compare?${params}`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Comparison failed: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Comparison error:', err);
      setError(err instanceof Error ? err.message : 'Failed to compute comparison');
    } finally {
      setLoading(false);
    }
  }, [structureSetIds]);

  useEffect(() => {
    if (isOpen && structureSetIds.length >= 2) {
      fetchComparison();
    }
  }, [isOpen, structureSetIds, fetchComparison]);

  const exportCSV = () => {
    if (!data) return;

    const hasSetC = data.setC !== null;
    
    let csv = 'Structure,Color,';
    csv += `${data.setA.label} Vol (cc),${data.setB.label} Vol (cc),`;
    if (hasSetC) csv += `${data.setC!.label} Vol (cc),`;
    csv += 'DSC A-B,';
    if (hasSetC) csv += 'DSC A-C,DSC B-C,';
    csv += 'HD A-B (mm),';
    if (hasSetC) csv += 'HD A-C (mm),HD B-C (mm),';
    csv += 'MSD A-B (mm),';
    if (hasSetC) csv += 'MSD A-C (mm),MSD B-C (mm),';
    csv += 'Vol Diff A-B (%),';
    if (hasSetC) csv += 'Vol Diff A-C (%),Vol Diff B-C (%),';
    csv += '\n';

    data.metrics.forEach((m) => {
      csv += `"${m.structureName}","${m.structureColor}",`;
      csv += `${formatMetric(m.setAVolumeCc, 2)},${formatMetric(m.setBVolumeCc, 2)},`;
      if (hasSetC) csv += `${formatMetric(m.setCVolumeCc, 2)},`;
      csv += `${formatMetric(m.diceAB)},`;
      if (hasSetC) csv += `${formatMetric(m.diceAC)},${formatMetric(m.diceBC)},`;
      csv += `${formatMetric(m.hausdorffAB, 2)},`;
      if (hasSetC) csv += `${formatMetric(m.hausdorffAC, 2)},${formatMetric(m.hausdorffBC, 2)},`;
      csv += `${formatMetric(m.meanSurfaceDistAB, 2)},`;
      if (hasSetC) csv += `${formatMetric(m.meanSurfaceDistAC, 2)},${formatMetric(m.meanSurfaceDistBC, 2)},`;
      csv += `${formatMetric(m.volumeDiffAB, 1)},`;
      if (hasSetC) csv += `${formatMetric(m.volumeDiffAC, 1)},${formatMetric(m.volumeDiffBC, 1)},`;
      csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `structure_comparison_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const hasSetC = data?.setC !== null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card 
        className="w-[1000px] max-w-[95vw] max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-600/30 shadow-2xl shadow-black/40"
        style={{
          background: 'linear-gradient(180deg, rgba(80, 80, 90, 0.20) 0%, rgba(20, 20, 25, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <CardHeader className="pb-3 border-b border-zinc-600/25 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
                <Target className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-100">
                  Structure Set Comparison
                </CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {structureSetIds.length} sets • DSC, HD, MSD metrics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={exportCSV}
                disabled={!data}
                className="h-8 text-xs border-zinc-600/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="ml-3 text-zinc-400">Computing comparison metrics...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Comparison Failed</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-4">
              {/* Set Legend */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900/50 border border-zinc-700/40">
                <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Sets:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: SET_COLORS[0] }} />
                  <span className="text-xs text-zinc-200">A: {data.setA.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: SET_COLORS[1] }} />
                  <span className="text-xs text-zinc-200">B: {data.setB.label}</span>
                </div>
                {data.setC && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: SET_COLORS[2] }} />
                    <span className="text-xs text-zinc-200">C: {data.setC.label}</span>
                  </div>
                )}
              </div>

              {/* Metrics Table */}
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-700/50">
                      <TableHead className="text-zinc-400 text-xs font-medium w-[180px] sticky left-0 bg-zinc-900/90">Structure</TableHead>
                      <TableHead className="text-zinc-400 text-xs font-medium text-right">Vol A (cc)</TableHead>
                      <TableHead className="text-zinc-400 text-xs font-medium text-right">Vol B (cc)</TableHead>
                      {hasSetC && <TableHead className="text-zinc-400 text-xs font-medium text-right">Vol C (cc)</TableHead>}
                      <TableHead className="text-zinc-400 text-xs font-medium text-center">
                        <div className="flex flex-col items-center">
                          <span>DSC</span>
                          <span className="text-[10px] text-zinc-500">A-B</span>
                        </div>
                      </TableHead>
                      {hasSetC && (
                        <>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>DSC</span>
                              <span className="text-[10px] text-zinc-500">A-C</span>
                            </div>
                          </TableHead>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>DSC</span>
                              <span className="text-[10px] text-zinc-500">B-C</span>
                            </div>
                          </TableHead>
                        </>
                      )}
                      <TableHead className="text-zinc-400 text-xs font-medium text-center">
                        <div className="flex flex-col items-center">
                          <span>HD (mm)</span>
                          <span className="text-[10px] text-zinc-500">A-B</span>
                        </div>
                      </TableHead>
                      {hasSetC && (
                        <>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>HD (mm)</span>
                              <span className="text-[10px] text-zinc-500">A-C</span>
                            </div>
                          </TableHead>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>HD (mm)</span>
                              <span className="text-[10px] text-zinc-500">B-C</span>
                            </div>
                          </TableHead>
                        </>
                      )}
                      <TableHead className="text-zinc-400 text-xs font-medium text-center">
                        <div className="flex flex-col items-center">
                          <span>MSD (mm)</span>
                          <span className="text-[10px] text-zinc-500">A-B</span>
                        </div>
                      </TableHead>
                      {hasSetC && (
                        <>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>MSD (mm)</span>
                              <span className="text-[10px] text-zinc-500">A-C</span>
                            </div>
                          </TableHead>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>MSD (mm)</span>
                              <span className="text-[10px] text-zinc-500">B-C</span>
                            </div>
                          </TableHead>
                        </>
                      )}
                      <TableHead className="text-zinc-400 text-xs font-medium text-center">
                        <div className="flex flex-col items-center">
                          <span>ΔVol (%)</span>
                          <span className="text-[10px] text-zinc-500">A-B</span>
                        </div>
                      </TableHead>
                      {hasSetC && (
                        <>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>ΔVol (%)</span>
                              <span className="text-[10px] text-zinc-500">A-C</span>
                            </div>
                          </TableHead>
                          <TableHead className="text-zinc-400 text-xs font-medium text-center">
                            <div className="flex flex-col items-center">
                              <span>ΔVol (%)</span>
                              <span className="text-[10px] text-zinc-500">B-C</span>
                            </div>
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.metrics.map((metric, idx) => (
                      <TableRow key={idx} className="border-zinc-800/50 hover:bg-zinc-800/30">
                        <TableCell className="sticky left-0 bg-zinc-900/90">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: metric.structureColor }}
                            />
                            <span className="text-xs text-zinc-200 truncate max-w-[140px]">
                              {metric.structureName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-zinc-400 tabular-nums">
                          {formatMetric(metric.setAVolumeCc, 1)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-zinc-400 tabular-nums">
                          {formatMetric(metric.setBVolumeCc, 1)}
                        </TableCell>
                        {hasSetC && (
                          <TableCell className="text-right text-xs text-zinc-400 tabular-nums">
                            {formatMetric(metric.setCVolumeCc, 1)}
                          </TableCell>
                        )}
                        <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.diceAB, 'dice'))}>
                          {formatMetric(metric.diceAB)}
                        </TableCell>
                        {hasSetC && (
                          <>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.diceAC, 'dice'))}>
                              {formatMetric(metric.diceAC)}
                            </TableCell>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.diceBC, 'dice'))}>
                              {formatMetric(metric.diceBC)}
                            </TableCell>
                          </>
                        )}
                        <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.hausdorffAB, 'distance'))}>
                          {formatMetric(metric.hausdorffAB, 1)}
                        </TableCell>
                        {hasSetC && (
                          <>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.hausdorffAC, 'distance'))}>
                              {formatMetric(metric.hausdorffAC, 1)}
                            </TableCell>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.hausdorffBC, 'distance'))}>
                              {formatMetric(metric.hausdorffBC, 1)}
                            </TableCell>
                          </>
                        )}
                        <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.meanSurfaceDistAB, 'distance'))}>
                          {formatMetric(metric.meanSurfaceDistAB, 2)}
                        </TableCell>
                        {hasSetC && (
                          <>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.meanSurfaceDistAC, 'distance'))}>
                              {formatMetric(metric.meanSurfaceDistAC, 2)}
                            </TableCell>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.meanSurfaceDistBC, 'distance'))}>
                              {formatMetric(metric.meanSurfaceDistBC, 2)}
                            </TableCell>
                          </>
                        )}
                        <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.volumeDiffAB, 'volumeDiff'))}>
                          {metric.volumeDiffAB !== null ? `${metric.volumeDiffAB > 0 ? '+' : ''}${formatMetric(metric.volumeDiffAB, 1)}` : '—'}
                        </TableCell>
                        {hasSetC && (
                          <>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.volumeDiffAC, 'volumeDiff'))}>
                              {metric.volumeDiffAC !== null ? `${metric.volumeDiffAC > 0 ? '+' : ''}${formatMetric(metric.volumeDiffAC, 1)}` : '—'}
                            </TableCell>
                            <TableCell className={cn("text-center text-xs tabular-nums font-medium", getMetricColor(metric.volumeDiffBC, 'volumeDiff'))}>
                              {metric.volumeDiffBC !== null ? `${metric.volumeDiffBC > 0 ? '+' : ''}${formatMetric(metric.volumeDiffBC, 1)}` : '—'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Legend */}
              <div className="flex items-center gap-6 p-3 rounded-xl bg-zinc-900/50 border border-zinc-700/40 text-[10px]">
                <div className="flex items-center gap-4">
                  <span className="text-zinc-400 uppercase tracking-wider font-medium">DSC:</span>
                  <span className="text-emerald-400">≥0.9 Excellent</span>
                  <span className="text-green-400">≥0.8 Good</span>
                  <span className="text-yellow-400">≥0.7 Fair</span>
                  <span className="text-orange-400">≥0.5 Poor</span>
                  <span className="text-red-400">&lt;0.5 Bad</span>
                </div>
                <div className="h-4 w-px bg-zinc-700" />
                <div className="flex items-center gap-4">
                  <span className="text-zinc-400 uppercase tracking-wider font-medium">HD/MSD:</span>
                  <span className="text-emerald-400">≤2mm</span>
                  <span className="text-green-400">≤5mm</span>
                  <span className="text-yellow-400">≤10mm</span>
                  <span className="text-red-400">&gt;20mm</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RTStructureCompareDialog;
