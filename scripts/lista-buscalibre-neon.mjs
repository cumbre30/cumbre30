#!/usr/bin/env node
// Lista las filas de cultura_recursos cuyo urlExterna apunta a Buscalibre,
// para casarlas contra los enlace_ficha de los JSON del usuario.
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();

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

const db = await conectar();
const res = await db.query(
  `SELECT id, titulo, autor, idioma, publicado, destacado, proveedor, "urlExterna"
   FROM cultura_recursos WHERE "urlExterna" ILIKE '%buscalibre%'
   ORDER BY idioma, publicado DESC, titulo`);
console.log(`filas con urlExterna buscalibre: ${res.rowCount}`);
for (const r of res.rows) {
  console.log(`- [${r.idioma}] pub=${r.publicado} "${r.titulo}" | ${r.autor} | id=${r.id}`);
  console.log(`    ${r.urlExterna}`);
}
// contexto general
const resumen = await db.query(`SELECT idioma, publicado, count(*)::int n FROM cultura_recursos GROUP BY 1,2 ORDER BY 1,2`);
console.table(resumen.rows);
await db.end();
