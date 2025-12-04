# SuperSeg Tumor Tool - Single-Click Brain Metastasis Segmentation

## Overview

The SuperSeg tumor tool provides AI-powered brain metastasis segmentation using a **single-click interface**. It uses a custom U-Net model trained on T2 FLAIR MRI sequences.

### Key Features

- ✨ **Single-Click Segmentation**: Click once on tumor → AI propagates through 3D volume
- 🔬 **Fusion Support**: Segment on MRI, contours automatically placed on CT
- 🧠 **Brain Metastasis Specialized**: U-Net trained specifically for brain mets
- 🎯 **3D Propagation**: Automatically tracks tumor through adjacent slices
- 🐟 **Registration Transform**: Uses DICOM registration matrices for MRI→CT coordinate transformation

## Architecture

### Components

1. **Python Service** (`server/superseg/superseg_service.py`)
   - Flask API for U-Net inference
   - Runs on port 5003
   - Supports MPS (Apple Silicon), CUDA, or CPU

2. **API Proxy** (`server/superseg-api.ts`)
   - Express router proxying to Python service
   - Handles request/response formatting

3. **Client Library** (`client/src/lib/superseg-client.ts`)
   - TypeScript client for API calls
   - Health checking and error handling

4. **UI Component** (`client/src/components/dicom/ai-tumor-tool.tsx`)
   - Interactive single-click interface
   - Fusion mode support with automatic CT transformation
   - Visual feedback and status indicators

## Workflow

### Standard Mode (CT-only)

```
1. User clicks on tumor in CT view
2. Extract CT volume data
3. Send to SuperSeg API
4. Receive 3D binary mask
5. Convert mask to contours
6. Display contours on CT slices
```

### Fusion Mode (MRI + CT)

```
1. User views fused MRI/CT
2. User clicks on tumor in fused view
3. Extract MRI volume data (from secondary series)
4. Send MRI volume to SuperSeg API
5. Receive 3D mask in MRI space
6. Transform mask coordinates: MRI → CT using registration matrix
7. Generate contours in CT space
8. Display contours on CT slices
9. Automatically switch view to CT to show results
```

## Installation

### 1. Install Python Dependencies

```bash
cd server/superseg
pip install -r requirements.txt
```

### 2. Verify Model Weights

Ensure `superseg/unet_brain_met.pth` exists in the project root:

```bash
ls -lh superseg/unet_brain_met.pth
```

### 3. Start SuperSeg Service

```bash
./server/superseg/start-service.sh
```

Or manually:

```bash
cd server/superseg
python superseg_service.py --port 5003
```

### 4. Start Main Server

The main server will automatically proxy requests to SuperSeg:

```bash
npm run dev
```

## Usage

### 1. Activate Tool

- Open a study with RT structures
- Select a structure to edit
- Click the **AI Tumor** button (sparkles icon) in the contour toolbar

### 2. Click on Tumor

- Click once on the tumor
- A magenta crosshair marks your click
- The tool shows the click coordinates

### 3. Generate Segmentation

- Click **Generate 3D** button
- Wait for segmentation (typically 2-5 seconds)
- Contours appear on all slices containing tumor

### 4. Review Results

- Navigate through slices to review contours
- Edit manually if needed using standard contour tools
- Save structure as usual

## Fusion Mode

When viewing a fused MRI/CT series:

1. The tool detects fusion mode automatically
2. Shows: "🔬 Fusion Mode: Segmenting on MRI, contours will be placed on CT"
3. You click on the MRI view
4. Segmentation runs on MRI data
5. Contours are transformed to CT space using registration matrix
6. View automatically switches to CT to show results

## API Reference

### Health Check

```bash
GET /api/superseg/health
```

Response:
```json
{
  "status": "ready",
  "message": "SuperSeg service is ready",
  "device": "mps",
  "model": "U-Net Brain Metastasis"
}
```

### Segment

```bash
POST /api/superseg/segment
```

Request:
```json
{
  "volume": [[[...]]], // 3D MRI/CT volume (H, W, D)
  "click_point": [y, x, z], // Click coordinates
  "spacing": [z_spacing, y_spacing, x_spacing], // Optional
  "slice_axis": "last" // "last" = (H,W,D), "first" = (D,H,W)
}
```

Response:
```json
{
  "mask": [[[...]]], // 3D binary mask
  "slices_with_tumor": [10, 11, 12, ...], // Slice indices
  "total_voxels": 15234,
  "confidence": 0.85
}
```

## Model Details

### Architecture

- **Type**: U-Net with 5 encoder/decoder levels
- **Input**: 2 channels (MRI slice + point mask)
- **Output**: Binary segmentation mask
- **Base Channels**: 32
- **Training Resolution**: 0.5x (images downsampled during training)

### Training Data

- **Dataset**: BraTS 2021 (Brain Tumor Segmentation)
- **Target**: Whole tumor (Necrotic core + Edema + Enhancing rim)
- **Modality**: T2 FLAIR MRI

### Inference

1. Input slice normalized to zero mean, unit variance
2. Point mask created at click location
3. Both stacked as 2-channel input
4. Downsampled to 0.5x resolution
5. Passed through U-Net
6. Output upsampled back to original size
7. Thresholded at 0.5 probability

### 3D Propagation Algorithm

```python
1. Segment starting slice at click point
2. If prediction exists:
   - Calculate centroid of prediction
   - Move to next slice (up)
   - Predict using centroid as new point
   - Check if prediction is near centroid (max 10 pixels)
   - If yes, continue; if no, stop
3. Repeat step 2 going down from start
4. Prune to largest 3D connected component
```

## Coordinate Transformation (Fusion Mode)

### MRI to CT Transform

Uses DICOM registration matrix (4x4 homogeneous transform):

```
[R11 R12 R13 Tx]   [x_mri]   [x_ct]
[R21 R22 R23 Ty] × [y_mri] = [y_ct]
[R31 R32 R33 Tz]   [z_mri]   [z_ct]
[  0   0   0  1]   [  1  ]   [  1 ]
```

### Steps

1. Convert MRI pixel coordinates to world coordinates
2. Apply registration matrix: `CT_world = M × MRI_world`
3. Find nearest CT slice for each transformed point
4. Group contours by CT slice position
5. Create RT contours in CT coordinate system

## Troubleshooting

### Service Not Starting

**Error**: `Model weights not found`

**Solution**: Verify `superseg/unet_brain_met.pth` exists

```bash
ls superseg/unet_brain_met.pth
```

---

**Error**: `Port 5003 already in use`

**Solution**: Kill existing process or change port

```bash
# Find process
lsof -i :5003

# Kill process
kill -9 <PID>

# Or change port
python superseg_service.py --port 5004
```

### Segmentation Fails

**Error**: `Click point out of bounds`

**Solution**: Ensure click is within image boundaries

---

**Error**: `No tumor detected`

**Solution**: 
- Try clicking more centrally on tumor
- Model trained on T2 FLAIR - may not work well on other sequences
- Check that you're viewing the correct MRI sequence

### Poor Results

**Issue**: Segmentation doesn't match tumor

**Causes**:
- Wrong MRI sequence (model expects T2 FLAIR)
- Tumor not a brain metastasis (model specialized for brain mets)
- Image artifacts or poor quality

**Solutions**:
- Use manual contouring tools for refinement
- Try clicking on different part of tumor
- Consider using different AI tool for other tumor types

### Fusion Mode Issues

**Issue**: Contours appear in wrong location on CT

**Causes**:
- Incorrect registration matrix
- MRI/CT misalignment

**Solutions**:
- Verify registration using fusion visualization
- Check registration matrix with: `/api/registration/inspect-all`
- Re-register series if needed

## Performance

### Typical Timing

- **Volume extraction**: 0.5-2 seconds
- **Segmentation**: 2-5 seconds
- **Contour generation**: 0.5-1 second
- **Total**: 3-8 seconds

### Optimizations

- Uses half-resolution inference (2x faster)
- Only processes cropped region around tumor
- Caches volume data when possible
- Prunes to single connected component

## Comparison to Previous System

| Feature | Old (Scribble-based) | New (Single-click) |
|---------|---------------------|-------------------|
| User Input | Draw on 3-5 slices | Click once |
| Model | SegVol / nnInteractive | Custom U-Net |
| Training Data | General medical images | Brain metastases specific |
| Interaction Time | 30-60 seconds | 2-5 seconds |
| Fusion Support | Limited | Full MRI→CT transform |
| 3D Tracking | Built into model | Centroid propagation |

## Future Enhancements

- [ ] Support for other MRI sequences (T1, T1-CE)
- [ ] Multi-tumor detection (find all tumors automatically)
- [ ] Confidence visualization per slice
- [ ] Editing interface for point correction
- [ ] Model fine-tuning on institutional data
- [ ] GPU batch processing for multiple tumors

## References

- Model inspired by BraTS challenge approaches
- U-Net architecture: Ronneberger et al. (2015)
- Centroid tracking: Similar to region-growing segmentation



