/**
 * Boolean Pipeline Mode - Prototype Component
 * 
 * This is a visual prototype demonstrating the proposed multi-step
 * pipeline interface for boolean operations. 
 * 
 * Key Features:
 * - Numbered steps with clear visual flow
 * - Add/remove/reorder operations
 * - Intermediate result preview
 * - Color-coded operations
 * - Template support
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  GripVertical,
  Play,
  Save,
  AlertCircle,
  CheckCircle,
  ArrowDown
} from 'lucide-react';

// Types
type BooleanOp = 'union' | 'intersect' | 'subtract' | 'xor';

interface PipelineStep {
  id: string;
  number: number;
  operation: BooleanOp;
  inputA: string;
  inputB: string;
  result: string;
  isValid: boolean;
  isExpanded: boolean;
}

interface BooleanPipelinePrototypeProps {
  availableStructures?: string[];
  onExecute?: (steps: PipelineStep[], outputConfig: any) => void;
}

export function BooleanPipelinePrototype({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute
}: BooleanPipelinePrototypeProps) {
  
  // Pipeline state
  const [steps, setSteps] = useState<PipelineStep[]>([
    {
      id: '1',
      number: 1,
      operation: 'union',
      inputA: 'CTV',
      inputB: 'GTV',
      result: 'temp_step1',
      isValid: true,
      isExpanded: true
    }
  ]);

  // Output configuration
  const [outputMode, setOutputMode] = useState<'existing' | 'new'>('new');
  const [outputName, setOutputName] = useState('PTV_Final');
  const [outputColor, setOutputColor] = useState('#FF6B6B');
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(true);

  // Get available inputs for a step (structures + previous results)
  const getAvailableInputs = (stepNumber: number): string[] => {
    const previousResults = steps
      .filter(s => s.number < stepNumber)
      .map(s => s.result);
    return [...availableStructures, ...previousResults];
  };

  // Add new step
  const addStep = () => {
    const newNumber = steps.length + 1;
    const lastResult = steps[steps.length - 1]?.result || '';
    
    const newStep: PipelineStep = {
      id: Date.now().toString(),
      number: newNumber,
      operation: 'union',
      inputA: lastResult,
      inputB: '',
      result: `temp_step${newNumber}`,
      isValid: false,
      isExpanded: true
    };
    
    setSteps([...steps, newStep]);
  };

  // Remove step
  const removeStep = (id: string) => {
    const filtered = steps.filter(s => s.id !== id);
    // Renumber steps
    const renumbered = filtered.map((s, idx) => ({
      ...s,
      number: idx + 1,
      result: `temp_step${idx + 1}`
    }));
    setSteps(renumbered);
  };

  // Update step
  const updateStep = (id: string, updates: Partial<PipelineStep>) => {
    setSteps(steps.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...updates };
        // Validate
        updated.isValid = !!(updated.inputA && updated.inputB);
        return updated;
      }
      return s;
    }));
  };

  // Toggle step expansion
  const toggleStep = (id: string) => {
    setSteps(steps.map(s => 
      s.id === id ? { ...s, isExpanded: !s.isExpanded } : s
    ));
  };

  // Get operation styling
  const getOperationStyle = (op: BooleanOp) => {
    const styles = {
      union: { 
        bg: 'bg-green-900/30', 
        border: 'border-green-400/60', 
        text: 'text-green-200',
        symbol: '∪',
        name: 'Union'
      },
      intersect: { 
        bg: 'bg-blue-900/30', 
        border: 'border-blue-400/60', 
        text: 'text-blue-200',
        symbol: '∩',
        name: 'Intersect'
      },
      subtract: { 
        bg: 'bg-red-900/30', 
        border: 'border-red-400/60', 
        text: 'text-red-200',
        symbol: '−',
        name: 'Subtract'
      },
      xor: { 
        bg: 'bg-purple-900/30', 
        border: 'border-purple-400/60', 
        text: 'text-purple-200',
        symbol: '⊕',
        name: 'XOR'
      }
    };
    return styles[op];
  };

  // Get structure color (mock)
  const getStructureColor = (name: string): string => {
    const colors: Record<string, string> = {
      'CTV': '#00FF00',
      'GTV': '#FF0000',
      'BODY': '#80FFFF',
      'SpinalCord': '#FF00FF',
      'Parotid_L': '#FFFF00',
      'Parotid_R': '#FFFF00',
      'Mandible': '#FFA500',
    };
    return colors[name] || '#3B82F6';
  };

  // Execute pipeline
  const handleExecute = () => {
    const outputConfig = {
      mode: outputMode,
      name: outputName,
      color: outputColor,
      saveAsSuperstructure
    };
    onExecute?.(steps, outputConfig);
  };

  return (
    <div className="w-full bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm border-2 border-purple-500/50 rounded-xl shadow-2xl p-4">
      
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-gray-700/50">
        <h2 className="text-lg font-bold text-purple-200 flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          Boolean Pipeline Builder
          <span className="text-xs font-normal text-gray-400 ml-2">(Prototype)</span>
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Create multi-step boolean operations with numbered workflow
        </p>
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            Operation Pipeline
            <span className="text-xs font-normal text-gray-500">
              ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
            </span>
          </h3>
          <Button
            onClick={addStep}
            size="sm"
            className="h-7 px-2 bg-purple-900/30 border border-purple-400/60 text-purple-200 hover:bg-purple-800/40 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Step
          </Button>
        </div>

        {steps.map((step, index) => {
          const opStyle = getOperationStyle(step.operation);
          const availableInputs = getAvailableInputs(step.number);
          
          return (
            <div key={step.id}>
              {/* Step Card */}
              <div className={`
                border-2 rounded-lg transition-all
                ${step.isValid 
                  ? 'border-gray-600/50 bg-gray-800/40' 
                  : 'border-orange-500/50 bg-orange-900/10'
                }
              `}>
                {/* Step Header */}
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
                  onClick={() => toggleStep(step.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <div className="text-gray-600 hover:text-gray-400 cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    
                    {/* Step Number */}
                    <div className={`
                      w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm
                      ${step.isValid 
                        ? 'bg-purple-600/40 text-purple-200 border-2 border-purple-400/60' 
                        : 'bg-orange-600/40 text-orange-200 border-2 border-orange-400/60'
                      }
                    `}>
                      {step.number}
                    </div>
                    
                    {/* Step Summary */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-300">{step.inputA || '?'}</span>
                      <span className={`font-bold ${opStyle.text}`}>
                        {opStyle.symbol}
                      </span>
                      <span className="text-gray-300">{step.inputB || '?'}</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-purple-300 font-mono text-xs">
                        {step.result}
                      </span>
                    </div>
                    
                    {/* Validation Status */}
                    <div className="ml-2">
                      {step.isValid ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Preview Button */}
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Preview step', step.number);
                      }}
                      disabled={!step.isValid}
                      className="h-6 px-2 bg-yellow-900/30 border border-yellow-400/60 text-yellow-200 hover:bg-yellow-800/40 text-xs"
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    
                    {/* Delete Button */}
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStep(step.id);
                      }}
                      disabled={steps.length === 1}
                      className="h-6 px-2 bg-red-900/30 border border-red-400/60 text-red-200 hover:bg-red-800/40 text-xs disabled:opacity-30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    
                    {/* Expand/Collapse */}
                    <div className="text-gray-400">
                      {step.isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Step Details (Expandable) */}
                {step.isExpanded && (
                  <div className="px-6 pb-3 space-y-3 border-t border-gray-700/30 pt-3">
                    {/* Input A */}
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-medium">Input A</label>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full border border-gray-500/50" 
                          style={{ backgroundColor: step.inputA ? getStructureColor(step.inputA) : '#666' }}
                        />
                        <select
                          value={step.inputA}
                          onChange={(e) => updateStep(step.id, { inputA: e.target.value })}
                          className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-8 px-2 rounded focus:outline-none focus:border-purple-500/60"
                        >
                          <option value="">Select structure...</option>
                          {availableInputs.map(name => (
                            <option key={name} value={name}>
                              {name}
                              {name.startsWith('temp_') ? ' (intermediate)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Operation */}
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-medium">Operation</label>
                      <select
                        value={step.operation}
                        onChange={(e) => updateStep(step.id, { operation: e.target.value as BooleanOp })}
                        className={`
                          w-full border-2 text-xs h-8 px-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/60
                          ${opStyle.bg} ${opStyle.border} ${opStyle.text}
                        `}
                      >
                        <option value="union">∪ Union (combine)</option>
                        <option value="intersect">∩ Intersect (overlap only)</option>
                        <option value="subtract">− Subtract (A minus B)</option>
                        <option value="xor">⊕ XOR (symmetric difference)</option>
                      </select>
                    </div>

                    {/* Input B */}
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-medium">Input B</label>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full border border-gray-500/50" 
                          style={{ backgroundColor: step.inputB ? getStructureColor(step.inputB) : '#666' }}
                        />
                        <select
                          value={step.inputB}
                          onChange={(e) => updateStep(step.id, { inputB: e.target.value })}
                          className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-8 px-2 rounded focus:outline-none focus:border-purple-500/60"
                        >
                          <option value="">Select structure...</option>
                          {availableInputs.map(name => (
                            <option key={name} value={name}>
                              {name}
                              {name.startsWith('temp_') ? ' (intermediate)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Result Preview */}
                    <div className="bg-gray-900/40 border border-gray-700/50 rounded p-2 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">Intermediate Result:</span>
                          <span className="text-purple-300 font-mono">{step.result}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Flow Arrow */}
              {index < steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="w-5 h-5 text-purple-400/60" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Output Configuration */}
      <div className="bg-gray-800/40 border-2 border-blue-500/30 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="text-blue-400">📤</span>
          Output Configuration
        </h3>

        <div className="space-y-3">
          {/* Output Mode Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 font-medium min-w-[80px]">Output To:</label>
            <div className="inline-flex rounded-md border border-gray-600/50 overflow-hidden">
              <button 
                type="button" 
                onClick={() => setOutputMode('existing')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  outputMode === 'existing' 
                    ? 'bg-blue-600/40 text-blue-200 border-r border-gray-600/50' 
                    : 'bg-transparent text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                Existing Structure
              </button>
              <button 
                type="button" 
                onClick={() => setOutputMode('new')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  outputMode === 'new' 
                    ? 'bg-blue-600/40 text-blue-200' 
                    : 'bg-transparent text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                New Structure
              </button>
            </div>
          </div>

          {/* Output Name/Selection */}
          {outputMode === 'new' ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 font-medium min-w-[80px]">Name:</label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="Enter structure name..."
                className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-8 px-2 rounded focus:outline-none focus:border-blue-500/60"
              />
              <input
                type="color"
                value={outputColor}
                onChange={(e) => setOutputColor(e.target.value)}
                className="h-8 w-12 rounded border border-gray-600/50 cursor-pointer"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 font-medium min-w-[80px]">Structure:</label>
              <select className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-8 px-2 rounded focus:outline-none focus:border-blue-500/60">
                <option value="">Select existing structure...</option>
                {availableStructures.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Superstructure Toggle */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700/30">
            <input
              type="checkbox"
              id="superstructure"
              checked={saveAsSuperstructure}
              onChange={(e) => setSaveAsSuperstructure(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600"
            />
            <label htmlFor="superstructure" className="text-xs text-gray-300 cursor-pointer">
              Save as Superstructure (auto-regenerate when sources change)
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={() => console.log('Save template')}
          className="flex-1 h-9 bg-blue-900/30 border-2 border-blue-400/60 text-blue-200 hover:bg-blue-800/40 text-sm"
        >
          <Save className="w-4 h-4 mr-2" />
          Save as Template
        </Button>
        
        <Button
          onClick={() => console.log('Preview all')}
          disabled={!steps.every(s => s.isValid)}
          className="flex-1 h-9 bg-yellow-900/30 border-2 border-yellow-400/60 text-yellow-200 hover:bg-yellow-800/40 text-sm disabled:opacity-50"
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview All
        </Button>
        
        <Button
          onClick={handleExecute}
          disabled={!steps.every(s => s.isValid) || !outputName}
          className="flex-1 h-9 bg-gradient-to-r from-purple-600/60 to-purple-500/60 border-2 border-purple-400 text-white hover:from-purple-500/70 hover:to-purple-400/70 text-sm font-bold disabled:opacity-50 shadow-lg"
        >
          <Play className="w-4 h-4 mr-2" />
          Execute Pipeline
        </Button>
      </div>

      {/* Stats Footer */}
      <div className="mt-4 pt-3 border-t border-gray-700/30 flex items-center justify-between text-xs text-gray-500">
        <span>
          {steps.length} {steps.length === 1 ? 'operation' : 'operations'} • 
          {' '}{steps.filter(s => s.isValid).length}/{steps.length} valid
        </span>
        <span className="text-purple-400">
          Prototype v1.0
        </span>
      </div>
    </div>
  );
}

