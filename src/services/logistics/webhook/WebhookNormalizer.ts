import { ShipmentStatus } from '../../../types/shipment';

export interface NormalizedWebhookEvent {
  trackingNumber: string;
  status: ShipmentStatus;
  location: string;
  description: string;
  remarks?: string;
}

export class WebhookNormalizer {
  /**
   * Normalize any courier webhook payload into a unified LMS format
   */
  public static normalize(courier: string, payload: any): NormalizedWebhookEvent {
    const cleanCourier = courier.toLowerCase();
    
    switch (cleanCourier) {
      case 'steadfast':
        return {
          trackingNumber: payload.tracking_code || payload.trackingNumber || '',
          status: this.mapSteadfastStatus(payload.status_code || payload.status),
          location: payload.current_location || 'Steadfast Depot',
          description: payload.comment || `Steadfast status update: ${payload.status_code || 'unknown'}`,
          remarks: payload.comment
        };
        
      case 'pathao':
        return {
          trackingNumber: payload.consignment_id || payload.tracking_number || '',
          status: this.mapPathaoStatus(payload.status),
          location: payload.location || 'Pathao Station',
          description: payload.remarks || `Pathao checkpoint update: ${payload.status || 'unknown'}`,
          remarks: payload.remarks
        };
        
      case 'redx':
        return {
          trackingNumber: payload.tracking_id || payload.tracking_number || '',
          status: this.mapRedxStatus(payload.status),
          location: payload.location || 'REDX Hub',
          description: payload.note || `REDX routing checkpoint: ${payload.status || 'unknown'}`,
          remarks: payload.note
        };

      case 'paperfly':
        return {
          trackingNumber: payload.tracking_number || payload.barcode || '',
          status: this.mapPaperflyStatus(payload.status),
          location: payload.hub || payload.location || 'Paperfly Point',
          description: payload.comment || `Paperfly scanned: ${payload.status || 'unknown'}`,
          remarks: payload.comment
        };

      case 'ecourier':
        return {
          trackingNumber: payload.tracking_id || payload.ep_id || '',
          status: this.mapECourierStatus(payload.status),
          location: payload.location || payload.branch || 'eCourier Office',
          description: payload.remarks || payload.status_desc || `eCourier status: ${payload.status || 'unknown'}`,
          remarks: payload.remarks
        };

      case 'sundarban':
        return {
          trackingNumber: payload.sdn_tracking || payload.consignment_no || '',
          status: this.mapSundarbanStatus(payload.sdn_status || payload.status),
          location: payload.location || 'Sundarban Branch',
          description: payload.message || `Sundarban tracking event: ${payload.sdn_status || payload.status}`,
          remarks: payload.message
        };
        
      default:
        // Generic fallback normalizer
        return {
          trackingNumber: payload.trackingNumber || payload.trackingId || payload.id || '',
          status: (payload.status || 'in_transit') as ShipmentStatus,
          location: payload.location || 'Sorting Facility',
          description: payload.description || payload.message || 'Status updated via webhook'
        };
    }
  }

  private static mapSteadfastStatus(status: string): ShipmentStatus {
    const s = String(status).toLowerCase();
    if (s.includes('delivered') || s === 'success') return 'delivered';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('hold') || s.includes('pending')) return 'pending_pickup';
    if (s.includes('pick') || s.includes('received')) return 'picked_up';
    if (s.includes('return')) return 'returned';
    if (s.includes('fail') || s.includes('reject')) return 'failed_delivery';
    return 'in_transit';
  }

  private static mapPathaoStatus(status: string): ShipmentStatus {
    const s = String(status).toLowerCase();
    if (s.includes('delivered')) return 'delivered';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('pending') || s.includes('created')) return 'pending_pickup';
    if (s.includes('picked') || s.includes('received')) return 'picked_up';
    if (s.includes('return')) return 'returned';
    if (s.includes('fail') || s.includes('reject') || s.includes('undelivered')) return 'failed_delivery';
    return 'in_transit';
  }

  private static mapRedxStatus(status: string): ShipmentStatus {
    const s = String(status).toLowerCase();
    if (s.includes('delivered')) return 'delivered';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('ready_to_pickup') || s.includes('pending')) return 'pending_pickup';
    if (s.includes('picked') || s.includes('received')) return 'picked_up';
    if (s.includes('return')) return 'returned';
    if (s.includes('failed') || s.includes('retry')) return 'failed_delivery';
    return 'in_transit';
  }

  private static mapPaperflyStatus(status: string): ShipmentStatus {
    const s = String(status).toLowerCase();
    if (s.includes('delivered') || s === 'done') return 'delivered';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('pending') || s.includes('order')) return 'pending_pickup';
    if (s.includes('received') || s.includes('picked')) return 'picked_up';
    if (s.includes('return')) return 'returned';
    if (s.includes('failed') || s.includes('undelivered')) return 'failed_delivery';
    return 'in_transit';
  }

  private static mapECourierStatus(status: string): ShipmentStatus {
    const s = String(status).toLowerCase();
    if (s.includes('delivered') || s.includes('success')) return 'delivered';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('pending')) return 'pending_pickup';
    if (s.includes('picked') || s.includes('received')) return 'picked_up';
    if (s.includes('return')) return 'returned';
    if (s.includes('failed') || s.includes('undelivered') || s.includes('hold')) return 'failed_delivery';
    return 'in_transit';
  }

  private static mapSundarbanStatus(status: string): ShipmentStatus {
    const s = String(status).toLowerCase();
    if (s.includes('delivered') || s === 'success' || s === 'delivered_ready') return 'delivered';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('booking') || s === 'pending') return 'pending_pickup';
    if (s.includes('received') || s === 'dispatched') return 'picked_up';
    if (s.includes('return')) return 'returned';
    if (s.includes('failed') || s.includes('unreached')) return 'failed_delivery';
    return 'in_transit';
  }
}
