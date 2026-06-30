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

export class RedxAdapter implements CourierProvider {
  name = 'REDX';
  code = 'redx';
  logo = 'https://redx.com.bd/assets/images/redx-logo.svg';

  private apiKey: string = '';
  private apiSecret: string = '';
  private apiUrl: string = 'https://api.redx.com.bd';
  private sandbox: boolean = true;

  constructor(config?: { apiKey?: string; apiSecret?: string; apiUrl?: string; sandbox?: boolean }) {
    if (config) {
      this.apiKey = config.apiKey || '';
      this.apiSecret = config.apiSecret || '';
      this.apiUrl = config.apiUrl || 'https://api.redx.com.bd';
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
    console.log(`[RedxAdapter] Creating consignment for Invoice: ${params.invoiceId}, COD: ${params.codAmount}`);

    const simulatedTracking = `RDX${Math.floor(10000000 + Math.random() * 90000000)}`;
    const simulatedWaybill = `WB-RDX-${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 200,
        message: 'Order created successfully (Simulated REDX Sandbox)',
        consignment: {
          tracking_code: simulatedTracking,
          waybill_number: simulatedWaybill,
          cod_amount: params.codAmount,
          weight: params.weight,
        }
      }
    };
  }

  async cancelConsignment(trackingId: string): Promise<CancelResponse> {
    console.log(`[RedxAdapter] Cancelling consignment: ${trackingId}`);
    return {
      success: true,
      message: 'Order cancelled successfully (Simulated REDX Sandbox)',
      rawResponse: { status: 200, message: 'Cancelled' }
    };
  }

  async requestPickup(params: PickupRequestParams): Promise<PickupResponse> {
    console.log(`[RedxAdapter] Requesting pickup from ${params.pickupAddress.city}, package count: ${params.packageCount}`);
    return {
      success: true,
      pickupId: `PUP-RDX-${Math.floor(100000 + Math.random() * 900000)}`,
      scheduledTime: params.scheduledDate,
      message: 'REDX pickup scheduled successfully'
    };
  }

  async trackShipment(trackingId: string): Promise<TrackingResponse> {
    console.log(`[RedxAdapter] Tracking consignment: ${trackingId}`);
    return {
      success: true,
      status: 'in_transit',
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'pending_pickup',
          location: 'Dhaka',
          description: 'Shipment created and scheduled for REDX pickup',
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          status: 'picked_up',
          location: 'Dhaka Central Warehouse',
          description: 'Package received at REDX sorting hub',
        },
        {
          timestamp: new Date().toISOString(),
          status: 'in_transit',
          location: 'Destination Hub',
          description: 'Consignment is in transit on REDX network',
          remarks: 'Expected delivery soon'
        }
      ]
    };
  }

  async printLabel(trackingId: string, format: 'pdf' | 'thermal'): Promise<LabelResponse> {
    console.log(`[RedxAdapter] Printing label for: ${trackingId} format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.redx.com.bd/labels/print/${trackingId}?format=${format}`
    };
  }

  async estimateShipping(params: EstimateParams): Promise<EstimateResponse> {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes('dhaka');
    const deliveryCharge = isDhakaCity ? 60 : 130;
    const codFee = params.codAmount > 0 ? Math.max(10, Math.round(params.codAmount * 0.01)) : 0;
    
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
      message: 'REDX Adapter initialized successfully'
    };
  }
}
export default RedxAdapter;
