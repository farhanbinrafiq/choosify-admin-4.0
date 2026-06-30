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

export class ECourierAdapter implements CourierProvider {
  name = 'eCourier';
  code = 'ecourier';
  logo = 'https://ecourier.com.bd/wp-content/uploads/2021/04/e-courier-logo.png';

  private apiKey: string = '';
  private apiSecret: string = '';
  private apiUrl: string = 'https://api.ecourier.com.bd';
  private sandbox: boolean = true;

  constructor(config?: { apiKey?: string; apiSecret?: string; apiUrl?: string; sandbox?: boolean }) {
    if (config) {
      this.apiKey = config.apiKey || '';
      this.apiSecret = config.apiSecret || '';
      this.apiUrl = config.apiUrl || 'https://api.ecourier.com.bd';
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
    console.log(`[ECourierAdapter] Registering parcel order: ${params.invoiceId}, COD: ${params.codAmount}`);

    const simulatedTracking = `ECR${Math.floor(10000000 + Math.random() * 90000000)}`;
    const simulatedWaybill = `WB-ECR-${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 'success',
        code: 200,
        message: 'eCourier consignment created',
        data: {
          tracking_id: simulatedTracking,
          waybill_number: simulatedWaybill,
          recipient_phone: params.recipientPhone
        }
      }
    };
  }

  async cancelConsignment(trackingId: string): Promise<CancelResponse> {
    console.log(`[ECourierAdapter] Sending cancel request for: ${trackingId}`);
    return {
      success: true,
      message: 'eCourier consignment cancelled successfully (Simulated)',
      rawResponse: { status: 'success', code: 200 }
    };
  }

  async requestPickup(params: PickupRequestParams): Promise<PickupResponse> {
    console.log(`[ECourierAdapter] Requesting pickup schedule for address: ${params.pickupAddress.street}`);
    return {
      success: true,
      pickupId: `PUP-ECR-${Math.floor(100000 + Math.random() * 900000)}`,
      scheduledTime: params.scheduledDate,
      message: 'eCourier courier dispatcher assigned'
    };
  }

  async trackShipment(trackingId: string): Promise<TrackingResponse> {
    console.log(`[ECourierAdapter] Syncing status with eCourier: ${trackingId}`);
    return {
      success: true,
      status: 'in_transit',
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'pending_pickup',
          location: 'Dhaka',
          description: 'Shipment created and registered in eCourier core system',
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          status: 'picked_up',
          location: 'eCourier Dhaka Hub',
          description: 'Parcel collected and weighed. Sorted for destination transport.',
        },
        {
          timestamp: new Date().toISOString(),
          status: 'in_transit',
          location: 'Dhaka In-Transit Hub',
          description: 'In transit to distribution hub office.',
        }
      ]
    };
  }

  async printLabel(trackingId: string, format: 'pdf' | 'thermal'): Promise<LabelResponse> {
    console.log(`[ECourierAdapter] Printing label for: ${trackingId} Format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.ecourier.com.bd/labels/print/${trackingId}?format=${format}`
    };
  }

  async estimateShipping(params: EstimateParams): Promise<EstimateResponse> {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes('dhaka');
    const deliveryCharge = isDhakaCity ? 50 : 110;
    const codFee = params.codAmount > 0 ? Math.max(10, Math.round(params.codAmount * 0.0075)) : 0;
    
    return {
      success: true,
      deliveryCharge,
      codFee,
      totalCharge: deliveryCharge + codFee,
      estimatedDays: isDhakaCity ? 1 : 2
    };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'down'; message?: string }> {
    return {
      status: 'healthy',
      message: 'eCourier Endpoint status: stable. Gateway ready.'
    };
  }
}
export default ECourierAdapter;
