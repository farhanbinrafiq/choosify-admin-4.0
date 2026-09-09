import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Package,
  ChevronLeft,
  CheckCircle2,
  Archive as ArchiveIcon,
  Eye,
  EyeOff,
  Star,
  History,
  Users,
  Gift,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { AdminWorkspaceLayout } from '../../components/Layout/AdminWorkspaceLayout';
import { subscriptionsApi, type PlanListRow, type PlanDetail, type PlanVersionDetail, type SubscriberRow, type WorkspaceLookupRow } from '../../services/subscriptionsApi';
import { PARTNER_FEATURES, featureKeysForRole, type PartnerFeatureKey } from '../../../shared/entitlements/registry';
import type { WorkspaceType, PlanBillingInterval } from '../../../server/subscriptions/types';

/**
 * Sprint 12, Phase 4 — Super Admin Subscription Plans workspace. Replaces the
 * AdminFeatureNotAvailable placeholder at /admin/promotions. Entirely backed
 * by the real Phase 3 backend (server/subscriptions/*) — no invented plans,
 * prices, features, limits, or subscriber counts anywhere in this file.
 */

// ── Known candidate quantitative limit keys ──────────────────────────────
// No canonical backend registry exists for limit keys the way PARTNER_FEATURES
// exists for boolean features (plan_limits.limit_key is intentionally
// free-form). These two are the only ones named anywhere in the approved
// architecture (team_member_limit, active_voucher_limit) — offered as
// suggestions only; Super Admin may still type any key the business needs.
const KNOWN_LIMIT_KEYS = ['team_member_limit', 'active_voucher_limit'];

const FEATURE_LABELS: Record<string, string> = Object.fromEntries(PARTNER_FEATURES.map((f) => [f.key, f.label]));

function formatMoney(minorUnits: number, currency: string): string {
  const symbol = currency === 'BDT' ? '৳' : `${currency} `;
  return `${symbol}${(minorUnits / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoneyToMinorUnits(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Small shared UI primitives (scoped to this page — no shared Modal component exists to reuse) ──

function Banner({ kind, children, onDismiss }: { kind: 'error' | 'success'; children: React.ReactNode; onDismiss?: () => void }) {
  const styles = kind === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-[12px] font-semibold ${styles}`}>
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-xl border border-dashed border-app-border bg-app-card">
      <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF] mb-3">{icon}</div>
      <div className="text-[14px] font-extrabold text-app-text-primary">{title}</div>
      <div className="text-[12px] text-app-text-secondary font-semibold mt-1 max-w-sm">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-app-text-secondary">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-[12px] font-bold">{label}</span>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className={`bg-app-card border border-app-border rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <div className="text-[14px] font-extrabold text-app-text-primary">{title}</div>
          <button onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function LifecycleBadge({ state }: { state: 'draft' | 'published' | 'archived' }) {
  const map = {
    draft: 'bg-amber-50 border-amber-200 text-amber-700',
    published: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    archived: 'bg-gray-100 border-gray-300 text-gray-600',
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${map[state]}`}>
      {state}
    </span>
  );
}

function PersonaBadge({ role }: { role: WorkspaceType }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-blue-700">
      {role === 'seller' ? 'Seller' : 'Creator'}
    </span>
  );
}

// ── Plan List ──────────────────────────────────────────────────────────

function PlanListView({ onSelectPlan, onCreated }: { onSelectPlan: (id: string) => void; onCreated: (id: string) => void }) {
  const [plans, setPlans] = useState<PlanListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setError(null);
    subscriptionsApi
      .listPlans()
      .then((r) => setPlans(r.plans))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load plans'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Subscription Plans</h1>
          <p className="text-[12.5px] text-app-text-secondary mt-1">Define what Choosify sells to Sellers and Creators — pricing, features, and limits.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#18154C] text-white text-[12px] font-extrabold px-3.5 py-2 hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Create Plan
        </button>
      </div>

      {error && <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>}

      {plans === null && !error && <LoadingBlock label="Loading plans…" />}

      {plans !== null && plans.length === 0 && (
        <EmptyState
          icon={<Package className="w-5 h-5" />}
          title="No subscription plans created yet"
          description="Create your first Seller or Creator plan. Plans start as an unpublished Draft — nothing is sold until you publish a version with real pricing."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#18154C] text-white text-[12px] font-extrabold px-4 py-2 hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" /> Create Plan
            </button>
          }
        />
      )}

      {plans !== null && plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPlan(p.id)}
              className="text-left bg-app-card border border-app-border rounded-xl p-4 hover:border-[#18154C] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13.5px] font-extrabold text-app-text-primary truncate">{p.name}</div>
                {p.isRecommended && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <PersonaBadge role={p.role} />
                <LifecycleBadge state={p.lifecycleState} />
                {p.isPublic ? (
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-700"><Eye className="w-3 h-3" />Public</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-gray-500"><EyeOff className="w-3 h-3" />Private</span>
                )}
              </div>
              <div className="mt-3 space-y-1">
                {p.currentVersion ? (
                  p.currentVersion.offers.length > 0 ? (
                    p.currentVersion.offers.map((o) => (
                      <div key={o.id} className="text-[11.5px] font-bold text-app-text-primary">
                        {formatMoney(o.price, o.currency)} <span className="text-app-text-secondary font-semibold">/ {o.billingInterval}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] font-semibold text-app-text-secondary italic">Published version has no offer configured</div>
                  )
                ) : (
                  <div className="text-[11px] font-semibold text-app-text-secondary italic">No published version yet</div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-app-border flex items-center justify-between text-[10.5px] font-bold text-app-text-secondary">
                <span>Order #{p.sortOrder}</span>
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {p.subscriberCount} subscriber{p.subscriberCount === 1 ? '' : 's'}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePlanModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            onCreated(id);
          }}
        />
      )}
    </div>
  );
}

function CreatePlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<WorkspaceType>('seller');
  const [description, setDescription] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Plan name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { plan } = await subscriptionsApi.createPlan({ role, name: name.trim(), description: description.trim() || undefined, internalCode: internalCode.trim() || undefined });
      onCreated(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create plan');
      setSaving(false);
    }
  };

  return (
    <Modal title="Create Plan" onClose={onClose}>
      <div className="space-y-3.5">
        {error && <Banner kind="error">{error}</Banner>}
        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Plan Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Growth Seller" className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[13px] font-semibold bg-transparent" />
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Persona</label>
          <div className="mt-1 flex gap-2">
            {(['seller', 'creator'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-extrabold ${role === r ? 'bg-[#18154C] text-white border-[#18154C]' : 'border-app-border text-app-text-primary'}`}
              >
                {r === 'seller' ? 'Seller' : 'Creator'}
              </button>
            ))}
          </div>
          <p className="text-[10.5px] text-app-text-secondary font-semibold mt-1">Persona cannot be changed after creation.</p>
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent" />
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Internal Code (optional)</label>
          <input value={internalCode} onChange={(e) => setInternalCode(e.target.value)} placeholder="e.g. seller_growth" className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent" />
        </div>
        <p className="text-[10.5px] text-app-text-secondary font-semibold">This creates catalog identity only — no price is required yet. You'll configure a Draft Version with real billing offers next.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold text-app-text-primary">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">
            {saving ? 'Creating…' : 'Create Plan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Plan Editor ────────────────────────────────────────────────────────

type EditorTab = 'identity' | 'current' | 'draft' | 'history' | 'subscribers';

function PlanEditorView({ planId, onBack }: { planId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>('identity');

  const load = useCallback(() => {
    setError(null);
    subscriptionsApi
      .getPlanDetail(planId)
      .then((d) => setDetail(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load plan'));
  }, [planId]);

  useEffect(() => {
    setDetail(null);
    load();
  }, [load]);

  if (error) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} />
        <Banner kind="error">{error}</Banner>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} />
        <LoadingBlock label="Loading plan…" />
      </div>
    );
  }

  const { plan, versions } = detail;
  const publishedVersion = versions.find((v) => v.id === plan.currentPublishedVersionId) ?? null;
  const draftVersion = versions.find((v) => v.publishedAt === null) ?? null;
  const historyVersions = versions.filter((v) => v.publishedAt !== null);

  const TABS: { key: EditorTab; label: string; icon: React.ReactNode }[] = [
    { key: 'identity', label: 'Plan Identity', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'current', label: 'Current Version', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { key: 'draft', label: 'Draft Changes', icon: <Loader2 className="w-3.5 h-3.5" /> },
    { key: 'history', label: 'Version History', icon: <History className="w-3.5 h-3.5" /> },
    { key: 'subscribers', label: 'Subscribers', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5 pb-10">
      <BackBar onBack={onBack} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-app-text-primary tracking-tight">{plan.name}</h1>
            <PersonaBadge role={plan.role} />
            <LifecycleBadge state={plan.lifecycleState} />
          </div>
          <p className="text-[12px] text-app-text-secondary font-semibold mt-1">{plan.description || 'No description set.'}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-app-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-extrabold border-b-2 whitespace-nowrap ${
              tab === t.key ? 'border-[#18154C] text-app-text-primary' : 'border-transparent text-app-text-secondary hover:text-app-text-primary'
            }`}
          >
            {t.icon} {t.label}
            {t.key === 'draft' && draftVersion && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          </button>
        ))}
      </div>

      {tab === 'identity' && <IdentitySection plan={plan} onChanged={load} />}
      {tab === 'current' && <CurrentVersionTab plan={plan} version={publishedVersion} />}
      {tab === 'draft' && <DraftVersionTab plan={plan} draft={draftVersion} onChanged={load} />}
      {tab === 'history' && <VersionHistoryTab versions={historyVersions} plan={plan} />}
      {tab === 'subscribers' && <SubscribersTab plan={plan} publishedVersion={publishedVersion} />}
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-app-text-secondary hover:text-app-text-primary">
      <ChevronLeft className="w-4 h-4" /> Back to Subscription Plans
    </button>
  );
}

// ── Identity section ──────────────────────────────────────────────────

function IdentitySection({ plan, onChanged }: { plan: PlanDetail['plan']; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description || '');
  const [badge, setBadge] = useState(plan.badge || '');
  const [isPublic, setIsPublic] = useState(plan.isPublic);
  const [isRecommended, setIsRecommended] = useState(plan.isRecommended);
  const [sortOrder, setSortOrder] = useState(plan.sortOrder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const startEdit = () => {
    setName(plan.name);
    setDescription(plan.description || '');
    setBadge(plan.badge || '');
    setIsPublic(plan.isPublic);
    setIsRecommended(plan.isRecommended);
    setSortOrder(plan.sortOrder);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Plan name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await subscriptionsApi.updatePlanMetadata(plan.id, {
        name: name.trim(),
        description: description.trim() || null,
        badge: badge.trim() || null,
        isPublic,
        isRecommended,
        sortOrder,
      });
      setEditing(false);
      setSuccess('Plan identity updated.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    setArchiving(true);
    try {
      await subscriptionsApi.archivePlan(plan.id);
      setShowArchiveConfirm(false);
      setSuccess('Plan archived. Existing subscribers and version history are unaffected.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4 max-w-2xl">
      {success && <Banner kind="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}
      {error && <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>}

      {!editing ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-extrabold text-app-text-primary">Plan Identity</div>
            <div className="flex gap-2">
              <button onClick={startEdit} className="text-[11.5px] font-extrabold text-blue-600 hover:underline">Edit</button>
              {plan.lifecycleState !== 'archived' && (
                <button onClick={() => setShowArchiveConfirm(true)} className="inline-flex items-center gap-1 text-[11.5px] font-extrabold text-red-600 hover:underline">
                  <ArchiveIcon className="w-3.5 h-3.5" /> Archive
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={plan.name} />
            <Field label="Internal Code" value={plan.internalCode || '—'} />
            <Field label="Badge" value={plan.badge || '—'} />
            <Field label="Display Order" value={String(plan.sortOrder)} />
            <Field label="Visibility" value={plan.isPublic ? 'Public (listed to Sellers/Creators)' : 'Private (hidden from catalog)'} />
            <Field label="Recommended" value={plan.isRecommended ? 'Yes' : 'No'} />
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">DESCRIPTION</div>
            <div className="text-[12.5px] font-semibold text-app-text-primary mt-1">{plan.description || '—'}</div>
          </div>
        </>
      ) : (
        <>
          <div className="text-[12px] font-extrabold text-app-text-primary">Edit Plan Identity</div>
          <div className="grid grid-cols-2 gap-3.5">
            <LabeledInput label="Name" value={name} onChange={setName} />
            <LabeledInput label="Badge" value={badge} onChange={setBadge} placeholder="e.g. Most Popular" />
            <LabeledInput label="Display Order" type="number" value={String(sortOrder)} onChange={(v) => setSortOrder(Number(v) || 0)} />
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-app-text-primary">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public
              </label>
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-app-text-primary">
                <input type="checkbox" checked={isRecommended} onChange={(e) => setIsRecommended(e.target.checked)} /> Recommended
              </label>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold text-app-text-primary">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}

      {showArchiveConfirm && (
        <Modal title="Archive this Plan?" onClose={() => setShowArchiveConfirm(false)}>
          <div className="space-y-3">
            <p className="text-[12.5px] font-semibold text-app-text-primary">
              Archiving removes <strong>{plan.name}</strong> from the catalog so it can no longer be newly subscribed to. Existing subscribers, their subscription
              history, and every published version remain completely unchanged.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowArchiveConfirm(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
              <button onClick={archive} disabled={archiving} className="rounded-lg bg-red-600 text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">
                {archiving ? 'Archiving…' : 'Archive Plan'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">{label.toUpperCase()}</div>
      <div className="text-[12.5px] font-bold text-app-text-primary mt-1">{value}</div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent"
      />
    </div>
  );
}

// ── Current Version (read-only) ───────────────────────────────────────

function CurrentVersionTab({ plan, version }: { plan: PlanDetail['plan']; version: PlanVersionDetail | null }) {
  if (!version) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="w-5 h-5" />}
        title="No published version yet"
        description="This Plan has never been published. Configure and publish a Draft Version to make it purchasable."
      />
    );
  }
  return <VersionDetailCard version={version} plan={plan} readOnlyNote="Published versions are immutable. To change price, features, or limits, create a new Draft Version." />;
}

function VersionDetailCard({ version, plan, readOnlyNote }: { version: PlanVersionDetail; plan: PlanDetail['plan']; readOnlyNote?: string }) {
  const enabledFeatures = version.entitlements.filter((e) => e.enabled);
  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[12px] font-extrabold text-app-text-primary">Version {version.version} — {version.nameSnapshot}</div>
        {version.publishedAt ? (
          <span className="text-[10.5px] font-bold text-app-text-secondary">Published {formatDate(version.publishedAt)}</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-amber-700">Draft</span>
        )}
      </div>
      {version.descriptionSnapshot && <p className="text-[12px] font-semibold text-app-text-secondary">{version.descriptionSnapshot}</p>}

      <div>
        <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide mb-1.5">BILLING OFFERS</div>
        {version.offers.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-app-text-secondary italic">No offer configured</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {version.offers.map((o) => (
              <div key={o.id} className="rounded-lg border border-app-border px-3 py-2">
                <div className="text-[13px] font-extrabold text-app-text-primary">{formatMoney(o.price, o.currency)}</div>
                <div className="text-[10px] font-bold text-app-text-secondary uppercase">{o.billingInterval}</div>
              </div>
            ))}
          </div>
        )}
        {version.trialDays ? <div className="text-[11px] font-semibold text-app-text-secondary mt-1.5">{version.trialDays}-day trial included</div> : null}
      </div>

      <div>
        <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide mb-1.5">INCLUDED FEATURES ({enabledFeatures.length})</div>
        {enabledFeatures.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-app-text-secondary italic">No features selected</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enabledFeatures.map((e) => (
              <span key={e.featureKey} className="rounded-full bg-[#EFF6FF] border border-blue-100 px-2.5 py-1 text-[10.5px] font-bold text-blue-700">
                {FEATURE_LABELS[e.featureKey] || e.featureKey}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide mb-1.5">QUANTITATIVE LIMITS</div>
        {version.limits.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-app-text-secondary italic">No limits configured</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {version.limits.map((l) => (
              <div key={l.limitKey} className="flex items-center justify-between rounded-lg border border-app-border px-3 py-1.5">
                <span className="text-[11px] font-bold text-app-text-primary">{l.limitKey}</span>
                <span className="text-[11px] font-extrabold text-app-text-secondary">{l.limitValue === null ? 'Unlimited' : l.limitValue}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {readOnlyNote && (
        <div className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] border border-app-border px-3 py-2.5 text-[11px] font-semibold text-app-text-secondary">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" /> {readOnlyNote}
        </div>
      )}
    </div>
  );
}

// ── Draft Version ─────────────────────────────────────────────────────

function DraftVersionTab({ plan, draft, onChanged }: { plan: PlanDetail['plan']; draft: PlanVersionDetail | null; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [nameSnapshot, setNameSnapshot] = useState(plan.name);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const createDraft = async () => {
    setError(null);
    try {
      await subscriptionsApi.createDraftVersion(plan.id, { nameSnapshot: nameSnapshot.trim() || plan.name });
      setCreating(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create draft version');
    }
  };

  if (!draft) {
    return (
      <div className="space-y-3">
        {error && <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>}
        <EmptyState
          icon={<Loader2 className="w-5 h-5" />}
          title="No draft in progress"
          description="Create a new Draft Version to configure pricing, features, and limits. It stays fully editable until you explicitly publish it."
          action={
            !creating ? (
              <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#18154C] text-white text-[12px] font-extrabold px-4 py-2">
                <Plus className="w-3.5 h-3.5" /> Create Draft Version
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input value={nameSnapshot} onChange={(e) => setNameSnapshot(e.target.value)} className="rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent" />
                <button onClick={createDraft} className="rounded-lg bg-[#18154C] text-white px-3.5 py-2 text-[12px] font-extrabold">Create</button>
                <button onClick={() => setCreating(false)} className="rounded-lg border border-app-border px-3.5 py-2 text-[12px] font-extrabold">Cancel</button>
              </div>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {success && <Banner kind="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}
      {error && <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-[11px] font-semibold text-blue-800">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> This Draft Version is fully editable. Nothing here affects existing subscribers until you Publish.
      </div>
      <DraftMetadataSection plan={plan} draft={draft} onChanged={onChanged} setError={setError} setSuccess={setSuccess} />
      <DraftOffersSection plan={plan} draft={draft} onChanged={onChanged} setError={setError} setSuccess={setSuccess} />
      <DraftFeaturesSection plan={plan} draft={draft} onChanged={onChanged} setError={setError} setSuccess={setSuccess} />
      <DraftLimitsSection plan={plan} draft={draft} onChanged={onChanged} setError={setError} setSuccess={setSuccess} />
      <PublishSection plan={plan} draft={draft} onChanged={onChanged} setError={setError} />
    </div>
  );
}

type DraftSectionProps = {
  plan: PlanDetail['plan'];
  draft: PlanVersionDetail;
  onChanged: () => void;
  setError: (e: string | null) => void;
  setSuccess: (s: string | null) => void;
};

function DraftMetadataSection({ plan, draft, onChanged, setError, setSuccess }: DraftSectionProps) {
  const [editing, setEditing] = useState(false);
  const [nameSnapshot, setNameSnapshot] = useState(draft.nameSnapshot);
  const [descriptionSnapshot, setDescriptionSnapshot] = useState(draft.descriptionSnapshot || '');
  const [trialDays, setTrialDays] = useState(draft.trialDays ?? 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await subscriptionsApi.updateDraftVersion(plan.id, draft.id, {
        nameSnapshot: nameSnapshot.trim() || draft.nameSnapshot,
        descriptionSnapshot: descriptionSnapshot.trim() || null,
        trialDays: trialDays > 0 ? trialDays : null,
      });
      setEditing(false);
      setSuccess('Draft details saved.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save draft details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-extrabold text-app-text-primary">Version {draft.version} Details</div>
        {!editing && <button onClick={() => setEditing(true)} className="text-[11.5px] font-extrabold text-blue-600 hover:underline">Edit</button>}
      </div>
      {!editing ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" value={draft.nameSnapshot} />
          <Field label="Trial" value={draft.trialDays ? `${draft.trialDays} days` : 'None'} />
          <div className="col-span-2">
            <Field label="Description" value={draft.descriptionSnapshot || '—'} />
          </div>
        </div>
      ) : (
        <>
          <LabeledInput label="Name" value={nameSnapshot} onChange={setNameSnapshot} />
          <div>
            <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Description</label>
            <textarea value={descriptionSnapshot} onChange={(e) => setDescriptionSnapshot(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent" />
          </div>
          <LabeledInput label="Trial Days (0 = none)" type="number" value={String(trialDays)} onChange={(v) => setTrialDays(Math.max(0, Number(v) || 0))} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function DraftOffersSection({ plan, draft, onChanged, setError, setSuccess }: DraftSectionProps) {
  const [editing, setEditing] = useState(false);
  const [monthlyEnabled, setMonthlyEnabled] = useState(draft.offers.some((o) => o.billingInterval === 'monthly'));
  const [annualEnabled, setAnnualEnabled] = useState(draft.offers.some((o) => o.billingInterval === 'annual'));
  const [monthlyPrice, setMonthlyPrice] = useState(() => {
    const o = draft.offers.find((x) => x.billingInterval === 'monthly');
    return o ? (o.price / 100).toFixed(2) : '';
  });
  const [annualPrice, setAnnualPrice] = useState(() => {
    const o = draft.offers.find((x) => x.billingInterval === 'annual');
    return o ? (o.price / 100).toFixed(2) : '';
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const offers: Array<{ billingInterval: PlanBillingInterval; price: number; currency: string }> = [];
    if (monthlyEnabled) {
      const minor = parseMoneyToMinorUnits(monthlyPrice);
      if (minor === null) return setError('Monthly price must be a valid non-negative amount.');
      offers.push({ billingInterval: 'monthly', price: minor, currency: 'BDT' });
    }
    if (annualEnabled) {
      const minor = parseMoneyToMinorUnits(annualPrice);
      if (minor === null) return setError('Annual price must be a valid non-negative amount.');
      offers.push({ billingInterval: 'annual', price: minor, currency: 'BDT' });
    }
    setError(null);
    setSaving(true);
    try {
      await subscriptionsApi.setDraftOffers(plan.id, draft.id, offers);
      setEditing(false);
      setSuccess('Billing offers saved.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save offers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-extrabold text-app-text-primary">Billing Offers</div>
        {!editing && <button onClick={() => setEditing(true)} className="text-[11.5px] font-extrabold text-blue-600 hover:underline">Edit</button>}
      </div>
      {!editing ? (
        draft.offers.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-app-text-secondary italic">No offer configured yet — required before this version can be published.</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {draft.offers.map((o) => (
              <div key={o.id} className="rounded-lg border border-app-border px-3 py-2">
                <div className="text-[13px] font-extrabold text-app-text-primary">{formatMoney(o.price, o.currency)}</div>
                <div className="text-[10px] font-bold text-app-text-secondary uppercase">{o.billingInterval}</div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <p className="text-[10.5px] font-semibold text-app-text-secondary">Enter each price directly in BDT. Annual pricing is never auto-calculated from monthly — enter it explicitly, or leave it off.</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-app-text-primary w-24">
                <input type="checkbox" checked={monthlyEnabled} onChange={(e) => setMonthlyEnabled(e.target.checked)} /> Monthly
              </label>
              <div className="relative flex-1 max-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-app-text-secondary">৳</span>
                <input
                  disabled={!monthlyEnabled}
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-app-border pl-6 pr-3 py-2 text-[12.5px] font-semibold bg-transparent disabled:opacity-40"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-app-text-primary w-24">
                <input type="checkbox" checked={annualEnabled} onChange={(e) => setAnnualEnabled(e.target.checked)} /> Annual
              </label>
              <div className="relative flex-1 max-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-app-text-secondary">৳</span>
                <input
                  disabled={!annualEnabled}
                  value={annualPrice}
                  onChange={(e) => setAnnualPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-app-border pl-6 pr-3 py-2 text-[12.5px] font-semibold bg-transparent disabled:opacity-40"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function DraftFeaturesSection({ plan, draft, onChanged, setError, setSuccess }: DraftSectionProps) {
  const [editing, setEditing] = useState(false);
  const availableKeys = useMemo(() => featureKeysForRole(plan.role), [plan.role]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(draft.entitlements.filter((e) => e.enabled).map((e) => e.featureKey)));
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await subscriptionsApi.setDraftEntitlements(
        plan.id,
        draft.id,
        availableKeys.map((k) => ({ featureKey: k, enabled: selected.has(k) })),
      );
      setEditing(false);
      setSuccess('Included features saved.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save features');
    } finally {
      setSaving(false);
    }
  };

  const enabledNow = draft.entitlements.filter((e) => e.enabled);

  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-extrabold text-app-text-primary">Included Features</div>
        {!editing && <button onClick={() => setEditing(true)} className="text-[11.5px] font-extrabold text-blue-600 hover:underline">Edit</button>}
      </div>
      {!editing ? (
        enabledNow.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-app-text-secondary italic">No features selected yet</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enabledNow.map((e) => (
              <span key={e.featureKey} className="rounded-full bg-[#EFF6FF] border border-blue-100 px-2.5 py-1 text-[10.5px] font-bold text-blue-700">
                {FEATURE_LABELS[e.featureKey] || e.featureKey}
              </span>
            ))}
          </div>
        )
      ) : (
        <>
          <p className="text-[10.5px] font-semibold text-app-text-secondary">Pulled from the canonical entitlement registry for the {plan.role} persona — no custom feature keys.</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {availableKeys.map((key) => (
              <label key={key} className="flex items-center gap-2 text-[12px] font-bold text-app-text-primary">
                <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                {FEATURE_LABELS[key] || key}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function DraftLimitsSection({ plan, draft, onChanged, setError, setSuccess }: DraftSectionProps) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Array<{ key: string; value: string; unlimited: boolean }>>(
    () => draft.limits.map((l) => ({ key: l.limitKey, value: l.limitValue === null ? '' : String(l.limitValue), unlimited: l.limitValue === null })),
  );
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows((r) => [...r, { key: '', value: '', unlimited: false }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<{ key: string; value: string; unlimited: boolean }>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const save = async () => {
    const cleaned = rows.filter((r) => r.key.trim());
    for (const r of cleaned) {
      if (!r.unlimited && (!r.value.trim() || !Number.isFinite(Number(r.value)) || Number(r.value) < 0)) {
        setError(`Limit "${r.key}" needs a non-negative integer value, or mark it Unlimited.`);
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      await subscriptionsApi.setDraftLimits(
        plan.id,
        draft.id,
        cleaned.map((r) => ({ limitKey: r.key.trim(), limitValue: r.unlimited ? null : Math.round(Number(r.value)) })),
      );
      setEditing(false);
      setSuccess('Quantitative limits saved.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save limits');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-extrabold text-app-text-primary">Quantitative Limits</div>
        {!editing && <button onClick={() => { setRows(draft.limits.map((l) => ({ key: l.limitKey, value: l.limitValue === null ? '' : String(l.limitValue), unlimited: l.limitValue === null }))); setEditing(true); }} className="text-[11.5px] font-extrabold text-blue-600 hover:underline">Edit</button>}
      </div>
      <p className="text-[10.5px] font-semibold text-app-text-secondary">Numeric allowances (e.g. team members, active vouchers) — separate from the boolean features above.</p>
      {!editing ? (
        draft.limits.length === 0 ? (
          <div className="text-[11.5px] font-semibold text-app-text-secondary italic">No limits configured</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {draft.limits.map((l) => (
              <div key={l.limitKey} className="flex items-center justify-between rounded-lg border border-app-border px-3 py-1.5">
                <span className="text-[11px] font-bold text-app-text-primary">{l.limitKey}</span>
                <span className="text-[11px] font-extrabold text-app-text-secondary">{l.limitValue === null ? 'Unlimited' : l.limitValue}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row.key}
                  onChange={(e) => updateRow(i, { key: e.target.value })}
                  placeholder="limit key"
                  list="known-limit-keys"
                  className="flex-1 rounded-lg border border-app-border px-3 py-2 text-[12px] font-semibold bg-transparent"
                />
                <input
                  disabled={row.unlimited}
                  value={row.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder="value"
                  className="w-24 rounded-lg border border-app-border px-3 py-2 text-[12px] font-semibold bg-transparent disabled:opacity-40"
                />
                <label className="flex items-center gap-1 text-[10.5px] font-bold text-app-text-primary whitespace-nowrap">
                  <input type="checkbox" checked={row.unlimited} onChange={(e) => updateRow(i, { unlimited: e.target.checked })} /> Unlimited
                </label>
                <button onClick={() => removeRow(i)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <datalist id="known-limit-keys">
              {KNOWN_LIMIT_KEYS.map((k) => <option key={k} value={k} />)}
            </datalist>
            <button onClick={addRow} className="inline-flex items-center gap-1 text-[11.5px] font-extrabold text-blue-600"><Plus className="w-3.5 h-3.5" /> Add Limit</button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function PublishSection({ plan, draft, onChanged, setError }: { plan: PlanDetail['plan']; draft: PlanVersionDetail; onChanged: () => void; setError: (e: string | null) => void }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    setPublishing(true);
    try {
      await subscriptionsApi.publishVersion(plan.id, draft.id);
      setShowConfirm(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
      setShowConfirm(false);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex justify-end">
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white text-[12.5px] font-extrabold px-4 py-2.5 hover:bg-emerald-700"
      >
        <CheckCircle2 className="w-4 h-4" /> Publish This Version
      </button>
      {showConfirm && (
        <Modal title="Publish Version — Review" onClose={() => setShowConfirm(false)} wide>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11.5px] font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Once published, this version cannot be edited. Future price, feature, or limit changes require creating a new Draft Version.
            </div>
            <VersionDetailCard version={draft} plan={plan} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
              <button onClick={publish} disabled={publishing} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">
                {publishing ? 'Publishing…' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Version History ────────────────────────────────────────────────────

function VersionHistoryTab({ versions, plan }: { versions: PlanVersionDetail[]; plan: PlanDetail['plan'] }) {
  if (versions.length === 0) {
    return <EmptyState icon={<History className="w-5 h-5" />} title="No published versions yet" description="Published version history will appear here once you publish a Draft Version." />;
  }
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] border border-app-border px-3 py-2.5 text-[11px] font-semibold text-app-text-secondary">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
        Existing subscribers may remain on an older version below — publishing a new version never moves them automatically (grandfathering).
      </div>
      {versions.map((v) => (
        <VersionDetailCard key={v.id} version={v} plan={plan} />
      ))}
    </div>
  );
}

// ── Subscribers + Manual Grant ─────────────────────────────────────────

function SubscribersTab({ plan, publishedVersion }: { plan: PlanDetail['plan']; publishedVersion: PlanVersionDetail | null }) {
  const [rows, setRows] = useState<SubscriberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<SubscriberRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    subscriptionsApi
      .getSubscribers(plan.id)
      .then((r) => setRows(r.subscribers))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load subscribers'));
  }, [plan.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {success && <Banner kind="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}
      {error && <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>}
      <div className="flex justify-end">
        <button
          onClick={() => setShowGrant(true)}
          disabled={!publishedVersion || publishedVersion.offers.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#18154C] text-white text-[12px] font-extrabold px-3.5 py-2 disabled:opacity-40"
          title={!publishedVersion ? 'Publish a version with an offer first' : undefined}
        >
          <Gift className="w-3.5 h-3.5" /> Manual Grant
        </button>
      </div>

      {rows === null && !error && <LoadingBlock label="Loading subscribers…" />}
      {rows !== null && rows.length === 0 && (
        <EmptyState icon={<Users className="w-5 h-5" />} title="No subscribers yet" description="Workspaces that subscribe to this Plan will appear here." />
      )}
      {rows !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-app-border">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F9FAFB] text-left text-[10px] font-extrabold text-app-text-secondary uppercase tracking-wide">
                <th className="px-3 py-2.5">Workspace</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Current Period</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subscriptionId} className="border-t border-app-border">
                  <td className="px-3 py-2.5 font-bold text-app-text-primary">{r.workspaceDisplayName || r.workspaceId}</td>
                  <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2.5 font-semibold text-app-text-secondary">{formatDate(r.currentPeriodStart)} – {formatDate(r.currentPeriodEnd)}</td>
                  <td className="px-3 py-2.5 font-semibold text-app-text-secondary">{r.grantedManually ? 'Manual Grant' : 'Paid'}</td>
                  <td className="px-3 py-2.5 text-right">
                    {r.grantedManually && (
                      <button onClick={() => setReplaceTarget(r)} className="text-[11px] font-extrabold text-blue-600 hover:underline">Change Plan</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGrant && (
        <ManualGrantModal
          plan={plan}
          onClose={() => setShowGrant(false)}
          onGranted={() => {
            setShowGrant(false);
            setSuccess('Plan granted manually. No payment or Subscription Revenue was created.');
            load();
          }}
        />
      )}
      {replaceTarget && (
        <ReplaceGrantModal
          plan={plan}
          subscription={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onReplaced={() => {
            setReplaceTarget(null);
            setSuccess('Manual grant updated.');
            load();
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    trial: 'bg-blue-50 border-blue-200 text-blue-700',
    past_due: 'bg-amber-50 border-amber-200 text-amber-700',
    grace_period: 'bg-amber-50 border-amber-200 text-amber-700',
    cancelled: 'bg-gray-100 border-gray-300 text-gray-600',
    expired: 'bg-gray-100 border-gray-300 text-gray-600',
    suspended: 'bg-red-50 border-red-200 text-red-700',
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${map[status] || 'bg-gray-100 border-gray-300 text-gray-600'}`}>{status.replace('_', ' ')}</span>;
}

function ManualGrantModal({ plan, onClose, onGranted }: { plan: PlanDetail['plan']; onClose: () => void; onGranted: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkspaceLookupRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceLookupRow | null>(null);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [offerId, setOfferId] = useState('');
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    subscriptionsApi.getPlanDetail(plan.id).then(setDetail).catch(() => setDetail(null));
  }, [plan.id]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearching(true);
      subscriptionsApi
        .listWorkspaces({ type: plan.role, q: query || undefined })
        .then((r) => setResults(r.workspaces))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, plan.role]);

  const publishedOffers = (detail?.versions || []).filter((v) => v.publishedAt !== null).flatMap((v) => v.offers.map((o) => ({ ...o, versionLabel: `v${v.version}` })));

  const submit = async () => {
    if (!selectedWorkspace) return setError('Select a target Workspace.');
    if (!offerId) return setError('Select a Plan Version Offer.');
    if (!reason.trim()) return setError('A reason is required.');
    setSaving(true);
    setError(null);
    try {
      await subscriptionsApi.manualGrant({
        workspaceId: selectedWorkspace.id,
        planVersionOfferId: offerId,
        reason: reason.trim(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
      });
      onGranted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grant plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Manually Grant ${plan.name}`} onClose={onClose} wide>
      <div className="space-y-3.5">
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-[11px] font-semibold text-blue-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Manual grant does not create a payment or Subscription Revenue.
        </div>
        {error && <Banner kind="error">{error}</Banner>}

        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Target Workspace ({plan.role})</label>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedWorkspace(null); }}
            placeholder="Search by workspace name or owner email…"
            className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent"
          />
          {!selectedWorkspace && (
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-app-border divide-y divide-app-border">
              {searching && <div className="px-3 py-2 text-[11px] font-semibold text-app-text-secondary">Searching…</div>}
              {!searching && results.length === 0 && <div className="px-3 py-2 text-[11px] font-semibold text-app-text-secondary italic">No matching workspaces</div>}
              {!searching && results.map((w) => (
                <button key={w.id} onClick={() => { setSelectedWorkspace(w); setQuery(w.displayName); }} className="w-full text-left px-3 py-2 hover:bg-[#F9FAFB]">
                  <div className="text-[12px] font-bold text-app-text-primary">{w.displayName}</div>
                  <div className="text-[10.5px] font-semibold text-app-text-secondary">{w.ownerDisplayName} · {w.ownerEmail}</div>
                </button>
              ))}
            </div>
          )}
          {selectedWorkspace && <div className="mt-1 text-[11px] font-bold text-emerald-700">Selected: {selectedWorkspace.displayName}</div>}
        </div>

        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Plan Version Offer</label>
          <select value={offerId} onChange={(e) => setOfferId(e.target.value)} className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent">
            <option value="">Select an offer…</option>
            {publishedOffers.map((o) => (
              <option key={o.id} value={o.id}>{o.versionLabel} — {formatMoney(o.price, o.currency)} / {o.billingInterval}</option>
            ))}
          </select>
        </div>

        <LabeledInput label="Expiry date (optional — leave blank for indefinite)" type="date" value={endDate} onChange={setEndDate} />

        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Reason (required)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">{saving ? 'Granting…' : 'Grant Plan'}</button>
        </div>
      </div>
    </Modal>
  );
}

function ReplaceGrantModal({ plan, subscription, onClose, onReplaced }: { plan: PlanDetail['plan']; subscription: SubscriberRow; onClose: () => void; onReplaced: () => void }) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [offerId, setOfferId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    subscriptionsApi.getPlanDetail(plan.id).then(setDetail).catch(() => setDetail(null));
  }, [plan.id]);

  const publishedOffers = (detail?.versions || []).filter((v) => v.publishedAt !== null).flatMap((v) => v.offers.map((o) => ({ ...o, versionLabel: `v${v.version}` })));

  const submit = async () => {
    if (!offerId) return setError('Select a target offer.');
    if (!reason.trim()) return setError('A reason is required.');
    setSaving(true);
    setError(null);
    try {
      await subscriptionsApi.replaceManualGrant(subscription.subscriptionId, { toPlanVersionOfferId: offerId, reason: reason.trim() });
      onReplaced();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change grant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Change Manually-Granted Plan" onClose={onClose}>
      <div className="space-y-3.5">
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-[11px] font-semibold text-blue-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> This changes an existing manual grant only — no payment or paid upgrade/downgrade billing is applied.
        </div>
        {error && <Banner kind="error">{error}</Banner>}
        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">New Plan Version Offer</label>
          <select value={offerId} onChange={(e) => setOfferId(e.target.value)} className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent">
            <option value="">Select an offer…</option>
            {publishedOffers.map((o) => (
              <option key={o.id} value={o.id}>{o.versionLabel} — {formatMoney(o.price, o.currency)} / {o.billingInterval}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Reason (required)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[12.5px] font-semibold bg-transparent" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">{saving ? 'Saving…' : 'Save Change'}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function SubscriptionPlansPage() {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (selectedPlanId) {
    return (
      <AdminWorkspaceLayout>
        <PlanEditorView planId={selectedPlanId} onBack={() => setSelectedPlanId(null)} />
      </AdminWorkspaceLayout>
    );
  }

  return (
    <AdminWorkspaceLayout>
      <PlanListView onSelectPlan={setSelectedPlanId} onCreated={setSelectedPlanId} />
    </AdminWorkspaceLayout>
  );
}
