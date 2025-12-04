import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Zap, Loader2, ChevronDown, ChevronUp, SplitSquareHorizontal, Layers2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FusionSecondaryDescriptor } from '@/types/fusion';
import { useToast } from '@/hooks/use-toast';

interface FusionControlPanelV2Props {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  secondaryOptions: FusionSecondaryDescriptor[];
  selectedSecondaryId: number | null;
  onSecondarySeriesSelect: (seriesId: number | null) => void;
  secondaryStatuses: Map<number, { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null }>;
  manifestLoading?: boolean;
  manifestError?: string | null;
  windowLevel?: { window: number; level: number } | null;
  onWindowLevelPreset?: (preset: { window: number; level: number } | null) => void;
  displayMode?: 'overlay' | 'side-by-side';
  onDisplayModeChange?: (mode: 'overlay' | 'side-by-side') => void;
  primarySeriesId?: number | null;
}

export function FusionControlPanelV2({
  opacity,
  onOpacityChange,
  secondaryOptions,
  selectedSecondaryId,
  onSecondarySeriesSelect,
  secondaryStatuses,
  manifestLoading,
  manifestError,
  windowLevel,
  onWindowLevelPreset,
  displayMode = 'overlay',
  onDisplayModeChange,
  primarySeriesId,
}: FusionControlPanelV2Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Get sidebar ref from window
  useEffect(() => {
    const checkSidebar = () => {
      const ref = (window as any).__workingViewerSidebarRef;
      if (ref?.current) {
        sidebarRef.current = ref.current;
      }
    };
    checkSidebar();
    const interval = setInterval(checkSidebar, 100);
    return () => clearInterval(interval);
  }, []);

  const activeDescriptor = useMemo(() => {
    return secondaryOptions.find((sec) => sec.secondarySeriesId === selectedSecondaryId) ?? null;
  }, [secondaryOptions, selectedSecondaryId]);

  const manifestPreset = useMemo(() => {
    const center = activeDescriptor?.windowCenter?.[0];
    const width = activeDescriptor?.windowWidth?.[0];
    if (!Number.isFinite(center) || !Number.isFinite(width)) return null;
    return { label: 'Auto', window: width, level: center };
  }, [activeDescriptor?.windowCenter, activeDescriptor?.windowWidth]);

  const modalityPresets = useMemo(() => {
    const modality = (activeDescriptor?.secondaryModality || '').toUpperCase();
    const description = (activeDescriptor?.secondarySeriesDescription || '').toLowerCase();
    
    const presetsByModality: Record<string, Array<{ label: string; window: number; level: number }>> = {
      MR: [
        { label: 'T1', window: 600, level: 300 },
        { label: 'T2', window: 2000, level: 1000 },
        { label: 'FLAIR', window: 1800, level: 900 },
        { label: 'Spine', window: 1200, level: 600 },
      ],
      CT: [
        { label: 'Soft Tissue', window: 400, level: 40 },
        { label: 'Lung', window: 1500, level: -600 },
        { label: 'Bone', window: 1800, level: 400 },
      ],
      PT: [],
      PET: [],
    };
    const base = presetsByModality[modality] ?? [];
    if (manifestPreset) {
      return [manifestPreset, ...base];
    }
    return base;
  }, [activeDescriptor?.secondaryModality, activeDescriptor?.secondarySeriesDescription, manifestPreset]);

  const handleOpacityChange = (values: number[]) => {
    const next = values[0];
    if (typeof next === 'number' && !Number.isNaN(next)) {
      onOpacityChange(Math.max(0, Math.min(1, next)));
    }
  };

  const getModalityColor = (modality: string) => {
    const mod = modality?.toUpperCase() || '';
    if (mod === 'PT' || mod === 'PET') return 'yellow';
    if (mod === 'MR') return 'purple';
    if (mod === 'CT') return 'blue';
    return 'slate';
  };

  const getModalityStyles = (modality: string, isActive: boolean = false) => {
    const color = getModalityColor(modality);
    const colorMap = {
      yellow: isActive 
        ? 'bg-yellow-600/90 border-yellow-500 text-yellow-50' 
        : 'bg-yellow-900/40 border-yellow-600/40 text-yellow-200 hover:bg-yellow-800/50',
      purple: isActive
        ? 'bg-purple-600/90 border-purple-500 text-purple-50'
        : 'bg-purple-900/40 border-purple-600/40 text-purple-200 hover:bg-purple-800/50',
      blue: isActive
        ? 'bg-blue-600/90 border-blue-500 text-blue-50'
        : 'bg-blue-900/40 border-blue-600/40 text-blue-200 hover:bg-blue-800/50',
      slate: isActive
        ? 'bg-slate-600/90 border-slate-500 text-slate-50'
        : 'bg-slate-800/40 border-slate-600/40 text-slate-200 hover:bg-slate-700/50',
    };
    return colorMap[color as keyof typeof colorMap];
  };

  const handleExport = async () => {
    try {
      const active = activeDescriptor;
      if (!active) {
        toast({ title: 'Select overlay', description: 'Choose a fused overlay to export', variant: 'destructive' });
        return;
      }
      if (!primarySeriesId) {
        toast({ title: 'Missing primary', description: 'Select a primary CT series first', variant: 'destructive' });
        return;
      }
      toast({ title: 'Preparing export…', description: `Fused ${active.secondaryModality} → CT` });
      const res = await fetch('/api/fusion/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primarySeriesId, secondarySeriesId: active.secondarySeriesId }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fused_${primarySeriesId}_${active.secondarySeriesId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: 'Downloading fused ZIP...' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'Export failed', description: message || 'Could not export fused series', variant: 'destructive' });
    }
  };

  const renderStatusIndicator = (status: { status: string; error?: string | null }) => {
    if (status.status === 'ready') {
      return <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />;
    }
    if (status.status === 'loading') {
      return <Loader2 className="w-3 h-3 animate-spin text-sky-400" />;
    }
    if (status.status === 'error') {
      return <div className="w-2 h-2 rounded-full bg-amber-400" />;
    }
    return null;
  };

  // Show loading state in panel
  if (manifestLoading) {
    const loadingContent = (
      <div className="w-full rounded-xl border border-white/40 bg-white/10 backdrop-blur-md shadow-2xl">
        <div className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-200">Initializing Fusion</div>
            <div className="text-xs text-gray-400">Building overlay manifest...</div>
          </div>
        </div>
      </div>
    );
    
    if (sidebarRef.current) {
      return createPortal(loadingContent, sidebarRef.current);
    }
    return (
      <div className="absolute right-7 top-44 z-40" style={{ width: '24rem' }}>
        {loadingContent}
      </div>
    );
  }

  // Show error state
  if (manifestError) {
    const errorContent = (
      <div className="w-full rounded-xl border border-white/40 bg-white/10 backdrop-blur-md shadow-2xl">
        <div className="p-4">
          <div className="text-sm font-medium text-amber-300 mb-1">Fusion Error</div>
          <div className="text-xs text-amber-200/70">{manifestError}</div>
        </div>
      </div>
    );
    
    if (sidebarRef.current) {
      return createPortal(errorContent, sidebarRef.current);
    }
    return (
      <div className="absolute right-7 top-44 z-40" style={{ width: '24rem' }}>
        {errorContent}
      </div>
    );
  }

  // Don't show panel if no options available
  if (!secondaryOptions.length) {
    return null;
  }

  // Render content
  const panelContent = (() => {
    // Minimized state - compact horizontal layout
    if (!isExpanded) {
      return (
        <div className="w-full rounded-xl border border-white/40 bg-white/10 backdrop-blur-md shadow-2xl">
        <div className="p-3 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-gray-200">Fusion</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-gray-200"
                onClick={() => onDisplayModeChange?.(displayMode === 'overlay' ? 'side-by-side' : 'overlay')}
                title={displayMode === 'overlay' ? 'Switch to side-by-side' : 'Switch to overlay'}
              >
                {displayMode === 'overlay' ? (
                  <Layers2 className="w-3.5 h-3.5" />
                ) : (
                  <SplitSquareHorizontal className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-gray-200"
                onClick={() => setIsExpanded(true)}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Opacity slider */}
          {displayMode === 'overlay' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-gray-400">Opacity</span>
                <span className="text-[10px] font-semibold text-white bg-gray-800/50 px-2 py-0.5 rounded">{Math.round(opacity * 100)}%</span>
              </div>
              <Slider 
                value={[opacity]} 
                min={0} 
                max={1} 
                step={0.01} 
                onValueChange={handleOpacityChange}
                className="w-full"
              />
            </div>
          )}

          {/* Series tags */}
          <div className="flex flex-wrap gap-1.5">
            {secondaryOptions.map((descriptor) => {
              const status = secondaryStatuses.get(descriptor.secondarySeriesId);
              const isActive = descriptor.secondarySeriesId === selectedSecondaryId;
              const isReady = status?.status === 'ready';
              
              const modalityColor = getModalityColor(descriptor.secondaryModality);
              const activeStyles = {
                yellow: 'bg-yellow-600/20 text-yellow-300 border-[0.5px] border-yellow-500/50 shadow-sm',
                purple: 'bg-purple-600/20 text-purple-300 border-[0.5px] border-purple-500/50 shadow-sm',
                blue: 'bg-blue-600/20 text-blue-300 border-[0.5px] border-blue-500/50 shadow-sm',
                slate: 'bg-slate-600/20 text-slate-300 border-[0.5px] border-slate-500/50 shadow-sm',
              };
              
              return (
                <button
                  key={descriptor.secondarySeriesId}
                  onClick={() => isReady ? onSecondarySeriesSelect(isActive ? null : descriptor.secondarySeriesId) : null}
                  disabled={!isReady}
                  className={cn(
                    'h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2 text-sm font-medium',
                    isActive
                      ? activeStyles[modalityColor as keyof typeof activeStyles]
                      : 'text-white/90 hover:bg-white/20 hover:text-white border-[0.5px] border-transparent',
                    !isReady && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {status && renderStatusIndicator(status)}
                  <span>{descriptor.secondaryModality}</span>
                  <span className="opacity-70">#{descriptor.secondarySeriesId}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      );
    }

    // Expanded state - full details
    return (
      <div className="w-full rounded-xl border border-white/40 bg-white/10 backdrop-blur-md shadow-2xl max-h-[calc(100vh-12rem)] overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold text-gray-100">Fusion Control</span>
            <Badge variant="outline" className="bg-gray-800/60 border-gray-600/50 text-[10px] text-gray-300">
              {secondaryOptions.length} available
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!activeDescriptor || !primarySeriesId}
              className={cn(
                'h-7 px-3 text-xs font-medium transition-all duration-200 rounded-lg backdrop-blur-sm shadow-sm',
                !activeDescriptor || !primarySeriesId
                  ? 'bg-gray-800/30 border-gray-700/50 text-gray-500 cursor-not-allowed'
                  : 'bg-cyan-500/30 border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/40 hover:border-cyan-400/70 hover:text-cyan-200'
              )}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-gray-200"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Display mode toggle */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDisplayModeChange?.('overlay')}
            className={cn(
              'flex-1 h-8 text-xs font-semibold transition-all duration-200 rounded-lg',
              displayMode === 'overlay' 
                ? 'bg-cyan-600/70 text-white border border-cyan-400/70 shadow-md shadow-cyan-500/30' 
                : 'bg-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-600/60 border border-gray-600/50'
            )}
          >
            <Layers2 className="w-3.5 h-3.5 mr-1.5" />
            Overlay
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDisplayModeChange?.('side-by-side')}
            className={cn(
              'flex-1 h-8 text-xs font-semibold transition-all duration-200 rounded-lg',
              displayMode === 'side-by-side' 
                ? 'bg-cyan-600/70 text-white border border-cyan-400/70 shadow-md shadow-cyan-500/30' 
                : 'bg-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-600/60 border border-gray-600/50'
            )}
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5 mr-1.5" />
            Side-by-Side
          </Button>
        </div>

        {/* Opacity slider (only in overlay mode) */}
        {displayMode === 'overlay' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">Overlay Opacity</span>
              <span className="text-xs font-semibold text-white bg-gray-800/50 px-2 py-0.5 rounded">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider 
              value={[opacity]} 
              min={0} 
              max={1} 
              step={0.01} 
              onValueChange={handleOpacityChange}
            />
          </div>
        )}

        {/* Secondary series list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Available Overlays</div>
            <div className="text-[10px] text-gray-500">{secondaryOptions.length} series</div>
          </div>
          <div className="space-y-1.5">
            {secondaryOptions.map((descriptor) => {
              const status = secondaryStatuses.get(descriptor.secondarySeriesId);
              const isActive = descriptor.secondarySeriesId === selectedSecondaryId;
              const isReady = status?.status === 'ready';
              const isLoading = status?.status === 'loading';
              const hasError = status?.status === 'error';
              
              const modalityColor = getModalityColor(descriptor.secondaryModality);
              // Active state - matches series sidebar selected appearance
              const activeGradient = {
                yellow: 'bg-gradient-to-br from-yellow-500/25 via-yellow-500/15 to-yellow-600/20 border-yellow-400/60 shadow-md shadow-yellow-500/20',
                purple: 'bg-gradient-to-br from-purple-500/25 via-purple-500/15 to-purple-600/20 border-purple-400/60 shadow-md shadow-purple-500/20',
                blue: 'bg-gradient-to-br from-blue-500/25 via-blue-500/15 to-blue-600/20 border-blue-400/60 shadow-md shadow-blue-500/20',
                slate: 'bg-gradient-to-br from-slate-500/25 via-slate-500/15 to-slate-600/20 border-slate-400/60 shadow-md shadow-slate-500/20',
              };
              
              // Inactive state - matches series sidebar unselected appearance
              const inactiveStyle = 'bg-gradient-to-br from-gray-800/40 via-gray-800/30 to-gray-900/40 border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-700/50';

              return (
                <div
                  key={descriptor.secondarySeriesId}
                  onClick={() => isReady ? onSecondarySeriesSelect(isActive ? null : descriptor.secondarySeriesId) : null}
                  className={cn(
                    'group relative w-full py-2.5 px-3 rounded-lg border text-left cursor-pointer transition-all duration-200 backdrop-blur-sm',
                    isActive 
                      ? activeGradient[modalityColor as keyof typeof activeGradient]
                      : hasError
                      ? 'bg-gradient-to-br from-amber-900/20 via-amber-900/15 to-amber-900/20 border-amber-500/40'
                      : isLoading
                      ? 'bg-gradient-to-br from-cyan-900/20 via-cyan-900/15 to-cyan-900/20 border-cyan-500/40'
                      : inactiveStyle,
                    !isReady && !isLoading && 'opacity-70'
                  )}
                >
                  {/* Loading progress indicator */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 rounded-lg transition-all duration-300 animate-pulse" />
                  )}
                  
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'text-xs font-semibold px-2.5 py-0.5 flex-shrink-0',
                          isActive 
                            ? (modalityColor === 'yellow' ? 'border-yellow-400/80 text-yellow-300 bg-yellow-500/20'
                            : modalityColor === 'purple' ? 'border-purple-400/80 text-purple-300 bg-purple-500/20'
                            : modalityColor === 'blue' ? 'border-blue-400/80 text-blue-300 bg-blue-500/20'
                            : 'border-slate-400/80 text-slate-300 bg-slate-500/20')
                            : (modalityColor === 'yellow' ? 'border-yellow-500/60 text-yellow-400 bg-yellow-500/10'
                            : modalityColor === 'purple' ? 'border-purple-500/60 text-purple-400 bg-purple-500/10'
                            : modalityColor === 'blue' ? 'border-blue-500/60 text-blue-400 bg-blue-500/10'
                            : 'border-slate-500/60 text-slate-400 bg-slate-500/10')
                        )}
                      >
                        {descriptor.secondaryModality}
                      </Badge>
                      <span className={cn(
                        'truncate text-xs font-medium',
                        isActive 
                          ? (modalityColor === 'yellow' ? 'text-yellow-200' 
                          : modalityColor === 'purple' ? 'text-purple-200'
                          : modalityColor === 'blue' ? 'text-blue-200'
                          : 'text-slate-200')
                          : 'text-gray-100'
                      )}>
                        {descriptor.secondarySeriesDescription || 'Unnamed series'}
                      </span>
                      <span className={cn(
                        'text-xs flex-shrink-0',
                        isActive 
                          ? (modalityColor === 'yellow' ? 'text-yellow-300/80' 
                          : modalityColor === 'purple' ? 'text-purple-300/80'
                          : modalityColor === 'blue' ? 'text-blue-300/80'
                          : 'text-slate-300/80')
                          : 'text-gray-400'
                      )}>
                        ({descriptor.sliceCount})
                      </span>
                    </div>
                    
                    {/* Fusion toggle button - matches series sidebar */}
                    {isActive ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 flex-shrink-0 bg-green-600 hover:bg-green-700 animate-pulse"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSecondarySeriesSelect(null);
                        }}
                      >
                        <Zap className="h-3.5 w-3.5 text-white" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          'h-7 w-7 flex-shrink-0',
                          isLoading ? 'cursor-wait' : hasError ? 'hover:bg-amber-700/30' : 'hover:bg-green-700/30'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isReady) {
                            onSecondarySeriesSelect(descriptor.secondarySeriesId);
                          }
                        }}
                        disabled={!isReady && !isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-green-200" />
                        ) : hasError ? (
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                        ) : (
                          <Zap className="h-3.5 w-3.5 text-green-300" />
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {/* Loading progress bar */}
                  {isLoading && (
                    <div className="relative mt-2 h-1 bg-gray-800/50 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/50 to-cyan-400/30 animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                  
                  {/* Error message */}
                  {hasError && status.error && (
                    <div className="mt-2 text-[10px] text-amber-300/80 truncate">
                      {status.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Window/Level presets (only when active and has presets) */}
        {activeDescriptor && modalityPresets.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Window / Level</div>
            <div>
              <div className="grid grid-cols-2 gap-1.5">
                {modalityPresets.map((preset) => {
                  const isActive = windowLevel && 
                    Math.abs(windowLevel.window - preset.window) < 1 && 
                    Math.abs(windowLevel.level - preset.level) < 1;
                  return (
                    <Button
                      key={`${preset.label}-${preset.window}-${preset.level}`}
                      variant="outline"
                      size="sm"
                      className={cn(
                        'text-xs py-1.5 px-2 h-auto transition-all',
                        isActive 
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                          : 'bg-gray-800/30 border-gray-700/50 text-gray-300 hover:bg-gray-700/40 hover:text-white hover:border-gray-600/50'
                      )}
                      onClick={() => onWindowLevelPreset?.({ window: preset.window, level: preset.level })}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'text-xs py-1.5 px-2 h-auto transition-all',
                    !windowLevel 
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                      : 'bg-gray-800/30 border-gray-700/50 text-gray-300 hover:bg-gray-700/40 hover:text-white hover:border-gray-600/50'
                  )}
                  onClick={() => onWindowLevelPreset?.(null)}
                >
                  Auto
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    );
  })();

  // Render inside sidebar if available, otherwise absolute positioned
  if (sidebarRef.current) {
    return createPortal(panelContent, sidebarRef.current);
  }

  // Fallback to absolute positioning
  return (
    <div className="absolute right-7 top-44 z-40" style={{ width: '24rem' }}>
      {panelContent}
    </div>
  );
}

