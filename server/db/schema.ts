import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
