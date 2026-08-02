import React from 'react';
import { cn } from '../lib/utils';

type EmiAiLogoProps = {
  className?: string;
  size?: number;
  title?: string;
};

/** Portrait SVG viewBox ≈ 1360×2280 — inset so mascot isn't clipped in square shells */
const EMI_SAFE_INSET = 0.1;

/**
 * Official Emi AI mascot (blue→pink gradient character + EMI wordmark).
 * Ported from Choosify-Web for identical 404 / error page branding.
 */
export function EmiAiLogo({ className, size = 28, title = 'Emi. A.I' }: EmiAiLogoProps) {
  const maxEdge = Math.round(size * (1 - EMI_SAFE_INSET * 2));

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0 overflow-visible choosify-emi-logo-slot',
        className,
      )}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      role="img"
      aria-label={title}
    >
      <img
        src="/emi-ai-logo.svg"
        alt=""
        aria-hidden
        title={title}
        draggable={false}
        className="block object-contain object-center w-auto h-auto max-w-full max-h-full pointer-events-none select-none"
        style={{ maxWidth: maxEdge, maxHeight: maxEdge }}
      />
    </span>
  );
}
