import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { useUiStore } from "../store/uiStore";
import { fmtMoney, fmtDate } from "../data/index";
import { runIndependentChecks } from "../data/checks/run";
import "./StateSplit.css";

const ROW_BASES = ["1", "2", "3", "4", "7", "12", "17", "22", "26"];

export function StateSplit() {
  const { index } = useStore();
  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);
  const caWagesCheck = checks.find((c) => c.code === "CA-SOURCE-WAGES-PAYROLL-ERROR");

  if (!index) return null;
  const lines = index.latestVersion.lines.filter((l) => l.form === "SchCA540NR");
  const rowsByBase = new Map<string, Map<string, typeof lines[number]>>();
  for (const l of lines) {
    const [base, col] = l.line.split(".");
    const m = rowsByBase.get(base) ?? new Map();
    m.set(col, l);
    rowsByBase.set(base, m);
  }

  return (
    <>
      <PageHeader title="California / Texas state split" subtitle="Part-year resident Form 540NR, Schedule CA(540NR) columns." />

      <Section title="Residency timeline">
        <div className="ss-timeline">
          {index.packet.household.residency.map((r, i) => (
            <Card key={i} className="ss-timeline-card">
              <StatusBadge status={r.state === "CA" ? "adjustment" : "info"}>{r.state}</StatusBadge>
              <span>{fmtDate(r.from)} – {r.to ? fmtDate(r.to) : "present"}</span>
              <span className="muted">{r.status}</span>
            </Card>
          ))}
        </div>
      </Section>

      {caWagesCheck && caWagesCheck.status === "fail" && (
        <Section title="Flagged">
          <Card className="ss-flag-card">
            <StatusBadge status="blocking">CA-source wages</StatusBadge>
            <div>
              <strong>{caWagesCheck.title}</strong>
              <p>{caWagesCheck.actual}</p>
            </div>
          </Card>
        </Section>
      )}

      <Section title="Schedule CA(540NR), Part II" subtitle="A = federal amount · B = CA subtractions · C = CA additions · D = total using CA law · E = California-source amount">
        <Card>
          <table className="datatable">
            <thead><tr><th>Line</th><th className="num">A: Federal</th><th className="num">B: CA subtractions</th><th className="num">C: CA additions</th><th className="num">D: Total (CA law)</th><th className="num">E: California amount</th></tr></thead>
            <tbody>
              {ROW_BASES.map((base) => {
                const cols = rowsByBase.get(base);
                if (!cols) return null;
                const anyLine = [...cols.values()][0];
                return (
                  <tr key={base}>
                    <td>{anyLine.label.replace(" - federal", "")}</td>
                    {(["A", "B", "C", "D", "E"] as const).map((col) => {
                      const l = cols.get(col);
                      return (
                        <td key={col} className={`num${l ? " clickable" : ""}`} onClick={() => l && useUiStore.getState().openTrace(l.key)}>
                          {l ? fmtMoney(l.value as number) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="California itemized deductions" subtitle="No SALT cap under California law.">
        <Card>
          {(() => {
            const l = rowsByBase.get("A")?.get("itemized");
            return <div className="ss-itemized"><span>California itemized deductions</span><strong className="num">{l ? fmtMoney(l.value as number) : "—"}</strong></div>;
          })()}
        </Card>
      </Section>
    </>
  );
}
