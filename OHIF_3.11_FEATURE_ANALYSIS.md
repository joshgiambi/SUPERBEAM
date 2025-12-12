# OHIF 3.11 Feature Analysis & Superbeam Upgrade Plan

## Executive Summary

This document analyzes OHIF Viewer 3.11 (released August 2025) features against the current Superbeam implementation, identifying opportunities for enhancement and providing implementation guidance.

---

## Feature Comparison Matrix

| Feature | OHIF 3.11 | Superbeam Current | Gap | Priority |
|---------|-----------|-------------------|-----|----------|
| Enhanced Viewport Dialog | ✅ Full | ⚠️ Partial | Colorbar, blending modes | P0 |
| Multimodality Fusion | ✅ PET/CT/MR/RTDOSE | ⚠️ PET/CT/MR only | RT Dose overlay | P1 |
| Colorbar Controls | ✅ Position-aware | ❌ Missing | Full implementation | P0 |
| RT Dose Overlay | ✅ Full support | ❌ Missing | Full implementation | P1 |
| RTSS Multi-plane Projection | ✅ Web Worker based | ⚠️ Basic MPR | Cross-plane contours | P1 |
| Labelmap Segmentation IOD | ✅ New format | ❌ Missing | New format support | P2 |
| SCOORD3D Annotations | ✅ 3D coordinates | ❌ Missing | 3D annotation support | P2 |
| Sequential Rendering Engine | ✅ Canvas size fix | ⚠️ Standard | Large canvas support | P1 |
| WebGL Context Pool | ✅ Parallel rendering | ⚠️ Single context | Multi-viewport GPU | P1 |
| Segment Statistics | ✅ Volume/SUV metrics | ⚠️ Basic | Enhanced metrics | P1 |
| Layout Save/Load | ✅ Full persistence | ⚠️ Session only | Storage persistence | P0 |

---

## 1. Enhanced Viewport Dialog for Multimodality Fusion

### OHIF 3.11 Implementation
- Comprehensive multimodality data fusion and overlay management
- Interactive opacity and blending controls
- Supports PET over CT, RT Dose overlays
- Fine-tune controls for how datasets appear together

### Superbeam Current State
```typescript
// Current FusionControlPanel provides:
- Opacity slider (0-100%)
- Secondary series selection
- Window/Level presets (DICOM, T1, T2, FLAIR, etc.)
- Status indicators (Ready/Building/Error)
```

### Enhancement Opportunities
1. **Blending Mode Selector** - Add blend modes (additive, multiply, screen, overlay)
2. **In-Viewport Colorbar** - Visual legend showing fusion intensity mapping
3. **Quick Opacity Toggle** - Double-click to toggle between 0% and preset
4. **Dual Window/Level** - Independent W/L for primary AND secondary

---

## 2. RT Dose Overlay Support (NEW)

### OHIF 3.11 Feature
Full support for RT Dose visualization overlaid on CT/MR:
- Adjustable transparency
- Color mapping (dose wash)
- Dose thresholds
- Isodose lines

### Implementation Plan

```typescript
// New: RTDoseOverlayManager
interface RTDoseConfig {
  doseSeriesId: number;
  colormap: 'rainbow' | 'hot' | 'cool' | 'jet';
  opacityTable: number[]; // opacity per dose level
  thresholds: {
    min: number;      // Gy - below this is transparent
    max: number;      // Gy - clamped to max color
    prescription: number; // Gy - highlight line
  };
  showIsodose: boolean;
  isodoseLevels: number[]; // e.g., [50, 80, 95, 100, 105] % of prescription
}
```

### Required Changes
1. Extend `FusionOverlayManager` to handle RTDOSE modality
2. Add dose colormap generation (rainbow wash)
3. Implement isodose contour extraction
4. Add dose statistics panel (min, max, mean, D95, etc.)

---

## 3. Advanced Multi-planar RTSS Visualization

### OHIF 3.11 Feature
- Projects RT Structure contours in orientations beyond original acquisition
- Separate-thread processing for UI performance
- Spatial accuracy for oncology workflows

### Superbeam Current State
```typescript
// Current: Axial-only contour display
// MPR windows show reformatted images but not contours
```

### Enhancement Plan

```typescript
// New: MPRContourProjector
class MPRContourProjector {
  /**
   * Project axial contours to sagittal/coronal views
   * Uses Web Worker for performance
   */
  async projectContours(
    contours: ContourSet,
    targetOrientation: 'sagittal' | 'coronal',
    slicePosition: number,
    imageMetadata: ImageMetadata
  ): Promise<ProjectedContour[]>;
}
```

### Worker Implementation
```typescript
// contour-projection.worker.ts
self.onmessage = (e) => {
  const { contours, orientation, position, spacing } = e.data;
  
  // Reconstruct 3D volume from contours
  // Slice through volume at target orientation
  // Extract intersection contours
  
  self.postMessage({ projectedContours });
};
```

---

## 4. Interactive Colorbar Component

### OHIF 3.11 Feature
- Colorbar can be placed left/right/top/bottom of viewport
- Shows intensity/dose mapping visually
- Interactive: click to adjust window/level

### Implementation

```typescript
// New Component: ViewportColorbar
interface ViewportColorbarProps {
  position: 'left' | 'right' | 'top' | 'bottom';
  type: 'intensity' | 'dose' | 'pet-suv';
  colormap: string;
  range: { min: number; max: number };
  windowLevel: { window: number; level: number };
  onWindowLevelChange?: (wl: { window: number; level: number }) => void;
  labels?: string[]; // e.g., ['0 Gy', '30 Gy', '60 Gy']
}
```

---

## 5. Sequential Rendering Engine

### OHIF 3.11 Feature
- Resolves canvas size limitation on high-res monitors
- Prevents performance degradation
- Better multi-monitor support

### Superbeam Current State
- Single canvas rendering
- May hit canvas size limits on 4K+ displays
- No rendering engine management

### Enhancement

```typescript
// New: RenderingEngineManager
interface RenderingEngineConfig {
  mode: 'standard' | 'sequential' | 'contextPool';
  maxCanvasSize?: number; // pixels
  maxConcurrentRenders?: number;
}

class RenderingEngineManager {
  private mode: RenderingEngineConfig['mode'];
  
  // Sequential mode: Queues renders to prevent GPU overload
  async renderViewport(viewportId: string, scene: RenderScene): Promise<void>;
  
  // Context pool: Shares WebGL contexts across viewports
  acquireContext(viewportId: string): WebGL2RenderingContext;
  releaseContext(viewportId: string): void;
}
```

---

## 6. Segment Statistics Panel

### OHIF 3.11 Feature
- Volume calculations
- SUV metrics (for PET)
- Statistical measurements

### Enhancement

```typescript
// New: SegmentStatistics component
interface SegmentStats {
  volume: {
    mm3: number;
    cc: number;
  };
  surfaceArea?: number; // mm²
  centroid: [number, number, number];
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  // PET-specific
  suv?: {
    max: number;
    mean: number;
    peak: number; // 1cc sphere max
  };
  // Dose-specific (if dose overlay)
  dose?: {
    min: number;
    max: number;
    mean: number;
    d95: number; // Dose covering 95% of volume
    d50: number;
    v100: number; // Volume receiving 100% of prescription
  };
}
```

---

## 7. Layout Persistence

### OHIF 3.11 Feature
- Save custom viewport configurations
- Restore layouts across sessions
- Named presets

### Current Superbeam
```typescript
// fusionLayoutService - session-only persistence
getLayoutForStudy(studyId: number): FusionLayoutPreset
setLayoutForStudy(studyId: number, preset: FusionLayoutPreset): void
```

### Enhancement

```typescript
// Enhanced: Persistent Layout Manager
interface ViewportLayout {
  id: string;
  name: string;
  description?: string;
  gridConfig: {
    rows: number;
    cols: number;
    template?: string; // CSS grid template
  };
  viewports: Array<{
    seriesType: 'CT' | 'MR' | 'PT' | 'RTDOSE' | 'RTSTRUCT';
    fusionConfig?: {
      secondaryType: string;
      opacity: number;
      colormap?: string;
    };
    showStructures: boolean;
    orientation: 'axial' | 'sagittal' | 'coronal';
  }>;
  isDefault?: boolean;
  createdAt: number;
  modifiedAt: number;
}

class LayoutPersistenceService {
  // Save to localStorage or server
  async saveLayout(layout: ViewportLayout): Promise<void>;
  async loadLayout(layoutId: string): Promise<ViewportLayout | null>;
  async listLayouts(): Promise<ViewportLayout[]>;
  async deleteLayout(layoutId: string): Promise<void>;
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Interactive Colorbar Component
- [ ] Enhanced Blending Controls
- [ ] Layout Persistence Service

### Phase 2: Multi-modality (Week 2)
- [ ] RT Dose Overlay Manager
- [ ] Dose Colormap Generation
- [ ] Isodose Contour Extraction

### Phase 3: MPR Enhancement (Week 3)
- [ ] MPR Contour Projection Worker
- [ ] Cross-plane RTSS Display
- [ ] Synchronized Crosshairs

### Phase 4: Performance (Week 4)
- [ ] Sequential Rendering Engine
- [ ] WebGL Context Pool
- [ ] Large Canvas Support

### Phase 5: Analytics (Week 5)
- [ ] Segment Statistics Panel
- [ ] Volume/SUV Metrics
- [ ] Dose-Volume Histograms

---

## Code Architecture Changes

### New Files to Create
```
client/src/
├── components/
│   └── dicom/
│       ├── viewport-colorbar.tsx          # NEW: Interactive colorbar
│       ├── segment-statistics-panel.tsx   # NEW: Volume/SUV metrics
│       ├── rt-dose-overlay.tsx            # NEW: Dose visualization
│       ├── isodose-contours.tsx           # NEW: Isodose lines
│       └── blending-mode-selector.tsx     # NEW: Blend modes UI
├── lib/
│   ├── rt-dose-manager.ts                 # NEW: RTDOSE handling
│   ├── contour-projection-worker.ts       # NEW: MPR contours
│   ├── rendering-engine-manager.ts        # NEW: Engine management
│   ├── layout-persistence-service.ts      # NEW: Layout storage
│   └── segment-statistics.ts              # NEW: Volume calculations
└── workers/
    └── contour-projection.worker.ts       # NEW: Background projection
```

### Modified Files
```
client/src/
├── components/
│   └── dicom/
│       ├── fusion-control-panel.tsx       # Add blending modes
│       ├── flexible-fusion-layout.tsx     # Add colorbar support
│       ├── working-viewer.tsx             # Integrate new components
│       └── series-selector.tsx            # Add RTDOSE detection
├── fusion/
│   └── fusion-context.tsx                 # Add dose overlay state
└── lib/
    └── viewport-grid-service.ts           # Enhanced layout management
```

---

## References

- [OHIF 3.11 Release Notes](https://ohif.org/release-notes/3p11)
- [Cornerstone3D Documentation](https://www.cornerstonejs.org/)
- [DICOM RT Dose IOD](https://dicom.nema.org/medical/dicom/current/output/html/part03.html#sect_A.18)

