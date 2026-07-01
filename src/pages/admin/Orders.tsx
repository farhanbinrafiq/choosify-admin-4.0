import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  X,
  Package,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ShipmentProvider } from '../../contexts/ShipmentContext';
import { ShipmentCard } from '../../components/Shipment/ShipmentCard';
import { SplitLayout } from '../../components/Layout/SplitLayout';

const getMockProductId = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes('samsung') || t.includes('s25')) return '1';
  if (t.includes('vision') || t.includes('tv')) return '2';
  if (t.includes('fridge') || t.includes('walton')) return '4';
  return '3'; // Default to Saree (Aarong Jamdani Saree)
};

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
  const navigate = useNavigate();
  const orderDetailsPanes = [
    { size: 800, minSize: 600, maxSize: 1200 }, // Left side order info
    { size: 400, minSize: 300, maxSize: 600 }   // Right side customer specs
  ];
  const { profile } = useAuth();
  const { 
    orders, 
    approveOrder, 
    declineOrder, 
    cancelOrder, 
    dispatchOrder, 
    addCustomerNotes,
    updateOrderStatus,
    updateOrderTrackingStatus,
    addAdminNote,
    updateCodCollected
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

  // Admin-only advanced filters state
  const [filterSeller, setFilterSeller] = useState('All');
  const [filterBrand, setFilterBrand] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterCourier, setFilterCourier] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('All');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('All');
  const [filterRiskScore, setFilterRiskScore] = useState('All');
  const [filterDisputeStatus, setFilterDisputeStatus] = useState('All');
  const [filterOrderSource, setFilterOrderSource] = useState('All');
  const [filterDateRange, setFilterDateRange] = useState('All');
  const [filterVerificationStatus, setFilterVerificationStatus] = useState('All');
  const [filterFulfillmentStatus, setFilterFulfillmentStatus] = useState('All');

  // Multi-select bulk state
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');

  // Selected order for full-page detail view
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [codFilterOnly, setCodFilterOnly] = useState(false);

  // Admin-only metadata storage (overrides, disputes, custom courier, pricing, etc.)
  const [adminMetadata, setAdminMetadata] = useState<Record<string, {
    courierOverride?: string;
    trackingUrlOverride?: string;
    priceOverride?: number;
    deliveryChargeOverride?: number;
    isSuspended?: boolean;
    disputeStatus?: 'Open' | 'Resolved' | 'No Dispute';
    disputeReason?: string;
    refundStatus?: 'Pending' | 'Success' | 'None';
    refundAmount?: number;
    parentOrderId?: string;
    isReplacement?: boolean;
    auditLogs?: { time: string; actor: string; log: string }[];
  }>>(() => {
    const saved = localStorage.getItem('admin_orders_metadata');
    return saved ? JSON.parse(saved) : {};
  });

  const saveAdminMetadata = (orderId: string, data: any) => {
    const updated = {
      ...adminMetadata,
      [orderId]: {
        ...(adminMetadata[orderId] || {}),
        ...data,
        auditLogs: [
          ...(adminMetadata[orderId]?.auditLogs || []),
          ...(data.auditLogs || [])
        ]
      }
    };
    setAdminMetadata(updated);
    localStorage.setItem('admin_orders_metadata', JSON.stringify(updated));
  };

  const isAdmin = ['super_admin', 'admin', 'moderator', 'support_agent', 'finance_manager', 'marketing_manager'].includes(profile?.role || '');

  const activeBrand = allBrands.find(b => b.id === activeBrandId);
  const sellerId = profile?.role === 'seller' ? profile.id : 'seller_001'; 
  const sellerRelations = sellerBrands.filter(r => r.seller_user_id === profile?.id);
  const ownedBrandIds = sellerRelations.map(r => r.brand_id);
  const ownedBrandNames = allBrands.filter(b => ownedBrandIds.includes(b.id)).map(b => b.name.toLowerCase());

  const mergedOrders = orders.map(o => {
    const meta = adminMetadata[o.id];
    if (!meta) return o;
    return {
      ...o,
      deliveryPartner: meta.courierOverride || o.deliveryPartner,
      trackingUrl: meta.trackingUrlOverride || o.trackingUrl,
      paymentStatus: meta.refundStatus === 'Success' ? 'Refunded' : o.paymentStatus,
      total_payable: meta.priceOverride !== undefined ? (meta.priceOverride * (o.quantity || 1) + (meta.deliveryChargeOverride || o.delivery_charge || 120)) : o.total_payable,
      base_product_price: meta.priceOverride !== undefined ? meta.priceOverride : (o.base_product_price || o.product.price),
      delivery_charge: meta.deliveryChargeOverride !== undefined ? meta.deliveryChargeOverride : (o.delivery_charge || 120),
      disputeStatus: meta.disputeStatus || 'No Dispute',
      isSuspended: !!meta.isSuspended,
      isReplacement: !!meta.isReplacement,
      parentOrderId: meta.parentOrderId
    } as any;
  });

  // Comprehensive active orders list representing this seller's or admin's operational segment
  const sellerOrders = mergedOrders.filter(o => {
    if (isAdmin) {
      return true;
    }
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
    const sellerName = o.product.sellerName || '';
    const brandName = o.product.brand || '';
    const trackingNum = o.trackingUrl || '';
    const courier = o.deliveryPartner || '';
    const invoiceId = o.invoice_id || '';
    const transactionId = (o as any).transactionId || '';
    const billingRef = (o as any).billingRef || '';

    return (
      o.id.toLowerCase().includes(q) ||
      invoiceId.toLowerCase().includes(q) ||
      o.product.name.toLowerCase().includes(q) ||
      o.product.id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.email.toLowerCase().includes(q) ||
      phone.toLowerCase().includes(q) ||
      address.toLowerCase().includes(q) ||
      sellerName.toLowerCase().includes(q) ||
      brandName.toLowerCase().includes(q) ||
      trackingNum.toLowerCase().includes(q) ||
      courier.toLowerCase().includes(q) ||
      transactionId.toLowerCase().includes(q) ||
      billingRef.toLowerCase().includes(q)
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
    // Apply COD Only filter
    if (codFilterOnly) {
      const isCOD = o.isManual || o.paymentStatus !== 'Paid';
      if (!isCOD) return false;
    }

    // Apply cumulative workspace search query parameter
    if (!matchQuery(o, searchTerm)) return false;

    // Apply Active Tab filter
    let matchesTab = true;
    switch (activeTab) {
      case 'All':
        // MERGED: all platform orders + approved/later manual orders
        if (o.isManual && o.status === 'Pending') {
          matchesTab = false;
        } else {
          matchesTab = true;
        }
        break;

      case 'Pending':
        matchesTab = !o.isManual && o.status === 'Pending';
        break;

      case 'Confirmed':
        matchesTab = o.status === 'Confirmed';
        break;

      case 'Dispatched':
        matchesTab = o.status === 'Dispatched';
        break;

      case 'In Transit':
        matchesTab = o.status === 'In Transit';
        break;

      case 'Delivered':
        matchesTab = o.status === 'Delivered';
        break;

      case 'Cancelled':
        matchesTab = o.status === 'Cancelled';
        break;

      case 'Rejected':
        matchesTab = o.status === 'Rejected';
        break;

      case 'Returned':
        matchesTab = o.status === 'Returned';
        break;

      case 'Exchange':
        matchesTab = o.status === 'Exchange';
        break;

      case 'Processing':
        matchesTab = o.status === 'Processing';
        break;

      case 'Other':
        matchesTab = !!o.isManual;
        break;

      default:
        matchesTab = true;
    }
    if (!matchesTab) return false;

    // Apply Advanced Admin Filters if the current user is Admin (14 Criteria Checklist)
    if (isAdmin) {
      // 1. Seller Filter
      if (filterSeller !== 'All' && o.product.sellerName !== filterSeller) return false;
      
      // 2. Brand Filter
      if (filterBrand !== 'All' && o.product.brand !== filterBrand) return false;
      
      // 3. Category Filter
      if (filterCategory !== 'All') {
        const cat = filterCategory.toLowerCase();
        const matchesCat = o.product.name.toLowerCase().includes(cat) || o.product.brand.toLowerCase().includes(cat);
        if (!matchesCat) return false;
      }
      
      // 4. Courier Filter
      if (filterCourier !== 'All' && o.deliveryPartner !== filterCourier) return false;
      
      // 5. District Filter
      if (filterDistrict !== 'All') {
        const addressStr = ((o.customer as any).address || '').toLowerCase();
        if (!addressStr.includes(filterDistrict.toLowerCase())) return false;
      }

      // 6. Division Filter
      if (filterDivision !== 'All') {
        const addressStr = ((o.customer as any).address || '').toLowerCase();
        if (!addressStr.includes(filterDivision.toLowerCase())) return false;
      }

      // 7. Payment Method Filter (Online/COD)
      if (filterPaymentMethod !== 'All') {
        const isCOD = o.isManual || o.paymentStatus !== 'Paid';
        if (filterPaymentMethod === 'COD' && !isCOD) return false;
        if (filterPaymentMethod === 'Online' && isCOD) return false;
      }

      // 8. Payment Status Filter
      if (filterPaymentStatus !== 'All' && o.paymentStatus !== filterPaymentStatus) return false;

      // 9. Risk Score Filter
      if (filterRiskScore !== 'All' && o.customer.behavior !== filterRiskScore) return false;

      // 10. Dispute Status Filter
      if (filterDisputeStatus !== 'All') {
        const d_status = (o as any).disputeStatus || 'No Dispute';
        if (filterDisputeStatus !== d_status) return false;
      }

      // 11. Order Source Filter
      if (filterOrderSource !== 'All') {
        const isManual = !!o.isManual;
        if (filterOrderSource === 'Marketplace' && isManual) return false;
        if (filterOrderSource === 'Sourced' && !isManual) return false;
      }

      // 12. Date Range Filter
      if (filterDateRange !== 'All') {
        const orderDate = new Date(o.timestamp);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (filterDateRange === 'Today' && orderDate.toDateString() !== now.toDateString()) return false;
        if (filterDateRange === 'Last 7 Days' && diffDays > 7) return false;
      }

      // 13. Verification Status Filter
      if (filterVerificationStatus !== 'All') {
        const isVerified = !o.customer.flagged;
        if (filterVerificationStatus === 'Verified' && !isVerified) return false;
        if (filterVerificationStatus === 'Flagged/Unverified' && isVerified) return false;
      }

      // 14. Fulfillment Status Filter
      if (filterFulfillmentStatus !== 'All' && o.status !== filterFulfillmentStatus) return false;
    }

    return true;
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
          
          <div class="overflow-x-auto -mx-4 px-4 custom-scrollbar">
            <div class="min-w-[900px]">
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
            </div>
          </div>
          
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

  if (selectedOrderId) {
    const order = mergedOrders.find(o => o.id === selectedOrderId);
    if (!order) {
      setSelectedOrderId(null);
    } else {
      const meta = adminMetadata[order.id] || {};
      const auditLogs = meta.auditLogs || [
        { time: new Date(order.timestamp).toLocaleTimeString(), actor: 'System', log: 'Order placed by customer via automated portal.' }
      ];

      return (
        <div className="space-y-8 pb-16 text-app-text-primary text-sans animate-in fade-in duration-300 relative">
          {/* Toast Alert Banner */}
          {toastMsg && (
            <div className="fixed bottom-6 right-6 z-50 bg-app-card border border-emerald-500/30 text-emerald-400 px-6 py-4.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-black uppercase tracking-wider">{toastMsg}</span>
            </div>
          )}

          {/* Back header */}
          <div className="flex items-center justify-between bg-app-card border border-app-border rounded-[2rem] p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-app-text-primary transition-all cursor-pointer border border-app-border"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Back to Order Console</div>
                <h1 className="text-lg font-black text-app-text-primary flex items-center gap-2">
                  <span>Order Details:</span>
                  <span className="text-emerald-400 font-mono">{order.id}</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border${getStatusStyle(order.status)}`}>
                {order.status}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border${
                order.paymentStatus === 'Paid' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {order.paymentStatus}
              </span>
              {order.isSuspended && (
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border bg-amber-500/10 text-amber-500 border-amber-500/25">
                  ⚠️ SUSPENDED
                </span>
              )}
            </div>
          </div>

          {/* 2-column Layout with Splitter */}
          <SplitLayout layoutId="order-details-studio" panes={orderDetailsPanes} className="border border-app-border rounded-[2rem] overflow-hidden bg-app-card min-h-[600px]">
            {/* Main Info Column */}
            <div className="space-y-8 p-8 h-full overflow-y-auto">
              
              {/* Timeline Progress Bar */}
              <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#F4631E] mb-6">Operations Timeline</h3>
                
                <div className="relative">
                  {/* Visual Line */}
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-app-border/40 -translate-y-1/2 z-0 hidden md:block" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 relative z-10">
                    {[
                      { state: 'Pending', label: '1. Placed', desc: 'Awaiting confirmation' },
                      { state: 'Confirmed', label: '2. Confirmed', desc: 'Approved for packing' },
                      { state: 'Processing', label: '3. In Process', desc: 'Being prepared' },
                      { state: 'Dispatched', label: '4. Dispatched', desc: 'Left terminal' },
                      { state: 'In Transit', label: '5. In Transit', desc: 'With courier agent' },
                      { state: 'Delivered', label: '6. Delivered', desc: 'Handed to receiver' },
                    ].map((step, idx) => {
                      const statuses = ['Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivered'];
                      const currentIdx = statuses.indexOf(order.status);
                      const stepIdx = statuses.indexOf(step.state);
                      const isCompleted = stepIdx <= currentIdx && order.status !== 'Cancelled';
                      const isCurrent = step.state === order.status;

                      return (
                        <div key={idx} className="flex flex-row md:flex-col items-center gap-3 text-center md:text-sans">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-black text-xs shrink-0 transition-all${
                            isCurrent 
                              ? 'bg-[#F4631E] text-white border-[#F4631E] animate-pulse scale-110 shadow-lg shadow-[#F4631E]/30'
                              : isCompleted 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-app-bg text-slate-500 border-app-border'
                          }`}>
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          <div className="text-left md:text-center mt-0 md:mt-2">
                            <div className={`text-[11px] font-black uppercase tracking-wider${isCurrent ? 'text-[#F4631E]' : 'text-white'}`}>
                              {step.label}
                            </div>
                            <div className="text-[9px] text-[#8E9BAE] font-medium leading-tight">
                              {step.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Product description & Invoice info */}
              <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-app-border/40 pb-4">
                  <span className="text-xs font-black uppercase tracking-widest text-[#F4631E]">Retail Cart Items</span>
                  <span className="font-mono text-xs text-[#8E9BAE]">Invoice Ref: {order.invoice_id || 'N/A'}</span>
                </div>

                <div className="flex gap-6 items-start">
                  <div className="w-20 h-20 bg-app-card border border-app-border rounded-2xl overflow-hidden shrink-0">
                    <img src={order.product.image} className="w-full h-full object-cover" alt={order.product.name} />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-white/5 border border-app-border px-2.5 py-1 rounded-full text-[#F4631E]">
                      {order.product.brand}
                    </span>
                    <h4 className="text-md font-bold text-app-text-primary font-sans">
                      <Link to={`/products/${getMockProductId(order.product.name)}`} className="hover:underline hover:text-app-accent transition-colors">
                        {order.product.name}
                      </Link>
                    </h4>
                    <div className="text-xs text-[#8E9BAE] font-medium">SKU ID: <span className="font-mono text-app-text-primary text-[11px] font-black">{order.product.id}</span></div>
                    <div className="text-xs text-[#8E9BAE] font-medium">Quantity: <span className="text-app-text-primary font-bold">{order.quantity || 1}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-app-text-secondary uppercase">Unit Price</div>
                    <div className="text-lg font-black text-app-text-primary">৳ {order.product.price.toLocaleString()}</div>
                  </div>
                </div>

                {/* Financial ledger summary */}
                <div className="bg-app-bg border border-app-border rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Subtotal</span>
                    <span className="text-sm font-black text-app-text-primary">৳ {(order.product.price * (order.quantity || 1)).toLocaleString()}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Logistics Charge</span>
                    <span className="text-sm font-black text-app-text-primary">৳ {(order.delivery_charge || 120).toLocaleString()}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Commission ({order.earnings.commissionPercent}%)</span>
                    <span className="text-sm font-black text-[#F4631E]">৳ {order.earnings.futureAutomatedDeduction.toLocaleString()}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Merchant Net Payout</span>
                    <span className="text-sm font-black text-emerald-400">৳ {order.earnings.sellerNet.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/5 border border-app-border rounded-xl px-5 py-3.5 gap-4">
                  <div className="flex items-center gap-4 flex-1 justify-between sm:justify-start">
                    <span className="text-xs font-black uppercase tracking-wider text-app-text-secondary">Total Billed Customer Amount:</span>
                    <span className="text-md font-black text-app-text-primary">৳ {((order.product.price * (order.quantity || 1)) + (order.delivery_charge || 120)).toLocaleString()} BDT</span>
                  </div>
                  <button 
                    onClick={() => {
                      sessionStorage.setItem(`choosify_invoice_${order.id}`, JSON.stringify(order));
                      navigate(`/admin/invoice/${order.id}`, { state: { order } });
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-app-text-primary bg-white/5 hover:bg-white/10 border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#F4631E]" /> Invoice
                  </button>
                </div>
              </div>

              {/* Secure Admin Fulfillment Control Panel */}
              {isAdmin && (
                <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl space-y-6">
                  <div className="flex items-center gap-2 border-b border-app-border/40 pb-4">
                    <Truck className="w-5 h-5 text-[#F4631E]" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-app-text-primary">Full-Stack ERP Logistics &amp; Fulfillment Control</h3>
                  </div>

                  {order.status === 'Returned' && (
                    <div className="bg-orange-950/40 text-orange-400 border border-orange-900/40 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-[#F4631E] shrink-0" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-app-text-primary">Reverse Logistics &amp; Refund in Progress</h4>
                      </div>
                      <p className="text-[10px] text-app-text-secondary leading-relaxed font-medium">
                        This order has been designated for customer return. All logistics tracking, warehouse inspection status, and SSL payout refunds should be actioned in the Returns &amp; Refunds center.
                      </p>
                      <button
                        onClick={() => navigate('/admin/returns')}
                        className="px-4 py-2 bg-[#F4631E] hover:bg-[#F4631E]/80 text-white font-black uppercase tracking-widest text-[9px] rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Package className="w-3.5 h-3.5" />
                        Go to Returns Dashboard
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <span className="text-xs font-black uppercase tracking-widest text-[#F4631E] block">Sellers Sub-Orders Dispatch &amp; Tracking</span>
                    {(order.subOrders || [
                      {
                        sellerId: order.product.sellerId,
                        sellerName: order.product.sellerName,
                        trackingStatus: 'pending'
                      }
                    ]).map((so) => (
                      <SubOrderTrackerRow 
                        key={so.sellerId} 
                        subOrder={so as any} 
                        orderId={order.id} 
                        updateOrderTrackingStatus={updateOrderTrackingStatus}
                        showInlineToast={showInlineToast}
                      />
                    ))}
                  </div>

                  {/* COD Collected Toggle */}
                  {(() => {
                    const isCOD = order.isManual || order.paymentStatus !== 'Paid';
                    const isDelivered = order.status === 'Delivered';
                    if (isCOD && isDelivered) {
                      return (
                        <div className="bg-white/5 border border-app-border rounded-xl p-5 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">COD Collected Status</h4>
                            <p className="text-[10px] text-app-text-secondary mt-1 font-medium">Has CASH payment been fully collected by courier agent?</p>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <input 
                              type="checkbox" 
                              id={`cod-collect-checkbox-${order.id}`}
                              checked={order.codCollected || false}
                              onChange={(e) => {
                                updateCodCollected(order.id, e.target.checked);
                                addCustomerNotes(order.id, `🔒 Admin confirmed COD collection: ${e.target.checked ? 'Collected' : 'Pending'}`);
                                showInlineToast(`✓ COD Collected set to: ${e.target.checked ? 'True' : 'False'}`);
                              }}
                              className="w-5 h-5 rounded border-app-border text-[#F4631E] focus:ring-[#F4631E] bg-app-card cursor-pointer accent-[#F4631E]"
                            />
                            <label htmlFor={`cod-collect-checkbox-${order.id}`} className="text-xs font-bold text-app-text-primary uppercase tracking-wider cursor-pointer">
                              Confirm COD Collected
                            </label>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Admin Notes Section */}
                  <div className="space-y-3 pt-4 border-t border-app-border/40">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider block">Add Internal Admin Note</label>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = new FormData(form);
                      const note = formData.get('adminNoteText')?.toString().trim();
                      if (note) {
                        addAdminNote(order.id, note);
                        form.reset();
                        showInlineToast(`✓ Private admin ledger note appended successfully.`);
                      }
                    }} className="space-y-2">
                      <textarea 
                        name="adminNoteText"
                        rows={3}
                        placeholder="Type private admin notes..."
                        className="w-full p-4 bg-app-card border border-app-border rounded-xl text-xs text-app-text-primary placeholder-slate-500 outline-none focus:border-[#F4631E] min-h-[80px]"
                      />
                      <div className="flex justify-end">
                        <button 
                          type="submit"
                          className="px-4 py-2 bg-[#F4631E]/20 hover:bg-[#F4631E]/30 text-[#F4631E] border border-[#F4631E]/30 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all"
                        >
                          Save Note
                        </button>
                      </div>
                    </form>

                    {/* Render existing adminNotes */}
                    {order.adminNotes && order.adminNotes.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <span className="text-[9px] font-bold text-[#F4631E] uppercase tracking-wider block">Admin Notes History:</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                          {order.adminNotes.map((an, idx) => (
                            <div key={idx} className="bg-app-card border border-app-border rounded-xl p-3 text-[11px] text-app-text-secondary font-medium font-mono">
                              {an}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Secure Admin Overrides panel */}
              {isAdmin && (
                <div className="bg-[#1e1512] border border-[#F4631E]/20 rounded-[2rem] p-8 shadow-2xl space-y-6">
                  <div className="flex items-center gap-2 border-b border-[#F4631E]/10 pb-4">
                    <ShieldCheck className="w-5 h-5 text-[#F4631E]" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-app-text-primary">Administrative Decisive Control Panel</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Status Force Change dropdown */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider block">Bypass Status Engine (Force Transition)</label>
                      <select 
                        value={order.status}
                        onChange={(e) => {
                          updateOrderStatus(order.id, e.target.value as OrderStatus);
                          saveAdminMetadata(order.id, {
                            auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Override', log: `Status overrode to: ${e.target.value}` }]
                          });
                          showInlineToast(`✓ Status overrode to ${e.target.value} successfully.`);
                        }}
                        className="w-full px-4 py-3 bg-app-card border border-app-border rounded-xl text-xs text-app-text-primary outline-none focus:border-[#F4631E]"
                      >
                        {['Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled', 'Rejected', 'Returned', 'Exchange'].map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reassign courier */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider block">Reassign Carrier Agency (Courier)</label>
                      <input 
                        type="text"
                        placeholder="e.g. Pathao Express, RedX..."
                        defaultValue={order.deliveryPartner || ''}
                        onBlur={(e) => {
                          if (e.target.value) {
                            saveAdminMetadata(order.id, {
                              courierOverride: e.target.value,
                              trackingUrlOverride: 'https://pathao.com/track/' + order.id,
                              auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Override', log: `Courier reassigned to: ${e.target.value}` }]
                            });
                            showInlineToast(`✓ Courier agency reassigned to ${e.target.value}.`);
                          }
                        }}
                        className="w-full px-4 py-3 bg-app-card border border-app-border rounded-xl text-xs text-app-text-primary outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    {/* Dynamic Override pricing values */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider block">Override pricing or Unit Rate (BDT)</label>
                      <input 
                        type="number"
                        placeholder="Enter raw price value"
                        defaultValue={order.product.price}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            saveAdminMetadata(order.id, {
                              priceOverride: val,
                              auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Override', log: `Unit rate overrode to ৳ ${val}` }]
                            });
                            showInlineToast(`✓ Invoice pricing overrode to ৳ ${val}.`);
                          }
                        }}
                        className="w-full px-4 py-3 bg-app-card border border-app-border rounded-xl text-xs text-app-text-primary outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    {/* Reassign brand */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider block">Admin Force Re-attribution (Brand)</label>
                      <select 
                        defaultValue={order.product.brand}
                        onChange={(e) => {
                          saveAdminMetadata(order.id, {
                            auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Override', log: `Brand mapping overrode to ${e.target.value}` }]
                          });
                          showInlineToast(`✓ Brand attribution re-mapped to ${e.target.value}.`);
                        }}
                        className="w-full px-4 py-3 bg-app-card border border-[#F4631E]/20 rounded-xl text-xs text-app-text-primary outline-none focus:border-[#F4631E]"
                      >
                        {Array.from(new Set(orders.map(o => o.product.brand))).map((brand) => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-4 border-t border-[#F4631E]/10">
                    {/* Suspend Order */}
                    <button 
                      onClick={() => {
                        const updatedSuspended = !order.isSuspended;
                        saveAdminMetadata(order.id, {
                          isSuspended: updatedSuspended,
                          auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Action', log: updatedSuspended ? 'Payout suspended and order locked.' : 'Payout suspension lifted.' }]
                        });
                        showInlineToast(updatedSuspended ? '⚠️ Order payouts suspended!' : '✓ Order suspension lifted.');
                      }}
                      className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl border flex items-center gap-2 cursor-pointer transition-all${
                        order.isSuspended 
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' 
                          : 'bg-white/5 text-slate-300 border-slate-700 hover:bg-white/10'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> {order.isSuspended ? 'Unsuspend Pay' : 'Unsuspend Pay'}
                    </button>

                    {/* Refund Process */}
                    <button 
                      onClick={() => {
                        saveAdminMetadata(order.id, {
                          refundStatus: 'Success',
                          refundAmount: order.product.price + 120,
                          auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Financial', log: `Process marketplace refund of ৳ ${(order.product.price + 120).toLocaleString()}` }]
                        });
                        showInlineToast('✓ Customer refund successfully initiated and auto-settled!');
                      }}
                      disabled={order.paymentStatus === 'Refunded'}
                      className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Refund Settled BDT
                    </button>

                    {/* Generate Replacement */}
                    <button 
                      onClick={() => {
                        const cloneId = `${order.id}-REP-${Math.floor(100 + Math.random() * 900)}`;
                        saveAdminMetadata(order.id, {
                          auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Action', log: `Generated administrative replacement order: ${cloneId}` }]
                        });
                        saveAdminMetadata(cloneId, {
                          priceOverride: 0, 
                          deliveryChargeOverride: 0,
                          isReplacement: true,
                          parentOrderId: order.id,
                          auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin System', log: `Replacement order seeded from parent: ${order.id}` }]
                        });
                        showInlineToast(`✓ Replacement Order Generated with ID: ${cloneId}`);
                      }}
                      className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Generate Replacement
                    </button>
                  </div>
                </div>
              )}

              {/* Logistics & Shipment Card */}
              <ShipmentProvider
                orderId={order.id}
                sellerId={order.product.sellerId}
                orderTotal={order.total_payable || (order.product.price * (order.quantity || 1)) + (order.delivery_charge || 120)}
                deliveryDistrict={(order.customer as any).district || 'Dhaka'}
                seller={{
                  id: order.product.sellerId,
                  name: order.product.sellerName,
                  address: 'Uttara, Dhaka',
                  phone: '01711122233',
                  email: 'seller@lms.com'
                }}
                customer={order.customer}
                items={[
                  {
                    productId: order.product.id,
                    name: order.product.name,
                    quantity: order.quantity || 1,
                    price: order.product.price
                  }
                ]}
                codAmount={order.total_payable || (order.product.price * (order.quantity || 1)) + (order.delivery_charge || 120)}
              >
                <div className="mt-8">
                  <ShipmentCard
                    orderId={order.id}
                    seller={{
                      id: order.product.sellerId,
                      name: order.product.sellerName,
                      address: 'Uttara, Dhaka',
                      phone: '01711122233',
                      email: 'seller@lms.com'
                    }}
                    customer={order.customer}
                    items={[
                      {
                        productId: order.product.id,
                        name: order.product.name,
                        quantity: order.quantity || 1,
                        price: order.product.price
                      }
                    ]}
                    codAmount={order.total_payable || (order.product.price * (order.quantity || 1)) + (order.delivery_charge || 120)}
                  />
                </div>
              </ShipmentProvider>
            </div>

            {/* Customer Profile & Dispute Center */}
            <div className="space-y-8 p-8 h-full overflow-y-auto bg-white/5 border-l border-app-border">
              
              {/* Customer Box */}
              <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl space-y-6">
                <span className="text-xs font-black uppercase tracking-widest text-[#F4631E] block border-b border-app-border/40 pb-4">Customer profile ledger</span>
                
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-full bg-[#F4631E]/20 border border-[#F4631E]/30 text-[#F4631E] font-black text-sm flex items-center justify-center shadow-inner">
                    {order.customer.avatar}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-app-text-primary">
                      {isAdmin ? (
                        <Link 
                          to={`/admin/consumers/${order.customer.id}`}
                          className="hover:text-[#F4631E] hover:underline focus:outline-none focus:ring-1 focus:ring-[#F4631E] transition-colors"
                        >
                          {order.customer.name}
                        </Link>
                      ) : (
                        order.customer.name
                      )}
                    </h4>
                    <p className="text-xs text-[#8E9BAE]">{order.customer.email}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-app-border/40 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Phone Number:</span>
                    <span className="text-app-text-primary font-mono font-bold">{(order.customer as any).phone || "+880 1711-456789"}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold">Fulfillment Address:</span>
                    <div className="text-app-text-primary font-serif italic text-[11px] leading-relaxed bg-app-bg px-3.5 py-2.5 rounded-xl border border-app-border/60">
                      {(order.customer as any).address || "House 14, Road 4, Sector 12, Uttara, Dhaka"}
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-[#F4631E]/5 p-3 rounded-xl border border-[#F4631E]/10">
                    <span className="text-app-text-secondary font-bold">Behavior Verification:</span>
                    <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded border${
                      order.customer.behavior === 'Good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {order.customer.behavior} Grade
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="pt-4 border-t border-app-border/40 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Admin CRM Shortcuts</span>
                      <div className="grid grid-cols-2 gap-2">
                        <Link 
                          to={`/admin/consumers/${order.customer.id}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium hover:bg-white/10 transition-colors"
                        >
                          👤 Profile
                        </Link>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(order.customer.id);
                            showInlineToast('✓ Customer ID copied to clipboard!');
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-app-border rounded-xl text-[10px] text-left text-app-text-primary font-medium hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          📋 ID
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(order.customer.email);
                            showInlineToast('✓ Customer Email copied to clipboard!');
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-app-border rounded-xl text-[10px] text-left text-app-text-primary font-medium hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          ✉️ Email
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText((order.customer as any).phone || "+880 1711-456789");
                            showInlineToast('✓ Customer Phone copied to clipboard!');
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-app-border rounded-xl text-[10px] text-left text-app-text-primary font-medium hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          📞 Phone
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Dispute Center */}
              {isAdmin && (
                <div className="bg-[#1c1214] border border-rose-500/10 rounded-[2rem] p-8 shadow-2xl space-y-6">
                  <div className="flex items-center gap-2 border-b border-rose-500/10 pb-4">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-app-text-primary">Dispute Center Secure Panel</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-app-text-secondary">Claims Status:</span>
                      <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded border${
                        order.disputeStatus === 'Open' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' 
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {order.disputeStatus || 'No Dispute'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => {
                          const dStatus = order.disputeStatus === 'Open' ? 'No Dispute' : 'Open';
                          saveAdminMetadata(order.id, {
                            disputeStatus: dStatus as any,
                            auditLogs: [{ time: new Date().toLocaleTimeString(), actor: 'Admin Dispute', log: dStatus === 'Open' ? 'Dispute case logged for quality audit check' : 'Dispute resolved-closed.' }]
                          });
                          showInlineToast(dStatus === 'Open' ? '⚠️ Case filed under Quality Dispute.' : '✓ Dispute successfully resolved.');
                        }}
                        className="w-full py-2.5 text-[10px] font-black uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl cursor-pointer text-center block transition-all"
                      >
                        {order.disputeStatus === 'Open' ? 'Resolve/Close Dispute' : 'Open Active Dispute Case'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Logs Trail */}
              <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl space-y-6">
                <span className="text-xs font-black uppercase tracking-widest text-[#F4631E] block border-b border-app-border/40 pb-4">Audit log activity trail</span>
                
                <div className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar">
                  {auditLogs.map((log: any, idx: number) => (
                    <div key={idx} className="flex gap-3 text-[11px] items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#F4631E] mt-1 shrink-0" />
                      <div>
                        <div className="text-app-text-secondary font-mono font-medium">{log.time} · {log.actor}</div>
                        <div className="text-app-text-primary mt-0.5 font-sans leading-relaxed">{log.log}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SplitLayout>
        </div>
      );
    }
  }

  return (
    <div className="space-y-8 pb-12 text-app-text-primary relative font-sans">
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-app-card border border-emerald-500/30 text-emerald-400 px-6 py-4.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-xs font-black uppercase tracking-wider">{toastMsg}</span>
        </div>
      )}

      {/* Dynamic Floating Sticky Bulk Actions Control Tray */}
      {isAdmin && selectedOrders.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e2e]/95 border border-[#F4631E]/40 px-6 py-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex items-center gap-6 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F4631E] animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-wider text-app-text-primary">
              Selected <span className="text-[#F4631E] font-black">{selectedOrders.length}</span> Batch Orders
            </span>
          </div>

          <div className="h-4 w-px bg-app-border/60" />

          <div className="flex items-center gap-2">
            {/* 1. Bulk Approve */}
            <button 
              onClick={() => {
                selectedOrders.forEach(id => approveOrder(id));
                setSelectedOrders([]);
                showInlineToast(`✓ Bulk approval finalized for ${selectedOrders.length} active orders!`);
              }}
              className="px-3.5 py-2 text-[10px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-black uppercase tracking-widest text-white cursor-pointer active:scale-95 transition-all"
            >
              Approve
            </button>

            {/* 2. Bulk Dispatch */}
            <button 
              onClick={() => {
                selectedOrders.forEach(id => updateOrderStatus(id, 'Dispatched'));
                setSelectedOrders([]);
                showInlineToast(`✓ Bulk dispatched state initialized for ${selectedOrders.length} orders!`);
              }}
              className="px-3.5 py-2 text-[10px] bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 rounded-xl font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all"
            >
              Dispatch
            </button>

            {/* 3. Bulk Transit */}
            <button 
              onClick={() => {
                selectedOrders.forEach(id => updateOrderStatus(id, 'In Transit'));
                setSelectedOrders([]);
                showInlineToast(`✓ Bulk transit route logged for ${selectedOrders.length} orders!`);
              }}
              className="px-3.5 py-2 text-[10px] bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-xl font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all"
            >
              In Transit
            </button>

            {/* 4. Bulk Deliver */}
            <button 
              onClick={() => {
                selectedOrders.forEach(id => updateOrderStatus(id, 'Delivered'));
                setSelectedOrders([]);
                showInlineToast(`✓ Bulk shipment settlement finalized for ${selectedOrders.length} orders!`);
              }}
              className="px-3.5 py-2 text-[10px] bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 rounded-xl font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all"
            >
              Deliver
            </button>

            {/* 5. Bulk Cancel */}
            <button 
              onClick={() => {
                selectedOrders.forEach(id => cancelOrder(id));
                setSelectedOrders([]);
                showInlineToast(`✓ Bulk cancellation registered for ${selectedOrders.length} orders.`);
              }}
              className="px-3.5 py-2 text-[10px] bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 rounded-xl font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>

          <div className="h-4 w-px bg-app-border/60" />

          {/* Clear Select */}
          <button 
            onClick={() => setSelectedOrders([])}
            className="text-[9px] font-black uppercase tracking-wider text-app-text-secondary hover:text-white transition-colors cursor-pointer"
          >
            Deselect
          </button>
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
        {(() => {
          const pendingDispatchCount = sellerOrders.filter(o => 
            o.subOrders?.some(so => so.trackingStatus === 'pending')
          ).length;

          const codUnconfirmedCount = sellerOrders.filter(o => {
            const isCOD = o.isManual || o.paymentStatus !== 'Paid';
            return isCOD && o.status === 'Delivered' && !o.codCollected;
          }).length;

          return (
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
              <div className="bg-app-bg/60 border border-app-border rounded-2xl px-5 py-3 flex flex-col justify-center min-w-[110px]">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Pending Dispatch</span>
                <span className="text-lg font-black text-blue-400">{pendingDispatchCount}</span>
              </div>
              <div className="bg-app-bg/60 border border-app-border rounded-2xl px-5 py-3 flex flex-col justify-center min-w-[110px]">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">COD Unconfirmed</span>
                <span className="text-lg font-black text-rose-400">{codUnconfirmedCount}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* REQUIRED TOP NAVIGATION TABS */}
      <div className="bg-app-card border border-app-border rounded-[2rem] p-4.5 shadow-xl flex gap-3">
        <button
          id="btn-nav-order-console"
          onClick={() => setCurrentMainTab('console')}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all rounded-xl cursor-pointer${
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
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all rounded-xl cursor-pointer${
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
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch md:items-center">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#F4631E] transition-colors" />
              <input 
                type="text"
                placeholder="Search by ID, Customer Name, SKU, product brand, invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-app-bg border border-app-border rounded-xl text-xs text-app-text-primary placeholder-slate-500 outline-none focus:border-[#F4631E]/60 transition-all font-medium"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-secondary hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              id="btn-cod-filter"
              onClick={() => setCodFilterOnly(!codFilterOnly)}
              className={`px-4 py-3 text-xs font-black uppercase tracking-widest rounded-xl border cursor-pointer transition-all${
                codFilterOnly 
                  ? 'bg-[#F4631E] border-[#F4631E] text-white shadow-lg shadow-[#F4631E]/20' 
                  : 'bg-app-bg border-app-border text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              💵 COD Only
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-app-text-secondary uppercase tracking-widest">
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
                className={`px-4.5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap flex items-center gap-2 shrink-0 cursor-pointer${
                  isActive 
                    ? 'bg-[#F4631E] text-white shadow-lg shadow-[#F4631E]/20' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[8.5px] font-mono px-2 py-0.5 rounded-full${isActive ? 'bg-white text-[#F4631E] font-black' : 'bg-white/5 text-slate-500 font-bold'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isAdmin && (
        <div className="bg-app-card border border-app-border rounded-[2rem] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-app-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#F4631E]" />
              <span className="text-xs font-black uppercase tracking-widest text-[#F4631E]">Marketplace Advanced Cross-Check Filters (14 Criteria Checklist)</span>
            </div>
            <button 
              onClick={() => {
                setFilterSeller('All');
                setFilterBrand('All');
                setFilterCategory('All');
                setFilterCourier('All');
                setFilterDistrict('All');
                setFilterDivision('All');
                setFilterPaymentMethod('All');
                setFilterPaymentStatus('All');
                setFilterRiskScore('All');
                setFilterDisputeStatus('All');
                setFilterOrderSource('All');
                setFilterDateRange('All');
                setFilterVerificationStatus('All');
                setFilterFulfillmentStatus('All');
                showInlineToast('✓ All 14 Advanced Filters cleared successfully.');
              }}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-white/5 border border-app-border rounded-lg text-app-text-secondary hover:text-[#F4631E]"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {/* 1. Seller Selector */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Seller/Merchant</span>
              <select 
                value={filterSeller}
                onChange={(e) => setFilterSeller(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Sellers</option>
                {Array.from(new Set(orders.map(o => o.product.sellerName))).filter(Boolean).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* 2. Brand Selector */}
            <div className="space-y-1 font-sans">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Brand / Label</span>
              <select 
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Brands</option>
                {Array.from(new Set(orders.map(o => o.product.brand))).filter(Boolean).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* 3. Category Selector */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">General Category</span>
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Categories</option>
                <option value="Clot">Apparel & Fashion</option>
                <option value="Foot">Footwear & Shoes</option>
                <option value="Tech">Gadgets & Tech</option>
                <option value="Cos">Cosmetics & Beauty</option>
              </select>
            </div>

            {/* 4. Courier Select */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Courier Agency</span>
              <select 
                value={filterCourier}
                onChange={(e) => setFilterCourier(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Couriers</option>
                {Array.from(new Set(orders.map(o => o.deliveryPartner))).filter(Boolean).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 5. Division Location */}
            <div className="space-y-1 select-none">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">BD Division</span>
              <select 
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Divisions</option>
                <option value="Dhaka">Dhaka</option>
                <option value="Chattogram">Chattogram</option>
                <option value="Sylhet">Sylhet</option>
                <option value="Barishal">Barishal</option>
                <option value="Khulna">Khulna</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Rangpur">Rangpur</option>
              </select>
            </div>

            {/* 6. District Location */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">BD District</span>
              <select 
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Districts</option>
                <option value="Uttara">Uttara Sub-zone</option>
                <option value="Dhanmondi">Dhanmondi Sub-zone</option>
                <option value="Gulshan">Gulshan Sub-zone</option>
                <option value="Mirpur">Mirpur Sub-zone</option>
                <option value="Banani">Banani Sub-zone</option>
              </select>
            </div>

            {/* 7. Payment Type (COD vs Online) */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Payment Method</span>
              <select 
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Methods</option>
                <option value="COD">Cash On Delivery (COD)</option>
                <option value="Online">Online Payments (SSL/IPN)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 pt-1">
            {/* 8. Payment Status */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Payment Status</span>
              <select 
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>

            {/* 9. Risk Score */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Customer Risk Level</span>
              <select 
                value={filterRiskScore}
                onChange={(e) => setFilterRiskScore(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Score Categories</option>
                <option value="Good">Good Behavior (Green)</option>
                <option value="Suspect">Suspect / Flagged (Amber/Red)</option>
              </select>
            </div>

            {/* 10. Dispute cases */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Claims & Disputes</span>
              <select 
                value={filterDisputeStatus}
                onChange={(e) => setFilterDisputeStatus(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Cases</option>
                <option value="No Dispute">No Dispute Case</option>
                <option value="Open">Open Claims Case</option>
                <option value="Resolved">Resolved Closed</option>
              </select>
            </div>

            {/* 11. Order Source */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Source Gateway</span>
              <select 
                value={filterOrderSource}
                onChange={(e) => setFilterOrderSource(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Gateways</option>
                <option value="Marketplace">Marketplace Order</option>
                <option value="Sourced">Sourced ERP Order</option>
              </select>
            </div>

            {/* 12. Date Range */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Logging Window</span>
              <select 
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Historic Times</option>
                <option value="Today">Recorded Today</option>
                <option value="Last 7 Days">Last 7 Days Run</option>
              </select>
            </div>

            {/* 13. Verification status */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Identity Verification</span>
              <select 
                value={filterVerificationStatus}
                onChange={(e) => setFilterVerificationStatus(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Identifiers</option>
                <option value="Verified">Verified Customers</option>
                <option value="Flagged/Unverified">Flagged/Unverified</option>
              </select>
            </div>

            {/* 14. Fulfillment status */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Final Fulfillment</span>
              <select 
                value={filterFulfillmentStatus}
                onChange={(e) => setFilterFulfillmentStatus(e.target.value)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] text-app-text-primary font-medium outline-none focus:border-[#F4631E]"
              >
                <option value="All">All Statuses</option>
                {['Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled', 'Rejected'].map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Brand Context Switching Tab Row */}
      {profile?.role === 'seller' && sellerRelations.length > 0 && (
        <div className="bg-app-card border border-app-border rounded-[2rem] p-4 shadow-xl flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">Segment Filter:</span>
            <button
              onClick={() => setActiveBrandId(null)}
              className={`px-4.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all${
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
                className={`px-4.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all${
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
            <h3 className="text-md font-bold text-app-text-primary mb-1 font-sans">No Orders Loaded</h3>
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
                      <input 
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={(e) => {
                          if (selectedOrders.includes(order.id)) {
                            setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                          } else {
                            setSelectedOrders([...selectedOrders, order.id]);
                          }
                        }}
                        className="w-4.5 h-4.5 rounded border-app-border text-[#F4631E] focus:ring-[#F4631E] bg-app-card cursor-pointer accent-[#F4631E] shrink-0"
                      />

                      <Link 
                        className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" 
                        to={`/upe/order/${order.id}`}
                        onClick={(e) => {
                          if (isAdmin) {
                            e.preventDefault();
                            setSelectedOrderId(order.id);
                          }
                        }}
                      >
                        <div className="w-11 h-11 rounded-xl bg-app-card border border-app-border flex items-center justify-center font-bold text-app-text-primary shadow-inner">
                          🛍️
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-black text-[#F4631E] hover:underline">{order.id}</span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border${getStatusStyle(order.status)}`}>
                            {order.status}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border${
                            order.paymentStatus === 'Paid' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {order.paymentStatus}
                          </span>
                          {order.subOrders?.map((so, idx) => (
                            <span 
                              key={idx} 
                              className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border${
                                so.trackingStatus === 'dispatched' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                so.trackingStatus === 'transit' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                so.trackingStatus === 'delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                so.trackingStatus === 'cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              }`}
                            >
                              Trk ({so.sellerName}): {so.trackingStatus}
                            </span>
                          ))}
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
                    </Link>

                    <Link 
                      to={`/admin/invoice/${order.id}`}
                      state={{ order }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sessionStorage.setItem(`choosify_invoice_${order.id}`, JSON.stringify(order));
                      }}
                      className="flex items-center gap-1 p-1 px-2.5 bg-app-card hover:bg-[#F4631E]/20 text-[#8E9BAE] hover:text-[#F4631E] border border-app-border rounded-lg text-[9px] font-bold transition-colors cursor-pointer shrink-0"
                      title="Quick Invoice Action"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#F4631E]" />
                      <span>Invoice</span>
                    </Link>
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
                                className="flex items-gradient-to-r from-[#F4631E] to-orange-500 text-app-text-primary rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-[#F4631E]/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 px-3.5 py-2.5"
                              >
                                <Truck className="w-3.5 h-3.5" /> Mark Dispatched
                              </button>
                              <button 
                                onClick={() => openAction(order, 'cancel')}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-app-text-secondary border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
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
                            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-app-text-primary border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
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

                      {isAdmin && (
                        <button 
                          onClick={() => setSelectedOrderId(order.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-[#F4631E]/20 to-orange-500/20 text-[#F4631E] border border-[#F4631E]/25 hover:border-[#F4631E]/45 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Fulfillment
                        </button>
                      )}

                      <Link 
                        to={`/admin/invoice/${order.id}`}
                        state={{ order }}
                        onClick={() => {
                          sessionStorage.setItem(`choosify_invoice_${order.id}`, JSON.stringify(order));
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-app-bg hover:bg-slate-700 text-app-text-primary border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#ef3c23]" /> View Inv
                      </Link>

                      <button 
                        onClick={() => handlePrintInvoice(order)}
                        className="flex items-center gap-1.5 px-2.5 py-2.5 bg-app-bg hover:bg-slate-700 text-app-text-primary border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Print invoice spool template"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-400" /> Print
                      </button>

                      <button 
                        onClick={() => handleDownloadInvoice(order)}
                        className="flex items-center gap-1.5 px-2.5 py-2.5 bg-app-bg hover:bg-slate-700 text-app-text-primary border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
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
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-app-border shrink-0 bg-app-card/20">
                          <img src={order.product.image} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div>
                          <h4 className="text-[12px] font-bold text-app-text-primary">{order.product.name}</h4>
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
                        <div className="w-10 h-10 rounded-full bg-app-bg text-app-text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-app-border">
                          {order.customer.avatar}
                        </div>
                        <div>
                          <h5 className="text-[11px] font-bold text-app-text-primary">
                            {isAdmin ? (
                              <Link 
                                to={`/admin/consumers/${order.customer.id}`}
                                className="hover:text-[#F4631E] hover:underline focus:outline-none focus:ring-1 focus:ring-[#F4631E] transition-colors"
                              >
                                {order.customer.name}
                              </Link>
                            ) : (
                              order.customer.name
                            )}
                          </h5>
                          <p className="text-[9px] text-[#8E9BAE] truncate">{order.customer.email}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] text-slate-500 font-medium">Auto-Risk Score:</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase${
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
                            <span className="text-[9px] font-bold text-app-text-secondary uppercase">Courier Carrier</span>
                            <span className="text-[10px] font-mono font-black text-app-text-primary">{order.deliveryPartner}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-app-text-secondary uppercase">Fulfillment Tracking</span>
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
                              <div key={idx} className="bg-white/5 border border-app-border rounded-xl p-3 text-[11px] text-app-text-secondary flex gap-2">
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
                        <div className="w-11 h-11 rounded-xl bg-app-card border border-app-border flex items-center justify-center font-bold text-app-text-primary shadow-inner text-base">
                          {platformLabel === 'WhatsApp' ? '💬' : platformLabel === 'Facebook' ? '📬' : platformLabel === 'Instagram' ? '📸' : '🔌'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-black text-app-text-primary">{order.id}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-teal-500/10 text-teal-400 border-teal-500/20">
                              {platformLabel} Sourced
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border${getStatusStyle(order.status)}`}>
                              {order.status}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border${
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
                          state={{ order }}
                          onClick={() => {
                            sessionStorage.setItem(`choosify_invoice_${order.id}`, JSON.stringify(order));
                          }}
                          className="px-4 py-2 bg-app-card hover:bg-slate-800 text-xs font-black uppercase tracking-wider text-app-text-secondary border border-app-border rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> 
                          <span>Print Invoice</span>
                        </Link>
                        <button 
                          onClick={() => invoiceDownloadTXT(order)}
                          className="px-4 py-2 bg-app-card hover:bg-slate-800 text-xs font-black uppercase tracking-wider text-app-text-secondary border border-app-border rounded-xl transition-all flex items-center gap-2 cursor-pointer"
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
                              <div className="text-xs font-bold text-app-text-primary font-sans">
                                {isAdmin ? (
                                  <Link 
                                    to={`/admin/consumers/${order.customer.id}`}
                                    className="hover:text-[#F4631E] hover:underline focus:outline-none focus:ring-1 focus:ring-[#F4631E] transition-colors"
                                  >
                                    {order.customer.name}
                                  </Link>
                                ) : (
                                  order.customer.name
                                )}
                              </div>
                              <div className="text-[10px] text-app-text-secondary font-sans">{order.customer.email || 'no-email@sourced.com'}</div>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-app-border/40 text-[10px] space-y-1">
                            <div className="text-[#8E9BAE] font-sans">📞 Phone: <span className="text-app-text-primary font-mono font-medium">{customerPhone}</span></div>
                            <div className="text-[#8E9BAE] font-sans">🏠 Address: <span className="text-app-text-primary font-sans">{customerAddress}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Product details summary */}
                      <div className="space-y-3">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Sourced Cart Items Selection</span>
                        <div className="bg-app-bg border border-app-border rounded-xl p-4 flex gap-4">
                          <div className="w-14 h-14 bg-app-card rounded-xl overflow-hidden border border-app-border shrink-0 flex items-center justify-center">
                            <img 
                              src={order.product.image} 
                              alt={order.product.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-app-text-primary font-sans line-clamp-1">
                              <Link to={`/products/${getMockProductId(order.product.name)}`} className="hover:underline hover:text-app-accent transition-colors">
                                {order.product.name}
                              </Link>
                            </div>
                            <div className="text-[9px] text-[#F4631E] font-black uppercase tracking-wider">{order.product.brand}</div>
                            <div className="text-[10px] text-[#8E9BAE] font-sans">
                              Qty Ordered: <span className="text-app-text-primary font-bold">{order.quantity || 1}</span>
                            </div>
                            <div className="text-xs font-black text-app-text-primary pt-1">
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
                              <span className="text-[9px] font-bold text-app-text-secondary uppercase">Courier Carrier</span>
                              <span className="text-[10px] font-mono font-black text-app-text-primary">{order.deliveryPartner}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-app-text-secondary uppercase">Fulfillment Tracking ID</span>
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
                          <span className="font-mono text-xs font-black text-app-text-secondary"># {order.id}</span>
                          <span className={`text-[8.5px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border${
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
                          className="flex items-center gap-1.5 px-3 py-2 bg-app-bg hover:bg-slate-700 text-app-text-secondary border border-app-border rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print Statement
                        </button>
                        <button 
                          onClick={() => handleDownloadInvoice(order)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-app-bg hover:bg-slate-700 text-app-text-secondary border border-app-border rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Doc
                        </button>
                        <Link 
                          to={`/admin/invoice/${order.id}`}
                          state={{ order }}
                          onClick={() => {
                            sessionStorage.setItem(`choosify_invoice_${order.id}`, JSON.stringify(order));
                          }}
                          className="px-3.5 py-2 bg-app-bg hover:bg-slate-700 text-[#F4631E] border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
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
                          <img src={order.product.image} className="w-10 h-10 rounded-lg object-cover border border-app-border bg-app-card/20" alt="" />
                          <div>
                            <div className="text-[11.5px] font-extrabold text-app-text-primary">
                              <Link to={`/products/${getMockProductId(order.product.name)}`} className="hover:underline hover:text-app-accent transition-colors">
                                {order.product.name}
                              </Link>
                            </div>
                            <div className="text-[9.5px] text-[#F4631E] font-bold mt-0.5">৳ {order.product.price.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      {/* Customer Info Section */}
                      <div className="space-y-1 md:border-x border-app-border/40 md:px-6">
                        <div className="text-[8.5px] uppercase tracking-widest font-bold text-slate-500">Receiver Persona</div>
                        <div className="mt-2 text-xs">
                          {isAdmin ? (
                            <Link 
                              to={`/admin/consumers/${order.customer.id}`}
                              className="font-extrabold text-[#F4631E] hover:underline focus:outline-none focus:ring-1 focus:ring-[#F4631E] transition-colors block"
                            >
                              {order.customer.name}
                            </Link>
                          ) : (
                            <span className="font-extrabold text-app-text-secondary block">{order.customer.name}</span>
                          )}
                          <span className="text-[10px] text-slate-500 block mt-0.5">{order.customer.email}</span>
                          <span className="text-[9px] text-[#8E9BAE] block mt-0.5">Phone: {customerPhone}</span>
                        </div>
                      </div>

                      {/* Delivery coverage */}
                      <div className="space-y-1">
                        <div className="text-[8.5px] uppercase tracking-widest font-bold text-slate-500">Logistics Destination</div>
                        <div className="mt-2 text-[11px] text-app-text-secondary line-clamp-2 leading-relaxed">
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
          <div className="absolute inset-0 bg-app-card/20 backdrop-blur-sm" onClick={() => setActioningOrder(null)} />
          
          <div className="bg-app-card border border-app-border rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-black text-app-text-primary capitalize">
                {actionType === 'decline' ? 'Decline Request' : actionType === 'cancel' ? 'Cancel Order' : actionType === 'dispatch' ? 'Fulfill Shipment' : actionType === 'internal' ? 'Merchant Internal Comment' : 'Customer Conversation Note'}
              </h3>
              <p className="text-xs text-[#8E9BAE] mt-1">
                Order Reference: <span className="font-mono text-app-text-primary font-bold">{actioningOrder.id}</span>
              </p>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-5">
              {actionType === 'decline' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Mandatory Reason for Decline</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="E.g. Damaged stock or delivery route not accessible."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-app-text-primary outline-none focus:border-red-500/50"
                  />
                </div>
              )}

              {actionType === 'cancel' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Post-Approval Cancel Reason Note</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Detail the circumstances necessitating cancellation."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-app-text-primary outline-none focus:border-rose-500/50"
                  />
                </div>
              )}

              {actionType === 'dispatch' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Delivery Partner Name</label>
                    <input 
                      required
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="E.g. Pathao, Paperfly, RedX, Sundarban"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-xs text-app-text-primary outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Tracking URL Link</label>
                    <input 
                      type="url"
                      value={inputTextSecondary}
                      onChange={(e) => setInputTextSecondary(e.target.value)}
                      placeholder="E.g. https://track.pathao.com/id"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-xs text-app-text-primary outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {actionType === 'note' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Message Note (Syncs to Chat & Customer Visible)</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Say something to the customer regarding shipment sizing, timelines..."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-app-text-primary outline-none focus:border-[#F4631E]/50"
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
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-app-text-primary outline-none focus:border-amber-500/50"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setActioningOrder(null)}
                  className="px-5 py-3 text-[10px] font-bold uppercase text-app-text-secondary hover:text-white transition-colors"
                >
                  Close
                </button>
                <button 
                  type="submit"
                  className={`px-6 py-3 text-[10px] font-black uppercase text-app-text-primary rounded-xl shadow-lg transition-all${
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

function SubOrderTrackerRow({ subOrder, orderId, updateOrderTrackingStatus, showInlineToast }: {
  subOrder: {
    sellerId: string;
    sellerName: string;
    trackingStatus: string;
  };
  orderId: string;
  updateOrderTrackingStatus: any;
  showInlineToast: any;
  key?: any;
}) {
  const [selectedStatus, setSelectedStatus] = useState(subOrder.trackingStatus);

  const getStyle = (status: string) => {
    switch (status) {
      case 'dispatched': return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
      case 'transit': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      case 'delivered': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'cancelled': return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
      case 'pending':
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 bg-app-bg border border-app-border rounded-xl p-4 flex-wrap">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-app-text-secondary uppercase">Seller: {subOrder.sellerName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-text-primary font-mono">{subOrder.sellerId}</span>
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border${getStyle(subOrder.trackingStatus)}`}>
            {subOrder.trackingStatus}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as any)}
          className="px-3 py-1.5 bg-app-card border border-app-border rounded-xl text-xs text-app-text-primary outline-none focus:border-[#F4631E]"
        >
          {['pending', 'dispatched', 'transit', 'delivered', 'cancelled'].map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
        <button 
          onClick={() => {
            updateOrderTrackingStatus(orderId, subOrder.sellerId, selectedStatus);
            showInlineToast(`✓ Updated ${subOrder.sellerName} tracking to: ${selectedStatus}`);
          }}
          className="px-3.5 py-1.5 bg-[#F4631E] text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-orange-600 transition-all active:scale-95"
        >
          Update
        </button>
      </div>
    </div>
  );
}
