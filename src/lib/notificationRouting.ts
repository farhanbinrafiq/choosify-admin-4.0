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
    const isPartnerRole = role === 'seller' || role === 'verified_seller' || role === 'creator';

    // The SAME actionUrl shape (/messages/conv_platform_<buyerId>) is sent to
    // both sides of a conversation -- the buyer notification and the seller/
    // creator notification for the same message both carry it. It's a real
    // route for a buyer on choosify.bd, but a seller/creator has no session
    // there at all: following it lands them on the storefront's 404. For a
    // partner viewing their own notification, resolve it to their own real
    // conversation view here in admin instead.
    if (action === '/messages' || action.startsWith('/messages/')) {
      if (isPartnerRole) {
        const buyerId = action.match(/^\/messages\/conv_platform_(.+)$/)?.[1];
        return buyerId ? `/admin/conversations?buyerId=${encodeURIComponent(buyerId)}` : '/admin/conversations';
      }
      return `https://choosify.bd${action}`;
    }
    // Seller order notifications (new order / dispatched / delivered) are
    // generated with this web-app-shaped actionUrl even though a seller
    // views their notifications here in admin, not on choosify.bd -- send
    // to the real Operations order hub instead of 404ing on a route that
    // has never existed in this app.
    if (action.startsWith('/dashboard') && action.includes('tab=seller-orders')) {
      return '/admin/platform-orders';
    }
    // Every other /dashboard?tab=... / /profile/orders actionUrl (my-returns,
    // my-warranty, my-reviews, ...) is this same person's own BUYER-identity
    // tab, which only exists on the consumer web app -- same reasoning as
    // /messages/* above, minus the partner-conversation special case (there
    // is no admin equivalent of "my returns as a buyer").
    if (action.startsWith('/dashboard') || action.startsWith('/profile/')) {
      return `https://choosify.bd${action}`;
    }
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
    if (orderId) return `/admin/platform-orders?orderId=${encodeURIComponent(orderId)}`;
    return '/admin/platform-orders';
  }

  if (paymentId || escrowId || type.includes('payment') || type.includes('escrow') || haystack.includes('refund') || haystack.includes('payout') || haystack.includes('escrow')) {
    if (orderId) return `/admin/platform-orders?orderId=${encodeURIComponent(orderId)}`;
    if (paymentId) return `/admin/platform-orders?paymentId=${encodeURIComponent(paymentId)}`;
    return '/admin/platform-orders';
  }

  if (threadId || type.includes('message') || haystack.includes('message') || haystack.includes('conversation')) {
    return '/admin/conversations';
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
