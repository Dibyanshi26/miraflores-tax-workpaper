import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { useUiStore } from "../store/uiStore";
import { fmtMoney, fmtDate } from "../data/index";
import "./WhatIfs.css";

export function WhatIfs() {
  const { index, derived, appendEvent } = useStore();
  if (!index) return null;

  const alternatives = index.packet.what_if.alternatives;
  const ext = index.packet.what_if.extension;

  return (
    <>
      <PageHeader title="What-ifs" subtitle="Engine-computed alternatives to the current return - accept one from here or from Checks." />

      <Section title="Alternatives">
        <div className="whatif-grid">
          {alternatives.map((alt) => {
            const accepted = (derived.byType.get("adjustment") ?? []).some((e) => e.payload.what_if_id === alt.id && e.payload.status === "accepted");
            return (
              <Card key={alt.id} className="whatif-card">
                <h4>{alt.description}</h4>
                <div className="whatif-compare">
                  <div>
                    <span className="whatif-label">Federal tax change</span>
                    <strong className="num">{fmtMoney(alt.federal.total_tax_change)}</strong>
                  </div>
                  <div>
                    <span className="whatif-label">California tax change</span>
                    <strong className="num">{fmtMoney(alt.california.total_tax_change)}</strong>
                  </div>
                </div>
                <div className="whatif-detail">
                  <span>Federal: AGI {fmtMoney(alt.federal.base.agi ?? 0)} → {fmtMoney(alt.federal.alternative.agi ?? 0)}, balance due {fmtMoney(alt.federal.base.balance_due)} → {fmtMoney(alt.federal.alternative.balance_due)}</span>
                </div>
                <div className="whatif-actions">
                  <button className="btn btn--sm" onClick={() => {
                    const lines = alt.changed_lines.map((c) => c.key).join(", ");
                    alert(`Lines affected:\n${lines}`);
                  }}>
                    {alt.changed_lines.length} lines affected
                  </button>
                  {accepted ? (
                    <span className="muted">Applied to the workpaper</span>
                  ) : (
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={() =>
                        void appendEvent({
                          type: "adjustment",
                          target: { kind: "check", id: `check:${alt.id === "hvac_improvement" ? "HVAC-CAPITALIZE" : alt.id}`, label: alt.description },
                          payload: { amount: alt.federal.total_tax_change, category: "what_if", what_if_id: alt.id, status: "accepted", tax_effect_federal: alt.federal.total_tax_change, tax_effect_california: alt.california.total_tax_change, reason: alt.description },
                        })
                      }
                    >
                      Apply to workpaper
                    </button>
                  )}
                </div>
                <div className="whatif-lines">
                  {alt.changed_lines.slice(0, 6).map((c) => (
                    <button key={c.key} className="whatif-line-chip" onClick={() => useUiStore.getState().openTrace(c.key)}>{c.key}</button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Extension estimate" subtitle={`Computed ${fmtDate(ext.computed_at)} from ${ext.based_on_version}.`}>
        <div className="whatif-grid">
          <Card>
            <h4>Federal</h4>
            <dl className="whatif-dl">
              {Object.entries(ext.federal).map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, " ")}</dt><dd>{typeof v === "number" ? fmtMoney(v) : String(v)}</dd></div>)}
            </dl>
          </Card>
          <Card>
            <h4>California</h4>
            <dl className="whatif-dl">
              {Object.entries(ext.california).map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, " ")}</dt><dd>{typeof v === "number" ? fmtMoney(v) : String(v)}</dd></div>)}
            </dl>
          </Card>
        </div>
      </Section>
    </>
  );
}
