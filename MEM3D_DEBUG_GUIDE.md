# Mem3D Prediction Debugging Guide

## Error: "Mem3D prediction failed, falling back to trend-based prediction"

This error means Mem3D returned an empty or invalid prediction. Let's debug it step by step.

## New Debug Logs Added

When you run prediction now, you'll see these console logs:

### 1. Reference Slice Check
```
🧠 Mem3D: No reference slices available, cannot predict
```
**Meaning:** No contours in history → Mem3D can't work
**Fix:** Draw at least 1 contour on a nearby slice first

### 2. Request Info
```
🧠 Mem3D request: 4 reference slices, target shape: 512x512, has real pixel data: true
```
**Check:**
- `reference slices` should be ≥ 1 (ideally 2-3)
- `has real pixel data` should be `true`

### 3. Response Info
```
🧠 Mem3D response: method=mem3d_fallback, confidence=0.75, mask length=262144
```
**Check:**
- `method` could be:
  - `mem3d_memory` - AI model used ✅
  - `mem3d_fallback` - Geometric fallback used ⚠️
  - `mem3d_no_memory` - No references available ❌
- `confidence` should be > 0.2
- `mask length` should equal `height * width` (e.g., 512×512 = 262144)

### 4. Mask Statistics (NEW!)
```
🧠 Mem3D mask stats: sum=15234, range=[0, 1], positive pixels=15234
```
**Check:**
- `sum` should be > 0 (number of positive pixels)
- `range` should be [0, 1] for binary mask
- `positive pixels` should be > 100 (reasonable contour size)

**If sum=0:** Mask is empty → No contour can be extracted ❌

### 5. Final Contour
```
🧠 Mem3D contour: 128 points
```
**Check:**
- Should be ≥ 3 points (minimum for a triangle)
- Typical: 50-300 points

**If 0 points:** maskToContour failed to extract contour from mask ❌

## Common Issues & Solutions

### Issue 1: "No reference slices available"

**Symptom:**
```
🧠 Mem3D: No reference slices available, cannot predict
```

**Cause:** History manager has no contours

**Solution:**
1. Draw contours on at least 1-2 nearby slices first
2. Make sure contours are saved (not predicted/preview)
3. Check that prediction is enabled AFTER drawing

---

### Issue 2: "has real pixel data: false"

**Symptom:**
```
🧠 Mem3D request: ... has real pixel data: false
```

**Cause:** DICOM pixel data not loaded

**Solution:**
1. Check images have pixelData: `console.log(images[0]?.pixelData)`
2. Ensure DICOM files fully loaded before prediction
3. Check extractImageDataForPrediction is working

---

### Issue 3: "mask stats: sum=0"

**Symptom:**
```
🧠 Mem3D mask stats: sum=0, range=[0, 0], positive pixels=0
```

**Cause:** Mem3D returned empty mask (all zeros)

**Possible reasons:**
1. **No memory in service** - Reference slices weren't sent properly
2. **Fallback failed** - Geometric interpolation produced nothing
3. **Service error** - Python service crashed or errored

**Solutions:**

**A. Check service is running:**
```bash
curl http://127.0.0.1:5002/health
```

**B. Check server logs** for:
```
📊 Reference slice 50.0: ... mask_sum=15234
```
If mask_sum=0 in server logs → Reference masks are empty!

**C. Verify reference contours:**
- Make sure you drew REAL contours (not predicted ones)
- Check contours are valid (≥ 3 points)
- Verify they're on nearby slices

---

### Issue 4: "confidence=0.0"

**Symptom:**
```
🧠 Mem3D response: ... confidence=0.0 ...
```

**Cause:** Mem3D has no confidence in prediction

**Why this happens:**
- No reference slices (method=mem3d_no_memory)
- Reference slices too far away
- Mask quality is poor

**Solution:**
1. Draw more reference contours (2-3 nearby slices)
2. Ensure reference slices are within 5-10mm of target
3. Draw higher quality contours (smoother, more accurate)

---

### Issue 5: "Mem3D contour: 0 points"

**Symptom:**
```
🧠 Mem3D mask stats: sum=15234, range=[0, 1], positive pixels=15234
🧠 Mem3D contour: 0 points  ← MASK HAS DATA BUT NO CONTOUR!
```

**Cause:** maskToContour failed to extract contour

**Possible reasons:**
1. **Coordinate transform issue** - World ↔ Pixel conversion broken
2. **Mask too fragmented** - Multiple disconnected regions
3. **Mask on image boundary** - Contour extraction fails at edges

**Debug:**
```typescript
// Add after line 745 in contour-prediction.ts
console.log('🧠 DEBUG: Transform test:', {
  worldToPixel: effectiveTransforms.worldToPixel(100, 100),
  pixelToWorld: effectiveTransforms.pixelToWorld(100, 100)
});
```

Expected: Should show sensible numbers (not NaN, Infinity, or null)

---

## Step-by-Step Debug Workflow

### 1. Verify Service is Running
```bash
# Check health
curl http://127.0.0.1:5002/health

# Should return: {"status": "healthy", "model_loaded": true, ...}
```

### 2. Test Prediction Flow

1. **Load DICOM series**
2. **Select structure** to edit
3. **Draw contours** on 2-3 slices (e.g., slices 50, 55, 60)
4. **Enable prediction** in toolbar
5. **Set mode** to "Mem3D" or "Smart"
6. **Navigate** to empty slice (e.g., slice 52.5)
7. **Open console** (F12) and check logs

### 3. Check Each Log Message

Go through logs in order:

✅ `🧠 Mem3D request:` → Reference slices > 0? Has real pixel data?
✅ `🧠 Mem3D response:` → Confidence > 0? Method not "no_memory"?
✅ `🧠 Mem3D mask stats:` → Sum > 0? Positive pixels > 100?
✅ `🧠 Mem3D contour:` → Points ≥ 3?

**First one that fails** → That's your issue!

### 4. Check Server Logs

Look for Python service logs:
```
📊 Reference slice 50.0: pixel_range=[-1024.0, 3071.0], mask_sum=15234
🎯 Target slice 52.5: pixel_range=[-1024.0, 3071.0]
```

**Check:**
- pixel_range NOT [0.0, 0.0]
- mask_sum > 0

---

## Quick Fixes

### "I'm getting fallback every time"

**Most likely:** Mem3D service not running

```bash
./start-mem3d.sh
```

### "Prediction is empty/zero"

**Most likely:** No reference contours drawn yet

1. Draw real contours on 2-3 slices
2. Make sure they're saved (not predicted)
3. Then try prediction on empty slice

### "It used to work, now it doesn't"

**Most likely:** Service crashed or memory was cleared

1. Restart Mem3D service
2. Reload browser page
3. Redraw some reference contours

---

## Advanced Debugging

### Enable Full Debug Logs

Add to `mem3dPrediction` function (line 599):

```typescript
console.log('🧠 FULL DEBUG:', {
  historySize: historyManager.size(),
  hasImageData: !!imageData,
  hasCurrentSlice: !!imageData?.currentSlice,
  hasTargetSlice: !!imageData?.targetSlice,
  hasReferenceSlices: !!imageData?.referenceSlices,
  imageRows,
  imageCols,
  currentSlicePosition,
  targetSlicePosition
});
```

### Check Image Data Extraction

Add to `working-viewer.tsx` after line 2156:

```typescript
console.log('📷 Image data extracted:', {
  current: !!currentImageData,
  target: !!targetImageData,
  references: referenceSlicesData.length,
  currentHasPixels: !!currentImageData?.pixels,
  targetHasPixels: !!targetImageData?.pixels
});
```

---

## Still Not Working?

1. **Share console logs** - All 🧠 emoji logs
2. **Share server logs** - Python service output
3. **Describe scenario:**
   - How many contours drawn?
   - Which slices?
   - What prediction mode?
   - When does it fail?

4. **Try geometric fallback:**
   - Set mode to "Balanced" instead of "Mem3D"
   - If that works → Mem3D service issue
   - If that also fails → General prediction issue
