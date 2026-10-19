import { useState, type ReactNode } from "react";
import { useStore, actorById } from "../store/useStore";
import { computeFingerprint } from "../store/fold";
import { canReview } from "../auth/roles";
import { fmtDate, fmtDateTime } from "../data/index";
import { StatusBadge } from "./StatusBadge";
import {
  checkTargetId,
  checkApprovalState,
  computeCheckEffect,
  defaultAcceptReason,
  buildDecisionEvents,
} from "../data/checks/effect";
import type { CheckResult } from "../data/checks/types";
import "./AdjustmentDecision.css";

// The full accept/dismiss/approve/send-back lifecycle for one check's proposed
// adjustment - shared by the Checks page, Home's "Waiting for your approval" section, and
// Review's adjustment-approvals list, so all three always show the same state for the
// same check.
export function AdjustmentDecision({ check }: { check: CheckResult }) {
  const { index, derived, currentActor, appendEvent } = useStore();
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackNote, setSendBackNote] = useState("");

  if (!index) return null;

  const targetId = checkTargetId(check);
  const effects = computeCheckEffect(index, check);
  const approval = checkApprovalState(index, derived, check);

  async function decide(status: "accepted" | "rejected", withReason: string) {
    for (const e of buildDecisionEvents(check, effects, status, withReason)) {
      await appendEvent(e);
    }
  }

  async function approve() {
    await appendEvent({
      type: "sign_off",
      target: { kind: "check", id: targetId, label: check.title },
      payload: { level: "partner", fingerprint: computeFingerprint(derived, [targetId]), covers: [{ kind: "check", id: targetId }] },
    });
  }

  async function sendBack() {
    if (!sendBackNote.trim()) return;
    await appendEvent({
      type: "review_note",
      target: { kind: "check", id: targetId, label: check.title },
      payload: { severity: "blocking", body: `Sent back: ${sendBackNote.trim()}` },
    });
    setSendBackNote("");
    setSendBackOpen(false);
  }

  if (approval.decision === "pending") {
    if (!acceptOpen) {
      return (
        <div className="decision-actions">
          <button
            className="btn btn--sm btn--primary"
            onClick={() => {
              setReason(defaultAcceptReason(check));
              setAcceptOpen(true);
            }}
          >
            Accept adjustment
          </button>
          <button className="btn btn--sm" onClick={() => void decide("rejected", check.explanation)}>Dismiss</button>
        </div>
      );
    }
    return (
      <div className="inline-form accept-reason-form">
        <label className="accept-reason-form__label">Reason for accepting (recorded with your name, the time, and the fed/CA effect)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        <div className="decision-actions">
          <button
            className="btn btn--sm btn--primary"
            disabled={!reason.trim()}
            onClick={() => void decide("accepted", reason.trim()).then(() => setAcceptOpen(false))}
          >
            Confirm &amp; accept
          </button>
          <button className="btn btn--sm" onClick={() => setAcceptOpen(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  if (approval.decision === "rejected") {
    return <StatusBadge status="neutral">Dismissed</StatusBadge>;
  }

  // accepted
  const acceptedByName = approval.acceptedByActorId ? actorById(approval.acceptedByActorId).name : "unknown";
  const canApprove = currentActor.role === "partner" && approval.needsApproval && !approval.approved;
  const blockedSelf = canApprove && approval.acceptedByActorId ? !canReview(currentActor.staffOrClientId, approval.acceptedByActorId) : false;

  let badge: ReactNode;
  if (!approval.needsApproval) {
    badge = <StatusBadge status="verified">Adjustment accepted</StatusBadge>;
  } else if (approval.approved) {
    badge = (
      <StatusBadge status="verified">
        Approved by {approval.approvedByActorId ? actorById(approval.approvedByActorId).name : "partner"} · {fmtDate(approval.approvedAt)}
      </StatusBadge>
    );
  } else {
    badge = <StatusBadge status="open">Awaiting partner approval</StatusBadge>;
  }

  return (
    <div className="decision-block">
      <div className="decision-actions">{badge}</div>
      <p className="decision-info muted">
        Accepted by {acceptedByName} · {fmtDateTime(approval.acceptedAt)}{approval.reason ? ` · ${approval.reason}` : ""}
      </p>
      {canApprove && !blockedSelf && !sendBackOpen && (
        <div className="decision-actions">
          <button className="btn btn--sm btn--primary" onClick={() => void approve()}>Approve</button>
          <button className="btn btn--sm" onClick={() => setSendBackOpen(true)}>Send back</button>
        </div>
      )}
      {canApprove && blockedSelf && (
        <p className="review-blocked-note">Blocked: you accepted this adjustment yourself - another partner must approve it.</p>
      )}
      {canApprove && sendBackOpen && (
        <div className="inline-form">
          <input
            placeholder="Why is this going back to the preparer? (required)"
            value={sendBackNote}
            onChange={(e) => setSendBackNote(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn--sm btn--primary" disabled={!sendBackNote.trim()} onClick={() => void sendBack()}>Send back</button>
          <button className="btn btn--sm" onClick={() => setSendBackOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
