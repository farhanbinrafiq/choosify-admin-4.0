// Owner client for the Public Identity lifecycle API
// (server/publicHandles/publicHandlesRouter.ts, owner routes). Used by Brand
// Studio and Creator Studio. The server decides everything — ownership
// (brand.sellerId / creator.userId), impersonation refusal and validation; this
// module only transports. Approve / reject / assign are not reachable from here.
import { authedFetch } from './authRefresh';
import type { OwnerApiFailure, OwnerAvailability, OwnerEntityType, OwnerHandleRequest, OwnerHandleState } from '../lib/publicIdentityOwner';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

/** A failed call: HTTP status plus the server's `code` / validator `reason` (0 = network). */
export class PublicIdentityOwnerError extends Error implements OwnerApiFailure {
  readonly status: number;
  readonly code?: string;
  readonly reason?: string;

  constructor(message: string, status: number, code?: string, reason?: string) {
    super(message);
    this.name = 'PublicIdentityOwnerError';
    this.status = status;
    this.code = code;
    this.reason = reason;
  }
}

async function request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await authedFetch(`${API_BASE}${path}`, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new PublicIdentityOwnerError(error instanceof Error ? error.message : 'Network error', 0, 'NETWORK_ERROR');
  }
  const raw = await response.text().catch(() => '');
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    // Non-JSON body (proxy error page) — status alone describes it.
  }
  if (!response.ok) {
    throw new PublicIdentityOwnerError(
      typeof parsed.error === 'string' && parsed.error ? parsed.error : `Request failed (${response.status})`,
      response.status,
      typeof parsed.code === 'string' ? parsed.code : undefined,
      typeof parsed.reason === 'string' ? parsed.reason : undefined,
    );
  }
  return (parsed as { data: T }).data;
}

export const publicHandlesOwnerApi = {
  /** GET /public-handles/:type/:id — active handle, pending request, request history (owner, or Admin read). */
  getState: (entityType: OwnerEntityType, entityId: string) =>
    request<OwnerHandleState>(`/public-handles/${entityType}/${encodeURIComponent(entityId)}`),

  /** GET /catalog/handles/availability — with entityId so this profile's own handle / slug are recognised. */
  checkAvailability: (entityType: OwnerEntityType, entityId: string, handle: string) => {
    const qs = new URLSearchParams({ handle, type: entityType, entityId });
    return request<OwnerAvailability>(`/catalog/handles/availability?${qs.toString()}`);
  },

  /** POST /public-handles/:type/:id/requests { handle } — creates a PENDING request; the active handle is unchanged. */
  submitRequest: (entityType: OwnerEntityType, entityId: string, handle: string) =>
    request<OwnerHandleRequest>(`/public-handles/${entityType}/${encodeURIComponent(entityId)}/requests`, 'POST', { handle }),

  /** POST /public-handles/requests/:id/cancel — the requester withdraws their own pending request. */
  cancelRequest: (requestId: string) =>
    request<OwnerHandleRequest>(`/public-handles/requests/${encodeURIComponent(requestId)}/cancel`, 'POST', {}),
};
