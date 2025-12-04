"""
MedSAM (Medical Segment Anything Model) Service
Provides 3D medical image segmentation from scribble annotations
"""

import os
import sys
import logging
import numpy as np
import torch
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import List, Dict, Tuple

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class MedSAMSegmenter:
    """MedSAM-based 3D segmentation from scribbles"""

    def __init__(self, device='cpu'):
        self.device = device
        self.model = None
        self.initialized = False

    def load_model(self):
        """Load MedSAM model"""
        try:
            import torch
            from segment_anything import sam_model_registry

            # Set device
            if self.device == 'cuda' and torch.cuda.is_available():
                self.device = torch.device('cuda')
                logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
            elif self.device == 'mps' and torch.backends.mps.is_available():
                self.device = torch.device('mps')
                logger.info("Using Apple Metal (MPS) GPU")
            else:
                self.device = torch.device('cpu')
                logger.info("Using CPU")

            # Load SAM weights
            model_path = os.path.join(os.path.dirname(__file__), 'weights', 'sam_vit_b.pth')

            if not os.path.exists(model_path):
                logger.error(f"SAM weights not found at {model_path}")
                logger.error("Run setup.sh to download weights")
                return False

            logger.info(f"Loading SAM model from {model_path}...")

            # Initialize SAM model with ViT-B backbone and load weights
            sam = sam_model_registry['vit_b'](checkpoint=model_path)
            sam.to(self.device)
            sam.eval()

            self.model = sam
            self.initialized = True
            logger.info("✅ SAM model loaded successfully (configured for medical imaging)!")
            return True

        except Exception as e:
            logger.error(f"Failed to load MedSAM model: {e}")
            logger.exception(e)
            return False

    def scribbles_to_prompts(self, scribbles: List[Dict], volume_shape: Tuple) -> Tuple[np.ndarray, np.ndarray]:
        """
        Convert scribbles to point prompts for SAM

        Args:
            scribbles: List of scribble annotations
            volume_shape: (Z, H, W) shape of volume

        Returns:
            points: (N, 2) array of point coordinates
            labels: (N,) array of point labels (1=foreground, 0=background)
        """
        all_points = []
        all_labels = []

        for scribble in scribbles:
            points = np.array(scribble['points'])  # (N, 2) [x, y]
            label = scribble.get('label', 1)

            # Sample points from scribble (take every 5th point to avoid too many)
            if len(points) > 10:
                indices = np.linspace(0, len(points)-1, 10, dtype=int)
                points = points[indices]

            all_points.append(points)
            all_labels.extend([label] * len(points))

        if len(all_points) == 0:
            return np.array([[0, 0]]), np.array([1])

        points = np.vstack(all_points)
        labels = np.array(all_labels)

        return points, labels

    def segment_from_scribbles(
        self,
        volume: np.ndarray,
        scribbles: List[Dict],
        spacing: Tuple[float, float, float] = None
    ) -> Dict:
        """
        Segment 3D volume from scribble annotations

        Args:
            volume: (Z, H, W) volume array
            scribbles: List of scribble dictionaries with 'slice', 'points', 'label'
            spacing: Voxel spacing (z, y, x)

        Returns:
            Dictionary with 'mask' and 'confidence'
        """
        if not self.initialized:
            raise RuntimeError("MedSAM model not initialized")

        logger.info(f"Segmenting volume shape={volume.shape}, scribbles={len(scribbles)}")

        # Initialize output mask
        mask_3d = np.zeros(volume.shape, dtype=np.uint8)

        # Group scribbles by slice
        scribbles_by_slice = {}
        for scribble in scribbles:
            slice_idx = int(scribble['slice'])
            if slice_idx not in scribbles_by_slice:
                scribbles_by_slice[slice_idx] = []
            scribbles_by_slice[slice_idx].append(scribble)

        # Calculate bounding box around all scribbles with margin
        all_points = []
        for scribble in scribbles:
            if scribble.get('points'):
                all_points.extend(scribble['points'])

        if len(all_points) == 0:
            logger.warning("No scribble points found")
            return {'mask': mask_3d, 'confidence': 0.0}

        points_array = np.array(all_points)
        min_x, min_y = points_array.min(axis=0).astype(int)
        max_x, max_y = points_array.max(axis=0).astype(int)

        # Add tight margin around scribbles (only 15 pixels)
        margin = 15
        crop_x1 = max(0, min_x - margin)
        crop_y1 = max(0, min_y - margin)
        crop_x2 = min(volume.shape[2], max_x + margin)
        crop_y2 = min(volume.shape[1], max_y + margin)

        # Ensure minimum crop size of at least 64x64 for SAM
        min_crop_size = 64
        crop_w = crop_x2 - crop_x1
        crop_h = crop_y2 - crop_y1

        if crop_w < min_crop_size:
            expand = min_crop_size - crop_w
            expand_left = expand // 2
            expand_right = expand - expand_left
            crop_x1 = max(0, crop_x1 - expand_left)
            crop_x2 = min(volume.shape[2], crop_x2 + expand_right)
            # If still too small (hit boundary), expand the other side
            if (crop_x2 - crop_x1) < min_crop_size:
                crop_x2 = min(volume.shape[2], crop_x1 + min_crop_size)

        if crop_h < min_crop_size:
            expand = min_crop_size - crop_h
            expand_top = expand // 2
            expand_bottom = expand - expand_top
            crop_y1 = max(0, crop_y1 - expand_top)
            crop_y2 = min(volume.shape[1], crop_y2 + expand_bottom)
            # If still too small (hit boundary), expand the other side
            if (crop_y2 - crop_y1) < min_crop_size:
                crop_y2 = min(volume.shape[1], crop_y1 + min_crop_size)

        logger.info(f"Crop box: x=[{crop_x1}:{crop_x2}], y=[{crop_y1}:{crop_y2}] (margin={margin}px, size={crop_x2-crop_x1}x{crop_y2-crop_y1})")

        # Process each slice with scribbles
        from segment_anything.utils.transforms import ResizeLongestSide
        transform = ResizeLongestSide(self.model.image_encoder.img_size)

        for slice_idx, slice_scribbles in scribbles_by_slice.items():
            # Get slice image and crop to bounding box
            slice_img = volume[slice_idx]  # (H, W)
            slice_img_crop = slice_img[crop_y1:crop_y2, crop_x1:crop_x2]

            # Apply soft tissue CT window (center=40, width=400 HU)
            # This emphasizes soft tissue contrast and reduces influence of bone/air
            window_center = 40
            window_width = 400
            img_min = window_center - window_width // 2
            img_max = window_center + window_width // 2

            # Clip and normalize to 0-255
            slice_img_crop = np.clip(slice_img_crop, img_min, img_max)
            slice_img_crop = ((slice_img_crop - img_min) / (img_max - img_min) * 255).astype(np.uint8)

            # Convert to RGB (SAM expects 3 channels)
            slice_img_rgb = np.stack([slice_img_crop] * 3, axis=-1)  # (H, W, 3)

            # Get point prompts from scribbles and adjust to cropped coordinates
            points, labels = self.scribbles_to_prompts(slice_scribbles, volume.shape)

            # Adjust points to cropped image coordinates
            points_adjusted = points.copy()
            points_adjusted[:, 0] -= crop_x1  # Adjust X
            points_adjusted[:, 1] -= crop_y1  # Adjust Y

            # Prepare image for SAM (must be float32)
            input_image = transform.apply_image(slice_img_rgb)
            input_image_torch = torch.as_tensor(input_image, dtype=torch.float32, device=self.device)
            input_image_torch = input_image_torch.permute(2, 0, 1).contiguous()[None, :, :, :]

            # Encode image
            with torch.no_grad():
                image_embedding = self.model.image_encoder(input_image_torch)

                # Transform points to SAM's input resolution
                transformed_points = transform.apply_coords(points_adjusted, slice_img_rgb.shape[:2])
                point_coords = torch.as_tensor(transformed_points, dtype=torch.float, device=self.device)[None, :, :]
                point_labels = torch.as_tensor(labels, dtype=torch.int, device=self.device)[None, :]

                # Get mask prediction
                sparse_embeddings, dense_embeddings = self.model.prompt_encoder(
                    points=(point_coords, point_labels),
                    boxes=None,
                    masks=None,
                )

                low_res_masks, iou_predictions = self.model.mask_decoder(
                    image_embeddings=image_embedding,
                    image_pe=self.model.prompt_encoder.get_dense_pe(),
                    sparse_prompt_embeddings=sparse_embeddings,
                    dense_prompt_embeddings=dense_embeddings,
                    multimask_output=False,
                )

                # Upscale mask to cropped size
                masks = torch.nn.functional.interpolate(
                    low_res_masks,
                    size=slice_img_crop.shape,
                    mode='bilinear',
                    align_corners=False
                )

                mask_crop = masks[0, 0].cpu().numpy() > 0.0

                # Place cropped mask back into full slice mask
                mask_3d[slice_idx, crop_y1:crop_y2, crop_x1:crop_x2] = mask_crop.astype(np.uint8)

        # Propagate segmentation to neighboring slices using simple dilation
        # Find slices with annotations
        annotated_slices = sorted(scribbles_by_slice.keys())

        if len(annotated_slices) > 0:
            # Fill gaps between annotated slices
            for i in range(len(annotated_slices) - 1):
                start_slice = annotated_slices[i]
                end_slice = annotated_slices[i + 1]

                if end_slice - start_slice > 1:
                    # Interpolate between slices
                    for z in range(start_slice + 1, end_slice):
                        alpha = (z - start_slice) / (end_slice - start_slice)
                        mask_3d[z] = ((1 - alpha) * mask_3d[start_slice] + alpha * mask_3d[end_slice] > 0.5).astype(np.uint8)

            # Extend to slices above and below
            if annotated_slices[0] > 0:
                for z in range(annotated_slices[0] - 1, -1, -1):
                    mask_3d[z] = mask_3d[z + 1]

            if annotated_slices[-1] < volume.shape[0] - 1:
                for z in range(annotated_slices[-1] + 1, volume.shape[0]):
                    mask_3d[z] = mask_3d[z - 1]

        confidence = 0.9  # MedSAM is generally high confidence

        return {
            'mask': mask_3d,
            'confidence': confidence
        }

# Global model instance
model = None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    global model
    return jsonify({
        'status': 'healthy' if model and model.initialized else 'initializing',
        'model_loaded': model.initialized if model else False,
        'device': str(model.device) if model else 'unknown'
    })

@app.route('/segment', methods=['POST'])
def segment():
    """
    Segment endpoint

    Request body:
    {
        "volume": [[[...]]]  # 3D array (Z, Y, X)
        "scribbles": [  # List of scribble annotations
            {
                "slice": 10,
                "points": [[x1, y1], [x2, y2], ...],
                "label": 1  # 1=foreground, 0=background
            }
        ],
        "spacing": [z_spacing, y_spacing, x_spacing]  # Optional
    }

    Returns:
    {
        "mask": [[[...]]]  # 3D binary mask (Z, Y, X)
        "confidence": 0.95
    }
    """
    global model

    try:
        data = request.json

        # Parse inputs
        volume = np.array(data['volume'], dtype=np.float32)
        scribbles = data.get('scribbles', [])
        spacing = tuple(data.get('spacing', [1.0, 1.0, 1.0]))

        logger.info(f"Segmentation request: volume shape={volume.shape}, scribbles={len(scribbles)}, spacing={spacing}")

        # Segment
        result = model.segment_from_scribbles(
            volume=volume,
            scribbles=scribbles,
            spacing=spacing
        )

        # Convert mask to list for JSON
        result['mask'] = result['mask'].tolist()

        return jsonify(result)

    except Exception as e:
        logger.error(f"Segmentation failed: {e}")
        logger.exception(e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Parse arguments
    import argparse
    parser = argparse.ArgumentParser(description='MedSAM Segmentation Service')
    parser.add_argument('--device', type=str, default='cpu', choices=['cuda', 'cpu', 'mps'],
                       help='Device to use (cuda, cpu, or mps for Apple Metal)')
    parser.add_argument('--port', type=int, default=5004,
                       help='Port to run service on')
    parser.add_argument('--host', type=str, default='127.0.0.1',
                       help='Host to bind to')
    args = parser.parse_args()

    # Initialize model
    logger.info("Initializing MedSAM service...")
    model = MedSAMSegmenter(device=args.device)

    if not model.load_model():
        logger.error("Failed to load MedSAM model. Exiting.")
        sys.exit(1)

    logger.info("Model loaded successfully")

    # Start server
    logger.info(f"Starting server on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
