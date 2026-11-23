#!/usr/bin/env node
// Aplica la corrección de urlExterna: enlaces de búsqueda (rotos por WAF) →
// enlaces de ficha real de Buscalibre. Guarda CSV de la corrección en download/.
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();

// 1) fichas de los 10 nuevos ES (JSON de candidatos; 2 confirmadas por los JSON del usuario)
const cand = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/data/lote-ciclismo-candidatos.json", "utf8"));
const porTituloCsv = {};
for (const c of cand) {
  if (c.idioma === "es" && c.url_buscalibre) porTituloCsv[c.titulo.toLowerCase()] = { url: c.url_buscalibre };
}

// 2) fichas halladas por búsqueda web para los previos (verificadas por slug)
const fichasWeb = {
  "El ciclista": "https://www.buscalibre.cl/libro-el-ciclista/9788408289685/p/56570772",
  "Elogio de la bicicleta": "https://www.buscalibre.cl/libro-elogio-de-la-bicicleta/9788497843256/p/2825333",
  "Cuentos de ciclismo": "https://www.buscalibre.cl/libro-cuentos-de-ciclismo/9788441407398/p/3060202",
  "La bicicleta, mi cámara y yo": "https://www.buscalibre.cl/libro-la-bicicleta-mi-camara-y-yo/9789589075814/p/30910210",
};

// map manual titulo_db → titulo_csv (difieren ligeramente)
const ALIAS = {};

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

const filasCsv = [];
let nAplicadas = 0;
for (const r of res.rows) {
  const keyCsv = (ALIAS[r.titulo] || r.titulo).toLowerCase();
  const nuevo = fichasWeb[r.titulo] || porTituloCsv[keyCsv]?.url || null;
  const origen = fichasWeb[r.titulo] ? "web_search" : (nuevo ? "cosecha_csv" : "sin_ficha");
  if (!nuevo || nuevo === r.urlExterna) {
    console.log(`MANTIENE (${origen}): "${r.titulo}"`);
  } else {
    await db.query(`UPDATE cultura_recursos SET "urlExterna"=$1, "updatedAt"=now() WHERE id=$2`, [nuevo, r.id]);
    nAplicadas++;
    console.log(`ACTUALIZA (pub=${r.publicado}, ${origen}): "${r.titulo}"\n   → ${nuevo}`);
  }
  filasCsv.push({
    titulo: r.titulo, autor: r.autor, publicado: r.publicado,
    viejo: r.urlExterna, nuevo: nuevo || r.urlExterna, origen,
  });
}
console.log(`\n${nAplicadas} urlExterna actualizadas de ${res.rowCount}`);

// CSV entregable
const out = ["titulo,autor,publicado,url_vieja (busqueda, rota por WAF),url_nueva (ficha buscalibre),fuente_enlace"];
for (const f of filasCsv) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  out.push([q(f.titulo), q(f.autor), f.publicado, q(f.viejo), q(f.nuevo), f.origen].join(","));
}
fs.writeFileSync("/home/z/my-project/download/correccion-enlaces-buscalibre.csv", out.join("\n") + "\n");
console.log("CSV: download/correccion-enlaces-buscalibre.csv");

// verificación post-update
const post = await db.query(
  `SELECT count(*) FILTER (WHERE "urlExterna" LIKE '%/libros/search%')::int AS busqueda,
          count(*) FILTER (WHERE "urlExterna" LIKE '%/libro-%/p/%')::int AS ficha,
          count(*)::int AS total
   FROM cultura_recursos WHERE "urlExterna" ILIKE '%buscalibre%'`);
console.table(post.rows[0]);
await db.end();
