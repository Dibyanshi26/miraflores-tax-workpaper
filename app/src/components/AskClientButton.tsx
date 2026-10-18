import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { StatusBadge } from "./StatusBadge";
import type { TargetRef } from "../types/domain";
import "./AskClientButton.css";

// A small, reused "ask the client" affordance for any check or judgment item flagged
// needsClientInput: true - records a `question` event targeting that item, so it shows
// up in Home's open questions and the Client portal the same way any other question does.
export function AskClientButton({ target, defaultText }: { target: TargetRef; defaultText: string }) {
  const { derived, appendEvent } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(defaultText);

  const hasOpenQuestion = useMemo(() => {
    for (const thread of derived.questionThreads.values()) {
      if (thread.question.target.id === target.id && thread.answers.length === 0) return true;
    }
    return false;
  }, [derived, target.id]);

  if (hasOpenQuestion) return <StatusBadge status="open">Question open with client</StatusBadge>;

  if (!open) {
    return <button className="btn btn--sm" onClick={() => setOpen(true)}>Ask client</button>;
  }
  return (
    <div className="ask-client-form">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
      <div className="ask-client-form__actions">
        <button
          className="btn btn--sm btn--primary"
          onClick={() =>
            void appendEvent({ type: "question", target, payload: { question_text: text, to: "client" } }).then(() => setOpen(false))
          }
        >
          Send
        </button>
        <button className="btn btn--sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
