/**
 * Color Picker Popover Component
 * 
 * A styled color picker with preset color swatches and custom color input.
 * Matches the Aurora V4 design language.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown, Check, Palette } from 'lucide-react';

// ============================================================================
// PREDEFINED STRUCTURE COLORS (Medical/RT Standard)
// ============================================================================

const PRESET_COLORS = [
  '#FF0000', '#FF6B6B', '#FF8C00', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF69B4',
  '#E74C3C', '#F39C12', '#27AE60', '#3498DB', '#8E44AD', '#E91E63', '#00BCD4', '#CDDC39',
  '#C0392B', '#D35400', '#16A085', '#2980B9', '#7B1FA2', '#AD1457', '#0097A7', '#689F38',
  '#FFCDD2', '#FFE0B2', '#C8E6C9', '#B3E5FC', '#E1BEE7', '#F8BBD9', '#B2EBF2', '#DCEDC8',
];

// ============================================================================
// COLOR PICKER POPOVER COMPONENT
// ============================================================================

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  accentHue?: number;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  /** Compact mode shows just the color swatch without label */
  compact?: boolean;
  /** Size of the color swatch */
  swatchSize?: 'sm' | 'md' | 'lg';
  /** Class name for the trigger button */
  triggerClassName?: string;
}

export function ColorPickerPopover({ 
  color, 
  onChange, 
  label = 'Color', 
  accentHue = 210,
  side = 'top',
  align = 'start',
  sideOffset = 8,
  compact = false,
  swatchSize = 'md',
  triggerClassName,
}: ColorPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(color);

  useEffect(() => {
    setCustomColor(color);
  }, [color]);

  const handlePresetClick = (preset: string) => {
    onChange(preset);
    setIsOpen(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  const swatchSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg transition-all hover:bg-white/10 group",
            compact ? "h-7 px-1.5" : "h-7 px-2",
            triggerClassName
          )}
          style={{
            background: isOpen ? `hsla(${accentHue}, 20%, 20%, 0.5)` : 'transparent',
            border: `1px solid ${isOpen ? `hsla(${accentHue}, 60%, 50%, 0.4)` : 'rgba(255,255,255,0.15)'}`,
          }}
        >
          <div 
            className={cn(
              "rounded-md border border-white/30 shadow-inner transition-transform group-hover:scale-105",
              swatchSizes[swatchSize]
            )}
            style={{ 
              backgroundColor: color,
              boxShadow: `0 0 8px -2px ${color}60, inset 0 1px 2px rgba(255,255,255,0.1)`,
            }}
          />
          {!compact && (
            <>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</span>
              <ChevronDown className={cn("w-3 h-3 text-gray-500 transition-transform", isOpen && "rotate-180")} />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 bg-transparent border-0 shadow-none z-[100]"
        side={side}
        sideOffset={sideOffset}
        align={align}
      >
        <motion.div
          initial={{ opacity: 0, y: side === 'top' ? 8 : -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: side === 'top' ? 8 : -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl overflow-hidden backdrop-blur-xl"
          style={{
            background: `linear-gradient(180deg, hsla(${accentHue}, 15%, 12%, 0.98) 0%, hsla(${accentHue}, 10%, 8%, 0.99) 100%)`,
            boxShadow: `0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px -15px ${color}30`,
          }}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-300">Choose Color</span>
            </div>
            <div 
              className="w-6 h-6 rounded-md border border-white/20"
              style={{ backgroundColor: color }}
            />
          </div>

          {/* Preset Colors Grid */}
          <div className="p-3">
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-7 h-7 rounded-md border transition-all hover:scale-110 hover:z-10 relative",
                    color.toLowerCase() === preset.toLowerCase()
                      ? "border-white ring-2 ring-white/30 scale-105"
                      : "border-white/20 hover:border-white/40"
                  )}
                  style={{ 
                    backgroundColor: preset,
                    boxShadow: color.toLowerCase() === preset.toLowerCase() 
                      ? `0 0 12px -2px ${preset}80` 
                      : `0 2px 4px -2px rgba(0,0,0,0.4)`,
                  }}
                  title={preset}
                >
                  {color.toLowerCase() === preset.toLowerCase() && (
                    <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Color Section */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.06]">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomChange}
                className="w-8 h-8 rounded-md cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/30"
              />
              <div className="flex-1">
                <Input
                  value={customColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setCustomColor(val);
                      if (val.length === 7) onChange(val);
                    }
                  }}
                  className="h-7 px-2 text-xs font-mono bg-white/5 border-white/10 text-white rounded-md uppercase"
                  placeholder="#FFFFFF"
                />
              </div>
              <span className="text-[9px] text-gray-500 uppercase">Custom</span>
            </div>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// INLINE COLOR SWATCH (for use in dialogs/forms)
// ============================================================================

interface ColorSwatchInputProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorSwatchInput({ color, onChange, className }: ColorSwatchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(color);

  useEffect(() => {
    setCustomColor(color);
  }, [color]);

  const handlePresetClick = (preset: string) => {
    onChange(preset);
    setIsOpen(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg transition-all border cursor-pointer group",
            "bg-gray-800/50 border-gray-600/50 hover:bg-gray-800/70 hover:border-gray-500/50",
            className
          )}
        >
          <div 
            className="w-8 h-8 rounded-lg border-2 border-white/30 shadow-lg transition-transform group-hover:scale-105"
            style={{ 
              backgroundColor: color,
              boxShadow: `0 0 12px -2px ${color}60, inset 0 1px 2px rgba(255,255,255,0.1)`,
            }}
          />
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-400">Selected</span>
            <span className="text-sm font-mono text-white uppercase">{color}</span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-gray-500 ml-auto transition-transform", isOpen && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 bg-transparent border-0 shadow-none z-[100]"
        side="bottom"
        sideOffset={8}
        align="start"
      >
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl overflow-hidden backdrop-blur-xl"
          style={{
            background: `linear-gradient(180deg, hsla(210, 15%, 12%, 0.98) 0%, hsla(210, 10%, 8%, 0.99) 100%)`,
            boxShadow: `0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px -15px ${color}30`,
          }}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-300">Choose Color</span>
            </div>
            <div 
              className="w-6 h-6 rounded-md border border-white/20"
              style={{ backgroundColor: color }}
            />
          </div>

          {/* Preset Colors Grid */}
          <div className="p-3">
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-7 h-7 rounded-md border transition-all hover:scale-110 hover:z-10 relative",
                    color.toLowerCase() === preset.toLowerCase()
                      ? "border-white ring-2 ring-white/30 scale-105"
                      : "border-white/20 hover:border-white/40"
                  )}
                  style={{ 
                    backgroundColor: preset,
                    boxShadow: color.toLowerCase() === preset.toLowerCase() 
                      ? `0 0 12px -2px ${preset}80` 
                      : `0 2px 4px -2px rgba(0,0,0,0.4)`,
                  }}
                  title={preset}
                >
                  {color.toLowerCase() === preset.toLowerCase() && (
                    <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Color Section */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.06]">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomChange}
                className="w-8 h-8 rounded-md cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/30"
              />
              <div className="flex-1">
                <Input
                  value={customColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setCustomColor(val);
                      if (val.length === 7) onChange(val);
                    }
                  }}
                  className="h-7 px-2 text-xs font-mono bg-white/5 border-white/10 text-white rounded-md uppercase"
                  placeholder="#FFFFFF"
                />
              </div>
              <span className="text-[9px] text-gray-500 uppercase">Custom</span>
            </div>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
