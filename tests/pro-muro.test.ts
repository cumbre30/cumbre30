// ============================================================
// Propuesta Pro para el muro (2026-11-21) · smoke test con DB REAL.
// Se acumula por ola:
//   Ola 1 — fotos de experiencias (FREE 1 · PRO 6, solo el autor,
//           data URL ≤ ~300 KB), distintivo `pro` del autor en muro
//           y ficha (derivado del registro ProDelivery, jamás del
//           cliente), /api/experiences/mias (histórico propio).
//   Ola 2 — filtros del feed (condición/fecha), amigos primero,
//           historial por ruta con cursor (ver más).
//   Ola 3 — novedades de rutas guardadas, export CSV.
// Precondiciones (las corre el pipeline):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30
// Ejecutar: DATABASE_URL=… npx tsx tests/pro-muro.test.ts
// ============================================================
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { POST as POST_RUTA } from "../src/app/api/routes/route";
import { POST as POST_EXP } from "../src/app/api/routes/[id]/experience/route";
import { POST as POST_FOTO } from "../src/app/api/routes/[id]/experience/photos/route";
import { GET } from "../src/app/api/experiences/route";
import { GET as GET_MIAS } from "../src/app/api/experiences/mias/route";
import { GET as GET_NUEVAS } from "../src/app/api/experiences/nuevas/route";
import { GET as GET_UNO } from "../src/app/api/routes/[id]/route";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}
function req(metodo: string, path: string, token: string | null, body?: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, { method: metodo, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

if (!process.env.DATABASE_URL) {
  console.error("FALTA DATABASE_URL (el pipeline arranca PG y aplica migraciones antes).");
  process.exit(2);
}
const dbPrueba = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// JPEG mínimo válido (1×1) — cumple el formato data:image/jpeg;base64.
const FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDA1NDQ0Hyc5PTgyPDIzNP/AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscHRJDNico6SozPKTcvf/9oADAMBAAIRAxEAPwA/8A/9k=";

const RUTA = {
  nombre: "Cerro Pro muro",
  descripcion: "Ruta de prueba de la propuesta Pro",
  modalidad: "montana",
  coords: [
    { lat: -33.486, lon: -70.53 },
    { lat: -33.489, lon: -70.527 },
    { lat: -33.493, lon: -70.524 },
    { lat: -33.497, lon: -70.521 },
  ],
  attrs: ["desafiante"],
  dificultadFisica: 4,
  dificultadTecnica: 3,
  proteccion: { recorteIniM: 150, recorteFinM: 150, snapInicio: true },
  ele: { gainM: 640, lossM: 638, minEle: 812, maxEle: 1452 },
  eleFuente: "gpx",
  pois: [],
  clientId: `cli-promuro-${Date.now()}`,
};

async function main(): Promise<void> {
  const semilla = Date.now();
  const emailPro = `promuro-pro-${semilla}@test.local`;
  const emailFree = `promuro-free-${semilla}@test.local`;
  const pro = await dbPrueba.user.create({ data: { email: emailPro, username: `proMuroP${semilla}`, passwordHash: "x" } });
  const free = await dbPrueba.user.create({ data: { email: emailFree, username: `proMuroF${semilla}`, passwordHash: "x" } });
  const sesPro = await dbPrueba.session.create({ data: { userId: pro.id, token: `tok-promuro-p-${semilla}`, expiresAt: new Date(Date.now() + 86_400_000) } });
  const sesFree = await dbPrueba.session.create({ data: { userId: free.id, token: `tok-promuro-f-${semilla}`, expiresAt: new Date(Date.now() + 86_400_000) } });
  // El registro de compras es la fuente de verdad del servidor.
  await dbPrueba.proDelivery.create({ data: { paymentId: `pay-${semilla}`, email: emailPro, code: "x", amount: 7650, via: "manual" } });

  try {
    // ---------- semillas: ruta + experiencias de ambos ----------
    const rutaRes = await POST_RUTA(req("POST", "/api/routes", sesPro.token, RUTA));
    assert.equal(rutaRes.status, 200);
    const rutaId = ((await rutaRes.json()) as { id: string }).id;

    const expProRes = await POST_EXP(req("POST", `/api/routes/${rutaId}/experience`, sesPro.token, { fechaRealizacion: "2026-11-20", comentario: "Del autor Pro." }), ctx(rutaId));
    assert.equal(expProRes.status, 200);
    const expPro = ((await expProRes.json()) as { id: string }).id;
    const expFreeRes = await POST_EXP(req("POST", `/api/routes/${rutaId}/experience`, sesFree.token, { fechaRealizacion: "2026-11-19", comentario: "Del autor gratuito." }), ctx(rutaId));
    assert.equal(expFreeRes.status, 200);
    const expFree = ((await expFreeRes.json()) as { id: string }).id;
    ok("semillas: ruta publicada + experiencias de Pro y FREE");

    // ---------- OLA 1 · fotos: autenticación y autoría ----------
    const sinSesion = await POST_FOTO(req("POST", `/api/routes/${rutaId}/experience/photos`, null, { experienciaId: expFree, foto: FOTO }), ctx(rutaId));
    assert.equal(sinSesion.status, 401);
    ok("foto sin sesión → 401");

    const ajena = await POST_FOTO(req("POST", `/api/routes/${rutaId}/experience/photos`, sesPro.token, { experienciaId: expFree, foto: FOTO }), ctx(rutaId));
    assert.equal(ajena.status, 403, "solo el autor añade fotos");
    assert.match(((await ajena.json()) as { error: string }).error, /autor/);
    ok("foto de otro usuario → 403 (solo el autor)");

    const mala = await POST_FOTO(req("POST", `/api/routes/${rutaId}/experience/photos`, sesFree.token, { experienciaId: expFree, foto: "data:text/html;base64,PGI+" }), ctx(rutaId));
    assert.equal(mala.status, 400);
    ok("foto con formato inválido → 400");

    // ---------- OLA 1 · fotos: límites FREE 1 · PRO 6 ----------
    const free1 = await POST_FOTO(req("POST", `/api/routes/${rutaId}/experience/photos`, sesFree.token, { experienciaId: expFree, foto: FOTO }), ctx(rutaId));
    assert.equal(free1.status, 200, "la 1ª foto FREE entra");
    const free2 = await POST_FOTO(req("POST", `/api/routes/${rutaId}/experience/photos`, sesFree.token, { experienciaId: expFree, foto: FOTO }), ctx(rutaId));
    assert.equal(free2.status, 403, "la 2ª foto FREE se rechaza");
    assert.match(((await free2.json()) as { error: string }).error, /gratuito/);
    ok("FREE: 1 foto sí, la 2ª → 403 honesto");

    for (let i = 0; i < 6; i++) {
      const r = await POST_FOTO(req("POST", `/api/routes/${rutaId}/experience/photos`, sesPro.token, { experienciaId: expPro, foto: FOTO }), ctx(rutaId));
      assert.equal(r.status, 200, `foto PRO ${i + 1}`);
    }
    const pro7 = await POST_FOTO(req("POST", `/api/routes/${rutaId}/experience/photos`, sesPro.token, { experienciaId: expPro, foto: FOTO }), ctx(rutaId));
    assert.equal(pro7.status, 403, "la 7ª foto PRO se rechaza");
    ok("PRO: 6 fotos sí, la 7ª → 403 honesto");

    // ---------- OLA 1 · distintivo pro en muro y ficha ----------
    const muroRes = await GET(req("GET", "/api/experiences", sesFree.token));
    assert.equal(muroRes.status, 200);
    const muro = (await muroRes.json()) as { experiencias: { id: string; username: string; pro: boolean; fotos: string[] }[] };
    const enMuroPro = muro.experiencias.find((e) => e.id === expPro);
    const enMuroFree = muro.experiencias.find((e) => e.id === expFree);
    assert.ok(enMuroPro && enMuroFree, "ambas experiencias aparecen");
    assert.equal(enMuroPro!.pro, true, "autor con compra → pro:true");
    assert.equal(enMuroFree!.pro, false, "autor sin compra → pro:false");
    assert.equal(enMuroPro!.fotos.length, 6, "galería con las 6 fotos");
    ok("muro: distintivo pro del registro de compras + galería");

    const fichaRes = await GET_UNO(req("GET", `/api/routes/${rutaId}`, sesFree.token), ctx(rutaId));
    assert.equal(fichaRes.status, 200);
    const fichaJson = (await fichaRes.json()) as { route: { comunidad: { experiencias: { id: string; pro: boolean; fotos: string[] }[] } } };
    const fichaTxt = JSON.stringify(fichaJson);
    const fPro = fichaJson.route.comunidad.experiencias.find((e) => e.id === expPro)!;
    assert.equal(fPro.pro, true);
    assert.equal(fPro.fotos.length, 6);
    assert.ok(!fichaTxt.includes(emailPro), "el email del autor jamás sale en el payload");
    ok("ficha: pro + fotos presentes, email del autor nunca expuesto");

    // ---------- OLA 1 · mias (histórico propio) ----------
    // Segunda ruta del autor Pro para probar rutasCubiertas.
    const ruta2Res = await POST_RUTA(req("POST", "/api/routes", sesPro.token, { ...RUTA, nombre: "Segunda ruta pro", clientId: `cli-promuro2-${semilla}` }));
    const ruta2 = ((await ruta2Res.json()) as { id: string }).id;
    await POST_EXP(req("POST", `/api/routes/${ruta2}/experience`, sesPro.token, { fechaRealizacion: "2026-11-21" }), ctx(ruta2));

    const miasSin = await GET_MIAS(req("GET", "/api/experiences/mias", null));
    assert.equal(miasSin.status, 401);
    const miasRes = await GET_MIAS(req("GET", "/api/experiences/mias", sesPro.token));
    assert.equal(miasRes.status, 200);
    const mias = (await miasRes.json()) as { experiencias: { ruta: { id: string } }[]; total: number; rutasCubiertas: number };
    assert.equal(mias.experiencias.length, 2, "lista con las dos del dueño");
    assert.equal(mias.total, 2, "solo las del dueño de la sesión");
    assert.equal(mias.rutasCubiertas, 2, "rutas distintas cubiertas");
    const miasFree = await GET_MIAS(req("GET", "/api/experiences/mias", sesFree.token));
    const miasF = (await miasFree.json()) as { total: number };
    assert.equal(miasF.total, 1);
    ok("mias: histórico propio aislado por sesión + rutasCubiertas");

    // ---------- OLA 2 · filtros del muro (condición / fecha / amigos) ----------
    await dbPrueba.routeExperience.update({ where: { id: expPro }, data: { condiciones: ["barro"] } });
    await dbPrueba.routeExperience.update({ where: { id: expFree }, data: { condiciones: ["agua"] } });
    const muroCond = await GET(req("GET", "/api/experiences?cond=barro", sesFree.token));
    const muroC = (await muroCond.json()) as { experiencias: { id: string }[] };
    assert.ok(muroC.experiencias.some((e) => e.id === expPro), "cond=barro trae la de barro");
    assert.ok(!muroC.experiencias.some((e) => e.id === expFree), "cond=barro excluye la de agua");
    const muroFecha = await GET(req("GET", "/api/experiences?desde=2026-11-20", sesFree.token));
    const muroF = (await muroFecha.json()) as { experiencias: { id: string }[] };
    assert.ok(muroF.experiencias.some((e) => e.id === expPro) && !muroF.experiencias.some((e) => e.id === expFree), "desde excluye la antigua");
    ok("filtros: condición y rango de fechas validados en servidor");

    // Amigos primero: free sigue a pro → su experiencia arriba del
    // resto. Ambas llevan «barro» para que el filtro acote el conjunto
    // a NUESTRO par y la aserción sea inmune a residuos de otras
    // suites.
    await dbPrueba.routeExperience.update({ where: { id: expFree }, data: { condiciones: ["barro", "agua"] } });
    await dbPrueba.friendship.create({ data: { userId: free.id, friendId: pro.id } });
    const muroAm = await GET(req("GET", "/api/experiences?cond=barro&amigos=1", sesFree.token));
    const muroA = (await muroAm.json()) as { experiencias: { id: string }[] };
    const iPro = muroA.experiencias.findIndex((e) => e.id === expPro);
    const iFree = muroA.experiencias.findIndex((e) => e.id === expFree);
    assert.ok(iPro !== -1 && iFree !== -1, "el par filtrado está presente");
    assert.ok(iPro < iFree, "la de mi amigo queda antes que la de un ajeno");
    ok("amigos primero: orden estable con el amigo arriba");

    // ---------- OLA 2 · historial por ruta con cursor ----------
    const version2 = await dbPrueba.routeVersion.findFirst({ where: { routeId: ruta2 }, orderBy: { v: "desc" } });
    assert.ok(version2, "ruta2 con versión");
    for (let i = 0; i < 24; i++) {
      await dbPrueba.routeExperience.create({
        data: {
          routeId: ruta2,
          routeVersionId: version2.id,
          userId: pro.id,
          fechaRealizacion: `2026-${String((i % 12) + 1).padStart(2, "0")}-${i < 12 ? "01" : "15"}`,
          comentario: `lote ${i}`,
        },
      });
    }
    const p1 = await GET_UNO(req("GET", `/api/routes/${ruta2}`, sesFree.token), ctx(ruta2));
    const c1 = (await p1.json()) as { route: { comunidad: { experiencias: { id: string }[]; expHayMas: boolean; expCursor: string | null } } };
    assert.equal(c1.route.comunidad.experiencias.length, 20, "primera página = 20");
    assert.equal(c1.route.comunidad.expHayMas, true);
    assert.ok(c1.route.comunidad.expCursor, "cursor de siguiente página");
    const p2 = await GET_UNO(req("GET", `/api/routes/${ruta2}?expCursor=${c1.route.comunidad.expCursor}`, sesFree.token), ctx(ruta2));
    const c2 = (await p2.json()) as { route: { comunidad: { experiencias: { id: string }[]; expHayMas: boolean } } };
    assert.equal(c2.route.comunidad.experiencias.length, 5, "segunda página = resto");
    assert.equal(c2.route.comunidad.expHayMas, false);
    const ids1 = new Set(c1.route.comunidad.experiencias.map((e) => e.id));
    assert.ok(c2.route.comunidad.experiencias.every((e) => !ids1.has(e.id)), "sin repetidos entre páginas");
    ok("cursor: 20 + resto con expHayMas honesto y sin duplicados");

    // ---------- OLA 3 · novedades en rutas guardadas ----------
    // FREE: sin compra registrada → permitido:false (sin revelar nada).
    const novFree = await GET_NUEVAS(req("GET", "/api/experiences/nuevas?desde=2026-01-01T00:00:00Z", sesFree.token));
    assert.equal(novFree.status, 200);
    const novF = (await novFree.json()) as { permitido: boolean; total: number };
    assert.equal(novF.permitido, false);
    assert.equal(novF.total, 0);
    ok("novedades FREE: permitido:false sin conteo");

    // Pro con una favorita: la experiencia nueva del OTRO ciclista
    // cuenta; las propias no; desde el futuro no hay nada.
    await dbPrueba.routeFavorite.create({ data: { userId: pro.id, routeId: rutaId } });
    const novPro = await GET_NUEVAS(req("GET", "/api/experiences/nuevas?desde=2026-01-01T00:00:00Z", sesPro.token));
    const novP = (await novPro.json()) as { permitido: boolean; total: number; items: { id: string; username: string; ruta: { id: string } }[] };
    assert.equal(novP.permitido, true);
    assert.equal(novP.total, 1, "solo la experiencia ajena cuenta");
    assert.equal(novP.items[0]?.username, `proMuroF${semilla}`);
    assert.equal(novP.items[0]?.ruta.id, rutaId);
    const novFuturo = await GET_NUEVAS(req("GET", "/api/experiences/nuevas?desde=2030-01-01T00:00:00Z", sesPro.token));
    const novFu = (await novFuturo.json()) as { total: number };
    assert.equal(novFu.total, 0, "desde el futuro: nada");
    const novSin = await GET_NUEVAS(req("GET", "/api/experiences/nuevas", null));
    assert.equal(novSin.status, 401);
    ok("novedades Pro: favorita + ajena cuenta, propias no, 401 sin sesión");

    console.log(`\nPRO-MURO: ${pasos} verificaciones OK con DB real (ola 1)`);
  } finally {
    await dbPrueba.user.delete({ where: { id: pro.id } });
    await dbPrueba.user.delete({ where: { id: free.id } });
    await dbPrueba.$disconnect();
  }
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
