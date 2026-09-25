import React, { useCallback, useEffect, useState } from 'react';
import { Eye, PencilLine } from 'lucide-react';

/**
 * Super Admin operating model — platform-admin management surfaces are VIEW-ONLY
 * by default; mutation controls appear only after an intentional "Enter Edit
 * Mode". This is an interaction-mode rule, not security: every mutation stays
 * authorised server-side exactly as before.
 *
 * Only platform staff (admin / super_admin) are gated. Sellers and creators
 * managing their OWN data keep their normal, always-editable UI.
 */
export const isPlatformAdminRole = (role?: string | null): boolean => role === 'admin' || role === 'super_admin';

export interface AdminEditModeState {
  /** true when this viewer is subject to View Mode → Edit Mode (platform staff). */
  gated: boolean;
  /** Edit Mode is on. */
  editing: boolean;
  /** Whether mutation controls may be shown: always for non-gated roles, only in Edit Mode for staff. */
  canMutate: boolean;
  enter: () => void;
  /** Leave Edit Mode; asks before discarding when `dirty` (same prompt the Admin uses elsewhere). */
  exit: () => void;
}

export function useAdminEditMode(role: string | null | undefined, options: { dirty?: boolean } = {}): AdminEditModeState {
  const gated = isPlatformAdminRole(role);
  const dirty = !!options.dirty;
  const [editing, setEditing] = useState(false);

  const enter = useCallback(() => setEditing(true), []);
  const exit = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setEditing(false);
  }, [dirty]);

  // Same unsaved-change guard the Admin uses on its other editors.
  useEffect(() => {
    if (!editing || !dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editing, dirty]);

  return { gated, editing, canMutate: !gated || editing, enter, exit };
}

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

/**
 * Header control for a gated surface. View Mode: a quiet "View mode" label plus
 * "Enter Edit Mode". Edit Mode: an "EDIT MODE" badge plus the exit action.
 * Renders nothing for non-gated roles. Entering Edit Mode never changes data.
 */
export function AdminEditModeBar({
  mode,
  exitLabel = 'Done',
  saveSlot,
}: {
  mode: AdminEditModeState;
  /** Label of the exit button ("Done" for surfaces whose actions save immediately, "Cancel" for form surfaces). */
  exitLabel?: string;
  /** Optional Save button for form surfaces with a pending draft. */
  saveSlot?: React.ReactNode;
}) {
  if (!mode.gated) return null;
  if (!mode.editing) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} data-testid="admin-view-mode">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
          <Eye size={13} /> View mode
        </span>
        <button
          type="button"
          onClick={mode.enter}
          data-testid="enter-edit-mode"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#111827', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          <PencilLine size={14} /> Enter Edit Mode
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} data-testid="admin-edit-mode">
      <span
        style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: ACCENT, background: ACCENT_WASH, border: `1px solid ${ACCENT}`, borderRadius: 999, padding: '5px 10px' }}
      >
        EDIT MODE
      </span>
      {saveSlot}
      <button
        type="button"
        onClick={mode.exit}
        data-testid="exit-edit-mode"
        style={{ background: '#fff', color: '#374151', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
      >
        {exitLabel}
      </button>
    </div>
  );
}
