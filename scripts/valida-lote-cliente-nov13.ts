// Validación del lote cliente 2026-11-13 (tarde):
//   1) Segmentos personales retirados (7 segmentos).
//   2) enBajada30: corredores del control 30 detectan, fuera no.
//   3) Horario: minutosParaCierre / cierraVozText / cierraHoraTexto.
//   4) Desafíos nuevos: Serie Metropolitana (totalParkKm) + reto diario.
import { SEGMENTS } from "../src/lib/segments";
import { enBajada30, bajadas30Cargadas } from "../src/lib/bajadas30";
import { BAJADAS_CONTROL_30 } from "../src/lib/rutasTrazados";
import { minutosParaCierre, cierraVozText, cierraHoraTexto, estadoParque } from "../src/lib/horario";
import { evaluateAchievements, statsFromRides, SERIES, RETOS, TIME_SERIES, PINS } from "../src/lib/pins";

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

// ---------- 1) Segmentos ----------
ok(SEGMENTS.length === 7, `7 segmentos (${SEGMENTS.length})`);
ok(!SEGMENTS.some((s) => s.id === "zorro-vidal-bajada"), "Zorro Vidal · bajada retirado");
ok(!SEGMENTS.some((s) => s.id === "mapuche-bajada"), "Mapuche · bajada retirado");
ok(SEGMENTS.some((s) => s.id === "b30-pionono") && SEGMENTS.some((s) => s.id === "la-piramide-plaza-mexico"), "subidas oficiales + bajadas 30 intactas");

// ---------- 2) enBajada30 ----------
ok(bajadas30Cargadas() === 3, `3 corredores indexados (${bajadas30Cargadas()})`);
// Punto VERTICE del corredor b30-pionono (sobre el camino real): el
// punto medio de la CUERDA start-end cae dentro de la loma (el camino
// serpentea), así que se usa un vértice del propio trazado.
const trPio = BAJADAS_CONTROL_30.find((b) => b.id === "b30-pionono")!;
const vPio = trPio.coords[Math.floor(trPio.coords.length / 2)];
const hitPio = enBajada30(vPio[0], vPio[1]);
ok(hitPio?.id === "b30-pionono", `vértice medio b30-pionono detecta (${hitPio?.id ?? "null"})`);
// Plaza Antilén es cabeza de b30-pdv; la cima Chacarillas de b30-piramide
const hitAnt = enBajada30(-33.40758, -70.61121);
ok(hitAnt !== null, `Plaza Antilén cae en banda de ${hitAnt?.id ?? "null"}`);
// Lejos del cerro: nada
ok(enBajada30(-33.45, -70.66) === null, "punto fuera del parque: sin detección");
ok(enBajada30(-33.433, -70.65) === null, "Bellavista urbana: sin detección");

// ---------- 3) Horario ----------
const ahora = new Date();
const mC = minutosParaCierre(ahora);
ok(Number.isFinite(mC), `minutosParaCierre=${mC} (abierto=${estadoParque(ahora).abierto})`);
ok(cierraVozText() === "20 y 30", `cierraVozText="${cierraVozText()}"`);
ok(cierraHoraTexto() === "20:30", `cierraHoraTexto="${cierraHoraTexto()}"`);
// Mediodía de Santiago (15:00 UTC en verano UTC-3): quedan 510 min.
// 21:00 de Santiago (00:00 UTC del día siguiente): cerrado (-30).
const y = ahora.getFullYear();
const mediodia = new Date(Date.UTC(y, ahora.getMonth(), ahora.getDate(), 15, 0, 0));
ok(minutosParaCierre(mediodia) === 510, `12:00 Santiago → 510 min (${minutosParaCierre(mediodia)})`);
const noche = new Date(Date.UTC(y, ahora.getMonth(), ahora.getDate() + 1, 0, 0, 0));
ok(minutosParaCierre(noche) === -30, `21:00 Santiago → -30 min (${minutosParaCierre(noche)})`);

// ---------- 4) Desafíos nuevos ----------
const met = SERIES.find((s) => s.id === "metropolitana");
ok(!!met && met.tiers.length === 3, `Serie Metropolitana con 3 niveles (${met?.tiers.length ?? 0})`);
ok(PINS.anillo && PINS.paseo && PINS.metro, "pines anillo/paseo/metro definidos");
const base = {
  totalKm: 0, rideCount: 0, maxKmh: 0, totalGainM: 0, parkRides: 0, cleanParkRides: 0,
  nightRides: 0, dawnRides: 0, maxRideKm: 0, weekendRides: 0, totalHours: 0,
  totalParkKm: 10.9, incidentCount: 0,
};
const free1 = evaluateAchievements(base, [], { pro: false });
ok(free1.includes("met_109"), "met_109 (El anillo) se desbloquea gratis con 10,9 km en parque");
ok(!free1.includes("met_218") && !free1.includes("met_436"), "niveles 2-3 Pro no se desbloquean sin licencia");
const proAll = evaluateAchievements({ ...base, totalParkKm: 43.6 }, [], { pro: true });
ok(proAll.includes("met_109") && proAll.includes("met_218") && proAll.includes("met_436"), "con Pro y 43,6 km: serie completa");
// Avance secuencial: 43,6 km pero empezando de cero → solo se dan en cadena
ok(proAll.filter((c) => c.startsWith("met_")).length === 3, "cadena secuencial completa de la serie");
const dAnillo = TIME_SERIES.find((t) => t.id === "dia")!.challenges.find((c) => c.id === "d_anillo");
ok(!!dAnillo && dAnillo.goal === 10.9, "desafío diario «Vuelta al anillo» (10,9 km)");
// statsFromRides suma inParkKm
const st = statsFromRides([
  { distanceKm: 12, maxKmh: 28, maxInParkKmh: 28, inParkKm: 10.8, gainM: 300, overLimitSec: 0, elapsedSec: 3600, dateISO: new Date().toISOString() },
  { distanceKm: 8, maxKmh: 25, maxInParkKmh: 25, inParkKm: 0.1, gainM: 50, overLimitSec: 0, elapsedSec: 1800, dateISO: new Date().toISOString() },
]);
ok(Math.abs(st.totalParkKm - 10.9) < 0.001, `totalParkKm = ${st.totalParkKm} (10,9 esperado)`);
ok(!RETOS.some((r) => r.metric === "totalParkKm"), "totalParkKm vive solo en la serie (sin retos duplicados)");

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
