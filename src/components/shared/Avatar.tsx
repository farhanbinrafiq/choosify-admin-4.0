import React from 'react';

/**
 * Canonical initials fallback — was duplicated near-identically in
 * Consumers.tsx, ConsumerProfileView.tsx and elsewhere. Never returns a
 * logo/brand mark; a name that yields nothing usable falls back to a
 * single neutral "U" glyph, not the Choosify wordmark.
 */
export function initialsFor(name: string | null | undefined): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'U';
  return (
    trimmed
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'U'
  );
}

interface AvatarProps {
  /** Real uploaded profile photo URL. Absent/null/empty → initials fallback,
   *  never a logo or other placeholder image. */
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One canonical presentation for "a real photo, or initials if there isn't
 * one" — used by every account directory row and profile identity block
 * (Consumer/Seller/Creator Management, Seller My Customers, Consumer/Seller
 * Customer Profile). A brand logo is a separate concept (BrandCardDesign /
 * BrandDetailHero own that) and never flows through this component.
 */
export function Avatar({ src, name, size = 32, className = '', style }: AvatarProps) {
  const initials = initialsFor(name);
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    ...style,
  };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className={className}
        style={{ ...base, objectFit: 'cover', border: style?.border ?? '1px solid #E8EDF2' }}
      />
    );
  }
  return (
    <div
      className={className}
      style={{
        ...base,
        background: 'linear-gradient(135deg, var(--cms-accent), #18154C)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: Math.max(10, Math.round(size * 0.4)),
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default Avatar;
