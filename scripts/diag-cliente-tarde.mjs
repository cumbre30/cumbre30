// E2E — lote del cliente 2026-11-12 (tarde):
//  1) Minimapa: SOLO los accesos en «Ir a…» (sin opciones de ruta).
//  2) Capa Rutas: Ruta 1 (3.4 km) y Ruta 3 (4.8 km) trazan desde/hacia
//     PDV por Av. Abate Molina — SIN la línea recta del puente sintético
//     y SIN el tramo hacia Tupahue (bajada recta por Gabriela Mistral,
//     cliente 2026-11-12 noche).
//  3) Navegación en vivo: desde la ladera poniente (fin del ex puente)
//     a PdV Norte llega por caminos reales (sin la recta de 318 m).
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

// GPS junto al extremo poniente del PUENTE ELIMINADO (-33.4195,-70.6214):
// cualquier ruta que salga de aquí ya no puede usar la recta sintética.
const LADERA_PONIENTE = { lat: -33.4193, lon: -70.6216 };

async function main() {
  const browser = await chromium.launch();

  // ---------- 1) Minimapa: solo accesos ----------
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p1 = await ctx1.newPage();
  await p1.goto(BASE, { waitUntil: "networkidle" });
  await p1.waitForTimeout(4500);
  const sel = p1.locator("select[aria-label='Ir a']");
  await sel.waitFor({ timeout: 15000 });
  const optgroups = await sel.locator("optgroup").count();
  ok(optgroups === 0, `minimapa: sin optgroups (${optgroups})`);
  const opts = await sel.locator("option").allTextContents();
  ok(opts.filter((t) => t.includes("🚴")).length === 4, `minimapa: 4 accesos (${opts.join(" | ")})`);
  ok(!opts.some((t) => /Plaza México|Gabriela Mistral|Carlos Martner/.test(t)), "minimapa: sin Plaza México / Gabriela Mistral / Martner");
  await p1.screenshot({ path: `${OUT}/minimapa-solo-accesos.png` });
  await ctx1.close();

  // ---------- 2) Capa Rutas: Ruta 1 y Ruta 3 ----------
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE, { waitUntil: "networkidle" });
  await p2.waitForTimeout(2500);
  await p2.getByRole("button", { name: "Explorar" }).click();
  await p2.waitForTimeout(2500);
  await p2.locator("details[data-capa='rutas'] > summary").click();
  await p2.waitForTimeout(400);
  const filaR1 = p2.locator("li, div").filter({ hasText: "Ruta 1 · Clásica" }).first();
  const r1txt = await filaR1.textContent().catch(() => "");
  ok(/3,4|3\.4/.test(r1txt ?? ""), `Ruta 1 muestra 3.4 km (${r1txt?.slice(0, 60)})`);
  await p2.locator("button[data-vercapa='ruta-1']").click();
  await p2.waitForTimeout(800);
  await p2.locator("button[aria-label='Encuadrar Ruta 1 · Clásica Cumbre por Pedro de Valdivia']").click();
  await p2.waitForTimeout(2200);
  await p2.locator("button[aria-expanded]").first().click();
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: `${OUT}/ruta1-abate-molina.png` });

  // Ruta 3
  await p2.locator("button[aria-expanded]").first().click();
  await p2.waitForTimeout(600);
  // el panel reabre PLEGADO: expandir de nuevo el details de Rutas
  await p2.locator("details[data-capa='rutas'] > summary").click();
  await p2.waitForTimeout(400);
  await p2.locator("button[data-vercapa='ruta-3']").click();
  await p2.waitForTimeout(800);
  await p2.locator("button[aria-label*='Encuadrar Ruta 3']").click();
  await p2.waitForTimeout(2200);
  await p2.locator("button[aria-expanded]").first().click();
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: `${OUT}/ruta3-abate-molina.png` });
  await ctx2.close();

  // ---------- 3) Navegación viva desde la ladera poniente ----------
  const ctx3 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: LADERA_PONIENTE.lat, longitude: LADERA_PONIENTE.lon, accuracy: 10 },
  });
  await ctx3.grantPermissions(["geolocation"]);
  const p3 = await ctx3.newPage();
  await p3.goto(BASE, { waitUntil: "networkidle" });
  await p3.waitForTimeout(4500);
  const sel3 = p3.locator("select[aria-label='Ir a']");
  await sel3.waitFor({ timeout: 15000 });
  const pvOption = sel3.locator("option", { hasText: "Acceso Pedro de Valdivia Norte" });
  const val = await pvOption.getAttribute("value");
  await sel3.selectOption(val);
  await p3.waitForTimeout(6000);
  // evaluate crudo: la cámara del minimapa anima sin parar y los waits de
  // actionabilidad de Playwright (innerText/screenshot) nunca se asientan
  const body = await p3.evaluate(() => document.body.innerText).catch((e) => `ERR ${String(e).slice(0, 60)}`);
  const rutaOk = /Ruta lista|min ·|min ·|km/.test(body ?? "");
  ok(rutaOk, "navegación desde la ladera poniente a PdV Norte: ruta calculada");
  await p3.screenshot({ path: `${OUT}/nav-ladera-poniente-pdv.png`, animations: "disabled", timeout: 15000 }).catch(() => {});
  await ctx3.close();

  await browser.close();
  console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
