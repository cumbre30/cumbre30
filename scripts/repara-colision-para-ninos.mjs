// Reparación de la colisión «Ciclismo para niños» (id cmwsjxxjb8af6185bbe2b15e0).
// Restaura resena/extra/categorias EXACTAMENTE como estaban (lote-ciclismo-final.json,
// origen del registro publicado). Conserva las mejoras que trajo la actualización:
//   · urlExterna: ficha real de la misma edición (9788415448525/p/53325523, export
//     página 1 de Jean) en vez del enlace de búsqueda roto /libros/search (405)
//   · portadaUrl: imagen verificada HTTP 200 (la de OL daba 404 — verificado)
//   · anio: 2021, confirmado por Open Library
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();
const ID = "cmwsjxxjb8af6185bbe2b15e0";
const ORIG = {
  resena: "Introducción al ciclismo pensada para los más pequeños y sus familias: seguridad, técnica básica y juego sobre dos ruedas. La puerta de entrada al pedaleo en la biblioteca.",
  extra: "Introducción al ciclismo para lectores pequeños · Categoría Buscalibre «Ciclismo general y cicloturismo»",
  categorias: ["aventura", "personas"],
};

async function conectar() {
  const limpio = URI.replace("&channel_binding=require", "").replace(/sslmode=[^&]+&?/, "").replace(/\?$/, "");
  const hostname = new URL(limpio).hostname;
  const addrs = await dns.lookup(hostname, { all: true, family: 4 });
  if (!addrs.length) throw new Error(`Sin IPv4 para ${hostname}`);
  const c = new Client({
    connectionString: limpio.replace(hostname, addrs[0].address),
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined, servername: hostname },
    connectionTimeoutMillis: 30000,
  });
  await c.connect();
  return c;
}

(async () => {
  const db = await conectar();
  const antes = await db.query(
    `SELECT resena, extra, categorias FROM cultura_recursos WHERE id=$1`, [ID]);
  const a = antes.rows[0];
  console.log("ANTES  resena:", JSON.stringify(a.resena));
  console.log("ANTES  extra :", JSON.stringify(a.extra));
  console.log("ANTES  cats  :", JSON.stringify(a.categorias));
  await db.query(
    `UPDATE cultura_recursos SET resena=$1, extra=$2, categorias=$3, "updatedAt"=now() WHERE id=$4`,
    [ORIG.resena, ORIG.extra, ORIG.categorias, ID]);
  const despues = await db.query(
    `SELECT titulo, publicado, destacado, resena, extra, categorias, anio, autor,
            "urlExterna", "portadaUrl" FROM cultura_recursos WHERE id=$1`, [ID]);
  const d = despues.rows[0];
  console.log("\nDESPUÉS (restaurado + mejoras conservadas):");
  console.log(JSON.stringify(d, null, 1));
  const ok = d.resena === ORIG.resena && d.extra === ORIG.extra &&
    JSON.stringify(d.categorias) === JSON.stringify(ORIG.categorias);
  console.log(ok ? "\n✓ restauración verificada" : "\n✗ MISMATCH");
  await db.end();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e.message); process.exit(1); });
