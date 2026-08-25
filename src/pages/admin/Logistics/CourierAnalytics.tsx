import React, { useState, useEffect } from 'react';
import { operationsApi, type OpsShipment } from '../../../services/operationsApi';
import {
  BarChart3,
  TrendingUp,
  Percent,
  ShieldAlert,
  Truck,
  DollarSign,
  Compass,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { StatTile } from '../../../components/ui/StatTile';

interface CarrierStat {
  code: string;
  name: string;
  volume: number;
  successRate: number;
  avgDays: number | null;
  avgCost: number;
  logo?: string;
}

const COURIER_DISPLAY: Record<string, { name: string; logo?: string }> = {
  steadfast: { name: 'Steadfast', logo: 'https://steadfast.com.bd/assets/logo.png' },
  pathao: { name: 'Pathao', logo: 'https://pathao.com/wp-content/uploads/2018/12/Pathao_logo_red.png' },
  redx: { name: 'REDX', logo: 'https://redx.com.bd/assets/images/redx-logo.svg' },
  paperfly: { name: 'Paperfly' },
  ecourier: { name: 'eCourier' },
  sundarban: { name: 'Sundarban' },
};

/**
 * Sprint 11 remediation: this screen previously derived every metric from
 * LogisticsService's fabricated in-browser shipment list (Firestore/
 * localStorage fallback), and even faked "average delivery days" with
 * Math.random() when a shipment had no estimatedDeliveryAt field — a field
 * the real backend doesn't track at all. It now aggregates real shipment
 * records from GET /operations/shipments. Average delivery time is derived
 * honestly from each shipment's real webhook-driven tracking history
 * (createdAt -> the timestamp of its most recent "delivered" checkpoint);
 * where that can't be computed for a given carrier, it shows "—" instead of
 * a placeholder number.
 */
export default function CourierAnalytics() {
  const [shipments, setShipments] = useState<OpsShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await operationsApi.listShipments();
      setShipments(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load shipment data for analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute metrics
  const totalShipments = shipments.length;
  const delivered = shipments.filter(s => s.status === 'delivered');
  const lost = shipments.filter(s => s.status === 'failed_delivery' || s.status === 'returned');
  const successRate = totalShipments > 0 ? (delivered.length / totalShipments) * 100 : 0;
  const lossRate = totalShipments > 0 ? (lost.length / totalShipments) * 100 : 0;

  const totalCost = shipments.reduce((sum, s) => sum + (s.deliveryCharge || 0), 0);
  const avgCost = totalShipments > 0 ? totalCost / totalShipments : 0;

  // Aggregate stats per carrier — built dynamically from whatever courier
  // codes actually appear in real shipment data, not a fixed fabricated list.
  const byCourier = new Map<string, OpsShipment[]>();
  shipments.forEach((s) => {
    const code = s.courier || 'unknown';
    if (!byCourier.has(code)) byCourier.set(code, []);
    byCourier.get(code)!.push(s);
  });

  const aggregateCarrierStats: CarrierStat[] = Array.from(byCourier.entries())
    .map(([code, rows]) => {
      const volume = rows.length;
      const deliveredRows = rows.filter((r) => r.status === 'delivered');
      const successRateForCourier = volume > 0 ? (deliveredRows.length / volume) * 100 : 0;
      const costForCourier = rows.reduce((sum, r) => sum + (r.deliveryCharge || 0), 0);
      const avgCostForCourier = volume > 0 ? costForCourier / volume : 0;

      // Real delivery duration: createdAt -> the most recent "delivered" checkpoint
      // timestamp (webhook updates prepend the newest event, so index 0 on a
      // currently-delivered shipment is that checkpoint).
      const deliveryDurations = deliveredRows
        .map((r) => {
          const deliveredEvent = r.trackingEvents.find((evt) => evt.status === 'delivered') || r.trackingEvents[0];
          if (!deliveredEvent) return null;
          const days = (new Date(deliveredEvent.timestamp).getTime() - new Date(r.createdAt).getTime()) / 86400000;
          return Number.isFinite(days) && days >= 0 ? days : null;
        })
        .filter((d): d is number => d !== null);
      const avgDays = deliveryDurations.length > 0
        ? deliveryDurations.reduce((a, b) => a + b, 0) / deliveryDurations.length
        : null;

      return {
        code,
        name: COURIER_DISPLAY[code]?.name || code,
        volume,
        successRate: successRateForCourier,
        avgDays,
        avgCost: avgCostForCourier,
        logo: COURIER_DISPLAY[code]?.logo,
      };
    })
    .sort((a, b) => b.volume - a.volume);

  // District distribution (real `region` field)
  const districtVolume: Record<string, number> = {};
  shipments.forEach(s => {
    const dist = s.region || 'Other';
    districtVolume[dist] = (districtVolume[dist] || 0) + 1;
  });
  const totalDistrictVolume = Object.values(districtVolume).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[17px] font-extrabold text-app-text-primary tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-app-accent" />
            Courier Analytics
          </h1>
          <p className="text-sm text-app-text-secondary mt-1">
            Real delivery performance derived from webhook-recorded shipment status and checkpoint history.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-app-border bg-white hover:bg-gray-50 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-900 text-sm">Failed to load analytics</h4>
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-24 bg-gray-100 rounded-xl border border-app-border" />
          ))}
        </div>
      ) : totalShipments === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-app-border p-12 text-center">
          <Truck className="h-10 w-10 text-app-text-secondary mx-auto mb-3" />
          <p className="text-app-text-primary font-medium">No shipments recorded yet.</p>
          <p className="text-sm text-app-text-secondary mt-1">Analytics will populate as real orders generate shipments.</p>
        </div>
      ) : (
        <>
          {/* Top Scorecard Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatTile label="Overall Volumetric Flow" value={`${totalShipments} Parcels`} icon={TrendingUp} accent="orange" />
            <StatTile label="Delivery Success Rate" value={`${successRate.toFixed(1)}%`} icon={Percent} accent="emerald" />
            <StatTile label="Carrier Loss / Return Rate" value={`${lossRate.toFixed(1)}%`} icon={ShieldAlert} accent="rose" />
            <StatTile label="Avg Consignment Charge" value={`BDT ${Math.round(avgCost)}`} icon={DollarSign} accent="indigo" />
          </div>

          {/* Core Analytics Visual Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Carrier comparison table / progress chart */}
            <div className="lg:col-span-8 bg-white p-6 rounded-card border border-app-border shadow-sm space-y-4">
              <h3 className="font-extrabold text-app-text-primary text-sm flex items-center gap-1.5 border-b border-app-border pb-3">
                <Truck className="h-4 w-4 text-app-accent" />
                Carrier Network Performance Indexes
              </h3>

              <div className="space-y-6">
                {aggregateCarrierStats.map((stat) => {
                  const widthSuccess = `${stat.successRate}%`;
                  const isHealthy = stat.successRate > 85;

                  return (
                    <div key={stat.code} className="space-y-2">
                      <div className="flex justify-between items-center text-sm flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {stat.logo && (
                            <img
                              src={stat.logo}
                              alt={stat.name}
                              referrerPolicy="no-referrer"
                              className="h-6 w-6 object-contain rounded bg-slate-50 p-0.5 border border-app-border"
                            />
                          )}
                          <span className="font-bold text-app-text-primary">{stat.name}</span>
                          <span className="text-xs text-app-text-muted font-mono">({stat.volume} parcels)</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono font-bold">
                          <span className="text-app-text-secondary">
                            Speed: {stat.avgDays !== null ? `${stat.avgDays.toFixed(1)}d` : '—'}
                          </span>
                          <span className="text-app-text-secondary">Rate: BDT {Math.round(stat.avgCost)}</span>
                          <span className={isHealthy ? 'text-app-success' : 'text-app-warning'}>
                            {stat.successRate.toFixed(1)}% Success
                          </span>
                        </div>
                      </div>

                      {/* Visual Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHealthy ? 'bg-app-accent' : 'bg-app-warning'
                          }`}
                          style={{ width: widthSuccess }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Geographical volume layout */}
            <div className="lg:col-span-4 bg-white p-6 rounded-card border border-app-border shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-app-text-primary text-sm flex items-center gap-1.5 border-b border-app-border pb-3">
                  <Compass className="h-4 w-4 text-app-accent" />
                  Delivery Regions
                </h3>

                <div className="space-y-4 mt-4">
                  {Object.entries(districtVolume)
                    .sort(([, a], [, b]) => b - a)
                    .map(([district, volume], i) => {
                      const pct = totalDistrictVolume > 0 ? (volume / totalDistrictVolume) * 100 : 0;

                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-app-text-primary">{district}</span>
                            <span className="font-mono font-bold text-app-text-secondary">{volume} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-app-accent rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
