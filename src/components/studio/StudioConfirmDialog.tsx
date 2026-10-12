import React, { useEffect, useId, useRef } from 'react';

export type StudioConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shown on the confirm button while `busy`. */
  busyLabel?: string;
  /** `danger` for destructive actions (discard, archive, remove). */
  tone?: 'danger' | 'primary';
  /** While true both buttons are disabled and Escape is ignored (no double submit). */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** data-testid for the confirm button (existing tests rely on these). */
  confirmTestId?: string;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared Studio confirmation dialog for lifecycle and destructive actions.
 * `role="dialog"` + `aria-modal`, labelled by its title and description;
 * focus starts on Cancel, stays inside the dialog (Tab wraps), Escape cancels,
 * and focus returns to the element that opened it. The caller keeps all of
 * the action's logic — the dialog only asks.
 */
export function StudioConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
  confirmTestId,
}: StudioConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busyRef.current) onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const back = returnFocusRef.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [open]);

  if (!open) return null;

  const confirmColors =
    tone === 'danger'
      ? { background: '#DC2626', borderColor: '#DC2626' }
      : { background: '#EF3C23', borderColor: '#EF3C23' };

  return (
    <div
      data-studio-confirm-overlay=""
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}
      >
        <h3 id={titleId} style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', margin: '0 0 8px' }}>
          {title}
        </h3>
        {description ? (
          <div id={descId} style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.55, margin: '0 0 20px' }}>
            {description}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2323FF] focus-visible:ring-offset-2"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E8EDF2', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid={confirmTestId}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2323FF] focus-visible:ring-offset-2"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid', ...confirmColors, color: '#fff', fontSize: 12, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? busyLabel || 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
