#!/bin/bash
# Start MONAI propagation service

set -euo pipefail

DEVICE=${1:-cpu}
PORT=${2:-5005}

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
  echo "❌ Virtual environment not found. Run ./setup.sh first."
  exit 1
fi

source venv/bin/activate

export MONAI_DEVICE="$DEVICE"
export MPLCONFIGDIR="${MPLCONFIGDIR:-$(pwd)/.matplotlib-cache}"
mkdir -p "$MPLCONFIGDIR"

echo "🚀 Starting MONAI service on port ${PORT} (device: ${DEVICE})"
python monai_service.py --device "$DEVICE" --port "$PORT" --host 127.0.0.1
