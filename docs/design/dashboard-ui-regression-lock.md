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

## Surfaces covered

Orders, Messages, Products & Inventory, Brands / Seller Management,
Creator Management, Categories, Marketplace Access, Reviews, Warranty, Returns,
Logistics / Shipments, Finance / Payouts / Cashbook, Notifications, Bookings,
Manual Offers, Dashboard, and every other admin dashboard feature.

## Final principle

**Fix the functionality inside the approved UI. Never fix functionality by
sending the user back to the legacy UI.**
