// Genera los assets gráficos para la ficha de Google Play:
//   · capturas de la app a 1080×1920 ( Ride/mapa, Desafíos, Perfil )
//   · feature graphic 1024×500 (marca Cumbre30)
// Salida: download/play-store/
// Correr con el preview arriba: node scripts/gen-play-assets.mjs [BASE]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:81";
const OUT = "download/play-store";
mkdirSync(`${OUT}/capturas`, { recursive: true });

// 405×720 @ dsf 2.6667 → exactamente 1080×1920
const VIEW = { width: 405, height: 720 };
const DSF = 1080 / 405;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });
// GPS simulado dentro del parque (Pío Nono) para que las capturas
// muestren el estado "GPS OK" y no el aviso de permiso denegado.
await context.grantPermissions(["geolocation"]);
await context.setGeolocation({ latitude: -33.403, longitude: -70.633, accuracy: 12 });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

async function shoot(name) {
  // Espera a que el chip GPS salga de estados negativos (denegado/error):
  // con la geo simulada el chip pasa a "GPS activo" en ~1-2 s.
  try {
    await page.waitForFunction(
      () => {
        const t = document.querySelector("body")?.textContent ?? "";
        return !/GPS denegado|GPS sin señal|GPS error/.test(t);
      },
      { timeout: 12_000 }
    );
  } catch {
    console.log(`aviso: chip GPS no llegó a buen estado para ${name}`);
  }
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: `${OUT}/capturas/${name}.png` });
  const chip = (await page.textContent("body"))?.match(/GPS [^\nF]{0,14}/)?.[0]?.trim();
  console.log(`captura: ${name} (${chip ?? "chip?"})`);
}

// ---------- 1) Pantalla principal (Ride / mapa) ----------
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(3_500);
await shoot("01-ride-mapa");

// ---------- 2) Explorar / mapa ----------
try {
  await page.getByRole("button", { name: /Explorar/i }).first().click();
  await page.waitForTimeout(3_500);
  await shoot("02-explorar");
} catch (e) {
  console.log("explorar no disponible:", e.message.split("\n")[0]);
}

// ---------- 3) Desafíos ----------
try {
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Desaf/ }).click();
  await page.waitForTimeout(2_500);
  await shoot("03-desafios");
} catch (e) {
  console.log("desafíos no disponible:", e.message.split("\n")[0]);
}

// ---------- 4) Perfil ----------
try {
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Perfil/ }).click();
  await page.waitForTimeout(1_500);
  await shoot("04-perfil");
} catch (e) {
  console.log("perfil no disponible:", e.message.split("\n")[0]);
}

// ---------- Feature graphic 1024×500 ----------
const fg = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await fg.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1024px; height:500px; overflow:hidden; position:relative;
         background: linear-gradient(135deg, #09090b 0%, #052e1b 55%, #065f46 100%);
         font-family: 'DejaVu Sans', 'Noto Sans SC', sans-serif; color:#fafafa; }
  .silueta { position:absolute; bottom:-8px; left:0; width:100%; opacity:.5; }
  .wrap { position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:flex-start; justify-content:center; padding:0 72px; }
  .marca { display:flex; align-items:baseline; gap:14px; }
  .cumbre { font-size:96px; font-weight:800; letter-spacing:-3px; color:#fafafa; }
  .treinta { font-size:96px; font-weight:800; letter-spacing:-3px; color:#34d399; }
  .sub { margin-top:10px; font-size:30px; font-weight:600; color:#d1fae5; }
  .chip { margin-top:26px; display:inline-flex; align-items:center; gap:12px;
          border:2px solid #34d39955; background:#022c22aa; border-radius:999px;
          padding:10px 22px; font-size:22px; font-weight:600; color:#a7f3d0; }
  .velo { position:absolute; right:64px; top:50%; transform:translateY(-50%);
          text-align:center; }
  .velo .n { font-size:120px; font-weight:800; color:#34d399; line-height:1; }
  .velo .u { font-size:26px; font-weight:600; color:#a7f3d0; margin-top:6px; }
  .bici { font-size:64px; position:absolute; right:96px; bottom:36px; opacity:.9; }
  .cerro { position:absolute; top:36px; right:64px; font-size:30px; font-weight:700;
           color:#d1fae5cc; letter-spacing:1px; }
</style></head><body>
  <svg class="silueta" viewBox="0 0 1024 140" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 140 L120 60 L210 110 L330 20 L460 105 L560 55 L680 120 L800 45 L910 100 L1024 35 L1024 140 Z" fill="#022c22"/>
  </svg>
  <div class="wrap">
    <div class="marca"><span class="cumbre">Cumbre</span><span class="treinta">30</span></div>
    <div class="sub">Ciclocomputador del Cerro San Cristóbal</div>
    <div class="chip">🚴 Alertas de voz · 30 km/h · San Cristóbal</div>
  </div>
  <div class="velo"><div class="n">30</div><div class="u">km/h máx.</div></div>
  <div class="bici">🚵</div>
  <div class="cerro">⛰️ CERRO SAN CRISTÓBAL</div>
</body></html>`);
await fg.waitForTimeout(400);
await fg.screenshot({ path: `${OUT}/feature-graphic-1024x500.png` });
console.log("feature graphic OK");

await browser.close();
console.log("ASSETS_OK");
