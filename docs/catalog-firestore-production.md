# Firestore production setup for shared admin + website catalog

## 1. Create a Firebase service account key

1. Open [Firebase Console](https://console.firebase.google.com/) for project `intense-influence-9sjh2`
2. Go to **Project settings** → **Service accounts**
3. Click **Generate new private key**
4. Save the downloaded JSON file securely

## 2. Add Vercel environment variables (admin project)

In the **admindashboardchoosify** Vercel project:

| Variable | Value |
|----------|-------|
| `CATALOG_USE_FIRESTORE` | `true` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Paste the **entire** service account JSON as one line |
| `FIRESTORE_DATABASE_ID` | `ai-studio-c2303f92-945b-405b-9b0b-230b63fef478` |

Redeploy after saving.

## 3. Firestore security rules (recommended starter)

Use rules that allow server (Admin SDK bypasses rules) and restrict client writes:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /catalog_{collection}/{docId} {
      allow read: if true;
      allow write: if false;
    }
    match /settings/{docId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Admin/API writes use Firebase Admin SDK and are not blocked by these rules.

## 4. Seed data

On first request after deploy, the API auto-seeds default catalog data if collections are empty.

You can also run locally:

```bash
CATALOG_USE_FIRESTORE=true FIREBASE_SERVICE_ACCOUNT_JSON='...' npm run seed:catalog
```

## 5. Verify persistence mode

```bash
curl https://dashboard.choosify.bd/api/health
```

Expected:

```json
{
  "ok": true,
  "service": "choosify-catalog-api",
  "persistence": "firestore-admin"
}
```

If `persistence` is `memory`, Firestore credentials are missing or invalid.

## 6. Test admin → website flow

1. Edit a product in `dashboard.choosify.bd` admin
2. Confirm API returns the change:
   `curl https://dashboard.choosify.bd/api/v1/catalog/products`
3. Refresh `www.choosify.bd` (or refocus the tab) to see the update

## Website env (already required)

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://dashboard.choosify.bd/api/v1` |
