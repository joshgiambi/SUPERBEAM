# Viewer Components Audit

## Overview

There are two separate `working-viewer.tsx` components in the codebase:

1. **Active Component**: `client/src/components/dicom/working-viewer.tsx` (7977 lines)
2. **Features Component**: `client/src/features/viewer/components/working-viewer.tsx` (7353 lines)

## Active Component

**Path**: `client/src/components/dicom/working-viewer.tsx`

**Used By**:
- `client/src/components/dicom/viewer-interface.tsx` (imports from `./working-viewer`)
- `client/src/components/dicom/multi-viewport.tsx` (imports from `./working-viewer`)

**Status**: ✅ **ACTIVE** - This is the main viewer component currently in use

**Features**:
- Full prediction system integration
- PredictionHistoryManager support
- All prediction modes (Fast, Balanced, SegVol, MONAI, Fast Raycast)
- Image-aware refinement
- Modern implementation

## Features Component

**Path**: `client/src/features/viewer/components/working-viewer.tsx`

**Used By**:
- `client/src/features/viewer/components/viewer-interface.tsx` (imports from `./working-viewer`)

**Status**: ⚠️ **POTENTIALLY LEGACY** - May be unused or alternative implementation

**Issues Found**:
- Line 2694: Hardcoded `predictionMode: 'simple'` - uses basic prediction only
- Missing: PredictionHistoryManager integration
- Missing: Advanced prediction mode support
- Simpler implementation overall

**Differences**:
- Uses hardcoded `'simple'` prediction mode instead of configurable modes
- Does not have full prediction system integration
- Missing prediction mode dropdown support
- Simpler prediction logic

## Recommendation

### Option 1: Verify Usage (Recommended First Step)

Check if `features/viewer/components/viewer-interface.tsx` is actually used:

```bash
# Check if features/viewer is imported anywhere
grep -r "features/viewer" client/src
```

If `features/viewer` is NOT imported in `pages/viewer.tsx` or `App.tsx`, then:
- **Action**: Mark as legacy/unused
- **Status**: Safe to ignore or document as alternative implementation

### Option 2: If Used, Consolidate

If `features/viewer` IS actively used:
- **Action**: Update it to use the same prediction system as the active component
- **Changes Needed**:
  1. Replace hardcoded `'simple'` mode with configurable mode
  2. Add PredictionHistoryManager support
  3. Add full prediction mode support
  4. Sync prediction logic with active component

### Option 3: Remove Legacy Code

If `features/viewer` is NOT used:
- **Action**: Consider removing or moving to `unused/` directory
- **Before Removal**: Verify no routes or imports reference it

## Current State Summary

| Component | Lines | Status | Prediction Modes | History Manager |
|-----------|-------|--------|------------------|-----------------|
| `components/dicom/working-viewer.tsx` | 7977 | ✅ Active | All modes | ✅ Yes |
| `features/viewer/components/working-viewer.tsx` | 7353 | ⚠️ Legacy? | Simple only | ❌ No |

## Next Steps

1. ✅ **Completed**: Documented differences
2. ⏳ **Pending**: Verify actual usage of `features/viewer` components
3. ⏳ **Pending**: Decide on consolidation or removal based on usage

## Notes

- The active component (`components/dicom/working-viewer.tsx`) is the one referenced in the main viewer interface
- The features component appears to be an older implementation with limited prediction support
- Both components share similar structure but differ in prediction system integration









