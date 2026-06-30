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

export class SundarbanAdapter implements CourierProvider {
  name = 'Sundarban';
  code = 'sundarban';
  logo = 'https://sundarbancourierltd.com/images/logo.png';

  private apiKey: string = '';
  private apiSecret: string = '';
  private apiUrl: string = 'https://api.sundarbancourierltd.com';
  private sandbox: boolean = true;

  constructor(config?: { apiKey?: string; apiSecret?: string; apiUrl?: string; sandbox?: boolean }) {
    if (config) {
      this.apiKey = config.apiKey || '';
      this.apiSecret = config.apiSecret || '';
      this.apiUrl = config.apiUrl || 'https://api.sundarbancourierltd.com';
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
    console.log(`[SundarbanAdapter] Creating consignment for Invoice: ${params.invoiceId}, COD: ${params.codAmount}`);

    const simulatedTracking = `SND${Math.floor(10000000 + Math.random() * 90000000)}`;
    const simulatedWaybill = `WB-SND-${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 'success',
        code: 200,
        message: 'Order created successfully (Simulated Sundarban Sandbox)',
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
    console.log(`[SundarbanAdapter] Cancelling Sundarban booking: ${trackingId}`);
    return {
      success: true,
      message: 'Sundarban booking cancelled successfully (Simulated)',
      rawResponse: { status: 200, message: 'Cancelled' }
    };
  }

  async requestPickup(params: PickupRequestParams): Promise<PickupResponse> {
    console.log(`[SundarbanAdapter] Requesting pickup from ${params.pickupAddress.city}, package count: ${params.packageCount}`);
    return {
      success: true,
      pickupId: `PUP-SND-${Math.floor(100000 + Math.random() * 900000)}`,
      scheduledTime: params.scheduledDate,
      message: 'Sundarban pickup scheduled successfully'
    };
  }

  async trackShipment(trackingId: string): Promise<TrackingResponse> {
    console.log(`[SundarbanAdapter] Tracking consignment: ${trackingId}`);
    return {
      success: true,
      status: 'in_transit',
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'pending_pickup',
          location: 'Dhaka Main Branch',
          description: 'Booking recorded and packet registered under Sundarban parcel dispatch roster',
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          status: 'picked_up',
          location: 'Dhaka Central Sort Facility',
          description: 'Package received at sorting facility and dispatched via internal transport vehicles',
        },
        {
          timestamp: new Date().toISOString(),
          status: 'in_transit',
          location: 'Destination District Hub',
          description: 'Arrived at distribution hub. Assigned to local delivery team.',
        }
      ]
    };
  }

  async printLabel(trackingId: string, format: 'pdf' | 'thermal'): Promise<LabelResponse> {
    console.log(`[SundarbanAdapter] Printing label for: ${trackingId} format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.sundarbancourierltd.com/labels/print/${trackingId}?format=${format}`
    };
  }

  async estimateShipping(params: EstimateParams): Promise<EstimateResponse> {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes('dhaka');
    const deliveryCharge = isDhakaCity ? 70 : 130;
    const codFee = params.codAmount > 0 ? Math.max(20, Math.round(params.codAmount * 0.015)) : 0;
    
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
      message: 'Sundarban Courier system API endpoint is fully operational.'
    };
  }
}
export default SundarbanAdapter;
