import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { useUiStore } from "../store/uiStore";
import { fmtMoney } from "../data/index";
import { fmtLineValue, computeVariance } from "../data/lineFormat";
import { computeFromSources, computeFromInputs } from "../data/lineRecompute";
import { EvidenceRefs } from "./EvidenceRefs";
import { EventTimeline } from "./EventTimeline";
import { SourceChip } from "./SourceChip";
import { StatusBadge } from "./StatusBadge";
import type { ReturnLine } from "../types/packet";
import "./TraceDrawer.css";

function NoteWithDocLinks({ text }: { text: string }) {
  const navigate = useNavigate();
  const parts = text.split(/(D\d+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^D\d+$/.test(part) ? (
          <button
            key={i}
            className="trace-note-doclink"
            onClick={() => {
              useUiStore.getState().closeTrace();
              navigate(`/documents/${part}`);
            }}
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ExplainVariance({ line }: { line: ReturnLine }) {
  const { appendEvent, derived } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const explanations = (derived.byTarget.get(line.key) ?? []).filter(
    (e) => e.type === "review_note" && (e.payload.body ?? "").startsWith("Prior-year variance explained")
  );

  if (!open) {
    return (
      <div className="trace-variance-action">
        {explanations.length > 0 && <StatusBadge status="verified">variance explained</StatusBadge>}
        <button className="btn btn--sm" onClick={() => setOpen(true)}>Explain variance</button>
      </div>
    );
  }
  return (
    <div className="inline-form">
      <input
        placeholder="Why did this change from last year? (required step: 'Prior-year variances explained')"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ flex: 1 }}
      />
      <button
        className="btn btn--sm btn--primary"
        disabled={!text.trim()}
        onClick={() =>
          void appendEvent({
            type: "review_note",
            target: { kind: "line", id: line.key, label: line.label },
            payload: { severity: "info", body: `Prior-year variance explained: ${text.trim()}` },
          }).then(() => {
            setText("");
            setOpen(false);
          })
        }
      >
        Record
      </button>
      <button className="btn btn--sm" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
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
    const rule = current?.rule ? index.packet.engine_reference.rules[current.rule] : undefined;
    const inputs = (current?.inputs ?? []).map((k) => ({ key: k, line: index.linesByVersionKey.get("v3")?.get(k) }));
    const recompute = current ? computeFromSources(index, current) ?? computeFromInputs(index, current) : null;
    const standards = index.packet.firm.starter_standards.variance_review;
    const variance = current ? computeVariance(current.value, priorYearValue, standards.flag_if_change_over_percent, standards.and_over_amount) : null;
    const evSourceIds = (current?.sources ?? []).filter((s) => s.startsWith("ev-"));
    const otherSourceIds = (current?.sources ?? []).filter((s) => !s.startsWith("ev-"));
    return { v1, v2, v3, current, priorYearValue, rule, inputs, recompute, variance, evSourceIds, otherSourceIds };
  }, [index, openTraceKey]);

  if (!openTraceKey || !data || !data.current) return null;
  const { current, v1, v2, v3, priorYearValue, rule, inputs, recompute, variance, evSourceIds, otherSourceIds } = data;

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
              <div className="trace-versions__cell"><span>2024 (prior year)</span><strong className="num">{fmtLineValue(priorYearValue)}</strong></div>
              <div className={`trace-versions__cell ${!v1 ? "trace-versions__cell--empty" : ""}`}><span>v1</span><strong className="num">{fmtLineValue(v1?.value)}</strong></div>
              <div className={`trace-versions__cell ${!v2 ? "trace-versions__cell--empty" : ""}`}><span>v2</span><strong className="num">{fmtLineValue(v2?.value)}</strong></div>
              <div className="trace-versions__cell trace-versions__cell--current"><span>v3 (current)</span><strong className="num">{fmtLineValue(v3?.value)}</strong></div>
            </div>
            {variance?.flagged && (
              <div className="trace-variance">
                <StatusBadge status="open">
                  &gt;10% &amp; $1,000 change from 2024 ({variance.amountChange! >= 0 ? "+" : ""}{fmtMoney(variance.amountChange!)}, {variance.pctChange!.toFixed(0)}%)
                </StatusBadge>
                <ExplainVariance line={current} />
              </div>
            )}
          </section>

          {recompute && (
            <section className="trace-block">
              <h4>How it's built</h4>
              <p
                className={`trace-recompute ${
                  !recompute.matches ? "trace-recompute--mismatch" : recompute.declared ? "trace-recompute--match" : "trace-recompute--neutral"
                }`}
              >
                {recompute.terms.map((t, i) => (
                  <span key={i}>
                    {i === 0 ? (t.sign === -1 ? "−" : "") : t.sign === -1 ? " − " : " + "}
                    {fmtLineValue(Math.abs(t.value))}
                  </span>
                ))}
                {" = "}{fmtLineValue(recompute.computed)}{" "}
                {!recompute.matches
                  ? `✗ engine shows ${fmtLineValue(current.value)}`
                  : recompute.declared
                    ? "✓ recomputed"
                    : "reproduced from engine inputs"}
              </p>
              {recompute.note && <p className="trace-recompute__note">{recompute.note}</p>}
            </section>
          )}

          {inputs.length > 0 && (
            <section className="trace-block">
              <h4>Built from</h4>
              <ul className="trace-inputs">
                {inputs.map(({ key, line }) => (
                  <li key={key}>
                    <button className="trace-input-link" onClick={() => useUiStore.getState().openTrace(key)}>
                      <span className="mono">{key}</span>
                      <span>{line?.label ?? key}</span>
                      <strong className="num">{fmtLineValue(line?.value)}</strong>
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

          {(evSourceIds.length > 0 || otherSourceIds.length > 0) && (
            <section className="trace-block">
              <h4>Sources</h4>
              <div className="trace-sources">
                {evSourceIds.map((id) => <SourceChip key={id} evId={id} />)}
              </div>
              {otherSourceIds.length > 0 && (
                <div className="trace-sources__other">
                  <EvidenceRefs refs={otherSourceIds} />
                </div>
              )}
              {current.note && (
                <div className="trace-sources__note">
                  <span className="trace-sources__note-label">Also:</span> <NoteWithDocLinks text={current.note} />
                </div>
              )}
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
