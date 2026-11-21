// Verificación in-vivo (2026-11-21): muro público de experiencias +
// política de invitado (solo mapa libre) + fix de hidratación #418
// al recargar con idioma. Sobre el build de producción local
// (localhost:3000 con PostgreSQL real) y 0 errores de consola.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const GEO = { latitude: -33.43721, longitude: -70.6418 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3000/?gps=1";
let pasos = 0;
let fallos = 0;
function ok(nombre, cond) {
  pasos++;
  console.log(`${cond ? "  ✓" : "  ✗"} ${nombre}`);
  if (!cond) fallos++;
}

const RUTA = {
  nombre: "Ruta in-vivo muro",
  descripcion: "Semilla del ensayo in-vivo del muro",
  modalidad: "montana",
  coords: [
    { lat: -33.486, lon: -70.53 },
    { lat: -33.489, lon: -70.527 },
    { lat: -33.493, lon: -70.524 },
    { lat: -33.497, lon: -70.521 },
  ],
  attrs: ["desafiante", "miradores"],
  dificultadFisica: 4,
  dificultadTecnica: 3,
  proteccion: { recorteIniM: 150, recorteFinM: 150, snapInicio: true },
  ele: { gainM: 640, lossM: 638, minEle: 812, maxEle: 1452 },
  eleFuente: "gpx",
  pois: [],
  clientId: `cli-invivo-${Date.now()}`,
};

async function main() {
  // ---------- semillas por API real: usuario, ruta, experiencia ----------
  const ts = Date.now();
  const email = `muro-invivo-${ts}@test.local`;
  const username = `murovivo${String(ts).slice(-6)}`;
  await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password: "prueba-muro-2026", terminos: true, edad14: true }),
  });
  const login = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "prueba-muro-2026" }),
  });
  const setCookie = login.headers.get("set-cookie") || "";
  const mCookie = setCookie.match(/cumbre30_session=([^;]+)/);
  const loginD = await login.json().catch(() => ({}));
  const token = (loginD && loginD.token) || (mCookie && mCookie[1]);
  ok("semilla: login con token real", Boolean(token));

  const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const rutaRes = await fetch("http://localhost:3000/api/routes", { method: "POST", headers: H, body: JSON.stringify(RUTA) });
  const rutaD = await rutaRes.json();
  ok("semilla: ruta publicada", rutaRes.status === 200 && Boolean(rutaD.id));
  const hoy = new Date().toISOString().slice(0, 10);
  const expRes = await fetch(`http://localhost:3000/api/routes/${rutaD.id}/experience`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      fechaRealizacion: hoy,
      comentario: "Subida exigente; el mirador paga la espera.",
      condiciones: ["barro", "sombra"],
      observacion: "Llevar dos litros de agua.",
    }),
  });
  ok("semilla: experiencia registrada", expRes.status === 200);

  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

  // ================= A) INVITADO: solo lo libre =================
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: GEO, permissions: ["geolocation"], locale: "es-CL" });
    const page = await ctx.newPage();
    const errores = [];
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(String(e)));
    page.on("response", (r) => { if (r.status() >= 400 && r.status() !== 401) errores.push("HTTP " + r.status() + " " + r.url()); });

    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2200);
    ok("invitado: pantalla Ride (mapa) libre, sin panel", (await page.locator('[data-testid="panel-sesion-requerida"]').count()) === 0);

    await page.locator('nav button:has-text("Explorar")').click();
    await sleep(700);
    ok("invitado: Explorar (sub «rutas») → panel honesto", (await page.locator('[data-testid="panel-sesion-requerida"]').count()) === 1);
    await page.locator('[data-testid="panel-sesion-mapa"]').click();
    await sleep(900);
    ok("invitado: «Explorar mapa» sigue libre", (await page.locator('[data-testid="ex-contenido-mapa"]').count()) === 1);

    await page.locator('nav button:has-text("Credencial")').click();
    await sleep(500);
    ok("invitado: Credencial → panel", (await page.locator('[data-testid="panel-sesion-requerida"]').count()) === 1);
    await page.locator('nav button:has-text("Perfil")').click();
    await sleep(500);
    ok("invitado: Perfil Ciclista → panel", (await page.locator('[data-testid="panel-sesion-requerida"]').count()) === 1);

    await page.locator('[data-testid="panel-sesion-cta"]').click();
    await sleep(700);
    ok("invitado: CTA lleva a Cuenta (libre, sin panel)", (await page.locator('[data-testid="panel-sesion-requerida"]').count()) === 0);

    const noHidr = errores.filter((e) => /418|hydrat|did not match/i.test(e));
    // Tolerados del patrón preexistente/externo: 401 de la sonda de
    // sesión en modo invitado; 403 y GSI_LOGGER del botón Google
    // (localhost no es origen autorizado del client ID de producción).
    const noOtros = errores.filter((e) => !/418|hydrat|did not match/i.test(e) && !/\b40[13]\b/.test(e) && !/accounts\.google\.com|GSI_LOGGER/.test(e));
    ok(`invitado: 0 errores de hidratación (hubo ${noHidr.length})`, noHidr.length === 0);
    ok(`invitado: consola limpia (${noOtros.length === 0 ? "0" : noOtros.length + ": " + noOtros[0].slice(0, 90)})`, noOtros.length === 0);
    await ctx.close();
  }

  // ================= B) RECARGA CON IDIOMA: sin #418 =================
  for (const [lang, pista] of [["en", "Explore"], ["pt", "Pedal"]]) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: GEO, permissions: ["geolocation"], locale: lang === "en" ? "en-US" : "pt-BR" });
    await ctx.addInitScript((l) => window.localStorage.setItem("cumbre30-lang", l), lang);
    const page = await ctx.newPage();
    const errores = [];
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(String(e)));
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2200);
    // segunda recarga: el escenario exacto del bug («al recargar con idioma»)
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(2200);
    const hidr = errores.filter((e) => /418|hydrat|did not match/i.test(e));
    ok(`${lang}: recarga con idioma sin #418 (${hidr.length === 0 ? "0" : hidr[0].slice(0, 80)})`, hidr.length === 0);
    ok(`${lang}: UI en el idioma guardado tras el flip`, (await page.locator(`nav button:has-text("${pista}")`).count()) > 0);
    await ctx.close();
  }

  // ================= C) MURO CON SESIÓN REAL =================
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: GEO, permissions: ["geolocation"], locale: "es-CL" });
    // La sesión llega por DOS vías: cookie httpOnly (sonda de useMe y
    // SSR) y token Bearer en localStorage (llamadas del APK/cliente).
    await ctx.addCookies([{ name: "cumbre30_session", value: token, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 86_400 }]);
    await ctx.addInitScript(([t, em]) => {
      window.localStorage.setItem("cumbre30-sync-token-v1", JSON.stringify({ token: t, email: em, expiresAt: new Date(Date.now() + 86400000).toISOString() }));
    }, [token, email]);
    const page = await ctx.newPage();
    const errores = [];
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(String(e)));
    page.on("response", (r) => { if (r.status() >= 400) errores.push("HTTP " + r.status() + " " + r.url()); });

    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);
    await page.locator('nav button:has-text("Explorar")').click();
    await sleep(900);
    ok("sesión: Explorar abre el módulo (sin panel)", (await page.locator('[data-testid="panel-sesion-requerida"]').count()) === 0);
    await page.getByRole("tab", { name: /Comunidad/ }).click();
    // La subnav del módulo son role="tab" (no button); el nombre exacto
    // evita caer en «…comparte experiencias» del conmutador.
    const expBtn = page.getByRole("tab", { name: "Experiencias", exact: true });
    const limite = Date.now() + 20_000;
    while (Date.now() < limite && !(await expBtn.isVisible().catch(() => false))) {
      await page.getByRole("tab", { name: /Comunidad/ }).click().catch(() => undefined);
      await sleep(600);
    }
    await expBtn.click();
    await page.locator('[data-testid="ex-contenido-experiencias"]').waitFor({ state: "visible", timeout: 15000 });
    await page
      .locator('[data-testid="ex-muro-conteo"], [data-testid="ex-contenido-experiencias"] .rounded-2xl')
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    const abierta = await page.locator('[data-testid="ex-contenido-experiencias"]').count();
    if (!abierta) {
      const botones = await page.locator("button").allTextContents();
      console.log("  (depuración) botones visibles:", JSON.stringify(botones.filter((b) => b && b.length < 40).slice(0, 25)));
    }
    const conteo = await page.locator('[data-testid="ex-muro-conteo"]').textContent().catch(() => "");
    ok(`sesión: muro con conteo («${(conteo || "").trim()}» — incluye semillas de corridas previas)`, /\d+ experiencias? de \d+ ciclistas?/i.test(conteo || ""));
    const tarjetas = await page.locator('[data-testid="ex-muro-tarjeta"]').count();
    ok(`sesión: ${tarjetas} tarjeta(s) del muro`, tarjetas >= 1);
    const texto = tarjetas > 0 ? await page.locator('[data-testid="ex-muro-tarjeta"]').first().textContent() : "";
    ok("sesión: tarjeta con username + comentario + ruta", Boolean(texto && texto.includes(username) && texto.includes("mirador") && texto.includes("Ruta in-vivo muro")));
    ok("sesión: chips de condiciones (barro/sombra)", Boolean(texto && texto.includes("barro") && texto.includes("sombra")));
    const noHidr = errores.filter((e) => /418|hydrat|did not match/i.test(e));
    const no4xx = errores.filter((e) => e.startsWith("HTTP"));
    ok(`sesión: 0 errores de hidratación`, noHidr.length === 0);
    ok(`sesión: 0 errores HTTP (${no4xx.length === 0 ? "limpia" : no4xx[0]})`, no4xx.length === 0);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nIN-VIVO MURO/INVITADO/HIDRATACIÓN: ${pasos - fallos}/${pasos} OK`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
