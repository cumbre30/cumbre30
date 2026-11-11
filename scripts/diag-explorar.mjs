// Verificación E2E del nuevo diseño de Explorar + generación de rutas
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  // 1. Ir a Explorar
  await page.getByRole("button", { name: "Explorar" }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/exp-pleno.png` });

  const body = await page.locator("body").innerText();
  console.log("[capas panel]", body.includes("Capas del mapa") ? "OK" : "FALTA");
  console.log("[barra direcciones]", body.includes("¿A dónde quieres ir?") || body.includes("Cualquier dirección o lugar") ? "OK" : "FALTA");
  console.log("[senderos eliminado]", body.includes("Senderos y cumbres del parque") ? "AÚN PRESENTE ✗" : "OK");
  console.log("[leyenda eliminada]", body.includes("Parque · límite 30") ? "AÚN PRESENTE ✗" : "OK");
  console.log("[lista destinos eliminada]", body.includes("Cerro Los Gemelos (Anfiteatro Pablo Neruda)") ? "AÚN PRESENTE ✗" : "OK");

  // 2. Abrir la capa Rutas y verificar 9 rutas + botones Ruta
  const detRutas = page.locator("details", { hasText: "Trazados de pavimento y circuitos MTB" }).first();
  await detRutas.locator("summary").click();
  await page.waitForTimeout(500);
  const rutasTexto = await detRutas.innerText();
  let okRutas = 0;
  for (const r of ["Vuelta Completa", "Loop Técnico La S", "Travesía Paseo Metropolitano", "Enduro Torre 5", "Pío Nono", "Pedro de Valdivia"]) {
    if (rutasTexto.includes(r)) okRutas++;
  }
  console.log(`[rutas clave] ${okRutas}/6`);
  const botonesRuta = await detRutas.locator("button[aria-label^='Generar ruta']").count();
  console.log(`[botones generar ruta] ${botonesRuta}/9`);
  await page.screenshot({ path: `${OUT}/exp-capas-rutas.png` });

  // 3. Dibujar una ruta (Ver) y generar la navegación (Ruta) — sin GPS muestra aviso
  const filaR5 = detRutas.locator("li", { hasText: "Vuelta Completa" }).first();
  await filaR5.locator("button[aria-label*='Encuadrar']").click();
  await page.waitForTimeout(1200);
  await filaR5.locator("button[aria-label^='Generar ruta']").click();
  await page.waitForTimeout(600);
  const body2 = await page.locator("body").innerText();
  console.log("[aviso GPS sin fix]", body2.includes("Activa tu GPS") ? "OK" : "FALTA");
  await page.screenshot({ path: `${OUT}/exp-ruta-sin-gps.png` });

  // 4. Con demo activo: iniciar ride (sim) → volver a Explorar → generar ruta
  await page.getByRole("button", { name: "Ride" }).click();
  await page.waitForTimeout(400);
  const btnIniciar = page.locator("button", { hasText: "Iniciar ride" }).first();
  if (await btnIniciar.isVisible().catch(() => false)) {
    await btnIniciar.click();
    await page.waitForTimeout(2500);
  }
  await page.getByRole("button", { name: "Explorar" }).click();
  await page.waitForTimeout(2000);
  await detRutas.locator("summary").click();
  await page.waitForTimeout(400);
  await filaR5.locator("button[aria-label^='Generar ruta']").click();
  await page.waitForTimeout(4500);
  const body3 = await page.locator("body").innerText();
  console.log("[ruta generada chip]", body3.includes("Ruta 5 · Vuelta Completa (4 accesos) · ") ? "OK" : "REVISAR");
  console.log("[nota acceso]", body3.includes("Ingresa por") || body3.includes("acceso") ? "probable OK" : "REVISAR");
  await page.screenshot({ path: `${OUT}/exp-ruta-generada.png` });

  await browser.close();
  console.log("OK diag explorar");
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
