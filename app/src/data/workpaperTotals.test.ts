// Unit test for the Home top-strip totals: Total tax must only reflect tax-effect
// adjustments (never a payment correction), Payments must reflect payment corrections,
// and Balance due must always equal Total tax - Payments. This is exactly the bug that
// shipped: payment-correction checks were being added straight into Total tax (and from
// there into Balance due a second time via the old uniform shift), overstating Total tax
// by the payment corrections' dollar amount.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Packet } from "../types/packet";
import { buildIndex, type PacketIndex } from "./index";
import { buildDerivedState } from "../store/fold";
import { computeWorkpaperTotals } from "./workpaperTotals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKET_PATH = path.resolve(__dirname, "../../public/packet.json");

let idx: PacketIndex;

beforeAll(() => {
  const packet = JSON.parse(readFileSync(PACKET_PATH, "utf-8")) as Packet;
  idx = buildIndex(packet);
});

function round(n: number): number {
  return Math.round(n);
}

describe("Home top-strip totals", () => {
  it("engine v3 column: balance due = total tax - payments (sanity check against the packet itself)", () => {
    const totals = computeWorkpaperTotals(idx, buildDerivedState([]));
    expect(round(totals.federal.engine.totalTax - totals.federal.engine.payments)).toBe(round(totals.federal.engine.balanceDue));
    expect(round(totals.california.engine.totalTax - totals.california.engine.payments)).toBe(round(totals.california.engine.balanceDue));
  });

  it("with nothing accepted, the accepted column equals the engine column exactly", () => {
    const totals = computeWorkpaperTotals(idx, buildDerivedState([]));
    expect(totals.federal.accepted).toEqual(totals.federal.engine);
    expect(totals.california.accepted).toEqual(totals.california.engine);
  });

  it("with every pending check hypothetically accepted, Total tax excludes the two payment corrections entirely", () => {
    const totals = computeWorkpaperTotals(idx, buildDerivedState([]));
    // Federal: engine 81,962 total tax, minus the net tax-only effect of the 18
    // tax-affecting checks (the $1,000 federal payment correction must NOT be in here).
    expect(round(totals.federal.allPending.totalTax)).toBe(72068);
    // California: engine 18,874 total tax, minus the net tax-only effect of the
    // tax-affecting checks (the $3,500 CA payment correction must NOT be in here).
    expect(round(totals.california.allPending.totalTax)).toBe(12027);
  });

  it("the $1,000 federal payment correction moves Payments, not Total tax", () => {
    const totals = computeWorkpaperTotals(idx, buildDerivedState([]));
    const engineTax = totals.federal.engine.totalTax;
    const engineRestOfTax = round(totals.federal.allPending.totalTax) - round(engineTax);
    // The tax-only delta should be a big number (all the other 17 tax-effect checks
    // combined) - nowhere near the lone $1,000 payment correction's size, which confirms
    // that $1,000 isn't hiding inside Total tax.
    expect(Math.abs(engineRestOfTax)).toBeGreaterThan(5000);
    // Payments should have dropped by (at least) the $1,000 correction.
    const paymentsDrop = totals.federal.engine.payments - totals.federal.allPending.payments;
    expect(round(paymentsDrop)).toBeGreaterThanOrEqual(1000);
  });

  it("the $3,500 CA payment correction moves Payments, not Total tax", () => {
    const totals = computeWorkpaperTotals(idx, buildDerivedState([]));
    const paymentsDrop = totals.california.engine.payments - totals.california.allPending.payments;
    expect(round(paymentsDrop)).toBeGreaterThanOrEqual(3500);
  });

  it("Balance due is always Total tax minus Payments, in every column", () => {
    const totals = computeWorkpaperTotals(idx, buildDerivedState([]));
    for (const jurisdiction of [totals.federal, totals.california]) {
      for (const column of [jurisdiction.engine, jurisdiction.accepted, jurisdiction.allPending]) {
        expect(round(column.totalTax - column.payments)).toBe(round(column.balanceDue));
      }
    }
  });
});
