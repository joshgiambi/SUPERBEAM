/**
 * Bottom Toolbar Prototype V3
 * 
 * History/Undo/Redo separate on left, Contour/Boolean/Margin separate on right
 * with text labels for better clarity
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

export function BottomToolbarPrototypeV3() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [canUndo, setCanUndo] = useState(true);
  const [canRedo, setCanRedo] = useState(false);
  const [isContourEditActive, setIsContourEditActive] = useState(false);
  const [isBooleanActive, setIsBooleanActive] = useState(false);
  const [isMarginActive, setIsMarginActive] = useState(false);

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
      <div className="text-white text-xl font-semibold mb-4">Bottom Toolbar Prototype V3</div>
      
      {/* Main Toolbar */}
      <div className="relative flex items-center gap-3">
        {/* Contour/Boolean/Margin Group - Left Side - In Single Container */}
        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-2 py-2 shadow-2xl z-10">
          <div className="flex space-x-2">
            {/* Contour Edit Button */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsContourEditActive(!isContourEditActive);
                  setIsBooleanActive(false);
                  setIsMarginActive(false);
                }}
                className={`h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2 ${
                  isContourEditActive
                    ? 'bg-green-600/20 text-green-300 border border-green-500/50 shadow-sm'
                    : 'text-white/90 hover:bg-white/20 hover:text-white border border-transparent'
                }`}
              >
                <Highlighter className="w-4 h-4" />
                <span className="text-xs font-medium">Contour</span>
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-green-600/95 via-green-500/95 to-green-600/95 border border-green-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Edit Contours
              </div>
            </div>
            
            {/* Boolean Operations Button */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsBooleanActive(!isBooleanActive);
                  setIsContourEditActive(false);
                  setIsMarginActive(false);
                }}
                className={`h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2 ${
                  isBooleanActive
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50 shadow-sm'
                    : 'text-white/90 hover:bg-white/20 hover:text-white border border-transparent'
                }`}
              >
                <SquaresSubtract className="w-4 h-4" />
                <span className="text-xs font-medium">Boolean</span>
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-blue-600/95 via-blue-500/95 to-blue-600/95 border border-blue-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Boolean Operations
              </div>
            </div>

            {/* Advanced Margin Tool Button */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsMarginActive(!isMarginActive);
                  setIsContourEditActive(false);
                  setIsBooleanActive(false);
                }}
                className={`h-8 px-3 transition-all duration-200 rounded-lg flex items-center gap-2 ${
                  isMarginActive
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/50 shadow-sm'
                    : 'text-white/90 hover:bg-white/20 hover:text-white border border-transparent'
                }`}
              >
                <Expand className="w-4 h-4" />
                <span className="text-xs font-medium">Margin</span>
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gradient-to-br from-purple-600/95 via-purple-500/95 to-purple-600/95 border border-purple-400/30 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Advanced Margin Tool
              </div>
            </div>
          </div>
        </div>

        {/* Main Toolbar - Center */}
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

        {/* Undo/Redo/History cluster - right side of toolbar */}
        <div className="bg-white/10 backdrop-blur-md border border-white/40 rounded-xl px-2 py-2 shadow-2xl">
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
                  className="absolute bottom-full right-0 mb-3 w-[280px] rounded-xl backdrop-blur-xl overflow-hidden z-50"
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
    </div>
  );
}

