import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { catalogApi } from '../services/catalogApi';
import type { HomepageConfig, HomepageSectionConfig } from '../types/catalog';

export interface CMSSection {
  id: string;
  title: string;
  /**
   * Display-only microcopy. The real /catalog/home HomepageSectionConfig
   * contract has no subtitle field, so this is sourced from static local
   * defaults and is not admin-editable or persisted anywhere.
   */
  subtitle?: string;
  itemIds: string[]; // IDs of products/brands/creators/deals to feature
  /**
   * Display-only layout hint. Not part of the real backend contract (and not
   * actually read by any renderer today) — kept only so existing consumers
   * of this type keep compiling; sourced from static local defaults.
   */
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
  /** True while the initial /catalog/home fetch is in flight. */
  loading: boolean;
  /** Set when the initial load failed — surfaced by CMS.tsx, never swallowed. */
  loadError: string | null;
  /** True while `saveCMSData` has an in-flight PUT /catalog/home request. */
  saving: boolean;
  updateSection: (sectionId: keyof CMSData | string, itemIds: string[]) => void;
  toggleSectionActive: (sectionId: keyof CMSData | string, isActive: boolean) => void;
  reorderSection: (sectionId: keyof CMSData | string, newOrder: number) => void;
  clearSection: (sectionId: keyof CMSData | string) => void;
  updateSectionMeta: (
    sectionId: keyof CMSData | string,
    meta: { title?: string; subtitle?: string; layout?: 'grid' | 'carousel' | 'slider' }
  ) => void;
  /** Resets the local edit buffer to the seed defaults — still requires `saveCMSData()` to publish. */
  resetToDefault: () => void;
  /** Persists the current section title/visibility/order/itemIds to the real PUT /catalog/home endpoint. Throws on failure. */
  saveCMSData: () => Promise<void>;
  /** Re-fetches from the server, discarding any unsaved local edits. */
  reloadCMSData: () => Promise<void>;
}

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

const KNOWN_SECTION_KEYS = Object.keys(defaultCMSData) as (keyof CMSData)[];
const KNOWN_SECTION_IDS: string[] = KNOWN_SECTION_KEYS;

const CMSDataContext = createContext<CMSDataContextType | undefined>(undefined);

export const CMSDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cmsData, setCmsData] = useState<CMSData>(defaultCMSData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The full remote homepage document, plus any section entries this editor
  // doesn't know about — kept so `saveCMSData` can PUT back a complete
  // `sections` array (and the rest of the homepage doc) instead of silently
  // dropping data this page never touched (hero banners, featured*Ids, etc).
  const remoteHomepageRef = useRef<HomepageConfig | null>(null);
  const otherSectionsRef = useRef<HomepageSectionConfig[]>([]);

  const applyHomepage = (homepage: HomepageConfig) => {
    remoteHomepageRef.current = homepage;
    const byId = new Map(homepage.sections.map((s) => [s.id, s]));
    const next = { ...defaultCMSData };
    KNOWN_SECTION_KEYS.forEach((key) => {
      const remote = byId.get(key);
      if (remote) {
        next[key] = {
          ...defaultCMSData[key],
          title: remote.label,
          isActive: remote.isVisible,
          order: remote.order,
          itemIds: remote.itemIds,
        };
      }
    });
    otherSectionsRef.current = homepage.sections.filter((s) => !KNOWN_SECTION_IDS.includes(s.id));
    setCmsData(next);
  };

  const reloadCMSData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const homepage = await catalogApi.getHomepage();
      applyHomepage(homepage);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load homepage CMS data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCMSData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const saveCMSData = async () => {
    // Never fabricate a blank homepage document to PUT — if we've never
    // successfully loaded the real one, saving would overwrite hero banners,
    // deals banners, and featured*Ids this page never touched. Force a
    // reload first instead.
    const base = remoteHomepageRef.current;
    if (!base) {
      throw new Error('Homepage data has not loaded yet — reload before saving.');
    }

    setSaving(true);
    try {
      const managedSections: HomepageSectionConfig[] = KNOWN_SECTION_KEYS.map((key) => {
        const sec = cmsData[key];
        return {
          id: sec.id,
          label: sec.title,
          isVisible: sec.isActive,
          order: sec.order,
          itemIds: sec.itemIds,
        };
      });
      const mergedSections = [...managedSections, ...otherSectionsRef.current];

      const saved = await catalogApi.updateHomepage({ ...base, sections: mergedSections });
      applyHomepage(saved);
    } finally {
      setSaving(false);
    }
    // Errors intentionally propagate to the caller (CMS.tsx) so the Save
    // button can surface a real failure instead of a fake success toast.
  };

  return (
    <CMSDataContext.Provider
      value={{
        cmsData,
        loading,
        loadError,
        saving,
        updateSection,
        toggleSectionActive,
        reorderSection,
        clearSection,
        updateSectionMeta,
        resetToDefault,
        saveCMSData,
        reloadCMSData,
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
