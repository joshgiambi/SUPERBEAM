import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  CheckCircle2
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
        return 'border-emerald-500/60 text-emerald-400 bg-emerald-500/10';
      case 'manual_save':
        return 'border-blue-500/60 text-blue-400 bg-blue-500/10';
      case 'duplicate':
        return 'border-purple-500/60 text-purple-400 bg-purple-500/10';
      case 'restore':
        return 'border-amber-500/60 text-amber-400 bg-amber-500/10';
      case 'brush':
      case 'pen':
        return 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10';
      default:
        return 'border-gray-500/60 text-gray-400 bg-gray-500/10';
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
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col bg-gradient-to-br from-gray-900/98 via-gray-900/95 to-gray-950/98 border border-white/20 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-white">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
              <History className="h-5 w-5 text-blue-400" />
            </div>
            RT Structure History
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            View and restore previous versions of <span className="text-green-400 font-medium">{structureSetLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-gradient-to-br from-red-900/30 to-red-950/30 border border-red-500/40 p-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-blue-400 mb-3" />
            <p className="text-sm text-gray-400">Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 mb-4">
              <Clock className="h-10 w-10 text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-300 mb-1">
              No history available yet
            </p>
            <p className="text-xs text-gray-500 max-w-xs">
              Changes will be automatically saved as you edit structures.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 pt-2">
            {/* Timeline list */}
            <div className="md:col-span-2">
              <ScrollArea className="h-[420px] pr-3">
                <div className="space-y-2">
                  {history.map((entry, index) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all duration-200 backdrop-blur-sm",
                        selectedEntry?.id === entry.id
                          ? 'bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-600/15 border-blue-400/50 shadow-md shadow-blue-500/10'
                          : 'bg-gradient-to-br from-gray-800/40 via-gray-800/30 to-gray-900/40 border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-700/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1",
                                getActionBadgeStyles(entry.actionType)
                              )}
                            >
                              {getActionIcon(entry.actionType)}
                              {entry.actionType.replace('_', ' ')}
                            </Badge>
                            {index === 0 && (
                              <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 border-emerald-500/60 text-emerald-400 bg-emerald-500/10">
                                Latest
                              </Badge>
                            )}
                          </div>
                          <p className={cn(
                            "text-sm font-medium truncate mb-1",
                            selectedEntry?.id === entry.id ? "text-blue-200" : "text-gray-200"
                          )}>
                            {entry.actionSummary}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                        
                        <div className="flex-shrink-0 mt-1">
                          <div className={cn(
                            "h-2.5 w-2.5 rounded-full transition-all",
                            selectedEntry?.id === entry.id 
                              ? "bg-blue-400 shadow-sm shadow-blue-400/50" 
                              : "bg-gray-600"
                          )} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Details panel */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-800/50 via-gray-800/30 to-gray-900/50 p-4 backdrop-blur-sm">
              {selectedEntry ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</h4>
                    <div className="space-y-3 text-sm">
                      <div className="p-2.5 rounded-lg bg-gray-900/50 border border-gray-700/40">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Action</span>
                        <p className="font-medium text-gray-200 text-xs">{selectedEntry.actionSummary}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-gray-900/50 border border-gray-700/40">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Timestamp</span>
                        <p className="font-medium text-gray-200 text-xs">
                          {selectedEntry.timestamp.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-gray-900/50 border border-gray-700/40">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Affected Structures</span>
                        <p className="font-medium text-gray-200 text-xs">
                          {selectedEntry.affectedStructures.length} structure
                          {selectedEntry.affectedStructures.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedEntry.canRestore && (
                    <Button
                      onClick={() => handleRestore(selectedEntry.id)}
                      disabled={isRestoring}
                      className={cn(
                        "w-full h-10 text-sm font-medium rounded-lg transition-all duration-200",
                        isRestoring
                          ? "bg-gray-700/50 text-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-600 hover:to-blue-500 text-white border border-blue-500/50 hover:border-blue-400/70 shadow-lg shadow-blue-500/20"
                      )}
                    >
                      {isRestoring ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Restoring...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore to This Point
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Clock className="h-8 w-8 text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500">Select an entry to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
