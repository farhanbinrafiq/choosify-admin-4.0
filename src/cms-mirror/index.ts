/**
 * CMS Mirror — 1:1 Choosify Admin CMS from standalone HTML prototype.
 *
 * - `public/cms-mirror/app.html` — full prototype (shell + all screens + mock data)
 * - `CmsMirrorHost` — fullscreen iframe host wired to `/admin/*` routes
 * - `nav.ts` / `mockData.ts` — extracted nav + datasets for future React ports
 * - Rebuild: `npm run build:cms-mirror` (needs the Downloads HTML + `_reference` extract)
 */
export { CmsMirrorHost } from './CmsMirrorHost';
export * from './nav';
export * from './mockData';
