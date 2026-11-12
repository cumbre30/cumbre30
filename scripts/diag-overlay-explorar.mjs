// Diag — superposición en Explorar (queja del cliente 2026-11-11 22:42):
// la búsqueda de direcciones y la píldora de capas flotan DENTRO del
// flujo del documento: si la página scrollea, cubren la barra inferior
// fija (Ride/Explorar/Credencial) y el header. Medimos scroll y
// capturamos evidencia.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(3000);

  const m = await p.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    innerH: window.innerHeight,
    bodyScrollH: document.body.scrollHeight,
    rootMinH: document.querySelector("body > div")?.className?.slice(0, 80) ?? "",
    scrollY: window.scrollY,
  }));
  console.log("scrollHeight:", m.scrollH, "innerHeight:", m.innerH, "body:", m.bodyScrollH, "scrollY:", m.scrollY);
  console.log("root:", m.rootMinH);
  console.log("scrollable:", m.scrollH > m.innerH);

  // posición de la píldora de capas y de la barra inferior
  const pillBox = await p.evaluate(() => {
    const pill = document.querySelector("[data-testid='capas-panel']");
    const nav = document.querySelector("nav[aria-label='Navegación principal']");
    const pr = pill?.getBoundingClientRect();
    const nr = nav?.getBoundingClientRect();
    const map = document.querySelector("[data-testid='mapa-explorar'] > div:last-child")?.getBoundingClientRect();
    return { pill: pr, nav: nr, mapCanvas: map, vh: window.innerHeight };
  });
  console.log("capas pill rect:", JSON.stringify(pillBox.pill));
  console.log("nav rect:", JSON.stringify(pillBox.nav));
  console.log("map canvas rect:", JSON.stringify(pillBox.mapCanvas));

  await p.screenshot({ path: `${OUT}/explorar-sin-scroll.png` });

  // ¿se puede scrollear?
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(400);
  const y = await p.evaluate(() => window.scrollY);
  console.log("scrollY tras intento de scroll a 400:", y);
  await p.screenshot({ path: `${OUT}/explorar-tras-scroll.png` });

  // donde queda la píldora respecto al nav tras el scroll
  const pillAfter = await p.evaluate(() => {
    const pill = document.querySelector("[data-testid='capas-panel']");
    const nav = document.querySelector("nav[aria-label='Navegación principal']");
    const pr = pill?.getBoundingClientRect();
    const nr = nav?.getBoundingClientRect();
    return { pillTop: pr?.top, pillBottom: pr?.bottom, navTop: nr?.top, vh: window.innerHeight, scrollY: window.scrollY };
  });
  console.log("tras scroll:", JSON.stringify(pillAfter));

  await ctx.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
