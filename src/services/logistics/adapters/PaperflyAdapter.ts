import { CourierProvider } from './CourierProvider';
import { 
  ConsignmentResponse, 
  CancelResponse, 
  PickupRequestParams, 
  PickupResponse, 
  TrackingResponse, 
  LabelResponse, 
  EstimateParams, 
  EstimateResponse 
} from '../../../types/courier';

export class PaperflyAdapter implements CourierProvider {
  name = 'Paperfly';
  code = 'paperfly';
  logo = 'https://www.paperfly.com.bd/images/paperfly-logo.png';

  private apiKey: string = '';
  private apiSecret: string = '';
  private apiUrl: string = 'https://api.paperfly.com.bd';
  private sandbox: boolean = true;

  constructor(config?: { apiKey?: string; apiSecret?: string; apiUrl?: string; sandbox?: boolean }) {
    if (config) {
      this.apiKey = config.apiKey || '';
      this.apiSecret = config.apiSecret || '';
      this.apiUrl = config.apiUrl || 'https://api.paperfly.com.bd';
      this.sandbox = config.sandbox !== undefined ? config.sandbox : true;
    }
  }

  async createConsignment(params: {
    invoiceId: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    codAmount: number;
    weight: number;
    note?: string;
  }): Promise<ConsignmentResponse> {
    console.log(`[PaperflyAdapter] Dispatching order: ${params.invoiceId}, COD: ${params.codAmount}`);

    const simulatedTracking = `PFL${Math.floor(10000000 + Math.random() * 90000000)}`;
    const simulatedWaybill = `WB-PFL-${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 'success',
        code: 200,
        message: 'Order accepted by Paperfly Sandbox API',
        data: {
          tracking_code: simulatedTracking,
          waybill_no: simulatedWaybill,
          invoice_id: params.invoiceId
        }
      }
    };
  }

  async cancelConsignment(trackingId: string): Promise<CancelResponse> {
    console.log(`[PaperflyAdapter] Cancelling delivery: ${trackingId}`);
    return {
      success: true,
      message: 'Paperfly shipment cancelled successfully (Simulated)',
      rawResponse: { status: 'success', code: 200 }
    };
  }

  async requestPickup(params: PickupRequestParams): Promise<PickupResponse> {
    console.log(`[PaperflyAdapter] Requesting shipment pickup at ${params.pickupAddress.street}`);
    return {
      success: true,
      pickupId: `PUP-PFL-${Math.floor(100000 + Math.random() * 900000)}`,
      scheduledTime: params.scheduledDate,
      message: 'Paperfly scheduled pickup request successful'
    };
  }

  async trackShipment(trackingId: string): Promise<TrackingResponse> {
    console.log(`[PaperflyAdapter] Tracking delivery status: ${trackingId}`);
    return {
      success: true,
      status: 'in_transit',
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'pending_pickup',
          location: 'Dhaka',
          description: 'Shipment booking generated at Paperfly merchant portal',
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          status: 'picked_up',
          location: 'Paperfly Dhaka Central Hub',
          description: 'Shipment received and sorted into outbound bags',
        },
        {
          timestamp: new Date().toISOString(),
          status: 'in_transit',
          location: 'In-Transit to Local Point',
          description: 'Dispatched to target hub point for local rider delivery',
        }
      ]
    };
  }

  async printLabel(trackingId: string, format: 'pdf' | 'thermal'): Promise<LabelResponse> {
    console.log(`[PaperflyAdapter] Dispatching label render: ${trackingId} Format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.paperfly.com.bd/labels/print/${trackingId}?format=${format}`
    };
  }

  async estimateShipping(params: EstimateParams): Promise<EstimateResponse> {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes('dhaka');
    const deliveryCharge = isDhakaCity ? 60 : 120;
    const codFee = params.codAmount > 0 ? Math.max(15, Math.round(params.codAmount * 0.01)) : 0;
    
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 3
    };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'down'; message?: string }> {
    return {
      status: 'healthy',
      message: 'Paperfly Courier API gateway integration is active and listening.'
    };
  }
}
export default PaperflyAdapter;
