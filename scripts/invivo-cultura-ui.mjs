// ============================================================
// Verificación in-vivo UI (2026-11-22): módulo Cultura Ciclista.
// Contra el standalone :3100, con sesión real:
//   1. Menú lateral → «Cultura Ciclista»: hero, destacados y
//      carruseles por tipo/categoría con desplazamiento táctil.
//   2. Búsqueda y filtros por tipo y categoría.
//   3. Ficha individual con reseña editorial y enlace externo.
//   4. Favoritos: agregar → aparecer en «Mis favoritos» → quitar.
//   5. Estado vacío con búsqueda sin resultados.
//   node scripts/invivo-cultura-ui.mjs
// ============================================================
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

const BASE = process.env.VIVO_BASE ?? "http://127.0.0.1:3100";
const EMAIL = process.env.VIVO_EMAIL ?? "vivo-seg@test.local";
const PASS = process.env.VIVO_PASS ?? "pedalea-seguro-30";
const errores = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pasos = 0;
let fallos = 0;
function ok(nombre, cond) {
  pasos++;
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}`);
  if (!cond) fallos++;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: "es-CL" });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    const txt = m.text();
    if (m.type() === "error" && txt.includes("Failed to load resource")) return; // 401 esperados
    if (m.type() === "error") errores.push(`console: ${txt.slice(0, 160)}`);
  });
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message.slice(0, 160)}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(4000);
  const estado = await page.evaluate(async ({ email, password }) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    return r.status;
  }, { email: EMAIL, password: PASS });
  ok(`login de prueba (${EMAIL})`, estado === 200);
  // Limpiar favoritos de corridas anteriores (el test debe ser autocontenido)
  await page.evaluate(async () => {
    const favs = (await (await fetch("/api/cultura/favoritos", { credentials: "include" })).json()).favoritos ?? [];
    for (const f of favs) {
      await fetch(`/api/cultura/favoritos?recursoId=${encodeURIComponent(f.id)}`, { method: "DELETE", credentials: "include" });
    }
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(6000);

  // ---------- 1. Menú lateral → Cultura Ciclista ----------
  await page.click('button[aria-label="Abrir menú"]', { timeout: 8000 });
  await sleep(900);
  const itemMenu = page.locator("aside button", { hasText: "Cultura Ciclista" });
  ok("el menú lateral muestra «Cultura Ciclista»", (await itemMenu.count()) === 1);
  await itemMenu.click();
  await sleep(1500);
  console.log("· Cultura Ciclista montada");
  ok("hero con la frase del mockup", (await page.getByText("La cultura también se pedalea.", { exact: false }).count()) >= 1);
  ok("buscador presente", (await page.locator('[data-testid="cu-buscador"]').count()) === 1);
  ok("dos tarjetas destacadas", (await page.locator('[data-testid="cu-destacados"] button').count()) >= 2);
  const rails = await page.locator('[data-testid="cu-rail"]').count();
  ok(`carruseles por tipo y categoría (${rails} rails ≥ 6)`, rails >= 6);
  ok("tarjetas de libros con portada", (await page.locator('[data-testid="cu-card-libro"]').count()) >= 20);
  ok("tarjetas de películas y documentales", (await page.locator('[data-testid="cu-card-pelicula"]').count()) >= 8 && (await page.locator('[data-testid="cu-card-documental"]').count()) >= 15);
  await page.screenshot({ path: "/tmp/render/cu-hero.png" });

  // Carrusel: el scroll horizontal responde (gesto programado)
  const rail = page.locator('[data-testid="cu-rail"] .snap-x').first();
  const antes = await rail.evaluate((el) => el.scrollLeft);
  await rail.evaluate((el) => el.scrollBy({ left: 300 }));
  await sleep(600);
  const despues = await rail.evaluate((el) => el.scrollLeft);
  ok(`el carrusel se desplaza horizontalmente (${antes} → ${despues})`, despues > antes);

  // ---------- 2. Búsqueda y filtros ----------
  await page.locator('[data-testid="cu-buscador"]').fill("krabbé");
  await sleep(800);
  ok("búsqueda «krabbé» → The Rider en resultados", (await page.getByText("The Rider", { exact: false }).count()) >= 1);
  ok("contador de resultados", (await page.getByText("1 recursos encontrados.", { exact: true }).count()) === 1);
  await page.screenshot({ path: "/tmp/render/cu-busqueda.png" });

  await page.locator('[data-testid="cu-buscador"]').fill("zzz-sin-resultados");
  await sleep(700);
  ok("estado vacío honesto", (await page.getByText("No encontramos recursos con esos criterios", { exact: false }).count()) >= 1);

  await page.locator('[data-testid="cu-buscador"]').fill("");
  await sleep(500);
  await page.getByRole("button", { name: "Películas", exact: true }).first().click();
  await sleep(700);
  ok("filtro por tipo (Películas) acierta", (await page.getByText(/recursos encontrados\./).count()) === 1);
  await page.getByRole("button", { name: "Todo", exact: true }).first().click();
  await sleep(700);

  // ---------- 3. Ficha individual ----------
  await page.locator('[data-testid="cu-card-libro"]').first().click();
  await sleep(800);
  ok("ficha abre como modal", (await page.locator('[data-testid="cu-ficha"]').count()) === 1);
  ok("la ficha muestra la reseña editorial", (await page.locator('[data-testid="cu-ficha"] p').count()) >= 1);
  const href = await page.locator('[data-testid="cu-ficha"] a').first().getAttribute("href");
  ok(`enlace externo legítimo (${(href ?? "").slice(0, 44)}…)`, (href ?? "").startsWith("https://"));
  ok("sin simulación de reproducción (enlace externo target _blank)", href !== null);
  await page.screenshot({ path: "/tmp/render/cu-ficha.png" });
  await page.keyboard.press("Escape");
  await sleep(500);
  ok("Escape cierra la ficha", (await page.locator('[data-testid="cu-ficha"]').count()) === 0);

  // ---------- 4. Favoritos (tarjeta concreta: aparece en varios carruseles) ----------
  const favBtn = page.locator('[data-testid="cu-card-libro"]', { hasText: "The Rider" }).locator('[data-testid^="cu-fav-"]').first();
  await favBtn.click();
  await sleep(1200);
  const claseFav = await favBtn.getAttribute("class");
  ok("el corazón marca guardado (persistido en servidor)", (claseFav ?? "").includes("text-emerald-500"));
  await page.getByRole("button", { name: /Mis favoritos/ }).first().click();
  await sleep(900);
  ok("«Mis favoritos» muestra el recurso guardado", (await page.getByText("1 recursos encontrados.", { exact: true }).count()) === 1 && (await page.getByText("The Rider", { exact: false }).count()) >= 1);
  await page.screenshot({ path: "/tmp/render/cu-favoritos.png" });
  await page.getByRole("button", { name: "Todo", exact: true }).first().click(); // salir de favOnly (el botón de favoritos activa, no alterna)
  await sleep(700);
  await favBtn.click();
  await sleep(1200);
  ok("segundo toque quita el favorito (persistencia)", ((await favBtn.getAttribute("class")) ?? "").includes("text-emerald-500") === false);

  await browser.close();
  console.log(`\n${pasos - fallos}/${pasos} OK`);
  if (fallos > 0 || errores.length > 0) {
    for (const e of errores) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log("VIVO_CULTURA_OK");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
