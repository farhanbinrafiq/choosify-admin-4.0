/**
 * ResizableSidebar Component
 * 
 * Wraps or integrates the dashboard sidebar with resize and collapse/expand features.
 * Features:
 * - Minimum width limit (72px)
 * - Collapsed icon-only mode when width reaches 72px or is toggled
 * - Double-click reset to default (280px)
 * - Emergency auto-recovery from invalid values (e.g., 0, negative, NaN)
 * - Hover tooltips and seamless transitions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLayoutPreferences } from '../../hooks/useLayoutPreferences';
import Splitter from './Splitter';

interface ResizableSidebarProps {
  children: React.ReactNode | ((isCollapsed: boolean, toggleCollapse: () => void) => React.ReactNode);
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsible?: boolean;
  className?: string;
}

export const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  children,
  defaultWidth = 280,
  minWidth = 72,
  maxWidth = 420,
  collapsible = true,
  className = ''
}) => {
  const { getSizes, setSizes, getCollapsed, setCollapsed } = useLayoutPreferences('sidebar');
  
  // Track preferred expanded width (default 280px, bounded 140px to 420px)
  const [preferredWidth, setPreferredWidth] = useState(() => {
    const saved = getSizes();
    const val = saved.length > 0 ? saved[0] : defaultWidth;
    return typeof val === 'number' && !isNaN(val) && val >= 140 && val <= 420 ? val : defaultWidth;
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return getCollapsed();
  });

  const [isDragging, setIsDragging] = useState(false);

  // Synchronize on mount just to be sure
  useEffect(() => {
    const saved = getSizes();
    const savedCollapsed = getCollapsed();
    const val = saved.length > 0 ? saved[0] : defaultWidth;
    if (typeof val === 'number' && !isNaN(val) && val >= 140 && val <= 420) {
      setPreferredWidth(val);
    }
    setIsCollapsed(savedCollapsed);
  }, [getSizes, getCollapsed, defaultWidth]);

  // Handle resizing during mouse drag
  const handleResize = useCallback((newWidth: number) => {
    setIsDragging(true);
    
    if (newWidth < 140) {
      // Snaps to collapsed mode at the lower threshold
      setIsCollapsed(true);
    } else {
      // Smooth resizing between 140px and our maximum
      setIsCollapsed(false);
      const clamped = Math.max(140, Math.min(maxWidth, newWidth));
      setPreferredWidth(clamped);
    }
  }, [maxWidth]);

  // Handle completion of drag (saves values)
  const handleResizeEnd = useCallback((finalWidth: number) => {
    setIsDragging(false);
    
    if (finalWidth < 140) {
      setIsCollapsed(true);
      setCollapsed(true);
      // Notice: we do NOT overwrite the saved size in localStorage, so that we preserve preferredWidth!
    } else {
      setIsCollapsed(false);
      setCollapsed(false);
      const clamped = Math.max(140, Math.min(maxWidth, finalWidth));
      setPreferredWidth(clamped);
      setSizes([clamped]);
    }
  }, [maxWidth, setSizes, setCollapsed]);

  // Toggle button expand/collapse
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      setCollapsed(next);
      return next;
    });
  }, [setCollapsed]);

  // Reset to default on double-click
  const handleReset = useCallback(() => {
    setIsCollapsed(false);
    setPreferredWidth(defaultWidth);
    setCollapsed(false);
    setSizes([defaultWidth]);
  }, [defaultWidth, setCollapsed, setSizes]);

  const currentWidth = isCollapsed ? 72 : preferredWidth;

  return (
    <div className={`flex h-full relative ${className}`}>
      {/* Sidebar Content Panel */}
      <div
        style={{
          width: `${currentWidth}px`,
          minWidth: `${currentWidth}px`,
          maxWidth: `${currentWidth}px`,
          transition: isDragging 
            ? 'none' 
            : 'width 250ms cubic-bezier(0.4, 0, 0.2, 1), min-width 250ms cubic-bezier(0.4, 0, 0.2, 1), max-width 250ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className="h-full flex-shrink-0 flex flex-col relative overflow-hidden"
      >
        <div className="w-full h-full flex flex-col animate-none">
          {typeof children === 'function' ? children(isCollapsed, toggleCollapse) : children}
        </div>
      </div>

      {/* Splitter Panel - Always active, cursor feedback is col-resize */}
      <Splitter
        direction="vertical"
        size={currentWidth}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
        minSize={72}
        maxSize={maxWidth}
        onDoubleClick={handleReset}
        className="hidden lg:block border-r border-app-border/40 z-50"
      />
    </div>
  );
};

export default ResizableSidebar;
