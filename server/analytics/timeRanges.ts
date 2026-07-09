import type { TimeRange, TimeRangePreset } from './analyticsTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function resolveTimeRange(
  presetInput: string | undefined,
  customFrom?: string,
  customTo?: string,
): TimeRange {
  const now = new Date();
  const preset: TimeRangePreset =
    presetInput === 'today' ||
    presetInput === '7d' ||
    presetInput === '30d' ||
    presetInput === '90d' ||
    presetInput === '12m' ||
    presetInput === 'custom'
      ? presetInput
      : '7d';

  if (preset === 'custom') {
    const from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * DAY_MS);
    const to = customTo ? new Date(customTo) : now;
    return {
      preset,
      from: Number.isNaN(from.getTime()) ? new Date(now.getTime() - 7 * DAY_MS).toISOString() : from.toISOString(),
      to: Number.isNaN(to.getTime()) ? now.toISOString() : to.toISOString(),
    };
  }

  if (preset === 'today') {
    return { preset, from: startOfToday(now).toISOString(), to: now.toISOString() };
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 365;
  return {
    preset,
    from: new Date(now.getTime() - days * DAY_MS).toISOString(),
    to: now.toISOString(),
  };
}

export function isWithinRange(timestamp: string, range: TimeRange): boolean {
  const time = new Date(timestamp).getTime();
  return time >= new Date(range.from).getTime() && time <= new Date(range.to).getTime();
}
