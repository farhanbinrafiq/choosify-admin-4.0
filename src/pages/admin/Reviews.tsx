import React from 'react';
import { Star, AlertTriangle, Check, Trash2, Ban } from 'lucide-react';

const mockReviews = [
  { id: '1', user: 'Mehedi Rahman', product: 'Samsung Galaxy S25 Ultra', store: 'TechZone BD', rating: 1, comment: '"This phone is absolute garbage. The seller is a cheat and scammer. I will make sure everyone knows this shop is a fraud. Complete waste of money and time..."', status: 'Flagged', reports: 4, type: 'bg-red-50 text-red-600', flags: ['Personal Threats', 'Abusive Language'] },
  { id: '2', user: 'Anonymous K.', product: 'Walton 2-Door Fridge', store: 'ElectroBD', rating: 5, comment: '"Amazing product! Buy from this link: [bit.ly/xyz] for best price! This seller is the best. Everyone should buy here. [Affiliate link spam suspected]"', status: 'Flagged', reports: 2, type: 'bg-orange-50 text-orange-600', flags: ['External Links', 'Suspected Spam'] },
  { id: '3', user: 'Rifat Hasan', product: 'Aarong Jamdani Saree', store: 'Aarong Digital', rating: 3, comment: '"Fabric quality is good but delivery took 5 days longer than promised. The color was slightly different but acceptable. Would buy again."', status: 'Published', reports: 0, type: 'bg-green-50 text-green-600' },
];

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reviews', val: '192,480', color: 'border-l-[#F4631E]' },
          { label: 'Published', val: '189,940', color: 'border-l-green-600' },
          { label: 'Flagged Total', val: '2,312', color: 'border-l-red-600' },
          { label: 'Deleted', val: '228', color: 'border-l-gray-400' },
        ].map(s => (
          <div key={s.label} className={`bg-white p-4 rounded-xl border-l-[3px] shadow-sm ${s.color}`}>
             <div className="text-2xl font-bold">{s.val}</div>
             <div className="text-[10px] text-gray-400 tracking-wider font-bold uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-100">
        <button className="px-5 py-2.5 text-xs font-bold text-[#F4631E] border-b-2 border-[#F4631E]">Flagged (2,312)</button>
        <button className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600">All Reviews</button>
        <button className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600">Deleted</button>
      </div>

      <div className="space-y-4">
        {mockReviews.map((rev) => (
          <div key={rev.id} className={`bg-white border rounded-xl p-5 ${rev.status === 'Flagged' ? 'border-red-100 border-l-[3px] border-l-red-600' : 'border-gray-100'}`}>
             <div className="flex justify-between items-start mb-4">
               <div className="flex gap-3">
                 <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center font-bold text-[11px] text-[#0D1B2A]">
                    {rev.user.split(' ').map(n=>n[0]).join('')}
                 </div>
                 <div>
                   <h4 className="text-[12px] font-bold text-[#0D1B2A]">{rev.user}</h4>
                   <p className="text-[10px] text-gray-400">{rev.product} · <span className="font-medium text-gray-500">{rev.store}</span></p>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="flex gap-0.5 text-[#F4631E]">
                     {Array.from({length: 5}).map((_, i) => (
                       <Star key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'opacity-20'}`} />
                     ))}
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${rev.type}`}>
                    {rev.status} {rev.reports > 0 && `· ${rev.reports} Reports`}
                  </span>
               </div>
             </div>

             <p className="text-[12px] text-gray-700 leading-relaxed italic mb-4">{rev.comment}</p>

             {rev.flags && (
               <div className="flex flex-wrap gap-2 mb-4">
                 {rev.flags.map((f, i) => (
                   <span key={i} className="flex items-center gap-1 text-[9px] font-bold bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-100 uppercase">
                     <AlertTriangle className="w-3 h-3" /> {f}
                   </span>
                 ))}
               </div>
             )}

             <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <span className="text-[10px] text-gray-400">Posted May 15, 2026 · User has 2 prior deleted reviews</span>
                <div className="flex gap-2">
                   <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold text-green-600 border border-green-200 hover:bg-green-50 transition-colors">
                     <Check className="w-3.5 h-3.5" /> Keep
                   </button>
                   <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                     <Trash2 className="w-3.5 h-3.5" /> Delete
                   </button>
                   <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold text-white bg-[#0D1B2A] hover:bg-black transition-colors">
                     <Ban className="w-3.5 h-3.5" /> Ban User
                   </button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
