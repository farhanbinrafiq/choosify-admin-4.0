import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useOrders } from './OrdersContext';
import { operationsApi } from '../services/operationsApi';

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
  disputeId?: string;
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

function upsertLocal(prev: ReturnRequest[], row: ReturnRequest): ReturnRequest[] {
  const idx = prev.findIndex((r) => r.id === row.id);
  if (idx < 0) return [row, ...prev];
  const next = [...prev];
  next[idx] = row;
  return next;
}

export const ReturnsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { updateOrderStatus, addAdminNote } = useOrders();
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);

  const refresh = useCallback(() => {
    operationsApi
      .listReturns()
      .then((rows) => setReturnRequests(rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createReturnRequest = (
    params: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt' | 'notes'>,
  ): ReturnRequest => {
    const optimistic: ReturnRequest = {
      ...params,
      id: `RET-${Date.now()}`,
      notes: ['Return request created.'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      refundStatus: params.refundStatus || 'pending',
      evidencePhotos: params.evidencePhotos || [],
    };
    setReturnRequests((prev) => [optimistic, ...prev]);
    addAdminNote(params.orderId, `Return requested (${optimistic.id}) due to reason: ${params.reason}.`);
    updateOrderStatus(params.orderId, 'Returned');

    operationsApi
      .createReturn(params)
      .then((saved) => {
        setReturnRequests((prev) => {
          const withoutOptimistic = prev.filter((r) => r.id !== optimistic.id);
          return upsertLocal(withoutOptimistic, saved);
        });
      })
      .catch(() => {
        setReturnRequests((prev) => prev.filter((r) => r.id !== optimistic.id));
      });

    return optimistic;
  };

  const approveReturn = (id: string, refundAmount: number, note?: string) => {
    operationsApi
      .approveReturn(id, refundAmount, note, 'Admin Main')
      .then((saved) => {
        setReturnRequests((prev) => upsertLocal(prev, saved));
        updateOrderStatus(saved.orderId, 'Returned');
        addAdminNote(saved.orderId, `Return approved. Refund amount locked at ৳${refundAmount}.`);
      })
      .catch(() => {});
  };

  const rejectReturn = (id: string, reason: string) => {
    operationsApi
      .rejectReturn(id, reason, 'Admin Main')
      .then((saved) => {
        setReturnRequests((prev) => upsertLocal(prev, saved));
        addAdminNote(saved.orderId, `Return request ${saved.id} was rejected. Reason: ${reason}`);
      })
      .catch(() => {});
  };

  const processRefund = (id: string) => {
    operationsApi
      .processReturnRefund(id)
      .then((saved) => {
        setReturnRequests((prev) => upsertLocal(prev, saved));
        addAdminNote(saved.orderId, `Refund of ৳${saved.refundAmount || 0} has been processed successfully.`);
      })
      .catch(() => {});
  };

  const addReturnNote = (id: string, note: string) => {
    operationsApi
      .addReturnNote(id, note)
      .then((saved) => setReturnRequests((prev) => upsertLocal(prev, saved)))
      .catch(() => {});
  };

  const updateReturnStatus = (id: string, newStatus: ReturnRequest['status']) => {
    operationsApi
      .updateReturnStatus(id, newStatus)
      .then((saved) => {
        setReturnRequests((prev) => upsertLocal(prev, saved));
        if (newStatus === 'returned_in_transit') {
          addAdminNote(
            saved.orderId,
            `Return item is in transit back to seller. Tracking ID: ${saved.returnTrackingId || 'N/A'}`,
          );
        } else if (newStatus === 'received') {
          addAdminNote(
            saved.orderId,
            'Return item received by warehouse/seller. Verification of item in progress.',
          );
        }
      })
      .catch(() => {});
  };

  const generateReturnLabel = (id: string) => {
    const trackingId = `PATHAO-RET-${Math.floor(100000 + Math.random() * 900000)}`;
    const courier = 'Pathao Delivery';
    const labelUrl = `https://api.choosify.bd/logistics/label/${trackingId}`;

    operationsApi
      .generateReturnLabel(id)
      .then((result) => {
        setReturnRequests((prev) => upsertLocal(prev, result.data));
      })
      .catch(() => {});

    return { labelUrl, trackingId, courier };
  };

  const linkReturnToDispute = (returnId: string, disputeId: string) => {
    operationsApi
      .linkReturnToDispute(returnId, disputeId)
      .then((saved) => setReturnRequests((prev) => upsertLocal(prev, saved)))
      .catch(() => {});
  };

  return (
    <ReturnsContext.Provider
      value={{
        returnRequests,
        createReturnRequest,
        approveReturn,
        rejectReturn,
        processRefund,
        addReturnNote,
        updateReturnStatus,
        generateReturnLabel,
        linkReturnToDispute,
      }}
    >
      {children}
    </ReturnsContext.Provider>
  );
};
