export interface ProposedAdjustment {
  category: string; // key into ReturnVersion.tax_effect_rates, or "what_if" / "none"
  amount: number;    // signed delta to the underlying line (sign matches the rate's convention)
  caSourceOnly?: boolean;
  lineKey?: string;  // which v3 line this primarily affects
  label: string;
}

export type CheckArea =
  | "intake_and_engagement" | "wages_and_stock_compensation" | "investments_and_digital_assets"
  | "business" | "rentals_and_sale" | "pass_throughs_and_basis" | "deductions_and_credits"
  | "california" | "partner_review" | "filing";

export interface CheckResult {
  code: string;
  title: string;
  area: CheckArea;
  status: "fail" | "pass";
  expected: string;
  actual: string;
  evidence: string[]; // reference strings resolvable via resolveRef
  proposedAdjustments: ProposedAdjustment[];
  explanation: string;
  severity: "blocking" | "warning" | "info";
  whatIfId?: string; // when the tax effect comes from a precomputed what_if alternative instead of a category rate
  // A precomputed {federal, california} total, for checks where federal and California
  // effects are driven by genuinely different bases (a capped-SALT interaction, a
  // dollar-for-dollar payment correction) and can't be modeled as one category-rate
  // multiply. Takes priority over proposedAdjustments/whatIfId when present.
  manualEffect?: { federal: number; california: number };
  // What the effect number actually moves: "tax" (AGI/taxable income/total tax - the
  // default, via a tax-effect-rate multiply or a what_if/manual recomputation) or
  // "payments" (a dollar-for-dollar correction to estimated/withheld payments actually
  // made - total tax is untouched, only the Payments line and therefore balance due move).
  effectKind?: "tax" | "payments";
  summary: string; // one complete sentence, for ranked open-item lists (e.g. Home)
  needsClientInput?: boolean; // shows an "Ask client" action and is why one of the four seeded questions exists
}
