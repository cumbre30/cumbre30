// E2E navegador — Nuevo destino predefinido "⛲ Plaza México" en la navegación.
//   1) El destino aparece en el select "Ir a…" del MiniMap.
//   2) Al elegirlo se traza la ruta (ETA + "Ruta lista").
//   3) El buscador del mapa también lo encuentra al escribir "mexico".
//   4) Sin errores de consola (filtro: 401 de sesiones).
// Correr con el server arriba: node scripts/e2e-plaza-mexico.mjs
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";

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

  // 1) el select "Ir a…" del MiniMap contiene el nuevo destino
  const sel = page.getByRole("combobox", { name: "Ir a" });
  await sel.waitFor({ timeout: 15_000 });
  const options = await sel.locator("option").allTextContents();
  const plaza = options.find((o) => o.includes("Plaza México"));
  chk("destino ⛲ Plaza México en el selector 'Ir a…'", Boolean(plaza), JSON.stringify(options));

  // 2) elegirlo traza la ruta (el BottomBar pasa a modo ruta: ETA/min)
  await sel.selectOption({ label: plaza });
  await page.waitForTimeout(2_500);
  const bar = await page.getByText(/Ruta lista|min/).first().isVisible().catch(() => false);
  chk("ruta trazada al elegir Plaza México", bar);
  await page.screenshot({ path: "/tmp/render/plaza-mexico-nav.png" });

  // 3) buscador del mapa: escribir "mexico" lo lista
  //    (abrir el buscador: botón de búsqueda del mapa)
  const searchBtn = page.getByRole("button", { name: /buscar|Buscador/i }).first();
  if (await searchBtn.isVisible().catch(() => false)) {
    await searchBtn.click();
    await page.waitForTimeout(600);
    await page.getByPlaceholder(/Buscar|dirección/i).first().fill("mexico").catch(() => {});
    await page.waitForTimeout(900);
    const hit = await page.getByText(/Plaza México/).first().isVisible().catch(() => false);
    chk("buscador lista Plaza México al escribir 'mexico'", hit);
  } else {
    console.log("SKIP buscador (botón no visible en esta vista)");
  }

  chk("sin errores de consola", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(fails ? `\n${fails} FAIL` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
