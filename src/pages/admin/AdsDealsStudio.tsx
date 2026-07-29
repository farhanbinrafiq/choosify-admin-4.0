import React, { useMemo, useState } from 'react';
import { Megaphone, Tag, LayoutTemplate, Inbox, CheckCircle, XCircle } from 'lucide-react';
import { useAds, PromotionRequest, PromotionType } from '../../contexts/AdsContext';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import AdsSponsorsPage from './AdsSponsors';
import DealsPage from './Deals';
import SponsoredPromotionsPage from './SponsoredPromotions';

type StudioTab = 'requests' | 'ads' | 'deals' | 'placements';

const CONTENT_TYPE_LABEL: Record<PromotionRequest['contentType'], string> = {
  PRODUCT: 'Product',
  DEAL: 'Deal',
  RECOMMENDATION: 'Recommendation',
  BRAND: 'Brand',
  POST: 'Post',
  CREATOR: 'Creator',
  GUIDE: 'Guide',
};

export default function AdsDealsStudio() {
  const { promotionRequests, approvePromotionRequest, rejectPromotionRequest, deletePromotionRequest } = useAds();
  const [activeTab, setActiveTab] = useState<StudioTab>('requests');
  const [contentTypeFilter, setContentTypeFilter] = useState<'ALL' | PromotionRequest['contentType']>('ALL');
  const [reviewingRequest, setReviewingRequest] = useState<PromotionRequest | null>(null);
  const [reviewPlacement, setReviewPlacement] = useState('homepage_banner');
  const [reviewPriority, setReviewPriority] = useState(50);

  const filteredRequests = useMemo(
    () => promotionRequests.filter((r) => contentTypeFilter === 'ALL' || r.contentType === contentTypeFilter),
    [promotionRequests, contentTypeFilter]
  );

  const pendingCount = promotionRequests.filter((r) => r.approvalStatus === 'PENDING').length;
  const approvedCount = promotionRequests.filter((r) => r.approvalStatus === 'APPROVED').length;
  const rejectedCount = promotionRequests.filter((r) => r.approvalStatus === 'REJECTED').length;

  const openReview = (request: PromotionRequest) => {
    setReviewingRequest(request);
    setReviewPlacement(request.placementRequest || 'homepage_banner');
    setReviewPriority(50);
  };

  const confirmApprove = async () => {
    if (!reviewingRequest) return;
    const promoTypeByContentType: Record<PromotionRequest['contentType'], PromotionType> = {
      PRODUCT: 'PRODUCT',
      BRAND: 'BRAND',
      DEAL: 'DEAL',
      POST: 'POST',
      RECOMMENDATION: 'RECOMMENDATION',
      CREATOR: 'RECOMMENDATION',
      GUIDE: 'POST',
    };
    await approvePromotionRequest(reviewingRequest.id, {
      type: promoTypeByContentType[reviewingRequest.contentType],
      targetId: reviewingRequest.contentId,
      title: reviewingRequest.contentName,
      subtitle: `${reviewingRequest.requestedPromotionType} · requested by ${reviewingRequest.requesterName}`,
      status: 'ACTIVE',
      placement: reviewPlacement,
      targeting: [],
      priority: reviewPriority,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + reviewingRequest.duration * 24 * 60 * 60 * 1000).toISOString(),
    });
    setReviewingRequest(null);
  };

  const columns: DataTableColumn<PromotionRequest>[] = [
    {
      key: 'content',
      header: 'Content',
      sortValue: (r) => r.contentName,
      render: (r) => (
        <div>
          <div className="text-[13px] font-bold text-app-text-primary">{r.contentName}</div>
          <div className="text-[10px] text-app-text-secondary">
            {CONTENT_TYPE_LABEL[r.contentType]} · requested by {r.requesterName} ({r.requesterRole})
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Requested Type',
      render: (r) => <Badge variant="accent">{r.requestedPromotionType}</Badge>,
    },
    {
      key: 'priority',
      header: 'Feature Priority',
      render: (r) => <span className="text-[11px] text-app-text-secondary">{r.featurePriority}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      sortValue: (r) => r.duration,
      render: (r) => <span className="font-mono text-[12px]">{r.duration}d</span>,
    },
    {
      key: 'placement',
      header: 'Placement',
      render: (r) => <span className="text-[11px] text-app-text-secondary font-mono">{r.placementRequest}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.approvalStatus,
      render: (r) => (
        <Badge variant={r.approvalStatus === 'APPROVED' ? 'success' : r.approvalStatus === 'REJECTED' ? 'danger' : 'warning'}>
          {r.approvalStatus}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) =>
        r.approvalStatus === 'PENDING' ? (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => openReview(r)}
              className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 hover:bg-emerald-100 transition-all"
              title="Approve & feature"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => rejectPromotionRequest(r.id)}
              className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 hover:bg-rose-100 transition-all"
              title="Reject request"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() => deletePromotionRequest(r.id)}
              className="text-[10px] font-bold text-app-text-secondary hover:text-app-accent uppercase tracking-wider"
            >
              Clear
            </button>
          </div>
        ),
    },
  ];

  const tabs: TabItem[] = [
    { key: 'requests', label: 'Feature Requests', icon: Inbox, badge: pendingCount },
    { key: 'ads', label: 'Sponsored Ads', icon: Megaphone },
    { key: 'deals', label: 'Deals & Coupons', icon: Tag },
    { key: 'placements', label: 'Placements & Featured', icon: LayoutTemplate },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Ads & Deals Studio</h1>
        <p className="text-app-text-secondary text-[12px]">
          Unified approval queue for seller/creator feature &amp; sponsor requests, plus sponsored ads, deals, and placement management.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Pending Requests" value={pendingCount} icon={Inbox} accent="orange" />
        <StatTile label="Approved" value={approvedCount} icon={CheckCircle} accent="emerald" />
        <StatTile label="Rejected" value={rejectedCount} icon={XCircle} accent="rose" />
        <StatTile label="Total Requests" value={promotionRequests.length} icon={Megaphone} accent="indigo" />
      </div>

      <Tabs tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as StudioTab)} />

      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {(['ALL', 'PRODUCT', 'BRAND', 'CREATOR', 'DEAL', 'POST', 'GUIDE', 'RECOMMENDATION'] as const).map((ct) => (
              <button
                key={ct}
                onClick={() => setContentTypeFilter(ct)}
                className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all ${
                  contentTypeFilter === ct ? 'bg-app-accent text-white' : 'bg-white border border-app-border text-app-text-secondary hover:text-app-text-primary'
                }`}
              >
                {ct === 'ALL' ? 'All Types' : CONTENT_TYPE_LABEL[ct]}
              </button>
            ))}
          </div>

          <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
            <DataTable
              columns={columns}
              rows={filteredRequests}
              getRowId={(r) => r.id}
              emptyMessage="No feature or sponsor requests yet. Seller/creator submissions will appear here for review."
            />
          </GlassCard>
        </div>
      )}

      {activeTab === 'ads' && <AdsSponsorsPage />}
      {activeTab === 'deals' && <DealsPage />}
      {activeTab === 'placements' && <SponsoredPromotionsPage />}

      <Modal
        isOpen={!!reviewingRequest}
        onClose={() => setReviewingRequest(null)}
        title={reviewingRequest ? `Approve & Feature — ${reviewingRequest.contentName}` : 'Approve & Feature'}
        maxWidth="max-w-md"
        footer={
          <button
            onClick={confirmApprove}
            className="w-full py-2.5 bg-app-accent hover:bg-app-accent-hover text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
          >
            Approve & Publish Promotion
          </button>
        }
      >
        {reviewingRequest && (
          <div className="space-y-4">
            <p className="text-[11px] text-app-text-secondary">
              Requested by <span className="font-bold text-app-text-primary">{reviewingRequest.requesterName}</span> ·{' '}
              {reviewingRequest.requestedPromotionType} · {reviewingRequest.duration} day(s)
            </p>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Placement</label>
              <select
                value={reviewPlacement}
                onChange={(e) => setReviewPlacement(e.target.value)}
                className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
              >
                <option value="homepage_banner">Homepage Banner</option>
                <option value="trending_section">Trending Section</option>
                <option value="category_top">Category Top</option>
                <option value="listing_boost">Listing Boost</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Priority / Boost Weight (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={reviewPriority}
                onChange={(e) => setReviewPriority(Number(e.target.value))}
                className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
