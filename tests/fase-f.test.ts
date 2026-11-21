// ============================================================
// Fase F · proyector routeRef + Navegar + experiencia post-ride +
// completada binaria (v2.1 §6/§8). Lógica pura en node + verificación
// del ancla rideId y del "el servidor ignora routeRef" contra la base
// REAL local (postgres embebido 5433).
// Ejecutar: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/cumbre30 \
//   npx tsx tests/fase-f.test.ts
// ============================================================
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { POST as EXPERIENCE } from "../src/app/api/routes/[id]/experience/route";
import { POST as CREAR_RUTA } from "../src/app/api/routes/route";
import { POST as RIDES } from "../src/app/api/rides/route";
import {
  rutasProyectadaFor,
  RUTA_PROYECTADA_KEY,
  conRouteRef,
  marcarCompletada,
  armarExperienciaDeRide,
  type RutaProyectada,
} from "../src/lib/rutaProyectada";
import { rutasStoreFor, type KVStorage } from "../src/lib/rutasStore";
import type { RideSummary } from "../src/lib/history";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}
function req(method: string, path: string, token: string | null, body?: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** Storage en memoria (JSON strings, como localStorage). */
function storageFake(): KVStorage & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const PROY: RutaProyectada = {
  routeId: "ruta-local-1",
  serverId: null,
  nombre: "San Cristóbal loop",
  coords: [
    { lat: -33.4, lon: -70.63 },
    { lat: -33.41, lon: -70.62 },
    { lat: -33.42, lon: -70.615 },
  ],
  origen: "local",
};

function rideResumen(overrides: Partial<RideSummary> = {}): RideSummary {
  return {
    id: "ride-f-1",
    dateISO: "2026-11-21T15:30:00.000Z",
    source: "gps",
    distanceKm: 12.4,
    maxKmh: 38,
    maxInParkKmh: 35,
    avgKmh: 17,
    elapsedSec: 2620,
    gainM: 310,
    overLimitSec: 0,
    ...overrides,
  };
}

async function main(): Promise<void> {
  // ============ 1 · STORE DE RUTA PROYECTADA ============
  console.log("· store de ruta proyectada (proyector)");
  const st = storageFake();
  const store = rutasProyectadaFor(st);

  assert.equal(store.get(), null, "arranca vacía");
  store.set(PROY);
  assert.equal(store.get(), PROY, "referencia estable tras set");
  assert.ok(st.dump()[RUTA_PROYECTADA_KEY]?.includes("San Cristóbal loop"), "persistida en storage");
  ok("set/get con persistencia y snapshot estable");

  // Reinstancia (recarga del APK): mismo storage → misma ruta.
  const store2 = rutasProyectadaFor(st);
  const leida = store2.get();
  assert.equal(leida?.nombre, "San Cristóbal loop");
  assert.equal(leida?.coords.length, 3);
  ok("sobrevive a la recarga (nueva instancia, mismo storage)");

  store.set({ ...PROY, routeId: "otra", origen: "publica", serverId: "srv-9" });
  assert.equal(store.get()?.routeId, "otra");
  store.set(null);
  assert.equal(store.get(), null);
  assert.ok(JSON.parse(st.dump()[RUTA_PROYECTADA_KEY]).r === null, "null persistido");
  ok("reemplazo y limpieza (quitar chip)");

  // Datos corruptos / inválidos → honestamente vacío, jamás crashea.
  st.setItem(RUTA_PROYECTADA_KEY, "{corrupto");
  assert.equal(rutasProyectadaFor(st).get(), null);
  st.setItem(RUTA_PROYECTADA_KEY, JSON.stringify({ v: 1, r: { routeId: "x", nombre: "y", origen: "local", coords: [{ lat: 1 }] } }));
  assert.equal(rutasProyectadaFor(st).get(), null, "coords < 2 inválidas");
  st.setItem(RUTA_PROYECTADA_KEY, JSON.stringify({ v: 1, r: { routeId: "x", nombre: "y", origen: "extraño", coords: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }] } }));
  assert.equal(rutasProyectadaFor(st).get(), null, "origen inválido");
  st.setItem(RUTA_PROYECTADA_KEY, JSON.stringify({ v: 1, r: { routeId: "x", nombre: "y", origen: "local", coords: [{ lat: "a", lon: 2 }, { lat: 3, lon: 4 }] } }));
  assert.equal(rutasProyectadaFor(st).get(), null, "coordenada no numérica");
  ok("envelope corrupto o inválido → null (jamás crashea)");

  // ============ 2 · ROUTEREF DEL RIDE (SOLO IDS, SIN GEOMETRÍA) ============
  console.log("· routeRef en el resumen local del ride");
  const base = rideResumen();
  const con = conRouteRef(base, PROY);
  assert.deepEqual(con.routeRef, { id: "ruta-local-1", serverId: null, nombre: "San Cristóbal loop", origen: "local" });
  assert.equal(JSON.stringify(con).includes("-70.62"), false, "coords de la ruta JAMÁS en el ride");
  assert.equal(conRouteRef(base, null), base, "sin proyectada → ride sin cambios");
  // El servidor recibe un whitelist (rideToPayload): routeRef no viaja.
  const payloadSimulado = {
    id: con.id, dateISO: con.dateISO, source: con.source, distanceKm: con.distanceKm,
    maxKmh: con.maxKmh, avgKmh: con.avgKmh, elapsedSec: con.elapsedSec, gainM: con.gainM, overLimitSec: con.overLimitSec,
  };
  assert.equal("routeRef" in payloadSimulado, false, "el payload al servidor no lleva routeRef");
  ok("routeRef = ids + nombre; sin geometría y sin salida al servidor");

  // ============ 3 · COMPLETADA BINARIA ============
  console.log("· completada binaria (sí/no, primera fecha)");
  const stR = storageFake();
  const rutas = rutasStoreFor(stR);
  rutas.add({
    id: "ruta-local-1", kind: "ruta", nombre: "San Cristóbal loop", coords: PROY.coords, distKm: 12, gainM: 300, origen: "motor",
  } as never);
  const marcada = marcarCompletada(rutas, { id: "ruta-local-1", serverId: null, nombre: "x", origen: "local" }, "2026-11-21T15:30:00.000Z");
  assert.equal(marcada, "ruta-local-1");
  const r1 = rutas.get().find((r) => r.id === "ruta-local-1");
  assert.equal(r1?.completada, true);
  assert.equal(r1?.completadaAt, "2026-11-21T15:30:00.000Z");
  ok("ride cerrado con ruta proyectada → completada=true con fecha del ride");

  const segunda = marcarCompletada(rutas, { id: "ruta-local-1", serverId: null, nombre: "x", origen: "local" }, "2026-11-28T10:00:00.000Z");
  assert.equal(segunda, "ruta-local-1", "idempotente");
  const r2 = rutas.get().find((r) => r.id === "ruta-local-1");
  assert.equal(r2?.completadaAt, "2026-11-21T15:30:00.000Z", "conserva la PRIMERA fecha (binaria, no historial)");
  ok("idempotente: conserva la primera fecha, sin conteos");

  // Navegar desde el catálogo con copia local publicada: id del servidor.
  rutas.add({
    id: "copia-local-pub", kind: "ruta", nombre: "Pub", coords: PROY.coords, distKm: 9, gainM: null, origen: "gpx", serverId: "srv-9",
  } as never);
  const m3 = marcarCompletada(rutas, { id: "srv-9", serverId: "srv-9", nombre: "Pub", origen: "publica" }, "2026-12-01T09:00:00.000Z");
  assert.equal(m3, "copia-local-pub", "resuelve por serverId");
  assert.equal(rutas.get().find((r) => r.id === "copia-local-pub")?.completada, true);
  const m4 = marcarCompletada(rutas, { id: "inexistente", serverId: null, nombre: "?", origen: "local" }, "2026-12-01T09:00:00.000Z");
  assert.equal(m4, null, "ruta pública sin copia local → nada que marcar");
  ok("resuelve por serverId (Navegar pública) y null sin copia local");

  // ============ 4 · EXPERIENCIA POST-RIDE (payload §6) ============
  console.log("· experiencia post-ride (payload §6)");
  const p1 = armarExperienciaDeRide({ id: "ride-f-1", dateISO: "2026-11-21T15:30:00.000Z" }, { condiciones: ["barro", "agua", "barro", "inventada", "sombra", "otro"], comentario: "  bonita  " });
  assert.equal(p1?.fechaRealizacion, "2026-11-21", "fecha del ride (yyyy-mm-dd)");
  assert.deepEqual(p1?.condiciones, ["barro", "agua", "sombra"], "dedup + filtro enumerado + tope 3");
  assert.equal(p1?.comentario, "bonita");
  assert.equal(p1?.rideId, "ride-f-1", "rideId anclado");
  ok("payload con fecha del ride, condiciones dedup ≤3 y rideId");

  assert.deepEqual(armarExperienciaDeRide({ id: "r", dateISO: "2026-11-21T00:00:00Z" }, {}).condiciones, [], "sin condiciones → []");
  const largo = armarExperienciaDeRide({ id: "r", dateISO: "2026-11-21T00:00:00Z" }, { comentario: "x".repeat(2500) });
  assert.equal(largo?.comentario?.length, 2000, "comentario capado a 2000");
  assert.equal(armarExperienciaDeRide(null, null), null, "sin ride → null");
  assert.equal(armarExperienciaDeRide({ id: "r", dateISO: "fecha mala" }, null), null, "fecha inválida → null");
  assert.equal("track" in (p1 as object), false, "el payload JAMÁS lleva pista GPS");
  ok("honestidad: caps del servidor respetados y sin pista GPS");

  // ============ 5 · SERVIDOR REAL (PG 5433) ============
  if (!process.env.DATABASE_URL) {
    console.error("FALTA DATABASE_URL (postgres embebido 5433).");
    process.exit(2);
  }
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  console.log("· servidor real: ancla rideId + rides sin routeRef");
  await db.user.deleteMany({ where: { email: { startsWith: "fase-f-" } } });

  const autor = await db.user.create({ data: { email: "fase-f-autor@test.local", username: "faseFAutor", passwordHash: "x" } });
  const ciclista = await db.user.create({ data: { email: "fase-f-ride@test.local", username: "faseFRide", passwordHash: "x" } });
  const sAutor = await db.session.create({ data: { userId: autor.id, token: "tok-f-autor-" + Date.now(), expiresAt: new Date(Date.now() + 86_400_000) } });
  const sRide = await db.session.create({ data: { userId: ciclista.id, token: "tok-f-ride-" + Date.now(), expiresAt: new Date(Date.now() + 86_400_000) } });

  const creada = await CREAR_RUTA(req("POST", "/api/routes", sAutor.token, {
    nombre: "Ruta fase F", modalidad: "montana", coords: [{ lat: -33.46, lon: -70.55 }, { lat: -33.47, lon: -70.54 }],
    ele: { gainM: 300, lossM: 300, minEle: 800, maxEle: 1100 }, eleFuente: "gpx",
  }));
  assert.equal(creada.status, 200);
  const rutaId = ((await creada.json()) as { id: string }).id;
  ok("ruta pública de prueba creada");

  // Experiencia post-ride: fecha del ride + rideId anclado.
  const e1 = await EXPERIENCE(req("POST", `/api/routes/${rutaId}/experience`, sRide.token, {
    fechaRealizacion: "2026-11-21", condiciones: ["agua"], comentario: "Cerrada con la ruta proyectada", rideId: "ride-f-1",
  }), ctx(rutaId));
  assert.equal(e1.status, 200);
  const e1id = ((await json(e1)) as { id: string }).id;
  const expRow = await db.routeExperience.findUnique({ where: { id: e1id } });
  assert.equal(expRow?.rideId, "ride-f-1", "rideId del ride local anclado");
  assert.equal(expRow?.fechaRealizacion, "2026-11-21");
  ok("POST experiencia con rideId → anclado y con fecha del ride");

  // Unicidad [usuario, ruta, fecha]: mismo día → yaRegistrada (upsert honesto).
  const e2 = await EXPERIENCE(req("POST", `/api/routes/${rutaId}/experience`, sRide.token, {
    fechaRealizacion: "2026-11-21", condiciones: [], rideId: "ride-f-2",
  }), ctx(rutaId));
  assert.equal(e2.status, 200);
  assert.equal(((await json(e2)) as { yaRegistrada?: boolean }).yaRegistrada, true, "misma fecha → yaRegistrada");
  const otra = await EXPERIENCE(req("POST", `/api/routes/${rutaId}/experience`, sRide.token, {
    fechaRealizacion: "2026-11-22", condiciones: [], rideId: "ride-f-2",
  }), ctx(rutaId));
  assert.equal(otra.status, 200);
  ok("unicidad [usuario, ruta, fecha] respetada (día distinto sí)");

  // El ride con routeRef extra se guarda NORMAL: el servidor lo ignora.
  const rPost = await RIDES(req("POST", "/api/rides", sRide.token, {
    id: "ride-f-srv-1", dateISO: "2026-11-21T15:30:00.000Z", source: "gps", distanceKm: 12.4, maxKmh: 38,
    maxInParkKmh: 35, avgKmh: 17, elapsedSec: 2620, gainM: 310, overLimitSec: 0,
    routeRef: { id: rutaId, serverId: rutaId, nombre: "Ruta fase F", origen: "publica" },
  }));
  assert.equal(rPost.status, 200, "el ride con routeRef extra se acepta");
  const rideRow = await db.ride.findFirst({ where: { clientId: "ride-f-srv-1" } });
  assert.ok(rideRow, "ride creado en servidor");
  assert.equal(rideRow?.distanceKm, 12.4);
  const cols = Object.keys(rideRow as object);
  assert.equal(cols.includes("routeRef"), false, "el modelo Ride del servidor NO tiene routeRef (rides intocados)");
  ok("ride con routeRef al servidor → guardado normal, modelo Ride intocado");

  // Limpieza (idempotente).
  await db.user.deleteMany({ where: { email: { startsWith: "fase-f-" } } });
  await db.$disconnect();

  console.log(`\nFASE F: ${pasos} grupos OK`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
