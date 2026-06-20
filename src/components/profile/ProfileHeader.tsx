import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';

export interface Breadcrumb {
  label: string;
  path?: string;
}

export interface HeaderAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
}

interface ProfileHeaderProps {
  breadcrumbs: Breadcrumb[];
  title: string;
  subtitle: string;
  actions?: HeaderAction[];
  backLink?: string;
  backLinkLabel?: string;
}

export default function ProfileHeader({
  breadcrumbs,
  title,
  subtitle,
  actions,
  backLink,
  backLinkLabel = 'All Records',
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
          <Link to="/admin/dashboard" className="hover:text-app-accent transition-colors">Dashboard</Link>
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
              {bc.path ? (
                <Link to={bc.path} className="hover:text-app-accent transition-colors">
                  {bc.label}
                </Link>
              ) : (
                <span className="text-app-accent-light">{bc.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        <p className="text-app-text-secondary text-[12px]">{subtitle}</p>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-3">
        {actions?.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            className={`px-3.5 py-2 rounded-[4px] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              action.primary
                ? 'bg-app-accent text-white hover:bg-app-accent-light'
                : 'border border-app-border text-app-text-primary bg-app-card hover:border-app-accent hover:text-white'
            }`}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
        {backLink && (
          <Link
            to={backLink}
            className="flex items-center gap-2 px-3.5 py-2 border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary bg-app-card hover:border-app-accent hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-app-accent" />
            <span>{backLinkLabel}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
