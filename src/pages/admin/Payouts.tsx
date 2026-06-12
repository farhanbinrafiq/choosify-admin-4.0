import React from 'react';
import { CreditCard, ArrowUpRight, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';

const mockPayouts = [
  { id: '1', user: 'Rifat Hasan', amount: '৳ 12,400', type: 'Affiliate', status: 'Pending', date: 'May 16, 2026', method: 'bKash' },
  { id: '2', name: 'Tahmina Begum', amount: '৳ 8,900', type: 'Affiliate', status: 'Approved', date: 'May 15, 2026', method: 'Bank Transfer' },
  { id: '3', name: 'TechZone BD', amount: '৳ 45,000', type: 'Sales', status: 'Completed', date: 'May 14, 2026', method: 'Bank Transfer' },
];

export const Payouts = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Payouts</div>
        <div className="text-2xl font-bold">৳ 4.2M</div>
        <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3"/> +12% this month</div>
      </div>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pending Requests</div>
        <div className="text-2xl font-bold text-orange-600">32</div>
        <div className="text-[10px] text-gray-400 mt-1">Total ৳ 148,200</div>
      </div>
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Conversions</div>
        <div className="text-2xl font-bold">8.4%</div>
        <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3"/> ↑ 1.2% point</div>
      </div>
    </div>

    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-50 flex justify-between items-center text-sm font-semibold">
        Affiliate & Payout Requests
        <button className="text-[11px] font-bold text-blue-600 flex items-center gap-1.5"><Download className="w-3.5 h-3.5"/> Export Statement</button>
      </div>
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
          <tr>
            <th className="p-4">Recipient</th>
            <th className="p-4">Amount</th>
            <th className="p-4">Type</th>
            <th className="p-4">Method</th>
            <th className="p-4">Date</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 text-[12px]">
          {mockPayouts.map(p => (
            <tr key={p.id} className="hover:bg-gray-50/50">
               <td className="p-4 font-medium">{p.user || p.name}</td>
               <td className="p-4 font-bold">{p.amount}</td>
               <td className="p-4 text-gray-500">{p.type}</td>
               <td className="p-4 text-gray-500">{p.method}</td>
               <td className="p-4 text-gray-400 text-[11px]">{p.date}</td>
               <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-tighter ${
                    p.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                    p.status === 'Approved' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'
                  }`}>
                    {p.status}
                  </span>
               </td>
               <td className="p-4 text-right">
                  <button className="text-blue-600 font-bold text-[11px] hover:underline">Manage</button>
               </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default Payouts;
