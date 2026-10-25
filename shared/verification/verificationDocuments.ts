/**
 * Canonical verification document catalogue — the ONE list the server
 * (submit / approve gates) and both UIs (owner Verification Center, Super
 * Admin review panel) use. Sellers must upload every `required` document for
 * each brand they verify; creators for their creator profile.
 */

export const VERIFICATION_DOCUMENT_TYPES = [
  'Profile Photo',
  'Trade License',
  'Tax Certificate',
  'National ID (Front)',
  'National ID (Back)',
  'Business Registration',
  'Payout Account KYC',
  'Account Ownership Proof',
  // Ownership-claim identity of the person claiming a Brand.
  'Company ID Card',
  'Visiting Card',
  // Legacy / optional types still accepted on older records.
  'Brand Ownership Proof',
  'Identity Verification',
] as const;

export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export type VerificationDocumentSpec = {
  type: VerificationDocumentType;
  /** What the owner and staff see. */
  label: string;
  /** What the file should be. */
  hint: string;
  required: boolean;
};

/**
 * 'Profile Photo' is not uploaded as a file: it is a server-side snapshot of
 * the account's own profile picture (POST /operations/verifications/:id/profile-photo),
 * so the owner can change their picture any time and re-submit it for review.
 */
export const PROFILE_PHOTO_DOCUMENT: VerificationDocumentType = 'Profile Photo';

export const SELLER_VERIFICATION_DOCUMENTS: VerificationDocumentSpec[] = [
  { type: 'Profile Photo', label: 'Profile Photo', hint: 'A clear photo of the account owner — your profile picture', required: true },
  { type: 'Trade License', label: 'Trade License', hint: 'Signed copy of the current trade license', required: true },
  { type: 'Tax Certificate', label: 'TIN / NBR Revenue Certificate', hint: 'Digitally signed TIN certificate', required: true },
  { type: 'National ID (Front)', label: 'Owner National ID — Front', hint: 'NID front page', required: true },
  { type: 'National ID (Back)', label: 'Owner National ID — Back', hint: 'NID back page', required: true },
  { type: 'Business Registration', label: 'BIN / VAT Business Registration', hint: 'VAT / BIN certificate', required: true },
  { type: 'Payout Account KYC', label: 'Payout Account KYC', hint: 'Bank / escrow statement for the payout account', required: true },
  { type: 'Brand Ownership Proof', label: 'Brand Ownership Proof', hint: 'Trademark or authorised-distributor letter (if applicable)', required: false },
];

export const CREATOR_VERIFICATION_DOCUMENTS: VerificationDocumentSpec[] = [
  { type: 'Profile Photo', label: 'Profile Photo', hint: 'A clear photo of you — your profile picture', required: true },
  { type: 'National ID (Front)', label: 'National ID — Front', hint: 'NID front page', required: true },
  { type: 'National ID (Back)', label: 'National ID — Back', hint: 'NID back page', required: true },
  { type: 'Payout Account KYC', label: 'Payout Account KYC', hint: 'Bank / mobile-wallet statement for the payout account', required: true },
  { type: 'Tax Certificate', label: 'TIN Certificate', hint: 'If you have one', required: false },
];

/**
 * Ownership CLAIM evidence (claiming a community profile someone else created) —
 * proves the claimant represents the brand / is the creator. Different from the
 * owner's own seller/creator verification above.
 */
export const BRAND_CLAIM_DOCUMENTS: VerificationDocumentSpec[] = [
  { type: 'National ID (Front)', label: 'Your National ID — Front', hint: 'NID front page of the person claiming', required: true },
  { type: 'National ID (Back)', label: 'Your National ID — Back', hint: 'NID back page', required: true },
  { type: 'Trade License', label: 'Trade License', hint: 'Trade license of the business that owns or represents the brand', required: true },
  {
    type: 'Brand Ownership Proof',
    label: 'Brand Ownership / Authorisation Proof',
    hint: 'Trademark certificate, or a signed authorisation letter from the brand owner naming you',
    required: true,
  },
  { type: 'Visiting Card', label: 'Visiting / Business Card', hint: 'Your business card showing your name, role and the brand', required: true },
  {
    type: 'Company ID Card',
    label: 'Brand / Company ID Card',
    hint: 'Your ID card issued by the brand or company — required when you claim as a representative',
    required: false,
  },
  { type: 'Business Registration', label: 'BIN / VAT Business Registration', hint: 'If the business has one', required: false },
];

export const CREATOR_CLAIM_DOCUMENTS: VerificationDocumentSpec[] = [
  { type: 'National ID (Front)', label: 'Your National ID — Front', hint: 'NID front page', required: true },
  { type: 'National ID (Back)', label: 'Your National ID — Back', hint: 'NID back page', required: true },
  {
    type: 'Account Ownership Proof',
    label: 'Channel / Account Ownership Proof',
    hint: 'Screenshot of your logged-in creator dashboard (YouTube Studio, Meta Business Suite…) showing the channel name',
    required: true,
  },
];

export type VerificationKind = 'owner_verification' | 'ownership_claim';

export function verificationDocumentSpecs(
  entityType: 'brand' | 'creator' | string | undefined,
  kind: VerificationKind | string | undefined = 'owner_verification',
): VerificationDocumentSpec[] {
  if (kind === 'ownership_claim') return entityType === 'creator' ? CREATOR_CLAIM_DOCUMENTS : BRAND_CLAIM_DOCUMENTS;
  return entityType === 'creator' ? CREATOR_VERIFICATION_DOCUMENTS : SELLER_VERIFICATION_DOCUMENTS;
}

export function verificationDocumentLabel(entityType: string | undefined, type: string, kind?: VerificationKind | string): string {
  return (
    verificationDocumentSpecs(entityType, kind).find((s) => s.type === type)?.label ||
    verificationDocumentSpecs(entityType).find((s) => s.type === type)?.label ||
    type
  );
}

/** Required document types with no file on the request. */
export function missingRequiredDocuments(
  entityType: string | undefined,
  documents: Array<{ type: string }>,
  kind?: VerificationKind | string,
): VerificationDocumentSpec[] {
  const have = new Set(documents.map((d) => d.type));
  return verificationDocumentSpecs(entityType, kind).filter((s) => s.required && !have.has(s.type));
}

/**
 * Who is claiming a community profile — collected before the claim documents.
 * Stored on the claim; staff see it next to the documents.
 */
export type ClaimantRelationship = 'owner' | 'representative';
export type ClaimantDetails = {
  relationship: ClaimantRelationship;
  /** Their role on the brand (e.g. Founder, Marketing Manager); for creators: Creator / Manager. */
  roleTitle: string;
  fullName: string;
  phone: string;
  /** Official (business) email address. */
  email: string;
  updatedAt?: string;
};

/** First problem with the claimant details, or null when they are complete. */
export function claimantDetailsProblem(raw: unknown): string | null {
  const d = (raw || {}) as Partial<ClaimantDetails>;
  if (d.relationship !== 'owner' && d.relationship !== 'representative') return 'Choose whether you are the owner or a representative.';
  if (String(d.roleTitle || '').trim().length < 2) return 'Enter your role.';
  if (String(d.fullName || '').trim().length < 2) return 'Enter your full name.';
  const digits = String(d.phone || '').replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(digits)) return 'Enter a valid phone number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email || '').trim())) return 'Enter a valid official email address.';
  return null;
}

/**
 * Required claim documents still missing. A representative claiming a Brand
 * must also show the ID card the brand / company issued them.
 */
export function missingClaimDocuments(
  entityType: string | undefined,
  documents: Array<{ type: string }>,
  relationship?: ClaimantRelationship | string,
): VerificationDocumentSpec[] {
  const missing = missingRequiredDocuments(entityType, documents, 'ownership_claim');
  if (entityType !== 'creator' && relationship === 'representative' && !documents.some((d) => d.type === 'Company ID Card')) {
    const spec = BRAND_CLAIM_DOCUMENTS.find((s) => s.type === 'Company ID Card');
    if (spec) missing.push({ ...spec, required: true });
  }
  return missing;
}
