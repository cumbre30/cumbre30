"use client";

// ============================================================
// Sincronización de progreso APK ↔ servidor (cumbregeo.cl).
//
// La promesa al usuario: tu progreso queda guardado en tu cuenta.
// Este módulo la cumple en el APK (export estático):
//
//  · PUSH  - cada ride/logro/cambio de perfil se encola en IndexedDB
//    (outbox duradero) y se sube al servidor con Authorization: Bearer
//    (token de /api/auth/token o /api/auth/google). Si no hay red,
//    queda en la cola y reintenta solo al volver la conexión.
//  · PULL  - al vincular la cuenta y en cada arranque con sesión,
//    baja los rides y logros del servidor y los fusiona en el
//    historial local (deduplicado por clientId): cambiar de teléfono
//    o reinstalar recupera km, logros y pines.
//
// Silencioso por diseño: nunca bloquea la app; el estado queda
// visible en Perfil → Sincronización.
// ============================================================

import { apiUrl } from "@/lib/backend";
import { isOfflineMode, offlineUnlockAchievements } from "@/lib/offlineAuth";
import {
  applyFreeCap,
  historyStore,
  migrateTracksToIdb,
  writeAllRides,
  type RideSummary,
} from "@/lib/history";
import { isProActive } from "@/lib/proLicense";
import { outboxAdd, outboxAll, outboxClear, outboxDelete } from "@/lib/idb";

const TOKEN_KEY = "cumbre30-sync-token-v1";
const PULL_KEY = "cumbre30-sync-pull-v1";
const AUTH_JSON = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

// ---------- estado observable para la UI ----------

export type SyncPhase = "off" | "unlinked" | "ok" | "syncing" | "offline" | "error";

/** Por qué quedó sin vincular (guía la UI de la tarjeta de sync). */
export type LinkReason = "passDistinta" | "sinPass" | null;

export type SyncStatus = {
  phase: SyncPhase;
  /** Operaciones esperando subir. */
  pending: number;
  /** Última sync completa (ISO) o null. */
  lastSyncAt: string | null;
  /** Correo de la cuenta vinculada al servidor (o null). */
  email: string | null;
  /** Motivo del "unlinked": contraseña distinta en el servidor o cuenta
   *  de Google sin contraseña. null en las demás fases. */
  linkReason: LinkReason;
};

let status: SyncStatus = { phase: "off", pending: 0, lastSyncAt: null, email: null, linkReason: null };
const listeners = new Set<() => void>();

// Snapshot estable para SSR/hidratación (React exige una referencia fija).
const SERVER_SNAPSHOT: SyncStatus = { phase: "off", pending: 0, lastSyncAt: null, email: null, linkReason: null };

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

function syncStatusStore() {
  return {
    subscribe(l: () => void): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get(): SyncStatus {
      return status;
    },
    getServer(): SyncStatus {
      return SERVER_SNAPSHOT;
    },
  };
}

/** Hook-ready: mismo contrato que historyStore (useSyncExternalStore). */
export const syncStore = syncStatusStore();

function refreshPending(): Promise<void> {
  return outboxAll().then((ops) => setStatus({ pending: ops.length }));
}

// ---------- token de sesión (Bearer) ----------

type SyncToken = { token: string; email: string; expiresAt: string };

function readToken(): SyncToken | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as SyncToken;
    if (!t.token || !t.email) return null;
    if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now()) return null;
    return t;
  } catch {
    return null;
  }
}

/** Token Bearer vigente para llamadas a la API desde el APK (null si no hay). */
export function serverToken(): string | null {
  return readToken()?.token ?? null;
}

/** Correo de la cuenta vinculada al servidor (null si no hay token vigente). */
export function serverEmail(): string | null {
  return readToken()?.email ?? null;
}

function setToken(t: SyncToken): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  } catch {
    // sin almacenamiento: el sync solo vivirá en esta carga
  }
  setStatus({ phase: "ok", email: t.email, linkReason: null });
}

export function forgetToken(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // sin almacenamiento
    }
  }
  setStatus({ phase: "off", email: null, linkReason: null });
}

/**
 * Token recibido directo del servidor (importación de cuenta web:
 * POST /api/auth/login devuelve token para orígenes del APK).
 */
export function setServerToken(token: string, email: string, expiresAt?: string): void {
  if (!token) return;
  setToken({
    token,
    email: email.trim().toLowerCase(),
    expiresAt: expiresAt ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  });
  void syncNow(); // pull inmediato: km y logros de la cuenta llegan al teléfono
}

/** Borra token y cola (baja de cuenta en el dispositivo). */
export async function forgetAllSyncData(): Promise<void> {
  forgetToken();
  await outboxClear();
  await refreshPending();
}

// ---------- vinculación de cuenta (login/registro/Google/import) ----------

function baseOrLog(): string | null {
  const base = apiUrl("");
  if (base === null) {
    // APK sin backend configurado (sin override ni origen horneado)
    setStatus({ phase: "unlinked" });
    return null;
  }
  return base;
}

/** Cuenta por correo/contraseña: pide token al servidor. */
export async function linkPassword(email: string, password: string): Promise<void> {
  const base = baseOrLog();
  if (base === null) return;
  try {
    const r = await fetch(`${base}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      // Contraseña distinta en el servidor o cuenta sin contraseña
      // (Google): queda "unlinked" con el motivo para que la UI guíe
      // la reparación (restablecer por correo / entrar con Google);
      // el progreso local sigue.
      const d = (await r.json().catch(() => ({}))) as { sinContrasena?: boolean };
      setStatus({ phase: "unlinked", linkReason: r.status === 409 || d.sinContrasena ? "sinPass" : "passDistinta" });
      return;
    }
    const d = (await r.json()) as { token: string; expiresAt: string; email: string };
    setToken({ token: d.token, email: d.email, expiresAt: d.expiresAt });
    void syncNow();
  } catch {
    setStatus({ phase: "offline", linkReason: null });
  }
}

/** Registro: crea también la cuenta en el servidor y la vincula. */
export async function registerAndLink(email: string, username: string, password: string): Promise<void> {
  const base = baseOrLog();
  if (base === null) return;
  try {
    // 409 (ya existe en el servidor) NO es error: puede ser la misma
    // cuenta creada antes desde la web - lo resuelve linkPassword.
    await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    setStatus({ phase: "offline" });
    return;
  }
  await linkPassword(email, password);
}

/** Cuenta Google: intercambia el idToken nativo por un token de sesión.
 *  `aceptacion` viaja al servidor: una cuenta NUEVA exige los mismos
 *  Términos/edad que el registro (uniformidad A-01/B-05). */
export async function linkGoogle(idToken: string, aceptacion?: { terminos: boolean; edad14: boolean }): Promise<void> {
  const base = baseOrLog();
  if (base === null) return;
  try {
    const r = await fetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, ...(aceptacion ?? {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      setStatus({ phase: "unlinked" });
      return;
    }
    const d = (await r.json()) as { token: string; expiresAt: string; email: string };
    setToken({ token: d.token, email: d.email, expiresAt: d.expiresAt });
    void syncNow();
  } catch {
    setStatus({ phase: "offline" });
  }
}

// ---------- contraseña del servidor (cuenta Google nueva / Gestionar) ----------

/** POST autenticado con el token de sesión del dispositivo.
 *  Devuelve el error del servidor o null si quedó aplicado (o si no
 *  hay token/red: el llamador resuelve con su parte local). */
async function postAutenticado(path: string, payload: Record<string, unknown>): Promise<string | null> {
  const base = baseOrLog();
  const t = readToken();
  if (base === null || !t) return null;
  try {
    const r = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      return d.error ?? "El servidor no aceptó el cambio de contraseña.";
    }
    return null;
  } catch {
    return null; // sin red: la parte local ya quedó; el server se ajusta con el flujo de recuperación
  }
}

/** Crea la contraseña inicial en el servidor (cuenta Google nueva,
 *  paso posterior al primer ingreso). */
export async function passwordInicialServidor(password: string): Promise<string | null> {
  return postAutenticado("/api/auth/password", { password });
}

/** Cambia la contraseña en el servidor (Cuenta → Gestionar). */
export async function cambiarPasswordServidor(actual: string, nueva: string): Promise<string | null> {
  return postAutenticado("/api/me/password", { passwordActual: actual, passwordNueva: nueva });
}

// ---------- outbox ----------

/** Encola una operación de sync y agenda el envío. Fire-and-forget.
 *  Fase A: ampliado con "route.create" | "route.update" |
 *  "route.delete" (módulo Rutas y Comunidad). */
export async function enqueueOp(
  kind: "ride" | "achievement" | "profile" | "rideMotorized" | "route.create" | "route.update" | "route.delete",
  payload: Record<string, unknown>
): Promise<void> {
  if (!isOfflineMode()) return; // la web sube directo con su cookie
  await outboxAdd(kind, payload);
  await refreshPending();
  scheduleSync();
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Agenda una sync con debounce corto para agrupar ráfagas. */
export function scheduleSync(delayMs = 2_500): void {
  if (!readToken()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncNow();
  }, delayMs);
}

// ---------- push (drain del outbox) ----------

function endpointFor(kind: "ride" | "achievement" | "profile" | "rideMotorized" | "route.create" | "route.update" | "route.delete", payload?: Record<string, unknown>): { path: string; method: "POST" | "PUT" | "PATCH" | "DELETE" } {
  switch (kind) {
    case "achievement":
      return { path: "/api/achievements", method: "POST" };
    case "profile":
      return { path: "/api/me", method: "PUT" };
    case "rideMotorized":
      return { path: "/api/rides", method: "PATCH" };
    // Rutas y Comunidad (fase A): el id del servidor viaja en el payload.
    case "route.create":
      return { path: "/api/routes", method: "POST" };
    case "route.update":
      return { path: `/api/routes/${encodeURIComponent(String(payload?.id ?? ""))}`, method: "PATCH" };
    case "route.delete":
      return { path: `/api/routes/${encodeURIComponent(String(payload?.id ?? ""))}`, method: "DELETE" };
    case "ride":
    default:
      return { path: "/api/rides", method: "POST" };
  }
}

type DrainResult = "ok" | "offline" | "reauth" | "error";

async function drainOutbox(token: string, base: string): Promise<DrainResult> {
  for (;;) {
    const ops = await outboxAll();
    if (!ops.length) return "ok";
    const op = ops[0];
    if (!op.id) return "error"; // op malformada: no se puede confirmar
    const { path, method } = endpointFor(op.kind, op.payload);
    let res: Response | null = null;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: AUTH_JSON(token),
        body: method === "DELETE" ? undefined : JSON.stringify(op.payload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return "offline"; // sin red: la op queda en la cola
    }
    if (res.status === 401) return "reauth"; // token vencido/inválido
    // 404 permanente = el objetivo ya no existe en el servidor:
    // nada que corregir (rideMotorized) o la ruta ya se borró
    // (route.update / route.delete): la op se confirma igual.
    const permanent404 = res.status === 404 && ["rideMotorized", "route.update", "route.delete"].includes(op.kind);
    if (res.ok || permanent404) {
      await outboxDelete(op.id);
      await refreshPending();
      continue;
    }
    if (res.status >= 400 && res.status < 500) {
      // Datos rechazados en firme: soltar la op para no envenenar la cola.
      await outboxDelete(op.id);
      await refreshPending();
      continue;
    }
    // 5xx: reintento más tarde (con techo de intentos).
    op.attempts += 1;
    if (op.attempts > 8) {
      await outboxDelete(op.id);
      await refreshPending();
      continue;
    }
    return "offline"; // pausa: próxima sync reintenta desde esta op
  }
}

// ---------- pull (rides + logros del servidor) ----------

export type ServerRide = {
  id: string;
  clientId?: string | null;
  dateISO: string;
  source?: string;
  distanceKm: number;
  maxKmh: number;
  maxInParkKmh?: number | null;
  inParkKm?: number | null;
  motorized?: boolean;
  avgKmh: number;
  elapsedSec: number;
  gainM: number;
  overLimitSec: number;
};

/**
 * Fusiona rides del servidor en el historial local (función PURA,
 * probada en scripts/test-sync-merge.mjs). Dedupe por id local
 * (clientId del dispositivo, o srv-<id> para rides creados en web).
 */
export function mergeServerRides(local: RideSummary[], server: ServerRide[], email: string): { list: RideSummary[]; added: number } {
  const mail = email.trim().toLowerCase();
  const ids = new Set(local.map((r) => r.id));
  const add: RideSummary[] = [];
  for (const r of server) {
    const id = r.clientId || `srv-${r.id}`;
    if (ids.has(id)) continue;
    ids.add(id);
    add.push({
      id,
      dateISO: r.dateISO,
      source: r.source === "gps" ? "gps" : "sim",
      distanceKm: r.distanceKm,
      maxKmh: r.maxKmh,
      maxInParkKmh: r.maxInParkKmh ?? null,
      inParkKm: r.inParkKm ?? null,
      avgKmh: r.avgKmh,
      elapsedSec: r.elapsedSec,
      gainM: r.gainM,
      overLimitSec: r.overLimitSec,
      motorized: r.motorized === true ? true : undefined,
      account: mail,
    });
  }
  if (!add.length) return { list: local, added: 0 };
  const list = [...local, ...add].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  return { list, added: add.length };
}

function pullState(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PULL_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function setPullState(email: string, iso: string): void {
  if (typeof window === "undefined") return;
  try {
    const s = pullState();
    s[email] = iso;
    window.localStorage.setItem(PULL_KEY, JSON.stringify(s));
  } catch {
    // sin almacenamiento: el pull repetirá (la fusión es idempotente)
  }
}

async function pullServer(token: string, email: string, base: string): Promise<DrainResult> {
  const mail = email.trim().toLowerCase();

  // 1) Rides del servidor → historial local.
  let ridesRes: Response;
  try {
    ridesRes = await fetch(`${base}/api/rides`, {
      headers: AUTH_JSON(token),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return "offline";
  }
  if (ridesRes.status === 401) return "reauth";

  // 2) Logros del servidor → cuenta local (idempotente).
  try {
    const meRes = await fetch(`${base}/api/me`, {
      headers: AUTH_JSON(token),
      signal: AbortSignal.timeout(20_000),
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as { achievements?: { code: string }[] };
      if (Array.isArray(me.achievements) && me.achievements.length) {
        offlineUnlockAchievements(me.achievements.map((a) => a.code));
      }
    }
  } catch {
    // logros pendientes para la próxima sync; los rides ya viajaron
  }

  if (ridesRes.ok) {
    const d = (await ridesRes.json().catch(() => null)) as { rides?: ServerRide[] } | null;
    const rows = d?.rides ?? [];
    const lastPull = pullState()[mail] ?? null;
    // Solo rides nuevos desde el último pull (evita re-agregar los que
    // el tope freemium podó localmente). El dedupe por id es cinturón
    // y tirantes sobre este filtro.
    const fresh = lastPull ? rows.filter((r) => r.dateISO > lastPull) : rows;
    const merged = mergeServerRides(historyStore.get(), fresh, mail);
    if (merged.added) {
      writeAllRides(applyFreeCap(merged.list, isProActive()));
    }
    const newest = rows.reduce<string | null>((acc, r) => (!acc || r.dateISO > acc ? r.dateISO : acc), null);
    if (newest) setPullState(mail, newest);
  }
  return "ok";
}

// ---------- syncNow ----------

let syncing = false;

/** Sync completa: drena el outbox y baja lo nuevo del servidor. */
export async function syncNow(): Promise<void> {
  if (syncing) return;
  if (typeof window === "undefined") return;
  const t = readToken();
  if (!t) return;
  const base = apiUrl("");
  if (base === null) {
    setStatus({ phase: "unlinked" });
    return;
  }
  syncing = true;
  setStatus({ phase: "syncing" });
  let result: DrainResult = "ok";
  try {
    result = await drainOutbox(t.token, base);
    if (result === "ok") result = await pullServer(t.token, t.email, base);
  } catch {
    result = "error";
  } finally {
    syncing = false;
  }
  const pending = (await outboxAll()).length;
  const phase: SyncPhase =
    result === "ok" ? "ok"
    : result === "reauth" ? "unlinked"
    : result === "offline" ? "offline"
    : "error";
  setStatus({
    phase,
    pending,
    email: t.email,
    lastSyncAt: result === "ok" ? new Date().toISOString() : status.lastSyncAt,
    linkReason: null,
  });
}

/** Disparada desde la UI (Perfil → Sincronizar ahora). */
export async function manualSync(): Promise<void> {
  if (!isOfflineMode()) return; // la web ya sincroniza con su sesión
  await syncNow();
}

// ---------- arranque ----------

if (typeof window !== "undefined") {
  // Al volver la conexión, drena la cola.
  window.addEventListener("online", () => {
    if (readToken()) void syncNow();
  });
  // Arranque: pull de rides/logros y poda de pistas a IndexedDB.
  setTimeout(() => {
    void migrateTracksToIdb();
    if (readToken()) void syncNow();
    void refreshPending();
  }, 3_500);
}
