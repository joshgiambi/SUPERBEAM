/**
 * RadiationTherapyPanel - Combined RT Dose and RT Plan visualization panel
 * 
 * Unified floating control panel with tabs for:
 * - Dose: RT Dose colorwash, isodose lines, DVH
 * - Plan: Beam list, geometry, BEV (Beam's Eye View)
 */

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff, 
  Layers, 
  Atom, 
  ChevronDown, 
  ChevronUp,
  BarChart3,
  Calculator,
  Target,
  LineChart,
  PaintBucket,
  Grid3X3,
  Zap,
  Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  type DoseColormap,
  type DoseUnit,
  type DoseDisplayMode,
  type RTDoseMetadata,
  formatDose,
} from '@/lib/rt-dose-manager';
import { RTPlanPanel } from './rt-plan-panel';
import { type BeamSummary, type BEVProjection, getBeamColor } from '@/types/rt-plan';

// Types
interface DoseSeriesOption {
  id: number;
  seriesDescription: string;
  maxDose?: number;
  doseType?: string;
}

interface PlanSeriesOption {
  id: number;
  seriesDescription: string;
}

type PanelTab = 'dose' | 'plan';

interface RadiationTherapyPanelProps {
  // Dose series
  doseSeriesOptions: DoseSeriesOption[];
  selectedDoseSeriesId: number | null;
  onDoseSeriesSelect: (seriesId: number | null) => void;
  
  // Dose display settings
  doseOpacity: number;
  onDoseOpacityChange: (opacity: number) => void;
  doseColormap: DoseColormap;
  onColormapChange: (colormap: DoseColormap) => void;
  doseUnit?: DoseUnit;
  onDoseUnitChange?: (unit: DoseUnit) => void;
  displayMode?: DoseDisplayMode;
  onDisplayModeChange?: (mode: DoseDisplayMode) => void;
  showIsodose: boolean;
  onShowIsodoseChange: (show: boolean) => void;
  isodoseLevels: number[];
  prescriptionDose?: number;
  doseVisible: boolean;
  onDoseVisibilityChange: (visible: boolean) => void;
  doseLoading?: boolean;
  doseError?: string | null;
  doseMetadata?: RTDoseMetadata | null;
  
  // Plan series
  planSeriesOptions: PlanSeriesOption[];
  selectedPlanSeriesId: number | null;
  onPlanSeriesSelect: (seriesId: number | null) => void;
  
  // Beam overlay settings
  showBeamOverlay: boolean;
  onShowBeamOverlayChange: (show: boolean) => void;
  selectedBeamNumber: number | null;
  onSelectBeam: (beamNumber: number | null) => void;
  beamOverlayOpacity: number;
  onBeamOverlayOpacityChange: (opacity: number) => void;
  
  // Callback for beam data
  onBeamsLoaded?: (beams: BeamSummary[], bevProjections: BEVProjection[]) => void;
  
  // Panel state
  minimized?: boolean;
  onToggleMinimized?: (minimized: boolean) => void;
  fusionPanelVisible?: boolean;
  
  // DVH support and BEV enhancement
  structureSetId?: number;
  ctSeriesId?: number;
  
  // Quick actions
  onLocalizeMaxDose?: () => void;
  onOpenBEDCalculator?: () => void;
}

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

export function RadiationTherapyPanel({
  // Dose props
  doseSeriesOptions,
  selectedDoseSeriesId,
  onDoseSeriesSelect,
  doseOpacity,
  onDoseOpacityChange,
  doseColormap,
  onColormapChange,
  doseUnit = 'Gy',
  onDoseUnitChange,
  displayMode = 'lines_and_colorwash',
  onDisplayModeChange,
  showIsodose,
  onShowIsodoseChange,
  isodoseLevels,
  prescriptionDose = 60,
  doseVisible,
  onDoseVisibilityChange,
  doseLoading = false,
  doseError,
  doseMetadata,
  
  // Plan props
  planSeriesOptions,
  selectedPlanSeriesId,
  onPlanSeriesSelect,
  showBeamOverlay,
  onShowBeamOverlayChange,
  selectedBeamNumber,
  onSelectBeam,
  beamOverlayOpacity,
  onBeamOverlayOpacityChange,
  onBeamsLoaded,
  
  // Panel state
  minimized = false,
  onToggleMinimized,
  fusionPanelVisible = false,
  
  // DVH and BEV enhancement
  structureSetId,
  ctSeriesId,
  
  // Actions
  onLocalizeMaxDose,
  onOpenBEDCalculator,
}: RadiationTherapyPanelProps) {
  // Determine active tab based on available data
  const hasPlans = planSeriesOptions.length > 0;
  const hasDose = doseSeriesOptions.length > 0;
  
  // Debug logging
  console.log('[RadiationTherapyPanel] Rendering:', {
    hasPlans,
    hasDose,
    planSeriesCount: planSeriesOptions.length,
    doseSeriesCount: doseSeriesOptions.length,
    selectedPlanSeriesId,
    selectedDoseSeriesId,
  });
  
  const [activeTab, setActiveTab] = useState<PanelTab>(hasDose ? 'dose' : 'plan');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandBEV, setExpandBEV] = useState(false);
  
  // Position calculation
  const panelRightPosition = fusionPanelVisible ? 'right-[24rem]' : 'right-6';
  
  // No RT data available
  if (!hasDose && !hasPlans) {
    return null;
  }
  
  // Minimized state
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
              <Atom className="h-4 w-4 text-zinc-300" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            </div>
            <span className="text-sm font-medium text-zinc-100">RT</span>
          </div>
          
          <div className="h-4 w-px bg-zinc-500/30" />
          
          {/* Quick visibility toggles */}
          {hasDose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDoseVisibilityChange(!doseVisible)}
              className="h-7 w-7 rounded-lg text-zinc-200 hover:bg-zinc-500/20 transition-all"
              title="Toggle Dose"
            >
              {doseVisible ? <Atom className="h-3.5 w-3.5 text-orange-400" /> : <Atom className="h-3.5 w-3.5 opacity-50" />}
            </Button>
          )}
          
          {hasPlans && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onShowBeamOverlayChange(!showBeamOverlay)}
              className="h-7 w-7 rounded-lg text-zinc-200 hover:bg-zinc-500/20 transition-all"
              title="Toggle Beams"
            >
              {showBeamOverlay ? <Crosshair className="h-3.5 w-3.5 text-blue-400" /> : <Crosshair className="h-3.5 w-3.5 opacity-50" />}
            </Button>
          )}
          
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
        className={cn(
          "rounded-2xl border border-zinc-600/30 shadow-2xl shadow-black/40 overflow-hidden transition-all duration-300",
          expandBEV ? "w-[28rem]" : "w-80"
        )}
        style={{
          background: 'linear-gradient(180deg, rgba(80, 80, 90, 0.20) 0%, rgba(20, 20, 25, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-2 py-2 border-b border-zinc-600/25">
          <div className="flex items-center gap-1">
            {/* Tab buttons */}
            {hasDose && (
              <button
                onClick={() => setActiveTab('dose')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  activeTab === 'dose'
                    ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                )}
              >
                <Atom className="h-3.5 w-3.5" />
                Dose
              </button>
            )}
            {hasPlans && (
              <button
                onClick={() => setActiveTab('plan')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  activeTab === 'plan'
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                Plan
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {doseLoading && <Loader2 className="h-3.5 w-3.5 text-zinc-400 animate-spin" />}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onToggleMinimized?.(true)} 
              className="h-7 w-7 rounded-lg text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-200 transition-all"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'dose' && hasDose && (
            <DoseTabContent
              doseSeriesOptions={doseSeriesOptions}
              selectedDoseSeriesId={selectedDoseSeriesId}
              onDoseSeriesSelect={onDoseSeriesSelect}
              opacity={doseOpacity}
              onOpacityChange={onDoseOpacityChange}
              doseUnit={doseUnit}
              onDoseUnitChange={onDoseUnitChange}
              displayMode={displayMode}
              onDisplayModeChange={onDisplayModeChange}
              showIsodose={showIsodose}
              onShowIsodoseChange={onShowIsodoseChange}
              isodoseLevels={isodoseLevels}
              prescriptionDose={prescriptionDose}
              isVisible={doseVisible}
              onVisibilityChange={onDoseVisibilityChange}
              loadError={doseError}
              metadata={doseMetadata}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
              structureSetId={structureSetId}
              onLocalizeMaxDose={onLocalizeMaxDose}
              onOpenBEDCalculator={onOpenBEDCalculator}
            />
          )}
          
          {activeTab === 'plan' && hasPlans && (
            <RTPlanPanel
              planSeriesOptions={planSeriesOptions}
              selectedPlanSeriesId={selectedPlanSeriesId}
              onPlanSeriesSelect={onPlanSeriesSelect}
              showBeamOverlay={showBeamOverlay}
              onShowBeamOverlayChange={onShowBeamOverlayChange}
              selectedBeamNumber={selectedBeamNumber}
              onSelectBeam={onSelectBeam}
              beamOverlayOpacity={beamOverlayOpacity}
              onBeamOverlayOpacityChange={onBeamOverlayOpacityChange}
              onBeamsLoaded={onBeamsLoaded}
              expandBEV={expandBEV}
              onToggleExpandBEV={() => setExpandBEV(!expandBEV)}
              ctSeriesId={(() => {
                console.log('[RadiationTherapyPanel] Passing to RTPlanPanel:', { ctSeriesId, structureSetId });
                return ctSeriesId;
              })()}
              structureSetId={structureSetId}
              showDRR={true}
              showStructuresInBEV={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Dose Tab Content (extracted from original DoseControlPanel)
interface DoseTabContentProps {
  doseSeriesOptions: DoseSeriesOption[];
  selectedDoseSeriesId: number | null;
  onDoseSeriesSelect: (seriesId: number | null) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  doseUnit?: DoseUnit;
  onDoseUnitChange?: (unit: DoseUnit) => void;
  displayMode?: DoseDisplayMode;
  onDisplayModeChange?: (mode: DoseDisplayMode) => void;
  showIsodose: boolean;
  onShowIsodoseChange: (show: boolean) => void;
  isodoseLevels: number[];
  prescriptionDose: number;
  isVisible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  loadError?: string | null;
  metadata?: RTDoseMetadata | null;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  structureSetId?: number;
  onLocalizeMaxDose?: () => void;
  onOpenBEDCalculator?: () => void;
}

function DoseTabContent({
  doseSeriesOptions,
  selectedDoseSeriesId,
  onDoseSeriesSelect,
  opacity,
  onOpacityChange,
  doseUnit = 'Gy',
  onDoseUnitChange,
  displayMode = 'lines_and_colorwash',
  onDisplayModeChange,
  showIsodose,
  onShowIsodoseChange,
  isodoseLevels,
  prescriptionDose,
  isVisible,
  onVisibilityChange,
  loadError,
  metadata,
  showAdvanced,
  onToggleAdvanced,
  structureSetId,
  onLocalizeMaxDose,
  onOpenBEDCalculator,
}: DoseTabContentProps) {
  const handleOpacityChange = (values: number[]) => {
    const next = values[0];
    if (typeof next === 'number' && !Number.isNaN(next)) {
      onOpacityChange(Math.max(0, Math.min(1, next)));
    }
  };
  
  return (
    <div className="space-y-5">
      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {loadError}
        </div>
      )}

      {/* Visibility Toggle */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-zinc-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Show Dose</span>
        </div>
        <button
          onClick={() => onVisibilityChange(!isVisible)}
          className={cn(
            "relative w-11 h-6 rounded-full transition-all duration-200",
            isVisible 
              ? "bg-gradient-to-r from-orange-600 to-orange-500" 
              : "bg-zinc-700"
          )}
        >
          <div
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200",
              isVisible ? "left-6" : "left-1"
            )}
          />
        </button>
      </div>

      {/* Opacity Control */}
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
          className="[&_[role=slider]]:bg-orange-400 [&_[role=slider]]:border-orange-500"
        />
      </div>

      {/* Dose Unit Toggle */}
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

      {/* Display Mode */}
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
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800/50 border border-transparent"
                )}
              >
                {mode.icon}
                <span className="truncate w-full text-center">{mode.label}</span>
              </button>
            ))}
          </div>
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
        onClick={onToggleAdvanced}
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

      {/* Dose Series Selector */}
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

      {/* Quick Actions */}
      <div className="flex gap-2 pt-3 border-t border-zinc-600/15">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (selectedDoseSeriesId) {
              const params = new URLSearchParams();
              params.set('doseSeriesId', selectedDoseSeriesId.toString());
              if (structureSetId) params.set('structureSetId', structureSetId.toString());
              params.set('prescriptionDose', prescriptionDose.toString());
              params.set('doseUnit', doseUnit);
              
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
        >
          <Calculator className="w-3.5 h-3.5 mr-1.5" />
          BED
        </Button>
      </div>
    </div>
  );
}

export default RadiationTherapyPanel;
