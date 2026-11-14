"use client";

// ============================================================
// Avisos operativos en tiempo real (2026-11-14).
// ------------------------------------------------------------
// Fuente: public/avisos.json en la web desplegada (cumbregeo.cl).
// La persona operadora edita ese archivo (o lo reemplaza con un
// deploy) y TODAS las apps lo muestran en el banner de avisos de
// la pantalla Ride en minutos, sin actualizar el APK.
//
//   · Web: fetch del mismo origen (/avisos.json).
//   · APK (export estático): fetch absoluto al origen del backend
//     configurado (Perfil → Servidor de cuenta, o el horneado en
//     el build); si no hay ninguno, cae a https://cumbregeo.cl.
//   · Caché local con TTL de 5 minutos: en el cerro sin señal se
//     muestra el último contenido conocido con su hora.
//   · Vigencia opcional por aviso (desde/hasta ISO) para programar
//     avisos que se activan y expiran solos.
// ============================================================

import { backendOrigin } from "./backend";
import { getLang } from "./i18n";

export type AvisoOperativo = {
  id: string;
  nivel: "info" | "warn" | "danger";
  /** Texto base (español). */
  texto: string;
  /** Traducciones opcionales para turistas (selector de idioma). */
  textoEn?: string;
  textoPt?: string;
  /** Vigencia opcional (ISO 8601, con offset de Chile). */
  desde?: string;
  hasta?: string;
};

type AvisosFile = {
  actualizado?: string;
  avisos?: AvisoOperativo[];
};

const LS_KEY = "cumbre30-avisos-v1";
const TTL_MS = 5 * 60 * 1000; // refresco del caché (poll de la UI: 5 min)

/** Origen del archivo de avisos según el contexto (web/APK). */
export function avisosUrl(): string {
  const base = backendOrigin();
  if (base === null) return "https://cumbregeo.cl/avisos.json";
  return `${base}/avisos.json`;
}

/** ¿Está vigente el aviso ahora mismo? */
export function avisoVigente(a: AvisoOperativo, now: Date = new Date()): boolean {
  try {
    if (a.desde && now.getTime() < new Date(a.desde).getTime()) return false;
    if (a.hasta && now.getTime() > new Date(a.hasta).getTime()) return false;
    return true;
  } catch {
    return true; // fecha inválida: no bloquear el aviso
  }
}

/** Texto del aviso en el idioma activo (fallback: texto base es). */
export function textoAviso(a: AvisoOperativo): string {
  const lang = getLang();
  if (lang === "en" && a.textoEn) return a.textoEn;
  if (lang === "pt" && a.textoPt) return a.textoPt;
  return a.texto;
}

type CacheEntry = { t: number; data: AvisosFile };

function leerCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CacheEntry;
    if (!p || !p.data || !Array.isArray(p.data.avisos)) return null;
    return p;
  } catch {
    return null;
  }
}

function guardarCache(data: AvisosFile): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), data } satisfies CacheEntry));
  } catch {
    // almacenamiento lleno: el aviso vive solo en esta sesión
  }
}

function filtrar(data: AvisosFile): { list: AvisoOperativo[]; actualizado: Date | null } {
  const list = (data.avisos ?? []).filter((a) => avisoVigente(a));
  const orden: Record<AvisoOperativo["nivel"], number> = { danger: 0, warn: 1, info: 2 };
  list.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
  let actualizado: Date | null = null;
  if (data.actualizado) {
    const d = new Date(data.actualizado);
    if (!isNaN(d.getTime())) actualizado = d;
  }
  return { list, actualizado };
}

export type AvisosResult = {
  list: AvisoOperativo[];
  actualizado: Date | null;
  fuente: "red" | "cache" | "ninguna";
};

/**
 * Avisos operativos vigentes. Nunca lanza: sin red devuelve el caché
 * (si existe) o una lista vacía, igual que la filosofía offline de
 * useClima. `force` omite el TTL (lo usa el poll de la pantalla ride).
 */
export async function fetchAvisosOperativos(force = false): Promise<AvisosResult> {
  const cache = leerCache();
  if (!force && cache && Date.now() - cache.t < TTL_MS) {
    const { list, actualizado } = filtrar(cache.data);
    return { list, actualizado, fuente: "cache" };
  }
  try {
    const res = await fetch(avisosUrl(), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = (await res.json()) as AvisosFile;
    guardarCache(data);
    const { list, actualizado } = filtrar(data);
    return { list, actualizado, fuente: "red" };
  } catch {
    if (cache) {
      const { list, actualizado } = filtrar(cache.data);
      return { list, actualizado, fuente: "cache" };
    }
    return { list: [], actualizado: null, fuente: "ninguna" };
  }
}
