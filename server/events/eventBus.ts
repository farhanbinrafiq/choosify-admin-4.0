import { randomUUID } from 'node:crypto';
import { Logger } from '../lib/logger';

/**
 * Minimal in-process adapter for ES-004 (Event Bus, Domain Events & System
 * Messaging). ES-004 is a Draft spec describing a full bus (categories,
 * ordering, retry/DLQ, versioning) with no prior implementation anywhere in
 * this codebase. Rather than invent a parallel architecture, this module
 * implements only the producer/subscriber contract and event-metadata shape
 * ES-004 §18 defines, so callers and future subscribers already speak the
 * right interface. Retry policy (§22) and Dead Letter Queues are explicitly
 * out of scope until a real queue/broker is chosen — see ES-004 §20/§22.
 */

/** ES-004 §4 event categories. */
export type DomainEventCategory =
  | 'Identity'
  | 'Marketplace'
  | 'Brand'
  | 'Catalog'
  | 'Inventory'
  | 'Commerce'
  | 'Finance'
  | 'Payments'
  | 'Messaging'
  | 'Trust'
  | 'Moderation'
  | 'Content'
  | 'Discovery'
  | 'Notifications'
  | 'Administration'
  | 'Analytics'
  | 'System';

/** ES-004 §7 Marketplace events + Phase 15's SellerUpgraded (Identity-adjacent, Marketplace-scoped). */
export type MarketplaceEventName =
  | 'SellerUpgraded'
  | 'BrandCreated'
  | 'BrandUpdated'
  | 'BrandVerificationSubmitted'
  | 'BrandClaimSubmitted'
  | 'BrandClaimApproved'
  | 'BrandClaimRejected'
  | 'MarketplaceEnabled'
  | 'MarketplaceRestricted'
  | 'MarketplaceSuspended'
  | 'MarketplaceRestored'
  | 'MarketplaceRevoked';

export type DomainEventName = MarketplaceEventName | (string & {});

/** ES-004 §18 Event Metadata. */
export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  eventName: DomainEventName;
  domain: DomainEventCategory;
  timestamp: string;
  producer: string;
  aggregateId: string;
  actor: string;
  correlationId: string;
  payload: TPayload;
  version: number;
}

export type PublishEventInput<TPayload = Record<string, unknown>> = Omit<
  DomainEvent<TPayload>,
  'eventId' | 'timestamp' | 'correlationId' | 'version'
> & { correlationId?: string; version?: number };

type Subscriber = (event: DomainEvent) => void | Promise<void>;

const subscribersByEvent = new Map<DomainEventName, Set<Subscriber>>();
const wildcardSubscribers = new Set<Subscriber>();

/** Subscribe to a single named event. Returns an unsubscribe function. */
export function subscribe(eventName: DomainEventName, handler: Subscriber): () => void {
  if (!subscribersByEvent.has(eventName)) {
    subscribersByEvent.set(eventName, new Set());
  }
  subscribersByEvent.get(eventName)!.add(handler);
  return () => subscribersByEvent.get(eventName)?.delete(handler);
}

/** Subscribe to every event regardless of name (e.g. a future audit/analytics sink). */
export function subscribeAll(handler: Subscriber): () => void {
  wildcardSubscribers.add(handler);
  return () => wildcardSubscribers.delete(handler);
}

/**
 * Publish a domain event. Per ES-004 BR-4.8, a subscriber failure never
 * interrupts the caller's already-completed business transaction — this
 * function never throws.
 */
const RECENT_EVENT_RING: DomainEvent[] = [];
const RECENT_EVENT_RING_MAX = 400;

export function getRecentPublishedEvents(opts?: {
  domain?: DomainEventCategory;
  limit?: number;
}): DomainEvent[] {
  let rows = RECENT_EVENT_RING;
  if (opts?.domain) rows = rows.filter((e) => e.domain === opts.domain);
  const limit = opts?.limit ?? 100;
  return rows.slice(-limit);
}

export function publishEvent<TPayload = Record<string, unknown>>(
  input: PublishEventInput<TPayload>,
): DomainEvent<TPayload> {
  const event: DomainEvent<TPayload> = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    correlationId: input.correlationId || randomUUID(),
    version: input.version ?? 1,
    ...input,
  };

  RECENT_EVENT_RING.push(event as DomainEvent);
  if (RECENT_EVENT_RING.length > RECENT_EVENT_RING_MAX) {
    RECENT_EVENT_RING.splice(0, RECENT_EVENT_RING.length - RECENT_EVENT_RING_MAX);
  }

  Logger.audit(`event.${event.eventName}`, {
    eventId: event.eventId,
    domain: event.domain,
    producer: event.producer,
    aggregateId: event.aggregateId,
    actor: event.actor,
    correlationId: event.correlationId,
    version: event.version,
  });

  const handlers = [
    ...(subscribersByEvent.get(event.eventName) ?? []),
    ...wildcardSubscribers,
  ];
  for (const handler of handlers) {
    try {
      void handler(event as DomainEvent);
    } catch (error) {
      Logger.warn('event subscriber threw', {
        eventName: event.eventName,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return event;
}
