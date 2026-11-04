// E2E navegador — Flujo "¿Olvidaste tu contraseña?" (server).
//   1) Login → enlace "¿Olvidaste tu contraseña?" abre el panel.
//   2) Paso 1: solicitar código → nota + botón WhatsApp prellenado.
//   3) Código incorrecto → error con intentos restantes.
//   4) Código correcto (vía scripts/reset-code.mjs / Prisma) → listo.
//   5) Volver a iniciar sesión con la nueva contraseña.
// Correr con el server arriba: node scripts/e2e-forgot-password.mjs
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const STAMP = Date.now().toString(36).slice(-6);
const EMAIL = `qa.forgot.${STAMP}@test.cl`;
const USER = `qaforgot${STAMP}`;
const PASS_OLD = "vieja123";
const PASS_NEW = "nueva456";
const db = new PrismaClient();

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

async function activeCode(email) {
  const row = await db.passwordReset.findFirst({
    where: { email, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return row?.code ?? null;
}

async function main() {
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: USER, password: PASS_OLD }),
  });
  chk("cuenta de prueba creada vía API", reg.ok, (await reg.text()).slice(0, 120));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  // El 401 es el /api/me pre-login; el 400 lo dispara a propósito la
  // prueba de "código incorrecto".
  const CONSOLE_IGNORE = [/401 \(Unauthorized\)/, /400 \(Bad Request\)/];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !CONSOLE_IGNORE.some((re) => re.test(m.text()))) consoleErrors.push(m.text().slice(0, 160));
  });
  page.setDefaultTimeout(45_000);

  // 1. Abrir app → Perfil → formulario login
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Perfil/ }).click();
  await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });

  // 2. Enlace abre el panel de restablecimiento
  await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
  await page.getByText("Restablecer contraseña").waitFor({ timeout: 10_000 });
  chk("panel de restablecimiento visible", true);

  // 3. Paso 1: solicitar código
  await page.getByLabel("Correo de tu cuenta").fill(EMAIL);
  await page.getByRole("button", { name: "Solicitar código" }).click();
  await page.getByText("Solicitud registrada", { exact: false }).waitFor({ timeout: 15_000 });
  chk("paso 2 muestra la nota de solicitud", true);
  const wa = page.locator('a[href*="wa.me/56942961619"]');
  chk("botón WhatsApp prellenado", (await wa.count()) > 0);

  // 4. Código incorrecto → error con intentos
  await page.getByLabel("Código de 6 dígitos").fill("000000");
  await page.getByLabel("Nueva contraseña").fill(PASS_NEW);
  await page.getByRole("button", { name: "Restablecer contraseña" }).click();
  await page.getByRole("alert").filter({ hasText: "Código incorrecto" }).waitFor({ timeout: 15_000 });
  chk("código incorrecto muestra error", true);

  // 5. Código correcto (el activo en DB)
  const code = await activeCode(EMAIL);
  chk("código activo en DB", !!code, "sin código");
  await page.getByLabel("Código de 6 dígitos").fill(code);
  await page.getByRole("button", { name: "Restablecer contraseña" }).click();
  await page.getByText("¡Listo! Tu contraseña se actualizó", { exact: false }).waitFor({ timeout: 15_000 });
  chk("contraseña restablecida (paso 3)", true);

  // 6. Volver al login y entrar con la contraseña nueva
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).last().click();
  await page.getByLabel("Correo").waitFor({ timeout: 10_000 });
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASS_NEW);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText(`@${USER}`).first().waitFor({ timeout: 15_000 });
  chk("login con la nueva contraseña", true);

  chk("sin errores de consola", consoleErrors.length === 0, consoleErrors.join(" | "));

  await browser.close();
  await db.$disconnect();

  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E error:", e.message);
  process.exit(1);
});
