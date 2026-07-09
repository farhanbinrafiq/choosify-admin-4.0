import { randomUUID } from 'crypto';
import type {
  FraudSignal,
  ModerationItem,
  ModerationQueueFilter,
  ModerationQueueType,
  ModerationStatus,
  ReportItem,
  SellerVerification,
  VerificationHistoryEntry,
  VerificationStatus,
} from './moderationTypes';
import { MODERATION_STATUSES } from './moderationTypes';

type ModerationState = {
  items: ModerationItem[];
  reports: ReportItem[];
  verifications: SellerVerification[];
  fraudSignals: FraudSignal[];
};

const state: ModerationState = {
  items: [],
  reports: [],
  verifications: [],
  fraudSignals: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function matchesStatusFilter(item: ModerationItem, status?: ModerationStatus): boolean {
  if (!status) return true;
  return item.status === status;
}

export const moderationStore = {
  listItems(filter: ModerationQueueFilter = {}): ModerationItem[] {
    let rows = [...state.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (filter.queue) {
      rows = rows.filter((item) => item.queue === filter.queue);
    }
    if (filter.status) {
      rows = rows.filter((item) => matchesStatusFilter(item, filter.status));
    }
    if (filter.assignedModeratorId) {
      rows = rows.filter((item) => item.assignedModeratorId === filter.assignedModeratorId);
    }
    if (filter.resourceType) {
      rows = rows.filter((item) => item.resourceType === filter.resourceType);
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  },

  getItem(id: string): ModerationItem | null {
    return state.items.find((item) => item.id === id) ?? null;
  },

  findItemByResource(queue: ModerationQueueType, resourceId: string): ModerationItem | null {
    return (
      state.items.find((item) => item.queue === queue && item.resourceId === resourceId) ?? null
    );
  },

  createItem(input: Omit<ModerationItem, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: ModerationStatus;
  }): ModerationItem {
    const item: ModerationItem = {
      ...input,
      id: `mod-${randomUUID()}`,
      status: input.status ?? MODERATION_STATUSES.PENDING,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.items.unshift(item);
    return item;
  },

  updateItem(id: string, patch: Partial<ModerationItem>): ModerationItem | null {
    const idx = state.items.findIndex((item) => item.id === id);
    if (idx < 0) return null;
    state.items[idx] = { ...state.items[idx], ...patch, updatedAt: nowIso() };
    return state.items[idx];
  },

  listReports(filter?: {
    status?: ReportItem['status'];
    category?: ReportItem['category'];
    resourceId?: string;
    limit?: number;
    offset?: number;
  }): ReportItem[] {
    let rows = [...state.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    if (filter?.category) rows = rows.filter((r) => r.category === filter.category);
    if (filter?.resourceId) rows = rows.filter((r) => r.resourceId === filter.resourceId);
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  },

  getReport(id: string): ReportItem | null {
    return state.reports.find((report) => report.id === id) ?? null;
  },

  createReport(input: Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: ReportItem['status'];
  }): ReportItem {
    const report: ReportItem = {
      ...input,
      id: `rpt-${randomUUID()}`,
      status: input.status ?? 'open',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.reports.unshift(report);
    return report;
  },

  updateReport(id: string, patch: Partial<ReportItem>): ReportItem | null {
    const idx = state.reports.findIndex((report) => report.id === id);
    if (idx < 0) return null;
    state.reports[idx] = { ...state.reports[idx], ...patch, updatedAt: nowIso() };
    return state.reports[idx];
  },

  getVerification(sellerId: string): SellerVerification | null {
    return state.verifications.find((v) => v.sellerId === sellerId) ?? null;
  },

  listVerifications(): SellerVerification[] {
    return [...state.verifications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  upsertVerification(
    sellerId: string,
    patch: Partial<Omit<SellerVerification, 'id' | 'sellerId' | 'history' | 'createdAt'>>,
    historyEntry?: Omit<VerificationHistoryEntry, 'id' | 'sellerId' | 'timestamp' | 'status'> & {
      status?: VerificationStatus;
    },
  ): SellerVerification {
    const existing = state.verifications.find((v) => v.sellerId === sellerId);
    const entry: VerificationHistoryEntry = {
      id: `vh-${randomUUID()}`,
      sellerId,
      status: patch.status ?? existing?.status ?? 'pending',
      changedBy: historyEntry?.changedBy,
      reason: historyEntry?.reason,
      notes: historyEntry?.notes,
      timestamp: nowIso(),
    };

    if (existing) {
      existing.status = patch.status ?? existing.status;
      existing.sellerName = patch.sellerName ?? existing.sellerName;
      existing.documentsSubmitted = patch.documentsSubmitted ?? existing.documentsSubmitted;
      existing.verifiedAt = patch.verifiedAt ?? existing.verifiedAt;
      existing.expiresAt = patch.expiresAt ?? existing.expiresAt;
      existing.rejectedReason = patch.rejectedReason ?? existing.rejectedReason;
      existing.metadata = patch.metadata ?? existing.metadata;
      existing.updatedAt = nowIso();
      existing.history.unshift(entry);
      return existing;
    }

    const created: SellerVerification = {
      id: `sv-${randomUUID()}`,
      sellerId,
      sellerName: patch.sellerName,
      status: patch.status ?? 'pending',
      documentsSubmitted: patch.documentsSubmitted ?? 0,
      verifiedAt: patch.verifiedAt,
      expiresAt: patch.expiresAt,
      rejectedReason: patch.rejectedReason,
      metadata: patch.metadata,
      history: [entry],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.verifications.unshift(created);
    return created;
  },

  addFraudSignal(input: Omit<FraudSignal, 'id' | 'detectedAt' | 'reviewed'>): FraudSignal {
    const signal: FraudSignal = {
      ...input,
      id: `frd-${randomUUID()}`,
      detectedAt: nowIso(),
      reviewed: false,
    };
    state.fraudSignals.unshift(signal);
    return signal;
  },

  listFraudSignals(filter?: { reviewed?: boolean }): FraudSignal[] {
    let rows = [...state.fraudSignals];
    if (filter?.reviewed !== undefined) {
      rows = rows.filter((s) => s.reviewed === filter.reviewed);
    }
    return rows;
  },

  countItemsByQueueAndStatus(): Record<string, Record<ModerationStatus, number>> {
    const counts: Record<string, Record<ModerationStatus, number>> = {};
    for (const item of state.items) {
      if (!counts[item.queue]) {
        counts[item.queue] = {
          pending: 0,
          approved: 0,
          rejected: 0,
          needs_review: 0,
          assigned: 0,
          archived: 0,
        };
      }
      counts[item.queue][item.status] += 1;
    }
    return counts;
  },

  countReportsByStatus(): Record<ReportItem['status'], number> {
    return state.reports.reduce(
      (acc, report) => {
        acc[report.status] += 1;
        return acc;
      },
      { open: 0, investigating: 0, resolved: 0, dismissed: 0 },
    );
  },

  countVerificationsByStatus(): Record<VerificationStatus, number> {
    return state.verifications.reduce(
      (acc, verification) => {
        acc[verification.status] += 1;
        return acc;
      },
      { pending: 0, verified: 0, rejected: 0, suspended: 0, expired: 0 },
    );
  },
};
