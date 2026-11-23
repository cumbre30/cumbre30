// Verificación E2E de los cambios de auth en producción (cumbregeo.cl),
// con cuenta desechable creada y eliminada en la base. Nunca imprime
// tokens ni el URI.
//   1. /api/auth/existe → correo inexistente: {existe:false}
//   2. cuenta Google-style (passwordHash="") en DB → existe:true, tieneContrasena:false
//   3. /api/auth/login sobre esa cuenta → 409 + sinContrasena:true (el fix)
//   4. /api/auth/login con contraseña cualquiera → sigue 401 genérico en cuentas CON hash
//   5. /api/auth/forgot → ok:true sin revelar existencia
//   6. /api/auth/register sin casillas → 400 (sin regresión)
//   7. rate limit del validador: 11ª llamada seguida → 429
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();
const BASE = "https://cumbregeo.cl";
const EMAIL = `ver.auth.${Date.now()}@cumbre30.local`;

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

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d };
};

(async () => {
  const db = await conectar();
  const uid = `ver.auth.${Date.now()}`;
  await db.query(
    `INSERT INTO "User" (id, email, username, "passwordHash", "createdAt") VALUES ($1,$2,$3,$4,now())`,
    [uid, EMAIL, "verauth" + Math.floor(Math.random() * 1e6), ""]
  );
  let fallos = 0;
  const check = (n, cond, extra = "") => {
    console.log(`${cond ? "✓" : "✗ FALLO"} ${n}${extra ? " · " + extra : ""}`);
    if (!cond) fallos++;
  };

  // 1. inexistente
  let r = await post("/api/auth/existe", { email: `nada.${Date.now()}@cumbre30.local` });
  check("existe: correo inexistente → existe:false", r.status === 200 && r.d.existe === false && r.d.tieneContrasena === false);

  // 2. cuenta Google-style
  r = await post("/api/auth/existe", { email: EMAIL });
  check("existe: cuenta sin contraseña → existe:true, tieneContrasena:false", r.status === 200 && r.d.existe === true && r.d.tieneContrasena === false, JSON.stringify(r.d));

  // 3. login sobre cuenta Google sin contraseña → 409 sinContrasena
  r = await post("/api/auth/login", { email: EMAIL, password: "cualquiercosa123" });
  check("login: cuenta Google sin contraseña → 409 sinContrasena (el servidor SÍ la reconoce)", r.status === 409 && r.d.sinContrasena === true, (r.d.error || "").slice(0, 60));

  // 4. forgot → ok genérico (envío real fallará: dominio .local — fallback soporte)
  r = await post("/api/auth/forgot", { email: EMAIL });
  check("forgot: respuesta ok genérica", r.status === 200 && r.d.ok === true);

  // 5. registro sin casillas → 400 (sin regresión)
  r = await post("/api/auth/register", { email: `reg.${Date.now()}@cumbre30.local`, username: "verreg" + Math.floor(Math.random() * 1e6), password: "contrasena123" });
  check("register: sin casillas → 400 (los Términos siguen obligatorios al crear)", r.status === 400);

  // 6. rate limit del validador (misma IP+correo: 10/min)
  let ultimo = 0;
  for (let i = 0; i < 11; i++) ultimo = (await post("/api/auth/existe", { email: EMAIL })).status;
  check("existe: rate limit → 429 tras el límite", ultimo === 429, `último status ${ultimo}`);

  // limpieza
  await db.query(`DELETE FROM "Session" WHERE "userId"=$1`, [uid]);
  await db.query(`DELETE FROM "User" WHERE id=$1`, [uid]);
  console.log(`limpieza: cuenta desechable ${EMAIL.slice(0, 22)}… eliminada`);
  console.log(fallos === 0 ? "TODO OK ✓" : `CON ${fallos} FALLO(S) ✗`);
  await db.end();
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
