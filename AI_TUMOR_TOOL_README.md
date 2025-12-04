# AI Tumor Tool - Interactive 3D Segmentation

## Overview
The AI Tumor tool enables rapid 3D tumor segmentation using scribble-based annotations powered by the nnInteractive AI service.

## Features

### Scribble-Based Annotation
- **Draw Mode (D)**: Mark tumor regions with green scribbles
- **Erase Mode (E)**: Mark background regions with red scribbles
- **Multi-Slice Support**: Annotate on 3-5 key slices for optimal results
- **Real-time Feedback**: See your scribbles as you draw

### 3D Segmentation
- Uses nnInteractive service for volumetric segmentation
- Processes entire 3D volume from sparse annotations
- Returns confidence score and full 3D mask
- Automatic contour generation for all slices

## Usage

1. **Select Structure**: Choose or create a structure to edit
2. **Activate Tool**: Click the "AI Tumor" button (sparkles icon) in the contour toolbar
3. **Draw Scribbles**:
   - Press `D` for draw mode (mark tumor)
   - Press `E` for erase mode (mark background)
   - Draw on 3-5 representative slices
4. **Generate Segmentation**: Click "Generate 3D" button
5. **Review Results**: The 3D mask is applied to your structure

## UI Controls

Located at the bottom of the viewer:
- **Draw (D)** / **Erase (E)** buttons: Switch annotation mode
- **Slice counter**: Shows how many slices have annotations
- **Clear**: Remove all scribbles
- **Generate 3D**: Process annotations and create 3D segmentation

## Keyboard Shortcuts
- `D` - Switch to draw mode (tumor)
- `E` - Switch to erase mode (background)

## Technical Details

### API Integration
- Service URL: `/api/nninteractive`
- Endpoints:
  - `/health` - Check service availability
  - `/segment` - 3D volumetric segmentation
- Auto-detects service availability on tool activation

### Data Flow
1. Scribbles collected as pixel coordinates per slice
2. Volume data extracted from DICOM images
3. Request sent to nnInteractive with:
   - Full 3D volume
   - Scribble annotations (slice, points, label)
   - Voxel spacing metadata
4. Returns 3D binary mask
5. Mask converted to contours for visualization

### Files
- **Component**: `client/src/components/dicom/ai-tumor-tool.tsx`
- **API Client**: `client/src/lib/nninteractive-client.ts`
- **Integration**: `client/src/components/dicom/working-viewer.tsx` (line 7324-7357)

## Service Requirements

The tool requires the **nnInteractive** service to be running:
- Service availability checked on tool activation
- Displays warning if service is offline
- "Generate 3D" button disabled when service unavailable

## Development Notes

### Adding New Features
1. Scribble collection stored in component state
2. Overlay canvas used for visualization
3. Coordinate transforms handle zoom/pan
4. Service calls are async with loading states

### Testing Without Service
The tool will:
- Still allow scribble drawing
- Show service unavailable warning
- Disable segmentation generation
- Can be used to test UI/UX without backend

## Future Enhancements
- [ ] Point prompts (single clicks)
- [ ] Box prompts (bounding boxes)
- [ ] Slice recommendation (AI suggests next slice to annotate)
- [ ] Progressive refinement (iterative improvements)
- [ ] Confidence visualization
- [ ] Undo/redo for scribbles
- [ ] Save/load annotation sessions
