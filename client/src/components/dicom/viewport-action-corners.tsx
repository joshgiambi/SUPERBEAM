import React from 'react';
import { cn } from '@/lib/utils';

/**
 * ViewportActionCorners - Compound component for positioning UI elements
 * in the corners of a viewport, similar to OHIF's overlay pattern.
 */

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

interface CornerProps {
  children: React.ReactNode;
  className?: string;
}

// Container - wraps the viewport and provides positioning context
const Container: React.FC<ContainerProps> = ({ children, className }) => {
  return (
    <div className={cn('relative w-full h-full flex flex-col', className)}>
      {children}
    </div>
  );
};

// BottomLeft - positioned absolutely at the bottom left corner
const BottomLeft: React.FC<CornerProps> = ({ children, className }) => {
  return (
    <div 
      className={cn(
        'absolute bottom-2 left-2 z-20 pointer-events-none',
        '[&>*]:pointer-events-auto',
        className
      )}
    >
      {children}
    </div>
  );
};

// BottomRight - positioned absolutely at the bottom right corner
const BottomRight: React.FC<CornerProps> = ({ children, className }) => {
  return (
    <div 
      className={cn(
        'absolute bottom-2 right-2 z-20 pointer-events-none',
        '[&>*]:pointer-events-auto',
        className
      )}
    >
      {children}
    </div>
  );
};

// TopLeft - positioned absolutely at the top left corner
const TopLeft: React.FC<CornerProps> = ({ children, className }) => {
  return (
    <div 
      className={cn(
        'absolute top-2 left-2 z-20 pointer-events-none',
        '[&>*]:pointer-events-auto',
        className
      )}
    >
      {children}
    </div>
  );
};

// TopRight - positioned absolutely at the top right corner
const TopRight: React.FC<CornerProps> = ({ children, className }) => {
  return (
    <div 
      className={cn(
        'absolute top-2 right-2 z-20 pointer-events-none',
        '[&>*]:pointer-events-auto',
        className
      )}
    >
      {children}
    </div>
  );
};

// Export as compound component
export const ViewportActionCorners = {
  Container,
  BottomLeft,
  BottomRight,
  TopLeft,
  TopRight,
};


