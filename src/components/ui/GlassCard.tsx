import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverLift?: boolean;
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ hoverLift = true, className = '', children, ...rest }) => {
  return (
    <div
      className={`glass-card ${hoverLift ? 'glass-card-hover' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
