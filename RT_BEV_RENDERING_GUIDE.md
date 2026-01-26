# BEV Rendering: Exact Methodology and React/TypeScript Conversion

This document explains **exactly** how the C#/WPF BEV (Beam's Eye View) rendering works, step by step, and provides direct TypeScript/React conversions for each component.

---

## Table of Contents

1. [Overview: How BEV Rendering Works](#1-overview-how-bev-rendering-works)
2. [The Rendering Pipeline](#2-the-rendering-pipeline)
3. [Coordinate System and Transformations](#3-coordinate-system-and-transformations)
4. [DRR Background Image](#4-drr-background-image)
5. [Jaw Rendering](#5-jaw-rendering)
6. [MLC Leaf Position Rendering](#6-mlc-leaf-position-rendering)
7. [Wedge Rendering](#7-wedge-rendering)
8. [Block Rendering](#8-block-rendering)
9. [Structure Projection](#9-structure-projection)
10. [Reference Point Projection](#10-reference-point-projection)
11. [Crosshair and Scale](#11-crosshair-and-scale)
12. [Orientation Labels](#12-orientation-labels)
13. [Complete TypeScript Implementation](#13-complete-typescript-implementation)

---

## 1. Overview: How BEV Rendering Works

### What is BEV?

BEV (Beam's Eye View) shows the radiation field from the perspective of the radiation source, as if you're looking down the beam at the patient. It displays:

1. **DRR Background** - Digitally Reconstructed Radiograph (X-ray-like image)
2. **Jaw Aperture** - The rectangular collimator opening
3. **MLC Leaves** - Multi-leaf collimator positions forming the field shape
4. **Wedges** - Beam modifiers shown as triangles
5. **Blocks** - Custom field shaping blocks
6. **Structure Projections** - Patient anatomy projected onto the beam plane
7. **Reference Points** - Dose reference points projected
8. **Crosshair & Scale** - Visual aids showing isocenter and distances
9. **Orientation Labels** - L/R/H/F labels showing patient orientation

### The Core Concept

The BEV is essentially a 2D projection plane at the isocenter (typically 100cm from source). Everything is drawn in millimeters relative to the isocenter, then transformed to canvas pixels.

**Key Formula:**
```
canvas_position = isocenter_pixel + (mm_position × resolution × zoom)
```

Where:
- `isocenter_pixel` = center of the canvas
- `mm_position` = position in mm relative to isocenter
- `resolution` = pixels per mm (typically ~1 pixel/mm for a 512×512 image covering 400mm)
- `zoom` = current zoom level

---

## 2. The Rendering Pipeline

### C# Original (`BevImageGenerator.Render`)

```csharp
// From BevImageGenerator.cs - Main render method
private RenderTargetBitmap Render(WriteableBitmap writeableBitmap)
{
    PrepareRender();                              // Step 1: Calculate center, diagonal
    eclipseBeam.FieldJawRect = GetJaws();         // Step 2: Get jaw rectangle
    var applicatorRect = GetApplicatorRect(...);  // Step 3: Get applicator bounds
    
    var drawing = new DrawingVisual();
    
    // Apply transforms: zoom and pan
    var scaleTransform = new ScaleTransform(ZoomLevel, ZoomLevel, fitWidth / 2, fitHeight / 2);
    var translateTransform = new TranslateTransform(ImageShift.X, ImageShift.Y);
    
    using (DrawingContext context = drawing.RenderOpen())
    {
        // 1. Black background
        context.DrawRectangle(Brushes.Black, ...);
        
        // 2. Apply zoom/pan transforms
        context.PushTransform(scaleTransform);
        context.PushTransform(translateTransform);
        
        // 3. Draw DRR background image
        context.DrawImage(writeableBitmap, ...);
        
        // 4. Create combined transform for all elements
        currentTransform = new TransformGroup() { translateTransform, scaleTransform };
        
        // 5. Draw structures (projected)
        DrawStructures(context);
        
        // 6. Draw reference points
        DrawReferencePoints(context);
        
        // 7. Draw scale ruler (top-right)
        DrawTopRightScale(context);
        
        // 8. Add collimator rotation to transform
        var rotationTransform = new RotateTransform(-collimatorAngle, isocenter.X, isocenter.Y);
        currentTransform.Children.Insert(0, rotationTransform);
        
        // 9. Draw crosshair (rotated with collimator)
        DrawCrosshair(context);
        
        // 10. Draw jaw elements (jaws, MLC, wedges, blocks)
        DrawJawElements(context);
        
        // 11. Draw warnings if needed
        if (drawBlockWarning) DrawBlockWarning(context);
        
        // 12. Draw labels
        DrawWedgeLabels(context, ...);
        DrawJawLabels(context, ...);
        DrawOrientationCharacters(context, ...);
        DrawApplicatorLabel(context);
        DrawOrientationImage(context);
    }
    
    // Render to bitmap
    var bmp = new RenderTargetBitmap((int)fitWidth, (int)fitHeight, ...);
    bmp.Render(drawing);
    return bmp;
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/BevRenderer.ts

export class BevRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private center: { x: number; y: number };
  private pixelsPerMm: number;
  private zoomLevel: number = 1;
  private panOffset: { x: number; y: number } = { x: 0, y: 0 };
  
  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Center of canvas = isocenter
    this.center = { x: this.width / 2, y: this.height / 2 };
    
    // Calculate scale: fit 400mm field to 90% of canvas
    const fieldSizeMm = 400;
    const margin = 0.9;
    this.pixelsPerMm = (Math.min(this.width, this.height) * margin) / fieldSizeMm;
  }
  
  /**
   * Main render function - this is the complete pipeline
   */
  render(data: BevRenderData): void {
    const { ctx } = this;
    
    // Step 1: Clear with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Step 2: Save context and apply zoom/pan
    ctx.save();
    ctx.translate(this.center.x + this.panOffset.x, this.center.y + this.panOffset.y);
    ctx.scale(this.zoomLevel, this.zoomLevel);
    ctx.translate(-this.center.x, -this.center.y);
    
    // Step 3: Draw DRR background
    if (data.drrImage) {
      this.drawDrrBackground(data.drrImage);
    }
    
    // Step 4: Draw projected structures
    this.drawStructures(data.projectedStructures);
    
    // Step 5: Draw reference points
    this.drawReferencePoints(data.referencePoints);
    
    // Step 6: Draw scale ruler
    this.drawScale();
    
    // Step 7: Apply collimator rotation for field elements
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    ctx.rotate(-data.collimatorAngle * Math.PI / 180);  // Negative for screen coords
    ctx.translate(-this.center.x, -this.center.y);
    
    // Step 8: Draw crosshair
    this.drawCrosshair();
    
    // Step 9: Draw field elements (jaws, MLC, wedges, blocks)
    this.drawJaws(data.jawPositions, data.isSetupField);
    this.drawMlc(data.mlcLeafPositions, data.jawPositions, data.mlcModel);
    this.drawWedges(data.wedges, data.jawPositions);
    this.drawBlocks(data.blocks);
    
    ctx.restore();  // Remove collimator rotation
    
    // Step 10: Draw orientation labels (not rotated with collimator)
    this.drawOrientationLabels(data.orientationLabels, data.collimatorAngle);
    
    ctx.restore();  // Remove zoom/pan
    
    // Step 11: Draw fixed-position labels (beam info)
    this.drawBeamInfo(data);
  }
  
  /**
   * Convert mm position to canvas pixels
   * This is the fundamental coordinate conversion
   */
  private mmToCanvas(mmX: number, mmY: number): { x: number; y: number } {
    return {
      x: this.center.x + mmX * this.pixelsPerMm,
      y: this.center.y - mmY * this.pixelsPerMm,  // Y is inverted in canvas
    };
  }
}
```

---

## 3. Coordinate System and Transformations

### Understanding the Coordinate Systems

**DICOM Patient Coordinates:**
- X: Patient's left (+) to right (-)
- Y: Patient's posterior (+) to anterior (-)
- Z: Patient's feet (-) to head (+)

**BEV Coordinates (at isocenter plane):**
- Origin: Isocenter (beam central axis intersection with isocenter plane)
- X: Cross-plane direction (perpendicular to gantry rotation axis)
- Y: In-plane direction (along gantry rotation axis)
- Positive values in mm from centerline

**Canvas Coordinates:**
- Origin: Top-left corner
- X: Left to right (increases right)
- Y: Top to bottom (increases down) - **INVERTED from BEV**

### The Transform Chain (C#)

```csharp
// From BevImageGenerator.cs
currentTransform = new TransformGroup()
{
    Children =
    {
        translateTransform,   // Pan offset
        scaleTransform        // Zoom
    }
};

// For field elements, collimator rotation is added:
var rotationTransform = new RotateTransform(-firstControlPoint.CollimatorAngle, isocenter.X, isocenter.Y);
currentTransform.Children.Insert(0, rotationTransform);
```

### TypeScript Transform Helper

```typescript
// src/core/rendering/transformUtils.ts

export interface Transform2D {
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;  // radians
  rotationCenterX: number;
  rotationCenterY: number;
}

/**
 * Apply transform to a point
 */
export function applyTransform(
  point: { x: number; y: number },
  transform: Transform2D
): { x: number; y: number } {
  let { x, y } = point;
  
  // 1. Apply rotation around center
  if (transform.rotation !== 0) {
    const dx = x - transform.rotationCenterX;
    const dy = y - transform.rotationCenterY;
    const cos = Math.cos(transform.rotation);
    const sin = Math.sin(transform.rotation);
    x = transform.rotationCenterX + dx * cos - dy * sin;
    y = transform.rotationCenterY + dx * sin + dy * cos;
  }
  
  // 2. Apply translation
  x += transform.translateX;
  y += transform.translateY;
  
  // 3. Apply scale around canvas center
  x = (x - transform.rotationCenterX) * transform.scale + transform.rotationCenterX;
  y = (y - transform.rotationCenterY) * transform.scale + transform.rotationCenterY;
  
  return { x, y };
}

/**
 * Convert mm to canvas coordinates with transform
 */
export function mmToCanvasWithTransform(
  mmX: number,
  mmY: number,
  isocenter: { x: number; y: number },
  pixelsPerMm: number,
  transform: Transform2D
): { x: number; y: number } {
  // First convert mm to base canvas position
  const baseX = isocenter.x + mmX * pixelsPerMm;
  const baseY = isocenter.y - mmY * pixelsPerMm;  // Y inverted
  
  // Then apply transforms
  return applyTransform({ x: baseX, y: baseY }, transform);
}
```

---

## 4. DRR Background Image

### C# Original

```csharp
// From BevImageGenerator.cs
private WriteableBitmap CreateDrrBackgroundImage()
{
    var writeableBitmap = new WriteableBitmap(width, height, ImageHelper.Dpi, ImageHelper.Dpi, 
        PixelFormats.Bgr32, null);
    
    if (imagePlaneOriginal == null)
    {
        SetBackground(writeableBitmap);  // Gray background if no DRR
    }
    else
    {
        WritePixels(writeableBitmap, imagePlaneOriginal);
    }
    
    return writeableBitmap;
}

private void WritePixels(WriteableBitmap writeableBitmap, int[,] imagePixels)
{
    var pixels = new byte[height * width * 4];
    var window = DrrImageWindow;
    var level = DrrImageLevel;
    var blackCutoff = level - window / 2;
    var whiteCutoff = level + window / 2;
    
    for (int x = 0; x < width; x++)
    {
        for (int y = 0; y < height; y++)
        {
            int offset = (x + (pixelWidth * y)) * bitsPerPixel8;
            var pixelData = imagePixels[x, y];
            
            // Apply window/level
            byte color;
            if (pixelData <= blackCutoff)
                color = 0;
            else if (pixelData >= whiteCutoff)
                color = 255;
            else
                color = (byte)Math.Round(255 * (pixelData - blackCutoff) / (double)window);
            
            // Set RGB to same value (grayscale)
            pixels[offset + 0] = color;  // B
            pixels[offset + 1] = color;  // G
            pixels[offset + 2] = color;  // R
            pixels[offset + 3] = 255;    // A
        }
    }
    
    writeableBitmap.WritePixels(rect, pixels, stride, 0);
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/drrProcessor.ts

export interface DrrImageParams {
  width: number;
  height: number;
  pixelData: Int16Array;  // Raw HU values
  windowWidth: number;
  windowCenter: number;
}

/**
 * Convert raw DRR pixel data to ImageData with window/level applied
 */
export function processDrrImage(params: DrrImageParams): ImageData {
  const { width, height, pixelData, windowWidth, windowCenter } = params;
  
  // Create ImageData for canvas
  const imageData = new ImageData(width, height);
  const data = imageData.data;  // Uint8ClampedArray
  
  // Window/level cutoffs
  const blackCutoff = windowCenter - windowWidth / 2;
  const whiteCutoff = windowCenter + windowWidth / 2;
  
  for (let i = 0; i < pixelData.length; i++) {
    const pixelValue = pixelData[i];
    
    // Apply window/level transformation
    let color: number;
    if (pixelValue <= blackCutoff) {
      color = 0;
    } else if (pixelValue >= whiteCutoff) {
      color = 255;
    } else {
      color = Math.round(255 * (pixelValue - blackCutoff) / windowWidth);
    }
    
    // Set RGBA values (grayscale)
    const offset = i * 4;
    data[offset + 0] = color;  // R
    data[offset + 1] = color;  // G
    data[offset + 2] = color;  // B
    data[offset + 3] = 255;    // A (fully opaque)
  }
  
  return imageData;
}

/**
 * Draw DRR image on canvas, centered at isocenter
 */
export function drawDrrOnCanvas(
  ctx: CanvasRenderingContext2D,
  drrImageData: ImageData,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Create temporary canvas to hold ImageData
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = drrImageData.width;
  tempCanvas.height = drrImageData.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  
  tempCtx.putImageData(drrImageData, 0, 0);
  
  // Draw centered on main canvas
  const x = (canvasWidth - drrImageData.width) / 2;
  const y = (canvasHeight - drrImageData.height) / 2;
  
  ctx.drawImage(tempCanvas, x, y);
}
```

---

## 5. Jaw Rendering

### C# Original

```csharp
// From BevImageGenerator.cs
private Rect GetJaws()
{
    Rect jawRect = Rect.Empty;
    if (anyControlPoints)
    {
        double minX1 = double.MaxValue;
        double maxX2 = double.MinValue;
        double minY1 = double.MaxValue;
        double maxY2 = double.MinValue;
        
        // Find the maximum field opening across all control points
        foreach (EclipseControlPoint cp in allControlPoints)
        {
            if (cp.JawPositions.X1 < minX1) minX1 = cp.JawPositions.X1;
            if (cp.JawPositions.X2 > maxX2) maxX2 = cp.JawPositions.X2;
            if (cp.JawPositions.Y1 < minY1) minY1 = cp.JawPositions.Y1;
            if (cp.JawPositions.Y2 > maxY2) maxY2 = cp.JawPositions.Y2;
        }
        
        // Convert to canvas coordinates
        // Note: Y is inverted - Y2 becomes top, Y1 becomes bottom
        jawRect = new Rect(
            new Point(isocenter.X + minX1 * xResolution, isocenter.Y - minY1 * yResolution),
            new Point(isocenter.X + maxX2 * xResolution, isocenter.Y - maxY2 * yResolution));
    }
    return jawRect;
}

private void DrawJawElements(DrawingContext context)
{
    Brush brush = isSetupField ? setupJawBrush : jawBrush;
    
    var boundsGeometry = new RectangleGeometry(eclipseBeam.FieldBoundsRect, 0, 0, currentTransform);
    
    // Clip MLC to jaw rectangle
    context.PushClip(boundsGeometry);
    DrawMlcControlPoints(context);
    context.Pop();
    
    // Draw blocks and wedges
    DrawBlocks(context);
    DrawWedges(context);
    
    // Draw jaw rectangle outline
    context.DrawGeometry(Brushes.Transparent, new Pen(brush, JawThickness), boundsGeometry);
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/jawRenderer.ts

export interface JawPositions {
  x1: number;  // Left jaw (negative mm)
  x2: number;  // Right jaw (positive mm)
  y1: number;  // Bottom/Gun jaw (negative mm)
  y2: number;  // Top/Target jaw (positive mm)
}

export interface ControlPoint {
  jawPositions: JawPositions;
  // ... other properties
}

/**
 * Calculate the maximum jaw opening across all control points
 * This gives the "cumulative" field opening for IMRT/VMAT beams
 */
export function calculateMaxJawOpening(controlPoints: ControlPoint[]): JawPositions {
  let minX1 = Infinity;
  let maxX2 = -Infinity;
  let minY1 = Infinity;
  let maxY2 = -Infinity;
  
  for (const cp of controlPoints) {
    const jaws = cp.jawPositions;
    if (jaws.x1 < minX1) minX1 = jaws.x1;
    if (jaws.x2 > maxX2) maxX2 = jaws.x2;
    if (jaws.y1 < minY1) minY1 = jaws.y1;
    if (jaws.y2 > maxY2) maxY2 = jaws.y2;
  }
  
  return { x1: minX1, x2: maxX2, y1: minY1, y2: maxY2 };
}

/**
 * Draw jaw aperture rectangle
 */
export function drawJaws(
  ctx: CanvasRenderingContext2D,
  jaws: JawPositions,
  isocenter: { x: number; y: number },
  pixelsPerMm: number,
  isSetupField: boolean = false
): void {
  // Colors from original C#
  const color = isSetupField ? '#2FE7E5' : '#FFFF00';  // Cyan for setup, Yellow for treatment
  const lineWidth = 2;
  
  // Convert mm to canvas coordinates
  // Note: Y is inverted in canvas coordinates
  const left = isocenter.x + jaws.x1 * pixelsPerMm;
  const right = isocenter.x + jaws.x2 * pixelsPerMm;
  const top = isocenter.y - jaws.y2 * pixelsPerMm;     // Y2 is top in BEV
  const bottom = isocenter.y - jaws.y1 * pixelsPerMm;  // Y1 is bottom in BEV
  
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(left, top, right - left, bottom - top);
}

/**
 * Create clipping region for jaw aperture
 * Used to clip MLC to jaw bounds
 */
export function createJawClipPath(
  jaws: JawPositions,
  isocenter: { x: number; y: number },
  pixelsPerMm: number
): Path2D {
  const left = isocenter.x + jaws.x1 * pixelsPerMm;
  const right = isocenter.x + jaws.x2 * pixelsPerMm;
  const top = isocenter.y - jaws.y2 * pixelsPerMm;
  const bottom = isocenter.y - jaws.y1 * pixelsPerMm;
  
  const path = new Path2D();
  path.rect(left, top, right - left, bottom - top);
  return path;
}
```

---

## 6. MLC Leaf Position Rendering

### C# Original (GetMlcFieldShape)

The MLC rendering is the most complex part. Here's how it works:

```csharp
// From EclipseBeam.cs - GetMlcFieldShape (simplified)
public List<Tuple<Point, Point, DashStyle>> GetMlcFieldShape(...)
{
    List<Tuple<Point, Point, DashStyle>> mlcShape = new List<Tuple<Point, Point, DashStyle>>();
    
    // Start at the top of the MLC bank
    double y = isocenter.Y + MlcModel.StartY * yResolution;
    
    double previousLeft = 0, previousRight = 0, previousY = 0;
    bool drawingStarted = false;
    
    // Iterate through each leaf pair
    for (int i = 0; i < MlcModel.LeafWidths.Length; i++)
    {
        var leafWidth = MlcModel.LeafWidths[i];
        var nextY = y - leafWidth * yResolution;  // Y decreases going down
        
        // Get the most open position across all control points
        // (For CIAO - Cumulative Integrated Aperture Opening)
        var minLeftLeaf = controlPoints.Min(p => p.LeafPositions[0, i]);   // Bank A
        var maxRightLeaf = controlPoints.Max(p => p.LeafPositions[1, i]);  // Bank B
        
        // Convert to canvas coordinates
        double left = isocenter.X + minLeftLeaf * xResolution;
        double right = isocenter.X + maxRightLeaf * xResolution;
        
        // Check if this leaf pair is within the jaw aperture
        if (y >= FieldBoundsRect.Top && y <= FieldBoundsRect.Bottom)
        {
            // Draw vertical lines (leaf edges)
            mlcShape.Add(new Tuple(new Point(left, y), new Point(left, nextY), DashStyle.Solid));
            mlcShape.Add(new Tuple(new Point(right, y), new Point(right, nextY), DashStyle.Solid));
            
            // Draw horizontal connections to previous leaf
            if (drawingStarted)
            {
                mlcShape.Add(new Tuple(new Point(previousLeft, y), new Point(left, y), DashStyle.Solid));
                mlcShape.Add(new Tuple(new Point(previousRight, y), new Point(right, y), DashStyle.Solid));
            }
            
            drawingStarted = true;
        }
        else if (drawingStarted)
        {
            // Closing horizontal line
            mlcShape.Add(new Tuple(new Point(previousLeft, y), new Point(previousRight, y), DashStyle.Solid));
            break;
        }
        
        previousLeft = left;
        previousRight = right;
        previousY = y;
        y = nextY;
    }
    
    return mlcShape;
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/mlcRenderer.ts

export interface MlcModel {
  name: string;
  numLeafPairs: number;
  leafWidths: number[];  // Width of each leaf in mm
  startY: number;        // Y position of first leaf edge (typically -200mm)
}

export interface MlcLeafPositions {
  bankA: number[];  // Left bank positions (typically negative mm)
  bankB: number[];  // Right bank positions (typically positive mm)
}

export interface LineSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
  style: 'solid' | 'dashed';
}

/**
 * Known MLC models with their configurations
 */
export const MLC_MODELS: Record<string, MlcModel> = {
  'Millennium120': {
    name: 'Millennium120',
    numLeafPairs: 60,
    leafWidths: [
      ...Array(10).fill(10),   // 10 outer leaves at 10mm
      ...Array(40).fill(5),    // 40 central leaves at 5mm
      ...Array(10).fill(10),   // 10 outer leaves at 10mm
    ],
    startY: -200,  // First leaf starts at -200mm
  },
  'Agility': {
    name: 'Agility',
    numLeafPairs: 80,
    leafWidths: Array(80).fill(5),  // All leaves 5mm
    startY: -200,
  },
};

/**
 * Calculate the maximum MLC opening across all control points (CIAO)
 */
export function calculateMaxMlcOpening(
  controlPointPositions: MlcLeafPositions[]
): MlcLeafPositions {
  const numLeaves = controlPointPositions[0].bankA.length;
  const maxBankA = new Array(numLeaves).fill(Infinity);
  const maxBankB = new Array(numLeaves).fill(-Infinity);
  
  for (const cp of controlPointPositions) {
    for (let i = 0; i < numLeaves; i++) {
      // Bank A: take the MINIMUM (most open = most negative)
      if (cp.bankA[i] < maxBankA[i]) {
        maxBankA[i] = cp.bankA[i];
      }
      // Bank B: take the MAXIMUM (most open = most positive)
      if (cp.bankB[i] > maxBankB[i]) {
        maxBankB[i] = cp.bankB[i];
      }
    }
  }
  
  return { bankA: maxBankA, bankB: maxBankB };
}

/**
 * Generate MLC field shape as line segments
 */
export function generateMlcFieldShape(
  mlcModel: MlcModel,
  leafPositions: MlcLeafPositions,
  jaws: JawPositions,
  isocenter: { x: number; y: number },
  pixelsPerMm: number,
  minLeafGap: number = 0  // Minimum gap to draw (for filtering closed leaves)
): LineSegment[] {
  const segments: LineSegment[] = [];
  
  // Start at top of MLC bank
  let y = isocenter.y - mlcModel.startY * pixelsPerMm;  // Convert to canvas (Y inverted)
  
  // Track previous leaf positions for horizontal connections
  let prevLeft = 0;
  let prevRight = 0;
  let prevY = 0;
  let drawingStarted = false;
  
  // Jaw bounds in canvas coordinates
  const jawTop = isocenter.y - jaws.y2 * pixelsPerMm;
  const jawBottom = isocenter.y - jaws.y1 * pixelsPerMm;
  
  for (let i = 0; i < mlcModel.leafWidths.length; i++) {
    const leafWidth = mlcModel.leafWidths[i];
    const nextY = y + leafWidth * pixelsPerMm;  // Y increases going down in canvas
    
    const leftMm = leafPositions.bankA[i];
    const rightMm = leafPositions.bankB[i];
    
    // Skip if leaf gap is below minimum (closed leaf)
    if (rightMm - leftMm < minLeafGap) {
      if (drawingStarted) {
        // Close the shape with horizontal line
        segments.push({
          start: { x: prevLeft, y },
          end: { x: prevRight, y },
          style: 'solid',
        });
        drawingStarted = false;
      }
      y = nextY;
      continue;
    }
    
    // Convert to canvas coordinates
    const left = isocenter.x + leftMm * pixelsPerMm;
    const right = isocenter.x + rightMm * pixelsPerMm;
    
    // Check if this leaf row is within jaw aperture
    if (y >= jawTop && y <= jawBottom) {
      // Draw vertical lines (leaf edges)
      segments.push({
        start: { x: left, y },
        end: { x: left, y: Math.min(nextY, jawBottom) },
        style: 'solid',
      });
      segments.push({
        start: { x: right, y },
        end: { x: right, y: Math.min(nextY, jawBottom) },
        style: 'solid',
      });
      
      // Draw horizontal connections
      if (drawingStarted) {
        segments.push({
          start: { x: prevLeft, y },
          end: { x: left, y },
          style: 'solid',
        });
        segments.push({
          start: { x: prevRight, y },
          end: { x: right, y },
          style: 'solid',
        });
      } else {
        // First visible leaf - draw top horizontal line
        segments.push({
          start: { x: left, y },
          end: { x: right, y },
          style: 'solid',
        });
      }
      
      drawingStarted = true;
      prevLeft = left;
      prevRight = right;
    } else if (drawingStarted && y > jawBottom) {
      // We've passed the bottom of the jaw - close the shape
      segments.push({
        start: { x: prevLeft, y: jawBottom },
        end: { x: prevRight, y: jawBottom },
        style: 'solid',
      });
      break;
    }
    
    prevY = y;
    y = nextY;
  }
  
  return segments;
}

/**
 * Draw MLC field shape on canvas
 */
export function drawMlcShape(
  ctx: CanvasRenderingContext2D,
  segments: LineSegment[],
  color: string = '#FFFF80'  // Light yellow from original C#
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.75;
  
  for (const segment of segments) {
    ctx.beginPath();
    
    if (segment.style === 'dashed') {
      ctx.setLineDash([3, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.moveTo(segment.start.x, segment.start.y);
    ctx.lineTo(segment.end.x, segment.end.y);
    ctx.stroke();
  }
  
  ctx.setLineDash([]);  // Reset
}
```

---

## 7. Wedge Rendering

### C# Original

```csharp
// From BevImageGenerator.cs
private void DrawWedges(DrawingContext context)
{
    foreach (var wedge in beamWedges)
    {
        var wedgeDirection = GetValidDirection(wedge.Direction);
        
        // Draw wedge triangle
        PathFigure triangle = GetWedgeTrianglePoints(wedgeDirection, eclipseBeam.FieldBoundsRect);
        context.DrawGeometry(Brushes.Transparent,
            new Pen(wedgeBrush, 1),
            new PathGeometry(new List<PathFigure> {triangle}));
    }
}

private int GetValidDirection(double direction)
{
    if (direction >= 315 || direction <= 45)
        return 0;    // IN (thick end toward Y2/top)
    else if (direction > 45 && direction < 135)
        return 90;   // RIGHT (thick end toward X2)
    else if (direction >= 135 && direction <= 225)
        return 180;  // OUT (thick end toward Y1/bottom)
    else
        return 270;  // LEFT (thick end toward X1)
}

private PathFigure GetWedgeTrianglePoints(int direction, Rect jawRect)
{
    Point corner, toeCorner;
    TranslateTransform translateTransform = new TranslateTransform();
    double toeAngleTan = Math.Tan(10 * Math.PI / 180);  // 10 degree toe angle
    
    switch (direction)
    {
        case 0:  // IN - triangle on X1 side, toe toward Y2
            toeCorner = jawRect.TopLeft;
            corner = jawRect.BottomLeft;
            translateTransform.X = -(jawRect.Height) * toeAngleTan;
            break;
        case 90:  // RIGHT - triangle on Y1 side, toe toward X1
            toeCorner = jawRect.BottomLeft;
            corner = jawRect.BottomRight;
            translateTransform.Y = (jawRect.Width) * toeAngleTan;
            break;
        case 180:  // OUT - triangle on X2 side, toe toward Y1
            toeCorner = jawRect.BottomRight;
            corner = jawRect.TopRight;
            translateTransform.X = (jawRect.Height) * toeAngleTan;
            break;
        case 270:  // LEFT - triangle on Y2 side, toe toward X2
            toeCorner = jawRect.TopRight;
            corner = jawRect.TopLeft;
            translateTransform.Y = -(jawRect.Width) * toeAngleTan;
            break;
    }
    
    return new PathFigure(toeCorner,
        new List<PathSegment>
        {
            new PolyLineSegment(new List<Point>()
            {
                translateTransform.Transform(corner),
                corner
            }, true)
        },
        false);
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/wedgeRenderer.ts

export interface Wedge {
  id: string;
  type: 'STANDARD' | 'DYNAMIC' | 'MOTORIZED';
  angle: number;      // degrees (15, 30, 45, 60)
  direction: number;  // 0-359 degrees
}

/**
 * Normalize wedge direction to standard values (0, 90, 180, 270)
 */
function normalizeDirection(direction: number): number {
  if (direction >= 315 || direction <= 45) return 0;     // IN
  if (direction > 45 && direction < 135) return 90;      // RIGHT
  if (direction >= 135 && direction <= 225) return 180;  // OUT
  return 270;  // LEFT
}

/**
 * Calculate wedge triangle points
 * The triangle shows wedge orientation - thick end is at the base of the triangle
 */
export function calculateWedgeTriangle(
  direction: number,
  jaws: JawPositions,
  isocenter: { x: number; y: number },
  pixelsPerMm: number
): { x: number; y: number }[] {
  const normalizedDir = normalizeDirection(direction);
  
  // Convert jaw positions to canvas coordinates
  const left = isocenter.x + jaws.x1 * pixelsPerMm;
  const right = isocenter.x + jaws.x2 * pixelsPerMm;
  const top = isocenter.y - jaws.y2 * pixelsPerMm;
  const bottom = isocenter.y - jaws.y1 * pixelsPerMm;
  
  // Triangle toe angle (10 degrees for visual clarity)
  const toeAngle = 10 * Math.PI / 180;
  const toeTan = Math.tan(toeAngle);
  
  let toeCorner: { x: number; y: number };
  let baseCorner1: { x: number; y: number };
  let baseCorner2: { x: number; y: number };
  
  switch (normalizedDir) {
    case 0:  // IN - thick end at top (Y2)
      toeCorner = { x: left, y: top };
      baseCorner1 = { x: left - (bottom - top) * toeTan, y: bottom };
      baseCorner2 = { x: left, y: bottom };
      break;
      
    case 90:  // RIGHT - thick end at right (X2)
      toeCorner = { x: left, y: bottom };
      baseCorner1 = { x: right, y: bottom + (right - left) * toeTan };
      baseCorner2 = { x: right, y: bottom };
      break;
      
    case 180:  // OUT - thick end at bottom (Y1)
      toeCorner = { x: right, y: bottom };
      baseCorner1 = { x: right + (bottom - top) * toeTan, y: top };
      baseCorner2 = { x: right, y: top };
      break;
      
    case 270:  // LEFT - thick end at left (X1)
    default:
      toeCorner = { x: right, y: top };
      baseCorner1 = { x: left, y: top - (right - left) * toeTan };
      baseCorner2 = { x: left, y: top };
      break;
  }
  
  return [toeCorner, baseCorner1, baseCorner2];
}

/**
 * Draw wedge triangle on canvas
 */
export function drawWedge(
  ctx: CanvasRenderingContext2D,
  wedge: Wedge,
  jaws: JawPositions,
  isocenter: { x: number; y: number },
  pixelsPerMm: number
): void {
  const trianglePoints = calculateWedgeTriangle(
    wedge.direction,
    jaws,
    isocenter,
    pixelsPerMm
  );
  
  const color = '#FFA500';  // Orange from original C#
  
  ctx.beginPath();
  ctx.moveTo(trianglePoints[0].x, trianglePoints[0].y);
  ctx.lineTo(trianglePoints[1].x, trianglePoints[1].y);
  ctx.lineTo(trianglePoints[2].x, trianglePoints[2].y);
  ctx.closePath();
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draw wedge label (showing wedge angle)
 */
export function drawWedgeLabel(
  ctx: CanvasRenderingContext2D,
  wedge: Wedge,
  trianglePoints: { x: number; y: number }[],
  isocenter: { x: number; y: number }
): void {
  // Label position near the toe of the wedge
  const labelPoint = trianglePoints[1];  // Base corner
  
  const offsetX = labelPoint.x < isocenter.x ? -10 : 10;
  const offsetY = labelPoint.y < isocenter.y ? -10 : 10;
  
  ctx.fillStyle = '#FF0000';  // Red
  ctx.font = '9px Arial';
  ctx.textAlign = labelPoint.x < isocenter.x ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(wedge.id, labelPoint.x + offsetX, labelPoint.y + offsetY);
}
```

---

## 8. Block Rendering

### C# Original

```csharp
// From BevImageGenerator.cs
private void DrawBlock(DrawingContext context, EclipseBeamBlock block)
{
    Point[][] outline = block.Outline;
    bool isApertureBlock = block.Type == BlockType.APERTURE;
    var geometry = new PathGeometry();
    
    if (isApertureBlock)
    {
        // Add jaw rectangle as outer boundary for aperture blocks
        var segment = new PolyLineSegment(new List<Point>()
        {
            eclipseBeam.FieldBoundsRect.TopRight,
            eclipseBeam.FieldBoundsRect.BottomRight,
            eclipseBeam.FieldBoundsRect.BottomLeft,
            eclipseBeam.FieldBoundsRect.TopLeft
        }, false);
        var figure = new PathFigure(eclipseBeam.FieldBoundsRect.TopLeft, 
            new List<PathSegment>() { segment }, true);
        geometry.Figures.Add(figure);
    }
    
    // Set fill rule based on block type
    geometry.FillRule = isApertureBlock ? FillRule.EvenOdd : FillRule.Nonzero;
    
    // Add block outline contours
    foreach (var outlinePoints in blockOutlinePoints)
    {
        var points = TranslateToFieldCoordinates(outlinePoints);
        var segment = new PolyLineSegment(points, true);
        var figure = new PathFigure(startPoint, new List<PathSegment>() { segment }, true);
        geometry.Figures.Add(figure);
    }
    
    // Draw the block
    context.DrawGeometry(blockBrush, new Pen(jawBrush, thickness), geometry);
}

private Point TranslateToFieldCoordinates(Point point)
{
    return new Point(isocenter.X + point.X * xResolution, isocenter.Y - point.Y * yResolution);
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/blockRenderer.ts

export interface Block {
  id: string;
  type: 'SHIELDING' | 'APERTURE';
  outline: { x: number; y: number }[][];  // Array of contours
}

/**
 * Draw a block on the BEV
 * - APERTURE blocks show the opening (fill outside)
 * - SHIELDING blocks show blocked area (fill inside)
 */
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  jaws: JawPositions,
  isocenter: { x: number; y: number },
  pixelsPerMm: number
): void {
  const isAperture = block.type === 'APERTURE';
  
  // Block colors from original C#
  const fillColor = 'rgba(133, 93, 36, 0.5)';  // Semi-transparent brown
  const strokeColor = '#FFFF00';  // Yellow
  
  ctx.save();
  
  if (isAperture) {
    // For aperture blocks: fill the area OUTSIDE the block opening
    // Use even-odd fill rule
    
    // First, draw jaw rectangle as outer boundary
    const jawLeft = isocenter.x + jaws.x1 * pixelsPerMm;
    const jawRight = isocenter.x + jaws.x2 * pixelsPerMm;
    const jawTop = isocenter.y - jaws.y2 * pixelsPerMm;
    const jawBottom = isocenter.y - jaws.y1 * pixelsPerMm;
    
    ctx.beginPath();
    ctx.rect(jawLeft, jawTop, jawRight - jawLeft, jawBottom - jawTop);
    
    // Then add block contours (will be "subtracted" with even-odd)
    for (const contour of block.outline) {
      if (contour.length < 3) continue;
      
      const canvasPoints = contour.map(p => ({
        x: isocenter.x + p.x * pixelsPerMm,
        y: isocenter.y - p.y * pixelsPerMm,
      }));
      
      ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
      }
      ctx.closePath();
    }
    
    ctx.fillStyle = fillColor;
    ctx.fill('evenodd');
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    
  } else {
    // For shielding blocks: fill the area INSIDE the block
    for (const contour of block.outline) {
      if (contour.length < 3) continue;
      
      const canvasPoints = contour.map(p => ({
        x: isocenter.x + p.x * pixelsPerMm,
        y: isocenter.y - p.y * pixelsPerMm,
      }));
      
      ctx.beginPath();
      ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
      }
      ctx.closePath();
      
      ctx.fillStyle = fillColor;
      ctx.fill();
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  
  ctx.restore();
}
```

---

## 9. Structure Projection

This is the most mathematically complex part - projecting 3D structures onto the 2D BEV plane.

### C# Original

```csharp
// From BevImageGeneratorData.cs
public List<List<Point>> GetStructurePoints(EclipseStructure structure, bool isMarker = false)
{
    // Get image projector data
    var imageProjectors = GetImageProjectorData(controlPoint, out Vector3D sourceGlobalNoCouchKick,
        out Vector3D isoGlobal, out Vector3D drrXDirection, out Vector3D drrYDirection,
        out Matrix3D globalOrientationMatrix, out Matrix3D inverseCouchRotationMatrix);
    
    // Find intersections of structure mesh with image rays
    bool[,] inStructure = MeshIntersectionFinder.Process(imageProjectors, sourceGlobalNoCouchKick, isoGlobal,
        drrXDirection, drrYDirection,
        drrImageXResolution, drrImageYResolution,
        structure.MeshGeometry, globalOrientationMatrix, inverseCouchRotationMatrix, out intersectDistancesArrays);
    
    // Convert boolean grid to contour
    var autosegmentOutline = new AutoSegment(inStructure);
    var points = autosegmentOutline.DrawOutline(drrImageXResolution, drrImageYResolution);
    return points;
}

private Vector3D[,] GetImageProjectorData(EclipseControlPoint controlPoint, ...)
{
    var couchAngle = controlPoint.PatientSupportAngle;
    var gantryAngle = controlPoint.GantryAngle;
    
    // Transform from DICOM to IEC coordinates
    globalOrientationMatrix = OrientationTransformation.GetTransformationMatrix(treatmentOrientation);
    
    // Calculate gantry rotation
    Vector3D gantryDirection = new Vector3D(0, 1, 0);
    Matrix3D gantryRotationMatrix = Matrix3D.Identity;
    Quaternion gantryRotationQuat = new Quaternion(new Vector3D(0, 0, 1), gantryAngle);
    gantryRotationMatrix.Rotate(gantryRotationQuat);
    gantryDirection = gantryRotationMatrix.Transform(gantryDirection);
    
    // Source position: 1000mm from isocenter along gantry direction
    isoGlobal = globalOrientationMatrix.Transform(isocenterPositionDicom);
    sourceGlobalNoCouchKick = isoGlobal - 1000.0 * gantryDirection;
    
    // DRR plane directions
    drrXDirection = new Vector3D(1, 0, 0);
    drrXDirection = gantryRotationMatrix.Transform(drrXDirection);
    drrYDirection = new Vector3D(0, 0, -1);  // Along gantry rotation axis
    
    // Compute image rays from source through each pixel
    var imageProjectors = new Vector3D[width, height];
    Vector3D isoPlaneStart = isoGlobal;
    isoPlaneStart -= (0.5 + width / 2) * drrImageXResolution * drrXDirection;
    isoPlaneStart -= (0.5 + height / 2) * drrImageYResolution * drrYDirection;
    
    for (int i = 0; i < width; i++)
    {
        for (int j = 0; j < height; j++)
        {
            Vector3D imagePlanePoint = isoPlaneStart + i * drrImageXResolution * drrXDirection 
                                                     + j * drrImageYResolution * drrYDirection;
            imageProjectors[i, j] = imagePlanePoint - sourceGlobalNoCouchKick;
        }
    }
    
    return imageProjectors;
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/structureProjector.ts

import { Vector3 } from '../geometry/Vector3';
import { Matrix4 } from '../geometry/Matrix4';

export interface StructureMesh {
  vertices: { x: number; y: number; z: number }[];
  triangleIndices: number[];  // Groups of 3
}

export interface ProjectionParams {
  sourcePosition: Vector3;
  isocenter: Vector3;
  drrXDirection: Vector3;
  drrYDirection: Vector3;
  pixelResolutionX: number;  // mm per pixel
  pixelResolutionY: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Calculate projection parameters for given beam geometry
 */
export function calculateProjectionParams(
  isocenterDicom: Vector3,
  gantryAngle: number,
  couchAngle: number,
  patientOrientation: string,
  imageWidth: number,
  imageHeight: number,
  pixelResolution: number = 1  // mm/pixel
): ProjectionParams {
  const SAD = 1000;  // Source-axis distance in mm
  
  // Get patient orientation matrix (DICOM to IEC)
  const orientMatrix = getOrientationMatrix(patientOrientation);
  
  // Calculate gantry rotation
  const gantryRad = gantryAngle * Math.PI / 180;
  const gantryDirection = new Vector3(
    Math.sin(gantryRad),
    -Math.cos(gantryRad),
    0
  );
  
  // Transform isocenter to IEC coordinates
  const isoGlobal = isocenterDicom.clone().applyMatrix4(orientMatrix);
  
  // Source position (SAD from isocenter along gantry direction)
  const sourcePosition = isoGlobal.clone().sub(
    gantryDirection.clone().multiplyScalar(SAD)
  );
  
  // DRR plane directions
  const drrXDirection = new Vector3(
    Math.cos(gantryRad),
    Math.sin(gantryRad),
    0
  );
  const drrYDirection = new Vector3(0, 0, -1);
  
  return {
    sourcePosition,
    isocenter: isoGlobal,
    drrXDirection,
    drrYDirection,
    pixelResolutionX: pixelResolution,
    pixelResolutionY: pixelResolution,
    imageWidth,
    imageHeight,
  };
}

/**
 * Project a single 3D point onto the BEV plane
 */
export function projectPointToBev(
  point: Vector3,
  params: ProjectionParams
): { x: number; y: number } | null {
  const { sourcePosition, isocenter, drrXDirection, drrYDirection } = params;
  
  // Ray from source through point
  const rayDirection = point.clone().sub(sourcePosition);
  
  // Find intersection with isocenter plane
  const centralAxis = isocenter.clone().sub(sourcePosition).normalize();
  const sourceToIso = isocenter.clone().sub(sourcePosition);
  
  const denom = rayDirection.dot(centralAxis);
  if (Math.abs(denom) < 1e-10) {
    return null;  // Ray parallel to plane
  }
  
  const t = sourceToIso.dot(centralAxis) / denom;
  
  // Intersection point
  const intersection = sourcePosition.clone().add(
    rayDirection.clone().multiplyScalar(t)
  );
  
  // Project onto DRR plane axes
  const relativePos = intersection.clone().sub(isocenter);
  
  const x = relativePos.dot(drrXDirection);
  const y = relativePos.dot(drrYDirection);
  
  return { x, y };
}

/**
 * Project structure mesh to BEV contours
 * This is a simplified version - the C# uses ray-mesh intersection
 */
export function projectStructureToBev(
  mesh: StructureMesh,
  params: ProjectionParams,
  orientMatrix: Matrix4,
  couchRotationMatrix: Matrix4
): { x: number; y: number }[][] {
  const contours: { x: number; y: number }[][] = [];
  
  // Transform all vertices
  const transformedVertices = mesh.vertices.map(v => {
    const vec = new Vector3(v.x, v.y, v.z);
    vec.applyMatrix4(orientMatrix);
    vec.applyMatrix4(couchRotationMatrix);
    return vec;
  });
  
  // Find silhouette edges (simplified approach)
  const silhouettePoints = findSilhouetteEdges(
    transformedVertices,
    mesh.triangleIndices,
    params.sourcePosition
  );
  
  // Project silhouette points
  const projectedPoints = silhouettePoints
    .map(p => projectPointToBev(p, params))
    .filter((p): p is { x: number; y: number } => p !== null);
  
  if (projectedPoints.length > 2) {
    contours.push(projectedPoints);
  }
  
  return contours;
}

/**
 * Find silhouette edges of mesh as viewed from source
 */
function findSilhouetteEdges(
  vertices: Vector3[],
  triangleIndices: number[],
  sourcePosition: Vector3
): Vector3[] {
  const silhouettePoints: Vector3[] = [];
  const edgeFacing = new Map<string, boolean[]>();
  
  // For each triangle, determine if front or back facing
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const v0 = vertices[triangleIndices[i]];
    const v1 = vertices[triangleIndices[i + 1]];
    const v2 = vertices[triangleIndices[i + 2]];
    
    // Calculate triangle normal
    const edge1 = v1.clone().sub(v0);
    const edge2 = v2.clone().sub(v0);
    const normal = edge1.cross(edge2).normalize();
    
    // Check if front-facing (normal points toward source)
    const toSource = sourcePosition.clone().sub(v0).normalize();
    const facing = normal.dot(toSource) > 0;
    
    // Record edge facing
    const edges = [
      [triangleIndices[i], triangleIndices[i + 1]],
      [triangleIndices[i + 1], triangleIndices[i + 2]],
      [triangleIndices[i + 2], triangleIndices[i]],
    ];
    
    for (const [a, b] of edges) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeFacing.has(key)) {
        edgeFacing.set(key, []);
      }
      edgeFacing.get(key)!.push(facing);
    }
  }
  
  // Silhouette edges have one front-facing and one back-facing triangle
  for (const [key, facings] of edgeFacing) {
    if (facings.length === 2 && facings[0] !== facings[1]) {
      const [a, b] = key.split('-').map(Number);
      silhouettePoints.push(vertices[a], vertices[b]);
    }
  }
  
  return silhouettePoints;
}

/**
 * Draw projected structure contours
 */
export function drawProjectedStructure(
  ctx: CanvasRenderingContext2D,
  contours: { x: number; y: number }[][],
  isocenter: { x: number; y: number },
  pixelsPerMm: number,
  color: string,
  lineWidth: number = 1
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  
  for (const contour of contours) {
    if (contour.length < 2) continue;
    
    ctx.beginPath();
    
    // Convert mm to canvas coordinates
    const startX = isocenter.x + contour[0].x * pixelsPerMm;
    const startY = isocenter.y - contour[0].y * pixelsPerMm;
    ctx.moveTo(startX, startY);
    
    for (let i = 1; i < contour.length; i++) {
      const x = isocenter.x + contour[i].x * pixelsPerMm;
      const y = isocenter.y - contour[i].y * pixelsPerMm;
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.stroke();
  }
}
```

---

## 10. Reference Point Projection

### C# Original

```csharp
// From BevImageGenerator.cs
private void DrawReferencePoints(DrawingContext context)
{
    foreach (var refPoint in referencePointData)
    {
        var refPointData = refPoint.Item1;
        var imagePoint = refPoint.Item2;
        var brush = new SolidColorBrush(refPointData.Color);
        var pen = new Pen(brush, REFERENCE_POINT_LINEWIDTH);
        
        if (refPointData.IsEnabled && !double.IsNaN(imagePoint.X))
        {
            // Draw X marker
            Point start = new Point((imagePoint.X - 0.5 * REFERENCE_POINT_BOX_SIZE) * xResolution,
                (imagePoint.Y - 0.5 * REFERENCE_POINT_BOX_SIZE) * yResolution);
            Point end = new Point(start.X + REFERENCE_POINT_BOX_SIZE * xResolution,
                start.Y + REFERENCE_POINT_BOX_SIZE * yResolution);
            context.DrawLine(pen, currentTransform.Transform(start), currentTransform.Transform(end));
            
            start.Y += REFERENCE_POINT_BOX_SIZE * yResolution;
            end.Y -= REFERENCE_POINT_BOX_SIZE * yResolution;
            context.DrawLine(pen, currentTransform.Transform(start), currentTransform.Transform(end));
        }
    }
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/referencePointRenderer.ts

export interface ReferencePoint {
  id: string;
  name: string;
  location: { x: number; y: number };  // Already projected to BEV, in mm
  color: string;
  enabled: boolean;
}

/**
 * Draw reference point marker (X shape)
 */
export function drawReferencePoint(
  ctx: CanvasRenderingContext2D,
  refPoint: ReferencePoint,
  isocenter: { x: number; y: number },
  pixelsPerMm: number
): void {
  if (!refPoint.enabled) return;
  
  const boxSize = 10;  // pixels
  const lineWidth = 1.5;
  
  // Convert mm to canvas coordinates
  const centerX = isocenter.x + refPoint.location.x * pixelsPerMm;
  const centerY = isocenter.y - refPoint.location.y * pixelsPerMm;
  
  const halfBox = boxSize / 2;
  
  ctx.strokeStyle = refPoint.color;
  ctx.lineWidth = lineWidth;
  
  // Draw X shape
  ctx.beginPath();
  ctx.moveTo(centerX - halfBox, centerY - halfBox);
  ctx.lineTo(centerX + halfBox, centerY + halfBox);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX - halfBox, centerY + halfBox);
  ctx.lineTo(centerX + halfBox, centerY - halfBox);
  ctx.stroke();
}
```

---

## 11. Crosshair and Scale

### C# Original

```csharp
// From BevImageGenerator.cs
private void DrawCrosshair(DrawingContext context)
{
    // Draw crosshair lines through isocenter
    var point1 = currentTransform.Transform(new Point(isocenter.X, -diagonal));
    var point2 = currentTransform.Transform(new Point(isocenter.X, diagonal));
    context.DrawLine(new Pen(crosshairBrush, CrosshairThickness), point1, point2);
    
    point1 = currentTransform.Transform(new Point(-diagonal, isocenter.Y));
    point2 = currentTransform.Transform(new Point(diagonal, isocenter.Y));
    context.DrawLine(new Pen(crosshairBrush, CrosshairThickness), point1, point2);
    
    // Draw isocenter point
    point1 = currentTransform.Transform(new Point(isocenter.X, isocenter.Y));
    context.DrawEllipse(isocenterBrush, new Pen(isocenterBrush, 0),
        point1, CenterPointSize * fitScaleFactor, CenterPointSize * fitScaleFactor);
    
    // Draw tick marks
    DrawTickMarks(context, scaleTickSize);
}

private double DrawTickMarksX(DrawingContext context, double xStepCm)
{
    double step = xStepCm * 10 * xResolution;  // Convert cm to pixels
    int iteration = 0;
    
    for (double x = step; ...; x += step)
    {
        iteration++;
        double tickLength = (iteration == 5) ? MajorTickLength : MinorTickLength;
        
        var lineX = isocenter.X + x;
        var point1 = currentTransform.Transform(new Point(lineX, isocenter.Y - tickLength));
        var point2 = currentTransform.Transform(new Point(lineX, isocenter.Y + tickLength));
        context.DrawLine(new Pen(crosshairBrush, CrosshairThickness), point1, point2);
        
        // Also draw on negative side
        lineX = isocenter.X - x;
        // ... same drawing
    }
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/crosshairRenderer.ts

export interface CrosshairConfig {
  color: string;
  lineWidth: number;
  tickIntervalMm: number;  // Typically 10mm (1cm)
  minorTickLength: number;  // pixels
  majorTickLength: number;  // pixels (every 5th tick)
  showTicks: boolean;
}

const defaultCrosshairConfig: CrosshairConfig = {
  color: '#FFFF00',  // Yellow
  lineWidth: 0.75,
  tickIntervalMm: 10,
  minorTickLength: 5,
  majorTickLength: 10,
  showTicks: true,
};

/**
 * Draw crosshair with tick marks
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  isocenter: { x: number; y: number },
  pixelsPerMm: number,
  canvasWidth: number,
  canvasHeight: number,
  config: Partial<CrosshairConfig> = {}
): void {
  const cfg = { ...defaultCrosshairConfig, ...config };
  
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = cfg.lineWidth;
  
  // Vertical line through isocenter
  ctx.beginPath();
  ctx.moveTo(isocenter.x, 0);
  ctx.lineTo(isocenter.x, canvasHeight);
  ctx.stroke();
  
  // Horizontal line through isocenter
  ctx.beginPath();
  ctx.moveTo(0, isocenter.y);
  ctx.lineTo(canvasWidth, isocenter.y);
  ctx.stroke();
  
  // Center point
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(isocenter.x, isocenter.y, 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Tick marks
  if (cfg.showTicks) {
    const stepPixels = cfg.tickIntervalMm * pixelsPerMm;
    const maxExtent = Math.max(canvasWidth, canvasHeight);
    let iteration = 0;
    
    for (let offset = stepPixels; offset < maxExtent; offset += stepPixels) {
      iteration++;
      const tickLength = (iteration % 5 === 0) ? cfg.majorTickLength : cfg.minorTickLength;
      
      // Right of center
      ctx.beginPath();
      ctx.moveTo(isocenter.x + offset, isocenter.y - tickLength);
      ctx.lineTo(isocenter.x + offset, isocenter.y + tickLength);
      ctx.stroke();
      
      // Left of center
      ctx.beginPath();
      ctx.moveTo(isocenter.x - offset, isocenter.y - tickLength);
      ctx.lineTo(isocenter.x - offset, isocenter.y + tickLength);
      ctx.stroke();
      
      // Below center
      ctx.beginPath();
      ctx.moveTo(isocenter.x - tickLength, isocenter.y + offset);
      ctx.lineTo(isocenter.x + tickLength, isocenter.y + offset);
      ctx.stroke();
      
      // Above center
      ctx.beginPath();
      ctx.moveTo(isocenter.x - tickLength, isocenter.y - offset);
      ctx.lineTo(isocenter.x + tickLength, isocenter.y - offset);
      ctx.stroke();
    }
  }
}

/**
 * Draw scale ruler (top-right corner)
 */
export function drawScaleRuler(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  pixelsPerMm: number,
  zoomLevel: number
): void {
  const color = '#00FF00';  // Green
  const offset = 10;
  const scaleLengthCm = 10;
  const scalePixels = scaleLengthCm * 10 * pixelsPerMm * zoomLevel;
  
  const startX = canvasWidth - offset - scalePixels;
  const y = offset;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.75;
  
  // Horizontal scale line
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(startX + scalePixels, y);
  ctx.stroke();
  
  // Tick marks at each cm
  const cmPixels = 10 * pixelsPerMm * zoomLevel;
  for (let i = 0; i <= scaleLengthCm; i++) {
    const x = startX + i * cmPixels;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
  }
  
  // Label
  ctx.fillStyle = '#FF0000';  // Red
  ctx.font = '10px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`${scaleLengthCm} cm`, startX, y + 15);
}
```

---

## 12. Orientation Labels

### C# Original

```csharp
// From BevImageGenerator.cs
private void DrawOrientationCharacters(DrawingContext context, double couchAngle, double gantryAngle)
{
    var labels = PatientOrientationImageGenerator.GetOrientationLabels(drrImagePatientOrientation, gantryAngle, couchAngle);
    
    foreach (var text in labels)
    {
        label = GetOrientationLabel(text.Item1);
        var transform = new RotateTransform(-text.Item2, bitmapCenter.X, bitmapCenter.Y);
        var centerOfLabelPoint = transform.Transform(
            new Point(fitWidth - labelOffset - label.Width / 2, bitmapCenter.Y - label.Baseline / 2));
        DrawTextWithShadow(context, label, GetLabelPointFromCenter(centerOfLabelPoint, label), ...);
    }
}
```

### TypeScript Equivalent

```typescript
// src/core/rendering/orientationLabels.ts

export type PatientOrientation = 
  | 'HFS' | 'HFP' | 'FFS' | 'FFP' 
  | 'HFDL' | 'HFDR' | 'FFDL' | 'FFDR';

interface OrientationLabel {
  label: string;
  angle: number;  // Degrees from right (0=right, 90=top, 180=left, 270=bottom)
}

/**
 * Get orientation labels based on patient position and gantry angle
 */
export function getOrientationLabels(
  patientOrientation: PatientOrientation,
  gantryAngle: number,
  couchAngle: number
): OrientationLabel[] {
  // Determine base labels based on patient orientation
  const isHeadFirst = patientOrientation.startsWith('HF');
  const isSupine = patientOrientation === 'HFS' || patientOrientation === 'FFS';
  const isProne = patientOrientation === 'HFP' || patientOrientation === 'FFP';
  
  // Base labels at gantry 0 for HFS
  // Right side of BEV: Patient's left (L)
  // Left side of BEV: Patient's right (R)
  // Top of BEV: Head (H) for HF, Feet (F) for FF
  // Bottom of BEV: Feet (F) for HF, Head (H) for FF
  
  let rightLabel = isSupine ? 'L' : 'R';
  let leftLabel = isSupine ? 'R' : 'L';
  let topLabel = isHeadFirst ? 'H' : 'F';
  let bottomLabel = isHeadFirst ? 'F' : 'H';
  
  // Adjust for lateral vs AP view based on gantry angle
  const isLateral = (gantryAngle > 45 && gantryAngle < 135) || (gantryAngle > 225 && gantryAngle < 315);
  if (isLateral) {
    if (isSupine) {
      rightLabel = 'A';
      leftLabel = 'P';
    } else {
      rightLabel = 'P';
      leftLabel = 'A';
    }
    
    // Swap if on other side
    if (gantryAngle > 225 && gantryAngle < 315) {
      [rightLabel, leftLabel] = [leftLabel, rightLabel];
    }
  } else {
    // AP view - may need to swap based on gantry position
    if ((gantryAngle > 90 && gantryAngle < 270)) {
      [rightLabel, leftLabel] = [leftLabel, rightLabel];
    }
  }
  
  return [
    { label: rightLabel, angle: 0 },    // Right side
    { label: topLabel, angle: 90 },     // Top
    { label: leftLabel, angle: 180 },   // Left side
    { label: bottomLabel, angle: 270 }, // Bottom
  ];
}

/**
 * Draw orientation labels around the BEV
 */
export function drawOrientationLabels(
  ctx: CanvasRenderingContext2D,
  labels: OrientationLabel[],
  center: { x: number; y: number },
  radius: number,
  collimatorAngle: number
): void {
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#FF0000';  // Red
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (const label of labels) {
    // Adjust angle for collimator rotation
    const adjustedAngle = (label.angle - collimatorAngle) * Math.PI / 180;
    
    // Position label around circle
    const x = center.x + radius * Math.cos(adjustedAngle);
    const y = center.y - radius * Math.sin(adjustedAngle);  // Y inverted
    
    // Draw text with shadow for visibility
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(label.label, x, y);
    ctx.fillText(label.label, x, y);
  }
}
```

---

## 13. Complete TypeScript Implementation

Here's how all the pieces come together in a complete React component:

```typescript
// src/components/BevViewer/BevViewer.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { processDrrImage, drawDrrOnCanvas } from '@core/rendering/drrProcessor';
import { drawJaws, createJawClipPath, calculateMaxJawOpening } from '@core/rendering/jawRenderer';
import { generateMlcFieldShape, drawMlcShape, MLC_MODELS, calculateMaxMlcOpening } from '@core/rendering/mlcRenderer';
import { drawWedge, drawWedgeLabel, calculateWedgeTriangle } from '@core/rendering/wedgeRenderer';
import { drawBlock } from '@core/rendering/blockRenderer';
import { drawCrosshair, drawScaleRuler } from '@core/rendering/crosshairRenderer';
import { getOrientationLabels, drawOrientationLabels } from '@core/rendering/orientationLabels';
import { drawProjectedStructure } from '@core/rendering/structureProjector';
import { drawReferencePoint } from '@core/rendering/referencePointRenderer';
import './BevViewer.css';

interface BevViewerProps {
  beam: Beam;
  controlPointIndex?: number;
  structures?: Structure[];
  referencePoints?: ReferencePoint[];
  drrImage?: DrrImageParams;
  width?: number;
  height?: number;
}

export const BevViewer: React.FC<BevViewerProps> = ({
  beam,
  controlPointIndex = 0,
  structures = [],
  referencePoints = [],
  drrImage,
  width = 512,
  height = 512,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // Calculate base rendering parameters
  const pixelsPerMm = (Math.min(width, height) * 0.9) / 400;  // Fit 400mm with 10% margin
  const isocenter = { x: width / 2, y: height / 2 };
  
  // Get control point data
  const controlPoint = beam.controlPoints[controlPointIndex];
  const collimatorAngle = controlPoint?.collimatorAngle ?? 0;
  const gantryAngle = controlPoint?.gantryAngle ?? 0;
  const couchAngle = controlPoint?.patientSupportAngle ?? 0;
  
  // Calculate field geometry
  const maxJaws = calculateMaxJawOpening(beam.controlPoints);
  const mlcModel = MLC_MODELS[beam.mlcModel ?? 'Millennium120'];
  
  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Step 1: Clear canvas with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Step 2: Save state and apply zoom/pan
    ctx.save();
    ctx.translate(isocenter.x + panOffset.x, isocenter.y + panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-isocenter.x, -isocenter.y);
    
    // Step 3: Draw DRR background
    if (drrImage) {
      const processedDrr = processDrrImage(drrImage);
      drawDrrOnCanvas(ctx, processedDrr, width, height);
    }
    
    // Step 4: Draw projected structures
    for (const structure of structures) {
      if (structure.visible && structure.projectedContours) {
        drawProjectedStructure(
          ctx,
          structure.projectedContours,
          isocenter,
          pixelsPerMm,
          structure.color,
          1
        );
      }
    }
    
    // Step 5: Draw reference points
    for (const refPoint of referencePoints) {
      drawReferencePoint(ctx, refPoint, isocenter, pixelsPerMm);
    }
    
    // Step 6: Draw scale ruler (before collimator rotation)
    drawScaleRuler(ctx, width, pixelsPerMm, zoomLevel);
    
    // Step 7: Apply collimator rotation for field elements
    ctx.save();
    ctx.translate(isocenter.x, isocenter.y);
    ctx.rotate(-collimatorAngle * Math.PI / 180);
    ctx.translate(-isocenter.x, -isocenter.y);
    
    // Step 8: Draw crosshair
    drawCrosshair(ctx, isocenter, pixelsPerMm, width, height);
    
    // Step 9: Draw jaws (and clip MLC to jaw bounds)
    const jawClip = createJawClipPath(maxJaws, isocenter, pixelsPerMm);
    ctx.save();
    ctx.clip(jawClip);
    
    // Step 10: Draw MLC
    if (controlPoint?.leafPositions && mlcModel) {
      const leafPositions = {
        bankA: controlPoint.leafPositions[0],
        bankB: controlPoint.leafPositions[1],
      };
      
      const mlcSegments = generateMlcFieldShape(
        mlcModel,
        leafPositions,
        maxJaws,
        isocenter,
        pixelsPerMm
      );
      
      drawMlcShape(ctx, mlcSegments);
    }
    
    ctx.restore();  // Remove MLC clipping
    
    // Step 11: Draw jaw outline
    drawJaws(ctx, maxJaws, isocenter, pixelsPerMm, beam.treatmentDeliveryType === 'SETUP');
    
    // Step 12: Draw wedges
    for (const wedge of beam.wedges) {
      drawWedge(ctx, wedge, maxJaws, isocenter, pixelsPerMm);
      const triangle = calculateWedgeTriangle(wedge.direction, maxJaws, isocenter, pixelsPerMm);
      drawWedgeLabel(ctx, wedge, triangle, isocenter);
    }
    
    // Step 13: Draw blocks
    for (const block of beam.blocks) {
      drawBlock(ctx, block, maxJaws, isocenter, pixelsPerMm);
    }
    
    ctx.restore();  // Remove collimator rotation
    
    // Step 14: Draw orientation labels (not rotated with collimator)
    const labels = getOrientationLabels(beam.patientOrientation, gantryAngle, couchAngle);
    const labelRadius = Math.min(width, height) / 2 - 25;
    drawOrientationLabels(ctx, labels, isocenter, labelRadius, collimatorAngle);
    
    ctx.restore();  // Remove zoom/pan
    
    // Step 15: Draw beam info (fixed position)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(beam.beamName, 10, 20);
    ctx.font = '12px Arial';
    ctx.fillText(`Gantry: ${gantryAngle.toFixed(1)}°`, 10, 40);
    ctx.fillText(`Coll: ${collimatorAngle.toFixed(1)}°`, 10, 55);
    ctx.fillText(`Couch: ${couchAngle.toFixed(1)}°`, 10, 70);
    
    ctx.textAlign = 'right';
    ctx.fillText(`${beam.meterset.toFixed(1)} MU`, width - 10, 20);
    
  }, [
    beam, controlPointIndex, structures, referencePoints, drrImage,
    width, height, zoomLevel, panOffset, pixelsPerMm, isocenter,
    controlPoint, collimatorAngle, gantryAngle, couchAngle, maxJaws, mlcModel
  ]);
  
  // Re-render when dependencies change
  useEffect(() => {
    render();
  }, [render]);
  
  // Mouse wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoomLevel(prev => Math.max(0.1, Math.min(10, prev * (1 + delta))));
  }, []);
  
  // Mouse drag pan handler
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }, [panOffset]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  return (
    <div className="bev-viewer">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
      <div className="bev-viewer__controls">
        <button onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}>
          Reset View
        </button>
      </div>
    </div>
  );
};

export default BevViewer;
```

---

## Summary: Key Conversion Patterns

| C#/WPF | TypeScript/Canvas |
|--------|-------------------|
| `DrawingContext` | `CanvasRenderingContext2D` |
| `context.DrawLine(pen, p1, p2)` | `ctx.beginPath(); ctx.moveTo(); ctx.lineTo(); ctx.stroke()` |
| `context.DrawRectangle(brush, pen, rect)` | `ctx.fillRect() / ctx.strokeRect()` |
| `context.DrawGeometry(brush, pen, geometry)` | `Path2D` or manual path drawing |
| `context.DrawEllipse(brush, pen, center, rx, ry)` | `ctx.ellipse() / ctx.arc()` |
| `context.PushTransform(transform)` | `ctx.save(); ctx.translate/rotate/scale()` |
| `context.Pop()` | `ctx.restore()` |
| `context.PushClip(geometry)` | `ctx.clip(path2d)` |
| `WriteableBitmap` | `ImageData` |
| `FormattedText` | `ctx.fillText() / ctx.measureText()` |
| `TransformGroup` | Multiple `ctx.translate/rotate/scale` calls |
| `new Point(x, y)` | `{ x: number, y: number }` |
| `new Rect(point, size)` | `{ x, y, width, height }` |

The fundamental difference is that WPF uses retained-mode graphics (you build a scene graph) while Canvas uses immediate-mode graphics (you draw directly). This means in React/Canvas you need to re-render everything on each frame, but you have complete control over the rendering order and can easily optimize with `requestAnimationFrame`.
