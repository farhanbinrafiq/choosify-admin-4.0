import React from 'react';

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
}

export default function KPISection({ kpis }: KPISectionProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
      {kpis.map((kpi, idx) => {
        const theme = kpi.colorTheme || (idx === 1 ? 'indigo' : 'emerald');
        const sparklineColor = getSparklineColor(theme);
        
        // Render pre-defined stylish small mini charts based on metric context
        const defaultSparklinePaths = {
          up: 'M5 25 Q 25 10, 45 35 T 85 15 T 95 20',
          down: 'M5 10 Q 30 35, 55 15 T 85 30 T 95 20',
          neutral: 'M5 30 Q 25 5, 45 25 T 85 10 T 95 5'
        };
        const path = kpi.sparklinePath || (kpi.trend ? defaultSparklinePaths[kpi.trend] : (idx === 1 ? defaultSparklinePaths.down : defaultSparklinePaths.up));

        return (
          <div 
            key={idx} 
            className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">
                {kpi.title}
              </span>
              <span className={`text-xl font-bold tracking-tight block font-mono ${theme === 'rose' ? 'text-rose-400' : theme === 'emerald' ? 'text-emerald-400' : 'text-white'}`}>
                {kpi.value}
              </span>
              {kpi.subtext && (
                <div className="text-[9px] block font-semibold text-app-text-secondary">
                  {kpi.subtext}
                </div>
              )}
            </div>
            <div className="shrink-0 pl-1.5">
              <svg className={`w-16 h-8 ${sparklineColor}`} viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={path} />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
