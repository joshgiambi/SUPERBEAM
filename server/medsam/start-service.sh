#!/bin/bash
# Start MedSAM service

# Get device argument (default: cpu)
DEVICE=${1:-cpu}

# Validate device
if [ "$DEVICE" != "cuda" ] && [ "$DEVICE" != "cpu" ] && [ "$DEVICE" != "mps" ]; then
    echo "Usage: $0 [cuda|cpu|mps]"
    echo "Example: $0 cpu"
    echo "  mps - Use Apple Metal GPU (M1/M2/M3/M4)"
    exit 1
fi

echo "Starting MedSAM service with device: $DEVICE"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Virtual environment not found. Run ./setup.sh first"
    exit 1
fi

# Start service
python3 medsam_service.py --device $DEVICE --port 5004 --host 127.0.0.1
