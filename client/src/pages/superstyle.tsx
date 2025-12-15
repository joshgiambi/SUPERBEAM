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

type Section = 'colors' | 'typography' | 'buttons' | 'inputs' | 'sliders' | 'containers' | 'badges' | 'dialogs' | 'progress' | 'utilities' | 'icons' | 'aurora' | 'harmonize';

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
  { id: 'utilities', label: 'Utilities', icon: <Layers3 className="w-4 h-4" /> },
  { id: 'icons', label: 'Icons', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'aurora', label: '✨ Aurora V4', icon: <Sparkles className="w-4 h-4" /> },
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

      {/* Gradient Colors for Tooltips & Accents */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Gradient Tooltip Colors</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx, working-viewer.tsx (custom tooltips)</p>
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg overflow-hidden">
            <div className="h-12 bg-gradient-to-br from-green-600/95 via-green-500/95 to-green-600/95 border border-green-400/30 flex items-center justify-center">
              <span className="text-xs text-white font-medium">Fusion Active</span>
            </div>
            <div className="p-2 bg-gray-900/50">
              <p className="text-[10px] text-gray-500 font-mono">from-green-600/95 via-green-500/95</p>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden">
            <div className="h-12 bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 flex items-center justify-center">
              <span className="text-xs text-white font-medium">Series Info</span>
            </div>
            <div className="p-2 bg-gray-900/50">
              <p className="text-[10px] text-gray-500 font-mono">from-blue-600/95 via-blue-500/95</p>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden">
            <div className="h-12 bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 flex items-center justify-center">
              <span className="text-xs text-white font-medium">View Mode</span>
            </div>
            <div className="p-2 bg-gray-900/50">
              <p className="text-[10px] text-gray-500 font-mono">from-purple-600/95 via-purple-500/95</p>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden">
            <div className="h-12 bg-gray-800/95 border border-gray-600/50 flex items-center justify-center">
              <span className="text-xs text-white font-medium">Standard</span>
            </div>
            <div className="p-2 bg-gray-900/50">
              <p className="text-[10px] text-gray-500 font-mono">bg-gray-800/95 (Radix default)</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Inconsistency: Custom gradient tooltips vs standard Radix tooltips
        </p>
      </div>

      {/* Viewport Mode Colors */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Viewport Mode Colors</h3>
        <p className="text-xs text-gray-400 mb-4">From: unified-viewport-switcher.tsx</p>
        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-500/50 shadow-indigo-500/20">
            <span className="text-sm font-medium">Single View</span>
            <p className="text-[10px] opacity-70 font-mono">indigo-500</p>
          </div>
          <div className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-500/50 shadow-purple-500/20">
            <span className="text-sm font-medium">Fusion Overlay</span>
            <p className="text-[10px] opacity-70 font-mono">purple-500</p>
          </div>
          <div className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-500/50 shadow-cyan-500/20">
            <span className="text-sm font-medium">Compare</span>
            <p className="text-[10px] opacity-70 font-mono">cyan-500</p>
          </div>
          <div className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/50 shadow-amber-500/20">
            <span className="text-sm font-medium">MPR View</span>
            <p className="text-[10px] opacity-70 font-mono">amber-500</p>
          </div>
        </div>
      </div>

      {/* Ring/Glow Effects */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Ring & Glow Effects</h3>
        <p className="text-xs text-gray-400 mb-4">From: viewport-pane-ohif.tsx, unified-fusion-toolbar-prototype.tsx, bottom-toolbar-prototype-v2.tsx</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Active Viewport Glow */}
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="w-full h-16 rounded-lg ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)] bg-gray-800/50 flex items-center justify-center mb-3">
              <span className="text-xs text-cyan-300">Active Viewport</span>
            </div>
            <p className="text-xs text-gray-400">ring-2 ring-cyan-400</p>
            <code className="text-[10px] text-cyan-300 font-mono block mt-1">shadow-[0_0_12px_rgba(34,211,238,0.2)]</code>
          </div>

          {/* Selected Series Glow */}
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="w-full h-16 rounded-lg ring-2 ring-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.2)] bg-gray-800/50 flex items-center justify-center mb-3">
              <span className="text-xs text-purple-300">Fusion Active</span>
            </div>
            <p className="text-xs text-gray-400">ring-2 ring-purple-400</p>
            <code className="text-[10px] text-purple-300 font-mono block mt-1">shadow-[0_0_12px_rgba(192,132,252,0.2)]</code>
          </div>

          {/* Selected Patient Glow */}
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="w-full h-16 rounded-2xl ring-2 ring-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.2)] bg-gray-800/50 flex items-center justify-center mb-3">
              <span className="text-xs text-cyan-300">Patient Selected</span>
            </div>
            <p className="text-xs text-gray-400">ring-2 ring-cyan-400</p>
            <code className="text-[10px] text-cyan-300 font-mono block mt-1">shadow-[0_0_25px_rgba(6,182,212,0.2)]</code>
          </div>

          {/* Tool Active Ring */}
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="w-12 h-12 mx-auto rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40 flex items-center justify-center mb-3">
              <Highlighter className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-400 text-center">Tool Active</p>
            <code className="text-[10px] text-emerald-300 font-mono block mt-1 text-center">ring-1 ring-emerald-500/40</code>
          </div>

          {/* Amber Tool Ring */}
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="w-12 h-12 mx-auto rounded-lg bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 flex items-center justify-center mb-3">
              <History className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-400 text-center">History Active</p>
            <code className="text-[10px] text-amber-300 font-mono block mt-1 text-center">ring-1 ring-amber-500/40</code>
          </div>

          {/* Drag Over State */}
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="w-full h-16 rounded-lg ring-2 ring-amber-400 bg-amber-500/5 shadow-[0_0_20px_rgba(251,191,36,0.2)] flex items-center justify-center mb-3">
              <span className="text-xs text-amber-300">Drag Over</span>
            </div>
            <p className="text-xs text-gray-400">ring-2 ring-amber-400</p>
            <code className="text-[10px] text-amber-300 font-mono block mt-1">shadow-[0_0_20px_rgba(251,191,36,0.2)]</code>
          </div>
        </div>
        <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Note: Custom shadow-[...] used heavily for glow effects - consider standardizing
        </p>
      </div>

      {/* Focus States */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Focus States</h3>
        <p className="text-xs text-gray-400 mb-4">From: patient-manager-v4-aurora-prototype.tsx, prototype-module.tsx</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-xs text-gray-400 mb-3">Aurora Focus Style</p>
            <Input 
              placeholder="Search patients..."
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            />
            <code className="text-[10px] text-cyan-300 font-mono block mt-2">
              focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20
            </code>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-xs text-gray-400 mb-3">Prototype Focus Style</p>
            <Input 
              placeholder="Search prototypes..."
              className="bg-gray-900/60 border border-gray-700/50 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
            />
            <code className="text-[10px] text-purple-300 font-mono block mt-2">
              focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20
            </code>
          </div>
        </div>
        <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Inconsistency: Focus color varies (cyan in Aurora, purple in Prototype, blue in standard inputs)
        </p>
      </div>

      {/* Transition Patterns */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Transition Patterns</h3>
        <p className="text-xs text-gray-400 mb-4">Common transition classes used throughout</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-sm text-white mb-1">transition-all</p>
            <p className="text-[10px] text-gray-500 font-mono">Most common</p>
            <p className="text-[10px] text-gray-400 mt-1">150+ uses</p>
          </div>
          <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-sm text-white mb-1">transition-colors</p>
            <p className="text-[10px] text-gray-500 font-mono">Color-only transitions</p>
            <p className="text-[10px] text-gray-400 mt-1">30+ uses</p>
          </div>
          <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-sm text-white mb-1">transition-opacity</p>
            <p className="text-[10px] text-gray-500 font-mono">Fade effects</p>
            <p className="text-[10px] text-gray-400 mt-1">20+ uses</p>
          </div>
          <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-sm text-white mb-1">duration-200</p>
            <p className="text-[10px] text-gray-500 font-mono">Standard duration</p>
            <p className="text-[10px] text-gray-400 mt-1">Common</p>
          </div>
          <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-sm text-white mb-1">duration-300</p>
            <p className="text-[10px] text-gray-500 font-mono">Longer animations</p>
            <p className="text-[10px] text-gray-400 mt-1">Common</p>
          </div>
          <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-sm text-white mb-1">duration-150</p>
            <p className="text-[10px] text-gray-500 font-mono">Quick micro-interactions</p>
            <p className="text-[10px] text-gray-400 mt-1">Used in toolbars</p>
          </div>
        </div>
      </div>

      {/* Hover State Patterns */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Hover State Patterns</h3>
        <p className="text-xs text-gray-400 mb-4">Common hover patterns from patient-manager-v4-aurora-prototype.tsx</p>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
            <span className="text-sm">Ghost Hover</span>
          </button>
          <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all">
            <span className="text-sm">Border Hover</span>
          </button>
          <button className="px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-all">
            <span className="text-sm">Accent Hover</span>
          </button>
        </div>
        <div className="mt-4 space-y-2 text-[10px] font-mono text-gray-400">
          <p>• hover:text-white hover:bg-white/10 (ghost buttons)</p>
          <p>• hover:bg-white/10 hover:border-white/20 (bordered buttons)</p>
          <p>• hover:bg-[color]/25 (colored accent buttons)</p>
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

      {/* Status Panel Pattern */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Status Panel (Popover)</h3>
        <p className="text-xs text-gray-400 mb-4">From: ai-status-panel.tsx - Used for service status, info panels</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-white/90 hover:text-cyan-400 hover:bg-cyan-600/20 border border-transparent hover:border-cyan-500/50 rounded-lg transition-all">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs font-medium">Status Panel</span>
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 shadow-2xl">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <h3 className="font-semibold text-sm text-white">Service Status</h3>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-800">
                    <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>

                {/* Status Items */}
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">Service A</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30">
                            Client
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Description of service</p>
                        <p className="text-xs text-gray-400 mt-1">Ready</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-4 w-4 mt-0.5 text-gray-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">Service B</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                            Server
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Description of service</p>
                        <p className="text-xs text-red-400 mt-1">Offline</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-cyan-400 hover:bg-cyan-500/10">
                        <Download className="h-3 w-3 mr-1" />
                        Load
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <div className="flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 mt-0.5 text-cyan-400 flex-shrink-0" />
                    <div className="text-xs text-cyan-300/90">
                      <p className="font-medium mb-1">Info heading:</p>
                      <p className="text-cyan-300/70">Helpful information goes here.</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <p className="text-[10px] text-gray-500 text-center">
                  Last updated: {new Date().toLocaleTimeString()}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <code className="text-[10px] text-cyan-300 font-mono block mt-3">
          PopoverContent: bg-gray-900/95 backdrop-blur-xl border-gray-700/50 shadow-2xl | Items: bg-gray-800/50 border-gray-700/30
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

      {/* Icon Usage Notes */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Icon Usage Notes</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-amber-300 mb-2">⚠️ Duplicate Usage</h4>
            <div className="space-y-2 text-xs text-gray-300">
              <p><strong>Scissors:</strong> Used for both "cut" and "subtract" operations</p>
              <p><strong>Activity:</strong> Used for both "AI predictions" and "statistics"</p>
              <p><strong>Layers:</strong> Used for both fusion controls and structure layers</p>
            </div>
          </div>
          
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-blue-300 mb-2">✓ Recommended Icons</h4>
            <div className="space-y-2 text-xs text-gray-300">
              <p><strong>Contour Edit:</strong> Highlighter (green theme)</p>
              <p><strong>Boolean Ops:</strong> SquareStack or GitMerge (blue theme)</p>
              <p><strong>Margin Tool:</strong> Expand (purple theme)</p>
              <p><strong>Fusion:</strong> Layers (yellow theme)</p>
            </div>
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
        <h3 className="text-lg font-semibold text-white mb-2">Popover Panel (Simple)</h3>
        <p className="text-xs text-gray-400 mb-4">From: ai-status-panel.tsx - Simplified version</p>
        
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
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <h3 className="font-semibold text-sm text-white">AI Services</h3>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-800">
                    <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">SAM</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30">
                            Client
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Models loaded (~200MB)</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">SuperSeg</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                            Server
                          </span>
                        </div>
                        <div className="text-xs text-red-400 mt-1">Service offline</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <code className="text-[10px] text-cyan-300 font-mono block mt-4">
            PopoverContent: bg-gray-900/95 backdrop-blur-xl border-gray-700/50 shadow-2xl
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
// UTILITIES - SEPARATOR, SCROLL AREA, SKELETON, ALERT DIALOG
// ============================================================================

function UtilitiesSection() {
  return (
    <div className="space-y-8">
      {/* Separator */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Separator</h3>
        <p className="text-xs text-gray-400 mb-4">From: 24+ files including viewer-toolbar.tsx, user-settings-panel.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-6">
          <div>
            <p className="text-sm text-gray-300 mb-3">Horizontal Separator (default)</p>
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Content above</p>
              <div className="h-[1px] w-full bg-gray-700/50" />
              <p className="text-xs text-gray-400">Content below</p>
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3">
              h-[1px] w-full bg-gray-700/50
            </code>
          </div>
          
          <div>
            <p className="text-sm text-gray-300 mb-3">Vertical Separator (toolbar divider)</p>
            <div className="flex items-center gap-4 h-10">
              <Button variant="ghost" size="sm">Button A</Button>
              <div className="h-5 w-px bg-gray-600" />
              <Button variant="ghost" size="sm">Button B</Button>
              <div className="h-5 w-px bg-gray-600" />
              <Button variant="ghost" size="sm">Button C</Button>
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3">
              h-5 w-px bg-gray-600
            </code>
          </div>

          <div>
            <p className="text-sm text-gray-300 mb-3">Gradient Divider (fusion-toolbar.tsx)</p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400">Section A</span>
              <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
              <span className="text-xs text-gray-400">Section B</span>
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3">
              w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent
            </code>
          </div>
        </div>
      </div>

      {/* Scroll Area */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">ScrollArea</h3>
        <p className="text-xs text-gray-400 mb-4">From: rt-structure-history-modal.tsx, smart-fusion-viewport-manager.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <div className="max-w-md">
            <div className="relative h-48 overflow-hidden rounded-lg border border-gray-700">
              <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent p-3">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-800/50 mb-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-sm text-gray-300">List item {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Uses Radix ScrollArea with custom scrollbar styling. Scrollbar thumb: bg-border</span>
            </div>
          </div>
          <code className="text-[10px] text-cyan-300 font-mono block">
            ScrollArea from @radix-ui/react-scroll-area with scrollbar-thin scrollbar-thumb-gray-600
          </code>
        </div>
      </div>

      {/* Skeleton Loading */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Skeleton / Loading Placeholder</h3>
        <p className="text-xs text-gray-400 mb-4">From: client/src/components/ui/skeleton.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-700/50 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-700/50 animate-pulse rounded w-3/4" />
                <div className="h-3 bg-gray-700/50 animate-pulse rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-700/50 animate-pulse rounded" />
              <div className="h-3 bg-gray-700/50 animate-pulse rounded w-5/6" />
              <div className="h-3 bg-gray-700/50 animate-pulse rounded w-4/6" />
            </div>
          </div>
          <code className="text-[10px] text-cyan-300 font-mono block">
            animate-pulse rounded-md bg-muted (or bg-gray-700/50)
          </code>
        </div>
      </div>

      {/* Alert Dialog */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">AlertDialog</h3>
        <p className="text-xs text-gray-400 mb-4">From: working-viewer.tsx (Fusion Debug, REG Details dialogs)</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <div className="max-w-lg">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-2xl">
              <h4 className="text-lg font-semibold text-white mb-2">Dialog Title</h4>
              <div className="space-y-3">
                <p className="text-sm text-gray-300">Dialog description or content area</p>
                <textarea
                  readOnly
                  placeholder="Content area (e.g., debug text)"
                  className="w-full h-24 p-2 text-xs bg-black/60 border border-gray-600 rounded-md text-gray-200 font-mono placeholder:text-gray-500"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" className="text-gray-300 border-gray-600">
                  Cancel
                </Button>
                <Button className="bg-white text-black hover:bg-gray-200">
                  Confirm
                </Button>
              </div>
            </div>
          </div>
          <code className="text-[10px] text-cyan-300 font-mono block">
            AlertDialogContent: max-w-2xl | AlertDialogFooter with Cancel + Action buttons
          </code>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>AlertDialog uses shadcn/ui defaults. Textarea inside: bg-black/60 border-gray-600</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ring/Focus States */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Ring & Focus States</h3>
        <p className="text-xs text-gray-400 mb-4">From: viewport-pane-ohif.tsx, AdvancedViewportLayout.tsx, bottom-toolbar-prototype-v2.tsx</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gray-800/50 ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)]">
              <p className="text-sm text-white mb-1">Active Viewport (CT)</p>
              <code className="text-[9px] text-cyan-300 font-mono">ring-2 ring-cyan-400 shadow-[0_0_12px_...]</code>
            </div>
            <div className="p-4 rounded-lg bg-gray-800/50 ring-2 ring-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.2)]">
              <p className="text-sm text-white mb-1">Active Viewport (MR)</p>
              <code className="text-[9px] text-purple-300 font-mono">ring-2 ring-purple-400 shadow-[0_0_12px_...]</code>
            </div>
            <div className="p-4 rounded-lg bg-gray-800/50 ring-2 ring-indigo-500/70 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <p className="text-sm text-white mb-1">Selected Viewport</p>
              <code className="text-[9px] text-indigo-300 font-mono">ring-2 ring-indigo-500/70</code>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-300 mb-3">Tool State Rings</p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40">
                Brush Active
              </span>
              <span className="px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40">
                History Item
              </span>
              <span className="px-3 py-1.5 text-xs rounded-lg bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40">
                Pan Tool
              </span>
              <span className="px-3 py-1.5 text-xs rounded-lg bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40">
                Boolean Mode
              </span>
              <span className="px-3 py-1.5 text-xs rounded-lg bg-red-500/15 text-red-300 ring-1 ring-red-500/30">
                Erase Mode
              </span>
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3">
              bg-[color]-500/20 text-[color]-300 ring-1 ring-[color]-500/40
            </code>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Inconsistency:</strong> Some components use ring-1, others use ring-2. 
                Active viewports use modality-specific colors (cyan for CT, purple for MR, yellow for PT).
                Recommend standardizing: ring-1 for subtle states, ring-2 for active/selected states.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animation Classes */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Animation Classes</h3>
        <p className="text-xs text-gray-400 mb-4">Common animation patterns throughout the app</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-gray-800/50 text-center">
              <div className="w-4 h-4 mx-auto mb-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-300">animate-spin</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-800/50 text-center">
              <div className="w-4 h-4 mx-auto mb-2 bg-amber-400 rounded-full animate-pulse" />
              <p className="text-xs text-gray-300">animate-pulse</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-800/50 text-center">
              <div className="w-4 h-4 mx-auto mb-2 bg-indigo-400 rounded-full animate-ping" />
              <p className="text-xs text-gray-300">animate-ping</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-800/50 text-center">
              <div className="w-4 h-4 mx-auto mb-2 bg-green-400 rounded-full animate-bounce" />
              <p className="text-xs text-gray-300">animate-bounce</p>
            </div>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p><strong>animate-spin:</strong> Loading spinners (Loader2, RefreshCw icons)</p>
            <p><strong>animate-pulse:</strong> Loading skeletons, status indicators</p>
            <p><strong>animate-ping:</strong> Active/processing state (less common)</p>
            <p><strong>animate-bounce:</strong> Rarely used</p>
          </div>
        </div>
      </div>

      {/* Accordion */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Accordion</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx, patient-manager.tsx (heavily used for collapsible sections)</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <Accordion type="single" collapsible defaultValue="section-1" className="w-full">
            <AccordionItem value="section-1" className="border-gray-800/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-800/30 backdrop-blur-sm">
                <div className="flex items-center text-gray-100 font-medium text-sm">
                  <Layers3 className="w-4 h-4 mr-2.5 text-blue-400" />
                  Series Section
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 text-sm text-gray-300">
                  <p>This is the expanded content of the accordion.</p>
                  <p>Used for Series panel, Structures panel, Window/Level controls.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="section-2" className="border-gray-800/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-800/30 backdrop-blur-sm">
                <div className="flex items-center text-gray-100 font-medium text-sm">
                  <Palette className="w-4 h-4 mr-2.5 text-green-400" />
                  Structures Section
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 text-sm text-gray-300">
                  <p>Structure content goes here.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="section-3" className="border-gray-800/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5">
                <div className="flex items-center gap-2 text-gray-200 font-medium text-sm">
                  <Settings className="w-4 h-4 text-orange-400" />
                  <span>Window/Level</span>
                  <span className="text-xs text-gray-500 font-normal ml-auto">400/40</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <div className="text-sm text-gray-300">
                  Window/Level controls with value display in trigger.
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          <code className="text-[10px] text-cyan-300 font-mono block">
            AccordionItem: border-gray-800/50 | AccordionTrigger: hover:bg-gray-800/30 backdrop-blur-sm
          </code>
          
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <div className="flex items-start gap-2 text-xs text-cyan-300">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Pattern:</strong> AccordionTrigger contains icon + label. For Window/Level, 
                includes current values in the trigger. Uses type="multiple" for Series/Structures, 
                type="single" collapsible for Window/Level.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible (Manual) */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Collapsible (Manual Pattern)</h3>
        <p className="text-xs text-gray-400 mb-4">From: series-selector.tsx (Other Series grouping uses manual toggle, not Radix Collapsible)</p>
        
        <div className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg space-y-4">
          <div className="bg-gray-900/70 border border-gray-700/50 rounded-lg overflow-hidden">
            <button 
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-200 hover:bg-gray-800/50 transition-colors"
              onClick={(e) => {
                const content = e.currentTarget.nextElementSibling;
                const icon = e.currentTarget.querySelector('svg');
                if (content && icon) {
                  content.classList.toggle('hidden');
                  icon.classList.toggle('rotate-90');
                }
              }}
            >
              <div className="flex items-center gap-2">
                <FolderTree className="w-3.5 h-3.5 text-gray-400" />
                <span>Other Series (5)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 transition-transform" />
            </button>
            <div className="hidden ml-3 space-y-1 pl-3 border-l-2 border-gray-700/40 pb-2">
              <div className="flex items-center gap-2 p-2 text-sm text-gray-300 hover:bg-gray-800/30 rounded-md">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span>Series Item 1</span>
              </div>
              <div className="flex items-center gap-2 p-2 text-sm text-gray-300 hover:bg-gray-800/30 rounded-md">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span>Series Item 2</span>
              </div>
            </div>
          </div>
          
          <code className="text-[10px] text-cyan-300 font-mono block">
            Manual toggle with useState. Uses border-l-2 border-gray-700/40 for indent line.
          </code>
          
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Inconsistency:</strong> Some collapsible sections use the Radix Accordion component, 
                others use manual state toggle. Recommend standardizing on Accordion for all collapsible panels.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AURORA V4 DESIGN SYSTEM
// ============================================================================

function AuroraSection() {
  const [activeOperation, setActiveOperation] = useState<'union' | 'subtract' | 'intersect'>('union');
  const [activeTool, setActiveTool] = useState('pan');
  const [isContourActive, setIsContourActive] = useState(false);
  const [isBooleanActive, setIsBooleanActive] = useState(false);
  const [isMarginActive, setIsMarginActive] = useState(false);
  const [brushSize, setBrushSize] = useState([25]);
  const [marginMm, setMarginMm] = useState([5]);

  // Demo structure colors
  const structureColors = [
    { name: 'GTV', color: [255, 100, 100] },
    { name: 'CTV', color: [255, 180, 80] },
    { name: 'PTV', color: [80, 180, 255] },
    { name: 'Brainstem', color: [180, 100, 255] },
  ];

  const [selectedStructure, setSelectedStructure] = useState(structureColors[0]);
  const accentRgb = `rgb(${selectedStructure.color.join(',')})`;

  // Operation accent colors
  const getOperationAccent = () => {
    switch (activeOperation) {
      case 'union': return { rgb: 'rgb(34, 197, 94)', hue: 142, name: 'Green' };
      case 'subtract': return { rgb: 'rgb(239, 68, 68)', hue: 0, name: 'Red' };
      case 'intersect': return { rgb: 'rgb(168, 85, 247)', hue: 270, name: 'Purple' };
    }
  };

  const operationAccent = getOperationAccent();

  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/30 rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-gradient-to-br from-purple-500/30 to-cyan-500/30 rounded-lg">
            <Sparkles className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Aurora V4 Design System</h3>
            <p className="text-xs text-gray-400">Unified design language for Converge toolbars and panels</p>
          </div>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          Aurora V4 introduces a cohesive design language featuring <strong>adaptive color theming</strong>, 
          <strong> two-row compact layouts</strong>, <strong>inline settings</strong> (no floating panels), 
          and <strong>drag-to-reposition</strong> with localStorage memory. Used in Contour Toolbar, 
          Boolean Panel, Margin Panel, and Bottom Toolbar prototypes.
        </p>
      </div>

      {/* Key Design Principles */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Key Design Principles</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accentRgb}20` }}>
                <Palette className="w-4 h-4" style={{ color: accentRgb }} />
              </div>
              <h4 className="text-sm font-medium text-white">Adaptive Color Theming</h4>
            </div>
            <p className="text-xs text-gray-400">
              Panel backgrounds and accents dynamically adjust based on the selected structure's color or operation type.
              Uses HSL hue extraction for consistent theming.
            </p>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
                <Sliders className="w-4 h-4 text-gray-300" />
              </div>
              <h4 className="text-sm font-medium text-white">Inline Settings</h4>
            </div>
            <p className="text-xs text-gray-400">
              Tool settings appear inline when a tool is selected, expanding/collapsing with smooth animations.
              No separate floating panels needed.
            </p>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
                <Move className="w-4 h-4 text-gray-300" />
              </div>
              <h4 className="text-sm font-medium text-white">Draggable + Position Memory</h4>
            </div>
            <p className="text-xs text-gray-400">
              Panels can be dragged via a handle and positions are saved to localStorage.
              Includes reset position button.
            </p>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
                <LayoutGrid className="w-4 h-4 text-gray-300" />
              </div>
              <h4 className="text-sm font-medium text-white">Two-Row Compact Layout</h4>
            </div>
            <p className="text-xs text-gray-400">
              Row 1: Tool selection + inline settings. Row 2: Quick action buttons.
              Thin, efficient use of space.
            </p>
          </div>
        </div>
      </div>

      {/* Aurora Panel Container Style */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Aurora Panel Container</h3>
        <p className="text-xs text-gray-400 mb-4">From: contour-toolbar-v4-prototype.tsx, v4-aurora-panels-prototype.tsx</p>
        
        <div className="space-y-4">
          {/* Demo panel with structure selector */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-400">Select structure to see adaptive theming:</span>
            {structureColors.map((s) => (
              <button
                key={s.name}
                onClick={() => setSelectedStructure(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  selectedStructure.name === s.name
                    ? "ring-2 ring-white/50"
                    : "opacity-60 hover:opacity-100"
                )}
                style={{ 
                  backgroundColor: `rgba(${s.color.join(',')}, 0.2)`,
                  color: `rgb(${s.color.join(',')})`,
                }}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Aurora panel example */}
          <div 
            className="rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl max-w-2xl"
            style={{
              background: `linear-gradient(180deg, hsla(${selectedStructure.color[0] % 360}, 12%, 13%, 0.97) 0%, hsla(${selectedStructure.color[0] % 360}, 8%, 9%, 0.99) 100%)`,
              boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentRgb}20, 0 0 60px -15px ${accentRgb}20`,
            }}
          >
            {/* Row 1: Tools + Inline Settings */}
            <div className="flex items-center gap-3 px-3 py-2">
              {/* Drag Handle */}
              <div 
                className="flex items-center justify-center w-6 h-7 cursor-grab rounded transition-all hover:bg-white/5"
                style={{ color: `${accentRgb}50` }}
              >
                <Move className="w-4 h-4" />
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Structure indicator */}
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ 
                    backgroundColor: accentRgb,
                    boxShadow: `0 0 12px -2px ${accentRgb}60`,
                  }}
                />
                <span className="text-xs font-semibold text-white/90">{selectedStructure.name}</span>
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Tool buttons */}
              <div className="flex items-center gap-0.5">
                {[
                  { id: 'brush', icon: Highlighter, label: 'Brush' },
                  { id: 'pen', icon: Edit3, label: 'Pen' },
                  { id: 'erase', icon: Eraser, label: 'Erase' },
                ].map((tool) => {
                  const isActive = activeTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTool(tool.id)}
                      className={cn(
                        'h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium',
                        isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      )}
                      style={isActive ? {
                        background: `${accentRgb}20`,
                        boxShadow: `inset 0 0 0 1px ${accentRgb}30`,
                      } : {}}
                    >
                      <tool.icon className="w-3.5 h-3.5" style={isActive ? { color: accentRgb } : {}} />
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Inline Settings (for brush) */}
              {activeTool === 'brush' && (
                <div className="flex items-center gap-3">
                  <div className="w-px h-5 bg-white/10" />
                  <div className="flex items-center gap-2">
                    <Slider
                      value={brushSize}
                      onValueChange={setBrushSize}
                      max={100}
                      min={1}
                      className="w-20 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
                    />
                    <span className="text-xs font-semibold tabular-nums min-w-[38px]" style={{ color: accentRgb }}>
                      {(brushSize[0] * 0.1).toFixed(1)}cm
                    </span>
                  </div>
                </div>
              )}

              <div className="flex-1" />

              {/* Utilities */}
              <button className="h-7 w-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Row 2: Quick Actions */}
            <div 
              className="flex items-center gap-3 px-3 py-2"
              style={{ background: `hsla(${selectedStructure.color[0] % 360}, 6%, 8%, 1)` }}
            >
              {/* Undo/Redo */}
              <div className="flex items-center gap-0.5">
                <button className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                  <Undo className="w-3.5 h-3.5" />
                </button>
                <button className="h-7 w-7 flex items-center justify-center rounded-md text-gray-700 cursor-not-allowed transition-all">
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="w-px h-5 bg-white/10" />

              {/* Action buttons */}
              <button className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all">
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
              <button className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all">
                <GitBranch className="w-3 h-3" />
                Interp
              </button>
              <button className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all">
                <Sparkles className="w-3 h-3" />
                Smooth
              </button>
            </div>
          </div>

          <code className="text-[10px] text-cyan-300 font-mono block mt-3">
            background: linear-gradient(180deg, hsla([hue], 12%, 13%, 0.97) 0%, hsla([hue], 8%, 9%, 0.99) 100%)
            <br />
            boxShadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px [color]20, 0 0 60px -15px [color]20
          </code>
        </div>
      </div>

      {/* Operation-Based Theming */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Operation-Based Theming</h3>
        <p className="text-xs text-gray-400 mb-4">From: v4-aurora-panels-prototype.tsx - Boolean Panel</p>
        
        <div className="space-y-4">
          {/* Operation selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Operation:</span>
            {[
              { id: 'union', symbol: '∪', label: 'Union', color: 'rgb(34, 197, 94)' },
              { id: 'subtract', symbol: '−', label: 'Subtract', color: 'rgb(239, 68, 68)' },
              { id: 'intersect', symbol: '∩', label: 'Intersect', color: 'rgb(168, 85, 247)' },
            ].map((op) => (
              <button
                key={op.id}
                onClick={() => setActiveOperation(op.id as any)}
                className={cn(
                  "h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium",
                  activeOperation === op.id ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                )}
                style={activeOperation === op.id ? {
                  background: `${op.color}20`,
                  boxShadow: `inset 0 0 0 1px ${op.color}30`,
                } : {}}
              >
                <span style={activeOperation === op.id ? { color: op.color } : {}}>{op.symbol}</span>
                {op.label}
              </button>
            ))}
          </div>

          {/* Demo panel */}
          <div 
            className="rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl max-w-xl"
            style={{
              background: `linear-gradient(180deg, hsla(${operationAccent.hue}, 12%, 13%, 0.97) 0%, hsla(${operationAccent.hue}, 8%, 9%, 0.99) 100%)`,
              boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${operationAccent.rgb}20, 0 0 60px -15px ${operationAccent.rgb}20`,
            }}
          >
            {/* Header Row */}
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex items-center justify-center w-6 h-7 cursor-grab rounded transition-all hover:bg-white/5" style={{ color: `${operationAccent.rgb}50` }}>
                <Move className="w-4 h-4" />
              </div>
              <div className="w-px h-6 bg-white/10" />
              <Layers className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-white">Boolean</span>
              <div className="w-px h-6 bg-white/10" />
              
              {/* Operation symbol */}
              <span className="text-lg font-light" style={{ color: operationAccent.rgb }}>
                {activeOperation === 'union' ? '∪' : activeOperation === 'subtract' ? '−' : '∩'}
              </span>
              
              <span className="text-xs text-gray-500">
                {activeOperation === 'union' ? 'A + B' : activeOperation === 'subtract' ? 'A − B' : 'A ∩ B'}
              </span>
              
              <div className="flex-1" />

              {/* Execute button */}
              <button
                className="h-7 px-4 flex items-center gap-2 rounded-md text-xs font-semibold text-white transition-all"
                style={{
                  background: operationAccent.rgb,
                  boxShadow: `0 4px 15px -3px ${operationAccent.rgb}50`,
                }}
              >
                <Play className="w-3 h-3" />
                Run
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            The entire panel background and accent colors shift based on the selected operation type.
            This provides immediate visual feedback about the current mode.
          </p>
        </div>
      </div>

      {/* Main Bottom Toolbar Style */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Bottom Toolbar (Lighter Glass)</h3>
        <p className="text-xs text-gray-400 mb-4">From: v4-aurora-panels-prototype.tsx - Always-visible toolbar</p>
        
        <div className="p-6 bg-[#080810] border border-gray-800 rounded-xl relative overflow-hidden">
          <p className="text-center text-gray-600 text-sm mb-4">DICOM Viewport Area</p>
          
          {/* Gradient fade at bottom */}
          <div 
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-4 px-4"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(20, 24, 33, 0.7) 30%, rgba(20, 24, 33, 0.9) 100%)',
            }}
          >
            <div className="flex items-center gap-3">
              {/* Left Group */}
              <div 
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <button
                  onClick={() => setIsContourActive(!isContourActive)}
                  className={cn(
                    'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                    isContourActive 
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Highlighter className="w-4 h-4" />
                  <span>Contour</span>
                </button>
                <button
                  onClick={() => setIsBooleanActive(!isBooleanActive)}
                  className={cn(
                    'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                    isBooleanActive 
                      ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <SquareStack className="w-4 h-4" />
                  <span>Boolean</span>
                </button>
                <button
                  onClick={() => setIsMarginActive(!isMarginActive)}
                  className={cn(
                    'h-8 px-3 flex items-center gap-2 rounded-lg transition-all text-sm font-medium',
                    isMarginActive 
                      ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Expand className="w-4 h-4" />
                  <span>Margin</span>
                </button>
              </div>

              {/* Center Group */}
              <div 
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40">
                  <Hand className="w-4 h-4" />
                </button>
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                  <Crosshair className="w-4 h-4" />
                </button>
              </div>

              {/* Right Group */}
              <div 
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                  <Undo className="w-4 h-4" />
                </button>
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 cursor-not-allowed transition-all">
                  <Redo className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <code className="text-[10px] text-cyan-300 font-mono block mt-3">
          Container: rgba(255, 255, 255, 0.06) | border: rgba(255, 255, 255, 0.12)
          <br />
          Background gradient: transparent → rgba(20, 24, 33, 0.7) → rgba(20, 24, 33, 0.9)
        </code>
      </div>

      {/* Margin Panel Pattern */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Margin Panel Pattern</h3>
        <p className="text-xs text-gray-400 mb-4">From: v4-aurora-panels-prototype.tsx - Structure-colored theming</p>
        
        <div 
          className="rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl max-w-xl"
          style={{
            background: `linear-gradient(180deg, hsla(${selectedStructure.color[0] % 360}, 12%, 13%, 0.97) 0%, hsla(${selectedStructure.color[0] % 360}, 8%, 9%, 0.99) 100%)`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentRgb}20, 0 0 60px -15px ${accentRgb}20`,
          }}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center justify-center w-6 h-7 cursor-grab rounded" style={{ color: `${accentRgb}50` }}>
              <Move className="w-4 h-4" />
            </div>
            <div className="w-px h-6 bg-white/10" />
            <Expand className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-white">Margin</span>
            <div className="w-px h-6 bg-white/10" />
            
            <select className="h-7 bg-white/5 border border-white/10 text-white text-xs rounded-md px-2 min-w-[140px] focus:outline-none focus:border-white/30">
              <option value="">Select structure...</option>
              {structureColors.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>

            <div className="w-px h-6 bg-white/10" />

            {/* Direction Toggle */}
            <div className="flex items-center gap-0.5">
              <button className="h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium text-white bg-green-500/20" style={{ boxShadow: 'inset 0 0 0 1px rgba(34, 197, 94, 0.3)' }}>
                <Expand className="w-3.5 h-3.5 text-green-400" />
                Expand
              </button>
              <button className="h-7 px-2.5 flex items-center gap-1.5 rounded-md transition-all text-xs font-medium text-gray-500 hover:text-gray-300 hover:bg-white/5">
                <Box className="w-3.5 h-3.5" />
                Shrink
              </button>
            </div>

            <div className="flex-1" />
            <button className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 px-3 py-2" style={{ background: `hsla(${selectedStructure.color[0] % 360}, 6%, 8%, 1)` }}>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Margin</span>
            <Slider
              value={marginMm}
              onValueChange={setMarginMm}
              max={50}
              min={1}
              className="w-28 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/10 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
            />
            <span className="text-sm font-semibold tabular-nums min-w-[45px]" style={{ color: accentRgb }}>
              {marginMm[0]}<span className="text-xs font-normal text-gray-500 ml-0.5">mm</span>
            </span>

            <div className="w-px h-6 bg-white/10" />

            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Output</span>
            <button className="h-6 px-2 rounded text-[11px] font-medium bg-white/10 text-white">Same</button>
            <button className="h-6 px-2 rounded text-[11px] font-medium text-gray-500 hover:text-gray-300">New</button>

            <div className="flex-1" />

            <button
              className="h-7 px-4 flex items-center gap-2 rounded-md text-xs font-semibold text-white"
              style={{
                background: accentRgb,
                boxShadow: `0 4px 15px -3px ${accentRgb}50`,
              }}
            >
              <Play className="w-3 h-3" />
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Implementation Notes */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Implementation Notes</h3>
        <div className="space-y-3">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">useDraggable Hook</h4>
            <p className="text-xs text-gray-400 mb-2">Custom hook for drag-to-reposition with localStorage persistence.</p>
            <code className="text-[10px] text-cyan-300 font-mono block">
              const {'{'} position, isDragging, handleMouseDown, resetPosition {'}'} = useDraggable('storage-key', initialPos);
            </code>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Adaptive Color Computation</h4>
            <p className="text-xs text-gray-400 mb-2">Extract hue from RGB for consistent theming.</p>
            <code className="text-[10px] text-cyan-300 font-mono block">
              rgbToHsl(r, g, b) → [hue, saturation, lightness]
              <br />
              Used for: background gradients, shadows, accent colors
            </code>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">AnimatePresence for Inline Settings</h4>
            <p className="text-xs text-gray-400 mb-2">Framer Motion for smooth expand/collapse of tool settings.</p>
            <code className="text-[10px] text-cyan-300 font-mono block">
              &lt;AnimatePresence mode="wait"&gt;{'{'}renderInlineSettings(){'}'}&lt;/AnimatePresence&gt;
            </code>
          </div>
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
      locations: ['unified-fusion-toolbar-prototype.tsx (custom CSS)', 'advanced-margin-tool.tsx (Radix)', 'fusion-control-panel-v2.tsx (Radix)'],
      recommendation: 'Migrate all custom input[type="range"] to Radix Slider component with consistent styling',
    },
    {
      category: 'Select Dropdowns',
      severity: 'high',
      issue: 'Mix of native select and Radix Select',
      locations: ['margin-operations-prototype.tsx (native)', 'v4-aurora-panels-prototype.tsx (native)', 'advanced-margin-tool.tsx (Radix)'],
      recommendation: 'Use Radix Select everywhere for consistent styling and accessibility',
    },
    {
      category: 'Tooltips',
      severity: 'medium',
      issue: 'Three distinct tooltip implementations',
      locations: ['series-selector.tsx (gradient bg-gradient-to-br)', 'working-viewer.tsx (gradient)', 'tooltip.tsx (standard Radix)'],
      recommendation: 'Standardize on Radix Tooltip with color-coded variants for different modalities',
    },
    {
      category: 'Backdrop Blur Levels',
      severity: 'medium',
      issue: 'Inconsistent backdrop-blur intensities',
      locations: ['backdrop-blur-sm (10+ uses)', 'backdrop-blur-md (50+ uses)', 'backdrop-blur-xl (100+ uses)'],
      recommendation: 'Define 3 standard blur levels: subtle, medium, heavy for different UI layers',
    },
    {
      category: 'Loading Spinners',
      severity: 'medium',
      issue: 'Multiple spinner implementations',
      locations: ['working-viewer.tsx (border-2 border-gray-600 border-t-yellow-500)', 'flexible-fusion-layout.tsx (border-2 border-cyan-500)', 'loading-progress.tsx (Loader2 icon)'],
      recommendation: 'Create unified LoadingSpinner component with size and color variants',
    },
    {
      category: 'Shadow Levels',
      severity: 'low',
      issue: 'Inconsistent shadow usage',
      locations: ['shadow-lg (panels)', 'shadow-2xl (floating elements)', 'shadow-sm (buttons)'],
      recommendation: 'Document standard shadow levels: sm=buttons, lg=panels, 2xl=modals',
    },
    {
      category: 'Button Active States',
      severity: 'low',
      issue: 'Inconsistent active state colors',
      locations: ['green (contour), blue (boolean/pan), purple (margin), yellow (fusion), orange (history)'],
      recommendation: 'Document and standardize tool-to-color mapping in design tokens',
    },
    {
      category: 'Border Colors',
      severity: 'low',
      issue: 'Multiple gray border variations',
      locations: ['border-gray-600/60, border-gray-700/50, border-gray-800, border-white/10, border-white/20, border-white/40'],
      recommendation: 'Define 3 standard border levels in design tokens',
    },
    {
      category: 'Text Sizes',
      severity: 'low',
      issue: 'Many custom text sizes used',
      locations: ['text-[9px], text-[10px], text-[11px], text-[12px] scattered throughout'],
      recommendation: 'Define standard small text tokens: xs, xxs, micro in tailwind.config.ts',
    },
    {
      category: 'Panel Backgrounds',
      severity: 'medium',
      issue: 'Inconsistent panel background opacity',
      locations: ['bg-gray-900/80, bg-gray-950/90, bg-gray-900/50, bg-white/10, bg-black/40'],
      recommendation: 'Define 3 standard panel levels with consistent opacity',
    },
    {
      category: 'Color Pickers',
      severity: 'low',
      issue: 'Custom color picker with hover:scale patterns',
      locations: ['boolean-pipeline-prototype-v5.tsx (hover:scale-105)', 'contour-edit-toolbar.tsx (hover:scale-105)'],
      recommendation: 'Create reusable ColorPicker component with standardized interaction',
    },
    {
      category: 'Rounded Corners',
      severity: 'low',
      issue: 'Multiple border-radius values',
      locations: ['rounded-lg (most common)', 'rounded-xl (panels)', 'rounded-2xl (modals)', 'rounded-md (inputs)'],
      recommendation: 'Standardize: md=inputs, lg=buttons/cards, xl=panels, 2xl=modals',
    },
    {
      category: 'Glow Effects',
      severity: 'medium',
      issue: 'Custom shadow-[...] syntax for glows',
      locations: ['viewport-pane-ohif.tsx (shadow-[0_0_12px_...])', 'unified-fusion-toolbar-prototype.tsx (shadow-[0_0_8px_...])', 'patient-manager-v4-aurora-prototype.tsx (shadow-[0_0_25px_...])'],
      recommendation: 'Create CSS variables or Tailwind plugin for standardized glow effects: --glow-sm, --glow-md, --glow-lg',
    },
    {
      category: 'Focus Ring Colors',
      severity: 'medium',
      issue: 'Inconsistent focus ring colors across components',
      locations: ['patient-manager-v4-aurora (cyan focus)', 'prototype-module (purple focus)', 'inputs (blue focus)', 'superstyle (pink focus)'],
      recommendation: 'Standardize focus color to cyan for primary elements across the app',
    },
    {
      category: 'Transition Durations',
      severity: 'low',
      issue: 'Mixed transition durations',
      locations: ['duration-150 (quick)', 'duration-200 (standard)', 'duration-300 (slow)', 'no duration specified (defaults)'],
      recommendation: 'Define standard: 150ms=micro, 200ms=standard, 300ms=emphasis',
    },
    {
      category: 'Drop Shadows',
      severity: 'low',
      issue: 'Multiple drop-shadow implementations for readability',
      locations: ['viewport-overlay.tsx (drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)])', 'viewport-orientation-markers.tsx (varies by background)'],
      recommendation: 'Create unified text shadow utility for viewport overlays',
    },
    {
      category: 'Animation Entry Effects',
      severity: 'low',
      issue: 'Multiple slide-in animations used',
      locations: ['bottom-toolbar (slide-in-from-bottom-2)', 'patient-manager (slide-in-from-top-2)', 'viewer-interface (slide-in-from-right-2)'],
      recommendation: 'Document standard entry animations for different panel positions',
    },
    {
      category: 'Ring vs Border for Selection',
      severity: 'medium',
      issue: 'Inconsistent use of ring vs border for selection states',
      locations: ['viewports use ring-2', 'cards use border-2', 'tool buttons use ring-1'],
      recommendation: 'Standardize: ring for focus/selection states, border for structural dividers',
    },
    {
      category: 'Tooltip Gradient Backgrounds',
      severity: 'medium',
      issue: 'Custom gradient tooltips for modality-specific contexts',
      locations: ['series-selector.tsx (green for fusion, purple for MR, yellow for PT)', 'working-viewer.tsx (gradient tooltips)'],
      recommendation: 'Create TooltipContent variants: default, fusion (green), ct (cyan), mr (purple), pt (yellow)',
    },
    {
      category: 'Accordion vs Manual Collapsible',
      severity: 'medium',
      issue: 'Mix of Radix Accordion and manual state toggle for collapsible sections',
      locations: ['series-selector.tsx (Accordion for main panels, manual for "Other Series")', 'patient-manager.tsx (Accordion)'],
      recommendation: 'Standardize on Radix Accordion component for all collapsible panels',
    },
    {
      category: 'Cursor Patterns',
      severity: 'low',
      issue: 'Inconsistent cursor styles for interactive elements',
      locations: ['cursor-pointer (buttons)', 'cursor-grab/cursor-grabbing (drag handles)', 'cursor-move (sliders)'],
      recommendation: 'Document cursor mapping: pointer=clickable, grab=draggable, move=adjustable, not-allowed=disabled',
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

      {/* Animation Patterns */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Animation Patterns Found</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Loading Spinner (Yellow)</h4>
            <p className="text-xs text-gray-400 mb-3">From: working-viewer.tsx</p>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-gray-600 border-t-yellow-500 rounded-full animate-spin" />
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3 text-center">
              border-2 border-gray-600 border-t-yellow-500 animate-spin
            </code>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Loading Spinner (Cyan)</h4>
            <p className="text-xs text-gray-400 mb-3">From: flexible-fusion-layout.tsx</p>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3 text-center">
              border-2 border-cyan-500 border-t-transparent animate-spin
            </code>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Pulsing Loader</h4>
            <p className="text-xs text-gray-400 mb-3">From: working-viewer.tsx</p>
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 animate-pulse" />
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3 text-center">
              bg-gradient-to-br from-blue-600 to-indigo-600 animate-pulse
            </code>
          </div>
        </div>
      </div>

      {/* Glassmorphic Panel Examples */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Glassmorphic Panel Variations</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Toolbar Glass</h4>
            <p className="text-xs text-gray-400 mb-3">From: unified-fusion-toolbar-prototype.tsx</p>
            <div className="backdrop-blur-md border rounded-xl px-3 py-2 shadow-lg flex items-center gap-2" style={{ backgroundColor: '#1a1a1a95', borderColor: '#2d374850' }}>
              <ZoomIn className="w-4 h-4 text-white/70" />
              <ZoomOut className="w-4 h-4 text-white/70" />
              <div className="w-px h-5 bg-white/20" />
              <span className="text-xs text-white/60">Sample Toolbar</span>
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3">
              backdrop-blur-md bg-[#1a1a1a95] border-[#2d374850] rounded-xl shadow-lg
            </code>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Floating Panel</h4>
            <p className="text-xs text-gray-400 mb-3">From: blob-management-dialog.tsx</p>
            <div className="backdrop-blur-md border border-purple-500/60 rounded-xl px-4 py-3 shadow-2xl bg-gray-900/90">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-white">Panel Title</span>
              </div>
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3">
              backdrop-blur-md border-purple-500/60 bg-gray-900/90 shadow-2xl
            </code>
          </div>
        </div>
      </div>

      {/* Hover Scale Patterns */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Interactive Scale Patterns</h3>
        <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-2">Color Picker Swatches</h4>
          <p className="text-xs text-gray-400 mb-3">From: contour-edit-toolbar.tsx, boolean-pipeline-prototype-v5.tsx</p>
          <div className="flex gap-2">
            {['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'].map((color) => (
              <div 
                key={color}
                className="w-6 h-6 rounded border-2 border-gray-500/50 shadow-sm cursor-pointer transition-all hover:border-gray-400/70 hover:scale-105"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <code className="text-[10px] text-cyan-300 font-mono block mt-3">
            hover:scale-105 hover:border-gray-400/70 transition-all
          </code>
        </div>
      </div>

      {/* Gradient Tooltips */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Tooltip Variations</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Green Gradient</h4>
            <p className="text-xs text-gray-400 mb-3">From: series-selector.tsx (fusion active)</p>
            <div className="px-2 py-1 bg-gradient-to-br from-green-600/95 via-green-500/95 to-green-600/95 border border-green-400/30 text-white text-xs rounded-lg shadow-lg">
              Fusion Active
            </div>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Purple Gradient</h4>
            <p className="text-xs text-gray-400 mb-3">From: working-viewer.tsx (layout)</p>
            <div className="px-2 py-1 bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 text-white text-xs rounded-lg shadow-lg">
              Axial Only
            </div>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Blue Gradient</h4>
            <p className="text-xs text-gray-400 mb-3">From: series-selector.tsx (series info)</p>
            <div className="px-2 py-1 bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg shadow-lg">
              CT - Head (120 images)
            </div>
          </div>
        </div>
        <p className="text-xs text-amber-400 mt-3">⚠️ These gradient tooltips differ from the standard Radix Tooltip styling</p>
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
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Mini Viewport Cards</h4>
            <p className="text-xs text-gray-400 mb-3">From: working-viewer.tsx (MPR views)</p>
            <div className="flex gap-2">
              <div className="w-16 h-16 bg-black/90 rounded-lg border border-cyan-500/50 overflow-hidden shadow-lg">
                <div className="text-[9px] text-cyan-400 font-semibold px-1 py-0.5 bg-black/80 border-b border-cyan-500/30">SAG</div>
              </div>
              <div className="w-16 h-16 bg-black/90 rounded-lg border border-purple-500/50 overflow-hidden shadow-lg">
                <div className="text-[9px] text-purple-400 font-semibold px-1 py-0.5 bg-black/80 border-b border-purple-500/30">COR</div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Vertical Divider</h4>
            <p className="text-xs text-gray-400 mb-3">From: unified-fusion-toolbar-prototype.tsx</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Left</span>
              <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
              <span className="text-sm text-gray-400">Right</span>
            </div>
            <code className="text-[10px] text-cyan-300 font-mono block mt-3">
              w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent
            </code>
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
      case 'utilities': return <UtilitiesSection />;
      case 'icons': return <IconSection />;
      case 'aurora': return <AuroraSection />;
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
