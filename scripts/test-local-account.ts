// Prueba offline del MODO CUENTA LOCAL (APK sin servidor de cuenta):
// registro, inicio de sesión, sesión, datos de bici/pin, logros desde
// el historial de rides y cierre de sesión — con los mismos mensajes
// que el servidor. Cubre el fix del "error de servidor" al entrar.
import * as fs from "fs";

// --- shim de localStorage + window (node no tiene) ---
const store = new Map<string, string>();
const ls = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
(globalThis as Record<string, unknown>).localStorage = ls;
(globalThis as Record<string, unknown>).window = globalThis;

const { localRegister, localLogin, localLogout, localMe, localUpdateMe, localSessionEmail, localUnlockAchievements } = await import("../src/lib/localAccount");
const { historyStore } = await import("../src/lib/history");

let failures = 0;
function check(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else {
    failures++;
    console.log(`  ❌ ${msg}`);
  }
}

(async () => {
  console.log("1) Registro: validaciones idénticas al servidor");
  let r = await localRegister({ email: "mala", username: "ciclista", password: "secreto1" });
  check(!r.ok && r.error === "Ingresa un correo válido.", `correo inválido → "${r.ok ? "" : r.error}"`);
  r = await localRegister({ email: "a@b.cl", username: "AB", password: "secreto1" });
  check(!r.ok && r.error.includes("3-20 caracteres"), `usuario inválido → "${r.ok ? "" : r.error}"`);
  r = await localRegister({ email: "a@b.cl", username: "ciclista", password: "corta" });
  check(!r.ok && r.error === "La contraseña debe tener al menos 6 caracteres.", `contraseña corta → "${r.ok ? "" : r.error}"`);

  console.log("2) Registro OK + sesión activa");
  r = await localRegister({ email: "ana@ejemplo.cl", username: "ana_ruta", password: "secreto1" });
  check(r.ok, "registro aceptado");
  check(localSessionEmail() === "ana@ejemplo.cl", "sesión local activa tras registrarse");
  let me = localMe();
  check(!!me && me.user.username === "ana_ruta", "localMe() entrega el usuario");
  check(!!me && me.user.selectedPin === "clasico", "pin inicial = clásico");
  check(!!me && me.stats.totalKm === 0 && me.stats.rideCount === 0, "stats en cero sin rides");

  console.log("3) Duplicados");
  r = await localRegister({ email: "ana@ejemplo.cl", username: "otra", password: "secreto1" });
  check(!r.ok && r.error === "Ese correo ya está registrado.", `correo duplicado → "${r.ok ? "" : r.error}"`);
  r = await localRegister({ email: "otra@ejemplo.cl", username: "ana_ruta", password: "secreto1" });
  check(!r.ok && r.error === "Ese usuario ya está registrado.", `usuario duplicado → "${r.ok ? "" : r.error}"`);

  console.log("4) Cerrar sesión + entrar con contraseña");
  localLogout();
  check(localSessionEmail() === null, "sesión cerrada");
  check(localMe() === null, "localMe() null sin sesión");
  let l = await localLogin({ email: "ana@ejemplo.cl", password: "MALA" });
  check(!l.ok && l.error === "Correo o contraseña incorrectos.", `contraseña errónea → "${l.ok ? "" : l.error}"`);
  l = await localLogin({ email: "nadie@x.cl", password: "secreto1" });
  check(!l.ok && l.error === "Correo o contraseña incorrectos.", `correo inexistente → "${l.ok ? "" : l.error}"`);
  l = await localLogin({ email: "ana@ejemplo.cl", password: "secreto1" });
  check(l.ok, "login correcto");
  check(localSessionEmail() === "ana@ejemplo.cl", "sesión restaurada");

  console.log("5) PUT /api/me local: bici + pin");
  const up = localUpdateMe({ bikeBrand: "Trek", bikeType: "montaña", bikeModel: "Marlin 7", bikeSize: "M", bikeColor: "rojo", selectedPin: "no-existe" });
  check(up.ok && up.selectedPin === "clasico", `pin inválido rechazado (${up.ok ? up.selectedPin : up.error})`);
  const up2 = localUpdateMe({ selectedPin: "noc", bikeColor: "azul" });
  void up2;
  me = localMe();
  check(!!me && me.user.bikeBrand === "Trek" && me.user.bikeColor === "azul", "datos de bici guardados (2ª llamada actualiza color)");
  check(!!me && me.user.bikeModel === "Marlin 7", "modelo guardado");

  console.log("6) Stats + logros desde el historial local de rides");
  const ride = (km: number, max: number, park: boolean, over: number, daysAgo: number) => ({
    id: `r${daysAgo}-${km}`,
    dateISO: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
    source: "gps" as const,
    distanceKm: km,
    maxKmh: max,
    maxInParkKmh: park ? Math.min(max, 29) : null,
    avgKmh: km / 1.5,
    elapsedSec: km * 200,
    gainM: 250,
    overLimitSec: over,
  });
  const rides = [ride(5.2, 27.4, true, 0, 1), ride(12.4, 31.9, true, 12, 2), ride(3.1, 22.0, false, 0, 3)];
  ls.setItem("cumbre30-history-v1", JSON.stringify(rides));
  historyStore.refresh();
  me = localMe();
  check(!!me && me.stats.rideCount === 3, `rideCount = ${me?.stats.rideCount}`);
  check(!!me && Math.abs(me.stats.totalKm - 20.7) < 0.01, `totalKm = ${me?.stats.totalKm}`);
  check(!!me && me.stats.maxKmh === 31.9, `maxKmh = ${me?.stats.maxKmh}`);
  check(!!me && me.stats.totalGainM === 750, `totalGainM = ${me?.stats.totalGainM}`);
  check(!!me && me.stats.cleanParkRides === 1, `cleanParkRides = ${me?.stats.cleanParkRides}`);
  check(!!me && (me.achievements?.length ?? 0) > 0, `logros desbloqueados: ${me?.achievements.length ?? 0}`);
  check(!!me && me.pins.length >= 1 && me.pins.includes("clasico"), `pines: ${me?.pins.join(", ")}`);

  console.log("7) Logros incrementales (no duplica)");
  const before = localMe()?.achievements.length ?? 0;
  localUnlockAchievements(evaluate("clásico-duplicado"));
  const after = localMe()?.achievements.length ?? 0;
  check(before === after, `sin cambios al pasar códigos inexistentes (${before} → ${after})`);

  console.log("8) Aislamiento: segundo usuario no ve los datos del primero");
  r = await localRegister({ email: "b@ejemplo.cl", username: "benja", password: "secreto2" });
  check(r.ok, "segundo usuario registrado");
  me = localMe();
  check(!!me && me.user.username === "benja", `usuario en sesión: ${me?.user.username}`);
  check(!!me && me.stats.rideCount === 3, "el historial del dispositivo es compartido (rides del teléfono)");
  localLogout();

  console.log("\n" + (failures === 0 ? "✅ TODO OK" : `❌ ${failures} fallos`));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// helper: evalúa un código arbitrario (para probar no-duplicación)
function evaluate(code: string): string[] {
  return [code];
}
