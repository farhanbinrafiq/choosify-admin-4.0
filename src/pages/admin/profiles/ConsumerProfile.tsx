import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useContact } from '../../../contexts/ContactInteractionContext';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Star,
  ShoppingBag,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Truck,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  details: string;
  price: string;
  paymentMethod: string;
  status: 'Pending' | 'Completed' | 'Canceled';
  thumbnail: string;
}

interface OrderGroup {
  date: string;
  orderId: string;
  items: OrderItem[];
}

interface Activity {
  iconType: 'chat' | 'rating' | 'order' | 'warning';
  title: string;
  subtitle: string;
}

interface CustomerProfileData {
  id: string;
  name: string;
  status: 'Active' | 'Banned' | 'Inactive';
  avatarUrl: string;
  persona: string;
  email: string;
  address: string;
  phone: string;
  lastActive: string;
  totalSpent: string;
  totalOrders: number;
  completedOrders: number;
  recentActivities: Activity[];
  orders: OrderGroup[];
  wishlistCount: number;
  reviewsCount: number;
  supportTicketsCount: number;
  retentionScore: number;
  averageOrderValue: string;
}

export default function ConsumerProfile() {
  const { id } = useParams();
  const { triggerPhone, triggerMessage } = useContact();
  const [activeTab, setActiveTab] = useState<'All Orders' | 'Processing' | 'Shipped' | 'Canceled'>('All Orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Profiles mapping with enterprise-level fields & standard screenshot data as main default
  const profilesData: Record<string, CustomerProfileData> = {
    '2': {
      id: '2',
      name: 'Brooklyn Simmons',
      status: 'Active',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256',
      persona: 'High-Value Fashion Enthusiast',
      email: 'brooklynsim2@gmail.com',
      address: '4140 Parker Rd. Allentown, New Mexico 31134',
      phone: '+222 01 414 8447',
      lastActive: '12 December, 2023',
      totalSpent: '€42,400',
      totalOrders: 24,
      completedOrders: 20,
      wishlistCount: 14,
      reviewsCount: 8,
      supportTicketsCount: 1,
      retentionScore: 98,
      averageOrderValue: '€1,766',
      recentActivities: [
        { iconType: 'chat', title: 'Support Chat', subtitle: 'Friday, Sep 6, 2022 | 12:24am' },
        { iconType: 'rating', title: 'Given rating', subtitle: 'Friday, Sep 6, 2022 | 12:24am' },
        { iconType: 'order', title: 'New Order', subtitle: 'Friday, Sep 6, 2022 | 12:24am' }
      ],
      orders: [
        {
          date: 'Date of Order 26 Jan, 2023',
          orderId: 'Order ID: 246522114',
          items: [
            {
              id: 'item-1',
              name: 'Nike Air Jordan Reflex',
              details: 'Color: Black Size: 23 Quantity: 2',
              price: '€26.35',
              paymentMethod: 'Credit card',
              status: 'Pending',
              thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        },
        {
          date: 'Date of Order 26 Jan, 2023',
          orderId: 'Order ID: 246522114',
          items: [
            {
              id: 'item-2',
              name: 'Nike Air Jordan Reflex',
              details: 'Color: Black Size: 23 Quantity: 2',
              price: '€26.35',
              paymentMethod: 'Credit card',
              status: 'Pending',
              thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        },
        {
          date: 'Date of Order 26 Jan, 2023',
          orderId: 'Order ID: 246522114',
          items: [
            {
              id: 'item-3',
              name: 'Nike Air Jordan Reflex',
              details: 'Color: Black Size: 23 Quantity: 2',
              price: '€26.35',
              paymentMethod: 'Credit card',
              status: 'Completed',
              thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    },
    '1': {
      id: '1',
      name: 'Rifat Hasan',
      status: 'Active',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
      persona: 'High-Value Fashion Enthusiast',
      email: 'rifat.h@choosify.com',
      address: '34, Orchard Road East, Dhanmondi, Dhaka 1209, Bangladesh',
      phone: '+880 1819-223344',
      lastActive: '10 May, 2026',
      totalSpent: '৳ 49,000',
      totalOrders: 28,
      completedOrders: 24,
      wishlistCount: 22,
      reviewsCount: 15,
      supportTicketsCount: 0,
      retentionScore: 99,
      averageOrderValue: '৳ 1,750',
      recentActivities: [
        { iconType: 'chat', title: 'Support Chat', subtitle: 'Friday, Sep 6, 2026 | 12:24am' },
        { iconType: 'rating', title: 'Given rating', subtitle: 'Friday, Sep 6, 2026 | 10:15am' },
        { iconType: 'order', title: 'New Order', subtitle: 'Thursday, Sep 5, 2026 | 09:30pm' }
      ],
      orders: [
        {
          date: 'Date of Order 10 May, 2026',
          orderId: 'Order ID: 246522114',
          items: [
            {
              id: 'item-rifat-1',
              name: 'Traditional Dhakai Jamdani Saree',
              details: 'Color: Sky Blue Size: Standard Quantity: 1',
              price: '৳ 32,500',
              paymentMethod: 'bKash Mobile',
              status: 'Pending',
              thumbnail: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        },
        {
          date: 'Date of Order 02 Apr, 2026',
          orderId: 'Order ID: 246521990',
          items: [
            {
              id: 'item-rifat-2',
              name: 'Luxury Pure Silk Panjabi',
              details: 'Color: Pearl White Size: XL Quantity: 1',
              price: '৳ 16,500',
              paymentMethod: 'Credit card',
              status: 'Completed',
              thumbnail: 'https://images.unsplash.com/photo-1597983073492-bc24159b4c03?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    },
    '3': {
      id: '3',
      name: 'Mehedi Rahman',
      status: 'Banned',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256&h=256',
      persona: 'Suspicious / Flagged Actor',
      email: 'mehedi.r@choosify.com',
      address: 'Apt B3, House 45, Road 11, Banani, Dhaka 1213, Bangladesh',
      phone: '+880 1712-456789',
      lastActive: '22 April, 2026',
      totalSpent: '৳ 47,400',
      totalOrders: 15,
      completedOrders: 0,
      wishlistCount: 2,
      reviewsCount: 1,
      supportTicketsCount: 6,
      retentionScore: 15,
      averageOrderValue: '৳ 3,160',
      recentActivities: [
        { iconType: 'warning', title: 'Refused Handover', subtitle: 'Friday, Sep 6, 2026 | 02:44pm' },
        { iconType: 'chat', title: 'Dispute Filed', subtitle: 'Thursday, Sep 5, 2026 | 11:24am' },
        { iconType: 'warning', title: 'Account Suspended', subtitle: 'Tuesday, Sep 3, 2026 | 09:12am' }
      ],
      orders: [
        {
          date: 'Date of Order 22 Apr, 2026',
          orderId: 'Order ID: 246520999',
          items: [
            {
              id: 'item-mehedi-1',
              name: 'Sony WH-1000XM5 Headphones',
              details: 'Color: Platinum Silver Size: Standard Quantity: 1',
              price: '৳ 42,000',
              paymentMethod: 'Cash on Delivery',
              status: 'Canceled',
              thumbnail: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    }
  };

  // Default to Brooklyn Simmons ('2')
  const profile = profilesData[id || ''] || profilesData['2'];

  const getFilteredGroups = () => {
    return profile.orders
      .map(group => {
        const filteredItems = group.items.filter(item => {
          let tabMatch = true;
          if (activeTab === 'Processing') tabMatch = item.status === 'Pending';
          else if (activeTab === 'Shipped') tabMatch = item.status === 'Completed'; 
          else if (activeTab === 'Canceled') tabMatch = item.status === 'Canceled';

          const s = searchQuery.toLowerCase();
          const searchMatch = !searchQuery || 
            item.name.toLowerCase().includes(s) || 
            group.orderId.toLowerCase().includes(s) || 
            item.status.toLowerCase().includes(s);

          return tabMatch && searchMatch;
        });

        return {
          ...group,
          items: filteredItems
        };
      })
      .filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'rating':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <Star className="w-4 h-4 text-app-accent-light" fill="currentColor" />
          </div>
        );
      case 'order':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <ShoppingBag className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'warning':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 text-app-text-primary font-sans transition-all animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card text-app-text-primary shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-xs font-bold font-mono text-white">{toast.message}</span>
        </div>
      )}

      {/* Header and Breadcrumb path */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <Link to="/admin/consumers" className="hover:text-app-accent transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <Link to="/admin/consumers" className="hover:text-app-accent transition-colors">Customer</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">
              {profile.name}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Customer Details</h1>
          <p className="text-app-text-secondary text-[12px]">Here is the overview of the customer legacy metrics & purchases</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Link 
            to="/admin/consumers"
            className="flex items-center gap-2 px-3.5 py-2 border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary bg-app-card hover:border-app-accent hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-app-accent" />
            <span>All Customers</span>
          </Link>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Customer 360 profile card & recent activities */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Profile Card / Customer 360 Core */}
          <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl">
            
            {/* Top Banner gradient compatible with Choosify colors */}
            <div className="h-24 bg-gradient-to-r from-app-gradient-start via-app-card to-app-gradient-end opacity-90 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <span className="text-xl sm:text-2xl md:text-xl lg:text-xl xl:text-2xl font-black text-white uppercase tracking-[0.2em] select-none text-center max-w-full truncate">CONSUMER</span>
              </div>
            </div>

            {/* Profile Avatar & Details Box */}
            <div className="px-5 pb-5 relative">
              
              <div className="-mt-10 mb-4 flex items-end justify-between">
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name}
                  className="w-20 h-20 rounded-full border-2 border-app-border object-cover bg-app-card shrink-0" 
                />

                {/* Styled action triggers */}
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => triggerPhone({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Consumer' })}
                    className="p-2 rounded-[4px] border border-app-border text-app-accent hover:border-app-accent hover:bg-app-accent/5 transition-all bg-app-card cursor-pointer"
                    title="Call Customer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => triggerMessage({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Consumer' })}
                    className="p-2 rounded-[4px] bg-app-accent text-white hover:bg-app-accent-light transition-all shadow-sm cursor-pointer"
                    title="Message Customer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Identity Row */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold tracking-tight text-white">{profile.name}</h2>
                  <span className={`px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border ${
                    profile.status === 'Active' 
                      ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    {profile.status}
                  </span>
                </div>
                <p className="text-[9px] font-bold tracking-wider text-app-text-secondary uppercase bg-white/5 px-2 py-1 rounded-[2px] inline-block">
                  {profile.persona}
                </p>
              </div>

              {/* Customer 360 Information Fields */}
              <div className="mt-5 space-y-3.5 pt-4 border-t border-white/[0.04]">
                
                <div>
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Email address
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block truncate">
                    {profile.email}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Address
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block leading-relaxed line-clamp-2" title={profile.address}>
                    {profile.address}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Phone number
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block font-mono">
                    {profile.phone}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Registration Date
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block font-mono flex items-center gap-1.5">
                    <Calendar className="w-3.0 h-3.0 text-slate-400" />
                    <span>May 10, 2021 | 14:32 BRT</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Last Transaction active
                  </label>
                  <span className="text-xs text-app-accent-light font-bold mt-0.5 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3" />
                    <span>{profile.lastActive}</span>
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* SECTION: Reputation Core */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center justify-between">
              <span>Reputation Intelligence</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-[2px] border border-emerald-500/20">Trust Validated</span>
            </h3>

            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Behavior Level</div>
                <div className="text-xs font-bold text-green-400 mt-1">Excellent (Compliant)</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Consumer Score</div>
                <div className="text-xs font-bold text-white mt-1 font-mono">98 / 100</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Incident Count</div>
                <div className="text-xs font-bold text-white mt-1 font-mono">0 Incidents</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Trust Rating</div>
                <div className="text-xs font-bold text-app-accent-light mt-1 font-mono">A+ Tier Level</div>
              </div>
            </div>
          </div>

          {/* SECTION: Activity Logs & IP Audit */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Activity & IP Audit Trail
            </h3>
            
            <div className="space-y-3 text-xs pt-1">
              <div className="flex justify-between border-b border-white/[0.02] pb-2">
                <span className="text-app-text-secondary text-[11px]">Last Session Seen</span>
                <span className="text-white font-mono font-semibold">Today, 2 hr ago</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.02] pb-2">
                <span className="text-app-text-secondary text-[11px]">Session Logs</span>
                <span className="text-white font-semibold">3 active logins (iOS / Chrome)</span>
              </div>
              <div>
                <span className="text-app-text-secondary text-[9px] font-bold uppercase tracking-wider block mb-1">IP Location History</span>
                <div className="space-y-1 font-mono text-[10.5px] text-slate-300">
                  <div className="flex justify-between">
                    <span>103.114.34.12</span>
                    <span className="text-[9px] text-slate-500">DHAKA, BD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>162.210.192.4</span>
                    <span className="text-[9px] text-slate-500">NEW MEXICO, US</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: Reviews & Content Quality */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Reviews & Content Quality Center
            </h3>

            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="bg-white/[0.02] p-2.5 rounded-[3px]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Total Reviews</div>
                <div className="text-xs font-bold text-white mt-1 font-mono">{profile.reviewsCount} Written</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Flagged Count</div>
                <div className="text-xs font-bold text-green-400 mt-1 font-mono">0 Flags</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Audit Result</div>
                <div className="text-xs font-bold text-white mt-1">Verified (Auth)</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Quality Score</div>
                <div className="text-xs font-bold text-app-accent-light mt-1 font-mono">9.5 / 10</div>
              </div>
            </div>
          </div>

          {/* SECTION: Support Tickets Center */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Support Incident Center
            </h3>

            <div className="space-y-3 text-xs pt-1">
              <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                <span className="text-app-text-secondary text-[11px]">Total Incident Tickets</span>
                <span className="text-white font-mono font-semibold">{profile.supportTicketsCount} active case</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                <span className="text-app-text-secondary text-[11px]">Resolution Time AVG</span>
                <span className="text-white font-semibold">1.5 hours SLA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary text-[11px]">Escalated Incident Count</span>
                <span className="text-green-400 font-semibold font-mono">0 escalated</span>
              </div>
            </div>
          </div>

          {/* SECTION: Behavioral & Purchase Analytics */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Behavioral & Purchasing Analytics
            </h3>

            <div className="space-y-3 text-xs pt-1">
              <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                <span className="text-app-text-secondary text-[11px]">Search matching CTR</span>
                <span className="text-app-accent-light font-bold font-mono">64.5% conversion</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                <span className="text-app-text-secondary text-[11px]">Cart abandonment rate</span>
                <span className="text-white font-semibold font-mono">12.4% (Ultra low)</span>
              </div>
              <div>
                <span className="text-app-text-secondary text-[9px] font-bold uppercase tracking-wider block mb-1">Category affinity metrics</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="h-2 bg-gradient-to-r from-indigo-500 via-[#F4631E] to-blue-500 rounded-full flex-1" />
                  <span className="text-[9.5px] text-slate-300 font-mono">84% Fashion</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: Admin Security & Console Actions */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-[#F4631E] uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin Security Action Center</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button 
                onClick={() => triggerMessage({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Consumer' })}
                className="px-3 py-2 bg-white/[0.02] border border-app-border hover:bg-white/[0.05] text-white hover:text-white transition-all text-[11px] font-semibold text-center rounded-[3px]"
              >
                Send Message
              </button>
              <button 
                onClick={() => triggerPhone({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Consumer' })}
                className="px-3 py-2 bg-white/[0.02] border border-app-border hover:bg-white/[0.05] text-white hover:text-white transition-all text-[11px] font-semibold text-center rounded-[3px]"
              >
                Dial Phone Call
              </button>
              <button 
                onClick={() => showToast("Warning has been registered in audit files.", "info")}
                className="px-3 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all text-[11px] font-semibold text-center rounded-[3px]"
              >
                Issue Warning
              </button>
              <button 
                onClick={() => showToast("Temporary password reset link generated and sent.", "success")}
                className="px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-[11px] font-semibold text-center rounded-[3px]"
              >
                Reset Password
              </button>
              <button 
                onClick={() => showToast("Security Audit Lock applied successfully.", "info")}
                className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all text-[11px] font-semibold text-center rounded-[3px]"
              >
                Audit Lock
              </button>
              <button 
                onClick={() => showToast(`User status set to ${profile.status === 'Active' ? 'Suspended' : 'Active'}`, "success")}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white transition-all text-[11px] font-black text-center rounded-[3px]"
              >
                {profile.status === 'Active' ? 'Flag / Suspend' : 'Activate User'}
              </button>
            </div>
          </div>

          {/* Recent Activities Timeline card */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Recent Activity Trail
            </h3>

            <div className="space-y-3 pt-1">
              {profile.recentActivities.map((act, index) => (
                <div key={index} className="flex gap-3 items-start p-1.5 hover:bg-white/[0.01] transition-all rounded-[3px]">
                  {getActivityIcon(act.iconType)}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">{act.title}</h4>
                    <p className="text-[9.5px] text-app-text-secondary font-mono mt-0.5">{act.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Search controls, metric cards & Orders table list */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input box */}
            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light" />
              <input 
                type="text" 
                placeholder="Search orders, item name, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white/[0.02] border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-app-accent/40 text-white placeholder-app-text-secondary/40 font-medium"
              />
            </div>

            {/* Date Filtering and Export dot button */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={() => showToast('Filtered query range correctly', 'success')}
                className="px-3.5 py-1.5 bg-app-card border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary flex items-center gap-1.5 hover:border-app-accent hover:text-white shadow-sm transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-app-accent" />
                <span>Select Date</span>
              </button>
              
              <button 
                onClick={() => showToast('Exported CSV record queue', 'success')}
                className="p-1.5 bg-app-card border border-app-border rounded-[4px] hover:border-app-accent hover:text-white text-app-text-secondary shadow-sm transition-all cursor-pointer"
                title="Action Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* METRIC CARDS ROW - EXACTLY ALIGNED */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Total Spent stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Total Spend (LTV)</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.totalSpent}
                </span>
                <span className="text-[9px] text-green-400 block font-semibold hover:underline cursor-pointer">
                  AOV: {profile.averageOrderValue}
                </span>
              </div>
              {/* Sparkline in red-orange accent */}
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-app-accent" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 25 Q 25 10, 45 35 T 85 15 T 95 20" />
                </svg>
              </div>
            </div>

            {/* Total Orders stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Total Orders</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.totalOrders}
                </span>
                <span className="text-[9px] text-app-text-secondary block font-medium">
                  Across prior active years
                </span>
              </div>
              {/* Sparkline */}
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-app-accent" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10 Q 30 35, 55 15 T 85 30 T 95 20" />
                </svg>
              </div>
            </div>

            {/* Completed Orders stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Delivered Orders</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.completedOrders}
                </span>
                <span className="text-[9px] text-green-400 block font-semibold">
                  {Math.round((profile.completedOrders / profile.totalOrders) * 100)}% Fulfilled Ratio
                </span>
              </div>
              {/* Sparkline */}
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-app-accent" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 30 Q 25 5, 45 25 T 85 10 T 95 5" />
                </svg>
              </div>
            </div>

          </div>

          {/* ALL ORDERS TABLE PANEL */}
          <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl p-5 space-y-5">
            
            {/* Table Header and Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-3">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Historical Orders
              </span>

              {/* Underlying Tab Switchers */}
              <div className="flex flex-wrap items-center gap-1">
                {(['All Orders', 'Processing', 'Shipped', 'Canceled'] as const).map((tab) => {
                  let count = 0;
                  if (tab === 'All Orders') {
                    count = profile.orders.reduce((sum, g) => sum + g.items.length, 0);
                  } else if (tab === 'Processing') {
                    count = profile.orders.reduce((sum, g) => sum + g.items.filter(i => i.status === 'Pending').length, 0);
                  } else if (tab === 'Shipped') {
                    count = profile.orders.reduce((sum, g) => sum + g.items.filter(i => i.status === 'Completed').length, 0);
                  } else if (tab === 'Canceled') {
                    count = profile.orders.reduce((sum, g) => sum + g.items.filter(i => i.status === 'Canceled').length, 0);
                  }

                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`relative px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'text-app-accent bg-app-accent/5 rounded-[3px]' 
                          : 'text-app-text-secondary hover:text-white'
                      }`}
                    >
                      <span className="mr-1">
                        {tab === 'All Orders' ? 'All Orders' : tab}
                      </span>
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Table layout matching Choosify look */}
            {filteredGroups.length > 0 ? (
              <div className="space-y-4">
                
                {/* Headers */}
                <div className="hidden md:grid grid-cols-12 gap-4 pb-2 text-[10px] text-app-text-secondary font-bold uppercase tracking-widest border-b border-white/[0.04]">
                  <div className="col-span-6">Product Details</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 pl-4">Payment Channel</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {/* Date groups */}
                <div className="space-y-6">
                  {filteredGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-3">
                      
                      {/* Date Indicator Line */}
                      <div className="flex items-center justify-between border-b border-dashed border-white/[0.04] pb-1.5 font-mono text-[10px]">
                        <span className="text-app-text-secondary font-bold uppercase">
                          {group.date}
                        </span>
                        <span className="text-white font-semibold">
                          {group.orderId}
                        </span>
                      </div>

                      {/* Items loop */}
                      <div className="space-y-2.5">
                        {group.items.map((item) => (
                          <div 
                            key={item.id}
                            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-[3px] bg-white/[0.01] hover:bg-white/[0.03] transition-all border border-white/[0.02]"
                          >
                            {/* Product column */}
                            <div className="col-span-1 md:col-span-6 flex items-center gap-3">
                              <img 
                                src={item.thumbnail} 
                                alt={item.name}
                                className="w-12 h-12 rounded-[4px] object-cover bg-white/5 border border-white/10 shrink-0 shadow-sm" 
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                                <p className="text-[10px] text-app-text-secondary font-medium truncate">
                                  {item.details}
                                </p>
                              </div>
                            </div>

                            {/* Price column */}
                            <div className="col-span-1 md:col-span-2 md:text-right">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Price</span>
                              <span className="text-xs font-bold text-white font-mono">
                                {item.price}
                              </span>
                            </div>

                            {/* Payment Column */}
                            <div className="col-span-1 md:col-span-2 md:pl-4">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Payment</span>
                              <span className="text-xs font-medium text-app-text-secondary">
                                {item.paymentMethod}
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="col-span-1 md:col-span-2 md:text-right flex md:justify-end">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mr-2 mb-0.5">Status</span>
                              {item.status === 'Pending' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-app-accent/20 text-app-accent border border-app-accent/30 shrink-0 w-24 text-center">
                                  Pending
                                </span>
                              )}
                              {item.status === 'Completed' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 shrink-0 w-24 text-center">
                                  Completed
                                </span>
                              )}
                              {item.status === 'Canceled' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 shrink-0 w-24 text-center">
                                  Cancelled
                                </span>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="py-12 text-center space-y-2 bg-white/[0.01] rounded-[4px] border border-dashed border-white/[0.04]">
                <ShoppingBag className="w-8 h-8 text-app-text-secondary/20 mx-auto" />
                <h4 className="text-xs font-bold text-white">No orders match filter selection</h4>
                <p className="text-[11px] text-app-text-secondary opacity-60">Try selecting another filter status or refining query keywords</p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
