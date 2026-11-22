// Verificación puntual (2026-11-22): /geo?agregar=usuario aterriza en
// Explorar → Comunidad → Siguiendo (AmigosTab) con el nombre prellenado,
// también SIN sesión (el panel honesto no debe taparlo).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

const BASE = process.env.VIVO_BASE ?? "http://127.0.0.1:3100";
const QUIEN = "amigoInvita";
const errores = [];
let pasos = 0;
let fallos = 0;
const ok = (n, c) => { pasos++; console.log(`  ${c ? "✓" : "✗"} ${n}`); if (!c) fallos++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: "es-CL" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message.slice(0, 160)}`));

  // SIN sesión: la invitación debe abrir Siguiendo con AmigosTab (y su CTA de iniciar sesión)
  await page.goto(`${BASE}/?agregar=${QUIEN}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(5000);
  ok("la invitación abre Comunidad → Siguiendo", await page.locator('[data-testid="ex-contenido-siguiendo"]').count() === 1);
  ok("sin panel de sesión requerida encima", (await page.locator("text=Inicia sesión para explorar").count()) === 0);
  ok("el nombre del invitador aparece (banner/campo)", (await page.getByText(QUIEN, { exact: false }).count()) >= 1);
  await page.screenshot({ path: "/tmp/render/inv-invitacion.png" });

  // CON sesión: mismo aterrizaje, campo prellenado
  await page.evaluate(async () => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "vivo-seg@test.local", password: "pedalea-seguro-30" }),
      credentials: "include",
    });
  });
  await page.goto(`${BASE}/?agregar=${QUIEN}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(5000);
  ok("con sesión también aterriza en Siguiendo", await page.locator('[data-testid="ex-contenido-siguiendo"]').count() === 1);
  const campo = await page.locator('input').evaluateAll((els, q) => els.some((e) => e.value === q), QUIEN);
  ok("campo de amigo prellenado con el nombre", campo);
  await page.screenshot({ path: "/tmp/render/inv-invitacion-sesion.png" });

  await browser.close();
  console.log(`\n${pasos - fallos}/${pasos} OK`);
  if (fallos > 0 || errores.length > 0) {
    for (const e of errores) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log("VIVO_INVITACION_OK");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
