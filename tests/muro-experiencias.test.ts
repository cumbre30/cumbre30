// ============================================================
// Muro público de experiencias (2026-11-21) · smoke test con DB REAL.
// GET /api/experiences: solo con sesión (401 honesto sin ella); el
// feed muestra experiencias VIVAS (removedAt null) de rutas
// PUBLICADAS — las ocultas por moderación y las retiradas no exponen
// contenido — con username público, resumen de ruta, fotos (≤3) y
// conteo (total + ciclistas distintos). Orden: más reciente primero.
// Precondiciones (las corre el pipeline):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30
//   + migraciones aplicadas (prisma migrate deploy).
// Ejecutar: DATABASE_URL=… npx tsx tests/muro-experiencias.test.ts
// ============================================================
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { POST as POST_RUTA } from "../src/app/api/routes/route";
import { POST as POST_EXP } from "../src/app/api/routes/[id]/experience/route";
import { GET } from "../src/app/api/experiences/route";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}
function req(metodo: string, path: string, token: string | null, body?: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, {
    method: metodo,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

if (!process.env.DATABASE_URL) {
  console.error("FALTA DATABASE_URL (el pipeline arranca PG y aplica migraciones antes).");
  process.exit(2);
}
const dbPrueba = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const semilla = Date.now();
const RUTA = {
  nombre: "Cerro San Ramón muro",
  descripcion: "Ruta de prueba del muro de experiencias",
  modalidad: "montana",
  coords: [
    { lat: -33.486, lon: -70.53 },
    { lat: -33.489, lon: -70.527 },
    { lat: -33.493, lon: -70.524 },
    { lat: -33.497, lon: -70.521 },
  ],
  attrs: ["desafiante", "miradores"],
  dificultadFisica: 4,
  dificultadTecnica: 3,
  proteccion: { recorteIniM: 150, recorteFinM: 150, snapInicio: true },
  ele: { gainM: 640, lossM: 638, minEle: 812, maxEle: 1452 },
  eleFuente: "gpx",
  pois: [{ lat: -33.487, lon: -70.529, tipo: "agua", nombre: "Grifo camino" }],
  clientId: `cli-muro-${semilla}`,
};

async function main(): Promise<void> {
  // ---------- semillas: dos ciclistas con sesión Bearer ----------
  const ciclistaA = await dbPrueba.user.create({
    data: { email: `muro-a-${semilla}@test.local`, username: `muroA${semilla}`, passwordHash: "x" },
  });
  const ciclistaB = await dbPrueba.user.create({
    data: { email: `muro-b-${semilla}@test.local`, username: `muroB${semilla}`, passwordHash: "x" },
  });
  const sesA = await dbPrueba.session.create({ data: { userId: ciclistaA.id, token: `tok-muro-a-${semilla}`, expiresAt: new Date(Date.now() + 86_400_000) } });
  const sesB = await dbPrueba.session.create({ data: { userId: ciclistaB.id, token: `tok-muro-b-${semilla}`, expiresAt: new Date(Date.now() + 86_400_000) } });

  try {
    // ---------- rutas: una publicada y una oculta por moderación ----------
    const vivaRes = await POST_RUTA(req("POST", "/api/routes", sesA.token, RUTA));
    assert.equal(vivaRes.status, 200);
    const rutaViva = ((await vivaRes.json()) as { id: string }).id;

    const ocultaRes = await POST_RUTA(req("POST", "/api/routes", sesA.token, { ...RUTA, nombre: "Ruta oculta muro", clientId: `cli-muro-oculta-${semilla}` }));
    assert.equal(ocultaRes.status, 200);
    const rutaOculta = ((await ocultaRes.json()) as { id: string }).id;
    await dbPrueba.route.update({ where: { id: rutaOculta }, data: { status: "oculta" } });
    ok("semillas: ruta publicada + ruta marcada oculta por moderación");

    // ---------- experiencias: visible / en ruta oculta / removida ----------
    const eVisible = await POST_EXP(
      req("POST", `/api/routes/${rutaViva}/experience`, sesB.token, {
        fechaRealizacion: "2026-11-15",
        comentario: "Subida dura, pero el mirador lo vale completo.",
        condiciones: ["barro", "sombra"],
        observacion: "Llevar dos litros: no hay agua después del grifo.",
      }),
      ctx(rutaViva)
    );
    assert.equal(eVisible.status, 200, `experiencia visible debió crearse (dio ${eVisible.status})`);
    const idVisible = ((await eVisible.json()) as { id: string }).id;

    // El POST rechaza rutas ocultas (solo «publicado» acepta
    // experiencias): el caso «se registró cuando estaba publicada y
    // luego la ocultaron» se siembra directo en DB.
    const eOculta = await POST_EXP(
      req("POST", `/api/routes/${rutaOculta}/experience`, sesB.token, { fechaRealizacion: "2026-11-16", comentario: "NO debe aparecer en el muro." }),
      ctx(rutaOculta)
    );
    assert.equal(eOculta.status, 404, "no se puede registrar experiencia en una ruta oculta");
    const versionOculta = await dbPrueba.routeVersion.findFirst({ where: { routeId: rutaOculta }, orderBy: { v: "desc" } });
    assert.ok(versionOculta, "la ruta oculta tiene versión");
    const expOculta = await dbPrueba.routeExperience.create({
      data: {
        routeId: rutaOculta,
        routeVersionId: versionOculta.id,
        userId: ciclistaB.id,
        fechaRealizacion: "2026-11-16",
        comentario: "NO debe aparecer en el muro.",
        condiciones: [],
      },
      select: { id: true },
    });
    const idOculta = expOculta.id;
    ok("semillas: experiencia en ruta oculta (registrada antes del ocultamiento)");

    const eRemovida = await POST_EXP(
      req("POST", `/api/routes/${rutaViva}/experience`, sesA.token, { fechaRealizacion: "2026-11-17", comentario: "NO debe aparecer: removedAt." }),
      ctx(rutaViva)
    );
    assert.equal(eRemovida.status, 200);
    const idRemovida = ((await eRemovida.json()) as { id: string }).id;
    await dbPrueba.routeExperience.update({ where: { id: idRemovida }, data: { removedAt: new Date() } });
    ok("semillas: experiencia visible + en ruta oculta + removida (removedAt)");

    // ---------- 1) sin sesión → 401 ----------
    const sinSesion = await GET(req("GET", "/api/experiences", null));
    assert.equal(sinSesion.status, 401, `sin sesión debe ser 401 (dio ${sinSesion.status})`);
    ok("GET /api/experiences sin sesión → 401 (política de invitado)");

    // ---------- 2) feed con sesión: filtrado honesto ----------
    const feedRes = await GET(req("GET", "/api/experiences", sesA.token));
    assert.equal(feedRes.status, 200);
    const feed = (await feedRes.json()) as {
      experiencias: { id: string; username: string; comentario: string | null; condiciones: string[]; fotos: string[]; ruta: { id: string; nombre: string; distKm: number } }[];
      total: number;
      ciclistas: number;
    };
    const ids = feed.experiencias.map((e) => e.id);
    assert.ok(ids.includes(idVisible), "la experiencia visible aparece en el muro");
    assert.ok(!ids.includes(idOculta), "la experiencia de una ruta OCULTA no aparece");
    assert.ok(!ids.includes(idRemovida), "la experiencia con removedAt no aparece");
    const enMuro = feed.experiencias.find((e) => e.id === idVisible)!;
    assert.equal(enMuro.username, `muroB${semilla}`, "username público del autor");
    assert.equal(enMuro.ruta.id, rutaViva);
    assert.equal(enMuro.ruta.nombre, RUTA.nombre);
    assert.deepEqual(enMuro.condiciones, ["barro", "sombra"]);
    assert.deepEqual(enMuro.fotos, [], "sin fotos el muro lleva lista vacía");
    assert.ok(feed.total >= 1, "conteo total ≥ 1");
    assert.ok(feed.ciclistas >= 1, "conteo de ciclistas distintos ≥ 1");
    ok("feed: visibles sí, ocultas/removidas no, username + ruta + condiciones correctos");

    // ---------- 3) take acotado ----------
    const feedCortoRes = await GET(req("GET", "/api/experiences?take=1", sesB.token));
    assert.equal(feedCortoRes.status, 200);
    const feedCorto = (await feedCortoRes.json()) as { experiencias: unknown[] };
    assert.equal(feedCorto.experiencias.length, 1, "take=1 devuelve una sola");
    ok("take=1 acota el feed");

    console.log(`\nMURO-EXPERIENCIAS: ${pasos} verificaciones OK con DB real`);
  } finally {
    await dbPrueba.user.delete({ where: { id: ciclistaA.id } });
    await dbPrueba.user.delete({ where: { id: ciclistaB.id } });
    await dbPrueba.$disconnect();
  }
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
