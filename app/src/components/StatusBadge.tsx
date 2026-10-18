import "./StatusBadge.css";

export type Status = "verified" | "open" | "blocking" | "adjustment" | "info" | "neutral";

export function StatusDot({ status }: { status: Status }) {
  return <span className={`status-dot status-dot--${status}`} aria-hidden="true" />;
}

export function StatusBadge({ status, children, dot = true }: { status: Status; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {dot && <StatusDot status={status} />}
      {children}
    </span>
  );
}

// Severity (as opposed to general status) reads as a plain word, not a colored dot - the
// background tint is enough context once the word itself says "Blocking".
export type Severity = "blocking" | "warning" | "info";
export const SEVERITY_LABEL: Record<Severity, string> = { blocking: "Blocking", warning: "Review", info: "Minor" };
export const SEVERITY_TO_STATUS: Record<Severity, Status> = { blocking: "blocking", warning: "open", info: "info" };

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <StatusBadge status={SEVERITY_TO_STATUS[severity]} dot={false}>
      {SEVERITY_LABEL[severity]}
    </StatusBadge>
  );
}
