/**
 * SuperStyle - Converge/Superbeam Style Guide
 * 
 * Accurate documentation of UI components and patterns
 * actually used throughout the application.
 */

import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft,
  Palette,
  Type,
  Square,
  Layers,
  MousePointer2,
  LayoutGrid,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Home,
  Settings,
  Menu,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Ruler,
  Crosshair,
  Grid3x3,
  Target,
  Undo,
  Redo,
  History,
  Layers3,
  Activity,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Edit3,
  Trash2,
  Save,
  Download,
  Upload,
  Copy,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  HelpCircle,
  Folder,
  FolderTree,
  Beaker,
  FlaskConical,
  Sparkles,
  Zap,
  Link as LinkIcon,
  ExternalLink,
  Bug,
  Scissors,
  SquareStack,
  GitMerge,
  Boxes,
  SplitSquareHorizontal,
  PanelLeft,
  PanelRight,
  LayoutDashboard,
  Highlighter,
  Expand,
  Brain,
  Network,
  ArrowRight,
  GitBranch,
  CheckCircle2,
  XCircle,
  RefreshCw,
  RotateCcw,
  Move,
  Box,
  Library,
  Play,
  Eraser,
  User,
  Sliders,
} from 'lucide-react';

// ============================================================================
// SECTION NAVIGATION
// ============================================================================

type Section = 'colors' | 'typography' | 'buttons' | 'inputs' | 'sliders' | 'containers' | 'badges' | 'dialogs' | 'progress' | 'icons' | 'harmonize';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'colors', label: 'Colors', icon: <Palette className="w-4 h-4" /> },
  { id: 'typography', label: 'Typography', icon: <Type className="w-4 h-4" /> },
  { id: 'buttons', label: 'Buttons', icon: <Square className="w-4 h-4" /> },
  { id: 'inputs', label: 'Inputs & Forms', icon: <MousePointer2 className="w-4 h-4" /> },
  { id: 'sliders', label: 'Sliders', icon: <Layers className="w-4 h-4" /> },
  { id: 'containers', label: 'Containers', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'badges', label: 'Badges', icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'dialogs', label: 'Dialogs & Menus', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'progress', label: 'Progress & Status', icon: <Loader2 className="w-4 h-4" /> },
  { id: 'icons', label: 'Icons', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'harmonize', label: '⚠️ Harmonize', icon: <Bug className="w-4 h-4" /> },
];

// ============================================================================
// COLOR PALETTE - ACTUAL COLORS USED
// ============================================================================

function ColorSection() {
  // These are the actual modality colors from patient-card.tsx getModalityColor()
  const modalityColors = [
    { modality: 'CT', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50', hex: '#3B82F6' },
    { modality: 'MR', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50', hex: '#A855F7' },
    { modality: 'PT', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50', hex: '#EAB308' },
    { modality: 'RTSTRUCT', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50', hex: '#22C55E' },
    { modality: 'REG', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50', hex: '#F97316' },
  ];

  // Tool active state colors - from bottom-toolbar-prototype-v3.tsx
  const toolStateColors = [
    { name: 'Contour Edit', color: 'green', className: 'bg-green-600/20 text-green-300 border border-green-500/50' },
    { name: 'Boolean Ops', color: 'blue', className: 'bg-blue-600/20 text-blue-300 border border-blue-500/50' },
    { name: 'Margin Tool', color: 'purple', className: 'bg-purple-600/20 text-purple-300 border border-purple-500/50' },
    { name: 'History', color: 'orange', className: 'bg-orange-600/20 text-orange-400 border border-orange-500/50' },
    { name: 'Fusion', color: 'yellow', className: 'bg-yellow-600/20 text-yellow-300 border border-yellow-500/50' },
  ];

  // Background/surface colors actually used
  const surfaceColors = [
    { name: 'App Background', className: 'bg-black', code: 'bg-black' },
    { name: 'Panel Background', className: 'bg-gray-950/90', code: 'bg-gray-950/90' },
    { name: 'Card Background', className: 'bg-gray-900/80', code: 'bg-gray-900/80' },
    { name: 'Toolbar Glass', className: 'bg-white/10', code: 'bg-white/10 backdrop-blur-md' },
    { name: 'Hover State', className: 'bg-gray-800/50', code: 'bg-gray-800/50' },
    { name: 'Muted Background', className: 'bg-gray-900/50', code: 'bg-gray-900/50' },
  ];

  return (
    <div className="space-y-8">
      {/* Modality Colors */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Modality Colors</h3>
        <p className="text-xs text-gray-400 mb-4">From: patient-card.tsx getModalityColor()</p>
        <div className="grid grid-cols-5 gap-3">
          {modalityColors.map((item) => (
            <div key={item.modality} className={cn("p-4 rounded-lg border", item.bg, item.border)}>
              <span className={cn("text-lg font-bold", item.text)}>{item.modality}</span>
              <p className="text-[10px] text-gray-400 mt-2 font-mono">{item.hex}</p>
              <p className="text-[10px] text-gray-500 font-mono mt-1">{item.bg}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tool State Colors */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Tool Active States</h3>
        <p className="text-xs text-gray-400 mb-4">From: bottom-toolbar-prototype-v3.tsx, viewer-toolbar.tsx</p>
        <div className="flex flex-wrap gap-3">
          {toolStateColors.map((item) => (
            <div key={item.name} className={cn("px-4 py-2 rounded-lg shadow-sm", item.className)}>
              <span className="text-sm font-medium">{item.name}</span>
              <p className="text-[10px] opacity-70 font-mono mt-1">{item.className}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Surface Colors */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Surface/Background Colors</h3>
        <p className="text-xs text-gray-400 mb-4">Layered backgrounds used throughout the app</p>
        <div className="grid grid-cols-3 gap-3">
          {surfaceColors.map((item) => (
            <div key={item.name} className="border border-gray-700 rounded-lg overflow-hidden">
              <div className={cn("h-16", item.className)} />
              <div className="p-3 bg-gray-900/50">
                <p className="text-sm text-white font-medium">{item.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">{item.code}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Border Colors */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Border Colors</h3>
        <div className="flex flex-wrap gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-600/60 rounded-lg">
            <p className="text-sm text-white">Panel Border</p>
            <p className="text-[10px] text-gray-500 font-mono">border-gray-600/60</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-700/50 rounded-lg">
            <p className="text-sm text-white">Card Border</p>
            <p className="text-[10px] text-gray-500 font-mono">border-gray-700/50</p>
          </div>
          <div className="p-4 bg-white/10 border border-white/40 rounded-lg">
            <p className="text-sm text-white">Toolbar Border</p>
            <p className="text-[10px] text-gray-500 font-mono">border-white/40</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-sm text-white">Subtle Border</p>
            <p className="text-[10px] text-gray-500 font-mono">border-gray-800</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TYPOGRAPHY - ACTUAL TEXT STYLES USED
// ============================================================================

function TypographySection() {
  return (
    <div className="space-y-8">
      {/* Heading Styles Actually Used */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Heading Patterns</h3>
        <div className="space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <div className="pb-4 border-b border-gray-700">
            <span className="text-xl font-semibold text-white">Panel Header (text-xl font-semibold)</span>
            <p className="text-xs text-purple-300 mt-1">Used in: series-selector.tsx panel headers</p>
          </div>
          <div className="pb-4 border-b border-gray-700">
            <span className="text-lg font-semibold text-white">Section Header (text-lg font-semibold)</span>
            <p className="text-xs text-purple-300 mt-1">Used in: accordion headers, dialog titles</p>
          </div>
          <div className="pb-4 border-b border-gray-700">
            <span className="text-sm font-semibold text-white">Card Title (text-sm font-semibold)</span>
            <p className="text-xs text-purple-300 mt-1">Used in: patient-card.tsx, sub-sections</p>
          </div>
          <div>
            <span className="text-xs font-medium text-white">Label (text-xs font-medium)</span>
            <p className="text-xs text-purple-300 mt-1">Used in: form labels, button text</p>
          </div>
        </div>
      </div>

      {/* Text Colors */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Text Colors</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <span className="text-white">Primary Text</span>
            <p className="text-[10px] text-gray-500 font-mono mt-1">text-white</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <span className="text-white/90">Toolbar Text</span>
            <p className="text-[10px] text-gray-500 font-mono mt-1">text-white/90</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <span className="text-gray-300">Secondary Text</span>
            <p className="text-[10px] text-gray-500 font-mono mt-1">text-gray-300</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <span className="text-gray-400">Description Text</span>
            <p className="text-[10px] text-gray-500 font-mono mt-1">text-gray-400</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <span className="text-gray-500">Muted Text</span>
            <p className="text-[10px] text-gray-500 font-mono mt-1">text-gray-500</p>
          </div>
        </div>
      </div>

      {/* Label Patterns */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Label Patterns</h3>
        <div className="flex flex-wrap gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">UPPERCASE LABEL</span>
            <p className="text-[10px] text-gray-500 font-mono mt-2">text-[10px] uppercase tracking-wide</p>
            <p className="text-[10px] text-purple-300 mt-1">Used in: slider labels, fusion controls</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <span className="text-[9px] text-gray-400 uppercase tracking-wide">OPACITY</span>
            <p className="text-[10px] text-gray-500 font-mono mt-2">text-[9px] uppercase tracking-wide</p>
            <p className="text-[10px] text-purple-300 mt-1">Used in: inline toolbar labels</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BUTTONS - ACTUAL BUTTON PATTERNS USED
// ============================================================================

function ButtonSection() {
  const [isContourActive, setIsContourActive] = useState(false);
  const [isBooleanActive, setIsBooleanActive] = useState(false);
  const [isMarginActive, setIsMarginActive] = useState(false);

  return (
    <div className="space-y-8">
      {/* Main Toolbar Buttons */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Toolbar Buttons (Glassmorphic)</h3>
        <p className="text-xs text-gray-400 mb-4">From: bottom-toolbar-prototype-v3.tsx, viewer-toolbar.tsx</p>
        
        {/* Actual toolbar container */}
        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-3 py-2 shadow-2xl inline-flex items-center gap-1">
          {/* Inactive button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-white/90 hover:bg-white/20 hover:text-white rounded-lg transition-all duration-200"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-white/90 hover:bg-white/20 hover:text-white rounded-lg transition-all duration-200"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-5 bg-white/30 mx-1" />
          
          {/* Active states with different colors */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-sm rounded-lg"
          >
            <Hand className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-white/90 hover:bg-white/20 hover:text-white rounded-lg transition-all duration-200"
          >
            <Crosshair className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-white/90 hover:bg-white/20 hover:text-white rounded-lg transition-all duration-200"
          >
            <Ruler className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mt-4 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <p className="text-xs text-gray-300 mb-2"><strong>Container:</strong></p>
          <code className="text-[10px] text-cyan-300 font-mono">bg-white/10 backdrop-blur-md border border-white/40 rounded-xl</code>
          <p className="text-xs text-gray-300 mt-3 mb-2"><strong>Inactive Button:</strong></p>
          <code className="text-[10px] text-cyan-300 font-mono">text-white/90 hover:bg-white/20 hover:text-white rounded-lg</code>
          <p className="text-xs text-gray-300 mt-3 mb-2"><strong>Active Button:</strong></p>
          <code className="text-[10px] text-cyan-300 font-mono">bg-[color]-600/20 text-[color]-400 border border-[color]-500/50 shadow-sm</code>
        </div>
      </div>

      {/* Tool Group Buttons with Labels */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Tool Group Buttons (With Text)</h3>
        <p className="text-xs text-gray-400 mb-4">From: bottom-toolbar-prototype-v3.tsx - Contour/Boolean/Margin group</p>
        
        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-2 py-2 shadow-2xl inline-flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsContourActive(!isContourActive)}
            className={cn(
              "h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2",
              isContourActive
                ? "bg-green-600/20 text-green-300 border border-green-500/50 shadow-sm"
                : "text-white/90 hover:bg-white/20 hover:text-white border border-transparent"
            )}
          >
            <Highlighter className="w-4 h-4" />
            <span className="text-xs font-medium">Contour</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsBooleanActive(!isBooleanActive)}
            className={cn(
              "h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2",
              isBooleanActive
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/50 shadow-sm"
                : "text-white/90 hover:bg-white/20 hover:text-white border border-transparent"
            )}
          >
            <SquareStack className="w-4 h-4" />
            <span className="text-xs font-medium">Boolean</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMarginActive(!isMarginActive)}
            className={cn(
              "h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2",
              isMarginActive
                ? "bg-purple-600/20 text-purple-300 border border-purple-500/50 shadow-sm"
                : "text-white/90 hover:bg-white/20 hover:text-white border border-transparent"
            )}
          >
            <Expand className="w-4 h-4" />
            <span className="text-xs font-medium">Margin</span>
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Click buttons to see active state toggle</p>
      </div>

      {/* Gradient Navigation Buttons */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Gradient Navigation Buttons</h3>
        <p className="text-xs text-gray-400 mb-4">From: patient-manager.tsx header</p>
        
        <div className="flex flex-wrap gap-3 p-4 bg-gray-950 rounded-lg">
          <Button 
            variant="outline" 
            className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-400/30 text-white font-medium shadow-lg hover:shadow-purple-400/20 transition-all duration-200"
          >
            <Beaker className="w-4 h-4 mr-2" />
            Prototypes
          </Button>
          <Button 
            variant="outline" 
            className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-400/30 text-white font-medium shadow-lg hover:shadow-cyan-400/20 transition-all duration-200"
          >
            <FlaskConical className="w-4 h-4 mr-2" />
            Experiments
          </Button>
          <Button 
            variant="outline" 
            className="bg-gradient-to-r from-pink-500/10 to-orange-500/10 hover:from-pink-500/20 hover:to-orange-500/20 border border-pink-400/30 text-white font-medium shadow-lg hover:shadow-pink-400/20 transition-all duration-200"
          >
            <Palette className="w-4 h-4 mr-2" />
            SuperStyle
          </Button>
        </div>
      </div>

      {/* Standard Buttons Actually Used */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Standard Buttons</h3>
        <p className="text-xs text-gray-400 mb-4">From: patient-manager.tsx, dialogs, forms</p>
        
        <div className="flex flex-wrap gap-3 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Button>Default Action</Button>
          <Button variant="outline" size="sm">Outline Small</Button>
          <Button variant="ghost" size="sm">Ghost</Button>
          <Button variant="destructive" size="sm">Delete</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Confirm</Button>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">Merge</Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Note: variant="default" uses yellow (primary), custom colors use direct className</p>
      </div>

      {/* Exit/Destructive Actions */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Exit/Cancel Buttons</h3>
        <p className="text-xs text-gray-400 mb-4">From: bottom-toolbar-prototype-v2.tsx</p>
        
        <div className="flex gap-3 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/40 hover:border-red-500/60 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Exit Split</span>
          </Button>
          <Button variant="outline" className="border-gray-600 text-gray-400 hover:bg-gray-800">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INPUTS & FORMS - ACTUAL PATTERNS
// ============================================================================

function InputSection() {
  const [switchOn, setSwitchOn] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div className="space-y-8">
      {/* Search Input */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Search Input</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx, prototype-module.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          {/* Actual search input from series-selector */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search structures..."
              className="w-full pl-10 pr-4 py-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-600/40 text-white placeholder-gray-400 rounded-lg transition-all duration-200 focus:outline-none focus:ring-0 focus:border-blue-500/60 focus:bg-gray-800/90 hover:border-gray-500/60"
            />
          </div>
          <p className="text-[10px] text-cyan-300 font-mono">
            bg-gray-900/80 backdrop-blur-sm border-gray-600/40 rounded-lg focus:border-blue-500/60
          </p>
        </div>
      </div>

      {/* Select Dropdown */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Select Dropdown</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx, margin-operations-prototype.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <div className="max-w-xs">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select structure..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ctv">CTV</SelectItem>
                <SelectItem value="gtv">GTV</SelectItem>
                <SelectItem value="body">BODY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Native select (inconsistency) */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400">Inconsistency: Native select also used</span>
            </div>
            <select className="bg-gray-800/50 border-[0.5px] border-gray-600/50 text-gray-100 text-xs h-7 px-2 rounded-lg focus:outline-none focus:border-blue-500/60 min-w-[120px]">
              <option value="">Structure...</option>
              <option value="ctv">CTV</option>
              <option value="gtv">GTV</option>
            </select>
            <p className="text-[10px] text-gray-500 mt-2">From: margin-operations-prototype.tsx - should use Radix Select</p>
          </div>
        </div>
      </div>

      {/* Switch & Checkbox */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Switch & Checkbox</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx, user-settings-panel.tsx</p>
        
        <div className="flex flex-wrap gap-8 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <div className="flex items-center space-x-3">
            <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
            <Label className="text-sm text-gray-300">Show All Structures</Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox checked={checkboxChecked} onCheckedChange={(c) => setCheckboxChecked(c as boolean)} />
            <Label className="text-sm text-gray-300">Auto-load RT</Label>
          </div>
        </div>
      </div>

      {/* Accordion */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Accordion</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx - structure groups</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg max-w-md">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-gray-700">
              <AccordionTrigger className="text-white hover:text-gray-300">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-green-400" />
                  RT Structure Set
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 text-sm">
                Accordion content showing structures...
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-gray-700">
              <AccordionTrigger className="text-white hover:text-gray-300">Window/Level Controls</AccordionTrigger>
              <AccordionContent className="text-gray-400 text-sm">
                Slider controls here...
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SLIDERS - ACTUAL PATTERNS
// ============================================================================

function SliderSection() {
  const [sliderValue, setSliderValue] = useState([50]);
  const [opacityValue, setOpacityValue] = useState([75]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <p className="text-sm text-amber-300">Multiple slider implementations found - needs unification</p>
      </div>

      {/* Radix Slider - Primary */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Style 1: Radix Slider (shadcn/ui)</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx, fusion-control-panel-v2.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Window Width</span>
            <span className="text-[10px] font-semibold text-white bg-gray-800/50 px-2 py-0.5 rounded">{sliderValue[0] * 40}</span>
          </div>
          <Slider 
            value={sliderValue} 
            onValueChange={setSliderValue}
            max={100}
            step={1}
          />
          <p className="text-[10px] text-green-400">✓ Recommended - use this for new sliders</p>
        </div>
      </div>

      {/* Inline Toolbar Slider */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Style 2: Compact Inline Slider</h3>
        <p className="text-xs text-gray-400 mb-4">From: unified-fusion-layout-toolbar-v2.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-md border border-white/10 max-w-[220px]">
            <span className="text-[9px] text-gray-400 uppercase tracking-wide">Opacity</span>
            <Slider
              value={opacityValue}
              onValueChange={setOpacityValue}
              max={100}
              className="flex-1 [&>span:first-child]:h-1.5 [&>span:first-child]:bg-gray-700 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
            />
            <span className="text-[10px] font-medium min-w-[32px] text-center tabular-nums text-amber-300">
              {opacityValue[0]}%
            </span>
          </div>
          <p className="text-[10px] text-amber-400 mt-3 font-mono">
            Uses className overrides for compact height - consider standardizing
          </p>
        </div>
      </div>

      {/* Custom Range Input (Inconsistency) */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Style 3: Custom input[type="range"]
        </h3>
        <p className="text-xs text-gray-400 mb-4">From: unified-fusion-toolbar-prototype.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-amber-500/30 rounded-lg">
          <div className="max-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Opacity</span>
              <span className="text-[11px] font-semibold text-white bg-gray-800/60 px-2 py-0.5 rounded">
                {opacityValue[0]}%
              </span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                  style={{ width: `${opacityValue[0]}%` }}
                />
              </div>
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-yellow-400 shadow-lg pointer-events-none"
                style={{ left: `calc(${opacityValue[0]}% - 8px)` }}
              />
              <input
                type="range"
                min="0"
                max="100"
                value={opacityValue[0]}
                onChange={(e) => setOpacityValue([parseInt(e.target.value)])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>
          <p className="text-[10px] text-amber-400 mt-4">
            ⚠️ Custom implementation - should migrate to Radix Slider for consistency
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONTAINERS - ACTUAL PANEL & CARD PATTERNS
// ============================================================================

function ContainerSection() {
  return (
    <div className="space-y-8">
      {/* Glassmorphic Toolbar Container */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Glassmorphic Toolbar</h3>
        <p className="text-xs text-gray-400 mb-4">From: bottom-toolbar-prototype-v3.tsx, viewer-toolbar.tsx</p>
        
        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-4 py-3 shadow-2xl">
          <p className="text-white text-sm">Toolbar content here</p>
        </div>
        <code className="text-[10px] text-cyan-300 font-mono block mt-3">
          bg-white/10 backdrop-blur-md border border-white/40 rounded-xl shadow-2xl
        </code>
      </div>

      {/* Panel Container */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Panel Container (Series Selector)</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx</p>
        
        <Card className="bg-gray-950/90 backdrop-blur-xl border border-gray-600/60 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Panel Header</CardTitle>
            <CardDescription className="text-xs text-gray-400">Panel description text</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-300">Panel content...</p>
          </CardContent>
        </Card>
        <code className="text-[10px] text-cyan-300 font-mono block mt-3">
          bg-gray-950/90 backdrop-blur-xl border-gray-600/60 rounded-xl shadow-2xl shadow-black/50
        </code>
      </div>

      {/* Dark Backdrop Container */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Fusion Control Panel</h3>
        <p className="text-xs text-gray-400 mb-4">From: unified-fusion-toolbar-prototype.tsx</p>
        
        <div 
          className="backdrop-blur-md border rounded-xl px-3 py-2.5 shadow-lg"
          style={{ backgroundColor: '#1a1a1a95', borderColor: '#4a5568' }}
        >
          <p className="text-white text-sm">Fusion controls here</p>
        </div>
        <code className="text-[10px] text-cyan-300 font-mono block mt-3">
          backdrop-blur-md rounded-xl | backgroundColor: #1a1a1a95, borderColor: #4a5568
        </code>
      </div>

      {/* Subsection Container */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Subsection Container</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx subsections</p>
        
        <div className="px-4 py-2 space-y-1.5 border-t border-gray-800/50 bg-gray-900/30">
          <p className="text-sm text-white">Subsection content</p>
          <p className="text-xs text-gray-400">Description text</p>
        </div>
        <code className="text-[10px] text-cyan-300 font-mono block mt-3">
          border-t border-gray-800/50 bg-gray-900/30
        </code>
      </div>
    </div>
  );
}

// ============================================================================
// BADGES - ACTUAL PATTERNS
// ============================================================================

function BadgeSection() {
  return (
    <div className="space-y-8">
      {/* Modality Badges */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Modality Badges</h3>
        <p className="text-xs text-gray-400 mb-4">From: patient-card.tsx getModalityColor()</p>
        
        <div className="flex flex-wrap gap-3 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">CT</Badge>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">MR</Badge>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">PT</Badge>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">RTSTRUCT</Badge>
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">REG</Badge>
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">OTHER</Badge>
        </div>
      </div>

      {/* Patient Card Feature Badges */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Feature Badges</h3>
        <p className="text-xs text-gray-400 mb-4">From: patient-card.tsx</p>
        
        <div className="flex flex-wrap gap-3 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Badge variant="secondary" className="bg-green-900/20 text-green-400 border-green-600/50">
            <Activity className="h-3 w-3 mr-1" />
            RT Structures
          </Badge>
          <Badge variant="secondary" className="bg-orange-900/20 text-orange-400 border-orange-600/50">
            <GitMerge className="h-3 w-3 mr-1" />
            3 Associations
          </Badge>
          <Badge variant="secondary" className="bg-blue-900/20 text-blue-400 border-blue-600/50">
            <LinkIcon className="h-3 w-3 mr-1" />
            Co-registered
          </Badge>
          <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-500/10">
            Patient Tag
          </Badge>
        </div>
      </div>

      {/* Fusion Status Badges */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Fusion Status Badges</h3>
        <p className="text-xs text-gray-400 mb-4">From: working-viewer.tsx</p>
        
        <div className="flex flex-wrap gap-3 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Badge className="flex items-center gap-1 border backdrop-blur-sm bg-yellow-900/40 text-yellow-200 border-yellow-600/30">
            <div className="w-2 h-2 rounded-full animate-pulse bg-yellow-400" />
            PT Fusion
            <span className="text-yellow-300">(75%)</span>
          </Badge>
          <Badge className="flex items-center gap-1 border backdrop-blur-sm bg-purple-900/40 text-purple-200 border-purple-600/30">
            <div className="w-2 h-2 rounded-full animate-pulse bg-purple-400" />
            MR Fusion
            <span className="text-purple-300">(50%)</span>
          </Badge>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            FUSED
          </span>
        </div>
      </div>

      {/* Registration Status */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Registration Status</h3>
        <p className="text-xs text-gray-400 mb-4">From: patient-card.tsx</p>
        
        <div className="flex flex-wrap gap-3 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Badge variant="outline" className="text-orange-300 border-orange-500/50">
            Registered
          </Badge>
          <Badge variant="outline" className="text-blue-300 border-blue-500/50">
            Co-registered
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DIALOGS & MENUS - ACTUAL PATTERNS
// ============================================================================

function DialogsSection() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Dialog */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Dialog</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx, save-as-new-dialog.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Open Dialog</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Dialog Title</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Dialog description with the actual styling used in the app.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-gray-300">Dialog body content</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600 text-gray-400 hover:bg-gray-800">
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <code className="text-[10px] text-cyan-300 font-mono block mt-3">
          DialogContent: bg-gray-900/80 backdrop-blur-xl border-gray-700/50 shadow-2xl
        </code>
      </div>

      {/* Dropdown Menu */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Dropdown Menu</h3>
        <p className="text-xs text-gray-400 mb-4">From: viewer-toolbar.tsx, unified-fusion-layout-toolbar-v2.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-900/95 border-gray-700 backdrop-blur-md">
              <DropdownMenuLabel>Window Presets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                Soft Tissue
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Layers className="mr-2 h-4 w-4" />
                Bone
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Activity className="mr-2 h-4 w-4" />
                Lung
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Custom Tooltips */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Tooltips</h3>
        <p className="text-xs text-gray-400 mb-4">Two patterns: Radix Tooltip and custom inline tooltips</p>
        
        <div className="flex gap-8 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          {/* Radix Tooltip */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Radix Tooltip:</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/90 hover:bg-white/20 rounded-lg">
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zoom In</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Custom Inline Tooltip */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Custom inline tooltip:</p>
            <div className="relative group">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/90 hover:bg-white/20 rounded-lg">
                <Highlighter className="w-4 h-4" />
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-green-600/95 via-green-500/95 to-green-600/95 border border-green-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Edit Contours
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-amber-400 mt-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Custom tooltips use color-coded gradients matching tool function (green=contour, blue=boolean, etc.)
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// ICONS - ACTUAL USAGE
// ============================================================================

function IconSection() {
  const iconCategories = [
    {
      name: 'Viewer Tools',
      color: 'text-blue-400',
      icons: [
        { icon: ZoomIn, name: 'ZoomIn' },
        { icon: ZoomOut, name: 'ZoomOut' },
        { icon: Maximize2, name: 'Maximize2' },
        { icon: Hand, name: 'Hand (Pan)' },
        { icon: Ruler, name: 'Ruler (Measure)' },
        { icon: Crosshair, name: 'Crosshair' },
        { icon: Grid3x3, name: 'Grid3x3 (MPR)' },
        { icon: Target, name: 'Target (Localize)' },
      ]
    },
    {
      name: 'Contour/Structure Tools',
      color: 'text-green-400',
      icons: [
        { icon: Highlighter, name: 'Highlighter (Contour)' },
        { icon: SquareStack, name: 'SquareStack (Boolean)' },
        { icon: Expand, name: 'Expand (Margin)' },
        { icon: Brain, name: 'Brain (RT Struct)' },
        { icon: Eye, name: 'Eye (Visible)' },
        { icon: EyeOff, name: 'EyeOff (Hidden)' },
      ]
    },
    {
      name: 'Fusion/Layers',
      color: 'text-purple-400',
      icons: [
        { icon: Layers, name: 'Layers (Fusion)' },
        { icon: Layers3, name: 'Layers3' },
        { icon: SplitSquareHorizontal, name: 'SplitSquareHorizontal' },
      ]
    },
    {
      name: 'History/Actions',
      color: 'text-orange-400',
      icons: [
        { icon: Undo, name: 'Undo' },
        { icon: Redo, name: 'Redo' },
        { icon: History, name: 'History' },
        { icon: Save, name: 'Save' },
        { icon: Trash2, name: 'Trash2' },
      ]
    },
    {
      name: 'Status',
      color: 'text-gray-400',
      icons: [
        { icon: Loader2, name: 'Loader2 (animate-spin)' },
        { icon: AlertTriangle, name: 'AlertTriangle (Warning)' },
        { icon: AlertCircle, name: 'AlertCircle (Error)' },
        { icon: CheckCircle, name: 'CheckCircle (Success)' },
        { icon: Info, name: 'Info' },
      ]
    },
    {
      name: 'Navigation',
      color: 'text-cyan-400',
      icons: [
        { icon: ArrowLeft, name: 'ArrowLeft' },
        { icon: ArrowRight, name: 'ArrowRight' },
        { icon: ChevronDown, name: 'ChevronDown' },
        { icon: ChevronRight, name: 'ChevronRight' },
        { icon: ExternalLink, name: 'ExternalLink' },
      ]
    },
    {
      name: 'Data/Relationships',
      color: 'text-indigo-400',
      icons: [
        { icon: LinkIcon, name: 'Link (Co-registered)' },
        { icon: GitMerge, name: 'GitMerge (Associations)' },
        { icon: GitBranch, name: 'GitBranch (REG)' },
        { icon: Network, name: 'Network (PACS)' },
        { icon: FolderTree, name: 'FolderTree' },
      ]
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Icons by Category (Lucide React)</h3>
        <p className="text-sm text-gray-400 mb-6">Standard size: w-4 h-4 for toolbar buttons</p>
        
        {iconCategories.map((category) => (
          <div key={category.name} className="mb-6">
            <h4 className={cn("text-sm font-semibold mb-3", category.color)}>{category.name}</h4>
            <div className="flex flex-wrap gap-2 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
              {category.icons.map((item) => (
                <TooltipProvider key={item.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors min-w-[60px]">
                        <item.icon className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-500 text-center">{item.name.split(' ')[0]}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs">&lt;{item.name.split(' ')[0]} /&gt;</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Icon Sizes */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Icon Sizes Used</h3>
        <div className="flex items-end gap-6 p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Settings className="w-3 h-3 text-gray-300" />
            <span className="text-[10px] text-gray-500">w-3 h-3</span>
            <span className="text-[9px] text-purple-300">badges</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-gray-300" />
            <span className="text-[10px] text-gray-500">w-3.5 h-3.5</span>
            <span className="text-[9px] text-purple-300">small btns</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Settings className="w-4 h-4 text-gray-300" />
            <span className="text-[10px] text-gray-500">w-4 h-4</span>
            <span className="text-[9px] text-green-300">default</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Settings className="w-5 h-5 text-gray-300" />
            <span className="text-[10px] text-gray-500">w-5 h-5</span>
            <span className="text-[9px] text-purple-300">panels</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROGRESS & STATUS - ACTUAL PATTERNS
// ============================================================================

function ProgressSection() {
  const [progressValue, setProgressValue] = useState(65);

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Progress Bar</h3>
        <p className="text-xs text-gray-400 mb-4">From: loading-progress.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Loading Series...</span>
              <span className="text-gray-400 font-mono">{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-1.5 bg-gray-700/50" />
          </div>
          
          <div className="flex gap-3">
            <Button size="sm" variant="outline" onClick={() => setProgressValue(Math.max(0, progressValue - 10))}>-10%</Button>
            <Button size="sm" variant="outline" onClick={() => setProgressValue(Math.min(100, progressValue + 10))}>+10%</Button>
          </div>
        </div>
      </div>

      {/* Loading States */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Loading States</h3>
        <p className="text-xs text-gray-400 mb-4">From: loading-progress.tsx, ai-status-panel.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-sm text-white">Loading images...</span>
          </div>
          <div className="flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
            <span className="text-sm text-gray-300">Refreshing...</span>
          </div>
          <code className="text-[10px] text-cyan-300 font-mono block">
            Loader2/RefreshCw with animate-spin class
          </code>
        </div>
      </div>

      {/* Status Indicators */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Status Indicators</h3>
        <p className="text-xs text-gray-400 mb-4">From: ai-status-panel.tsx, loading-progress.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-md bg-gray-800/50">
              <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-white">Service Available</div>
                <div className="text-xs text-gray-400">Connected successfully</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-gray-800/50">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-white">Service Offline</div>
                <div className="text-xs text-gray-400">Connection failed</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-gray-800/50">
              <Loader2 className="h-4 w-4 text-gray-400 animate-spin mt-0.5" />
              <div>
                <div className="font-medium text-sm text-white">Checking...</div>
                <div className="text-xs text-gray-400">Verifying connection</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Popover (AI Status Panel Pattern) */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Popover Panel</h3>
        <p className="text-xs text-gray-400 mb-4">From: ai-status-panel.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-white/90 hover:text-cyan-400 hover:bg-cyan-600/20 hover:border-cyan-500/50 border border-transparent rounded-lg transition-all duration-200"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs font-medium">AI Services</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-gray-900 border-gray-700 text-white">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">AI Service Status</h3>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-2 rounded-md bg-gray-800/50">
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">SegVol</div>
                      <div className="text-xs text-gray-400">Device: CUDA</div>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <code className="text-[10px] text-cyan-300 font-mono block mt-4">
            PopoverContent: bg-gray-900 border-gray-700 text-white
          </code>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Tabs</h3>
        <p className="text-xs text-gray-400 mb-4">From: margin-operation-panel.tsx, fusion-debug-dialog.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg max-w-lg">
          <Tabs defaultValue="uniform" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-black/30">
              <TabsTrigger value="uniform" className="data-[state=active]:bg-blue-500/30">
                <Expand className="w-4 h-4 mr-2" />
                Uniform
              </TabsTrigger>
              <TabsTrigger value="anisotropic" className="data-[state=active]:bg-green-500/30">
                <Box className="w-4 h-4 mr-2" />
                Aniso
              </TabsTrigger>
              <TabsTrigger value="directional" className="data-[state=active]:bg-purple-500/30">
                <Move className="w-4 h-4 mr-2" />
                Direction
              </TabsTrigger>
            </TabsList>
            <TabsContent value="uniform" className="mt-4">
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-sm text-gray-300">Uniform margin content</p>
              </div>
            </TabsContent>
            <TabsContent value="anisotropic" className="mt-4">
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-sm text-gray-300">Anisotropic margin content</p>
              </div>
            </TabsContent>
            <TabsContent value="directional" className="mt-4">
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-sm text-gray-300">Directional margin content</p>
              </div>
            </TabsContent>
          </Tabs>
          <code className="text-[10px] text-cyan-300 font-mono block mt-4">
            TabsList: bg-black/30 | TabsTrigger: data-[state=active]:bg-[color]-500/30
          </code>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HARMONIZATION NOTES
// ============================================================================

function HarmonizeSection() {
  const issues = [
    {
      category: 'Sliders',
      severity: 'high',
      issue: 'Multiple slider implementations',
      locations: ['unified-fusion-toolbar-prototype.tsx (custom)', 'series-selector.tsx (Radix)'],
      recommendation: 'Migrate all custom input[type="range"] to Radix Slider component',
    },
    {
      category: 'Select Dropdowns',
      severity: 'high',
      issue: 'Mix of native select and Radix Select',
      locations: ['margin-operations-prototype.tsx (native)', 'series-selector.tsx (Radix)'],
      recommendation: 'Use Radix Select everywhere for consistent styling and accessibility',
    },
    {
      category: 'Tooltips',
      severity: 'medium',
      issue: 'Two tooltip implementations',
      locations: ['bottom-toolbar-prototype-v3.tsx (custom gradient)', 'margin-operation-panel.tsx (Radix)'],
      recommendation: 'Standardize on Radix Tooltip, extend styling for color variants',
    },
    {
      category: 'Button Active States',
      severity: 'low',
      issue: 'Inconsistent active state colors',
      locations: ['Different tools use different color schemes'],
      recommendation: 'Document standard color per tool type (green=contour, blue=boolean, etc.)',
    },
    {
      category: 'Border Colors',
      severity: 'low',
      issue: 'Multiple gray border variations',
      locations: ['border-gray-600/60, border-gray-700/50, border-gray-800'],
      recommendation: 'Define 3 standard border levels in design tokens',
    },
    {
      category: 'Text Sizes',
      severity: 'low',
      issue: 'Many custom text sizes used',
      locations: ['text-[9px], text-[10px], text-[11px] scattered throughout'],
      recommendation: 'Define standard small text tokens: xs, xxs, micro',
    },
    {
      category: 'Panel Backgrounds',
      severity: 'medium',
      issue: 'Inconsistent panel background opacity',
      locations: ['bg-gray-900/80, bg-gray-950/90, bg-gray-900/50'],
      recommendation: 'Define 3 standard panel levels with consistent opacity',
    },
    {
      category: 'Color Pickers',
      severity: 'low',
      issue: 'Custom color picker implementation',
      locations: ['boolean-pipeline-prototype-v5.tsx'],
      recommendation: 'Create reusable ColorPicker component',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-amber-300">UI Harmonization Notes</h3>
        </div>
        <p className="text-sm text-amber-200/80">
          Issues identified during codebase audit that should be addressed for consistent UI.
        </p>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        {issues.map((item, idx) => (
          <div 
            key={idx}
            className={cn(
              "p-4 rounded-lg border",
              item.severity === 'high' ? 'bg-red-500/10 border-red-500/30' :
              item.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/30' :
              'bg-blue-500/10 border-blue-500/30'
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge className={cn(
                  "text-xs",
                  item.severity === 'high' ? 'bg-red-500/20 text-red-300 border-red-500/50' :
                  item.severity === 'medium' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' :
                  'bg-blue-500/20 text-blue-300 border-blue-500/50'
                )}>
                  {item.severity.toUpperCase()}
                </Badge>
                <span className="text-sm font-semibold text-white">{item.category}</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-300 mb-3">{item.issue}</p>
            
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Found in:</p>
              <div className="flex flex-wrap gap-1">
                {item.locations.map((loc, i) => (
                  <span key={i} className="text-[10px] bg-gray-800/50 text-gray-400 px-2 py-0.5 rounded font-mono">
                    {loc}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex items-start gap-2 pt-2 border-t border-white/10">
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-300">{item.recommendation}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Elements Found */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Additional Patterns Found</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Boolean Operator Buttons</h4>
            <p className="text-xs text-gray-400 mb-3">From: boolean-pipeline-prototype-v5.tsx</p>
            <div className="flex flex-wrap gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 bg-green-900/30 border-2 border-green-400/60 text-green-200 hover:bg-green-800/40 text-xs">
                <span className="mr-1">∪</span>
                Union
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 bg-blue-900/30 border-2 border-blue-400/60 text-blue-200 hover:bg-blue-800/40 text-xs">
                <span className="mr-1">∩</span>
                Intersect
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 bg-red-900/30 border-2 border-red-400/60 text-red-200 hover:bg-red-800/40 text-xs">
                <span className="mr-1">−</span>
                Subtract
              </Button>
            </div>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Template Library Button</h4>
            <p className="text-xs text-gray-400 mb-3">From: boolean-pipeline-prototype-v5.tsx</p>
            <Button variant="outline" size="sm" className="h-7 px-2 bg-purple-900/30 border-2 border-purple-400/60 text-purple-200 hover:bg-purple-800/40 text-xs">
              <Library className="w-3.5 h-3.5 mr-1" />
              Library
            </Button>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Expandable Section Toggle</h4>
            <p className="text-xs text-gray-400 mb-3">From: user-settings-panel.tsx, SuperstructureManager.tsx</p>
            <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 overflow-hidden max-w-xs">
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium text-gray-200">Display Preferences</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">User Avatar Circle</h4>
            <p className="text-xs text-gray-400 mb-3">From: user-settings-panel.tsx</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Demo User</p>
                <p className="text-xs text-gray-400">User Settings</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Proposed Design Tokens */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Proposed Design Token Categories</h3>
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
          <p className="text-sm text-indigo-200 mb-4">
            To enable automatic style updates throughout the app, consider implementing these as CSS variables:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-gray-900/50 rounded">
              <p className="text-indigo-300 font-medium">--color-surface-*</p>
              <p className="text-gray-400">Panel backgrounds</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded">
              <p className="text-indigo-300 font-medium">--color-border-*</p>
              <p className="text-gray-400">Border colors</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded">
              <p className="text-indigo-300 font-medium">--color-tool-*</p>
              <p className="text-gray-400">Tool active states</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded">
              <p className="text-indigo-300 font-medium">--color-modality-*</p>
              <p className="text-gray-400">CT, MR, PT colors</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded">
              <p className="text-indigo-300 font-medium">--radius-*</p>
              <p className="text-gray-400">Border radii</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded">
              <p className="text-indigo-300 font-medium">--space-*</p>
              <p className="text-gray-400">Spacing scale</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SuperStyle() {
  const [activeSection, setActiveSection] = useState<Section>('colors');

  const renderSection = () => {
    switch (activeSection) {
      case 'colors': return <ColorSection />;
      case 'typography': return <TypographySection />;
      case 'buttons': return <ButtonSection />;
      case 'inputs': return <InputSection />;
      case 'sliders': return <SliderSection />;
      case 'containers': return <ContainerSection />;
      case 'badges': return <BadgeSection />;
      case 'dialogs': return <DialogsSection />;
      case 'progress': return <ProgressSection />;
      case 'icons': return <IconSection />;
      case 'harmonize': return <HarmonizeSection />;
      default: return null;
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-8">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
            </Link>
            
            <div className="h-5 w-px bg-gray-700" />
            
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-pink-500/20 to-orange-500/20 border border-pink-400/30 rounded-lg">
                <Palette className="w-4 h-4 text-pink-400" />
              </div>
              <h1 className="text-sm font-bold text-white">SuperStyle</h1>
              <span className="text-[10px] text-gray-500 bg-gray-800/50 border border-gray-700/50 px-1.5 py-0.5 rounded">
                Converge Style Guide
              </span>
            </div>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex items-center gap-1.5 px-6 py-2 bg-gray-900/50 overflow-x-auto">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                    : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent"
                )}
              >
                {section.icon}
                {section.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
