import { Router } from 'express';
import crypto from 'crypto';
import { LogisticsService } from '../src/services/logistics/LogisticsService';
import { WebhookNormalizer } from '../src/services/logistics/webhook/WebhookNormalizer';
import { shipmentStore } from './operations/shipmentStore';
import type { OpsShipmentStatus } from './operations/shipmentStore';
import { authenticateRequest } from './middleware/auth';
import { requireAdmin } from './middleware/requireAdmin';

const router = Router();

/**
 * Sprint 11: this endpoint previously had zero authentication -- any
 * unauthenticated caller could forge a "delivered" (or any) status onto a
 * real order's shipment-tracking record, since the tracking number is
 * deterministically derivable from the public orderId, not a real secret.
 * No real courier is configured in this environment yet (all courier
 * integrations are sandboxed with fabricated credentials), so there is no
 * genuine per-courier signature scheme to verify against today. Fail closed:
 * require a shared secret via LOGISTICS_WEBHOOK_SECRET until a real courier
 * integration replaces this with that courier's real signature verification.
 */
/**
 * Sprint 14: a courier "delivered" checkpoint must synchronise the CANONICAL
 * delivery state — Operations item.deliveredAt, the Commerce order
 * (shipped → delivered) and the buyer "delivered" message — not merely flip
 * `OpsShipment.status`. `failed_delivery` / `returned` are recorded honestly by
 * `updateFromWebhook` (status + checkpoint) and are deliberately NOT settled.
 * Idempotent: a replayed "delivered" webhook changes nothing further.
 */
async function synchroniseDeliveryFromWebhook(
  shipment: { orderId: string } | null,
  normalizedStatus: string,
): Promise<void> {
  if (!shipment || normalizedStatus !== 'delivered') return;
  try {
    const { settleOrderDelivered } = await import('./operations/deliverySettlement');
    await settleOrderDelivered(shipment.orderId, 'courier_webhook');
  } catch (err) {
    console.warn('[LogisticsWebhook] delivery settlement failed (non-fatal):', (err as Error)?.message);
  }
}

function verifyWebhookSecret(req: { headers: Record<string, unknown> }): boolean {
  const expected = process.env.LOGISTICS_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = req.headers['x-webhook-secret'];
  if (typeof provided !== 'string' || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Ingest webhook events from various courier providers
router.post('/webhooks/logistics/:courier', async (req, res) => {
  if (!verifyWebhookSecret(req)) {
    res.status(401).json({ success: false, message: 'Missing or invalid webhook secret.' });
    return;
  }
  const { courier } = req.params;
  const payload = req.body;

  console.log(`[LogisticsWebhookRouter] Received webhook from: ${courier}`);
  console.log('[LogisticsWebhookRouter] Payload:', JSON.stringify(payload, null, 2));

  try {
    const normalized = WebhookNormalizer.normalize(courier, payload);
    
    if (!normalized.trackingNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Could not extract tracking number from webhook payload.' 
      });
    }

    // The legacy LogisticsService is a sandboxed / fabricated store — a
    // checkpoint for a tracking number it doesn't hold must NOT prevent the
    // CANONICAL shipmentStore from recording the real courier checkpoint.
    let updatedShipment: { id: string; trackingNumber: string; status: string } | null = null;
    try {
      const service = LogisticsService.getInstance();
      updatedShipment = await service.updateShipmentFromWebhook(
        normalized.trackingNumber,
        normalized.status,
        {
          status: normalized.status,
          location: normalized.location,
          description: normalized.description,
          remarks: normalized.remarks,
        },
      );
    } catch (legacyErr) {
      console.warn('[LogisticsWebhook] legacy LogisticsService skipped:', (legacyErr as Error)?.message);
    }

    const canonical = shipmentStore.updateFromWebhook(
      normalized.trackingNumber,
      normalized.status as OpsShipmentStatus,
      {
        timestamp: new Date().toISOString(),
        status: normalized.status,
        location: normalized.location || 'Unknown',
        description: normalized.description || normalized.status,
      },
    );
    if (!canonical && !updatedShipment) {
      return res.status(404).json({ success: false, message: 'No shipment matches this tracking number.' });
    }

    await synchroniseDeliveryFromWebhook(canonical, normalized.status);

    return res.json({
      success: true,
      message: `Webhook processed and shipment updated.`,
      normalized,
      shipmentId: canonical?.id ?? updatedShipment?.id,
      trackingNumber: canonical?.trackingNumber ?? updatedShipment?.trackingNumber,
      status: canonical?.status ?? updatedShipment?.status,
    });
  } catch (error: any) {
    console.error('[LogisticsWebhookRouter Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error processing webhook.'
    });
  }
});

// Simulate webhook trigger (used by admin simulation panel) -- admin-only.
router.post('/logistics/simulate-webhook', authenticateRequest, requireAdmin, async (req, res) => {
  const { courier, payload } = req.body;

  console.log(`[LogisticsWebhookSimulation] Simulating webhook for: ${courier}`);
  
  try {
    const normalized = WebhookNormalizer.normalize(courier, payload);
    
    if (!normalized.trackingNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Simulation failed: Could not extract tracking number.' 
      });
    }

    // The legacy LogisticsService is a sandboxed / fabricated store — a
    // checkpoint for a tracking number it doesn't hold must NOT prevent the
    // CANONICAL shipmentStore from recording the real courier checkpoint.
    let updatedShipment: { id: string; trackingNumber: string; status: string } | null = null;
    try {
      const service = LogisticsService.getInstance();
      updatedShipment = await service.updateShipmentFromWebhook(
        normalized.trackingNumber,
        normalized.status,
        {
          status: normalized.status,
          location: normalized.location,
          description: normalized.description,
          remarks: normalized.remarks,
        },
      );
    } catch (legacyErr) {
      console.warn('[LogisticsWebhook] legacy LogisticsService skipped:', (legacyErr as Error)?.message);
    }

    const canonical = shipmentStore.updateFromWebhook(
      normalized.trackingNumber,
      normalized.status as OpsShipmentStatus,
      {
        timestamp: new Date().toISOString(),
        status: normalized.status,
        location: normalized.location || 'Unknown',
        description: normalized.description || normalized.status,
      },
    );

    if (!canonical && !updatedShipment) {
      return res.status(404).json({ success: false, message: 'No shipment matches this tracking number.' });
    }

    await synchroniseDeliveryFromWebhook(canonical, normalized.status);

    return res.json({
      success: true,
      message: `Simulated webhook processed. Shipment status is now: ${canonical?.status ?? updatedShipment?.status}`,
      normalized,
      shipment: canonical ?? updatedShipment,
    });
  } catch (error: any) {
    console.error('[LogisticsWebhookSimulation Error]', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error executing webhook simulation.' 
    });
  }
});

export { router as logisticsRouter };
export default router;
