"use client";

// ============================================================
// Clima para la pantalla ride: banner con icono + temperatura y
// detalle expandible (v1.12.0) con viento, calidad del aire e
// índice UV (con consejo de bloqueador).
//   - Fuentes: Open-Meteo (gratuita, sin API key): forecast para
//     temperatura/código/viento y air-quality para UV/AQI.
//     Coordenadas fijas del cerro San Cristóbal.
//   - Filosofía offline de la app: el último dato se guarda en
//     localStorage y se muestra aunque no haya conexión, con la
//     hora de actualización a la vista. Se refresca al montar
//     (si el caché tiene más de 30 min), cada 15 min en primer
//     plano y al volver la conexión (evento online). Los campos
//     extra son opcionales: un caché viejo sigue mostrando
//     temperatura e icono sin romper el banner.
// ============================================================

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

const LAT = -33.408; // mismo punto que horario.ts (centro del parque)
const LON = -70.636;
const CACHE_KEY = "cumbre30-clima-v1"; // se conserva: campos nuevos opcionales
const MAX_AGE_MS = 30 * 60 * 1000; // refresca si el caché es más viejo que esto

export type Clima = {
  tempC: number;
  code: number;
  actualizado: Date;
  // Detalle expandible (opcional: cachés antiguos no lo tienen)
  windKmh?: number; // viento medio a 10 m
  gustKmh?: number; // rachas a 10 m
  uv?: number; // índice UV (0-11+)
  aqi?: number; // calidad del aire (US AQI, base del ICAP chileno)
};

/** Etiqueta localizada del código WMO (weather_code de Open-Meteo).
 *  Usa el idioma activo (selector de idioma); fallback español. */
export function etiquetaClima(code: number): string {
  if (code === 0) return t("clima.despejado");
  if (code === 1 || code === 2) return t("clima.parcial");
  if (code === 3) return t("clima.nublado");
  if (code === 45 || code === 48) return t("clima.neblina");
  if (code >= 51 && code <= 57) return t("clima.llovizna");
  if (code >= 61 && code <= 67) return t("clima.lluvia");
  if (code >= 71 && code <= 77) return t("clima.nieve");
  if (code >= 80 && code <= 82) return t("clima.chubascos");
  if (code === 85 || code === 86) return t("clima.nieveChubascos");
  if (code >= 95) return t("clima.tormenta");
  return t("clima.generico");
}

/** Categoría UV localizada (escala OMS 0-11+). */
export function etiquetaUV(uv: number): string {
  if (uv < 3) return t("clima.uv.bajo");
  if (uv < 6) return t("clima.uv.moderado");
  if (uv < 8) return t("clima.uv.alto");
  if (uv < 11) return t("clima.uv.muyAlto");
  return t("clima.uv.extremo");
}

/** Categoría localizada de calidad del aire (US AQI 0-500). */
export function etiquetaAire(aqi: number): string {
  if (aqi <= 50) return t("clima.aire.buena");
  if (aqi <= 100) return t("clima.aire.moderada");
  if (aqi <= 150) return t("clima.aire.sensible");
  if (aqi <= 200) return t("clima.aire.danina");
  if (aqi <= 300) return t("clima.aire.muyDanina");
  return t("clima.aire.peligrosa");
}

function leerCache(): Clima | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      tempC: number; code: number;
      t?: number; actualizado?: string; // v1.11.x guardaba epoch "t"; v1.12.x escribía "actualizado" (ISO) pero leía "t"
      windKmh?: number; gustKmh?: number; uv?: number; aqi?: number;
    };
    if (typeof parsed.tempC !== "number" || typeof parsed.code !== "number") return null;
    // Bug del banner (fix v1.12.2): leerCache leía parsed.t, pero traerClima
    // serializa el Date en "actualizado" → new Date(undefined) = Invalid Date;
    // el detalle llamaba horaSantiago(Invalid Date) → formatToParts lanzaba
    // RangeError y la app crasheaba al tocar el banner. Aceptamos ambas formas
    // y descartamos cualquier caché cuya fecha no se entienda.
    const ms = typeof parsed.t === "number" && Number.isFinite(parsed.t)
      ? parsed.t
      : Date.parse(parsed.actualizado ?? "");
    if (!Number.isFinite(ms)) return null;
    return {
      tempC: parsed.tempC,
      code: parsed.code,
      actualizado: new Date(ms),
      windKmh: parsed.windKmh,
      gustKmh: parsed.gustKmh,
      uv: parsed.uv,
      aqi: parsed.aqi,
    };
  } catch {
    return null;
  }
}

/** Trae forecast (temp/código/viento) y calidad del aire (UV/AQI) en
 *  paralelo. Si falla uno, el otro igual sirve: la temperatura nunca
 *  depende del endpoint de aire y viceversa. */
async function traerClima(): Promise<Clima | null> {
  const urlForecast =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m&timezone=America%2FSantiago`;
  const urlAire =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}` +
    `&current=uv_index,us_aqi&timezone=America%2FSantiago`;

  const [fc, aire] = await Promise.allSettled([
    fetch(urlForecast, { signal: AbortSignal.timeout(8000) }),
    fetch(urlAire, { signal: AbortSignal.timeout(8000) }),
  ]);

  let tempC: number | undefined;
  let code: number | undefined;
  let windKmh: number | undefined;
  let gustKmh: number | undefined;
  if (fc.status === "fulfilled" && fc.value.ok) {
    try {
      const j = (await fc.value.json()) as {
        current?: {
          temperature_2m?: number; weather_code?: number;
          wind_speed_10m?: number; wind_gusts_10m?: number;
        };
      };
      tempC = j.current?.temperature_2m;
      code = j.current?.weather_code;
      windKmh = j.current?.wind_speed_10m;
      gustKmh = j.current?.wind_gusts_10m;
    } catch {
      /* respuesta inválida: seguimos con aire/caché */
    }
  }

  let uv: number | undefined;
  let aqi: number | undefined;
  if (aire.status === "fulfilled" && aire.value.ok) {
    try {
      const j = (await aire.value.json()) as {
        current?: { uv_index?: number; us_aqi?: number };
      };
      uv = j.current?.uv_index;
      aqi = j.current?.us_aqi;
    } catch {
      /* idem */
    }
  }

  if (typeof tempC !== "number" || typeof code !== "number") return null;
  const dato: Clima = { tempC, code, actualizado: new Date() };
  if (typeof windKmh === "number") dato.windKmh = Math.round(windKmh);
  if (typeof gustKmh === "number") dato.gustKmh = Math.round(gustKmh);
  if (typeof uv === "number") dato.uv = Math.round(uv * 10) / 10;
  if (typeof aqi === "number") dato.aqi = Math.round(aqi);
  try {
    // "t" (epoch) además del Date serializado: la forma canónica que
    // leerCache entiende sin ambigüedad.
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...dato, t: dato.actualizado.getTime() }));
  } catch {
    /* almacenamiento lleno: seguimos en memoria */
  }
  return dato;
}

/**
 * Clima actual del parque para el banner de ride. Nunca lanza ni
 * bloquea la UI: si no hay dato y no hay red, devuelve null y el
 * banner simplemente no se muestra.
 */
export function useClima() {
  const [clima, setClima] = useState<Clima | null>(null);
  const [fuente, setFuente] = useState<"red" | "cache" | null>(null);

  useEffect(() => {
    let vivo = true;
    const aplicar = async () => {
      const cache = leerCache();
      const desactualizado = !cache || Date.now() - cache.actualizado.getTime() > MAX_AGE_MS;
      if (navigator.onLine && desactualizado) {
        const fresco = await traerClima();
        if (fresco && vivo) {
          setClima(fresco);
          setFuente("red");
          return;
        }
      }
      if (cache && vivo) {
        setClima(cache);
        setFuente("cache");
      }
    };
    void aplicar();
    const alConectar = () => void aplicar();
    window.addEventListener("online", alConectar);
    // Tiempo real (v1.11.1): refresco periódico cada 15 min mientras la
    // app está a la vista, y al volver del segundo plano (APK/pestaña).
    const refresco = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void aplicar();
    }, 15 * 60 * 1000);
    const alVer = () => {
      if (document.visibilityState === "visible") void aplicar();
    };
    document.addEventListener("visibilitychange", alVer);
    return () => {
      vivo = false;
      window.removeEventListener("online", alConectar);
      document.removeEventListener("visibilitychange", alVer);
      clearInterval(refresco);
    };
  }, []);

  return { clima, fuente };
}
