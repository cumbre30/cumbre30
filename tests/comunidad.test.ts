// ============================================================
// Fase E · comunidad y moderación (v2.1 §6-§7) contra la base REAL
// local (postgres embebido 5433): favoritos, valoraciones,
// comentarios, reportes con umbral ponderado (§7.2), experiencias
// (§6) y moderación por roles (§7.3). Los reportes jamás cambian
// la geometría.
// Ejecutar: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/cumbre30 \
//   npx tsx tests/comunidad.test.ts
// ============================================================
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { POST as FAV } from "../src/app/api/routes/[id]/favorite/route";
import { POST as RATING } from "../src/app/api/routes/[id]/rating/route";
import { POST as COMMENT, DELETE as COMMENT_DEL } from "../src/app/api/routes/[id]/comments/route";
import { POST as REPORT } from "../src/app/api/routes/[id]/report/route";
import { POST as EXPERIENCE, DELETE as EXPERIENCE_DEL } from "../src/app/api/routes/[id]/experience/route";
import { GET as FAVORITES } from "../src/app/api/routes/favorites/route";
import { GET as MODQ, POST as MODACT } from "../src/app/api/moderation/route";
import { GET as DETALLE } from "../src/app/api/routes/[id]/route";
import { POST as CREAR_RUTA } from "../src/app/api/routes/route";
import { pesoReportante, evaluarAutohide, vigenciaConReportes } from "../src/lib/comunidad";

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
/** Contexto de params que Next entrega a los handlers anidados. */
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const ELE = { gainM: 300, lossM: 300, minEle: 800, maxEle: 1100 };
const COORDS = [ { lat: -33.46, lon: -70.55 }, { lat: -33.47, lon: -70.54 } ];

if (!process.env.DATABASE_URL) {
  console.error("FALTA DATABASE_URL (postgres embebido 5433).");
  process.exit(2);
}
const dbPrueba = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main(): Promise<void> {
  // ---------- limpiar corridas anteriores ----------
  await dbPrueba.user.deleteMany({ where: { email: { startsWith: "fase-e-" } } });

  // ---------- semillas ----------
  const hace100d = new Date(Date.now() - 100 * 86_400_000);
  const autor = await dbPrueba.user.create({ data: { email: "fase-e-autor@test.local", username: "faseEAutor", passwordHash: "x" } });
  const veterano = await dbPrueba.user.create({ data: { email: "fase-e-vet@test.local", username: "faseEVet", passwordHash: "x", createdAt: hace100d, rides: { create: Array.from({ length: 21 }, (_, i) => ({ dateISO: new Date(Date.now() - i * 86_400_000), source: "sim", distanceKm: 10, maxKmh: 30, avgKmh: 18, elapsedSec: 2000, gainM: 120, overLimitSec: 0 })) } } });
  const regular = await dbPrueba.user.create({ data: { email: "fase-e-reg@test.local", username: "faseEReg", passwordHash: "x", createdAt: new Date(Date.now() - 40 * 86_400_000) } });
  const nueva = await dbPrueba.user.create({ data: { email: "fase-e-nueva@test.local", username: "faseENueva", passwordHash: "x" } });
  const moderador = await dbPrueba.user.create({ data: { email: "fase-e-mod@test.local", username: "faseEMod", passwordHash: "x", role: "moderador" } });
  const tokens: Record<string, string> = {};
  for (const [k, u] of Object.entries({ autor, veterano, regular, nueva, moderador })) {
    const s = await dbPrueba.session.create({ data: { userId: u.id, token: "tok-e-" + k + "-" + Date.now(), expiresAt: new Date(Date.now() + 86_400_000) } });
    tokens[k] = s.token;
  }
  // Contribuciones confirmadas del veterano (≥3 → peso 1,5): motivos
  // distintos porque la dedupe es por [ruta, reportante, motivo].
  const rutaAncla = await dbPrueba.route.create({ data: { ownerId: autor.id, nombre: "Ancla", modalidad: "urbana", polyline: "enc", minLat: -33.5, maxLat: -33.49, minLon: -70.6, maxLon: -70.59, cells: ["abcd"], centerLat: -33.495, centerLon: -70.595, distKm: 1, status: "publicado", dificultadFisica: 2, dificultadTecnica: 2 } });
  const motivosAncla = ["spam", "error_geografico", "contenido_inapropiado"];
  for (const m of motivosAncla) {
    await dbPrueba.routeReport.create({ data: { routeId: rutaAncla.id, reporterId: veterano.id, motivo: m, estado: "confirmada", peso: 1.5 } });
  }

  const creada = await CREAR_RUTA(req("POST", "/api/routes", tokens.autor, {
    nombre: "Ruta comunidad", modalidad: "montana", coords: COORDS, ele: ELE, eleFuente: "gpx",
  }));
  assert.equal(creada.status, 200);
  const rutaId = ((await creada.json()) as { id: string }).id;
  ok("ruta pública de prueba creada");

  // ---------- favoritos ----------
  const f1 = await FAV(req("POST", `/api/routes/${rutaId}/favorite`, tokens.veterano), ctx(rutaId));
  assert.equal(f1.status, 200);
  assert.equal(((await json(f1)) as { favorito: boolean }).favorito, true);
  const f2 = await FAV(req("POST", `/api/routes/${rutaId}/favorite`, tokens.veterano), ctx(rutaId));
  assert.equal(((await json(f2)) as { favorito: boolean }).favorito, false, "toggle");
  await FAV(req("POST", `/api/routes/${rutaId}/favorite`, tokens.veterano), ctx(rutaId));
  const fl = await FAVORITES(req("GET", "/api/routes/favorites", tokens.veterano));
  const lista = (await json(fl)) as { favoritas: { id: string }[] };
  assert.ok(lista.favoritas.some((x) => x.id === rutaId));
  ok("favorito toggle + lista propia (tab Favoritas)");

  // ---------- valoración ----------
  const r1 = await RATING(req("POST", `/api/routes/${rutaId}/rating`, tokens.regular, { valor: 4 }), ctx(rutaId));
  const d1 = (await json(r1)) as { promedio: number; votos: number };
  assert.equal(d1.votos, 1);
  const r2 = await RATING(req("POST", `/api/routes/${rutaId}/rating`, tokens.regular, { valor: 5 }), ctx(rutaId));
  const d2 = (await json(r2)) as { promedio: number; votos: number };
  assert.equal(d2.valor, 5);
  assert.equal(d2.votos, 1, "upsert: actualizable, no duplica");
  assert.equal(d2.promedio, 5);
  const rBad = await RATING(req("POST", `/api/routes/${rutaId}/rating`, tokens.regular, { valor: 9 }), ctx(rutaId));
  assert.equal(rBad.status, 400);
  ok("valoración 1-5 upsert + promedio (sin ranking)");

  // ---------- comentarios ----------
  const c1 = await COMMENT(req("POST", `/api/routes/${rutaId}/comments`, tokens.regular, { body: "El tramo final está resbaladizo." }), ctx(rutaId));
  const c1d = (await json(c1)) as { comment: { id: string; username: string } };
  assert.equal(c1d.comment.username, "faseEReg");
  const cOtro = await COMMENT(req("POST", `/api/routes/${rutaId}/comments`, tokens.nueva, { body: "Comentario ajeno." }), ctx(rutaId));
  const cOtroD = (await json(cOtro)) as { comment: { id: string } };
  const cd = await COMMENT_DEL(req("DELETE", `/api/routes/${rutaId}/comments?commentId=${cOtroD.comment.id}`, tokens.regular), ctx(rutaId));
  assert.equal(cd.status, 403, "no borras el de otro");
  const cd2 = await COMMENT_DEL(req("DELETE", `/api/routes/${rutaId}/comments?commentId=${c1d.comment.id}`, tokens.regular), ctx(rutaId));
  assert.equal(cd2.status, 200);
  const det1 = await DETALLE(req("GET", `/api/routes/${rutaId}`, tokens.veterano), ctx(rutaId));
  const det1d = (await json(det1)) as { route: { comunidad: { comentarios: { body: string }[] } } };
  // El propio quedó soft-deleted; el ajeno sigue (el 403 fue correcto).
  assert.equal(det1d.route.comunidad.comentarios.length, 1);
  assert.equal(det1d.route.comunidad.comentarios[0].body, "Comentario ajeno.");
  ok("comentarios ≤1000 con soft-delete propio y 403 ajeno");

  // ---------- experiencias ----------
  const hoy = new Date().toISOString().slice(0, 10);
  const e1 = await EXPERIENCE(req("POST", `/api/routes/${rutaId}/experience`, tokens.veterano, {
    fechaRealizacion: hoy, comentario: "Salida tranquila", condiciones: ["camino_ok", "sombra"], observacion: "Lleva agua",
  }), ctx(rutaId));
  assert.equal(e1.status, 200);
  const e2 = await EXPERIENCE(req("POST", `/api/routes/${rutaId}/experience`, tokens.veterano, {
    fechaRealizacion: hoy, comentario: "otra",
  }), ctx(rutaId));
  const e2d = (await json(e2)) as { yaRegistrada?: boolean };
  assert.equal(e2d.yaRegistrada, true, "una por usuario/ruta/fecha");
  const eBad = await EXPERIENCE(req("POST", `/api/routes/${rutaId}/experience`, tokens.regular, {
    fechaRealizacion: hoy, condiciones: ["camino_ok", "barro", "agua", "otro"],
  }), ctx(rutaId));
  assert.equal(eBad.status, 400, "máximo 3 condiciones");
  const det2 = await DETALLE(req("GET", `/api/routes/${rutaId}`, tokens.nueva), ctx(rutaId));
  const det2d = (await json(det2)) as { route: { comunidad: { experiencias: { condiciones: string[]; username: string }[] } } };
  assert.equal(det2d.route.comunidad.experiencias.length, 1);
  assert.deepEqual(det2d.route.comunidad.experiencias[0].condiciones, ["camino_ok", "sombra"]);
  assert.equal(det2d.route.comunidad.experiencias[0].username, "faseEVet");
  const ed = await EXPERIENCE_DEL(req("DELETE", `/api/routes/${rutaId}/experience?experienceId=x-no-existe`, tokens.veterano), ctx(rutaId));
  assert.equal(ed.status, 404);
  ok("experiencias: fecha obligatoria, ≤3 condiciones, unicidad por día, anclan a versión");

  // ---------- reportes: peso, umbral ponderado, autohide ----------
  const self = await REPORT(req("POST", `/api/routes/${rutaId}/report`, tokens.autor, { motivo: "cierre" }), ctx(rutaId));
  assert.equal(self.status, 400, "el autor no se denuncia");
  const dup1 = await REPORT(req("POST", `/api/routes/${rutaId}/report`, tokens.veterano, { motivo: "cierre", nota: "Puerta cerrada" }), ctx(rutaId));
  const dup1d = (await json(dup1)) as { ocultada: boolean };
  assert.equal(dup1d.ocultada, false, "un solo reportante: no oculta (peso 1,5 < 2,0)");
  const dup2 = await REPORT(req("POST", `/api/routes/${rutaId}/report`, tokens.veterano, { motivo: "cierre" }), ctx(rutaId));
  const dup2d = (await json(dup2)) as { yaReportado: boolean };
  assert.equal(dup2d.yaReportado, true, "dedupe por usuario/motivo");

  const rep2 = await REPORT(req("POST", `/api/routes/${rutaId}/report`, tokens.regular, { motivo: "cierre" }), ctx(rutaId));
  const rep2d = (await json(rep2)) as { ocultada: boolean };
  assert.equal(rep2d.ocultada, true, "1,5 (veterano) + 1,0 (regular) ≥ 2,0 y 2 reportantes → oculta");
  const filaRuta = await dbPrueba.route.findUnique({ where: { id: rutaId }, select: { status: true, estadoVigencia: true } });
  assert.equal(filaRuta?.status, "oculta");
  assert.equal(filaRuta?.estadoVigencia, "avisos", "reportes de cierre → aviso informativo");
  const logAuto = await dbPrueba.moderationLog.findFirst({ where: { targetType: "route", targetId: rutaId, accion: "autohide" } });
  assert.ok(logAuto, "ModerationLog con la decisión");
  const detalle = (logAuto?.detalle ?? {}) as { sumaPesos: number; reportantesDistintos: number; umbral: number };
  // Veterano 1,5 + sin contribuciones confirmadas 0,5 (§7.2: «menos de
  // 30 días o sin contribuciones confirmadas») = 2,0 = umbral justo.
  assert.equal(detalle.sumaPesos, 2.0);
  assert.equal(detalle.reportantesDistintos, 2);
  assert.equal(detalle.umbral, 2.0);
  ok("autohide §7.2: 1,5+1,0 ≥ 2,0 con 2 reportantes → oculta + avisos + log con pesos");

  // ---------- lote sospechoso: 3 cuentas de la misma semana, <1 h ----------
  const sospechosos: string[] = [];
  for (let i = 0; i < 3; i++) {
    const u = await dbPrueba.user.create({ data: { email: `fase-e-coord-${i}@test.local`, username: `faseECoord${i}`, passwordHash: "x" } });
    const s = await dbPrueba.session.create({ data: { userId: u.id, token: "tok-coord-" + i + "-" + Date.now(), expiresAt: new Date(Date.now() + 86_400_000) } });
    sospechosos.push(s.token);
  }
  const rutaSos = await CREAR_RUTA(req("POST", "/api/routes", tokens.autor, { nombre: "Ruta sospechoso", modalidad: "urbana", coords: COORDS, ele: ELE, eleFuente: "gpx" }));
  const rutaSosId = ((await rutaSos.json()) as { id: string }).id;
  for (const tok of sospechosos) {
    const res = await REPORT(req("POST", `/api/routes/${rutaSosId}/report`, tok, { motivo: "peligro" }), ctx(rutaSosId));
    assert.equal(res.status, 200);
  }
  const filaSos = await dbPrueba.route.findUnique({ where: { id: rutaSosId }, select: { status: true } });
  assert.equal(filaSos?.status, "publicado", "lote sospechoso NO auto-oculta");
  const clasSos = await dbPrueba.routeReport.count({ where: { routeId: rutaSosId, clasificacion: "sospechoso" } });
  assert.equal(clasSos, 3, "marcado sospechoso → cola");
  ok("lote sospechoso (3 cuentas misma semana <1 h) → cola sin ocultamiento (§7.2)");

  // ---------- moderación por roles ----------
  const modNo = await MODQ(req("GET", "/api/moderation", tokens.regular));
  assert.equal(modNo.status, 403, "rol user → 403");
  const cola = await MODQ(req("GET", "/api/moderation", tokens.moderador));
  assert.equal(cola.status, 200);
  const colaD = (await json(cola)) as { ocultas: { id: string }[]; sospechosos: unknown[] };
  assert.ok(colaD.ocultas.some((o) => o.id === rutaId));
  const restaurar = await MODACT(req("POST", "/api/moderation", tokens.moderador, { accion: "restaurar", rutaId, nota: "Cierre levantado por el parque" }));
  assert.equal(restaurar.status, 200);
  const filaTras = await dbPrueba.route.findUnique({ where: { id: rutaId }, select: { status: true } });
  assert.equal(filaTras?.status, "publicado", "ocultamiento reversible");
  const logRest = await dbPrueba.moderationLog.findFirst({ where: { targetType: "route", targetId: rutaId, accion: "restaurar" } });
  assert.ok(logRest);
  ok("moderación: 403 sin rol, cola con ocultas/sospechosos, restaurar + log");

  // ---------- peso decae por descartadas (pureza, §7.2) ----------
  assert.equal(pesoReportante({ diasCuenta: 100, contribucionesConfirmadas: 3, rides: 0, descartadas: 0 }), 1.5);
  assert.equal(pesoReportante({ diasCuenta: 100, contribucionesConfirmadas: 3, rides: 0, descartadas: 4 }), 0.5, "1,5 − 4×0,25");
  assert.equal(pesoReportante({ diasCuenta: 100, contribucionesConfirmadas: 3, rides: 0, descartadas: 20 }), 0.25, "piso 0,25");
  assert.equal(pesoReportante({ diasCuenta: 10, contribucionesConfirmadas: 0, rides: 0, descartadas: 0 }), 0.5);
  assert.equal(pesoReportante({ diasCuenta: 40, contribucionesConfirmadas: 0, rides: 0, descartadas: 0 }), 0.5, "sin confirmadas → poca actividad (§7.2)");
  assert.equal(pesoReportante({ diasCuenta: 40, contribucionesConfirmadas: 1, rides: 0, descartadas: 0 }), 1.0, "con una confirmada → regular");
  const decSpam = evaluarAutohide("spam", [{ motivo: "spam", peso: 5, reporterId: "x", clasificacion: "normal" }], []);
  assert.equal(decSpam.ocultar, false, "spam nunca auto-oculta");
  assert.equal(decSpam.loteSospechoso, false);
  assert.equal(decSpam.sumaPesos, 5);
  assert.equal(decSpam.reportantes, 1);
  assert.equal(decSpam.umbral, 2.0);
  assert.equal(vigenciaConReportes(new Date().toISOString(), 0), "vigente");
  assert.equal(vigenciaConReportes(new Date().toISOString(), 1), "avisos");
  ok("peso con decaimiento y piso; autohide solo cierre/peligro; vigencia con avisos");

  // ---------- limpieza ----------
  await dbPrueba.user.deleteMany({ where: { email: { startsWith: "fase-e-" } } });
  await dbPrueba.user.deleteMany({ where: { email: { startsWith: "fase-e-coord" } } });
  console.log(`\nComunidad · ${pasos} comprobaciones OK`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => dbPrueba.$disconnect());
