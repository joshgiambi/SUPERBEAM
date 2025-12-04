/**
 * Prototype Module Page
 * 
 * A dedicated testing area for UI prototypes before integrating them into the main viewer.
 * This allows for rapid iteration and user feedback without disrupting production workflows.
 */

import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BooleanPipelinePrototypeV3 } from '@/components/dicom/boolean-pipeline-prototype-v3';
import { BooleanPipelinePrototypeV4 } from '@/components/dicom/boolean-pipeline-prototype-v4';
import { BooleanPipelinePrototypeV5 } from '@/components/dicom/boolean-pipeline-prototype-v5';
import { BooleanPipelinePrototypeCombined } from '@/components/dicom/boolean-pipeline-prototype-combined';
import { MarginOperationsPrototype } from '@/components/dicom/margin-operations-prototype';
import { BottomToolbarPrototype } from '@/components/dicom/bottom-toolbar-prototype';
import { BottomToolbarPrototypeV2 } from '@/components/dicom/bottom-toolbar-prototype-v2';
import { BottomToolbarPrototypeV3 } from '@/components/dicom/bottom-toolbar-prototype-v3';
import { ContourToolbarPrototype } from '@/components/dicom/contour-toolbar-prototype';
import { UnifiedToolbarPrototype } from '@/components/dicom/unified-toolbar-prototype';
import { SmartFusionViewportManager } from '@/components/dicom/smart-fusion-viewport-manager';
import { SonnetViewportManager } from '@/components/dicom/sonnet-viewport-manager';
import { FusionViewportGrid } from '@/components/dicom/fusion-viewport-grid';
import { SmartFusionGrid } from '@/components/dicom/smart-fusion-grid';
import { 
  ArrowLeft, 
  Beaker, 
  FlaskConical, 
  Wrench,
  CheckCircle,
  Clock,
  Lightbulb,
  Code,
  Type
} from 'lucide-react';

// Font Testing Component
function FontTestingPrototype() {
  const fonts = [
    // Pixelated Fonts
    { name: 'Silkscreen', family: "'Silkscreen', monospace", weight: 400, category: 'Pixelated' },
    { name: 'Sixtyfour', family: "'Sixtyfour', monospace", weight: 400, category: 'Pixelated' },
    { name: 'Doto', family: "'Doto', monospace", weight: 500, category: 'Pixelated' },
    { name: 'Press Start 2P', family: "'Press Start 2P', monospace", weight: 400, category: 'Pixelated' },
    { name: 'VT323', family: "'VT323', monospace", weight: 400, category: 'Pixelated' },
    { name: 'Pixelify Sans', family: "'Pixelify Sans', monospace", weight: 500, category: 'Pixelated' },
    { name: 'Tiny5', family: "'Tiny5', monospace", weight: 400, category: 'Pixelated' },
    // Futuristic Fonts
    { name: 'Bungee Tint', family: "'Bungee Tint', sans-serif", weight: 400, category: 'Futuristic' },
    { name: 'Sixtyfour Convergence', family: "'Sixtyfour Convergence', sans-serif", weight: 400, category: 'Futuristic' },
    { name: 'Orbitron', family: "'Orbitron', sans-serif", weight: 700, category: 'Futuristic' },
    { name: 'Exo 2', family: "'Exo 2', sans-serif", weight: 700, category: 'Futuristic' },
    { name: 'Audiowide', family: "'Audiowide', sans-serif", weight: 400, category: 'Futuristic' },
  ];

  const pixelatedFonts = fonts.filter(f => f.category === 'Pixelated');
  const futuristicFonts = fonts.filter(f => f.category === 'Futuristic');

  return (
    <div className="space-y-6">
      {/* Pixelated Fonts */}
      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-purple-400" />
            Pixelated Fonts
          </CardTitle>
          <CardDescription>
            Retro, 8-bit style pixelated fonts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {pixelatedFonts.map((font) => (
            <div key={font.name} className="p-6 bg-gray-900/50 border border-gray-700 rounded-lg">
              <div className="mb-3">
                <span className="text-sm text-gray-400 font-mono">{font.name}</span>
              </div>
              <h1 
                className="text-3xl tracking-widest" 
                style={{ 
                  letterSpacing: '0.25em', 
                  fontFamily: font.family,
                  fontWeight: font.weight 
                }}
              >
                <span style={{ color: 'white', WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>SUPER</span>
                <span style={{ color: '#9333ea' }}>B</span>
                <span style={{ color: '#3b82f6' }}>E</span>
                <span style={{ color: '#06b6d4' }}>A</span>
                <span style={{ color: '#10b981' }}>M</span>
              </h1>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Futuristic Fonts */}
      <Card className="bg-gray-950/60 border-cyan-600/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-cyan-400" />
            Futuristic Fonts
          </CardTitle>
          <CardDescription>
            Modern, sci-fi style fonts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {futuristicFonts.map((font) => (
            <div key={font.name} className="p-6 bg-gray-900/50 border border-cyan-700/30 rounded-lg">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm text-gray-400 font-mono">{font.name}</span>
                <span className="text-xs text-cyan-400 bg-cyan-900/30 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  Futuristic
                </span>
              </div>
              <h1 
                className="text-3xl tracking-widest" 
                style={{ 
                  letterSpacing: '0.25em', 
                  fontFamily: font.family,
                  fontWeight: font.weight 
                }}
              >
                <span style={{ color: 'white', WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>SUPER</span>
                <span style={{ color: '#9333ea' }}>B</span>
                <span style={{ color: '#3b82f6' }}>E</span>
                <span style={{ color: '#06b6d4' }}>A</span>
                <span style={{ color: '#10b981' }}>M</span>
              </h1>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-gray-950/60 border-gray-700">
        <CardHeader>
          <CardTitle className="text-sm text-white">Size Comparison - Top Picks</CardTitle>
          <CardDescription className="text-xs">
            Selected fonts shown at multiple sizes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {['Sixtyfour', 'Doto', 'Bungee Tint', 'Orbitron', 'Exo 2'].map((fontName) => {
            const font = fonts.find(f => f.name === fontName)!;
            return (
              <div key={fontName} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 font-mono">{font.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    font.category === 'Pixelated' 
                      ? 'text-purple-300 bg-purple-900/30 border border-purple-500/30' 
                      : 'text-cyan-300 bg-cyan-900/30 border border-cyan-500/30'
                  }`}>
                    {font.category}
                  </span>
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                  {[16, 20, 24, 28].map((size) => (
                    <div key={size} className="flex flex-col items-start gap-1">
                      <span className="text-xs text-gray-500">{size}px</span>
                      <h1 
                        style={{ 
                          fontSize: `${size}px`,
                          letterSpacing: '0.2em', 
                          fontFamily: font.family,
                          fontWeight: font.weight 
                        }}
                      >
                        <span style={{ color: 'white', WebkitTextStroke: '0.5px rgba(255,255,255,0.3)' }}>SUPER</span>
                        <span style={{ color: '#9333ea' }}>B</span>
                        <span style={{ color: '#3b82f6' }}>E</span>
                        <span style={{ color: '#06b6d4' }}>A</span>
                        <span style={{ color: '#10b981' }}>M</span>
                      </h1>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PrototypeModule() {
  const [activePrototype, setActivePrototype] = useState('font-testing');

  // Prototype registry
  const prototypes = [
    {
      id: 'font-testing',
      name: 'Pixelated Font Testing',
      description: 'Compare different pixelated fonts for the SUPERBEAM logo',
      status: 'in-progress',
      version: 'v1.0',
      component: FontTestingPrototype,
      tags: ['logo', 'fonts', 'design', 'branding', 'pixelated']
    },
    {
      id: 'boolean-pipeline-v3',
      name: 'Boolean Pipeline Builder V3',
      description: 'Ultra-compact minimal height design',
      status: 'in-progress',
      version: 'v3.0',
      component: BooleanPipelinePrototypeV3,
      tags: ['boolean', 'contouring', 'multi-step', 'minimal', 'compact']
    },
    {
      id: 'boolean-pipeline-v4',
      name: 'Boolean Pipeline Builder V4',
      description: 'Uses boolean toolbar styling with colored operation buttons',
      status: 'in-progress',
      version: 'v4.0',
      component: BooleanPipelinePrototypeV4,
      tags: ['boolean', 'contouring', 'multi-step', 'toolbar-style']
    },
    {
      id: 'boolean-pipeline-v5',
      name: 'Boolean Pipeline Builder V5',
      description: 'Expression panel style with syntax highlighting for each step',
      status: 'in-progress',
      version: 'v5.0',
      component: BooleanPipelinePrototypeV5,
      tags: ['boolean', 'contouring', 'multi-step', 'expression', 'syntax-highlighting']
    },
    {
      id: 'boolean-pipeline-combined',
      name: 'Boolean Pipeline Builder Combined',
      description: 'V4/V5 combined with mode switcher (Panel/Expression)',
      status: 'in-progress',
      version: 'v4.5',
      component: BooleanPipelinePrototypeCombined,
      tags: ['boolean', 'contouring', 'multi-step', 'panel', 'expression', 'mode-switcher']
    },
    {
      id: 'margin-operations',
      name: 'Margin Operations',
      description: 'Uniform and anisotropic margin operations for structures',
      status: 'in-progress',
      version: 'v1.0',
      component: MarginOperationsPrototype,
      tags: ['margin', 'contouring', 'uniform', 'anisotropic']
    },
    {
      id: 'bottom-toolbar',
      name: 'Bottom Toolbar',
      description: 'All buttons from the bottom viewer toolbar',
      status: 'in-progress',
      version: 'v1.0',
      component: BottomToolbarPrototype,
      tags: ['toolbar', 'viewer', 'buttons']
    },
    {
      id: 'bottom-toolbar-v2',
      name: 'Bottom Toolbar V2',
      description: 'Improved arrangement with text labels for contour, boolean, and margin buttons',
      status: 'in-progress',
      version: 'v2.0',
      component: BottomToolbarPrototypeV2,
      tags: ['toolbar', 'viewer', 'buttons', 'improved', 'labels']
    },
    {
      id: 'bottom-toolbar-v3',
      name: 'Bottom Toolbar V3',
      description: 'History/Undo/Redo separate on left, Contour/Boolean/Margin separate on right with text labels',
      status: 'in-progress',
      version: 'v3.0',
      component: BottomToolbarPrototypeV3,
      tags: ['toolbar', 'viewer', 'buttons', 'separate', 'labels']
    },
    {
      id: 'contour-toolbar',
      name: 'Contour Toolbar',
      description: 'All buttons from the contour editing toolbar',
      status: 'in-progress',
      version: 'v1.0',
      component: ContourToolbarPrototype,
      tags: ['toolbar', 'contour', 'editing', 'buttons']
    },
    {
      id: 'unified-toolbar',
      name: 'Unified Toolbar',
      description: 'Redesigned Contour, Boolean, and Margin toolbars with unified visual style and compact footprint',
      status: 'in-progress',
      version: 'v1.0',
      component: UnifiedToolbarPrototype,
      tags: ['toolbar', 'contour', 'boolean', 'margin', 'unified', 'compact']
    },
    {
      id: 'smart-fusion-manager',
      name: 'Smart Fusion Layout Manager',
      description: 'Novel viewport management with drag-and-drop fusion, dynamic splitting, and cinema-style dock.',
      status: 'in-progress',
      version: 'v1.0',
      component: SmartFusionViewportManager,
      tags: ['fusion', 'layout', 'drag-drop', 'grid', 'novel', 'dock']
    },
    {
      id: 'sonnet-viewport-manager',
      name: 'SONNET Viewport Manager',
      description: 'Smart Orchestrated Navigation Network for Enhanced Tomography. Revolutionary viewport management with magnetic card dock, smart pairing suggestions, visual layout presets, and bookmarkable layouts. Insanely user-friendly multi-scan fusion viewing.',
      status: 'in-progress',
      version: 'v1.0',
      component: SonnetViewportManager,
      tags: ['fusion', 'sonnet', 'smart-suggestions', 'layout-presets', 'drag-drop', 'bookmarks', 'novel', 'user-friendly', 'ai-powered']
    },
    {
      id: 'fusion-viewport-grid',
      name: 'Fusion Viewport Grid (HYBRID)',
      description: 'Hybrid multi-viewport manager combining Smart Fusion\'s fusion capabilities with SONNET\'s layout saving. Designed to replace WorkingViewer with per-viewport fusion support, integrates with existing FusionControlPanelV2, and includes layout bookmarking. Production-ready drop-in replacement.',
      status: 'in-progress',
      version: 'v3.0',
      component: FusionViewportGrid,
      tags: ['fusion', 'hybrid', 'multi-viewport', 'production-ready', 'fusion-panel-integrated', 'layout-saving', 'mpr', 'drag-drop', 'portal']
    },
    {
      id: 'smart-fusion-grid-v4',
      name: 'Smart Fusion Grid V4 (PRODUCTION)',
      description: 'Production-ready multi-viewport fusion system with full WorkingViewer integration. Features include: drag-and-drop series/fusion, layout presets (auto-grid, side-by-side, quad), per-viewport MPR toggle, layout persistence, registration validation, and seamless fusion panel integration with draggable series. Built on proven Fusebox infrastructure with fixed fusion scrolling bug.',
      status: 'in-progress',
      version: 'v4.0',
      component: SmartFusionGrid,
      tags: ['fusion', 'production', 'multi-viewport', 'working-viewer', 'drag-drop', 'layout-presets', 'mpr', 'registration', 'fusebox', 'scrolling-fixed']
    },
    // Add more prototypes here as they're created
  ];

  const activeProtoData = prototypes.find(p => p.id === activePrototype);
  const ActiveComponent = activeProtoData?.component;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-500/30 px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Completed
          </div>
        );
      case 'in-progress':
        return (
          <div className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-500/30 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" />
            In Progress
          </div>
        );
      case 'draft':
        return (
          <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-900/20 border border-gray-500/30 px-2 py-1 rounded-full">
            <Lightbulb className="w-3 h-3" />
            Draft
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="fixed top-4 left-4 right-4 bg-gray-950/90 backdrop-blur-xl border border-gray-600/60 rounded-2xl px-6 py-3 z-50 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button 
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            
            <div className="h-6 w-px bg-gray-700" />
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30 rounded-lg">
                <Beaker className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  Prototype Module
                  <span className="text-xs font-normal text-gray-400 bg-purple-900/30 border border-purple-500/30 px-2 py-0.5 rounded-full">
                    Testing Lab
                  </span>
                </h1>
                <p className="text-xs text-gray-400">
                  Test new UI components before integration
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              {prototypes.length} {prototypes.length === 1 ? 'prototype' : 'prototypes'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 pt-24 pb-8 px-8 overflow-hidden gap-6">
        {/* Sidebar - Prototype List */}
        <div className="w-80 flex-shrink-0">
          <Card className="bg-gray-950/90 border-gray-700 h-full flex flex-col">
            <CardHeader className="border-b border-gray-700">
              <CardTitle className="text-white flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-purple-400" />
                Available Prototypes
              </CardTitle>
              <CardDescription>
                Select a prototype to test
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
              {prototypes.map((proto) => (
                <button
                  key={proto.id}
                  onClick={() => setActivePrototype(proto.id)}
                  className={`
                    w-full text-left p-3 rounded-lg border-2 transition-all
                    ${activePrototype === proto.id
                      ? 'bg-purple-900/30 border-purple-500/60 shadow-lg shadow-purple-500/20'
                      : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600/60 hover:bg-gray-800/60'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white">
                      {proto.name}
                    </h3>
                    {getStatusBadge(proto.status)}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    {proto.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {proto.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] text-purple-300 bg-purple-900/40 border border-purple-500/30 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">
                    Version: {proto.version}
                  </div>
                </button>
              ))}

              {/* Placeholder for future prototypes */}
              <div className="p-4 border-2 border-dashed border-gray-700 rounded-lg text-center">
                <Wrench className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p className="text-xs text-gray-500">
                  More prototypes coming soon...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Area - Active Prototype */}
        <div className="flex-1 overflow-y-auto">
          {activeProtoData ? (
            <div className="space-y-4">
              {/* Prototype Header */}
              <Card className="bg-gradient-to-br from-purple-950/40 to-blue-950/40 border-purple-500/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-3">
                        <Code className="w-6 h-6 text-purple-400" />
                        {activeProtoData.name}
                        <span className="text-xs font-mono text-gray-400 bg-gray-900/60 border border-gray-700 px-2 py-1 rounded">
                          {activeProtoData.version}
                        </span>
                      </CardTitle>
                      <CardDescription className="mt-2 text-gray-300">
                        {activeProtoData.description}
                      </CardDescription>
                    </div>
                    {getStatusBadge(activeProtoData.status)}
                  </div>
                </CardHeader>
              </Card>

              {/* Prototype Component */}
              <div className="min-h-0">
                {ActiveComponent && <ActiveComponent />}
              </div>

              {/* Prototype Notes */}
              <Card className="bg-gray-950/60 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-sm text-white">Testing Notes</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-400 space-y-2">
                  <p>
                    <strong className="text-purple-400">Purpose:</strong> This prototype demonstrates
                    a multi-step workflow interface for boolean operations on contours.
                  </p>
                  <p>
                    <strong className="text-purple-400">Test Areas:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Adding and removing steps</li>
                    <li>Step validation and error states</li>
                    <li>Visual flow and clarity</li>
                    <li>Color coding for operations</li>
                    <li>Output configuration options</li>
                  </ul>
                  <p>
                    <strong className="text-purple-400">Feedback:</strong> Please provide feedback
                    on usability, visual design, and any missing features.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Beaker className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">Select a prototype to begin testing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

