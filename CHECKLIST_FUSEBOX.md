# FuseBox Implementation Checklist

## Overview
FuseBox is a comprehensive fusion registration editing and evaluation system that allows users to:
1. Evaluate current fusion alignment via overlay/split comparison tools
2. Switch between multiple registration files for the same secondary scan
3. Adjust window/level settings for both primary and secondary scans
4. Manage fusion opacity and blend modes
5. Perform manual and automatic registration adjustments (future)

## Implementation Architecture

FuseBox opens as a **standalone browser window** (not an embedded modal) to provide:
- Maximum screen real estate for detailed fusion evaluation
- Independent workspace that doesn't interfere with main viewer
- Professional workflow similar to MIM Maestro, Eclipse, RayStation

## Components Created/Modified

### New Components

#### `client/src/pages/fusebox.tsx`
- **Standalone full-page fusion editor that opens in a new browser window**
- Based on the professional fusion-editor-popup-prototype design
- Features:
  - Side-by-side synchronized viewports (Primary CT + Secondary MR/PT)
  - **8 professional evaluation modes:**
    - **Overlay** - Standard opacity blending
    - **Swipe** - Horizontal curtain/curtain comparison
    - **Spyglass** - Circular lens to peek at secondary
    - **Flicker** - Rapid auto-toggle between images
    - **Checkerboard** - Alternating pattern comparison
    - **Difference** - Highlight misalignment areas
    - **Color Fusion** - Color-coded channel fusion
    - **Edges** - Edge detection overlay
  - **Manual transform controls:**
    - Translation (X, Y, Z) in mm with increment buttons
    - Rotation (X, Y, Z) in degrees
    - Quick nudge buttons for fine adjustment
  - **Automatic registration placeholders:**
    - Rigid registration (mutual information-based)
    - Contour-based registration
    - Landmark-based registration
    - Intensity-based registration
    - Deformable registration (advanced)
  - **MPR view plane switching** (Axial, Sagittal, Coronal)
  - **RT Structure contour overlay** with visibility toggles
  - **Anatomical landmark placement** and pairing system
  - **Registration quality metrics display** (MI, NCC, MSE)
  - **Undo/Redo history** with keyboard shortcuts
  - Grid and crosshair alignment aids
  - Window/Level presets per modality (CT, MR, PT)
  - Data passed via `sessionStorage` from parent viewer
  - Communication back to parent via `window.postMessage`

### Modified Components

#### `client/src/App.tsx`
- Added `/fusebox` route for the standalone FuseBox page
- Imported `FuseBox` page component

#### `client/src/types/fusion.ts`
- Added `RegistrationOption` interface export for type safety

#### `client/src/components/dicom/bottom-toolbar-prototype-v2.tsx`
- Added new props:
  - `hasFusionActive: boolean` - Shows FuseBox button when fusion is active
  - `onFuseBoxOpen: () => void` - Opens the FuseBox in new window
- Added FuseBox button with gradient highlight styling
- Button appears in toolbar when a fusion secondary is loaded

#### `client/src/components/dicom/unified-fusion-topbar.tsx`
- Added registration selector UI in the fusion dropdown
- New props added:
  - `registrationOptions: RegistrationOption[]`
  - `selectedRegistrationId: string | null`
  - `onRegistrationChange: (id: string | null) => void`
- Shows numbered buttons (1, 2, 3...) when multiple registrations exist
- Displays registration info (file name, type) for selected registration

#### `client/src/components/dicom/viewer-interface.tsx`
- Removed embedded FuseBox popup in favor of new window approach
- Updated `onFuseBoxOpen` handler to:
  1. Store fusion data in `sessionStorage`
  2. Open `/fusebox` route in new browser window
- Passes primary/secondary series info, opacity, and registration ID to new window

## Usage

### FuseBox Button
1. Load a study with fusion-compatible scans (CT + MR or CT + PET)
2. Select a secondary scan from the fusion dropdown
3. The FuseBox button appears in the bottom toolbar (cyan-purple gradient icon)
4. Click to open FuseBox in a new window (1400x900 pixels)

### Multiple Registration Selection
In the fusion dropdown (when expanded):
1. Load a secondary scan with multiple registration files
2. A "Registration" section appears with numbered buttons (1, 2, 3...)
3. Click a number to switch between different registrations
4. Current registration info is displayed below

### FuseBox Window Features

#### Header Bar
- FuseBox branding with modality info
- Undo/Redo buttons
- Unsaved changes indicator
- Registration progress indicator
- Close button

#### Evaluation Mode Toolbar
- 8 evaluation mode buttons with tooltips
- Mode-specific controls:
  - Flicker: Play/Pause button, speed slider
  - Overlay: Opacity slider with percentage display

#### Viewport Toolbar
- Tool selection (Pan, Zoom, W/L, Translate, Landmark, Measure)
- View toggles (Grid, Crosshair, Contours, Linked)
- MPR plane buttons (A, S, C)
- Slice navigation with skip buttons (+/-10, +/-1)

#### Side-by-Side Viewports
- Primary viewport (cyan border) - Reference image
- Secondary viewport (purple border) - Adjustable image
- Transform indicators showing offset values
- Swipe handle for curtain comparison

#### Right Control Panel (Tabbed)
1. **Transform Tab**
   - Translation controls (X, Y, Z) with quick nudge grid
   - Rotation controls (X, Y, Z) with quick adjust buttons
   - Window/Level presets by modality

2. **Auto Reg Tab**
   - Rigid registration button
   - Contour-based registration button
   - Landmark-based registration button
   - Intensity-based registration button
   - Deformable registration button (advanced warning)

3. **Contours Tab**
   - RT Structure visibility toggles
   - Load RT Structure Set button

4. **Landmarks Tab**
   - Landmark list with pairing status
   - Add Landmark button
   - Paired count indicator

#### Registration Metrics Panel
- Quality badge (Excellent/Good/Fair/Poor)
- Mutual Information (MI) metric
- Normalized Cross Correlation (NCC) metric
- Mean Squared Error (MSE) metric

#### Action Buttons
- Save Registration button (gradient, disabled when no changes)
- Reset button (amber, reverts to original)
- Close button

#### Keyboard Shortcuts Footer
- `↑↓` - Navigate slices (Shift for x10)
- `G` - Toggle grid
- `C` - Toggle crosshair
- `O`, `S`, `K`, `F`, `D` - Evaluation modes (Overlay, Swipe, Checker, Flicker, Diff)
- `⌘Z` / `⌘⇧Z` - Undo/Redo
- `Esc` - Close window

## Data Flow

```
Viewer Interface                    FuseBox Window
┌──────────────────┐               ┌──────────────────┐
│  Click FuseBox   │               │                  │
│  Button          │               │  Read from       │
│         │        │               │  sessionStorage  │
│         ▼        │               │         │        │
│  Store data in   │               │         ▼        │
│  sessionStorage  │─────────────▶│  Initialize      │
│         │        │               │  with fusion     │
│         ▼        │               │  data            │
│  window.open()   │               │         │        │
│  '/fusebox'      │               │         ▼        │
│                  │               │  User edits      │
│                  │               │  registration    │
│                  │               │         │        │
│  Listen for      │◀─────────────│  postMessage     │
│  messages        │               │  on save         │
│         │        │               │                  │
│         ▼        │               │                  │
│  Apply transform │               │                  │
│  to fusion       │               │                  │
└──────────────────┘               └──────────────────┘
```

## File Structure
```
client/src/
├── pages/
│   └── fusebox.tsx                # NEW - Standalone FuseBox page
├── components/dicom/
│   ├── bottom-toolbar-prototype-v2.tsx  # MODIFIED - Added FuseBox button
│   ├── unified-fusion-topbar.tsx  # MODIFIED - Added registration selector
│   └── viewer-interface.tsx       # MODIFIED - Opens FuseBox window
├── types/
│   └── fusion.ts                  # MODIFIED - Added RegistrationOption
└── App.tsx                        # MODIFIED - Added /fusebox route
```

## Future Enhancements (TODO)

### Phase 1 - Core Integration
- [ ] Connect to real DICOM rendering in viewports (Cornerstone.js)
- [ ] Load actual RT Structures from database
- [ ] Implement actual slice navigation with real data
- [ ] Apply transforms in real-time to fusion overlay

### Phase 2 - Registration
- [ ] Implement actual rigid auto-registration (ITK-WASM)
- [ ] Save transforms back to database as new REG DICOM files
- [ ] Support loading existing registration transforms
- [ ] Add registration comparison (before/after)

### Phase 3 - Advanced Features
- [ ] Deformable registration support
- [ ] Multi-modality fusion (CT + MR + PET simultaneous)
- [ ] Export fused series with applied transforms
- [ ] Dose mapping with deformable registration

## Testing

1. Start the development server
2. Load a study with fusion-compatible scans (CT + MR or CT + PET)
3. In the viewer, select a secondary scan from the fusion dropdown
4. Verify the FuseBox button appears in the bottom toolbar
5. Click FuseBox to open the editor in a new window
6. Test all 8 evaluation modes
7. Test transform controls and see viewport updates
8. Test auto-registration buttons (mock 2-second delay)
9. Test keyboard shortcuts
10. Test Save/Reset/Close buttons
11. If multiple registrations exist, test the registration selector in the main viewer

## Notes

- FuseBox uses mock canvas rendering for viewports (placeholder)
- Auto-registration applies mock transforms (not real registration)
- Save button sends data via postMessage but doesn't persist yet
- The window size is optimized for 1400x900 pixels
