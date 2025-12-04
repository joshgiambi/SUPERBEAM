# SegVol Contour Size Debugging Guide

## Issue

SegVol predictions are working but the predicted contours appear **larger than expected**.

## Possible Causes

### 1. **Coordinate Transformation Issue** (Most Likely)
The contours are being converted between world coordinates and pixel coordinates. If there's a scaling error, contours will appear larger or smaller.

**Check:**
- Are pixel coordinates being correctly converted to/from world coordinates?
- Is the pixel spacing being applied correctly?
- Are we using the right image dimensions?

### 2. **Resolution Mismatch**
The model may be operating at a different resolution than expected.

**Check:**
- Input image size vs. output mask size
- SegVol's `spatial_size=(32, 256, 256)` configuration
- Interpolation artifacts

### 3. **Mask Threshold**
The `_mask_to_contour` function uses a threshold of 0.5. If the threshold is too low, it might include more pixels.

**Check:**
- Predicted mask probability distribution
- Effect of different thresholds

## Debug Logging Added

I've added logging to the SegVol service to track:

```python
logger.info(f"📊 Reference mask shape: {ref_mask.shape}, contour points: {len(reference_contour)}")
logger.info(f"📊 Reference slice shape: {ref_slice.shape}")
logger.info(f"📊 Volume tensor shape: {volume_tensor.shape}")
logger.info(f"📊 Output shape: {output.shape}")
logger.info(f"📊 Predicted mask shape: {predicted_mask.shape}, max value: {np.max(predicted_mask):.3f}")
logger.info(f"📊 Predicted contour points: {len(predicted_contour)}, sample: {predicted_contour[:2].tolist()}")
```

## How to Debug

### Step 1: Check Service Logs

```bash
# Watch logs in real-time
tail -f /tmp/segvol-debug.log

# Or check after prediction
cat /tmp/segvol-debug.log | grep "📊"
```

**What to look for:**
- Input/output shapes should match (e.g., both 512×512)
- Contour points should be in reasonable pixel coordinates (0-512 range for 512×512 image)
- Max mask value should be close to 1.0

### Step 2: Check Frontend Logs

In browser console, look for:
```
📊 Pixel data extracted for image X: 262144 pixels
```

This tells you the image resolution (262144 = 512×512)

### Step 3: Compare Input vs Output

**Example good output:**
```
📊 Reference mask shape: (512, 512), contour points: 64
📊 Reference slice shape: (512, 512)
📊 Volume tensor shape: torch.Size([1, 1, 3, 512, 512])
📊 Output shape: torch.Size([1, 1, 3, 512, 512])
📊 Predicted mask shape: (512, 512), max value: 0.954
📊 Predicted contour points: 72, sample: [[245.3, 198.7], [246.1, 199.2]]
```

**Example bad output (resolution mismatch):**
```
📊 Reference mask shape: (512, 512), contour points: 64
📊 Predicted mask shape: (256, 256), max value: 0.892  ← HALF SIZE!
📊 Predicted contour points: 68, sample: [[122.5, 99.3], [123.0, 99.6]]  ← HALF VALUES!
```

## Potential Fixes

### Fix 1: Coordinate Scaling (if resolution matches but contours are wrong size)

If shapes match but contours are too large, the issue is in coordinate transformation:

**Check [contour-prediction.ts:524-527](client/src/lib/contour-prediction.ts#L524-L527):**
```typescript
const [px, py] = coordinateTransforms.worldToPixel(x, y);
contour2D.push([Math.round(px), Math.round(py)]);
```

**And [contour-prediction.ts:546-548](client/src/lib/contour-prediction.ts#L546-L548):**
```typescript
const [x, y] = coordinateTransforms.pixelToWorld(px, py);
predictedContour.push(x, y, targetSlicePosition);
```

The `worldToPixel` and `pixelToWorld` transforms must be inverses of each other.

### Fix 2: Resolution Scaling (if output is different size)

If the output mask is a different size than input, we need to scale contours:

```python
# In _mask_to_contour, after extracting contour:
if predicted_mask.shape != original_shape:
    scale_x = original_shape[1] / predicted_mask.shape[1]
    scale_y = original_shape[0] / predicted_mask.shape[0]
    contour[:, 0] *= scale_x  # Scale x coordinates
    contour[:, 1] *= scale_y  # Scale y coordinates
```

### Fix 3: Adjust Mask Threshold

If predictions are consistently too large, try a higher threshold:

```python
# In _mask_to_contour
def _mask_to_contour(self, mask: np.ndarray, threshold: float = 0.65):  # Increased from 0.5
    ...
```

## Testing Fix

After applying a fix:

1. Restart SegVol service
2. Reload viewer
3. Draw a small contour
4. Navigate to next slice
5. Check if predicted contour matches expected size
6. Compare with geometric prediction (should be similar size)

## Quick Diagnosis Checklist

- [ ] SegVol service logs show matching input/output shapes
- [ ] Contour pixel coordinates are in expected range (0-512 for 512×512)
- [ ] World-to-pixel transform is correct (check `imageMetadata.pixelSpacing`)
- [ ] Pixel-to-world transform is inverse of world-to-pixel
- [ ] Mask threshold (0.5) is appropriate for model output
- [ ] Model output probabilities are in reasonable range (0-1)

## Next Steps

1. **Run a prediction** and check logs
2. **Share the log output** showing the 📊 entries
3. **Compare** reference contour size vs predicted contour size
4. Based on logs, we can identify if it's:
   - Coordinate transformation issue → Fix in frontend
   - Resolution mismatch → Fix in backend
   - Threshold issue → Adjust parameter

---

**SegVol service is running with debug logging enabled. Make a prediction and check `/tmp/segvol-debug.log`!**
