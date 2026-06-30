export interface Address {
  street: string;
  city: string;
  district: string;
  postalCode: string;
  phone: string;
  email?: string;
}

export interface Contact {
  name: string;
  phone: string;
  email: string;
}

export interface CourierProviderConfig {
  id: string;
  name: string;
  code: string;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  sandbox: boolean;
  production: boolean;
  defaultPickupAddress?: Address;
  defaultReturnAddress?: Address;
  enabled: boolean;
  healthStatus: 'healthy' | 'degraded' | 'down';
  logo?: string;
  documentationUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  sandboxMode?: boolean;
  coverageDistricts?: string[];
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourierInfo {
  code: string;
  name: string;
}

export interface ConsignmentResponse {
  success: boolean;
  trackingNumber: string;
  waybillNumber?: string;
  rawResponse: any;
  error?: string;
}

export interface CancelResponse {
  success: boolean;
  message: string;
  rawResponse: any;
}

export interface PickupRequestParams {
  warehouseId?: string;
  pickupAddress: Address;
  contactPerson: Contact;
  scheduledDate: string;
  packageCount: number;
}

export interface PickupResponse {
  success: boolean;
  pickupId?: string;
  scheduledTime?: string;
  message?: string;
}

export interface TrackingResponse {
  success: boolean;
  status: string;
  trackingEvents: {
    timestamp: string;
    status: string;
    location: string;
    description: string;
    remarks?: string;
  }[];
}

export interface LabelResponse {
  success: boolean;
  labelUrl?: string;
  pdfData?: string; // base64 representation or raw string
}

export interface EstimateParams {
  weight: number;
  pickupDistrict: string;
  deliveryDistrict: string;
  codAmount: number;
}

export interface EstimateResponse {
  success: boolean;
  deliveryCharge: number;
  codFee: number;
  totalCharge: number;
  estimatedDays: number;
}
