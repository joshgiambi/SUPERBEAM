#!/bin/bash
# Set up virtual environment for MONAI service

set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt

echo "✅ MONAI service environment ready."
