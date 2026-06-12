# Security Specification for Choosify

## 1. Data Invariants
- A `Product` must have a valid `sellerId` and `brandId`.
- A `Recommendation` must belong to a verified `Creator`.
- A `Review` rating must be between 1 and 5.
- Identity fields (`ownerId`, `userId`, `creatorId`) are immutable after creation.
- `status` transitions are guarded (e.g., only admins can set `LIVE` or `APPROVED`).

## 2. The "Dirty Dozen" Payloads (Expected to Fail)

1. **Identity Spoofing**: Creating a user profile with someone else's UID.
2. **Privilege Escalation**: Setting `role: 'SUPER_ADMIN'` in a new user payload.
3. **Ghost Field Injection**: Adding `isVerified: true` to a seller application.
4. **State Shortcutting**: Creating a product with `status: 'LIVE'` directly (must be `PENDING`).
5. **ID Poisoning**: Injecting a 2KB string as a product ID.
6. **Relational Sync Break**: Creating a `Review` for a `Product` that doesn't exist.
7. **Temporal Fraud**: Providing a client-side `createdAt` timestamp from 2030.
8. **Invalid Body**: Posting a `Review` with a 1MB comment string.
9. **Role Bypass**: A standard `USER` attempting to `CREATE` a `Deal`.
10. **Shadow Update**: Updating a product's price while slipping in a `status` change.
11. **Negative Rating**: Review with `rating: 0`.
12. **PII Breach**: A guest attempting to read a user's private document.

## 3. Test Runner Invariant
The `firestore.rules` must reject all the above.

# Firestore Rules Blueprint

- `isValidId(id)`: Enforces regex and size.
- `isValidUser(data)`: Enforces schema and self-ownership.
- `isValidProduct(data)`: Enforces schema and pending status on creation.
- `isAdmin()`: Look up `/users/$(request.auth.uid)` role.
