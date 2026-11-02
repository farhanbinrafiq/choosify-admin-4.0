import React from 'react';

/**
 * Count shown on a list tab. Tabs that need staff action (requests, claims,
 * suggestions, flags) show a coloured pill while anything is waiting, so pending
 * work stands out instead of sitting unnoticed; other tabs keep the plain "(n)".
 */
export function TabCount({ count, needsAction = false, active = false }: { count: number; needsAction?: boolean; active?: boolean }) {
  if (needsAction && count > 0) {
    return (
      <span
        className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-[1px] text-[10px] font-black leading-[15px]"
        // The selected (red) tab forces near-white text on its children (global light-mode
        // rule), so the selected badge is dark red with white text rather than white on white.
        style={active ? { backgroundColor: '#7F1D1D', color: '#FFFFFF' } : { backgroundColor: '#DC2626', color: '#FFFFFF' }}
        aria-label={`${count} waiting for review`}
        data-testid="tab-action-count"
      >
        {count}
      </span>
    );
  }
  return <> ({count})</>;
}

export default TabCount;
