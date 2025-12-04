/**
 * Contour Toolbar Prototype
 * 
 * Prototype showing all buttons from the contour editing toolbar
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Brush,
  Pen,
  Scissors,
  Maximize2,
  Sparkles,
  X
} from 'lucide-react';

export function ContourToolbarPrototype() {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const mainTools = [
    { id: 'brush', icon: Brush, label: 'Brush' },
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'erase', icon: Scissors, label: 'Erase' },
    { id: 'margin', icon: Maximize2, label: 'Margin' },
    { id: 'interactive-tumor', icon: Sparkles, label: 'AI Tumor' }
  ];

  const handleToolClick = (toolId: string) => {
    setActiveTool(activeTool === toolId ? null : toolId);
  };

  // Mock structure color for active state styling
  const structureColorRgb = 'rgb(34, 197, 94)'; // Green color

  return (
    <div className="w-full flex flex-col items-center gap-8 p-8">
      <div className="text-white text-xl font-semibold mb-4">Contour Toolbar Prototype</div>
      
      {/* Contour Toolbar Container */}
      <div className="backdrop-blur-xl border border-gray-600/60 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 bg-gray-950/90 w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: structureColorRgb }} />
            <span className="text-sm font-semibold text-gray-200">Structure Name</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tool Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {mainTools.map((tool) => {
              const IconComponent = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <div key={tool.id} className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToolClick(tool.id)}
                    className={`h-8 px-3 transition-all duration-200 rounded-lg text-gray-300 ${
                      isActive 
                        ? 'text-white border shadow-sm' 
                        : 'hover:bg-gray-700/50 hover:text-white'
                    }`}
                    style={isActive ? { 
                      borderColor: structureColorRgb,
                      backgroundColor: `${structureColorRgb}20`,
                      color: 'white'
                    } : {}}
                  >
                    <IconComponent className="w-4 h-4 mr-2" />
                    <span className="text-sm">{tool.label}</span>
                  </Button>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black bg-opacity-90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {tool.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

