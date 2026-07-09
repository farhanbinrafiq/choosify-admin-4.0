import { operationsStore } from '../operations/operationsStore';
import { moderationStore } from './moderationStore';
import type {
  ReputationScore,
  TrustScore,
  TrustScoreComponent,
  VerificationStatus,
} from './moderationTypes';
import { VERIFICATION_STATUSES } from './moderationTypes';

function gradeFromScore(score: number, maxScore: number): ReputationScore['grade'] {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.9) return 'A';
  if (ratio >= 0.75) return 'B';
  if (ratio >= 0.6) return 'C';
  if (ratio >= 0.45) return 'D';
  return 'F';
}

function normalizeSeller(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function sellerReviews(sellerId: string, sellerName?: string) {
  const id = normalizeSeller(sellerId);
  const name = normalizeSeller(sellerName);
  return operationsStore.listReviews().filter((review) => {
    const store = normalizeSeller(review.storeName);
    const brand = normalizeSeller(review.brandName);
    return store.includes(id) || brand.includes(id) || (name && (store.includes(name) || brand.includes(name)));
  });
}

function sellerReports(sellerId: string) {
  return moderationStore.listReports().filter(
    (report) => report.resourceType === 'seller' && report.resourceId === sellerId,
  );
}

function sellerModerationItems(sellerId: string) {
  return moderationStore.listItems({ resourceType: 'seller', limit: 500 }).filter(
    (item) => item.resourceId === sellerId,
  );
}

function averageReviewRating(reviews: ReturnType<typeof operationsStore.listReviews>): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

function approvalRate(items: ReturnType<typeof moderationStore.listItems>): number | null {
  const decided = items.filter((item) => item.status === 'approved' || item.status === 'rejected');
  if (decided.length === 0) return null;
  const approved = decided.filter((item) => item.status === 'approved').length;
  return Math.round((approved / decided.length) * 1000) / 10;
}

function buildComponent(
  key: string,
  label: string,
  value: number,
  weight: number,
  source: TrustScoreComponent['source'],
  notes?: string,
): TrustScoreComponent {
  const weightedScore = Math.round(value * weight * 10) / 10;
  return { key, label, value, weight, weightedScore, source, notes };
}

export function calculateSellerReputation(
  sellerId: string,
  sellerName?: string,
  accountCreatedAt?: string,
): ReputationScore {
  const reviews = sellerReviews(sellerId, sellerName);
  const reports = sellerReports(sellerId);
  const moderationItems = sellerModerationItems(sellerId);
  const verification = moderationStore.getVerification(sellerId);

  const reviewRating = averageReviewRating(reviews);
  const complaintCount = reports.filter((r) => r.status !== 'dismissed').length;
  const approvalRateValue = approvalRate(moderationItems);
  const verificationStatus: VerificationStatus =
    verification?.status ?? VERIFICATION_STATUSES.PENDING;

  // TODO: Wire seller response-time telemetry when messaging SLA metrics are available.
  const responseTimeHours: number | null = null;

  // TODO: Wire order success rate from operations order fulfillment telemetry.
  const orderSuccessRate: number | null = null;

  let accountAgeDays: number | null = null;
  if (accountCreatedAt) {
    accountAgeDays = Math.floor(
      (Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
  } else if (verification?.createdAt) {
    accountAgeDays = Math.floor(
      (Date.now() - new Date(verification.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  const components: TrustScoreComponent[] = [];

  if (reviewRating !== null) {
    const normalized = (reviewRating / 5) * 100;
    components.push(buildComponent('review_rating', 'Review Rating', normalized, 0.25, 'computed'));
  } else {
    components.push(
      buildComponent('review_rating', 'Review Rating', 0, 0.25, 'placeholder', 'No reviews available'),
    );
  }

  const complaintPenalty = Math.max(0, 100 - complaintCount * 10);
  components.push(
    buildComponent(
      'complaint_count',
      'Complaint Score',
      complaintPenalty,
      0.2,
      'computed',
      `${complaintCount} active complaints`,
    ),
  );

  if (approvalRateValue !== null) {
    components.push(
      buildComponent('approval_rate', 'Approval Rate', approvalRateValue, 0.15, 'computed'),
    );
  } else {
    components.push(
      buildComponent(
        'approval_rate',
        'Approval Rate',
        50,
        0.15,
        'placeholder',
        'No moderation decisions yet',
      ),
    );
  }

  components.push(
    buildComponent(
      'response_time',
      'Response Time',
      responseTimeHours !== null ? Math.max(0, 100 - responseTimeHours) : 50,
      0.1,
      responseTimeHours !== null ? 'computed' : 'placeholder',
      responseTimeHours === null ? 'Awaiting messaging SLA telemetry' : undefined,
    ),
  );

  components.push(
    buildComponent(
      'order_success',
      'Order Success',
      orderSuccessRate ?? 50,
      0.15,
      orderSuccessRate !== null ? 'computed' : 'placeholder',
      orderSuccessRate === null ? 'Awaiting order fulfillment telemetry' : undefined,
    ),
  );

  if (accountAgeDays !== null) {
    const ageScore = Math.min(100, (accountAgeDays / 365) * 100);
    components.push(buildComponent('account_age', 'Account Age', ageScore, 0.1, 'computed'));
  } else {
    components.push(
      buildComponent(
        'account_age',
        'Account Age',
        0,
        0.1,
        'placeholder',
        'Account creation date unavailable',
      ),
    );
  }

  const verificationScore =
    verificationStatus === VERIFICATION_STATUSES.VERIFIED
      ? 100
      : verificationStatus === VERIFICATION_STATUSES.PENDING
        ? 40
        : verificationStatus === VERIFICATION_STATUSES.SUSPENDED
          ? 10
          : verificationStatus === VERIFICATION_STATUSES.EXPIRED
            ? 20
            : 0;
  components.push(
    buildComponent('verification_status', 'Verification Status', verificationScore, 0.05, 'computed'),
  );

  const maxScore = 100;
  const score = Math.round(
    Math.min(
      maxScore,
      components.reduce((sum, component) => sum + component.weightedScore, 0),
    ),
  );

  return {
    sellerId,
    sellerName,
    score,
    maxScore,
    grade: gradeFromScore(score, maxScore),
    reviewRating,
    complaintCount,
    approvalRate: approvalRateValue,
    responseTimeHours,
    orderSuccessRate,
    accountAgeDays,
    verificationStatus,
    components,
    calculatedAt: new Date().toISOString(),
  };
}

export function calculateTrustScore(
  entityType: string,
  entityId: string,
  entityLabel?: string,
): TrustScore {
  if (entityType === 'seller') {
    const reputation = calculateSellerReputation(entityId, entityLabel);
    return {
      entityType,
      entityId,
      entityLabel,
      score: reputation.score,
      maxScore: reputation.maxScore,
      grade: reputation.grade,
      components: reputation.components,
      calculatedAt: reputation.calculatedAt,
    };
  }

  const reports = moderationStore
    .listReports({ resourceId: entityId })
    .filter((report) => report.resourceType === entityType);
  const items = moderationStore
    .listItems({ resourceType: entityType, limit: 200 })
    .filter((item) => item.resourceId === entityId);

  const complaintCount = reports.filter((r) => r.status !== 'dismissed').length;
  const approvalRateValue = approvalRate(items);

  const components: TrustScoreComponent[] = [
    buildComponent(
      'complaint_count',
      'Complaint Score',
      Math.max(0, 100 - complaintCount * 15),
      0.4,
      'computed',
      `${complaintCount} reports`,
    ),
    buildComponent(
      'approval_rate',
      'Approval Rate',
      approvalRateValue ?? 50,
      0.35,
      approvalRateValue !== null ? 'computed' : 'placeholder',
      approvalRateValue === null ? 'No moderation history' : undefined,
    ),
    buildComponent(
      'policy_compliance',
      'Policy Compliance',
      items.some((item) => item.status === 'rejected') ? 30 : 80,
      0.25,
      'computed',
    ),
  ];

  const maxScore = 100;
  const score = Math.round(
    Math.min(maxScore, components.reduce((sum, c) => sum + c.weightedScore, 0)),
  );

  return {
    entityType,
    entityId,
    entityLabel,
    score,
    maxScore,
    grade: gradeFromScore(score, maxScore),
    components,
    calculatedAt: new Date().toISOString(),
  };
}
