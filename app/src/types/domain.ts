// Domain types for the workpaper itself: roles, staff, and the append-only event log.
// Derived state (verifications, adjustments, sign-offs, ...) is always a fold over Event[].
// Never mutate packet data - every human action becomes an Event.

export type RoleId =
  | "preparer" | "reviewer" | "partner" | "preparer_no_clearance"
  | "firm_admin" | "quality_reviewer" | "client";

export interface ActorIdentity {
  staffOrClientId: string; // st-01..st-06 or cu-01/cu-02
  role: RoleId;
  name: string;
}

// Staff/role registry, independent of the packet (packet.firm.staff informs this but
// the workpaper needs role ids the packet doesn't carry, e.g. "preparer_no_clearance").
// Names and ids must match packet.firm.staff / packet.firm.client_users exactly -
// these are the same people, just given fixed roles/credentials here for the app shell
// to render a role switcher before the packet has loaded.
export const ACTORS: ActorIdentity[] = [
  { staffOrClientId: "st-01", role: "preparer", name: "Priya Raman" },
  { staffOrClientId: "st-02", role: "reviewer", name: "Daniel Ortiz" },
  { staffOrClientId: "st-03", role: "partner", name: "Helen Strand" },
  { staffOrClientId: "st-04", role: "preparer_no_clearance", name: "Marcus Bell" },
  { staffOrClientId: "st-05", role: "firm_admin", name: "Jo Kimura" },
  { staffOrClientId: "st-06", role: "quality_reviewer", name: "Sam Adeyemi" },
  { staffOrClientId: "cu-01", role: "client", name: "Ngozi Okafor" },
  { staffOrClientId: "cu-02", role: "client", name: "Erik Lindqvist" },
];

export type EventType =
  | "verification"
  | "adjustment"
  | "review_note"
  | "review_note_resolved"
  | "question"
  | "answer"
  | "sign_off"
  | "sign_off_reopened"
  | "judgment"
  | "attachment"
  | "assignment"
  | "filing"
  | "view_log"
  | "standards_change"
  | "revert"
  | "undo"
  | "bulk_action";

export type VerificationType =
  | "agreed_to_source_document" | "recalculated" | "confirmed_with_client"
  | "agreed_to_prior_year" | "agreed_to_third_party_record";

export interface TargetRef {
  kind: "line" | "document" | "asset" | "check" | "note" | "sale_lot" | "area" | "filing" | "notice" | "other";
  id: string; // line key, document id, asset id, check code, note id, lot key, area key, ...
  label?: string;
}

// Payload shapes per event type (all optional-ish; the fold is defensive).
export interface EventPayload {
  // verification
  verification_type?: VerificationType;
  note?: string;
  evidence_refs?: string[];

  // adjustment
  amount?: number;
  category?: string; // matches tax_effect_rates key, or "ca_source_income"
  reason?: string;
  tax_effect_federal?: number;
  tax_effect_california?: number;
  what_if_id?: string;
  status?: "proposed" | "accepted" | "rejected" | "withdrawn";

  // review_note
  severity?: "info" | "blocking";
  body?: string;
  resolution?: string;
  note_event_id?: string; // for review_note_resolved: the specific review_note event id it resolves

  // question/answer
  to?: string; // actor id or "client"
  question_text?: string;
  answer_text?: string;
  question_event_id?: string;

  // sign_off
  level?: "preparer" | "reviewer" | "partner" | "quality";
  fingerprint?: string; // hash of what was signed off, so changes reopen it
  covers?: TargetRef[];
  reopen_reason?: string;
  original_sign_off_id?: string;

  // judgment
  authority?: string;
  election?: string;
  due_diligence_for?: string[];

  // attachment
  file_name?: string;
  description?: string;
  data_url?: string; // small attachments only, stored inline

  // assignment
  assignee?: string;
  due_date?: string;
  area?: string;

  // filing
  jurisdiction?: "federal" | "california";
  filing_event?: "extension" | "filed" | "efile_rejected" | "efile_accepted" | "payment" | "refund" | "amendment" | "freeze" | "client_approved";

  // view_log (sensitive reveal)
  field?: string;
  masked_value?: string;

  // standards_change
  standards_patch?: Record<string, unknown>;

  // revert / undo
  reverts_event_id?: string;

  // bulk_action
  child_event_ids?: string[];

  // generic free-form extra data
  extra?: Record<string, unknown>;
}

export interface WorkpaperEvent {
  id: string;
  at: string;       // simulated clock timestamp (ISO)
  realAt: string;    // wall-clock timestamp (ISO) when actually recorded
  actor: string;      // staffOrClientId
  role: RoleId;
  type: EventType;
  target: TargetRef;
  payload: EventPayload;
}

export const STATUS_COLORS = {
  verified: "var(--status-verified)",
  open: "var(--status-open)",
  blocking: "var(--status-blocking)",
  adjustment: "var(--status-adjustment)",
} as const;
