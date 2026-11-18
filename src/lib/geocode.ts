// ============================================================
// Geocodificación de texto libre: el ciclista escribe CUALQUIER
// dirección ("Av. Providencia 1234", "Jardín Japonés", "mi casa
// en Ñuñoa"…) y obtenemos coordenadas para trazar la ruta.
//
// · Photon (photon.komoot.io): público, sin clave, CORS abierto y
//   pensado para apps - respuesta rápida sesgada por cercanía.
// · Nominatim: respaldo si Photon no responde o no encuentra nada.
// · Solo funciona CON conexión; offline el buscador sigue
//   encontrando los lugares del cerro y los marcadores guardados.
// ============================================================

import type { LatLng } from "./park";

export type AddrResult = {
  id: string;
  /** Título corto: nombre del lugar o calle + número. */
  name: string;
  /** Contexto: calle, comuna, región. */
  detail: string;
  lat: number;
  lon: number;
  /** Emoji según el tipo de lugar (pista visual en la lista). */
  emoji: string;
};

const PHOTON = "https://photon.komoot.io/api/";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** osm_value de Photon → emoji (los más útiles sobre dos ruedas). */
const EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", bar: "🍺", pub: "🍺", fast_food: "🍔", ice_cream: "🍦",
  supermarket: "🛒", bakery: "🥖", pharmacy: "💊", hospital: "🏥", clinic: "🏥", doctors: "🩺",
  school: "🏫", college: "🎓", university: "🎓", library: "📚", kindergarten: "🧸",
  park: "🌳", garden: "🌷", playground: "🪁", pitch: "⚽", sports_centre: "🏊", fitness_centre: "🏋️",
  museum: "🏛️", theatre: "🎭", cinema: "🎬", art_gallery: "🎨", attraction: "⭐", viewpoint: "🔭",
  fuel: "⛽", atm: "🏧", bank: "🏦", post_office: "📮", police: "🚓", townhall: "🏛️", marketplace: "🧺",
  bus_stop: "🚌", station: "🚉", subway: "🚇", parking: "🅿️", bicycle: "🚲", bicycle_rental: "🚲",
  hotel: "🏨", hostel: "🛏️", place_of_worship: "⛪", water_park: "💦", zoo: "🦒", castle: "🏰",
  house: "🏠", residential: "🏠", apartments: "🏢", office: "🏢", commercial: "🏢", industrial: "🏭",
  city: "🏙️", town: "🏙️", village: "🏘️", suburb: "🏘️", neighbourhood: "🏘️", quarter: "🏘️",
  stadium: "🏟️", track: "🏃", golf_course: "⛳", marina: "⛵", river: "🏞️", lake: "🏞️",
};

function emojiFor(osmValue: string | undefined): string {
  return (osmValue && EMOJI[osmValue]) || "📍";
}

/** Fetch con timeout propio y cancelación externa (cada tecla nueva aborta la anterior). */
async function fetchT(url: string, ms: number, outer?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  const onOuter = () => ctrl.abort();
  if (outer) {
    if (outer.aborted) {
      clearTimeout(to);
      throw new DOMException("abortido", "AbortError");
    }
    outer.addEventListener("abort", onOuter);
  }
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(to);
    if (outer) outer.removeEventListener("abort", onOuter);
  }
}

// B-04: política de uso de los geocoders públicos. Nominatim exige
// como máximo 1 consulta por segundo y Photon pide uso moderado.
// Espaciamos las consultas de red (mínimo 1,1 s entre pedidos) y
// la cancelación externa sigue funcionando: tras la espera, fetchT
// revisa la señal y aborta si llegó una tecla nueva.
let ultimaConsultaGeocoder = 0;
async function fetchGeocoder(url: string, ms: number, outer?: AbortSignal): Promise<Response> {
  const espera = ultimaConsultaGeocoder + 1100 - Date.now();
  if (espera > 0) {
    await new Promise<void>((res) => setTimeout(res, Math.min(espera, 2000)));
  }
  ultimaConsultaGeocoder = Date.now();
  return fetchT(url, ms, outer);
}

// ---------------------------------------------------------------- Photon

type PhotonFeat = {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    osm_value?: string;
  };
  geometry: { coordinates: [number, number] }; // [lon, lat]
};

function fromPhoton(f: PhotonFeat, i: number): AddrResult | null {
  const p = f.properties || ({} as PhotonFeat["properties"]);
  const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const streetFull = p.street ? `${p.street}${p.housenumber ? " " + p.housenumber : ""}` : "";
  const name = p.name || streetFull || p.city || p.locality || "Lugar sin nombre";
  const bits = [
    p.name && streetFull ? streetFull : "", // si el título es el negocio, la calle va en el detalle
    p.district && p.district !== p.city ? p.district : "",
    p.city || p.locality || "",
    p.state || "",
  ].filter(Boolean);
  const detail = Array.from(new Set(bits)).join(" · ");
  return { id: `p${i}-${lat.toFixed(5)}_${lon.toFixed(5)}`, name, detail, lat, lon, emoji: emojiFor(p.osm_value) };
}

// ------------------------------------------------------------- Nominatim

type NominatimHit = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
};

function fromNominatim(h: NominatimHit, i: number): AddrResult | null {
  const lat = Number(h.lat);
  const lon = Number(h.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const parts = h.display_name.split(", ");
  const name = h.name || parts[0] || "Lugar sin nombre";
  const rest = parts.slice(1, 4).join(" · ");
  return { id: `n${i}-${lat.toFixed(5)}_${lon.toFixed(5)}`, name, detail: rest, lat, lon, emoji: emojiFor(h.type) };
}

function dedupe(list: AddrResult[]): AddrResult[] {
  const seen = new Set<string>();
  const out: AddrResult[] = [];
  for (const r of list) {
    const k = `${r.name.toLowerCase()}|${r.lat.toFixed(4)}|${r.lon.toFixed(4)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Busca direcciones y lugares por texto libre, sesgado hacia `near`
 * (la ubicación del ciclista). Photon primero; Nominatim de respaldo.
 * · Devuelve [] si nadie encuentra nada para la consulta.
 * · Lanza (TypeError/DOMException) si no hay conexión - el caller
 *   muestra la nota offline y los resultados del cerro siguen ahí.
 * · Respeta `signal`: al escribir más letras, la búsqueda anterior se aborta.
 */
export async function geocodeAddress(query: string, near: LatLng, signal?: AbortSignal): Promise<AddrResult[]> {
  const q = query.trim();
  if (q.length < 4) return [];

  // 1) Photon - sesgo por cercanía, sin recorte duro de zona (cualquier
  //    dirección sirve; de cerca salen primero las de Santiago).
  let photonNetFail = false;
  try {
    const url = `${PHOTON}?q=${encodeURIComponent(q)}&lat=${near.lat.toFixed(5)}&lon=${near.lon.toFixed(5)}&limit=6&lang=default`;
    const r = await fetchGeocoder(url, 8000, signal);
    if (r.ok) {
      const d = (await r.json()) as { features?: PhotonFeat[] };
      const list = (d.features ?? []).map(fromPhoton).filter((x): x is AddrResult => !!x);
      const dd = dedupe(list);
      if (dd.length) return dd;
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e; // cancelado por el usuario: no seguir
    photonNetFail = true;
  }

  // 2) Nominatim - respaldo (Photon caído O sin resultados).
  try {
    const nUrl = `${NOMINATIM}?format=jsonv2&q=${encodeURIComponent(q)}&limit=6&accept-language=es`;
    const r2 = await fetchT(nUrl, 8000, signal);
    if (!r2.ok) throw new Error(`geocoder ${r2.status}`);
    const d2 = (await r2.json()) as NominatimHit[];
    return dedupe(d2.map(fromNominatim).filter((x): x is AddrResult => !!x));
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    // Photon sin red + Nominatim sin red → error de conexión real
    if (photonNetFail) throw e;
    return []; // Photon respondió pero no encontró nada: sin resultados
  }
}
