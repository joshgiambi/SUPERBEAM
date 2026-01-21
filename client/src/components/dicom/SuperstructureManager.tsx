/**
 * SuperstructureManager Component
 * 
 * Manages boolean operation-derived structures (superstructures) that auto-update
 * when their source structures are modified.
 * 
 * Features:
 * - Create superstructures from boolean operations
 * - Track operation lineage (A ∪ B - C)
 * - Auto-regenerate when source structures change
 * - Display operation summary
 * - Toggle auto-update behavior
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Trash2, Info, Settings2, IterationCw, ChevronDown, ChevronRight } from 'lucide-react';
import type { Superstructure, SuperstructureWithStructure, RTStructureSet } from '@/types/rt-structures';

interface SuperstructureManagerProps {
  rtStructureSetId: number;
  rtStructures: RTStructureSet | null;
  superstructures: Superstructure[];
  onRegenerateSuperstructure: (superstructureId: number) => Promise<void>;
  onDeleteSuperstructure: (superstructureId: number) => Promise<void>;
  onToggleAutoUpdate: (superstructureId: number, enabled: boolean) => Promise<void>;
  onSuperstructureClick?: (structureId: number) => void;
}

export function SuperstructureManager({
  rtStructureSetId,
  rtStructures,
  superstructures,
  onRegenerateSuperstructure,
  onDeleteSuperstructure,
  onToggleAutoUpdate,
  onSuperstructureClick,
}: SuperstructureManagerProps) {
  const [expandedSuperstructures, setExpandedSuperstructures] = useState<Set<number>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set());

  // Get structure name from roiNumber
  const getStructureName = useCallback((roiNumber: number): string => {
    if (!rtStructures) return `Structure ${roiNumber}`;
    const structure = rtStructures.structures.find(s => s.roiNumber === roiNumber);
    return structure?.structureName || `Structure ${roiNumber}`;
  }, [rtStructures]);

  // Get structure color from roiNumber
  const getStructureColor = useCallback((roiNumber: number): string => {
    if (!rtStructures) return '#888888';
    const structure = rtStructures.structures.find(s => s.roiNumber === roiNumber);
    if (structure?.color) {
      const [r, g, b] = structure.color;
      return `rgb(${r}, ${g}, ${b})`;
    }
    return '#888888';
  }, [rtStructures]);

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedSuperstructures);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSuperstructures(newExpanded);
  };

  const handleRegenerate = async (id: number) => {
    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      await onRegenerateSuperstructure(id);
    } finally {
      setRegeneratingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Format operation expression with symbols
  const formatExpression = (expression: string): string => {
    return expression
      .replace(/union/gi, '∪')
      .replace(/intersect/gi, '∩')
      .replace(/subtract/gi, '−')
      .replace(/xor/gi, '⊕');
  };

  // Get operation type display name
  const getOperationTypeDisplay = (type: string): string => {
    const typeMap: Record<string, string> = {
      union: 'Union (∪)',
      intersect: 'Intersection (∩)',
      subtract: 'Subtraction (−)',
      xor: 'XOR (⊕)',
      complex: 'Complex Expression',
      margin: 'Margin Expansion',
    };
    return typeMap[type] || type;
  };

  if (superstructures.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        <IterationCw size={14} className="text-blue-400" />
        <span className="font-semibold">Superstructures ({superstructures.length})</span>
        <Info 
          size={12} 
          className="cursor-help text-gray-500 hover:text-gray-300" 
          title="Superstructures auto-update when their source structures are modified"
        />
      </div>

      {superstructures.map((superstructure) => {
        const isExpanded = expandedSuperstructures.has(superstructure.id);
        const isRegenerating = regeneratingIds.has(superstructure.id);
        const structureName = getStructureName(superstructure.rtStructureId);
        const structureColor = getStructureColor(superstructure.rtStructureId);

        return (
          <div 
            key={superstructure.id}
            className="bg-gray-900/50 border border-blue-500/40 rounded-lg p-2.5 space-y-2 hover:border-blue-400/60 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  toggleExpanded(superstructure.id);
                  if (onSuperstructureClick) {
                    onSuperstructureClick(superstructure.rtStructureId);
                  }
                }}
                className="flex items-center gap-2 flex-1 text-left hover:bg-gray-800/50 rounded px-2 py-1 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-blue-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                )}
                <div 
                  className="w-3.5 h-3.5 rounded border-2 border-white/40 flex-shrink-0"
                  style={{ backgroundColor: structureColor }}
                />
                <span className="text-sm text-white font-medium truncate">
                  {structureName}
                </span>
                <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                  <span className="text-[10px] text-blue-300/80 font-mono bg-blue-900/30 px-1.5 py-0.5 rounded">
                    {formatExpression(superstructure.operationExpression)}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    superstructure.autoUpdate 
                      ? 'text-cyan-300 bg-cyan-900/30' 
                      : 'text-gray-400 bg-gray-800/30'
                  }`}>
                    {superstructure.autoUpdate ? '🔄 Auto' : '⏸ Manual'}
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegenerate(superstructure.id)}
                  disabled={isRegenerating}
                  className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                  title="Regenerate now"
                >
                  <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteSuperstructure(superstructure.id)}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  title="Delete superstructure"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="space-y-2.5 pt-2 border-t border-blue-500/30">
                {/* Operation Summary - Enhanced */}
                <div className="text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                    <IterationCw size={11} />
                    <span>Operation Details</span>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded px-3 py-2 font-mono text-blue-200 text-sm">
                    {formatExpression(superstructure.operationExpression)}
                  </div>
                  <div className="text-gray-400 text-[10px] flex items-center gap-2">
                    <span>Type:</span>
                    <span className="text-blue-300">{getOperationTypeDisplay(superstructure.operationType)}</span>
                  </div>
                </div>

                {/* Source Structures - Enhanced */}
                <div className="text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                    <span>Source Structures ({superstructure.sourceStructureNames.length})</span>
                  </div>
                  <div className="space-y-1">
                    {superstructure.sourceStructureNames.map((name, idx) => {
                      const sourceId = superstructure.sourceStructureIds[idx];
                      const sourceColor = getStructureColor(sourceId);
                      return (
                        <div 
                          key={idx}
                          className="flex items-center gap-2 bg-gray-800/40 border border-gray-700/50 rounded px-2.5 py-1.5 hover:bg-gray-800/60 transition-colors"
                        >
                          <div 
                            className="w-2.5 h-2.5 rounded border-2 border-white/30 flex-shrink-0"
                            style={{ backgroundColor: sourceColor }}
                          />
                          <span className="text-gray-200 font-medium">{name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Auto-update Toggle - Enhanced */}
                <div className="flex items-center justify-between bg-blue-900/20 border border-blue-500/30 rounded px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-200 font-medium">Auto-update on source changes</span>
                    {superstructure.autoUpdate && (
                      <span className="text-[10px] text-cyan-300 bg-cyan-900/30 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={superstructure.autoUpdate}
                    onCheckedChange={(checked) => onToggleAutoUpdate(superstructure.id, checked)}
                    className="scale-75"
                  />
                </div>

                {/* Metadata - Compact */}
                <div className="text-[10px] text-gray-500 space-y-0.5 flex items-center justify-between pt-1 border-t border-gray-700/50">
                  <div>
                    <span className="text-gray-400">Created:</span>{' '}
                    <span>{new Date(superstructure.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Updated:</span>{' '}
                    <span>{new Date(superstructure.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook for managing superstructure operations
 */
export function useSuperstructures(rtStructureSetId: number | null, rtStructures?: { structures?: Array<{ roiNumber: number }> } | null) {
  const [superstructures, setSuperstructures] = useState<Superstructure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Clean up orphaned superstructures (where the referenced structure no longer exists)
  const cleanupOrphanedSuperstructures = useCallback(async (existingRoiNumbers: number[]) => {
    if (!rtStructureSetId) return;
    
    try {
      const response = await fetch(`/api/superstructures/${rtStructureSetId}/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingRoiNumbers })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.cleanedCount > 0) {
          console.log(`🧹 SUPERSTRUCTURE: Cleaned up ${result.cleanedCount} orphaned record(s)`);
        }
      }
    } catch (err) {
      console.warn('Failed to cleanup orphaned superstructures:', err);
    }
  }, [rtStructureSetId]);

  // Load superstructures for a structure set
  const loadSuperstructures = useCallback(async () => {
    if (!rtStructureSetId) {
      setSuperstructures([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // If we have RT structures, clean up orphaned superstructures first
      if (rtStructures?.structures && rtStructures.structures.length > 0) {
        const existingRoiNumbers = rtStructures.structures.map(s => s.roiNumber);
        await cleanupOrphanedSuperstructures(existingRoiNumbers);
      }
      
      const response = await fetch(`/api/superstructures/${rtStructureSetId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setSuperstructures([]);
          return;
        }
        throw new Error(`Failed to load superstructures: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Filter to only include superstructures whose target structure actually exists
      // Note: API returns rtStructureRoiNumber (database field name)
      const existingRoiNumbers = rtStructures?.structures?.map(s => s.roiNumber) || [];
      const validSuperstructures = data.filter((ss: any) => 
        existingRoiNumbers.includes(ss.rtStructureRoiNumber)
      );
      
      setSuperstructures(validSuperstructures);
    } catch (err) {
      console.error('Failed to load superstructures:', err);
      setError(err instanceof Error ? err : new Error('Failed to load superstructures'));
      setSuperstructures([]);
    } finally {
      setIsLoading(false);
    }
  }, [rtStructureSetId, rtStructures, cleanupOrphanedSuperstructures]);

  // Create a new superstructure
  const createSuperstructure = useCallback(async (params: {
    rtStructureId: number;
    sourceStructureIds: number[];
    sourceStructureNames: string[];
    operationExpression: string;
    operationType: 'union' | 'intersect' | 'subtract' | 'xor' | 'complex';
    autoUpdate?: boolean;
  }) => {
    if (!rtStructureSetId) {
      throw new Error('No RT structure set ID');
    }

    const response = await fetch(`/api/superstructures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        rtStructureSetId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create superstructure: ${response.statusText}`);
    }

    const newSuperstructure = await response.json();
    setSuperstructures(prev => [...prev, newSuperstructure]);
    return newSuperstructure;
  }, [rtStructureSetId]);

  // Regenerate a superstructure
  const regenerateSuperstructure = useCallback(async (superstructureId: number) => {
    const response = await fetch(`/api/superstructures/${superstructureId}/regenerate`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to regenerate superstructure: ${response.statusText}`);
    }

    // Reload superstructures to get updated data
    await loadSuperstructures();
  }, [loadSuperstructures]);

  // Delete a superstructure
  const deleteSuperstructure = useCallback(async (superstructureId: number) => {
    const response = await fetch(`/api/superstructures/${superstructureId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete superstructure: ${response.statusText}`);
    }

    setSuperstructures(prev => prev.filter(s => s.id !== superstructureId));
  }, []);

  // Toggle auto-update
  const toggleAutoUpdate = useCallback(async (superstructureId: number, enabled: boolean) => {
    const response = await fetch(`/api/superstructures/${superstructureId}/auto-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoUpdate: enabled }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update auto-update setting: ${response.statusText}`);
    }

    setSuperstructures(prev => 
      prev.map(s => s.id === superstructureId ? { ...s, autoUpdate: enabled } : s)
    );
  }, []);

  // Check if source structures have changed and trigger auto-updates
  const checkAndRegenerateAutoUpdates = useCallback(async (modifiedStructureIds: number[]) => {
    const autoUpdateSuperstructures = superstructures.filter(s => 
      s.autoUpdate && s.sourceStructureIds.some(id => modifiedStructureIds.includes(id))
    );

    if (autoUpdateSuperstructures.length === 0) {
      return;
    }

    console.log(`🔄 Auto-regenerating ${autoUpdateSuperstructures.length} superstructure(s)...`);

    for (const superstructure of autoUpdateSuperstructures) {
      try {
        await regenerateSuperstructure(superstructure.id);
      } catch (err) {
        console.error(`Failed to auto-regenerate superstructure ${superstructure.id}:`, err);
      }
    }
  }, [superstructures, regenerateSuperstructure]);

  // Load superstructures when structure set changes
  useEffect(() => {
    loadSuperstructures();
  }, [loadSuperstructures]);

  return {
    superstructures,
    isLoading,
    error,
    createSuperstructure,
    regenerateSuperstructure,
    deleteSuperstructure,
    toggleAutoUpdate,
    checkAndRegenerateAutoUpdates,
    reload: loadSuperstructures,
  };
}


