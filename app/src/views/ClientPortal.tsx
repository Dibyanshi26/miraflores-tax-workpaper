import { useMemo, useState } from "react";
import { useStore, actorById } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { fmtDate, fmtDateTime } from "../data/index";
import "./ClientPortal.css";

const PORTAL_TARGET = { kind: "other" as const, id: "client-portal", label: "Client portal" };

function QuestionThread({ questionId }: { questionId: string }) {
  const { derived, currentActor, appendEvent } = useStore();
  const [answerText, setAnswerText] = useState("");
  const thread = derived.questionThreads.get(questionId);
  if (!thread) return null;
  const { question, answers } = thread;
  const answered = answers.length > 0;
  const isClient = currentActor.role === "client";

  return (
    <Card className="portal-qa">
      <div className="portal-question-head">
        <StatusBadge status={answered ? "verified" : "open"}>{answered ? "answered" : "open"}</StatusBadge>
        <span className="muted">re: {question.target.label ?? question.target.id}</span>
      </div>
      <strong>{question.payload.question_text}</strong>
      <span className="muted">asked by {actorById(question.actor).name} · {fmtDateTime(question.at)}</span>
      {answers.map((a) => (
        <p key={a.id} className="portal-answer">{a.payload.answer_text} <span className="muted">— {actorById(a.actor).name}, {fmtDateTime(a.at)}</span></p>
      ))}
      {!answered && isClient && (
        <div className="portal-answer-form">
          <input placeholder="Type your answer…" value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
          <button
            className="btn btn--sm btn--primary"
            disabled={!answerText.trim()}
            onClick={() =>
              void appendEvent({ type: "answer", target: question.target, payload: { answer_text: answerText, question_event_id: question.id } }).then(() => setAnswerText(""))
            }
          >
            Send
          </button>
        </div>
      )}
    </Card>
  );
}

export function ClientPortal() {
  const { index, derived, currentActor, appendEvent } = useStore();
  const isClient = currentActor.role === "client";

  const approvalEvent = useMemo(() => (derived.byType.get("filing") ?? []).find((e) => e.payload.filing_event === "client_approved"), [derived]);
  const questionIds = useMemo(() => {
    // Open threads first (most actionable), then answered ones, each newest first.
    const ids = [...derived.questionThreads.keys()];
    return ids.sort((a, b) => {
      const ta = derived.questionThreads.get(a)!, tb = derived.questionThreads.get(b)!;
      const aOpen = ta.answers.length === 0, bOpen = tb.answers.length === 0;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return tb.question.at.localeCompare(ta.question.at);
    });
  }, [derived]);

  if (!index) return null;

  async function approve() {
    await appendEvent({ type: "filing", target: PORTAL_TARGET, payload: { filing_event: "client_approved", jurisdiction: "federal" } });
  }

  return (
    <>
      <PageHeader title="Client portal" subtitle={isClient ? "Questions, documents, and your e-file approval." : "What the client sees: questions, uploads, and 8879 approval."} />

      <Section title="8879 e-file approval">
        <Card className="portal-approval">
          {approvalEvent ? (
            <>
              <StatusBadge status="verified">Approved</StatusBadge>
              <span>Approved by {actorById(approvalEvent.actor).name} on {fmtDateTime(approvalEvent.at)}</span>
            </>
          ) : (
            <>
              <StatusBadge status="open">Awaiting client approval</StatusBadge>
              {isClient && <button className="btn btn--sm btn--primary" onClick={() => void approve()}>Approve & sign Form 8879</button>}
            </>
          )}
        </Card>
      </Section>

      <Section title="Questions" subtitle="Everything we've asked you, wherever it came up in the file - answering here becomes evidence.">
        {questionIds.length === 0 ? <Card><span className="muted">No questions yet.</span></Card> : (
          <div className="portal-list">
            {questionIds.map((qid) => <QuestionThread key={qid} questionId={qid} />)}
          </div>
        )}
      </Section>

      <Section title="Questionnaire on file">
        <div className="portal-list">
          {index.packet.client.questionnaire.map((q) => (
            <Card key={q.id} id={q.id} className="portal-qa">
              <strong>{q.question}</strong>
              <p>{q.answer}</p>
              <span className="muted">{q.answered_by} · {fmtDate(q.answered_at)}</span>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Messages">
        <div className="portal-list">
          {index.packet.client.messages.map((m) => (
            <Card key={m.id} id={m.id} className="portal-qa">
              <strong>{m.from} → {m.to}</strong>
              <p>{m.text}</p>
              <span className="muted">{fmtDateTime(m.sent_at)}</span>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Call notes">
        <div className="portal-list">
          {index.packet.client.call_notes.map((c) => (
            <Card key={c.id} id={c.id} className="portal-qa">
              <strong>{fmtDate(c.date)} · {c.participants.join(", ")}</strong>
              <ul>{c.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
