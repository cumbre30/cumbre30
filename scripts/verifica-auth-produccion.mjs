// Verificación E2E de la auth unificada en producción (cumbregeo.cl),
// con cuenta desechable creada y eliminada en la base. Nunca imprime
// tokens ni el URI de conexión.
//   1. /api/auth/existe → correo inexistente: {existe:false}
//   2. cuenta Google-style (passwordHash="") en DB → existe:true, tieneContrasena:false
//   3. /api/auth/login sobre esa cuenta → 409 + sinContrasena:true
//   4. /api/auth/forgot → ok genérico (dominio .local: el correo no
//      sale, pero el código queda en DB y sirve para probar el reset)
//   5. /api/auth/reset con Origin capacitor://localhost (APK) → 200,
//      token en el cuerpo (auto-login APK) + cabeceras CORS
//   6. login con la contraseña NUEVA → 200 + token (cuenta Google ya
//      puede entrar también por contraseña: cualquier método)
//   7. existe → tieneContrasena:true
//   8. register sin casillas → 400 (sin regresión)
//   9. register con casillas y Origin de APK → 200 + token (registro
//      server-first: la cuenta nace en el servidor aunque se cree en el APK)
//  10. preflight OPTIONS de forgot/reset desde el APK → CORS ok
//  11. rate limit del validador → 429
import { Client } from "pg";
import dns from "node:dns/promises";
import fs from "node:fs";

const URI = fs.readFileSync("/home/z/my-project/.env.neon.uri", "utf8").trim();
const BASE = "https://cumbregeo.cl";
const EMAIL = `ver.auth.${Date.now()}@cumbre30.local`;
const ORIGIN_APK = "capacitor://localhost";

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

/** POST con origen opcional (para simular el webview del APK). */
const post = async (path, body, origin) => {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  const r = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d, cors: r.headers.get("access-control-allow-origin") };
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

  // 2. cuenta Google-style (sin contraseña)
  r = await post("/api/auth/existe", { email: EMAIL });
  check("existe: cuenta sin contraseña → existe:true, tieneContrasena:false", r.status === 200 && r.d.existe === true && r.d.tieneContrasena === false, JSON.stringify(r.d));

  // 3. login sobre cuenta Google sin contraseña → 409 sinContrasena
  r = await post("/api/auth/login", { email: EMAIL, password: "cualquiercosa123" });
  check("login: cuenta Google sin contraseña → 409 sinContrasena", r.status === 409 && r.d.sinContrasena === true, (r.d.error || "").slice(0, 50));

  // 4. forgot → ok genérico (el código queda en DB aunque el correo no salga)
  r = await post("/api/auth/forgot", { email: EMAIL });
  check("forgot: respuesta ok genérica", r.status === 200 && r.d.ok === true);
  const codigo = (await db.query(`SELECT code FROM "PasswordReset" WHERE email=$1 AND used=false ORDER BY "createdAt" DESC LIMIT 1`, [EMAIL])).rows[0]?.code;
  check("forgot: código de 6 dígitos en DB", /^\d{6}$/.test(codigo ?? ""));

  // 5. reset desde el webview del APK → auto-login con token + CORS
  r = await post("/api/auth/reset", { email: EMAIL, code: codigo, newPassword: "clave-nueva-123" }, ORIGIN_APK);
  check("reset (APK): 200 + ok", r.status === 200 && r.d.ok === true, `status ${r.status}`);
  check("reset (APK): token en el cuerpo (sesión iniciada, unificación)", typeof r.d.token === "string" && r.d.token.length > 10);
  check("reset (APK): cabecera CORS para el origen del app", r.cors === ORIGIN_APK, `allow-origin=${r.cors}`);

  // 6. login con la contraseña nueva → 200 + token (método contraseña habilitado)
  r = await post("/api/auth/login", { email: EMAIL, password: "clave-nueva-123" }, ORIGIN_APK);
  check("login: contraseña nueva → 200 + token (la cuenta Google ahora entra por contraseña)", r.status === 200 && typeof r.d.token === "string", `status ${r.status}`);

  // 7. existe → tieneContrasena:true
  r = await post("/api/auth/existe", { email: EMAIL });
  check("existe: tras crear contraseña → tieneContrasena:true", r.status === 200 && r.d.tieneContrasena === true);

  // 8. registro sin casillas → 400 (sin regresión)
  r = await post("/api/auth/register", { email: `reg.${Date.now()}@cumbre30.local`, username: "verreg" + Math.floor(Math.random() * 1e6), password: "contrasena123" });
  check("register: sin casillas → 400 (Términos obligatorios al crear)", r.status === 400);

  // 9. registro server-first desde el APK (con casillas) → token inmediato
  const emailReg = `regapk.${Date.now()}@cumbre30.local`;
  r = await post("/api/auth/register", { email: emailReg, username: "verapk" + Math.floor(Math.random() * 1e6), password: "contrasena123", terminos: true, edad14: true }, ORIGIN_APK);
  check("register (APK): 200 + token (la cuenta nace en el servidor)", r.status === 200 && typeof r.d.token === "string", `status ${r.status}`);
  const regUid = (await db.query(`SELECT id FROM "User" WHERE email=$1`, [emailReg])).rows[0]?.id;

  // 10. preflight CORS de forgot/reset desde el APK
  const pf = async (path) => {
    const rr = await fetch(BASE + path, {
      method: "OPTIONS",
      headers: { Origin: ORIGIN_APK, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    });
    return { s: rr.status, a: rr.headers.get("access-control-allow-origin") };
  };
  let p = await pf("/api/auth/forgot");
  check("preflight forgot (APK): CORS ok", p.a === ORIGIN_APK, `status ${p.s}`);
  p = await pf("/api/auth/reset");
  check("preflight reset (APK): CORS ok", p.a === ORIGIN_APK, `status ${p.s}`);

  // 11. rate limit del validador (misma IP+correo: 10/min)
  let ultimo = 0;
  for (let i = 0; i < 11; i++) ultimo = (await post("/api/auth/existe", { email: EMAIL })).status;
  check("existe: rate limit → 429 tras el límite", ultimo === 429, `último status ${ultimo}`);

  // limpieza
  await db.query(`DELETE FROM "PasswordReset" WHERE email=$1`, [EMAIL]);
  await db.query(`DELETE FROM "Session" WHERE "userId"=ANY($1::text[])`, [[uid, regUid]]);
  await db.query(`DELETE FROM "User" WHERE id IN ($1,$2)`, [uid, regUid]);
  console.log(`limpieza: cuentas desechables eliminadas (${EMAIL.slice(0, 18)}…, ${emailReg.slice(0, 18)}…)`);
  console.log(fallos === 0 ? "TODO OK ✓" : `CON ${fallos} FALLO(S) ✗`);
  await db.end();
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
