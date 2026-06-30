import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { CourierProvider } from './adapters/CourierProvider';
import { SteadfastAdapter } from './adapters/SteadfastAdapter';
import { PathaoAdapter } from './adapters/PathaoAdapter';
import { RedxAdapter } from './adapters/RedxAdapter';
import { PaperflyAdapter } from './adapters/PaperflyAdapter';
import { ECourierAdapter } from './adapters/ECourierAdapter';
import { SundarbanAdapter } from './adapters/SundarbanAdapter';
import { Shipment, ShipmentStatus } from '../../types/shipment';
import { CourierProviderConfig } from '../../types/courier';
import { ShippingRule, Warehouse, ShipmentAnalytics } from '../../types/logistics';

export class LogisticsService {
  private static instance: LogisticsService;
  private adapters: Map<string, CourierProvider> = new Map();
  private memoryStore: Map<string, string> = new Map();

  private safeGetItem(key: string): string | null {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        // Fallback to memory
      }
    }
    return this.memoryStore.get(key) || null;
  }

  private safeSetItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback to memory
      }
    }
    this.memoryStore.set(key, value);
  }

  private constructor() {
    // Register default adapters
    this.registerAdapter(new SteadfastAdapter());
    this.registerAdapter(new PathaoAdapter());
    this.registerAdapter(new RedxAdapter());
    this.registerAdapter(new PaperflyAdapter());
    this.registerAdapter(new ECourierAdapter());
    this.registerAdapter(new SundarbanAdapter());
  }

  public static getInstance(): LogisticsService {
    if (!LogisticsService.instance) {
      LogisticsService.instance = new LogisticsService();
    }
    return LogisticsService.instance;
  }

  /**
   * Register a custom courier provider adapter
   */
  public registerAdapter(adapter: CourierProvider) {
    this.adapters.set(adapter.code, adapter);
    console.log(`[LogisticsService] Registered courier adapter: ${adapter.name} (${adapter.code})`);
  }

  /**
   * Get registered adapter by code
   */
  public getAdapter(code: string): CourierProvider | null {
    return this.adapters.get(code) || null;
  }

  /**
   * Fetch active courier configurations from Firestore
   */
  public async getActiveCouriers(): Promise<CourierProviderConfig[]> {
    const path = 'courier_configs';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const configs: CourierProviderConfig[] = [];
      querySnapshot.forEach((d) => {
        configs.push(d.data() as CourierProviderConfig);
      });
      this.safeSetItem('lms_courier_configs', JSON.stringify(configs));
      return configs;
    } catch (error) {
      console.warn('Firestore failed to load courier configs, falling back to localStorage:', error);
      const local = this.safeGetItem('lms_courier_configs');
      if (local) {
        return JSON.parse(local);
      }
      return [
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
          logo: 'https://steadfast.com.bd/assets/logo.png',
          coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet'],
          lastSyncAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'config_pathao',
          code: 'pathao',
          name: 'Pathao',
          apiUrl: 'https://api.pathao.com',
          apiKey: 'demo_key_pathao',
          apiSecret: 'demo_secret_pathao',
          webhookSecret: 'webhook_secret_pathao',
          sandbox: true,
          production: false,
          enabled: true,
          healthStatus: 'healthy',
          logo: 'https://pathao.com/wp-content/uploads/2018/12/Pathao_logo_red.png',
          coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi'],
          lastSyncAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'config_redx',
          code: 'redx',
          name: 'REDX',
          apiUrl: 'https://api.redx.com.bd',
          apiKey: 'demo_key_redx',
          apiSecret: 'demo_secret_redx',
          webhookSecret: 'webhook_secret_redx',
          sandbox: true,
          production: false,
          enabled: true,
          healthStatus: 'healthy',
          logo: 'https://redx.com.bd/assets/images/redx-logo.svg',
          coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna', 'Barisal'],
          lastSyncAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];
    }
  }

  public getCourier(code: string): any {
    const adapter = this.getAdapter(code);
    if (!adapter) return null;
    return {
      name: adapter.name,
      healthCheck: async () => {
        try {
          return await adapter.healthCheck();
        } catch (e: any) {
          return { status: 'down', message: e.message || 'Error checking health' };
        }
      }
    };
  }

  public async getCourierConfigs(): Promise<CourierProviderConfig[]> {
    return this.getActiveCouriers();
  }

  public async updateCourierStatus(courierCode: string, enabled: boolean): Promise<void> {
    const configs = await this.getActiveCouriers();
    const updated = configs.map(c => {
      if (c.code === courierCode) {
        return { ...c, enabled, updatedAt: new Date().toISOString() };
      }
      return c;
    });

    const target = updated.find(c => c.code === courierCode);
    if (target) {
      try {
        await setDoc(doc(db, 'courier_configs', target.id), target);
      } catch (err) {
        console.warn('Firestore failed to update courier status, updating local only:', err);
      }
    }
    this.safeSetItem('lms_courier_configs', JSON.stringify(updated));
  }

  public async deleteCourierConfig(courierCode: string): Promise<void> {
    const configs = await this.getActiveCouriers();
    const filtered = configs.filter(c => c.code !== courierCode);
    this.safeSetItem('lms_courier_configs', JSON.stringify(filtered));
  }

  public async saveCourierConfig(config: CourierProviderConfig): Promise<void> {
    const configs = await this.getActiveCouriers();
    const now = new Date().toISOString();
    
    const existingIdx = configs.findIndex(c => c.code === config.code);
    
    let updatedConfig: CourierProviderConfig;
    if (existingIdx !== -1) {
      updatedConfig = {
        ...configs[existingIdx],
        ...config,
        updatedAt: now
      };
      configs[existingIdx] = updatedConfig;
    } else {
      updatedConfig = {
        ...config,
        id: config.id || `config_${config.code || Math.floor(Math.random() * 1000000)}`,
        createdAt: now,
        updatedAt: now,
        healthStatus: config.healthStatus || 'healthy',
        enabled: config.enabled !== undefined ? config.enabled : true,
        coverageDistricts: config.coverageDistricts || ['Dhaka', 'Chittagong'],
        lastSyncAt: now
      };
      configs.push(updatedConfig);
    }

    try {
      await setDoc(doc(db, 'courier_configs', updatedConfig.id), updatedConfig);
    } catch (err) {
      console.warn('Firestore failed to save courier config, saving local only:', err);
    }
    this.safeSetItem('lms_courier_configs', JSON.stringify(configs));
  }

  public async getShipments(filters?: { dateFrom?: string; dateTo?: string }): Promise<Shipment[]> {
    let shipments: Shipment[] = [];
    try {
      const querySnapshot = await getDocs(collection(db, 'shipments'));
      querySnapshot.forEach((doc) => {
        shipments.push(doc.data() as Shipment);
      });
    } catch (error) {
      console.warn('Firestore failed to load shipments, using local storage fallback:', error);
      const local = this.safeGetItem('lms_shipments');
      if (local) {
        shipments = JSON.parse(local);
      }
    }

    if (filters) {
      if (filters.dateFrom) {
        shipments = shipments.filter(s => s.createdAt >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        shipments = shipments.filter(s => s.createdAt <= filters.dateTo!);
      }
    }

    if (shipments.length === 0) {
      shipments = this.getMockShipments();
      this.safeSetItem('lms_shipments', JSON.stringify(shipments));
      for (const sh of shipments) {
        try {
          await setDoc(doc(db, 'shipments', sh.id), sh);
        } catch (e) {
          // ignore
        }
      }
    }

    return shipments;
  }

  public async searchShipment(searchTerm: string): Promise<Shipment> {
    const shipments = await this.getShipments();
    const cleanSearch = searchTerm.trim().toLowerCase();
    const found = shipments.find(s => 
      s.trackingNumber.toLowerCase() === cleanSearch ||
      s.orderId.toLowerCase() === cleanSearch ||
      s.id.toLowerCase() === cleanSearch
    );
    if (!found) {
      throw new Error(`No shipment found matching tracking number or order ID "${searchTerm}".`);
    }
    return found;
  }

  private getMockShipments(): Shipment[] {
    const now = new Date();
    const formatOffsetDate = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    
    return [
      {
        id: 'ship_847192',
        orderId: 'ORD-99182',
        sellerId: 'seller_001',
        customerId: 'c_01',
        status: 'delivered',
        courier: { code: 'steadfast', name: 'Steadfast' },
        trackingNumber: 'STF82741920',
        waybillNumber: 'WB829104812',
        pickupAddress: { street: 'Mirpur 10', city: 'Dhaka', district: 'Dhaka', postalCode: '1216', phone: '01711122233' },
        deliveryAddress: { street: 'GEC Circle', city: 'Chittagong', district: 'Chittagong', postalCode: '4000', phone: '01811122233' },
        weight: 1.5,
        packageType: 'regular',
        contents: [{ productId: 'prod_001', name: 'Premium Leather Wallet', quantity: 1, price: 1500 }],
        codAmount: 1620,
        deliveryCharge: 120,
        totalCharge: 135,
        createdAt: formatOffsetDate(5),
        updatedAt: formatOffsetDate(2),
        estimatedDeliveryAt: formatOffsetDate(2),
        trackingEvents: [
          { id: 'evt_1', timestamp: formatOffsetDate(5), status: 'pending_pickup', location: 'Dhaka', description: 'Shipment created and scheduled for pickup' },
          { id: 'evt_2', timestamp: formatOffsetDate(4), status: 'picked_up', location: 'Dhaka sorting hub', description: 'Package picked up by courier' },
          { id: 'evt_3', timestamp: formatOffsetDate(3), status: 'in_transit', location: 'Chittagong sorting hub', description: 'Package in transit' },
          { id: 'evt_4', timestamp: formatOffsetDate(2), status: 'delivered', location: 'Chittagong', description: 'Successfully delivered to customer' }
        ],
        sellerContact: { name: 'Rifat Store', phone: '01711122233', email: 'rifat@store.com' },
        customerContact: { name: 'Imran Khan', phone: '01811122233', email: 'imran@gmail.com' },
        autoGeneratedLabel: true,
        autoRequestedPickup: true
      },
      {
        id: 'ship_294810',
        orderId: 'ORD-10294',
        sellerId: 'seller_001',
        customerId: 'c_02',
        status: 'in_transit',
        courier: { code: 'pathao', name: 'Pathao' },
        trackingNumber: 'PTH20194810',
        waybillNumber: 'WB-PTH-182749102',
        pickupAddress: { street: 'Gulshan 2', city: 'Dhaka', district: 'Dhaka', postalCode: '1212', phone: '01911122233' },
        deliveryAddress: { street: 'Upashahar', city: 'Sylhet', district: 'Sylhet', postalCode: '3100', phone: '01722233344' },
        weight: 0.8,
        packageType: 'express',
        contents: [{ productId: 'prod_002', name: 'Wireless Noise Cancelling Earbuds', quantity: 1, price: 3500 }],
        codAmount: 3620,
        deliveryCharge: 120,
        totalCharge: 140,
        createdAt: formatOffsetDate(2),
        updatedAt: formatOffsetDate(1),
        estimatedDeliveryAt: formatOffsetDate(-1),
        trackingEvents: [
          { id: 'evt_1', timestamp: formatOffsetDate(2), status: 'pending_pickup', location: 'Dhaka', description: 'Shipment created and scheduled for Pathao pickup' },
          { id: 'evt_2', timestamp: formatOffsetDate(1), status: 'picked_up', location: 'Dhaka Central Warehouse', description: 'Package received at Pathao sorting hub' }
        ],
        sellerContact: { name: 'TechBD', phone: '01911122233', email: 'techbd@gmail.com' },
        customerContact: { name: 'Nusrat Jahan', phone: '01722233344', email: 'nusrat@gmail.com' },
        autoGeneratedLabel: true,
        autoRequestedPickup: true
      },
      {
        id: 'ship_581928',
        orderId: 'ORD-55281',
        sellerId: 'seller_002',
        customerId: 'c_03',
        status: 'failed_delivery',
        courier: { code: 'redx', name: 'REDX' },
        trackingNumber: 'RDX91827391',
        waybillNumber: 'WB-RDX-291827391',
        pickupAddress: { street: 'Banani', city: 'Dhaka', district: 'Dhaka', postalCode: '1213', phone: '01311122233' },
        deliveryAddress: { street: 'Chashara', city: 'Narayanganj', district: 'Narayanganj', postalCode: '1400', phone: '01511122233' },
        weight: 2.2,
        packageType: 'fragile',
        contents: [{ productId: 'prod_003', name: 'Ceramic Table Vase', quantity: 1, price: 1800 }],
        codAmount: 1950,
        deliveryCharge: 150,
        totalCharge: 170,
        createdAt: formatOffsetDate(4),
        updatedAt: formatOffsetDate(1),
        estimatedDeliveryAt: formatOffsetDate(1),
        trackingEvents: [
          { id: 'evt_1', timestamp: formatOffsetDate(4), status: 'pending_pickup', location: 'Dhaka', description: 'Shipment created and scheduled for REDX pickup' },
          { id: 'evt_2', timestamp: formatOffsetDate(3), status: 'picked_up', location: 'Dhaka sorting hub', description: 'Package received at REDX hub' },
          { id: 'evt_3', timestamp: formatOffsetDate(2), status: 'in_transit', location: 'Narayanganj hub', description: 'Package out for delivery' },
          { id: 'evt_4', timestamp: formatOffsetDate(1), status: 'failed_delivery', location: 'Narayanganj', description: 'Delivery failed: Customer unavailable, rescheduling' }
        ],
        sellerContact: { name: 'Home Decor BD', phone: '01311122233', email: 'decor@home.com' },
        customerContact: { name: 'Ariful Islam', phone: '01511122233', email: 'arif@outlook.com' },
        autoGeneratedLabel: true,
        autoRequestedPickup: true
      }
    ];
  }

  /**
   * Create a shipment consignment (Firestore + Courier dispatch)
   */
  public async createShipment(params: {
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
  }): Promise<Shipment> {
    const adapter = this.getAdapter(params.courierCode);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${params.courierCode}" is not registered.`);
    }

    console.log(`[LogisticsService] Creating shipment on provider "${adapter.name}"`);

    // Create consignment on the courier provider
    const recipientAddressStr = `${params.deliveryAddress.street}, ${params.deliveryAddress.city}, ${params.deliveryAddress.district}`;
    const response = await adapter.createConsignment({
      invoiceId: params.orderId,
      recipientName: params.customerContact.name,
      recipientPhone: params.customerContact.phone,
      recipientAddress: recipientAddressStr,
      codAmount: params.codAmount,
      weight: params.weight,
      note: `Order from Seller: ${params.sellerId}`,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to register consignment with courier provider.');
    }

    const shipmentId = `ship_${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    const shipment: Shipment = {
      id: shipmentId,
      orderId: params.orderId,
      sellerId: params.sellerId,
      customerId: params.customerId,
      status: 'pending_pickup',
      courier: {
        code: adapter.code,
        name: adapter.name,
      },
      trackingNumber: response.trackingNumber,
      waybillNumber: response.waybillNumber,
      pickupAddress: params.pickupAddress,
      deliveryAddress: params.deliveryAddress,
      weight: params.weight,
      packageType: params.packageType,
      contents: params.contents,
      codAmount: params.codAmount,
      deliveryCharge: 120, // default placeholder
      totalCharge: 120 + (params.codAmount > 0 ? Math.round(params.codAmount * 0.01) : 0),
      createdAt: now,
      updatedAt: now,
      trackingEvents: [
        {
          id: `evt_${Math.floor(10000 + Math.random() * 90000)}`,
          timestamp: now,
          status: 'pending_pickup',
          location: params.pickupAddress.city,
          description: 'Shipment created and scheduled for pickup',
        }
      ],
      sellerContact: params.sellerContact,
      customerContact: params.customerContact,
      autoGeneratedLabel: true,
      autoRequestedPickup: true,
    };

    // Save to Firestore
    const path = 'shipments';
    try {
      await setDoc(doc(db, path, shipmentId), shipment);
      console.log(`[LogisticsService] Saved shipment ${shipmentId} in Firestore`);
    } catch (error) {
      console.warn('Firestore failed to save shipment, using localStorage fallback:', error);
    }

    // Always store in localStorage as fallback
    const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
    const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
    localShipments.push(shipment);
    this.safeSetItem('lms_shipments', JSON.stringify(localShipments));

    return shipment;
  }

  /**
   * Retrieve shipment by ID
   */
  public async getShipment(shipmentId: string): Promise<Shipment | null> {
    try {
      const docSnap = await getDoc(doc(db, 'shipments', shipmentId));
      if (docSnap.exists()) {
        return docSnap.data() as Shipment;
      }
    } catch (error) {
      console.warn('Firestore failed to get shipment, using localStorage fallback:', error);
    }

    const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
    const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
    return localShipments.find((s) => s.id === shipmentId) || null;
  }

  /**
   * Retrieve shipments by Order ID
   */
  public async getShipmentsByOrder(orderId: string): Promise<Shipment[]> {
    try {
      const q = query(collection(db, 'shipments'), where('orderId', '==', orderId));
      const querySnapshot = await getDocs(q);
      const shipments: Shipment[] = [];
      querySnapshot.forEach((d) => {
        shipments.push(d.data() as Shipment);
      });
      return shipments;
    } catch (error) {
      console.warn('Firestore failed to get shipments by order, using localStorage fallback:', error);
      const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
      const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
      return localShipments.filter((s) => s.orderId === orderId);
    }
  }

  /**
   * Retrieve shipments by Seller ID
   */
  public async getShipmentsBySeller(sellerId: string): Promise<Shipment[]> {
    try {
      const q = query(collection(db, 'shipments'), where('sellerId', '==', sellerId));
      const querySnapshot = await getDocs(q);
      const shipments: Shipment[] = [];
      querySnapshot.forEach((d) => {
        shipments.push(d.data() as Shipment);
      });
      return shipments;
    } catch (error) {
      console.warn('Firestore failed to get shipments by seller, using localStorage fallback:', error);
      const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
      const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
      return localShipments.filter((s) => s.sellerId === sellerId);
    }
  }

  /**
   * Cancel shipment
   */
  public async cancelShipment(shipmentId: string, reason: string): Promise<void> {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }

    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }

    const response = await adapter.cancelConsignment(shipment.trackingNumber);
    if (!response.success) {
      throw new Error(response.message || 'Courier provider rejected cancellation.');
    }

    const now = new Date().toISOString();
    const updatedEvents = [
      ...shipment.trackingEvents,
      {
        id: `evt_${Math.floor(10000 + Math.random() * 90000)}`,
        timestamp: now,
        status: 'cancelled',
        location: shipment.pickupAddress.city,
        description: `Shipment cancelled. Reason: ${reason}`,
      }
    ];

    try {
      await updateDoc(doc(db, 'shipments', shipmentId), {
        status: 'cancelled',
        updatedAt: now,
        trackingEvents: updatedEvents,
      });
      console.log(`[LogisticsService] Shipment ${shipmentId} status updated to "cancelled"`);
    } catch (error) {
      console.warn('Firestore failed to cancel shipment, updating localStorage:', error);
    }

    // Always update in localStorage fallback
    const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
    const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
    const idx = localShipments.findIndex((s) => s.id === shipmentId);
    if (idx !== -1) {
      localShipments[idx].status = 'cancelled';
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = updatedEvents;
      this.safeSetItem('lms_shipments', JSON.stringify(localShipments));
    }
  }

  /**
   * Fetch and sync live tracking events from Courier Adapter
   */
  public async syncTracking(shipmentId: string): Promise<Shipment> {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }

    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }

    const response = await adapter.trackShipment(shipment.trackingNumber);
    if (!response.success) {
      throw new Error('Failed to fetch updated tracking info.');
    }

    const now = new Date().toISOString();
    const newEvents = response.trackingEvents.map((evt, idx) => ({
      id: `evt_synced_${idx}_${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: evt.timestamp,
      status: evt.status,
      location: evt.location,
      description: evt.description,
      remarks: evt.remarks || null,
    }));

    const finalStatus = response.status.toLowerCase() as ShipmentStatus;

    try {
      await updateDoc(doc(db, 'shipments', shipmentId), {
        status: finalStatus,
        updatedAt: now,
        trackingEvents: newEvents,
      });
    } catch (error) {
      console.warn('Firestore failed to sync tracking, updating localStorage:', error);
    }

    // Always update in localStorage fallback
    const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
    const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
    const idx = localShipments.findIndex((s) => s.id === shipmentId);
    if (idx !== -1) {
      localShipments[idx].status = finalStatus;
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = newEvents;
      this.safeSetItem('lms_shipments', JSON.stringify(localShipments));
    }

    return {
      ...shipment,
      status: finalStatus,
      updatedAt: now,
      trackingEvents: newEvents,
    };
  }

  /**
   * Evaluate Automation Rules for Courier Selection
   */
  public async evaluateShippingRules(order: {
    deliveryDistrict: string;
    totalAmount: number;
    weight: number;
  }, sellerId: string): Promise<ShippingRule | null> {
    const path = 'shipping_rules';
    let rules: ShippingRule[] = [];
    try {
      const q = query(
        collection(db, path), 
        where('sellerId', '==', sellerId), 
        where('enabled', '==', true)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((d) => {
        rules.push(d.data() as ShippingRule);
      });
    } catch (error) {
      console.warn('Error evaluating shipping rules from Firestore, using localStorage:', error);
      const key = `lms_shipping_rules_${sellerId}`;
      const localRulesStr = this.safeGetItem(key) || this.safeGetItem('lms_shipping_rules') || '[]';
      const localRules = JSON.parse(localRulesStr) as ShippingRule[];
      rules = localRules.filter((r) => r.sellerId === sellerId && r.enabled === true);
    }

    // Sort by priority (higher value = higher priority)
    rules.sort((a, b) => b.priority - a.priority);

    for (const rule of rules) {
      let matches = true;

      // Condition check: destination districts
      if (rule.conditions.destinationDistricts && rule.conditions.destinationDistricts.length > 0) {
        const matchedDistrict = rule.conditions.destinationDistricts.some(
          (dist) => order.deliveryDistrict.toLowerCase().includes(dist.toLowerCase())
        );
        if (!matchedDistrict) matches = false;
      }

      // Condition check: weight range
      if (rule.conditions.weightRange) {
        const { min, max } = rule.conditions.weightRange;
        if (min !== undefined && order.weight < min) matches = false;
        if (max !== undefined && order.weight > max) matches = false;
      }

      // Condition check: order value range
      if (rule.conditions.orderValueRange) {
        const { min, max } = rule.conditions.orderValueRange;
        if (min !== undefined && order.totalAmount < min) matches = false;
        if (max !== undefined && order.totalAmount > max) matches = false;
      }

      if (matches) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Fetch Warehouse by ID
   */
  public async getWarehouse(warehouseId: string): Promise<Warehouse | null> {
    try {
      const docSnap = await getDoc(doc(db, 'warehouses', warehouseId));
      if (docSnap.exists()) {
        return docSnap.data() as Warehouse;
      }
    } catch (error) {
      console.warn('Firestore failed to get warehouse, using localStorage:', error);
    }
    const localWarehousesStr = this.safeGetItem('lms_warehouses') || '[]';
    const localWarehouses = JSON.parse(localWarehousesStr) as Warehouse[];
    return localWarehouses.find((w) => w.id === warehouseId) || null;
  }

  /**
   * Fetch Warehouses for a Seller
   */
  public async getWarehousesBySeller(sellerId: string): Promise<Warehouse[]> {
    try {
      const q = query(collection(db, 'warehouses'), where('sellerId', '==', sellerId));
      const querySnapshot = await getDocs(q);
      const warehouses: Warehouse[] = [];
      querySnapshot.forEach((d) => {
        warehouses.push(d.data() as Warehouse);
      });
      return warehouses;
    } catch (error) {
      console.warn('Firestore failed to get warehouses by seller, using localStorage:', error);
      const key = `lms_warehouses_${sellerId}`;
      const localWarehousesStr = this.safeGetItem(key) || this.safeGetItem('lms_warehouses') || '[]';
      const localWarehouses = JSON.parse(localWarehousesStr) as Warehouse[];
      return localWarehouses.filter((w) => w.sellerId === sellerId);
    }
  }

  /**
   * Seed Initial Courier Configuration
   */
  public async seedDefaultCourierConfigs(): Promise<void> {
    const couriers = [
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
        logo: 'https://steadfast.com.bd/assets/logo.png',
        coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet'],
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'config_pathao',
        code: 'pathao',
        name: 'Pathao',
        apiUrl: 'https://api.pathao.com',
        apiKey: 'demo_key_pathao',
        apiSecret: 'demo_secret_pathao',
        webhookSecret: 'webhook_secret_pathao',
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: 'healthy',
        logo: 'https://pathao.com/wp-content/uploads/2018/12/Pathao_logo_red.png',
        coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi'],
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'config_redx',
        code: 'redx',
        name: 'REDX',
        apiUrl: 'https://api.redx.com.bd',
        apiKey: 'demo_key_redx',
        apiSecret: 'demo_secret_redx',
        webhookSecret: 'webhook_secret_redx',
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: 'healthy',
        logo: 'https://redx.com.bd/assets/images/redx-logo.svg',
        coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna', 'Barisal'],
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'config_paperfly',
        code: 'paperfly',
        name: 'Paperfly',
        apiUrl: 'https://api.paperfly.com.bd',
        apiKey: 'demo_key_paperfly',
        apiSecret: 'demo_secret_paperfly',
        webhookSecret: 'webhook_secret_paperfly',
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: 'healthy',
        logo: 'https://www.paperfly.com.bd/images/paperfly-logo.png',
        coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Rangpur'],
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'config_ecourier',
        code: 'ecourier',
        name: 'eCourier',
        apiUrl: 'https://api.ecourier.com.bd',
        apiKey: 'demo_key_ecourier',
        apiSecret: 'demo_secret_ecourier',
        webhookSecret: 'webhook_secret_ecourier',
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: 'healthy',
        logo: 'https://ecourier.com.bd/wp-content/uploads/2021/04/e-courier-logo.png',
        coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna', 'Barisal', 'Mymensingh'],
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'config_sundarban',
        code: 'sundarban',
        name: 'Sundarban',
        apiUrl: 'https://api.sundarbancourierltd.com',
        apiKey: 'demo_key_sundarban',
        apiSecret: 'demo_secret_sundarban',
        webhookSecret: 'webhook_secret_sundarban',
        sandbox: true,
        production: false,
        enabled: true,
        healthStatus: 'healthy',
        logo: 'https://sundarbancourierltd.com/images/logo.png',
        coverageDistricts: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal', 'Rangpur', 'Mymensingh'],
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    for (const courier of couriers) {
      try {
        const docRef = doc(db, 'courier_configs', courier.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, courier);
          console.log(`[LogisticsService] Seeded default configuration for ${courier.name}`);
        }
      } catch (err) {
        console.warn('Failed to seed courier configuration to Firestore (will use local fallback):', err);
      }
    }
    const local = this.safeGetItem('lms_courier_configs');
    if (!local) {
      this.safeSetItem('lms_courier_configs', JSON.stringify(couriers));
    }
  }

  /**
   * Request pickup for a shipment
   */
  public async requestPickup(shipmentId: string): Promise<void> {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }

    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }

    const response = await adapter.requestPickup({
      pickupAddress: shipment.pickupAddress,
      contactPerson: shipment.sellerContact,
      scheduledDate: new Date().toISOString().split('T')[0],
      packageCount: 1,
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to request pickup.');
    }

    const now = new Date().toISOString();
    const updatedEvents = [
      ...shipment.trackingEvents,
      {
        id: `evt_${Math.floor(10000 + Math.random() * 90000)}`,
        timestamp: now,
        status: 'pending_pickup',
        location: shipment.pickupAddress.city,
        description: 'Courier pickup requested successfully.',
      }
    ];

    try {
      await updateDoc(doc(db, 'shipments', shipmentId), {
        status: 'pending_pickup',
        updatedAt: now,
        trackingEvents: updatedEvents,
        pickupScheduledAt: response.scheduledTime || now,
      });
      console.log(`[LogisticsService] Shipment ${shipmentId} pickup requested`);
    } catch (error) {
      console.warn('Firestore failed to save pickup request, updating localStorage:', error);
    }

    // Always update in localStorage fallback
    const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
    const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
    const idx = localShipments.findIndex((s) => s.id === shipmentId);
    if (idx !== -1) {
      localShipments[idx].status = 'pending_pickup';
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = updatedEvents;
      localShipments[idx].pickupScheduledAt = response.scheduledTime || now;
      this.safeSetItem('lms_shipments', JSON.stringify(localShipments));
    }
  }

  /**
   * Generate shipping label
   */
  public async generateLabel(shipmentId: string, format: 'pdf' | 'thermal'): Promise<Blob> {
    const shipment = await this.getShipment(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID "${shipmentId}" not found.`);
    }

    const adapter = this.getAdapter(shipment.courier.code);
    if (!adapter) {
      throw new Error(`Courier provider adapter for code "${shipment.courier.code}" not registered.`);
    }

    const response = await adapter.printLabel(shipment.trackingNumber, format);
    if (!response.success) {
      throw new Error('Failed to generate label.');
    }

    // Since we're in sandbox, return a dummy PDF / text blob
    const content = `SHIPPING LABEL - ${shipment.courier.name}\n` +
      `-------------------------------------------\n` +
      `TRACKING #: ${shipment.trackingNumber}\n` +
      `ORDER ID: ${shipment.orderId}\n` +
      `SENDER: ${shipment.sellerContact.name} (${shipment.pickupAddress.city})\n` +
      `RECIPIENT: ${shipment.customerContact.name} (${shipment.deliveryAddress.city})\n` +
      `COD AMOUNT: BDT ${shipment.codAmount}\n` +
      `WEIGHT: ${shipment.weight} kg\n` +
      `FORMAT: ${format.toUpperCase()}`;
    
    return new Blob([content], { type: format === 'pdf' ? 'application/pdf' : 'text/plain' });
  }

  /**
   * Update shipment from a normalized webhook event
   */
  public async updateShipmentFromWebhook(
    trackingNumber: string,
    status: ShipmentStatus,
    event: {
      status: string;
      location: string;
      description: string;
      remarks?: string;
    }
  ): Promise<Shipment> {
    const shipments = await this.getShipments();
    const shipment = shipments.find(s => s.trackingNumber === trackingNumber);
    if (!shipment) {
      throw new Error(`Shipment with tracking number ${trackingNumber} not found.`);
    }

    const now = new Date().toISOString();
    const newEvent = {
      id: `evt_web_${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: now,
      status: event.status,
      location: event.location,
      description: event.description,
      remarks: event.remarks || null,
    };
    const updatedEvents = [...shipment.trackingEvents, newEvent];

    // Save to Firestore
    try {
      await updateDoc(doc(db, 'shipments', shipment.id), {
        status,
        updatedAt: now,
        trackingEvents: updatedEvents,
      });
      console.log(`[LogisticsService] Shipment ${shipment.id} successfully updated from webhook to ${status}`);
    } catch (err) {
      console.warn('Failed to update shipment in Firestore via Webhook, modifying localStorage fallback:', err);
    }

    // Always update in localStorage fallback
    const localShipmentsStr = this.safeGetItem('lms_shipments') || '[]';
    const localShipments = JSON.parse(localShipmentsStr) as Shipment[];
    const idx = localShipments.findIndex((s) => s.id === shipment.id);
    if (idx !== -1) {
      localShipments[idx].status = status;
      localShipments[idx].updatedAt = now;
      localShipments[idx].trackingEvents = updatedEvents;
      this.safeSetItem('lms_shipments', JSON.stringify(localShipments));
    }

    return {
      ...shipment,
      status,
      updatedAt: now,
      trackingEvents: updatedEvents,
    };
  }
}

export default LogisticsService;
