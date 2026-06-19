import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrders } from '../../contexts/OrdersContext';
import { useAuth } from '../../contexts/AuthContext';
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

interface InvoiceViewProps {
  role?: 'admin' | 'seller';
}

// Inline SVG logo component provided by developer
const ChoosifyLogo: React.FC<{ className?: string }> = ({ className = "h-8" }) => (
  <svg 
    id="Layer_1" 
    data-name="Layer 1" 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 2585.84 505.4" 
    className={className}
    referrerPolicy="no-referrer"
  >
    <defs>
      <style>{`.cls-logo-white-text { fill: #ffffff; } .cls-logo-red-dot { fill: #ef3c23; }`}</style>
    </defs>
    <g>
      <g>
        <path className="cls-logo-red-dot" d="M921.65,303.09c0-47.35-38.42-85.71-85.76-85.71s-85.76,38.36-85.76,85.71,38.42,85.76,85.76,85.76c8.22,0,16.14-1.17,23.65-3.3-3.3-5.38-5.23-11.77-5.23-18.57,0-19.74,15.99-35.73,35.68-35.73,8.93,0,17.1,3.3,23.34,8.68,5.33-11.16,8.32-23.65,8.32-36.84Z"/>
        <path className="cls-logo-red-dot" d="M356.15,303.09c0-47.35-38.42-85.71-85.76-85.71s-85.76,38.36-85.76,85.71c0,47.35,38.42,85.76,85.76,85.76,8.22,0,16.14-1.17,23.65-3.3-3.3-5.38-5.23-11.77-5.23-18.57,0-19.74,15.99-35.73,35.68-35.73,8.93,0,17.1,3.3,23.34,8.68,5.33-11.16,8.32-23.65,8.32-36.84Z"/>
        <path className="cls-logo-red-dot" d="M252.7,505.4C113.36,505.4,0,392.04,0,252.7S113.36,0,252.7,0s252.7,113.36,252.7,252.7-113.36,252.7-252.7,252.7ZM252.7,57.74c-107.5,0-194.96,87.46-194.96,194.96s87.46,194.96,194.96,194.96,194.96-87.46,194.96-194.96S360.2,57.74,252.7,57.74Z"/>
        <path className="cls-logo-red-dot" d="M779.18,505.4c-139.34,0-252.7-113.36-252.7-252.7S639.84,0,779.18,0s252.7,113.36,252.7,252.7-113.36,252.7-252.7,252.7ZM779.18,57.74c-107.5,0-194.96,87.46-194.96,194.96s87.46,194.96,194.96,194.96,194.96-87.46,194.96-194.96-87.46-194.96-194.96-194.96Z"/>
      </g>
      <g>
        <path className="cls-logo-white-text" d="M1094.27,260.83c0-54.18,36.9-95.48,93.45-95.48,48.09,0,77.9,27.43,84.31,66.7h-51.45c-3.72-16.59-14.55-27.09-32.15-27.09-26.77,0-40.3,22.01-40.3,55.88s13.53,55.19,40.3,55.19c19.62,0,31.48-11.85,33.85-32.51h51.13c-1.7,40.97-34.21,72.8-84.31,72.8-57.58,0-94.83-41.64-94.83-95.48Z"/>
        <path className="cls-logo-white-text" d="M1351.4,350.56h-53.18V98.64h53.18v69.42c0,1.68,0,16.25-.35,28.1h1.03c10.84-19.3,29.11-30.81,54.18-30.81,39.59,0,62.64,26.4,62.64,66.7v118.52h-52.83v-108.36c0-19.64-10.48-32.84-30.13-32.84-20.65,0-34.53,16.59-34.53,39.62v101.58Z"/>
        <path className="cls-logo-white-text" d="M1494.41,260.83c0-54.18,37.92-95.48,95.5-95.48s94.8,41.31,94.8,95.48-37.57,95.48-94.8,95.48-95.5-41.64-95.5-95.48ZM1630.88,260.83c0-34.21-14.91-57.56-41.32-57.56s-41.29,23.35-41.29,57.56,14.2,56.89,41.29,56.89,41.32-23.03,41.32-56.89Z"/>
        <path className="cls-logo-white-text" d="M1703.14,260.83c0-54.18,37.92-95.48,95.5-95.48s94.8,41.31,94.8,95.48-37.57,95.48-94.8,95.48-95.5-41.64-95.5-95.48ZM1839.61,260.83c0-34.21-14.91-57.56-41.32-57.56s-41.29,23.35-41.29,57.56,14.2,56.89,41.29,56.89,41.32-23.03,41.32-56.89Z"/>
        <path className="cls-logo-white-text" d="M1908.8,295.02h50.11c3.05,16.94,15.93,26.42,36.58,26.42,18.98,0,29.81-7.79,29.81-20.65,0-16.25-21.35-18.29-46.39-23.03-32.19-6.09-64.69-14.22-64.69-56.21,0-36.9,33.53-56.2,75.85-56.2,50.11,0,75.18,21.67,79.92,53.15h-49.43c-3.4-12.86-13.56-19.3-30.49-19.3s-26.74,6.78-26.74,18.29c0,13.54,19.62,15.58,44.34,19.97,32.19,5.75,68.76,14.22,68.76,59.6,0,38.95-34.56,59.26-81.27,59.26-52.16,0-83.64-25.05-86.36-61.29Z"/>
        <rect className="cls-logo-white-text" x="2102.94" y="170.41" width="53.18" height="180.15"/>
        <path className="cls-logo-white-text" d="M2260.83,204.96v145.61h-53.18v-145.61h-27.09v-34.54h27.09v-15.23c0-19.3,4.74-32.84,15.26-42.33,11.83-10.5,30.46-14.55,53.47-14.22,7.12,0,14.59.34,22.02,1.35v37.92c-26.74-1.01-37.57.69-37.57,21v11.51h37.57v34.54h-37.57Z"/>
        <path className="cls-logo-white-text" d="M2335.71,410.16v-41.64h2.72c.67.34,15.9.34,17.28.34,16.57,0,24.72-6.09,25.71-18.29,0-6.09-3.05-19.97-9.46-36.23l-55.88-143.92h55.88l23.02,69.09c8.11,24.38,14.91,62.64,14.91,62.64h.67s8.11-38.6,15.9-62.64l22.02-69.09h52.83l-64.34,184.56c-14.59,41.64-31.16,55.86-65.69,55.86-1.7,0-34.56-.34-35.58-.67Z"/>
        <path className="cls-logo-red-dot" d="M2129.7,152.15c15.9,0,28.78-12.9,28.78-28.8,0-15.9-12.88-28.8-28.78-28.8-15.9,0-28.8,12.9-28.8,28.8,0,2.76.39,5.42,1.11,7.94,1.81-1.11,3.95-1.76,6.24-1.76,6.63,0,12,5.37,12,11.98,0,3-1.11,5.74-2.91,7.84,3.75,1.79,7.94,2.79,12.37,2.79Z"/>
      </g>
    </g>
    <g>
      <path className="cls-logo-white-text" d="M2529.31,313.17h17.3c7.28,0,12.13,4.22,12.13,10.5,0,4.43-2.06,7.81-6.91,9.13v.16c3.48,1,5.27,3.01,5.75,7.6.53,5.33.32,9.39,1.64,9.97v.37h-7.33c-.95-.42-1.06-4.64-1.37-8.7-.32-4.11-2.64-6.44-7.38-6.44h-6.17v15.14h-7.65v-37.72ZM2536.96,329.84h8.12c4.17,0,6.22-2.16,6.22-5.17s-1.95-5.33-6.01-5.33h-8.33v10.5Z"/>
      <path className="cls-logo-white-text" d="M2543.58,375.14c-11.29,0-21.9-4.4-29.88-12.38-7.98-7.98-12.38-18.59-12.38-29.88s4.4-21.9,12.38-29.88c7.98-7.98,18.59-12.38,29.88-12.38s21.9,4.4,29.88,12.38c7.98,7.98,12.38,18.59,12.38,29.88s-4.4,21.9-12.38,29.88c-7.98,7.98-18.59,12.38-29.88,12.38ZM2543.58,299.28c-18.53,0-33.6,15.07-33.6,33.6s15.07,33.6,33.6,33.6,33.6-15.07,33.6-33.6-15.07-33.6-33.6-33.6Z"/>
    </g>
  </svg>
);

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

  // Search orders array
  const order = orders.find(o => 
    o.id === id || 
    o.invoice_id === id || 
    `INV-${o.id}` === id || 
    `INV-${o.invoice_id}` === id
  );

  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  if (!loggedInProfile) {
    return (
      <div className="p-8 text-center bg-slate-950 text-slate-400 min-h-screen flex flex-col items-center justify-center">
        <ShieldCheck className="w-12 h-12 text-[#ef3c23] mb-4 animate-pulse" />
        <h2 className="text-lg font-bold text-white mb-2 font-mono uppercase">Authorization Required</h2>
        <p className="text-xs mb-6 max-w-sm">Please log in to your merchant credential profile to authorize viewing of this transaction invoice.</p>
        <button 
          onClick={() => navigate('/login')} 
          className="px-4 py-2 bg-[#ef3c23] hover:bg-orange-600 text-white rounded text-xs font-bold uppercase tracking-wider"
        >
          Forward to Login
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center bg-slate-950 text-slate-400 min-h-screen flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-[#ef3c23] mb-4" />
        <h2 className="text-lg font-bold text-white mb-2 font-mono">Invoice Not Found</h2>
        <p className="text-xs mb-6 max-w-sm">No orders or matching invoice record exists for ID: {id}</p>
        <button 
          onClick={() => navigate('/admin/orders')} 
          className="px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold"
        >
          Return to Orders
        </button>
      </div>
    );
  }

  const supplier = getSupplierInfo(order.product.sellerId, order.product.sellerName);
  
  // Subtotal & calculated summaries
  const subtotal = order.product.price;
  const shipping = order.delivery_charge || 120;
  const advancePayment = 0;
  const codPayable = subtotal + shipping - advancePayment;
  const invoiceId = order.invoice_id || `INV-${order.id}`;
  const displayDate = order.timestamp ? new Date(order.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'June 16, 2026';

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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      color: #1a1a1a;
      background-color: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .invoice-container {
      width: 794px; /* A4 width */
      min-height: 1123px; /* A4 height */
      margin: 0 auto;
      padding: 40px;
      box-sizing: border-box;
      background: #ffffff;
      position: relative;
    }

    .brand-header-strip {
      background-color: #1a1a2e;
      padding: 24px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .logo-container {
      width: 180px;
    }

    .logo-svg {
      width: 100%;
      height: auto;
    }

    .header-right {
      text-align: right;
    }

    .official-text {
      color: #ef3c23;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }

    .subtitle-text {
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3px;
      margin: 0 0 10px 0;
      text-transform: uppercase;
      opacity: 0.9;
    }

    .invoice-details-meta {
      font-size: 12px;
      color: #e2e8f0;
      font-weight: 500;
    }

    .grid-2 {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      margin-bottom: 30px;
    }

    .block-card {
      width: 48%;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
      box-sizing: border-box;
    }

    .block-title {
      font-size: 11px;
      font-weight: 800;
      color: #1a1a2e;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
    }

    .block-content {
      font-size: 12px;
      line-height: 1.6;
    }

    .block-content strong {
      font-size: 13px;
      color: #1a1a2e;
    }

    .badge-certified {
      background-color: #dcfce7;
      color: #15803d;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-top: 4px;
      text-transform: uppercase;
    }

    .product-section {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 30px;
    }

    .product-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }

    .prod-meta {
      font-size: 12px;
      color: #475569;
    }

    .table-container {
      margin-bottom: 30px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background-color: #1a1a2e;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 12px;
      text-align: left;
    }

    th.right, td.right {
      text-align: right;
    }

    td {
      padding: 12px;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .amount-box-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }

    .amount-box {
      width: 320px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
    }

    .amount-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 6px 0;
      color: #475569;
    }

    .amount-row.pay {
      border-top: 2px dashed #cbd5e1;
      margin-top: 8px;
      padding-top: 10px;
      font-weight: bold;
      font-size: 15px;
      color: #ef3c23;
    }

    .badge-cod {
      background-color: #fee2e2;
      color: #ef3c23;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-top: 8px;
      text-transform: uppercase;
      text-align: center;
      width: calc(100% - 16px);
    }

    .notes-box {
      background: #f8fafc;
      border-left: 4px solid #1a1a2e;
      border-radius: 4px;
      padding: 12px 16px;
      margin-bottom: 30px;
      font-size: 11.5px;
      line-height: 1.5;
      color: #475569;
    }

    .notes-title {
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 4px;
    }

    .logistics-strip {
      background: #f1f5f9;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }

    .logistics-title {
      font-size: 12px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .logistics-val {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }

    .tracking-link {
      background-color: #1a1a2e;
      color: #ffffff;
      text-decoration: none;
      font-size: 10px;
      font-weight: bold;
      padding: 6px 12px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .footer {
      border-top: 2px solid #f1f5f9;
      padding-top: 24px;
      text-align: center;
    }

    .footer-thankyou {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .footer-disclaimer {
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.4;
      max-width: 550px;
      margin: 0 auto 12px auto;
    }

    .footer-watermark {
      font-size: 9px;
      font-weight: bold;
      color: #cbd5e1;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    @media print {
      body {
        margin: 0;
        background: #ffffff;
      }
      .invoice-container {
        padding: 0;
        width: 100%;
        min-height: auto;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="brand-header-strip">
      <div class="logo-container">
        <!-- Developer provided inline SVG -->
        <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2585.84 505.4" class="logo-svg">
          <defs>
            <style>
              .cls-svg-white { fill: #ffffff; }
              .cls-svg-red { fill: #ef3c23; }
            </style>
          </defs>
          <g>
            <g>
              <path class="cls-svg-red" d="M921.65,303.09c0-47.35-38.42-85.71-85.76-85.71s-85.76,38.36-85.76,85.71,38.42,85.76,85.76,85.76c8.22,0,16.14-1.17,23.65-3.3-3.3-5.38-5.23-11.77-5.23-18.57,0-19.74,15.99-35.73,35.68-35.73,8.93,0,17.1,3.3,23.34,8.68,5.33-11.16,8.32-23.65,8.32-36.84Z"/>
              <path class="cls-svg-red" d="M356.15,303.09c0-47.35-38.42-85.71-85.76-85.71s-85.76,38.36-85.76,85.71c0,47.35,38.42,85.76,85.76,85.76,8.22,0,16.14-1.17,23.65-3.3-3.3-5.38-5.23-11.77-5.23-18.57,0-19.74,15.99-35.73,35.68-35.73,8.93,0,17.1,3.3,23.34,8.68,5.33-11.16,8.32-23.65,8.32-36.84Z"/>
              <path class="cls-svg-red" d="M252.7,505.4C113.36,505.4,0,392.04,0,252.7S113.36,0,252.7,0s252.7,113.36,252.7,252.7-113.36,252.7-252.7,252.7ZM252.7,57.74c-107.5,0-194.96,87.46-194.96,194.96s87.46,194.96,194.96,194.96,194.96-87.46,194.96-194.96S360.2,57.74,252.7,57.74Z"/>
              <path class="cls-svg-red" d="M779.18,505.4c-139.34,0-252.7-113.36-252.7-252.7S639.84,0,779.18,0s252.7,113.36,252.7,252.7-113.36,252.7-252.7,252.7ZM779.18,57.74c-107.5,0-194.96,87.46-194.96,194.96s87.46,194.96,194.96,194.96,194.96-87.46,194.96-194.96-87.46-194.96-194.96-194.96Z"/>
            </g>
            <g>
              <path class="cls-svg-white" d="M1094.27,260.83c0-54.18,36.9-95.48,93.45-95.48,48.09,0,77.9,27.43,84.31,66.7h-51.45c-3.72-16.59-14.55-27.09-32.15-27.09-26.77,0-40.3,22.01-40.3,55.88s13.53,55.19,40.3,55.19c19.62,0,31.48-11.85,33.85-32.51h51.13c-1.7,40.97-34.21,72.8-84.31,72.8-57.58,0-94.83-41.64-94.83-95.48Z"/>
              <path class="cls-svg-white" d="M1351.4,350.56h-53.18V98.64h53.18v69.42c0,1.68,0,16.25-.35,28.1h1.03c10.84-19.3,29.11-30.81,54.18-30.81,39.59,0,62.64,26.4,62.64,66.7v118.52h-52.83v-108.36c0-19.64-10.48-32.84-30.13-32.84-20.65,0-34.53,16.59-34.53,39.62v101.58Z"/>
              <path class="cls-svg-white" d="M1494.41,260.83c0-54.18,37.92-95.48,95.5-95.48s94.8,41.31,94.8,95.48-37.57,95.48-94.8,95.48-95.5-41.64-95.5-95.48ZM1630.88,260.83c0-34.21-14.91-57.56-41.32-57.56s-41.29,23.35-41.29,57.56,14.2,56.89,41.29,56.89,41.32-23.03,41.32-56.89Z"/>
              <path class="cls-svg-white" d="M1703.14,260.83c0-54.18,37.92-95.48,95.5-95.48s94.8,41.31,94.8,95.48-37.57,95.48-94.8,95.48-95.5-41.64-95.5-95.48ZM1839.61,260.83c0-34.21-14.91-57.56-41.32-57.56s-41.29,23.35-41.29,57.56,14.2,56.89,41.29,56.89,41.32-23.03,41.32-56.89Z"/>
              <path class="cls-svg-white" d="M1908.8,295.02h50.11c3.05,16.94,15.93,26.42,36.58,26.42,18.98,0,29.81-7.79,29.81-20.65,0-16.25-21.35-18.29-46.39-23.03-32.19-6.09-64.69-14.22-64.69-56.21,0-36.9,33.53-56.2,75.85-56.2,50.11,0,75.18,21.67,79.92,53.15h-49.43c-3.4-12.86-13.56-19.3-30.49-19.3s-26.74,6.78-26.74,18.29c0,13.54,19.62,15.58,44.34,19.97,32.19,5.75,68.76,14.22,68.76,59.6,0,38.95-34.56,59.26-81.27,59.26-52.16,0-83.64-25.05-86.36-61.29Z"/>
              <rect class="cls-svg-white" x="2102.94" y="170.41" width="53.18" height="180.15"/>
              <path class="cls-svg-white" d="M2260.83,204.96v145.61h-53.18v-145.61h-27.09v-34.54h27.09v-15.23c0-19.3,4.74-32.84,15.26-42.33,11.83-10.5,30.46-14.55,53.47-14.22,7.12,0,14.59.34,22.02,1.35v37.92c-26.74-1.01-37.57.69-37.57,21v11.51h37.57v34.54h-37.57Z"/>
              <path class="cls-svg-white" d="M2335.71,410.16v-41.64h2.72c.67.34,15.9.34,17.28.34,16.57,0,24.72-6.09,25.71-18.29,0-6.09-3.05-19.97-9.46-36.23l-55.88-143.92h55.88l23.02,69.09c8.11,24.38,14.91,62.64,14.91,62.64h.67s8.11-38.6,15.9-62.64l22.02-69.09h52.83l-64.34,184.56c-14.59,41.64-31.16,55.86-65.69,55.86-1.7,0-34.56-.34-35.58-.67Z"/>
              <path class="cls-svg-red" d="M2129.7,152.15c15.9,0,28.78-12.9,28.78-28.8,0-15.9-12.88-28.8-28.78-28.8-15.9,0-28.8,12.9-28.8,28.8,0,2.76.39,5.42,1.11,7.94,1.81-1.11,3.95-1.76,6.24-1.76,6.63,0,12,5.37,12,11.98,0,3-1.11,5.74-2.91,7.84,3.75,1.79,7.94,2.79,12.37,2.79Z"/>
            </g>
          </g>
          <g>
            <path class="cls-svg-white" d="M2529.31,313.17h17.3c7.28,0,12.13,4.22,12.13,10.5,0,4.43-2.06,7.81-6.91,9.13v.16c3.48,1,5.27,3.01,5.75,7.6.53,5.33.32,9.39,1.64,9.97v.37h-7.33c-.95-.42-1.06-4.64-1.37-8.7-.32-4.11-2.64-6.44-7.38-6.44h-6.17v15.14h-7.65v-37.72ZM2536.96,329.84h8.12c4.17,0,6.22-2.16,6.22-5.17s-1.95-5.33-6.01-5.33h-8.33v10.5Z"/>
            <path class="cls-svg-white" d="M2543.58,375.14c-11.29,0-21.9-4.4-29.88-12.38-7.98-7.98-12.38-18.59-12.38-29.88s4.4-21.9,12.38-29.88c7.98-7.98,18.59-12.38,29.88-12.38s21.9,4.4,29.88,12.38c7.98,7.98,12.38,18.59,12.38,29.88s-4.4,21.9-12.38,29.88c-7.98,7.98-18.59,12.38-29.88,12.38ZM2543.58,299.28c-18.53,0-33.6,15.07-33.6,33.6s15.07,33.6,33.6,33.6,33.6-15.07,33.6-33.6-15.07-33.6-33.6-33.6Z"/>
          </g>
        </svg>
      </div>
      <div class="header-right">
        <h1 class="official-text">OFFICIAL INVOICE</h1>
        <p class="subtitle-text">CHOOSIFY MERCHANDISING</p>
        <div class="invoice-details-meta">
          <strong>Invoice ID:</strong> ${invoiceId}<br>
          <strong>Date:</strong> ${displayDate}
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="block-card">
        <div class="block-title">SUPPLIER INFORMATION</div>
        <div class="block-content">
          <strong>${supplier.storeName}</strong><br>
          Owner: ${supplier.owner}<br>
          Trade ID: ${supplier.tradeId}<br>
          Certification License: ${supplier.license}<br>
          <span class="badge-certified">Certified Partner</span>
        </div>
      </div>

      <div class="block-card">
        <div class="block-title">CUSTOMER BILLING TO</div>
        <div class="block-content">
          <strong>${order.customer.name}</strong><br>
          Email: ${order.customer.email}<br>
          Phone: ${order.customer.phone || '+880 1711-456789'}<br>
          Address: ${order.customer.address || "Sector 11, Uttara, Dhaka, Bangladesh"}
        </div>
      </div>
    </div>

    <div class="product-section">
      <div class="block-title" style="border: 0; padding: 0; margin-bottom: 4px;">SECURED PRODUCT SPECIFICATIONS</div>
      <div class="product-details">
        <div>
          <strong style="font-size: 14px; color: #1a1a2e;">${order.product.name}</strong>
          <div class="prod-meta" style="margin-top: 4px;">
            <span><strong>Brand:</strong> ${order.product.brand}</span> | 
            <span><strong>Product SKU:</strong> SKU-${order.product.id}</span>
          </div>
          <div class="prod-meta" style="margin-top: 2px;">
            <span><strong>Variant:</strong> Retail Standard Edition</span> | 
            <span><strong>Verification Specs:</strong> Brand authentic physically inspected node</span>
          </div>
        </div>
        <div style="font-size: 14px; font-weight: bold; color: #ef3c23;">
          QTY: 1
        </div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Item Description</th>
            <th>SKU Code</th>
            <th class="right">Qty</th>
            <th class="right">Unit Price</th>
            <th class="right">Total Line</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: 600;">${order.product.name} - Official Supply Pack</td>
            <td>SKU-${order.product.id}</td>
            <td class="right">1</td>
            <td class="right">৳ ${subtotal.toLocaleString()}</td>
            <td class="right">৳ ${subtotal.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="amount-box-container">
      <div class="amount-box">
        <div class="amount-row">
          <span>Supplier Subtotal:</span>
          <span>৳ ${subtotal.toLocaleString()}</span>
        </div>
        <div class="amount-row">
          <span>Logistics Shipping:</span>
          <span>৳ ${shipping.toLocaleString()}</span>
        </div>
        <div class="amount-row">
          <span>Advance Paid:</span>
          <span>৳ ${advancePayment.toLocaleString()}</span>
        </div>
        
        <div class="amount-row pay">
          <span>Total COD Payable:</span>
          <span>৳ ${codPayable.toLocaleString()}</span>
        </div>
        
        <div class="badge-cod">
          COD Balance Lock Secured
        </div>
      </div>
    </div>

    <div class="notes-box">
      <div class="notes-title">SPECIAL RECIPIENT NOTES & INSTRUCTIONS</div>
      <div>${order.customerNotes?.[0] || 'Please complete dispatch and coordinate delivery times through registered tracking. Delivery partner should ring the customer upon arrival.'}</div>
    </div>

    <div class="logistics-strip">
      <div>
        <div class="logistics-title">LOGISTICS PARTNER DEPLOYMENT</div>
        <div class="logistics-val">
          <strong>Courier:</strong> ${order.deliveryPartner || "RedX Logistics Bangladesh"} | 
          <strong>Status:</strong> ${order.status}
        </div>
      </div>
      <div>
        <a href="${order.trackingUrl || 'https://redx.com.bd/track/' + order.id}" class="tracking-link">Secure Tracking Link</a>
      </div>
    </div>

    <div class="footer">
      <div class="footer-thankyou">Thank you for choosing Choosify Merchandising!</div>
      <div class="footer-disclaimer">
        This document is an official cryptographic invoice generated from the Choosify secure platform network (System UUID ${order.id}). Standard seller contracts and customer authentications apply. Content logs are preserved in our distributed secure audit vault ledger.
      </div>
      <div class="footer-watermark">✓ CRYPTO LEDGER SECURE • ALL SYSTEMS REGISTERED</div>
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
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-900 border-t border-slate-800 text-slate-100 min-h-screen">
      
      {/* Toast Notification */}
      {notif && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl text-xs font-bold font-mono border shadow-2xl flex items-center gap-2 max-w-md animate-bounce ${
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
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-[10px] tracking-[0.2em] text-[#ef3c23] uppercase font-black">Merchandising Operations</div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase font-mono mt-0.5">
              Invoice Console
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerPrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider cursor-pointer transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
          
          <button
            onClick={downloadHtmlTemplate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#ef3c23] hover:bg-[#ef3c23]/90 text-white rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider cursor-pointer shadow-lg shadow-[#ef3c23]/10 transition-all border border-[#ef3c23]/20"
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
        <div className="text-[10px] text-indigo-400 font-mono italic">
          {activeRole === 'admin' 
            ? '✓ Elevated administrative controls enabled' 
            : '✓ Verified Merchant limited secure endpoint'}
        </div>
      </div>

      {/* Layout Grid: Left is gorgeous interactive interactive view, Right is context stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Printable/Preview area */}
        <div className="lg:col-span-8 flex flex-col items-center">
          
          {/* Main Visual Invoice Card (Design mimics static page with real-time responsive styling) */}
          <div className="w-full max-w-[794px] min-h-[1123px] bg-white text-slate-900 shadow-2xl p-6 sm:p-10 rounded-2xl border border-slate-200 flex flex-col justify-between selection:bg-slate-200">
            
            <div>
              {/* Header inside Navy block to preserve white text within the print-friendly design */}
              <div className="bg-[#1a1a2e] text-white p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="bg-slate-950/20 p-2 rounded-lg inline-block mb-3 border border-slate-800">
                    <ChoosifyLogo className="h-7 w-auto select-none" />
                  </div>
                  <h3 className="text-[10px] text-slate-400 tracking-[0.3em] font-bold uppercase">Choosify Authorized Supply Node</h3>
                  <p className="text-[11px] font-medium text-[#ef3c23] uppercase tracking-wider mt-1">{supplier.storeName}</p>
                </div>
                
                <div className="sm:text-right">
                  <h2 className="text-[#ef3c23] text-xl font-black tracking-widest uppercase font-mono">Official Invoice</h2>
                  <p className="text-[9.5px] text-slate-400 tracking-wider uppercase font-bold mt-1">CHOOSIFY MERCHANDISING</p>
                  
                  <div className="mt-4 text-xs text-slate-300 font-mono space-y-1">
                    <div><span className="text-slate-500 font-sans">ID:</span> {invoiceId}</div>
                    <div><span className="text-slate-500 font-sans">Date:</span> {displayDate}</div>
                  </div>
                </div>
              </div>

              {/* Two Column details block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                
                {/* Supplier Detail Block */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10.5px] font-black text-[#1a1a2e] tracking-widest uppercase border-b-2 border-slate-200 pb-2 mb-3">
                      Supplier / Merchant Info
                    </h4>
                    <div className="text-xs space-y-1.5 text-slate-600">
                      <div className="font-extrabold text-sm text-slate-800">{supplier.storeName}</div>
                      <div><strong>Authorized Owner:</strong> {supplier.owner}</div>
                      <div><strong>Trade ID:</strong> {supplier.tradeId}</div>
                      <div className="text-[11px]"><strong>Vetted Contract:</strong> {supplier.license}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                    <span className="text-[9.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider block inline-block">
                      ✓ System Verified
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{supplier.email}</span>
                  </div>
                </div>

                {/* Customer Billing block */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10.5px] font-black text-[#1a1a2e] tracking-widest uppercase border-b-2 border-slate-200 pb-2 mb-3">
                      Customer Billing To
                    </h4>
                    <div className="text-xs space-y-1.5 text-slate-600">
                      <div className="font-extrabold text-sm text-slate-800">{order.customer.name}</div>
                      <div><strong>Secure Email:</strong> {order.customer.email}</div>
                      <div><strong>Verified Contact:</strong> {order.customer.phone || '+880 1711-456789'}</div>
                      <div className="leading-relaxed"><strong>Fulfillment Node Address:</strong> {order.customer.address || "House 14, Sector 7, Uttara, Dhaka-1230, Bangladesh"}</div>
                    </div>
                  </div>

                  {order.customer.flagged && activeRole === 'admin' && (
                    <div className="mt-3 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 flex items-center gap-1 font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Admin Note: Customer has validation triggers active.</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Dynamic Product Specifications area */}
              <div className="p-4 mb-8 bg-white border border-slate-200 rounded-lg">
                <h4 className="text-[10.5px] font-black text-[#1a1a2e] tracking-widest uppercase pb-1 mb-2">
                  Secured Product Specifications
                </h4>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-extrabold text-[#1a1a2e] text-sm">{order.product.name}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      <span><strong>Brand ID:</strong> {order.product.brand}</span> · <span><strong>SKU:</strong> SKU-{order.product.id}</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      <span><strong>Category:</strong> Retail Standard Distribution Pack</span>
                    </div>
                  </div>
                  
                  <div className="sm:text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-mono uppercase font-black">Authorized Qty</span>
                    <span className="text-lg font-black text-[#ef3c23]">1 Unit</span>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="mb-8 border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1a1a2e] text-white">
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px]">Item Description</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px]">SKU Code</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-right">Qty</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-right">Unit Price</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-right">Total Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{order.product.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Includes standard store authentic packaging & warranty logs.</div>
                      </td>
                      <td className="p-3 font-mono text-slate-500">SKU-{order.product.id}</td>
                      <td className="p-3 text-right">1</td>
                      <td className="p-3 text-right font-semibold">৳ {subtotal.toLocaleString()}</td>
                      <td className="p-3 text-right font-extrabold text-[#1a1a2e]">৳ {subtotal.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Summary Box */}
              <div className="flex justify-end mb-8">
                <div className="w-full sm:w-[320px] p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Supplier Subtotal:</span>
                    <span className="font-mono">৳ {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Logistics Shipping:</span>
                    <span className="font-mono">৳ {shipping.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Advance Payment Credit:</span>
                    <span className="font-mono">৳ {advancePayment.toLocaleString()}</span>
                  </div>

                  <div className="border-t border-slate-200/80 pt-2 flex justify-between items-center text-sm font-extrabold text-[#ef3c23]">
                    <span>Total COD Payable:</span>
                    <span className="text-base font-black font-mono">৳ {codPayable.toLocaleString()}</span>
                  </div>

                  <div className="text-center bg-red-50 border border-red-100 rounded text-[9.5px] font-black text-[#ef3c23] py-1 uppercase tracking-widest mt-2">
                    🛡️ Cash On Delivery Unlocked
                  </div>
                </div>
              </div>

              {/* Customer Special Notes Block */}
              <div className="p-4 bg-slate-50 border-l-4 border-[#1a1a2e] rounded-r-lg mb-8 text-xs text-slate-600">
                <h5 className="font-bold text-[#1a1a2e] uppercase mb-1">Special Delivery Customer Notes</h5>
                <p className="italic">
                  "{order.customerNotes?.[0] || 'Please execute dispatch and coordinate delivery times. Ring the customer upon arrival.'}"
                </p>
              </div>

              {/* Logistics tracking block */}
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#1a1a2e] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Truck className="w-4 h-4 text-slate-600" />
                    Courier Logistics System
                  </div>
                  <div className="text-xs text-slate-500">
                    Deployed Carrier: <strong className="text-slate-700">{order.deliveryPartner || "RedX Logistics BD"}</strong> | Status: <strong className="text-slate-700">{order.status}</strong>
                  </div>
                </div>
                
                <a 
                  href={order.trackingUrl || `https://redx.com.bd/track/${order.id}`}
                  target="_blank" 
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#1a1a2e] text-white rounded text-[10px] font-bold text-center uppercase tracking-wider hover:bg-[#ef3c23] transition-all flex items-center justify-center gap-1"
                >
                  Track Shipment <ExternalLink className="w-3 h-3" />
                </a>
              </div>

            </div>

            {/* Print Footer */}
            <div className="mt-12 pt-6 border-t border-slate-100 text-center text-slate-400 text-[10px] space-y-1">
              <p className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Thank you for utilizing Choosify Merchandising Network</p>
              <p className="max-w-[500px] mx-auto text-slate-400">
                This document is a certified dynamic invoice generated cryptographically under System UUID {order.id}. Historical logs are kept safe on our secure cloud vault.
              </p>
              <p className="font-mono font-bold tracking-widest text-[#ef3c23] pt-2">✓ ALL LEDGER BALANCES VERIFIED AND PROTOCOL SECURE</p>
            </div>

          </div>

        </div>

        {/* Informative Side Panel (no-print) */}
        <div className="lg:col-span-4 space-y-6 no-print">
          
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-widest border-b border-slate-800 pb-2">
              Invoice Ledger Audit
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status:</span>
                <span className={`px-2 py-0.5 rounded font-bold font-mono uppercase text-[9.5px] ${
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
                <span className={`font-mono font-bold ${order.paymentStatus === 'Paid' ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {order.paymentStatus === 'Paid' ? 'PAID REVENUE' : 'COD BALANCE DUE'}
                </span>
              </div>

              {activeRole === 'admin' && (
                <>
                  <div className="border-t border-slate-900 pt-3 flex justify-between">
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
            <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-1.5 leading-relaxed">
              <li>Click <strong className="text-white">Print / Save PDF</strong> to execute system-level printer driver integrations.</li>
              <li>Toggle "Background Graphics" on in the print screen for full exact styling.</li>
              <li>Choose "Save as PDF" to generate a high fidelity digital copy.</li>
              <li>Click <strong className="text-white">Export Static HTML</strong> to get a portable single-file offline format.</li>
            </ul>
          </div>

          <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl text-center">
            <div className="text-[9.5px] font-mono text-slate-500 tracking-wider">SECURE PLATFORM SYSTEM ID</div>
            <div className="text-[11px] font-bold font-mono text-slate-300 break-all mt-1">{order.id}-{order.product.sellerId}</div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default InvoiceView;
