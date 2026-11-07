// ============================================================
// Grabación del video de declaración FOREGROUND_SERVICE_LOCATION
// para Play Console — app Cumbre30 real (build estático v1.8.2/27)
// servida en localhost, con GPS simulado sobre la ruta real del
// parque (subida Pío Nono → cumbre, waypoints de src/lib/park.ts).
//
// Elementos Android recreados en página (fiel al código real):
//   · Barra de estado con icono de ubicación
//   · Diálogo de permiso "Mientras usas la app" (ACCESS_FINE_LOCATION)
//   · Notificación persistente del FGS:
//       título: "Cumbre30 · ride en curso"
//       texto:  "Límite 30 km/h · GPS activo en segundo plano"
//     (strings exactos de RideLocationService.kt)
//
// Salida: /tmp/c30rec/cumbre30-fgs-raw.webm
// ============================================================

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = 8899;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = "/tmp/c30rec";
const OUT_RAW = `${OUT_DIR}/cumbre30-fgs-raw.webm`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------- server
function startServer() {
  const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", "build-static"], {
    cwd: "/home/z/my-project",
    stdio: "ignore",
  });
  return srv;
}
async function waitServer(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE + "/index.html");
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("servidor estático no respondió");
}

// ---------------------------------------------------------- GPS simulado
const GPS_SHIM = `
(() => {
  // Subida real del parque (waypoints de SIM_ROUTE, src/lib/park.ts)
  const WP = [
    { lat: -33.4343, lon: -70.6360, kmh: 10, alt: 700 },  // Bellavista (ref, fuera del parque)
    { lat: -33.4300, lon: -70.6350, kmh: 12, alt: 706 },  // Ingreso Pío Nono  ← inicio
    { lat: -33.4296, lon: -70.6340, kmh: 11, alt: 722 },  // Zoológico Nacional
    { lat: -33.4277, lon: -70.6337, kmh: 12, alt: 758 },  // Subida lado Funicular
    { lat: -33.4234, lon: -70.6327, kmh: 8,  alt: 848 },  // Plaza México
  ];
  const R = 6371000, rad = Math.PI / 180;
  const dist = (a, b) => {
    const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
    const y = (b.lat - a.lat) * rad;
    return Math.sqrt(x * x + y * y) * R;
  };
  // Ruta del ride: Pío Nono → cumbre (WP[1..]) — arranca DENTRO del
  // geocerca del parque para disparar "Ingresando al Parque Metropolitano".
  const RIDE = WP.slice(1);
  const cum = [0];
  for (let i = 1; i < RIDE.length; i++) cum.push(cum[i - 1] + dist(RIDE[i - 1], RIDE[i]));
  const at = (d) => {
    d = Math.max(0, Math.min(cum[cum.length - 1], d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const f = cum[i] > cum[i - 1] ? (d - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
    const a = RIDE[i - 1], b = RIDE[i];
    return {
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      kmh: a.kmh + (b.kmh - a.kmh) * f,
      alt: a.alt + (b.alt - a.alt) * f,
    };
  };
  const jit = (v, a) => v + (Math.random() - 0.5) * a;
  let phase = "idle", startT = 0, traveled = 0;
  const watchers = new Map();
  let wid = 1;

  function currentFix() {
    const t = Date.now();
    if (phase === "idle") {
      return { lat: jit(-33.4300, 0.00004), lon: jit(-70.6350, 0.00004), speed: 0, alt: jit(706, 0.8), acc: 5 + Math.random() * 3, t };
    }
    const p = at(traveled + 0.001);
    const kmh = Math.max(2.5, 11 + 1.6 * Math.sin((t - startT) / 9000) + (Math.random() - 0.5) * 0.8);
    return { lat: jit(p.lat, 0.00003), lon: jit(p.lon, 0.00003), speed: kmh / 3.6, alt: jit(p.alt, 0.6), acc: 4 + Math.random() * 3, t };
  }
  setInterval(() => {
    if (phase === "ride") {
      const p = at(traveled + 0.001);
      traveled += (p.kmh / 3.6) * 1; // 1 Hz, ritmo del perfil real
    }
    const fix = currentFix();
    for (const cb of watchers.values()) { try { cb(fix); } catch {} }
  }, 1000);

  const makePos = (f) => ({
    coords: {
      latitude: f.lat, longitude: f.lon, accuracy: f.acc,
      altitude: f.alt, altitudeAccuracy: 5, heading: null, speed: f.speed,
    },
    timestamp: f.t,
  });
  const geo = {
    getCurrentPosition: (ok) => ok(makePos(currentFix())),
    watchPosition: (ok) => {
      const id = wid++;
      watchers.set(id, (fix) => ok(makePos(fix)));
      setTimeout(() => ok(makePos(currentFix())), 150);
      return id;
    },
    clearWatch: (id) => watchers.delete(id),
  };
  Object.defineProperty(navigator, "geolocation", { get: () => geo, configurable: true });
  window.__c30gps = { setPhase: (m) => { phase = m; if (m === "ride") startT = Date.now(); } };
})();
`;

// ---------------------------------------------------------- overlays UI
const UI_OVERLAY = `
(() => {
  if (window.__c30ui) return;
  const css = document.createElement("style");
  css.textContent = \`
    .c30-sb { position: fixed; top: 0; left: 0; right: 0; height: 26px; z-index: 2147483000;
      background: #0b0f14; color: #fff; display: flex; align-items: center; justify-content: space-between;
      padding: 0 14px; font-size: 12px; font-weight: 600; font-family: Roboto, sans-serif; letter-spacing: .2px; }
    .c30-sb-icons { display: flex; align-items: center; gap: 7px; }
    .c30-sb svg { display: block; }
    .c30-pill { position: fixed; bottom: 6px; left: 50%; transform: translateX(-50%); width: 118px; height: 4px;
      border-radius: 99px; background: rgba(255,255,255,.85); z-index: 2147483000; }
    body { padding-top: 26px !important; }
    header.sticky { top: 26px !important; }
    .c30-notif { position: fixed; top: 30px; left: 8px; right: 8px; z-index: 2147483100;
      background: rgba(28,33,40,.97); border-radius: 20px; box-shadow: 0 8px 28px rgba(0,0,0,.5);
      padding: 10px 14px; display: flex; gap: 11px; align-items: flex-start;
      transform: translateY(-130%); transition: transform .38s cubic-bezier(.2,.8,.25,1);
      font-family: Roboto, sans-serif; }
    .c30-notif.on { transform: translateY(0); }
    .c30-cap { position: fixed; bottom: 84px; left: 50%; transform: translateX(-50%); z-index: 2147483200;
      max-width: 90%; background: rgba(11,15,20,.93); border: 1px solid rgba(255,255,255,.16);
      border-radius: 16px; padding: 10px 16px; font-family: Roboto, sans-serif; font-size: 13px; line-height: 1.42;
      color: #f4f4f5; text-align: center; opacity: 0; transition: opacity .3s; pointer-events: none; }
    .c30-cap.on { opacity: 1; }
    .c30-card { position: fixed; inset: 0; z-index: 2147483300; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 14px; padding: 28px; text-align: center;
      background: linear-gradient(165deg, #04150f 0%, #05130d 55%, #000 100%); color: #fff;
      font-family: Roboto, sans-serif; opacity: 0; pointer-events: none; transition: opacity .5s; }
    .c30-card.on { opacity: 1; pointer-events: auto; }
    .c30-brand { width: 64px; height: 64px; border-radius: 18px; background: #059669; display: flex;
      align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(5,150,105,.35); }
    .c30-chip { border: 1px solid #10b98188; color: #6ee7b7; background: #05966914; border-radius: 99px;
      padding: 5px 12px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; font-family: ui-monospace, monospace; }
    .c30-perm-dim { position: fixed; inset: 0; z-index: 2147483400; background: rgba(0,0,0,.6);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      opacity: 0; pointer-events: none; transition: opacity .3s; font-family: Roboto, sans-serif; }
    .c30-perm-dim.on { opacity: 1; pointer-events: auto; }
    .c30-perm { background: #22262d; border-radius: 26px; padding: 24px 22px 18px; max-width: 330px;
      width: 100%; color: #e8eaed; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
    .c30-perm h3 { font-size: 17px; font-weight: 600; line-height: 1.35; margin: 14px 6px 6px; }
    .c30-perm p { font-size: 13px; color: #9aa0a6; margin: 0 6px; line-height: 1.4; }
    .c30-perm-btns { display: flex; justify-content: flex-end; gap: 4px; margin-top: 20px; }
    .c30-perm-btns button { border: 0; background: none; color: #a8dab5; font-size: 13.5px; font-weight: 600;
      padding: 10px 12px; border-radius: 99px; font-family: Roboto, sans-serif; }
    .c30-perm-btns button:active { background: rgba(168,218,181,.12); }
    .c30-li { display: flex; align-items: flex-start; gap: 9px; font-size: 14px; color: #d1fae5;
      max-width: 330px; text-align: left; line-height: 1.45; }
    .c30-li svg { flex-shrink: 0; margin-top: 2px; }
  \`;
  document.head.appendChild(css);

  // barra de estado
  const sb = document.createElement("div");
  sb.className = "c30-sb";
  sb.innerHTML = \`
    <div>10:41</div>
    <div class="c30-sb-icons">
      <svg id="c30-loc" width="14" height="14" viewBox="0 0 24 24" fill="#5f6368"><path d="M12 2 19 21l-7-4-7 4Z"/></svg>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#e8eaed"><path d="M2 20h3v-7H2v7zm5 0h3V9H7v11zm5 0h3V4h-3v16zm5 0h3v-9h-3v9z"/></svg>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#e8eaed"><path d="M12 21 1.8 8.5A16.9 16.9 0 0 1 12 5c3.9 0 7.5 1.3 10.2 3.5L12 21z"/></svg>
      <svg width="20" height="12" viewBox="0 0 26 14"><rect x="0.5" y="0.5" width="21" height="13" rx="3.5" fill="none" stroke="#e8eaed"/><rect x="2.5" y="2.5" width="14" height="9" rx="1.8" fill="#e8eaed"/><rect x="23" y="4.5" width="2.4" height="5" rx="1" fill="#e8eaed"/></svg>
    </div>\`;
  document.body.appendChild(sb);

  const pill = document.createElement("div");
  pill.className = "c30-pill";
  document.body.appendChild(pill);

  // notificación persistente (strings reales de RideLocationService.kt)
  const notif = document.createElement("div");
  notif.className = "c30-notif";
  notif.innerHTML = \`
    <div style="width:26px;height:26px;border-radius:8px;background:#059669;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#052e16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
    </div>
    <div style="min-width:0;flex:1;">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#9fb0c0;">
        <span style="font-weight:600;">Cumbre30</span><span>ahora</span>
      </div>
      <div style="font-size:13.5px;font-weight:600;color:#fff;margin-top:1px;">Cumbre30 · ride en curso</div>
      <div style="font-size:12.5px;color:#b6c2cf;margin-top:1px;">Límite 30 km/h · GPS activo en segundo plano</div>
    </div>\`;
  document.body.appendChild(notif);

  // caption
  const cap = document.createElement("div");
  cap.className = "c30-cap";
  document.body.appendChild(cap);

  // tarjeta de título
  const title = document.createElement("div");
  title.className = "c30-card";
  title.innerHTML = \`
    <div class="c30-brand">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#052e16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
    </div>
    <div style="font-size:34px;font-weight:800;letter-spacing:-0.5px;">Cumbre<span style="color:#34d399;">30</span></div>
    <div style="font-size:15.5px;color:#e5e7eb;max-width:330px;line-height:1.45;">Uso de la ubicación en primer plano durante el ride</div>
    <div class="c30-chip">FOREGROUND_SERVICE_LOCATION</div>
    <div style="font-size:11.5px;color:#8b949e;max-width:340px;line-height:1.5;margin-top:4px;">
      Grabación de la aplicación real (v1.8.2 · build 27) · GPS simulado sobre la ruta
      Pío Nono → cumbre del cerro San Cristóbal · Cumbre GEO
    </div>\`;
  document.body.appendChild(title);

  // tarjeta final
  const end = document.createElement("div");
  end.className = "c30-card";
  const check = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  end.innerHTML = \`
    <div class="c30-brand" style="width:54px;height:54px;">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#052e16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
    </div>
    <div style="font-size:21px;font-weight:800;max-width:340px;line-height:1.3;">Servicio en primer plano de ubicación</div>
    <div class="c30-li">\${check}<span>Notificación persistente «Cumbre30 · ride en curso» mientras dura el ride</span></div>
    <div class="c30-li">\${check}<span>GPS a 1 Hz que registra el recorrido mientras la app está en uso</span></div>
    <div class="c30-li">\${check}<span>La ubicación se usa solo dentro de la app: límite 30 km/h y alertas del parque</span></div>
    <div style="font-size:11.5px;color:#8b949e;margin-top:8px;">Cumbre30 · Cumbre GEO — cl.cumbre30.app — v1.8.2 (build 27)</div>\`;
  document.body.appendChild(end);

  // diálogo de permiso Android (recreación del runtime permission)
  const dim = document.createElement("div");
  dim.className = "c30-perm-dim";
  dim.innerHTML = \`
    <div class="c30-perm">
      <div style="width:34px;height:34px;border-radius:10px;background:#059669;display:inline-flex;align-items:center;justify-content:center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#052e16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
      </div>
      <h3>¿Permitir que Cumbre30 acceda a la ubicación de este dispositivo?</h3>
      <p>Mientras se usa la app</p>
      <div class="c30-perm-btns">
        <button id="c30-perm-deny">No permitir</button>
        <button id="c30-perm-allow">Mientras usas la app</button>
      </div>
    </div>\`;
  document.body.appendChild(dim);

  const locIcon = sb.querySelector("#c30-loc");
  window.__c30ui = {
    titleShow: () => title.classList.add("on"),
    titleHide: () => title.classList.remove("on"),
    endShow: () => end.classList.add("on"),
    notifShow: () => notif.classList.add("on"),
    permShow: () => dim.classList.add("on"),
    permHide: () => dim.classList.remove("on"),
    gpsOn: (on) => locIcon.setAttribute("fill", on ? "#34d399" : "#5f6368"),
    caption: (text) => {
      if (!text) { cap.classList.remove("on"); return; }
      cap.textContent = text;
      cap.classList.add("on");
    },
  };
})();
`;

// ---------------------------------------------------------- main
const srv = startServer();
fs.mkdirSync(OUT_DIR, { recursive: true });

try {
  await waitServer();
  console.log("servidor listo");

  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 400, height: 850 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    recordVideo: { dir: OUT_DIR, size: { width: 400, height: 850 } },
  });
  await context.addInitScript(GPS_SHIM);

  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console]", m.text().slice(0, 140));
  });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 140)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("text=Iniciar ride", { timeout: 45000 });
  await sleep(1800); // MapLibre init

  const gl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl2") || c.getContext("webgl");
    return g ? String(g.getParameter(g.RENDERER)) : "NO_WEBGL";
  });
  console.log("WebGL:", gl);

  await page.evaluate(UI_OVERLAY);

  // S1 · título
  await page.evaluate(() => window.__c30ui.titleShow());
  await sleep(5200);
  await page.evaluate(() => window.__c30ui.titleHide());
  await sleep(900);

  // S2 · permiso de ubicación (al abrir la app)
  await page.evaluate(() =>
    window.__c30ui.caption("Al abrir la app, Android solicita el permiso de ubicación mientras se usa la app (ACCESS_FINE_LOCATION).")
  );
  await sleep(600);
  await page.evaluate(() => window.__c30ui.permShow());
  await sleep(4400);
  await page.tap("#c30-perm-allow");
  await page.evaluate(() => window.__c30ui.permHide());
  await page.evaluate(() => window.__c30ui.gpsOn(true));
  await sleep(2600);
  await page.evaluate(() => window.__c30ui.caption("La ubicación se recibe solo mientras la app está abierta y en uso."));
  await sleep(3800);

  // S3 · configuración: fuente GPS real
  await page.evaluate(() => window.__c30ui.caption("En Configuración se elige la fuente de datos: GPS real."));
  await sleep(900);
  await page.tap('button[aria-label="Abrir menú"]');
  await sleep(1700);
  await page.getByRole("button", { name: /Configuración/ }).tap();
  await sleep(1500);
  await page.getByRole("radio", { name: "GPS real" }).tap();
  await sleep(2300);
  await page.getByRole("button", { name: "Ride", exact: true }).tap();
  await sleep(1500);

  // S4 · iniciar ride → FGS + notificación
  await page.evaluate(() =>
    window.__c30ui.caption("Al iniciar el ride con GPS real, la app arranca el servicio en primer plano de ubicación.")
  );
  await sleep(1300);
  await page.getByRole("button", { name: "Iniciar ride" }).tap();
  await page.evaluate(() => window.__c30gps.setPhase("ride"));
  await sleep(1000);
  await page.evaluate(() => window.__c30ui.notifShow());
  await page.evaluate(() =>
    window.__c30ui.caption("Servicio en primer plano activo (FOREGROUND_SERVICE_LOCATION) con notificación persistente.")
  );
  await sleep(6200);

  // S5 · tracking
  await page.evaluate(() => window.__c30ui.caption("GPS a 1 Hz: registra posición, velocidad y desnivel mientras pedaleas."));
  await sleep(6600);
  await page.evaluate(() => window.__c30ui.caption("La notificación «Cumbre30 · ride en curso» permanece visible durante todo el ride."));
  await sleep(6600);
  await page.evaluate(() => window.__c30ui.caption("La ubicación alimenta el límite de 30 km/h, las geocercas del parque y las alertas."));
  await sleep(6600);

  // bitácora
  await page.evaluate(() => window.__c30ui.caption("La bitácora deja registro de cada evento del ride."));
  await page.evaluate(() => window.scrollBy(0, 720));
  await sleep(4600);
  await page.evaluate(() => window.scrollBy(0, -900));
  await sleep(2400);

  // S6 · cierre
  await page.evaluate(() => window.__c30ui.caption(null));
  await sleep(400);
  await page.evaluate(() => window.__c30ui.endShow());
  await sleep(9500);

  const video = page.video();
  await page.close();
  await context.close();
  await video.saveAs(OUT_RAW);
  await browser.close();
  console.log("RAW_OK:", OUT_RAW, fs.statSync(OUT_RAW).size, "bytes");
} finally {
  srv.kill();
}
