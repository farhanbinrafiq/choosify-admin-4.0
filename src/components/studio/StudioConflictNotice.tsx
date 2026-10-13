import React from 'react';

/**
 * Phase C — shown when a save is refused because the record changed elsewhere
 * (another tab, another person, or Choosify). The editor and the user's draft
 * stay open; nothing is retried automatically. Reloading is an explicit choice.
 */
export function StudioConflictNotice({
  what,
  onReload,
  onDismiss,
  busy,
}: {
  /** e.g. "product", "guide", "brand", "creator profile" */
  what: string;
  /** Discards the unsaved edits and loads the latest saved version. */
  onReload: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="alert"
      data-testid="studio-conflict"
      className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[12px] text-[#7F1D1D]"
    >
      <div className="font-extrabold text-[#B91C1C]">Not saved — this {what} was changed somewhere else</div>
      <p className="mt-1 mb-2 leading-relaxed">
        Someone (or another tab) saved this {what} after you opened it. Your changes were <b>not</b> saved and are still in
        the editor, so you can copy them. Load the latest version to continue — this discards your unsaved changes in
        this section.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReload}
          disabled={busy}
          className="rounded-lg bg-[#B91C1C] px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2323FF] focus-visible:ring-offset-2"
        >
          Discard my changes and load the latest
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-[#FCA5A5] bg-white px-3 py-1.5 text-[11px] font-bold text-[#7F1D1D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2323FF] focus-visible:ring-offset-2"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}
