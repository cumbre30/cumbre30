/**
 * Cuenta demo ficticia para revisar el preview (v1.14.0).
 * Crea demo@cumbre30.test con 14 rides GPS de los últimos 50 días:
 * racha de 3 días (hoy/ayer/anteayer), ride nocturno, ride de fin de
 * semana, subidas con VAM/watts, tramos off-road y reto semanal con
 * progreso parcial. Total ~127 km → nivel «Ciclista» al 77%.
 * Ejecutar: node scripts/demo-user.mjs [base]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = "demo@cumbre30.test";
const PASS = "cumbre2026";
const USER = "ciclista_demo";

// [díasAtrás, km, gainM, avgKmh, maxKmh, offRoadKm|null, vamMh|null, watts|null, horaLocalSantiago]
const RIDES = [
  [0, 11.2, 380, 22.8, 38.2, null, null, null, "17:40"],
  [1, 7.6, 140, 20.1, 34.5, null, null, null, "08:15"],
  [2, 12.8, 350, 23.4, 40.1, 5.5, null, null, "18:05"],
  [6, 8.9, 580, 17.2, 35.0, null, 640, 218, "16:30"],
  [9, 6.1, 80, 24.6, 41.0, null, null, null, "07:20"],
  [13, 9.7, 310, 21.0, 37.5, 3.8, null, null, "17:50"],
  [16, 10.4, 470, 19.4, 36.8, null, 615, 205, "01:05"],
  [20, 8.3, 230, 22.8, 39.4, null, null, null, "08:40"],
  [24, 6.8, 160, 20.5, 35.9, null, null, null, "19:10"],
  [28, 11.5, 430, 21.7, 38.7, null, 600, 198, "17:25"],
  [33, 5.6, 55, 25.3, 42.3, null, null, null, "10:05"],
  [38, 9.9, 280, 21.9, 37.2, 3.2, null, null, "18:35"],
  [44, 8.1, 220, 19.8, 34.8, null, null, null, "07:50"],
  [50, 10.6, 390, 20.7, 36.1, null, 585, 190, "16:55"],
];

const OFFSET = "-03:00"; // Chile continental en noviembre (hora de verano)
const pad = (n) => String(n).padStart(2, "0");

/** dateISO de un ride hace N días calendario de Santiago, a la hora local hhmm. */
function santiagoISO(daysAgo, hhmm) {
  const hoyStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [y, m, d] = hoyStr.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d - daysAgo));
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(
    `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}T${pad(hh)}:${pad(mm)}:00${OFFSET}`,
  );
  // El ride de "hoy" nunca queda a futuro (si se corre el script temprano).
  if (daysAgo === 0 && dt.getTime() > Date.now()) return new Date(Date.now() - 45 * 60e3).toISOString();
  return dt.toISOString();
}

function rideOf([days, km, gain, avg, max, offroad, vam, watts, horaLocal], i) {
  const d = new Date(santiagoISO(days, horaLocal));
  return {
    id: `demo-${i}`,
    dateISO: d.toISOString(),
    source: "gps",
    distanceKm: km,
    maxKmh: max,
    avgKmh: avg,
    elapsedSec: Math.round((km / avg) * 3600),
    gainM: gain,
    overLimitSec: 0,
    metrics: {
      movingSec: Math.round((km / avg) * 3600) - 120,
      peak15sKmh: Math.round((max - 0.6) * 10) / 10,
      flatAvgKmh: Math.min(avg + 4.5, max - 3),
      flatKm: Math.round(km * 0.45 * 10) / 10,
      climbGainM: gain,
      climbSec: Math.round(gain / (vam ? vam / 3600 : 320)) * (vam ? 1 : 1) || Math.round(gain * 6),
      vamMh: vam ?? null,
      stopCount: days === 0 ? 2 : 1,
      secOver55: 0,
      over55StreakSec: 0,
      climb6AvgKmh: vam ? Math.round((avg - 3.5) * 10) / 10 : null,
      estWattsClimb: watts ?? null,
      offRoadKm: offroad ?? null,
      netKm: offroad ? Math.round((km - 0.5) * 10) / 10 : null,
    },
  };
}

async function main() {
  // 1. register (o login si ya existe)
  let r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: USER, password: PASS, terminos: true, edad14: true }),
  });
  if (!r.ok) {
    r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
  }
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  if (!r.ok || cookie.length < 10) {
    console.error("✗ no se pudo crear la sesión:", r.status, await r.text());
    process.exit(1);
  }
  console.log(`✓ sesión creada para ${EMAIL}`);

  // 2. subir los rides (POST idempotente por clientId)
  let ok = 0;
  for (const [i, spec] of RIDES.entries()) {
    const pr = await fetch(`${BASE}/api/rides`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(rideOf(spec, i)),
    });
    if (pr.ok) ok++;
    else console.error(`  ✗ ride ${i}:`, pr.status, (await pr.text()).slice(0, 120));
  }
  console.log(`✓ rides guardados: ${ok}/${RIDES.length}`);

  // 2b. logros que el teléfono habría evaluado y registrado con estos
  // rides (el cliente evalúa los criterios y los registra por POST a
  // /api/achievements). Con 127,5 km / +4075 m / 14 rides / 42,3 km/h:
  const LOGROS = [
    "km_10", "km_50", "km_100",
    "gain_300", "gain_1500", "gain_4000",
    "const_1", "const_10",
    "night_1", "speed_42", "dawn_1",
  ];
  let okA = 0;
  for (const code of LOGROS) {
    const ar = await fetch(`${BASE}/api/achievements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ code }),
    });
    if (ar.ok) okA++;
    else console.error(`  ✗ logro ${code}:`, ar.status);
  }
  console.log(`✓ logros registrados: ${okA}/${LOGROS.length}`);

  // 3. resumen de lo que verá el revisor
  const me = await (await fetch(`${BASE}/api/me`, { headers: { Cookie: cookie } })).json();
  const s = me?.stats ?? {};
  console.log("\n=== RESUMEN DE LA CUENTA DEMO ===");
  console.log(`usuario: @${me?.user?.username}  ·  email: ${me?.user?.email}`);
  console.log(`km totales: ${(s.totalKm ?? 0).toFixed(1)}  ·  rides: ${s.rideCount}  ·  vel máx: ${s.maxKmh} km/h  ·  desnivel: +${s.totalGainM} m`);
  console.log(`nocturnos: ${s.nightRides ?? 0}  ·  fin de semana: ${s.weekendRides ?? 0}  ·  logros: ${me?.achievements?.length ?? 0}`);

  const perfil = await (await fetch(`${BASE}/api/profile`, { headers: { Cookie: cookie } })).json();
  const p = perfil?.perfil;
  if (p) {
    console.log(`\nperfil: ${p.archetype} (${p.calibrating ? "calibrando" : "calibrado"}) · ${p.validRides} rides válidos`);
    console.log("ejes:", Object.entries(p.scores).map(([k, v]) => `${k}=${Math.round(v ?? 0)}`).join("  "));
  }
  console.log(`\n=== CREDENCIAL PARA EL PREVIEW ===\n  correo:    ${EMAIL}\n  contraseña: ${PASS}\n  usuario:   @${USER}`);
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
