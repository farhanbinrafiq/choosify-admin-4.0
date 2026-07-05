import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// ============================================================================
// PHASE 1: TRUST ENGINE ENTITIES
// ============================================================================

export type TrustEntityType = 'brand' | 'seller' | 'creator' | 'buyer';

export type TrustEventType = 
  | 'order_delivered' 
  | 'review_verified' 
  | 'review_removed' 
  | 'complaint_received' 
  | 'complaint_resolved' 
  | 'fake_review_detected' 
  | 'account_suspended' 
  | 'cancellation_rate_high' 
  | 'return_rate_high' 
  | 'creator_violation' 
  | 'delivery_failure';

export interface ReputationLedgerEntry {
  id: string;
  entity_type: TrustEntityType;
  entity_id: string;
  entity_name: string;
  event_type: TrustEventType;
  points: number;
  metadata_json: string;
  created_at: string;
}

export interface TrustScore {
  id: string;
  entity_type: TrustEntityType;
  entity_id: string;
  entity_name: string;
  current_score: number; // calculated scale 0 - 100
  last_updated: string;
  // Explanatory breakdown dimensions
  quality: number;
  delivery: number;
  service: number;
  returns: number;
  complaints: number;
  recommendations: number;
}

export interface TrustScoreSnapshot {
  id: string;
  entity_type: TrustEntityType;
  entity_id: string;
  score: number;
  calculated_at: string;
}

export type TrustAlert_Type = 
  | 'High Cancellation Rate' 
  | 'High Return Rate' 
  | 'Fake Review Detection' 
  | 'Complaint Spike' 
  | 'Delivery Failure Spike' 
  | 'Creator Abuse' 
  | 'Suspicious Seller Activity';

export type SeverityType = 'Low' | 'Medium' | 'High' | 'Critical';

export interface TrustAlert {
  id: string;
  entity_type: TrustEntityType;
  entity_id: string;
  entity_name: string;
  alert_type: TrustAlert_Type;
  severity: SeverityType;
  message: string;
  status: 'unresolved' | 'resolved';
  created_at: string;
  resolved_at?: string;
}

// ============================================================================
// PHASE 3: BRAND VERIFICATION SYSTEM ENTITIES
// ============================================================================

export type DocumentType = 
  | 'Trade License' 
  | 'Business Registration' 
  | 'Tax Certificate' 
  | 'Brand Ownership Proof' 
  | 'Identity Verification';

export interface VerificationDocument {
  id: string;
  type: DocumentType;
  name: string;
  doc_url: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface VerificationReview {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  status: 'approved' | 'rejected';
  feedback: string;
  reviewed_at: string;
}

export interface VerificationRequest {
  id: string;
  brand_id: string;
  brand_name: string;
  logo_url: string;
  submitted_by: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  documents: VerificationDocument[];
  reviews: VerificationReview[];
  audit_trail: { timestamp: string; action: string; actor: string; details: string }[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PHASE 4: RECOMMENDATION ATTRIBUTION ENGINE ENTITIES
// ============================================================================

export type RecommendationType = 
  | 'creator' 
  | 'editorial' 
  | 'admin' 
  | 'buying_guide' 
  | 'comparison';

export interface RecommendationMetric {
  id: string;
  title: string;
  type: RecommendationType;
  owner_id: string; // creator_id or admin_id
  owner_name: string;
  product_id: string;
  product_name: string;
  views: number;
  clicks: number;
  saves: number;
  shares: number;
  conversions: number; // orders generated
  revenue: number; // raw value in BDT
  creator_earnings: number; // commission BDT
}

// ============================================================================
// PHASE 5: CREATOR ECONOMY EXPANSION ENTITIES
// ============================================================================

export type CreatorTierName = 'Verified Creator' | 'Premium Creator' | 'Partner Creator';

export interface CreatorBrandPartnership {
  id: string;
  creator_id: string;
  creator_name: string;
  brand_id: string;
  brand_name: string;
  status: 'Pending' | 'Active' | 'Terminated';
  revenue_generated: number;
  created_at: string;
}

export interface CreatorCampaign {
  id: string;
  title: string;
  brand_id: string;
  brand_name: string;
  budget: number;
  commission_rate: number;
  active: boolean;
  clicks: number;
  revenue: number;
  start_date: string;
  end_date: string;
}

export interface CreatorPayout {
  id: string;
  creator_id: string;
  creator_name: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid';
  channel: string;
  created_at: string;
}

export interface CreatorTier {
  id: string;
  name: CreatorTierName;
  min_points: number;
  commission_boost: number;
  perks: string[];
}

// ============================================================================
// PHASE 6: MODERATION ENGINE ENTITIES
// ============================================================================

export type ModeratableEntityType = 'products' | 'reviews' | 'recommendations' | 'brands' | 'sellers' | 'creators';

export type FlagType = 'Fake Product' | 'Copyright Issue' | 'Spam' | 'Fraud' | 'Misleading Information' | 'Suspicious Activity';

export interface ModeratorReport {
  id: string;
  entity_type: ModeratableEntityType;
  entity_id: string;
  entity_name: string;
  reporter_name: string;
  flag_type: FlagType;
  details: string;
  status: 'Pending' | 'In Investigation' | 'Resolved' | 'Dismissed';
  created_at: string;
}

export interface ContentFlag {
  id: string;
  entity_type: ModeratableEntityType;
  entity_id: string;
  entity_name: string;
  flag_type: FlagType;
  severity: SeverityType;
  flagged_by: string;
  created_at: string;
}

export interface ModerationAction {
  id: string;
  report_id: string;
  entity_type: ModeratableEntityType;
  entity_id: string;
  action_taken: 'Suspend Account' | 'Remove Content' | 'Issue Warning' | 'Audit Storefront' | 'Dismiss Case';
  acted_by: string;
  notes: string;
  enacted_at: string;
}

export interface ModerationRule {
  id: string;
  name: string;
  trigger_event: string;
  condition: string;
  auto_action: string;
  active: boolean;
}

// ============================================================================
// PHASE 7: ANALYTICS WAREHOUSE AGGREGATIONS
// ============================================================================

export interface DailyPlatformMetrics {
  date: string;
  total_revenue: number;
  orders_count: number;
  avg_trust_score: number;
  active_creators: number;
  active_brands: number;
}

export interface DailyBrandMetrics {
  date: string;
  brand_id: string;
  brand_name: string;
  trust_score: number;
  total_spend: number;
  clicks: number;
  revenue: number;
}

export interface DailyCreatorMetrics {
  date: string;
  creator_id: string;
  creator_name: string;
  shares: number;
  clicks: number;
  payout_accrued: number;
  conversion_rate: number;
}

export interface DailyProductMetrics {
  date: string;
  product_id: string;
  product_name: string;
  views: number;
  conversions: number;
  trust_index: number;
}

export interface DailyOrderMetrics {
  date: string;
  total_retail: number;
  cancellations: number;
  returns: number;
}

// ============================================================================
// TRUST CONTEXT OBJECT STRUCTURE
// ============================================================================

interface TrustContextType {
  // States
  reputationLedger: ReputationLedgerEntry[];
  trustScores: TrustScore[];
  trustScoreSnapshots: TrustScoreSnapshot[];
  trustAlerts: TrustAlert[];
  
  verificationRequests: VerificationRequest[];
  recommendationMetrics: RecommendationMetric[];
  
  partnerships: CreatorBrandPartnership[];
  campaigns: CreatorCampaign[];
  creatorPayouts: CreatorPayout[];
  creatorTiers: CreatorTier[];
  
  reports: ModeratorReport[];
  contentFlags: ContentFlag[];
  moderationActions: ModerationAction[];
  moderationRules: ModerationRule[];
  
  // Warehouse Aggregates
  dailyPlatformMetrics: DailyPlatformMetrics[];
  dailyBrandMetrics: DailyBrandMetrics[];
  dailyCreatorMetrics: DailyCreatorMetrics[];
  dailyProductMetrics: DailyProductMetrics[];
  dailyOrderMetrics: DailyOrderMetrics[];

  // Live Operations Service methods
  addTrustEvent: (
    entity_type: TrustEntityType,
    entity_id: string,
    entity_name: string,
    event_type: TrustEventType,
    points: number,
    metadata: Record<string, any>
  ) => void;
  
  logDisputeImpact: (
    entity_id: string,
    entity_name: string,
    entity_type: TrustEntityType,
    impactType: 'created' | 'escalated' | 'resolved_against' | 'dismissed'
  ) => void;
  
  calculateTrustScore: (entity_type: TrustEntityType, entity_id: string) => TrustScore | undefined;
  generateTrustAlert: (
    entity_type: TrustEntityType,
    entity_id: string,
    entity_name: string,
    alert_type: TrustAlert_Type,
    severity: SeverityType,
    message: string
  ) => void;
  resolveTrustAlert: (alert_id: string) => void;

  // Verification pipeline
  createVerificationRequest: (brand_id: string, brand_name: string, logo: string) => void;
  submitVerificationRequest: (request_id: string) => void;
  updateDocumentStatus: (request_id: string, doc_id: string, status: 'approved' | 'rejected', notes?: string) => void;
  reviewVerificationRequest: (request_id: string, reviewer_id: string, reviewer_name: string, status: 'approved' | 'rejected', feedback: string) => void;

  // Recommendations logs
  logRecommendationActivity: (recommendation_id: string, activity: 'view' | 'click' | 'save' | 'share' | 'conversion') => void;

  // Creator economy actions
  proposePartnership: (creator_id: string, creator_name: string, brand_id: string, brand_name: string) => void;
  updatePartnershipStatus: (partnership_id: string, status: 'Active' | 'Terminated') => void;
  createCampaign: (brand_id: string, brand_name: string, title: string, budget: number, rate: number, start: string, end: string) => void;
  processCreatorPayout: (id: string) => void;

  // Moderation triggers
  submitReport: (entity_type: ModeratableEntityType, entity_id: string, entity_name: string, reporter: string, flag: FlagType, details: string) => void;
  addContentFlag: (entity_type: ModeratableEntityType, entity_id: string, entity_name: string, flag_type: FlagType, severity: SeverityType, flagged_by: string) => void;
  takeModerationAction: (report_id: string, entity_type: ModeratableEntityType, entity_id: string, action: 'Suspend Account' | 'Remove Content' | 'Issue Warning' | 'Audit Storefront' | 'Dismiss Case', actor: string, notes: string) => void;
  toggleModerationRule: (rule_id: string) => void;
}

const TrustContext = createContext<TrustContextType | undefined>(undefined);

export const useTrust = () => {
  const context = useContext(TrustContext);
  if (!context) throw new Error('useTrust must be used within a TrustProvider');
  return context;
};

// ============================================================================
// CONTEXT PROVIDER SIMULATOR (WITH RICH DHAKA MARKETPLACE PRELOADS)
// ============================================================================

export const TrustProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  // 1. REPUTATION LEDGER CODES
  const [reputationLedger, setReputationLedger] = useState<ReputationLedgerEntry[]>(() => {
    const saved = localStorage.getItem('choosify_reputation_ledger');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'ev_001', entity_type: 'brand', entity_id: 'brand_aarong', entity_name: 'Aarong Handcrafts', event_type: 'order_delivered', points: 3, metadata_json: '{"order_id": "CSS-1224"}', created_at: '2026-06-11T09:00:00Z' },
      { id: 'ev_002', entity_type: 'brand', entity_id: 'brand_aarong', entity_name: 'Aarong Handcrafts', event_type: 'review_verified', points: 5, metadata_json: '{"review_id": "rev-1"}', created_at: '2026-06-11T10:00:00Z' },
      { id: 'ev_003', entity_type: 'seller', entity_id: 'seller_techzone', entity_name: 'TechZone BD', event_type: 'complaint_received', points: -15, metadata_json: '{"reason": "Delayed delivery and faulty earbud packing"}', created_at: '2026-06-10T14:20:00Z' },
      { id: 'ev_004', entity_type: 'creator', entity_id: 'creator_rafsan', entity_name: 'Rafsan The Chotobhai', event_type: 'review_verified', points: 4, metadata_json: '{"campaign": "EID-Panjabi-Guide"}', created_at: '2026-06-12T11:00:00Z' },
      { id: 'ev_005', entity_type: 'buyer', entity_id: 'cust_003', entity_name: 'Nadia Akter', event_type: 'cancellation_rate_high', points: -25, metadata_json: '{"cancel_ratio": "75% of recent 4 checkouts"}', created_at: '2026-06-09T18:00:00Z' },
      { id: 'ev_006', entity_type: 'brand', entity_id: 'brand_apex', entity_name: 'Apex Footwear', event_type: 'order_delivered', points: 3, metadata_json: '{"order_id": "CSS-5561"}', created_at: '2026-06-12T07:15:00Z' },
      { id: 'ev_007', entity_type: 'brand', entity_id: 'brand_walton', entity_name: 'Walton Appliances', event_type: 'delivery_failure', points: -8, metadata_json: '{"order_id": "CSS-4041", "partner": "Paperfly"}', created_at: '2026-06-08T15:30:00Z' },
      { id: 'ev_008', entity_type: 'brand', entity_id: 'brand_aarong', entity_name: 'Aarong Handcrafts', event_type: 'complaint_resolved', points: 10, metadata_json: '{"complaint_id": "comp-7721"}', created_at: '2026-06-12T16:00:00Z' }
    ];
  });

  // 2. TRUST SCORES (INITIAL CALCULATED STATUSES)
  const [trustScores, setTrustScores] = useState<TrustScore[]>(() => {
    const saved = localStorage.getItem('choosify_trust_scores');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'ts_001', entity_type: 'brand', entity_id: 'brand_aarong', entity_name: 'Aarong Handcrafts', current_score: 96, last_updated: '2026-06-12T16:00:00Z', quality: 98, delivery: 95, service: 97, returns: 96, complaints: 97, recommendations: 94 },
      { id: 'ts_002', entity_type: 'brand', entity_id: 'brand_apex', entity_name: 'Apex Footwear', current_score: 92, last_updated: '2026-06-12T07:15:00Z', quality: 94, delivery: 91, service: 93, returns: 94, complaints: 92, recommendations: 88 },
      { id: 'ts_003', entity_type: 'brand', entity_id: 'brand_walton', entity_name: 'Walton Appliances', current_score: 84, last_updated: '2026-06-12T12:00:00Z', quality: 86, delivery: 81, service: 88, returns: 84, complaints: 80, recommendations: 85 },
      { id: 'ts_004', entity_type: 'seller', entity_id: 'seller_techzone', entity_name: 'TechZone BD', current_score: 68, last_updated: '2026-06-10T14:20:00Z', quality: 72, delivery: 60, service: 65, returns: 75, complaints: 55, recommendations: 81 },
      { id: 'ts_005', entity_type: 'creator', entity_id: 'creator_rafsan', entity_name: 'Rafsan The Chotobhai', current_score: 95, last_updated: '2026-06-12T11:00:00Z', quality: 95, delivery: 100, service: 94, returns: 100, complaints: 96, recommendations: 92 },
      { id: 'ts_006', entity_type: 'buyer', entity_id: 'cust_003', entity_name: 'Nadia Akter', current_score: 42, last_updated: '2026-06-09T18:00:00Z', quality: 100, delivery: 100, service: 80, returns: 20, complaints: 10, recommendations: 100 }
    ];
  });

  // 3. TRUST SNAPSHOTS (FOR HISTORICAL CHARTS)
  const [trustScoreSnapshots, setTrustScoreSnapshots] = useState<TrustScoreSnapshot[]>(() => {
    const saved = localStorage.getItem('choosify_trust_snapshots');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'sn_001', entity_type: 'brand', entity_id: 'brand_aarong', score: 92, calculated_at: '2026-05-15T00:00:00Z' },
      { id: 'sn_002', entity_type: 'brand', entity_id: 'brand_aarong', score: 94, calculated_at: '2026-06-01T00:00:00Z' },
      { id: 'sn_003', entity_type: 'brand', entity_id: 'brand_aarong', score: 96, calculated_at: '2026-06-12T00:00:00Z' },
      { id: 'sn_004', entity_type: 'brand', entity_id: 'brand_apex', score: 88, calculated_at: '2026-06-01T00:00:00Z' },
      { id: 'sn_005', entity_type: 'brand', entity_id: 'brand_apex', score: 92, calculated_at: '2026-06-12T00:00:00Z' },
      { id: 'sn_006', entity_type: 'seller', entity_id: 'seller_techzone', score: 82, calculated_at: '2026-06-01T00:00:00Z' },
      { id: 'sn_007', entity_type: 'seller', entity_id: 'seller_techzone', score: 68, calculated_at: '2026-06-12T00:00:00Z' }
    ];
  });

  // 4. ACTIONABLE TRUST ALERTS
  const [trustAlerts, setTrustAlerts] = useState<TrustAlert[]>(() => {
    const saved = localStorage.getItem('choosify_trust_alerts');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'al_001', entity_type: 'seller', entity_id: 'seller_techzone', entity_name: 'TechZone BD', alert_type: 'Suspicious Seller Activity', severity: 'High', message: 'Trust Score degraded to 68 BDT warning levels due to repetitive buyer delivery complaints.', status: 'unresolved', created_at: '2026-06-10T14:25:00Z' },
      { id: 'al_002', entity_type: 'buyer', entity_id: 'cust_003', entity_name: 'Nadia Akter', alert_type: 'High Cancellation Rate', severity: 'Critical', message: 'Extremely critical checkout cancellations (75%). Automated purchase gate limitations are recommended.', status: 'unresolved', created_at: '2026-06-09T18:05:00Z' },
      { id: 'al_003', entity_type: 'brand', entity_id: 'brand_walton', entity_name: 'Walton Appliances', alert_type: 'Delivery Failure Spike', severity: 'Medium', message: 'Multiple logistic failures registered via Paperfly transport node.', status: 'resolved', created_at: '2026-06-08T15:35:00Z', resolved_at: '2026-06-10T11:00:00Z' }
    ];
  });

  // 5. BRAND VERIFICATION SYSTEM PIPELINE
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>(() => {
    const saved = localStorage.getItem('choosify_verifications');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'vr_001',
        brand_id: 'brand_aarong',
        brand_name: 'Aarong Handcrafts',
        logo_url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=100',
        submitted_by: 'Azizul Islam, Brand Manager',
        status: 'Approved',
        documents: [
          { id: 'doc_101', type: 'Trade License', name: 'Aarong_Trade_License_2026.pdf', doc_url: '#', status: 'approved', notes: 'Trade License TL-4829910 is active and audited' },
          { id: 'doc_102', type: 'Tax Certificate', name: 'Aarong_BIN_TIN_Auth.pdf', doc_url: '#', status: 'approved', notes: 'Tax Certificate fully verified by NBR database' },
          { id: 'doc_103', type: 'Brand Ownership Proof', name: 'Aarong_Copyright_BRAC.pdf', doc_url: '#', status: 'approved', notes: 'Genuine BRAC enterprise certificate matches registered domain' }
        ],
        reviews: [
          { id: 'rvw_101', reviewer_id: 'usr_admin_001', reviewer_name: 'Principal Auditor', status: 'approved', feedback: 'Verified physical retail and intellectual holding credentials. Excellent compliance record.', reviewed_at: '2026-06-02T10:00:00Z' }
        ],
        audit_trail: [
          { timestamp: '2026-06-01T09:00:00Z', action: 'Draft Created', actor: 'Azizul Islam', details: 'Initialized trade application metadata.' },
          { timestamp: '2026-06-01T12:00:00Z', action: 'Submitted Request', actor: 'Azizul Islam', details: 'Files dispatched for administrative verification review.' },
          { timestamp: '2026-06-02T10:00:00Z', action: 'Approved Application', actor: 'Principal Auditor', details: 'Status promoted to Verified. Trust Badge published on Choosify catalog.' }
        ],
        created_at: '2026-06-01T09:00:00Z',
        updated_at: '2026-06-02T10:00:00Z'
      },
      {
        id: 'vr_002',
        brand_id: 'brand_apex',
        brand_name: 'Apex Footwear',
        logo_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100',
        submitted_by: 'Ziaul Haq, Director Retail',
        status: 'Under Review',
        documents: [
          { id: 'doc_201', type: 'Trade License', name: 'Apex_TradeLicense_2026.pdf', doc_url: '#', status: 'approved', notes: 'Verified active status.' },
          { id: 'doc_202', type: 'Tax Certificate', name: 'Apex_BIN_VAT_2026.pdf', doc_url: '#', status: 'pending' },
          { id: 'doc_203', type: 'Identity Verification', name: 'Ziaul_NID_Card.png', doc_url: '#', status: 'pending' }
        ],
        reviews: [],
        audit_trail: [
          { timestamp: '2026-06-08T11:00:00Z', action: 'Files Uploaded', actor: 'Ziaul Haq', details: 'Registered business and VAT profile assets.' },
          { timestamp: '2026-06-10T14:00:00Z', action: 'Status Update', actor: 'Admin Assistant', details: 'Marked under administrative review queue.' }
        ],
        created_at: '2026-06-08T11:00:00Z',
        updated_at: '2026-06-10T14:00:00Z'
      },
      {
        id: 'vr_003',
        brand_id: 'brand_walton',
        brand_name: 'Walton Appliances',
        logo_url: 'https://images.unsplash.com/photo-1571175432247-fe0320b5da22?w=100',
        submitted_by: 'M. S. Zaman, Walton Compliance',
        status: 'Submitted',
        documents: [
          { id: 'doc_301', type: 'Trade License', name: 'Walton_PLC_Industrial_License.pdf', doc_url: '#', status: 'pending' },
          { id: 'doc_302', type: 'Tax Certificate', name: 'Walton_Corporate_NBR_VAT.pdf', doc_url: '#', status: 'pending' }
        ],
        reviews: [],
        audit_trail: [
          { timestamp: '2026-06-11T16:00:00Z', action: 'Request Submitted', actor: 'M. S. Zaman', details: 'Filing corporate documents for Walton electrical segment.' }
        ],
        created_at: '2026-06-11T16:00:00Z',
        updated_at: '2026-06-11T16:00:00Z'
      }
    ];
  });

  // 6. RECOMMENDATION ATTRIBUTION DATA
  const [recommendationMetrics, setRecommendationMetrics] = useState<RecommendationMetric[]>(() => {
    const saved = localStorage.getItem('choosify_recommendations');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'rec_01', title: 'Top 5 Traditional Silk Panjabis for Eid', type: 'buying_guide', owner_id: 'admin_01', owner_name: 'Editorial Staff', product_id: '101', product_name: 'Aarong Silk Panjabi', views: 12500, clicks: 2300, saves: 450, shares: 120, conversions: 88, revenue: 369600, creator_earnings: 0 },
      { id: 'rec_02', title: 'Rafsans Favorite Daily Formal Shoe Selection', type: 'creator', owner_id: 'creator_rafsan', owner_name: 'Rafsan The Chotobhai', product_id: '102', product_name: 'Apex Mens Formal Leather', views: 24000, clicks: 5800, saves: 1100, shares: 480, conversions: 182, revenue: 637000, creator_earnings: 63700 },
      { id: 'rec_03', title: 'Super Admins Budget Flagship Smartphone Recommendation', type: 'admin', owner_id: 'usr_admin_001', owner_name: 'Chief Moderator', product_id: '103', product_name: 'Samsung S25 Ultra', views: 8900, clicks: 1200, saves: 210, shares: 35, conversions: 12, revenue: 1679988, creator_earnings: 0 },
      { id: 'rec_04', title: 'Khalids Complete Home Appliance Starter Kit', type: 'creator', owner_id: 'creator_khalid', owner_name: 'Khalid Farhan', product_id: '104', product_name: 'Walton 2-Door Fridge', views: 15400, clicks: 3100, saves: 680, shares: 205, conversions: 34, revenue: 1019660, creator_earnings: 101966 },
      { id: 'rec_05', title: 'Eminent Winter Trend Footwear Editorial', type: 'editorial', owner_id: 'admin_02', owner_name: 'Fashion Editor', product_id: '102', product_name: 'Apex Mens Formal Leather', views: 6100, clicks: 920, saves: 140, shares: 18, conversions: 24, revenue: 84000, creator_earnings: 0 }
    ];
  });

  // 7. CREATOR ECONOMY EXPANSION DATA
  const [partnerships, setPartnerships] = useState<CreatorBrandPartnership[]>(() => {
    const saved = localStorage.getItem('choosify_partnerships');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'pt_01', creator_id: 'creator_rafsan', creator_name: 'Rafsan The Chotobhai', brand_id: 'brand_apex', brand_name: 'Apex Footwear', status: 'Active', revenue_generated: 637000, created_at: '2026-04-10T08:00:00Z' },
      { id: 'pt_02', creator_id: 'creator_khalid', creator_name: 'Khalid Farhan', brand_id: 'brand_walton', brand_name: 'Walton Appliances', status: 'Active', revenue_generated: 1019660, created_at: '2026-05-01T10:00:00Z' },
      { id: 'pt_03', creator_id: 'creator_tawhid', creator_name: 'Tawhid Afridi', brand_id: 'brand_aarong', brand_name: 'Aarong Handcrafts', status: 'Pending', revenue_generated: 0, created_at: '2026-06-11T12:00:00Z' }
    ];
  });

  const [campaigns, setCampaigns] = useState<CreatorCampaign[]>(() => {
    const saved = localStorage.getItem('choosify_campaigns');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'cp_01', title: 'Monsoon Casual Leather Drive', brand_id: 'brand_apex', brand_name: 'Apex Footwear', budget: 150000, commission_rate: 10, active: true, clicks: 5800, revenue: 637000, start_date: '2026-05-15', end_date: '2026-07-15' },
      { id: 'cp_02', title: 'Walton Home Smart-Upgrade Eid campaign', brand_id: 'brand_walton', brand_name: 'Walton Appliances', budget: 300000, commission_rate: 10, active: true, clicks: 3100, revenue: 1019660, start_date: '2026-05-01', end_date: '2026-06-30' },
      { id: 'cp_03', title: 'Traditional Silk Panjabi Fest', brand_id: 'brand_aarong', brand_name: 'Aarong Handcrafts', budget: 80000, commission_rate: 7, active: false, clicks: 1240, revenue: 350000, start_date: '2026-04-01', end_date: '2026-04-30' }
    ];
  });

  const [creatorPayouts, setCreatorPayouts] = useState<CreatorPayout[]>(() => {
    const saved = localStorage.getItem('choosify_creator_payouts');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'po_01', creator_id: 'creator_rafsan', creator_name: 'Rafsan The Chotobhai', amount: 45000, status: 'paid', channel: 'bKash Merchant', created_at: '2026-06-01T15:00:00Z' },
      { id: 'po_02', creator_id: 'creator_rafsan', creator_name: 'Rafsan The Chotobhai', amount: 18700, status: 'pending', channel: 'Bank Transfer (City Bank)', created_at: '2026-06-12T10:30:00Z' },
      { id: 'po_03', creator_id: 'creator_khalid', creator_name: 'Khalid Farhan', amount: 101966, status: 'pending', channel: 'Bank Transfer (BRAC)', created_at: '2026-06-12T11:45:00Z' }
    ];
  });

  const creatorTiers: CreatorTier[] = [
    { id: 'tier_01', name: 'Verified Creator', min_points: 0, commission_boost: 0, perks: ['Trust Badge icon', 'Basic Campaign Invite'] },
    { id: 'tier_02', name: 'Premium Creator', min_points: 200, commission_boost: 1.5, perks: ['Verification priority', 'Co-branded banners', 'Auto-affiliate triggers'] },
    { id: 'tier_03', name: 'Partner Creator', min_points: 500, commission_boost: 3.0, perks: ['Direct Brand Verification lobbying', 'VVIP Priority Support', '5% Platform commission discount'] }
  ];

  // 8. UNIFIED MODERATION ENGINE CODES
  const [reports, setReports] = useState<ModeratorReport[]>(() => {
    const saved = localStorage.getItem('choosify_reports');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'rep_001', entity_type: 'reviews', entity_id: 'rev_bad_01', entity_name: 'Apex Oxfords Review by fraud_user', reporter_name: 'Apex Review Audit System', flag_type: 'Fake Review', details: 'Identical product ratings submitted from same subnet 103.220.30 within 4 seconds.', status: 'Pending', created_at: '2026-06-12T14:10:00Z' },
      { id: 'rep_002', entity_type: 'products', entity_id: '103', entity_name: 'Samsung S25 Ultra Silicate Casing', reporter_name: 'Ziaul Hoque (IP Attorney)', flag_type: 'Copyright Issue', details: 'Unlawful use of official Samsung trademarks on retail casing listing. Matches copyright infringement code CIP-882.', status: 'In Investigation', created_at: '2026-06-11T11:30:00Z' },
      { id: 'rep_003', entity_type: 'recommendations', entity_id: 'rec_02', entity_name: 'Rafsans Favorite Daily Formal Shoe', reporter_name: 'Moderation Bot', flag_type: 'Misleading Information', details: 'Link redirects to broken seller subdomain page, flagged automatically.', status: 'Resolved', created_at: '2026-06-05T09:12:00Z' }
    ];
  });

  const [contentFlags, setContentFlags] = useState<ContentFlag[]>(() => {
    const saved = localStorage.getItem('choosify_content_flags');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'flg_01', entity_type: 'sellers', entity_id: 'seller_techzone', entity_name: 'TechZone BD', flag_type: 'Suspicious Activity', severity: 'High', flagged_by: 'Platform Bot', created_at: '2026-06-10T14:20:00Z' },
      { id: 'flg_02', entity_type: 'reviews', entity_id: 'rev_bad_01', entity_name: 'Apex Oxfords Review', flag_type: 'Fake Review', severity: 'Medium', flagged_by: 'Staff System', created_at: '2026-06-12T14:10:00Z' }
    ];
  });

  const [moderationActions, setModerationActions] = useState<ModerationAction[]>(() => {
    const saved = localStorage.getItem('choosify_mod_actions');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'mact_01', report_id: 'rep_003', entity_type: 'recommendations', entity_id: 'rec_02', action_taken: 'Audit Storefront', acted_by: 'usr_admin_001', notes: 'Verified redirect. Re-anchored to authenticated seller link.', enacted_at: '2026-06-05T14:00:00Z' }
    ];
  });

  const [moderationRules, setModerationRules] = useState<ModerationRule[]>(() => {
    const saved = localStorage.getItem('choosify_mod_rules');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'rule_01', name: 'Automatic Fake Review Detection', trigger_event: 'review_submitted', condition: 'identical_ip_burst_10s > 2', auto_action: 'Block Review & Flag Creator', active: true },
      { id: 'rule_02', name: 'High Return Rate Alerts', trigger_event: 'order_returned', condition: 'return_ratio_30d > 18%', auto_action: 'Generate High Return Rate Trust Alert', active: true },
      { id: 'rule_03', name: 'Auto Suspicious Seller Sandbox', trigger_event: 'trust_score_drop', condition: 'score < 50', auto_action: 'Suspend Account & Flag', active: false }
    ];
  });

  // 9. PHASE 7 ANALYTICS WAREHOUSE - SEEDED STORES DATA AGGREGATES
  const dailyPlatformMetrics: DailyPlatformMetrics[] = [
    { date: 'June 08', total_revenue: 85000, orders_count: 24, avg_trust_score: 91, active_creators: 18, active_brands: 12 },
    { date: 'June 09', total_revenue: 92000, orders_count: 28, avg_trust_score: 90, active_creators: 19, active_brands: 12 },
    { date: 'June 10', total_revenue: 71000, orders_count: 14, avg_trust_score: 87, active_creators: 18, active_brands: 12 },
    { date: 'June 11', total_revenue: 110000, orders_count: 32, avg_trust_score: 89, active_creators: 21, active_brands: 13 },
    { date: 'June 12', total_revenue: 145000, orders_count: 41, avg_trust_score: 92, active_creators: 22, active_brands: 14 }
  ];

  const dailyBrandMetrics: DailyBrandMetrics[] = [
    { date: 'June 12', brand_id: 'brand_aarong', brand_name: 'Aarong Handcrafts', trust_score: 96, total_spend: 350000, clicks: 2300, revenue: 369600 },
    { date: 'June 12', brand_id: 'brand_apex', brand_name: 'Apex Footwear', trust_score: 92, total_spend: 280000, clicks: 5800, revenue: 637000 }
  ];

  const dailyCreatorMetrics: DailyCreatorMetrics[] = [
    { date: 'June 12', creator_id: 'creator_rafsan', creator_name: 'Rafsan The Chotobhai', shares: 480, clicks: 5800, payout_accrued: 63700, conversion_rate: 3.1 },
    { date: 'June 12', creator_id: 'creator_khalid', creator_name: 'Khalid Farhan', shares: 205, clicks: 3100, payout_accrued: 101966, conversion_rate: 1.1 }
  ];

  const dailyProductMetrics: DailyProductMetrics[] = [
    { date: 'June 12', product_id: '101', product_name: 'Aarong Silk Panjabi', views: 12500, conversions: 88, trust_index: 96 },
    { date: 'June 12', product_id: '102', product_name: 'Apex Mens Formal Leather', views: 24000, conversions: 182, trust_index: 92 }
  ];

  const dailyOrderMetrics: DailyOrderMetrics[] = [
    { date: 'June 08', total_retail: 37000, cancellations: 1, returns: 0 },
    { date: 'June 09', total_retail: 41000, cancellations: 4, returns: 1 },
    { date: 'June 10', total_retail: 41000, cancellations: 2, returns: 2 },
    { date: 'June 11', total_retail: 45000, cancellations: 0, returns: 0 },
    { date: 'June 12', total_retail: 65000, cancellations: 1, returns: 1 }
  ];

  // ============================================================================
  // STORAGE SINK EFFECT CODES
  // ============================================================================
  useEffect(() => {
    localStorage.setItem('choosify_reputation_ledger', JSON.stringify(reputationLedger));
  }, [reputationLedger]);

  useEffect(() => {
    localStorage.setItem('choosify_trust_scores', JSON.stringify(trustScores));
  }, [trustScores]);

  useEffect(() => {
    localStorage.setItem('choosify_trust_snapshots', JSON.stringify(trustScoreSnapshots));
  }, [trustScoreSnapshots]);

  useEffect(() => {
    localStorage.setItem('choosify_trust_alerts', JSON.stringify(trustAlerts));
  }, [trustAlerts]);

  useEffect(() => {
    localStorage.setItem('choosify_verifications', JSON.stringify(verificationRequests));
  }, [verificationRequests]);

  useEffect(() => {
    localStorage.setItem('choosify_recommendations', JSON.stringify(recommendationMetrics));
  }, [recommendationMetrics]);

  useEffect(() => {
    localStorage.setItem('choosify_partnerships', JSON.stringify(partnerships));
  }, [partnerships]);

  useEffect(() => {
    localStorage.setItem('choosify_campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem('choosify_creator_payouts', JSON.stringify(creatorPayouts));
  }, [creatorPayouts]);

  useEffect(() => {
    localStorage.setItem('choosify_reports', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('choosify_content_flags', JSON.stringify(contentFlags));
  }, [contentFlags]);

  useEffect(() => {
    localStorage.setItem('choosify_mod_actions', JSON.stringify(moderationActions));
  }, [moderationActions]);

  useEffect(() => {
    localStorage.setItem('choosify_mod_rules', JSON.stringify(moderationRules));
  }, [moderationRules]);


  // ============================================================================
  // SERVICE ENGINE METHODS IMPLEMENTATION
  // ============================================================================

  // Method 1: Add raw trust entry to database ledgers & trigger score recalculations
  const addTrustEvent = (
    entity_type: TrustEntityType,
    entity_id: string,
    entity_name: string,
    event_type: TrustEventType,
    points: number,
    metadata: Record<string, any>
  ) => {
    const entryId = 'ev_' + Math.floor(100000 + Math.random() * 900000);
    const newEntry: ReputationLedgerEntry = {
      id: entryId,
      entity_type,
      entity_id,
      entity_name,
      event_type,
      points,
      metadata_json: JSON.stringify(metadata),
      created_at: new Date().toISOString()
    };

    setReputationLedger(prev => [newEntry, ...prev]);

    // Recalculate score instantly!
    setTrustScores(prev => {
      const match = prev.find(s => s.entity_id === entity_id && s.entity_type === entity_type);
      
      // Calculate from this ledger and potential historical ledger entries
      const scoreId = match ? match.id : ('ts_' + Math.random().toString().substr(2, 5));
      const currentScoreObj = match || {
        id: scoreId,
        entity_type,
        entity_id,
        entity_name,
        current_score: 90,
        last_updated: new Date().toISOString(),
        quality: 90,
        delivery: 90,
        service: 90,
        returns: 90,
        complaints: 90,
        recommendations: 90
      };

      // Recalculate score formula based on auditable events 
      // Base score = 90
      // We sum up points:
      const entityLogs = [newEntry, ...reputationLedger].filter(l => l.entity_id === entity_id && l.entity_type === entity_type);
      const pointsTotal = entityLogs.reduce((acc, current) => acc + current.points, 0);
      let calculatedBase = 90 + pointsTotal;
      calculatedBase = Math.max(0, Math.min(100, calculatedBase));

      // Balance breakdowns transparently
      const serviceDelta = event_type === 'complaint_received' ? -15 : (event_type === 'complaint_resolved' ? 10 : 0);
      const deliveryDelta = event_type === 'delivery_failure' ? -10 : (event_type === 'order_delivered' ? 2 : 0);
      const qualityDelta = event_type === 'fake_review_detected' ? -25 : (event_type === 'review_verified' ? 4 : 0);

      const nextScore: TrustScore = {
        ...currentScoreObj,
        current_score: calculatedBase,
        quality: Math.max(0, Math.min(100, currentScoreObj.quality + qualityDelta)),
        delivery: Math.max(0, Math.min(100, currentScoreObj.delivery + deliveryDelta)),
        service: Math.max(0, Math.min(100, currentScoreObj.service + serviceDelta)),
        last_updated: new Date().toISOString()
      };

      // Add a snapshot point to track timeline trends!
      setTrustScoreSnapshots(historical => [
        ...historical,
        {
          id: 'sn_' + Math.random().toString(),
          entity_type,
          entity_id,
          score: calculatedBase,
          calculated_at: new Date().toISOString()
        }
      ]);

      // Check for automated rule engines (Phase 9)
      if (calculatedBase < 75 && points < 0) {
        generateTrustAlert(
          entity_type,
          entity_id,
          entity_name,
          'Suspicious Seller Activity',
          'High',
          `Automated rule alert: Trust Score dropped to ${calculatedBase} after negative reputation event: ${event_type}`
        );
      }

      if (event_type === 'fake_review_detected') {
        generateTrustAlert(
          entity_type,
          entity_id,
          entity_name,
          'Fake Review Detection',
          'Critical',
          `Automatic trigger: Multiple deceptive interactions found in verified reviews ledger.`
        );
      }

      if (event_type === 'cancellation_rate_high') {
        generateTrustAlert(
          entity_type,
          entity_id,
          entity_name,
          'High Cancellation Rate',
          'Critical',
          `Risk Rule breached: Buyer cancels above 45% of orders.`
        );
      }

      if (event_type === 'return_rate_high') {
        generateTrustAlert(
          entity_type,
          entity_id,
          entity_name,
          'High Return Rate',
          'Medium',
          `Breached Return rate: Seller return rate is above normal 15% threshold.`
        );
      }

      if (match) {
        return prev.map(s => s.id === match.id ? nextScore : s);
      } else {
        return [...prev, nextScore];
      }
    });
  };

  // Explicit calculation method
  const calculateTrustScore = (entity_type: TrustEntityType, entity_id: string) => {
    return trustScores.find(s => s.entity_id === entity_id && s.entity_type === entity_type);
  };

  // Method 2: Dispatches a high value automated trust warning alert
  const generateTrustAlert = (
    entity_type: TrustEntityType,
    entity_id: string,
    entity_name: string,
    alert_type: TrustAlert_Type,
    severity: SeverityType,
    message: string
  ) => {
    const alertId = 'al_' + Math.floor(100000 + Math.random() * 900000);
    const newAlert: TrustAlert = {
      id: alertId,
      entity_type,
      entity_id,
      entity_name,
      alert_type,
      severity,
      message,
      status: 'unresolved',
      created_at: new Date().toISOString()
    };
    setTrustAlerts(prev => [newAlert, ...prev]);
  };

  const resolveTrustAlert = (alert_id: string) => {
    setTrustAlerts(prev => prev.map(a => a.id === alert_id ? { ...a, status: 'resolved', resolved_at: new Date().toISOString() } : a));
  };


  // ============================================================================
  // PHASE 3: BRAND VERIFICATION PROCESS PIPELINE CODES
  // ============================================================================
  const createVerificationRequest = (brand_id: string, brand_name: string, logo: string) => {
    const newReq: VerificationRequest = {
      id: 'vr_' + Math.floor(100000 + Math.random() * 900000),
      brand_id,
      brand_name,
      logo_url: logo,
      submitted_by: 'Authorized Brand Agent',
      status: 'Draft',
      documents: [
        { id: 'doc_u_' + Math.random(), type: 'Trade License', name: 'Trade_License_Upload.pdf', doc_url: '#', status: 'pending' },
        { id: 'doc_u_' + Math.random(), type: 'Business Registration', name: 'Registration_Cert.pdf', doc_url: '#', status: 'pending' }
      ],
      reviews: [],
      audit_trail: [
        { timestamp: new Date().toISOString(), action: 'Draft Created', actor: 'Brand Manager', details: 'Initialized a draft verification dossier' }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setVerificationRequests(prev => [newReq, ...prev]);
  };

  const submitVerificationRequest = (request_id: string) => {
    setVerificationRequests(prev => prev.map(r => {
      if (r.id === request_id) {
        return {
          ...r,
          status: 'Submitted',
          audit_trail: [
            ...r.audit_trail,
            { timestamp: new Date().toISOString(), action: 'Form Submitted', actor: 'Brand Agent', details: 'Dossier dispatched to lead auditor verification queue' }
          ],
          updated_at: new Date().toISOString()
        };
      }
      return r;
    }));
  };

  const updateDocumentStatus = (request_id: string, doc_id: string, status: 'approved' | 'rejected', notes?: string) => {
    setVerificationRequests(prev => prev.map(r => {
      if (r.id === request_id) {
        const docs = r.documents.map(d => d.id === doc_id ? { ...d, status, notes } : d);
        return {
          ...r,
          documents: docs,
          audit_trail: [
            ...r.audit_trail,
            { timestamp: new Date().toISOString(), action: 'Document Audited', actor: 'Administrative Auditor', details: `Document item state updated to ${status}. Notes: ${notes || 'none'}` }
          ],
          updated_at: new Date().toISOString()
        };
      }
      return r;
    }));
  };

  const reviewVerificationRequest = (
    request_id: string,
    reviewer_id: string,
    reviewer_name: string,
    status: 'approved' | 'rejected',
    feedback: string
  ) => {
    const rvwId = 'rvw_' + Math.floor(10000 + Math.random() * 90000);
    const newRvw: VerificationReview = {
      id: rvwId,
      reviewer_id,
      reviewer_name,
      status,
      feedback,
      reviewed_at: new Date().toISOString()
    };

    setVerificationRequests(prev => prev.map(r => {
      if (r.id === request_id) {
        const finalStatus = status === 'approved' ? 'Approved' : 'Rejected';
        
        // If approved, trigger brand's base reputation score addition!
        if (status === 'approved') {
          addTrustEvent('brand', r.brand_id, r.brand_name, 'review_verified', 15, { reason: 'Passed Enterprise Brand Verification Audit.' });
        }

        return {
          ...r,
          status: finalStatus,
          reviews: [...r.reviews, newRvw],
          audit_trail: [
            ...r.audit_trail,
            { timestamp: new Date().toISOString(), action: status === 'approved' ? 'Audit Approved' : 'Audit Rejected', actor: reviewer_name, details: `Verification finalized: ${feedback}` }
          ],
          updated_at: new Date().toISOString()
        };
      }
      return r;
    }));
  };


  // ============================================================================
  // PHASE 4: RECOMMENDATION ATTRIBUTION LOGGERS
  // ============================================================================
  const logRecommendationActivity = (recommendation_id: string, activity: 'view' | 'click' | 'save' | 'share' | 'conversion') => {
    setRecommendationMetrics(prev => prev.map(r => {
      if (r.id === recommendation_id) {
        const next = { ...r };
        if (activity === 'view') next.views += 1;
        if (activity === 'click') next.clicks += 1;
        if (activity === 'save') next.saves += 1;
        if (activity === 'share') next.shares += 1;
        if (activity === 'conversion') {
          next.conversions += 1;
          const commissionMultiplier = r.type === 'creator' ? 0.1 : 0;
          const productPrice = 3500; // estimated price factor BDT
          next.revenue += productPrice;
          next.creator_earnings += Math.round(productPrice * commissionMultiplier);
        }
        return next;
      }
      return r;
    }));
  };


  // ============================================================================
  // PHASE 5: CREATOR ECONOMY EXPANSION ACTIONS
  // ============================================================================
  const proposePartnership = (creator_id: string, creator_name: string, brand_id: string, brand_name: string) => {
    const pId = 'pt_' + Math.floor(100000 + Math.random() * 900000);
    const newP: CreatorBrandPartnership = {
      id: pId,
      creator_id,
      creator_name,
      brand_id,
      brand_name,
      status: 'Pending',
      revenue_generated: 0,
      created_at: new Date().toISOString()
    };
    setPartnerships(prev => [...prev, newP]);
  };

  const updatePartnershipStatus = (partnership_id: string, status: 'Active' | 'Terminated') => {
    setPartnerships(prev => prev.map(p => p.id === partnership_id ? { ...p, status } : p));
  };

  const createCampaign = (
    brand_id: string,
    brand_name: string,
    title: string,
    budget: number,
    rate: number,
    start: string,
    end: string
  ) => {
    const cpId = 'cp_' + Math.floor(100000 + Math.random() * 900000);
    const newCp: CreatorCampaign = {
      id: cpId,
      title,
      brand_id,
      brand_name,
      budget,
      commission_rate: rate,
      active: true,
      clicks: 0,
      revenue: 0,
      start_date: start,
      end_date: end
    };
    setCampaigns(prev => [newCp, ...prev]);
  };

  const processCreatorPayout = (payout_id: string) => {
    setCreatorPayouts(prev => prev.map(p => p.id === payout_id ? { ...p, status: 'paid' } : p));
  };


  // ============================================================================
  // PHASE 6: MODERATION SYSTEM ACTIONS
  // ============================================================================
  const submitReport = (
    entity_type: ModeratableEntityType,
    entity_id: string,
    entity_name: string,
    reporter: string,
    flag: FlagType,
    details: string
  ) => {
    const repId = 'rep_' + Math.floor(100000 + Math.random() * 900000);
    const newRep: ModeratorReport = {
      id: repId,
      entity_type,
      entity_id,
      entity_name,
      reporter_name: reporter,
      flag_type: flag,
      details,
      status: 'Pending',
      created_at: new Date().toISOString()
    };
    setReports(prev => [newRep, ...prev]);
    
    // Add lightweight flag indicators
    addContentFlag(entity_type, entity_id, entity_name, flag, 'Medium', reporter);
  };

  const addContentFlag = (
    entity_type: ModeratableEntityType,
    entity_id: string,
    entity_name: string,
    flag_type: FlagType,
    severity: SeverityType,
    flagged_by: string
  ) => {
    const flgId = 'flg_' + Math.floor(100000 + Math.random() * 900000);
    const newFlg: ContentFlag = {
      id: flgId,
      entity_type,
      entity_id,
      entity_name,
      flag_type,
      severity,
      flagged_by,
      created_at: new Date().toISOString()
    };
    setContentFlags(prev => [newFlg, ...prev]);
  };

  const takeModerationAction = (
    report_id: string,
    entity_type: ModeratableEntityType,
    entity_id: string,
    action: 'Suspend Account' | 'Remove Content' | 'Issue Warning' | 'Audit Storefront' | 'Dismiss Case',
    actor: string,
    notes: string
  ) => {
    const actId = 'mact_' + Math.floor(100000 + Math.random() * 900000);
    const newAct: ModerationAction = {
      id: actId,
      report_id,
      entity_type,
      entity_id,
      action_taken: action,
      acted_by: actor,
      notes,
      enacted_at: new Date().toISOString()
    };

    setModerationActions(prev => [newAct, ...prev]);

    // Update original report status
    setReports(prev => prev.map(r => r.id === report_id ? { ...r, status: action === 'Dismiss Case' ? 'Dismissed' : 'Resolved' } : r));

    // Handle consequences on the trust score ledger if severe penalty
    let scorePoints = -5;
    let eventType: TrustEventType = 'review_removed';
    
    if (action === 'Suspend Account') {
      scorePoints = -40;
      eventType = 'account_suspended';
    } else if (action === 'Remove Content') {
      scorePoints = -10;
      eventType = 'review_removed';
    } else if (action === 'Issue Warning') {
      scorePoints = -5;
      eventType = 'creator_violation';
    }

    // Determine representative type
    let mappedTrustEntityType: TrustEntityType = 'brand';
    if (entity_type === 'sellers') mappedTrustEntityType = 'seller';
    else if (entity_type === 'creators') mappedTrustEntityType = 'creator';
    
    // Dispatch trust event consequence as well!
    addTrustEvent(
      mappedTrustEntityType,
      entity_id,
      `Moderated Node: ${entity_id}`,
      eventType,
      scorePoints,
      { details: `Administrative action taken: ${action}. Notes: ${notes}` }
    );
  };

  const toggleModerationRule = (rule_id: string) => {
    setModerationRules(prev => prev.map(r => r.id === rule_id ? { ...r, active: !r.active } : r));
  };

  const logDisputeImpact = (
    entity_id: string,
    entity_name: string,
    entity_type: TrustEntityType,
    impactType: 'created' | 'escalated' | 'resolved_against' | 'dismissed'
  ) => {
    let eventType: TrustEventType = 'complaint_received';
    let points = 0;
    let details = '';

    if (impactType === 'created') {
      points = -5;
      eventType = 'complaint_received';
      details = `Dispute opened against ${entity_name}`;
    } else if (impactType === 'escalated') {
      points = -10;
      eventType = 'complaint_received';
      details = `Dispute escalated for ${entity_name}`;
    } else if (impactType === 'resolved_against') {
      points = -20;
      eventType = 'complaint_received';
      details = `Dispute resolved against ${entity_name}`;
    } else if (impactType === 'dismissed') {
      points = 15;
      eventType = 'complaint_resolved';
      details = `Dispute dismissed or resolved in favor of ${entity_name}`;
    }

    addTrustEvent(entity_type, entity_id, entity_name, eventType, points, { details });
  };


  return (
    <TrustContext.Provider value={{
      reputationLedger,
      trustScores,
      trustScoreSnapshots,
      trustAlerts,
      
      verificationRequests,
      recommendationMetrics,
      
      partnerships,
      campaigns,
      creatorPayouts,
      creatorTiers,
      
      reports,
      contentFlags,
      moderationActions,
      moderationRules,

      dailyPlatformMetrics,
      dailyBrandMetrics,
      dailyCreatorMetrics,
      dailyProductMetrics,
      dailyOrderMetrics,

      addTrustEvent,
      logDisputeImpact,
      calculateTrustScore,
      generateTrustAlert,
      resolveTrustAlert,

      createVerificationRequest,
      submitVerificationRequest,
      updateDocumentStatus,
      reviewVerificationRequest,

      logRecommendationActivity,

      proposePartnership,
      updatePartnershipStatus,
      createCampaign,
      processCreatorPayout,

      submitReport,
      addContentFlag,
      takeModerationAction,
      toggleModerationRule
    }}>
      {children}
    </TrustContext.Provider>
  );
};
