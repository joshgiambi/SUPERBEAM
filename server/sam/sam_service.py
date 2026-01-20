"""
SAM (Segment Anything Model) Service - Single-Click Interactive Segmentation
Uses Meta's SAM for general-purpose medical image segmentation.
Replaces SuperSeg (which only worked on brain MRI FLAIR).
"""

import os
import sys
import logging
import numpy as np
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import cv2
from scipy.ndimage import label as scipy_label

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Device setup
if torch.backends.mps.is_available():
    device = torch.device("mps")
    logger.info("🖥️ Using MPS (Apple Silicon) device")
elif torch.cuda.is_available():
    device = torch.device("cuda")
    logger.info("🖥️ Using CUDA device")
else:
    device = torch.device("cpu")
    logger.info("🖥️ Using CPU device")

app = Flask(__name__)
CORS(app)

# Global model references
sam_model = None
sam_predictor = None


def load_sam_model(model_type="vit_b", checkpoint_path=None):
    """
    Load SAM model.
    
    Args:
        model_type: "vit_h" (huge), "vit_l" (large), "vit_b" (base)
        checkpoint_path: Path to model weights
    """
    global sam_model, sam_predictor
    
    try:
        from segment_anything import sam_model_registry, SamPredictor
    except ImportError:
        logger.error("segment_anything not installed. Run: pip install segment-anything")
        raise
    
    # Find checkpoint
    if checkpoint_path is None:
        script_dir = Path(__file__).parent
        checkpoint_path = script_dir / f"sam_{model_type}.pth"
        
        # Also check parent directories
        if not checkpoint_path.exists():
            checkpoint_path = script_dir.parent.parent / "sam" / f"sam_{model_type}.pth"
    
    checkpoint_path = Path(checkpoint_path)
    
    if not checkpoint_path.exists():
        logger.error(f"SAM checkpoint not found at {checkpoint_path}")
        logger.info("Download from: https://github.com/facebookresearch/segment-anything#model-checkpoints")
        raise FileNotFoundError(f"SAM checkpoint not found at {checkpoint_path}")
    
    logger.info(f"🔬 Loading SAM model ({model_type}) from {checkpoint_path}...")
    
    sam_model = sam_model_registry[model_type](checkpoint=str(checkpoint_path))
    sam_model.to(device=device)
    sam_model.eval()
    
    sam_predictor = SamPredictor(sam_model)
    
    logger.info("✅ SAM model loaded successfully")


def normalize_medical_image(image_slice, window_center=None, window_width=None):
    """
    Normalize medical image to 0-255 range for SAM.
    
    SAM expects natural images, so we need to convert medical images
    to a visually reasonable grayscale representation.
    """
    # Handle different input types
    if isinstance(image_slice, list):
        image_slice = np.array(image_slice, dtype=np.float32)
    
    img = image_slice.astype(np.float32)
    
    # Apply windowing if provided
    if window_center is not None and window_width is not None:
        min_val = window_center - window_width / 2
        max_val = window_center + window_width / 2
        img = np.clip(img, min_val, max_val)
    else:
        # Auto-window using percentiles for robustness
        p1 = np.percentile(img, 1)
        p99 = np.percentile(img, 99)
        img = np.clip(img, p1, p99)
    
    # Normalize to 0-255
    img_min = img.min()
    img_max = img.max()
    
    if img_max > img_min:
        img = (img - img_min) / (img_max - img_min) * 255
    else:
        img = np.zeros_like(img)
    
    return img.astype(np.uint8)


def segment_with_sam(image_slice, click_point, window_center=None, window_width=None):
    """
    Segment a 2D slice using SAM given a click point.
    
    Args:
        image_slice: 2D numpy array (H, W)
        click_point: Tuple (y, x) - click coordinates
        window_center: Optional window center for normalization
        window_width: Optional window width for normalization
    
    Returns:
        Binary mask (H, W) as numpy array
    """
    global sam_predictor
    
    if sam_predictor is None:
        raise RuntimeError("SAM model not loaded")
    
    H, W = image_slice.shape
    y, x = click_point
    
    logger.debug(f"🔬 Segmenting slice ({H}x{W}) with click at (y={y}, x={x})")
    
    # Normalize to 0-255 for SAM
    img_normalized = normalize_medical_image(image_slice, window_center, window_width)
    
    # SAM expects RGB, so convert grayscale to 3-channel
    img_rgb = cv2.cvtColor(img_normalized, cv2.COLOR_GRAY2RGB)
    
    # Set image
    sam_predictor.set_image(img_rgb)
    
    # SAM expects points as (x, y), not (y, x)
    input_point = np.array([[x, y]])
    input_label = np.array([1])  # 1 = foreground
    
    # Run prediction
    masks, scores, logits = sam_predictor.predict(
        point_coords=input_point,
        point_labels=input_label,
        multimask_output=True,  # Get multiple masks
    )
    
    # Pick the best mask (highest confidence)
    best_idx = np.argmax(scores)
    best_mask = masks[best_idx]
    best_score = scores[best_idx]
    
    logger.debug(f"🔬 SAM produced mask with score {best_score:.3f}, {best_mask.sum()} pixels")
    
    # Post-process: keep only component containing click point
    if best_mask.sum() > 0:
        labeled_mask, num_components = scipy_label(best_mask)
        
        # Find component at click point
        click_component = labeled_mask[y, x]
        
        if click_component > 0:
            # Keep only the clicked component
            best_mask = (labeled_mask == click_component).astype(np.uint8)
            logger.debug(f"🔬 Kept component {click_component} at click point, {best_mask.sum()} pixels")
        else:
            # Click point wasn't in any component, find nearest
            min_dist = float('inf')
            nearest_component = 0
            
            for comp_id in range(1, num_components + 1):
                comp_mask = (labeled_mask == comp_id)
                comp_coords = np.argwhere(comp_mask)
                if len(comp_coords) > 0:
                    distances = np.linalg.norm(comp_coords - np.array([y, x]), axis=1)
                    min_comp_dist = distances.min()
                    if min_comp_dist < min_dist:
                        min_dist = min_comp_dist
                        nearest_component = comp_id
            
            if nearest_component > 0:
                best_mask = (labeled_mask == nearest_component).astype(np.uint8)
                logger.debug(f"🔬 Click wasn't in mask, using nearest component {nearest_component} (dist={min_dist:.1f})")
    
    return best_mask.astype(np.uint8), float(best_score)


def segment_3d_with_propagation(volume, start_slice, start_point, window_center=None, window_width=None, max_dist=15):
    """
    Segment through a 3D volume using SAM with centroid propagation.
    
    Args:
        volume: 3D numpy array (H, W, D)
        start_slice: Starting slice index
        start_point: Tuple (y, x) - click coordinates
        window_center: Optional window center
        window_width: Optional window width
        max_dist: Max distance for centroid tracking
    
    Returns:
        Dict mapping slice indices to 2D binary masks
    """
    H, W, D = volume.shape
    segmentations = {}
    confidences = {}
    
    logger.info(f"🔬 Starting 3D SAM segmentation from slice {start_slice}, point {start_point}")
    
    # Segment starting slice
    start_mask, start_conf = segment_with_sam(
        volume[:, :, start_slice], 
        start_point,
        window_center,
        window_width
    )
    
    if start_mask.sum() == 0:
        logger.warning("🔬 No segmentation at starting point")
        return segmentations, 0.0
    
    segmentations[start_slice] = start_mask
    confidences[start_slice] = start_conf
    logger.info(f"🔬 ✓ Slice {start_slice}: {start_mask.sum()} pixels (conf={start_conf:.3f})")
    
    def get_centroid(mask):
        coords = np.argwhere(mask > 0)
        if len(coords) == 0:
            return None
        return tuple(coords.mean(axis=0).astype(int))
    
    def check_near_centroid(mask, centroid, max_d):
        if mask.sum() == 0:
            return False
        coords = np.argwhere(mask > 0)
        distances = np.linalg.norm(coords - np.array(centroid), axis=1)
        return distances.min() <= max_d
    
    # Propagate upward
    current_slice = start_slice + 1
    prev_centroid = get_centroid(start_mask)
    
    while current_slice < D and prev_centroid is not None:
        mask, conf = segment_with_sam(
            volume[:, :, current_slice],
            prev_centroid,
            window_center,
            window_width
        )
        
        if not check_near_centroid(mask, prev_centroid, max_dist):
            logger.info(f"🔬 ↑ Stopped at slice {current_slice} (prediction too far)")
            break
        
        if mask.sum() > 0:
            segmentations[current_slice] = mask
            confidences[current_slice] = conf
            logger.info(f"🔬 ✓ Slice {current_slice}: {mask.sum()} pixels (conf={conf:.3f})")
            prev_centroid = get_centroid(mask)
            current_slice += 1
        else:
            logger.info(f"🔬 ↑ Stopped at slice {current_slice} (empty mask)")
            break
    
    # Propagate downward
    current_slice = start_slice - 1
    prev_centroid = get_centroid(segmentations[start_slice])
    
    while current_slice >= 0 and prev_centroid is not None:
        mask, conf = segment_with_sam(
            volume[:, :, current_slice],
            prev_centroid,
            window_center,
            window_width
        )
        
        if not check_near_centroid(mask, prev_centroid, max_dist):
            logger.info(f"🔬 ↓ Stopped at slice {current_slice} (prediction too far)")
            break
        
        if mask.sum() > 0:
            segmentations[current_slice] = mask
            confidences[current_slice] = conf
            logger.info(f"🔬 ✓ Slice {current_slice}: {mask.sum()} pixels (conf={conf:.3f})")
            prev_centroid = get_centroid(mask)
            current_slice -= 1
        else:
            logger.info(f"🔬 ↓ Stopped at slice {current_slice} (empty mask)")
            break
    
    # Calculate average confidence
    avg_confidence = np.mean(list(confidences.values())) if confidences else 0.0
    
    logger.info(f"🔬 ✅ Segmentation complete: {len(segmentations)} slices, avg confidence={avg_confidence:.3f}")
    
    return segmentations, avg_confidence


# ============================================================================
# API Endpoints (Same interface as SuperSeg for compatibility)
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    if sam_predictor is None:
        return jsonify({
            'status': 'error',
            'message': 'SAM model not loaded',
            'device': str(device)
        }), 503
    
    return jsonify({
        'status': 'ready',
        'message': 'SAM service is ready',
        'device': str(device),
        'model': 'SAM (Segment Anything Model)'
    })


@app.route('/segment', methods=['POST'])
def segment():
    """
    Segment tumor/structure from single point click.
    Compatible with SuperSeg API interface.
    
    Request JSON:
    {
        "volume": [[[...]]]  # 3D array (D, H, W) or (H, W, D)
        "click_point": [y, x, z]  # Click coordinates
        "window_center": Optional[float],
        "window_width": Optional[float],
        "slice_axis": "last"  # "last" means (H, W, D), "first" means (D, H, W)
        "mode": "3d" | "2d"  # Optional, defaults to "3d"
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
        if sam_predictor is None:
            return jsonify({'error': 'SAM model not loaded'}), 503
        
        data = request.json
        
        # Parse input
        volume = np.array(data['volume'], dtype=np.float32)
        click_point = data['click_point']  # [y, x, z]
        slice_axis = data.get('slice_axis', 'last')
        window_center = data.get('window_center')
        window_width = data.get('window_width')
        mode = data.get('mode', '3d')
        
        logger.info(f"🔬 Received SAM segmentation request")
        logger.info(f"🔬 Volume shape: {volume.shape}")
        logger.info(f"🔬 Click point: {click_point}")
        logger.info(f"🔬 Mode: {mode}")
        
        # Rearrange to (H, W, D) if needed
        if slice_axis == 'first':  # (D, H, W) -> (H, W, D)
            volume = np.transpose(volume, (1, 2, 0))
            logger.info(f"🔬 Transposed to (H, W, D): {volume.shape}")
        
        H, W, D = volume.shape
        y, x, z = click_point
        
        # Validate click point
        if not (0 <= z < D and 0 <= y < H and 0 <= x < W):
            return jsonify({
                'error': f'Click point {click_point} out of bounds for volume shape {volume.shape}'
            }), 400
        
        # Run segmentation
        if mode == '2d':
            # Single slice only
            mask, confidence = segment_with_sam(
                volume[:, :, z],
                (y, x),
                window_center,
                window_width
            )
            segmentations = {z: mask} if mask.sum() > 0 else {}
        else:
            # 3D propagation
            segmentations, confidence = segment_3d_with_propagation(
                volume,
                z,
                (y, x),
                window_center,
                window_width
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
        
        result = {
            'mask': mask_3d.tolist(),
            'slices_with_tumor': slices_with_tumor,
            'total_voxels': total_voxels,
            'confidence': float(confidence)
        }
        
        logger.info(f"🔬 ✅ SAM segmentation complete: {total_voxels} voxels across {len(slices_with_tumor)} slices")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"🔬 ❌ SAM segmentation failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/segment_2d', methods=['POST'])
def segment_2d():
    """
    Segment a single 2D slice.
    
    Request JSON:
    {
        "image": [[...]]  # 2D array (H, W)
        "click_point": [y, x]  # Click coordinates
        "window_center": Optional[float],
        "window_width": Optional[float]
    }
    
    Response JSON:
    {
        "mask": [[...]]  # 2D binary mask
        "confidence": float
        "contour": [[x, y], ...]  # Contour points
    }
    """
    try:
        if sam_predictor is None:
            return jsonify({'error': 'SAM model not loaded'}), 503
        
        data = request.json
        
        image = np.array(data['image'], dtype=np.float32)
        click_point = tuple(data['click_point'])  # [y, x]
        window_center = data.get('window_center')
        window_width = data.get('window_width')
        
        logger.info(f"🔬 2D SAM segment request: image {image.shape}, click {click_point}")
        
        mask, confidence = segment_with_sam(
            image,
            click_point,
            window_center,
            window_width
        )
        
        # Extract contour
        contour_points = []
        if mask.sum() > 0:
            contours, _ = cv2.findContours(
                mask.astype(np.uint8), 
                cv2.RETR_EXTERNAL, 
                cv2.CHAIN_APPROX_SIMPLE
            )
            if contours:
                # Get largest contour
                largest = max(contours, key=cv2.contourArea)
                # Convert to list of [x, y] points
                contour_points = largest.reshape(-1, 2).tolist()
        
        result = {
            'mask': mask.tolist(),
            'confidence': float(confidence),
            'contour': contour_points,
            'num_pixels': int(mask.sum())
        }
        
        logger.info(f"🔬 ✅ 2D segment complete: {mask.sum()} pixels, {len(contour_points)} contour points")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"🔬 ❌ 2D SAM segmentation failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='SAM Segmentation Service')
    parser.add_argument('--port', type=int, default=5003, help='Port to run service on')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--model', type=str, default='vit_b', 
                        choices=['vit_h', 'vit_l', 'vit_b'],
                        help='SAM model size')
    parser.add_argument('--checkpoint', type=str, default=None, help='Path to model checkpoint')
    args = parser.parse_args()
    
    # Load model
    try:
        load_sam_model(args.model, args.checkpoint)
    except Exception as e:
        logger.error(f"Failed to load SAM model: {e}")
        sys.exit(1)
    
    # Run server
    logger.info(f"🚀 Starting SAM service on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False, threaded=True)
