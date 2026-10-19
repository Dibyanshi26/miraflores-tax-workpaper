// "How it's built" recompute for the trace drawer. This checks the ARITHMETIC the engine
// did on a line, not whether it picked the right sources in the first place (that's what
// the independent checks in Checks are for).
//
// R-SUM is the engine's generic "arithmetic combination of the listed input lines" rule -
// in this packet it covers true sums (F1040.9 = total income line items added) AND
// subtractions (F1040.37 "amount you owe" = total tax - payments), with no way to tell
// which from the rule name alone. Rather than search for a sign combination that happens
// to fit (which can "confirm" a wrong formula by coincidence), DECLARED_FORMULAS below is
// a fixed, hand-authored table of every non-addition R-SUM/R-4797/R-SCORP-BASIS line in
// this packet, each one verified against the real tax form it comes from and against the
// packet's own v3 numbers while this table was written - not computed by the app at
// runtime. A line in this table gets a green "recomputed" confirmation or a red mismatch,
// because we know what the formula is. A line NOT in this table only gets a neutral,
// unconfirmed "reproduced from engine inputs" when plain addition happens to match - never
// a green check, since a coincidental addition match isn't a verified formula.
//
// F7203.7 is the one entry that isn't a plain signed sum: S-corp stock basis can't go
// below $0 after distributions (the excess is taxed as a gain instead - see F8949 box F),
// so its compute function floors at zero and carries a note explaining why the displayed
// subtraction doesn't look like it adds up to the shown total.
import { round2 } from "./taxEffect";
import type { PacketIndex } from "./index";
import type { ReturnLine, ExtractedValue } from "../types/packet";

const TOLERANCE = 0.01;

interface DeclaredFormula {
  compute: (values: number[]) => number;
  signs: (1 | -1)[]; // display sign per input, in the same order as line.inputs
  note?: string;
}

export const DECLARED_FORMULAS: Record<string, DeclaredFormula> = {
  // Schedule C
  "SchC.29": { compute: ([gross, expenses]) => gross - expenses, signs: [1, -1] }, // Gross income - total expenses
  "SchC.31": { compute: ([tentative, homeOffice]) => tentative - homeOffice, signs: [1, -1] }, // Tentative profit - home office
  // Schedule E
  "SchE.21A": { compute: ([rents, expenses]) => rents - expenses, signs: [1, -1] },
  "SchE.21B": { compute: ([rents, expenses]) => rents - expenses, signs: [1, -1] },
  // Form 1040
  "F1040.11": { compute: ([totalIncome, adjustments]) => totalIncome - adjustments, signs: [1, -1] }, // AGI
  "F1040.15": { compute: ([agi, deductions]) => agi - deductions, signs: [1, -1] }, // Taxable income
  "F1040.22": { compute: ([tax, credit1, credit2]) => tax - credit1 - credit2, signs: [1, -1, -1] }, // Tax after nonrefundable credits
  "F1040.37": { compute: ([totalTax, payments]) => totalTax - payments, signs: [1, -1] }, // Amount you owe
  // Form 6251 (AMT)
  "F6251.6": { compute: ([amti, exemption]) => amti - exemption, signs: [1, -1] },
  "F6251.9": { compute: ([tmtBeforeFtc, amtFtc]) => tmtBeforeFtc - amtFtc, signs: [1, -1] }, // Tentative minimum tax
  "F6251.10": { compute: ([regularTax, ftc]) => regularTax - ftc, signs: [1, -1] },
  "F6251.11": { compute: ([tmt, regularTaxMinusFtc]) => tmt - regularTaxMinusFtc, signs: [1, -1] },
  // Form 8812 (CTC)
  "F8812.12": { compute: ([tentative, phaseOut]) => tentative - phaseOut, signs: [1, -1] },
  // Form 4797
  "F4797.24": { compute: ([basis, depreciation]) => basis - depreciation, signs: [1, -1] }, // Adjusted basis
  "F4797.25": { compute: ([salesPrice, adjustedBasis]) => salesPrice - adjustedBasis, signs: [1, -1] }, // Total gain
  // Form 7203 (S-corp basis) - floored at $0; distributions can't take basis negative.
  "F7203.7": {
    compute: ([basisBefore, distributions]) => Math.max(0, basisBefore - distributions),
    signs: [1, -1],
    note: "Stock basis can't go below $0 - the $21,215 excess distribution is taxed as a long-term capital gain instead (Form 8949 box F), not deducted here.",
  },
  // Form 540NR (CA)
  "F540NR.17": { compute: ([totalIncome, adjustments]) => totalIncome - adjustments, signs: [1, -1] },
  "F540NR.19": { compute: ([agi, deductions]) => agi - deductions, signs: [1, -1] },
  "F540NR.32": { compute: ([totalIncome, adjustments]) => totalIncome - adjustments, signs: [1, -1] },
  "F540NR.40": { compute: ([taxBeforeExemption, exemptionCredits]) => taxBeforeExemption - exemptionCredits, signs: [1, -1] }, // Regular tax
  "F540NR.64": { compute: ([regularTax, ostc, other]) => regularTax - ostc + other, signs: [1, -1, 1] }, // Total tax
  "F540NR.97": { compute: ([tax, payments]) => payments - tax, signs: [-1, 1] }, // Overpaid tax (refund)
};

export interface RecomputeTerm {
  label: string;
  value: number;
  sign: 1 | -1;
}

export interface Recompute {
  computed: number;
  matches: boolean;
  declared: boolean; // true = verified formula (green match / red mismatch); false = unconfirmed addition (gray only, never red)
  note?: string;
  terms: RecomputeTerm[];
}

// Sources-based recompute: only for the W-2-box-sum family of rules, which name an
// unambiguous plain sum in their own rule text ("Sum box 1 of each distinct Form W-2").
// Generic R-SUM is excluded here because it's ambiguous (handled, declared-only, below).
export function computeFromSources(idx: PacketIndex, line: ReturnLine): Recompute | null {
  if (!line.sources || line.sources.length === 0) return null;
  if (line.inputs && line.inputs.length > 0) return null;
  if (typeof line.value !== "number") return null;
  if (!line.rule || line.rule === "R-SUM" || !/SUM/i.test(line.rule)) return null;
  const evRefs = line.sources.filter((s) => s.startsWith("ev-"));
  if (evRefs.length !== line.sources.length || evRefs.length === 0) return null;
  const evs = evRefs.map((id) => idx.evById.get(id)).filter((e): e is ExtractedValue => !!e);
  if (evs.length !== evRefs.length) return null;
  if (!evs.every((e) => (e.value_type === "money" || e.value_type === "quantity" || e.value_type === "integer") && typeof e.value === "number")) return null;
  const sum = round2(evs.reduce((s, e) => s + (e.value as number), 0));
  return {
    computed: sum,
    matches: Math.abs(sum - line.value) < 0.5,
    declared: true,
    terms: evs.map((e) => ({ label: e.label, value: e.value as number, sign: 1 as const })),
  };
}

export function computeFromInputs(idx: PacketIndex, line: ReturnLine): Recompute | null {
  if (!line.inputs || line.inputs.length === 0) return null;
  if (typeof line.value !== "number") return null;
  const v3Lines = idx.linesByVersionKey.get("v3");
  const inputLines = line.inputs.map((k) => v3Lines?.get(k)).filter((l): l is ReturnLine => !!l);
  if (inputLines.length !== line.inputs.length) return null;
  if (!inputLines.every((l) => typeof l.value === "number")) return null;
  const values = inputLines.map((l) => l.value as number);

  const declared = DECLARED_FORMULAS[line.key];
  if (declared && declared.signs.length === values.length) {
    const computed = round2(declared.compute(values));
    return {
      computed,
      matches: Math.abs(computed - line.value) < TOLERANCE,
      declared: true,
      note: declared.note,
      terms: inputLines.map((l, i) => ({ label: l.label, value: l.value as number, sign: declared.signs[i] })),
    };
  }

  if (line.rule !== "R-SUM") return null;
  const sum = round2(values.reduce((s, v) => s + v, 0));
  if (Math.abs(sum - line.value) >= TOLERANCE) return null; // no declared formula, and plain addition doesn't match - stay silent, not red
  return {
    computed: sum,
    matches: true,
    declared: false,
    terms: inputLines.map((l) => ({ label: l.label, value: l.value as number, sign: 1 as const })),
  };
}

export function recomputeLine(idx: PacketIndex, line: ReturnLine): Recompute | null {
  return computeFromSources(idx, line) ?? computeFromInputs(idx, line);
}
