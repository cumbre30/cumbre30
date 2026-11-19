// Verificación in-vivo fase 2 (v1.13.17) contra el dev server local:
//   1) Cuenta › Mi bici: tarjeta de pesos, guardar → localStorage + PUT /api/me.
//   2) Perfil: radar de 6 ejes, Exploración, KPIs watts/off-road.
//   3) Backfill: ride local sin métricas + pista embebida → al arrancar se
//      recalculan en el dispositivo, quedan en localStorage y suben (el
//      perfil pasa de 8 a 9 rutas válidas).
// Correr: node scripts/diag-fase2-perfil.mjs http://localhost:3000
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";
const EMAIL = "e2e-perfil@cumbre30.test";
const PASS = "test-12345678";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

const CONSOLE_IGNORE = [/401 \(Unauthorized\)/, /429 \(Too Many Requests\)/];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !CONSOLE_IGNORE.some((r) => r.test(m.text()))) consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });

  // 0) sesión web vía cookie (la cuenta E2E ya tiene 8 rides con métricas)
  const login = await page.evaluate(async ({ email, password }) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return r.status;
  }, { email: EMAIL, password: PASS });
  chk("0a. login en el navegador", login === 200, `status=${login}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_000);

  // --- 1) Cuenta › Mi bici: pesos ---
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.waitForTimeout(400);
  // El ítem del drawer es un button con label + hint ("Cuenta Datos y pagos").
  await page.getByRole("button", { name: /^Cuenta/ }).click();
  await page.waitForTimeout(1_500);
  const tarjetaPeso = await page.getByText("Mi bici · pesos").first().isVisible().catch(() => false);
  chk("1a. tarjeta Mi bici · pesos visible en Cuenta", tarjetaPeso);
  const introPeso = await page.getByText(/watts estimados en subidas/i).first().isVisible().catch(() => false);
  chk("1b. intro menciona watts en subidas", introPeso);
  // defaults visibles (75 / 12)
  const inR = page.locator("#peso-ciclista");
  const inB = page.locator("#peso-bici");
  chk("1c. defaults 75/12 al hidratar", (await inR.inputValue()) === "75" && (await inB.inputValue()) === "12",
    `r=${await inR.inputValue()} b=${await inB.inputValue()}`);
  await inR.fill("82");
  await inB.fill("11");
  await page.getByRole("button", { name: "Guardar pesos" }).click();
  await page.waitForTimeout(800);
  const okMsg = await page.getByText(/Pesos guardados/i).first().isVisible().catch(() => false);
  chk("1d. feedback de guardado", okMsg);
  const pesos = await page.evaluate(() => JSON.parse(localStorage.getItem("cumbre30-ride-weights-v1") ?? "null"));
  chk("1e. localStorage con pesos (82/11)", pesos?.riderKg === 82 && pesos?.bikeKg === 11, JSON.stringify(pesos));
  const me = await page.evaluate(async () => (await (await fetch("/api/me")).json()));
  chk("1f. respaldo en cuenta (PUT /api/me)", me?.user?.riderWeightKg === 82 && me?.user?.bikeWeightKg === 11,
    JSON.stringify(me?.user));

  // --- 2) Perfil: 6 ejes ---
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await page.waitForTimeout(2_500);
  const ejesTxt = await page.getByText("Los 6 ejes · 0–100").first().isVisible().catch(() => false);
  chk("2a. título Los 6 ejes", ejesTxt);
  const exploracion = await page.getByText("Exploración", { exact: true }).first().isVisible().catch(() => false);
  chk("2b. eje Exploración en la lista", exploracion);
  const wattsKpi = await page.getByText(/Watts estimados en subida/i).first().isVisible().catch(() => false);
  chk("2c. KPI watts en subida", wattsKpi);
  const offKpi = await page.getByText(/Km off-road \(top-3/i).first().isVisible().catch(() => false);
  chk("2d. KPI km off-road", offKpi);
  // puntos SOLO del radar (la página tiene otros SVG con círculos: iconos)
  const dots = await page.locator('section[aria-label="Los 6 ejes · 0–100"] svg circle').count();
  chk("2e. radar con 6 puntos (uno por eje)", dots === 6, `dots=${dots}`);
  const arch = await page.getByText("Trepador", { exact: true }).first().isVisible().catch(() => false);
  chk("2f. arquetipo Trepador (cuenta E2E con 8 rides de montaña)", arch);

  // --- 3) Backfill: ride sin métricas + pista embebida ---
  await page.evaluate((email) => {
    const KEY = "cumbre30-history-v1";
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // pista sintética: 10 s llano 25 km/h (34.7 m) → 150 s subida 6%
    // (16.7 m / +1 m) → 50 s llano; ~1.7 km, +90 m
    const pts = [];
    let t = Math.floor(Date.now() / 1000) - 250;
    let lon = -70.56;
    const MLON = 111320 * Math.cos((-33.41 * Math.PI) / 180);
    let alt = 800;
    for (let i = 0; i < 21; i++) { pts.push([-33.41, lon, alt, t]); lon += 34.7 / MLON; t += 5; }
    for (let i = 0; i < 31; i++) { pts.push([-33.41, lon, alt, t]); lon += 16.7 / MLON; alt += 1; t += 5; }
    for (let i = 0; i < 11; i++) { pts.push([-33.41, lon, alt, t]); lon += 34.7 / MLON; t += 5; }
    list.unshift({
      id: "e2e-backfill-1",
      dateISO: new Date().toISOString(),
      source: "gps",
      distanceKm: 1.7,
      maxKmh: 26,
      maxInParkKmh: null,
      avgKmh: 20,
      elapsedSec: 310,
      gainM: 90,
      overLimitSec: 0,
      account: email,
      track: pts,
    });
    localStorage.setItem(KEY, JSON.stringify(list));
  }, EMAIL);
  await page.reload({ waitUntil: "domcontentloaded" });
  console.log("  esperando 20 s (backfill arranca a los 12 s)…");
  await page.waitForTimeout(20_000);
  const ride = await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem("cumbre30-history-v1") ?? "[]");
    return list.find((r) => r.id === "e2e-backfill-1");
  });
  chk("3a. ride recalculado en el dispositivo (metrics presentes)", !!ride?.metrics?.movingSec, JSON.stringify(ride?.metrics ?? null));
  chk("3b. watts estimados en el backfill (>4%, 150 s subiendo)", (ride?.metrics?.estWattsClimb ?? 0) > 150, `${ride?.metrics?.estWattsClimb} W`);
  chk("3c. metricsTried marcado (no reintentará)", ride?.metricsTried === true, `${ride?.metricsTried}`);
  const perfil = await page.evaluate(async () => (await (await fetch("/api/profile")).json()));
  chk("3d. el ride subió: perfil pasa a 9 rutas válidas", perfil?.perfil?.validRides === 9, `validRides=${perfil?.perfil?.validRides}`);
  const feed = (perfil?.perfil?.rides ?? []).find((r) => Math.abs(r.distanceKm - 1.7) < 0.01);
  chk("3e. ride del backfill en el feed del perfil (con peso w)", !!feed && feed?.w !== null, JSON.stringify(feed ?? null));

  chk("sin errores de consola", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(fails ? `\n${fails} FAIL` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
