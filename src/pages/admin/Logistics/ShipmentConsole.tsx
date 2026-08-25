import React, { useState, useEffect } from 'react';
import { operationsApi, type OpsShipment } from '../../../services/operationsApi';
import { Shipment } from '../../../types/shipment';
import { mapOpsShipmentToShipment } from './mapOpsShipment';
import {
  Package,
  Search,
  Filter,
  Truck,
  Clock,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  User,
  MapPin,
  Pencil,
  X,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';

/**
 * Sprint 11 remediation: this screen previously showed fabricated sandbox
 * shipment data from LogisticsService (Firestore/localStorage fallback, zero
 * real courier credentials configured anywhere) with per-row/batch actions
 * ("Sync Courier", "Request Pickup", "Print Labels", "Cancel") that only
 * mutated that same fake in-browser store and never touched a real courier.
 *
 * Real shipment records exist server-side (server/operations/shipmentStore.ts)
 * and are updated by real courier webhooks (server/logisticsRouter.ts). This
 * screen now reads exclusively from GET /operations/shipments, and the only
 * write action offered is editing courier/trackingNumber — the only two
 * fields PATCH /operations/shipments/:id actually accepts. There is no real
 * backend for triggering a courier sync, requesting pickup, cancelling a
 * shipment, or generating a label, so those actions have been removed rather
 * than left pointing at fabricated data.
 */
export default function ShipmentConsole() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCourier, setSelectedCourier] = useState<string>('all');

  // Edit courier/trackingNumber (the only two fields the real PATCH endpoint accepts)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCourier, setEditCourier] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiRows = await operationsApi.listShipments();
      setShipments(apiRows.map(mapOpsShipmentToShipment));
    } catch (err: any) {
      setError(err?.message || 'Failed to load shipments from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEdit = (s: Shipment) => {
    setEditingId(s.id);
    setEditCourier(s.courier.code);
    setEditTrackingNumber(s.trackingNumber);
    setSaveError(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated: OpsShipment = await operationsApi.updateShipment(editingId, {
        courier: editCourier.trim(),
        trackingNumber: editTrackingNumber.trim(),
      });
      setShipments((prev) =>
        prev.map((s) => (s.id === editingId ? mapOpsShipmentToShipment(updated) : s)),
      );
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // Filter logic
  const filteredShipments = shipments.filter(s => {
    const matchesSearch =
      s.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customerContact.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || s.status === selectedStatus;
    const matchesCourier = selectedCourier === 'all' || s.courier.code === selectedCourier;

    return matchesSearch && matchesStatus && matchesCourier;
  });

  // Calculate metrics
  const totalCount = filteredShipments.length;
  const inTransitCount = filteredShipments.filter(s => s.status === 'in_transit').length;
  const deliveredCount = filteredShipments.filter(s => s.status === 'delivered').length;
  const pendingPickupCount = filteredShipments.filter(s => s.status === 'pending_pickup').length;
  const failedCount = filteredShipments.filter(s => s.status === 'failed_delivery' || s.status === 'delivery_failed').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
          <Package className="h-6 w-6 text-indigo-600" />
          Shipment Console
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Live shipment status and tracking history as recorded by real courier webhooks. Editing here only updates the courier and tracking number on file.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-900 text-sm">Failed to load shipments</h4>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 border border-rose-200 bg-white px-2.5 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Shipments', val: totalCount, icon: Package, col: 'indigo' },
          { label: 'Pending Pickup', val: pendingPickupCount, icon: Clock, col: 'amber' },
          { label: 'In Transit', val: inTransitCount, icon: Truck, col: 'blue' },
          { label: 'Delivered', val: deliveredCount, icon: CheckCircle, col: 'emerald' },
          { label: 'Failed Delivery', val: failedCount, icon: AlertTriangle, col: 'rose' }
        ].map((m, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${m.col}-50 text-${m.col}-600 border border-${m.col}-100`}>
              <m.icon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium block uppercase tracking-wider">{m.label}</span>
              <span className="text-xl font-semibold text-gray-900 font-mono">{m.val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-app-text-secondary mr-2" />
          <input
            type="text"
            placeholder="Search by Tracking, Order ID, or Customer..."
            className="w-full text-sm outline-none text-gray-700 bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-app-text-secondary" />
            <span className="text-xs text-gray-500 font-medium uppercase">Status:</span>
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-indigo-500 text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="pending_pickup">Pending Pickup</option>
            <option value="picked_up">Picked Up</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="failed_delivery">Failed Delivery</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={selectedCourier}
            onChange={(e) => setSelectedCourier(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-indigo-500 text-gray-700"
          >
            <option value="all">All Carriers</option>
            <option value="steadfast">Steadfast</option>
            <option value="pathao">Pathao</option>
            <option value="redx">REDX</option>
            <option value="paperfly">Paperfly</option>
            <option value="ecourier">eCourier</option>
            <option value="sundarban">Sundarban</option>
          </select>

          <button
            onClick={loadData}
            disabled={loading}
            className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Shipment Grid / Table */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 bg-gray-100 rounded-xl border border-gray-200" />
          ))}
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Package className="h-10 w-10 text-app-text-secondary mx-auto mb-3" />
          <p className="text-gray-900 font-medium">
            {shipments.length === 0 ? 'No shipments recorded yet.' : 'No shipments match your current criteria.'}
          </p>
          <p className="text-sm text-app-text-secondary mt-1">
            {shipments.length === 0
              ? 'Shipments are created automatically when a real order comes in.'
              : 'Try adjusting the search query or status filter parameters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShipments.map((s) => {
            const isDelivered = s.status === 'delivered';
            const isInTransit = s.status === 'in_transit';
            const isPendingPickup = s.status === 'pending_pickup';
            const isFailed = s.status === 'failed_delivery' || s.status === 'delivery_failed' || s.status === 'failed';

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-gray-300 transition-all"
              >
                {/* Upper row */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Waybill / Courier */}
                  <div className="md:col-span-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 font-semibold uppercase">
                        {s.courier.name}
                      </span>
                      <span className="text-xs text-app-text-secondary font-mono">#{s.id}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block uppercase font-medium">Tracking Code</span>
                      <p className="font-mono text-sm font-semibold text-gray-900">{s.trackingNumber}</p>
                    </div>
                  </div>

                  {/* Order info */}
                  <div className="md:col-span-3 space-y-1">
                    <span className="text-xs text-gray-500 block uppercase font-medium">Platform Link</span>
                    <p className="text-sm font-semibold text-gray-900">{s.orderId}</p>
                  </div>

                  {/* Customer & Destination */}
                  <div className="md:col-span-3 space-y-1">
                    <span className="text-xs text-gray-500 block uppercase font-medium">Delivery Consignee</span>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-app-text-secondary" />
                      {s.customerContact.name}
                    </p>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-app-text-secondary" />
                      {s.deliveryAddress.city}, {s.deliveryAddress.district}
                    </span>
                  </div>

                  {/* COD */}
                  <div className="md:col-span-1.5 space-y-1 text-left md:text-right">
                    <span className="text-xs text-gray-500 block uppercase font-medium">COD Amount</span>
                    <p className="text-sm font-bold text-indigo-700 font-mono">BDT {s.codAmount}</p>
                  </div>

                  {/* Status Indicator */}
                  <div className="md:col-span-1.5 flex flex-col items-start md:items-end gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                      isDelivered
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isInTransit
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : isPendingPickup
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : isFailed
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {s.status.toUpperCase().replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-app-text-secondary block">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Lower action row */}
                <div className="bg-gray-50/50 px-5 py-3 border-t border-gray-100 flex justify-between items-center gap-3">
                  <span className="text-xs text-app-text-secondary">
                    Last updated {new Date(s.updatedAt).toLocaleString()}
                  </span>
                  <button
                    onClick={() => openEdit(s)}
                    className="text-xs font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 shadow-sm transition-colors"
                  >
                    <Pencil className="h-3 w-3 text-app-text-secondary" />
                    Edit Courier / Tracking No.
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit courier/trackingNumber modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-sm w-full overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 text-sm">Edit Shipment</h3>
              <button onClick={closeEdit} className="text-app-text-secondary hover:text-gray-600" disabled={saving}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <p className="text-xs text-app-text-secondary">
                Only courier and tracking number can be corrected here — status and tracking history are updated automatically by courier webhooks.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Courier</label>
                <select
                  value={editCourier}
                  onChange={(e) => setEditCourier(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:border-indigo-500"
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
                <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Tracking Number</label>
                <input
                  type="text"
                  required
                  value={editTrackingNumber}
                  onChange={(e) => setEditTrackingNumber(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              {saveError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2">{saveError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-2 bg-indigo-600 text-white font-medium rounded-lg text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
