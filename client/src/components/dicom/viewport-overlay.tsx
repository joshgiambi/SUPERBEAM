/**
 * ViewportOverlay - OHIF-style overlay for displaying viewport metadata
 * 
 * Displays information at the corners of viewports including:
 * - Patient/Series info (top-left)
 * - Window/Level values (bottom-left)
 * - Zoom level (bottom-left)
 * - Slice position/instance number (bottom-right)
 * 
 * Adapted from OHIF Viewer CustomizableViewportOverlay pattern.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface ViewportOverlayProps {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  bottomLeft?: React.ReactNode;
  bottomRight?: React.ReactNode;
  color?: string;
  className?: string;
}

/**
 * ViewportOverlay - Container for corner overlay content
 */
export function ViewportOverlay({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  color = 'text-white/90',
  className,
}: ViewportOverlayProps) {
  const cornerClass = cn(
    'pointer-events-none absolute select-none',
    'text-[11px] font-mono leading-tight',
    color,
    // Text shadow for readability on various backgrounds
    'drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]',
    className
  );

  return (
    <>
      {topLeft && (
        <div className={cn(cornerClass, 'top-2 left-2')}>
          {topLeft}
        </div>
      )}
      {topRight && (
        <div className={cn(cornerClass, 'top-2 right-5')}>
          {topRight}
        </div>
      )}
      {bottomLeft && (
        <div className={cn(cornerClass, 'bottom-2 left-2')}>
          {bottomLeft}
        </div>
      )}
      {bottomRight && (
        <div className={cn(cornerClass, 'bottom-2 right-5')}>
          {bottomRight}
        </div>
      )}
    </>
  );
}

// --- Individual overlay item components ---

interface OverlayItemProps {
  label?: string;
  value: string | number | null | undefined;
  color?: string;
  className?: string;
}

/**
 * Generic overlay item with optional label
 */
export function OverlayItem({ label, value, color, className }: OverlayItemProps) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  return (
    <div className={cn('flex items-center gap-1', className)} style={{ color }}>
      {label && <span className="opacity-70">{label}</span>}
      <span>{value}</span>
    </div>
  );
}

interface WindowLevelOverlayProps {
  windowWidth: number | null;
  windowCenter: number | null;
  className?: string;
}

/**
 * Window/Level overlay item (W: xxx L: xxx format)
 */
export function WindowLevelOverlay({ windowWidth, windowCenter, className }: WindowLevelOverlayProps) {
  if (typeof windowCenter !== 'number' || typeof windowWidth !== 'number') {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span>
        <span className="opacity-70">W:</span>
        <span className="ml-0.5">{Math.round(windowWidth)}</span>
      </span>
      <span>
        <span className="opacity-70">L:</span>
        <span className="ml-0.5">{Math.round(windowCenter)}</span>
      </span>
    </div>
  );
}

interface ZoomOverlayProps {
  scale: number;
  className?: string;
}

/**
 * Zoom level overlay item
 */
export function ZoomOverlay({ scale, className }: ZoomOverlayProps) {
  if (!scale || scale <= 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center', className)}>
      <span className="opacity-70">Zoom:</span>
      <span className="ml-1">{scale.toFixed(2)}x</span>
    </div>
  );
}

interface SliceOverlayProps {
  currentSlice: number;
  totalSlices: number;
  instanceNumber?: number | null;
  sliceLocation?: number | null;
  sliceThickness?: number | null;
  className?: string;
}

/**
 * Slice position overlay item (shows instance number and slice count)
 */
export function SliceOverlay({ 
  currentSlice, 
  totalSlices, 
  instanceNumber, 
  sliceLocation,
  sliceThickness,
  className 
}: SliceOverlayProps) {
  return (
    <div className={cn('flex flex-col items-end gap-0.5', className)}>
      {/* Slice position */}
      <div className="flex items-center">
        {instanceNumber !== undefined && instanceNumber !== null ? (
          <>
            <span className="opacity-70">I:</span>
            <span className="ml-0.5">{instanceNumber}</span>
            <span className="ml-1 opacity-60">
              ({currentSlice + 1}/{totalSlices})
            </span>
          </>
        ) : (
          <span>{currentSlice + 1}/{totalSlices}</span>
        )}
      </div>
      
      {/* Slice location (Z position) */}
      {sliceLocation !== undefined && sliceLocation !== null && (
        <div className="flex items-center text-[10px] opacity-80">
          <span className="opacity-70">Z:</span>
          <span className="ml-0.5">{sliceLocation.toFixed(1)} mm</span>
        </div>
      )}
      
      {/* Slice thickness */}
      {sliceThickness !== undefined && sliceThickness !== null && sliceThickness > 0 && (
        <div className="flex items-center text-[10px] opacity-80">
          <span className="opacity-70">Th:</span>
          <span className="ml-0.5">{sliceThickness.toFixed(1)} mm</span>
        </div>
      )}
    </div>
  );
}

interface PatientInfoOverlayProps {
  patientName?: string | null;
  patientId?: string | null;
  studyDate?: string | null;
  seriesDescription?: string | null;
  modality?: string | null;
  className?: string;
}

/**
 * Patient/Series info overlay (top-left corner typically)
 */
export function PatientInfoOverlay({
  patientName,
  patientId,
  studyDate,
  seriesDescription,
  modality,
  className,
}: PatientInfoOverlayProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      // Handle DICOM date format (YYYYMMDD)
      if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {patientName && (
        <div className="font-semibold text-[12px]">{patientName}</div>
      )}
      {patientId && (
        <div className="opacity-80 text-[10px]">ID: {patientId}</div>
      )}
      {studyDate && (
        <div className="opacity-80 text-[10px]">{formatDate(studyDate)}</div>
      )}
      {(modality || seriesDescription) && (
        <div className="opacity-80 text-[10px] max-w-[180px] truncate">
          {modality && <span className="font-medium">{modality}</span>}
          {modality && seriesDescription && ' - '}
          {seriesDescription}
        </div>
      )}
    </div>
  );
}

interface OrientationLabelProps {
  orientation: 'axial' | 'sagittal' | 'coronal' | string;
  className?: string;
}

/**
 * Orientation label (Axial/Sagittal/Coronal)
 */
export function OrientationLabel({ orientation, className }: OrientationLabelProps) {
  const label = {
    axial: 'AXIAL',
    sagittal: 'SAGITTAL',
    coronal: 'CORONAL',
  }[orientation.toLowerCase()] || orientation.toUpperCase();

  const colorClass = {
    axial: 'text-cyan-400',
    sagittal: 'text-yellow-400',
    coronal: 'text-green-400',
  }[orientation.toLowerCase()] || 'text-white';

  return (
    <div 
      className={cn(
        'text-[11px] font-bold tracking-wider',
        colorClass,
        className
      )}
    >
      {label}
    </div>
  );
}

