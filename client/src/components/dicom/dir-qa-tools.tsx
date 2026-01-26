/**
 * DIR QA Tools Component
 * 
 * Provides quality assurance tools for Deformable Image Registration:
 * - Reg Reveal: Sampling cube to inspect local registration quality
 * - Reg Refine: Landmark placement and local alignment locking
 * - Jacobian Map: Visualize local volume changes (expansion/compression)
 * 
 * Reference: MIM Maestro 7.1-7.4 User Guide, Pages 294-312
 */

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Box,
  Target,
  Move,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Palette,
  Maximize2,
  Grid,
  BarChart3,
  Crosshair,
  Link,
  Unlink,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Landmark {
  id: string;
  name: string;
  primaryPosition: { x: number; y: number; z: number };
  secondaryPosition: { x: number; y: number; z: number } | null;
  isLocked: boolean;
  isPaired: boolean;
  color: string;
}

export interface JacobianStats {
  min: number;
  max: number;
  mean: number;
  negativePercentage: number;  // % of voxels with negative Jacobian (folding)
}

export interface RegRevealConfig {
  enabled: boolean;
  position: { x: number; y: number };  // Viewport coordinates
  size: number;  // Cube size in pixels
  showOriginal: boolean;  // Show original (undeformed) vs deformed
}

export interface RegRefineConfig {
  enabled: boolean;
  landmarks: Landmark[];
  selectedLandmarkId: string | null;
  showPaired: boolean;
  showUnpaired: boolean;
}

export interface JacobianConfig {
  enabled: boolean;
  colormap: 'diverging' | 'sequential';
  minThreshold: number;
  maxThreshold: number;
  showNegativeWarning: boolean;
  opacity: number;
}

export interface DIRQAToolsProps {
  className?: string;
  
  // Reg Reveal
  regRevealConfig: RegRevealConfig;
  onRegRevealChange: (config: RegRevealConfig) => void;
  
  // Reg Refine
  regRefineConfig: RegRefineConfig;
  onRegRefineChange: (config: RegRefineConfig) => void;
  
  // Jacobian
  jacobianConfig: JacobianConfig;
  onJacobianChange: (config: JacobianConfig) => void;
  jacobianStats?: JacobianStats;
  
  // Actions
  onRecompute?: () => void;
  onApplyRefinement?: () => void;
  isComputing?: boolean;
}

// ============================================================================
// Landmark Colors
// ============================================================================

const LANDMARK_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

// ============================================================================
// Sub-Components
// ============================================================================

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function ToolButton({ active, onClick, icon, label, description }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full text-left",
            active
              ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
              : "bg-[#0d1117]/80 border-white/10 text-gray-300 hover:border-cyan-500/20 hover:bg-cyan-500/5"
          )}
        >
          <div className={cn(
            "p-1.5 rounded-lg",
            active ? "bg-cyan-500/20" : "bg-white/5"
          )}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium">{label}</div>
            <div className="text-[9px] text-gray-500">{description}</div>
          </div>
          {active && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{description}</TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DIRQATools({
  className,
  regRevealConfig,
  onRegRevealChange,
  regRefineConfig,
  onRegRefineChange,
  jacobianConfig,
  onJacobianChange,
  jacobianStats,
  onRecompute,
  onApplyRefinement,
  isComputing,
}: DIRQAToolsProps) {
  const [activeTab, setActiveTab] = useState<'reveal' | 'refine' | 'jacobian'>('reveal');
  
  // Landmark management
  const addLandmark = useCallback(() => {
    const newId = `lm-${Date.now()}`;
    const colorIndex = regRefineConfig.landmarks.length % LANDMARK_COLORS.length;
    const newLandmark: Landmark = {
      id: newId,
      name: `Landmark ${regRefineConfig.landmarks.length + 1}`,
      primaryPosition: { x: 256, y: 256, z: 0 },
      secondaryPosition: null,
      isLocked: false,
      isPaired: false,
      color: LANDMARK_COLORS[colorIndex],
    };
    onRegRefineChange({
      ...regRefineConfig,
      landmarks: [...regRefineConfig.landmarks, newLandmark],
      selectedLandmarkId: newId,
    });
  }, [regRefineConfig, onRegRefineChange]);
  
  const removeLandmark = useCallback((id: string) => {
    onRegRefineChange({
      ...regRefineConfig,
      landmarks: regRefineConfig.landmarks.filter(lm => lm.id !== id),
      selectedLandmarkId: regRefineConfig.selectedLandmarkId === id 
        ? null 
        : regRefineConfig.selectedLandmarkId,
    });
  }, [regRefineConfig, onRegRefineChange]);
  
  const toggleLandmarkLock = useCallback((id: string) => {
    onRegRefineChange({
      ...regRefineConfig,
      landmarks: regRefineConfig.landmarks.map(lm =>
        lm.id === id ? { ...lm, isLocked: !lm.isLocked } : lm
      ),
    });
  }, [regRefineConfig, onRegRefineChange]);
  
  // Counts
  const pairedCount = useMemo(() => 
    regRefineConfig.landmarks.filter(lm => lm.isPaired).length,
    [regRefineConfig.landmarks]
  );
  
  const lockedCount = useMemo(() =>
    regRefineConfig.landmarks.filter(lm => lm.isLocked).length,
    [regRefineConfig.landmarks]
  );
  
  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex flex-col gap-3", className)}>
        {/* Tool Selection Tabs */}
        <div className="flex items-center gap-0.5 p-0.5 bg-[#0d1117]/80 border border-white/10 rounded-lg">
          {[
            { id: 'reveal', label: 'Reg Reveal', icon: <Box className="w-3 h-3" /> },
            { id: 'refine', label: 'Reg Refine', icon: <Target className="w-3 h-3" /> },
            { id: 'jacobian', label: 'Jacobian', icon: <BarChart3 className="w-3 h-3" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all",
                activeTab === tab.id
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Reg Reveal Panel */}
        {activeTab === 'reveal' && (
          <div className="space-y-3">
            <div className="text-[10px] text-gray-500">
              Inspect local registration quality with a sampling cube
            </div>
            
            <ToolButton
              active={regRevealConfig.enabled}
              onClick={() => onRegRevealChange({ ...regRevealConfig, enabled: !regRevealConfig.enabled })}
              icon={<Box className="w-4 h-4" />}
              label="Enable Reg Reveal"
              description="Show sampling cube on viewport"
            />
            
            {regRevealConfig.enabled && (
              <div className="space-y-3 p-3 bg-[#0d1117]/50 rounded-xl border border-white/5">
                {/* Cube Size */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Cube Size</span>
                    <span className="text-[10px] text-cyan-400 font-mono">{regRevealConfig.size}px</span>
                  </div>
                  <Slider
                    value={[regRevealConfig.size]}
                    onValueChange={([v]) => onRegRevealChange({ ...regRevealConfig, size: v })}
                    min={50}
                    max={200}
                    step={10}
                    className="w-full"
                  />
                </div>
                
                {/* Display Mode */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Inside cube shows:</span>
                  <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                    <button
                      onClick={() => onRegRevealChange({ ...regRevealConfig, showOriginal: true })}
                      className={cn(
                        "px-2 py-1 text-[9px] rounded-md transition-all",
                        regRevealConfig.showOriginal
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "text-gray-400 hover:text-gray-300"
                      )}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => onRegRevealChange({ ...regRevealConfig, showOriginal: false })}
                      className={cn(
                        "px-2 py-1 text-[9px] rounded-md transition-all",
                        !regRevealConfig.showOriginal
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "text-gray-400 hover:text-gray-300"
                      )}
                    >
                      Deformed
                    </button>
                  </div>
                </div>
                
                <div className="text-[9px] text-gray-500 p-2 bg-gray-800/30 rounded-lg">
                  <strong>Usage:</strong> Click and drag the cube on the viewport to inspect 
                  registration quality in different regions. Inside shows {regRevealConfig.showOriginal ? 'undeformed' : 'deformed'} 
                  secondary, outside shows the opposite.
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Reg Refine Panel */}
        {activeTab === 'refine' && (
          <div className="space-y-3">
            <div className="text-[10px] text-gray-500">
              Place landmarks to lock and refine local alignments
            </div>
            
            <ToolButton
              active={regRefineConfig.enabled}
              onClick={() => onRegRefineChange({ ...regRefineConfig, enabled: !regRefineConfig.enabled })}
              icon={<Target className="w-4 h-4" />}
              label="Enable Landmark Tool"
              description="Place corresponding points on both images"
            />
            
            {regRefineConfig.enabled && (
              <div className="space-y-3 p-3 bg-[#0d1117]/50 rounded-xl border border-white/5">
                {/* Landmark Stats */}
                <div className="flex items-center gap-3">
                  <Badge className="bg-cyan-500/20 border-cyan-500/30 text-cyan-300 text-[10px]">
                    <Link className="w-3 h-3 mr-1" />
                    {pairedCount} paired
                  </Badge>
                  <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-300 text-[10px]">
                    <Lock className="w-3 h-3 mr-1" />
                    {lockedCount} locked
                  </Badge>
                </div>
                
                {/* Add Landmark Button */}
                <Button
                  size="sm"
                  onClick={addLandmark}
                  className="w-full h-8 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Landmark
                </Button>
                
                {/* Landmark List */}
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {regRefineConfig.landmarks.length === 0 ? (
                    <div className="text-[10px] text-gray-500 text-center py-4">
                      No landmarks placed yet. Click "Add Landmark" to start.
                    </div>
                  ) : (
                    regRefineConfig.landmarks.map((landmark) => (
                      <div
                        key={landmark.id}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all cursor-pointer",
                          regRefineConfig.selectedLandmarkId === landmark.id
                            ? "bg-cyan-500/10 border-cyan-500/30"
                            : "bg-gray-800/30 border-white/5 hover:border-white/10"
                        )}
                        onClick={() => onRegRefineChange({ 
                          ...regRefineConfig, 
                          selectedLandmarkId: landmark.id 
                        })}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: landmark.color }}
                        />
                        <span className="text-[10px] text-white flex-1">{landmark.name}</span>
                        
                        {landmark.isPaired ? (
                          <Badge className="bg-green-500/20 text-green-300 text-[8px] px-1">
                            Paired
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-500/20 text-gray-400 text-[8px] px-1">
                            Unpaired
                          </Badge>
                        )}
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLandmarkLock(landmark.id); }}
                          className={cn(
                            "p-1 rounded-md transition-colors",
                            landmark.isLocked 
                              ? "bg-amber-500/20 text-amber-400" 
                              : "bg-gray-700/50 text-gray-400 hover:text-white"
                          )}
                        >
                          {landmark.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); removeLandmark(landmark.id); }}
                          className="p-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Apply Refinement Button */}
                {lockedCount > 0 && (
                  <Button
                    size="sm"
                    onClick={onApplyRefinement}
                    disabled={isComputing}
                    className="w-full h-8 text-xs bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white"
                  >
                    {isComputing ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    )}
                    Apply Locked Alignments
                  </Button>
                )}
                
                <div className="text-[9px] text-gray-500 p-2 bg-gray-800/30 rounded-lg">
                  <strong>Workflow:</strong> 1) Add landmarks 2) Click on primary image to set position 
                  3) Click on secondary to pair 4) Lock correct alignments 5) Apply to re-register
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Jacobian Panel */}
        {activeTab === 'jacobian' && (
          <div className="space-y-3">
            <div className="text-[10px] text-gray-500">
              Visualize local volume changes from deformation
            </div>
            
            <ToolButton
              active={jacobianConfig.enabled}
              onClick={() => onJacobianChange({ ...jacobianConfig, enabled: !jacobianConfig.enabled })}
              icon={<BarChart3 className="w-4 h-4" />}
              label="Enable Jacobian Overlay"
              description="Show volume change colormap"
            />
            
            {jacobianConfig.enabled && (
              <div className="space-y-3 p-3 bg-[#0d1117]/50 rounded-xl border border-white/5">
                {/* Jacobian Stats */}
                {jacobianStats && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="text-[9px] text-blue-400">Compression</div>
                      <div className="text-sm font-mono text-blue-300">
                        {jacobianStats.min.toFixed(3)}
                      </div>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                      <div className="text-[9px] text-red-400">Expansion</div>
                      <div className="text-sm font-mono text-red-300">
                        {jacobianStats.max.toFixed(3)}
                      </div>
                    </div>
                    <div className="p-2 bg-gray-500/10 rounded-lg border border-gray-500/20">
                      <div className="text-[9px] text-gray-400">Mean</div>
                      <div className="text-sm font-mono text-gray-300">
                        {jacobianStats.mean.toFixed(3)}
                      </div>
                    </div>
                    <div className={cn(
                      "p-2 rounded-lg border",
                      jacobianStats.negativePercentage > 0
                        ? "bg-amber-500/10 border-amber-500/20"
                        : "bg-green-500/10 border-green-500/20"
                    )}>
                      <div className={cn(
                        "text-[9px]",
                        jacobianStats.negativePercentage > 0 ? "text-amber-400" : "text-green-400"
                      )}>
                        Folding
                      </div>
                      <div className={cn(
                        "text-sm font-mono",
                        jacobianStats.negativePercentage > 0 ? "text-amber-300" : "text-green-300"
                      )}>
                        {jacobianStats.negativePercentage.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Negative Jacobian Warning */}
                {jacobianStats && jacobianStats.negativePercentage > 0 && jacobianConfig.showNegativeWarning && (
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] text-amber-300">
                      {jacobianStats.negativePercentage.toFixed(2)}% of voxels have negative 
                      Jacobian (folding). Review registration quality.
                    </span>
                  </div>
                )}
                
                {/* Colormap Selection */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-400">Colormap</span>
                  <div className="flex items-center gap-1 p-0.5 bg-gray-800/50 rounded-lg">
                    <button
                      onClick={() => onJacobianChange({ ...jacobianConfig, colormap: 'diverging' })}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-[9px] rounded-md transition-all flex items-center justify-center gap-1",
                        jacobianConfig.colormap === 'diverging'
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "text-gray-400 hover:text-gray-300"
                      )}
                    >
                      <div className="w-12 h-2 rounded-sm bg-gradient-to-r from-blue-500 via-white to-red-500" />
                    </button>
                    <button
                      onClick={() => onJacobianChange({ ...jacobianConfig, colormap: 'sequential' })}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-[9px] rounded-md transition-all flex items-center justify-center gap-1",
                        jacobianConfig.colormap === 'sequential'
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "text-gray-400 hover:text-gray-300"
                      )}
                    >
                      <div className="w-12 h-2 rounded-sm bg-gradient-to-r from-blue-900 via-cyan-500 to-yellow-400" />
                    </button>
                  </div>
                </div>
                
                {/* Opacity */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Overlay Opacity</span>
                    <span className="text-[10px] text-cyan-400 font-mono">{Math.round(jacobianConfig.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[jacobianConfig.opacity * 100]}
                    onValueChange={([v]) => onJacobianChange({ ...jacobianConfig, opacity: v / 100 })}
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                
                {/* Threshold */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-400">Display Range</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={jacobianConfig.minThreshold}
                      onChange={(e) => onJacobianChange({ 
                        ...jacobianConfig, 
                        minThreshold: parseFloat(e.target.value) || 0 
                      })}
                      step="0.1"
                      className="w-16 h-6 px-2 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 text-center"
                    />
                    <div className="flex-1 h-2 rounded bg-gradient-to-r from-blue-500 via-white to-red-500" />
                    <input
                      type="number"
                      value={jacobianConfig.maxThreshold}
                      onChange={(e) => onJacobianChange({ 
                        ...jacobianConfig, 
                        maxThreshold: parseFloat(e.target.value) || 2 
                      })}
                      step="0.1"
                      className="w-16 h-6 px-2 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 text-center"
                    />
                  </div>
                </div>
                
                <div className="text-[9px] text-gray-500 p-2 bg-gray-800/30 rounded-lg">
                  <strong>Interpretation:</strong> Jacobian = 1 (white) = no change, 
                  &lt;1 (blue) = compression, &gt;1 (red) = expansion, 
                  ≤0 = folding (invalid, review registration)
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Recompute Button */}
        {(regRevealConfig.enabled || jacobianConfig.enabled) && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRecompute}
            disabled={isComputing}
            className="w-full h-8 text-xs border-gray-600 text-gray-300"
          >
            {isComputing ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
            )}
            Recompute QA Metrics
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

export default DIRQATools;
