// Inyecciones para el video de declaración FOREGROUND_SERVICE_LOCATION.
// Se exportan FUNCIONES (Playwright las serializa con addInitScript):
//  · gpsMain(route): reemplaza navigator.geolocation por un proveedor falso
//    que recorre la ruta real del parque a 12× tiempo real con speed
//    Doppler coherente (el app muestra "Ride iniciado con GPS real").
//  · chromeMain(): capa de "chrome" Android encima de la app: barra de
//    estado, diálogo de permiso de ubicación, sombra de notificaciones con
//    la notificación persistente real del FGS, leyendas y ripple de taps.
//  · GPS_ROUTE: waypoints (lat, lon, kmh, alt) de SIM_ROUTE (bajada 35→20).

export const GPS_ROUTE = [
  [-33.4343, -70.636, 10, 700],      // Bellavista (arranque ya en marcha, como el simulador de la app)
  [-33.43, -70.635, 12, 706],        // ingreso por Pío Nono
  [-33.4296, -70.634, 11, 722],      // Zoológico Nacional
  [-33.4277, -70.6337, 12, 758],     // camino a Plaza México
  [-33.4234, -70.6327, 8, 848],      // Plaza México
  [-33.4195, -70.628, 16, 822],      // Pedro Bannen → Tupahue
  [-33.4171, -70.6235, 12, 785],     // Anáhuac
  [-33.4148, -70.619, 18, 790],      // Tupahue → Jardín Japonés
  [-33.4133, -70.6147, 20, 792],     // Jardín Japonés
  [-33.4112, -70.6138, 18, 798],     // Carlos Martner
  [-33.409051, -70.61374, 16, 802],  // Piscina Antilén
  [-33.4112, -70.6135, 18, 794],     // vuelta Carlos Martner
  [-33.4118, -70.6105, 20, 762],     // bajada PdV Norte
  [-33.411769, -70.607988, 16, 738], // salida Pedro de Valdivia Norte
  [-33.4113, -70.6068, 10, 730],     // Av. Pedro de Valdivia
];

export function gpsMain(route) {
  if (window.__c30gpsInjected) return;
  window.__c30gpsInjected = true;
  const SCALE = 12; // 12× tiempo real (igual que el modo demo de la app)
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  function hav(a, b) {
    const dLa = rad(b[0] - a[0]), dLo = rad(b[1] - a[1]);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const cum = [0];
  let tot = 0;
  for (let i = 1; i < route.length; i++) { tot += hav(route[i - 1], route[i]); cum.push(tot); }
  function at(d) {
    const c = Math.max(0, Math.min(tot, d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < c) i++;
    const d0 = cum[i - 1], d1 = cum[i];
    const f = d1 > d0 ? (c - d0) / (d1 - d0) : 0;
    const a = route[i - 1], b = route[i];
    return { lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f, kmh: a[2] + (b[2] - a[2]) * f, alt: a[3] + (b[3] - a[3]) * f };
  }
  let simT = 0;
  const epoch = Date.now();
  let trav = 0;
  const state = { lat: route[0][0], lon: route[0][1], kmh: 0, alt: route[0][3], started: false, fixes: 0 };
  window.__c30mock = state;
  function makePos() {
    const p = at(trav);
    const kmh = Math.max(0, p.kmh + (Math.random() - 0.5) * 0.9);
    const lat = p.lat + (Math.random() - 0.5) * 0.00002;
    const lon = p.lon + (Math.random() - 0.5) * 0.00002;
    state.lat = lat; state.lon = lon; state.kmh = kmh; state.alt = p.alt; state.fixes++;
    return {
      coords: {
        latitude: lat, longitude: lon,
        altitude: p.alt + (Math.random() - 0.5) * 0.8,
        accuracy: 4 + Math.random() * 3, altitudeAccuracy: 5,
        heading: null, speed: kmh / 3.6,
      },
      timestamp: epoch + simT * 1000,
    };
  }
  let timer = null, lastReal = null;
  function tick() {
    const now = performance.now();
    // sin tope corto: el sim corre 12× real aunque el headless throttle los timers
    const dt = Math.min(2, (now - (lastReal || now)) / 1000);
    lastReal = now;
    const dtSim = dt * SCALE;
    const here = at(trav);
    trav += (here.kmh * 1000 / 3600) * dtSim;
    simT += dtSim;
    if (trav >= tot) trav = 0;
    for (const ok of watches.values()) ok(makePos());
  }
  // Múltiples watches con ids reales: la app tiene un watcher ambiental
  // (status idle) y otro del ride; clearWatch(id) de uno no debe matar el otro.
  const watches = new Map();
  let watchSeq = 1;
  const geo = {
    getCurrentPosition: (ok) => { ok(makePos()); },
    watchPosition: (ok) => {
      const id = watchSeq++;
      watches.set(id, ok);
      ok(makePos());
      state.started = true;
      if (!timer) { lastReal = performance.now(); timer = setInterval(tick, 250); }
      return id;
    },
    clearWatch: (id) => {
      watches.delete(id);
      if (watches.size === 0) {
        state.started = false;
        if (timer) { clearInterval(timer); timer = null; }
      }
    },
  };
  Object.defineProperty(navigator, "geolocation", { configurable: true, get() { return geo; } });
}

export function chromeMain() {
  if (window.__c30chrome) return;
  const build = () => {
    if (document.getElementById("c30chrome")) return;
    const css = [
      '#c30chrome { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none;',
      '  font-family: "Noto Sans SC", system-ui, sans-serif; }',
      '.c30-hide { display: none !important; }',
      '#c30-status { position: absolute; top: 0; left: 0; right: 0; height: 34px;',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 0 14px; background: linear-gradient(to bottom, rgba(0,0,0,.62), rgba(0,0,0,0));',
      '  color: #fff; font-size: 12.5px; font-weight: 700; letter-spacing: .2px;',
      '  opacity: 0; transition: opacity .4s; }',
      '#c30-status.on { opacity: 1; }',
      '#c30-status .icons { display: flex; align-items: center; gap: 7px; }',
      '#c30-gpsdot { display: none; align-items: center; }',
      '#c30-gpsdot.on { display: flex; }',
      '#c30-ripple { position: absolute; width: 14px; height: 14px; border-radius: 50%;',
      '  background: rgba(53,184,95,.85); box-shadow: 0 0 0 2px rgba(255,255,255,.65);',
      '  transform: translate(-50%,-50%) scale(1); opacity: 0; }',
      '@keyframes c30rip { 0% { transform: translate(-50%,-50%) scale(.6); opacity: .95 }',
      '  100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0 } }',
      '#c30-ripple.go { animation: c30rip .55s ease-out; }',
      '#c30-caption { position: absolute; left: 16px; right: 16px; bottom: 76px;',
      '  display: flex; justify-content: center; opacity: 0; transition: opacity .35s; }',
      '#c30-caption.on { opacity: 1; }',
      '#c30-caption span { background: rgba(12,14,16,.86); color: #fff; font-size: 14px;',
      '  line-height: 1.45; font-weight: 500; padding: 10px 14px; border-radius: 14px;',
      '  max-width: 380px; text-align: center; border: 1px solid rgba(255,255,255,.14); }',
      '#c30-caption b { color: #4ed882; font-weight: 700; }',
      '#c30-perm { position: absolute; inset: 0; background: rgba(0,0,0,.55);',
      '  display: flex; align-items: center; justify-content: center; visibility: hidden;',
      '  opacity: 0; transition: opacity .3s, visibility .3s; pointer-events: none; }',
      '#c30-perm.on { opacity: 1; pointer-events: auto; visibility: visible; }',
      '#c30-perm .card { width: 334px; background: #F2F0EB; color: #1B1B1B; border-radius: 26px;',
      '  padding: 20px 20px 10px; box-shadow: 0 24px 60px rgba(0,0,0,.5);',
      '  transform: translateY(10px) scale(.98); transition: transform .3s; }',
      '#c30-perm.on .card { transform: none; }',
      '#c30-perm .app { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: #444; }',
      '#c30-perm .appi { width: 22px; height: 22px; border-radius: 7px; background: #35B85F; color: #06250F;',
      '  display: flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 800; }',
      '#c30-perm h3 { margin: 10px 0 2px; font-size: 17.5px; line-height: 1.32; font-weight: 600; }',
      '#c30-perm .sub { font-size: 13px; color: #5c5c5c; margin-bottom: 10px; }',
      '#c30-perm .row { display: flex; gap: 9px; align-items: flex-start; font-size: 12.8px;',
      '  color: #3c3c3c; background: rgba(0,0,0,.05); border-radius: 12px; padding: 9px 11px; margin-bottom: 6px; }',
      '#c30-perm .row svg { flex: none; margin-top: 1px; }',
      '#c30-perm .btns { border-top: 1px solid rgba(0,0,0,.12); margin-top: 8px; padding-top: 4px; }',
      '#c30-perm button { display: block; width: 100%; text-align: left; background: none; border: 0;',
      '  padding: 13px 8px; font-size: 14.5px; color: #0B57D0; border-radius: 12px;',
      '  font-family: inherit; pointer-events: auto; }',
      '#c30-perm button:hover { background: rgba(0,0,0,.06); }',
      '#c30-perm #c30-btn-while { font-weight: 700; }',
      '#c30-shade { position: absolute; inset: 0; background: linear-gradient(rgba(10,12,14,.45), rgba(10,12,14,.7));',
      '  transform: translateY(-102%); visibility: hidden;',
      '  transition: transform .55s cubic-bezier(.2,.8,.2,1), visibility .55s; pointer-events: none; }',
      '#c30-shade.on { transform: none; pointer-events: auto; visibility: visible; }',
      '#c30-shade .panel { position: absolute; inset: 0 0 auto 0; background: #15171A; color: #E9EAEC;',
      '  border-radius: 0 0 30px 30px; padding: 10px 16px 22px;',
      '  box-shadow: 0 30px 80px rgba(0,0,0,.6); }',
      '#c30-shade .grab { width: 44px; height: 4px; border-radius: 4px; background: #565B62; margin: 4px auto 14px; }',
      '#c30-shade .clock { font-size: 54px; font-weight: 400; letter-spacing: -.5px; line-height: 1; }',
      '#c30-shade .date { font-size: 13.5px; color: #9AA0A6; margin: 6px 0 18px; }',
      '#c30-shade .qs { display: flex; gap: 10px; margin-bottom: 20px; }',
      '#c30-shade .tile { width: 64px; height: 30px; border-radius: 16px; background: #2A2D31;',
      '  display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 10.5px; color: #B6BABF; }',
      '#c30-shade .tile.act { background: #35502F; color: #B7E8C4; }',
      '#c30-shade .nlabel { font-size: 12px; color: #9AA0A6; margin: 0 4px 8px; font-weight: 700; letter-spacing: .3px; }',
      '#c30-shade .explain { display: inline-flex; align-items: center; margin: 0 4px 10px;',
      '  font-size: 11.5px; font-weight: 700; color: #7CE6A3; background: rgba(53,184,95,.14);',
      '  border: 1px solid rgba(53,184,95,.5); padding: 5px 10px; border-radius: 999px; }',
      '#c30-shade .notif { background: #26282C; border-radius: 22px; padding: 14px 16px;',
      '  border: 2px solid #35B85F; box-shadow: 0 0 0 6px rgba(53,184,95,.12); }',
      '#c30-shade .nhead { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #B6BABF; }',
      '#c30-shade .napp { width: 24px; height: 24px; border-radius: 8px; background: #35B85F; color: #06250F;',
      '  display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; }',
      '#c30-shade .nappname { color: #E9EAEC; font-weight: 700; }',
      '#c30-shade .ntitle { font-size: 15.5px; font-weight: 700; margin: 9px 0 3px; color: #FFFFFF; }',
      '#c30-shade .ntext { font-size: 13.5px; color: #C9CDD2; line-height: 1.4; }',
      '#c30-shade .nfoot { display: flex; align-items: center; gap: 6px; margin-top: 10px;',
      '  font-size: 11.5px; color: #8FD9A8; }',
      '#c30-shade .chips { display: flex; gap: 8px; margin-top: 10px; }',
      '#c30-shade .chip { font-size: 11px; color: #B6BABF; background: #32353A; padding: 4px 10px; border-radius: 999px; }',
    ].join("\n");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const svgPin = '<svg width="13" height="13" viewBox="0 0 24 24" fill="#4ed882"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>';
    const svgLoc = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>';
    const svgWifi = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 21l3.5-4.5A5.6 5.6 0 0 0 12 15.5c-1.3 0-2.5.4-3.5 1L12 21zM12 10c-2.9 0-5.6 1-7.7 2.8l1.6 2A9.4 9.4 0 0 1 12 12.4c2.4 0 4.6.9 6.1 2.4l1.6-2A12.2 12.2 0 0 0 12 10z"/></svg>';
    const svgSig = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M2 22h20V2L2 22z"/></svg>';
    const svgBat = '<svg width="11" height="16" viewBox="0 0 12 20" fill="#fff"><path d="M8 2V0H4v2H2a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8z"/></svg>';
    const svgBt = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2v8.6l4.2-4.2L13 2zM5.6 6.4 4.2 7.8 9.4 13l-5.2 5.2 1.4 1.4L11 15v7l6.2-6.2L12.8 13l4.4-4.4L11 2v7L5.6 6.4z"/></svg>';
    const svgMoon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4A7 7 0 0 1 11.4 3H12z"/></svg>';
    const svgLamp = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2h6v3l-2 2v3h-2V7L9 5V2zm0 12h6v8l-3-2-3 2v-8z"/></svg>';

    const root = document.createElement("div");
    root.id = "c30chrome";
    root.innerHTML = [
      '<div id="c30-status"><span>18:42</span>',
      '  <span class="icons">',
      '    <span id="c30-gpsdot">' + svgLoc + '</span>',
      '    ' + svgWifi + svgSig + svgBat,
      '  </span>',
      '</div>',
      '<div id="c30-ripple"></div>',
      '<div id="c30-caption"><span id="c30-caption-text"></span></div>',
      '<div id="c30-perm">',
      '  <div class="card">',
      '    <div class="app"><span class="appi">C30</span> Cumbre30</div>',
      '    <h3>¿Permitir que Cumbre30 acceda a la ubicación de este dispositivo?</h3>',
      '    <div class="sub">Mientras se usa la app</div>',
      '    <div class="row">' + svgPin + '<span><b>Precisa</b>: GPS del dispositivo para registrar el paseo y alertar el límite de 30 km/h</span></div>',
      '    <div class="btns">',
      '      <button id="c30-btn-once">Solo esta vez</button>',
      '      <button id="c30-btn-while">Mientras se use la app</button>',
      '      <button id="c30-btn-no">No permitir</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '<div id="c30-shade">',
      '  <div class="panel">',
      '    <div class="grab"></div>',
      '    <div class="clock">18:42</div>',
      '    <div class="date">sáb 7 de noviembre</div>',
      '    <div class="qs">',
      '      <div class="tile act">' + svgWifi + ' Internet</div>',
      '      <div class="tile">' + svgBt + '</div>',
      '      <div class="tile">' + svgMoon + '</div>',
      '      <div class="tile">' + svgLamp + '</div>',
      '    </div>',
      '    <div class="nlabel">Notificaciones · 1</div>',
      '    <div class="explain">●&nbsp; Servicio en primer plano &nbsp;·&nbsp; foregroundServiceType: location</div>',
      '    <div class="notif">',
      '      <div class="nhead"><span class="napp">C30</span> <span class="nappname">Cumbre30</span> <span>· hace 1 s</span></div>',
      '      <div class="ntitle">Cumbre30 · ride en curso</div>',
      '      <div class="ntext">Límite 30 km/h · GPS activo en segundo plano</div>',
      '      <div class="nfoot">' + svgPin + '<span>Ubicación en uso — el servicio sigue activo con la pantalla bloqueada</span></div>',
      '      <div class="chips"><span class="chip">Ongoing</span><span class="chip">GPS 1 Hz</span></div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("\n");
    document.body.appendChild(root);

    const $ = (id) => document.getElementById(id);
    window.__c30chrome = {
      status(on, gps) {
        $("c30-status").classList.toggle("on", !!on);
        if (gps !== undefined) $("c30-gpsdot").classList.toggle("on", !!gps);
      },
      perm(on) { $("c30-perm").classList.toggle("on", !!on); },
      shade(on) { $("c30-shade").classList.toggle("on", !!on); },
      caption(text) {
        const c = $("c30-caption");
        if (!text) { c.classList.remove("on"); return; }
        $("c30-caption-text").innerHTML = text;
        c.classList.add("on");
      },
      ripple(x, y) {
        const r = $("c30-ripple");
        r.style.left = x + "px";
        r.style.top = y + "px";
        r.classList.remove("go");
        void r.offsetWidth;
        r.classList.add("go");
      },
    };
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
}
