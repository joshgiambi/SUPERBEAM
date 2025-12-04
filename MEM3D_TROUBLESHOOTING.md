# Mem3D Prediction Troubleshooting Guide

## Quick Checks

### 1. Is the Mem3D Python service running?

The Mem3D service needs to be running separately on port 5002.

**Check if it's running:**
```bash
curl http://127.0.0.1:5002/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cuda",
  "memory_size": 0
}
```

**If not running, start it:**
```bash
cd server/mem3d
python3 mem3d_service.py --port 5002 --device cuda
```

Or use CPU if no GPU:
```bash
python3 mem3d_service.py --port 5002 --device cpu
```

### 2. Check browser console for errors

Open DevTools (F12) → Console tab

**Look for these log messages:**

✅ **Working:**
```
🧠 Mem3D request: 4 reference slices, target shape: 512x512, has real pixel data: true
🧠 Mem3D response: method=mem3d_fallback, confidence=0.75, mask length=262144
🧠 Mem3D contour: 128 points
```

❌ **Not working:**
```
🧠 Mem3D API error: fetch failed
// OR
🧠 Mem3D API error: Mem3D prediction timed out
// OR
🧠 Mem3D request: 4 reference slices, target shape: 512x512, has real pixel data: false
```

### 3. Check server logs

**Look for:**

✅ **Working:**
```
📊 Reference slice 50.0: shape=(512, 512), pixel_range=[-1024.0, 3071.0], pixel_mean=45.3, mask_sum=15234
🎯 Target slice 55.0: shape=(512, 512), pixel_range=[-1024.0, 3071.0], pixel_mean=47.5
```

❌ **Not working:**
```
📊 Reference slice 50.0: shape=(512, 512), pixel_range=[0.0, 0.0], pixel_mean=0.0, mask_sum=15234
```

## Common Issues

### Issue 1: "Mem3D prediction failed" - Service not running

**Symptom:** Browser shows fetch/network error

**Solution:**
1. Start the Mem3D service (see Quick Check #1)
2. Verify it's accessible: `curl http://127.0.0.1:5002/health`
3. Check firewall isn't blocking port 5002

### Issue 2: "Prediction failing" - Pixel data is zeros

**Symptom:** Server logs show `pixel_range=[0.0, 0.0]`

**Root cause:** DICOM images don't have pixel data loaded

**Solution:**
1. Ensure DICOM files are properly loaded
2. Check that `img.pixelData` exists in working-viewer
3. Add debug log:
   ```typescript
   console.log('Image pixel data available:', !!images[currentIndex]?.pixelData);
   ```

### Issue 3: Empty predictions returned

**Symptom:** `🧠 Mem3D contour: 0 points`

**Possible causes:**
1. **Mem3D returned empty mask** - All zeros
   - Check reference slices have valid masks (non-empty contours)
   - Ensure at least 1 reference slice

2. **maskToContour failed** - Couldn't extract contour from mask
   - Mask might be too small
   - Mask might have no positive pixels

**Debug:**
```typescript
// Add after line 708 in contour-prediction.ts
console.log('🧠 Mask stats:', {
  length: result.predicted_mask.length,
  sum: result.predicted_mask.reduce((a, b) => a + b, 0),
  max: Math.max(...result.predicted_mask)
});
```

### Issue 4: Timeout errors

**Symptom:** "Mem3D prediction timed out"

**Causes:**
1. Python service is slow (CPU mode)
2. Large images (>512x512)
3. Network issues

**Solutions:**
1. Use GPU mode if available
2. Increase timeout in `mem3d-client.ts`:
   ```typescript
   constructor(baseUrl: string = '/api', timeout: number = 60000) // 60s
   ```
3. Resize images before sending

### Issue 5: Prediction mode not set to Mem3D

**Symptom:** No Mem3D logs at all

**Check:**
1. Contour toolbar → Enable prediction toggle
2. Prediction mode dropdown → Select "Mem3D" or "Smart"
3. Browser console should show: `Prediction mode: mem3d`

## Verification Steps

### Test 1: Service Health

```bash
# Terminal 1: Start Mem3D service
cd server/mem3d
python3 mem3d_service.py

# Terminal 2: Test health
curl http://127.0.0.1:5002/health
```

### Test 2: API Endpoint

```bash
# Check Node.js proxy is working
curl http://localhost:5173/api/mem3d/health
```

### Test 3: Full Prediction Flow

1. Load a DICOM series in the viewer
2. Select a structure
3. Draw contours on 2-3 slices
4. Enable prediction (toggle in toolbar)
5. Set mode to "Mem3D"
6. Navigate to an empty slice
7. Check console logs

### Expected Flow:

```
1. User draws contour on slice 50
2. User navigates to empty slice 52.5
3. Browser: 🧠 Mem3D request: 1 reference slices...
4. Server: 📊 Reference slice 50.0: pixel_range=[-1024.0, 3071.0]...
5. Server: 🎯 Target slice 52.5: pixel_range=[-1024.0, 3071.0]
6. Browser: 🧠 Mem3D response: confidence=0.75...
7. Browser: 🧠 Mem3D contour: 128 points
8. Viewer: Prediction overlay appears
```

## Environment Variables

Set in `.env` or server config:

```bash
# Mem3D service URL
MEM3D_SERVICE_URL=http://127.0.0.1:5002

# Timeout for predictions (ms)
MEM3D_TIMEOUT=30000
```

## Fallback Behavior

Mem3D has a fallback system:

1. **Try Mem3D service** - If running, uses AI model
2. **Fallback to geometric** - If service unavailable, uses shape interpolation
3. **Return empty** - If everything fails

The fallback is automatic and transparent to the user.

## Debug Mode

Enable verbose logging in `contour-prediction.ts`:

```typescript
// At top of mem3dPrediction function
console.log('🧠 Mem3D DEBUG:', {
  hasImageData: !!imageData,
  hasCurrentSlice: !!imageData?.currentSlice,
  hasTargetSlice: !!imageData?.targetSlice,
  hasReferenceSlices: !!imageData?.referenceSlices,
  referenceSliceCount: imageData?.referenceSlices?.length || 0,
  historySize: historyManager.size(),
  currentSlicePosition,
  targetSlicePosition
});
```

## Still Not Working?

1. **Check Python dependencies:**
   ```bash
   pip install flask flask-cors numpy opencv-python torch
   ```

2. **Check port conflicts:**
   ```bash
   lsof -i :5002
   ```

3. **Check server routes.ts:**
   ```bash
   grep -n "mem3dRouter" server/routes.ts
   # Should show: app.use('/api', mem3dRouter);
   ```

4. **Test with curl:**
   ```bash
   curl -X POST http://localhost:5173/api/mem3d/predict \
     -H "Content-Type: application/json" \
     -d '{
       "reference_slices": [],
       "target_slice_data": [],
       "target_slice_position": 50.0,
       "image_shape": [512, 512]
     }'
   ```

## Getting Help

When reporting issues, provide:

1. Browser console logs (with 🧠 emoji)
2. Server/Python service logs
3. Screenshot of contour toolbar (showing prediction mode)
4. Output of health check: `curl http://127.0.0.1:5002/health`
5. Node.js version: `node --version`
6. Python version: `python3 --version`
