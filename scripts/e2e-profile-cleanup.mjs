// E2E navegador — Limpieza de Perfil (subsección Amigos fuera + botón
// de descarga APK fuera).
//   1) Sin sesión: NO existe la subsección "Amigos" ni el botón
//      "Descargar Cumbre30" (el enlace /api/apk desapareció de Perfil).
//   2) Con sesión: las subsecciones de Perfil son solo
//      "Mis datos" y "Pagos y suscripciones".
//   3) La ficha APK muestra la "Versión instalada" (info, sin descarga).
//   4) Sin errores de consola (filtro: 401 de sesiones).
// Correr con el server arriba: node scripts/e2e-profile-cleanup.mjs [BASE]
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.argv[2] || "http://localhost:81";
const STAMP = Date.now().toString(36).slice(-6);
const EMAIL = `qa.prof.${STAMP}@test.cl`;
const USER = `qaprof${STAMP}`;
const PASS = "secreto123";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

const CONSOLE_IGNORE = [/401 \(Unauthorized\)/];

async function openProfile(page, base) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Perfil/ }).click();
  await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });
}

async function main() {
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !CONSOLE_IGNORE.some((r) => r.test(m.text()))) consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.setDefaultTimeout(30_000);

  // ---------- Sin sesión ----------
  await openProfile(page, BASE);
  const amigosVisibles = await page.getByRole("button", { name: "Amigos" }).isVisible().catch(() => false);
  chk("sin sesión: no hay subsección 'Amigos'", !amigosVisibles);
  const descargaVisible = await page.getByRole("button", { name: /Descargar Cumbre30/ }).isVisible().catch(() => false);
  chk("sin sesión: no hay botón 'Descargar Cumbre30'", !descargaVisible);

  // ---------- Con sesión ----------
  // registrar por API y entrar por UI
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: USER, password: PASS }),
  });
  chk("cuenta de prueba creada vía API", reg.ok, (await reg.text()).slice(0, 120));
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASS);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText(`@${USER}`).first().waitFor({ timeout: 15_000 });
  chk("login correcto (Perfil con sesión)", true);

  const tabs = await page.getByRole("tablist", { name: "Subsecciones de Perfil" }).locator("button").allTextContents().catch(() => null);
  if (tabs === null) {
    // fallback: contar botones con esos textos
    const datos = await page.getByRole("button", { name: "Mis datos" }).isVisible().catch(() => false);
    const pagos = await page.getByRole("button", { name: "Pagos y suscripciones" }).isVisible().catch(() => false);
    const amigos = await page.getByRole("button", { name: "Amigos" }).isVisible().catch(() => false);
    chk("con sesión: subsecciones = Mis datos + Pagos", datos && pagos && !amigos, `datos=${datos} pagos=${pagos} amigos=${amigos}`);
  } else {
    chk("con sesión: subsecciones = Mis datos + Pagos", tabs.length === 2 && tabs.some((t) => t.includes("Mis datos")) && tabs.some((t) => t.includes("Pagos")) , JSON.stringify(tabs));
  }
  const amigosConSesion = await page.getByRole("button", { name: "Amigos" }).isVisible().catch(() => false);
  chk("con sesión: no existe 'Amigos'", !amigosConSesion);

  const apkLinks = await page.locator('a[href="/api/apk"]').count();
  chk("con sesión: sin enlace de descarga /api/apk en Perfil", apkLinks === 0, `enlaces=${apkLinks}`);
  const versionInfo = await page.getByText(/Versión instalada en este teléfono/).first().isVisible().catch(() => false);
  chk("con sesión: ficha muestra 'Versión instalada'", versionInfo);

  await page.screenshot({ path: "/tmp/render/perfil-limpio.png" });

  chk("sin errores de consola", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  console.log(fails ? `\n${fails} FAIL` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
