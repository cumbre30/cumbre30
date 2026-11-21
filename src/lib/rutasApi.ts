// ============================================================
// Cliente de la API de rutas (fase A, módulo Rutas y Comunidad).
// Patrón vigente en la app: web → fetch relativo con la cookie
// httpOnly; APK → URL absoluta del backend (apiUrl) con Bearer
// (cloudSync.ts). Sin red en el APK: la operación queda en el
// outbox ampliado (route.create/update/delete) y reintentará
// sola al reconectar — el servidor resuelve por clientId en la
// creación para que el reintento no duplique.
// ============================================================

import { apiUrl } from "./backend";
import { serverToken, enqueueOp } from "./cloudSync";

export type PayloadRuta = {
  clientId?: string;
  nombre: string;
  descripcion?: string | null;
  modalidad: string;
  /** Geometría PÚBLICA protegida (el original no sale del dispositivo). */
  coords: { lat: number; lon: number }[];
  attrs?: string[];
  dificultadFisica?: number;
  dificultadTecnica?: number;
  proteccion?: Record<string, unknown> | null;
  ele?: { gainM?: number | null; lossM?: number | null; minEle?: number | null; maxEle?: number | null };
  eleFuente?: string;
  pois?: { lat: number; lon: number; tipo: string; nombre: string; nota?: string }[];
};

export type RespuestaRuta =
  | { ok: true; id: string; versionId: string | null; version: number; dedup?: boolean }
  | { ok: false; error: string };

function base(): string | null {
  return apiUrl("");
}

/** URL absoluta (APK) o relativa (web) para un path de la API. */
function url(path: string): string | null {
  const b = base();
  if (b === null) return null; // APK sin backend configurado
  return `${b}${path}`;
}

async function fetchRuta(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<RespuestaRuta> {
  const target = url(path);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const token = serverToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  // En web la cookie httpOnly va sola; en APK el Bearer. Sin token en
  // el APK el servidor responde 401 y la UI pide vincular cuenta.
  try {
    const res = await fetch(target, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) {
      return {
        ok: true,
        id: typeof d.id === "string" ? d.id : "",
        versionId: typeof d.versionId === "string" ? d.versionId : null,
        version: typeof d.version === "number" ? d.version : 1,
        dedup: d.dedup === true,
      };
    }
    return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Publica una ruta (crea en el servidor). Sin red en el APK con
 *  cuenta vinculada: queda en el outbox (route.create). */
export async function publicarRuta(p: PayloadRuta): Promise<RespuestaRuta> {
  const payload = { ...p, clientId: p.clientId ?? crypto.randomUUID() };
  const r = await fetchRuta("/api/routes", "POST", payload);
  if (!r.ok && r.error === "Sin red.") {
    await enqueueOp("route.create", payload as unknown as Record<string, unknown>);
    return { ok: false, error: "encolada" };
  }
  return r;
}

/** Edita una ruta propia (PATCH). Sin red: queda en el outbox
 *  (route.update) con el id del servidor en el payload. */
export async function editarRuta(id: string, patch: Partial<PayloadRuta> & { ultimaRevisionAt?: true }): Promise<RespuestaRuta> {
  const r = await fetchRuta(`/api/routes/${encodeURIComponent(id)}`, "PATCH", patch);
  if (!r.ok && r.error === "Sin red.") {
    await enqueueOp("route.update", { id, ...patch } as unknown as Record<string, unknown>);
    return { ok: false, error: "encolada" };
  }
  return r;
}

// ============================================================
// Fase D: catálogo público y elevación resuelta en el servidor.
// ============================================================

export type RutaPublica = {
  id: string;
  nombre: string;
  descripcion: string | null;
  modalidad: string;
  distKm: number;
  gainM: number | null;
  eleFuente: string | null;
  dificultadFisica: number;
  dificultadTecnica: number;
  attrs: string[];
  estadoVigencia: string;
  ultimaRevisionAt: string | null;
  createdAt: string;
  polyline: string;
  inicioAproxLat: number | null;
  inicioAproxLon: number | null;
  finAproxLat: number | null;
  finAproxLon: number | null;
  centerLat: number;
  centerLon: number;
  version: number;
  creador: string;
};

export type ConsultaCatalogo = {
  n: number; s: number; e: number; o: number;
  q?: string; modalidad?: string; dif?: number; attrs?: string[];
  cursor?: string; take?: number;
};

export type RespuestaCatalogo =
  | { ok: true; routes: RutaPublica[]; nextCursor: string | null; notaBbox: string }
  | { ok: false; error: string };

/** Catálogo por área: lectura con sesión; sin red responde honesto
 *  (el catálogo no se cachea — la comunidad cambia en vivo). */
export async function catalogoRutas(c: ConsultaCatalogo): Promise<RespuestaCatalogo> {
  const target = url("/api/routes/catalog");
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const qs = new URLSearchParams({
    n: String(c.n), s: String(c.s), e: String(c.e), o: String(c.o),
  });
  if (c.q) qs.set("q", c.q);
  if (c.modalidad) qs.set("modalidad", c.modalidad);
  if (c.dif) qs.set("dif", String(c.dif));
  if (c.attrs?.length) qs.set("attrs", c.attrs.join(","));
  if (c.cursor) qs.set("cursor", c.cursor);
  if (c.take) qs.set("take", String(c.take));
  const token = serverToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${target}?${qs.toString()}`, { headers, signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    const routes = Array.isArray(d.routes) ? (d.routes as RutaPublica[]) : [];
    const next = d.nextCursor as { id?: string } | null;
    return { ok: true, routes, nextCursor: next?.id ?? null, notaBbox: typeof d.notaBbox === "string" ? d.notaBbox : "" };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Detalle público de una ruta (geometría protegida + POIs + versiones). */
export type RutaDetalle = RutaPublica & {
  pois: { id: string; orden: number; lat: number; lon: number; tipo: string; nombre: string; nota: string | null }[];
  versions: { id: string; v: number; publishedAt: string }[];
  ultimaRevisionAt: string | null;
  estadoVigencia: string;
  owner?: { username?: string } | null;
};

export type RespuestaDetalle =
  | { ok: true; route: RutaDetalle }
  | { ok: false; error: string };

export async function detalleRuta(id: string): Promise<RespuestaDetalle> {
  const target = url(`/api/routes/${encodeURIComponent(id)}`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const token = serverToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(target, { headers, signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    const raw = d.route as RutaDetalle;
    // Normalización: creador (username público) y versión vigente.
    const route: RutaDetalle = {
      ...raw,
      creador: raw.creador || raw.owner?.username || "",
      version: raw.version || raw.versions?.[raw.versions.length - 1]?.v || 1,
    };
    return { ok: true, route };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** «Recalcular elevación» desde la ficha (solo el creador, en el
 *  servidor, idempotente por RouteVersion). */
export type RespuestaElevacion = { ok: boolean; error?: string; ele?: { gainM: number; lossM: number; minEle: number; maxEle: number } };
export async function recalcularElevacion(id: string): Promise<RespuestaElevacion> {
  const target = url(`/api/routes/${encodeURIComponent(id)}/elevacion`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const token = serverToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(target, { method: "POST", headers, signal: AbortSignal.timeout(20_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, ele: d.ele as RespuestaElevacion["ele"] };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Borra una ruta propia (soft-delete en el servidor). Sin red:
 *  queda en el outbox (route.delete). */
export async function borrarRuta(id: string): Promise<RespuestaRuta> {
  const r = await fetchRuta(`/api/routes/${encodeURIComponent(id)}`, "DELETE");
  if (!r.ok && r.error === "Sin red.") {
    await enqueueOp("route.delete", { id });
    return { ok: false, error: "encolada" };
  }
  return r;
}
