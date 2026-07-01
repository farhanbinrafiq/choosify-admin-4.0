import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User, 
  TrendingUp, 
  BarChart3, 
  ListFilter, 
  Send, 
  Upload, 
  ShieldCheck, 
  Undo2, 
  Download, 
  AlertCircle, 
  ArrowRight, 
  Search, 
  ChevronDown, 
  Plus, 
  FileText, 
  Layers, 
  UserCheck,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { toast } from 'react-hot-toast';
import { 
  useDisputes, 
  Dispute, 
  DisputeType, 
  DisputeStatus, 
  ResolutionType, 
  DisputeParticipant, 
  addBusinessDays, 
  getDaysRemaining 
} from '../../contexts/DisputeContext';
import { useTrust } from '../../contexts/TrustContext';

// Standard colors for Recharts
const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

export default function DisputeCenter() {
  const { 
    disputes, 
    activeDisputeId, 
    setActiveDisputeId, 
    createDispute, 
    updateDisputeStatus, 
    assignDispute, 
    addMessage, 
    addEvidence, 
    resolveDispute, 
    escalateDispute, 
    dismissDispute, 
    reopenDispute, 
    getOverdueDisputes, 
    generateDisputeReport,
    undoLastStatusChange
  } = useDisputes();

  const { trustScores } = useTrust();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'active' | 'detail' | 'history' | 'escalated' | 'analytics'>('active');

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'sla' | 'created' | 'severity'>('sla');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyResFilter, setHistoryResFilter] = useState<string>('all');

  // Active pagination
  const [activePage, setActivePage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Modal arguments/inputs
  const [statusModalConfig, setStatusModalConfig] = useState<{ disputeId: string; nextStatus: DisputeStatus } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [evidenceType, setEvidenceType] = useState<'image' | 'document' | 'message' | 'order_detail'>('image');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [assignDisputeId, setAssignDisputeId] = useState<string | null>(null);
  const [assignAdminId, setAssignAdminId] = useState('usr_admin_001');
  const [assignAdminName, setAssignAdminName] = useState('Principal Auditor');

  // Resolution inputs (integrated inside right panel and resolution modal)
  const [resType, setResType] = useState<ResolutionType>('refund_full');
  const [resAmount, setResAmount] = useState<number>(0);
  const [resNotes, setResNotes] = useState('');

  // Create dispute form inputs
  const [newBuyerId, setNewBuyerId] = useState('');
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newSellerId, setNewSellerId] = useState('');
  const [newSellerName, setNewSellerName] = useState('');
  const [newType, setNewType] = useState<DisputeType>('order_issue');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOrderId, setNewOrderId] = useState('');
  const [newSeverity, setNewSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [newPriority, setNewPriority] = useState<'normal' | 'urgent'>('normal');

  // Message composer state
  const [composerText, setComposerText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<string[]>([]);

  // Expand image state
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Active dispute object derived from state
  const currentDispute = useMemo(() => {
    return disputes.find(d => d.id === activeDisputeId) || null;
  }, [disputes, activeDisputeId]);

  // SLA Stats indicators
  const stats = useMemo(() => {
    const overdue = getOverdueDisputes().length;
    const inProgress = disputes.filter(d => d.status === 'in_investigation' || d.status === 'mediation').length;
    const resolvedThisMonth = disputes.filter(d => {
      if (d.status !== 'resolved' && d.status !== 'closed') return false;
      const resolvedDate = d.resolvedAt ? new Date(d.resolvedAt) : new Date(d.lastUpdatedAt);
      const now = new Date();
      return resolvedDate.getMonth() === now.getMonth() && resolvedDate.getFullYear() === now.getFullYear();
    }).length;

    return { overdue, inProgress, resolvedThisMonth };
  }, [disputes, getOverdueDisputes]);

  // Filtered Disputes for main active queue
  const filteredActiveQueue = useMemo(() => {
    return disputes
      .filter(d => d.status !== 'resolved' && d.status !== 'closed')
      .filter(d => {
        const matchesSearch = 
          d.disputeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.seller.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesType = typeFilter === 'all' || d.type === typeFilter;
        const matchesSeverity = severityFilter === 'all' || d.severity === severityFilter;

        return matchesSearch && matchesType && matchesSeverity;
      })
      .sort((a, b) => {
        if (sortBy === 'sla') {
          return new Date(a.dueDateForResolution).getTime() - new Date(b.dueDateForResolution).getTime();
        } else if (sortBy === 'created') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else {
          const sevMap = { high: 3, medium: 2, low: 1 };
          return sevMap[b.severity] - sevMap[a.severity];
        }
      });
  }, [disputes, searchQuery, typeFilter, severityFilter, sortBy]);

  // Paginated active queue
  const paginatedActiveQueue = useMemo(() => {
    const startIndex = (activePage - 1) * itemsPerPage;
    return filteredActiveQueue.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredActiveQueue, activePage]);

  // Filtered historical disputes
  const filteredHistoryQueue = useMemo(() => {
    return disputes
      .filter(d => d.status === 'resolved' || d.status === 'closed')
      .filter(d => {
        const matchesSearch = 
          d.disputeNumber.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
          d.title.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
          d.buyer.name.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
          d.seller.name.toLowerCase().includes(historySearchQuery.toLowerCase());
        
        const matchesRes = historyResFilter === 'all' || d.resolutionType === historyResFilter;
        return matchesSearch && matchesRes;
      });
  }, [disputes, historySearchQuery, historyResFilter]);

  // Filtered escalated disputes
  const escalatedQueue = useMemo(() => {
    return disputes.filter(d => d.status === 'escalated');
  }, [disputes]);

  // Interactive Report Analytics data
  const [reportRange, setReportRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const analyticsReport = useMemo(() => {
    return generateDisputeReport(reportRange);
  }, [disputes, reportRange, generateDisputeReport]);

  // Handle viewing detail
  const handleViewDetail = (dispute: Dispute) => {
    setActiveDisputeId(dispute.id);
    setActiveTab('detail');
  };

  // Handle message send
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() || !activeDisputeId) return;

    // Use current admin profile
    const sender: DisputeParticipant = {
      id: 'usr_admin_001',
      type: 'admin',
      name: 'Principal Mediator'
    };

    addMessage(activeDisputeId, composerText, isInternalNote, sender);
    toast.success(isInternalNote ? 'Internal administrative note pinned.' : 'Message broadcasted to case participants.');
    setComposerText('');
  };

  // CSV Exporter for local legal/audit logging compliance
  const handleExportCSV = () => {
    const headers = 'Dispute Number,Status,Type,Severity,Priority,Buyer,Seller,Title,Resolution Type,Resolution Amount,Created At,Resolved At\n';
    const rows = disputes.map(d => {
      return `"${d.disputeNumber}","${d.status}","${d.type}","${d.severity}","${d.priority}","${d.buyer.name}","${d.seller.name}","${d.title.replace(/"/g, '""')}","${d.resolutionType || ''}","${d.resolutionAmount || 0}","${d.createdAt}","${d.resolvedAt || ''}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Choosify_Disputes_Legal_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Dispute registry compiled & downloaded as CSV.');
  };

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Alt + Number to switch tabs
      if (e.altKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const tabMap: Record<string, typeof activeTab> = {
          '1': 'active',
          '2': 'detail',
          '3': 'history',
          '4': 'escalated',
          '5': 'analytics'
        };
        setActiveTab(tabMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800" id="dispute-center-root">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-5" id="dispute-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-mono font-medium">TRUST & SAFETY OPERATIONS</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-mono font-medium">BANGLADESH HUB</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Dispute Resolution Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administrative intake, evidence discovery, mediation protocols, and unified SLA enforcement scoring.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button 
            id="export-disputes-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Legal Audit Export
          </button>
          
          <button 
            id="file-dispute-btn"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-app-card hover:bg-slate-800 text-app-text-primary px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-app-text-primary" />
            Intake New Complaint
          </button>
        </div>
      </div>

      {/* SLA Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" id="dispute-sla-stats">
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider font-mono">Overdue Breached Cases</div>
            <div className="text-2xl font-bold text-rose-700 font-mono mt-0.5">
              {stats.overdue} <span className="text-xs font-normal text-app-text-secondary font-sans">cases past SLA</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider font-mono">Mediation & Investigation</div>
            <div className="text-2xl font-bold text-amber-700 font-mono mt-0.5">
              {stats.inProgress} <span className="text-xs font-normal text-app-text-secondary font-sans">cases actively reviewed</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider font-mono">Resolved This Month</div>
            <div className="text-2xl font-bold text-emerald-700 font-mono mt-0.5">
              {stats.resolvedThisMonth} <span className="text-xs font-normal text-app-text-secondary font-sans">cases successfully closed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="border-b border-slate-200 mb-6 flex overflow-x-auto gap-4" id="dispute-navigation-tabs">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 text-sm font-semibold border-b-2 px-1 transition whitespace-nowrap flex items-center gap-2${
            activeTab === 'active' 
              ? 'border-app-border text-slate-950' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Active Cases Queue ({filteredActiveQueue.length})
        </button>

        <button
          onClick={() => {
            if (activeDisputeId) {
              setActiveTab('detail');
            } else {
              toast.error('Select an active case from the queue to view its detail.');
            }
          }}
          className={`pb-3 text-sm font-semibold border-b-2 px-1 transition whitespace-nowrap flex items-center gap-2${
            activeTab === 'detail' 
              ? 'border-app-border text-slate-950 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Case Workspace Details {currentDispute && `[${currentDispute.disputeNumber}]`}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-semibold border-b-2 px-1 transition whitespace-nowrap flex items-center gap-2${
            activeTab === 'history' 
              ? 'border-app-border text-slate-950' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Resolution Archive ({filteredHistoryQueue.length})
        </button>

        <button
          onClick={() => setActiveTab('escalated')}
          className={`pb-3 text-sm font-semibold border-b-2 px-1 transition whitespace-nowrap flex items-center gap-2${
            activeTab === 'escalated' 
              ? 'border-app-border text-slate-950' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          Escalated to Management ({escalatedQueue.length})
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-semibold border-b-2 px-1 transition whitespace-nowrap flex items-center gap-2${
            activeTab === 'analytics' 
              ? 'border-app-border text-slate-950' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics & Compliance Reports
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        <AnimatePresence mode="wait">
          
          {/* TAB 1: ACTIVE DISPUTES QUEUE */}
          {activeTab === 'active' && (
            <motion.div
              key="tab-active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              id="active-cases-workspace"
            >
              {/* Search and Filters Strip */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-app-text-secondary absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by DSP #, buyer, seller..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-400 focus:outline-none transition"
                  />
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-end">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-app-text-secondary font-mono">
                    <ListFilter className="w-3.5 h-3.5" />
                    FILTERS:
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 focus:outline-none text-slate-700"
                  >
                    <option value="all">All Types</option>
                    <option value="order_issue">Order Issues</option>
                    <option value="payment">Payment Concerns</option>
                    <option value="quality">Product Quality</option>
                    <option value="late_delivery">Late Delivery</option>
                    <option value="seller_misconduct">Seller Misconduct</option>
                    <option value="product_authenticity">Authenticity Breach</option>
                  </select>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 focus:outline-none text-slate-700"
                  >
                    <option value="all">All Severities</option>
                    <option value="low">Low Severity</option>
                    <option value="medium">Medium Severity</option>
                    <option value="high">High Severity</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 focus:outline-none text-slate-700"
                  >
                    <option value="sla">Sort: SLA SLA Days Left</option>
                    <option value="created">Sort: Newest Lodge Date</option>
                    <option value="severity">Sort: Peak Severity First</option>
                  </select>
                </div>
              </div>

              {/* Grid / Table Case Listing */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                        <th className="px-6 py-4">Dispute Case</th>
                        <th className="px-6 py-4">Buyer Involved</th>
                        <th className="px-6 py-4">Target Vendor</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">SLA Days Left</th>
                        <th className="px-6 py-4">Severity</th>
                        <th className="px-6 py-4">Assigned Admin</th>
                        <th className="px-6 py-4 text-right">Administrative Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-sm">
                      {paginatedActiveQueue.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-12 text-app-text-secondary font-medium">
                            No active disputes matching your criteria are in the queue.
                          </td>
                        </tr>
                      ) : (
                        paginatedActiveQueue.map(dispute => {
                          const daysLeft = getDaysRemaining(dispute.dueDateForResolution);
                          const isOverdue = daysLeft <= 0;
                          const isCritical = daysLeft === 1 && !isOverdue;
                          
                          return (
                            <tr 
                              key={dispute.id} 
                              className={`hover:bg-slate-50 transition${isOverdue ? 'bg-rose-50/30' : isCritical ? 'bg-amber-50/20' : ''}`}
                            >
                              <td className="px-6 py-4 font-mono font-bold text-slate-900">
                                <button onClick={() => handleViewDetail(dispute)} className="hover:underline text-slate-900 cursor-pointer text-left">
                                  {dispute.disputeNumber}
                                </button>
                                <div className="text-xs text-app-text-secondary font-sans font-normal truncate max-w-xs">{dispute.title}</div>
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-800">
                                {dispute.buyer.name}
                                <div className="text-xs text-app-text-secondary font-normal">{dispute.buyer.contactInfo || 'N/A'}</div>
                              </td>
                              <td className="px-6 py-4 text-slate-700">
                                <span className="font-semibold text-slate-900">{dispute.seller.name}</span>
                                <div className="text-xs text-app-text-secondary">{dispute.seller.id}</div>
                              </td>
                              <td className="px-6 py-4 uppercase text-xs font-mono tracking-wider font-semibold">
                                {dispute.type.replace('_', ' ')}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase font-mono${
                                  dispute.status === 'open' ? 'bg-blue-100 text-blue-800' :
                                  dispute.status === 'in_investigation' ? 'bg-purple-100 text-purple-800' :
                                  dispute.status === 'mediation' ? 'bg-amber-100 text-amber-800' :
                                  dispute.status === 'escalated' ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {dispute.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {isOverdue ? (
                                  <span className="text-rose-600 font-bold font-mono text-xs flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" /> OVERDUE ({Math.abs(daysLeft)}d)
                                  </span>
                                ) : (
                                  <span className={`font-mono text-xs font-bold${isCritical ? 'text-amber-600 animate-pulse' : 'text-slate-600'}`}>
                                    {daysLeft} days remaining
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize${
                                  dispute.severity === 'high' ? 'bg-red-50 text-red-700' :
                                  dispute.severity === 'medium' ? 'bg-amber-50 text-amber-700' :
                                  'bg-blue-50 text-blue-700'
                                }`}>
                                  {dispute.severity}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                {dispute.admin ? (
                                  <span className="flex items-center gap-1">
                                    <UserCheck className="w-3.5 h-3.5 text-app-text-secondary" />
                                    {dispute.admin === 'usr_admin_001' ? 'Principal Mediator' : 'Internal Legal'}
                                  </span>
                                ) : (
                                  <span className="text-amber-500 font-bold uppercase">Unassigned</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                                {!dispute.admin && (
                                  <button
                                    onClick={() => assignDispute(dispute.id, 'usr_admin_001', 'Principal Mediator')}
                                    className="bg-amber-50 text-amber-800 hover:bg-amber-100 px-2.5 py-1.5 rounded text-xs font-semibold border border-amber-200 transition"
                                  >
                                    Claim Case
                                  </button>
                                )}
                                <button
                                  onClick={() => handleViewDetail(dispute)}
                                  className="bg-app-card hover:bg-slate-800 text-app-text-primary px-2.5 py-1.5 rounded text-xs font-semibold transition"
                                >
                                  Open Workspace
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {filteredActiveQueue.length > itemsPerPage && (
                  <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
                    <span className="text-xs text-app-text-secondary font-mono">
                      Showing {(activePage-1)*itemsPerPage + 1} - {Math.min(activePage*itemsPerPage, filteredActiveQueue.length)} of {filteredActiveQueue.length} Active Cases
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActivePage(p => Math.max(1, p - 1))}
                        disabled={activePage === 1}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded text-xs hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setActivePage(p => p + 1)}
                        disabled={activePage * itemsPerPage >= filteredActiveQueue.length}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded text-xs hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: DISPUTE DETAIL WORKSPACE */}
          {activeTab === 'detail' && (
            <motion.div
              key="tab-detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              id="dispute-detail-workspace"
            >
              {!currentDispute ? (
                <div className="bg-white border border-slate-200 p-12 text-center rounded-xl shadow-sm">
                  <AlertCircle className="w-12 h-12 text-app-text-secondary mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No Active Case Selected</h3>
                  <p className="text-sm text-slate-500 mb-4">Please pick a dispute file from the Case Queue to enter the administrative mediation workspace.</p>
                  <button onClick={() => setActiveTab('active')} className="bg-app-card text-app-text-primary hover:bg-slate-800 px-4 py-2 rounded-lg text-sm font-semibold transition">
                    Return to Active Cases
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* DETAIL HEADER */}
                  <div className="lg:col-span-12 bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-bold font-mono tracking-tight text-slate-900">{currentDispute.disputeNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono uppercase${
                          currentDispute.status === 'open' ? 'bg-blue-100 text-blue-800' :
                          currentDispute.status === 'in_investigation' ? 'bg-purple-100 text-purple-800' :
                          currentDispute.status === 'mediation' ? 'bg-amber-100 text-amber-800' :
                          currentDispute.status === 'escalated' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {currentDispute.status.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize${
                          currentDispute.severity === 'high' ? 'bg-rose-50 text-rose-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {currentDispute.severity} Severity
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize${
                          currentDispute.priority === 'urgent' ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {currentDispute.priority} Priority
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-2">{currentDispute.title}</h2>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const done = undoLastStatusChange(currentDispute.id);
                          if (done) toast.success('Reverted the latest administrative status transition.');
                          else toast.error('Undo unavailable. Status transitions can only be reverted within 1 hour.');
                        }}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Undo Status Change
                      </button>

                      <button
                        onClick={() => setActiveTab('active')}
                        className="bg-app-card hover:bg-slate-800 text-app-text-primary px-3.5 py-2 rounded-lg text-xs font-semibold transition"
                      >
                        Back to Queue
                      </button>
                    </div>
                  </div>

                  {/* LEFT PANEL (60%) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* CASE SUMMARY BOX */}
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Case Summary & Parties</h3>
                        {currentDispute.orderId && (
                          <div className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-1 rounded flex items-center gap-1">
                            Order context: {currentDispute.orderId}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                          <div className="text-[11px] font-bold text-app-text-secondary uppercase tracking-wider font-mono">Disputant Customer</div>
                          <div className="flex items-center gap-2.5 mt-2">
                            <img 
                              src={currentDispute.buyer.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"} 
                              alt="Buyer" 
                              className="w-10 h-10 rounded-full object-cover border border-slate-200" 
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{currentDispute.buyer.name}</div>
                              <div className="text-xs text-app-text-secondary font-mono">{currentDispute.buyer.contactInfo || 'Private Customer'}</div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                          <div className="text-[11px] font-bold text-app-text-secondary uppercase tracking-wider font-mono">Target Marketplace Merchant</div>
                          <div className="flex items-center gap-2.5 mt-2">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                              {currentDispute.seller.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{currentDispute.seller.name}</div>
                              <div className="text-xs text-app-text-secondary font-mono">ID: {currentDispute.seller.id}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-150">
                        <div className="text-xs font-bold text-slate-500 mb-1 font-mono">Complaint Description Details</div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{currentDispute.description}</p>
                      </div>
                    </div>

                    {/* EVIDENCE GALLERY */}
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Case Evidence & Documents</h3>
                        <button
                          onClick={() => setShowEvidenceModal(true)}
                          className="bg-slate-50 hover:bg-slate-150 text-slate-700 border border-slate-200 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Add Evidence
                        </button>
                      </div>

                      {currentDispute.evidence.length === 0 ? (
                        <div className="text-center py-8 text-app-text-secondary text-sm font-medium">
                          No official diagnostic evidence has been uploaded for this case file yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {currentDispute.evidence.map(item => {
                            const isImage = item.type === 'image' || item.url.match(/\.(jpeg|jpg|gif|png)$/) != null || item.url.startsWith('https://images.unsplash.com');
                            return (
                              <div key={item.id} className="group relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50 transition hover:border-slate-300">
                                {isImage ? (
                                  <div className="aspect-video w-full relative overflow-hidden bg-app-card cursor-pointer" onClick={() => setExpandedImage(item.url)}>
                                    <img 
                                      src={item.url.startsWith('#') ? 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400' : item.url} 
                                      alt={item.description} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-app-card/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                      <span className="text-[10px] text-app-text-primary font-bold tracking-wider font-mono bg-app-card/20 px-2 py-1 rounded">CLICK TO VIEW</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="aspect-video w-full flex flex-col items-center justify-center p-3 bg-slate-100 text-slate-600 text-center border-b border-slate-200">
                                    <FileText className="w-8 h-8 text-app-text-secondary mb-1" />
                                    <span className="text-[10px] font-bold font-mono tracking-wider text-slate-500 uppercase">{item.type}</span>
                                  </div>
                                )}
                                <div className="p-2">
                                  <div className="text-xs font-semibold text-slate-700 truncate">{item.description}</div>
                                  <div className="text-[10px] text-app-text-secondary font-mono mt-0.5">By {item.uploadedBy === 'cust_002' ? 'Sabrina Sharmin' : 'Admin'}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* DISCUSSION THREAD */}
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Mediation Discussion Logs</h3>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500 font-semibold cursor-pointer select-none flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={isInternalNote}
                              onChange={(e) => setIsInternalNote(e.target.checked)}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            />
                            Internal Admin Note
                          </label>
                        </div>
                      </div>

                      {/* Chat messages */}
                      <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                        {currentDispute.messages.length === 0 ? (
                          <div className="text-center py-10 text-app-text-secondary text-sm">
                            No messages on file. Write an update below to message the parties.
                          </div>
                        ) : (
                          currentDispute.messages.map(msg => {
                            const isAdmin = msg.sender.type === 'admin';
                            const isInternal = msg.isInternal;
                            
                            return (
                              <div 
                                key={msg.id} 
                                className={`p-3.5 rounded-lg text-sm border${
                                  isInternal 
                                    ? 'bg-amber-50/45 border-amber-200 text-slate-800 ml-4' 
                                    : isAdmin
                                    ? 'bg-slate-55 border-slate-200 text-slate-800'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900">{msg.sender.name}</span>
                                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                      {msg.sender.type}
                                    </span>
                                    {isInternal && (
                                      <span className="bg-amber-100 text-amber-900 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border border-amber-200">
                                        INTERNAL NOTE
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-app-text-secondary font-mono">
                                    {new Date(msg.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Composer Textarea */}
                      <form onSubmit={handleSendMessage} className="pt-4 border-t border-slate-100">
                        <div className="relative">
                          <textarea
                            value={composerText}
                            onChange={(e) => setComposerText(e.target.value)}
                            placeholder={isInternalNote ? "Write private investigation logs (only visible to platform Admins)..." : "Draft message broadcasted instantly to both Customer and Seller inbox..."}
                            rows={3}
                            className={`w-full p-3 border rounded-xl text-sm focus:outline-none focus:ring-1 transition${
                              isInternalNote 
                                ? 'bg-amber-50/20 border-amber-300 focus:border-amber-400 focus:ring-amber-400' 
                                : 'border-slate-200 focus:border-slate-400 focus:ring-slate-400'
                            }`}
                          />
                          <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
                            <button
                              type="submit"
                              className={`px-4 py-2 rounded-lg text-xs font-bold text-app-text-primary shadow flex items-center gap-1.5 transition${
                                isInternalNote 
                                  ? 'bg-amber-600 hover:bg-amber-700' 
                                  : 'bg-app-card hover:bg-slate-800'
                              }`}
                            >
                              <Send className="w-3 h-3" />
                              {isInternalNote ? 'Pin Admin Note' : 'Broadcast Message'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>

                  </div>

                  {/* RIGHT PANEL (40%) */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* STATUS WORKFLOW CARD */}
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Status Workflow</h3>
                      
                      <div className="flex flex-col gap-2">
                        {currentDispute.status === 'open' && (
                          <button
                            onClick={() => {
                              updateDisputeStatus(currentDispute.id, 'in_investigation', 'Principal Mediator', 'Reviewing active merchant communications');
                              toast.success('Dispute shifted to Investigation workflow stage.');
                            }}
                            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 p-3 rounded-lg text-left text-sm font-semibold transition flex justify-between items-center"
                          >
                            <span>Promote to In-Investigation</span>
                            <ArrowRight className="w-4 h-4 text-indigo-600" />
                          </button>
                        )}

                        {currentDispute.status === 'in_investigation' && (
                          <button
                            onClick={() => {
                              updateDisputeStatus(currentDispute.id, 'mediation', 'Principal Mediator', 'Commencing tripartite dispute discussion desk');
                              toast.success('Transitioned to Mediation dialogue queue.');
                            }}
                            className="w-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 p-3 rounded-lg text-left text-sm font-semibold transition flex justify-between items-center"
                          >
                            <span>Convene Mediation Protocol</span>
                            <ArrowRight className="w-4 h-4 text-amber-600" />
                          </button>
                        )}

                        {currentDispute.status !== 'escalated' && currentDispute.status !== 'resolved' && currentDispute.status !== 'closed' && (
                          <button
                            onClick={() => {
                              escalateDispute(currentDispute.id, 'Unresolved during primary mediator SLA timeline');
                              toast.success('Case escalated to senior dispute supervisor board.');
                            }}
                            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 p-3 rounded-lg text-left text-sm font-semibold transition flex justify-between items-center"
                          >
                            <span>Escalate to Senior Management</span>
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                          </button>
                        )}

                        {currentDispute.status !== 'closed' && currentDispute.status !== 'resolved' && (
                          <button
                            onClick={() => {
                              dismissDispute(currentDispute.id, 'Evaluated and dismissed as frivolous or invalid.');
                              toast.success('Dispute case officially dismissed.');
                            }}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 p-3 rounded-lg text-left text-sm font-semibold transition flex justify-between items-center"
                          >
                            <span>Dismiss Case (Reject Claim)</span>
                            <CheckCircle2 className="w-4 h-4 text-slate-600" />
                          </button>
                        )}

                        {(currentDispute.status === 'resolved' || currentDispute.status === 'closed') && (
                          <button
                            onClick={() => {
                              reopenDispute(currentDispute.id, 'New evidence submitted regarding physical damages');
                              toast.success('Case status reset to Active open.');
                            }}
                            className="w-full bg-app-card hover:bg-slate-800 text-app-text-primary p-3 rounded-lg text-center text-sm font-semibold transition"
                          >
                            Re-Open Dispute File
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ASSIGNMENT CARD */}
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Administrative Owner</h3>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="text-xs text-app-text-secondary font-mono">ASSIGNED AGENT</div>
                            <div className="text-sm font-bold text-slate-800">
                              {currentDispute.admin ? (currentDispute.admin === 'usr_admin_001' ? 'Principal Mediator' : 'Internal Legal Office') : 'Unassigned Pool'}
                            </div>
                          </div>
                        </div>

                        <div>
                          {currentDispute.admin ? (
                            <button
                              onClick={() => {
                                setAssignDisputeId(currentDispute.id);
                                setShowAssignModal(true);
                              }}
                              className="bg-slate-50 hover:bg-slate-150 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded transition"
                            >
                              Reassign
                            </button>
                          ) : (
                            <button
                              onClick={() => assignDispute(currentDispute.id, 'usr_admin_001', 'Principal Mediator')}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow transition"
                            >
                              Claim Case
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SLA TARGET CARD */}
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">SLA Deadline</h3>
                      
                      <div>
                        <div className="flex justify-between text-xs text-app-text-secondary font-mono">
                          <span>SLA DUE DATE:</span>
                          <span className="font-bold text-slate-700">{new Date(currentDispute.dueDateForResolution).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-app-text-secondary font-mono mt-1">
                          <span>DAYS LEFT:</span>
                          <span className="font-bold text-slate-700">
                            {getDaysRemaining(currentDispute.dueDateForResolution)} Business Days
                          </span>
                        </div>

                        {getDaysRemaining(currentDispute.dueDateForResolution) <= 0 ? (
                          <div className="mt-3 bg-red-50 border border-red-200 p-2.5 rounded-lg text-xs text-red-800 font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            Overdue Warning: Past maximum dispute resolution target SLA.
                          </div>
                        ) : (
                          <div className="mt-3 bg-slate-50 p-2.5 rounded-lg text-[11px] text-slate-500 font-medium">
                            Bangladesh legal business rules exclude Fridays, Saturdays, and public holidays.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RESOLUTION CARD */}
                    {(currentDispute.status === 'mediation' || currentDispute.status === 'escalated' || currentDispute.status === 'resolved' || currentDispute.status === 'closed') && (
                      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Arbitration Resolution</h3>
                        
                        {currentDispute.status === 'resolved' ? (
                          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                              <CheckCircle2 className="w-5 h-5" /> Case Solved & Logged
                            </div>
                            <div className="grid grid-cols-2 gap-1 font-mono text-slate-600">
                              <span>Decision:</span>
                              <span className="font-bold uppercase text-slate-950">{currentDispute.resolutionType?.replace('_', ' ')}</span>
                              <span>Refund Value:</span>
                              <span className="font-bold text-slate-950">{currentDispute.resolutionAmount} BDT</span>
                            </div>
                            {currentDispute.resolutionNotes && (
                              <div className="mt-2 text-slate-500 border-t border-emerald-150 pt-2 font-sans italic">
                                "{currentDispute.resolutionNotes}"
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-bold text-slate-500 font-mono uppercase block mb-1">Select Award/Outcome</label>
                              <select
                                value={resType}
                                onChange={(e) => setResType(e.target.value as ResolutionType)}
                                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none"
                              >
                                <option value="refund_full">Full Refund to Customer (Refund Full)</option>
                                <option value="refund_partial">Partial Refund to Customer (Refund Partial)</option>
                                <option value="replacement">Enforce Product Replacement (Replacement)</option>
                                <option value="credit">Store Credit Coupon (Credit)</option>
                                <option value="dismiss">Dismiss Case completely (Dismiss)</option>
                              </select>
                            </div>

                            {(resType === 'refund_full' || resType === 'refund_partial' || resType === 'credit') && (
                              <div>
                                <label className="text-xs font-bold text-slate-500 font-mono uppercase block mb-1">Refund Amount (BDT)</label>
                                <input
                                  type="number"
                                  value={resAmount}
                                  onChange={(e) => setResAmount(parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                                />
                              </div>
                            )}

                            <div>
                              <label className="text-xs font-bold text-slate-500 font-mono uppercase block mb-1">Arbitration Judgment Notes</label>
                              <textarea
                                value={resNotes}
                                onChange={(e) => setResNotes(e.target.value)}
                                placeholder="Explain decision guidelines clearly..."
                                rows={2}
                                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                              />
                            </div>

                            <button
                              onClick={() => {
                                resolveDispute(currentDispute.id, resType, resAmount, resNotes);
                                toast.success('Dispute resolved successfully. Scores updated.');
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-xs shadow transition"
                            >
                              Finalize Arbitration Decision
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ACTION LOG (Collapsible audit trail) */}
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Case Audit Trail</h3>
                        <button onClick={() => setShowAuditModal(true)} className="text-[10px] font-bold font-mono uppercase tracking-wider text-app-text-secondary hover:text-slate-800">
                          View Full Trail
                        </button>
                      </div>

                      <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                        {currentDispute.actionLog.slice(-4).reverse().map((log, index) => (
                          <div key={index} className="text-xs text-slate-600 pl-3 border-l border-slate-300 relative">
                            <div className="absolute w-1.5 h-1.5 bg-slate-400 rounded-full -left-[4px] top-1.5" />
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: RESOLUTION HISTORY */}
          {activeTab === 'history' && (
            <motion.div
              key="tab-history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              id="resolution-archive-workspace"
            >
              {/* Filter Strip */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-app-text-secondary absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search by DSP #, buyer, seller..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white focus:outline-none transition"
                  />
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-end">
                  <select
                    value={historyResFilter}
                    onChange={(e) => setHistoryResFilter(e.target.value)}
                    className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:outline-none text-slate-700"
                  >
                    <option value="all">All Resolutions</option>
                    <option value="refund_full">Full Refund</option>
                    <option value="refund_partial">Partial Refund</option>
                    <option value="replacement">Replacement</option>
                    <option value="credit">Credit coupon</option>
                    <option value="dismiss">Dismissed</option>
                  </select>
                </div>
              </div>

              {/* History Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                        <th className="px-6 py-4">Dispute Case</th>
                        <th className="px-6 py-4">Buyer</th>
                        <th className="px-6 py-4">Seller</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Resolution Outcome</th>
                        <th className="px-6 py-4">Refund Awarded</th>
                        <th className="px-6 py-4">Resolution Date</th>
                        <th className="px-6 py-4">Arbitrator ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-sm">
                      {filteredHistoryQueue.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-app-text-secondary font-medium">
                            No resolved dispute files on record.
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryQueue.map(dispute => (
                          <tr key={dispute.id} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-4 font-mono font-bold text-slate-900">
                              <button onClick={() => handleViewDetail(dispute)} className="hover:underline text-slate-900 cursor-pointer">
                                {dispute.disputeNumber}
                              </button>
                            </td>
                            <td className="px-6 py-4">{dispute.buyer.name}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900">{dispute.seller.name}</td>
                            <td className="px-6 py-4 uppercase text-xs font-mono tracking-wider text-slate-500">
                              {dispute.type.replace('_', ' ')}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 rounded text-xs font-bold font-mono uppercase bg-emerald-50 text-emerald-800 border border-emerald-100">
                                {dispute.resolutionType?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono font-semibold text-slate-800">
                              {dispute.resolutionAmount ? `${dispute.resolutionAmount} BDT` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                              {dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                              {dispute.resolvedBy === 'usr_admin_001' ? 'Principal Mediator' : 'Internal Legal'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: ESCALATION QUEUE */}
          {activeTab === 'escalated' && (
            <motion.div
              key="tab-escalated"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              id="escalation-workspace"
            >
              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Escalated Disputes Management Panel</h3>
                <p className="text-sm text-slate-500">
                  These cases have breached standard agent resolution SLAs or were manually flagged due to critical legal risk. They require supreme arbitration decisions.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                        <th className="px-6 py-4">Dispute Case</th>
                        <th className="px-6 py-4">Buyer</th>
                        <th className="px-6 py-4">Seller</th>
                        <th className="px-6 py-4">Escalation Trigger Reason</th>
                        <th className="px-6 py-4">SLA Time Left</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-sm">
                      {escalatedQueue.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-app-text-secondary font-medium">
                            Splendid! No escalated or breached cases on board.
                          </td>
                        </tr>
                      ) : (
                        escalatedQueue.map(dispute => {
                          const daysLeft = getDaysRemaining(dispute.dueDateForResolution);
                          const isOverdue = daysLeft <= 0;
                          
                          return (
                            <tr key={dispute.id} className="hover:bg-slate-50 bg-rose-50/10 transition">
                              <td className="px-6 py-4 font-mono font-bold text-slate-900">
                                <button onClick={() => handleViewDetail(dispute)} className="hover:underline text-rose-800">
                                  {dispute.disputeNumber}
                                </button>
                              </td>
                              <td className="px-6 py-4">{dispute.buyer.name}</td>
                              <td className="px-6 py-4 font-semibold text-slate-900">{dispute.seller.name}</td>
                              <td className="px-6 py-4 text-xs text-rose-700 italic">
                                {dispute.actionLog[dispute.actionLog.length - 1] || 'Manual Managerial Escalation'}
                              </td>
                              <td className="px-6 py-4">
                                {isOverdue ? (
                                  <span className="text-red-600 font-bold font-mono">BREACHED ({Math.abs(daysLeft)}d overdue)</span>
                                ) : (
                                  <span className="font-mono text-slate-700 font-bold">{daysLeft} days left (Urgent)</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleViewDetail(dispute)}
                                  className="bg-rose-900 hover:bg-rose-800 text-white px-3 py-1.5 rounded text-xs font-semibold shadow transition"
                                >
                                  Resolve Urgently
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: ANALYTICS & REPORTS */}
          {activeTab === 'analytics' && (
            <motion.div
              key="tab-analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
              id="analytics-workspace"
            >
              {/* Range Switcher */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 font-sans">Platform Dispute Aggregates Analytics</h3>
                <div className="flex gap-1">
                  {['7d', '30d', '90d', 'all'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setReportRange(range as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono uppercase transition${
                        reportRange === range 
                          ? 'bg-app-card text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Big Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                  <div className="text-xs font-bold text-app-text-secondary font-mono uppercase">Dispute Rate (Total Cases)</div>
                  <div className="text-3xl font-extrabold text-slate-900 font-mono mt-2">{analyticsReport.totalCount}</div>
                  <div className="text-xs text-app-text-secondary mt-1">Disputes raised in date range</div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                  <div className="text-xs font-bold text-app-text-secondary font-mono uppercase">Case Resolution Ratio</div>
                  <div className="text-3xl font-extrabold text-emerald-600 font-mono mt-2">
                    {analyticsReport.totalCount > 0 
                      ? `${((analyticsReport.resolvedCount / analyticsReport.totalCount) * 100).toFixed(0)}%` 
                      : '100%'}
                  </div>
                  <div className="text-xs text-app-text-secondary mt-1">{analyticsReport.resolvedCount} of {analyticsReport.totalCount} resolved</div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                  <div className="text-xs font-bold text-app-text-secondary font-mono uppercase">Average Case Lifecycle</div>
                  <div className="text-3xl font-extrabold text-indigo-600 font-mono mt-2">{analyticsReport.avgResolutionDays}</div>
                  <div className="text-xs text-app-text-secondary mt-1">Business days to close file</div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                  <div className="text-xs font-bold text-app-text-secondary font-mono uppercase">Active Caseload</div>
                  <div className="text-3xl font-extrabold text-amber-600 font-mono mt-2">{analyticsReport.activeCount}</div>
                  <div className="text-xs text-app-text-secondary mt-1">Cases actively open</div>
                </div>
              </div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* BAR CHART: DISPUTES BY TYPE */}
                <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                  <h4 className="text-sm font-bold text-slate-900 font-sans mb-4 uppercase tracking-wide">Cases Filed by Dispute Type</h4>
                  <div className="h-64">
                    {analyticsReport.typeBreakdown.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-app-text-secondary text-xs">No data filed.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsReport.typeBreakdown}>
                          <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
                          <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* PIE CHART: DECISION OUTCOMES */}
                <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                  <h4 className="text-sm font-bold text-slate-900 font-sans mb-4 uppercase tracking-wide">Arbitration Resolution Distribution</h4>
                  <div className="h-64 flex flex-col md:flex-row items-center justify-center">
                    {analyticsReport.resolutionBreakdown.length === 0 ? (
                      <div className="text-app-text-secondary text-xs">No closed cases on record to show resolution outcomes.</div>
                    ) : (
                      <>
                        <div className="w-1/2 h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analyticsReport.resolutionBreakdown}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {analyticsReport.resolutionBreakdown.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-1.5 pl-4 text-xs font-mono">
                          {analyticsReport.resolutionBreakdown.map((entry: any, index: number) => (
                            <div key={entry.name} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="text-slate-500 capitalize">{entry.name}:</span>
                              <span className="font-bold text-slate-950">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* TROUBLESOME SELLERS LIST */}
                <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm lg:col-span-2">
                  <h4 className="text-sm font-bold text-slate-900 font-sans mb-4 uppercase tracking-wide">Top Troublesome Merchants (Frequent Complaints)</h4>
                  
                  {analyticsReport.topTroublesomeSellers.length === 0 ? (
                    <div className="text-center py-6 text-app-text-secondary text-xs">No merchants flagged. Excellent vendor compliance index.</div>
                  ) : (
                    <div className="space-y-3">
                      {analyticsReport.topTroublesomeSellers.map((seller: any, index: number) => {
                        const matchedTrust = trustScores.find(s => s.entity_id === seller.id || s.entity_name === seller.name);
                        
                        return (
                          <div key={seller.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-bold text-app-text-secondary">#0{index+1}</span>
                              <div>
                                <div className="text-sm font-bold text-slate-900">{seller.name}</div>
                                <div className="text-[11px] text-app-text-secondary font-mono">Merchant ID Code: {seller.id}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="text-xs text-app-text-secondary font-mono uppercase">Cases Filed</div>
                                <div className="text-sm font-bold text-red-600 font-mono">{seller.count} disputes</div>
                              </div>

                              <div className="text-right border-l border-slate-200 pl-4">
                                <div className="text-xs text-app-text-secondary font-mono uppercase">Reputation Score</div>
                                <div className="text-sm font-bold text-slate-800 font-mono">
                                  {matchedTrust ? `${matchedTrust.current_score} / 100` : '85 / 100'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* MODAL 1: CREATE DISPUTE MODAL (LODGED BY ADMIN INTRO) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-app-bg/10 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="create-dispute-modal">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-150 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 font-sans">Administrative Case Intake Portal</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-app-text-secondary hover:text-slate-600 text-lg">&times;</button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newBuyerName || !newSellerName || !newTitle || !newDescription) {
                toast.error('All asterisked complaint metadata lines are mandatory.');
                return;
              }
              const buyerId = newBuyerId || 'cust_' + Math.floor(Math.random() * 1000);
              const sellerId = newSellerId || 'seller_' + Math.floor(Math.random() * 1000);

              createDispute(
                buyerId,
                newBuyerName,
                sellerId,
                newSellerName,
                newType,
                newTitle,
                newDescription,
                newOrderId || undefined,
                undefined,
                undefined,
                newSeverity,
                newPriority
              );

              toast.success('Dispute case successfully created.');
              setShowCreateModal(false);
              
              // Reset
              setNewBuyerId('');
              setNewBuyerName('');
              setNewSellerId('');
              setNewSellerName('');
              setNewTitle('');
              setNewDescription('');
              setNewOrderId('');
            }} className="p-6 space-y-4 text-sm text-slate-700">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Disputant Buyer Name *</label>
                  <input
                    type="text"
                    value={newBuyerName}
                    onChange={(e) => setNewBuyerName(e.target.value)}
                    placeholder="e.g. Tamim Iqbal"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Target Vendor Suffix *</label>
                  <input
                    type="text"
                    value={newSellerName}
                    onChange={(e) => setNewSellerName(e.target.value)}
                    placeholder="e.g. Aarong BD"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Buyer ID / Code</label>
                  <input
                    type="text"
                    value={newBuyerId}
                    onChange={(e) => setNewBuyerId(e.target.value)}
                    placeholder="cust_110"
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Merchant ID / Code</label>
                  <input
                    type="text"
                    value={newSellerId}
                    onChange={(e) => setNewSellerId(e.target.value)}
                    placeholder="seller_aarong"
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Context Order ID</label>
                  <input
                    type="text"
                    value={newOrderId}
                    onChange={(e) => setNewOrderId(e.target.value)}
                    placeholder="INV-3321"
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Case Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as DisputeType)}
                    className="w-full bg-white border px-2.5 py-2 rounded-lg text-xs focus:outline-none"
                  >
                    <option value="order_issue">Order Issues</option>
                    <option value="payment">Payment Failure</option>
                    <option value="quality">Quality Issue</option>
                    <option value="late_delivery">Late Delivery</option>
                    <option value="seller_misconduct">Misconduct</option>
                    <option value="product_authenticity">Authenticity Breach</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Severity Tier</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full bg-white border px-2.5 py-2 rounded-lg text-xs focus:outline-none"
                  >
                    <option value="low">Low Severity</option>
                    <option value="medium">Medium Severity</option>
                    <option value="high">High Severity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Priority SLA</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-white border px-2.5 py-2 rounded-lg text-xs focus:outline-none"
                  >
                    <option value="normal">Normal SLA (5d)</option>
                    <option value="urgent">Urgent SLA (2d)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Brief Complaint Slogan *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Stitching error and severe color shade variations"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Detailed Case Descriptions *</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe complete facts, logistics timelines, and customer refund demands..."
                  rows={4}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 text-sm"
                  required
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-app-card hover:bg-slate-800 text-app-text-primary rounded-lg text-xs font-semibold transition"
                >
                  Lodge Case Intake
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EVIDENCE MODAL */}
      {showEvidenceModal && (
        <div className="fixed inset-0 bg-app-bg/10 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="add-evidence-modal">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">Upload Administrative Evidence</h3>
              <button onClick={() => setShowEvidenceModal(false)} className="text-app-text-secondary hover:text-slate-600">&times;</button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!evidenceUrl || !evidenceDescription) {
                toast.error('Both asset url and description are required.');
                return;
              }
              if (activeDisputeId) {
                addEvidence(activeDisputeId, evidenceType, evidenceUrl, evidenceDescription, 'usr_admin_001');
                toast.success('Diagnostic evidence successfully attached to Case.');
              }
              setShowEvidenceModal(false);
              setEvidenceUrl('');
              setEvidenceDescription('');
            }} className="p-6 space-y-4 text-sm text-slate-700">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Evidence Media Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value as any)}
                  className="w-full bg-white border px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="image">Diagnostic Image (JPEG, PNG)</option>
                  <option value="document">Legal Document/License (PDF, DOC)</option>
                  <option value="message">Screencapped Messages Logs</option>
                  <option value="order_detail">Wholesale Checkout Invoice details</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Asset Reference URL *</label>
                <input
                  type="text"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="e.g. https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                  required
                />
                <div className="mt-1 text-[10px] text-app-text-secondary">
                  You can pass any public Unsplash link, raw file asset URL, or mock document target.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Brief Description *</label>
                <input
                  type="text"
                  value={evidenceDescription}
                  onChange={(e) => setEvidenceDescription(e.target.value)}
                  placeholder="e.g. Saree stitching zoom capture highlighting seam issues"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                  required
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-app-card hover:bg-slate-800 text-app-text-primary rounded-lg text-xs font-semibold transition"
                >
                  Link Asset
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REASSIGN DISPUTE MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-app-bg/10 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">Reassign Case Officer</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-app-text-secondary hover:text-slate-600">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 font-mono uppercase mb-1">Available Case Officers</label>
                <select
                  value={assignAdminId}
                  onChange={(e) => {
                    setAssignAdminId(e.target.value);
                    setAssignAdminName(e.target.value === 'usr_admin_001' ? 'Principal Auditor' : 'Internal Legal Office');
                  }}
                  className="w-full bg-white border px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="usr_admin_001">Principal Auditor (Active Load: 3 cases)</option>
                  <option value="usr_admin_002">Senior Managerial Legal (Active Load: 1 case)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-app-text-secondary font-medium">
                <input type="checkbox" defaultChecked className="rounded border-slate-300" id="notify-officer-chk" />
                <label htmlFor="notify-officer-chk">Broadcast email notification alert to assignee.</label>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (assignDisputeId) {
                      assignDispute(assignDisputeId, assignAdminId, assignAdminName);
                      toast.success(`Dispute successfully reassigned to ${assignAdminName}.`);
                    }
                    setShowAssignModal(false);
                  }}
                  className="px-4 py-2 bg-app-card hover:bg-slate-800 text-app-text-primary rounded-lg text-xs font-semibold shadow"
                >
                  Assign Officer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FULL AUDIT TRAIL MODAL */}
      {showAuditModal && currentDispute && (
        <div className="fixed inset-0 bg-app-bg/10 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">Full Case Log Trail: {currentDispute.disputeNumber}</h3>
              <button onClick={() => setShowAuditModal(false)} className="text-app-text-secondary hover:text-slate-600 text-lg">&times;</button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {currentDispute.actionLog.map((log, index) => (
                <div key={index} className="text-xs text-slate-600 pl-4 border-l border-slate-200 relative py-1 hover:bg-slate-50 transition">
                  <div className="absolute w-2 h-2 bg-slate-400 rounded-full -left-[5px] top-2.5" />
                  {log}
                </div>
              ))}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 bg-app-card text-app-text-primary hover:bg-slate-800 rounded-lg text-xs font-bold shadow"
              >
                Close Audit Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE EXPAND MODAL */}
      {expandedImage && (
        <div className="fixed inset-0 bg-app-bg/10 flex items-center justify-center p-4 z-50" onClick={() => setExpandedImage(null)}>
          <div className="relative max-w-3xl w-full">
            <img src={expandedImage.startsWith('#') ? 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400' : expandedImage} alt="Expanded evidence view" className="max-w-full max-h-[85vh] rounded-xl object-contain mx-auto shadow-2xl" referrerPolicy="no-referrer" />
            <button className="absolute -top-10 right-0 text-app-text-primary font-bold text-xl hover:text-slate-300">Close &times;</button>
          </div>
        </div>
      )}

    </div>
  );
}
