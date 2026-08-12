/**
 * Stamp platform reference IDs onto entities at create/update when missing.
 * Never overwrites an existing valid assignment.
 */
import { ensureEntityReferenceId } from './referenceIdService';
import type { ReferenceEntityType } from '../../shared/referenceIds/registry';

export async function stampReferenceId<T extends { id?: string }>(
  entityType: ReferenceEntityType,
  entity: T,
  current: string | null | undefined,
  internalId?: string,
): Promise<string | undefined> {
  const id = internalId || entity.id;
  if (!id) return current || undefined;
  try {
    return await ensureEntityReferenceId({
      entityType,
      internalId: id,
      current,
    });
  } catch {
    return current || undefined;
  }
}
