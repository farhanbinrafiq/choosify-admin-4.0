import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { adsStore } from '../ads/adsStore';
import { getNotificationCenterSummary } from '../communication/notificationService';
import { listConversationsForActor } from '../messaging/conversations/conversationService';
import {
  listMessages,
  listSupportTickets,
} from '../messaging/conversations/conversationStore';
import { moderationStore } from '../moderation/moderationStore';
import { MODERATION_STATUSES } from '../moderation/moderationTypes';
import { operationsStore } from '../operations/operationsStore';
import { partnerApplicationStore } from '../partnerApplications/partnerApplicationStore';
import { hasRole } from '../permissions/authorization';
import { ROLES, type UserRole } from '../permissions/roles';
import type { NavAttentionCounts, NavAttentionPayload } from './navAttentionTypes';

const OPEN_RETURN_STATUSES = new Set([
  'initiated',
  'approved',
  'returned_in_transit',
  'received',
  'dispute',
]);

const OPEN_VERIFICATION_STATUSES = new Set(['submitted', 'under review']);

const OPEN_TICKET_STATUSES = new Set(['open', 'in_progress']);

const MODERATION_OPEN = new Set<string>([
  MODERATION_STATUSES.PENDING,
  MODERATION_STATUSES.NEEDS_REVIEW,
  MODERATION_STATUSES.ASSIGNED,
]);

function qty(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function setCount(out: NavAttentionCounts, key: string, count: number, label: string): void {
  if (count > 0) out[key] = { count, label };
}

function isPlatformAdmin(role?: string): boolean {
  return Boolean(role && hasRole(role as UserRole, ROLES.ADMIN));
}

function isModerator(role?: string): boolean {
  return Boolean(role && hasRole(role as UserRole, ROLES.MODERATOR));
}

function isSupport(role?: string): boolean {
  return Boolean(role && hasRole(role as UserRole, ROLES.SUPPORT_AGENT));
}

function isSeller(role?: string): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'seller' || r === 'verified_seller';
}

function isCreator(role?: string): boolean {
  return String(role || '').toLowerCase() === 'creator';
}

function isConsumer(role?: string): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'consumer' || r === 'user';
}

async function countUnreadConversations(userId: string, role?: string): Promise<number> {
  if (!userId) return 0;
  const convs = await listConversationsForActor({ userId, role });
  const cap = Math.min(convs.length, 200);
  let n = 0;
  for (let i = 0; i < cap; i++) {
    const msgs = await listMessages(convs[i].id);
    if (!msgs.length) continue;
    const last = msgs[msgs.length - 1];
    if (last.senderId === userId) continue;
    if ((last.readBy || []).includes(userId)) continue;
    n += 1;
  }
  return n;
}

export async function buildNavAttention(actor: {
  userId: string;
  role?: string;
}): Promise<NavAttentionPayload> {
  const out: NavAttentionCounts = {};
  const role = actor.role;
  const userId = actor.userId;

  const pendingApps = await partnerApplicationStore.list('pending');

  if (isPlatformAdmin(role)) {
    const sellerApps = pendingApps.filter((a) => a.applicantType === 'seller').length;
    const creatorApps = pendingApps.filter((a) => a.applicantType === 'creator').length;
    setCount(
      out,
      'brands',
      sellerApps,
      qty(sellerApps, 'Seller application awaiting review', 'Seller applications awaiting review'),
    );
    setCount(
      out,
      'creators',
      creatorApps,
      qty(creatorApps, 'Creator application awaiting review', 'Creator applications awaiting review'),
    );

    const openReturns = operationsStore
      .listReturns()
      .filter((r) => OPEN_RETURN_STATUSES.has(r.status)).length;
    setCount(
      out,
      'returnsRefunds',
      openReturns,
      qty(openReturns, 'return/refund case needs action', 'return/refund cases need action'),
    );

    const openVerifications = operationsStore
      .listVerifications()
      .filter((v) => OPEN_VERIFICATION_STATUSES.has(String(v.status || '').toLowerCase())).length;
    setCount(
      out,
      'verificationCenter',
      openVerifications,
      qty(openVerifications, 'verification dossier awaiting review', 'verification dossiers awaiting review'),
    );

    const pendingAds = (await adsStore.listAds({ statuses: ['pending'] })).length;
    setCount(
      out,
      'adsDealsStudio',
      pendingAds,
      qty(pendingAds, 'ad/promotion awaiting approval', 'ads/promotions awaiting approval'),
    );

    const draftGuides = (await catalogStore.listGuides()).filter((g) => g.status === 'draft').length;
    setCount(
      out,
      'contentStudio',
      draftGuides,
      qty(draftGuides, 'guide awaiting approval', 'guides awaiting approval'),
    );

    const pendingReviews = operationsStore
      .listReviews()
      .filter((r) => r.status === 'pending' || r.status === 'flagged').length;
    setCount(
      out,
      'reviews',
      pendingReviews,
      qty(pendingReviews, 'review awaiting moderation', 'reviews awaiting moderation'),
    );

    const draftProducts = (await catalogStore.listProducts()).filter((p) => p.status === 'draft')
      .length;
    setCount(
      out,
      'products',
      draftProducts,
      qty(draftProducts, 'product listing awaiting review', 'product listings awaiting review'),
    );
  }

  if (isModerator(role)) {
    const openMod = moderationStore
      .listItems()
      .filter((item) => MODERATION_OPEN.has(item.status)).length;
    setCount(
      out,
      'moderationCenter',
      openMod,
      qty(openMod, 'moderation item awaiting review', 'moderation items awaiting review'),
    );
  }

  if (isPlatformAdmin(role) || isSupport(role)) {
    const openTickets = (await listSupportTickets()).filter((t) =>
      OPEN_TICKET_STATUSES.has(t.status),
    ).length;
    setCount(
      out,
      'messages',
      openTickets,
      qty(openTickets, 'support conversation needs action', 'support conversations need action'),
    );
  }

  if (isSeller(role) && userId) {
    const actionOrders = operationsStore
      .listOrders({ sellerId: userId })
      .filter((o) => o.status === 'active' || o.status === 'confirmed').length;
    setCount(
      out,
      'orders',
      actionOrders,
      qty(actionOrders, 'order requires action', 'orders require action'),
    );

    const sellerReturns = operationsStore
      .listReturns({ sellerId: userId })
      .filter((r) => OPEN_RETURN_STATUSES.has(r.status)).length;
    setCount(
      out,
      'returnsRefunds',
      sellerReturns,
      qty(sellerReturns, 'return/refund request needs action', 'return/refund requests need action'),
    );

    const unreadConvos = await countUnreadConversations(userId, role);
    setCount(
      out,
      'messages',
      unreadConvos,
      qty(unreadConvos, 'unread conversation', 'unread conversations'),
    );

    const unreadNotes = (await getNotificationCenterSummary(userId)).unread;
    setCount(
      out,
      'notifications',
      unreadNotes,
      qty(unreadNotes, 'unread notification', 'unread notifications'),
    );

    const oos = (await catalogStore.listProducts()).filter(
      (p) =>
        p.sellerId === userId &&
        (p.status === 'out_of_stock' || (typeof p.stock === 'number' && p.stock <= 0)),
    ).length;
    setCount(
      out,
      'products',
      oos,
      qty(oos, 'product is out of stock', 'products are out of stock'),
    );

    const ownApp = await partnerApplicationStore.findForActor({ userId });
    if (ownApp && (ownApp.status === 'pending' || ownApp.status === 'rejected')) {
      setCount(
        out,
        'brandProfile',
        1,
        ownApp.resubmissionRequested
          ? 'Verification resubmission required'
          : ownApp.status === 'rejected'
            ? 'Seller application was rejected'
            : 'Seller application is under review',
      );
    }

    const rejectedAds = (await adsStore.listAds({ ownerId: userId, statuses: ['rejected'] })).length;
    setCount(
      out,
      'adsDealsStudio',
      rejectedAds,
      qty(rejectedAds, 'ad was rejected and needs updates', 'ads were rejected and need updates'),
    );
  }

  if (isCreator(role) && userId) {
    const unreadConvos = await countUnreadConversations(userId, role);
    setCount(
      out,
      'messages',
      unreadConvos,
      qty(unreadConvos, 'unread conversation', 'unread conversations'),
    );

    const unreadNotes = (await getNotificationCenterSummary(userId)).unread;
    setCount(
      out,
      'notifications',
      unreadNotes,
      qty(unreadNotes, 'unread notification', 'unread notifications'),
    );

    const ownApp = await partnerApplicationStore.findForActor({ userId });
    if (ownApp && (ownApp.status === 'pending' || ownApp.status === 'rejected')) {
      setCount(
        out,
        'creatorProfile',
        1,
        ownApp.resubmissionRequested
          ? 'Verification resubmission required'
          : ownApp.status === 'rejected'
            ? 'Creator application was rejected'
            : 'Creator application is under review',
      );
    }

    const rejectedAds = (await adsStore.listAds({ ownerId: userId, statuses: ['rejected'] })).length;
    setCount(
      out,
      'adsDealsStudio',
      rejectedAds,
      qty(rejectedAds, 'ad was rejected and needs updates', 'ads were rejected and need updates'),
    );
  }

  if (isConsumer(role) && userId && !isSeller(role) && !isCreator(role) && !isPlatformAdmin(role)) {
    const unpaid = operationsStore.listOrders({ buyerId: userId }).filter((o) => {
      if (o.status === 'pending_payment') return true;
      const pay = String(o.paymentStatus || '').toLowerCase();
      return pay === 'unpaid' || pay === 'pending' || pay === 'failed';
    }).length;
    setCount(out, 'orders', unpaid, qty(unpaid, 'order awaiting payment', 'orders awaiting payment'));

    const unreadConvos = await countUnreadConversations(userId, role);
    setCount(
      out,
      'messages',
      unreadConvos,
      qty(unreadConvos, 'unread conversation', 'unread conversations'),
    );

    const unreadNotes = (await getNotificationCenterSummary(userId)).unread;
    setCount(
      out,
      'notifications',
      unreadNotes,
      qty(unreadNotes, 'unread notification', 'unread notifications'),
    );
  }

  return { counts: out, generatedAt: new Date().toISOString() };
}
