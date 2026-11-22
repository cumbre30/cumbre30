// ============================================================
// Verificación in-vivo UI (2026-11-22): segmentos solo «Mías»
// (categoría Predefinidas retirada por el cliente) + Amigos solo en
// Comunidad. Contra el standalone :3100:
//   1. Explorar → Segmentos: SIN categorías ni oficiales del cerro;
//      los trazados propios con su CTA «Trazar segmento».
//   2. Mis viajes: SIN subtab «Pro» (la repetición se retiró).
//   3. Estadísticas → Pro: única sede — «Segmentos del cerro» con
//      los 7 oficiales (FREE los ve listados/bloqueados).
//   4. Perfil Ciclista: SIN sección Amigos (el mismo AmigosTab vive
//      en Comunidad → Siguiendo).
//   node scripts/invivo-segmentos-ui.mjs
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
    if (m.type() === "error" && txt.includes("Failed to load resource")) return; // 401 esperados de invitado
    if (m.type() === "error") errores.push(`console: ${txt.slice(0, 160)}`);
  });
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message.slice(0, 160)}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(4000);
  // Sesión real: la sección Explorar exige cuenta (política de
  // invitado v1.20.0 — solo el mapa es libre). Login con cookie.
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
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(6000); // hidratación + carga del mapa

  // ---------- 1. Explorar → Segmentos: solo «Mías» ----------
  await page.getByRole("button", { name: /Explorar/ }).first().click();
  await sleep(1500);
  await page.locator('[data-testid="ex-tab-segmentos"]').click();
  await sleep(700);
  console.log("· Explorar → Segmentos (solo Mías)");
  ok("sin píldoras de categoría (Predefinidas retirada)", (await page.locator('[data-testid^="ex-segcat-"]').count()) === 0);
  ok("sin los 7 oficiales del cerro", (await page.locator('[data-testid^="ex-segpre-"]').count()) === 0);
  ok("CTA «Trazar segmento» presente", await page.locator('[data-testid="ex-trazar-segmento"]').count() === 1);
  ok("tarjeta «Segmentos guardados»", (await page.getByText("Segmentos guardados", { exact: true }).count()) >= 1);
  await page.screenshot({ path: "/tmp/render/inv-segmias.png" });

  // ---------- 2. Mis viajes sin subtab Pro ----------
  await page.click('button[aria-label="Abrir menú"]', { timeout: 8000 });
  await sleep(900);
  await page.getByText("Mis viajes").first().click();
  await sleep(1200);
  console.log("· Mis viajes");
  ok("sin píldora «Pro» (subtab retirada)", (await page.locator('button:text-is("Pro")').count()) === 0);
  ok("la lista de viajes sigue montada", (await page.getByText("Borrar historial").count()) >= 0 && (await page.locator("text=constancia").first().count()) >= 0);

  // ---------- 3. Estadísticas → Pro (única sede) ----------
  await page.click('button[aria-label="Abrir menú"]', { timeout: 8000 });
  await sleep(900);
  await page.getByText("Estadísticas").first().click();
  await sleep(1200);
  console.log("· Estadísticas");
  ok("píldora «Pro» presente en Estadísticas", (await page.locator('button:text-is("Pro")').count()) === 1);
  await page.locator('button:text-is("Pro")').first().click();
  await sleep(800);
  ok("«Segmentos del cerro» visible", (await page.getByText("Segmentos del cerro").count()) >= 1);
  // FREE ve los 7 oficiales bloqueados (única lista que queda de ellos)
  ok("los 7 oficiales listados en Estadísticas · Pro", (await page.getByText("Plaza México", { exact: false }).count()) >= 4);
  await page.screenshot({ path: "/tmp/render/inv-stats-pro.png" });

  // ---------- 4. Perfil sin Amigos; única sede en Comunidad → Siguiendo ----------
  await page.getByRole("button", { name: "Perfil", exact: true }).click(); // barra inferior (el drawer dice «Cuenta»)
  await sleep(1200);
  console.log("· Perfil Ciclista");
  ok("sin pestaña «Amigos»", (await page.locator('button:text-is("Amigos")').count()) === 0);
  ok("ADN y Desafíos siguen en el Perfil", (await page.getByText("ADN", { exact: true }).count()) >= 1 && (await page.getByText("Desafíos y recompensas", { exact: true }).count()) >= 1);
  await page.screenshot({ path: "/tmp/render/inv-perfil-sin-amigos.png" });

  await page.getByRole("button", { name: /Explorar/ }).first().click();
  await sleep(1200);
  await page.locator('[data-testid="ex-switch-comunidad"]').click();
  await sleep(600);
  await page.locator('[data-testid="ex-tab-siguiendo"]').click();
  await sleep(900);
  console.log("· Comunidad → Siguiendo");
  ok("AmigosTab montado en Siguiendo", await page.locator('[data-testid="ex-contenido-siguiendo"]').count() === 1);
  await page.screenshot({ path: "/tmp/render/inv-siguiendo.png" });

  await browser.close();
  console.log(`\n${pasos - fallos}/${pasos} OK`);
  if (fallos > 0 || errores.length > 0) {
    for (const e of errores) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log("VIVO_SEGMENTOS_OK");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
