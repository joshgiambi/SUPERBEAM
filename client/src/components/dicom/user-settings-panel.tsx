/**
 * User Settings Panel
 * 
 * Floating overlay panel for user preferences and settings that persist across sessions.
 * Includes contour display settings, library templates, and user profile placeholder.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  X,
  User,
  Settings,
  Palette,
  Library,
  Layers,
  Expand,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

// Storage keys for localStorage
const STORAGE_KEYS = {
  USER_SETTINGS: 'userSettings',
  CONTOUR_SETTINGS: 'contourDisplaySettings',
  BOOLEAN_TEMPLATES: 'booleanPipelineCombinedTemplates',
  MARGIN_TEMPLATES: 'marginOperationsTemplates'
};

// Default user settings
const DEFAULT_USER_SETTINGS = {
  displayName: 'Demo User',
  contourWidth: 2,
  contourOpacity: 10,
  defaultBrushSize: 3,
  autoSavePredictions: true,
  showPredictionOverlay: true,
  showSliceIndicator: true,
  animateContours: false
};

export interface UserSettings {
  displayName: string;
  contourWidth: number;
  contourOpacity: number;
  defaultBrushSize: number;
  autoSavePredictions: boolean;
  showPredictionOverlay: boolean;
  showSliceIndicator: boolean;
  animateContours: boolean;
}

interface UserSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: UserSettings) => void;
  onContourSettingsChange?: (settings: { width: number; opacity: number }) => void;
  initialContourSettings?: { width: number; opacity: number };
}

export function UserSettingsPanel({ 
  isOpen, 
  onClose, 
  onSettingsChange,
  onContourSettingsChange,
  initialContourSettings
}: UserSettingsPanelProps) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['display', 'contours']));
  const [booleanTemplateCount, setBooleanTemplateCount] = useState(0);
  const [marginTemplateCount, setMarginTemplateCount] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_USER_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to load user settings:', e);
      }
    }
    
    // Sync with initial contour settings if provided
    if (initialContourSettings) {
      setSettings(prev => ({
        ...prev,
        contourWidth: initialContourSettings.width,
        contourOpacity: initialContourSettings.opacity
      }));
    }
    
    // Count templates
    countTemplates();
  }, [initialContourSettings]);
  
  // Count stored templates
  const countTemplates = () => {
    try {
      const booleanTemplates = localStorage.getItem(STORAGE_KEYS.BOOLEAN_TEMPLATES);
      const marginTemplates = localStorage.getItem(STORAGE_KEYS.MARGIN_TEMPLATES);
      setBooleanTemplateCount(booleanTemplates ? JSON.parse(booleanTemplates).length : 0);
      setMarginTemplateCount(marginTemplates ? JSON.parse(marginTemplates).length : 0);
    } catch (e) {
      console.error('Failed to count templates:', e);
    }
  };
  
  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
    setHasUnsavedChanges(false);
    
    // Notify parent of contour settings change
    if (onContourSettingsChange) {
      onContourSettingsChange({
        width: settings.contourWidth,
        opacity: settings.contourOpacity
      });
    }
    
    // Notify parent of full settings change
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
  };
  
  // Update a single setting
  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };
  
  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };
  
  // Reset to defaults
  const resetToDefaults = () => {
    setSettings(DEFAULT_USER_SETTINGS);
    setHasUnsavedChanges(true);
  };
  
  // Clear all templates
  const clearBooleanTemplates = () => {
    localStorage.removeItem(STORAGE_KEYS.BOOLEAN_TEMPLATES);
    setBooleanTemplateCount(0);
  };
  
  const clearMarginTemplates = () => {
    localStorage.removeItem(STORAGE_KEYS.MARGIN_TEMPLATES);
    setMarginTemplateCount(0);
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none"
      style={{ paddingTop: '80px', paddingRight: '20px' }}
    >
      {/* Backdrop - clicking closes the panel */}
      <div 
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Settings Panel */}
      <div 
        className="relative w-96 max-h-[calc(100vh-120px)] overflow-hidden rounded-2xl shadow-2xl pointer-events-auto animate-in slide-in-from-right-5 duration-200"
        style={{
          background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.98), rgba(20, 20, 30, 0.98))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{settings.displayName}</h2>
              <p className="text-xs text-gray-400">User Settings</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(100vh-240px)] p-4 space-y-4">
          
          {/* Display Settings Section */}
          <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection('display')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-gray-200">Display Preferences</span>
              </div>
              {expandedSections.has('display') ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('display') && (
              <div className="px-3 pb-3 space-y-3">
                <div className="flex items-center justify-between py-2">
                  <Label className="text-xs text-gray-300">Show Slice Indicator</Label>
                  <Switch
                    checked={settings.showSliceIndicator}
                    onCheckedChange={(checked) => updateSetting('showSliceIndicator', checked)}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <Label className="text-xs text-gray-300">Show Prediction Overlay</Label>
                  <Switch
                    checked={settings.showPredictionOverlay}
                    onCheckedChange={(checked) => updateSetting('showPredictionOverlay', checked)}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <Label className="text-xs text-gray-300">Animate Contours</Label>
                  <Switch
                    checked={settings.animateContours}
                    onCheckedChange={(checked) => updateSetting('animateContours', checked)}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Contour Settings Section */}
          <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection('contours')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-gray-200">Contour Display</span>
              </div>
              {expandedSections.has('contours') ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('contours') && (
              <div className="px-3 pb-3 space-y-4">
                {/* Contour Width */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-300">Contour Width</Label>
                    <span className="text-xs text-indigo-300 font-medium">{settings.contourWidth}px</span>
                  </div>
                  <Slider
                    value={[settings.contourWidth]}
                    onValueChange={([value]) => updateSetting('contourWidth', value)}
                    max={8}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
                
                {/* Contour Opacity/Fill */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-300">Contour Fill Opacity</Label>
                    <span className="text-xs text-indigo-300 font-medium">{settings.contourOpacity}%</span>
                  </div>
                  <Slider
                    value={[settings.contourOpacity]}
                    onValueChange={([value]) => updateSetting('contourOpacity', value)}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>
                
                {/* Default Brush Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-300">Default Brush Size</Label>
                    <span className="text-xs text-indigo-300 font-medium">{settings.defaultBrushSize}px</span>
                  </div>
                  <Slider
                    value={[settings.defaultBrushSize]}
                    onValueChange={([value]) => updateSetting('defaultBrushSize', value)}
                    max={50}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Boolean Library Section */}
          <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection('boolean')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-gray-200">Boolean Templates</span>
                <Badge 
                  variant="secondary" 
                  className="bg-cyan-900/40 text-cyan-300 border-cyan-600/30 text-xs"
                >
                  {booleanTemplateCount}
                </Badge>
              </div>
              {expandedSections.has('boolean') ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('boolean') && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs text-gray-400">
                  Saved boolean operation templates for structure manipulation.
                </p>
                {booleanTemplateCount > 0 ? (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-300">{booleanTemplateCount} template(s) saved</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearBooleanTemplates}
                      className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic pt-1">
                    No templates saved. Create templates in the Boolean Operations panel.
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Margin Library Section */}
          <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection('margin')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Expand className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-gray-200">Margin Templates</span>
                <Badge 
                  variant="secondary" 
                  className="bg-amber-900/40 text-amber-300 border-amber-600/30 text-xs"
                >
                  {marginTemplateCount}
                </Badge>
              </div>
              {expandedSections.has('margin') ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('margin') && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs text-gray-400">
                  Saved margin expansion/contraction presets.
                </p>
                {marginTemplateCount > 0 ? (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-300">{marginTemplateCount} template(s) saved</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearMarginTemplates}
                      className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic pt-1">
                    No templates saved. Create templates in the Margin Operations panel.
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Auto-Save Section */}
          <div className="rounded-xl bg-gray-800/30 border border-gray-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection('autosave')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-gray-200">Auto-Save Options</span>
              </div>
              {expandedSections.has('autosave') ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('autosave') && (
              <div className="px-3 pb-3 space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <Label className="text-xs text-gray-300">Auto-save Predictions</Label>
                    <p className="text-[10px] text-gray-500 mt-0.5">Automatically confirm predicted contours</p>
                  </div>
                  <Switch
                    checked={settings.autoSavePredictions}
                    onCheckedChange={(checked) => updateSetting('autoSavePredictions', checked)}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>
              </div>
            )}
          </div>
          
        </div>
        
        {/* Footer with Save/Reset buttons */}
        <div className="p-4 border-t border-indigo-500/20 bg-gray-900/50">
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={resetToDefaults}
              className="h-8 px-3 text-xs text-gray-400 hover:text-white hover:bg-gray-700/50"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              onClick={saveSettings}
              disabled={!hasUnsavedChanges}
              className={`h-8 px-4 text-xs transition-all ${
                hasUnsavedChanges
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-3 h-3 mr-1" />
              Save Settings
            </Button>
          </div>
          {hasUnsavedChanges && (
            <p className="text-[10px] text-amber-400 mt-2 text-center">
              You have unsaved changes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to load user settings
export function useUserSettings(): UserSettings {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_USER_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to load user settings:', e);
      }
    }
  }, []);
  
  return settings;
}

export default UserSettingsPanel;

