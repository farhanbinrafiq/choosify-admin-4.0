import React, { useState, useEffect, useRef } from 'react';
import { useReturns, ReturnRequest } from '../../contexts/ReturnsContext';
import { useOrders } from '../../contexts/OrdersContext';
import { 
  Package, Truck, CheckCircle, DollarSign, AlertTriangle, Printer, 
  ArrowRight, Search, Calendar, Filter, Clock, ChevronRight, Trash2, 
  Plus, FileText, X, CheckCircle2, RefreshCw, ZoomIn, Eye, MessageSquare, 
  ArrowUpRight, ExternalLink, Download, TrendingUp, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, BarChart, Bar 
} from 'recharts';

const COLORS = ['#FF6A00', '#FF9E2C', '#3b82f6', '#10b981', '#ef4444'];

export default function ReturnsPage() {
  const { 
    returnRequests, 
    approveReturn, 
    rejectReturn, 
    processRefund, 
    addReturnNote, 
    updateReturnStatus, 
    generateReturnLabel, 
    linkReturnToDispute 
  } = useReturns();

  const { orders } = useOrders();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [reasonFilter, setReasonFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  // Tabs: 'queue' | 'transit' | 'refunds' | 'analytics'
  const [activeTab, setActiveTab] = useState<'queue' | 'transit' | 'refunds' | 'analytics'>('queue');

  // Selected Return Detail Modal state
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  
  // Local Forms State for active Detail Modal
  const [noteInput, setNoteInput] = useState('');
  const [refundInput, setRefundInput] = useState<number>(0);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [courierInput, setCourierInput] = useState('Pathao Delivery');
  const [trackingIdInput, setTrackingIdInput] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  // Toast status
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const selectedReturn = returnRequests.find(r => r.id === selectedReturnId);

  // Initialize refund amount in modal when selected
  useEffect(() => {
    if (selectedReturn) {
      const order = orders.find(o => o.id === selectedReturn.orderId);
      const totalPayable = order?.total_payable || order?.product.price || 0;
      setRefundInput(selectedReturn.refundAmount || totalPayable);
      setTrackingIdInput(selectedReturn.returnTrackingId || '');
      setCourierInput(selectedReturn.returnCourier || 'Pathao Delivery');
      setIsRejecting(false);
      setRejectReasonInput('');
    }
  }, [selectedReturnId, selectedReturn, orders]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedReturnId(null);
        setZoomImg(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter returns based on selected range and query
  const filteredReturns = returnRequests.filter(ret => {
    // Date filter
    const createdAtTime = new Date(ret.createdAt).getTime();
    const daysAgo = (Date.now() - createdAtTime) / (1000 * 60 * 60 * 24);
    if (dateRange === '7d' && daysAgo > 7) return false;
    if (dateRange === '30d' && daysAgo > 30) return false;
    if (dateRange === '90d' && daysAgo > 90) return false;

    // Search query
    const order = orders.find(o => o.id === ret.orderId);
    const customerName = order?.customer.name || 'Unknown Buyer';
    const matchesSearch = (
      ret.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (!matchesSearch) return false;

    // Reason Filter
    if (reasonFilter !== 'All' && ret.reason !== reasonFilter) return false;

    // Status category filter (tab and dropdown sub-filters)
    if (statusFilter !== 'All' && ret.status !== statusFilter) return false;

    return true;
  });

  // Calculate Metrics
  const totalReturnsCount = returnRequests.length;
  const approvedCount = returnRequests.filter(r => r.status === 'approved').length;
  const transitCount = returnRequests.filter(r => r.status === 'returned_in_transit').length;
  const receivedCount = returnRequests.filter(r => r.status === 'received').length;
  const refundedCount = returnRequests.filter(r => r.status === 'refunded').length;
  const activeDisputesCount = returnRequests.filter(r => r.status === 'dispute').length;

  // Handle Note Submission
  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnId || !noteInput.trim()) return;
    addReturnNote(selectedReturnId, noteInput.trim());
    setNoteInput('');
    showToast('Internal note recorded', 'success');
  };

  // Handle Return Approval
  const handleApprove = () => {
    if (!selectedReturnId) return;
    const order = orders.find(o => o.id === selectedReturn?.orderId);
    const limit = order?.total_payable || order?.product.price || 99999;
    
    if (refundInput <= 0) {
      showToast('Refund amount must be greater than zero BDT', 'error');
      return;
    }
    if (refundInput > limit) {
      showToast(`Refund amount cannot exceed order subtotal (৳${limit.toLocaleString()})`, 'error');
      return;
    }

    approveReturn(selectedReturnId, refundInput, 'Approved by Administrator Panel.');
    showToast('Return Request Approved', 'success');
  };

  // Handle Return Rejection
  const handleReject = () => {
    if (!selectedReturnId) return;
    if (!rejectReasonInput.trim()) {
      showToast('A reason is required to reject a return.', 'error');
      return;
    }
    rejectReturn(selectedReturnId, rejectReasonInput.trim());
    showToast('Return Request Rejected', 'info');
    setIsRejecting(false);
  };

  // Handle Process Refund Channel
  const handleProcessRefund = () => {
    if (!selectedReturnId) return;
    processRefund(selectedReturnId);
    showToast('Refund marked as successfully processed!', 'success');
  };

  // Handle Prepaid Return Label Generation
  const handlePrintLabel = () => {
    if (!selectedReturnId) return;
    const info = generateReturnLabel(selectedReturnId);
    showToast(`Printable label generated: ${info.trackingId}`, 'success');
  };

  // Export Refund batch as accountant-friendly format
  const handleExportRefundBatch = () => {
    const refundsData = returnRequests
      .filter(r => r.status === 'received' || r.status === 'refunded')
      .map(r => {
        const order = orders.find(o => o.id === r.orderId);
        return {
          ReturnId: r.id,
          OrderId: r.orderId,
          Customer: order?.customer.name || 'N/A',
          Email: order?.customer.email || 'N/A',
          RefundAmountBDT: r.refundAmount || order?.product.price || 0,
          Status: r.refundStatus,
          DateProcessed: r.updatedAt
        };
      });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(refundsData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `choosify_bd_refunds_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Refund batch exported successfully', 'success');
  };

  // Charting Data calculations
  const getReasonChartData = () => {
    const reasons: Record<string, number> = {
      'Defective': 0,
      'Damaged': 0,
      'Wrong Item': 0,
      'Not As Described': 0,
      'Customer Choice': 0
    };
    returnRequests.forEach(r => {
      if (r.reason === 'defective') reasons['Defective']++;
      else if (r.reason === 'damaged') reasons['Damaged']++;
      else if (r.reason === 'wrong_item') reasons['Wrong Item']++;
      else if (r.reason === 'not_as_described') reasons['Not As Described']++;
      else if (r.reason === 'customer_changed_mind') reasons['Customer Choice']++;
    });
    return Object.keys(reasons).map(k => ({ name: k, value: reasons[k] }));
  };

  const getSellerPerformanceData = () => {
    const sellersMap: Record<string, { name: string; total: number; returned: number }> = {
      'seller_001': { name: 'Aarong Stores Ltd.', total: 18, returned: 2 },
      'seller_002': { name: 'TechZone BD', total: 12, returned: 1 },
      'seller_003': { name: 'Apex Shoes Bangladesh', total: 24, returned: 0 }
    };
    
    // Aggregate return totals
    returnRequests.forEach(r => {
      if (sellersMap[r.sellerId]) {
        sellersMap[r.sellerId].returned++;
      } else {
        sellersMap[r.sellerId] = { name: `Seller ID: ${r.sellerId}`, total: 5, returned: 1 };
      }
    });

    return Object.values(sellersMap).map(s => {
      const rate = s.total > 0 ? (s.returned / s.total) * 100 : 0;
      return {
        ...s,
        rate: parseFloat(rate.toFixed(1))
      };
    });
  };

  const get7DayTrendData = () => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return dates.map(dt => {
      const count = returnRequests.filter(r => r.createdAt.startsWith(dt)).length;
      return {
        date: dt.substring(5), // MM-DD
        Returns: count
      };
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 sm:p-6 font-sans">
      
      {/* Toast alert notice */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-md shadow-2xl border text-sm font-semibold max-w-sm${
              toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800/50' :
              toast.type === 'error' ? 'bg-rose-950/90 text-rose-300 border-rose-800/50' :
              'bg-[#1a1a2e]/95 text-sky-300 border-[#FF6A00]/30'
            }`}
          >
            <div className={`w-2 h-2 rounded-full${toast.type === 'success' ? 'bg-emerald-400' : toast.type === 'error' ? 'bg-rose-400' : 'bg-[#FF6A00]'}animate-pulse`} />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION WITH FILTER SLIDER */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
            <Package className="w-6 h-6 text-[#FF6A00]" />
            <span>Returns & Refunds Control Desk</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit customer return complaints, process reverse logistics, and handle payment ledger refunds
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-[#121424] border border-app-border rounded p-1">
            <Calendar className="w-3.5 h-3.5 text-app-text-secondary ml-1.5" />
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider transition-all${
                  dateRange === range ? 'bg-[#FF6A00] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Last {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* STATS COUNT GRID SECTION */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#121424] border border-app-border p-4 rounded-lg shadow-md flex items-center space-x-3.5">
          <div className="p-2.5 rounded bg-orange-950/40 text-[#FF6A00] border border-orange-900/30">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Initiated</div>
            <div className="text-lg font-black font-mono text-app-text-primary mt-0.5">
              {returnRequests.filter(r => r.status === 'initiated').length}
            </div>
          </div>
        </div>

        <div className="bg-[#121424] border border-app-border p-4 rounded-lg shadow-md flex items-center space-x-3.5">
          <div className="p-2.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/30">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Approved</div>
            <div className="text-lg font-black font-mono text-app-text-primary mt-0.5">{approvedCount}</div>
          </div>
        </div>

        <div className="bg-[#121424] border border-app-border p-4 rounded-lg shadow-md flex items-center space-x-3.5">
          <div className="p-2.5 rounded bg-blue-950/40 text-blue-400 border border-blue-900/30">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">In Transit</div>
            <div className="text-lg font-black font-mono text-app-text-primary mt-0.5">{transitCount}</div>
          </div>
        </div>

        <div className="bg-[#121424] border border-app-border p-4 rounded-lg shadow-md flex items-center space-x-3.5">
          <div className="p-2.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Refunded</div>
            <div className="text-lg font-black font-mono text-app-text-primary mt-0.5">{refundedCount}</div>
          </div>
        </div>

        <div className="bg-[#121424] border border-app-border p-4 rounded-lg shadow-md col-span-2 md:col-span-1 flex items-center space-x-3.5">
          <div className="p-2.5 rounded bg-rose-950/40 text-rose-400 border border-rose-900/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Disputes</div>
            <div className="text-lg font-black font-mono text-app-text-primary mt-0.5">{activeDisputesCount}</div>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-[#121424] border border-app-border p-3.5 rounded-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search return by Request ID, Order code, or customer name..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#090a12] border border-app-border rounded text-app-text-secondary placeholder-slate-500 focus:outline-none focus:border-[#FF6A00] transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 p-0.5 rounded text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns filters */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Reason filter */}
          <div className="flex items-center space-x-1 bg-[#090a12] border border-app-border rounded px-2 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="bg-transparent border-none text-app-text-secondary text-xs focus:outline-none pr-1"
            >
              <option value="All">All Reasons</option>
              <option value="defective">Defective</option>
              <option value="damaged">Damaged Product</option>
              <option value="wrong_item">Wrong Item Sent</option>
              <option value="not_as_described">Not As Described</option>
              <option value="customer_changed_mind">Changed Mind</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center space-x-1 bg-[#090a12] border border-app-border rounded px-2 py-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-app-text-secondary text-xs focus:outline-none pr-1"
            >
              <option value="All">All Statuses</option>
              <option value="initiated">Initiated</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="returned_in_transit">In Transit</option>
              <option value="received">Received</option>
              <option value="refunded">Refunded</option>
              <option value="dispute">Disputed</option>
            </select>
          </div>
        </div>
      </div>

      {/* CORE WORKFLOW TABS VIEW */}
      <div className="border-b border-app-border mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all px-4${
              activeTab === 'queue' ? 'border-[#FF6A00] text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Return Queue ({returnRequests.filter(r => r.status === 'initiated' || r.status === 'dispute' || r.status === 'rejected').length})
          </button>
          
          <button
            onClick={() => setActiveTab('transit')}
            className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all px-4${
              activeTab === 'transit' ? 'border-[#FF6A00] text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Logistics & Transit ({returnRequests.filter(r => r.status === 'approved' || r.status === 'returned_in_transit').length})
          </button>

          <button
            onClick={() => setActiveTab('refunds')}
            className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all px-4${
              activeTab === 'refunds' ? 'border-[#FF6A00] text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Refund Ledger ({returnRequests.filter(r => r.status === 'received' || r.status === 'refunded').length})
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all px-4${
              activeTab === 'analytics' ? 'border-[#FF6A00] text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Insights & Analytics
          </button>
        </div>

        {activeTab === 'refunds' && (
          <div className="flex items-center space-x-2 pb-2">
            <button
              onClick={handleExportRefundBatch}
              className="flex items-center space-x-1 bg-sky-950/50 text-sky-400 border border-sky-900/40 px-3 py-1.5 rounded text-xs font-bold hover:bg-sky-900/50 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Refund Batch</span>
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTAINER PANELS */}
      <div className="bg-[#121424] border border-app-border rounded-lg shadow-xl overflow-hidden">
        
        {/* TAB 1: RETURN QUEUE */}
        {activeTab === 'queue' && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-app-border text-[10px] text-app-text-secondary uppercase tracking-widest font-black">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Customer Info</th>
                  <th className="p-4">Return Reason</th>
                  <th className="p-4">Requested Refund</th>
                  <th className="p-4">Return Status</th>
                  <th className="p-4 text-right">Action Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredReturns.filter(r => r.status === 'initiated' || r.status === 'dispute' || r.status === 'rejected').length > 0 ? (
                  filteredReturns
                    .filter(r => r.status === 'initiated' || r.status === 'dispute' || r.status === 'rejected')
                    .map(ret => {
                      const order = orders.find(o => o.id === ret.orderId);
                      const customerName = order?.customer.name || 'Unknown Buyer';
                      const customerEmail = order?.customer.email || 'N/A';
                      const productPrice = order?.total_payable || order?.product.price || 0;

                      return (
                        <tr key={ret.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 font-bold font-mono text-[#FF6A00]">{ret.id}</td>
                          <td className="p-4 font-mono text-app-text-secondary">{ret.orderId}</td>
                          <td className="p-4">
                            <div className="font-semibold text-app-text-primary">{customerName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{customerEmail}</div>
                          </td>
                          <td className="p-4">
                            <span className="capitalize font-bold text-app-text-secondary">
                              {ret.reason.replace(/_/g, ' ')}
                            </span>
                            <p className="text-[10px] text-slate-500 truncate max-w-[200px]" title={ret.description}>
                              {ret.description}
                            </p>
                          </td>
                          <td className="p-4 font-black font-mono text-app-text-primary">
                            ৳{productPrice.toLocaleString()}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider${
                              ret.status === 'initiated' ? 'bg-orange-950 text-orange-400 border border-orange-800/40' :
                              ret.status === 'dispute' ? 'bg-rose-950 text-rose-400 border border-rose-800/40' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {ret.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedReturnId(ret.id)}
                              className="px-3 py-1.5 text-xs font-bold text-app-text-secondary bg-app-bg hover:bg-[#FF6A00] hover:text-white rounded transition-all"
                            >
                              Process Return
                            </button>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500 font-mono text-xs">
                      No returns pending audit inside the active filter parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: LOGISTICS & TRANSIT */}
        {activeTab === 'transit' && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-app-border text-[10px] text-app-text-secondary uppercase tracking-widest font-black">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Courier Partner</th>
                  <th className="p-4">Tracking Code</th>
                  <th className="p-4">Approved BDT</th>
                  <th className="p-4">Logistics Status</th>
                  <th className="p-4 text-right">Action Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredReturns.filter(r => r.status === 'approved' || r.status === 'returned_in_transit').length > 0 ? (
                  filteredReturns
                    .filter(r => r.status === 'approved' || r.status === 'returned_in_transit')
                    .map(ret => {
                      return (
                        <tr key={ret.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 font-bold font-mono text-[#FF6A00]">{ret.id}</td>
                          <td className="p-4 font-mono text-app-text-secondary">{ret.orderId}</td>
                          <td className="p-4 font-semibold text-app-text-primary">
                            {ret.returnCourier || '[Courier Unassigned]'}
                          </td>
                          <td className="p-4 font-mono">
                            {ret.returnTrackingId ? (
                              <span className="bg-[#090a12] border border-app-border px-2 py-1 rounded text-app-text-secondary select-all">
                                {ret.returnTrackingId}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-bold lowercase italic">waiting generation</span>
                            )}
                          </td>
                          <td className="p-4 font-black font-mono text-app-text-primary">
                            ৳{(ret.refundAmount || 0).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider${
                              ret.status === 'approved' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/40' :
                              ret.status === 'returned_in_transit' ? 'bg-blue-950 text-blue-400 border border-blue-800/40' :
                              'bg-slate-850 text-slate-400'
                            }`}>
                              {ret.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {ret.returnTrackingId && (
                              <a
                                href={`https://track.pathao.com/ret/${ret.returnTrackingId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs bg-app-bg text-app-text-secondary hover:bg-slate-750 rounded transition-all"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Track</span>
                              </a>
                            )}
                            <button
                              onClick={() => setSelectedReturnId(ret.id)}
                              className="px-3 py-1.5 text-xs font-bold text-app-text-primary bg-app-bg hover:bg-[#FF6A00] hover:text-white rounded transition-all"
                            >
                              Dispatch Logistics
                            </button>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500 font-mono text-xs">
                      No return items currently transitioning logistics routes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: REFUND LEDGER */}
        {activeTab === 'refunds' && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-app-border text-[10px] text-app-text-secondary uppercase tracking-widest font-black">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Customer Info</th>
                  <th className="p-4">Refund Amount</th>
                  <th className="p-4">Channel Status</th>
                  <th className="p-4">Resolution Date</th>
                  <th className="p-4 text-right">Refund Action Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredReturns.filter(r => r.status === 'received' || r.status === 'refunded').length > 0 ? (
                  filteredReturns
                    .filter(r => r.status === 'received' || r.status === 'refunded')
                    .map(ret => {
                      const order = orders.find(o => o.id === ret.orderId);
                      const customerName = order?.customer.name || 'Unknown Buyer';
                      const customerEmail = order?.customer.email || 'N/A';

                      return (
                        <tr key={ret.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 font-bold font-mono text-[#FF6A00]">{ret.id}</td>
                          <td className="p-4">
                            <div className="font-semibold text-app-text-primary">{customerName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{customerEmail}</div>
                          </td>
                          <td className="p-4 font-black font-mono text-[#FF9E2C]">
                            ৳{(ret.refundAmount || 0).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider${
                              ret.refundStatus === 'processed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                              ret.refundStatus === 'failed' ? 'bg-rose-950 text-rose-400 border border-rose-800/40' :
                              'bg-amber-950 text-amber-400 border border-amber-800/40'
                            }`}>
                              {ret.refundStatus}
                            </span>
                          </td>
                          <td className="p-4 text-app-text-secondary font-mono">
                            {new Date(ret.updatedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedReturnId(ret.id)}
                              className="px-3 py-1.5 text-xs font-bold text-app-text-primary bg-app-bg hover:bg-[#FF6A00] hover:text-white rounded transition-all"
                            >
                              Manage Refund
                            </button>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 font-mono text-xs">
                      No payments ready for or logged in the refund channels.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: RETURN INSIGHTS & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Return rate by reason */}
              <div className="bg-[#090a12] border border-app-border p-4 rounded-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-app-text-secondary mb-4">
                  Returns Share by Customer Reason
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getReasonChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getReasonChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Returns`, 'Reason Totals']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Returns 7 Day Trend */}
              <div className="bg-[#090a12] border border-app-border p-4 rounded-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-app-text-secondary mb-4">
                  Daily Reverse Logistics Pipeline Trend (7 Days)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={get7DayTrendData()}>
                      <defs>
                        <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF6A00" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#FF6A00" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                      <YAxis stroke="#9ca3af" fontSize={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="Returns" stroke="#FF6A00" fillOpacity={1} fill="url(#colorReturns)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Performance table and Common factors row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Merchant return rates */}
              <div className="bg-[#090a12] border border-app-border p-4 rounded-lg lg:col-span-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-app-text-secondary mb-4">
                  Returns Rate Breakdown by Seller Store
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-app-border font-extrabold uppercase text-[10px] text-slate-500">
                        <th className="pb-2">Merchant Partner Name</th>
                        <th className="pb-2 text-center">Fulfillments</th>
                        <th className="pb-2 text-center">Returns Checked</th>
                        <th className="pb-2 text-right">Returns Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-app-text-secondary">
                      {getSellerPerformanceData().map((s, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-app-text-primary">{s.name}</td>
                          <td className="py-2.5 text-center font-mono">{s.total}</td>
                          <td className="py-2.5 text-center font-mono text-orange-400">{s.returned}</td>
                          <td className="py-2.5 text-right font-mono font-black text-rose-400">
                            {s.rate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick advice/audit center info */}
              <div className="bg-[#090a12] border border-app-border p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase text-[#FF6A00] tracking-wider mb-2">
                    Logistics Health Summary
                  </h4>
                  <p className="text-[11px] text-app-text-secondary leading-relaxed mb-3">
                    Defective merchandise represents <strong>42% of total logged returns</strong> this period. Sizing miscalculations account for the rest.
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Check size charts on sellers catalogs. Flag merchant profiles experiencing return rates above 15% immediately to prevent bad customer satisfaction.
                  </p>
                </div>
                <div className="border-t border-app-border pt-3 mt-4 text-[10px] font-bold font-mono text-slate-500 flex items-center justify-between">
                  <span>Audit Desk Checked:</span>
                  <span className="text-[#FF6A00]">2026-06-27</span>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* DETAIL AUDIT & PROCESS MODAL */}
      <AnimatePresence>
        {selectedReturnId && selectedReturn && (
          <div className="fixed inset-0 bg-app-card/20 flex items-center justify-center p-4 z-40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121424] border border-app-border rounded-lg max-w-4xl w-full shadow-2xl overflow-hidden my-8"
            >
              
              {/* Modal Title bar */}
              <div className="bg-white/[0.02] border-b border-app-border px-5 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF6A00] animate-ping" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-app-text-primary">
                    Audit Return: <span className="text-[#FF6A00] font-mono">{selectedReturn.id}</span>
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedReturnId(null)}
                  className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Split layout inside modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                
                {/* LEFT SIDE: INITIATOR AND EVIDENCE DETS */}
                <div className="p-5 space-y-4">
                  
                  {/* Customer Information */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1.5">
                      Initiating Customer
                    </h4>
                    {(() => {
                      const order = orders.find(o => o.id === selectedReturn.orderId);
                      return (
                        <div className="bg-[#090a12] border border-app-border p-3 rounded flex items-center justify-between">
                          <div>
                            <div className="font-bold text-app-text-primary text-xs">{order?.customer.name || 'Unknown'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{order?.customer.email || 'N/A'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] uppercase font-bold text-slate-500">Total Purchase</div>
                            <div className="text-xs font-black font-mono text-app-text-primary mt-0.5">
                              ৳{(order?.total_payable || order?.product.price || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Return details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        Return Reason:
                      </span>
                      <span className="capitalize text-xs font-black text-app-text-primary bg-app-bg px-2 py-0.5 rounded">
                        {selectedReturn.reason.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="bg-[#090a12] border border-app-border p-3 rounded text-xs text-app-text-secondary min-h-[60px] leading-relaxed">
                      {selectedReturn.description}
                    </div>
                  </div>

                  {/* Evidence Photo Grid with high-res zoom triggers */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                      Evidence Photos ({selectedReturn.evidencePhotos.length})
                    </h4>
                    {selectedReturn.evidencePhotos.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {selectedReturn.evidencePhotos.map((img, i) => (
                          <div 
                            key={i} 
                            onClick={() => setZoomImg(img)}
                            className="relative group aspect-square rounded overflow-hidden bg-app-card border border-app-border cursor-zoom-in"
                          >
                            <img src={img} alt="evidence" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                            <div className="absolute inset-0 bg-app-card/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <ZoomIn className="w-4 h-4 text-app-text-primary" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-[#090a12] border border-app-border p-4 rounded text-center text-slate-600 font-mono text-[11px]">
                        No evidence photographs uploaded with request.
                      </div>
                    )}
                  </div>

                  {/* Print shipment return label */}
                  <div className="pt-2">
                    <button
                      onClick={handlePrintLabel}
                      className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-app-bg hover:bg-slate-750 text-app-text-secondary hover:text-white border border-app-border rounded text-xs font-bold transition-all shadow-md"
                    >
                      <Printer className="w-4 h-4 text-[#FF6A00]" />
                      <span>Print Prepaid Shipping Return Label</span>
                    </button>
                  </div>

                  {/* Status progression Timeline */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">
                      Logistics Pipeline Status
                    </h4>
                    <div className="relative pl-5 border-l-2 border-app-border space-y-4 text-[11px]">
                      
                      <div className="relative">
                        <span className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-[#FF6A00] border-2 border-[#121424]" />
                        <div className="font-bold text-app-text-secondary">Complaint Initiated</div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          {new Date(selectedReturn.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="relative">
                        <span className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 border-[#121424]${
                          selectedReturn.status !== 'initiated' ? 'bg-[#FF9E2C]' : 'bg-slate-800'
                        }`} />
                        <div className="font-bold text-app-text-secondary">Review & Approved</div>
                        {selectedReturn.approvedAt && (
                          <div className="text-[9px] text-slate-500 font-mono">
                            {new Date(selectedReturn.approvedAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <span className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 border-[#121424]${
                          selectedReturn.status === 'returned_in_transit' || selectedReturn.status === 'received' || selectedReturn.status === 'refunded' ? 'bg-sky-400' : 'bg-slate-800'
                        }`} />
                        <div className="font-bold text-app-text-secondary">Transit & Logistics Pickup</div>
                      </div>

                      <div className="relative">
                        <span className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 border-[#121424]${
                          selectedReturn.status === 'received' || selectedReturn.status === 'refunded' ? 'bg-emerald-400' : 'bg-slate-800'
                        }`} />
                        <div className="font-bold text-app-text-secondary">Item Received & Verified</div>
                      </div>

                    </div>
                  </div>

                </div>

                {/* RIGHT SIDE: AUDITING CONTROLS AND NOTE WRITER */}
                <div className="p-5 flex flex-col justify-between space-y-5">
                  
                  {/* Audit Control Desk Form */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      Auditor Control Actions
                    </h4>

                    {/* Pending review approvals */}
                    {selectedReturn.status === 'initiated' && (
                      <div className="bg-[#090a12] border border-app-border p-4 rounded-lg space-y-3">
                        <p className="text-[11px] text-app-text-secondary leading-relaxed">
                          Analyze complaint details. To approve, specify correct refund ledger value (cannot exceed order total).
                        </p>

                        {!isRejecting ? (
                          <>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Lock Refund Ledger (BDT)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-xs font-bold text-app-text-secondary">৳</span>
                                <input
                                  type="number"
                                  value={refundInput}
                                  onChange={(e) => setRefundInput(parseFloat(e.target.value) || 0)}
                                  className="w-full pl-6 pr-3 py-1.5 bg-[#121424] border border-app-border rounded text-xs font-bold font-mono text-[#FF6A00]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setIsRejecting(true)}
                                className="px-3 py-2 bg-rose-950/30 text-rose-400 border border-rose-900/40 hover:bg-rose-900/20 text-xs font-bold rounded transition-all"
                              >
                                Reject Return
                              </button>
                              <button
                                onClick={handleApprove}
                                className="px-4 py-2 bg-[#FF6A00] hover:bg-[#FF9E2C] text-app-text-primary text-xs font-black uppercase tracking-wider rounded transition-all shadow-md"
                              >
                                Approve Return
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Rejection Justification
                              </label>
                              <textarea
                                value={rejectReasonInput}
                                onChange={(e) => setRejectReasonInput(e.target.value)}
                                placeholder="Describe why this complaint is rejected (e.g. item worn/missing box)..."
                                className="w-full px-3 py-1.5 bg-[#121424] border border-app-border rounded text-xs text-app-text-secondary placeholder-slate-600 focus:outline-none"
                                rows={2}
                              />
                            </div>
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setIsRejecting(false)}
                                className="px-3 py-1.5 text-xs text-app-text-secondary hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleReject}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded transition-all"
                              >
                                Confirm Rejection
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Logistics Courier assignment controls */}
                    {selectedReturn.status === 'approved' && (
                      <div className="bg-[#090a12] border border-app-border p-4 rounded-lg space-y-3">
                        <div className="text-[11px] font-bold text-app-text-secondary">
                          Configure Reverse Shipment Courier
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Provide courier routing information to notify courier warehouse pickup.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Courier
                            </label>
                            <select
                              value={courierInput}
                              onChange={(e) => setCourierInput(e.target.value)}
                              className="w-full px-2 py-1.5 bg-[#121424] border border-app-border rounded text-xs text-app-text-secondary focus:outline-none"
                            >
                              <option value="Pathao Delivery">Pathao Delivery</option>
                              <option value="Steadfast Courier">Steadfast Courier</option>
                              <option value="Paperfly">Paperfly</option>
                              <option value="RedX">RedX Logistics</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Tracking ID
                            </label>
                            <input
                              type="text"
                              value={trackingIdInput}
                              onChange={(e) => setTrackingIdInput(e.target.value)}
                              placeholder="e.g. TRACK-91283"
                              className="w-full px-2 py-1.5 bg-[#121424] border border-app-border rounded text-xs text-app-text-secondary focus:outline-none"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (!trackingIdInput.trim()) {
                              showToast('Please specify a valid tracking identifier.', 'error');
                              return;
                            }
                            updateReturnStatus(selectedReturn.id, 'returned_in_transit');
                            showToast('Logistics configured & transit started', 'success');
                          }}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-app-text-primary text-xs font-bold rounded transition-all"
                        >
                          Mark as Shipped/In Transit
                        </button>
                      </div>
                    )}

                    {/* Item receipt verification */}
                    {selectedReturn.status === 'returned_in_transit' && (
                      <div className="bg-[#090a12] border border-app-border p-4 rounded-lg space-y-3">
                        <div className="text-[11px] font-bold text-app-text-secondary">
                          Inspect & Verify Returned Goods
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Once the return package lands in the seller warehouse, mark as received to trigger final refund ledger step.
                        </p>
                        <button
                          onClick={() => {
                            updateReturnStatus(selectedReturn.id, 'received');
                            showToast('Item received and logged into ERP ledger.', 'success');
                          }}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded transition-all"
                        >
                          Mark as Received at Warehouse
                        </button>
                      </div>
                    )}

                    {/* Process Refund to Gateway */}
                    {selectedReturn.status === 'received' && (
                      <div className="bg-[#090a12] border border-app-border p-4 rounded-lg space-y-3">
                        <div className="text-[11px] font-bold text-app-text-secondary">
                          Ready for Payment Refund Channels
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Verification successfully audited. Click to authorize BDT <strong>৳{(selectedReturn.refundAmount || 0).toLocaleString()}</strong> payout back to customer's source account.
                        </p>
                        <button
                          onClick={handleProcessRefund}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-all"
                        >
                          Process & Issue Refund Payment
                        </button>
                      </div>
                    )}

                    {/* Resolved view */}
                    {(selectedReturn.status === 'refunded' || selectedReturn.status === 'rejected') && (
                      <div className="bg-[#090a12] border border-app-border p-4 rounded-lg text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                        <div className="text-xs font-bold text-app-text-primary uppercase tracking-wider">
                          Taxonomy Rule Closed
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          This return complaint has reached a final resolution state and the order ledger remains locked.
                        </p>
                      </div>
                    )}

                    {/* Dispute escalation tool */}
                    {selectedReturn.status !== 'dispute' && selectedReturn.status !== 'refunded' && selectedReturn.status !== 'rejected' && (
                      <div className="border-t border-app-border pt-3 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Logistics conflict?</span>
                        <button
                          type="button"
                          onClick={() => {
                            linkReturnToDispute(selectedReturn.id, `DISP-${Math.floor(1000 + Math.random() * 9000)}`);
                            showToast('Return escalated to Dispute channels', 'info');
                          }}
                          className="text-red-400 hover:text-red-300 font-bold hover:underline"
                        >
                          Escalate to Dispute Resolution
                        </button>
                      </div>
                    )}

                  </div>

                  {/* NOTE KEEPER LOG */}
                  <div className="flex-1 flex flex-col min-h-[160px] bg-[#090a12] border border-app-border p-3 rounded-lg">
                    <h5 className="text-[9px] font-extrabold text-app-text-secondary uppercase tracking-wider mb-2 flex items-center space-x-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Internal Admin Notes Log</span>
                    </h5>
                    
                    <div className="flex-1 overflow-y-auto max-h-[120px] custom-scrollbar space-y-2 pr-1 text-[10px] text-app-text-secondary mb-3">
                      {selectedReturn.notes.map((n, i) => (
                        <div key={i} className="bg-[#121424] p-2 rounded border border-app-border leading-relaxed">
                          {n}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddNoteSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Write auditor logs (Press Enter to submit)..."
                        className="flex-1 px-2.5 py-1.5 bg-[#121424] border border-app-border rounded text-xs text-app-text-secondary placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 bg-app-bg hover:bg-slate-700 text-app-text-secondary font-bold rounded text-xs transition-colors"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PICTURE ZOOM VIEW LIGHTBOX */}
      <AnimatePresence>
        {zoomImg && (
          <div 
            className="fixed inset-0 bg-app-card/20 flex items-center justify-center p-4 z-50 cursor-zoom-out"
            onClick={() => setZoomImg(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-3xl w-full"
            >
              <img src={zoomImg} alt="Evidence high-res view" className="w-full h-auto rounded border border-app-border shadow-2xl" />
              <button 
                onClick={() => setZoomImg(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-app-card/20 text-app-text-primary hover:bg-app-card/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
