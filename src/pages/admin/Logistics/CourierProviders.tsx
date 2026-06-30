import React, { useState, useEffect } from 'react';
import { LogisticsService } from '../../../services/logistics/LogisticsService';
import { useLogistics } from '../../../contexts/LogisticsContext';
import { CourierProviderConfig } from '../../../types/courier';
import { Shipment, ShipmentStatus } from '../../../types/shipment';
import { 
  Truck, 
  Settings2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Search,
  ExternalLink,
  Shield,
  FileText,
  Home,
  MapPin,
  GitBranch,
  Play,
  Plus,
  Trash2,
  Sliders,
  User,
  Phone,
  Mail,
  Layers,
  Sparkles,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CourierProviders() {
  const logisticsService = LogisticsService.getInstance();
  const { 
    warehouses, 
    shippingRules, 
    createWarehouse, 
    createShippingRule,
    activeCouriers: contextCouriers
  } = useLogistics();

  const [configs, setConfigs] = useState<CourierProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [healthChecking, setHealthChecking] = useState<Record<string, boolean>>({});
  const [editingCourier, setEditingCourier] = useState<CourierProviderConfig | null>(null);

  // Tabs: 'providers' | 'warehouses' | 'rules' | 'simulator'
  const [activeTab, setActiveTab] = useState<'providers' | 'warehouses' | 'rules' | 'simulator'>('providers');

  // Warehouses state
  const [whName, setWhName] = useState('');
  const [whStreet, setWhStreet] = useState('');
  const [whCity, setWhCity] = useState('');
  const [whDistrict, setWhDistrict] = useState('');
  const [whPostal, setWhPostal] = useState('');
  const [whPhone, setWhPhone] = useState('');
  const [whContactName, setWhContactName] = useState('');
  const [whContactPhone, setWhContactPhone] = useState('');
  const [whContactEmail, setWhContactEmail] = useState('');
  const [whPreferredCourier, setWhPreferredCourier] = useState('steadfast');
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);

  // Rules state
  const [ruleName, setRuleName] = useState('');
  const [rulePriority, setRulePriority] = useState(1);
  const [ruleDistricts, setRuleDistricts] = useState('');
  const [ruleMinWeight, setRuleMinWeight] = useState(0);
  const [ruleMaxWeight, setRuleMaxWeight] = useState(10);
  const [ruleMinVal, setRuleMinVal] = useState(0);
  const [ruleMaxVal, setRuleMaxVal] = useState(50000);
  const [ruleCourier, setRuleCourier] = useState('steadfast');
  const [rulePkgType, setRulePkgType] = useState('regular');
  const [ruleAutoPickup, setRuleAutoPickup] = useState(true);
  const [ruleAutoLabel, setRuleAutoLabel] = useState(true);
  const [showAddRule, setShowAddRule] = useState(false);

  // Simulator state
  const [shipmentsList, setShipmentsList] = useState<Shipment[]>([]);
  const [selectedSimShipmentId, setSelectedSimShipmentId] = useState('');
  const [simCourier, setSimCourier] = useState('steadfast');
  const [simStatus, setSimStatus] = useState<ShipmentStatus>('in_transit');
  const [simLocation, setSimLocation] = useState('Dhaka Distribution Center');
  const [simDescription, setSimDescription] = useState('Parcel cleared customs and sorted.');
  const [simRemarks, setSimRemarks] = useState('Expected delivery on next working day.');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  // Load configs & shipments
  useEffect(() => {
    async function loadData() {
      try {
        const data = await logisticsService.getCourierConfigs();
        setConfigs(data);

        const shipments = await logisticsService.getShipments();
        setShipmentsList(shipments);
        if (shipments.length > 0) {
          setSelectedSimShipmentId(shipments[0].id);
        }
      } catch (err) {
        console.error('Failed to load courier configs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToggleStatus = async (code: string, currentStatus: boolean) => {
    try {
      await logisticsService.updateCourierStatus(code, !currentStatus);
      const updated = await logisticsService.getCourierConfigs();
      setConfigs(updated);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleCheckHealth = async (code: string) => {
    setHealthChecking(prev => ({ ...prev, [code]: true }));
    try {
      const courier = logisticsService.getCourier(code);
      if (courier) {
        const res = await courier.healthCheck();
        setConfigs(prev => prev.map(c => {
          if (c.code === code) {
            return { 
              ...c, 
              healthStatus: res.status === 'healthy' ? 'healthy' : 'down',
              lastSyncAt: new Date().toISOString()
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setHealthChecking(prev => ({ ...prev, [code]: false }));
    }
  };

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCourier) return;

    try {
      await logisticsService.saveCourierConfig(editingCourier);
      const updated = await logisticsService.getCourierConfigs();
      setConfigs(updated);
      setEditingCourier(null);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  // Add Warehouse Submit
  const handleAddWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWarehouse({
        sellerId: 'seller_001', // Standard demo seller ID matching other dashboard routes
        name: whName,
        address: {
          street: whStreet,
          city: whCity,
          district: whDistrict,
          postalCode: whPostal,
          phone: whPhone
        },
        contactPerson: {
          name: whContactName,
          phone: whContactPhone,
          email: whContactEmail
        },
        isDefault: warehouses.length === 0,
        couriers: ['steadfast', 'pathao', 'redx'],
        preferredCourier: whPreferredCourier
      });

      // Reset
      setWhName('');
      setWhStreet('');
      setWhCity('');
      setWhDistrict('');
      setWhPostal('');
      setWhPhone('');
      setWhContactName('');
      setWhContactPhone('');
      setWhContactEmail('');
      setShowAddWarehouse(false);
    } catch (err) {
      console.error('Error adding warehouse:', err);
    }
  };

  // Add Shipping Rule Submit
  const handleAddRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedDistricts = ruleDistricts ? ruleDistricts.split(',').map(d => d.trim()) : undefined;
      await createShippingRule({
        sellerId: 'seller_001',
        name: ruleName,
        enabled: true,
        priority: Number(rulePriority),
        conditions: {
          destinationDistricts: parsedDistricts,
          weightRange: { min: Number(ruleMinWeight), max: Number(ruleMaxWeight) },
          orderValueRange: { min: Number(ruleMinVal), max: Number(ruleMaxVal) }
        },
        action: {
          courierCode: ruleCourier,
          packageType: rulePkgType,
          autoRequestPickup: ruleAutoPickup,
          autoGenerateLabel: ruleAutoLabel
        }
      });

      // Reset
      setRuleName('');
      setRulePriority(1);
      setRuleDistricts('');
      setRuleMinWeight(0);
      setRuleMaxWeight(10);
      setRuleMinVal(0);
      setRuleMaxVal(50000);
      setShowAddRule(false);
    } catch (err) {
      console.error('Error adding rule:', err);
    }
  };

  // Simulate Webhook Ingestion Trigger
  const handleFireSimulateWebhook = async () => {
    if (!selectedSimShipmentId) return;
    const shipment = shipmentsList.find(s => s.id === selectedSimShipmentId);
    if (!shipment) return;

    setSimulating(true);
    setSimulationResult(null);

    // Build payload mimicking exact courier payload structure based on chosen code
    let payload: any = {};
    if (simCourier === 'steadfast') {
      payload = {
        tracking_code: shipment.trackingNumber,
        status_code: simStatus === 'delivered' ? 'delivered' : simStatus,
        current_location: simLocation,
        comment: simDescription
      };
    } else if (simCourier === 'pathao') {
      payload = {
        consignment_id: shipment.trackingNumber,
        status: simStatus,
        location: simLocation,
        remarks: simDescription
      };
    } else if (simCourier === 'redx') {
      payload = {
        tracking_id: shipment.trackingNumber,
        status: simStatus,
        location: simLocation,
        note: simDescription
      };
    } else if (simCourier === 'paperfly') {
      payload = {
        tracking_number: shipment.trackingNumber,
        status: simStatus,
        hub: simLocation,
        comment: simDescription
      };
    } else if (simCourier === 'ecourier') {
      payload = {
        tracking_id: shipment.trackingNumber,
        status: simStatus === 'delivered' ? 'SUCCESS_DELIVERED' : simStatus,
        location: simLocation,
        remarks: simDescription
      };
    } else { // sundarban
      payload = {
        sdn_tracking: shipment.trackingNumber,
        sdn_status: simStatus === 'delivered' ? 'DELIVERED' : simStatus,
        location: simLocation,
        message: simDescription
      };
    }

    try {
      const response = await fetch('/api/logistics/simulate-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courier: simCourier,
          payload
        })
      });

      const resJson = await response.json();
      if (resJson.success) {
        setSimulationResult({
          success: true,
          message: `Webhook received and processed correctly! Shipment status updated to "${resJson.shipment.status}"`,
          data: resJson
        });
        
        // Reload shipments
        const refreshed = await logisticsService.getShipments();
        setShipmentsList(refreshed);
      } else {
        setSimulationResult({
          success: false,
          message: resJson.message || 'Simulation processed with errors.'
        });
      }
    } catch (err: any) {
      setSimulationResult({
        success: false,
        message: err.message || 'Failed to submit simulation request.'
      });
    } finally {
      setSimulating(false);
    }
  };

  const filteredConfigs = configs.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-indigo-600 animate-pulse" />
            Logistics & Operations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enterprise scaling: configure carriers, design auto-routing logic, manage warehouses, and verify webhooks.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'providers', label: 'Carrier Integrations', icon: Truck },
          { id: 'warehouses', label: 'Warehouse Locations', icon: Home },
          { id: 'rules', label: 'Shipping Rules Engine', icon: GitBranch },
          { id: 'simulator', label: 'Webhook Developer Simulator', icon: Play },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setSimulationResult(null);
            }}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 text-sm font-medium transition-colors outline-none ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Panel Content */}
      <div className="space-y-6">
        
        {/* TAB 1: CARRIER INTEGRATIONS */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="flex items-center bg-white rounded-lg border border-gray-200 px-3 py-2 max-w-md shadow-sm">
              <Search className="h-4 w-4 text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search carrier integrations..."
                className="w-full text-sm outline-none text-gray-700 bg-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-64 bg-gray-100 rounded-xl border border-gray-200" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredConfigs.map((courier) => {
                  const isHealthy = courier.healthStatus === 'healthy';
                  return (
                    <motion.div
                      key={courier.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                    >
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {courier.logo ? (
                              <img 
                                src={courier.logo} 
                                alt={courier.name} 
                                referrerPolicy="no-referrer"
                                className="h-10 w-10 rounded-lg object-contain bg-gray-50 p-1 border border-gray-100" 
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                                {courier.name[0]}
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold text-gray-900">{courier.name}</h3>
                              <span className="text-xs text-gray-500 font-mono uppercase">{courier.code}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium">Active</span>
                            <button
                              onClick={() => handleToggleStatus(courier.code, courier.enabled)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-2 ${
                                courier.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  courier.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-gray-50">
                          <div>
                            <span className="text-gray-400 block">Environments:</span>
                            <span className="font-semibold text-gray-700">
                              {courier.production ? 'Production' : 'Sandbox-only'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Gateway Server:</span>
                            <span className="font-semibold text-gray-700 truncate block font-mono">
                              {courier.apiUrl}
                            </span>
                          </div>
                        </div>

                        {/* Health Info */}
                        <div className="flex items-center justify-between bg-gray-50/50 p-3 rounded-lg border border-gray-100 text-xs">
                          <div className="flex items-center gap-2">
                            {isHealthy ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-rose-500" />
                            )}
                            <span className="text-gray-600">
                              Status: <strong className={isHealthy ? 'text-emerald-700' : 'text-rose-700'}>
                                {courier.healthStatus ? courier.healthStatus.toUpperCase() : 'HEALTHY'}
                              </strong>
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Sync: {courier.lastSyncAt ? new Date(courier.lastSyncAt).toLocaleTimeString() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4">
                        <button
                          onClick={() => handleCheckHealth(courier.code)}
                          disabled={healthChecking[courier.code]}
                          className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${healthChecking[courier.code] ? 'animate-spin' : ''}`} />
                          {healthChecking[courier.code] ? 'Pinging Gateway...' : 'Health Audit'}
                        </button>

                        <button
                          onClick={() => setEditingCourier(courier)}
                          className="flex items-center gap-1 text-xs bg-white hover:bg-gray-100 text-gray-700 font-semibold border border-gray-300 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                        >
                          <Settings2 className="h-3 w-3" />
                          Configure API
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WAREHOUSE LOCATIONS */}
        {activeTab === 'warehouses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Pickup & Inventory Locations</h3>
                <p className="text-sm text-gray-500">Configure pickup depots from where couriers will collect outgoing shipments.</p>
              </div>
              <button
                onClick={() => setShowAddWarehouse(!showAddWarehouse)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4" />
                Register New Warehouse
              </button>
            </div>

            {/* Register Warehouse Drawer/Form */}
            <AnimatePresence>
              {showAddWarehouse && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-6 overflow-hidden"
                >
                  <form onSubmit={handleAddWarehouseSubmit} className="space-y-4">
                    <h4 className="font-semibold text-gray-900 border-b pb-2 mb-4">New Warehouse Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Warehouse Name</label>
                        <input
                          type="text" required placeholder="e.g. Banani Central Hub"
                          value={whName} onChange={(e) => setWhName(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Preferred Carrier</label>
                        <select
                          value={whPreferredCourier} onChange={(e) => setWhPreferredCourier(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        >
                          <option value="steadfast">Steadfast</option>
                          <option value="pathao">Pathao</option>
                          <option value="redx">REDX</option>
                          <option value="paperfly">Paperfly</option>
                          <option value="ecourier">eCourier</option>
                          <option value="sundarban">Sundarban</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">General Office Phone</label>
                        <input
                          type="text" required placeholder="e.g. 01712345678"
                          value={whPhone} onChange={(e) => setWhPhone(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Street Address</label>
                        <input
                          type="text" required placeholder="e.g. House 45, Road 11"
                          value={whStreet} onChange={(e) => setWhStreet(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">City</label>
                        <input
                          type="text" required placeholder="e.g. Dhaka"
                          value={whCity} onChange={(e) => setWhCity(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">District</label>
                        <input
                          type="text" required placeholder="e.g. Dhaka"
                          value={whDistrict} onChange={(e) => setWhDistrict(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                    </div>

                    <h4 className="font-semibold text-gray-900 border-b pb-2 pt-2">Contact Person / Warehouse Manager</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Full Name</label>
                        <input
                          type="text" required placeholder="e.g. Arif Rahman"
                          value={whContactName} onChange={(e) => setWhContactName(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Direct Phone</label>
                        <input
                          type="text" required placeholder="e.g. 01812345679"
                          value={whContactPhone} onChange={(e) => setWhContactPhone(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Email Address</label>
                        <input
                          type="email" required placeholder="e.g. arif@choosify.com"
                          value={whContactEmail} onChange={(e) => setWhContactEmail(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => setShowAddWarehouse(false)}
                        className="px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 shadow"
                      >
                        Register Warehouse
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Warehouse List */}
            {warehouses.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center space-y-4">
                <Home className="h-12 w-12 text-gray-300 mx-auto" />
                <h4 className="font-semibold text-gray-900">No Custom Warehouses Registered</h4>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  By default, shipments use your primary seller profile address. Add a warehouse to schedule custom carrier pickups.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {warehouses.map((wh) => (
                  <div key={wh.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4 relative overflow-hidden">
                    {wh.isDefault && (
                      <span className="absolute top-4 right-4 bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-emerald-200">
                        Primary Depot
                      </span>
                    )}

                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Home className="h-5 w-5 text-indigo-600" />
                      {wh.name}
                    </h4>

                    {/* Address block */}
                    <div className="space-y-2 border-t pt-3 text-sm text-gray-600">
                      <p className="flex items-start gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span>{wh.address.street}, {wh.address.city}, {wh.address.district} - {wh.address.postalCode || 'N/A'}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span>Office: {wh.address.phone}</span>
                      </p>
                    </div>

                    {/* Contact Person */}
                    <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 text-xs">
                      <p className="font-semibold text-gray-900 mb-1 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-indigo-600" />
                        Manager: {wh.contactPerson.name}
                      </p>
                      <p className="text-gray-500 flex items-center gap-2">
                        <span>📱 {wh.contactPerson.phone}</span>
                        <span>•</span>
                        <span>✉️ {wh.contactPerson.email}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 text-gray-500 border-t">
                      <span>Preferred Carrier: <strong className="text-gray-700 capitalize font-mono">{wh.preferredCourier}</strong></span>
                      <span className="font-mono text-[10px] text-gray-400">ID: {wh.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SHIPPING RULES ENGINE */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Automated Courier Dispatch Rules</h3>
                <p className="text-sm text-gray-500">Configure conditional parameters to automatically route order dispatches to optimal couriers.</p>
              </div>
              <button
                onClick={() => setShowAddRule(!showAddRule)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Automation Rule
              </button>
            </div>

            {/* Add Rule Form */}
            <AnimatePresence>
              {showAddRule && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-6 overflow-hidden"
                >
                  <form onSubmit={handleAddRuleSubmit} className="space-y-4">
                    <h4 className="font-semibold text-gray-900 border-b pb-2 mb-4">Rule Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Rule Name</label>
                        <input
                          type="text" required placeholder="e.g. Dhaka Express Logistics"
                          value={ruleName} onChange={(e) => setRuleName(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Priority Order (Higher = Evaluated First)</label>
                        <input
                          type="number" required min="1" max="100"
                          value={rulePriority} onChange={(e) => setRulePriority(Number(e.target.value))}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Target District Filter</label>
                        <input
                          type="text" placeholder="e.g. Dhaka, Chittagong (Comma-separated or leave empty)"
                          value={ruleDistricts} onChange={(e) => setRuleDistricts(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Min Weight (kg)</label>
                        <input
                          type="number" step="0.1" required
                          value={ruleMinWeight} onChange={(e) => setRuleMinWeight(Number(e.target.value))}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Max Weight (kg)</label>
                        <input
                          type="number" step="0.1" required
                          value={ruleMaxWeight} onChange={(e) => setRuleMaxWeight(Number(e.target.value))}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Min Order Value (BDT)</label>
                        <input
                          type="number" required
                          value={ruleMinVal} onChange={(e) => setRuleMinVal(Number(e.target.value))}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Max Order Value (BDT)</label>
                        <input
                          type="number" required
                          value={ruleMaxVal} onChange={(e) => setRuleMaxVal(Number(e.target.value))}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                    </div>

                    <h4 className="font-semibold text-gray-900 border-b pb-2 pt-2">Action Trigger</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Assign Courier</label>
                        <select
                          value={ruleCourier} onChange={(e) => setRuleCourier(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        >
                          <option value="steadfast">Steadfast</option>
                          <option value="pathao">Pathao</option>
                          <option value="redx">REDX</option>
                          <option value="paperfly">Paperfly</option>
                          <option value="ecourier">eCourier</option>
                          <option value="sundarban">Sundarban</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Package Category</label>
                        <select
                          value={rulePkgType} onChange={(e) => setRulePkgType(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        >
                          <option value="regular">Regular Box</option>
                          <option value="express">Express Delivery</option>
                          <option value="fragile">Fragile Content</option>
                          <option value="perishable">Perishable Product</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox" id="auto-pickup"
                          checked={ruleAutoPickup} onChange={(e) => setRuleAutoPickup(e.target.checked)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="auto-pickup" className="text-xs font-semibold text-gray-700">Auto-request Pickup</label>
                      </div>

                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox" id="auto-label"
                          checked={ruleAutoLabel} onChange={(e) => setRuleAutoLabel(e.target.checked)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="auto-label" className="text-xs font-semibold text-gray-700">Auto-generate Label</label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => setShowAddRule(false)}
                        className="px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 shadow"
                      >
                        Publish Shipping Rule
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rules List */}
            {shippingRules.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center space-y-4">
                <GitBranch className="h-12 w-12 text-gray-300 mx-auto" />
                <h4 className="font-semibold text-gray-900">No Routing Rules Created</h4>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  Automatically match incoming orders with the best courier based on destination, weight, and order value.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {shippingRules.sort((a,b) => b.priority - a.priority).map((rule) => (
                  <div key={rule.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-200 transition-colors">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-gray-900 text-md">{rule.name}</h4>
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                          Priority {rule.priority}
                        </span>
                        {rule.enabled ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">Enabled</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-gray-200">Disabled</span>
                        )}
                      </div>

                      {/* Conditions */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Sliders className="h-3.5 w-3.5 text-gray-400" />
                          <span>Districts: <strong>{rule.conditions.destinationDistricts?.join(', ') || 'All BD'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-gray-400" />
                          <span>Weight: <strong>{rule.conditions.weightRange?.min || 0}kg - {rule.conditions.weightRange?.max || 50}kg</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-gray-400" />
                          <span>Order value: <strong>৳{rule.conditions.orderValueRange?.min || 0} - ৳{rule.conditions.orderValueRange?.max || 'No limit'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Action result */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-4 text-sm font-semibold text-gray-700 min-w-[280px]">
                      <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 font-mono uppercase">
                        {rule.action.courierCode[0]}
                      </div>
                      <div className="flex-1 text-xs">
                        <p className="font-semibold text-gray-900">Route to: <span className="capitalize font-mono">{rule.action.courierCode}</span></p>
                        <p className="text-gray-400 font-mono">Format: {rule.action.packageType}</p>
                        <p className="text-indigo-600 font-mono font-medium">
                          {rule.action.autoRequestPickup && '✓ Pickup'} {rule.action.autoGenerateLabel && '✓ Label'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WEBHOOK SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600" />
                Developer Webhook Sandbox
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Trigger real status changes by posting raw payloads directly to the backend webhooks. Monitor updates on the tracking timeline instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sandbox Controls */}
              <div className="space-y-4 bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h4 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-1.5 text-sm">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  Simulate Incoming Webhook Payload
                </h4>

                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">1. Choose Active Shipment</label>
                  {shipmentsList.length === 0 ? (
                    <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                      No active shipments found to simulate! Create a shipment inside the order console first.
                    </div>
                  ) : (
                    <select
                      value={selectedSimShipmentId}
                      onChange={(e) => {
                        setSelectedSimShipmentId(e.target.value);
                        const sh = shipmentsList.find(s => s.id === e.target.value);
                        if (sh) {
                          setSimCourier(sh.courier.code);
                        }
                      }}
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:border-indigo-500"
                    >
                      {shipmentsList.map(s => (
                        <option key={s.id} value={s.id}>
                          Order ID: {s.orderId} - Tracking: {s.trackingNumber} ({s.courier.name.toUpperCase()} / Current: {s.status.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Courier Origin</label>
                    <select
                      value={simCourier}
                      onChange={(e) => setSimCourier(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none"
                    >
                      <option value="steadfast">Steadfast Webhook</option>
                      <option value="pathao">Pathao Webhook</option>
                      <option value="redx">REDX Webhook</option>
                      <option value="paperfly">Paperfly Webhook</option>
                      <option value="ecourier">eCourier Webhook</option>
                      <option value="sundarban">Sundarban Webhook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 uppercase mb-1">New Shipment Status</label>
                    <select
                      value={simStatus}
                      onChange={(e) => setSimStatus(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none"
                    >
                      <option value="pending_pickup">Pending Pickup</option>
                      <option value="picked_up">Picked Up</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="failed_delivery">Failed Delivery</option>
                      <option value="returned">Returned</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Checkpoint Location</label>
                  <input
                    type="text"
                    value={simLocation}
                    onChange={(e) => setSimLocation(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    placeholder="e.g. Dhaka Central Hub"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Event Description</label>
                  <input
                    type="text"
                    value={simDescription}
                    onChange={(e) => setSimDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    placeholder="e.g. Cleared outbound hub sorting bags"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleFireSimulateWebhook}
                  disabled={simulating || !selectedSimShipmentId}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {simulating ? 'Ingesting Webhook...' : '🚀 Fire Live Webhook Ingestion'}
                </button>
              </div>

              {/* Sandbox Results */}
              <div className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 flex flex-col justify-between overflow-hidden min-h-[300px]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-mono text-indigo-400"># SANDBOX LOG MONITOR</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>

                  {simulationResult ? (
                    <div className="space-y-4 text-xs font-mono">
                      <p className={simulationResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                        {simulationResult.success ? '✓ SUCCESS' : '❌ ERROR'}: {simulationResult.message}
                      </p>

                      {simulationResult.success && simulationResult.data && (
                        <div className="space-y-2">
                          <p className="text-slate-400 border-b border-slate-800 pb-1">Normalized Event Payload Output:</p>
                          <pre className="p-2.5 bg-slate-950 rounded-lg text-[10px] text-slate-300 overflow-x-auto">
                            {JSON.stringify(simulationResult.data.normalized, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs font-mono py-12 text-center space-y-2">
                      <Database className="h-8 w-8 mx-auto text-slate-700" />
                      <p>Awaiting webhook trigger...</p>
                      <p className="text-[10px] text-slate-600">Select a shipment and click Fire to view JSON response payload.</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-500 font-mono">
                  Endpoint URL: POST /api/webhooks/logistics/:courier
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Editing Courier API Config Modal */}
      {editingCourier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-lg w-full overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Configure {editingCourier.name} Integration
              </h3>
              <button 
                onClick={() => setEditingCourier(null)}
                className="text-gray-400 hover:text-gray-600 outline-none"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">API Endpoint URL</label>
                  <input
                    type="text"
                    required
                    value={editingCourier.apiUrl}
                    onChange={(e) => setEditingCourier({ ...editingCourier, apiUrl: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">Webhook URL Secret</label>
                  <input
                    type="password"
                    value={editingCourier.webhookSecret || ''}
                    onChange={(e) => setEditingCourier({ ...editingCourier, webhookSecret: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">API Key / Merchant ID</label>
                <input
                  type="text"
                  required
                  value={editingCourier.apiKey}
                  onChange={(e) => setEditingCourier({ ...editingCourier, apiKey: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">API Secret Token</label>
                <input
                  type="password"
                  required
                  value={editingCourier.apiSecret}
                  onChange={(e) => setEditingCourier({ ...editingCourier, apiSecret: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-gray-900"
                />
              </div>

              <div className="flex items-center gap-6 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                <div className="flex items-center gap-2">
                  <input
                    id="sandbox-mode"
                    type="checkbox"
                    checked={editingCourier.sandboxMode || editingCourier.sandbox || false}
                    onChange={(e) => setEditingCourier({ 
                      ...editingCourier, 
                      sandbox: e.target.checked,
                      sandboxMode: e.target.checked 
                    })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="sandbox-mode" className="text-sm font-semibold text-gray-900">Enable Sandbox Mode</label>
                </div>
                <p className="text-xs text-gray-500 flex-1">
                  Requests will be executed in dry-run/sandbox environment simulating carrier response.
                </p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingCourier(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg text-sm hover:bg-indigo-700 transition-colors"
                >
                  Save Integration
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
