import React, { useState } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Trash2, 
  Ban, 
  Building2, 
  Package, 
  Users, 
  TrendingUp, 
  ThumbsUp, 
  Star, 
  Copy, 
  Download, 
  Database, 
  Search, 
  MessageCircle, 
  Check, 
  X, 
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  FileText,
  DollarSign
} from 'lucide-react';

// Tabs list
type ModTab = 'verification' | 'products' | 'disputes' | 'reputation' | 'schema' | 'rbac';

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<ModTab>('verification');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // RBAC Simulator and Control Room states
  const [rbacSelectedRole, setRbacSelectedRole] = useState<'super_admin' | 'moderator' | 'finance_manager' | 'support_agent' | 'marketing_manager'>('super_admin');
  const [actionOperatorId, setActionOperatorId] = useState('usr_admin_001');
  const [actionToVerify, setActionToVerify] = useState('moderate_products');
  const [testResult, setTestResult] = useState<{ status: 'GRANTED' | 'DENIED'; message: string; code: number } | null>(null);
  
  // Custom Dynamic Overrides State
  const [customPermissions, setCustomPermissions] = useState<Record<string, Record<string, boolean>>>({
    super_admin: { view_dashboard_kpis: true, manage_sellers: true, moderate_products: true, manage_wholesale_b2b: true, resolve_disputes: true, approve_payouts: true, manage_campaigns: true, sys_full_access: true },
    moderator: { view_dashboard_kpis: true, manage_sellers: true, moderate_products: true, manage_wholesale_b2b: true, resolve_disputes: false, approve_payouts: false, manage_campaigns: false, sys_full_access: false },
    finance_manager: { view_dashboard_kpis: true, manage_sellers: false, moderate_products: false, manage_wholesale_b2b: false, resolve_disputes: false, approve_payouts: true, manage_campaigns: false, sys_full_access: false },
    support_agent: { view_dashboard_kpis: true, manage_sellers: false, moderate_products: false, manage_wholesale_b2b: false, resolve_disputes: true, approve_payouts: false, manage_campaigns: false, sys_full_access: false },
    marketing_manager: { view_dashboard_kpis: true, manage_sellers: false, moderate_products: false, manage_wholesale_b2b: false, resolve_disputes: false, approve_payouts: false, manage_campaigns: true, sys_full_access: false },
  });

  const [activeRBACLogs, setActiveRBACLogs] = useState([
    { id: 'log_901', operator: 'Abdur Rahman', role: 'super_admin', action: 'database_schema_sync', description: 'Re-synchronized master PostgreSQL indexes across 58 operational tables', status: 'SUCCESS', ip: '192.168.1.1', date: 'Today, 08:30 AM' },
    { id: 'log_902', operator: 'Afsana Mimi', role: 'moderator', action: 'merchant_profile_verify', description: 'Approved trade license TL-4829910-BD for "Bhai Bhai Electronics"', status: 'SUCCESS', ip: '103.220.30.4', date: 'Today, 08:32 AM' },
    { id: 'log_903', operator: 'Kazi Farhan', role: 'support_agent', action: 'refund_escalation_bypass', description: 'Attempted release of ESCROW funds on ticket #disp_883 without confirmation status', status: 'DENIED', ip: '103.220.30.12', date: 'Today, 08:34 AM' },
  ]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Seller Verification Datasets
  const [sellerRequests, setSellerRequests] = useState([
    { 
      id: 'sel_v1', 
      companyName: 'Bhai Bhai Electronics', 
      ownerName: 'Azizul Islam', 
      phone: '01819-223344',
      tradeLicense: 'TL-4829910-BD', 
      nid: 'NID-9921827401', 
      submittedAt: 'Today, 08:30 AM',
      licenseChecked: true,
      nidChecked: true,
      bankChecked: false,
      status: 'Pending Review',
      notes: 'Trade license verification passed. Bank statement is missing clarity, requested high resolution copy.'
    },
    { 
      id: 'sel_v2', 
      companyName: 'Aarong Handcrafts (B2B Distributor)', 
      ownerName: 'Mufizur Rahman', 
      phone: '01711-552211',
      tradeLicense: 'TL-9022415-BD', 
      nid: 'NID-1082291882', 
      submittedAt: '1 day ago',
      licenseChecked: true,
      nidChecked: true,
      bankChecked: true,
      status: 'Pending Review',
      notes: 'All premium catalog attributes attached. B2B wholesaling documents cleared initial check.'
    },
    { 
      id: 'sel_v3', 
      companyName: 'Unicell Bangladesh Corp', 
      ownerName: 'Nasir Uddin', 
      phone: '01614-778899',
      tradeLicense: 'TL-1029485-BD', 
      nid: 'NID-4592817402', 
      submittedAt: '2 days ago',
      licenseChecked: false,
      nidChecked: true,
      bankChecked: false,
      status: 'Resubmission Requested',
      notes: 'Trade license expired in Dec 2025. Awaiting updated trade license upload.'
    }
  ]);

  const [newSellerNotes, setNewSellerNotes] = useState<Record<string, string>>({});

  const approveSeller = (id: string) => {
    setSellerRequests(prev => prev.map(s => s.id === id ? { ...s, status: 'Approved' } : s));
    const name = sellerRequests.find(s => s.id === id)?.companyName;
    triggerToast(`✓ Verified & Approved merchant: ${name}`);
  };

  const rejectSeller = (id: string) => {
    setSellerRequests(prev => prev.map(s => s.id === id ? { ...s, status: 'Declined' } : s));
    const name = sellerRequests.find(s => s.id === id)?.companyName;
    triggerToast(`✗ Rejected verification request for: ${name}`);
  };

  const requestResubmission = (id: string) => {
    setSellerRequests(prev => prev.map(s => s.id === id ? { ...s, status: 'Resubmission Requested' } : s));
    const name = sellerRequests.find(s => s.id === id)?.companyName;
    triggerToast(`📩 Resubmission notifications dispatched to: ${name}`);
  };

  const updateSellerNotesValue = (id: string, text: string) => {
    setNewSellerNotes(prev => ({ ...prev, [id]: text }));
  };

  const saveSellerNotes = (id: string) => {
    const noteContent = newSellerNotes[id];
    if (!noteContent) return;
    setSellerRequests(prev => prev.map(s => s.id === id ? { ...s, notes: noteContent } : s));
    triggerToast(`📝 Updated audit notes for seller request #${id}`);
  };


  // 2. Product Moderation Logic
  const [productModerationQueue, setProductModerationQueue] = useState([
    { id: 'p_mod1', name: 'Xiaomi Redmi Note 14 Pro B2B', seller: 'ElectroBD Express', price: 24500, type: 'Wholesale B2B', moq: 10, status: 'Pending Review' },
    { id: 'p_mod2', name: 'Apex Men Luxury Oxfords', seller: 'Apex Footwear', price: 4800, type: 'Retail B2C', moq: 1, status: 'Pending Review' },
    { id: 'p_mod3', name: 'Samsung S25 Ultra 5G Silicate', seller: 'TechZone BD', price: 112000, type: 'Retail B2C', moq: 1, status: 'Pending Review' },
    { id: 'p_mod4', name: 'Premium Cotton Silk Sharee (Carton Stock)', seller: 'Anjans Fashion Accent', price: 145000, type: 'Wholesale B2B', moq: 15, status: 'Pending Review' }
  ]);

  const approveProduct = (id: string) => {
    setProductModerationQueue(prev => prev.map(p => p.id === id ? { ...p, status: 'Active Live' } : p));
    const name = productModerationQueue.find(p => p.id === id)?.name;
    triggerToast(`✓ Product published successfully: ${name}`);
  };

  const verifyProduct = (id: string) => {
    setProductModerationQueue(prev => prev.map(p => p.id === id ? { ...p, status: 'Verified Badge' } : p));
    const name = productModerationQueue.find(p => p.id === id)?.name;
    triggerToast(`🛡️ Added verified green-badge: ${name}`);
  };

  const disableProduct = (id: string) => {
    setProductModerationQueue(prev => prev.map(p => p.id === id ? { ...p, status: 'Disabled' } : p));
    const name = productModerationQueue.find(p => p.id === id)?.name;
    triggerToast(`🔒 Deactivated and disabled: ${name}`);
  };


  // 3. Wholesale B2B Management
  const [wholesaleB2bQuotations, setWholesaleB2bQuotations] = useState([
    { id: 'q_1', buyer: 'Shopnil Varieties Dhaka', seller: 'Aarong Handcrafts', product: 'Cotton Panjabi Bulk Lot', moq: 50, quotedPrice: 750, totalVal: 37500, status: 'Awaiting MOQ review' },
    { id: 'q_2', buyer: 'Metro Retail Systems', seller: 'TechZone BD', product: 'Xiaomi Note 14 (Box of 20)', moq: 20, quotedPrice: 22000, totalVal: 440000, status: 'Quotation verified' },
    { id: 'q_3', buyer: 'Kazi Super Shop', seller: 'Khaas Food Organic', product: 'Premium Mustard Oil (Cartons)', moq: 30, quotedPrice: 18000, totalVal: 540000, status: 'Awaiting supplier signature' }
  ]);

  const verifyMoqQuotation = (id: string) => {
    setWholesaleB2bQuotations(prev => prev.map(q => q.id === id ? { ...q, status: 'Quotation verified' } : q));
    triggerToast(`🤝 Quotation #${id} validated with minimum order limits.`);
  };


  // 4. Disputes & Reports
  const [disputeReports, setDisputeReports] = useState([
    { 
      id: 'disp_1', 
      buyerId: 'cust_301', 
      buyerName: 'Fahim Chowdhury',
      sellerName: 'FakeStore BD', 
      issueDescription: 'Seller sent standard replica shoe instead of authentic Adidas. Refuses refund.',
      evidenceBuyer: 'Photo uploaded showing thin synthetic plastic soles vs genuine padding.',
      sellerWarnings: 1, 
      level: 'High Alert',
      status: 'Open In Arbitration'
    },
    { 
      id: 'disp_2', 
      buyerId: 'cust_001', 
      buyerName: 'Mehedi Rahman',
      sellerName: 'ElectroBD Express', 
      issueDescription: 'Refurbished lithium cell listed of 100% health but arrived warped.',
      evidenceBuyer: 'Nid confirmation photo + multitester battery health printout.',
      sellerWarnings: 0, 
      level: 'Medium Alert',
      status: 'Awaiting Seller Response'
    }
  ]);

  const issueSellerWarning = (id: string, merchantName: string) => {
    setDisputeReports(prev => prev.map(d => d.id === id ? { ...d, sellerWarnings: d.sellerWarnings + 1 } : d));
    triggerToast(`⚠️ Admin warning dispatched to ${merchantName}. Warning count increased.`);
  };

  const toggleSellerSuspension = (merchantName: string) => {
    triggerToast(`🔒 Suspended merchant '${merchantName}' and locked their active earnings checkout balance.`);
  };


  // 5. Buyer & Seller Reputation Databases
  const buyerReputations = [
    { name: 'Mehedi Rahman', acceptanceRate: '98%', codFraudScore: '0%', cancellationRate: '2%', level: 'Diamond Tier', trustScore: 'A+' },
    { name: 'Sajid Al Hasan', acceptanceRate: '91%', codFraudScore: '2%', cancellationRate: '8%', level: 'Gold Tier', trustScore: 'B' },
    { name: 'Rahat Khan (Suspicious)', acceptanceRate: '42%', codFraudScore: '48%', cancellationRate: '58%', level: 'Flagged fraud risk', trustScore: 'F' }
  ];

  const sellerReputations = [
    { name: 'Aarong Digital Ltd', salesConcluded: '942 deliveries', disputeCount: 1, deliverySpeed: '1.2 Days avg', responsiveness: '99%', cancelRate: '0.4%', feedback: '4.9/5' },
    { name: 'TechZone BD', salesConcluded: '420 deliveries', disputeCount: 2, deliverySpeed: '1.8 Days avg', responsiveness: '95%', cancelRate: '1.2%', feedback: '4.7/5' },
    { name: 'Khaas Food Organic', salesConcluded: '1,280 deliveries', disputeCount: 0, deliverySpeed: '1.1 Days avg', responsiveness: '100%', cancelRate: '0.1%', feedback: '4.9/5' }
  ];


  // 6. SQL database schemas and ERD
  const postgresSchemaSql = `
-- =========================================================================
-- CHOOSEIFY.BD ENTERPRISE POSTGRESQL PRODUCTION DATA ENGINE BLUEPRINT
-- GENERATED AT: 2026-05-21 09:00:00Z
-- =========================================================================

-- ==========================================
-- SECTION 1: AUTH & ROLE-BASED ACCESS CONTROL (RBAC)
-- ==========================================

-- 1. Core Users Table
CREATE TABLE users (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'usr_' || gen_random_uuid(),
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(500) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'buyer', -- 'super_admin', 'seller', 'creator', 'moderator', 'finance_manager', 'support_agent', 'marketing_manager'
    avatar_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admin Roles Table
CREATE TABLE admin_roles (
    role_key VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert system predefined roles
INSERT INTO admin_roles (role_key, role_name, description) VALUES
('super_admin', 'Super Administrator', 'Unrestricted administrative access to all systems, logs, and accounts'),
('moderator', 'Seller & Content Moderator', 'Approved access for managing seller verifications, warnings, bans, products, and reviews'),
('finance_manager', 'Finance Manager', 'Approved access for viewing and executing affiliate payouts, order pricing, and revenue audits'),
('support_agent', 'Support Agent', 'Approved access to view order logs, manage customer buyer disputes, and message users'),
('marketing_manager', 'Marketing Manager', 'Approved access to configure sponsored campaigns, deals, coupons, and CMS landing assets');

-- 3. System Permissions Table
CREATE TABLE permissions (
    permission_key VARCHAR(100) PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    description TEXT
);

-- Seed basic granular permissions
INSERT INTO permissions (permission_key, module, description) VALUES
('view_dashboard_kpis', 'analytics', 'Ability to view high-level revenue and user growth charts'),
('manage_sellers', 'moderation', 'Ability to approve, suspend or ban store vendor accounts'),
('moderate_products', 'moderation', 'Ability to flag, review, or verify product listings'),
('manage_wholesale_b2b', 'wholesale', 'Ability to audit bulk trade listings and B2B quote thresholds'),
('resolve_disputes', 'support', 'Ability to arbitrary buyer complaints, issue warnings and trigger code refunds'),
('approve_payouts', 'finance', 'Ability to release seller payment balances and audit escrow ledgers'),
('manage_campaigns', 'marketing', 'Ability to approve sponsored slots, allocate keywords, and manage ads'),
('sys_full_access', 'system', 'Full system configuration and relational schemas access');

-- 4. Role Permissions Joint Table (RBAC Mapping)
CREATE TABLE role_permissions (
    role_key VARCHAR(50) REFERENCES admin_roles(role_key) ON DELETE CASCADE,
    permission_key VARCHAR(100) REFERENCES permissions(permission_key) ON DELETE CASCADE,
    PRIMARY KEY (role_key, permission_key)
);

-- Seed initial bindings
INSERT INTO role_permissions VALUES 
('super_admin', 'sys_full_access'),
('moderator', 'manage_sellers'), ('moderator', 'moderate_products'),
('finance_manager', 'view_dashboard_kpis'), ('finance_manager', 'approve_payouts'),
('support_agent', 'resolve_disputes'),
('marketing_manager', 'manage_campaigns');

-- 5. Active Admin Sessions Table
CREATE TABLE admin_sessions (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'sess_' || gen_random_uuid(),
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    token VARCHAR(500) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Detailed Admin Activity Logging
CREATE TABLE admin_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- SECTION 2: SELLERS, BRAND REPUTATION INDEX & VERIFICATION
-- ==========================================

-- 7. Sellers Profile Table
CREATE TABLE sellers (
    id VARCHAR(100) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) UNIQUE NOT NULL,
    business_category VARCHAR(150),
    trade_license_number VARCHAR(100) UNIQUE,
    nid_number VARCHAR(100) UNIQUE,
    verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'resubmission', 'banned'
    credits_balance DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Seller Documents Locker
CREATE TABLE seller_documents (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'doc_' || gen_random_uuid(),
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- 'trade_license', 'nid_front', 'nid_back', 'bank_statement'
    document_url VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Seller Verification Review Logs
CREATE TABLE seller_verifications (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'vld_' || gen_random_uuid(),
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    reviewer_id VARCHAR(100) REFERENCES users(id),
    verdict VARCHAR(50) NOT NULL, -- 'approved', 'rejected', 'more_info_needed'
    reviewer_comments TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Seller Warnings System
CREATE TABLE seller_warnings (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'warn_' || gen_random_uuid(),
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    severity VARCHAR(30) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    issued_by VARCHAR(100) REFERENCES users(id),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Seller Blacklist & Ban Ledgers
CREATE TABLE seller_blacklists (
    seller_id VARCHAR(100) PRIMARY KEY REFERENCES sellers(id) ON DELETE CASCADE,
    banned_by VARCHAR(100) REFERENCES users(id),
    ban_reason TEXT NOT NULL,
    associated_ips VARCHAR(100)[],
    associated_phone VARCHAR(50),
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Seller Performance Metrics History
CREATE TABLE seller_performance_metrics (
    id SERIAL PRIMARY KEY,
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    total_sales_count INT DEFAULT 0,
    canceled_sales_count INT DEFAULT 0,
    average_dispatch_seconds INT DEFAULT 0,
    complaints_count INT DEFAULT 0,
    tracking_month VARCHAR(7) NOT NULL -- 'YYYY-MM'
);

-- 13. Seller Live Reputation Scores Reference
CREATE TABLE seller_reputation_scores (
    seller_id VARCHAR(100) PRIMARY KEY REFERENCES sellers(id) ON DELETE CASCADE,
    aggregate_rating DECIMAL(3, 2) DEFAULT 5.00,
    trust_grade_score DECIMAL(5,2) DEFAULT 100.00, -- Trust rating out of 100
    is_premium_badge BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- SECTION 3: BUYERS & FRAUD ENGINE
-- ==========================================

-- 14. Buyer Profile & COD Trust Grades Table
CREATE TABLE buyer_reputations (
    user_id VARCHAR(100) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    delivery_acceptance_rate DECIMAL(5, 2) DEFAULT 100.00,
    cod_fraud_score INT DEFAULT 0, -- out of 100. Higher mean more risky.
    cancellation_ratio DECIMAL(5, 2) DEFAULT 0.00,
    refused_delivery_count INT DEFAULT 0,
    successful_deliveries INT DEFAULT 0,
    trust_grade VARCHAR(10) DEFAULT 'A', -- 'A', 'B', 'C', 'F' (F bans COD purchases)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Buyer Behavior Tracking Ledger
CREATE TABLE buyer_behavior_logs (
    id SERIAL PRIMARY KEY,
    buyer_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL, -- 'cod_order_placed', 'cod_received', 'delivery_refused', 'failed_attempt'
    order_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Buyer Warning Flags (Internal Moderation System)
CREATE TABLE buyer_flags (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'flg_' || gen_random_uuid(),
    buyer_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    flag_type VARCHAR(100) NOT NULL, -- 'suspicious_cart', 'multiple_concurrent_cod_listings', 'frequent_cancellations'
    details TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- SECTION 4: PRODUCTS & MULTI-VARIANT INVENTORY
-- ==========================================

-- 17. Core Products Inventory Table
CREATE TABLE products (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'prd_' || gen_random_uuid(),
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(150),
    base_price DECIMAL(12, 2) NOT NULL,
    product_type VARCHAR(50) NOT NULL DEFAULT 'retail', -- 'retail', 'wholesale_b2b'
    minimum_order_quantity INT DEFAULT 1,
    moderation_status VARCHAR(50) DEFAULT 'pending_review', -- 'pending_review', 'active_live', 'disabled', 'flagged'
    is_sponsored BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Product Variants Matrix
CREATE TABLE product_variants (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'var_' || gen_random_uuid(),
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    sku_code VARCHAR(150) UNIQUE,
    combination_attributes JSONB NOT NULL, -- e.g. {"color": "black", "size": "XL"}
    price_adjustment DECIMAL(12,2) DEFAULT 0.00,
    stock_count INT NOT NULL DEFAULT 0
);

-- 19. Product Media Storage References
CREATE TABLE product_media (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'img_' || gen_random_uuid(),
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    media_url VARCHAR(500) NOT NULL,
    sort_order INT DEFAULT 0
);

-- 20. Categories Hierarchy Table
CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    parent_id INT REFERENCES product_categories(id),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    icon_url VARCHAR(300)
);

-- 21. Product Report Logs from Buyers
CREATE TABLE product_reports (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'rep_' || gen_random_uuid(),
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    reporter_id VARCHAR(100) REFERENCES users(id),
    report_reason VARCHAR(150) NOT NULL, -- 'fake_product', 'misleading_images', 'incorrect_moq', 'out_of_stock'
    additional_notes TEXT,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. Official Product Verification Audit
CREATE TABLE product_verifications (
    product_id VARCHAR(100) PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    is_genuine_badge BOOLEAN DEFAULT FALSE,
    audited_by VARCHAR(100) REFERENCES users(id),
    audited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. Featured Products Queue (B2C)
CREATE TABLE featured_products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    approved_by VARCHAR(100) REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 24. Sponsored Boost Products Queue
CREATE TABLE sponsored_products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    campaign_id VARCHAR(100), -- See advertisements mapping
    cost_per_click DECIMAL(8,4) NOT NULL,
    daily_budget_limit DECIMAL(10,2) NOT NULL
);


-- ==========================================
-- SECTION 5: WHOLESALE B2B TRADING PIPELINE
-- ==========================================

-- 25. Wholesale Registered Stores Profile Link
CREATE TABLE wholesale_sellers (
    seller_id VARCHAR(100) PRIMARY KEY REFERENCES sellers(id) ON DELETE CASCADE,
    moq_trade_discount_rate DECIMAL(5, 2) DEFAULT 0.00, -- standard wholesale discount percentage
    b2b_credit_terms_offered BOOLEAN DEFAULT FALSE,
    established_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 26. Wholesale Products MOQ Configurations
CREATE TABLE wholesale_products (
    product_id VARCHAR(100) PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    wholesale_carton_capacity INT NOT NULL DEFAULT 50, -- units per carton
    minimum_order_cartons INT NOT NULL DEFAULT 1,
    weight_kg_per_carton DECIMAL(10, 2) DEFAULT 0.00
);

-- 27. Wholesale MOQ Dynamic Tiered Discount Rules
CREATE TABLE wholesale_moq_rules (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    min_units INT NOT NULL,
    discount_multiplier DECIMAL(5, 4) NOT NULL DEFAULT 1.0000 -- e.g. 0.9000 for 10% discount on massive volume
);

-- 28. B2B Quotation (RFQ) Requests Desk
CREATE TABLE quotation_requests (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'rfq_' || gen_random_uuid(),
    buyer_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    requested_units INT NOT NULL,
    target_price_per_unit DECIMAL(12,2),
    shipping_destination TEXT NOT NULL,
    notes TEXT,
    rfq_status VARCHAR(50) DEFAULT 'open_active', -- 'open_active', 'responded', 'accepted', 'rejected', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 29. B2B Quotation Seller Responses Registry
CREATE TABLE quotation_responses (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'qrp_' || gen_random_uuid(),
    rfq_id VARCHAR(100) REFERENCES quotation_requests(id) ON DELETE CASCADE,
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    offered_price_per_unit DECIMAL(12,2) NOT NULL,
    estimated_production_days INT DEFAULT 7,
    terms_conditions TEXT,
    response_status VARCHAR(50) DEFAULT 'pending_buyer_review', -- 'pending_buyer_review', 'accepted', 'withdrawn'
    replied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 30. Back-Office B2B Audit approvals
CREATE TABLE b2b_approvals (
    rfq_id VARCHAR(100) PRIMARY KEY REFERENCES quotation_requests(id) ON DELETE CASCADE,
    decision VARCHAR(50) NOT NULL, -- 'approved_for_b2b_checkout', 'declined_policy_violation'
    moderator_id VARCHAR(100) REFERENCES users(id),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- SECTION 6: ORDERS, SHIPMENT TRACKING & CASH ON DELIVERY (COD) CONTROL
-- ==========================================

-- 31. Consolidated Orders Database
CREATE TABLE orders (
    id VARCHAR(100) PRIMARY KEY,
    buyer_id VARCHAR(100) REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled'
    payment_method VARCHAR(50) NOT NULL DEFAULT 'COD', -- 'COD', 'SSLCommerz', 'bKash', 'CorporateCredit'
    shipping_address TEXT NOT NULL,
    buyer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 32. Itemized Order Lines (Handles multiple mixed products cart checkout)
CREATE TABLE order_items (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'itm_' || gen_random_uuid(),
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(100) REFERENCES products(id),
    variant_id VARCHAR(100) REFERENCES product_variants(id),
    quantity INT NOT NULL DEFAULT 1,
    unit_price_at_checkout DECIMAL(12,2) NOT NULL
);

-- 33. Order Delivery Invoices & Pricing Table (Vetted locks)
CREATE TABLE invoices (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'INV-' || floor(random() * 900000 + 100000)::text,
    order_id VARCHAR(100) UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
    base_product_price DECIMAL(12, 2) NOT NULL,
    delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 120.00,
    total_payable DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'Unpaid', -- 'Unpaid', 'Paid', 'Refunded', 'Escrow_Locked'
    confirmation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 34. Split Shipments Ledger (Allows multi-merchant shipments for single order)
CREATE TABLE split_shipments (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'shp_' || gen_random_uuid(),
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE CASCADE,
    seller_id VARCHAR(100) REFERENCES sellers(id),
    logistics_partner VARCHAR(100) NOT NULL DEFAULT 'Pathao Delivery', -- 'Pathao', 'REDX', 'Steadfast'
    consignment_tracking_id VARCHAR(150),
    shipment_status VARCHAR(50) DEFAULT 'awaiting_pickup',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 35. Detailed Real-time Live Tracking Steps
CREATE TABLE shipment_tracking (
    id SERIAL PRIMARY KEY,
    shipment_id VARCHAR(100) REFERENCES split_shipments(id) ON DELETE CASCADE,
    status_node VARCHAR(100) NOT NULL, -- 'picked_up', 'hub_sorting', 'out_for_delivery', 'delivered', 'failed'
    location_details VARCHAR(300),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 36. COD Delivery Failures and Refusal Ledger
CREATE TABLE delivery_failures (
    id SERIAL PRIMARY KEY,
    shipment_id VARCHAR(100) REFERENCES split_shipments(id) ON DELETE CASCADE,
    buyer_id VARCHAR(100) REFERENCES users(id),
    reason_code VARCHAR(150), -- 'buyer_refused_no_reason', 'customer_unreachable', 'fake_address', 'cash_insufficient'
    courier_notes TEXT,
    verified_by_support BOOLEAN DEFAULT FALSE,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 37. Automated COD Risk Assessments (Neural Core)
CREATE TABLE cod_risk_scores (
    order_id VARCHAR(100) PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    assessment_grade VARCHAR(10) DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH_RISK_REJECTED'
    confidence_percentage DECIMAL(5,2),
    flagged_reasons TEXT[] -- {'high_failed_acceptance_rate_historic', 'new_account_high_order_value'}
);


-- ==========================================
-- SECTION 7: DISPUTE ARBITRATION CHANNELS
-- ==========================================

-- 38. Core Tickets Table (See Disputes)
CREATE TABLE disputes (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'disp_' || gen_random_uuid(),
    order_id VARCHAR(100) REFERENCES orders(id),
    reporter_id VARCHAR(100) REFERENCES users(id),
    reported_seller_id VARCHAR(100) REFERENCES sellers(id),
    issue_description TEXT NOT NULL,
    resolution_notes TEXT,
    dispute_status VARCHAR(50) DEFAULT 'open_in_arbitration', -- 'open_in_arbitration', 'waiting_vendor_proof', 'resolved_refunded', 'resolved_declined'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 39. Dispute Internal Arbitration Messaging
CREATE TABLE dispute_messages (
    id SERIAL PRIMARY KEY,
    dispute_id VARCHAR(100) REFERENCES disputes(id) ON DELETE CASCADE,
    sender_id VARCHAR(100) REFERENCES users(id),
    message_body TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 40. Documented Evidence Locker (Refund proof)
CREATE TABLE dispute_evidence (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'evid_' || gen_random_uuid(),
    dispute_id VARCHAR(100) REFERENCES disputes(id) ON DELETE CASCADE,
    submitted_by VARCHAR(100) REFERENCES users(id),
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'unboxing_video', 'parcel_photo', 'defect_closeup'
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 41. Arbitration Resolution Verdict
CREATE TABLE dispute_resolutions (
    dispute_id VARCHAR(100) PRIMARY KEY REFERENCES disputes(id) ON DELETE CASCADE,
    arbitrator_id VARCHAR(100) REFERENCES users(id),
    verdict_outcome VARCHAR(50) NOT NULL, -- 'refund_granted_full', 'refund_granted_partial', 'dispute_rejected'
    refunded_amount DECIMAL(12,2) DEFAULT 0.00,
    escrow_chargeback_applied BOOLEAN DEFAULT FALSE,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 42. VIP High-Value Escalation Tracker (B2C & B2B)
CREATE TABLE escalation_logs (
    id SERIAL PRIMARY KEY,
    dispute_id VARCHAR(100) REFERENCES disputes(id) ON DELETE CASCADE,
    escalation_tier VARCHAR(50) DEFAULT 'tier_2_supervisor', -- 'tier_1_agent', 'tier_2_supervisor', 'legal_team'
    escalation_reason TEXT,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- SECTION 8: ADS & ADVERTISEMENT PROMOTIONS ENGINE
-- ==========================================

-- 43. Core Ad Campaigns Table
CREATE TABLE ad_campaigns (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'cmp_' || gen_random_uuid(),
    creator_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    campaign_name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    daily_budget DECIMAL(12,2) NOT NULL DEFAULT 500.00,
    current_burn DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'active' -- 'active', 'paused', 'exhausted', 'expired'
);

-- 44. Ad Banner Slots Configurations
CREATE TABLE ad_banner_slots (
    slot_id VARCHAR(50) PRIMARY KEY,
    slot_name VARCHAR(150) NOT NULL, -- e.g. 'homepage_hero_wide', 'category_sidebar'
    dimensions_pixel VARCHAR(50) NOT NULL,
    base_cost_per_mille DECIMAL(10,2) NOT NULL DEFAULT 50.00 -- Cost per 1000 impressions
);

-- 45. Multi-User Ad Impression Streams Table (Partitioned Scale Ready)
CREATE TABLE ad_impressions (
    id BIGSERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    viewer_ip VARCHAR(45),
    viewer_country_code VARCHAR(10) DEFAULT 'BD',
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 46. User Ad Click Stream Logging
CREATE TABLE ad_clicks (
    id BIGSERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    viewer_ip VARCHAR(45),
    cost_charged DECIMAL(8,4) NOT NULL DEFAULT 1.5000,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 47. Managed Homepage Hero Banners Table
CREATE TABLE homepage_banners (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    promotion_title VARCHAR(255) NOT NULL,
    banner_image_url VARCHAR(500) NOT NULL,
    target_redirect_url VARCHAR(500) NOT NULL,
    sort_priority INT DEFAULT 0
);

-- 48. Sponsorship B2B Proposals from Merchants
CREATE TABLE sponsorship_requests (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'spr_' || gen_random_uuid(),
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    content_type VARCHAR(100) NOT NULL, -- 'PRODUCT', 'BRAND', 'DEAL'
    content_id VARCHAR(100) NOT NULL,
    bid_per_day DECIMAL(10,2) NOT NULL,
    requested_duration_days INT DEFAULT 7,
    status VARCHAR(50) DEFAULT 'PENDING' -- 'PENDING', 'APPROVED', 'REJECTED'
);

-- 49. Active Brand Premium Sponsorship Campaign Tracking
CREATE TABLE sponsorship_campaigns (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'scp_' || gen_random_uuid(),
    request_id VARCHAR(100) REFERENCES sponsorship_requests(id) ON DELETE CASCADE,
    assigned_placement VARCHAR(100) NOT NULL, -- 'homepage_featured', 'category_spotlight'
    priority_level INT DEFAULT 50,
    cumulative_spend DECIMAL(12,2) DEFAULT 0.00
);


-- ==========================================
-- SECTION 9: BUSINESS INTELLIGENCE & ANALYTICS PIPELINE
-- ==========================================

-- 50. Micro Analytics Events Streams (Click tracking)
CREATE TABLE analytics_events (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100),
    buyer_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    event_category VARCHAR(100) NOT NULL, -- 'product_detail_view', 'add_to_cart', 'checkout_start', 'conversion'
    source_channel VARCHAR(100), -- 'organic', 'google_ads', 'fb_referral', 'email'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 51. Search Keywords Hot-Trends Engine
CREATE TABLE search_trends (
    id SERIAL PRIMARY KEY,
    query_phrase VARCHAR(255) UNIQUE NOT NULL,
    search_count INTEGER DEFAULT 1,
    conversion_rate DECIMAL(5,2) DEFAULT 0.00, -- searches that directly led to purchase
    last_requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 52. Daily Platform Conversion Aggregates
CREATE TABLE conversion_metrics (
    date_metric DATE PRIMARY KEY,
    total_pageviews_count INT DEFAULT 0,
    total_added_to_cart_count INT DEFAULT 0,
    total_sales_count INT DEFAULT 0,
    overall_conversion_rate DECIMAL(5,2) DEFAULT 0.00
);

-- 53. Long-term Seller Sales Growth Tracking
CREATE TABLE seller_growth_metrics (
    id SERIAL PRIMARY KEY,
    seller_id VARCHAR(100) REFERENCES sellers(id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    cumulative_turnover DECIMAL(15,2) DEFAULT 0.00,
    shipped_parcels_count INT DEFAULT 0,
    growth_ratio DECIMAL(6,2) DEFAULT 0.00 -- month over month growth
);

-- 54. Product Sales Performance metrics
CREATE TABLE product_growth_metrics (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE CASCADE,
    daily_revenue DECIMAL(12,2) DEFAULT 0.00,
    daily_units_sold INT DEFAULT 0
);

-- 55. Behavioral Heat Aggregates
CREATE TABLE buyer_behavior_metrics (
    category_id INT REFERENCES product_categories(id),
    daily_peak_hour INT,
    average_cart_dwell_seconds INT
);


-- ==========================================
-- SECTION 10: BACK-OFFICE SECURITY, FRAUD INDEX CARDS & SECURITY AUDIT
-- ==========================================

-- 56. Granular Live Moderation Decision History
CREATE TABLE moderation_logs (
    id SERIAL PRIMARY KEY,
    operator_id VARCHAR(100) REFERENCES users(id),
    moderated_type VARCHAR(100) NOT NULL, -- 'seller_document_verify', 'product_reject', 'b2b_approve'
    target_reference VARCHAR(100) NOT NULL,
    operator_verdict VARCHAR(100) NOT NULL,
    operator_narrative TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 57. Automatic Real-time Fraud Flags (Alert System)
CREATE TABLE fraud_detection_flags (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'frd_' || gen_random_uuid(),
    suspect_entity VARCHAR(10) NOT NULL, -- 'BUYER', 'SELLER'
    entity_id VARCHAR(100) NOT NULL,
    fraud_risk VARCHAR(30) DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    detector_rule_slug VARCHAR(150), -- 'ip_matching_blacklist', 'high_frequency_checkout_burst'
    is_actively_quarantined BOOLEAN DEFAULT FALSE,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 58. Cryptographic System Security Log Files
CREATE TABLE security_events (
    id SERIAL PRIMARY KEY,
    event_severity VARCHAR(30) NOT NULL, -- 'INFO', 'WARN', 'CRITICAL_SECURITY'
    source_worker VARCHAR(150) NOT NULL, -- server thread name
    event_message TEXT NOT NULL,
    cryptographic_signature VARCHAR(256), -- verifies anti-tamper log integrity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- DATABASE PERFORMANCE PARALLEL READ OPTIMIZING INDEXES
-- =========================================================================
CREATE INDEX idx_products_moderation ON products(moderation_status);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_invoices_order_id ON invoices(order_id);
CREATE INDEX idx_split_shipments_tracking ON split_shipments(consignment_tracking_id);
CREATE INDEX idx_disputes_status ON disputes(dispute_status);
CREATE INDEX idx_ad_clicks_campaign ON ad_clicks(campaign_id);
CREATE INDEX idx_analytics_event_cat ON analytics_events(event_category);
CREATE INDEX idx_fraud_entity ON fraud_detection_flags(entity_id);
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(postgresSchemaSql);
    triggerToast('✓ PostgreSQL-Ready Database Schema copied to clipboard!');
  };

  return (
    <div className="space-y-6 pb-12 text-sans">
      {toastMessage && (
        <div className="fixed top-8 right-8 z-[100] bg-app-accent text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl tracking-wide uppercase border border-white/10 animate-pulse">
          {toastMessage}
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="text-app-accent w-6 h-6" /> Backstage Moderation Control Center
          </h1>
          <p className="text-app-text-secondary text-[12px]">Approved secure trade licenses, B2B workflows, product listings, buyer and seller reputations, and PostgreSQL relations database schema.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-app-card border border-app-border rounded-lg px-4 py-2 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#EB4501] animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Global Audit Secure Room</span>
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex flex-wrap gap-2 border-b border-app-border/40 pb-4">
        {[
          { id: 'verification', label: '🏢 Merchant Verification Requests', color: 'border-l-indigo-400' },
          { id: 'products', label: '📦 Product Moderation', color: 'border-l-orange-400' },
          { id: 'disputes', label: '🚨 Dispute Arbitration', color: 'border-l-rose-400' },
          { id: 'reputation', label: '📊 Reputation Engines', color: 'border-l-purple-400' },
          { id: 'schema', label: '🗄️ PostgreSQL Database Schemas', color: 'border-l-slate-400' },
          { id: 'rbac', label: '🛡️ Role Permissions (RBAC)', color: 'border-l-red-400' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ModTab)}
            className={`px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border border-app-border ${
              activeTab === tab.id 
                ? 'bg-app-accent text-white border-app-accent shadow-lg shadow-app-accent/15'
                : 'bg-app-card text-app-text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Body Containers based on selected tab */}
      <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-2xl">
        
        {/* ===================== TAB: VERIFICATION ===================== */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">🏢 B2B & B2C Seller Verification Desk</h3>
                <p className="text-[10px] text-app-text-secondary mt-1">Sellers cannot list products or receive payments before trade license approval and document review.</p>
              </div>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 px-3 py-1 rounded-full font-bold">
                {sellerRequests.filter(s => s.status === 'Pending Review').length} Pending Review
              </span>
            </div>

            <div className="space-y-4">
              {sellerRequests.map((s) => (
                <div key={s.id} className="p-5 bg-app-bg border border-app-border rounded-xl space-y-4 hover:border-app-accent/20 transition-all">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-[13px]">{s.companyName}</h4>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          s.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                          : s.status === 'Resubmission Requested' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2.5 text-[11px] text-app-text-secondary">
                        <div>Representative: <strong className="text-white">{s.ownerName}</strong></div>
                        <div>Contact: <strong className="text-white">{s.phone}</strong></div>
                        <div>Trade License: <strong className="text-white font-mono">{s.tradeLicense}</strong></div>
                        <div>Owner NID: <strong className="text-white font-mono">{s.nid}</strong></div>
                      </div>
                    </div>
                    <div className="text-[10px] text-app-text-secondary font-mono text-right shrink-0">
                      Submitted: {s.submittedAt}
                    </div>
                  </div>

                  {/* Document Verification Checklist */}
                  <div className="p-3 bg-app-card rounded-lg border border-app-border/40 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between text-[11px] px-2.5 py-1">
                      <span className="text-app-text-secondary">Trade License PDF Record</span>
                      <span className={`font-bold uppercase tracking-wider flex items-center gap-1 ${s.licenseChecked ? 'text-green-400' : 'text-yellow-500'}`}>
                        {s.licenseChecked ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {s.licenseChecked ? 'Passed Verification' : 'Needs Auditor Check'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] px-2.5 py-1">
                      <span className="text-app-text-secondary">Owner NID Copy</span>
                      <span className={`font-bold uppercase tracking-wider flex items-center gap-1 ${s.nidChecked ? 'text-green-400' : 'text-yellow-500'}`}>
                        {s.nidChecked ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {s.nidChecked ? 'Passed Verification' : 'Needs Auditor Check'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] px-2.5 py-1">
                      <span className="text-app-text-secondary">Official Bank Statement</span>
                      <span className={`font-bold uppercase tracking-wider flex items-center gap-1 ${s.bankChecked ? 'text-green-400' : 'text-yellow-500'}`}>
                        {s.bankChecked ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {s.bankChecked ? 'Passed Verification' : 'Needs Auditor Check'}
                      </span>
                    </div>
                  </div>

                  {/* Notes Area & Interactive Controls */}
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="text-[11px] text-app-text-secondary italic bg-white/[0.01] border border-app-border/40 p-2.5 rounded-lg flex items-start gap-1">
                      <span>📌 Auditing Notes History:</span>
                      <span className="text-white not-italic">{s.notes}</span>
                    </div>

                    <div className="bg-app-card p-3 rounded-xl border border-app-border/50 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Update Internal Audit Notes</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Type regulatory findings, missing details, trade license verification dates..."
                          value={newSellerNotes[s.id] || ''}
                          onChange={(e) => updateSellerNotesValue(s.id, e.target.value)}
                          className="flex-1 bg-app-bg text-xs px-3 py-2 border border-app-border rounded-lg outline-none text-white focus:border-app-accent/50"
                        />
                        <button 
                          onClick={() => saveSellerNotes(s.id)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold uppercase transition-all"
                        >
                          Save Log
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end pt-2">
                      {s.status !== 'Approved' && (
                        <button 
                          onClick={() => approveSeller(s.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm Account Approval
                        </button>
                      )}
                      
                      <button 
                        onClick={() => requestResubmission(s.id)}
                        className="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        📩 Request Doc Resubmission
                      </button>

                      {s.status !== 'Declined' && (
                        <button 
                          onClick={() => rejectSeller(s.id)}
                          className="px-4 py-2 bg-rose-600/25 hover:bg-rose-600/35 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Decline Verification
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB: PRODUCTS ===================== */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">📦 Platform Product Listing Moderation</h3>
                <p className="text-[10px] text-app-text-secondary mt-1">Review retail (B2C) and wholesale (B2B) incoming listings for quality, compliance, and minimum order values.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-app-border text-[10px] text-app-text-secondary uppercase tracking-widest font-black">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Merchant Shop</th>
                    <th className="py-3 px-4">Price / MoQ</th>
                    <th className="py-3 px-4">Registry Type</th>
                    <th className="py-3 px-4">Flow Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40 text-[12px]">
                  {productModerationQueue.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{p.name}</td>
                      <td className="py-3.5 px-4 text-app-text-secondary">{p.seller}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-app-accent">
                        ৳ {p.price.toLocaleString()} <span className="text-[10px] text-slate-500 italic block">MoQ: {p.moq} unit{p.moq > 1 ? 's' : ''}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          p.type === 'Wholesale B2B' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                        }`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold flex items-center gap-1.5 text-orange-400">
                          <Clock className="w-3 h-3 text-orange-400" /> {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        {p.status === 'Pending Review' && (
                          <button 
                            onClick={() => approveProduct(p.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-3 py-1.5 rounded uppercase"
                          >
                            Approve Live
                          </button>
                        )}
                        <button 
                          onClick={() => verifyProduct(p.id)}
                          className="bg-app-card border border-app-border hover:bg-white/5 text-emerald-400 font-bold text-[10px] px-3 py-1.5 rounded uppercase"
                        >
                          Verify Badge
                        </button>
                        <button 
                          onClick={() => disableProduct(p.id)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] px-3 py-1.5 rounded uppercase border border-rose-500/10"
                        >
                          Disable List
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB: DISPUTES ===================== */}
        {activeTab === 'disputes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">🚨 Dispute Desk & Buyer/Seller Evidence Lockers</h3>
                <p className="text-[10px] text-app-text-secondary mt-1">Platform supports arbitrations for COD order payment issues, unreceived shipments, and wrong products delivery.</p>
              </div>
            </div>

            <div className="space-y-4">
              {disputeReports.map((d) => (
                <div key={d.id} className="p-5 bg-app-bg border border-app-border rounded-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/15 px-2.5 py-0.5 rounded uppercase font-bold text-[9px] tracking-wider">
                          {d.level}
                        </span>
                        <h4 className="text-[12px] font-bold text-white">Case Reference: #{d.id}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Complaint lodged by: <strong className="text-white font-sans">{d.buyerName} ({d.buyerId})</strong> against merchant <strong className="text-app-accent">{d.sellerName}</strong>.
                      </p>
                    </div>
                    <span className="text-orange-400 font-mono font-bold uppercase text-[9px] bg-orange-500/5 px-3 py-1 border border-orange-500/10 rounded-full">
                      {d.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] bg-app-card p-4 rounded-xl border border-app-border/45">
                    <div className="space-y-1">
                      <span className="text-red-400 font-bold uppercase block text-[9px] tracking-widest">Buyer Conflict Claims</span>
                      <p className="text-white leading-relaxed">{d.issueDescription}</p>
                    </div>
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-app-border/45 pt-3.5 md:pt-0 md:pl-4">
                      <span className="text-emerald-400 font-bold uppercase block text-[9px] tracking-widest">Audited Evidence Locker</span>
                      <p className="text-white leading-relaxed">{d.evidenceBuyer}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="text-[11px] text-app-text-secondary">
                      Active Merchant Warnings: <strong className="text-white font-mono bg-white/5 px-2.5 py-0.5 rounded leading-none">{d.sellerWarnings} warning{d.sellerWarnings > 1 || d.sellerWarnings === 0 ? 's' : ''}</strong>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => issueSellerWarning(d.id, d.sellerName)}
                        className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/20 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        ⚠️ Issue Formal Seller Warning
                      </button>
                      <button 
                        onClick={() => toggleSellerSuspension(d.sellerName)}
                        className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/20 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        🔒 Deactivate & Suspend Merchant
                      </button>
                      <button 
                        onClick={() => triggerToast(`✓ Dispute Case ${d.id} solved. Refund transaction completed via gateway balance adjust.`)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md cursor-pointer"
                      >
                        ✓ Close Case & Pay Refund
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB: REPUTATION ===================== */}
        {activeTab === 'reputation' && (
          <div className="space-y-6">
            <div className="border-b border-white/[0.04] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">📊 Buyer & Seller Reputation Engines</h3>
              <p className="text-[10px] text-app-text-secondary mt-1">Automatic fraud scores track delivery acceptance rates for Cash-On-Delivery to block scam buyers and rate premium merchants fast.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Buyer Reputation Index */}
              <div className="space-y-4 bg-app-bg border border-app-border p-5 rounded-2xl">
                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" /> COD Buyer Trust Records
                </h4>
                
                <div className="space-y-3">
                  {buyerReputations.map((b) => (
                    <div key={b.name} className="p-3 bg-app-card rounded-xl border border-app-border/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs">{b.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${
                          b.trustScore === 'F' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10' : 'bg-green-500/10 text-green-400 border border-green-500/10'
                        }`}>
                          Trust Index: {b.trustScore}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-app-text-secondary pt-1 border-t border-app-border/40">
                        <div>Accept Rate: <strong className="text-white block mt-0.5">{b.acceptanceRate}</strong></div>
                        <div>COD Fraud Score: <strong className={`${parseInt(b.codFraudScore) > 20 ? 'text-rose-400' : 'text-emerald-400'} block mt-0.5`}>{b.codFraudScore}</strong></div>
                        <div>Cancellation Ratio: <strong className="text-white block mt-0.5">{b.cancellationRate}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seller Performance Engine */}
              <div className="space-y-4 bg-app-bg border border-app-border p-5 rounded-2xl">
                <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" /> Premium Seller Performance Engine
                </h4>

                <div className="space-y-3">
                  {sellerReputations.map((s) => (
                    <div key={s.name} className="p-3 bg-app-card rounded-xl border border-app-border/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs">{s.name}</span>
                        <span className="text-yellow-400 font-bold text-xs flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-yellow-400" /> {s.feedback}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[9px] text-app-text-secondary pt-1 border-t border-app-border/40">
                        <div>Deliveries: <strong className="text-white block">{s.salesConcluded}</strong></div>
                        <div>Disputes: <strong className="text-white block">{s.disputeCount} open</strong></div>
                        <div>Delivery Speed: <strong className="text-white block">{s.deliverySpeed}</strong></div>
                        <div>Responsiveness: <strong className="text-green-400 block">{s.responsiveness}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ===================== TAB: SCHEMA ===================== */}
        {activeTab === 'schema' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
              <div>
                <dt className="text-sm font-bold text-white uppercase tracking-wider">🗄️ PostgreSQL Database Schemas & Relations Mapping</dt>
                <dd className="text-[10px] text-app-text-secondary mt-1">Direct copyable, fully normalized, production-ready schema including audit logs, reputation tables, B2B wholesale limits and linked locked invoices.</dd>
              </div>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={copyToClipboard}
                  className="bg-app-accent hover:bg-orange-500 text-white font-black text-[10px] px-4 py-2.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all outline-none cursor-pointer"
                >
                  <Copy className="w-4 h-4" /> Copy PostgreSQL Schema
                </button>
              </div>
            </div>

            {/* Visual ERD Entity Relation layout representation */}
            <div className="p-5 bg-app-bg border border-app-border rounded-xl space-y-4">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Scalable Entity Relationships Mapping (B2C & B2B)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl relative group">
                  <h4 className="font-bold text-indigo-400 text-xs">users</h4>
                  <p className="text-[9px] text-slate-500 font-mono mt-1 mt-1 border-t border-indigo-500/10 pt-1">Primary Keys: id<br />Foreign Keys: None</p>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 py-2 translate-x-1/2 bg-app-bg text-indigo-400 rounded-full border border-indigo-500/10 px-1 text-[8px] z-10 font-bold hidden md:block">1:1</div>
                </div>

                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl relative group">
                  <h4 className="font-bold text-orange-400 text-xs text-xs">sellers</h4>
                  <p className="text-[9px] text-slate-500 font-mono mt-1 mt-1 border-t border-orange-500/10 pt-1">Primary Keys: id<br />Links: users.id</p>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 py-2 translate-x-1/2 bg-app-bg text-orange-400 rounded-full border border-orange-500/10 px-1 text-[8px] z-10 font-bold hidden md:block">1:N</div>
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl relative group">
                  <h4 className="font-bold text-emerald-400 text-xs">products</h4>
                  <p className="text-[9px] text-slate-500 font-mono mt-1 mt-1 border-t border-emerald-500/10 pt-1">Primary Keys: id<br />Links: sellers.id</p>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 py-2 translate-x-1/2 bg-app-bg text-emerald-400 rounded-full border border-emerald-500/10 px-1 text-[8px] z-10 font-bold hidden md:block">1:N</div>
                </div>

                <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl relative group">
                  <h4 className="font-bold text-cyan-400 text-xs">invoices</h4>
                  <p className="text-[9px] text-slate-500 font-mono mt-1 mt-1 border-t border-cyan-500/10 pt-1">Primary Keys: id<br />Links: orders.id</p>
                </div>

              </div>
            </div>

            {/* SQL Code Sandbox Block */}
            <div className="relative group">
              <span className="absolute top-3 right-3 bg-white/5 border border-white/5 text-[9px] text-slate-500 px-2 py-1 rounded font-mono">POSTGRESQL DIALECT SQL</span>
              <pre className="p-6 bg-[#0B0F19] text-emerald-400 rounded-2xl border border-app-border text-[11px] font-mono leading-relaxed overflow-x-auto h-[400px] custom-scrollbar selection:bg-app-accent selection:text-white">
                <code>{postgresSchemaSql}</code>
              </pre>
            </div>
          </div>
        )}

        {/* ===================== TAB: RBAC ACCESS CONTROL ===================== */}
        {activeTab === 'rbac' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.04] pb-4">
              <div>
                <dt className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-5 h-5 text-app-accent" /> Granular Access Control Room (RBAC & Policy Engine)
                </dt>
                <dd className="text-[10px] text-app-text-secondary mt-1">Configure security profiles, dynamic policy rules, and run secure sandboxed action tests to verify system route enforcement locks.</dd>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono rounded-lg">
                  POLICY_ENGINE V3.0: SECURE_LOCKED
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Roles list & custom permissions matrices */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. Predefined role roles deck */}
                <div className="bg-app-bg border border-app-border rounded-xl p-5 space-y-4">
                  <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold block mb-1">Select Back-Office Role to Customize Permissions Mapping</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { id: 'super_admin', label: 'Super Admin', desc: 'Unrestricted full systems access', color: 'border-l-indigo-500' },
                      { id: 'moderator', label: 'Moderator', desc: 'Sellers, products & reviews vetting', color: 'border-l-orange-500' },
                      { id: 'finance_manager', label: 'Finance Manager', desc: 'Balances audits & escrow payouts', color: 'border-l-emerald-500' },
                      { id: 'support_agent', label: 'Support Agent', desc: 'Disputes arbitration & ticket help', color: 'border-l-rose-500' },
                      { id: 'marketing_manager', label: 'Marketing Manager', desc: 'Sponsor deals & app campaigns', color: 'border-l-purple-500' },
                    ].map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setRbacSelectedRole(role.id as any)}
                        className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all group cursor-pointer ${
                          rbacSelectedRole === role.id 
                            ? 'bg-app-accent/15 border-app-accent shadow-lg shadow-app-accent/10' 
                            : 'bg-app-card border-app-border/60 hover:border-app-accent/30'
                        }`}
                      >
                        <div className="text-[11px] font-black text-white">{role.label}</div>
                        <div className="text-[9px] text-app-text-secondary leading-tight mt-1 group-hover:text-white transition-colors">{role.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Custom checklist matrix for selected role */}
                <div className="bg-app-bg border border-app-border rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-app-border/40 pb-2">
                    <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold">
                      Granular Permission Switches for: <strong className="text-white capitalize">{rbacSelectedRole.replace('_', ' ')}</strong>
                    </span>
                    <button 
                      onClick={() => {
                        // Reset permissions map for selected role
                        const defaultSets: Record<string, Record<string, boolean>> = {
                          super_admin: { view_dashboard_kpis: true, manage_sellers: true, moderate_products: true, manage_wholesale_b2b: true, resolve_disputes: true, approve_payouts: true, manage_campaigns: true, sys_full_access: true },
                          moderator: { view_dashboard_kpis: true, manage_sellers: true, moderate_products: true, manage_wholesale_b2b: true, resolve_disputes: false, approve_payouts: false, manage_campaigns: false, sys_full_access: false },
                          finance_manager: { view_dashboard_kpis: true, manage_sellers: false, moderate_products: false, manage_wholesale_b2b: false, resolve_disputes: false, approve_payouts: true, manage_campaigns: false, sys_full_access: false },
                          support_agent: { view_dashboard_kpis: true, manage_sellers: false, moderate_products: false, manage_wholesale_b2b: false, resolve_disputes: true, approve_payouts: false, manage_campaigns: false, sys_full_access: false },
                          marketing_manager: { view_dashboard_kpis: true, manage_sellers: false, moderate_products: false, manage_wholesale_b2b: false, resolve_disputes: false, approve_payouts: false, manage_campaigns: true, sys_full_access: false },
                        };
                        setCustomPermissions({ ...customPermissions, [rbacSelectedRole]: { ...defaultSets[rbacSelectedRole] } });
                        triggerToast('Permissions reset to initial system seeds!');
                      }}
                      className="text-[9px] uppercase font-bold text-app-accent hover:underline cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <div className="space-y-2">
                    {[
                      { key: 'view_dashboard_kpis', title: 'view_dashboard_kpis', label: 'View Dashboard Analytics KPIs', details: 'Access telemetry, page views, growth area charts, and market shares' },
                      { key: 'manage_sellers', title: 'manage_sellers', label: 'Vet & Moderate Sellers Profiles', details: 'Approve incoming store applications, review legal NID, suspend or ban shops' },
                      { key: 'moderate_products', title: 'moderate_products', label: 'Moderate B2C/B2B Products Lists', details: 'Review item details, pricing anomalies, and verified genuine badges validation' },
                      { key: 'manage_wholesale_b2b', title: 'manage_wholesale_b2b', label: 'Manage Wholesale MOQ & RFQ Contracts', details: 'Audit minimum order requirements and B2B vendor quoting price metrics' },
                      { key: 'resolve_disputes', title: 'resolve_disputes', label: 'Arbitrate Customer Disputes', details: 'Access escrow tickets, review parcel closeups evidence files and trigger warnings' },
                      { key: 'approve_payouts', title: 'approve_payouts', label: 'Authorize Balanced Escrow Payouts', details: 'Approve releases, refund accounts, adjust ledger fees and release bank transfers' },
                      { key: 'manage_campaigns', title: 'manage_campaigns', label: 'Configure Sponsor Slot Ads Bidding', details: 'Approve priority featured listings, homepage banners, and CPC CPC budgets' },
                      { key: 'sys_full_access', title: 'sys_full_access', label: 'System Full access (Database schemas)', details: 'Modify Postgres raw SQL indices, wipe telemetry logs, and alter table attributes' },
                    ].map((pNode) => {
                      const isChecked = customPermissions[rbacSelectedRole]?.[pNode.key] ?? false;
                      return (
                        <div key={pNode.key} className="p-3 bg-app-card border border-app-border/45 rounded-lg flex items-center justify-between hover:border-white/5 transition-all">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-[11px]">{pNode.label}</span>
                              <span className="font-mono text-[8px] bg-white/5 px-2 py-0.5 rounded text-app-text-secondary leading-none">{pNode.title}</span>
                            </div>
                            <p className="text-[10px] text-app-text-secondary mt-0.5">{pNode.details}</p>
                          </div>

                          {/* Interactive Toggle Button Switch */}
                          <button
                            type="button"
                            onClick={() => {
                              const updatedNode = { ...customPermissions[rbacSelectedRole], [pNode.key]: !isChecked };
                              setCustomPermissions({ ...customPermissions, [rbacSelectedRole]: updatedNode });
                              triggerToast(`✓ Permission ${pNode.key} updated dynamically in local context!`);
                            }}
                            className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-all duration-300 relative cursor-pointer ${
                              isChecked ? 'bg-app-accent' : 'bg-white/10'
                            }`}
                          >
                            <span className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all duration-300 absolute ${
                              isChecked ? 'left-[22px]' : 'left-[2px]'
                            }`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right Column: Identity Vetting playground Arena & Logs */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* 1. Identity Validation Sandbox Playground */}
                <div className="bg-app-bg border border-app-border rounded-xl p-5 space-y-4">
                  <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block">🛡️ Policy Enforcement Verification Sandbox</span>
                  
                  <div className="space-y-3">
                    {/* Select operator */}
                    <div>
                      <label className="text-[9px] font-black uppercase text-app-text-secondary block mb-1">1. Choose Operator Identity Profile</label>
                      <select
                        value={actionOperatorId}
                        onChange={(e) => {
                          setActionOperatorId(e.target.value);
                          setTestResult(null);
                        }}
                        className="w-full bg-app-card border border-app-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-app-accent cursor-pointer"
                      >
                        <option value="usr_admin_001">Abdur Rahman (Super Admin)</option>
                        <option value="usr_mimi_002">Afsana Mimi (Moderator)</option>
                        <option value="usr_sajid_003">Sajid Islam (Finance Manager)</option>
                        <option value="usr_farhan_004">Kazi Farhan (Support Agent)</option>
                        <option value="usr_mkt_005">Sonia Chowdhury (Marketing Manager)</option>
                      </select>
                    </div>

                    {/* Choose action to invoke */}
                    <div>
                      <label className="text-[9px] font-black uppercase text-app-text-secondary block mb-1">2. Target Action Hook to Execute</label>
                      <select
                        value={actionToVerify}
                        onChange={(e) => {
                          setActionToVerify(e.target.value);
                          setTestResult(null);
                        }}
                        className="w-full bg-app-card border border-app-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-app-accent cursor-pointer"
                      >
                        <option value="view_dashboard_kpis">view_dashboard_kpis (KPI Auditing)</option>
                        <option value="manage_sellers">manage_sellers (Ban/Vet Merchant Shops)</option>
                        <option value="moderate_products">moderate_products (Vetting Listings)</option>
                        <option value="manage_wholesale_b2b">manage_wholesale_b2b (MOQ/RFQ Auditing)</option>
                        <option value="resolve_disputes">resolve_disputes (Arbitrate dispute reports)</option>
                        <option value="approve_payouts">approve_payouts (Release financial escrow)</option>
                        <option value="manage_campaigns">manage_campaigns (Launch Ads CPC campaigns)</option>
                        <option value="sys_full_access">sys_full_access (Wipe databases/schemas)</option>
                      </select>
                    </div>

                    {/* Trigger Authentication Vetting Action */}
                    <button
                      onClick={() => {
                        // Evaluation Logic
                        const operatorsRoles: Record<string, 'super_admin' | 'moderator' | 'finance_manager' | 'support_agent' | 'marketing_manager'> = {
                          usr_admin_001: 'super_admin',
                          usr_mimi_002: 'moderator',
                          usr_sajid_003: 'finance_manager',
                          usr_farhan_004: 'support_agent',
                          usr_mkt_005: 'marketing_manager'
                        };

                        const operatorNames: Record<string, string> = {
                          usr_admin_001: 'Abdur Rahman',
                          usr_mimi_002: 'Afsana Mimi',
                          usr_sajid_003: 'Sajid Islam',
                          usr_farhan_004: 'Kazi Farhan',
                          usr_mkt_005: 'Sonia Chowdhury'
                        };

                        const opId = actionOperatorId;
                        const role = operatorsRoles[opId];
                        const operatorName = operatorNames[opId];
                        
                        // Check if role has permission mapping enabled
                        const hasPermission = customPermissions[role]?.[actionToVerify] ?? false;

                        if (hasPermission) {
                          setTestResult({
                            status: 'GRANTED',
                            message: `Access check approved. Cryptographic signature verified successfully. Authorized action executed safely on back-office container.`,
                            code: 200
                          });
                          
                          // Append to log list
                          const newLog = {
                            id: 'log_' + floor(random() * 8000 + 1000).toString(),
                            operator: operatorName,
                            role: role,
                            action: actionToVerify,
                            description: `Policed checkpoint verified: successfully authorized back-end execution of '${actionToVerify}' call`,
                            status: 'SUCCESS',
                            ip: opId === 'usr_admin_001' ? '192.168.1.1' : '103.220.30.' + floor(random() * 15 + 2).toString(),
                            date: 'Just Now'
                          };
                          setActiveRBACLogs([newLog, ...activeRBACLogs]);
                          triggerToast('✓ Action GRANTED (HTTP 200 OK)');
                        } else {
                          setTestResult({
                            status: 'DENIED',
                            message: `Security exception: Role '${role}' lacks the necessary granular claim permissions list associated with '${actionToVerify}'. Request rejected instantly.`,
                            code: 403
                          });

                          // Append failed log list
                          const newLog = {
                            id: 'log_' + floor(random() * 8000 + 1000).toString(),
                            operator: operatorName,
                            role: role,
                            action: actionToVerify,
                            description: `Intrusion blocked: Operator lacked granular permissions required for execution of '${actionToVerify}'`,
                            status: 'DENIED',
                            ip: opId === 'usr_admin_001' ? '192.168.1.1' : '103.220.30.' + floor(random() * 15 + 2).toString(),
                            date: 'Just Now'
                          };
                          setActiveRBACLogs([newLog, ...activeRBACLogs]);
                          triggerToast('❌ Action DENIED (HTTP 403 Forbidden)');
                        }
                      }}
                      className="w-full py-3 rounded-xl bg-app-accent hover:scale-[1.01] hover:bg-orange-500 font-bold text-xs uppercase text-white shadow-lg tracking-wider active:scale-95 transition-all cursor-pointer"
                    >
                      ⛓️ Execute Secure Action Vetting
                    </button>
                  </div>

                  {/* Sandbox outcome display */}
                  {testResult && (
                    <div className={`p-4 border rounded-xl space-y-2 animate-fade-in ${
                      testResult.status === 'GRANTED'
                        ? 'bg-green-500/10 border-green-500/25 text-green-400'
                        : 'bg-red-500/10 border-red-500/25 text-red-400'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[10px] uppercase tracking-wider block">
                          Outcome: {testResult.status}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                          testResult.code === 200 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          HTTP {testResult.code}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-app-text-primary">
                        {testResult.message}
                      </p>
                    </div>
                  )}

                </div>

                {/* 2. Cryptographic Security Auditor Ledger Real-time Logs Feed list */}
                <div className="bg-app-bg border border-app-border rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-app-border/40 pb-2">
                    <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block">🔒 Security Auditor Ledger</span>
                    <button 
                      onClick={() => {
                        setActiveRBACLogs([]);
                        triggerToast('Vetting ledger logs cleared!');
                      }}
                      className="text-[9px] uppercase font-bold text-slate-500 hover:text-white cursor-pointer"
                    >
                      Clear Audit Logs
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {activeRBACLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-app-card rounded-xl border border-app-border/45 space-y-1.5 hover:border-app-accent/25 transition-all text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white block">{log.operator} ({log.role})</span>
                          <span className={`px-2 py-0.2 rounded text-[7px] font-black uppercase text-center ${
                            log.status === 'SUCCESS' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                        <p className="text-app-text-secondary leading-snug">{log.description}</p>
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono gap-4 pt-1">
                          <span>Action: {log.action}</span>
                          <span>IP: {log.ip} • {log.date}</span>
                        </div>
                      </div>
                    ))}

                    {activeRBACLogs.length === 0 && (
                      <div className="py-8 text-center text-app-text-secondary italic">
                        No auditable security alerts in ledger. Execute sandbox tests above to log.
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Inline fallback since arrow-right isn't in original import
function floor(num: number): number {
  return Math.floor(num);
}

function random(): number {
  return Math.random();
}

