// ============================================================
// Constancia de trayecto VERIFICABLE EN LÍNEA (2026-11-14).
// ------------------------------------------------------------
// Cada constancia PDF lleva ahora un QR con un enlace a
// cumbregeo.cl/verificar que contiene:
//   · los datos del trayecto (payload compacto),
//   · un código de integridad SHA-256 del payload.
//
// La página /verificar reconstruye el hash en el dispositivo de
// quien escanea (integridad) y ADEMÁS consulta el registro en
// línea (tabla Constancia, POST en la emisión) para confirmar
// que la app del ciclista emitió ese documento ese día.
//
// Sin dependencias del DOM: corre en el cliente de la app, en la
// página de verificación y en Node (pruebas).
// ============================================================

import { APP_VERSION } from "./appVersion";
import type { RideSummary } from "./history";
import type { RideIdentity } from "./ridePdf";

export const VERIFICAR_ORIGEN = "https://cumbregeo.cl";

/** Payload compacto y estable de la constancia (claves cortas). */
export type ConstanciaPayload = {
  v: string; // versión de la app emisora
  id: string; // id del ride (completo)
  d: string; // fecha de término (ISO)
  k: number; // distancia km (2 decimales)
  s: number; // duración s (entero)
  g: number; // desnivel positivo m (entero)
  mx: number; // velocidad máxima km/h (1 decimal)
  mp: number | null; // velocidad máxima en el parque (1 decimal, null si no entró)
  o: number; // segundos sobre el límite (entero)
  src: "gps" | "sim"; // origen del registro
  u?: string; // usuario en la app (opcional)
  n?: string; // nombre declarado (opcional, sin correo por privacidad)
};

/** Construye el payload desde el ride y la identidad del PDF. */
export function buildConstanciaPayload(r: RideSummary, identity?: RideIdentity): ConstanciaPayload {
  const id = identity ?? {};
  return {
    v: APP_VERSION,
    id: r.id,
    d: r.dateISO,
    k: Math.round(r.distanceKm * 100) / 100,
    s: Math.round(r.elapsedSec),
    g: Math.round(r.gainM),
    mx: Math.round(r.maxKmh * 10) / 10,
    mp: r.maxInParkKmh === null || r.maxInParkKmh === undefined ? null : Math.round(r.maxInParkKmh * 10) / 10,
    o: Math.round(r.overLimitSec),
    src: r.source,
    u: id.username?.trim() ? id.username.trim() : undefined,
    n: id.name?.trim() ? id.name.trim() : undefined,
  };
}

/** Serialización canónica (orden de claves fijo → hash estable). */
function canon(p: ConstanciaPayload): string {
  const o: Record<string, unknown> = {
    v: p.v,
    id: p.id,
    d: p.d,
    k: p.k,
    s: p.s,
    g: p.g,
    mx: p.mx,
    mp: p.mp,
    o: p.o,
    src: p.src,
  };
  if (p.u) o.u = p.u;
  if (p.n) o.n = p.n;
  return JSON.stringify(o);
}

const SALT = "cumbre30-constancia-v1";

/** SHA-256 hex (WebCrypto) con fallback interno (mismo criterio que ridePdf). */
async function sha256Hex(input: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const buf = await subtle.digest("SHA-256", new TextEncoder().encode(input));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // usar fallback
  }
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h = (h ^ input.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return (fnv(0x811c9dc5) + fnv(0x01000193) + fnv(0xdeadbeef) + fnv(0x1234567)).repeat(2).slice(0, 64);
}

/** Hash SHA-256 del contenido de la constancia (64 hex). */
export async function constanciaHash(p: ConstanciaPayload): Promise<string> {
  return sha256Hex(SALT + canon(p));
}

/** Código corto mostrado en el PDF y a mano: C30-XXXX-XXXX. */
export function codigoCorto(hash: string): string {
  const h = hash.slice(0, 8).toUpperCase();
  return `C30-${h.slice(0, 4)}-${h.slice(4, 8)}`;
}

// ---------- base64url isomórfico ----------

function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const B: any = globalThis as unknown as { btoa?: (x: string) => string; Buffer?: { from(x: string, e: string): { toString(e: string): string } } };
  const b64 = B.btoa ? B.btoa(bin) : B.Buffer ? B.Buffer.from(s, "utf8").toString("base64") : "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64decode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const B: any = globalThis as unknown as { atob?: (x: string) => string; Buffer?: { from(x: string, e: string): { toString(e: string): string } } };
  const bin = B.atob ? B.atob(pad) : B.Buffer ? B.Buffer.from(pad, "base64").toString("binary") : "";
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---------- enlace del QR ----------

export type ConstanciaEnlace = {
  payload: ConstanciaPayload;
  hash: string; // SHA-256 completo (64 hex)
  code: string; // C30-XXXX-XXXX
  url: string; // https://cumbregeo.cl/verificar#d=...
  data: string; // segmento base64url embebido
};

/** Construye el enlace verificable completo para el QR del PDF. */
export async function buildConstanciaEnlace(p: ConstanciaPayload): Promise<ConstanciaEnlace> {
  const hash = await constanciaHash(p);
  const embedded = JSON.stringify({ ...p, h: hash.slice(0, 16) });
  const data = b64encode(embedded);
  const url = `${VERIFICAR_ORIGEN}/verificar#d=${data}`;
  return { payload: p, hash, code: codigoCorto(hash), url, data };
}

// ---------- decodificación (página /verificar) ----------

export type DecodeOk = {
  ok: true;
  payload: ConstanciaPayload;
  hash: string;
  code: string;
  /** El hash embebido coincide con el recomputado (si venía). */
  integridad: boolean;
};
export type DecodeErr = { ok: false; reason: "formato" | "integridad" };

/** Extrae el segmento base64url de un enlace pegado (o lo acepta directo). */
export function extraerData(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/#d=([A-Za-z0-9\-_]+)/) ?? s.match(/[?&]d=([A-Za-z0-9\-_]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9\-_]{40,}$/.test(s)) return s;
  return null;
}

export async function decodeConstancia(data: string): Promise<DecodeOk | DecodeErr> {
  let json: unknown;
  try {
    json = JSON.parse(b64decode(data));
  } catch {
    return { ok: false, reason: "formato" };
  }
  if (!json || typeof json !== "object") return { ok: false, reason: "formato" };
  const j = json as Record<string, unknown>;
  const p: ConstanciaPayload = {
    v: typeof j.v === "string" ? j.v : "",
    id: typeof j.id === "string" ? j.id : "",
    d: typeof j.d === "string" ? j.d : "",
    k: typeof j.k === "number" ? j.k : NaN,
    s: typeof j.s === "number" ? j.s : NaN,
    g: typeof j.g === "number" ? j.g : NaN,
    mx: typeof j.mx === "number" ? j.mx : NaN,
    mp: typeof j.mp === "number" ? Math.round(j.mp * 10) / 10 : null,
    o: typeof j.o === "number" ? j.o : NaN,
    src: j.src === "sim" ? "sim" : "gps",
    u: typeof j.u === "string" ? j.u : undefined,
    n: typeof j.n === "string" ? j.n : undefined,
  };
  if (!p.v || !p.id || !p.d || !isFinite(p.k) || !isFinite(p.s)) return { ok: false, reason: "formato" };
  const recomputed = await constanciaHash(p);
  const embeddedH = typeof j.h === "string" ? j.h : null;
  const integridad = embeddedH ? recomputed.slice(0, embeddedH.length) === embeddedH : true;
  if (!integridad) return { ok: false, reason: "integridad" };
  return { ok: true, payload: p, hash: recomputed, code: codigoCorto(recomputed), integridad };
}

// ---------- registro en línea ----------

export type RegistroRes = { registered: boolean; createdAt: string | null; payloadOk: boolean };

/** URL de la API de constancias según contexto (web mismo origen / APK backend).
 *  Espeja backend.ts sin importarlo: así este módulo se puede prerenderizar
 *  en la página /verificar sin arrastrar @capacitor/core al servidor. */
function constanciasApiUrl(): string {
  let base: string | null = null;
  try {
    const v = window.localStorage.getItem("cumbre30_backend");
    base = v ? v.trim().replace(/\/+$/, "") || null : null;
  } catch {
    base = null;
  }
  if (!base) {
    const baked = (process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "").trim().replace(/\/+$/, "");
    if (baked) base = baked;
  }
  if (!base && typeof window !== "undefined") {
    // APK: el WebView nativo expone window.Capacitor
    if ((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
      base = VERIFICAR_ORIGEN;
    }
  }
  return `${base ?? ""}/api/constancias`;
}

/** Registra la constancia en línea al momento de la emisión (best-effort). */
export async function registerConstancia(p: ConstanciaPayload, hash: string): Promise<RegistroRes> {
  try {
    const res = await fetch(constanciasApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash, rideId: p.id, payload: p }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { registered: false, createdAt: null, payloadOk: false };
    const d = (await res.json()) as { ok?: boolean; createdAt?: string; payloadOk?: boolean };
    return { registered: !!d.ok, createdAt: d.createdAt ?? null, payloadOk: d.payloadOk !== false };
  } catch {
    return { registered: false, createdAt: null, payloadOk: false };
  }
}

/** Consulta el registro en línea (página /verificar). */
export async function queryConstancia(hash: string): Promise<RegistroRes> {
  try {
    const res = await fetch(`${constanciasApiUrl()}?hash=${encodeURIComponent(hash)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { registered: false, createdAt: null, payloadOk: false };
    const d = (await res.json()) as { registered?: boolean; createdAt?: string | null; payload?: unknown };
    return { registered: !!d.registered, createdAt: d.createdAt ?? null, payloadOk: !!d.payload };
  } catch {
    return { registered: false, createdAt: null, payloadOk: false };
  }
}
