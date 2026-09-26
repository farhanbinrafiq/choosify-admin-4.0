/**
 * Notification event catalog — the single source of truth for which in-app
 * notifications a person can switch off, per persona, and which are mandatory.
 * Shared by the server (preference validation + the createNotification filter)
 * and the dashboard Settings page (labels / grouping), so the two can never
 * disagree about what a key means.
 *
 * Persona = which of the recipient's roles an event is addressed to:
 *   seller   — the recipient is acting as the seller/brand side (their order,
 *              return, warranty claim, review, verification, application…)
 *   creator  — the recipient is acting as a creator
 *   consumer — the recipient is the buyer side
 *   staff    — the recipient is internal staff (admin queues, support desk)
 *   account  — the person as a whole (marketing consent only; no events)
 * Each notification call site states its persona from its own context (which
 * side of the order/claim/conversation the recipient is on); a Seller
 * preference therefore never affects a Creator or Consumer notification.
 *
 * Only IN-APP delivery is controllable: it is the only channel with a real
 * provider today (email/push/SMS/WhatsApp are framework-only), so no other
 * channel preference exists here.
 */

export const NOTIFICATION_PERSONAS = ['account', 'seller', 'creator', 'consumer', 'staff'] as const;
export type NotificationPersona = (typeof NOTIFICATION_PERSONAS)[number];

export type NotificationEventGroup = 'orders' | 'after_sales' | 'engagement' | 'account' | 'platform' | 'staff';

export type NotificationEventDefinition = {
  key: string;
  label: string;
  description: string;
  group: NotificationEventGroup;
  /** Personas this event is ever addressed to. */
  personas: readonly NotificationPersona[];
  /** Mandatory events are always delivered in-app and can never be switched off. */
  mandatory: boolean;
  /**
   * Staff queue events only: the exact roles the event's notifyRoles() call
   * targets. A staff member only sees/sets switches for events they can
   * actually receive. Keep in sync with those call sites.
   */
  staffRoles?: readonly string[];
};

const ADMINS = ['admin', 'super_admin'] as const;
const SELLER_CONSUMER = ['seller', 'consumer'] as const;
const PARTNERS = ['seller', 'creator'] as const;
const EVERYONE = ['seller', 'creator', 'consumer', 'staff'] as const;

export const NOTIFICATION_EVENTS = [
  // ── Mandatory: security, account changes, payment confirmation, cancellations, Choosify Support ──
  {
    key: 'security.alert',
    label: 'Security alerts',
    description: 'Password, sign-in and other security events on your account.',
    group: 'account',
    personas: EVERYONE,
    mandatory: true,
  },
  {
    key: 'account.access',
    label: 'Account & partner access changes',
    description: 'Your partner application being approved or rejected and marketplace access changes.',
    group: 'account',
    personas: PARTNERS,
    mandatory: true,
  },
  {
    key: 'payment.confirmed',
    label: 'Payment confirmations',
    description: 'A buyer’s payment for your order or booking has been confirmed.',
    group: 'orders',
    personas: ['seller'],
    mandatory: true,
  },
  {
    key: 'order.cancelled',
    label: 'Order cancellations',
    description: 'An order was cancelled.',
    group: 'orders',
    personas: ['seller'],
    mandatory: true,
  },
  {
    key: 'support.message',
    label: 'Choosify Support',
    description: 'Messages and replies from Choosify Support.',
    group: 'platform',
    personas: EVERYONE,
    mandatory: true,
  },
  {
    key: 'admin.direct',
    label: 'Direct notices from Choosify',
    description: 'Notices sent to you individually by the Choosify team.',
    group: 'platform',
    personas: EVERYONE,
    mandatory: true,
  },

  // ── Ordinary: user-controllable ─────────────────────────────────────────
  {
    key: 'order.new',
    label: 'New orders',
    description: 'A new order was placed with you, or an order claim link is ready to share.',
    group: 'orders',
    personas: ['seller'],
    mandatory: false,
  },
  {
    key: 'order.update',
    label: 'Order status updates',
    description: 'Your order was dispatched, delivered or collected.',
    group: 'orders',
    personas: ['consumer'],
    mandatory: false,
  },
  {
    key: 'order.offer',
    label: 'Order offers',
    description: 'Order offers sent to you, and buyers accepting, declining or rejecting your offers.',
    group: 'orders',
    personas: SELLER_CONSUMER,
    mandatory: false,
  },
  {
    key: 'booking.update',
    label: 'Bookings',
    description: 'Booking requests, counter-offers, acceptances and declines.',
    group: 'orders',
    personas: SELLER_CONSUMER,
    mandatory: false,
  },
  {
    key: 'return.update',
    label: 'Returns & refunds',
    description: 'New return requests and return decisions.',
    group: 'after_sales',
    personas: SELLER_CONSUMER,
    mandatory: false,
  },
  {
    key: 'warranty.update',
    label: 'Warranty claims',
    description: 'New warranty claims and warranty claim progress.',
    group: 'after_sales',
    personas: SELLER_CONSUMER,
    mandatory: false,
  },
  {
    key: 'review.update',
    label: 'Reviews',
    description: 'New reviews of your products, and moderation updates to reviews you wrote.',
    group: 'engagement',
    personas: SELLER_CONSUMER,
    mandatory: false,
  },
  {
    key: 'message.new',
    label: 'Messages',
    description: 'New messages in your conversations (Choosify Support replies are always delivered).',
    group: 'engagement',
    personas: EVERYONE,
    mandatory: false,
  },
  {
    key: 'verification.update',
    label: 'Verification',
    description: 'Verification decisions and requests for more information.',
    group: 'account',
    personas: PARTNERS,
    mandatory: false,
  },
  {
    key: 'feature_request.update',
    label: 'Feature requests',
    description: 'Decisions on feature access you requested.',
    group: 'account',
    personas: PARTNERS,
    mandatory: false,
  },
  {
    key: 'announcement',
    label: 'Announcements',
    description: 'Announcements the Choosify team sends to your audience.',
    group: 'platform',
    personas: EVERYONE,
    mandatory: false,
  },

  // ── Staff queues ─────────────────────────────────────────────────────────
  {
    key: 'staff.partner_application',
    label: 'New partner applications',
    description: 'A seller or creator applied to the partner program.',
    group: 'staff',
    personas: ['staff'],
    mandatory: false,
    staffRoles: ADMINS,
  },
  {
    key: 'staff.verification_submitted',
    label: 'Verification submissions',
    description: 'A brand ownership claim or creator verification was submitted.',
    group: 'staff',
    personas: ['staff'],
    mandatory: false,
    staffRoles: ['admin', 'super_admin', 'moderator'],
  },
  {
    key: 'staff.feature_request',
    label: 'Feature requests awaiting review',
    description: 'A partner requested access to a feature.',
    group: 'staff',
    personas: ['staff'],
    mandatory: false,
    staffRoles: ADMINS,
  },
  {
    key: 'staff.inquiry',
    label: 'Business inquiries',
    description: 'A new business inquiry was submitted.',
    group: 'staff',
    personas: ['staff'],
    mandatory: false,
    staffRoles: ADMINS,
  },
  {
    key: 'staff.support_activity',
    label: 'Support desk activity',
    description: 'New activity on support conversations.',
    group: 'staff',
    personas: ['staff'],
    mandatory: false,
    staffRoles: ['admin', 'super_admin', 'support_agent'],
  },
  {
    key: 'staff.support_followup',
    label: 'Support follow-ups due',
    description: 'A support conversation follow-up is due.',
    group: 'staff',
    personas: ['staff'],
    mandatory: false,
    staffRoles: ['admin', 'super_admin', 'support_agent'],
  },
] as const satisfies readonly NotificationEventDefinition[];

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]['key'];

const BY_KEY = new Map<string, NotificationEventDefinition>(NOTIFICATION_EVENTS.map((e) => [e.key, e]));

export function getNotificationEvent(key: string): NotificationEventDefinition | undefined {
  return BY_KEY.get(key);
}

export function isNotificationPersona(value: unknown): value is NotificationPersona {
  return typeof value === 'string' && (NOTIFICATION_PERSONAS as readonly string[]).includes(value);
}

/** Whether an event is ever addressed to this role (staff queue events are role-targeted). */
export function eventAppliesToRole(event: NotificationEventDefinition, role: string | null | undefined): boolean {
  return !event.staffRoles || event.staffRoles.includes(String(role || '').toLowerCase());
}

/** Events a person can switch on/off for a persona (ordinary, applicable to their role). */
export function controllableEventsForPersona(
  persona: NotificationPersona,
  role?: string | null,
): NotificationEventDefinition[] {
  return NOTIFICATION_EVENTS.filter(
    (e) =>
      !e.mandatory &&
      (e.personas as readonly string[]).includes(persona) &&
      (role === undefined || eventAppliesToRole(e, role)),
  );
}

/** Mandatory events addressed to a persona (shown read-only in Settings). */
export function mandatoryEventsForPersona(persona: NotificationPersona): NotificationEventDefinition[] {
  return NOTIFICATION_EVENTS.filter(
    (e) => e.mandatory && (e.personas as readonly string[]).includes(persona),
  );
}

const STAFF_ROLES = new Set([
  'admin',
  'super_admin',
  'moderator',
  'finance_manager',
  'support_agent',
  'marketing_manager',
]);

/** The persona a dashboard role operates as (users.role is single-valued today). */
export function personaForRole(role: string | null | undefined): Exclude<NotificationPersona, 'account'> {
  const r = String(role || '').toLowerCase();
  if (r === 'seller' || r === 'verified_seller') return 'seller';
  if (r === 'creator') return 'creator';
  if (STAFF_ROLES.has(r)) return 'staff';
  return 'consumer';
}
