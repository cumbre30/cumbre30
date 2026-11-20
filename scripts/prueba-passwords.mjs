#!/usr/bin/env node
// Prepara y limpia los datos de las pruebas in-vivo del flujo de contraseñas:
//  - crea una cuenta "Google" (passwordHash vacío) + una sesión Bearer válida
//  - opcional --limpiar: borra las cuentas de prueba creadas por los tests
import pg from "pg";

const limpiar = process.argv.includes("--limpiar");
const client = new pg.Client({ host: "127.0.0.1", port: 5433, user: "postgres", password: "postgres", database: "cumbre30" });
await client.connect();

if (limpiar) {
  const emails = ["flujopass.test@cumbre30.test", "google.sinpass@cumbre30.test"];
  const del = await client.query(`DELETE FROM "User" WHERE email = ANY($1) RETURNING email`, [emails]);
  console.log("Cuentas de prueba eliminadas:", del.rows.map((r) => r.email).join(", ") || "(ninguna)");
} else {
  // Cuenta sin contraseña (simula lo que /api/auth/google crea hoy) + sesión.
  // El id es cuid generado por Prisma (sin default SQL): se pasa explícito.
  // Idempotente: si la cuenta de prueba ya existe, se reutiliza.
  const uid = "test" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await client.query(
    `INSERT INTO "User" (id, email, username, "passwordHash") VALUES ($1, $2, $3, '')
     ON CONFLICT (email) DO NOTHING`,
    [uid, "google.sinpass@cumbre30.test", "google_sinpass"],
  );
  const u = await client.query(`SELECT id FROM "User" WHERE email = $1`, ["google.sinpass@cumbre30.test"]);
  const token = "testtoken" + Date.now().toString(36) + "a".repeat(40);
  await client.query(
    `INSERT INTO "Session" (id, token, "userId", "expiresAt") VALUES ($1, $2, $3, now() + interval '1 day')`,
    ["sess" + uid, token, u.rows[0].id],
  );
  console.log("USUARIO_CREADO google.sinpass@cumbre30.test");
  console.log("TOKEN=" + token);
}
await client.end();
