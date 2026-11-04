// Captura el formulario de login (Perfil) para verificación visual.
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "/tmp/login-form.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(1_200);
await page.getByRole("button", { name: "Abrir menú" }).click();
await page.getByRole("button", { name: /Perfil/ }).click();
await page.getByText("Tu cuenta Cumbre30").waitFor({ timeout: 15_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT });
await browser.close();
console.log("shot:", OUT);
