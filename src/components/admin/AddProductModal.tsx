import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  X, 
  Upload, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  Image as ImageIcon, 
  Film,
  CheckCircle2,
  Package,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';

const productSchema = z.object({
  brandName: z.string().min(1, 'Brand is required'),
  customBrand: z.string().optional(),
  productName: z.string().min(3, 'Product name must be at least 3 characters'),
  actualPrice: z.number().min(0, 'Price cannot be negative'),
  discountedPrice: z.number().min(0, 'Discounted price cannot be negative'),
  stockLimit: z.number().min(0, 'Stock cannot be negative'),
  soldPercentage: z.number().min(0).max(100, 'Percentage must be between 0 and 100'),
  category: z.string().min(1, 'Category is required'),
});

type ProductFormData = z.infer<typeof productSchema>;

const categories = ['Mobile', 'Electronics', 'Fashion', 'Home', 'Beauty', 'Sports'];
const brands = ['Samsung BD', 'Walton', 'Aarong', 'Vision', 'Xiaomi', 'Apple'];

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export default function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const { profile, sellerBrands, allBrands } = useAuth();
  const [step, setStep] = useState(1);
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [mediaLinks, setMediaLinks] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sellerRelations = sellerBrands.filter(r => r.seller_user_id === profile?.id);
  const sellerBrandsList = allBrands.filter(b => sellerRelations.some(r => r.brand_id === b.id));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      soldPercentage: 0,
      actualPrice: 0,
      discountedPrice: 0,
      stockLimit: 0,
    }
  });

  const selectedBrand = watch('brandName');

  const handleNext = () => setStep(2);
  const handleBack = () => setStep(1);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map((file: any) => URL.createObjectURL(file));
      setImages(prev => [...prev, ...newImages].slice(0, 8));
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLink = () => setMediaLinks([...mediaLinks, '']);
  const handleRemoveLink = (index: number) => setMediaLinks(mediaLinks.filter((_, i) => i !== index));
  const handleLinkChange = (index: number, val: string) => {
    const newLinks = [...mediaLinks];
    newLinks[index] = val;
    setMediaLinks(newLinks);
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    onSuccess({ ...data, images, mediaLinks: mediaLinks.filter(l => l.trim()), status: 'Pending', createdAt: new Date() });
    setIsSubmitting(false);
    onClose();
    setStep(1);
    setImages([]);
    setMediaLinks(['']);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#06101B]/80 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-app-card border border-app-border rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-app-border flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-app-accent/10 flex items-center justify-center text-app-accent">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Add New Product</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-1 w-8 rounded-full transition-all ${step === 1 ? 'bg-app-accent' : 'bg-app-accent/20'}`} />
                <div className={`h-1 w-8 rounded-full transition-all ${step === 2 ? 'bg-app-accent' : 'bg-app-accent/20'}`} />
                <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-widest ml-1">Step {step} of 2</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-app-text-secondary transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-8 max-h-[70vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Brand Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest">Brand Name</label>
                      {!isAddingBrand ? (
                        <div className="space-y-2">
                          <select 
                            {...register('brandName')}
                            onChange={(e) => {
                              if (e.target.value === 'new') {
                                setIsAddingBrand(true);
                                setValue('brandName', '');
                              } else {
                                register('brandName').onChange(e);
                              }
                            }}
                            className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40 transition-all cursor-pointer"
                          >
                            <option value="">Select Brand</option>
                            {profile?.role === 'seller' ? (
                              sellerBrandsList.map(b => <option key={b.name} value={b.name}>{b.name}</option>)
                            ) : (
                              brands.map(b => <option key={b} value={b}>{b}</option>)
                            )}
                            {profile?.role !== 'seller' && <option value="new">+ Add New Brand</option>}
                          </select>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input 
                            {...register('customBrand')}
                            placeholder="Enter brand name"
                            className="flex-1 bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40"
                          />
                          <button 
                            type="button"
                            onClick={() => setIsAddingBrand(false)}
                            className="p-3 bg-white/5 rounded-xl text-app-text-secondary hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {errors.brandName && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.brandName.message}</p>}
                    </div>

                    {/* Product Name */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest">Product Name</label>
                      <input 
                        {...register('productName')}
                        placeholder="e.g. Galaxy S24 Ultra"
                        className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40 transition-all"
                      />
                      {errors.productName && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.productName.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Actual Price */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest">Actual Price (BDT)</label>
                      <input 
                        type="number"
                        {...register('actualPrice', { valueAsNumber: true })}
                        className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40 transition-all"
                      />
                      {errors.actualPrice && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.actualPrice.message}</p>}
                    </div>

                    {/* Discounted Price */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest">Discounted Price (BDT)</label>
                      <input 
                        type="number"
                        {...register('discountedPrice', { valueAsNumber: true })}
                        className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40 transition-all"
                      />
                      {errors.discountedPrice && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.discountedPrice.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Stock */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest">Stock Limit</label>
                      <input 
                        type="number"
                        {...register('stockLimit', { valueAsNumber: true })}
                        className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40 transition-all"
                      />
                      {errors.stockLimit && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.stockLimit.message}</p>}
                    </div>

                    {/* Sold % */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest">Sold %</label>
                      <input 
                        type="number"
                        {...register('soldPercentage', { valueAsNumber: true })}
                        className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40 transition-all"
                      />
                      {errors.soldPercentage && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.soldPercentage.message}</p>}
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest">Category</label>
                      <select 
                        {...register('category')}
                        className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-app-accent/40 transition-all"
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {errors.category && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.category.message}</p>}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {/* Image Upload */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-app-accent" />
                        Product Images ({images.length}/8)
                      </label>
                      <span className="text-[10px] font-bold text-app-text-secondary opacity-50 uppercase">Max 8 images</span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      {images.map((img, i) => (
                        <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden bg-app-sidebar border border-app-border">
                          <img src={img} className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {images.length < 8 && (
                        <label className="aspect-square rounded-2xl border-2 border-dashed border-app-border bg-white/[0.02] hover:bg-white/[0.05] hover:border-app-accent/40 transition-all flex flex-col items-center justify-center cursor-pointer group">
                          <Upload className="w-6 h-6 text-app-text-secondary group-hover:text-app-accent mb-2 transition-colors" />
                          <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Upload</span>
                          <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Multiple Media Links */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-app-text-secondary uppercase tracking-widest flex items-center gap-2">
                        <Film className="w-4 h-4 text-app-accent" />
                        Embedded Media / Social Links
                      </label>
                      <button 
                        type="button"
                        onClick={handleAddLink}
                        className="p-1 px-2.5 bg-app-accent/10 border border-app-accent/20 text-app-accent-light rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-app-accent/20 transition-all"
                      >
                         <Plus className="w-3 h-3 inline mr-1" /> Add Link
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {mediaLinks.map((link, i) => (
                        <div key={i} className="flex gap-2">
                          <div className="relative flex-1 group">
                            <input 
                              value={link}
                              onChange={(e) => handleLinkChange(i, e.target.value)}
                              placeholder="YouTube, Instagram Reel, TikTok, Facebook link"
                              className="w-full bg-app-sidebar border border-app-border rounded-xl p-4 pl-12 text-white text-sm outline-none focus:border-app-accent/40 transition-all"
                            />
                            <Film className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-app-text-secondary opacity-40 group-focus-within:opacity-100 transition-all" />
                          </div>
                          {mediaLinks.length > 1 && (
                            <button 
                              type="button"
                              onClick={() => handleRemoveLink(i)}
                              className="p-4 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-app-text-secondary italic opacity-60">Paste full URLs from YouTube, Instagram, or TikTok for interactive previews.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-app-border bg-white/[0.02] flex items-center justify-between gap-4">
            {step === 1 ? (
              <>
                <div className="flex items-center gap-2 text-[10px] text-app-text-secondary font-bold uppercase">
                  <AlertCircle className="w-4 h-4" /> Basic information is required
                </div>
                <button 
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
                >
                  Continue to Media <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button 
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-2 text-app-text-secondary hover:text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Info
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-light text-white px-8 py-3 rounded-2xl text-sm font-extrabold transition-all shadow-xl shadow-app-accent/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    'Saving Product...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Save & Submit Review
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
