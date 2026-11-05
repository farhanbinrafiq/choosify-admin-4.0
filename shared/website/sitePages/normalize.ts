import { defaultSitePages } from './defaults';
import type {
  AboutPageContent,
  AdvertisePageContent,
  CmsCardItem,
  CmsFormFieldCopy,
  CmsHeroBlock,
  CmsNavItem,
  CmsSelectOption,
  CmsStatItem,
  CmsStepItem,
  ContactPageContent,
  LegalDocumentContent,
  LegalSection,
  PartnershipPageContent,
  SitePagesConfig,
  SuggestBrandPageContent,
} from './types';

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback = true): boolean => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
};

function mergeField(raw: unknown, fallback: CmsFormFieldCopy): CmsFormFieldCopy {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    label: str(row.label, fallback.label),
    placeholder: str(row.placeholder, fallback.placeholder ?? ''),
  };
}

function mergeHero(raw: unknown, fallback: CmsHeroBlock): CmsHeroBlock {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    badge: str(row.badge, fallback.badge),
    title: str(row.title, fallback.title),
    description: str(row.description, fallback.description),
    sideCardTitle: str(row.sideCardTitle, fallback.sideCardTitle ?? ''),
    sideCardSubtitle: str(row.sideCardSubtitle, fallback.sideCardSubtitle ?? ''),
    sideCardBody: str(row.sideCardBody, fallback.sideCardBody ?? ''),
    sideCardIcon: str(row.sideCardIcon, fallback.sideCardIcon ?? ''),
  };
}

function mergeStats(raw: unknown, fallback: CmsStatItem[]): CmsStatItem[] {
  const input = Array.isArray(raw) && raw.length ? raw : fallback;
  return input.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const fb = fallback[idx] || fallback[0];
    return {
      id: str(row.id, fb?.id || `stat-${idx + 1}`),
      icon: str(row.icon, fb?.icon || ''),
      value: str(row.value, fb?.value || ''),
      label: str(row.label, fb?.label || ''),
      bg: str(row.bg, fb?.bg || ''),
      enabled: bool(row.enabled, fb?.enabled !== false),
      order: num(row.order, fb?.order ?? idx),
    };
  });
}

function mergeCards(raw: unknown, fallback: CmsCardItem[]): CmsCardItem[] {
  const input = Array.isArray(raw) && raw.length ? raw : fallback;
  return input.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const fb = fallback[idx] || fallback[0] || ({} as CmsCardItem);
    return {
      id: str(row.id, fb.id || `card-${idx + 1}`),
      icon: str(row.icon, fb.icon || ''),
      title: str(row.title, fb.title || ''),
      desc: str(row.desc, fb.desc || ''),
      bg: str(row.bg, fb.bg || ''),
      badge: str(row.badge, fb.badge || ''),
      cta: str(row.cta, fb.cta || ''),
      href: str(row.href, fb.href || ''),
      enabled: bool(row.enabled, fb.enabled !== false),
      order: num(row.order, fb.order ?? idx),
    };
  });
}

function mergeNav(raw: unknown, fallback: CmsNavItem[]): CmsNavItem[] {
  const input = Array.isArray(raw) && raw.length ? raw : fallback;
  return input.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const fb = fallback[idx] || fallback[0];
    return {
      id: str(row.id, fb?.id || `nav-${idx + 1}`),
      href: str(row.href, fb?.href || '#'),
      icon: str(row.icon, fb?.icon || ''),
      label: str(row.label, fb?.label || ''),
      enabled: bool(row.enabled, fb?.enabled !== false),
      order: num(row.order, fb?.order ?? idx),
    };
  });
}

function mergeSteps(raw: unknown, fallback: CmsStepItem[]): CmsStepItem[] {
  const input = Array.isArray(raw) && raw.length ? raw : fallback;
  return input.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const fb = fallback[idx] || fallback[0];
    return {
      id: str(row.id, fb?.id || `step-${idx + 1}`),
      step: str(row.step, fb?.step || String(idx + 1).padStart(2, '0')),
      title: str(row.title, fb?.title || ''),
      desc: str(row.desc, fb?.desc || ''),
      enabled: bool(row.enabled, fb?.enabled !== false),
      order: num(row.order, fb?.order ?? idx),
    };
  });
}

function mergeOptions(raw: unknown, fallback: CmsSelectOption[]): CmsSelectOption[] {
  const input = Array.isArray(raw) && raw.length ? raw : fallback;
  return input.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const fb = fallback[idx] || fallback[0];
    return {
      id: str(row.id, fb?.id || `opt-${idx + 1}`),
      value: str(row.value, fb?.value || ''),
      label: str(row.label, fb?.label || ''),
      enabled: bool(row.enabled, fb?.enabled !== false),
      order: num(row.order, fb?.order ?? idx),
    };
  });
}

function mergeLegalSections(raw: unknown, fallback: LegalSection[]): LegalSection[] {
  const input = Array.isArray(raw) && raw.length ? raw : fallback;
  return input.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const fb = fallback[idx] || fallback[0] || ({} as LegalSection);
    const contactRaw = (row.contactBox ?? fb.contactBox ?? {}) as Record<string, unknown>;
    const hasContact =
      Boolean(fb.contactBox) ||
      Boolean(row.contactBox) ||
      Boolean(contactRaw.email || contactRaw.address || contactRaw.responseWindow);
    return {
      id: str(row.id, fb.id || `section-${idx + 1}`),
      indexLabel: str(row.indexLabel, fb.indexLabel || `${idx + 1}. Section`),
      number: str(row.number, fb.number || String(idx + 1).padStart(2, '0')),
      title: str(row.title, fb.title || ''),
      paragraphs: Array.isArray(row.paragraphs)
        ? row.paragraphs.map((p) => str(p)).filter(Boolean)
        : fb.paragraphs || [],
      bullets: Array.isArray(row.bullets)
        ? row.bullets.map((b) => str(b)).filter(Boolean)
        : fb.bullets,
      contactBox: hasContact
        ? {
            emailLabel: str(contactRaw.emailLabel, fb.contactBox?.emailLabel || 'Email'),
            email: str(contactRaw.email, fb.contactBox?.email || ''),
            addressLabel: str(contactRaw.addressLabel, fb.contactBox?.addressLabel || 'Address'),
            address: str(contactRaw.address, fb.contactBox?.address || ''),
            responseLabel: str(contactRaw.responseLabel, fb.contactBox?.responseLabel || 'Response Window'),
            responseWindow: str(contactRaw.responseWindow, fb.contactBox?.responseWindow || ''),
          }
        : undefined,
      enabled: bool(row.enabled, fb.enabled !== false),
      order: num(row.order, fb.order ?? idx),
    };
  });
}

function normalizeAbout(raw: unknown, fallback: AboutPageContent): AboutPageContent {
  const row = (raw ?? {}) as Record<string, unknown>;
  const help = (row.helpBox ?? {}) as Record<string, unknown>;
  return {
    companyNavLabel: str(row.companyNavLabel, fallback.companyNavLabel),
    legalNavLabel: str(row.legalNavLabel, fallback.legalNavLabel),
    companyNav: mergeNav(row.companyNav, fallback.companyNav),
    legalNav: mergeNav(row.legalNav, fallback.legalNav),
    helpBox: {
      title: str(help.title, fallback.helpBox.title),
      description: str(help.description, fallback.helpBox.description),
      ctaLabel: str(help.ctaLabel, fallback.helpBox.ctaLabel),
      ctaHref: str(help.ctaHref, fallback.helpBox.ctaHref),
    },
    heroEyebrow: str(row.heroEyebrow, fallback.heroEyebrow),
    heroTitleLine1: str(row.heroTitleLine1, fallback.heroTitleLine1),
    heroTitleLine2Prefix: str(row.heroTitleLine2Prefix, fallback.heroTitleLine2Prefix),
    heroTitleAccent: str(row.heroTitleAccent, fallback.heroTitleAccent),
    heroDescription: str(row.heroDescription, fallback.heroDescription),
    heroImageUrl: str(row.heroImageUrl, fallback.heroImageUrl),
    stats: mergeStats(row.stats, fallback.stats),
    whyHeading: str(row.whyHeading, fallback.whyHeading),
    whyCards: mergeCards(row.whyCards, fallback.whyCards),
    companyRows: mergeCards(row.companyRows, fallback.companyRows),
    legalSectionLabel: str(row.legalSectionLabel, fallback.legalSectionLabel),
    legalRows: mergeCards(row.legalRows, fallback.legalRows),
  };
}

function normalizeSuggest(raw: unknown, fallback: SuggestBrandPageContent): SuggestBrandPageContent {
  const row = (raw ?? {}) as Record<string, unknown>;
  const fields = (row.fields ?? {}) as Record<string, unknown>;
  return {
    hero: mergeHero(row.hero, fallback.hero),
    whyHeading: str(row.whyHeading, fallback.whyHeading),
    whyBody: str(row.whyBody, fallback.whyBody),
    whyCards: mergeCards(row.whyCards, fallback.whyCards),
    howHeading: str(row.howHeading, fallback.howHeading),
    howSteps: mergeSteps(row.howSteps, fallback.howSteps),
    benefitsHeading: str(row.benefitsHeading, fallback.benefitsHeading),
    benefitsIntro: str(row.benefitsIntro, fallback.benefitsIntro),
    benefits: Array.isArray(row.benefits) && row.benefits.length
      ? row.benefits.map((b) => str(b)).filter(Boolean)
      : fallback.benefits,
    formHeading: str(row.formHeading, fallback.formHeading),
    formSubheading: str(row.formSubheading, fallback.formSubheading),
    fields: {
      brandName: mergeField(fields.brandName, fallback.fields.brandName),
      website: mergeField(fields.website, fallback.fields.website),
      category: mergeField(fields.category, fallback.fields.category),
      country: mergeField(fields.country, fallback.fields.country),
      reason: mergeField(fields.reason, fallback.fields.reason),
    },
    categoryOptions: mergeOptions(row.categoryOptions, fallback.categoryOptions),
    submitLabel: str(row.submitLabel, fallback.submitLabel),
    successTitle: str(row.successTitle, fallback.successTitle),
    successSubtitle: str(row.successSubtitle, fallback.successSubtitle),
    successBodyTemplate: str(row.successBodyTemplate, fallback.successBodyTemplate),
    successResetLabel: str(row.successResetLabel, fallback.successResetLabel),
  };
}

function normalizePartnership(raw: unknown, fallback: PartnershipPageContent): PartnershipPageContent {
  const row = (raw ?? {}) as Record<string, unknown>;
  const fields = (row.fields ?? {}) as Record<string, unknown>;
  return {
    hero: mergeHero(row.hero, fallback.hero),
    partnerHeading: str(row.partnerHeading, fallback.partnerHeading),
    partnerBody: str(row.partnerBody, fallback.partnerBody),
    categoriesHeading: str(row.categoriesHeading, fallback.categoriesHeading),
    categories: mergeCards(row.categories, fallback.categories),
    credibilityTitle: str(row.credibilityTitle, fallback.credibilityTitle),
    credibilityBody: str(row.credibilityBody, fallback.credibilityBody),
    formHeading: str(row.formHeading, fallback.formHeading),
    formSubheading: str(row.formSubheading, fallback.formSubheading),
    fields: {
      companyName: mergeField(fields.companyName, fallback.fields.companyName),
      contactName: mergeField(fields.contactName, fallback.fields.contactName),
      email: mergeField(fields.email, fallback.fields.email),
      partnershipModel: mergeField(fields.partnershipModel, fallback.fields.partnershipModel),
      message: mergeField(fields.message, fallback.fields.message),
    },
    modelOptions: mergeOptions(row.modelOptions, fallback.modelOptions),
    submitLabel: str(row.submitLabel, fallback.submitLabel),
    successTitle: str(row.successTitle, fallback.successTitle),
    successSubtitle: str(row.successSubtitle, fallback.successSubtitle),
    successBodyTemplate: str(row.successBodyTemplate, fallback.successBodyTemplate),
    successResetLabel: str(row.successResetLabel, fallback.successResetLabel),
  };
}

function normalizeAdvertise(raw: unknown, fallback: AdvertisePageContent): AdvertisePageContent {
  const row = (raw ?? {}) as Record<string, unknown>;
  const fields = (row.fields ?? {}) as Record<string, unknown>;
  return {
    hero: mergeHero(row.hero, fallback.hero),
    whyHeading: str(row.whyHeading, fallback.whyHeading),
    whyBody: str(row.whyBody, fallback.whyBody),
    audienceHeading: str(row.audienceHeading, fallback.audienceHeading),
    audienceStats: mergeStats(row.audienceStats, fallback.audienceStats),
    placementsHeading: str(row.placementsHeading, fallback.placementsHeading),
    placements: mergeCards(row.placements, fallback.placements),
    pricingTitle: str(row.pricingTitle, fallback.pricingTitle),
    pricingBody: str(row.pricingBody, fallback.pricingBody),
    formHeading: str(row.formHeading, fallback.formHeading),
    formSubheading: str(row.formSubheading, fallback.formSubheading),
    fields: {
      brandName: mergeField(fields.brandName, fallback.fields.brandName),
      contactPerson: mergeField(fields.contactPerson, fallback.fields.contactPerson),
      email: mergeField(fields.email, fallback.fields.email),
      budget: mergeField(fields.budget, fallback.fields.budget),
      placementInterest: mergeField(fields.placementInterest, fallback.fields.placementInterest),
      message: mergeField(fields.message, fallback.fields.message),
    },
    budgetOptions: mergeOptions(row.budgetOptions, fallback.budgetOptions),
    placementOptions: mergeOptions(row.placementOptions, fallback.placementOptions),
    submitLabel: str(row.submitLabel, fallback.submitLabel),
    successTitle: str(row.successTitle, fallback.successTitle),
    successSubtitle: str(row.successSubtitle, fallback.successSubtitle),
    successBodyTemplate: str(row.successBodyTemplate, fallback.successBodyTemplate),
    successResetLabel: str(row.successResetLabel, fallback.successResetLabel),
  };
}

function normalizeLegal(raw: unknown, fallback: LegalDocumentContent): LegalDocumentContent {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    hero: mergeHero(row.hero, fallback.hero),
    lastUpdatedText: str(row.lastUpdatedText, fallback.lastUpdatedText),
    indexTitle: str(row.indexTitle, fallback.indexTitle),
    sections: mergeLegalSections(row.sections, fallback.sections).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    ),
  };
}

function normalizeContact(raw: unknown, fallback: ContactPageContent): ContactPageContent {
  const row = (raw ?? {}) as Record<string, unknown>;
  const fields = (row.fields ?? {}) as Record<string, unknown>;
  const methodsRaw = Array.isArray(row.methods) && row.methods.length ? row.methods : fallback.methods;
  return {
    hero: mergeHero(row.hero, fallback.hero),
    useGlobalOfficeAddress: bool(row.useGlobalOfficeAddress, fallback.useGlobalOfficeAddress),
    hqTitle: str(row.hqTitle, fallback.hqTitle),
    hqAddress: str(row.hqAddress, fallback.hqAddress),
    channelsHeading: str(row.channelsHeading, fallback.channelsHeading),
    channels: mergeCards(row.channels, fallback.channels),
    methodsHeading: str(row.methodsHeading, fallback.methodsHeading),
    methods: methodsRaw.map((item, idx) => {
      const m = (item ?? {}) as Record<string, unknown>;
      const fb = fallback.methods[idx] || fallback.methods[0];
      return {
        id: str(m.id, fb?.id || `method-${idx + 1}`),
        title: str(m.title, fb?.title || ''),
        desc: str(m.desc, fb?.desc || ''),
        value: str(m.value, fb?.value || ''),
        iconKey: (str(m.iconKey, fb?.iconKey || 'mail') as 'mail' | 'messenger' | 'social') || 'mail',
        enabled: bool(m.enabled, fb?.enabled !== false),
        order: num(m.order, fb?.order ?? idx),
      };
    }),
    useGlobalSupportEmail: bool(row.useGlobalSupportEmail, fallback.useGlobalSupportEmail),
    commitmentTitle: str(row.commitmentTitle, fallback.commitmentTitle),
    commitmentBody: str(row.commitmentBody, fallback.commitmentBody),
    formHeading: str(row.formHeading, fallback.formHeading),
    formSubheading: str(row.formSubheading, fallback.formSubheading),
    fields: {
      name: mergeField(fields.name, fallback.fields.name),
      email: mergeField(fields.email, fallback.fields.email),
      subject: mergeField(fields.subject, fallback.fields.subject),
      message: mergeField(fields.message, fallback.fields.message),
    },
    submitLabel: str(row.submitLabel, fallback.submitLabel),
    successTitle: str(row.successTitle, fallback.successTitle),
    successSubtitle: str(row.successSubtitle, fallback.successSubtitle),
    successBodyTemplate: str(row.successBodyTemplate, fallback.successBodyTemplate),
    successResetLabel: str(row.successResetLabel, fallback.successResetLabel),
  };
}

/** Deep-merge CMS payload with approved seed defaults (never blank out storefront). */
export function normalizeSitePages(payload: unknown, existing?: SitePagesConfig | null): SitePagesConfig {
  const defaults = defaultSitePages();
  const base = existing || defaults;
  const raw = (payload ?? {}) as Record<string, unknown>;
  return {
    about: normalizeAbout(raw.about ?? base.about, defaults.about),
    suggestBrand: normalizeSuggest(raw.suggestBrand ?? base.suggestBrand, defaults.suggestBrand),
    partnership: normalizePartnership(raw.partnership ?? base.partnership, defaults.partnership),
    advertise: normalizeAdvertise(raw.advertise ?? base.advertise, defaults.advertise),
    terms: normalizeLegal(raw.terms ?? base.terms, defaults.terms),
    privacy: normalizeLegal(raw.privacy ?? base.privacy, defaults.privacy),
    contact: normalizeContact(raw.contact ?? base.contact, defaults.contact),
  };
}

export function resolveSitePages(cms?: SitePagesConfig | null): SitePagesConfig {
  return normalizeSitePages(cms ?? null, null);
}

export function enabledSorted<T extends { enabled?: boolean; order?: number }>(items: T[]): T[] {
  return [...items]
    .filter((item) => item.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
    template,
  );
}
