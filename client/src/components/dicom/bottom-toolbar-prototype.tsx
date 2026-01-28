/**
 * Bottom Toolbar Prototype
 * 
 * Prototype showing all buttons from the bottom viewer toolbar
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Crosshair,
  Ruler,
  Grid3x3,
  Layers,
  Activity,
  Target,
  Info,
  HelpCircle,
  Highlighter,
  SquaresSubtract,
  Expand,
  Undo,
  Redo,
  History,
  X
} from 'lucide-react';

export function BottomToolbarPrototype() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [canUndo, setCanUndo] = useState(true);
  const [canRedo, setCanRedo] = useState(false);

  const tools = [
    { id: 'zoom-in', icon: ZoomIn, label: 'Zoom In' },
    { id: 'zoom-out', icon: ZoomOut, label: 'Zoom Out' },
    { id: 'fit', icon: Maximize2, label: 'Fit to Window' },
    { id: 'separator' },
    { id: 'pan', icon: Hand, label: 'Pan', selectable: true },
    { id: 'crosshairs', icon: Crosshair, label: 'Crosshairs', selectable: true },
    { id: 'measure', icon: Ruler, label: 'Measure', selectable: true },
    { id: 'separator' },
    { id: 'mpr', icon: Grid3x3, label: 'MPR View', selectable: true },
    { id: 'fusion', icon: Layers, label: 'Fusion', selectable: true },
    { id: 'dose-plan', icon: Activity, label: 'Dose/Plan Review (Coming Soon)' },
    { id: 'separator' },
    { id: 'localization', icon: Target, label: '🎯 Structure Localization', selectable: true },
    { id: 'metadata', icon: Info, label: 'View DICOM Metadata' },
    { id: 'help', icon: HelpCircle, label: 'Interaction Guide' },
  ];

  const handleToolClick = (toolId: string) => {
    if (tools.find(t => t.id === toolId)?.selectable) {
      setActiveTool(activeTool === toolId ? null : toolId);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-8 p-8">
      <div className="text-white text-xl font-semibold mb-4">Bottom Toolbar Prototype</div>
      
      {/* Main Toolbar */}
      <div className="relative">
        {/* Undo/Redo/History cluster - left side of toolbar */}
        <div className="absolute -left-40 top-1/2 transform -translate-y-1/2 animate-in slide-in-from-right-2 duration-300">
          <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-2 py-1 shadow-2xl">
            <div className="flex space-x-2">
              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 transition-all duration-200 rounded-lg text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-50"
                  disabled={!canUndo}
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Undo
                </div>
              </div>

              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 transition-all duration-200 rounded-lg text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-50"
                  disabled={!canRedo}
                >
                  <Redo className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Redo
                </div>
              </div>

              <div className="relative">
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 transition-all duration-200 rounded-lg ${showHistory ? 'bg-orange-600/20 text-orange-400 border border-orange-500/50 shadow-sm' : 'text-white/90 hover:bg-white/20 hover:text-white'} disabled:opacity-50`}
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <History className="w-4 h-4" />
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-orange-600/95 via-orange-500/95 to-orange-600/95 border border-orange-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    History
                  </div>
                </div>

                {showHistory && (
                  <div 
                    className="absolute bottom-full left-0 mb-3 w-[280px] rounded-xl backdrop-blur-xl overflow-hidden z-50"
                    style={{
                      background: 'linear-gradient(180deg, hsla(45, 15%, 12%, 0.98) 0%, hsla(45, 10%, 8%, 0.99) 100%)',
                      boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 0 40px -15px rgba(251, 191, 36, 0.15)',
                    }}
                  >
                    {/* Header */}
                    <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-white">Edit History</span>
                      </div>
                      <button 
                        className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
                        onClick={() => setShowHistory(false)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-2 max-h-64 overflow-y-auto">
                      <div className="text-center py-6">
                        <History className="w-8 h-8 mx-auto mb-2 text-amber-500/30" />
                        <p className="text-xs font-medium text-gray-300">No history yet</p>
                        <p className="text-[10px] mt-1 text-gray-500">Edit actions will appear here</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-3 py-2 shadow-2xl">
          <div className="flex items-center space-x-1">
            {tools.map((tool, index) => {
              if (tool.id === 'separator') {
                return (
                  <div key={index} className="w-px h-5 bg-white/30 mx-1.5" />
                );
              }

              const IconComponent = tool.icon!;
              const isActive = tool.selectable && activeTool === tool.id;

              return (
                <div key={tool.id} className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`
                      h-8 w-8 p-0 transition-all duration-200 rounded-lg text-white/90
                      ${tool.id === 'mpr' && isActive
                        ? 'bg-green-600/20 text-green-400 border border-green-500/50 shadow-sm' 
                        : tool.id === 'localization' && isActive
                        ? 'bg-orange-600/20 text-orange-400 border border-orange-500/50 shadow-sm'
                        : isActive 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-sm' 
                        : 'hover:bg-white/20 hover:text-white'
                      }
                    `}
                    onClick={() => handleToolClick(tool.id)}
                  >
                    <IconComponent className="w-4 h-4" />
                  </Button>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-gray-600/95 via-gray-500/95 to-gray-600/95 border border-gray-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    {tool.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contour Edit and Operations Popout Icons */}
        <div className="absolute -right-40 top-1/2 transform -translate-y-1/2 animate-in slide-in-from-left-2 duration-300">
          <div className="flex space-x-2">
            {/* Contour Edit Button */}
            <div className="relative group">
              <div className="backdrop-blur-md border border-green-500/40 bg-white/5 hover:border-green-400/70 hover:bg-green-500/10 hover:shadow-green-500/20 rounded-xl shadow-lg transition-all duration-300">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 transition-all duration-300 hover:bg-transparent text-green-300 hover:text-green-200"
                >
                  <Highlighter className="w-4 h-4 transition-all duration-300" />
                </Button>
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-green-600/95 via-green-500/95 to-green-600/95 border border-green-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Edit Contours
              </div>
            </div>
            
            {/* Contour Operations Button */}
            <div className="relative group">
              <div className="backdrop-blur-md border border-blue-500/40 bg-white/5 hover:border-blue-400/70 hover:bg-blue-500/10 hover:shadow-blue-500/20 rounded-xl shadow-lg transition-all duration-300">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 transition-all duration-300 hover:bg-transparent text-blue-300 hover:text-blue-200"
                >
                  <SquaresSubtract className="w-4 h-4 transition-all duration-300" />
                </Button>
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Boolean Operations
              </div>
            </div>

            {/* Advanced Margin Tool Button */}
            <div className="relative group">
              <div className="backdrop-blur-md border border-purple-500/40 bg-white/5 hover:border-purple-400/70 hover:bg-purple-500/10 hover:shadow-purple-500/20 rounded-xl shadow-lg transition-all duration-300">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 transition-all duration-300 hover:bg-transparent text-purple-300 hover:text-purple-200"
                >
                  <Expand className="w-4 h-4 transition-all duration-300" />
                </Button>
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Advanced Margin Tool
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

