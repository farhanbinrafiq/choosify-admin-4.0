import React, { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { moderationApi, type ReportCategory } from '../../services/moderationApi';

const REASONS: Array<{ value: ReportCategory; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'fraud', label: 'Fraud / Scam' },
  { value: 'abuse', label: 'Harassment / Abuse' },
  { value: 'counterfeit', label: 'Counterfeit / Misleading' },
  { value: 'fake_product', label: 'Fake Product Listing' },
  { value: 'copyright', label: 'Copyright / IP' },
  { value: 'incorrect_information', label: 'Incorrect Information' },
  { value: 'other', label: 'Other' },
];

export interface ReportEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Real backend resourceType vocabulary -- product/brand/seller/creator/user/consumer/guide/review, etc. */
  targetType: string;
  /** The real canonical id of the reported entity -- never a display name, index, or fabricated value. */
  targetId: string;
  targetName: string;
  source: 'seller_dashboard' | 'creator_dashboard';
}

/**
 * Real report submission for the Seller/Creator side of the admin app --
 * calls the same POST /moderation/reports backend the storefront's
 * ReportModal calls (via moderationApi.submitReport, the "any authenticated
 * user" endpoint, NOT the staff-only moderationApi.createReport). Reporter
 * identity is derived server-side from the caller's JWT; this component
 * never sends a reporter id.
 */
export function ReportEntityModal({ isOpen, onClose, targetType, targetId, targetName, source }: ReportEntityModalProps) {
  const [reason, setReason] = useState<ReportCategory>('spam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresDetails = reason === 'other';

  const reset = () => {
    setReason('spam');
    setDescription('');
    setSubmitted(false);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submitted) return;
    if (requiresDetails && !description.trim()) {
      setError('Please tell us more so our review team understands the issue.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await moderationApi.submitReport({
        category: reason,
        resourceType: targetType,
        resourceId: targetId,
        resourceLabel: targetName,
        description: description.trim() || undefined,
        source,
      });
      setSubmitted(true);
      setTimeout(() => {
        reset();
        onClose();
      }, 1800);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 409) setError('You already submitted a similar report recently. Our team is reviewing it.');
      else if (status === 400) setError(err instanceof Error ? err.message : 'Please check your report details and try again.');
      else if (status === 401) setError('Your session expired. Please sign in again.');
      else setError('Something went wrong submitting your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Report an issue" maxWidth="max-w-lg">
      {submitted ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="text-[14px] font-extrabold text-app-text-primary">
            Thanks. Your report has been submitted for review.
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="text-[12.5px] font-semibold text-app-text-secondary">
            Reporting {targetType}: <span className="font-bold text-app-text-primary">{targetName}</span>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-app-text-secondary">
              Why are you reporting this?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors ${
                    reason === r.value ? 'border-app-accent bg-app-accent-light text-app-accent' : 'border-app-border text-app-text-secondary hover:border-app-accent/40'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-app-text-secondary">
              Tell us more {requiresDetails ? '' : '(optional)'}
            </label>
            <textarea
              required={requiresDetails}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the issue -- don't just repeat the reason above…"
              className="w-full resize-none rounded-lg border border-app-border p-3 text-[13px] focus:border-app-accent/40 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg bg-slate-100 py-2.5 text-[12.5px] font-bold text-app-text-primary hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500 py-2.5 text-[12.5px] font-bold text-white hover:bg-red-600 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit report
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
