import { BehaviorSubject } from 'rxjs';
import { useState, useEffect } from 'react';

export interface ToolState {
  activeTool: string | null;
  toolProperties: Record<string, any>; // brushSize, etc.
  isActive: boolean; // Whether tools are generally active for this viewport
}

export interface GlobalToolState {
  defaultTool: string;
  globalProperties: Record<string, any>;
}

class ToolStateManager {
  // Map of viewportId -> ToolState
  private viewportToolStates = new Map<string, BehaviorSubject<ToolState>>();
  
  // Global tool state (defaults)
  private globalToolState = new BehaviorSubject<GlobalToolState>({
    defaultTool: 'Pan',
    globalProperties: {
      brushSize: 20,
      windowLevel: { window: 400, level: 40 }
    }
  });

  // Get or create state subject for a viewport
  private getViewportSubject(viewportId: string): BehaviorSubject<ToolState> {
    if (!this.viewportToolStates.has(viewportId)) {
      const global = this.globalToolState.value;
      this.viewportToolStates.set(viewportId, new BehaviorSubject<ToolState>({
        activeTool: global.defaultTool,
        toolProperties: { ...global.globalProperties },
        isActive: false
      }));
    }
    return this.viewportToolStates.get(viewportId)!;
  }

  // Set active tool for a specific viewport
  setActiveTool(viewportId: string, toolName: string) {
    const subject = this.getViewportSubject(viewportId);
    const current = subject.value;
    subject.next({
      ...current,
      activeTool: toolName,
      isActive: true
    });
  }

  // Set tool property for a specific viewport
  setToolProperty(viewportId: string, key: string, value: any) {
    const subject = this.getViewportSubject(viewportId);
    const current = subject.value;
    subject.next({
      ...current,
      toolProperties: {
        ...current.toolProperties,
        [key]: value
      }
    });
  }

  // Get current state for a viewport
  getToolState(viewportId: string): ToolState {
    return this.getViewportSubject(viewportId).value;
  }

  // Subscribe to changes for a specific viewport
  subscribe(viewportId: string, callback: (state: ToolState) => void) {
    const subject = this.getViewportSubject(viewportId);
    const subscription = subject.subscribe(callback);
    return () => subscription.unsubscribe();
  }

  // Reset a viewport's tool state to defaults
  resetViewport(viewportId: string) {
    const global = this.globalToolState.value;
    const subject = this.getViewportSubject(viewportId);
    subject.next({
      activeTool: global.defaultTool,
      toolProperties: { ...global.globalProperties },
      isActive: false
    });
  }
}

export const toolStateManager = new ToolStateManager();

// React Hook
export function useViewportToolState(viewportId: string) {
  const [toolState, setToolState] = useState<ToolState>(
    toolStateManager.getToolState(viewportId)
  );

  useEffect(() => {
    return toolStateManager.subscribe(viewportId, setToolState);
  }, [viewportId]);

  return {
    toolState,
    setActiveTool: (toolName: string) => toolStateManager.setActiveTool(viewportId, toolName),
    setToolProperty: (key: string, value: any) => toolStateManager.setToolProperty(viewportId, key, value),
    resetTools: () => toolStateManager.resetViewport(viewportId)
  };
}

