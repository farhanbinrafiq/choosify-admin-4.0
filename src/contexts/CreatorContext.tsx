import React, { createContext, useContext, useState, useEffect } from 'react';

export type CreatorTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CreatorPerformance {
  creatorId: string;
  creatorName: string;
  avatar?: string;
  guidesPublished: number;
  recommendationsCreated: number;
  totalGuideViews: number;
  totalRecommendationViews: number;
  totalGuideClicks: number; // clicks through to products
  totalRecommendationClicks: number;
  conversionRate: number; // % of views that result in clicks
  followerCount: number;
  followerGrowth: number; // last 30 days
  engagementRate: number; // comments + shares / views
  tier: CreatorTier; // based on performance
  tierAchievedAt?: string;
  joinedAt: string;
}

export interface CreatorEarning {
  id: string;
  creatorId: string;
  creatorName: string;
  source: 'guide_performance' | 'recommendation_commission' | 'sponsorship' | 'affiliate' | 'bonus';
  amount: number;
  currency: string; // BDT
  earnedAt: string;
  status: 'pending' | 'verified' | 'paid'; // pending until month-end accrual
  month: string; // YYYY-MM
  details?: {
    guideId?: string;
    guideTitle?: string;
    recommendationId?: string;
    clicks?: number;
    conversionCount?: number;
  };
}

export interface CreatorPayout {
  id: string;
  creatorId: string;
  creatorName: string;
  payoutCycle: string; // YYYY-MM
  totalEarnings: number;
  bankAccount: string; // masked
  status: 'pending' | 'approved' | 'paid' | 'failed';
  processedAt?: string;
  paidAt?: string;
  notes?: string;
}

export interface CreatorMilestone {
  id: string;
  creatorId: string;
  creatorName: string;
  milestone: 'first_guide' | '100_guides' | '10k_views' | '100k_views' | '10k_followers' | '100k_followers';
  achievedAt: string;
  reward?: { type: 'bonus' | 'tier_upgrade'; amount?: number; };
}

interface CreatorContextType {
  creatorPerformance: CreatorPerformance[];
  creatorEarnings: CreatorEarning[];
  creatorPayouts: CreatorPayout[];
  creatorMilestones: CreatorMilestone[];
  getCreatorStats: (creatorId: string) => {
    perf: CreatorPerformance | undefined;
    earnings: CreatorEarning[];
    payouts: CreatorPayout[];
    milestones: CreatorMilestone[];
  };
  updateCreatorTier: (creatorId: string, newTier: CreatorTier) => void;
  calculateEarnings: (creatorId: string, month: string) => number;
  recordEarning: (
    creatorId: string,
    source: CreatorEarning['source'],
    amount: number,
    details?: CreatorEarning['details']
  ) => void;
  createPayout: (creatorId: string, month: string) => CreatorPayout | null;
  approvePayout: (payoutId: string) => void;
  rejectPayout: (payoutId: string, reason: string) => void;
  undoPayoutRejection: (payoutId: string) => void;
  markPayoutAsPaid: (payoutId: string) => void;
  detectMilestones: (creatorId: string) => CreatorMilestone[];
  getCreatorRanking: (metric: keyof CreatorPerformance) => CreatorPerformance[];
  auditAllTiers: () => void;
}

const CreatorContext = createContext<CreatorContextType | undefined>(undefined);

export const useCreatorContext = () => {
  const context = useContext(CreatorContext);
  if (!context) {
    throw new Error('useCreatorContext must be used within a CreatorProvider');
  }
  return context;
};

// Initial Mock Performance Data
const initialPerformance: CreatorPerformance[] = [
  {
    creatorId: 'creator_rafsan',
    creatorName: 'Rafsan The Chotobhai',
    avatar: 'RC',
    guidesPublished: 12,
    recommendationsCreated: 38,
    totalGuideViews: 18500,
    totalRecommendationViews: 24000,
    totalGuideClicks: 1200,
    totalRecommendationClicks: 1800,
    conversionRate: 6.8,
    followerCount: 520,
    followerGrowth: 110,
    engagementRate: 8.5,
    tier: 'silver',
    joinedAt: '2025-06-15',
    tierAchievedAt: '2026-01-10'
  },
  {
    creatorId: 'creator_khalid',
    creatorName: 'Khalid Farhan',
    avatar: 'KF',
    guidesPublished: 112,
    recommendationsCreated: 245,
    totalGuideViews: 650000,
    totalRecommendationViews: 820000,
    totalGuideClicks: 24500,
    totalRecommendationClicks: 31000,
    conversionRate: 8.2,
    followerCount: 8900,
    followerGrowth: 1200,
    engagementRate: 11.4,
    tier: 'platinum',
    joinedAt: '2024-03-01',
    tierAchievedAt: '2025-12-20'
  },
  {
    creatorId: 'creator_tawhid',
    creatorName: 'Tawhid Afridi',
    avatar: 'TA',
    guidesPublished: 65,
    recommendationsCreated: 130,
    totalGuideViews: 125000,
    totalRecommendationViews: 190000,
    totalGuideClicks: 8200,
    totalRecommendationClicks: 12500,
    conversionRate: 7.9,
    followerCount: 3400,
    followerGrowth: 450,
    engagementRate: 9.1,
    tier: 'gold',
    joinedAt: '2024-11-10',
    tierAchievedAt: '2025-09-15'
  },
  {
    creatorId: 'creator_farhan',
    creatorName: "Farhan's Reviews",
    avatar: 'FR',
    guidesPublished: 2,
    recommendationsCreated: 5,
    totalGuideViews: 450,
    totalRecommendationViews: 600,
    totalGuideClicks: 30,
    totalRecommendationClicks: 55,
    conversionRate: 5.1,
    followerCount: 25,
    followerGrowth: 8,
    engagementRate: 4.2,
    tier: 'bronze',
    joinedAt: '2026-05-15',
    tierAchievedAt: '2026-05-20'
  }
];

// Initial Mock Earnings Data
const initialEarnings: CreatorEarning[] = [
  {
    id: 'earn_01',
    creatorId: 'creator_khalid',
    creatorName: 'Khalid Farhan',
    source: 'guide_performance',
    amount: 325, // 650,000 views * 0.50 / 1000 = 325 BDT
    currency: 'BDT',
    earnedAt: '2026-06-25T14:30:00Z',
    status: 'verified',
    month: '2026-06',
    details: { clicks: 24500 }
  },
  {
    id: 'earn_02',
    creatorId: 'creator_khalid',
    creatorName: 'Khalid Farhan',
    source: 'recommendation_commission',
    amount: 155000, // commission on big electronic goods
    currency: 'BDT',
    earnedAt: '2026-06-24T18:15:00Z',
    status: 'verified',
    month: '2026-06',
    details: { conversionCount: 310 }
  },
  {
    id: 'earn_03',
    creatorId: 'creator_tawhid',
    creatorName: 'Tawhid Afridi',
    source: 'sponsorship',
    amount: 45000,
    currency: 'BDT',
    earnedAt: '2026-06-20T10:00:00Z',
    status: 'verified',
    month: '2026-06'
  },
  {
    id: 'earn_04',
    creatorId: 'creator_rafsan',
    creatorName: 'Rafsan The Chotobhai',
    source: 'recommendation_commission',
    amount: 9000, // 1800 clicks * commission / verification click
    currency: 'BDT',
    earnedAt: '2026-06-18T11:00:00Z',
    status: 'verified',
    month: '2026-06',
    details: { clicks: 1800, conversionCount: 45 }
  },
  {
    id: 'earn_05',
    creatorId: 'creator_rafsan',
    creatorName: 'Rafsan The Chotobhai',
    source: 'bonus',
    amount: 100, // bonus > 10k views
    currency: 'BDT',
    earnedAt: '2026-06-28T09:00:00Z',
    status: 'pending',
    month: '2026-06'
  },
  {
    id: 'earn_06',
    creatorId: 'creator_farhan',
    creatorName: "Farhan's Reviews",
    source: 'guide_performance',
    amount: 1.5,
    currency: 'BDT',
    earnedAt: '2026-06-27T16:00:00Z',
    status: 'pending',
    month: '2026-06'
  }
];

// Initial Mock Payouts
const initialPayouts: CreatorPayout[] = [
  {
    id: 'payout_01',
    creatorId: 'creator_khalid',
    creatorName: 'Khalid Farhan',
    payoutCycle: '2026-05',
    totalEarnings: 124500,
    bankAccount: 'City Bank Ltd · ****9283',
    status: 'paid',
    processedAt: '2026-06-02T10:00:00Z',
    paidAt: '2026-06-02T14:30:00Z',
    notes: 'Cleared and approved by Finance Lead'
  },
  {
    id: 'payout_02',
    creatorId: 'creator_tawhid',
    creatorName: 'Tawhid Afridi',
    payoutCycle: '2026-05',
    totalEarnings: 38000,
    bankAccount: 'Dutch-Bangla Bank · ****1102',
    status: 'approved',
    processedAt: '2026-06-03T11:20:00Z',
    notes: 'Awaiting automatic processing batch'
  },
  {
    id: 'payout_03',
    creatorId: 'creator_rafsan',
    creatorName: 'Rafsan The Chotobhai',
    payoutCycle: '2026-05',
    totalEarnings: 8200,
    bankAccount: 'BRAC Bank Ltd · ****4812',
    status: 'pending',
    notes: 'Pending standard verification audit'
  },
  {
    id: 'payout_04',
    creatorId: 'creator_farhan',
    creatorName: "Farhan's Reviews",
    payoutCycle: '2026-05',
    totalEarnings: 45, // Under minimum payout of 100
    bankAccount: '', // Missing bank account
    status: 'pending',
    notes: 'Below minimum payout limit / Missing account details'
  }
];

// Initial Milestones
const initialMilestones: CreatorMilestone[] = [
  {
    id: 'ms_01',
    creatorId: 'creator_khalid',
    creatorName: 'Khalid Farhan',
    milestone: 'first_guide',
    achievedAt: '2024-03-10',
    reward: { type: 'bonus', amount: 500 }
  },
  {
    id: 'ms_02',
    creatorId: 'creator_khalid',
    creatorName: 'Khalid Farhan',
    milestone: '100_guides',
    achievedAt: '2025-11-15',
    reward: { type: 'bonus', amount: 5000 }
  },
  {
    id: 'ms_03',
    creatorId: 'creator_khalid',
    creatorName: 'Khalid Farhan',
    milestone: '100k_views',
    achievedAt: '2025-01-20',
    reward: { type: 'tier_upgrade' }
  },
  {
    id: 'ms_04',
    creatorId: 'creator_tawhid',
    creatorName: 'Tawhid Afridi',
    milestone: 'first_guide',
    achievedAt: '2024-11-20',
    reward: { type: 'bonus', amount: 500 }
  }
];

export const CreatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [creatorPerformance, setCreatorPerformance] = useState<CreatorPerformance[]>(() => {
    const saved = localStorage.getItem('choosify_creator_perf');
    return saved ? JSON.parse(saved) : initialPerformance;
  });

  const [creatorEarnings, setCreatorEarnings] = useState<CreatorEarning[]>(() => {
    const saved = localStorage.getItem('choosify_creator_earnings');
    return saved ? JSON.parse(saved) : initialEarnings;
  });

  const [creatorPayouts, setCreatorPayouts] = useState<CreatorPayout[]>(() => {
    const saved = localStorage.getItem('choosify_creator_payouts');
    return saved ? JSON.parse(saved) : initialPayouts;
  });

  const [creatorMilestones, setCreatorMilestones] = useState<CreatorMilestone[]>(() => {
    const saved = localStorage.getItem('choosify_creator_milestones');
    return saved ? JSON.parse(saved) : initialMilestones;
  });

  // Keep a record of recently rejected payouts to enable 1-hour undo buffer
  const [rejectedPayoutsHistory, setRejectedPayoutsHistory] = useState<Record<string, { originalStatus: CreatorPayout['status'], rejectedAt: number, originalNotes?: string }>>({});

  useEffect(() => {
    localStorage.setItem('choosify_creator_perf', JSON.stringify(creatorPerformance));
  }, [creatorPerformance]);

  useEffect(() => {
    localStorage.setItem('choosify_creator_earnings', JSON.stringify(creatorEarnings));
  }, [creatorEarnings]);

  useEffect(() => {
    localStorage.setItem('choosify_creator_payouts', JSON.stringify(creatorPayouts));
  }, [creatorPayouts]);

  useEffect(() => {
    localStorage.setItem('choosify_creator_milestones', JSON.stringify(creatorMilestones));
  }, [creatorMilestones]);

  const getCreatorStats = (creatorId: string) => {
    const perf = creatorPerformance.find(p => p.creatorId === creatorId);
    const earnings = creatorEarnings.filter(e => e.creatorId === creatorId);
    const payouts = creatorPayouts.filter(p => p.creatorId === creatorId);
    const milestones = creatorMilestones.filter(m => m.creatorId === creatorId);

    return { perf, earnings, payouts, milestones };
  };

  const updateCreatorTier = (creatorId: string, newTier: CreatorTier) => {
    setCreatorPerformance(prev =>
      prev.map(p =>
        p.creatorId === creatorId
          ? { ...p, tier: newTier, tierAchievedAt: new Date().toISOString().split('T')[0] }
          : p
      )
    );
  };

  const calculateEarnings = (creatorId: string, month: string): number => {
    return creatorEarnings
      .filter(e => e.creatorId === creatorId && e.month === month && e.status !== 'paid')
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const recordEarning = (
    creatorId: string,
    source: CreatorEarning['source'],
    amount: number,
    details?: CreatorEarning['details']
  ) => {
    const creatorName = creatorPerformance.find(p => p.creatorId === creatorId)?.creatorName || 'Unknown Creator';
    const now = new Date();
    const month = now.toISOString().substring(0, 7); // YYYY-MM

    const newEarning: CreatorEarning = {
      id: `earn_${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      creatorName,
      source,
      amount,
      currency: 'BDT',
      earnedAt: now.toISOString(),
      status: 'pending',
      month,
      details
    };

    setCreatorEarnings(prev => [newEarning, ...prev]);

    // Check for performance milestones trigger
    detectMilestones(creatorId);
  };

  const createPayout = (creatorId: string, month: string): CreatorPayout | null => {
    const creator = creatorPerformance.find(p => p.creatorId === creatorId);
    if (!creator) return null;

    // Filter pending and verified earnings for this creator & cycle
    const cycleEarnings = creatorEarnings.filter(
      e => e.creatorId === creatorId && e.month === month && e.status !== 'paid'
    );

    if (cycleEarnings.length === 0) return null;

    const total = cycleEarnings.reduce((sum, e) => sum + e.amount, 0);

    // Standard masked bank account mapper or fallback
    let bankAccount = '';
    if (creatorId === 'creator_rafsan') bankAccount = 'BRAC Bank Ltd · ****4812';
    else if (creatorId === 'creator_khalid') bankAccount = 'City Bank Ltd · ****9283';
    else if (creatorId === 'creator_tawhid') bankAccount = 'Dutch-Bangla Bank · ****1102';
    else bankAccount = ''; // missing

    const newPayout: CreatorPayout = {
      id: `payout_${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      creatorName: creator.creatorName,
      payoutCycle: month,
      totalEarnings: total,
      bankAccount,
      status: 'pending',
      notes: total < 100 ? 'Below minimum payout limit of ৳100' : 'Queued for administration approval'
    };

    setCreatorPayouts(prev => [newPayout, ...prev]);

    // Mark current cycle earnings as paid/linked to this payout
    setCreatorEarnings(prev =>
      prev.map(e =>
        e.creatorId === creatorId && e.month === month ? { ...e, status: 'paid' } : e
      )
    );

    return newPayout;
  };

  const approvePayout = (payoutId: string) => {
    setCreatorPayouts(prev =>
      prev.map(p =>
        p.id === payoutId
          ? { ...p, status: 'approved', processedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const rejectPayout = (payoutId: string, reason: string) => {
    setCreatorPayouts(prev => {
      const target = prev.find(p => p.id === payoutId);
      if (target) {
        // Record in undo history
        setRejectedPayoutsHistory(old => ({
          ...old,
          [payoutId]: {
            originalStatus: target.status,
            rejectedAt: Date.now(),
            originalNotes: target.notes
          }
        }));
      }

      return prev.map(p =>
        p.id === payoutId
          ? { ...p, status: 'failed', notes: `Rejected: ${reason}` }
          : p
      );
    });
  };

  const undoPayoutRejection = (payoutId: string) => {
    const historical = rejectedPayoutsHistory[payoutId];
    if (!historical) return;

    // Check if within 1 hour (3600000 ms)
    if (Date.now() - historical.rejectedAt > 3600000) {
      alert("Undo buffer expired. Rejections can only be reverted within 1 hour.");
      return;
    }

    setCreatorPayouts(prev =>
      prev.map(p =>
        p.id === payoutId
          ? { ...p, status: historical.originalStatus, notes: historical.originalNotes }
          : p
      )
    );

    // Remove from history
    setRejectedPayoutsHistory(old => {
      const copy = { ...old };
      delete copy[payoutId];
      return copy;
    });
  };

  const markPayoutAsPaid = (payoutId: string) => {
    setCreatorPayouts(prev =>
      prev.map(p =>
        p.id === payoutId
          ? { ...p, status: 'paid', paidAt: new Date().toISOString() }
          : p
      )
    );
  };

  const getCreatorRanking = (metric: keyof CreatorPerformance): CreatorPerformance[] => {
    return [...creatorPerformance].sort((a, b) => {
      const valA = a[metric];
      const valB = b[metric];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return valB - valA;
      }
      return 0;
    });
  };

  // Automated/manual audit of tiers
  const auditAllTiers = () => {
    setCreatorPerformance(prev => {
      return prev.map(c => {
        let expectedTier: CreatorTier = 'bronze';

        // Bronze: 1+ guides, 100+ views
        if (c.guidesPublished >= 1 && c.totalGuideViews >= 100) {
          expectedTier = 'bronze';
        }
        // Silver: 10+ guides, 5k views, 50 followers
        if (c.guidesPublished >= 10 && c.totalGuideViews >= 5000 && c.followerCount >= 50) {
          expectedTier = 'silver';
        }
        // Gold: 50+ guides, 50k views, 500 followers
        if (c.guidesPublished >= 50 && c.totalGuideViews >= 50000 && c.followerCount >= 500) {
          expectedTier = 'gold';
        }
        // Platinum: 100+ guides, 500k views, 5k followers
        if (c.guidesPublished >= 100 && c.totalGuideViews >= 500000 && c.followerCount >= 5000) {
          expectedTier = 'platinum';
        }

        if (c.tier !== expectedTier) {
          return {
            ...c,
            tier: expectedTier,
            tierAchievedAt: new Date().toISOString().split('T')[0]
          };
        }
        return c;
      });
    });
  };

  const detectMilestones = (creatorId: string): CreatorMilestone[] => {
    const creator = creatorPerformance.find(p => p.creatorId === creatorId);
    if (!creator) return [];

    const existingMilestoneTypes = creatorMilestones
      .filter(m => m.creatorId === creatorId)
      .map(m => m.milestone);

    const newAchieved: CreatorMilestone[] = [];

    const tryAddMilestone = (
      milestone: CreatorMilestone['milestone'],
      reward: CreatorMilestone['reward']
    ) => {
      if (!existingMilestoneTypes.includes(milestone)) {
        const newMs: CreatorMilestone = {
          id: `ms_${Math.random().toString(36).substr(2, 9)}`,
          creatorId,
          creatorName: creator.creatorName,
          milestone,
          achievedAt: new Date().toISOString().split('T')[0],
          reward
        };
        newAchieved.push(newMs);
      }
    };

    // Check rules
    if (creator.guidesPublished >= 1) {
      tryAddMilestone('first_guide', { type: 'bonus', amount: 500 });
    }
    if (creator.guidesPublished >= 100) {
      tryAddMilestone('100_guides', { type: 'bonus', amount: 5000 });
    }
    if (creator.totalGuideViews >= 10000) {
      tryAddMilestone('10k_views', { type: 'bonus', amount: 1000 });
    }
    if (creator.totalGuideViews >= 100000) {
      tryAddMilestone('100k_views', { type: 'tier_upgrade' });
    }
    if (creator.followerCount >= 10000) {
      tryAddMilestone('10k_followers', { type: 'bonus', amount: 10000 });
    }

    if (newAchieved.length > 0) {
      setCreatorMilestones(prev => [...prev, ...newAchieved]);
      // If there are rewards, record earnings!
      newAchieved.forEach(ms => {
        if (ms.reward && ms.reward.type === 'bonus' && ms.reward.amount) {
          recordEarning(creatorId, 'bonus', ms.reward.amount, {
            recommendationId: ms.id
          });
        }
      });
    }

    return newAchieved;
  };

  return (
    <CreatorContext.Provider
      value={{
        creatorPerformance,
        creatorEarnings,
        creatorPayouts,
        creatorMilestones,
        getCreatorStats,
        updateCreatorTier,
        calculateEarnings,
        recordEarning,
        createPayout,
        approvePayout,
        rejectPayout,
        undoPayoutRejection,
        markPayoutAsPaid,
        detectMilestones,
        getCreatorRanking,
        auditAllTiers
      }}
    >
      {children}
    </CreatorContext.Provider>
  );
};
