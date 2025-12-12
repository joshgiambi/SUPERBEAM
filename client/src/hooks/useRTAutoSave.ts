import { useEffect, useRef, useState, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseRTAutoSaveOptions {
  seriesId: number | null;
  structures: any[] | null;
  enabled?: boolean;
  debounceMs?: number;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

interface SaveStatusInfo {
  status: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
}

export function useRTAutoSave({
  seriesId,
  structures,
  enabled = true,
  debounceMs = 5000,
  onSaveSuccess,
  onSaveError
}: UseRTAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatusInfo>({
    status: 'idle',
    lastSaved: null,
    error: null
  });
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStructuresRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (!seriesId || !structures || isSavingRef.current) {
      return;
    }

    try {
      isSavingRef.current = true;
      setSaveStatus(prev => ({ ...prev, status: 'saving', error: null }));

      console.log(`💾 Manually saving RT structures for series ${seriesId}...`);

      const response = await fetch(`/api/rt-structures/${seriesId}/save`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structures,
          action: 'manual_save',
          actionDetails: {
            timestamp: new Date().toISOString(),
            structureCount: structures.length
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save RT structures');
      }

      const now = new Date();
      setSaveStatus({
        status: 'saved',
        lastSaved: now,
        error: null
      });

      // Store the saved state
      previousStructuresRef.current = JSON.stringify(structures);

      console.log(`✅ Saved RT structures successfully at ${now.toLocaleTimeString()}`);
      
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error saving RT structures:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setSaveStatus({
        status: 'error',
        lastSaved: null,
        error: errorMessage
      });
      
      onSaveError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      isSavingRef.current = false;
    }
  }, [seriesId, structures, onSaveSuccess, onSaveError]);

  // Auto-save effect with debouncing
  useEffect(() => {
    if (!enabled || !seriesId || !structures) {
      return;
    }

    // Check if structures have changed
    const currentStructuresStr = JSON.stringify(structures);
    if (previousStructuresRef.current === currentStructuresStr) {
      return; // No changes, skip save
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) {
        return; // Skip if already saving
      }

      try {
        isSavingRef.current = true;
        setSaveStatus(prev => ({ ...prev, status: 'saving', error: null }));

        console.log(`🔄 Auto-saving RT structures for series ${seriesId}...`);

        const response = await fetch(`/api/rt-structures/${seriesId}/save`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            structures,
            action: 'auto_save',
            actionDetails: {
              timestamp: new Date().toISOString(),
              structureCount: structures.length
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to auto-save RT structures');
        }

        const now = new Date();
        setSaveStatus({
          status: 'saved',
          lastSaved: now,
          error: null
        });

        // Store the saved state
        previousStructuresRef.current = currentStructuresStr;

        console.log(`✅ Auto-saved RT structures at ${now.toLocaleTimeString()}`);
        
        onSaveSuccess?.();
      } catch (error) {
        console.error('Error auto-saving RT structures:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        setSaveStatus({
          status: 'error',
          lastSaved: null,
          error: errorMessage
        });
        
        onSaveError?.(error instanceof Error ? error : new Error(errorMessage));
      } finally {
        isSavingRef.current = false;
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, seriesId, structures, debounceMs, onSaveSuccess, onSaveError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveStatus: saveStatus.status,
    lastSaved: saveStatus.lastSaved,
    error: saveStatus.error,
    saveNow,
    isSaving: isSavingRef.current
  };
}



