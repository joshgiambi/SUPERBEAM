# Next Slice Prediction System - Architecture Documentation

## Overview

The next slice prediction system predicts contours on adjacent slices based on previously drawn contours. It supports multiple prediction algorithms ranging from fast geometric methods to AI-powered neural networks.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  (contour-edit-toolbar.tsx, working-viewer.tsx)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Prediction Orchestration Layer                 │
│              (contour-prediction.ts)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Simple   │  │ Adaptive │  │ Trend-   │  │ Fast     │  │
│  │          │  │          │  │ Based    │  │ Raycast  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │
│  ┌──────────┐  ┌──────────┐                                │
│  │ SegVol   │  │ MONAI    │  (Backend Services)           │
│  │          │  │          │                                │
│  └──────────┘  └──────────┘                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Support Libraries                              │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │ History Manager  │  │ Image-Aware      │              │
│  │ (track trends)  │  │ Refinement       │              │
│  └──────────────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Prediction Modes

### 1. Client-Side Geometric Modes (No Setup Required)

#### Fast Mode (`'fast'` → `'adaptive'`)
- **Type**: Geometric shape interpolation
- **Speed**: ~10-15ms
- **Accuracy**: 70-75%
- **Requirements**: None (works without pixel data)
- **Implementation**: `adaptivePrediction()` in `contour-prediction.ts`
- **Best For**: Quick predictions when you need speed over accuracy
- **Algorithm**: 
  - Finds nearest contour as reference
  - Calculates area change rate and centroid drift
  - Applies radial profile interpolation
  - Smooths result

#### Balanced Mode (`'balanced'` → `'trend-based'` or `'adaptive'`)
- **Type**: Multi-slice trend analysis
- **Speed**: ~15ms
- **Accuracy**: 75-80% (with history), 70-75% (fallback)
- **Requirements**: 2+ contours in history for trend-based, otherwise falls back to adaptive
- **Implementation**: `trendBasedPrediction()` or `adaptivePrediction()` fallback
- **Best For**: Most common use case - good balance of speed and accuracy
- **Algorithm**:
  - Uses `PredictionHistoryManager` to track last 5 contours
  - Analyzes trends: area change, centroid drift, shape stability
  - Extrapolates trends to target slice
  - Falls back to adaptive if insufficient history

#### Fast Raycast Mode (`'fast-raycast'` - previously `'mem3d'`)
- **Type**: Intensity-based ray casting (client-side)
- **Speed**: ~50ms
- **Accuracy**: 70-75%
- **Requirements**: Pixel data (HU values) + coordinate transforms
- **Implementation**: `fastSlicePrediction()` in `fast-slice-prediction.ts`
- **Best For**: When you have pixel data and want image-aware predictions without backend services
- **Algorithm**:
  - Builds radial profile from reference contour
  - Learns intensity characteristics (median, std dev)
  - Ray-casts 72 rays from centroid to find boundaries
  - Uses HU range matching and gradient detection
  - Applies multi-pass smoothing
- **Note**: This is **NOT** the backend Mem3D service - it's a client-side implementation using similar ray-casting principles

### 2. Backend AI Services (Require Setup)

#### SegVol Mode (`'segvol'`)
- **Type**: AI neural network (SAM-based volumetric segmentation)
- **Speed**: ~500-2000ms
- **Accuracy**: 83-85%
- **Requirements**: 
  - SegVol service running on port 5001
  - Pixel data + coordinate transforms
  - GPU recommended (CPU supported)
- **Implementation**: `segvolPrediction()` → `segvolClient.predictNextSlice()`
- **Backend**: `server/segvol/segvol_service.py`
- **Best For**: Highest accuracy needed, complex anatomy
- **Features**:
  - Universal medical image segmentation
  - Works on any organ/structure
  - Supports volume context (32-48 slices)
  - Auto-fallback to geometric if service unavailable

#### MONAI Mode (`'monai'`)
- **Type**: AI neural network (MONAI UNet with morphology fallback)
- **Speed**: ~450-900ms
- **Accuracy**: ~75% (higher with custom weights)
- **Requirements**:
  - MONAI service running on port 5005
  - Pixel data + coordinate transforms
  - CPU-friendly (GPU optional)
- **Implementation**: `monaiPrediction()` → `monaiClient.predict()`
- **Backend**: `server/monai/monai_service.py`
- **Best For**: A/B testing against SegVol, CPU-only environments
- **Status**: Beta

## Code Organization

### Core Files

#### `client/src/lib/contour-prediction.ts`
- **Main orchestration function**: `predictNextSliceContour()`
- **Geometric algorithms**: `simplePrediction()`, `adaptivePrediction()`, `trendBasedPrediction()`
- **AI integration**: `segvolPrediction()`, `monaiPrediction()`, `mem3dPrediction()` (client-side)
- **Mode routing**: Switch statement maps UI modes to algorithm modes

#### `client/src/lib/fast-slice-prediction.ts`
- **Function**: `fastSlicePrediction()`
- **Purpose**: Client-side intensity-based ray casting
- **Algorithm**: Ray casting with HU intensity matching
- **Used by**: `mem3dPrediction()` wrapper in contour-prediction.ts

#### `client/src/lib/prediction-history-manager.ts`
- **Class**: `PredictionHistoryManager`
- **Purpose**: Tracks contour evolution across slices
- **Features**: 
  - Stores last 5 contours with shape descriptors
  - Calculates trends (area change, centroid drift, stability)
  - Confidence scoring with exponential decay

#### `client/src/lib/image-aware-prediction.ts`
- **Function**: `refineContourWithImageData()`
- **Purpose**: Refines geometric predictions using pixel data
- **Features**:
  - Edge detection (Sobel operator)
  - Edge snapping (±10px search radius)
  - Tissue similarity validation
  - Histogram comparison

### Client-Side API Clients

#### `client/src/lib/segvol-client.ts`
- **Class**: `SegVolClient`
- **Purpose**: Frontend wrapper for SegVol backend
- **Methods**: `checkHealth()`, `predictNextSlice()`, `predictBatch()`

#### `client/src/lib/monai-client.ts`
- **Class**: `MonaiClient`
- **Purpose**: Frontend wrapper for MONAI backend
- **Methods**: `checkHealth()`, `predict()`

### UI Components

#### `client/src/components/dicom/contour-edit-toolbar.tsx`
- **Purpose**: UI controls for prediction mode selection
- **Features**:
  - Prediction toggle (✨ sparkles button)
  - Mode dropdown (Fast, Balanced, SegVol, MONAI, Fast Raycast)
  - Accept/Reject buttons
  - MEM3D tuning panel (for Fast Raycast mode)

#### `client/src/components/dicom/working-viewer.tsx`
- **Purpose**: Main viewer component that generates predictions
- **Key function**: `generatePredictionForCurrentSlice()`
- **Responsibilities**:
  - Extracts image data and coordinates
  - Manages prediction history
  - Maps UI modes to algorithm modes
  - Renders predictions via `PredictionOverlay`

#### `client/src/components/dicom/prediction-overlay.tsx`
- **Purpose**: Visual rendering of predictions
- **Features**:
  - Animated dashed borders
  - Confidence labels
  - Glow effects
  - Color-coded by confidence

## Mode Selection Logic

### UI Mode → Algorithm Mode Mapping

```
UI Mode          →  Algorithm Mode        →  Implementation
────────────────────────────────────────────────────────────
'fast'          →  'adaptive'           →  adaptivePrediction()
'balanced'      →  'trend-based'        →  trendBasedPrediction() 
                                    (if history ≥ 2)
                                    OR
                                    →  adaptivePrediction()
                                    (fallback)
'fast-raycast'  →  'fast-raycast'       →  mem3dPrediction() 
                                           →  fastSlicePrediction()
'segvol'        →  'segvol'             →  segvolPrediction()
                                           →  segvolClient
'monai'         →  'monai'              →  monaiPrediction()
                                           →  monaiClient
```

### Selection Flow

```typescript
// In working-viewer.tsx generatePredictionForCurrentSlice()
1. Get UI mode from brushToolState.predictionMode
2. Map UI mode to algorithm mode (see table above)
3. Check requirements (pixel data, service availability)
4. Call predictNextSliceContour() with algorithm mode
5. Apply image refinement (if enabled and not AI mode)
6. Return prediction result
```

## Image Refinement Pipeline

Image refinement enhances geometric predictions using pixel data:

```
Geometric Prediction
        ↓
Edge Detection (Sobel)
        ↓
Edge Snapping (±10px search)
        ↓
Tissue Similarity Validation
        ↓
Combined Confidence Score
        ↓
Refined Contour
```

**When Applied**:
- Enabled by default (`enableImageRefinement: true`)
- **Not applied** to AI modes (SegVol, MONAI, Fast Raycast) - they handle refinement internally
- Requires `imageData.targetSlice` and `coordinateTransforms`

## Performance Characteristics

| Mode | Speed | Accuracy | Setup | Pixel Data | Backend |
|------|-------|----------|-------|------------|---------|
| Fast | ~10ms | 70-75% | None | Optional | None |
| Balanced | ~15ms | 75-80% | None | Optional | None |
| Fast Raycast | ~50ms | 70-75% | None | Required | None |
| SegVol | ~1-2s | 83-85% | Service | Required | Port 5001 |
| MONAI | ~0.8s | ~75% | Service | Required | Port 5005 |

## Decision Tree: Which Mode to Use?

```
Do you need highest accuracy?
│
├─ YES → Do you have SegVol service running?
│        │
│        ├─ YES → Use SegVol (83-85% accuracy)
│        │
│        └─ NO → Use Balanced (75-80% accuracy)
│
└─ NO → Do you need speed?
        │
        ├─ YES → Use Fast (~10ms, 70-75% accuracy)
        │
        └─ NO → Do you have pixel data?
                │
                ├─ YES → Use Fast Raycast (~50ms, 70-75% accuracy)
                │
                └─ NO → Use Balanced (~15ms, 75-80% accuracy)
```

## Setup Requirements

### No Setup (Built-in)
- **Fast**: Works immediately
- **Balanced**: Works immediately
- **Fast Raycast**: Works if pixel data available

### Backend Services

#### SegVol Setup
```bash
cd server/segvol
./setup.sh
./start-service.sh cuda  # or 'cpu'
```
- **Port**: 5001
- **Model**: Auto-downloads from HuggingFace (~700MB)
- **Device**: GPU recommended, CPU supported

#### MONAI Setup
```bash
cd server/monai
./setup.sh
./start-service.sh cpu  # or 'cuda'
```
- **Port**: 5005
- **Status**: Beta
- **Device**: CPU-friendly

## Troubleshooting

### Predictions Not Appearing

1. **Check prediction toggle**: Ensure ✨ sparkles button is enabled (purple)
2. **Check mode**: Verify mode is selected in dropdown
3. **Check console**: Look for error messages
   - `❌ SegVol prediction unavailable: DICOM pixel data not accessible`
   - `❌ MONAI prediction unavailable: DICOM pixel data not accessible`
4. **Verify image data**: Some modes require pixel data
5. **Check service health**: For SegVol/MONAI, verify service is running

### AI Services Not Available

**SegVol**:
```bash
# Check service
curl http://localhost:5001/health

# Start service
cd server/segvol
./start-service.sh cuda
```

**MONAI**:
```bash
# Check service
curl http://localhost:5005/health

# Start service
cd server/monai
./start-service.sh cpu
```

### Low Confidence Predictions

- **Cause**: Large slice gaps or inconsistent contours
- **Solution**: 
  - Draw contours on more slices (reduce gaps)
  - Use Balanced mode for trend analysis
  - Consider SegVol for complex anatomy

### Performance Issues

- **Fast Raycast slow**: Check pixel data extraction performance
- **SegVol slow**: Normal (1-2s expected), consider GPU/CUDA
- **General slowness**: Check browser console for errors

## Known Limitations

1. **Backend Mem3D Service**: Legacy/disabled (STM model had domain mismatch with medical CT)
2. **Fast Raycast naming**: Previously called "MEM3D" in UI - this was misleading (no relation to backend service)
3. **Image refinement**: Not applied to AI modes (they handle it internally)
4. **Volume context**: Only SegVol supports full volume context (32-48 slices)

## Future Enhancements

- [ ] Multi-reference blending (combine predictions from multiple slices)
- [ ] Adaptive tolerance based on slice thickness
- [ ] Visual indicator showing which slice prediction came from
- [ ] Confidence decay visualization as distance increases
- [ ] Batch prediction for multiple slices at once

## Related Documentation

- `PREDICTION_COMPLETE_SUMMARY.md` - Feature implementation summary
- `PREDICTION_FIXES_FINAL.md` - Bug fixes and improvements
- `SMART_CLICK_PREDICTION.md` - User interaction features
- `AI_MODELS_STATUS.md` - AI service status and setup
- `SEGVOL_SETUP.md` - SegVol installation guide
- `MEM3D_SETUP.md` - Mem3D backend setup (legacy)



