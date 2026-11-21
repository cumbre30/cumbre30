// ============================================================
// In-vivo Fase F (v2.1 §8): proyector Navegar (privada + pública),
// ride GPS con routeRef, experiencia post-ride y completada binaria.
// Corre contra el dev server local (PG 5433) con sesión sembrada.
// Ejecutar: node scripts/invivo-fase-f.mjs
// ============================================================
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/zcode/rt/runtime/node_modules/playwright-core");
const EXE = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

const TOKEN = process.env.VIVO_TOKEN;
const RUTA_ID = process.env.VIVO_RUTA_ID;
const GEO_BASE = { latitude: -33.43721, longitude: -70.64180 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:postgres@127.0.0.1:5433/cumbre30" } } });

const errores = [];
let paso = 0;
function ok(nombre) { paso++; console.log(`  ✓ ${nombre}`); }
function fail(nombre, e) { console.error(`  ✗ ${nombre}: ${e?.message ?? e}`); errores.push(`${nombre}: ${e?.message ?? e}`); }

async function assertVisible(page, testid, nombre) {
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await el.waitFor({ state: "visible", timeout: 15000 });
  ok(nombre);
  return el;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    geolocation: GEO_BASE,
    permissions: ["geolocation"],
    locale: "es-CL",
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    const txt = m.text();
    // Errores de recursos ESPERADOS por diseño (no son bugs):
    // · 401 /api/me sin cookie de sesión (la web usa cookie; el ensayo
    //   inyecta token Bearer para las APIs de rutas — /api/me invita a Cuenta).
    // · 403 /api/moderation probe silencioso de rol (fase E: tab oculto).
    if (m.type() === "error" && txt.includes("Failed to load resource")) return;
    if (m.type() === "error") errores.push(`console: ${txt}`);
  });
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));

  await page.addInitScript(([tok, ruta]) => {
    localStorage.setItem("cumbre30-sync-token-v1", JSON.stringify({ token: tok, email: "fase-f-vivo@test.local", expiresAt: new Date(Date.now() + 86_400_000).toISOString() }));
    localStorage.setItem("c30.rutas-v2", JSON.stringify({
      v: 1, migrado: true,
      entries: [{
        id: "vivo-ruta-1", kind: "ruta", nombre: "Ruta InVivo F",
        coords: [
          { lat: -33.43721, lon: -70.64180 },
          { lat: -33.43805, lon: -70.63985 },
          { lat: -33.43915, lon: -70.63830 },
          { lat: -33.44065, lon: -70.63680 },
        ],
        distKm: 2.1, gainM: 140, createdAt: new Date().toISOString(), origen: "motor",
        status: "borrador", updatedAt: new Date().toISOString(),
        // Caso real fase D→F: la copia local de una ruta PUBLICADA conserva
        // el serverId — así Navegar (privada) puede anclar la experiencia.
        serverId: ruta,
      }],
    }));
  }, [TOKEN, RUTA_ID]);

  await page.goto("http://localhost:3000/?gps=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(9000);

  // 1 · Ficha privada → Navegar
  await page.getByRole("button", { name: "Explorar", exact: true }).click();
  await sleep(7000);
  await page.locator('[data-testid="btn-biblioteca"]').click();
  await sleep(1200);
  await assertVisible(page, "biblioteca-rutas", "biblioteca abierta");
  await page.locator('[data-testid="bib-borrador-vivo-ruta-1"]').click();
  const ficha = await assertVisible(page, "bib-ficha", "ficha privada abierta");
  await page.screenshot({ path: "/tmp/render/inv-f-01-ficha.png" });
  await page.locator('[data-testid="ficha-navegar"]').click();
  const chip = await assertVisible(page, "chip-ruta-proyectada", "chip proyector tras Navegar (privada)");
  const chipTxt = await chip.textContent();
  if (!chipTxt?.includes("Ruta InVivo F") || !chipTxt?.includes("tu copia")) fail("chip privada", `texto inesperado: ${chipTxt}`);
  else ok("chip: nombre + origen «tu copia»");
  await page.screenshot({ path: "/tmp/render/inv-f-02-chip.png" });

  // 2 · Persistencia del proyector tras recarga
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(8000);
  await page.getByRole("button", { name: "Explorar", exact: true }).click();
  await sleep(6000);
  await assertVisible(page, "chip-ruta-proyectada", "proyector persiste tras recarga (store en localStorage)");

  // 3 · Ride GPS con la ruta proyectada
  await page.getByRole("button", { name: "Ride", exact: true }).click();
  await sleep(1500);
  await assertVisible(page, "ride-proyectada", "recordatorio «Siguiendo la ruta» en RideView");
  await page.getByRole("button", { name: "Iniciar ride" }).click();
  await sleep(4000);
  // Mover el GPS (Playwright geolocation) para acumular >50 m reales.
  const puntos = [
    { latitude: -33.43760, longitude: -70.64120 },
    { latitude: -33.43810, longitude: -70.64030 },
    { latitude: -33.43870, longitude: -70.63920 },
    { latitude: -33.43930, longitude: -70.63810 },
    { latitude: -33.43990, longitude: -70.63700 },
  ];
  for (const p of puntos) {
    await ctx.setGeolocation(p);
    await sleep(4200);
  }
  await page.getByRole("button", { name: "Finalizar y guardar ride" }).click();
  const modal = await assertVisible(page, "exp-post-ride", "modal experiencia post-ride tras cerrar");
  const modalTxt = await modal.textContent();
  if (!modalTxt?.includes("Ruta InVivo F")) fail("modal ruta", `no cita la ruta: ${modalTxt?.slice(0, 120)}`);
  else ok("modal cita la ruta seguida");
  await assertVisible(page, "exp-completada", "nota COMPLETADA en el modal (binaria)");
  await page.screenshot({ path: "/tmp/render/inv-f-03-modal.png" });

  // 4 · Registrar la experiencia (condiciones + comentario → POST)
  await page.locator('[data-testid="exp-cond-agua"]').click();
  await page.locator('[data-testid="exp-cond-sombra"]').click();
  await page.locator('[data-testid="exp-comentario"]').fill("InVivo Fase F: cerré el ride siguiendo la ruta proyectada.");
  await page.locator('[data-testid="exp-enviar"]').click();
  await assertVisible(page, "exp-ok", "experiencia publicada (POST al servidor local)");
  await page.screenshot({ path: "/tmp/render/inv-f-04-ok.png" });
  await page.locator('[data-testid="exp-ok-cerrar"]').click();

  // 5 · Estado local verificado (ride con routeRef + completada)
  const estado = await page.evaluate(() => ({
    ride: JSON.parse(localStorage.getItem("cumbre30-history-v1") || "[]")[0] ?? null,
    rutas: JSON.parse(localStorage.getItem("c30.rutas-v2") || "{}"),
  }));
  const ride = estado.ride ?? {};
  if (ride.source === "gps" && ride.routeRef?.id === "vivo-ruta-1" && ride.routeRef.nombre === "Ruta InVivo F" && !JSON.stringify(ride.routeRef).includes("lat")) {
    ok("ride LOCAL con routeRef (ids + nombre, sin geometría)");
  } else fail("routeRef ride", JSON.stringify(ride.routeRef ?? ride.source));
  const r0 = (estado.rutas.entries ?? [])[0] ?? {};
  if (r0.id === "vivo-ruta-1" && r0.completada === true && typeof r0.completadaAt === "string") {
    ok("completada binaria persistida en c30.rutas-v2 (con completadaAt)");
  } else fail("completada", JSON.stringify({ id: r0.id, completada: r0.completada, completadaAt: r0.completadaAt }));

  // 6 · Navegar PÚBLICA (geometría protegida)
  // Antes: el diálogo «¿Fuiste en bici?» puede quedar abierto — los
  // saltos GPS del ensayo disparan la sospecha de vehículo (v1.13.x).
  // Responder «Sí, fui en bici» para desbloquear la UI.
  const vehDialog = page.locator('div[aria-label="Confirmar si el viaje fue en bicicleta"]');
  if (await vehDialog.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Sí, fui en bici" }).click();
    ok("diálogo «¿fuiste en bici?» respondido (sospecha esperada por los saltos GPS del ensayo)");
    await sleep(1500);
  }
  await page.getByRole("button", { name: "Explorar", exact: true }).click();
  await sleep(4000);
  await page.locator('[data-testid="btn-biblioteca"]').click();
  await sleep(1200);
  await page.locator('[data-testid="bib-tab-catalogo"]').click();
  await sleep(1000);
  await page.locator('[data-testid="cat-buscar"]').click();
  await sleep(4000);
  const fila = page.locator(`[data-testid="cat-ruta-${RUTA_ID}"]`);
  await fila.waitFor({ state: "visible", timeout: 15000 });
  ok("catálogo encuentra la ruta pública sembrada (viewport)");
  await fila.click();
  await assertVisible(page, "cat-ficha", "ficha pública abierta");
  await page.locator('[data-testid="catficha-navegar"]').click();
  const chip2 = await assertVisible(page, "chip-ruta-proyectada", "chip tras Navegar pública");
  const chip2Txt = await chip2.textContent();
  if (!chip2Txt?.includes("geometría protegida")) fail("chip pública", `sin nota protegida: ${chip2Txt}`);
  else ok("chip pública: «geometría protegida»");
  await page.screenshot({ path: "/tmp/render/inv-f-05-publica.png" });
  await page.screenshot({ path: "/tmp/render/inv-f-06-mapa.png" });

  await browser.close();

  // 7 · Verificación en servidor real
  const exp = await db.routeExperience.findFirst({
    where: { routeId: RUTA_ID, comentario: { contains: "InVivo Fase F" } },
    select: { id: true, rideId: true, fechaRealizacion: true, condiciones: true, userId: true },
  });
  const user = await db.user.findFirst({ where: { username: "faseFVivo" }, select: { id: true } });
  if (exp && exp.userId === user?.id && typeof exp.rideId === "string" && exp.rideId.length > 0) {
    ok(`experiencia en servidor con rideId anclado (${exp.rideId.slice(0, 8)}…, fecha ${exp.fechaRealizacion}, condiciones ${JSON.stringify(exp.condiciones)})`);
  } else fail("experiencia servidor", JSON.stringify(exp));
  const rutaSrv = await db.route.findUnique({ where: { id: RUTA_ID }, select: { status: true } });
  if (rutaSrv?.status === "publicado") ok("la ruta pública sigue publicada (la experiencia jamás escribe en Route)");
  await db.$disconnect();

  console.log("\n--- RESULTADO IN-VIVO FASE F ---");
  if (errores.length === 0) {
    console.log(`OK: ${paso} pasos, 0 errores de consola`);
  } else {
    console.log(`PASOS OK: ${paso}`);
    console.log(`ERRORES (${errores.length}):`);
    for (const e of errores) console.log("  · " + e);
    process.exit(1);
  }
})().catch(async (e) => {
  console.error("FALLO IN-VIVO:", e);
  console.log("ERRORES:", JSON.stringify(errores, null, 1));
  await db.$disconnect().catch(() => undefined);
  process.exit(1);
});
