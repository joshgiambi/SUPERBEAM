#!/bin/bash

# Start SuperSeg tumor segmentation service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧠 Starting SuperSeg Tumor Segmentation Service..."

# Check if model weights exist
if [ ! -f "../../superseg/unet_brain_met.pth" ]; then
    echo "❌ Error: Model weights not found at ../../superseg/unet_brain_met.pth"
    echo "Please ensure the model weights file exists"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Install requirements
pip install -q -r requirements.txt

# Run service
python superseg_service.py --port 5003 --host 127.0.0.1



