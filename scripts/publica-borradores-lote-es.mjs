// Publica los 29 borradores del lote ES aprobados por el usuario
// («avanza con los borradores (29) están ok»). Alcance EXACTO:
//   · SOLO títulos del lote (scripts/data/lote-es-fichas-final.json)
//   · SOLO los que siguen publicado=false (los 4 del delta 3 ya están)
//   · NO toca los 10 borradores es de oleadas anteriores (sin aprobación)
//   · destacado/proveedor/contenido: intactos
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();
const lote = JSON.parse(fs.readFileSync(new URL("./data/lote-es-fichas-final.json", import.meta.url)));
const titulos = lote.map((r) => r.titulo);

(async () => {
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

  const antes = await c.query(
    `SELECT count(*)::int total, count(*) FILTER (WHERE publicado)::int pub FROM cultura_recursos WHERE titulo = ANY($1) AND idioma='es'`,
    [titulos]);
  console.log(`lote en Neon: ${antes.rows[0].total} registros · ya publicados: ${antes.rows[0].pub}`);

  const r = await c.query(
    `UPDATE cultura_recursos SET publicado=true, "updatedAt"=now()
     WHERE titulo = ANY($1) AND idioma='es' AND publicado=false RETURNING titulo`,
    [titulos]);
  console.log(`publicados ahora: ${r.rowCount}`);
  for (const row of r.rows) console.log(`  ✓ ${row.titulo.slice(0, 64)}`);

  const resumen = await c.query(`SELECT idioma, publicado, count(*)::int n FROM cultura_recursos GROUP BY 1,2 ORDER BY 1,2`);
  console.table(resumen.rows);
  const chk = await c.query(
    `SELECT count(*)::int lote_total,
            count(*) FILTER (WHERE publicado)::int lote_publicados,
            count(*) FILTER (WHERE destacado)::int destacados,
            count(*) FILTER (WHERE "urlExterna" LIKE '%/libros/search%')::int busqueda,
            count(*) FILTER (WHERE "portadaUrl" IS NULL)::int sin_portada
     FROM cultura_recursos WHERE titulo = ANY($1) AND idioma='es'`, [titulos]);
  console.log("verificación del lote:", chk.rows[0]);
  const fuera = await c.query(
    `SELECT titulo FROM cultura_recursos WHERE idioma='es' AND publicado=false AND titulo <> ANY($1)`, [titulos]);
  console.log(`borradores es FUERA del lote (sin aprobar, quedan ocultos): ${fuera.rowCount}`);
  for (const row of fuera.rows) console.log(`  · ${row.titulo.slice(0, 64)}`);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
