#!/usr/bin/env python3
"""
SAM-based Medical Image Segmentation Service
Uses Segment Anything Model (SAM) or MedSAM for interactive segmentation

MedSAM: Foundation model for medical image segmentation
Paper: "Segment Anything in Medical Images" (Nature Communications 2024)
GitHub: https://github.com/bowang-lab/MedSAM
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import OrderedDict
import numpy as np
import torch
import torch.nn.functional as F
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global model instance
sam_model = None
device = None


class MedSAMPredictor:
    """
    Wrapper for MedSAM/SAM model for medical image segmentation
    """

    def __init__(self, model_path: str, device: str = 'cpu'):
        self.device = torch.device(device)
        self.model = None
        self.model_type = None

        if model_path:
            self._load_model(model_path)
        else:
            logger.warning("No model path provided - predictions will fail")

    def _load_model(self, model_path: str):
        """Load MedSAM or SAM model from checkpoint"""
        try:
            from segment_anything import sam_model_registry, SamPredictor

            # Determine model type from path
            if 'medsam' in model_path.lower():
                model_type = 'vit_b'  # MedSAM uses ViT-B
                self.model_type = 'medsam'
                logger.info("Loading MedSAM model (ViT-B)")
            elif 'vit_h' in model_path.lower():
                model_type = 'vit_h'
                self.model_type = 'sam_vit_h'
                logger.info("Loading SAM model (ViT-H)")
            elif 'vit_l' in model_path.lower():
                model_type = 'vit_l'
                self.model_type = 'sam_vit_l'
                logger.info("Loading SAM model (ViT-L)")
            else:
                model_type = 'vit_b'
                self.model_type = 'sam_vit_b'
                logger.info("Loading SAM model (ViT-B)")

            # Load SAM model
            # First load weights to CPU manually to avoid CUDA requirement
            sam = sam_model_registry[model_type]()

            # Load checkpoint with CPU mapping
            checkpoint = torch.load(model_path, map_location='cpu')
            sam.load_state_dict(checkpoint)

            sam.to(device=self.device)
            sam.eval()

            # Create predictor
            self.model = SamPredictor(sam)

            # Count parameters
            total_params = sum(p.numel() for p in sam.parameters()) / 1e6

            logger.info(f"✅ {self.model_type} loaded successfully!")
            logger.info(f"   Parameters: {total_params:.1f}M")
            logger.info(f"   Device: {self.device}")

        except ImportError as e:
            logger.error(f"Failed to import segment_anything: {e}")
            logger.error("Install with: pip install segment-anything")
            raise
        except Exception as e:
            logger.error(f"Failed to load model: {e}", exc_info=True)
            raise

    def predict_from_contour(
        self,
        image: np.ndarray,
        reference_mask: np.ndarray,
        return_logits: bool = False
    ) -> Tuple[np.ndarray, float]:
        """
        Predict segmentation mask from a reference contour

        Args:
            image: 2D grayscale image (H, W) with pixel values
            reference_mask: Binary mask (H, W) from reference contour
            return_logits: If True, return logits instead of binary mask

        Returns:
            predicted_mask: Binary mask (H, W) or logits if return_logits=True
            quality_score: Confidence score [0, 1]
        """
        if self.model is None:
            raise ValueError("Model not loaded")

        try:
            # Prepare image for SAM (needs RGB, uint8)
            # Normalize grayscale CT to 0-255
            image_norm = ((image - image.min()) / (image.max() - image.min() + 1e-8) * 255).astype(np.uint8)

            # Convert to RGB by repeating channels
            image_rgb = np.stack([image_norm] * 3, axis=-1)  # (H, W, 3)

            # Set the image for SAM
            self.model.set_image(image_rgb)

            # Strategy: Use reference mask as a low-resolution mask prompt
            # SAM can take a mask prompt which guides the segmentation
            # This is the closest to "memory" that SAM supports

            # Extract positive points from reference mask for fallback
            y_coords, x_coords = np.where(reference_mask > 0)

            if len(x_coords) == 0:
                logger.warning("No positive pixels in reference mask")
                return np.zeros_like(reference_mask, dtype=np.uint8), 0.0

            # Get bounding box from reference mask
            y_min, y_max = y_coords.min(), y_coords.max()
            x_min, x_max = x_coords.min(), x_coords.max()
            bbox = np.array([x_min, y_min, x_max, y_max])

            # Get centroid as a point prompt
            center_x, center_y = int(x_coords.mean()), int(y_coords.mean())
            point_coords = np.array([[center_x, center_y]])
            point_labels = np.array([1])  # Positive point

            # Use reference mask as a mask prompt
            # SAM expects mask prompts as (1, 256, 256) float32
            # We need to resize the reference mask to SAM's mask size
            h, w = reference_mask.shape

            # Resize reference mask to 256x256 (SAM's mask input size)
            import cv2
            ref_mask_256 = cv2.resize(reference_mask.astype(np.float32), (256, 256), interpolation=cv2.INTER_LINEAR)

            # Add batch dimension and convert to SAM format
            mask_input = ref_mask_256[None, :, :].astype(np.float32)  # (1, 256, 256)

            # Predict with both point and mask prompts for better results
            masks, scores, logits = self.model.predict(
                point_coords=point_coords,
                point_labels=point_labels,
                box=bbox[None, :],  # Add batch dimension
                mask_input=mask_input,
                multimask_output=True,  # Get multiple proposals
                return_logits=return_logits
            )

            # Choose best mask based on IoU with reference
            best_idx = 0
            best_iou = 0.0
            for i, mask in enumerate(masks):
                intersection = np.logical_and(mask, reference_mask).sum()
                union = np.logical_or(mask, reference_mask).sum()
                iou = intersection / (union + 1e-8)
                if iou > best_iou:
                    best_iou = iou
                    best_idx = i

            predicted_mask = masks[best_idx].astype(np.uint8)
            quality_score = float(scores[best_idx])

            logger.info(f"SAM prediction: quality={quality_score:.3f}, IoU with reference={best_iou:.3f}, mask sum={predicted_mask.sum()}")

            return predicted_mask, quality_score

        except Exception as e:
            logger.error(f"Prediction failed: {e}", exc_info=True)
            return np.zeros_like(reference_mask, dtype=np.uint8), 0.0


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': sam_model is not None and sam_model.model is not None,
        'model_type': sam_model.model_type if sam_model and sam_model.model else None,
        'device': str(device)
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict segmentation for target slice using reference slice with mask

    Request JSON:
    {
        "reference_slices": [{"slice_data": [...], "mask": [...], "position": float}],
        "target_slice_data": [...],
        "target_slice_position": float,
        "image_shape": [rows, cols]
    }

    Response JSON:
    {
        "predicted_mask": [...],
        "confidence": float,
        "quality_score": float,
        "method": "medsam" or "sam"
    }
    """
    try:
        data = request.get_json()

        # Extract data
        reference_slices = data['reference_slices']
        target_slice_data = np.array(data['target_slice_data'])
        target_position = data['target_slice_position']
        image_shape = data.get('image_shape', [512, 512])

        # Reshape target slice
        target_slice_data = target_slice_data.reshape(image_shape)

        # Use closest reference slice
        if not reference_slices:
            return jsonify({
                'predicted_mask': [],
                'confidence': 0.0,
                'quality_score': 0.0,
                'method': 'no_reference'
            })

        # Find closest reference
        closest_ref = min(reference_slices, key=lambda r: abs(r['position'] - target_position))
        ref_mask = np.array(closest_ref['mask']).reshape(image_shape)

        # Predict using SAM
        predicted_mask, quality = sam_model.predict_from_contour(
            target_slice_data,
            ref_mask
        )

        # Calculate confidence based on quality and mask size
        mask_ratio = predicted_mask.sum() / predicted_mask.size
        confidence = quality * (0.7 + 0.3 * min(mask_ratio / 0.1, 1.0))  # Boost if reasonable size

        return jsonify({
            'predicted_mask': predicted_mask.flatten().tolist(),
            'confidence': float(confidence),
            'quality_score': float(quality),
            'method': sam_model.model_type,
            'metadata': {
                'reference_position': closest_ref['position'],
                'distance': abs(target_position - closest_ref['position']),
                'mask_pixels': int(predicted_mask.sum())
            }
        })

    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/clear_memory', methods=['POST'])
def clear_memory():
    """Clear all stored memory"""
    # SAM doesn't use memory, but keep endpoint for compatibility
    return jsonify({'status': 'ok', 'message': 'SAM does not use memory'})


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='SAM Medical Segmentation Service')
    parser.add_argument('--port', type=int, default=5002, help='Port to run on')
    parser.add_argument('--model-path', type=str, required=True, help='Path to SAM/MedSAM checkpoint')
    parser.add_argument('--device', type=str, default='cpu', help='Device (cpu or cuda)')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host to bind to')

    args = parser.parse_args()

    device = torch.device(args.device)
    logger.info(f"Initializing SAM service on {args.device}")

    # Load model
    sam_model = MedSAMPredictor(args.model_path, args.device)

    logger.info(f"Starting SAM service on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
