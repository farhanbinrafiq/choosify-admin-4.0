import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { operationsApi, OpsFeeCharge, OpsFeeChargeType, OpsFeeRateType, OpsFeeScopeType, OpsPaymentOptionsConfig } from '../services/operationsApi';

export type FeeChargeType = OpsFeeChargeType;
export type FeeRateType = OpsFeeRateType;
export type FeeScopeType = OpsFeeScopeType;

export interface FeeCharge extends OpsFeeCharge {}
export interface PaymentOptionsConfig extends OpsPaymentOptionsConfig {}

export interface FeeBreakdownLine {
  feeId: string;
  name: string;
  type: FeeChargeType;
  rateType: FeeRateType;
  rateValue: number;
  amount: number;
}

export interface FeePreviewInput {
  basePrice: number;
  brandId?: string;
  categoryId?: string;
  productId?: string;
}

export interface FeePreviewResult {
  basePrice: number;
  lines: FeeBreakdownLine[];
  totalFees: number;
  finalPrice: number;
}

interface FeeChargesContextType {
  feeCharges: FeeCharge[];
  paymentOptions: PaymentOptionsConfig;
  loading: boolean;
  createFeeCharge: (fee: Omit<FeeCharge, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateFeeCharge: (id: string, updates: Partial<FeeCharge>) => Promise<void>;
  deleteFeeCharge: (id: string) => Promise<void>;
  toggleFeeChargeActive: (id: string) => Promise<void>;
  updatePaymentOptions: (updates: Partial<Omit<PaymentOptionsConfig, 'updatedAt'>>) => Promise<void>;
  previewFees: (input: FeePreviewInput) => FeePreviewResult;
}

const FeeChargesContext = createContext<FeeChargesContextType | undefined>(undefined);

export const useFeeCharges = () => {
  const context = useContext(FeeChargesContext);
  if (!context) throw new Error('useFeeCharges must be used within a FeeChargesProvider');
  return context;
};

const DEFAULT_PAYMENT_OPTIONS: PaymentOptionsConfig = {
  partialPaymentEnabled: true,
  minDepositPercent: 10,
  maxDepositPercent: 50,
  updatedAt: new Date().toISOString(),
};

export const FeeChargesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [feeCharges, setFeeCharges] = useState<FeeCharge[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptionsConfig>(DEFAULT_PAYMENT_OPTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([operationsApi.listFeeCharges(), operationsApi.getPaymentOptionsConfig()])
      .then(([fees, options]) => {
        if (cancelled) return;
        setFeeCharges(fees);
        setPaymentOptions(options);
      })
      .catch(() => {
        // fall back to empty/default state; page-level actions will surface toast errors
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createFeeCharge: FeeChargesContextType['createFeeCharge'] = async (fee) => {
    try {
      const saved = await operationsApi.upsertFeeCharge(fee);
      setFeeCharges((prev) => [saved, ...prev]);
      toast.success(`Fee/charge "${saved.name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create fee/charge rule');
      throw err;
    }
  };

  const updateFeeCharge: FeeChargesContextType['updateFeeCharge'] = async (id, updates) => {
    try {
      const saved = await operationsApi.upsertFeeCharge({ ...updates, id });
      setFeeCharges((prev) => prev.map((f) => (f.id === id ? saved : f)));
      toast.success(`Fee/charge "${saved.name}" updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fee/charge rule');
      throw err;
    }
  };

  const deleteFeeCharge: FeeChargesContextType['deleteFeeCharge'] = async (id) => {
    try {
      await operationsApi.deleteFeeCharge(id);
      setFeeCharges((prev) => prev.filter((f) => f.id !== id));
      toast.success('Fee/charge rule deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete fee/charge rule');
      throw err;
    }
  };

  const toggleFeeChargeActive: FeeChargesContextType['toggleFeeChargeActive'] = async (id) => {
    const existing = feeCharges.find((f) => f.id === id);
    if (!existing) return;
    await updateFeeCharge(id, { active: !existing.active });
  };

  const updatePaymentOptions: FeeChargesContextType['updatePaymentOptions'] = async (updates) => {
    if (
      updates.minDepositPercent !== undefined &&
      updates.maxDepositPercent !== undefined &&
      updates.minDepositPercent > updates.maxDepositPercent
    ) {
      toast.error('Minimum deposit % cannot exceed maximum deposit %');
      throw new Error('Invalid deposit percent range');
    }
    try {
      const saved = await operationsApi.updatePaymentOptionsConfig(updates);
      setPaymentOptions(saved);
      toast.success('Payment options updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update payment options');
      throw err;
    }
  };

  const previewFees: FeeChargesContextType['previewFees'] = ({ basePrice, brandId, categoryId, productId }) => {
    const applicable = feeCharges.filter((fee) => {
      if (!fee.active) return false;
      if (fee.scopeType === 'platform') return true;
      if (fee.scopeType === 'brand') return !!brandId && !!fee.scopeBrandIds?.includes(brandId);
      if (fee.scopeType === 'category') return !!categoryId && !!fee.scopeCategoryIds?.includes(categoryId);
      if (fee.scopeType === 'product') return !!productId && !!fee.scopeProductIds?.includes(productId);
      return false;
    });

    const lines: FeeBreakdownLine[] = applicable.map((fee) => ({
      feeId: fee.id,
      name: fee.name,
      type: fee.type,
      rateType: fee.rateType,
      rateValue: fee.rateValue,
      amount: fee.rateType === 'percentage' ? Math.round((basePrice * fee.rateValue) / 100) : fee.rateValue,
    }));

    const totalFees = lines.reduce((sum, line) => sum + line.amount, 0);

    return {
      basePrice,
      lines,
      totalFees,
      finalPrice: basePrice + totalFees,
    };
  };

  return (
    <FeeChargesContext.Provider
      value={{
        feeCharges,
        paymentOptions,
        loading,
        createFeeCharge,
        updateFeeCharge,
        deleteFeeCharge,
        toggleFeeChargeActive,
        updatePaymentOptions,
        previewFees,
      }}
    >
      {children}
    </FeeChargesContext.Provider>
  );
};
