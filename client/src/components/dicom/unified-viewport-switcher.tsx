/**
 * Unified Viewport Mode Switcher
 * 
 * Provides a consistent, elegant way to transition between viewing modes:
 * - Single View: Standard single viewport (WorkingViewer)
 * - Fusion View: Overlay or split layouts for comparing fused images
 * - MPR View: Multi-planar reconstruction
 * 
 * Design philosophy:
 * - Clearly indicates current mode with visual distinction
 * - Provides smooth transitions between modes
 * - Shows contextual options based on available data
 * - Maintains position in top-right of viewport area for easy access
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2,
  Columns2,
  Rows2,
  SplitSquareHorizontal,
  X,
  ChevronDown,
  Layers,
  Grid2x2,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Viewport mode definitions
export type ViewportMode = 
  | 'single'           // Standard single viewport
  | 'fusion-overlay'   // Single viewport with fusion overlay
  | 'fusion-split'     // Side-by-side fusion comparison
  | 'mpr';             // Multi-planar reconstruction

// Fusion layout sub-modes
export type FusionLayout = 
  | 'overlay'          // Traditional overlay
  | 'side-by-side'     // 50/50 horizontal
  | 'primary-focus'    // 70/30 favoring primary
  | 'secondary-focus'  // 30/70 favoring secondary
  | 'vertical'         // Stacked vertically
  | 'triple'           // 1 + 2 layout
  | 'quad';            // 2x2

interface ViewportModeSwitcherProps {
  currentMode: ViewportMode;
  onModeChange: (mode: ViewportMode) => void;
  // Fusion-specific
  fusionLayout?: FusionLayout;
  onFusionLayoutChange?: (layout: FusionLayout) => void;
  hasFusionSecondary?: boolean;
  // Context
  hasMPRCapability?: boolean;
  className?: string;
}

// Mode configurations with icons and descriptions
const MODE_CONFIG = {
  single: {
    icon: Maximize2,
    label: 'Single',
    description: 'Standard single viewport',
    color: 'indigo',
  },
  'fusion-overlay': {
    icon: Layers,
    label: 'Overlay',
    description: 'Fusion overlay on single viewport',
    color: 'purple',
  },
  'fusion-split': {
    icon: Columns2,
    label: 'Compare',
    description: 'Side-by-side fusion comparison',
    color: 'cyan',
  },
  mpr: {
    icon: Grid2x2,
    label: 'MPR',
    description: 'Multi-planar reconstruction',
    color: 'amber',
  },
};

const FUSION_LAYOUTS = [
  { id: 'overlay', icon: Layers, label: 'Overlay', description: 'Blend on single canvas' },
  { id: 'side-by-side', icon: Columns2, label: '50/50', description: 'Equal split' },
  { id: 'primary-focus', icon: PanelLeft, label: '70/30', description: 'Primary focus' },
  { id: 'secondary-focus', icon: PanelLeft, label: '30/70', description: 'Secondary focus', iconFlip: true },
  { id: 'vertical', icon: Rows2, label: 'Stack', description: 'Vertical stack' },
  { id: 'triple', icon: SplitSquareHorizontal, label: '1+2', description: 'One + two layout' },
  { id: 'quad', icon: Grid2x2, label: '2×2', description: 'Quad grid' },
] as const;

const getColorClasses = (color: string, isActive: boolean) => {
  const colorMap: Record<string, { active: string; hover: string; border: string }> = {
    indigo: {
      active: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 shadow-indigo-500/20',
      hover: 'hover:bg-indigo-500/10 hover:text-indigo-300 hover:border-indigo-500/30',
      border: 'border-indigo-500/20',
    },
    purple: {
      active: 'bg-purple-500/20 text-purple-200 border-purple-500/50 shadow-purple-500/20',
      hover: 'hover:bg-purple-500/10 hover:text-purple-300 hover:border-purple-500/30',
      border: 'border-purple-500/20',
    },
    cyan: {
      active: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-cyan-500/20',
      hover: 'hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/30',
      border: 'border-cyan-500/20',
    },
    amber: {
      active: 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-amber-500/20',
      hover: 'hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/30',
      border: 'border-amber-500/20',
    },
  };
  
  if (isActive) {
    return colorMap[color]?.active || colorMap.indigo.active;
  }
  return `${colorMap[color]?.hover || colorMap.indigo.hover} text-gray-400`;
};

export function ViewportModeSwitcher({
  currentMode,
  onModeChange,
  fusionLayout = 'overlay',
  onFusionLayoutChange,
  hasFusionSecondary = false,
  hasMPRCapability = true,
  className,
}: ViewportModeSwitcherProps) {
  const [showFusionOptions, setShowFusionOptions] = useState(false);
  
  const currentConfig = MODE_CONFIG[currentMode];
  const CurrentIcon = currentConfig.icon;
  
  // Determine which modes to show
  const availableModes: ViewportMode[] = ['single'];
  if (hasFusionSecondary) {
    availableModes.push('fusion-overlay', 'fusion-split');
  }
  if (hasMPRCapability) {
    availableModes.push('mpr');
  }
  
  const handleModeChange = useCallback((mode: ViewportMode) => {
    // If switching to fusion mode, show layout options
    if (mode === 'fusion-split' && currentMode !== 'fusion-split') {
      setShowFusionOptions(true);
    }
    onModeChange(mode);
  }, [currentMode, onModeChange]);
  
  const handleFusionLayoutSelect = useCallback((layout: FusionLayout) => {
    onFusionLayoutChange?.(layout);
    // If selecting overlay, switch to overlay mode
    if (layout === 'overlay') {
      onModeChange('fusion-overlay');
    } else {
      onModeChange('fusion-split');
    }
    setShowFusionOptions(false);
  }, [onFusionLayoutChange, onModeChange]);

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex items-center gap-1 p-1 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10",
          "shadow-lg shadow-black/20",
          className
        )}
      >
        {/* Mode buttons */}
        {availableModes.map((mode) => {
          const config = MODE_CONFIG[mode];
          const Icon = config.icon;
          const isActive = currentMode === mode || 
            (mode === 'fusion-split' && currentMode === 'fusion-overlay');
          
          // Special handling for fusion modes - combine into single button with dropdown
          if (mode === 'fusion-overlay' || mode === 'fusion-split') {
            if (mode === 'fusion-overlay') return null; // Skip, we'll handle via fusion-split button
            
            return (
              <div key="fusion" className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (isActive) {
                          setShowFusionOptions(!showFusionOptions);
                        } else {
                          handleModeChange('fusion-overlay');
                        }
                      }}
                      className={cn(
                        "relative h-8 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-1.5",
                        "border text-xs font-medium",
                        (currentMode === 'fusion-overlay' || currentMode === 'fusion-split')
                          ? getColorClasses('cyan', true)
                          : getColorClasses('cyan', false)
                      )}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Fusion</span>
                      {(currentMode === 'fusion-overlay' || currentMode === 'fusion-split') && (
                        <ChevronDown className={cn(
                          "w-3 h-3 transition-transform",
                          showFusionOptions && "rotate-180"
                        )} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50">
                    <p className="text-xs">Fusion comparison modes</p>
                  </TooltipContent>
                </Tooltip>
                
                {/* Fusion layout dropdown */}
                <AnimatePresence>
                  {showFusionOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 p-2 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/30 z-50 min-w-[180px]"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 mb-1.5">
                        Layout Options
                      </div>
                      {FUSION_LAYOUTS.map((layout) => {
                        const LayoutIcon = layout.icon;
                        const isLayoutActive = fusionLayout === layout.id;
                        
                        return (
                          <button
                            key={layout.id}
                            onClick={() => handleFusionLayoutSelect(layout.id as FusionLayout)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-150",
                              "text-xs",
                              isLayoutActive
                                ? "bg-cyan-500/20 text-cyan-200"
                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <LayoutIcon 
                              className={cn(
                                "w-3.5 h-3.5",
                                layout.iconFlip && "transform scale-x-[-1]"
                              )} 
                            />
                            <span className="font-medium">{layout.label}</span>
                            <span className="text-[10px] text-gray-500 ml-auto">{layout.description}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }
          
          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleModeChange(mode)}
                  className={cn(
                    "h-8 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-1.5",
                    "border text-xs font-medium",
                    getColorClasses(config.color, isActive)
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{config.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50">
                <p className="text-xs">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        
        {/* Close dropdown when clicking outside */}
        {showFusionOptions && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowFusionOptions(false)}
          />
        )}
      </motion.div>
    </TooltipProvider>
  );
}

// ============================================================================
// COMPACT EXIT BUTTON - For when in multi-viewport/fusion modes
// ============================================================================

interface ExitToSingleViewProps {
  onExit: () => void;
  label?: string;
  className?: string;
}

export function ExitToSingleView({ 
  onExit, 
  label = "Exit to Single View",
  className 
}: ExitToSingleViewProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onExit}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg",
              "bg-red-500/10 hover:bg-red-500/20",
              "border border-red-500/30 hover:border-red-500/50",
              "text-red-400 hover:text-red-300",
              "text-xs font-medium transition-all duration-200",
              "shadow-lg shadow-red-500/5",
              className
            )}
          >
            <X className="w-3.5 h-3.5" />
            <span>{label}</span>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50">
          <p className="text-xs">Return to single viewport view</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// FLOATING MODE INDICATOR - Shows current mode with quick exit
// ============================================================================

interface FloatingModeIndicatorProps {
  mode: ViewportMode;
  fusionLayout?: FusionLayout;
  onExit: () => void;
  onLayoutChange?: (layout: FusionLayout) => void;
  className?: string;
}

export function FloatingModeIndicator({
  mode,
  fusionLayout,
  onExit,
  onLayoutChange,
  className,
}: FloatingModeIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;
  
  // Only show for non-single modes
  if (mode === 'single') return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl",
        "bg-black/50 backdrop-blur-xl border border-white/10",
        "shadow-lg",
        className
      )}
    >
      {/* Mode indicator */}
      <div className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        `text-${config.color}-300`
      )}>
        <Icon className="w-3.5 h-3.5" />
        <span>{config.label}</span>
        {fusionLayout && fusionLayout !== 'overlay' && (
          <span className="text-gray-500">• {fusionLayout}</span>
        )}
      </div>
      
      {/* Divider */}
      <div className="w-px h-4 bg-white/10" />
      
      {/* Exit button */}
      <button
        onClick={onExit}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-md",
          "text-gray-400 hover:text-white text-xs",
          "hover:bg-white/5 transition-all duration-150"
        )}
      >
        <Maximize2 className="w-3 h-3" />
        <span>Single</span>
      </button>
    </motion.div>
  );
}

export default ViewportModeSwitcher;

