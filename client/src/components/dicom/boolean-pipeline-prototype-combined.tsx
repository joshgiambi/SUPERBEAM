/**
 * Boolean Pipeline Builder Combined - V4/V5 Mode Switcher
 * 
 * Combines V4 (Panel style) and V5 (Expression style) with a mode switcher
 * similar to the boolean toolbar's Expression/Panel toggle.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Play,
  X,
  Undo,
  Redo,
  Eraser,
  Trash2,
  Save,
  Library,
  ArrowRight
} from 'lucide-react';

// Types
type BooleanOp = 'union' | 'intersect' | 'subtract' | 'xor';
type Mode = 'panel' | 'expression';

interface PanelStep {
  id: string;
  operation: BooleanOp;
  inputA: string;
  inputB: string;
  result: string;
}

interface ExpressionStep {
  id: string;
  expression: string;
  result: string;
}

interface BooleanPipelinePrototypeCombinedProps {
  availableStructures?: string[];
  onExecute?: (steps: any[], outputConfig: any) => void;
  onClose?: () => void;
}

export function BooleanPipelinePrototypeCombined({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute,
  onClose
}: BooleanPipelinePrototypeCombinedProps) {
  
  const [mode, setMode] = useState<Mode>('panel');
  
  // Panel mode state (V4) - initialized
  const initialPanelStep: PanelStep = {
    id: '1',
    operation: 'union',
    inputA: 'CTV',
    inputB: 'GTV',
    result: 'Combined_CTV_GTV'
  };
  
  const [panelSteps, setPanelSteps] = useState<PanelStep[]>([initialPanelStep]);

  // Expression mode state (V5) - initialized from panel
  const initialExpressionStep: ExpressionStep = {
    id: '1',
    expression: 'CTV ∪ GTV',
    result: 'Combined_CTV_GTV'
  };
  
  const [expressionSteps, setExpressionSteps] = useState<ExpressionStep[]>([initialExpressionStep]);

  // Shared state
  const [outputName, setOutputName] = useState('PTV_Final');
  const [outputColor, setOutputColor] = useState('#FF6B6B');
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(true);
  
  // Expression mode specific state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<string | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [activeExpressionStepId, setActiveExpressionStepId] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  
  // Undo/Redo history
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Template management
  interface PipelineTemplate {
    id: string;
    name: string;
    mode: Mode;
    steps: any[];
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
    const savedTemplates = localStorage.getItem('booleanPipelineCombinedTemplates');
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
      localStorage.setItem('booleanPipelineCombinedTemplates', JSON.stringify(templates));
    }
  }, [templates]);
  
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

  const getOperationStyle = (op: BooleanOp) => {
    const styles = {
      union: 'bg-green-900/30 border-[0.5px] border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40',
      intersect: 'bg-blue-900/30 border-[0.5px] border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40',
      subtract: 'bg-red-900/30 border-[0.5px] border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40',
      xor: 'bg-purple-900/30 border-[0.5px] border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40'
    };
    return styles[op];
  };

  // Conversion functions
  const panelStepToExpression = (step: PanelStep): ExpressionStep => {
    const opSymbols: Record<BooleanOp, string> = {
      union: '∪',
      intersect: '∩',
      subtract: '-',
      xor: '⊕'
    };
    const expression = `${step.inputA} ${opSymbols[step.operation]} ${step.inputB}`;
    return {
      id: step.id,
      expression,
      result: step.result
    };
  };

  const expressionStepToPanel = (step: ExpressionStep): PanelStep => {
    // Parse expression like "CTV ∪ GTV" or "CTV - GTV"
    const expression = step.expression.trim();
    const unionMatch = expression.match(/^(.+?)\s*∪\s*(.+)$/);
    const intersectMatch = expression.match(/^(.+?)\s*∩\s*(.+)$/);
    const subtractMatch = expression.match(/^(.+?)\s*-\s*(.+)$/);
    const xorMatch = expression.match(/^(.+?)\s*⊕\s*(.+)$/);
    
    let operation: BooleanOp = 'union';
    let inputA = '';
    let inputB = '';
    
    if (unionMatch) {
      operation = 'union';
      inputA = unionMatch[1].trim();
      inputB = unionMatch[2].trim();
    } else if (intersectMatch) {
      operation = 'intersect';
      inputA = intersectMatch[1].trim();
      inputB = intersectMatch[2].trim();
    } else if (subtractMatch) {
      operation = 'subtract';
      inputA = subtractMatch[1].trim();
      inputB = subtractMatch[2].trim();
    } else if (xorMatch) {
      operation = 'xor';
      inputA = xorMatch[1].trim();
      inputB = xorMatch[2].trim();
    } else {
      // Fallback: try to parse as single structure or default to union
      const parts = expression.split(/\s+/);
      if (parts.length >= 3) {
        inputA = parts[0];
        inputB = parts[2];
      } else if (parts.length === 1) {
        inputA = parts[0];
        inputB = '';
      }
    }
    
    return {
      id: step.id,
      operation,
      inputA,
      inputB,
      result: step.result
    };
  };

  const syncStepsBetweenModes = (targetMode: Mode) => {
    if (targetMode === 'panel') {
      // Convert expression steps to panel steps
      const converted = expressionSteps.map(expressionStepToPanel);
      setPanelSteps(converted);
    } else {
      // Convert panel steps to expression steps
      const converted = panelSteps.map(panelStepToExpression);
      setExpressionSteps(converted);
    }
  };

  const getAvailableInputs = (stepIndex: number, mode: Mode): string[] => {
    const currentSteps = mode === 'panel' ? panelSteps : expressionSteps;
    const previousResults = currentSteps.slice(0, stepIndex).map(s => s.result).filter(Boolean);
    return [...availableStructures, ...previousResults];
  };

  // Panel mode functions
  const addPanelStep = () => {
    const lastResult = panelSteps[panelSteps.length - 1]?.result || '';
    const newStep: PanelStep = {
      id: Date.now().toString(),
      operation: 'union',
      inputA: lastResult || '',
      inputB: '',
      result: `Result_${panelSteps.length + 1}`
    };
    const updated = [...panelSteps, newStep];
    setPanelSteps(updated);
    // Sync to expression mode
    setExpressionSteps(updated.map(panelStepToExpression));
  };

  const removePanelStep = (id: string) => {
    const updated = panelSteps.filter(s => s.id !== id);
    setPanelSteps(updated);
    // Sync to expression mode
    setExpressionSteps(updated.map(panelStepToExpression));
  };

  const updatePanelStep = (id: string, updates: Partial<PanelStep>) => {
    const updated = panelSteps.map(s => s.id === id ? { ...s, ...updates } : s);
    setPanelSteps(updated);
    // Sync to expression mode
    setExpressionSteps(updated.map(panelStepToExpression));
  };

  // Expression mode functions
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

  const renderExpressionWithHighlighting = (expression: string, stepIndex: number) => {
    const availableInputs = getAvailableInputs(stepIndex, 'expression');
    const parts: Array<{ start: number; end: number; type: string; value: string }> = [];
    
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
    
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    
    parts.forEach((part, idx) => {
      if (part.start > lastIndex) {
        result.push(
          <span key={`text-${lastIndex}`}>{expression.slice(lastIndex, part.start)}</span>
        );
      }
      
      const color = part.type === 'structure' ? getStructureColor(part.value) : null;
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
    const step = expressionSteps.find(s => s.id === stepId);
    if (!step) return;
    
    const newExpression = step.expression.slice(0, start) + text + step.expression.slice(end);
    updateExpressionStep(stepId, { expression: newExpression });
    
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
    
    const step = expressionSteps.find(s => s.id === stepId);
    if (!step) return;
    
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = step.expression.slice(0, cursorPos);
    const textAfterCursor = step.expression.slice(cursorPos);
    
    const lastWordMatch = textBeforeCursor.match(/[A-Za-z_][A-Za-z0-9_\-]*$/);
    
    if (lastWordMatch) {
      const newExpression = textBeforeCursor.slice(0, lastWordMatch.index) + 
                           structureName + 
                           textAfterCursor;
      updateExpressionStep(stepId, { expression: newExpression });
      
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

  const addExpressionStep = () => {
    const lastResult = expressionSteps[expressionSteps.length - 1]?.result || '';
    const newStep: ExpressionStep = {
      id: Date.now().toString(),
      expression: lastResult ? `${lastResult} ∪ ` : '',
      result: `Result_${expressionSteps.length + 1}`
    };
    const updated = [...expressionSteps, newStep];
    setExpressionSteps(updated);
    // Sync to panel mode
    setPanelSteps(updated.map(expressionStepToPanel));
    // Set the new step as active
    setActiveExpressionStepId(newStep.id);
  };

  const removeExpressionStep = (id: string) => {
    const updated = expressionSteps.filter(s => s.id !== id);
    setExpressionSteps(updated);
    inputRefs.current.delete(id);
    // Sync to panel mode
    setPanelSteps(updated.map(expressionStepToPanel));
    // If the removed step was active, clear active state (buttons will show on last step)
    if (activeExpressionStepId === id) {
      setActiveExpressionStepId(null);
    }
  };

  const updateExpressionStep = (id: string, updates: Partial<ExpressionStep>) => {
    const updated = expressionSteps.map(s => s.id === id ? { ...s, ...updates } : s);
    setExpressionSteps(updated);
    // Sync to panel mode
    setPanelSteps(updated.map(expressionStepToPanel));
  };

  const handleExpressionChange = (stepId: string, value: string, cursorPos: number) => {
    updateExpressionStep(stepId, { expression: value });
    
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastWord = textBeforeCursor.match(/[A-Za-z_][A-Za-z0-9_\-]*$/)?.[0] || '';
    
    if (lastWord.length >= 1) {
      const stepIndex = expressionSteps.findIndex(s => s.id === stepId);
      const availableInputs = getAvailableInputs(stepIndex, 'expression');
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

  const handleClear = () => {
    const defaultPanelStep: PanelStep = {
      id: Date.now().toString(),
      operation: 'union',
      inputA: '',
      inputB: '',
      result: 'Result_1'
    };
    const defaultExpressionStep: ExpressionStep = {
      id: Date.now().toString(),
      expression: '',
      result: 'Result_1'
    };
    
    setPanelSteps([defaultPanelStep]);
    setExpressionSteps([defaultExpressionStep]);
    setOutputName('PTV_Final');
    setOutputColor('#FF6B6B');
  };

  const handleExecute = () => {
    const steps = mode === 'panel' ? panelSteps : expressionSteps;
    const isValid = mode === 'panel'
      ? steps.every((s: PanelStep) => s.inputA && s.inputB && s.result)
      : steps.every((s: ExpressionStep) => s.expression.trim() && s.result.trim());
    
    if (isValid && outputName) {
      onExecute?.(steps, {
        name: outputName,
        color: outputColor,
        saveAsSuperstructure
      });
    }
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    
    const steps = mode === 'panel' ? panelSteps : expressionSteps;
    const template: PipelineTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      mode,
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
    setMode(template.mode);
    if (template.mode === 'panel') {
      setPanelSteps(template.steps as PanelStep[]);
    } else {
      setExpressionSteps(template.steps as ExpressionStep[]);
    }
    setOutputName(template.outputName);
    setOutputColor(template.outputColor);
    setShowTemplateLibrary(false);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  const currentSteps = mode === 'panel' ? panelSteps : expressionSteps;
  const isValid = mode === 'panel'
    ? currentSteps.every((s: PanelStep) => s.inputA && s.inputB && s.result)
    : currentSteps.every((s: ExpressionStep) => s.expression.trim() && s.result.trim());

  return (
    <div className="backdrop-blur-xl border border-gray-600/60 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 bg-gray-950/90">
      
      {/* Header with Mode Switcher */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <span className="text-gray-100 text-sm font-semibold">Boolean</span>
          
          {/* Mode selector */}
          <div className="w-px h-6 bg-gray-700/50 mx-1" />
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (mode !== 'panel') {
                  syncStepsBetweenModes('panel');
                }
                setMode('panel');
              }}
              className={`h-7 px-2 rounded-lg border text-xs font-medium transition-all ${
                mode === 'panel'
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                  : 'bg-gray-800/30 border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
              title="Panel mode"
            >
              <span className="text-sm mr-1">◎</span>
              <span>Panel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (mode !== 'expression') {
                  syncStepsBetweenModes('expression');
                }
                setMode('expression');
              }}
              className={`h-7 px-2 rounded-lg border text-xs font-medium transition-all ${
                mode === 'expression'
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                  : 'bg-gray-800/30 border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
              title="Expression mode"
            >
              <span className="text-sm mr-1">Σ</span>
              <span>Expression</span>
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={mode === 'panel' ? addPanelStep : addExpressionStep}
            size="sm"
            className="h-7 px-2 bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-300 hover:bg-gray-700/50 text-xs rounded-lg"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Step
          </Button>
        </div>
      </div>

      {/* Panel Mode (V4) */}
      {mode === 'panel' && (
        <div className="space-y-2">
          {panelSteps.map((step, idx) => {
            const availableInputs = getAvailableInputs(idx, 'panel');
            const stepColor = getStepColor(idx);
            
            return (
              <div key={step.id} className="flex items-center gap-2 bg-gray-800/40 border-[0.5px] border-gray-600/50 px-2 py-1.5 rounded-lg">
                {/* Step Number */}
                <div className={`w-6 h-6 rounded-full ${stepColor.bg} border-[0.5px] ${stepColor.border} flex items-center justify-center text-xs font-bold ${stepColor.text} flex-shrink-0`}>
                  {idx + 1}
                </div>
                
                {/* Input A */}
                <select
                  value={step.inputA}
                  onChange={(e) => updatePanelStep(step.id, { inputA: e.target.value })}
                  className="flex-1 min-w-[100px] bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60"
                >
                  <option value="">Select...</option>
                  {availableStructures.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                    const sourceStep = panelSteps.findIndex(s => s.result === name);
                    return (
                      <option key={name} value={name}>{name} ← Step {sourceStep + 1}</option>
                    );
                  })}
                </select>
                
                {/* Operation Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ops: BooleanOp[] = ['union', 'intersect', 'subtract', 'xor'];
                    const currentIdx = ops.indexOf(step.operation);
                    const nextOp = ops[(currentIdx + 1) % ops.length];
                    updatePanelStep(step.id, { operation: nextOp });
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
                  onChange={(e) => updatePanelStep(step.id, { inputB: e.target.value })}
                  className="flex-1 min-w-[100px] bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60"
                >
                  <option value="">Select...</option>
                  {availableStructures.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {availableInputs.filter(name => !availableStructures.includes(name)).map(name => {
                    const sourceStep = panelSteps.findIndex(s => s.result === name);
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
                  onChange={(e) => updatePanelStep(step.id, { result: e.target.value })}
                  placeholder="Result name"
                  className="flex-1 min-w-[120px] bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-purple-500/60 placeholder:text-gray-500"
                />
                
                {/* Delete */}
                {panelSteps.length > 1 && (
                  <Button
                    onClick={() => removePanelStep(step.id)}
                    size="sm"
                    className="h-7 w-7 p-0 bg-red-900/30 border-[0.5px] border-red-400/60 text-red-200 hover:bg-red-800/40 flex-shrink-0 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expression Mode (V5) */}
      {mode === 'expression' && (
        <div className="space-y-2">
          {expressionSteps.map((step, idx) => {
            const availableInputs = getAvailableInputs(idx, 'expression');
            const stepColor = getStepColor(idx);
            const inputRef = (el: HTMLInputElement | null) => {
              if (el) inputRefs.current.set(step.id, el);
              else inputRefs.current.delete(step.id);
            };
            
            return (
              <div key={step.id} className="space-y-2">
                {/* Expression Input with Syntax Highlighting */}
                <div className="relative flex items-center gap-2">
                  {/* Step Number - Inline */}
                  <div className={`w-6 h-6 rounded-full ${stepColor.bg} border-[0.5px] ${stepColor.border} flex items-center justify-center text-xs font-bold ${stepColor.text} flex-shrink-0`}>
                    {idx + 1}
                  </div>
                  
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      value={step.expression}
                      onChange={(e) => {
                        // Set this step as active when editing
                        setActiveExpressionStepId(step.id);
                        const cursorPos = e.target.selectionStart || 0;
                        handleExpressionChange(step.id, e.target.value, cursorPos);
                        requestAnimationFrame(() => {
                          const input = inputRefs.current.get(step.id);
                          if (input) {
                            input.setSelectionRange(cursorPos, cursorPos);
                          }
                        });
                      }}
                      onKeyDown={(e) => handleKeyDown(step.id, e)}
                      onFocus={(e) => {
                        // Set this step as active when focused
                        setActiveExpressionStepId(step.id);
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
                
                {/* Operator Buttons - Only show for active step or last step if none active */}
                {(activeExpressionStepId === step.id || (activeExpressionStepId === null && idx === expressionSteps.length - 1)) && (
                  <div className="ml-8">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => insertText(step.id, ' ∪ ')}
                        className="h-7 px-2 bg-green-900/30 border-[0.5px] border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
                      >
                        <span className="mr-1">∪</span>
                        Union
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => insertText(step.id, ' ∩ ')}
                        className="h-7 px-2 bg-blue-900/30 border-[0.5px] border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
                      >
                        <span className="mr-1">∩</span>
                        Intersect
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => insertText(step.id, ' - ')}
                        className="h-7 px-2 bg-red-900/30 border-[0.5px] border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
                      >
                        <span className="mr-1">−</span>
                        Subtract
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => insertText(step.id, ' ⊕ ')}
                        className="h-7 px-2 bg-purple-900/30 border-[0.5px] border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
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
                          onChange={(e) => updateExpressionStep(step.id, { result: e.target.value })}
                          placeholder="Result name"
                          className="w-32 bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-purple-500/60 placeholder:text-gray-500"
                        />
                      </div>
                      
                      {/* Delete */}
                      {expressionSteps.length > 1 && (
                        <Button
                          onClick={() => removeExpressionStep(step.id)}
                          size="sm"
                          className="h-7 w-7 p-0 bg-red-900/30 border-[0.5px] border-red-400/60 text-red-200 hover:bg-red-800/40 flex-shrink-0 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
              className="min-w-[150px] bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-sm h-8 px-3 rounded-lg focus:outline-none focus:border-blue-500/60 placeholder:text-gray-500"
            />
            
            {/* Improved Color Picker */}
            <div className="relative group">
              <div className="flex items-center gap-2 bg-gray-800/50 border-[0.5px] border-gray-600/50 rounded-lg px-2 py-1 h-8">
                <div 
                  className="w-6 h-6 rounded border-[0.5px] border-gray-500/50 shadow-sm cursor-pointer transition-all hover:border-gray-400/70 hover:scale-105"
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
                  id={`color-picker-combined-${outputName}`}
                />
                <span className="text-xs text-gray-300 font-medium">Color</span>
              </div>
              <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-900/95 border border-gray-600/60 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Click to change color
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg transition-all duration-200">
              <Switch
                checked={saveAsSuperstructure}
                onCheckedChange={setSaveAsSuperstructure}
                className="data-[state=checked]:bg-cyan-600 data-[state=unchecked]:bg-gray-700 border-cyan-700"
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
                className="h-7 px-2 bg-blue-900/30 border-[0.5px] border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm shadow-sm transition-all"
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
                className={`h-7 px-2 border-[0.5px] rounded-lg backdrop-blur-sm shadow-sm transition-all ${
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
                                {template.mode === 'panel' ? 'Panel' : 'Expression'} • {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
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
              className="h-7 px-2 bg-red-900/30 border-[0.5px] border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium"
            >
              <Eraser className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>

            {/* Execute */}
            <Button
              onClick={handleExecute}
              disabled={!isValid || !outputName}
              className="h-7 px-3 bg-green-900/30 border-[0.5px] border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium disabled:opacity-50"
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
                className="h-7 px-3 bg-blue-600/20 border-[0.5px] border-blue-500/50 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50"
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

