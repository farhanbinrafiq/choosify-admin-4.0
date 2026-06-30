/**
 * SplitPane Component
 * 
 * Individual pane wrapper used within a SplitLayout.
 */

import React from 'react';

interface SplitPaneProps {
  children: React.ReactNode;
  size?: number | string;
  minSize?: number;
  maxSize?: number;
  isVertical?: boolean;
  isFlexible?: boolean;
  className?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  children,
  size,
  minSize,
  maxSize,
  isVertical = true,
  isFlexible = false,
  className = ''
}) => {
  const style: React.CSSProperties = {
    position: 'relative',
    overflow: 'auto',
    height: !isVertical && !isFlexible ? size : '100%',
    width: isVertical && !isFlexible ? size : '100%',
    minWidth: isVertical ? minSize : undefined,
    maxWidth: isVertical ? maxSize : undefined,
    minHeight: !isVertical ? minSize : undefined,
    maxHeight: !isVertical ? maxSize : undefined,
    flex: isFlexible ? '1 1 0%' : '0 0 auto',
  };

  return (
    <div
      style={style}
      className={`h-full custom-scrollbar bg-white ${className}`}
    >
      {children}
    </div>
  );
};

export default SplitPane;
