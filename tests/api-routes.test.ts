// ============================================================
// Fase A · smoke test de la API /api/routes con base de datos REAL
// (criterio de aceptación: "la API autentica y rechaza escritura
// sin sesión"). Invoca los handlers directamente con Request y
// sesiones Bearer reales creadas en la base local.
//
// Precondiciones (las corre el pipeline de pruebas):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30
//   + migraciones aplicadas (prisma migrate deploy).
// Ejecutar: DATABASE_URL=… npx tsx tests/api-routes.test.ts
// ============================================================
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { POST, GET } from "../src/app/api/routes/route";
import { GET as GET_UNO, PATCH, DELETE } from "../src/app/api/routes/[id]/route";
import { polylineDecode } from "../src/lib/routeGeo";

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

if (!process.env.DATABASE_URL) {
  console.error("FALTA DATABASE_URL (el pipeline arranca PG y aplica migraciones antes).");
  process.exit(2);
}
const dbPrueba = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const RUTA = {
  nombre: "Cerro San Ramón oriente",
  descripcion: "Subida por cordón norte (ruta de prueba fase A)",
  modalidad: "montana",
  coords: [
    { lat: -33.4860, lon: -70.5300 },
    { lat: -33.4890, lon: -70.5270 },
    { lat: -33.4930, lon: -70.5240 },
    { lat: -33.4970, lon: -70.5210 },
  ],
  attrs: ["desafiante", "miradores"],
  dificultadFisica: 4,
  dificultadTecnica: 3,
  proteccion: { recorteIniM: 150, recorteFinM: 150, snapInicio: true },
  ele: { gainM: 640, lossM: 638, minEle: 812, maxEle: 1452 },
  eleFuente: "gpx",
  pois: [
    { lat: -33.4870, lon: -70.5290, tipo: "agua", nombre: "Grifo camino" },
    { lat: -33.4960, lon: -70.5220, tipo: "mirador", nombre: "Vista valle" },
  ],
  clientId: "cli-fase-a-001",
};

async function main(): Promise<void> {
  // ---------- semillas: dos ciclistas con sesión Bearer ----------
  const dueño = await dbPrueba.user.create({ data: { email: "fase-a-dueño@test.local", username: "faseAdueno", passwordHash: "x" } });
  const otro = await dbPrueba.user.create({ data: { email: "fase-a-otro@test.local", username: "faseAotro", passwordHash: "x" } });
  const sesDueño = await dbPrueba.session.create({ data: { userId: dueño.id, token: "tok-dueno-" + Date.now(), expiresAt: new Date(Date.now() + 86_400_000) } });
  const sesOtro = await dbPrueba.session.create({ data: { userId: otro.id, token: "tok-otro-" + Date.now(), expiresAt: new Date(Date.now() + 86_400_000) } });

  try {
    // ---------- 1) escritura SIN sesión → 401 ----------
    const sinSesion = await POST(req("POST", "/api/routes", null, RUTA));
    assert.equal(sinSesion.status, 401, `sin sesión debe ser 401 (dio ${sinSesion.status})`);
    const sinSesionJson = (await sinSesion.json()) as { error: string };
    assert.match(sinSesionJson.error, /Sin sesión/);
    ok("POST sin sesión → 401 (criterio de aceptación fase A)");

    const getSinSesion = await GET(req("GET", "/api/routes", null));
    assert.equal(getSinSesion.status, 401);
    ok("GET sin sesión → 401");

    // ---------- 2) payload inválido → 400 ----------
    const unPunto = await POST(req("POST", "/api/routes", sesDueño.token, { ...RUTA, coords: [{ lat: -33.4, lon: -70.6 }] }));
    assert.equal(unPunto.status, 400);
    const sinNombre = await POST(req("POST", "/api/routes", sesDueño.token, { ...RUTA, nombre: "   " }));
    assert.equal(sinNombre.status, 400);
    const attrInvalido = await POST(req("POST", "/api/routes", sesDueño.token, { ...RUTA, attrs: ["turbo"] }));
    assert.equal(attrInvalido.status, 400, "enumerado recreativo cerrado");
    const muchosAttrs = await POST(req("POST", "/api/routes", sesDueño.token, { ...RUTA, attrs: ["escenica", "familiar", "recreativa", "desafiante"] }));
    assert.equal(muchosAttrs.status, 400, "máximo 3 atributos");
    ok("validación: 1 punto, nombre vacío, atributos inválidos/extra → 400");

    // ---------- 3) creación válida → derivados en el servidor ----------
    const creada = await POST(req("POST", "/api/routes", sesDueño.token, RUTA));
    assert.equal(creada.status, 200);
    const c1 = (await creada.json()) as { ok: boolean; id: string; versionId: string; version: number };
    assert.equal(c1.ok, true);
    assert.equal(c1.version, 1, "primera versión publicada = v1");
    assert.ok(c1.versionId, "devuelve versionId (ancla para rides/experiencias)");

    const fila = await dbPrueba.route.findUnique({ where: { id: c1.id }, include: { versions: true, pois: true } });
    assert.ok(fila);
    assert.equal(fila.ownerId, dueño.id);
    assert.equal(fila.status, "publicado");
    // bbox exacto del payload (predicado C1):
    assert.equal(fila.minLat, -33.497);
    assert.equal(fila.maxLat, -33.486);
    assert.equal(fila.minLon, -70.53);
    assert.equal(fila.maxLon, -70.521);
    // extremos aproximados a 3 decimales (jamás el pin exacto):
    assert.equal(fila.inicioAproxLat, -33.486);
    assert.equal(fila.finAproxLon, -70.521);
    // polyline decodifica a los mismos puntos (formato de entrega):
    const decodificada = polylineDecode(fila.polyline);
    assert.equal(decodificada.length, RUTA.coords.length);
    assert.ok(Math.abs(decodificada[0].lat - RUTA.coords[0].lat) < 1e-5);
    // celdas para las consultas (C2):
    assert.ok(fila.cells.length >= 1);
    // elevación real del payload (no 0 ficticio):
    assert.equal(fila.gainM, 640);
    assert.equal(fila.eleFuente, "gpx");
    // atributos + POIs:
    assert.deepEqual([...fila.attrs].sort(), ["desafiante", "miradores"]);
    assert.equal(fila.pois.length, 2);
    // versión con snapshot:
    assert.equal(fila.versions.length, 1);
    assert.equal(fila.versions[0].v, 1);
    assert.equal(fila.versions[0].geometrySnapshot, fila.polyline);
    const proteccion = fila.proteccion as Record<string, unknown>;
    assert.equal(proteccion.recorteIniM, 150, "registro de protección conservado");
    ok("POST válido: bbox/celdas/polyline/extremos aprox. derivados en el servidor + RouteVersion v1 + POIs");

    // ---------- 4) elevación ausente → null explícito, JAMÁS 0 ----------
    const sinEle = await POST(req("POST", "/api/routes", sesDueño.token, { ...RUTA, clientId: "cli-fase-a-002", ele: undefined, eleFuente: undefined }));
    const s2 = (await sinEle.json()) as { id: string };
    const filaSinEle = await dbPrueba.route.findUnique({ where: { id: s2.id } });
    assert.ok(filaSinEle);
    assert.equal(filaSinEle.gainM, null, "sin datos de elevación queda null (nunca 0)");
    assert.equal(filaSinEle.lossM, null);
    assert.equal(filaSinEle.eleFuente, null);
    ok("sin elevación → gainM/lossM/eleFuente NULL explícito (§5.1)");

    // ---------- 5) idempotencia por clientId (reintento del outbox) ----------
    const reintento = await POST(req("POST", "/api/routes", sesDueño.token, RUTA));
    const r1 = (await reintento.json()) as { dedup: boolean; id: string };
    assert.equal(r1.dedup, true);
    assert.equal(r1.id, c1.id);
    const totalVersiones = await dbPrueba.routeVersion.count({ where: { routeId: c1.id } });
    assert.equal(totalVersiones, 1, "el reintento no crea versión nueva");
    ok("reintento con mismo clientId → dedup (outbox no duplica)");

    // ---------- 6) listado propio ----------
    const lista = await GET(req("GET", "/api/routes", sesDueño.token));
    assert.equal(lista.status, 200);
    const l1 = (await lista.json()) as { routes: { id: string }[] };
    assert.ok(l1.routes.some((r) => r.id === c1.id));
    assert.ok(l1.routes.some((r) => r.id === s2.id));
    const listaOtro = await GET(req("GET", "/api/routes", sesOtro.token));
    const l2 = (await listaOtro.json()) as { routes: { id: string }[] };
    assert.ok(!l2.routes.some((r) => r.id === c1.id), "otro usuario no ve las rutas ajenas en su listado");
    ok("GET lista: propias sí, ajenas no");

    // ---------- 7) detalle y propiedad ----------
    const detalleAjeno = await GET_UNO(req("GET", `/api/routes/${c1.id}`, sesOtro.token), { params: Promise.resolve({ id: c1.id }) });
    assert.equal(detalleAjeno.status, 200, "ruta publicada es visible para otro usuario (fase A: lectura)");
    const patchAjeno = await PATCH(req("PATCH", `/api/routes/${c1.id}`, sesOtro.token, { nombre: "hack" }), { params: Promise.resolve({ id: c1.id }) });
    assert.equal(patchAjeno.status, 404, "edición ajena → 404 (no filtra existencia)");
    ok("detalle público sí; edición por no-propietario → 404");

    // ---------- 8) PATCH del dueño: metadatos + versión nueva ----------
    const ajuste = await PATCH(req("PATCH", `/api/routes/${c1.id}`, sesDueño.token, { dificultadFisica: 3, attrs: ["desafiante"] }), { params: Promise.resolve({ id: c1.id }) });
    assert.equal(ajuste.status, 200);
    const trasAjuste = await dbPrueba.route.findUnique({ where: { id: c1.id } });
    assert.equal(trasAjuste?.dificultadFisica, 3);
    assert.equal(trasAjuste?.dificultadOrigen, "creador", "ajuste del creador queda registrado");
    assert.equal(trasAjuste?.attrs.length, 1);

    const nuevaGeom = await PATCH(req("PATCH", `/api/routes/${c1.id}`, sesDueño.token, { coords: [...RUTA.coords, { lat: -33.5, lon: -70.52 }] }), { params: Promise.resolve({ id: c1.id }) });
    const g1 = (await nuevaGeom.json()) as { version: number };
    assert.equal(g1.version, 2, "editar geometría crea RouteVersion v2");
    const versiones = await dbPrueba.routeVersion.findMany({ where: { routeId: c1.id }, orderBy: { v: "asc" } });
    assert.equal(versiones.length, 2);
    assert.notEqual(versiones[1].geometrySnapshot, versiones[0].geometrySnapshot);
    ok("PATCH dueño: metadatos (dificultadOrigen=creador) y geometría → versión v2");

    // ---------- 9) revisión de vigencia por el creador ----------
    await PATCH(req("PATCH", `/api/routes/${c1.id}`, sesDueño.token, { ultimaRevisionAt: true }), { params: Promise.resolve({ id: c1.id }) });
    const trasRevision = await dbPrueba.route.findUnique({ where: { id: c1.id } });
    assert.ok(trasRevision?.ultimaRevisionAt);
    assert.equal(trasRevision?.estadoVigencia, "vigente");
    ok("ultimaRevisionAt actualizable por el creador (§7.4)");

    // ---------- 10) DELETE (soft) del dueño ----------
    const borrado = await DELETE(req("DELETE", `/api/routes/${s2.id}`, sesDueño.token), { params: Promise.resolve({ id: s2.id }) });
    assert.equal(borrado.status, 200);
    const trasBorrado = await dbPrueba.route.findUnique({ where: { id: s2.id } });
    assert.ok(trasBorrado?.removedAt, "soft-delete con removedAt");
    assert.equal(trasBorrado?.status, "retirada");
    const listaTrasBorrado = await GET(req("GET", "/api/routes", sesDueño.token));
    const l3 = (await listaTrasBorrado.json()) as { routes: { id: string }[] };
    assert.ok(!l3.routes.some((r) => r.id === s2.id), "la lista excluye la borrada");
    const detalleBorrada = await GET_UNO(req("GET", `/api/routes/${s2.id}`, sesDueño.token), { params: Promise.resolve({ id: s2.id }) });
    assert.equal(detalleBorrada.status, 404);
    ok("DELETE: soft-delete (removedAt + retirada) y excluida de listas");

    console.log(`\nAPI-ROUTES: ${pasos} verificaciones OK con DB real`);
  } finally {
    await dbPrueba.user.delete({ where: { id: dueño.id } });
    await dbPrueba.user.delete({ where: { id: otro.id } });
    await dbPrueba.$disconnect();
  }
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
