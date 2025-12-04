/**
 * Boolean Pipeline Builder V4 - Boolean Toolbar Styling
 * 
 * Uses the same UI styling as the current boolean operations toolbar
 * with colored operation buttons and consistent design language.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Play,
  X,
  ArrowRight,
  Save,
  Library,
  Trash2,
  Eraser
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

interface BooleanPipelinePrototypeV4Props {
  availableStructures?: string[];
  onExecute?: (steps: PipelineStep[], outputConfig: any) => void;
}

export function BooleanPipelinePrototypeV4({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute
}: BooleanPipelinePrototypeV4Props) {
  
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
  
  // Template management
  interface PipelineTemplate {
    id: string;
    name: string;
    steps: PipelineStep[];
    outputName: string;
    outputColor: string;
    createdAt: number;
  }
  
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
  // Load templates from localStorage on mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('booleanPipelineTemplates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    }
  }, []);
  
  // Save templates to localStorage whenever they change
  useEffect(() => {
    if (templates.length > 0) {
      localStorage.setItem('booleanPipelineTemplates', JSON.stringify(templates));
    }
  }, [templates]);
  
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    
    const template: PipelineTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      steps: [...steps],
      outputName,
      outputColor,
      createdAt: Date.now()
    };
    
    setTemplates([...templates, template]);
    setTemplateName('');
    setShowSaveTemplateDialog(false);
  };
  
  const loadTemplate = (template: PipelineTemplate) => {
    setSteps(template.steps);
    setOutputName(template.outputName);
    setOutputColor(template.outputColor);
    setShowTemplateLibrary(false);
  };
  
  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  const getAvailableInputs = (stepIndex: number): string[] => {
    const previousResults = steps
      .slice(0, stepIndex)
      .map(s => s.result)
      .filter(Boolean);
    return [...availableStructures, ...previousResults];
  };

  const getOperationStyle = (op: BooleanOp) => {
    const styles = {
      union: 'bg-green-900/30 border-2 border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40',
      intersect: 'bg-blue-900/30 border-2 border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40',
      subtract: 'bg-red-900/30 border-2 border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40',
      xor: 'bg-purple-900/30 border-2 border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40'
    };
    return styles[op];
  };

  const getStepColor = (stepIndex: number): { bg: string; border: string; text: string } => {
    const colors = [
      { bg: 'bg-cyan-500/40', border: 'border-cyan-400/60', text: 'text-cyan-200' },
      { bg: 'bg-purple-600/40', border: 'border-purple-400/60', text: 'text-purple-200' },
      { bg: 'bg-blue-600/40', border: 'border-blue-400/60', text: 'text-blue-200' },
      { bg: 'bg-green-600/40', border: 'border-green-400/60', text: 'text-green-200' },
      { bg: 'bg-yellow-600/40', border: 'border-yellow-400/60', text: 'text-yellow-200' },
      { bg: 'bg-red-600/40', border: 'border-red-400/60', text: 'text-red-200' },
      { bg: 'bg-pink-600/40', border: 'border-pink-400/60', text: 'text-pink-200' },
      { bg: 'bg-orange-600/40', border: 'border-orange-400/60', text: 'text-orange-200' },
    ];
    return colors[stepIndex % colors.length];
  };

  const handleClear = () => {
    setSteps([{
      id: Date.now().toString(),
      operation: 'union',
      inputA: '',
      inputB: '',
      result: 'Result_1'
    }]);
    setOutputName('PTV_Final');
    setOutputColor('#FF6B6B');
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
    <div className="backdrop-blur-xl border border-gray-600/60 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 bg-gray-950/90 w-full">
      
      {/* Header - Boolean Toolbar Style */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-gray-100 text-sm font-semibold">Boolean Pipeline</span>
        </div>
        <Button
          onClick={addStep}
          size="sm"
          className="h-7 px-2 bg-gray-800/50 border border-gray-600/50 text-gray-300 hover:bg-gray-700/50 text-xs rounded-lg"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Step
        </Button>
      </div>

      {/* Steps - Boolean Toolbar Style */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const availableInputs = getAvailableInputs(idx);
          const stepColor = getStepColor(idx);
          
          return (
            <div key={step.id} className="flex items-center gap-2 bg-gray-800/40 border border-gray-600/50 px-2 py-1.5 rounded-lg">
              {/* Step Number */}
              <div className={`w-6 h-6 rounded-full ${stepColor.bg} border ${stepColor.border} flex items-center justify-center text-xs font-bold ${stepColor.text} flex-shrink-0`}>
                {idx + 1}
              </div>
              
              {/* Input A */}
              <select
                value={step.inputA}
                onChange={(e) => updateStep(step.id, { inputA: e.target.value })}
                className="flex-1 min-w-[100px] bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60"
              >
                <option value="">Select...</option>
                {availableStructures.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                  const sourceStep = steps.findIndex(s => s.result === name);
                  return (
                    <option key={name} value={name}>{name} ← Step {sourceStep + 1}</option>
                  );
                })}
              </select>
              
              {/* Operation Button - Colored like boolean toolbar */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Cycle through operations
                  const ops: BooleanOp[] = ['union', 'intersect', 'subtract', 'xor'];
                  const currentIdx = ops.indexOf(step.operation);
                  const nextOp = ops[(currentIdx + 1) % ops.length];
                  updateStep(step.id, { operation: nextOp });
                }}
                className={`h-7 px-2 ${getOperationStyle(step.operation)} rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium`}
              >
                {step.operation === 'union' && <span className="mr-1">∪</span>}
                {step.operation === 'intersect' && <span className="mr-1">∩</span>}
                {step.operation === 'subtract' && <span className="mr-1">−</span>}
                {step.operation === 'xor' && <span className="mr-1">⊕</span>}
                <span className="capitalize">{step.operation}</span>
              </Button>
              
              {/* Input B */}
              <select
                value={step.inputB}
                onChange={(e) => updateStep(step.id, { inputB: e.target.value })}
                className="flex-1 min-w-[100px] bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60"
              >
                <option value="">Select...</option>
                {availableStructures.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                  const sourceStep = steps.findIndex(s => s.result === name);
                  return (
                    <option key={name} value={name}>{name} ← Step {sourceStep + 1}</option>
                  );
                })}
              </select>
              
              <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
              
              {/* Result Name */}
              <input
                type="text"
                value={step.result}
                onChange={(e) => updateStep(step.id, { result: e.target.value })}
                placeholder="Result name"
                className="flex-1 min-w-[120px] bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-purple-500/60 placeholder:text-gray-500"
              />
              
              {/* Delete */}
              {steps.length > 1 && (
                <Button
                  onClick={() => removeStep(step.id)}
                  size="sm"
                  className="h-7 w-7 p-0 bg-red-900/30 border border-red-400/60 text-red-200 hover:bg-red-800/40 flex-shrink-0 rounded-lg"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Output Configuration - Boolean Toolbar Style */}
      <div className="mt-3 pt-3 border-t border-gray-800/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left side - Output controls */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <span className="text-xs text-gray-400 font-medium">Output:</span>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              placeholder="Structure name"
              className="min-w-[150px] bg-gray-800/50 border border-gray-600/50 text-gray-100 text-sm h-8 px-3 rounded-lg focus:outline-none focus:border-blue-500/60 placeholder:text-gray-500"
            />
            
            {/* Improved Color Picker */}
            <div className="relative group">
              <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-600/50 rounded-lg px-2 py-1 h-8">
                <div 
                  className="w-6 h-6 rounded border-2 border-gray-500/50 shadow-sm cursor-pointer transition-all hover:border-gray-400/70 hover:scale-105"
                  style={{ backgroundColor: outputColor }}
                  onClick={() => {
                    const colorInput = document.createElement('input');
                    colorInput.type = 'color';
                    colorInput.value = outputColor;
                    colorInput.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      setOutputColor(target.value);
                    };
                    colorInput.click();
                  }}
                />
                <input
                  type="color"
                  value={outputColor}
                  onChange={(e) => setOutputColor(e.target.value)}
                  className="absolute opacity-0 w-0 h-0 pointer-events-none"
                  id={`color-picker-v4-${outputName}`}
                />
                <span className="text-xs text-gray-300 font-medium">Color</span>
              </div>
              <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-900/95 border border-gray-600/60 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Click to change color
              </div>
            </div>
            
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200 border cursor-pointer hover:bg-cyan-800/20 ${
              saveAsSuperstructure
                ? 'bg-cyan-600/30 border-cyan-400/70'
                : 'bg-cyan-900/20 border-cyan-500/30'
            }`}>
              <input
                type="checkbox"
                checked={saveAsSuperstructure}
                onChange={(e) => setSaveAsSuperstructure(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800/50 checked:bg-cyan-600 checked:border-cyan-600 focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
              />
              <span className="text-xs font-medium text-cyan-200">Auto-update</span>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            {/* Save */}
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveTemplateDialog(true)}
                disabled={!isValid || !outputName}
                className="h-7 px-2 bg-blue-900/30 border-2 border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm shadow-sm transition-all"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                <span className="text-xs font-medium">Save</span>
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Save as template
              </div>
            </div>
            
            {/* Library */}
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplateLibrary(!showTemplateLibrary)}
                className={`h-7 px-2 border-2 rounded-lg backdrop-blur-sm shadow-sm transition-all ${
                  showTemplateLibrary 
                    ? 'bg-purple-800/40 border-purple-300/80 text-purple-100' 
                    : 'bg-purple-900/30 border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40'
                }`}
              >
                <Library className="w-3.5 h-3.5 mr-1" />
                <span className="text-xs font-medium">Library</span>
              </Button>
              
              {!showTemplateLibrary && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Open template library
                </div>
              )}
              
              {/* Template Library Bubble */}
              {showTemplateLibrary && (
                <div className="absolute bottom-full left-0 mb-2 bg-black/95 border border-purple-400/50 rounded-lg shadow-2xl backdrop-blur-sm w-96 max-h-96 overflow-y-auto z-50">
                  <div className="sticky top-0 bg-gray-900/95 border-b border-purple-400/30 p-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Library className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-purple-200 font-semibold">Template Library</span>
                        {templates.length > 0 && (
                          <span className="text-[10px] text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded-full">
                            {templates.length}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTemplateLibrary(false)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    {templates.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Library className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                        <p className="text-xs font-medium">No saved templates</p>
                        <p className="text-[10px] mt-1 text-gray-500">Save operations to reuse them</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between p-2.5 bg-gray-800/60 border border-gray-600/40 rounded-lg hover:bg-gray-800/80 hover:border-purple-400/40 transition-all group"
                          >
                            <div className="flex-1 min-w-0 mr-2">
                              <div className="text-xs text-gray-100 font-medium truncate mb-1">
                                {template.name}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadTemplate(template)}
                                className="h-7 px-2 bg-purple-800/40 border-purple-400/60 text-purple-200 hover:bg-purple-700/60 hover:text-white text-[10px] rounded transition-all"
                              >
                                Load
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Delete "${template.name}"?`)) {
                                    deleteTemplate(template.id);
                                  }
                                }}
                                className="h-7 w-7 p-0 bg-red-900/30 border-red-400/60 text-red-300 hover:bg-red-800/60 hover:text-white rounded transition-all opacity-50 group-hover:opacity-100"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Clear */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-7 px-2 bg-red-900/30 border-2 border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
            >
              <Eraser className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
            
            <div className="h-6 w-px bg-gray-700/50" />
            
            {/* Execute */}
            <Button
              onClick={handleExecute}
              disabled={!isValid || !outputName}
              className="h-7 px-3 bg-green-900/30 border-2 border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Execute
            </Button>
          </div>
        </div>
      </div>
      
      {/* Save Template Dialog */}
      {showSaveTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-600/60 rounded-lg p-4 w-96">
            <h3 className="text-white text-sm font-semibold mb-3">Save Template</h3>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className="w-full bg-gray-800/50 border border-gray-600/50 text-gray-100 text-sm h-8 px-3 rounded-lg focus:outline-none focus:border-blue-500/60 mb-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && templateName.trim()) {
                  saveTemplate();
                } else if (e.key === 'Escape') {
                  setShowSaveTemplateDialog(false);
                  setTemplateName('');
                }
              }}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSaveTemplateDialog(false);
                  setTemplateName('');
                }}
                className="h-7 px-3 bg-gray-800/50 border border-gray-600/50 text-gray-300 hover:bg-gray-700/50"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveTemplate}
                disabled={!templateName.trim()}
                className="h-7 px-3 bg-blue-600/20 border-2 border-blue-500/50 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

