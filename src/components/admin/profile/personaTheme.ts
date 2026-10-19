/**
 * Super Admin profile identity-card covers — one system for all three
 * personas: persona tint → warm highlight → brand accent. Each persona keeps
 * its own tint so a Consumer card is never mistaken for a Seller card.
 */
export type ProfilePersona = 'consumer' | 'seller' | 'creator';

const ACCENT = 'var(--cms-accent)';

const TINT: Record<ProfilePersona, string> = {
  consumer: '#BAE6FD', // sky — shoppers
  seller: '#FBCFE8', // rose — brands & stores
  creator: '#C4B5FD', // lavender — creators
};

export function personaCoverGradient(persona: ProfilePersona): string {
  return `linear-gradient(120deg,${TINT[persona]} 0%,#FDE68A 50%, ${ACCENT} 100%)`;
}
