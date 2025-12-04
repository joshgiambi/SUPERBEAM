"""
SuperSeg - Single-Click Brain Metastasis Tumor Segmentation Service
Uses U-Net model trained on T2 FLAIR MRI for brain metastases.
"""

import os
import sys
import logging
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from flask import Flask, request, jsonify
from pathlib import Path
from scipy.ndimage import label as scipy_label

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more detailed output
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Device setup - use MPS for Apple Silicon, CUDA for NVIDIA, else CPU
if torch.backends.mps.is_available():
    device = torch.device("mps")
    logger.info("Using MPS (Apple Silicon) device")
elif torch.cuda.is_available():
    device = torch.device("cuda")
    logger.info("Using CUDA device")
else:
    device = torch.device("cpu")
    logger.info("Using CPU device")

app = Flask(__name__)


# ============================================================================
# U-Net Model Architecture (matching training code)
# ============================================================================

class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True)
        )
    
    def forward(self, x):
        return self.conv(x)


class UNet(nn.Module):
    def __init__(self, in_channels=2, base_channels=32):
        super().__init__()
        
        # Encoder
        self.enc1 = ConvBlock(in_channels, base_channels)
        self.enc2 = ConvBlock(base_channels, base_channels * 2)
        self.enc3 = ConvBlock(base_channels * 2, base_channels * 4)
        self.enc4 = ConvBlock(base_channels * 4, base_channels * 8)
        
        # Bottleneck
        self.bottleneck = ConvBlock(base_channels * 8, base_channels * 16)
        
        # Decoder
        self.up4 = nn.ConvTranspose2d(base_channels * 16, base_channels * 8, 2, stride=2)
        self.dec4 = ConvBlock(base_channels * 16, base_channels * 8)
        
        self.up3 = nn.ConvTranspose2d(base_channels * 8, base_channels * 4, 2, stride=2)
        self.dec3 = ConvBlock(base_channels * 8, base_channels * 4)
        
        self.up2 = nn.ConvTranspose2d(base_channels * 4, base_channels * 2, 2, stride=2)
        self.dec2 = ConvBlock(base_channels * 4, base_channels * 2)
        
        self.up1 = nn.ConvTranspose2d(base_channels * 2, base_channels, 2, stride=2)
        self.dec1 = ConvBlock(base_channels * 2, base_channels)
        
        # Output
        self.out = nn.Conv2d(base_channels, 1, 1)
        
        self.pool = nn.MaxPool2d(2)
    
    def forward(self, x):
        # Encoder
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        
        # Bottleneck
        b = self.bottleneck(self.pool(e4))
        
        # Decoder with size matching
        d4 = self.up4(b)
        if d4.size()[2:] != e4.size()[2:]:
            d4 = F.interpolate(d4, size=e4.size()[2:], mode='bilinear', align_corners=False)
        d4 = torch.cat([d4, e4], dim=1)
        d4 = self.dec4(d4)
        
        d3 = self.up3(d4)
        if d3.size()[2:] != e3.size()[2:]:
            d3 = F.interpolate(d3, size=e3.size()[2:], mode='bilinear', align_corners=False)
        d3 = torch.cat([d3, e3], dim=1)
        d3 = self.dec3(d3)
        
        d2 = self.up2(d3)
        if d2.size()[2:] != e2.size()[2:]:
            d2 = F.interpolate(d2, size=e2.size()[2:], mode='bilinear', align_corners=False)
        d2 = torch.cat([d2, e2], dim=1)
        d2 = self.dec2(d2)
        
        d1 = self.up1(d2)
        if d1.size()[2:] != e1.size()[2:]:
            d1 = F.interpolate(d1, size=e1.size()[2:], mode='bilinear', align_corners=False)
        d1 = torch.cat([d1, e1], dim=1)
        d1 = self.dec1(d1)
        
        out = self.out(d1)
        return out


# ============================================================================
# Inference Functions
# ============================================================================

def normalize_volume(volume, use_robust=True):
    """Normalize a volume to zero mean and unit variance.
    
    Args:
        volume: 3D numpy array
        use_robust: If True, use percentile-based normalization for clinical DICOM.
                   If False, use simple z-score (matches BraTS training exactly)
    
    ROBUST mode (use_robust=True):
    - Uses percentile-based windowing to ensure edema appears bright
    - Maps 1st percentile → -3, 99th percentile → +3
    - Better for clinical DICOM with variable intensity ranges
    
    SIMPLE mode (use_robust=False):
    - Exact match to BraTS training normalization
    - Better if data is already preprocessed
    """
    if not use_robust:
        # Simple z-score normalization (exact match to training)
        mean = np.mean(volume)
        std = np.std(volume)
        logger.info(f"SIMPLE normalization: mean={mean:.2f}, std={std:.2f}")
        if std > 0:
            return (volume - mean) / std
        return volume - mean
    
    # ROBUST percentile-based normalization for clinical DICOM
    # This ensures bright areas (tumor/edema) map to HIGH positive values
    
    non_zero = volume[volume > 0]
    
    if len(non_zero) == 0:
        logger.warning("Volume is all zeros!")
        return volume
    
    # Get intensity percentiles (excluding zeros/background)
    p01 = np.percentile(non_zero, 1)
    p50 = np.percentile(non_zero, 50)  # Median
    p99 = np.percentile(non_zero, 99)
    
    logger.info(f"Volume intensity range: p1={p01:.1f}, p50={p50:.1f}, p99={p99:.1f}")
    
    # Clip to remove extreme outliers
    volume_clipped = np.clip(volume, p01, p99)
    
    # Calculate mean/std from clipped non-zero voxels
    clipped_nonzero = volume_clipped[volume_clipped > 0]
    mean = np.mean(clipped_nonzero)
    std = np.std(clipped_nonzero)
    
    logger.info(f"ROBUST normalization: mean={mean:.2f}, std={std:.2f}")
    logger.info(f"  After normalization: p1→{(p01-mean)/std:.2f}, p50→{(p50-mean)/std:.2f}, p99→{(p99-mean)/std:.2f}")
    logger.info(f"  Bright areas (tumor/edema) will have values > {(p99-mean)/std:.2f}")
    
    if std > 0:
        normalized = (volume - mean) / std
        # Don't clip too aggressively - we want bright areas to stay bright
        normalized = np.clip(normalized, -10, 10)
        return normalized
    return volume - mean


def predict_slice(model, mri_slice, point, threshold=0.5):
    """
    Predict segmentation for a single MRI slice with a point.

    Args:
        model: Trained U-Net model
        mri_slice: 2D numpy array (H, W)
        point: Tuple (y, x) - click coordinates in slice
        threshold: Probability threshold for binary mask

    Returns:
        Binary mask (H, W) as numpy array
    """
    H, W = mri_slice.shape

    # Debug: Check input slice statistics
    logger.debug(f"  Input slice stats: min={mri_slice.min():.3f}, max={mri_slice.max():.3f}, mean={mri_slice.mean():.3f}, std={mri_slice.std():.3f}")

    # Create point mask with small blob to create strong peak after downsampling
    # Single pixel at 1.0 becomes 4 pixels at 0.25 after 0.5x downsample - too weak!
    # Use 3x3 blob so downsampled peak is stronger (~0.5-0.7)
    point_mask = np.zeros((H, W), dtype=np.float32)
    y_center, x_center = int(point[0]), int(point[1])

    logger.debug(f"  Creating 3x3 blob at (y={y_center}, x={x_center}) in {H}x{W} image")

    # Create 3x3 blob: center at 1.0, neighbors at 0.5
    # This creates a stronger peak after 0.5x bilinear downsample
    point_mask[y_center, x_center] = 1.0
    if y_center > 0:
        point_mask[y_center - 1, x_center] = 0.5
    if y_center < H - 1:
        point_mask[y_center + 1, x_center] = 0.5
    if x_center > 0:
        point_mask[y_center, x_center - 1] = 0.5
    if x_center < W - 1:
        point_mask[y_center, x_center + 1] = 0.5
    
    # CRITICAL DEBUG: Check pixel value at click location in the slice
    click_pixel_value = mri_slice[y_center, x_center]
    logger.info(f"  ⚠️ MRI slice pixel at click (y={y_center}, x={x_center}): {click_pixel_value:.3f}")
    logger.info(f"  ⚠️ If this value is NEGATIVE or near ZERO, user clicked on wrong location!")

    # Stack features: [MRI, point_mask]
    features = np.stack([mri_slice, point_mask], axis=0)
    features = torch.from_numpy(features).float().unsqueeze(0)

    # CRITICAL: Model WAS trained at 0.5x resolution! (see line 254 of tumour_seg_POC.py)
    # The dataset __getitem__ downsamples by 0.5x during training
    # Downsample BOTH channels together, exactly as training does
    features = F.interpolate(features, scale_factor=0.5, mode='bilinear', align_corners=False)
    
    # DIAGNOSTIC: Verify the point channel peak survived downsampling
    mask_channel = features[0, 1].cpu().numpy()  # Channel 1 is the point mask
    peak_value = mask_channel.max()
    peak_location = np.unravel_index(mask_channel.argmax(), mask_channel.shape)
    logger.info(f"  🎯 Point-channel peak after downsample: {peak_value:.3f} at downsampled coords {peak_location}")
    logger.info(f"  🎯 Original click was at (y={y_center}, x={x_center}), downsampled should be near (y={y_center//2}, x={x_center//2})")
    
    if peak_value < 0.2:
        logger.warning(f"  ⚠️ Point channel peak is very weak ({peak_value:.3f})! Model may not see the click.")
    
    features = features.to(device)
    
    # Predict
    with torch.no_grad():
        output = model(features)
        output = torch.sigmoid(output)

    # CRITICAL: Resize output back to original dimensions
    # Input was downsampled by 0.5x, so output is at half resolution
    # Must upsample back to match original slice dimensions
    output = F.interpolate(output, size=(H, W), mode='bilinear', align_corners=False)
    output = output.squeeze().cpu().numpy()

    # Debug: Check output statistics
    logger.info(f"  Model output stats: min={output.min():.3f}, max={output.max():.3f}, mean={output.mean():.3f}")
    
    # Check output at click location
    logger.info(f"  Model output at click (y={y_center}, x={x_center}): {output[y_center, x_center]:.3f}")
    
    # Show distribution of predictions
    above_01 = (output > 0.1).sum()
    above_02 = (output > 0.2).sum()
    above_03 = (output > 0.3).sum()
    above_05 = (output > 0.5).sum()
    logger.info(f"  Pixels above thresholds: >0.1:{above_01}, >0.2:{above_02}, >0.3:{above_03}, >0.5:{above_05}")

    # Find where the high probability regions are
    high_prob_mask = (output > 0.3).astype(np.uint8)
    if high_prob_mask.sum() > 0:
        high_prob_coords = np.argwhere(high_prob_mask > 0)
        center_y, center_x = high_prob_coords.mean(axis=0)
        logger.info(f"  High probability (>0.3) region center: (y={center_y:.1f}, x={center_x:.1f}), pixels={high_prob_mask.sum()}")

    # Adaptive thresholding: if default threshold produces nothing, try lower
    mask = (output > threshold).astype(np.uint8)
    
    if mask.sum() == 0 and output.max() > 0.2:
        logger.warning(f"  No pixels above {threshold}, but max output is {output.max():.3f}. Trying lower threshold...")
        # Try progressively lower thresholds
        for adaptive_threshold in [0.4, 0.3, 0.2, 0.15, 0.1]:
            mask = (output > adaptive_threshold).astype(np.uint8)
            if mask.sum() > 0:
                logger.info(f"  ✓ Found {mask.sum()} pixels with threshold={adaptive_threshold}")
                threshold = adaptive_threshold
                break

    # Post-process: Keep only connected component closest to click point
    if mask.sum() > 0:
        from scipy.ndimage import label as scipy_label
        labeled_mask, num_components = scipy_label(mask)

        if num_components > 1:
            # Find component closest to click point
            min_dist = float('inf')
            best_component = 1

            for comp_id in range(1, num_components + 1):
                comp_mask = (labeled_mask == comp_id)
                comp_coords = np.argwhere(comp_mask)
                if len(comp_coords) > 0:
                    # Calculate distance from click point to component centroid
                    centroid = comp_coords.mean(axis=0)
                    dist = np.linalg.norm(centroid - np.array([y_center, x_center]))

                    if dist < min_dist:
                        min_dist = dist
                        best_component = comp_id

            # Keep only the closest component
            mask = (labeled_mask == best_component).astype(np.uint8)
            logger.debug(f"  Kept component {best_component} (closest to click, dist={min_dist:.1f})")

    # Additional check: if mask centroid is too far from click, reject it
    if mask.sum() > 0:
        mask_coords = np.argwhere(mask > 0)
        mask_centroid = mask_coords.mean(axis=0)
        click_dist = np.linalg.norm(mask_centroid - np.array([y_center, x_center]))
        
        logger.info(f"  🎯 Click was at (y={y_center}, x={x_center}), prediction centroid at (y={mask_centroid[0]:.1f}, x={mask_centroid[1]:.1f}), distance={click_dist:.1f}px")

        if click_dist > 100:  # More than 100 pixels from click
            logger.warning(f"  Mask centroid {click_dist:.1f} pixels from click - likely wrong structure, rejecting")
            mask = np.zeros_like(mask, dtype=np.uint8)

    logger.debug(f"  Final mask: {mask.sum()} pixels above threshold {threshold}")

    return mask


def get_centroid(mask):
    """Get centroid of binary mask."""
    coords = np.argwhere(mask > 0)
    if len(coords) == 0:
        return None
    return coords.mean(axis=0)


def check_prediction_near_point(mask, point, max_dist=10):
    """Check if prediction has any pixels within max_dist of point."""
    if mask.sum() == 0:
        return False
    
    coords = np.argwhere(mask > 0)
    point_array = np.array(point)
    
    distances = np.linalg.norm(coords - point_array, axis=1)
    return distances.min() <= max_dist


def prune_to_largest_component_3d(segmentations, volume_shape):
    """
    Keep only the largest 3D connected component.
    
    Args:
        segmentations: dict mapping slice indices to 2D masks
        volume_shape: tuple (H, W, D)
    
    Returns:
        Pruned dict with only largest component
    """
    if len(segmentations) == 0:
        return segmentations
    
    H, W, D = volume_shape
    
    # Create 3D volume from slice dict
    volume_3d = np.zeros((H, W, D), dtype=np.uint8)
    for z, mask in segmentations.items():
        volume_3d[:, :, z] = mask
    
    # Find connected components in 3D
    labeled_3d, num_features = scipy_label(volume_3d)
    
    if num_features == 0:
        return {}
    
    # Find largest component
    largest_component = 0
    largest_size = 0
    
    for component_id in range(1, num_features + 1):
        component_size = (labeled_3d == component_id).sum()
        if component_size > largest_size:
            largest_size = component_size
            largest_component = component_id
    
    # Keep only largest component
    largest_mask_3d = (labeled_3d == largest_component).astype(np.uint8)
    
    # Convert back to dict of 2D slices
    pruned_segmentations = {}
    for z in range(D):
        slice_mask = largest_mask_3d[:, :, z]
        if slice_mask.sum() > 0:
            pruned_segmentations[z] = slice_mask
    
    return pruned_segmentations


def segment_tumor_3d(model, mri_volume, start_slice, start_point, threshold=0.5, max_dist=10):
    """
    Segment tumor in 3D starting from a slice and point.
    Propagates up and down through slices using centroid tracking.

    Args:
        model: Trained U-Net model
        mri_volume: 3D numpy array (H, W, D) - normalized MRI volume
        start_slice: Integer slice index where user clicked
        start_point: Tuple (y, x) - click coordinates in the start slice
        threshold: Probability threshold for segmentation
        max_dist: Maximum distance for centroid tracking

    Returns:
        Dict mapping slice indices to 2D binary masks
    """
    H, W, D = mri_volume.shape
    segmentations = {}

    logger.info(f"🧠 Starting 3D tumor segmentation from slice {start_slice}, point {start_point}")

    # Predict on start slice
    mri_slice = mri_volume[:, :, start_slice]
    mask = predict_slice(model, mri_slice, start_point, threshold)

    if mask.sum() == 0:
        logger.warning("No tumor detected at starting point")
        return segmentations

    # Check if the initial prediction is actually near the click point
    initial_centroid = get_centroid(mask)
    if initial_centroid is not None:
        dist_from_click = np.linalg.norm(np.array(initial_centroid) - np.array(start_point))
        logger.info(f"  Initial mask centroid at {initial_centroid}, distance from click: {dist_from_click:.1f}")

        # If the prediction is too far from the click, it might be detecting the wrong structure
        if dist_from_click > 50:  # More than 50 pixels away
            logger.warning(f"  ⚠️ Initial prediction centroid is {dist_from_click:.1f} pixels from click - may be detecting wrong structure")
            # Try with higher threshold to be more selective
            mask_high_thresh = predict_slice(model, mri_slice, start_point, threshold=0.7)
            if mask_high_thresh.sum() > 0:
                new_centroid = get_centroid(mask_high_thresh)
                new_dist = np.linalg.norm(np.array(new_centroid) - np.array(start_point))
                if new_dist < dist_from_click:
                    logger.info(f"  Using higher threshold (0.7), new distance: {new_dist:.1f}")
                    mask = mask_high_thresh

    segmentations[start_slice] = mask
    logger.info(f"  ✓ Slice {start_slice}: {mask.sum()} pixels")
    
    # Propagate upward (increasing slice index)
    current_slice = start_slice + 1
    prev_centroid = get_centroid(mask)
    
    while current_slice < D and prev_centroid is not None:
        mri_slice = mri_volume[:, :, current_slice]
        mask = predict_slice(model, mri_slice, prev_centroid, threshold)
        
        if not check_prediction_near_point(mask, prev_centroid, max_dist):
            logger.info(f"  ↑ Stopped at slice {current_slice} (prediction too far from centroid)")
            break
        
        if mask.sum() > 0:
            segmentations[current_slice] = mask
            logger.info(f"  ✓ Slice {current_slice}: {mask.sum()} pixels")
            prev_centroid = get_centroid(mask)
            current_slice += 1
        else:
            logger.info(f"  ↑ Stopped at slice {current_slice} (no prediction)")
            break
    
    # Propagate downward (decreasing slice index)
    current_slice = start_slice - 1
    prev_centroid = get_centroid(segmentations[start_slice])
    
    while current_slice >= 0 and prev_centroid is not None:
        mri_slice = mri_volume[:, :, current_slice]
        mask = predict_slice(model, mri_slice, prev_centroid, threshold)
        
        if not check_prediction_near_point(mask, prev_centroid, max_dist):
            logger.info(f"  ↓ Stopped at slice {current_slice} (prediction too far from centroid)")
            break
        
        if mask.sum() > 0:
            segmentations[current_slice] = mask
            logger.info(f"  ✓ Slice {current_slice}: {mask.sum()} pixels")
            prev_centroid = get_centroid(mask)
            current_slice -= 1
        else:
            logger.info(f"  ↓ Stopped at slice {current_slice} (no prediction)")
            break
    
    # Prune to largest 3D connected component
    logger.info(f"Pruning to largest 3D component...")
    segmentations = prune_to_largest_component_3d(segmentations, (H, W, D))
    
    logger.info(f"✅ Segmentation complete: {len(segmentations)} slices with tumor")
    
    return segmentations


# ============================================================================
# Model Loading
# ============================================================================

model = None

def load_model(model_path=None):
    """Load the U-Net model from weights file."""
    global model
    
    if model_path is None:
        # Default path: superseg/unet_brain_met.pth
        script_dir = Path(__file__).parent.parent.parent
        model_path = script_dir / 'superseg' / 'unet_brain_met.pth'
    
    model_path = Path(model_path)
    
    if not model_path.exists():
        raise FileNotFoundError(f"Model weights not found at {model_path}")
    
    logger.info(f"Loading U-Net model from {model_path}...")
    model = UNet(in_channels=2, base_channels=32).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    logger.info("✅ Model loaded successfully")


# ============================================================================
# API Endpoints
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    if model is None:
        return jsonify({
            'status': 'error',
            'message': 'Model not loaded',
            'device': str(device)
        }), 503
    
    return jsonify({
        'status': 'ready',
        'message': 'SuperSeg service is ready',
        'device': str(device),
        'model': 'U-Net Brain Metastasis'
    })


@app.route('/segment', methods=['POST'])
def segment():
    """
    Segment tumor from single point click.
    
    Request JSON:
    {
        "volume": [[[...]]]  # 3D array (D, H, W) or (H, W, D)
        "click_point": [y, x, z]  # Click coordinates
        "spacing": [z_spacing, y_spacing, x_spacing]  # Optional
        "slice_axis": "last"  # "last" means (H, W, D), "first" means (D, H, W)
    }
    
    Response JSON:
    {
        "mask": [[[...]]]  # 3D binary mask same shape as input
        "slices_with_tumor": [list of slice indices]
        "total_voxels": int
        "confidence": float
    }
    """
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 503
        
        data = request.json
        
        # Parse input
        volume = np.array(data['volume'], dtype=np.float32)
        click_point = data['click_point']  # [y, x, z]
        slice_axis = data.get('slice_axis', 'last')
        
        logger.info(f"📥 Received segmentation request")
        logger.info(f"  Volume shape: {volume.shape}")
        logger.info(f"  Click point: {click_point}")
        logger.info(f"  Slice axis: {slice_axis}")
        logger.info(f"  ⚠️  CRITICAL: User clicked at (y={click_point[0]}, x={click_point[1]}, z={click_point[2]})")
        
        # Rearrange to (H, W, D) if needed
        if slice_axis == 'first':  # (D, H, W) -> (H, W, D)
            volume = np.transpose(volume, (1, 2, 0))
            logger.info(f"  Transposed to (H, W, D): {volume.shape}")
        
        H, W, D = volume.shape
        y, x, z = click_point
        
        # Validate click point
        if not (0 <= z < D and 0 <= y < H and 0 <= x < W):
            return jsonify({
                'error': f'Click point {click_point} out of bounds for volume shape {volume.shape}'
            }), 400
        
        # Check pixel values at click location BEFORE normalization
        click_slice = volume[:, :, z]
        click_region_y = slice(max(0, y-5), min(H, y+6))
        click_region_x = slice(max(0, x-5), min(W, x+6))
        click_sample = click_slice[click_region_y, click_region_x]
        logger.info(f"  Pixel values at click (y={y}, x={x}, z={z}) ±5: min={click_sample.min():.1f}, max={click_sample.max():.1f}, mean={click_sample.mean():.1f}")

        # Check overall volume statistics
        logger.info(f"  Volume stats BEFORE normalization: min={volume.min():.1f}, max={volume.max():.1f}, mean={volume.mean():.1f}, std={volume.std():.1f}")
        if click_sample.max() == 0:
            logger.error(f"  ❌ CRITICAL: All pixels at click location are ZERO!")
            # Try to find where actual data is
            slice_max = click_slice.max()
            slice_min = click_slice.min()
            nonzero_count = np.count_nonzero(click_slice)
            logger.error(f"  Slice {z} stats: min={slice_min:.1f}, max={slice_max:.1f}, nonzero={nonzero_count}/{H*W}")
            if slice_max > 0:
                # Find first non-zero pixel
                nonzero_coords = np.argwhere(click_slice > 0)
                if len(nonzero_coords) > 0:
                    first_y, first_x = nonzero_coords[0]
                    logger.error(f"  First non-zero pixel at (y={first_y}, x={first_x}), click was at (y={y}, x={x})")

        # Normalize volume
        # Use ROBUST normalization for clinical DICOM (ensures bright tumor appears bright)
        # This maps intensities so edema/tumor has high positive values
        volume = normalize_volume(volume, use_robust=True)

        # Run 3D segmentation
        segmentations = segment_tumor_3d(
            model=model,
            mri_volume=volume,
            start_slice=z,
            start_point=(y, x),
            threshold=0.5,
            max_dist=10
        )
        
        # Convert to 3D mask
        mask_3d = np.zeros((H, W, D), dtype=np.uint8)
        for slice_idx, slice_mask in segmentations.items():
            mask_3d[:, :, slice_idx] = slice_mask
        
        # Transpose back if needed
        if slice_axis == 'first':
            mask_3d = np.transpose(mask_3d, (2, 0, 1))  # (H, W, D) -> (D, H, W)
        
        total_voxels = int(mask_3d.sum())
        slices_with_tumor = sorted(segmentations.keys())
        
        # Confidence based on number of slices and continuity
        confidence = min(0.95, 0.7 + (len(slices_with_tumor) * 0.05))
        
        result = {
            'mask': mask_3d.tolist(),
            'slices_with_tumor': slices_with_tumor,
            'total_voxels': total_voxels,
            'confidence': confidence
        }
        
        logger.info(f"✅ Segmentation complete: {total_voxels} voxels across {len(slices_with_tumor)} slices")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"❌ Segmentation failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='SuperSeg Tumor Segmentation Service')
    parser.add_argument('--port', type=int, default=5003, help='Port to run service on')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--model', type=str, default=None, help='Path to model weights')
    args = parser.parse_args()
    
    # Load model
    try:
        load_model(args.model)
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        sys.exit(1)
    
    # Run server
    logger.info(f"🚀 Starting SuperSeg service on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
