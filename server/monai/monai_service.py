#!/usr/bin/env python3
"""
MONAI Propagation Service
------------------------

Lightweight Flask service that uses MONAI (or a morphology-based fallback) to
propagate a 2D contour to a neighbouring slice. The API mirrors the SegVol
service so the frontend can A/B test both pipelines.
"""

from __future__ import annotations

import os
import sys
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

# Optional heavy imports (Torch/MONAI) – we guard them so the service can still
# run in mock mode if MONAI or weights are unavailable.
try:
    import torch
    from monai.networks.nets import UNet
    from monai.transforms import (
        Compose,
        AddChannel,
        NormalizeIntensity,
        Resize,
        ToTensor,
    )
    HAS_MONAI = True
except Exception as exc:  # pragma: no cover - dev convenience
    HAS_MONAI = False
    torch = None  # type: ignore[assignment]
    logging.getLogger(__name__).warning(
        "MONAI/torch import failed (%s). Service will run in MOCK mode.", exc
    )

try:
    from huggingface_hub import hf_hub_download
    from huggingface_hub.utils import LocalEntryNotFoundError
except Exception:  # pragma: no cover - fallback when huggingface_hub missing
    hf_hub_download = None  # type: ignore[assignment]

try:
    from skimage.measure import find_contours
except ImportError:
    find_contours = None  # type: ignore[assignment]

from scipy.ndimage import gaussian_filter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("monai_service")

app = Flask(__name__)
CORS(app)


def contour_to_mask(contour: np.ndarray, shape: Tuple[int, int]) -> np.ndarray:
    """Rasterise an (N,2) contour into a binary mask."""
    mask = np.zeros(shape, dtype=np.uint8)
    if contour.size == 0:
        return mask

    from skimage.draw import polygon

    rr, cc = polygon(contour[:, 1], contour[:, 0], shape)
    mask[rr, cc] = 1
    return mask


def mask_to_contour(mask: np.ndarray) -> np.ndarray:
    """Extract the largest contour from a binary mask."""
    if find_contours is None:
        return np.empty((0, 2), dtype=np.float32)

    contours = find_contours(mask, 0.5)
    if not contours:
        return np.empty((0, 2), dtype=np.float32)
    largest = max(contours, key=len)
    return np.column_stack([largest[:, 1], largest[:, 0]])  # (x, y)


class MonaiPredictor:
    """Wrapper around a small MONAI UNet – falls back to morphology when weights missing."""

    def __init__(self, device: str = "cpu"):
        self.device_name = device
        self.device = torch.device("cpu")
        self.model: Optional[torch.nn.Module] = None
        self.initialized = False
        self.mode = "mock"  # mock | monai

        if not HAS_MONAI:
            logger.warning("MONAI not available; using morphology fallback.")
            self.initialized = True
            return

        if device == "cuda" and torch.cuda.is_available():
            self.device = torch.device("cuda")
        elif device == "mps" and getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():  # type: ignore[attr-defined]
            self.device = torch.device("mps")
        else:
            self.device = torch.device("cpu")
            if device == "cuda":
                logger.warning("CUDA requested but unavailable – running MONAI on CPU.")

        self.transforms = Compose(
            [
                AddChannel(),
                NormalizeIntensity(nonzero=True, channel_wise=True),
                Resize(spatial_size=(256, 256), mode="bilinear"),
                ToTensor(),
            ]
        )

        self._load_model()

    def _weights_dir(self) -> Path:
        default_dir = Path(__file__).parent / "weights"
        return Path(os.environ.get("MONAI_WEIGHTS_DIR", default_dir)).resolve()

    def _load_model(self) -> None:
        weight_path_env = os.environ.get("MONAI_MODEL_PATH")
        weights_dir = self._weights_dir()
        weights_dir.mkdir(parents=True, exist_ok=True)

        weight_path: Optional[Path] = None

        if weight_path_env:
            candidate = Path(weight_path_env).expanduser()
            if candidate.exists():
                weight_path = candidate
            else:
                logger.warning("MONAI_MODEL_PATH '%s' not found.", candidate)

        if weight_path is None:
            # Try HuggingFace cache (optional – requires huggingface_hub)
            repo_id = os.environ.get("MONAI_REPO_ID", "Project-MONAI/segmentation_torchscript")
            filename = os.environ.get("MONAI_REPO_FILENAME", "spleen_ct_segmentation.pt")
            if hf_hub_download is not None:
                try:
                    weight_path_str = hf_hub_download(
                        repo_id=repo_id,
                        filename=filename,
                        cache_dir=str(weights_dir),
                        local_files_only=not bool(os.environ.get("MONAI_ALLOW_DOWNLOAD", "0") in {"1", "true", "yes"}),
                    )
                    weight_path = Path(weight_path_str)
                except LocalEntryNotFoundError:
                    logger.info("MONAI weights not cached locally and downloads disabled.")
                except Exception as exc:
                    logger.warning("Failed to download MONAI weights: %s", exc)

        if weight_path is None or not weight_path.exists():
            logger.warning("No MONAI weights available – falling back to morphology mode.")
            self.initialized = True
            self.mode = "mock"
            return

        # Build a lightweight UNet aligned with MONAI examples.
        try:
            model = UNet(
                spatial_dims=2,
                in_channels=1,
                out_channels=1,
                channels=(16, 32, 64, 128, 256),
                strides=(2, 2, 2, 2),
                num_res_units=2,
                norm="batch",
            )
            state = torch.load(weight_path, map_location="cpu")
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            model.load_state_dict(state, strict=False)
            model.to(self.device)
            model.eval()
            self.model = model
            self.mode = "monai"
            self.initialized = True
            logger.info("Loaded MONAI UNet weights from %s", weight_path)
        except Exception as exc:  # pragma: no cover - depends on external weights
            logger.error("Failed to load MONAI weights: %s", exc)
            logger.info("Reverting to morphology fallback.")
            self.model = None
            self.mode = "mock"
            self.initialized = True

    def _run_monai(self, image: np.ndarray) -> np.ndarray:
        assert self.model is not None
        input_tensor = self.transforms(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(input_tensor)
            probs = torch.sigmoid(logits)[0, 0]
        mask = probs.cpu().numpy()
        mask = (mask > 0.5).astype(np.uint8)
        # Resize back to original shape
        from skimage.transform import resize

        mask = resize(mask, image.shape, order=1, anti_aliasing=False, preserve_range=True)
        return (mask > 0.5).astype(np.uint8)

    def _fallback_predict(
        self,
        reference_contour: np.ndarray,
        reference_slice: np.ndarray,
        target_slice: np.ndarray,
    ) -> np.ndarray:
        """Very simple morphology-based propagation."""
        ref_mask = contour_to_mask(reference_contour, reference_slice.shape)
        if ref_mask.sum() == 0:
            return np.zeros_like(ref_mask)

        ref_mean = reference_slice[ref_mask == 1].mean()
        ref_std = reference_slice[ref_mask == 1].std()
        ref_std = max(ref_std, 1e-3)

        z_score = (target_slice - ref_mean) / ref_std
        candidate = (np.abs(z_score) <= 2.0).astype(np.float32)
        candidate = gaussian_filter(candidate, sigma=1.5)

        thresh = candidate > 0.4
        thresh = thresh.astype(np.uint8)

        # Encourage similarity by combining with dilated ref mask
        from scipy.ndimage import binary_dilation, binary_erosion

        dilated = binary_dilation(ref_mask, iterations=2)
        eroded = binary_erosion(ref_mask, iterations=1)

        combined = np.logical_or(
            np.logical_and(thresh, dilated),
            eroded,
        ).astype(np.uint8)
        return combined

    def predict(
        self,
        reference_contour: np.ndarray,
        reference_slice: np.ndarray,
        target_slice: np.ndarray,
    ) -> Dict[str, Any]:
        if self.mode == "monai" and self.model is not None:
            try:
                mask = self._run_monai(target_slice)
                method = "monai_unet"
            except Exception as exc:  # pragma: no cover
                logger.error("MONAI inference failed (%s); using fallback.", exc)
                mask = self._fallback_predict(reference_contour, reference_slice, target_slice)
                method = "monai_fallback"
        else:
            mask = self._fallback_predict(reference_contour, reference_slice, target_slice)
            method = "morphology"

        contour = mask_to_contour(mask)
        return {
            "mask": mask,
            "contour": contour,
            "method": method,
        }


predictor: Optional[MonaiPredictor] = None


def ensure_predictor() -> MonaiPredictor:
    global predictor
    if predictor is None:
        device = os.environ.get("MONAI_DEVICE", "cpu")
        predictor = MonaiPredictor(device=device)
    return predictor


@app.route("/health", methods=["GET"])
def health() -> Any:
    try:
        pred = ensure_predictor()
        return jsonify(
            {
                "status": "healthy" if pred.initialized else "loading",
                "mode": pred.mode,
                "device": str(pred.device),
                "monai_available": HAS_MONAI,
            }
        )
    except Exception as exc:  # pragma: no cover
        logger.error("Health check failed: %s", exc)
        return jsonify({"status": "error", "error": str(exc)}), 500


@app.route("/predict", methods=["POST"])
def predict_endpoint() -> Any:
    pred = ensure_predictor()
    if not pred.initialized:
        return jsonify({"error": "Predictor failed to initialise"}), 503

    try:
        payload = request.get_json(force=True)
        reference_contour = np.array(payload.get("reference_contour", []), dtype=np.float32)
        ref_slice_data = np.array(payload.get("reference_slice_data", []), dtype=np.float32)
        tgt_slice_data = np.array(payload.get("target_slice_data", []), dtype=np.float32)
        image_shape = tuple(payload.get("image_shape", [512, 512]))

        if ref_slice_data.size != np.prod(image_shape) or tgt_slice_data.size != np.prod(image_shape):
            raise ValueError("reference_slice_data/target_slice_data do not match image_shape")

        reference_slice = ref_slice_data.reshape(image_shape)
        target_slice = tgt_slice_data.reshape(image_shape)

        result = pred.predict(reference_contour, reference_slice, target_slice)

        contour = result["contour"]
        contour_list: List[List[float]] = contour.astype(float).tolist() if contour.size else []
        confidence = float(min(1.0, max(0.05, contour.shape[0] / 200.0)))

        response = {
            "predicted_contour": contour_list,
            "confidence": confidence,
            "method": result["method"],
            "metadata": {
                "mode": pred.mode,
                "monai_available": HAS_MONAI,
                "contour_points": len(contour_list),
            },
        }
        return jsonify(response)

    except Exception as exc:
        logger.error("Prediction failed: %s", exc, exc_info=True)
        return jsonify({"error": str(exc)}), 500


def main() -> None:  # pragma: no cover - CLI helper
    import argparse

    parser = argparse.ArgumentParser(description="MONAI contour propagation service")
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5005)
    parser.add_argument("--device", type=str, default=os.environ.get("MONAI_DEVICE", "cpu"))
    args = parser.parse_args()

    os.environ.setdefault("MONAI_DEVICE", args.device)

    ensure_predictor()
    logger.info("Starting MONAI service on %s:%s", args.host, args.port)
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":  # pragma: no cover
    main()
