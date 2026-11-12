// E2E — lote de rutas y normativa del cliente (2026-11-12):
//  1) Opciones de ruta del minimapa: 1- Plaza México · 2- Av. Gabriela
//     Mistral · 3- Av. Carlos Martner, ordenadas según la posición del
//     ciclista (sin GPS: orden fijo; con GPS en Tupahue: la más cercana
//     primero).
//  2) Capa Rutas del mapa general: los 9 trazados con distancia real
//     (r1/r2/r5 estaban sin polyline tras un build a medias).
//  3) Capa Normativa y Seguridad: círculos amarillos de advertencia
//     (RISK_ZONES, incl. Salida Pedro de Valdivia en su nueva
//     coordenada) y el corte horario EN el puente de Pedro Bannen.
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

const TUPAHUE = { lat: -33.4171, lon: -70.6235 };

async function main() {
  const browser = await chromium.launch();

  // ---------- 1) Opciones de ruta del minimapa ----------
  // geolocation concedida ANTES de cargar: el watch ambiental recibe fix
  // desde el primer instante (un watch denegado no se recupera solo).
  const ctx1 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: TUPAHUE.lat, longitude: TUPAHUE.lon, accuracy: 10 },
  });
  await ctx1.grantPermissions(["geolocation"]);
  const p1 = await ctx1.newPage();
  await p1.goto(BASE, { waitUntil: "networkidle" });
  await p1.waitForTimeout(4500);
  const sel = p1.locator("select[aria-label='Ir a']");
  await sel.waitFor({ timeout: 15000 });
  // Cliente (2026-11-12 tarde): en el minimapa SOLO los accesos — las
  // opciones de ruta se retiraron del dropdown (siguen como alternativas
  // de voz en el corte horario).
  let opts = await sel.locator("option").allTextContents();
  ok((await sel.locator("optgroup").count()) === 0, "minimapa: sin optgroups (solo accesos)");
  ok(
    opts.filter((t) => t.includes("🚴")).length === 4,
    `minimapa: 4 accesos (${opts.join(" | ")})`
  );
  ok(
    !opts.some((t) => /Plaza México|Gabriela Mistral|Carlos Martner/.test(t)),
    "minimapa: sin opciones de ruta"
  );
  await p1.screenshot({ path: `${OUT}/minimapa-opciones.png` });
  await ctx1.close();

  // sin GPS: el dropdown sigue mostrando solo los accesos
  const ctx1b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p1b = await ctx1b.newPage();
  await p1b.goto(BASE, { waitUntil: "networkidle" });
  await p1b.waitForTimeout(2500);
  const sel1b = p1b.locator("select[aria-label='Ir a']");
  await sel1b.waitFor({ timeout: 15000 });
  opts = await sel1b.locator("option").allTextContents();
  ok(
    opts.filter((t) => t.includes("🚴")).length === 4,
    `sin GPS también solo accesos: ${opts.join(" | ")}`
  );
  await ctx1b.close();

  // ---------- 2) y 3) Mapa general: capas Rutas y Normativa ----------
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE, { waitUntil: "networkidle" });
  await p2.waitForTimeout(2000);
  await p2.getByRole("button", { name: "Explorar" }).click();
  await p2.waitForTimeout(3000);

  // abrir el panel de capas (si viene plegado)
  const panel = p2.getByTestId("capas-panel");
  const rutasSummary = p2.locator("details[data-capa='rutas'] > summary");
  await rutasSummary.scrollIntoViewIfNeeded();
  await rutasSummary.click();
  await p2.waitForTimeout(600);
  const bodyRutas = await panel.innerText();
  ok(/Ruta 1 · Clásica Cumbre por Pedro de Valdivia/.test(bodyRutas), "capa Rutas: Ruta 1 presente");
  ok(/3\.4 km/.test(bodyRutas), `capa Rutas: Ruta 1 con trazado (3.4 km, sube por Av. Abate Molina)`);
  ok(/5\.1 km/.test(bodyRutas), `capa Rutas: Ruta 2 = minimapa Plaza México (5.1 km, nace en la esquina de entrada Pío Nono 2026-11-13)`);
  ok(/4\.6 km/.test(bodyRutas), `capa Rutas: Ruta 3 Zapadores→PdV (4.6 km, SIEMPRE por Av. Abate Molina: Jardín Japonés + Salida PdV, sin Martner)`);
  ok(/3\.1 km/.test(bodyRutas), `capa Rutas: Ruta 4 desde la portería La Pirámide del cliente (3.1 km)`);
  ok(/18\.8 km/.test(bodyRutas), `capa Rutas: Ruta 5 vuelta completa (18.8 km, accesos Pío Nono/La Pirámide del cliente 2026-11-13)`);

  // dibujar Ruta 1 y Ruta 5 (Ver) y contar «dibujadas»
  await p2.locator("button[data-vercapa='ruta-1']").click();
  await p2.locator("button[data-vercapa='ruta-5']").click();
  await p2.waitForTimeout(1200);
  const bodyRutas2 = await panel.innerText();
  ok(/2 dibujadas/.test(bodyRutas2), "capa Rutas: 2 trazados dibujados tras Ver");
  await p2.screenshot({ path: `${OUT}/capa-rutas-dibujadas.png` });

  // Normativa y Seguridad
  const normSummary = p2.locator("details[data-capa='normativa'] > summary");
  await normSummary.scrollIntoViewIfNeeded();
  await normSummary.click();
  await p2.waitForTimeout(600);
  const bodyNorm = await panel.innerText();
  ok(/Corte horario fin de semana \(Tupahue → Cumbre\)/.test(bodyNorm), "Normativa: corte horario presente");
  ok(/Advertencia: Salida Pedro de Valdivia/.test(bodyNorm), "Normativa: círculo amarillo Salida Pedro de Valdivia");
  ok(/Advertencia: Curva Casa de la Cultura Anáhuac/.test(bodyNorm), "Normativa: círculo amarillo Anáhuac");
  ok(/Advertencia: Zoológico Nacional/.test(bodyNorm), "Normativa: círculo amarillo Zoológico");
  // dibujar la capa completa y capturar (círculos amarillos + corte en el puente)
  const switchNorm = p2.locator("button[data-vercapa='normativa']");
  if (await switchNorm.count()) {
    await switchNorm.click();
    await p2.waitForTimeout(1500);
  }
  await p2.screenshot({ path: `${OUT}/capa-normativa.png` });

  // mapa visible con trazados: captura general
  await p2.screenshot({ path: `${OUT}/explorar-final.png` });

  await browser.close();
  console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
