/**
 * useViewportHover - Hook to track viewport hover and active states
 * 
 * Adapted from OHIF Viewer useViewportHover pattern. Tracks whether the mouse
 * is hovering over a specific viewport element and whether it's the active viewport.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface UseViewportHoverOptions {
  /** Element ref or selector to track */
  elementRef?: React.RefObject<HTMLElement>;
  /** Viewport ID for data-attribute based selection */
  viewportId?: string;
  /** Whether this viewport is currently active/selected */
  isActive?: boolean;
  /** Debounce time for mouse events (ms) */
  debounce?: number;
}

interface UseViewportHoverReturn {
  /** Whether mouse is currently over the viewport */
  isHovered: boolean;
  /** Whether viewport is active/selected */
  isActive: boolean;
  /** Whether to show action controls (hovered OR active) */
  shouldShowControls: boolean;
}

/**
 * Hook to track whether the mouse is hovering over a viewport
 * and whether the viewport is active
 *
 * @param options - Configuration options
 * @returns { isHovered, isActive, shouldShowControls }
 */
export function useViewportHover(options: UseViewportHoverOptions = {}): UseViewportHoverReturn {
  const { 
    elementRef, 
    viewportId, 
    isActive: externalIsActive = false,
    debounce = 10 
  } = options;
  
  const [isHovered, setIsHovered] = useState(false);
  const lastIsInsideRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setupListeners = useCallback(() => {
    // Find the element to track
    let element: HTMLElement | null = null;
    
    if (elementRef?.current) {
      element = elementRef.current;
    } else if (viewportId) {
      const viewportElement = document.querySelector(`[data-viewport-id="${viewportId}"]`);
      element = (viewportElement?.closest('.viewport-pane') || viewportElement) as HTMLElement;
    }

    if (!element) {
      return null;
    }

    let elementRect = element.getBoundingClientRect();

    // Update rectangle when window is resized
    const updateRect = () => {
      if (element) {
        elementRect = element.getBoundingClientRect();
      }
    };

    const isPointInViewport = (x: number, y: number) => {
      return (
        x >= elementRect.left &&
        x <= elementRect.right &&
        y >= elementRect.top &&
        y <= elementRect.bottom
      );
    };

    const handleMouseMove = (event: MouseEvent) => {
      const isInside = isPointInViewport(event.clientX, event.clientY);

      if (isInside !== lastIsInsideRef.current) {
        lastIsInsideRef.current = isInside;
        setIsHovered(isInside);
      }
    };

    const handleResize = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(updateRect, debounce);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousemove', handleMouseMove);

    // Initial rect calculation
    updateRect();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [elementRef, viewportId, debounce]);

  useEffect(() => {
    const cleanup = setupListeners();
    return () => {
      cleanup?.();
    };
  }, [setupListeners]);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(() => ({
    isHovered,
    isActive: externalIsActive,
    shouldShowControls: isHovered || externalIsActive,
  }), [isHovered, externalIsActive]);
}

/**
 * Simplified hook for use with a ref - preferred method
 */
export function useViewportHoverRef(
  ref: React.RefObject<HTMLElement>,
  isActive: boolean = false
): UseViewportHoverReturn {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [ref]);

  return useMemo(() => ({
    isHovered,
    isActive,
    shouldShowControls: isHovered || isActive,
  }), [isHovered, isActive]);
}

