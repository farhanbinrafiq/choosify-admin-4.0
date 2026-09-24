import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock, ExternalLink, Mail, MessageSquarePlus } from 'lucide-react';
import { operationsApi, type OpsLead } from '../../services/operationsApi';
import {
  AD_BUDGET_RANGES,
  INQUIRY_STATUSES,
  PARTNERSHIP_MODELS,
  buildAdPlacementInterests,
  inquiryStatusLabel,
  inquiryTypeLabel,
} from '../../../shared/inquiries/inquiryOptions';
import { InquiryStatusBadge } from './LeadsInbox';

const PLACEMENTS = buildAdPlacementInterests();

function safeHttpUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-2 border-b border-slate-100 last:border-b-0 text-sm">
      <div className="text-slate-500 font-semibold">{label}</div>
      <div className="text-slate-900 break-words">{children}</div>
    </div>
  );
}

export default function InquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<OpsLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    operationsApi
      .getLead(id)
      .then((row) => { if (!cancelled) setLead(row); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load inquiry'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const changeStatus = async (status: OpsLead['status']) => {
    if (!lead || status === lead.status) return;
    setSaving(true);
    setError(null);
    try {
      setLead(await operationsApi.updateLead(lead.id, { status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!lead || !note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      setLead(await operationsApi.addLeadNote(lead.id, note.trim()));
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading inquiry…</div>;
  if (!lead) {
    return (
      <div className="p-6 space-y-3">
        <button type="button" onClick={() => navigate('/admin/inquiries')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to inquiries
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Inquiry not found.'}</div>
      </div>
    );
  }

  const website = safeHttpUrl(lead.website);
  const mailto = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(`Re: ${lead.referenceId ? `${lead.referenceId} — ` : ''}${lead.brandName}`)}`;

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <button type="button" onClick={() => navigate('/admin/inquiries')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Back to inquiries
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{inquiryTypeLabel(lead.inquiryType)}</div>
          <h1 className="text-2xl font-extrabold text-slate-900">{lead.brandName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className={`font-mono font-bold ${lead.referenceId ? 'text-orange-600' : 'text-slate-500'}`}>{lead.referenceId || 'No reference'}</span>
            <InquiryStatusBadge status={lead.status} />
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(lead.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <a href={mailto} className="inline-flex items-center gap-2 rounded-lg bg-app-accent px-4 py-2 text-sm font-bold text-white">
          <Mail className="w-4 h-4" /> Email contact
        </a>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {lead.duplicateSignals?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle className="w-4 h-4" /> Possible duplicate — review before acting</div>
          <ul className="mt-1 list-disc pl-5">
            {lead.duplicateSignals.map((d) => (
              <li key={`${d.kind}-${d.matchId}`}>
                {d.kind === 'existing_brand' ? 'Already listed brand' : 'Open suggestion'}: {d.matchLabel} (matched on {d.matchedOn})
                {d.kind === 'existing_suggestion' ? (
                  <> — <Link className="underline" to={`/admin/inquiries/${encodeURIComponent(d.matchId)}`}>open</Link></>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700 mb-2">Submission</h2>
            <Field label={lead.inquiryType === 'general_contact' ? 'Subject' : 'Brand / company'}>{lead.brandName}</Field>
            {lead.contactPerson ? <Field label="Contact">{lead.contactPerson}</Field> : null}
            <Field label="Email">{lead.email}</Field>
            {lead.website ? (
              <Field label="Website / social">
                {website ? (
                  <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-app-accent font-semibold">
                    {lead.website} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : lead.website}
              </Field>
            ) : null}
            {lead.categoryName ? <Field label="Category">{lead.categoryName}</Field> : null}
            {lead.country ? <Field label="Country">{lead.country}</Field> : null}
            {lead.partnershipModel ? (
              <Field label="Partnership model">{PARTNERSHIP_MODELS.find((m) => m.value === lead.partnershipModel)?.label ?? lead.partnershipModel}</Field>
            ) : null}
            {lead.budget ? <Field label="Monthly budget">{AD_BUDGET_RANGES.find((b) => b.value === lead.budget)?.label ?? lead.budget}</Field> : null}
            {lead.placementInterest ? (
              <Field label="Placement interest">{PLACEMENTS.find((p) => p.value === lead.placementInterest)?.label ?? lead.placementInterest}</Field>
            ) : null}
            {lead.message ? (
              <Field label={lead.inquiryType === 'suggest_brand' ? 'Why list this brand' : lead.inquiryType === 'advertising' ? 'Campaign goals' : 'Message'}>
                <div className="whitespace-pre-wrap">{lead.message}</div>
              </Field>
            ) : null}
            <Field label="Source page">{lead.sourcePath || lead.source}</Field>
            <Field label="Submitted by">
              {lead.submittedByUserId ? (
                <Link className="text-app-accent font-semibold" to={`/admin/consumers/${encodeURIComponent(lead.submittedByUserId)}`}>Signed-in account</Link>
              ) : 'Guest (not signed in)'}
            </Field>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700 mb-3">Internal notes</h2>
            {lead.notes?.length ? (
              <ul className="space-y-3 mb-4">
                {lead.notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="text-xs text-slate-500 mb-1">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</div>
                    <div className="whitespace-pre-wrap text-slate-800">{n.body}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500 mb-3">No internal notes yet. Notes are visible to the Choosify team only.</p>}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Add an internal note (not sent to the submitter)…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addNote}
              disabled={saving || !note.trim()}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              <MessageSquarePlus className="w-4 h-4" /> Add note
            </button>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700 mb-3">Status</h2>
            <div className="grid grid-cols-2 gap-2">
              {INQUIRY_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={saving}
                  onClick={() => changeStatus(s.value)}
                  className={`rounded-lg border px-2 py-2 text-xs font-bold ${lead.status === s.value ? 'border-app-accent bg-app-accent text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Changing status never deletes the submission. Every change is kept in the history below.</p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700 mb-3">Notifications</h2>
            {lead.delivery ? (
              <ul className="space-y-1 text-slate-700">
                <li>Dashboard alert: {lead.delivery.adminNotified ? 'sent' : `not sent${lead.delivery.adminNotifyError ? ` (${lead.delivery.adminNotifyError})` : ''}`}</li>
                <li>
                  Team email:{' '}
                  {lead.delivery.emailSent
                    ? `sent via ${lead.delivery.emailVia}`
                    : lead.delivery.emailAttempted
                      ? `not delivered${lead.delivery.emailSkippedReason ? ` (${lead.delivery.emailSkippedReason})` : ''}`
                      : `skipped${lead.delivery.emailSkippedReason ? ` (${lead.delivery.emailSkippedReason})` : ''}`}
                </li>
              </ul>
            ) : <p className="text-slate-500">No notification record (older inquiry or still sending).</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700 mb-3">History</h2>
            <ol className="space-y-2">
              {(lead.history ?? []).map((h, i) => (
                <li key={`${h.at}-${i}`} className="text-slate-700">
                  <div className="text-xs text-slate-500">{new Date(h.at).toLocaleString()}</div>
                  {h.action === 'created'
                    ? 'Submitted'
                    : h.action === 'note_added'
                      ? `Note added by ${h.actorName ?? 'Admin'}`
                      : `${h.actorName ?? 'Admin'}: ${inquiryStatusLabel(h.fromStatus)} → ${inquiryStatusLabel(h.toStatus)}`}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
