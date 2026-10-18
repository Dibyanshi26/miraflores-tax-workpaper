import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge, SeverityBadge } from "../components/StatusBadge";
import { EvidenceRefs } from "../components/EvidenceRefs";
import { AskClientButton } from "../components/AskClientButton";
import { runIndependentChecks } from "../data/checks/run";
import type { CheckResult } from "../data/checks/types";
import { computeCheckEffect, checkDecision, checkTargetId, computeLiveSchCProfitDelta } from "../data/checks/effect";
import { fmtMoney } from "../data/index";
import { AREA_LABELS } from "../data/areaClassifier";
import "./Checks.css";


function CheckCard({ check }: { check: CheckResult }) {
  const { index, appendEvent, derived } = useStore();
  const [open, setOpen] = useState(false);
  if (!index) return null;

  const targetId = checkTargetId(check);
  const decision = checkDecision(derived, check);
  const effects = computeCheckEffect(index, check);

  async function decide(status: "accepted" | "rejected") {
    if (check.manualEffect) {
      await appendEvent({
        type: "adjustment",
        target: { kind: "check", id: targetId, label: check.title },
        payload: {
          amount: effects.federal, category: check.effectKind === "payments" ? "manual_payments" : "manual",
          reason: check.explanation, status, evidence_refs: check.evidence,
          tax_effect_federal: effects.federal, tax_effect_california: effects.california,
        },
      });
      return;
    }
    if (check.whatIfId) {
      await appendEvent({
        type: "adjustment",
        target: { kind: "check", id: targetId, label: check.title },
        payload: {
          amount: effects.federal, category: "what_if", what_if_id: check.whatIfId, reason: check.explanation, status, evidence_refs: check.evidence,
          tax_effect_federal: effects.federal, tax_effect_california: effects.california,
        },
      });
      return;
    }
    for (const adj of check.proposedAdjustments) {
      await appendEvent({
        type: "adjustment",
        target: { kind: "check", id: targetId, label: check.title },
        payload: { amount: adj.amount, category: adj.category, reason: check.explanation, status, evidence_refs: check.evidence, extra: { caSourceOnly: adj.caSourceOnly ?? false } },
      });
    }
    if (check.proposedAdjustments.length === 0) {
      await appendEvent({ type: "adjustment", target: { kind: "check", id: targetId, label: check.title }, payload: { amount: 0, category: "none", reason: check.explanation, status, evidence_refs: check.evidence } });
    }
  }

  return (
    <Card className="check-card">
      <div className="check-card__head" onClick={() => setOpen((v) => !v)}>
        <div className="check-card__title-row">
          {check.status === "pass" ? <StatusBadge status="verified">Passed</StatusBadge> : <SeverityBadge severity={check.severity} />}
          <h4>{check.title}</h4>
        </div>
        {check.status === "fail" && (
          <div className="check-card__effect num">
            {effects.federal !== 0 && <span>Fed {fmtMoney(effects.federal)}</span>}
            {effects.california !== 0 && <span>CA {fmtMoney(effects.california)}</span>}
          </div>
        )}
      </div>

      {open && (
        <div className="check-card__body">
          <div className="check-card__compare">
            <div>
              <span className="check-card__label">Expected</span>
              <p>{check.expected}</p>
            </div>
            <div>
              <span className="check-card__label">Actual (engine)</span>
              <p>{check.actual}</p>
            </div>
          </div>
          <p className="check-card__explanation">{check.explanation}</p>
          {check.evidence.length > 0 && (
            <div className="check-card__evidence">
              <span className="check-card__label">Evidence</span>
              <EvidenceRefs refs={check.evidence} />
            </div>
          )}
          {check.proposedAdjustments.length > 0 && (
            <div className="check-card__adjustments">
              <span className="check-card__label">Proposed adjustment{check.proposedAdjustments.length > 1 ? "s" : ""}</span>
              <ul>
                {check.proposedAdjustments.map((a, i) => <li key={i}>{a.label}</li>)}
              </ul>
            </div>
          )}
          {check.status === "fail" && (
            <div className="check-card__decision">
              {decision !== "pending" ? (
                <StatusBadge status={decision === "accepted" ? "verified" : "neutral"}>
                  {decision === "accepted" ? "Adjustment accepted" : "Dismissed"}
                </StatusBadge>
              ) : (
                <>
                  <button className="btn btn--sm btn--primary" onClick={() => void decide("accepted")}>Accept adjustment</button>
                  <button className="btn btn--sm" onClick={() => void decide("rejected")}>Dismiss</button>
                </>
              )}
              {check.needsClientInput && <AskClientButton target={{ kind: "check", id: targetId, label: check.title }} defaultText={check.summary} />}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function Checks() {
  const { index, derived } = useStore();
  const [filter, setFilter] = useState<"all" | "fail" | "pass">("fail");

  const liveSchCDelta = useMemo(() => computeLiveSchCProfitDelta(derived), [derived]);

  const checks = useMemo(() => (index ? runIndependentChecks(index, liveSchCDelta) : []), [index, liveSchCDelta]);
  const failed = checks.filter((c) => c.status === "fail");
  const passed = checks.filter((c) => c.status === "pass");
  const shown = filter === "fail" ? failed : filter === "pass" ? passed : checks;

  const byArea = useMemo(() => {
    const map = new Map<string, CheckResult[]>();
    for (const c of shown) {
      const arr = map.get(c.area) ?? [];
      arr.push(c);
      map.set(c.area, arr);
    }
    return map;
  }, [shown]);

  return (
    <>
      <PageHeader
        title="Independent checks"
        subtitle="Code that recomputes from documents, extracted values and agency records - it does not trust the engine's return_versions output."
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            <button className={`btn btn--sm ${filter === "fail" ? "btn--primary" : ""}`} onClick={() => setFilter("fail")}>Failed ({failed.length})</button>
            <button className={`btn btn--sm ${filter === "pass" ? "btn--primary" : ""}`} onClick={() => setFilter("pass")}>Passed ({passed.length})</button>
            <button className={`btn btn--sm ${filter === "all" ? "btn--primary" : ""}`} onClick={() => setFilter("all")}>All ({checks.length})</button>
          </div>
        }
      />
      {[...byArea.entries()].map(([area, items]) => (
        <Section key={area} title={AREA_LABELS[area] ?? area.replace(/_/g, " ")}>
          <div className="check-list">
            {items.map((c) => <CheckCard key={c.code} check={c} />)}
          </div>
        </Section>
      ))}
    </>
  );
}
