// Diag 2 — estados colapsado/abierto del panel de capas en Explorar
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  // viewport tipo el del usuario (Chrome Android con URL bar): 412x780
  const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(3000);

  const measure = async (label) => {
    const r = await p.evaluate(() => {
      const pill = document.querySelector("[data-testid='capas-panel']");
      const nav = document.querySelector("nav[aria-label='Navegación principal']");
      const mapWrap = document.querySelector("[data-testid='mapa-explorar'] > div:last-child");
      const search = document.querySelector("[data-testid='mapa-explorar'] > div:first-child");
      const rr = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) };
      };
      return { pill: rr(pill), nav: rr(nav), map: rr(mapWrap), search: rr(search), vh: window.innerHeight };
    });
    console.log(`--- ${label} ---`);
    console.log(JSON.stringify(r));
    const nav = r.nav, pill = r.pill;
    if (nav && pill) {
      console.log(`pill vs nav: pill.bottom=${pill.bottom} nav.top=${nav.top} → ${pill.bottom > nav.top ? "SUPERPONE " + (pill.bottom - nav.top) + "px sobre el nav" : "ok"}`);
    }
    if (r.map && nav) {
      console.log(`map vs nav: map.bottom=${r.map.bottom} nav.top=${nav.top} → ${r.map.bottom > nav.top ? "SUPERPONE " + (r.map.bottom - nav.top) + "px" : "ok"}`);
    }
  };

  await measure("panel ABIERTO (default)");
  await p.screenshot({ path: `${OUT}/ov-abierto.png` });

  // colapsar el panel (click en el título)
  await p.locator("[data-testid='capas-panel'] > button").first().click();
  await p.waitForTimeout(500);
  await measure("panel COLAPSADO");
  await p.screenshot({ path: `${OUT}/ov-colapsado.png` });

  await ctx.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
