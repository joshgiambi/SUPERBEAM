# SuperSeg Critical Bugs Fixed

## Problem Summary
The AI model was creating predictions in random locations and sometimes completely outside the brain. Two critical bugs were found:

1. **Resolution Bug**: Model output was at half resolution but treated as full resolution
2. **Normalization Mismatch**: Service was using different normalization than training code

## Bug #1: Resolution Mismatch

### Training Code (Correct)
In `superseg/tumour_seg_POC.py` line 453-481, the inference function correctly:
1. Downsamples input by 0.5x (line 466)
2. Feeds to model at half resolution (line 471)
3. **Upsamples output back to original size** (line 475) ✅

```python
# Resize to half
features = F.interpolate(features, scale_factor=0.5, mode='bilinear', align_corners=False)

# Predict
output = model(features)
output = torch.sigmoid(output)

# Resize back to original  ← CRITICAL STEP
output = F.interpolate(output, size=(H, W), mode='bilinear', align_corners=False)
```

### Service Code (Buggy)
In `server/superseg/superseg_service.py` line 188-194, the service was:
1. Downsampling input by 0.5x (line 185) ✅
2. Feeding to model at half resolution (line 190) ✅
3. **Missing the upsample step!** (line 193-194) ❌

```python
# CRITICAL: Model WAS trained at 0.5x resolution!
features = F.interpolate(features, scale_factor=0.5, mode='bilinear', align_corners=False)

# Predict
output = model(features)
output = torch.sigmoid(output)

# No need to resize - we're already at full resolution  ← WRONG COMMENT!
output = output.squeeze().cpu().numpy()
```

## Impact
This bug caused:
1. **Spatial misalignment**: Predictions were at wrong pixel locations
2. **Missing edema**: The larger edema structure wasn't captured because resolution was too low
3. **Unreliable output**: Predictions were inconsistent and often failed

## Fix Applied
Updated `server/superseg/superseg_service.py` line 193-197 to:

```python
# CRITICAL: Resize output back to original dimensions
# Input was downsampled by 0.5x, so output is at half resolution
# Must upsample back to match original slice dimensions
output = F.interpolate(output, size=(H, W), mode='bilinear', align_corners=False)
output = output.squeeze().cpu().numpy()
```

## How to Test
1. Service is now running with the fix: `curl http://127.0.0.1:5003/health`
2. Click on a tumor in the viewer with the AI Tumor Tool active
3. The model should now reliably predict the full tumor including edema
4. Predictions should be spatially aligned with the click point

## Technical Details
- Model was trained on 0.5x downsampled images (see `tumour_seg_POC.py` line 254-257)
- During inference, we must downsample input to match training, then upsample output back
- The U-Net architecture processes at the downsampled resolution for efficiency
- Final output must be interpolated back to original slice dimensions

## Bug #2: Normalization Mismatch

### Training Code (Correct)
In `superseg/tumour_seg_POC.py` lines 47-53:
```python
def normalize_volume(volume):
    """Normalize a volume to zero mean and unit variance."""
    mean = np.mean(volume)
    std = np.std(volume)
    if std > 0:
        return (volume - mean) / std
    return volume - mean
```
Simple z-score normalization: `(x - mean) / std`

### Service Code (Buggy)
In `server/superseg/superseg_service.py` lines 135-148 (before fix):
```python
def normalize_volume(volume):
    # Percentile clipping to reduce extreme outliers
    lower = np.percentile(volume, 1.0)
    upper = np.percentile(volume, 99.0)
    clipped = np.clip(volume, lower, upper)
    
    mean = np.mean(clipped)
    std = np.std(clipped)
    if std > 0:
        return (clipped - mean) / std
    return clipped - mean
```
**Wrong!** Percentile clipping before normalization completely changes the pixel value distribution.

### Impact
The percentile clipping caused:
1. **Wrong pixel value ranges**: Model expects different statistical distribution
2. **Spatial mislocalization**: Model activates on wrong image features
3. **Out-of-brain predictions**: Model detects artifacts instead of tumors
4. **Random prediction locations**: Different normalization creates unpredictable responses

### Fix Applied
Removed percentile clipping to match training code exactly:
```python
def normalize_volume(volume):
    """Normalize a volume to zero mean and unit variance.
    
    CRITICAL: Must match training normalization exactly.
    No percentile clipping - just simple z-score normalization.
    """
    mean = np.mean(volume)
    std = np.std(volume)
    if std > 0:
        return (volume - mean) / std
    return volume - mean
```

## Root Cause Analysis
Both bugs stemmed from **incorrect assumptions** when implementing the service:
1. Assumption that output upsampling wasn't needed (wrong comment in code)
2. Assumption that percentile clipping would improve robustness (not done in training)

The cardinal rule: **Inference code must EXACTLY match training preprocessing pipeline.**

## Date Fixed
October 29, 2025

## Status
✅ **BOTH BUGS FIXED** - Service restarted with both corrections applied

