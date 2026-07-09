export const MODERATION_QUEUES = {
  PRODUCTS: 'products',
  BRANDS: 'brands',
  SELLERS: 'sellers',
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
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
};

export type ReportItem = {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  reporterId?: string;
  reporterRole?: string;
  description?: string;
  assignedModeratorId?: string;
  resolution?: ModerationDecision;
  resolutionReason?: ModerationReason;
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
