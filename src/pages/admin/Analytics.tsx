import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Smartphone, 
  Monitor, 
  Globe, 
  MapPin, 
  DollarSign, 
  ShoppingBag, 
  Percent, 
  Layers, 
  Database 
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';

const data = [
  { name: 'Sun', users: 4000, sessions: 2400, sales: 120000, commission: 14000 },
  { name: 'Mon', users: 3000, sessions: 1398, sales: 98000, commission: 11000 },
  { name: 'Tue', users: 2000, sessions: 9800, sales: 154000, commission: 18500 },
  { name: 'Wed', users: 2780, sessions: 3908, sales: 112000, commission: 13200 },
  { name: 'Thu', users: 1890, sessions: 4800, sales: 87000, commission: 10400 },
  { name: 'Fri', users: 2390, sessions: 3800, sales: 135000, commission: 16200 },
  { name: 'Sat', users: 3490, sessions: 4300, sales: 198000, commission: 23800 },
];

export default function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'realtime';

  const updateTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 text-white pb-16 animate-fade-in animate-duration-300">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-app-border pb-6">
        <div>
          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded font-black tracking-widest uppercase block w-fit mb-1">
            ANALYTICS & INTEL
          </span>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <BarChart3 className="text-indigo-400" /> Platform General Analytics
          </h2>
          <p className="text-xs text-app-text-secondary mt-1">
            Consolidate real-time users, SLA fulfillments, product conversions, and commission earnings splits.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg">
          TELEMETRY INDEX: ACTIVE
        </div>
      </div>

      {/* Grid Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Weekly Gross Sales', value: '৳ 904,000', change: '+18.5% Week over Week', icon: DollarSign, color: 'text-indigo-400' },
          { label: 'Commission Splits Recieved', value: '৳ 106,900', change: '12% raw platform fee', icon: Percent, color: 'text-emerald-400' },
          { label: 'Realtime Active Connections', value: '1,402 Active', change: 'Purged 10s ago', icon: Activity, color: 'text-yellow-400' },
          { label: 'Gross Margins Rate', value: '88%', change: 'Self-hosted ad-splits', icon: Database, color: 'text-pink-400' }
        ].map((node, i) => (
          <div key={i} className="bg-app-card border border-app-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{node.label}</p>
              <div className="text-xl font-black text-white">{node.value}</div>
              <p className="text-[9px] text-[#A2A9B2] mt-1 font-mono">{node.change}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-app-bg border border-app-border flex items-center justify-center ${node.color}`}>
              <node.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Sub tabs mapping */}
      <div className="flex border-b border-app-border gap-6 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'realtime', label: 'Realtime Analytics' },
          { id: 'sales', label: 'Sales Report' },
          { id: 'trends', label: 'Order Trends' },
          { id: 'commission', label: 'Commission Earnings' },
          { id: 'merchant', label: 'Merchant SLA Performance' },
          { id: 'product', label: 'Product Conversions' },
          { id: 'geo', label: 'Geographic Traffic Map' },
          { id: 'arbitrage', label: 'Arbitrage Analytics' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => updateTab(tab.id)}
            className={`pb-4 px-1 text-xs font-bold tracking-tight shrink-0 relative transition-all whitespace-nowrap cursor-pointer ${
              currentTab === tab.id 
                ? 'text-indigo-400 font-extrabold' 
                : 'text-app-text-secondary hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            {currentTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
            )}
          </button>
        ))}
      </div>

      {/* Main split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left chart card */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-app-card border border-app-border rounded-2xl p-5 space-y-6">
            <div className="flex justify-between items-center border-b border-app-border pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">CHART_TELEMETRY: {currentTab.toUpperCase()}</span>
                <span className="text-xs text-app-text-secondary">Historical and programmatic distribution metrics logs.</span>
              </div>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
                  <XAxis dataKey="name" stroke="#A2A9B2" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="#A2A9B2" fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey={currentTab === 'commission' ? 'commission' : currentTab === 'sales' ? 'sales' : 'users'} 
                    name={currentTab === 'commission' ? 'Commission (৳)' : currentTab === 'sales' ? 'Sales (৳)' : 'Users'} 
                    stroke="#6366F1" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#indigoGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* If GEO is selected, show location logs */}
          {currentTab === 'geo' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Geographic Traffic Ratios</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { region: 'Dhaka Division (Capital)', percentage: '68%', speed: 'Low Latency CDN Node 01' },
                  { region: 'Chittagong Port Cities', percentage: '18%', speed: 'CDN Node 02' },
                  { region: 'Sylhet Tea Resorts Area', percentage: '8%', speed: 'CDN Backup Node' },
                  { region: 'Rajshahi Fruit belt', percentage: '6%', speed: 'CDN Backup Node' }
                ].map((r, i) => (
                  <div key={i} className="p-4 bg-app-bg rounded-lg border border-white/[0.02] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">{r.region}</span>
                      <span className="text-[10px] text-slate-500">{r.speed}</span>
                    </div>
                    <span className="text-base font-black text-indigo-400">{r.percentage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right side diagnostics deck */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-app-card border border-app-border rounded-2xl p-5 space-y-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Device Breakdown ratios</span>
            
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Smartphone, label: 'Mobile App', val: '74%' },
                { icon: Monitor, label: 'Desktop web', val: '22%' },
                { icon: Globe, label: 'Tablets / API', val: '4%' },
              ].map(d => (
                <div key={d.label} className="bg-app-bg p-3 rounded-lg border border-white/[0.01] flex flex-col items-center">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 mb-1">
                    <d.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] font-bold text-white">{d.val}</span>
                  <span className="text-[8px] text-slate-400 mt-0.5 tracking-wider uppercase font-black">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-app-card border border-app-border rounded-2xl p-5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Fulfillment Integrity SLA</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Platform is currently maintaining more than 96.5% overall fulfillment delivery within Bangladesh standard SLA boundaries.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
