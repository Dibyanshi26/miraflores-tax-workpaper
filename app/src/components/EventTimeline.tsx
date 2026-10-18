import { useState } from "react";
import { useStore, actorById } from "../store/useStore";
import type { TargetRef, VerificationType, WorkpaperEvent } from "../types/domain";
import { fmtDateTime } from "../data/index";
import { computeFingerprint } from "../store/fold";
import { EvidenceRefs } from "./EvidenceRefs";
import "./EventTimeline.css";

const VERIFICATION_LABELS: Record<VerificationType, string> = {
  agreed_to_source_document: "Agreed to source document",
  recalculated: "Recalculated",
  confirmed_with_client: "Confirmed with client",
  agreed_to_prior_year: "Agreed to prior year",
  agreed_to_third_party_record: "Agreed to third-party record",
};

function EventRow({ event }: { event: WorkpaperEvent }) {
  const actor = actorById(event.actor);
  const p = event.payload;
  let summary = "";
  switch (event.type) {
    case "verification": summary = `verified — ${VERIFICATION_LABELS[p.verification_type ?? "recalculated"]}${p.note ? `: "${p.note}"` : ""}`; break;
    case "adjustment": summary = `${p.status === "rejected" ? "rejected" : p.status === "withdrawn" ? "withdrew" : "recorded"} adjustment${p.amount !== undefined ? ` of ${p.amount.toLocaleString()}` : ""}${p.reason ? ` — ${p.reason}` : ""}`; break;
    case "review_note": summary = `${p.severity === "blocking" ? "blocking" : "info"} note: "${p.body}"`; break;
    case "review_note_resolved": summary = `resolved note${p.resolution ? `: "${p.resolution}"` : ""}`; break;
    case "question": summary = `asked: "${p.question_text}"`; break;
    case "answer": summary = `answered: "${p.answer_text}"`; break;
    case "sign_off": summary = `signed off (${p.level})${p.note ? ` — "${p.note}"` : ""}`; break;
    case "sign_off_reopened": summary = `sign-off reopened — ${p.reopen_reason ?? "underlying data changed"}`; break;
    case "judgment": summary = `judgment: "${p.body ?? p.note ?? ""}" (authority: ${p.authority ?? "none cited"})`; break;
    case "attachment": summary = `attached ${p.file_name ?? "a file"}${p.description ? `: ${p.description}` : ""}`; break;
    case "assignment": summary = `assigned to ${p.assignee}${p.due_date ? ` by ${p.due_date}` : ""}`; break;
    case "filing": summary = `${p.filing_event} (${p.jurisdiction})`; break;
    case "view_log": summary = `viewed unmasked ${p.field}`; break;
    case "standards_change": summary = "updated firm standards"; break;
    case "bulk_action": summary = `bulk action over ${p.child_event_ids?.length ?? 0} items`; break;
    default: summary = event.type;
  }
  return (
    <div className="event-row">
      <div className="event-row__meta">
        <span className="event-row__actor">{actor.name}</span>
        <span className="event-row__time">{fmtDateTime(event.at)}</span>
      </div>
      <div className="event-row__summary">{summary}</div>
      {p.evidence_refs && p.evidence_refs.length > 0 && <EvidenceRefs refs={p.evidence_refs} />}
    </div>
  );
}

export function EventTimeline({ target, compact = false }: { target: TargetRef; compact?: boolean }) {
  const { derived, currentActor, appendEvent } = useStore();
  const [mode, setMode] = useState<null | "verify" | "adjust" | "note" | "question">(null);
  const events = (derived.byTarget.get(target.id) ?? []).filter((e) => !["view_log"].includes(e.type) || !compact);

  return (
    <div className="event-timeline">
      {!compact && (
        <div className="event-timeline__actions">
          <button className="btn btn--sm" onClick={() => setMode(mode === "verify" ? null : "verify")}>Verify</button>
          <button className="btn btn--sm" onClick={() => setMode(mode === "adjust" ? null : "adjust")}>Adjust</button>
          <button className="btn btn--sm" onClick={() => setMode(mode === "note" ? null : "note")}>Note</button>
          <button className="btn btn--sm" onClick={() => setMode(mode === "question" ? null : "question")}>Ask</button>
        </div>
      )}

      {mode === "verify" && (
        <VerifyForm
          onSubmit={async (verification_type, note) => {
            await appendEvent({ type: "verification", target, payload: { verification_type, note } });
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === "adjust" && (
        <AdjustForm
          onSubmit={async (amount, category, reason) => {
            await appendEvent({ type: "adjustment", target, payload: { amount, category, reason, status: "proposed" } });
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === "note" && (
        <NoteForm
          onSubmit={async (body, severity) => {
            await appendEvent({ type: "review_note", target, payload: { body, severity } });
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === "question" && (
        <QuestionForm
          onSubmit={async (question_text, to) => {
            await appendEvent({ type: "question", target, payload: { question_text, to } });
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      )}

      <div className="event-timeline__list">
        {events.length === 0 && <div className="event-timeline__empty">No activity yet.</div>}
        {[...events].reverse().map((e) => <EventRow key={e.id} event={e} />)}
      </div>
      <div className="event-timeline__you">Recording as {currentActor.name} ({currentActor.role.replace(/_/g, " ")})</div>
    </div>
  );
}

function VerifyForm({ onSubmit, onCancel }: { onSubmit: (t: VerificationType, note: string) => void; onCancel: () => void }) {
  const [type, setType] = useState<VerificationType>("agreed_to_source_document");
  const [note, setNote] = useState("");
  return (
    <div className="inline-form">
      <select value={type} onChange={(e) => setType(e.target.value as VerificationType)}>
        {Object.entries(VERIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn--sm btn--primary" onClick={() => onSubmit(type, note)}>Record</button>
      <button className="btn btn--sm" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function AdjustForm({ onSubmit, onCancel }: { onSubmit: (amount: number, category: string, reason: string) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("adjustment");
  const [reason, setReason] = useState("");
  return (
    <div className="inline-form">
      <input placeholder="Amount (signed)" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 110 }} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {["wages", "interest", "schc_profit", "stcg", "ltcg", "ordinary_income", "adjustment", "salt", "itemized", "ca_source_income"].map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1 }} />
      <button className="btn btn--sm btn--primary" disabled={!amount} onClick={() => onSubmit(Number(amount), category, reason)}>Record</button>
      <button className="btn btn--sm" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function NoteForm({ onSubmit, onCancel }: { onSubmit: (body: string, severity: "info" | "blocking") => void; onCancel: () => void }) {
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "blocking">("info");
  return (
    <div className="inline-form">
      <select value={severity} onChange={(e) => setSeverity(e.target.value as "info" | "blocking")}>
        <option value="info">Info note</option>
        <option value="blocking">Blocking note (blocks filing)</option>
      </select>
      <input placeholder="Note" value={body} onChange={(e) => setBody(e.target.value)} style={{ flex: 1 }} />
      <button className="btn btn--sm btn--primary" disabled={!body} onClick={() => onSubmit(body, severity)}>Add note</button>
      <button className="btn btn--sm" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function QuestionForm({ onSubmit, onCancel }: { onSubmit: (text: string, to: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [to, setTo] = useState("client");
  return (
    <div className="inline-form">
      <select value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="client">Client</option>
        <option value="st-01">Priya (preparer)</option>
        <option value="st-02">Daniel (reviewer)</option>
        <option value="st-03">Helen (partner)</option>
      </select>
      <input placeholder="Question" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
      <button className="btn btn--sm btn--primary" disabled={!text} onClick={() => onSubmit(text, to)}>Ask</button>
      <button className="btn btn--sm" onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function buildSignOffFingerprint(targetIds: string[], derived: ReturnType<typeof useStore.getState>["derived"]) {
  return computeFingerprint(derived, targetIds);
}
