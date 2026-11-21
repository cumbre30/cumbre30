// Ejecuta una sentencia SQL contra el PG local.
// Uso: node scripts/db-exec.js "SELECT ..." [base]  (base por omisión: postgres)
const { Client } = require("pg");
(async () => {
  const c = new Client({ host: "127.0.0.1", port: 5433, user: "postgres", database: process.argv[3] || "postgres" });
  await c.connect();
  try {
    const r = await c.query(process.argv[2]);
    console.log(r.command || "OK");
    if (r.rows && r.rows.length) console.log(JSON.stringify(r.rows, null, 1));
  } finally {
    await c.end();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
