/**
 * Splitter Component
 * 
 * A draggable divider that resizes adjacent panels.
 * Supports horizontal and vertical resizing.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';

interface SplitterProps {
  /**
   * Direction of resize:
   * 'vertical': resize horizontally (left-right divider)
   * 'horizontal': resize vertically (top-down divider)
   */
  direction: 'vertical' | 'horizontal';
  
  /**
   * Current size of the active pane
   */
  size: number;
  
  /**
   * Called as user drags
   */
  onResize: (newSize: number) => void;
  
  /**
   * Called when drag ends (for persistence)
   */
  onResizeEnd?: (finalSize: number) => void;
  
  /**
   * Minimum panel size (px)
   */
  minSize?: number;
  
  /**
   * Maximum panel size (px)
   */
  maxSize?: number;
  
  /**
   * Double-click to reset to default
   */
  onDoubleClick?: () => void;
  
  /**
   * CSS class for styling
   */
  className?: string;
}

export const Splitter: React.FC<SplitterProps> = ({
  direction,
  size,
  onResize,
  onResizeEnd,
  minSize = 100,
  maxSize = 1000,
  onDoubleClick,
  className = ''
}) => {
  const splitterRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isVertical = direction === 'vertical';

  // Use refs to avoid stale closures in event listeners
  const onResizeRef = useRef(onResize);
  const onResizeEndRef = useRef(onResizeEnd);
  const minSizeRef = useRef(minSize);
  const maxSizeRef = useRef(maxSize);
  const sizeRef = useRef(size);

  useEffect(() => {
    onResizeRef.current = onResize;
    onResizeEndRef.current = onResizeEnd;
    minSizeRef.current = minSize;
    maxSizeRef.current = maxSize;
    sizeRef.current = size;
  });

  // ─ Mouse Down Handler (creates temporary scoped drag listeners) ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startSize = sizeRef.current;
    const startPosition = isVertical ? e.clientX : e.clientY;

    // Prevent text selection during drag
    document.body.classList.add('select-none');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPosition = isVertical ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPosition - startPosition;
      
      const min = minSizeRef.current ?? 72;
      const max = maxSizeRef.current ?? 420;
      const newSize = Math.max(min, Math.min(max, startSize + delta));
      
      onResizeRef.current?.(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.classList.remove('select-none');
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      onResizeEndRef.current?.(sizeRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isVertical]);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.();
  }, [onDoubleClick]);

  // Styling - Creates a tactile grab area with a centered elegant visual divider line
  const containerClasses = `
    ${isVertical ? 'cursor-col-resize w-[10px] h-full hover:w-[10px]' : 'cursor-row-resize h-[10px] w-full hover:h-[10px]'}
    ${isDragging ? 'bg-[#F97316]/5' : 'bg-transparent'}
    relative
    select-none
    z-50
    shrink-0
    flex
    items-center
    justify-center
    group
    transition-all
    duration-150
    ${className}
  `;

  const lineClasses = `
    ${isVertical ? 'w-[1.5px] h-full' : 'h-[1.5px] w-full'}
    ${isDragging ? 'bg-[#F97316]' : 'bg-white/10 group-hover:bg-[#F97316]/60'}
    transition-colors
    duration-150
  `;

  return (
    <div
      ref={splitterRef}
      className={containerClasses}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize, double-click to reset"
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      tabIndex={0}
      onKeyDown={(e) => {
        const min = minSizeRef.current ?? 72;
        const max = maxSizeRef.current ?? 420;
        if (e.key === 'ArrowRight' && isVertical) {
          const next = Math.min(max, size + 10);
          onResizeRef.current?.(next);
          onResizeEndRef.current?.(next);
        } else if (e.key === 'ArrowLeft' && isVertical) {
          const next = Math.max(min, size - 10);
          onResizeRef.current?.(next);
          onResizeEndRef.current?.(next);
        } else if (e.key === 'ArrowDown' && !isVertical) {
          const next = Math.min(max, size + 10);
          onResizeRef.current?.(next);
          onResizeEndRef.current?.(next);
        } else if (e.key === 'ArrowUp' && !isVertical) {
          const next = Math.max(min, size - 10);
          onResizeRef.current?.(next);
          onResizeEndRef.current?.(next);
        }
      }}
    >
      <div className={lineClasses} />
    </div>
  );
};

export default Splitter;
