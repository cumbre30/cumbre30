// E2E navegador — Desafíos y recompensas: Free/Pro + grupos desplegables.
//   1) Cuenta free: "Desafíos del cerro" plegable con % por serie; solo el
//      primer desafío de cada serie sin chip Pro; retos 2+ con Pro; pines 👑.
//   2) "Desafíos con fecha" (diarios/semanales/mensuales) con progreso en
//      vivo a partir de rides sembrados hoy.
//   3) CTA "Desbloquea con Pro" → pantalla planes.
//   4) Licencia Pro activada: los chips Pro desaparecen y todo es alcanzable.
// Correr con el server arriba: node scripts/e2e-challenges-groups.mjs
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";

const BASE = "http://localhost:3000";
const EMAIL = "premiostest@test.cumbre30.cl";
const PASS = "prueba1234";

// Mismo algoritmo que proLicenseCore (validación client-side del APK).
const PRO_LICENSE_SECRET =
  "1992d7a7763bbde37bea8ba747831c2d40aff7041ddc3c3da895b8b566ebf702";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function proCodeFor(email) {
  const sig = createHmac("sha256", PRO_LICENSE_SECRET).update(email.trim().toLowerCase()).digest();
  let bits = 0, value = 0, out = "";
  for (const b of sig.slice(0, 10)) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return `C30P-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`;
}

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

const iso = (d) => new Date(d).toISOString();

async function main() {
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); } catch {}
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, username: "premiostest", password: PASS }),
  });
  chk("cuenta de prueba creada", reg.ok, (await reg.text()).slice(0, 120));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const CONSOLE_IGNORE = [/401 \(Unauthorized\)/];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !CONSOLE_IGNORE.some((re) => re.test(m.text()))) consoleErrors.push(m.text().slice(0, 160));
  });
  page.setDefaultTimeout(45_000);

  // 1. Cargar app + login same-origin
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Cumbre").first().waitFor({ timeout: 60_000 });
  await page.evaluate(() => localStorage.clear());
  const login = await page.evaluate(async ({ email, pass }) => {
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    return r.ok;
  }, { email: EMAIL, pass: PASS });
  chk("login same-origin", login);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForResponse((r) => r.url().includes("/api/me"), { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1_500);

  // 2. Sembrar rides vía API same-origin: 1 hoy (8 km), 1 hace ~26 h, 1 hace ~50 h
  const now = Date.now();
  const fechaRides = {
    hoy: iso(now - 2 * 3600_000),
    ayer: iso(now - 26 * 3600_000),
    ante: iso(now - 50 * 3600_000),
  };
  const seeded = await page.evaluate(async ({ f }) => {
    const rides = [
      { id: "e2e-premios-hoy", dateISO: f.hoy, distanceKm: 8, gainM: 120, elapsedSec: 1800, maxKmh: 24.1, avgKmh: 16 },
      { id: "e2e-premios-ayer", dateISO: f.ayer, distanceKm: 10, gainM: 150, elapsedSec: 2100, maxKmh: 25.3, avgKmh: 17.1 },
      { id: "e2e-premios-ante", dateISO: f.ante, distanceKm: 12, gainM: 200, elapsedSec: 2400, maxKmh: 26.8, avgKmh: 18 },
    ];
    const out = [];
    for (const r of rides) {
      const res = await fetch("/api/rides", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...r, source: "gps", maxInParkKmh: null, inParkKm: 0, overLimitSec: 0 }),
      });
      out.push(res.status);
    }
    return out;
  }, { f: fechaRides });
  chk("rides sembrados (3× POST 200)", seeded.join(",") === "200,200,200", JSON.stringify(seeded));

  // 3. Ir a Desafíos y recompensas
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Desafíos y recompensas/ }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Desafíos y recompensas/ }).first().click();
  await page.getByText("Tu progreso").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);

  // 4. Grupo "Desafíos del cerro": plegado por defecto, con %
  const cerroBtn = page.getByRole("button", { name: /Desafíos del cerro/ });
  chk("grupo 'Desafíos del cerro' existe", await cerroBtn.isVisible().catch(() => false));
  chk("grupo cerro muestra %", /%/.test(await cerroBtn.innerText().catch(() => "")), await cerroBtn.innerText().catch(() => ""));
  chk("grupo cerro empieza plegado", (await cerroBtn.getAttribute("aria-expanded")) === "false");
  await page.screenshot({ path: "/tmp/e2e-premios-cerrado.png" });

  // 5. Expandir: series con % y Free/Pro por tier
  await cerroBtn.click();
  await page.getByText("Serie Kilómetros").waitFor({ timeout: 15_000 });
  const serieKmBtn = page.getByRole("button", { name: /Serie Kilómetros/ });
  const kmRow = await serieKmBtn.innerText();
  chk("fila Serie Kilómetros con n/total y %", /\d\/5\s*·\s*\d+%/.test(kmRow.replace(/\n/g, " ")), kmRow.replace(/\n/g, " "));
  // La primera serie incompleta abre por defecto → "Diez al pie" visible sin Pro
  const diezVisible = await page.getByText("Diez al pie").isVisible().catch(() => false);
  chk("serie en curso abre por defecto ('Diez al pie' visible)", diezVisible);
  const km50Row = await page.getByText("Medio centenario").isVisible().catch(() => false);
  if (km50Row) {
    const rowTxt = await page.locator("div", { hasText: "Medio centenario" }).last().innerText().catch(() => "");
    chk("km_50 visible (serie abierta)", true);
  } else {
    // serie no abierta: expandir manualmente
    await serieKmBtn.click();
    await page.getByText("Medio centenario").waitFor({ timeout: 10_000 });
  }
  await page.screenshot({ path: "/tmp/e2e-premios-cerro.png" });

  // Chips Pro: contar elementos chip (span.uppercase con texto Pro) en la pantalla
  const proChipCount = await page.locator("span.uppercase", { hasText: /^\s*Pro\s*$/ }).count();
  chk("hay chips 'Pro' en free", proChipCount >= 6, `chips=${proChipCount}`);
  chk("CTA 'Desbloquea con Pro' visible (reto pro en curso)", await page.getByRole("button", { name: /Desbloquea con Pro/ }).first().isVisible().catch(() => false));

  // 6. Grupo "Desafíos con fecha": plegado → expandir → diarios con progreso real
  const fechaBtn = page.getByRole("button", { name: /Desafíos con fecha/ });
  chk("grupo 'Desafíos con fecha' existe", await fechaBtn.isVisible().catch(() => false));
  chk("grupo fecha plegado por defecto", (await fechaBtn.getAttribute("aria-expanded")) === "false");
  await fechaBtn.click();
  await page.getByText("Desafíos diarios").waitFor({ timeout: 10_000 });
  const diaAbierto = await page.getByText("Rueda del día").isVisible().catch(() => false);
  chk("diarios abiertos por defecto ('Rueda del día' visible)", diaAbierto);
  await page.waitForTimeout(800);
  const fechaTxt = await page.evaluate(() => document.body.innerText);
  chk("desafío diario con progreso en vivo (1/1 rides)", /1\s*\/\s*1\s*rides/.test(fechaTxt.replace(/\n/g, " ")), fechaTxt.replace(/\n/g, " ").slice(0, 400));
  chk("nota 'sin recompensas' en grupo fecha", /sin recompensas/i.test(fechaTxt));
  await page.screenshot({ path: "/tmp/e2e-premios-fecha.png" });

  // 7. Pines: coronas 👑 en recompensas Pro (free), contadas en toda la página
  const fullTxt = await page.evaluate(() => document.body.innerText);
  const crowns = (fullTxt.match(/👑/g) || []).length;
  chk("pines con corona 👑 (recompensas Pro)", crowns >= 15, `crowns=${crowns}`);
  chk("nota de pines Pro en la sección", /recompensas de/i.test(fullTxt));

  // 8. CTA Pro → pantalla planes con la tabla actualizada
  await page.getByRole("button", { name: /Desbloquea con Pro/ }).first().click();
  await page.waitForTimeout(1_200);
  const planesTxt = await page.evaluate(() => document.body.innerText);
  chk("navegó a planes", /FREE/i.test(planesTxt) && /PRO/i.test(planesTxt));
  chk("tabla planes menciona desafíos por serie", /1\.º de cada serie/.test(planesTxt), planesTxt.slice(0, 200));
  chk("tabla planes menciona desafíos con fecha", /diarios, semanales y mensuales/.test(planesTxt));

  // 9. Activar licencia Pro (localStorage, validación HMAC client-side) → sin chips Pro
  const code = proCodeFor(EMAIL);
  await page.evaluate(({ email, code }) => {
    localStorage.setItem("cumbre30-pro-v1", JSON.stringify({ email, code, at: Date.now() }));
  }, { email: EMAIL, code });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForResponse((r) => r.url().includes("/api/me"), { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /Desafíos y recompensas/ }).first().click();
  await page.getByText("Tu progreso").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const cerroBtn2 = page.getByRole("button", { name: /Desafíos del cerro/ });
  await cerroBtn2.click();
  await page.getByText("Serie Kilómetros").waitFor({ timeout: 15_000 });
  // La serie en curso abre por defecto: solo plegar/desplegar si hiciera falta.
  if (!(await page.getByText("Medio centenario").isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /Serie Kilómetros/ }).click();
    await page.getByText("Medio centenario").waitFor({ timeout: 10_000 });
  }
  const proChipCount2 = await page.locator("span.uppercase", { hasText: /^\s*Pro\s*$/ }).count();
  chk("con licencia Pro: chips 'Pro' desaparecen de los desafíos", proChipCount2 === 0, `chips=${proChipCount2}`);
  const bodyPro = await page.evaluate(() => document.body.innerText);
  chk("con Pro: hint 'Pro activo' en el grupo", /Pro activo/.test(bodyPro));
  const crownsPro = (bodyPro.match(/👑/g) || []).length;
  chk("con Pro: pines sin coronas", crownsPro === 0, `crowns=${crownsPro}`);
  await page.screenshot({ path: "/tmp/e2e-premios-pro.png" });

  // 10. Consola limpia
  chk("sin errores de consola", consoleErrors.length === 0, JSON.stringify(consoleErrors).slice(0, 300));

  await browser.close();

  // Limpieza de la cuenta de prueba
  try { execSync(`node scripts/cleanup-test-user.mjs ${EMAIL}`, { cwd: process.cwd(), stdio: "pipe" }); console.log("cuenta de prueba eliminada"); } catch {}
  console.log(fails === 0 ? "\nE2E TODO OK" : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error("E2E error:", e); process.exit(1); });
