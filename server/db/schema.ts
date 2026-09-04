import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, boolean, timestamp, pgEnum, integer, bigint, jsonb, text, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', [
  'user',
  'seller',
  'verified_seller',
  'moderator',
  'admin',
  'super_admin',
  'creator',
  'finance_manager',
  'support_agent',
  'marketing_manager',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  role: roleEnum('role').notNull().default('user'),
  emailVerified: boolean('email_verified').notNull().default(false),
  /** Permanent human-readable Choosify User ID (CF-00001…). Never reuse. */
  choosifyUserId: varchar('choosify_user_id', { length: 32 }),
  avatarUrl: varchar('avatar_url', { length: 700 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Singleton atomic counter for Choosify User ID allocation (id must remain 1). */
export const choosifyUserIdCounters = pgTable('choosify_user_id_counters', {
  id: integer('id').primaryKey(),
  nextValue: bigint('next_value', { mode: 'number' }).notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Per-entity-type counters for Platform Reference IDs (BR/PR/CT/OR/…). CF uses choosifyUserIdCounters. */
export const choosifyReferenceIdCounters = pgTable('choosify_reference_id_counters', {
  entityType: varchar('entity_type', { length: 32 }).primaryKey(),
  nextValue: bigint('next_value', { mode: 'number' }).notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sellerProfiles = pgTable('seller_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  storeName: varchar('store_name', { length: 160 }).notNull(),
  phone: varchar('phone', { length: 24 }).notNull(),
  category: varchar('category', { length: 120 }).notNull(),
  city: varchar('city', { length: 80 }).notNull(),
  website: varchar('website', { length: 320 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Pre-VPS self-hosting pass — records every file the app-owned media storage
 * (server/lib/mediaStorage.ts) has ever accepted, whether the bytes live on
 * local disk or (optionally, legacy) at a Cloudinary URL. Never stores image
 * binaries — only metadata + a public URL, matching every other durable
 * table in this schema.
 */
export const mediaEnum = pgEnum('media_provider', ['local', 'cloudinary']);
export const mediaVisibilityEnum = pgEnum('media_visibility', ['public', 'private']);
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video', 'document']);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploadedByUserId: uuid('uploaded_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** users | sellers | creators | brands | products | services | reviews | guides | cms | ads | careers | videos | verification | identity-documents | seller-documents | creator-documents | warranty-claims | temporary */
  category: varchar('category', { length: 32 }).notNull(),
  /** public: served as a static URL under MEDIA_PUBLIC_BASE_URL. private: never has a static URL — fetched only via the authenticated GET /catalog/media/private/:id route. */
  visibility: mediaVisibilityEnum('visibility').notNull().default('public'),
  mediaType: mediaTypeEnum('media_type').notNull().default('image'),
  /** Loose polymorphic association (e.g. entityType:'product', entityId:'<catalog product id>') — set by the caller after upload when the media gets attached; null right after upload. */
  relatedEntityType: varchar('related_entity_type', { length: 32 }),
  relatedEntityId: varchar('related_entity_id', { length: 128 }),
  provider: mediaEnum('provider').notNull().default('local'),
  /** Set only when provider = 'local'. Relative to MEDIA_STORAGE_ROOT or PRIVATE_STORAGE_ROOT — never a client-controlled path. */
  relativePath: varchar('relative_path', { length: 500 }),
  /** Null for private media — there is deliberately no static URL to leak. */
  publicUrl: varchar('public_url', { length: 700 }),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  width: integer('width'),
  height: integer('height'),
  durationSeconds: integer('duration_seconds'),
  originalFilename: varchar('original_filename', { length: 255 }),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uploaderIdx: index('media_uploader_idx').on(table.uploadedByUserId),
  categoryIdx: index('media_category_idx').on(table.category),
  entityIdx: index('media_entity_idx').on(table.relatedEntityType, table.relatedEntityId),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Pre-VPS self-hosting pass — self-service email verification + password
 * reset tokens. Same shape/convention as refreshTokens (hash-only storage,
 * one-time-use via consumedAt, real expiry) — deliberately NOT the
 * userProfileExtras disk-snapshot sidecar, because that sidecar previously
 * stored the raw reset token in plaintext, and these are genuine bearer
 * secrets that deserve the same real-table treatment as refresh tokens.
 */
export const authTokenTypeEnum = pgEnum('auth_token_type', ['email_verification', 'password_reset']);

export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: authTokenTypeEnum('type').notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userTypeIdx: index('auth_tokens_user_type_idx').on(table.userId, table.type),
  tokenHashIdx: index('auth_tokens_token_hash_idx').on(table.tokenHash),
}));

/**
 * Social login provider identities. One canonical Choosify user (Postgres) may
 * have zero or more linked provider identities. NEVER stores OAuth access/
 * refresh tokens — basic login only. `provider_subject` is the provider's own
 * stable user id (Google `sub`, Facebook `id`). A social login only ever
 * resolves to / creates a Consumer (`users.role = 'user'`) account — the
 * provider can never influence role.
 */
export const authProviderEnum = pgEnum('auth_provider', ['google', 'facebook']);

export const userIdentities = pgTable('user_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: authProviderEnum('provider').notNull(),
  /** Provider's stable subject id — Google OIDC `sub`, Facebook `id`. */
  providerSubject: varchar('provider_subject', { length: 255 }).notNull(),
  /** Provider-reported email at link time (informational; `users.email` stays canonical). */
  providerEmail: varchar('provider_email', { length: 320 }),
  /** Whether the provider asserted the email as verified when this identity was linked. */
  providerEmailVerified: boolean('provider_email_verified').notNull().default(false),
  linkedAt: timestamp('linked_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  providerSubjectUnique: uniqueIndex('user_identities_provider_subject_unique').on(table.provider, table.providerSubject),
  userProviderUnique: uniqueIndex('user_identities_user_provider_unique').on(table.userId, table.provider),
  userIdx: index('user_identities_user_id_idx').on(table.userId),
}));

/**
 * Optional "add a local password to a passwordless (social-only) Consumer"
 * flow — a dedicated, purpose-bound, two-stage challenge. Kept OUT of
 * `auth_tokens` on purpose: that table holds high-entropy (256-bit) bearer
 * tokens that never need an attempt counter, whereas this flow's stage-1
 * secret is a 6-digit email OTP that is only safe with server-side
 * brute-force limiting (`attempts`) and send throttling (`resend_count` /
 * `last_sent_at`). Stage 2 is a short-lived server-minted authorization
 * (`grant_hash`) so a verified OTP is never an indefinitely reusable
 * "otpVerified" state. Only ever used for `purpose = 'SET_LOCAL_PASSWORD'`
 * and only for `users.role = 'user'` with `users.password_hash IS NULL`.
 * Never used to change an existing password.
 */
export const localPasswordSetups = pgTable('local_password_setups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Fixed discriminator — guards against this row ever being consumed by another flow. */
  purpose: varchar('purpose', { length: 40 }).notNull().default('SET_LOCAL_PASSWORD'),
  // ── Stage 1: the emailed 6-digit code ──
  /** sha256(pepper : userId : purpose : code) — the raw code is never stored. */
  codeHash: varchar('code_hash', { length: 255 }).notNull(),
  codeExpiresAt: timestamp('code_expires_at').notNull(),
  /** Wrong-code submissions against this row; the row locks at the cap. */
  attempts: integer('attempts').notNull().default(0),
  /** How many codes have been issued in this setup episode (send throttle). */
  resendCount: integer('resend_count').notNull().default(0),
  lastSentAt: timestamp('last_sent_at').notNull().defaultNow(),
  verifiedAt: timestamp('verified_at'),
  // ── Stage 2: the short-lived purpose-bound authorization minted on verify ──
  /** sha256(pepper : userId : purpose : grant) — raw grant returned once, never stored. */
  grantHash: varchar('grant_hash', { length: 255 }),
  grantExpiresAt: timestamp('grant_expires_at'),
  /** Set when the password is actually written — whole row is then spent. */
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('local_password_setups_user_id_idx').on(table.userId),
  codeHashIdx: index('local_password_setups_code_hash_idx').on(table.codeHash),
  grantHashIdx: index('local_password_setups_grant_hash_idx').on(table.grantHash),
}));

/** Sprint 10 durability migration — Partner Applications (was in-memory + JSON snapshot). */
export const partnerApplications = pgTable('partner_applications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  applicantType: varchar('applicant_type', { length: 16 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  email: varchar('email', { length: 320 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 24 }).notNull(),
  businessOrChannelName: varchar('business_or_channel_name', { length: 160 }).notNull(),
  category: varchar('category', { length: 120 }).notNull(),
  city: varchar('city', { length: 80 }).notNull(),
  website: varchar('website', { length: 320 }),
  niche: varchar('niche', { length: 160 }),
  contentFocus: varchar('content_focus', { length: 160 }),
  socialPrimary: varchar('social_primary', { length: 320 }),
  audienceSize: varchar('audience_size', { length: 64 }),
  notes: text('notes'),
  existingUserId: uuid('existing_user_id').references(() => users.id, { onDelete: 'set null' }),
  provisionedUserId: uuid('provisioned_user_id').references(() => users.id, { onDelete: 'set null' }),
  catalogEntityId: varchar('catalog_entity_id', { length: 120 }),
  adminNotes: text('admin_notes'),
  resubmissionRequested: boolean('resubmission_requested').notNull().default(false),
  reviewedAt: timestamp('reviewed_at'),
  reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
  /** Array of {at, by, action, note}. */
  reviewHistory: jsonb('review_history').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('partner_applications_status_idx').on(table.status),
  emailIdx: index('partner_applications_email_idx').on(table.email),
  provisionedUserIdx: index('partner_applications_provisioned_user_idx').on(table.provisionedUserId),
}));

/**
 * Sprint 10 durability migration — Feature Entitlements (was in-memory + JSON snapshot).
 * Normalized so role defaults / plan defaults / per-account overrides share one table,
 * matching the existing precedence logic (account override -> plan -> role default).
 * Completely separate from Marketplace Access, which remains its own authorization system.
 */
export const featureEntitlementScopeEnum = pgEnum('feature_entitlement_scope', ['role', 'plan', 'account']);

export const featureEntitlements = pgTable('feature_entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  scope: featureEntitlementScopeEnum('scope').notNull(),
  /** role name ('seller'|'creator'), planId, or userId depending on scope. */
  scopeKey: varchar('scope_key', { length: 120 }).notNull(),
  featureKey: varchar('feature_key', { length: 80 }).notNull(),
  enabled: boolean('enabled').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  scopeKeyFeatureUnique: uniqueIndex('feature_entitlements_scope_key_feature_unique').on(table.scope, table.scopeKey, table.featureKey),
}));

/** Sprint 10 durability migration — Notifications (was a bare in-memory Map, no disk snapshot at all). */
export const notifications = pgTable('notifications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  priority: varchar('priority', { length: 32 }).notNull().default('normal'),
  title: varchar('title', { length: 320 }).notNull(),
  summary: text('summary'),
  actionUrl: varchar('action_url', { length: 500 }),
  channels: jsonb('channels').notNull().default([]),
  read: boolean('read').notNull().default(false),
  dismissed: boolean('dismissed').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  pinned: boolean('pinned').notNull().default(false),
  metadata: jsonb('metadata'),
  readAt: timestamp('read_at'),
  dismissedAt: timestamp('dismissed_at'),
  archivedAt: timestamp('archived_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
  userReadIdx: index('notifications_user_read_idx').on(table.userId, table.read),
}));

/**
 * Sprint 11 — minimal Plan / Account Plan foundation. Deliberately NOT a billing
 * system: no price/invoice/payment-gateway fields, no recurring-charge logic.
 * Gives the existing featureEntitlements `scope: 'plan'` mechanism (Sprint 10,
 * previously unreachable — resolveFeatureEnabled accepted a planId param that no
 * caller ever populated) a real catalog and a real per-account assignment, so
 * "PLAN LOCKED" UI can be backed by real plan metadata instead of staying inert.
 */
export const plans = pgTable('plans', {
  id: varchar('id', { length: 64 }).primaryKey(),
  role: varchar('role', { length: 16 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  priceLabel: varchar('price_label', { length: 64 }),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  roleIdx: index('plans_role_idx').on(table.role),
}));

export const accountPlans = pgTable('account_plans', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  planId: varchar('plan_id', { length: 64 }).notNull().references(() => plans.id),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  assignedByUserId: uuid('assigned_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Sprint 11 — canonical Feature Request workflow. Seller/Creator requests
 * access to a feature/plan; Admin reviews (approve/decline/contact). Never
 * self-enables anything — approval only records a decision + optional note,
 * the actual entitlement/plan grant remains a separate explicit Admin action
 * (feature_entitlements / account_plans), matching how Marketplace Access and
 * Partner Applications already keep "request" and "grant" as distinct steps.
 */
export const featureRequestStatusEnum = pgEnum('feature_request_status', ['pending', 'approved', 'declined', 'contacted']);

export const featureRequests = pgTable('feature_requests', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).notNull(),
  featureKey: varchar('feature_key', { length: 80 }).notNull(),
  message: text('message'),
  status: featureRequestStatusEnum('status').notNull().default('pending'),
  reviewedAt: timestamp('reviewed_at'),
  reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userFeatureActiveUnique: uniqueIndex('feature_requests_user_feature_pending_unique')
    .on(table.userId, table.featureKey)
    .where(sql`status = 'pending'`),
  statusIdx: index('feature_requests_status_idx').on(table.status),
}));
