import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useCMS } from '../contexts/CMSContext';
import { useAds } from '../contexts/AdsContext';
import { useOrders } from '../contexts/OrdersContext';
import { useCoupons } from '../contexts/CouponsContext';

const platformIcons: Record<string, any> = {
  Facebook: Facebook,
  Instagram: Instagram,
  YouTube: Youtube,
  TikTok: Video,
  WhatsApp: MessageCircle
};

export default function Home() {
  const { profile } = useAuth();
  const { cmsData } = useCMS();
  const { promotions, trackClick } = useAds();
  const { createOrderNow } = useOrders();
  const { validateCoupon } = useCoupons();

  const [selectedCheckoutProduct, setSelectedCheckoutProduct] = useState<any | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('Assalamu alaikum. Please deliver the package with authentic packing intact. Contact me before delivery.');
  const [showCompleteToast, setShowCompleteToast] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');

  // Coupon entry states in Checkout Selection Modal Drawer
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  const handleApplyPromo = () => {
    if (!promoInput.trim() || !selectedCheckoutProduct) return;
    const cartTotal = selectedCheckoutProduct.priority || 4200;
    
    const itemArg = [{
      id: selectedCheckoutProduct.id,
      price: selectedCheckoutProduct.priority || 4200,
      category: 'Fashion', // default simulated category
      brand: selectedCheckoutProduct.subtitle || 'Aarong',
      quantity: 1
    }];

    const res = validateCoupon(promoInput.toUpperCase().trim(), cartTotal, profile?.uid || 'cust_001', itemArg);
    if (res.valid) {
      setAppliedPromo(promoInput.toUpperCase().trim());
      setPromoDiscount(res.discount);
      setPromoSuccess(`Voucher applied! ৳${res.discount} discount deducted.`);
      setPromoError(null);
    } else {
      setPromoError(res.reason || 'Invalid voucher code.');
      setPromoSuccess(null);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoDiscount(0);
    setPromoError(null);
    setPromoSuccess(null);
  };

  const submitTrustOrder = () => {
    if (!selectedCheckoutProduct) return;
    
    // Simulate raw product conversion
    const rawProd = {
      id: selectedCheckoutProduct.id,
      name: selectedCheckoutProduct.title,
      brand: selectedCheckoutProduct.subtitle || 'Aarong Handcrafts',
      price: selectedCheckoutProduct.priority || 4200,
      image: selectedCheckoutProduct.imageUrl || 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80',
      sellerId: 'seller_001',
      sellerName: selectedCheckoutProduct.subtitle?.includes('Samsung') ? 'TechZone BD' : 'Aarong Digital'
    };

    createOrderNow(rawProd, checkoutNotes, appliedPromo || undefined, promoDiscount || undefined);
    
    trackClick(selectedCheckoutProduct.id);
    setSelectedCheckoutProduct(null);
    setShowCompleteToast(true);
    
    // Reset promo code state
    handleRemovePromo();

    setTimeout(() => setShowCompleteToast(false), 8000);
  };

  const categories = [
    { name: 'Fashion', icon: Tag, color: 'text-orange-500' },
    { name: 'Handicrafts', icon: Sparkles, color: 'text-green-500' },
    { name: 'Lifestyle', icon: Star, color: 'text-blue-500' },
    { name: 'Electronics', icon: Bolt, color: 'text-purple-500' },
  ];

  const bannerAds = promotions.filter(p => p.type === 'AD' && p.status === 'ACTIVE' && p.placement === 'homepage_banner');
  const featuredDeals = promotions.filter(p => p.type === 'DEAL' && p.status === 'ACTIVE');
  const featuredProducts = promotions.filter(p => p.type === 'PRODUCT' && p.status === 'ACTIVE');

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="h-20 border-b border-app-border bg-app-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
             {cmsData.logos.header ? (
               <img src={cmsData.logos.header} alt="Choosify Logo" className="h-10 object-contain" />
             ) : (
               <>
                 <div className="w-9 h-9 bg-app-accent rounded-xl flex items-center justify-center shadow-lg shadow-app-accent/20">
                    <Bolt className="text-white w-5 h-5" />
                 </div>
                 <span className="text-2xl font-black tracking-tighter">Choosify<span className="text-app-accent">.bd</span></span>
               </>
             )}
          </Link>

          <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-app-text-secondary">
             {cmsData.navigation.sort((a, b) => a.order - b.order).map((nav) => (
               <Link key={nav.id} to={nav.path} className="hover:text-app-text-primary transition-colors">{nav.label}</Link>
             ))}
          </div>

          <div className="flex items-center gap-4">
             {profile ? (
                <Link to="/admin/dashboard" className="px-6 py-2.5 bg-app-accent hover:bg-app-accent-light text-white rounded-xl text-sm font-bold transition-all">
                   My Dashboard
                </Link>
             ) : (
                <>
                  <Link to="/login" className="hidden sm:block text-sm font-bold text-app-text-secondary hover:text-app-text-primary transition-colors">Sign In</Link>
                  <Link to="/login" className="px-6 py-2.5 bg-app-accent hover:bg-app-accent-light text-white rounded-xl text-sm font-bold shadow-lg shadow-app-accent/20 transition-all">
                     Get Started
                  </Link>
                </>
             )}
          </div>
        </div>
      </nav>

      {/* Sponsored Banner */}
      {bannerAds.length > 0 && (
        <section className="bg-app-sidebar border-b border-app-border">
          <div className="max-w-7xl mx-auto py-2 px-6 overflow-hidden relative h-10 flex items-center justify-center">
             <div className="flex items-center gap-4 animate-scroll-horizontal whitespace-nowrap">
                {bannerAds.map((ad) => (
                  <a 
                    key={ad.id} 
                    href={ad.linkUrl} 
                    onClick={() => trackClick(ad.id)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold uppercase tracking-widest text-app-accent-light flex items-center gap-2 hover:underline"
                  >
                     <Sparkles className="w-3 h-3" /> {ad.title}: {ad.subtitle} <ChevronRight className="w-3 h-3" />
                  </a>
                ))}
             </div>
          </div>
        </section>
      )}

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
         <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="max-w-3xl">
               <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-app-accent/10 border border-app-accent/20 rounded-full text-[10px] font-bold text-app-accent-light uppercase tracking-widest mb-6"
               >
                  <Sparkles className="w-3 h-3" /> Bangladesh's Curated Discovery Platform
               </motion.div>
               <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.05]"
               >
                  Buy with <span className="text-app-accent">trust</span>, <br/> 
                  Discover with <span className="bg-gradient-to-r from-app-accent to-app-accent-light bg-clip-text text-transparent">intent.</span>
               </motion.h1>
               <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl text-app-text-secondary leading-relaxed mb-10 max-w-xl"
               >
                  The first unified ecosystem connecting verified brands, expert creators, and conscious consumers in Bangladesh.
               </motion.p>
               <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-wrap gap-4"
               >
                  <div className="flex-1 min-w-[300px] relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-app-text-secondary" />
                     <input 
                        type="text" 
                        placeholder="Search for handicraft, organic food, fashion..." 
                        className="w-full bg-white border border-app-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-app-accent outline-none transition-all shadow-sm"
                     />
                  </div>
                  <button className="px-8 py-4 bg-app-accent hover:bg-app-accent-light text-white rounded-2xl font-bold shadow-2xl shadow-app-accent/30 transition-all border border-app-accent/20">
                     Explore Now
                  </button>
               </motion.div>
            </div>
         </div>

         {/* Background Decoration */}
         <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-app-accent/20 rounded-full blur-[120px] -mr-64 opacity-50 pointer-events-none" />
      </section>

      {/* Trust Badges / Stats */}
      <section className="py-20 border-y border-app-border bg-slate-50">
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
               {[
                 { label: 'Verified Sellers', val: '500+', icon: Building2 },
                 { label: 'Expert Creators', val: '1.2k', icon: Award },
                 { label: 'Active Consumers', val: '50k+', icon: Users },
                 { label: 'Trusted Deals', val: '2k+', icon: Tag },
               ].map((stat, i) => (
                 <div key={i} className="text-center space-y-2">
                    <div className="text-3xl font-black text-app-text-primary">{stat.val}</div>
                    <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest">{stat.label}</div>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Featured / Trending Section (Ads Integration) */}
      {featuredProducts.length > 0 && (
        <section className="py-20 bg-app-card/30 border-y border-app-border overflow-hidden">
           <div className="max-w-7xl mx-auto px-6">
              <div className="flex justify-between items-end mb-12">
                 <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                       <TrendingUp className="text-app-accent" /> Trending Now
                    </h2>
                    <p className="text-app-text-secondary text-sm">Most viewed products across categories this week.</p>
                 </div>
                 <Link to="/products" className="text-sm font-bold text-app-accent hover:underline flex items-center gap-1">
                    View All <ChevronRight className="w-4 h-4" />
                 </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                 {featuredProducts.map((product) => (
                   <motion.div 
                    key={product.id}
                    whileHover={{ y: -5 }}
                    className="group bg-app-bg border border-app-border rounded-3xl p-4 transition-all hover:border-app-accent/30 relative"
                   >
                      <div className="absolute top-6 right-6 z-10 px-2 py-0.5 bg-orange-500 text-white text-[8px] font-black uppercase rounded shadow-lg">Featured</div>
                      <div className="aspect-square bg-app-card rounded-2xl mb-4 overflow-hidden relative">
                         {product.imageUrl ? (
                           <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center opacity-10">
                              <ShoppingBag className="w-12 h-12" />
                           </div>
                         )}
                         <button className="absolute bottom-4 right-4 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all shadow-xl">
                            <Plus className="w-5 h-5" />
                         </button>
                      </div>
                      <h4 className="font-bold text-sm mb-1 truncate">{product.title}</h4>
                      <p className="text-[11px] text-app-text-secondary mb-3 line-clamp-1">{product.subtitle}</p>
                      <div className="flex justify-between items-center mb-3">
                         <span className="text-xs font-black text-app-accent">৳ {product.priority.toLocaleString()}</span>
                         <div className="flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
                            <span className="text-[10px] font-bold">4.9</span>
                         </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCheckoutProduct(product);
                          setCheckoutNotes(`Assalamu alaikum. I would like to place an order for ${product.title}. Please confirm.`);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-app-accent to-orange-500 hover:from-app-accent-light hover:to-orange-400 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                         Order Now
                      </button>
                   </motion.div>
                 ))}
              </div>
           </div>
        </section>
      )}

      {/* Featured Categories */}
      <section className="py-32">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-16">Explore Curated Categories</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
               {categories.map((cat, i) => (
                  <div key={i} className="bg-app-card border border-app-border rounded-[2rem] p-10 hover:border-app-accent/30 transition-all cursor-pointer group">
                     <div className={`w-16 h-16 rounded-2xl bg-app-bg flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform ${cat.color}`}>
                        <cat.icon className="w-8 h-8" />
                     </div>
                     <h3 className="font-bold text-lg">{cat.name}</h3>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* Featured Deals (Ads Integration) */}
      {featuredDeals.length > 0 && (
        <section className="py-32 bg-app-sidebar relative">
           <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center gap-4 mb-12">
                 <div className="w-12 h-12 bg-app-accent rounded-2xl flex items-center justify-center shadow-xl shadow-app-accent/20">
                    <Tag className="text-white w-6 h-6" />
                 </div>
                 <div>
                    <h2 className="text-3xl font-bold text-white">Exclusive Spotlight</h2>
                    <p className="text-app-text-secondary text-sm">Flash sales and limited time offers.</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {featuredDeals.map((deal) => (
                   <div key={deal.id} className="group relative h-[300px] border border-app-border rounded-[2.5rem] overflow-hidden">
                      {deal.imageUrl ? (
                        <img src={deal.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt="" />
                      ) : (
                        <div className="w-full h-full bg-app-bg" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-app-sidebar via-app-sidebar/40 to-transparent flex flex-col justify-end p-10">
                         <div className="inline-flex px-3 py-1 bg-app-accent text-white text-[9px] font-black uppercase rounded-full mb-4 w-fit shadow-lg">Featured Deal</div>
                         <h3 className="text-2xl font-bold text-white mb-2">{deal.title}</h3>
                         <p className="text-sm text-app-text-secondary mb-6 max-w-sm">{deal.subtitle}</p>
                         <div className="flex items-center justify-between">
                            <span className="text-xl font-black text-white">Save Up To ৳ {deal.priority.toLocaleString()}</span>
                            <button 
                              onClick={() => trackClick(deal.id)}
                              className="px-6 py-2.5 bg-white text-app-sidebar rounded-xl text-xs font-black uppercase tracking-widest hover:bg-app-accent hover:text-white transition-all"
                            >
                               Get Deal
                            </button>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-20 border-t border-app-border bg-app-sidebar">
         <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2 space-y-6">
               <Link to="/" className="flex items-center gap-3">
                  {cmsData.logos.footer ? (
                    <img src={cmsData.logos.footer} alt="Choosify Logo" className="h-10 object-contain" />
                  ) : (
                    <>
                      <Bolt className="text-app-accent w-8 h-8" />
                      <span className="text-2xl font-black tracking-tighter text-white">Choosify</span>
                    </>
                  )}
               </Link>
               <p className="text-app-text-secondary text-sm leading-relaxed max-w-sm">
                  Bangladesh's premier discovery platform. We connect sellers, creators, and consumers in a unified, trusted ecosystem.
               </p>
               <div className="flex items-center gap-4 pt-4">
                  {cmsData.socialLinks.filter(s => s.isVisible).map((social) => {
                    const Icon = platformIcons[social.platform] || Globe;
                    return (
                      <a 
                        key={social.id} 
                        href={social.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-app-text-secondary hover:text-app-accent hover:border-app-accent transition-all"
                      >
                        <Icon className="w-5 h-5" />
                      </a>
                    );
                  })}
               </div>
            </div>
            <div>
               <h4 className="font-bold mb-6">Platform</h4>
               <div className="flex flex-col gap-4 text-sm text-app-text-secondary">
                  <Link to="/products" className="hover:text-white">All Products</Link>
                  <Link to="/recommendations" className="hover:text-white">Expert Guides</Link>
                  <Link to="/brands" className="hover:text-white">Verified Brands</Link>
               </div>
            </div>
            <div>
               <h4 className="font-bold mb-6">For Business</h4>
               <div className="flex flex-col gap-4 text-sm text-app-text-secondary">
                  <Link to="/login" className="hover:text-white">Become a Seller</Link>
                  <Link to="/login" className="hover:text-white">Creator Program</Link>
                  <Link to="/login" className="hover:text-white">Admin Access</Link>
               </div>
            </div>
         </div>
         <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-white/5 text-center text-xs text-app-text-secondary font-bold uppercase tracking-widest opacity-40">
            © 2026 Choosify Bangladesh Ltd. All Rights Reserved.
         </div>
      </footer>

      {/* Checkout Selection Modal Drawer */}
      {selectedCheckoutProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setSelectedCheckoutProduct(null)} />
          <div className="bg-app-card border border-app-border rounded-[2.5rem] p-8 w-full max-w-lg relative z-10 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-app-accent-light px-2.5 py-0.5 bg-app-accent/10 border border-app-accent/15 rounded-full">Secure checkout gateway</span>
                <h3 className="text-xl font-black text-white mt-2">Verify Your Purchase Order</h3>
              </div>
              <button onClick={() => setSelectedCheckoutProduct(null)} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-4 p-4 bg-app-bg border border-app-border rounded-2xl">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-app-border">
                <img src={selectedCheckoutProduct.imageUrl} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-white truncate">{selectedCheckoutProduct.title}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">{selectedCheckoutProduct.subtitle}</p>
                <div className="text-xs font-bold text-app-accent mt-2"> Price BDT: ৳ {selectedCheckoutProduct.priority.toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Promo Code Input Section */}
              <div className="space-y-2 p-4 bg-app-bg/50 border border-app-border rounded-2xl">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Promo / Discount Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    disabled={!!appliedPromo}
                    placeholder="e.g. SUMMER2026, WELCOME250"
                    className="flex-1 bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-app-accent/40 disabled:opacity-50"
                  />
                  {appliedPromo ? (
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/15 rounded-xl text-rose-400 text-[10px] font-black uppercase transition-all"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-5 py-2 bg-app-accent hover:bg-orange-500 rounded-xl text-white text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      Apply
                    </button>
                  )}
                </div>

                {/* Success/Error message labels */}
                {promoError && (
                  <div className="text-[9px] text-rose-400 font-bold font-mono tracking-wide">{promoError}</div>
                )}
                {promoSuccess && (
                  <div className="text-[9px] text-emerald-400 font-bold font-mono tracking-wide">{promoSuccess}</div>
                )}
              </div>

              {/* Price calculations breakdown */}
              {selectedCheckoutProduct && (
                <div className="p-4 bg-app-bg border border-app-border rounded-2xl text-[11px] font-semibold text-slate-400 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span>Product Subtotal:</span>
                    <span className="text-white">৳ {(selectedCheckoutProduct.priority || 4200).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Logistics Charge:</span>
                    <span className="text-white">৳ 120</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Promo Voucher Applied:</span>
                      <span>-৳ {promoDiscount}</span>
                    </div>
                  )}
                  <div className="border-t border-app-border/40 my-1 pt-1 flex justify-between text-white font-bold text-xs">
                     <span className="text-slate-300 font-sans uppercase text-[10px] tracking-widest font-black">Grand Total Payable:</span>
                     <span className="text-app-accent font-mono text-sm">৳ {Math.max(0, (selectedCheckoutProduct.priority || 4200) + 120 - promoDiscount).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Add notes to Customer Support / Seller Inbox</label>
                <textarea 
                  rows={3}
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Detail preferred size, shipping notes, delivery times..."
                  className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-app-accent/40"
                />
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">Order-Linked Inbox Generation</span>
                  Completing checkout sends a product card & order log directly to the Seller inbox thread, opening an instant real-time inquiry.
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setSelectedCheckoutProduct(null)}
                className="px-5 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={submitTrustOrder}
                className="px-8 py-3 bg-app-accent hover:bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 cursor-pointer"
              >
                Place Trust Order Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Success Toast Overlay */}
      {showCompleteToast && (
        <div className="fixed bottom-6 left-6 z-[110] max-w-sm bg-slate-900 border border-emerald-500/20 text-white rounded-2xl p-5 shadow-2xl flex items-start gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Purchase Order Placed!</h4>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              Order request forwarded successfully! Open <strong>“My Dashboard”</strong> and head to the <strong>Inbox</strong> or <strong>Orders</strong> tracking console to view real-time log.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal icons for Hero
function Building2(props: any) { return <Globe {...props} /> }
function Users(props: any) { return <ShoppingBag {...props} /> }
