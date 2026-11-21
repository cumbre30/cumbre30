// ============================================================
// Smoke UI invitado (2026-11-21): el muro público es para usuarios
// con sesión (política de invitado: solo el mapa es libre), así que
// el navegador anónimo debe: cargar /, renderizar el mapaExplorar
// sin errores de consola ni pageerror. Contra el standalone :3100.
//   node scripts/invivo-smoke-invitado.mjs
// ============================================================
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

const BASE = process.env.VIVO_BASE ?? "http://127.0.0.1:3100";
const errores = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await sleep(6000); // hidratación + carga del mapa

  const titulo = await page.title();
  const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);
  console.log(`  título: ${titulo}`);
  console.log(`  texto visible (primeras líneas): ${body.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);

  if (errores.length) {
    console.error("✗ errores:");
    console.error(errores.map((e) => `  ✗ ${e}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("  ✓ sin errores de consola ni pageerror (invitado)");
  }
  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
