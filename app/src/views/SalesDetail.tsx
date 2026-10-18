import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { useUiStore } from "../store/uiStore";
import { fmtMoney, fmtMoneyCents } from "../data/index";
import { parseLotLabel, parseBoxTotalLabel, boxLabel } from "../data/parseLot";
import { runIndependentChecks } from "../data/checks/run";
import "./SalesDetail.css";

export function SalesDetail() {
  const { index } = useStore();
  const [box, setBox] = useState<string>("all");
  const [q, setQ] = useState("");

  const data = useMemo(() => {
    if (!index) return null;
    const f8949 = index.latestVersion.lines.filter((l) => l.form === "F8949");
    const lots = f8949.filter((l) => !l.key.endsWith(".total"));
    const totals = f8949.filter((l) => l.key.endsWith(".total"));
    const reconById = new Map<string, { parsedProceeds: number; parsedBasis: number; parsedGain: number }>();
    for (const t of totals) {
      const box = t.key.split(".")[1];
      const boxLots = lots.filter((l) => l.key.split(".")[1] === box);
      const parsedProceeds = boxLots.reduce((s, l) => s + (parseLotLabel(l.label)?.proceeds ?? 0), 0);
      const parsedBasis = boxLots.reduce((s, l) => s + (parseLotLabel(l.label)?.basis ?? 0), 0);
      const parsedGain = boxLots.reduce((s, l) => s + (typeof l.value === "number" ? l.value : 0), 0);
      reconById.set(box, { parsedProceeds, parsedBasis, parsedGain });
    }
    return { lots, totals, reconById };
  }, [index]);

  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);
  const exceptionCodes = new Set(["RSU-BASIS", "CRYPTO-BASIS-MISSING", "MERIDIAN-MISSING-LOT"]);
  const exceptionChecks = checks.filter((c) => exceptionCodes.has(c.code));

  if (!index || !data) return null;

  const filteredLots = data.lots.filter((l) => {
    if (box !== "all" && l.key.split(".")[1] !== box) return false;
    if (q && !l.label.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Sales detail" subtitle={`${data.lots.length} lots across ${data.totals.length} Form 8949 boxes - exceptions first, reconciled to the broker summaries.`} />

      <Section title="Exceptions" subtitle="Lots the independent checks flagged - review these before the bulk table.">
        <div className="sales-exceptions">
          {exceptionChecks.map((c) => (
            <Card key={c.code} className={c.status === "fail" ? "sales-exception-card" : "sales-exception-card sales-exception-card--pass"}>
              <StatusBadge status={c.status === "fail" ? "blocking" : "verified"}>{c.status === "fail" ? "exception" : "resolved"}</StatusBadge>
              <div>
                <strong>{c.title}</strong>
                <p>{c.actual}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Box totals, reconciled">
        <Card>
          <table className="datatable">
            <thead><tr><th>Box</th><th className="num">Engine proceeds</th><th className="num">Sum of lots</th><th className="num">Engine basis</th><th className="num">Sum of lots</th><th>Reconciles?</th></tr></thead>
            <tbody>
              {data.totals.map((t) => {
                const parsed = parseBoxTotalLabel(t.label);
                const boxKey = t.key.split(".")[1];
                const recon = data.reconById.get(boxKey);
                const ok = recon && parsed && Math.abs(recon.parsedProceeds - parsed.proceeds) < 1;
                return (
                  <tr key={t.key} className="clickable" onClick={() => setBox(boxKey)}>
                    <td>{boxLabel(boxKey)}</td>
                    <td className="num">{parsed ? fmtMoneyCents(parsed.proceeds) : "—"}</td>
                    <td className="num">{recon ? fmtMoneyCents(recon.parsedProceeds) : "—"}</td>
                    <td className="num">{parsed ? fmtMoneyCents(parsed.basis) : "—"}</td>
                    <td className="num">{recon ? fmtMoneyCents(recon.parsedBasis) : "—"}</td>
                    <td>{ok ? <StatusBadge status="verified">ties out</StatusBadge> : <StatusBadge status="open">gap - see exceptions</StatusBadge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section
        title="All lots"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <select value={box} onChange={(e) => setBox(e.target.value)}>
              <option value="all">All boxes</option>
              {data.totals.map((t) => <option key={t.key} value={t.key.split(".")[1]}>{boxLabel(t.key.split(".")[1])}</option>)}
            </select>
            <input placeholder="Search security…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        <Card>
          <table className="datatable">
            <thead><tr><th>Security</th><th>Acquired</th><th>Sold</th><th className="num">Proceeds</th><th className="num">Basis</th><th className="num">Gain/(loss)</th></tr></thead>
            <tbody>
              {filteredLots.slice(0, 150).map((l) => {
                const p = parseLotLabel(l.label);
                return (
                  <tr key={l.key} className="clickable" onClick={() => useUiStore.getState().openTrace(l.key)}>
                    <td>{p?.security ?? l.label}</td>
                    <td className="mono">{p?.acquired}</td>
                    <td className="mono">{p?.sold}</td>
                    <td className="num">{p ? fmtMoneyCents(p.proceeds) : "—"}</td>
                    <td className="num">{p ? fmtMoneyCents(p.basis) : "—"}</td>
                    <td className="num">{typeof l.value === "number" ? fmtMoney(l.value) : l.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredLots.length > 150 && <div className="muted" style={{ padding: 10 }}>Showing first 150 of {filteredLots.length} - narrow with the box filter or search.</div>}
        </Card>
      </Section>
    </>
  );
}
