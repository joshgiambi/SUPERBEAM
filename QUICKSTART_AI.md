# 🚀 AI Predictions - Quick Start

## Start Services

```bash
# Terminal 1: Start Mem3D Service
./start-mem3d.sh

# Terminal 2: Start Main App
npm run dev
```

## Use in Viewer

1. Open http://localhost:5173
2. Load patient with RT structures
3. Select structure (e.g., Esophagus)
4. Click **Brush** tool
5. Enable **AI Predict** (✨ sparkles button)
6. Select **"Mem3D"** from dropdown  
7. Navigate slices → See predictions!

## Keyboard Shortcuts

- `A` = Accept prediction
- `X` = Reject prediction  
- `↑/↓` = Navigate slices

## Status Check

```bash
# Check if Mem3D is running
curl http://127.0.0.1:5002/health

# Expected: {"status":"healthy","model_loaded":true,...}
```

## That's It!

Mem3D AI predictions are now working. See `AI_SETUP_COMPLETE.md` for full details.


