import { useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { PageHeader, Section, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { DocumentRenderer } from "../components/DocumentRenderer";
import { EventTimeline } from "../components/EventTimeline";
import { useUiStore } from "../store/uiStore";
import { buildSourceUsage, fmtDateTime, fmtDate, isDocumentVisible } from "../data/index";
import { isSensitiveValueType, maskValue, CLEARANCE_BY_ROLE } from "../auth/roles";
import "./DocumentViewer.css";

export function DocumentViewer() {
  const { docId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { index, currentActor, appendEvent, asOf } = useStore();
  const [selectedEv, setSelectedEv] = useState<string | undefined>(params.get("ev") ?? undefined);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const usage = useMemo(() => (index ? buildSourceUsage(index) : null), [index]);
  const doc = index?.documentsById.get(docId);
  const evs = useMemo(() => (index?.evByDocument.get(docId) ?? []).sort((a, b) => a.page - b.page), [index, docId]);
  const hasClearance = CLEARANCE_BY_ROLE[currentActor.role];
  const maskedEvIds = useMemo(
    () => new Set(hasClearance ? [] : evs.filter((ev) => isSensitiveValueType(ev.value_type) && !revealed.has(ev.id)).map((ev) => ev.id)),
    [evs, hasClearance, revealed]
  );

  if (!index || !usage || !doc) return <div className="muted">Document not found.</div>;

  if (!isDocumentVisible(doc, asOf)) {
    return (
      <>
        <PageHeader title="Not yet received" subtitle={`${doc.title} isn't in the file as of ${fmtDate(asOf)}.`} actions={<button className="btn btn--sm" onClick={() => navigate("/documents")}>← All documents</button>} />
        <Card>
          <p className="muted">This document is received {fmtDateTime(doc.received_at)} - move the as-of clock forward to see it.</p>
        </Card>
      </>
    );
  }

  const supersededByNewer = index.latestVersion.documents_superseded.includes(doc.id);

  function revealValue(evId: string) {
    setRevealed((s) => new Set(s).add(evId));
    void appendEvent({ type: "view_log", target: { kind: "document", id: doc!.id, label: doc!.title }, payload: { field: evId } });
  }

  return (
    <>
      <PageHeader
        title={doc.title}
        subtitle={`${doc.issuer} · received ${fmtDateTime(doc.received_at)} · ${doc.belongs_to}`}
        actions={<button className="btn btn--sm" onClick={() => navigate("/documents")}>← All documents</button>}
      />

      {supersededByNewer && <div className="doc-banner">This document has been superseded by a corrected version - its values are excluded from the current return.</div>}

      <div className="doc-viewer-grid">
        <div>
          <DocumentRenderer document={doc} highlightEvId={selectedEv} onSelectField={setSelectedEv} maskedEvIds={maskedEvIds} />
        </div>
        <aside className="doc-sidebar">
          <Section title={`Extracted values (${evs.length})`}>
            <div className="doc-ev-list">
              {evs.map((ev) => {
                const landedLines = usage.evToLines.get(ev.id) ?? [];
                const sensitive = isSensitiveValueType(ev.value_type);
                const canSee = !sensitive || hasClearance || revealed.has(ev.id);
                const displayVal = canSee ? ev.text_as_read || String(ev.value) : maskValue(String(ev.value), ev.value_type, ev.field);
                return (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    className={`doc-ev-item${selectedEv === ev.id ? " doc-ev-item--active" : ""}`}
                    onClick={() => setSelectedEv(ev.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedEv(ev.id); }}
                  >
                    <div className="doc-ev-item__row">
                      <span className="doc-ev-item__label">{ev.label}</span>
                      {ev.confidence < 0.9 && <StatusBadge status="open">{Math.round(ev.confidence * 100)}%</StatusBadge>}
                    </div>
                    <div className="doc-ev-item__row">
                      <strong className="num">
                        {displayVal}
                        {sensitive && !canSee && (
                          <button className="doc-reveal-btn" onClick={(e) => { e.stopPropagation(); revealValue(ev.id); }}>reveal</button>
                        )}
                      </strong>
                      {landedLines[0] && (
                        <button className="doc-ev-item__landed" onClick={(e) => { e.stopPropagation(); useUiStore.getState().openTrace(landedLines[0]); }}>
                          → {landedLines[0]}
                        </button>
                      )}
                      {landedLines.length === 0 && <span className="muted" style={{ fontSize: 10.5 }}>did not land</span>}
                    </div>
                  </div>
                );
              })}
              {evs.length === 0 && <div className="muted">{doc.extraction.reason ?? "No values extracted from this document."}</div>}
            </div>
          </Section>

          <Section title="Document activity">
            <Card>
              <EventTimeline target={{ kind: "document", id: doc.id, label: doc.title }} />
            </Card>
          </Section>
        </aside>
      </div>
    </>
  );
}
