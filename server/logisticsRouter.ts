import { Router } from 'express';
import { LogisticsService } from '../src/services/logistics/LogisticsService';
import { WebhookNormalizer } from '../src/services/logistics/webhook/WebhookNormalizer';
import { shipmentStore } from './operations/shipmentStore';
import type { OpsShipmentStatus } from './operations/shipmentStore';

const router = Router();

// Ingest webhook events from various courier providers
router.post('/webhooks/logistics/:courier', async (req, res) => {
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

    const service = LogisticsService.getInstance();
    const updatedShipment = await service.updateShipmentFromWebhook(
      normalized.trackingNumber,
      normalized.status,
      {
        status: normalized.status,
        location: normalized.location,
        description: normalized.description,
        remarks: normalized.remarks
      }
    );

    shipmentStore.updateFromWebhook(
      normalized.trackingNumber,
      normalized.status as OpsShipmentStatus,
      {
        timestamp: new Date().toISOString(),
        status: normalized.status,
        location: normalized.location || 'Unknown',
        description: normalized.description || normalized.status,
      },
    );

    return res.json({
      success: true,
      message: `Webhook processed and shipment updated.`,
      normalized,
      shipmentId: updatedShipment.id,
      trackingNumber: updatedShipment.trackingNumber,
      status: updatedShipment.status
    });
  } catch (error: any) {
    console.error('[LogisticsWebhookRouter Error]', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error processing webhook.' 
    });
  }
});

// Simulate webhook trigger (used by admin simulation panel)
router.post('/logistics/simulate-webhook', async (req, res) => {
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

    const service = LogisticsService.getInstance();
    const updatedShipment = await service.updateShipmentFromWebhook(
      normalized.trackingNumber,
      normalized.status,
      {
        status: normalized.status,
        location: normalized.location,
        description: normalized.description,
        remarks: normalized.remarks
      }
    );

    shipmentStore.updateFromWebhook(
      normalized.trackingNumber,
      normalized.status as OpsShipmentStatus,
      {
        timestamp: new Date().toISOString(),
        status: normalized.status,
        location: normalized.location || 'Unknown',
        description: normalized.description || normalized.status,
      },
    );

    return res.json({
      success: true,
      message: `Simulated webhook processed. Shipment status is now: ${updatedShipment.status}`,
      normalized,
      shipment: updatedShipment
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
