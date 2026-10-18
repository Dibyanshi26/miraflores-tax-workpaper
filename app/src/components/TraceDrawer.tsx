import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { useUiStore } from "../store/uiStore";
import { fmtMoney } from "../data/index";
import { EvidenceRefs } from "./EvidenceRefs";
import { EventTimeline } from "./EventTimeline";
import type { ReturnLine } from "../types/packet";
import "./TraceDrawer.css";

function displayValue(l: ReturnLine | undefined): string {
  if (!l) return "—";
  if (typeof l.value === "number") return l.value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return String(l.value);
}

export function TraceDrawer() {
  const { openTraceKey, closeTrace } = useUiStore();
  const { index } = useStore();

  const data = useMemo(() => {
    if (!index || !openTraceKey) return null;
    const v1 = index.linesByVersionKey.get("v1")?.get(openTraceKey);
    const v2 = index.linesByVersionKey.get("v2")?.get(openTraceKey);
    const v3 = index.linesByVersionKey.get("v3")?.get(openTraceKey);
    const current = v3 ?? v2 ?? v1;
    const priorYearValue = index.packet.prior_years.return_2024.lines[openTraceKey];
    const priorYearLabel = index.packet.prior_years.return_2024.line_labels[openTraceKey];
    const rule = current?.rule ? index.packet.engine_reference.rules[current.rule] : undefined;
    const inputs = (current?.inputs ?? []).map((k) => ({ key: k, line: index.linesByVersionKey.get("v3")?.get(k) }));
    return { v1, v2, v3, current, priorYearValue, priorYearLabel, rule, inputs };
  }, [index, openTraceKey]);

  if (!openTraceKey || !data || !data.current) return null;
  const { current, v1, v2, v3, priorYearValue, rule, inputs } = data;

  return (
    <div className="trace-backdrop" onClick={closeTrace}>
      <aside className="trace-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="trace-drawer__head">
          <div>
            <div className="trace-drawer__key mono">{current.key} · {current.form} line {current.line}</div>
            <h3>{current.label}</h3>
          </div>
          <button className="btn btn--sm" onClick={closeTrace}>Close</button>
        </header>

        <div className="trace-drawer__body">
          <section className="trace-block">
            <h4>Value across versions</h4>
            <div className="trace-versions">
              <div className="trace-versions__cell"><span>2024 (prior year)</span><strong className="num">{typeof priorYearValue === "number" ? fmtMoney(priorYearValue) : (priorYearValue ?? "—")}</strong></div>
              <div className={`trace-versions__cell ${!v1 ? "trace-versions__cell--empty" : ""}`}><span>v1</span><strong className="num">{v1 ? displayValue(v1) : "—"}</strong></div>
              <div className={`trace-versions__cell ${!v2 ? "trace-versions__cell--empty" : ""}`}><span>v2</span><strong className="num">{v2 ? displayValue(v2) : "—"}</strong></div>
              <div className="trace-versions__cell trace-versions__cell--current"><span>v3 (current)</span><strong className="num">{v3 ? displayValue(v3) : "—"}</strong></div>
            </div>
          </section>

          {inputs.length > 0 && (
            <section className="trace-block">
              <h4>Built from</h4>
              <ul className="trace-inputs">
                {inputs.map(({ key, line }) => (
                  <li key={key}>
                    <button className="trace-input-link" onClick={() => useUiStore.getState().openTrace(key)}>
                      <span className="mono">{key}</span>
                      <span>{line?.label ?? key}</span>
                      <strong className="num">{line ? displayValue(line) : "—"}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rule && (
            <section className="trace-block">
              <h4>Rule applied: {current.rule}</h4>
              <p className="trace-rule">{rule}</p>
            </section>
          )}

          {current.note && (
            <section className="trace-block">
              <h4>Engine note</h4>
              <p className="trace-rule">{current.note}</p>
            </section>
          )}

          {(current.sources?.length ?? 0) > 0 && (
            <section className="trace-block">
              <h4>Sources</h4>
              <EvidenceRefs refs={current.sources!} />
            </section>
          )}

          <section className="trace-block">
            <h4>Verifications, adjustments, notes</h4>
            <EventTimeline target={{ kind: "line", id: current.key, label: current.label }} />
          </section>
        </div>
      </aside>
    </div>
  );
}
