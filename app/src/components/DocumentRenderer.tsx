import { Fragment, useMemo } from "react";
import type { PacketDocument } from "../types/packet";
import { useStore } from "../store/useStore";
import { maskValue } from "../auth/roles";
import "./DocumentRenderer.css";

// Any renderer of a source document implements this shape - today it's simulated
// pages built from printed_content; a real PDF/image renderer could satisfy the same
// props later (document, highlightEvId, onSelectField, maskedEvIds) without changing
// call sites.
export interface DocumentRendererProps {
  document: PacketDocument;
  highlightEvId?: string;
  onSelectField?: (evId: string) => void;
  // ids of sensitive extracted values the current viewer hasn't been granted a reveal for -
  // their printed_content span is masked here too, not just in the sidebar list, so clearance
  // is enforced everywhere the source document's text appears.
  maskedEvIds?: Set<string>;
}

interface PageEv { id: string; text_as_read: string; value: string | number | boolean | null; value_type: string; field: string }

function highlightPage(pageText: string, highlightEvId: string | undefined, evsOnPage: PageEv[], maskedEvIds: Set<string> | undefined, onSelectField?: (evId: string) => void) {
  if (!pageText) return <span className="doc-page__empty">(no printed content captured for this page)</span>;
  // Build highlight spans for every extracted value's text_as_read found on this page;
  // the one matching highlightEvId gets the strong highlighter treatment.
  const candidates = evsOnPage
    .filter((e) => e.text_as_read && e.text_as_read.length > 1 && pageText.includes(e.text_as_read))
    .sort((a, b) => pageText.indexOf(a.text_as_read) - pageText.indexOf(b.text_as_read));

  if (candidates.length === 0) return <>{pageText}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const c of candidates) {
    const idx = pageText.indexOf(c.text_as_read, cursor);
    if (idx === -1) continue;
    if (idx > cursor) nodes.push(<Fragment key={`t${cursor}`}>{pageText.slice(cursor, idx)}</Fragment>);
    const isTarget = c.id === highlightEvId;
    const masked = maskedEvIds?.has(c.id);
    nodes.push(
      <mark
        key={c.id}
        className={`doc-highlight${isTarget ? " doc-highlight--target" : ""}${masked ? " doc-highlight--masked" : ""}`}
        onClick={() => onSelectField?.(c.id)}
        title={masked ? "Masked - no sensitive-data clearance" : c.id}
      >
        {masked ? maskValue(String(c.value), c.value_type, c.field) : c.text_as_read}
      </mark>
    );
    cursor = idx + c.text_as_read.length;
  }
  if (cursor < pageText.length) nodes.push(<Fragment key="tail">{pageText.slice(cursor)}</Fragment>);
  return <>{nodes}</>;
}

export function DocumentRenderer({ document, highlightEvId, onSelectField, maskedEvIds }: DocumentRendererProps) {
  const { index } = useStore();
  const evs = useMemo(
    () => (index?.evByDocument.get(document.id) ?? []).map((e) => ({ id: e.id, text_as_read: e.text_as_read, page: e.page, value: e.value, value_type: e.value_type, field: e.field })),
    [index, document.id]
  );

  return (
    <div className="document-renderer">
      <div className="document-renderer__letterhead">
        <div>
          <strong>{document.issuer}</strong>
          <span>{document.document_type.replace(/_/g, " ")}</span>
        </div>
        <div className="document-renderer__meta">
          {document.marked_corrected && <span className="doc-corrected-tag">CORRECTED</span>}
          <span>{document.file_name}</span>
        </div>
      </div>
      {document.pages.map((p) => (
        <div className="doc-page mono" key={p.page} id={`page-${p.page}`}>
          <div className="doc-page__number">Page {p.page} of {document.page_count}</div>
          <div className="doc-page__content">
            {highlightPage(p.printed_content, highlightEvId, evs.filter((e) => e.page === p.page), maskedEvIds, onSelectField)}
          </div>
        </div>
      ))}
    </div>
  );
}
