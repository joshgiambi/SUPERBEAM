/**
 * ViewportActionBar - OHIF-style individual viewport topbar controls
 * 
 * This component appears at the top of each viewport (on hover or when active)
 * providing quick access to viewport-specific controls like:
 * - Orientation/view label
 * - Window/Level presets
 * - Zoom controls
 * - Layout/maximize options
 * - Series navigation
 * 
 * Adapted from OHIF Viewer ViewportActionBar pattern.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2,
  RotateCcw,
  SunMedium,
  ZoomIn,
  ZoomOut,
  MoreHorizontal,
  Eye,
  EyeOff,
  Layers,
  Box,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { OrientationBadge, type ViewOrientation } from './viewport-orientation-markers';

// Standard window/level presets for CT
export const WINDOW_LEVEL_PRESETS = {
  'Soft Tissue': { window: 400, level: 40 },
  'Lung': { window: 1500, level: -600 },
  'Bone': { window: 2500, level: 480 },
  'Brain': { window: 80, level: 40 },
  'Liver': { window: 150, level: 30 },
  'Abdomen': { window: 350, level: 40 },
  'Mediastinum': { window: 350, level: 50 },
} as const;

interface ViewportActionBarProps {
  /** Viewport identifier */
  viewportId: string;
  /** Current orientation (axial/sagittal/coronal) */
  orientation: ViewOrientation;
  /** Series description or label */
  seriesDescription?: string;
  /** Modality (CT, MR, PT, etc.) */
  modality?: string;
  /** Current window/level values */
  windowLevel?: { window: number; level: number };
  /** Callback when window/level changes */
  onWindowLevelChange?: (wl: { window: number; level: number }) => void;
  /** Current zoom level */
  zoom?: number;
  /** Zoom callbacks */
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  /** Series navigation callbacks */
  onPrevSeries?: () => void;
  onNextSeries?: () => void;
  /** Toggle maximize/fullscreen */
  onMaximize?: () => void;
  /** Whether RT structures are visible */
  showStructures?: boolean;
  /** Toggle structure visibility */
  onToggleStructures?: () => void;
  /** Whether MPR is visible */
  showMPR?: boolean;
  /** Toggle MPR */
  onToggleMPR?: () => void;
  /** Whether the viewport is currently active */
  isActive?: boolean;
  /** Whether to show the bar (controlled by parent, e.g., on hover) */
  isVisible?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * ViewportActionBar - Floating action bar for individual viewports
 */
export function ViewportActionBar({
  viewportId,
  orientation,
  seriesDescription,
  modality,
  windowLevel,
  onWindowLevelChange,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onPrevSeries,
  onNextSeries,
  onMaximize,
  showStructures = true,
  onToggleStructures,
  showMPR = false,
  onToggleMPR,
  isActive = false,
  isVisible = true,
  className,
}: ViewportActionBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse after a delay when not active
  useEffect(() => {
    if (!isActive && isExpanded) {
      const timer = setTimeout(() => setIsExpanded(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isActive, isExpanded]);

  const handlePresetSelect = useCallback((preset: keyof typeof WINDOW_LEVEL_PRESETS) => {
    onWindowLevelChange?.(WINDOW_LEVEL_PRESETS[preset]);
  }, [onWindowLevelChange]);

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'absolute top-0 left-0 right-0 z-40',
          'pointer-events-auto',
          className
        )}
      >
        {/* Main action bar */}
        <div 
          className={cn(
            'flex items-center justify-between gap-1',
            'px-2 py-1',
            'bg-gradient-to-b from-black/80 via-black/60 to-transparent',
            'backdrop-blur-sm'
          )}
        >
          {/* Left section: Orientation + Series info */}
          <div className="flex items-center gap-2 min-w-0">
            <OrientationBadge orientation={orientation} />
            
            {modality && (
              <span className="text-[10px] font-semibold text-gray-300 uppercase">
                {modality}
              </span>
            )}
            
            {seriesDescription && (
              <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                {seriesDescription}
              </span>
            )}
          </div>

          {/* Right section: Quick actions */}
          <div className="flex items-center gap-0.5">
            {/* Series navigation */}
            {(onPrevSeries || onNextSeries) && (
              <>
                <ActionButton
                  icon={<ChevronLeft className="w-3 h-3" />}
                  onClick={onPrevSeries}
                  tooltip="Previous series"
                  disabled={!onPrevSeries}
                />
                <ActionButton
                  icon={<ChevronRight className="w-3 h-3" />}
                  onClick={onNextSeries}
                  tooltip="Next series"
                  disabled={!onNextSeries}
                />
                <Divider />
              </>
            )}

            {/* Window/Level presets dropdown */}
            {onWindowLevelChange && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-gray-300 hover:text-white hover:bg-white/10"
                      title="Window/Level presets"
                    >
                      <SunMedium className="w-3 h-3 mr-1" />
                      <span className="text-[9px]">W/L</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="min-w-[140px] bg-gray-900/95 border-gray-700 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] text-gray-400">
                      Window/Level Presets
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-700/50" />
                    {Object.keys(WINDOW_LEVEL_PRESETS).map((preset) => (
                      <DropdownMenuItem
                        key={preset}
                        onClick={() => handlePresetSelect(preset as keyof typeof WINDOW_LEVEL_PRESETS)}
                        className="text-xs cursor-pointer"
                      >
                        {preset}
                      </DropdownMenuItem>
                    ))}
                    {windowLevel && (
                      <>
                        <DropdownMenuSeparator className="bg-gray-700/50" />
                        <div className="px-2 py-1 text-[9px] text-gray-500">
                          Current: W:{Math.round(windowLevel.window)} L:{Math.round(windowLevel.level)}
                        </div>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Divider />
              </>
            )}

            {/* Zoom controls */}
            {(onZoomIn || onZoomOut) && (
              <>
                <ActionButton
                  icon={<ZoomOut className="w-3 h-3" />}
                  onClick={onZoomOut}
                  tooltip="Zoom out"
                />
                <span className="text-[9px] text-gray-400 min-w-[30px] text-center">
                  {(zoom * 100).toFixed(0)}%
                </span>
                <ActionButton
                  icon={<ZoomIn className="w-3 h-3" />}
                  onClick={onZoomIn}
                  tooltip="Zoom in"
                />
                {onResetZoom && (
                  <ActionButton
                    icon={<RotateCcw className="w-3 h-3" />}
                    onClick={onResetZoom}
                    tooltip="Reset view"
                  />
                )}
                <Divider />
              </>
            )}

            {/* Structure visibility */}
            {onToggleStructures && (
              <ActionButton
                icon={showStructures ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                onClick={onToggleStructures}
                tooltip={showStructures ? "Hide structures" : "Show structures"}
                isActive={showStructures}
                activeColor="text-green-400"
              />
            )}

            {/* MPR toggle */}
            {onToggleMPR && (
              <ActionButton
                icon={<Box className="w-3 h-3" />}
                onClick={onToggleMPR}
                tooltip={showMPR ? "Hide MPR" : "Show MPR"}
                isActive={showMPR}
                activeColor="text-cyan-400"
              />
            )}

            {/* Maximize */}
            {onMaximize && (
              <>
                <Divider />
                <ActionButton
                  icon={<Maximize2 className="w-3 h-3" />}
                  onClick={onMaximize}
                  tooltip="Maximize viewport"
                />
              </>
            )}

            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="min-w-[120px] bg-gray-900/95 border-gray-700 backdrop-blur-md"
              >
                <DropdownMenuItem className="text-xs cursor-pointer">
                  <Settings className="w-3 h-3 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer">
                  <Layers className="w-3 h-3 mr-2" />
                  Overlay options
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// --- Helper components ---

interface ActionButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
  disabled?: boolean;
  isActive?: boolean;
  activeColor?: string;
  className?: string;
}

function ActionButton({ 
  icon, 
  onClick, 
  tooltip, 
  disabled = false,
  isActive = false,
  activeColor = 'text-cyan-400',
  className 
}: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-5 w-5 p-0 text-gray-400 hover:text-white hover:bg-white/10',
        'transition-colors duration-150',
        isActive && activeColor,
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
    >
      {icon}
    </Button>
  );
}

function Divider() {
  return <div className="w-px h-3 bg-gray-600/50 mx-0.5" />;
}

/**
 * Compact version of the action bar for smaller viewports
 */
export function ViewportActionBarCompact({
  orientation,
  modality,
  isActive,
  isVisible = true,
  className,
}: Pick<ViewportActionBarProps, 'orientation' | 'modality' | 'isActive' | 'isVisible' | 'className'>) {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'absolute top-0 left-0 right-0 z-40',
        'flex items-center gap-1 px-1.5 py-0.5',
        'bg-gradient-to-b from-black/70 to-transparent',
        className
      )}
    >
      <OrientationBadge orientation={orientation} />
      {modality && (
        <span className="text-[9px] font-medium text-gray-400">
          {modality}
        </span>
      )}
    </motion.div>
  );
}

