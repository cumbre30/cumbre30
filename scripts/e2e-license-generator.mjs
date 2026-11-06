// E2E generador de licencias (archivo HTML autónomo).
// Verifica que el HTML entregue códigos IDÉNTICOS a scripts/gen-license.mjs,
// que normalice el correo igual (trim + lowercase), que el modo respaldo puro
// (SHA-256 en JS, sin crypto.subtle) coincida, y que arme el mailto + historial.
// Correr desde el directorio del proyecto: node scripts/e2e-license-generator.mjs
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

const FILE = "download/cumbre30-generador-licencias.html";
const URL = pathToFileURL(FILE).href;

// Códigos esperados según el generador CLI (fuente de verdad).
const cliCode = (email) =>
  execFileSync("node", ["scripts/gen-license.mjs", email], { encoding: "utf8" })
    .split("\n")
    .find((l) => l.startsWith("Código:"))
    .replace("Código: ", "")
    .trim();

const ESPERADO_JHE = cliCode("jhernansm93@gmail.com");
const ESPERADO_PRUEBA = cliCode("prueba@cumbre30.cl");

// El código de jhernansm93 fue activado con éxito por el comprador:
// si la herramienta no lo reproduce exacto, está rota.
chk("CLI reproduce el código confirmado en la app (jhernansm93)",
  ESPERADO_JHE === "C30P-X5QP-VXJT-FTIS-PN53", ESPERADO_JHE);

async function genera(page, url, email) {
  await page.goto(url);
  await page.fill("#email", email);
  await page.click("#gen");
  await page.waitForFunction(() =>
    document.getElementById("resCodigo")?.textContent?.startsWith("C30P-"));
  return page.textContent("#resCodigo");
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1) Código igual al CLI (ruta crypto.subtle)
  const c1 = await genera(page, URL, "prueba@cumbre30.cl");
  chk("código == CLI (crypto.subtle)", c1 === ESPERADO_PRUEBA, `${c1} vs ${ESPERADO_PRUEBA}`);

  // 2) Normalización: mayúsculas y espacios → mismo código
  const c2 = await genera(page, URL, "  PRUEBA@Cumbre30.Cl  ");
  chk("normaliza trim+lowercase", c2 === ESPERADO_PRUEBA, c2);

  // 3) Código confirmado por comprador real
  const c3 = await genera(page, URL, "jhernansm93@gmail.com");
  chk("reproduce código confirmado en la app", c3 === "C30P-X5QP-VXJT-FTIS-PN53", c3);

  // 4) Modo respaldo puro (SHA-256 en JS, sin crypto.subtle)
  const c4 = await genera(page, `${URL}?fallback=1`, "jhernansm93@gmail.com");
  chk("respaldo puro (sin crypto.subtle) == CLI", c4 === ESPERADO_JHE, c4);
  const c5 = await genera(page, `${URL}?fallback=1`, "prueba@cumbre30.cl");
  chk("respaldo puro código prueba == CLI", c5 === ESPERADO_PRUEBA, c5);

  // 5) Correo inválido no genera nada
  await page.goto(URL);
  await page.fill("#email", "no-es-correo");
  await page.click("#gen");
  const visible = await page.isVisible("#resultado");
  chk("correo inválido bloqueado", !visible);

  // 6) Plantilla de correo + mailto armado con código y correo
  await page.fill("#email", "jhernansm93@gmail.com");
  await page.click("#gen");
  await page.waitForFunction(() =>
    document.getElementById("resCodigo")?.textContent?.startsWith("C30P-"));
  const cuerpo = await page.inputValue("#cuerpo");
  const asunto = await page.inputValue("#asunto");
  chk("asunto de plantilla", asunto === "Tu código Pro de Cumbre30", asunto);
  chk("cuerpo incluye el código", cuerpo.includes("C30P-X5QP-VXJT-FTIS-PN53"));
  chk("cuerpo incluye el correo", cuerpo.includes("jhernansm93@gmail.com"));
  chk("cuerpo indica que no vence", cuerpo.includes("no vence"));
  chk("cuerpo guía activación in-app", cuerpo.includes("Pagos y suscripciones") && cuerpo.includes("Habilitar modo Pro"));
  const href = await page.getAttribute("#mailto", "href");
  chk("mailto apunta al comprador", href.startsWith("mailto:jhernansm93%40gmail.com"), href.slice(0, 40));
  chk("mailto lleva asunto", href.includes("subject="));
  chk("mailto lleva cuerpo codificado", decodeURIComponent(href).includes("C30P-X5QP-VXJT-FTIS-PN53"));

  // 7) Historial guardado con fecha y botón copiar
  const histTxt = await page.textContent("#historial");
  chk("historial guarda el código", histTxt.includes("C30P-X5QP-VXJT-FTIS-PN53"), histTxt.slice(0, 80));
  chk("historial guarda el correo", histTxt.includes("jhernansm93@gmail.com"));

  // 8) Aviso de seguridad visible
  const bodyTxt = await page.textContent("body");
  chk("aviso de no compartir el archivo", bodyTxt.includes("No lo compartas"));

  await browser.close();

  console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
