// E2E navegador — Eliminación de cuenta (requisito Google Play):
//   1) La página web /eliminar-cuenta existe y ofrece baja por API.
//   2) La página /privacidad existe (URL obligatoria en Play Console).
//   3) Perfil → Mis datos muestra la zona "Eliminar cuenta" con
//      confirmación en dos pasos y al confirmar el usuario queda
//      sin sesión.
//   4) La cuenta eliminada ya no puede entrar (login falla).
//   5) Sin errores de consola (filtro: 401 de sesiones).
// Correr con el server arriba: node scripts/e2e-delete-account.mjs [BASE]
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.argv[2] || "http://localhost:81";
const STAMP = Date.now().toString(36).slice(-6);
const EMAIL = `qa.del.${STAMP}@test.cl`;
const USER = `qadel${STAMP}`;
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

  // ---------- 1) Página /eliminar-cuenta ----------
  await page.goto(`${BASE}/eliminar-cuenta`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const delPageVisible = await page.getByText("Eliminar cuenta", { exact: true }).first().isVisible().catch(() => false);
  chk("página /eliminar-cuenta accesible", delPageVisible);

  // ---------- 2) Página /privacidad ----------
  await page.goto(`${BASE}/privacidad`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const privVisible = await page.getByText("Política de Privacidad").first().isVisible().catch(() => false);
  chk("página /privacidad accesible", privVisible);

  // ---------- 3) Flujo in-app ----------
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: USER, password: PASS }),
  });
  chk("cuenta de prueba creada vía API", reg.ok, (await reg.text()).slice(0, 120));

  await openProfile(page, BASE);
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASS);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText(`@${USER}`).first().waitFor({ timeout: 15_000 });
  chk("login correcto (Perfil con sesión)", true);

  const zonaVisible = await page.getByText("Eliminar cuenta", { exact: true }).last().isVisible().catch(() => false);
  chk("Mis datos muestra la zona 'Eliminar cuenta'", zonaVisible);

  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  const confirmVisible = await page.getByText("no se puede deshacer").isVisible().catch(() => false);
  chk("confirmación en dos pasos aparece", confirmVisible);

  await page.getByRole("button", { name: "Cancelar" }).click();
  const volvioIdle = await page.getByRole("button", { name: "Eliminar mi cuenta" }).isVisible().catch(() => false);
  chk("Cancelar vuelve al estado inicial", volvioIdle);

  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  // tras la baja, useMe notifica y el Perfil vuelve al estado sin sesión
  await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  const stillLoggedIn = await page.getByText(`@${USER}`).first().isVisible().catch(() => false);
  chk("tras eliminar: sesión cerrada", !stillLoggedIn);

  // ---------- 4) La cuenta ya no existe ----------
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASS);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForTimeout(2_000);
  const loginError = await page.getByText(/incorrectos|No pudimos/i).first().isVisible().catch(() => false);
  const loggedInAgain = await page.getByText(`@${USER}`).first().isVisible().catch(() => false);
  chk("cuenta eliminada: login ya no funciona", loginError && !loggedInAgain, `error=${loginError} logueado=${loggedInAgain}`);

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
