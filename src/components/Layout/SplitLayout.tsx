/**
 * SplitLayout Component
 * 
 * Container for resizable split panes.
 * Manages multiple splitters and pane sizes, persisting user sizing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLayoutPreferences } from '../../hooks/useLayoutPreferences';
import Splitter from './Splitter';
import SplitPane from './SplitPane';

interface PaneConfig {
  size: number;
  minSize?: number;
  maxSize?: number;
}

interface SplitLayoutProps {
  /**
   * Unique ID for this layout (for persistence)
   */
  layoutId: string;
  
  /**
   * Direction of split
   */
  direction?: 'vertical' | 'horizontal';
  
  /**
   * Pane configurations
   */
  panes: PaneConfig[];
  
  /**
   * Child elements
   */
  children: React.ReactNode;
  
  /**
   * Optional CSS class
   */
  className?: string;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  layoutId,
  direction = 'vertical',
  panes,
  children,
  className = ''
}) => {
  const { getSizes, setSizes } = useLayoutPreferences(layoutId);
  const childrenArray = React.Children.toArray(children);

  // Initialize state with stored sizes, fallback to pane configs
  const [sizes, setSizesState] = useState<number[]>(() => {
    const saved = getSizes();
    if (saved.length === panes.length) {
      return saved;
    }
    return panes.map(p => p.size);
  });

  // Keep state in sync with loaded preferences if they change
  useEffect(() => {
    const saved = getSizes();
    if (saved.length === panes.length) {
      setSizesState(saved);
    }
  }, [layoutId, panes.length]);

  const handleResize = useCallback((index: number, newSize: number) => {
    setSizesState(prev => {
      const updated = [...prev];
      updated[index] = newSize;
      return updated;
    });
  }, []);

  const handleResizeEnd = useCallback((index: number, finalSize: number) => {
    setSizesState(prev => {
      const updated = [...prev];
      updated[index] = finalSize;
      setSizes(updated);
      return updated;
    });
  }, [setSizes]);

  const handleReset = useCallback((index: number) => {
    setSizesState(prev => {
      const updated = [...prev];
      updated[index] = panes[index].size;
      setSizes(updated);
      return updated;
    });
  }, [panes, setSizes]);

  const isVertical = direction === 'vertical';
  const containerClass = isVertical ? 'flex flex-row' : 'flex flex-col';

  return (
    <div 
      className={`${containerClass} ${className} w-full h-full min-h-0 min-w-0`}
      style={{ display: 'flex' }}
    >
      {childrenArray.map((child, index) => {
        const paneConfig = panes[index] || { size: 200 };
        const isLast = index === childrenArray.length - 1;
        
        // Let the last pane be flexible to occupy all remaining workspace smoothly
        const isFlexible = isLast;

        return (
          <React.Fragment key={index}>
            <SplitPane
              isVertical={isVertical}
              isFlexible={isFlexible}
              size={sizes[index]}
              minSize={paneConfig.minSize}
              maxSize={paneConfig.maxSize}
              className="flex-1"
            >
              {child}
            </SplitPane>

            {/* Splitter after each pane except the last */}
            {!isLast && (
              <Splitter
                direction={direction}
                size={sizes[index]}
                onResize={(newSize) => handleResize(index, newSize)}
                onResizeEnd={(finalSize) => handleResizeEnd(index, finalSize)}
                minSize={paneConfig.minSize}
                maxSize={paneConfig.maxSize}
                onDoubleClick={() => handleReset(index)}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SplitLayout;
