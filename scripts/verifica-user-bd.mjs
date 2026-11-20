#!/usr/bin/env node
// Verifica en la BD que la cuenta creada por /api/auth/register existe
// como fila real, y luego elimina la cuenta de prueba.
import pg from "pg";

const client = new pg.Client({ host: "127.0.0.1", port: 5433, user: "postgres", password: "postgres", database: "cumbre30" });
await client.connect();
const { rows } = await client.query(
  `SELECT email, username, LEFT("passwordHash", 12) AS hash_prefix, "createdAt"
   FROM "User" ORDER BY "createdAt" DESC LIMIT 3`,
);
console.log("Filas más recientes en User:");
for (const r of rows) console.log(" ", r.email, "|", r.username, "| hash:", r.hash_prefix + "...", "|", r.createdAt?.toISOString?.());
const del = await client.query(`DELETE FROM "User" WHERE email = $1 RETURNING email`, ["flujo.test@cumbre30.test"]);
console.log("Cuenta de prueba eliminada:", del.rowCount === 1 ? del.rows[0].email : "no encontrada");
await client.end();
