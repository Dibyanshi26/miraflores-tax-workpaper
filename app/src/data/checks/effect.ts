// Shared "what's the dollar effect of this check" logic, used by both the Checks view
// and Home's ranked open-items list so the two never compute it differently.
import type { PacketIndex } from "../index";
import type { DerivedState } from "../../store/fold";
import { latestSignOffStatus } from "../../store/fold";
import { needsPartnerSignOff, DEFAULT_STANDARDS } from "../../auth/roles";
import { computeTaxEffect, type TaxEffect } from "../taxEffect";
import type { EventPayload, TargetRef } from "../../types/domain";
import type { CheckResult } from "./types";

export function computeCheckEffect(idx: PacketIndex, check: CheckResult): TaxEffect {
  if (check.manualEffect) return check.manualEffect;
  if (check.whatIfId) {
    const alt = idx.packet.what_if.alternatives.find((a) => a.id === check.whatIfId);
    return alt ? { federal: alt.federal.total_tax_change, california: alt.california.total_tax_change } : { federal: 0, california: 0 };
  }
  return check.proposedAdjustments.reduce(
    (acc, adj) => {
      const te = computeTaxEffect(idx.latestVersion, adj.amount, adj.category, { caSourceOnly: adj.caSourceOnly });
      return { federal: acc.federal + te.federal, california: acc.california + te.california };
    },
    { federal: 0, california: 0 }
  );
}

export type CheckDecision = "pending" | "accepted" | "rejected";

// A check's target id convention, shared by Checks.tsx's accept/reject handlers.
export function checkTargetId(check: CheckResult): string {
  return `check:${check.code}`;
}

export function checkDecision(derived: DerivedState, check: CheckResult): CheckDecision {
  const events = derived.byTarget.get(checkTargetId(check)) ?? [];
  const decisions = events.filter((e) => e.type === "adjustment");
  const last = decisions[decisions.length - 1];
  if (!last || last.payload.status === "proposed" || !last.payload.status) return "pending";
  return last.payload.status === "accepted" ? "accepted" : "rejected";
}

// How much currently-accepted Schedule C adjustments have moved net profit - the SEP
// limit check recomputes live against this, so accepting the 1099-K/mileage/utilities
// fixes visibly tightens the SEP excess without SEP-LIMIT's own (pending) adjustment
// counting toward itself.
export function computeLiveSchCProfitDelta(derived: DerivedState): number {
  let delta = 0;
  for (const e of derived.activeEvents) {
    if (e.type === "adjustment" && e.payload.category === "schc_profit" && e.payload.status === "accepted" && e.target.kind === "check" && e.target.id !== "check:SEP-LIMIT") {
      delta += e.payload.amount ?? 0;
    }
  }
  return delta;
}

// A short, editable starting point for "why" when a preparer accepts an adjustment - the
// check's own first sentence of explanation, since that's already the citation-grounded
// reason for the fix (e.g. "Corvane's supplemental statement (D11) gives adjusted cost
// basis..."), not invented copy. Falls back to the one-line summary if explanation is
// somehow empty.
export function defaultAcceptReason(check: CheckResult): string {
  const text = (check.explanation || check.summary).trim();
  const match = /^[^.!?]*[.!?]/.exec(text);
  return (match ? match[0] : text).trim();
}

export interface CheckApprovalState {
  decision: CheckDecision;
  needsApproval: boolean; // only meaningful when decision === "accepted" - combined fed/CA effect over the firm's partner-sign-off threshold
  approved: boolean;
  approvedByActorId?: string;
  approvedAt?: string;
  acceptedByActorId?: string;
  acceptedAt?: string;
  reason?: string;
  // Still belongs in the open-items list / area open-item counts: true for "pending" and
  // "rejected" (unchanged from before this feature), and for "accepted" only until it's
  // either under the approval threshold or actually partner-approved.
  isOpen: boolean;
}

// Partner approval reuses the same sign_off + fingerprint mechanism the whole-return
// sign-off already uses (CLAUDE.md "Sign-offs store a fingerprint... reopens
// automatically"), just targeted at one check instead of the return - so if anything new
// happens on this check after an approval (a send-back note, a re-acceptance), the
// fingerprint changes and the approval reopens automatically, with no separate "approval
// was revoked" event needed.
export function checkApprovalState(idx: PacketIndex, derived: DerivedState, check: CheckResult): CheckApprovalState {
  const decision = checkDecision(derived, check);
  const targetId = checkTargetId(check);
  const events = derived.byTarget.get(targetId) ?? [];
  const acceptedEvents = events.filter((e) => e.type === "adjustment" && e.payload.status === "accepted");
  const lastAccepted = acceptedEvents[acceptedEvents.length - 1];

  let needsApproval = false;
  let approved = false;
  let approvedByActorId: string | undefined;
  let approvedAt: string | undefined;

  if (decision === "accepted" && lastAccepted) {
    const effect = computeCheckEffect(idx, check);
    needsApproval = needsPartnerSignOff(effect.federal, effect.california, DEFAULT_STANDARDS.partnerSignOffThreshold);
    if (needsApproval) {
      const signOff = latestSignOffStatus(derived, targetId, "partner");
      if (signOff && !signOff.reopened) {
        approved = true;
        approvedByActorId = signOff.event.actor;
        approvedAt = signOff.event.at;
      }
    }
  }

  const resolved = decision === "accepted" && (!needsApproval || approved);

  return {
    decision,
    needsApproval,
    approved,
    approvedByActorId,
    approvedAt,
    acceptedByActorId: lastAccepted?.actor,
    acceptedAt: lastAccepted?.at,
    reason: lastAccepted?.payload.reason,
    isOpen: !resolved,
  };
}

// Builds the adjustment event(s) for an accept/dismiss decision - one function so Checks,
// Home's approval section, and Review all construct the exact same event shape per check
// kind (manualEffect / whatIfId / proposedAdjustments), just with the caller's own reason.
export function buildDecisionEvents(
  check: CheckResult,
  effects: TaxEffect,
  status: "accepted" | "rejected",
  reason: string
): { type: "adjustment"; target: TargetRef; payload: EventPayload }[] {
  const target: TargetRef = { kind: "check", id: checkTargetId(check), label: check.title };
  if (check.manualEffect) {
    return [
      {
        type: "adjustment",
        target,
        payload: {
          amount: effects.federal,
          category: check.effectKind === "payments" ? "manual_payments" : "manual",
          reason,
          status,
          evidence_refs: check.evidence,
          tax_effect_federal: effects.federal,
          tax_effect_california: effects.california,
        },
      },
    ];
  }
  if (check.whatIfId) {
    return [
      {
        type: "adjustment",
        target,
        payload: {
          amount: effects.federal,
          category: "what_if",
          what_if_id: check.whatIfId,
          reason,
          status,
          evidence_refs: check.evidence,
          tax_effect_federal: effects.federal,
          tax_effect_california: effects.california,
        },
      },
    ];
  }
  if (check.proposedAdjustments.length === 0) {
    return [{ type: "adjustment", target, payload: { amount: 0, category: "none", reason, status, evidence_refs: check.evidence } }];
  }
  return check.proposedAdjustments.map((adj) => ({
    type: "adjustment" as const,
    target,
    payload: { amount: adj.amount, category: adj.category, reason, status, evidence_refs: check.evidence, extra: { caSourceOnly: adj.caSourceOnly ?? false } },
  }));
}
