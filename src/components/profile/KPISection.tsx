import React from 'react';
import { profileShellClasses, type ProfileShellVariant } from './profileTheme';

export interface KPICard {
  title: string;
  value: string | number;
  subtext?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  colorTheme?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'default';
  sparklinePath?: string; // Optional SVG path for custom mini sparkline trend
}

interface KPISectionProps {
  kpis: KPICard[];
  variant?: ProfileShellVariant;
  columns?: 3 | 4;
}

export default function KPISection({ kpis, variant = 'dark', columns = 3 }: KPISectionProps) {
  const t = profileShellClasses(variant);
  const gridClass =
    columns === 4 ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5' : 'grid grid-cols-1 md:grid-cols-3 gap-4';

  const defaultSparklinePaths = {
    up: 'M5 25 Q 25 10, 45 35 T 85 15 T 95 20',
    down: 'M5 10 Q 30 35, 55 15 T 85 30 T 95 20',
    neutral: 'M5 30 Q 25 5, 45 25 T 85 10 T 95 5',
  };

  const getSparklineColor = (theme: string = 'default') => {
    switch (theme) {
      case 'emerald':
        return 'text-emerald-400';
      case 'indigo':
        return 'text-indigo-400';
      case 'rose':
        return 'text-rose-400';
      case 'amber':
        return 'text-amber-400';
      default:
        return 'text-emerald-400';
    }
  };

  return (
    <div className={`${gridClass} font-sans`}>
      {kpis.map((kpi, idx) => {
        const theme = kpi.colorTheme || (idx === 1 ? 'indigo' : 'emerald');
        const sparklineColor = getSparklineColor(theme);
        const path =
          kpi.sparklinePath ||
          (kpi.trend ? defaultSparklinePaths[kpi.trend] : idx === 1 ? defaultSparklinePaths.down : defaultSparklinePaths.up);

        const valueClass =
          variant === 'light'
            ? `${t.kpiValue}`
            : `text-xl font-bold tracking-tight block font-mono ${theme === 'rose' ? 'text-rose-400' : theme === 'emerald' ? 'text-emerald-400' : 'text-white'}`;

        return (
          <div key={idx} className={`${t.kpiCard} flex items-center justify-between relative overflow-hidden group`}>
            <div className="space-y-1">
              <span className={`${t.kpiTitle} block`}>{kpi.title}</span>
              <span className={valueClass}>{kpi.value}</span>
              {kpi.subtext && <div className={t.kpiSub}>{kpi.subtext}</div>}
            </div>
            {variant === 'dark' && (
              <div className="shrink-0 pl-1.5">
                <svg
                  className={`w-16 h-8 ${sparklineColor}`}
                  viewBox="0 0 100 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={path} />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
