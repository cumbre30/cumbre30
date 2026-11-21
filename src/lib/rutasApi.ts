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

/** Headers de sesión: Bearer en el APK, cookie sola en la web. */
function sessionHeaders(): Record<string, string> {
  const token = serverToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchRuta(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<RespuestaRuta> {
  const target = url(path);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
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
  /** Fase E — comunidad del detalle (lo mío incluido). */
  comunidad?: {
    comentarios: { id: string; body: string; createdAt: string; username: string }[];
    experiencias: { id: string; fechaRealizacion: string; comentario: string | null; observacion: string | null; condiciones: string[]; username: string; pro?: boolean; fotos?: string[] }[];
    /** Propuesta Pro (Grupo B): paginación del historial. */
    expHayMas?: boolean;
    expCursor?: string | null;
    valoracionPromedio: number | null;
    valoracionVotos: number;
    favoritos: number;
    miFavorito: boolean;
    miValoracion: number | null;
  };
};

export type RespuestaDetalle =
  | { ok: true; route: RutaDetalle }
  | { ok: false; error: string };

export async function detalleRuta(id: string, expCursor?: string | null): Promise<RespuestaDetalle> {
  const target = url(`/api/routes/${encodeURIComponent(id)}${expCursor ? `?expCursor=${encodeURIComponent(expCursor)}` : ""}`);
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

// ============================================================
// Fase E: comunidad (favoritos, valoraciones, comentarios,
// reportes, experiencias) y moderación por roles.
// ============================================================

export type RespuestaComunidad = { ok: boolean; error?: string; favorito?: boolean; valor?: number; promedio?: number | null; votos?: number; ocultada?: boolean; loteSospechoso?: boolean; id?: string };

/** Toggle favorito (idempotente por usuario/ruta). */
export async function toggleFavorito(id: string): Promise<RespuestaComunidad> {
  const target = url(`/api/routes/${encodeURIComponent(id)}/favorite`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "POST", headers, signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, favorito: d.favorito === true };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Valorar 1-5 (upsert, actualizable — comodidad, no ranking). */
export async function valorarRuta(id: string, valor: number): Promise<RespuestaComunidad> {
  const target = url(`/api/routes/${encodeURIComponent(id)}/rating`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "POST", headers, body: JSON.stringify({ valor }), signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, valor, promedio: typeof d.promedio === "number" ? d.promedio : null, votos: typeof d.votos === "number" ? d.votos : 0 };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Comentar (≤1000). */
export async function comentarRuta(id: string, body: string): Promise<RespuestaComunidad> {
  const target = url(`/api/routes/${encodeURIComponent(id)}/comments`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "POST", headers, body: JSON.stringify({ body }), signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, id: typeof d.id === "string" ? d.id : undefined };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Borrar tu comentario (soft-delete). */
export async function borrarComentario(id: string, commentId: string): Promise<RespuestaComunidad> {
  const target = url(`/api/routes/${encodeURIComponent(id)}/comments?commentId=${encodeURIComponent(commentId)}`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "DELETE", headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

const MOTIVOS = ["cierre", "peligro", "error_geografico", "spam", "contenido_inapropiado"] as const;
export type MotivoReporteCli = (typeof MOTIVOS)[number];

/** Reportar (motivo cerrado; el servidor calcula el peso del
 *  reportante y evalúa el umbral ponderado §7.2). */
export async function reportarRuta(id: string, motivo: MotivoReporteCli, nota?: string): Promise<RespuestaComunidad> {
  const target = url(`/api/routes/${encodeURIComponent(id)}/report`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "POST", headers, body: JSON.stringify({ motivo, nota }), signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, ocultada: d.ocultada === true, loteSospechoso: d.loteSospechoso === true };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Registrar experiencia (una por usuario/ruta/fecha). */
export async function registrarExperiencia(id: string, e: { fechaRealizacion: string; comentario?: string; observacion?: string; condiciones?: string[]; rideId?: string }): Promise<RespuestaComunidad> {
  const target = url(`/api/routes/${encodeURIComponent(id)}/experience`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "POST", headers, body: JSON.stringify(e), signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, id: typeof d.id === "string" ? d.id : undefined };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

export type RutaFavorita = {
  id: string; nombre: string; modalidad: string; distKm: number; gainM: number | null;
  dificultadFisica: number; estadoVigencia: string; creador: string; favoritadoAt: string;
};

/** Mis favoritas (tab Favoritas de la biblioteca). */
export async function misFavoritas(): Promise<{ ok: boolean; error?: string; favoritas?: RutaFavorita[] }> {
  const target = url("/api/routes/favorites");
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { headers, signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, favoritas: Array.isArray(d.favoritas) ? (d.favoritas as RutaFavorita[]) : [] };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

// Muro público de experiencias (2026-11-21): feed de la subsección
// «Experiencias» del módulo Explorar. Lectura con sesión — sin cuenta
// el componente ni siquiera la llama (política de invitado, sin 401).
export type ExperienciaMuro = {
  id: string;
  fechaRealizacion: string;
  comentario: string | null;
  observacion: string | null;
  condiciones: string[];
  createdAt: string;
  username: string;
  pro: boolean;
  fotos: string[];
  ruta: {
    id: string;
    nombre: string;
    distKm: number;
    dificultadFisica: number;
    dificultadTecnica: number;
    estadoVigencia: string;
  };
};

export type MuroExperiencias = { experiencias: ExperienciaMuro[]; total: number; ciclistas: number };

/** Filtros del muro (propuesta Pro, Grupo B): condición, rango de
 *  fecha y «amigos primero». El API valida y acota todo. */
export type FiltrosMuro = { condiciones: string[]; desde: string; hasta: string; amigos: boolean };
export const FILTROS_MURO_VACIOS: FiltrosMuro = { condiciones: [], desde: "", hasta: "", amigos: false };

function qsFiltrosMuro(f: FiltrosMuro): string {
  const qs = new URLSearchParams();
  if (f.condiciones.length > 0) qs.set("cond", f.condiciones.join(","));
  if (f.desde) qs.set("desde", f.desde);
  if (f.hasta) qs.set("hasta", f.hasta);
  if (f.amigos) qs.set("amigos", "1");
  const s = qs.toString();
  return s ? `&${s}` : "";
}

/** Feed del muro (más recientes primero; el API acota take 1..50 y
 *  valida los filtros; amigos=1 ordena autores seguidos primero). */
export async function muroExperiencias(take = 30, filtros: FiltrosMuro = FILTROS_MURO_VACIOS): Promise<{ ok: boolean; error?: string; muro?: MuroExperiencias }> {
  const target = url(`/api/experiences?take=${take}${qsFiltrosMuro(filtros)}`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { headers, signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    const experiencias = Array.isArray(d.experiencias) ? (d.experiencias as ExperienciaMuro[]) : [];
    return {
      ok: true,
      muro: {
        experiencias,
        total: typeof d.total === "number" ? d.total : experiencias.length,
        ciclistas: typeof d.ciclistas === "number" ? d.ciclistas : 0,
      },
    };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

// Fotos de experiencias (propuesta Pro, Grupo A): el cliente escala
// la imagen y la envía como data URL; el API decide el límite real
// (FREE 1 · PRO 6) según el registro de compras del servidor.
export async function agregarFotoExperiencia(rutaId: string, experienciaId: string, foto: string): Promise<{ ok: boolean; error?: string }> {
  const target = url(`/api/routes/${encodeURIComponent(rutaId)}/experience/photos`);
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "POST", headers, body: JSON.stringify({ experienciaId, foto }), signal: AbortSignal.timeout(20_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

// Mis experiencias (panel «Mi aporte» + exportación legible).
export type ExperienciaPropia = {
  id: string;
  fechaRealizacion: string;
  comentario: string | null;
  condiciones: string[];
  createdAt: string;
  ruta: { id: string; nombre: string; distKm: number; estadoVigencia: string };
};

export type MisExperiencias = { experiencias: ExperienciaPropia[]; total: number; rutasCubiertas: number };

export async function misExperiencias(): Promise<{ ok: boolean; error?: string; mias?: MisExperiencias }> {
  const target = url("/api/experiences/mias");
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { headers, signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    const experiencias = Array.isArray(d.experiencias) ? (d.experiencias as ExperienciaPropia[]) : [];
    return {
      ok: true,
      mias: {
        experiencias,
        total: typeof d.total === "number" ? d.total : experiencias.length,
        rutasCubiertas: typeof d.rutasCubiertas === "number" ? d.rutasCubiertas : 0,
      },
    };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

export type ColaModeracion = {
  ocultas: { id: string; nombre: string; estadoVigencia: string; updatedAt: string; reports: { id: string; motivo: string; estado: string; clasificacion: string; peso: number }[] }[];
  sospechosos: { id: string; routeId: string; motivo: string; peso: number }[];
  logs: { id: string; accion: string; targetType: string; targetId: string; motivo: string | null; createdAt: string }[];
};

/** Cola de moderación (solo moderadores/admin; 403 para el resto). */
export async function colaModeracion(): Promise<{ ok: boolean; status?: number; error?: string; cola?: ColaModeracion }> {
  const target = url("/api/moderation");
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { headers, signal: AbortSignal.timeout(15_000) });
    if (res.status === 403 || res.status === 401) return { ok: false, status: res.status, error: "Sin permiso." };
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true, cola: d as unknown as ColaModeracion };
  } catch {
    return { ok: false, error: "Sin red." };
  }
}

/** Acción de moderación (restaurar/retirar/resolver reporte). */
export async function accionModeracion(a: { accion: string; rutaId?: string; reporteId?: string; nota?: string }): Promise<RespuestaComunidad> {
  const target = url("/api/moderation");
  if (target === null) return { ok: false, error: "Sin backend configurado." };
  const headers = sessionHeaders();
  try {
    const res = await fetch(target, { method: "POST", headers, body: JSON.stringify(a), signal: AbortSignal.timeout(15_000) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof d.error === "string" ? d.error : `Error ${res.status}.` };
    return { ok: true };
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
