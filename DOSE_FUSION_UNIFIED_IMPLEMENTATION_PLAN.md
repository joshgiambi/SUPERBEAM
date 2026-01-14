# Unified Dose & Fusion Implementation Plan

## Merged from: DOSE_MODULE_UPDATE_PLAN.md + DOSE_AND_FUSION_GAP_ANALYSIS.md

This document consolidates both planning documents into a single unified implementation roadmap with clear phases, priorities, and technical specifications.

---

## Current State Summary

### ✅ Already Implemented - Dose
- Color wash overlay (rainbow, hot, jet, cool, dosimetry, grayscale colormaps)
- Isodose line extraction via marching squares
- Global opacity control
- Prescription dose normalization
- Basic statistics (min, max, mean, D95, D50 - global only)
- Dose metadata API endpoints
- Frame-by-frame dose data loading

### ✅ Already Implemented - Fusion
- Basic overlay blend with opacity slider
- Rigid registration via REG file transformation matrices
- Frame of Reference matching & series grouping
- Registration selection (multiple REG support)
- Manual translate tool (X/Y/Z adjustment)
- PET/MR colormaps (SUV colormaps for PET)

### 🟡 Prototype Only (Not Integrated)
- Checkerboard, swipe, flicker, spyglass fusion modes (in fusion-editor-popup-prototype.tsx)

---

## PART 1: DOSE TOOLS IMPLEMENTATION

### Phase 1: Core Display Enhancements (Week 1)

#### 1.1 Dose Unit Toggle (Gy ↔ cGy) 
**Priority:** 🔴 High | **Effort:** 2-4 hours

```typescript
// client/src/lib/rt-dose-manager.ts - Add to RTDoseConfig
interface RTDoseConfig {
  // ... existing
  doseUnit: 'Gy' | 'cGy';  // NEW
}

// Update formatDose utility
export function formatDose(
  dose: number,
  unit: 'Gy' | 'cGy' = 'Gy',
  prescription?: number,
  usePercentage: boolean = false
): string {
  const displayDose = unit === 'cGy' ? dose * 100 : dose;
  if (usePercentage && prescription && prescription > 0) {
    const percent = (dose / prescription) * 100;
    return `${percent.toFixed(1)}%`;
  }
  return `${displayDose.toFixed(unit === 'cGy' ? 1 : 2)} ${unit}`;
}
```

**Files to modify:**
- `client/src/lib/rt-dose-manager.ts`
- `client/src/components/dicom/dose-control-panel.tsx`

---

#### 1.2 Display Mode Selection (4 Modes)
**Priority:** 🔴 High | **Effort:** 4-6 hours

```typescript
type DoseDisplayMode = 
  | 'lines_only'          // Isodose lines only
  | 'colorwash_only'      // Color wash only  
  | 'lines_and_colorwash' // Both (default)
  | 'banded_with_lines';  // Banded color wash + lines

interface RTDoseConfig {
  displayMode: DoseDisplayMode;  // Replaces showIsodose boolean
}
```

**UI Component:**
```tsx
<ToggleGroup type="single" value={displayMode} onValueChange={setDisplayMode}>
  <ToggleGroupItem value="lines_only" title="Isodose Lines Only">
    <LineChartIcon />
  </ToggleGroupItem>
  <ToggleGroupItem value="colorwash_only" title="Color Wash Only">
    <PaintBucketIcon />
  </ToggleGroupItem>
  <ToggleGroupItem value="lines_and_colorwash" title="Both">
    <LayersIcon />
  </ToggleGroupItem>
  <ToggleGroupItem value="banded_with_lines" title="Banded">
    <SquareStackIcon />
  </ToggleGroupItem>
</ToggleGroup>
```

---

#### 1.3 Banded Color Wash Mode
**Priority:** 🔴 High | **Effort:** 3-4 hours

```typescript
// In createDoseOverlayCanvas
private createDoseOverlayCanvas(doseSlice: RTDoseSlice, ...): HTMLCanvasElement {
  for (let i = 0; i < doseSlice.doseData.length; i++) {
    const dose = doseSlice.doseData[i];
    let normalized = (dose - minThreshold) / range;
    
    // Snap to discrete bands if banded mode
    if (this.config.displayMode === 'banded_with_lines') {
      normalized = this.snapToBand(normalized, this.config.isodoseLevels);
    }
    
    const [r, g, b, a] = applyDoseColormap(normalized, this.config.colormap);
    // ... render
  }
}

private snapToBand(normalized: number, levels: number[]): number {
  // Find which isodose band this falls into
  const percentOfRx = normalized * 100;
  for (let i = 0; i < levels.length - 1; i++) {
    if (percentOfRx >= levels[i + 1] && percentOfRx < levels[i]) {
      return levels[i] / 100;
    }
  }
  return normalized;
}
```

---

#### 1.4 Values on Isodose Lines
**Priority:** 🟡 Medium | **Effort:** 3-4 hours

```typescript
interface RTDoseConfig {
  showValuesOnLines: boolean;
  valueDisplayFormat: 'percentage' | 'absolute' | 'both';
}

// In isodose rendering - rt-dose-overlay.tsx
function drawIsodoseWithLabels(ctx: CanvasRenderingContext2D, line: IsodoseLine) {
  // Draw contour path
  ctx.strokeStyle = `rgb(${line.color.join(',')})`;
  ctx.stroke(path);
  
  // Add label at strategic points (avoid overlaps)
  if (config.showValuesOnLines && line.contours[0]?.length > 10) {
    const labelPoints = selectLabelPositions(line.contours[0], 2); // 2 labels per contour
    for (const pt of labelPoints) {
      const label = config.valueDisplayFormat === 'percentage' 
        ? `${line.percentage}%` 
        : formatDose(line.level, config.doseUnit);
      
      // Draw with background for readability
      ctx.font = 'bold 10px sans-serif';
      const metrics = ctx.measureText(label);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(pt.x - 2, pt.y - 10, metrics.width + 4, 14);
      ctx.fillStyle = `rgb(${line.color.join(',')})`;
      ctx.fillText(label, pt.x, pt.y);
    }
  }
}
```

---

### Phase 2: DVH Implementation (Week 2-3) ⭐ CRITICAL

#### 2.1 DVH Backend API
**Priority:** 🔴 Critical | **Effort:** 2-3 days

**Create new file: `server/dvh-api.ts`**

```typescript
import { Router } from 'express';
import { RTStructureParser } from './rt-structure-parser';
import { storage } from './storage';
import * as fs from 'fs';
import dicomParser from 'dicom-parser';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface DVHPoint {
  dose: number;           // Gy
  dosePercent: number;    // % of Rx
  volumePercent: number;  // % of structure volume
}

interface DVHResult {
  structureId: number;
  structureName: string;
  color: [number, number, number];
  volumeCc: number;
  totalVoxels: number;
  
  // Cumulative DVH points
  cumulativeDVH: DVHPoint[];
  
  // Key statistics
  statistics: {
    Dmin: number;
    Dmax: number;
    Dmean: number;
    D98: number;    // Dose covering 98% of volume
    D95: number;    // Dose covering 95% of volume
    D50: number;    // Median dose
    D2: number;     // Near-max (dose to 2% of volume)
    V100?: number;  // Volume receiving 100% Rx
    V95?: number;   // Volume receiving 95% Rx
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Rasterize a structure contour to a 2D mask at a specific slice
 */
function rasterizeContourToMask(
  contourPoints: number[],  // [x1,y1,z1, x2,y2,z2, ...]
  gridOrigin: [number, number],
  gridSpacing: [number, number],
  gridSize: [number, number]  // [cols, rows]
): Uint8Array {
  const mask = new Uint8Array(gridSize[0] * gridSize[1]);
  const numPoints = contourPoints.length / 3;
  
  if (numPoints < 3) return mask;
  
  // Convert contour points to pixel coordinates
  const pixelPoints: [number, number][] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = contourPoints[i * 3];
    const y = contourPoints[i * 3 + 1];
    const px = (x - gridOrigin[0]) / gridSpacing[0];
    const py = (y - gridOrigin[1]) / gridSpacing[1];
    pixelPoints.push([px, py]);
  }
  
  // Scanline fill algorithm
  const [cols, rows] = gridSize;
  for (let row = 0; row < rows; row++) {
    const intersections: number[] = [];
    
    for (let i = 0; i < pixelPoints.length; i++) {
      const p1 = pixelPoints[i];
      const p2 = pixelPoints[(i + 1) % pixelPoints.length];
      
      // Check if edge crosses this scanline
      if ((p1[1] <= row && p2[1] > row) || (p2[1] <= row && p1[1] > row)) {
        const t = (row - p1[1]) / (p2[1] - p1[1]);
        const xIntersect = p1[0] + t * (p2[0] - p1[0]);
        intersections.push(xIntersect);
      }
    }
    
    // Sort intersections and fill between pairs
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(0, Math.ceil(intersections[i]));
      const xEnd = Math.min(cols - 1, Math.floor(intersections[i + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        mask[row * cols + x] = 1;
      }
    }
  }
  
  return mask;
}

/**
 * Calculate DVH for a structure
 */
function calculateStructureDVH(
  doseValues: number[],
  binWidth: number = 0.1,
  prescriptionDose?: number
): { cumulative: DVHPoint[], statistics: DVHResult['statistics'] } {
  if (doseValues.length === 0) {
    return {
      cumulative: [],
      statistics: { Dmin: 0, Dmax: 0, Dmean: 0, D98: 0, D95: 0, D50: 0, D2: 0 }
    };
  }
  
  // Sort descending for percentile calculations
  const sorted = [...doseValues].sort((a, b) => b - a);
  const n = sorted.length;
  
  // Calculate statistics
  const Dmax = sorted[0];
  const Dmin = sorted[n - 1];
  const Dmean = doseValues.reduce((a, b) => a + b, 0) / n;
  const D2 = sorted[Math.floor(n * 0.02)] || Dmax;
  const D50 = sorted[Math.floor(n * 0.50)] || Dmean;
  const D95 = sorted[Math.floor(n * 0.95)] || Dmin;
  const D98 = sorted[Math.floor(n * 0.98)] || Dmin;
  
  // Build cumulative DVH
  const numBins = Math.ceil(Dmax / binWidth) + 1;
  const cumulative: DVHPoint[] = [];
  
  for (let bin = 0; bin < numBins; bin++) {
    const dose = bin * binWidth;
    const countAbove = sorted.filter(d => d >= dose).length;
    const volumePercent = (countAbove / n) * 100;
    
    cumulative.push({
      dose,
      dosePercent: prescriptionDose ? (dose / prescriptionDose) * 100 : 0,
      volumePercent
    });
  }
  
  // Calculate Vx metrics if prescription provided
  let V100: number | undefined;
  let V95: number | undefined;
  if (prescriptionDose) {
    V100 = (sorted.filter(d => d >= prescriptionDose).length / n) * 100;
    V95 = (sorted.filter(d => d >= prescriptionDose * 0.95).length / n) * 100;
  }
  
  return {
    cumulative,
    statistics: { Dmin, Dmax, Dmean, D98, D95, D50, D2, V100, V95 }
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/dvh/calculate
 * Calculate DVH for selected structures
 */
router.post('/calculate', async (req, res, next) => {
  try {
    const {
      doseSeriesId,
      rtStructSeriesId,
      structureIds,        // Optional: specific structures, or all if omitted
      prescriptionDose,
      binWidth = 0.1
    } = req.body;
    
    if (!doseSeriesId || !rtStructSeriesId) {
      return res.status(400).json({ error: 'doseSeriesId and rtStructSeriesId required' });
    }
    
    // 1. Load RT Structure data
    const rtStructSeries = await storage.getSeries(rtStructSeriesId);
    if (!rtStructSeries || rtStructSeries.modality !== 'RTSTRUCT') {
      return res.status(404).json({ error: 'RT Structure series not found' });
    }
    
    const rtStructImages = await storage.getImagesBySeriesId(rtStructSeriesId);
    if (!rtStructImages?.length) {
      return res.status(404).json({ error: 'RT Structure file not found' });
    }
    
    const rtStructSet = RTStructureParser.parseRTStructureSet(rtStructImages[0].filePath);
    
    // 2. Load dose metadata and data
    const doseSeries = await storage.getSeries(doseSeriesId);
    if (!doseSeries || doseSeries.modality !== 'RTDOSE') {
      return res.status(404).json({ error: 'RT Dose series not found' });
    }
    
    const doseImages = await storage.getImagesBySeriesId(doseSeriesId);
    if (!doseImages?.length) {
      return res.status(404).json({ error: 'RT Dose file not found' });
    }
    
    // Parse dose DICOM
    const doseBuffer = fs.readFileSync(doseImages[0].filePath);
    const doseByteArray = new Uint8Array(doseBuffer);
    const doseDataSet = dicomParser.parseDicom(doseByteArray);
    
    // Extract dose grid parameters
    const rows = doseDataSet.uint16('x00280010') || 0;
    const columns = doseDataSet.uint16('x00280011') || 0;
    const numberOfFrames = parseInt(doseDataSet.string('x00280008') || '1', 10);
    const doseGridScaling = parseFloat(doseDataSet.string('x3004000e') || '1');
    const pixelSpacing = (doseDataSet.string('x00280030') || '1\\1').split('\\').map(Number);
    const imagePosition = (doseDataSet.string('x00200032') || '0\\0\\0').split('\\').map(Number);
    const gridFrameOffsets = (doseDataSet.string('x3004000c') || '0').split('\\').map(Number);
    
    // Get pixel data
    const pixelElement = doseDataSet.elements['x7fe00010'];
    if (!pixelElement) {
      return res.status(500).json({ error: 'Dose pixel data not found' });
    }
    
    const bitsAllocated = doseDataSet.uint16('x00280100') || 16;
    const { dataOffset, length } = pixelElement;
    
    // 3. Filter structures to process
    let structuresToProcess = rtStructSet.structures;
    if (structureIds && structureIds.length > 0) {
      structuresToProcess = structuresToProcess.filter(s => structureIds.includes(s.roiNumber));
    }
    
    // 4. Calculate DVH for each structure
    const results: DVHResult[] = [];
    
    for (const structure of structuresToProcess) {
      const doseValues: number[] = [];
      let totalMaskVoxels = 0;
      
      // Process each frame (slice)
      for (let frame = 0; frame < numberOfFrames; frame++) {
        const sliceZ = imagePosition[2] + (gridFrameOffsets[frame] || 0);
        
        // Find contours for this slice
        const sliceContours = structure.contours.filter(c => 
          Math.abs(c.slicePosition - sliceZ) < 1.5  // 1.5mm tolerance
        );
        
        if (sliceContours.length === 0) continue;
        
        // Create combined mask for this slice
        const sliceMask = new Uint8Array(rows * columns);
        
        for (const contour of sliceContours) {
          const contourMask = rasterizeContourToMask(
            contour.points,
            [imagePosition[0], imagePosition[1]],
            [pixelSpacing[0], pixelSpacing[1]],
            [columns, rows]
          );
          
          // OR the masks together (for multiple contours on same slice)
          for (let i = 0; i < sliceMask.length; i++) {
            sliceMask[i] = sliceMask[i] || contourMask[i];
          }
        }
        
        // Sample dose values within mask
        const frameOffset = dataOffset + (frame * rows * columns * (bitsAllocated / 8));
        
        for (let i = 0; i < rows * columns; i++) {
          if (sliceMask[i]) {
            totalMaskVoxels++;
            
            let rawValue: number;
            if (bitsAllocated === 32) {
              const byteOffset = frameOffset + i * 4;
              rawValue = new DataView(doseByteArray.buffer, doseByteArray.byteOffset + byteOffset, 4).getUint32(0, true);
            } else {
              const byteOffset = frameOffset + i * 2;
              rawValue = new DataView(doseByteArray.buffer, doseByteArray.byteOffset + byteOffset, 2).getUint16(0, true);
            }
            
            const doseGy = rawValue * doseGridScaling;
            doseValues.push(doseGy);
          }
        }
      }
      
      if (doseValues.length === 0) continue;
      
      // Calculate DVH
      const { cumulative, statistics } = calculateStructureDVH(
        doseValues,
        binWidth,
        prescriptionDose
      );
      
      // Calculate volume in cc
      const voxelVolumeCc = pixelSpacing[0] * pixelSpacing[1] * 
        (gridFrameOffsets.length > 1 ? Math.abs(gridFrameOffsets[1] - gridFrameOffsets[0]) : 3) / 1000;
      const volumeCc = totalMaskVoxels * voxelVolumeCc;
      
      results.push({
        structureId: structure.roiNumber,
        structureName: structure.structureName,
        color: structure.color,
        volumeCc,
        totalVoxels: totalMaskVoxels,
        cumulativeDVH: cumulative,
        statistics
      });
    }
    
    res.json({
      doseSeriesId,
      rtStructSeriesId,
      prescriptionDose,
      binWidth,
      structures: results
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dvh/:doseSeriesId/statistics/:structureId
 * Get dose statistics for a specific structure
 */
router.get('/:doseSeriesId/statistics/:structureId', async (req, res, next) => {
  try {
    const { doseSeriesId, structureId } = req.params;
    const { rtStructSeriesId, prescriptionDose } = req.query;
    
    // Delegate to POST endpoint with single structure
    req.body = {
      doseSeriesId: parseInt(doseSeriesId),
      rtStructSeriesId: parseInt(rtStructSeriesId as string),
      structureIds: [parseInt(structureId)],
      prescriptionDose: prescriptionDose ? parseFloat(prescriptionDose as string) : undefined
    };
    
    // This is a simplified pass-through - in production, factor out the logic
    return res.status(501).json({ error: 'Use POST /api/dvh/calculate instead' });
    
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

#### 2.2 DVH Viewer Component
**Priority:** 🔴 Critical | **Effort:** 2-3 days

**Create new file: `client/src/components/dicom/dvh-viewer.tsx`**

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DVHPoint {
  dose: number;
  dosePercent: number;
  volumePercent: number;
}

interface DVHStructure {
  structureId: number;
  structureName: string;
  color: [number, number, number];
  volumeCc: number;
  cumulativeDVH: DVHPoint[];
  statistics: {
    Dmin: number;
    Dmax: number;
    Dmean: number;
    D98: number;
    D95: number;
    D50: number;
    D2: number;
    V100?: number;
    V95?: number;
  };
}

interface DVHViewerProps {
  doseSeriesId: number;
  rtStructSeriesId: number;
  structures: Array<{
    roiNumber: number;
    structureName: string;
    color: [number, number, number];
  }>;
  prescriptionDose?: number;
  onClose?: () => void;
}

export function DVHViewer({
  doseSeriesId,
  rtStructSeriesId,
  structures,
  prescriptionDose = 60,
  onClose
}: DVHViewerProps) {
  const [dvhData, setDvhData] = useState<DVHStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<number[]>([]);
  const [xAxisMode, setXAxisMode] = useState<'absolute' | 'percent'>('absolute');
  const [showGrid, setShowGrid] = useState(true);
  
  // Load DVH data
  useEffect(() => {
    const loadDVH = async () => {
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
            binWidth: 0.1
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to calculate DVH');
        }
        
        const data = await response.json();
        setDvhData(data.structures);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadDVH();
  }, [doseSeriesId, rtStructSeriesId, selectedStructures, prescriptionDose]);
  
  // Prepare chart data
  const chartData = useMemo(() => {
    if (dvhData.length === 0) return [];
    
    // Find max dose across all structures
    const maxDose = Math.max(...dvhData.map(d => d.statistics.Dmax));
    const numPoints = Math.ceil(maxDose / 0.1) + 1;
    
    const data: any[] = [];
    for (let i = 0; i < numPoints; i++) {
      const dose = i * 0.1;
      const point: any = {
        dose,
        dosePercent: prescriptionDose ? (dose / prescriptionDose) * 100 : 0
      };
      
      for (const struct of dvhData) {
        const dvhPoint = struct.cumulativeDVH.find(p => Math.abs(p.dose - dose) < 0.05);
        point[`vol_${struct.structureId}`] = dvhPoint?.volumePercent ?? 0;
      }
      
      data.push(point);
    }
    
    return data;
  }, [dvhData, prescriptionDose]);
  
  // Toggle structure selection
  const toggleStructure = (structureId: number) => {
    setSelectedStructures(prev => 
      prev.includes(structureId)
        ? prev.filter(id => id !== structureId)
        : [...prev, structureId]
    );
  };
  
  // Export DVH as CSV
  const exportCSV = () => {
    if (dvhData.length === 0) return;
    
    const headers = ['Dose (Gy)', 'Dose (%Rx)', ...dvhData.map(d => `${d.structureName} Vol(%)`)];
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
  
  return (
    <Card className="w-full max-w-4xl bg-gray-900 border-gray-700">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-white">
          Dose Volume Histogram
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={dvhData.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Structure Selection */}
        <div className="flex flex-wrap gap-2 p-2 bg-gray-800 rounded-lg">
          {structures.map(struct => (
            <label
              key={struct.roiNumber}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors",
                selectedStructures.includes(struct.roiNumber)
                  ? "bg-gray-700"
                  : "hover:bg-gray-700/50"
              )}
            >
              <Checkbox
                checked={selectedStructures.includes(struct.roiNumber)}
                onCheckedChange={() => toggleStructure(struct.roiNumber)}
              />
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: `rgb(${struct.color.join(',')})` }}
              />
              <span className="text-sm text-gray-200">{struct.structureName}</span>
            </label>
          ))}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-4">
          <Select value={xAxisMode} onValueChange={(v: 'absolute' | 'percent') => setXAxisMode(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absolute">Dose (Gy)</SelectItem>
              <SelectItem value="percent">Dose (% Rx)</SelectItem>
            </SelectContent>
          </Select>
          
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <Checkbox checked={showGrid} onCheckedChange={(c) => setShowGrid(!!c)} />
            Show Grid
          </label>
        </div>
        
        {/* DVH Chart */}
        <div className="h-80 w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400">
              {error}
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#444" />}
                <XAxis
                  dataKey={xAxisMode === 'percent' ? 'dosePercent' : 'dose'}
                  stroke="#888"
                  label={{
                    value: xAxisMode === 'percent' ? 'Dose (% Rx)' : 'Dose (Gy)',
                    position: 'bottom',
                    fill: '#888'
                  }}
                />
                <YAxis
                  stroke="#888"
                  domain={[0, 100]}
                  label={{ value: 'Volume (%)', angle: -90, position: 'insideLeft', fill: '#888' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Legend />
                
                {/* Reference lines */}
                {prescriptionDose && xAxisMode === 'absolute' && (
                  <ReferenceLine x={prescriptionDose} stroke="#ffaa00" strokeDasharray="5 5" />
                )}
                {xAxisMode === 'percent' && (
                  <ReferenceLine x={100} stroke="#ffaa00" strokeDasharray="5 5" />
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
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select structures to calculate DVH
            </div>
          )}
        </div>
        
        {/* Statistics Table */}
        {dvhData.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-gray-300">Structure</TableHead>
                  <TableHead className="text-gray-300">Volume (cc)</TableHead>
                  <TableHead className="text-gray-300">Dmin</TableHead>
                  <TableHead className="text-gray-300">Dmax</TableHead>
                  <TableHead className="text-gray-300">Dmean</TableHead>
                  <TableHead className="text-gray-300">D95</TableHead>
                  <TableHead className="text-gray-300">D50</TableHead>
                  <TableHead className="text-gray-300">D2</TableHead>
                  {prescriptionDose && (
                    <>
                      <TableHead className="text-gray-300">V100</TableHead>
                      <TableHead className="text-gray-300">V95</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dvhData.map(struct => (
                  <TableRow key={struct.structureId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: `rgb(${struct.color.join(',')})` }}
                        />
                        {struct.structureName}
                      </div>
                    </TableCell>
                    <TableCell>{struct.volumeCc.toFixed(1)}</TableCell>
                    <TableCell>{struct.statistics.Dmin.toFixed(2)} Gy</TableCell>
                    <TableCell>{struct.statistics.Dmax.toFixed(2)} Gy</TableCell>
                    <TableCell>{struct.statistics.Dmean.toFixed(2)} Gy</TableCell>
                    <TableCell>{struct.statistics.D95.toFixed(2)} Gy</TableCell>
                    <TableCell>{struct.statistics.D50.toFixed(2)} Gy</TableCell>
                    <TableCell>{struct.statistics.D2.toFixed(2)} Gy</TableCell>
                    {prescriptionDose && (
                      <>
                        <TableCell>{struct.statistics.V100?.toFixed(1) ?? '-'}%</TableCell>
                        <TableCell>{struct.statistics.V95?.toFixed(1) ?? '-'}%</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Phase 3: Isodose Management (Week 3)

#### 3.1 Saveable Isodose Presets
**Priority:** 🔴 High | **Effort:** 1-2 days

**Database Schema (add to migrations):**
```sql
CREATE TABLE isodose_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_brachy_default BOOLEAN DEFAULT FALSE,
  levels_json TEXT NOT NULL,
  user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default presets
INSERT INTO isodose_presets (id, name, is_default, levels_json) VALUES
('eclipse-standard', 'Eclipse Standard', TRUE, '[
  {"percentage":107,"color":[255,0,128],"lineWidth":2,"visible":true},
  {"percentage":105,"color":[255,0,0],"lineWidth":2,"visible":true},
  {"percentage":100,"color":[255,128,0],"lineWidth":2,"visible":true},
  {"percentage":95,"color":[255,255,0],"lineWidth":2,"visible":true},
  {"percentage":90,"color":[0,255,0],"lineWidth":2,"visible":true},
  {"percentage":80,"color":[0,255,255],"lineWidth":2,"visible":true},
  {"percentage":70,"color":[0,128,255],"lineWidth":2,"visible":true},
  {"percentage":50,"color":[0,0,255],"lineWidth":2,"visible":true},
  {"percentage":30,"color":[128,0,255],"lineWidth":1,"visible":true}
]');
```

---

### Phase 4: Advanced Dose Tools (Week 4)

#### 4.1 Dose Constraints System
**Priority:** 🟡 Medium | **Effort:** 2-3 days

#### 4.2 BED Calculation
**Priority:** 🟡 Medium | **Effort:** 1-2 days

#### 4.3 Localize to Max Dose
**Priority:** 🟡 Medium | **Effort:** 4-6 hours

#### 4.4 Clip Dose to Structure
**Priority:** 🟡 Medium | **Effort:** 4-6 hours

#### 4.5 Create Contours from Isodose
**Priority:** 🟡 Medium | **Effort:** 1 day

---

## PART 2: FUSION TOOLS IMPLEMENTATION

### Phase 5: Fusion Visualization Modes (Week 5)

#### 5.1 Integrate Prototype Fusion Modes
**Priority:** 🔴 High | **Effort:** 3-4 days

Move evaluation modes from `fusion-editor-popup-prototype.tsx` to working viewer.

**Modes to implement:**
- Checkerboard (adjustable grid size)
- Swipe/Curtain (horizontal/vertical)
- Spyglass (circular lens)
- Flicker (auto-toggle with adjustable Hz)
- Difference (subtraction view)
- Edge overlay

---

### Phase 6: Deformable Registration (Week 6-8)

#### 6.1 Backend DIR Integration
**Priority:** 🔴 High | **Effort:** 2 weeks

Options:
1. SimpleElastix via Python microservice
2. ITK-WASM for browser-based DIR
3. ANTsPy for advanced algorithms

#### 6.2 Reg Reveal Tool
**Priority:** 🔴 High | **Effort:** 1 week

#### 6.3 Reg Refine Tool
**Priority:** 🔴 High | **Effort:** 1 week

---

## Implementation Checklist

### Week 1: Core Dose Enhancements
- [ ] Dose unit toggle (Gy/cGy)
- [ ] Display mode selection (4 modes)
- [ ] Banded color wash
- [ ] Values on isodose lines

### Week 2-3: DVH Implementation
- [ ] DVH backend API (`server/dvh-api.ts`)
- [ ] Structure mask rasterization
- [ ] DVH calculation algorithm
- [ ] DVH viewer component
- [ ] Statistics table
- [ ] CSV export

### Week 3: Isodose Management
- [ ] Database schema for presets
- [ ] Preset CRUD API endpoints
- [ ] Preset manager UI component
- [ ] Default preset templates

### Week 4: Advanced Dose Tools
- [ ] Dose constraints data model
- [ ] Constraint evaluation logic
- [ ] BED calculation
- [ ] Localize to max dose
- [ ] Clip dose to structure

### Week 5: Fusion Modes
- [ ] Integrate checkerboard mode
- [ ] Integrate swipe mode
- [ ] Integrate spyglass mode
- [ ] Integrate flicker mode
- [ ] Add keyboard shortcuts

### Week 6-8: Deformable Registration
- [ ] Research DIR backend options
- [ ] Implement DIR microservice
- [ ] DVF handling and storage
- [ ] Reg Reveal component
- [ ] Reg Refine component
- [ ] Contour propagation

---

## File Structure Summary

```
client/src/
├── components/dicom/
│   ├── dvh-viewer.tsx              # NEW: DVH chart and statistics
│   ├── isodose-preset-manager.tsx  # NEW: Preset management
│   ├── dose-constraint-panel.tsx   # NEW: Constraint evaluation
│   ├── bed-calculator.tsx          # NEW: BED/EQD2 calculator
│   └── dose-control-panel.tsx      # UPDATE: Add new controls
├── lib/
│   ├── rt-dose-manager.ts          # UPDATE: Add display modes
│   └── dvh-types.ts                # NEW: DVH type definitions

server/
├── dvh-api.ts                      # NEW: DVH calculation endpoints
├── rt-dose-api.ts                  # UPDATE: Add new endpoints
└── routes.ts                       # UPDATE: Register new routes
```

---

*Document merged: January 14, 2026*
*Sources: DOSE_MODULE_UPDATE_PLAN.md, DOSE_AND_FUSION_GAP_ANALYSIS.md, MIM Maestro 7.4 Documentation*

