import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Brush,
  Pen,
  Scissors,
  X,
  Undo,
  Redo,
  Trash2,
  Grid3x3,
  Sparkles,
  Info,
  MousePointer2,
  Merge,
  Expand,
  Check,
  Play,
  ChevronDown,
  Plus,
  ArrowRight,
  Layers,
  GitBranch,
  SplitSquareHorizontal,
  Eraser,
  Zap,
  RotateCcw,
  Settings,
  ChevronUp,
  Minus
} from 'lucide-react';

// --- MOCK DATA & UTILS ---
const mockStructure = {
  name: 'GTV_Primary',
  color: [34, 197, 94], // Green
  roiNumber: 1
};

const availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R'];

const rgbToHex = (rgb: number[]) => '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};

// --- BOOLEAN MULTI-STEP COMPONENT ---
function BooleanMultiStepPanel({ onClose }: { onClose: () => void }) {
  const [steps, setSteps] = useState([
    { id: 1, a: 'GTV', op: 'union', b: 'CTV', res: 'Union_1' },
    { id: 2, a: 'Union_1', op: 'subtract', b: 'SpinalCord', res: 'PTV_Final' }
  ]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-black/90 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
           <Merge className="w-3.5 h-3.5 text-cyan-400" />
           <span className="text-xs font-semibold text-gray-200">Boolean Pipeline</span>
        </div>
        <div className="flex items-center gap-2">
           <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px] text-cyan-400 hover:bg-cyan-900/20">
             + Add Step
           </Button>
           <Button size="sm" variant="ghost" onClick={onClose} className="h-5 w-5 p-0 text-gray-400 hover:text-white">
             <X className="w-3.5 h-3.5" />
           </Button>
        </div>
      </div>
      
      {/* Steps List */}
      <div className="p-2 space-y-1.5 max-h-[200px] overflow-y-auto">
         {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1.5 hover:border-white/20 transition-colors group">
               <div className="w-5 h-5 rounded bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 flex items-center justify-center text-[10px] font-bold">
                 {idx + 1}
               </div>
               
               {/* A */}
               <select className="bg-black/40 border border-white/10 rounded text-[10px] text-gray-300 h-6 px-1 min-w-[60px]">
                  <option>{step.a}</option>
               </select>
               
               {/* Op */}
               <div className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-[9px] font-bold border border-yellow-500/20 uppercase">
                 {step.op}
               </div>
               
               {/* B */}
               <select className="bg-black/40 border border-white/10 rounded text-[10px] text-gray-300 h-6 px-1 min-w-[60px]">
                  <option>{step.b}</option>
               </select>

               <ArrowRight className="w-3 h-3 text-gray-600" />
               
               {/* Result */}
               <div className="flex-1">
                  <input 
                    value={step.res} 
                    className="w-full bg-transparent text-[10px] text-green-400 font-mono focus:outline-none" 
                  />
               </div>

               <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 hover:text-red-400 rounded transition-all">
                 <Trash2 className="w-3 h-3" />
               </button>
            </div>
         ))}
      </div>
      
      {/* Footer Actions */}
      <div className="p-2 border-t border-white/10 bg-white/5 flex justify-end gap-2">
         <div className="flex items-center gap-2 mr-auto px-2">
            <span className="text-[10px] text-gray-400">Final Output:</span>
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm" />
            <span className="text-xs text-white font-medium">PTV_Final</span>
         </div>
         <Button size="sm" className="h-7 bg-cyan-600 hover:bg-cyan-500 text-white text-xs shadow-lg shadow-cyan-900/20">
           <Play className="w-3 h-3 mr-1.5" /> Execute Pipeline
         </Button>
      </div>
    </div>
  );
}

export function UnifiedToolbarPrototype() {
  // State
  const [activeTool, setActiveTool] = useState('brush'); 
  const [structureName, setStructureName] = useState(mockStructure.name);
  const [structureColor, setStructureColor] = useState(rgbToHex(mockStructure.color));
  
  // Boolean specific
  const [showBooleanPanel, setShowBooleanPanel] = useState(false);
  
  // Other Dropdown States
  const [showNthMenu, setShowNthMenu] = useState(false);

  // Contour Tool State
  const [brushSize, setBrushSize] = useState([15]);
  const [smartBrush, setSmartBrush] = useState(false);
  
  // Margin Tool State
  const [marginDist, setMarginDist] = useState(5);
  const [isAnisotropic, setIsAnisotropic] = useState(false);
  
  // Single-step Boolean State (Quick Mode)
  const [booleanOp, setBooleanOp] = useState<'union' | 'subtract' | 'intersect'>('union');
  const [operandB, setOperandB] = useState('CTV');

  // Derived color for glass effect
  const rgb = mockStructure.color;
  const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const backgroundHue = hsl[0];
  const structureColorRgb = `rgb(${rgb.join(',')})`;

  // Toggle boolean panel when boolean tool is clicked
  const handleToolClick = (toolId: string) => {
    if (toolId === 'boolean') {
       // If already active, toggle panel
       if (activeTool === 'boolean') {
         setShowBooleanPanel(!showBooleanPanel);
       } else {
         // If switching to boolean, show simple controls initially
         setActiveTool('boolean');
         setShowBooleanPanel(false); 
       }
    } else {
       setActiveTool(toolId);
       setShowBooleanPanel(false);
    }
  };

  return (
    <div className="w-full min-h-[500px] flex flex-col items-center justify-center bg-black p-8 relative bg-[url('/grid-pattern.svg')]">
      
      <div className="absolute top-4 left-4 text-gray-500 text-xs">
        Unified Toolbar V5: Expandable Boolean Pipeline
      </div>

      {/* 
        UNIFIED TOOLBAR CONTAINER
        Exact visual replica of the existing ContourEditToolbar 
      */}
      <div 
        className="relative backdrop-blur-md border rounded-xl px-4 py-3 shadow-2xl min-w-[850px] transition-all duration-200"
        style={{ 
          backgroundColor: `hsla(${backgroundHue}, 20%, 10%, 0.85)`,
          borderColor: `${structureColorRgb}60` 
        }}
      >
        
        {/* POPUP PANELS (Rendered relative to container) */}
        {showBooleanPanel && <BooleanMultiStepPanel onClose={() => setShowBooleanPanel(false)} />}

        {/* HEADER ROW - RESTORED ALL BUTTONS */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            
            {/* Structure Info */}
            <div 
              className="w-4 h-4 rounded border-[0.5px] border-white/60 shadow-sm"
              style={{ backgroundColor: structureColor }}
            />
            <span className="text-white text-sm font-medium drop-shadow-sm">Editing:</span>
            <Input
              value={structureName}
              onChange={(e) => setStructureName(e.target.value)}
              className="w-32 h-7 bg-white/10 border-white/30 text-white text-sm rounded-lg backdrop-blur-sm focus:border-blue-500/60 hover:border-white/50"
            />
            
            {/* Color Picker Button */}
            <div className="flex items-center gap-2 bg-white/10 border-[0.5px] border-white/30 rounded-lg px-2 py-1 h-7">
              <div 
                className="w-5 h-5 rounded border-[0.5px] border-white/40 shadow-sm cursor-pointer"
                style={{ backgroundColor: structureColor }}
              />
              <span className="text-xs text-white/90 font-medium">Color</span>
            </div>

            <div className="w-px h-6 bg-white/30 mx-2" />

            {/* Undo/Redo */}
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-white/10 border-[0.5px] border-white/30 text-white hover:bg-white/20 rounded-lg">
              <Undo className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-white/10 border-[0.5px] border-white/30 text-white hover:bg-white/20 rounded-lg">
              <Redo className="w-3 h-3" />
            </Button>
            
            <div className="w-px h-6 bg-white/30 mx-2" />
            
            {/* --- CONTOUR OPERATIONS --- */}
            <Button variant="outline" size="sm" className="h-7 px-2 bg-red-900/30 border-[0.5px] border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg">
              <Trash2 className="w-3 h-3 mr-1" />
              <span className="text-xs font-medium">Del Slice</span>
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 bg-blue-900/30 border-[0.5px] border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40 rounded-lg">
              <GitBranch className="w-3 h-3 mr-1" />
              <span className="text-xs font-medium">Interp</span>
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 bg-orange-900/30 border-[0.5px] border-orange-400/60 text-orange-200 hover:text-orange-100 hover:bg-orange-800/40 rounded-lg">
              <Grid3x3 className="w-3 h-3 mr-1" />
              <span className="text-xs font-medium">Nth</span>
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 bg-green-900/30 border-[0.5px] border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40 rounded-lg">
              <Sparkles className="w-3 h-3 mr-1" />
              <span className="text-xs font-medium">Smooth</span>
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 bg-purple-900/30 border-[0.5px] border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40 rounded-lg">
              <SplitSquareHorizontal className="w-3 h-3 mr-1" />
              <span className="text-xs font-medium">Blob</span>
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 bg-red-900/30 border-[0.5px] border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg">
              <Eraser className="w-3 h-3 mr-1" />
              <span className="text-xs font-medium">Clear</span>
            </Button>

          </div>
          
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white h-7 w-7 p-0">
            <X size={14} />
          </Button>
        </div>

        <Separator className="my-2 bg-white/20" />

        {/* BODY ROW - UNIFIED TOOLS */}
        <div className="flex items-center justify-between h-9">
          
          {/* LEFT: TOOL SELECTOR */}
          <div className="flex items-center space-x-1 mr-4">
            {[
              { id: 'brush', icon: Brush, label: 'Brush' },
              { id: 'pen', icon: Pen, label: 'Pen' },
              { id: 'erase', icon: Scissors, label: 'Erase' },
              { id: 'boolean', icon: Merge, label: 'Boolean', special: true, hasPopup: true },
              { id: 'margin', icon: Expand, label: 'Margin', special: true },
              { id: 'tumor', icon: Sparkles, label: 'AI Tumor' }
            ].map((tool) => {
              const isActive = activeTool === tool.id;
              const Icon = tool.icon;
              return (
                <div key={tool.id} className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToolClick(tool.id)}
                    className={`h-8 px-3 transition-all duration-200 rounded-lg ${
                      isActive 
                        ? 'text-white border-[0.5px] shadow-sm' 
                        : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    } ${tool.special ? 'ml-1' : ''}`}
                    style={isActive ? { 
                      borderColor: structureColorRgb,
                      backgroundColor: `${structureColorRgb}20`,
                      color: 'white'
                    } : {}}
                  >
                    <Icon className={`w-4 h-4 mr-2 ${tool.special ? (isActive ? 'text-white' : 'text-cyan-400') : ''}`} />
                    <span className="text-sm">{tool.label}</span>
                    
                    {/* Indicator for expandable panel */}
                    {tool.hasPopup && isActive && (
                       <ChevronUp className={`w-3 h-3 ml-1.5 transition-transform ${showBooleanPanel ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="w-px h-full bg-white/20 mx-2" />

          {/* RIGHT: CONTEXTUAL CONTROLS */}
          <div className="flex-1 flex items-center pl-3 overflow-visible">
            
            {activeTool === 'brush' && (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-md border border-white/20">
                  <Label className="text-[11px] text-gray-200">Size</Label>
                  <Slider value={brushSize} onValueChange={setBrushSize} max={50} step={1} className="w-24 h-1.5" />
                  <span className="text-[10px] text-gray-400 w-5 text-right">{brushSize[0]}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSmartBrush(!smartBrush)} className={`h-7 px-2 rounded-md border-[0.5px] ${smartBrush ? 'border-green-400/60 bg-green-900/30 text-green-200' : 'border-white/20 text-gray-300 hover:bg-white/10'}`}>
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> <span className="text-[11px]">Smart</span>
                </Button>
              </div>
            )}

            {activeTool === 'pen' && (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-[11px] text-gray-300 bg-white/5 px-2 py-1 rounded border border-white/10">Auto-close: 8px</div>
                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/10">
                  <span className="text-[11px] text-gray-300">Snap</span>
                  <Switch checked={true} className="scale-75 data-[state=checked]:bg-blue-500" />
                </div>
              </div>
            )}

            {/* BOOLEAN QUICK CONTROLS (Shown when panel is closed) */}
            {activeTool === 'boolean' && !showBooleanPanel && (
               <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                  <div className="flex bg-black/30 rounded-lg p-0.5 border border-white/10 shrink-0">
                    {[
                      { id: 'union', label: 'Union', icon: Plus },
                      { id: 'subtract', label: 'Diff', icon: Layers },
                      { id: 'intersect', label: 'Int', icon: Grid3x3 }
                    ].map(op => (
                      <button key={op.id} onClick={() => setBooleanOp(op.id as any)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all ${booleanOp === op.id ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                        <op.icon className="w-3 h-3" /> {op.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">+</span>
                  <select value={operandB} onChange={(e) => setOperandB(e.target.value)} className="h-7 bg-white/10 border border-white/20 text-white text-[11px] rounded-md px-2 focus:outline-none focus:border-blue-500 min-w-[80px]">
                    {availableStructures.map(s => <option key={s} value={s} className="bg-gray-900">{s}</option>)}
                  </select>
                  <div className="flex-1" />
                  <Button size="sm" onClick={() => setShowBooleanPanel(true)} className="h-7 bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-400/30 mr-2">
                    <ListTree className="w-3 h-3 mr-1.5" /> Advanced
                  </Button>
                  <Button size="sm" className="h-7 bg-blue-600/80 hover:bg-blue-500/80 text-white border border-blue-400/30 shadow-sm">
                    <Play className="w-3 h-3 mr-1.5" /> <span className="text-[11px] font-semibold">Run</span>
                  </Button>
               </div>
            )}

             {/* BOOLEAN PANEL HINT (Shown when panel is open) */}
             {activeTool === 'boolean' && showBooleanPanel && (
               <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                  <span className="text-xs text-cyan-400 font-medium flex items-center gap-1.5 bg-cyan-900/20 px-3 py-1 rounded border border-cyan-500/30">
                    <Merge className="w-3.5 h-3.5" />
                    Pipeline Active
                  </span>
                  <span className="text-[10px] text-gray-500 italic">Use the panel above to configure multi-step operations</span>
               </div>
             )}

            {activeTool === 'margin' && (
               <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                  <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-white/10 shrink-0">
                     <button onClick={() => setIsAnisotropic(false)} className={`px-2 py-1 rounded-md text-[10px] transition-all ${!isAnisotropic ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Uniform</button>
                     <button onClick={() => setIsAnisotropic(true)} className={`px-2 py-1 rounded-md text-[10px] transition-all ${isAnisotropic ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Anisotropic</button>
                  </div>
                  {!isAnisotropic ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white/5 border border-white/20 rounded-md px-2 py-1 w-20">
                        <input type="number" value={marginDist} onChange={e => setMarginDist(Number(e.target.value))} className="bg-transparent w-full text-xs text-white focus:outline-none" />
                        <span className="text-[9px] text-gray-500 ml-0.5">mm</span>
                      </div>
                      <div className="flex gap-0.5 bg-white/5 rounded p-0.5 border border-white/10">
                         <button className="px-2 py-0.5 text-[10px] text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded transition-colors">Expand</button>
                         <button className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-orange-300 hover:bg-white/5 rounded transition-colors">Shrink</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                       {['L','R','A','P','S','I'].map(dir => (
                         <div key={dir} className="flex items-center bg-white/5 border border-white/20 rounded px-1 py-0.5 w-[34px]">
                            <span className="text-[8px] text-gray-500 mr-0.5 font-bold">{dir}</span>
                            <input className="w-full bg-transparent text-[10px] text-white focus:outline-none p-0" placeholder="0" />
                         </div>
                       ))}
                    </div>
                  )}
                  <div className="flex-1" />
                  <Button size="sm" className="h-7 bg-green-600/80 hover:bg-green-500/80 text-white border border-green-400/30 shadow-sm">
                      <Check className="w-3 h-3 mr-1.5" /> <span className="text-[11px] font-semibold">Apply</span>
                  </Button>
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// Missing Icon import fix
import { ListTree } from 'lucide-react';
