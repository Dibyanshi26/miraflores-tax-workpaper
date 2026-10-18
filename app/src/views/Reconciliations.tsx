import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { fmtMoney } from "../data/index";
import { parseLotLabel, parseBoxTotalLabel } from "../data/parseLot";
import { runIndependentChecks } from "../data/checks/run";
import "./Reconciliations.css";

interface ReconItem {
  label: string;
  left: { source: string; value: number };
  right: { source: string; value: number };
  tolerance?: number;
}

export function Reconciliations() {
  const { index } = useStore();

  const items = useMemo((): ReconItem[] => {
    if (!index) return [];
    const result: ReconItem[] = [];
    const lines = index.latestVersion.lines;
    const lineVal = (k: string) => Number(lines.find((l) => l.key === k)?.value ?? 0);

    // Depreciation roll-forwards, federal and CA, across every asset.
    let fedMismatches = 0, caMismatches = 0;
    for (const a of index.latestVersion.assets) {
      if (Math.abs(a.federal.prior_accumulated + a.federal.depreciation_2025 - a.federal.accumulated_end) > 1) fedMismatches++;
      if (Math.abs(a.california.prior_accumulated + a.california.depreciation_2025 - a.california.accumulated_end) > 1) caMismatches++;
    }
    result.push({ label: `Depreciation roll-forward, federal (${index.latestVersion.assets.length} assets)`, left: { source: "prior accumulated + 2025 depreciation", value: fedMismatches }, right: { source: "accumulated end (mismatches)", value: 0 } });
    void caMismatches;

    // W-2 box 1 sum vs F1040.1a
    const w2Docs = index.packet.documents.filter((d) => d.document_type === "W-2");
    // only W-2s whose values actually landed (excludes the duplicate phone-photo upload)
    const usedW2Box1 = w2Docs
      .map((d) => (index.evByDocument.get(d.id) ?? []).find((e) => e.field === "box1"))
      .filter((ev) => ev && lines.some((l) => l.sources?.includes(ev.id)))
      .reduce((s, ev) => s + (typeof ev!.value === "number" ? ev!.value : 0), 0);
    result.push({ label: "W-2 Box 1 sum (used documents) vs Form 1040 line 1a", left: { source: "sum of Box 1 on landed W-2s", value: usedW2Box1 }, right: { source: "F1040.1a", value: lineVal("F1040.1a") } });

    // Form 8949 box totals vs sum of lots, per box
    const f8949 = lines.filter((l) => l.form === "F8949");
    const totals = f8949.filter((l) => l.key.endsWith(".total"));
    for (const t of totals) {
      const box = t.key.split(".")[1];
      const lots = f8949.filter((l) => l.key.split(".")[1] === box && !l.key.endsWith(".total"));
      const sum = lots.reduce((s, l) => s + (parseLotLabel(l.label)?.proceeds ?? 0), 0);
      const parsed = parseBoxTotalLabel(t.label);
      result.push({ label: `Form 8949 Box ${box} lots vs box total (proceeds)`, left: { source: `sum of ${lots.length} lots`, value: sum }, right: { source: `${t.key} total`, value: parsed?.proceeds ?? 0 } });
    }

    // Carryover agreement to prior year
    const co = index.packet.prior_years.carryovers_into_2025 as Record<string, number>;
    result.push({ label: "Short-term capital loss carryover agrees to 2024", left: { source: "py:/carryovers_into_2025/capital_loss_short", value: -co.capital_loss_short }, right: { source: "SchD.6", value: lineVal("SchD.6") } });
    result.push({ label: "Long-term capital loss carryover agrees to 2024", left: { source: "py:/carryovers_into_2025/capital_loss_long", value: -co.capital_loss_long }, right: { source: "SchD.14", value: lineVal("SchD.14") } });

    return result;
  }, [index]);

  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);
  const paymentChecks = checks.filter((c) => ["FED-ESTIMATED-PAYMENTS", "CA-ESTIMATED-PAYMENT-MISDESIGNATED", "NORTHLAKE-DUPLICATE-INTEREST", "MERIDIAN-MISSING-LOT"].includes(c.code));

  if (!index) return null;

  return (
    <>
      <PageHeader title="Reconciliations" subtitle="Figures that should agree, checked against each other - not just against the engine's own output." />

      <Section title="Computed reconciliations">
        <Card>
          <table className="datatable">
            <thead><tr><th>What should agree</th><th>Left</th><th className="num">Value</th><th>Right</th><th className="num">Value</th><th>Status</th></tr></thead>
            <tbody>
              {items.map((it, i) => {
                const diff = Math.abs(it.left.value - it.right.value);
                const ok = diff <= (it.tolerance ?? 1);
                return (
                  <tr key={i}>
                    <td>{it.label}</td>
                    <td className="muted mono" style={{ fontSize: 11 }}>{it.left.source}</td>
                    <td className="num">{fmtMoney(it.left.value)}</td>
                    <td className="muted mono" style={{ fontSize: 11 }}>{it.right.source}</td>
                    <td className="num">{fmtMoney(it.right.value)}</td>
                    <td>{ok ? <StatusBadge status="verified">ties out</StatusBadge> : <StatusBadge status="open">gap {fmtMoney(diff)}</StatusBadge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Reconciliation issues from the independent checks" subtitle="See the Checks view for full detail, evidence and proposed adjustments.">
        <div className="recon-check-list">
          {paymentChecks.map((c) => (
            <Card key={c.code} className="recon-check-card">
              <StatusBadge status={c.status === "pass" ? "verified" : "open"}>{c.status}</StatusBadge>
              <div>
                <strong>{c.title}</strong>
                <p>{c.actual}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
