import { useMemo, useState } from "react";
import { useStore, actorById } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { fmtDateTime, fmtDate } from "../data/index";
import { DEFAULT_STANDARDS } from "../auth/roles";
import { computeAreaStats } from "../data/areaStats";
import { runIndependentChecks } from "../data/checks/run";
import "./FirmAdmin.css";

export function FirmAdmin() {
  const { index, derived, currentActor, appendEvent } = useStore();
  const [threshold, setThreshold] = useState(String((derived.standardsOverrides as { partnerSignOffThreshold?: number }).partnerSignOffThreshold ?? DEFAULT_STANDARDS.partnerSignOffThreshold));

  const viewLogs = useMemo(() => [...derived.viewLogs].reverse(), [derived]);
  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);
  const areaStats = useMemo(() => (index ? computeAreaStats(index, derived, checks) : []), [index, derived, checks]);

  if (!index) return null;

  const allowed = currentActor.role === "firm_admin" || currentActor.role === "partner";
  if (!allowed) {
    return <PageHeader title="Firm admin" subtitle="Restricted to firm admin and partner roles." />;
  }

  async function saveThreshold() {
    await appendEvent({
      type: "standards_change",
      target: { kind: "other", id: "standards", label: "Firm standards" },
      payload: { standards_patch: { partnerSignOffThreshold: Number(threshold) } },
    });
  }

  return (
    <>
      <PageHeader title="Firm admin" subtitle="Standards, staff & clearance, access log, time vs. budget." />

      <Section title="Standards editor" subtitle="A starting point - firm admins may change these.">
        <Card className="fa-standards">
          <div className="fa-standards__row">
            <label>Partner sign-off threshold (federal or CA tax effect, $)</label>
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ width: 100 }} />
            <button className="btn btn--sm btn--primary" onClick={() => void saveThreshold()}>Save</button>
          </div>
          <ul className="fa-rules">
            {index.packet.firm.starter_standards.rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </Card>
      </Section>

      <Section title="Staff & clearance">
        <Card>
          <table className="datatable">
            <thead><tr><th>Name</th><th>Role</th><th>Credential</th><th>Clearance</th><th>Active from</th></tr></thead>
            <tbody>
              {index.packet.firm.staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="muted">{s.role.replace(/_/g, " ")}</td>
                  <td className="muted">{s.credential ?? "—"}</td>
                  <td>{s.sensitive_data_clearance ? <StatusBadge status="verified">cleared</StatusBadge> : <StatusBadge status="open">masked</StatusBadge>}</td>
                  <td className="muted">{s.active_from ? fmtDate(s.active_from) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Access log" subtitle="Every unmasked reveal of sensitive data is logged.">
        <Card>
          <table className="datatable">
            <thead><tr><th>Who</th><th>What</th><th>When</th></tr></thead>
            <tbody>
              {viewLogs.length === 0 && <tr><td colSpan={3} className="muted">No reveals logged yet.</td></tr>}
              {viewLogs.map((e) => (
                <tr key={e.id}>
                  <td>{actorById(e.actor).name}</td>
                  <td className="mono">{e.payload.field}</td>
                  <td className="muted">{fmtDateTime(e.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Time vs. budget" subtitle="Hours logged (estimated from recorded activity) and open items, per area.">
        <Card>
          <table className="datatable">
            <thead><tr><th>Area</th><th className="num">Hours logged</th><th className="num">Budget</th><th className="num">Open items</th></tr></thead>
            <tbody>
              {areaStats.map((a) => (
                <tr key={a.key}>
                  <td>{a.label}</td>
                  <td className="num">{a.hoursLogged}h</td>
                  <td className="num">{a.budgetHours}h</td>
                  <td className="num">{a.openItems}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </>
  );
}
