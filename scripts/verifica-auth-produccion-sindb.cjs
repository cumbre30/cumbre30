// Verificación E2E de la auth unificada en producción (cumbregeo.cl),
// SIN acceso a la base: la cuenta desechable se crea por la API pública
// y se elimina al final con DELETE /api/auth/account (Bearer). Nunca
// imprime tokens. El código de 6 dígitos que el forgot envía al correo
// no es legible aquí (sandbox sin DNS a api.neon.tech ni logs de
// runtime), así que la ruta de reset se valida en CORS + errores y su
// camino de éxito quedó verificado a nivel de código (mismo patrón de
// createSession/cookie/token que login y register).
//   1. existe inexistente → {existe:false}
//   2. register con casillas y Origin de APK → 200 + token (server-first)
//   3. login → 200 + token (método contraseña)
//   4. existe → {existe:true, tieneContrasena:true}
//   5. forgot con Origin APK → ok genérico + cabecera CORS
//   6. reset con código inválido desde APK → 400 + CORS, sin token
//   7. preflights OPTIONS de forgot/reset desde el APK → CORS ok
//   8. register sin casillas → 400 (sin regresión)
//   9. rate limit del validador → 429
//  10. limpieza: DELETE account con Bearer → existe → {existe:false}

const fs = require("node:fs");
const BASE = "https://cumbregeo.cl";
const ORIGIN_APK = "capacitor://localhost";
const EMAIL = `ver.auth.${Date.now()}@cumbre30.local`;
const PASS = "clave-ver-12345";

/** POST con origen opcional (simula el webview del APK). */
const post = async (path, body, origin, extra = {}) => {
  const headers = { "Content-Type": "application/json", ...extra };
  if (origin) headers.Origin = origin;
  const r = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d, cors: r.headers.get("access-control-allow-origin") };
};

const del = async (path, token) => {
  const r = await fetch(BASE + path, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d };
};

(async () => {
  let fallos = 0;
  const check = (n, cond, extra = "") => {
    console.log(`${cond ? "✓" : "✗ FALLO"} ${n}${extra ? " · " + extra : ""}`);
    if (!cond) fallos++;
  };

  // 1. inexistente
  let r = await post("/api/auth/existe", { email: `nada.${Date.now()}@cumbre30.local` });
  check("existe: correo inexistente → existe:false", r.status === 200 && r.d.existe === false && r.d.tieneContrasena === false);

  // 2. registro server-first desde el APK (con casillas) → token inmediato
  r = await post("/api/auth/register", { email: EMAIL, username: "ver" + Math.floor(Math.random() * 1e6), password: PASS, terminos: true, edad14: true }, ORIGIN_APK);
  check("register (APK): 200 + token (la cuenta nace en el servidor)", r.status === 200 && typeof r.d.token === "string" && r.d.token.length > 10, `status ${r.status}`);
  const token = r.d.token ?? "";

  // 3. login por contraseña → 200 + token
  r = await post("/api/auth/login", { email: EMAIL, password: PASS }, ORIGIN_APK);
  check("login: 200 + token (método contraseña)", r.status === 200 && typeof r.d.token === "string", `status ${r.status}`);

  // 4. existe tras crear → cuenta con contraseña
  r = await post("/api/auth/existe", { email: EMAIL });
  check("existe: → existe:true, tieneContrasena:true", r.status === 200 && r.d.existe === true && r.d.tieneContrasena === true);

  // 5. forgot desde el APK → ok genérico + CORS
  r = await post("/api/auth/forgot", { email: EMAIL }, ORIGIN_APK);
  check("forgot (APK): ok genérico + CORS del app", r.status === 200 && r.d.ok === true && r.cors === ORIGIN_APK, `allow-origin=${r.cors}`);

  // 6. reset con código inválido desde el APK → 400 + CORS, sin token
  r = await post("/api/auth/reset", { email: EMAIL, code: "000000", newPassword: "otra-clave-98765" }, ORIGIN_APK);
  check("reset (APK, código inválido): 400 + CORS + sin token", r.status === 400 && r.cors === ORIGIN_APK && !("token" in r.d), `status ${r.status} allow-origin=${r.cors}`);

  // 7. preflights CORS
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

  // 8. registro sin casillas → 400 (sin regresión)
  r = await post("/api/auth/register", { email: `reg.${Date.now()}@cumbre30.local`, username: "verreg" + Math.floor(Math.random() * 1e6), password: PASS });
  check("register: sin casillas → 400 (Términos obligatorios al crear)", r.status === 400);

  // 9. rate limit del validador (misma IP+correo: 10/min)
  let ultimo = 0;
  for (let i = 0; i < 11; i++) ultimo = (await post("/api/auth/existe", { email: EMAIL })).status;
  check("existe: rate limit → 429 tras el límite", ultimo === 429, `último status ${ultimo}`);

  // 10. limpieza: baja de la cuenta con Bearer + verificación
  r = await del("/api/auth/account", token);
  const borrada = r.status >= 200 && r.status < 300;
  const existe = await post("/api/auth/existe", { email: EMAIL });
  check("limpieza: DELETE /api/auth/account (Bearer) → cuenta eliminada", borrada && existe.d.existe === false, `status ${r.status} · existe=${existe.d.existe}`);

  console.log(fallos === 0 ? "TODO OK ✓" : `CON ${fallos} FALLO(S) ✗`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
