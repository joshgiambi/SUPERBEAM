/**
 * UnifiedFusionToolbarPrototype
 * 
 * Design:
 * - Main Topbar / Multi-viewport bar on the left
 * - Fusion button ALWAYS to the RIGHT (same position for both modes)
 * - Fusion button is wide (matches dropdown width), shows summary
 * - Dropdown aligns to RIGHT edge, expands LEFT
 * - Clean dark fusion panel, no title
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
  Grid3X3,
  Columns,
  Rows,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Plus,
  LayoutGrid,
  Sparkles,
  Eye,
  EyeOff,
  Box,
  Info,
  Monitor,
  SplitSquareHorizontal,
  Bookmark,
  BookmarkPlus,
  ArrowLeftRight,
  Zap,
  ChevronDown,
  Rows3,
  SunMedium,
  PanelLeftClose,
  PanelRightClose,
} from 'lucide-react';

// ============================================================================
// TYPES & MOCK DATA
// ============================================================================

interface SecondarySeriesInfo {
  id: number;
  modality: string;
  description: string;
  sliceCount: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

interface PrimaryInfo {
  modality: string;
  seriesDescription: string;
  orientation: 'axial' | 'sagittal' | 'coronal';
}

interface RTStructuresInfo {
  count: number;
  visible: boolean;
}

const MOCK_PRIMARY: PrimaryInfo = {
  modality: 'CT',
  seriesDescription: 'Head_Neck C+ 2.0mm',
  orientation: 'axial',
};

const MOCK_SECONDARIES: SecondarySeriesInfo[] = [
  { id: 1, modality: 'PT', description: 'QCFX MAC HN 2.5mm', sliceCount: 287, status: 'ready' },
  { id: 2, modality: 'MR', description: 'T1 AXIAL POST GAD', sliceCount: 192, status: 'ready' },
  { id: 3, modality: 'MR', description: 'T2 FLAIR AXIAL', sliceCount: 156, status: 'ready' },
];

const LAYOUT_PRESETS = [
  { id: '1x1', icon: <Maximize2 className="w-3.5 h-3.5" />, label: '1×1', description: 'Single viewport' },
  { id: '1x2', icon: <Columns className="w-3.5 h-3.5" />, label: '1×2', description: 'Side by side' },
  { id: '1x3', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, label: '1×3', description: 'Three across' },
  { id: '2x1', icon: <Rows className="w-3.5 h-3.5" />, label: '2×1', description: 'Stacked' },
  { id: '2x2', icon: <Grid2x2 className="w-3.5 h-3.5" />, label: '2×2', description: '2×2 grid' },
  { id: '3x3', icon: <Grid3X3 className="w-3.5 h-3.5" />, label: '3×3', description: '3×3 grid' },
];

// Window/Level presets per modality (matches viewport-pane-ohif.tsx)
const MODALITY_WINDOW_PRESETS: Record<string, Array<{ label: string; window: number; level: number }>> = {
  CT: [
    { label: 'Soft Tissue', window: 400, level: 40 },
    { label: 'Lung', window: 1500, level: -600 },
    { label: 'Bone', window: 1800, level: 400 },
    { label: 'Brain', window: 80, level: 40 },
    { label: 'Liver', window: 150, level: 30 },
  ],
  MR: [
    { label: 'T1', window: 600, level: 300 },
    { label: 'T2', window: 2000, level: 1000 },
    { label: 'FLAIR', window: 1800, level: 900 },
    { label: 'Spine', window: 1200, level: 600 },
  ],
  MRI: [
    { label: 'T1', window: 600, level: 300 },
    { label: 'T2', window: 2000, level: 1000 },
    { label: 'FLAIR', window: 1800, level: 900 },
    { label: 'Spine', window: 1200, level: 600 },
  ],
  PT: [
    { label: 'Standard', window: 20000, level: 10000 },
    { label: 'High Uptake', window: 30000, level: 15000 },
    { label: 'Low Uptake', window: 10000, level: 5000 },
  ],
  PET: [
    { label: 'Standard', window: 20000, level: 10000 },
    { label: 'High Uptake', window: 30000, level: 15000 },
    { label: 'Low Uptake', window: 10000, level: 5000 },
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
// SCAN CARD - Clean minimal style
// ============================================================================

interface ScanCardProps {
  scan: SecondarySeriesInfo;
  isSelected: boolean;
  onClick: () => void;
}

function ScanCard({ scan, isSelected, onClick }: ScanCardProps) {
  const color = getModalityColor(scan.modality);
  
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all text-left",
        isSelected
          ? color === 'amber' ? 'bg-amber-500/15 border-amber-500/20' :
            color === 'purple' ? 'bg-purple-500/15 border-purple-500/20' :
            'bg-blue-500/15 border-blue-500/40'
          : 'bg-gray-900/60 border-gray-800 hover:bg-gray-800/80 hover:border-gray-700'
      )}
    >
      {/* Selection indicator - glowing ring with Zap icon */}
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
        isSelected
          ? color === 'amber' ? 'bg-amber-500/20 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' :
            color === 'purple' ? 'bg-purple-500/20 ring-2 ring-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]' :
            'bg-cyan-500/20 ring-2 ring-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]'
          : 'bg-gray-800 ring-1 ring-gray-700'
      )}>
        <Zap className={cn(
          "w-2.5 h-2.5 transition-colors",
          isSelected
            ? color === 'amber' ? 'text-amber-300' : color === 'purple' ? 'text-purple-300' : 'text-cyan-300'
            : 'text-gray-600'
        )} />
      </div>
      
      <Badge
        variant="outline"
        className={cn(
          'text-[9px] font-bold px-1.5 py-0 h-4 flex-shrink-0',
          getModalityBadgeStyles(scan.modality)
        )}
      >
        {scan.modality}
      </Badge>
      
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-gray-200 truncate">{scan.description}</div>
        <div className="text-[9px] text-gray-500">{scan.sliceCount} slices</div>
      </div>
    </button>
  );
}

// ============================================================================
// MINI VIEWPORT TOPBAR - Matches the actual viewport-pane-ohif.tsx design
// ============================================================================

interface ViewportConfig {
  id: string;
  label: string;
  modality: string;
  seriesDescription: string;
  sliceIndex: number;
  totalSlices: number;
  fusion?: SecondarySeriesInfo | null;
  fusionOpacity?: number;
}

interface MiniViewportTopbarProps {
  viewport: ViewportConfig;
  viewportNumber: number;
  isPrimary?: boolean;
  isActive: boolean;
  isHovered: boolean;
  onClose?: () => void;
  onOpacityChange?: (opacity: number) => void;
}

function MiniViewportTopbar({ viewport, viewportNumber, isPrimary = false, isActive, isHovered, onClose, onOpacityChange }: MiniViewportTopbarProps) {
  const hasFusion = viewport.fusion !== null && viewport.fusion !== undefined;
  const fusionModality = viewport.fusion?.modality || '';
  const shouldShowControls = isActive || isHovered;
  
  // EXACT COPY from viewport-pane-ohif.tsx
  return (
    <AnimatePresence>
      {shouldShowControls && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="absolute top-2 left-2 right-2 z-40 pointer-events-auto"
        >
          <div className="backdrop-blur-md border rounded-xl px-3 py-2 shadow-lg flex items-center justify-between"
            style={{ backgroundColor: '#1a1a1a95', borderColor: '#2d374850' }}
          >
            {/* Left: Windowing dropdown + Series info */}
            <div className="flex items-center gap-2">
              {/* Window/Level dropdown */}
              <button 
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-900/50 text-orange-200 border border-orange-600/30 backdrop-blur-sm hover:bg-orange-900/70 transition-colors cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <SunMedium className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">W/L</span>
              </button>
              
              {hasFusion && viewport.fusion ? (
                /* Fusion viewport: Clickable dropdown with series info */
                <button 
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1 rounded-lg border backdrop-blur-sm transition-colors cursor-pointer",
                    fusionModality === 'PT' || fusionModality === 'PET'
                      ? "bg-yellow-900/60 text-yellow-200 border-yellow-600/30 hover:bg-yellow-900/80"
                      : fusionModality === 'MR' || fusionModality === 'MRI'
                      ? "bg-purple-900/60 text-purple-200 border-purple-600/30 hover:bg-purple-900/80"
                      : "bg-blue-900/60 text-blue-200 border-blue-600/30 hover:bg-blue-900/80"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium">
                    {viewport.fusion.modality} Fusion
                  </span>
                  {viewport.fusion.description && (
                    <span className="text-[10px] opacity-70 max-w-[100px] truncate">
                      {viewport.fusion.description}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              ) : (
                /* Primary viewport: Static badge */
                <Badge className="bg-cyan-900/60 text-cyan-200 border border-cyan-600/30 backdrop-blur-sm">
                  {viewport.modality}
                </Badge>
              )}
              
              {/* Slice info */}
              <Badge variant="outline" className="border-gray-500/50 text-gray-300 bg-gray-800/40 backdrop-blur-sm text-[10px]">
                {viewport.sliceIndex} / {viewport.totalSlices}
              </Badge>
            </div>
            
            {/* Center: Opacity control (for fusion viewports) - pill style */}
            {hasFusion && viewport.fusion && (
              <div className="flex items-center gap-1">
                <Badge className={cn(
                  "flex items-center gap-2 border backdrop-blur-sm cursor-pointer select-none",
                  fusionModality === 'PT' || fusionModality === 'PET'
                    ? "bg-yellow-900/40 text-yellow-200 border-yellow-600/30"
                    : "bg-purple-900/40 text-purple-200 border-purple-600/30"
                )}>
                  <span className="text-[10px] font-medium opacity-70">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={viewport.fusionOpacity ?? 0.5}
                    onChange={(e) => { e.stopPropagation(); onOpacityChange?.(parseFloat(e.target.value)); }}
                    className={cn(
                      "w-16 h-1 rounded-full appearance-none cursor-pointer",
                      fusionModality === 'PT' || fusionModality === 'PET'
                        ? "accent-yellow-400"
                        : "accent-purple-400"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className={cn(
                    "text-[10px] font-medium tabular-nums min-w-[28px]",
                    fusionModality === 'PT' || fusionModality === 'PET'
                      ? "text-yellow-300"
                      : "text-purple-300"
                  )}>
                    {Math.round((viewport.fusionOpacity ?? 0.5) * 100)}%
                  </span>
                </Badge>
              </div>
            )}
            
            {/* Right: Action buttons */}
            <div className="flex items-center gap-1">
              {/* MPR Toggle */}
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg border transition-all bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40"
                onClick={(e) => e.stopPropagation()}
                title="Show MPR"
              >
                <Box className="w-3.5 h-3.5" />
              </button>
              
              {/* Structure Visibility */}
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg border transition-all bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 hover:border-green-500/40"
                onClick={(e) => e.stopPropagation()}
                title="Show Structures"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              
              {/* Remove button */}
              {onClose && (
                <button
                  className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 border border-transparent transition-all"
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  title="Remove Viewport"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// VIEWPORT PANE - Individual viewport with hover state
// ============================================================================

interface ViewportPaneProps {
  viewport: ViewportConfig;
  viewportNumber: number;
  isPrimary?: boolean;
  isActive: boolean;
  onActivate: () => void;
  onClose?: () => void;
  onOpacityChange?: (opacity: number) => void;
}

function ViewportPane({ viewport, viewportNumber, isPrimary = false, isActive, onActivate, onClose, onOpacityChange }: ViewportPaneProps) {
  const [isHovered, setIsHovered] = useState(false);
  const fusionColor = viewport.fusion ? getModalityColor(viewport.fusion.modality) : null;
  
  // Border color based on state - cyan for primary/active, purple for secondary
  const borderColor = isActive 
    ? "ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)]" 
    : viewport.fusion 
      ? "ring-1 ring-purple-600/50 hover:ring-purple-500/60"
      : "ring-1 ring-gray-700 hover:ring-gray-600";
  
  return (
    <div 
      className={cn(
        "relative rounded-lg overflow-hidden cursor-pointer transition-all",
        borderColor,
        "bg-black"
      )}
      onClick={onActivate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Mini Topbar - positioned absolutely, shows on hover */}
      <MiniViewportTopbar 
        viewport={viewport}
        viewportNumber={viewportNumber}
        isPrimary={isPrimary}
        isActive={isActive}
        isHovered={isHovered}
        onClose={onClose}
        onOpacityChange={onOpacityChange}
      />
      
      {/* Viewport content - TALLER to match main viewer */}
      <div className={cn(
        "h-44 flex items-center justify-center relative",
        fusionColor === 'amber' ? "bg-gradient-to-br from-gray-900 to-amber-950/20" :
        fusionColor === 'purple' ? "bg-gradient-to-br from-gray-900 to-purple-950/20" :
        "bg-gray-900/80"
      )}>
        {/* Simulated scan content */}
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full bg-gradient-radial from-gray-600/20 to-transparent" />
        </div>
        
        {/* Label when not hovered */}
        {!isHovered && !isActive && (
          <div className="text-center z-10">
            <div className="text-xs text-gray-500 font-medium">{viewport.modality}</div>
            {viewport.fusion && (
              <div className={cn(
                "text-[10px] flex items-center justify-center gap-1 mt-1",
                fusionColor === 'amber' ? 'text-amber-400' :
                fusionColor === 'purple' ? 'text-purple-400' : 'text-cyan-400'
              )}>
                <Zap className="w-3 h-3" />
                {viewport.fusion.modality}
              </div>
            )}
          </div>
        )}
        
        {/* Bottom overlay info */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] text-gray-500 z-10">
          <span>Z: -145.2</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FUSION PANEL - Standard mode (Single/Split)
// ============================================================================

interface FusionPanelProps {
  isOpen: boolean;
  viewMode: 'single' | 'split' | 'multi';
  onViewModeChange: (mode: 'single' | 'split' | 'multi') => void;
  availableSecondaries: SecondarySeriesInfo[];
  selectedSecondary: SecondarySeriesInfo | null;
  onSecondaryChange: (sec: SecondarySeriesInfo | null) => void;
  fusionOpacity: number;
  onFusionOpacityChange: (opacity: number) => void;
}

function FusionPanel({
  isOpen,
  viewMode,
  onViewModeChange,
  availableSecondaries,
  selectedSecondary,
  onSecondaryChange,
  fusionOpacity,
  onFusionOpacityChange,
}: FusionPanelProps) {
  const fusionColor = selectedSecondary ? getModalityColor(selectedSecondary.modality) : 'gray';
  const readySecondaries = availableSecondaries.filter(s => s.status === 'ready');
  const isMulti = viewMode === 'multi';

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
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
            {/* Panel content - Opacity first, then Scans, then W/L presets at bottom */}
            <>
              {/* Opacity Slider - matching existing panel style */}
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
                  {/* Slider thumb */}
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

              {/* Scan Cards - LARGER horizontal selectors */}
              <div className="px-4 pb-4">
                <div className="space-y-2">
                  {readySecondaries.length === 0 ? (
                    <div className="text-[11px] text-gray-500 py-2">No fusion scans available</div>
                  ) : (
                    readySecondaries.map((sec) => {
                      const isActive = selectedSecondary?.id === sec.id;
                      const color = getModalityColor(sec.modality);
                      return (
                        <button
                          key={sec.id}
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
                            isActive ? "bg-emerald-400" : "bg-emerald-500"
                          )} />
                          <span className={cn(
                            "font-semibold",
                            color === 'amber' ? "text-amber-300" :
                            color === 'purple' ? "text-purple-300" :
                            "text-cyan-300"
                          )}>{sec.modality}</span>
                          <span className="text-gray-400 truncate flex-1 text-left">{sec.description}</span>
                          <span className="text-gray-500 text-xs">#{sec.id}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Window/Level Presets - styled like the sidebar */}
              {selectedSecondary && (
                <div className="px-4 py-3 border-t border-white/10">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Window / Level
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(MODALITY_WINDOW_PRESETS[selectedSecondary.modality.toUpperCase()] || MODALITY_WINDOW_PRESETS.CT).map((preset, idx) => (
                      <button
                        key={preset.label}
                        className="text-xs py-1.5 px-2 rounded-md transition-all bg-gray-800/30 border border-gray-700/50 text-gray-300 hover:bg-gray-700/40 hover:text-white hover:border-gray-600/50"
                        title={`W: ${preset.window} L: ${preset.level}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
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
            </>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// EXISTING APP MULTI-VIEWPORT BAR (from AdvancedViewportLayout)
// ============================================================================

interface ViewportOpacity {
  viewportId: string;
  viewportNumber: number;
  modality: string;
  opacity: number;
}

interface AvailableScanForAdd {
  id: number;
  modality: string;
  description: string;
}

interface MultiViewportBarProps {
  currentLayout: string;
  onLayoutChange: (layout: string) => void;
  viewportCount: number;
  onSaveLayout: () => void;
  onLoadLayout: () => void;
  onReset: () => void;
  onExit: () => void;
  viewportOpacities?: ViewportOpacity[];
  onGlobalOpacityChange?: (opacity: number) => void;
  onResetAllOpacities?: () => void;
  availableScans?: AvailableScanForAdd[];
  onAddViewport?: (scan: AvailableScanForAdd) => void;
  onFocusLeft?: () => void;
  onFocusRight?: () => void;
}

function MultiViewportBar({
  currentLayout,
  onLayoutChange,
  viewportCount,
  onSaveLayout,
  onLoadLayout,
  onReset,
  onExit,
  viewportOpacities = [],
  onGlobalOpacityChange,
  onResetAllOpacities,
  availableScans = [],
  onAddViewport,
  onFocusLeft,
  onFocusRight,
}: MultiViewportBarProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [hoveredNub, setHoveredNub] = useState<string | null>(null);
  
  // Calculate if we need to show multiple nubs (different opacity values)
  const uniqueOpacities = new Set(viewportOpacities.map(v => Math.round(v.opacity * 100)));
  const showMultipleNubs = uniqueOpacities.size > 1 && viewportOpacities.length > 1;
  
  // Average opacity for the main slider
  const averageOpacity = viewportOpacities.length > 0
    ? viewportOpacities.reduce((sum, v) => sum + v.opacity, 0) / viewportOpacities.length
    : 0.5;
  
  // Mock saved layouts
  const savedLayouts = [
    { id: '1', name: 'CT + PET Side by Side', layout: '1x2', date: '2024-12-10' },
    { id: '2', name: 'Four Panel Review', layout: '2x2', date: '2024-12-09' },
    { id: '3', name: 'MR Comparison', layout: '1x2', date: '2024-12-08' },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center h-12 px-4 bg-gray-950/95 backdrop-blur-md border-b border-white/5 rounded-xl"
      >
        {/* Left section: Layout buttons + Focus controls */}
        <div className="flex items-center gap-2">
          {/* Layout buttons - no container styling */}
          <div className="flex items-center gap-0.5">
            {LAYOUT_PRESETS.map((preset) => (
              <Tooltip key={preset.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onLayoutChange(preset.id)}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-md transition-all duration-150",
                      currentLayout === preset.id
                        ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/30"
                        : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    {preset.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50">
                  <p className="text-[11px]">{preset.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Focus left/right buttons */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onFocusLeft}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Enlarge Left</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onFocusRight}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Enlarge Right</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Add viewport button with dialog */}
          <div className="relative">
            <button
              onClick={() => setShowAddDialog(!showAddDialog)}
              className={cn(
                "h-7 px-3 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-all duration-200",
                showAddDialog
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", showAddDialog && "rotate-180")} />
            </button>
            
            {/* Add Viewport Dialog - positioned ABOVE */}
            <AnimatePresence>
              {showAddDialog && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 w-72 z-50"
                >
                  <div className="bg-gray-950 border border-gray-800/50 rounded-xl shadow-xl p-3">
                    <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      Add Viewport
                    </div>
                    <div className="text-[10px] text-gray-500 mb-3">
                      Select a scan to add to a new viewport
                    </div>
                    
                    {availableScans.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {availableScans.map((scan) => {
                          const colorClass = scan.modality === 'PT' ? 'amber' : 
                                            scan.modality === 'MR' ? 'purple' : 'cyan';
                          return (
                            <button
                              key={scan.id}
                              onClick={() => {
                                onAddViewport?.(scan);
                                setShowAddDialog(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left",
                                "bg-gray-900/50 border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600/50"
                              )}
                            >
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                colorClass === 'amber' ? "bg-amber-400" :
                                colorClass === 'purple' ? "bg-purple-400" : "bg-cyan-400"
                              )} />
                              <span className={cn(
                                "font-semibold text-xs",
                                colorClass === 'amber' ? "text-amber-400" :
                                colorClass === 'purple' ? "text-purple-400" : "text-cyan-400"
                              )}>
                                {scan.modality}
                              </span>
                              <span className="text-gray-400 text-xs truncate flex-1">
                                {scan.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-xs">
                        All available scans are loaded
                      </div>
                    )}
                    
                    <div className="flex justify-end mt-3 pt-2 border-t border-gray-800">
                      <button
                        onClick={() => setShowAddDialog(false)}
                        className="h-7 px-3 rounded-lg text-gray-400 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center section: Global Opacity Slider (flex-1 to center it) */}
        <div className="flex-1 flex justify-center">
          {viewportOpacities.length > 0 && (
            <div className="flex items-center gap-2 px-4">
              <Layers className="w-4 h-4 text-yellow-400" />
              <div className="relative w-40">
                {/* Track */}
                <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                    style={{ width: `${averageOpacity * 100}%` }}
                  />
                </div>
                
                {/* Nubs for each viewport (only if different opacities) */}
                {showMultipleNubs ? (
                  viewportOpacities.map((vp) => (
                    <div
                      key={vp.viewportId}
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{ left: `calc(${vp.opacity * 100}% - 6px)` }}
                      onMouseEnter={() => setHoveredNub(vp.viewportId)}
                      onMouseLeave={() => setHoveredNub(null)}
                    >
                      <div className={cn(
                        "w-3 h-3 rounded-full border-2 shadow-md cursor-pointer transition-transform",
                        hoveredNub === vp.viewportId ? "scale-125" : "",
                        vp.modality === 'PT' ? "bg-amber-400 border-amber-200" :
                        vp.modality === 'MR' ? "bg-purple-400 border-purple-200" :
                        "bg-cyan-400 border-cyan-200"
                      )} />
                      {/* Tooltip on hover */}
                      {hoveredNub === vp.viewportId && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-gray-900 border border-gray-700 rounded text-[9px] text-white whitespace-nowrap">
                          Viewport {vp.viewportNumber}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  /* Single thumb when all opacities are the same */
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-yellow-400 shadow-lg pointer-events-none"
                    style={{ left: `calc(${averageOpacity * 100}% - 8px)` }}
                  />
                )}
                
                {/* Invisible range input for interaction */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={averageOpacity * 100}
                  onChange={(e) => onGlobalOpacityChange?.(parseInt(e.target.value) / 100)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-[10px] font-semibold text-yellow-300 w-8">
                {Math.round(averageOpacity * 100)}%
              </span>
              
              {/* Reset button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onResetAllOpacities}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Reset all to 50%</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Right section: Bookmark buttons */}

        {/* Bookmark buttons with popups */}
        <div className="relative flex items-center gap-2">
          {/* Save bookmark */}
          <button 
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            className={cn(
              "h-7 px-3 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-all duration-200",
              showSaveDialog 
                ? "bg-amber-500/20 text-amber-300 border-amber-400/50" 
                : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40"
            )}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
          
          {/* Save Dialog Popup */}
          <AnimatePresence>
            {showSaveDialog && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-64 z-50"
              >
                <div className="bg-gray-950 border border-gray-800/50 rounded-xl shadow-xl p-3">
                  <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <BookmarkPlus className="w-4 h-4 text-amber-400" />
                    Save Current Layout
                  </div>
                  <input
                    type="text"
                    placeholder="Layout name..."
                    value={layoutName}
                    onChange={(e) => setLayoutName(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => { onSaveLayout(); setShowSaveDialog(false); setLayoutName(''); }}
                      className="flex-1 h-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium hover:bg-amber-500/30 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="h-7 px-3 rounded-lg text-gray-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Load bookmark */}
          <button 
            onClick={() => setShowLoadDialog(!showLoadDialog)}
            className={cn(
              "h-7 px-3 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-all duration-200",
              showLoadDialog 
                ? "bg-blue-500/20 text-blue-300 border-blue-400/50" 
                : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40"
            )}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Load</span>
          </button>
          
          {/* Load Dialog Popup */}
          <AnimatePresence>
            {showLoadDialog && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-72 z-50"
              >
                <div className="bg-gray-950 border border-gray-800/50 rounded-xl shadow-xl p-3">
                  <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-blue-400" />
                    Saved Layouts
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {savedLayouts.map((layout) => (
                      <button
                        key={layout.id}
                        onClick={() => { onLoadLayout(); setShowLoadDialog(false); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-900/60 border border-gray-800 hover:bg-gray-800/80 hover:border-gray-700 transition-all text-left"
                      >
                        <div>
                          <div className="text-xs font-medium text-white">{layout.name}</div>
                          <div className="text-[10px] text-gray-500">{layout.date}</div>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-gray-600 text-gray-400">
                          {layout.layout}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1" />

        {/* Reset button */}
        <button
          onClick={onReset}
          className="h-7 px-2.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        
        {/* Exit button */}
        <button
          onClick={onExit}
          className="h-7 px-3 rounded-md bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
        >
          <X className="w-3.5 h-3.5" />
          Exit
        </button>
      </motion.div>
    </TooltipProvider>
  );
}

// ============================================================================
// MAIN TOPBAR
// ============================================================================

interface TopbarProps {
  primaryInfo: PrimaryInfo;
  windowLevel: { width: number; center: number };
  zPosition: number;
  currentSlice: number;
  totalSlices: number;
  onPrevSlice: () => void;
  onNextSlice: () => void;
  rtStructures: RTStructuresInfo | null;
  onToggleStructures: () => void;
  showMPR: boolean;
  onToggleMPR: () => void;
  hasFusionActive: boolean;
  fusionOpacity: number;
  selectedSecondary: SecondarySeriesInfo | null;
  onReset: () => void;
}

function Topbar({
  primaryInfo, windowLevel, zPosition, currentSlice, totalSlices, onPrevSlice, onNextSlice,
  rtStructures, onToggleStructures, showMPR, onToggleMPR,
  hasFusionActive, fusionOpacity, selectedSecondary,
  onReset,
}: TopbarProps) {
  const fusionColor = selectedSecondary ? getModalityColor(selectedSecondary.modality) : 'gray';

  return (
    <TooltipProvider delayDuration={200}>
      <div 
        className="backdrop-blur-md border rounded-xl shadow-lg border-white/5"
        style={{ backgroundColor: '#1a1a1a95', borderColor: '#2d374850' }}
      >
        <div className="flex items-center justify-between h-12 px-4 gap-2">
          
          {/* LEFT: Primary Info Pills */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge className="bg-blue-900/60 text-blue-200 border border-blue-600/30 text-[10px] h-6 px-2">
              {primaryInfo.modality} Scan
            </Badge>
            <Badge variant="outline" className="border-gray-600/50 text-gray-300 bg-gray-800/40 text-[10px] h-6 px-2">
              {currentSlice}/{totalSlices}
            </Badge>
            <Badge className="bg-cyan-900/40 text-cyan-200 border border-cyan-600/30 text-[10px] h-6 px-2">
              W: {Math.round(windowLevel.width)}
            </Badge>
            <Badge className="bg-orange-900/40 text-orange-200 border border-orange-600/30 text-[10px] h-6 px-2">
              L: {Math.round(windowLevel.center)}
            </Badge>
            {primaryInfo.orientation === 'axial' && (
              <Badge className="bg-purple-900/40 text-purple-200 border border-purple-600/30 text-[10px] h-6 px-2">
                Z: {zPosition.toFixed(1)}
              </Badge>
            )}
            
            {/* Active fusion badge */}
            {hasFusionActive && selectedSecondary && (
              <Badge className={cn(
                "flex items-center gap-1.5 border text-[10px] h-6 px-2",
                fusionColor === 'amber' ? "bg-amber-900/40 text-amber-200 border-amber-600/30" :
                fusionColor === 'purple' ? "bg-purple-900/40 text-purple-200 border-purple-600/30" :
                "bg-blue-900/40 text-blue-200 border-blue-600/30"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", getDotColor(selectedSecondary.modality))} />
                {selectedSecondary.modality} {Math.round(fusionOpacity * 100)}%
              </Badge>
            )}
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
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

            {rtStructures && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={onToggleStructures} 
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-lg transition-colors relative",
                      rtStructures.visible ? "bg-green-900/60 text-green-200" : "text-gray-500 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {rtStructures.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-gray-800 text-gray-400 px-1 rounded-full border border-gray-700">
                      {rtStructures.count}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">RT Structures</TooltipContent>
              </Tooltip>
            )}

            <div className="w-px h-5 bg-gray-700/50 mx-1" />

            <button 
              onClick={onPrevSlice} 
              disabled={currentSlice === 1} 
              className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={onNextSlice} 
              disabled={currentSlice === totalSlices} 
              className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

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
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// FUSION BUTTON - Wide, shows minimized opacity slider when fusion active
// ============================================================================

interface FusionToolbarProps {
  isOpen: boolean;
  onToggle: () => void;
  hasFusionActive: boolean;
  selectedSecondary: SecondarySeriesInfo | null;
  fusionCount: number;
  fusionOpacity: number;
  onFusionOpacityChange?: (opacity: number) => void;
  onSecondaryChange?: (sec: SecondarySeriesInfo | null) => void;
  availableSecondaries?: SecondarySeriesInfo[];
  viewMode: 'single' | 'split' | 'multi';
  onViewModeChange: (mode: 'single' | 'split' | 'multi') => void;
}

// Panel width constant for consistency
const PANEL_WIDTH = 320; // Width for fusion panel

function FusionToolbar({ 
  isOpen, 
  onToggle, 
  hasFusionActive, 
  selectedSecondary, 
  fusionCount, 
  fusionOpacity,
  onFusionOpacityChange,
  onSecondaryChange,
  availableSecondaries = [],
  viewMode,
  onViewModeChange,
}: FusionToolbarProps) {
  const fusionColor = selectedSecondary ? getModalityColor(selectedSecondary.modality) : 'gray';
  const readySecondaries = availableSecondaries.filter(s => s.status === 'ready');
  
  // Minimized: fusion active, panel closed - show embedded controls in button (NOT in multi mode)
  const isMultiMode = viewMode === 'multi';
  const showMinimized = hasFusionActive && selectedSecondary && !isOpen && !isMultiMode;
  const hasFusionAvailable = readySecondaries.length > 0;
  
  // Handle click on the bar (excluding view mode buttons)
  const handleBarClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on view mode buttons
    if ((e.target as HTMLElement).closest('[data-view-buttons]')) return;
    onToggle();
  };
  
  return (
    <div className="relative" style={{ width: PANEL_WIDTH }}>
      {/* Main toolbar button - always visible */}
      <div 
        onClick={handleBarClick}
        className={cn(
          "backdrop-blur-md border overflow-hidden cursor-pointer transition-colors duration-150 shadow-lg",
          // Rounded top only when panel or minimized controls are showing (not in multi mode)
          ((isOpen && !isMultiMode) || showMinimized) ? "rounded-t-xl border-b-0" : "rounded-xl",
          // Modality-colored background when fusion is active (NOT in multi/superfuse mode)
          hasFusionActive && selectedSecondary && !isMultiMode
            ? fusionColor === 'amber' 
              ? "bg-amber-500/15 border-amber-500/20 hover:border-amber-400/30"
              : fusionColor === 'purple'
              ? "bg-purple-500/15 border-purple-500/20 hover:border-purple-400/30"
              : "bg-cyan-500/15 border-cyan-500/20 hover:border-cyan-400/30"
            : "border-white/5"
        )}
        style={{ 
          backgroundColor: hasFusionActive && selectedSecondary && !isMultiMode ? undefined : '#1a1a1a95',
          borderColor: hasFusionActive && selectedSecondary && !isMultiMode ? undefined : '#2d374850'
        }}
      >
        {/* Header row - Fusion label + View mode buttons on the right */}
        <div className="flex items-center gap-2 px-4 h-12">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-2">
            {isMultiMode ? (
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
              {isMultiMode ? "Superfuse" : "Fusion"}
            </span>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Right: View mode buttons - only show when fusion is available */}
          {hasFusionAvailable && (
            <div 
              data-view-buttons
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative group">
                <button
                  onClick={() => onViewModeChange('single')}
                  className={cn(
                    "h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-all duration-200",
                    viewMode === 'single' 
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800/95 border border-gray-600/50 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Single
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={() => onViewModeChange('split')}
                  className={cn(
                    "h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-all duration-200",
                    viewMode === 'split' 
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <SplitSquareHorizontal className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800/95 border border-gray-600/50 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Split
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={() => onViewModeChange('multi')}
                  className={cn(
                    "h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-all duration-200 text-white/90",
                    viewMode === 'multi' 
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Rows3 className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800/95 border border-gray-600/50 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Superfuse
                </div>
              </div>
            </div>
          )}
          
          {/* Dropdown arrow - always on the right */}
          <ChevronDown className={cn(
            "w-4 h-4 flex-shrink-0 transition-transform text-gray-400",
            isOpen && "rotate-180"
          )} />
        </div>
        
      </div>
      
      {/* Minimized controls - FLOATING below the header bar */}
      <AnimatePresence mode="wait">
        {showMinimized && (
          <motion.div 
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
            {/* Opacity section - matching existing style */}
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
                    className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                    style={{ width: `${fusionOpacity * 100}%` }}
                  />
                </div>
                {/* Slider thumb */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-yellow-400 shadow-lg pointer-events-none"
                  style={{ left: `calc(${fusionOpacity * 100}% - 8px)` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fusionOpacity * 100}
                  onChange={(e) => onFusionOpacityChange?.(parseInt(e.target.value) / 100)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
            
            {/* Quick swap tags - pill style like existing */}
            <div className="flex flex-wrap gap-2">
              {readySecondaries.map((sec) => {
                const isActive = selectedSecondary?.id === sec.id;
                
                return (
                  <button
                    key={sec.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSecondaryChange?.(isActive ? null : sec);
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
                    <span>{sec.modality}</span>
                    <span className="text-gray-500">#{sec.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN PROTOTYPE EXPORT
// ============================================================================

export function UnifiedFusionToolbarPrototype() {
  const [viewMode, setViewMode] = useState<'single' | 'split' | 'multi'>('single');
  const [selectedSecondary, setSelectedSecondary] = useState<SecondarySeriesInfo | null>(null);
  const [fusionOpacity, setFusionOpacity] = useState(0.6);
  const [currentLayout, setCurrentLayout] = useState('1x2');
  const [windowLevel] = useState({ width: 400, center: 40 });
  const [currentSlice, setCurrentSlice] = useState(143);
  const [showMPR, setShowMPR] = useState(false);
  const [rtVisible, setRtVisible] = useState(true);
  const [simulatedSecondaries, setSimulatedSecondaries] = useState<SecondarySeriesInfo[]>(MOCK_SECONDARIES);
  const [isFusionPanelOpen, setIsFusionPanelOpen] = useState(false);
  const [activeViewportId, setActiveViewportId] = useState<string>('vp-1');

  // Multi-viewport state
  const [viewports, setViewports] = useState<ViewportConfig[]>([
    { id: 'vp-1', label: 'Viewport 1', modality: 'CT', seriesDescription: 'Head_Neck C+ 2.0mm', sliceIndex: 143, totalSlices: 287, fusion: null },
    { id: 'vp-2', label: 'Viewport 2', modality: 'CT', seriesDescription: 'Head_Neck C+ 2.0mm', sliceIndex: 98, totalSlices: 287, fusion: MOCK_SECONDARIES[0] },
  ]);

  const viewportCount = currentLayout === '1x1' ? 1 : currentLayout === '2x2' ? 4 : currentLayout === '3x3' ? 9 : 2;
  const hasFusionAvailable = simulatedSecondaries.filter(s => s.status === 'ready').length > 0;
  const fusionCount = simulatedSecondaries.filter(s => s.status === 'ready').length;
  const hasFusionActive = selectedSecondary !== null;
  const isMulti = viewMode === 'multi';

  const handleViewModeChange = (mode: 'single' | 'split' | 'multi') => {
    setViewMode(mode);
  };

  const handleSecondaryChange = (sec: SecondarySeriesInfo | null) => {
    setSelectedSecondary(sec);
  };

  const handleExitMulti = () => {
    setViewMode('single');
  };

  const handleAddToViewport = (scan: SecondarySeriesInfo) => {
    const newVp: ViewportConfig = {
      id: `vp-${viewports.length + 1}`,
      label: `Viewport ${viewports.length + 1}`,
      modality: 'CT',
      seriesDescription: 'Head_Neck C+ 2.0mm',
      sliceIndex: 143,
      totalSlices: 287,
      fusion: scan,
    };
    setViewports([...viewports, newVp]);
  };

  const handleRemoveViewport = (vpId: string) => {
    if (viewports.length > 1) {
      setViewports(viewports.filter(vp => vp.id !== vpId));
    }
  };
  
  // All available scans for adding to viewports
  const ALL_AVAILABLE_SCANS: AvailableScanForAdd[] = [
    { id: 101, modality: 'CT', description: 'CT Chest/Abdomen' },
    { id: 102, modality: 'PT', description: 'PET Whole Body' },
    { id: 103, modality: 'MR', description: 'MRI Brain T1' },
    { id: 104, modality: 'CT', description: 'CT Head' },
    { id: 105, modality: 'MR', description: 'MRI Spine' },
    { id: 106, modality: 'PT', description: 'PET/CT Oncology' },
  ];
  
  // Get scans not currently loaded in any viewport
  const getAvailableScansForAdd = (): AvailableScanForAdd[] => {
    const loadedScanIds = new Set(viewports.map(vp => vp.fusion?.id).filter(Boolean));
    return ALL_AVAILABLE_SCANS.filter(scan => !loadedScanIds.has(scan.id));
  };
  
  // Add a new viewport with the selected scan - auto-switch to most relevant layout
  const handleAddViewport = (scan: AvailableScanForAdd) => {
    const newVpNum = viewports.length + 1;
    const newVp: ViewportConfig = {
      id: `vp-${Date.now()}`,
      label: `Viewport ${newVpNum}`,
      modality: 'CT',
      seriesDescription: 'CT Primary',
      sliceIndex: 143,
      totalSlices: 287,
      fusion: {
        id: scan.id,
        modality: scan.modality,
        description: scan.description,
        sliceCount: 287,
        status: 'ready',
      },
      fusionOpacity: 0.5,
    };
    const newViewports = [...viewports, newVp];
    setViewports(newViewports);
    
    // Auto-switch to most relevant layout
    if (newViewports.length === 2) {
      setCurrentLayout('1x2');
    } else if (newViewports.length === 3) {
      setCurrentLayout('1x3');
    } else if (newViewports.length >= 4) {
      setCurrentLayout('2x2');
    }
  };

  // Close panel when clicking outside
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-fusion-button]')) {
          setIsFusionPanelOpen(false);
        }
      }
    };
    if (isFusionPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFusionPanelOpen]);

  return (
    <div className="space-y-6">
      {/* Design Notes */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Info className="w-4 h-4 text-blue-400" />
            Design
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="text-[10px] text-gray-400 space-y-1">
            <li>• Fusion button is ALWAYS to the RIGHT of topbar/multi-bar</li>
            <li>• Fusion button is wide (matches dropdown), shows summary</li>
            <li>• Dropdown aligns to RIGHT edge, expands LEFT</li>
            <li>• Clean dark fusion panel, no title header</li>
            <li>• Uses existing app multi-viewport bar design</li>
          </ul>
        </CardContent>
      </Card>

      {/* State Simulator */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Test States
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => { setSimulatedSecondaries([]); setSelectedSecondary(null); setIsFusionPanelOpen(false); setViewMode('single'); }} 
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", 
                simulatedSecondaries.length === 0 ? "bg-gray-600/30 border-gray-500/50 text-white" : "bg-gray-800/30 border-gray-700/30 text-gray-400"
              )}
            >
              No Fusion
            </button>
            <button 
              onClick={() => { setSimulatedSecondaries(MOCK_SECONDARIES); setSelectedSecondary(null); setIsFusionPanelOpen(false); setViewMode('single'); }} 
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", 
                simulatedSecondaries.length > 0 && !selectedSecondary && viewMode === 'single' ? "bg-gray-600/30 border-gray-500/50 text-white" : "bg-gray-800/30 border-gray-700/30 text-gray-400"
              )}
            >
              Fusion Available
            </button>
            <button 
              onClick={() => { setSimulatedSecondaries(MOCK_SECONDARIES); setSelectedSecondary(MOCK_SECONDARIES[0]); setIsFusionPanelOpen(true); setViewMode('single'); }} 
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", 
                selectedSecondary?.modality === 'PT' && viewMode !== 'multi' ? "bg-amber-600/30 border-amber-500/50 text-amber-200" : "bg-gray-800/30 border-gray-700/30 text-gray-400"
              )}
            >
              PT Fusion Active
            </button>
            <button 
              onClick={() => { setSimulatedSecondaries(MOCK_SECONDARIES); setSelectedSecondary(MOCK_SECONDARIES[1]); setIsFusionPanelOpen(true); setViewMode('single'); }} 
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", 
                selectedSecondary?.modality === 'MR' && viewMode !== 'multi' ? "bg-purple-600/30 border-purple-500/50 text-purple-200" : "bg-gray-800/30 border-gray-700/30 text-gray-400"
              )}
            >
              MR Fusion Active
            </button>
            <button 
              onClick={() => { setSimulatedSecondaries(MOCK_SECONDARIES); setIsFusionPanelOpen(true); setViewMode('multi'); }} 
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", 
                viewMode === 'multi' ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-200" : "bg-gray-800/30 border-gray-700/30 text-gray-400"
              )}
            >
              Multi-Viewport
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar Preview */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">Toolbar Preview</CardTitle>
          <CardDescription className="text-xs">
            {isMulti 
              ? "Multi-viewport mode with fusion button on the right"
              : "Main topbar with fusion button on the right"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 bg-black/50 rounded-xl border border-gray-800 min-h-[350px]">
          
          {/* Toolbar row: Left bar + Fusion button on right */}
          <div className="flex items-start gap-2">
            {/* Left side: Either Topbar or Multi-viewport bar */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                {isMulti ? (
                  <MultiViewportBar
                    key="multi-bar"
                    currentLayout={currentLayout}
                    onLayoutChange={setCurrentLayout}
                    viewportCount={viewportCount}
                    onSaveLayout={() => alert('Save layout')}
                    onLoadLayout={() => alert('Load layout')}
                    onReset={() => setCurrentLayout('1x2')}
                    onExit={handleExitMulti}
                    viewportOpacities={viewports.filter(v => v.fusion).map((v, i) => ({
                      viewportId: v.id,
                      viewportNumber: i + 1,
                      modality: v.fusion?.modality || 'CT',
                      opacity: v.fusionOpacity ?? 0.5,
                    }))}
                    onGlobalOpacityChange={(opacity) => {
                      setViewports(prev => prev.map(v => v.fusion ? { ...v, fusionOpacity: opacity } : v));
                    }}
                    onResetAllOpacities={() => {
                      setViewports(prev => prev.map(v => v.fusion ? { ...v, fusionOpacity: 0.5 } : v));
                    }}
                    availableScans={getAvailableScansForAdd()}
                    onAddViewport={handleAddViewport}
                    onFocusLeft={() => setCurrentLayout('1-left')}
                    onFocusRight={() => setCurrentLayout('1-right')}
                  />
                ) : (
                  <motion.div
                    key="topbar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Topbar
                      primaryInfo={MOCK_PRIMARY}
                      windowLevel={windowLevel}
                      zPosition={-145.2}
                      currentSlice={currentSlice}
                      totalSlices={287}
                      onPrevSlice={() => setCurrentSlice(Math.max(1, currentSlice - 1))}
                      onNextSlice={() => setCurrentSlice(Math.min(287, currentSlice + 1))}
                      rtStructures={{ count: 12, visible: rtVisible }}
                      onToggleStructures={() => setRtVisible(!rtVisible)}
                      showMPR={showMPR}
                      onToggleMPR={() => setShowMPR(!showMPR)}
                      hasFusionActive={hasFusionActive}
                      fusionOpacity={fusionOpacity}
                      selectedSecondary={selectedSecondary}
                      onReset={() => setCurrentSlice(143)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right side: Fusion button (always visible when fusions available) */}
            {hasFusionAvailable && (
              <div className="relative flex-shrink-0" ref={panelRef}>
                <FusionToolbar
                  isOpen={isFusionPanelOpen}
                  onToggle={() => setIsFusionPanelOpen(!isFusionPanelOpen)}
                  hasFusionActive={hasFusionActive}
                  selectedSecondary={selectedSecondary}
                  fusionCount={fusionCount}
                  fusionOpacity={fusionOpacity}
                  onFusionOpacityChange={setFusionOpacity}
                  onSecondaryChange={setSelectedSecondary}
                  availableSecondaries={MOCK_SECONDARIES}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
                {/* FusionPanel - NOT shown in multi-viewport mode */}
                {viewMode !== 'multi' && (
                  <FusionPanel
                    isOpen={isFusionPanelOpen}
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                    availableSecondaries={simulatedSecondaries}
                    selectedSecondary={selectedSecondary}
                    onSecondaryChange={handleSecondaryChange}
                    fusionOpacity={fusionOpacity}
                    onFusionOpacityChange={setFusionOpacity}
                  />
                )}
              </div>
            )}
          </div>

          {/* Simulated viewport area */}
          {isMulti ? (
            /* MULTI-VIEWPORT MODE: Show actual viewport panes with mini topbars */
            <div className={cn(
              "mt-4 grid gap-1.5",
              currentLayout === '1x1' ? 'grid-cols-1' :
              currentLayout === '1x2' ? 'grid-cols-2' :
              currentLayout === '2x1' ? 'grid-cols-1' :
              currentLayout === '2x2' ? 'grid-cols-2' :
              'grid-cols-3'
            )}>
              {viewports.slice(0, viewportCount).map((vp, index) => {
                const fusionColor = vp.fusion ? getModalityColor(vp.fusion.modality) : null;
                const isActive = vp.id === activeViewportId;
                return (
                  <ViewportPane
                    key={vp.id}
                    viewport={vp}
                    viewportNumber={index + 1}
                    isPrimary={index === 0}
                    isActive={isActive}
                    onActivate={() => setActiveViewportId(vp.id)}
                    onClose={viewports.length > 1 ? () => handleRemoveViewport(vp.id) : undefined}
                    onOpacityChange={(opacity) => {
                      setViewports(prev => prev.map(v => v.id === vp.id ? { ...v, fusionOpacity: opacity } : v));
                    }}
                  />
                );
              })}
              {/* Empty slots */}
              {viewports.length < viewportCount && Array.from({ length: viewportCount - viewports.length }).map((_, i) => (
                <div 
                  key={`empty-${i}`}
                  className="rounded-lg border-2 border-dashed border-gray-800 h-32 flex items-center justify-center bg-gray-950/50"
                >
                  <button 
                    onClick={() => setIsFusionPanelOpen(true)}
                    className="text-gray-600 hover:text-gray-400 flex flex-col items-center gap-1 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[9px]">Add viewport</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* SINGLE/SPLIT MODE: Simple viewport preview */
            <div className="mt-4 h-48 bg-gray-900/50 rounded-lg border border-gray-800 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-xs mb-1">CT Viewport</div>
                {hasFusionActive && selectedSecondary && (
                  <div className={cn(
                    "text-[10px]",
                    getModalityColor(selectedSecondary.modality) === 'amber' ? 'text-amber-400' :
                    getModalityColor(selectedSecondary.modality) === 'purple' ? 'text-purple-400' : 'text-blue-400'
                  )}>
                    + {selectedSecondary.modality} overlay @ {Math.round(fusionOpacity * 100)}%
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
