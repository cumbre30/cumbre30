// ============================================================
// Sectores de emergencia del parque (cliente 2026-11-17).
//
// División ORIENTATIVA del Parque Metropolitano por comuna de
// contacto, para la capa del mapa con los sectores destacados
// por color y su teléfono:
//   · norte    → Huechuraba  1417
//   · poniente → Recoleta    1440
//   · sur      → Providencia 1414
//
// Los polígonos se derivan de recortar el borde oficial del
// parque (PARK_POLYGON en park.ts) con dos líneas de corte:
//   · latitud  -33.4076 (al norte de Piscina Antilén)  → norte
//   · longitud -70.6280 (meridiana por Aurora de Chile) → poniente
//     en su oeste y sur (Providencia) en el resto.
// Es una aproximación visual de apoyo, no la sectorización
// operativa oficial de las patrullas (el disclaimer de
// cumplimiento en Ayuda cubre esta capa).
// ============================================================

import { PARK_POLYGON, type LatLng } from "@/lib/park";

/** Recorta un polígono con la media-plana lat >= latF (min) o lat < latF. */
function clipLat(poly: LatLng[], min: boolean, latF: number): LatLng[] {
  const keep = (p: LatLng) => (min ? p.lat >= latF : p.lat < latF);
  const inter = (a: LatLng, b: LatLng): LatLng => {
    const t = (latF - a.lat) / (b.lat - a.lat);
    return { lat: latF, lon: a.lon + t * (b.lon - a.lon) };
  };
  return sutherlandHodgman(poly, keep, inter);
}

/** Recorta un polígono con la media-plana lon >= lonF (min) o lon < lonF. */
function clipLon(poly: LatLng[], min: boolean, lonF: number): LatLng[] {
  const keep = (p: LatLng) => (min ? p.lon >= lonF : p.lon < lonF);
  const inter = (a: LatLng, b: LatLng): LatLng => {
    const t = (lonF - a.lon) / (b.lon - a.lon);
    return { lat: a.lat + t * (b.lat - a.lat), lon: lonF };
  };
  return sutherlandHodgman(poly, keep, inter);
}

/** Sutherland–Hodgman clásico contra una media-plana. */
function sutherlandHodgman(poly: LatLng[], keep: (p: LatLng) => boolean, inter: (a: LatLng, b: LatLng) => LatLng): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const curIn = keep(cur);
    const nxtIn = keep(nxt);
    if (curIn) out.push(cur);
    if (curIn !== nxtIn) out.push(inter(cur, nxt));
  }
  return out;
}

export type SectorEmergencia = {
  id: string;
  /** Comuna de contacto. */
  nombre: string;
  /** Orientación del sector dentro del parque. */
  sector: "norte" | "poniente" | "sur";
  /** Clave i18n de la orientación (sos.sectorNorte, etc.). */
  sectorKey: string;
  telefono: string;
  telHref: string;
  color: string;
  emoji: string;
  polygon: LatLng[];
};

const restoSur = clipLat(PARK_POLYGON, false, -33.4076);

export const SECTORES_EMERGENCIA: SectorEmergencia[] = [
  {
    id: "sector-norte",
    nombre: "Huechuraba",
    sector: "norte",
    sectorKey: "sos.sectorNorte",
    telefono: "1417",
    telHref: "tel:1417",
    color: "#38bdf8",
    emoji: "🔵",
    polygon: clipLat(PARK_POLYGON, true, -33.4076),
  },
  {
    id: "sector-poniente",
    nombre: "Recoleta",
    sector: "poniente",
    sectorKey: "sos.sectorPoniente",
    telefono: "1440",
    telHref: "tel:1440",
    color: "#a78bfa",
    emoji: "🟣",
    polygon: clipLon(restoSur, false, -70.628),
  },
  {
    id: "sector-sur",
    nombre: "Providencia",
    sector: "sur",
    sectorKey: "sos.sectorSur",
    telefono: "1414",
    telHref: "tel:1414",
    color: "#fbbf24",
    emoji: "🟡",
    polygon: clipLon(restoSur, true, -70.628),
  },
];
