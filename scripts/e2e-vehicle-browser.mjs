// E2E navegador — detección de vehículo motorizado:
//   mock de GPS a 95 km/h → sospecha del motor → diálogo "¿fuiste en bici?"
//   → "No" deja el badge vehículo; "Sí" corrige (local + PATCH al servidor).
// Correr con el server arriba: node scripts/e2e-vehicle-browser.mjs
// (ver comando lote en el commit / README del script).
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const EMAIL = "vehicletest@test.cumbre30.cl";
const PASS = "prueba1234";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

// GPS falso: fixes cada 500 ms avanzando a 95 km/h (26.4 m/s).
// Cada watchPosition lleva SU PROPIO cursor (el ambiente y el del ride
// corren en paralelo; un cursor compartido duplicaría la distancia).
const GPS_MOCK = `
(() => {
  const LAT0 = -33.4100, LON0 = -70.6300;
  const def = {
    watchPosition: (cb) => {
      let lat = LAT0;
      return setInterval(() => {
        lat += 0.0001584; // ~13.2 m por tick a 500 ms → 95 km/h
        cb({ coords: { latitude: lat, longitude: LON0, speed: 26.4, accuracy: 5, altitude: 800, heading: 0 }, timestamp: Date.now() });
      }, 500);
    },
    clearWatch: (id) => clearInterval(id), // como el GPS real: detiene el watch
    getCurrentPosition: (cb) => cb({ coords: { latitude: LAT0, longitude: LON0, speed: 0, accuracy: 20, altitude: 800, heading: 0 }, timestamp: Date.now() }),
  };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: def });
})();
`;

async function main() {
  // Cuenta de prueba limpia (desde la raíz: Prisma no resuelve desde /tmp)
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: "vehicletest", password: PASS }),
  });
  const regBody = await reg.json().catch(() => ({}));
  chk("cuenta de prueba creada", reg.ok && regBody.username === "vehicletest", JSON.stringify(regBody).slice(0, 120));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await context.addInitScript(GPS_MOCK);
  const page = await context.newPage();
  const consoleErrors = [];
  const CONSOLE_IGNORE = [/401 \(Unauthorized\)/]; // probe pre-login de /api/me: benigno
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !CONSOLE_IGNORE.some((re) => re.test(m.text()))) consoleErrors.push(m.text().slice(0, 160));
  });

  page.setDefaultTimeout(45_000);

  // 1. App cargada, dispositivo fresco y login same-origin
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
  await page.evaluate(() => localStorage.clear());
  const login = await page.evaluate(async ({ email, pass }) => {
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    return r.ok;
  }, { email: EMAIL, pass: PASS });
  chk("login same-origin", login);
  await page.reload({ waitUntil: "domcontentloaded" });
  // La app pide /api/me al montar: es la señal de que React ya hidrató.
  await page.waitForResponse((r) => r.url().includes("/api/me"), { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Perfil/ }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Perfil/ }).first().click();
  const userPill = await page.getByText("vehicletest").first().isVisible().catch(() => false);
  chk("sesión activa en la UI (perfil vehicletest)", userPill);

  // 2. Fuente GPS real
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Configuración/ }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Configuración/ }).first().click();
  await page.getByRole("radio", { name: "GPS real" }).waitFor({ timeout: 30_000 });
  await page.getByRole("radio", { name: "GPS real" }).click();
  const gpsOn = await page.getByRole("radio", { name: "GPS real" }).getAttribute("aria-checked");
  chk("fuente GPS real seleccionada", gpsOn === "true");

  // 3. Ride 1: 14 s a 95 km/h → diálogo
  await page.getByRole("button", { name: "Ride", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar ride" }).click();
  await page.waitForTimeout(14_000);
  await page.getByRole("button", { name: "Finalizar y guardar ride" }).click();
  const dlg = await page.getByText("¿Este viaje fue en bicicleta?").isVisible().catch(() => false);
  chk("diálogo '¿Este viaje fue en bicicleta?' apareció", dlg);
  await page.screenshot({ path: "/tmp/e2e-veh-dialogo.png" });

  // 4. "No, fui en vehículo" → flag queda en el ride guardado
  await page.getByRole("button", { name: "No, fui en vehículo" }).click();
  await page.waitForTimeout(2_000);
  const flag1 = await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("cumbre30-history-v1") || "[]");
    return { n: l.length, motorized: l[0]?.motorized, km: l[0]?.distanceKm };
  });
  chk("ride 1 guardado con flag vehículo", flag1.n >= 1 && flag1.motorized === true, JSON.stringify(flag1));

  // 5. Ride 2: "Sí, fui en bici" → corrección local + PATCH servidor
  await page.getByRole("button", { name: "Iniciar ride" }).click();
  await page.waitForTimeout(14_000);
  await page.getByRole("button", { name: "Finalizar y guardar ride" }).click();
  await page.getByText("¿Este viaje fue en bicicleta?").waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("button", { name: "Sí, fui en bici" }).click();
  await page.waitForTimeout(3_000);
  const flag2 = await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("cumbre30-history-v1") || "[]");
    return { n: l.length, motorized0: l[0]?.motorized, motorized1: l[1]?.motorized };
  });
  chk("ride 2 corregido a bici (sin flag)", flag2.n >= 2 && flag2.motorized0 === undefined, JSON.stringify(flag2));

  // 6. Mis viajes: badge vehículo + nota
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Mis viajes/ }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Mis viajes/ }).first().click();
  await page.waitForTimeout(2_000);
  const hist = await page.evaluate(() => document.body.innerText);
  chk("badge 'vehículo' en historial", /vehículo/i.test(hist), hist.slice(0, 200));
  chk("nota 'no cuenta para desafíos ni estadísticas' en historial", /no cuenta para desafíos ni estadísticas/.test(hist));
  await page.screenshot({ path: "/tmp/e2e-veh-historial.png" });

  // 7. Estadísticas: nota actualizada
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Estadísticas generales/ }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Estadísticas generales/ }).first().click();
  await page.waitForTimeout(2_000);
  const stats = await page.evaluate(() => document.body.innerText);
  chk("nota de Estadísticas actualizada", /los demo y los viajes en vehículo no/.test(stats));
  // El ride confirmado en bici sí cuenta; el vehículo no: distancia ≈ solo ride 2 (~0.37 km)
  const distMatch = stats.match(/([\d.]+)\s*\n?km/s);
  chk("Estadísticas excluye el ride vehículo (dist < 1 km)", !!distMatch && parseFloat(distMatch[1]) < 1, stats.slice(0, 300));

  // 8. Servidor: el ride corregido cuenta, el vehículo no
  const ridesSrv = await page.evaluate(async () => (await fetch("/api/rides")).json());
  console.log("servidor /api/rides:", JSON.stringify(ridesSrv.rides?.map((r) => ({ km: r.distanceKm, max: r.maxKmh, mot: r.motorized, cid: r.clientId?.slice(0, 8) }))));
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem("cumbre30-history-v1") || "[]").map((r) => ({ km: r.distanceKm, max: r.maxKmh, mot: !!r.motorized })));
  console.log("local:", JSON.stringify(local));
  const me = await page.evaluate(async () => (await fetch("/api/me")).json());
  chk("server: solo el ride 2 cuenta (totalKm < 1)", me.stats && me.stats.totalKm < 1 && me.stats.totalKm > 0, JSON.stringify(me.stats).slice(0, 200));
  chk("server: rideCount = 1", me.stats && me.stats.rideCount === 1, JSON.stringify(me.stats?.rideCount));

  // 9. Sin errores de consola
  chk("sin errores de consola/pageerror", consoleErrors.length === 0, consoleErrors.join(" | ").slice(0, 400));

  // 10. Limpieza
  await page.evaluate(() => localStorage.clear());
  await browser.close();
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  console.log("cuenta de prueba eliminada");

  console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error("E2E abortado:", e.message); process.exit(1); });
