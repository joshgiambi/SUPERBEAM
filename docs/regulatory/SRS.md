# Software Requirements Specification (SRS)

## Document Information

| Field | Value |
|-------|-------|
| Document Version | 1.0.0 |
| Generated | 2026-01-27T22:12:15.216Z |
| Total Requirements | 206 |
| Product Name | CONVERGE Medical Imaging Viewer |
| Intended Use | Display and manipulation of medical imaging data |

## Risk Classification Summary

| Risk Level | Count | Percentage |
|------------|-------|------------|
| High | 16 | 7.8% |
| Low | 137 | 66.5% |
| Medium | 53 | 25.7% |

## Requirements by Category

### AI Segmentation

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-AI-001 | Prediction Overlay | 🔴 High | ✅ | 8 |
| REQ-AI-002 | Block Matching Prediction | 🔴 High | 🔧 | - |
| REQ-AI-003 | Fast Slice Prediction | 🔴 High | ✅ | 1 |
| REQ-AI-004 | Image Aware Prediction | 🔴 High | ✅ | 2 |
| REQ-AI-005 | Prediction History Manager | 🔴 High | 🔧 | - |
| REQ-AI-006 | Robust Slice Prediction | 🔴 High | ✅ | 1 |
| REQ-AI-007 | Sam Controller | 🔴 High | 🔧 | - |
| REQ-AI-008 | Sam Server Client | 🔴 High | 🔧 | - |
| REQ-AI-009 | Mem3d Api API | 🔴 High | 🔧 | - |
| REQ-AI-010 | Segvol Api API | 🔴 High | 🔧 | - |

### Boolean Operations

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-BOOL-001 | Boolean Panel | 🟡 Medium | 🔧 | - |
| REQ-BOOL-002 | Boolean Operations Toolbar New | 🟡 Medium | ✅ | 1 |
| REQ-BOOL-003 | Clipper Boolean Operations | 🟡 Medium | 🔧 | - |

### Contour Tools

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-CONTOUR-001 | Contour Edit Panel | 🟡 Medium | ✅ | 3 |
| REQ-CONTOUR-002 | Contour Edit Toolbar | 🟡 Medium | ✅ | 2 |
| REQ-CONTOUR-003 | Eclipse Pen Tool | 🟡 Medium | ✅ | 3 |
| REQ-CONTOUR-004 | Eclipse Planar Contour Tool | 🟡 Medium | ✅ | 4 |
| REQ-CONTOUR-005 | Ghost Contour Overlay | 🟡 Medium | ✅ | 9 |
| REQ-CONTOUR-006 | Pen Tool Unified V2 | 🟡 Medium | ✅ | 3 |
| REQ-CONTOUR-007 | Pen Tool V2 | 🟡 Medium | ✅ | 3 |
| REQ-CONTOUR-008 | Pen Tool | 🟡 Medium | ✅ | 3 |
| REQ-CONTOUR-009 | Simple Brush Tool | 🟡 Medium | ✅ | 3 |
| REQ-CONTOUR-010 | Brush To Polygon | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-011 | Contour Boolean Operations | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-012 | Contour Directional Grow | 🟡 Medium | ✅ | 2 |
| REQ-CONTOUR-013 | Contour Grow | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-014 | Contour Interpolation | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-015 | Contour Polish | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-016 | Contour Prediction | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-017 | Contour Smooth Simple | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-018 | Contour V2 | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-019 | Mask To Contours | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-020 | Simple Contour Prediction | 🟡 Medium | ✅ | 1 |
| REQ-CONTOUR-021 | Smart Brush Utils | 🟡 Medium | ✅ | 4 |

### DICOM Handling

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-DICOM-001 | Dicom Uploader | 🟢 Low | ✅ | 2 |
| REQ-DICOM-002 | Dicom Preview Modal | 🟢 Low | ✅ | 3 |
| REQ-DICOM-003 | Dicom Thumbnail | 🟢 Low | ✅ | 2 |
| REQ-DICOM-004 | Dicom Utils.test | 🟢 Low | ✅ | 5 |
| REQ-DICOM-005 | Dicom Coordinates | 🟢 Low | ✅ | 2 |
| REQ-DICOM-006 | Dicom Loader | 🟢 Low | ✅ | 4 |
| REQ-DICOM-007 | Dicom Spatial Helpers | 🟢 Low | ✅ | 2 |
| REQ-DICOM-008 | Dicom Types | 🟢 Low | ✅ | 2 |
| REQ-DICOM-009 | Dicom Utils | 🟢 Low | ✅ | 5 |
| REQ-DICOM-010 | Dicom Worker Manager | 🟢 Low | ✅ | 3 |

### Data Import

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-IMPORT-001 | Robust Import | 🟢 Low | 🔧 | - |
| REQ-IMPORT-002 | Upload Zone | 🟢 Low | 🔧 | - |
| REQ-IMPORT-003 | Robust Import Routes API | 🟢 Low | 🔧 | - |

### Dose-Volume Histogram

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-DVH-001 | Dvh Popup Viewer | 🟡 Medium | 🔧 | - |
| REQ-DVH-002 | Dvh Viewer | 🟡 Medium | 🔧 | - |
| REQ-DVH-003 | Dvh Api API | 🟡 Medium | 🔧 | - |

### General

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-GEN-001 | Ai Status Panel | 🟢 Low | ✅ | 2 |
| REQ-GEN-002 | Ai Tumor Tool | 🟢 Low | ✅ | 3 |
| REQ-GEN-003 | Dose Control Panel | 🟢 Low | ✅ | 2 |
| REQ-GEN-004 | Error Modal | 🟢 Low | ✅ | 1 |
| REQ-GEN-005 | Loading Progress | 🟢 Low | ✅ | 1 |
| REQ-GEN-006 | Radiation Therapy Panel | 🟢 Low | ✅ | 2 |
| REQ-GEN-007 | Save As New Dialog | 🟢 Low | ✅ | 1 |
| REQ-GEN-008 | Smart Nth Settings Dialog | 🟢 Low | ✅ | 1 |
| REQ-GEN-009 | User Settings Panel | 🟢 Low | ✅ | 2 |
| REQ-GEN-010 | V4 Aurora Panels V2 | 🟢 Low | 🔧 | - |
| REQ-GEN-011 | Canvas Preview | 🟢 Low | 🔧 | - |
| REQ-GEN-012 | Metadata Edit Dialog | 🟢 Low | ✅ | 1 |
| REQ-GEN-013 | Accordion | 🟢 Low | 🔧 | - |
| REQ-GEN-014 | Alert Dialog | 🟢 Low | ✅ | 1 |
| REQ-GEN-015 | Alert | 🟢 Low | 🔧 | - |
| REQ-GEN-016 | Aspect Ratio | 🟢 Low | ✅ | 19 |
| REQ-GEN-017 | Avatar | 🟢 Low | 🔧 | - |
| REQ-GEN-018 | Badge | 🟢 Low | 🔧 | - |
| REQ-GEN-019 | Breadcrumb | 🟢 Low | 🔧 | - |
| REQ-GEN-020 | Button | 🟢 Low | 🔧 | - |
| REQ-GEN-021 | Calendar | 🟢 Low | 🔧 | - |
| REQ-GEN-022 | Card | 🟢 Low | 🔧 | - |
| REQ-GEN-023 | Carousel | 🟢 Low | 🔧 | - |
| REQ-GEN-024 | Chart | 🟢 Low | 🔧 | - |
| REQ-GEN-025 | Checkbox | 🟢 Low | 🔧 | - |
| REQ-GEN-026 | Collapsible | 🟢 Low | 🔧 | - |
| REQ-GEN-027 | Color Picker | 🟢 Low | 🔧 | - |
| REQ-GEN-028 | Command | 🟢 Low | 🔧 | - |
| REQ-GEN-029 | Context Menu | 🟢 Low | ✅ | 2 |
| REQ-GEN-030 | Dialog | 🟢 Low | ✅ | 1 |
| REQ-GEN-031 | Drawer | 🟢 Low | 🔧 | - |
| REQ-GEN-032 | Dropdown Menu | 🟢 Low | ✅ | 2 |
| REQ-GEN-033 | Form | 🟢 Low | ✅ | 1 |
| REQ-GEN-034 | Hover Card | 🟢 Low | 🔧 | - |
| REQ-GEN-035 | Input Otp | 🟢 Low | 🔧 | - |
| REQ-GEN-036 | Input | 🟢 Low | 🔧 | - |
| REQ-GEN-037 | Label | 🟢 Low | ✅ | 1 |
| REQ-GEN-038 | Menubar | 🟢 Low | 🔧 | - |
| REQ-GEN-039 | Navigation Menu | 🟢 Low | ✅ | 2 |
| REQ-GEN-040 | Pagination | 🟢 Low | 🔧 | - |
| REQ-GEN-041 | Popover | 🟢 Low | 🔧 | - |
| REQ-GEN-042 | Progress | 🟢 Low | ✅ | 1 |
| REQ-GEN-043 | Radio Group | 🟢 Low | 🔧 | - |
| REQ-GEN-044 | Resizable | 🟢 Low | 🔧 | - |
| REQ-GEN-045 | Scroll Area | 🟢 Low | ✅ | 1 |
| REQ-GEN-046 | Select | 🟢 Low | 🔧 | - |
| REQ-GEN-047 | Separator | 🟢 Low | 🔧 | - |
| REQ-GEN-048 | Sheet | 🟢 Low | 🔧 | - |
| REQ-GEN-049 | Sidebar | 🟢 Low | 🔧 | - |
| REQ-GEN-050 | Skeleton | 🟢 Low | 🔧 | - |
| REQ-GEN-051 | Slider | 🟢 Low | 🔧 | - |
| REQ-GEN-052 | Switch | 🟢 Low | 🔧 | - |
| REQ-GEN-053 | Table | 🟢 Low | 🔧 | - |
| REQ-GEN-054 | Tabs | 🟢 Low | 🔧 | - |
| REQ-GEN-055 | Textarea | 🟢 Low | 🔧 | - |
| REQ-GEN-056 | Toast | 🟢 Low | 🔧 | - |
| REQ-GEN-057 | Toaster | 🟢 Low | 🔧 | - |
| REQ-GEN-058 | Toggle Group | 🟢 Low | ✅ | 1 |
| REQ-GEN-059 | Toggle | 🟢 Low | ✅ | 1 |
| REQ-GEN-060 | Tooltip | 🟢 Low | 🔧 | - |
| REQ-GEN-061 | Coordinate Transforms.test | 🟢 Low | ✅ | 1 |
| REQ-GEN-062 | Dice Coefficient.test | 🟢 Low | ✅ | 1 |
| REQ-GEN-063 | Polygon Utils.test | 🟢 Low | ✅ | 4 |
| REQ-GEN-064 | Window Level.test | 🟢 Low | ✅ | 1 |
| REQ-GEN-065 | Background Loader | 🟢 Low | ✅ | 2 |
| REQ-GEN-066 | Beam Overlay Renderer | 🟢 Low | ✅ | 8 |
| REQ-GEN-067 | Bev Renderer | 🟢 Low | 🔧 | - |
| REQ-GEN-068 | Index | 🟢 Low | ✅ | 1 |
| REQ-GEN-069 | Clipper Adapter | 🟢 Low | 🔧 | - |
| REQ-GEN-070 | Console Logger | 🟢 Low | 🔧 | - |
| REQ-GEN-071 | Coordinate Transformer V2 | 🟢 Low | ✅ | 1 |
| REQ-GEN-072 | Cornerstone Config | 🟢 Low | ✅ | 3 |
| REQ-GEN-073 | Cornerstone3d Adapter | 🟢 Low | 🔧 | - |
| REQ-GEN-074 | Dice Utils | 🟢 Low | ✅ | 5 |
| REQ-GEN-075 | Fast Polar Interpolation | 🟢 Low | 🔧 | - |
| REQ-GEN-076 | BEVRenderer | 🟢 Low | 🔧 | - |
| REQ-GEN-077 | IEC61217 | 🟢 Low | 🔧 | - |
| REQ-GEN-078 | MLCModels | 🟢 Low | 🔧 | - |
| REQ-GEN-079 | Matrix4 | 🟢 Low | 🔧 | - |
| REQ-GEN-080 | Vector3 | 🟢 Low | 🔧 | - |
| REQ-GEN-081 | Index | 🟢 Low | ✅ | 1 |
| REQ-GEN-082 | Image Load Pool Manager | 🟢 Low | ✅ | 4 |
| REQ-GEN-083 | Log | 🟢 Low | ✅ | 1 |
| REQ-GEN-084 | Medical Pixel Spacing | 🟢 Low | 🔧 | - |
| REQ-GEN-085 | Mlc Models | 🟢 Low | 🔧 | - |
| REQ-GEN-086 | Pills | 🟢 Low | 🔧 | - |
| REQ-GEN-087 | Polygon Engine | 🟢 Low | ✅ | 1 |
| REQ-GEN-088 | Polygon Operations V2 | 🟢 Low | ✅ | 1 |
| REQ-GEN-089 | Polygon Union | 🟢 Low | ✅ | 1 |
| REQ-GEN-090 | Polygon Utils | 🟢 Low | ✅ | 4 |
| REQ-GEN-091 | Query Client | 🟢 Low | 🔧 | - |
| REQ-GEN-092 | Rt Coordinate Transforms | 🟢 Low | ✅ | 1 |
| REQ-GEN-093 | Sdt Interpolation | 🟢 Low | 🔧 | - |
| REQ-GEN-094 | Simple Polygon Operations | 🟢 Low | ✅ | 1 |
| REQ-GEN-095 | Smooth Ripple Animation | 🟢 Low | 🔧 | - |
| REQ-GEN-096 | Structure Set V2 | 🟢 Low | 🔧 | - |
| REQ-GEN-097 | Tool State Manager | 🟢 Low | ✅ | 3 |
| REQ-GEN-098 | Undo System | 🟢 Low | 🔧 | - |
| REQ-GEN-099 | Utils | 🟢 Low | ✅ | 4 |
| REQ-GEN-100 | Nninteractive Api API | 🟢 Low | 🔧 | - |
| REQ-GEN-101 | Regulatory Api API | 🟢 Low | 🔧 | - |
| REQ-GEN-102 | Routes API | 🟢 Low | 🔧 | - |
| REQ-GEN-103 | Superseg Api API | 🟢 Low | 🔧 | - |

### Image Fusion

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-FUSION-001 | Flexible Fusion Layout | 🟡 Medium | 🔧 | - |
| REQ-FUSION-002 | Fusion Control Panel V2 | 🟡 Medium | ✅ | 2 |
| REQ-FUSION-003 | Fusion Control Panel | 🟡 Medium | ✅ | 2 |
| REQ-FUSION-004 | Fusion Debug Dialog | 🟡 Medium | ✅ | 1 |
| REQ-FUSION-005 | Fusion Panel | 🟡 Medium | ✅ | 2 |
| REQ-FUSION-006 | Fusion Viewport Grid | 🟡 Medium | ✅ | 6 |
| REQ-FUSION-007 | Smart Fusion Viewport Manager | 🟡 Medium | ✅ | 6 |
| REQ-FUSION-008 | Unified Fusion Layout Toolbar V2 | 🟡 Medium | ✅ | 1 |
| REQ-FUSION-009 | Unified Fusion Topbar | 🟡 Medium | 🔧 | - |
| REQ-FUSION-010 | Fusion Layout Service | 🟡 Medium | ✅ | 1 |
| REQ-FUSION-011 | Fusion Overlay Manager | 🟡 Medium | ✅ | 8 |
| REQ-FUSION-012 | Fusion Utils | 🟡 Medium | ✅ | 4 |
| REQ-FUSION-013 | Global Fusion Cache | 🟡 Medium | 🔧 | - |

### Image Viewing

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-VIEW-001 | Advanced Viewport Layout | 🟢 Low | 🔧 | - |
| REQ-VIEW-002 | Multi Viewport | 🟢 Low | ✅ | 7 |
| REQ-VIEW-003 | Sonnet Viewport Manager | 🟢 Low | ✅ | 6 |
| REQ-VIEW-004 | Unified Viewport Switcher | 🟢 Low | ✅ | 6 |
| REQ-VIEW-005 | Viewer Interface | 🟢 Low | 🔧 | - |
| REQ-VIEW-006 | Viewer Toolbar | 🟢 Low | ✅ | 1 |
| REQ-VIEW-007 | Viewport Action Bar | 🟢 Low | ✅ | 6 |
| REQ-VIEW-008 | Viewport Action Corners | 🟢 Low | ✅ | 8 |
| REQ-VIEW-009 | Viewport Orientation Markers | 🟢 Low | ✅ | 7 |
| REQ-VIEW-010 | Viewport Overlay | 🟢 Low | ✅ | 14 |
| REQ-VIEW-011 | Viewport Pane Ohif | 🟢 Low | ✅ | 8 |
| REQ-VIEW-012 | Working Viewer | 🟢 Low | 🔧 | - |
| REQ-VIEW-013 | Primary Viewport | 🟢 Low | 🔧 | - |
| REQ-VIEW-014 | Gpu Viewport Manager | 🟢 Low | ✅ | 6 |
| REQ-VIEW-015 | Viewport Grid Service | 🟢 Low | ✅ | 7 |
| REQ-VIEW-016 | Viewport Scroll Sync | 🟢 Low | ✅ | 7 |

### Margin Operations

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-MARGIN-001 | Advanced Margin Tool | 🟡 Medium | ✅ | 3 |
| REQ-MARGIN-002 | Margin Operation Panel | 🟡 Medium | ✅ | 2 |
| REQ-MARGIN-003 | Margin Subtract Panel | 🟡 Medium | ✅ | 2 |
| REQ-MARGIN-004 | Margin Toolbar | 🟡 Medium | ✅ | 1 |

### Measurements

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-MEAS-001 | Measurement Tool | 🟡 Medium | ✅ | 6 |

### Multi-Planar Reconstruction

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-MPR-001 | Mpr Floating | 🟢 Low | 🔧 | - |

### Patient Management

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-PATIENT-001 | Patient Preview Card | 🟢 Low | ✅ | 1 |
| REQ-PATIENT-002 | Patient Card | 🟢 Low | ✅ | 1 |

### RT Dose Display

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-RTDOSE-001 | Rt Dose Overlay | 🔴 High | ✅ | 8 |
| REQ-RTDOSE-002 | Rt Dose Manager | 🔴 High | 🔧 | - |
| REQ-RTDOSE-003 | Rt Dose Api API | 🔴 High | 🔧 | - |

### RT Plan Display

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-RTPLAN-001 | Rt Plan Panel | 🔴 High | ✅ | 3 |
| REQ-RTPLAN-002 | Rt Plan Validation.test | 🔴 High | ✅ | 1 |
| REQ-RTPLAN-003 | Rt Plan Api API | 🔴 High | ✅ | 1 |

### RT Structure Display

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-RTSTRUCT-001 | Rt Structure Compare Dialog | 🟡 Medium | ✅ | 1 |
| REQ-RTSTRUCT-002 | Rt Structure History Modal | 🟡 Medium | ✅ | 1 |
| REQ-RTSTRUCT-003 | Rt Structure Merge Dialog | 🟡 Medium | ✅ | 1 |
| REQ-RTSTRUCT-004 | Rt Structure Overlay | 🟡 Medium | ✅ | 8 |

### Series Management

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-SERIES-001 | Series Selector | 🟢 Low | 🔧 | - |
| REQ-SERIES-002 | Global Series Cache | 🟢 Low | 🔧 | - |

### Structure Management

| ID | Title | Risk | Status | Tests |
|----|-------|------|--------|-------|
| REQ-STRUCT-001 | Superstructure Manager | 🟡 Medium | 🔧 | - |
| REQ-STRUCT-002 | Blob Management Dialog | 🟡 Medium | ✅ | 1 |
| REQ-STRUCT-003 | Structure Blob List | 🟡 Medium | ✅ | 1 |
| REQ-STRUCT-004 | Blob Operations | 🟡 Medium | 🔧 | - |

## Detailed Requirements

### REQ-AI-001: Prediction Overlay

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** Prediction Overlay Component

**Source:** `client/src/components/dicom/prediction-overlay.tsx`

**Status:** verified

**Verification:** DataOverlayMenu.spec.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, MultipleSegmentationDataOverlays.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts

**Created:** 2025-12-22 | **Modified:** 2025-12-22

---

### REQ-AI-002: Block Matching Prediction

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** Block Matching (Optical Flow) Prediction Engine

**Source:** `client/src/lib/block-matching-prediction.ts`

**Status:** implemented

**Created:** 2025-12-04 | **Modified:** 2025-12-12

---

### REQ-AI-003: Fast Slice Prediction

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** Simple Shape-Based Contour Prediction

**Source:** `client/src/lib/fast-slice-prediction.ts`

**Status:** verified

**Verification:** toggleVOISliceSync.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-18

---

### REQ-AI-004: Image Aware Prediction

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** Image-Aware Prediction Refinement

**Source:** `client/src/lib/image-aware-prediction.ts`

**Status:** verified

**Verification:** getViewportOrientationFromImageOrientationPatient.test.ts, areAllImageDimensionsEqual.test.ts

**Created:** 2025-11-20 | **Modified:** 2025-12-19

---

### REQ-AI-005: Prediction History Manager

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** Prediction History Manager

**Source:** `client/src/lib/prediction-history-manager.ts`

**Status:** implemented

**Created:** 2025-10-15 | **Modified:** 2025-12-18

---

### REQ-AI-006: Robust Slice Prediction

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** First-Principles Shape & Pattern Prediction

**Source:** `client/src/lib/robust-slice-prediction.ts`

**Status:** verified

**Verification:** toggleVOISliceSync.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-AI-007: Sam Controller

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** SAM (Segment Anything Model) Controller

**Source:** `client/src/lib/sam-controller.ts`

**Status:** implemented

**Created:** 2025-12-13 | **Modified:** 2026-01-20

---

### REQ-AI-008: Sam Server Client

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** SAM Server Client - Server-side Segment Anything Model

**Source:** `client/src/lib/sam-server-client.ts`

**Status:** implemented

**Created:** 2026-01-20 | **Modified:** 2026-01-20

---

### REQ-AI-009: Mem3d Api API

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** Server-side API for ai segmentation operations

**Source:** `server/mem3d-api.ts`

**Status:** implemented

**Created:** 2025-10-23 | **Modified:** 2025-10-23

---

### REQ-AI-010: Segvol Api API

**Category:** AI Segmentation

**Risk Classification:** high

**Description:** Server-side API for ai segmentation operations

**Source:** `server/segvol-api.ts`

**Status:** implemented

**Created:** 2025-10-23 | **Modified:** 2025-12-12

---

### REQ-BOOL-001: Boolean Panel

**Category:** Boolean Operations

**Risk Classification:** medium

**Description:** Provides Boolean Panel functionality

**Source:** `client/src/components/dicom/BooleanPanel.tsx`

**Status:** implemented

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-BOOL-002: Boolean Operations Toolbar New

**Category:** Boolean Operations

**Risk Classification:** medium

**Description:** Template interface for saved operations

**Source:** `client/src/components/dicom/boolean-operations-toolbar-new.tsx`

**Status:** verified

**Verification:** useToolbar.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-03

---

### REQ-BOOL-003: Clipper Boolean Operations

**Category:** Boolean Operations

**Risk Classification:** medium

**Description:** Comprehensive boolean operations for medical contours using js-angusj-clipper

**Source:** `client/src/lib/clipper-boolean-operations.ts`

**Status:** implemented

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-CONTOUR-001: Contour Edit Panel

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Provides Contour Edit Panel functionality

**Source:** `client/src/components/dicom/contour-edit-panel.tsx`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts, MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-002: Contour Edit Toolbar

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Contour Edit Toolbar - V4 Aurora Edition

**Source:** `client/src/components/dicom/contour-edit-toolbar.tsx`

**Status:** verified

**Verification:** useToolbar.test.ts, ContourSegLocking.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-CONTOUR-003: Eclipse Pen Tool

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Eclipse TPS-style Pen Tool Implementation

**Source:** `client/src/components/dicom/eclipse-pen-tool.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2026-01-21 | **Modified:** 2026-01-21

---

### REQ-CONTOUR-004: Eclipse Planar Contour Tool

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Eclipse TPS Draw Planar Contour Tool Implementation

**Source:** `client/src/components/dicom/eclipse-planar-contour-tool.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, ContourSegLocking.spec.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2026-01-21 | **Modified:** 2026-01-21

---

### REQ-CONTOUR-005: Ghost Contour Overlay

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** GhostContourOverlay - Renders ghost contours from other viewports

**Source:** `client/src/components/dicom/ghost-contour-overlay.tsx`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts, DataOverlayMenu.spec.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, MultipleSegmentationDataOverlays.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts

**Created:** 2026-01-21 | **Modified:** 2026-01-21

---

### REQ-CONTOUR-006: Pen Tool Unified V2

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Unique viewport ID for cross-viewport ghost contour sync

**Source:** `client/src/components/dicom/pen-tool-unified-v2.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2026-01-21 | **Modified:** 2026-01-21

---

### REQ-CONTOUR-007: Pen Tool V2

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Helper function to check if two polygons intersect

**Source:** `client/src/components/dicom/pen-tool-v2.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-CONTOUR-008: Pen Tool

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Update overlay canvas size

**Source:** `client/src/components/dicom/pen-tool.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-009: Simple Brush Tool

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Check if a canvas point is inside a predicted contour

**Source:** `client/src/components/dicom/simple-brush-tool.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2025-12-30 | **Modified:** 2026-01-20

---

### REQ-CONTOUR-010: Brush To Polygon

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Create a perfect circle polygon at the given center with exact radius

**Source:** `client/src/lib/brush-to-polygon.ts`

**Status:** verified

**Verification:** polygon-utils.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-CONTOUR-011: Contour Boolean Operations

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Simple/naive boolean operations for medical imaging contours

**Source:** `client/src/lib/contour-boolean-operations.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-012: Contour Directional Grow

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Directional contour grow/shrink operations for medical imaging

**Source:** `client/src/lib/contour-directional-grow.ts`

**Status:** verified

**Verification:** Bidirectional.spec.ts, ContourSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-013: Contour Grow

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Contour Growing Algorithm for Medical Imaging

**Source:** `client/src/lib/contour-grow.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-014: Contour Interpolation

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Contour interpolation utilities matching Eclipse TPS behavior.

**Source:** `client/src/lib/contour-interpolation.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-015: Contour Polish

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Medical-grade contour polishing utilities for smooth brush edges

**Source:** `client/src/lib/contour-polish.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-016: Contour Prediction

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Next Slice Prediction Algorithm for Medical Imaging Contours

**Source:** `client/src/lib/contour-prediction.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-12-04 | **Modified:** 2026-01-20

---

### REQ-CONTOUR-017: Contour Smooth Simple

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Simple contour smoothing using moving average

**Source:** `client/src/lib/contour-smooth-simple.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-018: Contour V2

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** V2 Professional Contour Class

**Source:** `client/src/lib/contour-v2.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-CONTOUR-019: Mask To Contours

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Convert binary mask to DICOM contour points

**Source:** `client/src/lib/mask-to-contours.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-03

---

### REQ-CONTOUR-020: Simple Contour Prediction

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Improved Contour Prediction with Interpolation and Scaling

**Source:** `client/src/lib/simple-contour-prediction.ts`

**Status:** verified

**Verification:** ContourSegLocking.spec.ts

**Created:** 2025-12-22 | **Modified:** 2026-01-26

---

### REQ-CONTOUR-021: Smart Brush Utils

**Category:** Contour Tools

**Risk Classification:** medium

**Description:** Smart brush utilities for adaptive contouring

**Source:** `client/src/lib/smart-brush-utils.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-12-19

---

### REQ-DICOM-001: Dicom Uploader

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** Step types for the upload process

**Source:** `client/src/components/dicom/dicom-uploader.tsx`

**Status:** verified

**Verification:** dicom-utils.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-12-18

---

### REQ-DICOM-002: Dicom Preview Modal

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** Fetch all images from the series

**Source:** `client/src/components/patient-manager/dicom-preview-modal.tsx`

**Status:** verified

**Verification:** dicom-utils.test.ts, DicomTagBrowser.spec.ts, TMTVModalityUnit.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-DICOM-003: Dicom Thumbnail

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** Fetch the middle image thumbnail from the series

**Source:** `client/src/components/patient-manager/dicom-thumbnail.tsx`

**Status:** verified

**Verification:** dicom-utils.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-12-12

---

### REQ-DICOM-004: Dicom Utils.test

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** DICOM Utilities Unit Tests

**Source:** `client/src/lib/__tests__/dicom-utils.test.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts, DicomTagBrowser.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-DICOM-005: Dicom Coordinates

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** Shared DICOM coordinate transformation utilities

**Source:** `client/src/lib/dicom-coordinates.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-DICOM-006: Dicom Loader

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** Robust DICOM loading without external dependencies

**Source:** `client/src/lib/dicom-loader.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, interleaveCenterLoader.test.ts, nthLoader.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-DICOM-007: Dicom Spatial Helpers

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** DICOM Spatial Helper Utilities

**Source:** `client/src/lib/dicom-spatial-helpers.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-DICOM-008: Dicom Types

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** DICOM types for RT structure operations

**Source:** `client/src/lib/dicom-types.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-DICOM-009: Dicom Utils

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** Helper functions for safe metadata parsing

**Source:** `client/src/lib/dicom-utils.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-DICOM-010: Dicom Worker Manager

**Category:** DICOM Handling

**Risk Classification:** low

**Description:** DICOM Worker Manager

**Source:** `client/src/lib/dicom-worker-manager.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, initWebWorkerProgressHandler.test.ts, DicomTagBrowser.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-DVH-001: Dvh Popup Viewer

**Category:** Dose-Volume Histogram

**Risk Classification:** medium

**Description:** DVH Popup Viewer

**Source:** `client/src/components/dicom/dvh-popup-viewer.tsx`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-DVH-002: Dvh Viewer

**Category:** Dose-Volume Histogram

**Risk Classification:** medium

**Description:** DVH Viewer Component

**Source:** `client/src/components/dicom/dvh-viewer.tsx`

**Status:** implemented

**Created:** 2026-01-14 | **Modified:** 2026-01-26

---

### REQ-DVH-003: Dvh Api API

**Category:** Dose-Volume Histogram

**Risk Classification:** medium

**Description:** Server-side API for dose-volume histogram operations

**Source:** `server/dvh-api.ts`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-FUSION-001: Flexible Fusion Layout

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** FlexibleFusionLayout - Responsive Multi-Viewport Grid System

**Source:** `client/src/components/dicom/flexible-fusion-layout.tsx`

**Status:** implemented

**Created:** 2025-12-12 | **Modified:** 2026-01-26

---

### REQ-FUSION-002: Fusion Control Panel V2

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** Layout preset types for flexible fusion layout

**Source:** `client/src/components/dicom/fusion-control-panel-v2.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-FUSION-003: Fusion Control Panel

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** PT/PET: Use Auto (manifest) settings only

**Source:** `client/src/components/dicom/fusion-control-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-FUSION-004: Fusion Debug Dialog

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** Group by primary series

**Source:** `client/src/components/dicom/fusion-debug-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-FUSION-005: Fusion Panel

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** CT series

**Source:** `client/src/components/dicom/fusion-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-10-03 | **Modified:** 2025-10-03

---

### REQ-FUSION-006: Fusion Viewport Grid

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** Fusion Viewport Grid - HYBRID PROTOTYPE

**Source:** `client/src/components/dicom/fusion-viewport-grid.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-FUSION-007: Smart Fusion Viewport Manager

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** --- Types ---

**Source:** `client/src/components/dicom/smart-fusion-viewport-manager.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-FUSION-008: Unified Fusion Layout Toolbar V2

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** Unified Fusion/Layout Toolbar V2

**Source:** `client/src/components/dicom/unified-fusion-layout-toolbar-v2.tsx`

**Status:** verified

**Verification:** useToolbar.test.ts

**Created:** 2025-12-10 | **Modified:** 2025-12-12

---

### REQ-FUSION-009: Unified Fusion Topbar

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** UnifiedFusionTopbar

**Source:** `client/src/components/dicom/unified-fusion-topbar.tsx`

**Status:** implemented

**Created:** 2025-12-12 | **Modified:** 2026-01-26

---

### REQ-FUSION-010: Fusion Layout Service

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** Fusion Layout Persistence Service

**Source:** `client/src/lib/fusion-layout-service.ts`

**Status:** verified

**Verification:** SegmentationService.test.ts

**Created:** 2025-12-04 | **Modified:** 2025-12-12

---

### REQ-FUSION-011: Fusion Overlay Manager

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** FusionOverlayManager - Clean fusion implementation following OHIF/Cornerstone3D patterns

**Source:** `client/src/lib/fusion-overlay-manager.ts`

**Status:** verified

**Verification:** DataOverlayMenu.spec.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, MultipleSegmentationDataOverlays.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-FUSION-012: Fusion Utils

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** Parallel batch loading for faster secondary scan loading

**Source:** `client/src/lib/fusion-utils.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-FUSION-013: Global Fusion Cache

**Category:** Image Fusion

**Risk Classification:** medium

**Description:** GlobalFusionCache - Shared fusion overlay cache for multi-viewport performance

**Source:** `client/src/lib/global-fusion-cache.ts`

**Status:** implemented

**Created:** 2025-12-30 | **Modified:** 2026-01-26

---

### REQ-GEN-001: Ai Status Panel

**Category:** General

**Risk Classification:** low

**Description:** AI Status Panel

**Source:** `client/src/components/ai-status-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-12-03 | **Modified:** 2026-01-20

---

### REQ-GEN-002: Ai Tumor Tool

**Category:** General

**Risk Classification:** low

**Description:** AI Tumor Tool - Single-Click Segmentation using SAM (Segment Anything Model)

**Source:** `client/src/components/dicom/ai-tumor-tool.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2026-01-21 | **Modified:** 2026-01-21

---

### REQ-GEN-003: Dose Control Panel

**Category:** General

**Risk Classification:** low

**Description:** DoseControlPanel - Modern floating control panel for RT Dose visualization

**Source:** `client/src/components/dicom/dose-control-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-004: Error Modal

**Category:** General

**Risk Classification:** low

**Description:** Provides Error Modal functionality

**Source:** `client/src/components/dicom/error-modal.tsx`

**Status:** verified

**Verification:** TMTVModalityUnit.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-005: Loading Progress

**Category:** General

**Risk Classification:** low

**Description:** You can extend this to pass actual series info

**Source:** `client/src/components/dicom/loading-progress.tsx`

**Status:** verified

**Verification:** initWebWorkerProgressHandler.test.ts

**Created:** 2025-10-22 | **Modified:** 2025-10-22

---

### REQ-GEN-006: Radiation Therapy Panel

**Category:** General

**Risk Classification:** low

**Description:** RadiationTherapyPanel - Combined RT Dose and RT Plan visualization panel

**Source:** `client/src/components/dicom/radiation-therapy-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-007: Save As New Dialog

**Category:** General

**Risk Classification:** low

**Description:** Provides Save As New Dialog functionality

**Source:** `client/src/components/dicom/save-as-new-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-008: Smart Nth Settings Dialog

**Category:** General

**Risk Classification:** low

**Description:** Provides Smart Nth Settings Dialog functionality

**Source:** `client/src/components/dicom/smart-nth-settings-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2025-10-15 | **Modified:** 2025-10-15

---

### REQ-GEN-009: User Settings Panel

**Category:** General

**Risk Classification:** low

**Description:** User Settings Panel

**Source:** `client/src/components/dicom/user-settings-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-12-04 | **Modified:** 2025-12-12

---

### REQ-GEN-010: V4 Aurora Panels V2

**Category:** General

**Risk Classification:** low

**Description:** V4 Aurora Panels V2 Prototype

**Source:** `client/src/components/dicom/v4-aurora-panels-v2.tsx`

**Status:** implemented

**Created:** 2026-01-21 | **Modified:** 2026-01-21

---

### REQ-GEN-011: Canvas Preview

**Category:** General

**Risk Classification:** low

**Description:** Fetch middle image for preview

**Source:** `client/src/components/patient-manager/canvas-preview.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-012: Metadata Edit Dialog

**Category:** General

**Risk Classification:** low

**Description:** Reset patient data when dialog opens

**Source:** `client/src/components/patient-manager/metadata-edit-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2025-10-01 | **Modified:** 2026-01-26

---

### REQ-GEN-013: Accordion

**Category:** General

**Risk Classification:** low

**Description:** Implements Accordion functionality

**Source:** `client/src/components/ui/accordion.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-12-18

---

### REQ-GEN-014: Alert Dialog

**Category:** General

**Risk Classification:** low

**Description:** Implements Alert Dialog functionality

**Source:** `client/src/components/ui/alert-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-015: Alert

**Category:** General

**Risk Classification:** low

**Description:** Implements Alert functionality

**Source:** `client/src/components/ui/alert.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-016: Aspect Ratio

**Category:** General

**Risk Classification:** low

**Description:** Implements Aspect Ratio functionality

**Source:** `client/src/components/ui/aspect-ratio.tsx`

**Status:** verified

**Verification:** hydrationUtils.test.ts, promptHydrationDialog.test.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, RTHydration.spec.ts, RTHydration2.spec.ts, RTHydrationFromMPR.spec.ts, RTHydrationThenMPR.spec.ts, RTNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts, SEGHydration.spec.ts, SEGHydrationFrom3DFourUp.spec.ts, SEGHydrationFromMPR.spec.ts, SEGHydrationThenMPR.spec.ts, SEGNoHydrationThenMPR.spec.ts, SRHydration.spec.ts

**Created:** 2025-10-03 | **Modified:** 2025-10-03

---

### REQ-GEN-017: Avatar

**Category:** General

**Risk Classification:** low

**Description:** Implements Avatar functionality

**Source:** `client/src/components/ui/avatar.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-018: Badge

**Category:** General

**Risk Classification:** low

**Description:** Implements Badge functionality

**Source:** `client/src/components/ui/badge.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-019: Breadcrumb

**Category:** General

**Risk Classification:** low

**Description:** Implements Breadcrumb functionality

**Source:** `client/src/components/ui/breadcrumb.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-020: Button

**Category:** General

**Risk Classification:** low

**Description:** Implements Button functionality

**Source:** `client/src/components/ui/button.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-021: Calendar

**Category:** General

**Risk Classification:** low

**Description:** Implements Calendar functionality

**Source:** `client/src/components/ui/calendar.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-022: Card

**Category:** General

**Risk Classification:** low

**Description:** Implements Card functionality

**Source:** `client/src/components/ui/card.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-023: Carousel

**Category:** General

**Risk Classification:** low

**Description:** Implements Carousel functionality

**Source:** `client/src/components/ui/carousel.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-024: Chart

**Category:** General

**Risk Classification:** low

**Description:** Format: { THEME_NAME: CSS_SELECTOR }

**Source:** `client/src/components/ui/chart.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-025: Checkbox

**Category:** General

**Risk Classification:** low

**Description:** Implements Checkbox functionality

**Source:** `client/src/components/ui/checkbox.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2026-01-26

---

### REQ-GEN-026: Collapsible

**Category:** General

**Risk Classification:** low

**Description:** Implements Collapsible functionality

**Source:** `client/src/components/ui/collapsible.tsx`

**Status:** implemented

**Created:** 2025-10-03 | **Modified:** 2025-10-03

---

### REQ-GEN-027: Color Picker

**Category:** General

**Risk Classification:** low

**Description:** Color Picker Popover Component

**Source:** `client/src/components/ui/color-picker.tsx`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-028: Command

**Category:** General

**Risk Classification:** low

**Description:** Implements Command functionality

**Source:** `client/src/components/ui/command.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-029: Context Menu

**Category:** General

**Risk Classification:** low

**Description:** Implements Context Menu functionality

**Source:** `client/src/components/ui/context-menu.tsx`

**Status:** verified

**Verification:** ContextMenu.spec.ts, DataOverlayMenu.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-030: Dialog

**Category:** General

**Risk Classification:** low

**Description:** Implements Dialog functionality

**Source:** `client/src/components/ui/dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-031: Drawer

**Category:** General

**Risk Classification:** low

**Description:** Implements Drawer functionality

**Source:** `client/src/components/ui/drawer.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-032: Dropdown Menu

**Category:** General

**Risk Classification:** low

**Description:** Implements Dropdown Menu functionality

**Source:** `client/src/components/ui/dropdown-menu.tsx`

**Status:** verified

**Verification:** ContextMenu.spec.ts, DataOverlayMenu.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-033: Form

**Category:** General

**Risk Classification:** low

**Description:** Implements Form functionality

**Source:** `client/src/components/ui/form.tsx`

**Status:** verified

**Verification:** coordinate-transforms.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-034: Hover Card

**Category:** General

**Risk Classification:** low

**Description:** Implements Hover Card functionality

**Source:** `client/src/components/ui/hover-card.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-035: Input Otp

**Category:** General

**Risk Classification:** low

**Description:** Implements Input Otp functionality

**Source:** `client/src/components/ui/input-otp.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-036: Input

**Category:** General

**Risk Classification:** low

**Description:** Implements Input functionality

**Source:** `client/src/components/ui/input.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-037: Label

**Category:** General

**Risk Classification:** low

**Description:** Implements Label functionality

**Source:** `client/src/components/ui/label.tsx`

**Status:** verified

**Verification:** LabelMapSegLocking.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-038: Menubar

**Category:** General

**Risk Classification:** low

**Description:** Implements Menubar functionality

**Source:** `client/src/components/ui/menubar.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-039: Navigation Menu

**Category:** General

**Risk Classification:** low

**Description:** Implements Navigation Menu functionality

**Source:** `client/src/components/ui/navigation-menu.tsx`

**Status:** verified

**Verification:** ContextMenu.spec.ts, DataOverlayMenu.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-040: Pagination

**Category:** General

**Risk Classification:** low

**Description:** Implements Pagination functionality

**Source:** `client/src/components/ui/pagination.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-041: Popover

**Category:** General

**Risk Classification:** low

**Description:** Implements Popover functionality

**Source:** `client/src/components/ui/popover.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-042: Progress

**Category:** General

**Risk Classification:** low

**Description:** Implements Progress functionality

**Source:** `client/src/components/ui/progress.tsx`

**Status:** verified

**Verification:** initWebWorkerProgressHandler.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-043: Radio Group

**Category:** General

**Risk Classification:** low

**Description:** Implements Radio Group functionality

**Source:** `client/src/components/ui/radio-group.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-044: Resizable

**Category:** General

**Risk Classification:** low

**Description:** Implements Resizable functionality

**Source:** `client/src/components/ui/resizable.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-045: Scroll Area

**Category:** General

**Risk Classification:** low

**Description:** Implements Scroll Area functionality

**Source:** `client/src/components/ui/scroll-area.tsx`

**Status:** verified

**Verification:** areAllImageDimensionsEqual.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-046: Select

**Category:** General

**Risk Classification:** low

**Description:** Implements Select functionality

**Source:** `client/src/components/ui/select.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-047: Separator

**Category:** General

**Risk Classification:** low

**Description:** Implements Separator functionality

**Source:** `client/src/components/ui/separator.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-048: Sheet

**Category:** General

**Risk Classification:** low

**Description:** Implements Sheet functionality

**Source:** `client/src/components/ui/sheet.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-049: Sidebar

**Category:** General

**Risk Classification:** low

**Description:** This is the internal state of the sidebar.

**Source:** `client/src/components/ui/sidebar.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-050: Skeleton

**Category:** General

**Risk Classification:** low

**Description:** Implements Skeleton functionality

**Source:** `client/src/components/ui/skeleton.tsx`

**Status:** implemented

**Created:** 2025-10-03 | **Modified:** 2025-10-03

---

### REQ-GEN-051: Slider

**Category:** General

**Risk Classification:** low

**Description:** Implements Slider functionality

**Source:** `client/src/components/ui/slider.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-052: Switch

**Category:** General

**Risk Classification:** low

**Description:** Implements Switch functionality

**Source:** `client/src/components/ui/switch.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-053: Table

**Category:** General

**Risk Classification:** low

**Description:** Implements Table functionality

**Source:** `client/src/components/ui/table.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-054: Tabs

**Category:** General

**Risk Classification:** low

**Description:** Implements Tabs functionality

**Source:** `client/src/components/ui/tabs.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-055: Textarea

**Category:** General

**Risk Classification:** low

**Description:** Implements Textarea functionality

**Source:** `client/src/components/ui/textarea.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-056: Toast

**Category:** General

**Risk Classification:** low

**Description:** Implements Toast functionality

**Source:** `client/src/components/ui/toast.tsx`

**Status:** implemented

**Created:** 2025-10-22 | **Modified:** 2025-10-22

---

### REQ-GEN-057: Toaster

**Category:** General

**Risk Classification:** low

**Description:** Provides Toaster functionality

**Source:** `client/src/components/ui/toaster.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-058: Toggle Group

**Category:** General

**Risk Classification:** low

**Description:** Implements Toggle Group functionality

**Source:** `client/src/components/ui/toggle-group.tsx`

**Status:** verified

**Verification:** toggleVOISliceSync.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-059: Toggle

**Category:** General

**Risk Classification:** low

**Description:** Implements Toggle functionality

**Source:** `client/src/components/ui/toggle.tsx`

**Status:** verified

**Verification:** toggleVOISliceSync.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-060: Tooltip

**Category:** General

**Risk Classification:** low

**Description:** Implements Tooltip functionality

**Source:** `client/src/components/ui/tooltip.tsx`

**Status:** implemented

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-GEN-061: Coordinate Transforms.test

**Category:** General

**Risk Classification:** low

**Description:** Coordinate Transform Unit Tests

**Source:** `client/src/lib/__tests__/coordinate-transforms.test.ts`

**Status:** verified

**Verification:** coordinate-transforms.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-062: Dice Coefficient.test

**Category:** General

**Risk Classification:** low

**Description:** Dice Coefficient Calculation Tests

**Source:** `client/src/lib/__tests__/dice-coefficient.test.ts`

**Status:** verified

**Verification:** dice-coefficient.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-063: Polygon Utils.test

**Category:** General

**Risk Classification:** low

**Description:** Polygon Utilities Unit Tests

**Source:** `client/src/lib/__tests__/polygon-utils.test.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-064: Window Level.test

**Category:** General

**Risk Classification:** low

**Description:** Window/Level and Image Display Unit Tests

**Source:** `client/src/lib/__tests__/window-level.test.ts`

**Status:** verified

**Verification:** window-level.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-065: Background Loader

**Category:** General

**Risk Classification:** low

**Description:** Background Image Loading Service

**Source:** `client/src/lib/background-loader.ts`

**Status:** verified

**Verification:** interleaveCenterLoader.test.ts, nthLoader.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-066: Beam Overlay Renderer

**Category:** General

**Risk Classification:** low

**Description:** Beam Overlay Renderer

**Source:** `client/src/lib/beam-overlay-renderer.ts`

**Status:** verified

**Verification:** DataOverlayMenu.spec.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, MultipleSegmentationDataOverlays.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-067: Bev Renderer

**Category:** General

**Risk Classification:** low

**Description:** BEV (Beam's Eye View) Renderer

**Source:** `client/src/lib/bev/BevRenderer.ts`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-068: Index

**Category:** General

**Risk Classification:** low

**Description:** BEV (Beam's Eye View) Rendering Module

**Source:** `client/src/lib/bev/index.ts`

**Status:** verified

**Verification:** index.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-069: Clipper Adapter

**Category:** General

**Risk Classification:** low

**Description:** Centralized Clipper library adapter

**Source:** `client/src/lib/clipper-adapter.ts`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-070: Console Logger

**Category:** General

**Risk Classification:** low

**Description:** Console Logger - Captures console logs and sends to debug hub

**Source:** `client/src/lib/console-logger.ts`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-071: Coordinate Transformer V2

**Category:** General

**Risk Classification:** low

**Description:** V2 Professional Coordinate Transformer

**Source:** `client/src/lib/coordinate-transformer-v2.ts`

**Status:** verified

**Verification:** coordinate-transforms.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-072: Cornerstone Config

**Category:** General

**Risk Classification:** low

**Description:** Cornerstone.js configuration for DICOM rendering

**Source:** `client/src/lib/cornerstone-config.ts`

**Status:** verified

**Verification:** getCornerstoneBlendMode.test.ts, getCornerstoneOrientation.test.ts, getCornerstoneViewportType.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-073: Cornerstone3d Adapter

**Category:** General

**Risk Classification:** low

**Description:** Cornerstone3D Adapter Layer

**Source:** `client/src/lib/cornerstone3d-adapter.ts`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-12-12

---

### REQ-GEN-074: Dice Utils

**Category:** General

**Risk Classification:** low

**Description:** polygon-clipping format

**Source:** `client/src/lib/dice-utils.ts`

**Status:** verified

**Verification:** dice-coefficient.test.ts, dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-075: Fast Polar Interpolation

**Category:** General

**Risk Classification:** low

**Description:** Fast Arc-Length Interpolation for Contours

**Source:** `client/src/lib/fast-polar-interpolation.ts`

**Status:** implemented

**Created:** 2025-10-15 | **Modified:** 2025-12-18

---

### REQ-GEN-076: BEVRenderer

**Category:** General

**Risk Classification:** low

**Description:** BEV (Beam's Eye View) Renderer

**Source:** `client/src/lib/geometry/BEVRenderer.ts`

**Status:** implemented

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-077: IEC61217

**Category:** General

**Risk Classification:** low

**Description:** IEC 61217 Coordinate System Transformations

**Source:** `client/src/lib/geometry/IEC61217.ts`

**Status:** implemented

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-078: MLCModels

**Category:** General

**Risk Classification:** low

**Description:** MLC (Multi-Leaf Collimator) Model Definitions

**Source:** `client/src/lib/geometry/MLCModels.ts`

**Status:** implemented

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-079: Matrix4

**Category:** General

**Risk Classification:** low

**Description:** Matrix4 - 4x4 Transformation Matrix for RT Plan geometry

**Source:** `client/src/lib/geometry/Matrix4.ts`

**Status:** implemented

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-080: Vector3

**Category:** General

**Risk Classification:** low

**Description:** Vector3 - 3D Vector class for RT Plan geometry calculations

**Source:** `client/src/lib/geometry/Vector3.ts`

**Status:** implemented

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-081: Index

**Category:** General

**Risk Classification:** low

**Description:** Geometry Library for RT Plan Visualization

**Source:** `client/src/lib/geometry/index.ts`

**Status:** verified

**Verification:** index.test.ts

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-082: Image Load Pool Manager

**Category:** General

**Risk Classification:** low

**Description:** ImageLoadPoolManager - OHIF-style Image Loading Priority Queue

**Source:** `client/src/lib/image-load-pool-manager.ts`

**Status:** verified

**Verification:** getViewportOrientationFromImageOrientationPatient.test.ts, interleaveCenterLoader.test.ts, nthLoader.test.ts, areAllImageDimensionsEqual.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-083: Log

**Category:** General

**Risk Classification:** low

**Description:** Provides Log functionality

**Source:** `client/src/lib/log.ts`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-084: Medical Pixel Spacing

**Category:** General

**Risk Classification:** low

**Description:** Medical-safe pixel spacing extraction and validation

**Source:** `client/src/lib/medical-pixel-spacing.ts`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-085: Mlc Models

**Category:** General

**Risk Classification:** low

**Description:** MLC Model Definitions

**Source:** `client/src/lib/mlc-models.ts`

**Status:** implemented

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-086: Pills

**Category:** General

**Risk Classification:** low

**Description:** More subdued fill + brighter border for readability on dark backgrounds

**Source:** `client/src/lib/pills.ts`

**Status:** implemented

**Created:** 2025-12-14 | **Modified:** 2026-01-26

---

### REQ-GEN-087: Polygon Engine

**Category:** General

**Risk Classification:** low

**Description:** PolygonEngine - Comprehensive 2D polygon operations for RT structure manipulation

**Source:** `client/src/lib/polygon-engine.ts`

**Status:** verified

**Verification:** polygon-utils.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-03

---

### REQ-GEN-088: Polygon Operations V2

**Category:** General

**Risk Classification:** low

**Description:** V2 Professional Polygon Operations Manager

**Source:** `client/src/lib/polygon-operations-v2.ts`

**Status:** verified

**Verification:** polygon-utils.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-089: Polygon Union

**Category:** General

**Risk Classification:** low

**Description:** Simple polygon union using a grid-based approach

**Source:** `client/src/lib/polygon-union.ts`

**Status:** verified

**Verification:** polygon-utils.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-14

---

### REQ-GEN-090: Polygon Utils

**Category:** General

**Risk Classification:** low

**Description:** Convert RT structure contour points to polygon format

**Source:** `client/src/lib/polygon-utils.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-091: Query Client

**Category:** General

**Risk Classification:** low

**Description:** Provides Get Query Fn functionality

**Source:** `client/src/lib/queryClient.ts`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-092: Rt Coordinate Transforms

**Category:** General

**Risk Classification:** low

**Description:** RT Coordinate Transformation Utilities

**Source:** `client/src/lib/rt-coordinate-transforms.ts`

**Status:** verified

**Verification:** coordinate-transforms.test.ts

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-GEN-093: Sdt Interpolation

**Category:** General

**Risk Classification:** low

**Description:** Compute bounds across polygons with padding in mm

**Source:** `client/src/lib/sdt-interpolation.ts`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-094: Simple Polygon Operations

**Category:** General

**Risk Classification:** low

**Description:** Simple polygon operations using the polygon-clipping library

**Source:** `client/src/lib/simple-polygon-operations.ts`

**Status:** verified

**Verification:** polygon-utils.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-29

---

### REQ-GEN-095: Smooth Ripple Animation

**Category:** General

**Risk Classification:** low

**Description:** Border Glow Animation

**Source:** `client/src/lib/smooth-ripple-animation.ts`

**Status:** implemented

**Created:** 2025-10-14 | **Modified:** 2025-10-14

---

### REQ-GEN-096: Structure Set V2

**Category:** General

**Risk Classification:** low

**Description:** V2 Professional Structure Set Entity

**Source:** `client/src/lib/structure-set-v2.ts`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-GEN-097: Tool State Manager

**Category:** General

**Risk Classification:** low

**Description:** brushSize, etc.

**Source:** `client/src/lib/tool-state-manager.ts`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2025-12-09 | **Modified:** 2025-12-09

---

### REQ-GEN-098: Undo System

**Category:** General

**Risk Classification:** low

**Description:** Completely revamped undo/redo system - reliable and simple

**Source:** `client/src/lib/undo-system.ts`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-099: Utils

**Category:** General

**Risk Classification:** low

**Description:** Provides Cn functionality

**Source:** `client/src/lib/utils.ts`

**Status:** verified

**Verification:** dicom-utils.test.ts, polygon-utils.test.ts, hydrationUtils.test.ts, segmentUtils.test.ts

**Created:** 2025-10-02 | **Modified:** 2025-10-02

---

### REQ-GEN-100: Nninteractive Api API

**Category:** General

**Risk Classification:** low

**Description:** Server-side API for general operations

**Source:** `server/nninteractive-api.ts`

**Status:** implemented

**Created:** 2025-10-25 | **Modified:** 2025-10-25

---

### REQ-GEN-101: Regulatory Api API

**Category:** General

**Risk Classification:** low

**Description:** Server-side API for general operations

**Source:** `server/regulatory-api.ts`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-102: Routes API

**Category:** General

**Risk Classification:** low

**Description:** Server-side API for general operations

**Source:** `server/routes.ts`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-GEN-103: Superseg Api API

**Category:** General

**Risk Classification:** low

**Description:** Server-side API for general operations

**Source:** `server/superseg-api.ts`

**Status:** implemented

**Created:** 2025-12-04 | **Modified:** 2026-01-20

---

### REQ-IMPORT-001: Robust Import

**Category:** Data Import

**Risk Classification:** low

**Description:** Robust DICOM Import Component

**Source:** `client/src/components/dicom/robust-import.tsx`

**Status:** implemented

**Created:** 2025-12-17 | **Modified:** 2025-12-18

---

### REQ-IMPORT-002: Upload Zone

**Category:** Data Import

**Risk Classification:** low

**Description:** Process files in batches to avoid overwhelming the server

**Source:** `client/src/components/dicom/upload-zone.tsx`

**Status:** implemented

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-IMPORT-003: Robust Import Routes API

**Category:** Data Import

**Risk Classification:** low

**Description:** Server-side API for data import operations

**Source:** `server/robust-import-routes.ts`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-MARGIN-001: Advanced Margin Tool

**Category:** Margin Operations

**Risk Classification:** medium

**Description:** mm

**Source:** `client/src/components/dicom/advanced-margin-tool.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, useToolbar.test.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2025-10-01 | **Modified:** 2026-01-26

---

### REQ-MARGIN-002: Margin Operation Panel

**Category:** Margin Operations

**Risk Classification:** medium

**Description:** Margin values

**Source:** `client/src/components/dicom/margin-operation-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-11-20 | **Modified:** 2025-11-20

---

### REQ-MARGIN-003: Margin Subtract Panel

**Category:** Margin Operations

**Risk Classification:** medium

**Description:** MarginSubtractPanel - Clinical PTV Generation Tool

**Source:** `client/src/components/dicom/margin-subtract-panel.tsx`

**Status:** verified

**Verification:** MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-03

---

### REQ-MARGIN-004: Margin Toolbar

**Category:** Margin Operations

**Risk Classification:** medium

**Description:** Show settings by default

**Source:** `client/src/components/dicom/margin-toolbar.tsx`

**Status:** verified

**Verification:** useToolbar.test.ts

**Created:** 2025-12-03 | **Modified:** 2026-01-26

---

### REQ-MEAS-001: Measurement Tool

**Category:** Measurements

**Risk Classification:** medium

**Description:** Clean up overlay when not active

**Source:** `client/src/components/dicom/measurement-tool.tsx`

**Status:** verified

**Verification:** findNearbyToolData.test.ts, isMeasurementWithinViewport.test.ts, useToolbar.test.ts, JumpToMeasurementMPR.spec.ts, MeasurementPanel.spec.ts, SEGDrawingToolsResizing.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-MPR-001: Mpr Floating

**Category:** Multi-Planar Reconstruction

**Risk Classification:** low

**Description:** Coronal: X axis = Columns. Fixed Row (sliceIndex).

**Source:** `client/src/components/dicom/mpr-floating.tsx`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-PATIENT-001: Patient Preview Card

**Category:** Patient Management

**Risk Classification:** low

**Description:** Provides Patient Preview Card functionality

**Source:** `client/src/components/dicom/patient-preview-card.tsx`

**Status:** verified

**Verification:** getViewportOrientationFromImageOrientationPatient.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-12-12

---

### REQ-PATIENT-002: Patient Card

**Category:** Patient Management

**Risk Classification:** low

**Description:** Delete confirmation dialog states

**Source:** `client/src/components/patient-manager/patient-card.tsx`

**Status:** verified

**Verification:** getViewportOrientationFromImageOrientationPatient.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-12-18

---

### REQ-RTDOSE-001: Rt Dose Overlay

**Category:** RT Dose Display

**Risk Classification:** high

**Description:** RTDoseOverlay - React component for displaying RT Dose overlays

**Source:** `client/src/components/dicom/rt-dose-overlay.tsx`

**Status:** verified

**Verification:** DataOverlayMenu.spec.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, MultipleSegmentationDataOverlays.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts

**Created:** 2025-12-30 | **Modified:** 2026-01-26

---

### REQ-RTDOSE-002: Rt Dose Manager

**Category:** RT Dose Display

**Risk Classification:** high

**Description:** RTDoseManager - Radiotherapy Dose Visualization Manager

**Source:** `client/src/lib/rt-dose-manager.ts`

**Status:** implemented

**Created:** 2025-12-30 | **Modified:** 2026-01-26

---

### REQ-RTDOSE-003: Rt Dose Api API

**Category:** RT Dose Display

**Risk Classification:** high

**Description:** Server-side API for rt dose display operations

**Source:** `server/rt-dose-api.ts`

**Status:** implemented

**Created:** 2025-12-30 | **Modified:** 2026-01-14

---

### REQ-RTPLAN-001: Rt Plan Panel

**Category:** RT Plan Display

**Risk Classification:** high

**Description:** RT Plan Panel - Beam visualization and BEV (Beam's Eye View)

**Source:** `client/src/components/dicom/rt-plan-panel.tsx`

**Status:** verified

**Verification:** rt-plan-validation.test.ts, MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-RTPLAN-002: Rt Plan Validation.test

**Category:** RT Plan Display

**Risk Classification:** high

**Description:** RT Plan Validation Tests

**Source:** `client/src/lib/__tests__/rt-plan-validation.test.ts`

**Status:** verified

**Verification:** rt-plan-validation.test.ts

**Created:** 2026-01-22 | **Modified:** 2026-01-22

---

### REQ-RTPLAN-003: Rt Plan Api API

**Category:** RT Plan Display

**Risk Classification:** high

**Description:** Server-side API for rt plan display operations

**Source:** `server/rt-plan-api.ts`

**Status:** verified

**Verification:** rt-plan-validation.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-RTSTRUCT-001: Rt Structure Compare Dialog

**Category:** RT Structure Display

**Risk Classification:** medium

**Description:** RT Structure Set Comparison Dialog

**Source:** `client/src/components/dicom/rt-structure-compare-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-RTSTRUCT-002: Rt Structure History Modal

**Category:** RT Structure Display

**Risk Classification:** medium

**Description:** Load history when dialog opens

**Source:** `client/src/components/dicom/rt-structure-history-modal.tsx`

**Status:** verified

**Verification:** TMTVModalityUnit.spec.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-RTSTRUCT-003: Rt Structure Merge Dialog

**Category:** RT Structure Display

**Risk Classification:** medium

**Description:** RT Structure Set Merge Dialog

**Source:** `client/src/components/dicom/rt-structure-merge-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-RTSTRUCT-004: Rt Structure Overlay

**Category:** RT Structure Display

**Risk Classification:** medium

**Description:** Marks contours as predictions

**Source:** `client/src/components/dicom/rt-structure-overlay.tsx`

**Status:** verified

**Verification:** DataOverlayMenu.spec.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, MultipleSegmentationDataOverlays.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts

**Created:** 2026-01-21 | **Modified:** 2026-01-21

---

### REQ-SERIES-001: Series Selector

**Category:** Series Management

**Risk Classification:** low

**Description:** Multi-viewport state

**Source:** `client/src/components/dicom/series-selector.tsx`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-SERIES-002: Global Series Cache

**Category:** Series Management

**Risk Classification:** low

**Description:** GlobalSeriesCache - Shared image cache for multi-viewport performance

**Source:** `client/src/lib/global-series-cache.ts`

**Status:** implemented

**Created:** 2025-12-30 | **Modified:** 2026-01-26

---

### REQ-STRUCT-001: Superstructure Manager

**Category:** Structure Management

**Risk Classification:** medium

**Description:** SuperstructureManager Component

**Source:** `client/src/components/dicom/SuperstructureManager.tsx`

**Status:** implemented

**Created:** 2025-12-03 | **Modified:** 2026-01-26

---

### REQ-STRUCT-002: Blob Management Dialog

**Category:** Structure Management

**Risk Classification:** medium

**Description:** Blob Management Dialog - Aurora Edition

**Source:** `client/src/components/dicom/blob-management-dialog.tsx`

**Status:** verified

**Verification:** promptHydrationDialog.test.ts

**Created:** 2025-10-14 | **Modified:** 2025-12-18

---

### REQ-STRUCT-003: Structure Blob List

**Category:** Structure Management

**Risk Classification:** medium

**Description:** Structure Blob List - Expandable blob viewer in sidebar

**Source:** `client/src/components/dicom/structure-blob-list.tsx`

**Status:** verified

**Verification:** Worklist.spec.ts

**Created:** 2025-10-14 | **Modified:** 2025-10-14

---

### REQ-STRUCT-004: Blob Operations

**Category:** Structure Management

**Risk Classification:** medium

**Description:** Blob Operations Library

**Source:** `client/src/lib/blob-operations.ts`

**Status:** implemented

**Created:** 2025-10-14 | **Modified:** 2025-10-22

---

### REQ-VIEW-001: Advanced Viewport Layout

**Category:** Image Viewing

**Risk Classification:** low

**Description:** AdvancedViewportLayout - Multi-Viewport Layout Engine

**Source:** `client/src/components/dicom/AdvancedViewportLayout.tsx`

**Status:** implemented

**Created:** 2025-12-09 | **Modified:** 2026-01-26

---

### REQ-VIEW-002: Multi Viewport

**Category:** Image Viewing

**Risk Classification:** low

**Description:** Multi-viewport component for displaying multiple DICOM viewports in a grid

**Source:** `client/src/components/dicom/multi-viewport.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts, MultipleSegmentationDataOverlays.spec.ts

**Created:** 2025-10-01 | **Modified:** 2025-12-12

---

### REQ-VIEW-003: Sonnet Viewport Manager

**Category:** Image Viewing

**Risk Classification:** low

**Description:** SONNET: Smart Orchestrated Navigation Network for Enhanced Tomography

**Source:** `client/src/components/dicom/sonnet-viewport-manager.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-12-03 | **Modified:** 2025-12-12

---

### REQ-VIEW-004: Unified Viewport Switcher

**Category:** Image Viewing

**Risk Classification:** low

**Description:** Unified Viewport Mode Switcher

**Source:** `client/src/components/dicom/unified-viewport-switcher.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-12-09 | **Modified:** 2025-12-12

---

### REQ-VIEW-005: Viewer Interface

**Category:** Image Viewing

**Risk Classification:** low

**Description:** TypeScript declaration for cornerstone

**Source:** `client/src/components/dicom/viewer-interface.tsx`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-VIEW-006: Viewer Toolbar

**Category:** Image Viewing

**Risk Classification:** low

**Description:** ViewerToolbar - V4 Aurora Edition

**Source:** `client/src/components/dicom/viewer-toolbar.tsx`

**Status:** verified

**Verification:** useToolbar.test.ts

**Created:** 2025-12-03 | **Modified:** 2026-01-20

---

### REQ-VIEW-007: Viewport Action Bar

**Category:** Image Viewing

**Risk Classification:** low

**Description:** ViewportActionBar - OHIF-style individual viewport topbar controls

**Source:** `client/src/components/dicom/viewport-action-bar.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-12-09 | **Modified:** 2025-12-12

---

### REQ-VIEW-008: Viewport Action Corners

**Category:** Image Viewing

**Risk Classification:** low

**Description:** ViewportActionCorners - Compound component for positioning UI elements

**Source:** `client/src/components/dicom/viewport-action-corners.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneBlendMode.test.ts, getCornerstoneOrientation.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-12-09 | **Modified:** 2025-12-12

---

### REQ-VIEW-009: Viewport Orientation Markers

**Category:** Image Viewing

**Risk Classification:** low

**Description:** ViewportOrientationMarkers - OHIF-style anatomical orientation markers

**Source:** `client/src/components/dicom/viewport-orientation-markers.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneOrientation.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-12-09 | **Modified:** 2025-12-10

---

### REQ-VIEW-010: Viewport Overlay

**Category:** Image Viewing

**Risk Classification:** low

**Description:** ViewportOverlay - OHIF-style overlay for displaying viewport metadata

**Source:** `client/src/components/dicom/viewport-overlay.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts, DataOverlayMenu.spec.ts, MPRThenRTOverlayNoHydration.spec.ts, MPRThenSEGOverlayNoHydration.spec.ts, MultipleSegmentationDataOverlays.spec.ts, RTDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, RTDataOverlayNoHydrationThenMPR.spec.ts, SEGDataOverlayForUnreferencedDisplaySetNoHydration.spec.ts, SEGDataOverlayNoHydrationThenMPR.spec.ts

**Created:** 2025-12-09 | **Modified:** 2025-12-11

---

### REQ-VIEW-011: Viewport Pane Ohif

**Category:** Image Viewing

**Risk Classification:** low

**Description:** ViewportPaneOHIF - OHIF-style viewport pane with action corners and overlays

**Source:** `client/src/components/dicom/viewport-pane-ohif.tsx`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts, MeasurementPanel.spec.ts, SegmentationPanel.spec.ts

**Created:** 2025-12-09 | **Modified:** 2026-01-26

---

### REQ-VIEW-012: Working Viewer

**Category:** Image Viewing

**Risk Classification:** low

**Description:** Unique viewport ID for cross-viewport ghost contour synchronization

**Source:** `client/src/components/dicom/working-viewer.tsx`

**Status:** implemented

**Created:** 2026-01-26 | **Modified:** 2026-01-26

---

### REQ-VIEW-013: Primary Viewport

**Category:** Image Viewing

**Risk Classification:** low

**Description:** PrimaryViewport Component

**Source:** `client/src/components/viewer/PrimaryViewport.tsx`

**Status:** implemented

**Created:** 2025-10-02 | **Modified:** 2025-10-02

---

### REQ-VIEW-014: Gpu Viewport Manager

**Category:** Image Viewing

**Risk Classification:** low

**Description:** GPU Viewport Manager - OHIF-style Cornerstone3D integration

**Source:** `client/src/lib/gpu-viewport-manager.ts`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-10-01

---

### REQ-VIEW-015: Viewport Grid Service

**Category:** Image Viewing

**Risk Classification:** low

**Description:** Set a predefined layout with optional initial series

**Source:** `client/src/lib/viewport-grid-service.ts`

**Status:** verified

**Verification:** SegmentationService.test.ts, getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts

**Created:** 2025-10-01 | **Modified:** 2025-12-12

---

### REQ-VIEW-016: Viewport Scroll Sync

**Category:** Image Viewing

**Risk Classification:** low

**Description:** ViewportScrollSync - Ref-based scroll synchronization for multi-viewport

**Source:** `client/src/lib/viewport-scroll-sync.ts`

**Status:** verified

**Verification:** getActiveViewportEnabledElement.test.ts, getCornerstoneViewportType.test.ts, getViewportEnabledElement.test.ts, getViewportOrientationFromImageOrientationPatient.test.ts, isMeasurementWithinViewport.test.ts, removeViewportSegmentationRepresentations.test.ts, toggleVOISliceSync.test.ts

**Created:** 2025-12-19 | **Modified:** 2026-01-26

---

## Legend

- 🔴 **High Risk**: Features that directly affect clinical decisions or patient safety
- 🟡 **Medium Risk**: Features that modify or transform medical data
- 🟢 **Low Risk**: Display-only features with no data modification
- ✅ **Verified**: Has associated test coverage
- 🔧 **Implemented**: Code complete, tests pending
- ⏳ **Pending**: Not yet implemented
