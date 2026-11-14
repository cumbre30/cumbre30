// E2E API — amigos (el flujo que usa AmigosTab en web y APK).
//   1) Dos cuentas de prueba con token Bearer (flujo APK).
//   2) Preflight CORS (OPTIONS) con cabeceras correctas.
//   3) Sin sesión → 401 (GET, POST y DELETE).
//   4) A agrega a B → conexión mutua e inmediata (A ve a B y B ve a A).
//   5) Estadísticas reales: ride de B aparece en la lista de A (12.5 km).
//   6) Errores controlados: ya amigos 409, auto-agrego 400, inexistente 404.
//   7) Sesión web por cookie (flujo de la web): GET 200 y DELETE.
//   8) Eliminar → ambas listas quedan vacías.
// Correr contra producción: BASE=https://cumbregeo.cl node scripts/e2e-friends-api.mjs
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const STAMP = Date.now().toString(36).slice(-6);
const EMAIL_A = `qa.fr.a.${STAMP}@test.cl`;
const EMAIL_B = `qa.fr.b.${STAMP}@test.cl`;
const USER_A = `qafra${STAMP}`;
const USER_B = `qafrb${STAMP}`;
const PASS = "secreto123";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}
const APK = { Origin: "https://localhost" };
const json = (extra = {}) => ({ ...APK, "Content-Type": "application/json", ...extra });

async function register(email, username) {
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: json(),
    body: JSON.stringify({ email, username, password: PASS }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`registro ${username} falló: ${JSON.stringify(d).slice(0, 160)}`);
  // Sesión web: la cookie de la respuesta (flujo de la web desplegada)
  const setCookie = r.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  const t = await fetch(`${BASE}/api/auth/token`, {
    method: "POST", headers: json(),
    body: JSON.stringify({ email, password: PASS }),
  });
  const td = await t.json().catch(() => ({}));
  if (!t.ok || !td.token) throw new Error(`token ${username} falló: ${JSON.stringify(td).slice(0, 160)}`);
  return { cookie, token: td.token };
}

async function main() {
  for (const e of [EMAIL_A, EMAIL_B]) {
    try { execSync(`node scripts/cleanup-test-user.mjs ${e}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  }

  const a = await register(EMAIL_A, USER_A);
  const b = await register(EMAIL_B, USER_B);
  chk("dos cuentas con token Bearer", !!a.token && !!b.token);

  // --- preflight CORS (el APK hace fetch cross-origin) ---
  const pre = await fetch(`${BASE}/api/friends`, { method: "OPTIONS", headers: APK });
  chk("preflight OPTIONS 2xx", pre.status >= 200 && pre.status < 300, `→ ${pre.status}`);
  chk("preflight expone Access-Control-Allow-Origin", !!(pre.headers.get("access-control-allow-origin") || pre.headers.get("access-control-allow-headers")), String(pre.headers.get("access-control-allow-origin")));

  // --- sin sesión: 401 en los tres verbos ---
  const g0 = await fetch(`${BASE}/api/friends`, { headers: APK });
  chk("GET sin sesión → 401", g0.status === 401, `→ ${g0.status}`);
  const p0 = await fetch(`${BASE}/api/friends`, { method: "POST", headers: json(), body: JSON.stringify({ username: USER_B }) });
  chk("POST sin sesión → 401", p0.status === 401, `→ ${p0.status}`);
  const d0 = await fetch(`${BASE}/api/friends?username=${USER_B}`, { method: "DELETE", headers: APK });
  chk("DELETE sin sesión → 401", d0.status === 401, `→ ${d0.status}`);

  // --- conexión mutua ---
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const add = await fetch(`${BASE}/api/friends`, {
    method: "POST", headers: json(auth(a.token)), body: JSON.stringify({ username: USER_B }),
  });
  const addd = await add.json().catch(() => ({}));
  chk("A agrega a B → ok", add.ok, JSON.stringify(addd).slice(0, 140));

  const la = await fetch(`${BASE}/api/friends`, { headers: { ...APK, ...auth(a.token) } });
  const lad = await la.json().catch(() => ({}));
  chk("lista de A incluye a B", la.ok && (lad.friends ?? []).some((f) => f.username === USER_B), JSON.stringify(lad).slice(0, 160));
  const rowB = (lad.friends ?? []).find((f) => f.username === USER_B) ?? {};
  chk("fila de B trae stats completas", typeof rowB.totalKm === "number" && typeof rowB.rideCount === "number" && typeof rowB.achievementCount === "number", JSON.stringify(rowB).slice(0, 160));

  const lb = await fetch(`${BASE}/api/friends`, { headers: { ...APK, ...auth(b.token) } });
  const lbd = await lb.json().catch(() => ({}));
  chk("lista de B incluye a A (mutua e inmediata)", lb.ok && (lbd.friends ?? []).some((f) => f.username === USER_A), JSON.stringify(lbd).slice(0, 160));

  // --- stats con un ride real de B ---
  const ride = {
    id: `qa-ride-fr-${STAMP}`, dateISO: new Date().toISOString(), source: "gps",
    distanceKm: 12.5, maxKmh: 31.2, maxInParkKmh: 24.1, inParkKm: 9.1,
    avgKmh: 18.3, elapsedSec: 2460, gainM: 140, overLimitSec: 0, motorized: false,
  };
  const pr = await fetch(`${BASE}/api/rides`, {
    method: "POST", headers: json(auth(b.token)), body: JSON.stringify(ride),
  });
  chk("ride de B subido (Bearer)", pr.ok, (await pr.clone().text()).slice(0, 140));
  const la2 = await fetch(`${BASE}/api/friends`, { headers: { ...APK, ...auth(a.token) } });
  const la2d = await la2.json().catch(() => ({}));
  const rowB2 = (la2d.friends ?? []).find((f) => f.username === USER_B) ?? {};
  chk("km de B llegan a A (12.5)", rowB2.totalKm === 12.5, `totalKm=${rowB2.totalKm}`);
  chk("último ride de B visible para A", !!rowB2.lastRideDate, String(rowB2.lastRideDate));

  // --- errores controlados ---
  const dup = await fetch(`${BASE}/api/friends`, {
    method: "POST", headers: json(auth(a.token)), body: JSON.stringify({ username: USER_B }),
  });
  chk("agregar de nuevo → 409", dup.status === 409, `→ ${dup.status}`);
  const self = await fetch(`${BASE}/api/friends`, {
    method: "POST", headers: json(auth(a.token)), body: JSON.stringify({ username: USER_A }),
  });
  chk("agregarse a sí mismo → 400", self.status === 400, `→ ${self.status}`);
  const ghost = await fetch(`${BASE}/api/friends`, {
    method: "POST", headers: json(auth(a.token)), body: JSON.stringify({ username: "no_existe_x9z" }),
  });
  chk("usuario inexistente → 404", ghost.status === 404, `→ ${ghost.status}`);
  const empty = await fetch(`${BASE}/api/friends`, {
    method: "POST", headers: json(auth(a.token)), body: JSON.stringify({ username: "" }),
  });
  chk("usuario vacío → 400", empty.status === 400, `→ ${empty.status}`);

  // --- flujo web (cookie de sesión, sin Bearer) ---
  const gw = await fetch(`${BASE}/api/friends`, { headers: { ...APK, Cookie: a.cookie } });
  const gwd = await gw.json().catch(() => ({}));
  chk("GET con cookie de sesión (web) 200", gw.ok && (gwd.friends ?? []).length === 1, `→ ${gw.status} ${JSON.stringify(gwd).slice(0, 120)}`);
  const dw = await fetch(`${BASE}/api/friends?username=${USER_B}`, { method: "DELETE", headers: { ...APK, Cookie: a.cookie } });
  chk("DELETE con cookie (web) ok", dw.ok, `→ ${dw.status}`);
  const gw2 = await fetch(`${BASE}/api/friends`, { headers: { ...APK, Cookie: a.cookie } });
  const gw2d = await gw2.json().catch(() => ({}));
  chk("tras DELETE, lista de A vacía", gw2.ok && (gw2d.friends ?? []).length === 0, JSON.stringify(gw2d).slice(0, 120));
  const lb2 = await fetch(`${BASE}/api/friends`, { headers: { ...APK, ...auth(b.token) } });
  const lb2d = await lb2.json().catch(() => ({}));
  chk("DELETE es bidireccional (lista de B vacía)", lb2.ok && (lb2d.friends ?? []).length === 0, JSON.stringify(lb2d).slice(0, 120));

  // --- limpieza ---
  for (const e of [EMAIL_A, EMAIL_B]) {
    try { execSync(`node scripts/cleanup-test-user.mjs ${e}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  }

  console.log(`\n${fails === 0 ? "✅ TODO OK" : `❌ ${fails} fallos`} (${BASE})`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
