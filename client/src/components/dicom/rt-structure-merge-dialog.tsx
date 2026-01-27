/**
 * RT Structure Set Merge Dialog
 * 
 * Dialog for merging structures from multiple structure sets.
 * Shows structures from Set A vs Set B, allows selecting which to merge.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  GitMerge,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  Plus,
  Layers,
  ArrowRight,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface StructureInfo {
  roiNumber: number;
  structureName: string;
  color: string;
  volumeCc: number | null;
  sliceCount: number;
}

interface StructureSetData {
  id: number;
  label: string;
  structures: StructureInfo[];
}

interface RTStructureMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  structureSetA: { id: number; label: string } | null;
  structureSetB: { id: number; label: string } | null;
  onMergeComplete?: (newSeriesId: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RTStructureMergeDialog({
  isOpen,
  onClose,
  structureSetA,
  structureSetB,
  onMergeComplete,
}: RTStructureMergeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [dataA, setDataA] = useState<StructureSetData | null>(null);
  const [dataB, setDataB] = useState<StructureSetData | null>(null);
  
  const [selectedFromA, setSelectedFromA] = useState<Set<number>>(new Set());
  const [selectedFromB, setSelectedFromB] = useState<Set<number>>(new Set());
  
  const [outputMode, setOutputMode] = useState<'new' | 'overwriteA' | 'overwriteB'>('new');
  const [newSetName, setNewSetName] = useState('Merged Structure Set');

  // Load structure data for both sets
  const loadStructureData = useCallback(async () => {
    if (!structureSetA || !structureSetB) return;

    setLoading(true);
    setError(null);

    try {
      const [respA, respB] = await Promise.all([
        fetch(`/api/rt-structures/${structureSetA.id}/contours`),
        fetch(`/api/rt-structures/${structureSetB.id}/contours`),
      ]);

      if (!respA.ok || !respB.ok) {
        throw new Error('Failed to load structure set data');
      }

      const [jsonA, jsonB] = await Promise.all([respA.json(), respB.json()]);

      const mapStructures = (data: any): StructureInfo[] => {
        if (!data?.structures) return [];
        return data.structures.map((s: any) => ({
          roiNumber: s.roiNumber,
          structureName: s.structureName || `Structure ${s.roiNumber}`,
          color: s.color || '#808080',
          volumeCc: s.volumeCc ?? null,
          sliceCount: s.contourData?.length || 0,
        }));
      };

      setDataA({
        id: structureSetA.id,
        label: structureSetA.label,
        structures: mapStructures(jsonA),
      });
      setDataB({
        id: structureSetB.id,
        label: structureSetB.label,
        structures: mapStructures(jsonB),
      });

      // Pre-select all structures from A by default
      setSelectedFromA(new Set(mapStructures(jsonA).map((s) => s.roiNumber)));
      setSelectedFromB(new Set());
      
      setNewSetName(`${structureSetA.label} + ${structureSetB.label}`);
    } catch (err) {
      console.error('Error loading structure sets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load structure sets');
    } finally {
      setLoading(false);
    }
  }, [structureSetA, structureSetB]);

  useEffect(() => {
    if (isOpen && structureSetA && structureSetB) {
      loadStructureData();
    }
  }, [isOpen, structureSetA, structureSetB, loadStructureData]);

  const toggleStructureA = (roiNumber: number) => {
    setSelectedFromA((prev) => {
      const next = new Set(prev);
      if (next.has(roiNumber)) {
        next.delete(roiNumber);
      } else {
        next.add(roiNumber);
      }
      return next;
    });
  };

  const toggleStructureB = (roiNumber: number) => {
    setSelectedFromB((prev) => {
      const next = new Set(prev);
      if (next.has(roiNumber)) {
        next.delete(roiNumber);
      } else {
        next.add(roiNumber);
      }
      return next;
    });
  };

  const selectAllA = () => {
    if (dataA) setSelectedFromA(new Set(dataA.structures.map((s) => s.roiNumber)));
  };

  const selectNoneA = () => setSelectedFromA(new Set());

  const selectAllB = () => {
    if (dataB) setSelectedFromB(new Set(dataB.structures.map((s) => s.roiNumber)));
  };

  const selectNoneB = () => setSelectedFromB(new Set());

  const handleMerge = async () => {
    if (!dataA || !dataB) return;
    if (selectedFromA.size === 0 && selectedFromB.size === 0) {
      setError('Select at least one structure to merge');
      return;
    }

    setMerging(true);
    setError(null);

    try {
      const response = await fetch('/api/rt-structures/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setAId: dataA.id,
          setBId: dataB.id,
          structuresFromA: Array.from(selectedFromA),
          structuresFromB: Array.from(selectedFromB),
          outputMode,
          newSetName: outputMode === 'new' ? newSetName : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Merge failed');
      }

      const result = await response.json();
      console.log('✅ Merge complete:', result);

      onMergeComplete?.(result.newSeriesId || result.updatedSeriesId);
      onClose();
    } catch (err) {
      console.error('Merge error:', err);
      setError(err instanceof Error ? err.message : 'Failed to merge structure sets');
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const totalSelected = selectedFromA.size + selectedFromB.size;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
      <DialogContent className="p-0 bg-transparent border-0 shadow-none sm:max-w-[800px] [&>button]:hidden">
        <div
          className="rounded-2xl overflow-hidden border border-zinc-600/30 shadow-2xl shadow-black/40"
          style={{
            background: 'linear-gradient(180deg, rgba(80, 80, 90, 0.20) 0%, rgba(20, 20, 25, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-600/25">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
                <GitMerge className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Merge Structure Sets</h3>
                <p className="text-xs text-zinc-400">
                  Select structures to combine into a new or existing set
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 transition-all"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4">
            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mb-3" />
                <p className="text-sm text-zinc-400">Loading structure sets...</p>
              </div>
            ) : dataA && dataB ? (
              <div className="space-y-4">
                {/* Structure Selection Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Set A */}
                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/40 bg-blue-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-blue-500" />
                        <span className="text-xs font-medium text-blue-300 truncate max-w-[180px]">
                          Set A: {dataA.label}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={selectAllA} className="text-[10px] px-1.5 py-0.5 rounded text-cyan-400 hover:bg-cyan-500/20">
                          All
                        </button>
                        <button onClick={selectNoneA} className="text-[10px] px-1.5 py-0.5 rounded text-zinc-400 hover:bg-zinc-500/20">
                          None
                        </button>
                      </div>
                    </div>
                    <ScrollArea className="h-[280px] p-2">
                      <div className="space-y-1">
                        {dataA.structures.map((s) => (
                          <label
                            key={s.roiNumber}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                              selectedFromA.has(s.roiNumber)
                                ? "bg-blue-500/20 border border-blue-500/40"
                                : "bg-zinc-800/30 border border-transparent hover:bg-zinc-800/50"
                            )}
                          >
                            <Checkbox
                              checked={selectedFromA.has(s.roiNumber)}
                              onCheckedChange={() => toggleStructureA(s.roiNumber)}
                              className="h-4 w-4 border-zinc-500"
                            />
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-xs text-zinc-200 truncate flex-1">{s.structureName}</span>
                            {s.volumeCc !== null && (
                              <span className="text-[10px] text-zinc-500 tabular-nums">
                                {s.volumeCc.toFixed(1)} cc
                              </span>
                            )}
                          </label>
                        ))}
                        {dataA.structures.length === 0 && (
                          <p className="text-xs text-zinc-500 text-center py-4">No structures</p>
                        )}
                      </div>
                    </ScrollArea>
                    <div className="px-3 py-2 border-t border-zinc-700/40 bg-zinc-900/70">
                      <span className="text-[10px] text-zinc-400">
                        {selectedFromA.size} of {dataA.structures.length} selected
                      </span>
                    </div>
                  </div>

                  {/* Set B */}
                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/40 bg-emerald-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-emerald-500" />
                        <span className="text-xs font-medium text-emerald-300 truncate max-w-[180px]">
                          Set B: {dataB.label}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={selectAllB} className="text-[10px] px-1.5 py-0.5 rounded text-cyan-400 hover:bg-cyan-500/20">
                          All
                        </button>
                        <button onClick={selectNoneB} className="text-[10px] px-1.5 py-0.5 rounded text-zinc-400 hover:bg-zinc-500/20">
                          None
                        </button>
                      </div>
                    </div>
                    <ScrollArea className="h-[280px] p-2">
                      <div className="space-y-1">
                        {dataB.structures.map((s) => (
                          <label
                            key={s.roiNumber}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                              selectedFromB.has(s.roiNumber)
                                ? "bg-emerald-500/20 border border-emerald-500/40"
                                : "bg-zinc-800/30 border border-transparent hover:bg-zinc-800/50"
                            )}
                          >
                            <Checkbox
                              checked={selectedFromB.has(s.roiNumber)}
                              onCheckedChange={() => toggleStructureB(s.roiNumber)}
                              className="h-4 w-4 border-zinc-500"
                            />
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-xs text-zinc-200 truncate flex-1">{s.structureName}</span>
                            {s.volumeCc !== null && (
                              <span className="text-[10px] text-zinc-500 tabular-nums">
                                {s.volumeCc.toFixed(1)} cc
                              </span>
                            )}
                          </label>
                        ))}
                        {dataB.structures.length === 0 && (
                          <p className="text-xs text-zinc-500 text-center py-4">No structures</p>
                        )}
                      </div>
                    </ScrollArea>
                    <div className="px-3 py-2 border-t border-zinc-700/40 bg-zinc-900/70">
                      <span className="text-[10px] text-zinc-400">
                        {selectedFromB.size} of {dataB.structures.length} selected
                      </span>
                    </div>
                  </div>
                </div>

                {/* Output Options */}
                <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-3">
                  <h4 className="text-xs font-medium text-zinc-300 mb-3">Output Option</h4>
                  <RadioGroup
                    value={outputMode}
                    onValueChange={(v) => setOutputMode(v as typeof outputMode)}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="new" id="new" className="border-zinc-500" />
                      <Label htmlFor="new" className="text-xs text-zinc-300 cursor-pointer flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-cyan-400" />
                        Create new structure set
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="overwriteA" id="overwriteA" className="border-zinc-500" />
                      <Label htmlFor="overwriteA" className="text-xs text-zinc-300 cursor-pointer flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                        Merge into Set A ({dataA.label})
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="overwriteB" id="overwriteB" className="border-zinc-500" />
                      <Label htmlFor="overwriteB" className="text-xs text-zinc-300 cursor-pointer flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                        Merge into Set B ({dataB.label})
                      </Label>
                    </div>
                  </RadioGroup>

                  {outputMode === 'new' && (
                    <div className="mt-3 pt-3 border-t border-zinc-700/40">
                      <Label className="text-xs text-zinc-400 mb-1.5 block">New Set Name</Label>
                      <Input
                        value={newSetName}
                        onChange={(e) => setNewSetName(e.target.value)}
                        className="h-8 bg-black/20 border-zinc-700/50 text-zinc-200 text-xs"
                        placeholder="Enter name for merged set"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-zinc-600/25 flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              {totalSelected} structure{totalSelected !== 1 ? 's' : ''} selected
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={merging}
                className="h-8 px-3 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleMerge}
                disabled={merging || totalSelected === 0}
                className={cn(
                  "h-8 px-4 text-xs font-medium rounded-lg transition-all",
                  merging
                    ? "bg-zinc-700/50 text-zinc-400 cursor-not-allowed"
                    : "bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-600/30 hover:border-cyan-400/60"
                )}
              >
                {merging ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                    Merge ({totalSelected})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RTStructureMergeDialog;
