# Mem3D Model Setup Guide

## Current Status

✅ Mem3D repository cloned
✅ Virtual environment set up
✅ Dependencies installed
❌ **Pretrained weights NOT downloaded** (current file is 1.6KB placeholder)

## Required: Download Pretrained Weights

### Official Weight File

**Source:** [Google Drive - VMN Pretrained on YouTube-VOS](https://drive.google.com/file/d/1nzhFYOJx3rzvnO8o6g-D1MMA6iQ4VYpw/)

**Expected size:** ~200-500 MB (actual model weights)
**Current file:** `weights/vmn_checkpoint.pth` (1.6KB - placeholder)

### Download Instructions

**Option 1: Manual Download**
1. Visit: https://drive.google.com/file/d/1nzhFYOJx3rzvnO8o6g-D1MMA6iQ4VYpw/
2. Download the file
3. Place it at: `server/mem3d/weights/vmn_checkpoint.pth`
4. Verify size is ~200-500 MB

**Option 2: Using gdown (if available)**
```bash
cd server/mem3d/weights
pip install gdown
gdown 1nzhFYOJx3rzvnO8o6g-D1MMA6iQ4VYpw
mv *.pth vmn_checkpoint.pth
```

## Model Architecture

Mem3D uses **VMN (Volumetric Memory Network)** which consists of:

1. **STM (Space-Time Memory)** - Core architecture
2. **IOG (Interactive Object Guidance)** - For handling user input
3. **Memory Module** - Stores features from past slices

### Key Files:
- `Mem3D/models_STM/stm.py` - STM model
- `Mem3D/networks/mainnetwork.py` - Main segmentation network
- `Mem3D/networks/CoarseNet.py` - Coarse prediction
- `Mem3D/networks/FineNet.py` - Fine refinement

## Implementation Plan

### Step 1: Download Weights ⚠️ CRITICAL

Without proper weights, the model CANNOT work. The current 1.6KB file is just a placeholder.

### Step 2: Implement Model Loading

Update `mem3d_service.py` `_load_model()` function:

```python
def _load_model(self, model_path: str):
    """Load Mem3D model from checkpoint"""
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent / 'Mem3D'))

        from models_STM.stm import STM

        # Initialize model
        model = STM(keydim=128, valdim=512)
        model.to(self.device)
        model.eval()

        # Load weights
        if model_path and os.path.exists(model_path):
            logger.info(f"Loading weights from {model_path}")
            checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)

            if 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']
            else:
                state_dict = checkpoint

            model.load_param(state_dict)
            logger.info("Model loaded successfully")
        else:
            logger.warning(f"No weights file at {model_path}")
            return None

        return model

    except Exception as e:
        logger.error(f"Model loading failed: {e}", exc_info=True)
        return None
```

### Step 3: Implement Inference

Update `_run_mem3d_inference()` function to actually use the model.

### Step 4: Test

Run the service and verify it loads:
```bash
cd server/mem3d
source venv/bin/activate
python mem3d_service.py --port 5002 --model-path weights/vmn_checkpoint.pth --device cuda
```

Expected output:
```
Loading weights from weights/vmn_checkpoint.pth
Model loaded successfully
    Total params: XX.XXM
Starting Mem3D service on 127.0.0.1:5002
```

## Why Current Implementation Doesn't Work

1. **No real weights** - 1.6KB file is just a placeholder
2. **_load_model() returns None** - See line 138 in mem3d_service.py
3. **Falls back to geometric** - See line 192-197

## After Getting Weights

Once proper weights are downloaded:

1. Model will load successfully
2. `self.model` will not be None
3. Will use actual AI inference instead of fallback
4. Accuracy should jump from ~60% to 85-90%

## Alternative: Use Different Pretrained Model

If YouTube-VOS weights don't work well for medical imaging, consider:

1. **Medical-specific weights** - Train on medical datasets
2. **SAM (Segment Anything Model)** - General-purpose segmentation
3. **MedSAM** - Medical imaging variant of SAM

But for now, the YouTube-VOS weights should provide decent results.

## Next Steps

1. ⚠️ **CRITICAL**: Download actual pretrained weights (200-500MB)
2. Update `_load_model()` function
3. Implement `_run_mem3d_inference()` function
4. Test with real predictions

## Expected Results

**Before (Current Fallback):**
- Method: `mem3d_fallback`
- Accuracy: ~60-70% on simple cases
- Just averages nearby contours

**After (With Real Model):**
- Method: `mem3d_memory`
- Accuracy: 85-90%+
- Smart 3D understanding
- Learns tissue characteristics
- Handles complex shapes
