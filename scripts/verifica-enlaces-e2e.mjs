#!/usr/bin/env node
// Verificación E2E: sesión desechable → API pública ?idioma=es → enlaces reales entregados.
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();

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

const base36 = (n) => n.toString(36);
const nuevoId = () => ("c" + base36(Date.now()) + randomBytes(8).toString("hex")).slice(0, 25);

const db = await conectar();
let userId = null;
try {
  const email = `verif-${Date.now()}@solo-verificacion.cumbre30`;
  const token = randomBytes(24).toString("hex");
  userId = (await db.query(
    `INSERT INTO "User" (id, email, username, "passwordHash", "createdAt")
     VALUES ($1,$2,$3,'solo-verificacion-no-login',now()) RETURNING id`,
    [nuevoId(), email, "verif-" + base36(Date.now())]
  )).rows[0].id;
  await db.query(
    `INSERT INTO "Session" (id, token, "userId", "expiresAt") VALUES ($1,$2,$3, now() + interval '1 hour')`,
    [nuevoId(), token, userId]);

  for (const q of ["?idioma=es", "?idioma=en"]) {
    const r = await fetch(`https://cumbregeo.cl/api/cultura/recursos${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    console.log(`\nAPI ${q} → HTTP ${r.status} · total ${d.total}`);
    for (const x of (d.recursos ?? []).slice(0, 14)) {
      console.log(`  · ${x.titulo} [${x.idioma}] → ${x.urlExterna}`);
    }
  }
} finally {
  if (userId) {
    await db.query(`DELETE FROM "Session" WHERE "userId" = $1`, [userId]);
    await db.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    console.log("\nlimpieza: usuario y sesión de verificación eliminados");
  }
  await db.end();
}
