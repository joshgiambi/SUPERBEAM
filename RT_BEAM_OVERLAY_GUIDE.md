I'll investigate how beam overlay rendering is currently implemented on CT images and then explain how it can be converted to web/React/TypeScript. Let me explore the codebase.

[3 tools called]

Let me dig deeper into the actual implementation files to understand the beam overlay rendering on CT images.

[3 tools called]

Let me read more of the CTImage implementation to understand the complete beam rendering pipeline.

[2 tools called]

Now I have a complete picture of how beam overlay rendering works. Let me provide you with a comprehensive explanation.

---

## How Beam Overlay Rendering Works on CT Images

### Overview

Beam overlay rendering on CT images (sometimes called "CIAO" - CT Image And Overlay) displays radiation beam geometry superimposed on CT slices. This includes:

1. **Beam Lines** - Lines showing the beam central axis direction from isocenter
2. **Arc Visualizations** - Elliptical arcs for VMAT/Arc beams showing gantry rotation path
3. **Isocenter Markers** - Circle markers at beam isocenter locations
4. **Field Labels** - Text labels identifying each beam

### The Current C# Implementation Pipeline

The process happens in three main stages:

#### Stage 1: Compute Beam Geometry Data (`SetBeamDrawingData`)

```592:679:docs/prs/rt-plan-bev-rendering-detailed-pr.md
### Beam Field Line Rendering on CT

The beam field lines show where the radiation field intersects each CT slice:

```csharp
public void SetBeamDrawingData(List<EclipseBeam> beams, int isocenterIndex)
{
    foreach (var beam in beams)
    {
        // For each control point, compute field outline intersection with slice
        foreach (var controlPoint in beam.ControlPoints)
        {
            // Get jaw and MLC positions
            var jawRect = beam.GetBeamJawRect();
            var mlcShape = beam.GetMlcFieldShape(...);
            
            // Project 3D field geometry onto the 2D slice plane
            var fieldOutline = ProjectFieldOntoSlice(
                beam.Isocenter,
                controlPoint.GantryAngle,
                controlPoint.CollimatorAngle,
                jawRect,
                mlcShape,
                sliceCenter,
                sliceOrientation);
            
            // Store for rendering
            fieldOutlines.Add(fieldOutline);
        }
    }
}
```

The projection involves:

1. **Computing beam central axis**: From source (1000mm along gantry direction from isocenter) through isocenter
2. **Computing divergence**: Field boundaries diverge from source at angles determined by jaw/MLC positions
3. **Finding slice intersection**: Where each divergent ray pierces the slice plane
```

For **static beams**, the code computes a direction vector based on gantry and couch angles:

```1177:1206:clearcheck/ClearCheck.esapi/Tools/CTImage.cs
        public void SetStaticBeamData(double initialGantryAngle, EclipseBeam beam, int isocenterIndex)
        {
            var couchAngle = beam.ControlPoints[0].PatientSupportAngle;
            var fieldID = beam.Id;
            var isSetup = beam.IsSetup;
            var planSetupIndex = beam.PlanSetupIndex;

            var isocenter = isocenters[isocenterIndex];
            double x, y, z;
            x = Math.Cos(couchAngle * CONVERT_TO_RADIANS) * Math.Sin(initialGantryAngle * CONVERT_TO_RADIANS);
            y = -Math.Cos(initialGantryAngle * CONVERT_TO_RADIANS);
            z = Math.Sin(couchAngle * CONVERT_TO_RADIANS) * Math.Sin(initialGantryAngle * CONVERT_TO_RADIANS);
            var sourceVec = new Vector3D(x, y, z);

            sourceVec = imageData.GetReversedOrientedLocationV3D(sourceVec);

            if (orientation == SliceOrientationType.Transverse)
            {
                double length = Math.Min(isocenter.Y, bitmap.Height - isocenter.Y);
                length = 0.80 * Math.Min(length, Math.Min(isocenter.X, bitmap.Width - isocenter.X));

                double xCoord = isocenter.X + length * x;
                double yCoord = isocenter.Y + length * y;

                var lineEnd = new System.Drawing.Point((int)xCoord, (int)yCoord);

                double labelAngle = Math.Atan2(lineEnd.Y - isocenter.Y, lineEnd.X - isocenter.X);
                labelAngle *= CONVERT_TO_DEGREES;
                beamLines.Add(new BeamLine(new ImageLine(isocenter, lineEnd), fieldID, 0, labelAngle, isSetup, isocenterIndex, planSetupIndex, beam.ShowFieldLines, beam.ShowSetupFieldLines));
            }
```

For **arc beams**, it creates a parameterized 3D circle based on couch angle, then projects it onto the slice plane:

```1399:1425:clearcheck/ClearCheck.esapi/Tools/CTImage.cs
        public void DrawBeamArc(double initialGantryAngle, double finalGantryAngle, double arcLength, GantryRotationDirection gantryDirection,
                                double couchAngle, string arcID, int isocenterIndex, List<Tuple<double, double>> avoidance, int planSetupIndex, bool showFieldLine)
        {
            var isocenter = isocenters[isocenterIndex];

            // ***** compute parameterized circle in 3D ******************
            // this will be the circle that the gantry takes relative to the patient

            // first find normal of circle which is on axis of couch, start with (0,0,1) and rotate around y by couch angle
            // circleNormal = new Vector3D(-Math.Sin(couchAngle * CONVERT_TO_RADIANS), 0, Math.Cos(couchAngle * CONVERT_TO_RADIANS));
            // now we need v1,v2 perpendicular to each other and the circleNormal
            // in global coordinates v1 = (0,-1,0) and v2= (1,0,0)
            // in patient coordinates v1 = (0,-1,0) and v2 = (cos(couchAngle), 0, sin(couchAngle))


            Vector3D v1, v2;
            v1 = new Vector3D(0, -1, 0);
            v2 = new Vector3D(Math.Cos(couchAngle * CONVERT_TO_RADIANS), 0, Math.Sin(couchAngle * CONVERT_TO_RADIANS));

            // the circle is now parameterized by r*cos(theta)v1 + r*sin(theta)v2
            // x = r*cos(theta)*v1.X + r*sin(theta)*v2.X;
            // y = r*cos(theta)*v1.Y + r*sin(theta)*v2.Y;
            // z = r*cos(theta)*v1.Z + r*sin(theta)*v2.Z;

            ParameterizedCircle circle = new ParameterizedCircle(v1, v2);

            double sweep = GetSweep(initialGantryAngle, finalGantryAngle, gantryDirection);
```

#### Stage 2: Render to Bitmap

The actual rendering happens in a Graphics context using `System.Drawing`:

```909:978:clearcheck/ClearCheck.esapi/Tools/CTImage.cs
            // draw setup beams
            pen = new System.Drawing.Pen(BEAM_LINE_COLOR, BEAM_LINE_WIDTH * width);
            if (showSetupFields)
            {
                var radformationBluePen = new System.Drawing.Pen(RADFORMATION_BLUE, BEAM_LINE_WIDTH * width);

                if (LineWidthMultiplier == 3) // 3x transverse images
                    font = new Font("SegoeUI", (int)(BEAM_LABEL_FONT_SIZE * width * 1.5));
                else if (LineWidthMultiplier == 2) // 2x transverse images
                    font = new Font("SegoeUI", (int)(BEAM_LABEL_FONT_SIZE * width * 1.25));
                else // all others
                    font = new Font("SegoeUI", (int)(BEAM_LABEL_FONT_SIZE * width));

                foreach (BeamLine line in beamLines)
                {
                    if (line.IsSetup)
                    {
                        var stringSize = g.MeasureString(line.Label, font);
                        System.Drawing.Point labelPoint = new System.Drawing.Point(line.Line.Stop.X, line.Line.Stop.Y);
                        g.DrawLine(radformationBluePen, line.Line.Start, line.Line.Stop);
                        var labelBrush = new System.Drawing.SolidBrush(RadformationColorList.GetDrawingColorAtIndex(line.PlanSetupIndex));
                        g.TranslateTransform(labelPoint.X, labelPoint.Y);
                        g.RotateTransform((float)line.LabelRotation + 90);
                        g.TranslateTransform(-stringSize.Width / 2, -stringSize.Height);
                        g.TranslateTransform(-labelPoint.X, -labelPoint.Y);
                        DrawTextWithShadow(g, line.Label, font, labelBrush, labelPoint);
                        g.TranslateTransform(stringSize.Width / 2, stringSize.Height);
                        g.TranslateTransform(labelPoint.X, labelPoint.Y);
                        g.RotateTransform(-(float)line.LabelRotation - 90);
                        g.TranslateTransform(-labelPoint.X, -labelPoint.Y);
                    }
                }
            }

            // draw beams
            if (showFields)
            {                   
                if (LineWidthMultiplier == 3) // 3x transverse images
                    font = new Font("SegoeUI", (int)(BEAM_LABEL_FONT_SIZE * width * 1.5));
                else if (LineWidthMultiplier == 2) // 2x transverse images
                    font = new Font("SegoeUI", (int)(BEAM_LABEL_FONT_SIZE * width * 1.25));
                else // all others
                    font = new Font("SegoeUI", (int)(BEAM_LABEL_FONT_SIZE * width));
    
                foreach (BeamLine line in beamLines)
                {
                    if (!line.IsSetup)
                    {
                        var stringSize = g.MeasureString(line.Label, font);
                        System.Drawing.Point labelPoint = new System.Drawing.Point(line.Line.Stop.X, line.Line.Stop.Y);
                        g.DrawLine(pen, line.Line.Start, line.Line.Stop);
                        var labelBrush = new System.Drawing.SolidBrush(RadformationColorList.GetDrawingColorAtIndex(line.PlanSetupIndex));
                        g.TranslateTransform(labelPoint.X, labelPoint.Y);
                        g.RotateTransform((float)line.LabelRotation + 90);
                        g.TranslateTransform(-stringSize.Width / 2, -stringSize.Height);
                        g.TranslateTransform(-labelPoint.X, -labelPoint.Y);
                        DrawTextWithShadow(g, line.Label, font, labelBrush, labelPoint);
                        g.TranslateTransform(stringSize.Width / 2, stringSize.Height);
                        g.TranslateTransform(labelPoint.X, labelPoint.Y);
                        g.RotateTransform(-(float)line.LabelRotation - 90);
                        g.TranslateTransform(-labelPoint.X, -labelPoint.Y);
                    }
                }

                // draw arcs
                var avoidPen = new System.Drawing.Pen(AVOIDANCE_COLOR, BEAM_LINE_WIDTH * width);
```

---

## Converting to Web/React/TypeScript

The conversion guide already provides a complete TypeScript implementation. Here's the architecture:

### Key Data Types

```typescript
// Types for beam overlay data
interface BeamLine {
  start: Point2D;      // Isocenter position in canvas coords
  end: Point2D;        // End of beam line
  label: string;       // Beam ID
  labelRotation: number;
  isSetup: boolean;
  color: string;
}

interface BeamArc {
  isocenter: Point2D;
  majorAxis: number;   // Ellipse dimensions
  minorAxis: number;
  startAngle: number;
  sweepAngle: number;
  label: string;
  rotationDirection: 'CW' | 'CCW';
  avoidanceSectors: Array<{ start: number; end: number }>;
}

interface FieldProjection {
  outline: Point2D[];  // Polygon points
  isSetup: boolean;
  color: string;
}
```

### The React/Canvas Approach

```3937:3995:docs/prs/rt-plan-bev-react-conversion-guide.md
  /**
   * Main render function
   */
  render(data: CtSliceImageData): void {
    // Clear canvas
    this.clear('#000000');
    
    this.save();
    
    // Apply zoom and pan
    this.translate(this.center.x + this.config.panOffset.x,
                   this.center.y + this.config.panOffset.y);
    this.scale(this.config.zoomLevel, this.config.zoomLevel);
    this.translate(-this.center.x, -this.center.y);
    
    // 1. Draw CT background
    this.drawCtImage(data.ctPixelData);
    
    // 2. Draw isodoses (behind structures if using colorwash)
    if (this.config.showIsodoses && data.isodoseContours.length > 0) {
      if (this.config.isodoseDisplayMode === 'colorwash' ||
          this.config.isodoseDisplayMode === 'both') {
        this.drawIsodoseColorwash(data.isodoseContours);
      }
    }
    
    // 3. Draw structures
    if (this.config.showStructures) {
      this.drawStructures(data.structureContours);
    }
    
    // 4. Draw isodose lines (on top of structures)
    if (this.config.showIsodoses && data.isodoseContours.length > 0) {
      if (this.config.isodoseDisplayMode === 'lines' ||
          this.config.isodoseDisplayMode === 'both') {
        this.drawIsodoseLines(data.isodoseContours);
      }
    }
    
    // 5. Draw field lines
    if (this.config.showFieldLines || this.config.showSetupFieldLines) {
      this.drawFieldProjections(data.fieldProjections);
    }
    
    // 6. Draw isocenter markers
    if (this.config.showIsocenter) {
      this.drawIsocenters(data.isocenterPositions);
    }
    
    // 7. Draw reference points
    if (this.config.showReferencePoints) {
      this.drawReferencePoints(data.referencePoints);
    }
    
    this.restore();
    
    // Draw fixed overlays (window/level info, etc.)
    this.drawOverlayInfo();
  }
```

### TypeScript Implementation of Beam Line Calculation

Here's how you would convert the `SetStaticBeamData` method:

```typescript
// core/rendering/BeamProjector.ts

interface BeamLineData {
  start: Point2D;
  end: Point2D;
  label: string;
  labelRotation: number;
  isSetup: boolean;
  planSetupIndex: number;
}

export function computeStaticBeamLine(
  beam: Beam,
  isocenter: Point2D,
  sliceOrientation: 'transverse' | 'coronal' | 'sagittal',
  canvasSize: { width: number; height: number },
  imageData: ImageData3D
): BeamLineData | null {
  const CONVERT_TO_RADIANS = Math.PI / 180;
  const CONVERT_TO_DEGREES = 180 / Math.PI;
  
  const gantryAngle = beam.controlPoints[0].gantryAngle;
  const couchAngle = beam.controlPoints[0].patientSupportAngle;
  
  // Compute source direction vector (where the beam comes FROM)
  const x = Math.cos(couchAngle * CONVERT_TO_RADIANS) * Math.sin(gantryAngle * CONVERT_TO_RADIANS);
  const y = -Math.cos(gantryAngle * CONVERT_TO_RADIANS);
  const z = Math.sin(couchAngle * CONVERT_TO_RADIANS) * Math.sin(gantryAngle * CONVERT_TO_RADIANS);
  
  // Apply patient orientation transformation
  const sourceVec = imageData.getReversedOrientedLocation({ x, y, z });
  
  if (sliceOrientation === 'transverse') {
    // For transverse view, project onto XY plane
    let length = Math.min(isocenter.y, canvasSize.height - isocenter.y);
    length = 0.80 * Math.min(length, Math.min(isocenter.x, canvasSize.width - isocenter.x));
    
    const lineEnd: Point2D = {
      x: isocenter.x + length * sourceVec.x,
      y: isocenter.y + length * sourceVec.y
    };
    
    const labelAngle = Math.atan2(lineEnd.y - isocenter.y, lineEnd.x - isocenter.x) * CONVERT_TO_DEGREES;
    
    return {
      start: isocenter,
      end: lineEnd,
      label: beam.id,
      labelRotation: labelAngle,
      isSetup: beam.isSetup,
      planSetupIndex: beam.planSetupIndex
    };
  }
  
  // Similar logic for coronal and sagittal...
  return null;
}
```

### TypeScript Implementation of Arc Beam Projection

```typescript
// core/rendering/ArcProjector.ts

interface ParameterizedCircle {
  v1: Vector3D;
  v2: Vector3D;
}

function getPointOnCircle(circle: ParameterizedCircle, theta: number): Vector3D {
  return {
    x: Math.cos(theta) * circle.v1.x + Math.sin(theta) * circle.v2.x,
    y: Math.cos(theta) * circle.v1.y + Math.sin(theta) * circle.v2.y,
    z: Math.cos(theta) * circle.v1.z + Math.sin(theta) * circle.v2.z
  };
}

export function computeArcBeam(
  beam: Beam,
  isocenter: Point2D,
  sliceOrientation: 'transverse' | 'coronal' | 'sagittal',
  canvasSize: { width: number; height: number }
): BeamArcData | BeamLineData {
  const CONVERT_TO_RADIANS = Math.PI / 180;
  
  const initialGantry = beam.controlPoints[0].gantryAngle;
  const finalGantry = beam.controlPoints[beam.controlPoints.length - 1].gantryAngle;
  const couchAngle = beam.controlPoints[0].patientSupportAngle;
  
  // Parameterize the gantry rotation circle in 3D patient coordinates
  const v1: Vector3D = { x: 0, y: -1, z: 0 };
  const v2: Vector3D = {
    x: Math.cos(couchAngle * CONVERT_TO_RADIANS),
    y: 0,
    z: Math.sin(couchAngle * CONVERT_TO_RADIANS)
  };
  
  const circle: ParameterizedCircle = { v1, v2 };
  const sweep = computeSweepAngle(initialGantry, finalGantry, beam.gantryDirection);
  
  if (sliceOrientation === 'transverse') {
    // Compute ellipse parameters for transverse view
    let length = Math.min(isocenter.y, canvasSize.height - isocenter.y);
    length = 0.6 * Math.min(length, Math.min(isocenter.x, canvasSize.width - isocenter.x));
    
    const majorAxis = getPointOnCircle(circle, 0);
    const majorAxisLength = length * Math.sqrt(majorAxis.x ** 2 + majorAxis.y ** 2);
    
    const minorAxis = getPointOnCircle(circle, Math.PI / 2);
    const minorAxisLength = length * Math.sqrt(minorAxis.x ** 2 + minorAxis.y ** 2) 
                          * Math.abs(Math.cos(couchAngle * CONVERT_TO_RADIANS));
    
    const startPoint = getPointOnCircle(circle, initialGantry * CONVERT_TO_RADIANS);
    const imageStartAngle = Math.atan2(startPoint.y, startPoint.x) * (180 / Math.PI);
    
    return {
      isocenter,
      majorAxis: 2 * majorAxisLength,
      minorAxis: 2 * minorAxisLength,
      startAngle: imageStartAngle,
      sweepAngle: sweep,
      label: beam.id,
      rotationDirection: beam.gantryDirection,
      avoidanceSectors: beam.avoidanceSectors
    };
  }
  
  // For coronal/sagittal, arcs appear as lines
  // ... implementation similar to C# code
}
```

### Canvas Drawing Methods

```typescript
// core/rendering/CtRenderer.ts - Field projection drawing

private drawFieldProjections(projections: FieldProjection[]): void {
  for (const proj of projections) {
    if (proj.isSetup && !this.config.showSetupFieldLines) continue;
    if (!proj.isSetup && !this.config.showFieldLines) continue;
    
    const canvasPoints = proj.outline.map(p => this.dicomToCanvas(p));
    const dash = proj.isSetup ? [5, 5] : undefined;
    
    this.drawPolyline(canvasPoints, proj.color, 2, true, dash);
  }
}

private drawBeamLines(beamLines: BeamLineData[]): void {
  const ctx = this.ctx;
  
  for (const line of beamLines) {
    // Draw the beam line
    ctx.beginPath();
    ctx.moveTo(line.start.x, line.start.y);
    ctx.lineTo(line.end.x, line.end.y);
    ctx.strokeStyle = line.isSetup ? '#0066CC' : '#FFFF00'; // Blue for setup, yellow for treatment
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw rotated label at line end
    ctx.save();
    ctx.translate(line.end.x, line.end.y);
    ctx.rotate((line.labelRotation + 90) * Math.PI / 180);
    
    ctx.font = '12px SegoeUI, Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(line.label, 0, -10);
    
    ctx.restore();
  }
}

private drawBeamArcs(arcs: BeamArcData[]): void {
  const ctx = this.ctx;
  
  for (const arc of arcs) {
    // Draw elliptical arc using canvas ellipse() method
    ctx.beginPath();
    ctx.ellipse(
      arc.isocenter.x,
      arc.isocenter.y,
      arc.majorAxis / 2,
      arc.minorAxis / 2,
      0,  // rotation
      arc.startAngle * Math.PI / 180,
      (arc.startAngle + arc.sweepAngle) * Math.PI / 180,
      arc.rotationDirection === 'CCW'
    );
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw direction arrows
    this.drawArcArrows(arc);
    
    // Draw avoidance sectors in different color
    for (const avoid of arc.avoidanceSectors) {
      ctx.beginPath();
      ctx.ellipse(
        arc.isocenter.x,
        arc.isocenter.y,
        arc.majorAxis / 2,
        arc.minorAxis / 2,
        0,
        avoid.start * Math.PI / 180,
        avoid.end * Math.PI / 180
      );
      ctx.strokeStyle = '#FF0000';  // Red for avoidance
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}
```

### Key Differences Between C# and TypeScript Implementation

| Aspect | C# (WPF/System.Drawing) | TypeScript (Canvas) |
|--------|------------------------|---------------------|
| Graphics Context | `Graphics g` / `DrawingContext` | `CanvasRenderingContext2D` |
| Transform Stack | `g.TranslateTransform()`, `g.RotateTransform()` | `ctx.save()`, `ctx.translate()`, `ctx.rotate()`, `ctx.restore()` |
| Arc Drawing | `g.DrawPie()`, `g.DrawArc()` | `ctx.ellipse()` with angle params |
| Line Drawing | `g.DrawLine(pen, start, stop)` | `ctx.beginPath()`, `ctx.moveTo()`, `ctx.lineTo()`, `ctx.stroke()` |
| Text Rendering | `g.DrawString()` | `ctx.fillText()` |
| Coordinate Y-axis | Inverted (Y down) | Inverted (Y down) - same! |

The conversion guide in your docs folder (`rt-plan-bev-react-conversion-guide.md`) has the complete 5000+ line implementation ready to use. Would you like me to focus on any specific part of this implementation in more detail?