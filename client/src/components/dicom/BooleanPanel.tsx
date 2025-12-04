import React, { useRef, useState } from 'react';
import type { VIPStructure, MaskStructure, BooleanOp } from '@/boolean/types';
import type { Grid } from '@/margins/types';
import { contoursToVIP } from '@/boolean/integrate';
import { vipToRectContours } from '@/boolean/simpleContours';
import { vipsToMask, maskToVips } from '@/boolean/convert';
import { Button } from '@/components/ui/button';

type Backend = 'vip' | 'mask';

interface BooleanPanelProps {
  structures: any[];
  grid: Grid;
  backend?: Backend;
  onApply: (target: { name: string; color?: [number, number, number] }, contours: { slicePosition: number; points: number[]; numberOfPoints: number }[]) => void;
}

export function BooleanPanel({ structures, grid, backend = 'vip', onApply }: BooleanPanelProps) {
  const workerRef = useRef<Worker | null>(null);
  const [op, setOp] = useState<BooleanOp>('union');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aName, setAName] = useState<string>('');
  const [bName, setBName] = useState<string>('');
  const [outMode, setOutMode] = useState<'existing' | 'new'>('existing');
  const [outName, setOutName] = useState<string>('');
  const [outExistingName, setOutExistingName] = useState<string>('');
  const [outColor, setOutColor] = useState<string>('#3B82F6');

  const ensureWorker = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('@/boolean/worker.ts', import.meta.url), { type: 'module' });
    }
    return workerRef.current;
  };

  const run = () => {
    setBusy(true);
    setErr(null);
    const aStruct = structures.find((s: any) => s.structureName === aName);
    const bStruct = structures.find((s: any) => s.structureName === bName);
    if (!aStruct || !bStruct) {
      setBusy(false);
      setErr('Select A and B structures');
      return;
    }
    const aVip: VIPStructure = contoursToVIP(aStruct, grid);
    const bVip: VIPStructure = contoursToVIP(bStruct, grid);
    const w = ensureWorker();
    const jobId = `${Date.now()}`;
    w.onmessage = (evt: MessageEvent<any>) => {
      const msg = evt.data;
      if (!msg || msg.jobId !== jobId) return;
      setBusy(false);
      if (!msg.ok) {
        setErr(msg.error || 'Unknown error');
        return;
      }
      let vip: VIPStructure;
      if (msg.backend === 'vip') {
        vip = msg.result as VIPStructure;
      } else {
        const m = msg.result as MaskStructure;
        const vips = maskToVips(m.mask, m.grid);
        vip = { grid: m.grid, vips };
      }
      const rects = vipToRectContours(vip).map(c => ({ ...c, numberOfPoints: c.points.length / 3 }));
      if (outMode === 'existing') {
        if (!outExistingName) {
          setErr('Select output structure');
          return;
        }
        onApply({ name: outExistingName }, rects);
      } else {
        const hex = outColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 59;
        const g = parseInt(hex.substring(2, 4), 16) || 130;
        const b = parseInt(hex.substring(4, 6), 16) || 246;
        onApply({ name: outName || 'Combined', color: [r, g, b] }, rects);
      }
    };
    if (backend === 'vip') {
      w.postMessage({ jobId, op, backend, a: aVip, b: bVip });
    } else {
      const aMask: MaskStructure = { grid: aVip.grid, mask: vipsToMask(aVip.vips, aVip.grid) };
      const bMask: MaskStructure = { grid: bVip.grid, mask: vipsToMask(bVip.vips, bVip.grid) };
      w.postMessage({ jobId, op, backend, a: aMask, b: bMask });
    }
  };

  const names = structures?.map((s: any) => s.structureName) || [];

  return (
    <div className="p-4 bg-gray-950/90 rounded-xl border border-gray-600/60 shadow-2xl shadow-black/50 backdrop-blur-xl text-gray-100 space-y-3 w-[420px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div 
            className="w-4 h-4 rounded border-2 border-blue-400/60 shadow-sm"
            style={{ backgroundColor: 'rgb(59, 130, 246)' }}
          />
          <div className="text-sm font-semibold text-gray-100">Boolean Panel (VIP)</div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-300 w-10">A</label>
        <select className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={aName} onChange={e => setAName(e.target.value)}>
          <option value="">Select…</option>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-300 w-10">B</label>
        <select className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={bName} onChange={e => setBName(e.target.value)}>
          <option value="">Select…</option>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-300 w-10">Op</label>
        <select className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={op} onChange={e => setOp(e.target.value as BooleanOp)}>
          <option value="union">Union (A ∪ B)</option>
          <option value="intersect">Intersect (A ∩ B)</option>
          <option value="subtract">Subtract (A − B)</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-300 w-10">Out</label>
        <select className="w-28 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={outMode} onChange={e => setOutMode(e.target.value as 'existing' | 'new')}>
          <option value="existing">Existing</option>
          <option value="new">New</option>
        </select>
        {outMode === 'existing' ? (
          <select className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={outExistingName} onChange={e => setOutExistingName(e.target.value)}>
            <option value="">Select output…</option>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <input className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60 placeholder:text-gray-500" value={outName} onChange={e => setOutName(e.target.value)} placeholder="New structure name" />
            <input type="color" value={outColor} onChange={e => setOutColor(e.target.value)} className="h-7 w-10 rounded border border-gray-600/50" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-300 w-10">Backend</label>
        <select className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60 opacity-50" value={backend} onChange={() => {}} disabled>
          <option value="vip">VIP</option>
          <option value="mask">Mask</option>
        </select>
      </div>
      {err && <div className="text-xs text-red-300 bg-red-950/30 border border-red-500/40 rounded px-2 py-1">{err}</div>}
      <div className="flex justify-end pt-2">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={run} 
          disabled={busy || !aName || !bName} 
          className="h-7 px-3 bg-green-600/20 border-2 border-green-500/50 text-green-300 hover:text-green-200 hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm shadow-sm transition-all"
        >
          {busy ? 'Running…' : 'Run'}
        </Button>
      </div>
    </div>
  );
}


