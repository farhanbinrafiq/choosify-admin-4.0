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

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
