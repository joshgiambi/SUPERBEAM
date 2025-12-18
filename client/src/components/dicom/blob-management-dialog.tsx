/**
 * Blob Management Dialog - Aurora Edition
 * 
 * Professional UI component for managing and removing disconnected 3D blob volumes
 * Redesigned to match the Aurora contour toolbar aesthetic
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Target, 
  Trash2, 
  X, 
  Eye, 
  EyeOff, 
  SplitSquareHorizontal,
  CheckSquare,
  Square,
  Layers,
  GripVertical
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createContourKey, type Blob, type BlobContour } from '@/lib/blob-operations';

interface BlobManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  blobs: Blob[];
  structureId: number;
  structureName: string;
  structureColor?: number[];
  onDeleteBlobs: (blobIds: number[]) => void;
  onLocalize: (blobId: number, contours: BlobContour[]) => void;
  onToggleOtherContours?: (hide: boolean) => void;
  imageMetadata?: any;
}

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};

export function BlobManagementDialog({
  isOpen,
  onClose,
  blobs,
  structureId,
  structureName,
  structureColor = [168, 85, 247], // Default purple
  onDeleteBlobs,
  onLocalize,
  onToggleOtherContours,
  imageMetadata
}: BlobManagementDialogProps) {
  const { toast } = useToast();
  const [selectedBlobIds, setSelectedBlobIds] = useState<Set<number>>(new Set());
  const [blobList, setBlobList] = useState<Blob[]>(blobs);
  const [hideOtherContours, setHideOtherContours] = useState(false);

  // Color computations
  const accentRgb = useMemo(() => `rgb(${structureColor.join(',')})`, [structureColor]);
  const [accentHue] = useMemo(() => rgbToHsl(structureColor[0], structureColor[1], structureColor[2]), [structureColor]);

  // Auto-select small blobs when dialog opens or blobs change
  useEffect(() => {
    if (blobs.length > 0) {
      setBlobList(blobs);
      
      // Auto-select smallest blobs
      const sorted = [...blobs].sort((a, b) => a.volumeCc - b.volumeCc);
      const largestVolume = sorted[sorted.length - 1].volumeCc;
      const threshold = largestVolume * 0.2;
      
      const autoSelectIds = new Set(
        sorted.filter(b => b.volumeCc < threshold).map(b => b.id)
      );
      
      // If no blobs meet the 20% threshold, select the smallest 80% by count
      if (autoSelectIds.size === 0) {
        const smallBlobCount = Math.floor(sorted.length * 0.8);
        for (let i = 0; i < smallBlobCount; i++) {
          autoSelectIds.add(sorted[i].id);
        }
      }
      
      setSelectedBlobIds(autoSelectIds);
    }
  }, [blobs]);

  // Reset hide state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setHideOtherContours(false);
      onToggleOtherContours?.(false);
    }
  }, [isOpen, onToggleOtherContours]);

  if (!isOpen) return null;

  const handleSelectSmallBlobs = () => {
    const sorted = [...blobList].sort((a, b) => a.volumeCc - b.volumeCc);
    const largestVolume = sorted[sorted.length - 1].volumeCc;
    const threshold = largestVolume * 0.2;
    
    const autoSelectIds = new Set(
      sorted.filter(b => b.volumeCc < threshold).map(b => b.id)
    );
    
    if (autoSelectIds.size === 0) {
      const smallBlobCount = Math.floor(sorted.length * 0.8);
      for (let i = 0; i < smallBlobCount; i++) {
        autoSelectIds.add(sorted[i].id);
      }
    }
    
    setSelectedBlobIds(autoSelectIds);
  };

  const handleSelectAll = () => {
    setSelectedBlobIds(new Set(blobList.map(b => b.id)));
  };

  const handleSelectNone = () => {
    setSelectedBlobIds(new Set());
  };

  const handleToggleBlob = (blobId: number) => {
    const next = new Set(selectedBlobIds);
    if (next.has(blobId)) {
      next.delete(blobId);
    } else {
      next.add(blobId);
    }
    setSelectedBlobIds(next);
  };

  const handleDeleteSingleBlob = (blobId: number) => {
    onDeleteBlobs([blobId]);
    
    const updated = blobList.filter(b => b.id !== blobId);
    setBlobList(updated);
    
    const next = new Set(selectedBlobIds);
    next.delete(blobId);
    setSelectedBlobIds(next);
    
    if (updated.length === 0) {
      onClose();
      toast({ title: "All blobs removed", description: "No more blobs remaining" });
    } else {
      toast({ title: "Blob deleted", description: `Blob ${blobId} removed` });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedBlobIds.size === 0) return;
    
    const idsToDelete = Array.from(selectedBlobIds);
    onDeleteBlobs(idsToDelete);
    
    toast({ 
      title: "Blobs removed", 
      description: `Deleted ${selectedBlobIds.size} blob${selectedBlobIds.size !== 1 ? 's' : ''}`
    });
    
    onClose();
  };

  const handleToggleOtherContours = () => {
    const newState = !hideOtherContours;
    setHideOtherContours(newState);
    onToggleOtherContours?.(newState);
  };

  const totalSelectedVolume = blobList
    .filter(b => selectedBlobIds.has(b.id))
    .reduce((sum, b) => sum + b.volumeCc, 0);

  const sortedBlobs = [...blobList].sort((a, b) => b.volumeCc - a.volumeCc);

  return (
    <TooltipProvider delayDuration={200}>
      {/* Backdrop with gradient spotlight effect - pointer-events:none allows scroll passthrough */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle 450px at 220px 50%, 
              transparent 0%, 
              transparent 92%,
              ${accentRgb}40 93%,
              ${accentRgb}60 94%,
              ${accentRgb}40 95%,
              rgba(0, 0, 0, 0.7) 100%
            )
          `
        }}
      />
      
      {/* Panel */}
      <motion.div 
        initial={{ opacity: 0, x: -20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-1/2 -translate-y-1/2 left-6 z-50 select-none pointer-events-auto"
      >
        <div 
          className="rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl w-[380px] max-h-[80vh] flex flex-col"
          style={{
            background: `linear-gradient(180deg, hsla(${accentHue}, 12%, 13%, 0.97) 0%, hsla(${accentHue}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentRgb}20, 0 0 60px -15px ${accentRgb}30`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <div 
              className="w-5 h-5 rounded"
              style={{ 
                backgroundColor: accentRgb,
                boxShadow: `0 0 12px -2px ${accentRgb}60`,
              }}
            />
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-white">Blob Separator</h3>
              <p className="text-[11px] text-gray-500">{structureName} · {blobList.length} blobs detected</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={onClose} 
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-red-500/20 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-gray-900/95 border-gray-700 text-xs">Close</TooltipContent>
            </Tooltip>
          </div>

          {/* View Options Row */}
          <div 
            className="flex items-center justify-between px-4 py-2.5 border-b border-white/5"
            style={{ background: `hsla(${accentHue}, 6%, 10%, 0.5)` }}
          >
            <span className="text-[12px] text-gray-400 font-medium">View Options</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={hideOtherContours}
                onCheckedChange={handleToggleOtherContours}
                className="scale-90 data-[state=checked]:bg-violet-500"
              />
              <span className="text-[12px] text-gray-400 font-medium flex items-center gap-1.5">
                {hideOtherContours ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Others Hidden
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Show All
                  </>
                )}
              </span>
            </label>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
            <span className="text-[12px] text-gray-500">Select:</span>
            <button
              onClick={handleSelectSmallBlobs}
              className="h-6 px-2.5 rounded text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
            >
              Small Blobs
            </button>
            <button
              onClick={handleSelectAll}
              className="h-6 px-2.5 rounded text-[11px] font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-all flex items-center gap-1"
            >
              <CheckSquare className="w-3 h-3" />
              All
            </button>
            <button
              onClick={handleSelectNone}
              className="h-6 px-2.5 rounded text-[11px] font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-all flex items-center gap-1"
            >
              <Square className="w-3 h-3" />
              None
            </button>
          </div>

          {/* Blob List */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {sortedBlobs.map((blob, index) => {
              const isSelected = selectedBlobIds.has(blob.id);
              const isLargest = index === 0;
              
              return (
                <div 
                  key={blob.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer",
                    isSelected 
                      ? "bg-white/10 ring-1 ring-inset" 
                      : "bg-white/5 hover:bg-white/8"
                  )}
                  style={isSelected ? { ringColor: `${accentRgb}40` } : {}}
                  onClick={() => handleToggleBlob(blob.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 rounded cursor-pointer accent-violet-500"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">
                        Blob {blob.id}
                      </span>
                      {isLargest && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          Largest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span className="font-mono">{blob.volumeCc.toFixed(2)} cc</span>
                      <span>·</span>
                      <span>{blob.contours.length} slices</span>
                    </div>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLocalize(blob.id, blob.contours);
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                      >
                        <Target className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                      Navigate to blob
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSingleBlob(blob.id);
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-900/95 border-gray-700 text-xs">
                      Delete blob
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
            
            {blobList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-[13px] text-gray-500">No blobs detected</p>
                <p className="text-[11px] text-gray-600">The contour appears to be a single connected volume</p>
              </div>
            )}
          </div>

          {/* Selection Summary */}
          {selectedBlobIds.size > 0 && (
            <div 
              className="px-4 py-2 border-t border-white/5"
              style={{ background: `${accentRgb}10` }}
            >
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-400">
                  <span className="font-semibold text-white">{selectedBlobIds.size}</span> blob{selectedBlobIds.size !== 1 ? 's' : ''} selected
                </span>
                <span className="font-mono" style={{ color: accentRgb }}>
                  {totalSelectedVolume.toFixed(2)} cc
                </span>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div 
            className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10"
            style={{ background: `hsla(${accentHue}, 6%, 8%, 1)` }}
          >
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedBlobIds.size === 0}
              className={cn(
                "h-8 px-4 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-2",
                selectedBlobIds.size > 0
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedBlobIds.size})
            </button>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
