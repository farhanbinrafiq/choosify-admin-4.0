import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { catalogApi } from '../services/catalogApi';
import type { CatalogProduct } from '../types/catalog';

export interface InventoryItem {
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  currentStock: number;
  allocatedStock: number; // in orders but not shipped
  availableStock: number; // currentStock - allocatedStock
  minimumStock: number; // low-stock threshold
  maximumStock: number; // restock target
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  sellerId: string;
  categoryId: string;
}

export interface StockAuditLog {
  id: string;
  productId: string;
  variantId?: string;
  timestamp: string;
  previousStock: number;
  newStock: number;
  change: number; // positive for restock, negative for sale
  reason: 'order_placed' | 'manual_adjustment' | 'damage_loss' | 'return' | 'restock' | 'cancel_order';
  notes: string;
  actedBy: string; // user ID
  orderId?: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  type: 'low_stock' | 'out_of_stock' | 'overstock' | 'variance';
  severity: 'warning' | 'critical';
  message: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

interface UndoAction {
  productId: string;
  variantId?: string;
  previousStock: number;
  newStock: number;
  sku: string;
}

interface InventoryContextType {
  /** Alias used by storefront Home — same as inventoryItems */
  inventory: InventoryItem[];
  inventoryItems: InventoryItem[];
  auditLog: StockAuditLog[];
  stockAlerts: StockAlert[];
  getStockLevel: (productId: string, variantId?: string) => { current: number; available: number; allocated: number };
  updateStock: (productId: string, newQuantity: number, reason: StockAuditLog['reason'], notes: string, variantId?: string) => void;
  logStockChange: (productId: string, change: number, reason: StockAuditLog['reason'], orderId?: string, variantId?: string) => void;
  getAuditLog: (productId?: string, dateRange?: { start: string; end: string }) => StockAuditLog[];
  setMinimumStock: (productId: string, amount: number, variantId?: string) => void;
  generateLowStockReport: () => InventoryItem[];
  acknowledgeAlert: (alertId: string) => void;
  getVarianceReport: () => { itemId: string; name: string; recorded: number; physical: number; difference: number }[];
  bulkStockImport: (csvData: string) => { success: boolean; count: number; error?: string };
  allocateStock: (productId: string, quantity: number, variantId?: string) => void;
  deallocateStock: (productId: string, quantity: number, variantId?: string) => void;
  undoLastAdjustment: () => boolean;
  canUndo: boolean;
  triggerMockSale: (productId: string, quantity: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [catalogHydrated, setCatalogHydrated] = useState(false);

  const [auditLog, setAuditLog] = useState<StockAuditLog[]>(() => {
    const saved = localStorage.getItem('choosify_stock_audit');
    return saved ? JSON.parse(saved) : [];
  });

  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>(() => {
    const saved = localStorage.getItem('choosify_stock_alerts');
    return saved ? JSON.parse(saved) : [];
  });

  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  const mapProductToInventoryItem = useCallback((p: CatalogProduct): InventoryItem => {
    const stock = Math.max(0, typeof p.stock === 'number' ? p.stock : 0);
    const min = 5;
    return {
      productId: p.id,
      sku: `SKU-${p.id.slice(0, 12)}`,
      productName: p.title,
      currentStock: stock,
      allocatedStock: 0,
      availableStock: stock,
      minimumStock: min,
      maximumStock: Math.max(stock * 2, 50),
      status: stock <= 0 ? 'out_of_stock' : stock < min ? 'low_stock' : 'in_stock',
      sellerId: p.sellerId || 'platform',
      categoryId: p.categoryName || p.categoryId,
    };
  }, []);

  /** Prefer server catalog stock over legacy mock/localStorage SKUs. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const products = await catalogApi.listProducts();
        if (cancelled) return;
        setInventoryItems(products.map(mapProductToInventoryItem));
        setCatalogHydrated(true);
        localStorage.removeItem('choosify_inventory');
      } catch {
        if (cancelled) return;
        // Unauthenticated or API unavailable: keep empty (no mock seed leakage).
        setInventoryItems([]);
        setCatalogHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapProductToInventoryItem, profile?.id]);

  // Sync audit/alerts to localStorage only (inventory SoT is catalog API)
  useEffect(() => {
    localStorage.setItem('choosify_stock_audit', JSON.stringify(auditLog));
  }, [auditLog]);

  useEffect(() => {
    localStorage.setItem('choosify_stock_alerts', JSON.stringify(stockAlerts));
  }, [stockAlerts]);

  void catalogHydrated;

  /**
   * Helper to determine item status based on stock levels
   */
  const determineStatus = (current: number, min: number): InventoryItem['status'] => {
    if (current <= 0) return 'out_of_stock';
    if (current < min) return 'low_stock';
    return 'in_stock';
  };

  /**
   * Check stock and trigger alerts if needed
   */
  const checkAndGenerateAlert = (item: InventoryItem, newStock: number) => {
    const alertsToCreate: StockAlert[] = [];

    if (newStock <= 0) {
      // Check if an unacknowledged out of stock alert already exists for this product
      const exists = stockAlerts.some(a => a.productId === item.productId && a.type === 'out_of_stock' && !a.acknowledged);
      if (!exists) {
        alertsToCreate.push({
          id: `alt_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          type: 'out_of_stock',
          severity: 'critical',
          message: `${item.productName} is completely out of stock!`,
          createdAt: new Date().toISOString(),
          acknowledged: false
        });
      }
    } else if (newStock < item.minimumStock) {
      // Check if an unacknowledged low stock alert already exists
      const exists = stockAlerts.some(a => a.productId === item.productId && a.type === 'low_stock' && !a.acknowledged);
      if (!exists) {
        alertsToCreate.push({
          id: `alt_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          type: 'low_stock',
          severity: 'warning',
          message: `${item.productName} has fallen below minimum threshold of ${item.minimumStock} units (Current: ${newStock}).`,
          createdAt: new Date().toISOString(),
          acknowledged: false
        });
      }
    }

    if (alertsToCreate.length > 0) {
      setStockAlerts(prev => [...alertsToCreate, ...prev]);
    }
  };

  /**
   * getStockLevel
   */
  const getStockLevel = (productId: string, variantId?: string) => {
    const item = inventoryItems.find(i => i.productId === productId && i.variantId === variantId);
    if (!item) return { current: 0, available: 0, allocated: 0 };
    return {
      current: item.currentStock,
      available: item.availableStock,
      allocated: item.allocatedStock
    };
  };

  /**
   * updateStock - manual adjustment; persists via catalog inventory API when possible.
   */
  const updateStock = (
    productId: string,
    newQuantity: number,
    reason: StockAuditLog['reason'],
    notes: string,
    variantId?: string
  ) => {
    if (newQuantity < 0) return;

    setInventoryItems(prev => {
      const idx = prev.findIndex(i => i.productId === productId && i.variantId === variantId);
      if (idx === -1) return prev;

      const item = prev[idx];
      const previousStock = item.currentStock;
      const change = newQuantity - previousStock;

      const undoAction: UndoAction = {
        productId,
        variantId,
        previousStock,
        newStock: newQuantity,
        sku: item.sku
      };
      setUndoStack(uPrev => [undoAction, ...uPrev].slice(0, 10));

      const updatedItem = {
        ...item,
        currentStock: newQuantity,
        availableStock: Math.max(0, newQuantity - item.allocatedStock),
        status: determineStatus(newQuantity, item.minimumStock)
      };

      const audit: StockAuditLog = {
        id: `aud_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        variantId,
        timestamp: new Date().toISOString(),
        previousStock,
        newStock: newQuantity,
        change,
        reason,
        notes,
        actedBy: profile?.id || 'admin_user'
      };

      setAuditLog(aPrev => [audit, ...aPrev]);
      checkAndGenerateAlert(updatedItem, newQuantity);

      const copy = [...prev];
      copy[idx] = updatedItem;
      return copy;
    });

    void catalogApi
      .adjustProductInventory(productId, {
        variantId,
        quantity: newQuantity,
      })
      .catch(() => {
        /* UI already updated; next hydrate will reconcile */
      });
  };

  /**
   * logStockChange - relative stock modification (e.g. sale, restock)
   */
  const logStockChange = (
    productId: string,
    change: number,
    reason: StockAuditLog['reason'],
    orderId?: string,
    variantId?: string
  ) => {
    setInventoryItems(prev => {
      const idx = prev.findIndex(i => i.productId === productId && i.variantId === variantId);
      if (idx === -1) return prev;

      const item = prev[idx];
      const previousStock = item.currentStock;
      const newStock = Math.max(0, previousStock + change);

      const updatedItem = {
        ...item,
        currentStock: newStock,
        availableStock: Math.max(0, newStock - item.allocatedStock),
        status: determineStatus(newStock, item.minimumStock)
      };

      const audit: StockAuditLog = {
        id: `aud_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        variantId,
        timestamp: new Date().toISOString(),
        previousStock,
        newStock,
        change,
        reason,
        notes: orderId ? `Stock changed due to order ${orderId}` : `Relational stock update of ${change} units.`,
        actedBy: profile?.id || 'system',
        orderId
      };

      setAuditLog(aPrev => [audit, ...aPrev]);
      checkAndGenerateAlert(updatedItem, newStock);

      const copy = [...prev];
      copy[idx] = updatedItem;
      return copy;
    });
  };

  /**
   * getAuditLog
   */
  const getAuditLog = (productId?: string, dateRange?: { start: string; end: string }) => {
    let logs = [...auditLog];
    if (productId) {
      logs = logs.filter(l => l.productId === productId);
    }
    if (dateRange) {
      const start = new Date(dateRange.start).getTime();
      const end = new Date(dateRange.end).getTime();
      logs = logs.filter(l => {
        const time = new Date(l.timestamp).getTime();
        return time >= start && time <= end;
      });
    }
    return logs;
  };

  /**
   * setMinimumStock
   */
  const setMinimumStock = (productId: string, amount: number, variantId?: string) => {
    setInventoryItems(prev => {
      return prev.map(item => {
        if (item.productId === productId && item.variantId === variantId) {
          return {
            ...item,
            minimumStock: amount,
            status: determineStatus(item.currentStock, amount)
          };
        }
        return item;
      });
    });
  };

  /**
   * generateLowStockReport
   */
  const generateLowStockReport = () => {
    return inventoryItems.filter(item => item.status === 'low_stock' || item.status === 'out_of_stock');
  };

  /**
   * acknowledgeAlert
   */
  const acknowledgeAlert = (alertId: string) => {
    setStockAlerts(prev =>
      prev.map(a =>
        a.id === alertId
          ? { ...a, acknowledged: true, acknowledgedBy: profile?.id || 'admin', acknowledgedAt: new Date().toISOString() }
          : a
      )
    );
  };

  /**
   * getVarianceReport - Mock physical count mismatch detection
   */
  const getVarianceReport = () => {
    return inventoryItems.map(item => {
      // Mock some physical stock count with small variances for demo purposes
      let physicalCount = item.currentStock;
      if (item.productId === '2') physicalCount = 10; // Recorded: 8, Physical: 10 (+2)
      if (item.productId === 'apex-2') physicalCount = 1; // Recorded: 3, Physical: 1 (-2)
      if (item.productId === 'urbanfit-2') physicalCount = 18; // Correct
      
      return {
        itemId: item.productId,
        name: item.productName,
        recorded: item.currentStock,
        physical: physicalCount,
        difference: physicalCount - item.currentStock
      };
    });
  };

  /**
   * bulkStockImport
   */
  const bulkStockImport = (csvData: string) => {
    try {
      const lines = csvData.split('\n');
      if (lines.length <= 1) {
        return { success: false, count: 0, error: 'Empty or invalid CSV file' };
      }

      let count = 0;
      setInventoryItems(prev => {
        const copy = [...prev];
        
        // CSV Headers: SKU,Quantity,MinStock,MaxStock
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(',');
          if (parts.length < 2) continue;

          const sku = parts[0].trim();
          const quantity = parseInt(parts[1].trim(), 10);
          const minStock = parts[2] ? parseInt(parts[2].trim(), 10) : undefined;
          const maxStock = parts[3] ? parseInt(parts[3].trim(), 10) : undefined;

          if (isNaN(quantity)) continue;

          const itemIdx = copy.findIndex(item => item.sku.toLowerCase() === sku.toLowerCase());
          if (itemIdx !== -1) {
            const oldItem = copy[itemIdx];
            const updated = {
              ...oldItem,
              currentStock: quantity,
              availableStock: Math.max(0, quantity - oldItem.allocatedStock),
              minimumStock: minStock !== undefined && !isNaN(minStock) ? minStock : oldItem.minimumStock,
              maximumStock: maxStock !== undefined && !isNaN(maxStock) ? maxStock : oldItem.maximumStock,
              status: determineStatus(quantity, minStock !== undefined && !isNaN(minStock) ? minStock : oldItem.minimumStock)
            };

            // Log import to Audit
            const audit: StockAuditLog = {
              id: `aud_${Math.random().toString(36).substr(2, 9)}`,
              productId: oldItem.productId,
              timestamp: new Date().toISOString(),
              previousStock: oldItem.currentStock,
              newStock: quantity,
              change: quantity - oldItem.currentStock,
              reason: 'restock',
              notes: 'Bulk stock update via CSV import',
              actedBy: profile?.id || 'admin'
            };

            setAuditLog(aPrev => [audit, ...aPrev]);
            copy[itemIdx] = updated;
            count++;
          }
        }
        return copy;
      });

      return { success: true, count };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Parsing error' };
    }
  };

  /**
   * allocateStock - reserve stock temporarily for an active order
   */
  const allocateStock = (productId: string, quantity: number, variantId?: string) => {
    setInventoryItems(prev => {
      return prev.map(item => {
        if (item.productId === productId && item.variantId === variantId) {
          const newAllocated = item.allocatedStock + quantity;
          return {
            ...item,
            allocatedStock: newAllocated,
            availableStock: Math.max(0, item.currentStock - newAllocated)
          };
        }
        return item;
      });
    });
  };

  /**
   * deallocateStock - release or subtract allocated stock (on order ship or cancel)
   */
  const deallocateStock = (productId: string, quantity: number, variantId?: string) => {
    setInventoryItems(prev => {
      return prev.map(item => {
        if (item.productId === productId && item.variantId === variantId) {
          const newAllocated = Math.max(0, item.allocatedStock - quantity);
          return {
            ...item,
            allocatedStock: newAllocated,
            availableStock: Math.max(0, item.currentStock - newAllocated)
          };
        }
        return item;
      });
    });
  };

  /**
   * undoLastAdjustment
   */
  const undoLastAdjustment = () => {
    if (undoStack.length === 0) return false;

    const lastAction = undoStack[0];
    setInventoryItems(prev => {
      const idx = prev.findIndex(i => i.productId === lastAction.productId && i.variantId === lastAction.variantId);
      if (idx === -1) return prev;

      const item = prev[idx];
      const updated = {
        ...item,
        currentStock: lastAction.previousStock,
        availableStock: Math.max(0, lastAction.previousStock - item.allocatedStock),
        status: determineStatus(lastAction.previousStock, item.minimumStock)
      };

      const audit: StockAuditLog = {
        id: `aud_${Math.random().toString(36).substr(2, 9)}`,
        productId: lastAction.productId,
        variantId: lastAction.variantId,
        timestamp: new Date().toISOString(),
        previousStock: item.currentStock,
        newStock: lastAction.previousStock,
        change: lastAction.previousStock - item.currentStock,
        reason: 'manual_adjustment',
        notes: `Undo manual stock change. Rolled back SKU ${lastAction.sku}.`,
        actedBy: profile?.id || 'admin'
      };

      setAuditLog(aPrev => [audit, ...aPrev]);

      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });

    setUndoStack(prev => prev.slice(1));
    return true;
  };

  /**
   * triggerMockSale - simulate a real-time order transaction sale
   */
  const triggerMockSale = (productId: string, quantity: number) => {
    allocateStock(productId, quantity);
    setTimeout(() => {
      // Simulate order transition to packaged/shipped: deallocate and deduct stock
      deallocateStock(productId, quantity);
      logStockChange(productId, -quantity, 'order_placed', `CHO-MOCK-${Math.floor(Math.random() * 900000 + 100000)}`);
    }, 1500);
  };

  const canUndo = undoStack.length > 0;

  return (
    <InventoryContext.Provider
      value={{
        inventoryItems,
        inventory: inventoryItems,
        auditLog,
        stockAlerts,
        getStockLevel,
        updateStock,
        logStockChange,
        getAuditLog,
        setMinimumStock,
        generateLowStockReport,
        acknowledgeAlert,
        getVarianceReport,
        bulkStockImport,
        allocateStock,
        deallocateStock,
        undoLastAdjustment,
        canUndo,
        triggerMockSale
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within an InventoryProvider');
  return context;
};
