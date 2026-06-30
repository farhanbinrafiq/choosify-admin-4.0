import React, { useState } from 'react';
import { LogisticsService } from '../../../services/logistics/LogisticsService';
import { Shipment } from '../../../types/shipment';
import { 
  MapPin, 
  Search, 
  Compass, 
  Truck, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  AlertTriangle,
  User,
  Phone,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function TrackingCenter() {
  const logisticsService = LogisticsService.getInstance();
  const [searchTerm, setSearchTerm] = useState('');
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    setShipment(null);

    try {
      const result = await logisticsService.searchShipment(searchTerm.trim());
      setShipment(result);
    } catch (err: any) {
      setError(err.message || 'Tracking number not found in our logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2 py-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
          <Compass className="h-6 w-6 animate-spin-slow" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Live Tracking Center</h1>
        <p className="text-sm text-gray-500">
          Trace logistics consignments, retrieve route status checkpoints, and view estimated deliveries instantly.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            required
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter tracking number, waybill, or order reference..."
            className="w-full text-sm pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-white shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-900 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 bg-indigo-600 text-white font-medium rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          {loading ? 'Searching...' : 'Track'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* Main Panel */}
      <div className="space-y-6">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl mx-auto bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3"
          >
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-rose-900 text-sm">Tracking Lookup Failed</h4>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {!shipment && !error && !loading && (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl max-w-xl mx-auto bg-gray-50/50">
            <Truck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">Awaiting carrier trace</p>
          </div>
        )}

        {shipment && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Summary Top Row */}
            <div className="p-6 bg-gray-50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Carrier Partner</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold text-gray-900 font-mono text-sm bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                    {shipment.courier.name}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Consignment Waybill</span>
                <p className="text-sm font-bold text-gray-900 mt-1 font-mono">{shipment.trackingNumber}</p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Consignment Status</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                    shipment.status === 'delivered'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : shipment.status === 'in_transit'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : shipment.status === 'pending_pickup'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {shipment.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle Section: Route & Contacts */}
            <div className="p-6 border-b border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
              {/* Route */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">Transit Route</h3>
                <div className="relative pl-6 space-y-6">
                  {/* Origin Line */}
                  <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-dashed bg-gray-200" />

                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border bg-indigo-50 border-indigo-500" />
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-semibold">Origin (Warehouse)</span>
                      <p className="text-sm font-semibold text-gray-800">{shipment.pickupAddress.street}</p>
                      <p className="text-xs text-gray-500">{shipment.pickupAddress.city}, {shipment.pickupAddress.district}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border bg-emerald-50 border-emerald-500" />
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-semibold">Destination (Consignee)</span>
                      <p className="text-sm font-semibold text-gray-800">{shipment.deliveryAddress.street}</p>
                      <p className="text-xs text-gray-500">{shipment.deliveryAddress.city}, {shipment.deliveryAddress.district}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">Parties Involved</h3>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[10px] text-gray-400 block uppercase font-semibold">Shipper / Brand</span>
                    <p className="text-sm font-bold text-gray-900">{shipment.sellerContact.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {shipment.sellerContact.phone}</p>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[10px] text-gray-400 block uppercase font-semibold">Consignee Customer</span>
                    <p className="text-sm font-bold text-gray-900">{shipment.customerContact.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {shipment.customerContact.phone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Timeline */}
            <div className="p-6 bg-white space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">Consignment Travel History</h3>
              <div className="space-y-6 relative pl-6">
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-100" />

                {shipment.trackingEvents.map((evt, idx) => {
                  const isDelivered = evt.status === 'delivered';
                  const isFailed = evt.status === 'failed_delivery' || evt.status === 'delivery_failed';
                  const isFirst = idx === 0;

                  return (
                    <div key={evt.id || idx} className="relative flex gap-4">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                        isFirst 
                          ? 'bg-indigo-600 border-indigo-600 ring-4 ring-indigo-50' 
                          : isDelivered 
                          ? 'bg-emerald-500 border-emerald-500' 
                          : isFailed
                          ? 'bg-rose-500 border-rose-500'
                          : 'bg-white border-gray-300'
                      }`}>
                        {isFirst ? (
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        ) : isDelivered ? (
                          <CheckCircle className="h-3.5 w-3.5 text-white" />
                        ) : isFailed ? (
                          <XCircle className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {evt.status.toUpperCase().replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{evt.description}</p>
                        {evt.location && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-medium mt-1">
                            <MapPin className="h-2.5 w-2.5 text-gray-400" />
                            {evt.location}
                          </span>
                        )}
                        {evt.remarks && (
                          <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-100 rounded p-2 mt-2">
                            Remark: {evt.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
