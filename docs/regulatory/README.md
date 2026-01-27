# Regulatory Documentation Package

## CONVERGE Medical Imaging Viewer

**Generated:** 2026-01-27T22:12:15.818Z

---

## Document Index

| Document | Description | Status |
|----------|-------------|--------|
| [SRS.md](./SRS.md) | Software Requirements Specification | ✅ Generated |
| [CHANGE_CONTROL.md](./CHANGE_CONTROL.md) | Change Control Log | ✅ Generated |
| [TRACEABILITY_MATRIX.md](./TRACEABILITY_MATRIX.md) | Requirements Traceability | ✅ Generated |
| [VERIFICATION_SUMMARY.md](./VERIFICATION_SUMMARY.md) | Test Coverage Report | ✅ Generated |

## Data Files

| File | Description |
|------|-------------|
| [requirements.json](./requirements.json) | Machine-readable requirements database |
| [change-control.json](./change-control.json) | Machine-readable change history |
| [traceability.json](./traceability.json) | Machine-readable traceability data |

---

## Intended Use Statement

CONVERGE Medical Imaging Viewer is intended to display medical imaging data 
including DICOM CT, MR, PET images, RT Structure Sets, RT Dose distributions, 
and RT Plans for review by qualified healthcare professionals.

## Regulatory Classification

This software is intended to be classified as a **Class II Medical Device** 
under FDA 21 CFR 892.2050 (Picture archiving and communications system) 
requiring 510(k) premarket notification.

## Quality Management

This documentation is automatically generated from the codebase to ensure 
accuracy and traceability. The generation scripts are located in 
`scripts/regulatory/` and can be run at any time to update documentation.

### Regenerating Documentation

```bash
npx tsx scripts/regulatory/run-all.ts
```

---

*This is a living document. Last updated: 1/27/2026, 4:12:15 PM*
