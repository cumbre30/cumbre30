// Prueba del ciclo completo de la constancia verificable:
// payload → hash → enlace QR → decodificación → hash igual.
// Corre con: npx tsx scripts/test-constancia.ts
import { buildConstanciaPayload, buildConstanciaEnlace, decodeConstancia, extraerData, constanciaHash } from "../src/lib/constancia";
import type { RideSummary } from "../src/lib/history";

async function main() {
  const ride: RideSummary = {
    id: "11111111-2222-3333-4444-555555555555",
    dateISO: "2026-11-14T19:05:00.000Z",
    source: "gps",
    distanceKm: 12.3456,
    maxKmh: 38.41,
    maxInParkKmh: 29.75,
    avgKmh: 14.2,
    elapsedSec: 3127,
    gainM: 342,
    overLimitSec: 37,
  };
  const payload = buildConstanciaPayload(ride, { username: "ciclista_test", name: "Ana Prueba" });
  const enlace = await buildConstanciaEnlace(payload);
  console.log("hash      :", enlace.hash.slice(0, 16) + "…");
  console.log("código    :", enlace.code);
  console.log("url len   :", enlace.url.length);

  const data = extraerData(enlace.url);
  if (!data) throw new Error("extraerData no encontró el segmento");
  const dec = await decodeConstancia(data);
  if (!dec.ok) throw new Error("decode falló: " + JSON.stringify(dec));
  console.log("decode    : ok · code", dec.code);
  if (dec.hash !== enlace.hash) throw new Error("hash mismatch");
  if (dec.payload.k !== 12.35) throw new Error("distancia mal redondeada: " + dec.payload.k);
  if (dec.payload.mp !== 29.8) throw new Error("max parque mal: " + dec.payload.mp);
  if (dec.payload.u !== "ciclista_test") throw new Error("usuario perdido");

  // Alteración de datos → integridad debe fallar
  const tampered = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64").toString("utf8")), k: 5 })
  ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const dec2 = await decodeConstancia(tampered);
  if (dec2.ok || dec2.reason !== "integridad") throw new Error("¡la alteración NO fue detectada!");
  console.log("tampering : detectado correctamente ✓");

  // Enlace pegado con ruido
  const dec3 = await decodeConstancia(extraerData("mira este enlace: " + enlace.url + " gracias")!);
  if (!dec3.ok) throw new Error("parse con ruido falló");
  console.log("ruido     : parseado bien ✓");
  console.log("ALL OK");
}
main();
