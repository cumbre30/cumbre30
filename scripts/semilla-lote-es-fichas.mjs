// ============================================================
// Semilla de la OLEADA ES por fichas verificadas (Cultura v4):
// 25 libros en español elegidos de los 63 candidatos que trajo
// el usuario (3 JSON de Buscalibre «ciclismo» con enlace_ficha).
//   · urlExterna = FICHA real de Buscalibre (nunca /libros/search)
//   · autor/año del listado de origen; OL para confirmar años
//   · reseñas propias Cumbre30 en español; categorías v4
//   · BORRADORES por defecto (publicado=false, destacado=false)
//   · --publicar: los INSERTS NUEVOS nacen publicado=true (para
//     revisión en el módulo Cultura); los re-runs (UPDATE) NUNCA
//     tocan publicado/destacado/proveedor
//   · Idempotente: match por titulo+tipo; re-run NO toca
//     publicado/destacado/proveedor
// Uso: node scripts/semilla-lote-es-fichas.mjs --neon [--publicar]
// ============================================================
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();
const PUBLICAR = process.argv.includes("--publicar"); // INSERTs nuevos nacen publicado=true
const lote = JSON.parse(fs.readFileSync(new URL("./data/lote-es-fichas-final.json", import.meta.url)));

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

function nuevoId() {
  const base36 = (n) => n.toString(36);
  const cuerpo = base36(Date.now()) + randomBytes(8).toString("hex").replace(/[g-z]/g, (c) => base36(parseInt(c, 36) % 36));
  return ("c" + cuerpo).slice(0, 25);
}

(async () => {
  const db = await conectar();
  let creados = 0, actualizados = 0;
  for (const r of lote) {
    const prev = await db.query(`SELECT id, publicado FROM cultura_recursos WHERE titulo = $1 AND tipo = $2 LIMIT 1`, [r.titulo, r.tipo]);
    if (prev.rowCount) {
      if (prev.rows[0].publicado) {
        // GUARDIA: nunca sobrescribir registros publicados (colisión «Ciclismo
        // para niños» aprendida). Los publicados se gestionan a mano.
        console.log(`⚠ SKIP (publicado en producción): ${r.titulo}`);
        continue;
      }
      await db.query(
        `UPDATE cultura_recursos SET resena=$1, idioma=$2, categorias=$3, anio=$4, autor=$5, pais=$6, extra=$7,
         "urlExterna"=$8, "portadaUrl"=$9, proveedor=$10, "updatedAt"=now() WHERE id=$11`,
        [r.resena, r.idioma, r.categorias, r.anio, r.autor, r.pais, r.extra,
         r.urlExterna, r.portada, r.proveedor, prev.rows[0].id]);
      actualizados++;
    } else {
      await db.query(
        `INSERT INTO cultura_recursos (id, titulo, resena, tipo, idioma, categorias, anio, autor, pais, extra,
          "urlExterna", "portadaUrl", proveedor, publicado, destacado, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,now(),now())`,
        [nuevoId(), r.titulo, r.resena, r.tipo, r.idioma, r.categorias, r.anio, r.autor, r.pais, r.extra,
         r.urlExterna, r.portada, r.proveedor, PUBLICAR]);
      creados++;
    }
  }
  const resumen = await db.query(`SELECT idioma, publicado, count(*)::int n FROM cultura_recursos GROUP BY 1,2 ORDER BY 1,2`);
  console.log(`creados ${creados} · actualizados ${actualizados}`);
  console.table(resumen.rows);
  // verificación del lote
  const loteIds = lote.map((x) => x.titulo);
  const chk = await db.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE publicado) ::int publicados,
            count(*) FILTER (WHERE destacado) ::int destacados,
            count(*) FILTER (WHERE "urlExterna" LIKE '%/libros/search%')::int busqueda,
            count(*) FILTER (WHERE "portadaUrl" IS NULL)::int sin_portada
     FROM cultura_recursos WHERE titulo = ANY($1) AND idioma='es'`, [loteIds]);
  console.log("verificación del lote:", chk.rows[0]);
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
