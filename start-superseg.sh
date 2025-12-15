#!/bin/bash

# Convenience script to start SuperSeg service
# This script is in the project root for easy access

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧠 Starting SuperSeg Tumor Segmentation Service..."
echo ""

# Check if model weights exist
if [ ! -f "superseg/unet_brain_met.pth" ]; then
    echo "❌ Error: Model weights not found at superseg/unet_brain_met.pth"
    echo ""
    echo "Please ensure the model weights file exists in the superseg directory."
    exit 1
fi

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 not found"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

echo "✓ Model weights found"
echo "✓ Python 3 available"
echo ""

# Check if port 5003 is already in use
if lsof -Pi :5003 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Warning: Port 5003 is already in use"
    echo ""
    read -p "Kill existing process and restart? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Killing existing process..."
        lsof -ti:5003 | xargs kill -9
        sleep 1
    else
        echo "Exiting..."
        exit 1
    fi
fi

# Navigate to server/superseg
cd server/superseg

# Check for virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Starting service on http://127.0.0.1:5003"
echo ""
echo "Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run service
python superseg_service.py --port 5003 --host 127.0.0.1










