import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  showRowNumbers?: boolean;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  selectedIds,
  onSelectedIdsChange,
  showRowNumbers = true,
  emptyMessage = 'No records found.',
  isLoading = false,
  loadingMessage = 'Loading...',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const selectable = !!selectedIds && !!onSelectedIdsChange;

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const allSelected = selectable && sortedRows.length > 0 && sortedRows.every((r) => selectedIds!.has(getRowId(r)));

  const toggleAll = (checked: boolean) => {
    if (!selectable) return;
    const next = new Set(selectedIds);
    sortedRows.forEach((r) => {
      const id = getRowId(r);
      if (checked) next.add(id);
      else next.delete(id);
    });
    onSelectedIdsChange!(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    if (!selectable) return;
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedIdsChange!(next);
  };

  return (
    <table className="w-full text-left">
      <thead className="bg-slate-50 border-b border-app-border">
        <tr>
          {selectable && (
            <th className="p-6 w-12 text-center">
              <input
                type="checkbox"
                className="rounded border-app-border bg-white/5 text-app-accent focus:ring-app-accent cursor-pointer"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
            </th>
          )}
          {showRowNumbers && (
            <th className="p-6 w-12 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em] text-center">#</th>
          )}
          {columns.map((col) => (
            <th
              key={col.key}
              className={`p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em] ${
                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
              } ${col.className || ''} ${col.sortValue ? 'cursor-pointer select-none hover:text-app-accent' : ''}`}
              onClick={() => handleSort(col)}
            >
              <span className="inline-flex items-center gap-1">
                {col.header}
                {col.sortValue &&
                  (sortKey === col.key ? (
                    sortDir === 'asc' ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 opacity-40" />
                  ))}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-app-border">
        {isLoading ? (
          <tr>
            <td colSpan={columns.length + (selectable ? 1 : 0) + (showRowNumbers ? 1 : 0)} className="p-10 text-center text-app-text-secondary text-sm">
              {loadingMessage}
            </td>
          </tr>
        ) : sortedRows.length === 0 ? (
          <tr>
            <td colSpan={columns.length + (selectable ? 1 : 0) + (showRowNumbers ? 1 : 0)} className="p-10 text-center text-app-text-secondary text-sm">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          sortedRows.map((row, idx) => {
            const id = getRowId(row);
            return (
              <tr key={id} className="group hover:bg-slate-50/80 transition-colors">
                {selectable && (
                  <td className="p-6 w-12 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-app-border bg-white/5 text-app-accent focus:ring-app-accent cursor-pointer"
                      checked={selectedIds!.has(id)}
                      onChange={(e) => toggleOne(id, e.target.checked)}
                    />
                  </td>
                )}
                {showRowNumbers && (
                  <td className="p-6 w-12 text-center text-[11px] font-bold text-app-text-secondary">{idx + 1}</td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-6 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                  >
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
