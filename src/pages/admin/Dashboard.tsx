import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Building2, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp,
  Activity,
  ChartLine,
  Search,
  Calendar,
  Filter,
  MousePointer2,
  Globe,
  Smartphone,
  MapPin,
  ChevronRight,
  Plus
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

const trafficData = [
  { name: 'Mon', consumers: 4200, revenue: 1400 },
  { name: 'Tue', consumers: 3800, revenue: 1800 },
  { name: 'Wed', consumers: 5100, revenue: 2400 },
  { name: 'Thu', consumers: 4800, revenue: 2100 },
  { name: 'Fri', consumers: 6200, revenue: 3200 },
  { name: 'Sat', consumers: 7400, revenue: 4800 },
  { name: 'Sun', consumers: 8100, revenue: 5200 },
];

const categoryData = [
  { name: 'Tech', value: 45, color: '#F4631E' },
  { name: 'Fashion', value: 25, color: '#0D1B2A' },
  { name: 'Home', value: 20, color: '#FBCFB8' },
  { name: 'Others', value: 10, color: '#white' },
];

const StatCard = ({ label, value, sub, trend, isUp }: any) => (
  <div className="bg-app-card border border-app-border rounded-2xl p-6 group hover:border-app-accent/50 transition-all shadow-xl relative overflow-hidden">
    <div className="absolute top-0 right-0 p-2 opacity-5">
      <TrendingUp className="w-12 h-12" />
    </div>
    <div className="text-[11px] text-app-text-secondary uppercase tracking-[0.15em] font-bold mb-3 opacity-60">{label}</div>
    <div className="text-3xl font-extrabold text-app-text-primary tracking-tight mb-2">{value}</div>
    <div className={`text-[11px] flex items-center gap-1.5 font-bold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
      {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {sub}
      <span className="text-app-text-secondary font-medium opacity-40 ml-1">vs last mo</span>
    </div>
  </div>
);

export default function Dashboard() {
  const [dateRange, setDateRange] = useState('Last 7 Days');

  return (
    <div className="space-y-8 pb-16">
      {/* Dashboard Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div>
            <h1 className="text-2xl font-bold text-app-text-primary tracking-tight">Executive Control Panel</h1>
            <p className="text-app-text-secondary text-sm">System-wide monitoring and strategic analytics</p>
         </div>
         <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-app-border">
               {['7D', '30D', '90D', '6M'].map(t => (
                 <button 
                  key={t}
                  onClick={() => setDateRange(t)}
                  className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${dateRange === t ? 'active-filter-item bg-app-accent text-white shadow-lg' : 'text-app-text-secondary hover:text-app-text-primary'}`}
                 >
                   {t}
                 </button>
               ))}
            </div>
            <button className="p-2.5 bg-slate-50 border border-app-border rounded-xl text-app-text-secondary hover:text-app-text-primary transition-all">
               <Calendar className="w-4 h-4" />
            </button>
            <button className="p-2.5 bg-app-card border border-app-border rounded-xl text-app-accent-light hover:bg-app-accent/10 transition-all font-bold text-xs flex items-center gap-2">
               <Plus className="w-4 h-4" /> New Report
            </button>
            <Link 
              to="/dashboard/content-studio/products/new"
              className="p-2.5 bg-app-accent hover:bg-app-accent-light text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-app-accent/20 transition-all active:scale-95"
            >
               <Package className="w-4 h-4" /> Add Product
            </Link>
         </div>
      </div>

      {/* Prime Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Active Consumers" value="142,890" sub="+12.4%" isUp={true} />
        <StatCard label="Seller Ecosystem" value="1,204" sub="+18.2%" isUp={true} />
        <StatCard label="Expert Creators" value="482" sub="+32.1%" isUp={true} />
        <StatCard label="Platform Revenue" value="৳ 4.2M" sub="+8.1%" isUp={true} />
      </div>

      <div className="bg-gradient-to-r from-app-bg to-app-accent p-10 rounded-[2.5rem] border border-app-accent/20 shadow-2xl relative overflow-hidden group my-8">
         <div className="relative z-10 max-w-3xl">
            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Platform Synchronizer</h2>
            <p className="text-white/70 text-sm leading-relaxed mb-8 font-medium">
               Real-time connection between Seller inventory, Creator recommendations, and Consumer behavioral search patterns. All data is unified across Choosify.bd public ecosystem.
            </p>
            <div className="flex gap-4">
               <div className="px-5 py-2.5 bg-app-accent rounded-xl text-[10px] font-bold uppercase tracking-widest text-white border border-app-accent-light/30 shadow-xl shadow-app-accent/30">Live Sync Active</div>
               <div className="px-5 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white">Database Unified</div>
            </div>
         </div>
         <Activity className="absolute -bottom-10 -right-10 w-64 h-64 text-app-accent/20 group-hover:scale-110 transition-transform duration-[2s]" />
      </div>

      {/* Growth & Traffic Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         <div className="xl:col-span-2 bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="text-lg font-bold text-app-text-primary tracking-tight">Growth Velocity</h3>
                  <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">Consumer Traffic vs Sales Distribution</p>
               </div>
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-app-accent shadow-[0_0_8px_rgba(235,69,1,0.5)]" />
                     <span className="text-[10px] text-app-text-secondary font-bold uppercase">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                     <span className="text-[10px] text-app-text-secondary font-bold uppercase">Consumers</span>
                  </div>
               </div>
            </div>
            
            <div className="flex-1 min-h-[320px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficData}>
                     <defs>
                        <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#EB4501" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#EB4501" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                     <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10}
                     />
                     <YAxis 
                        stroke="#888888" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => `৳${v/1000}k`}
                     />
                     <Tooltip 
                        contentStyle={{ 
                           backgroundColor: 'var(--color-app-card)', 
                           border: '1px solid var(--color-app-border)', 
                           borderRadius: '12px', 
                           boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                           color: 'var(--color-app-text-primary)'
                        }}
                        itemStyle={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-app-text-primary)' }}
                     />
                     <Area type="monotone" dataKey="consumers" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCons)" />
                     <Area type="monotone" dataKey="revenue" stroke="#EB4501" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <h3 className="text-sm font-bold text-app-text-primary mb-6 uppercase tracking-wider">Pending Approvals</h3>
               <div className="space-y-4">
                  {[
                    { id: '1', name: 'Aarong Handcrafts', type: 'Seller', date: '1h ago' },
                    { id: '2', name: 'Samiul Islam', type: 'Creator', date: '3h ago' },
                    { id: '3', name: 'Premium Leather BD', type: 'Seller', date: '5h ago' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-app-bg border border-app-border rounded-xl">
                       <div>
                          <div className="text-[11px] font-bold text-app-text-primary">{item.name}</div>
                          <div className="text-[9px] text-app-text-secondary">{item.type} • {item.date}</div>
                       </div>
                       <button className="px-3 py-1 bg-app-accent hover:bg-app-accent-light text-white rounded-lg text-[9px] font-bold transition-all">Review</button>
                    </div>
                  ))}
               </div>
            </div>
            
            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <h3 className="text-sm font-bold text-app-text-primary mb-6 uppercase tracking-wider">Market Share</h3>
               <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={categoryData}
                           cx="50%"
                           cy="50%"
                           innerRadius={50}
                           outerRadius={70}
                           paddingAngle={5}
                           dataKey="value"
                        >
                           {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }} />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>
      </div>

      {/* Advanced Market Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-app-card border border-app-border rounded-[2rem] overflow-hidden">
            <div className="p-6 px-8 border-b border-app-border flex justify-between items-center bg-slate-50">
               <h4 className="text-sm font-bold text-app-text-primary flex items-center gap-2">
                  <ChartLine className="w-4 h-4 text-app-accent" />
                  Top Search Keywords
               </h4>
               <button className="text-[10px] text-app-accent font-bold uppercase tracking-widest">Global Trends</button>
            </div>
            <div className="p-8">
               <div className="space-y-6">
                  {[
                    { tag: 'iPhone 16 Pro Max', vol: '142.1k searches', trend: '+142%', isUp: true },
                    { tag: 'Mechanical Keyboard BD', vol: '82.4k searches', trend: '+12%', isUp: true },
                    { tag: 'Best Laptop Dhanmondi', vol: '41.8k searches', trend: '-2%', isUp: false },
                    { tag: 'Affordable Skincare', vol: '12.4k searches', trend: '+82%', isUp: true },
                    { tag: 'Sony PS5 Slim deals', vol: '8.2k searches', trend: '+152%', isUp: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                          <span className="w-6 text-[10px] font-bold text-app-text-secondary opacity-40">0{i+1}</span>
                          <div className="font-bold text-app-text-primary group-hover:text-app-accent transition-colors cursor-pointer">{item.tag}</div>
                       </div>
                       <div className="text-right">
                          <div className="text-[11px] font-bold text-app-text-primary">{item.vol}</div>
                          <div className={`text-[9px] font-bold flex items-center justify-end gap-1 ${item.isUp ? 'text-green-500' : 'text-red-500'}`}>
                             {item.trend} {item.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="bg-app-card border border-app-border rounded-[2rem] overflow-hidden">
            <div className="p-6 px-8 border-b border-app-border flex justify-between items-center bg-slate-50">
               <h4 className="text-sm font-bold text-app-text-primary flex items-center gap-3">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Segmentation Analytics
               </h4>
               <div className="flex gap-2">
                  <span className="bg-slate-100 border border-app-border px-3 py-1 rounded-lg text-[9px] font-bold text-app-text-secondary uppercase tracking-widest">City View</span>
               </div>
            </div>
            <div className="p-8">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <h5 className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-60">Top Cities (Volume)</h5>
                     {[
                       { city: 'Dhaka', val: 64, color: 'bg-app-accent' },
                       { city: 'Chattogram', val: 18, color: 'bg-blue-500' },
                       { city: 'Sylhet', val: 12, color: 'bg-green-500' },
                       { city: 'Rajshahi', val: 6, color: 'bg-purple-500' },
                     ].map(c => (
                       <div key={c.city} className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold">
                             <span className="text-app-text-primary">{c.city}</span>
                             <span className="text-app-text-secondary">{c.val}%</span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                             <div className={`h-full ${c.color}`} style={{ width: `${c.val}%` }} />
                          </div>
                       </div>
                     ))}
                  </div>
                  <div className="space-y-6">
                     <h5 className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-60">Device Analytics</h5>
                     {[
                       { d: 'Mobile Safari', val: 48, icon: Smartphone },
                       { d: 'Chrome Desktop', val: 32, icon: Globe },
                       { d: 'Mobile Chrome', val: 15, icon: Smartphone },
                       { d: 'Others', val: 5, icon: Activity },
                     ].map(d => (
                       <div key={d.d} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:border hover:border-app-accent/20 transition-all border border-transparent">
                          <div className="flex items-center gap-3">
                             <d.icon className="w-4 h-4 text-app-text-secondary" />
                             <span className="text-[11px] font-bold text-app-text-primary">{d.d}</span>
                          </div>
                          <span className="text-[11px] font-bold text-app-accent">{d.val}%</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
