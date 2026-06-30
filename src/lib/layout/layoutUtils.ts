/**
 * Layout Utilities
 * 
 * Helper functions for resizing logic.
 */

/**
 * Constrain size within min/max bounds
 */
export function constrainSize(
  size: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, size));
}

/**
 * Calculate flex-grow values for remaining space
 */
export function calculateFlex(sizes: number[], totalWidth: number): number[] {
  const totalSpecified = sizes.reduce((sum, s) => sum + (typeof s === 'number' ? s : 0), 0);
  const remaining = totalWidth - totalSpecified;
  
  return sizes.map(size => {
    if (typeof size === 'number') return 0;
    return remaining > 0 ? remaining / sizes.length : 1;
  });
}

/**
 * Get optimal column layout for responsive
 */
export function getResponsiveLayout(
  windowWidth: number,
  columnCount: number
): number[] {
  if (windowWidth < 640) {
    // Mobile: single column
    return [windowWidth - 20];
  }
  
  if (windowWidth < 1024) {
    // Tablet: 2 columns
    return [320, windowWidth - 340];
  }
  
  // Desktop: full layout
  const colWidth = Math.floor((windowWidth - 40) / columnCount);
  return new Array(columnCount).fill(colWidth);
}

/**
 * Interpolate between sizes smoothly
 */
export function interpolateSize(
  start: number,
  end: number,
  progress: number // 0-1
): number {
  return Math.round(start + (end - start) * progress);
}
