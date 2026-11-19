/**
 * Test E2E de la API del Perfil Ciclista: register → POST /api/rides
 * (con métricas) → GET /api/profile. Corre contra el dev server local.
 * Ejecutar: DATABASE_URL=... bun run scripts/test-api-perfil.ts [base]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = "e2e-perfil@cumbre30.test";
const PASS = "test-12345678";

let fallos = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`);
  if (!ok) fallos++;
};

// sesión vía cookie (la web usa cookies; el APK Bearer)
let cookie = "";

async function main() {
  // 1. register (o login si ya existe)
  let r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: "e2eperfil", password: PASS, terminos: true, edad14: true }),
  });
  if (r.status === 409 || r.status === 400) {
    r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
  }
  const setCookie = r.headers.get("set-cookie");
  cookie = (setCookie ?? "").split(";")[0];
  check("1. sesión creada", r.ok && cookie.length > 10, `status=${r.status}`);

  // 2. POST /api/rides con métricas derivadas
  const rides = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
    id: `e2e-perfil-${i}`,
    dateISO: new Date(Date.now() - (i + 1) * 86400e3).toISOString(),
    source: "gps",
    distanceKm: 12,
    maxKmh: 38.5,
    avgKmh: 22,
    elapsedSec: 1964,
    gainM: 500,
    overLimitSec: 0,
    metrics: {
      movingSec: 1800,
      peak15sKmh: 38.2,
      flatAvgKmh: 26.4,
      flatKm: 6,
      climbGainM: 500,
      climbSec: 3000,
      vamMh: 600,
      stopCount: 1,
      secOver55: 0,
      over55StreakSec: 0,
      climb6AvgKmh: null,
    },
  }));
  let okPost = 0;
  let dedup = 0;
  for (const ride of rides) {
    const pr = await fetch(`${BASE}/api/rides`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(ride),
    });
    if (pr.ok) {
      okPost++;
      const j = (await pr.json()) as { dedup?: boolean };
      if (j.dedup) dedup++;
    }
  }
  // reintento del primero: debe dedup
  const pr2 = await fetch(`${BASE}/api/rides`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(rides[0]),
  });
  const j2 = (await pr2.json()) as { dedup?: boolean };
  check("2a. 8 rides guardados", okPost === 8, `ok=${okPost}`);
  check("2b. reintento idempotente", j2.dedup === true, `dedup=${j2.dedup}`);

  // 3. GET /api/profile
  const gp = await fetch(`${BASE}/api/profile`, { headers: { Cookie: cookie } });
  const data = (await gp.json()) as {
    perfil?: { archetype: string; calibrating: boolean; scores: Record<string, number | null>; validRides: number; extras: Record<string, unknown>; rides: Array<{ excl: string | null }> };
    minRides?: number;
  };
  check("3a. GET /api/profile 200", gp.ok, `status=${gp.status}`);
  check("3b. calibrado con 8 rides", data.perfil?.validRides === 8, `validRides=${data.perfil?.validRides}`);
  check("3c. arquetipo CLIMBER (12 km +500 m × 8)", data.perfil?.archetype === "CLIMBER", data.perfil?.archetype);
  check("3d. climbing > endurance + 15", (data.perfil?.scores.climbing ?? 0) - (data.perfil?.scores.endurance ?? 0) >= 15, `c=${data.perfil?.scores.climbing?.toFixed(1)} e=${data.perfil?.scores.endurance?.toFixed(1)}`);
  check("3e. feed con 8 rides", data.perfil?.rides.length === 8, `${data.perfil?.rides.length}`);
  check("3f. minRides=5 expuesto", data.minRides === 5, `${data.minRides}`);

  // 4. sin sesión → 401
  const anon = await fetch(`${BASE}/api/profile`);
  check("4. sin sesión 401", anon.status === 401, `status=${anon.status}`);

  console.log(fallos === 0 ? "\nTODO OK" : `\nFALLOS: ${fallos}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
