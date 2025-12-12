import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';

interface SaveAsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: number;
  currentLabel: string;
  structureCount: number;
  onSaveSuccess: (newSeriesId: number) => void;
}

export function SaveAsNewDialog({
  open,
  onOpenChange,
  seriesId,
  currentLabel,
  structureCount,
  onSaveSuccess
}: SaveAsNewDialogProps) {
  const [newLabel, setNewLabel] = useState(`${currentLabel} (Copy)`);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newLabel: newLabel.trim()
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
      
      // Reset form
      setNewLabel(`${currentLabel} (Copy)`);
    } catch (err) {
      console.error('Error creating new structure set:', err);
      setError(err instanceof Error ? err.message : 'Failed to create new structure set');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save As New Structure Set</DialogTitle>
          <DialogDescription>
            Create a duplicate of the current RT structure set with a new name.
            This will preserve the original set and create an independent copy.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newLabel">New Structure Set Name</Label>
            <Input
              id="newLabel"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter new structure set name"
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="rounded-lg bg-muted p-3 space-y-1">
            <p className="text-sm font-medium">Current Structure Set:</p>
            <p className="text-sm text-muted-foreground">{currentLabel}</p>
            <p className="text-sm text-muted-foreground">
              Contains {structureCount} structure{structureCount !== 1 ? 's' : ''}
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !newLabel.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save As New
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



