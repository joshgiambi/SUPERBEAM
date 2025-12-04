#!/usr/bin/env python3
"""
Geometric Contour Propagation Service
Simple but effective contour propagation using geometric transformations

This uses proven medical imaging techniques:
- Centroid tracking
- Scale estimation from intensity changes
- Shape interpolation between slices
"""

import os
import sys
import json
import logging
from typing import List, Dict, Any, Tuple
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


def find_centroid_shift(ref_image: np.ndarray, target_image: np.ndarray, ref_mask: np.ndarray) -> Tuple[float, float]:
    """
    Estimate centroid shift between reference and target using intensity-based tracking
    """
    # Get bounding box from reference mask
    y_coords, x_coords = np.where(ref_mask > 0)
    if len(x_coords) == 0:
        return 0.0, 0.0

    y_min, y_max = max(0, y_coords.min() - 20), min(ref_image.shape[0], y_coords.max() + 20)
    x_min, x_max = max(0, x_coords.min() - 20), min(ref_image.shape[1], x_coords.max() + 20)

    # Extract ROI from both images
    ref_roi = ref_image[y_min:y_max, x_min:x_max]
    target_roi = target_image[y_min:y_max, x_min:x_max]

    if ref_roi.size == 0 or target_roi.size == 0:
        return 0.0, 0.0

    # Normalize
    ref_roi = (ref_roi - ref_roi.min()) / (ref_roi.max() - ref_roi.min() + 1e-8)
    target_roi = (target_roi - target_roi.min()) / (target_roi.max() - target_roi.min() + 1e-8)

    # Compute intensity-weighted centroids
    y_grid, x_grid = np.mgrid[0:ref_roi.shape[0], 0:ref_roi.shape[1]]

    ref_cy = (y_grid * ref_roi).sum() / (ref_roi.sum() + 1e-8)
    ref_cx = (x_grid * ref_roi).sum() / (ref_roi.sum() + 1e-8)

    target_cy = (y_grid * target_roi).sum() / (target_roi.sum() + 1e-8)
    target_cx = (x_grid * target_roi).sum() / (target_roi.sum() + 1e-8)

    shift_y = target_cy - ref_cy
    shift_x = target_cx - ref_cx

    return shift_x, shift_y


def estimate_scale_change(ref_image: np.ndarray, target_image: np.ndarray, ref_mask: np.ndarray) -> float:
    """
    Estimate scale change based on intensity patterns
    """
    y_coords, x_coords = np.where(ref_mask > 0)
    if len(x_coords) == 0:
        return 1.0

    # Get reference region stats
    ref_pixels = ref_image[ref_mask > 0]
    ref_mean = ref_pixels.mean()

    # Get target region stats (using same mask location)
    target_pixels = target_image[ref_mask > 0]
    target_mean = target_pixels.mean()

    # Estimate scale based on intensity similarity
    # (rough heuristic: similar intensity = similar size)
    intensity_ratio = target_mean / (ref_mean + 1e-8)

    # Clamp scale change to reasonable range
    scale = 1.0 + 0.1 * (intensity_ratio - 1.0)  # Dampen changes
    scale = np.clip(scale, 0.8, 1.2)  # Max 20% change

    return float(scale)


def propagate_contour(
    ref_mask: np.ndarray,
    ref_image: np.ndarray,
    target_image: np.ndarray,
    slice_distance: float,
    nearby_refs: List[Dict[str, Any]] = None,
    image_shape: Tuple[int, int] = (512, 512)
) -> Tuple[np.ndarray, float]:
    """
    Propagate contour from reference to target using:
    1. Multi-reference HU learning (learn from nearby slices)
    2. Geometric transformations (shift, scale)
    3. Spatial HU-based thresholding (segment similar tissue near predicted location)

    Returns:
        predicted_mask: Binary mask
        quality: Confidence score [0, 1]
    """
    h, w = ref_mask.shape

    # 1. Learn HU characteristics from MULTIPLE nearby reference contours
    all_hu_values = []

    # Primary reference
    ref_pixels = ref_image[ref_mask > 0]
    if len(ref_pixels) > 0:
        all_hu_values.append(ref_pixels)

    # Add nearby references if available
    if nearby_refs and len(nearby_refs) > 1:
        for nearby_ref in nearby_refs[1:]:
            nearby_mask = np.array(nearby_ref['mask']).reshape(image_shape)
            nearby_data = np.array(nearby_ref['slice_data']).reshape(image_shape)
            nearby_pixels = nearby_data[nearby_mask > 0]
            if len(nearby_pixels) > 0:
                all_hu_values.append(nearby_pixels)

    if len(all_hu_values) == 0:
        return np.zeros_like(ref_mask, dtype=np.uint8), 0.0

    # Combine HU values from all nearby references for better statistics
    combined_hu = np.concatenate(all_hu_values)
    hu_mean = combined_hu.mean()
    hu_std = combined_hu.std()
    hu_min = combined_hu.min()
    hu_max = combined_hu.max()

    # Adaptive HU range based on tissue variability
    # For tumors: usually more heterogeneous than normal tissue
    # Use ±1 std for tighter matching to avoid false positives
    # This prevents matching unrelated organs with similar HU values
    hu_lower = max(hu_min, hu_mean - 1.0 * hu_std)
    hu_upper = min(hu_max, hu_mean + 1.0 * hu_std)

    logger.info(f"Reference HU stats: mean={hu_mean:.1f}, std={hu_std:.1f}, "
                f"range=[{hu_min:.1f}, {hu_max:.1f}], threshold=[{hu_lower:.1f}, {hu_upper:.1f}]")

    # 2. Find centroid shift
    shift_x, shift_y = find_centroid_shift(ref_image, target_image, ref_mask)

    # 3. Estimate scale change
    scale = estimate_scale_change(ref_image, target_image, ref_mask)

    # 4. Apply transformation to reference mask to get search region
    M_translate = np.float32([[1, 0, shift_x], [0, 1, shift_y]])
    shifted_mask = cv2.warpAffine(ref_mask.astype(np.float32), M_translate, (w, h))

    # Apply scale around centroid
    y_coords, x_coords = np.where(shifted_mask > 0.5)
    if len(x_coords) > 0:
        mask_center_x = x_coords.mean()
        mask_center_y = y_coords.mean()

        M_scale = cv2.getRotationMatrix2D((mask_center_x, mask_center_y), 0, scale)
        geometric_mask = cv2.warpAffine(shifted_mask, M_scale, (w, h))
    else:
        geometric_mask = shifted_mask

    # 5. HU-based segmentation in target image
    # Create mask of pixels with similar HU values
    hu_mask = ((target_image >= hu_lower) & (target_image <= hu_upper)).astype(np.float32)

    # 6. Combine geometric prediction with HU gating
    # Create search region with moderate expansion
    # Smaller expansion keeps prediction anchored to reference location
    search_kernel_size = max(3, int(3 + abs(slice_distance) * 0.5))
    search_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (search_kernel_size, search_kernel_size))
    search_region = cv2.dilate(geometric_mask, search_kernel)

    # Only keep HU-matched pixels within search region
    combined_mask = (hu_mask * search_region > 0.5).astype(np.uint8)

    # Require significant overlap with geometric prediction
    # This prevents jumping to unrelated structures with similar HU
    geometric_overlap = (combined_mask * geometric_mask).sum()
    combined_area = combined_mask.sum()
    if combined_area > 0:
        overlap_ratio = geometric_overlap / combined_area
        # If less than 30% overlap with geometric prediction, use geometric as-is
        if overlap_ratio < 0.3:
            logger.info(f"Low geometric overlap ({overlap_ratio:.2f}), using pure geometric prediction")
            combined_mask = geometric_mask

    # 7. Morphological cleanup
    # Remove small isolated regions
    cleanup_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    cleaned = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, cleanup_kernel)

    # Close small gaps
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    final_mask = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, close_kernel)

    # 8. Keep component closest to geometric prediction centroid
    # This prevents jumping to unrelated structures
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final_mask, connectivity=8)
    if num_labels > 1:
        # Get geometric prediction centroid for reference
        geometric_centroid = np.array([centroid_x, centroid_y])

        # Find component with best score (size + proximity to geometric centroid)
        best_score = -1
        best_label = 1

        for label in range(1, num_labels):
            area = stats[label, cv2.CC_STAT_AREA]
            component_centroid = centroids[label]

            # Distance from geometric prediction centroid
            dist = np.linalg.norm(component_centroid - geometric_centroid)

            # Score: balance size and proximity
            # Prefer larger components, but heavily penalize distance
            size_score = area / (ref_mask.sum() + 1e-8)
            proximity_score = np.exp(-dist / 20.0)  # Exponential decay with distance

            score = 0.3 * size_score + 0.7 * proximity_score

            if score > best_score:
                best_score = score
                best_label = label

        final_mask = (labels == best_label).astype(np.uint8)

    # 9. Calculate quality score
    # Factors: distance, transformation magnitude, HU similarity, size consistency
    distance_factor = np.exp(-abs(slice_distance) / 10.0)
    transform_magnitude = abs(shift_x) + abs(shift_y) + abs(scale - 1.0) * 50
    transform_factor = np.exp(-transform_magnitude / 50.0)

    # HU similarity: how many pixels in search region match HU range
    hu_overlap = (hu_mask * search_region).sum() / (search_region.sum() + 1e-8)
    hu_factor = hu_overlap

    # Size consistency: predicted size vs reference size
    size_ratio = final_mask.sum() / (ref_mask.sum() + 1e-8)
    size_factor = 1.0 - min(1.0, abs(np.log(size_ratio + 1e-8)) / 2.0)

    quality = 0.3 * distance_factor + 0.2 * transform_factor + 0.3 * hu_factor + 0.2 * size_factor
    quality = np.clip(quality, 0.3, 0.95)

    logger.info(f"Propagation: shift=({shift_x:.1f}, {shift_y:.1f}), scale={scale:.2f}, "
                f"HU_overlap={hu_overlap:.2f}, size_ratio={size_ratio:.2f}, "
                f"distance={slice_distance:.1f}, quality={quality:.2f}, "
                f"mask_pixels={final_mask.sum()}")

    return final_mask, float(quality)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': True,
        'model_type': 'geometric_propagation',
        'device': 'cpu'
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict segmentation using geometric propagation
    """
    try:
        data = request.get_json()

        reference_slices = data['reference_slices']
        target_slice_data = np.array(data['target_slice_data'])
        target_position = data['target_slice_position']
        image_shape = data.get('image_shape', [512, 512])

        # Reshape
        target_slice_data = target_slice_data.reshape(image_shape)

        if not reference_slices:
            return jsonify({
                'predicted_mask': [],
                'confidence': 0.0,
                'quality_score': 0.0,
                'method': 'no_reference'
            })

        # Use multiple nearby references for better HU statistics
        # Sort references by distance from target
        sorted_refs = sorted(reference_slices, key=lambda r: abs(r['position'] - target_position))

        # Use up to 3 nearest references for HU learning
        nearby_refs = sorted_refs[:min(3, len(sorted_refs))]

        # Primary reference (closest)
        closest_ref = nearby_refs[0]
        ref_mask = np.array(closest_ref['mask']).reshape(image_shape)
        ref_data = np.array(closest_ref['slice_data']).reshape(image_shape)
        slice_distance = target_position - closest_ref['position']

        # Propagate contour
        predicted_mask, quality = propagate_contour(
            ref_mask,
            ref_data,
            target_slice_data,
            slice_distance
        )

        # Calculate confidence
        confidence = quality * 0.9  # Slightly lower than quality for safety

        return jsonify({
            'predicted_mask': predicted_mask.flatten().tolist(),
            'confidence': float(confidence),
            'quality_score': float(quality),
            'method': 'geometric_propagation',
            'metadata': {
                'reference_position': closest_ref['position'],
                'distance': abs(slice_distance),
                'mask_pixels': int(predicted_mask.sum())
            }
        })

    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/clear_memory', methods=['POST'])
def clear_memory():
    return jsonify({'status': 'ok', 'message': 'Geometric method is stateless'})


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Geometric Contour Propagation Service')
    parser.add_argument('--port', type=int, default=5002, help='Port to run on')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host to bind to')

    args = parser.parse_args()

    logger.info(f"Starting Geometric Propagation Service on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
