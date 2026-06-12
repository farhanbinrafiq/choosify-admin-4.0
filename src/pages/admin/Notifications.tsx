import React from 'react';
import { Send, Bell, User, MessageCircle, Info, Target } from 'lucide-react';

export default function NotificationsPage() {
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
                   <select className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none">
                      <option>All Users</option>
                      <option>Sellers Only</option>
                      <option>Creators Only</option>
                      <option>Region: Dhaka</option>
                   </select>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">NOTIFICATION TYPE</label>
                   <select className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none">
                      <option>Announcement</option>
                      <option>Alert</option>
                      <option>Promo / Marketing</option>
                   </select>
                </div>
             </div>
             <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">MESSAGE CONTENT</label>
                <textarea 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none h-32 resize-none"
                  placeholder="Type your announcement here..."
                />
             </div>
             <button className="w-full bg-[#0D1B2A] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-gray-200">
                <Send className="w-5 h-5" /> Blast Notification Now
             </button>
          </div>
       </div>

       <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Announcements</div>
          <div className="divide-y divide-gray-50">
             {[
               { id: 1, title: 'Eid UI Update Live!', target: 'All Users', time: 'Yesterday, 4:20 PM', icon: Info },
               { id: 2, title: 'Maintenance Notice (2AM-4AM)', target: 'Sellers', time: 'May 14, 2026', icon: Bell },
               { id: 3, title: 'Flash Deal Slot Openings', target: 'Verified Sellers', time: 'May 12, 2026', icon: Target },
             ].map(n => (
               <div key={n.id} className="p-4 flex items-center gap-4">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><n.icon className="w-5 h-5" /></div>
                  <div className="flex-1">
                     <h4 className="text-[13px] font-bold text-[#0D1B2A]">{n.title}</h4>
                     <p className="text-[11px] text-gray-400">Targeted to: <span className="text-[#0D1B2A]">{n.target}</span></p>
                  </div>
                  <div className="text-[10px] text-gray-300 font-medium">{n.time}</div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
}
