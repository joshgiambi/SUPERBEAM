/**
 * Unified Fusion/Layout Toolbar V2
 * 
 * This is a comprehensive redesign that unifies:
 * 1. The fusion button in BottomToolbarPrototypeV2
 * 2. The FusionControlPanelV2 (right side panel in overlay mode)
 * 3. The CompactToolbar (top toolbar in FlexibleFusionLayout split/multi mode)
 * 
 * ACTUAL APPLICATION FLOW:
 * - Overlay mode: User clicks fusion button → FusionControlPanelV2 appears on right
 * - User selects layout preset (side-by-side, etc.) → Switches to FlexibleFusionLayout
 * - FlexibleFusionLayout shows CompactToolbar at top with layout controls
 * 
 * THIS UNIFIED TOOLBAR:
 * - Replaces all three components with one adaptive toolbar
 * - Shows fusion controls when in overlay mode (top of viewport)
 * - Shows layout controls when in split/multi mode (top of viewport)
 * - Maintains stable layout - controls don't jump around
 * 
 * Integration points:
 * - viewer-interface.tsx: fusionLayoutPreset, secondarySeriesId, showFusionPanel
 * - FlexibleFusionLayout: currentLayout, viewportCount, syncState
 * - FusionControlPanelV2: secondaryOptions, selectedSecondaryId, opacity
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Layers,
  Grid2x2,
  Columns,
  Rows,
  Maximize2,
  SunMedium,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  X,
  Plus,
  LayoutGrid,
  Loader2,
  SplitSquareHorizontal,
  Sparkles,
  Eye,
  EyeOff,
  Box,
  Info,
  Monitor,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  Zap,
  Layers2,
  PanelLeftClose,
  PanelRightClose,
  Rows3,
} from 'lucide-react';
import type { FusionLayoutPreset } from './fusion-control-panel-v2';
import type { FusionSecondaryDescriptor } from '@/types/fusion';

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedFusionLayoutToolbarProps {
  // Mode detection
  isOverlayMode: boolean; // true when fusionLayoutPreset === 'overlay'
  isSplitMode: boolean; // true when fusionLayoutPreset !== 'overlay' && secondarySeriesId !== null

  // Fusion state (from viewer-interface.tsx)
  fusionLayoutPreset: FusionLayoutPreset;
  onLayoutPresetChange: (preset: FusionLayoutPreset) => void;
  secondarySeriesId: number | null;
  onSecondarySeriesSelect: (id: number | null) => void;
  fusionOpacity: number;
  onFusionOpacityChange: (opacity: number) => void;
  fusionWindowLevel: { window: number; level: number } | null;
  onFusionWindowLevelChange: (wl: { window: number; level: number } | null) => void;

  // Secondary series data (from FusionControlPanelV2)
  secondaryOptions: FusionSecondaryDescriptor[];
  secondaryStatuses: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  manifestLoading: boolean;
  manifestError: string | null;

  // Layout state (from FlexibleFusionLayout)
  currentLayout?: 'single' | 'side-by-side' | 'primary-focus' | 'secondary-focus' | 'vertical-stack' | 'triple' | 'quad';
  onLayoutChange?: (layout: 'single' | 'side-by-side' | 'primary-focus' | 'secondary-focus' | 'vertical-stack' | 'triple' | 'quad') => void;
  viewportCount?: number;
  maxViewports?: number;
  assignedSecondaryIds?: number[];
  onAddViewport?: () => void;
  onAddViewportWithSecondary?: (secondaryId: number) => void;
  onSwapViewports?: () => void;

  // Sync state (from FlexibleFusionLayout)
  syncState?: {
    zoom: number;
    panX: number;
    panY: number;
    currentIndex: number;
    windowLevel: { window: number; center: number };
  };
  onSyncUpdate?: (updates: Partial<{ zoom: number; panX: number; panY: number; currentIndex: number; windowLevel: { window: number; center: number } }>) => void;

  // Actions
  onReset?: () => void;
  onExitToOverlay?: () => void;

  // Primary series info
  primarySeriesId?: number;
  primaryModality?: string;
}

// Layout presets matching FlexibleFusionLayout
const LAYOUT_PRESETS = [
  { id: 'single' as const, icon: <Maximize2 className="w-3.5 h-3.5" />, label: '1×1', viewports: 1, description: 'Single viewport' },
  { id: 'side-by-side' as const, icon: <Columns className="w-3.5 h-3.5" />, label: '1×2', viewports: 2, description: 'Side-by-side' },
  { id: 'primary-focus' as const, icon: <PanelLeftClose className="w-3.5 h-3.5" />, label: '70/30', viewports: 2, description: 'Primary focus' },
  { id: 'secondary-focus' as const, icon: <PanelRightClose className="w-3.5 h-3.5" />, label: '30/70', viewports: 2, description: 'Secondary focus' },
  { id: 'vertical-stack' as const, icon: <Rows className="w-3.5 h-3.5" />, label: '2×1', viewports: 2, description: 'Stacked vertically' },
  { id: 'triple' as const, icon: <SplitSquareHorizontal className="w-3.5 h-3.5" />, label: '1+2', viewports: 3, description: 'Triple layout' },
  { id: 'quad' as const, icon: <Grid2x2 className="w-3.5 h-3.5" />, label: '2×2', viewports: 4, description: 'Quad grid' },
];

// Fusion layout presets matching FusionControlPanelV2
const FUSION_LAYOUT_PRESETS: Array<{ id: FusionLayoutPreset; icon: React.ReactNode; label: string; description: string }> = [
  { id: 'overlay', icon: <Layers2 className="w-3.5 h-3.5" />, label: 'Overlay', description: 'Blend on single canvas' },
  { id: 'side-by-side', icon: <Columns className="w-3.5 h-3.5" />, label: 'Side-by-Side', description: '50/50 split' },
  { id: 'primary-focus', icon: <PanelLeftClose className="w-3.5 h-3.5" />, label: 'Primary Focus', description: '70/30 split' },
  { id: 'secondary-focus', icon: <PanelRightClose className="w-3.5 h-3.5" />, label: 'Secondary Focus', description: '30/70 split' },
  { id: 'vertical-stack', icon: <Rows3 className="w-3.5 h-3.5" />, label: 'Vertical Stack', description: 'Stacked vertically' },
  { id: 'triple', icon: <SplitSquareHorizontal className="w-3.5 h-3.5" />, label: 'Triple', description: '1+2 layout' },
  { id: 'quad', icon: <Grid2x2 className="w-3.5 h-3.5" />, label: 'Quad', description: '2×2 grid' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getModalityColor = (modality: string): 'amber' | 'purple' | 'blue' | 'gray' => {
  const mod = modality?.toUpperCase() || '';
  if (mod === 'PT' || mod === 'PET') return 'amber';
  if (mod === 'MR' || mod === 'MRI') return 'purple';
  if (mod === 'CT') return 'blue';
  return 'gray';
};

const getModalityStyles = (modality: string, isActive: boolean = false) => {
  const color = getModalityColor(modality);
  const colorMap = {
    amber: isActive
      ? 'bg-amber-600/90 border-amber-500 text-amber-50'
      : 'bg-amber-900/40 border-amber-600/40 text-amber-200 hover:bg-amber-800/50',
    purple: isActive
      ? 'bg-purple-600/90 border-purple-500 text-purple-50'
      : 'bg-purple-900/40 border-purple-600/40 text-purple-200 hover:bg-purple-800/50',
    blue: isActive
      ? 'bg-blue-600/90 border-blue-500 text-blue-50'
      : 'bg-blue-900/40 border-blue-600/40 text-blue-200 hover:bg-blue-800/50',
    gray: isActive
      ? 'bg-gray-600/90 border-gray-500 text-gray-50'
      : 'bg-gray-800/40 border-gray-600/40 text-gray-200 hover:bg-gray-700/50',
  };
  return colorMap[color];
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedFusionLayoutToolbar({
  isOverlayMode,
  isSplitMode,
  fusionLayoutPreset,
  onLayoutPresetChange,
  secondarySeriesId,
  onSecondarySeriesSelect,
  fusionOpacity,
  onFusionOpacityChange,
  fusionWindowLevel,
  onFusionWindowLevelChange,
  secondaryOptions,
  secondaryStatuses,
  manifestLoading,
  manifestError,
  currentLayout,
  onLayoutChange,
  viewportCount = 1,
  maxViewports = 4,
  assignedSecondaryIds = [],
  onAddViewport,
  onAddViewportWithSecondary,
  onSwapViewports,
  syncState,
  onSyncUpdate,
  onReset,
  onExitToOverlay,
  primarySeriesId,
  primaryModality = 'CT',
}: UnifiedFusionLayoutToolbarProps) {
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false);

  // Get active secondary descriptor
  const activeSecondary = useMemo(() => {
    return secondaryOptions.find((opt) => opt.secondarySeriesId === secondarySeriesId) || null;
  }, [secondaryOptions, secondarySeriesId]);

  // Available secondaries that aren't assigned
  const availableForAssignment = useMemo(() => {
    const assigned = new Set(assignedSecondaryIds);
    return secondaryOptions.filter((opt) => !assigned.has(opt.secondarySeriesId));
  }, [secondaryOptions, assignedSecondaryIds]);

  // Window level presets based on modality
  const windowLevelPresets = useMemo(() => {
    const modality = activeSecondary?.secondaryModality?.toUpperCase() || primaryModality?.toUpperCase() || 'CT';
    const presets: Record<string, Array<{ label: string; window: number; level: number }>> = {
      CT: [
        { label: 'Soft Tissue', window: 400, level: 40 },
        { label: 'Lung', window: 1500, level: -600 },
        { label: 'Bone', window: 1800, level: 400 },
      ],
      PT: [
        { label: 'Standard', window: 20000, level: 10000 },
        { label: 'High Uptake', window: 30000, level: 15000 },
      ],
      MR: [
        { label: 'T1', window: 600, level: 300 },
        { label: 'T2', window: 2000, level: 1000 },
        { label: 'FLAIR', window: 1800, level: 900 },
      ],
    };
    return presets[modality] || presets.CT;
  }, [activeSecondary?.secondaryModality, primaryModality]);

  // Render overlay mode toolbar (replaces FusionControlPanelV2)
  if (isOverlayMode) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#0f1219]/95 backdrop-blur-sm border-b border-white/[0.06]">
          {/* Left: Fusion Layout Presets */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Layout</span>
            <div className="flex items-center gap-1 bg-black/30 rounded-lg p-0.5 border border-white/5">
              {FUSION_LAYOUT_PRESETS.map((preset) => (
                <Tooltip key={preset.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onLayoutPresetChange(preset.id)}
                      className={cn(
                        'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                        fusionLayoutPreset === preset.id
                          ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                    >
                      {preset.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{preset.description}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Center: Secondary Series Selection + Opacity */}
          <div className="flex items-center gap-4 flex-1 justify-center">
            {/* Secondary Series Dropdown */}
            {secondaryOptions.length > 0 && (
              <DropdownMenu open={showSecondaryDropdown} onOpenChange={setShowSecondaryDropdown}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'px-3 py-1.5 rounded-md border transition-all flex items-center gap-2 text-xs font-medium',
                      activeSecondary
                        ? getModalityStyles(activeSecondary.secondaryModality || '', true)
                        : 'bg-gray-800/40 border-gray-600/40 text-gray-300 hover:bg-gray-700/50'
                    )}
                  >
                    {activeSecondary ? (
                      <>
                        <span className="text-xs font-bold">{activeSecondary.secondaryModality}</span>
                        <span className="text-[10px] opacity-80 truncate max-w-[120px]">
                          {activeSecondary.secondarySeriesDescription}
                        </span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Select Fusion Series</span>
                      </>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[280px] bg-gray-900/95 border-gray-700">
                  <div className="px-2 py-1.5 text-[10px] text-gray-400 uppercase border-b border-gray-700/50">
                    Available Fusion Series
                  </div>
                  {secondaryOptions.map((opt) => {
                    const status = secondaryStatuses.get(opt.secondarySeriesId);
                    const isReady = status?.status === 'ready';
                    const isSelected = opt.secondarySeriesId === secondarySeriesId;
                    return (
                      <DropdownMenuItem
                        key={opt.secondarySeriesId}
                        onClick={() => {
                          if (isReady) {
                            onSecondarySeriesSelect(isSelected ? null : opt.secondarySeriesId);
                            setShowSecondaryDropdown(false);
                          }
                        }}
                        disabled={!isReady}
                        className="text-xs cursor-pointer flex items-center gap-2"
                      >
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            isReady
                              ? getModalityColor(opt.secondaryModality || '') === 'amber'
                                ? 'bg-amber-500'
                                : getModalityColor(opt.secondaryModality || '') === 'purple'
                                  ? 'bg-purple-500'
                                  : 'bg-blue-500'
                              : 'bg-gray-500 animate-pulse'
                          )}
                        />
                        <div className="flex flex-col flex-1">
                          <span className="font-medium">{opt.secondaryModality}</span>
                          <span className="text-[10px] text-gray-400 truncate">
                            {opt.secondarySeriesDescription}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        {status?.status === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Opacity Slider */}
            {activeSecondary && (
              <>
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-md border border-white/10 min-w-[180px]">
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide">Opacity</span>
                  <Slider
                    value={[fusionOpacity * 100]}
                    onValueChange={([val]) => onFusionOpacityChange(val / 100)}
                    max={100}
                    className="flex-1 [&>span:first-child]:h-1.5 [&>span:first-child]:bg-gray-700 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                  <span
                    className={cn(
                      'text-[10px] font-medium min-w-[32px] text-center tabular-nums',
                      getModalityColor(activeSecondary.secondaryModality || '') === 'amber'
                        ? 'text-amber-300'
                        : getModalityColor(activeSecondary.secondaryModality || '') === 'purple'
                          ? 'text-purple-300'
                          : 'text-cyan-300'
                    )}
                  >
                    {Math.round(fusionOpacity * 100)}%
                  </span>
                </div>
              </>
            )}

            {/* Window Level Presets */}
            {activeSecondary && fusionWindowLevel && (
              <>
                <div className="w-px h-4 bg-white/20" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-900/50 text-orange-200 border border-orange-600/30 hover:bg-orange-900/70 transition-colors cursor-pointer">
                      <SunMedium className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">W/L</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[140px] bg-gray-900/95 border-gray-700">
                    <div className="px-2 py-1.5 text-[10px] text-gray-400 uppercase border-b border-gray-700/50">
                      {activeSecondary.secondaryModality} Presets
                    </div>
                    {windowLevelPresets.map((p) => (
                      <DropdownMenuItem
                        key={p.label}
                        onClick={() => onFusionWindowLevelChange({ window: p.window, level: p.level })}
                        className="text-xs cursor-pointer"
                      >
                        {p.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Right: Reset */}
          {onReset && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onReset}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Reset</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Render split/multi mode toolbar (replaces CompactToolbar)
  if (isSplitMode) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#0f1219]/95 backdrop-blur-sm border-b border-white/[0.06]">
          {/* Left: Layout Presets */}
          <div className="flex items-center gap-1 bg-black/30 rounded-lg p-0.5 border border-white/5">
            {LAYOUT_PRESETS.map((preset) => (
              <Tooltip key={preset.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onLayoutChange?.(preset.id)}
                    className={cn(
                      'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                      currentLayout === preset.id
                        ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    )}
                  >
                    {preset.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{preset.description}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Viewport Actions */}
          <div className="flex items-center gap-1">
            {viewportCount >= 2 && onSwapViewports && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onSwapViewports}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Swap viewports</TooltipContent>
              </Tooltip>
            )}

            {viewportCount < maxViewports && onAddViewport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onAddViewport}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Add viewport</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Center: Opacity + Available Secondaries */}
          <div className="flex items-center gap-4 flex-1 justify-center">
            {/* Opacity Control */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-md border border-white/10">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">Opacity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={fusionOpacity}
                onChange={(e) => onFusionOpacityChange(parseFloat(e.target.value))}
                className="w-20 h-1 accent-cyan-500 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-cyan-300 font-medium min-w-[32px] text-center tabular-nums">
                {Math.round(fusionOpacity * 100)}%
              </span>
            </div>

            <div className="w-px h-4 bg-white/20" />

            {/* Available Secondaries */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Add</span>
              {availableForAssignment.length === 0 ? (
                <span className="text-[10px] text-gray-600">All assigned</span>
              ) : (
                availableForAssignment.slice(0, 6).map((opt) => {
                  const status = secondaryStatuses.get(opt.secondarySeriesId);
                  const isReady = status?.status === 'ready';
                  const modality = opt.secondaryModality || 'SEC';
                  const colorClass = getModalityColor(modality);
                  const canAdd = viewportCount < maxViewports;

                  return (
                    <Tooltip key={opt.secondarySeriesId}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => canAdd && isReady && onAddViewportWithSecondary?.(opt.secondarySeriesId)}
                          disabled={!canAdd || !isReady}
                          className={cn(
                            'px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-all flex items-center gap-1',
                            isReady && canAdd
                              ? colorClass === 'amber'
                                ? 'bg-amber-500/20 text-amber-200 border-amber-400/40 hover:bg-amber-500/30'
                                : colorClass === 'purple'
                                  ? 'bg-purple-500/20 text-purple-200 border-purple-400/40 hover:bg-purple-500/30'
                                  : 'bg-blue-500/20 text-blue-200 border-blue-400/40 hover:bg-blue-500/30'
                              : 'bg-gray-800/20 text-gray-500 border-gray-700/30 cursor-not-allowed'
                          )}
                        >
                          {modality}
                          {status?.status === 'loading' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                          {isReady && canAdd && <Plus className="w-2.5 h-2.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {isReady && canAdd
                          ? `Add ${modality} viewport`
                          : !isReady
                            ? `${modality} loading...`
                            : 'Max viewports reached'}
                      </TooltipContent>
                    </Tooltip>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Zoom Sync + Reset + Exit */}
          <div className="flex items-center gap-3">
            {/* Zoom Sync Controls */}
            {syncState && onSyncUpdate && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/40 rounded-md border border-white/10">
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide">Zoom</span>
                  <button
                    onClick={() => onSyncUpdate({ zoom: Math.max(0.25, syncState.zoom - 0.25) })}
                    className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="0.25"
                    max="4"
                    step="0.05"
                    value={syncState.zoom}
                    onChange={(e) => onSyncUpdate({ zoom: parseFloat(e.target.value) })}
                    className="w-16 h-1 accent-cyan-500 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    onClick={() => onSyncUpdate({ zoom: Math.min(4, syncState.zoom + 0.25) })}
                    className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-cyan-300 font-medium min-w-[32px] text-center tabular-nums">
                    {Math.round(syncState.zoom * 100)}%
                  </span>
                </div>
                <div className="w-px h-4 bg-white/20" />
              </>
            )}

            {/* Slice Info */}
            {syncState && (
              <>
                <span className="text-[10px] text-gray-500">
                  Slice <span className="text-gray-300 font-medium">{syncState.currentIndex + 1}</span>
                </span>
                <div className="w-px h-4 bg-white/20" />
              </>
            )}

            {/* Reset */}
            {onReset && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onReset}
                    className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Reset view</TooltipContent>
              </Tooltip>
            )}

            {/* Exit to Overlay */}
            {onExitToOverlay && (
              <>
                <div className="w-px h-5 bg-red-500/30" />
                <button
                  onClick={onExitToOverlay}
                  className="h-7 px-3 gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/40 hover:border-red-500/60 rounded-md transition-all flex items-center text-xs font-medium"
                >
                  <X className="w-3.5 h-3.5" />
                  Exit Split
                </button>
              </>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Fallback: no toolbar (shouldn't happen)
  return null;
}

// ============================================================================
// PROTOTYPE DEMO COMPONENT
// ============================================================================

export function UnifiedFusionLayoutToolbarV2() {
  const [isOverlayMode, setIsOverlayMode] = useState(true);
  const [fusionLayoutPreset, setFusionLayoutPreset] = useState<FusionLayoutPreset>('overlay');
  const [secondarySeriesId, setSecondarySeriesId] = useState<number | null>(null);
  const [fusionOpacity, setFusionOpacity] = useState(0.6);
  const [currentLayout, setCurrentLayout] = useState<'single' | 'side-by-side' | 'primary-focus' | 'secondary-focus' | 'vertical-stack' | 'triple' | 'quad'>('side-by-side');
  const [viewportCount, setViewportCount] = useState(2);
  const [assignedSecondaryIds, setAssignedSecondaryIds] = useState<number[]>([]);
  const [syncState, setSyncState] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
    currentIndex: 142,
    windowLevel: { window: 400, center: 40 },
  });

  const mockSecondaryOptions: FusionSecondaryDescriptor[] = [
    {
      secondarySeriesId: 1,
      secondaryModality: 'PT',
      secondarySeriesDescription: 'QCFX MAC HN 2.5mm',
      windowCenter: [10000],
      windowWidth: [20000],
    },
    {
      secondarySeriesId: 2,
      secondaryModality: 'MR',
      secondarySeriesDescription: 'T1 AXIAL POST',
      windowCenter: [300],
      windowWidth: [600],
    },
    {
      secondarySeriesId: 3,
      secondaryModality: 'MR',
      secondarySeriesDescription: 'T2 FLAIR',
      windowCenter: [1000],
      windowWidth: [2000],
    },
  ];

  const mockSecondaryStatuses = new Map([
    [1, { status: 'ready' as const }],
    [2, { status: 'ready' as const }],
    [3, { status: 'loading' as const }],
  ]);

  const handleLayoutPresetChange = (preset: FusionLayoutPreset) => {
    setFusionLayoutPreset(preset);
    setIsOverlayMode(preset === 'overlay');
    if (preset !== 'overlay') {
      setCurrentLayout(preset as any);
    }
  };

  return (
    <div className="space-y-8 p-8">
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            Unified Fusion/Layout Toolbar V2
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-gray-400 space-y-2">
          <p>
            <strong className="text-white">Overlay Mode:</strong> Shows fusion layout presets, secondary series
            selection, opacity control, and window/level presets.
          </p>
          <p>
            <strong className="text-white">Split/Multi Mode:</strong> Shows layout presets, viewport management, zoom
            sync, and exit button.
          </p>
          <p>
            <strong className="text-white">Stable Layout:</strong> Toolbar structure remains consistent, only content
            changes based on mode.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Test States
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setIsOverlayMode(true);
                setFusionLayoutPreset('overlay');
                setSecondarySeriesId(null);
              }}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium',
                isOverlayMode && fusionLayoutPreset === 'overlay'
                  ? 'bg-gray-600/30 border-gray-500/50 text-white'
                  : 'bg-gray-800/30 border-gray-700/30 text-gray-400'
              )}
            >
              Overlay Mode (No Selection)
            </button>
            <button
              onClick={() => {
                setIsOverlayMode(true);
                setFusionLayoutPreset('overlay');
                setSecondarySeriesId(1);
              }}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium',
                isOverlayMode && secondarySeriesId === 1
                  ? 'bg-amber-600/30 border-amber-500/50 text-amber-200'
                  : 'bg-gray-800/30 border-gray-700/30 text-gray-400'
              )}
            >
              Overlay Mode (PT Selected)
            </button>
            <button
              onClick={() => {
                setIsOverlayMode(false);
                setFusionLayoutPreset('side-by-side');
                setSecondarySeriesId(2);
                setViewportCount(2);
              }}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium',
                !isOverlayMode && fusionLayoutPreset === 'side-by-side'
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                  : 'bg-gray-800/30 border-gray-700/30 text-gray-400'
              )}
            >
              Split Mode (Side-by-Side)
            </button>
            <button
              onClick={() => {
                setIsOverlayMode(false);
                setFusionLayoutPreset('quad');
                setSecondarySeriesId(1);
                setViewportCount(4);
                setAssignedSecondaryIds([1, 2, 3]);
              }}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium',
                !isOverlayMode && fusionLayoutPreset === 'quad'
                  ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                  : 'bg-gray-800/30 border-gray-700/30 text-gray-400'
              )}
            >
              Multi Mode (Quad)
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">UNIFIED TOOLBAR</CardTitle>
          <CardDescription>Adapts based on overlay vs split/multi mode</CardDescription>
        </CardHeader>
        <CardContent className="p-4 bg-black/50 rounded-xl border border-gray-800">
          <UnifiedFusionLayoutToolbar
            isOverlayMode={isOverlayMode}
            isSplitMode={!isOverlayMode && secondarySeriesId !== null}
            fusionLayoutPreset={fusionLayoutPreset}
            onLayoutPresetChange={handleLayoutPresetChange}
            secondarySeriesId={secondarySeriesId}
            onSecondarySeriesSelect={setSecondarySeriesId}
            fusionOpacity={fusionOpacity}
            onFusionOpacityChange={setFusionOpacity}
            fusionWindowLevel={secondarySeriesId ? { window: 20000, level: 10000 } : null}
            onFusionWindowLevelChange={() => {}}
            secondaryOptions={mockSecondaryOptions}
            secondaryStatuses={mockSecondaryStatuses}
            manifestLoading={false}
            manifestError={null}
            currentLayout={currentLayout}
            onLayoutChange={setCurrentLayout}
            viewportCount={viewportCount}
            maxViewports={4}
            assignedSecondaryIds={assignedSecondaryIds}
            onAddViewport={() => setViewportCount(Math.min(4, viewportCount + 1))}
            onAddViewportWithSecondary={(id) => {
              setAssignedSecondaryIds([...assignedSecondaryIds, id]);
              setViewportCount(Math.min(4, viewportCount + 1));
            }}
            onSwapViewports={() => {}}
            syncState={syncState}
            onSyncUpdate={(updates) => setSyncState({ ...syncState, ...updates })}
            onReset={() => {}}
            onExitToOverlay={() => {
              setIsOverlayMode(true);
              setFusionLayoutPreset('overlay');
              setViewportCount(1);
              setAssignedSecondaryIds([]);
            }}
            primarySeriesId={1}
            primaryModality="CT"
          />
        </CardContent>
      </Card>
    </div>
  );
}







