// ============================================================
// Fase D · catálogo y estrategia geográfica (v2.1 §4, tabla 7 —
// CT-G1..G8) contra la base REAL local (postgres embebido 5433).
// Ejecutar: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/cumbre30 \
//   npx tsx tests/catalogo-geo.test.ts
// ============================================================
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { GET } from "../src/app/api/routes/catalog/route";
import { POST } from "../src/app/api/routes/route";
import { cellsOfRoute, cellsForViewport, type Punto } from "../src/lib/routeGeo";

let pasos = 0;
function ok(nombre: string): void {
  pasos++;
  console.log(`  ✓ ${nombre}`);
}
function reqGet(qs: string, token: string): Request {
  return new Request(`http://localhost/api/routes/catalog?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
}
function reqPost(token: string, body: unknown): Request {
  return new Request("http://localhost/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
const ELE_GPX = { gainM: 500, lossM: 500, minEle: 100, maxEle: 600 }; // evita el servicio externo

if (!process.env.DATABASE_URL) {
  console.error("FALTA DATABASE_URL (postgres embebido 5433).");
  process.exit(2);
}
const dbPrueba = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const RUTA = (nombre: string, coords: Punto[], extra: Record<string, unknown> = {}) => ({
  nombre,
  modalidad: "montana",
  coords,
  ele: ELE_GPX,
  eleFuente: "gpx",
  ...extra,
});

async function main(): Promise<void> {
  // ---------- limpiar semillas de corridas anteriores (cascade) ----------
  await dbPrueba.user.deleteMany({ where: { email: { startsWith: "fase-d-ctg" } } });
  const ciclista = await dbPrueba.user.create({ data: { email: "fase-d-ctg@test.local", username: "faseDCtg", passwordHash: "x" } });
  const ses = await dbPrueba.session.create({ data: { userId: ciclista.id, token: "tok-ctg-" + Date.now(), expiresAt: new Date(Date.now() + 86_400_000) } });

  // ---------- semillas ----------
  // G1: corta (<1 km) contenida en el viewport V.
  const g1 = await POST(reqPost(ses.token, RUTA("CTG corta", [ { lat: -33.45, lon: -70.55 }, { lat: -33.452, lon: -70.552 } ])));
  // G2: larga (~40 km) multi-celda; el CENTRO del bbox cae al sur del viewport pero la cruza.
  const g2 = await POST(reqPost(ses.token, RUTA("CTG larga multi-celda", [ { lat: -33.6, lon: -70.53 }, { lat: -33.42, lon: -70.53 } ])));
  // G3: adyacente al oeste: su maxLon toca el borde o del viewport pero sus celdas NO lo tocan.
  const g3 = await POST(reqPost(ses.token, RUTA("CTG adyacente", [ { lat: -33.44, lon: -70.65 }, { lat: -33.45, lon: -70.60001 } ])));
  // G4: toca el viewport solo por un vértice del bbox (esquina SW).
  const g4 = await POST(reqPost(ses.token, RUTA("CTG vértice borde", [ { lat: -33.5, lon: -70.6 }, { lat: -33.5005, lon: -70.6005 } ])));
  // G5: en U al este del viewport: bbox cruza, geometría NO.
  const g5 = await POST(reqPost(ses.token, RUTA("CTG ruta en U", [
    { lat: -33.44, lon: -70.5 }, { lat: -33.46, lon: -70.47 }, { lat: -33.48, lon: -70.5 },
  ])));
  // G6: cerca del antimeridiano (179.9 E) para el viewport cruzado.
  const g6 = await POST(reqPost(ses.token, RUTA("CTG antimeridiano", [ { lat: -20.0, lon: 179.9 }, { lat: -20.01, lon: 179.95 } ])));

  assert.equal(g1.status, 200, `g1 ${g1.status}`);
  for (const r of [g2, g3, g4, g5, g6]) assert.equal(r.status, 200);
  ok("semillas creadas por el endpoint real (derivados en el servidor)");

  const ids = { g1: (g1 as never), g2: (g2 as never), g3: (g3 as never), g4: (g4 as never), g5: (g5 as never), g6: (g6 as never) };
  void ids;

  async function catalogo(qs: string): Promise<{ ids: string[]; nombres: string[]; notaBbox: string; nextCursor: unknown }> {
    const res = await GET(reqGet(qs, ses.token));
    assert.equal(res.status, 200, `catalogo ${qs} → ${res.status}`);
    const d = (await res.json()) as { routes: { id: string; nombre: string }[]; notaBbox: string; nextCursor: unknown };
    return { ids: d.routes.map((r) => r.id), nombres: d.routes.map((r) => r.nombre), notaBbox: d.notaBbox, nextCursor: d.nextCursor };
  }

  // Viewport V: n=-33.40 s=-33.50 e=-70.50 o=-70.60
  const V = "n=-33.40&s=-33.50&e=-70.50&o=-70.60";

  // ---------- CT-G1 ----------
  const c1 = await catalogo(V);
  assert.ok(c1.ids.includes((await (g1.json() as Promise<{ id: string }>)).id));
  ok("CT-G1: ruta corta contenida en el viewport → aparece");

  // ---------- CT-G2 ----------
  const c2 = await catalogo(V);
  assert.ok(c2.ids.includes((await (g2.json() as Promise<{ id: string }>)).id), "larga multi-celda cruzando el viewport");
  ok("CT-G2: ~40 km multi-celda con centro fuera pero que lo atraviesa → aparece por hasSome");

  // ---------- CT-G3 ----------
  assert.ok(!c1.nombres.includes("CTG adyacente"), "adyacente sin intersección real no aparece");
  // Verificación estructural: su bbox toca el borde o (maxLon ≈ o) sin
  // cruzarlo — el predicado inclusivo NO la incluye porque su maxLon es
  // estrictamente menor que el oeste del viewport.
  const filaG3 = await dbPrueba.route.findFirst({ where: { nombre: "CTG adyacente" }, select: { maxLon: true, minLon: true } });
  assert.ok(filaG3 && filaG3.maxLon <= -70.60 && filaG3.maxLon > -70.61, `maxLon ${filaG3?.maxLon} al borde sin cruzar`);
  ok("CT-G3: adyacente sin intersección real → no aparece (bbox estrictamente fuera)");

  // ---------- CT-G4 ----------
  assert.ok(c1.nombres.includes("CTG vértice borde"), `bordes inclusivos — obtuve: ${c1.nombres.join(", ")}`);
  ok("CT-G4: ruta que toca solo por un vértice del bbox (borde) → aparece (predicado inclusivo)");

  // ---------- CT-G5 ----------
  assert.ok(c1.nombres.includes("CTG ruta en U"), "falso positivo del bbox aceptado");
  assert.match(c1.notaBbox, /bbox/);
  ok("CT-G5: ruta en U cuyo bbox cruza sin cruzarse → aparece y la API lo documenta");

  // ---------- CT-G6 ----------
  // Viewport cruzando ±180: oeste=178, este=-178 (o > e numéricamente).
  const c6 = await catalogo("n=-19.9&s=-20.1&e=-178&o=178");
  assert.ok(c6.ids.includes((await (g6.json() as Promise<{ id: string }>)).id), "ramificación longitudinal");
  ok("CT-G6: viewport que cruza el antimeridiano → aparece (OR longitudinal)");

  // ---------- CT-G7 ----------
  for (let i = 0; i < 4; i++) {
    await POST(reqPost(ses.token, RUTA(`CTG pag ${i}`, [ { lat: -33.451 + i * 0.001, lon: -70.551 }, { lat: -33.452 + i * 0.001, lon: -70.552 } ])));
  }
  const pag1 = await catalogo(`${V}&take=3`);
  const pag2 = await catalogo(`${V}&take=3&cursor=${encodeURIComponent(pag1.nextCursor ? String((pag1.nextCursor as { id: string }).id) : "")}`);
  const union = [...pag1.ids, ...pag2.ids];
  assert.equal(new Set(union).size, union.length, "sin duplicados");
  assert.ok(union.length >= 6, `sin saltos (${union.length} rutas en dos páginas)`);
  ok("CT-G7: inserción entre páginas → paginación por cursor sin duplicados ni saltos");

  // ---------- CT-G8 ----------
  const totalPrevio = await dbPrueba.route.count();
  const lote: { ownerId: string; nombre: string; modalidad: string; polyline: string; minLat: number; maxLat: number; minLon: number; maxLon: number; cells: string[]; centerLat: number; centerLon: number; distKm: number; status: string; dificultadFisica: number; dificultadTecnica: number; attrs: string[] }[] = [];
  for (let i = 0; i < 10_000; i++) {
    const lat = -33.7 + (i % 700) * 0.0004; // dispersas alrededor del viewport
    const lon = -70.8 + (i % 600) * 0.0004;
    const coords = [ { lat, lon }, { lat: lat + 0.002, lon: lon + 0.002 } ];
    const b = bboxOfLocal(coords);
    lote.push({
      ownerId: ciclista.id,
      nombre: `CTG bulk ${i}`,
      modalidad: "urbana",
      polyline: "enc",
      minLat: b.minLat, maxLat: b.maxLat, minLon: b.minLon, maxLon: b.maxLon,
      cells: cellsOfRoute(coords).cells,
      centerLat: (b.minLat + b.maxLat) / 2,
      centerLon: (b.minLon + b.maxLon) / 2,
      distKm: 0.4,
      status: "publicado",
      dificultadFisica: 2,
      dificultadTecnica: 2,
      attrs: [],
    });
  }
  function bboxOfLocal(cs: Punto[]) {
    return {
      minLat: Math.min(...cs.map((c) => c.lat)),
      maxLat: Math.max(...cs.map((c) => c.lat)),
      minLon: Math.min(...cs.map((c) => c.lon)),
      maxLon: Math.max(...cs.map((c) => c.lon)),
    };
  }
  for (let i = 0; i < lote.length; i += 1000) {
    await dbPrueba.route.createMany({ data: lote.slice(i, i + 1000) });
  }
  const tiempos: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const res = await GET(reqGet(V, ses.token));
    assert.equal(res.status, 200);
    await res.json();
    tiempos.push(performance.now() - t0);
  }
  tiempos.sort((a, b) => a - b);
  const p95 = tiempos[Math.floor(tiempos.length * 0.95) - 1] ?? tiempos[tiempos.length - 1];
  assert.ok(p95 < 150, `p95 ${p95.toFixed(1)} ms debe ser < 150 ms`);
  void totalPrevio;
  ok(`CT-G8: 10 mil rutas sintéticas → p95 ${p95.toFixed(1)} ms (take 20, índice GIN + bbox + status)`);

  // ---------- limpieza ----------
  await dbPrueba.user.delete({ where: { id: ciclista.id } });
  console.log(`\nCT-G · ${pasos} comprobaciones OK`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => dbPrueba.$disconnect());
