import type { Request, Response } from 'express';

/**
 * Optimistic concurrency for Studio saves (Phase C).
 *
 * A Studio sends the `updatedAt` of the record it loaded in this header. If the
 * stored record has changed since, the save is refused with 409 instead of
 * silently overwriting newer data. Requests WITHOUT the header behave exactly as
 * before (backward compatible: other callers and older clients are unaffected).
 */
export const EXPECTED_UPDATED_AT_HEADER = 'x-expected-updated-at';
/** Product saves also guard the product's detail record (one save writes both). */
export const EXPECTED_DETAIL_UPDATED_AT_HEADER = 'x-expected-detail-updated-at';

export const STALE_WRITE_CODE = 'STALE_WRITE';

/**
 * Returns true (and has already replied 409) when the request carries an
 * expected version that no longer matches `current.updatedAt`. Call it after
 * the handler's own 404 / authorization checks so those keep their precedence.
 */
export function rejectStaleWrite(
  req: Request,
  res: Response,
  current: { updatedAt?: string } | null | undefined,
  what: string,
  header: string = EXPECTED_UPDATED_AT_HEADER,
): boolean {
  const expected = String(req.get(header) ?? '').trim();
  if (!expected || !current?.updatedAt) return false;
  if (expected === current.updatedAt) return false;
  res.status(409).json({
    error: `This ${what} was changed somewhere else after you opened it, so your changes were not saved.`,
    code: STALE_WRITE_CODE,
    currentUpdatedAt: current.updatedAt,
  });
  return true;
}
