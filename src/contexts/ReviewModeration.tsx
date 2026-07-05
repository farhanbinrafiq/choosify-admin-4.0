import React, { createContext, useContext, useState, useEffect } from 'react';
import { Review } from './OrdersContext';
import { useTrust, TrustEntityType } from './TrustContext';
import { operationsApi, type OpsReview } from '../services/operationsApi';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error' | 'warning';
}

interface ReviewModerationContextType {
  reviews: Review[];
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
  removeToast: (id: string) => void;
  approveReview: (id: string) => void;
  rejectReview: (id: string) => void;
  flagReview: (id: string, reason: string) => void;
  markAsSpam: (id: string) => void;
  addSellerResponse: (reviewId: string, author: string, text: string) => void;
  deleteReview: (id: string) => void;
  runBatchAnalysis: () => void;
  updateReviewComment: (id: string, text: string) => void;
  toggleReviewStatus: (id: string, status: Review['status']) => void;
}

const ReviewModerationContext = createContext<ReviewModerationContextType | undefined>(undefined);

export const useReviewModeration = () => {
  const context = useContext(ReviewModerationContext);
  if (!context) {
    throw new Error('useReviewModeration must be used within a ReviewModerationProvider');
  }
  return context;
};

const initialMockReviews: Review[] = [
  { 
    id: '1', 
    user: 'Mehedi Rahman', 
    product: 'Samsung Galaxy S25 Ultra', 
    store: 'TechZone BD', 
    rating: 1, 
    comment: '"This phone is absolute garbage. The seller is a cheat and scammer. I will make sure everyone knows this shop is a fraud. Complete waste of money and time..."', 
    status: 'Flagged', 
    reports: 4, 
    flags: ['Personal Threats', 'Abusive Language'],
    isAuthentic: false,
    authenticityScore: 25,
    authenticityReason: 'Contains abusive vocabulary and highly repetitive fraud accusations.',
    timestamp: '2026-06-12T14:10:00Z'
  },
  { 
    id: '2', 
    user: 'Anonymous K.', 
    product: 'Walton 2-Door Fridge', 
    store: 'ElectroBD', 
    rating: 5, 
    comment: '"Amazing product! Buy from this link: [bit.ly/xyz] for best price! This seller is the best. Everyone should buy here. [Affiliate link spam suspected]"', 
    status: 'Flagged', 
    reports: 2, 
    flags: ['External Links', 'Suspected Spam'],
    isAuthentic: false,
    authenticityScore: 10,
    authenticityReason: 'Detected shortened external hyperlink [bit.ly] indicating commercial click hijacking.',
    timestamp: '2026-06-11T11:30:00Z'
  },
  { 
    id: '3', 
    user: 'Rifat Hasan', 
    product: 'Aarong Jamdani Saree', 
    store: 'Aarong Digital', 
    rating: 3, 
    comment: '"Fabric quality is good but delivery took 5 days longer than promised. The color was slightly different but acceptable. Would buy again."', 
    status: 'Published', 
    reports: 0,
    isAuthentic: true,
    authenticityScore: 98,
    authenticityReason: 'Balanced tone, specific criticism matching logistics delays. High authenticity index.',
    timestamp: '2026-06-10T09:12:00Z'
  },
  {
    id: '4',
    user: 'Sultana Ahmed',
    product: 'Aarong Silk Panjabi',
    store: 'Aarong Digital',
    rating: 5,
    comment: 'absolutely stunning design and pure silk fabric!!! highly recommended and great customer service from the store representative!',
    status: 'Published',
    reports: 0,
    isAuthentic: true,
    authenticityScore: 92,
    authenticityReason: 'Organic sentence structure, verified buyer credentials verified.',
    timestamp: '2026-06-09T18:00:00Z'
  },
  {
    id: '5',
    user: 'Hasan Al-Amin',
    product: 'Apex Mens Formal Leather',
    store: 'Apex Shoes',
    rating: 5,
    comment: 'CHEAP CHEAP CHEAP!!! BUY HERE INSTEAD OF THAT OTHER BRAND!!! http://spam-store.info/apex-shoes super fast shipment, discount code: BIGPROMO',
    status: 'pending',
    reports: 1,
    flags: ['Suspected Spam'],
    isAuthentic: false,
    authenticityScore: 15,
    authenticityReason: 'Aggressive block capitals, external links, promotional coupon advertisement.',
    timestamp: '2026-06-12T15:30:00Z'
  }
];

// Map store names to TrustCenter entity IDs for integrated reputation scoring
const getStoreEntityDetails = (storeName: string): { type: TrustEntityType; id: string; name: string } => {
  const nameLower = storeName.toLowerCase();
  if (nameLower.includes('aarong')) {
    return { type: 'brand', id: 'brand_aarong', name: 'Aarong Handcrafts' };
  } else if (nameLower.includes('apex')) {
    return { type: 'brand', id: 'brand_apex', name: 'Apex Footwear' };
  } else if (nameLower.includes('electro') || nameLower.includes('walton')) {
    return { type: 'brand', id: 'brand_walton', name: 'Walton Appliances' };
  } else {
    return { type: 'seller', id: 'seller_techzone', name: 'TechZone BD' };
  }
};

export const ReviewModerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addTrustEvent } = useTrust();
  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem('choosify_moderation_reviews');
    return saved ? JSON.parse(saved) : initialMockReviews;
  });

  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Persist reviews to local storage
  useEffect(() => {
    localStorage.setItem('choosify_moderation_reviews', JSON.stringify(reviews));
  }, [reviews]);

  const mapOpsReview = (row: OpsReview): Review => ({
    id: row.id,
    user: row.userName,
    product: row.productTitle,
    store: row.storeName || row.brandName,
    rating: row.rating,
    comment: row.comment,
    status:
      row.status === 'published'
        ? 'Published'
        : row.status === 'flagged'
          ? 'Flagged'
          : row.status === 'hidden'
            ? 'Hidden'
            : row.status === 'deleted'
              ? 'Deleted'
              : row.status === 'approved'
                ? 'Published'
                : (row.status as Review['status']),
    reports: row.reports,
    flags: row.flags,
    response: row.response,
    isAuthentic: row.isAuthentic,
    authenticityScore: row.authenticityScore,
    authenticityReason: row.authenticityReason,
    timestamp: row.createdAt,
  });

  useEffect(() => {
    operationsApi
      .listReviews()
      .then((apiReviews) => {
        if (!apiReviews.length) return;
        setReviews((prev) => {
          const mapped = apiReviews.map(mapOpsReview);
          const existingIds = new Set(prev.map((review) => review.id));
          const merged = [...mapped.filter((review) => !existingIds.has(review.id)), ...prev];
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  // Approve review (move from pending/flagged to Published)
  const approveReview = (id: string) => {
    setReviews(prev => {
      const match = prev.find(r => r.id === id);
      if (!match) return prev;

      showToast(`Review by ${match.user} has been approved & published.`, 'success');

      // Link to Reputation Scoring system
      try {
        const entity = getStoreEntityDetails(match.store);
        addTrustEvent(
          entity.type,
          entity.id,
          entity.name,
          'review_verified',
          5, // +5 Trust Points
          { reviewId: id, user: match.user, rating: match.rating }
        );
      } catch (err) {
        console.error('Error dispatching trust score increment on review approval:', err);
      }

      return prev.map(r => r.id === id ? { ...r, status: 'Published', reports: 0 } : r);
    });
    operationsApi.updateReview(id, { status: 'published' }).catch(() => {});
  };

  // Reject review (set status to Deleted/Hidden)
  const rejectReview = (id: string) => {
    setReviews(prev => {
      const match = prev.find(r => r.id === id);
      if (!match) return prev;

      showToast(`Review by ${match.user} has been rejected & archived.`, 'warning');

      // Link to Reputation Scoring: deduct trust points for spam removal
      try {
        const entity = getStoreEntityDetails(match.store);
        addTrustEvent(
          entity.type,
          entity.id,
          entity.name,
          'review_removed',
          -10, // -10 Trust Points for deleted reviews
          { reviewId: id, user: match.user, rating: match.rating }
        );
      } catch (err) {
        console.error('Error dispatching trust score deduction on review rejection:', err);
      }

      return prev.map(r => r.id === id ? { ...r, status: 'Deleted' } : r);
    });
    operationsApi.updateReview(id, { status: 'deleted' }).catch(() => {});
  };

  // Flag review with custom reasons
  const flagReview = (id: string, reason: string) => {
    setReviews(prev => {
      const match = prev.find(r => r.id === id);
      if (!match) return prev;

      showToast(`Review by ${match.user} flagged for: ${reason}`, 'info');

      const existingFlags = match.flags || [];
      const updatedFlags = existingFlags.includes(reason) ? existingFlags : [...existingFlags, reason];

      return prev.map(r => r.id === id ? { 
        ...r, 
        status: 'Flagged', 
        reports: r.reports + 1, 
        flags: updatedFlags 
      } : r);
    });
  };

  // Mark as spam instantly
  const markAsSpam = (id: string) => {
    setReviews(prev => {
      const match = prev.find(r => r.id === id);
      if (!match) return prev;

      showToast(`Deceptive fake review by ${match.user} marked as SPAM.`, 'error');

      // Heavy trust score penalty for deceptive/fake reviews
      try {
        const entity = getStoreEntityDetails(match.store);
        addTrustEvent(
          entity.type,
          entity.id,
          entity.name,
          'fake_review_detected',
          -20, // -20 Trust Points
          { reviewId: id, user: match.user, rating: match.rating, reason: 'Algorithmic or Admin flag' }
        );
      } catch (err) {
        console.error('Error dispatching trust score deduction on spam flagging:', err);
      }

      const existingFlags = match.flags || [];
      const updatedFlags = existingFlags.includes('Deceptive Spam') ? existingFlags : [...existingFlags, 'Deceptive Spam'];

      return prev.map(r => r.id === id ? { 
        ...r, 
        status: 'Flagged', 
        isAuthentic: false,
        authenticityScore: 5,
        authenticityReason: 'Flagged as definitive fake review/spam payload.',
        reports: r.reports + 2, 
        flags: updatedFlags 
      } : r);
    });
  };

  // Submit response
  const addSellerResponse = (reviewId: string, author: string, text: string) => {
    setReviews(prev => {
      const match = prev.find(r => r.id === reviewId);
      if (!match) return prev;

      showToast('Merchant reply recorded successfully.', 'success');

      return prev.map(r => r.id === reviewId ? {
        ...r,
        response: {
          id: `resp-${reviewId}-${Date.now()}`,
          author,
          comment: text,
          timestamp: new Date().toLocaleDateString()
        }
      } : r);
    });
  };

  // Delete review from listing
  const deleteReview = (id: string) => {
    setReviews(prev => {
      const match = prev.find(r => r.id === id);
      if (!match) return prev;
      showToast('Review permanently expunged from platform.', 'warning');
      return prev.filter(r => r.id !== id);
    });
    operationsApi.deleteReview(id).catch(() => {});
  };

  // Run Batch Analysis for spam/fake review detection
  const runBatchAnalysis = () => {
    setReviews(prev => {
      let flaggedCount = 0;
      const updatedReviews = prev.map(r => {
        const text = r.comment;
        const flags: string[] = [...(r.flags || [])];
        let score = r.authenticityScore !== undefined ? r.authenticityScore : 100;
        let reason = r.authenticityReason || 'Passed basic algorithmic validation checks.';
        let isAuthentic = r.isAuthentic !== undefined ? r.isAuthentic : true;
        let newStatus = r.status;

        // Rule 1: Link Hijacking / Affiliate codes
        const urlRegex = /(https?:\/\/[^\s]+|bit\.ly\/[a-zA-Z0-9]+|www\.[^\s]+)/i;
        if (urlRegex.test(text)) {
          score -= 40;
          if (!flags.includes('External Links')) flags.push('External Links');
          reason = 'Contains external links, redirect codes, or suspected malware hooks.';
        }

        // Rule 2: Aggressive Block Capitals (Spam Indicator)
        const capitalWords = text.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
        const allCapsWords = capitalWords.filter(w => w === w.toUpperCase());
        if (capitalWords.length > 0 && (allCapsWords.length / capitalWords.length) > 0.4) {
          score -= 30;
          if (!flags.includes('Suspected Spam')) flags.push('Suspected Spam');
          reason = 'Aggressive uppercase text patterns and block capitalization detected.';
        }

        // Rule 3: Specific Deceptive Trigger Words
        const negativeSpamKeywords = ['cheat', 'scammer', 'scam', 'fraud', 'garbage', 'fake', 'stolen', 'ruined'];
        const matchedSpamKeywords = negativeSpamKeywords.filter(k => text.toLowerCase().includes(k));
        if (matchedSpamKeywords.length >= 2) {
          score -= 25;
          if (!flags.includes('Abusive Language')) flags.push('Abusive Language');
          reason = 'Detected multiple extreme accusations or blacklisted abusive phrasing.';
        }

        // Rule 4: Suspicious Repetitive characters (!!!, $$$, 100% genuine)
        if (/(\!{3,}|\${3,}|\?{3,})/i.test(text) || /100%\s*(genuine|real|authentic)/i.test(text)) {
          score -= 15;
          if (!flags.includes('Excessive Accents')) flags.push('Excessive Accents');
        }

        // Apply final status corrections based on derived score
        if (score < 50) {
          isAuthentic = false;
          if (newStatus === 'pending' || newStatus === 'Published') {
            newStatus = 'Flagged';
            flaggedCount++;
          }
        } else {
          isAuthentic = true;
        }

        return {
          ...r,
          flags: Array.from(new Set(flags)),
          authenticityScore: Math.max(0, Math.min(100, score)),
          authenticityReason: reason,
          isAuthentic,
          status: newStatus,
          reports: score < 50 ? r.reports + 1 : r.reports
        };
      });

      if (flaggedCount > 0) {
        showToast(`Batch execution: Found ${flaggedCount} suspicious reviews. Auto-flagged.`, 'warning');
      } else {
        showToast('Batch execution completed. All reviews passed check.', 'success');
      }

      return updatedReviews;
    });
  };

  const updateReviewComment = (id: string, text: string) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, comment: text, isAuthentic: undefined } : r));
    showToast('Review comment updated. Run analysis to re-audit.', 'info');
  };

  const toggleReviewStatus = (id: string, status: Review['status']) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    showToast(`Review status updated to: ${status}`, 'success');
  };

  return (
    <ReviewModerationContext.Provider value={{
      reviews,
      toasts,
      showToast,
      removeToast,
      approveReview,
      rejectReview,
      flagReview,
      markAsSpam,
      addSellerResponse,
      deleteReview,
      runBatchAnalysis,
      updateReviewComment,
      toggleReviewStatus
    }}>
      {children}
    </ReviewModerationContext.Provider>
  );
};
