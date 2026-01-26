# Change Control Log

## Document Control Information

| Field | Value |
|-------|-------|
| Document Version | 1.0.0 |
| Generated | 2026-01-26T22:28:19.791Z |
| Total Changes | 36 |
| Branch | perf-fixes-backup-20260122 |
| First Change | 2025-12-04 |
| Last Change | 2026-01-26 |
| Contributors | joshgiambi |

## Change Classification Summary

| Change Type | Count | Description |
|-------------|-------|-------------|
| 📈 Enhancement | 12 | Improvements to existing functionality |
| ✨ Feature | 7 | New functionality implemented |
| ♻️ Refactor | 6 | Code maintenance without functional changes |
| 📝 Docs | 4 | Documentation updates |
| 📦 Other | 4 | Other changes |
| 🔧 Fix | 3 | Defect corrections |

## Changes by Functional Area

| Functional Area | Changes |
|-----------------|---------|
| Infrastructure | 15 |
| DICOM Processing | 13 |
| User Interface | 10 |
| Image Viewing | 7 |
| Performance | 6 |
| Image Fusion | 4 |
| RT Plan | 4 |
| AI Segmentation | 4 |
| Data Management | 3 |
| Boolean Operations | 3 |
| Contour Tools | 3 |
| DVH | 2 |
| RT Structure | 2 |
| RT Dose | 1 |

## Risk Impact Summary

| Risk Level | Count | Verification Required |
|------------|-------|----------------------|
| 🔴 High | 1 | Yes - Full verification |
| 🟡 Medium | 19 | Yes - Standard verification |
| 🟢 Low | 7 | Recommended |
| ⚪ None | 9 | Not required |

## Detailed Change History

### December 2025

| Date | Change ID | Type | Risk | Description | Affected Areas |
|------|-----------|------|------|-------------|----------------|
| 2026-01-26 | `9ea70c6` | 📝 | ⚪ | DOCUMENTATION: Update regulatory documentation for dashboard and viewer enhan... | Image Viewing, User Interface |
| 2026-01-26 | `dfa2f0f` | 📈 | 🟢 | ENHANCEMENT: Enhance regulatory features and UI components [User Interface] | User Interface |
| 2026-01-26 | `13cf025` | ✨ | 🟡 | NEW FEATURE: Add DIR QA tools - Reg Reveal, Reg Refine, Jacobian visualizatio... | Image Fusion |
| 2026-01-26 | `9ae494d` | ✨ | 🟡 | NEW FEATURE: Add rigid and deformable registration capabilities to FuseBox [I... | Image Fusion |
| 2026-01-26 | `79086f9` | ✨ | 🟡 | NEW FEATURE: Add MIM-style parameters and constraint evaluation [DVH, User In... | DVH, User Interface |
| 2026-01-22 | `8f665e9` | 🔧 | 🔴 | DEFECT CORRECTION: Merge RT PLAN PREPARATION BUILD with performance fixes [RT... | RT Plan, Performance |
| 2026-01-22 | `c9c40ed` | 🔧 | 🟡 | DEFECT CORRECTION: Performance optimizations and fusion sync fixes [Image Fus... | Image Fusion, Performance |
| 2026-01-21 | `6c67120` | 📦 | 🟡 | CHANGE: RT PLAN PREPARATION BUILD - Pre-release version for demonstration pur... | RT Plan, Infrastructure |
| 2026-01-21 | `e4eae1b` | 📈 | 🟡 | ENHANCEMENT: Initial implementation AT RT PLAN (Work in progress) - Removed t... | RT Plan, Image Viewing |
| 2026-01-20 | `274419a` | ♻️ | 🟡 | CODE MAINTENANCE: Refactor DVH API and enhance caching mechanisms for improve... | DVH, Performance |
| 2026-01-20 | `fce2ad7` | 📈 | 🟡 | ENHANCEMENT: Update MarginOperationsPrototype to include output color in temp... | Boolean Operations |
| 2026-01-20 | `d0c41b8` | ✨ | 🟢 | NEW FEATURE: Implement logging control and template management enhancements i... | DICOM Processing |
| 2026-01-20 | `c33c816` | 📈 | 🟡 | ENHANCEMENT: Enhance DICOM components with improved superstructure management... | RT Structure, DICOM Processing |
| 2026-01-20 | `61fe7d3` | 📈 | 🟡 | ENHANCEMENT: Enhance DICOM components and SAM integration for multi-point seg... | AI Segmentation, DICOM Processing |
| 2026-01-20 | `8d2a140` | ♻️ | 🟡 | CODE MAINTENANCE: Refactor AI Status Panel and DICOM components for SAM integ... | AI Segmentation, DICOM Processing |
| 2026-01-20 | `67cabf6` | ♻️ | 🟡 | CODE MAINTENANCE: Refactor DICOM components and update SAM integration for en... | AI Segmentation, DICOM Processing |
| 2026-01-19 | `cd39b0b` | ♻️ | 🟡 | CODE MAINTENANCE: Refactor DICOM components for enhanced margin operations an... | DICOM Processing, Boolean Operations |
| 2026-01-19 | `face467` | 📝 | ⚪ | DOCUMENTATION: Update DICOM components and documentation for improved functio... | DICOM Processing |
| 2026-01-14 | `d122e1c` | 📈 | 🟢 | ENHANCEMENT: Enhance DICOM components with responsive design and caching opti... | DICOM Processing, Performance |
| 2026-01-14 | `c11768a` | ✨ | 🟡 | NEW FEATURE: Implement FuseBox functionality for advanced fusion editing [Ima... | Image Fusion, Contour Tools |

### November 2025

| Date | Change ID | Type | Risk | Description | Affected Areas |
|------|-----------|------|------|-------------|----------------|
| 2025-12-19 | `8de8edb` | 📈 | 🟡 | ENHANCEMENT: Enhance DICOM components with RT Dose functionality [RT Dose, DI... | RT Dose, DICOM Processing |
| 2025-12-19 | `9432ca7` | 📈 | ⚪ | ENHANCEMENT: Synchronize slice index updates in ViewerInterface for improved ... | Image Viewing, Infrastructure |
| 2025-12-19 | `b8d065a` | ♻️ | ⚪ | CODE MAINTENANCE: Refactor DICOM components for improved functionality and pe... | DICOM Processing, Performance |
| 2025-12-19 | `09d3087` | 📈 | 🟢 | ENHANCEMENT: Enhance DICOM components with new features and improvements [DIC... | DICOM Processing |
| 2025-12-18 | `ab48312` | 📈 | 🟢 | ENHANCEMENT: Update gitignore to exclude patient data and storage directories... | Data Management |
| 2025-12-18 | `0b6e598` | 📈 | ⚪ | ENHANCEMENT: Enhance global cache and viewport sync files with additional spa... | Image Viewing, Performance |
| 2025-12-18 | `d40adb3` | 📦 | 🟢 | CHANGE: Add robust DICOM import functionality and metadata writer [DICOM Proc... | DICOM Processing |
| 2025-12-17 | `bbe4a88` | 🔧 | 🟡 | DEFECT CORRECTION: Fix coordinate misalignment in smart brush and pen tools [... | Contour Tools |
| 2025-12-17 | `daff8ed` | 📦 | 🟢 | CHANGE: Style Generate buttons with consistent dark backgrounds for better te... | User Interface |
| 2025-12-17 | `679d498` | ✨ | 🟡 | NEW FEATURE: Re-implement contour toolbar improvements: Radix DropdownMenu, D... | RT Structure, Contour Tools |
| 2025-12-15 | `d4f2cae` | ♻️ | 🟡 | CODE MAINTENANCE: Add new SeriesPreview route and update AI Status Panel docu... | AI Segmentation, Image Viewing |
| 2025-12-12 | `ba2122f` | 📝 | ⚪ | DOCUMENTATION: Major prototype improvements for bottom toolbars and multiview... | Image Viewing, User Interface |
| 2025-12-04 | `3030536` | 📈 | ⚪ | ENHANCEMENT: Update environment configuration and scripts for Replit setup; m... | Infrastructure |
| 2025-12-04 | `2b92a27` | 📦 | ⚪ | CHANGE: Integrate B2 test data sync into dev workflow [Infrastructure] | Infrastructure |
| 2025-12-04 | `0b34605` | 📝 | ⚪ | DOCUMENTATION: Add Backblaze B2 test data sync script and documentation [Infr... | Infrastructure |
| 2025-12-04 | `f37115a` | ✨ | 🟡 | NEW FEATURE: Initial commit - SUPERBEAM medical imaging viewer [RT Plan, Imag... | RT Plan, Image Viewing |

## Individual Change Records

*Showing most recent 30 changes with full details*

### Change 9ea70c6

**DOCUMENTATION: Update regulatory documentation for dashboard and viewer enhancements [Image Viewing, User Interface]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-26 |
| Author | joshgiambi |
| Change Type | docs |
| Risk Impact | ⚪ NONE |
| Verification | not-required |
| Affected Areas | Image Viewing, User Interface |
| Related Requirements | REQ-VIEW-*, REQ-UI-* |

### Change dfa2f0f

**ENHANCEMENT: Enhance regulatory features and UI components [User Interface]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-26 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟢 LOW |
| Verification | pending |
| Affected Areas | User Interface |
| Related Requirements | REQ-UI-* |

### Change 13cf025

**NEW FEATURE: Add DIR QA tools - Reg Reveal, Reg Refine, Jacobian visualization [Image Fusion]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-26 |
| Author | joshgiambi |
| Change Type | feature |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | Image Fusion |
| Related Requirements | REQ-FUSION-* |

### Change 9ae494d

**NEW FEATURE: Add rigid and deformable registration capabilities to FuseBox [Image Fusion]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-26 |
| Author | joshgiambi |
| Change Type | feature |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | Image Fusion |
| Related Requirements | REQ-FUSION-* |

### Change 79086f9

**NEW FEATURE: Add MIM-style parameters and constraint evaluation [DVH, User Interface]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-26 |
| Author | joshgiambi |
| Change Type | feature |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | DVH, User Interface |
| Related Requirements | REQ-DVH-*, REQ-UI-* |

### Change 8f665e9

**DEFECT CORRECTION: Merge RT PLAN PREPARATION BUILD with performance fixes [RT Plan, Performance, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-22 |
| Author | joshgiambi |
| Change Type | fix |
| Risk Impact | 🔴 HIGH |
| Verification | pending |
| Affected Areas | RT Plan, Performance, Infrastructure |
| Related Requirements | REQ-RTPLAN-*, REQ-PERF-*, REQ-INFRA-* |

### Change c9c40ed

**DEFECT CORRECTION: Performance optimizations and fusion sync fixes [Image Fusion, Performance, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-22 |
| Author | joshgiambi |
| Change Type | fix |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | Image Fusion, Performance, Infrastructure |
| Related Requirements | REQ-FUSION-*, REQ-PERF-*, REQ-INFRA-* |

### Change 6c67120

**CHANGE: RT PLAN PREPARATION BUILD - Pre-release version for demonstration purposes [RT Plan, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-21 |
| Author | joshgiambi |
| Change Type | other |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | RT Plan, Infrastructure |
| Related Requirements | REQ-RTPLAN-*, REQ-INFRA-* |

### Change e4eae1b

**ENHANCEMENT: Initial implementation AT RT PLAN (Work in progress) - Removed the Prescription Dose section from DoseControlPanel and replaced it with a new RadiationTherapyPanel for combined dose and plan visualization. - Updated ViewerInterface to handle RT Plan series, including state management for selected plans and beams. - Enhanced WorkingViewer to render beam overlays, improving visualization of treatment plans. - Registered new RT Plan API routes in the server for handling plan data. - Adjusted UI components for better responsiveness and user interaction with RT data [RT Plan, Image Viewing, User Interface, Data Management, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-21 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | RT Plan, Image Viewing, User Interface, Data Management, Infrastructure |
| Related Requirements | REQ-RTPLAN-*, REQ-VIEW-*, REQ-UI-*, REQ-DATA-*, REQ-INFRA-* |

### Change 274419a

**CODE MAINTENANCE: Refactor DVH API and enhance caching mechanisms for improved performance [DVH, Performance, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-20 |
| Author | joshgiambi |
| Change Type | refactor |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | DVH, Performance, Infrastructure |
| Related Requirements | REQ-DVH-*, REQ-PERF-*, REQ-INFRA-* |

### Change fce2ad7

**ENHANCEMENT: Update MarginOperationsPrototype to include output color in template management [Boolean Operations]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-20 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | Boolean Operations |
| Related Requirements | REQ-BOOL-* |

### Change d0c41b8

**NEW FEATURE: Implement logging control and template management enhancements in DICOM components [DICOM Processing]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-20 |
| Author | joshgiambi |
| Change Type | feature |
| Risk Impact | 🟢 LOW |
| Verification | pending |
| Affected Areas | DICOM Processing |
| Related Requirements | REQ-DICOM-* |

### Change c33c816

**ENHANCEMENT: Enhance DICOM components with improved superstructure management and margin operations [RT Structure, DICOM Processing, Boolean Operations]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-20 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | RT Structure, DICOM Processing, Boolean Operations |
| Related Requirements | REQ-RTSTRUCT-*, REQ-DICOM-*, REQ-BOOL-* |

### Change 61fe7d3

**ENHANCEMENT: Enhance DICOM components and SAM integration for multi-point segmentation [AI Segmentation, DICOM Processing]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-20 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | AI Segmentation, DICOM Processing |
| Related Requirements | REQ-AI-*, REQ-DICOM-* |

### Change 8d2a140

**CODE MAINTENANCE: Refactor AI Status Panel and DICOM components for SAM integration [AI Segmentation, DICOM Processing, User Interface, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-20 |
| Author | joshgiambi |
| Change Type | refactor |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | AI Segmentation, DICOM Processing, User Interface, Infrastructure |
| Related Requirements | REQ-AI-*, REQ-DICOM-*, REQ-UI-*, REQ-INFRA-* |

### Change 67cabf6

**CODE MAINTENANCE: Refactor DICOM components and update SAM integration for enhanced functionality [AI Segmentation, DICOM Processing, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-20 |
| Author | joshgiambi |
| Change Type | refactor |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | AI Segmentation, DICOM Processing, Infrastructure |
| Related Requirements | REQ-AI-*, REQ-DICOM-*, REQ-INFRA-* |

### Change cd39b0b

**CODE MAINTENANCE: Refactor DICOM components for enhanced margin operations and UI improvements [DICOM Processing, Boolean Operations, User Interface, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-19 |
| Author | joshgiambi |
| Change Type | refactor |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | DICOM Processing, Boolean Operations, User Interface, Infrastructure |
| Related Requirements | REQ-DICOM-*, REQ-BOOL-*, REQ-UI-*, REQ-INFRA-* |

### Change face467

**DOCUMENTATION: Update DICOM components and documentation for improved functionality [DICOM Processing]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-19 |
| Author | joshgiambi |
| Change Type | docs |
| Risk Impact | ⚪ NONE |
| Verification | not-required |
| Affected Areas | DICOM Processing |
| Related Requirements | REQ-DICOM-* |

### Change d122e1c

**ENHANCEMENT: Enhance DICOM components with responsive design and caching optimizations [DICOM Processing, Performance]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-14 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟢 LOW |
| Verification | pending |
| Affected Areas | DICOM Processing, Performance |
| Related Requirements | REQ-DICOM-*, REQ-PERF-* |

### Change c11768a

**NEW FEATURE: Implement FuseBox functionality for advanced fusion editing [Image Fusion, Contour Tools]**

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-14 |
| Author | joshgiambi |
| Change Type | feature |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | Image Fusion, Contour Tools |
| Related Requirements | REQ-FUSION-*, REQ-CONTOUR-* |

### Change 8de8edb

**ENHANCEMENT: Enhance DICOM components with RT Dose functionality [RT Dose, DICOM Processing]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-19 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | RT Dose, DICOM Processing |
| Related Requirements | REQ-RTDOSE-*, REQ-DICOM-* |

### Change 9432ca7

**ENHANCEMENT: Synchronize slice index updates in ViewerInterface for improved side-by-side mode functionality [Image Viewing, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-19 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | ⚪ NONE |
| Verification | not-required |
| Affected Areas | Image Viewing, Infrastructure |
| Related Requirements | REQ-VIEW-*, REQ-INFRA-* |

### Change b8d065a

**CODE MAINTENANCE: Refactor DICOM components for improved functionality and performance [DICOM Processing, Performance, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-19 |
| Author | joshgiambi |
| Change Type | refactor |
| Risk Impact | ⚪ NONE |
| Verification | not-required |
| Affected Areas | DICOM Processing, Performance, Infrastructure |
| Related Requirements | REQ-DICOM-*, REQ-PERF-*, REQ-INFRA-* |

### Change 09d3087

**ENHANCEMENT: Enhance DICOM components with new features and improvements [DICOM Processing]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-19 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟢 LOW |
| Verification | pending |
| Affected Areas | DICOM Processing |
| Related Requirements | REQ-DICOM-* |

### Change ab48312

**ENHANCEMENT: Update gitignore to exclude patient data and storage directories [Data Management]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-18 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | 🟢 LOW |
| Verification | pending |
| Affected Areas | Data Management |
| Related Requirements | REQ-DATA-* |

### Change 0b6e598

**ENHANCEMENT: Enhance global cache and viewport sync files with additional spacing for improved readability [Image Viewing, Performance, Infrastructure]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-18 |
| Author | joshgiambi |
| Change Type | enhancement |
| Risk Impact | ⚪ NONE |
| Verification | not-required |
| Affected Areas | Image Viewing, Performance, Infrastructure |
| Related Requirements | REQ-VIEW-*, REQ-PERF-*, REQ-INFRA-* |

### Change d40adb3

**CHANGE: Add robust DICOM import functionality and metadata writer [DICOM Processing]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-18 |
| Author | joshgiambi |
| Change Type | other |
| Risk Impact | 🟢 LOW |
| Verification | pending |
| Affected Areas | DICOM Processing |
| Related Requirements | REQ-DICOM-* |

### Change bbe4a88

**DEFECT CORRECTION: Fix coordinate misalignment in smart brush and pen tools [Contour Tools]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-17 |
| Author | joshgiambi |
| Change Type | fix |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | Contour Tools |
| Related Requirements | REQ-CONTOUR-* |

### Change daff8ed

**CHANGE: Style Generate buttons with consistent dark backgrounds for better text visibility [User Interface]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-17 |
| Author | joshgiambi |
| Change Type | other |
| Risk Impact | 🟢 LOW |
| Verification | pending |
| Affected Areas | User Interface |
| Related Requirements | REQ-UI-* |

### Change 679d498

**NEW FEATURE: Re-implement contour toolbar improvements: Radix DropdownMenu, Dissect tool, larger sizes, swapped Smooth/Nth, updated Blob labels [RT Structure, Contour Tools, User Interface]**

| Attribute | Value |
|-----------|-------|
| Date | 2025-12-17 |
| Author | joshgiambi |
| Change Type | feature |
| Risk Impact | 🟡 MEDIUM |
| Verification | pending |
| Affected Areas | RT Structure, Contour Tools, User Interface |
| Related Requirements | REQ-RTSTRUCT-*, REQ-CONTOUR-*, REQ-UI-* |

---

## Compliance Notes

This change control log is automatically generated from the version control system 
to provide traceability as required by IEC 62304 and FDA guidance for software 
as a medical device. All changes are tracked and categorized by risk impact.

**Verification Status Legend:**
- `verified` - Change has been tested and validated
- `pending` - Verification testing required
- `not-required` - Low-risk change, verification at discretion
