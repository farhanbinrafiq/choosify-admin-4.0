import React, { useState } from 'react';
import { Send, Bell, User, MessageCircle, Info, Target, Trash2, RefreshCw, Calendar, Clock } from 'lucide-react';

interface SentNotification {
  id: string;
  title: string;
  target: string;
  time: string;
  messageType: string;
  fullMessage: string;
  scheduledFor?: string;
}

export default function NotificationsPage() {
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([
    { id: '1', title: 'Eid UI Update Live!', target: 'All Users', time: 'Yesterday, 4:20 PM', messageType: 'Announcement', fullMessage: 'Eid UI Update Live!' },
    { id: '2', title: 'Maintenance Notice (2AM-4AM)', target: 'Sellers Only', time: 'May 14, 2026', messageType: 'Alert', fullMessage: 'Maintenance Notice (2AM-4AM)' },
    { id: '3', title: 'Flash Deal Slot Openings', target: 'Verified Sellers', time: 'May 12, 2026', messageType: 'Promo / Marketing', fullMessage: 'Flash Deal Slot Openings' },
  ]);

  const [selectedAudience, setSelectedAudience] = useState('All Users');
  const [selectedType, setSelectedType] = useState('Announcement');
  const [messageContent, setMessageContent] = useState('');
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  const getIcon = (type: string) => {
    if (type === 'Alert') return Bell;
    if (type.includes('Promo') || type.includes('Marketing')) return Target;
    return Info;
  };

  const handleBlast = () => {
    if (!messageContent.trim()) return;

    const currentTimestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });

    const newNotification: SentNotification = {
      id: String(Date.now()),
      title: messageContent.length > 50 ? messageContent.slice(0, 50) + '...' : messageContent,
      target: selectedAudience,
      time: currentTimestamp,
      messageType: selectedType,
      fullMessage: messageContent,
    };

    if (scheduleForLater && scheduleDateTime) {
      newNotification.scheduledFor = new Date(scheduleDateTime).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    }

    setSentNotifications([newNotification, ...sentNotifications]);
    
    // Clear the form fields upon submission
    setMessageContent('');
    setScheduleForLater(false);
    setScheduleDateTime('');
  };

  const handleDelete = (id: string) => {
    setSentNotifications(sentNotifications.filter(n => n.id !== id));
  };

  const handleResend = (n: SentNotification) => {
    setSelectedAudience(n.target);
    setSelectedType(n.messageType);
    setMessageContent(n.fullMessage);
    if (n.scheduledFor) {
      setScheduleForLater(true);
      setScheduleDateTime('');
    } else {
      setScheduleForLater(false);
      setScheduleDateTime('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
       <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
             <div className="w-12 h-12 bg-[#FEF0E9] rounded-xl flex items-center justify-center text-[#F4631E]">
                <Send className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-[#0D1B2A]">Send System Notification</h3>
                <p className="text-gray-400 text-sm">Blast a message to your users in realtime.</p>
             </div>
          </div>

          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">TARGET AUDIENCE</label>
                   <select 
                     value={selectedAudience}
                     onChange={(e) => setSelectedAudience(e.target.value)}
                     className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                   >
                      <option>All Users</option>
                      <option>Sellers Only</option>
                      <option>Creators Only</option>
                      <option>Region: Dhaka</option>
                   </select>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">NOTIFICATION TYPE</label>
                   <select 
                     value={selectedType}
                     onChange={(e) => setSelectedType(e.target.value)}
                     className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                   >
                      <option>Announcement</option>
                      <option>Alert</option>
                      <option>Promo / Marketing</option>
                   </select>
                </div>
             </div>
             <div>
                <div className="flex justify-between items-center mb-2">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">MESSAGE CONTENT</label>
                   <span className="text-[10px] font-bold text-gray-400">{messageContent.length} / 280 characters</span>
                </div>
                <textarea 
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value.slice(0, 280))}
                  maxLength={280}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none h-32 resize-none"
                  placeholder="Type your announcement here..."
                />
             </div>
             <button 
               onClick={handleBlast}
               disabled={!messageContent.trim()}
               className="w-full bg-[#0D1B2A] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-gray-200 cursor-pointer hover:bg-[#1A314B] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
             >
                <Send className="w-5 h-5" /> Blast Notification Now
             </button>

             {/* Schedule for Later toggle & input */}
             <div className="pt-2 border-t border-gray-150/50 mt-2">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        id="schedule-toggle"
                        checked={scheduleForLater}
                        onChange={(e) => setScheduleForLater(e.target.checked)}
                        className="w-4.5 h-4.5 rounded border-gray-300 text-[#F4631E] focus:ring-[#F4631E] cursor-pointer accent-[#F4631E]"
                      />
                      <label htmlFor="schedule-toggle" className="text-xs font-bold text-[#0D1B2A] uppercase cursor-pointer select-none">
                         Schedule for Later
                      </label>
                   </div>
                </div>

                {scheduleForLater && (
                   <div className="mt-3 flex flex-col gap-2 p-4 bg-gray-50 border border-gray-100 rounded-xl animate-in fade-in slide-in-from-top-1">
                      <label className="text-[9px] font-black tracking-widest text-[#0D1B2A] uppercase">Select target date &amp; time</label>
                      <input 
                        type="datetime-local"
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#F4631E]"
                      />
                   </div>
                )}
             </div>
          </div>
       </div>

       <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Announcements</div>
          <div className="divide-y divide-gray-50">
             {sentNotifications.map(n => {
                const IconComponent = getIcon(n.messageType);
                return (
                  <div key={n.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50/40 transition-all">
                     <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="p-2 bg-gray-50 rounded-lg text-gray-400 shrink-0">
                           <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="text-[13px] font-bold text-[#0D1B2A] truncate" title={n.fullMessage}>{n.title}</h4>
                           <p className="text-[11px] text-gray-400">
                             Targeted to: <span className="text-[#0D1B2A]">{n.target}</span> • Type: <span className="text-[#0D1B2A]">{n.messageType}</span>
                           </p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4 shrink-0">
                        {n.scheduledFor ? (
                          <div className="flex flex-col items-end gap-0.5">
                             <span className="bg-amber-500/10 text-amber-500 border border-amber-500/15 text-[8.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                                Scheduled
                             </span>
                             <div className="text-[9px] text-gray-400 font-mono">{n.scheduledFor}</div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 font-medium">{n.time}</div>
                        )}
                        <div className="flex items-center gap-1">
                           <button 
                             onClick={() => handleResend(n)}
                             className="p-1.5 hover:bg-gray-100 text-[#0D1B2A] rounded-lg transition-colors cursor-pointer"
                             title="Resend/Repost this"
                           >
                             <RefreshCw className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleDelete(n.id)}
                             className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer"
                             title="Delete"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                     </div>
                  </div>
                );
             })}
          </div>
       </div>
    </div>
  );
}
