#!/bin/bash
# Download SAM ONNX models for local serving
# This avoids the need to download from HuggingFace on each browser load

MODEL_DIR="$(dirname "$0")"

echo "📥 Downloading SAM encoder model (~180MB)..."
curl -L -o "$MODEL_DIR/sam_vit_b_encoder.onnx" \
  "https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx"

echo "📥 Downloading SAM decoder model (~17MB)..."
curl -L -o "$MODEL_DIR/sam_vit_b_decoder.onnx" \
  "https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx"

echo "✅ SAM models downloaded successfully!"
echo "   Encoder: $MODEL_DIR/sam_vit_b_encoder.onnx"
echo "   Decoder: $MODEL_DIR/sam_vit_b_decoder.onnx"





