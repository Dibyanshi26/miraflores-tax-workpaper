import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { runIndependentChecks } from "../data/checks/run";
import { visibleDocuments } from "../data/index";
import "./CommandPalette.css";

interface Hit {
  group: string;
  label: string;
  sub?: string;
  to: string;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { index, asOf } = useStore();
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const allHits: Hit[] = useMemo(() => {
    if (!index) return [];
    const hits: Hit[] = [];
    for (const d of visibleDocuments(index, asOf)) {
      hits.push({ group: "Documents", label: d.title, sub: d.id, to: `/documents/${d.id}` });
    }
    for (const l of index.latestVersion.lines) {
      hits.push({ group: "Return lines", label: l.label, sub: `${l.key} · ${typeof l.value === "number" ? l.value.toLocaleString() : l.value}`, to: `/return-summary?line=${l.key}` });
    }
    for (const c of runIndependentChecks(index)) {
      hits.push({ group: "Checks", label: c.title, sub: c.status === "fail" ? "Failed" : "Passed", to: "/checks" });
    }
    for (const qa of index.packet.client.questionnaire) {
      hits.push({ group: "Questionnaire", label: qa.question, sub: qa.answer.slice(0, 60), to: `/client-portal#${qa.id}` });
    }
    for (const p of index.packet.household.people) {
      hits.push({ group: "People", label: p.name, sub: p.relationship ?? p.role, to: "/return-summary" });
    }
    for (const a of index.latestVersion.assets) {
      hits.push({ group: "Assets", label: a.description, sub: a.asset_id, to: `/depreciation/${a.asset_id}` });
    }
    return hits;
  }, [index, asOf]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return allHits.slice(0, 20);
    return allHits.filter((h) => h.label.toLowerCase().includes(query) || h.sub?.toLowerCase().includes(query) || h.group.toLowerCase().includes(query)).slice(0, 40);
  }, [q, allHits]);

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="cmdk-input"
          placeholder="Search documents, lines, checks, questions, people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && results[0]) {
              navigate(results[0].to);
              onClose();
            }
          }}
        />
        <div className="cmdk-results">
          {results.length === 0 && <div className="cmdk-empty">No matches</div>}
          {results.map((h, i) => (
            <button
              key={`${h.group}-${h.label}-${i}`}
              className="cmdk-result"
              onClick={() => {
                navigate(h.to);
                onClose();
              }}
            >
              <span className="cmdk-result__group">{h.group}</span>
              <span className="cmdk-result__label">{h.label}</span>
              {h.sub && <span className="cmdk-result__sub">{h.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
