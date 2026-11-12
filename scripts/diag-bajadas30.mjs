// E2E: bajadas del control 30 km/h (cliente 2026-11-13).
// 1) Activa la capa Normativa y Seguridad → verifica el ítem del control
//    con su detalle de las 3 bajadas.
// 2) Vuelca las polilíneas rojas (#dc2626) visibles: deben ser 3.
// 3) «Borra el punto 🐢 en el mapa, dejar sólo en la capa»: cero marcadores
//    🐢 en el mapa, mientras el resto de la capa (📱 🛠 ⚠) sigue pintada.
// 4) Tocar «centrar» del ítem del control activa la capa y enmarca los 3
//    corredores rojos.
// 5) Advertencia Jardín Japonés trasladada a -33.413703, -70.614831.
// Capturas: bajada Plaza México → Pío Nono, zona Antilén/La Pirámide y
// encuadre de los 3 corredores.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    permissions: ["geolocation"],
    geolocation: { latitude: -33.4234, longitude: -70.6327 }, // Plaza México
  });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") console.log("[consola]", m.text().slice(0, 160));
  });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(4000);
  await p.getByRole("button", { name: "Explorar" }).click();
  await p.waitForTimeout(2500);

  // abrir el panel de capas y la sección Normativa y Seguridad
  const normSummary = p.locator("details[data-capa='normativa'] > summary");
  await normSummary.scrollIntoViewIfNeeded();
  await normSummary.click();
  await p.waitForTimeout(600);

  // marcar la capa (el switch «Ver» del bloque) → dibuja círculos + 3 bajadas rojas
  const switchNorm = p.locator("button[data-vercapa='normativa']");
  console.log("switch normativa count:", await switchNorm.count());
  await switchNorm.click();
  await p.waitForTimeout(1500);

  const bodyNorm = await p.locator("details[data-capa='normativa']").innerText();
  const okItem = /Control velocidad máx\. 30 km\/h \(bajadas principales\)/.test(bodyNorm);
  const okDetalle = /Cima Chacarillas → Acceso La Pirámide/.test(bodyNorm) && /Plaza México → Acceso Pío Nono/.test(bodyNorm);
  console.log(okItem ? "✓ ítem Control velocidad 30 km/h presente" : "✗ falta el ítem control 30");
  console.log(okDetalle ? "✓ detalle lista las 3 bajadas" : "✗ detalle sin las 3 bajadas");

  // polilíneas rojas visibles (SVG paths con stroke #dc2626)
  const rojas = await p.evaluate(() => {
    const paths = Array.from(document.querySelectorAll("path[stroke='#dc2626'], path[stroke='rgb(220, 38, 38)']"));
    return paths.filter((el) => {
      const d = el.getAttribute("d") ?? "";
      return d.length > 40 && !/^M0 0$/.test(d);
    }).length;
  });
  console.log(rojas >= 3 ? `✓ ${rojas} trazados rojos visibles (>=3)` : `✗ solo ${rojas} trazados rojos visibles`);

  // «borra el punto 🐢 en el mapa, dejar sólo en la capa»: cero marcadores
  // 🐢 en el mapa con la capa activada; el resto de la capa sigue pintada.
  const marcadores = await p.evaluate(() => {
    const icons = Array.from(document.querySelectorAll(".leaflet-marker-icon"));
    const porTexto = (t) => icons.filter((el) => (el.textContent ?? "").includes(t)).length;
    return { tortuga: porTexto("🐢"), qr: porTexto("📱"), soporte: porTexto("🛠"), advertencias: porTexto("⚠") };
  });
  const okSinTortuga = marcadores.tortuga === 0;
  console.log(okSinTortuga ? "✓ sin marcador 🐢 en el mapa (solo capa)" : `✗ ${marcadores.tortuga} marcadores 🐢 visibles en el mapa`);
  const okResto = marcadores.qr >= 1 && marcadores.soporte >= 3;
  console.log(okResto ? `✓ resto de la capa pintado (📱 ${marcadores.qr} · 🛠 ${marcadores.soporte})` : `✗ faltan marcadores de la capa: ${JSON.stringify(marcadores)}`);

  // Advertencia Jardín Japonés y encuadre del control: al final, para no
  // alterar el estado del panel del flujo original (se reabre abajo).

  // colapsar panel y capturar la bajada Plaza México → Pío Nono
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/b30-plaza-mexico-pionono.png` });
  console.log("captura b30-plaza-mexico-pionono.png");

  // volar al sector Antilén (bajadas b30-piramide y b30-pdv pasan por ahí)
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  const normSummary2 = p.locator("details[data-capa='normativa'] > summary");
  await normSummary2.scrollIntoViewIfNeeded();
  await normSummary2.click();
  await p.waitForTimeout(500);
  const filaAntilen = p.locator("button[aria-label='Centrar mapa en Advertencia: Cruce Piscina Antilén']");
  await filaAntilen.scrollIntoViewIfNeeded();
  await filaAntilen.click();
  await p.waitForTimeout(2200);
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/b30-antilen.png` });
  console.log("captura b30-antilen.png");

  // --- Advertencia Jardín Japonés trasladada: abrir de nuevo el panel, ---
  // volar a la coordenada nueva y dejar el círculo amarillo en pantalla.
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  const normSummary3 = p.locator("details[data-capa='normativa'] > summary");
  await normSummary3.scrollIntoViewIfNeeded();
  await normSummary3.click();
  await p.waitForTimeout(500);
  const filaJJ = p.locator("button[aria-label='Centrar mapa en Advertencia: Jardín Japonés']");
  await filaJJ.scrollIntoViewIfNeeded();
  await filaJJ.click();
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${OUT}/b30-jardin-japones.png` });
  console.log("captura b30-jardin-japones.png");

  // --- tocar «centrar» del ítem del control: activa la capa y enmarca ---
  // los 3 corredores rojos (sin punto propio en el mapa).
  const fila30 = p.locator("button[aria-label^='Centrar mapa en Control velocidad']");
  await fila30.scrollIntoViewIfNeeded();
  await fila30.click();
  await p.waitForTimeout(2600);
  await p.locator("button:has-text('Capas del mapa')").first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/b30-encuadre-3-corredores.png` });
  console.log("captura b30-encuadre-3-corredores.png");
  const rojasEncuadre = await p.evaluate(() => {
    const paths = Array.from(document.querySelectorAll("path[stroke='#dc2626'], path[stroke='rgb(220, 38, 38)']"));
    return paths.filter((el) => {
      const d = el.getAttribute("d") ?? "";
      return d.length > 40 && !/^M0 0$/.test(d);
    }).length;
  });
  console.log(rojasEncuadre >= 3 ? `✓ tras tocar el ítem: ${rojasEncuadre} corredores rojos en cuadro` : `✗ encuadre sin los 3 corredores (${rojasEncuadre})`);

  const fallos = [okItem, okDetalle, rojas >= 3, okSinTortuga, okResto, rojasEncuadre >= 3].filter((x) => !x).length;
  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`);
  await browser.close();
  process.exit(fallos === 0 ? 0 : 1);
}

main();
