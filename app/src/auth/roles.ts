// Enforcement of the firm's starter standards (CLAUDE.md "Roles" + packet
// firm.starter_standards.rules). Firm admins can edit these at runtime via
// standards_change events; callers should merge derived.standardsOverrides on top
// of these defaults (see useStandards() in components/useStandards.ts).
import type { RoleId } from "../types/domain";

export const CLEARANCE_BY_ROLE: Record<RoleId, boolean> = {
  preparer: true,
  reviewer: true,
  partner: true,
  preparer_no_clearance: false,
  firm_admin: true,
  quality_reviewer: true,
  client: false,
};

export const DEFAULT_STANDARDS = {
  partnerSignOffThreshold: 1000, // federal or CA tax effect over this needs partner sign-off
  dueDiligenceCredits: ["CTC", "ODC", "AOTC"],
  variance: { comparedTo: "prior_year", flagPercent: 10, flagAmount: 1000 },
};

export function canReview(reviewerId: string, preparedByActorId: string | undefined): boolean {
  if (!preparedByActorId) return true;
  return reviewerId !== preparedByActorId;
}

export function needsPartnerSignOff(federalEffect: number, californiaEffect: number, threshold = DEFAULT_STANDARDS.partnerSignOffThreshold): boolean {
  return Math.abs(federalEffect) > threshold || Math.abs(californiaEffect) > threshold;
}

// Fields considered sensitive per the starter standards: SSNs, bank/account numbers, IP PINs.
const SENSITIVE_FIELD_PATTERNS = [/ssn/i, /ip_pin/i, /account/i, /routing/i, /ein/i];

export function isSensitiveField(fieldOrLabel: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((re) => re.test(fieldOrLabel));
}

export function isSensitiveValueType(valueType: string): boolean {
  return valueType === "ssn" || valueType === "account_number";
}

export function maskSsn(ssn: string): string {
  const digits = ssn.replace(/[^0-9]/g, "");
  if (digits.length < 4) return "***-**-****";
  return `***-**-${digits.slice(-4)}`;
}

export function maskAccountNumber(value: string): string {
  const s = String(value);
  if (s.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export function maskGeneric(value: string): string {
  return "•".repeat(Math.min(8, Math.max(4, String(value).length)));
}

export function maskValue(value: string, valueType: string, fieldOrLabel: string): string {
  if (valueType === "ssn") return maskSsn(value);
  if (valueType === "account_number" || /account|routing/i.test(fieldOrLabel)) return maskAccountNumber(value);
  return maskGeneric(value);
}
