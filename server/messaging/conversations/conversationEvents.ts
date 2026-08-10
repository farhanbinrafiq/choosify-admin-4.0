/**
 * Messaging domain event subscribers — Order/Booking → Conversation wiring.
 */

import { subscribe } from '../../events/eventBus';
import { Logger } from '../../lib/logger';
import {
  applyOrderLifecycleToConversation,
  ensureBookingConversation,
  ensureOrderConversation,
  mapOrderSourceChannel,
} from './conversationService';
import { CONVERSATION_CONTEXT_TYPES } from './types';

let bootstrapped = false;

export function bootstrapConversationEventSubscribers(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  subscribe('OrderCreated', async (event) => {
    try {
      const p = event.payload as Record<string, unknown>;
      let orderId = String(p.orderId || event.aggregateId || '');
      let consumerId = String(p.consumerId || event.actor || '');
      let sellerId = String(p.sellerId || '');
      let brandId = String(p.brandId || '');
      let checkoutId = p.checkoutId ? String(p.checkoutId) : undefined;
      let source = String(p.source || p.orderSource || 'checkout');

      if (!sellerId || !brandId || !consumerId) {
        const { commerceStore } = await import('../../commerce/commerceStore');
        const order = await commerceStore.getOrder(orderId);
        if (order) {
          orderId = order.id;
          consumerId = order.consumerId;
          sellerId = order.sellerId;
          brandId = order.brandId;
          checkoutId = order.checkoutId;
          source = order.source || source;
        }
      }

      if (!orderId || !consumerId || !sellerId || !brandId) {
        Logger.warn('OrderCreated missing fields for conversation', { payload: p });
        return;
      }
      await ensureOrderConversation({
        orderId,
        consumerId,
        sellerId,
        brandId,
        checkoutId,
        sourceChannel: mapOrderSourceChannel(source),
        contextType:
          source !== 'checkout'
            ? CONVERSATION_CONTEXT_TYPES.MANUAL_ORDER
            : CONVERSATION_CONTEXT_TYPES.ORDER,
        metadata: {
          orderNumber: p.orderNumber,
          orderSource: source,
        },
        actor: event.actor,
      });
    } catch (error) {
      Logger.error('Failed to ensure conversation on OrderCreated', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  subscribe('BookingRequestCreated', async (event) => {
    try {
      const p = event.payload as Record<string, unknown>;
      let bookingRequestId = String(p.bookingRequestId || event.aggregateId || '');
      let consumerId = String(p.consumerId || event.actor || '');
      let sellerId = String(p.sellerId || '');
      let brandId = String(p.brandId || '');
      let orderId = p.orderId ? String(p.orderId) : undefined;
      let serviceId = p.serviceId ? String(p.serviceId) : undefined;

      if (!brandId || !consumerId || !sellerId) {
        const { commerceStore } = await import('../../commerce/commerceStore');
        const br = await commerceStore.getBookingRequest(bookingRequestId);
        if (br) {
          bookingRequestId = br.id;
          consumerId = br.consumerId;
          sellerId = br.sellerId;
          brandId = br.brandId;
          orderId = br.orderId;
          serviceId = br.serviceId;
        }
      }

      if (!bookingRequestId || !consumerId || !sellerId || !brandId) return;
      await ensureBookingConversation({
        bookingRequestId,
        orderId,
        consumerId,
        sellerId,
        brandId,
        serviceId,
        actor: event.actor,
      });
    } catch (error) {
      Logger.error('Failed to ensure conversation on BookingRequestCreated', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const lifecycleEvents = [
    'OrderDelivered',
    'OrderCompleted',
    'OrderCancelled',
    'OrderRefunded',
    'OrderClosed',
  ] as const;

  for (const name of lifecycleEvents) {
    subscribe(name, async (event) => {
      try {
        const p = event.payload as Record<string, unknown>;
        const orderId = String(p.orderId || event.aggregateId || '');
        if (!orderId) return;
        const status =
          name === 'OrderDelivered'
            ? 'delivered'
            : name === 'OrderCompleted'
              ? 'completed'
              : name === 'OrderCancelled'
                ? 'cancelled'
                : name === 'OrderRefunded'
                  ? 'refunded'
                  : 'closed';
        await applyOrderLifecycleToConversation(orderId, status, event.actor);
      } catch (error) {
        Logger.error(`Failed to apply lifecycle on ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  Logger.info('Messaging conversation event subscribers registered');
}
