import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { useUiStore } from "../store/uiStore";
import { isSensitiveValueType, maskValue, CLEARANCE_BY_ROLE } from "../auth/roles";
import { fmtMoney } from "../data/index";
import "./SourceChip.css";

// "Box 1 wages, tips, other compensation" -> "Box 1"; falls back to the full label for
// fields that aren't box-numbered, so nothing gets invented for non-W-2/1099 sources.
function shortFieldLabel(label: string): string {
  const m = /^(Box\s?\d+[A-Za-z]?)\b/i.exec(label);
  return m ? m[1] : label;
}

interface Snippet { before: string; match: string; after: string }

function snippetAround(printedContent: string, textAsRead: string, pad = 55): Snippet | null {
  if (!textAsRead) return null;
  const idx = printedContent.indexOf(textAsRead);
  if (idx === -1) return null;
  const start = Math.max(0, idx - pad);
  const end = Math.min(printedContent.length, idx + textAsRead.length + pad);
  return {
    before: (start > 0 ? "…" : "") + printedContent.slice(start, idx),
    match: textAsRead,
    after: printedContent.slice(idx + textAsRead.length, end) + (end < printedContent.length ? "…" : ""),
  };
}

// A source chip shows exactly what a reviewer needs to trust a number without opening the
// document: which document, which field, what it says, how confident the extraction was -
// plus a highlighted snippet of the actual printed page, no truncation (wraps instead).
export function SourceChip({ evId }: { evId: string }) {
  const { index, currentActor, appendEvent } = useStore();
  const navigate = useNavigate();
  const [revealed, setRevealed] = useState(false);

  if (!index) return null;
  const ev = index.evById.get(evId);
  if (!ev) return <div className="source-chip source-chip--missing">{evId} (not found in packet)</div>;
  const doc = index.documentsById.get(ev.document_id);

  const hasClearance = CLEARANCE_BY_ROLE[currentActor.role];
  const sensitive = isSensitiveValueType(ev.value_type);
  const canSee = !sensitive || hasClearance || revealed;

  const displayVal = !canSee
    ? maskValue(String(ev.value), ev.value_type, ev.field)
    : ev.value_type === "money" && typeof ev.value === "number"
      ? fmtMoney(ev.value)
      : ev.text_as_read || String(ev.value ?? "—");

  const page = doc?.pages.find((p) => p.page === ev.page);
  const snippet = page && canSee ? snippetAround(page.printed_content, ev.text_as_read) : null;

  function openDocument() {
    useUiStore.getState().closeTrace();
    navigate(`/documents/${ev!.document_id}?ev=${ev!.id}`);
  }

  function reveal(e: React.MouseEvent) {
    e.stopPropagation();
    setRevealed(true);
    void appendEvent({ type: "view_log", target: { kind: "document", id: doc!.id, label: doc!.title }, payload: { field: ev!.id } });
  }

  return (
    <div className="source-chip" role="button" tabIndex={0} onClick={openDocument} onKeyDown={(e) => { if (e.key === "Enter") openDocument(); }}>
      <div className="source-chip__line">
        <span className="source-chip__doc mono">{doc?.id ?? ev.document_id}</span>
        <span className="source-chip__issuer">{doc?.issuer ?? "unknown issuer"}</span>
        <span className="source-chip__sep">·</span>
        <span className="source-chip__field">{shortFieldLabel(ev.label)}</span>
        <span className="source-chip__sep">·</span>
        <span className="source-chip__value num">{displayVal}</span>
        {sensitive && !canSee && <button className="source-chip__reveal" onClick={reveal}>reveal</button>}
        <span className="source-chip__sep">·</span>
        <span className={`source-chip__confidence${ev.confidence < 0.9 ? " source-chip__confidence--low" : ""}`}>{Math.round(ev.confidence * 100)}%</span>
      </div>
      {snippet && (
        <div className="source-chip__snippet mono">
          {snippet.before}<mark className="source-chip__highlight">{snippet.match}</mark>{snippet.after}
        </div>
      )}
    </div>
  );
}
