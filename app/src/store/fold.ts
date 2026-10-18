// The fold: derived state is always a function of Event[]. Nothing here is persisted
// independently - call buildDerivedState(events) whenever events change and read from
// the result. This keeps "what the workpaper currently believes" honest and replayable.

import type { WorkpaperEvent } from "../types/domain";

export interface DerivedState {
  events: WorkpaperEvent[]; // all events, chronological, including reverted ones
  activeEvents: WorkpaperEvent[]; // events whose effect still stands
  revertedIds: Set<string>;
  byId: Map<string, WorkpaperEvent>;
  byTarget: Map<string, WorkpaperEvent[]>; // target.id -> active events, chronological
  byType: Map<string, WorkpaperEvent[]>;
  questionThreads: Map<string, { question: WorkpaperEvent; answers: WorkpaperEvent[] }>; // question event id -> thread
  standardsOverrides: Record<string, unknown>;
  viewLogs: WorkpaperEvent[];
}

export function buildDerivedState(events: WorkpaperEvent[]): DerivedState {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.realAt.localeCompare(b.realAt) || a.id.localeCompare(b.id));
  const revertedIds = new Set<string>();
  for (const e of sorted) {
    if ((e.type === "revert" || e.type === "undo") && e.payload.reverts_event_id) {
      revertedIds.add(e.payload.reverts_event_id);
    }
  }
  const activeEvents = sorted.filter((e) => !revertedIds.has(e.id) && e.type !== "revert" && e.type !== "undo");
  const byId = new Map(sorted.map((e) => [e.id, e]));
  const byTarget = new Map<string, WorkpaperEvent[]>();
  const byType = new Map<string, WorkpaperEvent[]>();
  const questionThreads = new Map<string, { question: WorkpaperEvent; answers: WorkpaperEvent[] }>();
  let standardsOverrides: Record<string, unknown> = {};
  const viewLogs: WorkpaperEvent[] = [];

  for (const e of activeEvents) {
    const tArr = byTarget.get(e.target.id) ?? [];
    tArr.push(e);
    byTarget.set(e.target.id, tArr);

    const typeArr = byType.get(e.type) ?? [];
    typeArr.push(e);
    byType.set(e.type, typeArr);

    if (e.type === "question") {
      questionThreads.set(e.id, { question: e, answers: [] });
    } else if (e.type === "answer" && e.payload.question_event_id) {
      const thread = questionThreads.get(e.payload.question_event_id);
      if (thread) thread.answers.push(e);
    } else if (e.type === "standards_change" && e.payload.standards_patch) {
      standardsOverrides = { ...standardsOverrides, ...e.payload.standards_patch };
    } else if (e.type === "view_log") {
      viewLogs.push(e);
    }
  }

  return { events: sorted, activeEvents, revertedIds, byId, byTarget, byType, questionThreads, standardsOverrides, viewLogs };
}

export function eventsForTarget(derived: DerivedState, targetId: string): WorkpaperEvent[] {
  return derived.byTarget.get(targetId) ?? [];
}

export function eventsOfType(derived: DerivedState, type: string): WorkpaperEvent[] {
  return derived.byType.get(type) ?? [];
}

// A stable fingerprint of "what was true about these targets when signed off", built from
// the active event list touching them. If it changes, the sign-off should reopen.
export function computeFingerprint(derived: DerivedState, targetIds: string[]): string {
  const parts: string[] = [];
  for (const id of [...targetIds].sort()) {
    const evs = eventsForTarget(derived, id).filter((e) => e.type !== "sign_off" && e.type !== "sign_off_reopened");
    const sig = evs.map((e) => `${e.id}:${e.type}`).join(",");
    parts.push(`${id}=[${sig}]`);
  }
  return simpleHash(parts.join("|"));
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export interface SignOffStatus {
  event: WorkpaperEvent;
  currentFingerprint: string;
  reopened: boolean;
}

export function latestSignOffStatus(derived: DerivedState, targetId: string, level?: string): SignOffStatus | null {
  const signOffs = eventsForTarget(derived, targetId)
    .filter((e) => e.type === "sign_off" && (!level || e.payload.level === level))
    .sort((a, b) => a.at.localeCompare(b.at));
  const latest = signOffs[signOffs.length - 1];
  if (!latest) return null;
  const coveredIds = (latest.payload.covers ?? [{ kind: "line", id: targetId }]).map((c) => c.id);
  const currentFingerprint = computeFingerprint(derived, coveredIds);
  return { event: latest, currentFingerprint, reopened: currentFingerprint !== latest.payload.fingerprint };
}
