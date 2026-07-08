# Firestore Composite Indexes

This document lists Firestore queries that require composite indexes. **Indexes are not created automatically by this sprint.** Add them manually in Firebase Console or via `firestore.indexes.json` when enabling production Firestore backends.

## How to create indexes

1. Open Firebase Console → Firestore → Indexes
2. Create composite indexes listed below, or
3. Run a query in development and use the auto-generated index link from the error message

---

## Required composite indexes

### `omni_messages`

| Query | Fields | Order | Used by |
|-------|--------|-------|---------|
| Messages by conversation | `conversationId` ASC, `timestamp` ASC | Composite | `listMessages()` |
| Latest inbound message | `conversationId` ASC, `direction` ASC, `timestamp` DESC | Composite | `getLatestInboundMessage()` |
| Platform deduplication | `platformMessageId` ASC | Single-field (auto) | `messageExistsByPlatformId()` |

**Index definition (messages by conversation):**
```
Collection: omni_messages
Fields: conversationId ASC, timestamp ASC
```

**Index definition (latest inbound):**
```
Collection: omni_messages
Fields: conversationId ASC, direction ASC, timestamp DESC
```

### `omni_conversations`

| Query | Fields | Order | Used by |
|-------|--------|-------|---------|
| Inbox ordering | `updatedAt` DESC | Single-field | `listConversations()` |

Single-field indexes are created automatically by Firestore.

### `admin_users`

| Query | Fields | Order | Used by |
|-------|--------|-------|---------|
| Lookup by email | `email` ASC | Single-field | `loadAdminUserByEmail()` |

Ensure `email` values are stored lowercase to match query normalization.

---

## Single-document collections (no composite index)

| Collection / Doc | Access pattern |
|----------------|----------------|
| `ops_state/snapshot` | Single document read/write |
| `settings/catalog_homepage` | Single document read/write |
| `settings/catalog_site` | Single document read/write |
| `catalog_*` collections | Full collection scan or direct doc ID lookup |

---

## Catalog collection scans

These queries load entire collections without `where()` filters:

- `catalog_products`
- `catalog_categories`
- `catalog_brands`
- `catalog_deals`
- `catalog_creators`
- `catalog_guides`
- `catalog_placements`
- `catalog_product_details`
- `catalog_brand_posts`

No composite index required. Performance depends on collection size.

---

## Recommended future indexes

When catalog list endpoints move filtering into Firestore (instead of in-memory filtering in `catalogRouter.ts`), likely indexes will include:

| Collection | Fields | Purpose |
|------------|--------|---------|
| `catalog_products` | `status` ASC, `updatedAt` DESC | Admin product lists |
| `catalog_products` | `brandId` ASC, `status` ASC | Brand-scoped catalogs |
| `catalog_products` | `categoryId` ASC, `status` ASC | Category browsing |
| `catalog_brand_posts` | `brandId` ASC, `publishedAt` DESC | Brand post feeds |

Do not create these until queries are migrated.

---

## Index maintenance checklist

- [ ] `omni_messages` conversation + timestamp
- [ ] `omni_messages` conversation + direction + timestamp
- [ ] Verify `admin_users.email` single-field index exists
- [ ] Monitor Firestore index usage after omnichannel production load
