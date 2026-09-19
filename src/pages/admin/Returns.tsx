import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReturns } from '../../contexts/ReturnsContext';
import { useOrders } from '../../contexts/OrdersContext';
import {
  Package, Truck, CheckCircle, DollarSign, AlertTriangle,
  Search, Calendar, Filter, Clock, X, RefreshCw,
  ExternalLink, Download
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
  } = useReturns();

  const { orders } = useOrders();
  const navigate = useNavigate();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [reasonFilter, setReasonFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Tabs: 'queue' | 'transit' | 'refunds' | 'analytics'
  const [activeTab, setActiveTab] = useState<'queue' | 'transit' | 'refunds' | 'analytics'>('queue');

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

  const openCase = (id: string) => navigate(`/admin/returns/${id}`);

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
                          <td className="p-4 font-bold font-mono text-app-accent">
                            <button type="button" onClick={() => openCase(ret.id)} className="hover:underline cursor-pointer">
                              {ret.referenceId || ret.id}
                            </button>
                          </td>
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
                              onClick={() => openCase(ret.id)}
                              className={secondaryBtn}
                            >
                              Review Request
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
                          <td className="p-4 font-bold font-mono text-app-accent">
                            <button type="button" onClick={() => openCase(ret.id)} className="hover:underline cursor-pointer">
                              {ret.referenceId || ret.id}
                            </button>
                          </td>
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
                              onClick={() => openCase(ret.id)}
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
                          <td className="p-4 font-bold font-mono text-app-accent">
                            <button type="button" onClick={() => openCase(ret.id)} className="hover:underline cursor-pointer">
                              {ret.referenceId || ret.id}
                            </button>
                          </td>
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
                              onClick={() => openCase(ret.id)}
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


    </div>
  );
}
