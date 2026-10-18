import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Packet } from "../types/packet";
import type { ActorIdentity, EventPayload, EventType, RoleId, TargetRef, WorkpaperEvent } from "../types/domain";
import { ACTORS } from "../types/domain";
import { loadPacket, setPacket } from "../data/loadPacket";
import { buildIndex, type PacketIndex } from "../data/index";
import { buildDerivedState, type DerivedState } from "./fold";
import { dbGetAllEvents, dbPutEvent, dbPutEvents, dbClearEvents } from "./db";
import { broadcastEvents, broadcastReset, subscribeBroadcast } from "./broadcast";
import { SEED_QUESTIONS, SEED_QUESTION_IDS } from "../data/seedQuestions";

const DEFAULT_AS_OF = "2026-06-23T23:59:59Z"; // v3
const ACTOR_STORAGE_KEY = "miraflores-workpaper-actor";

function loadStoredActor(): ActorIdentity {
  try {
    const id = localStorage.getItem(ACTOR_STORAGE_KEY);
    return ACTORS.find((a) => a.staffOrClientId === id) ?? ACTORS[0];
  } catch {
    return ACTORS[0];
  }
}

export interface AppState {
  packet: Packet | null;
  index: PacketIndex | null;
  loading: boolean;
  error: string | null;

  events: WorkpaperEvent[]; // all recorded events, unfiltered (export/import operate on this)
  derived: DerivedState; // ALWAYS filtered to events whose `at` is on or before `asOf` -
  // this is what makes the as-of clock replay the season everywhere that reads `derived`,
  // not just the views that remember to filter it themselves.

  currentActor: ActorIdentity;
  setActor: (actor: ActorIdentity) => void;

  asOf: string;
  setAsOf: (iso: string) => void;

  lastVisited: Record<string, string>; // route key -> ISO time last viewed, for "since you last looked"
  markVisited: (routeKey: string) => void;

  init: () => Promise<void>;
  appendEvent: (e: {
    type: EventType;
    target: TargetRef;
    payload: EventPayload;
    at?: string;
    actorOverride?: ActorIdentity;
  }) => Promise<WorkpaperEvent>;
  appendEvents: (events: WorkpaperEvent[]) => Promise<void>;
  loadDemoWorkedFile: () => Promise<void>;
  exportEventLog: () => string;
  importEventLog: (json: string) => Promise<void>;
  resetEventLog: () => Promise<void>;
  loadCustomPacket: (file: File) => Promise<void>;
}

function emptyDerived(): DerivedState {
  return buildDerivedState([]);
}

function computeDerived(events: WorkpaperEvent[], asOf: string): DerivedState {
  return buildDerivedState(events.filter((e) => e.at <= asOf));
}

export const useStore = create<AppState>((set, get) => ({
  packet: null,
  index: null,
  loading: true,
  error: null,

  events: [],
  derived: emptyDerived(),

  currentActor: loadStoredActor(),
  setActor: (actor) => {
    try {
      localStorage.setItem(ACTOR_STORAGE_KEY, actor.staffOrClientId);
    } catch {
      /* private browsing or storage disabled - role just won't persist across reloads */
    }
    set({ currentActor: actor });
  },

  asOf: DEFAULT_AS_OF,
  setAsOf: (iso) => set((s) => ({ asOf: iso, derived: computeDerived(s.events, iso) })),

  lastVisited: {},
  markVisited: (routeKey) =>
    set((s) => ({ lastVisited: { ...s.lastVisited, [routeKey]: new Date().toISOString() } })),

  init: async () => {
    set({ loading: true, error: null });
    try {
      const [packet, storedEvents] = await Promise.all([loadPacket(), dbGetAllEvents()]);
      const index = buildIndex(packet);

      // Seed the four standing client questions once, idempotently (by fixed id) - they
      // represent things we need from the client from day one, not part of the optional
      // "load demo worked file" season narrative.
      const haveSeeds = storedEvents.some((e) => SEED_QUESTION_IDS.has(e.id));
      let events = storedEvents;
      if (!haveSeeds) {
        await dbPutEvents(SEED_QUESTIONS);
        events = [...storedEvents, ...SEED_QUESTIONS];
      }

      const asOf = get().asOf;
      set({
        packet,
        index,
        events,
        derived: computeDerived(events, asOf),
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }

    subscribeBroadcast((msg) => {
      if (msg.type === "events") {
        void (async () => {
          await dbPutEvents(msg.events);
          const merged = await dbGetAllEvents();
          set({ events: merged, derived: computeDerived(merged, get().asOf) });
        })();
      } else if (msg.type === "reset") {
        void (async () => {
          const merged = await dbGetAllEvents();
          set({ events: merged, derived: computeDerived(merged, get().asOf) });
        })();
      }
    });
  },

  appendEvent: async ({ type, target, payload, at, actorOverride }) => {
    const actor = actorOverride ?? get().currentActor;
    const event: WorkpaperEvent = {
      id: `ev_${nanoid(10)}`,
      at: at ?? get().asOf,
      realAt: new Date().toISOString(),
      actor: actor.staffOrClientId,
      role: actor.role,
      type,
      target,
      payload,
    };
    await dbPutEvent(event);
    const events = [...get().events, event];
    set({ events, derived: computeDerived(events, get().asOf) });
    broadcastEvents([event]);
    return event;
  },

  appendEvents: async (newEvents) => {
    await dbPutEvents(newEvents);
    const events = [...get().events, ...newEvents];
    set({ events, derived: computeDerived(events, get().asOf) });
    broadcastEvents(newEvents);
  },

  loadDemoWorkedFile: async () => {
    const idx = get().index;
    if (!idx) return;
    const { buildDemoWorkedFile } = await import("../data/demoWorkedFile");
    const demoEvents = buildDemoWorkedFile(idx);
    await dbPutEvents(demoEvents);
    const events = [...get().events, ...demoEvents];
    set({ events, derived: computeDerived(events, get().asOf) });
    broadcastEvents(demoEvents);
  },

  exportEventLog: () => JSON.stringify(get().events, null, 2),

  importEventLog: async (json) => {
    const parsed = JSON.parse(json) as WorkpaperEvent[];
    await dbPutEvents(parsed);
    const events = await dbGetAllEvents();
    set({ events, derived: computeDerived(events, get().asOf) });
    broadcastEvents(parsed);
  },

  resetEventLog: async () => {
    await dbClearEvents();
    await dbPutEvents(SEED_QUESTIONS);
    set({ events: [...SEED_QUESTIONS], derived: computeDerived(SEED_QUESTIONS, get().asOf) });
    broadcastReset();
  },

  loadCustomPacket: async (file) => {
    set({ loading: true, error: null });
    try {
      const text = await file.text();
      const packet = JSON.parse(text) as Packet;
      setPacket(packet);
      const index = buildIndex(packet);
      await dbClearEvents();
      set({ packet, index, events: [], derived: emptyDerived(), loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },
}));

export function actorById(id: string): ActorIdentity {
  return ACTORS.find((a) => a.staffOrClientId === id) ?? ACTORS[0];
}

export function roleLabel(role: RoleId): string {
  switch (role) {
    case "preparer": return "Preparer";
    case "reviewer": return "Reviewer";
    case "partner": return "Partner";
    case "preparer_no_clearance": return "Preparer (no clearance)";
    case "firm_admin": return "Firm admin";
    case "quality_reviewer": return "Quality reviewer";
    case "client": return "Client";
  }
}
