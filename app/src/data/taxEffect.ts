import type { ReturnVersion } from "../types/packet";
import type { WorkpaperEvent } from "../types/domain";

export interface TaxEffect {
  federal: number;
  california: number;
}

// Tax effect = amount x the v3 rate for the category. For California-source-only
// items (fully CA-source, e.g. a CA wage split), use ca_source_income instead of
// the proportional-residency category rate. See CLAUDE.md "Tax effect of changes".
export function computeTaxEffect(
  version: ReturnVersion,
  amount: number,
  category: string,
  opts: { caSourceOnly?: boolean } = {}
): TaxEffect {
  const rate = version.tax_effect_rates[category];
  if (!rate) return { federal: 0, california: 0 };
  const federal = amount * rate.federal_per_dollar;
  let california: number;
  if (opts.caSourceOnly) {
    const caRate = version.tax_effect_rates["ca_source_income"];
    california = caRate ? amount * caRate.california_per_dollar : amount * rate.california_per_dollar;
  } else {
    california = amount * rate.california_per_dollar;
  }
  return { federal, california };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// `tax` moves AGI / taxable income / total tax. `payments` is a dollar-for-dollar
// correction to payments actually made - it never touches total tax, only the Payments
// line (and therefore balance due = total tax - payments).
export interface JurisdictionDelta {
  tax: number;
  payments: number;
}

export interface AcceptedAdjustmentSummary {
  federal: JurisdictionDelta;
  california: JurisdictionDelta;
  items: { event: WorkpaperEvent; federal: number; california: number; kind: "tax" | "payments" }[];
}

// Workpaper return = v3 totals + accepted adjustments (CLAUDE.md "Tax effect of changes").
// Sums every accepted `adjustment` event's effect, whether it's rate-based (category maps
// to tax_effect_rates), a precomputed what_if alternative, or a manual recomputation -
// and routes it to the `tax` or `payments` bucket based on what it actually moves.
export function aggregateAcceptedAdjustments(version: ReturnVersion, events: WorkpaperEvent[]): AcceptedAdjustmentSummary {
  const federal: JurisdictionDelta = { tax: 0, payments: 0 };
  const california: JurisdictionDelta = { tax: 0, payments: 0 };
  const items: AcceptedAdjustmentSummary["items"] = [];
  for (const e of events) {
    if (e.type !== "adjustment" || e.payload.status !== "accepted") continue;
    let fed = 0, ca = 0;
    let kind: "tax" | "payments" = "tax";
    if (e.payload.category === "what_if" || e.payload.category === "manual") {
      fed = e.payload.tax_effect_federal ?? 0;
      ca = e.payload.tax_effect_california ?? 0;
    } else if (e.payload.category === "manual_payments") {
      fed = e.payload.tax_effect_federal ?? 0;
      ca = e.payload.tax_effect_california ?? 0;
      kind = "payments";
    } else if (e.payload.category === "none" || !e.payload.category) {
      fed = 0; ca = 0;
    } else {
      const caSourceOnly = Boolean((e.payload.extra as { caSourceOnly?: boolean } | undefined)?.caSourceOnly);
      const te = computeTaxEffect(version, e.payload.amount ?? 0, e.payload.category, { caSourceOnly });
      fed = te.federal; ca = te.california;
    }
    if (kind === "tax") {
      federal.tax += fed; california.tax += ca;
    } else {
      federal.payments += fed; california.payments += ca;
    }
    items.push({ event: e, federal: fed, california: ca, kind });
  }
  return { federal, california, items };
}
