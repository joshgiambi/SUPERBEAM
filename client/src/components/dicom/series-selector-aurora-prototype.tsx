/**
 * Series Selector Aurora Prototype
 * 
 * Visual refresh only - keeps existing layout and object sizes
 * Applies Aurora/Unified Fusion styling:
 * - Modality-specific colors (amber/PT, purple/MR, blue/CT)
 * - Cleaner borders and subtle gradients
 * - Proper hierarchy with border-left lines
 * - Fusion activation Zap buttons
 */

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Layers3,
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Settings,
  Palette,
  Trash2,
  Plus,
  ArrowUpDown,
  FolderTree,
  Info,
  Loader2,
  History,
  ExternalLink,
  IterationCw,
  SplitSquareHorizontal,
} from 'lucide-react';

// ============================================================================
// TYPES & MOCK DATA
// ============================================================================

interface MockSeries {
  id: number;
  modality: string;
  seriesDescription: string;
  seriesNumber: number;
  imageCount: number;
  fusionStatus: 'idle' | 'loading' | 'ready' | 'error';
  isRTStruct: boolean;
  referencedSeriesId?: number;
}

interface MockStructure {
  roiNumber: number;
  structureName: string;
  color: [number, number, number];
  contourCount: number;
  isSuperstructure?: boolean;
  hasBlobsDetected?: boolean;
  blobCount?: number;
}

// Hierarchical mock data - Primary CT with nested fusion candidates
const MOCK_PRIMARY_CT: MockSeries = { 
  id: 1, modality: 'CT', seriesDescription: 'Head_Neck C+ 2.0mm', seriesNumber: 2, imageCount: 287, fusionStatus: 'ready', isRTStruct: false 
};

const MOCK_FUSION_PT: MockSeries[] = [
  { id: 2, modality: 'PT', seriesDescription: 'QCFX MAC HN 2.5mm', seriesNumber: 4, imageCount: 412, fusionStatus: 'ready', isRTStruct: false },
];

const MOCK_FUSION_MR: MockSeries[] = [
  { id: 3, modality: 'MR', seriesDescription: 'T1 AXIAL POST GAD', seriesNumber: 5, imageCount: 192, fusionStatus: 'ready', isRTStruct: false },
  { id: 4, modality: 'MR', seriesDescription: 'T2 FLAIR AXIAL', seriesNumber: 6, imageCount: 156, fusionStatus: 'loading', isRTStruct: false },
];

const MOCK_RT_STRUCTS: MockSeries[] = [
  { id: 5, modality: 'RTSTRUCT', seriesDescription: 'RT Structure Set', seriesNumber: 10, imageCount: 0, fusionStatus: 'idle', isRTStruct: true, referencedSeriesId: 1 },
  { id: 6, modality: 'RTSTRUCT', seriesDescription: 'Physician Approved', seriesNumber: 11, imageCount: 0, fusionStatus: 'idle', isRTStruct: true, referencedSeriesId: 1 },
];

const MOCK_STRUCTURES: MockStructure[] = [
  // GTV group
  { roiNumber: 1, structureName: 'GTV', color: [255, 100, 100], contourCount: 45 },
  { roiNumber: 2, structureName: 'GTV_N1', color: [255, 80, 80], contourCount: 23, hasBlobsDetected: true, blobCount: 3 },
  // CTV group - superstructures (auto-generated from GTVs)
  { roiNumber: 3, structureName: 'CTV_High', color: [255, 180, 80], contourCount: 67, isSuperstructure: true },
  { roiNumber: 4, structureName: 'CTV_Low', color: [255, 160, 60], contourCount: 45, isSuperstructure: true },
  // PTV group - superstructures
  { roiNumber: 5, structureName: 'PTV_High', color: [80, 180, 255], contourCount: 78, isSuperstructure: true },
  { roiNumber: 6, structureName: 'PTV_Low', color: [60, 160, 255], contourCount: 56, isSuperstructure: true },
  // Paired structures (L/R grouping)
  { roiNumber: 7, structureName: 'Parotid_L', color: [255, 130, 180], contourCount: 34 },
  { roiNumber: 8, structureName: 'Parotid_R', color: [255, 130, 180], contourCount: 36, hasBlobsDetected: true, blobCount: 2 },
  { roiNumber: 9, structureName: 'OpticNerve_L', color: [255, 220, 100], contourCount: 12 },
  { roiNumber: 10, structureName: 'OpticNerve_R', color: [255, 220, 100], contourCount: 11 },
  // Ungrouped
  { roiNumber: 11, structureName: 'Brainstem', color: [180, 100, 255], contourCount: 52 },
  { roiNumber: 12, structureName: 'SpinalCord', color: [100, 255, 160], contourCount: 89 },
  { roiNumber: 13, structureName: 'Mandible', color: [200, 200, 100], contourCount: 45, hasBlobsDetected: true, blobCount: 5 },
  { roiNumber: 14, structureName: 'Chiasm', color: [100, 200, 255], contourCount: 8 },
  { roiNumber: 15, structureName: 'External', color: [180, 180, 180], contourCount: 287 },
];

const WINDOW_PRESETS = [
  { label: 'Soft Tissue', window: 400, level: 40 },
  { label: 'Lung', window: 1500, level: -600 },
  { label: 'Bone', window: 1800, level: 400 },
  { label: 'Brain', window: 80, level: 40 },
];

// ============================================================================
// HELPERS
// ============================================================================

const formatSeriesLabel = (s: MockSeries) => {
  const desc = s.seriesDescription || `Series ${s.id}`;
  return `#${s.seriesNumber} · ${desc.length > 35 ? desc.slice(0, 32) + '…' : desc}`;
};

// ============================================================================
// STRUCTURE ROW COMPONENT
// ============================================================================

interface StructureRowProps {
  structure: MockStructure;
  isEditing: boolean;
  isVisible: boolean;
  isSelected: boolean;
  onToggleVisibility: () => void;
  onToggleSelection: () => void;
  onEdit: () => void;
}

function StructureRow({ structure, isEditing, isVisible, isSelected, onToggleVisibility, onToggleSelection, onEdit }: StructureRowProps) {
  const [superstructureExpanded, setSuperstructureExpanded] = useState(false);
  
  return (
    <div className="space-y-0">
      <div 
        className={cn(
          "group flex items-center space-x-2 px-2 py-1.5 rounded-lg border transition-all duration-150",
          isEditing
            ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-400/50 shadow-sm shadow-green-500/10'
            : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
        )}
      >
        {/* Selection checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelection}
          className="h-3 w-3 border-yellow-500/60 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
        />
        
        {/* Visibility toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleVisibility}
          className="p-0.5 h-5 w-5 hover:bg-gray-600/50 rounded-lg"
        >
          {isVisible ? (
            <Eye className="w-3 h-3 text-blue-400" />
          ) : (
            <EyeOff className="w-3 h-3 text-gray-500" />
          )}
        </Button>
        
        {/* Color swatch */}
        <div 
          className="w-3 h-3 rounded border border-gray-600/50 flex-shrink-0"
          style={{ backgroundColor: `rgb(${structure.color.join(',')})` }}
        />
        
        {/* Name */}
        <span 
          className={cn(
            "text-xs font-medium flex-1 truncate cursor-pointer transition-colors",
            isEditing ? "text-green-400" : "text-gray-100 hover:text-green-400"
          )}
          onClick={onEdit}
        >
          {structure.structureName}
        </span>
        
        {/* Superstructure indicator OR Blob indicator (mutually exclusive) */}
        {structure.isSuperstructure ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSuperstructureExpanded(!superstructureExpanded)}
                className={cn(
                  "p-0.5 h-5 w-5 rounded-lg opacity-70 hover:opacity-100",
                  superstructureExpanded ? "bg-cyan-500/30" : "hover:bg-cyan-500/20"
                )}
              >
                <IterationCw className="w-3 h-3 text-cyan-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Superstructure - {superstructureExpanded ? 'Hide' : 'Show'} dependencies</TooltipContent>
          </Tooltip>
        ) : structure.hasBlobsDetected ? (
          <Button
            variant="ghost"
            size="sm"
            className="p-0.5 h-5 w-5 hover:bg-purple-500/30 rounded-lg opacity-70 hover:opacity-100"
            title={`${structure.blobCount} blobs detected`}
          >
            <SplitSquareHorizontal className="w-3 h-3 text-purple-400" />
          </Button>
        ) : null}
        
        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          className="p-0.5 h-5 w-5 hover:bg-red-500/30 rounded-lg opacity-70 hover:opacity-100"
        >
          <Trash2 className="w-3 h-3 text-red-400" />
        </Button>
      </div>
      
      {/* Superstructure dependencies dropdown */}
      {structure.isSuperstructure && superstructureExpanded && (
        <div className="ml-6 mt-1 mb-1">
          <div className="bg-gray-800/40 border border-gray-600/50 rounded-lg p-2">
            <div className="text-[9px] text-gray-400 font-semibold mb-1.5 uppercase tracking-wide">
              Auto-updating from:
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-cyan-500/40 border border-cyan-400/60 flex items-center justify-center text-[9px] font-bold text-cyan-200">1</div>
                <span className="text-[10px] text-gray-200">GTV</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-600/40 border border-purple-400/60 flex items-center justify-center text-[9px] font-bold text-purple-200">2</div>
                <span className="text-[10px] text-gray-200">Margin 5mm</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[9px] text-cyan-300 font-medium">Auto-update enabled</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PROTOTYPE COMPONENT
// ============================================================================

export function SeriesSelectorAuroraPrototype() {
  // State
  const [selectedSeriesId, setSelectedSeriesId] = useState<number>(1);
  const [fusionSeriesId, setFusionSeriesId] = useState<number | null>(null);
  const [selectedRTSeriesId, setSelectedRTSeriesId] = useState<number | null>(5);
  const [windowLevel, setWindowLevel] = useState({ window: 400, level: 40 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForEdit, setSelectedForEdit] = useState<number | null>(null);
  const [structureVisibility, setStructureVisibility] = useState<Map<number, boolean>>(() => {
    const map = new Map();
    MOCK_STRUCTURES.forEach(s => map.set(s.roiNumber, true));
    return map;
  });
  const [accordionValues, setAccordionValues] = useState<string[]>(['series', 'structures']);
  const [groupingEnabled, setGroupingEnabled] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['GTV', 'CTV', 'PTV']));
  const [selectedStructures, setSelectedStructures] = useState<Set<number>>(new Set());
  
  // Group structures
  const groupedStructures = useMemo(() => {
    const specialGroups = new Map<string, MockStructure[]>([
      ['GTV', []],
      ['CTV', []],
      ['PTV', []],
    ]);
    const pairedGroups = new Map<string, MockStructure[]>();
    const ungrouped: MockStructure[] = [];
    
    const structures = searchTerm 
      ? MOCK_STRUCTURES.filter(s => s.structureName.toLowerCase().includes(searchTerm.toLowerCase()))
      : MOCK_STRUCTURES;
    
    structures.forEach(s => {
      const name = s.structureName;
      if (name.startsWith('GTV')) {
        specialGroups.get('GTV')!.push(s);
      } else if (name.startsWith('CTV')) {
        specialGroups.get('CTV')!.push(s);
      } else if (name.startsWith('PTV')) {
        specialGroups.get('PTV')!.push(s);
      } else if (name.endsWith('_L') || name.endsWith('_R')) {
        const baseName = name.replace(/_[LR]$/, '');
        if (!pairedGroups.has(baseName)) pairedGroups.set(baseName, []);
        pairedGroups.get(baseName)!.push(s);
      } else {
        ungrouped.push(s);
      }
    });
    
    const nonEmptySpecial = new Map<string, MockStructure[]>();
    specialGroups.forEach((arr, key) => { if (arr.length > 0) nonEmptySpecial.set(key, arr); });
    
    return { specialGroups: nonEmptySpecial, pairedGroups, ungrouped };
  }, [searchTerm]);
  
  const allVisible = useMemo(() => {
    return MOCK_STRUCTURES.every(s => structureVisibility.get(s.roiNumber) === true);
  }, [structureVisibility]);
  
  const toggleGroupExpansion = (groupName: string) => {
    const next = new Set(expandedGroups);
    next.has(groupName) ? next.delete(groupName) : next.add(groupName);
    setExpandedGroups(next);
  };
  
  const toggleGroupVisibility = (structures: MockStructure[]) => {
    const allVis = structures.every(s => structureVisibility.get(s.roiNumber) === true);
    const newMap = new Map(structureVisibility);
    structures.forEach(s => newMap.set(s.roiNumber, !allVis));
    setStructureVisibility(newMap);
  };
  
  const toggleAllVisibility = () => {
    const newVisible = !allVisible;
    const newMap = new Map<number, boolean>();
    MOCK_STRUCTURES.forEach(s => newMap.set(s.roiNumber, newVisible));
    setStructureVisibility(newMap);
  };

  // Derived
  const selectedRTSeries = MOCK_RT_STRUCTS.find(s => s.id === selectedRTSeriesId);
  const fusionSeries = fusionSeriesId ? [...MOCK_FUSION_PT, ...MOCK_FUSION_MR].find(s => s.id === fusionSeriesId) : null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-[#0a0a0e] text-white p-6">
        {/* Header */}
        <Card className="mb-6 bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Info className="w-4 h-4 text-cyan-400" />
              Series Selector Aurora - Visual Refresh
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Same layout/sizing as production - proper hierarchy with border-left lines, Zap fusion buttons
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="flex gap-6">
          {/* Sidebar - wider */}
          <div className="w-[320px] flex-shrink-0">
            <Card className="bg-gray-950/90 backdrop-blur-xl border border-gray-600/60 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
              <CardContent className="p-0">
                <Accordion 
                  type="multiple" 
                  value={accordionValues}
                  onValueChange={setAccordionValues}
                >
                  {/* ===== SERIES SECTION ===== */}
                  <AccordionItem value="series" className="border-gray-800/50">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center text-gray-100 font-semibold text-sm">
                        <Layers3 className="w-4 h-4 mr-2.5 text-blue-400" />
                        Series
                      </div>
                    </AccordionTrigger>
                    
                    {/* Summary when collapsed */}
                    {!accordionValues.includes('series') && (
                      <div className="px-4 py-2 space-y-1.5 border-t border-gray-800/50 bg-gray-900/30">
                        {/* Primary CT summary */}
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-blue-400/80 text-blue-300 bg-blue-500/20">
                            CT
                          </Badge>
                          <span className="text-gray-200 truncate font-medium">
                            {formatSeriesLabel(MOCK_PRIMARY_CT)} ({MOCK_PRIMARY_CT.imageCount})
                          </span>
                        </div>
                        
                        {/* Active Fusion summary */}
                        {fusionSeries && (
                          <div className="flex items-center gap-2 text-xs pl-4 border-l-2 border-cyan-500/40">
                            <Zap className="h-3 w-3 text-cyan-400" />
                            <Badge variant="outline" className={cn(
                              "text-xs font-semibold px-2 py-0.5",
                              fusionSeries.modality === 'PT' 
                                ? "border-amber-400/80 text-amber-300 bg-amber-500/20"
                                : "border-purple-400/80 text-purple-300 bg-purple-500/20"
                            )}>
                              {fusionSeries.modality}
                            </Badge>
                            <span className="text-gray-200 truncate font-medium">
                              {formatSeriesLabel(fusionSeries)}
                            </span>
                          </div>
                        )}
                        
                        {/* RT Structure summary */}
                        {selectedRTSeries && (
                          <div className="flex items-center gap-2 text-xs pl-4 border-l-2 border-green-500/40">
                            <Badge variant="outline" className="border-green-500/80 text-green-400 bg-green-500/20 text-xs font-semibold px-2 py-0.5">
                              RT
                            </Badge>
                            <span className="text-gray-200 truncate font-medium">
                              {selectedRTSeries.seriesDescription}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                        {/* ===== PRIMARY CT CARD ===== */}
                        <div
                          className={cn(
                            "group relative py-1.5 px-2 rounded-lg border cursor-pointer transition-all duration-150",
                            selectedSeriesId === MOCK_PRIMARY_CT.id
                              ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-400/50 shadow-sm shadow-blue-500/10'
                              : 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-800/50 hover:border-gray-600/40'
                          )}
                          onClick={() => setSelectedSeriesId(MOCK_PRIMARY_CT.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-semibold px-1.5 py-0 h-4 flex-shrink-0",
                                selectedSeriesId === MOCK_PRIMARY_CT.id
                                  ? 'border-blue-400/70 text-blue-300 bg-blue-500/25'
                                  : 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                              )}>
                                CT • Planning
                              </Badge>
                              <span className={cn(
                                "text-xs font-medium truncate",
                                selectedSeriesId === MOCK_PRIMARY_CT.id ? 'text-blue-100' : 'text-gray-200'
                              )}>
                                {formatSeriesLabel(MOCK_PRIMARY_CT)}
                              </span>
                              <span className="text-[10px] text-gray-500 flex-shrink-0">
                                {MOCK_PRIMARY_CT.imageCount}
                              </span>
                            </div>
                            {selectedSeriesId === MOCK_PRIMARY_CT.id && (
                              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            )}
                          </div>
                        </div>

                        {/* ===== NESTED HIERARCHY UNDER PRIMARY CT ===== */}
                        <div className="ml-3 space-y-2">
                          
                          {/* RT Structure Sets */}
                          <div className="space-y-0.5 border-l-2 border-green-500/40 pl-2 ml-1">
                            {MOCK_RT_STRUCTS.map((rtS) => (
                              <div
                                key={rtS.id}
                                className={cn(
                                  "group w-full px-2 py-1 rounded-lg border transition-all duration-150 cursor-pointer flex items-center justify-between",
                                  selectedRTSeriesId === rtS.id 
                                    ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-400/50 shadow-sm shadow-green-500/10' 
                                    : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                )}
                                onClick={() => setSelectedRTSeriesId(rtS.id)}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0 h-4 flex-shrink-0",
                                    selectedRTSeriesId === rtS.id
                                      ? "border-green-400/70 text-green-300 bg-green-500/25"
                                      : "border-green-500/40 text-green-400 bg-green-500/10"
                                  )}>
                                    RT
                                  </Badge>
                                  <span className={cn(
                                    "truncate text-xs",
                                    selectedRTSeriesId === rtS.id ? "text-green-100 font-medium" : "text-gray-300"
                                  )}>
                                    {rtS.seriesDescription}
                                  </span>
                                </div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="flex-shrink-0 p-1 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors">
                                      <History className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">View History</TooltipContent>
                                </Tooltip>
                              </div>
                            ))}
                          </div>

                          {/* Fusion-Ready PET */}
                          {MOCK_FUSION_PT.length > 0 && (
                            <div className="space-y-0.5 border-l-2 border-amber-500/40 pl-2 ml-1 mt-1">
                              <div className="text-[9px] text-amber-400/80 uppercase tracking-wider flex items-center gap-1 px-1 pb-0.5">
                                <Zap className="w-2.5 h-2.5" />
                                PET Fusion
                              </div>
                              {MOCK_FUSION_PT.map((ptS) => {
                                const isActive = fusionSeriesId === ptS.id;
                                const isLoading = ptS.fusionStatus === 'loading';
                                const isReady = ptS.fusionStatus === 'ready';
                                
                                return (
                                  <div
                                    key={ptS.id}
                                    className={cn(
                                      "group relative w-full py-1 px-2 rounded-lg border transition-all duration-150 text-left text-xs cursor-pointer flex items-center justify-between",
                                      isActive
                                        ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 border-amber-400/60 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/40'
                                        : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                    )}
                                    onClick={() => isReady && setFusionSeriesId(isActive ? null : ptS.id)}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Badge variant="outline" className={cn(
                                        "text-[10px] font-semibold px-1.5 py-0 h-4 flex-shrink-0",
                                        isActive
                                          ? "border-amber-400/70 text-amber-300 bg-amber-500/25"
                                          : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                      )}>
                                        PT
                                      </Badge>
                                      <span className={cn("truncate text-xs", isActive ? "text-amber-100 font-medium" : "text-gray-200")}>
                                        {formatSeriesLabel(ptS)}
                                      </span>
                                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                                        {ptS.imageCount}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      {/* View standalone button */}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 hover:bg-amber-700/30"
                                            onClick={(e) => { e.stopPropagation(); }}
                                          >
                                            <ExternalLink className="h-3 w-3 text-amber-300" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-gradient-to-br from-amber-600/95 to-amber-700/95 border-amber-400/30 text-white text-xs">
                                          View PET standalone
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      {/* Fusion toggle button */}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className={cn(
                                              "h-6 w-6 flex-shrink-0 rounded transition-all",
                                              isActive 
                                                ? "bg-green-600 hover:bg-green-700 text-white animate-pulse shadow-lg shadow-green-500/30" 
                                                : "text-green-400 hover:text-green-300 hover:bg-green-500/20"
                                            )}
                                            onClick={(e) => { e.stopPropagation(); setFusionSeriesId(isActive ? null : ptS.id); }}
                                          >
                                            {isLoading ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <Zap className="h-3.5 w-3.5" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className={cn(
                                          "text-xs",
                                          isActive ? "bg-gradient-to-br from-green-600/95 to-green-700/95 border-green-400/30 text-white" : ""
                                        )}>
                                          {isActive ? 'Fusion Active - Click to disable' : 'Activate fusion overlay'}
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Fusion-Ready MRI */}
                          {MOCK_FUSION_MR.length > 0 && (
                            <div className="space-y-0.5 border-l-2 border-purple-500/40 pl-2 ml-1 mt-1">
                              <div className="text-[9px] text-purple-400/80 uppercase tracking-wider flex items-center gap-1 px-1 pb-0.5">
                                <Zap className="w-2.5 h-2.5" />
                                MRI Fusion
                              </div>
                              {MOCK_FUSION_MR.map((mrS) => {
                                const isActive = fusionSeriesId === mrS.id;
                                const isLoading = mrS.fusionStatus === 'loading';
                                const isReady = mrS.fusionStatus === 'ready';
                                
                                return (
                                  <div
                                    key={mrS.id}
                                    className={cn(
                                      "group relative w-full py-1 px-2 rounded-lg border transition-all duration-150 text-left text-xs cursor-pointer flex items-center justify-between overflow-hidden",
                                      isActive
                                        ? 'bg-gradient-to-r from-purple-500/25 to-purple-600/15 border-purple-400/60 shadow-md shadow-purple-500/20 ring-1 ring-purple-400/40'
                                        : isLoading
                                        ? 'bg-purple-500/5 border-purple-500/20'
                                        : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                    )}
                                    onClick={() => isReady && setFusionSeriesId(isActive ? null : mrS.id)}
                                  >
                                    {/* Loading progress bar */}
                                    {isLoading && (
                                      <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-purple-500/30 to-transparent animate-pulse" />
                                    )}
                                    
                                    <div className="relative flex items-center gap-2 flex-1 min-w-0">
                                      <Badge variant="outline" className={cn(
                                        "text-[10px] font-semibold px-1.5 py-0 h-4 flex-shrink-0",
                                        isActive
                                          ? "border-purple-400/70 text-purple-300 bg-purple-500/25"
                                          : "border-purple-500/40 text-purple-400 bg-purple-500/10"
                                      )}>
                                        MR
                                      </Badge>
                                      <span className={cn("truncate text-xs", isActive ? "text-purple-100 font-medium" : "text-gray-200")}>
                                        {formatSeriesLabel(mrS)}
                                      </span>
                                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                                        {mrS.imageCount}
                                      </span>
                                    </div>
                                    
                                    <div className="relative flex items-center gap-1">
                                      {/* View standalone button */}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 hover:bg-purple-700/30"
                                            onClick={(e) => { e.stopPropagation(); }}
                                          >
                                            <ExternalLink className="h-3 w-3 text-purple-300" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-gradient-to-br from-purple-600/95 to-purple-700/95 border-purple-400/30 text-white text-xs">
                                          View MRI standalone
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      {/* Fusion toggle button */}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className={cn(
                                              "h-6 w-6 flex-shrink-0 rounded transition-all",
                                              isActive 
                                                ? "bg-green-600 hover:bg-green-700 text-white animate-pulse shadow-lg shadow-green-500/30" 
                                                : isLoading 
                                                ? "cursor-wait text-purple-400" 
                                                : "text-green-400 hover:text-green-300 hover:bg-green-500/20"
                                            )}
                                            onClick={(e) => { e.stopPropagation(); if (isReady) setFusionSeriesId(isActive ? null : mrS.id); }}
                                            disabled={isLoading}
                                          >
                                            {isLoading ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <Zap className="h-3.5 w-3.5" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className={cn(
                                          "text-xs",
                                          isActive ? "bg-gradient-to-br from-green-600/95 to-green-700/95 border-green-400/30 text-white" : ""
                                        )}>
                                          {isLoading ? 'Preparing overlay...' : isActive ? 'Fusion Active - Click to disable' : 'Activate fusion overlay'}
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ===== WINDOW/LEVEL SECTION ===== */}
                  <AccordionItem value="window-level" className="border-gray-800/50">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center text-gray-100 font-semibold text-sm">
                        <Settings className="w-4 h-4 mr-2.5 text-orange-400" />
                        Window / Level
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-400">Window</span>
                              <span className="text-xs font-medium text-orange-300 tabular-nums">{windowLevel.window}</span>
                            </div>
                            <Slider
                              value={[windowLevel.window]}
                              onValueChange={([v]) => setWindowLevel(prev => ({ ...prev, window: v }))}
                              max={4000}
                              min={1}
                              step={10}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-400">Level</span>
                              <span className="text-xs font-medium text-blue-300 tabular-nums">{windowLevel.level}</span>
                            </div>
                            <Slider
                              value={[windowLevel.level]}
                              onValueChange={([v]) => setWindowLevel(prev => ({ ...prev, level: v }))}
                              max={1000}
                              min={-1000}
                              step={10}
                              className="w-full"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-1.5">
                          {WINDOW_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              onClick={() => setWindowLevel({ window: preset.window, level: preset.level })}
                              className={cn(
                                "px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all border",
                                windowLevel.window === preset.window && windowLevel.level === preset.level
                                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                                  : "bg-gray-800/40 text-gray-400 border-gray-700/30 hover:bg-gray-700/50 hover:text-gray-200"
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ===== STRUCTURES SECTION ===== */}
                  <AccordionItem value="structures" className="border-gray-800/50">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center text-gray-100 font-semibold text-sm">
                        <Palette className="w-4 h-4 mr-2.5 text-green-400" />
                        Structures
                        <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5 border-gray-600 text-gray-400">
                          {MOCK_STRUCTURES.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {/* Toolbar */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                          <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search..."
                            className="h-7 pl-7 pr-7 text-xs bg-gray-900/60 border-gray-700/50 text-white placeholder:text-gray-600 rounded-lg"
                          />
                          {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={toggleAllVisibility} className="h-7 w-7 p-0 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 rounded-lg">
                              {allVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{allVisible ? 'Hide All' : 'Show All'}</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setGroupingEnabled(!groupingEnabled)} className={cn("h-7 w-7 p-0 border rounded-lg", groupingEnabled ? "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20" : "bg-gray-500/10 border-gray-500/30 text-gray-400 hover:bg-gray-500/20")}>
                              <FolderTree className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{groupingEnabled ? 'Disable grouping' : 'Enable grouping'}</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 rounded-lg">
                              <ArrowUpDown className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Sort</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-lg">
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Add Structure</TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Structure list with hierarchy */}
                      <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                        {/* Special Groups */}
                        {Array.from(groupedStructures.specialGroups.entries()).map(([groupName, structures]) => {
                          const isExpanded = expandedGroups.has(groupName);
                          const allGroupVisible = structures.every(s => structureVisibility.get(s.roiNumber) === true);
                          const groupColor = groupName === 'GTV' ? 'red' : groupName === 'CTV' ? 'orange' : 'blue';
                          
                          return (
                            <div key={groupName}>
                              <div 
                                className={cn(
                                  "flex items-center justify-between px-2 py-1.5 rounded-lg border cursor-pointer transition-colors",
                                  isExpanded 
                                    ? 'bg-gray-800/40 border-gray-700/40' 
                                    : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                )}
                                onClick={() => toggleGroupExpansion(groupName)}
                              >
                                <div className="flex items-center space-x-1.5">
                                  {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                                  <span className={cn(
                                    "text-xs font-semibold",
                                    groupColor === 'red' ? 'text-red-400' : groupColor === 'orange' ? 'text-orange-400' : 'text-blue-400'
                                  )}>{groupName}</span>
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] h-4 px-1.5",
                                    groupColor === 'red' ? 'border-red-500/40 text-red-400/80' : groupColor === 'orange' ? 'border-orange-500/40 text-orange-400/80' : 'border-blue-500/40 text-blue-400/80'
                                  )}>
                                    {structures.length}
                                  </Badge>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); toggleGroupVisibility(structures); }} className="p-1 hover:bg-gray-700/50 rounded transition-colors">
                                  {allGroupVisible ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3 text-gray-600" />}
                                </button>
                              </div>
                              
                              {isExpanded && (
                                <div className={cn(
                                  "ml-3 mt-0.5 space-y-0.5 border-l-2 pl-2",
                                  groupColor === 'red' ? 'border-red-500/50' : groupColor === 'orange' ? 'border-orange-500/50' : 'border-blue-500/50'
                                )}>
                                  {structures.map((structure) => (
                                    <StructureRow 
                                      key={structure.roiNumber} 
                                      structure={structure} 
                                      isEditing={selectedForEdit === structure.roiNumber} 
                                      isVisible={structureVisibility.get(structure.roiNumber) ?? true} 
                                      isSelected={selectedStructures.has(structure.roiNumber)}
                                      onToggleVisibility={() => { const m = new Map(structureVisibility); m.set(structure.roiNumber, !(structureVisibility.get(structure.roiNumber) ?? true)); setStructureVisibility(m); }} 
                                      onToggleSelection={() => { const s = new Set(selectedStructures); s.has(structure.roiNumber) ? s.delete(structure.roiNumber) : s.add(structure.roiNumber); setSelectedStructures(s); }}
                                      onEdit={() => setSelectedForEdit(selectedForEdit === structure.roiNumber ? null : structure.roiNumber)} 
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Paired Groups */}
                        {Array.from(groupedStructures.pairedGroups.entries()).map(([groupName, structures]) => {
                          const isExpanded = expandedGroups.has(groupName);
                          const allGroupVisible = structures.every(s => structureVisibility.get(s.roiNumber) === true);
                          
                          return (
                            <div key={groupName}>
                              <div 
                                className={cn(
                                  "flex items-center justify-between px-2 py-1.5 rounded-lg border cursor-pointer transition-colors",
                                  isExpanded 
                                    ? 'bg-gray-800/40 border-gray-700/40' 
                                    : 'bg-gray-800/20 border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                                )}
                                onClick={() => toggleGroupExpansion(groupName)}
                              >
                                <div className="flex items-center space-x-1.5">
                                  {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                                  <div className="flex items-center -space-x-0.5">
                                    {structures.map((s, i) => (
                                      <div key={i} className="w-3 h-3 rounded border border-gray-900/50" style={{ backgroundColor: `rgb(${s.color.join(',')})` }} />
                                    ))}
                                  </div>
                                  <span className="text-xs font-medium text-gray-100">{groupName}</span>
                                  <span className="text-[10px] text-gray-500">L/R</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); toggleGroupVisibility(structures); }} className="p-1 hover:bg-gray-700/50 rounded transition-colors">
                                  {allGroupVisible ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3 text-gray-600" />}
                                </button>
                              </div>
                              
                              {isExpanded && (
                                <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-pink-500/40 pl-2">
                                  {structures.map((structure) => (
                                    <StructureRow 
                                      key={structure.roiNumber} 
                                      structure={structure} 
                                      isEditing={selectedForEdit === structure.roiNumber} 
                                      isVisible={structureVisibility.get(structure.roiNumber) ?? true} 
                                      isSelected={selectedStructures.has(structure.roiNumber)}
                                      onToggleVisibility={() => { const m = new Map(structureVisibility); m.set(structure.roiNumber, !(structureVisibility.get(structure.roiNumber) ?? true)); setStructureVisibility(m); }} 
                                      onToggleSelection={() => { const s = new Set(selectedStructures); s.has(structure.roiNumber) ? s.delete(structure.roiNumber) : s.add(structure.roiNumber); setSelectedStructures(s); }}
                                      onEdit={() => setSelectedForEdit(selectedForEdit === structure.roiNumber ? null : structure.roiNumber)} 
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Ungrouped */}
                        {groupedStructures.ungrouped.map((structure) => (
                          <StructureRow 
                            key={structure.roiNumber} 
                            structure={structure} 
                            isEditing={selectedForEdit === structure.roiNumber} 
                            isVisible={structureVisibility.get(structure.roiNumber) ?? true} 
                            isSelected={selectedStructures.has(structure.roiNumber)}
                            onToggleVisibility={() => { const m = new Map(structureVisibility); m.set(structure.roiNumber, !(structureVisibility.get(structure.roiNumber) ?? true)); setStructureVisibility(m); }} 
                            onToggleSelection={() => { const s = new Set(selectedStructures); s.has(structure.roiNumber) ? s.delete(structure.roiNumber) : s.add(structure.roiNumber); setSelectedStructures(s); }}
                            onEdit={() => setSelectedForEdit(selectedForEdit === structure.roiNumber ? null : structure.roiNumber)} 
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
          
          {/* Main Viewport Preview */}
          <div className="flex-1">
            <Card className="bg-gray-900/50 border-gray-800 h-full">
              <CardContent className="p-4 h-full">
                <div className="h-[600px] rounded-xl border border-gray-800 bg-black flex items-center justify-center">
                  <div className="text-center text-gray-600">
                    <div className="text-sm mb-2">DICOM Viewport</div>
                    <div className="text-xs space-y-1">
                      <div>Primary: CT - {MOCK_PRIMARY_CT.seriesDescription}</div>
                      {fusionSeries && (
                        <div className={fusionSeries.modality === 'PT' ? 'text-amber-400' : 'text-purple-400'}>
                          Fusion: {fusionSeries.modality} - {fusionSeries.seriesDescription}
                        </div>
                      )}
                      <div>W: {windowLevel.window} / L: {windowLevel.level}</div>
                      {selectedRTSeries && (
                        <div className="text-green-400">RT: {selectedRTSeries.seriesDescription}</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
