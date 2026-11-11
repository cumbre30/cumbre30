// Verificación rápida del preview: minimapa limpio + mapa general con 5 capas
import { chromium } from "playwright";

const BASE = "http://localhost:3000/";
const OUT = "/tmp/render";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200));
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 1. Minimapa: verificar solo Plaza México + accesos + opción listado completo
  const mini = page.locator("select").first();
  const opciones = await mini.locator("option").allTextContents();
  console.log("[minimapa opciones]", JSON.stringify(opciones));

  // captura pantalla ride con minimapa
  await page.screenshot({ path: `${OUT}/preview-ride-minimapa.png` });

  // 2. Abrir mapa general desde la opción "Revisa el listado completo"
  await mini.selectOption("listado");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/preview-mapa-general.png` });

  // 3. Verificar los 5 menús desplegables del mapa general
  const texto = await page.locator("body").innerText();
  const capas = ["Accesos", "Rutas", "Puntos de Interés", "Normativa y Seguridad", "Conexión Urbana"];
  for (const c of capas) {
    console.log(`[capa] "${c}": ${texto.includes(c) ? "OK" : "FALTA"}`);
  }
  // rutas clave
  for (const r of ["Pedro de Valdivia", "Pío Nono", "Los Gemelos", "La S", "Paseo Metropolitano", "Enduro"]) {
    console.log(`[ruta] "${r}": ${texto.includes(r) ? "OK" : "FALTA"}`);
  }

  await browser.close();
  console.log("OK diag preview");
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
