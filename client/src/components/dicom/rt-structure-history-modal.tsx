import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  RotateCcw, 
  Loader2, 
  Clock,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface HistoryEntry {
  id: number;
  timestamp: Date;
  actionType: string;
  actionSummary: string;
  affectedStructures: number[];
  canRestore: boolean;
}

interface RTStructureHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: number;
  structureSetLabel: string;
  onRestore?: () => void;
}

export function RTStructureHistoryModal({
  open,
  onOpenChange,
  seriesId,
  structureSetLabel,
  onRestore
}: RTStructureHistoryModalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history when dialog opens
  useEffect(() => {
    if (open && seriesId) {
      loadHistory();
    }
  }, [open, seriesId]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rt-structures/${seriesId}/history?limit=50`);
      
      if (!response.ok) {
        throw new Error('Failed to load history');
      }

      const data = await response.json();
      
      // Convert timestamp strings to Date objects
      const historyWithDates = data.history.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));
      
      setHistory(historyWithDates);
      
      // Select the most recent entry by default
      if (historyWithDates.length > 0) {
        setSelectedEntry(historyWithDates[0]);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (historyId: number) => {
    if (!confirm('Are you sure you want to restore to this version? Current changes will be saved in history.')) {
      return;
    }

    setIsRestoring(true);
    setError(null);

    try {
      const response = await fetch(`/api/rt-structures/${seriesId}/restore/${historyId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to restore from history');
      }

      console.log('✅ Restored from history');
      
      // Reload history after restore
      await loadHistory();
      
      // Notify parent component
      onRestore?.();
      
      // Close dialog after successful restore
      setTimeout(() => onOpenChange(false), 500);
    } catch (err) {
      console.error('Error restoring from history:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore from history');
    } finally {
      setIsRestoring(false);
    }
  };

  const getActionBadgeStyles = (actionType: string) => {
    switch (actionType) {
      case 'auto_save':
        return 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10';
      case 'manual_save':
        return 'border-blue-500/50 text-blue-400 bg-blue-500/10';
      case 'duplicate':
        return 'border-purple-500/50 text-purple-400 bg-purple-500/10';
      case 'restore':
        return 'border-amber-500/50 text-amber-400 bg-amber-500/10';
      case 'brush':
      case 'pen':
        return 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10';
      default:
        return 'border-zinc-500/50 text-zinc-400 bg-zinc-500/10';
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'auto_save':
      case 'manual_save':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'restore':
        return <RotateCcw className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
      <DialogContent className="p-0 bg-transparent border-0 shadow-none sm:max-w-[720px] [&>button]:hidden">
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
              <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
                <History className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">RT Structure History</h3>
                <p className="text-xs text-zinc-400">
                  <span className="text-emerald-400 font-medium">{structureSetLabel}</span>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
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

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-3" />
                <p className="text-sm text-zinc-400">Loading history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40 mb-3">
                  <Clock className="h-8 w-8 text-zinc-500" />
                </div>
                <p className="text-sm font-medium text-zinc-300 mb-1">
                  No history available yet
                </p>
                <p className="text-xs text-zinc-500 max-w-xs">
                  Changes will be automatically saved as you edit structures.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Timeline list */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Timeline</span>
                    <span className="text-[10px] text-zinc-500">{history.length} entries</span>
                  </div>
                  <ScrollArea className="h-[360px] pr-2">
                    <div className="space-y-1.5">
                      {history.map((entry, index) => (
                        <button
                          key={entry.id}
                          onClick={() => setSelectedEntry(entry)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border transition-all duration-200",
                            selectedEntry?.id === entry.id
                              ? 'bg-blue-500/15 border-blue-500/40'
                              : 'bg-zinc-800/30 border-zinc-700/30 hover:border-zinc-600/50 hover:bg-zinc-800/50'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] font-medium px-1.5 py-0 h-5 flex items-center gap-1",
                                    getActionBadgeStyles(entry.actionType)
                                  )}
                                >
                                  {getActionIcon(entry.actionType)}
                                  {entry.actionType.replace('_', ' ')}
                                </Badge>
                                {index === 0 && (
                                  <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 h-5 border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                                    Latest
                                  </Badge>
                                )}
                              </div>
                              <p className={cn(
                                "text-xs font-medium truncate mb-0.5",
                                selectedEntry?.id === entry.id ? "text-blue-200" : "text-zinc-200"
                              )}>
                                {entry.actionSummary}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                              </p>
                            </div>
                            
                            <div className="flex-shrink-0 mt-1">
                              <div className={cn(
                                "h-2 w-2 rounded-full transition-all",
                                selectedEntry?.id === entry.id 
                                  ? "bg-blue-400 shadow-sm shadow-blue-400/50" 
                                  : "bg-zinc-600"
                              )} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Details panel */}
                <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-3">
                  {selectedEntry ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Details</h4>
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg bg-black/20 border border-zinc-700/30">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Action</span>
                          <p className="font-medium text-zinc-200 text-xs">{selectedEntry.actionSummary}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-black/20 border border-zinc-700/30">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Timestamp</span>
                          <p className="font-medium text-zinc-200 text-xs">
                            {selectedEntry.timestamp.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-black/20 border border-zinc-700/30">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Affected</span>
                          <p className="font-medium text-zinc-200 text-xs">
                            {selectedEntry.affectedStructures.length} structure
                            {selectedEntry.affectedStructures.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {selectedEntry.canRestore && (
                        <Button
                          onClick={() => handleRestore(selectedEntry.id)}
                          disabled={isRestoring}
                          size="sm"
                          className={cn(
                            "w-full h-8 text-xs font-medium rounded-lg transition-all",
                            isRestoring
                              ? "bg-zinc-700/50 text-zinc-400 cursor-not-allowed"
                              : "bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400/60"
                          )}
                        >
                          {isRestoring ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              Restore
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Clock className="h-6 w-6 text-zinc-600 mb-2" />
                      <p className="text-xs text-zinc-500">Select an entry</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
