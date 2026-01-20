#!/bin/bash

# Convenience script to start SAM (Segment Anything Model) service
# SAM replaces SuperSeg - works on ALL image types, not just brain MRI FLAIR
# This script is in the project root for easy access

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔬 Starting SAM (Segment Anything Model) Service..."
echo ""
echo "Note: SAM works on ALL medical images (CT, MRI, PET, etc.)"
echo "      Previously SuperSeg only worked on brain MRI FLAIR."
echo ""

# Navigate to server/sam
cd server/sam

# Check if checkpoint exists
MODEL_TYPE="${SAM_MODEL_TYPE:-vit_b}"
CHECKPOINT="sam_${MODEL_TYPE}.pth"

if [ ! -f "$CHECKPOINT" ]; then
    echo "⚠️  SAM checkpoint not found at server/sam/$CHECKPOINT"
    echo ""
    echo "Please download the SAM checkpoint:"
    echo ""
    echo "  For vit_b (fastest, ~375MB):"
    echo "    cd server/sam && curl -L -o sam_vit_b.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
    echo ""
    echo "  For vit_l (larger, ~1.2GB):"
    echo "    cd server/sam && curl -L -o sam_vit_l.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth"
    echo ""
    echo "  For vit_h (highest quality, ~2.4GB):"
    echo "    cd server/sam && curl -L -o sam_vit_h.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
    echo ""
    read -p "Download vit_b now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Downloading SAM vit_b checkpoint (~375MB)..."
        curl -L -o sam_vit_b.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
        CHECKPOINT="sam_vit_b.pth"
    else
        echo "Please download the checkpoint and run again."
        exit 1
    fi
fi

echo "✓ SAM checkpoint found: $CHECKPOINT"

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 not found"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

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

# Check for virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt 2>/dev/null || pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Starting SAM service on http://127.0.0.1:5003"
echo ""
echo "Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run SAM service
python sam_service.py --port 5003 --host 127.0.0.1 --model "$MODEL_TYPE" --checkpoint "$CHECKPOINT"










