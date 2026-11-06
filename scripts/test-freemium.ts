// Prueba de lógica — palancas freemium v1.8.0:
//   · applyFreeCap: historial últimos 20 en FREE (convergencia amable),
//     ilimitado con Pro.
//   · saveRide respeta el cap sin Pro y no recorta con Pro activo
//     (código C30P válido generado con el mismo HMAC).
//   · statsMonthly: buckets mensuales, mejor mes y delta vs mes anterior.
// Correr: npx tsx scripts/test-freemium.ts
// Requiere mock de localStorage/window (history/proLicense son browser-only).

type LS = Record<string, string>;
const backing: LS = {};
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (k in backing ? backing[k] : null),
  setItem: (k: string, v: string) => { backing[k] = String(v); },
  removeItem: (k: string) => { delete backing[k]; },
  clear: () => { for (const k of Object.keys(backing)) delete backing[k]; },
};
(globalThis as unknown as { window: unknown }).window = globalThis;

import { applyFreeCap, FREE_RIDE_LIMIT, historyStore, saveRide, type RideSummary } from "../src/lib/history";
import { generateProLicenseCode } from "../src/lib/proLicenseCore";
import { bestMonth, deltaVsPrev, monthlyBuckets } from "../src/lib/statsMonthly";

let fails = 0;
function chk(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

function ride(id: string, dateISO = "2026-11-05T10:00:00.000Z", km = 8.2): RideSummary {
  return {
    id,
    dateISO,
    source: "gps",
    distanceKm: km,
    maxKmh: 28.4,
    maxInParkKmh: 27.1,
    avgKmh: 21.3,
    elapsedSec: 1386,
    gainM: 260,
    overLimitSec: 0,
  };
}

function list(n: number): RideSummary[] {
  // La lista vive "más nuevo primero", como en el store real.
  return Array.from({ length: n }, (_, i) => ride(`r${i}`));
}

const PRO_KEY = "cumbre30-pro-v1";
const HIST_KEY = "cumbre30-history-v1";
const PRO_EMAIL = "pro.cap@test.cl";

async function main() {
  // ---------- applyFreeCap (función pura) ----------
  chk("FREE_RIDE_LIMIT = 20", FREE_RIDE_LIMIT === 20, `= ${FREE_RIDE_LIMIT}`);
  chk("gratis: 15 viajes no se tocan", applyFreeCap(list(15), false).length === 15);
  chk("gratis: 20 viajes en el borde no se tocan", applyFreeCap(list(20), false).length === 20);
  const trimmed = applyFreeCap(list(21), false);
  chk("gratis: 21 viajes descarta solo el más antiguo", trimmed.length === 20 && trimmed[0].id === "r0" && trimmed[19].id === "r19", `len=${trimmed.length} last=${trimmed[19]?.id}`);
  chk("Pro: 40 viajes sin recorte", applyFreeCap(list(40), true).length === 40);
  chk("legacy 50: converge de a uno (50 → 49)", applyFreeCap(list(50), false).length === 49);

  // ---------- saveRide sin Pro: converge al tope ----------
  backing[HIST_KEY] = "";
  for (let i = 0; i < 22; i++) saveRide(ride(`free-${i}`));
  chk("saveRide sin Pro: 22 guardados → quedan 20", historyStore.get().length === 20, `n=${historyStore.get().length}`);
  chk("saveRide sin Pro: conserva los más nuevos", historyStore.get()[0].id === "free-21" && historyStore.get()[19].id === "free-2");

  // ---------- saveRide con Pro (código válido): ilimitado ----------
  delete backing[HIST_KEY];
  const code = await generateProLicenseCode(PRO_EMAIL);
  backing[PRO_KEY] = JSON.stringify({ email: PRO_EMAIL, code, at: Date.now() });
  for (let i = 0; i < 25; i++) saveRide(ride(`pro-${i}`));
  chk("saveRide con Pro: 25 guardados → quedan 25", historyStore.get().length === 25, `n=${historyStore.get().length}`);

  // ---------- statsMonthly ----------
  const now = new Date(2026, 10, 15); // 15 nov 2026, local
  const rides: RideSummary[] = [
    ride("m1", "2026-11-03T10:00:00.000Z", 10),
    ride("m2", "2026-11-09T10:00:00.000Z", 5),
    { ...ride("motor", "2026-11-11T10:00:00.000Z", 99), motorized: true }, // no cuenta
    ride("o1", "2026-10-20T10:00:00.000Z", 8),
    ride("old", "2026-01-10T10:00:00.000Z", 42), // fuera de la ventana de 6 meses
  ];
  const buckets = monthlyBuckets(rides, 6, now);
  chk("monthlyBuckets: 6 meses", buckets.length === 6);
  chk("monthlyBuckets: ventana jun→nov 2026", buckets[0].ym === "2026-06" && buckets[5].ym === "2026-11", `${buckets[0].ym}..${buckets[5].ym}`);
  chk("monthlyBuckets: noviembre suma km y excluye motorizado", buckets[5].km === 15 && buckets[5].rides === 2, `km=${buckets[5].km} rides=${buckets[5].rides}`);
  chk("monthlyBuckets: octubre 8 km", buckets[4].km === 8);
  chk("monthlyBuckets: meses sin rides en 0", buckets[0].km === 0 && buckets[0].rides === 0);
  const best = bestMonth(buckets);
  chk("bestMonth: noviembre (15 km)", best?.ym === "2026-11" && best.km === 15);
  const delta = deltaVsPrev(buckets);
  chk("deltaVsPrev: +7,0 km", delta === "+7,0 km", `= ${delta}`);

  console.log(fails ? `\n${fails} FAIL` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
