import React, { createContext, useContext, useState, useEffect } from 'react';
import { LogisticsService } from '../services/logistics/LogisticsService';
import { Shipment } from '../types/shipment';
import { CourierProviderConfig } from '../types/courier';
import { ShippingRule, Warehouse } from '../types/logistics';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';

interface LogisticsContextType {
  activeCouriers: CourierProviderConfig[];
  warehouses: Warehouse[];
  shippingRules: ShippingRule[];
  loading: boolean;
  error: string | null;
  
  // Operations
  createShipment: (params: {
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
  
  cancelShipment: (shipmentId: string, reason: string) => Promise<void>;
  syncTracking: (shipmentId: string) => Promise<Shipment>;
  evaluateShippingRules: (order: { deliveryDistrict: string; totalAmount: number; weight: number }, sellerId: string) => Promise<ShippingRule | null>;
  createWarehouse: (warehouse: Omit<Warehouse, 'id' | 'createdAt'>) => Promise<void>;
  createShippingRule: (rule: Omit<ShippingRule, 'id' | 'createdAt'>) => Promise<void>;
}

const LogisticsContext = createContext<LogisticsContextType | undefined>(undefined);

export const LogisticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeCouriers, setActiveCouriers] = useState<CourierProviderConfig[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logisticsService = LogisticsService.getInstance();

  useEffect(() => {
    // Seed default config for Steadfast on first boot
    logisticsService.seedDefaultCourierConfigs();

    // Listen to courier configurations live
    const unsubscribeCouriers = onSnapshot(
      collection(db, 'courier_configs'),
      (snapshot) => {
        const configs: CourierProviderConfig[] = [];
        snapshot.forEach((doc) => {
          configs.push(doc.data() as CourierProviderConfig);
        });
        setActiveCouriers(configs);
        localStorage.setItem('lms_courier_configs', JSON.stringify(configs));
      },
      (err) => {
        console.warn('Error fetching courier configs from Firestore, using localStorage fallback:', err);
        const local = localStorage.getItem('lms_courier_configs');
        if (local) {
          setActiveCouriers(JSON.parse(local));
        } else {
          setActiveCouriers([
            {
              id: 'config_steadfast',
              code: 'steadfast',
              name: 'Steadfast',
              apiUrl: 'https://api.steadfast.com.bd',
              apiKey: 'demo_key_steadfast',
              apiSecret: 'demo_secret_steadfast',
              webhookSecret: 'webhook_secret_steadfast',
              sandbox: true,
              production: false,
              enabled: true,
              healthStatus: 'healthy',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          ]);
        }
      }
    );

    return () => {
      unsubscribeCouriers();
    };
  }, []);

  // Listen to warehouses and rules when user is logged in
  useEffect(() => {
    if (!user) {
      setWarehouses([]);
      setShippingRules([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const warehouseQuery = query(
      collection(db, 'warehouses'),
      where('sellerId', '==', user.uid)
    );

    const unsubscribeWarehouses = onSnapshot(
      warehouseQuery,
      (snapshot) => {
        const list: Warehouse[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Warehouse);
        });
        setWarehouses(list);
        localStorage.setItem(`lms_warehouses_${user.uid}`, JSON.stringify(list));
      },
      (err) => {
        console.warn('Error loading warehouses from Firestore, using localStorage fallback:', err);
        const local = localStorage.getItem(`lms_warehouses_${user.uid}`) || localStorage.getItem('lms_warehouses');
        if (local) {
          setWarehouses(JSON.parse(local));
        } else {
          setWarehouses([]);
        }
      }
    );

    const rulesQuery = query(
      collection(db, 'shipping_rules'),
      where('sellerId', '==', user.uid)
    );

    const unsubscribeRules = onSnapshot(
      rulesQuery,
      (snapshot) => {
        const list: ShippingRule[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as ShippingRule);
        });
        setShippingRules(list);
        localStorage.setItem(`lms_shipping_rules_${user.uid}`, JSON.stringify(list));
        setLoading(false);
      },
      (err) => {
        console.warn('Error loading shipping rules from Firestore, using localStorage fallback:', err);
        const local = localStorage.getItem(`lms_shipping_rules_${user.uid}`) || localStorage.getItem('lms_shipping_rules');
        if (local) {
          setShippingRules(JSON.parse(local));
        } else {
          setShippingRules([]);
        }
        setLoading(false);
      }
    );

    return () => {
      unsubscribeWarehouses();
      unsubscribeRules();
    };
  }, [user]);

  const createShipment = async (params: {
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
    try {
      const res = await logisticsService.createShipment(params);
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to create shipment');
      throw err;
    }
  };

  const cancelShipment = async (shipmentId: string, reason: string) => {
    try {
      await logisticsService.cancelShipment(shipmentId, reason);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel shipment');
      throw err;
    }
  };

  const syncTracking = async (shipmentId: string) => {
    try {
      const res = await logisticsService.syncTracking(shipmentId);
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to sync tracking');
      throw err;
    }
  };

  const evaluateShippingRules = async (order: { deliveryDistrict: string; totalAmount: number; weight: number }, sellerId: string) => {
    return logisticsService.evaluateShippingRules(order, sellerId);
  };

  const createWarehouse = async (warehouseData: Omit<Warehouse, 'id' | 'createdAt'>) => {
    const warehouseId = `wh_${Math.floor(10000 + Math.random() * 90000)}`;
    const newWh: Warehouse = {
      ...warehouseData,
      id: warehouseId,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'warehouses', warehouseId), newWh);
    } catch (err) {
      console.warn('Failed to save warehouse to Firestore, saving to localStorage:', err);
    }

    const key = user ? `lms_warehouses_${user.uid}` : 'lms_warehouses';
    const local = localStorage.getItem(key) || '[]';
    const list = JSON.parse(local) as Warehouse[];
    list.push(newWh);
    localStorage.setItem(key, JSON.stringify(list));
    setWarehouses(list);
  };

  const createShippingRule = async (ruleData: Omit<ShippingRule, 'id' | 'createdAt'>) => {
    const ruleId = `rule_${Math.floor(10000 + Math.random() * 90000)}`;
    const newRule: ShippingRule = {
      ...ruleData,
      id: ruleId,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'shipping_rules', ruleId), newRule);
    } catch (err) {
      console.warn('Failed to save shipping rule to Firestore, saving to localStorage:', err);
    }

    const key = user ? `lms_shipping_rules_${user.uid}` : 'lms_shipping_rules';
    const local = localStorage.getItem(key) || '[]';
    const list = JSON.parse(local) as ShippingRule[];
    list.push(newRule);
    localStorage.setItem(key, JSON.stringify(list));
    setShippingRules(list);
  };

  return (
    <LogisticsContext.Provider
      value={{
        activeCouriers,
        warehouses,
        shippingRules,
        loading,
        error,
        createShipment,
        cancelShipment,
        syncTracking,
        evaluateShippingRules,
        createWarehouse,
        createShippingRule,
      }}
    >
      {children}
    </LogisticsContext.Provider>
  );
};

export const useLogistics = () => {
  const context = useContext(LogisticsContext);
  if (!context) {
    throw new Error('useLogistics must be used within a LogisticsProvider');
  }
  return context;
};
