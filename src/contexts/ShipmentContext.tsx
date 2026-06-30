import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Shipment, TrackingEvent } from '../types/shipment';
import { CourierProviderConfig, EstimateResponse } from '../types/courier';
import { useLogistics } from './LogisticsContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LogisticsService from '../services/logistics/LogisticsService';

interface ShipmentContextType {
  // Existing keys
  shipment: Shipment | null;
  loading: boolean;
  error: string | null;
  recommendedCourier: CourierProviderConfig | null;
  dispatchOrder: (params: {
    orderId: string;
    sellerId: string;
    customerId: string;
    courierCode: string;
    pickupAddress: any;
    deliveryAddress: any;
    sellerContact: any;
    customerContact: any;
    codAmount: number;
    weight: number;
    packageType: 'regular' | 'express' | 'fragile' | 'perishable';
    contents: any[];
  }) => Promise<Shipment>;
  cancelOrderShipment: (reason: string) => Promise<void>;
  refreshTrackingStatus: () => Promise<void>;

  // Proposed keys (mapped for compatibility with Phase 2)
  currentShipment: Shipment | null;
  shipmentLoading: boolean;
  shipmentError: Error | null;
  selectedCourierCode: string | null;
  shippingEstimate: EstimateResponse | null;
  estimateLoading: boolean;
  selectCourier: (courierCode: string) => Promise<void>;
  createShipment: (courierCode: string) => Promise<Shipment>;
  requestPickup: () => Promise<void>;
  generateLabel: (format: 'pdf' | 'thermal') => Promise<Blob>;
  refreshTracking: () => Promise<void>;
  cancelShipment: (reason: string) => Promise<void>;
  trackingEvents: TrackingEvent[];
  trackingLoading: boolean;
  showTrackingTimeline: boolean;
  setShowTrackingTimeline: (show: boolean) => void;
}

const ShipmentContext = createContext<ShipmentContextType | undefined>(undefined);

export const ShipmentProvider: React.FC<{ 
  orderId: string; 
  sellerId: string;
  orderTotal: number;
  deliveryDistrict: string;
  seller?: any;
  customer?: any;
  items?: any[];
  codAmount?: number;
  children: React.ReactNode;
}> = ({ orderId, sellerId, orderTotal, deliveryDistrict, seller, customer, items, codAmount, children }) => {
  const { createShipment: callCreateShipment, cancelShipment: callCancelShipment, syncTracking, evaluateShippingRules, activeCouriers } = useLogistics();
  
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendedCourier, setRecommendedCourier] = useState<CourierProviderConfig | null>(null);

  // Proposed compatible states
  const [selectedCourierCode, setSelectedCourierCode] = useState<string | null>(null);
  const [shipmentError, setShipmentError] = useState<Error | null>(null);
  const [shippingEstimate, setShippingEstimate] = useState<EstimateResponse | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [showTrackingTimeline, setShowTrackingTimeline] = useState(true);

  const logisticsService = LogisticsService.getInstance();

  // 1. Subscribe to the specific shipment for this order
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'shipments'),
      where('orderId', '==', orderId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let found: Shipment | null = null;
        snapshot.forEach((doc) => {
          found = doc.data() as Shipment;
        });
        setShipment(found);
        setLoading(false);
      },
      (err) => {
        console.warn('Error listening to shipment changes from Firestore, using localStorage fallback:', err);
        const localShipmentsStr = localStorage.getItem('lms_shipments') || '[]';
        const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
        const found = localShipments.find(s => s.orderId === orderId) || null;
        setShipment(found);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  // 2. Evaluate rules to recommend a courier for this order
  useEffect(() => {
    const runRules = async () => {
      try {
        const matchedRule = await evaluateShippingRules({
          deliveryDistrict,
          totalAmount: orderTotal,
          weight: 1.0 // default weight fallback
        }, sellerId);

        if (matchedRule) {
          const courier = activeCouriers.find(c => c.code === matchedRule.action.courierCode);
          if (courier) {
            setRecommendedCourier(courier);
            setSelectedCourierCode(courier.code);
            return;
          }
        }

        // Default fallback recommendation (Steadfast if available)
        const defaultCourier = activeCouriers.find(c => c.code === 'steadfast') || activeCouriers[0] || null;
        setRecommendedCourier(defaultCourier);
        if (defaultCourier) {
          setSelectedCourierCode(defaultCourier.code);
        }
      } catch (err) {
        console.warn('Failed to calculate recommended courier:', err);
      }
    };

    if (activeCouriers.length > 0) {
      runRules();
    }
  }, [activeCouriers, deliveryDistrict, orderTotal, sellerId]);

  // 3. Dynamic Estimate Calculation
  useEffect(() => {
    const fetchEstimate = async () => {
      if (!selectedCourierCode) {
        setShippingEstimate(null);
        return;
      }
      try {
        setEstimateLoading(true);
        const estimate = await logisticsService.getAdapter(selectedCourierCode)?.estimateShipping({
          weight: 1.0,
          pickupDistrict: 'Dhaka',
          deliveryDistrict: deliveryDistrict || 'Dhaka',
          codAmount: codAmount || orderTotal,
        });
        if (estimate) {
          setShippingEstimate(estimate);
        }
      } catch (err) {
        console.warn('Failed to fetch shipping estimate:', err);
      } finally {
        setEstimateLoading(false);
      }
    };
    fetchEstimate();
  }, [selectedCourierCode, deliveryDistrict, orderTotal, codAmount]);

  const dispatchOrder = useCallback(async (params: {
    orderId: string;
    sellerId: string;
    customerId: string;
    courierCode: string;
    pickupAddress: any;
    deliveryAddress: any;
    sellerContact: any;
    customerContact: any;
    codAmount: number;
    weight: number;
    packageType: 'regular' | 'express' | 'fragile' | 'perishable';
    contents: any[];
  }) => {
    setLoading(true);
    setError(null);
    setShipmentError(null);
    try {
      const res = await callCreateShipment(params);
      return res;
    } catch (err: any) {
      setError(err.message || 'Dispatch failed');
      setShipmentError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [callCreateShipment]);

  const cancelOrderShipment = useCallback(async (reason: string) => {
    if (!shipment) return;
    setLoading(true);
    setError(null);
    setShipmentError(null);
    try {
      await callCancelShipment(shipment.id, reason);
    } catch (err: any) {
      setError(err.message || 'Cancellation failed');
      setShipmentError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [shipment, callCancelShipment]);

  const refreshTrackingStatus = useCallback(async () => {
    if (!shipment) return;
    setLoading(true);
    setError(null);
    setShipmentError(null);
    try {
      await syncTracking(shipment.id);
    } catch (err: any) {
      setError(err.message || 'Tracking sync failed');
      setShipmentError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [shipment, syncTracking]);

  // Compatible mappings
  const selectCourier = useCallback(async (courierCode: string) => {
    setSelectedCourierCode(courierCode);
  }, []);

  const createShipment = useCallback(async (courierCode: string): Promise<Shipment> => {
    setLoading(true);
    setError(null);
    setShipmentError(null);
    try {
      const pickupAddress = seller?.defaultPickupAddress || {
        street: seller?.address || 'Uttara, Dhaka',
        city: 'Dhaka',
        district: 'Dhaka',
        postalCode: '1230',
        phone: seller?.phone || '01711122233',
      };

      const customerAddress = {
        street: customer?.address || 'House 14, Road 4, Sector 12',
        city: 'Dhaka',
        district: deliveryDistrict || 'Dhaka',
        postalCode: '1000',
        phone: customer?.phone || '+880 1711-456789',
      };

      const params = {
        orderId,
        sellerId,
        customerId: customer?.id || 'customer_001',
        courierCode,
        pickupAddress,
        deliveryAddress: customerAddress,
        sellerContact: {
          name: seller?.name || 'Seller Store',
          phone: seller?.phone || '01711122233',
          email: seller?.email || 'seller@lms.com',
        },
        customerContact: {
          name: customer?.name || 'Customer Name',
          phone: customer?.phone || '+880 1711-456789',
          email: customer?.email || 'customer@example.com',
        },
        codAmount: codAmount || orderTotal,
        weight: 1.0,
        packageType: 'regular' as const,
        contents: items?.map(item => ({
          productId: item.productId || item.id,
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price,
        })) || [
          {
            productId: 'prod_fallback',
            name: 'Order Goods',
            quantity: 1,
            price: orderTotal,
          }
        ],
      };

      const res = await callCreateShipment(params);
      return res;
    } catch (err: any) {
      setError(err.message || 'Dispatch failed');
      setShipmentError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [orderId, sellerId, orderTotal, deliveryDistrict, seller, customer, items, codAmount, callCreateShipment]);

  const requestPickup = useCallback(async () => {
    if (!shipment) return;
    setLoading(true);
    setError(null);
    setShipmentError(null);
    try {
      await logisticsService.requestPickup(shipment.id);
      // reload shipment
      const updated = await logisticsService.getShipment(shipment.id);
      if (updated) setShipment(updated);
    } catch (err: any) {
      setError(err.message || 'Pickup request failed');
      setShipmentError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [shipment, logisticsService]);

  const generateLabel = useCallback(async (format: 'pdf' | 'thermal'): Promise<Blob> => {
    if (!shipment) throw new Error('No active shipment to print label for.');
    return logisticsService.generateLabel(shipment.id, format);
  }, [shipment, logisticsService]);

  return (
    <ShipmentContext.Provider
      value={{
        shipment,
        loading,
        error,
        recommendedCourier,
        dispatchOrder,
        cancelOrderShipment,
        refreshTrackingStatus,

        currentShipment: shipment,
        shipmentLoading: loading,
        shipmentError,
        selectedCourierCode,
        shippingEstimate,
        estimateLoading,
        selectCourier,
        createShipment,
        requestPickup,
        generateLabel,
        refreshTracking: refreshTrackingStatus,
        cancelShipment: cancelOrderShipment,
        trackingEvents: shipment?.trackingEvents || [],
        trackingLoading,
        showTrackingTimeline,
        setShowTrackingTimeline,
      }}
    >
      {children}
    </ShipmentContext.Provider>
  );
};

export const useShipment = () => {
  const context = useContext(ShipmentContext);
  if (!context) {
    throw new Error('useShipment must be used within a ShipmentProvider');
  }
  return context;
};
