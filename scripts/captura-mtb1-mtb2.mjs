// Captura visual MTB 1 y MTB 2 en el mapa general (evidencia para el cliente).
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const BASE = "http://127.0.0.1:3000";
const OUT = "/tmp/render";

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 120)));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);

  // mapa general
  await page.locator("select").first().selectOption("listado");
  await page.waitForTimeout(2500);

  // detalles de trazados
  // abrir sección Rutas (la raíz «Capas del mapa» ya está abierta por defecto)
  const raizBtn = page.locator('[data-testid="capas-panel"] > button').first();
  const det = page.locator("details", { hasText: "Trazados de pavimento y circuitos MTB" }).first();
  await det.locator("summary").click();
  await page.waitForTimeout(700);

  // MTB 1: dibujar con el switch «Ver» (dibuja + encuadra), colapsar raíz y capturar
  const fila1 = det.locator("li", { hasText: "Loop Los Gemelos" }).first();
  console.log("[mtb1] texto fila:", (await fila1.innerText()).replace(/\s+/g, " ").slice(0, 140));
  await fila1.locator("button").first().click();
  await page.waitForTimeout(2500);
  await raizBtn.click(); // colapsar raíz → mapa completo
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/mtb1-mapa.png` });

  // MTB 2: abrir raíz, abrir sección Rutas (se remonta cerrada), apagar MTB 1, prender MTB 2
  await raizBtn.click(); // abrir raíz
  await page.waitForTimeout(500);
  await det.locator("summary").click(); // reabrir sección Rutas
  await page.waitForTimeout(500);
  const fila2 = det.locator("li", { hasText: "Loop Técnico La S" }).first();
  console.log("[mtb2] texto fila:", (await fila2.innerText()).replace(/\s+/g, " ").slice(0, 140));
  await fila1.locator("button").first().click(); // apagar MTB 1
  await page.waitForTimeout(600);
  await fila2.locator("button").first().click(); // prender MTB 2
  await page.waitForTimeout(2500);
  await raizBtn.click(); // colapsar raíz
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/mtb2-mapa.png` });

  await browser.close();
  console.log("OK capturas MTB");
}

main().then(
  () => process.exit(0),
  (e) => { console.error("FALLO:", e); process.exit(1); }
);
