// Captura de verificación del preview en :3000 — pantalla ride con Temas Pro.
// Uso: node scripts/shot-geo-preview.mjs [temaKey]
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/render";

// Tema Pro de ejemplo (claves válidas en rideTheme.ts: volcan, austral, bosque, etc.)
const TEMA_PRO = {
  key: "volcan",
  name: "Volcán",
  primary: "#e2543e",
  accent: "#f0b429",
};

const browser = await chromium.launch();

// 1) Pantalla inicial de la app Cumbre30 (raíz)
const p1 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p1.goto(`${BASE}`, { waitUntil: "networkidle", timeout: 60000 });
await p1.waitForTimeout(2500);
await p1.screenshot({ path: `${OUT}/geo-inicio.png` });
console.log("OK -> geo-inicio.png");
await p1.close();

// 2) Ride en modo Demo con tema Pro aplicado (velocímetro + píldora de modo)
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p2.addInitScript((t) => {
  localStorage.setItem("cumbre30-ridetheme-v1", JSON.stringify(t));
}, TEMA_PRO);
await p2.goto(`${BASE}`, { waitUntil: "networkidle", timeout: 60000 });
await p2.waitForTimeout(2500);
await p2.getByRole("button", { name: /iniciar ride/i }).click({ timeout: 15000 });
await p2.waitForTimeout(7000);
await p2.screenshot({ path: `${OUT}/geo-ride-tema.png` });
console.log("OK -> geo-ride-tema.png");
await p2.close();

await browser.close();
console.log("CAPTURAS_OK");
