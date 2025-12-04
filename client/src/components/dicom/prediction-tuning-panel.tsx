import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sliders, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

export interface PredictionParams {
  scaleAdjustmentFactor: number;  // Scale change per mm (0-0.02)
  maxScaleChange: number;  // Maximum scale change (0-0.5)
  centroidDriftFactor: number;  // Centroid drift per mm (0-2.0)
  smoothingPasses: number;  // Number of smoothing passes (0-10)
  useIntensityRefinement: boolean;  // Use intensity refinement
  intensityTolerance: number;  // HU tolerance (0-500)
}

const DEFAULT_PARAMS: PredictionParams = {
  scaleAdjustmentFactor: 0.005,
  maxScaleChange: 0.15,
  centroidDriftFactor: 0.5,
  smoothingPasses: 3,
  useIntensityRefinement: false,
  intensityTolerance: 150,
};

interface Props {
  params: PredictionParams;
  onParamsChange: (params: PredictionParams) => void;
  onReset: () => void;
}

export function PredictionTuningPanel({ params, onParamsChange, onReset }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateParam = <K extends keyof PredictionParams>(
    key: K,
    value: PredictionParams[K]
  ) => {
    onParamsChange({ ...params, [key]: value });
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="text-[11px] h-7 gap-1.5"
      >
        <Sliders className="w-3 h-3" />
        Tune Prediction
      </Button>
    );
  }

  const panelContent = (
    <Card className="fixed top-2 right-4 w-80 max-h-[90vh] overflow-y-auto p-3 bg-gray-900/95 border-gray-700 z-[100] shadow-xl">
      <div className="flex items-center justify-between mb-2 sticky top-0 bg-gray-900 pb-2 -mt-3 pt-3 -mx-3 px-3 z-10">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Prediction Tuning</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-6 px-2 text-[10px]"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-6 px-2 text-[10px]"
          >
            ✕
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] text-gray-400 mb-2 italic">
          Predictions copy nearest slice with minor adjustments
        </div>

        {/* Scale Adjustment Factor */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <Label className="text-[10px] text-gray-300">Scale/mm (0-2%)</Label>
            <span className="text-[10px] text-cyan-400 font-mono">
              {(params.scaleAdjustmentFactor * 100).toFixed(2)}%
            </span>
          </div>
          <Slider
            value={[params.scaleAdjustmentFactor]}
            onValueChange={([v]) => updateParam('scaleAdjustmentFactor', v)}
            min={0}
            max={0.02}
            step={0.001}
            className="w-full"
          />
        </div>

        {/* Max Scale Change */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <Label className="text-[10px] text-gray-300">Max Scale Change (0-50%)</Label>
            <span className="text-[10px] text-cyan-400 font-mono">
              ±{(params.maxScaleChange * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[params.maxScaleChange]}
            onValueChange={([v]) => updateParam('maxScaleChange', v)}
            min={0}
            max={0.5}
            step={0.01}
            className="w-full"
          />
        </div>

        {/* Centroid Drift Factor */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <Label className="text-[10px] text-gray-300">Drift/mm (0-2px)</Label>
            <span className="text-[10px] text-cyan-400 font-mono">
              {params.centroidDriftFactor.toFixed(2)}px
            </span>
          </div>
          <Slider
            value={[params.centroidDriftFactor]}
            onValueChange={([v]) => updateParam('centroidDriftFactor', v)}
            min={0}
            max={2.0}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Smoothing Passes */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <Label className="text-[10px] text-gray-300">Smoothing (0-10)</Label>
            <span className="text-[10px] text-cyan-400 font-mono">
              {params.smoothingPasses}
            </span>
          </div>
          <Slider
            value={[params.smoothingPasses]}
            onValueChange={([v]) => updateParam('smoothingPasses', Math.round(v))}
            min={0}
            max={10}
            step={1}
            className="w-full"
          />
        </div>
      </div>
    </Card>
  );

  return createPortal(panelContent, document.body);
}

export { DEFAULT_PARAMS };
