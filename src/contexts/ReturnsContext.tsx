import React, { createContext, useContext, useState, useEffect } from 'react';
import { useOrders, OrderStatus } from './OrdersContext';

export interface ReturnRequest {
  id: string;
  orderId: string;
  itemId: string;
  initiatedBy: 'customer' | 'admin';
  reason: 'defective' | 'damaged' | 'wrong_item' | 'not_as_described' | 'customer_changed_mind';
  description: string;
  evidencePhotos: string[];
  status: 'initiated' | 'approved' | 'rejected' | 'returned_in_transit' | 'received' | 'refunded' | 'dispute';
  approvalDecision?: 'approved' | 'rejected';
  approvalReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  refundAmount?: number;
  refundStatus: 'pending' | 'processed' | 'failed';
  returnTrackingId?: string;
  returnCourier?: string;
  pickupDate?: string;
  deliveryDate?: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
  sellerId: string;
  buyerId: string;
}

interface ReturnsContextType {
  returnRequests: ReturnRequest[];
  createReturnRequest: (params: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => ReturnRequest;
  approveReturn: (id: string, refundAmount: number, note?: string) => void;
  rejectReturn: (id: string, reason: string) => void;
  processRefund: (id: string) => void;
  addReturnNote: (id: string, note: string) => void;
  updateReturnStatus: (id: string, newStatus: ReturnRequest['status']) => void;
  generateReturnLabel: (id: string) => { labelUrl: string; trackingId: string; courier: string };
  linkReturnToDispute: (returnId: string, disputeId: string) => void;
}

const ReturnsContext = createContext<ReturnsContextType | undefined>(undefined);

export const useReturns = () => {
  const context = useContext(ReturnsContext);
  if (!context) throw new Error('useReturns must be used within a ReturnsProvider');
  return context;
};

const initialReturnRequests: ReturnRequest[] = [
  {
    id: 'RET-4912',
    orderId: 'CSS-5561',
    itemId: '101',
    initiatedBy: 'customer',
    reason: 'defective',
    description: 'The embroidery on the Silk Panjabi is coming loose in several areas on the sleeve.',
    evidencePhotos: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80'
    ],
    status: 'initiated',
    refundStatus: 'pending',
    notes: ['Initial customer complaint filed via e-commerce portal.'],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    sellerId: 'seller_001',
    buyerId: 'cust_004'
  },
  {
    id: 'RET-3811',
    orderId: 'CSS-9921',
    itemId: '101',
    initiatedBy: 'customer',
    reason: 'wrong_item',
    description: 'Received size L instead of size M as confirmed. Fabric and fitting are incorrect.',
    evidencePhotos: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80'
    ],
    status: 'approved',
    approvalDecision: 'approved',
    approvalReason: 'Verified sizing mistake from warehouse logistics records.',
    approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    approvedBy: 'Admin Main',
    refundAmount: 4200,
    refundStatus: 'pending',
    returnCourier: 'Pathao Delivery',
    returnTrackingId: 'PATHAO-RET-9921',
    pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: ['Sizing mismatch confirmed from seller ledger.', 'Return shipping label generated.'],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    sellerId: 'seller_001',
    buyerId: 'cust_001'
  },
  {
    id: 'RET-2210',
    orderId: 'CSS-9844',
    itemId: '102',
    initiatedBy: 'admin',
    reason: 'damaged',
    description: 'Package damaged during transit logistics handover. Scratches on formal leather.',
    evidencePhotos: [],
    status: 'refunded',
    approvalDecision: 'approved',
    approvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    approvedBy: 'Admin Main',
    refundAmount: 3500,
    refundStatus: 'processed',
    notes: ['Admin initialized return on behalf of customer.', 'Refund processed via SSLCommerz gateway.'],
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    sellerId: 'seller_001',
    buyerId: 'cust_001'
  }
];

export const ReturnsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { orders, updateOrderStatus, addAdminNote } = useOrders();

  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>(() => {
    const saved = localStorage.getItem('choosify_returns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing returns from localStorage', e);
      }
    }
    return initialReturnRequests;
  });

  // Keep localStorage in sync
  useEffect(() => {
    localStorage.setItem('choosify_returns', JSON.stringify(returnRequests));
  }, [returnRequests]);

  /**
   * Creates a new return request.
   */
  const createReturnRequest = (params: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt' | 'notes'>): ReturnRequest => {
    const newReturn: ReturnRequest = {
      ...params,
      id: `RET-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: ['Return request created.'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = [newReturn, ...returnRequests];
    setReturnRequests(updated);
    
    // Also log this in the orders note
    addAdminNote(params.orderId, `Return requested (${newReturn.id}) due to reason: ${params.reason}.`);
    updateOrderStatus(params.orderId, 'Returned');

    return newReturn;
  };

  /**
   * Approves a return request and updates order status.
   */
  const approveReturn = (id: string, refundAmount: number, note?: string) => {
    setReturnRequests(prev => prev.map(ret => {
      if (ret.id === id) {
        const adminNotes = [...ret.notes];
        if (note) adminNotes.push(note);
        adminNotes.push(`Return approved with refund of ৳${refundAmount}. Waiting for item return.`);

        // Sync back with the orders context
        updateOrderStatus(ret.orderId, 'Returned');
        addAdminNote(ret.orderId, `Return approved. Refund amount locked at ৳${refundAmount}.`);

        return {
          ...ret,
          status: 'approved',
          approvalDecision: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: 'Admin Main',
          refundAmount,
          notes: adminNotes,
          updatedAt: new Date().toISOString()
        };
      }
      return ret;
    }));
  };

  /**
   * Rejects a return request.
   */
  const rejectReturn = (id: string, reason: string) => {
    setReturnRequests(prev => prev.map(ret => {
      if (ret.id === id) {
        const adminNotes = [...ret.notes];
        adminNotes.push(`Return rejected. Reason: "${reason}"`);

        // Update corresponding order's notes
        addAdminNote(ret.orderId, `Return request ${ret.id} was rejected. Reason: ${reason}`);

        return {
          ...ret,
          status: 'rejected',
          approvalDecision: 'rejected',
          approvalReason: reason,
          approvedAt: new Date().toISOString(),
          approvedBy: 'Admin Main',
          notes: adminNotes,
          updatedAt: new Date().toISOString()
        };
      }
      return ret;
    }));
  };

  /**
   * Processes the refund for a return request.
   */
  const processRefund = (id: string) => {
    setReturnRequests(prev => prev.map(ret => {
      if (ret.id === id) {
        const adminNotes = [...ret.notes];
        adminNotes.push('Refund successfully processed back to customer payment channel.');

        // Update corresponding order notes and billing status
        addAdminNote(ret.orderId, `Refund of ৳${ret.refundAmount || 0} has been processed successfully.`);

        return {
          ...ret,
          status: 'refunded',
          refundStatus: 'processed',
          notes: adminNotes,
          updatedAt: new Date().toISOString()
        };
      }
      return ret;
    }));
  };

  /**
   * Adds an internal note to a return request.
   */
  const addReturnNote = (id: string, note: string) => {
    setReturnRequests(prev => prev.map(ret => {
      if (ret.id === id) {
        return {
          ...ret,
          notes: [...ret.notes, `[${new Date().toISOString()}] ${note}`],
          updatedAt: new Date().toISOString()
        };
      }
      return ret;
    }));
  };

  /**
   * General status update.
   */
  const updateReturnStatus = (id: string, newStatus: ReturnRequest['status']) => {
    setReturnRequests(prev => prev.map(ret => {
      if (ret.id === id) {
        const adminNotes = [...ret.notes];
        adminNotes.push(`Status transitioned to: ${newStatus.toUpperCase()}`);

        if (newStatus === 'returned_in_transit') {
          addAdminNote(ret.orderId, `Return item is in transit back to seller. Tracking ID: ${ret.returnTrackingId || 'N/A'}`);
        } else if (newStatus === 'received') {
          addAdminNote(ret.orderId, `Return item received by warehouse/seller. Verification of item in progress.`);
        }

        return {
          ...ret,
          status: newStatus,
          notes: adminNotes,
          updatedAt: new Date().toISOString()
        };
      }
      return ret;
    }));
  };

  /**
   * Generates a printable shipping/return label.
   */
  const generateReturnLabel = (id: string) => {
    const trackingId = `PATHAO-RET-${Math.floor(100000 + Math.random() * 900000)}`;
    const courier = 'Pathao Delivery';

    setReturnRequests(prev => prev.map(ret => {
      if (ret.id === id) {
        return {
          ...ret,
          returnTrackingId: trackingId,
          returnCourier: courier,
          notes: [...ret.notes, `Prepaid Return Label generated with tracking ID ${trackingId}.`],
          updatedAt: new Date().toISOString()
        };
      }
      return ret;
    }));

    return {
      labelUrl: `https://api.choosify.bd/logistics/label/${trackingId}`,
      trackingId,
      courier
    };
  };

  /**
   * Connects this return request to an active dispute.
   */
  const linkReturnToDispute = (returnId: string, disputeId: string) => {
    setReturnRequests(prev => prev.map(ret => {
      if (ret.id === returnId) {
        return {
          ...ret,
          status: 'dispute',
          notes: [...ret.notes, `Escalated to Dispute resolution system. Dispute ID: ${disputeId}`],
          updatedAt: new Date().toISOString()
        };
      }
      return ret;
    }));
  };

  return (
    <ReturnsContext.Provider value={{
      returnRequests,
      createReturnRequest,
      approveReturn,
      rejectReturn,
      processRefund,
      addReturnNote,
      updateReturnStatus,
      generateReturnLabel,
      linkReturnToDispute
    }}>
      {children}
    </ReturnsContext.Provider>
  );
};
