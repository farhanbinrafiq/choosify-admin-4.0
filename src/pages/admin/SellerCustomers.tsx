import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOrders, Order, Customer, MessageThread } from '../../contexts/OrdersContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  Search, 
  Filter, 
  ChevronRight, 
  MoreVertical, 
  Eye, 
  MessageSquare, 
  Ban, 
  UserCheck, 
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  DollarSign,
  TrendingUp,
  MapPin,
  Send,
  AlertTriangle,
  History,
  ShieldCheck,
  Award
} from 'lucide-react';

interface SellerCustomerAnalytics {
  customer: Customer;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastPurchaseDate: string;
  segment: 'Repeat' | 'High Value' | 'New' | 'Inactive';
  orders: Order[];
  thread: MessageThread | null;
}

export default function SellerCustomers() {
  const { profile } = useAuth();
  const { 
    orders, 
    customers, 
    messageThreads, 
    sendChatMessage, 
    flagCustomer 
  } = useOrders();

  // Active / Selected Customer detail state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSegmentFilter, setActiveSegmentFilter] = useState<'All' | 'Repeat' | 'High Value' | 'New' | 'Inactive'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'orders' | 'spend' | 'last_purchase'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Detail profile tab state
  const [activeProfileTab, setActiveProfileTab] = useState<'orders' | 'messages' | 'reviews'>('orders');
  const [chatMessageText, setChatMessageText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Quick Actions modal states
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReasonInput, setFlagReasonInput] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Identify current seller ID
  const sellerId = profile?.role === 'seller' ? profile.id : 'seller_001';
  const sellerName = profile?.displayName || 'Merchant Partner';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compile seller-specific customer profiles based on orders & message transcripts
  const sellerCustomerAnalyticList = useMemo(() => {
    const list: SellerCustomerAnalytics[] = [];

    customers.forEach(c => {
      // Find orders of THIS customer for THIS seller
      const custSellerOrders = orders.filter(
        o => o.customer.id === c.id && o.product.sellerId === sellerId
      );

      // We should check if the customer has placed an order or has a message thread with this seller
      const associatedThread = messageThreads.find(
        t => t.customer.id === c.id && (!t.product || t.product.sellerId === sellerId)
      ) || null;

      // If they have had NO orders and NO chat/interaction with this seller, they shouldn't see them
      if (custSellerOrders.length === 0 && !associatedThread) {
        return;
      }

      // Calculate totals
      const totalOrders = custSellerOrders.length;
      const totalSpend = custSellerOrders.reduce((sum, o) => {
        // use base price or earnings base
        return sum + (o.product.price || 0);
      }, 0);

      const averageOrderValue = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;
      
      // Fine-grained last purchase date
      let lastPurchaseDate = 'No Purchases';
      if (totalOrders > 0) {
        const sortedDates = custSellerOrders
          .map(o => o.timestamp)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        lastPurchaseDate = new Date(sortedDates[0]).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }

      // Segment Categorization Logic
      let segment: 'Repeat' | 'High Value' | 'New' | 'Inactive' = 'New';
      if (c.flagged || c.behavior === 'Risk') {
        segment = 'Inactive';
      } else if (totalOrders >= 2) {
        segment = 'Repeat';
      } else if (totalSpend > 8000) {
        // High limit BDT threshold
        segment = 'High Value';
      }

      list.push({
        customer: c,
        totalOrders,
        totalSpend,
        averageOrderValue,
        lastPurchaseDate,
        segment,
        orders: custSellerOrders,
        thread: associatedThread
      });
    });

    return list;
  }, [customers, orders, messageThreads, sellerId]);

  // Handle Action menu list togglers
  const handleActionClick = (customerId: string, action: 'view' | 'flag' | 'unflag') => {
    setActiveMenuId(null);
    if (action === 'view') {
      setSelectedCustomerId(customerId);
    } else if (action === 'flag') {
      setShowFlagModal(true);
    } else if (action === 'unflag') {
      flagCustomer(customerId, false, 'Cleared by store administrator');
      showToast('Cleared customer security restriction flags.');
    }
  };

  // Perform filtering and searching
  const processedList = useMemo(() => {
    let result = [...sellerCustomerAnalyticList];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        item => 
          item.customer.name.toLowerCase().includes(q) ||
          item.customer.email.toLowerCase().includes(q)
      );
    }

    // Role-specific Segments Tab Filter
    if (activeSegmentFilter !== 'All') {
      result = result.filter(item => item.segment === activeSegmentFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = a.customer.name;
      let valB: any = b.customer.name;

      if (sortBy === 'orders') {
        valA = a.totalOrders;
        valB = b.totalOrders;
      } else if (sortBy === 'spend') {
        valA = a.totalSpend;
        valB = b.totalSpend;
      } else if (sortBy === 'last_purchase') {
        valA = new Date(a.orders[0]?.timestamp || 0).getTime();
        valB = new Date(b.orders[0]?.timestamp || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [sellerCustomerAnalyticList, searchQuery, activeSegmentFilter, sortBy, sortOrder]);

  // Find currently active focus detailed profile objects
  const activeDetailedProfile = useMemo(() => {
    if (!selectedCustomerId) return null;
    return sellerCustomerAnalyticList.find(p => p.customer.id === selectedCustomerId) || null;
  }, [sellerCustomerAnalyticList, selectedCustomerId]);

  // Send Direct Messaging
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageText.trim() || !activeDetailedProfile) return;

    // Use current thread ID or construct custom one
    const threadId = activeDetailedProfile.thread?.id || `thread_manual_${activeDetailedProfile.customer.id}`;
    
    sendChatMessage(
      threadId,
      chatMessageText,
      'seller',
      sellerName
    );

    setChatMessageText('');
    showToast('Direct message dispatched securely to buyer inbox.');
  };

  // Handle flagging submit dialog
  const handleFlagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagReasonInput.trim() || !selectedCustomerId) return;

    flagCustomer(selectedCustomerId, true, flagReasonInput);
    setShowFlagModal(false);
    setFlagReasonInput('');
    showToast('Risk flag published to super admin ledger.');
  };

  // Status visual renderer
  const getSegmentStyle = (segment: string) => {
    switch (segment) {
      case 'Repeat':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'High Value':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'New':
        return 'bg-[#EB4501]/10 text-app-accent-light border-[#EB4501]/20';
      case 'Inactive':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  // Standard Mock review feedback generator tailored to buyer
  const getCustomerMockReviews = (name: string) => {
    const list = [
      {
        id: 'rev-1',
        productName: 'Aarong Silk Panjabi',
        rating: 5,
        comment: 'Absolutely delightful texture! Packing was perfect and delivery was prompt. Best ethnic collection.',
        date: 'May 12, 2026'
      },
      {
        id: 'rev-2',
        productName: 'Apex Mens Formal Leather',
        rating: 4,
        comment: 'Solid grip shoe casing with highly premium fits. Slightly premium price tag but worth the quality.',
        date: 'Apr 24, 2026'
      }
    ];

    if (name.includes('Sifat')) {
      return [list[0]];
    }
    return list;
  };

  // Render Master (list) view
  if (!selectedCustomerId || !activeDetailedProfile) {
    return (
      <div className="space-y-6 pb-12 transition-all animate-in fade-in duration-300 text-app-text-primary">
        {/* Toast alerts */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
            <div className="w-2 h-2 rounded-full bg-app-accent" />
            <span className="text-xs font-bold font-mono text-white">{toastMessage}</span>
          </div>
        )}

        {/* Title bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
              <span>My Store</span>
              <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
              <span className="text-app-accent-light">Customers Directory</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Associated Store Customers
            </h1>
            <p className="text-app-text-secondary text-[12px]">
              Engage, analyze, and manage buyers with active transactions inside your storefront node.
            </p>
          </div>

          {/* Quick metric totals */}
          <div className="flex gap-4">
            <div className="bg-app-card border border-app-border rounded-[4px] px-5 py-3 shadow flex flex-col justify-center min-w-[120px]">
              <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-widest mb-0.5">Buyers</span>
              <span className="text-lg font-bold text-white font-mono">{sellerCustomerAnalyticList.length}</span>
            </div>
            <div className="bg-app-card border border-app-border rounded-[4px] px-5 py-3 shadow flex flex-col justify-center min-w-[124px]">
              <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-widest mb-0.5">High Value</span>
              <span className="text-lg font-bold text-green-400 font-mono">
                {sellerCustomerAnalyticList.filter(s => s.segment === 'High Value' || s.totalSpend >= 8000).length}
              </span>
            </div>
          </div>
        </div>

        {/* Filters and searching controls */}
        <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search Input block */}
            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light" />
              <input 
                type="text" 
                placeholder="Search customers by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white/[0.02] border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-app-accent/40 text-white placeholder-app-text-secondary/40 font-medium"
              />
            </div>

            {/* Sorting selectors */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-[11px] font-bold text-app-text-secondary uppercase">Sort By:</span>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-app-card border border-app-border rounded-[4px] text-xs text-white px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="name">Name</option>
                <option value="orders">Orders Count</option>
                <option value="spend">Total Spend</option>
                <option value="last_purchase">Last Purchase</option>
              </select>

              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="bg-app-card border border-app-border text-xs font-bold text-white hover:border-app-accent px-3 py-1.5 rounded-[4px] transition-colors cursor-pointer"
              >
                {sortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
              </button>
            </div>
          </div>

          {/* Segment selection tabs */}
          <div className="flex flex-wrap border-b border-white/[0.04]">
            {(['All', 'Repeat', 'High Value', 'New', 'Inactive'] as const).map(seg => (
              <button
                key={seg}
                onClick={() => setActiveSegmentFilter(seg)}
                className={`px-4 py-2 text-xs font-bold transition-all relative shrink-0 cursor-pointer ${
                  activeSegmentFilter === seg 
                    ? 'text-app-accent-light border-b-2 border-app-accent' 
                    : 'text-app-text-secondary hover:text-white'
                }`}
              >
                {seg} Customers
              </button>
            ))}
          </div>
        </div>

        {/* MASTER TABLE LIST */}
        <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-app-border">
                  <th className="px-6 py-4 text-[10.5px] font-bold text-app-text-secondary uppercase tracking-widest">Buyer Identity</th>
                  <th className="px-6 py-4 text-[10.5px] font-bold text-app-text-secondary uppercase tracking-widest">Inquire Contact</th>
                  <th className="px-6 py-4 text-[10.5px] font-bold text-app-text-secondary uppercase tracking-widest">Behavior Category</th>
                  <th className="px-6 py-4 text-[10.5px] font-bold text-app-text-secondary uppercase tracking-widest">Sales Baskets</th>
                  <th className="px-6 py-4 text-[10.5px] font-bold text-app-text-secondary uppercase tracking-widest">Total Spend</th>
                  <th className="px-6 py-4 text-[10.5px] font-bold text-app-text-secondary uppercase tracking-widest">Last Transaction Date</th>
                  <th className="px-6 py-4 text-[10.5px] font-bold text-app-text-secondary uppercase tracking-widest text-right">Administrative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[12.5px]">
                {processedList.length > 0 ? (
                  processedList.map((item) => (
                    <tr key={item.customer.id} className="hover:bg-white/[0.02] transition-all">
                      {/* Name + Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setSelectedCustomerId(item.customer.id)}
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold bg-white/5 border border-app-border text-app-accent-light text-[11px] cursor-pointer active:scale-95 transition-transform"
                          >
                            {item.customer.avatar || item.customer.name.substring(0, 2).toUpperCase()}
                          </button>
                          <div className="min-w-0">
                            <button 
                              onClick={() => setSelectedCustomerId(item.customer.id)}
                              className="font-bold text-white hover:text-app-accent-light transition-colors text-left block"
                            >
                              {item.customer.name}
                            </button>
                            <span className="text-[10px] text-app-text-secondary font-mono block">ID: {item.customer.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{item.customer.email}</div>
                        <span className="text-[10px] text-app-text-secondary italic">Secure messaging channel synced</span>
                      </td>

                      {/* Behavior Category */}
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-[2px] text-[9.5px] font-bold uppercase tracking-wider border ${getSegmentStyle(item.segment)}`}>
                          {item.segment}
                        </span>
                      </td>

                      {/* Sales Baskets */}
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        {item.totalOrders} {item.totalOrders === 1 ? 'order' : 'orders'}
                      </td>

                      {/* Spend */}
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-emerald-400 text-sm">৳ {item.totalSpend.toLocaleString()}</span>
                      </td>

                      {/* Last Purchase */}
                      <td className="px-6 py-4 font-mono text-app-text-secondary text-[11px]">
                        {item.lastPurchaseDate}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end relative">
                          <button 
                            onClick={() => setActiveMenuId(activeMenuId === item.customer.id ? null : item.customer.id)}
                            className={`w-8 h-8 flex items-center justify-center rounded-[3px] border transition-colors cursor-pointer ${
                              activeMenuId === item.customer.id
                                ? 'bg-app-accent text-white border-app-accent'
                                : 'bg-white/5 text-app-text-secondary border-transparent hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === item.customer.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                              <div className="absolute right-0 top-10 w-48 bg-app-card border border-app-border rounded-[4px] shadow-2xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
                                <button 
                                  onClick={() => handleActionClick(item.customer.id, 'view')}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-semibold text-app-text-primary hover:bg-app-accent/10 hover:text-app-accent-light transition-colors text-left cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Inspect Profile</span>
                                </button>
                                
                                <div className="border-t border-app-border my-1" />
                                
                                {item.customer.flagged ? (
                                  <button 
                                    onClick={() => handleActionClick(item.customer.id, 'unflag')}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-bold text-green-400 hover:bg-green-500/10 transition-colors text-left cursor-pointer"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Pardon Restrictions</span>
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleActionClick(item.customer.id, 'flag')}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-bold text-red-500 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Report Violation</span>
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-app-text-secondary">
                      <AlertTriangle className="w-8 h-8 text-app-text-secondary/20 mx-auto mb-2" />
                      <p className="text-sm font-bold text-white">No customers found representing store metrics</p>
                      <p className="text-xs">Try clearing search filters or checking other user categories.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination bar */}
          <div className="px-6 py-4 border-t border-app-border flex items-center justify-between text-[11px] font-bold text-app-text-secondary uppercase tracking-widest bg-white/[0.01]">
            <div>Registry range: 1 — {processedList.length} of {processedList.length} entries</div>
            <div className="flex gap-1">
              <button className="px-3 py-1 bg-white/5 border border-white/5 text-white/20 cursor-not-allowed rounded-[2px]">Prev</button>
              <button className="px-3 py-1 bg-app-accent text-white shadow-sm rounded-[2px]">01</button>
              <button className="px-3 py-1 bg-white/5 border border-white/5 hover:text-white rounded-[2px] transition-colors">Next</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Detailed Customer Profile view
  return (
    <div className="space-y-6 pb-12 transition-all animate-in fade-in duration-300 text-app-text-primary">
      {/* Toast alerts */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-xs font-bold font-mono text-white">{toastMessage}</span>
        </div>
      )}

      {/* Flag dialog modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-[8px] max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-white text-base">Escalate Behavior Restriction</h3>
            </div>
            <p className="text-xs text-app-text-secondary leading-relaxed">
              Submit a formal inquiry to the super admin oversight panel. The buyer account will be flagged as High Risk across the storefront workspace pending evaluation.
            </p>
            <form onSubmit={handleFlagSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Explicit Motive / Reason</label>
                <textarea 
                  value={flagReasonInput}
                  onChange={(e) => setFlagReasonInput(e.target.value)}
                  placeholder="Describe suspicious intent, spam, fraudulent chargebacks or duplicate transactions..."
                  className="w-full bg-white/[0.02] border border-app-border rounded-[4px] p-2.5 text-xs text-white focus:outline-none focus:border-app-accent min-h-[90px]"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowFlagModal(false)}
                  className="px-4 py-2 bg-white/5 text-slate-300 rounded-[4px] hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-[4px] hover:bg-red-700 transition-colors"
                >
                  Confirm Escalate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Breadcrumb back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSelectedCustomerId(null)}
            className="p-2 bg-white/5 border border-app-border rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            title="Back to ledger"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-app-text-secondary">
              <span>Directory</span>
              <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
              <button onClick={() => setSelectedCustomerId(null)} className="hover:text-white uppercase">Ledger</button>
              <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
              <span className="text-app-accent-light">Detailed Profile Card</span>
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>{activeDetailedProfile.customer.name}</span>
              <span className={`px-2 py-0.5 rounded-[2px] text-[8.5px] font-extrabold uppercase tracking-widest border ${getSegmentStyle(activeDetailedProfile.segment)}`}>
                {activeDetailedProfile.segment}
              </span>
            </h1>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex gap-2">
          {activeDetailedProfile.customer.flagged ? (
            <button 
              onClick={() => handleActionClick(activeDetailedProfile.customer.id, 'unflag')}
              className="px-4.5 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/25 rounded-[3px] text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Clear Restriction flags</span>
            </button>
          ) : (
            <button 
              onClick={() => handleActionClick(activeDetailedProfile.customer.id, 'flag')}
              className="px-4.5 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/25 rounded-[3px] text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Report Fraud Action</span>
            </button>
          )}
        </div>
      </div>

      {/* TWO COLUMN GRID PROFILE STRUCTURE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: BASIC INFORMATION CARD */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-5 relative">
            
            {/* Upper display card */}
            <div className="text-center py-4 space-y-2 border-b border-white/[0.04]">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center font-black bg-white/5 border border-app-border text-app-accent-light text-lg">
                {activeDetailedProfile.customer.avatar || activeDetailedProfile.customer.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">{activeDetailedProfile.customer.name}</h3>
                <span className="text-[10px] text-app-text-secondary font-mono">Customer ID: {activeDetailedProfile.customer.id}</span>
              </div>
            </div>

            {/* Basic details fields */}
            <div className="space-y-3.5 text-xs">
              <h4 className="text-[9px] font-extrabold text-white uppercase tracking-widest">Metadata Directory</h4>
              
              <div className="flex items-center gap-3 text-app-text-secondary pb-2 border-b border-white/[0.02]">
                <Mail className="w-4 h-4 text-app-accent shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] block text-slate-500 font-bold uppercase tracking-wider">Email Node</span>
                  <span className="text-white font-medium truncate block">{activeDetailedProfile.customer.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-app-text-secondary pb-2 border-b border-white/[0.02]">
                <Phone className="w-4 h-4 text-app-accent shrink-0" />
                <div>
                  <span className="text-[9px] block text-slate-500 font-bold uppercase tracking-wider">Phone Link</span>
                  <span className="text-white font-medium font-mono">+880 1715-992244</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-app-text-secondary pb-2 border-b border-white/[0.02]">
                <MapPin className="w-4 h-4 text-app-accent shrink-0" />
                <div>
                  <span className="text-[9px] block text-slate-500 font-bold uppercase tracking-wider">Default shipping address</span>
                  <span className="text-white font-medium">Block H, Road 12, Banani, Dhaka 1213</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-app-text-secondary">
                <Calendar className="w-4 h-4 text-app-accent shrink-0" />
                <div>
                  <span className="text-[9px] block text-slate-500 font-bold uppercase tracking-wider">Platform Join Date</span>
                  <span className="text-white font-medium">May 18, 2025</span>
                </div>
              </div>
            </div>

            {/* Trust and status summary panels */}
            <div className="p-3 bg-white/[0.02] border border-white/[0.02] rounded-[3px] space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400">STORE TRUST METRIC</span>
                <span className={activeDetailedProfile.customer.flagged ? 'text-red-400' : 'text-green-400 font-mono'}>
                  {activeDetailedProfile.customer.flagged ? 'RISK LEVEL HIGH' : 'SECURE NODE 98%'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${activeDetailedProfile.customer.flagged ? 'bg-red-500 w-1/4' : 'bg-green-500 w-[98%]'}`}
                />
              </div>
            </div>
          </div>

          {/* SECURITY RISK AUDIT TIMELINE */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[9.5px] font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
              <History className="w-4 h-4 text-app-accent" /> Security Violation Log
            </h3>

            <div className="space-y-4 pt-1.5">
              {activeDetailedProfile.customer.history && activeDetailedProfile.customer.history.length > 0 ? (
                activeDetailedProfile.customer.history.map((h, i) => (
                  <div key={i} className="text-xs space-y-1 relative pl-4 border-l border-white/[0.06]">
                    <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-app-accent" />
                    <div className="flex justify-between items-center text-[10px] text-app-text-secondary font-mono">
                      <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                      <span className="text-app-accent font-bold uppercase">{h.action}</span>
                    </div>
                    <p className="text-white font-semibold">{h.note}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 space-y-2 text-app-text-secondary">
                  <ShieldCheck className="w-8 h-8 opacity-20 mx-auto text-green-400" />
                  <p className="text-[11px] font-bold text-white">No security incidents flagged</p>
                  <p className="text-[9.5px]">This buyer holds clean transaction ratings across the store node.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: METRIC HEADINGS, ACTIVE TABS & INVENTORY ROWS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* THREE STATS GRID CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between relative">
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-app-text-secondary uppercase tracking-widest block opacity-70">Total Revenue Generated</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  ৳ {activeDetailedProfile.totalSpend.toLocaleString()}
                </span>
                <span className="text-[9.5px] text-green-400 block font-bold">
                  MTD Sales Active
                </span>
              </div>
              <div className="shrink-0">
                <DollarSign className="w-7 h-7 text-green-500 opacity-20" />
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between relative">
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-app-text-secondary uppercase tracking-widest block opacity-70">Completed Orders</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {activeDetailedProfile.totalOrders}
                </span>
                <span className="text-[9.5px] text-app-text-secondary block font-semibold">
                  {activeDetailedProfile.orders.filter(o => o.status === 'Cancelled').length} cancelled orders
                </span>
              </div>
              <div className="shrink-0">
                <ShoppingBag className="w-7 h-7 text-app-accent opacity-20" />
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between relative">
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-app-text-secondary uppercase tracking-widest block opacity-70">Average Order Value</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  ৳ {activeDetailedProfile.averageOrderValue.toLocaleString()}
                </span>
                <span className="text-[9.5px] text-indigo-400 block font-bold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Growth Rate Stable
                </span>
              </div>
              <div className="shrink-0">
                <Award className="w-7 h-7 text-indigo-500 opacity-20" />
              </div>
            </div>
          </div>

          {/* INTERACTIVE DETAIL PROFILE TAB NAVIGATION */}
          <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl overflow-hidden">
            <div className="flex border-b border-white/[0.04] bg-white/[0.01]">
              <button
                onClick={() => setActiveProfileTab('orders')}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all relative cursor-pointer ${
                  activeProfileTab === 'orders'
                    ? 'text-app-accent-light border-b-2 border-app-accent bg-white/[0.01]'
                    : 'text-app-text-secondary hover:text-white'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Orders Registry ({activeDetailedProfile.orders.length})</span>
              </button>

              <button
                onClick={() => setActiveProfileTab('messages')}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all relative cursor-pointer ${
                  activeProfileTab === 'messages'
                    ? 'text-app-accent-light border-b-2 border-app-accent bg-white/[0.01]'
                    : 'text-app-text-secondary hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Secure Messaging Thread</span>
              </button>

              <button
                onClick={() => setActiveProfileTab('reviews')}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all relative cursor-pointer ${
                  activeProfileTab === 'reviews'
                    ? 'text-app-accent-light border-b-2 border-app-accent bg-white/[0.01]'
                    : 'text-app-text-secondary hover:text-white'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>Reviews left for products</span>
              </button>
            </div>

            {/* TAB CONTAINER AREA */}
            <div className="p-5 min-h-[300px]">
              
              {/* TAB 1: ORDERS LISTING */}
              {activeProfileTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <h3 className="font-extrabold text-[#8E9BAE] uppercase tracking-wider">Purchase History Ledger</h3>
                    <span className="text-[10px] text-slate-500">Fully transparent transaction records</span>
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    {activeDetailedProfile.orders.length > 0 ? (
                      activeDetailedProfile.orders.map((o) => (
                        <div key={o.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 bg-white/5 border border-app-border rounded-[4px] overflow-hidden shrink-0 flex items-center justify-center">
                              {o.product.image ? (
                                <img src={o.product.image} alt={o.product.name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingBag className="w-5 h-5 text-app-text-secondary" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-white text-xs truncate max-w-sm">{o.product.name}</h4>
                              <p className="text-[10px] text-app-text-secondary mt-0.5">
                                Order ID: <span className="font-mono text-white">{o.id}</span> · Invoice No: <Link to={`/admin/invoice/${o.id}`} className="font-mono text-app-accent hover:underline">{o.invoice_id || 'Generating'}</Link>
                              </p>
                              <span className="text-[9.5px] text-slate-500 block mt-0.5">{new Date(o.timestamp).toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4.5 justify-between md:justify-end">
                            <div className="text-right">
                              <div className="font-mono font-bold text-emerald-400 text-sm">৳ {o.product.price.toLocaleString()}</div>
                              <span className="text-[9px] text-[#8E9BAE] block uppercase tracking-wide">Cash on Delivery</span>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-[2px] font-mono text-[9px] font-bold border uppercase shrink-0 ${
                              o.status === 'Delivered' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                              o.status === 'Cancelled' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                              'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {o.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-app-text-secondary">
                        <ShoppingBag className="w-8 h-8 opacity-25 mx-auto mb-2" />
                        <p className="text-xs">No transaction records registered representing this customer node</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: MESSAGING LOGS */}
              {activeProfileTab === 'messages' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <h3 className="font-extrabold text-[#8E9BAE] uppercase tracking-wider">Channel Encryption Tunnel</h3>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connection Secure
                    </span>
                  </div>

                  {/* Messaging list transcripts */}
                  <div className="space-y-3.5 max-h-[320px] overflow-y-auto custom-scrollbar p-1.5 border border-white/[0.04] bg-white/[0.005] rounded-[3px]">
                    {activeDetailedProfile.thread && activeDetailedProfile.thread.messages.length > 0 ? (
                      activeDetailedProfile.thread.messages.map((m) => (
                        <div 
                          key={m.id} 
                          className={`flex flex-col max-w-[80%] ${m.senderRole === 'seller' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                          <div className={`p-3 rounded-[6px] text-xs leading-relaxed ${
                            m.senderRole === 'seller' 
                              ? 'bg-app-accent text-white rounded-br-none' 
                              : 'bg-white/5 border border-app-border text-white rounded-bl-none'
                          }`}>
                            <p className="whitespace-pre-wrap">{m.text}</p>
                          </div>
                          
                          {/* Sender name label info */}
                          <span className="text-[9px] text-[#8E9BAE] mt-1 font-mono">
                            {m.senderName} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-app-text-secondary">
                        <MessageSquare className="w-8 h-8 opacity-25 mx-auto mb-2" />
                        <p className="text-xs">No direct messaging records registered representing this customer node</p>
                        <p className="text-[10px] text-slate-500 mt-1">Compose a message below to establish immediate client communication.</p>
                      </div>
                    )}
                  </div>

                  {/* Message composition input form */}
                  <form onSubmit={handleSendChatMessage} className="flex gap-2.5 pt-2">
                    <input 
                      type="text" 
                      placeholder="Compose a direct inquiry message for this buyer..."
                      value={chatMessageText}
                      onChange={(e) => setChatMessageText(e.target.value)}
                      className="flex-1 bg-white/[0.02] border border-app-border rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-app-accent/50 placeholder-slate-500 font-medium"
                      required
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-app-accent text-white rounded-[4px] hover:bg-app-accent-light active:scale-95 transition-all text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>Send</span>
                      <Send className="w-3 h-3" />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: CUSTOMER REVIEWS */}
              {activeProfileTab === 'reviews' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <h3 className="font-extrabold text-[#8E9BAE] uppercase tracking-wider">Product Ratings & Overviews</h3>
                    <span className="text-[10px] text-slate-500">Reviews left by this customer on products of this store</span>
                  </div>

                  <div className="space-y-3.5">
                    {getCustomerMockReviews(activeDetailedProfile.customer.name).map((rev) => (
                      <div key={rev.id} className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-[4px] space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-white text-xs leading-relaxed">{rev.productName}</h4>
                            <span className="text-[10px] text-[#8E9BAE] block mt-0.5">{rev.date}</span>
                          </div>
                          
                          <div className="flex gap-0.5 text-app-accent">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'opacity-20'}`} 
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-app-text-secondary italic leading-relaxed">
                          "{rev.comment}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
