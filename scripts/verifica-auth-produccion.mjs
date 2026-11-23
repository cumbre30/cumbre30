// Verificación E2E COMPLETA de la auth unificada en producción (cumbregeo.cl),
// con acceso a la base vía Data API de Neon (PostgREST autenticado con JWT de
// Neon Auth). No imprime nunca tokens, códigos ni JWTs, solo presencia/longitud.
//
//   1. existe: correo inexistente → {existe:false, tieneContrasena:false}
//   2. register (APK, con casillas): 200 + token · la cuenta NACE en el servidor
//   3. login: 200 + token (método contraseña)
//   4. existe: → {existe:true, tieneContrasena:true}
//   5. forgot (APK): ok genérico + CORS
//   6. DB: PasswordReset con código de 6 dígitos vigente y sin usar
//   7. reset (APK) con el código real: 200 + token (auto-login) + CORS
//   8. DB: reset marcada usada · passwordHash ya no está vacío
//   9. /api/me con el Bearer del reset → sesión activa
//  10. login con la nueva contraseña → 200
//  11. cuenta estilo Google (INSERT con passwordHash:"") → existe true/false
//  12. login sobre cuenta sin contraseña → 409 sinContrasena (guía)
//  13. forgot+reset sobre esa cuenta → crea contraseña y deja sesión
//  14. login con esa contraseña → 200
//  15. preflights OPTIONS forgot/reset desde el APK → CORS ok
//  16. register sin casillas → 400 (sin regresión)
//  17. existe: rate limit → 429 tras el límite
//  18. limpieza total: DELETE /api/auth/account + filas DB de ambas cuentas

import dns from "node:dns";
import net from "node:net";
import https from "node:https";
dns.setDefaultResultOrder("ipv4first"); // el sandbox no tiene salida IPv6

const BASE = "https://cumbregeo.cl";
const ORIGIN_APK = "capacitor://localhost";
const REST = "https://ep-proud-tree-b6pnoofr.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1";
const NA = "https://ep-proud-tree-b6pnoofr.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth";
const NA_EMAIL = "ver.e2e.release@disposable.cumbre30.local";
const NA_PASS = "Jwt-e2e-temporal-01";
const TS = Date.now();
const EMAIL1 = `ver.a.${TS}@cumbre30.local`; // cuenta registrada por el API
const EMAIL2 = `ver.b.${TS}@cumbre30.local`; // cuenta estilo Google insertada en DB
const PASS1 = "clave-ver-12345";
const PASS2 = "clave-ver-67890";

// El egress del sandbox bloquea algunas IPs del balanceador del Data API y
// Node (a diferencia de curl) no cae a una alcanzable: probamos cada IPv4 con
// un connect TCP corto y fijamos la primera que responde.
const REST_HOST = new URL(REST).hostname;
const alcanza = (ip) => new Promise((res) => {
  const s = net.connect({ host: ip, port: 443, timeout: 4000 });
  const fin = (ok) => { s.destroy(); res(ok); };
  s.on("connect", () => fin(true));
  s.on("error", () => fin(false));
  s.on("timeout", () => fin(false));
});
async function ipAlcanzable() {
  for (const ip of await dns.promises.resolve4(REST_HOST)) if (await alcanza(ip)) return ip;
  throw new Error("ninguna IPv4 del Data API es alcanzable desde el sandbox");
}
/** HTTPS con IP fijada y SNI correcto; devuelve {status, body}. */
function restJson(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = https.request({
      host: restIp, servername: REST_HOST, path, method,
      headers: { Host: REST_HOST, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
      timeout: 20000,
    }, (r) => {
      let buf = "";
      r.on("data", (c) => (buf += c));
      r.on("end", () => resolve({ status: r.statusCode, body: buf }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout Data API")));
    if (data) req.write(data);
    req.end();
  });
}
let jwt = "";
let restIp = "";
const REST_PATH = new URL(REST).pathname; // /neondb/rest/v1
const api = async (path, opts = {}) => {
  const { status, body } = await restJson(opts.method || "GET", REST_PATH + path, opts.body);
  let d = null;
  try { d = JSON.parse(body); } catch { d = body.slice(0, 120); }
  return { status, d };
};
const prod = async (path, { method = "POST", body, origin, token, headers = {} } = {}) => {
  const h = { "Content-Type": "application/json", ...headers };
  if (origin) h.Origin = origin;
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d, cors: r.headers.get("access-control-allow-origin") };
};

/** JWT de Neon Auth: sign-in → get-session → cabecera Set-Auth-Jwt. */
async function mintJwt() {
  const si = await fetch(`${NA}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email: NA_EMAIL, password: NA_PASS }),
  });
  if (si.status !== 200) throw new Error(`sign-in Neon Auth: HTTP ${si.status}`);
  const cookies = si.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const gs = await fetch(`${NA}/get-session`, { headers: { Origin: "http://localhost:3000", Cookie: cookies } });
  let t = gs.headers.get("set-auth-jwt") || "";
  if (t.toLowerCase().startsWith("set-auth-jwt")) t = t.slice(12); // prefijo pegado
  if (!t.includes(".")) throw new Error("JWT no recibido de get-session");
  return t;
}

(async () => {
  let fallos = 0;
  const check = (n, cond, extra = "") => {
    console.log(`${cond ? "✓" : "✗ FALLO"} ${n}${extra ? " · " + extra : ""}`);
    if (!cond) fallos++;
  };

  jwt = await mintJwt();
  restIp = await ipAlcanzable();
  console.log(`JWT Neon Auth listo (len ${jwt.length}) · Data API vía ${restIp}`);

  // 1. inexistente
  let r = await prod("/api/auth/existe", { body: { email: `nada.${TS}@cumbre30.local` } });
  check("1. existe inexistente → false/false", r.status === 200 && r.d.existe === false && r.d.tieneContrasena === false);

  // 2. registro server-first desde el APK
  r = await prod("/api/auth/register", { origin: ORIGIN_APK, body: { email: EMAIL1, username: "ver" + (TS % 1e7), password: PASS1, terminos: true, edad14: true } });
  check("2. register (APK): 200 + token", r.status === 200 && typeof r.d.token === "string" && r.d.token.length > 10, `status ${r.status}`);
  const token1 = r.d.token ?? "";
  let db = await api(`/User?email=eq.${encodeURIComponent(EMAIL1)}&select=id,email,passwordHash`);
  check("2b. DB: la cuenta nació en el servidor (server-first)", db.status === 200 && Array.isArray(db.d) && db.d.length === 1, `filas ${Array.isArray(db.d) ? db.d.length : "?"}`);

  // 3. login por contraseña
  r = await prod("/api/auth/login", { origin: ORIGIN_APK, body: { email: EMAIL1, password: PASS1 } });
  check("3. login: 200 + token", r.status === 200 && typeof r.d.token === "string", `status ${r.status}`);

  // 4. existe tras crear
  r = await prod("/api/auth/existe", { body: { email: EMAIL1 } });
  check("4. existe → true/true", r.status === 200 && r.d.existe === true && r.d.tieneContrasena === true);

  // 5. forgot desde el APK
  r = await prod("/api/auth/forgot", { origin: ORIGIN_APK, body: { email: EMAIL1 } });
  check("5. forgot (APK): ok genérico + CORS", r.status === 200 && r.d.ok === true && r.cors === ORIGIN_APK, `allow-origin=${r.cors}`);

  // 6. código real en DB
  db = await api(`/PasswordReset?email=eq.${encodeURIComponent(EMAIL1)}&used=eq.false&order=createdAt.desc&limit=1&select=code,expiresAt,attempts`);
  const pr = Array.isArray(db.d) ? db.d[0] : null;
  const vigente = pr && /^\d{6}$/.test(pr.code) && new Date(pr.expiresAt) > new Date();
  check("6. DB: PasswordReset con código de 6 dígitos vigente", !!vigente, db.status !== 200 ? `HTTP ${db.status}` : pr ? `expira ${pr.expiresAt}` : "sin fila");

  // 7. reset con el código real desde el APK → auto-login
  r = await prod("/api/auth/reset", { origin: ORIGIN_APK, body: { email: EMAIL1, code: pr.code, newPassword: PASS2 } });
  check("7. reset (APK, código real): 200 + token + CORS", r.status === 200 && r.d.ok === true && typeof r.d.token === "string" && r.cors === ORIGIN_APK, `status ${r.status}`);
  const tokenReset = r.d.token ?? "";

  // 8. DB: usada + contraseña puesta
  db = await api(`/PasswordReset?email=eq.${encodeURIComponent(EMAIL1)}&order=createdAt.desc&limit=1&select=used`);
  db.d = Array.isArray(db.d) ? db.d[0] : {};
  check("8. DB: reset usada (used:true)", db.d.used === true);
  db = await api(`/User?email=eq.${encodeURIComponent(EMAIL1)}&select=passwordHash`);
  const hash1 = Array.isArray(db.d) ? db.d[0]?.passwordHash : "";
  check("8b. DB: passwordHash ya no está vacío", typeof hash1 === "string" && hash1.includes(":"), `len ${hash1?.length ?? 0}`);

  // 9. sesión activa con el token del reset
  const me = await prod("/api/me", { method: "GET", token: tokenReset });
  check("9. /api/me con Bearer del reset → sesión activa", me.status === 200 && me.d && typeof me.d === "object", `status ${me.status}`);

  // 10. login con la nueva contraseña
  r = await prod("/api/auth/login", { origin: ORIGIN_APK, body: { email: EMAIL1, password: PASS2 } });
  check("10. login con la nueva contraseña → 200", r.status === 200 && typeof r.d.token === "string", `status ${r.status}`);

  // 11. cuenta estilo Google: INSERT con passwordHash vacío
  const ins = await api("/User", { method: "POST", body: { id: `e2e${TS}b`, email: EMAIL2, username: "verg" + (TS % 1e7), usernameChangedAt: null, passwordHash: "", selectedPin: "clasico", bikeBrand: null, bikeType: null, bikeModel: null, bikeSize: null, bikeColor: null, createdAt: new Date().toISOString(), riderWeightKg: null, bikeWeightKg: null, role: "user" } });
  check("11a. DB: INSERT cuenta sin contraseña", ins.status >= 200 && ins.status < 300, `status ${ins.status}`);
  r = await prod("/api/auth/existe", { body: { email: EMAIL2 } });
  check("11b. existe Google-style → true + sin contraseña", r.status === 200 && r.d.existe === true && r.d.tieneContrasena === false, JSON.stringify(r.d).slice(0, 80));

  // 12. login sobre cuenta sin contraseña → 409 guía
  r = await prod("/api/auth/login", { origin: ORIGIN_APK, body: { email: EMAIL2, password: PASS2 } });
  check("12. login sin contraseña → 409 sinContrasena", r.status === 409 && r.d.sinContrasena === true, `status ${r.status}`);

  // 13. forgot+reset sobre esa cuenta crea la contraseña y deja sesión
  r = await prod("/api/auth/forgot", { origin: ORIGIN_APK, body: { email: EMAIL2 } });
  db = await api(`/PasswordReset?email=eq.${encodeURIComponent(EMAIL2)}&used=eq.false&order=createdAt.desc&limit=1&select=code`);
  const pr2 = Array.isArray(db.d) ? db.d[0] : null;
  r = await prod("/api/auth/reset", { origin: ORIGIN_APK, body: { email: EMAIL2, code: pr2?.code ?? "000000", newPassword: PASS1 } });
  check("13. reset sobre cuenta Google-style: crea contraseña + token", r.status === 200 && r.d.ok === true && typeof r.d.token === "string", `status ${r.status}`);

  // 14. login con esa contraseña
  r = await prod("/api/auth/login", { origin: ORIGIN_APK, body: { email: EMAIL2, password: PASS1 } });
  check("14. login cuenta Google-style tras crear contraseña → 200", r.status === 200 && typeof r.d.token === "string", `status ${r.status}`);

  // 15. preflights CORS
  const pf = async (path) => {
    const rr = await fetch(BASE + path, { method: "OPTIONS", headers: { Origin: ORIGIN_APK, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
    return { s: rr.status, a: rr.headers.get("access-control-allow-origin") };
  };
  let p = await pf("/api/auth/forgot");
  check("15. preflight forgot (APK)", p.a === ORIGIN_APK, `status ${p.s}`);
  p = await pf("/api/auth/reset");
  check("15b. preflight reset (APK)", p.a === ORIGIN_APK, `status ${p.s}`);

  // 16. registro sin casillas → 400
  r = await prod("/api/auth/register", { body: { email: `reg.${TS}@cumbre30.local`, username: "verreg" + (TS % 1e7), password: PASS1 } });
  check("16. register sin casillas → 400", r.status === 400, `status ${r.status}`);

  // 17. rate limit del validador (misma IP+correo, 10/min)
  let ultimo = 0;
  for (let i = 0; i < 11; i++) ultimo = (await prod("/api/auth/existe", { body: { email: EMAIL2 } })).status;
  check("17. existe: rate limit → 429", ultimo === 429, `último ${ultimo}`);

  // 18. limpieza total
  r = await prod("/api/auth/account", { method: "DELETE", token: token1 });
  const baja1 = r.status >= 200 && r.status < 300;
  db = await api(`/User?email=in.(${encodeURIComponent(EMAIL1)},${encodeURIComponent(EMAIL2)})&select=email`);
  const quedan = Array.isArray(db.d) ? db.d.length : -1;
  const del1 = await api(`/PasswordReset?email=eq.${encodeURIComponent(EMAIL1)}`, { method: "DELETE" });
  const del2 = await api(`/PasswordReset?email=eq.${encodeURIComponent(EMAIL2)}`, { method: "DELETE" });
  check("18. limpieza: baja API + DELETE DB (Users sin filas, resets fuera)", baja1 && quedan === 0 && del1.status >= 200 && del1.status < 300 && del2.status >= 200 && del2.status < 300, `baja ${r.status} · Users restantes ${quedan}`);

  console.log(fallos === 0 ? "\nTODO OK ✓ (18 comprobaciones)" : `\nCON ${fallos} FALLO(S) ✗`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
