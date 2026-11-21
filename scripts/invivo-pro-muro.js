// Verificación in-vivo (2026-11-21) de la PROPUESTA PRO del muro
// (olas 1-3) sobre el build de producción local + PostgreSQL real:
//   · FREE: filtros y compartir abren el modal Pro; sin panel de aporte Pro.
//   · Pro: distintivo en su tarjeta, filtros sin modal, tarjeta PNG
//     descargada, panel de aporte con export CSV, etiqueta de
//     novedades en rutas guardadas.
// 0 errores de aplicación en consola.
"use strict";
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const { PrismaClient } = require("@prisma/client");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const GEO = { latitude: -33.43721, longitude: -70.6418 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3000/?gps=1";
// El require de @prisma/client autocarga el .env del repo (SQLite de
// desarrollo) y pisa process.env.DATABASE_URL: este arnés SIEMPRE
// apunta al PostgreSQL local de pruebas, explícito.
const DB = process.env.DATABASE_URL_INVIVO || "postgresql://postgres@127.0.0.1:5433/cumbre30";
let pasos = 0;
let fallos = 0;
function ok(nombre, cond) {
  pasos++;
  console.log(`${cond ? "  ✓" : "  ✗"} ${nombre}`);
  if (!cond) fallos++;
}

const RUTA = {
  nombre: "Ruta in-vivo Pro",
  descripcion: "Semilla del ensayo Pro",
  modalidad: "montana",
  coords: [
    { lat: -33.486, lon: -70.53 },
    { lat: -33.489, lon: -70.527 },
    { lat: -33.493, lon: -70.524 },
    { lat: -33.497, lon: -70.521 },
  ],
  attrs: ["desafiante"],
  dificultadFisica: 4,
  dificultadTecnica: 3,
  proteccion: { recorteIniM: 150, recorteFinM: 150, snapInicio: true },
  ele: { gainM: 640, lossM: 638, minEle: 812, maxEle: 1452 },
  eleFuente: "gpx",
  pois: [],
  clientId: `cli-invivopro-${Date.now()}`,
};

async function main() {
  // ---------- semillas: dos ciclistas + compra registrada ----------
  const ts = Date.now();
  const emailPro = `muro-invivo-pro-${ts}@test.local`;
  const emailFree = `muro-invivo-free-${ts}@test.local`;
  const usernamePro = `ivp${String(ts).slice(-6)}`;
  async function alta(email, username, password) {
    // El auth tiene rate-limit por IP: reintento con pausa evita
    // falsos negativos cuando las cuatro llamadas van seguidas.
    for (const pausa of [0, 1500, 3000]) {
      if (pausa) await sleep(pausa);
      await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, terminos: true, edad14: true }),
      }).catch(() => undefined);
      await sleep(150);
      const login = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch(() => undefined);
      const mCookie = login ? (login.headers.get("set-cookie") || "").match(/cumbre30_session=([^;]+)/) : null;
      const token = (mCookie && mCookie[1]) || null;
      if (token) return token;
    }
    return null;
  }
  const tokPro = await alta(emailPro, usernamePro, "prueba-pro-2026");
  const tokFree = await alta(emailFree, `ivf${String(ts).slice(-6)}`, "prueba-free-2026");
  ok("semilla: dos cuentas con sesión", Boolean(tokPro && tokFree));

  const db = new PrismaClient({ datasourceUrl: DB });
  await db.proDelivery.create({ data: { paymentId: `pay-invivo-${ts}`, email: emailPro, code: "x", amount: 7650, via: "manual" } });
  await db.$disconnect();
  ok("semilla: compra Pro registrada (ProDelivery)", true);

  const H = { "Content-Type": "application/json", Authorization: `Bearer ${tokPro}` };
  const rutaRes = await fetch("http://localhost:3000/api/routes", { method: "POST", headers: H, body: JSON.stringify(RUTA) });
  const rutaD = await rutaRes.json();
  ok("semilla: ruta publicada", rutaRes.status === 200 && Boolean(rutaD.id));
  const hoy = new Date().toISOString().slice(0, 10);
  const expSeed = await fetch(`http://localhost:3000/api/routes/${rutaD.id}/experience`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ fechaRealizacion: hoy, comentario: "El autor Pro deja su huella en el muro.", condiciones: ["barro", "sombra"] }),
  });
  const favSeed = await fetch(`http://localhost:3000/api/routes/${rutaD.id}/favorite`, { method: "POST", headers: H });
  ok(`semilla: experiencia Pro (${expSeed.status}) + favorita (${favSeed.status})`, expSeed.status === 200 && (favSeed.status === 200 || favSeed.status === 201));

  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const erroresDe = async (ctx) => {
    const errores = [];
    return { errores };
  };

  // ================= A) PRO: todo desbloqueado =================
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: GEO, permissions: ["geolocation"], locale: "es-CL" });
    await ctx.addCookies([{ name: "cumbre30_session", value: tokPro, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 86_400 }]);
    await ctx.addInitScript(([t, em]) => {
      window.localStorage.setItem("cumbre30-sync-token-v1", JSON.stringify({ token: t, email: em, expiresAt: new Date(Date.now() + 86400000).toISOString() }));
    }, [tokPro, emailPro]);
    const page = await ctx.newPage();
    const errores = [];
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(String(e)));
    page.on("response", (r) => { if (r.status() >= 400) errores.push("HTTP " + r.status() + " " + r.url()); });

    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);
    await page.locator('nav button:has-text("Explorar")').click();
    await sleep(700);
    const expBtn = page.getByRole("tab", { name: "Experiencias", exact: true });
    const limite = Date.now() + 20_000;
    while (Date.now() < limite && !(await expBtn.isVisible().catch(() => false))) {
      await page.getByRole("tab", { name: /Comunidad/ }).click().catch(() => undefined);
      await sleep(600);
    }
    if (!(await expBtn.isVisible().catch(() => false))) {
      const tabsDump = await page.getByRole("tab").allTextContents();
      console.log("  (depuración) tabs:", JSON.stringify(tabsDump.map((x) => x.replace(/\s+/g, " ").slice(0, 45))));
      await page.screenshot({ path: "/tmp/debug-pro.png" });
    }
    await expBtn.click();
    await page.locator('[data-testid="ex-muro-lista"]').waitFor({ state: "visible", timeout: 15000 });
    ok("pro: muro visible con sesión", true);
    ok("pro: distintivo PRO en su tarjeta", (await page.locator('[data-testid="ex-muro-pro"]').count()) >= 1);

    // Filtros SIN modal (Pro): chip barro se activa.
    await page.locator('[data-testid="ex-muro-filtro-barro"]').click();
    await sleep(1200);
    const modalProEnPro = await page.getByText("Organiza el muro con Pro").count();
    ok("pro: filtro por condición se aplica sin modal", modalProEnPro === 0);

    // Tarjeta imagen: con plan Pro descarga el PNG (web → <a download>).
    const descargaPng = page.waitForEvent("download", { timeout: 20000 });
    await page.locator('[data-testid="ex-muro-compartir"]').first().click();
    try {
      const dl = await descargaPng;
      ok(`pro: tarjeta PNG generada (${dl.suggestedFilename()})`, dl.suggestedFilename().endsWith(".png"));
    } catch {
      ok("pro: tarjeta PNG generada", false);
    }

    // Panel de aporte Pro + export CSV.
    await page.getByRole("tab", { name: "Mi aporte", exact: true }).click();
    await page.locator('[data-testid="ex-aporte-pro"]').waitFor({ state: "visible", timeout: 15000 });
    ok("pro: panel «Mis experiencias · Pro» con contadores", true);
    const descargaCsv = page.waitForEvent("download", { timeout: 20000 });
    await page.locator('[data-testid="ex-aporte-exportar"]').click();
    try {
      const dl = await descargaCsv;
      ok(`pro: export CSV descargado (${dl.suggestedFilename()})`, dl.suggestedFilename().endsWith(".csv"));
    } catch {
      ok("pro: export CSV descargado", false);
    }

    const noHidr = errores.filter((e) => /418|hydrat|did not match/i.test(e));
    const noOtros = errores.filter((e) => !/418|hydrat|did not match/i.test(e) && !/accounts\.google\.com|GSI_LOGGER/.test(e) && !/\b40[13]\b/.test(e));
    ok("pro: 0 errores de hidratación", noHidr.length === 0);
    ok(`pro: consola limpia (${noOtros.length === 0 ? "0" : noOtros[0].slice(0, 80)})`, noOtros.length === 0);
    await ctx.close();
  }

  // ================= B) NOVEDADES (Pro recarga) =================
  {
    // El free registra una experiencia NUEVA en la ruta favorita del
    // pro DESPUÉS de que el primer chequeo fijó vistoAt.
    const expRes = await fetch(`http://localhost:3000/api/routes/${rutaD.id}/experience`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokFree}` },
      body: JSON.stringify({ fechaRealizacion: hoy, comentario: "Novedad fresca para el dueño de la ruta.", condiciones: [] }),
    });
    ok("semilla: experiencia nueva del free en la ruta favorita", expRes.status === 200);

    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: GEO, permissions: ["geolocation"], locale: "es-CL" });
    await ctx.addCookies([{ name: "cumbre30_session", value: tokPro, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 86_400 }]);
    await ctx.addInitScript(([t, em]) => {
      window.localStorage.setItem("cumbre30-sync-token-v1", JSON.stringify({ token: t, email: em, expiresAt: new Date(Date.now() + 86400000).toISOString() }));
    }, [tokPro, emailPro]);
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);
    await page.locator('nav button:has-text("Explorar")').click();
    await sleep(700);
    const expBtn = page.getByRole("tab", { name: "Experiencias", exact: true });
    const limite = Date.now() + 20_000;
    while (Date.now() < limite && !(await expBtn.isVisible().catch(() => false))) {
      await page.getByRole("tab", { name: /Comunidad/ }).click().catch(() => undefined);
      await sleep(600);
    }
    await expBtn.click();
    try {
      await page.locator('[data-testid="ex-muro-novedades"]').waitFor({ state: "visible", timeout: 15000 });
      const txt = await page.locator('[data-testid="ex-muro-novedades"]').textContent();
      ok(`novedades: etiqueta visible («${(txt || "").trim()}»)`, /1 nuevas/.test(txt || ""));
    } catch {
      ok("novedades: etiqueta visible", false);
    }
    await ctx.close();
  }

  // ================= C) FREE: modal Pro y sin panel =================
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: GEO, permissions: ["geolocation"], locale: "es-CL" });
    await ctx.addCookies([{ name: "cumbre30_session", value: tokFree, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 86_400 }]);
    await ctx.addInitScript(([t, em]) => {
      window.localStorage.setItem("cumbre30-sync-token-v1", JSON.stringify({ token: t, email: em, expiresAt: new Date(Date.now() + 86400000).toISOString() }));
    }, [tokFree, emailFree]);
    const page = await ctx.newPage();
    const errores = [];
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(String(e)));
    page.on("response", (r) => { if (r.status() >= 400) errores.push("HTTP " + r.status() + " " + r.url()); });

    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);
    await page.locator('nav button:has-text("Explorar")').click();
    await sleep(700);
    const expBtn = page.getByRole("tab", { name: "Experiencias", exact: true });
    const limite = Date.now() + 20_000;
    while (Date.now() < limite && !(await expBtn.isVisible().catch(() => false))) {
      await page.getByRole("tab", { name: /Comunidad/ }).click().catch(() => undefined);
      await sleep(600);
    }
    await expBtn.click();
    await page.locator('[data-testid="ex-muro-lista"]').waitFor({ state: "visible", timeout: 15000 });
    ok("free: muro visible (feed completo, gratis)", true);

    await page.locator('[data-testid="ex-muro-filtro-barro"]').click();
    await page.getByText("Organiza el muro con Pro").waitFor({ state: "visible", timeout: 8000 });
    ok("free: filtro → modal Pro honesto", true);
    await page.keyboard.press("Escape");
    await sleep(400);

    const descargaPng = page.waitForEvent("download", { timeout: 6000 });
    await page.locator('[data-testid="ex-muro-compartir"]').first().click();
    let freeDescargo = true;
    try {
      await descargaPng;
    } catch {
      freeDescargo = false;
    }
    const modalTrasShare = await page.getByText("Organiza el muro con Pro").count();
    ok("free: compartir → modal Pro y sin descarga", modalTrasShare > 0 && !freeDescargo);

    await page.getByRole("tab", { name: "Mi aporte", exact: true }).click();
    await sleep(800);
    ok("free: sin panel Pro de aporte", (await page.locator('[data-testid="ex-aporte-pro"]').count()) === 0);

    const noHidr = errores.filter((e) => /418|hydrat|did not match/i.test(e));
    const noOtros = errores.filter((e) => !/418|hydrat|did not match/i.test(e) && !/accounts\.google\.com|GSI_LOGGER/.test(e) && !/\b40[13]\b/.test(e));
    ok("free: 0 errores de hidratación", noHidr.length === 0);
    ok(`free: consola limpia (${noOtros.length === 0 ? "0" : noOtros[0].slice(0, 80)})`, noOtros.length === 0);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nIN-VIVO PRO/FREE MURO: ${pasos - fallos}/${pasos} OK`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
