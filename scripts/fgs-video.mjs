// Video de declaración FOREGROUND_SERVICE_LOCATION para Google Play Console.
// Graba la app (build-static) con GPS simulado por la ruta real del parque,
// overlays de sistema Android (permiso, sombra de notificaciones con la
// notificación persistente real del FGS) y leyendas; luego agrega tarjeta
// de título y de cierre y ensambla el MP4 final con ffmpeg.
// Captura: CDP screencast (frames JPEG con timestamp real) sobre un viewport
// 896×1991 con zoom 2 → layout de teléfono con nitidez 2×, sin letterbox.
// Uso: node scripts/fgs-video.mjs [BASE]   (BASE default http://127.0.0.1:8123)

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { gpsMain, chromeMain, GPS_ROUTE } from "./fgs-inject.mjs";

const req = createRequire("/home/z/.npm-global/lib/x.js");
const { chromium } = req("playwright");

const BASE = process.argv[2] || "http://127.0.0.1:8123";
const OUT = path.resolve("download/video-fgs");
const FRAMES = path.join(OUT, "_frames");
fs.mkdirSync(FRAMES, { recursive: true });

const Z = 2;                 // zoom CSS del app
const VW = 896, VH = 1991;   // viewport CSS (448×995.5 lógico × Z)
const W = 1080, H = 2398;    // resolución final
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // limpiar frames previos
  for (const f of fs.readdirSync(FRAMES)) fs.unlinkSync(path.join(FRAMES, f));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    locale: "es-CL",
    timezoneId: "America/Santiago",
  });
  await ctx.addInitScript(gpsMain, GPS_ROUTE);
  await ctx.addInitScript(() => {
    const set = () => { document.documentElement.style.zoom = "2"; };
    if (document.documentElement) set();
    else document.addEventListener("DOMContentLoaded", set);
    document.addEventListener("DOMContentLoaded", set);
  });
  await ctx.addInitScript(chromeMain);

  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/40[14]|Failed to load resource/.test(m.text())) {
      console.log("[console]", m.text().slice(0, 160));
    }
  });

  // ---------- screencast CDP ----------
  const cdp = await ctx.newCDPSession(page);
  const shotLog = [];
  cdp.on("Page.screencastFrame", async (ev) => {
    try {
      const t = ev.metadata?.timestamp ?? 0;
      const last = shotLog[shotLog.length - 1];
      const dup = last && t - last.t < 0.004; // ráfaga con mismo timestamp: conservar una
      if (!dup) {
        const name = `f${String(shotLog.length).padStart(5, "0")}.jpg`;
        fs.writeFileSync(path.join(FRAMES, name), Buffer.from(ev.data, "base64"));
        shotLog.push({ t, name });
        fs.writeFileSync(path.join(OUT, "times.json"), JSON.stringify(shotLog));
      }
      await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }); // ACK siempre (flow control)
    } catch (e) {
      console.log("[screencast]", String(e).slice(0, 120));
    }
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 72, maxWidth: VW, maxHeight: VH, everyNthFrame: 1 });

  const caption = (t) => page.evaluate((s) => window.__c30chrome.caption(s), t);
  const status = (on, gps) => page.evaluate(([a, b]) => window.__c30chrome.status(a, b), [on, gps]);
  const perm = (on) => page.evaluate((a) => window.__c30chrome.perm(a), on);
  const shade = (on) => page.evaluate((a) => window.__c30chrome.shade(a), on);

  async function tap(loc, ms = 700) {
    const box = await loc.boundingBox();
    if (!box) throw new Error("sin boundingBox para tap");
    // el chrome vive dentro del zoom → sus coordenadas internas son /Z
    await page.evaluate(([x, y]) => window.__c30chrome.ripple(x, y), [(box.x + box.width / 2) / Z, (box.y + box.height / 2) / Z]);
    await sleep(320);
    await loc.click();
    await sleep(ms);
  }

  // ---------- carga ----------
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('button:has-text("Iniciar ride")', { timeout: 60000 });
  await sleep(900);
  await status(true, false);
  await caption("Cumbre30 registra tu paseo en bici por el Parque Metropolitano y alerta el límite de 30 km/h usando el GPS");
  await sleep(4600);

  // ---------- abrir Configuración y elegir GPS real ----------
  await caption(null); await sleep(300);
  await tap(page.locator('button[aria-label="Abrir menú"]'), 900);
  await caption("Fuente de datos: <b>GPS real</b> — la ubicación del dispositivo alimenta el paseo");
  await tap(page.getByRole("button", { name: /Configuración/ }), 1000);
  await sleep(400);
  await tap(page.locator('button[role="radio"]:has-text("GPS real")'), 900);
  await sleep(600);
  await tap(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Ride" }), 900);
  await caption(null); await sleep(500);

  // ---------- iniciar ride → permiso ----------
  await tap(page.locator('button:has-text("Iniciar ride")'), 500);
  await perm(true);
  await sleep(500);
  await caption("Antes de arrancar, Android pide al usuario el permiso <b>ACCESS_FINE_LOCATION</b>");
  await sleep(4400);
  await tap(page.locator("#c30-btn-while"), 400);
  await perm(false);
  await status(true, true);
  await caption("Al iniciar el paseo, la app lanza <b>RideLocationService</b> con foregroundServiceType «location»");
  await sleep(5200);

  // ---------- ride en marcha ----------
  await caption("GPS a 1 Hz: velocidad, distancia y alertas siguen registrándose con la app en segundo plano o pantalla bloqueada");
  await sleep(5000);
  await caption(null);
  await sleep(7000);

  // ---------- sombra de notificaciones ----------
  await shade(true);
  await sleep(700);
  await caption("Notificación persistente (<b>ongoing</b>) del servicio — obligatoria para todo FGS de ubicación en Android 14+");
  await sleep(7000);
  await caption(null);
  await shade(false);
  await sleep(800);
  await caption("El paseo sigue en segundo plano; la notificación permanece hasta que el usuario termine");
  await sleep(4200);
  await caption(null);
  await sleep(3000);

  // ---------- finalizar ----------
  await tap(page.locator('button[aria-label="Finalizar y guardar ride"]'), 600);
  await status(true, false);
  await caption("Al finalizar: <b>stopForeground()</b> detiene el servicio y elimina la notificación");
  await sleep(5200);
  await caption(null);
  await sleep(1800);

  await cdp.send("Page.stopScreencast").catch(() => {});
  await ctx.close();
  await browser.close();

  if (shotLog.length < 10) throw new Error(`screencast capturó solo ${shotLog.length} frames`);
  console.log(`[fgs-video] screencast: ${shotLog.length} frames en ${(shotLog[shotLog.length - 1].t - shotLog[0].t).toFixed(1)}s`);

  // ---------- demo.mp4 desde frames con duraciones reales ----------
  const list = [ "ffconcat version 1.0" ];
  for (let i = 0; i < shotLog.length; i++) {
    const dur = i + 1 < shotLog.length
      ? Math.min(6, Math.max(0.02, shotLog[i + 1].t - shotLog[i].t))
      : 0.6;
    list.push(`file '${FRAMES}/${shotLog[i].name}'`);
    list.push(`duration ${dur.toFixed(3)}`);
  }
  const last = shotLog[shotLog.length - 1].name;
  list.push(`file '${FRAMES}/${last}'`);
  fs.writeFileSync(path.join(OUT, "list.txt"), list.join("\n") + "\n");
  const demoMp4 = path.join(OUT, "demo.mp4");
  execSync(
    `ffmpeg -y -v error -f concat -safe 0 -i "${path.join(OUT, "list.txt")}" ` +
    `-vf "scale=${W}:2400:flags=lanczos,crop=${W}:${H}:0:1,fps=30,format=yuv420p" ` +
    `-c:v libx264 -crf 20 -preset faster "${demoMp4}"`,
    { stdio: "inherit" }
  );
  console.log(`[fgs-video] demo.mp4 → ${(fs.statSync(demoMp4).size / 1e6).toFixed(1)} MB`);

  // ---------- tarjetas ----------
  const cards = makeCards();
  const cardBrowser = await chromium.launch();
  const cardPage = await cardBrowser.newPage({ viewport: { width: W, height: H } });
  await cardPage.setContent(cards.title, { waitUntil: "load" });
  await cardPage.waitForTimeout(250);
  await cardPage.screenshot({ path: path.join(OUT, "card1.png") });
  await cardPage.setContent(cards.end, { waitUntil: "load" });
  await cardPage.waitForTimeout(250);
  await cardPage.screenshot({ path: path.join(OUT, "card2.png") });
  await cardBrowser.close();
  console.log("[fgs-video] tarjetas listas");

  // ---------- ensamblaje ----------
  const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${demoMp4}"`).toString().trim());
  const dOut = Math.max(0, dur - 0.65).toFixed(2);
  const final = path.join(OUT, "declaracion-foreground-service-location.mp4");
  execSync(
    `ffmpeg -y -v error -loop 1 -t 6 -i "${path.join(OUT, "card1.png")}" -i "${demoMp4}" -loop 1 -t 8 -i "${path.join(OUT, "card2.png")}" ` +
    `-filter_complex "[0:v]scale=${W}:${H},setsar=1,fps=30,fade=t=in:st=0:d=0.7,fade=t=out:st=5.3:d=0.7[a];` +
    `[1:v]scale=${W}:${H},setsar=1,fps=30,fade=t=in:st=0:d=0.4,fade=t=out:st=${dOut}:d=0.6[b];` +
    `[2:v]scale=${W}:${H},setsar=1,fps=30,fade=t=in:st=0:d=0.7,fade=t=out:st=7.3:d=0.7[c];` +
    `[a][b][c]concat=n=3:v=1:a=0,format=yuv420p[v]" -map "[v]" -c:v libx264 -crf 21 -preset faster -movflags +faststart "${final}"`,
    { stdio: "inherit" }
  );
  const sz = (fs.statSync(final).size / 1e6).toFixed(1);
  const fdur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${final}"`).toString().trim();
  console.log(`[fgs-video] FINAL → ${final} · ${fdur}s · ${sz} MB`);
  process.exit(0);
}

// ---------- HTML de tarjetas (marca Cumbre GEO: espresso/crema/verde) ----------
export function makeCards() {
  const FONT = `"Noto Sans SC", system-ui, sans-serif`;
  const base = (inner) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 2398px; font-family: ${FONT}; background: #241A11; color: #F2EAD9;
    display: flex; flex-direction: column; justify-content: space-between; padding: 130px 90px 110px; }
  .wordmark { font-size: 34px; font-weight: 800; letter-spacing: 6px; }
  .wordmark b { color: #35B85F; font-weight: 800; }
  .chip { display: inline-block; margin-top: 18px; font-size: 22px; color: #C9B99F;
    border: 1px solid #4A3826; border-radius: 999px; padding: 10px 22px; letter-spacing: .5px; }
  h1 { font-size: 92px; line-height: 1.12; font-weight: 800; letter-spacing: -1px; }
  .code { display: inline-block; margin-top: 34px; font-size: 34px; font-weight: 700; color: #35B85F;
    background: rgba(53,184,95,.12); border: 2px solid rgba(53,184,95,.55); border-radius: 18px; padding: 18px 30px; }
  .sub { margin-top: 40px; font-size: 34px; line-height: 1.5; color: #D8CBB4; max-width: 820px; }
  .rows { margin-top: 46px; display: flex; flex-direction: column; gap: 22px; }
  .row { display: flex; align-items: center; gap: 18px; font-size: 28px; color: #E5D9C2; }
  .dot { width: 14px; height: 14px; border-radius: 50%; background: #35B85F; flex: none; }
  h2 { font-size: 64px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 14px; }
  .check { width: 46px; height: 46px; border-radius: 50%; background: rgba(53,184,95,.16);
    border: 2px solid #35B85F; display: flex; align-items: center; justify-content: center; flex: none; }
  .item { display: flex; gap: 26px; align-items: flex-start; font-size: 31px; line-height: 1.42; color: #EDE3D0; }
  .item b { color: #7CE6A3; }
  .foot { display: flex; justify-content: space-between; align-items: center; font-size: 24px; color: #A78E6E; }
  .sep { height: 2px; background: #3A2B1B; margin: 40px 0; }
</style></head><body>` + inner;
  const titleDoc = base(`
  <div>
    <div class="wordmark">CUMBRE<b>GEO</b></div>
    <div class="chip">Cumbre30 · v1.8.2 · cl.cumbre30.app</div>
  </div>
  <div>
    <h1>Declaración:<br>servicio en primer plano de ubicación</h1>
    <div class="code">FOREGROUND_SERVICE_LOCATION</div>
    <div class="sub">Demostración de uso: la app mantiene un servicio en primer plano con tipo
    <b style="color:#7CE6A3">location</b> durante el paseo en bicicleta, con notificación persistente.</div>
    <div class="rows">
      <div class="row"><span class="dot"></span>Registro GPS del recorrido</div>
      <div class="row"><span class="dot"></span>Fiscalización del límite de 30 km/h</div>
      <div class="row"><span class="dot"></span>Parque Metropolitano de Santiago · 100% offline</div>
    </div>
  </div>
  <div class="foot"><span>Cumbre GEO · cumbregeo.cl</span><span>Google Play Console</span></div></body></html>`);
  const endDoc = base(`
  <div>
    <div class="wordmark">CUMBRE<b>GEO</b></div>
    <div class="chip">Resumen de la declaración</div>
  </div>
  <div>
    <h2>Uso de la ubicación en primer plano</h2>
    <div class="sep"></div>
    <div class="rows" style="gap:34px">
      <div class="item"><span class="check"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#35B85F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span>Permisos declarados: <b>ACCESS_FINE_LOCATION</b>, <b>FOREGROUND_SERVICE</b> y <b>FOREGROUND_SERVICE_LOCATION</b></span></div>
      <div class="item"><span class="check"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#35B85F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span>Servicio <b>RideLocationService</b> con <b>android:foregroundServiceType="location"</b>; GPS a 1 Hz solo mientras el usuario pedalea</span></div>
      <div class="item"><span class="check"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#35B85F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span>Notificación persistente <b>«Cumbre30 · ride en curso»</b> visible durante todo el paseo; el usuario la controla desde la app</span></div>
      <div class="item"><span class="check"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#35B85F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span>Al finalizar el paseo, <b>stopForeground()</b> detiene el servicio y elimina la notificación</span></div>
      <div class="item"><span class="check"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#35B85F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span>La ubicación no se comparte ni se vende: se usa <b>exclusivamente</b> para el registro del paseo y sus alertas</span></div>
    </div>
  </div>
  <div class="foot"><span>Cumbre GEO · contacto.cumbre30@gmail.com</span><span>cumbregeo.cl</span></div></body></html>`);
  return { title: titleDoc, end: endDoc };
}

if (process.argv[1] && process.argv[1].endsWith("fgs-video.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
