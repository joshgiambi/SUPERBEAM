/**
 * UnifiedFusionTopbar
 * 
 * Production component based on unified-fusion-toolbar-prototype.tsx
 * 
 * Design:
 * - Main topbar info on the left (modality, slice, W/L, etc.)
 * - Fusion button ALWAYS to the RIGHT (consistent position)
 * - Fusion button is wide, shows fusion state summary
 * - Dropdown aligns to RIGHT edge, expands downward
 * - Clean dark fusion panel styling
 * - Includes view mode buttons (Single/Split/Multi) when fusion available
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { pillClass, pillClassForModality, type PillColor } from '@/lib/pills';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Eye,
  EyeOff,
  Box,
  Monitor,
  SplitSquareHorizontal,
  Zap,
  ChevronDown,
  Rows3,
  SunMedium,
  Loader2,
} from 'lucide-react';
import type { FusionSecondaryDescriptor } from '@/types/fusion';
import type { FusionLayoutPreset } from './fusion-control-panel-v2';

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedFusionTopbarProps {
  // Primary series info
  primaryModality?: string;
  primarySeriesDescription?: string;
  currentSlice?: number;
  totalSlices?: number;
  windowLevel?: { window: number; level: number };
  zPosition?: number;
  orientation?: 'axial' | 'sagittal' | 'coronal';
  
  // Navigation
  onPrevSlice?: () => void;
  onNextSlice?: () => void;
  onReset?: () => void;
  
  // RT Structures
  rtStructuresCount?: number;
  rtStructuresVisible?: boolean;
  onToggleStructures?: () => void;
  
  // MPR
  showMPR?: boolean;
  onToggleMPR?: () => void;
  
  // Fusion state
  secondarySeriesId: number | null;
  onSecondarySeriesSelect: (id: number | null) => void;
  fusionOpacity: number;
  onFusionOpacityChange: (opacity: number) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  onFusionWindowLevelChange?: (wl: { window: number; level: number } | null) => void;
  
  // Secondary series data
  secondaryOptions: FusionSecondaryDescriptor[];
  secondaryStatuses: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  manifestLoading?: boolean;
  manifestError?: string | null;
  // True if there are potential fusion series (from REG associations) even before manifest loads
  hasPotentialFusions?: boolean;
  
  // Layout mode
  fusionLayoutPreset: FusionLayoutPreset;
  onLayoutPresetChange: (preset: FusionLayoutPreset) => void;
  
  // View mode for superfuse
  viewMode?: 'single' | 'split' | 'multi';
  onViewModeChange?: (mode: 'single' | 'split' | 'multi') => void;
  
  // Panel visibility control
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  
  className?: string;
}

// Window/Level presets per modality
const MODALITY_WINDOW_PRESETS: Record<string, Array<{ label: string; window: number; level: number }>> = {
  CT: [
    { label: 'Soft Tissue', window: 400, level: 40 },
    { label: 'Lung', window: 1500, level: -600 },
    { label: 'Bone', window: 1800, level: 400 },
    { label: 'Brain', window: 80, level: 40 },
  ],
  MR: [
    { label: 'T1', window: 600, level: 300 },
    { label: 'T2', window: 2000, level: 1000 },
    { label: 'FLAIR', window: 1800, level: 900 },
  ],
  MRI: [
    { label: 'T1', window: 600, level: 300 },
    { label: 'T2', window: 2000, level: 1000 },
    { label: 'FLAIR', window: 1800, level: 900 },
  ],
  PT: [
    { label: 'Standard', window: 20000, level: 10000 },
    { label: 'High Uptake', window: 30000, level: 15000 },
  ],
  PET: [
    { label: 'Standard', window: 20000, level: 10000 },
    { label: 'High Uptake', window: 30000, level: 15000 },
  ],
};

// ============================================================================
// HELPERS
// ============================================================================

const getModalityColor = (modality: string): 'amber' | 'purple' | 'blue' | 'gray' => {
  const mod = modality?.toUpperCase() || '';
  if (mod === 'PT' || mod === 'PET') return 'amber';
  if (mod === 'MR' || mod === 'MRI') return 'purple';
  if (mod === 'CT') return 'blue';
  return 'gray';
};

const getModalityBadgeStyles = (modality: string) => {
  const color = getModalityColor(modality);
  return {
    amber: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
    purple: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    gray: 'bg-gray-500/20 border-gray-500/50 text-gray-300',
  }[color];
};

const getDotColor = (modality: string) => {
  const color = getModalityColor(modality);
  return { amber: 'bg-amber-400', purple: 'bg-purple-400', blue: 'bg-blue-400', gray: 'bg-gray-400' }[color];
};

// ============================================================================
// MAIN TOPBAR INFO SECTION (LEFT SIDE)
// ============================================================================

interface TopbarInfoProps {
  primaryModality?: string;
  currentSlice?: number;
  totalSlices?: number;
  windowLevel?: { window: number; level: number };
  zPosition?: number;
  orientation?: 'axial' | 'sagittal' | 'coronal';
  hasFusionActive: boolean;
  fusionOpacity: number;
  selectedSecondary: FusionSecondaryDescriptor | null;
  rtStructuresCount?: number;
  rtStructuresVisible?: boolean;
  onToggleStructures?: () => void;
  showMPR?: boolean;
  onToggleMPR?: () => void;
  onPrevSlice?: () => void;
  onNextSlice?: () => void;
  onReset?: () => void;
}

function TopbarInfo({
  primaryModality = 'CT',
  currentSlice = 1,
  totalSlices = 1,
  windowLevel,
  zPosition,
  orientation = 'axial',
  hasFusionActive,
  fusionOpacity,
  selectedSecondary,
  rtStructuresCount,
  rtStructuresVisible,
  onToggleStructures,
  showMPR,
  onToggleMPR,
  onPrevSlice,
  onNextSlice,
  onReset,
}: TopbarInfoProps) {
  const fusionColor = selectedSecondary ? getModalityColor(selectedSecondary.secondaryModality) : 'gray';

  // Map modality to pill color
  const modalityPillColor: PillColor = (() => {
    const mod = primaryModality?.toUpperCase() || '';
    if (mod === 'CT') return 'blue';
    if (mod === 'MR' || mod === 'MRI') return 'purple';
    if (mod === 'PT' || mod === 'PET' || mod === 'NM') return 'amber';
    if (mod === 'RT' || mod === 'RTSTRUCT') return 'green';
    if (mod === 'REG') return 'cyan';
    return 'gray';
  })();

  // Map fusion modality to pill color
  const fusionPillColor: PillColor = (() => {
    const mod = selectedSecondary?.secondaryModality?.toUpperCase() || '';
    if (mod === 'PT' || mod === 'PET' || mod === 'NM') return 'amber';
    if (mod === 'MR' || mod === 'MRI') return 'purple';
    if (mod === 'CT') return 'blue';
    return 'gray';
  })();

  return (
    <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
      {/* LEFT: Primary Info Pills - Using centralized pill styling */}
      <div className="flex items-center gap-1.5 flex-shrink-0 overflow-x-auto">
        <span className={pillClass(modalityPillColor, 'subtle')}>
          {primaryModality} Scan
        </span>
        <span className={pillClass('gray', 'subtle')}>
          {currentSlice}/{totalSlices}
        </span>
        {windowLevel && (
          <>
            <span className={pillClass('cyan', 'subtle')}>
              W: {Math.round(windowLevel.window)}
            </span>
            <span className={pillClass('orange', 'subtle')}>
              L: {Math.round(windowLevel.level)}
            </span>
          </>
        )}
        {orientation === 'axial' && typeof zPosition === 'number' && !isNaN(zPosition) && (
          <span className={pillClass('purple', 'subtle')}>
            Z: {zPosition.toFixed(1)}
          </span>
        )}
        
        {/* Active fusion badge */}
        {hasFusionActive && selectedSecondary && (
          <span className={cn(pillClass(fusionPillColor, 'subtle'), "gap-1.5")}>
            <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", getDotColor(selectedSecondary.secondaryModality))} />
            {selectedSecondary.secondaryModality} {Math.round(fusionOpacity * 100)}%
          </span>
        )}
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onToggleMPR && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onToggleMPR} 
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                  showMPR ? "bg-cyan-900/60 text-cyan-200" : "text-gray-500 hover:text-white hover:bg-white/10"
                )}
              >
                <Box className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">MPR</TooltipContent>
          </Tooltip>
        )}

        {rtStructuresCount !== undefined && rtStructuresCount > 0 && onToggleStructures && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onToggleStructures} 
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-lg transition-colors relative",
                  rtStructuresVisible ? "bg-green-900/60 text-green-200" : "text-gray-500 hover:text-white hover:bg-white/10"
                )}
              >
                {rtStructuresVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-gray-800 text-gray-400 px-1 rounded-full border border-gray-700">
                  {rtStructuresCount}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">RT Structures</TooltipContent>
          </Tooltip>
        )}

        <div className="w-px h-5 bg-gray-700/50 mx-1" />

        {onPrevSlice && (
          <button 
            onClick={onPrevSlice} 
            disabled={currentSlice === 1} 
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {onNextSlice && (
          <button 
            onClick={onNextSlice} 
            disabled={currentSlice === totalSlices} 
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {onReset && (
          <>
            <div className="w-px h-5 bg-gray-700/50 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={onReset} 
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Reset</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FUSION DROPDOWN BUTTON & PANEL
// ============================================================================

export interface FusionDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  hasFusionActive: boolean;
  selectedSecondary: FusionSecondaryDescriptor | null;
  fusionOpacity: number;
  onFusionOpacityChange: (opacity: number) => void;
  onSecondaryChange: (sec: FusionSecondaryDescriptor | null) => void;
  availableSecondaries: FusionSecondaryDescriptor[];
  secondaryStatuses: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  manifestLoading?: boolean;
  fusionLayoutPreset: FusionLayoutPreset;
  onLayoutPresetChange: (preset: FusionLayoutPreset) => void;
  fusionWindowLevel?: { window: number; level: number } | null;
  onFusionWindowLevelChange?: (wl: { window: number; level: number } | null) => void;
}

const PANEL_WIDTH = 320;

export function FusionDropdown({
  isOpen,
  onToggle,
  hasFusionActive,
  selectedSecondary,
  fusionOpacity,
  onFusionOpacityChange,
  onSecondaryChange,
  availableSecondaries,
  secondaryStatuses,
  manifestLoading,
  fusionLayoutPreset,
  onLayoutPresetChange,
  fusionWindowLevel,
  onFusionWindowLevelChange,
}: FusionDropdownProps) {
  const fusionColor = selectedSecondary ? getModalityColor(selectedSecondary.secondaryModality) : 'gray';
  const readySecondaries = availableSecondaries.filter(s => {
    const status = secondaryStatuses.get(s.secondarySeriesId);
    return status?.status === 'ready' || status?.status === 'idle';
  });
  
  const hasFusionAvailable = readySecondaries.length > 0 || manifestLoading;
  // Multi mode is only true multi-viewport layouts (triple, quad, etc.) - NOT side-by-side
  const isMultiMode = fusionLayoutPreset !== 'overlay' && fusionLayoutPreset !== 'single' && fusionLayoutPreset !== 'side-by-side';
  // Side-by-side acts like single mode but without opacity slider
  const isSideBySide = fusionLayoutPreset === 'side-by-side';
  const showMinimized = hasFusionActive && selectedSecondary && !isOpen && !isMultiMode;
  
  const handleBarClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on view buttons or minimized controls
    if ((e.target as HTMLElement).closest('[data-view-buttons]')) return;
    if ((e.target as HTMLElement).closest('[data-minimized-controls]')) return;
    if ((e.target as HTMLElement).closest('[data-quick-swap]')) return;
    onToggle();
  };
  
  const handleViewModeClick = (mode: 'overlay' | 'side-by-side' | 'multi') => {
    if (mode === 'overlay') {
      onLayoutPresetChange('overlay');
    } else if (mode === 'side-by-side') {
      onLayoutPresetChange('side-by-side');
    } else if (mode === 'multi') {
      // Multi triggers superfuse mode
      onLayoutPresetChange('triple');
    }
  };
  
  return (
    <div className="relative" style={{ width: PANEL_WIDTH }}>
      {/* Main toolbar button */}
      <div 
        onClick={handleBarClick}
        className={cn(
          "backdrop-blur-md border overflow-hidden cursor-pointer transition-colors duration-150 shadow-lg",
          ((isOpen && !isMultiMode) || showMinimized) ? "rounded-t-xl border-b-0" : "rounded-xl",
          // In multi mode, match CompactToolbar styling
          isMultiMode 
            ? "bg-gray-950/95 border-gray-600/40"
            : hasFusionActive && selectedSecondary
              ? fusionColor === 'amber' 
                ? "bg-amber-500/15 border-amber-500/20 hover:border-amber-400/30"
                : fusionColor === 'purple'
                ? "bg-purple-500/15 border-purple-500/20 hover:border-purple-400/30"
                : "bg-cyan-500/15 border-cyan-500/20 hover:border-cyan-400/30"
              : "border-white/5"
        )}
        style={isMultiMode ? undefined : { 
          backgroundColor: hasFusionActive && selectedSecondary ? undefined : '#161720e6',
          borderColor: hasFusionActive && selectedSecondary ? undefined : '#2e304054'
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 px-4 h-12">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-2">
            {manifestLoading ? (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            ) : isMultiMode ? (
              <Rows3 className="w-4 h-4 text-cyan-400" />
            ) : (
              <Zap className={cn(
                "w-4 h-4 flex-shrink-0",
                hasFusionActive ? "text-cyan-400" : "text-gray-400"
              )} />
            )}
            <span className={cn(
              "text-sm font-semibold",
              hasFusionActive ? "text-gray-100" : "text-gray-300"
            )}>
              {manifestLoading ? "Loading..." : isMultiMode ? "Superfuse" : "Fusion"}
            </span>
            {hasFusionActive && selectedSecondary && !isMultiMode && (
              <Badge className={cn(
                "text-[9px] px-1.5 h-4",
                getModalityBadgeStyles(selectedSecondary.secondaryModality)
              )}>
                {selectedSecondary.secondaryModality}
              </Badge>
            )}
          </div>
          
          <div className="flex-1" />
          
          {/* Right: View mode buttons */}
          {hasFusionAvailable && !manifestLoading && (
            <div 
              data-view-buttons
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative group">
                <button
                  onClick={() => handleViewModeClick('overlay')}
                  className={cn(
                    "h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-all duration-200",
                    fusionLayoutPreset === 'overlay' 
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800/95 border border-gray-600/50 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                  Overlay
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={() => handleViewModeClick('side-by-side')}
                  className={cn(
                    "h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-all duration-200",
                    fusionLayoutPreset === 'side-by-side' || fusionLayoutPreset === 'primary-focus' || fusionLayoutPreset === 'secondary-focus'
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <SplitSquareHorizontal className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800/95 border border-gray-600/50 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                  Split View
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={() => handleViewModeClick('multi')}
                  className={cn(
                    "h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-all duration-200",
                    fusionLayoutPreset === 'triple' || fusionLayoutPreset === 'quad'
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Rows3 className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800/95 border border-gray-600/50 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                  Superfuse
                </div>
              </div>
            </div>
          )}
          
          {/* Dropdown arrow */}
          <ChevronDown className={cn(
            "w-4 h-4 flex-shrink-0 transition-transform text-gray-400",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>
      
      {/* Minimized controls - floating below header */}
      <AnimatePresence mode="wait">
        {showMinimized && (
          <motion.div 
            data-minimized-controls
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 right-0 mt-0 z-50 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn(
              "backdrop-blur-xl border border-t-0 rounded-b-xl shadow-2xl overflow-hidden px-4 py-3 space-y-3.5",
              fusionColor === 'amber' 
                ? "bg-amber-500/15 border-amber-500/20"
                : fusionColor === 'purple'
                ? "bg-purple-500/15 border-purple-500/20"
                : "bg-cyan-500/15 border-cyan-500/20"
            )}>
              {/* Opacity section - hide in side-by-side mode */}
              {!isSideBySide && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">Opacity</span>
                    <span className="text-[11px] font-semibold text-white bg-gray-800/60 px-2 py-0.5 rounded">
                      {Math.round(fusionOpacity * 100)}%
                    </span>
                  </div>
                  <div className="relative">
                    <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          fusionColor === 'amber' 
                            ? "bg-gradient-to-r from-amber-600 to-amber-400"
                            : fusionColor === 'purple'
                            ? "bg-gradient-to-r from-purple-600 to-purple-400"
                            : "bg-gradient-to-r from-cyan-600 to-cyan-400"
                        )}
                        style={{ width: `${fusionOpacity * 100}%` }}
                      />
                    </div>
                    <div 
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-lg pointer-events-none",
                        fusionColor === 'amber' ? "border-amber-400" :
                        fusionColor === 'purple' ? "border-purple-400" : "border-cyan-400"
                      )}
                      style={{ left: `calc(${fusionOpacity * 100}% - 8px)` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fusionOpacity * 100}
                      onChange={(e) => onFusionOpacityChange(parseInt(e.target.value) / 100)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}
              
              {/* Quick swap tags - clicking these should NOT open the panel */}
              <div data-quick-swap className="flex flex-wrap gap-2">
                {readySecondaries.map((sec) => {
                  const isActive = selectedSecondary?.secondarySeriesId === sec.secondarySeriesId;
                  return (
                    <button
                      key={sec.secondarySeriesId}
                      data-quick-swap
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onSecondaryChange(isActive ? null : sec);
                      }}
                      className={cn(
                        "h-7 px-3 rounded-lg flex items-center gap-2 text-xs font-medium transition-all border",
                        isActive
                          ? "bg-cyan-500/20 text-white border-cyan-400/50"
                          : "text-gray-300 border-transparent hover:bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isActive ? "bg-emerald-400" : "bg-emerald-500"
                      )} />
                      <span>{sec.secondaryModality}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Full Panel Dropdown */}
      <AnimatePresence mode="wait">
        {isOpen && !isMultiMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full right-0 mt-0 z-50 pointer-events-auto"
            style={{ width: PANEL_WIDTH }}
          >
            <div className={cn(
              "backdrop-blur-xl border border-t-0 rounded-b-xl shadow-2xl overflow-hidden",
              selectedSecondary
                ? fusionColor === 'amber' 
                  ? "bg-amber-500/15 border-amber-500/20"
                  : fusionColor === 'purple'
                  ? "bg-purple-500/15 border-purple-500/20"
                  : "bg-cyan-500/15 border-cyan-500/20"
                : "bg-white/10 border-white/5"
            )}>
              {/* Opacity Slider - hide in side-by-side mode */}
              {!isSideBySide && (
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">Opacity</span>
                    <span className="text-[11px] font-semibold text-white bg-gray-800/60 px-2 py-0.5 rounded">
                      {Math.round(fusionOpacity * 100)}%
                    </span>
                  </div>
                  <div className="relative">
                    <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                        style={{ width: `${fusionOpacity * 100}%` }}
                      />
                    </div>
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-yellow-400 shadow-lg pointer-events-none"
                      style={{ left: `calc(${fusionOpacity * 100}% - 8px)` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fusionOpacity * 100}
                      onChange={(e) => onFusionOpacityChange(parseInt(e.target.value) / 100)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Scan Cards */}
              <div className="px-4 pb-4">
                <div className="space-y-2">
                  {readySecondaries.length === 0 ? (
                    <div className="text-[11px] text-gray-500 py-2">
                      {manifestLoading ? 'Loading fusion scans...' : 'No fusion scans available'}
                    </div>
                  ) : (
                    readySecondaries.map((sec) => {
                      const isActive = selectedSecondary?.secondarySeriesId === sec.secondarySeriesId;
                      const color = getModalityColor(sec.secondaryModality);
                      const status = secondaryStatuses.get(sec.secondarySeriesId);
                      return (
                        <button
                          key={sec.secondarySeriesId}
                          onClick={() => onSecondaryChange(isActive ? null : sec)}
                          className={cn(
                            "w-full h-11 px-4 rounded-lg flex items-center gap-3 text-sm font-medium transition-all",
                            isActive
                              ? "bg-cyan-500/20 text-white border border-cyan-400/50"
                              : "text-gray-300 bg-gray-800/30 hover:bg-gray-700/40 border border-gray-700/50"
                          )}
                        >
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full flex-shrink-0",
                            status?.status === 'loading' ? "bg-sky-400 animate-pulse" :
                            isActive ? "bg-emerald-400" : "bg-emerald-500"
                          )} />
                          <span className={cn(
                            "font-semibold",
                            color === 'amber' ? "text-amber-300" :
                            color === 'purple' ? "text-purple-300" :
                            "text-cyan-300"
                          )}>{sec.secondaryModality}</span>
                          <span className="text-gray-400 truncate flex-1 text-left text-xs">
                            {sec.secondarySeriesDescription}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Window/Level Presets */}
              {selectedSecondary && (
                <div className="px-4 py-3 border-t border-white/10">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Window / Level
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(MODALITY_WINDOW_PRESETS[selectedSecondary.secondaryModality.toUpperCase()] || MODALITY_WINDOW_PRESETS.CT).map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => onFusionWindowLevelChange?.({ window: preset.window, level: preset.level })}
                        className={cn(
                          "text-xs py-1.5 px-2 rounded-md transition-all border",
                          fusionWindowLevel?.window === preset.window && fusionWindowLevel?.level === preset.level
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : "bg-gray-800/30 border-gray-700/50 text-gray-300 hover:bg-gray-700/40 hover:text-white hover:border-gray-600/50"
                        )}
                        title={`W: ${preset.window} L: ${preset.level}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      onClick={() => onFusionWindowLevelChange?.(null)}
                      className="text-xs py-1.5 px-2 rounded-md transition-all bg-gray-800/30 border border-gray-700/50 text-gray-300 hover:bg-gray-700/40 hover:text-white hover:border-gray-600/50"
                    >
                      Auto
                    </button>
                  </div>
                </div>
              )}

              {/* Clear button */}
              {selectedSecondary && (
                <div className="px-4 py-2 border-t border-white/10">
                  <button
                    onClick={() => onSecondaryChange(null)}
                    className="w-full h-7 flex items-center justify-center gap-1.5 rounded-lg text-red-400 hover:bg-red-500/10 text-xs font-medium transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear Fusion
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function UnifiedFusionTopbar({
  // Primary series info
  primaryModality = 'CT',
  primarySeriesDescription,
  currentSlice = 1,
  totalSlices = 1,
  windowLevel,
  zPosition,
  orientation = 'axial',
  
  // Navigation
  onPrevSlice,
  onNextSlice,
  onReset,
  
  // RT Structures
  rtStructuresCount,
  rtStructuresVisible,
  onToggleStructures,
  
  // MPR
  showMPR,
  onToggleMPR,
  
  // Fusion state
  secondarySeriesId,
  onSecondarySeriesSelect,
  fusionOpacity,
  onFusionOpacityChange,
  fusionWindowLevel,
  onFusionWindowLevelChange,
  
  // Secondary series data
  secondaryOptions,
  secondaryStatuses,
  manifestLoading,
  manifestError,
  hasPotentialFusions = false,
  
  // Layout mode
  fusionLayoutPreset,
  onLayoutPresetChange,
  
  // Panel visibility
  isExpanded = false,
  onExpandedChange,
  
  className,
}: UnifiedFusionTopbarProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isPanelOpen = isExpanded !== undefined ? isExpanded : internalExpanded;
  const setPanelOpen = onExpandedChange || setInternalExpanded;
  
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Find selected secondary descriptor
  const selectedSecondary = useMemo(() => {
    return secondaryOptions.find(s => s.secondarySeriesId === secondarySeriesId) ?? null;
  }, [secondaryOptions, secondarySeriesId]);
  
  const hasFusionActive = secondarySeriesId !== null && selectedSecondary !== null;
  // Show fusion dropdown if: has loaded options, OR manifest is loading, OR has potential fusions from REG associations
  const hasFusionAvailable = secondaryOptions.length > 0 || manifestLoading || hasPotentialFusions;
  
  // Handle secondary selection
  const handleSecondaryChange = (sec: FusionSecondaryDescriptor | null) => {
    onSecondarySeriesSelect(sec?.secondarySeriesId ?? null);
  };
  
  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen, setPanelOpen]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex items-start gap-2 p-2 z-20 rounded-none text-white/[0.97]", className)}>
        {/* Left: Main Topbar Info */}
        <div 
          className="flex-1 backdrop-blur-xl border rounded-xl shadow-xl"
          style={{ backgroundColor: '#171922f0', borderColor: '#3b3e54a1' }}
        >
          <div
            className="h-12 px-4 flex items-center"
            style={{ background: 'unset', backgroundColor: 'unset' }}
          >
            <TopbarInfo
              primaryModality={primaryModality}
              currentSlice={currentSlice}
              totalSlices={totalSlices}
              windowLevel={windowLevel}
              zPosition={zPosition}
              orientation={orientation}
              hasFusionActive={hasFusionActive}
              fusionOpacity={fusionOpacity}
              selectedSecondary={selectedSecondary}
              rtStructuresCount={rtStructuresCount}
              rtStructuresVisible={rtStructuresVisible}
              onToggleStructures={onToggleStructures}
              showMPR={showMPR}
              onToggleMPR={onToggleMPR}
              onPrevSlice={onPrevSlice}
              onNextSlice={onNextSlice}
              onReset={onReset}
            />
          </div>
        </div>

        {/* Right: Fusion Dropdown (only when fusion available) */}
        {hasFusionAvailable && (
          <div className="flex-shrink-0" ref={panelRef}>
            <FusionDropdown
              isOpen={isPanelOpen}
              onToggle={() => setPanelOpen(!isPanelOpen)}
              hasFusionActive={hasFusionActive}
              selectedSecondary={selectedSecondary}
              fusionOpacity={fusionOpacity}
              onFusionOpacityChange={onFusionOpacityChange}
              onSecondaryChange={handleSecondaryChange}
              availableSecondaries={secondaryOptions}
              secondaryStatuses={secondaryStatuses}
              manifestLoading={manifestLoading}
              fusionLayoutPreset={fusionLayoutPreset}
              onLayoutPresetChange={onLayoutPresetChange}
              fusionWindowLevel={fusionWindowLevel}
              onFusionWindowLevelChange={onFusionWindowLevelChange}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

