const API_BASE = ((import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env
  ?.VITE_API_BASE_URL) || '/api/v1';
const AUTH_TOKEN_KEY = 'choosify_auth_token';

export type NavAttentionCounts = Record<string, { count: number; label: string }>;

export function formatNavAttentionCount(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

export async function fetchNavAttention(): Promise<NavAttentionCounts> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return {};
  const response = await fetch(`${API_BASE}/dashboard/nav-attention`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return {};
  const body = (await response.json()) as { counts?: NavAttentionCounts };
  return body.counts && typeof body.counts === 'object' ? body.counts : {};
}
