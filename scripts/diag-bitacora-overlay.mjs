// E2E — lote del cliente 2026-11-12 (noche): bitácora sin credencial QR,
// indicaciones correctas en accesos, histéresis de geocerca y botón de
// ride sin tapar el nav.
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
  const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(3500);

  // ---- 1) Sin el botón «N» de dev-tools VISIBLE sobre la píldora de capas ----
  const nBadgeVisible = await p.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    if (!portal) return false;
    const r = portal.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > window.innerHeight - 160 && r.left < 200;
  });
  ok(!nBadgeVisible, "sin botón «N» de dev-tools tapando la esquina inferior");

  // ---- 2) Explorar: flotantes no tocan el nav ----
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(2500);
  const ov = await p.evaluate(() => {
    const pill = document.querySelector("[data-testid='capas-panel']")?.getBoundingClientRect();
    const nav = document.querySelector("nav[aria-label='Navegación principal']")?.getBoundingClientRect();
    return { pillBottom: pill?.bottom, navTop: nav?.top };
  });
  ok(ov.pillBottom <= ov.navTop, `capas sobre el nav (${ov.pillBottom} <= ${ov.navTop})`);

  // ---- 3) Ride: botón principal no tapa el nav ----
  await p.getByRole("button", { name: "Ride" }).click();
  await p.waitForTimeout(1200);
  const btn = await p.evaluate(() => {
    const els = [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Iniciar ride"));
    const r = els[0]?.getBoundingClientRect();
    const nav = document.querySelector("nav[aria-label='Navegación principal']")?.getBoundingClientRect();
    return { btnBottom: r?.bottom, navTop: nav?.top };
  });
  ok(btn.btnBottom <= btn.navTop, `botón Iniciar sobre el nav (${btn.btnBottom} <= ${btn.navTop})`);

  // ---- 4) Demo: bitácora con indicaciones nuevas (sin credencial QR) ----
  await p.locator("button:has-text('Iniciar ride')").click();
  await p.waitForTimeout(6000);
  // abrir la caja y cambiar a Bitácora con clicks DOM (el botón fijo
  // Reanudar/Pausar cubre la zona baja y roba los clicks de Playwright)
  await p.locator("details:has-text('Estadísticas y bitácora') > summary").click();
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    [...document.querySelectorAll("button[role='tab']")]
      .find((b) => b.textContent?.includes("Bitácora"))
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await p.waitForTimeout(2500);
  const events1 = await p.locator("ul[aria-label='Eventos del viaje'] li span:not(.font-mono)").allTextContents();
  console.log("bitácora t+6s:", JSON.stringify(events1.slice(0, 8)));
  const all = events1.join(" || ");
  ok(!/credencial/i.test(all), "bitácora sin «credencial»");
  await p.screenshot({ path: `${OUT}/e2e-bitacora-demo.png` });

  // esperar más eventos de la demo (12x tiempo real)
  await p.waitForTimeout(25000);
  const events2 = await p.locator("ul[aria-label='Eventos del viaje'] li span:not(.font-mono)").allTextContents();
  console.log("bitácora t+31s:", JSON.stringify(events2.slice(0, 10)));
  const all2 = events2.join(" || ");
  ok(!/credencial/i.test(all2), "bitácora t+31s sin «credencial»");
  const ing = events2.filter((t) => t.includes("Ingresando al Parque"));
  const sal = events2.filter((t) => t.includes("Saliendo del parque"));
  ok(ing.length <= 2 && sal.length <= 1, `histéresis: ${ing.length} ingresos / ${sal.length} salidas (sin parpadeo)`);
  await p.screenshot({ path: `${OUT}/e2e-bitacora-demo-2.png` });

  await ctx.close();
  await browser.close();
  console.log(fails === 0 ? "TODO OK" : `FALLOS: ${fails}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
