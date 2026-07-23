import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';
import { 
  Bolt, 
  Search, 
  ShoppingBag, 
  Award, 
  Tag, 
  Sparkles, 
  ChevronRight, 
  Globe, 
  TrendingUp, 
  Star,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  Video,
  Plus,
  CheckCircle2,
  ArrowRight,
  Sparkle,
  Zap,
  Flame,
  ShieldCheck,
  ChevronLeft,
  Info
} from 'lucide-react';
import { useCMS } from '../contexts/CMSContext';
import { useCMSData } from '../contexts/CMSDataContext';
import { useAds } from '../contexts/AdsContext';
import { useBrandProfiles } from '../contexts/BrandProfilesContext';
import { useInventory } from '../contexts/InventoryContext';

// Define standard local assets matching live preview fallbacks
const FALLBACK_PRODUCTS = [
  { id: 'p1', name: 'Samsung S25 Ultra', brand: 'Samsung Bangladesh', category: 'Mobile', price: '৳ 139,999', rating: 4.9, image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80', badge: 'Hot Seller' },
  { id: 'p2', name: 'Vision Smart TV 55"', brand: 'Vision', category: 'Electronics', price: '৳ 68,500', rating: 4.7, image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&q=80', badge: 'Popular' },
  { id: 'p3', name: 'Aarong Jamdani Saree', brand: 'Aarong', category: 'Fashion', price: '৳ 4,200', rating: 4.8, image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80', badge: 'Authentic' },
  { id: 'p4', name: 'Walton 2-Door Fridge', brand: 'Walton', category: 'Home', price: '৳ 29,990', rating: 4.5, image: 'https://images.unsplash.com/photo-1571175432247-50a2e4c6bb77?w=400&q=80' },
  { id: 'p5', name: 'Apex Men Royal Loafer', brand: 'Apex', category: 'Footwear', price: '৳ 4,500', rating: 4.6, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80', badge: 'Premium' },
];

const FALLBACK_BRANDS = [
  { id: 'b1', name: 'Apex Footwear', logo: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=100&q=80', category: 'Footwear & Apparel', rating: 4.8, verified: true },
  { id: 'b2', name: 'Walton Appliances', logo: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=100&q=80', category: 'Electronics & Home', rating: 4.5, verified: true },
  { id: 'b3', name: 'Aarong Handcrafts', logo: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=100&q=80', category: 'Fashion Heritage', rating: 4.9, verified: true },
  { id: 'b4', name: 'Samsung Bangladesh', logo: 'https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?w=100&q=80', category: 'Consumer Tech', rating: 4.9, verified: true },
];

const FALLBACK_DEALS = [
  { id: 'd1', name: 'Eid Mega Tech Voucher 2026', discount: '30% OFF', seller: 'TechZone BD', image: 'https://images.unsplash.com/photo-1468436139062-f60a71c5c892?w=400&q=80', expiry: '12 days left' },
  { id: 'd2', name: 'Walton AC Summer Cooling Flash', discount: '40% OFF', seller: 'ElectroBD', image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80', expiry: '18 hours left' },
];

const FALLBACK_CREATORS = [
  { id: 'c1', name: 'Rafsan The Chotobhai', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80', followers: '1.2M', category: 'Food & Lifestyle', engagement: '8.4%', verified: true },
  { id: 'c2', name: 'Tawhid Afridi', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80', followers: '2.5M', category: 'Vlogs & Tech', engagement: '11.2%', verified: true },
];

const FALLBACK_RECOMMENDATIONS = [
  { id: 'rec1', title: 'Ultimate Panjabi Buying Guide for Eid 2026', creator: 'Rafsan The Chotobhai', reads: '12.4K reads', image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400&q=80', tag: 'Eid Fashion', type: 'blog' },
  { id: 'rec2', title: 'Top Budget-Friendly Refrigerator Matches in BD', creator: 'SamZone tech', reads: '8.1K reads', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80', tag: 'Home Tech', type: 'video' },
];

const platformIcons: Record<string, any> = {
  Facebook,
  Instagram,
  YouTube: Youtube,
  TikTok: Video,
  WhatsApp: MessageCircle
};

export default function Home() {
  const { cmsData: globalCMS, loading: cmsLoading } = useCMS();
  const { cmsData: cmsSections } = useCMSData();
  const { promotions } = useAds();
  const { profiles: brandProfiles } = useBrandProfiles();
  const { inventory } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { name: 'Fashion', icon: Tag, color: 'text-orange-500' },
    { name: 'Handicrafts', icon: Sparkles, color: 'text-green-500' },
    { name: 'Lifestyle', icon: Star, color: 'text-blue-500' },
    { name: 'Electronics', icon: Bolt, color: 'text-purple-500' },
  ];

  // Helper to fetch and merge live vs fallback items
  const getItemsForSection = (section: any, type: string) => {
    const ids = section.itemIds || [];
    if (type === 'product') {
      const all = [...(inventory || []), ...FALLBACK_PRODUCTS];
      return ids.map((id: string) => all.find((x: any) => x.id === id)).filter(Boolean);
    }
    if (type === 'brand') {
      const all = [...(brandProfiles || []), ...FALLBACK_BRANDS];
      return ids.map((id: string) => all.find((x: any) => x.id === id)).filter(Boolean);
    }
    if (type === 'creator') {
      return ids.map((id: string) => FALLBACK_CREATORS.find((x: any) => x.id === id)).filter(Boolean);
    }
    if (type === 'deal') {
      const all = [...(promotions?.filter(p => p.type === 'DEAL') || []), ...FALLBACK_DEALS];
      return ids.map((id: string) => all.find((x: any) => x.id === id)).filter(Boolean);
    }
    if (type === 'guide') {
      return ids.map((id: string) => FALLBACK_RECOMMENDATIONS.find((x: any) => x.id === id)).filter(Boolean);
    }
    return [];
  };

  const activeSortedSections = Object.values(cmsSections || {})
    .filter((sec: any) => sec.isActive)
    .sort((a: any, b: any) => a.order - b.order);

  const heroBanner = globalCMS?.heroBanners?.find(b => b.isActive) || {
    headline: "Bangladesh's Most Trusted Product Discovery Platform",
    subtitle: 'Find verified brands, expert guides, and exclusive deals — all in one place.',
    ctaText: 'Explore Products',
    ctaUrl: '/products',
    backgroundImage: ''
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary font-sans overflow-x-hidden">
      {/* Announcement Bar */}
      {globalCMS?.globalSettings?.announcementBarEnabled && (
        <div className="bg-app-accent text-white py-2.5 px-4 text-center text-xs font-bold tracking-wide flex items-center justify-center gap-2 select-none">
          <Sparkle className="w-3.5 h-3.5 animate-pulse" />
          <span>{globalCMS.globalSettings.announcementBarText}</span>
        </div>
      )}

      {/* Header Navigation */}
      <nav className="h-20 border-b border-app-border bg-app-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/marketplace" className="flex items-center gap-3">
            <ChoosifyLogo variant="full" theme="dark" className="h-12 w-auto max-w-[240px] select-none" />
          </Link>

          <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-app-text-secondary">
            {(globalCMS?.navigation || [])
              .sort((a, b) => a.order - b.order)
              .map((nav) => (
                <Link 
                  key={nav.id} 
                  to={nav.path} 
                  className="hover:text-white transition-colors duration-200"
                >
                  {nav.label}
                </Link>
              ))}
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/login" 
              className="text-xs font-bold uppercase tracking-widest text-app-text-secondary hover:text-white transition-colors duration-200"
            >
              Partner Portal
            </Link>
            <Link 
              to="/login" 
              className="bg-app-accent hover:bg-app-accent/90 text-white font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-app-accent/20 hover:shadow-app-accent/30"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Search Section */}
      <section className="relative py-24 px-6 overflow-hidden border-b border-app-border">
        {/* Background mesh/gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-app-sidebar/20 to-transparent -z-10" />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-app-accent/5 rounded-full blur-[120px] -z-10" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px] -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-app-sidebar/80 border border-app-border text-xs text-app-text-secondary font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-app-accent animate-ping" />
            Empowering Smart Purchases
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none max-w-3xl mx-auto">
            {heroBanner.headline}
          </h1>
          <p className="text-app-text-secondary text-base md:text-lg max-w-2xl mx-auto font-medium">
            {heroBanner.subtitle}
          </p>

          {/* Search bar */}
          <div className="max-w-xl mx-auto relative group">
            <div className="absolute inset-0 bg-app-accent/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10" />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-app-text-secondary w-5 h-5 group-focus-within:text-app-accent transition-colors duration-200" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search local brands, verified guides, products..."
              className="w-full h-14 pl-14 pr-32 bg-app-card border border-app-border rounded-2xl text-white placeholder-app-text-secondary/60 focus:outline-none focus:border-app-accent transition-all font-medium text-sm"
            />
            <button className="absolute right-2.5 top-2.5 h-9 bg-app-accent hover:bg-app-accent/90 text-white text-xs font-bold uppercase tracking-widest px-5 rounded-xl transition-all">
              Search
            </button>
          </div>

          {/* Categories Grid */}
          <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {categories.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <div 
                  key={i} 
                  className="bg-app-card/60 border border-app-border/80 hover:border-app-accent/40 rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-app-accent/5"
                >
                  <div className={`w-10 h-10 rounded-xl bg-app-sidebar flex items-center justify-center ${cat.color} border border-app-border/40 shadow-inner`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-xs font-extrabold">{cat.name}</p>
                    <p className="text-[10px] text-app-text-secondary font-semibold">Explore Items</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dynamic Hydrated CMS Sections */}
      <section className="max-w-7xl mx-auto px-6 py-20 space-y-24">
        {activeSortedSections.map((section: any) => {
          const type = 
            section.id.toLowerCase().includes('deal') ? 'deal' :
            section.id.toLowerCase().includes('brand') ? 'brand' :
            section.id.toLowerCase().includes('creator') ? 'creator' :
            section.id.toLowerCase().includes('product') ? 'product' :
            section.id.toLowerCase().includes('recommendation') ? 'guide' : 'product';

          const items = getItemsForSection(section, type);

          if (items.length === 0) return null;

          return (
            <div key={section.id} className="space-y-8">
              {/* Section Header */}
              <div className="flex items-end justify-between border-b border-app-border pb-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    {section.title}
                  </h2>
                  {section.subtitle && (
                    <p className="text-app-text-secondary text-sm font-medium mt-1">
                      {section.subtitle}
                    </p>
                  )}
                </div>
                <button className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-app-accent hover:underline">
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* SECTION TYPE: DEALS */}
              {type === 'deal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((item: any) => (
                    <div 
                      key={item.id} 
                      className="bg-app-card border border-app-border rounded-[2rem] p-6 flex flex-col md:flex-row gap-6 hover:border-app-accent/30 transition-all duration-300 relative group overflow-hidden"
                    >
                      <div className="w-full md:w-44 aspect-video md:aspect-square rounded-2xl overflow-hidden bg-app-sidebar relative shrink-0">
                        <img 
                          src={item.image || 'https://images.unsplash.com/photo-1468436139062-f60a71c5c892?w=400&q=80'} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded-lg tracking-wider shadow">
                          {item.discount || 'Special'}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h3 className="text-lg font-black text-white leading-snug">{item.name}</h3>
                          <p className="text-xs text-app-text-secondary font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {item.seller || 'Verified Seller'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-app-border mt-4">
                          <span className="text-[11px] font-bold text-app-text-secondary">⏳ {item.expiry || 'Limited offer'}</span>
                          <button className="bg-app-accent/10 hover:bg-app-accent hover:text-white text-app-accent font-extrabold text-xs px-4 py-2 rounded-xl transition-all">
                            Claim Deal
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION TYPE: BRANDS */}
              {type === 'brand' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {items.map((item: any) => (
                    <div 
                      key={item.id} 
                      className="bg-app-card border border-app-border rounded-3xl p-6 flex flex-col items-center text-center hover:border-app-accent/20 cursor-pointer transition-all duration-300 relative group"
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-app-sidebar border border-app-border p-1 group-hover:border-app-accent/30 transition-all">
                        <img 
                          src={item.logo || 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=100&q=80'} 
                          alt={item.name} 
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="mt-4 space-y-1">
                        <h3 className="text-sm font-black text-white flex items-center justify-center gap-1">
                          {item.name}
                          {item.verified && <CheckCircle2 className="w-4 h-4 text-sky-400 fill-sky-400/10 shrink-0" />}
                        </h3>
                        <p className="text-[10px] text-app-text-secondary font-bold">{item.category || 'Retail Store'}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-app-border w-full flex items-center justify-center gap-1 text-xs font-bold text-yellow-500">
                        <Star className="w-3.5 h-3.5 fill-yellow-500" />
                        <span>{item.rating || '4.5'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION TYPE: PRODUCTS */}
              {type === 'product' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {items.map((item: any) => (
                    <div 
                      key={item.id} 
                      className="bg-app-card border border-app-border rounded-[2rem] p-4 flex flex-col h-full hover:border-app-accent/30 transition-all duration-300 group"
                    >
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-app-sidebar shrink-0 border border-app-border">
                        <img 
                          src={item.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80'} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                        {item.badge && (
                          <div className="absolute top-3 left-3 bg-app-accent text-white px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider shadow">
                            {item.badge}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] text-app-text-secondary font-bold tracking-wider uppercase">{item.brand || 'Local Brand'}</p>
                          <h3 className="text-sm font-black text-white mt-1 line-clamp-2 leading-snug">{item.name}</h3>
                        </div>
                        <div className="mt-4 pt-4 border-t border-app-border flex items-center justify-between">
                          <span className="text-sm font-black text-white">{item.price || 'Contact for price'}</span>
                          <span className="text-[10px] text-app-accent font-black uppercase tracking-wider group-hover:translate-x-0.5 transition-all">Details →</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION TYPE: CREATORS */}
              {type === 'creator' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {items.map((item: any) => (
                    <div 
                      key={item.id} 
                      className="bg-app-card border border-app-border rounded-3xl p-6 flex flex-col items-center text-center hover:border-app-accent/20 cursor-pointer transition-all duration-300 group"
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-app-sidebar border border-app-border p-1 group-hover:border-app-accent/30 transition-all">
                        <img 
                          src={item.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80'} 
                          alt={item.name} 
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="mt-4 space-y-1">
                        <h3 className="text-sm font-black text-white flex items-center justify-center gap-1">
                          {item.name}
                          {item.verified && <CheckCircle2 className="w-4 h-4 text-sky-400 fill-sky-400/10 shrink-0" />}
                        </h3>
                        <p className="text-[10px] text-app-text-secondary font-bold">{item.category || 'Creator'}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-app-border w-full flex items-center justify-between text-[11px] font-bold text-app-text-secondary">
                        <span>👥 {item.followers || '100K'}</span>
                        <span className="text-app-accent font-black">Follow →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION TYPE: EXPERT BUYING GUIDES */}
              {type === 'guide' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((item: any) => (
                    <div 
                      key={item.id} 
                      className="bg-app-card border border-app-border rounded-[2rem] p-6 flex flex-col sm:flex-row gap-6 hover:border-app-accent/30 transition-all duration-300 relative group overflow-hidden"
                    >
                      <div className="w-full sm:w-40 aspect-video sm:aspect-square rounded-2xl overflow-hidden bg-app-sidebar relative shrink-0">
                        <img 
                          src={item.image || 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400&q=80'} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <span className="bg-app-accent/10 text-app-accent text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-app-accent/20">
                            {item.tag || 'Expert Pick'}
                          </span>
                          <h3 className="text-base font-black text-white leading-snug pt-1">{item.title}</h3>
                          <p className="text-[11px] text-app-text-secondary font-semibold">By {item.creator}</p>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-app-border mt-4">
                          <span className="text-[11px] font-bold text-app-text-secondary">👀 {item.reads || '5K reads'}</span>
                          <button className="text-app-accent hover:underline font-black text-xs uppercase tracking-widest">
                            Read Guide →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Newsletter Banner */}
      <section className="bg-app-sidebar border-t border-b border-app-border py-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-app-accent/5 rounded-full blur-[100px] -z-10" />
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-black text-white tracking-tight">Never Miss BD's Best Deals & Trends</h2>
          <p className="text-app-text-secondary text-sm max-w-lg mx-auto leading-relaxed">
            Join 20,000+ shoppers receiving weekly updates on verified local brands, expert guides, and pre-negotiated voucher drops.
          </p>
          <div className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <input 
              type="email" 
              placeholder="Enter your email address..."
              className="flex-1 h-12 px-5 bg-app-card border border-app-border rounded-xl text-white placeholder-app-text-secondary/60 focus:outline-none focus:border-app-accent font-semibold text-sm"
            />
            <button className="h-12 bg-app-accent hover:bg-app-accent/90 text-white text-xs font-black uppercase tracking-widest px-8 rounded-xl transition-all shadow-lg shadow-app-accent/20">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-app-sidebar">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <Link to="/marketplace">
              <ChoosifyLogo variant="full" theme="dark" className="h-12 w-auto max-w-[240px] select-none" />
            </Link>
            <p className="text-app-text-secondary text-sm leading-relaxed max-w-sm">
              {globalCMS?.footer?.description || "Bangladesh's premier discovery platform. We connect sellers, creators, and consumers in a unified, trusted ecosystem."}
            </p>
            <div className="flex items-center gap-4 pt-4">
              {(globalCMS?.socialLinks || [])
                .filter(s => s.isVisible)
                .map((social) => {
                  const Icon = platformIcons[social.platform] || Globe;
                  return (
                    <a 
                      key={social.id} 
                      href={social.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 bg-app-card border border-app-border hover:border-app-accent rounded-xl flex items-center justify-center text-app-text-secondary hover:text-white transition-all duration-200"
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
            </div>
          </div>

          {(globalCMS?.footer?.columns || []).map((col) => (
            <div key={col.id} className="space-y-4">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">{col.title}</h3>
              <ul className="space-y-2 text-sm font-semibold text-app-text-secondary">
                {col.links.map((link, j) => (
                  <li key={j}>
                    <a href={link.url} className="hover:text-white transition-colors duration-200">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-app-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-bold text-app-text-secondary select-none">
          <p>{globalCMS?.footer?.copyrightText || "© 2026 Choosify Bangladesh Ltd. All rights reserved."}</p>
          <div className="flex items-center gap-6">
            <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
