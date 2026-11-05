import type {
  AboutPageContent,
  AdvertisePageContent,
  ContactPageContent,
  LegalDocumentContent,
  PartnershipPageContent,
  SitePagesConfig,
  SuggestBrandPageContent,
} from './types';

/** Seed = current approved storefront copy (visual/content baseline). */

export const DEFAULT_ABOUT: AboutPageContent = {
  companyNavLabel: 'ABOUT CHOOSIFY',
  legalNavLabel: 'LEGAL',
  companyNav: [
    { id: 'about-top', href: '#about-top', icon: '🏠', label: 'About Us', enabled: true, order: 0 },
    { id: 'suggest-brand', href: '#suggest-brand', icon: '🏷', label: 'Suggest a Brand', enabled: true, order: 1 },
    { id: 'partnership', href: '#partnership', icon: '🤝', label: 'Partnership', enabled: true, order: 2 },
    { id: 'advertise', href: '#advertise', icon: '📢', label: 'Advertise', enabled: true, order: 3 },
    { id: 'b2b', href: '#b2b', icon: '🏢', label: 'B2B Solutions', enabled: true, order: 4 },
  ],
  legalNav: [
    { id: 'terms', href: '#terms', icon: '📄', label: 'Terms of Service', enabled: true, order: 0 },
    { id: 'privacy', href: '#privacy', icon: '🔒', label: 'Privacy Policy', enabled: true, order: 1 },
    { id: 'contact', href: '#contact', icon: '✉', label: 'Contact Us', enabled: true, order: 2 },
  ],
  helpBox: {
    title: 'Need Help?',
    description: 'Our support team is here to assist you.',
    ctaLabel: 'Contact Support',
    ctaHref: '/messages',
  },
  heroEyebrow: 'ABOUT CHOOSIFY',
  heroTitleLine1: 'Choose. Compare.',
  heroTitleLine2Prefix: 'Decide',
  heroTitleAccent: 'Wisely.',
  heroDescription:
    "Choosify is Bangladesh's smart product discovery and decision-making platform. We help you explore trusted products, compare prices, read real reviews, and make confident choices.",
  heroImageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
  // No invented figures: the About page shows live counts only (see AboutPage).
  stats: [],
  whyHeading: 'Why Choosify?',
  whyCards: [
    { id: 'smart', icon: '🔍', title: 'Smart Discovery', desc: 'Find trusted products across categories with curated catalogs.', bg: '#FFF3EA', enabled: true, order: 0 },
    { id: 'compare', icon: '⚖', title: 'Honest Compare', desc: 'Side-by-side specs, prices, and reviews before you buy.', bg: '#EEF0FF', enabled: true, order: 1 },
    { id: 'reviews', icon: '⭐', title: 'Real Reviews', desc: 'Community and creator insights you can actually use.', bg: '#ECFDF3', enabled: true, order: 2 },
    { id: 'deals', icon: '🏷', title: 'Live Deals', desc: 'Track promos and savings from verified sellers.', bg: '#FFF7ED', enabled: true, order: 3 },
    { id: 'confident', icon: '🛡', title: 'Shop Confident', desc: 'Verified brands, transparent info, safer decisions.', bg: '#F3E8FF', enabled: true, order: 4 },
  ],
  companyRows: [
    { id: 'suggest-brand', icon: '🏷', bg: '#FFF3EA', title: 'Suggest a Brand', desc: 'Know a great Bangladeshi brand we should list? Tell us.', cta: 'Submit suggestion', href: '/contact', enabled: true, order: 0 },
    { id: 'partnership', icon: '🤝', bg: '#EEF0FF', title: 'Partnership', desc: 'Collaborate with Choosify on campaigns, content, and growth.', cta: 'Partner with us', href: '/contact', enabled: true, order: 1 },
    { id: 'advertise', icon: '📢', bg: '#ECFDF3', title: 'Advertise', desc: 'Reach high-intent shoppers across discovery surfaces.', cta: 'Advertise here', href: '/contact', enabled: true, order: 2 },
    { id: 'b2b', icon: '🏢', bg: '#FFF7ED', title: 'B2B Solutions', desc: 'Procurement tools and catalogs for teams and retailers.', cta: 'Explore B2B', href: '/contact', enabled: true, order: 3 },
  ],
  legalSectionLabel: 'LEGAL',
  legalRows: [
    { id: 'terms', icon: '📄', bg: '#F4F7F9', title: 'Terms of Service', desc: 'Rules for using Choosify products and community features.', enabled: true, order: 0 },
    { id: 'privacy', icon: '🔒', bg: '#F4F7F9', title: 'Privacy Policy', desc: 'How we collect, use, and protect your information.', enabled: true, order: 1 },
    { id: 'contact', icon: '✉', bg: '#F4F7F9', title: 'Contact Us', desc: 'Reach support, partnerships, or press — we respond fast.', enabled: true, order: 2 },
  ],
};

export const DEFAULT_SUGGEST_BRAND: SuggestBrandPageContent = {
  hero: {
    badge: 'Community Discovery',
    title: 'Suggest a Brand',
    description:
      'Help us discover great brands for the Choosify community. Recommend local or international brands that offer quality, authenticity, and incredible value.',
    sideCardTitle: 'Discovery Engine',
    sideCardSubtitle: 'Community Driven',
    sideCardBody:
      'Every suggestion is reviewed by the Choosify team before a brand is considered for listing. Your recommendation helps us find authentic brands worth featuring.',
    sideCardIcon: '💡',
  },
  whyHeading: 'Why Suggest Brands',
  whyBody:
    "Choosify is built on trust, transparency, and authenticity. By suggesting high-quality brands that deserve a spotlight, you help Bangladeshi shoppers make confident buying choices and connect with authentic outlets.",
  whyCards: [
    { id: 'secure', title: 'Expand Secure Outlets', desc: 'We vet every recommended store against stringent authenticity guidelines to protect consumers.', enabled: true, order: 0 },
    { id: 'local', title: 'Promote Local Craft', desc: 'Support home-grown Bangladeshi artisans, weavers, boutique designers, and indie entrepreneurs.', enabled: true, order: 1 },
  ],
  howHeading: 'How Brand Discovery Works',
  howSteps: [
    { id: 's1', step: '01', title: 'Submit Recommendation', desc: 'Provide basic brand coordinates such as their website, social media profile, and category fields.', enabled: true, order: 0 },
    { id: 's2', step: '02', title: 'Authenticity Vetting', desc: 'Our moderation desk evaluates their customer reputation, catalog quality, and business integrity.', enabled: true, order: 1 },
    { id: 's3', step: '03', title: 'Platform Onboarding', desc: 'We list the approved brand profile, letting users search their items, compare rates, and write reviews.', enabled: true, order: 2 },
  ],
  benefitsHeading: 'Benefits of Joining Choosify',
  benefitsIntro: 'Brands listed on Choosify can:',
  benefits: [
    'Have a brand profile discoverable in search and brand pages',
    'Apply for brand verification to show credibility',
    'Collect and respond to customer reviews',
    'Appear in product comparisons',
    'Post deals, promotions, and discount vouchers',
    'Request sponsored placements, reviewed by our team',
  ],
  formHeading: 'Suggest Sourcing',
  formSubheading: 'Fill in brand credentials below',
  fields: {
    brandName: { label: 'Brand Name *', placeholder: 'e.g., Aarong, Apex, local boutique name' },
    website: { label: 'Website / Social Profile *', placeholder: 'e.g., www.brand.com or social URL' },
    category: { label: 'Category', placeholder: 'Select a Category' },
    country: { label: 'Country', placeholder: 'e.g., Bangladesh, Japan, USA' },
    reason: { label: 'Why should we list this brand? *', placeholder: 'Tell us what makes them stand out, their catalog, authenticity level, etc.' },
  },
  // Categories now come from the live catalog (GET /operations/lead-options); kept for CMS shape compatibility.
  categoryOptions: [],
  submitLabel: 'Submit Suggestion',
  successTitle: 'Request received',
  successSubtitle: 'Brand suggestion recorded',
  successBodyTemplate:
    "Thank you — your suggestion for {{brandName}} has been received. The Choosify team will review it and may contact you using the email you provided.",
  successResetLabel: 'Suggest Another Brand',
};

export const DEFAULT_PARTNERSHIP: PartnershipPageContent = {
  hero: {
    badge: 'Collaborate & Scale',
    title: 'Partnership Opportunities',
    description:
      'Partner with Choosify, a product discovery platform for Bangladeshi shoppers. Work with us to grow your brand, build transparency, and reach engaged buyers.',
    sideCardTitle: 'Synergetic Ecosystem',
    sideCardSubtitle: 'Win-Win Dynamic',
    sideCardBody:
      'We match verified brands with native creators to drive trustworthy commerce. Empowering buyers with crystal clear data.',
    sideCardIcon: '🤝',
  },
  partnerHeading: 'Partner With Choosify',
  partnerBody:
    'Choosify acts as the primary hub connecting authentic brands with verified creators and curious shoppers. Our platform supports collaborative growth models that align brand visibility with real audience engagement. Explore how our partnerships can unlock reliable revenue pipelines for your business.',
  categoriesHeading: 'Partnership Categories',
  categories: [
    { id: 'brand', icon: 'award', title: 'Brand / Seller Partnerships', desc: 'List your catalog, apply for brand verification, and run deals and promotions on Choosify.', enabled: true, order: 0 },
    { id: 'creator', icon: 'users', title: 'Creator Partnerships', desc: 'Publish buying guides and reviews, and grow your audience through the Choosify creator program.', enabled: true, order: 1 },
  ],
  credibilityTitle: 'Built on Trust',
  credibilityBody:
    'Brand verification and moderated listings help shoppers trust what they find on Choosify — and that trust extends to our partners.',
  formHeading: 'Request Partnership',
  formSubheading: 'Submit strategic collaboration request',
  fields: {
    companyName: { label: 'Company / Brand Name *', placeholder: 'e.g., Bata, Apex, local agency, or creator name' },
    contactName: { label: 'Primary Contact Name *', placeholder: 'e.g., Farhan Rafiq' },
    email: { label: 'Business Email *', placeholder: 'e.g., partnerships@brand.com' },
    partnershipModel: { label: 'Partnership Model', placeholder: '' },
    message: { label: 'Brief Proposal / Message', placeholder: 'Describe your goals, audience size, integration interests, or agency roster details.' },
  },
  // Partnership models now come from the server registry (GET /operations/lead-options); kept for CMS shape compatibility.
  modelOptions: [],
  submitLabel: 'Submit Proposal',
  successTitle: 'Request received',
  successSubtitle: 'Partnership request recorded',
  successBodyTemplate:
    'Thank you — we have received the partnership request for {{companyName}}. The Choosify team will review it and contact {{contactName}} using the details provided.',
  successResetLabel: 'Submit Another Request',
};

export const DEFAULT_ADVERTISE: AdvertisePageContent = {
  hero: {
    badge: 'Premium Brand Exposure',
    title: 'Advertise on Choosify',
    description:
      'Put your brand in front of Bangladeshi shoppers while they compare prices, read recommendations, and decide what to buy.',
    sideCardTitle: 'Where Decisions Happen',
    sideCardBody:
      'Choosify placements appear on the pages shoppers use to compare products and brands, so your catalog stays visible at the moment of choice.',
  },
  whyHeading: 'Why Advertise',
  whyBody:
    'Shoppers come to Choosify with a purpose: to compare, discover, and buy. Placements here sit alongside that intent rather than interrupting an unrelated feed.',
  audienceHeading: 'Audience Overview',
  // No verified audience metrics are published yet; the section is hidden while this list is empty.
  audienceStats: [],
  placementsHeading: 'Placement Opportunities',
  placements: [
    { id: 'home', icon: 'megaphone', title: 'Homepage Banners', desc: 'Banner placements on the Choosify homepage.', enabled: true, order: 0 },
    { id: 'deals', icon: 'trending', title: 'Deals Placements', desc: 'Featured positions for your offers on the Deals page.', enabled: true, order: 1 },
    { id: 'browse', icon: 'sparkles', title: 'Category, Brand & Product Pages', desc: 'Banners on category, browse, brand, and product pages where shoppers compare options.', enabled: true, order: 2 },
    { id: 'recs', icon: 'layers', title: 'Sponsored Listings', desc: 'Sponsored products, brands, deals, and recommendations shown within listings, clearly labelled as sponsored.', enabled: true, order: 3 },
  ],
  pricingTitle: 'Pricing on Request',
  pricingBody:
    "Pricing depends on the placement, duration, and category. Tell us about your goals and our team will follow up with options — nothing is booked or charged until you agree.",
  formHeading: 'Talk To Our Team',
  formSubheading: 'Start building your custom campaign',
  fields: {
    brandName: { label: 'Brand Name *', placeholder: 'e.g., Bata Bangladesh, Apex, Sailor' },
    contactPerson: { label: 'Contact Person *', placeholder: 'e.g., Farhan Rafiq' },
    email: { label: 'Business Email *', placeholder: 'e.g., marketing@brand.com' },
    budget: { label: 'Monthly Budget Scope', placeholder: '' },
    placementInterest: { label: 'Placement Interest', placeholder: '' },
    message: { label: 'Campaign Goals', placeholder: 'Describe what products you wish to spotlight, your launch timeline, etc.' },
  },
  // Budget ranges and placement interests now come from the server registry (GET /operations/lead-options).
  budgetOptions: [],
  placementOptions: [],
  submitLabel: 'Talk To Our Team',
  successTitle: 'Request received',
  successSubtitle: 'Advertising inquiry recorded',
  successBodyTemplate:
    'Thank you — we have received the advertising inquiry for {{brandName}}. The Choosify team will review it and contact {{contactPerson}}. No placement has been booked and nothing has been charged.',
  successResetLabel: 'Submit Another Inquiry',
};

export const DEFAULT_TERMS: LegalDocumentContent = {
  hero: {
    badge: 'Legal Standards',
    title: 'Terms of Service',
    description: 'Please read these terms carefully before accessing or using Choosify. Last updated: June 2026.',
    sideCardTitle: 'Legal Integrity',
    sideCardBody:
      'By using our product discovery platform, comparison tools, and deal portals, you agree to comply with our global user rules.',
  },
  lastUpdatedText: 'Last updated: June 2026',
  indexTitle: 'Document Index',
  sections: [
    {
      id: 'intro',
      indexLabel: '1. Introduction',
      number: '01',
      title: 'Introduction',
      paragraphs: [
        'Welcome to Choosify (owned and operated by Choosify.bd). These Terms of Service ("Terms") govern your access to and use of our website, mobile applications, product discovery catalogs, pricing comparison engines, coupon code features, and seller services (collectively, the "Platform").',
        'By accessing, browsing, registering for, or using any part of the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms. If you do not agree to these Terms, please refrain from using our Platform immediately.',
      ],
      enabled: true,
      order: 0,
    },
    {
      id: 'user-resp',
      indexLabel: '2. User Responsibilities',
      number: '02',
      title: 'User Responsibilities',
      paragraphs: [
        'As a user of Choosify, you agree to utilize the Platform solely for lawful purposes and in absolute compliance with these Terms. Specifically:',
      ],
      bullets: [
        'You must provide truthful, accurate, and current information when registering an account, proposing brand suggestions, or leaving public product reviews.',
        'You are solely responsible for protecting the confidentiality of your account password and for all activity occurring under your account.',
        'You agree not to bypass, disable, or interfere with any security features or comparison validation mechanisms integrated into the Platform.',
      ],
      enabled: true,
      order: 1,
    },
    {
      id: 'seller-resp',
      indexLabel: '3. Seller Responsibilities',
      number: '03',
      title: 'Seller Responsibilities',
      paragraphs: [
        'Sellers who claim brand profiles or post coupon offers on Choosify must adhere to high standards of commercial honesty:',
      ],
      bullets: [
        'Sellers must guarantee the authenticity of listed items. Listing replica, counterfeit, or misleadingly branded goods is strictly prohibited and subject to immediate ban.',
        'Sellers must maintain honest and accurate inventory, pricing parameters, and delivery options inside their dashboards.',
        'Sellers are legally liable for fulfilling orders processed via integrated retail checkout loops and maintaining BSTI certifications where applicable.',
      ],
      enabled: true,
      order: 2,
    },
    {
      id: 'creator-resp',
      indexLabel: '4. Creator Responsibilities',
      number: '04',
      title: 'Creator Responsibilities',
      paragraphs: [
        'Influencers and creators registered on our Directory agree to maintain integrity in their recommendations and sponsored videos:',
      ],
      bullets: [
        'Creators must disclose any affiliate relationships, paid sponsorships, or promotional perks related to products they feature or review on the Platform.',
        'Creators are prohibited from posting false reviews, misleading rating boosts, or unverified claims regarding brand products.',
      ],
      enabled: true,
      order: 3,
    },
    {
      id: 'intellectual-prop',
      indexLabel: '5. Intellectual Property',
      number: '05',
      title: 'Intellectual Property',
      paragraphs: [
        'The Platform design, code, logos, trademarks, visual assets, text layouts, comparison algorithms, and databases are the exclusive intellectual property of Choosify.bd and are protected by Bangladeshi intellectual property laws.',
        'Users retain ownership of content they publish (such as review text or suggested brand descriptions) but grant Choosify an infinite, royalty-free, global license to display, index, and promote that user-generated content across our discovery ecosystems.',
      ],
      enabled: true,
      order: 4,
    },
    {
      id: 'prohibited-act',
      indexLabel: '6. Prohibited Activities',
      number: '06',
      title: 'Prohibited Activities',
      paragraphs: ['Users are strictly forbidden from engaging in the following behaviors on Choosify:'],
      bullets: [
        'Using web scrapers, data miners, or bots to harvest product comparison lists, creator profiles, or deal databases without our express written permission.',
        'Posting abusive, pornographic, harassing, or defamatory text inside public reviews or brand suggestion descriptions.',
        'Creating fake accounts to boost store ratings, post fake deals, or spam competitor listings.',
      ],
      enabled: true,
      order: 5,
    },
    {
      id: 'termination',
      indexLabel: '7. Account Termination',
      number: '07',
      title: 'Account Termination',
      paragraphs: [
        'Choosify reserves the absolute right to suspend, terminate, or restrict access to any user, creator, or seller account at our sole discretion, without prior notice, for conduct that violates these Terms, harms our community, or compromises the commercial integrity of the Platform.',
      ],
      enabled: true,
      order: 6,
    },
    {
      id: 'disclaimers',
      indexLabel: '8. Disclaimers',
      number: '08',
      title: 'Disclaimers',
      paragraphs: [
        'Choosify is a product discovery and price comparison platform. While we make every effort to verify seller authenticity and catalog data accuracy, we do not warrant or guarantee that any seller offers, deal codes, specifications, or pricing descriptions listed on the Platform are completely error-free or current at any given instant.',
        'Our Platform is provided "as is" and "as available," without warranties of any kind, whether express or implied.',
      ],
      enabled: true,
      order: 7,
    },
    {
      id: 'contact',
      indexLabel: '9. Contact Information',
      number: '09',
      title: 'Contact Information',
      paragraphs: [
        'If you have any questions, compliance inquiries, or disputes regarding these Terms of Service, please reach out to our legal compliance office at:',
      ],
      contactBox: {
        emailLabel: 'Email',
        email: 'legal@choosify.bd',
        addressLabel: 'Address',
        address: 'Level 11, Gulshan Commerce Center, Gulshan-2, Dhaka, Bangladesh',
        responseLabel: 'Response Window',
        responseWindow: '3 Business Days',
      },
      enabled: true,
      order: 8,
    },
  ],
};

export const DEFAULT_PRIVACY: LegalDocumentContent = {
  hero: {
    badge: 'User Protection',
    title: 'Privacy Policy',
    description:
      'We are committed to securing your data. Learn how we collect, store, and utilize your information. Last updated: June 2026.',
    sideCardTitle: 'Secure Handling',
    sideCardBody:
      'Our privacy rules ensure absolute confidentiality, in compliance with standard digital protection regulations.',
  },
  lastUpdatedText: 'Last updated: June 2026',
  indexTitle: 'Document Index',
  sections: [
    {
      id: 'collect',
      indexLabel: '1. Information We Collect',
      number: '01',
      title: 'Information We Collect',
      paragraphs: [
        'We collect personal parameters to deliver dynamic product comparisons and secure retail checkout loops. This includes:',
      ],
      bullets: [
        'Personal Credentials: Full name, email address, physical shipping coordinates, telephone numbers, and profile details provided during account creation or checkout.',
        'Seller Information: Brand registration numbers, outlet licenses, and representative contacts.',
        'Usage Metrics: Browser type, device IP addresses, viewed product comparison categories, and clicked deal voucher codes.',
      ],
      enabled: true,
      order: 0,
    },
    {
      id: 'use',
      indexLabel: '2. How We Use Information',
      number: '02',
      title: 'How We Use Information',
      paragraphs: ['Choosify utilizes stored parameters strictly for standard operational purposes, including:'],
      bullets: [
        'Operating and optimizing our price comparison calculators and discovery feeds.',
        'Fulfilling customer orders and processing retail checkout logistics with registered sellers.',
        'Responding to brand suggestion proposals and partnership forms.',
        'Detecting fraudulent ratings, fake product reviews, or bot scraping activities.',
      ],
      enabled: true,
      order: 1,
    },
    {
      id: 'cookies',
      indexLabel: '3. Cookies & Tracking',
      number: '03',
      title: 'Cookies & Tracking Technologies',
      paragraphs: [
        'We use tracking cookies, local session storage parameters, and diagnostic tools to persist user selections (e.g., comparison items, dashboard layout preferences, and active carts).',
        'You can adjust your browser properties to decline cookie tracking, though some parts of the comparison platform or checkout cycles may not operate seamlessly.',
      ],
      enabled: true,
      order: 2,
    },
    {
      id: 'security',
      indexLabel: '4. Security Measures',
      number: '04',
      title: 'Security Measures',
      paragraphs: [
        'We implement industry-standard administrative, physical, and technological security barriers to safeguard your personal credentials from unauthorized modification, access, exposure, or destruction.',
        'All checkout routes and form submissions are protected via Secure Sockets Layer (SSL) encryption, ensuring data transmission remains private.',
      ],
      enabled: true,
      order: 3,
    },
    {
      id: 'third-party',
      indexLabel: '5. Third Party Services',
      number: '05',
      title: 'Third Party Services',
      paragraphs: [
        'Our platform includes links to third-party brand websites, seller outlets, and creator social profiles. We do not control or assume liability for the privacy guidelines or content hosted on external, third-party sites. We recommend reviewing their policies on their respective platforms.',
      ],
      enabled: true,
      order: 4,
    },
    {
      id: 'rights',
      indexLabel: '6. User Rights',
      number: '06',
      title: 'User Rights',
      paragraphs: [
        'Depending on your geographic location, you retain key rights regarding your personal information, including:',
      ],
      bullets: [
        'The right to inspect what personal credentials we store.',
        'The right to request immediate correction of outdated or incorrect shipping/contact records.',
        'The right to request total deletion of your profile database and account history from our systems.',
      ],
      enabled: true,
      order: 5,
    },
    {
      id: 'retention',
      indexLabel: '7. Data Retention',
      number: '07',
      title: 'Data Retention',
      paragraphs: [
        'We store collected data only as long as necessary to fulfill active comparison and retail services, support legal compliance audits, or resolve platform disputes. Profile data is kept until an explicit deletion request is received and verified.',
      ],
      enabled: true,
      order: 6,
    },
    {
      id: 'contact',
      indexLabel: '8. Contact Information',
      number: '08',
      title: 'Contact Information',
      paragraphs: [
        'For security inquiries, privacy complaints, or data deletion requests, please contact our data protection office at:',
      ],
      contactBox: {
        emailLabel: 'Email',
        email: 'privacy@choosify.bd',
        addressLabel: 'Office Address',
        address: 'Level 11, Gulshan Commerce Center, Gulshan-2, Dhaka, Bangladesh',
      },
      enabled: true,
      order: 7,
    },
  ],
};

export const DEFAULT_CONTACT: ContactPageContent = {
  hero: {
    badge: 'Get In Touch',
    title: 'Contact Choosify',
    description:
      "We're here to assist. Connect with our dedicated support, brand verification, and business development relations desk.",
  },
  useGlobalOfficeAddress: true,
  hqTitle: 'Dhaka HQ',
  hqAddress: 'Level 11, Gulshan Commerce Center, Road 45, Gulshan-2, Dhaka, Bangladesh.',
  channelsHeading: 'Support Channels',
  channels: [
    { id: 'general', title: 'General Support', desc: 'Got questions about price comparisons, local deal updates, or user accounts? Our support team is ready to help.', badge: 'Help Desk', enabled: true, order: 0 },
    { id: 'brand', title: 'Brand Support', desc: 'Need assistance claiming your brand page, adjusting listing descriptions, or managing discount coupons?', badge: 'Sellers Desk', enabled: true, order: 1 },
    { id: 'creator', title: 'Creator Support', desc: "Encountered issues syncing your TikTok profile or updating your directory portfolio? Let's resolve it.", badge: 'Creators Desk', enabled: true, order: 2 },
    { id: 'business', title: 'Business Inquiries', desc: 'Interested in sponsored guide campaigns, corporate advertising plans, or platform partnerships?', badge: 'BD Team', enabled: true, order: 3 },
  ],
  methodsHeading: 'Contact Methods',
  methods: [
    { id: 'email', iconKey: 'mail', title: 'Email Support', value: '{{supportEmail}}', desc: 'We read every message', enabled: true, order: 0 },
    { id: 'messenger', iconKey: 'messenger', title: 'Messenger Support', value: 'fb.com/choosify.bd', desc: 'Live chat during working hours', enabled: true, order: 1 },
    { id: 'social', iconKey: 'social', title: 'Social Channels', value: '@choosify.bd', desc: 'DM us on Instagram or TikTok', enabled: true, order: 2 },
  ],
  useGlobalSupportEmail: true,
  commitmentTitle: 'We Aim to Respond Promptly',
  commitmentBody:
    'Every message sent through this form is recorded and reviewed by the Choosify team. Thank you for helping us maintain a transparent marketplace!',
  formHeading: 'Send A Message',
  formSubheading: 'Fill in parameters below',
  fields: {
    name: { label: 'Your Name *', placeholder: 'e.g., Farhan Bin Rafiq' },
    email: { label: 'Email Address *', placeholder: 'e.g., support@brand.com' },
    subject: { label: 'Subject *', placeholder: 'e.g., Verification Dispute, Guide Suggestion' },
    message: { label: 'Message Content *', placeholder: 'How can we help? Provide order details or profile link if relevant.' },
  },
  submitLabel: 'Submit Message',
  successTitle: 'Message received',
  successSubtitle: 'Your message has been recorded',
  successBodyTemplate:
    'Thank you — we have received your message regarding "{{subject}}". The Choosify team will review it and reply to {{email}}.',
  successResetLabel: 'Send Another Message',
};

export function defaultSitePages(): SitePagesConfig {
  return {
    about: DEFAULT_ABOUT,
    suggestBrand: DEFAULT_SUGGEST_BRAND,
    partnership: DEFAULT_PARTNERSHIP,
    advertise: DEFAULT_ADVERTISE,
    terms: DEFAULT_TERMS,
    privacy: DEFAULT_PRIVACY,
    contact: DEFAULT_CONTACT,
  };
}
