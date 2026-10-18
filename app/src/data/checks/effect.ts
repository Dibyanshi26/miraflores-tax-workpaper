// Shared "what's the dollar effect of this check" logic, used by both the Checks view
// and Home's ranked open-items list so the two never compute it differently.
import type { PacketIndex } from "../index";
import type { DerivedState } from "../../store/fold";
import { computeTaxEffect, type TaxEffect } from "../taxEffect";
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
