#!/usr/bin/env node
// Casa las 18 filas Buscalibre de Neon contra las 66 fichas de los JSON del usuario.
// Sin --aplicar: solo muestra la propuesta. Con --aplicar: UPDATE urlExterna.
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";

const fichas = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/data/buscalibre-ciclismo-jsons.json", "utf8"));
const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();
const APLICAR = process.argv.includes("--aplicar");

const norm = (s) => (s || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// palabras de relleno que no suman al score
const STOP = new Set(["de", "la", "el", "los", "las", "del", "y", "en", "para", "por", "con", "un", "una", "mi", "tu", "ed"]);

function tokens(s) {
  return norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t));
}

function matchear(titulo, autor) {
  const tT = tokens(titulo);
  // apellidos/firstname del autor (ignora partículas)
  const aT = norm(autor).split(" ").filter((t) => t.length > 3 && !["jose", "juan", "javier", "martin", "alonso"].includes(t));
  let best = null;
  for (const f of fichas) {
    const slug = (f.enlace_ficha.match(/\/libro-([a-z0-9-]+)\//) || [])[1] || "";
    const fT = tokens(slug.replace(/-/g, " "));
    const fA = tokens(f.autores.join(" "));
    const tHit = tT.filter((t) => fT.includes(t)).length;
    const aHit = aT.filter((a) => fA.includes(a)).length;
    const cobertura = tT.length ? tHit / tT.length : 0;
    const score = cobertura * 0.75 + (tHit && fT.length ? Math.min(tHit / Math.max(fT.length, 1), 1) * 0.25 : 0) + aHit * 0.15;
    if (!best || score > best.score) best = { score, f, tHit, tT: tT.length, aHit };
  }
  return best;
}

async function conectar() {
  const limpio = URI.replace("&channel_binding=require", "").replace(/sslmode=[^&]+&?/, "").replace(/\?$/, "");
  const hostname = new URL(limpio).hostname;
  const addrs = await dns.lookup(hostname, { all: true, family: 4 });
  const c = new Client({
    connectionString: limpio.replace(hostname, addrs[0].address),
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined, servername: hostname },
    connectionTimeoutMillis: 30000,
  });
  await c.connect();
  return c;
}

const db = await conectar();
const res = await db.query(
  `SELECT id, titulo, autor, publicado, "urlExterna" FROM cultura_recursos
   WHERE "urlExterna" ILIKE '%buscalibre%' ORDER BY publicado DESC, titulo`);

const propuestas = [];
for (const r of res.rows) {
  const b = matchear(r.titulo, r.autor);
  const ok = b && b.score >= 0.5;
  propuestas.push({ r, b, ok });
}

console.log("=== PROPUESTA DE CORRECCIÓN DE ENLACES (Buscalibre) ===\n");
let nOk = 0, nDudoso = 0;
for (const { r, b, ok } of propuestas) {
  if (!b) { console.log(`SIN MATCH: "${r.titulo}"`); nDudoso++; continue; }
  const etiqueta = ok ? "OK" : "DUDOSO";
  ok ? nOk++ : nDudoso++;
  console.log(`[${etiqueta} ${b.score.toFixed(2)}] pub=${r.publicado} "${r.titulo}" (${r.autor})`);
  console.log(`   título ficha: "${b.f.titulo}" (${b.f.autores.join(", ") || "?"}) · tHit ${b.tHit}/${b.tT} aHit ${b.aHit} · CLP ${b.f.precio_actual}`);
  console.log(`   viejo: ${r.urlExterna}`);
  console.log(`   nuevo: ${b.f.enlace_ficha}\n`);
}
console.log(`resumen: ${nOk} seguros · ${nDudoso} dudosos/sin match de ${res.rowCount}`);

if (APLICAR) {
  let n = 0;
  for (const { r, b, ok } of propuestas) {
    if (!ok) continue;
    if (b.f.enlace_ficha === r.urlExterna) continue;
    await db.query(`UPDATE cultura_recursos SET "urlExterna"=$1, "updatedAt"=now() WHERE id=$2`, [b.f.enlace_ficha, r.id]);
    n++;
  }
  console.log(`\nAPLICADO: ${n} urlExterna actualizadas`);
}
await db.end();
