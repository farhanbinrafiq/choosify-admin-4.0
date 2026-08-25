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
import { Badge, BadgeVariant } from '../../components/ui/Badge';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, TabItem } from '../../components/ui/Tabs';

const COLORS = ['#FF5B00', '#F59E0B', '#6C4CFF', '#16A34A', '#DC2626'];

const RETURN_STATUS_VARIANT: Record<string, BadgeVariant> = {
  initiated: 'warning',
  dispute: 'danger',
  rejected: 'neutral',
  approved: 'info',
  returned_in_transit: 'accent',
  received: 'success',
  refunded: 'success',
};

const REFUND_STATUS_VARIANT: Record<string, BadgeVariant> = {
  processed: 'success',
  failed: 'danger',
  pending: 'warning',
};

export default function ReturnsPage() {
  const {
    returnRequests,
    loading: returnsLoading,
    error: returnsError,
    refresh: refreshReturns,
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

  // Tracks which async action is currently in flight so buttons can disable
  // themselves and we never show a success toast before the API resolves.
  const [actionBusy, setActionBusy] = useState<string | null>(null);

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

  // Tab bucket counts (also used to filter each tab's table below)
  const queueReturns = filteredReturns.filter(r => r.status === 'initiated' || r.status === 'dispute' || r.status === 'rejected');
  const transitReturns = filteredReturns.filter(r => r.status === 'approved' || r.status === 'returned_in_transit');
  const refundsReturns = filteredReturns.filter(r => r.status === 'received' || r.status === 'refunded');
  const queueCount = returnRequests.filter(r => r.status === 'initiated' || r.status === 'dispute' || r.status === 'rejected').length;
  const transitTabCount = returnRequests.filter(r => r.status === 'approved' || r.status === 'returned_in_transit').length;
  const refundsTabCount = returnRequests.filter(r => r.status === 'received' || r.status === 'refunded').length;

  const tabs: TabItem[] = [
    { key: 'queue', label: 'Return Queue', badge: queueCount },
    { key: 'transit', label: 'Logistics & Transit', badge: transitTabCount },
    { key: 'refunds', label: 'Refund Ledger', badge: refundsTabCount },
    { key: 'analytics', label: 'Insights & Analytics' },
  ];

  // Handle Note Submission
  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnId || !noteInput.trim()) return;
    setActionBusy('note');
    try {
      await addReturnNote(selectedReturnId, noteInput.trim());
      setNoteInput('');
      showToast('Internal note recorded', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record note', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  // Handle Return Approval
  const handleApprove = async () => {
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

    setActionBusy('approve');
    try {
      await approveReturn(selectedReturnId, refundInput, 'Approved by Administrator Panel.');
      showToast('Return Request Approved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve return', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  // Handle Return Rejection
  const handleReject = async () => {
    if (!selectedReturnId) return;
    if (!rejectReasonInput.trim()) {
      showToast('A reason is required to reject a return.', 'error');
      return;
    }
    setActionBusy('reject');
    try {
      await rejectReturn(selectedReturnId, rejectReasonInput.trim());
      showToast('Return Request Rejected', 'info');
      setIsRejecting(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reject return', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  // Handle Process Refund Channel
  const handleProcessRefund = async () => {
    if (!selectedReturnId) return;
    setActionBusy('refund');
    try {
      await processRefund(selectedReturnId);
      showToast('Refund marked as successfully processed!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to process refund', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  // Handle Prepaid Return Label Generation
  const handlePrintLabel = async () => {
    if (!selectedReturnId) return;
    setActionBusy('label');
    try {
      const info = await generateReturnLabel(selectedReturnId);
      showToast(`Printable label generated: ${info.trackingId}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate return label', 'error');
    } finally {
      setActionBusy(null);
    }
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

  // Real counts only — the Returns API has no endpoint for a seller's total
  // fulfillment count, so a genuine "return rate %" can't be computed here.
  // Showing a fabricated denominator would misrepresent seller performance.
  const getSellerReturnCounts = () => {
    const sellersMap: Record<string, { sellerId: string; returned: number }> = {};
    returnRequests.forEach(r => {
      if (!sellersMap[r.sellerId]) {
        sellersMap[r.sellerId] = { sellerId: r.sellerId, returned: 0 };
      }
      sellersMap[r.sellerId].returned++;
    });
    return Object.values(sellersMap).sort((a, b) => b.returned - a.returned);
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

  const secondaryBtn = 'px-3 py-1.5 bg-white border border-app-border text-app-text-secondary text-xs font-extrabold rounded-md hover:border-app-accent hover:text-app-accent transition-all';
  const primaryBtn = 'px-4 py-2 bg-app-accent hover:bg-[#E64A00] text-white text-xs font-extrabold uppercase tracking-wide rounded-md transition-all shadow-sm';

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary p-4 sm:p-6 font-sans">

      {/* Toast alert notice */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-md shadow-lg border text-sm font-bold max-w-sm ${
              toast.type === 'success' ? 'bg-[#F0FDF4] text-[#16A34A] border-[#86EFAC]' :
              toast.type === 'error' ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]' :
              'bg-white text-app-text-primary border-app-border'
            }`}
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${toast.type === 'success' ? 'bg-[#16A34A]' : toast.type === 'error' ? 'bg-[#DC2626]' : 'bg-app-accent'} animate-pulse`} />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION WITH FILTER SLIDER */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-app-border pb-5">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-app-text-primary flex items-center space-x-2">
            <Package className="w-5 h-5 text-app-accent" />
            <span>Returns & Refunds Control Desk</span>
          </h1>
          <p className="text-xs font-semibold text-app-text-muted mt-1">
            Audit customer return complaints, process reverse logistics, and handle payment ledger refunds
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-white border border-app-border rounded-md p-1">
            <Calendar className="w-3.5 h-3.5 text-app-text-muted ml-1.5" />
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1 text-[10px] font-extrabold rounded uppercase tracking-wider transition-all ${
                  dateRange === range ? 'bg-app-accent text-white' : 'text-app-text-muted hover:text-app-text-primary'
                }`}
              >
                Last {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List load state — never leave a failed fetch silently showing an empty table */}
      {returnsError && (
        <div className="mb-6 flex items-center justify-between gap-2 text-xs text-[#DC2626] bg-[#FEF2F2] border border-[#FCA5A5] rounded-md p-4">
          <span className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Failed to load returns: {returnsError}
          </span>
          <button
            onClick={refreshReturns}
            className="font-extrabold underline cursor-pointer border-0 bg-transparent text-[#DC2626]"
          >
            Retry
          </button>
        </div>
      )}
      {returnsLoading && returnRequests.length === 0 && !returnsError && (
        <div className="mb-6 flex items-center gap-2 text-xs text-app-text-muted bg-white border border-app-border rounded-md p-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading return requests…
        </div>
      )}

      {/* STATS COUNT GRID SECTION */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatTile label="Initiated" value={returnRequests.filter(r => r.status === 'initiated').length} icon={Package} accent="orange" />
        <StatTile label="Approved" value={approvedCount} icon={CheckCircle} accent="indigo" />
        <StatTile label="In Transit" value={transitCount} icon={Truck} accent="slate" />
        <StatTile label="Refunded" value={refundedCount} icon={DollarSign} accent="emerald" />
        <div className="col-span-2 md:col-span-1">
          <StatTile label="Disputes" value={activeDisputesCount} icon={AlertTriangle} accent="rose" />
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-white border border-app-border p-3.5 rounded-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-app-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search return by Request ID, Order code, or customer name..."
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-app-bg border border-app-border rounded-md text-app-text-secondary placeholder-app-text-muted focus:outline-none focus:border-app-accent transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 p-0.5 rounded text-app-text-muted hover:text-app-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns filters */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Reason filter */}
          <div className="flex items-center space-x-1 bg-app-bg border border-app-border rounded-md px-2 py-1.5">
            <Filter className="w-3.5 h-3.5 text-app-text-muted" />
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="bg-transparent border-none text-app-text-secondary text-xs font-semibold focus:outline-none pr-1"
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
          <div className="flex items-center space-x-1 bg-app-bg border border-app-border rounded-md px-2 py-1.5">
            <Clock className="w-3.5 h-3.5 text-app-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-app-text-secondary text-xs font-semibold focus:outline-none pr-1"
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as typeof activeTab)} className="border-b-0" />

        {activeTab === 'refunds' && (
          <div className="flex items-center space-x-2 pb-2">
            <button
              onClick={handleExportRefundBatch}
              className={secondaryBtn + ' flex items-center space-x-1.5'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Refund Batch</span>
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTAINER PANELS */}
      <div className="bg-white border border-app-border rounded-lg shadow-sm overflow-hidden">

        {/* TAB 1: RETURN QUEUE */}
        {activeTab === 'queue' && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-app-border text-[10px] text-app-text-disabled uppercase tracking-widest font-extrabold">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Customer Info</th>
                  <th className="p-4">Return Reason</th>
                  <th className="p-4">Requested Refund</th>
                  <th className="p-4">Return Status</th>
                  <th className="p-4 text-right">Action Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F5] text-xs">
                {queueReturns.length > 0 ? (
                  queueReturns.map(ret => {
                      const order = orders.find(o => o.id === ret.orderId);
                      const customerName = order?.customer.name || 'Unknown Buyer';
                      const customerEmail = order?.customer.email || 'N/A';
                      const productPrice = order?.total_payable || order?.product.price || 0;

                      return (
                        <tr key={ret.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="p-4 font-bold font-mono text-app-accent">{ret.id}</td>
                          <td className="p-4 font-mono font-semibold text-app-text-secondary">{ret.orderId}</td>
                          <td className="p-4">
                            <div className="font-bold text-app-text-primary">{customerName}</div>
                            <div className="text-[10px] font-semibold text-app-text-disabled font-mono">{customerEmail}</div>
                          </td>
                          <td className="p-4">
                            <span className="capitalize font-bold text-app-text-secondary">
                              {ret.reason.replace(/_/g, ' ')}
                            </span>
                            <p className="text-[10px] font-semibold text-app-text-disabled truncate max-w-[200px]" title={ret.description}>
                              {ret.description}
                            </p>
                          </td>
                          <td className="p-4 font-extrabold font-mono text-app-text-primary">
                            ৳{productPrice.toLocaleString()}
                          </td>
                          <td className="p-4">
                            <Badge variant={RETURN_STATUS_VARIANT[ret.status] || 'neutral'}>
                              {ret.status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedReturnId(ret.id)}
                              className={secondaryBtn}
                            >
                              Process Return
                            </button>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-app-text-muted font-mono text-xs">
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
                <tr className="bg-[#F9FAFB] border-b border-app-border text-[10px] text-app-text-disabled uppercase tracking-widest font-extrabold">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Courier Partner</th>
                  <th className="p-4">Tracking Code</th>
                  <th className="p-4">Approved BDT</th>
                  <th className="p-4">Logistics Status</th>
                  <th className="p-4 text-right">Action Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F5] text-xs">
                {transitReturns.length > 0 ? (
                  transitReturns.map(ret => {
                      return (
                        <tr key={ret.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="p-4 font-bold font-mono text-app-accent">{ret.id}</td>
                          <td className="p-4 font-mono font-semibold text-app-text-secondary">{ret.orderId}</td>
                          <td className="p-4 font-bold text-app-text-primary">
                            {ret.returnCourier || '[Courier Unassigned]'}
                          </td>
                          <td className="p-4 font-mono">
                            {ret.returnTrackingId ? (
                              <span className="bg-app-bg border border-app-border px-2 py-1 rounded text-app-text-secondary font-semibold select-all">
                                {ret.returnTrackingId}
                              </span>
                            ) : (
                              <span className="text-app-text-disabled font-bold lowercase italic">waiting generation</span>
                            )}
                          </td>
                          <td className="p-4 font-extrabold font-mono text-app-text-primary">
                            ৳{(ret.refundAmount || 0).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <Badge variant={RETURN_STATUS_VARIANT[ret.status] || 'neutral'}>
                              {ret.status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {ret.returnTrackingId && (
                              <a
                                href={`https://track.pathao.com/ret/${ret.returnTrackingId}`}
                                target="_blank"
                                rel="noreferrer"
                                className={secondaryBtn + ' inline-flex items-center space-x-1'}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Track</span>
                              </a>
                            )}
                            <button
                              onClick={() => setSelectedReturnId(ret.id)}
                              className={secondaryBtn}
                            >
                              Dispatch Logistics
                            </button>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-app-text-muted font-mono text-xs">
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
                <tr className="bg-[#F9FAFB] border-b border-app-border text-[10px] text-app-text-disabled uppercase tracking-widest font-extrabold">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Customer Info</th>
                  <th className="p-4">Refund Amount</th>
                  <th className="p-4">Channel Status</th>
                  <th className="p-4">Resolution Date</th>
                  <th className="p-4 text-right">Refund Action Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F5] text-xs">
                {refundsReturns.length > 0 ? (
                  refundsReturns.map(ret => {
                      const order = orders.find(o => o.id === ret.orderId);
                      const customerName = order?.customer.name || 'Unknown Buyer';
                      const customerEmail = order?.customer.email || 'N/A';

                      return (
                        <tr key={ret.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="p-4 font-bold font-mono text-app-accent">{ret.id}</td>
                          <td className="p-4">
                            <div className="font-bold text-app-text-primary">{customerName}</div>
                            <div className="text-[10px] font-semibold text-app-text-disabled font-mono">{customerEmail}</div>
                          </td>
                          <td className="p-4 font-extrabold font-mono text-app-accent">
                            ৳{(ret.refundAmount || 0).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <Badge variant={REFUND_STATUS_VARIANT[ret.refundStatus] || 'neutral'}>
                              {ret.refundStatus}
                            </Badge>
                          </td>
                          <td className="p-4 text-app-text-secondary font-mono font-semibold">
                            {new Date(ret.updatedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedReturnId(ret.id)}
                              className={secondaryBtn}
                            >
                              Manage Refund
                            </button>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-app-text-muted font-mono text-xs">
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
              <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-app-text-disabled mb-4">
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
              <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-app-text-disabled mb-4">
                  Daily Reverse Logistics Pipeline Trend (7 Days)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={get7DayTrendData()}>
                      <defs>
                        <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF5B00" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#FF5B00" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF2" />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} />
                      <YAxis stroke="#9CA3AF" fontSize={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="Returns" stroke="#FF5B00" fillOpacity={1} fill="url(#colorReturns)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Performance table and Common factors row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Merchant return rates */}
              <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg lg:col-span-2">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-app-text-disabled mb-4">
                  Returns Logged by Seller
                </h3>
                <p className="text-[10px] font-semibold text-app-text-muted mb-3">
                  A return-rate percentage would require each seller&apos;s total fulfillment count, which this API doesn&apos;t
                  expose — showing counts only rather than guessing a denominator.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-app-border font-extrabold uppercase text-[10px] text-app-text-disabled">
                        <th className="pb-2">Seller ID</th>
                        <th className="pb-2 text-right">Returns Logged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F3F5] text-app-text-secondary">
                      {getSellerReturnCounts().length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-6 text-center text-app-text-disabled italic">
                            No returns logged for this period.
                          </td>
                        </tr>
                      ) : (
                        getSellerReturnCounts().map((s) => (
                          <tr key={s.sellerId} className="hover:bg-white">
                            <td className="py-2.5 font-bold text-app-text-primary font-mono">{s.sellerId}</td>
                            <td className="py-2.5 text-right font-mono font-extrabold text-app-accent">{s.returned}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick advice/audit center info — derived from real fetched reason breakdown only */}
              <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-app-accent tracking-wider mb-2">
                    Logistics Health Summary
                  </h4>
                  {(() => {
                    const reasons = getReasonChartData();
                    const total = reasons.reduce((sum, r) => sum + r.value, 0);
                    const top = reasons.reduce((best, r) => (r.value > best.value ? r : best), reasons[0]);
                    if (!total || !top) {
                      return (
                        <p className="text-[11px] font-semibold text-app-text-muted leading-relaxed">
                          Not enough return data in this period to summarize a leading reason.
                        </p>
                      );
                    }
                    const pct = ((top.value / total) * 100).toFixed(0);
                    return (
                      <p className="text-[11px] font-semibold text-app-text-secondary leading-relaxed mb-3">
                        <strong>{top.name}</strong> is the leading reason, at {pct}% of the {total} return{total === 1 ? '' : 's'}{' '}
                        logged in this period.
                      </p>
                    );
                  })()}
                  <p className="text-[11px] font-semibold text-app-text-muted leading-relaxed">
                    Flag merchant profiles with a rising count of logged returns for follow-up.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* DETAIL AUDIT & PROCESS MODAL */}
      <AnimatePresence>
        {selectedReturnId && selectedReturn && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-app-border rounded-lg max-w-4xl w-full shadow-2xl overflow-hidden my-8"
            >

              {/* Modal Title bar */}
              <div className="bg-[#F9FAFB] border-b border-app-border px-5 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-app-accent animate-ping" />
                  <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-text-primary">
                    Audit Return: <span className="text-app-accent font-mono">{selectedReturn.id}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedReturnId(null)}
                  className="p-1 rounded text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Split layout inside modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-app-border">

                {/* LEFT SIDE: INITIATOR AND EVIDENCE DETS */}
                <div className="p-5 space-y-4">

                  {/* Customer Information */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-app-text-disabled tracking-widest mb-1.5">
                      Initiating Customer
                    </h4>
                    {(() => {
                      const order = orders.find(o => o.id === selectedReturn.orderId);
                      return (
                        <div className="bg-[#F9FAFB] border border-app-border p-3 rounded-md flex items-center justify-between">
                          <div>
                            <div className="font-bold text-app-text-primary text-xs">{order?.customer.name || 'Unknown'}</div>
                            <div className="text-[10px] font-semibold text-app-text-disabled font-mono">{order?.customer.email || 'N/A'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] uppercase font-extrabold text-app-text-disabled">Total Purchase</div>
                            <div className="text-xs font-extrabold font-mono text-app-text-primary mt-0.5">
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
                      <span className="text-[10px] font-extrabold uppercase text-app-text-disabled tracking-widest">
                        Return Reason:
                      </span>
                      <span className="capitalize text-xs font-extrabold text-app-text-primary bg-[#F9FAFB] border border-app-border px-2 py-0.5 rounded">
                        {selectedReturn.reason.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="bg-[#F9FAFB] border border-app-border p-3 rounded-md text-xs font-semibold text-app-text-secondary min-h-[60px] leading-relaxed">
                      {selectedReturn.description}
                    </div>
                  </div>

                  {/* Evidence Photo Grid with high-res zoom triggers */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-app-text-disabled tracking-widest mb-2">
                      Evidence Photos ({selectedReturn.evidencePhotos.length})
                    </h4>
                    {selectedReturn.evidencePhotos.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {selectedReturn.evidencePhotos.map((img, i) => (
                          <div
                            key={i}
                            onClick={() => setZoomImg(img)}
                            className="relative group aspect-square rounded-md overflow-hidden bg-white border border-app-border cursor-zoom-in"
                          >
                            <img src={img} alt="evidence" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-md text-center text-app-text-disabled font-mono text-[11px] font-semibold">
                        No evidence photographs uploaded with request.
                      </div>
                    )}
                  </div>

                  {/* Print shipment return label */}
                  <div className="pt-2">
                    <button
                      onClick={handlePrintLabel}
                      disabled={actionBusy === 'label'}
                      className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-white hover:border-app-accent hover:text-app-accent text-app-text-secondary border border-app-border rounded-md text-xs font-extrabold transition-all disabled:opacity-60"
                    >
                      <Printer className="w-4 h-4 text-app-accent" />
                      <span>{actionBusy === 'label' ? 'Generating…' : 'Print Prepaid Shipping Return Label'}</span>
                    </button>
                  </div>

                  {/* Status progression Timeline */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-app-text-disabled tracking-widest mb-3">
                      Logistics Pipeline Status
                    </h4>
                    <div className="relative pl-5 border-l-2 border-app-border space-y-4 text-[11px]">

                      <div className="relative">
                        <span className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-app-accent border-2 border-white" />
                        <div className="font-bold text-app-text-secondary">Complaint Initiated</div>
                        <div className="text-[9px] font-semibold text-app-text-disabled font-mono">
                          {new Date(selectedReturn.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="relative">
                        <span className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          selectedReturn.status !== 'initiated' ? 'bg-app-accent' : 'bg-app-border'
                        }`} />
                        <div className="font-bold text-app-text-secondary">Review & Approved</div>
                        {selectedReturn.approvedAt && (
                          <div className="text-[9px] font-semibold text-app-text-disabled font-mono">
                            {new Date(selectedReturn.approvedAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <span className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          selectedReturn.status === 'returned_in_transit' || selectedReturn.status === 'received' || selectedReturn.status === 'refunded' ? 'bg-[#6C4CFF]' : 'bg-app-border'
                        }`} />
                        <div className="font-bold text-app-text-secondary">Transit & Logistics Pickup</div>
                      </div>

                      <div className="relative">
                        <span className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          selectedReturn.status === 'received' || selectedReturn.status === 'refunded' ? 'bg-[#16A34A]' : 'bg-app-border'
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
                    <h4 className="text-[10px] font-extrabold uppercase text-app-text-disabled tracking-widest">
                      Auditor Control Actions
                    </h4>

                    {/* Pending review approvals */}
                    {selectedReturn.status === 'initiated' && (
                      <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg space-y-3">
                        <p className="text-[11px] font-semibold text-app-text-secondary leading-relaxed">
                          Analyze complaint details. To approve, specify correct refund ledger value (cannot exceed order total).
                        </p>

                        {!isRejecting ? (
                          <>
                            <div>
                              <label className="text-[9px] font-extrabold text-app-text-disabled uppercase tracking-wider block mb-1">
                                Lock Refund Ledger (BDT)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-xs font-bold text-app-text-secondary">৳</span>
                                <input
                                  type="number"
                                  value={refundInput}
                                  onChange={(e) => setRefundInput(parseFloat(e.target.value) || 0)}
                                  className="w-full pl-6 pr-3 py-1.5 bg-white border border-app-border rounded-md text-xs font-bold font-mono text-app-accent"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setIsRejecting(true)}
                                disabled={actionBusy === 'approve'}
                                className="px-3 py-2 bg-white text-[#DC2626] border border-app-border hover:bg-[#FEF2F2] text-xs font-extrabold rounded-md transition-all disabled:opacity-60"
                              >
                                Reject Return
                              </button>
                              <button
                                onClick={handleApprove}
                                disabled={actionBusy === 'approve'}
                                className="px-4 py-2 bg-app-accent hover:bg-[#E64A00] text-white text-xs font-extrabold uppercase tracking-wider rounded-md transition-all shadow-sm disabled:opacity-60"
                              >
                                {actionBusy === 'approve' ? 'Approving…' : 'Approve Return'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[9px] font-extrabold text-app-text-disabled uppercase tracking-wider block mb-1">
                                Rejection Justification
                              </label>
                              <textarea
                                value={rejectReasonInput}
                                onChange={(e) => setRejectReasonInput(e.target.value)}
                                placeholder="Describe why this complaint is rejected (e.g. item worn/missing box)..."
                                className="w-full px-3 py-1.5 bg-white border border-app-border rounded-md text-xs font-semibold text-app-text-secondary placeholder-app-text-disabled focus:outline-none"
                                rows={2}
                              />
                            </div>
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setIsRejecting(false)}
                                disabled={actionBusy === 'reject'}
                                className="px-3 py-1.5 text-xs font-bold text-app-text-secondary hover:text-app-text-primary transition-colors disabled:opacity-60"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleReject}
                                disabled={actionBusy === 'reject'}
                                className="px-4 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-extrabold rounded-md transition-all disabled:opacity-60"
                              >
                                {actionBusy === 'reject' ? 'Rejecting…' : 'Confirm Rejection'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Logistics Courier assignment controls */}
                    {selectedReturn.status === 'approved' && (
                      <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg space-y-3">
                        <div className="text-[11px] font-bold text-app-text-secondary">
                          Configure Reverse Shipment Courier
                        </div>
                        <p className="text-[10px] font-semibold text-app-text-disabled leading-relaxed">
                          Provide courier routing information to notify courier warehouse pickup.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] font-extrabold text-app-text-disabled uppercase tracking-wider block mb-1">
                              Courier
                            </label>
                            <select
                              value={courierInput}
                              onChange={(e) => setCourierInput(e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-app-border rounded-md text-xs font-semibold text-app-text-secondary focus:outline-none"
                            >
                              <option value="Pathao Delivery">Pathao Delivery</option>
                              <option value="Steadfast Courier">Steadfast Courier</option>
                              <option value="Paperfly">Paperfly</option>
                              <option value="RedX">RedX Logistics</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[8px] font-extrabold text-app-text-disabled uppercase tracking-wider block mb-1">
                              Tracking ID
                            </label>
                            <input
                              type="text"
                              value={trackingIdInput}
                              onChange={(e) => setTrackingIdInput(e.target.value)}
                              placeholder="e.g. TRACK-91283"
                              className="w-full px-2 py-1.5 bg-white border border-app-border rounded-md text-xs font-semibold text-app-text-secondary focus:outline-none"
                            />
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            if (!trackingIdInput.trim()) {
                              showToast('Please specify a valid tracking identifier.', 'error');
                              return;
                            }
                            setActionBusy('transit');
                            try {
                              await updateReturnStatus(selectedReturn.id, 'returned_in_transit');
                              showToast('Logistics configured & transit started', 'success');
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
                            } finally {
                              setActionBusy(null);
                            }
                          }}
                          disabled={actionBusy === 'transit'}
                          className="w-full py-2 bg-app-accent hover:bg-[#E64A00] text-white text-xs font-extrabold rounded-md transition-all disabled:opacity-60"
                        >
                          {actionBusy === 'transit' ? 'Updating…' : 'Mark as Shipped/In Transit'}
                        </button>
                      </div>
                    )}

                    {/* Item receipt verification */}
                    {selectedReturn.status === 'returned_in_transit' && (
                      <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg space-y-3">
                        <div className="text-[11px] font-bold text-app-text-secondary">
                          Inspect & Verify Returned Goods
                        </div>
                        <p className="text-[10px] font-semibold text-app-text-disabled leading-relaxed">
                          Once the return package lands in the seller warehouse, mark as received to trigger final refund ledger step.
                        </p>
                        <button
                          onClick={async () => {
                            setActionBusy('received');
                            try {
                              await updateReturnStatus(selectedReturn.id, 'received');
                              showToast('Item received and logged into ERP ledger.', 'success');
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
                            } finally {
                              setActionBusy(null);
                            }
                          }}
                          disabled={actionBusy === 'received'}
                          className="w-full py-2 bg-app-accent hover:bg-[#E64A00] text-white text-xs font-extrabold rounded-md transition-all disabled:opacity-60"
                        >
                          {actionBusy === 'received' ? 'Updating…' : 'Mark as Received at Warehouse'}
                        </button>
                      </div>
                    )}

                    {/* Process Refund to Gateway */}
                    {selectedReturn.status === 'received' && (
                      <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg space-y-3">
                        <div className="text-[11px] font-bold text-app-text-secondary">
                          Ready for Payment Refund Channels
                        </div>
                        <p className="text-[10px] font-semibold text-app-text-disabled leading-relaxed">
                          Verification successfully audited. Click to authorize BDT <strong>৳{(selectedReturn.refundAmount || 0).toLocaleString()}</strong> payout back to customer's source account.
                        </p>
                        <button
                          onClick={handleProcessRefund}
                          disabled={actionBusy === 'refund'}
                          className="w-full py-2 bg-app-accent hover:bg-[#E64A00] text-white text-xs font-extrabold rounded-md transition-all disabled:opacity-60"
                        >
                          {actionBusy === 'refund' ? 'Processing…' : 'Process & Issue Refund Payment'}
                        </button>
                      </div>
                    )}

                    {/* Resolved view */}
                    {(selectedReturn.status === 'refunded' || selectedReturn.status === 'rejected') && (
                      <div className="bg-[#F9FAFB] border border-app-border p-4 rounded-lg text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto" />
                        <div className="text-xs font-extrabold text-app-text-primary uppercase tracking-wider">
                          Taxonomy Rule Closed
                        </div>
                        <p className="text-[11px] font-semibold text-app-text-disabled leading-relaxed">
                          This return complaint has reached a final resolution state and the order ledger remains locked.
                        </p>
                      </div>
                    )}

                    {/* Dispute escalation tool */}
                    {selectedReturn.status !== 'dispute' && selectedReturn.status !== 'refunded' && selectedReturn.status !== 'rejected' && (
                      <div className="border-t border-app-border pt-3 flex justify-between items-center text-xs">
                        <span className="text-app-text-muted font-semibold">Logistics conflict?</span>
                        <button
                          type="button"
                          onClick={async () => {
                            setActionBusy('dispute');
                            try {
                              await linkReturnToDispute(selectedReturn.id, `DISP-${Math.floor(1000 + Math.random() * 9000)}`);
                              showToast('Return escalated to Dispute channels', 'info');
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Failed to escalate return', 'error');
                            } finally {
                              setActionBusy(null);
                            }
                          }}
                          disabled={actionBusy === 'dispute'}
                          className="text-[#DC2626] hover:text-[#B91C1C] font-extrabold hover:underline disabled:opacity-60"
                        >
                          {actionBusy === 'dispute' ? 'Escalating…' : 'Escalate to Dispute Resolution'}
                        </button>
                      </div>
                    )}

                  </div>

                  {/* NOTE KEEPER LOG */}
                  <div className="flex-1 flex flex-col min-h-[160px] bg-[#F9FAFB] border border-app-border p-3 rounded-lg">
                    <h5 className="text-[9px] font-extrabold text-app-text-disabled uppercase tracking-wider mb-2 flex items-center space-x-1">
                      <MessageSquare className="w-3.5 h-3.5 text-app-text-disabled" />
                      <span>Internal Admin Notes Log</span>
                    </h5>

                    <div className="flex-1 overflow-y-auto max-h-[120px] custom-scrollbar space-y-2 pr-1 text-[10px] font-semibold text-app-text-secondary mb-3">
                      {selectedReturn.notes.map((n, i) => (
                        <div key={i} className="bg-white p-2 rounded border border-app-border leading-relaxed">
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
                        className="flex-1 px-2.5 py-1.5 bg-white border border-app-border rounded-md text-xs font-semibold text-app-text-secondary placeholder-app-text-disabled focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={actionBusy === 'note'}
                        className="px-3 bg-white border border-app-border hover:border-app-accent hover:text-app-accent text-app-text-secondary font-extrabold rounded-md text-xs transition-colors disabled:opacity-60"
                      >
                        {actionBusy === 'note' ? '…' : 'Add'}
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
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 cursor-zoom-out"
            onClick={() => setZoomImg(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-3xl w-full"
            >
              <img src={zoomImg} alt="Evidence high-res view" className="w-full h-auto rounded-md border border-app-border shadow-2xl" />
              <button
                onClick={() => setZoomImg(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
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
