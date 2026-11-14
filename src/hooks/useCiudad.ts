"use client";

// ============================================================
// Ciudad real para el banner de clima (v1.11.1): reverse geocoding
// de la posición GPS con BigDataCloud (endpoint client gratuito,
// sin API key y con CORS). Filosofía offline de la app: el último
// nombre se guarda en localStorage y se muestra aunque no haya red;
// fallback "Santiago". Durante un ride se actualiza cuando la
// posición se aleja más de 3 km del punto geocodificado (la ciudad
// cambia lento: no consultamos por cada fix).
// ============================================================

import { useEffect, useState } from "react";
import { haversineM } from "@/lib/geo";
import type { LatLng } from "@/lib/park";

const CACHE_KEY = "cumbre30-ciudad-v1";
const TTL_MS = 24 * 60 * 60 * 1000; // el nombre se revalida cada 24 h
const CAMBIO_MIN_M = 3000; // consulta de nuevo si te moviste > 3 km
const FALLBACK = "Santiago";

type CiudadCache = { nombre: string; lat: number; lon: number; t: number };

function leerCache(): CiudadCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CiudadCache;
    if (typeof p.nombre !== "string" || typeof p.lat !== "number" || typeof p.lon !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

async function geocodificar(lat: number, lon: number): Promise<string | null> {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lon}&localityLanguage=es`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
    };
    // Prioridad: comuna (Recoleta, Providencia...) → ciudad → región
    const nombre = j.locality || j.city || j.principalSubdivision;
    return nombre || null;
  } catch {
    return null; // sin red o timeout: seguimos con el caché
  }
}

/**
 * Nombre de la comuna/ciudad actual para el banner. `pos` es la
 * posición del ride (o null fuera de ride: entonces un fix propio
 * y liviano del navegador). Nunca lanza ni bloquea la UI.
 */
export function useCiudad(pos: LatLng | null): string {
  const [ciudad, setCiudad] = useState<string>(FALLBACK);

  useEffect(() => {
    let cancelado = false;
    const cache = leerCache();
    if (cache) setCiudad(cache.nombre); // instantáneo: caché primero

    const consultar = async (lat: number, lon: number) => {
      const c = leerCache();
      const fresco = c && Date.now() - c.t < TTL_MS;
      const cerca = c && haversineM({ lat: c.lat, lon: c.lon }, { lat, lon }) < CAMBIO_MIN_M;
      if (fresco && cerca) return; // el caché sirve para este punto
      const nombre = await geocodificar(lat, lon);
      if (!nombre || cancelado) return;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ nombre, lat, lon, t: Date.now() }));
      setCiudad(nombre);
    };

    if (pos) {
      void consultar(pos.lat, pos.lon);
    } else if (!cache) {
      // Fuera de ride: un único fix de baja precisión alcanza para
      // la comuna; no deja un watch corriendo (batería).
      navigator.geolocation?.getCurrentPosition(
        (p) => {
          if (!cancelado) void consultar(p.coords.latitude, p.coords.longitude);
        },
        () => {
          /* sin permiso: fallback/cache */
        },
        { timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    }
    return () => {
      cancelado = true;
    };
    // Clave estable: solo re-consulta si el punto se movió ~1 km
  }, [pos ? `${pos.lat.toFixed(2)},${pos.lon.toFixed(2)}` : ""]);

  return ciudad;
}
