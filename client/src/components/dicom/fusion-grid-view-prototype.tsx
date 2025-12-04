/**
 * Fusion Grid View Prototype
 * 
 * Prototype for fusion grid view with:
 * - Left canvas for planning CT
 * - Right canvas for secondary fused scan
 * - Stacked canvas layers underneath (like cards) with physics-based animations
 * - Hover to reveal different fused scans
 * - Drag and drop to arrange canvases in 3x view
 * - Adaptive layout (max 3 per row, 2x2 or 2x6)
 * 
 * Inspired by react-spring card deck demo
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Maximize2, 
  Layers, 
  GripVertical,
  X
} from 'lucide-react';

interface CanvasItem {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'stacked';
  isStacked: boolean;
  stackIndex?: number;
  gridPosition?: { row: number; col: number };
}

export function FusionGridViewPrototype() {
  const [layoutMode, setLayoutMode] = useState<'normal' | 'expanded'>('normal');
  const [hoveredStackIndex, setHoveredStackIndex] = useState<number | null>(null);
  const [draggedCanvasId, setDraggedCanvasId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [dropPreviewPosition, setDropPreviewPosition] = useState<{ row: number; col: number } | null>(null);
  const [hoveredGridCell, setHoveredGridCell] = useState<{ row: number; col: number } | null>(null);
  const [expandedCanvases, setExpandedCanvases] = useState<string[]>([]);
  
  // Canvas items - primary CT, secondary scan, and 3 stacked scans
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([
    { id: 'primary-ct', label: 'Planning CT', type: 'primary', isStacked: false, gridPosition: { row: 0, col: 0 } },
    { id: 'secondary-1', label: 'PET Scan', type: 'secondary', isStacked: false, gridPosition: { row: 0, col: 1 } },
    { id: 'stacked-1', label: 'MRI T1', type: 'stacked', isStacked: true, stackIndex: 0 },
    { id: 'stacked-2', label: 'MRI T2', type: 'stacked', isStacked: true, stackIndex: 1 },
    { id: 'stacked-3', label: 'CT Contrast', type: 'stacked', isStacked: true, stackIndex: 2 },
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridCellsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Calculate adaptive layout
  const calculateLayout = useCallback(() => {
    const totalVisible = layoutMode === 'expanded' 
      ? canvasItems.length 
      : 2 + expandedCanvases.length; // primary + secondary + expanded
    
    if (totalVisible <= 3) {
      return { cols: totalVisible, rows: 1 };
    } else if (totalVisible <= 6) {
      return { cols: 3, rows: 2 };
    } else {
      return { cols: 3, rows: Math.ceil(totalVisible / 3) };
    }
  }, [expandedCanvases, layoutMode, canvasItems.length]);

  const layout = calculateLayout();

  // Calculate drop position based on mouse position
  const calculateDropPosition = useCallback((x: number, y: number) => {
    if (!containerRef.current) return null;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeX = x - containerRect.left;
    const relativeY = y - containerRect.top;
    
    // Calculate layout for current state
    const currentLayout = calculateLayout();
    
    // Account for padding
    const padding = 24; // 1.5rem = 24px
    const availableWidth = containerRect.width - (padding * 2);
    const availableHeight = containerRect.height - (padding * 2);
    
    // Calculate which grid cell the mouse is over
    const cellWidth = availableWidth / currentLayout.cols;
    const cellHeight = availableHeight / currentLayout.rows;
    
    const col = Math.floor((relativeX - padding) / cellWidth);
    const row = Math.floor((relativeY - padding) / cellHeight);
    
    // Ensure valid grid position
    const validCol = Math.max(0, Math.min(col, currentLayout.cols - 1));
    const validRow = Math.max(0, Math.min(row, currentLayout.rows - 1));
    
    return { row: validRow, col: validCol };
  }, [calculateLayout]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent, canvasId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasItems.find(c => c.id === canvasId);
    if (!canvas || canvas.type === 'primary') return;
    
    setDraggedCanvasId(canvasId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragCurrentPos({ x: e.clientX, y: e.clientY });
  }, [canvasItems]);

  // Handle drag
  useEffect(() => {
    if (!draggedCanvasId || !dragStartPos) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      setDragCurrentPos({ x: e.clientX, y: e.clientY });
      
      // Calculate drop preview position
      const dropPos = calculateDropPosition(e.clientX, e.clientY);
      if (dropPos) {
        setDropPreviewPosition(dropPos);
      }
    };

    const handleMouseUp = () => {
      if (draggedCanvasId && dragStartPos && dragCurrentPos) {
        // Calculate drag distance
        const deltaX = Math.abs(dragCurrentPos.x - dragStartPos.x);
        const deltaY = Math.abs(dragCurrentPos.y - dragStartPos.y);
        const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Only expand if dragged more than 30px (to distinguish from click)
        if (dragDistance > 30) {
          // Use drop preview position if available, otherwise calculate default
          const finalPosition = dropPreviewPosition || (() => {
            const expandedCount = expandedCanvases.length;
            const totalVisible = 2 + expandedCount;
            if (totalVisible >= 3) {
              return {
                row: Math.floor((totalVisible - 2) / 3),
                col: (totalVisible - 2) % 3
              };
            }
            return { row: 0, col: 2 };
          })();
          
          // Remove from stack and add to expanded
          setCanvasItems(prev => prev.map(item => {
            if (item.id === draggedCanvasId) {
              return { 
                ...item, 
                isStacked: false, 
                gridPosition: finalPosition
              };
            }
            return item;
          }));
          
          setExpandedCanvases(prev => {
            if (!prev.includes(draggedCanvasId)) {
              return [...prev, draggedCanvasId];
            }
            return prev;
          });
        }
      }
      setDraggedCanvasId(null);
      setDragStartPos(null);
      setDragCurrentPos(null);
      setDropPreviewPosition(null);
      setHoveredGridCell(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedCanvasId, dragStartPos, dragCurrentPos, dropPreviewPosition, expandedCanvases, calculateDropPosition]);

  // Remove from expanded
  const handleRemoveFromExpanded = useCallback((canvasId: string) => {
    setExpandedCanvases(prev => prev.filter(id => id !== canvasId));
    setCanvasItems(prev => prev.map(item => {
      if (item.id === canvasId && item.type === 'stacked') {
        return { ...item, isStacked: true, gridPosition: undefined };
      }
      return item;
    }));
  }, []);

  // Canvas header component
  const CanvasHeader = ({ label, type }: { label: string; type: 'primary' | 'secondary' | 'stacked' }) => (
    <div 
      className="backdrop-blur-md border rounded-xl px-4 py-2 shadow-lg mb-2"
      style={{ 
        backgroundColor: '#1a1a1a95',
        borderColor: type === 'primary' ? '#3b82f6' : type === 'secondary' ? '#9333ea' : '#4a5568'
      }}
    >
      <div className="flex items-center justify-between">
        <Badge 
          className={`backdrop-blur-sm ${
            type === 'primary' 
              ? 'bg-blue-900/60 text-blue-200 border-blue-600/30' 
              : type === 'secondary'
              ? 'bg-purple-900/60 text-purple-200 border-purple-600/30'
              : 'bg-gray-800/60 text-gray-300 border-gray-600/30'
          }`}
        >
          {label}
        </Badge>
        {type === 'stacked' && (
          <Badge variant="outline" className="border-gray-500/50 text-gray-300 bg-gray-800/40 backdrop-blur-sm text-xs">
            Stack {(canvasItems.find(c => c.label === label)?.stackIndex || 0) + 1}
          </Badge>
        )}
      </div>
    </div>
  );

  // Canvas component
  const CanvasCard = ({ item, showInGrid = false, isStackedCard = false, isGhost = false }: { 
    item: CanvasItem; 
    showInGrid?: boolean;
    isStackedCard?: boolean;
    isGhost?: boolean;
  }) => {
    const isDragging = draggedCanvasId === item.id;
    const isHovered = hoveredStackIndex === item.stackIndex && item.isStacked;
    const isExpanded = expandedCanvases.includes(item.id);
    const isSecondary = item.type === 'secondary' && showInGrid;
    
    // Always show stacked cards when in stacked card mode
    if (item.isStacked && !isStackedCard && !isDragging && !isExpanded && !showInGrid) {
      return null;
    }

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw mock DICOM image on canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = 512;
      canvas.height = 512;

      // Fill with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw gradient pattern to simulate DICOM image
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      );
      
      if (item.type === 'primary') {
        gradient.addColorStop(0, '#2a4a6a');
        gradient.addColorStop(1, '#000000');
      } else if (item.type === 'secondary') {
        gradient.addColorStop(0, '#6a2a6a');
        gradient.addColorStop(1, '#000000');
      } else {
        const colors = ['#4a6a2a', '#6a4a2a', '#2a6a4a'];
        gradient.addColorStop(0, colors[item.stackIndex || 0]);
        gradient.addColorStop(1, '#000000');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
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

      // Draw label text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, canvas.width / 2, canvas.height / 2);
    }, [item]);

    const canDrag = item.type !== 'primary' && (item.type === 'stacked' || item.type === 'secondary');

    // Calculate drag offset for visual feedback
    const dragOffset = isDragging && dragStartPos && dragCurrentPos
      ? {
          x: dragCurrentPos.x - dragStartPos.x,
          y: dragCurrentPos.y - dragStartPos.y
        }
      : { x: 0, y: 0 };

    const cardContent = (
      <>
        <CanvasHeader label={item.label} type={item.type} />
        <div 
          className="relative bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xl"
          style={{
            borderRadius: '16px',
            ...(isStackedCard && item.isStacked && !isDragging ? {
              boxShadow: `0 ${(item.stackIndex || 0) * 4 + 8}px ${(item.stackIndex || 0) * 8 + 24}px rgba(0, 0, 0, ${0.2 + (item.stackIndex || 0) * 0.1})`,
            } : {})
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-auto rounded-2xl"
            style={{
              display: 'block',
              borderRadius: '16px'
            }}
          />
          {isExpanded && !item.isStacked && !isGhost && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0 bg-red-600/80 hover:bg-red-600 text-white rounded-full z-10"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromExpanded(item.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {canDrag && !isExpanded && item.isStacked && !isGhost && (
            <div className="absolute top-2 left-2 opacity-50 hover:opacity-100 transition-opacity pointer-events-none">
              <GripVertical className="w-4 h-4 text-gray-600" />
            </div>
          )}
        </div>
      </>
    );

    if (isGhost) {
      return (
        <div className="relative opacity-50" style={{ transform: 'scale(0.95)' }}>
          {cardContent}
        </div>
      );
    }

    if (isDragging) {
      return (
        <motion.div
          className="relative"
          style={{
            cursor: 'grabbing',
            userSelect: 'none',
            zIndex: 1000
          }}
          animate={{
            x: dragOffset.x,
            y: dragOffset.y,
            scale: 1.05,
            rotate: 2
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {cardContent}
        </motion.div>
      );
    }

    return (
      <motion.div
        className={`relative ${isExpanded && !item.isStacked ? 'border-2 border-purple-500 rounded-lg' : ''}`}
        style={{
          cursor: canDrag ? 'grab' : 'default',
          userSelect: 'none',
          zIndex: isSecondary ? 10 : (isHovered && item.isStacked ? 100 : 1),
          pointerEvents: isSecondary ? 'none' : 'auto'
        }}
        whileHover={canDrag && !isStackedCard ? { scale: 1.02 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {cardContent}
      </motion.div>
    );
  };

  // Stacked Card Component with Physics Animation
  const StackedCard = ({ item }: { item: CanvasItem }) => {
    const stackIndex = item.stackIndex || 0;
    const isHovered = hoveredStackIndex === stackIndex;
    const isDragging = draggedCanvasId === item.id;
    
    // Physics-based spring animations using motion values
    // Cards start at 0 and offset from there
    const baseY = stackIndex * 25; // Vertical spacing between cards
    const baseX = stackIndex * 22; // Horizontal offset for fanned effect
    const baseScale = 1 - (stackIndex * 0.05); // Slight scaling difference
    
    const x = useMotionValue(baseX);
    const y = useMotionValue(baseY);
    const scale = useMotionValue(baseScale);
    const rotate = useMotionValue(0);
    const opacity = useMotionValue(Math.max(0.7, 1 - stackIndex * 0.1));
    
    const springX = useSpring(x, { stiffness: 300, damping: 30 });
    const springY = useSpring(y, { stiffness: 300, damping: 30 });
    const springScale = useSpring(scale, { stiffness: 300, damping: 30 });
    const springRotate = useSpring(rotate, { stiffness: 300, damping: 30 });
    const springOpacity = useSpring(opacity, { stiffness: 300, damping: 30 });

    useEffect(() => {
      if (isHovered && !isDragging) {
        // Lift card on hover - more dramatic
        x.set(baseX - 10);
        y.set(baseY - 30);
        scale.set(1.12 - stackIndex * 0.02);
        rotate.set(-4);
        opacity.set(1);
      } else if (!isDragging) {
        // Return to stack position
        x.set(baseX);
        y.set(baseY);
        scale.set(baseScale);
        rotate.set(0);
        opacity.set(Math.max(0.8, 1 - stackIndex * 0.08));
      }
    }, [isHovered, isDragging, stackIndex, baseX, baseY, baseScale, x, y, scale, rotate, opacity]);

    return (
      <motion.div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: '90%',
          maxWidth: '400px',
          cursor: 'grab',
          x: springX,
          y: springY,
          scale: springScale,
          rotate: springRotate,
          zIndex: isHovered ? 15 + stackIndex : 2 + stackIndex,
          opacity: springOpacity,
          pointerEvents: 'auto',
          filter: `drop-shadow(0 ${(stackIndex + 1) * 4}px ${(stackIndex + 1) * 8}px rgba(0, 0, 0, 0.3))`
        }}
        onMouseEnter={() => {
          console.log('Hovering stack card', stackIndex);
          setHoveredStackIndex(stackIndex);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          console.log('Dragging stack card', item.id);
          handleDragStart(e, item.id);
        }}
        onMouseLeave={() => {
          if (!isDragging) {
            setHoveredStackIndex(null);
          }
        }}
        whileHover={{ cursor: 'grab' }}
        whileTap={{ cursor: 'grabbing' }}
      >
        <CanvasCard item={item} isStackedCard={true} />
      </motion.div>
    );
  };

  // Get visible canvases for grid layout
  const getGridCanvases = () => {
    if (layoutMode === 'expanded') {
      // Show all canvases in grid
      return canvasItems.map((item, index) => ({
        ...item,
        gridPosition: {
          row: Math.floor(index / layout.cols),
          col: index % layout.cols
        }
      }));
    }
    
    // Normal mode: show primary, secondary, and expanded
    const visible: CanvasItem[] = [];
    
    // Primary CT
    const primary = canvasItems.find(c => c.type === 'primary')!;
    visible.push({ ...primary, gridPosition: { row: 0, col: 0 } });
    
    // Secondary
    const secondary = canvasItems.find(c => c.type === 'secondary')!;
    visible.push({ ...secondary, gridPosition: { row: 0, col: 1 } });
    
    // Expanded canvases
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
  };

  const gridCanvases = getGridCanvases();
  const stackedCanvases = canvasItems.filter(c => c.isStacked && !expandedCanvases.includes(c.id) && draggedCanvasId !== c.id);
  const draggedItem = draggedCanvasId ? canvasItems.find(c => c.id === draggedCanvasId) : null;

  return (
    <div className="w-full h-full flex flex-col p-6 bg-gray-50 text-gray-900">
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">Fusion Grid View Prototype</h2>
        <p className="text-gray-600 text-sm">
          Drag stacked cards to expand them. Hover over the stack to preview different scans.
        </p>
      </div>

      {/* Controls */}
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

      {/* Main canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-gray-50 rounded-2xl"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          gap: '1.5rem',
          minHeight: '600px',
          padding: '1.5rem'
        }}
        onMouseMove={(e) => {
          if (draggedCanvasId) {
            const dropPos = calculateDropPosition(e.clientX, e.clientY);
            if (dropPos) {
              setHoveredGridCell(dropPos);
            }
          }
        }}
        onMouseLeave={() => {
          if (!draggedCanvasId) {
            setHoveredGridCell(null);
          }
        }}
      >
        {gridCanvases.map((item) => {
          const isDropZone = dropPreviewPosition && 
            dropPreviewPosition.row === item.gridPosition?.row && 
            dropPreviewPosition.col === item.gridPosition?.col;
          const isHoveredCell = hoveredGridCell &&
            hoveredGridCell.row === item.gridPosition?.row &&
            hoveredGridCell.col === item.gridPosition?.col;
          
          return (
            <div
              key={item.id}
              ref={(el) => {
                if (el) {
                  gridCellsRef.current.set(`${item.gridPosition?.row}-${item.gridPosition?.col}`, el);
                }
              }}
              className="flex flex-col relative"
              style={{
                gridRow: (item.gridPosition?.row || 0) + 1,
                gridColumn: (item.gridPosition?.col || 0) + 1,
                minHeight: '200px',
                overflow: 'visible'
              }}
            >
              {/* Drop zone highlight */}
              {(isDropZone || isHoveredCell) && draggedCanvasId && (
                <motion.div 
                  className="absolute inset-0 border-2 border-dashed border-purple-500 bg-purple-50/70 rounded-xl z-50 pointer-events-none flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <div className="text-purple-600 font-semibold text-lg">Drop here</div>
                </motion.div>
              )}
              
              {/* Ghost preview of dragged item */}
              {draggedItem && isHoveredCell && draggedCanvasId && (
                <div className="absolute inset-0 z-40 pointer-events-none">
                  <CanvasCard item={draggedItem} isGhost={true} />
                </div>
              )}
              
              <div style={{ position: 'relative', zIndex: item.type === 'secondary' ? 5 : 1, pointerEvents: item.type === 'secondary' ? 'auto' : 'auto' }}>
                <CanvasCard item={item} showInGrid={true} />
              </div>
              
              {/* Stacked canvases positioned layered underneath secondary canvas */}
              {item.type === 'secondary' && layoutMode === 'normal' && stackedCanvases.length > 0 && (
                <div 
                  className="absolute"
                  style={{ 
                    left: 0,
                    top: '100%',
                    marginTop: '20px',
                    width: '100%',
                    minHeight: '200px',
                    pointerEvents: draggedCanvasId ? 'none' : 'auto',
                    zIndex: 2,
                    overflow: 'visible'
                  }}
                  onMouseLeave={() => {
                    if (!draggedCanvasId) {
                      setHoveredStackIndex(null);
                    }
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
        
        {/* Drop preview for empty grid cells */}
        {dropPreviewPosition && draggedCanvasId && (
          (() => {
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
          })()
        )}
      </div>
    </div>
  );
}
