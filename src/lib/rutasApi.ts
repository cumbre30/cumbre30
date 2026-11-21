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
