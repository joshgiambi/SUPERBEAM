import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { X, Play, Info, Plus, Eye, Undo, Redo, Eraser, Trash2, ArrowLeftRight, Save, Library } from 'lucide-react';
import type { Grid } from '@/margins/types';
import type { VIPStructure, MaskStructure, BooleanOp } from '@/boolean/types';
import { contoursToVIPWithZMap } from '@/boolean/integrate';
import { vipsToMask, maskToVips } from '@/boolean/convert';
import { union as vipUnion, intersect as vipIntersect, subtract as vipSubtract } from '@/boolean/vipBoolean';

// Template interface for saved operations
interface BooleanTemplate {
  id: string;
  name: string;
  expression?: string; // For expression mode
  panelConfig?: { // For panel mode
    op: BooleanOp;
    aName: string;
    bName: string;
    outMode: 'existing' | 'new';
    outExistingName?: string;
    outName?: string;
    outColor?: string;
  };
  createdAt: number;
}

interface BooleanOperationsToolbarProps {
  isVisible: boolean;
  onClose: () => void;
  availableStructures: string[];
  // Optional: full structures + grid enables panel mode (A/B selectors) instead of text parser
  structures?: any[];
  grid?: Grid;
  // Optional map of structure name -> CSS color string like "rgb(r,g,b)"
  structureColors?: Record<string, string>;
  // Optional: direct apply callback when in panel mode
  onApply?: (target: { name: string; color?: [number, number, number] }, contours: { slicePosition: number; points: number[]; numberOfPoints: number }[], metadata?: {
    sourceStructureNames: string[];
    operationType: 'union' | 'intersect' | 'subtract' | 'xor';
    saveAsSuperstructure: boolean;
  }) => void;
  // New: preview callback for showing temporary structure
  onPreview?: (target: { name: string; color?: [number, number, number]; isTemporary?: boolean }, contours: { slicePosition: number; points: number[]; numberOfPoints: number }[]) => void;
  // New: callback to notify which structures are in preview state
  onPreviewStateChange?: (previewStructures: { targetName: string; isNewStructure: boolean }) => void;
  // New: callback to notify which structures are selected as inputs/outputs
  onHighlightStructures?: (inputs: string[], output: string) => void;
  onExecuteOperation: (expression: string, newStructure?: {
    createNewStructure: boolean;
    name: string;
    color: string;
  }, saveAsSuperstructure?: boolean) => void;
}

export function BooleanOperationsToolbar({
  isVisible,
  onClose,
  availableStructures,
  structures = [],
  grid,
  structureColors,
  onApply,
  onPreview,
  onPreviewStateChange,
  onHighlightStructures,
  onExecuteOperation
}: BooleanOperationsToolbarProps) {
  const [expression, setExpression] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [livePreview, setLivePreview] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [hasAutoPreviewedRef] = useState(() => ({ value: false }));
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showNewStructurePanel, setShowNewStructurePanel] = useState(false);
  const [newStructureName, setNewStructureName] = useState('');
  const [newStructureColor, setNewStructureColor] = useState('#3B82F6');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPillView, setShowPillView] = useState(false);
  const [syntaxErrors, setSyntaxErrors] = useState<string[]>([]);
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(true); // Default to true for superstructure tracking
  // Panel mode state
  const workerRef = useRef<Worker | null>(null);
  const [op, setOp] = useState<BooleanOp>('union');
  const [aName, setAName] = useState<string>('');
  const [bName, setBName] = useState<string>('');
  const [outMode, setOutMode] = useState<'existing' | 'new'>('existing');
  const [outExistingName, setOutExistingName] = useState<string>('');
  const [outName, setOutName] = useState<string>('');
  const [outColor, setOutColor] = useState<string>('#3B82F6');
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const names = (structures || []).map((s: any) => s.structureName);
  const panelMode = !!(structures && grid && onApply);
  const [usePanel, setUsePanel] = useState<boolean>(false);
  const effectivePanelMode = panelMode && usePanel;
  const isPanelReady = effectivePanelMode && aName && bName && (outMode === 'new' ? !!outName : !!outExistingName);
  
  // Template management state
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [templates, setTemplates] = useState<BooleanTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  
  // Load templates from localStorage on mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('booleanTemplates');
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
      localStorage.setItem('booleanTemplates', JSON.stringify(templates));
    }
  }, [templates]);
  
  // Save current operation as template
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    
    const template: BooleanTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      createdAt: Date.now(),
    };
    
    if (effectivePanelMode) {
      // Save panel configuration
      template.panelConfig = {
        op,
        aName,
        bName,
        outMode,
        outExistingName,
        outName,
        outColor,
      };
    } else {
      // Save expression
      template.expression = expression;
    }
    
    setTemplates([...templates, template]);
    setTemplateName('');
    setShowSaveTemplateDialog(false);
  };
  
  // Load template
  const loadTemplate = (template: BooleanTemplate) => {
    if (template.expression) {
      // Load expression mode
      setUsePanel(false);
      setExpression(template.expression);
    } else if (template.panelConfig) {
      // Load panel mode
      setUsePanel(true);
      setOp(template.panelConfig.op);
      setAName(template.panelConfig.aName);
      setBName(template.panelConfig.bName);
      setOutMode(template.panelConfig.outMode);
      if (template.panelConfig.outExistingName) {
        setOutExistingName(template.panelConfig.outExistingName);
      }
      if (template.panelConfig.outName) {
        setOutName(template.panelConfig.outName);
      }
      if (template.panelConfig.outColor) {
        setOutColor(template.panelConfig.outColor);
      }
    }
    setShowTemplateLibrary(false);
  };
  
  // Delete template
  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };
  
  // Removed highlighting feature - no longer tracking structure highlights
  
  // Auto-preview when all 3 structures are selected (only once)
  useEffect(() => {
    if (isPanelReady && !isPreviewActive && !hasAutoPreviewedRef.value && onPreview) {
      // Clear any existing timer
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      
      // Set timer for auto-preview
      previewTimeoutRef.current = setTimeout(() => {
        if (isPanelReady && !isPreviewActive && !hasAutoPreviewedRef.value) {
          hasAutoPreviewedRef.value = true;
          runPanel(true);
        }
      }, 800); // Slightly longer delay to avoid rapid triggers
      
      return () => {
        if (previewTimeoutRef.current) {
          clearTimeout(previewTimeoutRef.current);
          previewTimeoutRef.current = null;
        }
      };
    }
  }, [isPanelReady, isPreviewActive]);
  
  // Reset auto-preview flag when panel is not ready
  useEffect(() => {
    if (!isPanelReady) {
      hasAutoPreviewedRef.value = false;
    }
  }, [isPanelReady]);

  // Get structure color for pill tags
  const getStructureColor = (structureName: string): string => {
    if (structureColors && structureColors[structureName]) {
      return structureColors[structureName];
    }
    // Graceful fallback palette
    const fallback: { [key: string]: string } = {
      'BODY': '#80FFFF',
      'SpinalCord': '#FF0000',
      'Brain': '#FFB6C1',
      'BrainStem': '#FF69B4',
      'Parotid_R': '#00FF00',
      'Parotid_L': '#00FF00',
      'Mandible': '#FFFF00',
      'Larynx': '#FFA500',
      'Thyroid': '#800080'
    };
    return fallback[structureName] || '#3B82F6';
  };

  const runPanel = (isPreview = false) => {
    if (!panelMode) return;
    if (!aName || !bName) { setPanelError('Select A and B'); return; }
    if (outMode === 'existing' && !outExistingName) { setPanelError('Select output structure'); return; }
    setPanelError(null);
    setBusy(true);
    (async () => {
      try {
        const aStruct = structures.find((s: any) => s.structureName === aName);
        const bStruct = structures.find((s: any) => s.structureName === bName);
        if (!aStruct || !bStruct) { setPanelError('Invalid A or B'); setBusy(false); return; }

        // Per-slice polygon booleans directly on original contours (no VIP rectangles)
        const SLICE_TOL = 1.0;
        const mapFrom = (s: any): Map<number, number[][]> => {
          const m = new Map<number, number[][]>();
          for (const c of s.contours || []) {
            if (!c?.points || c.points.length < 9 || typeof c.slicePosition !== 'number') continue;
            let key: number | null = null;
            for (const k of Array.from(m.keys())) { if (Math.abs(k - c.slicePosition) <= SLICE_TOL) { key = k; break; } }
            const useKey = key !== null ? key : c.slicePosition;
            const arr = m.get(useKey) || [];
            arr.push(c.points);
            m.set(useKey, arr);
          }
          return m;
        };
        const A = mapFrom(aStruct);
        const B = mapFrom(bStruct);

        const { combineContours, subtractContours, intersectContours } = await import('@/lib/clipper-boolean-operations');
        const unionReduce = async (contours: number[][]): Promise<number[][]> => {
          if (contours.length <= 1) return contours;
          let acc: number[][] = [contours[0]];
          for (let i = 1; i < contours.length; i++) {
            const next = contours[i];
            const newAcc: number[][] = [];
            for (const a of acc) newAcc.push(...await combineContours(a, next));
            acc = newAcc.length ? newAcc : acc;
          }
          return acc;
        };

        const keys: number[] = [];
        const pushTol = (v: number) => { for (const k of keys) { if (Math.abs(k - v) <= SLICE_TOL) return; } keys.push(v); };
        Array.from(A.keys()).forEach(pushTol); Array.from(B.keys()).forEach(pushTol);
        keys.sort((a, b) => a - b);

        const results: { slicePosition: number; points: number[]; numberOfPoints: number }[] = [];
        for (const k of keys) {
          const getNear = (m: Map<number, number[][]>): number[][] => {
            const out: number[][] = [];
            for (const mk of Array.from(m.keys())) if (Math.abs(mk - k) <= SLICE_TOL) out.push(...(m.get(mk) || []));
            return out;
          };
          const aList = await unionReduce(getNear(A));
          const bList = await unionReduce(getNear(B));
          if ((aList?.length || 0) === 0 && (bList?.length || 0) === 0) continue;

          let acc: number[][] = [];
          if (!aList || aList.length === 0) {
            if (op === 'union') acc = bList; // others empty
          } else if (!bList || bList.length === 0) {
            if (op === 'union' || op === 'subtract') acc = aList; // intersect empty
          } else {
            if (op === 'union') {
              const combined: number[][] = [];
              for (const a of aList) for (const b of bList) combined.push(...await combineContours(a, b));
              acc = await unionReduce(combined);
            } else if (op === 'intersect') {
              const inters: number[][] = [];
              for (const a of aList) for (const b of bList) inters.push(...await intersectContours(a, b));
              acc = await unionReduce(inters);
            } else {
              // subtract A - B
              let cur: number[][] = aList;
              for (const b of bList) {
                const next: number[][] = [];
                for (const a of cur) next.push(...await subtractContours(a, b));
                cur = next;
              }
              acc = await unionReduce(cur);
            }
          }

          for (const pts of acc) {
            if (pts && pts.length >= 9) results.push({ slicePosition: k, points: pts, numberOfPoints: pts.length / 3 });
          }
        }

        if (isPreview && onPreview) {
          // Preview mode - show temporary result
          const targetName = outMode === 'existing' ? outExistingName : (outName || 'Preview');
          const hex = outColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) || 255;
          const g = parseInt(hex.substring(2, 4), 16) || 223;
          const b = parseInt(hex.substring(4, 6), 16) || 0;
          onPreview({ name: targetName, color: [r, g, b], isTemporary: true }, results);
          onPreviewStateChange?.({ targetName, isNewStructure: outMode === 'new' });
          setIsPreviewActive(true);
        } else if (outMode === 'existing') {
          const operationMetadata = {
            sourceStructureNames: [aName, bName],
            operationType: op,
            saveAsSuperstructure
          };
          onApply && onApply({ name: (outExistingName || '').trim() }, results, operationMetadata);
          setIsPreviewActive(false);
          onPreviewStateChange?.({ targetName: '', isNewStructure: false });
        } else {
          const hex = outColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) || 59;
          const g = parseInt(hex.substring(2, 4), 16) || 130;
          const b = parseInt(hex.substring(4, 6), 16) || 246;
          const base = (outName || 'Combined').trim();
          const exists = (candidate: string) => names.some(n => n?.toLowerCase() === candidate.toLowerCase());
          let unique = base;
          let i = 1;
          while (exists(unique)) {
            unique = `${base} (${i++})`;
          }
          if (!isPreview) {
            const operationMetadata = {
              sourceStructureNames: [aName, bName],
              operationType: op,
              saveAsSuperstructure
            };
            onApply && onApply({ name: unique, color: [r, g, b] }, results, operationMetadata);
            setIsPreviewActive(false);
            onPreviewStateChange?.({ targetName: '', isNewStructure: false });
          }
        }
      } catch (e: any) {
        setPanelError(e?.message || 'Operation failed');
      } finally {
        setBusy(false);
      }
    })();
  };

  // Validate expression syntax and detect detailed issues
  const validateExpression = (expr: string) => {
    const errors: string[] = [];
    const trimmed = expr.trim();
    if (!trimmed) {
      setSyntaxErrors([]);
      return;
    }

    // Basic tokenization
    const tokens: string[] = (trimmed.match(/[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=]/g) || []) as string[];

    // Multiple '=' checks and assignment placement
    const rawEqIndex = trimmed.indexOf('=');
    const eqCount = rawEqIndex === -1 ? 0 : 1 + (trimmed.slice(rawEqIndex + 1).includes('=') ? 1 : 0);
    if (eqCount > 1) {
      errors.push("Only one '=' assignment is allowed");
    }
    if (eqCount === 1) {
      if (rawEqIndex === 0) errors.push("Left-hand side of '=' is missing a name");
      if (rawEqIndex === trimmed.length - 1) errors.push("Right-hand expression after '=' is missing");
      // LHS can be any non-empty label; allow spaces/characters so users can name freely
      const lhsRaw = trimmed.slice(0, rawEqIndex).trim();
      if (!lhsRaw) {
        errors.push("Left-hand side of '=' must be a name");
      }
    }

    // Parentheses balance
    let balance = 0;
    for (const t of tokens) {
      if (t === '(') balance++;
      if (t === ')') balance--;
      if (balance < 0) errors.push('Parentheses are misordered');
    }
    if (balance !== 0) errors.push('Unbalanced parentheses');

    // Operator adjacency and ends
    const isOp = (t: string) => ['∪','∩','⊕','-'].includes(t);
    const start = tokens[0];
    const end = tokens[tokens.length - 1];
    const afterEq: string[] = eqCount === 1 ? (trimmed.slice(rawEqIndex + 1).match(/[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=]/g) as string[] || []) : tokens;
    if (afterEq.length > 0) {
      if (isOp(afterEq[0])) errors.push('Expression cannot start with an operator');
      if (isOp(afterEq[afterEq.length - 1])) errors.push('Expression cannot end with an operator');
    }
    for (let i = 0; i < afterEq.length - 1; i++) {
      if (isOp(afterEq[i]) && isOp(afterEq[i + 1])) {
        errors.push(`Consecutive operators: '${afterEq[i]}' and '${afterEq[i + 1]}'`);
      }
      if (afterEq[i] === '(' && isOp(afterEq[i + 1])) {
        errors.push('Operator cannot directly follow "("');
      }
      if (isOp(afterEq[i]) && afterEq[i + 1] === ')') {
        errors.push('Operator cannot directly precede ")"');
      }
    }

    // Unknown identifiers on RHS (ignore LHS output name)
    const rhsTokens: string[] = eqCount === 1 ? (trimmed.slice(rawEqIndex + 1).match(/[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=]/g) as string[] || []) : tokens;
    const identifiers = rhsTokens.filter(t => /^[A-Za-z][A-Za-z0-9_#-]*$/.test(t));
    // Treat LHS name (if present) as declared/allowed in RHS to support self-referential use
    const lhsDeclared = eqCount === 1 ? trimmed.slice(0, rawEqIndex).trim() : '';
    const lhsDeclaredLower = lhsDeclared.toLowerCase();
    const unknown = identifiers.filter(name => {
      if (lhsDeclared && name.toLowerCase() === lhsDeclaredLower) return false;
      return !availableStructures.some(s => s.toLowerCase() === name.toLowerCase());
    });
    if (unknown.length > 0) {
      errors.push(`Unknown structure(s): ${Array.from(new Set(unknown)).join(', ')}`);
    }

    setSyntaxErrors(errors);
  };
  
  // Parse expression to identify structure names and operators with syntax highlighting
  const renderExpressionWithPills = () => {
    if (!expression) return null;
    
    const tokenRegex = /[A-Za-z][A-Za-z0-9_#-]*|[∪∩⊕\-()=]/g;
    const parts: { text: string; type: 'text' | 'token' }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(expression)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: expression.slice(lastIndex, match.index), type: 'text' });
      }
      parts.push({ text: match[0], type: 'token' });
      lastIndex = tokenRegex.lastIndex;
    }
    if (lastIndex < expression.length) {
      parts.push({ text: expression.slice(lastIndex), type: 'text' });
    }

    return (
      <span className="whitespace-pre">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return <span key={index}>{part.text}</span>;
          }
          const t = part.text;
          const isValidStructure = availableStructures.some(
            s => s.toLowerCase() === t.toLowerCase()
          );
          const looksLikeStructure = /^[A-Za-z][A-Za-z0-9_#-]*$/.test(t);
          const isUnknownStructure = looksLikeStructure && !isValidStructure;
          if (isValidStructure) {
            const color = getStructureColor(t);
            return (
              <span
                key={index}
                className="inline-flex items-center rounded-md px-1.5 py-0 text-[11px] font-semibold border align-middle"
                style={{
                  color: color,
                  borderColor: typeof color === 'string' && color.startsWith('rgb') ? color : '#94a3b8',
                  backgroundColor: 'rgba(255,255,255,0.05)'
                }}
              >
                {t}
              </span>
            );
          }
          if (isUnknownStructure) {
            return (
              <span key={index} className="inline-flex items-center rounded-md px-1.5 py-0 text-[11px] font-semibold border border-red-400/60 text-red-300 bg-red-900/20 align-middle" title={`Unknown structure: ${t}`}>
                {t}
              </span>
            );
          }
          if (['∪', '∩', '⊕', '-'].includes(t)) {
            return <span key={index} className="text-yellow-300 font-bold">{t}</span>;
          }
          if (t === '=') {
            return <span key={index} className="text-purple-300 font-bold">{t}</span>;
          }
          if (['(', ')'].includes(t)) {
            return <span key={index} className="text-gray-300 font-medium">{t}</span>;
          }
          return <span key={index}>{t}</span>;
        })}
      </span>
    );
  };

  // Validate expression whenever it changes
  useEffect(() => {
    validateExpression(expression);
  }, [expression, availableStructures]);

  // Auto-complete logic - works within brackets and parentheses
  useEffect(() => {
    if (expression.length > 0 && inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      const textBeforeCursor = expression.slice(0, cursorPos);
      
      // Find the last word being typed (including within brackets)
      const lastWord = textBeforeCursor.match(/[A-Za-z_][A-Za-z0-9_\-]*$/)?.[0] || '';
      
      if (lastWord.length >= 1) {
        const filtered = availableStructures.filter(structure =>
          structure.toLowerCase().includes(lastWord.toLowerCase())
        );
        setSuggestions(filtered.slice(0, 5));
        setShowSuggestions(filtered.length > 0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [expression, availableStructures]);

  const insertText = (text: string) => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart || 0;
      const end = inputRef.current.selectionEnd || 0;
      const newValue = expression.slice(0, start) + text + expression.slice(end);
      setExpression(newValue);
      
      // Use requestAnimationFrame for better synchronization with DOM updates
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newPosition = start + text.length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPosition, newPosition);
        }
      });
    }
  };

  const insertStructure = (structureName: string) => {
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = expression.slice(0, cursorPos);
    const textAfterCursor = expression.slice(cursorPos);
    
    // Find the last word being typed (including within brackets)
    const lastWordMatch = textBeforeCursor.match(/[A-Za-z_][A-Za-z0-9_\-]*$/);
    
    if (lastWordMatch) {
      // Replace the partial word with the selected structure
      const newExpression = textBeforeCursor.slice(0, lastWordMatch.index) + 
                           structureName + 
                           textAfterCursor;
      setExpression(newExpression);
      
      // Set cursor position after the inserted structure name
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newPos = (lastWordMatch.index || 0) + structureName.length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    } else {
      // Just insert at cursor position
      insertText(structureName);
    }
    setShowSuggestions(false);
  };

  const handleExecute = () => {
    if (expression.trim()) {
      if (showNewStructurePanel && newStructureName.trim()) {
        onExecuteOperation(expression, {
          createNewStructure: true,
          name: newStructureName,
          color: newStructureColor
        }, saveAsSuperstructure);
      } else {
        onExecuteOperation(expression, undefined, saveAsSuperstructure);
      }
    }
  };

  const handleClear = () => {
    setExpression('');
    setNewStructureName('');
    setShowNewStructurePanel(false);
  };

  const handleCloseWithConfirmation = () => {
    if (expression.trim()) {
      // Show confirmation modal when there's active text
      const shouldClose = window.confirm('You have an active operation. Are you sure you want to close?');
      if (shouldClose) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleUndo = () => {
    // TODO: Implement undo functionality
    console.log('Undo clicked');
  };

  const handleRedo = () => {
    // TODO: Implement redo functionality
    console.log('Redo clicked');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 lg:left-[58.33%] left-1/2 transform -translate-x-1/2 z-50" style={{ animationName: 'fadeInScale', animationDuration: '300ms', animationTimingFunction: 'ease-out', animationFillMode: 'both' }}>
      <div className="relative">
        {!effectivePanelMode && syntaxErrors.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 bg-red-950/90 border border-red-500/40 text-red-200 text-xs rounded-md px-3 py-2 shadow-xl max-w-[1200px] z-50 backdrop-blur-sm">
            <div className="space-y-1">
              {syntaxErrors.map((err, i) => (
                <div key={i} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {effectivePanelMode && panelError && (
          <div className="absolute bottom-full left-0 mb-2 bg-red-950/90 border border-red-500/40 text-red-200 text-xs rounded-md px-3 py-2 shadow-xl max-w-[1200px] z-50 backdrop-blur-sm">
            {panelError}
          </div>
        )}
        {/* Main toolbar panel */}
        <div className="backdrop-blur-xl border border-gray-600/60 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 bg-gray-950/90 w-[1200px]">

          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1">
              {/* Title and Info */}
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded border-2 border-blue-400/60 shadow-sm"
                  style={{ backgroundColor: 'rgb(59, 130, 246)' }}
                />
                <span className="text-gray-100 text-sm font-semibold">Boolean Operations</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-lg"
                  title="Show instructions"
                >
                  <Info size={12} />
                </Button>
              </div>

              {/* Mode selector - inline when panel mode available */}
              {panelMode && (
                <>
                  <div className="w-px h-6 bg-gray-700/50 mx-1" />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsePanel(false)}
                      className={`h-7 px-2 rounded-lg border text-xs font-medium transition-all ${
                        !usePanel 
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                          : 'bg-gray-800/30 border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                      }`}
                      title="Expression mode"
                    >
                      <span className="text-sm mr-1">Σ</span>
                      <span>Expression</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsePanel(true)}
                      className={`h-7 px-2 rounded-lg border text-xs font-medium transition-all ${
                        usePanel 
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                          : 'bg-gray-800/30 border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                      }`}
                      title="Panel mode"
                    >
                      <span className="text-sm mr-1">◎</span>
                      <span>Panel</span>
                    </Button>
                  </div>
                </>
              )}

              {/* Main Input/Controls Area */}
              {!effectivePanelMode ? (
                <div className="flex-1 relative ml-2">
                  {/* Input field with proper cursor positioning */}
                  <Input
                    ref={inputRef}
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="Enter boolean expression (e.g., A ∪ B - C)"
                    className="w-full h-7 bg-gray-800/50 border-gray-600/50 text-gray-100 text-sm rounded-lg caret-white relative z-30 font-sans transition-all duration-200 focus:outline-none focus:ring-0 focus:border-blue-500/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:border-gray-500/70 placeholder:text-gray-500"
                    style={{ 
                      color: expression ? 'transparent' as any : undefined,
                      caretColor: 'white',
                      letterSpacing: 'normal',
                      lineHeight: '1.25rem',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  />
                  
                  {/* Visual overlay with syntax highlighting */}
                  {expression && (
                    <div 
                      className="absolute inset-0 pointer-events-none flex items-center text-sm z-20 font-sans px-3"
                      style={{ 
                        letterSpacing: 'normal',
                        lineHeight: '1.25rem'
                      }}
                    >
                      {renderExpressionWithPills()}
                    </div>
                  )}
                  
                  {/* Syntax validation indicator */}
                  {syntaxErrors.length > 0 && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-400 z-30">
                      <span className="text-xs">⚠</span>
                    </div>
                  )}
                  
                  {/* Auto-complete suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 bg-gray-900/95 border border-gray-600/60 rounded-lg shadow-xl z-50 w-full max-h-32 overflow-y-auto backdrop-blur-sm">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => insertStructure(suggestion)}
                          className="w-full text-left px-3 py-1 text-sm text-gray-100 hover:bg-blue-900/30 first:rounded-t-lg last:rounded-b-lg transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 ml-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-gray-800/40 border border-gray-600/50 px-2 py-1 rounded-lg">
                      <span className="text-[11px] text-gray-300">From</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full border border-gray-500/50" style={{ backgroundColor: getStructureColor(aName || '') }} />
                        <select className="bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={aName} onChange={e => setAName(e.target.value)}>
                          <option value="">Select A…</option>
                          {names.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="mx-1 p-1 rounded hover:bg-gray-700/50 text-gray-300 hover:text-gray-100 transition-colors"
                        title="Swap A and B"
                        onClick={() => { const a = aName; setAName(bName); setBName(a); }}
                      >
                        <ArrowLeftRight size={14} />
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full border border-gray-500/50" style={{ backgroundColor: getStructureColor(bName || '') }} />
                        <select className="bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={bName} onChange={e => setBName(e.target.value)}>
                          <option value="">Select B…</option>
                          {names.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-800/40 border border-gray-600/50 px-2 py-1 rounded-lg">
                      <span className="text-[11px] text-gray-300">Operation</span>
                      <select className="bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={op} onChange={e => setOp(e.target.value as BooleanOp)}>
                        <option value="union">Union (∪)</option>
                        <option value="intersect">Intersect (∩)</option>
                        <option value="subtract">Subtract (−)</option>
                        <option value="xor">XOR (⊕)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseWithConfirmation}
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg ml-2"
              title="Close panel"
            >
              <X size={14} />
            </Button>
          </div>

          <Separator className="my-2 bg-gray-800/50" />

          {/* Second Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              {!effectivePanelMode ? (
                <>
                  {/* Operator buttons */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertText(' ∪ ')}
                    className="h-7 px-2 bg-green-900/30 border-2 border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all"
                    title="Union"
                  >
                    <span className="text-xs font-medium mr-1">∪</span>
                    <span className="text-xs font-medium">Union</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertText(' ∩ ')}
                    className="h-7 px-2 bg-blue-900/30 border-2 border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all"
                    title="Intersect"
                  >
                    <span className="text-xs font-medium mr-1">∩</span>
                    <span className="text-xs font-medium">Intersect</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertText(' - ')}
                    className="h-7 px-2 bg-red-900/30 border-2 border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all"
                    title="Subtract"
                  >
                    <span className="text-xs font-medium mr-1">−</span>
                    <span className="text-xs font-medium">Subtract</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertText(' ⊕ ')}
                    className="h-7 px-2 bg-purple-900/30 border-2 border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all"
                    title="XOR"
                  >
                    <span className="text-xs font-medium mr-1">⊕</span>
                    <span className="text-xs font-medium">XOR</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { 
                      insertText('(');
                      requestAnimationFrame(() => {
                        const input = inputRef.current;
                        if (input) {
                          const pos = input.selectionStart || 0;
                          const value = input.value;
                          const newValue = value.slice(0, pos) + ')' + value.slice(pos);
                          setExpression(newValue);
                          requestAnimationFrame(() => {
                            input.focus();
                            input.setSelectionRange(pos, pos);
                          });
                        }
                      });
                    }}
                    className="h-7 px-2 bg-yellow-900/30 border-2 border-yellow-400/60 text-yellow-200 hover:text-yellow-100 hover:bg-yellow-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all"
                    title="Parentheses"
                  >
                    <span className="text-xs font-medium mr-1">( )</span>
                    <span className="text-xs font-medium">Group</span>
                  </Button>
                  
                  {/* Vertical divider */}
                  <div className="h-6 w-px bg-gray-700/50 mx-1" />
                  
                  {/* Output related buttons */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!expression.includes('=')) {
                        setExpression(expression + ' = ');
                      }
                    }}
                    disabled={expression.includes('=')}
                    className="h-7 px-2 bg-orange-900/30 border-2 border-orange-400/60 text-orange-200 hover:text-orange-100 hover:bg-orange-800/40 rounded-lg backdrop-blur-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    title="Add output assignment"
                  >
                    = Output
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewStructurePanel(!showNewStructurePanel)}
                    disabled={!expression.includes('=')}
                    className={`h-7 px-2 rounded-lg backdrop-blur-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                      showNewStructurePanel
                        ? 'bg-purple-900/30 border-2 border-purple-400/60 text-purple-200 hover:text-purple-100 hover:bg-purple-800/40'
                        : 'bg-gray-800/30 border-2 border-gray-600/50 text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }`}
                    title={!expression.includes('=') ? "Add '=' to create new structures" : "Create new structure"}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span className="text-xs font-medium">New</span>
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-gray-800/40 border border-gray-600/50 px-2 py-1 rounded-lg">
                    <span className="text-[11px] text-gray-300">Output</span>
                    <div className="inline-flex rounded-md border border-gray-600/50 overflow-hidden">
                      <button type="button" onClick={() => setOutMode('existing')} className={`px-2 h-7 text-[11px] transition-colors ${outMode === 'existing' ? 'bg-blue-600/20 text-blue-300 border-r border-gray-600/50' : 'bg-transparent text-gray-400 hover:bg-gray-700/50'}`}>Existing</button>
                      <button type="button" onClick={() => setOutMode('new')} className={`px-2 h-7 text-[11px] transition-colors ${outMode === 'new' ? 'bg-blue-600/20 text-blue-300' : 'bg-transparent text-gray-400 hover:bg-gray-700/50'}`}>New</button>
                    </div>
                    {outMode === 'existing' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full border border-gray-500/50" style={{ backgroundColor: getStructureColor(outExistingName || '') }} />
                        <select className="bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded focus:outline-none focus:border-blue-500/60" value={outExistingName} onChange={e => setOutExistingName(e.target.value)}>
                          <option value="">Select output…</option>
                          {names.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input className="bg-gray-800/50 border border-gray-600/50 text-gray-100 text-xs h-7 rounded px-2 focus:outline-none focus:border-blue-500/60 placeholder:text-gray-500" value={outName} onChange={e => setOutName(e.target.value)} placeholder="New structure name" />
                        <div className="flex items-center gap-1">
                          <input type="color" value={outColor} onChange={e => setOutColor(e.target.value)} className="h-7 w-8 rounded border border-gray-600/50" />
                          <span className="text-[10px] text-gray-400">Color</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons - Right side */}
            <div className="flex items-center space-x-2">
              {/* Superstructure Auto-Update Toggle */}
              <div className="relative group">
                <div
                  onClick={() => setSaveAsSuperstructure(!saveAsSuperstructure)}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg transition-all duration-200 border cursor-pointer ${
                    saveAsSuperstructure
                      ? 'bg-purple-600/30 border-purple-400/70 text-purple-100 shadow-sm'
                      : 'bg-purple-900/20 border-purple-500/30 text-purple-300 hover:bg-purple-800/30 hover:border-purple-400/50'
                  }`}
                >
                  <Switch
                    checked={saveAsSuperstructure}
                    onCheckedChange={setSaveAsSuperstructure}
                    className="scale-75"
                  />
                  <span className="text-xs font-medium whitespace-nowrap">
                    Auto-Update
                  </span>
                </div>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg max-w-xs text-center z-50">
                  Save as superstructure to enable auto-regeneration when source structures change
                </div>
              </div>

              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 px-2 bg-red-900/30 border-2 border-red-400/60 text-red-200 hover:text-red-100 hover:bg-red-800/40 rounded-lg backdrop-blur-sm shadow-sm text-xs transition-all"
                >
                  Clear
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Clear expression
                </div>
              </div>
              
              <div className="h-6 w-px bg-gray-700/50" />
              
              {/* Preview button */}
              {effectivePanelMode && (
                <div className="relative group">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isPanelReady) {
                        // Clear previous preview timeout
                        if (previewTimeoutRef.current) {
                          clearTimeout(previewTimeoutRef.current);
                        }
                        
                        // Toggle preview state
                        const newPreviewState = !isPreviewActive;
                        
                        if (newPreviewState) {
                          // Start preview
                          hasAutoPreviewedRef.value = true; // Mark as manually previewed
                          runPanel(true);
                        } else {
                          // Clear preview
                          hasAutoPreviewedRef.value = false; // Allow auto-preview again
                          onPreview?.({ name: '', color: [0, 0, 0] }, []);
                          setIsPreviewActive(false);
                          onPreviewStateChange?.({ targetName: '', isNewStructure: false });
                        }
                      }
                    }}
                    disabled={!isPanelReady}
                    className={`h-7 px-2 rounded-lg backdrop-blur-sm shadow-sm border text-xs font-medium transition-all ${
                      isPreviewActive 
                        ? 'bg-yellow-600/60 border-yellow-400 text-yellow-100 hover:bg-yellow-500/70' 
                        : isPanelReady && !isPreviewActive && !hasAutoPreviewedRef.value
                        ? 'bg-yellow-500/40 border-yellow-300 text-yellow-100 hover:bg-yellow-400/50 animate-pulse'
                        : 'bg-yellow-900/30 border-yellow-400/60 text-yellow-200 hover:text-yellow-100 hover:bg-yellow-800/40'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Eye className={`w-3 h-3 mr-1 ${isPreviewActive ? 'animate-pulse' : ''}`} />
                    <span>{isPreviewActive ? 'Clear' : 'Preview'}</span>
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    {isPreviewActive ? "Clear preview" : "Preview operation"}
                  </div>
                </div>
              )}
              
              {/* Save to Templates */}
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveTemplateDialog(true)}
                  disabled={effectivePanelMode ? !isPanelReady : !expression.trim()}
                  className="h-7 px-2 bg-blue-900/30 border-2 border-blue-400/60 text-blue-200 hover:text-blue-100 hover:bg-blue-800/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm shadow-sm transition-all"
                >
                  <Save className="w-3 h-3 mr-1" />
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
                  <Library className="w-3 h-3 mr-1" />
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
                                  {template.expression ? (
                                    <span className="font-mono bg-gray-900/50 px-1.5 py-0.5 rounded truncate block">
                                      {template.expression}
                                    </span>
                                  ) : template.panelConfig ? (
                                    <span className="flex items-center gap-1">
                                      <span className="text-purple-300">{template.panelConfig.aName}</span>
                                      <span className="text-gray-500">
                                        {template.panelConfig.op === 'union' ? '∪' : template.panelConfig.op === 'intersect' ? '∩' : template.panelConfig.op === 'subtract' ? '−' : '⊕'}
                                      </span>
                                      <span className="text-purple-300">{template.panelConfig.bName}</span>
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    loadTemplate(template);
                                    setShowTemplateLibrary(false);
                                  }}
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
              
              <div className="h-6 w-px bg-gray-700/50" />
              
              {/* Apply Button */}
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (effectivePanelMode) {
                      runPanel(false);
                    } else {
                      handleExecute();
                    }
                  }}
                  disabled={effectivePanelMode ? (busy || !isPanelReady) : (!expression.trim() || syntaxErrors.length > 0)}
                  className="h-7 px-3 bg-green-600/20 border-2 border-green-500/50 text-green-300 hover:text-green-200 hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm shadow-sm transition-all"
                >
                  <Play className="w-3 h-3 mr-1" />
                  <span className="text-xs font-medium">{effectivePanelMode ? (busy ? 'Applying...' : 'Apply') : 'Apply'}</span>
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Apply operation
                </div>
              </div>
            </div>
          </div>

          {/* New Structure Panel */}
          {showNewStructurePanel && (
            <div className="mt-2 p-3 bg-purple-900/20 border border-purple-400/40 rounded-lg">
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">New Structure Name</label>
                  <Input
                    value={newStructureName}
                    onChange={(e) => setNewStructureName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newStructureName.trim()) {
                        // Add the new structure name to the expression
                        insertText(newStructureName.trim());
                        setNewStructureName('');
                        setShowNewStructurePanel(false);
                        inputRef.current?.focus();
                      }
                    }}
                    placeholder="e.g. CombinedStructure"
                    className="w-full h-8 bg-gray-800/50 border-gray-600/50 text-gray-100 text-sm rounded-lg backdrop-blur-sm placeholder:text-gray-500 focus:border-purple-400/60"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newStructureName.trim()) {
                          insertText(newStructureName.trim());
                          setNewStructureName('');
                          setShowNewStructurePanel(false);
                          inputRef.current?.focus();
                        }
                      }}
                      className="h-7 px-2 bg-purple-800/40 border-purple-400/60 text-purple-200 hover:bg-purple-700/40 rounded-md transition-all"
                    >
                      Insert
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-gray-300">Color:</label>
                  <input
                    type="color"
                    value={newStructureColor}
                    onChange={(e) => setNewStructureColor(e.target.value)}
                    className="h-8 w-16 rounded cursor-pointer bg-gray-800/50 border border-gray-600/50"
                  />
                  <span className="text-xs text-gray-400">{newStructureColor}</span>
                </div>
              </div>
            </div>
          )}

          {/* Instructions Panel */}
          {showInstructions && (
            <div className="mt-2 p-3 bg-gray-900/80 border border-gray-700/50 rounded-lg text-xs text-gray-300">
              <div className="space-y-1">
                <div>• Type structure names to see suggestions</div>
                <div>• Use boolean operators: ∪ (union), ∩ (intersect), - (subtract), ⊕ (XOR)</div>
                <div>• Example: Parotid_L ∪ Parotid_R - SpinalCord</div>
              </div>
            </div>
          )}
          
          {/* Save Template Dialog */}
          {showSaveTemplateDialog && (
            <div className="mt-2 p-3 bg-blue-900/20 border border-blue-400/40 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-200 font-semibold">Save as Template</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSaveTemplateDialog(false);
                      setTemplateName('');
                    }}
                    className="h-5 w-5 p-0 text-gray-400 hover:text-gray-200"
                  >
                    <X size={12} />
                  </Button>
                </div>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && templateName.trim()) {
                      saveTemplate();
                    }
                  }}
                  placeholder="Template name..."
                  className="w-full h-8 bg-gray-800/50 border-gray-600/50 text-gray-100 text-sm rounded-lg backdrop-blur-sm placeholder:text-gray-500 focus:border-blue-400/60"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveTemplate}
                    disabled={!templateName.trim()}
                    className="h-7 px-3 bg-blue-800/40 border-blue-400/60 text-blue-200 hover:bg-blue-700/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all"
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSaveTemplateDialog(false);
                      setTemplateName('');
                    }}
                    className="h-7 px-3 bg-gray-800/40 border-gray-600/50 text-gray-300 hover:bg-gray-700/40 rounded-md transition-all"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}