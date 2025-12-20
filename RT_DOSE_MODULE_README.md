# RT Dose Display Module

This module provides radiotherapy dose (RTDOSE) visualization capabilities, following OHIF/Cornerstone3D patterns and clinical standards.

## Integration Overview

The dose module integrates into the existing viewer like the fusion system:

1. **Series Panel**: RTDOSE series appear under RT Structure Sets in the series hierarchy
2. **Dose Toolbar**: Clicking a dose series opens a floating control panel (positioned left of fusion toolbar)
3. **Dose Overlay**: Color wash and isodose lines render on the viewport
4. **Context Provider**: Wraps the viewer to provide state management

```
┌─────────────────────────────────────────────────────────┐
│  Series Panel                                           │
│  ├── CT Series (Primary)                               │
│  │   ├── RT Structure Set                              │
│  │   │   └── [Contour list...]                        │
│  │   └── RT Dose  ← NEW: Clicking opens dose toolbar  │
│  └── Fusion Series (MR/PET)                           │
└─────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                        Viewport                                │
│                                                                │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  [Dose overlay with color wash + isodose lines]        │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Fixed bottom toolbars:
┌────────────────────┐  ┌──────────────────────┐
│  Dose Control      │  │  Fusion Control      │
│  Panel (left)      │  │  Panel (right)       │
└────────────────────┘  └──────────────────────┘
```

## Features

### ✅ Core Capabilities
- **Dose Color Wash** - Multiple colormap options (rainbow, hot, jet, cool, dosimetry, grayscale)
- **Isodose Lines** - Contour lines at configurable dose levels
- **Dose Statistics** - Min, max, mean, D95, D50 calculations
- **Prescription Normalization** - Display doses as % of prescription or absolute Gy
- **Interactive Controls** - Opacity, colormap, threshold adjustments

### ✅ Colormaps
| Colormap | Description |
|----------|-------------|
| `rainbow` | Classic dose wash (blue → cyan → green → yellow → orange → red) |
| `hot` | Dark to bright (similar to Eclipse TPS) |
| `jet` | MATLAB-style colormap |
| `cool` | Blue to magenta gradient |
| `dosimetry` | Clinical standard with discrete bands |
| `grayscale` | For overlays where color isn't needed |

### ✅ Standard Isodose Colors
Following Eclipse/Pinnacle conventions:
- 107% - Magenta (hot spot warning)
- 105% - Red
- 100% - Orange (prescription)
- 95% - Yellow
- 90% - Green
- 80% - Cyan
- 70% - Light blue
- 50% - Blue
- 30% - Purple

## Architecture

```
client/src/
├── dose/
│   ├── index.ts              # Public API exports
│   └── dose-context.tsx      # React context for state management
├── lib/
│   └── rt-dose-manager.ts    # Core dose handling, colormaps, caching
└── components/dicom/
    └── rt-dose-overlay.tsx   # React components for visualization

server/
└── rt-dose-api.ts            # API routes for dose data
```

## Usage

### 1. Wrap Your App with DoseProvider

```tsx
import { DoseProvider } from '@/dose';

function App() {
  return (
    <DoseProvider studyId={studyId}>
      <YourViewer />
    </DoseProvider>
  );
}
```

### 2. Add Dose Overlay to Viewport

```tsx
import { RTDoseOverlay, DoseLegend, DoseControlPanel } from '@/dose';

function Viewport() {
  const viewportRef = useRef<HTMLDivElement>(null);
  
  return (
    <div ref={viewportRef} className="relative">
      {/* Main DICOM viewport canvas */}
      <canvas ... />
      
      {/* Dose overlay */}
      <RTDoseOverlay
        viewportRef={viewportRef}
        slicePosition={currentSliceZ}
        imageWidth={512}
        imageHeight={512}
        canvasWidth={512}
        canvasHeight={512}
        zoom={zoom}
        panX={panX}
        panY={panY}
      />
      
      {/* Dose legend */}
      <DoseLegend position="right" />
    </div>
  );
}
```

### 3. Add Control Panel

```tsx
import { DoseControlPanel } from '@/dose';

function Sidebar() {
  return (
    <div>
      <DoseControlPanel />
    </div>
  );
}
```

### 4. Use the Hook for Custom Logic

```tsx
import { useDose } from '@/dose';

function MyComponent() {
  const {
    hasDoseOverlay,
    config,
    setColormap,
    setOpacity,
    toggleIsodoseLines,
  } = useDose();
  
  // Custom controls...
}
```

## API Endpoints

### GET `/api/rt-dose/:seriesId/metadata`
Returns dose grid metadata including:
- Grid dimensions (rows, columns, frames)
- Pixel spacing and orientation
- Dose units and type
- Min/max dose values
- Grid frame offset vector (Z positions)

### GET `/api/rt-dose/:seriesId/frame/:frameIndex`
Returns dose data for a specific frame:
- Slice position in patient coordinates
- Dose values as array (in Gy)
- Frame-specific min/max

### GET `/api/rt-dose/:seriesId/summary`
Returns dose distribution statistics:
- Overall min/max/mean
- Dose histogram

## Configuration Options

```typescript
interface RTDoseConfig {
  doseSeriesId: number;
  colormap: 'rainbow' | 'hot' | 'jet' | 'cool' | 'dosimetry' | 'grayscale';
  opacity: number;                   // 0-1
  thresholds: {
    min: number;                     // Gy - below this is transparent
    max: number;                     // Gy - clamped to max color
    prescription?: number;           // Gy - reference for % display
  };
  showIsodose: boolean;
  isodoseLevels: number[];           // e.g., [30, 50, 70, 80, 90, 95, 100, 105]
  isodoseLineWidth: number;
  usePercentage: boolean;            // % of prescription vs absolute Gy
}
```

## DICOM Tags Used

| Tag | Name | Purpose |
|-----|------|---------|
| (3004,0002) | Dose Units | GY or RELATIVE |
| (3004,0004) | Dose Type | PHYSICAL, EFFECTIVE, ERROR |
| (3004,0006) | Dose Summation Type | PLAN, FRACTION, BEAM, etc. |
| (3004,000C) | Grid Frame Offset Vector | Z positions of each frame |
| (3004,000E) | Dose Grid Scaling | Scale factor to convert to Gy |
| (0028,0008) | Number of Frames | Multi-frame dose grid |
| (7FE0,0010) | Pixel Data | Raw dose values |

## Integration Status ✅

The RT Dose module has been fully integrated into the viewer:

### Completed Integrations

1. **series-selector.tsx** - Added:
   - `doseSeries` state
   - Effect to load RTDOSE series from API
   - RTDOSE entries rendered under RT structures with orange styling
   - Click handlers to select dose and show panel

2. **viewer-interface.tsx** - Added:
   - All dose-related state (opacity, colormap, isodose, visibility, etc.)
   - Effect to extract dose series from loaded series
   - Effect to load dose metadata when series selected
   - `DoseControlPanel` component rendered before fusion panel
   - Dose props passed to SeriesSelector

3. **pills.ts** - Added RTDOSE and RTPLAN badge colors

### How It Works Now

1. When a study loads, RTDOSE series are automatically detected
2. RTDOSE entries appear in the series panel under RT Structure Sets (with orange "DOSE" badge)
3. Clicking a dose entry opens the Dose Control Panel (positioned left of fusion panel)
4. The panel provides colormap, opacity, isodose, and prescription dose controls

---

## Code Reference (for future modifications)

### Step 1: Add to Series Selector

In `series-selector.tsx`, add state for dose series alongside RT structures:

```tsx
// Add state for dose series
const [doseSeries, setDoseSeries] = useState<any[]>([]);
const [selectedDoseSeries, setSelectedDoseSeries] = useState<any>(null);
const [showDosePanel, setShowDosePanel] = useState(false);

// Load dose series alongside RT structures
useEffect(() => {
  const loadDoseSeries = async () => {
    const studyIdsToLoad = studyIds || (studyId ? [studyId] : []);
    for (const id of studyIdsToLoad) {
      const response = await fetch(`/api/studies/${id}/series?modality=RTDOSE`);
      if (response.ok) {
        const data = await response.json();
        setDoseSeries(prev => [...prev, ...data]);
      }
    }
  };
  loadDoseSeries();
}, [studyId, studyIds]);
```

Add dose series display under RT structures in the series hierarchy:

```tsx
{/* RT Dose Series - nested under RT Structures */}
{doseSeries.filter(d => d.referencedSeriesId === ctSeries.id).map(dose => (
  <Button
    key={dose.id}
    variant="ghost"
    className={cn(
      "w-full px-2 py-1 text-xs",
      selectedDoseSeries?.id === dose.id 
        ? 'bg-orange-500/20 border-orange-400/60' 
        : 'bg-gray-800/20'
    )}
    onClick={() => {
      setSelectedDoseSeries(dose);
      setShowDosePanel(true);
      onDoseSeriesSelect?.(dose.id);
    }}
  >
    <Badge className={pillClassForModality('RTDOSE')}>DOSE</Badge>
    <span>{dose.seriesDescription || 'RT Dose'}</span>
  </Button>
))}
```

### Step 2: Add DoseControlPanel to Working Viewer

In `working-viewer.tsx` or your main viewer component:

```tsx
import { DoseProvider, DoseControlPanel, DoseOverlay, useDose } from '@/dose';

function WorkingViewer({ studyId, ... }) {
  // Dose state
  const [showDosePanel, setShowDosePanel] = useState(false);
  const [selectedDoseSeriesId, setSelectedDoseSeriesId] = useState<number | null>(null);
  const [doseSeries, setDoseSeries] = useState<any[]>([]);
  
  return (
    <DoseProvider studyId={studyId}>
      {/* ... existing viewport code ... */}
      
      {/* Dose overlay on canvas */}
      <DoseOverlay
        viewportRef={viewportRef}
        slicePosition={currentSliceZ}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        zoom={zoom}
        panX={panX}
        panY={panY}
      />
      
      {/* Dose control panel - positioned left of fusion panel */}
      {showDosePanel && (
        <DoseControlPanelConnected 
          onClose={() => setShowDosePanel(false)}
        />
      )}
      
      {/* Existing fusion panel */}
      <FusionControlPanel ... />
    </DoseProvider>
  );
}

// Connected component that uses the dose context
function DoseControlPanelConnected({ onClose }: { onClose: () => void }) {
  const {
    availableDoseSeries,
    selectedDoseSeriesId,
    selectDoseSeries,
    config,
    setColormap,
    setOpacity,
    toggleIsodoseLines,
    isVisible,
    setVisible,
    loadStatus,
    loadError,
    metadata,
  } = useDose();
  
  return (
    <DoseControlPanel
      doseSeriesOptions={availableDoseSeries}
      selectedDoseSeriesId={selectedDoseSeriesId}
      onDoseSeriesSelect={selectDoseSeries}
      opacity={config.opacity}
      onOpacityChange={setOpacity}
      colormap={config.colormap}
      onColormapChange={setColormap}
      showIsodose={config.showIsodose}
      onShowIsodoseChange={toggleIsodoseLines}
      isodoseLevels={config.isodoseLevels}
      prescriptionDose={config.thresholds.prescription}
      onPrescriptionDoseChange={(d) => { /* update prescription */ }}
      isVisible={isVisible}
      onVisibilityChange={setVisible}
      isLoading={loadStatus === 'loading'}
      loadError={loadError}
      metadata={metadata}
      minimized={false}
      onToggleMinimized={(m) => { if (m) onClose(); }}
    />
  );
}
```

### Step 3: Update pills.ts for RTDOSE Badge Color

In `lib/pills.ts`, add the RTDOSE modality color:

```tsx
export function pillClassForModality(modality: string): string {
  switch (modality?.toUpperCase()) {
    case 'CT': return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
    case 'MR': return 'bg-green-500/20 border-green-500/40 text-green-300';
    case 'RTSTRUCT': return 'bg-purple-500/20 border-purple-500/40 text-purple-300';
    case 'RTDOSE': return 'bg-orange-500/20 border-orange-500/40 text-orange-300';
    case 'RTPLAN': return 'bg-red-500/20 border-red-500/40 text-red-300';
    // ...
  }
}
```

### Props to Pass Between Components

The series selector needs to communicate with the viewer:

```tsx
interface SeriesSelectorProps {
  // ... existing props ...
  
  // New dose props
  doseSeries?: any[];
  selectedDoseSeriesId?: number | null;
  onDoseSeriesSelect?: (seriesId: number | null) => void;
  onShowDosePanel?: (show: boolean) => void;
}
```

## Future Enhancements

- [ ] DVH (Dose-Volume Histogram) calculation
- [ ] Structure-specific dose statistics
- [ ] Dose difference display (plan comparison)
- [ ] Export to dose report
- [ ] 3D dose rendering

