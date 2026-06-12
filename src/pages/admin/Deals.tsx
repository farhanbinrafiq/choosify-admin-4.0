import React from 'react';
import { Tag, Clock, Search, Filter, Download, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

const mockDeals = [
  { id: '1', name: 'Eid Mega Tech Sale 2026', seller: 'TechZone BD', discount: '30% off', category: 'Electronics', expiry: 'May 31, 2026', clicks: '8,420', status: 'Pending', type: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: '2', name: 'Walton AC Summer Flash', seller: 'ElectroBD', discount: '40% off', category: 'Home', expiry: '18h left', clicks: '12,100', status: 'Expiring', type: 'bg-red-50 text-red-600 border-red-200' },
  { id: '3', name: 'Aarong Jamdani Weekend', seller: 'Aarong Digital', discount: '20% off', category: 'Fashion', expiry: 'Jun 5, 2026', clicks: '4,240', status: 'Live', type: 'bg-green-50 text-green-700 border-green-200' },
];

export default function DealsPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Deals', val: '3,284', color: 'border-l-[#F4631E]' },
          { label: 'Live Deals', val: '2,841', color: 'border-l-green-600' },
          { label: 'Pending Approval', val: '58', color: 'border-l-orange-400' },
          { label: 'Expiring 48h', val: '124', color: 'border-l-red-600' },
        ].map(s => (
          <div key={s.label} className={`bg-white p-4 rounded-xl border-l-[3px] shadow-sm ${s.color}`}>
             <div className="text-2xl font-bold">{s.val}</div>
             <div className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 bg-white border border-gray-200 rounded-lg flex items-center px-3 py-2 gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input placeholder="Search deals by name or seller..." className="flex-1 bg-transparent text-[12px] outline-none" />
        </div>
        <button className="bg-[#F4631E] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-orange-500/10">Filter</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-[#F7F8FA] border-b border-gray-100">
             <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
               <th className="p-4 w-10"><input type="checkbox" /></th>
               <th className="p-4">Deal Name</th>
               <th className="p-4">Seller</th>
               <th className="p-4">Discount</th>
               <th className="p-4">Expires</th>
               <th className="p-4">Clicks</th>
               <th className="p-4">Status</th>
               <th className="p-4">Actions</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
             {mockDeals.map(deal => (
               <tr key={deal.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4"><input type="checkbox" /></td>
                  <td className="p-4 font-bold text-[12px] text-[#0D1B2A]">{deal.name}</td>
                  <td className="p-4 text-[11px] text-gray-500">{deal.seller}</td>
                  <td className="p-4">
                    <span className="bg-[#F4631E] text-white px-2 py-0.5 rounded text-[10px] font-bold">{deal.discount}</span>
                  </td>
                  <td className={`p-4 text-[10px] flex items-center gap-1.5 ${deal.status === 'Expiring' ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                    {deal.status === 'Expiring' && <Clock className="w-3.5 h-3.5" />} {deal.expiry}
                  </td>
                  <td className="p-4 text-[11px] font-medium text-gray-700">{deal.clicks}</td>
                  <td className="p-4">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-tighter ${deal.type}`}>
                      {deal.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                       {deal.status === 'Pending' ? (
                          <button className="p-1 text-green-600 hover:bg-green-50 rounded border border-green-100"><CheckCircle className="w-4 h-4" /></button>
                       ) : (
                          <button className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-100"><ExternalLink className="w-4 h-4" /></button>
                       )}
                       <button className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-100"><XCircle className="w-4 h-4" /></button>
                    </div>
                  </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
