/**
 * BED Calculator Page
 * 
 * Standalone BED/EQD2 calculator matching the application design.
 * Opens in a popup window from the Dose Control Panel.
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Calculator } from 'lucide-react';

// ============================================================================
// BED Calculator Page Component
// ============================================================================

export default function BEDCalculatorPage() {
  // Parse URL parameters for initial values
  const [totalDose, setTotalDose] = useState(70);
  const [fractions, setFractions] = useState(35);
  const [alphaOverBeta, setAlphaOverBeta] = useState(10);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prescriptionDose = params.get('prescriptionDose');
    const maxDose = params.get('maxDose');
    
    if (prescriptionDose) {
      setTotalDose(parseFloat(prescriptionDose) || 70);
    } else if (maxDose) {
      setTotalDose(parseFloat(maxDose) || 70);
    }
  }, []);

  // Calculations
  const dosePerFraction = fractions > 0 ? totalDose / fractions : 0;
  const bed = totalDose * (1 + dosePerFraction / alphaOverBeta);
  const eqd2 = bed / (1 + 2 / alphaOverBeta);

  // Common α/β presets
  const presets = [
    { name: 'Tumor (α/β = 10)', value: 10 },
    { name: 'Late Effects (α/β = 3)', value: 3 },
    { name: 'Prostate (α/β = 1.5)', value: 1.5 },
    { name: 'Breast (α/β = 4)', value: 4 },
  ];

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(180deg, #0a0a0c 0%, #141418 100%)',
      }}
    >
      <div 
        className="w-full max-w-[380px] rounded-2xl border border-zinc-600/30 shadow-2xl shadow-black/40 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(80, 80, 90, 0.20) 0%, rgba(20, 20, 25, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-600/25">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-700/10">
            <Calculator className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-50">BED / EQD2 Calculator</h1>
            <p className="text-xs text-zinc-500">Biological Effective Dose</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Total Dose (Gy)</Label>
              <Input
                type="number"
                value={totalDose}
                onChange={(e) => setTotalDose(parseFloat(e.target.value) || 0)}
                className="h-9 text-sm bg-zinc-800/50 border-zinc-700 text-zinc-100 focus:border-purple-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Fractions</Label>
              <Input
                type="number"
                value={fractions}
                onChange={(e) => setFractions(parseInt(e.target.value) || 1)}
                className="h-9 text-sm bg-zinc-800/50 border-zinc-700 text-zinc-100 focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* α/β Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">α/β Ratio</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={alphaOverBeta}
                onChange={(e) => setAlphaOverBeta(parseFloat(e.target.value) || 1)}
                className="w-24 h-9 text-sm bg-zinc-800/50 border-zinc-700 text-zinc-100 focus:border-purple-500/50"
                step={0.5}
                min={0.1}
              />
              <span className="text-xs text-zinc-500">Gy</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setAlphaOverBeta(preset.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-[11px] rounded-lg transition-all duration-200",
                    alphaOverBeta === preset.value
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                      : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 border border-transparent"
                  )}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Dose per Fraction</div>
              <div className="text-xl font-semibold text-zinc-100">{dosePerFraction.toFixed(2)} Gy</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-700/50">
              <div>
                <div className="text-xs text-zinc-500 mb-1">BED</div>
                <div className="text-2xl font-bold text-purple-400">{bed.toFixed(1)} Gy</div>
                <div className="text-[10px] text-zinc-600 mt-1 font-mono">
                  = {totalDose} × (1 + {dosePerFraction.toFixed(2)}/{alphaOverBeta})
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">EQD2</div>
                <div className="text-2xl font-bold text-cyan-400">{eqd2.toFixed(1)} Gy</div>
                <div className="text-[10px] text-zinc-600 mt-1">
                  Equivalent in 2Gy fractions
                </div>
              </div>
            </div>
          </div>

          {/* Formula Reference */}
          <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-600 font-mono leading-relaxed">
              BED = n × d × (1 + d/(α/β))
            </div>
            <div className="text-[10px] text-zinc-600 font-mono leading-relaxed">
              EQD2 = BED / (1 + 2/(α/β))
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

