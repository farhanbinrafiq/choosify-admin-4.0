import React from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText } from 'lucide-react';

interface BrandOrdersTabProps {
  orderSearch: string;
  setOrderSearch: (val: string) => void;
  orderFilterStatus: string;
  setOrderFilterStatus: (val: string) => void;
  filteredOrders: any[];
}

export const BrandOrdersTab: React.FC<BrandOrdersTabProps> = ({
  orderSearch,
  setOrderSearch,
  orderFilterStatus,
  setOrderFilterStatus,
  filteredOrders
}) => {
  return (
    <div className="space-y-6 text-left" id="order_history_panel">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">📜 Order History</h2>
        <p className="text-slate-500 text-xs mt-1">Unified transactional catalog of retail/B2C trade history managed by this brand.</p>
      </div>

      {/* Filters & search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search orders by transaction ID, product, or customer..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-250 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:bg-white"
          />
        </div>

        <div className="flex gap-2.5 overflow-x-auto">
          {['All', 'Delivered', 'In Transit', 'Pending', 'Cancelled', 'Returned'].map(st => (
            <button
              key={st}
              onClick={() => setOrderFilterStatus(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                orderFilterStatus === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 border border-slate-205 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase tracking-wider">
                <th className="px-6 py-4">Transaction Code</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Associated Product</th>
                <th className="px-6 py-4">Invoice Total</th>
                <th className="px-6 py-4">Delivery Route</th>
                <th className="px-6 py-4">Fulfillment Status</th>
                <th className="px-6 py-4 text-right">Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">
                    No matching transactional orders logged inside this ledger window.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{o.id}</td>
                    
                    {/* CUSTOMER NAME CLICKABLE LINK TO THEIR PROFILE SEARCH */}
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/customers?search=${encodeURIComponent(o.customer)}`}
                        className="font-bold text-[#F4631E] hover:underline"
                        title="View Customer Profile"
                      >
                        {o.customer}
                      </Link>
                    </td>

                    <td className="px-6 py-4 text-slate-800 font-bold">{o.product}</td>
                    <td className="px-6 py-4 font-black font-mono text-slate-950">{o.amount}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono">{o.date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                        o.status === 'Delivered' ? 'bg-green-50 text-green-600 border-green-150' :
                        o.status === 'In Transit' ? 'bg-blue-50 text-blue-600 border-blue-150' :
                        o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-250 animate-pulse' :
                        o.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
                        'bg-slate-50 text-slate-500 border-slate-205'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/admin/invoice/${o.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-[#F4631E]/10 hover:border-[#F4631E]/20 text-[#F4631E] rounded-lg transition-all text-[10px]"
                      >
                        <FileText className="w-3.5 h-3.5" /> PDF
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
