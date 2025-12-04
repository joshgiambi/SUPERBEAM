#!/bin/bash
# Download Mem3D Pretrained Weights

echo "🔽 Downloading Mem3D pretrained weights..."
echo ""
echo "File ID: 1nzhFYOJx3rzvnO8o6g-D1MMA6iQ4VYpw"
echo "Expected size: 200-500 MB"
echo ""

cd "$(dirname "$0")"

# Check if gdown is installed
if ! command -v gdown &> /dev/null; then
    echo "📦 Installing gdown..."
    pip install gdown
fi

# Backup old file if exists
if [ -f "weights/vmn_checkpoint.pth" ]; then
    echo "📋 Backing up existing file..."
    mv weights/vmn_checkpoint.pth weights/vmn_checkpoint.pth.backup
fi

# Download
echo "⏳ Downloading from Google Drive..."
cd weights
gdown 1nzhFYOJx3rzvnO8o6g-D1MMA6iQ4VYpw -O vmn_checkpoint.pth

# Verify
if [ -f "vmn_checkpoint.pth" ]; then
    SIZE=$(du -h vmn_checkpoint.pth | cut -f1)
    echo ""
    echo "✅ Download complete!"
    echo "   File size: $SIZE"
    echo "   Location: $(pwd)/vmn_checkpoint.pth"

    # Check if size is reasonable (should be > 100MB)
    SIZE_BYTES=$(stat -f%z vmn_checkpoint.pth 2>/dev/null || stat -c%s vmn_checkpoint.pth 2>/dev/null)
    if [ "$SIZE_BYTES" -lt 100000000 ]; then
        echo ""
        echo "⚠️  WARNING: File size is suspiciously small ($SIZE)"
        echo "    Expected: 200-500 MB"
        echo "    This might be an HTML error page or incomplete download"
        echo ""
        echo "    Try manual download:"
        echo "    https://drive.google.com/file/d/1nzhFYOJx3rzvnO8o6g-D1MMA6iQ4VYpw/"
    else
        echo ""
        echo "✅ File size looks good!"
        echo ""
        echo "Next steps:"
        echo "1. Test loading: python3 ../test_weights.py"
        echo "2. Start service: ./start-service.sh --model-path weights/vmn_checkpoint.pth"
    fi
else
    echo ""
    echo "❌ Download failed!"
    echo ""
    echo "Manual download instructions:"
    echo "1. Visit: https://drive.google.com/file/d/1nzhFYOJx3rzvnO8o6g-D1MMA6iQ4VYpw/"
    echo "2. Download the file"
    echo "3. Move it to: $(pwd)/vmn_checkpoint.pth"
fi
