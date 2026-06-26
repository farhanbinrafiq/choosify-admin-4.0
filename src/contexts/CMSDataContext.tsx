import React, { createContext, useContext, useEffect, useState } from 'react';

export interface CMSSection {
  id: string;
  title: string;
  subtitle?: string;
  itemIds: string[]; // IDs of products/brands/creators/deals to feature
  layout?: 'grid' | 'carousel' | 'slider';
  isActive: boolean;
  order: number; // For reordering sections
}

export interface CMSData {
  featuredDeals: CMSSection;
  spotlightBrands: CMSSection;
  sponsoredAds: CMSSection;
  sponsoredBrands: CMSSection;
  sponsoredProducts: CMSSection;
  featuredRecommendations: CMSSection;
  featuredCreators: CMSSection;
  choosifyRecommendedBrands: CMSSection;
  recommendedProducts: CMSSection;
  recommendedCreators: CMSSection;
}

export interface CMSDataContextType {
  cmsData: CMSData;
  updateSection: (sectionId: keyof CMSData | string, itemIds: string[]) => void;
  toggleSectionActive: (sectionId: keyof CMSData | string, isActive: boolean) => void;
  reorderSection: (sectionId: keyof CMSData | string, newOrder: number) => void;
  clearSection: (sectionId: keyof CMSData | string) => void;
  updateSectionMeta: (
    sectionId: keyof CMSData | string,
    meta: { title?: string; subtitle?: string; layout?: 'grid' | 'carousel' | 'slider' }
  ) => void;
  resetToDefault: () => void;
}

const LOCAL_STORAGE_KEY = 'choosify_cms_data';

const defaultCMSData: CMSData = {
  featuredDeals: {
    id: 'featuredDeals',
    title: '🔥 Featured Flash Deals',
    subtitle: 'Limited-time exclusive vouchers & offers from verified partners',
    itemIds: ['d1', 'd2'],
    layout: 'carousel',
    isActive: true,
    order: 1,
  },
  spotlightBrands: {
    id: 'spotlightBrands',
    title: '✨ Spotlight Brands',
    subtitle: 'This week’s most popular emerging local brands',
    itemIds: ['b1', 'b2', 'b3'],
    layout: 'grid',
    isActive: true,
    order: 2,
  },
  sponsoredAds: {
    id: 'sponsoredAds',
    title: '📢 Sponsored Campaign Showcase',
    subtitle: 'Promoted ads and ongoing highlight events',
    itemIds: ['promo_banner_01', 'promo_deal_01'],
    layout: 'slider',
    isActive: true,
    order: 3,
  },
  sponsoredBrands: {
    id: 'sponsoredBrands',
    title: '🌟 Sponsored Brands',
    subtitle: 'Handpicked brand storefronts you might love',
    itemIds: ['b4', 'b5'],
    layout: 'carousel',
    isActive: true,
    order: 4,
  },
  sponsoredProducts: {
    id: 'sponsoredProducts',
    title: '📦 Sponsored Products',
    subtitle: 'Premium sponsored selections delivered right to your door',
    itemIds: ['p1', 'p2', 'p3'],
    layout: 'grid',
    isActive: true,
    order: 5,
  },
  featuredRecommendations: {
    id: 'featuredRecommendations',
    title: '📚 Expert Buying Guides',
    subtitle: 'Step-by-step product recommendations from industry experts',
    itemIds: ['rec1', 'rec2'],
    layout: 'slider',
    isActive: true,
    order: 6,
  },
  featuredCreators: {
    id: 'featuredCreators',
    title: '🎙️ Verified Creators',
    subtitle: 'Follow the curators behind the best buying guides',
    itemIds: ['c1', 'c2', 'c3'],
    layout: 'grid',
    isActive: true,
    order: 7,
  },
  choosifyRecommendedBrands: {
    id: 'choosifyRecommendedBrands',
    title: '👍 Choosify Recommended Brands',
    subtitle: 'Highly rated, trusted brands with verified ratings',
    itemIds: ['b1', 'b4', 'b6'],
    layout: 'carousel',
    isActive: true,
    order: 8,
  },
  recommendedProducts: {
    id: 'recommendedProducts',
    title: '🛍️ Recommended For You',
    subtitle: 'Tailored product suggestions based on your interests',
    itemIds: ['p4', 'p5', 'p6'],
    layout: 'grid',
    isActive: true,
    order: 9,
  },
  recommendedCreators: {
    id: 'recommendedCreators',
    title: '🤝 Recommended Creators',
    subtitle: 'Top creators and trendsetters in the Choosify community',
    itemIds: ['c2', 'c4'],
    layout: 'carousel',
    isActive: true,
    order: 10,
  },
};

const CMSDataContext = createContext<CMSDataContextType | undefined>(undefined);

export const CMSDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cmsData, setCmsData] = useState<CMSData>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all required fields exist
        const merged = { ...defaultCMSData };
        Object.keys(defaultCMSData).forEach((key) => {
          const k = key as keyof CMSData;
          if (parsed[k]) {
            merged[k] = {
              ...defaultCMSData[k],
              ...parsed[k],
            };
          }
        });
        return merged;
      }
    } catch (e) {
      console.error('Failed to parse stored CMS data', e);
    }
    return defaultCMSData;
  });

  // Save to localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cmsData));
    } catch (e) {
      console.error('Failed to save CMS data to localStorage', e);
    }
  }, [cmsData]);

  const updateSection = (sectionId: keyof CMSData | string, itemIds: string[]) => {
    setCmsData((prev) => {
      const key = sectionId as keyof CMSData;
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          itemIds,
        },
      };
    });
  };

  const toggleSectionActive = (sectionId: keyof CMSData | string, isActive: boolean) => {
    setCmsData((prev) => {
      const key = sectionId as keyof CMSData;
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          isActive,
        },
      };
    });
  };

  const reorderSection = (sectionId: keyof CMSData | string, newOrder: number) => {
    setCmsData((prev) => {
      const key = sectionId as keyof CMSData;
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          order: newOrder,
        },
      };
    });
  };

  const clearSection = (sectionId: keyof CMSData | string) => {
    setCmsData((prev) => {
      const key = sectionId as keyof CMSData;
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          itemIds: [],
        },
      };
    });
  };

  const updateSectionMeta = (
    sectionId: keyof CMSData | string,
    meta: { title?: string; subtitle?: string; layout?: 'grid' | 'carousel' | 'slider' }
  ) => {
    setCmsData((prev) => {
      const key = sectionId as keyof CMSData;
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          ...meta,
        },
      };
    });
  };

  const resetToDefault = () => {
    setCmsData(defaultCMSData);
  };

  return (
    <CMSDataContext.Provider
      value={{
        cmsData,
        updateSection,
        toggleSectionActive,
        reorderSection,
        clearSection,
        updateSectionMeta,
        resetToDefault,
      }}
    >
      {children}
    </CMSDataContext.Provider>
  );
};

export const useCMSData = () => {
  const context = useContext(CMSDataContext);
  if (!context) {
    throw new Error('useCMSData must be used within a CMSDataProvider');
  }
  return context;
};
