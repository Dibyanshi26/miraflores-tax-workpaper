// Maps return_versions[].lines[] to the firm's budget_hours areas (CLAUDE.md "Area
// pages (map to firm.budget_hours keys)"). The packet doesn't tag lines by area, so this
// is a pragmatic classifier by form/jurisdiction - good enough to organize review, not a
// certified categorization.
import type { ReturnLine } from "../types/packet";

const FORM_AREA: Record<string, string> = {
  SchC: "business",
  SchSE: "business",
  "F4562-C": "business",
  SchE: "rentals_and_sale",
  F4797: "rentals_and_sale",
  F8582: "rentals_and_sale",
  "F4562-E": "rentals_and_sale",
  SchB: "investments_and_digital_assets",
  SchD: "investments_and_digital_assets",
  F8949: "investments_and_digital_assets",
  F8938: "investments_and_digital_assets",
  F7203: "pass_throughs_and_basis",
  F8606: "pass_throughs_and_basis",
  SchA: "deductions_and_credits",
  F2441: "deductions_and_credits",
  F8863: "deductions_and_credits",
  F8283: "deductions_and_credits",
  F8995: "deductions_and_credits",
  F8995A: "deductions_and_credits",
  F8812: "deductions_and_credits",
  F8889: "deductions_and_credits",
  F8959: "wages_and_stock_compensation",
  SchCA540NR: "california",
  F540NR: "california",
  ScheduleS: "california",
  FTB3885A: "california",
  FTB5805: "california",
  F6251: "deductions_and_credits",
  F2210: "filing",
  F8960: "deductions_and_credits",
  F8867: "deductions_and_credits",
};

export function areaForLine(l: ReturnLine): string {
  if (l.form === "F1040" && (l.line === "1a" || l.line === "1b" || l.line === "1c" || l.line === "1d")) return "wages_and_stock_compensation";
  if (FORM_AREA[l.form]) return FORM_AREA[l.form];
  if (l.jurisdiction === "california") return "california";
  return "intake_and_engagement"; // F1040/Sch1/Sch2/Sch3 summary + routing lines
}

export const AREA_LABELS: Record<string, string> = {
  intake_and_engagement: "Intake & engagement",
  wages_and_stock_compensation: "Wages & stock compensation",
  investments_and_digital_assets: "Investments & digital assets",
  business: "Business",
  rentals_and_sale: "Rentals & sale",
  pass_throughs_and_basis: "Pass-throughs & basis",
  deductions_and_credits: "Deductions & credits",
  california: "California",
  filing: "Filing",
};
