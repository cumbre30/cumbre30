// Verificación del preview: levanta el dev server dentro de la llamada,
// espera 200 y valida la tarjeta SOS con el nuevo número 1466.
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const BASE = "http://127.0.0.1:3000";

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
  // 1. Levantar dev server (muere solo al terminar la llamada, no hace falta kill)
  const dev = spawn("npm", ["run", "dev"], {
    cwd: "/home/z/my-project",
    stdio: "ignore",
    detached: true,
  });
  dev.unref();
  console.log("[dev] lanzado");

  // 2. Esperar 200
  const status = await waitServer();
  console.log("[dev] HTTP", status);
  if (!status) {
    console.error("dev.log tail:\n" + require("node:fs").readFileSync("/home/z/my-project/dev.log", "utf8").slice(-800));
    process.exit(1);
  }

  // 3. Playwright: abrir app, abrir tarjeta de emergencia, buscar 1466
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);

  const sos = page.locator('[aria-label="Abrir tarjeta de emergencia"]').first();
  if (await sos.count()) {
    await sos.click();
    await page.waitForTimeout(900);
    const body = await page.locator("body").innerText();
    const hay1466 = body.includes("1466");
    const hayViejo = body.includes("+56 2 2730 1404");
    console.log("[SOS] 1466 visible:", hay1466, "| número antiguo presente:", hayViejo);
    await page.screenshot({ path: "/tmp/render/sos-1466.png" });
    const modal = page.locator('[role="dialog"][aria-label="Emergencia"]');
    if (await modal.count()) await modal.screenshot({ path: "/tmp/render/sos-1466-modal.png" }).catch(() => {});
  } else {
    console.log("[SOS] botón de emergencia no encontrado en la vista inicial");
    await page.screenshot({ path: "/tmp/render/sin-sos.png" });
  }

  console.log("[pageerror]", errors.length ? errors.join(" | ") : "ninguno");
  await browser.close();
}

main().then(
  () => process.exit(0),
  (e) => { console.error("FALLO:", e); process.exit(1); }
);
