/**
 * Safe money helpers — integer minor units (paisa) to avoid float drift.
 * Amounts in domain records remain major units (BDT) with 2dp.
 */

export function toMinor(major: number): number {
  return Math.round(Number(major) * 100);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

export function addMajor(a: number, b: number): number {
  return fromMinor(toMinor(a) + toMinor(b));
}

export function subMajor(a: number, b: number): number {
  return fromMinor(toMinor(a) - toMinor(b));
}

/** Percentage of major amount, rounded to 2dp via minor units. */
export function percentOfMajor(major: number, percent: number): number {
  const minor = toMinor(major);
  return fromMinor(Math.round((minor * percent) / 100));
}

export function amountsEqual(a: number, b: number, toleranceMinor = 0): boolean {
  return Math.abs(toMinor(a) - toMinor(b)) <= toleranceMinor;
}
