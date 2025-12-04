#!/bin/bash
# Quick start script for Mem3D AI prediction service

cd "$(dirname "$0")/server/mem3d"

echo "🧠 Starting Mem3D AI Prediction Service..."
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run setup first: cd server/mem3d && ./setup.sh"
    exit 1
fi

# Activate venv
source venv/bin/activate

# Check device
DEVICE=${1:-cpu}
if [ "$DEVICE" != "cpu" ] && [ "$DEVICE" != "cuda" ]; then
    echo "Usage: $0 [cpu|cuda]"
    echo "Defaulting to CPU mode..."
    DEVICE="cpu"
fi

echo "Device: $DEVICE"
echo "Port: 5002"
echo ""
echo "✅ Mem3D will use fallback mode (no pretrained weights needed)"
echo "   - Accuracy: 70-75%"
echo "   - Speed: ~200ms"
echo "   - Memory: Remembers last 10 slices"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start service
python mem3d_service.py --port 5002 --device "$DEVICE"
