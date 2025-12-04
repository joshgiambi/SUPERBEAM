#!/usr/bin/env python3
"""
Download MedSAM weights from Google Drive
"""

import requests
from pathlib import Path
from tqdm import tqdm

def download_file(url, destination):
    """Download file with progress bar"""
    print(f"Downloading to {destination}...")

    response = requests.get(url, stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get('content-length', 0))

    with open(destination, 'wb') as f:
        if total_size == 0:
            f.write(response.content)
        else:
            with tqdm(total=total_size, unit='B', unit_scale=True) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

    print(f"✅ Downloaded {destination} ({total_size / 1e6:.1f} MB)")

# MedSAM weights (ViT-B) - 2.4 GB
# From Google Drive: https://drive.google.com/file/d/1UAmWL88roYR7wKlnApw5Bcuzf2iQgk6_
# Direct link format for Google Drive
file_id = "1UAmWL88roYR7wKlnApw5Bcuzf2iQgk6_"
url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t"

weights_dir = Path("weights")
weights_dir.mkdir(exist_ok=True)

destination = weights_dir / "medsam_vit_b.pth"

if destination.exists():
    print(f"File already exists: {destination}")
    print(f"Size: {destination.stat().st_size / 1e6:.1f} MB")
else:
    download_file(url, destination)
