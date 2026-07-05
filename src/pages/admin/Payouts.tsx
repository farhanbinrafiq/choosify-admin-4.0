import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, 
  ArrowUpRight, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download, 
  Search, 
  X,
  User,
  Wallet,
  Coins,
  History,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { operationsApi } from '../../services/operationsApi';

// Required Payout interface
export interface Payout {
  id: string;
  recipient: string;
  amount: number; // in BDT
  type: 'Affiliate' | 'Sales' | 'Creator Commission' | 'Refund';
  status: 'Pending' | 'Approved' | 'Processing' | 'Completed' | 'Rejected';
  date: string; // ISO string
  method: 'bKash' | 'Nagad' | 'Bank Transfer' | 'Rocket';
  note?: string;
  recipientId: string;
  recipientType: 'seller' | 'creator';
}

export const Payouts = () => {
  const [platformRevenue, setPlatformRevenue] = useState<number | null>(null);

  useEffect(() => {
    operationsApi.getAnalytics('30d').then((summary) => {
      setPlatformRevenue(summary.orders.revenue);
    }).catch(() => setPlatformRevenue(null));
  }, []);

  // Initialize payouts with existing 3 entries plus 5 more realistic BD entries
  const [payouts, setPayouts] = useState<Payout[]>([
    { 
      id: '1', 
      recipient: 'Rifat Hasan', 
      amount: 12400, 
      type: 'Affiliate', 
      status: 'Pending', 
      date: '2026-05-16T10:00:00.000Z', 
      method: 'bKash',
      recipientId: 'rec_101',
      recipientType: 'creator'
    },
    { 
      id: '2', 
      recipient: 'Tahmina Begum', 
      amount: 8900, 
      type: 'Affiliate', 
      status: 'Approved', 
      date: '2026-05-15T12:00:00.000Z', 
      method: 'Bank Transfer',
      recipientId: 'rec_102',
      recipientType: 'creator',
      note: 'Scheduled for upcoming bank clearing batch'
    },
    { 
      id: '3', 
      recipient: 'TechZone BD', 
      amount: 45000, 
      type: 'Sales', 
      status: 'Completed', 
      date: '2026-05-14T09:30:00.000Z', 
      method: 'Bank Transfer',
      recipientId: 'rec_103',
      recipientType: 'seller'
    },
    { 
      id: '4', 
      recipient: 'Farhan bin Rafiq', 
      amount: 15700, 
      type: 'Creator Commission', 
      status: 'Pending', 
      date: '2026-05-13T14:15:00.000Z', 
      method: 'Nagad',
      recipientId: 'rec_104',
      recipientType: 'creator'
    },
    { 
      id: '5', 
      recipient: 'ElectroBD Dhaka', 
      amount: 68000, 
      type: 'Sales', 
      status: 'Processing', 
      date: '2026-05-12T16:45:00.000Z', 
      method: 'Bank Transfer',
      recipientId: 'rec_105',
      recipientType: 'seller'
    },
    { 
      id: '6', 
      recipient: 'Nafis Iqbal', 
      amount: 7200, 
      type: 'Creator Commission', 
      status: 'Completed', 
      date: '2026-05-11T11:00:00.000Z', 
      method: 'Rocket',
      recipientId: 'rec_106',
      recipientType: 'creator'
    },
    { 
      id: '7', 
      recipient: 'Sanya Zaman', 
      amount: 4300, 
      type: 'Refund', 
      status: 'Rejected', 
      date: '2026-05-10T15:20:00.000Z', 
      method: 'bKash',
      note: 'Bank rejected mapping verification coordinate',
      recipientId: 'rec_107',
      recipientType: 'creator'
    },
    { 
      id: '8', 
      recipient: 'Priyo Bazaar Limited', 
      amount: 32000, 
      type: 'Sales', 
      status: 'Pending', 
      date: '2026-05-09T08:00:00.000Z', 
      method: 'Bank Transfer',
      recipientId: 'rec_108',
      recipientType: 'seller'
    }
  ]);

  // Search & Filter state variables
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');

  // Interactive inline managing state details panel
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [noteText, setNoteText] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Auto update note input if managed item changes
  useEffect(() => {
    if (selectedPayout) {
      setNoteText(selectedPayout.note || '');
    } else {
      setNoteText('');
    }
  }, [selectedPayout]);

  // Utility toast system
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Export filtered list statement as standard BDT CSV statement (Plain JS Blob)
  const handleExportStatement = () => {
    const headers = ['Recipient', 'Amount (BDT)', 'Type', 'Method', 'Date', 'Status'];
    const rows = filteredPayouts.map(p => [
      p.recipient,
      p.amount,
      p.type,
      p.method,
      new Date(p.date).toISOString().slice(0, 10),
      p.status
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payouts_statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("Statement CSV generated & download started!");
  };

  // Perform filtering using useMemo for excellent memory responsiveness
  const filteredPayouts = useMemo(() => {
    return payouts.filter(p => {
      const matchesSearch = p.recipient.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchesType = typeFilter === 'All' || p.type === typeFilter;
      const matchesMethod = methodFilter === 'All' || p.method === methodFilter;
      return matchesSearch && matchesStatus && matchesType && matchesMethod;
    });
  }, [payouts, searchTerm, statusFilter, typeFilter, methodFilter]);

  // Running totals calculated dynamically
  const filteredPayoutsTotal = useMemo(() => {
    return filteredPayouts.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredPayouts]);

  const filteredPayoutsPendingCount = useMemo(() => {
    return filteredPayouts.filter(p => p.status === 'Pending').length;
  }, [filteredPayouts]);

  const filteredPayoutsCompletedCount = useMemo(() => {
    return filteredPayouts.filter(p => p.status === 'Completed').length;
  }, [filteredPayouts]);

  // Stat cards dynamically computed from state
  const totalPayoutsVolume = useMemo(() => {
    return payouts.reduce((acc, curr) => acc + curr.amount, 0);
  }, [payouts]);

  const totalPendingVolume = useMemo(() => {
    return payouts
      .filter(p => p.status === 'Pending')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [payouts]);

  const totalPendingRequestsCount = useMemo(() => {
    return payouts.filter(p => p.status === 'Pending').length;
  }, [payouts]);

  const conversionPercentage = useMemo(() => {
    const completed = payouts.filter(p => p.status === 'Completed').length;
    return payouts.length > 0 ? ((completed / payouts.length) * 100).toFixed(1) : '0';
  }, [payouts]);

  // Manage Panel item actions
  const handleApproveAndSchedule = () => {
    if (!selectedPayout) return;
    setPayouts(prev => prev.map(p => p.id === selectedPayout.id ? { 
      ...p, 
      status: 'Approved', 
      note: noteText || undefined 
    } : p));
    triggerToast("Payout approved & scheduled!");
    setSelectedPayout(null);
  };

  const handleMarkCompleted = () => {
    if (!selectedPayout) return;
    setPayouts(prev => prev.map(p => p.id === selectedPayout.id ? { 
      ...p, 
      status: 'Completed', 
      note: noteText || undefined 
    } : p));
    triggerToast("Payout marked complete successfully.");
    setSelectedPayout(null);
  };

  const handleRejectPayout = () => {
    if (!selectedPayout) return;
    if (!noteText.trim()) {
      triggerToast("A rejection reason is required before rejecting this payout.");
      return;
    }
    setPayouts(prev => prev.map(p => p.id === selectedPayout.id ? { 
      ...p, 
      status: 'Rejected', 
      note: noteText 
    } : p));
    triggerToast("Payout request rejected.");
    setSelectedPayout(null);
  };

  // Format Helper
  const getFormattedDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 text-[#1A1A2E] text-left">
      
      {/* 4 Top Dynamic Stat cards computed from state */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
          <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Storefront Revenue (30d)</div>
          <div className="text-2xl font-bold text-[#1A1A2E]">৳ {(platformRevenue ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 mt-1">From live platform checkout orders</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
          <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Payouts Vol</div>
          <div className="text-2xl font-bold text-[#1A1A2E]">৳ {totalPayoutsVolume.toLocaleString()}</div>
          <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3"/> +12% this month
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
          <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pending Requests</div>
          <div className="text-2xl font-bold text-orange-600">{totalPendingRequestsCount}</div>
          <div className="text-[10px] text-gray-400 mt-1">Total ৳ {totalPendingVolume.toLocaleString()}</div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
          <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Conversion Ratio</div>
          <div className="text-2xl font-bold text-blue-600">{conversionPercentage}%</div>
          <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3"/> ↑ 1.2% point
          </div>
        </div>
      </div>

      {/* Main card panel with splitting layout when inline managing is active */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Main payouts datatable and searching */}
        <div className={selectedPayout ? "lg:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
          
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            
            {/* Main Title & Action header bar */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-2 justify-between sm:items-center text-sm font-semibold">
              <span className="text-[#1A1A2E] font-bold tracking-tight text-md">Affiliate & Payout Requests</span>
              <button 
                onClick={handleExportStatement}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent flex items-center gap-1.5 cursor-pointer border-none"
              >
                <Download className="w-3.5 h-3.5"/> Export Statement
              </button>
            </div>

            {/* Sub-Header search & filter row */}
            <div className="p-4 border-b border-gray-50 flex flex-col gap-4 bg-slate-50/50">
              
              {/* Search input to filter by recipient name */}
              <div className="w-full bg-white border border-gray-200 rounded-lg flex items-center px-3 py-2 gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search recipient by business name..."
                  className="flex-1 bg-transparent text-[12px] outline-none text-[#1A1A2E]"
                />
              </div>

              {/* Status filter, Type filter and Method filter */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-gray-250 hover:border-gray-300 rounded px-2 py-1 text-xs text-[#1A1A2E] outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Processing">Processing</option>
                    <option value="Completed">Completed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Type:</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-white border border-gray-250 hover:border-gray-300 rounded px-2 py-1 text-xs text-[#1A1A2E] outline-none"
                  >
                    <option value="All">All Types</option>
                    <option value="Affiliate">Affiliate</option>
                    <option value="Sales">Sales</option>
                    <option value="Creator Commission">Creator Commission</option>
                    <option value="Refund">Refund</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Method:</span>
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="bg-white border border-gray-250 hover:border-gray-300 rounded px-2 py-1 text-xs text-[#1A1A2E] outline-none"
                  >
                    <option value="All">All Methods</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Rocket">Rocket</option>
                  </select>
                </div>

                {/* Reset button if any filter is set */}
                {(statusFilter !== 'All' || typeFilter !== 'All' || methodFilter !== 'All' || searchTerm) && (
                  <button
                    onClick={() => {
                      setStatusFilter('All');
                      setTypeFilter('All');
                      setMethodFilter('All');
                      setSearchTerm('');
                    }}
                    className="text-[10px] font-bold text-[#F97316] hover:underline bg-transparent border-none cursor-pointer self-center"
                  >
                    Clear Filters
                  </button>
                )}

              </div>
            </div>

            {/* Primary data table structure */}
            <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
              <div className="min-w-[900px]">
                <table className="w-full text-left border-collapse">
                <thead className="bg-[#F8F9FA] border-b border-gray-150 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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
                <tbody className="divide-y divide-gray-100 text-[12px] font-medium text-gray-700">
                  {filteredPayouts.map(p => (
                    <tr 
                      key={p.id} 
                      className={`transition-colors duration-150 ${
                        selectedPayout?.id === p.id 
                          ? 'bg-amber-50/20' 
                          : 'hover:bg-slate-50/40'
                      }`}
                    >
                       <td className="p-4 font-bold text-[#1A1A2E]">
                         <div>{p.recipient}</div>
                         <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                           ID: {p.recipientId} • {p.recipientType}
                         </div>
                       </td>
                       <td className="p-4 font-black text-slate-900">৳ {p.amount.toLocaleString()}</td>
                       <td className="p-4 text-gray-500 font-mono text-[11px]">{p.type}</td>
                       <td className="p-4 text-gray-500">{p.method}</td>
                       <td className="p-4 text-gray-400 text-[11px] font-mono">{getFormattedDate(p.date)}</td>
                       <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter ${
                            p.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                            p.status === 'Approved' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            p.status === 'Processing' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            p.status === 'Completed' ? 'bg-green-50 text-green-600 border-green-100' :
                            'bg-red-50 text-red-600 border-red-100'
                          }`}>
                            {p.status}
                          </span>
                       </td>
                       <td className="p-4 text-right">
                          <button 
                            onClick={() => setSelectedPayout(p)}
                            className="bg-transparent border-none text-blue-600 hover:text-blue-700 font-bold text-[11px] hover:underline cursor-pointer transition-all"
                          >
                            Manage
                          </button>
                       </td>
                    </tr>
                  ))}

                  {filteredPayouts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-gray-400 italic">
                        No payout records match is found for selected search filter matrix parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
                
                {/* Running total footer row showing current filtered results */}
                {filteredPayouts.length > 0 && (
                  <tfoot className="bg-slate-50/50 font-bold text-[11px] text-gray-800 border-t border-gray-150">
                    <tr>
                      <td className="p-4 text-[#1A1A2E]" colSpan={1}>Running Total (Filtered)</td>
                      <td className="p-4 font-black">৳ {filteredPayoutsTotal.toLocaleString()}</td>
                      <td className="p-4" colSpan={5}>
                        <div className="flex gap-4 justify-end text-right font-bold text-gray-500 normal-case pr-4">
                          <span>Pending requests: <strong className="text-orange-600 font-black">{filteredPayoutsPendingCount}</strong></span>
                          <span>Completed payments: <strong className="text-green-600 font-black">{filteredPayoutsCompletedCount}</strong></span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Inline manage slide-out drawer panel */}
        <AnimatePresence mode="wait">
          {selectedPayout && (
            <div className="lg:col-span-4 h-fit sticky top-24">
              <motion.div
                key={selectedPayout.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className="bg-white border border-gray-2 * border-gray-200 rounded-[2rem] p-6 shadow-2xl text-left space-y-4"
              >
                
                {/* Header widget */}
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1a1a2e] flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-[#F97316]" />
                    <span>Payout Verification</span>
                  </h3>
                  <button 
                    onClick={() => setSelectedPayout(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer bg-slate-50 border-none"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Info block section */}
                <div className="space-y-3.5 text-xs">
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-[11px]">
                    <div className="flex justify-between">
                       <span className="text-slate-400 font-bold uppercase text-[9px]">Recipient</span>
                       <span className="font-bold text-[#1a1a2e]">{selectedPayout.recipient}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-slate-400 font-bold uppercase text-[9px]">Entity Type</span>
                       <span className="font-mono text-blue-600 font-bold uppercase text-[10px]">{selectedPayout.recipientType}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2 rounded-xl mt-1 border border-slate-100">
                       <span className="text-slate-400 font-bold uppercase text-[9px]">Request Sum</span>
                       <span className="font-black text-md text-emerald-600">৳ {selectedPayout.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-slate-400 font-bold uppercase text-[9px]">Payment Code Route</span>
                       <span className="font-bold text-slate-700 bg-amber-50 px-2 py-0.5 rounded text-[10px]">{selectedPayout.method}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-slate-400 font-bold uppercase text-[9px]">Request Date</span>
                       <span className="text-slate-500">{new Date(selectedPayout.date).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-slate-400 font-bold uppercase text-[9px]">Status</span>
                       <span className="font-bold text-[#F97316] uppercase text-[9px]">{selectedPayout.status}</span>
                    </div>
                  </div>

                  {/* Note block text area */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a2e] block">
                      Note to Recipient
                    </label>
                    <textarea 
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Enter details like transaction ID, scheduled date or rejection cause specified notes..."
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-xs text-[#1a1a2e] outline-none focus:border-[#F97316] min-h-[100px] resize-none"
                    />
                    {selectedPayout.status === 'Pending' && (
                      <p className="text-[9.5px] italic text-[#F97316] font-bold">
                        * Note required if rejecting request.
                      </p>
                    )}
                  </div>

                  {/* Payout actions block */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    
                    <button 
                      onClick={handleApproveAndSchedule}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase tracking-widest rounded-xl text-[10px] shadow-sm transition cursor-pointer border-none"
                    >
                      Approve &amp; Schedule
                    </button>

                    <button 
                      onClick={handleMarkCompleted}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-widest rounded-xl text-[10px] shadow-sm transition cursor-pointer border-none"
                    >
                      Mark Completed
                    </button>

                    <button 
                      onClick={handleRejectPayout}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase tracking-widest rounded-xl text-[10px] shadow-sm transition cursor-pointer border-none"
                    >
                      Reject Request
                    </button>

                  </div>

                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

      {/* Floating active Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-6 right-6 z-[600] bg-[#1A1A2E] border border-[#F97316]/30 p-4 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold text-white"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Payouts;
