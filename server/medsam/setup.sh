#!/bin/bash
# Setup MedSAM service

echo "Setting up MedSAM service..."

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install segment-anything
pip install opencv-python
pip install numpy
pip install flask
pip install flask-cors
pip install pillow
pip install scikit-image

# Create weights directory
mkdir -p weights

# Download MedSAM model weights
echo "Downloading MedSAM model weights (~2.4GB)..."
cd weights
wget -nc https://github.com/bowang-lab/MedSAM/releases/download/v0.1/medsam_vit_b.pth || true
cd ..

echo "Setup complete!"
echo "Run ./start-service.sh to start the MedSAM service"
