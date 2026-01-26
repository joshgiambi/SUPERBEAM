import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Loader2, AlertCircle, Layers } from 'lucide-react';

interface SaveAsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: number;
  currentLabel: string;
  structureCount: number;
  structures?: any[] | null;
  onSaveSuccess: (newSeriesId: number) => void;
}

export function SaveAsNewDialog({
  open,
  onOpenChange,
  seriesId,
  currentLabel,
  structureCount,
  structures,
  onSaveSuccess
}: SaveAsNewDialogProps) {
  const [newLabel, setNewLabel] = useState(`${currentLabel} (Copy)`);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewLabel(`${currentLabel} (Copy)`);
      setError(null);
    }
  }, [open, currentLabel]);

  const handleSave = async () => {
    if (!newLabel.trim()) {
      setError('Please enter a name for the new structure set');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/rt-structures/${seriesId}/save-as-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newLabel: newLabel.trim(),
          structures: structures || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create new structure set');
      }

      const data = await response.json();
      console.log('✅ Created new structure set:', data);
      
      onSaveSuccess(data.newSeriesId);
      onOpenChange(false);
    } catch (err) {
      console.error('Error creating new structure set:', err);
      setError(err instanceof Error ? err.message : 'Failed to create new structure set');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving && newLabel.trim()) {
      handleSave();
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
      <DialogContent className="p-0 bg-transparent border-0 shadow-none w-[280px] max-w-[280px] [&>button]:hidden">
        <div 
          className="rounded-xl backdrop-blur-xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsla(210, 15%, 12%, 0.98) 0%, hsla(210, 10%, 8%, 0.99) 100%)',
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(59, 130, 246, 0.2), 0 0 40px -15px rgba(59, 130, 246, 0.15)',
          }}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
            <Copy className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Save As New</span>
          </div>

          {/* Form */}
          <div className="p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Name</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 bg-black/20 border-white/[0.08] text-white text-sm placeholder-gray-500 focus:border-blue-500/40 rounded-lg"
                placeholder="Enter name for copy"
                disabled={isSaving}
                autoFocus
              />
            </div>

            {/* Current Set Info */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.06]">
              <Layers className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{currentLabel}</p>
                <p className="text-[10px] text-gray-500">{structureCount} structure{structureCount !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Preview */}
            {newLabel.trim() && newLabel.trim() !== currentLabel && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.06]">
                <div className="w-3 h-3 rounded bg-blue-500/50 border border-blue-400/30" />
                <span className="text-xs font-medium text-white truncate flex-1">{newLabel}</span>
                <span className="text-[10px] text-blue-400/70">New</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-[11px] text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-white/[0.06] flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-7 px-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !newLabel.trim()}
              className="h-7 px-3 text-xs bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}









