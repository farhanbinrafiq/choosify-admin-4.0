import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useOrders } from './OrdersContext';
import { useAuth } from './AuthContext';
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
  /** True while the initial/refresh list fetch is in flight. */
  loading: boolean;
  /** Set when the list fetch fails; the list is not silently left stale with no explanation. */
  error: string | null;
  refresh: () => void;
  createReturnRequest: (params: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => Promise<ReturnRequest>;
  approveReturn: (id: string, refundAmount: number, note?: string) => Promise<ReturnRequest>;
  rejectReturn: (id: string, reason: string) => Promise<ReturnRequest>;
  processRefund: (id: string) => Promise<ReturnRequest>;
  addReturnNote: (id: string, note: string) => Promise<ReturnRequest>;
  updateReturnStatus: (id: string, newStatus: ReturnRequest['status']) => Promise<ReturnRequest>;
  generateReturnLabel: (id: string) => Promise<{ labelUrl: string; trackingId: string; courier: string }>;
  linkReturnToDispute: (returnId: string, disputeId: string) => Promise<ReturnRequest>;
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
  const { loading: authLoading, profile } = useAuth();
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    operationsApi
      .listReturns()
      .then((rows) => setReturnRequests(rows))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load returns');
      })
      .finally(() => setLoading(false));
  }, []);

  // Pre-commit audit follow-up: this used to fire on every mount regardless of
  // whether the session had finished restoring, racing AuthContext's async
  // token bootstrap and producing a spurious first-paint 401 for every role
  // (including admin). Wait for auth to resolve, and only fetch once a real
  // session exists — there's nothing to return-list for a logged-out visitor.
  useEffect(() => {
    if (authLoading || !profile) return;
    refresh();
  }, [authLoading, profile, refresh]);

  const createReturnRequest = async (
    params: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt' | 'notes'>,
  ): Promise<ReturnRequest> => {
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

    try {
      const saved = await operationsApi.createReturn(params);
      setReturnRequests((prev) => {
        const withoutOptimistic = prev.filter((r) => r.id !== optimistic.id);
        return upsertLocal(withoutOptimistic, saved);
      });
      addAdminNote(params.orderId, `Return requested (${saved.id}) due to reason: ${params.reason}.`);
      updateOrderStatus(params.orderId, 'Returned');
      return saved;
    } catch (err) {
      // Roll back the optimistic row — it never actually persisted.
      setReturnRequests((prev) => prev.filter((r) => r.id !== optimistic.id));
      throw err;
    }
  };

  const approveReturn = async (id: string, refundAmount: number, note?: string): Promise<ReturnRequest> => {
    const saved = await operationsApi.approveReturn(id, refundAmount, note, 'Admin Main');
    setReturnRequests((prev) => upsertLocal(prev, saved));
    updateOrderStatus(saved.orderId, 'Returned');
    addAdminNote(saved.orderId, `Return approved. Refund amount locked at ৳${refundAmount}.`);
    return saved;
  };

  const rejectReturn = async (id: string, reason: string): Promise<ReturnRequest> => {
    const saved = await operationsApi.rejectReturn(id, reason, 'Admin Main');
    setReturnRequests((prev) => upsertLocal(prev, saved));
    addAdminNote(saved.orderId, `Return request ${saved.id} was rejected. Reason: ${reason}`);
    return saved;
  };

  const processRefund = async (id: string): Promise<ReturnRequest> => {
    const saved = await operationsApi.processReturnRefund(id);
    setReturnRequests((prev) => upsertLocal(prev, saved));
    addAdminNote(saved.orderId, `Refund of ৳${saved.refundAmount || 0} has been processed successfully.`);
    return saved;
  };

  const addReturnNote = async (id: string, note: string): Promise<ReturnRequest> => {
    const saved = await operationsApi.addReturnNote(id, note);
    setReturnRequests((prev) => upsertLocal(prev, saved));
    return saved;
  };

  const updateReturnStatus = async (id: string, newStatus: ReturnRequest['status']): Promise<ReturnRequest> => {
    const saved = await operationsApi.updateReturnStatus(id, newStatus);
    setReturnRequests((prev) => upsertLocal(prev, saved));
    if (newStatus === 'returned_in_transit') {
      addAdminNote(
        saved.orderId,
        `Return item is in transit back to seller. Tracking ID: ${saved.returnTrackingId || 'N/A'}`,
      );
    } else if (newStatus === 'received') {
      addAdminNote(saved.orderId, 'Return item received by warehouse/seller. Verification of item in progress.');
    }
    return saved;
  };

  const generateReturnLabel = async (id: string): Promise<{ labelUrl: string; trackingId: string; courier: string }> => {
    // The label, tracking ID and courier are generated server-side — never
    // fabricate them client-side, since the row saved here must match what
    // the backend actually persisted.
    const result = await operationsApi.generateReturnLabel(id);
    setReturnRequests((prev) => upsertLocal(prev, result.data));
    return { labelUrl: result.labelUrl, trackingId: result.trackingId, courier: result.courier };
  };

  const linkReturnToDispute = async (returnId: string, disputeId: string): Promise<ReturnRequest> => {
    const saved = await operationsApi.linkReturnToDispute(returnId, disputeId);
    setReturnRequests((prev) => upsertLocal(prev, saved));
    return saved;
  };

  return (
    <ReturnsContext.Provider
      value={{
        returnRequests,
        loading,
        error,
        refresh,
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
