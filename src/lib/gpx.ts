// ============================================================
// Export GPX 1.1 de un viaje (función Cumbre30 Pro).
// La pista se guarda desde la v1.5.0 muestreada (~1 punto cada
// 5 s, máx 600) como [lat, lon, eleM, tsSegundos]. Viajes
// anteriores no tienen pista y no se pueden exportar.
// ============================================================

import type { RideSummary } from "./history";
import { haversineM } from "./geo";
import type { LatLng } from "./routing";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Devuelve el GPX del viaje como Blob, o null si no hay pista. */
export function buildRideGpxBlob(r: RideSummary): Blob | null {
  const track = r.track;
  if (!track || track.length < 2) return null;

  const day = r.dateISO.slice(0, 10);
  const name = `Cumbre30 - Ride ${day}`;
  const desc =
    `${r.distanceKm.toFixed(1)} km · máx ${r.maxKmh.toFixed(1)} km/h · ` +
    `prom ${r.avgKmh.toFixed(1)} km/h · +${Math.round(r.gainM)} m · ` +
    `fuente ${r.source === "sim" ? "demostración" : "GPS"}`;

  const pts = track
    .map((p) => {
      const [lat, lon, ele, ts] = p;
      const eleXml = Number.isFinite(ele) ? `<ele>${ele.toFixed(1)}</ele>` : "";
      const time = new Date(ts * 1000).toISOString();
      return `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${eleXml}<time>${time}</time></trkpt>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cumbre30" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${xmlEscape(name)}</name>
    <desc>${xmlEscape(desc)}</desc>
    <time>${new Date(track[0][3] * 1000).toISOString()}</time>
  </metadata>
  <trk>
    <name>${xmlEscape(name)}</name>
    <desc>${xmlEscape(desc)}</desc>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;

  return new Blob([xml], { type: "application/gpx+xml" });
}

// ============================================================
// Import GPX (v1.13.15, creador de trazados): lee una pista de
// un archivo GPX y la reduce a una línea lista para el creador.
// Acepta trkpt (trk/trkseg), rte/rtept y wpt como respaldo.
// ============================================================

export type GpxLinea = {
  pts: LatLng[];
  distKm: number;
  /** Desnivel positivo acumulado (0 si el GPX no trae <ele>). */
  gainM: number;
};

/** Parsea el XML de un GPX y devuelve la línea simplificada con su
 *  distancia y desnivel. Devuelve null si no hay puntos usables. */
export function parseGpxLine(xml: string): GpxLinea | null {
  const crudos: { p: LatLng; e: number | null }[] = [];
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    const leer = (els: NodeListOf<Element>) => {
      for (const el of Array.from(els)) {
        const lat = parseFloat(el.getAttribute("lat") ?? "");
        const lon = parseFloat(el.getAttribute("lon") ?? "");
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const eRaw = el.querySelector("ele")?.textContent;
        const e = eRaw !== null && eRaw !== undefined ? parseFloat(eRaw) : NaN;
        crudos.push({ p: { lat, lon }, e: Number.isFinite(e) ? e : null });
      }
    };
    const trkpts = doc.querySelectorAll("trkpt");
    if (trkpts.length >= 2) leer(trkpts);
    else if (doc.querySelectorAll("rtept").length >= 2) leer(doc.querySelectorAll("rtept"));
    else leer(doc.querySelectorAll("wpt"));
  } catch {
    return null;
  }
  if (crudos.length < 2) return null;
  // Simplificar conservando la elevación de cada punto elegido.
  const dedup: { p: LatLng; e: number | null }[] = [];
  for (const c of crudos) {
    const prev = dedup[dedup.length - 1];
    if (!prev || haversineM(prev.p, c.p) >= 2) dedup.push(c);
  }
  let elegidos = dedup;
  if (dedup.length > 400) {
    const step = (dedup.length - 1) / (400 - 1);
    elegidos = [];
    for (let i = 0; i < 400; i++) elegidos.push(dedup[Math.round(i * step)]);
    elegidos[0] = dedup[0];
    elegidos[399] = dedup[dedup.length - 1];
  }
  const pts = elegidos.map((c) => c.p);
  let distM = 0;
  let gain = 0;
  let prevE: number | null = null;
  for (let i = 0; i < elegidos.length; i++) {
    if (i > 0) distM += haversineM(elegidos[i - 1].p, elegidos[i].p);
    const e = elegidos[i].e;
    if (e !== null && prevE !== null && e > prevE) gain += e - prevE;
    if (e !== null) prevE = e;
  }
  return { pts, distKm: distM / 1000, gainM: Math.round(gain) };
}

// ============================================================
// Export GPX de una RUTA (fase B del módulo Rutas y Comunidad):
// la geometría del borrador/propietario tal cual (es su propio
// dato local). Sin elevación si no hay fuente — jamás ele 0
// (§5.1) — y sin metadatos privados: solo nombre y descripción.
// Compatible GPX 1.1 (trk/trkseg/trkpt) como buildRideGpxBlob.
// ============================================================

export type GpxRutaEntrada = {
  nombre: string;
  descripcion?: string;
  coords: LatLng[];
  /** Elevación por punto cuando existe; undefined = sin datos. */
  eleM?: (number | null)[];
};

/** Devuelve el GPX 1.1 de la ruta como Blob. */
export function buildRutaGpxBlob(r: GpxRutaEntrada): Blob {
  const name = r.nombre || "Ruta Cumbre30";
  const distM = r.coords.reduce((acc, c, i) => (i === 0 ? 0 : acc + haversineM(r.coords[i - 1], c)), 0);
  const desc = (r.descripcion || "").slice(0, 2000) || `${(distM / 1000).toFixed(1)} km · Cumbre30`;
  const pts = r.coords
    .map((p, i) => {
      const e = r.eleM?.[i];
      const eleXml = e != null && Number.isFinite(e) ? `<ele>${e.toFixed(1)}</ele>` : "";
      return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${eleXml}</trkpt>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cumbre30" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${xmlEscape(name)}</name>
    <desc>${xmlEscape(desc)}</desc>
  </metadata>
  <trk>
    <name>${xmlEscape(name)}</name>
    <desc>${xmlEscape(desc)}</desc>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
  return new Blob([xml], { type: "application/gpx+xml" });
}
