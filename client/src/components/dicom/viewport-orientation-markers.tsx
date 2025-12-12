/**
 * ViewportOrientationMarkers - OHIF-style anatomical orientation markers
 * 
 * Displays anatomical direction labels (L/R/A/P/S/I) on the edges of the viewport
 * based on the current view orientation and camera position.
 * 
 * Adapted from OHIF Viewer ViewportOrientationMarkers pattern.
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export type ViewOrientation = 'axial' | 'sagittal' | 'coronal';

interface OrientationMarkers {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

/**
 * Get orientation markers based on view orientation
 * 
 * Anatomical Directions:
 * - L = Left, R = Right (X axis)
 * - A = Anterior, P = Posterior (Y axis)
 * - S = Superior, I = Inferior (Z axis)
 * 
 * Standard radiological conventions:
 * - Axial: Patient viewed from feet (L on right side of screen)
 * - Sagittal: Patient viewed from left side
 * - Coronal: Patient viewed from front
 */
function getOrientationMarkers(
  orientation: ViewOrientation,
  isFlippedHorizontal: boolean = false,
  isFlippedVertical: boolean = false
): OrientationMarkers {
  let markers: OrientationMarkers;

  switch (orientation) {
    case 'axial':
      // Axial view: Looking down from superior
      // Top = Anterior, Bottom = Posterior, Left = Right, Right = Left
      markers = {
        top: 'A',
        bottom: 'P',
        left: 'R',
        right: 'L',
      };
      break;
    case 'sagittal':
      // Sagittal view: Looking from the right side
      // Top = Superior, Bottom = Inferior, Left = Anterior, Right = Posterior
      markers = {
        top: 'S',
        bottom: 'I',
        left: 'A',
        right: 'P',
      };
      break;
    case 'coronal':
      // Coronal view: Looking from anterior (front)
      // Top = Superior, Bottom = Inferior, Left = Right, Right = Left
      markers = {
        top: 'S',
        bottom: 'I',
        left: 'R',
        right: 'L',
      };
      break;
    default:
      markers = {
        top: '',
        bottom: '',
        left: '',
        right: '',
      };
  }

  // Apply flips
  if (isFlippedHorizontal) {
    const temp = markers.left;
    markers.left = markers.right;
    markers.right = temp;
  }

  if (isFlippedVertical) {
    const temp = markers.top;
    markers.top = markers.bottom;
    markers.bottom = temp;
  }

  return markers;
}

interface ViewportOrientationMarkersProps {
  orientation: ViewOrientation;
  isFlippedHorizontal?: boolean;
  isFlippedVertical?: boolean;
  /** Which markers to show - defaults to ['top', 'left'] like OHIF */
  showMarkers?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string;
  /** Use light text for dark backgrounds, dark text for light backgrounds */
  isLightBackground?: boolean;
}

/**
 * ViewportOrientationMarkers - Anatomical direction labels
 */
export function ViewportOrientationMarkers({
  orientation,
  isFlippedHorizontal = false,
  isFlippedVertical = false,
  showMarkers = ['top', 'left'],
  className,
  isLightBackground = false,
}: ViewportOrientationMarkersProps) {
  const markers = useMemo(
    () => getOrientationMarkers(orientation, isFlippedHorizontal, isFlippedVertical),
    [orientation, isFlippedHorizontal, isFlippedVertical]
  );

  const textColorClass = isLightBackground 
    ? 'text-neutral-700/70' 
    : 'text-white/70';

  const shadowClass = isLightBackground
    ? 'drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]'
    : 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]';

  const markerBaseClass = cn(
    'absolute text-[13px] font-bold leading-none select-none pointer-events-none',
    textColorClass,
    shadowClass,
    className
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Top marker - centered horizontally */}
      {showMarkers.includes('top') && markers.top && (
        <div className={cn(markerBaseClass, 'top-1.5 left-1/2 -translate-x-1/2')}>
          {markers.top}
        </div>
      )}

      {/* Bottom marker - centered horizontally */}
      {showMarkers.includes('bottom') && markers.bottom && (
        <div className={cn(markerBaseClass, 'bottom-1.5 left-1/2 -translate-x-1/2')}>
          {markers.bottom}
        </div>
      )}

      {/* Left marker - centered vertically */}
      {showMarkers.includes('left') && markers.left && (
        <div className={cn(markerBaseClass, 'left-1.5 top-1/2 -translate-y-1/2')}>
          {markers.left}
        </div>
      )}

      {/* Right marker - centered vertically (offset for scrollbar) */}
      {showMarkers.includes('right') && markers.right && (
        <div className={cn(markerBaseClass, 'right-5 top-1/2 -translate-y-1/2')}>
          {markers.right}
        </div>
      )}
    </div>
  );
}

/**
 * Compact orientation indicator for viewport header
 * Uses harmonized colors matching application design (indigo/purple theme)
 */
interface OrientationBadgeProps {
  orientation: ViewOrientation;
  className?: string;
}

export function OrientationBadge({ orientation, className }: OrientationBadgeProps) {
  // Color scheme aligned with app's indigo/purple theme
  const config = {
    axial: { label: 'AX', color: 'bg-indigo-500/70 text-indigo-100 border-indigo-400/50' },
    sagittal: { label: 'SAG', color: 'bg-amber-500/70 text-amber-100 border-amber-400/50' },
    coronal: { label: 'COR', color: 'bg-emerald-500/70 text-emerald-100 border-emerald-400/50' },
  }[orientation] || { label: orientation.toUpperCase().slice(0, 3), color: 'bg-gray-500/70 text-gray-100 border-gray-400/50' };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center backdrop-blur-sm',
        'px-1.5 py-0.5 text-[9px] font-bold rounded border',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}

