// Typed client for the Website Studio API (server/website/websiteRouter.ts). The server is the
// authority for every permission (cms:edit / cms:publish / cms:legal_publish) and for content
// validation; this module only transports and never fabricates state.
import { authedFetch } from './authRefresh';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
type HttpMethod = 'GET' | 'PUT' | 'POST' | 'DELETE';

export class WebsiteStudioApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly field?: string | null) {
    super(message);
    this.name = 'WebsiteStudioApiError';
  }
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await authedFetch(`${API_BASE}${path}`, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (error) {
    throw new WebsiteStudioApiError(error instanceof Error ? `Network error: ${error.message}` : 'Network error', 0, 'NETWORK_ERROR');
  }
  const raw = await response.text().catch(() => '');
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    /* non-JSON body */
  }
  if (!response.ok) {
    throw new WebsiteStudioApiError(
      typeof parsed.error === 'string' && parsed.error.trim() ? parsed.error : `Request failed (${response.status})`,
      response.status,
      typeof parsed.code === 'string' ? parsed.code : undefined,
      typeof parsed.field === 'string' ? parsed.field : null,
    );
  }
  return parsed.data as T;
}

export type PaymentCapability = { id: string; label: string; available: boolean; reason: string };
export type WebsiteCapabilities = {
  canEdit: boolean;
  canPublish: boolean;
  canPublishLegal: boolean;
  /** What checkout can really take on this server (the footer may only show available ones). */
  paymentMethods?: PaymentCapability[];
};

export type WebsiteDocumentSummary = {
  key: string;
  kind: string;
  editable: boolean;
  hasDraft: boolean;
  draftRevision: number;
  draftUpdatedAt: string | null;
  publishedVersion: number | null;
  updatedAt: string;
};

export type WebsiteDocument<T = unknown> = {
  key: string;
  kind: string;
  editable: boolean;
  draft: T | null;
  hasDraft: boolean;
  draftRevision: number;
  draftBaseVersion: number | null;
  draftUpdatedAt: string | null;
  draftUpdatedByUserId: string | null;
  publishedVersion: number | null;
  /** Highest recorded version (may be unpublished, e.g. the backfill baseline). */
  latestVersion?: number;
  published: { version: number; content: T; publishedAt: string; publishedByUserId: string | null } | null;
  defaults: T | null;
};

export type WebsiteVersionSummary = {
  version: number;
  source: 'publish' | 'rollback' | 'backfill';
  restoredFromVersion: number | null;
  changeNote: string;
  publishedByUserId: string | null;
  publishedByName?: string | null;
  publishedAt: string;
};

export type WebsitePublication = WebsiteVersionSummary & { documentKey: string };

export type CompanySettings = {
  displayName: string;
  legalName: string;
  supportEmail: string;
  supportPhone: string;
  offices: Array<{ id: string; label: string; lines: string[]; enabled: boolean }>;
  identifiers: { dbid: { value: string; verified: boolean }; tradeLicense: { value: string; verified: boolean } };
  copyrightText: string;
};

export const BRAND_ASSET_SLOTS = ['primaryLogo', 'horizontalLogo', 'footerLogo', 'favicon', 'emiLogo', 'defaultShareImage', 'defaultPlaceholder'] as const;
export type BrandAssetSlot = (typeof BRAND_ASSET_SLOTS)[number];
export type BrandAssets = Record<BrandAssetSlot, { url: string; alt: string }>;

const enc = encodeURIComponent;

export const websiteStudioApi = {
  capabilities: () => request<WebsiteCapabilities>('/website/capabilities'),
  listDocuments: () => request<WebsiteDocumentSummary[]>('/website/documents'),
  history: () => request<WebsitePublication[]>('/website/history'),
  getDocument: <T>(key: string) => request<WebsiteDocument<T>>(`/website/documents/${enc(key)}`),
  versions: (key: string) => request<WebsiteVersionSummary[]>(`/website/documents/${enc(key)}/versions`),
  version: <T>(key: string, version: number) =>
    request<WebsiteVersionSummary & { content: T }>(`/website/documents/${enc(key)}/versions/${version}`),
  saveDraft: <T>(key: string, content: T, expectedRevision: number) =>
    request<WebsiteDocument<T>>(`/website/documents/${enc(key)}/draft`, 'PUT', { content, expectedRevision }),
  discardDraft: (key: string, expectedRevision: number) =>
    request<WebsiteDocument>(`/website/documents/${enc(key)}/draft?expectedRevision=${expectedRevision}`, 'DELETE'),
  restoreDefaults: (key: string, expectedRevision: number) =>
    request<WebsiteDocument>(`/website/documents/${enc(key)}/restore-defaults`, 'POST', { expectedRevision }),
  publish: (key: string, changeNote: string, expectedRevision: number) =>
    request<WebsiteDocument>(`/website/documents/${enc(key)}/publish`, 'POST', { changeNote, expectedRevision }),
  rollback: (key: string, version: number, changeNote: string) =>
    request<WebsiteDocument>(`/website/documents/${enc(key)}/rollback`, 'POST', { version, changeNote }),
  previewToken: (key: string) =>
    request<{ token: string; expiresAt: string; ttlSeconds: number }>(`/website/documents/${enc(key)}/preview-token`, 'POST'),
};
