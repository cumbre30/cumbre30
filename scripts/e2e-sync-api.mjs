// E2E API — sync de progreso con token Bearer (el flujo que usa el APK).
//   1) Registro desde origen APK → token en el cuerpo.
//   2) /api/auth/token con credenciales → token; con mala clave → 401.
//   3) Preflight CORS (OPTIONS) con cabeceras correctas.
//   4) Rides: POST con Bearer, idempotencia por clientId (dedup),
//      GET con Bearer; sin sesión → 401.
//   5) Logros: POST + visibles en /api/me; stats calculadas con el ride.
//   6) PATCH motorized por clientId.
//   7) /api/auth/google con idToken inválido → 401.
// Correr con el server arriba: node scripts/e2e-sync-api.mjs
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const STAMP = Date.now().toString(36).slice(-6);
const EMAIL = `qa.sync.${STAMP}@test.cl`;
const USER = `qasync${STAMP}`;
const PASS = "secreto123";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}
const APK = { Origin: "https://localhost" };
const json = (extra = {}) => ({ ...APK, "Content-Type": "application/json", ...extra });

async function main() {
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}

  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: json(),
    body: JSON.stringify({ email: EMAIL, username: USER, password: PASS }),
  });
  const rd = await reg.json().catch(() => ({}));
  chk("registro (origen APK) 200", reg.ok, JSON.stringify(rd).slice(0, 140));
  chk("registro devuelve token para APK", typeof rd.token === "string" && rd.token.length > 20);

  const tok = await fetch(`${BASE}/api/auth/token`, {
    method: "POST", headers: json(),
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const td = await tok.json().catch(() => ({}));
  chk("/api/auth/token 200", tok.ok, JSON.stringify(td).slice(0, 140));
  chk("token opaco presente", typeof td.token === "string" && td.token.length >= 32);
  const TOKEN = td.token ?? "";

  const bad = await fetch(`${BASE}/api/auth/token`, {
    method: "POST", headers: json(),
    body: JSON.stringify({ email: EMAIL, password: "clave-erronea" }),
  });
  chk("token con clave mala → 401", bad.status === 401, `→ ${bad.status}`);

  const pre = await fetch(`${BASE}/api/rides`, { method: "OPTIONS", headers: APK });
  chk("preflight OPTIONS 204", pre.status === 204, `→ ${pre.status}`);
  chk("CORS Allow-Origin correcto", pre.headers.get("access-control-allow-origin") === "https://localhost");
  chk("CORS permite Authorization", (pre.headers.get("access-control-allow-headers") ?? "").includes("Authorization"));

  const noAuth = await fetch(`${BASE}/api/rides`, { headers: APK });
  chk("rides sin sesión → 401", noAuth.status === 401, `→ ${noAuth.status}`);

  const ride = {
    id: "qa-ride-1", dateISO: new Date().toISOString(), source: "gps",
    distanceKm: 12.5, maxKmh: 31.2, maxInParkKmh: 24.1, inParkKm: 9.1,
    avgKmh: 18.3, elapsedSec: 2460, gainM: 140, overLimitSec: 0, motorized: false,
  };
  const r1 = await fetch(`${BASE}/api/rides`, {
    method: "POST", headers: json({ Authorization: `Bearer ${TOKEN}` }),
    body: JSON.stringify(ride),
  });
  chk("POST ride con Bearer 200", r1.ok, (await r1.clone().text()).slice(0, 140));

  const r2 = await fetch(`${BASE}/api/rides`, {
    method: "POST", headers: json({ Authorization: `Bearer ${TOKEN}` }),
    body: JSON.stringify(ride),
  });
  const r2d = await r2.json().catch(() => ({}));
  chk("POST ride reintentado → dedup (no duplica km)", r2.ok && r2d.dedup === true, JSON.stringify(r2d).slice(0, 120));

  const g = await fetch(`${BASE}/api/rides`, { headers: { ...APK, Authorization: `Bearer ${TOKEN}` } });
  const gd = await g.json().catch(() => ({}));
  chk("GET rides con Bearer 200", g.ok);
  chk("exactamente 1 ride", gd.rides?.length === 1, `→ ${gd.rides?.length}`);
  chk("clientId preservado", gd.rides?.[0]?.clientId === "qa-ride-1");

  const a1 = await fetch(`${BASE}/api/achievements`, {
    method: "POST", headers: json({ Authorization: `Bearer ${TOKEN}` }),
    body: JSON.stringify({ code: "km_10" }),
  });
  chk("POST achievement con Bearer 200", a1.ok, (await a1.clone().text()).slice(0, 120));

  const m = await fetch(`${BASE}/api/me`, { headers: { ...APK, Authorization: `Bearer ${TOKEN}` } });
  const md = await m.json().catch(() => ({}));
  chk("GET me con Bearer 200", m.ok);
  chk("stats usan el ride (totalKm≈12.5)", Math.abs((md.stats?.totalKm ?? -1) - 12.5) < 0.2, `→ ${md.stats?.totalKm}`);
  chk("logro km_10 visible", (md.achievements ?? []).some((a) => a.code === "km_10"));

  const p = await fetch(`${BASE}/api/rides`, {
    method: "PATCH", headers: json({ Authorization: `Bearer ${TOKEN}` }),
    body: JSON.stringify({ clientId: "qa-ride-1", motorized: false }),
  });
  chk("PATCH motorized por clientId 200", p.ok);

  const gg = await fetch(`${BASE}/api/auth/google`, {
    method: "POST", headers: json(),
    body: JSON.stringify({ idToken: "no-es-un-token" }),
  });
  chk("google con idToken inválido → 401", gg.status === 401, `→ ${gg.status}`);

  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  console.log(fails ? `\n${fails} FALLOS` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR e2e:", e);
  process.exit(1);
});
