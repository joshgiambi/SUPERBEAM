/**
 * Boolean Pipeline Builder V3 - Minimal Height Design
 * 
 * Ultra-compact version maintaining the clear formula paradigm
 * but with absolute minimum vertical space.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Play,
  X,
  ArrowRight
} from 'lucide-react';

// Types
type BooleanOp = 'union' | 'intersect' | 'subtract' | 'xor';

interface PipelineStep {
  id: string;
  operation: BooleanOp;
  inputA: string;
  inputB: string;
  result: string;
}

interface BooleanPipelinePrototypeV3Props {
  availableStructures?: string[];
  onExecute?: (steps: PipelineStep[], outputConfig: any) => void;
}

export function BooleanPipelinePrototypeV3({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute
}: BooleanPipelinePrototypeV3Props) {
  
  const [steps, setSteps] = useState<PipelineStep[]>([
    {
      id: '1',
      operation: 'union',
      inputA: 'CTV',
      inputB: 'GTV',
      result: 'Combined_CTV_GTV'
    }
  ]);

  const [outputName, setOutputName] = useState('PTV_Final');
  const [outputColor, setOutputColor] = useState('#FF6B6B');
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(true);

  const getAvailableInputs = (stepIndex: number): string[] => {
    const previousResults = steps
      .slice(0, stepIndex)
      .map(s => s.result)
      .filter(Boolean);
    return [...availableStructures, ...previousResults];
  };

  const getOperationLabel = (op: BooleanOp): string => {
    const labels = {
      union: 'combine',
      intersect: 'overlap',
      subtract: 'minus',
      xor: 'xor'
    };
    return labels[op];
  };

  const addStep = () => {
    const lastResult = steps[steps.length - 1]?.result || '';
    const newStep: PipelineStep = {
      id: Date.now().toString(),
      operation: 'union',
      inputA: lastResult || '',
      inputB: '',
      result: `Result_${steps.length + 1}`
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<PipelineStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const isValid = steps.every(s => s.inputA && s.inputB && s.result);

  const handleExecute = () => {
    onExecute?.(steps, {
      name: outputName,
      color: outputColor,
      saveAsSuperstructure
    });
  };

  return (
    <div className="w-full bg-gray-900/80 border border-gray-700/50 rounded-lg p-2 space-y-1.5">
      
      {/* Minimal Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-gray-700/30">
        <span className="text-sm font-medium text-gray-300">Formula Builder</span>
        <Button
          onClick={addStep}
          size="sm"
          className="h-6 px-2 bg-purple-600/40 border border-purple-400/50 text-purple-200 hover:bg-purple-500/50 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Ultra-Compact Steps */}
      <div className="space-y-1">
        {steps.map((step, idx) => {
          const availableInputs = getAvailableInputs(idx);
          
          return (
            <div key={step.id} className="flex items-center gap-1.5 bg-gray-800/30 border border-gray-700/30 rounded px-1.5 py-1">
              {/* Step Number */}
              <div className="w-5 h-5 rounded bg-purple-600/40 border border-purple-400/50 flex items-center justify-center text-[11px] font-bold text-purple-200 flex-shrink-0">
                {idx + 1}
              </div>
              
              {/* Compact Formula: A op B = Result */}
              <select
                value={step.inputA}
                onChange={(e) => updateStep(step.id, { inputA: e.target.value })}
                className="flex-1 min-w-[80px] bg-gray-900/60 border border-gray-600/50 text-gray-200 text-xs h-6 px-2 rounded focus:outline-none focus:border-purple-500/60"
              >
                <option value="">A</option>
                {availableStructures.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                  const sourceStep = steps.findIndex(s => s.result === name);
                  return (
                    <option key={name} value={name}>{name}←{sourceStep + 1}</option>
                  );
                })}
              </select>
              
              <select
                value={step.operation}
                onChange={(e) => updateStep(step.id, { operation: e.target.value as BooleanOp })}
                className="w-24 bg-gray-900/60 border border-gray-600/50 text-gray-200 text-xs h-6 px-2 rounded focus:outline-none"
              >
                <option value="union">combine</option>
                <option value="intersect">overlap</option>
                <option value="subtract">minus</option>
                <option value="xor">xor</option>
              </select>
              
              <select
                value={step.inputB}
                onChange={(e) => updateStep(step.id, { inputB: e.target.value })}
                className="flex-1 min-w-[80px] bg-gray-900/60 border border-gray-600/50 text-gray-200 text-xs h-6 px-2 rounded focus:outline-none focus:border-purple-500/60"
              >
                <option value="">B</option>
                {availableStructures.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                  const sourceStep = steps.findIndex(s => s.result === name);
                  return (
                    <option key={name} value={name}>{name}←{sourceStep + 1}</option>
                  );
                })}
              </select>
              
              <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
              
              <input
                type="text"
                value={step.result}
                onChange={(e) => updateStep(step.id, { result: e.target.value })}
                placeholder="name"
                className="flex-1 min-w-[100px] bg-purple-900/30 border border-purple-500/40 text-purple-200 text-xs h-6 px-2 rounded focus:outline-none focus:border-purple-400/60 placeholder:text-purple-400/50"
              />
              
              {steps.length > 1 && (
                <Button
                  onClick={() => removeStep(step.id)}
                  size="sm"
                  className="h-6 w-6 p-0 bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-900/30 flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Minimal Output Row */}
      <div className="pt-1.5 border-t border-gray-700/30 flex items-center gap-2">
        <span className="text-xs text-gray-400">Save:</span>
        <input
          type="text"
          value={outputName}
          onChange={(e) => setOutputName(e.target.value)}
          placeholder="name"
          className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-200 text-xs h-6 px-2 rounded focus:outline-none focus:border-blue-500/60"
        />
        <input
          type="color"
          value={outputColor}
          onChange={(e) => setOutputColor(e.target.value)}
          className="h-6 w-10 rounded border border-gray-600/50 cursor-pointer"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={saveAsSuperstructure}
            onChange={(e) => setSaveAsSuperstructure(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-600"
          />
          <span>Auto</span>
        </label>
        <Button
          onClick={handleExecute}
          disabled={!isValid || !outputName}
          className="h-6 px-3 bg-purple-600/60 border border-purple-400/60 text-white hover:bg-purple-500/70 text-xs font-semibold disabled:opacity-50 flex-shrink-0"
        >
          <Play className="w-3 h-3 mr-1" />
          Run
        </Button>
      </div>
    </div>
  );
}

