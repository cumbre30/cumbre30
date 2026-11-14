"use client";

// ============================================================
// Clima para la pantalla ride (punto 6 del brief): banner con
// icono + temperatura en °C.
//   - Fuente: Open-Meteo (gratuita, sin API key, sin registro),
//     coordenadas fijas del cerro San Cristóbal.
//   - Filosofía offline de la app: el último dato se guarda en
//     localStorage y se muestra aunque no haya conexión, con la
//     hora de actualización a la vista. Se refresca al montar
//     (si el caché tiene más de 30 min) y al volver la conexión
//     (evento online). En el cerro la señal es irregular: el
//     banner nunca se rompe por falta de red.
// ============================================================

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

const LAT = -33.408; // mismo punto que horario.ts (centro del parque)
const LON = -70.636;
const CACHE_KEY = "cumbre30-clima-v1";
const MAX_AGE_MS = 30 * 60 * 1000; // refresca si el caché es más viejo que esto

export type Clima = {
  tempC: number;
  code: number;
  actualizado: Date;
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

function leerCache(): Clima | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tempC: number; code: number; t: number };
    if (typeof parsed.tempC !== "number" || typeof parsed.code !== "number") return null;
    return { tempC: parsed.tempC, code: parsed.code, actualizado: new Date(parsed.t) };
  } catch {
    return null;
  }
}

async function traerClima(): Promise<Clima | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,weather_code&timezone=America%2FSantiago`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temp = json.current?.temperature_2m;
    const code = json.current?.weather_code;
    if (typeof temp !== "number" || typeof code !== "number") return null;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ tempC: temp, code, t: Date.now() }));
    return { tempC: temp, code, actualizado: new Date() };
  } catch {
    return null; // sin red o timeout: seguimos con el caché
  }
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
    return () => {
      vivo = false;
      window.removeEventListener("online", alConectar);
    };
  }, []);

  return { clima, fuente };
}
