// E2E del síntoma del cliente (2026-11-12): «para ver las rutas las muestra
// al instante en el mapa pero al seleccionar ruta se queda pegado».
// 1) Toca «Ruta» en RUTA 3 del panel de capas con el ciclista FUERA del
//    parque (Providencia/PdV: era el peor caso, 45 s congelado antes del fix).
// 2) Mide el tiempo hasta que la ruta queda lista Y si la UI se congela
//    (sondeos de respuesta del hilo principal cada 150 ms).
// 3) Verifica que el chip de ruta activa aparezca y la nota se limpie.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    permissions: ["geolocation"],
    geolocation: { latitude: -33.4215, longitude: -70.6095 }, // fuera del parque (peor caso)
  });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(3000);

  // abrir el menú de Rutas del panel de capas
  const rutasSummary = p.locator("details[data-capa='rutas'] > summary");
  await rutasSummary.scrollIntoViewIfNeeded();
  await rutasSummary.click();
  await p.waitForTimeout(500);

  // tocar «Ruta» en Ruta 3 y cronometrar hasta que la ruta queda activa
  const btnR3 = p.locator("button[aria-label='Generar ruta: Ruta 3 · Travesía Zapadores - Pedro de Valdivia']");
  ok((await btnR3.count()) === 1, "botón «Ruta» de Ruta 3 presente");
  const t0 = Date.now();
  await btnR3.click();

  // sondeo de congelamiento: cada 150 ms el hilo principal debe responder
  let maxFreeze = 0;
  const sondeo = setInterval(async () => {
    const s = Date.now();
    try { await p.evaluate(() => 1 + 1); } catch { /* página cerrándose */ }
    const lag = Date.now() - s;
    if (lag > maxFreeze) maxFreeze = lag;
  }, 150);

  // esperar la ruta activa (chip con «Quitar ruta») — tope 20 s
  let list = false;
  try {
    await p.getByText("Quitar ruta").waitFor({ state: "visible", timeout: 20000 });
    list = true;
  } catch { /* timeout */ }
  const msTotal = Date.now() - t0;
  clearInterval(sondeo);

  ok(list, `ruta generada (chip «Quitar ruta» visible) en ${msTotal} ms`);
  ok(msTotal < 4000, `la ruta aparece rápido (< 4 s): ${msTotal} ms`);
  ok(maxFreeze < 1500, `UI sin congelamiento (peor lag del hilo principal ${maxFreeze} ms)`);
  const chip = await p.locator("text=Ruta 3 · Travesía Zapadores").first().isVisible().catch(() => false);
  ok(chip, "chip de destino muestra «Ruta 3 · Travesía Zapadores - Pedro de Valdivia»");

  // captura para el registro
  await p.screenshot({ path: `${OUT}/ruta-3-generada.png` });

  // repetir con RUTA 1 (era el peor caso medido: 45 s)
  const btnR1 = p.locator("button[aria-label='Generar ruta: Ruta 1 · Clásica Cumbre por Pedro de Valdivia']");
  if ((await btnR1.count()) === 1) {
    await p.getByText("Quitar ruta").click();
    await p.waitForTimeout(800);
    const t1 = Date.now();
    await btnR1.click();
    let list1 = false;
    try {
      await p.getByText("Quitar ruta").waitFor({ state: "visible", timeout: 20000 });
      list1 = true;
    } catch { /* timeout */ }
    const ms1 = Date.now() - t1;
    ok(list1 && ms1 < 4000, `Ruta 1 (peor caso pre-fix 45 s) lista en ${ms1} ms`);
    await p.screenshot({ path: `${OUT}/ruta-1-generada.png` });
  }

  await browser.close();
  console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
