/**
 * Fusion Layout Persistence Service
 * 
 * Manages saving, loading, and bookmarking of fusion layout configurations.
 * Persists to localStorage with study-specific and global user preferences.
 */

import type { FusionLayoutPreset } from '@/components/dicom/fusion-control-panel-v2';

// ============================================================================
// TYPES
// ============================================================================

export interface ViewportLayoutConfig {
  id: string;
  seriesId: number;
  isPrimary: boolean;
  showStructures: boolean;
  showMPR: boolean;
}

export interface FusionLayoutBookmark {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // Layout configuration
  layoutPreset: FusionLayoutPreset;
  viewports: ViewportLayoutConfig[];
  fusionOpacity: number;
  // Sync state (optional - for restoring exact view)
  syncState?: {
    sliceIndex: number;
    zoom: number;
    panX: number;
    panY: number;
    windowLevel: { width: number; level: number };
  };
  // Context (which study/patient this was created for)
  studyId?: number;
  patientId?: string;
  isGlobal: boolean; // If true, applies to all studies
}

export interface UserLayoutPreferences {
  // Default layout when entering fusion mode
  defaultLayout: FusionLayoutPreset;
  // Remember last used layout per study
  rememberPerStudy: boolean;
  // Last used layouts by study ID
  lastUsedLayouts: Map<number, FusionLayoutPreset>;
  // User's bookmarked layouts
  bookmarks: FusionLayoutBookmark[];
  // Auto-save layout changes
  autoSave: boolean;
}

const STORAGE_KEY = 'converge_fusion_layout_prefs';
const BOOKMARKS_KEY = 'converge_fusion_layout_bookmarks';

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_PREFERENCES: UserLayoutPreferences = {
  defaultLayout: 'overlay',
  rememberPerStudy: true,
  lastUsedLayouts: new Map(),
  bookmarks: [],
  autoSave: true,
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function serializePreferences(prefs: UserLayoutPreferences): string {
  return JSON.stringify({
    ...prefs,
    lastUsedLayouts: Array.from(prefs.lastUsedLayouts.entries()),
  });
}

function deserializePreferences(data: string): UserLayoutPreferences {
  try {
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      lastUsedLayouts: new Map(parsed.lastUsedLayouts || []),
      bookmarks: parsed.bookmarks || [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

class FusionLayoutService {
  private preferences: UserLayoutPreferences;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.preferences = this.loadPreferences();
  }

  // --------------------------------------------------------------------------
  // Preferences Management
  // --------------------------------------------------------------------------

  private loadPreferences(): UserLayoutPreferences {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return deserializePreferences(stored);
      }
    } catch (e) {
      console.warn('Failed to load fusion layout preferences:', e);
    }
    return DEFAULT_PREFERENCES;
  }

  private savePreferences(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, serializePreferences(this.preferences));
      this.notifyListeners();
    } catch (e) {
      console.warn('Failed to save fusion layout preferences:', e);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --------------------------------------------------------------------------
  // Layout Preferences
  // --------------------------------------------------------------------------

  getDefaultLayout(): FusionLayoutPreset {
    return this.preferences.defaultLayout;
  }

  setDefaultLayout(layout: FusionLayoutPreset): void {
    this.preferences.defaultLayout = layout;
    this.savePreferences();
  }

  getLayoutForStudy(studyId: number): FusionLayoutPreset {
    if (this.preferences.rememberPerStudy) {
      const lastUsed = this.preferences.lastUsedLayouts.get(studyId);
      if (lastUsed) return lastUsed;
    }
    return this.preferences.defaultLayout;
  }

  setLayoutForStudy(studyId: number, layout: FusionLayoutPreset): void {
    this.preferences.lastUsedLayouts.set(studyId, layout);
    if (this.preferences.autoSave) {
      this.savePreferences();
    }
  }

  // --------------------------------------------------------------------------
  // Bookmarks
  // --------------------------------------------------------------------------

  getBookmarks(): FusionLayoutBookmark[] {
    return [...this.preferences.bookmarks];
  }

  getGlobalBookmarks(): FusionLayoutBookmark[] {
    return this.preferences.bookmarks.filter(b => b.isGlobal);
  }

  getStudyBookmarks(studyId: number): FusionLayoutBookmark[] {
    return this.preferences.bookmarks.filter(
      b => b.isGlobal || b.studyId === studyId
    );
  }

  createBookmark(
    name: string,
    config: {
      layoutPreset: FusionLayoutPreset;
      viewports: ViewportLayoutConfig[];
      fusionOpacity: number;
      syncState?: FusionLayoutBookmark['syncState'];
      studyId?: number;
      patientId?: string;
      isGlobal?: boolean;
      description?: string;
    }
  ): FusionLayoutBookmark {
    const bookmark: FusionLayoutBookmark = {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: config.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layoutPreset: config.layoutPreset,
      viewports: config.viewports,
      fusionOpacity: config.fusionOpacity,
      syncState: config.syncState,
      studyId: config.studyId,
      patientId: config.patientId,
      isGlobal: config.isGlobal ?? false,
    };

    this.preferences.bookmarks.push(bookmark);
    this.savePreferences();
    return bookmark;
  }

  updateBookmark(
    bookmarkId: string,
    updates: Partial<Omit<FusionLayoutBookmark, 'id' | 'createdAt'>>
  ): FusionLayoutBookmark | null {
    const index = this.preferences.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) return null;

    this.preferences.bookmarks[index] = {
      ...this.preferences.bookmarks[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.savePreferences();
    return this.preferences.bookmarks[index];
  }

  deleteBookmark(bookmarkId: string): boolean {
    const index = this.preferences.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) return false;

    this.preferences.bookmarks.splice(index, 1);
    this.savePreferences();
    return true;
  }

  // --------------------------------------------------------------------------
  // Quick Access Layouts (Recent)
  // --------------------------------------------------------------------------

  getRecentLayouts(limit: number = 5): FusionLayoutPreset[] {
    const entries = Array.from(this.preferences.lastUsedLayouts.entries());
    // Get unique layouts, most recent first
    const unique = new Set<FusionLayoutPreset>();
    entries.reverse().forEach(([, layout]) => unique.add(layout));
    return Array.from(unique).slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------------

  getSettings(): Pick<UserLayoutPreferences, 'rememberPerStudy' | 'autoSave'> {
    return {
      rememberPerStudy: this.preferences.rememberPerStudy,
      autoSave: this.preferences.autoSave,
    };
  }

  updateSettings(settings: Partial<Pick<UserLayoutPreferences, 'rememberPerStudy' | 'autoSave'>>): void {
    if (settings.rememberPerStudy !== undefined) {
      this.preferences.rememberPerStudy = settings.rememberPerStudy;
    }
    if (settings.autoSave !== undefined) {
      this.preferences.autoSave = settings.autoSave;
    }
    this.savePreferences();
  }

  // --------------------------------------------------------------------------
  // Export/Import
  // --------------------------------------------------------------------------

  exportBookmarks(): string {
    return JSON.stringify(this.preferences.bookmarks, null, 2);
  }

  importBookmarks(data: string, merge: boolean = true): number {
    try {
      const imported = JSON.parse(data) as FusionLayoutBookmark[];
      if (!Array.isArray(imported)) throw new Error('Invalid bookmark data');

      if (merge) {
        // Add only bookmarks with unique IDs
        const existingIds = new Set(this.preferences.bookmarks.map(b => b.id));
        const newBookmarks = imported.filter(b => !existingIds.has(b.id));
        this.preferences.bookmarks.push(...newBookmarks);
        this.savePreferences();
        return newBookmarks.length;
      } else {
        this.preferences.bookmarks = imported;
        this.savePreferences();
        return imported.length;
      }
    } catch (e) {
      console.error('Failed to import bookmarks:', e);
      return 0;
    }
  }

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  resetToDefaults(): void {
    this.preferences = { ...DEFAULT_PREFERENCES, lastUsedLayouts: new Map(), bookmarks: [] };
    this.savePreferences();
  }
}

// Singleton instance
export const fusionLayoutService = new FusionLayoutService();

// React hook for using the service
export function useFusionLayoutService() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return fusionLayoutService.subscribe(() => forceUpdate({}));
  }, []);

  return fusionLayoutService;
}

// Need to import useState and useEffect
import { useState, useEffect } from 'react';


