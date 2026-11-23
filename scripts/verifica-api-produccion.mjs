// Verificación END-TO-END de la API de Cultura en producción (cumbregeo.cl):
// 1. Crea un usuario de verificación DESECHABLE + sesión en Neon (pg Client
//    con la reescritura IPv4+endpoint; Prisma no conecta desde el sandbox).
// 2. Llama a /api/cultura/recursos con Bearer y reporta: total por idioma y
//    dominios de urlExterna (los números esperados dependen del estado
//    editorial del momento; ver el informe de cosecha en download/).
// 3. Borra usuario y sesión (onDelete: Cascade cubre la sesión vía FK, y
//    por si acaso se borra primero la sesión explícitamente).
// Uso: DATABASE_URL_NEON=$(cat /tmp/neonurl) node scripts/verifica-api-produccion.mjs
import { Client } from "pg";
import dns from "dns";
import { randomBytes } from "crypto";

function nuevoId() {
  const cuerpo = Date.now().toString(36) + randomBytes(8).toString("hex").replace(/[g-z]/g, (c) => parseInt(c, 36).toString(36));
  return ("c" + cuerpo).slice(0, 25);
}

function cadenaNeon(url) {
  const limpio = url.replace("&channel_binding=require", "").replace(/sslmode=[^&]+&?/, "").replace(/\?$/, "");
  const u = new URL(limpio);
  const endpoint = u.hostname.split(".")[0].replace(/-pooler$/, "");
  return { limpio, endpoint };
}

const original = process.env.DATABASE_URL_NEON;
if (!original) throw new Error("DATABASE_URL_NEON no definida");
const { limpio, endpoint } = cadenaNeon(original);
const u = new URL(limpio);
const addrs = await dns.promises.lookup(u.hostname, { all: true, family: 4 });// Neon desde el sandbox a veces expira en el primer intento: hasta 3
// intentos con cliente NUEVO cada vez (mismo patrón que scripts/sql-neon.js).
async function conectarNeon() {
  const cadenaFinal = limpio.replace(u.hostname, addrs[0].address) + `?options=endpoint%3D${endpoint}`;
  let ultimoError = null;
  for (let i = 1; i <= 3; i++) {
    const cliente = new Client({
      connectionString: cadenaFinal,
      ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined, servername: u.hostname },
      connectionTimeoutMillis: 30000,
    });
    try {
      await cliente.connect();
      return cliente;
    } catch (e) {
      ultimoError = e;
      console.error(`(reintento ${i}: ${e.message || e.code})`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw ultimoError;
}
const db = await conectarNeon();

const marca = randomBytes(4).toString("hex");
const email = `verif.cultura.${marca}@cumbre30.local`;
const username = `verif_cu_${marca}`;
const token = `tokverif-${marca}`;
let userId = null;
try {
  userId = (await db.query(
    `INSERT INTO "User" (id, email, username, "passwordHash", "createdAt")
     VALUES ($1,$2,$3,'solo-verificacion-no-login',now()) RETURNING id`,
    [nuevoId(), email, username]
  )).rows[0].id;
  await db.query(
    `INSERT INTO "Session" (id, token, "userId", "expiresAt") VALUES ($1,$2,$3, now() + interval '1 hour')`,
    [nuevoId(), token, userId]
  );

  const llamadas = ["", "?idioma=en", "?idioma=es", "?idioma=pt", "?idioma=en&q=krabbé"];
  for (const q of llamadas) {
    const r = await fetch(`https://cumbregeo.cl/api/cultura/recursos${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    const recs = d.recursos ?? [];
    const doms = {};
    for (const x of recs) {
      const dom = (x.urlExterna || "").split("/")[2];
      doms[dom] = (doms[dom] ?? 0) + 1;
    }
    const rider = recs.find((x) => x.titulo === "The Rider");
    console.log(
      `API${q || " (sin filtro)"} → HTTP ${r.status} | total: ${d.total} | dominios: ${JSON.stringify(doms)}` +
      (rider ? ` | The Rider: idioma=${rider.idioma}, url=${rider.urlExterna.slice(0, 46)}…` : "")
    );
  }
} finally {
  if (userId) {
    await db.query(`DELETE FROM "Session" WHERE "userId" = $1`, [userId]);
    await db.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    console.log("limpieza: usuario y sesión de verificación eliminados");
  }
  await db.end();
}
