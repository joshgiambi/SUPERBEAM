/**
 * Boolean Pipeline Builder V2 - Clear Formula Builder Paradigm
 * 
 * Redesigned with a clearer paradigm: Build operations like a formula
 * where each step clearly shows what it's creating and how.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
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

interface BooleanPipelinePrototypeV2Props {
  availableStructures?: string[];
  onExecute?: (steps: PipelineStep[], outputConfig: any) => void;
}

export function BooleanPipelinePrototypeV2({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute
}: BooleanPipelinePrototypeV2Props) {
  
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
      union: 'combine with',
      intersect: 'overlap with',
      subtract: 'minus',
      xor: 'exclusive or'
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
    const filtered = steps.filter(s => s.id !== id);
    setSteps(filtered);
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
    <div className="w-full bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 space-y-3">
      
      {/* Clear Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-700/30">
        <div>
          <h3 className="text-sm font-semibold text-white">Build Your Formula</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Combine structures step by step</p>
        </div>
        <Button
          onClick={addStep}
          size="sm"
          className="h-7 px-3 bg-purple-600/40 border border-purple-400/50 text-purple-200 hover:bg-purple-500/50 text-[11px]"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Step
        </Button>
      </div>

      {/* Steps - Clear Formula View */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const availableInputs = getAvailableInputs(idx);
          const isLastStep = idx === steps.length - 1;
          
          return (
            <div key={step.id}>
              {/* Step Card */}
              <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Step Label */}
                  <div className="text-[10px] text-gray-400 font-medium min-w-[35px]">
                    Step {idx + 1}
                  </div>
                  
                  {/* Formula Layout: "A operation B = Result" */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Input A */}
                    <select
                      value={step.inputA}
                      onChange={(e) => updateStep(step.id, { inputA: e.target.value })}
                      className="flex-1 min-w-[100px] bg-gray-900/60 border border-gray-600/50 text-gray-200 text-[11px] h-7 px-2 rounded focus:outline-none focus:border-purple-500/60"
                    >
                      <option value="">Select...</option>
                      {availableStructures.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                        const sourceStep = steps.findIndex(s => s.result === name);
                        return (
                          <option key={name} value={name}>
                            {name} ← Step {sourceStep + 1}
                          </option>
                        );
                      })}
                    </select>
                    
                    {/* Operation */}
                    <select
                      value={step.operation}
                      onChange={(e) => updateStep(step.id, { operation: e.target.value as BooleanOp })}
                      className="w-32 bg-gray-900/60 border border-gray-600/50 text-gray-200 text-[11px] h-7 px-2 rounded focus:outline-none"
                    >
                      <option value="union">combine with</option>
                      <option value="intersect">overlap with</option>
                      <option value="subtract">minus</option>
                      <option value="xor">exclusive or</option>
                    </select>
                    
                    {/* Input B */}
                    <select
                      value={step.inputB}
                      onChange={(e) => updateStep(step.id, { inputB: e.target.value })}
                      className="flex-1 min-w-[100px] bg-gray-900/60 border border-gray-600/50 text-gray-200 text-[11px] h-7 px-2 rounded focus:outline-none focus:border-purple-500/60"
                    >
                      <option value="">Select...</option>
                      {availableStructures.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                        const sourceStep = steps.findIndex(s => s.result === name);
                        return (
                          <option key={name} value={name}>
                            {name} ← Step {sourceStep + 1}
                          </option>
                        );
                      })}
                    </select>
                    
                    {/* Equals Arrow */}
                    <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    
                    {/* Result Name */}
                    <input
                      type="text"
                      value={step.result}
                      onChange={(e) => updateStep(step.id, { result: e.target.value })}
                      placeholder="Result name"
                      className="flex-1 min-w-[120px] bg-purple-900/30 border border-purple-500/40 text-purple-200 text-[11px] h-7 px-2 rounded focus:outline-none focus:border-purple-400/60 placeholder:text-purple-400/50"
                    />
                  </div>
                  
                  {/* Delete */}
                  {steps.length > 1 && (
                    <Button
                      onClick={() => removeStep(step.id)}
                      size="sm"
                      className="h-7 w-7 p-0 bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-900/30 flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                {/* Visual Formula Preview */}
                {step.inputA && step.inputB && (
                  <div className="mt-2 pt-2 border-t border-gray-700/30">
                    <div className="text-[10px] text-gray-500 font-mono">
                      <span className="text-gray-300">{step.inputA}</span>
                      {' '}
                      <span className="text-purple-400">{getOperationLabel(step.operation)}</span>
                      {' '}
                      <span className="text-gray-300">{step.inputB}</span>
                      {' '}
                      <span className="text-gray-500">→</span>
                      {' '}
                      <span className="text-purple-300 font-semibold">{step.result || '?'}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Flow Indicator */}
              {!isLastStep && (
                <div className="flex justify-center py-1">
                  <div className="w-px h-3 bg-purple-500/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final Output */}
      <div className="pt-2 border-t border-gray-700/30 space-y-2">
        <div className="text-[10px] text-gray-400 font-medium mb-1.5">Final Output</div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-gray-300 flex items-center gap-2">
            <span>Save as:</span>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              placeholder="Structure name"
              className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-200 text-[11px] h-7 px-2 rounded focus:outline-none focus:border-blue-500/60"
            />
          </div>
          <input
            type="color"
            value={outputColor}
            onChange={(e) => setOutputColor(e.target.value)}
            className="h-7 w-10 rounded border border-gray-600/50 cursor-pointer"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsSuperstructure}
              onChange={(e) => setSaveAsSuperstructure(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600"
            />
            <span>Auto-update</span>
          </label>
        </div>
        
        {/* Execute */}
        <Button
          onClick={handleExecute}
          disabled={!isValid || !outputName}
          className="w-full h-8 bg-gradient-to-r from-purple-600/70 to-purple-500/70 border border-purple-400/60 text-white hover:from-purple-500/80 hover:to-purple-400/80 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-3.5 h-3.5 mr-1.5" />
          Execute Formula
        </Button>
      </div>
    </div>
  );
}
