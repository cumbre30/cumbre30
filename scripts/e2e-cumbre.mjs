// E2E navegador — Cumbre reemplazada: acceso La Pirámide + Plaza México.
//   1) El destino "🏔️ Cumbre del Cerro" YA NO está en el select "Ir a…"
//      (el Santuario de la Virgen es solo peatonal).
//   2) El acceso "🚪 Acceso La Pirámide" SÍ está en el select.
//   3) Al elegirlo se traza la ruta (ETA + "Ruta lista").
//   4) "⛲ Plaza México" sigue disponible (reemplaza a la cumbre).
//   5) Sin errores de consola (filtro: 401 de sesiones).
// Correr con el server arriba: node scripts/e2e-cumbre.mjs [BASE]
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:81";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

const CONSOLE_IGNORE = [/401 \(Unauthorized\)/];

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
  await page.waitForTimeout(1_500);

  // 1+2) el select "Ir a…" contiene La Pirámide y ya no la Cumbre
  const sel = page.getByRole("combobox", { name: "Ir a" });
  await sel.waitFor({ timeout: 15_000 });
  const options = await sel.locator("option").allTextContents();
  const cumbreOpt = options.find((o) => o.includes("Cumbre del Cerro"));
  chk("destino 🏔️ Cumbre del Cerro ELIMINADO del selector", !cumbreOpt, JSON.stringify(options));
  const piramideOpt = options.find((o) => o.includes("Acceso La Pirámide"));
  chk("acceso 🚪 Acceso La Pirámide en el selector", Boolean(piramideOpt), JSON.stringify(options));
  chk("destino ⛲ Plaza México sigue disponible", options.some((o) => o.includes("Plaza México")));

  // 3) elegir La Pirámide traza la ruta
  await sel.selectOption({ label: piramideOpt });
  await page.waitForTimeout(3_000);
  const bar = await page.getByText(/Ruta lista|min/).first().isVisible().catch(() => false);
  chk("ruta trazada al elegir Acceso La Pirámide", bar);
  await page.screenshot({ path: "/tmp/render/piramide-nav.png" });

  // 3b) la pill de ruta muestra la distancia (referencia)
  const pill = await page.getByText(/\d+([.,]\d+)?\s?km/).first().textContent().catch(() => null);
  if (pill) console.log("  pill de ruta:", pill.trim());

  chk("sin errores de consola", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(fails ? `\n${fails} FAIL` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
