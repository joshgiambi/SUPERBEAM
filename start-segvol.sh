#!/bin/bash
# Start SegVol AI segmentation service

set -e

cd "$(dirname "$0")/server/segvol"

# Check if setup is done
if [ ! -d "venv" ] || [ ! -d "SegVol" ]; then
    echo "❌ SegVol not set up. Run ./setup.sh in server/segvol/ first!"
    exit 1
fi

# Use CPU mode by default (faster startup, works everywhere)
DEVICE=${1:-cpu}
PORT=${2:-5001}

echo "🤖 Starting SegVol AI Service"
echo "================================"
echo "Device: $DEVICE"
echo "Port:   http://localhost:$PORT"
echo ""
echo "First startup will download model weights (~700MB)"
echo "This may take 5-10 minutes..."
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Activate venv and start service
source venv/bin/activate
python segvol_service.py --port "$PORT" --device "$DEVICE"
