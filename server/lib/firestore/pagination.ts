export type CursorPaginationOptions = {
  limit?: number;
  cursor?: string;
};

export type CursorPageMeta = {
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
};

export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

export function buildCursorPageMeta<T extends { updatedAt?: string; timestamp?: string; id?: string }>(
  items: T[],
  limit: number,
  cursorField: 'updatedAt' | 'timestamp' | 'id' = 'updatedAt',
): CursorPageMeta {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursorValue = lastItem?.[cursorField];

  return {
    limit,
    hasMore,
    ...(hasMore && nextCursorValue ? { nextCursor: encodeCursor(String(nextCursorValue)) } : {}),
  };
}
