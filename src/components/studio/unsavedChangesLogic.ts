/**
 * Pure decisions behind the Studio unsaved-changes guard (no React / DOM
 * globals), so they can be unit-tested with a plain `tsx` probe.
 */

/** True when an edit draft actually differs from the saved model (edit-then-revert is clean). */
export function draftDiffers(draft: unknown, saved: unknown): boolean {
  if (draft == null || saved == null) return false;
  return JSON.stringify(draft) !== JSON.stringify(saved);
}

/** The bits of a click and its link that decide whether the guard steps in. */
export type LinkClickFacts = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  /** The anchor's `target` attribute ('' when absent). */
  target: string;
  hasDownload: boolean;
  /** Resolved absolute URL of the anchor (anchor.href). */
  href: string;
};

/**
 * The in-app path (pathname + search + hash) a plain click on a link would
 * navigate to, when the guard should confirm it first — or null when the
 * click should be left alone: modified / non-primary clicks, new-tab and
 * download links, other origins (beforeunload covers those), non-http
 * schemes, and same-page hash jumps.
 */
export function guardedInAppPath(click: LinkClickFacts, current: { origin: string; pathname: string; search: string }): string | null {
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (click.target && click.target !== '_self') return null;
  if (click.hasDownload || !click.href) return null;
  let url: URL;
  try {
    url = new URL(click.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname && url.search === current.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
