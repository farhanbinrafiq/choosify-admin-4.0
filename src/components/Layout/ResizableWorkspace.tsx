/**
 * ResizableWorkspace Component
 * 
 * Centered overlay workspace modal whose canvas width can be adjusted dynamically.
 */

import React, { useState, useEffect } from 'react';
import { useLayoutPreferences } from '../../hooks/useLayoutPreferences';
import { X, Sliders } from 'lucide-react';
import Splitter from './Splitter';
import { motion, AnimatePresence } from 'motion/react';

interface ResizableWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  workspaceId?: string;
}

export const ResizableWorkspace: React.FC<ResizableWorkspaceProps> = ({
  isOpen,
  onClose,
  title = 'Workspace Sandbox',
  children,
  defaultWidth = 800,
  minWidth = 500,
  maxWidth = 1400,
  workspaceId = 'workspace'
}) => {
  const { getSizes, setSizes } = useLayoutPreferences(`workspace_${workspaceId}`);
  const [width, setWidth] = useState(defaultWidth);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            style={{ width: `${width}px` }}
            className="h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col relative border border-slate-150 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-4.5 h-4.5 text-orange-500" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{title}</h3>
                <span className="text-[10px] bg-orange-100 text-[#F97316] font-mono px-2 py-0.5 rounded font-bold">
                  {width}px
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Inner Workspace Canvas Content */}
            <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-100/50">
              {children}
            </div>

            {/* Right Resizer Splitter Edge */}
            <div className="absolute right-0 top-0 bottom-0 w-1.5 translate-x-1/2">
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ResizableWorkspace;
