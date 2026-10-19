// Shared area-status computation: hours logged vs budget, open item count, and the
// return-level sign-off state per level - used by both Home and Firm admin so the two
// never show different numbers for the same thing.
import type { PacketIndex } from "./index";
import { buildSourceUsage } from "./index";
import type { DerivedState } from "../store/fold";
import { latestSignOffStatus } from "../store/fold";
import type { TargetRef } from "../types/domain";
import { areaForLine, AREA_LABELS } from "./areaClassifier";
import type { CheckResult } from "./checks/types";
import { checkApprovalState } from "./checks/effect";

// Rough per-event-type time estimate (hours) - there's no stopwatch in this prototype,
// so this is a transparent, documented proxy rather than a real timer.
const EVENT_HOURS: Record<string, number> = {
  verification: 0.15,
  adjustment: 0.25,
  review_note: 0.1,
  review_note_resolved: 0.05,
  question: 0.1,
  answer: 0.1,
  sign_off: 0.5,
  sign_off_reopened: 0.1,
  judgment: 0.2,
  attachment: 0.05,
  assignment: 0.05,
  filing: 0.1,
  view_log: 0.02,
  standards_change: 0.1,
  bulk_action: 0.1,
};

export const RETURN_TARGET_ID = "return-2025";
export const SIGN_OFF_LEVELS = ["preparer", "reviewer", "partner"] as const;
export type SignOffLevel = (typeof SIGN_OFF_LEVELS)[number];
export type SignOffState = "signed" | "reopened" | "none";

export interface AreaStats {
  key: string;
  label: string;
  budgetHours: number;
  hoursLogged: number;
  openItems: number;
  signOffs: { level: SignOffLevel; state: SignOffState }[];
}

function areaForTarget(idx: PacketIndex, checksByCode: Map<string, CheckResult>, usage: ReturnType<typeof buildSourceUsage>, target: TargetRef): string | null {
  const v3Lines = idx.linesByVersionKey.get("v3");
  if (target.kind === "line") {
    const l = v3Lines?.get(target.id);
    return l ? areaForLine(l) : null;
  }
  if (target.kind === "check") {
    const code = target.id.replace(/^check:/, "");
    return checksByCode.get(code)?.area ?? null;
  }
  if (target.kind === "document") {
    const lineKey = usage.docToLines.get(target.id)?.[0];
    const l = lineKey ? v3Lines?.get(lineKey) : undefined;
    return l ? areaForLine(l) : null;
  }
  if (target.kind === "asset") {
    const l = idx.latestVersion.lines.find((line) => line.sources?.includes(`asset:${target.id}`));
    return l ? areaForLine(l) : null;
  }
  return null;
}

export function returnSignOffStates(derived: DerivedState): { level: SignOffLevel; state: SignOffState }[] {
  return SIGN_OFF_LEVELS.map((level) => {
    const status = latestSignOffStatus(derived, RETURN_TARGET_ID, level);
    const state: SignOffState = !status ? "none" : status.reopened ? "reopened" : "signed";
    return { level, state };
  });
}

export function computeAreaStats(idx: PacketIndex, derived: DerivedState, checks: CheckResult[]): AreaStats[] {
  const usage = buildSourceUsage(idx);
  const checksByCode = new Map(checks.map((c) => [c.code, c]));

  const hoursByArea = new Map<string, number>();
  for (const e of derived.activeEvents) {
    const area = areaForTarget(idx, checksByCode, usage, e.target);
    if (!area) continue;
    hoursByArea.set(area, (hoursByArea.get(area) ?? 0) + (EVENT_HOURS[e.type] ?? 0.1));
  }

  const openByArea = new Map<string, number>();
  for (const c of checks) {
    if (c.status === "fail" && checkApprovalState(idx, derived, c).isOpen) {
      openByArea.set(c.area, (openByArea.get(c.area) ?? 0) + 1);
    }
  }

  const signOffs = returnSignOffStates(derived);
  const areas = Object.keys(idx.packet.firm.budget_hours).filter((k) => k !== "partner_review");

  return areas.map((key) => ({
    key,
    label: AREA_LABELS[key] ?? key.replace(/_/g, " "),
    budgetHours: idx.packet.firm.budget_hours[key as keyof typeof idx.packet.firm.budget_hours],
    hoursLogged: Math.round((hoursByArea.get(key) ?? 0) * 10) / 10,
    openItems: openByArea.get(key) ?? 0,
    signOffs,
  }));
}
