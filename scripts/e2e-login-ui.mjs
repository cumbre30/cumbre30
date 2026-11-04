// E2E navegador — Inicio de sesión desde la UI (Perfil → Mis datos).
//   1) Login con contraseña incorrecta → error visible.
//   2) Login correcto → vista de cuenta con @username.
//   3) Recarga → la sesión persiste (cookie).
//   4) Logout ("Salir") → vuelve el formulario.
//   5) Registro desde la UI → cuenta creada y sesión activa.
//   6) Login con tecla Enter (accesibilidad/UX).
//   7) Mismo flujo a través del proxy del preview (:81).
// Correr con el server arriba: node scripts/e2e-login-ui.mjs
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const PROXY = "http://localhost:81";
const STAMP = Date.now().toString(36).slice(-6);
const EMAIL = `qa.ui.${STAMP}@test.cl`;
const USER = `qaui${STAMP}`;
const PASS = "secreto123";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

async function openProfile(page, base) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Perfil/ }).click();
  await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });
}

async function tryLogin(page, email, password) {
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function main() {
  for (const mail of [EMAIL, `qa.ui.b.${STAMP}@test.cl`]) {
    try { execSync(`node scripts/cleanup-test-user.mjs ${mail}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  }
  // Cuenta pre-creada vía API para probar el LOGIN por UI
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: USER, password: PASS }),
  });
  chk("cuenta de prueba creada vía API", reg.ok, (await reg.text()).slice(0, 120));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const CONSOLE_IGNORE = [/401 \(Unauthorized\)/];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !CONSOLE_IGNORE.some((re) => re.test(m.text()))) consoleErrors.push(m.text().slice(0, 160));
  });
  page.setDefaultTimeout(30_000);

  // 1. Abrir app → Perfil
  await openProfile(page, BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Perfil/ }).click();
  await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });

  // 2. Contraseña incorrecta → error visible
  await tryLogin(page, EMAIL, "contramala1");
  await page.getByRole("alert").filter({ hasText: "incorrectos" }).waitFor({ timeout: 10_000 });
  chk("contraseña incorrecta muestra error", true);

  // 3. Login correcto → @username visible
  await page.getByLabel("Contraseña").fill(PASS);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText(`@${USER}`).first().waitFor({ timeout: 15_000 });
  chk("login correcto muestra @usuario", true);

  // 4. Recarga → sesión persiste (cookie)
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_000);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Perfil/ }).click();
  await page.getByText(`@${USER}`).first().waitFor({ timeout: 15_000 });
  chk("sesión persiste tras recargar", true);

  // 5. Logout → formulario de vuelta
  await page.getByRole("button", { name: "Salir" }).click();
  await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });
  chk("logout vuelve al formulario", true);

  // 6. Registro desde la UI
  const emailB = `qa.ui.b.${STAMP}@test.cl`;
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Correo").fill(emailB);
  await page.getByLabel("Nombre de usuario").fill(`qauib${STAMP}`);
  await page.getByLabel("Contraseña").fill(PASS);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.getByText(`@qauib${STAMP}`).first().waitFor({ timeout: 15_000 });
  chk("registro desde la UI funciona", true);
  await page.getByRole("button", { name: "Salir" }).click();
  await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });

  // 7. Login con tecla Enter (volver a modo "Iniciar sesión" tras el registro)
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASS);
  await page.getByLabel("Contraseña").press("Enter");
  let enterOk = true;
  try {
    await page.getByText(`@${USER}`).first().waitFor({ timeout: 8_000 });
  } catch {
    enterOk = false;
  }
  chk("Enter en contraseña envía el formulario", enterOk);

  // 8. Mismo flujo a través del proxy del preview (:81) — contexto sin sesión
  await context.clearCookies();
  const page2 = await context.newPage();
  page2.setDefaultTimeout(30_000);
  page2.on("console", (m) => {
    if (m.type() === "error" && !CONSOLE_IGNORE.some((re) => re.test(m.text()))) consoleErrors.push(`[proxy] ${m.text().slice(0, 160)}`);
  });
  await openProfile(page2, PROXY);
  await page2.getByLabel("Correo").fill(EMAIL);
  await page2.getByLabel("Contraseña").fill(PASS);
  await page2.getByRole("button", { name: "Entrar", exact: true }).click();
  await page2.getByText(`@${USER}`).first().waitFor({ timeout: 15_000 });
  chk("login a través del proxy del preview", true);
  await page2.reload({ waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(2_000);
  await page2.getByRole("button", { name: "Abrir menú" }).click();
  await page2.getByRole("button", { name: /Perfil/ }).click();
  await page2.getByText(`@${USER}`).first().waitFor({ timeout: 15_000 });
  chk("sesión persiste vía proxy tras recargar", true);
  await page2.close();

  chk("sin errores de consola", consoleErrors.length === 0, consoleErrors.join(" | "));

  await browser.close();

  // Limpieza
  for (const mail of [EMAIL, emailB]) {
    try { execSync(`node scripts/cleanup-test-user.mjs ${mail}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  }
  console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E error:", e.message);
  process.exit(1);
});
