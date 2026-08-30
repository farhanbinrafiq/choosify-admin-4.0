# Dashboard UI Regression Lock

**Status: PERMANENT. Applies to every future change to the admin dashboard
(`dashboard.choosify.bd` / `src/pages/admin/**`, `src/App.tsx` routing,
`src/cms-mirror/**`, role navigation, profile shells).**

## The two contracts

| Contract | Source of truth |
|---|---|
| **Presentation** | The approved "Gen-2" Choosify dashboard UI. Its canonical form is the local reference `design-reference/Choosify Admin CMS (standalone).html` (git-ignored, never deployed). A partial, older mirror of it is committed at `public/cms-mirror/app.html`. |
| **Functionality** | The current canonical production code — real APIs, services, auth, RBAC, Operations order engine, server-side inventory reservation/release/consumption, marketplace-access lifecycle, messaging, bookings, manual offers, checkout idempotency, notifications, and every P0/P1 security fix from Sprints 8–13. |

**Every change must preserve BOTH.** The correct state of any dashboard surface
is: *Gen-2 approved presentation* + *current canonical functional layer* — never
one without the other.

## Background: how the regression happened (so it is not repeated)

Three UI generations exist for the admin surfaces:

- **Gen 1** — original legacy React in `src/pages/admin/*.tsx` (mostly project
  init, June 2026). Bespoke per-page styling; originally localStorage/mock data.
- **Gen 2** — the approved "Studio" design. It only ever rendered at run time via
  `CmsMirrorHost` (the `/admin/*` catch-all iframe), which was **mock-backed**.
- **Gen 3** — generic light screens composed ad hoc from `components/ui`
  (introduced briefly in Sprint 13 and then reverted/corrected).

Sprint 11 (`0d62ed2`, `b8cb395`, `0e02449`, `8e335e6`, batch-wiring
`f1e2cbb` / `48382da` / `6250eaa`) fixed functionality by adding explicit
`<Route path="/admin/X">` entries **ahead of the `/admin/*` catch-all**, pointing
at the **Gen-1** components and rewiring those to the canonical APIs. The explicit
route now wins, so the approved Gen-2 presentation was silently replaced by Gen-1
styling on those paths. This is the regression this document exists to prevent
from recurring.

Full per-surface lineage: see the UI Regression Lineage Matrix (Sprint 13 audit).

## Hard rules

### 1. No fix may reintroduce a non-approved presentation

A functional, security, backend, routing, or feature fix must NOT:

- route to a Gen-1 legacy component,
- resurrect an orphaned legacy screen,
- bypass the approved Gen-2 surface,
- replace a Gen-2 screen with a generic/invented design,
- reintroduce CMS-mirror mock/prototype behaviour, localStorage "operational
  truth", or fabricated analytics/data,
- switch back to the dead Commerce engine or any superseded backend path.

### 2. Fix the functional layer *under* the approved UI

If the approved UI lacks the functionality a fix needs, **add the real
functionality into the approved/current UI.** Do not solve it by routing users to
a legacy page that already happens to contain the feature.

If safe integration into the approved UI is not possible, **STOP and report the
conflict before changing routing.**

### 3. Routing changes are HIGH-RISK UI-regression changes

Any commit/PR touching `src/App.tsx`, route gates, catch-alls, `CmsMirrorHost`,
profile shells, or role navigation MUST document, in the commit body:

```
route before / route after
component before / component after
visual generation before/after  (Gen-1 / Gen-2 / Gen-3 / CMS-mirror)
why this does not regress the approved UI
```

A route must never silently move **Gen-2 approved → Gen-1 legacy** or
**Gen-2 approved → invented Gen-3** merely to gain functionality.

### 4. Reference file usage

`design-reference/Choosify Admin CMS (standalone).html` supplies **presentation
only**. Never port its mock business logic, prototype handlers, fake analytics, or
fields that have no production model (e.g. category photo, featured brand,
email/Slack alert preferences). It is git-ignored and must not be deployed.

`components/ui` primitives may be used internally, but their default appearance is
**not** the design authority — the reference layout is.

### 5. Pre-deploy UI regression check (every dashboard deploy)

1. `git diff` of `src/App.tsx` route changes.
2. Route-generation check for every changed surface (which component renders now).
3. Verify the approved component still renders for the changed routes.
4. Functional regression of the affected journey.
5. Production smoke after deploy.

If a changed route resolves to a known Gen-1 component, the deploy is **FAILED**
unless that route is an explicitly documented temporary exception approved by the
product owner.

### 6. Mandatory local-preview workflow for every UI restoration

No dashboard UI restoration is committed or deployed before local visual
approval, whenever the page can reasonably be previewed locally. The required
sequence for each Sprint 13 surface (Categories, Orders, Messages, Finance,
Logistics, …) is:

```
local restoration → local visual approval → local functional regression
  → commit / push → production deploy → production regression
```

- **local restoration** — apply the presentation-only change in the local clone
  (`D:\Choosify Projects\choosify-admin-4.0`); do not touch APIs, contexts, auth,
  routes, handlers, or business logic.
- **local visual approval** — run the repo's own dev command
  (`npm run dev`, served on `http://localhost:3001`) and compare the surface
  side-by-side against `design-reference/Choosify Admin CMS (standalone).html`.
  The product owner signs off on the visuals before anything is committed.
- **local functional regression** — exercise the surface's real API/handler
  contract against the local server with synthetic (`ZZZ_PROBE_`) data only, then
  clean the fixtures up and confirm the data returned to baseline.
- **commit / push** — presentation-only diff, functional layer unchanged.
- **production deploy** — normal `deploy-admin.sh` dry-run then real.
- **production regression** — non-destructive (read-only) checks on the live
  surface after deploy.

One surface per commit; the full pipeline runs for each.

### 7. Section-level inline editing is the dashboard interaction standard

**Ordinary editing happens in place, one section at a time — inside the section
of the page where that data is already displayed. Not in a right-side slide-in
drawer, an edit popup, an edit modal, a duplicate edit page, or a page-wide
"edit everything" mode.** The user stays spatially anchored to the information
they are changing.

**Interaction model — per section**

```
Section header + [ Edit ]        ← default: the section renders its read state
  ↓ click Edit
Section header
[ inline fields / uploader / controls, in the same positions as the values ]
[ Cancel ]  [ Save Changes ]     ← inside the section
  ↓ Save Changes
persists THAT section through the existing canonical API/handlers; section
returns to read state.  Cancel restores THAT section's persisted values only.
```

- Text / select / numeric controls occupy the same visual regions as the values
  they replace. Media / gallery editing (add / replace / reorder / drag-drop /
  upload) renders **inside the media region / its own container**, never in a
  drawer, and uploaded items stay inside that container.
- **At most one section is in edit mode at a time.** If another section's Edit is
  clicked while the current one has unsaved changes, do not silently discard —
  keep the current section active and prompt to Save or Cancel first (or show a
  small unsaved-changes confirmation).
- A brand-new entity may use a single "create" form (all sections open at once)
  that saves via the canonical create endpoint; after it exists, editing is
  section-by-section.

**The public storefront is the structural map for the dashboard editor.** The
editor does not reproduce the public page, but its editable sections must
correspond to the sections/content that actually appear on that entity's
storefront. Each public-facing entity has a different composition — **do not
build one generic editor and reuse it across Products, Brands, Creators,
Recommendations/Guides, Sellers.** Product ≠ Brand ≠ Creator ≠ Recommendation ≠
Seller; the interaction pattern is shared, the section contents are not.

**Visible on storefront ≠ editable by the storefront owner.** For every section,
classify its authority before building an editor for it:

| Authority | Treatment in the dashboard editor |
|---|---|
| Owner-editable (seller / creator / admin), canonical model backs it | inline section editor |
| System-calculated (ratings, trust score, order/view stats, conversion) | read-only |
| User-generated (customer reviews, Q&A) | read-only, linked to its moderation/management surface |
| Relational data managed elsewhere (a brand's products/deals, a creator's guides/videos, recommended products) | read-only summary + link to the canonical management surface — **not** free-text fields here |
| Unsupported / mock reference content (no production model) | honestly empty/disabled, or omitted |

Only the first row becomes an inline editor. This is what stops calculated
metrics, reviews and generated content from becoming fake CMS fields.

**Modals / dialogs remain correct only for:** destructive or delete confirmation,
irreversible actions, security-sensitive confirmation, and very small
single-purpose actions where an inline form makes no sense.

**This is a presentation / interaction-architecture rule, not licence to change
backend behaviour.** Preserve the existing APIs, authorization / RBAC,
ownership / scoping, validation, server-side business rules, persistence,
idempotency, inventory rules, and every security fix. Reuse the existing
handlers / API calls; only *where controls render* and *how edit state is
presented* changes. If the approved standalone uses a drawer for ordinary
editing, keep its visual language and drop the drawer.

Applies across every editable dashboard surface. **Do not retrofit all of them in
one change.** As each Sprint 13 surface reaches its restoration, audit its edit
interaction, map its sections to its real storefront, classify each section's
authority, and build the section-level inline editors for the owner-editable
ones. New surfaces are built this way from the start.

### 8. Product Detail ↔ Product Studio synchronization checklist

Product Studio (`src/pages/admin/ProductEditStudio.tsx`) is a thin functional
shell around a **hand-maintained** storefront-parity presentation
(`src/components/product-detail/ProductDetailPresentation.tsx`). There is no
shared package or monorepo in Sprint 13 — the admin parity component is a
deliberate re-implementation of the real Choosify-Web Product Detail composition
(`Choosify-Web/src/pages/ProductDetailPage.tsx` + `ProductMediaGallery` /
`DetailSliverMediaGallery` + the section components). When the **real**
Choosify-Web Product Detail page changes structurally, walk this list:

- **Section set / order.** If Choosify-Web adds, removes, renames or reorders a
  Product Detail section, mirror it in `ProductDetailPresentation` (`SECTION_NAV`
  + the section blocks) and, if it is owner-editable, add a `renderEditor(key)`
  case + `SECTION_LABELS` entry in `ProductEditStudio`.
- **Authority classification.** Re-confirm each section against the §7 table.
  Editable → wrapped in `<SectionShell k=… />` with an inline editor. Preview-only
  (ratings/analytics, Public Reviews, Creator Reviews/content, related/suggested
  Brand, comparison matrices, trust/system info) → plain markup, **no Edit pill,
  never fabricated stats**; real data where available, honest empty state
  otherwise.
- **Buyer commerce controls.** Add to Cart / Wishlist / Compare / Message Seller /
  quantity / checkout must render for parity but stay **disabled and
  non-interactive** in `mode="studio"` / any non-`public` mode (`previewOnly`
  flag + `disabled`). A seller must never execute a buyer action from Studio.
- **Canonical fields.** New product fields consumed by the storefront must be:
  added to `CatalogProduct` (`src/types/catalog.ts`) + `productSchema` +
  `normalizeProductInput` (`server/catalogContract.ts`); round-tripped through
  `productEditorModel.ts` (`ProductEditorModel`, `mapCatalogProductToEditor`,
  `editorModelToProductPatch` / `editorModelToDetailPayload`); and mirrored in
  `Choosify-Web/src/types/catalog.ts` + wherever Choosify-Web maps catalog
  products into its view model (`context/GlobalStateContext.tsx` `apiProducts`).
- **Media.** `product.image` = primary = gallery[0]; `product.gallery` = ordered
  list; `product.videoUrl` = the single canonical storefront video (YouTube URL,
  direct HTTPS `.mp4/.webm/.mov`, or an app `/media/products/*.mp4`). The Studio
  media section is the approved Photos + Video editor on Edit and a
  storefront-style carousel preview otherwise. Both repos' galleries consume
  `videoUrl` (admin: `classifyProductVideo` in `ProductDetailPresentation`;
  web: `productVideoMediaItem` in `choosifyMediaAdapters.ts`). **No product —
  real or mock — is ever given a fabricated/demo video** when its gallery is
  empty.
- **Functional engine is off-limits.** Model load, `editingId` / `sectionDraft` /
  `dirty`, `saveSection` (canonical `createProduct` / `updateProduct` +
  `upsertProductDetail`, current lifecycle status kept — never force-published),
  `handlePublish`, ownership / RBAC / Marketplace-Access / inventory authority,
  and unsaved-change protection stay exactly as they are. Parity work only
  changes *what is rendered* and *where controls appear*.
- **Regression.** After any parity change, run the section-level Studio probe
  (section renders, one-editor-at-a-time, dirty-switch block, focus retention,
  buyer controls disabled, preview-only sections have no Edit) and the product
  video contract (API persist + storefront carousel renders as video), per repo.

## Surfaces covered

Orders, Messages, Products & Inventory, Brands / Seller Management,
Creator Management, Categories, Marketplace Access, Reviews, Warranty, Returns,
Logistics / Shipments, Finance / Payouts / Cashbook, Notifications, Bookings,
Manual Offers, Dashboard, and every other admin dashboard feature.

## Final principle

**Fix the functionality inside the approved UI. Never fix functionality by
sending the user back to the legacy UI.**
