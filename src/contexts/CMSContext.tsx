import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  order: number;
}

export interface SocialLink {
  id: string;
  platform: 'Facebook' | 'Instagram' | 'YouTube' | 'TikTok' | 'WhatsApp';
  url: string;
  isVisible: boolean;
}

export interface HeroBanner {
  id: string;
  headline: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
  backgroundImage: string;
  textAlignment: 'left' | 'center' | 'right';
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  order: number;
}

export interface HomepageSection {
  id: string;
  label: string;
  isVisible: boolean;
  order: number;
  isLocked?: boolean; // locked sections cannot be deleted
}

export interface FooterColumn {
  id: string;
  title: string;
  links: { label: string; url: string }[];
}

export interface FooterData {
  description: string;
  copyrightText: string;
  columns: FooterColumn[];
  showPaymentIcons: boolean;
  showDeliveryPartners: boolean;
  newsletterEnabled: boolean;
}

export interface SEOEntry {
  pageId: string;
  pageLabel: string;
  title: string;
  metaDescription: string;
  keywords: string;
  ogImage: string;
  canonicalUrl: string;
}

export interface ProductBadge {
  id: string;
  label: string;
  color: string; // hex or tailwind bg class
  icon?: string; // lucide icon name string
  priority: number;
  isActive: boolean;
}

export interface SocialPlatform {
  id: string;
  platform: string;
  url: string;
  isVisible: boolean;
  order: number;
}

export interface WebsiteAssets {
  navbarLogo: string;
  footerLogo: string;
  favicon: string;
  pwaIcon: string;
  defaultProductImage: string;
}

export interface GlobalWebsiteSettings {
  websiteName: string;
  defaultCurrency: string;
  timezone: string;
  contactEmail: string;
  supportPhone: string;
  announcementBarText: string;
  announcementBarEnabled: boolean;
  maintenanceMode: boolean;
}

export interface PopularSearch {
  id: string;
  term: string;
  order: number;
  isActive: boolean;
}

export interface CMSActivityLog {
  id: string;
  adminName: string;
  action: string;
  workspace: string;
  previousValue: string;
  newValue: string;
  timestamp: string;
}

export interface CMSData {
  logos: {
    header: string;
    footer: string;
  };
  navigation: NavItem[];
  socialLinks: SocialLink[];
  heroBanners?: HeroBanner[];
  homepageSections?: HomepageSection[];
  footer?: FooterData;
  seoEntries?: SEOEntry[];
  productBadges?: ProductBadge[];
  extendedSocialLinks?: SocialPlatform[];
  websiteAssets?: WebsiteAssets;
  globalSettings?: GlobalWebsiteSettings;
  popularSearches?: PopularSearch[];
  cmsActivityLog?: CMSActivityLog[];
}

interface CMSContextType {
  cmsData: CMSData;
  loading: boolean;
  updateCMSData: (data: Partial<CMSData>) => Promise<void>;
}

const defaultCMSData: CMSData = {
  logos: {
    header: '',
    footer: ''
  },
  navigation: [
    { id: '1', label: 'Curated Products', path: '/products', order: 0 },
    { id: '2', label: 'Expert Guides', path: '/recommendations', order: 1 },
    { id: '3', label: 'Exclusive Deals', path: '/deals', order: 2 }
  ],
  socialLinks: [
    { id: '1', platform: 'Facebook', url: 'https://facebook.com', isVisible: true },
    { id: '2', platform: 'Instagram', url: 'https://instagram.com', isVisible: true },
    { id: '3', platform: 'YouTube', url: 'https://youtube.com', isVisible: true },
    { id: '4', platform: 'TikTok', url: 'https://tiktok.com', isVisible: false },
    { id: '5', platform: 'WhatsApp', url: 'https://wa.me', isVisible: false }
  ],
  heroBanners: [
    { id: '1', headline: "Bangladesh's Most Trusted Product Discovery Platform", subtitle: 'Find verified brands, expert guides, and exclusive deals — all in one place.', ctaText: 'Explore Products', ctaUrl: '/products', backgroundImage: '', textAlignment: 'center', isActive: true, order: 0 }
  ],
  homepageSections: [
    { id: 'hero', label: 'Hero Banner', isVisible: true, order: 0, isLocked: true },
    { id: 'categories', label: 'Featured Categories', isVisible: true, order: 1 },
    { id: 'trending', label: 'Trending Products', isVisible: true, order: 2 },
    { id: 'featured-brands', label: 'Featured Brands', isVisible: true, order: 3 },
    { id: 'deals', label: 'Flash Deals', isVisible: true, order: 4 },
    { id: 'creators', label: 'Featured Creators', isVisible: true, order: 5 },
    { id: 'recommended', label: 'Recommended For You', isVisible: false, order: 6 },
    { id: 'newsletter', label: 'Newsletter Banner', isVisible: true, order: 7 },
    { id: 'footer-promo', label: 'Footer Promotions', isVisible: false, order: 8 },
  ],
  footer: {
    description: "Bangladesh's most trusted curated product discovery platform. Find verified brands, honest reviews, and exclusive deals.",
    copyrightText: '© 2025 Choosify Bangladesh. All rights reserved.',
    columns: [
      { id: '1', title: 'Company', links: [{ label: 'About Us', url: '/about' }, { label: 'Careers', url: '/careers' }, { label: 'Press', url: '/press' }] },
      { id: '2', title: 'Help', links: [{ label: 'FAQ', url: '/faq' }, { label: 'Shipping Policy', url: '/shipping' }, { label: 'Refund Policy', url: '/refund' }] },
      { id: '3', title: 'Legal', links: [{ label: 'Privacy Policy', url: '/privacy' }, { label: 'Terms of Service', url: '/terms' }] },
      { id: '4', title: 'Contact', links: [{ label: 'Contact Us', url: '/contact' }, { label: 'Support', url: '/support' }] },
    ],
    showPaymentIcons: true,
    showDeliveryPartners: true,
    newsletterEnabled: true,
  },
  seoEntries: [
    { pageId: 'homepage', pageLabel: 'Homepage', title: "Choosify — Bangladesh's Trusted Product Discovery Platform", metaDescription: 'Discover verified brands, expert buying guides, and exclusive deals across fashion, electronics, food, and more.', keywords: 'online shopping bangladesh, verified brands, product discovery', ogImage: '', canonicalUrl: 'https://choosify.bd' },
    { pageId: 'brands', pageLabel: 'Brands Page', title: 'Verified Brands — Choosify Bangladesh', metaDescription: 'Browse all verified and trusted brands on Choosify Bangladesh.', keywords: 'brands bangladesh, verified sellers', ogImage: '', canonicalUrl: 'https://choosify.bd/brands' },
    { pageId: 'deals', pageLabel: 'Deals Page', title: 'Best Deals & Offers — Choosify Bangladesh', metaDescription: 'Find the best deals, flash sales, and promo codes from verified brands.', keywords: 'deals, offers, discounts bangladesh', ogImage: '', canonicalUrl: 'https://choosify.bd/deals' },
  ],
  productBadges: [
    { id: '1', label: 'New', color: '#22C55E', icon: 'Sparkles', priority: 1, isActive: true },
    { id: '2', label: 'Trending', color: '#F97316', icon: 'TrendingUp', priority: 2, isActive: true },
    { id: '3', label: 'Hot', color: '#EF4444', icon: 'Flame', priority: 3, isActive: true },
    { id: '4', label: 'Featured', color: '#8B5CF6', icon: 'Star', priority: 4, isActive: true },
    { id: '5', label: 'Verified', color: '#0F172A', icon: 'ShieldCheck', priority: 5, isActive: true },
    { id: '6', label: 'Flash Sale', color: '#F59E0B', icon: 'Zap', priority: 6, isActive: true },
  ],
  extendedSocialLinks: [
    { id: '1', platform: 'Facebook', url: 'https://facebook.com/choosifybd', isVisible: true, order: 0 },
    { id: '2', platform: 'Instagram', url: 'https://instagram.com/choosifybd', isVisible: true, order: 1 },
    { id: '3', platform: 'YouTube', url: 'https://youtube.com/@choosifybd', isVisible: false, order: 2 },
    { id: '4', platform: 'TikTok', url: '', isVisible: false, order: 3 },
    { id: '5', platform: 'WhatsApp', url: 'https://wa.me/8801XXXXXXXXX', isVisible: true, order: 4 },
    { id: '6', platform: 'LinkedIn', url: '', isVisible: false, order: 5 },
    { id: '7', platform: 'Telegram', url: '', isVisible: false, order: 6 },
  ],
  websiteAssets: {
    navbarLogo: '',
    footerLogo: '',
    favicon: '',
    pwaIcon: '',
    defaultProductImage: '',
  },
  globalSettings: {
    websiteName: 'Choosify Bangladesh',
    defaultCurrency: 'BDT',
    timezone: 'Asia/Dhaka',
    contactEmail: 'hello@choosify.bd',
    supportPhone: '+880 1800-CHOOSIFY',
    announcementBarText: '🎉 Welcome to Choosify Bangladesh — Discover trusted brands!',
    announcementBarEnabled: true,
    maintenanceMode: false,
  },
  popularSearches: [
    { id: '1', term: 'Samsung Mobile', order: 0, isActive: true },
    { id: '2', term: 'Aarong Panjabi', order: 1, isActive: true },
    { id: '3', term: 'Apex Shoes', order: 2, isActive: true },
    { id: '4', term: 'Organic Food', order: 3, isActive: true },
    { id: '5', term: 'Winter Collection', order: 4, isActive: true },
  ],
  cmsActivityLog: []
};

export const createCMSLogEntry = (
  adminName: string,
  action: string,
  workspace: string,
  previousValue: string,
  newValue: string
): CMSActivityLog => ({
  id: Date.now().toString(),
  adminName,
  action,
  workspace,
  previousValue,
  newValue,
  timestamp: new Date().toISOString(),
});

const CMSContext = createContext<CMSContextType | undefined>(undefined);

export const CMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cmsData, setCmsData] = useState<CMSData>(defaultCMSData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'cms'), (snapshot) => {
      if (snapshot.exists()) {
        setCmsData(snapshot.data() as CMSData);
      } else {
        // If it doesn't exist, we could initialize it or just use defaults
        // For now, use defaults but keep loading false
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/cms');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const updateCMSData = async (data: Partial<CMSData>) => {
    const path = 'settings/cms';
    try {
      const newData = { ...cmsData, ...data };
      await setDoc(doc(db, 'settings', 'cms'), newData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  return (
    <CMSContext.Provider value={{ cmsData, loading, updateCMSData }}>
      {children}
    </CMSContext.Provider>
  );
};

export const useCMS = () => {
  const context = useContext(CMSContext);
  if (!context) {
    throw new Error('useCMS must be used within a CMSProvider');
  }
  return context;
};
