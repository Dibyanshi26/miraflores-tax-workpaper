// Several people at once: a BroadcastChannel keeps browser tabs (opened as different
// roles) in sync. Production would sync the same event log to a server instead -
// the message shape below (`{type: "events", events}`) is what that server round-trip
// would carry.
import type { WorkpaperEvent } from "../types/domain";

const CHANNEL_NAME = "miraflores-workpaper-events";

export type BroadcastMessage =
  | { type: "events"; events: WorkpaperEvent[]; from: string }
  | { type: "reset"; from: string }
  | { type: "ping"; from: string; role: string; name: string };

let channel: BroadcastChannel | null = null;
const SESSION_ID = Math.random().toString(36).slice(2);

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastEvents(events: WorkpaperEvent[]) {
  getChannel()?.postMessage({ type: "events", events, from: SESSION_ID } satisfies BroadcastMessage);
}

export function broadcastReset() {
  getChannel()?.postMessage({ type: "reset", from: SESSION_ID } satisfies BroadcastMessage);
}

export function broadcastPresence(role: string, name: string) {
  getChannel()?.postMessage({ type: "ping", from: SESSION_ID, role, name } satisfies BroadcastMessage);
}

export function subscribeBroadcast(handler: (msg: BroadcastMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (ev: MessageEvent<BroadcastMessage>) => {
    if (ev.data.from === SESSION_ID) return;
    handler(ev.data);
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}

export { SESSION_ID };
