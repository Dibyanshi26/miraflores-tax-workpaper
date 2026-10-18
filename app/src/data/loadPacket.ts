import type { Packet } from "../types/packet";

let cached: Packet | null = null;
let inflight: Promise<Packet> | null = null;

export async function loadPacket(url = "/packet.json"): Promise<Packet> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load packet: ${r.status} ${r.statusText}`);
      return r.json();
    })
    .then((data: Packet) => {
      cached = data;
      return data;
    });
  return inflight;
}

export function setPacket(p: Packet) {
  cached = p;
  inflight = null;
}

export function getCachedPacket(): Packet | null {
  return cached;
}
