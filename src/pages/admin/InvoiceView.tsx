import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useOrders } from '../../contexts/OrdersContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChoosifyLogo } from '../../components/common/ChoosifyLogo';
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Truck, 
  ExternalLink 
} from 'lucide-react';
import { listingSectionLabels } from '../../../shared/booking/bookingFieldConfig';

interface InvoiceViewProps {
  role?: 'admin' | 'seller';
}

// Supplier dictionary helper
const getSupplierInfo = (sellerId: string, sellerName: string) => {
  const mapping: Record<string, any> = {
    'seller_001': {
      storeName: 'Aarong Traditional Digital Ltd.',
      owner: 'Rahim Uddin',
      license: 'BD Textile Apparel Chamber Sec-12',
      tradeId: 'NBR-VAT-100293-AAR',
      certified: true,
      address: 'Aarong Centre, 346 Tejgaon Industrial Area, Dhaka-1208',
      phone: '+880 2-8878050',
      email: 'rahim@aarong.com'
    },
    'seller_002': {
      storeName: 'TechZone National BD',
      owner: 'Zeeshan Al-Hassan',
      license: 'National Electronics Import Lic #220',
      tradeId: 'NBR-VAT-209384-TECH',
      certified: true,
      address: 'Multiplan Tech Center, Level 4, Dhaka-1205',
      phone: '+880 1711-889900',
      email: 'info@techzone.com.bd'
    }
  };
  return mapping[sellerId] || {
    storeName: sellerName || 'Choosify Authorized Merchant',
    owner: 'Licensed Merchant Partner',
    license: 'Standard Commercial Trade Contract',
    tradeId: `NBR-VAT-CL-${Math.floor(100000 + Math.random() * 900000)}`,
    certified: true,
    address: 'Commercial Hub West A, Dhaka Union, Bangladesh',
    phone: '+880 1800-CHOOSIFY',
    email: 'merchant@choosify.com'
  };
};

export const InvoiceView: React.FC<InvoiceViewProps> = ({ role }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { orders } = useOrders();
  const { profile: loggedInProfile } = useAuth();

  useEffect(() => {
    if (!loggedInProfile) {
      localStorage.setItem('redirect_after_login', window.location.pathname);
      navigate('/login');
    }
  }, [loggedInProfile, navigate]);

  // Resolve role dynamically if unspecified
  const activeRole = role || (loggedInProfile?.role === 'seller' ? 'seller' : 'admin');

  // Search orders array as context fallback
  const contextOrder = orders.find(o => 
    o.id === id || 
    o.invoice_id === id || 
    `INV-${o.id}` === id || 
    `INV-${o.invoice_id}` === id
  );

  const stateOrder = location.state?.order;
  const fallbackOrder = (() => {
    try {
      const stored = sessionStorage.getItem(`choosify_invoice_${id}`);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })();
  const order = stateOrder || fallbackOrder || contextOrder;

  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('print') === 'true' && order) {
      const timer = setTimeout(() => {
        window.print();
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.search, order]);

  if (!loggedInProfile) {
    return (
      <div className="p-8 text-center bg-app-bg text-app-text-secondary min-h-screen flex flex-col items-center justify-center">
        <ShieldCheck className="w-12 h-12 text-[#ef3c23] mb-4 animate-pulse" />
        <h2 className="text-lg font-bold text-app-text-primary mb-2 font-mono uppercase">Authorization Required</h2>
        <p className="text-xs mb-6 max-w-sm">Please log in to your merchant credential profile to authorize viewing of this transaction invoice.</p>
        <button 
          onClick={() => navigate('/login')} 
          className="px-4 py-2 bg-[#ef3c23] hover:bg-orange-600 text-app-text-primary rounded text-xs font-bold uppercase tracking-wider"
        >
          Forward to Login
        </button>
      </div>
    );
  }

  if (!order) return (
    <div className="flex items-center justify-center h-64 text-app-text-secondary text-sm font-bold">
      Invoice data not found. Please navigate here from the Orders page.
    </div>
  );

  const supplier = getSupplierInfo(order.product.sellerId, order.product.sellerName);
  const isService = order.product.productType === 'service';
  const sectionLabels = listingSectionLabels(order.product.productType);
  
  // Subtotal & calculated summaries
  const subtotal = order.product.price;
  const shipping = isService ? 0 : (order.delivery_charge || 120);
  const advancePayment = 0;
  const codPayable = subtotal + shipping - advancePayment;
  const invoiceId = order.invoice_id || `INV-${order.id}`;
  const displayDate = order.timestamp ? new Date(order.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'June 16, 2026';

  const dueDate = order.timestamp ? new Date(new Date(order.timestamp).getTime() + 9 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'June 25, 2026';

  const triggerPrint = () => {
    window.print();
  };

  // Static HTML Downloader matching React structure 1:1
  const downloadHtmlTemplate = () => {
    const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceId} - Choosify Merchandising</title>
  <style>
    @font-face {
      font-family: 'Satoshi';
      src: url('${typeof window !== 'undefined' ? window.location.origin : ''}/fonts/satoshi/Satoshi-Variable.woff2') format('woff2');
      font-weight: 300 900;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Satoshi';
      src: url('${typeof window !== 'undefined' ? window.location.origin : ''}/fonts/satoshi/Satoshi-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Satoshi';
      src: url('${typeof window !== 'undefined' ? window.location.origin : ''}/fonts/satoshi/Satoshi-Medium.woff2') format('woff2');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Satoshi';
      src: url('${typeof window !== 'undefined' ? window.location.origin : ''}/fonts/satoshi/Satoshi-Bold.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Satoshi';
      src: url('${typeof window !== 'undefined' ? window.location.origin : ''}/fonts/satoshi/Satoshi-Black.woff2') format('woff2');
      font-weight: 800 900;
      font-style: normal;
      font-display: swap;
    }
    
    body {
      margin: 0;
      padding: 40px 0;
      font-family: 'Satoshi', 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background-color: #F0F8FF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body, body * {
      font-style: normal !important;
    }

    .invoice-container {
      width: 794px; /* A4 width */
      min-height: 1123px; /* A4 height */
      margin: 0 auto;
      padding: 48px;
      box-sizing: border-box;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #eeeeee;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .logo-container {
      width: 280px;
    }

    .logo-container svg * {
      /* Do not add fill overrides here — handled by SVG internal styles */
    }
    .logo-container svg {
      width: 280px;
      height: auto;
      display: block;
    }

    .logo-container svg path,
    .logo-container svg rect,
    .logo-container svg text,
    .logo-container svg tspan {
      /* intentionally empty — let SVG internal styles control fills */
    }

    /* Override protection */
    .chfy-fill-navy { fill: #18154c !important; }
    .chfy-fill-red  { fill: #ef3c23 !important; }

    .subtitle-brand {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #888888;
      text-transform: uppercase;
      margin-top: 6px;
      margin-bottom: 8px;
    }

    .contact-details {
      font-size: 12px;
      line-height: 1.5;
      color: #888888;
    }

    .header-right {
      text-align: right;
      font-size: 12px;
      line-height: 1.5;
      color: #888888;
    }

    .header-right .addr-line {
      font-weight: 500;
      color: #1a1a1a;
    }

    .divider {
      height: 1px;
      background-color: #eeeeee;
      width: 100%;
      margin: 20px 0;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 20px;
    }

    .info-left {
      width: 50%;
    }

    .info-right {
      width: 50%;
      text-align: right;
    }

    .section-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #888888;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .billed-name {
      font-size: 15px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 4px;
    }

    .billed-text {
      font-size: 13px;
      line-height: 1.5;
      color: #555555;
    }

    .meta-grid {
      display: inline-grid;
      grid-template-columns: auto auto;
      gap: 6px 16px;
      text-align: left;
    }

    .info-right .meta-label {
      font-size: 11px;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      align-self: center;
    }

    .info-right .meta-value {
      font-size: 13px;
      color: #1a1a2e;
      font-weight: 600;
      text-align: right;
    }

    .info-right .meta-value.amount {
      font-size: 32px;
      font-weight: 800;
      color: #EF3C23;
      line-height: 1;
    }

    .supplier-strip {
      background-color: #F8F8F8;
      border: 1px solid #eeeeee;
      border-radius: 8px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .supplier-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .seller-logo-box {
      width: 60px;
      height: 60px;
      min-width: 60px;
      background: #F0F3FA;
      border: 1px solid #dddddd;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #888888;
      font-size: 10px;
      font-weight: 600;
    }

    .seller-details {
      font-size: 13px;
      line-height: 1.5;
      color: #555555;
    }

    .seller-details strong {
      color: #1a1a2e;
      font-size: 14px;
    }

    .supplier-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-end;
    }

    .pill-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .pill-badge.verified {
      background-color: #E8F5E9;
      color: #2E7D32;
      border: 1px solid #C8E6C9;
    }

    .pill-badge.certified {
      background-color: #FFF4ED;
      color: #EF3C23;
      border: 1px solid #FFD3C4;
    }

    .specs-grid {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 20px;
    }

    .specs-left-col {
      width: 60%;
    }

    .specs-right-col {
      width: 40%;
      font-size: 13px;
      line-height: 1.6;
      color: #555555;
    }

    .specs-right-col strong {
      color: #1a1a2e;
    }

    .specs-image-placeholder {
      width: 100%;
      height: 180px;
      background: linear-gradient(135deg, #F0F3FA, #E4E8F0);
      border: 1px solid #dddddd;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .specs-image-placeholder svg {
      width: 40px;
      height: 40px;
      fill: #aaaaaa;
      margin-bottom: 8px;
    }

    .specs-image-placeholder .title-text {
      font-size: 12px;
      font-weight: 600;
      color: #888888;
      margin-bottom: 2px;
    }

    .specs-image-placeholder .sub-text {
      font-size: 10px;
      color: #bbbbbb;
    }

    .table-container {
      margin-bottom: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #888888;
      text-transform: uppercase;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #eeeeee;
    }

    th.right, td.right {
      text-align: right;
    }

    td {
      padding: 16px;
      font-size: 13px;
      color: #1a1a1a;
      border-bottom: 1px solid #eeeeee;
    }

    td .item-title {
      font-weight: 700;
      color: #1a1a2e;
      font-size: 14px;
    }

    td .item-sub {
      font-size: 11px;
      color: #888888;
      margin-top: 4px;
    }

    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }

    .summary-box {
      width: 300px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 6px 0;
      color: #555555;
    }

    .summary-row.total-row {
      border-top: 1px solid #eeeeee;
      margin-top: 8px;
      padding-top: 12px;
      font-weight: 700;
      font-size: 20px;
      color: #EF3C23;
    }

    .pill-badge.cod {
      background-color: #1a1a2e;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      margin-top: 8px;
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .notes-box {
      background-color: #FFF8F7;
      border-left: 3px solid #EF3C23;
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #444444;
      font-style: normal;
    }

    .notes-label {
      font-size: 10px;
      font-weight: 700;
      color: #EF3C23;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-style: normal;
      margin-bottom: 4px;
    }

    .shipping-strip {
      background-color: #F8F8F8;
      border: 1px solid #eeeeee;
      border-radius: 8px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      font-size: 12px;
    }

    .shipping-left .label {
      font-size: 10px;
      font-weight: 700;
      color: #888888;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .shipping-left .value {
      font-weight: 700;
      color: #1a1a2e;
    }

    .shipping-right a {
      color: #EF3C23;
      font-weight: 700;
      text-decoration: underline;
    }

    .footer-section {
      border-top: 2px solid #EF3C23;
      padding-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      position: relative;
    }

    .footer-left {
      max-width: 80%;
    }

    .footer-thanks {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .footer-terms {
      font-size: 10px;
      color: #888888;
      line-height: 1.5;
    }

    .footer-right {
      width: 64px;
      height: 64px;
      opacity: 0.15;
    }

    .footer-watermark-svg {
      width: 100%;
      height: auto;
      fill: #18154c;
    }

    @media print {
      body {
        margin: 0;
        background: #ffffff;
        padding: 0;
      }
      .invoice-container {
        padding: 0;
        width: 100%;
        min-height: auto;
        box-shadow: none;
        border: none;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div>
      <!-- Brand Header -->
      <div class="header-row">
        <div>
          <div class="logo-container">
            <img src="/brand/choosify-logo-horizontal-navy.svg" alt="Choosify" style="width: 280px; height: auto; display: block;" />
          </div>
          <div class="subtitle-brand">Choosify Merchandising</div>
          <div class="contact-details">
            choosify.bd<br>
            support@choosify.bd<br>
            +880 1711-456789
          </div>
        </div>
        <div class="header-right">
          <div style="font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Business Address</div>
          <div class="addr-line">Uttara, Dhaka - 1230, Bangladesh</div>
          <div>Trade License: TR-2026-REG-1099</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Two Column Details Section -->
      <div class="info-row">
        <div class="info-left">
          <div class="section-label">Billed To</div>
          <div class="billed-name">${order.customer.name}</div>
          <div class="billed-text">
            ${order.customer.address || 'House 14, Road 4, Sector 12, Uttara, Dhaka'}<br>
            Phone: ${order.customer.phone || '+880 1711-456789'}<br>
            Email: ${order.customer.email}
          </div>
        </div>
        <div class="info-right">
          <div class="meta-grid">
            <div class="meta-label">Invoice Number</div>
            <div class="meta-value" style="font-weight: 700;">#${invoiceId}</div>

            <div class="meta-label" style="margin-top: 4px;">Invoice Amount</div>
            <div class="meta-value amount">৳ ${codPayable.toLocaleString()}</div>

            <div class="meta-label">Reference</div>
            <div class="meta-value">${invoiceId}</div>

            <div class="meta-label">Invoice Date</div>
            <div class="meta-value">${displayDate}</div>

            <div class="meta-label">Due Date</div>
            <div class="meta-value">${dueDate}</div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Supplier Info Strip -->
      <div class="supplier-strip">
        <div class="supplier-left">
          <!-- Replace with actual seller/store logo URL -->
          <div class="seller-logo-box" id="seller-logo-img">
            Store Logo
          </div>
          <div class="seller-details">
            <div class="section-label" style="margin-bottom: 2px;">Supplier / Merchant Info</div>
            <strong>${supplier.storeName}</strong><br>
            Authorized Owner: ${supplier.owner} | Trade ID: ${supplier.tradeId}<br>
            Vetted Contract: ${supplier.license}
          </div>
        </div>
        <div class="supplier-right">
          <span class="pill-badge verified">✓ System Verified</span>
          <span class="pill-badge certified">Official Supply Hub – Choosify Certified</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Product Visual + Specs Row -->
      <div class="section-label" style="margin-bottom: 12px;">Ordered Product & Visual Specifications</div>
      <div class="specs-grid">
        <div class="specs-left-col">
          <!-- Replace src with actual product image URL from order -->
          <div class="specs-image-placeholder">
            ${order.product.image ? `
              <img id="product-image" src="${order.product.image}" style="width: 100%; height: 100%; object-fit: cover;" alt="${order.product.name}" />
            ` : `
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2c1.1 0 2 .9 2 2v1h2c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2h2V4c0-1.1.9-2 2-2h2zm4 5H8v12h8V7zm-4-3h-2v1h2V4z" />
              </svg>
              <div class="title-text">${order.product.name}</div>
              <div class="sub-text">Product image loads from order data</div>
              <img id="product-image" src="" style="display: none; width: 100%; height: 100%; object-fit: cover; position: absolute; top:0; left:0;" />
            `}
          </div>
        </div>
        <div class="specs-right-col">
          <div class="section-label" style="margin-bottom: 4px; color: #EF3C23;">Product Details</div>
          <div style="font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 6px;">${order.product.name}</div>
          <div><strong>Brand:</strong> ${order.product.brand}</div>
          <div><strong>SKU:</strong> SKU-${order.product.id}</div>
          <div><strong>Variant:</strong> Elite Edition</div>
          <div><strong>Color & Specs:</strong> Crimson Space Gray (Steel Loop)</div>
          <div><strong>Category:</strong> Clothing & Lifestyle</div>
          <div style="margin-top: 8px; font-size: 14px; color: #EF3C23; font-weight: 700;">
            Authorized Qty: 1 Unit
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Item Details Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Item Detail</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="item-title">${order.product.name}</div>
                <div class="item-sub">SKU-${order.product.id} · Elite Edition · Crimson Space Gray</div>
              </td>
              <td class="right">1</td>
              <td class="right">৳ ${subtotal.toLocaleString()}</td>
              <td class="right">৳ ${subtotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payment Summary -->
      <div class="summary-section">
        <div class="summary-box">
          <div class="summary-row">
            <span>Supplier Subtotal:</span>
            <span>৳ ${subtotal.toLocaleString()}</span>
          </div>
          <div class="summary-row">
            <span>Logistics Shipping:</span>
            <span>৳ ${shipping.toLocaleString()}</span>
          </div>
          <div class="summary-row">
            <span>Advance Paid:</span>
            <span>৳ ${advancePayment.toLocaleString()}</span>
          </div>
          <div class="summary-row total-row">
            <span>Total COD Payable:</span>
            <span>৳ ${codPayable.toLocaleString()}</span>
          </div>
          <div style="text-align: right;">
            <span class="pill-badge cod">COD — Cash On Delivery</span>
          </div>
        </div>
      </div>

      <!-- Customer Special Notes Block -->
      <div class="notes-box">
        <div class="notes-label">Special Delivery Notes</div>
        "${order.customerNotes?.[0] || 'Please execute dispatch and coordinate delivery times. Ring the customer upon arrival.'}"
      </div>

      <!-- Shipping Info Strip -->
      <div class="shipping-strip">
        <div class="shipping-left">
          <div class="label">Shipping & Logistics</div>
          <div class="value">Active Courier: ${order.deliveryPartner || "Pathao / SteadFast BD Courier"}</div>
        </div>
        <div class="shipping-right">
          <a href="${order.trackingUrl || 'https://track.pathao.com/sheet/9921'}" target="_blank">Click to track parcel</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-section">
      <div class="footer-left">
        <div class="footer-thanks">Thanks for shopping with Choosify.</div>
        <div class="footer-terms">
          Terms & Conditions: Payment due upon delivery via COD. This is a system-generated invoice — no signature required. Powered by Choosify.bd
        </div>
      </div>
      <div class="footer-right">
        <!-- Brand mark watermark -->
        <img class="footer-watermark-svg" src="/brand/choosify-logo-icon.svg" alt="" style="width: 64px; height: 64px; opacity: 0.15; object-fit: contain;" />
      </div>
    </div>
  </div>
</body>
</html>`;

    // Create file download of the full 1:1 invoice document
    const blob = new Blob([htmlString], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Invoice-${invoiceId}-Choosify.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setNotif({
      message: '✓ Print-ready HTML static invoice successfully exported to downloads! Ready for backend PDF processors.',
      type: 'success'
    });
    setTimeout(() => setNotif(null), 8500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-app-card border-t border-app-border text-app-text-primary min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          #printBtn { display: none !important; }
          body { background: #F0F8FF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .invoice-card { box-shadow: none !important; border: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
          @page { margin: 15mm; size: A4; }
        }
      ` }} />
      
      {/* Toast Notification */}
      {notif && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl text-xs font-bold font-mono border shadow-2xl flex items-center gap-2 max-w-md animate-bounce${
          notif.type === 'success' 
            ? 'bg-emerald-950 text-emerald-400 border-emerald-500/20' 
            : 'bg-indigo-950 text-indigo-400 border-indigo-500/20'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{notif.message}</span>
        </div>
      )}

      {/* breadcrumb */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-app-bg border border-app-border rounded-lg text-app-text-secondary hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-[10px] tracking-[0.2em] text-[#ef3c23] uppercase font-black">Merchandising Operations</div>
            <h1 className="text-xl font-black text-app-text-primary tracking-tight uppercase font-mono mt-0.5">
              Invoice Console
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerPrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-app-bg hover:bg-slate-700 border border-app-border text-app-text-primary rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider cursor-pointer transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
          
          <button
            onClick={downloadHtmlTemplate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#ef3c23] hover:bg-[#ef3c23]/90 text-app-text-primary rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider cursor-pointer shadow-lg shadow-[#ef3c23]/10 transition-all border border-[#ef3c23]/20"
          >
            <Download className="w-3.5 h-3.5" />
            Export Static A4 HTML
          </button>
        </div>
      </div>

      {/* Role Notice */}
      <div className="mb-6 px-4 py-3 bg-[#1a1a2e]/50 border border-indigo-500/10 rounded-xl flex items-center justify-between text-xs text-indigo-300 no-print">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Active Role Access: <strong className="uppercase font-mono text-white text-[11px] bg-indigo-500/20 px-1.5 py-0.5 rounded-md border border-indigo-500/20">{activeRole} View</strong></span>
        </div>
        <div className="text-[10px] text-indigo-400 font-mono">
          {activeRole === 'admin' 
            ? '✓ Elevated administrative controls enabled' 
            : '✓ Verified Merchant limited secure endpoint'}
        </div>
      </div>

      {/* Layout Grid: Left is gorgeous interactive interactive view, Right is context stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Printable/Preview area */}
        <div className="lg:col-span-8 flex flex-col items-center bg-[#F0F3FA] p-4 sm:p-8 rounded-2xl border border-slate-200">
          
          {/* Main Visual Invoice Card (Design mimics static page with real-time responsive styling) */}
          <div className="invoice-card w-full max-w-[794px] min-h-[1123px] bg-white text-slate-900 shadow-2xl p-6 sm:p-12 rounded-lg border border-slate-200 flex flex-col justify-between selection:bg-slate-200">
            
            <div>
              {/* Brand Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-6">
                <div>
                  <div className="logo-container max-w-[280px] mb-2">
                    <ChoosifyLogo variant="full" theme="light" className="h-14 w-auto max-w-[280px]" />
                  </div>
                  <div className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Choosify Merchandising</div>
                  <div className="text-xs text-slate-400 mt-2 leading-relaxed font-medium">
                    choosify.bd<br />
                    support@choosify.bd<br />
                    +880 1711-456789
                  </div>
                </div>
                <div className="sm:text-right font-medium">
                  <div className="text-[11px] font-black tracking-widest text-slate-900 uppercase mb-1">Business Address</div>
                  <div className="text-xs text-slate-800 leading-relaxed">
                    <span className="font-semibold text-slate-900">Uttara, Dhaka - 1230, Bangladesh</span><br />
                    Trade License: TR-2026-REG-1099
                  </div>
                </div>
              </div>

              <div className="h-[1px] bg-slate-100 my-5" />

              {/* Two Column Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-2">Billed To</div>
                  <div className="text-base font-extrabold text-[#1a1a2e]">{order.customer.name}</div>
                  <div className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                    {order.customer.address || 'House 14, Road 4, Sector 12, Uttara, Dhaka'}<br />
                    Phone: {order.customer.phone || '+880 1711-456789'}<br />
                    Email: {order.customer.email}
                  </div>
                </div>
                <div className="flex flex-col md:items-end">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-left md:text-right">
                    <div className="text-slate-400 uppercase tracking-wider font-semibold">Invoice Number</div>
                    <div className="font-extrabold text-[#1a1a2e]">#{invoiceId}</div>

                    <div className="text-slate-400 uppercase tracking-wider font-semibold self-center">Invoice Amount</div>
                    <div className="text-[28px] font-black text-[#EF3C23] leading-none">৳ {codPayable.toLocaleString()}</div>

                    <div className="text-slate-400 uppercase tracking-wider font-semibold">Reference</div>
                    <div className="font-semibold text-slate-800">{invoiceId}</div>

                    <div className="text-slate-400 uppercase tracking-wider font-semibold">Invoice Date</div>
                    <div className="font-semibold text-slate-800">{displayDate}</div>

                    <div className="text-slate-400 uppercase tracking-wider font-semibold">Due Date</div>
                    <div className="font-semibold text-slate-800">{dueDate}</div>
                  </div>
                </div>
              </div>

              <div className="h-[1px] bg-slate-100 my-5" />

              {/* Supplier Info Strip */}
              <div className="bg-[#F8F8F8] border border-slate-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-[60px] h-[60px] min-w-[60px] bg-[#F0F3FA] border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-400">
                    Store Logo
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">Supplier / Merchant Info</div>
                    <div className="font-extrabold text-slate-900 text-sm">{supplier.storeName}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Owner: {supplier.owner} | Trade ID: {supplier.tradeId}<br />
                      Vetted Contract: {supplier.license}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                  <span className="text-[9.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    ✓ System Verified
                  </span>
                  <span className="text-[9.5px] font-black text-[#EF3C23] bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Official Supply Hub
                  </span>
                </div>
              </div>

              <div className="h-[1px] bg-slate-100 my-5" />

              {/* Product Visual + Specs Row */}
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3">
                {isService ? 'Ordered Service & Specifications' : 'Ordered Product & Visual Specifications'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-5">
                <div className="md:col-span-7">
                  <div className="w-full h-[180px] bg-gradient-to-br from-[#F0F3FA] to-[#E4E8F0] border border-slate-200 rounded-lg overflow-hidden flex flex-col items-center justify-center text-center relative shadow-sm">
                    {order.product.image ? (
                      <img src={order.product.image} className="w-full h-full object-cover" alt={order.product.name} />
                    ) : (
                      <div className="p-4 flex flex-col items-center">
                        <Truck className="w-10 h-10 text-slate-400 mb-2" />
                        <div className="text-xs font-semibold text-slate-500">{order.product.name}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {isService ? 'Service image loads from order data' : 'Product image loads from order data'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-5 flex flex-col justify-center">
                  <div className="text-[10px] font-bold text-[#EF3C23] uppercase tracking-wider mb-1">
                    {isService ? sectionLabels.overview : 'Product Details'}
                  </div>
                  <div className="font-extrabold text-slate-900 text-base mb-1.5">{order.product.name}</div>
                  <div className="text-xs text-slate-600 space-y-1 font-medium">
                    <div><strong>Brand:</strong> {order.product.brand}</div>
                    <div><strong>SKU:</strong> SKU-{order.product.id}</div>
                    {isService && order.product.serviceCategory ? (
                      <div><strong>Service category:</strong> {order.product.serviceCategory}</div>
                    ) : (
                      <>
                        <div><strong>Variant:</strong> Elite Edition</div>
                        <div><strong>Color & Specs:</strong> Crimson Space Gray (Steel Loop)</div>
                        <div><strong>Category:</strong> Clothing & Lifestyle</div>
                      </>
                    )}
                    {isService && order.product.serviceDetails
                      ? Object.entries(order.product.serviceDetails).map(([key, value]) => (
                          <div key={key}>
                            <strong>{key.replace(/([A-Z])/g, ' $1')}:</strong> {String(value)}
                          </div>
                        ))
                      : null}
                  </div>
                  <div className="mt-3 text-sm font-black text-[#EF3C23]">
                    {isService ? 'Authorized booking: 1' : 'Authorized Qty: 1 Unit'}
                  </div>
                </div>
              </div>

              <div className="h-[1px] bg-slate-100 my-5" />

              {/* Item Details Table */}
              <div className="mb-6">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-left">Item Detail</th>
                      <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-right">Qty</th>
                      <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-right">Rate</th>
                      <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-4">
                        <div className="font-bold text-[#1a1a2e] text-sm">{order.product.name}</div>
                        <div className="text-[11px] text-slate-400 mt-1">SKU-{order.product.id} · Elite Edition · Crimson Space Gray</div>
                      </td>
                      <td className="py-4 text-right text-slate-700 font-medium">1</td>
                      <td className="py-4 text-right text-slate-700 font-medium">৳ {subtotal.toLocaleString()}</td>
                      <td className="py-4 text-right text-slate-900 font-extrabold">৳ {subtotal.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Summary */}
              <div className="flex justify-end mb-6">
                <div className="w-[300px] text-xs space-y-2 font-medium">
                  <div className="flex justify-between text-slate-500">
                    <span>Supplier Subtotal:</span>
                    <span>৳ {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Logistics Shipping:</span>
                    <span>৳ {shipping.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Advance Paid:</span>
                    <span>৳ {advancePayment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-[#EF3C23] border-t border-slate-100 pt-2.5">
                    <span>Total COD Payable:</span>
                    <span className="text-base font-black">৳ {codPayable.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="inline-block mt-2 text-[10px] font-bold text-white bg-[#1a1a2e] px-2.5 py-0.5 rounded uppercase tracking-wider">
                      COD — Cash On Delivery
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Special Notes Block */}
              <div className="bg-[#FFF8F7] border-l-4 border-[#EF3C23] rounded-r-lg p-4 mb-5 text-xs text-slate-700">
                <div className="text-[10px] font-bold text-[#EF3C23] uppercase tracking-wider mb-1">Special Delivery Notes</div>
                <p>
                  "{order.customerNotes?.[0] || 'Please execute dispatch and coordinate delivery times. Ring the customer upon arrival.'}"
                </p>
              </div>

              {/* Shipping Info Strip */}
              <div className="bg-[#F8F8F8] border border-slate-100 rounded-lg p-4 flex justify-between items-center text-xs mb-6 font-medium">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Shipping & Logistics</div>
                  <div className="font-bold text-slate-800">Active Courier: {order.deliveryPartner || "Pathao / SteadFast BD Courier"}</div>
                </div>
                <div>
                  <a href={order.trackingUrl || 'https://track.pathao.com/sheet/9921'} target="_blank" rel="noopener noreferrer" className="text-[#EF3C23] font-bold underline">
                    Click to track parcel
                  </a>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t-2 border-[#EF3C23] pt-5 flex justify-between items-start">
              <div className="max-w-[80%]">
                <div className="text-lg font-extrabold text-[#1a1a2e] mb-1">Thanks for shopping with Choosify.</div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  Terms & Conditions: Payment due upon delivery via COD. This is a system-generated invoice — no signature required. Powered by Choosify.bd
                </div>
              </div>
              <div className="w-16 h-16 opacity-15">
                <svg className="w-full h-auto fill-[#18154c]" viewBox="0 0 651.43 651.43" xmlns="http://www.w3.org/2000/svg">
                  <path d="M325.71,651.43C146.11,651.43,0,505.31,0,325.71S146.11,0,325.71,0s325.71,146.11,325.71,325.71-146.11,325.71-325.71,325.71ZM325.71,74.42c-138.56,0-251.29,112.73-251.29,251.29s112.73,251.29,251.29,251.29,251.29-112.73,251.29-251.29-112.73-251.29-251.29-251.29Z" />
                </svg>
              </div>
            </div>

          </div>

        </div>

        {/* Informative Side Panel (no-print) */}
        <div className="lg:col-span-4 space-y-6 no-print">
          
          <div className="p-5 bg-app-bg border border-app-border rounded-xl space-y-4">
            <h3 className="text-xs font-extrabold text-app-text-secondary uppercase tracking-widest border-b border-app-border pb-2">
              Invoice Ledger Audit
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status:</span>
                <span className={`px-2 py-0.5 rounded font-bold font-mono uppercase text-[9.5px]${
                  order.status === 'Delivered' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : order.status === 'Cancelled' 
                    ? 'bg-red-500/20 text-red-500' 
                    : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {order.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Payment Lock:</span>
                <span className={`font-mono font-bold${order.paymentStatus === 'Paid' ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {order.paymentStatus === 'Paid' ? 'PAID REVENUE' : 'COD BALANCE DUE'}
                </span>
              </div>

              {activeRole === 'admin' && (
                <>
                  <div className="border-t border-app-border pt-3 flex justify-between">
                    <span className="text-slate-500">Commission Rate:</span>
                    <span className="font-mono text-indigo-400">{order.earnings?.commissionPercent || 10}%</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-500">Admin Cut:</span>
                    <span className="font-mono text-indigo-400">৳ {(order.earnings?.futureAutomatedDeduction || Math.round(order.product.price * 0.1)).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Seller Net Earnings:</span>
                    <span className="font-semibold font-mono text-emerald-400">৳ {(order.earnings?.sellerNet || Math.round(order.product.price * 0.9)).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="p-5 bg-[#1a1a2e]/20 border border-indigo-500/10 rounded-xl">
            <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-wider mb-2">Print & Export Instructions</h4>
            <ul className="text-[11px] text-app-text-secondary list-disc list-inside space-y-1.5 leading-relaxed">
              <li>Click <strong className="text-app-text-primary">Print / Save PDF</strong> to execute system-level printer driver integrations.</li>
              <li>Toggle "Background Graphics" on in the print screen for full exact styling.</li>
              <li>Choose "Save as PDF" to generate a high fidelity digital copy.</li>
              <li>Click <strong className="text-app-text-primary">Export Static HTML</strong> to get a portable single-file offline format.</li>
            </ul>
          </div>

          <div className="p-5 bg-app-bg border border-app-border rounded-xl text-center">
            <div className="text-[9.5px] font-mono text-slate-500 tracking-wider">SECURE PLATFORM SYSTEM ID</div>
            <div className="text-[11px] font-bold font-mono text-app-text-secondary break-all mt-1">{order.id}-{order.product.sellerId}</div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default InvoiceView;
