"use client";

// ============================================================
// IndexedDB de Cumbre30 - almacenamiento local duradero para lo
// que no cabe o no debería vivir en localStorage:
//   · outbox  → operaciones de sync pendientes (rides, logros,
//     perfil) que sobreviven al cierre del app y reintentan solo.
//   · tracks  → pistas GPS completas por ride (los rides viejos
//     se podan de localStorage y su pista queda aquí).
// Si IndexedDB no está disponible (WebView restringido), cae a un
// respaldo en localStorage: menor capacidad, pero la app funciona.
// ============================================================

const DB_NAME = "cumbre30-idb-v1";
const OUTBOX = "outbox";
const TRACKS = "tracks";
const FALLBACK_KEY = "cumbre30-idb-fallback-v1";

export type OutboxOp = {
  id?: number;
  kind: "ride" | "achievement" | "profile" | "rideMotorized";
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

type TrackRow = { rideId: string; track: unknown };

let dbp: Promise<IDBDatabase | null> | null = null;

/** Abre la DB una sola vez; null si IndexedDB no está disponible. */
function openDb(): Promise<IDBDatabase | null> {
  if (!dbp) {
    dbp = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") return resolve(null);
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(OUTBOX)) {
            db.createObjectStore(OUTBOX, { keyPath: "id", autoIncrement: true });
          }
          if (!db.objectStoreNames.contains(TRACKS)) {
            db.createObjectStore(TRACKS, { keyPath: "rideId" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbp;
}

// ---------- respaldo localStorage (mismas operaciones) ----------

type Fallback = { outbox: OutboxOp[]; tracks: TrackRow[]; seq: number };

function fbRead(): Fallback {
  if (typeof window === "undefined") return { outbox: [], tracks: [], seq: 0 };
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw
      ? (JSON.parse(raw) as Fallback)
      : { outbox: [], tracks: [], seq: 0 };
  } catch {
    return { outbox: [], tracks: [], seq: 0 };
  }
}

function fbWrite(f: Fallback): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(f));
  } catch {
    // sin almacenamiento: no se puede persistir el respaldo
  }
}

// ---------- pistas GPS ----------

export async function putTrack(rideId: string, track: unknown): Promise<void> {
  const db = await openDb();
  if (!db) {
    const f = fbRead();
    const i = f.tracks.findIndex((t) => t.rideId === rideId);
    if (i >= 0) f.tracks[i] = { rideId, track };
    else f.tracks.push({ rideId, track });
    fbWrite(f);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(TRACKS, "readwrite");
    tx.objectStore(TRACKS).put({ rideId, track } satisfies TrackRow);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

export async function getTrack(rideId: string): Promise<TrackPtLike[] | null> {
  const db = await openDb();
  if (!db) {
    const f = fbRead();
    const hit = f.tracks.find((t) => t.rideId === rideId)?.track as TrackPtLike[] | undefined;
    return hit ?? null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(TRACKS, "readonly");
    const req = tx.objectStore(TRACKS).get(rideId);
    req.onsuccess = () => resolve(((req.result as TrackRow | undefined)?.track ?? null) as TrackPtLike[] | null);
    req.onerror = () => resolve(null);
  });
}

export async function deleteTrack(rideId: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    const f = fbRead();
    f.tracks = f.tracks.filter((t) => t.rideId !== rideId);
    fbWrite(f);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(TRACKS, "readwrite");
    tx.objectStore(TRACKS).delete(rideId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Puntos de pista (igual que TrackPt de history.ts, sin importarlo). */
export type TrackPtLike = [number, number, number, number];

// ---------- outbox ----------

export async function outboxAdd(kind: OutboxOp["kind"], payload: Record<string, unknown>): Promise<void> {
  const op: Omit<OutboxOp, "id"> = { kind, payload, createdAt: new Date().toISOString(), attempts: 0 };
  const db = await openDb();
  if (!db) {
    const f = fbRead();
    f.outbox.push({ ...op, id: ++f.seq });
    fbWrite(f);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(OUTBOX, "readwrite");
    tx.objectStore(OUTBOX).add(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function outboxAll(): Promise<OutboxOp[]> {
  const db = await openDb();
  if (!db) return fbRead().outbox.slice().sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  return new Promise((resolve) => {
    const tx = db.transaction(OUTBOX, "readonly");
    const req = tx.objectStore(OUTBOX).getAll();
    req.onsuccess = () => {
      const ops = (req.result as OutboxOp[]) ?? [];
      ops.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      resolve(ops);
    };
    req.onerror = () => resolve([]);
  });
}

export async function outboxDelete(id: number): Promise<void> {
  const db = await openDb();
  if (!db) {
    const f = fbRead();
    f.outbox = f.outbox.filter((o) => o.id !== id);
    fbWrite(f);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(OUTBOX, "readwrite");
    tx.objectStore(OUTBOX).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function outboxClear(): Promise<void> {
  const db = await openDb();
  if (!db) {
    const f = fbRead();
    f.outbox = [];
    fbWrite(f);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(OUTBOX, "readwrite");
    tx.objectStore(OUTBOX).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
