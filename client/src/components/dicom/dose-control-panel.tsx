/**
 * DoseControlPanel - Modern floating control panel for RT Dose visualization
 * 
 * Redesigned with a sleek, glass-morphism aesthetic and improved UX.
 * Now includes DVH popup launcher, dose unit toggle, and display mode selection.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Loader2, 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff, 
  Layers, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  BarChart3,
  Calculator,
  Target,
  LineChart,
  PaintBucket,
  Grid3X3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  type DoseColormap,
  type DoseUnit,
  type DoseDisplayMode,
  type RTDoseMetadata,
  formatDose,
  formatDoseWithUnit
} from '@/lib/rt-dose-manager';

interface DoseSeriesOption {
  id: number;
  seriesDescription: string;
  maxDose?: number;
  doseType?: string;
}

interface DoseControlPanelProps {
  // Dose series selection
  doseSeriesOptions: DoseSeriesOption[];
  selectedDoseSeriesId: number | null;
  onDoseSeriesSelect: (seriesId: number | null) => void;
  
  // Display settings
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  colormap: DoseColormap;
  onColormapChange: (colormap: DoseColormap) => void;
  
  // NEW: Dose unit toggle
  doseUnit?: DoseUnit;
  onDoseUnitChange?: (unit: DoseUnit) => void;
  
  // NEW: Display mode
  displayMode?: DoseDisplayMode;
  onDisplayModeChange?: (mode: DoseDisplayMode) => void;
  
  // NEW: Show values on isodose lines
  showValuesOnLines?: boolean;
  onShowValuesOnLinesChange?: (show: boolean) => void;
  
  // Isodose lines
  showIsodose: boolean;
  onShowIsodoseChange: (show: boolean) => void;
  isodoseLevels: number[];
  onIsodoseLevelsChange?: (levels: number[]) => void;
  
  // Thresholds
  prescriptionDose?: number;
  onPrescriptionDoseChange?: (dose: number) => void;
  minThreshold?: number;
  maxThreshold?: number;
  onThresholdsChange?: (min: number, max: number) => void;
  
  // Visibility toggle
  isVisible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  
  // Loading state
  isLoading?: boolean;
  loadError?: string | null;
  metadata?: RTDoseMetadata | null;
  
  // Minimize
  minimized?: boolean;
  onToggleMinimized?: (minimized: boolean) => void;
  
  // Position - whether fusion panel is visible (dose goes to its left)
  fusionPanelVisible?: boolean;
  
  // NEW: Structure set ID for DVH
  structureSetId?: number;
  
  // Quick action callbacks
  onLocalizeMaxDose?: () => void;
  onOpenBEDCalculator?: () => void;
}

const COLORMAP_OPTIONS: { value: DoseColormap; label: string; colors: string[] }[] = [
  { value: 'rainbow', label: 'Rainbow', colors: ['#0066ff', '#00ff88', '#ffff00', '#ff4400'] },
  { value: 'hot', label: 'Hot', colors: ['#1a0000', '#cc0000', '#ff8800', '#ffffff'] },
  { value: 'grayscale', label: 'Mono', colors: ['#1a1a1a', '#666666', '#cccccc', '#ffffff'] },
];

const DISPLAY_MODE_OPTIONS: { value: DoseDisplayMode; label: string; icon: React.ReactNode }[] = [
  { value: 'lines_only', label: 'Lines', icon: <LineChart className="w-3.5 h-3.5" /> },
  { value: 'colorwash_only', label: 'Wash', icon: <PaintBucket className="w-3.5 h-3.5" /> },
  { value: 'lines_and_colorwash', label: 'Both', icon: <Layers className="w-3.5 h-3.5" /> },
  { value: 'banded_with_lines', label: 'Band', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
];

const ISODOSE_LEVEL_COLORS: Record<number, string> = {
  107: '#ff0080',
  105: '#ff0000',
  100: '#ff8800',
  95: '#ffff00',
  90: '#00ff00',
  80: '#00ffff',
  70: '#0088ff',
  50: '#0000ff',
  30: '#8800ff',
  10: '#444444',
};

const DEFAULT_ISODOSE_LEVELS = [30, 50, 70, 80, 90, 95, 100, 105];

export function DoseControlPanel({
  doseSeriesOptions,
  selectedDoseSeriesId,
  onDoseSeriesSelect,
  opacity,
  onOpacityChange,
  colormap,
  onColormapChange,
  doseUnit = 'Gy',
  onDoseUnitChange,
  displayMode = 'lines_and_colorwash',
  onDisplayModeChange,
  showValuesOnLines = false,
  onShowValuesOnLinesChange,
  showIsodose,
  onShowIsodoseChange,
  isodoseLevels = DEFAULT_ISODOSE_LEVELS,
  onIsodoseLevelsChange,
  prescriptionDose = 60,
  onPrescriptionDoseChange,
  minThreshold = 0.5,
  maxThreshold = 70,
  onThresholdsChange,
  isVisible,
  onVisibilityChange,
  isLoading = false,
  loadError,
  metadata,
  minimized = false,
  onToggleMinimized,
  fusionPanelVisible = false,
  structureSetId,
  onLocalizeMaxDose,
  onOpenBEDCalculator,
}: DoseControlPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const activeDescriptor = useMemo(() => {
    return doseSeriesOptions.find((s) => s.id === selectedDoseSeriesId) ?? null;
  }, [doseSeriesOptions, selectedDoseSeriesId]);

  const handleOpacityChange = (values: number[]) => {
    const next = values[0];
    if (typeof next === 'number' && !Number.isNaN(next)) {
      onOpacityChange(Math.max(0, Math.min(1, next)));
    }
  };

  // Don't render if no dose series available
  if (doseSeriesOptions.length === 0) {
    return null;
  }

  // Position: to the left of fusion panel when it's visible, otherwise at right edge
  const panelRightPosition = fusionPanelVisible ? 'right-[24rem]' : 'right-6';

  if (minimized) {
    return (
      <div 
        className={`fixed bottom-4 ${panelRightPosition} z-50`}
        style={{
          background: 'linear-gradient(135deg, rgba(120, 120, 130, 0.15) 0%, rgba(60, 60, 70, 0.12) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-500/30 px-4 py-2.5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Zap className="h-4 w-4 text-zinc-300" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            </div>
            <span className="text-sm font-medium text-zinc-100">Dose</span>
          </div>
          
          <div className="h-4 w-px bg-zinc-500/30" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onVisibilityChange(!isVisible)}
            className="h-7 w-7 rounded-lg text-zinc-200 hover:bg-zinc-500/20 transition-all"
          >
            {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
          </Button>
          
          <div className="w-20">
            <Slider 
              value={[opacity]} 
              min={0} 
              max={1} 
              step={0.01} 
              onValueChange={handleOpacityChange}
              disabled={!isVisible}
              className="[&_[role=slider]]:bg-zinc-300 [&_[role=slider]]:border-zinc-400 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
            />
          </div>
          
          <span className="text-xs font-medium text-zinc-400 tabular-nums w-8">
            {Math.round(opacity * 100)}%
          </span>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onToggleMinimized?.(false)} 
            className="h-7 w-7 rounded-lg text-zinc-200 hover:bg-zinc-500/20 transition-all"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 ${panelRightPosition} z-50`}>
      <div 
        className="w-80 rounded-2xl border border-zinc-600/30 shadow-2xl shadow-black/40 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(80, 80, 90, 0.20) 0%, rgba(20, 20, 25, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-600/25">
          <div className="flex items-center gap-2.5">
            <div className="relative p-1.5 rounded-lg bg-gradient-to-br from-zinc-500/30 to-zinc-700/20">
              <Zap className="h-4 w-4 text-zinc-300" />
            </div>
            <div>
              <span className="text-sm font-semibold text-zinc-50">RT Dose</span>
              {metadata?.maxDose && (
                <span className="ml-2 text-xs text-zinc-400">
                  Max: {formatDose(metadata.maxDose)}
                </span>
              )}
            </div>
            {isLoading && (
              <Loader2 className="h-3.5 w-3.5 text-zinc-400 animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onVisibilityChange(!isVisible)}
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                isVisible 
                  ? "text-zinc-100 hover:bg-zinc-500/20 bg-zinc-500/15" 
                  : "text-zinc-500 hover:bg-zinc-500/10"
              )}
            >
              {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onToggleMinimized?.(true)} 
              className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-200 transition-all"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {loadError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {loadError}
            </div>
          )}

          {/* Opacity Control - Main Control */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Opacity</span>
              <span className="text-sm font-semibold text-zinc-100 tabular-nums">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider 
              value={[opacity]} 
              min={0} 
              max={1} 
              step={0.01} 
              onValueChange={handleOpacityChange}
              disabled={!isVisible}
              className="[&_[role=slider]]:bg-zinc-300 [&_[role=slider]]:border-zinc-400 [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-black/20"
            />
          </div>

          {/* Colormap disabled - using rainbow only for now */}
          {/* Rainbow colormap indicator */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Colormap</span>
            <div className="flex items-center gap-2">
              <div 
                className="w-16 h-2 rounded-full overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, #0066ff, #00ff88, #ffff00, #ff4400)'
                }}
              />
              <span className="text-[10px] text-zinc-400">Rainbow</span>
            </div>
          </div>

          {/* NEW: Dose Unit Toggle */}
          {onDoseUnitChange && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Dose Unit</span>
              <div className="flex items-center gap-1 p-0.5 bg-zinc-800/50 rounded-lg">
                <button
                  onClick={() => onDoseUnitChange('Gy')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    doseUnit === 'Gy'
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "text-zinc-400 hover:text-zinc-300"
                  )}
                >
                  Gy
                </button>
                <button
                  onClick={() => onDoseUnitChange('cGy')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    doseUnit === 'cGy'
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "text-zinc-400 hover:text-zinc-300"
                  )}
                >
                  cGy
                </button>
              </div>
            </div>
          )}

          {/* NEW: Display Mode Selection */}
          {onDisplayModeChange && (
            <div className="space-y-2.5">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Display Mode</span>
              <div className="grid grid-cols-4 gap-1">
                {DISPLAY_MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => onDisplayModeChange(mode.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all text-[9px]",
                      displayMode === mode.value
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800/50 border border-transparent"
                    )}
                    title={mode.label}
                  >
                    {mode.icon}
                    <span className="truncate w-full text-center">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prescription Dose */}
          {onPrescriptionDoseChange && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Rx Dose</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={prescriptionDose}
                    onChange={(e) => onPrescriptionDoseChange(parseFloat(e.target.value) || 60)}
                    className="w-14 px-2 py-1 text-xs font-medium bg-black/30 border border-zinc-600/30 rounded-lg text-zinc-100 text-center focus:outline-none focus:ring-1 focus:ring-zinc-400/50"
                    step={0.5}
                  />
                  <span className="text-xs text-zinc-500">Gy</span>
                </div>
              </div>
              <Slider 
                value={[prescriptionDose]} 
                min={10} 
                max={80} 
                step={1} 
                onValueChange={(v) => onPrescriptionDoseChange(v[0])}
                className="[&_[role=slider]]:bg-zinc-300 [&_[role=slider]]:border-zinc-400"
              />
            </div>
          )}

          {/* Isodose Lines Toggle */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-zinc-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Isodose Lines</span>
            </div>
            <button
              onClick={() => onShowIsodoseChange(!showIsodose)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-all duration-200",
                showIsodose 
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500" 
                  : "bg-zinc-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200",
                  showIsodose ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>

          {/* Isodose Levels Preview */}
          {showIsodose && (
            <div className="rounded-xl bg-black/30 border border-zinc-600/20 p-3 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Active Levels</div>
              <div className="flex flex-wrap gap-1.5">
                {isodoseLevels.map((level) => {
                  const color = ISODOSE_LEVEL_COLORS[level] || '#666';
                  return (
                    <div
                      key={level}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 border border-white/5"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                      />
                      <span className="text-[11px] font-medium text-white/70">{level}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Advanced Section Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? 'Less' : 'More Details'}
          </button>

          {/* Advanced Stats */}
          {showAdvanced && metadata && (
            <div className="rounded-xl bg-black/30 border border-zinc-600/20 p-3 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Dose Statistics</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500">Min Dose</span>
                  <span className="text-sm font-semibold text-blue-300">{formatDose(metadata.minDose || 0)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500">Max Dose</span>
                  <span className="text-sm font-semibold text-red-400">{formatDose(metadata.maxDose || 0)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500">Grid Size</span>
                  <span className="text-sm font-medium text-zinc-200">{metadata.rows} × {metadata.columns}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500">Frames</span>
                  <span className="text-sm font-medium text-zinc-200">{metadata.numberOfFrames}</span>
                </div>
              </div>
            </div>
          )}

          {/* Dose Series Selector - Only if multiple */}
          {doseSeriesOptions.length > 1 && (
            <div className="space-y-2.5 pt-2 border-t border-zinc-600/15">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Dose Series</span>
              <div className="space-y-1.5">
                {doseSeriesOptions.map((dose) => {
                  const isActive = dose.id === selectedDoseSeriesId;
                  return (
                    <button
                      key={dose.id}
                      onClick={() => onDoseSeriesSelect(isActive ? null : dose.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-200',
                        isActive
                          ? 'bg-gradient-to-r from-zinc-500/25 to-zinc-600/15 ring-1 ring-zinc-500/30'
                          : 'bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className={cn(
                          "text-xs font-medium",
                          isActive ? "text-zinc-100" : "text-zinc-400"
                        )}>
                          {dose.seriesDescription || 'RT Dose'}
                        </span>
                        {dose.maxDose && (
                          <span className="text-[10px] text-zinc-500">
                            Max: {dose.maxDose.toFixed(1)} Gy
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions - DVH, Max, BED */}
          <div className="flex gap-2 pt-3 border-t border-zinc-600/15">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                // Open DVH in a new popup window
                if (selectedDoseSeriesId) {
                  const params = new URLSearchParams();
                  params.set('doseSeriesId', selectedDoseSeriesId.toString());
                  if (structureSetId) params.set('structureSetId', structureSetId.toString());
                  params.set('prescriptionDose', prescriptionDose.toString());
                  params.set('doseUnit', doseUnit);
                  
                  // Default to 80% of screen size for large statistics tables
                  const width = Math.min(1400, Math.floor(window.screen.width * 0.8));
                  const height = Math.min(900, Math.floor(window.screen.height * 0.85));
                  const left = (window.screen.width - width) / 2;
                  const top = (window.screen.height - height) / 2;
                  
                  window.open(
                    `/dvh-viewer?${params.toString()}`,
                    'DVH Viewer',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                  );
                }
              }}
              disabled={!selectedDoseSeriesId}
              className="flex-1 h-8 text-xs rounded-lg text-zinc-200 hover:bg-zinc-500/20 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              DVH
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onLocalizeMaxDose}
              disabled={!selectedDoseSeriesId || !onLocalizeMaxDose}
              className="flex-1 h-8 text-xs rounded-lg text-zinc-200 hover:bg-zinc-500/20 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Localize maximum dose point"
            >
              <Target className="w-3.5 h-3.5 mr-1.5" />
              Max
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenBEDCalculator}
              disabled={!onOpenBEDCalculator}
              className="flex-1 h-8 text-xs rounded-lg text-zinc-200 hover:bg-zinc-500/20 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="BED / EQD2 Calculator"
            >
              <Calculator className="w-3.5 h-3.5 mr-1.5" />
              BED
            </Button>
          </div>
        </div>
      </div>

      {/* DVH now opens in a separate popup window - see DVH button onClick handler */}
    </div>
  );
}

export default DoseControlPanel;
