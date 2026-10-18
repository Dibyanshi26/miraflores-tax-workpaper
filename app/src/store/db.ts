import { openDB, type IDBPDatabase } from "idb";
import type { WorkpaperEvent } from "../types/domain";

const DB_NAME = "miraflores-workpaper";
const DB_VERSION = 1;
const STORE = "events";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by_at", "at");
          store.createIndex("by_type", "type");
          store.createIndex("by_target", "target.id");
        }
      },
    });
  }
  return dbPromise;
}

export async function dbPutEvent(event: WorkpaperEvent): Promise<void> {
  const db = await getDb();
  await db.put(STORE, event);
}

export async function dbPutEvents(events: WorkpaperEvent[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  await Promise.all([...events.map((e) => tx.store.put(e)), tx.done]);
}

export async function dbGetAllEvents(): Promise<WorkpaperEvent[]> {
  const db = await getDb();
  const all = await db.getAll(STORE);
  return (all as WorkpaperEvent[]).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export async function dbClearEvents(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}

export async function dbDeleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}
