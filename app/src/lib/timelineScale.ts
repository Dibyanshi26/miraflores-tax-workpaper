// The as-of slider's time range, shared between the Layout component and tests so both
// compute the same percentage <-> date mapping.
export const TIMELINE_START = Date.parse("2026-01-01T00:00:00Z");
export const TIMELINE_END = Date.parse("2028-02-19T23:59:59Z"); // through the Letter 566 response window

export function pctForDate(iso: string): number {
  const t = Date.parse(iso);
  return ((t - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100;
}

export function dateForPct(p: number): string {
  const t = TIMELINE_START + (p / 100) * (TIMELINE_END - TIMELINE_START);
  return new Date(t).toISOString();
}
