import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, actorById } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge, SeverityBadge, type Severity, type Status } from "../components/StatusBadge";
import { AdjustmentDecision } from "../components/AdjustmentDecision";
import { runIndependentChecks } from "../data/checks/run";
import { computeCheckEffect, computeLiveSchCProfitDelta, checkDecision, checkApprovalState } from "../data/checks/effect";
import { accountedForDocumentIds, fmtDate, fmtDateTime, fmtMoney, visibleDocuments } from "../data/index";
import { latestSignOffStatus } from "../store/fold";
import { computeAreaStats } from "../data/areaStats";
import { computeWorkpaperTotals, type JurisdictionTotals } from "../data/workpaperTotals";
import type { CheckResult } from "../data/checks/types";
import "./Home.css";

function ensureSentence(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

interface OpenItem {
  key: string;
  severity: Severity;
  badgeOverride?: { status: Status; text: string }; // accepted-but-awaiting-approval items replace the severity badge with this
  category: string;
  sentence: string;
  federal: number;
  california: number;
  onClick: () => void;
}

const METRIC_ROWS: { label: string; field: keyof JurisdictionTotals }[] = [
  { label: "AGI", field: "agi" },
  { label: "Total tax", field: "totalTax" },
  { label: "Payments", field: "payments" },
  { label: "Balance due", field: "balanceDue" },
];

function TotalsTable({ title, group }: { title: string; group: { engine: JurisdictionTotals; accepted: JurisdictionTotals; allPending: JurisdictionTotals } }) {
  return (
    <div className="strip-group">
      <span className="strip-group__label">{title}</span>
      <table className="strip-table">
        <thead>
          <tr><th></th><th>Engine v3</th><th>Workpaper (accepted)</th><th>Workpaper (all pending accepted)</th></tr>
        </thead>
        <tbody>
          {METRIC_ROWS.map(({ label, field }) => (
            <tr key={field}>
              <td className="strip-table__row-label">{label}</td>
              <td className="num">{fmtMoney(group.engine[field])}</td>
              <td className={`num${Math.round(group.engine[field]) !== Math.round(group.accepted[field]) ? " strip-table__changed" : ""}`}>{fmtMoney(group.accepted[field])}</td>
              <td className={`num${Math.round(group.accepted[field]) !== Math.round(group.allPending[field]) ? " strip-table__pending" : ""}`}>{fmtMoney(group.allPending[field])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Home() {
  const { index, derived, currentActor, lastVisited, markVisited, asOf } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    markVisited("home");
  }, [markVisited]);

  const liveSchCDelta = useMemo(() => computeLiveSchCProfitDelta(derived), [derived]);
  const checks = useMemo(() => (index ? runIndependentChecks(index, liveSchCDelta) : []), [index, liveSchCDelta]);
  const failedChecks = checks.filter((c) => c.status === "fail");

  const openBlockingNotes = useMemo(() => {
    const resolutions = derived.byType.get("review_note_resolved") ?? [];
    return (derived.byType.get("review_note") ?? []).filter((n) => {
      if (n.payload.severity !== "blocking") return false;
      return !resolutions.some((e) => e.payload.note_event_id === n.id);
    });
  }, [derived]);

  // One ranked list: every failed check that's still open (not yet dismissed, or accepted
  // and fully resolved - approved if it needed approval) plus every open blocking note,
  // sorted by the combined absolute federal + California tax effect, each shown once.
  const openItems: OpenItem[] = useMemo(() => {
    if (!index) return [];
    const items: OpenItem[] = [];
    for (const c of failedChecks) {
      const approval = checkApprovalState(index, derived, c);
      if (!approval.isOpen) continue;
      const effect = computeCheckEffect(index, c);
      items.push({
        key: `check:${c.code}`,
        severity: c.severity,
        badgeOverride:
          approval.decision === "accepted" && approval.needsApproval
            ? { status: "open", text: "Awaiting partner approval" }
            : undefined,
        category: "Check",
        sentence: c.summary,
        federal: effect.federal,
        california: effect.california,
        onClick: () => navigate("/checks"),
      });
    }
    for (const n of openBlockingNotes) {
      items.push({
        key: `note:${n.id}`,
        severity: "blocking",
        category: "Review note",
        sentence: ensureSentence(n.payload.body ?? ""),
        federal: 0,
        california: 0,
        onClick: () => navigate("/review"),
      });
    }
    return items.sort((a, b) => (Math.abs(b.federal) + Math.abs(b.california)) - (Math.abs(a.federal) + Math.abs(a.california)));
  }, [index, derived, failedChecks, openBlockingNotes, navigate]);

  // Partner-only: adjustments a preparer accepted whose combined effect crosses the
  // $1,000 threshold, still waiting on this partner's approval.
  const awaitingMyApproval: CheckResult[] = useMemo(() => {
    if (!index || currentActor.role !== "partner") return [];
    return failedChecks.filter((c) => {
      if (checkDecision(derived, c) !== "accepted") return false;
      const approval = checkApprovalState(index, derived, c);
      return approval.needsApproval && !approval.approved;
    });
  }, [index, derived, failedChecks, currentActor]);

  const unaccountedDocs = useMemo(() => {
    if (!index) return [];
    const evidenceRefs = checks.flatMap((c) => c.evidence);
    const accounted = accountedForDocumentIds(index, evidenceRefs);
    return visibleDocuments(index, asOf).filter((d) => !accounted.has(d.id));
  }, [index, checks, asOf]);

  const openQuestions = useMemo(() => {
    const result: { questionId: string; text: string; to?: string; at: string }[] = [];
    for (const [qid, thread] of derived.questionThreads) {
      if (thread.answers.length === 0) {
        result.push({ questionId: qid, text: thread.question.payload.question_text ?? "", to: thread.question.payload.to, at: thread.question.at });
      }
    }
    return result.sort((a, b) => b.at.localeCompare(a.at));
  }, [derived]);

  const reopenedSignOffs = useMemo(() => {
    const signOffs = derived.byType.get("sign_off") ?? [];
    return signOffs
      .map((e) => ({ event: e, status: latestSignOffStatus(derived, e.target.id, e.payload.level) }))
      .filter((s) => s.status?.event.id === s.event.id && s.status.reopened);
  }, [derived]);

  const prevVisit = lastVisited["home"];
  const sinceLastLooked = useMemo(() => {
    if (!prevVisit) return [];
    return derived.activeEvents.filter((e) => e.realAt > prevVisit && e.actor !== currentActor.staffOrClientId).slice(-10).reverse();
  }, [derived, prevVisit, currentActor]);

  const totals = useMemo(() => (index ? computeWorkpaperTotals(index, derived) : null), [index, derived]);
  const areaStats = useMemo(() => (index ? computeAreaStats(index, derived, checks) : []), [index, derived, checks]);

  if (!index) return null;

  const isClient = currentActor.role === "client";

  return (
    <>
      <PageHeader
        title={`Good to see you, ${currentActor.name.split(" ")[0]}`}
        subtitle={isClient ? "Here's what's open on your return." : `Open items across the Okafor-Lindqvist 2025 workpaper, as of ${fmtDate(asOf)}.`}
      />

      {currentActor.role === "partner" && (
        <Section
          title={`Waiting for your approval (${awaitingMyApproval.length})`}
          subtitle="Accepted adjustments whose combined federal/California effect is over $1,000 - these need your approval before they count toward the workpaper."
        >
          {awaitingMyApproval.length === 0 ? (
            <Card><span className="muted">Nothing waiting on your approval.</span></Card>
          ) : (
            <div className="open-item-list">
              {awaitingMyApproval.map((c) => {
                const effect = computeCheckEffect(index, c);
                return (
                  <Card key={c.code} className="approval-queue-row">
                    <div className="approval-queue-row__head">
                      <span className="open-item-row__category">Check</span>
                      <span className="open-item-row__sentence">{c.summary}</span>
                      <span className="open-item-row__effect num">
                        {effect.federal !== 0 && <span>Fed {fmtMoney(effect.federal)}</span>}
                        {effect.california !== 0 && <span>CA {fmtMoney(effect.california)}</span>}
                      </span>
                    </div>
                    <AdjustmentDecision check={c} />
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {!isClient && totals && (
        <Section title="Engine v3 vs. workpaper">
          <Card className="totals-strip">
            <TotalsTable title="Federal" group={totals.federal} />
            <TotalsTable title="California" group={totals.california} />
            <div className="strip-counts">
              <div className="strip-count">
                <span className="strip-group__label">Accepted so far</span>
                <div className="strip-count__value strip-count__value--accepted">{totals.acceptedCount}</div>
              </div>
              <div className="strip-count">
                <span className="strip-group__label">Pending adjustments</span>
                <div className="strip-count__value">{totals.pendingAdjustments}</div>
              </div>
              <div className="strip-count">
                <span className="strip-group__label">Awaiting approval</span>
                <div className="strip-count__value strip-count__value--awaiting">{totals.awaitingApprovalCount}</div>
              </div>
            </div>
          </Card>
        </Section>
      )}

      {!isClient && (
        <Section title={`Open items (${openItems.length})`} subtitle="Every failed check and open blocking note, ranked by combined federal + California tax effect.">
          {openItems.length === 0 ? (
            <Card><span className="muted">No open items.</span></Card>
          ) : (
            <div className="open-item-list">
              {openItems.map((it) => (
                <Card key={it.key} className="open-item-row" onClick={it.onClick}>
                  {it.badgeOverride ? <StatusBadge status={it.badgeOverride.status}>{it.badgeOverride.text}</StatusBadge> : <SeverityBadge severity={it.severity} />}
                  <span className="open-item-row__category">{it.category}</span>
                  <span className="open-item-row__sentence">{it.sentence}</span>
                  <span className="open-item-row__effect num">
                    {(it.federal !== 0 || it.california !== 0) ? (
                      <>
                        {it.federal !== 0 && <span>Fed {fmtMoney(it.federal)}</span>}
                        {it.california !== 0 && <span>CA {fmtMoney(it.california)}</span>}
                      </>
                    ) : <span className="muted">no tax effect</span>}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {!isClient && unaccountedDocs.length > 0 && (
        <Section title="Unaccounted documents" subtitle="Received, but not landed in a return line, superseded, explained, or cited by a check.">
          <div className="home-grid">
            {unaccountedDocs.map((d) => (
              <Card key={d.id} className="home-card" onClick={() => navigate(`/documents/${d.id}`)}>
                <StatusBadge status="open">no disposition</StatusBadge>
                <h4>{d.title}</h4>
                <p>Received {fmtDate(d.received_at)} - confirm it's accounted for.</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title="Open questions" subtitle="Questions to the client or colleagues that are still waiting on an answer.">
        {openQuestions.length === 0 ? <Card><span className="muted">No open questions.</span></Card> : (
          <div className="home-list">
            {openQuestions.map((q) => (
              <Card key={q.questionId} className="home-row" onClick={() => navigate("/client-portal")}>
                <span>{q.text}</span>
                <span className="muted">to {q.to} · {fmtDateTime(q.at)}</span>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {!isClient && reopenedSignOffs.length > 0 && (
        <Section title="Reopened sign-offs" subtitle="What was signed off changed - the fingerprint no longer matches.">
          <div className="home-list">
            {reopenedSignOffs.map(({ event }) => (
              <Card key={event.id} className="home-row" onClick={() => navigate("/review")}>
                <span>{event.target.label ?? event.target.id} — {event.payload.level} sign-off by {actorById(event.actor).name}</span>
                <StatusBadge status="open">reopened</StatusBadge>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {sinceLastLooked.length > 0 && (
        <Section title="Since you last looked" subtitle={`Activity by others since ${fmtDateTime(prevVisit)}.`}>
          <div className="home-list">
            {sinceLastLooked.map((e) => (
              <Card key={e.id} className="home-row">
                <span>{actorById(e.actor).name} · {e.type.replace(/_/g, " ")} on {e.target.label ?? e.target.id}</span>
                <span className="muted">{fmtDateTime(e.at)}</span>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {!isClient && (
        <Section title="Area status" subtitle="Hours logged vs. budget (estimated from recorded activity), open items, and the return's sign-off state.">
          <Card>
            <table className="datatable">
              <thead>
                <tr><th>Area</th><th className="num">Hours logged / budget</th><th className="num">Open items</th><th>Preparer</th><th>Reviewer</th><th>Partner</th></tr>
              </thead>
              <tbody>
                {areaStats.map((a) => (
                  <tr key={a.key} className="clickable" onClick={() => navigate(`/area/${a.key}`)}>
                    <td>{a.label}</td>
                    <td className="num">{a.hoursLogged}h / {a.budgetHours}h</td>
                    <td className="num">{a.openItems > 0 ? <StatusBadge status="open">{a.openItems}</StatusBadge> : <StatusBadge status="verified">0</StatusBadge>}</td>
                    {a.signOffs.map((s) => (
                      <td key={s.level}>
                        {s.state === "signed" ? <StatusBadge status="verified">signed</StatusBadge>
                          : s.state === "reopened" ? <StatusBadge status="open">reopened</StatusBadge>
                          : <StatusBadge status="neutral">—</StatusBadge>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}
    </>
  );
}
