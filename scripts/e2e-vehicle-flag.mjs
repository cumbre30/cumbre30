// E2E de API: rides motorizados no cuentan en /api/me y el PATCH de
// corrección ("fui en bici") los reintegra. Limpia su cuenta al final.
// Correr: node scripts/e2e-vehicle-flag.mjs   (desde la raíz, con dev server)
const BASE = "http://localhost:3000";
const EMAIL = "vehicletest@test.cumbre30.cl";
const PASS = "prueba1234";

let cookie = null;

async function api(path, body, method = "POST") {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

let fails = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "FAIL"} ${label} → ${JSON.stringify(got)}${ok ? "" : ` (esperado ${JSON.stringify(want)})`}`);
}

// 1. Cuenta de prueba (idempotente)
let r = await api("/api/auth/register", { email: EMAIL, username: "vehicletest", password: PASS });
if (!r.ok) r = await api("/api/auth/login", { email: EMAIL, password: PASS });
eq("sesión creada", r.ok, true);

// 2. Ride normal en bici (10 km) + ride en auto (40 km, max 70, motorizado)
r = await api("/api/rides", {
  dateISO: "2026-11-04T15:00:00Z", source: "gps", distanceKm: 10, maxKmh: 33,
  maxInParkKmh: 26, inParkKm: 4, avgKmh: 20, elapsedSec: 2700, gainM: 250, overLimitSec: 0,
});
eq("POST bici", r.ok, true);
r = await api("/api/rides", {
  dateISO: "2026-11-04T18:00:00Z", source: "gps", distanceKm: 40, maxKmh: 70,
  maxInParkKmh: null, inParkKm: 0, avgKmh: 45, elapsedSec: 3600, gainM: 20, overLimitSec: 0,
  motorized: true, id: "e2e-client-veh-1",
});
eq("POST auto motorizado", r.ok, true);

// 3. /api/me: solo el ride en bici cuenta
let me = await api("/api/me", null, "GET");
eq("totalKm excluye el auto (10, no 50)", me.json.stats?.totalKm, 10);
eq("rideCount excluye el auto", me.json.stats?.rideCount, 1);
eq("maxKmh excluye el auto (33, no 70)", me.json.stats?.maxKmh, 33);

// 4. Corrección "fui en bici" por clientId → vuelve a contar
r = await api("/api/rides", { clientId: "e2e-client-veh-1", motorized: false }, "PATCH");
eq("PATCH corrección a bici", r.ok, true);
me = await api("/api/me", null, "GET");
eq("tras corrección totalKm = 50", me.json.stats?.totalKm, 50);
eq("tras corrección rideCount = 2", me.json.stats?.rideCount, 2);

// 5. Volver a marcar como vehículo (reversibilidad)
r = await api("/api/rides", { clientId: "e2e-client-veh-1", motorized: true }, "PATCH");
eq("PATCH reversibilidad", r.ok, true);
me = await api("/api/me", null, "GET");
eq("re-marcado: totalKm vuelve a 10", me.json.stats?.totalKm, 10);

// 6. PATCH inexistente → 404
r = await api("/api/rides", { clientId: "no-existe", motorized: false }, "PATCH");
eq("PATCH ride inexistente → 404", r.status, 404);

// 7. Limpieza: borrar la cuenta de prueba
r = await api("/api/auth/logout", {});
console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
process.exit(fails === 0 ? 0 : 1);
