/**
 * Boolean Pipeline Builder V5 - Expression Panel Style
 * 
 * Uses expression input fields with syntax highlighting (like boolean toolbar)
 * for each step in the pipeline.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Play,
  X,
  Eye,
  Undo,
  Redo,
  Eraser,
  Trash2,
  Save,
  Library
} from 'lucide-react';

// Types
type BooleanOp = 'union' | 'intersect' | 'subtract' | 'xor';

interface PipelineStep {
  id: string;
  expression: string;
  result: string;
}

interface BooleanPipelinePrototypeV5Props {
  availableStructures?: string[];
  onExecute?: (steps: PipelineStep[], outputConfig: any) => void;
}

export function BooleanPipelinePrototypeV5({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute
}: BooleanPipelinePrototypeV5Props) {
  

  const [outputName, setOutputName] = useState('PTV_Final');
  const [outputColor, setOutputColor] = useState('#FF6B6B');
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<string | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  
  // Undo/Redo history
  const initialSteps: PipelineStep[] = [
    {
      id: '1',
      expression: 'CTV ∪ GTV',
      result: 'Combined_CTV_GTV'
    }
  ];
  const [history, setHistory] = useState<PipelineStep[][]>([initialSteps]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Initialize steps from history
  const [steps, setSteps] = useState<PipelineStep[]>(initialSteps);
  
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
    const savedTemplates = localStorage.getItem('booleanPipelineV5Templates');
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
      localStorage.setItem('booleanPipelineV5Templates', JSON.stringify(templates));
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
    // Reset history with loaded template
    setHistory([template.steps]);
    setHistoryIndex(0);
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

  const renderExpressionWithHighlighting = (expression: string, stepIndex: number) => {
    const availableInputs = getAvailableInputs(stepIndex);
    const parts: Array<{ start: number; end: number; type: string; value: string }> = [];
    
    // Find all structure names and operators
    const tokenRegex = /[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=→]/g;
    let match;
    while ((match = tokenRegex.exec(expression)) !== null) {
      const t = match[0];
      const isValidStructure = availableInputs.some(s => s.toLowerCase() === t.toLowerCase());
      const looksLikeStructure = /^[A-Za-z][A-Za-z0-9_#-]*$/.test(t);
      const isUnknownStructure = looksLikeStructure && !isValidStructure;
      
      let type = 'text';
      if (isValidStructure) type = 'structure';
      else if (isUnknownStructure) type = 'unknown';
      else if (['∪', '∩', '⊕', '-'].includes(t)) type = 'operator';
      else if (t === '=' || t === '→') type = 'arrow';
      else if (['(', ')'].includes(t)) type = 'paren';
      
      parts.push({
        start: match.index,
        end: match.index + t.length,
        type,
        value: t
      });
    }
    
    // Render character by character to maintain exact alignment
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    
    parts.forEach((part, idx) => {
      // Add text before this part
      if (part.start > lastIndex) {
        result.push(
          <span key={`text-${lastIndex}`}>{expression.slice(lastIndex, part.start)}</span>
        );
      }
      
      // Add the highlighted part
      const color = part.type === 'structure' ? getStructureColor(part.value) : null;
      let className = '';
      let style: React.CSSProperties = {};
      
      if (part.type === 'structure' && color) {
        style = {
          color: color,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderBottom: `2px solid ${color}`,
          fontWeight: '600'
        };
      } else if (part.type === 'unknown') {
        style = {
          color: '#f87171',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '2px solid #f87171'
        };
      } else if (part.type === 'operator') {
        style = { color: '#fbbf24', fontWeight: '700' };
      } else if (part.type === 'arrow') {
        style = { color: '#c084fc', fontWeight: '700' };
      } else if (part.type === 'paren') {
        style = { color: '#d1d5db', fontWeight: '500' };
      } else {
        style = { color: '#d1d5db' };
      }
      
      result.push(
        <span key={`part-${idx}`} style={style}>
          {part.value}
        </span>
      );
      
      lastIndex = part.end;
    });
    
    // Add remaining text
    if (lastIndex < expression.length) {
      result.push(
        <span key={`text-${lastIndex}`}>{expression.slice(lastIndex)}</span>
      );
    }
    
    return <span className="whitespace-pre">{result}</span>;
  };

  const insertText = (stepId: string, text: string) => {
    const input = inputRefs.current.get(stepId);
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    
    const newExpression = step.expression.slice(0, start) + text + step.expression.slice(end);
    updateStep(stepId, { expression: newExpression });
    
    requestAnimationFrame(() => {
      if (input) {
        const newPosition = start + text.length;
        input.focus();
        input.setSelectionRange(newPosition, newPosition);
      }
    });
  };

  const insertStructure = (stepId: string, structureName: string, index?: number) => {
    const input = inputRefs.current.get(stepId);
    if (!input) return;
    
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = step.expression.slice(0, cursorPos);
    const textAfterCursor = step.expression.slice(cursorPos);
    
    const lastWordMatch = textBeforeCursor.match(/[A-Za-z_][A-Za-z0-9_\-]*$/);
    
    if (lastWordMatch) {
      const newExpression = textBeforeCursor.slice(0, lastWordMatch.index) + 
                           structureName + 
                           textAfterCursor;
      updateStep(stepId, { expression: newExpression });
      
      requestAnimationFrame(() => {
        if (input) {
          const newPosition = (lastWordMatch.index || 0) + structureName.length;
          input.focus();
          input.setSelectionRange(newPosition, newPosition);
        }
      });
    } else {
      insertText(stepId, structureName);
    }
    
    setShowSuggestions(null);
    setSelectedSuggestionIndex(-1);
  };

  const addStep = () => {
    const lastResult = steps[steps.length - 1]?.result || '';
    const newStep: PipelineStep = {
      id: Date.now().toString(),
      expression: lastResult ? `${lastResult} ∪ ` : '',
      result: `Result_${steps.length + 1}`
    };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSteps);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const removeStep = (id: string) => {
    const newSteps = steps.filter(s => s.id !== id);
    setSteps(newSteps);
    inputRefs.current.delete(id);
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSteps);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const updateStep = (id: string, updates: Partial<PipelineStep>) => {
    const newSteps = steps.map(s => s.id === id ? { ...s, ...updates } : s);
    setSteps(newSteps);
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSteps);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSteps(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSteps(history[historyIndex + 1]);
    }
  };

  const handleClear = () => {
    const clearedSteps = [{
      id: Date.now().toString(),
      expression: '',
      result: 'Result_1'
    }];
    setSteps(clearedSteps);
    setHistory([clearedSteps]);
    setHistoryIndex(0);
    setOutputName('PTV_Final');
    setOutputColor('#FF6B6B');
    setIsPreviewActive(false);
  };

  const handlePreview = () => {
    setIsPreviewActive(!isPreviewActive);
    // TODO: Implement preview functionality
  };

  const handleExpressionChange = (stepId: string, value: string, cursorPos: number) => {
    updateStep(stepId, { expression: value });
    
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastWord = textBeforeCursor.match(/[A-Za-z_][A-Za-z0-9_\-]*$/)?.[0] || '';
    
    if (lastWord.length >= 1) {
      const stepIndex = steps.findIndex(s => s.id === stepId);
      const availableInputs = getAvailableInputs(stepIndex);
      const filtered = availableInputs.filter(structure =>
        structure.toLowerCase().includes(lastWord.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
      setShowSuggestions(stepId);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(null);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleKeyDown = (stepId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions === stepId && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const indexToUse = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0;
        insertStructure(stepId, suggestions[indexToUse], indexToUse);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(null);
        setSelectedSuggestionIndex(-1);
      }
    }
  };

  const isValid = steps.every(s => s.expression.trim() && s.result.trim());

  const handleExecute = () => {
    onExecute?.(steps, {
      name: outputName,
      color: outputColor,
      saveAsSuperstructure
    });
  };

  return (
    <div className="backdrop-blur-xl border border-gray-600/60 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 bg-gray-950/90 w-full">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800/50">
        <span className="text-gray-100 text-sm font-semibold">Boolean Pipeline</span>
        <Button
          onClick={addStep}
          size="sm"
          className="h-7 px-2 bg-gray-800/50 border border-gray-600/50 text-gray-300 hover:bg-gray-700/50 text-xs rounded-lg"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Step
        </Button>
      </div>

      {/* Steps with Expression Inputs */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const availableInputs = getAvailableInputs(idx);
          const inputRef = (el: HTMLInputElement | null) => {
            if (el) inputRefs.current.set(step.id, el);
            else inputRefs.current.delete(step.id);
          };
          
          const stepColor = getStepColor(idx);
          
          return (
            <div key={step.id} className="space-y-2">
              {/* Expression Input with Syntax Highlighting */}
              <div className="relative flex items-center gap-2">
                  {/* Step Number - Inline */}
                  <div className={`w-6 h-6 rounded-full ${stepColor.bg} border ${stepColor.border} flex items-center justify-center text-xs font-bold ${stepColor.text} flex-shrink-0`}>
                    {idx + 1}
                  </div>
                
                <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={step.expression}
                  onChange={(e) => {
                    const cursorPos = e.target.selectionStart || 0;
                    handleExpressionChange(step.id, e.target.value, cursorPos);
                    // Restore cursor position after state update
                    requestAnimationFrame(() => {
                      const input = inputRefs.current.get(step.id);
                      if (input) {
                        input.setSelectionRange(cursorPos, cursorPos);
                      }
                    });
                  }}
                  onKeyDown={(e) => handleKeyDown(step.id, e)}
                  onFocus={(e) => {
                    const cursorPos = e.target.selectionStart || 0;
                    const textBeforeCursor = step.expression.slice(0, cursorPos);
                    const lastWord = textBeforeCursor.match(/[A-Za-z_][A-Za-z0-9_\-]*$/)?.[0] || '';
                    if (lastWord.length >= 1) {
                      const filtered = availableInputs.filter(structure =>
                        structure.toLowerCase().includes(lastWord.toLowerCase())
                      );
                      setSuggestions(filtered.slice(0, 5));
                      setShowSuggestions(step.id);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow click events
                    setTimeout(() => {
                      setShowSuggestions(null);
                      setSelectedSuggestionIndex(-1);
                    }, 200);
                  }}
                  placeholder="Enter expression (e.g., A ∪ B)"
                  className="w-full h-9 bg-gray-800/50 border-gray-600/50 text-gray-100 rounded-lg caret-white relative z-30 font-sans transition-all duration-200 focus:outline-none focus:ring-0 focus:border-blue-500/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:border-gray-500/70 placeholder:text-gray-500"
                  style={{ 
                    color: step.expression ? 'transparent' as any : undefined,
                    caretColor: 'white',
                    fontSize: '15px',
                    letterSpacing: '0.01em',
                    lineHeight: '1.5',
                    WebkitTapHighlightColor: 'transparent',
                    paddingLeft: '0.75rem',
                    paddingRight: '0.75rem',
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem'
                  }}
                />
                
                {/* Visual overlay with syntax highlighting */}
                {step.expression && (
                  <div 
                    className="absolute inset-0 pointer-events-none z-20 font-sans overflow-hidden"
                    style={{ 
                      fontSize: '15px',
                      letterSpacing: '0.01em',
                      lineHeight: '1.5',
                      paddingLeft: '0.75rem',
                      paddingRight: '0.75rem',
                      paddingTop: '0.5rem',
                      paddingBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {renderExpressionWithHighlighting(step.expression, idx)}
                  </div>
                )}
                
                {/* Auto-complete suggestions */}
                {showSuggestions === step.id && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900/95 border border-gray-600/60 rounded-lg shadow-xl z-50 w-full max-h-32 overflow-y-auto backdrop-blur-sm">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => insertStructure(step.id, suggestion, index)}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                        className={`w-full text-left px-3 py-1 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          index === selectedSuggestionIndex
                            ? 'bg-blue-600/50 text-white'
                            : 'text-gray-100 hover:bg-blue-900/30'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </div>
              
              {/* Operator Buttons */}
              <div className="ml-8">
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => insertText(step.id, ' ∪ ')}
                  className="h-7 px-2 bg-green-900/30 border-2 border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
                >
                  <span className="mr-1">∪</span>
                  Union
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => insertText(step.id, ' ∩ ')}
                  className="h-7 px-2 bg-blue-900/30 border-2 border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
                >
                  <span className="mr-1">∩</span>
                  Intersect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => insertText(step.id, ' - ')}
                  className="h-7 px-2 bg-red-900/30 border-2 border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
                >
                  <span className="mr-1">−</span>
                  Subtract
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => insertText(step.id, ' ⊕ ')}
                  className="h-7 px-2 bg-purple-900/30 border-2 border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
                >
                  <span className="mr-1">⊕</span>
                  XOR
                </Button>
                
                {/* Result Name Input */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs text-gray-400">→</span>
                  <input
                    type="text"
                    value={step.result}
                    onChange={(e) => updateStep(step.id, { result: e.target.value })}
                    placeholder="Result name"
                    className="w-32 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-purple-500/60 placeholder:text-gray-500"
                  />
                </div>
                
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Output Configuration */}
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
                  id={`color-picker-${outputName}`}
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
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 border-r border-gray-700/50 pr-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="h-7 w-7 p-0 bg-gray-800/50 border border-gray-600/50 text-gray-300 hover:text-white hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
                title="Undo"
              >
                <Undo className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="h-7 w-7 p-0 bg-gray-800/50 border border-gray-600/50 text-gray-300 hover:text-white hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
                title="Redo"
              >
                <Redo className="w-3.5 h-3.5" />
              </Button>
            </div>

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

