#!/usr/bin/env python3
"""
Fast Shape-Aware Contour Propagation
Uses shape continuity + intensity matching for robust next-slice prediction
"""

import os
import logging
from typing import List, Dict, Any, Tuple
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
from scipy.ndimage import binary_dilation, binary_erosion, gaussian_filter
from scipy.spatial.distance import directed_hausdorff

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


def estimate_shape_evolution(
    masks: List[np.ndarray],
    positions: List[float],
    target_position: float
) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Estimate shape at target position using linear regression on shape parameters

    Returns:
        predicted_centroid: (x, y)
        predicted_bbox: (x, y, w, h)
        predicted_area: float
    """
    if len(masks) == 0:
        raise ValueError("Need at least one reference mask")

    # Extract shape parameters from each reference
    centroids = []
    areas = []
    bboxes = []

    for mask in masks:
        if mask.sum() == 0:
            continue

        # Centroid
        M = cv2.moments(mask.astype(np.uint8))
        if M['m00'] > 0:
            cx = M['m10'] / M['m00']
            cy = M['m01'] / M['m00']
            centroids.append([cx, cy])
            areas.append(mask.sum())

            # Bounding box
            y_coords, x_coords = np.where(mask > 0)
            x_min, x_max = x_coords.min(), x_coords.max()
            y_min, y_max = y_coords.min(), y_coords.max()
            bboxes.append([x_min, y_min, x_max - x_min, y_max - y_min])

    if len(centroids) == 0:
        raise ValueError("All masks are empty")

    centroids = np.array(centroids)
    areas = np.array(areas)
    bboxes = np.array(bboxes)

    # If only one reference, use it directly
    if len(masks) == 1:
        return centroids[0], bboxes[0], areas[0]

    # Linear extrapolation based on position
    # Fit centroid_x = a * position + b
    positions_array = np.array(positions[:len(centroids)])

    def fit_and_predict(values, positions, target_pos):
        if len(values) == 1:
            return values[0]
        # Simple linear regression
        A = np.vstack([positions, np.ones(len(positions))]).T
        coeffs, _, _, _ = np.linalg.lstsq(A, values, rcond=None)
        return coeffs[0] * target_pos + coeffs[1]

    pred_cx = fit_and_predict(centroids[:, 0], positions_array, target_position)
    pred_cy = fit_and_predict(centroids[:, 1], positions_array, target_position)
    pred_area = fit_and_predict(areas, positions_array, target_position)

    # Predict bbox
    pred_bbox = np.zeros(4)
    for i in range(4):
        pred_bbox[i] = fit_and_predict(bboxes[:, i], positions_array, target_position)

    return np.array([pred_cx, pred_cy]), pred_bbox, pred_area


def learn_intensity_distribution(
    masks: List[np.ndarray],
    images: List[np.ndarray]
) -> Tuple[float, float, float, float]:
    """
    Learn HU distribution from multiple reference masks
    Returns: mean, std, min, max with robust statistics
    """
    all_pixels = []

    for mask, image in zip(masks, images):
        if mask.sum() > 0:
            pixels = image[mask > 0]
            all_pixels.append(pixels)

    if len(all_pixels) == 0:
        raise ValueError("No pixels in reference masks")

    combined = np.concatenate(all_pixels)

    # Use robust statistics (percentiles instead of min/max)
    mean = np.median(combined)  # Median more robust than mean
    std = np.std(combined)
    hu_min = np.percentile(combined, 5)   # 5th percentile
    hu_max = np.percentile(combined, 95)  # 95th percentile

    return mean, std, hu_min, hu_max


def create_shape_prior(
    centroid: np.ndarray,
    bbox: np.ndarray,
    area: float,
    shape: Tuple[int, int]
) -> np.ndarray:
    """
    Create a probability map centered on predicted shape
    Higher probability near expected centroid and within expected size
    """
    h, w = shape
    cx, cy = centroid
    bx, by, bw, bh = bbox

    # Create distance map from predicted centroid
    y_grid, x_grid = np.ogrid[:h, :w]
    dist_from_centroid = np.sqrt((x_grid - cx)**2 + (y_grid - cy)**2)

    # Expected radius from area
    expected_radius = np.sqrt(area / np.pi)

    # Gaussian falloff from centroid (sigma = expected radius)
    spatial_prior = np.exp(-(dist_from_centroid**2) / (2 * (expected_radius * 1.5)**2))

    # Also create bbox prior
    bbox_mask = np.zeros(shape, dtype=np.float32)
    bx_int = int(max(0, bx - bw * 0.3))
    by_int = int(max(0, by - bh * 0.3))
    bx_max = int(min(w, bx + bw * 1.3))
    by_max = int(min(h, by + bh * 1.3))
    bbox_mask[by_int:by_max, bx_int:bx_max] = 1.0

    # Combine spatial and bbox priors
    shape_prior = spatial_prior * bbox_mask

    # Normalize
    if shape_prior.max() > 0:
        shape_prior /= shape_prior.max()

    return shape_prior


def propagate_smart(
    reference_masks: List[np.ndarray],
    reference_images: List[np.ndarray],
    reference_positions: List[float],
    target_image: np.ndarray,
    target_position: float
) -> Tuple[np.ndarray, float]:
    """
    Smart propagation using shape evolution + intensity matching

    Algorithm:
    1. Estimate shape evolution (centroid, size, bbox) from multiple references
    2. Learn intensity distribution from references
    3. Create shape prior (probability map based on expected shape)
    4. Find pixels with matching intensity AND high shape prior
    5. Refine with morphology and connected components
    """
    h, w = target_image.shape

    # Step 1: Estimate shape evolution
    pred_centroid, pred_bbox, pred_area = estimate_shape_evolution(
        reference_masks, reference_positions, target_position
    )

    logger.info(f"Shape prediction: centroid=({pred_centroid[0]:.1f}, {pred_centroid[1]:.1f}), "
                f"area={pred_area:.0f}, bbox={pred_bbox}")

    # Step 2: Learn intensity distribution (tight)
    hu_mean, hu_std, hu_min, hu_max = learn_intensity_distribution(
        reference_masks, reference_images
    )

    # Tight HU range: median ± 0.75*std, bounded by 5th/95th percentiles
    hu_lower = max(hu_min, hu_mean - 0.75 * hu_std)
    hu_upper = min(hu_max, hu_mean + 0.75 * hu_std)

    logger.info(f"Intensity: median={hu_mean:.1f}, std={hu_std:.1f}, "
                f"range=[{hu_lower:.1f}, {hu_upper:.1f}]")

    # Step 3: Create shape prior
    shape_prior = create_shape_prior(pred_centroid, pred_bbox, pred_area, (h, w))

    # Step 4: Intensity matching
    intensity_mask = ((target_image >= hu_lower) & (target_image <= hu_upper)).astype(np.float32)

    # Step 5: Combine with shape prior
    # Multiply: only keep pixels that match BOTH intensity AND shape expectation
    combined_score = intensity_mask * shape_prior

    # Threshold combined score
    # Use adaptive threshold based on distribution
    if combined_score.max() > 0:
        # Otsu-like threshold on combined score
        threshold = np.percentile(combined_score[combined_score > 0], 50)
        candidate_mask = (combined_score > threshold).astype(np.uint8)
    else:
        candidate_mask = np.zeros((h, w), dtype=np.uint8)

    logger.info(f"Candidate pixels: {candidate_mask.sum()}, threshold={threshold:.3f}")

    # Step 6: Morphological refinement
    # Close small gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    candidate_mask = cv2.morphologyEx(candidate_mask, cv2.MORPH_CLOSE, kernel)

    # Remove small noise
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    candidate_mask = cv2.morphologyEx(candidate_mask, cv2.MORPH_OPEN, kernel_small)

    # Step 7: Connected components - keep closest to predicted centroid
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        candidate_mask, connectivity=8
    )

    if num_labels <= 1:
        # No components found - fall back to shape prior
        logger.warning("No candidates found, using shape prior fallback")
        fallback_mask = (shape_prior > 0.5).astype(np.uint8)
        return fallback_mask, 0.3

    # Find component closest to predicted centroid with reasonable size
    best_label = 1
    best_score = -1

    for label in range(1, num_labels):
        component_centroid = centroids[label]
        component_area = stats[label, cv2.CC_STAT_AREA]

        # Distance from predicted centroid
        dist = np.linalg.norm(component_centroid - pred_centroid)

        # Size similarity
        area_ratio = min(component_area, pred_area) / max(component_area, pred_area)

        # Score: heavily weight proximity, moderate weight on size
        score = 0.7 * np.exp(-dist / 30.0) + 0.3 * area_ratio

        if score > best_score:
            best_score = score
            best_label = label

    final_mask = (labels == best_label).astype(np.uint8)

    # Step 8: Calculate quality score
    final_area = final_mask.sum()
    area_ratio = min(final_area, pred_area) / max(final_area, pred_area) if pred_area > 0 else 0

    # Check centroid alignment
    if final_mask.sum() > 0:
        M = cv2.moments(final_mask)
        if M['m00'] > 0:
            final_cx = M['m10'] / M['m00']
            final_cy = M['m01'] / M['m00']
            centroid_dist = np.linalg.norm([final_cx - pred_centroid[0],
                                           final_cy - pred_centroid[1]])
            centroid_score = np.exp(-centroid_dist / 20.0)
        else:
            centroid_score = 0
    else:
        centroid_score = 0

    # Quality: combine area match + centroid alignment
    quality = 0.5 * area_ratio + 0.5 * centroid_score
    quality = np.clip(quality, 0.3, 0.95)  # Min confidence 0.3

    logger.info(f"Result: area={final_area:.0f} (pred={pred_area:.0f}), "
                f"area_ratio={area_ratio:.2f}, centroid_score={centroid_score:.2f}, "
                f"quality={quality:.2f}")

    return final_mask, float(quality)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': True,
        'model_type': 'fast_shape_propagation',
        'device': 'cpu'
    })


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        reference_slices = data['reference_slices']
        target_slice_data = np.array(data['target_slice_data'])
        target_position = data['target_slice_position']
        image_shape = data.get('image_shape', [512, 512])

        target_slice_data = target_slice_data.reshape(image_shape)

        if not reference_slices:
            return jsonify({
                'predicted_mask': [],
                'confidence': 0.0,
                'quality_score': 0.0,
                'method': 'no_reference'
            })

        # Sort by distance and take up to 3 nearest
        sorted_refs = sorted(reference_slices,
                           key=lambda r: abs(r['position'] - target_position))
        nearby_refs = sorted_refs[:min(3, len(sorted_refs))]

        # Extract masks, images, positions
        masks = []
        images = []
        positions = []

        for ref in nearby_refs:
            mask = np.array(ref['mask']).reshape(image_shape)
            image = np.array(ref['slice_data']).reshape(image_shape)
            pos = ref['position']

            if mask.sum() > 0:  # Only include non-empty masks
                masks.append(mask)
                images.append(image)
                positions.append(pos)

        if len(masks) == 0:
            return jsonify({
                'predicted_mask': [],
                'confidence': 0.0,
                'quality_score': 0.0,
                'method': 'empty_reference'
            })

        logger.info(f"Predicting with {len(masks)} references for target at {target_position}")

        # Run smart propagation
        predicted_mask, quality = propagate_smart(
            masks, images, positions,
            target_slice_data, target_position
        )

        confidence = quality * 0.9

        return jsonify({
            'predicted_mask': predicted_mask.flatten().tolist(),
            'confidence': float(confidence),
            'quality_score': float(quality),
            'method': 'fast_shape_propagation',
            'mask_sum': int(predicted_mask.sum())
        })

    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5002)
    parser.add_argument('--host', type=str, default='127.0.0.1')
    args = parser.parse_args()

    logger.info(f"Starting Fast Shape Propagation Service on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
