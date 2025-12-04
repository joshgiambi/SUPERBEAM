# How to Start AI Services

## ✅ Quick Start (3 Commands)

Open three terminals and run:

```bash
# Terminal 1 – MONAI propagation (CPU by default)
cd server/monai
./start-service.sh cpu

# Terminal 2 – SegVol volumetric AI
cd ../segvol
./start-service.sh cpu

# Terminal 3 – Express + React app
cd ../..
npm run dev
```

Then open: **http://localhost:5173**

> Tip: If you have a CUDA GPU, swap `cpu` for `cuda` in the start commands.

---

## 🔍 Verify Services

```bash
# Direct health checks
curl http://127.0.0.1:5005/health   # MONAI
curl http://127.0.0.1:5001/health   # SegVol

# Via Express proxy (runs on 5174)
curl http://127.0.0.1:5174/api/monai/health
curl http://127.0.0.1:5174/api/segvol/health
```

Healthy responses look like:

```json
{ "status": "ok", "monai_service": { "status": "healthy", ... } }
```

---

## 🏗️ Architecture Overview

```
Browser (5173)
   │  React app
   ▼
Express API (5174)
   ├── /api/monai/*  → http://127.0.0.1:5005
   └── /api/segvol/* → http://127.0.0.1:5001

Python Services
   • MONAI service (server/monai)  – contour propagation / A/B vs SegVol
   • SegVol service (server/segvol) – SAM-based volumetric prediction
```

---

## 📊 Service Details

### MONAI Service (Port 5005)
- **Algorithm**: MONAI UNet when weights provided, otherwise morphology fallback
- **Accuracy**: ~75% baseline (higher with custom weights)
- **Speed**: ~0.5–0.9 s on CPU
- **Setup**: `cd server/monai && ./setup.sh`
- **Start**: `./start-service.sh cpu`
- **Env overrides**:
  - `MONAI_MODEL_PATH=/path/to/weights.pth`
  - `MONAI_ALLOW_DOWNLOAD=1` to fetch weights from HuggingFace

### SegVol Service (Port 5001)
- **Algorithm**: SAM ViT + CLIP decoder (official SegVol model)
- **Accuracy**: 83–85% Dice on CT volumes
- **Speed**: 0.5–2 s depending on volume size
- **Setup**: `cd server/segvol && ./setup.sh`
- **Start**: `./start-service.sh cpu`
- **Weights**: Auto-downloaded (~700 MB) the first time

---

## 🛠️ Troubleshooting

### Ports Already in Use

```bash
lsof -i :5001 :5005 :5174
pkill -f monai_service.py
pkill -f segvol_service.py
```

Restart the services afterwards.

### Pixel Data Warnings

If the viewer logs “pixel data not accessible”, make sure the DICOM study is fully loaded. Both AI services require decoded pixel data.

### Switching to GPU

Both services accept `cuda` or `mps` (Apple Silicon) as their first argument. Example:

```bash
./start-service.sh cuda
```

---

## 🔄 Running in Background

### nohup (simple background)

```bash
nohup ./server/monai/start-service.sh cpu > /tmp/monai.log 2>&1 &
nohup ./server/segvol/start-service.sh cpu > /tmp/segvol.log 2>&1 &
npm run dev
```

### PM2 (process manager)

```bash
pm2 start "server/monai/start-service.sh cpu" --name monai
pm2 start "server/segvol/start-service.sh cpu" --name segvol
pm2 start "npm run dev" --name viewer
pm2 save
```

---

## 📝 REST Endpoints

### MONAI
- `GET /api/monai/health`
- `POST /api/monai/predict`

### SegVol
- `GET /api/segvol/health`
- `POST /api/segvol/predict`
- `POST /api/segvol/predict-batch`
- `GET /api/segvol/info`

---

## ✨ In the Viewer

1. Load a study.
2. Draw a contour on the reference slice.
3. Enable prediction in the brush toolbar.
4. Choose `SegVol` or `MONAI` to A/B test results.
5. Move to the next slice – predictions will appear automatically.
