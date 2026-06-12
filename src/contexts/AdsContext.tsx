import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export type PromotionType = 'AD' | 'POST' | 'PRODUCT' | 'BRAND' | 'DEAL' | 'RECOMMENDATION';
export type PromotionStatus = 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'EXPIRED';

export interface Promotion {
  id: string;
  type: PromotionType;
  targetId?: string; // ID of product, deal, brand etc.
  title: string;
  subtitle?: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  status: PromotionStatus;
  startDate?: string;
  endDate?: string;
  placement: string; // homepage_banner, trending_section, category_top, listing_boost etc.
  targeting: string[]; // target categories or audiences
  priority: number; // also handles boost weight
  analytics: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
}

export interface PromotionRequest {
  id: string;
  requesterId: string;
  requesterRole: 'seller' | 'creator';
  requesterName: string; // e.g. business name or creator displayName
  contentType: 'PRODUCT' | 'DEAL' | 'RECOMMENDATION' | 'BRAND' | 'POST';
  contentId: string;
  contentName: string;
  requestedPromotionType: 'Featured' | 'Sponsored' | 'Hot' | 'Verified' | 'Trending' | 'Editor Pick';
  featurePriority: 'Standard Featured' | 'Premium Featured' | 'Homepage Featured' | 'Trending Boost' | 'Editor Pick';
  duration: number; // e.g. 3, 7, 30 days
  placementRequest: string; // e.g. 'homepage_banner', 'trending_section', 'category_top', etc.
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

interface AdsContextType {
  promotions: Promotion[];
  promotionRequests: PromotionRequest[];
  loading: boolean;
  addPromotion: (promo: Omit<Promotion, 'id' | 'analytics'>) => Promise<void>;
  updatePromotion: (id: string, updates: Partial<Promotion>) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  trackClick: (id: string) => Promise<void>;
  trackImpression: (id: string) => Promise<void>;
  
  // Seller / Creator Request Actions
  addPromotionRequest: (request: Omit<PromotionRequest, 'id' | 'approvalStatus' | 'createdAt'>) => Promise<void>;
  approvePromotionRequest: (requestId: string, approvedPromo: Omit<Promotion, 'id' | 'analytics'>) => Promise<void>;
  rejectPromotionRequest: (requestId: string) => Promise<void>;
  deletePromotionRequest: (requestId: string) => Promise<void>;

  // Ad Ranking Algorithm
  calculateAdScore: (
    organicData: { rating?: number; clicks?: number; reviewsCount?: number; savesCount?: number },
    promo?: Promotion
  ) => number;
}

const AdsContext = createContext<AdsContextType | undefined>(undefined);

export const AdsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Automated Expiry & Deactivation mechanism
  useEffect(() => {
    if (loading || promotions.length === 0) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      promotions.forEach(async (promo) => {
        if (promo.status === 'ACTIVE' && promo.endDate) {
          const end = new Date(promo.endDate);
          if (end < now) {
            console.log(`Auto-expiring campaign: ${promo.title}`);
            try {
              await setDoc(doc(db, 'promotions', promo.id), { status: 'EXPIRED' }, { merge: true });
            } catch (err) {
              console.error(`Failed to auto-expire ${promo.id}`, err);
            }
          }
        }
      });
    }, 15000); // Check every 15s

    return () => clearInterval(interval);
  }, [promotions, loading]);

  useEffect(() => {
    // 1. Promotions Listener
    const qPromos = query(collection(db, 'promotions'), orderBy('priority', 'desc'));
    const unsubPromos = onSnapshot(qPromos, (snapshot) => {
      const items: Promotion[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Promotion);
      });

      // Seed initial data if database is empty on first boot
      if (items.length === 0) {
        seedInitialData();
      } else {
        setPromotions(items);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'promotions');
    });

    // 2. Promotion Requests Listener
    const unsubRequests = onSnapshot(collection(db, 'promotion_requests'), (snapshot) => {
      const items: PromotionRequest[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as PromotionRequest);
      });
      setPromotionRequests(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'promotion_requests');
      setLoading(false);
    });

    return () => {
      unsubPromos();
      unsubRequests();
    };
  }, []);

  const seedInitialData = async () => {
    const initialPromos: Promotion[] = [
      {
        id: 'promo_banner_01',
        type: 'AD',
        title: 'Aarong Pohela Boishakh Exclusive',
        subtitle: 'Celebrate in style! Up to 40% Off on Premium Panjabis and Sarees.',
        imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
        linkUrl: 'https://www.aarong.com',
        status: 'ACTIVE',
        placement: 'homepage_banner',
        targeting: ['Fashion', 'Lifestyle'],
        priority: 80,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        analytics: { impressions: 4200, clicks: 312, ctr: 7.43 }
      },
      {
        id: 'promo_product_01',
        type: 'PRODUCT',
        targetId: 'p1',
        title: 'iPhone 15 Pro (Aarong Certified)',
        subtitle: 'Exclusive flagship product featured under sponsored spotlight this week.',
        imageUrl: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400&q=80',
        status: 'ACTIVE',
        placement: 'trending_section',
        targeting: ['Electronics'],
        priority: 75,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        analytics: { impressions: 1840, clicks: 92, ctr: 5.0 }
      },
      {
        id: 'promo_deal_01',
        type: 'DEAL',
        targetId: 'd1',
        title: 'Special Gadget Flash Sale',
        subtitle: 'Save up to ৳ 10,000 on early summer gadgets.',
        imageUrl: 'https://images.unsplash.com/photo-1707201366969-952467d5813f?w=600&q=80',
        status: 'ACTIVE',
        placement: 'homepage_banner',
        targeting: ['Electronics'],
        priority: 90,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        analytics: { impressions: 2900, clicks: 180, ctr: 6.21 }
      }
    ];

    try {
      for (const p of initialPromos) {
        await setDoc(doc(db, 'promotions', p.id), p);
      }
    } catch (e) {
      console.error('Failed to seed default campaigns', e);
    }
  };

  const addPromotion = async (promo: Omit<Promotion, 'id' | 'analytics'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newPromo: Promotion = {
      ...promo,
      id,
      analytics: { impressions: 0, clicks: 0, ctr: 0 }
    };
    try {
      await setDoc(doc(db, 'promotions', id), newPromo);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `promotions/${id}`);
    }
  };

  const updatePromotion = async (id: string, updates: Partial<Promotion>) => {
    try {
      await setDoc(doc(db, 'promotions', id), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `promotions/${id}`);
    }
  };

  const deletePromotion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'promotions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `promotions/${id}`);
    }
  };

  const trackClick = async (id: string) => {
    const promo = promotions.find(p => p.id === id);
    if (!promo) return;
    
    const newClicks = (promo.analytics?.clicks || 0) + 1;
    const impressions = promo.analytics?.impressions || 1;
    const newCtr = impressions > 0 ? (newClicks / impressions) * 100 : 0;
    
    try {
      await setDoc(doc(db, 'promotions', id), {
        analytics: {
          ...promo.analytics,
          clicks: newClicks,
          ctr: parseFloat(newCtr.toFixed(2))
        }
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `promotions/${id}`);
    }
  };

  const trackImpression = async (id: string) => {
    const promo = promotions.find(p => p.id === id);
    if (!promo) return;
    
    const newImpressions = (promo.analytics?.impressions || 0) + 1;
    const clicks = promo.analytics?.clicks || 0;
    const newCtr = newImpressions > 0 ? (clicks / newImpressions) * 100 : 0;
    
    try {
      await setDoc(doc(db, 'promotions', id), {
        analytics: {
          ...promo.analytics,
          impressions: newImpressions,
          ctr: parseFloat(newCtr.toFixed(2))
        }
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `promotions/${id}`);
    }
  };

  // Seller / Creator Request System
  const addPromotionRequest = async (request: Omit<PromotionRequest, 'id' | 'approvalStatus' | 'createdAt'>) => {
    const id = 'req_' + Math.random().toString(36).substr(2, 9);
    const newRequest: PromotionRequest = {
      ...request,
      id,
      approvalStatus: 'PENDING',
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'promotion_requests', id), newRequest);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `promotion_requests/${id}`);
    }
  };

  const approvePromotionRequest = async (requestId: string, approvedPromo: Omit<Promotion, 'id' | 'analytics'>) => {
    try {
      // Create active promotion
      const promoId = 'promo_' + Math.random().toString(36).substr(2, 9);
      const newPromo: Promotion = {
        ...approvedPromo,
        id: promoId,
        status: 'ACTIVE',
        analytics: { impressions: 0, clicks: 0, ctr: 0 }
      };
      
      await setDoc(doc(db, 'promotions', promoId), newPromo);
      
      // Update request status to APPROVED
      await setDoc(doc(db, 'promotion_requests', requestId), {
        approvalStatus: 'APPROVED'
      }, { merge: true });
      
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `promotion_requests/${requestId}`);
    }
  };

  const rejectPromotionRequest = async (requestId: string) => {
    try {
      await setDoc(doc(db, 'promotion_requests', requestId), {
        approvalStatus: 'REJECTED'
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `promotion_requests/${requestId}`);
    }
  };

  const deletePromotionRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'promotion_requests', requestId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `promotion_requests/${requestId}`);
    }
  };

  /**
   * Ad ranking & sorting algorithm
   * Final Score = (Organic Engagement Score × 0.7) + (Sponsored Boost Weight × 0.3)
   * Hard Constraint: Sponsored content must never fully override trust system (low-quality under 3.5 rating is capped!)
   */
  const calculateAdScore = (
    organicData: { rating?: number; clicks?: number; reviewsCount?: number; savesCount?: number },
    promo?: Promotion
  ): number => {
    const rating = organicData.rating ?? 0;
    const clicks = organicData.clicks ?? 0;
    const reviewsCount = organicData.reviewsCount ?? 0;
    const savesCount = organicData.savesCount ?? 0;

    // 1. Calculate Organic Score (Normalized 0 to 100)
    // - Based on rating (5 is 50 pts)
    // - Based on saves / loves (up to 15 pts)
    // - Based on clicks/views engagement (up to 25 pts)
    // - Based on reviews count (up to 10 pts)
    const ratingScore = rating * 10; // Max 50
    const savesScore = Math.min((savesCount || 0) * 1, 15);
    const clicksScore = Math.min((clicks || 0) * 0.1, 25);
    const reviewsScore = Math.min((reviewsCount || 0) * 0.5, 10);
    
    const organicScore = ratingScore + savesScore + clicksScore + reviewsScore;

    // 2. Calculate Sponsored Boost Weight (0 to 100)
    let sponsoredBoostWeight = 0;
    if (promo && promo.status === 'ACTIVE') {
      // Higher feature priority levels carry stronger weight
      // Standard: 30, Premium: 60, Homepage / Editor Pick: 90
      const baseBoosts: Record<string, number> = {
        'Standard Featured': 30,
        'Trending Boost': 45,
        'Premium Featured': 60,
        'Editor Pick': 80,
        'Homepage Featured': 95
      };
      
      sponsoredBoostWeight = baseBoosts[promo.title] || baseBoosts[promo.placement] || 50;

      // Quality Override Rule: Low-quality content overrides
      // If rating is below 3.5, halving the sponsored boost weight to prevent it from rising of trust
      if (rating > 0 && rating < 3.5) {
        sponsoredBoostWeight = Math.min(sponsoredBoostWeight, 25); // Hard penalty capped at 25 Max
      }
    }

    // 3. Final Scoring Application
    const finalScore = (organicScore * 0.7) + (sponsoredBoostWeight * 0.3);
    return parseFloat(finalScore.toFixed(2));
  };

  return (
    <AdsContext.Provider value={{ 
      promotions, 
      promotionRequests,
      loading, 
      addPromotion, 
      updatePromotion, 
      deletePromotion, 
      trackClick,
      trackImpression,
      addPromotionRequest,
      approvePromotionRequest,
      rejectPromotionRequest,
      deletePromotionRequest,
      calculateAdScore
    }}>
      {children}
    </AdsContext.Provider>
  );
};

export const useAds = () => {
  const context = useContext(AdsContext);
  if (!context) {
    throw new Error('useAds must be used within an AdsProvider');
  }
  return context;
};
