import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrders, Order, OrderStatus } from '../../contexts/OrdersContext';
import { 
  ListOrdered, 
  Search, 
  CheckCircle, 
  XCircle, 
  Truck, 
  Notebook, 
  AlertCircle,
  Clock, 
  Filter, 
  Plus, 
  DollarSign, 
  User, 
  Tag, 
  ChevronRight,
  Send,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Loader,
  FileText,
  Printer,
  Download,
  ArrowLeft,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type OrderConsoleTab = 
  | 'All' 
  | 'Pending' 
  | 'Confirmed' 
  | 'Dispatched' 
  | 'In Transit' 
  | 'Delivered' 
  | 'Cancelled' 
  | 'Rejected' 
  | 'Returned' 
  | 'Exchange' 
  | 'Processing' 
  | 'Other';

export default function OrdersPage() {
  const { profile } = useAuth();
  const { 
    orders, 
    approveOrder, 
    declineOrder, 
    cancelOrder, 
    dispatchOrder, 
    addCustomerNotes,
    updateOrderStatus 
  } = useOrders();

  // Unified 12 Core Filter Tabs state 
  const [activeTab, setActiveTab] = useState<OrderConsoleTab>('All');
  const [currentMainTab, setCurrentMainTab] = useState<'console' | 'history'>('console');

  // Search parameters for the unified board Workspace
  const [searchTerm, setSearchTerm] = useState('');

  // Local state for toast notification alert
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Local storage persisted seller-only internal notes database
  const [internalNotes, setInternalNotes] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('seller_internal_notes');
    return saved ? JSON.parse(saved) : {};
  });

  const addInternalNote = (orderId: string, note: string) => {
    const updated = {
      ...internalNotes,
      [orderId]: [...(internalNotes[orderId] || []), note]
    };
    setInternalNotes(updated);
    localStorage.setItem('seller_internal_notes', JSON.stringify(updated));
    showInlineToast(`✓ Internal Note added for Order ${orderId}`);
  };

  const showInlineToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Modal / Drawer state for actions
  const [actioningOrder, setActioningOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'decline' | 'cancel' | 'dispatch' | 'note' | 'internal' | null>(null);
  const [inputText, setInputText] = useState('');
  const [inputTextSecondary, setInputTextSecondary] = useState('');

  const { activeBrandId, setActiveBrandId, allBrands, sellerBrands } = useAuth();

  // Seller orders filter (only show orders for the active brand if logged in as seller)
  const activeBrand = allBrands.find(b => b.id === activeBrandId);
  const sellerId = profile?.role === 'seller' ? profile.id : 'seller_001'; 
  const sellerRelations = sellerBrands.filter(r => r.seller_user_id === profile?.id);
  const ownedBrandIds = sellerRelations.map(r => r.brand_id);
  const ownedBrandNames = allBrands.filter(b => ownedBrandIds.includes(b.id)).map(b => b.name.toLowerCase());

  // Comprehensive active orders list representing this seller's operational segment
  const sellerOrders = orders.filter(o => {
    if (profile?.role === 'seller') {
      const brandNameLower = o.product.brand.toLowerCase();
      // If a specific brand context is selected, strict filter by that brand context
      if (activeBrand) {
        const activeBrandNameLower = activeBrand.name.toLowerCase();
        return brandNameLower === activeBrandNameLower || brandNameLower.includes(activeBrandNameLower) || activeBrandNameLower.includes(brandNameLower);
      }
      // If "All Brands" (null context) is selected, show orders of ALL of this seller's owned brands
      return ownedBrandNames.some(name => brandNameLower === name || brandNameLower.includes(name) || name.includes(brandNameLower));
    }
    return o.product.sellerId === sellerId;
  });

  // Search filter matcher helper function satisfying detailed requirements
  const matchQuery = (o: Order, term: string) => {
    if (!term) return true;
    const q = term.toLowerCase();
    const phone = (o.customer as any).phone || '+880 1711-456789';
    const address = (o.customer as any).address || 'House 14, Road 4, Sector 12, Uttara, Dhaka';
    return (
      o.id.toLowerCase().includes(q) ||
      (o.invoice_id && o.invoice_id.toLowerCase().includes(q)) ||
      (o.product.name && o.product.name.toLowerCase().includes(q)) ||
      (o.product.id && o.product.id.toLowerCase().includes(q)) ||
      (o.customer.name && o.customer.name.toLowerCase().includes(q)) ||
      (o.customer.email && o.customer.email.toLowerCase().includes(q)) ||
      phone.toLowerCase().includes(q) ||
      address.toLowerCase().includes(q)
    );
  };

  const invoiceDownloadTXT = (order: Order) => {
    const textContent = `
=============================================
             CHOOSIFY INVOICE SLIP
=============================================
Order Reference ID : ${order.id}
Invoice Serial ID  : ${order.invoice_id || "IV-" + order.id}
Timestamp          : ${new Date(order.timestamp).toLocaleString()}
Fulfillment Status : ${order.status}

---------------------------------------------
CUSTOMER RECIPIENT INFORMATION
---------------------------------------------
Name               : ${order.customer.name}
Phone              : ${(order.customer as any).phone || "+880 1711-456789"}
Address            : ${(order.customer as any).address || "House 14, Road 4, Sector 12, Uttara, Dhaka"}

---------------------------------------------
SOURCING COMMERCE DATA
---------------------------------------------
Product Name       : ${order.product.name}
Brand / Host       : ${order.product.sellerName}
Unit Pricing       : ৳ ${order.product.price.toLocaleString()}
Quantity Ordered   : ${order.quantity || 1}
Standard Carriage  : ৳ ${order.delivery_charge || 120}

---------------------------------------------
FINANCIAL OVERVIEW
---------------------------------------------
Commission BDT     : ৳ ${order.earnings?.futureAutomatedDeduction?.toLocaleString() || "420"}
Sellers Net Payout : ৳ ${order.earnings?.sellerNet?.toLocaleString() || "3,780"}
GRAND TOTAL BILLED : ৳ ${(((order.product.price * (order.quantity || 1)) + (order.delivery_charge || 120))).toLocaleString()} BDT

=============================================
    Thank you for choosing Choosify ERP!
=============================================
`;
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice_Slip_${order.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------
  // UNIFIED 12 TABS FILTERING ENGINE
  // ----------------------------------------------------
  const filteredOrders = sellerOrders.filter(o => {
    // Apply cumulative workspace search query parameter
    if (!matchQuery(o, searchTerm)) return false;

    switch (activeTab) {
      case 'All':
        // MERGED: all platform orders + approved/later manual orders
        if (o.isManual && o.status === 'Pending') {
          return false;
        }
        return true;

      case 'Pending':
        // Platform orders in pending state only (manual pending live in Other Orders)
        return !o.isManual && o.status === 'Pending';

      case 'Confirmed':
        return o.status === 'Confirmed';

      case 'Dispatched':
        return o.status === 'Dispatched';

      case 'In Transit':
        return o.status === 'In Transit';

      case 'Delivered':
        return o.status === 'Delivered';

      case 'Cancelled':
        return o.status === 'Cancelled';

      case 'Rejected':
        return o.status === 'Rejected';

      case 'Returned':
        return o.status === 'Returned';

      case 'Exchange':
        return o.status === 'Exchange';

      case 'Processing':
        return o.status === 'Processing';

      case 'Other':
        // Other Orders Tab: shows ALL manual/sourced/external bookings
        return !!o.isManual;

      default:
        return true;
    }
  });

  const getStatusStyle = (status: OrderStatus) => {
    const styles: Record<OrderStatus, string> = {
      'Pending': 'bg-amber-500/10 text-amber-500 border-amber-500/25',
      'Confirmed': 'bg-blue-500/10 text-blue-500 border-blue-500/25',
      'Dispatched': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25',
      'In Transit': 'bg-purple-500/10 text-purple-500 border-purple-500/25',
      'Delivered': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25',
      'Cancelled': 'bg-rose-500/10 text-rose-500 border-rose-500/25',
      'Rejected': 'bg-red-500/10 text-red-500 border-red-500/25',
      'Returned': 'bg-neutral-500/10 text-neutral-400 border-neutral-500/25',
      'Exchange': 'bg-pink-500/10 text-pink-500 border-pink-500/25',
      'Processing': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25',
    };
    return styles[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/25';
  };

  // Form Submit handler for modal actioning
  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actioningOrder || !actionType) return;

    if (actionType === 'decline') {
      if (!inputText.trim()) return;
      declineOrder(actioningOrder.id, inputText);
      showInlineToast(`Order ${actioningOrder.id} has been declined.`);
    } else if (actionType === 'cancel') {
      if (!inputText.trim()) return;
      cancelOrder(actioningOrder.id, inputText);
      showInlineToast(`Order ${actioningOrder.id} has been cancelled.`);
    } else if (actionType === 'dispatch') {
      if (!inputText.trim()) return;
      dispatchOrder(actioningOrder.id, inputText, inputTextSecondary || 'https://choosify.com.bd/track/' + actioningOrder.id);
      showInlineToast(`Order ${actioningOrder.id} marked as dispatched via ${inputText}.`);
    } else if (actionType === 'note') {
      if (!inputText.trim()) return;
      addCustomerNotes(actioningOrder.id, inputText);
    } else if (actionType === 'internal') {
      if (!inputText.trim()) return;
      addInternalNote(actioningOrder.id, inputText);
    }

    // Reset
    setActioningOrder(null);
    setActionType(null);
    setInputText('');
    setInputTextSecondary('');
  };

  const openAction = (order: Order, type: 'decline' | 'cancel' | 'dispatch' | 'note' | 'internal') => {
    setActioningOrder(order);
    setActionType(type);
    setInputText('');
    setInputTextSecondary('');
  };

  // High fidelity client side print invoice compiler
  const handlePrintInvoice = (order: Order) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showInlineToast('❌ Error: Popups blocked! Please allow popups to print invoices.');
      return;
    }

    const orderId = order.id;
    const invId = order.invoice_id || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateStr = new Date(order.timestamp).toLocaleDateString();
    const customerName = order.customer.name;
    const customerEmail = order.customer.email;
    const customerPhone = (order.customer as any).phone || '+880 1711-456789';
    const customerAddress = (order.customer as any).address || 'House 14, Road 4, Sector 12, Uttara, Dhaka';
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${orderId}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background-color: #ffffff; }
            .badge { display: inline-block; padding: 4px 12px; font-size: 10px; font-weight: bold; border-radius: 9999px; text-transform: uppercase; }
            .badge-paid { background-color: #d1fae5; color: #065f46; }
            .header-layout { display: flex; justify-content: space-between; border-b: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 30px; }
            .logo { font-size: 26px; font-weight: 900; color: #F4631E; letter-spacing: -0.5px; }
            .invoice-label { font-size: 22px; font-weight: 800; text-align: right; color: #0f172a; text-transform: uppercase; }
            .meta-block { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .meta-section h4 { margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 800; }
            .meta-section p { margin: 3px 0; font-size: 13px; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 35px; }
            th { background-color: #f8fafc; font-weight: bold; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; padding: 14px; border-bottom: 2px solid #e2e8f0; }
            td { padding: 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
            .text-right { text-align: right; }
            .totals-container { display: flex; justify-content: flex-end; }
            .totals-box { width: 320px; border-top: 2px solid #e2e8f0; padding-top: 15px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
            .grand-total { border-t: 2px solid #0f172a; font-weight: 900; font-size: 16px; color: #0f172a; padding-top: 12px; margin-top: 8px; }
            .disclaimer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 60px; font-size: 11px; color: #94a3b8; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header-layout">
            <div>
              <div class="logo">CHOOSIFY COMMERCE</div>
              <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Storefront Merchant Partner: ${order.product.sellerName}</p>
            </div>
            <div class="invoice-label">
              Official Invoice<br/>
              <span style="font-size: 12px; color: #64748b; font-weight: normal; font-family: monospace;">Ref: ${invId}</span><br/>
              <span class="badge badge-paid">Settled BDT Cash</span>
            </div>
          </div>
          
          <div class="meta-block">
            <div class="meta-section">
              <h4>FROM STORE</h4>
              <p><strong>${order.product.sellerName}</strong></p>
              <p>Category Guild: ${order.product.brand}</p>
              <p>Supply Merchant ID: ${order.product.sellerId}</p>
            </div>
            <div class="meta-section">
              <h4>DELIVERED TO</h4>
              <p><strong>${customerName}</strong></p>
              <p>Email: ${customerEmail}</p>
              <p>Phone: ${customerPhone}</p>
              <p>Address: ${customerAddress}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Product Log Description</th>
                <th>Global SKU</th>
                <th style="text-align: center;">Qty</th>
                <th class="text-right">Unit BDT Price</th>
                <th class="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${order.product.name}</strong><br/><span style="font-size: 10px; color: #94a3b8;">Brand: ${order.product.brand}</span></td>
                <td style="font-family: monospace; font-size: 12px;">SKU-${order.product.id}</td>
                <td style="text-align: center;">1</td>
                <td class="text-right">৳ ${order.product.price.toLocaleString()}</td>
                <td class="text-right">৳ ${order.product.price.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="totals-container">
            <div class="totals-box">
              <div class="totals-row">
                <span>Subtotal Base:</span>
                <span>৳ ${order.product.price.toLocaleString()}</span>
              </div>
              <div class="totals-row">
                <span>Logistics Gateway Cover:</span>
                <span>৳ 120</span>
              </div>
              <div class="totals-row">
                <span>Platform Commission Rebate:</span>
                <span>৳ 0</span>
              </div>
              <div class="totals-row grand-total">
                <span>Gross Payable BDT:</span>
                <span>৳ ${(order.product.price + 120).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div class="disclaimer">
            This invoice is generated digitally inside Choosify Merchant Command Gateway.<br/>
            Thank you for support. Logistics coverage managed securely.
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    showInlineToast(`✓ Printable Invoice INV-${order.id} sent to browser layout spooler.`);
  };

  // Client side digital downloader
  const handleDownloadInvoice = (order: Order) => {
    const customerPhone = (order.customer as any).phone || '+880 1711-456789';
    const customerAddress = (order.customer as any).address || 'House 14, Road 4, Sector 12, Uttara, Dhaka';
    
    const docContent = `
=============================================
CHOOSIFY MERCHANDISING HUB - OFFICIAL INVOICE
=============================================
Invoice ID: INV-${order.id}
Order Reference: ${order.id}
Date Logged: ${new Date(order.timestamp).toLocaleString()}
Fulfillment Status: ${order.status}

---------------------------------------------
SUPPLIER STORE: ${order.product.sellerName}
SHIPPED TO:
Customer: ${order.customer.name}
Email: ${order.customer.email}
Address: ${customerAddress}
Phone: ${customerPhone}

---------------------------------------------
ITEMS DETAILS:
Product: ${order.product.name}
Brand: ${order.product.brand}
Quantity: 1
Unit Price: BDT ${order.product.price}
Logistics Charge: BDT 120
---------------------------------------------
TOTAL PAYABLE AMOUNT: BDT ${order.product.price + 120}
---------------------------------------------
Thank you for using Choosify Commerce Network.
=============================================
    `.trim();

    const element = document.createElement("a");
    const file = new Blob([docContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Invoice_INV-${order.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    showInlineToast(`✓ Invoice file downloaded successfully for Order ${order.id}!`);
  };

  return (
    <div className="space-y-8 pb-12 text-white relative">
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/30 text-emerald-400 px-6 py-4.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-xs font-black uppercase tracking-wider">{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h1 className="text-2xl font-black text-app-text-primary tracking-tight flex items-center gap-3">
            <span className="p-2 bg-[#F4631E]/10 border border-[#F4631E]/20 text-[#F4631E] rounded-xl block">
              <ListOrdered className="w-5 h-5" />
            </span>
            <span>Order Console</span>
          </h1>
          <p className="text-xs text-[#8E9BAE]">
            Process active customer orders, print statements, track logistics couriers, and explore historic shipments.
          </p>
        </div>

        {/* Dynamic status stats indicators */}
        <div className="flex flex-wrap gap-3 relative z-10">
          <div className="bg-app-bg/60 border border-app-border rounded-2xl px-5 py-3 flex flex-col justify-center min-w-[110px]">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Pending</span>
            <span className="text-lg font-black text-amber-500">{sellerOrders.filter(o => o.status === 'Pending').length}</span>
          </div>
          <div className="bg-app-bg/60 border border-app-border rounded-2xl px-5 py-3 flex flex-col justify-center min-w-[110px]">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Active Run</span>
            <span className="text-lg font-black text-[#F4631E]">{sellerOrders.filter(o => ['Confirmed', 'Dispatched', 'In Transit'].includes(o.status)).length}</span>
          </div>
          <div className="bg-app-bg/60 border border-app-border rounded-2xl px-5 py-3 flex flex-col justify-center min-w-[110px]">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Fulfilled</span>
            <span className="text-lg font-black text-emerald-500">{sellerOrders.filter(o => o.status === 'Delivered').length}</span>
          </div>
        </div>
      </div>

      {/* REQUIRED TOP NAVIGATION TABS */}
      <div className="bg-app-card border border-app-border rounded-[2rem] p-4.5 shadow-xl flex gap-3">
        <button
          id="btn-nav-order-console"
          onClick={() => setCurrentMainTab('console')}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all rounded-xl cursor-pointer ${
            currentMainTab === 'console'
              ? 'bg-[#F4631E] text-white shadow-lg shadow-[#F4631E]/20'
              : 'bg-app-bg border border-app-border text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📥 Order Console</span>
        </button>
        <button
          id="btn-nav-order-history"
          onClick={() => setCurrentMainTab('history')}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all rounded-xl cursor-pointer ${
            currentMainTab === 'history'
              ? 'bg-[#F4631E] text-white shadow-lg shadow-[#F4631E]/20'
              : 'bg-app-bg border border-app-border text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📜 Order History</span>
        </button>
      </div>

      {/* 12 Core Filter Tabs Operational Workspace Nav */}
      <div className="bg-app-card border border-app-border rounded-[2rem] p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-transparent">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#F4631E] transition-colors" />
            <input 
              type="text"
              placeholder="Search by ID, Customer Name, SKU, product brand, invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-app-bg border border-app-border rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-[#F4631E]/60 transition-all font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Filter className="w-3.5 h-3.5 text-[#F4631E]" /> 12 Operations Filter Ledger 
          </div>
        </div>

        {/* Horizontal scrollbar custom scrollable container */}
        <div className="flex overflow-x-auto pb-2 gap-2 custom-scrollbar border-b border-app-border/40">
          {[
            { id: 'All', label: 'All Orders' },
            { id: 'Pending', label: 'Pending' },
            { id: 'Confirmed', label: 'Confirmed' },
            { id: 'Dispatched', label: 'Dispatched' },
            { id: 'In Transit', label: 'In Transit' },
            { id: 'Delivered', label: 'Delivered' },
            { id: 'Cancelled', label: 'Cancelled' },
            { id: 'Rejected', label: 'Rejected' },
            { id: 'Returned', label: 'Returned' },
            { id: 'Exchange', label: 'Exchange' },
            { id: 'Processing', label: 'Processing' },
            { id: 'Other', label: 'Other Orders' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            
            // Count calculations based on our rules
            let count = 0;
            if (tab.id === 'All') {
              count = sellerOrders.filter(o => !o.isManual || o.status !== 'Pending').length;
            } else if (tab.id === 'Pending') {
              count = sellerOrders.filter(o => !o.isManual && o.status === 'Pending').length;
            } else if (tab.id === 'Other') {
              count = sellerOrders.filter(o => !!o.isManual).length;
            } else {
              count = sellerOrders.filter(o => o.status === tab.id).length;
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as OrderConsoleTab)}
                className={`px-4.5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-[#F4631E] text-white shadow-lg shadow-[#F4631E]/20' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[8.5px] font-mono px-2 py-0.5 rounded-full ${isActive ? 'bg-white text-[#F4631E] font-black' : 'bg-white/5 text-slate-500 font-bold'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand Context Switching Tab Row */}
      {profile?.role === 'seller' && sellerRelations.length > 0 && (
        <div className="bg-app-card border border-app-border rounded-[2rem] p-4 shadow-xl flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">Segment Filter:</span>
            <button
              onClick={() => setActiveBrandId(null)}
              className={`px-4.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                activeBrandId === null 
                  ? 'bg-[#F4631E] text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              All Brands
            </button>
            {allBrands.filter(b => ownedBrandIds.includes(b.id)).map(b => (
              <button
                key={b.id}
                onClick={() => setActiveBrandId(b.id)}
                className={`px-4.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeBrandId === b.id 
                    ? 'bg-[#F4631E] text-white shadow-md' 
                    : 'text-slate-400 hover:text-[#F4631E] hover:bg-white/5'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4">
            Active Brand Context: <span className="text-emerald-400 font-mono">{activeBrand?.name || 'All Brands / Outlets'}</span>
          </div>
        </div>
      )}

      {/* Dynamic 12 tab core filtered orders display list */}
      <div className="space-y-6 animate-in fade-in duration-300">
        {filteredOrders.length === 0 ? (
          <div className="bg-app-card border border-app-border rounded-[2rem] p-16 text-center shadow-lg animate-fade-in">
            <AlertCircle className="w-12 h-12 text-[#8E9BAE] mx-auto mb-4" />
            <h3 className="text-md font-bold text-white mb-1 font-sans">No Orders Loaded</h3>
            <p className="text-xs text-[#8E9BAE] max-w-sm mx-auto font-sans">
              There are no orders matching the selected filter criteria tab or search query string.
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
                <div 
                  key={order.id} 
                  className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden hover:border-[#F4631E]/30 transition-all group"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#F4631E] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Order card heading info */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-app-border/60">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-slate-900 border border-app-border flex items-center justify-center font-bold text-white shadow-inner">
                        🛍️
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-black text-white">{order.id}</span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${getStatusStyle(order.status)}`}>
                            {order.status}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                            order.paymentStatus === 'Paid' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {order.paymentStatus}
                          </span>
                          {order.invoice_id && (
                            <span className="font-mono text-[9px] text-[#8E9BAE] bg-white/5 border border-app-border px-2 py-0.5 rounded">
                              INV: {order.invoice_id}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-1">
                          Log Time: {new Date(order.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {currentMainTab === 'console' && (
                        <>
                          {order.status === 'Pending' && (
                            <>
                              <button 
                                onClick={() => {
                                  approveOrder(order.id);
                                  showInlineToast(`Order ${order.id} approved successfully! Invoice INV-${order.id} generated.`);
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve Order
                              </button>
                              <button 
                                onClick={() => openAction(order, 'decline')}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          )}

                          {order.status === 'Confirmed' && (
                            <>
                              <button 
                                onClick={() => openAction(order, 'dispatch')}
                                className="flex items-gradient-to-r from-[#F4631E] to-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-[#F4631E]/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 px-3.5 py-2.5"
                              >
                                <Truck className="w-3.5 h-3.5" /> Mark Dispatched
                              </button>
                              <button 
                                onClick={() => openAction(order, 'cancel')}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Cancel Order
                              </button>
                            </>
                          )}

                          {order.status === 'Dispatched' && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  updateOrderStatus(order.id, 'In Transit');
                                  showInlineToast(`Order ${order.id} status transitioned to In Transit`);
                                }}
                                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Transit ➔
                              </button>
                            </div>
                          )}

                          {order.status === 'In Transit' && (
                            <button 
                              onClick={() => {
                                updateOrderStatus(order.id, 'Delivered');
                                showInlineToast(`Order ${order.id} marked as delivered successfully!`);
                              }}
                              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
                            </button>
                          )}

                          <button 
                            onClick={() => openAction(order, 'note')}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            title="Add note sent to client conversation layout"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#F4631E]" /> Comms Note
                          </button>

                          <button 
                            onClick={() => openAction(order, 'internal')}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            title="Add secure, internal, private merchant-only comment log"
                          >
                            <Notebook className="w-3.5 h-3.5" /> Internal Note
                          </button>
                        </>
                      )}

                      <Link 
                        to={`/admin/invoice/${order.id}`}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#ef3c23]" /> View Inv
                      </Link>

                      <button 
                        onClick={() => handlePrintInvoice(order)}
                        className="flex items-center gap-1.5 px-2.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Print invoice spool template"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-400" /> Print
                      </button>

                      <button 
                        onClick={() => handleDownloadInvoice(order)}
                        className="flex items-center gap-1.5 px-2.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Download invoice statement as text file"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" /> Get FILE
                      </button>
                    </div>
                  </div>

                  {/* Body columns of the order card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
                    {/* Items Panel */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Ordered Product SKU</span>
                      <div className="flex gap-4 items-center">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-app-border shrink-0 bg-black/40">
                          <img src={order.product.image} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div>
                          <h4 className="text-[12px] font-bold text-white">{order.product.name}</h4>
                          <p className="text-[10px] text-[#F4631E] font-extrabold mt-1">৳ {order.product.price.toLocaleString()}</p>
                          <p className="text-[9px] text-[#8E9BAE] mt-0.5">Brand Source: {order.product.brand}</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Profiler */}
                    <div className="space-y-3 border-t md:border-t-0 md:border-x border-app-border/40 md:px-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">Receiver Persona</span>
                        {order.customer.flagged && (
                          <span className="bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-red-500/20 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> RESTRICTED
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-app-border">
                          {order.customer.avatar}
                        </div>
                        <div>
                          <h5 className="text-[11px] font-bold text-white">{order.customer.name}</h5>
                          <p className="text-[9px] text-[#8E9BAE] truncate">{order.customer.email}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] text-slate-500 font-medium">Auto-Risk Score:</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                              order.customer.behavior === 'Good' 
                                ? 'text-emerald-500 bg-emerald-500/10'
                                : order.customer.behavior === 'Risk'
                                ? 'text-rose-500 bg-rose-500/10'
                                : 'text-amber-500 bg-amber-500/10'
                            }`}>
                              {order.customer.behavior}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Logistics Courier Gateway Tracker */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Warehousing & Courier Logistics</span>
                      {order.deliveryPartner ? (
                        <div className="bg-app-bg border border-app-border rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Courier Carrier</span>
                            <span className="text-[10px] font-mono font-black text-white">{order.deliveryPartner}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Fulfillment Tracking</span>
                            <a 
                              href={order.trackingUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[10px] font-extrabold text-[#F4631E] hover:underline flex items-center gap-1"
                            >
                              Track URL <ChevronRight className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#8E9BAE] leading-relaxed italic pt-1">
                          No shipment handler assigned. Complete order authorization & dispatch to lock delivery partner logs.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Notes Render area */}
                  {(order.customerNotes || order.declineReason || order.cancelReason || internalNotes[order.id]) && (
                    <div className="mt-6 pt-4 border-t border-app-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Customer Side Conversation Notes */}
                      {order.customerNotes && order.customerNotes.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-[#8E9BAE] uppercase tracking-wider block">Customer Conversation Log:</span>
                          <div className="space-y-1">
                            {order.customerNotes.map((cn, idx) => (
                              <div key={idx} className="bg-white/5 border border-app-border rounded-xl p-3 text-[11px] text-slate-200 flex gap-2">
                                <span className="text-[#F4631E] font-bold">💬</span>
                                <div>{cn}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Internal Merchant-Only Secure Notes */}
                      {internalNotes[order.id] && internalNotes[order.id].length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block">Internal Secured Merchant Comments:</span>
                          <div className="space-y-1">
                            {internalNotes[order.id].map((inote, idx) => (
                              <div key={idx} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200 flex gap-2">
                                <span className="text-amber-500 font-bold">🔒</span>
                                <div>{inote}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(order.declineReason || order.cancelReason) && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider block">Rejection / Cancellation Notes:</span>
                          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 text-[11px] text-rose-300">
                            {order.declineReason || order.cancelReason}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Embedded earnings calculations */}
                  <div className="absolute right-4 bottom-4 text-[8px] font-mono text-slate-500 uppercase flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                    <span>COMM RATE: {order.earnings.commissionPercent}%</span>
                    <span>AUTOMATED COMMISSION: ৳ {order.earnings.futureAutomatedDeduction}</span>
                    <span>MERCHANT NET REVENUE: ৳ {order.earnings.sellerNet}</span>
                  </div>
                </div>
              ))
            )}
          </div>

      {false && (
        <div className="space-y-6">
          {false ? (
            <div />
          ) : (
              ([] as any[]).map((order) => {
                const customerPhone = (order.customer as any).phone || 'N/A';
                const customerAddress = (order.customer as any).address || 'N/A';
                const platformLabel = order.platformSource || 'WhatsApp Sourced';

                return (
                  <div 
                    key={order.id} 
                    className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden hover:border-[#F4631E]/30 transition-all group"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-teal-500 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Order card heading info */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-app-border/60">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 border border-app-border flex items-center justify-center font-bold text-white shadow-inner text-base">
                          {platformLabel === 'WhatsApp' ? '💬' : platformLabel === 'Facebook' ? '📬' : platformLabel === 'Instagram' ? '📸' : '🔌'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-black text-white">{order.id}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-teal-500/10 text-teal-400 border-teal-500/20">
                              {platformLabel} Sourced
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${getStatusStyle(order.status)}`}>
                              {order.status}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                              order.paymentStatus === 'Paid' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {order.paymentStatus}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold mt-1 font-sans">
                            Log Time: {new Date(order.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Right Panel Header Buttons */}
                      <div className="flex items-center gap-2">
                        <Link 
                          to={`/admin/invoice/${order.id}`}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-black uppercase tracking-wider text-slate-300 border border-app-border rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> 
                          <span>Print Invoice</span>
                        </Link>
                        <button 
                          onClick={() => invoiceDownloadTXT(order)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-black uppercase tracking-wider text-slate-300 border border-app-border rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Txt Slip</span>
                        </button>
                      </div>
                    </div>

                    {/* Order Card Content Split */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-6 border-b border-app-border/40">
                      
                      {/* Customer Info Box */}
                      <div className="space-y-3">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">External Customer Profile</span>
                        <div className="bg-app-bg border border-app-border rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-black flex items-center justify-center">
                              {order.customer.avatar}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white font-sans">{order.customer.name}</div>
                              <div className="text-[10px] text-slate-400 font-sans">{order.customer.email || 'no-email@sourced.com'}</div>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-app-border/40 text-[10px] space-y-1">
                            <div className="text-[#8E9BAE] font-sans">📞 Phone: <span className="text-white font-mono font-medium">{customerPhone}</span></div>
                            <div className="text-[#8E9BAE] font-sans">🏠 Address: <span className="text-white font-sans">{customerAddress}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Product details summary */}
                      <div className="space-y-3">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Sourced Cart Items Selection</span>
                        <div className="bg-app-bg border border-app-border rounded-xl p-4 flex gap-4">
                          <div className="w-14 h-14 bg-slate-900 rounded-xl overflow-hidden border border-app-border shrink-0 flex items-center justify-center">
                            <img 
                              src={order.product.image} 
                              alt={order.product.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-white font-sans line-clamp-1">{order.product.name}</div>
                            <div className="text-[9px] text-[#F4631E] font-black uppercase tracking-wider">{order.product.brand}</div>
                            <div className="text-[10px] text-[#8E9BAE] font-sans">
                              Qty Ordered: <span className="text-white font-bold">{order.quantity || 1}</span>
                            </div>
                            <div className="text-xs font-black text-white pt-1">
                              Unit: ৳ {order.product.price.toLocaleString()} · Total: ৳ {(order.base_product_price || order.product.price).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Logistics Carrier Gateway Tracker */}
                      <div className="space-y-3">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Fulfillment Logistics Carriage</span>
                        {order.deliveryPartner ? (
                          <div className="bg-app-bg border border-app-border rounded-xl p-4 space-y-2 font-sans">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Courier Carrier</span>
                              <span className="text-[10px] font-mono font-black text-white">{order.deliveryPartner}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Fulfillment Tracking ID</span>
                              <a 
                                href={order.trackingUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] font-extrabold text-[#F4631E] hover:underline flex items-center gap-1"
                              >
                                {order.trackingUrl?.split('/').pop() || 'Track Link'} <ChevronRight className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-app-bg/50 border border-app-border border-dashed rounded-xl p-4 text-center">
                            <Truck className="w-5 h-5 text-slate-600 mx-auto mb-1.5" />
                            <p className="text-[9px] text-[#8E9BAE] leading-relaxed italic">
                              No dispatch carrier assigned. Set tracking in the Platform Inbox ERP workspace to launch this flow.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick State Actions for Sourced Trades */}
                    <div className="flex items-center justify-between pt-4.5 gap-4">
                      {/* Financial breakdown */}
                      <div className="text-[9px] font-mono text-slate-500 uppercase flex gap-4">
                        <span>PRICE OVERRIDE: ৳ {order.product.price.toLocaleString()}</span>
                        <span>SHIPPING FEE: ৳ {order.delivery_charge || 120}</span>
                        <span className="text-emerald-400 font-bold">GRAND TOTAL PAYABLE: ৳ {order.total_payable?.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {currentMainTab === 'console' && (
                          <>
                            {order.status === 'Pending' && (
                              <button
                                onClick={() => {
                                  approveOrder(order.id);
                                  showInlineToast(`✓ Sourced order ${order.id} approved successfully!`);
                                }}
                                className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow cursor-pointer"
                              >
                                Approve Order
                              </button>
                            )}
                            {order.status === 'Confirmed' && (
                              <button
                                onClick={() => {
                                  dispatchOrder(order.id, 'Pathao Courier Service', `https://track.pathao.com/manual-${order.id}`);
                                  showInlineToast(`✓ Sourced order ${order.id} dispatched via Pathao Courier!`);
                                }}
                                className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow cursor-pointer"
                              >
                                Dispatch Sourced Link
                              </button>
                            )}
                            {!['Delivered', 'Cancelled'].includes(order.status) && (
                              <button
                                onClick={() => {
                                  cancelOrder(order.id, 'Marked Cancelled by merchant from manual console');
                                  showInlineToast(`✓ Sourced Order ${order.id} Marked Cancelled.`);
                                }}
                                className="px-4 py-2 border border-rose-500/20 hover:border-rose-500 bg-rose-500/10 text-rose-400 font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                              >
                                Cancel Trade
                              </button>
                            )}
                            {order.status === 'Dispatched' && (
                              <button
                                onClick={() => {
                                  updateOrderStatus(order.id, 'Delivered');
                                  showInlineToast(`✓ Sourced order ${order.id} marked Completed!`);
                                }}
                                className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow cursor-pointer"
                              >
                                Confirm Completed Delivery
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      {/* TAB 2 CONTENT PANEL: ORDER HISTORY ARCHIVE */}
      {false && (
        <div className="space-y-6">
          {false ? (
            <div />
          ) : (
            ([] as any[]).map((order) => {
                const customerPhone = (order.customer as any).phone || '+880 1711-456789';
                const customerAddress = (order.customer as any).address || 'House 14, Road 4, Sector 12, Uttara, Dhaka';

                return (
                  <div 
                    key={order.id} 
                    className="bg-app-card/65 border border-app-border/85 rounded-[2rem] p-8 shadow-xl relative overflow-hidden"
                  >
                    {/* Upper heading segment for history card */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-app-border/40">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-slate-400"># {order.id}</span>
                          <span className={`text-[8.5px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                            order.status === 'Delivered' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {order.status}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 tracking-wider">
                            Invoice: {order.invoice_id || 'N/A'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                          Log Time: {new Date(order.timestamp).toLocaleString()} | End State: <span className="text-[#8E9BAE]">{order.deliverTime || order.cancelTime || 'Processed'}</span>
                        </p>
                      </div>

                      {/* Common Invoice tools accessible in history too */}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handlePrintInvoice(order)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-app-border rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print Statement
                        </button>
                        <button 
                          onClick={() => handleDownloadInvoice(order)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-app-border rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Doc
                        </button>
                        <Link 
                          to={`/admin/invoice/${order.id}`}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-[#F4631E] border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Invoice Details
                        </Link>
                      </div>
                    </div>

                    {/* Historical summary content layout */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                      
                      {/* Product Section */}
                      <div className="space-y-1">
                        <div className="text-[8.5px] uppercase tracking-widest font-bold text-slate-500">Bought Item</div>
                        <div className="flex gap-3 items-center mt-2">
                          <img src={order.product.image} className="w-10 h-10 rounded-lg object-cover border border-app-border bg-black/30" alt="" />
                          <div>
                            <div className="text-[11.5px] font-extrabold text-white">{order.product.name}</div>
                            <div className="text-[9.5px] text-[#F4631E] font-bold mt-0.5">৳ {order.product.price.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      {/* Customer Info Section */}
                      <div className="space-y-1 md:border-x border-app-border/40 md:px-6">
                        <div className="text-[8.5px] uppercase tracking-widest font-bold text-slate-500">Receiver Persona</div>
                        <div className="mt-2 text-xs">
                          <span className="font-extrabold text-slate-200">{order.customer.name}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{order.customer.email}</span>
                          <span className="text-[9px] text-[#8E9BAE] block mt-0.5">Phone: {customerPhone}</span>
                        </div>
                      </div>

                      {/* Delivery coverage */}
                      <div className="space-y-1">
                        <div className="text-[8.5px] uppercase tracking-widest font-bold text-slate-500">Logistics Destination</div>
                        <div className="mt-2 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {customerAddress}
                        </div>
                        {order.deliveryPartner && (
                          <div className="text-[9px] text-slate-500 font-mono mt-1">
                            Dispatched via: {order.deliveryPartner}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Show internal notes if any in history too */}
                    {internalNotes[order.id] && internalNotes[order.id].length > 0 && (
                      <div className="mt-6 pt-4 border-t border-app-border/30">
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Archive Secure Note Log:</span>
                        <div className="space-y-1 max-w-2xl">
                          {internalNotes[order.id].map((inote, index) => (
                            <p key={index} className="text-[10.5px] text-amber-200 bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10 inline-block mr-2 mt-1">
                              🔒 {inote}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      {/* Action Dialog Modal Drawer Backdrop */}
      {actioningOrder && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setActioningOrder(null)} />
          
          <div className="bg-app-card border border-app-border rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-black text-white capitalize">
                {actionType === 'decline' ? 'Decline Request' : actionType === 'cancel' ? 'Cancel Order' : actionType === 'dispatch' ? 'Fulfill Shipment' : actionType === 'internal' ? 'Merchant Internal Comment' : 'Customer Conversation Note'}
              </h3>
              <p className="text-xs text-[#8E9BAE] mt-1">
                Order Reference: <span className="font-mono text-white font-bold">{actioningOrder.id}</span>
              </p>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-5">
              {actionType === 'decline' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mandatory Reason for Decline</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="E.g. Damaged stock or delivery route not accessible."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-red-500/50"
                  />
                </div>
              )}

              {actionType === 'cancel' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Post-Approval Cancel Reason Note</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Detail the circumstances necessitating cancellation."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-rose-500/50"
                  />
                </div>
              )}

              {actionType === 'dispatch' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivery Partner Name</label>
                    <input 
                      required
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="E.g. Pathao, Paperfly, RedX, Sundarban"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracking URL Link</label>
                    <input 
                      type="url"
                      value={inputTextSecondary}
                      onChange={(e) => setInputTextSecondary(e.target.value)}
                      placeholder="E.g. https://track.pathao.com/id"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {actionType === 'note' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message Note (Syncs to Chat & Customer Visible)</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Say something to the customer regarding shipment sizing, timelines..."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-[#F4631E]/50"
                  />
                </div>
              )}

              {actionType === 'internal' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">🔒 Private Merchant Secured Log Note</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Put internal comments here (E.g. Verified customer on SCB bank ledger, VIP customer etc). Clients cannot view this."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-amber-500/50"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setActioningOrder(null)}
                  className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button 
                  type="submit"
                  className={`px-6 py-3 text-[10px] font-black uppercase text-white rounded-xl shadow-lg transition-all ${
                    actionType === 'decline' ? 'bg-red-600 hover:bg-red-500' : actionType === 'cancel' ? 'bg-rose-600 hover:bg-rose-100' : actionType === 'internal' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-[#F4631E] hover:bg-orange-500'
                  }`}
                >
                  Apply Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
