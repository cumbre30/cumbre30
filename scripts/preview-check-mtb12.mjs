// Verificación E2E de las rutas MTB corregidas (cliente 2026-11-13):
// levanta el dev server dentro de la llamada, abre Explorar, revisa el
// panel Rutas (distancias nuevas) y dibuja MTB 1 + MTB 2 en el mapa.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer(maxS = 90) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxS * 1000) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return res.status;
    } catch { /* aún no */ }
    await wait(1500);
  }
  return 0;
}

async function main() {
  const dev = spawn("npm", ["run", "dev"], { cwd: "/home/z/my-project", stdio: "ignore", detached: true });
  dev.unref();
  console.log("[dev] lanzado");
  const status = await waitServer();
  console.log("[dev] HTTP", status);
  if (!status) process.exit(1);

  mkdirSync("/tmp/render", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // 1. ir a Explorar (mapa general)
  const explorar = page.locator("button", { hasText: "Explorar" }).first();
  if (await explorar.count()) {
    await explorar.click();
    await page.waitForTimeout(2500);
  } else {
    console.log("[nav] botón Explorar no encontrado (¿ya en el mapa?)");
  }

  // 2. abrir el <details> de Rutas en el panel de capas
  const rutas = page.locator('details[data-capa="rutas"]').first();
  if (!(await rutas.count())) {
    console.log("[capas] panel de capas no encontrado");
    await page.screenshot({ path: "/tmp/render/mtb-sin-panel.png" });
    process.exit(1);
  }
  await rutas.locator("summary").click();
  await page.waitForTimeout(600);

  const texto = await rutas.innerText();
  const mtb1Ok = /MTB 1/.test(texto) && /6,4 km|6\.4 km/.test(texto);
  const mtb2Ok = /MTB 2/.test(texto) && /6,2 km|6\.2 km/.test(texto);
  console.log("[panel] MTB 1 con 6,4 km:", mtb1Ok, "| MTB 2 con 6,2 km:", mtb2Ok);
  const lineas = texto.split("\n").filter((l) => /MTB/.test(l) || / km/.test(l));
  console.log("[panel] líneas MTB:", JSON.stringify(lineas.filter((l) => /MTB/.test(l)), null, 0));

  // 3. dibujar MTB 1 y MTB 2 en el mapa (botones Ver con data-vercapa = id)
  for (const id of ["mtb-1", "mtb-2"]) {
    const sw = page.locator(`button[data-vercapa="${id}"]`).first();
    if (await sw.count()) {
      await sw.click();
      await page.waitForTimeout(400);
      console.log(`[mapa] toggle ${id} activado`);
    } else {
      console.log(`[mapa] toggle ${id} no encontrado`);
    }
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/render/mtb12-mapa.png" });

  // 4. encuadrar MTB 1 y capturar su trazado
  const enc1 = page.locator('[aria-label^="Encuadrar MTB 1"]').first();
  if (await enc1.count()) {
    await enc1.click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: "/tmp/render/mtb1-encuadrada.png" });
    console.log("[mapa] MTB 1 encuadrada");
  }
  const enc2 = page.locator('[aria-label^="Encuadrar MTB 2"]').first();
  if (await enc2.count()) {
    await enc2.click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: "/tmp/render/mtb2-encuadrada.png" });
    console.log("[mapa] MTB 2 encuadrada");
  }

  console.log("[pageerror]", errors.length ? errors.join(" | ") : "ninguno");
  await browser.close();
}

main().then(
  () => process.exit(0),
  (e) => { console.error("FALLO:", e); process.exit(1); }
);
