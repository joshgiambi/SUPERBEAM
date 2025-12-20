/**
 * DoseControlPanel - Floating control panel for RT Dose visualization
 * 
 * Styled to match the FusionControlPanel and positioned to its left.
 * Provides colormap selection, opacity, isodose toggles, and dose statistics.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2, Maximize2, Minimize2, Eye, EyeOff, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ISODOSE_COLORS, 
  type DoseColormap,
  type RTDoseMetadata,
  formatDose 
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
}

const COLORMAP_OPTIONS: { value: DoseColormap; label: string; preview: string }[] = [
  { value: 'rainbow', label: 'Rainbow', preview: 'bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500' },
  { value: 'hot', label: 'Hot', preview: 'bg-gradient-to-r from-black via-red-600 via-orange-400 to-white' },
  { value: 'jet', label: 'Jet', preview: 'bg-gradient-to-r from-blue-800 via-cyan-400 via-green-500 via-yellow-400 to-red-600' },
  { value: 'cool', label: 'Cool', preview: 'bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500' },
  { value: 'dosimetry', label: 'Clinical', preview: 'bg-gradient-to-r from-blue-600 via-green-500 via-yellow-400 via-orange-500 to-red-500' },
  { value: 'grayscale', label: 'Gray', preview: 'bg-gradient-to-r from-gray-900 via-gray-500 to-white' },
];

const DEFAULT_ISODOSE_LEVELS = [30, 50, 70, 80, 90, 95, 100, 105];

export function DoseControlPanel({
  doseSeriesOptions,
  selectedDoseSeriesId,
  onDoseSeriesSelect,
  opacity,
  onOpacityChange,
  colormap,
  onColormapChange,
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
      <div className={`fixed bottom-4 ${panelRightPosition} z-50 flex items-center gap-3 rounded-xl border border-orange-400/40 bg-orange-500/10 backdrop-blur-md px-3 py-2 shadow-2xl`}>
        <Badge variant="outline" className="bg-orange-500/20 text-orange-200 border-orange-400/30">
          <Activity className="h-3 w-3 mr-1" />
          Dose
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onVisibilityChange(!isVisible)}
          className="h-6 w-6 text-orange-200 hover:bg-orange-500/20"
        >
          {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </Button>
        <div className="w-24">
          <Slider 
            value={[opacity]} 
            min={0} 
            max={1} 
            step={0.01} 
            onValueChange={handleOpacityChange}
            disabled={!isVisible}
            className="[&_[role=slider]]:bg-orange-400"
          />
        </div>
        {activeDescriptor ? (
          <span className="text-xs text-orange-100">
            {activeDescriptor.seriesDescription || 'RT Dose'}
          </span>
        ) : (
          <span className="text-xs text-orange-300/70">No dose selected</span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onToggleMinimized?.(false)} 
          className="h-8 w-8 text-orange-200 hover:bg-orange-500/20 hover:text-white transition-all duration-200 rounded-lg"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 ${panelRightPosition} z-50`}>
      <div className="w-[20rem] bg-orange-500/10 backdrop-blur-md border border-orange-400/40 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-orange-400/30 px-4 py-3">
          <div className="flex items-center gap-2 text-orange-100">
            <Activity className="h-4 w-4 text-orange-300" />
            <span className="text-base font-semibold">RT Dose</span>
            {isLoading && (
              <Badge variant="outline" className="bg-orange-900/40 border-orange-700/50 text-orange-200 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading
              </Badge>
            )}
            {loadError && (
              <Badge variant="outline" className="bg-red-900/40 border-red-700/50 text-red-200">
                Error
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Visibility toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onVisibilityChange(!isVisible)}
              className={cn(
                "h-8 w-8 transition-all duration-200 rounded-lg",
                isVisible 
                  ? "text-orange-200 hover:bg-orange-500/20" 
                  : "text-orange-400/50 hover:bg-orange-500/10"
              )}
            >
              {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onToggleMinimized?.(true)} 
              className="h-8 w-8 text-orange-200 hover:bg-orange-500/20 hover:text-white transition-all duration-200 rounded-lg"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4 text-orange-100">
          {loadError && (
            <div className="rounded-md border border-red-700/60 bg-red-900/30 px-3 py-2 text-sm text-red-200">
              {loadError}
            </div>
          )}

          {/* Dose Series Selector */}
          {doseSeriesOptions.length > 1 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-orange-300/70">Dose Series</span>
                <Badge variant="outline" className="bg-orange-800/40 border-orange-600/50 text-[10px] text-orange-200">
                  {doseSeriesOptions.length} available
                </Badge>
              </div>
              <div className="space-y-2">
                {doseSeriesOptions.map((dose) => {
                  const isActive = dose.id === selectedDoseSeriesId;
                  return (
                    <Button
                      key={dose.id}
                      variant={isActive ? 'default' : 'secondary'}
                      className={cn(
                        'w-full justify-between text-left text-xs',
                        isActive
                          ? 'bg-orange-600/70 hover:bg-orange-600 text-white'
                          : 'bg-orange-800/30 hover:bg-orange-700/40 text-orange-200',
                      )}
                      onClick={() => onDoseSeriesSelect(isActive ? null : dose.id)}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {dose.seriesDescription || 'RT Dose'}
                        </span>
                        {dose.maxDose && (
                          <span className="text-[10px] opacity-70">
                            Max: {dose.maxDose.toFixed(1)} Gy
                          </span>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Colormap Selection */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-orange-300/70">Colormap</div>
            <div className="grid grid-cols-3 gap-2">
              {COLORMAP_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={colormap === opt.value ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] h-8 flex-col gap-0.5',
                    colormap === opt.value
                      ? 'bg-orange-600/70 hover:bg-orange-600 text-white ring-2 ring-orange-400'
                      : 'bg-orange-800/30 hover:bg-orange-700/40 text-orange-200'
                  )}
                  onClick={() => onColormapChange(opt.value)}
                >
                  <div className={cn('w-full h-1.5 rounded-sm', opt.preview)} />
                  <span>{opt.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Opacity Slider */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-orange-300/70">
              <span>Dose Opacity</span>
              <span className="text-orange-200">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider 
              value={[opacity]} 
              min={0} 
              max={1} 
              step={0.01} 
              onValueChange={handleOpacityChange}
              disabled={!isVisible}
              className="[&_[role=slider]]:bg-orange-400"
            />
          </div>

          {/* Prescription Dose */}
          {onPrescriptionDoseChange && (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-orange-300/70">
                <span>Prescription Dose</span>
                <span className="text-orange-200">{prescriptionDose} Gy</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider 
                  value={[prescriptionDose]} 
                  min={10} 
                  max={80} 
                  step={1} 
                  onValueChange={(v) => onPrescriptionDoseChange(v[0])}
                  className="flex-1 [&_[role=slider]]:bg-orange-400"
                />
                <input
                  type="number"
                  value={prescriptionDose}
                  onChange={(e) => onPrescriptionDoseChange(parseFloat(e.target.value) || 60)}
                  className="w-14 px-2 py-1 text-xs bg-orange-900/40 border border-orange-600/30 rounded text-orange-100 text-center"
                  step={0.5}
                />
              </div>
            </div>
          )}

          {/* Isodose Lines Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-orange-300/70">Isodose Lines</span>
            <Button
              size="sm"
              variant={showIsodose ? 'default' : 'secondary'}
              className={cn(
                'text-xs',
                showIsodose
                  ? 'bg-orange-600/70 hover:bg-orange-600 text-white'
                  : 'bg-orange-800/30 hover:bg-orange-700/40 text-orange-200'
              )}
              onClick={() => onShowIsodoseChange(!showIsodose)}
            >
              <Layers className="h-3 w-3 mr-1" />
              {showIsodose ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {/* Isodose Levels Preview */}
          {showIsodose && (
            <div className="rounded-md border border-orange-600/30 bg-orange-900/20 px-3 py-2">
              <div className="text-[10px] text-orange-300/70 uppercase mb-2">Active Isodose Levels</div>
              <div className="flex flex-wrap gap-1.5">
                {isodoseLevels.map((level) => {
                  const color = getIsodoseColorHex(level);
                  return (
                    <div
                      key={level}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/30"
                    >
                      <div
                        className="w-3 h-[2px] rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] text-white/80">{level}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dose Statistics */}
          {metadata && (
            <div className="rounded-md border border-orange-600/30 bg-orange-900/20 px-3 py-2 text-[11px]">
              <div className="text-[10px] text-orange-300/70 uppercase mb-2">Dose Statistics</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-orange-200">
                <div className="flex justify-between">
                  <span className="text-orange-300/60">Min:</span>
                  <span>{formatDose(metadata.minDose || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-300/60">Max:</span>
                  <span className="text-red-300">{formatDose(metadata.maxDose || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-300/60">Grid:</span>
                  <span>{metadata.rows} × {metadata.columns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-300/60">Frames:</span>
                  <span>{metadata.numberOfFrames}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getIsodoseColorHex(percentage: number): string {
  const colors: Record<number, string> = {
    107: '#ff0080',
    105: '#ff0000',
    100: '#ff8000',
    95: '#ffff00',
    90: '#00ff00',
    80: '#00ffff',
    70: '#0080ff',
    50: '#0000ff',
    30: '#8000ff',
    10: '#404040',
  };
  
  const levels = Object.keys(colors).map(Number).sort((a, b) => b - a);
  for (const level of levels) {
    if (percentage >= level - 2) {
      return colors[level];
    }
  }
  return '#404040';
}

export default DoseControlPanel;

