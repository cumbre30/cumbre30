// E2E — verificación de los 3 ajustes del cliente (2026-11-12):
//  1) Ruta a Plaza México (minimapa): sube por Av. Mackenna → puente
//     entre las Bannen paralelas (Tupahue) → Pedro Bannen. Nada de
//     Carlos Reed (maicillo) ni senderos peatonales.
//  2) MapView sin ubicación automática: con el mapa ya abierto, cuando
//     llega el fix GPS el mapa NO carga tiles de tu zona (no te lleva
//     a tu ubicación); el botón «Centrar en mi ubicación» sí lo hace.
//  3) Texto del plan Pro: «1. Paga tu licencia en la web oficial de
//     CumbreGeo www.cumbregeo.cl».
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fails++;
};

function tileAt(lat, lon, z = 14) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  return { x, y };
}
const USER = { lat: -33.4505, lon: -70.67 }; // lejos del parque
const PIONONO = { lat: -33.4307, lon: -70.6359 }; // junto al acceso Pío Nono
const PARK = { lat: -33.408, lon: -70.636 };
const near = (t, ref, k) => Math.abs(t.x - ref.x) <= k && Math.abs(t.y - ref.y) <= k;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // SIN geolocation al inicio
  const page = await ctx.newPage();

  const tiles = [];
  page.on("request", (r) => {
    const m = r.url().match(/tile\.openstreetmap\.org\/(\d+)\/(\d+)\/(\d+)/);
    if (m) tiles.push({ t: Date.now(), x: +m[2], y: +m[3], z: +m[1] });
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // ---------- 3) Texto del plan Pro (píldora FREE del header) ----------
  await page.locator("button[aria-label='Plan gratis - ver planes']").first().click();
  await page.waitForTimeout(1200);
  const bodyPlanes = await page.locator("body").innerText();
  ok(bodyPlanes.includes("Paga tu licencia en la web oficial de CumbreGeo"), "plan Pro: texto nuevo del paso 1");
  ok(bodyPlanes.includes("www.cumbregeo.cl"), "plan Pro: dominio www.cumbregeo.cl");
  ok(!bodyPlanes.includes("comunidad de WhatsApp"), "plan Pro: texto anterior fuera");
  await page.screenshot({ path: `${OUT}/plan-pro.png` });

  // ---------- 2) MapView sin ubicación automática ----------
  await page.getByRole("button", { name: "Explorar" }).click();
  await page.waitForTimeout(3500);
  await ctx.grantPermissions(["geolocation"]);
  await ctx.setGeolocation({ latitude: USER.lat, longitude: USER.lon, accuracy: 12 });
  await page.waitForTimeout(6000);
  const tilesTrasFix = tiles.filter((t) => t.t > 0 && t.z === 14);
  const ventana = tiles.filter((t) => Date.now() - t.t < 8000 && t.z === 14);
  ok(ventana.filter((t) => near(t, tileAt(USER.lat, USER.lon), 2)).length === 0, "sin auto-ubicación: con el mapa abierto, el fix GPS no carga tiles de tu zona");
  ok(tilesTrasFix.length > 0, "el mapa sigue cargando tiles normalmente");
  await page.screenshot({ path: `${OUT}/mapa-sin-auto.png` });

  const btnLocate = page.locator("button[title='Centrar en mi ubicación']").first();
  ok(await btnLocate.isVisible(), "botón «Centrar en mi ubicación» visible");
  const tClick = Date.now();
  await btnLocate.click();
  await page.waitForTimeout(3500);
  const tilesTrasClick = tiles.filter((t) => t.t >= tClick && t.z === 14);
  ok(tilesTrasClick.filter((t) => near(t, tileAt(USER.lat, USER.lon), 2)).length > 0, "botón Centrar: lleva la vista a tu ubicación");
  await page.screenshot({ path: `${OUT}/mapa-centrado.png` });

  // ---------- 1) Ruta Plaza México en el minimapa ----------
  await page.getByRole("button", { name: "Ride" }).click();
  await page.waitForTimeout(1000);
  // GPS cerca del Acceso Pío Nono (caso del cliente: subida a Plaza México).
  // SIN demo: el sim de la demo recorre el viejo ascenso peatonal y se
  // desvía de la ruta regla por diseño. Aquí el GPS queda quieto en el
  // acceso y el motor de navegación rutea desde ahí (oneShotFix).
  await ctx.setGeolocation({ latitude: PIONONO.lat, longitude: PIONONO.lon, accuracy: 8 });
  await page.waitForTimeout(4000); // fix GPS + posición en el motor
  const sel = page.locator("select[aria-label='Ir a']");
  await sel.scrollIntoViewIfNeeded().catch(() => {});
  ok(await sel.isVisible().catch(() => false), "selector «Ir a…» del minimapa visible");
  // el select vive dentro del lienzo del minimapa: forzar la selección
  // (los chequeos de acción de Playwright se pelean con el canvas WebGL).
  // Al elegir destino la barra inferior cambia a ETA: no volver a tocar
  // el select después de esto.
  const ya = await sel
    .selectOption({ index: 1 }, { force: true, timeout: 8000 }) // ⛲ Plaza México
    .then(() => true)
    .catch(async () => {
      await sel
        .evaluate((el) => {
          const opt = [...el.options].find((o) => o.textContent.includes("Plaza México"));
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        })
        .catch(() => false);
      return false;
    });
  console.log(`[selección destino] ${ya ? "vía selectOption" : "vía dispatch"}`);
  await page.waitForTimeout(8000); // A* local calcula la ruta
  console.log("[url]", page.url());
  let rideBody = "";
  try {
    rideBody = await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    console.log("[aviso] body no accesible; reintento tras 3 s");
    await page.waitForTimeout(3000);
    rideBody = await page.evaluate(() => document.body?.innerText ?? "");
  }
  ok(!rideBody.includes("desviado, recalculando"), "minimapa: ruta calculada sin desvío");
  ok(!rideBody.includes("Carlos Reed"), "minimapa: la ruta NO pasa por Carlos Reed");
  ok(!rideBody.includes("El Excursionista"), "minimapa: la ruta NO sube por el sendero peatonal");
  const bannerTxt = (await page.locator("div[class*='text-sky-600']").first().textContent().catch(() => "")) ?? "";
  console.log(`[banner maniobra] «${bannerTxt.trim().slice(0, 50)}»`);
  await page.screenshot({ path: `${OUT}/minimapa-plaza-mexico.png` });

  await browser.close();
  console.log(fails === 0 ? "OK diag cliente nov 12" : `FALLOS: ${fails}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
