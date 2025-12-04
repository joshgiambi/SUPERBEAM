import React, { useEffect, useMemo, useRef } from 'react';
import { getDicomWorkerManager } from '@/lib/dicom-worker-manager';

type Orientation = 'sagittal' | 'coronal';

interface MPRFloatingProps {
  images: any[];
  orientation: Orientation;
  sliceIndex: number;
  windowWidth: number;
  windowCenter: number;
  crosshairPos: { x: number; y: number };
  rtStructures?: any;
  structureVisibility?: Map<number, boolean>;
  onVoxelClick?: (x: number, y: number, z: number) => void;
  currentZIndex?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const MPRFloating: React.FC<MPRFloatingProps> = ({
  images,
  orientation,
  sliceIndex,
  windowWidth,
  windowCenter,
  crosshairPos,
  rtStructures,
  structureVisibility,
  onVoxelClick,
  currentZIndex,
  zoom = 1,
  panX = 0,
  panY = 0,
  onClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  const spacing = useMemo(() => {
    const first = images?.[0];
    const ps = (first?.pixelSpacing || first?.imageMetadata?.pixelSpacing || '1\\1').toString().split('\\').map(Number);
    const row = Number.isFinite(ps[0]) ? ps[0] : 1;
    const col = Number.isFinite(ps[1]) ? ps[1] : 1;
    let z = parseFloat(first?.imageMetadata?.spacingBetweenSlices || first?.spacingBetweenSlices || 'NaN');
    if (!Number.isFinite(z) && images.length >= 2) {
      try {
        const toNum = (v: any) => Array.isArray(v) ? v.map(Number) : (typeof v === 'string' ? v.split('\\').map(Number) : []);
        const iop = toNum(first?.imageOrientation || first?.imageMetadata?.imageOrientation);
        const p0 = toNum(images[0]?.imagePosition || images[0]?.imageMetadata?.imagePosition);
        const p1 = toNum(images[1]?.imagePosition || images[1]?.imageMetadata?.imagePosition);
        if (iop.length >= 6 && p0.length >= 3 && p1.length >= 3) {
          const r = [iop[0], iop[1], iop[2]];
          const c = [iop[3], iop[4], iop[5]];
          const n = [r[1]*c[2]-r[2]*c[1], r[2]*c[0]-r[0]*c[2], r[0]*c[1]-r[1]*c[0]];
          const nlen = Math.hypot(n[0], n[1], n[2]) || 1; const nn = [n[0]/nlen, n[1]/nlen, n[2]/nlen];
          const dz = Math.abs((p1[0]-p0[0])*nn[0] + (p1[1]-p0[1])*nn[1] + (p1[2]-p0[2])*nn[2]);
          if (Number.isFinite(dz) && dz > 0) z = dz;
        }
      } catch {}
    }
    if (!Number.isFinite(z)) z = parseFloat(first?.sliceThickness || first?.imageMetadata?.sliceThickness || '1') || 1;
    return { row, col, z };
  }, [images]);

  const reconstruct = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(doReconstruct);
  };

  const doReconstruct = async () => {
    const canvas = canvasRef.current; 
    if (!canvas) return;
    if (!images?.length) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const axial = images;
    const width = axial[0]?.columns || axial[0]?.width || 512;
    const height = axial[0]?.rows || axial[0]?.height || 512;
    const depth = axial.length;
    
    const cache = (window as any).__WV_CACHE__ as Map<string, { data: Float32Array; width: number; height: number }>;
    if (!cache) return;

    const getSlice = (idx: number): Float32Array | null => {
      const img = axial[idx];
      return cache.get(img?.sopInstanceUID)?.data || null;
    };

    const ensureSlice = async (idx: number) => {
      const img = axial[idx]; if (!img) return;
      if (cache?.has(img.sopInstanceUID)) return;
      try {
        const resp = await fetch(`/api/images/${img.sopInstanceUID}`);
        if (!resp.ok) return;
        const buf = await resp.arrayBuffer();
        const worker = getDicomWorkerManager();
        const parsed = await worker.parseDicomImage(buf);
        if (parsed?.data && cache) cache.set(img.sopInstanceUID, parsed);
      } catch {}
    };

    const dimX = orientation === 'coronal' ? width : height;
    const dimY = depth;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const buf32 = new Uint32Array(imgData.data.buffer);

    const physW = (orientation === 'coronal' ? spacing.col * dimX : spacing.row * dimX);
    const physH = spacing.z * dimY;
    const aspect = physW / physH;
    
    let baseDrawW, baseDrawH;
    if (aspect < canvas.width / canvas.height) {
      baseDrawH = canvas.height;
      baseDrawW = Math.round(baseDrawH * aspect);
    } else {
      baseDrawW = canvas.width;
      baseDrawH = Math.round(baseDrawW / aspect);
    }

    const drawW = Math.max(1, Math.round(baseDrawW * zoom));
    const drawH = Math.max(1, Math.round(baseDrawH * zoom));
    const offX = Math.round((canvas.width - drawW) / 2) + Math.round(panX);
    const offY = Math.round((canvas.height - drawH) / 2) + Math.round(panY);

    const sx = dimX / drawW;
    const sy = dimY / drawH;

    const wlMin = windowCenter - windowWidth / 2;
    const wlMax = windowCenter + windowWidth / 2;
    const invWindowWidth = 1.0 / (wlMax - wlMin);

    const missing = new Set<number>();

    const yStart = Math.max(0, -offY);
    const yEnd = Math.min(drawH, canvas.height - offY);
    const xStart = Math.max(0, -offX);
    const xEnd = Math.min(drawW, canvas.width - offX);
    
    const uTable = new Int32Array(xEnd - xStart);
    for (let x = xStart; x < xEnd; x++) {
      uTable[x - xStart] = Math.min(dimX - 1, Math.max(0, Math.floor(x * sx)));
    }

    for (let y = yStart; y < yEnd; y++) {
      const z = Math.min(depth - 1, Math.max(0, (depth - 1) - Math.floor(y * sy)));
      const slice = getSlice(z);
      
      if (!slice) { 
        missing.add(z); 
        continue; 
      }

      const rowOffset = (offY + y) * canvas.width + offX;
      let sliceBaseOffset = 0;
      let sliceMultiplier = 0;
      
      if (orientation === 'coronal') {
        // Coronal: X axis = Columns. Fixed Row (sliceIndex).
        sliceBaseOffset = Math.min(height - 1, Math.max(0, sliceIndex)) * width;
        sliceMultiplier = 1; 
      } else {
        // Sagittal: X axis = Rows. Fixed Column (sliceIndex).
        sliceBaseOffset = Math.min(width - 1, Math.max(0, sliceIndex));
        sliceMultiplier = width; 
      }

      for (let i = 0; i < uTable.length; i++) {
        const u = uTable[i];
        const f = slice[sliceBaseOffset + (u * sliceMultiplier)];
        
        let g = 0;
        if (f <= wlMin) g = 0;
        else if (f >= wlMax) g = 255;
        else g = (f - wlMin) * invWindowWidth * 255 | 0;

        buf32[rowOffset + xStart + i] = 0xFF000000 | (g << 16) | (g << 8) | g;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Crosshair
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,255,0.85)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();

    if (orientation === 'sagittal') {
      const cx = offX + Math.round((crosshairPos.y / dimX) * drawW);
      const cy = offY + Math.round(((depth - 1 - sliceIndex) / dimY) * drawH);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
    } else {
      const cx = offX + Math.round((crosshairPos.x / dimX) * drawW);
      const cy = offY + Math.round(((depth - 1 - sliceIndex) / dimY) * drawH);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
    }
    ctx.restore();

    // Contours
    const hasImagePosition = images?.[0]?.imageMetadata?.imagePosition || images?.[0]?.imagePosition;
    
    if (rtStructures?.structures?.length && hasImagePosition) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.clip();

      ctx.lineWidth = 1.0;
      const pos0Str = images[0].imageMetadata?.imagePosition || images[0].imagePosition;
      const pos0 = (typeof pos0Str === 'string' ? pos0Str.split('\\').map(Number) : pos0Str) as number[];
      const iopVal = images[0].imageMetadata?.imageOrientation || images[0].imageOrientation;
      const iop = ((): number[] => {
        if (Array.isArray(iopVal)) return iopVal.map(Number);
        if (typeof iopVal === 'string') return iopVal.split('\\').map(Number);
        return [1,0,0,0,1,0];
      })();
      const rowDir = [iop[0], iop[1], iop[2]]; 
      const colDir = [iop[3], iop[4], iop[5]];
      const dot = (a: number[], b: number[]) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
      const worldToPixel = (wx: number, wy: number, wz: number): { x: number; y: number } => {
        const d = [wx - pos0[0], wy - pos0[1], wz - pos0[2]];
        // .x = Row Index (Y-axis component)
        // .y = Column Index (X-axis component)
        const x = (dot(d, colDir) / spacing.col) - 0.5;
        const y = (dot(d, rowDir) / spacing.row) - 0.5;
        return { x, y };
      };
      const worldZToSliceIndex = (worldZ: number): number => {
        const relZ = worldZ - pos0[2];
        const sliceIdx = Math.round(relZ / spacing.z);
        return Math.min(depth - 1, Math.max(0, sliceIdx));
      };
      
      for (const s of rtStructures.structures) {
        if (!s?.contours?.length) continue;
        const isVisible = structureVisibility?.get(s.id) ?? true;
        if (!isVisible) continue;
        
        const color = s.color || [0, 255, 0];
        ctx.strokeStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        
        const segments: { x: number, zIndex: number }[] = [];
        
        for (const c of s.contours) {
          if (typeof c.slicePosition !== 'number' || !c.points || c.points.length < 6) continue;
          
          const contourSliceIdx = worldZToSliceIndex(c.slicePosition);
          if (contourSliceIdx < 0 || contourSliceIdx >= depth) continue;

          if (orientation === 'coronal') {
            // Plane: Y = sliceIndex (Axial Row)
            // Check p.x (Row) vs sliceIndex
            const yCut = sliceIndex;
            for (let i = 0; i < c.points.length; i += 3) {
              const j = (i + 3) % c.points.length;
              const p1 = worldToPixel(c.points[i], c.points[i + 1], c.slicePosition);
              const p2 = worldToPixel(c.points[j], c.points[j + 1], c.slicePosition);
              
              if ((p1.x - yCut) * (p2.x - yCut) <= 0) {
                const denom = (p2.x - p1.x) || 1e-6;
                const t = (yCut - p1.x) / denom;
                const xIntercept = p1.y + t * (p2.y - p1.y);
                segments.push({ x: xIntercept, zIndex: contourSliceIdx });
              }
            }
          } else { 
            // Plane: X = sliceIndex (Axial Column)
            // Check p.y (Col) vs sliceIndex
            const xCut = sliceIndex;
            for (let i = 0; i < c.points.length; i += 3) {
              const j = (i + 3) % c.points.length;
              const p1 = worldToPixel(c.points[i], c.points[i + 1], c.slicePosition);
              const p2 = worldToPixel(c.points[j], c.points[j + 1], c.slicePosition);
              
              if ((p1.y - xCut) * (p2.y - xCut) <= 0) {
                  const denom = (p2.y - p1.y) || 1e-6;
                  const t = (xCut - p1.y) / denom;
                  const yIntercept = p1.x + t * (p2.x - p1.x);
                  segments.push({ x: yIntercept, zIndex: contourSliceIdx });
              }
            }
          }
        }
        
        const byZ = new Map<number, number[]>();
        segments.forEach(s => {
           if (!byZ.has(s.zIndex)) byZ.set(s.zIndex, []);
           byZ.get(s.zIndex)!.push(s.x);
        });
        
        const sortedZ = Array.from(byZ.keys()).sort((a, b) => a - b); // Draw bottom to top
        
        ctx.beginPath();
        const toScreen = (val: number, zIdx: number) => {
           const sx = (val + 0.5) / (orientation === 'coronal' ? width : height) * drawW;
           const sy = ((depth - 1 - zIdx) + 0.5) / dimY * drawH;
           return { x: offX + sx, y: offY + sy };
        };

        // NEAREST NEIGHBOR INTERPOLATION
        // Connects points across adjacent slices if they are spatially close
        const NN_THRESHOLD = 40; // pixels (approx 2-3cm range)

        for (let i = 0; i < sortedZ.length; i++) {
           const zCurrent = sortedZ[i];
           const ptsCurrent = byZ.get(zCurrent)!;
           
           // Draw intersection points ("rungs") to visualize the slice cut clearly
           // This closes the gaps on the slice itself if vertical connection fails
           // We assume points come in pairs (entry/exit) for convex shapes
           // Sort by X to pair them
           ptsCurrent.sort((a, b) => a - b);
           for (let k = 0; k < ptsCurrent.length; k += 2) {
             if (k+1 >= ptsCurrent.length) break;
             const pStart = toScreen(ptsCurrent[k], zCurrent);
             const pEnd = toScreen(ptsCurrent[k+1], zCurrent);
             ctx.moveTo(pStart.x, pStart.y);
             ctx.lineTo(pEnd.x, pEnd.y);
           }

           // Vertical connections
           if (i + 1 < sortedZ.length) {
              const zNext = sortedZ[i+1];
              if (Math.abs(zCurrent - zNext) > 2.0) continue;
              
              const ptsNext = byZ.get(zNext)!;
              
              // For each point in current, connect to nearest in next
              ptsCurrent.forEach(pC => {
                let bestDist = Infinity;
                let bestP = -1;
                ptsNext.forEach(pN => {
                  const d = Math.abs(pC - pN);
                  if (d < bestDist) { bestDist = d; bestP = pN; }
                });
                if (bestDist < NN_THRESHOLD) {
                  const start = toScreen(pC, zCurrent);
                  const end = toScreen(bestP, zNext);
                  ctx.moveTo(start.x, start.y);
                  ctx.lineTo(end.x, end.y);
                }
              });
              
              // Symmetric check (Next -> Current) to catch splits
              ptsNext.forEach(pN => {
                let bestDist = Infinity;
                let bestP = -1;
                ptsCurrent.forEach(pC => {
                  const d = Math.abs(pN - pC);
                  if (d < bestDist) { bestDist = d; bestP = pC; }
                });
                if (bestDist < NN_THRESHOLD) {
                  const start = toScreen(bestP, zCurrent);
                  const end = toScreen(pN, zNext);
                  ctx.moveTo(start.x, start.y);
                  ctx.lineTo(end.x, end.y);
                }
              });
           }
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    if (missing.size) {
      const tasks = Array.from(missing).slice(0, 24).map(ensureSlice);
      await Promise.all(tasks);
      reconstruct();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (!onVoxelClick || !images.length) return;

    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const axial = images;
    const width = axial[0]?.columns || axial[0]?.width || 512;
    const height = axial[0]?.rows || axial[0]?.height || 512;
    const depth = axial.length;
    const dimX = orientation === 'coronal' ? width : height;
    const dimY = depth;
    
    const physW = (orientation === 'coronal' ? spacing.col * dimX : spacing.row * dimX);
    const physH = spacing.z * dimY;
    const aspect = physW / physH;
    
    let baseDrawW, baseDrawH;
    if (aspect < canvas.width / canvas.height) {
      baseDrawH = canvas.height;
      baseDrawW = Math.round(baseDrawH * aspect);
    } else {
      baseDrawW = canvas.width;
      baseDrawH = Math.round(baseDrawW / aspect);
    }

    const drawW = Math.max(1, Math.round(baseDrawW * zoom));
    const drawH = Math.max(1, Math.round(baseDrawH * zoom));
    const offX = Math.round((canvas.width - drawW) / 2) + Math.round(panX);
    const offY = Math.round((canvas.height - drawH) / 2) + Math.round(panY);

    const u = Math.floor((clickX - offX) / drawW * dimX);
    const v = Math.floor((clickY - offY) / drawH * dimY);

    if (u < 0 || u >= dimX || v < 0 || v >= dimY) return;

    const z = Math.min(depth - 1, Math.max(0, (depth - 1) - v));

    let voxelX, voxelY, voxelZ;
    if (orientation === 'coronal') {
      // Coronal: Screen X = u = Col(X).
      voxelX = u;
      voxelZ = z;
      voxelY = sliceIndex;
    } else {
      // Sagittal: Screen X = u = Row(Y).
      voxelY = u;
      voxelZ = z;
      voxelX = sliceIndex;
    }
    
    onVoxelClick(voxelX, voxelY, voxelZ);
  };

  useEffect(() => { 
    reconstruct(); 
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [images, orientation, sliceIndex, windowWidth, windowCenter, crosshairPos.x, crosshairPos.y, rtStructures, structureVisibility, zoom, panX, panY]);

  return (
    <canvas ref={canvasRef} className="mpr-canvas" width={384} height={384} onClick={handleCanvasClick} />
  );
};
