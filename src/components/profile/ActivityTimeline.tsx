import React from 'react';
import { 
  MessageSquare, 
  Star, 
  ShoppingBag, 
  ShieldAlert, 
  CheckCircle2, 
  DollarSign, 
  Info,
  Clock
} from 'lucide-react';

export interface ActivityEvent {
  id?: string | number;
  title: string;
  subtitle: string;
  iconType?: 'chat' | 'rating' | 'order' | 'warning' | 'check' | 'dollar' | 'info' | string;
}

interface ActivityTimelineProps {
  title: string;
  events?: ActivityEvent[];
}

export default function ActivityTimeline({
  title,
  events = [],
}: ActivityTimelineProps) {
  const getActivityIcon = (type: string = 'info') => {
    switch (type) {
      case 'chat':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'rating':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <Star className="w-4 h-4 text-app-accent-light" fill="currentColor" />
          </div>
        );
      case 'order':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <ShoppingBag className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'check':
        return (
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
        );
      case 'dollar':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Info className="w-4 h-4 text-blue-400" />
          </div>
        );
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4 font-sans">
      <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
        {title}
      </h3>

      <div className="space-y-3 pt-1">
        {events && events.length > 0 ? (
          events.map((act, index) => (
            <div key={act.id || index} className="flex gap-3 items-start p-1.5 hover:bg-white/5 transition-all rounded-[3px]">
              {getActivityIcon(act.iconType)}
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white">{act.title}</h4>
                <p className="text-[9.5px] text-app-text-secondary font-mono mt-0.5">{act.subtitle}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center space-y-2 bg-white/5 rounded-[4px] border border-dashed border-white/10">
            <Clock className="w-6 h-6 text-app-text-secondary/20 mx-auto" />
            <p className="text-[10px] text-app-text-secondary opacity-60">No recent activity on record</p>
          </div>
        )}
      </div>
    </div>
  );
}
