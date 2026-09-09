import { getStoredAccessToken, refreshAccessToken } from './authRefresh';
import type {
  Plan,
  PlanVersion,
  PlanVersionOffer,
  PlanEntitlement,
  PlanLimit,
  Subscription,
  SubscriptionEvent,
  Workspace,
  WorkspaceType,
  ResolvedSubscriptionPlan,
} from '../../server/subscriptions/types';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function parseErrorMessage(rawError: string, status: number): string {
  if (!rawError) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(rawError) as { error?: string; message?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
  } catch {
    // keep raw text
  }
  return rawError;
}

function doFetch(path: string, method: HttpMethod, body: unknown, token: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const token = getStoredAccessToken();
  let response = await doFetch(path, method, body, token);
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await doFetch(path, method, body, refreshed);
  }
  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(parseErrorMessage(rawError, response.status));
  }
  return response.json() as Promise<T>;
}

export type PlanVersionDetail = PlanVersion & { offers: PlanVersionOffer[]; entitlements: PlanEntitlement[]; limits: PlanLimit[] };
export type PlanDetail = { plan: Plan; versions: PlanVersionDetail[] };
export type SubscriberRow = {
  subscriptionId: string;
  workspaceId: string;
  workspaceDisplayName: string | null;
  status: Subscription['status'];
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  grantedManually: boolean;
};
export type WorkspaceLookupRow = Workspace & { ownerEmail: string; ownerDisplayName: string };
export type PlanListRow = Plan & { currentVersion: (PlanVersion & { offers: PlanVersionOffer[] }) | null; subscriberCount: number };
export type AvailablePlanRow = { plan: Plan; version: PlanVersion; offers: PlanVersionOffer[]; entitlements: PlanEntitlement[]; limits: PlanLimit[] };

export const subscriptionsApi = {
  // ── Super Admin: Plans ──
  listPlans: (role?: WorkspaceType) => request<{ plans: PlanListRow[] }>(`/admin/subscription-plans${role ? `?role=${role}` : ''}`),
  getPlanDetail: (planId: string) => request<{ plan: Plan; versions: PlanVersionDetail[] }>(`/admin/subscription-plans/${planId}`),
  createPlan: (input: { role: WorkspaceType; name: string; internalCode?: string; description?: string; badge?: string; sortOrder?: number }) =>
    request<{ plan: Plan }>('/admin/subscription-plans', 'POST', input),
  updatePlanMetadata: (
    planId: string,
    patch: Partial<{ name: string; description: string | null; badge: string | null; isPublic: boolean; isRecommended: boolean; sortOrder: number; internalCode: string | null }>,
  ) => request<{ plan: Plan }>(`/admin/subscription-plans/${planId}`, 'PATCH', patch),
  archivePlan: (planId: string) => request<{ plan: Plan }>(`/admin/subscription-plans/${planId}/archive`, 'POST'),
  createDraftVersion: (planId: string, input: { nameSnapshot: string; descriptionSnapshot?: string; trialDays?: number }) =>
    request<{ version: PlanVersion }>(`/admin/subscription-plans/${planId}/versions`, 'POST', input),
  updateDraftVersion: (planId: string, versionId: string, patch: Partial<{ nameSnapshot: string; descriptionSnapshot: string | null; trialDays: number | null }>) =>
    request<{ version: PlanVersion }>(`/admin/subscription-plans/${planId}/versions/${versionId}`, 'PATCH', patch),
  setDraftOffers: (planId: string, versionId: string, offers: Array<{ billingInterval: 'monthly' | 'annual'; price: number; currency?: string }>) =>
    request<{ offers: PlanVersionOffer[] }>(`/admin/subscription-plans/${planId}/versions/${versionId}/offers`, 'PUT', { offers }),
  setDraftEntitlements: (planId: string, versionId: string, entitlements: Array<{ featureKey: string; enabled: boolean }>) =>
    request<{ entitlements: PlanEntitlement[] }>(`/admin/subscription-plans/${planId}/versions/${versionId}/entitlements`, 'PUT', { entitlements }),
  setDraftLimits: (planId: string, versionId: string, limits: Array<{ limitKey: string; limitValue: number | null }>) =>
    request<{ limits: PlanLimit[] }>(`/admin/subscription-plans/${planId}/versions/${versionId}/limits`, 'PUT', { limits }),
  publishVersion: (planId: string, versionId: string) => request<{ plan: Plan }>(`/admin/subscription-plans/${planId}/versions/${versionId}/publish`, 'POST'),
  getSubscribers: (planId: string) => request<{ subscribers: SubscriberRow[] }>(`/admin/subscription-plans/${planId}/subscribers`),

  // ── Super Admin: Subscriptions ──
  manualGrant: (input: { workspaceId: string; planVersionOfferId: string; reason: string; startDate?: string; endDate?: string | null }) =>
    request<{ subscription: Subscription }>('/admin/subscriptions/manual-grant', 'POST', input),
  replaceManualGrant: (subscriptionId: string, input: { toPlanVersionOfferId: string; reason: string }) =>
    request<{ subscription: Subscription }>(`/admin/subscriptions/${subscriptionId}/replace-manual-grant`, 'POST', input),
  getWorkspaceSubscription: (workspaceId: string) => request<{ current: unknown }>(`/admin/workspaces/${workspaceId}/subscription`),
  getWorkspaceHistory: (workspaceId: string) => request<{ subscriptions: Subscription[]; events: SubscriptionEvent[] }>(`/admin/workspaces/${workspaceId}/subscription-history`),
  listWorkspaces: (filter?: { type?: WorkspaceType; q?: string }) => {
    const params = new URLSearchParams();
    if (filter?.type) params.set('type', filter.type);
    if (filter?.q) params.set('q', filter.q);
    const qs = params.toString();
    return request<{ workspaces: WorkspaceLookupRow[] }>(`/admin/workspaces${qs ? `?${qs}` : ''}`);
  },

  // ── Seller/Creator self-service (Phase 5) — Workspace always resolved server-side from the caller ──
  getAvailablePlans: () => request<{ plans: AvailablePlanRow[] }>('/subscriptions/available-plans'),
  getCurrentSubscription: () => request<{ workspace: Workspace; current: ResolvedSubscriptionPlan | null }>('/subscriptions/current'),
  getMyHistory: () => request<{ subscriptions: Subscription[]; events: SubscriptionEvent[] }>('/subscriptions/history'),
  getOfferDetail: (offerId: string) => request<{ plan: Plan; version: PlanVersion; offer: PlanVersionOffer }>(`/subscriptions/offers/${offerId}`),
  cancelMySubscription: () => request<{ subscription: Subscription }>('/subscriptions/cancel', 'POST'),
  requestMyUpgrade: (toPlanVersionOfferId: string) =>
    request<{ applied: false; status: 'upgrade_quote'; targetOfferId: string; amountDue: number; currency: string; note: string }>('/subscriptions/request-upgrade', 'POST', { toPlanVersionOfferId }),
  requestMyDowngrade: (toPlanVersionOfferId: string) =>
    request<{ subscription: Subscription }>('/subscriptions/request-downgrade', 'POST', { toPlanVersionOfferId }),
  cancelMyPendingDowngrade: () => request<{ subscription: Subscription }>('/subscriptions/cancel-pending-downgrade', 'POST'),

  // ── Phase 6: SSLCommerz subscription checkout — server resolves amount/currency/persona/workspace; never client-supplied ──
  initiateCheckout: (offerId: string, purpose: 'initial' | 'renewal' | 'upgrade' | 'downgrade') =>
    request<{ redirectUrl: string; tranId: string; paymentId: string; amount: number; currency: string }>('/subscriptions/checkout/initiate', 'POST', { offerId, purpose }),
  getPaymentStatus: (paymentId: string) =>
    request<{ payment: SubscriptionPaymentRow }>(`/subscriptions/payments/${paymentId}/status`),
  getPaymentHistory: () => request<{ payments: SubscriptionPaymentRow[] }>('/subscriptions/payments/history'),
};

export type SubscriptionPaymentRow = {
  id: string;
  planVersionOfferId?: string;
  purpose: 'initial' | 'renewal' | 'upgrade' | 'downgrade' | 'manual_adjustment';
  amount: number; // minor units
  currency: string;
  result: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: string;
};
