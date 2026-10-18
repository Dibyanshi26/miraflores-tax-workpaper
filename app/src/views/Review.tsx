import { useMemo, useState } from "react";
import { useStore, actorById } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge, SeverityBadge } from "../components/StatusBadge";
import { AskClientButton } from "../components/AskClientButton";
import { computeFingerprint, latestSignOffStatus } from "../store/fold";
import { fmtDateTime } from "../data/index";
import { canReview, needsPartnerSignOff, DEFAULT_STANDARDS } from "../auth/roles";
import { JUDGMENT_SEEDS } from "../data/judgmentItems";
import { runIndependentChecks } from "../data/checks/run";
import { aggregateAcceptedAdjustments } from "../data/taxEffect";
import "./Review.css";

const RETURN_TARGET = { kind: "filing" as const, id: "return-2025", label: "2025 return" };

export function Review() {
  const { index, derived, currentActor, appendEvent } = useStore();
  const [noteBody, setNoteBody] = useState("");
  const [noteSeverity, setNoteSeverity] = useState<"info" | "blocking">("blocking");
  const [signOffNote, setSignOffNote] = useState("");

  const checks = useMemo(() => (index ? runIndependentChecks(index) : []), [index]);
  const coveredIds = useMemo(() => ["return-2025", ...checks.map((c) => `check:${c.code}`)], [checks]);
  const currentFingerprint = useMemo(() => computeFingerprint(derived, coveredIds), [derived, coveredIds]);

  const allNotes = derived.byType.get("review_note") ?? [];
  const resolutions = derived.byType.get("review_note_resolved") ?? [];
  const notesWithStatus = allNotes.map((n) => {
    const resolved = resolutions.some((e) => e.payload.note_event_id === n.id);
    return { note: n, resolved };
  });
  const openBlocking = notesWithStatus.filter((n) => !n.resolved && n.note.payload.severity === "blocking");

  const accepted = index
    ? aggregateAcceptedAdjustments(index.latestVersion, derived.activeEvents)
    : { federal: { tax: 0, payments: 0 }, california: { tax: 0, payments: 0 }, items: [] };
  // Net balance-due impact (tax moved, less any payment correction) - the figure that
  // actually answers "how much did this move the return," federal and CA each.
  const netFederalEffect = accepted.federal.tax - accepted.federal.payments;
  const netCaliforniaEffect = accepted.california.tax - accepted.california.payments;
  const partnerRequired = needsPartnerSignOff(netFederalEffect, netCaliforniaEffect, DEFAULT_STANDARDS.partnerSignOffThreshold);

  const assignment = index?.packet.firm.assignment_at_start;
  const levels: { level: "preparer" | "reviewer" | "partner"; preparedBy?: string }[] = [
    { level: "preparer" },
    { level: "reviewer", preparedBy: assignment?.preparer },
    { level: "partner", preparedBy: assignment?.preparer },
  ];

  if (!index) return null;

  async function resolveNote(noteId: string, targetId: string) {
    await appendEvent({ type: "review_note_resolved", target: { kind: "note", id: targetId }, payload: { resolution: `Resolved note ${noteId}`, note_event_id: noteId } });
  }

  async function addNote() {
    if (!noteBody.trim()) return;
    await appendEvent({ type: "review_note", target: RETURN_TARGET, payload: { body: noteBody, severity: noteSeverity } });
    setNoteBody("");
  }

  async function signOff(level: "preparer" | "reviewer" | "partner") {
    await appendEvent({
      type: "sign_off",
      target: RETURN_TARGET,
      payload: { level, note: signOffNote, fingerprint: currentFingerprint, covers: coveredIds.map((id) => ({ kind: "check" as const, id })) },
    });
    setSignOffNote("");
  }

  return (
    <>
      <PageHeader title="Review notes & sign-offs" subtitle="Open blocking notes stop filing. A sign-off reopens automatically if what it covered changes." />

      {openBlocking.length > 0 && (
        <div className="review-banner">{openBlocking.length} open blocking note{openBlocking.length > 1 ? "s" : ""} - filing is blocked.</div>
      )}

      <Section
        title="Review notes"
        actions={
          <div className="review-note-form">
            <select value={noteSeverity} onChange={(e) => setNoteSeverity(e.target.value as "info" | "blocking")}>
              <option value="blocking">Blocking</option>
              <option value="info">Info</option>
            </select>
            <input placeholder="New note on the return…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
            <button className="btn btn--sm btn--primary" onClick={() => void addNote()}>Add</button>
          </div>
        }
      >
        <div className="review-note-list">
          {notesWithStatus.length === 0 && <Card><span className="muted">No review notes yet.</span></Card>}
          {notesWithStatus.map(({ note, resolved }) => (
            <Card key={note.id} className="review-note-card">
              {resolved ? <StatusBadge status="verified">Resolved</StatusBadge> : <SeverityBadge severity={note.payload.severity === "blocking" ? "blocking" : "info"} />}
              <div className="review-note-card__body">
                <span>{note.payload.body}</span>
                <span className="muted">{actorById(note.actor).name} · {fmtDateTime(note.at)} · {note.target.label ?? note.target.id}</span>
              </div>
              {!resolved && <button className="btn btn--sm" onClick={() => void resolveNote(note.id, note.target.id)}>Resolve</button>}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Sign-offs" subtitle={partnerRequired ? "Accepted adjustments exceed $1,000 - partner sign-off required before filing." : "Sign-offs cover the return summary and every independent check's current disposition."}>
        <div className="review-signoff-grid">
          {levels.map(({ level, preparedBy }) => {
            const status = latestSignOffStatus(derived, RETURN_TARGET.id, level);
            const blockedSelfReview = preparedBy ? !canReview(currentActor.staffOrClientId, preparedBy) : false;
            return (
              <Card key={level} className="review-signoff-card">
                <h4>{level}</h4>
                {status ? (
                  <>
                    <StatusBadge status={status.reopened ? "open" : "verified"}>{status.reopened ? "reopened" : "signed off"}</StatusBadge>
                    <p className="muted">by {actorById(status.event.actor).name} · {fmtDateTime(status.event.at)}</p>
                  </>
                ) : (
                  <StatusBadge status="neutral">not yet signed</StatusBadge>
                )}
                {level === "partner" && partnerRequired && <p className="review-required-note">Required: adjustments exceed the $1,000 threshold.</p>}
                {blockedSelfReview && <p className="review-blocked-note">Blocked: you prepared this work and can't review your own.</p>}
                {(!status || status.reopened) && !blockedSelfReview && (
                  <button className="btn btn--sm btn--primary" onClick={() => void signOff(level)}>Sign off as {currentActor.name}</button>
                )}
              </Card>
            );
          })}
        </div>
        <input className="review-signoff-input" placeholder="Sign-off note (optional)" value={signOffNote} onChange={(e) => setSignOffNote(e.target.value)} />
      </Section>

      <Section title="Judgment & completeness items" subtitle="No engine fix needed, but these must be on record.">
        <JudgmentList />
      </Section>
    </>
  );
}

function JudgmentList() {
  const { derived, appendEvent } = useStore();
  return (
    <div className="review-note-list">
      {JUDGMENT_SEEDS.map((j) => {
        const recorded = (derived.byTarget.get(`judgment:${j.code}`) ?? []).some((e) => e.type === "judgment");
        return (
          <Card key={j.code} className="review-note-card">
            <StatusBadge status={recorded ? "verified" : "open"}>{recorded ? "recorded" : "pending"}</StatusBadge>
            <div className="review-note-card__body">
              <span>{j.title}</span>
              <span className="muted">{j.body}</span>
              {j.authority && <span className="muted">Authority: {j.authority}</span>}
            </div>
            {!recorded && (
              <button
                className="btn btn--sm"
                onClick={() =>
                  void appendEvent({
                    type: "judgment",
                    target: { kind: "other", id: `judgment:${j.code}`, label: j.title },
                    payload: { body: j.body, authority: j.authority, evidence_refs: j.evidence },
                  })
                }
              >
                Record
              </button>
            )}
            {j.needsClientInput && <AskClientButton target={{ kind: "other", id: `judgment:${j.code}`, label: j.title }} defaultText={j.body} />}
          </Card>
        );
      })}
    </div>
  );
}
