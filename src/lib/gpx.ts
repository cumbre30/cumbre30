// ============================================================
// Export GPX 1.1 de un viaje (función Cumbre30 Pro).
// La pista se guarda desde la v1.5.0 muestreada (~1 punto cada
// 5 s, máx 600) como [lat, lon, eleM, tsSegundos]. Viajes
// anteriores no tienen pista y no se pueden exportar.
// ============================================================

import type { RideSummary } from "./history";

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
  const name = `Cumbre30 — Cerro San Cristóbal ${day}`;
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
