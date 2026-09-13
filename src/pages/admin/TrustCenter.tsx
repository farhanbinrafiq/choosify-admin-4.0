import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { moderationApi, type TrustOverview } from '../../services/moderationApi';

/**
 * Trust & Analytics -- an aggregate dashboard, not another moderation queue.
 * Every number here is read from the SAME canonical Choosify Reputation
 * Score used elsewhere (server/moderation/reputationEngine.ts, exposed at
 * GET /admin/reputation) plus real dispute/moderation/order data -- no
 * second/competing trust score, no fake AI or fraud score, no fabricated
 * counters. A metric that has no real data source yet is labeled "—", never
 * invented.
 */
export default function TrustCenter() {
  const [data, setData] = useState<TrustOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    moderationApi
      .getTrustOverview()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load trust overview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error || !data) {
    return <div className="p-8 text-[13px] font-semibold text-red-600">{error || 'Failed to load'}</div>;
  }

  const metrics: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: 'Avg. Seller Reputation',
      value: data.reputation.avgSellerReputation !== null ? `${data.reputation.avgSellerReputation} / 100` : '—',
      sub: `${data.reputation.sellerCount} sellers scored`,
    },
    {
      label: 'Avg. Creator Reputation',
      value: data.reputation.avgCreatorReputation !== null ? `${data.reputation.avgCreatorReputation} / 100` : '—',
      sub: `${data.reputation.creatorCount} creators scored`,
    },
    {
      label: `Accounts Below Threshold (<${data.reputation.threshold})`,
      value: String(data.reputation.accountsBelowThreshold),
    },
    { label: 'Open Disputes', value: `${data.disputes.open} / ${data.disputes.total}` },
    { label: 'Flagged Content', value: String(data.moderation.flaggedContent) },
    { label: 'Open Content Reports', value: String(data.moderation.openReports) },
    { label: 'Cancellation Rate', value: data.performance.cancellationRatePct !== null ? `${data.performance.cancellationRatePct}%` : '—' },
    { label: 'Return Rate', value: data.performance.returnRatePct !== null ? `${data.performance.returnRatePct}%` : '—' },
    { label: 'Warranty Claim Rate', value: data.performance.warrantyClaimRatePct !== null ? `${data.performance.warrantyClaimRatePct}%` : '—' },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-[15px] font-extrabold text-[#111827]">
          <ShieldCheck className="h-4 w-4 text-orange-500" /> Trust & Analytics
        </div>
        <div className="text-[11px] font-semibold text-[#6B7280]">
          Aggregate trust, reputation, and platform-health signals · reads the same reputation engine as Moderation Center
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#9AA0AC]">{m.label}</div>
            <div className="mt-1 text-[20px] font-extrabold text-[#111827]">{m.value}</div>
            {m.sub && <div className="text-[10px] text-[#9AA0AC]">{m.sub}</div>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#E8EDF2] bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Accounts Requiring Attention
        </div>
        {data.accountsRequiringAttention.length === 0 ? (
          <div className="text-[12px] text-[#9AA0AC]">No accounts currently below the reputation threshold or carrying active complaints.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E8EDF2] text-left text-[10px] font-black uppercase tracking-wide text-[#9AA0AC]">
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Reputation</th>
                  <th className="py-2 pr-3">Review Rating</th>
                  <th className="py-2 pr-3">Main issue</th>
                </tr>
              </thead>
              <tbody>
                {data.accountsRequiringAttention.map((a) => (
                  <tr key={a.sellerId} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="py-2 pr-3 font-mono text-[11px] text-[#1A1A2E]">{a.sellerName || a.sellerId}</td>
                    <td className="py-2 pr-3 capitalize">{a.role}</td>
                    <td className="py-2 pr-3 font-bold">
                      {a.reputationScore} / 100 <span className="text-[#9AA0AC]">({a.grade})</span>
                    </td>
                    <td className="py-2 pr-3">{a.reviewRating !== null ? `${a.reviewRating} / 5` : '—'}</td>
                    <td className="py-2 pr-3 text-[#6B7280]">{a.mainIssue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-bold">
        <Link to="/admin/moderation" className="text-orange-600 hover:underline">
          Go to Moderation Center →
        </Link>
        <Link to="/admin/disputes" className="text-orange-600 hover:underline">
          Go to Disputes →
        </Link>
        <Link to="/admin/brand-verification" className="text-orange-600 hover:underline">
          Go to Verification Center →
        </Link>
      </div>
    </div>
  );
}
