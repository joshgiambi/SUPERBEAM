/**
 * Margin Operations Prototype
 * 
 * Prototype for uniform and anisotropic margin operations
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Play,
  X,
  Expand,
  RotateCw,
  Maximize2,
  Minimize2,
  Save,
  Library,
  Trash2
} from 'lucide-react';

interface MarginOperationsPrototypeProps {
  availableStructures?: string[];
  onExecute?: (operation: {
    type: 'uniform' | 'anisotropic';
    structureName: string;
    parameters: any;
    outputName: string;
    outputColor: string;
    direction?: 'expand' | 'shrink';
    saveAsSuperstructure?: boolean; // If true, create superstructure for auto-update
    outputMode: 'new' | 'same'; // 'new' creates new structure, 'same' updates existing
  }) => void;
  onClose?: () => void;
}

export function MarginOperationsPrototype({ 
  availableStructures = ['CTV', 'GTV', 'BODY', 'SpinalCord', 'Parotid_L', 'Parotid_R', 'Mandible'],
  onExecute,
  onClose
}: MarginOperationsPrototypeProps) {
  
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [operationType, setOperationType] = useState<'uniform' | 'anisotropic'>('uniform');
  const [marginDirection, setMarginDirection] = useState<'expand' | 'shrink'>('expand');
  
  // Uniform margin parameters
  const [uniformMargin, setUniformMargin] = useState(5);
  
  // Anisotropic margin parameters (6 directions)
  const [anisotropicMargins, setAnisotropicMargins] = useState({
    left: 5,      // X-
    right: 5,     // X+
    anterior: 5, // Y-
    posterior: 5,// Y+
    superior: 5, // Z-
    inferior: 5  // Z+
  });
  
  // Output configuration
  const [outputMode, setOutputMode] = useState<'new' | 'same'>('new');
  const [outputName, setOutputName] = useState('PTV');
  const [outputColor, setOutputColor] = useState('#FF6B6B');
  const [saveAsSuperstructure, setSaveAsSuperstructure] = useState(false);
  
  // Template management
  interface MarginTemplate {
    id: string;
    name: string;
    selectedStructure: string;
    operationType: 'uniform' | 'anisotropic';
    marginDirection: 'expand' | 'shrink';
    uniformMargin?: number;
    anisotropicMargins?: {
      left: number;
      right: number;
      anterior: number;
      posterior: number;
      superior: number;
      inferior: number;
    };
    outputName: string;
    outputColor: string;
    saveAsSuperstructure: boolean;
    createdAt: number;
  }
  
  const [templates, setTemplates] = useState<MarginTemplate[]>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
  // Load templates from localStorage on mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('marginOperationsTemplates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to load margin templates:', e);
      }
    }
  }, []);
  
  // Save templates to localStorage whenever they change
  useEffect(() => {
    if (templates.length > 0) {
      localStorage.setItem('marginOperationsTemplates', JSON.stringify(templates));
    } else {
      localStorage.removeItem('marginOperationsTemplates');
    }
  }, [templates]);
  
  const handleExecute = () => {
    if (!selectedStructure) return;
    // Only require outputName if creating new structure
    if (outputMode === 'new' && !outputName) return;
    
    const parameters = operationType === 'uniform' 
      ? { margin: marginDirection === 'expand' ? uniformMargin : -uniformMargin }
      : { 
          left: marginDirection === 'expand' ? anisotropicMargins.left : -anisotropicMargins.left,
          right: marginDirection === 'expand' ? anisotropicMargins.right : -anisotropicMargins.right,
          anterior: marginDirection === 'expand' ? anisotropicMargins.anterior : -anisotropicMargins.anterior,
          posterior: marginDirection === 'expand' ? anisotropicMargins.posterior : -anisotropicMargins.posterior,
          superior: marginDirection === 'expand' ? anisotropicMargins.superior : -anisotropicMargins.superior,
          inferior: marginDirection === 'expand' ? anisotropicMargins.inferior : -anisotropicMargins.inferior
        };
    
    onExecute?.({
      type: operationType,
      structureName: selectedStructure,
      parameters,
      outputName: outputMode === 'same' ? selectedStructure : outputName,
      outputColor,
      direction: marginDirection,
      saveAsSuperstructure: outputMode === 'new' ? saveAsSuperstructure : false, // Only for new structures
      outputMode
    });
  };

  const isValid = selectedStructure && 
    (outputMode === 'same' || outputName) && 
    (operationType === 'uniform' ? uniformMargin > 0 : 
     anisotropicMargins.left > 0 || anisotropicMargins.right > 0 || 
     anisotropicMargins.anterior > 0 || anisotropicMargins.posterior > 0 ||
     anisotropicMargins.superior > 0 || anisotropicMargins.inferior > 0);

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    
    const template: MarginTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      selectedStructure,
      operationType,
      marginDirection,
      uniformMargin: operationType === 'uniform' ? uniformMargin : undefined,
      anisotropicMargins: operationType === 'anisotropic' ? { ...anisotropicMargins } : undefined,
      outputName,
      outputColor,
      saveAsSuperstructure,
      createdAt: Date.now()
    };
    
    setTemplates([...templates, template]);
    setTemplateName('');
    setShowSaveTemplateDialog(false);
  };

  const loadTemplate = (template: MarginTemplate) => {
    setSelectedStructure(template.selectedStructure);
    setOperationType(template.operationType);
    setMarginDirection(template.marginDirection);
    if (template.uniformMargin !== undefined) {
      setUniformMargin(template.uniformMargin);
    }
    if (template.anisotropicMargins) {
      setAnisotropicMargins(template.anisotropicMargins);
    }
    setOutputName(template.outputName);
    setOutputColor(template.outputColor);
    setSaveAsSuperstructure(template.saveAsSuperstructure);
    setShowTemplateLibrary(false);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  return (
    <div className="backdrop-blur-xl border border-gray-600/60 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 bg-gray-950/90">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <Expand className="w-4 h-4 text-blue-400" />
          <span className="text-gray-100 text-sm font-semibold">Margin</span>
        </div>
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
      </div>

      {/* Layout - Controls on first line, output on second line */}
      <div className="space-y-2">
        {/* First Row - Controls and Margin Parameters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Structure Selection */}
          <select
            value={selectedStructure}
            onChange={(e) => setSelectedStructure(e.target.value)}
            className="bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded-lg focus:outline-none focus:border-blue-500/60 min-w-[120px]"
          >
            <option value="">Structure...</option>
            {availableStructures.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <div className="h-5 w-px bg-gray-700/50" />

          {/* Operation Type Selection */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOperationType('uniform')}
              className={`h-7 px-2 rounded-lg transition-all text-xs ${
                operationType === 'uniform'
                  ? 'bg-blue-600/20 border-[0.5px] border-blue-500/50 text-blue-300'
                  : 'bg-gray-800/30 border-[0.5px] border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              Uniform
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOperationType('anisotropic')}
              className={`h-7 px-2 rounded-lg transition-all text-xs ${
                operationType === 'anisotropic'
                  ? 'bg-blue-600/20 border-[0.5px] border-blue-500/50 text-blue-300'
                  : 'bg-gray-800/30 border-[0.5px] border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              Anisotropic
            </Button>
          </div>

          <div className="h-5 w-px bg-gray-700/50" />

          {/* Expand/Shrink Toggle */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMarginDirection('expand')}
              className={`h-7 px-2 rounded-lg transition-all text-xs ${
                marginDirection === 'expand'
                  ? 'bg-green-600/20 border-[0.5px] border-green-500/50 text-green-300'
                  : 'bg-gray-800/30 border-[0.5px] border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
              title="Expand margin outward"
            >
              <Maximize2 className="w-3 h-3 mr-1" />
              Expand
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMarginDirection('shrink')}
              className={`h-7 px-2 rounded-lg transition-all text-xs ${
                marginDirection === 'shrink'
                  ? 'bg-orange-600/20 border-[0.5px] border-orange-500/50 text-orange-300'
                  : 'bg-gray-800/30 border-[0.5px] border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
              title="Shrink margin inward"
            >
              <Minimize2 className="w-3 h-3 mr-1" />
              Shrink
            </Button>
          </div>

          <div className="h-5 w-px bg-gray-700/50" />

          {/* Margin Parameters - Inline */}
          {operationType === 'uniform' ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={uniformMargin}
                onChange={(e) => setUniformMargin(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.1"
                className="w-16 bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded-lg focus:outline-none focus:border-blue-500/60"
              />
              <span className="text-xs text-gray-400">mm</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* X-axis: Left/Right */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={anisotropicMargins.left}
                  onChange={(e) => setAnisotropicMargins({ ...anisotropicMargins, left: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.1"
                  placeholder="L"
                  className="w-12 bg-blue-900/30 border-[0.5px] border-blue-500/50 text-blue-200 text-xs h-7 px-1.5 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/50 placeholder:text-blue-400/50"
                  title="Left (X-)"
                />
                <span className="text-[10px] text-blue-300 font-semibold min-w-[14px]">L</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={anisotropicMargins.right}
                  onChange={(e) => setAnisotropicMargins({ ...anisotropicMargins, right: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.1"
                  placeholder="R"
                  className="w-12 bg-orange-900/30 border-[0.5px] border-orange-500/50 text-orange-200 text-xs h-7 px-1.5 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-500/50 placeholder:text-orange-400/50"
                  title="Right (X+)"
                />
                <span className="text-[10px] text-orange-300 font-semibold min-w-[14px]">R</span>
              </div>
              
              {/* Y-axis: Anterior/Posterior */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={anisotropicMargins.anterior}
                  onChange={(e) => setAnisotropicMargins({ ...anisotropicMargins, anterior: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.1"
                  placeholder="A"
                  className="w-12 bg-green-900/30 border-[0.5px] border-green-500/50 text-green-200 text-xs h-7 px-1.5 rounded-lg focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-500/50 placeholder:text-green-400/50"
                  title="Anterior (Y-)"
                />
                <span className="text-[10px] text-green-300 font-semibold min-w-[14px]">A</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={anisotropicMargins.posterior}
                  onChange={(e) => setAnisotropicMargins({ ...anisotropicMargins, posterior: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.1"
                  placeholder="P"
                  className="w-12 bg-purple-900/30 border-[0.5px] border-purple-500/50 text-purple-200 text-xs h-7 px-1.5 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-500/50 placeholder:text-purple-400/50"
                  title="Posterior (Y+)"
                />
                <span className="text-[10px] text-purple-300 font-semibold min-w-[14px]">P</span>
              </div>
              
              {/* Z-axis: Superior/Inferior */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={anisotropicMargins.superior}
                  onChange={(e) => setAnisotropicMargins({ ...anisotropicMargins, superior: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.1"
                  placeholder="S"
                  className="w-12 bg-cyan-900/30 border-[0.5px] border-cyan-500/50 text-cyan-200 text-xs h-7 px-1.5 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/50 placeholder:text-cyan-400/50"
                  title="Superior (Z-)"
                />
                <span className="text-[10px] text-cyan-300 font-semibold min-w-[14px]">S</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={anisotropicMargins.inferior}
                  onChange={(e) => setAnisotropicMargins({ ...anisotropicMargins, inferior: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.1"
                  placeholder="I"
                  className="w-12 bg-yellow-900/30 border-[0.5px] border-yellow-500/50 text-yellow-200 text-xs h-7 px-1.5 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-500/50 placeholder:text-yellow-400/50"
                  title="Inferior (Z+)"
                />
                <span className="text-[10px] text-yellow-300 font-semibold min-w-[14px]">I</span>
              </div>
              
              <span className="text-xs text-gray-400 ml-0.5">mm</span>
            </div>
          )}
        </div>

        {/* Second Row - Output Configuration */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-gray-800/50">
          {/* Left side - Output controls */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <span className="text-xs text-gray-400 font-medium">Output:</span>
            
            {/* New vs Same Structure Toggle */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOutputMode('new')}
                className={`h-7 px-2 rounded-lg transition-all text-xs ${
                  outputMode === 'new'
                    ? 'bg-blue-600/20 border-[0.5px] border-blue-500/50 text-blue-300'
                    : 'bg-gray-800/30 border-[0.5px] border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }`}
              >
                New
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOutputMode('same')}
                className={`h-7 px-2 rounded-lg transition-all text-xs ${
                  outputMode === 'same'
                    ? 'bg-amber-600/20 border-[0.5px] border-amber-500/50 text-amber-300'
                    : 'bg-gray-800/30 border-[0.5px] border-gray-600/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }`}
              >
                Same
              </Button>
            </div>
            
            {outputMode === 'new' && (
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="Name"
                className="min-w-[150px] bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-sm h-8 px-3 rounded-lg focus:outline-none focus:border-blue-500/60 placeholder:text-gray-500"
              />
            )}
            
            {/* Color Picker - Styled like Boolean Toolbar */}
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
                  title="Color"
                />
                <input
                  type="color"
                  value={outputColor}
                  onChange={(e) => setOutputColor(e.target.value)}
                  className="absolute opacity-0 w-0 h-0 pointer-events-none"
                  id={`color-picker-margin-${outputName}`}
                />
                <span className="text-xs text-gray-300 font-medium">Color</span>
              </div>
              <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-900/95 border border-gray-600/60 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                Click to change color
              </div>
            </div>

            {/* Save as Superstructure Switch - only show for new structures */}
            {outputMode === 'new' && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg transition-all duration-200">
                <Switch
                  checked={saveAsSuperstructure}
                  onCheckedChange={setSaveAsSuperstructure}
                  className="data-[state=checked]:bg-cyan-600 data-[state=unchecked]:bg-gray-700 border-cyan-700"
                />
                <span className="text-xs font-medium text-cyan-200">Auto-update</span>
              </div>
            )}
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
                        <p className="text-[10px] mt-1 text-gray-500">Save margin operations to reuse them</p>
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
                                {template.selectedStructure} • {template.operationType === 'uniform' ? 'Uniform' : 'Anisotropic'} • {template.marginDirection}
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

            {/* Apply button */}
            <Button
              onClick={handleExecute}
              disabled={!isValid}
              className="h-7 px-3 bg-green-900/30 border-[0.5px] border-green-400/60 text-green-200 hover:text-green-100 hover:bg-green-800/40 rounded-lg backdrop-blur-sm shadow-sm transition-all text-xs font-medium disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Apply
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

