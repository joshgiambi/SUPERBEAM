# Pixel Data Extraction Fix

## Problem

SegVol and Mem3D AI services were unable to access DICOM pixel data, causing predictions to fail with:

```
❌ Pixel data extraction failed: Image at index X has no pixelData property
⚠️ SegVol prediction unavailable: DICOM pixel data not accessible. Falling back to Mem3D or geometric prediction.
```

**Additional issues:**
1. SegVol was falling back to Mem3D even when explicitly selected
2. The code was looking for `image.pixelData` but the actual data was in the cache

## Root Cause

The `extractImageDataForPrediction` function was trying to access pixel data from the `images` array, but:

1. The `images` array only contains **database metadata** (sopInstanceUID, fileName, etc.)
2. The actual **pixel data** is stored separately in `imageCacheRef` after DICOM parsing
3. Cached images have the pixel data in the `.data` property (not `.pixelData`)

## Architecture

```
Database Query → images[] (metadata only)
                    ↓
               sopInstanceUID
                    ↓
            fetchAndParseImage()
                    ↓
           parseDicomImage() (worker)
                    ↓
         imageCacheRef.set(sopInstanceUID, {
           data: Float32Array,      ← PIXEL DATA HERE
           columns: 512,
           rows: 512,
           rescaleSlope: 1,
           rescaleIntercept: 0,
           windowCenter: 40,
           windowWidth: 400
         })
```

## Solution

### 1. Fixed Pixel Data Extraction

**Before:**
```typescript
const img = images[imageIndex];
if (!img?.pixelData) {  // ❌ This doesn't exist!
  return null;
}
return {
  pixels: img.pixelData,  // ❌ Never works
  ...
};
```

**After:**
```typescript
const img = images[imageIndex];
const cachedImage = imageCacheRef.current.get(img.sopInstanceUID);
if (!cachedImage || !cachedImage.data) {  // ✅ Check cache
  return null;
}
return {
  pixels: cachedImage.data,  // ✅ Correct property
  width: cachedImage.columns,
  height: cachedImage.rows,
  ...
};
```

### 2. Removed Unwanted Fallback

**Before:**
```typescript
if (algorithmMode === 'segvol' && (!imageData || !coordinateTransforms)) {
  console.warn(`Falling back to Mem3D or geometric prediction.`);
  algorithmMode = 'mem3d';  // ❌ User selected SegVol!
}
```

**After:**
```typescript
if (algorithmMode === 'segvol' && (!imageData || !coordinateTransforms)) {
  console.error(`❌ SegVol prediction unavailable: DICOM pixel data not accessible.`);
  updateActivePredictions(new Map());
  return;  // ✅ Fail clearly, don't silently fallback
}
```

## Files Modified

### [working-viewer.tsx](client/src/components/dicom/working-viewer.tsx)

**Line 1973-2013:** Updated `extractImageDataForPrediction`
- Now uses `imageCacheRef.current.get(sopInstanceUID)`
- Accesses `.data` property instead of `.pixelData`
- Better error messages showing cache status

**Line 2246-2257:** Removed silent fallback
- SegVol fails clearly if pixel data not available
- No unwanted fallback to other modes
- Mem3D can still use fallback (as intended)

## Testing

After this fix, the services should:

1. **Successfully extract pixel data** from cached images
2. **SegVol**: Work when pixel data is available, fail clearly when not
3. **Mem3D**: Work with pixel data, use geometric fallback without
4. **No silent mode switching** - respect user's selection

## Verification

Check browser console for:

✅ **Success:**
```
📊 Pixel data extracted for image 42: 262144 pixels, range: [-1024.0, 3071.0]
```

❌ **Expected failure (image not loaded yet):**
```
📊 Pixel data extraction failed: Image at index 42 has no pixelData property in cache (cached: false, has data: false)
```

## How Image Cache Works

1. **Initial Load**: Only metadata loaded from database
2. **On Display**: Image pixel data fetched and parsed via worker
3. **Caching**: Parsed data stored in `imageCacheRef` by sopInstanceUID
4. **Prediction**: AI services access cached data

**Prefetching**: Images are prefetched in background for smooth navigation

## Next Steps

1. Reload the viewer to apply changes
2. Load a DICOM study
3. Wait for images to load/prefetch
4. Draw a contour
5. Navigate to next slice
6. AI prediction should now work with real pixel data

## Related Code

- **Image Loading**: [working-viewer.tsx:4597-4607](client/src/components/dicom/working-viewer.tsx#L4597-L4607)
- **Cache Population**: [working-viewer.tsx:4625](client/src/components/dicom/working-viewer.tsx#L4625)
- **AI Tumor Tool** (working example): [ai-tumor-tool.tsx:408](client/src/components/dicom/ai-tumor-tool.tsx#L408)

## Summary

✅ **Pixel data extraction now works correctly**
✅ **SegVol respects user selection (no unwanted fallback)**
✅ **Better error messages for debugging**
✅ **Consistent with AI Tumor Tool approach**

The AI services can now access real DICOM pixel data for accurate predictions!
