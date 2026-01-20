# Dose & Fusion Tools Gap Analysis

## Executive Summary

This document compares our current CONVERGE viewer implementation against MIM Maestro 7.1-7.4 features for dose visualization and image fusion/registration. It identifies missing features and provides detailed implementation pathways for each.

---

## Part 1: DOSE TOOLS

### Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Dose Color Wash Overlay | ✅ Implemented | Multiple colormaps (rainbow, hot, jet, cool, dosimetry, grayscale) |
| Isodose Lines | ✅ Implemented | Configurable levels with standard Eclipse/Pinnacle colors |
| Basic Statistics | ✅ Partial | Min, max, mean only |
| Prescription Normalization | ✅ Implemented | % of Rx vs absolute Gy toggle |
| Opacity Controls | ✅ Implemented | Slider control |
| Colormap Selection | ✅ Implemented | 6 colormap options |
| Threshold Adjustment | ✅ Implemented | Min/max threshold controls |

---

### Missing Dose Features

#### 1. DVH (Dose-Volume Histogram) 🔴 HIGH PRIORITY

**MIM Reference:** Pages 532-540 of User Guide

**What it does:**
- Displays cumulative dose-volume histogram curves for each contoured structure
- Shows what percentage of volume receives at least a given dose
- Essential for plan evaluation and dose constraint verification

**Current Gap:**
- No DVH calculation or display
- No integration with contour structures
- No histogram UI component

**Implementation Pathway:**

```
Phase 1: Backend DVH Calculation (2-3 days)
├── Create /api/rt-dose/:doseId/dvh endpoint
├── Accept structure IDs as query params
├── For each structure:
│   ├── Get structure contour points from RTSTRUCT
│   ├── Rasterize contour to 3D mask
│   ├── Sample dose grid at mask voxels
│   └── Calculate cumulative histogram
└── Return { structureName, color, dvhPoints: [{dose, volume%}] }

Phase 2: DVH Visualization Component (2-3 days)
├── Create DVHChart component using recharts or d3
├── X-axis: Dose (Gy or %)
├── Y-axis: Volume (%)
├── Multiple curves with structure colors
├── Interactive hover showing exact values
├── Zoom/pan controls
└── Export to CSV/image

Phase 3: Integration (1-2 days)
├── Add DVH panel to Dose sidebar
├── Sync structure selection with contour panel
├── Add dose statistics below DVH chart
└── Link cursor position to viewport crosshair
```

**Technical Details:**
```typescript
interface DVHPoint {
  dose: number;      // Gy
  dosePercent: number; // % of Rx
  volumePercent: number; // % of structure volume
}

interface DVHCurve {
  structureId: number;
  structureName: string;
  color: string;
  points: DVHPoint[];
  statistics: {
    Dmax: number;
    Dmean: number;
    Dmin: number;
    D95: number;
    D50: number;
    D2: number;
    V100: number;  // Volume receiving 100% Rx
    V95: number;
  };
}
```

---

#### 2. Structure-Specific Dose Statistics 🔴 HIGH PRIORITY

**MIM Reference:** Dose sidebar shows per-structure statistics

**What it does:**
- Dmax, Dmean, Dmin for each structure
- Dx values (dose to x% of volume): D95, D50, D2
- Vx values (volume receiving x Gy): V100, V95, V20 for lung, etc.

**Current Gap:**
- No per-structure dose calculation
- Statistics are global only

**Implementation Pathway:**

```
Phase 1: Backend Statistics API (1-2 days)
├── Extend /api/rt-dose/:doseId/statistics
├── Accept structureId parameter
├── Rasterize structure to mask
├── Calculate all Dx and Vx metrics
└── Return comprehensive statistics object

Phase 2: Statistics Panel Component (1-2 days)
├── Create DoseStatisticsPanel component
├── Collapsible per-structure sections
├── Tabular display of all metrics
├── Color-coded pass/fail indicators
└── Copy/export functionality
```

---

#### 3. Dose Constraints with Pass/Fail 🟡 MEDIUM PRIORITY

**MIM Reference:** Pages 550-559 of User Guide

**What it does:**
- Define clinical dose limits per structure
- Automatic pass/fail evaluation
- Visual indicators in DVH and statistics panels
- Constraint templates (head & neck, prostate, lung, etc.)

**Current Gap:**
- No dose constraint definition
- No pass/fail evaluation
- No constraint templates

**Implementation Pathway:**

```
Phase 1: Constraint Data Model (1 day)
├── Create dose_constraints table in database
├── Fields: structureType, metric, comparator, value, priority
├── Seed with standard constraint sets (QUANTEC, institutional)
└── API endpoints for CRUD operations

Phase 2: Constraint Evaluation (1-2 days)
├── Calculate metrics for each constraint
├── Compare against limits
├── Return pass/fail/marginal status
└── Aggregate into plan quality score

Phase 3: UI Components (2 days)
├── DoseConstraintTable component
├── Pass (green) / Fail (red) / Marginal (yellow) indicators
├── Edit constraint values inline
├── Save custom constraint sets
└── Apply templates button
```

**Constraint Schema:**
```typescript
interface DoseConstraint {
  id: string;
  structurePattern: string;  // Regex for structure name matching
  metric: 'Dmax' | 'Dmean' | 'D95' | 'D50' | 'V20' | 'V5' | ...;
  comparator: '<' | '<=' | '>' | '>=' | '=';
  value: number;
  unit: 'Gy' | 'cGy' | '%';
  priority: 'required' | 'optimal' | 'informational';
}
```

---

#### 4. BED (Biological Effective Dose) Calculations 🟡 MEDIUM PRIORITY

**MIM Reference:** Pages 514-520, 658-662 of User Guide

**What it does:**
- Converts physical dose to BED accounting for fractionation
- Uses α/β ratios for different tissue types
- Essential for re-treatment planning and dose accumulation
- EQD2 conversion (equivalent dose in 2 Gy fractions)

**Current Gap:**
- No BED calculation
- No α/β ratio configuration
- No EQD2 conversion

**Implementation Pathway:**

```
Phase 1: BED Calculation Engine (1-2 days)
├── Implement BED formula: BED = D × (1 + d/αβ)
├── Implement EQD2 formula: EQD2 = D × (d + αβ) / (2 + αβ)
├── Support per-structure α/β ratios
└── Handle different fractionation schemes

Phase 2: Backend API (1 day)
├── /api/rt-dose/:doseId/bed endpoint
├── Accept fractionation parameters
├── Accept α/β ratios per structure
└── Return converted dose grid

Phase 3: UI Integration (1 day)
├── BED conversion toggle in Dose panel
├── Fractionation input (# fractions, dose/fx)
├── α/β ratio presets (tumor=10, late-responding=3)
└── Display BED alongside physical dose
```

**BED Formula:**
```
BED = nd × (1 + d/αβ)

Where:
- n = number of fractions
- d = dose per fraction
- αβ = tissue-specific ratio (Gy)
```

---

#### 5. Dose Accumulation/Summation 🟡 MEDIUM PRIORITY

**MIM Reference:** Pages 521-531, Workflow Guide Pages 29-31

**What it does:**
- Sum multiple dose distributions (prior treatments + current)
- Account for deformable registration between scans
- Track cumulative dose to OARs across treatments
- Essential for re-irradiation planning

**Current Gap:**
- No dose summation capability
- No multi-plan viewing
- No deformable dose mapping

**Implementation Pathway:**

```
Phase 1: Dose Grid Alignment (2-3 days)
├── Extend server to handle multiple dose grids
├── Resample secondary dose to primary CT geometry
├── Support rigid registration matrix application
└── Future: Deformable vector field application

Phase 2: Summation Logic (1-2 days)
├── Voxel-wise addition of aligned dose grids
├── Handle different dose grid resolutions
├── Optional scaling factors per dose
└── Create new RTDose object for summed result

Phase 3: UI Workflow (2 days)
├── Multi-dose selection in sidebar
├── Dose scaling factor inputs
├── Sum preview before committing
├── Save summed dose as new series
└── Generate accumulation report
```

---

#### 6. Dose Difference Display (Plan Comparison) 🟢 LOWER PRIORITY

**MIM Reference:** Compare dose distributions between plans

**What it does:**
- Subtract one dose grid from another
- Visualize areas of increased/decreased dose
- Useful for adaptive planning QA

**Implementation Pathway:**

```
Phase 1: Difference Calculation (1 day)
├── Align dose grids to same geometry
├── Subtract voxel-by-voxel
└── Generate difference grid

Phase 2: Visualization (1-2 days)
├── Diverging colormap (blue-white-red)
├── Positive = Plan A higher
├── Negative = Plan B higher
└── Threshold controls for difference display
```

---

#### 7. 3D Dose Surface Rendering 🟢 LOWER PRIORITY

**MIM Reference:** Pages 108-113 of User Guide

**What it does:**
- 3D isodose surfaces as semi-transparent shells
- Combined with contour surfaces
- Useful for visualizing dose coverage

**Implementation Pathway:**

```
Phase 1: Marching Cubes for Isodose (2-3 days)
├── Generate 3D mesh at each isodose level
├── Use marching cubes algorithm
└── Export to THREE.js geometry

Phase 2: 3D Viewer Integration (2-3 days)
├── Add dose surfaces to existing 3D view
├── Per-surface opacity controls
├── Color matching isodose line colors
└── Toggle individual surfaces on/off
```

---

## Part 2: FUSION & REGISTRATION TOOLS

### Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Basic Overlay Blend | ✅ Implemented | Opacity slider for fusion |
| Rigid Registration | ✅ Implemented | Via REG file transformation matrices |
| Frame of Reference Matching | ✅ Implemented | Automatic series grouping |
| Registration Selection | ✅ Implemented | Multiple REG support |
| Translate Tool | ✅ Implemented | Manual X/Y/Z adjustment |
| Fusion Panel | ✅ Implemented | Basic controls |
| PET/MR Colormaps | ✅ Implemented | SUV colormaps for PET |

### Prototype Features (Not Fully Integrated)

| Feature | Status | Notes |
|---------|--------|-------|
| Checkerboard Mode | 🟡 Prototype | In fusion-editor-popup-prototype.tsx |
| Swipe/Curtain Mode | 🟡 Prototype | In fusion-editor-popup-prototype.tsx |
| Spyglass Mode | 🟡 Prototype | In fusion-editor-popup-prototype.tsx |
| Flicker Mode | 🟡 Prototype | In fusion-editor-popup-prototype.tsx |
| Difference Mode | 🟡 Prototype | In fusion-editor-popup-prototype.tsx |
| Edge Detection | 🟡 Prototype | In fusion-editor-popup-prototype.tsx |

---

### Missing Fusion/Registration Features

#### 1. Full Fusion Visualization Modes 🔴 HIGH PRIORITY

**MIM Reference:** Pages 263-277 of User Guide

**What MIM offers:**
- **Normal (RGB Addition)** - Default blend mode ✅ Have this
- **Checkerboard** - Alternating squares showing each image
- **Opacity** - Special handling for transparent low values
- **Geometric Mean** - √(A×B) blend
- **Edge Detection** - Overlay edge contours
- **Subtraction/Addition** - Mathematical operations
- **MIP Fusion** - Combined MIP projections
- **DRR Fusion** - Digitally reconstructed radiograph overlay

**Current Gap:**
- Prototype modes exist but not integrated into main viewer
- No keyboard shortcuts
- No persistence of mode preference

**Implementation Pathway:**

```
Phase 1: Integrate Existing Prototypes (2-3 days)
├── Move EvaluationMode types to shared types
├── Implement each mode in working-viewer.tsx:
│   ├── checkerboard: Create grid pattern shader
│   ├── swipe: Add draggable divider line
│   ├── spyglass: Circular lens following cursor
│   ├── flicker: Auto-toggle timer (adjustable Hz)
│   ├── difference: Subtract & use diverging colormap
│   └── edges: Sobel filter on secondary
├── Add mode selector to fusion toolbar
└── Add keyboard shortcuts (C=checker, S=swipe, etc.)

Phase 2: Advanced Modes (2-3 days)
├── Geometric Mean: sqrt(primary * secondary)
├── Edge overlay: Canny/Sobel edges colored
├── MIP Fusion: Combined volumetric projection
└── DRR: Raycast through volume

Phase 3: User Preferences (1 day)
├── Save preferred mode to localStorage
├── Per-modality defaults (PET=opacity, MR=normal)
└── Quick mode switching in toolbar
```

**Checkerboard Implementation Detail:**
```typescript
// Render checkerboard pattern
const renderCheckerboard = (
  ctx: CanvasRenderingContext2D,
  primaryCanvas: HTMLCanvasElement,
  secondaryCanvas: HTMLCanvasElement,
  gridSize: number = 32
) => {
  const { width, height } = ctx.canvas;
  
  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width; x += gridSize) {
      const isEven = ((x / gridSize) + (y / gridSize)) % 2 === 0;
      const source = isEven ? primaryCanvas : secondaryCanvas;
      ctx.drawImage(
        source,
        x, y, gridSize, gridSize,  // source rect
        x, y, gridSize, gridSize   // dest rect
      );
    }
  }
};
```

---

#### 2. Deformable Image Registration (DIR) 🔴 HIGH PRIORITY

**MIM Reference:** Pages 283-313, DIR QA Guide (entire document)

**What it does:**
- Non-rigid alignment that warps anatomy
- Handles anatomical changes between scans
- Essential for adaptive radiotherapy
- Multiple algorithms:
  - **Intensity-based** - Same modality (CT-CT, MR-MR)
  - **Normalized Intensity** - CBCT to CT
  - **Multi-modality** - CT to MR, contrast vs non-contrast
  - **Contour-based** - Uses matching structures
  - **Hybrid** - Combined intensity + contour

**Current Gap:**
- No deformable registration
- Only rigid transformations supported
- No deformation vector field handling

**Implementation Pathway:**

```
Phase 1: Backend DIR Integration (1-2 weeks)
├── Research options:
│   ├── ITK-based (elastix, SimpleITK)
│   ├── Python libraries (ANTsPy, SimpleElastix)
│   └── External services
├── Create /api/registration/deformable endpoint
├── Input: Primary series ID, Secondary series ID, Algorithm, Parameters
├── Output: Deformation Vector Field (DVF) as DICOM REG
└── Store DVF for reuse

Phase 2: DVF Data Structure (2-3 days)
├── Parse DICOM Deformable Spatial Registration
├── Store vector field in efficient format
├── Support both forward and inverse transforms
└── Interpolation for sub-voxel accuracy

Phase 3: Apply Deformation to Images (3-4 days)
├── Warp secondary image using DVF
├── GPU acceleration for real-time viewing
├── Cache warped slices
└── Handle edge cases (outside FOV)

Phase 4: Apply Deformation to Contours (2-3 days)
├── Transform contour points through DVF
├── Maintain topology (no self-intersection)
├── Smooth resulting contours
└── Create new RTSTRUCT with propagated contours
```

**DIR Algorithm Selection Guide (from MIM):**

| Scenario | Recommended Algorithm |
|----------|----------------------|
| CT to CT (same patient) | Intensity-based (Same Subject) |
| CBCT to CBCT | CBCT to CBCT profile |
| CBCT to CT | Multi-modality or Normalized |
| CT to MR | Multi-modality |
| MR to MR (different sequences) | Multi-modality |
| Contrast to Non-contrast CT | Multi-modality |
| With matching contours | Hybrid or Contour-based |

---

#### 3. DIR QA Tools - Reg Reveal 🔴 HIGH PRIORITY

**MIM Reference:** Pages 294-306 of User Guide

**What it does:**
- Visualize deformation quality in local regions
- "Sampling cube" shows undeformed secondary overlaid on primary
- Helps identify areas of good/poor registration
- Critical for clinical confidence in DIR

**Current Gap:**
- No deformation visualization
- No local registration inspection

**Implementation Pathway:**

```
Phase 1: Reg Reveal Component (3-4 days)
├── Create RegRevealTool component
├── Sampling cube that follows cursor
├── Inside cube: Show undeformed secondary
├── Outside cube: Show deformed result
├── Adjustable cube size
└── Keyboard shortcut to toggle

Phase 2: Visual Indicators (2 days)
├── Highlight areas of large deformation
├── Color-coded confidence overlay
├── Vector field visualization (arrows)
└── Jacobian determinant display
```

**Reg Reveal Concept:**
```
┌─────────────────────────────────────────┐
│  Viewport (showing deformed fusion)     │
│                                         │
│        ┌───────────┐                    │
│        │ Sampling  │← Shows UNDEFORMED  │
│        │   Cube    │  secondary here    │
│        │  (local)  │                    │
│        └───────────┘                    │
│                                         │
│  Rest of viewport shows deformed result │
└─────────────────────────────────────────┘
```

---

#### 4. DIR QA Tools - Reg Refine 🔴 HIGH PRIORITY

**MIM Reference:** Pages 307-312 of User Guide

**What it does:**
- Lock local alignments (landmarks) where registration is correct
- Adjust registration in specific regions
- Convert locked alignments into improved deformation
- Critical for fixing registration errors

**Current Gap:**
- No landmark-based adjustment
- No local registration locking
- No iterative refinement

**Implementation Pathway:**

```
Phase 1: Landmark Placement (2-3 days)
├── Create LandmarkTool component
├── Click to place corresponding points
├── Link landmarks between primary/secondary
├── Visual indicators for landmark pairs
└── Drag to adjust landmark position

Phase 2: Local Alignment Locking (2-3 days)
├── "Lock" button for each landmark pair
├── Locked alignments shown differently
├── Store locked alignments
└── Unlock capability

Phase 3: Re-registration with Locks (2-3 days)
├── Use locked landmarks as constraints
├── Re-run DIR respecting constraints
├── "Convert Local Alignments" option
└── Generate improved DVF
```

---

#### 5. Jacobian Visualization 🟡 MEDIUM PRIORITY

**MIM Reference:** DIR QA metrics

**What it does:**
- Jacobian determinant shows local volume change
- Values > 1 indicate expansion
- Values < 1 indicate compression
- Values ≤ 0 indicate folding (bad!)

**Current Gap:**
- No Jacobian calculation
- No deformation metric display

**Implementation Pathway:**

```
Phase 1: Jacobian Calculation (1-2 days)
├── Calculate ∂DVF/∂x, ∂DVF/∂y, ∂DVF/∂z
├── Compute determinant at each voxel
└── Store as overlay grid

Phase 2: Visualization (1-2 days)
├── Colormap: Blue (compression) → White (1.0) → Red (expansion)
├── Threshold to highlight extreme values
├── Warning indicators for negative Jacobian
└── Statistics panel (min, max, % negative)
```

---

#### 6. Contour Transfer via Deformation 🟡 MEDIUM PRIORITY

**MIM Reference:** Propagate contours using DIR

**What it does:**
- Map contours from one scan to another via DVF
- Essential for adaptive planning
- Faster than re-contouring from scratch

**Current Gap:**
- No contour propagation
- Manual re-contouring only option

**Implementation Pathway:**

```
Phase 1: Backend Propagation (2-3 days)
├── /api/contours/propagate endpoint
├── Apply DVF to each contour point
├── Handle 3D interpolation
└── Generate new RTSTRUCT

Phase 2: UI Workflow (1-2 days)
├── "Propagate Contours" button
├── Select source structures
├── Select target series + registration
├── Preview before committing
└── Edit propagated contours
```

---

#### 7. Automatic Registration Optimization 🟡 MEDIUM PRIORITY

**MIM Reference:** Auto-align and optimize features

**What it does:**
- Automatically optimize rigid registration
- Mutual information or cross-correlation metric
- Multi-resolution for speed
- Useful as starting point before manual refinement

**Current Gap:**
- No automatic optimization
- Only manual translate/rotate

**Implementation Pathway:**

```
Phase 1: Backend Optimization (3-4 days)
├── Implement optimization algorithm
├── Options: Powell, gradient descent, BOBYQA
├── Metrics: Mutual Information, NCC
├── Multi-resolution pyramid
└── Return optimized transform

Phase 2: UI Integration (1-2 days)
├── "Auto-Align" button in fusion panel
├── Progress indicator
├── Cancel capability
└── Undo to previous alignment
```

---

#### 8. TG-132 Report Generation 🟢 LOWER PRIORITY

**MIM Reference:** Standardized registration QA report

**What it does:**
- Document registration method and parameters
- Include QA metrics and images
- Meets AAPM TG-132 recommendations
- Essential for clinical documentation

**Implementation Pathway:**

```
Phase 1: Report Data Collection (2 days)
├── Gather registration metadata
├── Calculate QA metrics
├── Capture reference screenshots
└── Structure data for report

Phase 2: Report Generation (2-3 days)
├── PDF generation (react-pdf or similar)
├── Standardized TG-132 format
├── Include all required elements
└── Export/print functionality
```

---

## Implementation Priority Matrix

### Phase 1: Essential Features (Weeks 1-4)

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| DVH Calculation & Display | 🔴 High | 5-7 days | Contour rasterization |
| Structure Dose Statistics | 🔴 High | 3-4 days | DVH backend |
| Fusion Mode Integration | 🔴 High | 4-6 days | None |
| Dose Constraints | 🟡 Medium | 4-5 days | Dose statistics |

### Phase 2: Advanced Features (Weeks 5-8)

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Deformable Registration | 🔴 High | 2-3 weeks | Backend DIR library |
| Reg Reveal Tool | 🔴 High | 5-6 days | DIR implementation |
| Reg Refine Tool | 🔴 High | 5-7 days | DIR, Landmarks |
| BED Calculations | 🟡 Medium | 3-4 days | None |

### Phase 3: Complete Feature Set (Weeks 9-12)

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Dose Accumulation | 🟡 Medium | 5-6 days | DIR optional |
| Jacobian Visualization | 🟡 Medium | 3-4 days | DIR |
| Contour Propagation | 🟡 Medium | 4-5 days | DIR |
| Auto Registration | 🟡 Medium | 4-5 days | None |
| Dose Difference | 🟢 Lower | 2-3 days | None |
| 3D Dose Surfaces | 🟢 Lower | 4-6 days | 3D viewer |
| TG-132 Reports | 🟢 Lower | 4-5 days | None |

---

## Technical Architecture Recommendations

### 1. Dose Module Extensions

```
client/src/dose/
├── dose-context.tsx          # Existing - extend
├── dvh/
│   ├── dvh-calculator.ts     # DVH computation
│   ├── dvh-chart.tsx         # Visualization
│   └── dvh-statistics.ts     # Dx, Vx calculations
├── constraints/
│   ├── constraint-types.ts   # Type definitions
│   ├── constraint-evaluator.ts
│   └── constraint-panel.tsx
├── bed/
│   ├── bed-calculator.ts
│   └── bed-panel.tsx
└── accumulation/
    ├── dose-summer.ts
    └── accumulation-workflow.tsx
```

### 2. Registration Module Extensions

```
client/src/registration/
├── registration-context.tsx  # New context for DIR state
├── deformable/
│   ├── dvf-manager.ts        # Deformation vector field handling
│   ├── dvf-applicator.ts     # Apply DVF to images/contours
│   └── dir-profiles.ts       # Algorithm configurations
├── qa/
│   ├── reg-reveal.tsx        # Sampling cube tool
│   ├── reg-refine.tsx        # Landmark adjustment
│   ├── jacobian-overlay.tsx  # Deformation metric display
│   └── tg132-report.tsx      # Report generation
├── optimization/
│   ├── auto-align.ts         # Automatic registration
│   └── metrics.ts            # MI, NCC calculations
└── fusion-modes/
    ├── checkerboard.ts
    ├── swipe.ts
    ├── spyglass.ts
    ├── flicker.ts
    └── mode-manager.ts
```

### 3. Backend API Extensions

```
server/
├── rt-dose-api.ts            # Existing - extend
├── dvh-api.ts                # New: DVH calculations
├── registration-api.ts       # New: DIR endpoints
│   ├── POST /api/registration/deformable
│   ├── GET  /api/registration/:id/dvf
│   ├── POST /api/registration/:id/apply-contours
│   └── POST /api/registration/optimize
└── reports-api.ts            # New: Report generation
```

---

## Dependencies & External Libraries

### For Deformable Registration

| Option | Pros | Cons |
|--------|------|------|
| **SimpleElastix (Python)** | Full-featured, well-tested | Requires Python service |
| **ITK-WASM** | Runs in browser | Complex setup, limited algorithms |
| **ANTsPy** | Excellent algorithms | Python dependency |
| **In-house B-spline** | No dependencies | Significant development effort |

**Recommendation:** Start with Python microservice using SimpleElastix, plan for ITK-WASM migration later.

### For DVH & Statistics

- **dcmjs** - Already using for DICOM parsing
- **ml-matrix** - Matrix operations
- **marching-squares** - Contour rasterization

### For Visualization

- **recharts** or **d3** - DVH charts
- **three.js** - Already using for 3D
- **glsl shaders** - GPU-accelerated fusion modes

---

## Conclusion

This gap analysis identifies **17 major features** needed to reach parity with MIM Maestro for dose and fusion tools. The recommended implementation order prioritizes:

1. **DVH and dose statistics** - Essential for clinical plan review
2. **Fusion visualization modes** - Already prototyped, needs integration
3. **Deformable registration** - Critical for adaptive planning
4. **DIR QA tools** - Required for clinical confidence

Total estimated effort: **12-16 weeks** for full implementation with a focused development team.

---

*Document generated: January 2026*
*Based on: MIM Maestro 7.1-7.4 User Guide, DIR QA Guide, Workflows Guide*


