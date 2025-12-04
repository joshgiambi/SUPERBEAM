/**
 * Fusion Grid View Prototype V3
 * 
 * Best-in-class implementation combining V1 and V2 strengths:
 * - V1's superior drag & drop with smooth cursor following
 * - V1's dramatic hover effects on stacked cards
 * - V2's stunning dark theme with glowing borders
 * - V2's click-to-swap functionality
 * - Enhanced animations and visual polish
 * - Lightning-fast, fluid interactions
 * - Professional, modern design
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Maximize2, GripVertical, X, Layers } from 'lucide-react';

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

export function FusionGridViewPrototypeV3() {
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

  // Calculate adaptive layout
  const layout = (() => {
    const gridItems = canvasItems.filter(c => c.gridPosition !== undefined);
    const totalVisible = layoutMode === 'expanded' 
      ? canvasItems.length 
      : gridItems.length;
    
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

  // Drag start handler
  const handleDragStart = useCallback((e: React.MouseEvent, canvasId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't allow dragging primary CT
    const item = canvasItems.find(c => c.id === canvasId);
    if (item?.type === 'primary') return;
    
    setDraggedCanvasId(canvasId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragCurrentPos({ x: e.clientX, y: e.clientY });
  }, [canvasItems]);

  // Drag handlers
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
        
        // Only process drag if moved more than 30px
        if (distance > 30) {
          const draggedItem = canvasItems.find(c => c.id === draggedCanvasId);
          const isStackedCard = draggedItem?.isStacked;
          
          setCanvasItems(prev => {
            const findTargetPosition = () => {
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
            
            if (isStackedCard && draggedItem) {
              const draggedStackIndex = draggedItem.stackIndex ?? 0;
              
              return prev.map(item => {
                // Don't modify primary CT
                if (item.type === 'primary') return item;
                
                if (item.id === draggedCanvasId) {
                  return { ...item, isStacked: false, gridPosition: finalPosition };
                }
                
                // Only allow swapping with non-primary items
                if (existingItem && item.id === existingItem.id && existingItem.type !== 'primary') {
                  return {
                    ...item,
                    type: 'stacked' as const,
                    isStacked: true,
                    gridPosition: undefined,
                    stackIndex: draggedStackIndex
                  };
                }
                
                if (item.isStacked && item.stackIndex !== undefined) {
                  const currentIndex = item.stackIndex;
                  if (currentIndex > draggedStackIndex) {
                    return { ...item, stackIndex: currentIndex - 1 };
                  }
                }
                
                return item;
              });
            } else {
              return prev.map(item => {
                // Don't modify primary CT
                if (item.type === 'primary') return item;
                
                if (item.id === draggedCanvasId) {
                  return { ...item, gridPosition: finalPosition };
                }
                
                // Only swap if both items are not primary
                if (existingItem && item.id === existingItem.id && draggedItem && existingItem.type !== 'primary') {
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

  // Click to swap with secondary
  const handleStackedCardClick = useCallback((stackedCardId: string) => {
    setCanvasItems(prev => {
      const secondary = prev.find(c => c.type === 'secondary');
      const stackedCard = prev.find(c => c.id === stackedCardId);
      
      if (!secondary || !stackedCard || !stackedCard.isStacked) return prev;
      
      const targetStackIndex = stackedCard.stackIndex ?? 0;
      
      const swapped = prev.map(item => {
        if (item.id === secondary.id) {
          return {
            ...item,
            type: 'stacked' as const,
            isStacked: true,
            gridPosition: undefined,
            stackIndex: targetStackIndex
          };
        } else if (item.id === stackedCardId) {
          return {
            ...item,
            type: 'secondary' as const,
            isStacked: false,
            gridPosition: secondary.gridPosition
          };
        }
        return item;
      });
      
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

  // Get modality colors
  const getModalityColors = (label: string, type: CanvasItem['type']) => {
    const labelUpper = label.toUpperCase();
    if (type === 'primary') {
      return {
        bg: 'rgba(59, 130, 246, 0.95)',
        bgLight: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(96, 165, 250, 0.9)',
        borderGlow: 'rgba(59, 130, 246, 0.6)',
        text: '#3b82f6'
      };
    } else if (type === 'secondary') {
      return {
        bg: 'rgba(147, 51, 234, 0.95)',
        bgLight: 'rgba(147, 51, 234, 0.1)',
        border: 'rgba(168, 85, 247, 0.9)',
        borderGlow: 'rgba(147, 51, 234, 0.6)',
        text: '#9333ea'
      };
    } else if (labelUpper.includes('MRI')) {
      return {
        bg: 'rgba(34, 197, 94, 0.95)',
        bgLight: 'rgba(34, 197, 94, 0.1)',
        border: 'rgba(74, 222, 128, 0.9)',
        borderGlow: 'rgba(34, 197, 94, 0.6)',
        text: '#22c55e'
      };
    } else {
      return {
        bg: 'rgba(245, 158, 11, 0.95)',
        bgLight: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(251, 191, 36, 0.9)',
        borderGlow: 'rgba(245, 158, 11, 0.6)',
        text: '#f59e0b'
      };
    }
  };

  // Canvas Header Component - Floating pill with drag handle
  const CanvasHeader = ({ 
    label, 
    type, 
    onDragStart, 
    canDrag,
    showStackIndex,
    stackIndex,
    position = 'bottom-right' 
  }: { 
    label: string; 
    type: CanvasItem['type'];
    onDragStart?: (e: React.MouseEvent) => void;
    canDrag?: boolean;
    showStackIndex?: boolean;
    stackIndex?: number;
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
      <motion.div 
        className={`absolute ${positionClasses[position]} flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-xl border shadow-lg z-20`}
        style={{ 
          backgroundColor: colors.bg,
          borderColor: colors.border,
          boxShadow: `0 0 12px ${colors.borderGlow}, 0 2px 8px rgba(0, 0, 0, 0.3)`
        }}
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <span className="text-[11px] font-bold text-white tracking-wide">{label}</span>
        {showStackIndex !== undefined && stackIndex !== undefined && (
          <Badge 
            variant="outline" 
            className="h-3.5 px-1 text-[9px] font-semibold border-white/40 text-white bg-white/20"
          >
            #{stackIndex + 1}
          </Badge>
        )}
        {canDrag && onDragStart && (
          <motion.button
            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-white/20 transition-colors"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDragStart(e);
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            <GripVertical className="w-3 h-3 text-white drop-shadow-lg" />
          </motion.button>
        )}
      </motion.div>
    );
  };

  // Canvas Card Component
  const CanvasCard = ({ 
    item, 
    isGhost = false, 
    onHeaderDragStart, 
    onClick,
    showInGrid = false 
  }: { 
    item: CanvasItem; 
    isGhost?: boolean;
    onHeaderDragStart?: (e: React.MouseEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
    showInGrid?: boolean;
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
        gradient.addColorStop(0, '#1e40af');
        gradient.addColorStop(0.7, '#1e3a8a');
        gradient.addColorStop(1, '#000000');
      } else if (item.type === 'secondary') {
        gradient.addColorStop(0, '#7c3aed');
        gradient.addColorStop(0.7, '#6b21a8');
        gradient.addColorStop(1, '#000000');
      } else if (labelUpper.includes('MRI')) {
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.7, '#166534');
        gradient.addColorStop(1, '#000000');
      } else {
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(0.7, '#d97706');
        gradient.addColorStop(1, '#000000');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

      // Crosshair in center
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 20, canvas.height / 2);
      ctx.lineTo(canvas.width / 2 + 20, canvas.height / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2 - 20);
      ctx.lineTo(canvas.width / 2, canvas.height / 2 + 20);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, canvas.width / 2, canvas.height / 2 + 50);
    }, [item]);

    const isExpanded = expandedCanvases.includes(item.id);
    const canDrag = item.type !== 'primary'; // Primary CT cannot be dragged
    const colors = getModalityColors(item.label, item.type);

    // Scale stacked cards smaller for professional deck look
    const cardScale = item.isStacked ? 0.92 : 1;
    
    return (
      <div className="relative w-full h-full" style={{ transform: `scale(${cardScale})`, transformOrigin: 'center' }}>
        <motion.div 
          className="relative bg-black rounded-xl overflow-hidden"
          style={{ 
            borderRadius: '16px',
            border: `1.5px solid ${colors.border}`,
            boxShadow: `0 0 20px ${colors.borderGlow}, 0 4px 20px rgba(0, 0, 0, 0.5)`,
            cursor: item.isStacked ? 'pointer' : 'default',
            opacity: isGhost ? 0.4 : 1
          }}
          onClick={onClick}
          whileHover={item.isStacked ? { 
            scale: 1.01,
            boxShadow: `0 0 25px ${colors.borderGlow}, 0 6px 24px rgba(0, 0, 0, 0.6)`
          } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            style={{ display: 'block', pointerEvents: 'none' }}
          />
          {isExpanded && !item.isStacked && !isGhost && (
            <motion.button
              className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center bg-red-600/90 hover:bg-red-600 text-white rounded-full z-30 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromExpanded(item.id);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
          <CanvasHeader 
            label={item.label} 
            type={item.type} 
            onDragStart={canDrag ? onHeaderDragStart : undefined}
            canDrag={canDrag}
            showStackIndex={item.isStacked}
            stackIndex={item.stackIndex}
            position="bottom-right"
          />
        </motion.div>
      </div>
    );
  };

  // Stacked Card with Professional Deck Layout
  const StackedCard = ({ item }: { item: CanvasItem }) => {
    const stackIndex = item.stackIndex || 0;
    const isHovered = hoveredStackIndex === stackIndex;
    const isDragging = draggedCanvasId === item.id;
    
    // Professional card deck positioning - tight, overlapping stack
    const baseY = stackIndex * 12; // Tight vertical spacing
    const baseX = stackIndex * 8; // Subtle horizontal offset
    const baseScale = 0.92 - (stackIndex * 0.02); // Subtle scale difference: 92%, 90%, 88%
    const baseRotate = stackIndex * 0.5; // Very subtle rotation
    
    const x = useMotionValue(baseX);
    const y = useMotionValue(baseY);
    const scale = useMotionValue(baseScale);
    const rotate = useMotionValue(baseRotate);
    const opacity = useMotionValue(1); // All cards fully visible
    
    const springX = useSpring(x, { stiffness: 400, damping: 35 });
    const springY = useSpring(y, { stiffness: 400, damping: 35 });
    const springScale = useSpring(scale, { stiffness: 400, damping: 35 });
    const springRotate = useSpring(rotate, { stiffness: 400, damping: 35 });
    const springOpacity = useSpring(opacity, { stiffness: 400, damping: 35 });

    // Smooth hover effect
    useEffect(() => {
      if (isHovered && !isDragging) {
        x.set(baseX - 8);
        y.set(baseY - 20);
        scale.set(0.96);
        rotate.set(-3);
        opacity.set(1);
      } else if (!isDragging) {
        x.set(baseX);
        y.set(baseY);
        scale.set(baseScale);
        rotate.set(baseRotate);
        opacity.set(1);
      }
    }, [isHovered, isDragging, stackIndex, baseX, baseY, baseScale, baseRotate, x, y, scale, rotate, opacity]);

    // Calculate drag offset
    const dragOffset = isDragging && dragStartPos && dragCurrentPos
      ? {
          x: dragCurrentPos.x - dragStartPos.x,
          y: dragCurrentPos.y - dragStartPos.y
        }
      : { x: 0, y: 0 };

    return (
      <motion.div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          x: isDragging ? dragOffset.x : springX,
          y: isDragging ? dragOffset.y : springY,
          scale: isDragging ? 1.03 : springScale,
          rotate: isDragging ? 1 : springRotate,
          zIndex: isDragging ? 1000 : (isHovered ? 30 + stackIndex : 10 + stackIndex),
          opacity: springOpacity,
          pointerEvents: 'auto',
          filter: `drop-shadow(0 ${4 + stackIndex * 2}px ${8 + stackIndex * 4}px rgba(0, 0, 0, 0.3))`,
          transformOrigin: 'center center'
        }}
        onMouseEnter={() => setHoveredStackIndex(stackIndex)}
        onMouseLeave={() => !isDragging && setHoveredStackIndex(null)}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleDragStart(e, item.id);
        }}
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
      return canvasItems.map((item, index) => ({
        ...item,
        isStacked: false,
        gridPosition: {
          row: Math.floor(index / layout.cols),
          col: index % layout.cols
        }
      }));
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
    ? []
    : canvasItems.filter(c => c.isStacked && !expandedCanvases.includes(c.id) && draggedCanvasId !== c.id);
  const draggedItem = draggedCanvasId ? canvasItems.find(c => c.id === draggedCanvasId) : null;

  return (
    <div className="w-full h-full flex flex-col p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white relative overflow-hidden">
      {/* Animated background effects */}
      <motion.div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(147, 51, 234, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
        animate={{
          backgroundPosition: ['0px 0px', '60px 60px']
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
      
      {/* Radial gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(147, 51, 234, 0.15) 0%, transparent 50%)'
        }}
      />
      
      {/* Header */}
      <motion.div 
        className="mb-6 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Layers className="w-8 h-8 text-purple-400" />
          <h2 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Fusion Grid View V3
          </h2>
        </div>
        <p className="text-gray-400 text-sm ml-11">
          Drag cards to expand • Click stacked cards to swap • Hover for preview • Ultra-fluid interactions
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div 
        className="mb-4 flex items-center gap-3 z-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLayoutMode(layoutMode === 'normal' ? 'expanded' : 'normal')}
          className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 text-white hover:from-blue-500 hover:to-purple-500 shadow-lg hover:shadow-xl transition-all font-semibold"
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          {layoutMode === 'normal' ? 'Show All' : 'Normal View'}
        </Button>
        {expandedCanvases.length > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Badge 
              variant="outline" 
              className="border-purple-500/50 text-purple-300 bg-purple-900/30 backdrop-blur-sm px-3 py-1"
            >
              {expandedCanvases.length} expanded
            </Badge>
          </motion.div>
        )}
        {stackedCanvases.length > 0 && layoutMode === 'normal' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Badge 
              variant="outline" 
              className="border-blue-500/50 text-blue-300 bg-blue-900/30 backdrop-blur-sm px-3 py-1"
            >
              {stackedCanvases.length} stacked
            </Badge>
          </motion.div>
        )}
      </motion.div>

      {/* Main grid container */}
      <motion.div 
        ref={containerRef}
        className="flex-1 relative overflow-auto rounded-3xl z-10"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          gap: '1.5rem',
          minHeight: '600px',
          padding: '1.5rem',
          background: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)'
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
      >
        {gridCanvases.map((item, idx) => {
          const isDropZone = dropPreviewPosition && 
            dropPreviewPosition.row === item.gridPosition?.row && 
            dropPreviewPosition.col === item.gridPosition?.col;
          
          // Find if this is where the secondary canvas is located
          const isSecondaryPosition = item.type === 'secondary';
          
          return (
            <div
              key={item.id}
              ref={isSecondaryPosition ? secondaryCellRef : undefined}
              className="flex flex-col relative"
              style={{
                gridRow: (item.gridPosition?.row || 0) + 1,
                gridColumn: (item.gridPosition?.col || 0) + 1,
                minHeight: '200px',
                overflow: 'visible',
                position: 'relative'
              }}
            >
              {/* Drop zone indicator - Don't allow dropping on primary CT */}
              {isDropZone && draggedCanvasId && item.type !== 'primary' && (
                <motion.div 
                  className="absolute inset-0 border-2 border-dashed rounded-xl z-50 pointer-events-none flex items-center justify-center"
                  style={{
                    borderColor: 'rgba(168, 85, 247, 0.7)',
                    backgroundColor: 'rgba(147, 51, 234, 0.08)',
                    backdropFilter: 'blur(4px)'
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="text-purple-300 font-semibold text-sm bg-purple-900/40 px-4 py-2 rounded-full backdrop-blur-sm">
                    Drop here
                  </div>
                </motion.div>
              )}
              
              {/* Primary CT cannot be replaced - show warning */}
              {isDropZone && draggedCanvasId && item.type === 'primary' && (
                <motion.div 
                  className="absolute inset-0 border-2 border-dashed rounded-xl z-50 pointer-events-none flex items-center justify-center"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.7)',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    backdropFilter: 'blur(4px)'
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="text-red-300 font-semibold text-sm bg-red-900/40 px-4 py-2 rounded-full backdrop-blur-sm">
                    Cannot replace CT
                  </div>
                </motion.div>
              )}
              
              {/* Ghost preview */}
              {draggedItem && isDropZone && item.type !== 'primary' && (
                <div className="absolute inset-0 z-40 pointer-events-none">
                  <CanvasCard item={draggedItem} isGhost={true} />
                </div>
              )}
              
              {/* Main card */}
              <div style={{ position: 'relative', zIndex: isSecondaryPosition ? 5 : 1 }}>
                <CanvasCard 
                  item={item}
                  showInGrid={true}
                  onHeaderDragStart={item.type !== 'primary' ? (e) => handleDragStart(e, item.id) : undefined}
                />
              </div>
              
              {/* Stacked cards container - Professional deck positioned below secondary */}
              {isSecondaryPosition && layoutMode === 'normal' && stackedCanvases.length > 0 && (
                <div 
                  className="absolute"
                  style={{ 
                    left: '5%',
                    top: '102%',
                    width: '90%',
                    minHeight: '250px',
                    pointerEvents: draggedCanvasId ? 'none' : 'auto',
                    zIndex: 8,
                    overflow: 'visible'
                  }}
                  onMouseLeave={() => {
                    if (!draggedCanvasId) setHoveredStackIndex(null);
                  }}
                >
                  <AnimatePresence>
                    {stackedCanvases.map((stackedItem) => (
                      <StackedCard key={stackedItem.id} item={stackedItem} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

