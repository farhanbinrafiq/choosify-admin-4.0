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

export interface CourierProvider {
  name: string;
  code: string;
  logo?: string;

  createConsignment(params: any): Promise<ConsignmentResponse>;
  cancelConsignment(trackingId: string): Promise<CancelResponse>;
  requestPickup(params: PickupRequestParams): Promise<PickupResponse>;
  trackShipment(trackingId: string): Promise<TrackingResponse>;
  printLabel(trackingId: string, format: 'pdf' | 'thermal'): Promise<LabelResponse>;
  estimateShipping(params: EstimateParams): Promise<EstimateResponse>;
  healthCheck(): Promise<{ status: 'healthy' | 'down'; message?: string }>;
}
