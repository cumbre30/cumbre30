// Sincroniza los BORRADORES de los lotes ES/PT de Cultura Ciclista desde la
// base local (127.0.0.1:5433/cumbre30) hacia la base de PRODUCCIÓN (Neon).
// Motivo: el sandbox no deja conectar Prisma Client a Neon (DNS/*.neon.tech),
// pero pg Client con la reescritura IPv4+endpoint de scripts/sql-neon.js sí
// funciona. La lógica replica EXACTAMENTE la de las semillas:
//   · match por titulo+tipo; si existe → UPDATE sin tocar publicado,
//     destacado ni proveedor; si no → INSERT con publicado=false,
//     destacado=false (borradores que el equipo publica por oleadas).
// Uso: DATABASE_URL_NEON=$(cat /tmp/neonurl) node scripts/sincroniza-borradores-neon.mjs
import { Client } from "pg";
import dns from "dns";
import { randomBytes } from "crypto";

// La columna id no tiene DEFAULT en la base (Prisma genera cuid() en el
// cliente), así que el INSERT por pg debe aportarla: id estilo cuid2 v2
// ('c' + base36 de tiempo + aleatorio, ~25 caracteres).
function nuevoId() {
  const base36 = (n) => n.toString(36);
  const cuerpo = base36(Date.now()) + randomBytes(8).toString("hex").replace(/[g-z]/g, (c) => base36(parseInt(c, 36) % 36));
  return ("c" + cuerpo).slice(0, 25);
}


const LOCAL = "postgresql://postgres@127.0.0.1:5433/cumbre30";

function reescritaNeon(url) {
  const limpio = url.replace("&channel_binding=require", "").replace(/sslmode=[^&]+&?/, "").replace(/\?$/, "");
  const u = new URL(limpio);
  const endpoint = u.hostname.split(".")[0].replace(/-pooler$/, "");
  return {
    cadena: limpio.replace(u.hostname, "__IP__") + `?options=endpoint%3D${endpoint}`,
    hostname: u.hostname,
    endpoint,
  };
}

const neonOriginal = process.env.DATABASE_URL_NEON;
if (!neonOriginal) throw new Error("DATABASE_URL_NEON no definida");
const { cadena, hostname } = reescritaNeon(neonOriginal);
const addrs = await dns.promises.lookup(hostname, { all: true, family: 4 });
const neon = new Client({
  connectionString: cadena.replace("__IP__", addrs[0].address),
  ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined, servername: hostname },
  connectionTimeoutMillis: 30000,
});
await neon.connect();
console.log("[sync] Neon conectado por IPv4");

const local = new Client({ connectionString: LOCAL });
await local.connect();

const { rows: borradores } = await local.query(
  `SELECT "titulo","tipo","idioma","categorias","anio","autor","pais","extra","urlExterna","resena"
   FROM cultura_recursos WHERE "publicado" = false AND "idioma" IN ('es','pt') ORDER BY "idioma","titulo"`
);
console.log(`[sync] borradores es/pt en local: ${borradores.length} (esperados 14)`);
if (borradores.length !== 14) throw new Error(`Se esperaban 14 borradores, hay ${borradores.length} — abortar`);

let creados = 0, actualizados = 0;
for (const r of borradores) {
  const previo = await neon.query(`SELECT id FROM cultura_recursos WHERE "titulo" = $1 AND "tipo" = $2`, [r.titulo, r.tipo]);
  if (previo.rows.length) {
    await neon.query(
      `UPDATE cultura_recursos SET "titulo"=$1,"tipo"=$2,"idioma"=$3,"categorias"=$4,"anio"=$5,"autor"=$6,
       "pais"=$7,"extra"=$8,"urlExterna"=$9,"resena"=$10 WHERE id=$11`,
      [r.titulo, r.tipo, r.idioma, r.categorias, r.anio, r.autor, r.pais, r.extra, r.urlExterna, r.resena, previo.rows[0].id]
    );
    actualizados++;
  } else {
    await neon.query(
      `INSERT INTO cultura_recursos (id,"titulo","tipo","idioma","categorias","anio","autor","pais","extra",
       "urlExterna","resena","proveedor","publicado","destacado","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'editorial',false,false,now())`,
      [nuevoId(), r.titulo, r.tipo, r.idioma, r.categorias, r.anio, r.autor, r.pais, r.extra, r.urlExterna, r.resena]
    );
    creados++;
  }
}
console.log(`[sync] ${creados} creados, ${actualizados} actualizados`);

// Verificación final en Neon: borradores por idioma y dominios de los 14.
const { rows: conteo } = await neon.query(
  `SELECT "idioma", count(*)::int n FROM cultura_recursos WHERE "publicado" = false GROUP BY 1 ORDER BY 1`
);
const { rows: dominios } = await neon.query(
  `SELECT split_part(split_part("urlExterna",'/',3),'?',1) dom, count(*)::int n
   FROM cultura_recursos WHERE "publicado" = false GROUP BY 1 ORDER BY 2 DESC`
);
console.log("[sync] borradores en Neon:", JSON.stringify(conteo), "| dominios:", JSON.stringify(dominios));

await local.end();
await neon.end();
