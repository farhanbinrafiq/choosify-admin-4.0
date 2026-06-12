import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Tag, 
  Info, 
  CheckCircle, 
  XCircle, 
  Settings,
  Package,
  Truck,
  RotateCcw,
  Sparkles,
  Search,
  ChevronRight,
  Edit3,
  ExternalLink,
  Film,
  Upload,
  Image as ImageIcon,
  BarChart3,
  MessageSquare,
  Clock,
  LayoutGrid,
  AlertCircle,
  Lock
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';

interface Spec {
  key: string;
  value: string;
}

const mockProductDetails: Record<string, any> = {
  '1': {
    brandName: 'Samsung BD',
    productName: 'Samsung S25 Ultra',
    category: 'Mobile',
    actualPrice: 154999,
    discountedPrice: 149999,
    stockLimit: 50,
    soldCount: 12,
    soldPercentage: 24,
    images: [
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80',
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80'
    ],
    sellerName: 'TechZone BD',
    sellerInit: 'TZ',
    tags: ['#PremiumQuality', '#SamsungS25', '#TechTrend']
  },
  '2': {
    brandName: 'Vision',
    productName: 'Vision Smart TV 55"',
    category: 'Electronics',
    actualPrice: 75000,
    discountedPrice: 68500,
    stockLimit: 30,
    soldCount: 8,
    soldPercentage: 26,
    images: [
      'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&q=80'
    ],
    sellerName: 'Meena Bazar',
    sellerInit: 'MB',
    tags: ['#SmartTV', '#BigScreen', '#HomeCinema']
  },
  '3': {
    brandName: 'Aarong',
    productName: 'Aarong Jamdani Saree',
    category: 'Fashion',
    actualPrice: 5000,
    discountedPrice: 4200,
    stockLimit: 120,
    soldCount: 45,
    soldPercentage: 37,
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80'
    ],
    sellerName: 'Aarong Digital',
    sellerInit: 'AD',
    tags: ['#Heritage', '#Jamdani', '#Traditional']
  },
  '4': {
    brandName: 'Walton',
    productName: 'Walton 2-Door Fridge',
    category: 'Home',
    actualPrice: 35000,
    discountedPrice: 29990,
    stockLimit: 40,
    soldCount: 15,
    soldPercentage: 37,
    images: [
      'https://images.unsplash.com/photo-1571175432244-5f0258591f87?w=800&q=80'
    ],
    sellerName: 'ElectroBD',
    sellerInit: 'EB',
    tags: ['#SmartCooling', '#WaltonBD', '#EcoFriendly']
  }
};

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview & Content');
  const [isEditMode, setIsEditMode] = useState(false);
  const [backupProduct, setBackupProduct] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Basic Info State
  const [productInfo, setProductInfo] = useState({
    brandName: 'Samsung BD',
    productName: 'Samsung S25 Ultra',
    category: 'Mobile',
    actualPrice: 154999,
    discountedPrice: 149999,
    stockLimit: 50,
    soldCount: 12,
    soldPercentage: 24
  });

  // Media State
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80',
    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80'
  ]);
  const [mediaLinks, setMediaLinks] = useState<string[]>([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  ]);

  // Content State
  const [tags, setTags] = useState<string[]>(['#PremiumQuality', '#CorporateWear', '#FashionIcon']);
  const [tagInput, setTagInput] = useState('');
  const [about, setAbout] = useState('Crafted for those who value both style and functionality, this product defines a new standard in its category. With premium materials and meticulous attention to detail, it offers an unparalleled experience.');
  const [pros, setPros] = useState<string[]>(['Superior build quality', 'Excellent battery life', 'Industry-leading display']);
  const [cons, setCons] = useState<string[]>(['Premium pricing', 'Limited color options']);
  
  // Specs State
  const [specs, setSpecs] = useState<Spec[]>([
    { key: 'Audience', value: 'Professionals' },
    { key: 'Style', value: 'Contemporary' },
    { key: 'Trend', value: 'Minimalist' },
    { key: 'Fitting', value: 'Regular' },
    { key: 'Material', value: 'High-grade Aluminum' }
  ]);
  const [storeAvailability, setStoreAvailability] = useState('Available in Dhanmondi, Banani, and Gulshan flagship stores.');
  const [returnPolicy, setReturnPolicy] = useState('7-day no-questions-asked return policy for manufacturing defects.');
  const [deliveryInfo, setDeliveryInfo] = useState('Next-day delivery within Dhaka. 3-5 days for outside Dhaka.');

  // Set content dynamically based on product id
  useEffect(() => {
    const details = mockProductDetails[id || '1'] || mockProductDetails['1'];
    setProductInfo({
      brandName: details.brandName,
      productName: details.productName,
      category: details.category,
      actualPrice: details.actualPrice,
      discountedPrice: details.discountedPrice,
      stockLimit: details.stockLimit,
      soldCount: details.soldCount,
      soldPercentage: details.soldPercentage
    });
    setImages(details.images);
    setTags(details.tags);
  }, [id]);

  const currentDetails = mockProductDetails[id || '1'] || mockProductDetails['1'];
  const sellerName = currentDetails.sellerName;
  const sellerInit = currentDetails.sellerInit;

  const isSuperAdmin = profile?.role === 'super_admin';
  const isSeller = profile?.role === 'seller';
  const isCreator = profile?.role === 'creator';
  
  // Checking if Aarong / Aarong Digital
  const isOwnProduct = isSeller && (
    (profile?.email?.includes('aarong') && (sellerName === 'Aarong Digital' || currentDetails.brandName === 'Aarong')) ||
    (sellerName === 'Aarong Digital' || currentDetails.brandName === 'Aarong')
  );

  const canEdit = isSuperAdmin || isOwnProduct;

  const handleStartEdit = () => {
    // Save backup of current states to support cancelling
    setBackupProduct({
      productInfo,
      images,
      mediaLinks,
      tags,
      about,
      pros,
      cons,
      specs,
      storeAvailability,
      returnPolicy,
      deliveryInfo
    });
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (backupProduct) {
      setProductInfo(backupProduct.productInfo);
      setImages(backupProduct.images);
      setMediaLinks(backupProduct.mediaLinks);
      setTags(backupProduct.tags);
      setAbout(backupProduct.about);
      setPros(backupProduct.pros);
      setCons(backupProduct.cons);
      setSpecs(backupProduct.specs);
      setStoreAvailability(backupProduct.storeAvailability);
      setReturnPolicy(backupProduct.returnPolicy);
      setDeliveryInfo(backupProduct.deliveryInfo);
    }
    setIsEditMode(false);
  };

  const handleUpdateInfo = (field: string, value: string | number) => {
    setProductInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagInput && tags.length < 6) {
      setTags([...tags, tagInput.startsWith('#') ? tagInput : `#${tagInput}`]);
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const addSpec = () => setSpecs([...specs, { key: '', value: '' }]);
  const updateSpec = (index: number, field: 'key' | 'value', val: string) => {
    const newSpecs = [...specs];
    newSpecs[index][field] = val;
    setSpecs(newSpecs);
  };
  const removeSpec = (index: number) => setSpecs(specs.filter((_, i) => i !== index));

  const addPro = () => setPros([...pros, '']);
  const updatePro = (index: number, val: string) => {
    const newPros = [...pros];
    newPros[index] = val;
    setPros(newPros);
  };

  const addCon = () => setCons([...cons, '']);
  const updateCon = (index: number, val: string) => {
    const newCons = [...cons];
    newCons[index] = val;
    setCons(newCons);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map((file: any) => URL.createObjectURL(file));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleAddMedia = () => setMediaLinks([...mediaLinks, '']);
  const updateMedia = (index: number, val: string) => {
    const newLinks = [...mediaLinks];
    newLinks[index] = val;
    setMediaLinks(newLinks);
  };
  const removeMedia = (index: number) => setMediaLinks(mediaLinks.filter((_, i) => i !== index));

  const inputClass = (highlight = false) => `w-full bg-app-sidebar border rounded-xl px-4 py-3 text-sm outline-none transition-all ${
    isEditMode 
      ? `bg-app-sidebar/80 text-white cursor-text ${highlight ? 'border-[#EB4501] focus:border-[#EB4501]' : 'border-app-accent/40 focus:border-app-accent focus:ring-1 focus:ring-app-accent/20'}` 
      : 'border-app-border bg-app-card/30 text-slate-400 cursor-not-allowed opacity-80'
  }`;

  const textareaClass = `w-full bg-app-sidebar border rounded-2xl p-6 text-sm leading-relaxed outline-none transition-all ${
    isEditMode 
      ? 'border-app-accent/40 focus:border-app-accent bg-app-sidebar/85 text-white cursor-text' 
      : 'border-app-border bg-app-card/30 text-slate-400 cursor-not-allowed opacity-80'
  }`;

  return (
    <div className="space-y-8 pb-20">
      {/* Dynamic Toast Message */}
      {toastMessage && (
        <div className="fixed top-8 right-8 z-[100] bg-[#EB4501] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl tracking-wide uppercase border border-white/10 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/products')}
            className="p-2.5 bg-app-card border border-app-border rounded-xl text-app-text-secondary hover:text-white transition-all shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{productInfo.productName}</h1>
              <span className="px-3 py-1 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-bold uppercase tracking-widest">LIVE</span>
            </div>
            <p className="text-app-text-secondary text-sm mt-1 flex items-center gap-2">
              <span className="opacity-50 font-bold uppercase tracking-widest text-[10px]">Product SKU:</span>
              <span className="font-mono text-app-accent-light">CHO-942-{id?.slice(-4).toUpperCase() || 'PROD'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-app-border text-white rounded-xl text-xs font-bold transition-all hover:bg-white/10">
            <ExternalLink className="w-4 h-4" /> View Live
          </button>
          
          {!isEditMode ? (
            canEdit ? (
              <button 
                onClick={handleStartEdit}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#EB4501] hover:bg-[#EB4501]/85 text-white rounded-xl text-xs font-bold transition-all shadow-xl shadow-[#EB4501]/20 active:scale-95"
              >
                <Edit3 className="w-4 h-4" /> Edit Product
              </button>
            ) : (
              <button 
                disabled
                title={isCreator ? "Only Super Admins and the listing Brand Seller can edit products." : "Sellers can only modify their own assigned brand products."}
                className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/5 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed"
              >
                <Lock className="w-4 h-4" /> Edit Restricted
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/5 text-slate-300 rounded-xl text-xs font-bold transition-all hover:bg-white/20"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsEditMode(false);
                  setToastMessage('✓ Catalog details updated successfully');
                  setTimeout(() => setToastMessage(null), 3500);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-app-accent hover:bg-app-accent-light text-white rounded-xl text-xs font-bold transition-all shadow-xl shadow-app-accent/20 active:scale-95"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header Level Mode Indicator */}
      {!isEditMode ? (
        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">👁️ Viewing Product</span>
          </div>
          <p className="text-[10px] text-app-text-secondary font-medium">
            {isCreator 
              ? '✓ Content Creator linked view • Direct edit disabled' 
              : isSeller && !isOwnProduct 
                ? '⚠️ Managed by another brand • Editing is restricted' 
                : canEdit 
                  ? '✓ Authorized to Edit • Click "Edit Product" to unlock' 
                  : 'Read-only mode'}
          </p>
        </div>
      ) : (
        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-extrabold text-orange-400 uppercase tracking-widest">📝 Editing Product</span>
          </div>
          <p className="text-[10px] text-orange-300 font-semibold uppercase tracking-wider">Highlighting editable fields • Intentional Mode</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-app-border scrollbar-hide overflow-x-auto">
        {[
          { id: 'Overview & Content', icon: LayoutGrid },
          { id: 'Specifications', icon: Package },
          { id: 'Reviews', icon: MessageSquare },
          { id: 'Analytics', icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-8 py-4 text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'active-tab-item text-app-accent-light border-b-2 border-app-accent bg-app-accent/5' 
                : 'text-app-text-secondary hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Editing Area */}
        <div className="xl:col-span-2 space-y-8">
          {activeTab === 'Overview & Content' && (
            <div className="space-y-8">
              {/* Basic Information (Editable Inline) */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-app-accent/10 flex items-center justify-center text-app-accent">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Basic Information</h3>
                    <p className="text-[11px] text-app-text-secondary font-bold uppercase tracking-widest mt-1">Foundational product details</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest ml-1 opacity-50">Brand Name</label>
                    <input 
                      disabled={!isEditMode}
                      value={productInfo.brandName}
                      onChange={(e) => handleUpdateInfo('brandName', e.target.value)}
                      className={inputClass()}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest ml-1 opacity-50">Product Name</label>
                    <input 
                      disabled={!isEditMode}
                      value={productInfo.productName}
                      onChange={(e) => handleUpdateInfo('productName', e.target.value)}
                      className={inputClass(true)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest ml-1 opacity-50">Actual Price (BDT)</label>
                    <input 
                      disabled={!isEditMode}
                      type="number"
                      value={productInfo.actualPrice}
                      onChange={(e) => handleUpdateInfo('actualPrice', Number(e.target.value))}
                      className={inputClass()}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest ml-1 opacity-50">Discounted Price (BDT)</label>
                    <input 
                      disabled={!isEditMode}
                      type="number"
                      value={productInfo.discountedPrice}
                      onChange={(e) => handleUpdateInfo('discountedPrice', Number(e.target.value))}
                      className={inputClass(true)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest ml-1 opacity-50">Stock Limit</label>
                    <input 
                      disabled={!isEditMode}
                      type="number"
                      value={productInfo.stockLimit}
                      onChange={(e) => handleUpdateInfo('stockLimit', Number(e.target.value))}
                      className={inputClass()}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest ml-1 opacity-50">Sold Count</label>
                    <input 
                      disabled={!isEditMode}
                      type="number"
                      value={productInfo.soldCount}
                      onChange={(e) => handleUpdateInfo('soldCount', Number(e.target.value))}
                      className={inputClass()}
                    />
                  </div>
                </div>
              </section>

              {/* Product Images Section */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                      <ImageIcon className="w-5 h-5 text-app-accent" />
                      Product Images
                    </h3>
                    <p className="text-[11px] text-app-text-secondary font-bold uppercase tracking-widest mt-1">High-quality visual representation</p>
                  </div>
                  {isEditMode && (
                    <label className="flex items-center gap-2 px-4 py-2 bg-app-accent/10 text-app-accent-light border border-app-accent/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-app-accent/20 transition-all cursor-pointer">
                      <Plus className="w-4 h-4" /> Add Photos
                      <input type="file" multiple className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {images.map((img, i) => (
                    <motion.div 
                      key={i} 
                      layout
                      className="relative group aspect-square rounded-2xl overflow-hidden bg-app-sidebar border border-app-border"
                    >
                      <img src={img} className="w-full h-full object-cover" />
                      {isEditMode && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            onClick={() => removeImage(i)}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {images.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-app-border rounded-[2rem]">
                      <ImageIcon className="w-12 h-12 text-app-text-secondary opacity-10 mb-4" />
                      <p className="text-xs text-app-text-secondary font-bold uppercase">No images uploaded</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Media & Embed Links */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                      <Film className="w-5 h-5 text-blue-500" />
                      Social Media & Video Links
                    </h3>
                    <p className="text-[11px] text-app-text-secondary font-bold uppercase tracking-widest mt-1">Engage users with interactive content</p>
                  </div>
                  {isEditMode && (
                    <button 
                      onClick={handleAddMedia}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all font-bold"
                    >
                      <Plus className="w-4 h-4" /> Add Link
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {mediaLinks.map((link, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-1 relative group">
                          <Film className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-40" />
                          <input 
                            disabled={!isEditMode}
                            value={link}
                            onChange={(e) => updateMedia(i, e.target.value)}
                            placeholder="Paste YouTube, Instagram, or TikTok link"
                            className={inputClass()}
                          />
                        </div>
                        {isEditMode && (
                          <button 
                            onClick={() => removeMedia(i)}
                            className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all font-bold"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Live Preview Placeholder */}
                      {link.trim() && (
                        <div className="aspect-video w-full max-w-md bg-app-sidebar rounded-2xl border border-app-border overflow-hidden flex flex-col items-center justify-center p-4">
                          <div className="p-3 bg-white/5 rounded-full mb-3">
                            <ExternalLink className="w-6 h-6 text-app-text-secondary opacity-50" />
                          </div>
                          <p className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest text-center px-4">Preview for: {link.slice(0, 50)}...</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Best For TagsSection */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                      <Sparkles className="w-5 h-5 text-green-500" />
                      Best For Tags
                    </h3>
                    <p className="text-[11px] text-app-text-secondary font-bold uppercase tracking-widest mt-1">Smart categorization for better discovery</p>
                  </div>
                  <span className="text-[10px] font-bold text-app-text-secondary opacity-40">{tags.length}/6 Used</span>
                </div>

                <div className="flex flex-wrap gap-3 mb-6">
                  {tags.map((tag, i) => (
                    <motion.div 
                      key={tag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl text-[12px] font-bold tracking-tight shadow-lg shadow-green-500/5 group"
                    >
                      {tag}
                      {isEditMode && (
                        <button onClick={() => removeTag(i)} className="p-1 hover:bg-green-500/20 rounded-lg transition-colors font-bold text-[10px] uppercase">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>

                {isEditMode && tags.length < 6 && (
                  <form onSubmit={handleAddTag} className="flex gap-2">
                    <div className="relative flex-1 group">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-40 group-focus-within:opacity-100 transition-all font-bold" />
                      <input 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Add discovery tag (e.g. #PerformanceKing)"
                        className="w-full bg-app-sidebar border border-app-border rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-app-accent/40 transition-all font-semibold font-medium"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="px-6 bg-[#EB4501] border border-white/5 text-white rounded-xl text-xs font-bold hover:bg-[#EB4501]/90 transition-all"
                    >
                      Add Tag
                    </button>
                  </form>
                )}
              </section>

              {/* About This Product */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">About This Product</h3>
                    <p className="text-[11px] text-app-text-secondary font-bold uppercase tracking-widest">Storytelling for your product</p>
                  </div>
                </div>
                <div className="relative group">
                  <textarea 
                    disabled={!isEditMode}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    rows={6}
                    className={textareaClass}
                  />
                </div>
              </section>

              {/* Pros & Cons Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      What We Like (Pros)
                    </h3>
                    {isEditMode && (
                      <button onClick={addPro} className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20"><Plus className="w-4 h-4"/></button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {pros.map((pro, i) => (
                      <div key={i} className="flex gap-2 group">
                          <input 
                            disabled={!isEditMode}
                            value={pro}
                            onChange={(e) => updatePro(i, e.target.value)}
                            className={inputClass(true)}
                          />
                          {isEditMode && (
                            <button onClick={() => setPros(pros.filter((_, idx) => idx !== i))} className="p-3 text-red-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4"/></button>
                          )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                      <XCircle className="w-5 h-5 text-red-500" />
                      To Consider (Cons)
                    </h3>
                    {isEditMode && (
                      <button onClick={addCon} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><Plus className="w-4 h-4"/></button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {cons.map((con, i) => (
                      <div key={i} className="flex gap-2 group">
                          <input 
                            disabled={!isEditMode}
                            value={con}
                            onChange={(e) => updateCon(i, e.target.value)}
                            className={inputClass(true)}
                          />
                          {isEditMode && (
                            <button onClick={() => setCons(cons.filter((_, idx) => idx !== i))} className="p-3 text-red-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4"/></button>
                          )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'Specifications' && (
            <div className="space-y-8">
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Technical Specifications</h3>
                    <p className="text-[11px] text-app-text-secondary font-bold uppercase tracking-widest mt-1">Key attributes and hardware details</p>
                  </div>
                  {isEditMode && (
                    <button 
                      onClick={addSpec}
                      className="flex items-center gap-2 px-4 py-2 bg-app-accent/10 text-app-accent-light border border-app-accent/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-app-accent/20 transition-all font-bold"
                    >
                      <Plus className="w-4 h-4" /> Add Spec
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {specs.map((spec, i) => (
                    <div key={i} className="flex gap-4 group">
                        <div className="flex-1">
                          <input 
                            disabled={!isEditMode}
                            value={spec.key}
                            onChange={(e) => updateSpec(i, 'key', e.target.value)}
                            placeholder="Specification key"
                            className={inputClass(true)}
                          />
                        </div>
                        <div className="flex-[2]">
                          <input 
                            disabled={!isEditMode}
                            value={spec.value}
                            onChange={(e) => updateSpec(i, 'value', e.target.value)}
                            placeholder="Value"
                            className={inputClass()}
                          />
                        </div>
                        {isEditMode && (
                          <button 
                            onClick={() => removeSpec(i)}
                            className="p-3 bg-red-500/10 text-red-500 border border-red-500/10 rounded-xl hover:bg-red-500/20 transition-all font-bold"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Store & Policies merged into Specs tab as requested */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                  <div className="flex items-center gap-3 mb-8">
                    <Search className="w-6 h-6 text-app-accent" />
                    <h3 className="text-lg font-bold text-white tracking-tight">Store Availability</h3>
                  </div>
                  <textarea 
                    disabled={!isEditMode}
                    value={storeAvailability}
                    onChange={(e) => setStoreAvailability(e.target.value)}
                    rows={2}
                    className={textareaClass}
                  />
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                    <div className="flex items-center gap-3 mb-8">
                      <RotateCcw className="w-6 h-6 text-app-accent" />
                      <h3 className="text-lg font-bold text-white tracking-tight">Return & Refund</h3>
                    </div>
                    <textarea 
                      disabled={!isEditMode}
                      value={returnPolicy}
                      onChange={(e) => setReturnPolicy(e.target.value)}
                      rows={4}
                      className={textareaClass}
                    />
                </section>

                <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                    <div className="flex items-center gap-3 mb-8">
                      <Truck className="w-6 h-6 text-blue-500" />
                      <h3 className="text-lg font-bold text-white tracking-tight">Delivery Info</h3>
                    </div>
                    <textarea 
                      disabled={!isEditMode}
                      value={deliveryInfo}
                      onChange={(e) => setDeliveryInfo(e.target.value)}
                      rows={4}
                      className={textareaClass}
                    />
                </section>
              </div>
            </div>
          )}

          {activeTab === 'Reviews' && (
            <section className="bg-app-card border border-app-border rounded-[2rem] p-12 shadow-2xl text-center">
              <div className="w-20 h-20 bg-app-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-app-accent" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Customer Reviews</h3>
              <p className="text-app-text-secondary max-w-sm mx-auto">Manage and respond to customer feedback directly from this panel.</p>
              <div className="mt-8 pt-8 border-t border-app-border grid grid-cols-3 gap-4">
                <div className="p-4 bg-app-sidebar rounded-2xl border border-app-border">
                  <div className="text-2xl font-bold text-white">4.8</div>
                  <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">Avg Rating</div>
                </div>
                <div className="p-4 bg-app-sidebar rounded-2xl border border-app-border">
                  <div className="text-2xl font-bold text-white">124</div>
                  <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">Total Reviews</div>
                </div>
                <div className="p-4 bg-app-sidebar rounded-2xl border border-app-border">
                  <div className="text-2xl font-bold text-white">98%</div>
                  <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">Positive</div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Analytics' && (
            <section className="bg-app-card border border-app-border rounded-[2rem] p-12 shadow-2xl text-center">
              <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-10 h-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Performance Analytics</h3>
              <p className="text-app-text-secondary max-w-sm mx-auto">Detailed insights into page views, conversions, and sales performance over time.</p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="h-40 bg-app-sidebar rounded-2xl border border-app-border animate-pulse flex items-center justify-center text-app-text-secondary text-[10px] font-bold uppercase tracking-widest uppercase">Growth Chart Rendering...</div>
                <div className="h-40 bg-app-sidebar rounded-2xl border border-app-border animate-pulse flex items-center justify-center text-app-text-secondary text-[10px] font-bold uppercase tracking-widest uppercase">Conversion Funnel Rendering...</div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
             <h3 className="text-sm font-bold text-app-text-secondary uppercase tracking-[0.2em] mb-8">Quick Stats</h3>
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[12px] font-bold text-app-text-secondary uppercase tracking-widest">Live Status</span>
                   </div>
                   <span className="text-[11px] font-bold text-white">Active (94 days)</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-app-accent" />
                      <span className="text-[12px] font-bold text-app-text-secondary uppercase tracking-widest">Conversion</span>
                   </div>
                   <span className="text-[11px] font-bold text-white">4.2% (High)</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-[12px] font-bold text-app-text-secondary uppercase tracking-widest">Views (7D)</span>
                   </div>
                   <span className="text-[11px] font-bold text-white">1,204 visitors</span>
                </div>
             </div>
          </section>

          <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
             <h3 className="text-sm font-bold text-app-text-secondary uppercase tracking-[0.2em] mb-8">Seller Info</h3>
             <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-app-sidebar border border-app-border flex items-center justify-center text-app-accent text-lg font-bold">TZ</div>
                <div>
                   <div className="text-[14px] font-bold text-white">TechZone BD</div>
                   <div className="text-[10px] text-app-text-secondary font-bold uppercase tracking-widest mt-1">Platinum Seller</div>
                </div>
             </div>
             <button className="w-full py-3 bg-white/5 border border-app-border rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                Contact Seller <ChevronRight className="w-4 h-4" />
             </button>
          </section>

          <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl border-dashed">
             <div className="text-center py-6">
                <Settings className="w-8 h-8 text-app-text-secondary opacity-20 mx-auto mb-4" />
                <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-2">Delete Product</h4>
                <p className="text-[10px] text-app-text-secondary mb-4 italic">Irreversible action - removes all associations</p>
                <button className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest underline decoration-red-500/20 underline-offset-4">
                   Destroy Record
                </button>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}
