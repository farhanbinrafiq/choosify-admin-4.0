/**
 * TrackingTimeline Component
 * 
 * Displays chronological tracking events.
 */

import React from 'react';
import { Check, Clock, AlertCircle, MapPin } from 'lucide-react';
import { TrackingEvent } from '../../types/shipment';

interface TrackingTimelineProps {
  events: TrackingEvent[];
}

const getStatusIcon = (status: string) => {
  const normStatus = status.toLowerCase();
  switch (normStatus) {
    case 'delivered':
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Check size={16} className="text-emerald-400" />
        </div>
      );
    case 'failed_delivery':
    case 'cancelled':
    case 'failed':
      return (
        <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
          <AlertCircle size={16} className="text-rose-400" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-[#F4631E]/10 border border-[#F4631E]/30 flex items-center justify-center">
          <Clock size={16} className="text-[#F4631E]" />
        </div>
      );
  }
};

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center text-slate-500 py-6 text-xs font-semibold">
        No tracking events recorded yet.
      </div>
    );
  }

  // Sort events chronologically (newest at bottom, or newest at top? Usually newest at top is better, or chronological newest at bottom. Let's do newest at top)
  const sortedEvents = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6 relative pl-2">
      {sortedEvents.map((event, index) => {
        // Handle location string or object safely
        let locationStr = '';
        if (typeof event.location === 'string') {
          locationStr = event.location;
        } else if (event.location && typeof event.location === 'object') {
          const locObj = event.location as any;
          locationStr = [locObj.city, locObj.district].filter(Boolean).join(', ');
        }

        return (
          <div key={event.id || index} className="flex gap-4 relative">
            {/* Visual connector line */}
            {index < sortedEvents.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-app-border/40" />
            )}
            
            <div className="flex flex-col items-center shrink-0 z-10">
              {getStatusIcon(event.status)}
            </div>

            <div className="pb-2 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-white text-xs uppercase tracking-wider">
                  {event.status.replace(/_/g, ' ')}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {new Date(event.timestamp).toLocaleString('en-BD', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              
              <div className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                {event.description}
              </div>

              {locationStr && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1.5 font-semibold">
                  <MapPin size={12} className="text-slate-500" />
                  <span>{locationStr}</span>
                </div>
              )}

              {event.remarks && (
                <div className="bg-slate-950/40 text-[10px] text-amber-400 border border-amber-500/10 px-2 py-1 rounded-md mt-2 italic">
                  Remarks: {event.remarks}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrackingTimeline;
