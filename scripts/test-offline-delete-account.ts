// Prueba de lógica — baja de cuenta offline (APK): requisito Google Play
// de eliminación de cuenta. Verifica que offlineDeleteAccount borre la
// cuenta, su sesión y SOLO sus viajes; que los logros y la licencia Pro
// (nivel dispositivo) sobrevivan si queda otra cuenta y se borren si era
// la última.
// Correr: npx tsx scripts/test-offline-delete-account.ts
// Requiere mock de localStorage/window (offlineAuth es browser-only).

type LS = Record<string, string>;
const backing: LS = {};
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (k in backing ? backing[k] : null),
  setItem: (k: string, v: string) => { backing[k] = String(v); },
  removeItem: (k: string) => { delete backing[k]; },
  clear: () => { for (const k of Object.keys(backing)) delete backing[k]; },
};
(globalThis as unknown as { window: unknown }).window = globalThis;

import { offlineDeleteAccount, offlineLogin, offlineLogout, offlineMe, offlineRegister } from "../src/lib/offlineAuth";
import { historyStore, saveRide, setRideOwner, type RideSummary } from "../src/lib/history";

let fails = 0;
function chk(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

function ride(id: string): RideSummary {
  return {
    id,
    dateISO: "2026-11-05T10:00:00.000Z",
    source: "gps",
    distanceKm: 8.2,
    maxKmh: 28.4,
    maxInParkKmh: 27.1,
    avgKmh: 21.3,
    elapsedSec: 1386,
    gainM: 260,
    overLimitSec: 0,
  };
}

const A = "ana.off@test.cl";
const B = "bruno.off@test.cl";

async function main() {
  // Dos cuentas, un ride por cuenta
  chk("registro A", (await offlineRegister({ email: A, username: "anaoff", password: "clave123" })) === null);
  setRideOwner(A);
  saveRide(ride("r-a-1"));
  offlineLogout();
  chk("registro B", (await offlineRegister({ email: B, username: "brunooff", password: "clave123" })) === null);
  setRideOwner(B);
  saveRide(ride("r-b-1"));
  chk("rides de ambos en el historial", historyStore.get().length === 2, `n=${historyStore.get().length}`);
  // Re-entra A (el registro de B auto-inició la sesión de B)
  offlineLogout();
  chk("re-login A para la baja", (await offlineLogin({ email: A, password: "clave123" })) === null);

  // Logros y licencia Pro a nivel dispositivo (viven fuera de las cuentas)
  backing["cumbre30-offline-achievements-v1"] = JSON.stringify([{ code: "primera-vuelta", unlockedAt: "2026-11-05T10:00:00.000Z" }]);
  backing["cumbre30-pro-v1"] = JSON.stringify({ lic: "demo" });

  // ---------- Baja de A (queda B en el dispositivo) ----------
  chk("sesión activa es A", offlineMe()?.user.email === A);
  offlineDeleteAccount();
  chk("sesión cerrada tras la baja", offlineMe() === null);
  chk("A ya no puede entrar", (await offlineLogin({ email: A, password: "clave123" })) !== null);
  chk("B sigue en el dispositivo", (await offlineLogin({ email: B, password: "clave123" })) === null);
  const ridesRestantes = historyStore.get().filter((r) => r.id === "r-b-1").length;
  chk("solo quedan los rides de B", ridesRestantes === 1 && historyStore.get().length === 1, JSON.stringify(historyStore.get().map((r) => r.id)));
  chk("logros se conservan (queda otra cuenta)", !!backing["cumbre30-offline-achievements-v1"]);
  chk("licencia Pro se conserva (queda otra cuenta)", !!backing["cumbre30-pro-v1"]);

  // ---------- Baja de B (última cuenta) ----------
  offlineDeleteAccount();
  chk("sesión cerrada tras baja de B", offlineMe() === null);
  chk("B ya no puede entrar", (await offlineLogin({ email: B, password: "clave123" })) !== null);
  chk("rides de B eliminados", historyStore.get().length === 0, `n=${historyStore.get().length}`);
  chk("logros eliminados (era la última cuenta)", backing["cumbre30-offline-achievements-v1"] === undefined);
  chk("licencia Pro eliminada (era la última cuenta)", backing["cumbre30-pro-v1"] === undefined);
  chk("sin usuarios locales restantes", (() => { const u = JSON.parse(backing["cumbre30-offline-users-v1"] ?? "{}"); return Object.keys(u).length === 0; })());

  console.log(fails ? `\n${fails} FAIL` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
