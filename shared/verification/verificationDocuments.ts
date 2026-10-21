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
