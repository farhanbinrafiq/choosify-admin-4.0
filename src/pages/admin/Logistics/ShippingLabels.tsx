import React, { useState, useEffect } from 'react';
import { LogisticsService } from '../../../services/logistics/LogisticsService';
import { Shipment } from '../../../types/shipment';
import { 
  FileText, 
  Search, 
  Download, 
  CheckSquare, 
  Square, 
  Printer, 
  RefreshCw, 
  CheckCircle,
  Truck,
  FileDown
} from 'lucide-react';
import { motion } from 'motion/react';

export default function ShippingLabels() {
  const logisticsService = LogisticsService.getInstance();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [batchActionRunning, setBatchActionRunning] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await logisticsService.getShipments();
        // Filter to show active/non-cancelled shipments
        setShipments(data.filter(s => s.status !== 'cancelled'));
      } catch (err) {
        console.error('Failed to load shipments for labels:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleDownloadLabel = async (shipmentId: string, format: 'pdf' | 'thermal') => {
    setDownloadingId(`${shipmentId}-${format}`);
    try {
      const blob = await logisticsService.generateLabel(shipmentId, format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Label-${shipmentId}.${format === 'pdf' ? 'pdf' : 'txt'}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Failed to generate label:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredShipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredShipments.map(s => s.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDownload = async (format: 'pdf' | 'thermal') => {
    if (selectedIds.length === 0) return;
    setBatchActionRunning(true);
    
    try {
      // Print or download each label in sequence
      for (const id of selectedIds) {
        const blob = await logisticsService.generateLabel(id, format);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Label-Batch-${id}.${format === 'pdf' ? 'pdf' : 'txt'}`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        // Add a slight delay to allow multiple browser downloads
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.error('Batch download failed:', err);
    } finally {
      setBatchActionRunning(false);
    }
  };

  const filteredShipments = shipments.filter(s => 
    s.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customerContact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.sellerContact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <Printer className="h-6 w-6 text-indigo-600" />
            Shipping Waybills & Labels
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and export parcel routing slips, bulk-print waybill barcodes, and download courier labels.
          </p>
        </div>

        {/* Batch Actions */}
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 shadow-sm"
          >
            <span className="text-xs font-semibold text-indigo-800">
              {selectedIds.length} Selected
            </span>
            <div className="h-4 w-px bg-indigo-200 mx-1" />
            <button
              onClick={() => handleBatchDownload('pdf')}
              disabled={batchActionRunning}
              className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              Batch PDF
            </button>
            <button
              onClick={() => handleBatchDownload('thermal')}
              disabled={batchActionRunning}
              className="text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Batch Thermal
            </button>
          </motion.div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Search */}
        <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 w-full sm:max-w-md shadow-inner">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search by waybill, customer name, order ref..."
            className="w-full text-sm outline-none text-gray-700 bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Selector Helpers */}
        <button
          onClick={() => {
            setSelectedIds([]);
            logisticsService.getShipments().then(data => setShipments(data.filter(s => s.status !== 'cancelled')));
          }}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1.5 self-end sm:self-auto"
        >
          <RefreshCw className="h-3 w-3" />
          Reset Selection & Reload
        </button>
      </div>

      {/* Grid or List of Slips */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-20 bg-gray-100 rounded-xl border border-gray-200" />
          ))}
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">No waybill records found.</p>
          <p className="text-sm text-gray-400 mt-1">Check that shipments are generated and active.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 items-center">
            <div className="col-span-1 flex items-center">
              <button onClick={handleToggleSelectAll} className="text-gray-400 hover:text-indigo-600 transition-colors">
                {selectedIds.length === filteredShipments.length ? (
                  <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                ) : (
                  <Square className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
            <div className="col-span-2">Carrier & ID</div>
            <div className="col-span-2">Order Refer</div>
            <div className="col-span-2">Brand / Shipper</div>
            <div className="col-span-3">Consignee Recipient</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-gray-100">
            {filteredShipments.map((s) => {
              const isSelected = selectedIds.includes(s.id);

              return (
                <div 
                  key={s.id} 
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center text-sm hover:bg-gray-50/50 transition-colors ${
                    isSelected ? 'bg-indigo-50/20' : ''
                  }`}
                >
                  {/* Select */}
                  <div className="col-span-1">
                    <button 
                      onClick={() => handleToggleSelect(s.id)} 
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                      ) : (
                        <Square className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>

                  {/* Carrier & ID */}
                  <div className="col-span-2 space-y-0.5">
                    <p className="font-semibold text-gray-900 font-mono text-xs">{s.trackingNumber}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-indigo-700 font-bold uppercase font-mono">
                      {s.courier.name}
                    </span>
                  </div>

                  {/* Order */}
                  <div className="col-span-2 font-semibold text-gray-800 font-mono text-xs">
                    {s.orderId}
                  </div>

                  {/* Brand */}
                  <div className="col-span-2 text-xs font-semibold text-indigo-700">
                    {s.sellerContact.name}
                  </div>

                  {/* Recipient */}
                  <div className="col-span-3 space-y-0.5">
                    <p className="font-semibold text-gray-900">{s.customerContact.name}</p>
                    <p className="text-xs text-gray-500 font-medium">{s.deliveryAddress.city}, {s.deliveryAddress.district}</p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => handleDownloadLabel(s.id, 'pdf')}
                      disabled={downloadingId !== null}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      PDF
                    </button>

                    <button
                      onClick={() => handleDownloadLabel(s.id, 'thermal')}
                      disabled={downloadingId !== null}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Printer className="h-3 w-3 text-gray-400" />
                      Thermal
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
