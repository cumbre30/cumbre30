// Verificación de la arquitectura de capas del mapa general (5 menús
// desplegables) y del minimapa limpio (Plaza México + accesos + enlace
// "Revisa el listado completo" que abre el mapa general).
// Ejecutar con el dev server corriendo en :3000
//   node scripts/diag-capas-mapa.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/render";
mkdirSync(OUT, { recursive: true });

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗ FALLO"} ${msg}`);
  if (!cond) fallos++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);

// ---------- 1. Minimapa: opciones del selector "Ir a" ----------
const opciones = await page.evaluate(() => {
  const sel = document.querySelector('select[aria-label="Ir a"]');
  return sel ? Array.from(sel.options).map((o) => o.textContent) : null;
});
console.log("Opciones 'Ir a…' del minimapa:", JSON.stringify(opciones));
ok(Array.isArray(opciones), "el selector Ir a existe en el minimapa");
if (Array.isArray(opciones)) {
  ok(opciones.length === 7, `solo 1 destino base + 5 (Plaza México + 4 accesos) + listado completo = 7 (hay ${opciones.length})`);
  ok(opciones.some((o) => o?.includes("Plaza México")), "Plaza México presente");
  ok(opciones.some((o) => o?.includes("Acceso Pío Nono")), "Acceso Pío Nono presente");
  ok(opciones.some((o) => o?.includes("Acceso Zapadores")), "Acceso Zapadores presente");
  ok(opciones.some((o) => o?.includes("Acceso La Pirámide")), "Acceso La Pirámide presente");
  ok(opciones.some((o) => o?.includes("Acceso Pedro de Valdivia Norte")), "Acceso PdV Norte presente");
  ok(opciones.some((o) => o?.includes("Revisa el listado completo")), "opción 'Revisa el listado completo' presente");
  ok(!opciones.some((o) => o?.includes("Piscina Antilén")), "Piscina Antilén fuera del minimapa");
  ok(!opciones.some((o) => o?.includes("Jardín Japonés")), "Jardín Japonés fuera del minimapa");
  ok(!opciones.some((o) => o?.includes("Zoológico Nacional")), "Zoológico fuera del minimapa");
}

// ---------- 2. "Revisa el listado completo" lleva al mapa general ----------
await page.selectOption('select[aria-label="Ir a"]', { label: "🗺 Revisa el listado completo" });
await page.waitForTimeout(2500);
const capasVisible = await page.locator('[data-testid="capas-panel"]').isVisible().catch(() => false);
ok(capasVisible, "al elegir 'Revisa el listado completo' se abre el mapa general con el panel de capas");

// ---------- 3. Panel de capas: 5 menús ----------
const menus = await page.evaluate(() =>
  Array.from(document.querySelectorAll("details[data-capa]")).map((d) => ({
    id: d.getAttribute("data-capa"),
    open: d.hasAttribute("open"),
    resumen: d.querySelector("summary")?.textContent ?? "",
  }))
);
console.log("Menús de capas:", menus.map((m) => `${m.id}${m.open ? " (abierto)" : ""}`).join(" · "));
ok(menus.length === 5, "existen 5 menús desplegables");
ok(menus.map((m) => m.id).join(",") === "accesos,rutas,pois,normativa,urbana", "ids en el orden pedido");
ok(menus[1].resumen.includes("Trazados de pavimento y circuitos MTB"), "subtítulo Rutas correcto");
ok(menus[2].resumen.includes("Cruces, servicios, miradores y alertas peatonales"), "subtítulo Puntos de Interés correcto");
ok(menus[3].resumen.includes("Cortes horarios, límites y soporte técnico"), "subtítulo Normativa correcto");
ok(menus[4].resumen.includes("Metro y ciclovías externas"), "subtítulo Conexión Urbana correcto");

// ---------- 4. Accesos visibles por defecto: 4 marcadores verdes ----------
const accesos = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll(".leaflet-overlay-pane svg path"));
  return {
    verde: paths.filter((p) => p.getAttribute("stroke") === "#34d399" && p.getAttribute("fill") === "#065f46").length,
    poligono: paths.filter((p) => p.getAttribute("stroke") === "#34d399" && p.getAttribute("fill") !== "#065f46").length,
    gris: paths.filter((p) => p.getAttribute("stroke") === "#94a3b8").length,
  };
});
ok(accesos.verde === 4, `4 accesos ciclistas visibles por defecto (hay ${accesos.verde})`);
ok(accesos.gris === 0, `0 accesos grises: los accesos sin bici ya no se dibujan (hay ${accesos.gris})`);
ok(accesos.poligono === 1, "el polígono del parque sigue visible");

// ---------- 5. Rutas: abrir menú y dibujar Ruta 2 (pavimento azul) ----------
await page.locator('details[data-capa="rutas"] summary').click();
await page.waitForTimeout(400);
const filasRutas = await page.locator('details[data-capa="rutas"] li').count();
ok(filasRutas === 6, `6 rutas listadas en el menú (hay ${filasRutas})`);
const textoRutas = await page.locator('details[data-capa="rutas"]').textContent();
ok(textoRutas.includes("Clásica Cumbre por Pedro de Valdivia"), "Ruta 1 presente");
ok(textoRutas.includes("Clásica Cumbre por Pío Nono"), "Ruta 2 presente");
ok(textoRutas.includes("Travesía Zapadores - Pedro de Valdivia"), "Ruta 3 presente");
ok(textoRutas.includes("Circuito La Pirámide - Anfiteatro"), "Ruta 4 presente");
ok(textoRutas.includes("Loop Los Gemelos"), "MTB 1 presente");
ok(textoRutas.includes("Enduro Cumbre - Torre 5 - Sendero 4½"), "MTB 2 presente");
ok(textoRutas.includes("km"), "distancias mostradas");

await page.locator('button[data-vercapa="ruta-2"]').click();
await page.waitForTimeout(1200);
const rutasDibujadas = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll(".leaflet-overlay-pane svg path"));
  return {
    pavimento: paths.filter((p) => p.getAttribute("stroke") === "#0ea5e9").length,
    casing: paths.filter((p) => p.getAttribute("stroke") === "#05070a").length,
  };
});
ok(rutasDibujadas.pavimento >= 1, `Ruta 2 dibujada en azul pavimento (paths: ${rutasDibujadas.pavimento})`);
ok(rutasDibujadas.casing >= 1, "casing oscuro de la ruta presente");
const badgeDibujadas = await page.locator('details[data-capa="rutas"] summary').textContent();
ok(badgeDibujadas.includes("1 dibujadas"), "badge '1 dibujadas' en el menú Rutas");

// ---------- 6. Puntos de Interés: 12 marcadores ----------
await page.locator('details[data-capa="pois"] summary').click();
await page.waitForTimeout(400);
await page.locator('button[data-vercapa="pois"]').click();
await page.waitForTimeout(900);
const poisTexto = await page.locator('details[data-capa="pois"]').textContent();
ok(poisTexto.includes("Plaza México (Cumbre)"), "POI Plaza México presente");
ok(poisTexto.includes("Anfiteatro Pablo Neruda"), "POI Anfiteatro presente");
ok(poisTexto.includes("Piscina Antilén"), "POI Piscina Antilén presente");
ok(poisTexto.includes("Precaución: Zoológico Nacional"), "POI precaución Zoológico presente");
ok(poisTexto.includes("Puntos de conexión"), "grupo Puntos de conexión");
ok(poisTexto.includes("Servicio y descanso"), "grupo Servicio y descanso");
ok(poisTexto.includes("Miradores"), "grupo Miradores");
ok(poisTexto.includes("Precaución peatonal"), "grupo Precaución peatonal");
const marcadores = await page.evaluate(() => document.querySelectorAll(".leaflet-marker-pane .c30-billboard").length);
ok(marcadores === 12, `12 marcadores de POI en el mapa (hay ${marcadores})`);

// ---------- 7. Normativa y Conexión Urbana ----------
await page.locator('details[data-capa="normativa"] summary').click();
await page.waitForTimeout(300);
await page.locator('button[data-vercapa="normativa"]').click();
await page.waitForTimeout(900);
const normTexto = await page.locator('details[data-capa="normativa"]').textContent();
ok(normTexto.includes("Corte horario fin de semana"), "normativa corte Tupahue presente");
ok(normTexto.includes("Control velocidad máx. 30 km/h"), "normativa control 30 km/h presente");
ok(normTexto.includes("Control QR obligatorio MTB"), "normativa QR MTB presente");
ok(normTexto.includes("Punto soporte"), "puntos de soporte presentes");
await page.locator('details[data-capa="urbana"] summary').click();
await page.waitForTimeout(300);
await page.locator('button[data-vercapa="urbana"]').click();
await page.waitForTimeout(900);
const urbTexto = await page.locator('details[data-capa="urbana"]').textContent();
ok(urbTexto.includes("Metro Baquedano"), "urbana Metro Baquedano presente");
ok(urbTexto.includes("Metro Zapadores"), "urbana Metro Zapadores presente");
ok(urbTexto.includes("Ciclovía Andrés Bello"), "urbana ciclovía Andrés Bello presente");
const marcadores2 = await page.evaluate(() => document.querySelectorAll(".leaflet-marker-pane .c30-billboard").length);
ok(marcadores2 === 24, `12 POI + 6 normativa + 6 urbana = 24 marcadores (hay ${marcadores2})`);

// ---------- 8. Ocultar una ruta se quita del mapa ----------
/** Abre un menú de capas solo si está cerrado (clickear un abierto lo cierra). */
const abrirMenu = async (id) => {
  const det = page.locator(`details[data-capa="${id}"]`);
  if (!(await det.getAttribute("open") !== null)) {
    await det.locator("summary").click();
    await page.waitForTimeout(350);
  }
};

await abrirMenu("rutas");
await page.locator('button[data-vercapa="ruta-2"]').click(); // ocultar
await page.waitForTimeout(600);
const trasOcultar = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll(".leaflet-overlay-pane svg path"));
  return paths.filter((p) => p.getAttribute("stroke") === "#0ea5e9").length;
});
ok(trasOcultar === 0, "al ocultar la ruta, la línea azul desaparece del mapa");

// ---------- capturas ----------
await abrirMenu("rutas");
await page.locator('button[data-vercapa="ruta-2"]').click(); // volver a dibujar
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/capas-rutas.png` });

// abre los 5 menús para la captura del panel completo
for (const id of ["accesos", "pois", "normativa", "urbana"]) {
  await abrirMenu(id);
}
await page.screenshot({ path: `${OUT}/capas-panel.png` });

await browser.close();
console.log(fallos === 0 ? "CAPAS_OK" : `CAPAS_CON_${fallos}_FALLOS`);
