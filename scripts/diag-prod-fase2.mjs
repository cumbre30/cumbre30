// Verificación mínima de v1.13.17 contra PRODUCCIÓN (cumbregeo.cl):
//   1) sesión con la cuenta E2E (register o login)
//   2) POST /api/rides con métricas nuevas (estWattsClimb/offRoadKm/netKm)
//   3) GET /api/profile → dispara autorreparo (ALTER TABLE) y debe
//      devolver el eje explorer + extras offRoad/watts
// Cuenta de prueba del repo (la misma del E2E de fase 1).
const BASE = "https://cumbregeo.cl";
const EMAIL = "e2e-perfil@cumbre30.test";
const PASS = "test-12345678";

let cookie = "";
async function main() {
  let r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!r.ok) {
    r = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, username: "e2eperfil", password: PASS, terminos: true, edad14: true }),
    });
  }
  cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  console.log("1. sesión:", r.status, cookie ? "cookie ok" : "sin cookie");

  const ride = {
    id: "e2e-prod-fase2-1",
    dateISO: new Date().toISOString(),
    source: "gps",
    distanceKm: 12,
    maxKmh: 38.5,
    avgKmh: 22,
    elapsedSec: 1964,
    gainM: 500,
    overLimitSec: 0,
    metrics: {
      movingSec: 1800, peak15sKmh: 38.2, flatAvgKmh: 26.4, flatKm: 6,
      climbGainM: 500, climbSec: 3000, vamMh: 600, stopCount: 1,
      secOver55: 0, over55StreakSec: 0, climb6AvgKmh: null,
      estWattsClimb: 210, offRoadKm: 5, netKm: 10,
    },
  };
  const pr = await fetch(`${BASE}/api/rides`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(ride),
  });
  const pj = await pr.json();
  console.log("2. POST ride con métricas nuevas:", pr.status, pj.dedup ? "(dedup: ya existía)" : "(creado)");

  const gp = await fetch(`${BASE}/api/profile`, { headers: { Cookie: cookie } });
  const d = await gp.json();
  console.log("3. GET /api/profile:", gp.status, "| arquetipo:", d.perfil?.archetype, "| rutas:", d.perfil?.validRides);
  console.log("   explorer:", d.perfil?.scores?.explorer, "| offRoadTop3:", d.perfil?.extras?.offRoadTop3, "| estWatts:", d.perfil?.extras?.estWatts);
  const ok = gp.status === 200 && d.perfil?.scores?.explorer !== undefined && d.perfil?.extras?.estWatts === 210;
  console.log(ok ? "\nPROD OK — autorreparo y endpoints v1.13.17 funcionando" : "\nPROD FAIL");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
