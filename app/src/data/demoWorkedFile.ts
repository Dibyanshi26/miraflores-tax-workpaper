// "Load demo worked file": a seeded event log of a plausible season's work, so the app
// isn't empty on first look. Built sequentially so sign-off fingerprints are computed
// against the real derived state at that point - including one sign-off that gets
// reopened later in the same seed, to show that feature working without a live demo.
import { ACTORS } from "../types/domain";
import type { WorkpaperEvent, EventType, TargetRef, EventPayload } from "../types/domain";
import type { PacketIndex } from "./index";
import { buildDerivedState, computeFingerprint } from "../store/fold";
import { runIndependentChecks } from "./checks/run";

const actor = (id: string) => ACTORS.find((a) => a.staffOrClientId === id)!;

let counter = 0;
function mk(at: string, actorId: string, type: EventType, target: TargetRef, payload: EventPayload): WorkpaperEvent {
  counter += 1;
  return {
    id: `demo_${String(counter).padStart(3, "0")}`,
    at,
    realAt: at,
    actor: actorId,
    role: actor(actorId).role,
    type,
    target,
    payload,
  };
}

export function buildDemoWorkedFile(idx: PacketIndex): WorkpaperEvent[] {
  counter = 0;
  const events: WorkpaperEvent[] = [];
  const checks = runIndependentChecks(idx);
  const checkTarget = (code: string): TargetRef => {
    const c = checks.find((x) => x.code === code)!;
    return { kind: "check", id: `check:${code}`, label: c.title };
  };
  const RETURN_TARGET: TargetRef = { kind: "filing", id: "return-2025", label: "2025 return" };

  // --- February: intake and early verification ---
  events.push(mk("2026-02-05T15:00:00Z", "st-05", "assignment", { kind: "area", id: "intake_and_engagement" }, { assignee: "st-01", due_date: "2026-02-20", area: "intake_and_engagement" }));
  events.push(mk("2026-02-10T18:20:00Z", "st-01", "verification", { kind: "line", id: "F1040.1a", label: "Wages" }, { verification_type: "agreed_to_source_document", note: "Agreed to W-2s D08 and D09." }));
  events.push(mk("2026-02-18T16:40:00Z", "st-01", "verification", { kind: "document", id: "D10", label: "Form W-2 (phone photo)" }, { verification_type: "agreed_to_source_document", note: "Duplicate of D09 - same employer, same Box 1. Not double-counted." }));

  // --- March: preparer finds the first batch of errors ---
  for (const code of ["RSU-BASIS", "SCHC-1099K-DOUBLE", "MILEAGE-DUPLICATE-PAGE"]) {
    events.push(mk("2026-03-12T19:00:00Z", "st-01", "adjustment", checkTarget(code), { status: "accepted", reason: "Confirmed against source documents." }));
  }
  events.push(mk("2026-03-26T17:30:00Z", "st-01", "verification", { kind: "line", id: "SchC.25", label: "Utilities" }, { verification_type: "confirmed_with_client", note: "Business-use split per call-01." }));
  events.push(mk("2026-03-26T17:35:00Z", "st-01", "adjustment", checkTarget("PERSONAL-USE-SPLIT"), { status: "accepted", reason: "Per call-01 business-use percentages." }));

  // --- April: a question to the client, answered ---
  const q1 = mk("2026-04-02T14:00:00Z", "st-01", "question", { kind: "other", id: "client-portal", label: "Client portal" }, { question_text: "Do you have the bank statement showing the $3,050 transfer to CryptoNorth for the BTC lot?", to: "client" });
  events.push(q1);
  events.push(mk("2026-04-05T20:10:00Z", "cu-02", "answer", { kind: "other", id: "client-portal", label: "Client portal" }, { answer_text: "That exchange shut down - I only have the bank line from 03/15/2021, attaching now.", question_event_id: q1.id }));
  events.push(mk("2026-04-05T20:12:00Z", "st-01", "adjustment", checkTarget("CRYPTO-BASIS-MISSING"), { status: "accepted", reason: "Bank statement line confirms the 2021 purchase." }));

  // --- May: reviewer pass ---
  events.push(mk("2026-05-04T15:00:00Z", "st-02", "verification", { kind: "line", id: "SchCA540NR.1.E", label: "Wages - California amount" }, { verification_type: "agreed_to_source_document", note: "Paystub D73 confirms CA wages stopped 7/15, not full-year Box 16." }));
  events.push(mk("2026-05-04T15:05:00Z", "st-02", "adjustment", checkTarget("CA-SOURCE-WAGES-PAYROLL-ERROR"), { status: "accepted", reason: "Confirmed with paystub and qa-45." }));
  const noteEvent = mk("2026-05-06T13:00:00Z", "st-02", "review_note", RETURN_TARGET, { severity: "blocking", body: "HVAC replacement needs a capitalize-vs-repair call before we can sign off - routing to Helen." });
  events.push(noteEvent);
  events.push(mk("2026-05-10T12:00:00Z", "st-02", "adjustment", checkTarget("NORTHLAKE-DUPLICATE-INTEREST"), { status: "accepted", reason: "Confirmed duplicate sweep-account interest." }));

  // reviewer sign-off, fingerprint computed from state as of this point
  {
    const derivedSoFar = buildDerivedState(events);
    const coveredIds = ["return-2025", ...checks.map((c) => `check:${c.code}`)];
    const fp = computeFingerprint(derivedSoFar, coveredIds);
    events.push(mk("2026-05-12T16:00:00Z", "st-02", "sign_off", RETURN_TARGET, { level: "reviewer", note: "Reviewed against source documents; one blocking note open for partner.", fingerprint: fp, covers: coveredIds.map((id) => ({ kind: "check", id })) }));
  }

  // --- June: partner resolves the HVAC question, signs off, then one more item reopens it ---
  events.push(mk("2026-06-15T18:00:00Z", "st-03", "judgment", { kind: "other", id: "judgment:HVAC-CAPITALIZE", label: "HVAC capitalize vs. repair" }, { body: "Full system replacement with a permit - capitalize over 27.5 years, not a repair.", authority: "Treas. Reg. 1.263(a)-3(k) routine maintenance safe harbor does not apply to a full system replacement" }));
  events.push(mk("2026-06-16T10:00:00Z", "st-03", "adjustment", checkTarget("HVAC-CAPITALIZE"), {
    status: "accepted", category: "what_if", what_if_id: "hvac_improvement", reason: "Capitalized per judgment call.",
    tax_effect_federal: idx.packet.what_if.alternatives.find((a) => a.id === "hvac_improvement")?.federal.total_tax_change ?? 0,
    tax_effect_california: idx.packet.what_if.alternatives.find((a) => a.id === "hvac_improvement")?.california.total_tax_change ?? 0,
  }));
  events.push(mk("2026-06-16T10:05:00Z", "st-03", "review_note_resolved", { kind: "note", id: noteEvent.target.id }, { resolution: "Capitalized the HVAC replacement; judgment recorded with authority.", note_event_id: noteEvent.id }));

  {
    const derivedSoFar = buildDerivedState(events);
    const coveredIds = ["return-2025", ...checks.map((c) => `check:${c.code}`)];
    const fp = computeFingerprint(derivedSoFar, coveredIds);
    events.push(mk("2026-06-18T11:00:00Z", "st-03", "sign_off", RETURN_TARGET, { level: "partner", note: "HVAC capitalized; adjustments exceed $1,000 so partner sign-off applies.", fingerprint: fp, covers: coveredIds.map((id) => ({ kind: "check", id })) }));
  }

  // One more accepted adjustment after the partner sign-off - this changes the fingerprint,
  // so Review will show the partner sign-off as reopened without any extra wiring.
  events.push(mk("2026-06-20T09:00:00Z", "st-01", "adjustment", checkTarget("SPARBANKEN-FX-YEAR"), { status: "accepted", reason: "Corrected to the 2025 average SEK rate." }));

  // --- Client approval and freeze ---
  events.push(mk("2026-07-10T19:00:00Z", "cu-01", "filing", { kind: "other", id: "client-portal", label: "Client portal" }, { filing_event: "client_approved", jurisdiction: "federal" }));
  events.push(mk("2026-07-14T16:25:00Z", "st-01", "filing", RETURN_TARGET, { filing_event: "freeze" }));

  return events;
}
