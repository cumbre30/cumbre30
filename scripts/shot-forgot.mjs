// Captura el panel "¿Olvidaste tu contraseña?" (paso 2 con botón WhatsApp).
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const STAMP = Date.now().toString(36).slice(-6);
const EMAIL = `qa.shot.${STAMP}@test.cl`;
const db = new PrismaClient();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(1_500);
await page.getByRole("button", { name: "Abrir menú" }).click();
await page.getByRole("button", { name: /Perfil/ }).click();
await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });
await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
await page.getByLabel("Correo de tu cuenta").fill(EMAIL);
await page.getByRole("button", { name: "Solicitar código" }).click();
await page.getByText("Solicitud registrada", { exact: false }).waitFor({ timeout: 15_000 });
await page.getByLabel("Código de 6 dígitos").fill("123456");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/forgot-panel.png" });
await browser.close();
await db.$disconnect();
try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
console.log("shot: /tmp/forgot-panel.png");
