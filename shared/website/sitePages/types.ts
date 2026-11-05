/** Structured CMS content for informational / legal / business storefront pages. */

export type SitePageKey =
  | 'about'
  | 'suggestBrand'
  | 'partnership'
  | 'advertise'
  | 'terms'
  | 'privacy'
  | 'contact';

export interface CmsStatItem {
  id: string;
  icon?: string;
  value: string;
  label: string;
  bg?: string;
  enabled?: boolean;
  order?: number;
}

export interface CmsCardItem {
  id: string;
  icon?: string;
  title: string;
  desc: string;
  bg?: string;
  badge?: string;
  cta?: string;
  href?: string;
  enabled?: boolean;
  order?: number;
}

export interface CmsNavItem {
  id: string;
  href: string;
  icon: string;
  label: string;
  enabled?: boolean;
  order?: number;
}

export interface CmsStepItem {
  id: string;
  step: string;
  title: string;
  desc: string;
  enabled?: boolean;
  order?: number;
}

export interface CmsSelectOption {
  id: string;
  value: string;
  label: string;
  enabled?: boolean;
  order?: number;
}

export interface CmsFormFieldCopy {
  label: string;
  placeholder?: string;
}

export interface CmsHeroBlock {
  badge: string;
  title: string;
  description: string;
  sideCardTitle?: string;
  sideCardSubtitle?: string;
  sideCardBody?: string;
  sideCardIcon?: string;
}

export interface CmsHelpBox {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface AboutPageContent {
  companyNavLabel: string;
  legalNavLabel: string;
  companyNav: CmsNavItem[];
  legalNav: CmsNavItem[];
  helpBox: CmsHelpBox;
  heroEyebrow: string;
  heroTitleLine1: string;
  heroTitleLine2Prefix: string;
  heroTitleAccent: string;
  heroDescription: string;
  heroImageUrl: string;
  stats: CmsStatItem[];
  whyHeading: string;
  whyCards: CmsCardItem[];
  companyRows: CmsCardItem[];
  legalSectionLabel: string;
  legalRows: CmsCardItem[];
}

export interface SuggestBrandPageContent {
  hero: CmsHeroBlock;
  whyHeading: string;
  whyBody: string;
  whyCards: CmsCardItem[];
  howHeading: string;
  howSteps: CmsStepItem[];
  benefitsHeading: string;
  benefitsIntro: string;
  benefits: string[];
  formHeading: string;
  formSubheading: string;
  fields: {
    brandName: CmsFormFieldCopy;
    website: CmsFormFieldCopy;
    category: CmsFormFieldCopy;
    country: CmsFormFieldCopy;
    reason: CmsFormFieldCopy;
  };
  categoryOptions: CmsSelectOption[];
  submitLabel: string;
  successTitle: string;
  successSubtitle: string;
  successBodyTemplate: string;
  successResetLabel: string;
}

export interface PartnershipPageContent {
  hero: CmsHeroBlock;
  partnerHeading: string;
  partnerBody: string;
  categoriesHeading: string;
  categories: CmsCardItem[];
  credibilityTitle: string;
  credibilityBody: string;
  formHeading: string;
  formSubheading: string;
  fields: {
    companyName: CmsFormFieldCopy;
    contactName: CmsFormFieldCopy;
    email: CmsFormFieldCopy;
    partnershipModel: CmsFormFieldCopy;
    message: CmsFormFieldCopy;
  };
  modelOptions: CmsSelectOption[];
  submitLabel: string;
  successTitle: string;
  successSubtitle: string;
  successBodyTemplate: string;
  successResetLabel: string;
}

export interface AdvertisePageContent {
  hero: CmsHeroBlock;
  whyHeading: string;
  whyBody: string;
  audienceHeading: string;
  audienceStats: CmsStatItem[];
  placementsHeading: string;
  placements: CmsCardItem[];
  pricingTitle: string;
  pricingBody: string;
  formHeading: string;
  formSubheading: string;
  fields: {
    brandName: CmsFormFieldCopy;
    contactPerson: CmsFormFieldCopy;
    email: CmsFormFieldCopy;
    budget: CmsFormFieldCopy;
    placementInterest: CmsFormFieldCopy;
    message: CmsFormFieldCopy;
  };
  budgetOptions: CmsSelectOption[];
  placementOptions: CmsSelectOption[];
  submitLabel: string;
  successTitle: string;
  successSubtitle: string;
  successBodyTemplate: string;
  successResetLabel: string;
}

export interface LegalSection {
  id: string;
  /** Document index label, e.g. "1. Introduction" */
  indexLabel: string;
  /** Display number prefix, e.g. "01" */
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  contactBox?: {
    emailLabel?: string;
    email?: string;
    addressLabel?: string;
    address?: string;
    responseLabel?: string;
    responseWindow?: string;
  };
  enabled?: boolean;
  order?: number;
}

export interface LegalDocumentContent {
  hero: CmsHeroBlock;
  lastUpdatedText: string;
  indexTitle: string;
  sections: LegalSection[];
}

export interface ContactPageContent {
  hero: CmsHeroBlock;
  /** When true, hero HQ address prefers footer bangladeshOffice / global settings */
  useGlobalOfficeAddress: boolean;
  hqTitle: string;
  hqAddress: string;
  channelsHeading: string;
  channels: CmsCardItem[];
  methodsHeading: string;
  /** method values may use {{supportEmail}} token resolved from global footer */
  methods: Array<CmsCardItem & { value: string; iconKey?: 'mail' | 'messenger' | 'social' }>;
  useGlobalSupportEmail: boolean;
  commitmentTitle: string;
  commitmentBody: string;
  formHeading: string;
  formSubheading: string;
  fields: {
    name: CmsFormFieldCopy;
    email: CmsFormFieldCopy;
    subject: CmsFormFieldCopy;
    message: CmsFormFieldCopy;
  };
  submitLabel: string;
  successTitle: string;
  successSubtitle: string;
  successBodyTemplate: string;
  successResetLabel: string;
}

export interface SitePagesConfig {
  about: AboutPageContent;
  suggestBrand: SuggestBrandPageContent;
  partnership: PartnershipPageContent;
  advertise: AdvertisePageContent;
  terms: LegalDocumentContent;
  privacy: LegalDocumentContent;
  contact: ContactPageContent;
}

export const SITE_PAGE_META: Array<{
  key: SitePageKey;
  group: 'informational' | 'legal';
  label: string;
  path: string;
}> = [
  { key: 'about', group: 'informational', label: 'About', path: '/about' },
  { key: 'suggestBrand', group: 'informational', label: 'Suggest a Brand', path: '/suggest-brand' },
  { key: 'partnership', group: 'informational', label: 'Partnership', path: '/partnership' },
  { key: 'advertise', group: 'informational', label: 'Advertise', path: '/advertise' },
  { key: 'contact', group: 'informational', label: 'Contact Us', path: '/contact' },
  { key: 'terms', group: 'legal', label: 'Terms of Service', path: '/terms' },
  { key: 'privacy', group: 'legal', label: 'Privacy Policy', path: '/privacy' },
];
