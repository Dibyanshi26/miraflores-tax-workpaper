// Shared formatting for return-line values, used anywhere a v1/v2/v3/prior-year value is
// displayed (currently the trace drawer) - one function, so "format as currency,
// consistently" can't drift between call sites.
import { fmtMoney, fmtMoneyCents } from "./index";

// Ratios/apportionment percentages in this packet (F8606.10, F540NR.34/.36, ...) are
// always a non-zero fraction strictly between -1 and 1 - a dollar amount essentially never
// lands there, so this is a safe, generic way to tell the two apart without a per-line type tag.
export function isRatioLike(value: unknown): value is number {
  return typeof value === "number" && value !== 0 && Math.abs(value) < 1;
}

export function fmtLineValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (isRatioLike(value)) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 });
    // Most lines are whole dollars; Form 8949 lots and a few others carry real cents -
    // show cents only when the value actually has them, so whole-dollar lines stay clean.
    return Number.isInteger(value) ? fmtMoney(value) : fmtMoneyCents(value);
  }
  return String(value);
}

export interface VarianceResult {
  flagged: boolean;
  pctChange: number | null;
  amountChange: number | null;
}

// Mirrors firm.starter_standards.variance_review: flag when the change from the prior
// year is over both a percentage and a dollar threshold.
export function computeVariance(current: unknown, prior: unknown, flagPercent: number, flagAmount: number): VarianceResult {
  if (typeof current !== "number" || typeof prior !== "number" || prior === 0) {
    return { flagged: false, pctChange: null, amountChange: null };
  }
  const amountChange = current - prior;
  const pctChange = (Math.abs(amountChange) / Math.abs(prior)) * 100;
  const flagged = pctChange > flagPercent && Math.abs(amountChange) > flagAmount;
  return { flagged, pctChange, amountChange };
}
