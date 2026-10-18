// Engine v3 vs. workpaper headline totals for the Home top strip - three columns per
// metric: the engine's static v3 figure, the workpaper as accepted adjustments stand
// today, and a hypothetical "if every still-pending check were also accepted" figure, so
// a reviewer can see both where the return stands and how far it could still move.
//
// Total tax and Payments are tracked separately - a payment correction (an over/under-
// claimed estimated payment) never changes total tax, only Payments, and therefore
// Balance due = Total tax - Payments. Lumping it into Total tax (as this used to do) is
// wrong even though it nets to the same balance due: it misreports what moved.
import type { PacketIndex } from "./index";
import type { DerivedState } from "../store/fold";
import { aggregateAcceptedAdjustments } from "./taxEffect";
import { runIndependentChecks } from "./checks/run";
import { checkDecision, computeCheckEffect, computeLiveSchCProfitDelta } from "./checks/effect";

export interface JurisdictionTotals {
  agi: number;
  totalTax: number;
  payments: number;
  balanceDue: number;
}

export interface WorkpaperTotals {
  federal: { engine: JurisdictionTotals; accepted: JurisdictionTotals; allPending: JurisdictionTotals };
  california: { engine: JurisdictionTotals; accepted: JurisdictionTotals; allPending: JurisdictionTotals };
  pendingAdjustments: number;
  acceptedCount: number;
}

// taxDelta shifts AGI and total tax together; paymentsReduction is subtracted from
// payments. Balance due is always recomputed as totalTax - payments, never shifted
// directly, so it can never silently drift out of sync with the other two.
function shift(base: JurisdictionTotals, taxDelta: number, paymentsReduction: number): JurisdictionTotals {
  const totalTax = base.totalTax + taxDelta;
  const payments = base.payments - paymentsReduction;
  return { agi: base.agi + taxDelta, totalTax, payments, balanceDue: totalTax - payments };
}

export function computeWorkpaperTotals(idx: PacketIndex, derived: DerivedState): WorkpaperTotals {
  const v3 = idx.latestVersion;
  const accepted = aggregateAcceptedAdjustments(v3, derived.activeEvents);

  const federalEngine: JurisdictionTotals = { agi: v3.summary.federal.agi, totalTax: v3.summary.federal.total_tax, payments: v3.summary.federal.payments, balanceDue: v3.summary.federal.balance_due };
  const californiaEngine: JurisdictionTotals = { agi: v3.summary.california.ca_agi, totalTax: v3.summary.california.total_tax, payments: v3.summary.california.payments, balanceDue: v3.summary.california.balance_due };

  const checks = runIndependentChecks(idx, computeLiveSchCProfitDelta(derived));
  const pending = checks.filter((c) => c.status === "fail" && checkDecision(derived, c) === "pending");
  const pendingSum = pending.reduce(
    (acc, c) => {
      const e = computeCheckEffect(idx, c);
      if (c.effectKind === "payments") {
        return { ...acc, federalPayments: acc.federalPayments + e.federal, californiaPayments: acc.californiaPayments + e.california };
      }
      return { ...acc, federalTax: acc.federalTax + e.federal, californiaTax: acc.californiaTax + e.california };
    },
    { federalTax: 0, californiaTax: 0, federalPayments: 0, californiaPayments: 0 }
  );
  const acceptedCount = checks.filter((c) => c.status === "fail" && checkDecision(derived, c) === "accepted").length;

  return {
    federal: {
      engine: federalEngine,
      accepted: shift(federalEngine, accepted.federal.tax, accepted.federal.payments),
      allPending: shift(federalEngine, accepted.federal.tax + pendingSum.federalTax, accepted.federal.payments + pendingSum.federalPayments),
    },
    california: {
      engine: californiaEngine,
      accepted: shift(californiaEngine, accepted.california.tax, accepted.california.payments),
      allPending: shift(californiaEngine, accepted.california.tax + pendingSum.californiaTax, accepted.california.payments + pendingSum.californiaPayments),
    },
    pendingAdjustments: pending.length,
    acceptedCount,
  };
}
