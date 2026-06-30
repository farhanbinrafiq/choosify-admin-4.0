/**
 * Default Layout Configuration
 * 
 * Pre-configured sizes for all dashboard layouts.
 */

export const LAYOUT_DEFAULTS = {
  // Global
  SIDEBAR: {
    default: 240,
    min: 200,
    max: 420
  },

  // Two-column layouts
  TWO_COLUMN: {
    left: { default: 340, min: 245, max: 500 },
    right: { default: 400, min: 300, max: 800 }
  },

  // Three-column layouts
  THREE_COLUMN: {
    left: { default: 280, min: 220, max: 400 },
    center: { default: 600, min: 400, max: 1000 },
    right: { default: 400, min: 300, max: 600 }
  },

  // Drawers
  DRAWER: {
    default: 480,
    min: 380,
    max: 900
  },

  // CMS Editor
  CMS_EDITOR: {
    tree: { default: 280, min: 200, max: 400 },
    canvas: { default: 600, min: 400, max: 1000 },
    properties: { default: 380, min: 300, max: 600 }
  },

  // Messaging
  MESSAGING: {
    list: { default: 320, min: 280, max: 400 },
    chat: { default: 600, min: 400, max: 1000 },
    details: { default: 380, min: 300, max: 600 }
  },

  // Order Console
  ORDER_CONSOLE: {
    list: { default: 400, min: 300, max: 600 },
    details: { default: 600, min: 400, max: 1000 },
    shipment: { default: 380, min: 300, max: 600 }
  }
};

// Responsive breakpoints
export const BREAKPOINTS = {
  MOBILE: 640,
  TABLET: 1024,
  DESKTOP: 1280
};

// Min/max constraints
export const CONSTRAINTS = {
  MIN_PANE: 100,
  MAX_PANE: 2000,
  MIN_DRAWER: 300,
  MAX_DRAWER: 1000
};
