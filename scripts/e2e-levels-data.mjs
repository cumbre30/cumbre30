// Datos E2E para niveles/desafíos: crea cuenta de prueba, sube 12 rides
// GPS (8 de fin de semana, 6 limpios en parque, uno de 21.4 km, total
// 86.4 km → nivel Ciclista) y registra los logros que evalúa el sync.
// Correr: node scripts/e2e-levels-data.mjs   (desde la raíz del proyecto)
const BASE = "http://localhost:3000";
const EMAIL = "niveltest@test.cumbre30.cl";
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
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// [dateISO, km, maxKmh, maxInParkKmh|null, overSec, gainM]
// Locales (UTC-3): 19/9 y 3/10 sábado, 20/9, 27/9, 4/10 y 18/10 domingo,
// el ride 2 es sábado 21:30 local (00:30Z del domingo → noche).
const RIDES = [
  ["2026-09-19T15:00:00Z", 21.4, 44.2, 28.9, 0, 320],
  ["2026-09-20T00:30:00Z", 8.2, 33.5, 26.0, 0, 240],
  ["2026-09-26T15:30:00Z", 6.5, 35.0, 25.5, 0, 210],
  ["2026-09-27T16:00:00Z", 5.1, 36.8, null, 0, 100],
  ["2026-10-03T16:00:00Z", 7.8, 34.1, 27.0, 0, 230],
  ["2026-10-04T18:00:00Z", 4.9, 32.7, 24.0, 300, 180],
  ["2026-10-17T15:00:00Z", 10.6, 38.4, null, 0, 0],
  ["2026-10-18T17:00:00Z", 6.8, 33.0, 26.5, 0, 220],
  ["2026-10-20T15:00:00Z", 5.5, 34.9, 25.0, 0, 200],
  ["2026-10-27T15:00:00Z", 3.9, 31.2, null, 0, 0],
  ["2026-10-28T15:00:00Z", 2.6, 29.8, null, 0, 60],
  ["2026-11-03T15:00:00Z", 3.1, 30.5, 22.0, 120, 90],
];

const totalKm = RIDES.reduce((a, r) => a + r[1], 0);
const weekend = RIDES.filter(([d]) => [0, 6].includes(new Date(new Date(d).getTime() - 3 * 36e5).getUTCDay())).length;
console.log(`totalKm=${totalKm.toFixed(1)} weekend=${weekend}`);
if (Math.abs(totalKm - 86.4) > 0.01 || weekend !== 8) {
  console.error("Los datos no calzan con el plan (86.4 km / 8 finde)"); process.exit(1);
}

// 1. cuenta (idempotente: si existe, solo login)
await api("/api/auth/register", { email: EMAIL, username: "niveltest", password: PASS }).catch(async (e) => {
  if (!String(e).includes("409")) throw e;
  await api("/api/auth/login", { email: EMAIL, password: PASS });
});

// 2. rides GPS (si ya había, quedan duplicados → se limpia la cuenta al final)
for (const [dateISO, distanceKm, maxKmh, maxInParkKmh, overLimitSec, gainM] of RIDES) {
  await api("/api/rides", { dateISO, source: "gps", distanceKm, maxKmh, maxInParkKmh, avgKmh: 20, elapsedSec: 3600, gainM, overLimitSec });
}

// 3. logros: misma evaluación que hace el cliente tras guardar un ride
const { statsFromRides, evaluateAchievements } = await import("../src/lib/pins.ts");
const stats = statsFromRides(RIDES.map(([dateISO, distanceKm, maxKmh, maxInParkKmh, overLimitSec, gainM]) => ({
  distanceKm, maxKmh, maxInParkKmh, gainM, overLimitSec, dateISO,
})));
const codes = evaluateAchievements(stats, []);
console.log("stats:", JSON.stringify({ totalKm: +stats.totalKm.toFixed(1), rideCount: stats.rideCount, maxRideKm: +stats.maxRideKm.toFixed(1), weekendRides: stats.weekendRides, cleanParkRides: stats.cleanParkRides, totalGainM: stats.totalGainM, nightRides: stats.nightRides }));
for (const code of codes) await api("/api/achievements", { code });

// 4. verificación server-side
const me = await api("/api/me", null, "GET");
console.log("me.stats:", JSON.stringify(me.stats));
console.log("me.pins:", me.pins.join(","));
console.log("me.achievements:", me.achievements.map((a) => a.code).join(","));
