/**
 * Prototype Module Page
 * 
 * Organized testing area for UI prototypes with category filtering.
 */

import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BooleanPipelinePrototypeV3 } from '@/components/dicom/boolean-pipeline-prototype-v3';
import { BooleanPipelinePrototypeV4 } from '@/components/dicom/boolean-pipeline-prototype-v4';
import { BooleanPipelinePrototypeV5 } from '@/components/dicom/boolean-pipeline-prototype-v5';
import { BooleanPipelinePrototypeCombined } from '@/components/dicom/boolean-pipeline-prototype-combined';
import { MarginOperationsPrototype } from '@/components/dicom/margin-operations-prototype';
import { BottomToolbarPrototype } from '@/components/dicom/bottom-toolbar-prototype';
import { BottomToolbarPrototypeV2 } from '@/components/dicom/bottom-toolbar-prototype-v2';
import { BottomToolbarPrototypeV3 } from '@/components/dicom/bottom-toolbar-prototype-v3';
import { ContourToolbarPrototype } from '@/components/dicom/contour-toolbar-prototype';
import { ContourToolbarV2Prototype } from '@/components/dicom/contour-toolbar-v2-prototype';
import { ContourToolbarV3Prototype } from '@/components/dicom/contour-toolbar-v3-prototype';
import { ContourToolbarV4Prototype } from '@/components/dicom/contour-toolbar-v4-prototype';
import { V4AuroraPanelsPrototype } from '@/components/dicom/v4-aurora-panels-prototype';
import { UnifiedToolbarPrototype } from '@/components/dicom/unified-toolbar-prototype';
import { SmartFusionViewportManager } from '@/components/dicom/smart-fusion-viewport-manager';
import { SonnetViewportManager } from '@/components/dicom/sonnet-viewport-manager';
import { FusionViewportGrid } from '@/components/dicom/fusion-viewport-grid';
import { UnifiedFusionToolbarPrototype } from '@/components/dicom/unified-fusion-toolbar-prototype';
import { 
  ArrowLeft, 
  Beaker, 
  FlaskConical, 
  Wrench,
  CheckCircle,
  Clock,
  Lightbulb,
  Code,
  Type,
  Layers,
  LayoutGrid,
  Palette,
  Scissors,
  Filter,
  Search,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// CATEGORIES
// ============================================================================

type Category = 'all' | 'fusion' | 'toolbars' | 'boolean' | 'design' | 'contouring';

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'all', label: 'All Prototypes', icon: <Filter className="w-3.5 h-3.5" />, color: 'gray' },
  { id: 'fusion', label: 'Fusion & Layout', icon: <Layers className="w-3.5 h-3.5" />, color: 'amber' },
  { id: 'toolbars', label: 'Toolbars', icon: <LayoutGrid className="w-3.5 h-3.5" />, color: 'cyan' },
  { id: 'boolean', label: 'Boolean Ops', icon: <Scissors className="w-3.5 h-3.5" />, color: 'purple' },
  { id: 'contouring', label: 'Contouring', icon: <Scissors className="w-3.5 h-3.5" />, color: 'green' },
  { id: 'design', label: 'Design', icon: <Palette className="w-3.5 h-3.5" />, color: 'pink' },
];

// ============================================================================
// FONT TESTING PROTOTYPE
// ============================================================================

function FontTestingPrototype() {
  const fonts = [
    { name: 'Silkscreen', family: "'Silkscreen', monospace", weight: 400, category: 'Pixelated' },
    { name: 'Sixtyfour', family: "'Sixtyfour', monospace", weight: 400, category: 'Pixelated' },
    { name: 'Doto', family: "'Doto', monospace", weight: 500, category: 'Pixelated' },
    { name: 'Press Start 2P', family: "'Press Start 2P', monospace", weight: 400, category: 'Pixelated' },
    { name: 'Orbitron', family: "'Orbitron', sans-serif", weight: 700, category: 'Futuristic' },
    { name: 'Exo 2', family: "'Exo 2', sans-serif", weight: 700, category: 'Futuristic' },
    { name: 'Audiowide', family: "'Audiowide', sans-serif", weight: 400, category: 'Futuristic' },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-purple-400" />
            Font Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fonts.map((font) => (
            <div key={font.name} className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg flex items-center justify-between">
              <span className="text-xs text-gray-400 font-mono w-32">{font.name}</span>
              <h1 
                className="text-2xl tracking-widest flex-1 text-center" 
                style={{ letterSpacing: '0.2em', fontFamily: font.family, fontWeight: font.weight }}
              >
                <span style={{ color: 'white' }}>SUPER</span>
                <span style={{ color: '#9333ea' }}>B</span>
                <span style={{ color: '#3b82f6' }}>E</span>
                <span style={{ color: '#06b6d4' }}>A</span>
                <span style={{ color: '#10b981' }}>M</span>
              </h1>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full",
                font.category === 'Pixelated' ? 'text-purple-300 bg-purple-900/30 border border-purple-500/30' : 'text-cyan-300 bg-cyan-900/30 border border-cyan-500/30'
              )}>{font.category}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PROTOTYPE REGISTRY
// ============================================================================

interface Prototype {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress' | 'draft';
  version: string;
  component: React.ComponentType;
  category: Category;
  tags: string[];
}

const prototypes: Prototype[] = [
  // FUSION & LAYOUT
  {
    id: 'unified-fusion-toolbar',
    name: 'Unified Fusion/Layout Toolbar',
    description: 'Adaptive toolbar that morphs based on context: standard viewing, fusion active, or multi-viewport mode.',
    status: 'in-progress',
    version: 'v2.0',
    component: UnifiedFusionToolbarPrototype,
    category: 'fusion',
    tags: ['fusion', 'layout', 'toolbar', 'adaptive', 'morphing']
  },
  {
    id: 'fusion-viewport-grid',
    name: 'Fusion Viewport Grid',
    description: 'Hybrid multi-viewport manager with layout saving and fusion support.',
    status: 'in-progress',
    version: 'v3.0',
    component: FusionViewportGrid,
    category: 'fusion',
    tags: ['fusion', 'hybrid', 'layout-saving']
  },
  {
    id: 'sonnet-viewport-manager',
    name: 'SONNET Viewport Manager',
    description: 'Smart Orchestrated Navigation with magnetic card dock and AI suggestions.',
    status: 'in-progress',
    version: 'v1.0',
    component: SonnetViewportManager,
    category: 'fusion',
    tags: ['fusion', 'sonnet', 'ai-powered', 'novel']
  },
  {
    id: 'smart-fusion-manager',
    name: 'Smart Fusion Layout Manager',
    description: 'Novel viewport management with drag-and-drop fusion and cinema-style dock.',
    status: 'in-progress',
    version: 'v1.0',
    component: SmartFusionViewportManager,
    category: 'fusion',
    tags: ['fusion', 'drag-drop', 'dock']
  },

  // TOOLBARS
  {
    id: 'bottom-toolbar-v3',
    name: 'Bottom Toolbar V3',
    description: 'History/Undo/Redo separate on left, Contour/Boolean/Margin on right with text labels.',
    status: 'in-progress',
    version: 'v3.0',
    component: BottomToolbarPrototypeV3,
    category: 'toolbars',
    tags: ['toolbar', 'viewer', 'labels']
  },
  {
    id: 'bottom-toolbar-v2',
    name: 'Bottom Toolbar V2',
    description: 'Improved arrangement with text labels for contour, boolean, and margin buttons.',
    status: 'in-progress',
    version: 'v2.0',
    component: BottomToolbarPrototypeV2,
    category: 'toolbars',
    tags: ['toolbar', 'viewer', 'labels']
  },
  {
    id: 'bottom-toolbar',
    name: 'Bottom Toolbar V1',
    description: 'Original bottom viewer toolbar design.',
    status: 'in-progress',
    version: 'v1.0',
    component: BottomToolbarPrototype,
    category: 'toolbars',
    tags: ['toolbar', 'viewer']
  },
  {
    id: 'unified-toolbar',
    name: 'Unified Toolbar',
    description: 'Redesigned Contour, Boolean, and Margin toolbars with unified visual style.',
    status: 'in-progress',
    version: 'v1.0',
    component: UnifiedToolbarPrototype,
    category: 'toolbars',
    tags: ['toolbar', 'unified', 'compact']
  },

  // BOOLEAN OPERATIONS
  {
    id: 'boolean-pipeline-combined',
    name: 'Boolean Pipeline Combined',
    description: 'V4/V5 combined with Panel/Expression mode switcher.',
    status: 'in-progress',
    version: 'v4.5',
    component: BooleanPipelinePrototypeCombined,
    category: 'boolean',
    tags: ['boolean', 'multi-step', 'mode-switcher']
  },
  {
    id: 'boolean-pipeline-v5',
    name: 'Boolean Pipeline V5',
    description: 'Expression panel style with syntax highlighting.',
    status: 'in-progress',
    version: 'v5.0',
    component: BooleanPipelinePrototypeV5,
    category: 'boolean',
    tags: ['boolean', 'expression', 'syntax-highlighting']
  },
  {
    id: 'boolean-pipeline-v4',
    name: 'Boolean Pipeline V4',
    description: 'Boolean toolbar styling with colored operation buttons.',
    status: 'in-progress',
    version: 'v4.0',
    component: BooleanPipelinePrototypeV4,
    category: 'boolean',
    tags: ['boolean', 'toolbar-style']
  },
  {
    id: 'boolean-pipeline-v3',
    name: 'Boolean Pipeline V3',
    description: 'Ultra-compact minimal height design.',
    status: 'in-progress',
    version: 'v3.0',
    component: BooleanPipelinePrototypeV3,
    category: 'boolean',
    tags: ['boolean', 'minimal', 'compact']
  },

  // CONTOURING
  {
    id: 'contour-toolbar-v4',
    name: 'Contour Toolbar V4 (Aurora)',
    description: 'Refined two-row design with inline settings, adaptive color theming, and clean layout.',
    status: 'in-progress',
    version: 'v4.0',
    component: ContourToolbarV4Prototype,
    category: 'contouring',
    tags: ['toolbar', 'contour', 'editing', 'adaptive-color', 'draggable', 'aurora']
  },
  {
    id: 'v4-aurora-panels',
    name: 'V4 Aurora Panels (Boolean + Margin + Bottom)',
    description: 'Boolean operations, Margin operations, and Bottom viewport toolbar in V4 Aurora design.',
    status: 'in-progress',
    version: 'v4.0',
    component: V4AuroraPanelsPrototype,
    category: 'toolbars',
    tags: ['boolean', 'margin', 'toolbar', 'viewport', 'aurora', 'panels']
  },
  {
    id: 'contour-toolbar-v3',
    name: 'Contour Toolbar V3 (Single-Row Draggable)',
    description: 'Compact single-row dark design with drag-anywhere functionality and position memory.',
    status: 'in-progress',
    version: 'v3.0',
    component: ContourToolbarV3Prototype,
    category: 'contouring',
    tags: ['toolbar', 'contour', 'editing', 'dark-theme', 'draggable', 'minimal']
  },
  {
    id: 'contour-toolbar-v2',
    name: 'Contour Toolbar V2',
    description: 'Modern redesign with dark subpanel, minimal 44px height, and Unified Fusion toolbar design language.',
    status: 'in-progress',
    version: 'v2.0',
    component: ContourToolbarV2Prototype,
    category: 'contouring',
    tags: ['toolbar', 'contour', 'editing', 'dark-theme', 'minimal']
  },
  {
    id: 'margin-operations',
    name: 'Margin Operations',
    description: 'Uniform and anisotropic margin operations for structures.',
    status: 'in-progress',
    version: 'v1.0',
    component: MarginOperationsPrototype,
    category: 'contouring',
    tags: ['margin', 'uniform', 'anisotropic']
  },
  {
    id: 'contour-toolbar',
    name: 'Contour Toolbar V1',
    description: 'Original contour editing toolbar design.',
    status: 'in-progress',
    version: 'v1.0',
    component: ContourToolbarPrototype,
    category: 'contouring',
    tags: ['toolbar', 'contour', 'editing', 'legacy']
  },

  // DESIGN
  {
    id: 'font-testing',
    name: 'Font Testing',
    description: 'Compare different fonts for the SUPERBEAM logo.',
    status: 'in-progress',
    version: 'v1.0',
    component: FontTestingPrototype,
    category: 'design',
    tags: ['fonts', 'branding', 'logo']
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PrototypeModule() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePrototype, setActivePrototype] = useState(prototypes[0].id);

  // Filter prototypes based on category and search
  const filteredPrototypes = useMemo(() => {
    return prototypes.filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = searchQuery === '' || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const activeProtoData = prototypes.find(p => p.id === activePrototype);
  const ActiveComponent = activeProtoData?.component;

  const getCategoryColor = (category: Category) => {
    const cat = CATEGORIES.find(c => c.id === category);
    if (!cat) return 'gray';
    return cat.color;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-1 text-[10px] text-green-400 bg-green-900/20 border border-green-500/30 px-1.5 py-0.5 rounded-full">
            <CheckCircle className="w-2.5 h-2.5" />
            Done
          </div>
        );
      case 'in-progress':
        return (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">
            <Clock className="w-2.5 h-2.5" />
            WIP
          </div>
        );
      case 'draft':
        return (
          <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-900/20 border border-gray-500/30 px-1.5 py-0.5 rounded-full">
            <Lightbulb className="w-2.5 h-2.5" />
            Draft
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Fixed Header with Category Filter */}
      <header className="flex-shrink-0 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800 z-50">
        {/* Top row: Title and back button */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800/50">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-8">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
            </Link>
            
            <div className="h-5 w-px bg-gray-700" />
            
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30 rounded-lg">
                <Beaker className="w-4 h-4 text-purple-400" />
              </div>
              <h1 className="text-sm font-bold text-white">Prototype Lab</h1>
              <span className="text-[10px] text-gray-500 bg-gray-800/50 border border-gray-700/50 px-1.5 py-0.5 rounded">
                {prototypes.length} prototypes
              </span>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search prototypes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 h-8 pl-8 pr-8 bg-gray-900/60 border border-gray-700/50 rounded-lg text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="flex items-center gap-1.5 px-6 py-2 bg-gray-900/50">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all' 
              ? prototypes.length 
              : prototypes.filter(p => p.category === cat.id).length;
            const isActive = activeCategory === cat.id;
            
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isActive
                    ? cat.color === 'amber' ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : cat.color === 'cyan' ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : cat.color === 'purple' ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : cat.color === 'green' ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : cat.color === 'pink' ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                    : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                    : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent"
                )}
              >
                {cat.icon}
                {cat.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-white/10" : "bg-gray-800/50"
                )}>{count}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Prototype List */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 bg-gray-950/50 overflow-y-auto">
          <div className="p-3 space-y-1.5">
            {filteredPrototypes.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No prototypes match your filters</p>
              </div>
            ) : (
              filteredPrototypes.map((proto) => {
                const catColor = getCategoryColor(proto.category);
                const isActive = activePrototype === proto.id;
                
                return (
                  <button
                    key={proto.id}
                    onClick={() => setActivePrototype(proto.id)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg border transition-all",
                      isActive
                        ? "bg-purple-900/20 border-purple-500/40"
                        : "bg-gray-900/30 border-gray-800/50 hover:border-gray-700/60 hover:bg-gray-800/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-xs font-semibold text-white leading-tight">{proto.name}</h3>
                      {getStatusBadge(proto.status)}
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2 line-clamp-2">{proto.description}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded border",
                        catColor === 'amber' ? "text-amber-400 bg-amber-900/20 border-amber-700/30"
                        : catColor === 'cyan' ? "text-cyan-400 bg-cyan-900/20 border-cyan-700/30"
                        : catColor === 'purple' ? "text-purple-400 bg-purple-900/20 border-purple-700/30"
                        : catColor === 'green' ? "text-green-400 bg-green-900/20 border-green-700/30"
                        : catColor === 'pink' ? "text-pink-400 bg-pink-900/20 border-pink-700/30"
                        : "text-gray-400 bg-gray-900/20 border-gray-700/30"
                      )}>
                        {CATEGORIES.find(c => c.id === proto.category)?.label}
                      </span>
                      <span className="text-[9px] text-gray-600">{proto.version}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Main Area - Active Prototype */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeProtoData ? (
            <div className="space-y-4">
              {/* Prototype Header */}
              <div className="flex items-start justify-between p-4 bg-gradient-to-r from-purple-950/30 to-blue-950/30 border border-purple-500/20 rounded-xl">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Code className="w-4 h-4 text-purple-400" />
                    <h2 className="text-lg font-bold text-white">{activeProtoData.name}</h2>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-900/60 border border-gray-700 px-1.5 py-0.5 rounded">
                      {activeProtoData.version}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{activeProtoData.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activeProtoData.tags.map(tag => (
                      <span key={tag} className="text-[9px] text-purple-300 bg-purple-900/30 border border-purple-500/20 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {getStatusBadge(activeProtoData.status)}
              </div>

              {/* Prototype Component */}
              <div className="min-h-0">
                {ActiveComponent && <ActiveComponent />}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Beaker className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400 text-sm">Select a prototype to begin testing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
