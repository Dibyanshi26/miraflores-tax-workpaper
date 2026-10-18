import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { PageHeader, Card } from "../components/Section";
import { StatusBadge } from "../components/StatusBadge";
import { buildSourceUsage, fmtDate, visibleDocuments } from "../data/index";
import "./Documents.css";

export function Documents() {
  const { index, currentActor, asOf } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const usage = useMemo(() => (index ? buildSourceUsage(index) : null), [index]);

  const docs = useMemo(() => {
    if (!index) return [];
    let list = visibleDocuments(index, asOf);
    if (currentActor.role === "client") {
      list = list.filter((d) => d.uploaded_by === "client" || d.belongs_to === "joint");
    }
    const query = q.trim().toLowerCase();
    if (query) list = list.filter((d) => d.title.toLowerCase().includes(query) || d.document_type.toLowerCase().includes(query) || d.issuer.toLowerCase().includes(query));
    if (onlyIssues) {
      list = list.filter((d) => {
        const landedLines = usage?.docToLines.get(d.id) ?? [];
        const superseded = index.latestVersion.documents_superseded.includes(d.id);
        return d.extraction.status !== "extracted" || superseded || (landedLines.length === 0 && d.extraction.values > 0);
      });
    }
    return [...list].sort((a, b) => a.received_at.localeCompare(b.received_at));
  }, [index, q, onlyIssues, usage, currentActor.role, asOf]);

  if (!index || !usage) return null;

  return (
    <>
      <PageHeader title="Documents" subtitle={`${docs.length} of ${index.packet.documents.length} documents received as of ${fmtDate(asOf)} - where each landed, or why it didn't.`} />
      <div className="doc-filters">
        <input placeholder="Search title, type, issuer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Only issues (not extracted, superseded, unused)</label>
      </div>
      <Card>
        <table className="datatable">
          <thead>
            <tr><th>Document</th><th>Type</th><th>Received</th><th>Belongs to</th><th>Extraction</th><th>Landed in</th></tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const landedLines = usage.docToLines.get(d.id) ?? [];
              const supersededByNewer = index.latestVersion.documents_superseded.includes(d.id);
              return (
                <tr key={d.id} className="clickable" onClick={() => navigate(`/documents/${d.id}`)}>
                  <td>
                    <strong>{d.title}</strong>
                    {d.marked_corrected && <StatusBadge status="info"> corrected</StatusBadge>}
                  </td>
                  <td className="muted">{d.document_type.replace(/_/g, " ")}</td>
                  <td className="muted">{fmtDate(d.received_at)}</td>
                  <td className="muted">{d.belongs_to}</td>
                  <td>
                    {d.extraction.status === "extracted" ? <StatusBadge status="verified">extracted ({d.extraction.values})</StatusBadge>
                      : d.extraction.status === "partial" ? <StatusBadge status="open">partial</StatusBadge>
                      : <StatusBadge status="blocking">not extracted</StatusBadge>}
                  </td>
                  <td>
                    {supersededByNewer ? <StatusBadge status="neutral">superseded</StatusBadge>
                      : landedLines.length > 0 ? <span className="muted">{landedLines.length} line{landedLines.length > 1 ? "s" : ""}</span>
                      : d.extraction.values > 0 ? <StatusBadge status="open">not used - check for duplicate</StatusBadge>
                      : <span className="muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
