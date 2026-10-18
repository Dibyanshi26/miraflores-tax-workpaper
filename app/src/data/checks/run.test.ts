// Unit test for the independent checks' tax-effect math: loads the real packet from
// disk (the same file the app fetches at runtime) and asserts each failing check's
// federal/California dollar effect, rounded to the nearest dollar the same way the UI
// displays it (data/index.ts fmtMoney uses Math.round). This is what actually catches
// sign errors and wrong-category bugs - the UI only shows the number, it doesn't prove
// it's right.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Packet } from "../../types/packet";
import { buildIndex, type PacketIndex } from "../index";
import { runIndependentChecks } from "./run";
import { computeCheckEffect } from "./effect";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKET_PATH = path.resolve(__dirname, "../../../public/packet.json");

let idx: PacketIndex;

beforeAll(() => {
  const packet = JSON.parse(readFileSync(PACKET_PATH, "utf-8")) as Packet;
  idx = buildIndex(packet);
});

function round(n: number): number {
  return Math.round(n);
}

// Expected effect at baseline (no accepted adjustments, liveSchCProfitDelta = 0), rounded
// to the nearest dollar - the same precision the Checks and Home views display.
const EXPECTED_EFFECTS: Record<string, { federal: number; california: number }> = {
  "RSU-BASIS": { federal: -15536, california: -2765 },
  "SCHC-1099K-DOUBLE": { federal: -4402, california: -384 },
  "MILEAGE-DUPLICATE-PAGE": { federal: 919, california: 80 },
  "SE-HEALTH-INS": { federal: 4464, california: 605 },
  "PERSONAL-USE-SPLIT": { federal: 541, california: 47 },
  "SEP-LIMIT": { federal: 0, california: 0 }, // at baseline, contribution already equals the engine's limit - see the live-recompute test below
  "HVAC-CAPITALIZE": { federal: 3633, california: 896 },
  "NORTHLAKE-DUPLICATE-INTEREST": { federal: -640, california: -127 },
  "SPARBANKEN-FX-YEAR": { federal: 43, california: 9 },
  "MERIDIAN-MISSING-LOT": { federal: -21, california: -2 },
  "CRYPTO-BASIS-MISSING": { federal: -1312, california: -104 },
  "MORTGAGE-PAYOFF-DOUBLE": { federal: 559, california: 103 },
  "PROPERTY-TAX-SELLER-CREDIT": { federal: 1051, california: 332 },
  "VEHICLE-DONATION-LIMIT": { federal: 806, california: 149 },
  "FED-ESTIMATED-PAYMENTS": { federal: 1000, california: 0 },
  "CA-ESTIMATED-PAYMENT-MISDESIGNATED": { federal: 0, california: 3500 },
  "CA-SOURCE-WAGES-PAYROLL-ERROR": { federal: 0, california: -5685 },
  "THEO-SSN-TYPO": { federal: 0, california: 0 },
  "LITTLE-SPROUTS-EIN-MISREAD": { federal: 0, california: 0 },
  "BRIGHT-OAK-NAME-MISMATCH": { federal: 0, california: 0 },
};

describe("independent checks: tax-effect math", () => {
  it("covers every failing check with an expected effect", () => {
    const checks = runIndependentChecks(idx, 0);
    const failing = checks.filter((c) => c.status === "fail").map((c) => c.code);
    expect(failing.sort()).toEqual(Object.keys(EXPECTED_EFFECTS).sort());
  });

  for (const [code, expected] of Object.entries(EXPECTED_EFFECTS)) {
    it(`${code}: federal ${expected.federal >= 0 ? "+" : ""}${expected.federal}, California ${expected.california >= 0 ? "+" : ""}${expected.california}`, () => {
      const check = runIndependentChecks(idx, 0).find((c) => c.code === code);
      expect(check, `check ${code} not found`).toBeTruthy();
      const effect = computeCheckEffect(idx, check!);
      expect(round(effect.federal)).toBe(expected.federal);
      expect(round(effect.california)).toBe(expected.california);
    });
  }

  // Specifically pins down requirement (1): CA wage sourcing must have zero federal
  // effect - it's a pure CA-source reallocation, not a federal wage change.
  it("CA-SOURCE-WAGES-PAYROLL-ERROR has exactly zero federal effect", () => {
    const check = runIndependentChecks(idx, 0).find((c) => c.code === "CA-SOURCE-WAGES-PAYROLL-ERROR")!;
    const effect = computeCheckEffect(idx, check);
    expect(effect.federal).toBe(0);
  });

  // Requirement (5): the RSU check's California effect must differ between the
  // CA-period lots (ca_source_income, .064) and the post-move lot (ltcg, .034) - this
  // guards against the whole check silently reverting to one blended rate for all three.
  it("RSU-BASIS splits N1/N3 (ca_source_income) from N4 (ltcg) for the California effect", () => {
    const check = runIndependentChecks(idx, 0).find((c) => c.code === "RSU-BASIS")!;
    const stLot = check.proposedAdjustments.find((a) => a.lineKey?.includes("N1"));
    const ltLot = check.proposedAdjustments.find((a) => a.lineKey?.includes("N4"));
    expect(stLot?.caSourceOnly).toBe(true);
    expect(ltLot?.caSourceOnly).toBeFalsy();
  });

  // Requirement (6): the SEP limit is live against the workpaper's Schedule C profit -
  // accepting the 1099-K double-count (a schc_profit-reducing fix) should tighten the
  // limit and grow the excess, not leave it frozen at the engine's baseline.
  it("SEP-LIMIT recomputes tighter once a Schedule C profit adjustment is accepted", () => {
    const baseline = runIndependentChecks(idx, 0).find((c) => c.code === "SEP-LIMIT")!;
    const afterFix = runIndependentChecks(idx, -12400).find((c) => c.code === "SEP-LIMIT")!; // SCHC-1099K-DOUBLE's effect on profit
    const baselineLimitMatch = /limit is \$([\d,]+)/.exec(baseline.actual);
    const afterLimitMatch = /limit is \$([\d,]+)/.exec(afterFix.actual);
    expect(baselineLimitMatch).toBeTruthy();
    expect(afterLimitMatch).toBeTruthy();
    const baselineLimit = Number(baselineLimitMatch![1].replace(/,/g, ""));
    const afterLimit = Number(afterLimitMatch![1].replace(/,/g, ""));
    expect(afterLimit).toBeLessThan(baselineLimit);
    expect(afterFix.severity).toBe("blocking"); // excess grows past the point of being a minor note
  });

  // Requirement (3): the SALT fix must apply the $40,000 cap, not the raw dollar
  // correction - a regression here would silently re-break the federal number back to
  // the pre-fix (uncapped) value.
  it("PROPERTY-TAX-SELLER-CREDIT applies the SALT cap, not the raw correction", () => {
    const check = runIndependentChecks(idx, 0).find((c) => c.code === "PROPERTY-TAX-SELLER-CREDIT")!;
    const effect = computeCheckEffect(idx, check);
    // The raw (uncapped) correction would be (6,912 - 1,580) x 0.26 = 1,386 - the capped
    // figure must be meaningfully smaller.
    expect(round(effect.federal)).toBeLessThan(1386);
  });
});
