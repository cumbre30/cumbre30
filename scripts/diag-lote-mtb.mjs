// E2E del lote 2026-11-13 (tarde): accesos movidos (Pío Nono esquina de
// entrada · La Pirámide POI ParqueMet), capa «Senderos peatonales»
// (informativa, café punteado) y menú lateral sobre los flotantes del mapa.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") console.log("[consola]", m.text().slice(0, 160));
  });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(4000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(2500);

  // 1) capa Senderos peatonales: sección con 8 senderos + líneas café
  const sendSummary = p.locator("details[data-capa='senderos'] > summary");
  console.log("sección senderos:", await sendSummary.count());
  await sendSummary.scrollIntoViewIfNeeded();
  await sendSummary.click();
  await p.waitForTimeout(600);
  const bodySend = await p.locator("details[data-capa='senderos']").innerText();
  const nombres = ["Zorro Vidal", "El Ermitaño", "Anáhuac", "Mapuche", "Gabriela Mistral", "Boy Scout", "Atacameño", "El Carbón"];
  const faltan = nombres.filter((n) => !bodySend.includes(n));
  console.log(faltan.length === 0 ? "✓ los 8 senderos peatonales en la capa" : `✗ faltan: ${faltan.join(" | ")}`);
  // el switch de la capa ya viene activado (default) → trazados café punteado
  const cafes = await p.evaluate(() => {
    const paths = Array.from(document.querySelectorAll("path[stroke='#92400e'], path[stroke='rgb(146, 64, 14)']"));
    return paths.filter((el) => {
      const d = el.getAttribute("d") ?? "";
      return d.length > 30 && !/^M0 0$/.test(d);
    }).length;
  });
  console.log(cafes >= 5 ? `✓ ${cafes} trazados de senderos peatonales visibles en el encuadre (≥5; los demás quedan fuera de la vista)` : `✗ solo ${cafes} trazados café visibles`);
  // encuadrar Zorro Vidal (el más largo del sector Bellavista)
  const filaZorro = p.locator("button[aria-label='Encuadrar Sendero Zorro Vidal']");
  await filaZorro.scrollIntoViewIfNeeded();
  await filaZorro.click();
  await p.waitForTimeout(2200);
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/lote-sendero-zorro.png` });
  console.log("captura lote-sendero-zorro.png");

  // 2) accesos nuevos: enfocar Pío Nono y La Pirámide (marcador de la capa)
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  const accSummary = p.locator("details[data-capa='accesos'] > summary");
  await accSummary.scrollIntoViewIfNeeded();
  await accSummary.click();
  await p.waitForTimeout(500);
  await p.locator("button[aria-label='Centrar mapa en Acceso Pío Nono']").click();
  await p.waitForTimeout(2200);
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/lote-acceso-pio-nono.png` });
  console.log("captura lote-acceso-pio-nono.png");
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  const accSummary2 = p.locator("details[data-capa='accesos'] > summary");
  await accSummary2.scrollIntoViewIfNeeded();
  await accSummary2.click();
  await p.waitForTimeout(500);
  await p.locator("button[aria-label='Centrar mapa en Acceso La Pirámide']").click();
  await p.waitForTimeout(2200);
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/lote-acceso-la-piramide.png` });
  console.log("captura lote-acceso-la-piramide.png");

  // 3) menú lateral sobre los flotantes: abrir el menú y verificar que el
  //    panel (aria-label Menú principal) tapa al mapa; los flotantes del
  //    mapa (barra de direcciones / capas) NO deben renderizarse sobre él.
  await p.locator("button[aria-label='Abrir menú']").click();
  await p.waitForTimeout(800);
  const menu = p.locator("aside[aria-label='Menú principal']");
  const menuBox = await menu.boundingBox();
  const searchBox = await p.locator("form, input[placeholder*='Busca']").first().boundingBox().catch(() => null);
  const tapado = menuBox && searchBox ? searchBox.x >= menuBox.x + menuBox.width * 0.5 || searchBox.y >= menuBox.height : true;
  console.log(tapado ? "✓ barra de direcciones bajo el menú lateral (o no presente)" : `✗ barra de direcciones sobre el menú: menu=${JSON.stringify(menuBox)} search=${JSON.stringify(searchBox)}`);
  await p.screenshot({ path: `${OUT}/lote-menu-lateral.png` });
  console.log("captura lote-menu-lateral.png");
  await p.keyboard.press("Escape");
  await p.locator("div[aria-hidden='true'].fixed.inset-0").click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);

  const fallos = (faltan.length ? 1 : 0) + (cafes >= 5 ? 0 : 1) + (tapado ? 0 : 1);
  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`);
  await browser.close();
  process.exit(fallos === 0 ? 0 : 1);
}

main();
