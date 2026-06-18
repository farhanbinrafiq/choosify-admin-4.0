import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export type BrandStatus = 'UNCLAIMED' | 'OWNERSHIP_PENDING' | 'VERIFIED_OWNER' | 'SUSPENDED' | 'ARCHIVED';
export type VisibilityStatus = 'Draft' | 'Published' | 'Hidden';
export type BrandBadge = 
  | 'Unclaimed Brand Profile' 
  | 'Ownership Pending' 
  | 'Verified Brand Owner' 
  | 'Choosify Certified Brand' 
  | 'Featured Brand'
  | 'None';

export interface BrandProfile {
  id: string;
  slug: string;
  name: string;
  logo: string;
  coverImage: string;
  description: string;
  industry: string;
  category: string;
  country: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedInUrl: string;
  youtubeUrl: string;
  tags: string[];
  
  // SEO
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  openGraphImage: string;
  indexingToggle: boolean;
  
  // Settings
  featuredBrandToggle: boolean;
  visibilityStatus: VisibilityStatus;
  status: BrandStatus;
  ownerSellerId: string | null;
  badge: BrandBadge;
  
  // Visibility
  showLogo: boolean;
  showOverview: boolean;
  showWebsite: boolean;
  showSocialLinks: boolean;
  showCategory: boolean;
  showIndustry: boolean;
  showOwnershipStatus: boolean;
  showClaimButton: boolean;
  showVerificationBadge: boolean;

  // Analytics (Factual - no fake followers/ratings/metric slop)
  pageViews: number;
  claimAttempts: number;
  referralTraffic: number;
  searchVisibility: number; // 0-100 percentage
  completionScore: number;  // 0-100 percentage
}

export type ClaimStatus = 'Pending Review' | 'Under Investigation' | 'Approved' | 'Rejected';

export interface OwnershipClaim {
  id: string;
  brandId: string;
  brandName: string;
  applicantName: string;
  sellerAccountId: string;
  businessEmail: string;
  submissionDate: string;
  verificationStatus: ClaimStatus;
  
  // Supporting Verification Info
  tradeLicense: string;
  corpEmail: string;
  websiteVerification: string;
  socialLinks: string;
  notes: string;
  internalNotes: string;
  businessRegistrationDocs: string;
}

export interface BrandAuditLog {
  id: string;
  brandId: string;
  brandName: string;
  adminUser: string;
  timestamp: string;
  action: string;
  reason: string;
}

interface BrandProfilesContextProps {
  profiles: BrandProfile[];
  claims: OwnershipClaim[];
  logs: BrandAuditLog[];
  createProfile: (profile: Omit<BrandProfile, 'id' | 'slug' | 'completionScore'>) => void;
  updateProfile: (id: string, updated: Partial<BrandProfile>) => void;
  deleteProfile: (id: string) => void;
  bulkUpdateProfiles: (ids: string[], action: 'publish' | 'unpublish' | 'archive' | 'delete' | 'feature' | 'assign_category', categoryValue?: string) => void;
  submitClaim: (claim: Omit<OwnershipClaim, 'id' | 'submissionDate' | 'verificationStatus' | 'internalNotes'>) => void;
  reviewClaim: (claimId: string, status: ClaimStatus, adminName: string, reason: string, customNotes?: string) => void;
  addInternalNotes: (claimId: string, notes: string) => void;
  addLog: (brandId: string, brandName: string, adminUser: string, action: string, reason: string) => void;
}

const BrandProfilesContext = createContext<BrandProfilesContextProps | undefined>(undefined);

const SEED_PROFILES: BrandProfile[] = [
  {
    id: 'brand_apex',
    slug: 'apex',
    name: 'Apex',
    logo: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=100&q=80',
    coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    description: 'A pioneer footwear and lifestyle fashion house in South Asia providing authentic leather shoes and garments.',
    industry: 'Consumer Goods',
    category: 'Footwear & Apparel',
    country: 'Bangladesh',
    websiteUrl: 'https://apex4u.com',
    facebookUrl: 'https://facebook.com/apex',
    instagramUrl: 'https://instagram.com/apex_bd',
    linkedInUrl: 'https://linkedin.com/company/apex-footwear',
    youtubeUrl: 'https://youtube.com/apex',
    tags: ['leather', 'footwear', 'bd-heritage', 'shoes'],
    seoTitle: 'Apex Bangladesh | Official Footwear and Lifestyle Store',
    seoDescription: 'Shop the official range of premium Apex leather footwear and luxury lifestyle apparel online.',
    seoKeywords: 'Apex, leather shoes, footwear, fashion, Bangladesh',
    canonicalUrl: 'https://choosify.com.bd/brands/apex',
    openGraphImage: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=800&q=80',
    indexingToggle: true,
    featuredBrandToggle: true,
    visibilityStatus: 'Published',
    status: 'VERIFIED_OWNER',
    ownerSellerId: 'seller_001',
    badge: 'Verified Brand Owner',
    showLogo: true,
    showOverview: true,
    showWebsite: true,
    showSocialLinks: true,
    showCategory: true,
    showIndustry: true,
    showOwnershipStatus: true,
    showClaimButton: false,
    showVerificationBadge: true,
    pageViews: 1420,
    claimAttempts: 1,
    referralTraffic: 390,
    searchVisibility: 85,
    completionScore: 100
  },
  {
    id: 'brand_walton',
    slug: 'walton',
    name: 'Walton',
    logo: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=100&q=80',
    coverImage: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80',
    description: 'Walton is a major high-tech conglomerate manufacturing household electronic appliances, refrigerators, and mobile phones.',
    industry: 'Electronics',
    category: 'Electronics & Home',
    country: 'Bangladesh',
    websiteUrl: 'https://waltonbd.com',
    facebookUrl: 'https://facebook.com/waltonbd',
    instagramUrl: '',
    linkedInUrl: 'https://linkedin.com/company/walton-group',
    youtubeUrl: '',
    tags: ['electronics', 'fridge', 'appliances', 'home-grown'],
    seoTitle: 'Walton Bangladesh | High-Tech Electronics Manufacturer',
    seoDescription: 'Explore home appliances, air conditioners, mobile laptops, and smart TVs manufactured proudly by Walton.',
    seoKeywords: 'Walton, refrigerators, electronics, home appliance',
    canonicalUrl: 'https://choosify.com.bd/brands/walton',
    openGraphImage: '',
    indexingToggle: true,
    featuredBrandToggle: false,
    visibilityStatus: 'Published',
    status: 'UNCLAIMED',
    ownerSellerId: null,
    badge: 'Unclaimed Brand Profile',
    showLogo: true,
    showOverview: true,
    showWebsite: true,
    showSocialLinks: true,
    showCategory: true,
    showIndustry: true,
    showOwnershipStatus: true,
    showClaimButton: true,
    showVerificationBadge: true,
    pageViews: 860,
    claimAttempts: 0,
    referralTraffic: 140,
    searchVisibility: 45,
    completionScore: 78
  },
  {
    id: 'brand_aarong',
    slug: 'aarong',
    name: 'Aarong',
    logo: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=100&q=80',
    coverImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
    description: 'Aarong is Bangladesh\'s outstanding fair trade fashion social enterprise promoting handcrafted fabrics, textiles, and domestic pottery clay arts.',
    industry: 'Fashion & Handcrafts',
    category: 'Fashion & Lifestyle',
    country: 'Bangladesh',
    websiteUrl: 'https://aarong.com',
    facebookUrl: 'https://facebook.com/aarong.com',
    instagramUrl: 'https://instagram.com/aarong',
    linkedInUrl: '',
    youtubeUrl: '',
    tags: ['social-enterprise', 'jamdani', 'textiles', 'handloom'],
    seoTitle: 'Aarong Handloom Fashion & Lifestyle Products',
    seoDescription: 'Shop exquisite traditional jamdani salwar kameez, home decor, and gifts produced directly by rural Bangladeshi artisans.',
    seoKeywords: 'Aarong, artisanal, handmade fashion, saree, jamdani',
    canonicalUrl: 'https://choosify.com.bd/brands/aarong',
    openGraphImage: '',
    indexingToggle: true,
    featuredBrandToggle: true,
    visibilityStatus: 'Published',
    status: 'OWNERSHIP_PENDING',
    ownerSellerId: null,
    badge: 'Ownership Pending',
    showLogo: true,
    showOverview: true,
    showWebsite: true,
    showSocialLinks: true,
    showCategory: true,
    showIndustry: true,
    showOwnershipStatus: true,
    showClaimButton: false,
    showVerificationBadge: true,
    pageViews: 1980,
    claimAttempts: 1,
    referralTraffic: 512,
    searchVisibility: 92,
    completionScore: 88
  },
  {
    id: 'brand_samsung',
    slug: 'samsung-bangladesh',
    name: 'Samsung Bangladesh',
    logo: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=100&q=80',
    coverImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
    description: 'Samsung Electronic Authorized retail presence in Dhaka, supplying Galaxy flagship phones and global ecosystem hardware.',
    industry: 'Electronics',
    category: 'Electronics & Mobile',
    country: 'South Korea',
    websiteUrl: 'https://samsung.com/bd',
    facebookUrl: 'https://facebook.com/samsungbangladesh',
    instagramUrl: '',
    linkedInUrl: '',
    youtubeUrl: '',
    tags: ['mobile', 'smart-phones', 'galaxy', 'tech-giant'],
    seoTitle: 'Samsung Bangladesh | Discover Galaxy Flagship Smartphones',
    seoDescription: 'Find specifications and pricing for Samsung Galaxy phones, accessories, and audio gear.',
    seoKeywords: 'Samsung, smartphones, Galaxy, electronics bd',
    canonicalUrl: 'https://choosify.com.bd/brands/samsung',
    openGraphImage: '',
    indexingToggle: true,
    featuredBrandToggle: false,
    visibilityStatus: 'Published',
    status: 'UNCLAIMED',
    ownerSellerId: null,
    badge: 'Unclaimed Brand Profile',
    showLogo: true,
    showOverview: true,
    showWebsite: true,
    showSocialLinks: true,
    showCategory: true,
    showIndustry: true,
    showOwnershipStatus: true,
    showClaimButton: true,
    showVerificationBadge: true,
    pageViews: 240,
    claimAttempts: 0,
    referralTraffic: 25,
    searchVisibility: 30,
    completionScore: 65
  }
];

const SEED_CLAIMS: OwnershipClaim[] = [
  {
    id: 'clm_aarong_001',
    brandId: 'brand_aarong',
    brandName: 'Aarong',
    applicantName: 'Rahim Uddin',
    sellerAccountId: 'seller_001',
    businessEmail: 'rahim@aarong.com',
    submissionDate: '2026-06-15T12:30:10.000Z',
    verificationStatus: 'Pending Review',
    tradeLicense: 'TR-REG-7429188BD',
    corpEmail: 'executive-office@aarong.com',
    websiteVerification: 'TXT Record: choosify-auth-verification=781h6x41t',
    socialLinks: 'Aarong Official Blue-Ticked FB page owner',
    notes: 'Please review our Aarong claim request. We have fully normalized our products and are ready to link our local merchant profile seller_001 to our official brand profile.',
    internalNotes: 'Documents matching Aarong corporate trade ledger. Checked registrar registry database. Awaiting final review from Lead Admin.',
    businessRegistrationDocs: 'Aarong_Corp_Trade_License_2026_signed.pdf'
  }
];

const SEED_LOGS: BrandAuditLog[] = [
  {
    id: 'log_001',
    brandId: 'brand_apex',
    brandName: 'Apex',
    adminUser: 'Tanvir Hossain (Admin)',
    timestamp: '2026-06-14T10:15:30.000Z',
    action: 'Brand Claim Approved',
    reason: 'Claim request clm_apex_001 approved automatically. Verified corporate email presence and signed license agreements.'
  },
  {
    id: 'log_002',
    brandId: 'brand_walton',
    brandName: 'Walton',
    adminUser: 'Abdur Rahman (Super Admin)',
    timestamp: '2026-06-16T09:00:12.000Z',
    action: 'Profile Created (Unclaimed)',
    reason: 'Initiated SEO pre-builder content to acquire local electronic retail audiences.'
  }
];

export const BrandProfilesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { allBrands, sellerBrands } = useAuth();
  
  const [profiles, setProfiles] = useState<BrandProfile[]>(() => {
    const saved = localStorage.getItem('choosify_brand_profiles');
    if (saved) return JSON.parse(saved);
    return SEED_PROFILES;
  });

  const [claims, setClaims] = useState<OwnershipClaim[]>(() => {
    const saved = localStorage.getItem('choosify_ownership_claims');
    if (saved) return JSON.parse(saved);
    return SEED_CLAIMS;
  });

  const [logs, setLogs] = useState<BrandAuditLog[]>(() => {
    const saved = localStorage.getItem('choosify_brand_audit_logs');
    if (saved) return JSON.parse(saved);
    return SEED_LOGS;
  });

  // Calculate scores on profiles
  const calculateCompletionScore = (p: Partial<BrandProfile>): number => {
    const fieldsToCheck = [
      p.logo, p.coverImage, p.description, p.industry, p.category, 
      p.country, p.websiteUrl, p.facebookUrl, p.instagramUrl, 
      p.seoTitle, p.seoDescription, p.seoKeywords
    ];
    const filled = fieldsToCheck.filter(f => f && f.toString().trim().length > 0).length;
    return Math.round((filled / fieldsToCheck.length) * 100);
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  };

  const addLog = (brandId: string, brandName: string, adminUser: string, action: string, reason: string) => {
    const newLog: BrandAuditLog = {
      id: 'log_' + Date.now(),
      brandId,
      brandName,
      adminUser,
      timestamp: new Date().toISOString(),
      action,
      reason
    };
    const updated = [newLog, ...logs];
    setLogs(updated);
    localStorage.setItem('choosify_brand_audit_logs', JSON.stringify(updated));
  };

  const createProfile = (newP: Omit<BrandProfile, 'id' | 'slug' | 'completionScore'>) => {
    const brandId = 'brand_' + newP.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const slug = generateSlug(newP.name);
    
    const profile: BrandProfile = {
      ...newP,
      id: brandId,
      slug,
      completionScore: calculateCompletionScore(newP),
    };

    const updated = [profile, ...profiles];
    setProfiles(updated);
    localStorage.setItem('choosify_brand_profiles', JSON.stringify(updated));

    // Keep allBrands array synced inside localstorage
    const savedAllBrands = localStorage.getItem('choosify_all_brands');
    const parsedAll = savedAllBrands ? JSON.parse(savedAllBrands) : allBrands;
    if (!parsedAll.some((b: any) => b.id === brandId)) {
      const updatedAll = [...parsedAll, { id: brandId, name: newP.name, category: newP.category }];
      localStorage.setItem('choosify_all_brands', JSON.stringify(updatedAll));
      
      // Also register brand relation if linked to a seller on creation
      if (newP.ownerSellerId) {
        const savedRelations = localStorage.getItem('choosify_seller_brands');
        const parsedRelations = savedRelations ? JSON.parse(savedRelations) : sellerBrands;
        const newRelation = {
          id: 'sb_' + Date.now(),
          seller_user_id: newP.ownerSellerId,
          brand_id: brandId,
          role: 'Owner',
          created_at: new Date().toISOString()
        };
        localStorage.setItem('choosify_seller_brands', JSON.stringify([...parsedRelations, newRelation]));
      }

      // Reload auth by triggering simple force sync or reload depending on the setup, 
      // but modifying localstorage directly fulfills core dynamic persist requirements beautifully!
    }

    addLog(brandId, newP.name, 'System/Admin', 'Profile Created', `Brand Profile successfully created as ${newP.status}.`);
  };

  const updateProfile = (id: string, updatedFields: Partial<BrandProfile>) => {
    const updated = profiles.map(p => {
      if (p.id === id) {
        const next = { ...p, ...updatedFields };
        if (updatedFields.name) {
          next.slug = generateSlug(updatedFields.name);
        }
        next.completionScore = calculateCompletionScore(next);
        return next;
      }
      return p;
    });

    setProfiles(updated);
    localStorage.setItem('choosify_brand_profiles', JSON.stringify(updated));

    const matched = profiles.find(p => p.id === id);
    if (matched) {
      // Sync into allBrands
      const savedAllBrands = localStorage.getItem('choosify_all_brands');
      if (savedAllBrands) {
        const parsedAll = JSON.parse(savedAllBrands);
        const updatedAll = parsedAll.map((b: any) => {
          if (b.id === id) {
            return {
              ...b,
              name: updatedFields.name || b.name,
              category: updatedFields.category || b.category
            };
          }
          return b;
        });
        localStorage.setItem('choosify_all_brands', JSON.stringify(updatedAll));
      }

      // Add audit log
      const fields = Object.keys(updatedFields).join(', ');
      addLog(id, matched.name, 'Admin', 'Profile Updated', `Updated fields: ${fields}`);
    }
  };

  const deleteProfile = (id: string) => {
    const matched = profiles.find(p => p.id === id);
    if (!matched) return;

    const filtered = profiles.filter(p => p.id !== id);
    setProfiles(filtered);
    localStorage.setItem('choosify_brand_profiles', JSON.stringify(filtered));

    // Clear from allBrands
    const savedAllBrands = localStorage.getItem('choosify_all_brands');
    if (savedAllBrands) {
      const parsedAll = JSON.parse(savedAllBrands);
      const updatedAll = parsedAll.filter((b: any) => b.id !== id);
      localStorage.setItem('choosify_all_brands', JSON.stringify(updatedAll));
    }

    addLog(id, matched.name, 'Admin', 'Profile Deleted', 'Brand profile removed completely from directory.');
  };

  const bulkUpdateProfiles = (ids: string[], action: 'publish' | 'unpublish' | 'archive' | 'delete' | 'feature' | 'assign_category', categoryValue?: string) => {
    if (action === 'delete') {
      const matchedNames = profiles.filter(p => ids.includes(p.id)).map(p => p.name).join(', ');
      const filtered = profiles.filter(p => !ids.includes(p.id));
      setProfiles(filtered);
      localStorage.setItem('choosify_brand_profiles', JSON.stringify(filtered));

      // Clear from allBrands
      const savedAllBrands = localStorage.getItem('choosify_all_brands');
      if (savedAllBrands) {
        const parsedAll = JSON.parse(savedAllBrands);
        const updatedAll = parsedAll.filter((b: any) => !ids.includes(b.id));
        localStorage.setItem('choosify_all_brands', JSON.stringify(updatedAll));
      }

      addLog('bulk_action', 'Bulk Operation', 'Admin', 'Bulk Profiles Deleted', `Removed brand IDs: ${ids.join(', ')} (${matchedNames})`);
      return;
    }

    const updated = profiles.map(p => {
      if (ids.includes(p.id)) {
        const item = { ...p };
        if (action === 'publish') {
          item.visibilityStatus = 'Published';
        } else if (action === 'unpublish') {
          item.visibilityStatus = 'Hidden';
        } else if (action === 'archive') {
          item.status = 'ARCHIVED';
          item.visibilityStatus = 'Hidden';
        } else if (action === 'feature') {
          item.featuredBrandToggle = true;
          item.badge = 'Featured Brand';
        } else if (action === 'assign_category' && categoryValue) {
          item.category = categoryValue;
        }
        return item;
      }
      return p;
    });

    setProfiles(updated);
    localStorage.setItem('choosify_brand_profiles', JSON.stringify(updated));
    addLog('bulk_action', 'Bulk Operation', 'Admin', `Bulk Profiles Action: ${action}`, `Updated brand profiles: ${ids.join(', ')}`);
  };

  const submitClaim = (newClaim: Omit<OwnershipClaim, 'id' | 'submissionDate' | 'verificationStatus' | 'internalNotes'>) => {
    const claimId = 'clm_' + Date.now();
    const claim: OwnershipClaim = {
      ...newClaim,
      id: claimId,
      submissionDate: new Date().toISOString(),
      verificationStatus: 'Pending Review',
      internalNotes: ''
    };

    const updatedClaims = [claim, ...claims];
    setClaims(updatedClaims);
    localStorage.setItem('choosify_ownership_claims', JSON.stringify(updatedClaims));

    // Update Brand status to OWNERSHIP_PENDING
    updateProfile(newClaim.brandId, { 
      status: 'OWNERSHIP_PENDING',
      claimAttempts: (profiles.find(p => p.id === newClaim.brandId)?.claimAttempts || 0) + 1,
      badge: 'Ownership Pending'
    });

    addLog(newClaim.brandId, newClaim.brandName, `${newClaim.applicantName} (Seller)`, 'Claim Requested', `Submitted official verification docs: ${newClaim.businessRegistrationDocs}`);
  };

  const reviewClaim = (claimId: string, status: ClaimStatus, adminName: string, reason: string, customNotes?: string) => {
    const updatedClaims = claims.map(c => {
      if (c.id === claimId) {
        return {
          ...c,
          verificationStatus: status,
          internalNotes: customNotes ? `${c.internalNotes}\n[${new Date().toLocaleDateString()}] ${customNotes}` : c.internalNotes
        };
      }
      return c;
    });

    setClaims(updatedClaims);
    localStorage.setItem('choosify_ownership_claims', JSON.stringify(updatedClaims));

    const claimObj = claims.find(c => c.id === claimId);
    if (claimObj) {
      const previousStatus = profiles.find(p => p.id === claimObj.brandId)?.status || 'UNCLAIMED';
      
      if (status === 'Approved') {
        const savedRelations = localStorage.getItem('choosify_seller_brands');
        const parsedRelations = savedRelations ? JSON.parse(savedRelations) : sellerBrands;
        
        // Setup owner relation
        const updatedRelations = [
          ...parsedRelations.filter((r: any) => r.brand_id !== claimObj.brandId), // strip previous
          {
            id: 'sb_' + Date.now(),
            seller_user_id: claimObj.sellerAccountId,
            brand_id: claimObj.brandId,
            role: 'Owner',
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem('choosify_seller_brands', JSON.stringify(updatedRelations));

        updateProfile(claimObj.brandId, {
          status: 'VERIFIED_OWNER',
          ownerSellerId: claimObj.sellerAccountId,
          badge: 'Verified Brand Owner',
          showClaimButton: false
        });

        // Add history in the log
        addLog(
          claimObj.brandId, 
          claimObj.brandName, 
          adminName, 
          'Ownership Claim Approved', 
          `Ownership approved & assigned. Prev state: ${previousStatus}. New state: VERIFIED_OWNER. Seller assigned: ${claimObj.applicantName}. Reason: ${reason}`
        );
      } else if (status === 'Rejected') {
        updateProfile(claimObj.brandId, {
          status: 'UNCLAIMED',
          badge: 'Unclaimed Brand Profile',
          showClaimButton: true
        });

        addLog(
          claimObj.brandId, 
          claimObj.brandName, 
          adminName, 
          'Ownership Claim Rejected', 
          `Applicant ${claimObj.applicantName} request rejected. Reason: ${reason}`
        );
      } else {
        addLog(
          claimObj.brandId, 
          claimObj.brandName, 
          adminName, 
          `Ownership Claim Marked: ${status}`, 
          `Claim updated to: ${status}. Note: ${reason}`
        );
      }
    }
  };

  const addInternalNotes = (claimId: string, notes: string) => {
    const updated = claims.map(c => {
      if (c.id === claimId) {
        return {
          ...c,
          internalNotes: notes
        };
      }
      return c;
    });
    setClaims(updated);
    localStorage.setItem('choosify_ownership_claims', JSON.stringify(updated));
  };

  return (
    <BrandProfilesContext.Provider value={{
      profiles,
      claims,
      logs,
      createProfile,
      updateProfile,
      deleteProfile,
      bulkUpdateProfiles,
      submitClaim,
      reviewClaim,
      addInternalNotes,
      addLog
    }}>
      {children}
    </BrandProfilesContext.Provider>
  );
};

export const useBrandProfiles = () => {
  const context = useContext(BrandProfilesContext);
  if (!context) {
    throw new Error('useBrandProfiles must be used within a BrandProfilesProvider');
  }
  return context;
};
