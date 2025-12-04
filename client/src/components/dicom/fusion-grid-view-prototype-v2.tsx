/**
 * Fusion Grid View Prototype V2
 * 
 * Robust implementation with:
 * - Clear layered stack of cards underneath secondary canvas
 * - Physics-based animations using framer-motion
 * - Drag and drop with visual feedback
 * - Adaptive grid layout
 * 
 * Inspired by react-spring card deck demo
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Maximize2, X, GripVertical } from 'lucide-react';

interface CanvasItem {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'stacked';
  isStacked: boolean;
  stackIndex?: number;
  gridPosition?: { row: number; col: number };
}

const STACKED_CARDS = [
  { id: 'stacked-1', label: 'MRI T1', stackIndex: 0 },
  { id: 'stacked-2', label: 'MRI T2', stackIndex: 1 },
  { id: 'stacked-3', label: 'CT Contrast', stackIndex: 2 },
];

export function FusionGridViewPrototypeV2() {
  const [layoutMode, setLayoutMode] = useState<'normal' | 'expanded'>('normal');
  const [hoveredStackIndex, setHoveredStackIndex] = useState<number | null>(null);
  const [draggedCanvasId, setDraggedCanvasId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [dropPreviewPosition, setDropPreviewPosition] = useState<{ row: number; col: number } | null>(null);
  const [expandedCanvases, setExpandedCanvases] = useState<string[]>([]);
  
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([
    { id: 'primary-ct', label: 'Planning CT', type: 'primary', isStacked: false, gridPosition: { row: 0, col: 0 } },
    { id: 'secondary-1', label: 'PET Scan', type: 'secondary', isStacked: false, gridPosition: { row: 0, col: 1 } },
    ...STACKED_CARDS.map(card => ({
      id: card.id,
      label: card.label,
      type: 'stacked' as const,
      isStacked: true,
      stackIndex: card.stackIndex
    }))
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const secondaryCellRef = useRef<HTMLDivElement>(null);
  const stackContainerRef = useRef<HTMLDivElement>(null);

  // Calculate layout - adapts dynamically based on number of grid items
  const layout = (() => {
    const gridItems = canvasItems.filter(c => c.gridPosition !== undefined);
    const totalVisible = layoutMode === 'expanded' 
      ? canvasItems.length 
      : gridItems.length;
    
    // Adaptive grid: up to 3 columns, rows grow as needed
    const cols = Math.min(3, totalVisible);
    const rows = Math.ceil(totalVisible / cols);
    
    return { cols, rows };
  })();

  // Calculate drop position
  const calculateDropPosition = useCallback((x: number, y: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 24;
    const cellWidth = (rect.width - padding * 2) / layout.cols;
    const cellHeight = (rect.height - padding * 2) / layout.rows;
    const col = Math.floor((x - rect.left - padding) / cellWidth);
    const row = Math.floor((y - rect.top - padding) / cellHeight);
    return {
      row: Math.max(0, Math.min(row, layout.rows - 1)),
      col: Math.max(0, Math.min(col, layout.cols - 1))
    };
  }, [layout]);

  // Drag handlers - now supports all canvas types
  const handleDragStart = useCallback((e: React.MouseEvent, canvasId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedCanvasId(canvasId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragCurrentPos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!draggedCanvasId || !dragStartPos) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      setDragCurrentPos({ x: e.clientX, y: e.clientY });
      const dropPos = calculateDropPosition(e.clientX, e.clientY);
      if (dropPos) setDropPreviewPosition(dropPos);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const currentPos = { x: e.clientX, y: e.clientY };
      if (draggedCanvasId && dragStartPos) {
        const deltaX = currentPos.x - dragStartPos.x;
        const deltaY = currentPos.y - dragStartPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 30) {
          const draggedItem = canvasItems.find(c => c.id === draggedCanvasId);
          const isStackedCard = draggedItem?.isStacked;
          
          // Find the target grid position
          setCanvasItems(prev => {
            const findTargetPosition = () => {
              // Get currently occupied positions (excluding the dragged item)
              const occupied = new Map<string, CanvasItem>();
              prev.forEach(item => {
                if (item.id !== draggedCanvasId && item.gridPosition) {
                  const key = `${item.gridPosition.row},${item.gridPosition.col}`;
                  occupied.set(key, item);
                }
              });
              
              if (dropPreviewPosition) {
                const key = `${dropPreviewPosition.row},${dropPreviewPosition.col}`;
                const existingItem = occupied.get(key);
                // If position is occupied, we'll swap
                return { position: dropPreviewPosition, existingItem };
              }
              
              // Find next available position
              for (let row = 0; row < layout.rows; row++) {
                for (let col = 0; col < layout.cols; col++) {
                  const key = `${row},${col}`;
                  if (!occupied.has(key)) {
                    return { position: { row, col }, existingItem: null };
                  }
                }
              }
              
              // Fallback: find next available position or create new row
              const totalGridItems = prev.filter(c => c.gridPosition !== undefined).length;
              const maxCols = layout.cols;
              const newRow = Math.floor(totalGridItems / maxCols);
              const newCol = totalGridItems % maxCols;
              return {
                position: { row: newRow, col: newCol },
                existingItem: null
              };
            };
            
            const { position: finalPosition, existingItem } = findTargetPosition();
            
            // If dragging a stacked card to a grid position
            if (isStackedCard && draggedItem) {
              const draggedStackIndex = draggedItem.stackIndex ?? 0;
              
              return prev.map(item => {
                if (item.id === draggedCanvasId) {
                  // Move dragged card to grid position
                  return { ...item, isStacked: false, gridPosition: finalPosition };
                }
                
                // If dropping on an existing item, swap with it
                if (existingItem && item.id === existingItem.id) {
                  // Move existing item to the dragged card's stack position
                  return {
                    ...item,
                    type: 'stacked' as const,
                    isStacked: true,
                    gridPosition: undefined,
                    stackIndex: draggedStackIndex
                  };
                }
                
                // Reorder stack indices for remaining stacked cards
                if (item.isStacked && item.stackIndex !== undefined) {
                  const currentIndex = item.stackIndex;
                  if (currentIndex > draggedStackIndex) {
                    return { ...item, stackIndex: currentIndex - 1 };
                  }
                }
                
                return item;
              });
            } else {
              // Regular drag - swap if position occupied, otherwise just move
              return prev.map(item => {
                if (item.id === draggedCanvasId) {
                  return { ...item, gridPosition: finalPosition };
                }
                
                // If dropping on an existing item, swap positions
                if (existingItem && item.id === existingItem.id && draggedItem) {
                  return { ...item, gridPosition: draggedItem.gridPosition || finalPosition };
                }
                
                return item;
              });
            }
          });
          
          if (!expandedCanvases.includes(draggedCanvasId)) {
            setExpandedCanvases(prev => [...prev, draggedCanvasId]);
          }
        }
      }
      
      setDraggedCanvasId(null);
      setDragStartPos(null);
      setDragCurrentPos(null);
      setDropPreviewPosition(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedCanvasId, dragStartPos, dropPreviewPosition, expandedCanvases, calculateDropPosition, layout, canvasItems]);

  const handleRemoveFromExpanded = useCallback((canvasId: string) => {
    setExpandedCanvases(prev => prev.filter(id => id !== canvasId));
    setCanvasItems(prev => prev.map(item => 
      item.id === canvasId && item.type === 'stacked'
        ? { ...item, isStacked: true, gridPosition: undefined }
        : item
    ));
  }, []);

  // Swap stacked card with secondary (PET)
  const handleStackedCardClick = useCallback((stackedCardId: string) => {
    setCanvasItems(prev => {
      const secondary = prev.find(c => c.type === 'secondary');
      const stackedCard = prev.find(c => c.id === stackedCardId);
      
      if (!secondary || !stackedCard || !stackedCard.isStacked) return prev;
      
      const targetStackIndex = stackedCard.stackIndex ?? 0;
      
      // First, swap the two cards
      const swapped = prev.map(item => {
        if (item.id === secondary.id) {
          // Move secondary to stacked position (take the clicked card's stack position)
          return {
            ...item,
            type: 'stacked' as const,
            isStacked: true,
            gridPosition: undefined,
            stackIndex: targetStackIndex
          };
        } else if (item.id === stackedCardId) {
          // Move stacked card to secondary position
          return {
            ...item,
            type: 'secondary' as const,
            isStacked: false,
            gridPosition: secondary.gridPosition
          };
        }
        return item;
      });
      
      // Then, reorder all stack indices to be sequential (0, 1, 2, ...)
      const stackedCards = swapped
        .filter(c => c.isStacked)
        .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0));
      
      return swapped.map(item => {
        if (item.isStacked) {
          const newIndex = stackedCards.findIndex(c => c.id === item.id);
          return { ...item, stackIndex: newIndex >= 0 ? newIndex : item.stackIndex };
        }
        return item;
      });
    });
  }, []);

  // Get color scheme based on modality
  const getModalityColors = (label: string, type: CanvasItem['type']) => {
    const labelUpper = label.toUpperCase();
    if (type === 'primary') {
      // CT - Blue scheme
      return {
        bg: 'rgba(59, 130, 246, 0.9)',
        border: 'rgba(96, 165, 250, 0.8)',
        borderGlow: 'rgba(59, 130, 246, 0.6)'
      };
    } else if (type === 'secondary') {
      // PET - Purple scheme
      return {
        bg: 'rgba(147, 51, 234, 0.9)',
        border: 'rgba(168, 85, 247, 0.8)',
        borderGlow: 'rgba(147, 51, 234, 0.6)'
      };
    } else if (labelUpper.includes('MRI')) {
      // MRI - Green scheme
      return {
        bg: 'rgba(34, 197, 94, 0.9)',
        border: 'rgba(74, 222, 128, 0.8)',
        borderGlow: 'rgba(34, 197, 94, 0.6)'
      };
    } else {
      // Other stacked - Gray scheme
      return {
        bg: 'rgba(75, 85, 99, 0.9)',
        border: 'rgba(156, 163, 175, 0.8)',
        borderGlow: 'rgba(75, 85, 99, 0.6)'
      };
    }
  };

  // Canvas Header - Small floating pill beside scan
  const CanvasHeader = ({ label, type, onDragStart, canDrag, position = 'bottom-right' }: { 
    label: string; 
    type: CanvasItem['type'];
    onDragStart?: (e: React.MouseEvent) => void;
    canDrag?: boolean;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  }) => {
    const positionClasses = {
      'bottom-right': 'bottom-2 right-2',
      'bottom-left': 'bottom-2 left-2',
      'top-right': 'top-2 right-2',
      'top-left': 'top-2 left-2',
    };

    const colors = getModalityColors(label, type);

    return (
      <div 
        className={`absolute ${positionClasses[position]} flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-md border shadow-lg z-10`}
        style={{ 
          backgroundColor: colors.bg,
          borderColor: colors.border
        }}
      >
        <span className="text-xs font-medium text-white">{label}</span>
        {canDrag && onDragStart && (
          <button
            className="cursor-grab active:cursor-grabbing opacity-70 hover:opacity-100 transition-opacity p-0.5"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDragStart(e);
            }}
            type="button"
          >
            <GripVertical className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
    );
  };

  // Canvas Card Component
  const CanvasCard = ({ item, isGhost = false, onHeaderDragStart, onClick }: { 
    item: CanvasItem; 
    isGhost?: boolean;
    onHeaderDragStart?: (e: React.MouseEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
  }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 512;
      canvas.height = 512;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      );
      
      const labelUpper = item.label.toUpperCase();
      if (item.type === 'primary') {
        // CT - Blue tones
        gradient.addColorStop(0, '#1e3a8a');
        gradient.addColorStop(0.5, '#1e40af');
        gradient.addColorStop(1, '#000000');
      } else if (item.type === 'secondary') {
        // PET - Purple tones
        gradient.addColorStop(0, '#6b21a8');
        gradient.addColorStop(0.5, '#7c3aed');
        gradient.addColorStop(1, '#000000');
      } else if (labelUpper.includes('MRI')) {
        // MRI - Green tones
        gradient.addColorStop(0, '#166534');
        gradient.addColorStop(0.5, '#22c55e');
        gradient.addColorStop(1, '#000000');
      } else {
        // Other stacked - Gray tones
        const colors = ['#374151', '#4b5563', '#6b7280'];
        gradient.addColorStop(0, colors[item.stackIndex || 0]);
        gradient.addColorStop(1, '#000000');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const pos = (canvas.width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(canvas.width, pos);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, canvas.width / 2, canvas.height / 2);
    }, [item]);

    const isExpanded = expandedCanvases.includes(item.id);
    const canDrag = true; // All cards can be dragged, including stacked items
    const colors = getModalityColors(item.label, item.type);

    // Scale down primary and secondary cards
    const isPrimaryOrSecondary = item.type === 'primary' || item.type === 'secondary';
    const cardScale = isPrimaryOrSecondary ? 0.85 : 1; // Make primary/secondary 85% size
    
    return (
      <div className="relative" style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left' }}>
        <div 
          className="relative bg-black rounded-2xl overflow-hidden shadow-xl"
          style={{ 
            borderRadius: '16px',
            border: `2px solid ${colors.border}`,
            boxShadow: `0 0 0 1px ${colors.borderGlow}, 0 4px 6px -1px rgba(0, 0, 0, 0.3)`,
            cursor: item.isStacked ? 'pointer' : 'default'
          }}
          onClick={onClick}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-auto rounded-2xl"
            style={{ display: 'block', borderRadius: '14px', pointerEvents: 'none' }}
          />
          {isExpanded && !item.isStacked && !isGhost && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0 bg-red-600/80 hover:bg-red-600 text-white rounded-full z-20"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromExpanded(item.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <CanvasHeader 
            label={item.label} 
            type={item.type} 
            onDragStart={canDrag ? onHeaderDragStart : undefined}
            canDrag={canDrag}
            position="bottom-right"
          />
        </div>
      </div>
    );
  };

  // Stacked Card with Physics Animation
  const StackedCard = ({ item, containerRef: parentContainerRef, containerWidth }: { item: CanvasItem; containerRef?: React.RefObject<HTMLDivElement>; containerWidth?: number }) => {
    const stackIndex = item.stackIndex || 0;
    const isDragging = draggedCanvasId === item.id;
    const [containerHeight, setContainerHeight] = useState(300);
    const [width, setWidth] = useState(300);
    
    // Measure container dimensions
    useEffect(() => {
      if (!parentContainerRef?.current) return;
      
      const updateDimensions = () => {
        if (parentContainerRef.current) {
          setContainerHeight(parentContainerRef.current.offsetHeight);
          setWidth(parentContainerRef.current.offsetWidth);
        }
      };
      
      updateDimensions();
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(parentContainerRef.current);
      
      return () => resizeObserver.disconnect();
    }, [parentContainerRef]);
    
    // Treat PET/CT as stackIndex -1, so our stacked cards start at 0
    // Scale stacked cards to be smaller than PET (which is at 85% scale)
    // Each card is offset to show edges peeking out from underneath with enough space for labels
    const baseX = (stackIndex + 1) * 20; // Reduced horizontal offset (stackIndex 0 starts at 20px)
    const baseScale = 0.75 - (stackIndex * 0.05); // stackIndex 0 = 75%, 1 = 70%, 2 = 65% (smaller than PET's 85%)
    
    // Calculate Y position: each card offset down and right to show edges and labels
    // stackIndex 0 starts offset (since PET/CT is at 0%), 1 is more offset, 2 is even more
    const baseYPercent = (stackIndex + 1) * 0.06; // Reduced to 6% per card (0: 6%, 1: 12%, 2: 18%) - tighter spacing
    const baseY = containerHeight * baseYPercent;
    
    const x = useMotionValue(baseX);
    const y = useMotionValue(baseY);
    const scale = useMotionValue(baseScale);
    const opacity = useMotionValue(Math.max(0.9, 1 - (stackIndex + 1) * 0.03)); // Higher opacity for visibility
    const dragOffsetX = useMotionValue(0);
    const dragOffsetY = useMotionValue(0);
    
    const springX = useSpring(x, { stiffness: 300, damping: 30 });
    const springY = useSpring(y, { stiffness: 300, damping: 30 });
    const springScale = useSpring(scale, { stiffness: 300, damping: 30 });
    const springOpacity = useSpring(opacity, { stiffness: 300, damping: 30 });

    // Update drag offset when dragging
    useEffect(() => {
      if (isDragging && dragStartPos && dragCurrentPos) {
        dragOffsetX.set(dragCurrentPos.x - dragStartPos.x);
        dragOffsetY.set(dragCurrentPos.y - dragStartPos.y);
      } else {
        dragOffsetX.set(0);
        dragOffsetY.set(0);
      }
    }, [isDragging, dragStartPos, dragCurrentPos, dragOffsetX, dragOffsetY]);

    // Reset to base position when not dragging or container height changes
    useEffect(() => {
      if (!isDragging) {
        const newBaseY = containerHeight * ((stackIndex + 1) * 0.06);
        const newBaseX = (stackIndex + 1) * 20;
        const newBaseScale = 0.75 - (stackIndex * 0.05);
        x.set(newBaseX);
        y.set(newBaseY);
        scale.set(newBaseScale);
        opacity.set(Math.max(0.9, 1 - (stackIndex + 1) * 0.03));
      }
    }, [isDragging, stackIndex, containerHeight, x, y, scale, opacity]);

    return (
      <motion.div
        className="absolute"
        style={{
          left: isDragging && dragStartPos && dragCurrentPos ? dragStartPos.x : 0,
          top: isDragging && dragStartPos && dragCurrentPos ? dragStartPos.y : 0,
          width: '100%', // Full width, scaled down by scale transform
          cursor: isDragging ? 'grabbing' : 'default',
          x: isDragging && dragCurrentPos && dragStartPos ? dragCurrentPos.x - dragStartPos.x : springX,
          y: isDragging && dragCurrentPos && dragStartPos ? dragCurrentPos.y - dragStartPos.y : springY,
          scale: springScale,
          rotate: 0,
          zIndex: isDragging ? 1000 : 4 - stackIndex, // Cards behind secondary (zIndex 5), stackIndex 0 = 4, 1 = 3, 2 = 2
          opacity: springOpacity,
          pointerEvents: 'auto',
          filter: `drop-shadow(0 ${(stackIndex + 1) * 6}px ${(stackIndex + 1) * 12}px rgba(0, 0, 0, ${0.3 + stackIndex * 0.1}))`,
          transformOrigin: 'top left'
        }}
        onMouseEnter={() => {
          // Remove hover preview - cards are visible in stack
        }}
        onMouseLeave={() => {
          // Remove hover preview
        }}
        onClick={(e) => {
          // Click to swap with secondary/PET
          const target = e.target as HTMLElement;
          if (!target.closest('.cursor-grab')) {
            e.stopPropagation();
            handleStackedCardClick(item.id);
          }
        }}
        onMouseDown={(e) => {
          // Prevent default drag behavior - dragging is handled via header grip icon
          // Only allow dragging when clicking on the grip icon (handled in CanvasCard)
          const target = e.target as HTMLElement;
          if (!target.closest('.cursor-grab')) {
            // Don't prevent default on click - allow click handler
          }
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <CanvasCard 
          item={item} 
          onHeaderDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(e, item.id);
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleStackedCardClick(item.id);
          }}
        />
      </motion.div>
    );
  };

  // Get grid canvases
  const gridCanvases = (() => {
    if (layoutMode === 'expanded') {
      // In expanded mode, show ALL items including stacked cards
      const allItems = canvasItems.map((item, index) => ({
        ...item,
        isStacked: false, // Temporarily unstack everything for grid display
        gridPosition: {
          row: Math.floor(index / layout.cols),
          col: index % layout.cols
        }
      }));
      return allItems;
    }
    
    const visible: CanvasItem[] = [];
    const primary = canvasItems.find(c => c.type === 'primary');
    const secondary = canvasItems.find(c => c.type === 'secondary');
    
    if (primary) visible.push({ ...primary, gridPosition: { row: 0, col: 0 } });
    if (secondary) visible.push({ ...secondary, gridPosition: { row: 0, col: 1 } });
    
    expandedCanvases.forEach((id, index) => {
      const canvas = canvasItems.find(c => c.id === id);
      if (canvas) {
        const gridIndex = 2 + index;
        visible.push({
          ...canvas,
          gridPosition: {
            row: Math.floor(gridIndex / layout.cols),
            col: gridIndex % layout.cols
          }
        });
      }
    });
    
    return visible;
  })();

  const stackedCanvases = layoutMode === 'expanded' 
    ? [] // No stacked cards in expanded mode - all cards are in grid
    : canvasItems.filter(c => c.isStacked && !expandedCanvases.includes(c.id) && draggedCanvasId !== c.id);
  const draggedItem = draggedCanvasId ? canvasItems.find(c => c.id === draggedCanvasId) : null;

  return (
    <div className="w-full h-full flex flex-col p-6 bg-black text-white relative overflow-hidden">
      {/* Animated grid background */}
      <motion.div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
        animate={{
          backgroundPosition: ['0px 0px', '50px 50px']
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
      
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 70%)'
        }}
      />
      
      <div className="mb-4 relative z-10">
        <h2 className="text-2xl font-bold mb-2 text-white">Fusion Grid View Prototype V2</h2>
        <p className="text-gray-300 text-sm">
          Drag stacked cards to expand them. Hover over the stack to preview different scans.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLayoutMode(layoutMode === 'normal' ? 'expanded' : 'normal')}
          className="bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          {layoutMode === 'normal' ? 'Show All' : 'Normal View'}
        </Button>
        {expandedCanvases.length > 0 && (
          <Badge variant="outline" className="border-gray-400 text-gray-700 bg-white">
            {expandedCanvases.length} expanded
          </Badge>
        )}
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto rounded-2xl z-10"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          gap: '1rem', // Reduced gap for tighter spacing
          minHeight: '600px',
          padding: '1rem', // Reduced padding
          background: 'transparent'
        }}
      >
        {gridCanvases.map((item) => {
          const isDropZone = dropPreviewPosition && 
            dropPreviewPosition.row === item.gridPosition?.row && 
            dropPreviewPosition.col === item.gridPosition?.col;
          
          return (
            <div
              key={item.id}
              ref={item.type === 'secondary' ? secondaryCellRef : undefined}
              className="flex flex-col relative"
              style={{
                gridRow: (item.gridPosition?.row || 0) + 1,
                gridColumn: (item.gridPosition?.col || 0) + 1,
                minHeight: item.type === 'secondary' ? '600px' : '150px', // Reduced heights
                overflow: 'visible',
                position: 'relative'
              }}
            >
              {(isDropZone && draggedCanvasId) && (
                <motion.div 
                  className="absolute inset-0 border-2 border-dashed border-purple-500 bg-purple-50/70 rounded-xl z-50 pointer-events-none flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <div className="text-purple-600 font-semibold text-lg">Drop here</div>
                </motion.div>
              )}
              
              {draggedItem && isDropZone && (
                <div className="absolute inset-0 z-40 pointer-events-none">
                  <CanvasCard item={draggedItem} isGhost={true} />
                </div>
              )}
              
              <div style={{ position: 'relative', zIndex: item.type === 'secondary' ? 5 : 1, pointerEvents: item.type === 'secondary' ? 'none' : 'auto' }}>
                <CanvasCard item={item} />
              </div>
              
              {/* Stacked Cards Container - Positioned underneath secondary canvas */}
              {item.type === 'secondary' && layoutMode === 'normal' && stackedCanvases.length > 0 && (
                <div 
                  ref={stackContainerRef}
                  className="absolute"
                  style={{ 
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: `${100 + (stackedCanvases.length * 30)}%`, // Dynamic height based on number of cards
                    pointerEvents: draggedCanvasId ? 'none' : 'auto',
                    zIndex: 2,
                    overflow: 'visible'
                  }}
                  onMouseLeave={() => {
                    if (!draggedCanvasId) setHoveredStackIndex(null);
                  }}
                >
                  <AnimatePresence>
                    {stackedCanvases.map((stackedItem) => (
                      <StackedCard 
                        key={stackedItem.id} 
                        item={stackedItem} 
                        containerRef={stackContainerRef}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        })}
        
        {dropPreviewPosition && draggedCanvasId && (() => {
          const isOccupied = gridCanvases.some(item => 
            item.gridPosition?.row === dropPreviewPosition.row && 
            item.gridPosition?.col === dropPreviewPosition.col
          );
          
          if (!isOccupied) {
            return (
              <motion.div
                className="absolute border-2 border-dashed border-purple-500 bg-purple-50/70 rounded-xl z-50 pointer-events-none flex items-center justify-center"
                style={{
                  gridRow: dropPreviewPosition.row + 1,
                  gridColumn: dropPreviewPosition.col + 1,
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <div className="text-purple-600 font-semibold text-lg">Drop here</div>
              </motion.div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}

