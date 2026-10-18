// Form 8949 lot labels are formatted strings like:
// "Corvane Systems Inc (RSU) (acquired 2025-02-15, sold 2025-02-18; proceeds 19,240.00, basis 0.00, adjustment W 60.76)"
// Parsed for display - the authoritative numbers are still line.value (gain/loss) and
// the underlying extracted_values cited in line.sources.
export interface ParsedLot {
  security: string;
  acquired: string;
  sold: string;
  proceeds: number;
  basis: number;
  adjustmentCode?: string;
  adjustmentAmount?: number;
}

const RE = /^(.*?)\s*\(acquired ([\d-]+|various), sold ([\d-]+); proceeds ([\d,.-]+), basis ([\d,.-]+)(?:, adjustment (\w) ([\d,.-]+))?\)$/;

export function parseLotLabel(label: string): ParsedLot | null {
  const m = RE.exec(label.trim());
  if (!m) return null;
  return {
    security: m[1],
    acquired: m[2],
    sold: m[3],
    proceeds: Number(m[4].replace(/,/g, "")),
    basis: Number(m[5].replace(/,/g, "")),
    adjustmentCode: m[6],
    adjustmentAmount: m[7] ? Number(m[7].replace(/,/g, "")) : undefined,
  };
}

export interface ParsedBoxTotal { proceeds: number; basis: number; adjustments: number }
const TOTALS_RE = /^Box \w+ totals \(proceeds ([\d,.-]+); basis ([\d,.-]+); adjustments ([\d,.-]+)\)$/;

export function parseBoxTotalLabel(label: string): ParsedBoxTotal | null {
  const m = TOTALS_RE.exec(label.trim());
  if (!m) return null;
  return { proceeds: Number(m[1].replace(/,/g, "")), basis: Number(m[2].replace(/,/g, "")), adjustments: Number(m[3].replace(/,/g, "")) };
}

export function boxLabel(box: string): string {
  const map: Record<string, string> = {
    A: "Short-term, basis reported", B: "Short-term, basis not reported", C: "Short-term, not on 1099-B",
    D: "Long-term, basis reported", E: "Long-term, basis not reported", F: "Long-term, not on 1099-B",
  };
  return map[box] ?? `Box ${box}`;
}
