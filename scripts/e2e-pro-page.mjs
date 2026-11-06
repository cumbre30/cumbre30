// E2E página /pro — la web oficial de venta de Cumbre30 Pro (fuera de la app).
// Verifica que la página concentre los pagos (link Mercado Pago del plan Pro
// + botón de aporte voluntario) con la marca CumbreLabs, sin CafinderCL, y
// con la guía de activación de código. Las rutas de soporte siguen vivas.
// Correr con el server arriba: node scripts/e2e-pro-page.mjs [BASE]
const BASE = process.argv[2] || "http://localhost:81";

let fails = 0;
function chk(label, ok, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

async function main() {
  const res = await fetch(`${BASE}/pro`);
  chk("GET /pro responde 200", res.status === 200, `status=${res.status}`);
  const html = await res.text();

  // Contenido central
  chk("título Cumbre30 Pro", html.includes("Cumbre30") && html.includes("Pro"));
  chk("precio fundador $6.500", html.includes("$6.500"));
  chk("pago único / sin suscripción", html.includes("pago único") && html.includes("sin suscripción"));
  chk("link de Mercado Pago del plan Pro (cobro único 2tghXUc)", html.includes("mpago.la/2tghXUc"));
  chk("botón de aporte voluntario (Mercado Pago)", html.includes("link.mercadopago.cl/perfumatch"));
  chk("guía de activación de código", html.includes("Cómo activar tu código") && html.includes("C30P-"));
  chk("ruta de activación in-app documentada", html.includes("Pagos y suscripciones"));
  chk("FAQ presente", html.includes("Preguntas frecuentes"));

  // Marca CumbreLabs, sin CafinderCL
  chk("marca CumbreLabs", /CUMBRE/.test(html) && html.includes("LABS"));
  chk("paleta espresso de CumbreLabs", html.toLowerCase().includes("#241a11"));
  chk("sin menciones de CafinderCL", !/cafinder/i.test(html));

  // Página de pago fuera de la app: la home no debe referenciar MP (SSR shell)
  const home = await fetch(`${BASE}/`).then((r) => r.text());
  chk("home (shell de la app) sin links de Mercado Pago", !home.includes("mpago.la") && !home.includes("mercadopago.cl"));

  // Regresión: páginas requeridas por Play siguen vivas
  for (const p of ["/privacidad", "/eliminar-cuenta"]) {
    const r = await fetch(`${BASE}${p}`);
    chk(`regresión: ${p} responde 200`, r.status === 200, `status=${r.status}`);
  }

  console.log(fails ? `\n${fails} FAIL` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
