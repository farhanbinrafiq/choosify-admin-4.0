import { Address, Contact } from './courier';

export interface ShippingRule {
  id: string;
  sellerId: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    destinationDistricts?: string[];
    weightRange?: { min: number; max: number };
    orderValueRange?: { min: number; max: number };
  };
  action: {
    courierCode: string;
    packageType: string;
    autoRequestPickup: boolean;
    autoGenerateLabel: boolean;
  };
  createdAt: string;
}

export interface Warehouse {
  id: string;
  sellerId: string;
  name: string;
  address: Address;
  contactPerson: Contact;
  isDefault: boolean;
  couriers: string[]; // enabled courier codes
  preferredCourier: string;
  createdAt: string;
}

export interface ShipmentAnalytics {
  totalShipments: number;
  byStatus: {
    pending_pickup: number;
    picked_up: number;
    in_transit: number;
    delivered: number;
    failed_delivery: number;
    returned: number;
    cancelled: number;
  };
  byCourier: {
    [courierCode: string]: number;
  };
  avgDeliveryTimeDays: number;
  successRatePercentage: number;
}
