import React from 'react';
import { Pencil } from 'lucide-react';

/** Look shared by every Studio's section "Edit" pill (position comes from the caller). */
const PILL_BASE =
  'z-20 inline-flex items-center px-2 py-1 rounded-md border border-[#E8EDF2] bg-white/95 text-[#EF3C23] text-[10px] font-extrabold uppercase shadow-sm hover:bg-[#EF3C23] hover:text-white hover:border-[#EF3C23] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2323FF] focus-visible:ring-offset-2';

/** Accessible name for a section's Edit control: "Edit Pricing", or "<label> — Pricing" for a custom label. */
export function editPillAccessibleName(section: string, label?: string): string {
  const visible = (label || 'Edit').trim();
  return visible.toLowerCase() === 'edit' ? `Edit ${section}` : `${visible} — ${section}`;
}

/**
 * Shared section "Edit" pill for the Product, Guide, Brand and Creator
 * Studios. Same visible design as before, plus a section-specific accessible
 * name and a visible keyboard focus ring. Each caller keeps its own
 * positioning through `className` (default: top-right of the section).
 */
export function StudioEditPill({
  section,
  onClick,
  label,
  className = 'absolute top-2 right-2 gap-1',
}: {
  /** Human section name, e.g. "Pricing" — used for the accessible name. */
  section: string;
  onClick: () => void;
  /** Visible text (default "Edit"). */
  label?: string;
  className?: string;
}) {
  const name = editPillAccessibleName(section, label);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      title={name}
      data-studio-edit-pill=""
      className={`${className} ${PILL_BASE}`}
    >
      <Pencil className="w-3 h-3" aria-hidden="true" /> {label || 'Edit'}
    </button>
  );
}
