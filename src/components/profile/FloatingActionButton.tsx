import React from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  title?: string;
}

export default function FloatingActionButton({
  onClick,
  icon,
  label,
  title,
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="fixed bottom-6 right-6 z-40 bg-app-accent hover:bg-app-accent-light text-white p-3 rounded-full shadow-2xl flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all outline-none"
    >
      {icon}
      {label && <span className="text-xs font-bold px-1">{label}</span>}
    </button>
  );
}
