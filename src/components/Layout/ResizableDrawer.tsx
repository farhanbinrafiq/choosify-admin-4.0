/**
 * ResizableDrawer Component
 * 
 * Right-side sliding drawer panel with resizable width capability.
 * Keeps user settings persisted per drawerInstance ID.
 */

import React, { useState, useEffect } from 'react';
import { useLayoutPreferences } from '../../hooks/useLayoutPreferences';
import { X } from 'lucide-react';
import Splitter from './Splitter';
import { motion, AnimatePresence } from 'motion/react';

interface ResizableDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  drawerId?: string;
}

export const ResizableDrawer: React.FC<ResizableDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  defaultWidth = 480,
  minWidth = 380,
  maxWidth = 900,
  drawerId = 'drawer'
}) => {
  const { getSizes, setSizes } = useLayoutPreferences(`drawer_${drawerId}`);
  const [width, setWidth] = useState(defaultWidth);

  // Load saved configurations
  useEffect(() => {
    const saved = getSizes();
    if (saved.length > 0) {
      setWidth(saved[0]);
    }
  }, [getSizes]);

  const handleResize = (newWidth: number) => {
    setWidth(newWidth);
  };

  const handleResizeEnd = (finalWidth: number) => {
    setSizes([finalWidth]);
  };

  const handleReset = () => {
    setWidth(defaultWidth);
    setSizes([defaultWidth]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
          />

          {/* Drawer Body container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            style={{ width: `${width}px` }}
            className="h-full flex bg-white shadow-2xl relative border-l border-slate-200 z-50"
          >
            {/* Draggable splitter on the left edge of the drawer */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 -translate-x-1/2">
              <Splitter
                direction="vertical"
                size={width}
                onResize={handleResize}
                onResizeEnd={handleResizeEnd}
                minSize={minWidth}
                maxSize={maxWidth}
                onDoubleClick={handleReset}
              />
            </div>

            {/* Inner Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 shrink-0 bg-slate-50">
                <div>
                  {title && (
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h2>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dynamic scrollable body */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ResizableDrawer;
