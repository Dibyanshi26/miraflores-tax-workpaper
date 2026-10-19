// Unit tests for the trace drawer's "How it's built" recompute: loads the real packet
// from disk and checks that (a) every declared-subtraction formula reproduces the
// engine's actual v3 value (proving the hand-authored table in DECLARED_FORMULAS is
// correct, not just plausible), (b) the W-2 box-sum source recompute still works,
// (c) an undeclared-but-additive R-SUM line is reported as an unconfirmed "gray" match,
// not a verified green one, and (d) feeding a declared formula a deliberately wrong
// input value turns the result red (matches: false) instead of silently passing.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Packet, ReturnLine } from "../types/packet";
import { buildIndex, type PacketIndex } from "./index";
import { computeFromSources, computeFromInputs, DECLARED_FORMULAS } from "./lineRecompute";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKET_PATH = path.resolve(__dirname, "../../public/packet.json");

let idx: PacketIndex;

beforeAll(() => {
  const packet = JSON.parse(readFileSync(PACKET_PATH, "utf-8")) as Packet;
  idx = buildIndex(packet);
});

function line(key: string): ReturnLine {
  const l = idx.linesByVersionKey.get("v3")?.get(key);
  if (!l) throw new Error(`line ${key} not found in v3`);
  return l;
}

describe("declared subtraction formulas reproduce the engine's actual v3 value", () => {
  // One assertion per entry in DECLARED_FORMULAS, so a future packet update that breaks
  // one of these hand-derived formulas fails loudly here instead of silently in the UI.
  const declaredKeys = Object.keys(DECLARED_FORMULAS);

  it("covers every line this test knows about", () => {
    // Sanity check the test itself is exercising the real table, not a stale copy.
    expect(declaredKeys).toEqual(
      expect.arrayContaining([
        "F1040.37",
        "F1040.15",
        "F1040.11",
        "SchC.29",
        "SchC.31",
        "SchE.21A",
        "SchE.21B",
        "F4797.24",
        "F4797.25",
        "F7203.7",
        "F540NR.97",
      ])
    );
  });

  for (const key of declaredKeys) {
    it(`${key} matches the engine and is reported as a declared (green) match`, () => {
      const result = computeFromInputs(idx, line(key));
      expect(result).not.toBeNull();
      expect(result!.declared).toBe(true);
      expect(result!.matches).toBe(true);
      expect(result!.computed).toBeCloseTo(line(key).value as number, 2);
    });
  }

  it("F7203.7 floors stock basis at $0 instead of going negative, with an explanatory note", () => {
    const result = computeFromInputs(idx, line("F7203.7"));
    expect(result!.computed).toBe(0);
    expect(result!.note).toMatch(/can't go below \$0/);
  });

  it("F540NR.97 (overpaid tax) is payments minus tax, not tax minus payments", () => {
    const result = computeFromInputs(idx, line("F540NR.97"));
    // inputs are [F540NR.64 (tax), F540NR.78 (payments)]; the refund is payments - tax
    expect(result!.terms[0].sign).toBe(-1);
    expect(result!.terms[1].sign).toBe(1);
  });
});

describe("W-2 box-sum source recompute", () => {
  it("F1040.1a sums the two W-2 box 1 amounts and matches the engine", () => {
    const result = computeFromSources(idx, line("F1040.1a"));
    expect(result).not.toBeNull();
    expect(result!.declared).toBe(true);
    expect(result!.matches).toBe(true);
    expect(result!.computed).toBe(line("F1040.1a").value);
  });
});

describe("undeclared R-SUM lines never show a green check, only neutral gray", () => {
  it("F1040.9 (plain addition, not in DECLARED_FORMULAS) matches but is reported undeclared", () => {
    expect(DECLARED_FORMULAS["F1040.9"]).toBeUndefined();
    const result = computeFromInputs(idx, line("F1040.9"));
    expect(result).not.toBeNull();
    expect(result!.declared).toBe(false);
    expect(result!.matches).toBe(true);
  });

  it("F8959.22 (box 6 sources aren't simply summed for this line) returns no recompute at all, not a false mismatch", () => {
    // Regression guard: this line's rule (R-8959) doesn't declare itself a sum, so a
    // naive sources-sum would wrongly flag it red. It must stay silent instead.
    expect(computeFromSources(idx, line("F8959.22"))).toBeNull();
  });
});

describe("a deliberately wrong input turns a declared line red", () => {
  it("corrupting F1040.33 (Total payments) makes F1040.37 (Amount you owe) report a mismatch", () => {
    const packet = JSON.parse(readFileSync(PACKET_PATH, "utf-8")) as Packet;
    const corruptedIdx = buildIndex(packet);
    const v3 = corruptedIdx.linesByVersionKey.get("v3")!;
    const payments = v3.get("F1040.33")!;
    // Deliberately wrong: real value is 77742; shift it so 24 - 33 no longer equals 37's value.
    v3.set("F1040.33", { ...payments, value: (payments.value as number) + 500 });

    const result = computeFromInputs(corruptedIdx, v3.get("F1040.37")!);
    expect(result).not.toBeNull();
    expect(result!.declared).toBe(true);
    expect(result!.matches).toBe(false);
  });

  it("corrupting SchC.28 (Total expenses) makes SchC.29 (Tentative profit) report a mismatch", () => {
    const packet = JSON.parse(readFileSync(PACKET_PATH, "utf-8")) as Packet;
    const corruptedIdx = buildIndex(packet);
    const v3 = corruptedIdx.linesByVersionKey.get("v3")!;
    const expenses = v3.get("SchC.28")!;
    v3.set("SchC.28", { ...expenses, value: (expenses.value as number) - 1000 });

    const result = computeFromInputs(corruptedIdx, v3.get("SchC.29")!);
    expect(result!.matches).toBe(false);
  });
});
