/**
 * useShipmentOperations
 * 
 * Helper hook for common shipment operations.
 * Wraps ShipmentContext with additional logic.
 */

import { useCallback, useState } from 'react';
import { useShipment } from '../contexts/ShipmentContext';
import toast from 'react-hot-toast';

interface UseShipmentOperationsReturn {
  isCreatingShipment: boolean;
  isRequestingPickup: boolean;
  isGeneratingLabel: boolean;
  isCancelling: boolean;
  
  handleCreateShipment: (courierCode: string) => Promise<void>;
  handleRequestPickup: () => Promise<void>;
  handleGenerateLabel: (format: 'pdf' | 'thermal') => Promise<void>;
  handleCancelShipment: (reason: string) => Promise<void>;
  handleRefreshTracking: () => Promise<void>;
}

export const useShipmentOperations = (): UseShipmentOperationsReturn => {
  const {
    createShipment,
    requestPickup,
    generateLabel,
    cancelShipment,
    refreshTracking
  } = useShipment();

  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [isRequestingPickup, setIsRequestingPickup] = useState(false);
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCreateShipment = useCallback(
    async (courierCode: string) => {
      try {
        setIsCreatingShipment(true);
        await createShipment(courierCode);
        toast.success('Shipment created successfully');
      } catch (error: any) {
        toast.error(error.message || 'Failed to create shipment');
        throw error;
      } finally {
        setIsCreatingShipment(false);
      }
    },
    [createShipment]
  );

  const handleRequestPickup = useCallback(async () => {
    try {
      setIsRequestingPickup(true);
      await requestPickup();
      toast.success('Pickup requested successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to request pickup');
      throw error;
    } finally {
      setIsRequestingPickup(false);
    }
  }, [requestPickup]);

  const handleGenerateLabel = useCallback(
    async (format: 'pdf' | 'thermal') => {
      try {
        setIsGeneratingLabel(true);
        const labelBlob = await generateLabel(format);
        
        // Download label
        const url = URL.createObjectURL(labelBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shipping-label-${Date.now()}.${format === 'pdf' ? 'pdf' : 'txt'}`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast.success('Label generated and downloaded');
      } catch (error: any) {
        toast.error(error.message || 'Failed to generate label');
        throw error;
      } finally {
        setIsGeneratingLabel(false);
      }
    },
    [generateLabel]
  );

  const handleCancelShipment = useCallback(
    async (reason: string) => {
      try {
        setIsCancelling(true);
        await cancelShipment(reason);
        toast.success('Shipment cancelled successfully');
      } catch (error: any) {
        toast.error(error.message || 'Failed to cancel shipment');
        throw error;
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelShipment]
  );

  const handleRefreshTracking = useCallback(
    async () => {
      try {
        await refreshTracking();
        toast.success('Tracking updated');
      } catch (error: any) {
        toast.error(error.message || 'Failed to refresh tracking');
        throw error;
      }
    },
    [refreshTracking]
  );

  return {
    isCreatingShipment,
    isRequestingPickup,
    isGeneratingLabel,
    isCancelling,
    handleCreateShipment,
    handleRequestPickup,
    handleGenerateLabel,
    handleCancelShipment,
    handleRefreshTracking
  };
};
