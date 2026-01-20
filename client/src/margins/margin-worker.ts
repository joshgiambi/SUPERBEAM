// Margin worker: runs DT-based margins off the main thread
console.log('🔶 MARGIN WORKER: Module loading...');

import { contoursToStructure, structureToContours } from './adapters';
import { marginSymmetric, marginAsymmetric } from './margin';

console.log('🔶 MARGIN WORKER: Imports completed');

type Kind = 'UNIFORM' | 'DIRECTIONAL' | 'ANISOTROPIC';

interface JobPayload {
  jobId: string;
  kind: Kind;
  contours: Array<{ points: number[]; slicePosition: number }>;
  spacing: [number, number, number];
  padding: number;
  // For uniform
  margin?: number;
  // For directional
  perSide?: { post: number; ant: number; left: number; right: number; sup: number; inf: number };
}

self.onmessage = (e: MessageEvent<JobPayload>) => {
  console.log('🔶 MARGIN WORKER: Message received');
  (async () => {
    const data = e.data;
    console.log('🔶 MARGIN WORKER: Processing:', {
      jobId: data.jobId,
      kind: data.kind,
      margin: data.margin,
      contourCount: data.contours?.length,
      spacing: data.spacing,
      padding: data.padding,
      firstContourPoints: data.contours?.[0]?.points?.length,
      firstSlicePosition: data.contours?.[0]?.slicePosition,
      samplePoints: data.contours?.[0]?.points?.slice(0, 9) // First 3 points
    });
    try {
      const structure = contoursToStructure(data.contours, data.spacing, data.padding);
      console.log('🔶 MARGIN WORKER: Structure created:', {
        gridSize: `${structure.grid.xSize}x${structure.grid.ySize}x${structure.grid.zSize}`,
        maskSize: structure.mask.values.length,
        nonZeroVoxels: Array.from(structure.mask.values).filter(v => v > 0).length
      });
      let out;
      switch (data.kind) {
        case 'UNIFORM':
          console.log('🔶 MARGIN WORKER: marginSymmetric margin:', data.margin);
          out = marginSymmetric(structure, data.margin || 0, true);
          console.log('🔶 MARGIN WORKER: marginSymmetric result:', {
            gridSize: `${out.grid.xSize}x${out.grid.ySize}x${out.grid.zSize}`,
            maskSize: out.mask.values.length,
            nonZeroVoxels: Array.from(out.mask.values).filter(v => v > 0).length
          });
          break;
        case 'DIRECTIONAL':
          out = marginAsymmetric(structure, true, data.perSide || { post: 0, ant: 0, left: 0, right: 0, sup: 0, inf: 0 }, true);
          break;
        case 'ANISOTROPIC':
          // Map anisotropic x/y/z to equal per-side values
          const m = data.perSide || { post: 0, ant: 0, left: 0, right: 0, sup: 0, inf: 0 };
          out = marginAsymmetric(structure, true, m, true);
          break;
      }
      // Get unique input slice positions
      const inputSlicePositions = Array.from(new Set(data.contours.map(c => c.slicePosition))).sort((a, b) => a - b);
      console.log('🔶 MARGIN WORKER: Input slices:', {
        count: inputSlicePositions.length,
        min: inputSlicePositions[0],
        max: inputSlicePositions[inputSlicePositions.length - 1],
        spacing: inputSlicePositions.length > 1 ? inputSlicePositions[1] - inputSlicePositions[0] : 0
      });
      
      // Count voxels per z-slice in output to diagnose gaps
      const voxelsPerSlice: number[] = [];
      const xy = out.grid.xSize * out.grid.ySize;
      for (let zi = 0; zi < out.grid.zSize; zi++) {
        let count = 0;
        for (let i = zi * xy; i < (zi + 1) * xy; i++) {
          if (out.mask.values[i]) count++;
        }
        voxelsPerSlice.push(count);
      }
      const nonEmptySlices = voxelsPerSlice.filter(c => c > 0).length;
      const emptySlices = voxelsPerSlice.filter(c => c === 0).length;
      console.log('🔶 MARGIN WORKER: Output mask:', {
        totalSlices: out.grid.zSize,
        nonEmptySlices,
        emptySlices,
        voxelsPerSlice: voxelsPerSlice.slice(0, 20).map((v, i) => `z${i}:${v}`).join(', ') + (voxelsPerSlice.length > 20 ? '...' : '')
      });
      
      const resultContours = structureToContours(out.mask, data.contours.map(c => c.slicePosition), undefined, true);
      
      // Analyze output contours
      const outputSlicePositions = Array.from(new Set(resultContours.map(c => c.slicePosition))).sort((a, b) => a - b);
      console.log('🔶 MARGIN WORKER: Output contours:', {
        contourCount: resultContours?.length,
        uniqueSlices: outputSlicePositions.length,
        sliceRange: outputSlicePositions.length > 0 ? `${outputSlicePositions[0]} to ${outputSlicePositions[outputSlicePositions.length - 1]}` : 'none',
        firstContourPoints: resultContours?.[0]?.points?.length
      });
      
      // ===== CRITICAL: Compare input vs output slice counts =====
      const missingFromOutput = inputSlicePositions.filter(z => 
        !outputSlicePositions.some(oz => Math.abs(oz - z) < 0.5)
      );
      const newInOutput = outputSlicePositions.filter(z =>
        !inputSlicePositions.some(iz => Math.abs(iz - z) < 0.5)
      );
      
      console.log('🔶 MARGIN WORKER: Slice comparison:', {
        inputSliceCount: inputSlicePositions.length,
        outputSliceCount: outputSlicePositions.length,
        delta: outputSlicePositions.length - inputSlicePositions.length,
        missingFromOutput: missingFromOutput.length > 0 ? missingFromOutput.map(z => z.toFixed(2)) : 'none',
        newSlicesInOutput: newInOutput.length > 0 ? newInOutput.map(z => z.toFixed(2)) : 'none'
      });
      
      if (missingFromOutput.length > 0) {
        console.warn('🔶 MARGIN WORKER WARNING: Missing slices:', missingFromOutput);
      }
      
      console.log('🔶 MARGIN WORKER: Posting result back');
      // @ts-ignore
      self.postMessage({ jobId: data.jobId, ok: true, contours: resultContours });
    } catch (err) {
      console.error('🔶 MARGIN WORKER ERROR:', err);
      // @ts-ignore
      self.postMessage({ jobId: data.jobId, ok: false, error: String(err) });
    }
  })();
};

export {};
