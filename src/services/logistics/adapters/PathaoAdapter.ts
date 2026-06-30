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

export class PathaoAdapter implements CourierProvider {
  name = 'Pathao';
  code = 'pathao';
  logo = 'https://pathao.com/wp-content/uploads/2018/12/Pathao_logo_red.png';

  private apiKey: string = '';
  private apiSecret: string = '';
  private apiUrl: string = 'https://api.pathao.com';
  private sandbox: boolean = true;

  constructor(config?: { apiKey?: string; apiSecret?: string; apiUrl?: string; sandbox?: boolean }) {
    if (config) {
      this.apiKey = config.apiKey || '';
      this.apiSecret = config.apiSecret || '';
      this.apiUrl = config.apiUrl || 'https://api.pathao.com';
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
    console.log(`[PathaoAdapter] Creating consignment for Invoice: ${params.invoiceId}, COD: ${params.codAmount}`);

    const simulatedTracking = `PTH${Math.floor(10000000 + Math.random() * 90000000)}`;
    const simulatedWaybill = `WB-PTH-${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    return {
      success: true,
      trackingNumber: simulatedTracking,
      waybillNumber: simulatedWaybill,
      rawResponse: {
        status: 200,
        message: 'Order created successfully (Simulated Pathao Sandbox)',
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
    console.log(`[PathaoAdapter] Cancelling consignment: ${trackingId}`);
    return {
      success: true,
      message: 'Order cancelled successfully (Simulated Pathao Sandbox)',
      rawResponse: { status: 200, message: 'Cancelled' }
    };
  }

  async requestPickup(params: PickupRequestParams): Promise<PickupResponse> {
    console.log(`[PathaoAdapter] Requesting pickup from ${params.pickupAddress.city}, package count: ${params.packageCount}`);
    return {
      success: true,
      pickupId: `PUP-PTH-${Math.floor(100000 + Math.random() * 900000)}`,
      scheduledTime: params.scheduledDate,
      message: 'Pathao pickup scheduled successfully'
    };
  }

  async trackShipment(trackingId: string): Promise<TrackingResponse> {
    console.log(`[PathaoAdapter] Tracking consignment: ${trackingId}`);
    return {
      success: true,
      status: 'in_transit',
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'pending_pickup',
          location: 'Dhaka',
          description: 'Shipment created and scheduled for Pathao pickup',
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          status: 'picked_up',
          location: 'Dhaka Central Warehouse',
          description: 'Package received at Pathao sorting hub',
        },
        {
          timestamp: new Date().toISOString(),
          status: 'in_transit',
          location: 'Destination Hub',
          description: 'Consignment is in transit on Pathao vehicle',
          remarks: 'Expected delivery soon'
        }
      ]
    };
  }

  async printLabel(trackingId: string, format: 'pdf' | 'thermal'): Promise<LabelResponse> {
    console.log(`[PathaoAdapter] Printing label for: ${trackingId} format: ${format}`);
    return {
      success: true,
      labelUrl: `https://api.pathao.com/labels/print/${trackingId}?format=${format}`
    };
  }

  async estimateShipping(params: EstimateParams): Promise<EstimateResponse> {
    const isDhakaCity = params.deliveryDistrict.toLowerCase().includes('dhaka');
    const deliveryCharge = isDhakaCity ? 55 : 115;
    const codFee = params.codAmount > 0 ? Math.max(10, Math.round(params.codAmount * 0.005)) : 0;
    
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
      message: 'Pathao Adapter initialized successfully'
    };
  }
}
export default PathaoAdapter;
