/**
 * ViewerToolbar - V4 Aurora Edition
 * 
 * Main bottom toolbar for the DICOM viewer with modern Aurora styling.
 * Features gradient backgrounds, subtle glassmorphism, and organized tool groups.
 */

import React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Hand, 
  Ruler, 
  Highlighter,
  Info,
  HelpCircle,
  Keyboard,
  Layers,
  Grid3x3,
  Activity,
  Crosshair,
  SquaresSubtract,
  Expand,
  Target,
  Undo,
  Redo,
  History,
  X
} from 'lucide-react';

interface ViewerToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
  onPan: () => void;
  onMeasure: () => void;
  onCrosshairs?: () => void;
  onContourEdit?: () => void;
  onContourOperations?: () => void;
  onAdvancedMarginTool?: () => void;
  isContourEditActive?: boolean;
  isContourOperationsActive?: boolean;
  isAdvancedMarginToolActive?: boolean;
  isPanActive?: boolean;
  isMeasureActive?: boolean;
  isCrosshairsActive?: boolean;
  isToolActive?: boolean;
  currentSlice?: number;
  totalSlices?: number;
  windowLevel?: {
    window: number;
    level: number;
  };
  className?: string;
  onMPRToggle?: () => void;
  isMPRActive?: boolean;
  onFusionToggle?: () => void;
  isFusionActive?: boolean;
  onLocalization?: () => void;
  isLocalizationActive?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  historyItems?: Array<{ timestamp: number; action: string; structureId: number; structureName?: string; slicePosition?: number }>;
  currentHistoryIndex?: number;
  onSelectHistory?: (index: number) => void;
}

// Tool button component with V4 Aurora styling
interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  activeColor?: 'blue' | 'green' | 'purple' | 'cyan' | 'orange' | 'emerald';
  disabled?: boolean;
  size?: 'sm' | 'md';
}

function ToolButton({ 
  icon, 
  label, 
  onClick, 
  isActive = false, 
  activeColor = 'blue',
  disabled = false,
  size = 'md'
}: ToolButtonProps) {
  const colorMap = {
    blue: { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.5)', text: '#60A5FA', glow: 'rgba(59, 130, 246, 0.3)' },
    green: { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.5)', text: '#4ADE80', glow: 'rgba(34, 197, 94, 0.3)' },
    purple: { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(168, 85, 247, 0.5)', text: '#C084FC', glow: 'rgba(168, 85, 247, 0.3)' },
    cyan: { bg: 'rgba(34, 211, 238, 0.2)', border: 'rgba(34, 211, 238, 0.5)', text: '#22D3EE', glow: 'rgba(34, 211, 238, 0.3)' },
    orange: { bg: 'rgba(251, 146, 60, 0.2)', border: 'rgba(251, 146, 60, 0.5)', text: '#FB923C', glow: 'rgba(251, 146, 60, 0.3)' },
    emerald: { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 0.5)', text: '#34D399', glow: 'rgba(16, 185, 129, 0.3)' },
  };

  const colors = colorMap[activeColor];
  const sizeClasses = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            sizeClasses,
            'flex items-center justify-center rounded-lg transition-all duration-200',
            disabled && 'opacity-40 cursor-not-allowed',
            isActive 
              ? 'text-white shadow-lg' 
              : 'text-white/70 hover:text-white hover:bg-white/10'
          )}
          style={isActive ? {
            background: `linear-gradient(135deg, ${colors.bg} 0%, transparent 100%)`,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            boxShadow: `0 0 20px -4px ${colors.glow}`,
          } : {}}
        >
          <span className={iconSize}>{icon}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="bg-gray-900/95 border-gray-700 backdrop-blur-md text-xs px-2 py-1"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// Labeled tool button for special actions
interface LabeledToolButtonProps extends ToolButtonProps {
  showLabel?: boolean;
}

function LabeledToolButton({ 
  icon, 
  label, 
  onClick, 
  isActive = false, 
  activeColor = 'blue',
  disabled = false,
  showLabel = true
}: LabeledToolButtonProps) {
  const colorMap = {
    blue: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#60A5FA', glow: 'rgba(59, 130, 246, 0.25)' },
    green: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', text: '#4ADE80', glow: 'rgba(34, 197, 94, 0.25)' },
    purple: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', text: '#C084FC', glow: 'rgba(168, 85, 247, 0.25)' },
    cyan: { bg: 'rgba(34, 211, 238, 0.15)', border: 'rgba(34, 211, 238, 0.4)', text: '#22D3EE', glow: 'rgba(34, 211, 238, 0.25)' },
    orange: { bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)', text: '#FB923C', glow: 'rgba(251, 146, 60, 0.25)' },
    emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#34D399', glow: 'rgba(16, 185, 129, 0.25)' },
  };

  const colors = colorMap[activeColor];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 px-3 flex items-center gap-2 rounded-lg transition-all duration-200 text-sm font-medium',
            disabled && 'opacity-40 cursor-not-allowed',
            isActive 
              ? 'shadow-lg' 
              : 'text-white/70 hover:text-white hover:bg-white/10'
          )}
          style={isActive ? {
            background: `linear-gradient(135deg, ${colors.bg} 0%, transparent 100%)`,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            boxShadow: `0 0 20px -4px ${colors.glow}`,
          } : {
            border: '1px solid transparent',
          }}
        >
          <span className="w-4 h-4">{icon}</span>
          {showLabel && <span>{label}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="bg-gray-900/95 border-gray-700 backdrop-blur-md text-xs px-2 py-1"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// Separator component
function Separator() {
  return <div className="w-px h-5 bg-white/15 mx-1" />;
}

// Tool group container
function ToolGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div 
      className={cn("flex items-center gap-1 px-2 py-1.5 rounded-xl", className)}
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      {children}
    </div>
  );
}

export function ViewerToolbar({
  onZoomIn,
  onZoomOut,
  onFitToWindow,
  onPan,
  onMeasure,
  onCrosshairs,
  onContourEdit,
  onContourOperations,
  onAdvancedMarginTool,
  isContourEditActive = false,
  isContourOperationsActive = false,
  isAdvancedMarginToolActive = false,
  isPanActive = false,
  isMeasureActive = false,
  isCrosshairsActive = false,
  isToolActive = false,
  currentSlice,
  totalSlices,
  windowLevel,
  className,
  onMPRToggle,
  isMPRActive = false,
  onFusionToggle,
  isFusionActive = false,
  onLocalization,
  isLocalizationActive = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  historyItems = [],
  currentHistoryIndex = -1,
  onSelectHistory
}: ViewerToolbarProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showInteractionTips, setShowInteractionTips] = useState(false);
  const [tipsDialogOpen, setTipsDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleToolSelect = (tool: string, callback: () => void) => {
    if (tool === 'pan' || tool === 'measure' || tool === 'crosshairs') {
      setActiveTool(tool);
    } else if (tool === 'mpr' || tool === 'fusion' || tool === 'localization') {
      callback();
      return;
    }
    callback();
  };

  const getToolActive = (toolId: string) => {
    if (toolId === 'mpr') return isMPRActive;
    if (toolId === 'fusion') return isFusionActive;
    if (toolId === 'localization') return isLocalizationActive;
    if (toolId === 'pan') return activeTool === 'pan' || isPanActive;
    if (toolId === 'measure') return activeTool === 'measure' || isMeasureActive;
    if (toolId === 'crosshairs') return activeTool === 'crosshairs' || isCrosshairsActive;
    return activeTool === toolId;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40",
          className
        )}
      >
        {/* Gradient background that fades from transparent at top to dark at bottom */}
        <div 
          className="flex items-center justify-center py-3 px-4"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(15, 18, 25, 0.75) 35%, rgba(15, 18, 25, 0.92) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3">
            
            {/* ===== LEFT: Undo/Redo/History ===== */}
            <ToolGroup>
              <ToolButton
                icon={<Undo className="w-full h-full" />}
                label="Undo (Ctrl+Z)"
                onClick={() => onUndo?.()}
                disabled={!canUndo}
                size="sm"
              />
              <ToolButton
                icon={<Redo className="w-full h-full" />}
                label="Redo (Ctrl+Y)"
                onClick={() => onRedo?.()}
                disabled={!canRedo}
                size="sm"
              />
              <div className="relative">
                <ToolButton
                  icon={<History className="w-full h-full" />}
                  label="History"
                  onClick={() => setShowHistory(!showHistory)}
                  isActive={showHistory}
                  activeColor="orange"
                  disabled={(historyItems?.length || 0) === 0}
                  size="sm"
                />
                
                {/* History Dropdown */}
                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 mb-3 w-80 max-h-80 overflow-y-auto rounded-xl shadow-2xl z-[100]"
                      style={{
                        background: 'linear-gradient(180deg, rgba(30, 35, 45, 0.98) 0%, rgba(20, 24, 33, 0.99) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(20px)',
                      }}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-orange-300">Edit History</span>
                          <button 
                            onClick={() => setShowHistory(false)}
                            className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {historyItems.length === 0 ? (
                            <div className="text-gray-500 text-xs px-2 py-2">No history yet</div>
                          ) : (
                            historyItems.map((h, idx) => {
                              const date = new Date(h.timestamp);
                              const isCurrent = idx === currentHistoryIndex;
                              return (
                                <button
                                  key={`${h.timestamp}-${idx}`}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-lg transition-all text-xs",
                                    isCurrent 
                                      ? 'bg-orange-500/15 border border-orange-500/30 text-orange-200' 
                                      : 'bg-white/5 border border-transparent text-gray-300 hover:bg-white/10 hover:border-white/10'
                                  )}
                                  onClick={() => {
                                    onSelectHistory?.(idx);
                                    setShowHistory(false);
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{h.action}</span>
                                    <span className="text-[10px] text-gray-500">{date.toLocaleTimeString()}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    {h.structureName || `Structure ${h.structureId}`}
                                    {h.slicePosition !== undefined && ` • Slice ${h.slicePosition.toFixed(1)}`}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ToolGroup>

            {/* ===== CENTER LEFT: Zoom Controls ===== */}
            <ToolGroup>
              <ToolButton
                icon={<ZoomOut className="w-full h-full" />}
                label="Zoom Out"
                onClick={onZoomOut}
              />
              <ToolButton
                icon={<ZoomIn className="w-full h-full" />}
                label="Zoom In"
                onClick={onZoomIn}
              />
              <ToolButton
                icon={<Maximize2 className="w-full h-full" />}
                label="Fit to Window"
                onClick={onFitToWindow}
              />
            </ToolGroup>

            {/* ===== CENTER: Navigation Tools ===== */}
            <ToolGroup>
              <ToolButton
                icon={<Hand className="w-full h-full" />}
                label="Pan"
                onClick={() => handleToolSelect('pan', onPan)}
                isActive={getToolActive('pan')}
                activeColor="blue"
              />
              <ToolButton
                icon={<Crosshair className="w-full h-full" />}
                label="Crosshairs"
                onClick={() => handleToolSelect('crosshairs', onCrosshairs || (() => {}))}
                isActive={getToolActive('crosshairs')}
                activeColor="cyan"
              />
              <ToolButton
                icon={<Ruler className="w-full h-full" />}
                label="Measure"
                onClick={() => handleToolSelect('measure', onMeasure)}
                isActive={getToolActive('measure')}
                activeColor="purple"
              />
            </ToolGroup>

            {/* ===== CENTER RIGHT: View Modes ===== */}
            <ToolGroup>
              <ToolButton
                icon={<Grid3x3 className="w-full h-full" />}
                label="MPR View"
                onClick={() => onMPRToggle?.()}
                isActive={isMPRActive}
                activeColor="green"
              />
              <ToolButton
                icon={<Layers className="w-full h-full" />}
                label="Fusion"
                onClick={() => onFusionToggle?.()}
                isActive={isFusionActive}
                activeColor="purple"
              />
              <ToolButton
                icon={<Target className="w-full h-full" />}
                label="Structure Localization"
                onClick={() => onLocalization?.()}
                isActive={isLocalizationActive}
                activeColor="orange"
              />
            </ToolGroup>

            {/* ===== RIGHT: Contour Tools (Special Labeled Buttons) ===== */}
            <ToolGroup>
              {onContourEdit && (
                <LabeledToolButton
                  icon={<Highlighter className="w-full h-full" />}
                  label="Contour"
                  onClick={onContourEdit}
                  isActive={isContourEditActive}
                  activeColor="emerald"
                />
              )}
              {onContourOperations && (
                <LabeledToolButton
                  icon={<SquaresSubtract className="w-full h-full" />}
                  label="Boolean"
                  onClick={onContourOperations}
                  isActive={isContourOperationsActive}
                  activeColor="blue"
                />
              )}
              {onAdvancedMarginTool && (
                <LabeledToolButton
                  icon={<Expand className="w-full h-full" />}
                  label="Margin"
                  onClick={onAdvancedMarginTool}
                  isActive={isAdvancedMarginToolActive}
                  activeColor="cyan"
                />
              )}
            </ToolGroup>

            {/* ===== FAR RIGHT: Info/Help ===== */}
            <ToolGroup>
              <div className="relative">
                <ToolButton
                  icon={<Info className="w-full h-full" />}
                  label="DICOM Metadata"
                  onClick={() => setShowMetadata(!showMetadata)}
                  isActive={showMetadata}
                  activeColor="purple"
                  size="sm"
                />
                
                {/* Metadata Popup */}
                <AnimatePresence>
                  {showMetadata && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full right-0 mb-3 w-96 rounded-xl shadow-2xl z-[100]"
                      style={{
                        background: 'linear-gradient(180deg, rgba(30, 35, 45, 0.98) 0%, rgba(20, 24, 33, 0.99) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(20px)',
                      }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-semibold text-purple-300">DICOM Metadata</span>
                          </div>
                          <button 
                            onClick={() => setShowMetadata(false)}
                            className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="font-semibold text-purple-300 mb-2">Patient Info</div>
                            <div className="space-y-1 text-gray-300">
                              <div><span className="text-gray-500">Name:</span> DEMO^PATIENT</div>
                              <div><span className="text-gray-500">ID:</span> DM001</div>
                              <div><span className="text-gray-500">DOB:</span> 1970-01-01</div>
                              <div><span className="text-gray-500">Sex:</span> M</div>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-purple-300 mb-2">Study Info</div>
                            <div className="space-y-1 text-gray-300">
                              <div><span className="text-gray-500">Date:</span> 2024-01-15</div>
                              <div><span className="text-gray-500">Time:</span> 14:30:00</div>
                              <div><span className="text-gray-500">Description:</span> Chest CT</div>
                              <div><span className="text-gray-500">Modality:</span> CT</div>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-purple-300 mb-2">Image Parameters</div>
                            <div className="space-y-1 text-gray-300">
                              <div><span className="text-gray-500">Matrix:</span> 512 x 512</div>
                              <div><span className="text-gray-500">Slice:</span> {currentSlice || 1} / {totalSlices || 20}</div>
                              <div><span className="text-gray-500">Thickness:</span> 1.0mm</div>
                              <div><span className="text-gray-500">kVp:</span> 120</div>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-purple-300 mb-2">Window/Level</div>
                            <div className="space-y-1 text-gray-300">
                              <div><span className="text-gray-500">Current W/L:</span> {windowLevel ? `${Math.round(windowLevel.window)}/${Math.round(windowLevel.level)}` : '400/40'}</div>
                              <div><span className="text-gray-500">Range:</span> [-1024, 3071] HU</div>
                              <div><span className="text-gray-500">Reconstruction:</span> FBP</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="relative">
                <ToolButton
                  icon={<HelpCircle className="w-full h-full" />}
                  label="Interaction Guide"
                  onClick={() => setTipsDialogOpen(!tipsDialogOpen)}
                  isActive={tipsDialogOpen}
                  activeColor="cyan"
                  size="sm"
                />
                
                {/* Tips Popup */}
                <AnimatePresence>
                  {tipsDialogOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full right-0 mb-3 w-80 rounded-xl shadow-2xl z-[100]"
                      style={{
                        background: 'linear-gradient(180deg, rgba(30, 35, 45, 0.98) 0%, rgba(20, 24, 33, 0.99) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(20px)',
                      }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Keyboard className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-semibold text-cyan-300">Interaction Guide</span>
                          </div>
                          <button 
                            onClick={() => setTipsDialogOpen(false)}
                            className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-4 text-xs">
                          <div>
                            <h4 className="font-medium text-yellow-300 mb-1.5">Navigation</h4>
                            <div className="space-y-1 text-gray-400">
                              <div>• Mouse Wheel: Navigate slices</div>
                              <div>• Arrow Keys: Previous/Next slice</div>
                              <div>• Left Click + Drag: Pan image</div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-yellow-300 mb-1.5">Zoom Controls</h4>
                            <div className="space-y-1 text-gray-400">
                              <div>• Ctrl + Mouse Wheel: Zoom in/out</div>
                              <div>• Toolbar +/- buttons: Zoom in/out</div>
                              <div>• Fit to Window button: Reset zoom</div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-yellow-300 mb-1.5">Window/Level</h4>
                            <div className="space-y-1 text-gray-400">
                              <div>• Right Click + Drag: Adjust contrast</div>
                              <div>• Horizontal: Window width</div>
                              <div>• Vertical: Window level</div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-yellow-300 mb-1.5">Shortcuts</h4>
                            <div className="grid grid-cols-2 gap-1 text-gray-500">
                              <div>• R: Reset view</div>
                              <div>• F: Fit to window</div>
                              <div>• 1-8: Preset windows</div>
                              <div>• I: Invert colors</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ToolGroup>

          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

export default ViewerToolbar;
