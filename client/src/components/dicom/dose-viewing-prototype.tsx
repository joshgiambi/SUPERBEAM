/**
 * Dose Viewing Prototype
 * 
 * UI prototypes for enhanced RT Dose visualization features based on MIM Software standards.
 * Features: DVH viewer, dose unit toggle, display modes, isodose presets, BED calculator, etc.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Activity,
  Eye,
  EyeOff,
  Layers,
  Settings,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Save,
  Trash2,
  RotateCcw,
  Target,
  Crosshair,
  BarChart3,
  Calculator,
  Scissors,
  Grid3X3,
  PaintBucket,
  LineChart,
  Square,
  Palette,
  Check,
  X,
  Info,
  Download,
  Upload,
  Copy,
  RefreshCw,
  Maximize2,
  ZoomIn
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type DoseColormap = 'rainbow' | 'hot' | 'jet' | 'cool' | 'dosimetry' | 'grayscale';
type DoseUnit = 'Gy' | 'cGy';
type DisplayMode = 'lines_only' | 'colorwash_only' | 'lines_and_colorwash' | 'banded_with_lines';
type NormalizationSource = 'prescription' | 'max_dose' | 'user_entered' | 'point_dose';

interface IsodoseLevel {
  percentage: number;
  absoluteValue?: number;
  color: string;
  lineWidth: number;
  visible: boolean;
}

interface IsodosePreset {
  id: string;
  name: string;
  isDefault: boolean;
  levels: IsodoseLevel[];
}

interface DVHStructure {
  id: number;
  name: string;
  color: string;
  selected: boolean;
  volumeCc: number;
  statistics: {
    min: number;
    max: number;
    mean: number;
    d95: number;
    d50: number;
    v100: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORMAP_OPTIONS: { value: DoseColormap; label: string; colors: string[] }[] = [
  { value: 'rainbow', label: 'Rainbow', colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff8800', '#ff0000'] },
  { value: 'hot', label: 'Hot', colors: ['#1a0000', '#cc0000', '#ff8800', '#ffffff'] },
  { value: 'jet', label: 'Jet', colors: ['#000080', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000', '#800000'] },
  { value: 'cool', label: 'Cool', colors: ['#00ffff', '#8080ff', '#c840ff', '#ff00ff'] },
  { value: 'dosimetry', label: 'Dosimetry', colors: ['#0000b4', '#00b4ff', '#00ff00', '#ffff00', '#ff8800', '#ff0000', '#ff0080'] },
  { value: 'grayscale', label: 'Grayscale', colors: ['#282828', '#808080', '#ffffff'] },
];

const DISPLAY_MODE_OPTIONS: { value: DisplayMode; label: string; icon: React.ReactNode }[] = [
  { value: 'lines_only', label: 'Lines Only', icon: <LineChart className="w-4 h-4" /> },
  { value: 'colorwash_only', label: 'Color Wash', icon: <PaintBucket className="w-4 h-4" /> },
  { value: 'lines_and_colorwash', label: 'Lines + Wash', icon: <Layers className="w-4 h-4" /> },
  { value: 'banded_with_lines', label: 'Banded', icon: <Grid3X3 className="w-4 h-4" /> },
];

const DEFAULT_ISODOSE_LEVELS: IsodoseLevel[] = [
  { percentage: 107, color: '#ff0080', lineWidth: 2, visible: true },
  { percentage: 105, color: '#ff0000', lineWidth: 2, visible: true },
  { percentage: 100, color: '#ff8800', lineWidth: 2, visible: true },
  { percentage: 95, color: '#ffff00', lineWidth: 2, visible: true },
  { percentage: 90, color: '#00ff00', lineWidth: 2, visible: true },
  { percentage: 80, color: '#00ffff', lineWidth: 2, visible: true },
  { percentage: 70, color: '#0088ff', lineWidth: 2, visible: true },
  { percentage: 50, color: '#0000ff', lineWidth: 1, visible: true },
  { percentage: 30, color: '#8800ff', lineWidth: 1, visible: true },
];

const SAMPLE_PRESETS: IsodosePreset[] = [
  { id: 'eclipse-standard', name: 'Eclipse Standard', isDefault: true, levels: DEFAULT_ISODOSE_LEVELS },
  { id: 'high-dose', name: 'High Dose (SBRT)', isDefault: false, levels: [
    { percentage: 120, color: '#ffffff', lineWidth: 2, visible: true },
    { percentage: 115, color: '#ff00ff', lineWidth: 2, visible: true },
    { percentage: 110, color: '#ff0080', lineWidth: 2, visible: true },
    { percentage: 105, color: '#ff0000', lineWidth: 2, visible: true },
    { percentage: 100, color: '#ff8800', lineWidth: 2, visible: true },
    { percentage: 95, color: '#ffff00', lineWidth: 2, visible: true },
    { percentage: 80, color: '#00ff00', lineWidth: 2, visible: true },
    { percentage: 50, color: '#0000ff', lineWidth: 1, visible: true },
  ]},
  { id: 'brachy', name: 'Brachytherapy', isDefault: false, levels: [
    { percentage: 200, color: '#ffffff', lineWidth: 2, visible: true },
    { percentage: 150, color: '#ff0000', lineWidth: 2, visible: true },
    { percentage: 100, color: '#ff8800', lineWidth: 2, visible: true },
    { percentage: 75, color: '#ffff00', lineWidth: 2, visible: true },
    { percentage: 50, color: '#00ff00', lineWidth: 2, visible: true },
  ]},
];

const SAMPLE_DVH_STRUCTURES: DVHStructure[] = [
  { id: 1, name: 'PTV_70', color: '#ff0000', selected: true, volumeCc: 125.3, statistics: { min: 65.2, max: 74.1, mean: 70.5, d95: 68.9, d50: 70.3, v100: 98.2 } },
  { id: 2, name: 'CTV_70', color: '#ff8800', selected: true, volumeCc: 89.7, statistics: { min: 66.1, max: 73.8, mean: 70.8, d95: 69.4, d50: 70.6, v100: 99.1 } },
  { id: 3, name: 'Parotid_L', color: '#00ff00', selected: true, volumeCc: 28.4, statistics: { min: 2.1, max: 45.2, mean: 24.8, d95: 5.2, d50: 23.1, v100: 0 } },
  { id: 4, name: 'Parotid_R', color: '#00ffff', selected: true, volumeCc: 31.2, statistics: { min: 1.8, max: 42.1, mean: 22.3, d95: 4.1, d50: 20.8, v100: 0 } },
  { id: 5, name: 'Spinal_Cord', color: '#0000ff', selected: true, volumeCc: 45.6, statistics: { min: 0.5, max: 38.2, mean: 15.4, d95: 2.1, d50: 12.3, v100: 0 } },
  { id: 6, name: 'Brain_Stem', color: '#8800ff', selected: false, volumeCc: 23.1, statistics: { min: 0.3, max: 28.1, mean: 8.2, d95: 1.2, d50: 6.8, v100: 0 } },
  { id: 7, name: 'Mandible', color: '#ff00ff', selected: false, volumeCc: 67.8, statistics: { min: 5.2, max: 68.5, mean: 35.2, d95: 8.1, d50: 32.4, v100: 0 } },
];

// ============================================================================
// SECTION 1: DOSE CONTROL PANEL (Enhanced)
// ============================================================================
// Location: Bottom-left of viewport, floating panel (similar to current)

function DoseControlPanelPrototype() {
  const [doseUnit, setDoseUnit] = useState<DoseUnit>('Gy');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('lines_and_colorwash');
  const [colormap, setColormap] = useState<DoseColormap>('rainbow');
  const [opacity, setOpacity] = useState(0.5);
  const [isVisible, setIsVisible] = useState(true);
  const [showValuesOnLines, setShowValuesOnLines] = useState(false);
  const [normalizationValue, setNormalizationValue] = useState(70);
  const [normalizationSource, setNormalizationSource] = useState<NormalizationSource>('prescription');
  const [expanded, setExpanded] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('eclipse-standard');
  const [isodoseLevels, setIsodoseLevels] = useState(DEFAULT_ISODOSE_LEVELS);

  const formatDose = (value: number) => {
    if (doseUnit === 'cGy') {
      return `${(value * 100).toFixed(0)} cGy`;
    }
    return `${value.toFixed(1)} Gy`;
  };

  return (
    <Card className="w-[360px] bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <CardTitle className="text-sm font-semibold text-white">RT Dose</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-400 border-orange-500/30">
              Plan A
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsVisible(!isVisible)}
            >
              {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 px-4 pb-4">
          {/* Dose Unit Toggle - NEW */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-400">Dose Unit</Label>
            <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
              <button
                onClick={() => setDoseUnit('Gy')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  doseUnit === 'Gy'
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                Gy
              </button>
              <button
                onClick={() => setDoseUnit('cGy')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  doseUnit === 'cGy'
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                cGy
              </button>
            </div>
          </div>

          {/* Display Mode - NEW */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Display Mode</Label>
            <div className="grid grid-cols-4 gap-1">
              {DISPLAY_MODE_OPTIONS.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setDisplayMode(mode.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-[10px]",
                    displayMode === mode.value
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 border border-transparent"
                  )}
                  title={mode.label}
                >
                  {mode.icon}
                  <span className="truncate w-full text-center">{mode.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Colormap Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Colormap</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {COLORMAP_OPTIONS.map((cm) => (
                <button
                  key={cm.value}
                  onClick={() => setColormap(cm.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all",
                    colormap === cm.value
                      ? "bg-orange-500/20 border border-orange-500/30"
                      : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50"
                  )}
                >
                  <div 
                    className="w-full h-3 rounded-sm"
                    style={{ background: `linear-gradient(to right, ${cm.colors.join(', ')})` }}
                  />
                  <span className="text-[9px] text-gray-400">{cm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-400">Opacity</Label>
              <span className="text-xs text-orange-400">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider
              value={[opacity]}
              onValueChange={([v]) => setOpacity(v)}
              min={0}
              max={1}
              step={0.05}
              className="accent-orange-500"
            />
          </div>

          {/* Normalization - NEW */}
          <div className="space-y-2 p-2 bg-gray-800/30 rounded-lg border border-gray-700/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-400">Normalization</Label>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-cyan-400 border-cyan-500/30">
                {normalizationSource === 'prescription' ? 'Rx' : 
                 normalizationSource === 'max_dose' ? 'Max' : 
                 normalizationSource === 'user_entered' ? 'User' : 'Point'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{formatDose(normalizationValue)}</span>
              <span className="text-xs text-gray-500">= 100%</span>
            </div>
            <div className="flex gap-1">
              {(['prescription', 'max_dose', 'user_entered'] as NormalizationSource[]).map((src) => (
                <button
                  key={src}
                  onClick={() => setNormalizationSource(src)}
                  className={cn(
                    "flex-1 px-2 py-1 text-[10px] rounded transition-all",
                    normalizationSource === src
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-gray-800/50 text-gray-500 hover:text-gray-400"
                  )}
                >
                  {src === 'prescription' ? 'Rx' : src === 'max_dose' ? 'Max' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {/* Show Values on Lines Toggle - NEW */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-400">Values on Lines</Label>
            <Switch
              checked={showValuesOnLines}
              onCheckedChange={setShowValuesOnLines}
              className="data-[state=checked]:bg-orange-500"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-700/50">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
              <BarChart3 className="w-3 h-3 mr-1" />
              DVH
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
              <Target className="w-3 h-3 mr-1" />
              Max
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
              <Calculator className="w-3 h-3 mr-1" />
              BED
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// SECTION 2: ISODOSE PRESET MANAGER
// ============================================================================
// Location: Sidebar panel or modal accessed from Dose Control Panel

function IsodosePresetManagerPrototype() {
  const [presets, setPresets] = useState(SAMPLE_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState('eclipse-standard');
  const [editingLevels, setEditingLevels] = useState(DEFAULT_ISODOSE_LEVELS);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingNewPreset, setEditingNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const selectedPreset = presets.find(p => p.id === selectedPresetId);

  const handleLevelChange = (index: number, field: keyof IsodoseLevel, value: any) => {
    const newLevels = [...editingLevels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setEditingLevels(newLevels);
    setHasChanges(true);
  };

  const addLevel = () => {
    const newLevel: IsodoseLevel = {
      percentage: 60,
      color: '#ff00ff',
      lineWidth: 2,
      visible: true,
    };
    setEditingLevels([...editingLevels, newLevel].sort((a, b) => b.percentage - a.percentage));
    setHasChanges(true);
  };

  const removeLevel = (index: number) => {
    setEditingLevels(editingLevels.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  return (
    <Card className="w-[400px] bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" />
            <CardTitle className="text-sm font-semibold text-white">Isodose Settings</CardTitle>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/30">
              Unsaved *
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs text-gray-500">
          Create and manage isodose line presets
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPresetId}
            onChange={(e) => {
              setSelectedPresetId(e.target.value);
              const preset = presets.find(p => p.id === e.target.value);
              if (preset) setEditingLevels(preset.levels);
              setHasChanges(false);
            }}
            className="flex-1 h-8 px-2 text-xs bg-gray-800/50 border border-gray-700 rounded-lg text-white"
          >
            {presets.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isDefault && '(Default)'}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="h-8 px-2">
            <Save className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Isodose Levels Table */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
          <div className="grid grid-cols-[auto_1fr_60px_60px_40px_40px] gap-2 px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider">
            <span></span>
            <span>Level</span>
            <span>%</span>
            <span>Width</span>
            <span>Show</span>
            <span></span>
          </div>
          
          {editingLevels.map((level, index) => (
            <div
              key={index}
              className="grid grid-cols-[auto_1fr_60px_60px_40px_40px] gap-2 items-center px-2 py-1.5 bg-gray-800/30 rounded-lg border border-gray-700/30"
            >
              {/* Color picker */}
              <input
                type="color"
                value={level.color}
                onChange={(e) => handleLevelChange(index, 'color', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent"
              />
              
              {/* Level name */}
              <div className="flex items-center gap-1">
                <div 
                  className="w-3 h-0.5 rounded"
                  style={{ backgroundColor: level.color }}
                />
                <span className="text-xs text-white">{level.percentage}%</span>
              </div>
              
              {/* Percentage input */}
              <Input
                type="number"
                value={level.percentage}
                onChange={(e) => handleLevelChange(index, 'percentage', parseInt(e.target.value))}
                className="h-6 text-xs bg-gray-800/50 border-gray-700"
              />
              
              {/* Line width */}
              <select
                value={level.lineWidth}
                onChange={(e) => handleLevelChange(index, 'lineWidth', parseInt(e.target.value))}
                className="h-6 text-xs bg-gray-800/50 border border-gray-700 rounded px-1 text-white"
              >
                <option value={1}>1px</option>
                <option value={2}>2px</option>
                <option value={3}>3px</option>
              </select>
              
              {/* Visibility toggle */}
              <button
                onClick={() => handleLevelChange(index, 'visible', !level.visible)}
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center",
                  level.visible ? "bg-green-500/20 text-green-400" : "bg-gray-800 text-gray-600"
                )}
              >
                {level.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              
              {/* Delete */}
              <button
                onClick={() => removeLevel(index)}
                className="w-6 h-6 rounded flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Level Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={addLevel}
          className="w-full h-7 text-xs border-dashed border-gray-600 text-gray-400 hover:text-white"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Isodose Level
        </Button>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-700/50">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs border-gray-600"
            onClick={() => {
              if (selectedPreset) setEditingLevels(selectedPreset.levels);
              setHasChanges(false);
            }}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Revert
          </Button>
          <Button
            size="sm"
            className="flex-1 h-7 text-xs bg-purple-600 hover:bg-purple-700"
            disabled={!hasChanges}
          >
            <Save className="w-3 h-3 mr-1" />
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SECTION 3: DVH VIEWER
// ============================================================================
// Location: Modal/popup or dedicated panel, accessed from toolbar or dose panel

// Chart dimensions constants
const DVH_CHART_WIDTH = 520;
const DVH_CHART_HEIGHT = 260;
const DVH_PADDING = { top: 20, right: 20, bottom: 40, left: 50 };
const DVH_MAX_DOSE = 80; // Gy

function DVHViewerPrototype() {
  const [structures, setStructures] = useState(SAMPLE_DVH_STRUCTURES);
  const [viewMode, setViewMode] = useState<'cumulative' | 'differential'>('cumulative');
  const [xAxisUnit, setXAxisUnit] = useState<'Gy' | 'percent'>('Gy');
  const [yAxisUnit, setYAxisUnit] = useState<'percent' | 'cc'>('percent');
  const [prescriptionDose] = useState(70);
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number; dose: number; volume: number } | null>(null);
  const [dxxQuery, setDxxQuery] = useState('95');
  const [vxxQuery, setVxxQuery] = useState('100');

  const toggleStructure = (id: number) => {
    setStructures(structures.map(s => 
      s.id === id ? { ...s, selected: !s.selected } : s
    ));
  };

  // Chart coordinate helpers
  const plotWidth = DVH_CHART_WIDTH - DVH_PADDING.left - DVH_PADDING.right;
  const plotHeight = DVH_CHART_HEIGHT - DVH_PADDING.top - DVH_PADDING.bottom;

  const scaleX = (dose: number) => {
    const maxDose = xAxisUnit === 'percent' ? 120 : DVH_MAX_DOSE;
    return DVH_PADDING.left + (dose / maxDose) * plotWidth;
  };

  const scaleY = (volume: number) => {
    const maxVol = 100;
    return DVH_PADDING.top + (1 - volume / maxVol) * plotHeight;
  };

  const unscaleX = (px: number) => {
    const maxDose = xAxisUnit === 'percent' ? 120 : DVH_MAX_DOSE;
    return Math.max(0, ((px - DVH_PADDING.left) / plotWidth) * maxDose);
  };

  const unscaleY = (py: number) => {
    return Math.max(0, Math.min(100, (1 - (py - DVH_PADDING.top) / plotHeight) * 100));
  };

  // Generate DVH curve points (cumulative)
  const generateDVHCurve = (structure: DVHStructure): { dose: number; volume: number }[] => {
    const points: { dose: number; volume: number }[] = [];
    const maxDose = structure.statistics.max;
    const mean = structure.statistics.mean;
    const spread = Math.max(5, (maxDose - structure.statistics.min) / 4);
    
    // Generate realistic cumulative DVH curve using error function approximation
    for (let d = 0; d <= maxDose + 5; d += 0.5) {
      // Use modified sigmoid for realistic DVH shape
      const normalizedDose = (d - mean) / spread;
      const volume = viewMode === 'cumulative'
        ? 100 * (1 / (1 + Math.exp(normalizedDose)))
        : 100 * Math.exp(-0.5 * Math.pow(normalizedDose, 2)) / (spread * Math.sqrt(2 * Math.PI)) * 15;
      points.push({ 
        dose: xAxisUnit === 'percent' ? (d / prescriptionDose) * 100 : d, 
        volume: Math.max(0, volume) 
      });
    }
    return points;
  };

  // Handle mouse move on chart
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if within plot area
    if (x >= DVH_PADDING.left && x <= DVH_CHART_WIDTH - DVH_PADDING.right &&
        y >= DVH_PADDING.top && y <= DVH_CHART_HEIGHT - DVH_PADDING.bottom) {
      setCursorPosition({
        x,
        y,
        dose: unscaleX(x),
        volume: unscaleY(y)
      });
    } else {
      setCursorPosition(null);
    }
  };

  const handleMouseLeave = () => {
    setCursorPosition(null);
  };

  const selectedStructures = structures.filter(s => s.selected);

  // Generate tick values
  const xTicks = xAxisUnit === 'percent' 
    ? [0, 20, 40, 60, 80, 100, 120]
    : [0, 10, 20, 30, 40, 50, 60, 70, 80];
  const yTicks = [0, 25, 50, 75, 100];

  // Query a specific Dxx value from curve
  const getDxxValue = (structure: DVHStructure, percentVolume: number) => {
    const curve = generateDVHCurve(structure);
    for (let i = 0; i < curve.length - 1; i++) {
      if (curve[i].volume >= percentVolume && curve[i + 1].volume < percentVolume) {
        // Linear interpolation
        const ratio = (percentVolume - curve[i + 1].volume) / (curve[i].volume - curve[i + 1].volume);
        return curve[i].dose + ratio * (curve[i + 1].dose - curve[i].dose);
      }
    }
    return curve[0].dose;
  };

  // Query a specific Vxx value from curve
  const getVxxValue = (structure: DVHStructure, percentDose: number) => {
    const targetDose = xAxisUnit === 'percent' ? percentDose : (percentDose / 100) * prescriptionDose;
    const curve = generateDVHCurve(structure);
    for (let i = 0; i < curve.length - 1; i++) {
      if (curve[i].dose <= targetDose && curve[i + 1].dose > targetDose) {
        // Linear interpolation
        const ratio = (targetDose - curve[i].dose) / (curve[i + 1].dose - curve[i].dose);
        return curve[i].volume + ratio * (curve[i + 1].volume - curve[i].volume);
      }
    }
    return 0;
  };

  return (
    <Card className="w-[850px] bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            <CardTitle className="text-base font-semibold text-white">Dose Volume Histogram</CardTitle>
            <Badge variant="outline" className="text-[9px] text-green-400 border-green-500/30">
              {viewMode === 'cumulative' ? 'Cumulative' : 'Differential'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-4">
          {/* Structure List */}
          <div className="w-[180px] space-y-2">
            <div className="text-xs text-gray-400 font-medium mb-2">Structures</div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {structures.map((struct) => (
                <button
                  key={struct.id}
                  onClick={() => toggleStructure(struct.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all",
                    struct.selected
                      ? "bg-gray-800/80 border border-gray-600"
                      : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50"
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: struct.color }}
                  />
                  <span className="text-xs text-white truncate flex-1">{struct.name}</span>
                  {struct.selected && <Check className="w-3 h-3 text-green-400" />}
                </button>
              ))}
            </div>
            
            {/* Quick Dxx/Vxx Queries */}
            <div className="pt-2 border-t border-gray-700/50 space-y-2">
              <div className="text-[10px] text-gray-500 font-medium">Query Values</div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-cyan-400 w-6">D</span>
                <Input
                  type="number"
                  value={dxxQuery}
                  onChange={(e) => setDxxQuery(e.target.value)}
                  className="h-6 w-14 text-xs bg-gray-800/50 border-gray-700 px-1"
                  min={0}
                  max={100}
                />
                <span className="text-[10px] text-gray-500">%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-purple-400 w-6">V</span>
                <Input
                  type="number"
                  value={vxxQuery}
                  onChange={(e) => setVxxQuery(e.target.value)}
                  className="h-6 w-14 text-xs bg-gray-800/50 border-gray-700 px-1"
                  min={0}
                  max={200}
                />
                <span className="text-[10px] text-gray-500">%</span>
              </div>
            </div>
          </div>

          {/* DVH Chart Area */}
          <div className="flex-1 space-y-2">
            {/* Chart Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                  <button
                    onClick={() => setViewMode('cumulative')}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all",
                      viewMode === 'cumulative'
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    Cumulative
                  </button>
                  <button
                    onClick={() => setViewMode('differential')}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all",
                      viewMode === 'differential'
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    Differential
                  </button>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                  <button
                    onClick={() => setXAxisUnit('Gy')}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all",
                      xAxisUnit === 'Gy'
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    Gy
                  </button>
                  <button
                    onClick={() => setXAxisUnit('percent')}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all",
                      xAxisUnit === 'percent'
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    % Rx
                  </button>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                  <button
                    onClick={() => setYAxisUnit('percent')}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all",
                      yAxisUnit === 'percent'
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    % Vol
                  </button>
                  <button
                    onClick={() => setYAxisUnit('cc')}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all",
                      yAxisUnit === 'cc'
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    cc
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded"
                  />
                  Grid
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLegend}
                    onChange={(e) => setShowLegend(e.target.checked)}
                    className="rounded"
                  />
                  Legend
                </label>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="relative bg-gray-900/50 rounded-lg border border-gray-700/50">
              <svg 
                width={DVH_CHART_WIDTH} 
                height={DVH_CHART_HEIGHT}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="cursor-crosshair"
              >
                {/* Background */}
                <rect
                  x={DVH_PADDING.left}
                  y={DVH_PADDING.top}
                  width={plotWidth}
                  height={plotHeight}
                  fill="#111827"
                />
                
                {/* Grid Lines */}
                {showGrid && (
                  <g className="grid-lines">
                    {/* Horizontal grid lines */}
                    {yTicks.map((v) => (
                      <line
                        key={`h-${v}`}
                        x1={DVH_PADDING.left}
                        y1={scaleY(v)}
                        x2={DVH_CHART_WIDTH - DVH_PADDING.right}
                        y2={scaleY(v)}
                        stroke="#374151"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                    ))}
                    {/* Vertical grid lines */}
                    {xTicks.map((v) => (
                      <line
                        key={`v-${v}`}
                        x1={scaleX(v)}
                        y1={DVH_PADDING.top}
                        x2={scaleX(v)}
                        y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                        stroke="#374151"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                    ))}
                  </g>
                )}

                {/* Prescription line (100% dose) */}
                <line
                  x1={scaleX(xAxisUnit === 'percent' ? 100 : prescriptionDose)}
                  y1={DVH_PADDING.top}
                  x2={scaleX(xAxisUnit === 'percent' ? 100 : prescriptionDose)}
                  y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                  stroke="#f97316"
                  strokeWidth="1.5"
                  strokeDasharray="5,3"
                />
                <text
                  x={scaleX(xAxisUnit === 'percent' ? 100 : prescriptionDose) + 3}
                  y={DVH_PADDING.top + 12}
                  fill="#f97316"
                  fontSize="9"
                >
                  Rx
                </text>

                {/* DVH Curves */}
                {selectedStructures.map((struct) => {
                  const curve = generateDVHCurve(struct);
                  const pathData = curve.map((p, i) => {
                    const x = scaleX(p.dose);
                    const y = scaleY(p.volume);
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  }).join(' ');
                  
                  return (
                    <path
                      key={struct.id}
                      d={pathData}
                      fill="none"
                      stroke={struct.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}

                {/* X-Axis */}
                <line
                  x1={DVH_PADDING.left}
                  y1={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                  x2={DVH_CHART_WIDTH - DVH_PADDING.right}
                  y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                  stroke="#6b7280"
                  strokeWidth="1"
                />
                {xTicks.map((v) => (
                  <g key={`xt-${v}`}>
                    <line
                      x1={scaleX(v)}
                      y1={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                      x2={scaleX(v)}
                      y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom + 4}
                      stroke="#6b7280"
                      strokeWidth="1"
                    />
                    <text
                      x={scaleX(v)}
                      y={DVH_CHART_HEIGHT - DVH_PADDING.bottom + 14}
                      fill="#9ca3af"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {v}
                    </text>
                  </g>
                ))}
                <text
                  x={DVH_CHART_WIDTH / 2}
                  y={DVH_CHART_HEIGHT - 5}
                  fill="#9ca3af"
                  fontSize="11"
                  textAnchor="middle"
                >
                  Dose ({xAxisUnit === 'Gy' ? 'Gy' : '% Rx'})
                </text>

                {/* Y-Axis */}
                <line
                  x1={DVH_PADDING.left}
                  y1={DVH_PADDING.top}
                  x2={DVH_PADDING.left}
                  y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                  stroke="#6b7280"
                  strokeWidth="1"
                />
                {yTicks.map((v) => (
                  <g key={`yt-${v}`}>
                    <line
                      x1={DVH_PADDING.left - 4}
                      y1={scaleY(v)}
                      x2={DVH_PADDING.left}
                      y2={scaleY(v)}
                      stroke="#6b7280"
                      strokeWidth="1"
                    />
                    <text
                      x={DVH_PADDING.left - 8}
                      y={scaleY(v) + 3}
                      fill="#9ca3af"
                      fontSize="10"
                      textAnchor="end"
                    >
                      {v}
                    </text>
                  </g>
                ))}
                <text
                  x={12}
                  y={DVH_CHART_HEIGHT / 2}
                  fill="#9ca3af"
                  fontSize="11"
                  textAnchor="middle"
                  transform={`rotate(-90, 12, ${DVH_CHART_HEIGHT / 2})`}
                >
                  Volume ({yAxisUnit === 'percent' ? '%' : 'cc'})
                </text>

                {/* Interactive Cursor */}
                {cursorPosition && (
                  <g className="cursor-display">
                    {/* Vertical cursor line */}
                    <line
                      x1={cursorPosition.x}
                      y1={DVH_PADDING.top}
                      x2={cursorPosition.x}
                      y2={DVH_CHART_HEIGHT - DVH_PADDING.bottom}
                      stroke="#22d3ee"
                      strokeWidth="1"
                      strokeDasharray="3,2"
                    />
                    {/* Horizontal cursor line */}
                    <line
                      x1={DVH_PADDING.left}
                      y1={cursorPosition.y}
                      x2={DVH_CHART_WIDTH - DVH_PADDING.right}
                      y2={cursorPosition.y}
                      stroke="#22d3ee"
                      strokeWidth="1"
                      strokeDasharray="3,2"
                    />
                    {/* Cursor tooltip */}
                    <rect
                      x={cursorPosition.x + 8}
                      y={cursorPosition.y - 30}
                      width="85"
                      height="26"
                      rx="4"
                      fill="#1f2937"
                      stroke="#374151"
                    />
                    <text
                      x={cursorPosition.x + 14}
                      y={cursorPosition.y - 18}
                      fill="#22d3ee"
                      fontSize="10"
                    >
                      D: {cursorPosition.dose.toFixed(1)} {xAxisUnit === 'Gy' ? 'Gy' : '%'}
                    </text>
                    <text
                      x={cursorPosition.x + 14}
                      y={cursorPosition.y - 8}
                      fill="#a78bfa"
                      fontSize="10"
                    >
                      V: {cursorPosition.volume.toFixed(1)}%
                    </text>
                  </g>
                )}

                {/* Legend */}
                {showLegend && selectedStructures.length > 0 && (
                  <g transform={`translate(${DVH_CHART_WIDTH - DVH_PADDING.right - 90}, ${DVH_PADDING.top + 5})`}>
                    <rect
                      x="0"
                      y="0"
                      width="85"
                      height={selectedStructures.length * 16 + 8}
                      rx="4"
                      fill="#111827"
                      fillOpacity="0.9"
                      stroke="#374151"
                    />
                    {selectedStructures.map((struct, idx) => (
                      <g key={struct.id} transform={`translate(6, ${idx * 16 + 12})`}>
                        <line
                          x1="0"
                          y1="0"
                          x2="20"
                          y2="0"
                          stroke={struct.color}
                          strokeWidth="2"
                        />
                        <text
                          x="26"
                          y="3"
                          fill="#e5e7eb"
                          fontSize="9"
                        >
                          {struct.name.length > 10 ? struct.name.slice(0, 10) + '...' : struct.name}
                        </text>
                      </g>
                    ))}
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Statistics Table with Dxx/Vxx Query Results */}
        <div className="border-t border-gray-700/50 pt-4">
          <div className="text-xs text-gray-400 font-medium mb-2">Statistics</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700/50">
                  <th className="text-left py-1.5 px-2">Structure</th>
                  <th className="text-left py-1.5 px-2">Vol (cc)</th>
                  <th className="text-left py-1.5 px-2">Min</th>
                  <th className="text-left py-1.5 px-2">Max</th>
                  <th className="text-left py-1.5 px-2">Mean</th>
                  <th className="text-left py-1.5 px-2 text-cyan-400">D{dxxQuery}</th>
                  <th className="text-left py-1.5 px-2 text-cyan-400">D50</th>
                  <th className="text-left py-1.5 px-2 text-purple-400">V{vxxQuery}</th>
                </tr>
              </thead>
              <tbody>
                {selectedStructures.map((struct) => (
                  <tr key={struct.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: struct.color }}
                        />
                        <span className="text-white">{struct.name}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-gray-400">{struct.volumeCc.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-gray-400">{struct.statistics.min.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-gray-400">{struct.statistics.max.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-gray-400">{struct.statistics.mean.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-cyan-400 font-medium">
                      {getDxxValue(struct, parseFloat(dxxQuery) || 95).toFixed(1)} {xAxisUnit === 'Gy' ? 'Gy' : '%'}
                    </td>
                    <td className="py-1.5 px-2 text-gray-400">{struct.statistics.d50.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-purple-400 font-medium">
                      {getVxxValue(struct, parseFloat(vxxQuery) || 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SECTION 4: BED CALCULATOR
// ============================================================================
// Location: Modal/popup accessed from dose panel or menu

function BEDCalculatorPrototype() {
  const [totalDose, setTotalDose] = useState(70);
  const [fractions, setFractions] = useState(35);
  const [alphaOverBeta, setAlphaOverBeta] = useState(10);
  const [calculationType, setCalculationType] = useState<'bed' | 'eqd2'>('bed');

  const dosePerFraction = totalDose / fractions;
  const bed = totalDose * (1 + dosePerFraction / alphaOverBeta);
  const eqd2 = bed / (1 + 2 / alphaOverBeta);

  const presets = [
    { name: 'Tumor (α/β = 10)', value: 10 },
    { name: 'Late Effects (α/β = 3)', value: 3 },
    { name: 'Prostate (α/β = 1.5)', value: 1.5 },
    { name: 'Breast (α/β = 4)', value: 4 },
  ];

  return (
    <Card className="w-[350px] bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-purple-400" />
          <CardTitle className="text-sm font-semibold text-white">BED / EQD2 Calculator</CardTitle>
        </div>
        <CardDescription className="text-xs text-gray-500">
          Biological Effective Dose calculations
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Total Dose (Gy)</Label>
            <Input
              type="number"
              value={totalDose}
              onChange={(e) => setTotalDose(parseFloat(e.target.value) || 0)}
              className="h-8 text-sm bg-gray-800/50 border-gray-700"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Fractions</Label>
            <Input
              type="number"
              value={fractions}
              onChange={(e) => setFractions(parseInt(e.target.value) || 1)}
              className="h-8 text-sm bg-gray-800/50 border-gray-700"
            />
          </div>
        </div>

        {/* α/β Selection */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-400">α/β Ratio</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={alphaOverBeta}
              onChange={(e) => setAlphaOverBeta(parseFloat(e.target.value) || 1)}
              className="w-20 h-8 text-sm bg-gray-800/50 border-gray-700"
              step={0.5}
            />
            <span className="text-xs text-gray-500">Gy</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setAlphaOverBeta(preset.value)}
                className={cn(
                  "px-2 py-1 text-[10px] rounded-md transition-all",
                  alphaOverBeta === preset.value
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "bg-gray-800/50 text-gray-500 hover:text-gray-400"
                )}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
          <div className="text-xs text-gray-400">Dose per Fraction</div>
          <div className="text-lg font-bold text-white">{dosePerFraction.toFixed(2)} Gy</div>
          
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700/50">
            <div>
              <div className="text-xs text-gray-400 mb-1">BED</div>
              <div className="text-xl font-bold text-purple-400">{bed.toFixed(1)} Gy</div>
              <div className="text-[10px] text-gray-500">
                = {totalDose} × (1 + {dosePerFraction.toFixed(2)}/{alphaOverBeta})
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">EQD2</div>
              <div className="text-xl font-bold text-cyan-400">{eqd2.toFixed(1)} Gy</div>
              <div className="text-[10px] text-gray-500">
                Equivalent in 2Gy fractions
              </div>
            </div>
          </div>
        </div>

        {/* Formula Reference */}
        <div className="p-2 bg-gray-900/50 rounded-lg border border-gray-800">
          <div className="text-[10px] text-gray-500 font-mono">
            BED = n × d × (1 + d/(α/β))
          </div>
          <div className="text-[10px] text-gray-500 font-mono">
            EQD2 = BED / (1 + 2/(α/β))
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SECTION 5: DOSE TOOLS TOOLBAR
// ============================================================================
// Location: Integrated into bottom toolbar or as sub-menu when dose is active

function DoseToolsToolbarPrototype() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [clipToStructure, setClipToStructure] = useState<string | null>(null);

  const tools = [
    { id: 'dvh', icon: BarChart3, label: 'DVH', color: 'green' },
    { id: 'bed', icon: Calculator, label: 'BED', color: 'purple' },
    { id: 'localize-max', icon: Target, label: 'Max Dose', color: 'orange' },
    { id: 'create-contour', icon: Scissors, label: 'Isodose → Contour', color: 'cyan' },
    { id: 'clip', icon: Square, label: 'Clip to Structure', color: 'pink' },
    { id: 'constraints', icon: Check, label: 'Constraints', color: 'amber' },
  ];

  return (
    <div className="inline-flex items-center gap-1 p-1.5 bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl">
      <div className="px-2 py-1 text-xs text-orange-400 font-medium border-r border-gray-700/50 mr-1">
        <Activity className="w-3.5 h-3.5 inline mr-1" />
        Dose Tools
      </div>
      
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all",
            activeTool === tool.id
              ? tool.color === 'green' ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : tool.color === 'purple' ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              : tool.color === 'orange' ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : tool.color === 'cyan' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : tool.color === 'pink' ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"
          )}
        >
          <tool.icon className="w-3.5 h-3.5" />
          <span>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// SECTION 6: DOSE SIDEBAR WIDGET
// ============================================================================
// Location: Left sidebar under RT Structure Set when dose is loaded

function DoseSidebarWidgetPrototype() {
  const [expanded, setExpanded] = useState(true);
  const [selectedDose, setSelectedDose] = useState('plan-a');
  const [isVisible, setIsVisible] = useState(true);

  const doseSeries = [
    { id: 'plan-a', name: 'Plan A - Final', maxDose: 74.2, type: 'PHYSICAL', fractions: 35 },
    { id: 'plan-b', name: 'Plan B - Alt', maxDose: 72.1, type: 'PHYSICAL', fractions: 35 },
  ];

  return (
    <div className="w-[280px] bg-[#0d1117]/95 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-orange-500/10 border-b border-orange-500/20"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-white">RT Dose</span>
          <Badge className="text-[9px] px-1.5 py-0 bg-orange-500/20 text-orange-400 border-orange-500/30">
            2
          </Badge>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-2 space-y-1">
          {doseSeries.map((dose) => (
            <div
              key={dose.id}
              onClick={() => setSelectedDose(dose.id)}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all",
                selectedDose === dose.id
                  ? "bg-orange-500/20 border border-orange-500/30"
                  : "hover:bg-gray-800/50 border border-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedDose === dose.id) setIsVisible(!isVisible);
                  }}
                  className={cn(
                    "w-5 h-5 rounded flex items-center justify-center",
                    selectedDose === dose.id && isVisible
                      ? "bg-orange-500/30 text-orange-400"
                      : "bg-gray-800 text-gray-500"
                  )}
                >
                  {selectedDose === dose.id && isVisible ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3" />
                  )}
                </button>
                <div>
                  <div className="text-xs text-white">{dose.name}</div>
                  <div className="text-[10px] text-gray-500">
                    Max: {dose.maxDose} Gy • {dose.fractions}fx
                  </div>
                </div>
              </div>
              {selectedDose === dose.id && (
                <Badge className="text-[9px] px-1 py-0 bg-orange-500/20 text-orange-400 border-orange-500/30">
                  Active
                </Badge>
              )}
            </div>
          ))}

          {/* Quick Stats */}
          <div className="mt-2 p-2 bg-gray-800/30 rounded-lg border border-gray-700/50">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-gray-500">Max</div>
                <div className="text-xs font-medium text-orange-400">74.2 Gy</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500">Rx</div>
                <div className="text-xs font-medium text-cyan-400">70.0 Gy</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500">Fx</div>
                <div className="text-xs font-medium text-white">35</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-6 text-[10px] border-gray-700">
              <BarChart3 className="w-3 h-3 mr-1" />
              DVH
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-6 text-[10px] border-gray-700">
              <Settings className="w-3 h-3 mr-1" />
              Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN EXPORT: Combined Prototype Showcase
// ============================================================================

export function DoseViewingPrototype() {
  return (
    <div className="w-full min-h-screen bg-[#0a0e14] p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">RT Dose Viewing Prototypes</h1>
          <p className="text-gray-400 text-sm">
            Based on MIM Software dose viewing standards - implementing DVH, BED, isodose presets, and more
          </p>
        </div>

        {/* Section 1: Enhanced Dose Control Panel */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">1</Badge>
            <h2 className="text-lg font-semibold text-white">Enhanced Dose Control Panel</h2>
            <span className="text-xs text-gray-500">Location: Bottom-left floating panel (current position)</span>
          </div>
          <p className="text-sm text-gray-400">
            New features: Dose unit toggle (Gy/cGy), display mode selection, normalization source display, values on lines toggle
          </p>
          <DoseControlPanelPrototype />
        </section>

        {/* Section 2: Isodose Preset Manager */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">2</Badge>
            <h2 className="text-lg font-semibold text-white">Isodose Preset Manager</h2>
            <span className="text-xs text-gray-500">Location: Modal from dose settings, or sidebar panel</span>
          </div>
          <p className="text-sm text-gray-400">
            Save, load, and manage isodose line configurations. Edit colors, percentages, and line widths.
          </p>
          <IsodosePresetManagerPrototype />
        </section>

        {/* Section 3: DVH Viewer */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">3</Badge>
            <h2 className="text-lg font-semibold text-white">DVH Viewer</h2>
            <span className="text-xs text-gray-500">Location: Modal popup, accessed from toolbar or dose panel</span>
          </div>
          <p className="text-sm text-gray-400">
            Full-featured Dose Volume Histogram viewer with structure selection, statistics table, and export.
          </p>
          <DVHViewerPrototype />
        </section>

        {/* Section 4: BED Calculator */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">4</Badge>
            <h2 className="text-lg font-semibold text-white">BED / EQD2 Calculator</h2>
            <span className="text-xs text-gray-500">Location: Modal from dose tools menu</span>
          </div>
          <p className="text-sm text-gray-400">
            Calculate Biological Effective Dose and Equivalent Dose in 2Gy fractions with preset α/β ratios.
          </p>
          <BEDCalculatorPrototype />
        </section>

        {/* Section 5: Dose Tools Toolbar */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">5</Badge>
            <h2 className="text-lg font-semibold text-white">Dose Tools Toolbar</h2>
            <span className="text-xs text-gray-500">Location: Bottom toolbar extension when dose is active</span>
          </div>
          <p className="text-sm text-gray-400">
            Quick access to dose-specific tools: DVH, BED calculator, localize max, create contours, clip to structure, constraints.
          </p>
          <DoseToolsToolbarPrototype />
        </section>

        {/* Section 6: Dose Sidebar Widget */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">6</Badge>
            <h2 className="text-lg font-semibold text-white">Dose Sidebar Widget</h2>
            <span className="text-xs text-gray-500">Location: Left sidebar, under RT Structure Set</span>
          </div>
          <p className="text-sm text-gray-400">
            Compact dose series selector with visibility toggle, quick stats, and action buttons.
          </p>
          <DoseSidebarWidgetPrototype />
        </section>

        {/* UI Location Summary */}
        <section className="p-6 bg-gray-800/30 rounded-xl border border-gray-700/50">
          <h2 className="text-lg font-semibold text-white mb-4">📍 UI Placement Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h3 className="font-medium text-orange-400">Floating Panels</h3>
              <ul className="text-gray-400 space-y-1 ml-4 list-disc">
                <li><strong>Dose Control Panel</strong> - Bottom-left, beside fusion panel</li>
                <li><strong>Dose Tools Toolbar</strong> - Extends bottom toolbar when dose active</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-purple-400">Modals / Popups</h3>
              <ul className="text-gray-400 space-y-1 ml-4 list-disc">
                <li><strong>DVH Viewer</strong> - Large modal, centered</li>
                <li><strong>BED Calculator</strong> - Small modal/popover</li>
                <li><strong>Isodose Presets</strong> - Modal or slide-out panel</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-blue-400">Sidebar Integration</h3>
              <ul className="text-gray-400 space-y-1 ml-4 list-disc">
                <li><strong>Dose Sidebar Widget</strong> - Left sidebar, under RTSTRUCT</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-green-400">Viewport Overlays</h3>
              <ul className="text-gray-400 space-y-1 ml-4 list-disc">
                <li><strong>Isodose Key/Legend</strong> - Top-right or right edge of viewport</li>
                <li><strong>Values on Lines</strong> - Direct on isodose contours</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default DoseViewingPrototype;

