# RT Dose Module Update Plan

## MIM Software Feature Analysis & Implementation Roadmap

Based on detailed review of [MIM Software's Dose Viewing Fundamentals](https://www.mimsoftware.com/portal/training/radiation_oncology/kb/dose/td662-view-dose-fundamentals) documentation.

---

## Executive Summary

Our current RT Dose module provides basic dose visualization with color wash and isodose lines. After reviewing MIM Software's clinical dose viewing standards, we've identified **15 key features** to implement that will bring our viewer to clinical-grade quality.

### Current State ✅
- Basic color wash overlay (rainbow, hot, jet, cool, dosimetry, grayscale)
- Isodose line extraction via marching squares
- Opacity control
- Prescription dose normalization
- Basic dose statistics (min, max, mean, D95, D50)

### Gap Analysis Summary

| Feature | MIM Has | We Have | Priority |
|---------|---------|---------|----------|
| Dose Unit Toggle (Gy/cGy) | ✅ | ❌ | High |
| Saveable Isodose Presets | ✅ | ❌ | High |
| Banded Color Wash | ✅ | ❌ | High |
| Display Mode Selection | ✅ | Partial | Medium |
| Values on Isodose Lines | ✅ | ❌ | Medium |
| Isodose Key in Viewport | ✅ | Partial | Medium |
| Normalization Source Display | ✅ | ❌ | Medium |
| DVH Viewer | ✅ | ❌ | **Critical** |
| Dose Constraints | ✅ | ❌ | High |
| Create Contours from Isodose | ✅ | ❌ | High |
| BED Calculation | ✅ | ❌ | Medium |
| Localize to Max Dose | ✅ | ❌ | Medium |
| Scale Dose | ✅ | ❌ | Low |
| Clip Dose to Contour | ✅ | ❌ | Medium |
| Individual Isodose Settings | ✅ | ❌ | Low |

---

## Phase 1: Core Display Enhancements (Week 1-2)

### 1.1 Dose Unit Toggle (Gy/cGy)
**MIM Feature**: Users can display dose values in Gy or cGy throughout the interface.

**Implementation Plan**:
```typescript
// Add to RTDoseConfig
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

**Files to Modify**:
- `client/src/lib/rt-dose-manager.ts` - Add unit config
- `client/src/components/dicom/dose-control-panel.tsx` - Add toggle UI
- `client/src/components/dicom/rt-dose-overlay.tsx` - Update display

---

### 1.2 Banded Color Wash Mode
**MIM Feature**: Choose between interpolated (smooth) and banded (discrete) color wash.

**Implementation Plan**:
```typescript
// Add to RTDoseConfig
interface RTDoseConfig {
  // ... existing
  colorWashMode: 'interpolated' | 'banded';  // NEW
}

// Update createDoseOverlayCanvas to support banding
private createDoseOverlayCanvas(doseSlice: RTDoseSlice, ...): HTMLCanvasElement {
  // If banded mode, snap normalized value to isodose levels
  if (this.config.colorWashMode === 'banded') {
    const bandedNormalized = this.snapToBand(normalized);
    // Apply color for that band only
  }
}
```

---

### 1.3 Display Mode Selection
**MIM Feature**: Four distinct display modes:
1. Isodose lines only (no color wash)
2. Color wash only (no lines)
3. Isodose lines with color wash
4. Banded color wash with lines

**Implementation Plan**:
```typescript
type DoseDisplayMode = 
  | 'lines_only' 
  | 'colorwash_only' 
  | 'lines_and_colorwash' 
  | 'banded_with_lines';

interface RTDoseConfig {
  displayMode: DoseDisplayMode;  // Replaces showIsodose boolean
}
```

**UI Update**:
```tsx
// In DoseControlPanel
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

### 1.4 Values on Isodose Lines
**MIM Feature**: Display dose values directly on isodose lines in the viewport.

**Implementation Plan**:
```typescript
interface RTDoseConfig {
  showValuesOnLines: boolean;  // NEW
  valueDisplayFormat: 'percentage' | 'absolute' | 'both';  // NEW
}

// In isodose rendering
function drawIsodoseWithLabels(ctx: CanvasRenderingContext2D, line: IsodoseLine) {
  // Draw the contour path
  ctx.strokeStyle = `rgb(${line.color.join(',')})`;
  ctx.lineWidth = config.isodoseLineWidth;
  ctx.stroke(path);
  
  // Add label at midpoint
  if (config.showValuesOnLines) {
    const midpoint = getContourMidpoint(line.contours[0]);
    const label = config.valueDisplayFormat === 'percentage' 
      ? `${line.percentage}%` 
      : `${line.level.toFixed(1)} Gy`;
    ctx.fillStyle = 'white';
    ctx.font = '10px sans-serif';
    ctx.fillText(label, midpoint.x, midpoint.y);
  }
}
```

---

## Phase 2: Isodose Settings Management (Week 2-3)

### 2.1 Saveable Isodose Presets
**MIM Feature**: Create, save, edit, and manage isodose settings with named presets.

**Data Model**:
```typescript
interface IsodosePreset {
  id: string;
  name: string;
  isDefault: boolean;
  isBrachyDefault: boolean;
  levels: IsodoseLevel[];
  createdAt: Date;
  updatedAt: Date;
}

interface IsodoseLevel {
  percentage: number;       // e.g., 95
  absoluteValue?: number;   // e.g., 57 Gy (optional)
  color: [number, number, number];
  lineWidth: number;
  visible: boolean;
}

// Standard presets
const STANDARD_PRESETS: IsodosePreset[] = [
  {
    id: 'eclipse-standard',
    name: 'Eclipse Standard',
    isDefault: true,
    levels: [
      { percentage: 107, color: [255, 0, 128], lineWidth: 2, visible: true },
      { percentage: 105, color: [255, 0, 0], lineWidth: 2, visible: true },
      { percentage: 100, color: [255, 128, 0], lineWidth: 2, visible: true },
      { percentage: 95, color: [255, 255, 0], lineWidth: 2, visible: true },
      { percentage: 90, color: [0, 255, 0], lineWidth: 2, visible: true },
      { percentage: 80, color: [0, 255, 255], lineWidth: 2, visible: true },
      { percentage: 70, color: [0, 128, 255], lineWidth: 2, visible: true },
      { percentage: 50, color: [0, 0, 255], lineWidth: 2, visible: true },
      { percentage: 30, color: [128, 0, 255], lineWidth: 1, visible: true },
    ]
  },
  {
    id: 'high-dose-prostate',
    name: 'High Dose (Prostate)',
    levels: [
      { percentage: 115, color: [255, 255, 255], lineWidth: 2, visible: true },
      { percentage: 110, color: [255, 0, 128], lineWidth: 2, visible: true },
      { percentage: 105, color: [255, 0, 0], lineWidth: 2, visible: true },
      // ... etc
    ]
  }
];
```

**API Endpoints**:
```typescript
// server/rt-dose-api.ts
POST   /api/isodose-presets           // Create preset
GET    /api/isodose-presets           // List all presets
GET    /api/isodose-presets/:id       // Get specific preset
PUT    /api/isodose-presets/:id       // Update preset
DELETE /api/isodose-presets/:id       // Delete preset
PUT    /api/isodose-presets/:id/default  // Set as default
```

**UI Component**:
```tsx
// IsodosePresetManager component
function IsodosePresetManager({
  currentPreset,
  onPresetChange,
  onPresetSave
}) {
  return (
    <div className="isodose-preset-manager">
      {/* Preset dropdown */}
      <Select value={currentPreset.id} onValueChange={handlePresetChange}>
        {presets.map(p => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} {p.isDefault && '(Default)'}
          </SelectItem>
        ))}
      </Select>
      
      {/* Save/Overwrite buttons */}
      <Button onClick={handleSave}>Save</Button>
      <Button onClick={handleOverwrite}>Overwrite</Button>
      
      {/* Level editor */}
      <IsodoseLevelEditor levels={levels} onChange={setLevels} />
    </div>
  );
}
```

---

### 2.2 Normalization Source Display
**MIM Feature**: Show where normalization value comes from (prescription, max dose, user-entered).

**Implementation Plan**:
```typescript
type NormalizationSource = 
  | 'prescription'      // From RT Plan
  | 'max_dose'          // Max dose in grid
  | 'user_entered'      // Manually entered
  | 'point_dose';       // Dose at specific point

interface RTDoseConfig {
  normalizationValue: number;
  normalizationSource: NormalizationSource;
  normalizationPointLocation?: [number, number, number];  // For point_dose
}
```

**UI Display**:
```tsx
<div className="normalization-info">
  <span className="label">Normalization:</span>
  <span className="value">{formatDose(normalizationValue, unit)}</span>
  <Badge variant="outline">{normalizationSourceLabel[normalizationSource]}</Badge>
</div>
```

---

## Phase 3: DVH Implementation (Week 3-4) ⭐ CRITICAL

### 3.1 DVH (Dose Volume Histogram)
**MIM Feature**: Generate and view DVH for structures with dose data.

**Data Structures**:
```typescript
interface DVHData {
  structureName: string;
  structureId: number;
  color: [number, number, number];
  volumeCc: number;
  doseUnit: 'Gy' | 'cGy';
  
  // Cumulative DVH data points
  cumulativeDVH: {
    dose: number[];      // X-axis: dose values
    volume: number[];    // Y-axis: volume percentage (0-100)
  };
  
  // Differential DVH data points
  differentialDVH: {
    dose: number[];
    volume: number[];
  };
  
  // Key statistics
  statistics: {
    min: number;
    max: number;
    mean: number;
    d98: number;   // Dose covering 98% of volume
    d95: number;   // Dose covering 95% of volume
    d50: number;   // Median dose
    d2: number;    // Dose covering 2% (near-max)
    v100: number;  // Volume receiving 100% of prescription
    v95: number;   // Volume receiving 95% of prescription
  };
}
```

**Server API**:
```typescript
// server/rt-dose-api.ts

// Calculate DVH for specific structures
router.post('/:seriesId/dvh', async (req, res) => {
  const { seriesId } = req.params;
  const { structureIds, prescriptionDose, binWidth = 0.1 } = req.body;
  
  // 1. Load dose grid
  const doseData = await loadDoseData(seriesId);
  
  // 2. For each structure, compute DVH
  const results: DVHData[] = [];
  for (const structureId of structureIds) {
    // Load structure contours
    const contours = await loadStructureContours(structureId);
    
    // Create 3D mask from contours
    const mask = createStructureMask(contours, doseData.grid);
    
    // Calculate dose histogram
    const histogram = calculateDoseHistogram(doseData, mask, binWidth);
    
    // Convert to cumulative DVH
    const cumulativeDVH = convertToCumulative(histogram);
    
    // Calculate statistics
    const statistics = calculateDVHStatistics(cumulativeDVH, prescriptionDose);
    
    results.push({
      structureName: contours.structureName,
      structureId,
      color: contours.color,
      volumeCc: calculateVolume(mask, doseData.grid),
      cumulativeDVH,
      differentialDVH: histogram,
      statistics
    });
  }
  
  res.json(results);
});
```

**DVH Viewer Component**:
```tsx
function DVHViewer({
  doseSeriesId,
  rtStructures,
  prescriptionDose,
  onClose
}) {
  const [dvhData, setDvhData] = useState<DVHData[]>([]);
  const [selectedStructures, setSelectedStructures] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'cumulative' | 'differential'>('cumulative');
  const [xAxisUnit, setXAxisUnit] = useState<'Gy' | 'cGy' | 'percent'>('Gy');
  
  return (
    <div className="dvh-viewer">
      {/* Structure selection */}
      <StructureSelector
        structures={rtStructures}
        selected={selectedStructures}
        onSelectionChange={setSelectedStructures}
      />
      
      {/* DVH Chart (using recharts or similar) */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <XAxis 
            dataKey="dose" 
            label={{ value: xAxisLabel, position: 'bottom' }} 
          />
          <YAxis 
            label={{ value: 'Volume (%)', angle: -90 }} 
            domain={[0, 100]}
          />
          <CartesianGrid strokeDasharray="3 3" />
          {dvhData.map(d => (
            <Line
              key={d.structureId}
              data={d.cumulativeDVH}
              dataKey="volume"
              stroke={`rgb(${d.color.join(',')})`}
              name={d.structureName}
              dot={false}
            />
          ))}
          <Legend />
          <Tooltip />
        </LineChart>
      </ResponsiveContainer>
      
      {/* Statistics table */}
      <DVHStatisticsTable data={dvhData} prescriptionDose={prescriptionDose} />
    </div>
  );
}
```

---

## Phase 4: Advanced Dose Tools (Week 4-5)

### 4.1 Create Contours from Isodose Curves
**MIM Feature**: Convert isodose lines to RT Structure contours.

**Implementation**:
```typescript
// Convert isodose lines to structure contours
async function createContourFromIsodose(
  doseSeriesId: number,
  isodoseLevel: number,  // e.g., 95 for 95% isodose
  structureName: string,
  color: [number, number, number]
): Promise<Structure> {
  // 1. Get all isodose contours across slices
  const isodoseContours = await extractAllIsodoseContours(doseSeriesId, isodoseLevel);
  
  // 2. Convert to RT Structure format
  const contours = isodoseContours.map(iso => ({
    slicePosition: iso.slicePosition,
    points: iso.points,  // Already in patient coordinates
    numberOfPoints: iso.points.length / 3
  }));
  
  // 3. Create structure
  return {
    structureName,
    roiNumber: await getNextRoiNumber(),
    color,
    contours,
    referencedFrameOfReference: await getFrameOfReference()
  };
}
```

---

### 4.2 BED (Biological Effective Dose) Calculation
**MIM Feature**: Calculate BED and TCP (Tumor Control Probability).

**Implementation**:
```typescript
interface BEDParameters {
  alphaOverBeta: number;    // α/β ratio (e.g., 10 for tumor, 3 for late effects)
  numberOfFractions: number;
  dosePerFraction: number;
}

interface TCPParameters extends BEDParameters {
  alpha: number;            // Radiosensitivity parameter
  clonogenDensity: number;  // Tumor cells per cc
}

// Calculate BED = n * d * (1 + d/(α/β))
function calculateBED(dose: number, params: BEDParameters): number {
  const { alphaOverBeta, numberOfFractions } = params;
  const dosePerFraction = dose / numberOfFractions;
  return dose * (1 + dosePerFraction / alphaOverBeta);
}

// Calculate EQD2 (Equivalent dose in 2 Gy fractions)
function calculateEQD2(dose: number, params: BEDParameters): number {
  const bed = calculateBED(dose, params);
  return bed / (1 + 2 / params.alphaOverBeta);
}

// Server endpoint
router.post('/:seriesId/bed', async (req, res) => {
  const { seriesId } = req.params;
  const { alphaOverBeta, numberOfFractions, structureId } = req.body;
  
  // Calculate BED for each voxel in structure (or whole grid)
  const bedData = await calculateBEDGrid(seriesId, { alphaOverBeta, numberOfFractions });
  
  res.json({
    minBED: bedData.min,
    maxBED: bedData.max,
    meanBED: bedData.mean,
    bedGrid: bedData.values  // Optional: full grid for visualization
  });
});
```

---

### 4.3 Localize to Max Dose
**MIM Feature**: Jump viewport to maximum dose location.

**Implementation**:
```typescript
// Find max dose location
async function findMaxDoseLocation(
  doseSeriesId: number,
  structureId?: number  // Optional: limit to specific structure
): Promise<{
  position: [number, number, number];
  dose: number;
  frameIndex: number;
}> {
  const metadata = await getDoseMetadata(doseSeriesId);
  let maxDose = 0;
  let maxLocation: [number, number, number] = [0, 0, 0];
  let maxFrameIndex = 0;
  
  for (let frame = 0; frame < metadata.numberOfFrames; frame++) {
    const frameData = await loadDoseFrame(doseSeriesId, frame);
    const sliceZ = metadata.imagePositionPatient[2] + metadata.gridFrameOffsetVector[frame];
    
    for (let i = 0; i < frameData.length; i++) {
      if (frameData[i] > maxDose) {
        // Check if in structure (if specified)
        if (structureId) {
          const isInStructure = await isPointInStructure(
            pixelToPatient(i, frame, metadata),
            structureId
          );
          if (!isInStructure) continue;
        }
        
        maxDose = frameData[i];
        const [x, y] = indexToPixel(i, metadata);
        maxLocation = pixelToPatient([x, y, sliceZ], metadata);
        maxFrameIndex = frame;
      }
    }
  }
  
  return { position: maxLocation, dose: maxDose, frameIndex: maxFrameIndex };
}

// UI handler
function handleLocalizeToMaxDose() {
  const maxInfo = await findMaxDoseLocation(doseSeriesId, selectedStructureId);
  
  // Navigate viewport to this position
  setCurrentSliceIndex(maxInfo.frameIndex);
  setCrosshairPosition(maxInfo.position);
  
  // Show notification
  toast({
    title: 'Max Dose Located',
    description: `${formatDose(maxInfo.dose)} at (${maxInfo.position.map(p => p.toFixed(1)).join(', ')})`,
  });
}
```

---

### 4.4 Clip Dose Display to Contour
**MIM Feature**: Restrict dose display to within a specific structure.

**Implementation**:
```typescript
interface RTDoseConfig {
  // ... existing
  clipToStructure?: number;  // Structure ID to clip to, null for no clipping
}

// In dose overlay rendering
private createDoseOverlayCanvas(doseSlice: RTDoseSlice, ...): HTMLCanvasElement {
  // ... existing code ...
  
  // Apply structure clipping mask
  if (this.config.clipToStructure) {
    const structureMask = await this.getStructureMask(
      this.config.clipToStructure,
      doseSlice.slicePosition,
      doseSlice.width,
      doseSlice.height
    );
    
    for (let i = 0; i < doseSlice.doseData.length; i++) {
      if (!structureMask[i]) {
        // Outside structure - make transparent
        buffer[i * 4 + 3] = 0;
      }
    }
  }
  
  // ... rest of rendering ...
}
```

---

## Phase 5: Dose Constraints (Week 5-6)

### 5.1 Dose Constraints System
**MIM Feature**: Apply and review dose constraint sets.

**Data Model**:
```typescript
interface DoseConstraint {
  id: string;
  structureName: string;         // e.g., "Spinal Cord"
  constraintType: 'max' | 'mean' | 'volume' | 'dxx' | 'vxx';
  parameter?: number;            // For Dxx (e.g., 95 for D95) or Vxx
  threshold: number;             // The constraint value
  unit: 'Gy' | 'cGy' | '%';
  priority: 'required' | 'optimal' | 'informational';
}

interface DoseConstraintSet {
  id: string;
  name: string;                  // e.g., "QUANTEC Head & Neck"
  treatmentSite: string;
  constraints: DoseConstraint[];
  createdAt: Date;
}

interface ConstraintEvaluation {
  constraint: DoseConstraint;
  actualValue: number;
  passed: boolean;
  deviation: number;            // How much over/under
}
```

**Standard Constraint Sets**:
```typescript
const QUANTEC_HEAD_NECK: DoseConstraintSet = {
  id: 'quantec-hn',
  name: 'QUANTEC Head & Neck',
  treatmentSite: 'Head and Neck',
  constraints: [
    { structureName: 'Spinal Cord', constraintType: 'max', threshold: 50, unit: 'Gy', priority: 'required' },
    { structureName: 'Brain Stem', constraintType: 'max', threshold: 54, unit: 'Gy', priority: 'required' },
    { structureName: 'Parotid_L', constraintType: 'mean', threshold: 26, unit: 'Gy', priority: 'optimal' },
    { structureName: 'Parotid_R', constraintType: 'mean', threshold: 26, unit: 'Gy', priority: 'optimal' },
    { structureName: 'Mandible', constraintType: 'max', threshold: 70, unit: 'Gy', priority: 'optimal' },
    // ... more constraints
  ]
};
```

---

## Implementation Priority Order

### Immediate (This Sprint)
1. ✅ **Dose Unit Toggle** - Simple but highly visible UX improvement
2. ✅ **Display Mode Selection** - Consolidate existing features into clear modes
3. ✅ **Banded Color Wash** - Essential clinical feature

### Short-Term (Next 2 Sprints)
4. **Saveable Isodose Presets** - Major usability enhancement
5. **DVH Viewer** - Critical clinical feature, most requested
6. **Normalization Source Display** - Important for clinical context

### Medium-Term (Next Month)
7. **Create Contours from Isodose** - High value for planning workflow
8. **Localize to Max Dose** - Quick win, helps QA workflow
9. **Clip Dose to Contour** - Useful for focused analysis

### Long-Term (Roadmap)
10. **BED Calculation** - Advanced feature for brachytherapy/SBRT
11. **Dose Constraints** - Full constraint evaluation system
12. **Individual Isodose Settings** - Per-dose customization

---

## Technical Architecture

### New Files to Create
```
client/src/
├── components/dicom/
│   ├── dvh-viewer.tsx              # DVH chart and statistics
│   ├── isodose-preset-manager.tsx  # Preset CRUD UI
│   ├── dose-constraint-panel.tsx   # Constraint evaluation UI
│   └── bed-calculator.tsx          # BED/EQD2 calculator
├── lib/
│   ├── dvh-calculator.ts           # DVH computation algorithms
│   └── dose-constraints.ts         # Constraint evaluation logic

server/
├── rt-dose-api.ts                  # Extend with DVH, BED endpoints
└── schemas/
    ├── isodose-presets.ts          # Drizzle schema for presets
    └── dose-constraints.ts         # Drizzle schema for constraints
```

### Database Schema Additions
```sql
-- Isodose Presets
CREATE TABLE isodose_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_brachy_default BOOLEAN DEFAULT FALSE,
  levels_json TEXT NOT NULL,  -- JSON array of IsodoseLevel
  user_id TEXT,  -- Optional: per-user presets
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dose Constraint Sets
CREATE TABLE dose_constraint_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  treatment_site TEXT,
  constraints_json TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,  -- Built-in vs user-created
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Testing Plan

### Unit Tests
- DVH calculation accuracy against known reference data
- BED/EQD2 formula correctness
- Isodose level extraction at various thresholds
- Constraint evaluation logic

### Integration Tests
- DVH for multi-structure selections
- Preset save/load/delete workflows
- Dose clipping with complex structures

### Clinical Validation
- Compare DVH output with Eclipse/Pinnacle for same patient
- Verify isodose line positions match TPS export
- Validate BED calculations against published examples

---

## References

- [MIM Software: View Dose Fundamentals](https://www.mimsoftware.com/portal/training/radiation_oncology/kb/dose/td662-view-dose-fundamentals)
- [MIM Software: DVH Documentation](https://www.mimsoftware.com/portal/training/radiation_oncology/kb/dose/dvh)
- [DICOM RT Dose IOD](https://dicom.nema.org/medical/dicom/current/output/html/part03.html#sect_A.18)
- QUANTEC Guidelines for Dose Constraints
- ICRU Report 83: Prescribing, Recording, and Reporting

---

*Document created: January 14, 2026*
*Based on MIM Software 7.4 Documentation Review*



