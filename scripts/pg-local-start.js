// ============================================================
// Postgres local para el preview de Cumbre30 (sin sudo).
// - PGDATA persistente: db/pgdata (ignorado por git)
// - Puerto 5433, usuario postgres, base "cumbre30" (auth de confianza local)
// - Idempotente: si ya está corriendo, solo asegura la base de datos.
// Uso: node scripts/pg-local-start.js
// ============================================================
const fs = require("fs");
const net = require("net");
const path = require("path");

const ROOT = "/home/z/my-project";
const DATA_DIR = path.join(ROOT, "db", "pgdata");
const LOG = path.join(ROOT, "db", "pg.log");
const PORT = 5433;
const DB = "cumbre30";

function probe(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port, timeout: 1500 });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => resolve(false));
    s.once("timeout", () => { s.destroy(); resolve(false); });
  });
}

async function main() {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const running = await probe(PORT);
  const EmbeddedPostgres = require("embedded-postgres").default;
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    autoRehydrateSymlinks: true,
    onError: (msgOrErr) => fs.appendFileSync(LOG, `[pg] ${String(msgOrErr)}\n`),
  });

  if (!running) {
    if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
      console.log("initdb (primera vez)...");
      await pg.initialise();
    }
    console.log("iniciando postgres en 127.0.0.1:" + PORT + " ...");
    await pg.start();
    // esperar a que el puerto responda
    for (let i = 0; i < 40; i++) {
      if (await probe(PORT)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  } else {
    console.log("postgres ya está corriendo en el puerto " + PORT);
  }

  // Asegurar la base de datos (idempotente)
  try {
    await pg.createDatabase(DB);
    console.log(`base "${DB}" creada`);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/already exists|42P04|3D000/i.test(msg)) console.log(`base "${DB}" ya existe`);
    else throw e;
  }
  const ok = await probe(PORT);
  console.log(ok ? `OK: postgres escuchando en 127.0.0.1:${PORT}` : "ERROR: el puerto no responde");
  if (!ok) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e?.message ?? e);
  process.exit(1);
});
