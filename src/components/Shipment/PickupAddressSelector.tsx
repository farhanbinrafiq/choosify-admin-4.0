/**
 * PickupAddressSelector Component
 * 
 * Shows seller's default pickup address.
 */

import React from 'react';
import { MapPin } from 'lucide-react';

interface PickupAddressSelectorProps {
  seller: any;
}

export const PickupAddressSelector: React.FC<PickupAddressSelectorProps> = ({
  seller
}) => {
  // Default to seller's address
  const address = seller?.defaultPickupAddress || {
    street: seller?.address || 'House 14, Road 4, Sector 12',
    city: 'Dhaka',
    district: 'Dhaka',
    postalCode: '1230'
  };

  return (
    <div className="border border-app-border rounded-xl p-4 bg-app-bg">
      <div className="flex items-start gap-3">
        <MapPin size={18} className="text-[#F4631E] mt-0.5 flex-shrink-0" />
        <div className="text-xs text-app-text-secondary">
          <div className="font-bold text-app-text-primary mb-0.5">{address.street || 'Default Pickup Warehouse'}</div>
          <div className="font-mono text-app-text-secondary">
            {address.city}, {address.district} {address.postalCode}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PickupAddressSelector;
