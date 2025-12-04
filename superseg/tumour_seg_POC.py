"""
Brain Metastasis Segmentation with Interactive Single-Pixel Input
Requirements:
pip install torch torchvision nibabel numpy scipy matplotlib scikit-image

# 1. Preprocess data
python tumour_seg_POC.py --mode preprocess --data_root /path/to/BraTS2021

# 2. Train model
python tumour_seg_POC.py --mode train --epochs 10 --batch_size 8

# 3. Run interactive viewer
python tumour_seg_POC.py --mode view --flair_path /path/to/volume/BraTS2021_00000_flair.nii
"""

import os
import glob
import random
import numpy as np
import nibabel as nib
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from scipy import ndimage
from scipy.ndimage import label as scipy_label
import matplotlib.pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg
import argparse
from pathlib import Path
from tqdm import tqdm

# Set random seeds for reproducibility
random.seed(42)
np.random.seed(42)
torch.manual_seed(42)

# Device setup for ARM Mac
device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
print(f"Using device: {device}")


# ============================================================================
# Data Preprocessing
# ============================================================================

def normalize_volume(volume):
    """Normalize a volume to zero mean and unit variance."""
    mean = np.mean(volume)
    std = np.std(volume)
    if std > 0:
        return (volume - mean) / std
    return volume - mean


def get_connected_components(mask):
    """Get individual connected components from a binary mask."""
    labeled, num_features = scipy_label(mask)
    return labeled, num_features


def get_tumor_bbox(mask, margin=10):
    """Get bounding box around tumor with margin."""
    coords = np.argwhere(mask > 0)
    if len(coords) == 0:
        return None
    min_coords = np.maximum(coords.min(axis=0) - margin, 0)
    max_coords = coords.max(axis=0) + margin
    return min_coords, max_coords


def sample_point_near_tumor(tumor_mask, margin=10):
    """Sample a random point on or near (within margin) the tumor."""
    # Dilate the tumor mask by margin
    struct = ndimage.generate_binary_structure(2, 2)
    dilated = ndimage.binary_dilation(tumor_mask, structure=struct, iterations=margin)
    
    # Get valid coordinates
    coords = np.argwhere(dilated > 0)
    if len(coords) == 0:
        return None
    
    # Sample random point
    idx = random.randint(0, len(coords) - 1)
    return tuple(coords[idx])


def preprocess_dataset(data_root, output_path, slices_per_tumor=10, neg_slice_ratio=0.1):
    """
    Preprocess BraTS dataset and save as PyTorch tensors.
    """
    data_root = Path(data_root)
    volume_dirs = sorted([d for d in data_root.iterdir() if d.is_dir()])
    
    print(f"Found {len(volume_dirs)} volumes")
    
    all_samples = []
    
    for vol_idx, vol_dir in enumerate(volume_dirs):
        print(f"Processing volume {vol_idx + 1}/{len(volume_dirs)}: {vol_dir.name}")
        
        # Load FLAIR and segmentation
        flair_path = vol_dir / f"{vol_dir.name}_flair.nii"
        seg_path = vol_dir / f"{vol_dir.name}_seg.nii"
        
        if not flair_path.exists() or not seg_path.exists():
            print(f"  Skipping {vol_dir.name} - missing files")
            continue
        
        flair_nii = nib.load(str(flair_path))
        seg_nii = nib.load(str(seg_path))
        
        flair_vol = flair_nii.get_fdata()
        seg_vol = seg_nii.get_fdata()
        
        # Normalize FLAIR volume
        flair_vol = normalize_volume(flair_vol)
        
        H, W, D = flair_vol.shape
        
        # Extract whole tumor mask (labels 1, 2, and 4)
        # Label 1 = Necrotic core, Label 2 = Edema, Label 4 = Enhancing rim
        tumor_mask = ((seg_vol == 1) | (seg_vol == 2) | (seg_vol == 4)).astype(np.float32)
        
        # Process each axial slice to find tumors
        tumor_slices = []
        for z in range(D):
            slice_mask = tumor_mask[:, :, z]
            if slice_mask.sum() > 0:
                tumor_slices.append(z)
        
        if len(tumor_slices) == 0:
            print(f"  No tumors found in {vol_dir.name}")
            continue
        
        # Find individual tumors across slices
        tumor_groups = []
        for z in tumor_slices:
            slice_mask = tumor_mask[:, :, z]
            labeled, num_features = get_connected_components(slice_mask)
            
            for tumor_id in range(1, num_features + 1):
                tumor_component_mask = (labeled == tumor_id).astype(np.float32)
                tumor_groups.append((z, tumor_component_mask))
        
        # Sample slices for each tumor
        samples_per_tumor = min(slices_per_tumor, len(tumor_groups))
        sampled_tumors = random.sample(tumor_groups, samples_per_tumor)
        
        for z, tumor_component_mask in sampled_tumors:
            # Sample point near tumor
            point = sample_point_near_tumor(tumor_component_mask, margin=10)
            if point is None:
                continue
            
            # Create point mask
            point_mask = np.zeros((H, W), dtype=np.float32)
            point_mask[point[0], point[1]] = 1.0
            
            # Stack FLAIR and point mask
            features = np.stack([flair_vol[:, :, z], point_mask], axis=0)
            
            all_samples.append({
                'features': torch.from_numpy(features).float(),
                'label': torch.from_numpy(tumor_component_mask).float(),
                'volume_id': vol_dir.name,
                'slice_idx': z
            })
        
        # Add negative samples (slices without tumor but with point)
        num_neg_with_point = int(len(sampled_tumors) * neg_slice_ratio)
        non_tumor_slices = [z for z in range(D) if z not in tumor_slices]
        
        neg_slices = []
        if len(non_tumor_slices) > 0:
            neg_slices = random.sample(non_tumor_slices, 
                                      min(num_neg_with_point, len(non_tumor_slices)))
            
            for z in neg_slices:
                # Random point location
                point = (random.randint(0, H-1), random.randint(0, W-1))
                point_mask = np.zeros((H, W), dtype=np.float32)
                point_mask[point[0], point[1]] = 1.0
                
                features = np.stack([flair_vol[:, :, z], point_mask], axis=0)
                empty_label = np.zeros((H, W), dtype=np.float32)
                
                all_samples.append({
                    'features': torch.from_numpy(features).float(),
                    'label': torch.from_numpy(empty_label).float(),
                    'volume_id': vol_dir.name,
                    'slice_idx': z
                })
        
        # Add negative samples (slices without tumor and without point)
        num_neg_no_point = int(len(sampled_tumors) * neg_slice_ratio)
        if len(non_tumor_slices) > num_neg_with_point:
            remaining_slices = [z for z in non_tumor_slices if z not in neg_slices]
            neg_slices_no_point = random.sample(remaining_slices,
                                                min(num_neg_no_point, len(remaining_slices)))
            
            for z in neg_slices_no_point:
                point_mask = np.zeros((H, W), dtype=np.float32)
                features = np.stack([flair_vol[:, :, z], point_mask], axis=0)
                empty_label = np.zeros((H, W), dtype=np.float32)
                
                all_samples.append({
                    'features': torch.from_numpy(features).float(),
                    'label': torch.from_numpy(empty_label).float(),
                    'volume_id': vol_dir.name,
                    'slice_idx': z
                })
    
    print(f"\nTotal samples: {len(all_samples)}")
    
    # Split by volume (80/20)
    unique_volumes = list(set([s['volume_id'] for s in all_samples]))
    random.shuffle(unique_volumes)
    split_idx = int(0.8 * len(unique_volumes))
    train_volumes = set(unique_volumes[:split_idx])
    
    train_samples = [s for s in all_samples if s['volume_id'] in train_volumes]
    val_samples = [s for s in all_samples if s['volume_id'] not in train_volumes]
    print(f'val_samples volume_ids: {[s["volume_id"] for s in val_samples]}')
    
    print(f"Train samples: {len(train_samples)}, Val samples: {len(val_samples)}")
    
    # Save
    torch.save({
        'train': train_samples,
        'val': val_samples
    }, output_path)
    
    print(f"Saved preprocessed data to {output_path}")


# ============================================================================
# Dataset
# ============================================================================

class BrainMetDataset(Dataset):
    def __init__(self, samples):
        self.samples = samples
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        sample = self.samples[idx]
        features = sample['features']
        label = sample['label']
        
        # Resize to half resolution
        features = F.interpolate(features.unsqueeze(0), scale_factor=0.5, 
                                mode='bilinear', align_corners=False).squeeze(0)
        label = F.interpolate(label.unsqueeze(0).unsqueeze(0), scale_factor=0.5,
                             mode='bilinear', align_corners=False).squeeze(0).squeeze(0)
        
        return features, label


# ============================================================================
# U-Net Model
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
        # Match spatial dimensions if needed
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
# Loss Function
# ============================================================================

class DiceLoss(nn.Module):
    def __init__(self, smooth=1.0):
        super().__init__()
        self.smooth = smooth
    
    def forward(self, pred, target):
        pred = torch.sigmoid(pred)
        pred = pred.view(-1)
        target = target.view(-1)
        
        intersection = (pred * target).sum()
        dice = (2. * intersection + self.smooth) / (pred.sum() + target.sum() + self.smooth)
        
        return 1 - dice


# ============================================================================
# Training
# ============================================================================

def train_model(data_path, checkpoint_path, epochs=10, batch_size=8, lr=1e-3):
    """Train the U-Net model."""
    print("Loading preprocessed data...")
    data = torch.load(data_path)
    
    train_dataset = BrainMetDataset(data['train'])
    val_dataset = BrainMetDataset(data['val'])
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    print(f"Train batches: {len(train_loader)}, Val batches: {len(val_loader)}")
    
    model = UNet(in_channels=2, base_channels=32).to(device)
    criterion = DiceLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    best_val_loss = float('inf')
    
    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0.0
        
        # Progress bar for training batches
        train_pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs} [Train]", leave=False)
        for features, labels in train_pbar:
            features = features.to(device)
            labels = labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(features)
            loss = criterion(outputs.squeeze(1), labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            # Update progress bar with current loss
            train_pbar.set_postfix({'loss': f'{loss.item():.4f}'})
        
        train_loss /= len(train_loader)
        
        # Validation
        model.eval()
        val_loss = 0.0
        
        # Progress bar for validation batches
        val_pbar = tqdm(val_loader, desc=f"Epoch {epoch+1}/{epochs} [Val]", leave=False)
        with torch.no_grad():
            for features, labels in val_pbar:
                features = features.to(device)
                labels = labels.to(device)
                
                outputs = model(features)
                loss = criterion(outputs.squeeze(1), labels)
                val_loss += loss.item()
                # Update progress bar with current loss
                val_pbar.set_postfix({'loss': f'{loss.item():.4f}'})
        
        val_loss /= len(val_loader)
        
        print(f"Epoch {epoch+1}/{epochs} - Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")
        
        # Save best model
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), checkpoint_path)
            print(f"  Saved checkpoint to {checkpoint_path}")
    
    print("Training complete!")


# ============================================================================
# Inference
# ============================================================================

def predict_slice(model, flair_slice, point, threshold=0.5):
    """Predict segmentation for a single slice with a point."""
    H, W = flair_slice.shape
    
    # Create point mask
    point_mask = np.zeros((H, W), dtype=np.float32)
    point_mask[int(point[0]), int(point[1])] = 1.0
    
    # Stack features
    features = np.stack([flair_slice, point_mask], axis=0)
    features = torch.from_numpy(features).float().unsqueeze(0)
    
    # Resize to half
    features = F.interpolate(features, scale_factor=0.5, mode='bilinear', align_corners=False)
    features = features.to(device)
    
    # Predict
    with torch.no_grad():
        output = model(features)
        output = torch.sigmoid(output)
    
    # Resize back to original
    output = F.interpolate(output, size=(H, W), mode='bilinear', align_corners=False)
    output = output.squeeze().cpu().numpy()
    
    # Threshold
    mask = (output > threshold).astype(np.float32)
    
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
    point = np.array(point)
    
    distances = np.linalg.norm(coords - point, axis=1)
    return distances.min() <= max_dist


def prune_to_largest_component_3d(segmentations, volume_shape):
    """
    Keep only the largest 3D connected component from the segmentation dict.
    
    Args:
        segmentations: dict mapping slice indices to 2D masks
        volume_shape: tuple (H, W, D) of the volume shape
    
    Returns:
        dict with only the largest connected component preserved
    """
    if len(segmentations) == 0:
        return segmentations
    
    H, W, D = volume_shape
    
    # Create 3D volume from slice dict
    volume_3d = np.zeros((H, W, D), dtype=np.float32)
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
    largest_mask_3d = (labeled_3d == largest_component).astype(np.float32)
    
    # Convert back to dict of 2D slices
    pruned_segmentations = {}
    for z in range(D):
        slice_mask = largest_mask_3d[:, :, z]
        if slice_mask.sum() > 0:
            pruned_segmentations[z] = slice_mask
    
    return pruned_segmentations


def segment_tumor_3d(model, flair_vol, start_slice, start_point):
    """
    Segment tumor in 3D starting from a slice and point.
    Returns dict mapping slice indices to segmentation masks.
    """
    H, W, D = flair_vol.shape
    segmentations = {}
    
    # Predict on start slice
    flair_slice = flair_vol[:, :, start_slice]
    mask = predict_slice(model, flair_slice, start_point)
    
    if mask.sum() == 0:
        return segmentations
    
    segmentations[start_slice] = mask
    
    # Go upward
    current_slice = start_slice + 1
    prev_centroid = get_centroid(mask)
    
    while current_slice < D and prev_centroid is not None:
        flair_slice = flair_vol[:, :, current_slice]
        mask = predict_slice(model, flair_slice, prev_centroid)
        
        if not check_prediction_near_point(mask, prev_centroid, max_dist=10):
            break
        
        if mask.sum() > 0:
            segmentations[current_slice] = mask
            prev_centroid = get_centroid(mask)
            current_slice += 1
        else:
            break
    
    # Go downward
    current_slice = start_slice - 1
    prev_centroid = get_centroid(segmentations[start_slice])
    
    while current_slice >= 0 and prev_centroid is not None:
        flair_slice = flair_vol[:, :, current_slice]
        mask = predict_slice(model, flair_slice, prev_centroid)
        
        if not check_prediction_near_point(mask, prev_centroid, max_dist=10):
            break
        
        if mask.sum() > 0:
            segmentations[current_slice] = mask
            prev_centroid = get_centroid(mask)
            current_slice -= 1
        else:
            break
    
    # Prune to largest 3D connected component
    segmentations = prune_to_largest_component_3d(segmentations, (H, W, D))
    
    return segmentations


# ============================================================================
# Interactive Viewer
# ============================================================================

class BrainMetViewer:
    def __init__(self, flair_path, model_path):
        # Load FLAIR volume
        print(f"Loading {flair_path}...")
        nii = nib.load(flair_path)
        self.flair_vol = nii.get_fdata()
        self.flair_vol = normalize_volume(self.flair_vol)
        
        self.H, self.W, self.D = self.flair_vol.shape
        self.current_slice = self.D // 2
        
        # Load ground truth segmentation if available
        self.ground_truth = None
        flair_path_obj = Path(flair_path)
        seg_path = flair_path_obj.parent / f"{flair_path_obj.stem.replace('_flair', '_seg')}.nii"
        if seg_path.exists():
            print(f"Loading ground truth from {seg_path}...")
            seg_nii = nib.load(str(seg_path))
            seg_vol = seg_nii.get_fdata()
            
            # BraTS labels:
            # 1 = Necrotic/Non-enhancing tumor core (NCR)
            # 2 = Edema (ED)
            # 4 = Enhancing tumor (ET) - the rim
            
            # Option 1: Only ET (label 4) - the enhancing rim
            # self.ground_truth = (seg_vol == 4).astype(np.float32)
            
            # Option 2: Tumor core (NCR + ET) - labels 1 and 4
            # self.ground_truth = ((seg_vol == 1) | (seg_vol == 4)).astype(np.float32)
            
            # Option 3: Whole tumor (NCR + ED + ET) - labels 1, 2, and 4
            self.ground_truth = ((seg_vol == 1) | (seg_vol == 2) | (seg_vol == 4)).astype(np.float32)
            
            print("Ground truth loaded: Whole tumor (NCR + ED + ET)")
            print("  Label 1 = Necrotic core, Label 2 = Edema, Label 4 = Enhancing rim")
        else:
            print("No ground truth segmentation found")
        
        # Load model
        print(f"Loading model from {model_path}...")
        self.model = UNet(in_channels=2, base_channels=32).to(device)
        self.model.load_state_dict(torch.load(model_path, map_location=device))
        self.model.eval()
        
        # Segmentation storage
        self.segmentations = {}
        self.is_processing = False
        
        # Store the user click point
        self.click_point = None  # (y, x, z) coordinates
        
        # Setup figure
        self.fig, self.ax = plt.subplots(figsize=(10, 10))
        self.fig.canvas.mpl_connect('button_press_event', self.on_click)
        self.fig.canvas.mpl_connect('key_press_event', self.on_key)
        self.fig.canvas.mpl_connect('scroll_event', self.on_scroll)
        
        self.update_display()
        plt.show()
    
    def update_display(self):
        """Update the displayed slice."""
        self.ax.clear()
        
        # Display FLAIR
        slice_data = self.flair_vol[:, :, self.current_slice].T
        self.ax.imshow(slice_data, cmap='gray', origin='lower')
        
        # Create overlay combining ground truth and predictions
        overlay = np.zeros((slice_data.shape[0], slice_data.shape[1], 4))
        
        # Get ground truth mask for this slice if available
        gt_mask = None
        if self.ground_truth is not None:
            gt_mask = self.ground_truth[:, :, self.current_slice].T > 0
        
        # Get prediction mask for this slice if available
        pred_mask = None
        if self.current_slice in self.segmentations:
            pred_mask = self.segmentations[self.current_slice].T > 0
        
        # Color the overlay based on ground truth and predictions
        if gt_mask is not None and pred_mask is not None:
            # Yellow where both ground truth and prediction overlap (TP)
            overlap = gt_mask & pred_mask
            overlay[overlap] = [1, 1, 0, 0.3]  # Yellow
            
            # Blue where only ground truth (FN - missed by prediction)
            gt_only = gt_mask & ~pred_mask
            overlay[gt_only] = [0, 0, 1, 0.3]  # Blue

            # Red where only prediction (FP - false positive)
            pred_only = pred_mask & ~gt_mask
            overlay[pred_only] = [1, 0, 0, 0.3]  # Red
        elif gt_mask is not None:
            # Only ground truth available - show in blue
            overlay[gt_mask] = [0, 0, 1, 0.3]  # Blue
        elif pred_mask is not None:
            # Only prediction available - show in red
            overlay[pred_mask] = [1, 0, 0, 0.3]  # Red
        
        # Display overlay
        self.ax.imshow(overlay, origin='lower')
        
        # Show user click point as a bright marker if it exists and on current slice
        if self.click_point is not None:
            click_y, click_x, pz = self.click_point
            if pz == self.current_slice:
                # Draw a larger, more visible marker
                # click_point is stored as (y, x, z) from the volume
                # but event.xdata/ydata are the display coordinates
                # Display shows .T (transposed), so we need to map back
                # In on_click: x, y = event.xdata, event.ydata
                # Then stored as: (y, x, z)
                # So to display at click location: use (click_x, click_y) for scatter
                self.ax.scatter([click_x], [click_y], c='magenta', s=100, marker='o', facecolors='none', linewidths=2, zorder=10)
        
        # Calculate Dice score if both GT and prediction are available
        dice_score = None
        if gt_mask is not None and pred_mask is not None:
            intersection = np.sum(gt_mask & pred_mask)
            union = np.sum(gt_mask) + np.sum(pred_mask)
            if union > 0:
                dice_score = 2.0 * intersection / union
            else:
                dice_score = 1.0 if intersection == 0 else 0.0
        
        title = f"Slice {self.current_slice}/{self.D-1}"
        if dice_score is not None:
            title += f" | Dice: {dice_score:.3f}"
        if self.is_processing:
            title += " - PROCESSING..."
        if gt_mask is not None or pred_mask is not None:
            title += "\n"
            if gt_mask is not None:
                title += "Blue=GT "
            if pred_mask is not None:
                title += "Red=Pred "
            if gt_mask is not None and pred_mask is not None:
                title += "Yellow=Overlap"
            if self.click_point is not None and self.click_point[2] == self.current_slice:
                title += " Pink=Click"
        
        self.ax.set_title(title)
        self.ax.axis('off')
        
        self.fig.canvas.draw()
    
    def on_click(self, event):
        """Handle mouse click."""
        if event.inaxes != self.ax or self.is_processing:
            return
        
        # Get click coordinates
        x, y = int(event.xdata), int(event.ydata)
        
        if 0 <= x < self.W and 0 <= y < self.H:
            print(f"Click at ({y}, {x}) on slice {self.current_slice}")
            
            # Store click point (y, x, z)
            self.click_point = (y, x, self.current_slice)
            
            # Start segmentation
            self.is_processing = True
            self.update_display()
            plt.pause(0.01)
            
            self.segmentations = segment_tumor_3d(
                self.model, self.flair_vol, self.current_slice, (y, x)
            )
            
            print(f"Segmentation complete. Found tumor in {len(self.segmentations)} slices")
            
            self.is_processing = False
            self.update_display()
    
    def on_key(self, event):
        """Handle keyboard input."""
        if self.is_processing:
            return
        
        if event.key == 'up':
            self.current_slice = min(self.current_slice + 1, self.D - 1)
            self.update_display()
        elif event.key == 'down':
            self.current_slice = max(self.current_slice - 1, 0)
            self.update_display()
    
    def on_scroll(self, event):
        """Handle mouse scroll."""
        if self.is_processing:
            return
        
        if event.button == 'up':
            self.current_slice = min(self.current_slice + 1, self.D - 1)
        elif event.button == 'down':
            self.current_slice = max(self.current_slice - 1, 0)
        
        self.update_display()


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Brain Metastasis Segmentation')
    parser.add_argument('--mode', type=str, required=True, 
                       choices=['preprocess', 'train', 'view'],
                       help='Mode: preprocess, train, or view')
    parser.add_argument('--data_root', type=str, 
                       help='Path to BraTS data root directory')
    parser.add_argument('--preprocessed_data', type=str, default='brain_met_data.pt',
                       help='Path to save/load preprocessed data')
    parser.add_argument('--checkpoint', type=str, default='unet_brain_met.pth',
                       help='Path to model checkpoint')
    parser.add_argument('--flair_path', type=str,
                       help='Path to FLAIR volume for viewing')
    parser.add_argument('--epochs', type=int, default=10,
                       help='Number of training epochs')
    parser.add_argument('--batch_size', type=int, default=8,
                       help='Batch size for training')
    
    args = parser.parse_args()
    
    if args.mode == 'preprocess':
        if not args.data_root:
            print("Error: --data_root required for preprocessing")
            return
        preprocess_dataset(args.data_root, args.preprocessed_data)
    
    elif args.mode == 'train':
        if not os.path.exists(args.preprocessed_data):
            print(f"Error: Preprocessed data not found at {args.preprocessed_data}")
            print("Run preprocessing first with --mode preprocess")
            return
        train_model(args.preprocessed_data, args.checkpoint, 
                   epochs=args.epochs, batch_size=args.batch_size)
    
    elif args.mode == 'view':
        if not args.flair_path:
            print("Error: --flair_path required for viewing")
            return
        if not os.path.exists(args.checkpoint):
            print(f"Error: Model checkpoint not found at {args.checkpoint}")
            return
        viewer = BrainMetViewer(args.flair_path, args.checkpoint)


if __name__ == '__main__':
    main()