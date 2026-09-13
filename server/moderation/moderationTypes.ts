export const MODERATION_QUEUES = {
  PRODUCTS: 'products',
  BRANDS: 'brands',
  SELLERS: 'sellers',
  CREATORS: 'creators',
  GUIDES: 'guides',
  CAMPAIGNS: 'campaigns',
  REVIEWS: 'reviews',
  REPORTS: 'reports',
  MEDIA: 'media',
} as const;

export type ModerationQueueType = (typeof MODERATION_QUEUES)[keyof typeof MODERATION_QUEUES];

export const MODERATION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
  ASSIGNED: 'assigned',
  ARCHIVED: 'archived',
} as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[keyof typeof MODERATION_STATUSES];

export const MODERATION_DECISIONS = {
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUEST_CHANGES: 'request_changes',
  ESCALATE: 'escalate',
  DISMISS: 'dismiss',
  REVOKE: 'revoke',
} as const;

export type ModerationDecision = (typeof MODERATION_DECISIONS)[keyof typeof MODERATION_DECISIONS];

export const MODERATION_REASONS = {
  POLICY_VIOLATION: 'policy_violation',
  SPAM: 'spam',
  COUNTERFEIT: 'counterfeit',
  MISLEADING: 'misleading',
  COPYRIGHT: 'copyright',
  FRAUD: 'fraud',
  QUALITY: 'quality',
  INCOMPLETE: 'incomplete',
  OTHER: 'other',
} as const;

export type ModerationReason = (typeof MODERATION_REASONS)[keyof typeof MODERATION_REASONS];

export const REPORT_CATEGORIES = {
  SPAM: 'spam',
  FAKE_PRODUCT: 'fake_product',
  COUNTERFEIT: 'counterfeit',
  ABUSE: 'abuse',
  COPYRIGHT: 'copyright',
  INCORRECT_INFORMATION: 'incorrect_information',
  FRAUD: 'fraud',
  OTHER: 'other',
} as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[keyof typeof REPORT_CATEGORIES];

export const REPORT_STATUSES = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const;

export type ReportStatus = (typeof REPORT_STATUSES)[keyof typeof REPORT_STATUSES];

export const VERIFICATION_STATUSES = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
} as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[keyof typeof VERIFICATION_STATUSES];

export const FRAUD_SIGNAL_TYPES = {
  VELOCITY_SPIKE: 'velocity_spike',
  DUPLICATE_LISTING: 'duplicate_listing',
  SUSPICIOUS_PRICING: 'suspicious_pricing',
  REVIEW_MANIPULATION: 'review_manipulation',
  IDENTITY_MISMATCH: 'identity_mismatch',
  CHARGEBACK_PATTERN: 'chargeback_pattern',
  OTHER: 'other',
} as const;

export type FraudSignalType = (typeof FRAUD_SIGNAL_TYPES)[keyof typeof FRAUD_SIGNAL_TYPES];

/**
 * One immutable entry in a ModerationItem's decision history. Actions are
 * appended, never edited or removed -- this is the auditable trail behind
 * "revoke" (which reverses a decision without erasing that it happened).
 */
export type ModerationHistoryEntry = {
  id: string;
  action: 'approve' | 'reject' | 'request_changes' | 'revoke' | 'assign';
  actorId?: string;
  actorName?: string;
  previousStatus: ModerationStatus;
  newStatus: ModerationStatus;
  reason?: ModerationReason;
  notes?: string;
  /** For an 'assign' entry: who it was assigned to (may differ from actor). */
  assignedToId?: string;
  assignedToName?: string;
  /** For a 'revoke' entry: which prior history entry it reverses. */
  revokesEntryId?: string;
  timestamp: string;
};

export type ModerationItem = {
  id: string;
  queue: ModerationQueueType;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  status: ModerationStatus;
  priority: number;
  assignedModeratorId?: string;
  assignedModeratorName?: string;
  reason?: ModerationReason;
  notes?: string;
  history: ModerationHistoryEntry[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
};

export const REPORT_SOURCES = {
  STOREFRONT: 'storefront',
  SELLER_DASHBOARD: 'seller_dashboard',
  CREATOR_DASHBOARD: 'creator_dashboard',
  CONSUMER_ACCOUNT: 'consumer_account',
  ADMIN: 'admin',
} as const;

export type ReportSource = (typeof REPORT_SOURCES)[keyof typeof REPORT_SOURCES];

export type ReportItem = {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  /** The seller/creator/account that owns the reported entity, when known --
   *  distinct from resourceId itself (e.g. reporting a product records both
   *  the product id AND the seller who owns it). Never fabricated: left
   *  undefined when ownership can't be resolved server-side. */
  resourceOwnerId?: string;
  reporterId?: string;
  reporterRole?: string;
  /** Where the report was filed from -- storefront, a seller/creator's own
   *  dashboard, a consumer's account, or created directly by an admin. */
  source?: ReportSource;
  description?: string;
  assignedModeratorId?: string;
  assignedModeratorName?: string;
  /** Staff-only investigation note -- never shown to the reporter or the
   *  reported party. Distinct from `description` (reporter's own words) and
   *  `resolutionNote` (explanation of how it was closed out). */
  internalNotes?: string;
  /** If this report led to (or already concerns) a real moderation queue
   *  item, link to it instead of duplicating moderation state here. */
  linkedModerationItemId?: string;
  resolution?: ModerationDecision;
  resolutionReason?: ModerationReason;
  resolutionNote?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type VerificationHistoryEntry = {
  id: string;
  sellerId: string;
  status: VerificationStatus;
  changedBy?: string;
  reason?: string;
  notes?: string;
  timestamp: string;
};

export type SellerVerification = {
  id: string;
  sellerId: string;
  sellerName?: string;
  status: VerificationStatus;
  documentsSubmitted: number;
  verifiedAt?: string;
  expiresAt?: string;
  rejectedReason?: string;
  history: VerificationHistoryEntry[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FraudSignal = {
  id: string;
  signalType: FraudSignalType;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  metadata?: Record<string, unknown>;
  detectedAt: string;
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type TrustScoreComponent = {
  key: string;
  label: string;
  value: number;
  weight: number;
  weightedScore: number;
  source: 'computed' | 'placeholder';
  notes?: string;
};

export type TrustScore = {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  score: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: TrustScoreComponent[];
  calculatedAt: string;
};

export type ReputationScore = {
  sellerId: string;
  sellerName?: string;
  score: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  reviewRating: number | null;
  complaintCount: number;
  approvalRate: number | null;
  responseTimeHours: number | null;
  orderSuccessRate: number | null;
  accountAgeDays: number | null;
  verificationStatus: VerificationStatus;
  components: TrustScoreComponent[];
  calculatedAt: string;
};

export type ModerationQueueFilter = {
  queue?: ModerationQueueType;
  status?: ModerationStatus;
  assignedModeratorId?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
};

export type ModerationSummary = {
  queues: Record<
    ModerationQueueType,
    {
      pending: number;
      approved: number;
      rejected: number;
      needsReview: number;
      assigned: number;
      total: number;
    }
  >;
  reports: {
    open: number;
    investigating: number;
    resolved: number;
    dismissed: number;
    total: number;
  };
  verifications: {
    pending: number;
    verified: number;
    rejected: number;
    suspended: number;
    expired: number;
    total: number;
  };
  fraudSignals: {
    unreviewed: number;
    total: number;
  };
  generatedAt: string;
};

export type QueueItemInput = {
  queue: ModerationQueueType;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  priority?: number;
  reason?: ModerationReason;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type ModerationActionContext = {
  moderatorId?: string;
  moderatorName?: string;
  reason?: ModerationReason;
  notes?: string;
  requestId?: string;
};
