// ============================================================
// In-vivo FREE vs Pro (2026-11-21): propuesta Pro del muro, olas
// 1-3, contra el SERVER STANDALONE de producción (build real, no
// handlers en memoria). Igual que tests/pro-muro.test.ts pero por
// HTTP de verdad: routing, CORS, Bearer y sesiones de BD incluidos.
//
//   bash scripts/setup-postgres-dev.sh
//   DATABASE_URL=postgresql://… npx prisma db push
//   cd .next/standalone && DATABASE_URL=… node server.js  # :3100
//   node scripts/invivo-pro-muro.mjs
// ============================================================
import { PrismaClient } from "@prisma/client";

const BASE = process.env.VIVO_BASE ?? "http://127.0.0.1:3100";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres@127.0.0.1:5433/cumbre30" } } });

let pasos = 0;
const errores = [];
function ok(nombre) { pasos++; console.log(`  ✓ ${nombre}`); }
function fail(nombre, detalle) { console.error(`  ✗ ${nombre}: ${detalle}`); errores.push(`${nombre}: ${detalle}`); }
async function chequea(nombre, cond, detalle = "") {
  if (cond) ok(nombre);
  else fail(nombre, detalle || "condición falsa");
}

async function http(metodo, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: metodo, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* respuesta no-JSON */ }
  return { status: res.status, json, headers: res.headers };
}

// JPEG 1×1 válido (mismo que tests/pro-muro.test.ts).
const FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDA1NDQ0Hyc5PTgyPDIzNP/AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscHRJDNico6SozPKTcvf/9oADAMBAAIRAxEAPwA/8A/9k=";

const RUTA = {
  nombre: "InVivo Pro muro",
  descripcion: "Verificación in-vivo FREE vs Pro",
  modalidad: "montana",
  coords: [
    { lat: -33.486, lon: -70.53 },
    { lat: -33.489, lon: -70.527 },
    { lat: -33.493, lon: -70.524 },
  ],
  attrs: ["desafiante"],
  dificultadFisica: 4,
  dificultadTecnica: 3,
  proteccion: { recorteIniM: 150, recorteFinM: 150, snapInicio: true },
  ele: { gainM: 640, lossM: 638, minEle: 812, maxEle: 1452 },
  eleFuente: "gpx",
  pois: [],
  clientId: `cli-vivopromuro-${Date.now()}`,
};

(async () => {
  const semilla = Date.now();
  const emailPro = `vivopromuro-pro-${semilla}@test.local`;
  const emailFree = `vivopromuro-free-${semilla}@test.local`;
  const pro = await db.user.create({ data: { email: emailPro, username: `vivoProMuroP${semilla}`, passwordHash: "x" } });
  const free = await db.user.create({ data: { email: emailFree, username: `vivoProMuroF${semilla}`, passwordHash: "x" } });
  const sesPro = await db.session.create({ data: { userId: pro.id, token: `tok-vivopromuro-p-${semilla}`, expiresAt: new Date(Date.now() + 86_400_000) } });
  const sesFree = await db.session.create({ data: { userId: free.id, token: `tok-vivopromuro-f-${semilla}`, expiresAt: new Date(Date.now() + 86_400_000) } });
  await db.proDelivery.create({ data: { paymentId: `pay-vivopromuro-${semilla}`, email: emailPro, code: "x", amount: 7650, via: "manual" } });

  try {
    // ---------- invitado: la comunidad vive en la cuenta ----------
    let r = await http("GET", "/api/experiences", null);
    await chequea("invitado: muro → 401 (solo el mapa es libre)", r.status === 401, `status ${r.status}`);
    r = await http("GET", "/api/experiences/nuevas", null);
    await chequea("invitado: novedades → 401", r.status === 401, `status ${r.status}`);
    r = await http("GET", "/api/experiences/mias", null);
    await chequea("invitado: mias → 401", r.status === 401, `status ${r.status}`);

    // ---------- semillas por HTTP real ----------
    r = await http("POST", "/api/routes", sesPro.token, RUTA);
    await chequea("autor Pro: crea ruta publicada", r.status === 200 && r.json?.id, `status ${r.status} ${JSON.stringify(r.json)?.slice(0, 120)}`);
    const rutaId = r.json.id;

    r = await http("POST", `/api/routes/${rutaId}/experience`, sesPro.token, { fechaRealizacion: "2026-11-21", comentario: "Del autor Pro, in-vivo." });
    await chequea("autor Pro: publica experiencia", r.status === 200 && r.json?.id, `status ${r.status}`);
    const expProId = r.json.id;
    r = await http("POST", `/api/routes/${rutaId}/experience/photos`, sesPro.token, { experienciaId: expProId, foto: FOTO });
    await chequea("autor Pro: añade foto (galería)", r.status === 200, `status ${r.status}`);

    r = await http("POST", `/api/routes/${rutaId}/experience`, sesFree.token, { fechaRealizacion: "2026-11-20", comentario: "Del ciclista gratuito." });
    await chequea("ciclista FREE: publica experiencia", r.status === 200 && r.json?.id, `status ${r.status}`);
    const expFreeId = r.json.id;

    // ---------- muro con sesión: distintivo + galería ----------
    r = await http("GET", "/api/experiences", sesFree.token);
    const muro = r.json;
    const enPro = muro?.experiencias?.find((e) => e.id === expProId);
    const enFree = muro?.experiencias?.find((e) => e.id === expFreeId);
    await chequea("muro (sesión FREE): 200 con ambas experiencias", r.status === 200 && enPro && enFree, `status ${r.status}`);
    await chequea("muro: distintivo pro=true solo del registro de compras", enPro?.pro === true && enFree?.pro === false, `pro=${enPro?.pro}/${enFree?.pro}`);
    await chequea("muro: galería con la foto del autor", Array.isArray(enPro?.fotos) && enPro.fotos.length === 1, `fotos=${JSON.stringify(enPro?.fotos)?.slice(0, 80)}`);
    await chequea("muro: email del autor jamás expuesto", !JSON.stringify(muro).includes(emailPro), "");

    // ---------- ficha: pro + fotos + privacidad ----------
    r = await http("GET", `/api/routes/${rutaId}`, sesFree.token);
    const fichaTxt = JSON.stringify(r.json);
    const fPro = r.json?.route?.comunidad?.experiencias?.find((e) => e.id === expProId);
    await chequea("ficha: pro + foto presentes", r.status === 200 && fPro?.pro === true && fPro?.fotos?.length === 1, `status ${r.status}`);
    await chequea("ficha: email del autor jamás expuesto", !fichaTxt.includes(emailPro), "");

    // ---------- mias: fuente del CSV (ola 3c) ----------
    r = await http("GET", "/api/experiences/mias", sesPro.token);
    const mias = r.json;
    await chequea("mias Pro: 200, su experiencia con ruta y fecha para el CSV",
      r.status === 200 && mias?.total === 1 && mias?.experiencias?.[0]?.ruta?.id === rutaId && !!mias?.experiencias?.[0]?.fechaRealizacion,
      `status ${r.status} total=${mias?.total}`);
    await chequea("mias: rutasCubiertas presente", typeof mias?.rutasCubiertas === "number", `${mias?.rutasCubiertas}`);

    // ---------- novedades (ola 3b): FREE sin revelar, Pro cuenta ----------
    r = await http("GET", "/api/experiences/nuevas?desde=2026-01-01T00:00:00Z", sesFree.token);
    await chequea("novedades FREE: permitido:false sin conteo", r.status === 200 && r.json?.permitido === false && r.json?.total === 0, `status ${r.status} ${JSON.stringify(r.json)}`);

    await db.routeFavorite.create({ data: { userId: pro.id, routeId: rutaId } });
    r = await http("GET", "/api/experiences/nuevas?desde=2026-01-01T00:00:00Z", sesPro.token);
    const nov = r.json;
    await chequea("novedades Pro: permitido:true, cuenta la ajena y no la propia",
      r.status === 200 && nov?.permitido === true && nov?.total === 1 && nov?.items?.[0]?.id === expFreeId,
      `status ${r.status} ${JSON.stringify(nov)?.slice(0, 160)}`);
    r = await http("GET", "/api/experiences/nuevas?desde=2030-01-01T00:00:00Z", sesPro.token);
    await chequea("novedades Pro: desde el futuro → 0", r.status === 200 && r.json?.total === 0, `${r.json?.total}`);

    // ---------- CORS real (el WebView de Capacitor es cross-origin) ----------
    const pre = await fetch(`${BASE}/api/experiences/nuevas`, { method: "OPTIONS", headers: { "Origin": "capacitor://localhost", "Access-Control-Request-Method": "GET" } });
    await chequea("preflight CORS de novedades responde", pre.status < 400, `status ${pre.status}`);

    // ---------- fotos: límites por HTTP ----------
    r = await http("POST", `/api/routes/${rutaId}/experience/photos`, sesFree.token, { experienciaId: expFreeId, foto: FOTO });
    await chequea("FREE: 1 foto sí", r.status === 200, `status ${r.status}`);
    r = await http("POST", `/api/routes/${rutaId}/experience/photos`, sesFree.token, { experienciaId: expFreeId, foto: FOTO });
    await chequea("FREE: la 2ª foto → 403 honesto", r.status === 403, `status ${r.status}`);

    console.log(`\nIN-VIVO PRO-MURO: ${pasos} verificaciones OK${errores.length ? `, ${errores.length} FALLOS` : ""} contra ${BASE}`);
    if (errores.length) { console.error(errores.map((e) => `  ✗ ${e}`).join("\n")); process.exitCode = 1; }
  } finally {
    await db.user.delete({ where: { id: pro.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: free.id } }).catch(() => undefined);
    await db.$disconnect();
  }
})().catch((e) => { console.error("FALLO:", e); process.exit(1); });
