import type { AppNotification } from '../services/notificationsApi';
import type { UserRole } from '../contexts/AuthContext';

/**
 * Resolve where a notification should navigate in the admin workspace.
 * Prefers server `actionUrl`, then metadata / type heuristics.
 * Returns null when there is no meaningful in-app destination.
 */
export function resolveNotificationPath(
  notification: AppNotification,
  role?: UserRole | string | null,
): string | null {
  const action = (notification.actionUrl || '').trim();
  if (action) {
    if (action.startsWith('/')) return action;
    try {
      const url = new URL(action, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      if (typeof window !== 'undefined' && url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      /* fall through to heuristics */
    }
  }

  const meta = notification.metadata || {};
  const orderId = str(meta.orderId) || str(meta.order_id);
  const paymentId = str(meta.paymentId) || str(meta.payment_id);
  const escrowId = str(meta.escrowId) || str(meta.escrow_id);
  const threadId = str(meta.threadId) || str(meta.conversationId) || str(meta.messageThreadId);
  const type = String(notification.type || '').toLowerCase();
  const category = String(notification.category || '').toLowerCase();
  const haystack = `${notification.title} ${notification.summary || ''} ${type} ${category}`.toLowerCase();

  if (orderId || type.includes('order') || haystack.includes('order')) {
    if (orderId) return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
    return '/admin/orders';
  }

  if (paymentId || escrowId || type.includes('payment') || type.includes('escrow') || haystack.includes('refund') || haystack.includes('payout') || haystack.includes('escrow')) {
    if (orderId) return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
    if (paymentId) return `/admin/orders?paymentId=${encodeURIComponent(paymentId)}`;
    return '/admin/orders';
  }

  if (threadId || type.includes('message') || haystack.includes('message') || haystack.includes('conversation')) {
    if (threadId) return `/admin/messages?thread=${encodeURIComponent(threadId)}`;
    return '/admin/messages';
  }

  if (haystack.includes('verif') || haystack.includes('kyc') || meta.verificationId) {
    if (role === 'seller') return '/admin/brand-profile';
    if (role === 'creator') return '/admin/creator-profile';
    return '/admin/brand-verification';
  }

  if (haystack.includes('guide') || type.includes('guide')) {
    if (role === 'creator') return '/admin/creator-profile';
    return '/dashboard/content-studio/guides';
  }

  if (category === 'seller' || type.includes('seller')) {
    if (role === 'seller') return '/admin/brand-profile';
  }

  if (category === 'admin' || category === 'operations' || category === 'moderator') {
    if (role === 'admin' || role === 'super_admin') return '/admin/dashboard';
  }

  return null;
}

export function formatNotificationTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
