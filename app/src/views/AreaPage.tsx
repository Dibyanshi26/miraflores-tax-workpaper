import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge, SeverityBadge } from "../components/StatusBadge";
import { useUiStore } from "../store/uiStore";
import { areaForLine, AREA_LABELS } from "../data/areaClassifier";
import { runIndependentChecks } from "../data/checks/run";
import type { CheckResult } from "../data/checks/types";
import "./AreaPage.css";

export function AreaPage() {
  const { areaKey = "" } = useParams();
  const { index, derived } = useStore();

  const lines = useMemo(() => {
    if (!index) return [];
    return index.latestVersion.lines.filter((l) => areaForLine(l) === areaKey);
  }, [index, areaKey]);

  const checks = useMemo(() => (index ? runIndependentChecks(index).filter((c) => c.area === areaKey) : []), [index, areaKey]);

  const byForm = useMemo(() => {
    const map = new Map<string, typeof lines>();
    for (const l of lines) {
      const arr = map.get(l.form) ?? [];
      arr.push(l);
      map.set(l.form, arr);
    }
    return map;
  }, [lines]);

  if (!index) return null;
  const hours = index.packet.firm.budget_hours[areaKey as keyof typeof index.packet.firm.budget_hours];

  return (
    <>
      <PageHeader title={AREA_LABELS[areaKey] ?? areaKey} subtitle={hours ? `Budget: ${hours}h` : undefined} />

      {checks.length > 0 && (
        <Section title="Checks touching this area">
          <div className="area-checks">
            {checks.map((c: CheckResult) => (
              <Card key={c.code} className="area-check-card">
                {c.status === "pass" ? <StatusBadge status="verified">Passed</StatusBadge> : <SeverityBadge severity={c.severity} />}
                <span>{c.title}</span>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {areaKey === "intake_and_engagement" && <IntakeContent />}

      {[...byForm.entries()].map(([form, items]) => (
        <Section key={form} title={form}>
          <Card>
            <table className="datatable">
              <thead><tr><th>Line</th><th>Label</th><th className="num">Value</th><th>Activity</th></tr></thead>
              <tbody>
                {items.map((l) => {
                  const activity = derived.byTarget.get(l.key) ?? [];
                  return (
                    <tr key={l.key} className="clickable" onClick={() => useUiStore.getState().openTrace(l.key)}>
                      <td className="mono">{l.line}</td>
                      <td>{l.label}</td>
                      <td className="num">{typeof l.value === "number" ? l.value.toLocaleString() : l.value}</td>
                      <td>{activity.length > 0 ? <StatusBadge status="verified">{activity.length} event{activity.length > 1 ? "s" : ""}</StatusBadge> : <span className="muted">none</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Section>
      ))}

      {lines.length === 0 && areaKey !== "intake_and_engagement" && (
        <Card><span className="muted">No return lines classified to this area yet.</span></Card>
      )}
    </>
  );
}

function IntakeContent() {
  const { index } = useStore();
  if (!index) return null;
  const steps = index.packet.firm.starter_standards.required_steps;
  return (
    <Section title="Required steps (firm standard)" subtitle="Edit this list from Firm admin.">
      <Card>
        <ul className="intake-steps">
          {steps.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </Card>
    </Section>
  );
}
