import { useMemo, useState } from "react";
import { useStore, actorById } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { useUiStore } from "../store/uiStore";
import { fmtDateTime, fmtMoney } from "../data/index";
import "./Changes.css";

export function Changes() {
  const { index, derived, asOf } = useStore();
  const [compareFrom, setCompareFrom] = useState("v2");
  const [compareTo, setCompareTo] = useState("v3");

  const compareVersion = index?.versionsByName.get(compareTo);

  const timelineItems = useMemo(() => {
    if (!index) return [];
    const packetEvents = index.packet.timeline.map((t) => ({
      id: t.id, at: t.at, kind: "packet" as const, label: t.event.replace(/_/g, " "), detail: t.detail, refs: t.refs,
    }));
    const workpaperEvents = derived.activeEvents.map((e) => ({
      id: e.id, at: e.at, kind: "workpaper" as const, label: `${e.type.replace(/_/g, " ")} — ${e.target.label ?? e.target.id}`, detail: actorById(e.actor).name, refs: [] as string[],
    }));
    return [...packetEvents, ...workpaperEvents].filter((e) => e.at <= asOf).sort((a, b) => b.at.localeCompare(a.at));
  }, [index, derived, asOf]);

  if (!index || !compareVersion) return null;

  return (
    <>
      <PageHeader title="Changes & versions" subtitle="How the return moved across v1 → v2 → v3, and the season's full timeline." />

      <Section
        title="Version compare"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <select value={compareFrom} onChange={(e) => setCompareFrom(e.target.value)}>
              {index.versionOrder.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="muted" style={{ alignSelf: "center" }}>→</span>
            <select value={compareTo} onChange={(e) => setCompareTo(e.target.value)}>
              {index.versionOrder.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        }
      >
        <Card>
          <div className="changes-meta">
            <span>{compareVersion.trigger}</span>
            <span className="muted">computed {fmtDateTime(compareVersion.computed_at)}</span>
          </div>
          <table className="datatable">
            <thead><tr><th>Line</th><th>Change</th><th className="num">Old</th><th className="num">New</th></tr></thead>
            <tbody>
              {compareVersion.changes_from_previous.length === 0 && (
                <tr><td colSpan={4} className="muted">No changes_from_previous recorded on {compareTo} (comparing {compareFrom} as context only).</td></tr>
              )}
              {compareVersion.changes_from_previous.map((c) => (
                <tr key={c.key} className="clickable" onClick={() => useUiStore.getState().openTrace(c.key)}>
                  <td className="mono">{c.key}</td>
                  <td><StatusBadge status={c.change === "added" ? "verified" : c.change === "removed" ? "blocking" : "open"}>{c.change}</StatusBadge></td>
                  <td className="num">{typeof c.old === "number" ? fmtMoney(c.old) : String(c.old ?? "—")}</td>
                  <td className="num">{typeof c.new === "number" ? fmtMoney(c.new) : String(c.new ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Diagnostics" subtitle={`Engine-raised diagnostics on ${compareTo}.`}>
        <div className="changes-diag-list">
          {compareVersion.diagnostics.map((d, i) => (
            <Card key={i} className="changes-diag-card">
              <StatusBadge status={d.severity === "error" ? "blocking" : d.severity === "warning" ? "open" : "info"}>{d.severity}</StatusBadge>
              <div>
                <strong>{d.code}</strong>
                <p>{d.message}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Full timeline" subtitle={`Packet events and workpaper activity through the as-of clock (${fmtDateTime(asOf)}).`}>
        <div className="changes-timeline">
          {timelineItems.map((e) => (
            <div key={e.id} className={`changes-timeline-row changes-timeline-row--${e.kind}`} id={e.id}>
              <span className="changes-timeline-time">{fmtDateTime(e.at)}</span>
              <span className="changes-timeline-label">{e.label}</span>
              <span className="muted">{e.detail}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
