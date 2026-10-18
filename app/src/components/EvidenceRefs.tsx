import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { resolveRef } from "../data/index";
import "./EvidenceRefs.css";

export function EvidenceRefs({ refs, onOpenEvidence }: { refs: string[]; onOpenEvidence?: (ref: string) => void }) {
  const { index } = useStore();
  const navigate = useNavigate();
  if (!index || refs.length === 0) return null;
  return (
    <div className="evidence-refs">
      {refs.map((ref) => {
        const r = resolveRef(index, ref);
        return (
          <button
            key={ref}
            className={`evidence-chip evidence-chip--${r.kind}`}
            title={ref}
            onClick={() => {
              if (onOpenEvidence) onOpenEvidence(ref);
              else if (r.href) navigate(r.href);
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
