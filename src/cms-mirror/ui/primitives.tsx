/** Shared visual primitives matching standalone HTML CMS patterns */

import React from 'react';

export const glassKpiStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg,rgba(0,4,53,0.85),rgba(0,4,53,0.78))',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08),0 8px 24px rgba(0,4,53,0.12)',
  borderRadius: 18,
  padding: 20,
  cursor: 'pointer',
};

export const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E8EDF2',
  borderRadius: 5,
  padding: 24,
};

export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 10.5,
  fontWeight: 800,
  color: '#6B7280',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #E8EDF2',
};

export const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 12.5,
  color: '#111827',
  borderBottom: '1px solid #E8EDF2',
};

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 800,
        color: '#EF3C23',
        background: 'rgba(255,91,0,0.14)',
        padding: '2px 6px',
        borderRadius: 4,
        letterSpacing: '0.04em',
        marginLeft: 'auto',
      }}
    >
      {children}
    </span>
  );
}
