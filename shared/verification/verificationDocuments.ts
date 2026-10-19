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

export function verificationDocumentSpecs(entityType: 'brand' | 'creator' | string | undefined): VerificationDocumentSpec[] {
  return entityType === 'creator' ? CREATOR_VERIFICATION_DOCUMENTS : SELLER_VERIFICATION_DOCUMENTS;
}

export function verificationDocumentLabel(entityType: string | undefined, type: string): string {
  return verificationDocumentSpecs(entityType).find((s) => s.type === type)?.label || type;
}

/** Required document types with no file on the request. */
export function missingRequiredDocuments(entityType: string | undefined, documents: Array<{ type: string }>): VerificationDocumentSpec[] {
  const have = new Set(documents.map((d) => d.type));
  return verificationDocumentSpecs(entityType).filter((s) => s.required && !have.has(s.type));
}
