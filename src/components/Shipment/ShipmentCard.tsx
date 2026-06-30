/**
 * ShipmentCard Component
 * 
 * Embedded in Order Console order detail modal.
 * Displays shipment status, allows courier selection, pickup, label generation, tracking.
 * 
 * Props: orderId, seller, customer, items, codAmount
 */

import React, { useState } from 'react';
import {
  Package,
  Truck,
  FileText,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  Printer,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  ExternalLink,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useShipmentOperations } from '../../hooks/useShipmentOperations';
import { useShipment } from '../../contexts/ShipmentContext';
import { useLogistics } from '../../contexts/LogisticsContext';
import LogisticsService from '../../services/logistics/LogisticsService';
import CourierSelector from './CourierSelector';
import PickupAddressSelector from './PickupAddressSelector';
import TrackingTimeline from './TrackingTimeline';

interface ShipmentCardProps {
  orderId: string;
  seller: any;  // Seller object from order
  customer: any;  // Customer object from order
  items: any[];  // Order items
  codAmount: number;  // Order total
  onShipmentCreated?: (shipmentId: string) => void;
}

export const ShipmentCard: React.FC<ShipmentCardProps> = ({
  orderId,
  seller,
  customer,
  items,
  codAmount,
  onShipmentCreated
}) => {
  const {
    currentShipment,
    shipmentLoading,
    shipmentError,
    selectedCourierCode,
    recommendedCourier,
    shippingEstimate,
    estimateLoading,
    selectCourier,
    showTrackingTimeline,
    setShowTrackingTimeline
  } = useShipment();

  const {
    handleCreateShipment,
    handleRequestPickup,
    handleGenerateLabel,
    handleCancelShipment,
    handleRefreshTracking,
    isCreatingShipment,
    isRequestingPickup,
    isGeneratingLabel,
    isCancelling
  } = useShipmentOperations();

  const [expandedSection, setExpandedSection] = useState<'details' | 'tracking' | null>('details');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer changed mind / Cancelled order');

  const { activeCouriers } = useLogistics();

  // ─ Handlers ──────────────────────────────────────────

  const handleCreateClick = async () => {
    if (!selectedCourierCode) {
      toast.error('Please select a courier');
      return;
    }

    try {
      await handleCreateShipment(selectedCourierCode);
      onShipmentCreated?.(currentShipment?.id || '');
      toast.success('Shipment created and scheduled!');
      setExpandedSection('tracking');
    } catch (error) {
      // Handled in hook
    }
  };

  const handleCancelClick = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancel reason');
      return;
    }
    try {
      await handleCancelShipment(cancelReason);
      setShowCancelConfirm(false);
    } catch (err) {
      // Handled in hook
    }
  };

  // ─ Render ─────────────────────────────────────────────

  if (shipmentLoading && !currentShipment) {
    return (
      <div className="bg-app-card border border-app-border rounded-[2rem] p-8 animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-slate-800 rounded-full"></div>
          <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-800 rounded"></div>
          <div className="h-4 bg-slate-800 rounded w-5/6"></div>
          <div className="h-4 bg-slate-800 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  // Get status color / badge style
  const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('delivered')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (s.includes('cancelled')) return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    if (s.includes('transit')) return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
    return 'bg-[#F4631E]/10 text-[#F4631E] border border-[#F4631E]/20';
  };

  return (
    <div className="bg-app-card border border-app-border rounded-[2rem] overflow-hidden shadow-2xl text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-950 to-slate-900 px-8 py-5 flex items-center justify-between border-b border-app-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F4631E]/15 rounded-xl border border-[#F4631E]/20">
            <Truck size={20} className="text-[#F4631E]" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Logistics &amp; Shipment Management</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Automated Courier Integrations</p>
          </div>
        </div>
        {currentShipment && (
          <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full ${getStatusBadgeStyle(currentShipment.status)}`}>
            {currentShipment.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-8 space-y-6">
        {/* Error message */}
        {shipmentError && (
          <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-rose-300 font-medium">
              {shipmentError.message || 'Error communicating with logistics servers.'}
            </div>
          </div>
        )}

        {/* Dispatch/Details Section */}
        <div className="border border-app-border rounded-2xl overflow-hidden bg-slate-950/10">
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'details' ? null : 'details')}
            className="w-full px-5 py-4 bg-white/5 hover:bg-white/10 flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Package size={18} className="text-[#F4631E]" />
              <span className="font-extrabold text-xs uppercase tracking-wider">
                {currentShipment ? 'Shipment Record & Actions' : 'Configure New Consignment'}
              </span>
            </div>
            {expandedSection === 'details' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>

          <AnimatePresence initial={false}>
            {expandedSection === 'details' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-app-border/40"
              >
                <div className="p-5 space-y-5 bg-slate-900/40">
                  {currentShipment ? (
                    // SHOW ACTIVE SHIPMENT INFO
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-950/40 p-4 border border-app-border/40 rounded-xl">
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Courier Provider
                          </div>
                          <div className="text-xs font-black text-white flex items-center gap-2">
                            <span>{currentShipment.courier.name}</span>
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-app-border">
                              API Active
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-950/40 p-4 border border-app-border/40 rounded-xl">
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Tracking Code
                          </div>
                          <div className="text-xs font-black text-emerald-400 font-mono tracking-wider flex items-center gap-2">
                            <span>{currentShipment.trackingNumber}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(currentShipment.trackingNumber);
                                toast.success('Tracking code copied!');
                              }}
                              className="text-[9px] text-slate-500 hover:text-white underline font-sans cursor-pointer font-bold"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-slate-950/30 p-3 border border-app-border/20 rounded-xl text-center">
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Weight</div>
                          <div className="text-xs font-bold text-white mt-0.5">{currentShipment.weight} kg</div>
                        </div>
                        <div className="bg-slate-950/30 p-3 border border-app-border/20 rounded-xl text-center">
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Delivery Charge</div>
                          <div className="text-xs font-bold text-white mt-0.5">৳ {currentShipment.deliveryCharge}</div>
                        </div>
                        <div className="bg-slate-950/30 p-3 border border-app-border/20 rounded-xl text-center col-span-2 md:col-span-1">
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Total Charges</div>
                          <div className="text-xs font-bold text-emerald-400 mt-0.5">৳ {currentShipment.totalCharge}</div>
                        </div>
                      </div>

                      {currentShipment.estimatedDeliveryAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-300 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                          <Calendar size={14} className="text-emerald-500" />
                          <span>Estimated Delivery: <strong>{new Date(currentShipment.estimatedDeliveryAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                        </div>
                      )}

                      {/* Operations buttons */}
                      <div className="pt-4 border-t border-app-border/40 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <button
                          type="button"
                          onClick={handleRefreshTracking}
                          className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-app-border"
                        >
                          <RefreshCw size={12} />
                          Sync Tracking
                        </button>

                        <button
                          type="button"
                          onClick={handleRequestPickup}
                          disabled={isRequestingPickup || currentShipment.status === 'picked_up' || currentShipment.status === 'cancelled'}
                          className="px-3 py-2.5 bg-[#F4631E]/20 hover:bg-[#F4631E]/30 text-[#F4631E] rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#F4631E]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Truck size={12} />
                          {isRequestingPickup ? 'Requesting...' : 'Request Pickup'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGenerateLabel('pdf')}
                          disabled={isGeneratingLabel || currentShipment.status === 'cancelled'}
                          className="px-3 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Printer size={12} />
                          {isGeneratingLabel ? 'Downloading...' : 'Print Label (PDF)'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(true)}
                          disabled={isCancelling || currentShipment.status === 'cancelled' || currentShipment.status === 'delivered'}
                          className="px-3 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                          Cancel Shipment
                        </button>
                      </div>

                      {/* Cancel confirmation modal overlay */}
                      {showCancelConfirm && (
                        <div className="bg-slate-950/80 p-5 rounded-2xl border border-rose-500/25 space-y-3 animate-in fade-in duration-200">
                          <h4 className="text-xs font-black uppercase text-rose-400 tracking-wider flex items-center gap-2">
                            ⚠️ Confirm Cancel Consignment
                          </h4>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                            This will send a cancellation request to the courier API and release this invoice tracking number. This action cannot be undone.
                          </p>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Cancellation Reason</label>
                            <input
                              type="text"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-950 border border-app-border rounded-xl text-xs text-white"
                              placeholder="Enter reason..."
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowCancelConfirm(false)}
                              className="px-3.5 py-1.5 bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                            >
                              Go Back
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelClick}
                              className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                            >
                              Confirm Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // NO SHIPMENT - SHOW DISPATCH FORM
                    <div className="space-y-4">
                      {/* Courier selector */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Choose Courier Provider
                          </label>
                          {recommendedCourier && (
                            <span className="text-[9px] font-black text-[#F4631E] bg-[#F4631E]/10 border border-[#F4631E]/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                              ★ Rule match: {recommendedCourier.name} Suggested
                            </span>
                          )}
                        </div>
                        <CourierSelector
                          couriers={activeCouriers}
                          selectedCode={selectedCourierCode}
                          onSelect={selectCourier}
                        />
                      </div>

                      {/* Pickup Address Selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Pickup Dispatch Address
                        </label>
                        <PickupAddressSelector seller={seller} />
                      </div>

                      {/* Live Estimate Block */}
                      {selectedCourierCode && (
                        <div className="bg-slate-950/40 border border-app-border/60 rounded-xl p-4 space-y-3">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                            Real-Time Charges Estimate
                          </span>
                          {estimateLoading ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                              <RefreshCw size={12} className="animate-spin text-[#F4631E]" />
                              <span>Querying courier rate tables...</span>
                            </div>
                          ) : shippingEstimate ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Base Delivery</span>
                                <span className="text-xs font-black text-white">৳ {shippingEstimate.deliveryCharge}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 block uppercase">COD Collection Fee</span>
                                <span className="text-xs font-black text-white">৳ {shippingEstimate.codFee}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Total Invoice Charges</span>
                                <span className="text-xs font-black text-[#F4631E]">৳ {shippingEstimate.totalCharge}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Transit Speed</span>
                                <span className="text-xs font-black text-emerald-400">{shippingEstimate.estimatedDays} Day(s)</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 font-medium">Estimate unavailable for this district.</div>
                          )}
                        </div>
                      )}

                      {/* Parcel Summary banner */}
                      <div className="bg-white/5 border border-app-border/40 rounded-xl px-5 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                          <Package size={14} className="text-[#F4631E]" />
                          <span>Parcel Summary: <strong>{items?.length || 1} item(s)</strong> • <strong>৳ {codAmount} BDT Cash On Delivery (COD)</strong></span>
                        </div>
                      </div>

                      {/* Submit action button */}
                      <button
                        type="button"
                        onClick={handleCreateClick}
                        disabled={!selectedCourierCode || isCreatingShipment}
                        className="w-full py-4.5 bg-[#F4631E] hover:bg-[#F4631E]/90 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-[#F4631E]/10 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <Plus size={16} />
                        {isCreatingShipment ? 'Registering Consignment on Courier servers...' : 'Register and Dispatch Consignment'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Tracking / History Logs Section */}
        {currentShipment && (
          <div className="border border-app-border rounded-2xl overflow-hidden bg-slate-950/10">
            <button
              type="button"
              onClick={() => setShowTrackingTimeline(!showTrackingTimeline)}
              className="w-full px-5 py-4 bg-white/5 hover:bg-white/10 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <RefreshCw size={18} className="text-emerald-400" />
                <span className="font-extrabold text-xs uppercase tracking-wider">
                  Live Consignment Timeline Logs
                </span>
              </div>
              {showTrackingTimeline ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            <AnimatePresence initial={false}>
              {showTrackingTimeline && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-app-border/40"
                >
                  <div className="p-6 bg-slate-900/40">
                    <TrackingTimeline events={currentShipment.trackingEvents} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentCard;
