#!/usr/bin/env python3
# ============================================================
# Grabación del video demostrativo FOREGROUND_SERVICE_LOCATION
# para la declaración de permisos en Google Play Console.
#
# Estrategia: la app REAL (build estática PLAY_BUILD=1) corre en
# Chromium headless con un feed GPS simulado a 1 Hz (igual que el
# FGS nativo) por una ruta real dentro del Parque Metropolitano.
# Playwright graba la pantalla; las escenas del sistema Android
# (diálogo de permiso, shade de notificaciones, status bar) se
# reproducen como réplicas DOM con los textos EXACTOS del
# RideLocationService.kt declarado en el manifest.
#
# Resultado: webm → ffmpeg → MP4 1080x1920 H.264.
# ============================================================

import asyncio
import base64
import math
import re
import shutil
import time
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path("/home/z/my-project")
BUILD = ROOT / "build-static"
RAW_WEBM = Path("/tmp/fgs-raw.webm")
OUT_MP4 = ROOT / "download" / "cumbre30-foreground-location-demo.mp4"

URL = "http://localhost:4173/"

# ---------------------------------------------------------- geometría

def load_park_polygon():
    txt = (ROOT / "src" / "lib" / "park.ts").read_text()
    m = re.search(r"PARK_POLYGON: LatLng\[\] = \[(.*?)\];", txt, re.S)
    pts = re.findall(r"lat: (-?[\d.]+), lon: (-?[\d.]+)", m.group(1))
    return [(float(lat), float(lon)) for lat, lon in pts]


def point_in_polygon(lat, lon, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        yi, xi = poly[i]
        yj, xj = poly[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def pull_to_centroid(pt, poly, k):
    clat = sum(p[0] for p in poly) / len(poly)
    clon = sum(p[1] for p in poly) / len(poly)
    return (pt[0] + (clat - pt[0]) * k, pt[1] + (clon - pt[1]) * k)


def catmull_rom(points, samples_per_seg=60):
    """Suaviza la polilínea (lat, lon)."""
    pts = [points[0]] + points + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            t2, t3 = t * t, t * t * t
            lat = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            lon = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((lat, lon))
    out.append(points[-1])
    return out


def haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def build_route():
    poly = load_park_polygon()
    gate_pv = (-33.411769, -70.607988)
    # inicio: fuera del parque, ~90 m al sur-este del acceso
    start = (gate_pv[0] + 0.00085, gate_pv[1] + 0.00035)
    assert not point_in_polygon(*start, poly), "el inicio debe estar FUERA del parque"
    waypoints = [
        pull_to_centroid(gate_pv, poly, 0.15),
        pull_to_centroid((-33.409051, -70.61374), poly, 0.10),   # Piscina Antilén
        pull_to_centroid((-33.413345, -70.614692), poly, 0.10),  # Jardín Japonés
        pull_to_centroid((-33.417135, -70.623511), poly, 0.10),  # Casa Anáhuac
        pull_to_centroid((-33.4234, -70.6327), poly, 0.10),      # Plaza México
        pull_to_centroid((-33.430691, -70.63592), poly, 0.12),   # Acceso Pío Nono
    ]
    for i, w in enumerate(waypoints):
        assert point_in_polygon(*w, poly), f"waypoint {i} fuera del parque"
    dense = catmull_rom([start] + waypoints)
    # acumular distancias
    cum = [0.0]
    for i in range(1, len(dense)):
        cum.append(cum[-1] + haversine_m(dense[i - 1], dense[i]))
    return start, dense, cum


def pos_at(dense, cum, meters):
    if meters <= 0:
        return dense[0]
    if meters >= cum[-1]:
        return dense[-1]
    # búsqueda binaria
    lo, hi = 0, len(cum) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if cum[mid] < meters:
            lo = mid + 1
        else:
            hi = mid
    i = max(1, lo)
    seg = cum[i] - cum[i - 1]
    f = 0 if seg == 0 else (meters - cum[i - 1]) / seg
    a, b = dense[i - 1], dense[i]
    return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)


# perfil de velocidad (t_ride s → km/h): arranca, cruza el límite,
# exceso sostenido ~19 s (margen para banner + shade) y baja de vuelta
SPEED_KEYS = [
    (0, 0.5), (2, 8), (4, 15), (6, 21), (8, 24.5), (10, 25.5), (13, 26.0),
    (15, 27.8), (17, 29.2), (20, 32.2), (23, 33.4), (26, 33.0), (30, 31.6),
    (34, 31.0), (37, 30.4), (39, 28.2), (41, 26.5), (44, 24.5), (47, 23.0),
    (50, 21.5), (53, 20.0), (56, 18.5), (58, 17.5),
]
RIDE_TOTAL_S = 60


def speed_at(t):
    if t <= SPEED_KEYS[0][0]:
        return SPEED_KEYS[0][1]
    for (t0, v0), (t1, v1) in zip(SPEED_KEYS, SPEED_KEYS[1:]):
        if t0 <= t <= t1:
            f = (t - t0) / (t1 - t0)
            return v0 + (v1 - v0) * f
    return SPEED_KEYS[-1][1]


# ---------------------------------------------------------- overlays JS

OVERLAY_JS = r"""
(() => {
  if (window.__fgsReady) return true;
  window.__fgsReady = true;

  const css = document.createElement('style');
  css.textContent = `
    html { scrollbar-width: none !important; }
    ::-webkit-scrollbar { display: none !important; }
    body { overscroll-behavior: none; }
    #fgs-sysbar, #fgs-caption, #fgs-pill, #fgs-dialog, #fgs-shade, #fgs-endcard, #fgs-titlecard {
      font-family: Roboto, "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #fgs-sysbar {
      position: fixed; top: 0; left: 0; right: 0; height: 24px; z-index: 99990;
      background: rgba(5,8,12,.92); color: #fff; display: flex; align-items: center;
      justify-content: space-between; padding: 0 12px; font-size: 11.5px; font-weight: 600;
      letter-spacing: .2px; pointer-events: none;
    }
    #fgs-sysbar .icons { display: flex; align-items: center; gap: 6px; }
    #fgs-sysbar svg { display: block; }
    /* pulso sutil del pin GPS: mantiene repaint continuo para que la
       grabación de Playwright respete la duración real */
    #fgs-sysbar .icons svg:first-child { animation: fgs-pulse 1.8s ease-in-out infinite; }
    @keyframes fgs-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
    #fgs-pill {
      position: fixed; bottom: 5px; left: 50%; transform: translateX(-50%);
      width: 84px; height: 4px; border-radius: 99px; background: rgba(255,255,255,.55);
      z-index: 99990; pointer-events: none; mix-blend-mode: difference;
    }
    #fgs-caption {
      position: fixed; left: 50%; transform: translateX(-50%); bottom: 30px; z-index: 99998;
      max-width: 86%; background: rgba(4,10,8,.82); color: #d7fbe8; border: 1px solid rgba(52,211,153,.35);
      border-radius: 14px; padding: 9px 14px; font-size: 12.5px; line-height: 1.35; text-align: center;
      font-weight: 500; backdrop-filter: blur(6px); transition: opacity .25s; pointer-events: none;
    }
    #fgs-titlecard {
      position: fixed; inset: 0; z-index: 99995; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 0 30px;
      background: linear-gradient(160deg, #022c22 0%, #064e3b 55%, #065f46 100%);
      color: #fff; opacity: 1; transition: opacity .45s;
    }
    #fgs-caption .dots { display: inline-block; margin-left: 6px; }
    #fgs-caption .dots i {
      display: inline-block; width: 4px; height: 4px; border-radius: 99px;
      background: #34d399; margin: 0 1.5px; vertical-align: 2px; transition: opacity .2s;
    }
    #fgs-titlecard .hb, #fgs-endcard .hb {
      position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,.08);
    }
    #fgs-titlecard .hb i, #fgs-endcard .hb i {
      display: block; height: 100%; width: 0%; background: #34d399;
    }
    #fgs-titlecard .brand { font-size: 44px; font-weight: 900; letter-spacing: -1px; }
    #fgs-titlecard .brand span { color: #34d399; }
    #fgs-titlecard .sub { font-size: 17px; font-weight: 700; color: #d1fae5; line-height: 1.4; }
    #fgs-titlecard .meta { font-size: 12px; color: #a7f3d0; opacity: .85; margin-top: 14px; line-height: 1.6; }
    #fgs-dialog-scrim {
      position: fixed; inset: 0; z-index: 99996; background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .22s;
    }
    #fgs-dialog {
      width: 84%; max-width: 320px; background: #26282e; color: #e4e2e6; border-radius: 26px;
      padding: 22px 20px 16px; box-shadow: 0 18px 60px rgba(0,0,0,.6); text-align: center;
      transform: scale(.96); transition: transform .22s;
    }
    #fgs-dialog-scrim.show { opacity: 1; }
    #fgs-dialog-scrim.show #fgs-dialog { transform: scale(1); }
    #fgs-dialog .appicon {
      width: 44px; height: 44px; border-radius: 12px; background: #059669; margin: 0 auto 10px;
      display: flex; align-items: center; justify-content: center; color: #04140d;
    }
    #fgs-dialog .ttl { font-size: 15.5px; font-weight: 600; line-height: 1.4; }
    #fgs-dialog .sub { font-size: 13px; color: #b9b8bd; margin-top: 6px; line-height: 1.4; }
    #fgs-dialog button {
      display: block; width: 100%; border: 0; border-radius: 99px; padding: 11px 0;
      font-size: 13.5px; font-weight: 600; margin-top: 9px; cursor: pointer; font-family: inherit;
    }
    #fgs-dialog .primary { background: #a8c7fa; color: #062e6f; }
    #fgs-dialog .secondary { background: #3a3d45; color: #dcdfe6; }
    #fgs-dialog .text { background: transparent; color: #b9b8bd; }
    #fgs-shade {
      position: fixed; inset: 0; z-index: 99997; transform: translateY(-102%);
      transition: transform .38s cubic-bezier(.2,.8,.25,1); background: rgba(8,10,14,.55);
      backdrop-filter: blur(3px);
    }
    #fgs-shade.show { transform: translateY(0); }
    #fgs-shade .panel {
      background: rgba(16,19,26,.96); border-radius: 0 0 26px 26px; padding: 14px 16px 18px;
      color: #fff; box-shadow: 0 14px 40px rgba(0,0,0,.5);
    }
    #fgs-shade .clockrow { display: flex; align-items: flex-end; justify-content: space-between; padding: 4px 4px 12px; }
    #fgs-shade .clock { font-size: 54px; font-weight: 300; letter-spacing: -1px; line-height: 1; }
    #fgs-shade .date { font-size: 13px; color: #c9cdd6; text-align: right; line-height: 1.5; }
    #fgs-shade .chip {
      display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #cfd4dd;
      background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.14);
      padding: 5px 10px; border-radius: 99px; margin: 0 0 10px 2px;
    }
    #fgs-notif {
      background: #20242c; border-radius: 20px; padding: 13px 15px; cursor: pointer;
      border: 1px solid rgba(255,255,255,.07);
    }
    #fgs-notif .head { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: #9aa1ad; }
    #fgs-notif .head .appicon { width: 15px; height: 15px; border-radius: 4px; background: #059669; }
    #fgs-notif .head .exp { margin-left: auto; }
    #fgs-notif .ttl { font-size: 14.5px; font-weight: 700; color: #f2f3f5; margin-top: 6px; }
    #fgs-notif .txt { font-size: 13.5px; color: #c6cbd4; margin-top: 3px; }
    #fgs-notif .foot { font-size: 11px; color: #7d8492; margin-top: 8px; display: flex; gap: 6px; align-items: center; }
    #fgs-notif .foot .tag { background: rgba(255,255,255,.08); border-radius: 6px; padding: 2px 7px; }
    #fgs-endcard {
      position: fixed; inset: 0; z-index: 99999; display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 0 26px;
      background: linear-gradient(165deg, #022c22 0%, #05392c 60%, #043026 100%); color: #fff;
    }
    #fgs-endcard.show { display: flex; }
    #fgs-endcard .brand { font-size: 30px; font-weight: 900; }
    #fgs-endcard .brand span { color: #34d399; }
    #fgs-endcard .row { font-size: 13px; color: #d1fae5; line-height: 1.55; }
    #fgs-endcard .code {
      font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #a7f3d0;
      background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.3);
      border-radius: 10px; padding: 8px 12px; line-height: 1.6; margin-top: 6px;
    }
    #fgs-endcard .meta { font-size: 11px; color: #86efac; opacity: .8; margin-top: 14px; }
  `;
  document.head.appendChild(css);

  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = (path, size, color) => {
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size); s.setAttribute('height', size);
    s.innerHTML = `<path fill="${color}" d="${path}"/>`;
    return s;
  };
  const P_LOC = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z';
  const P_WIFI = 'M12 21l3.5-4.36A5.9 5.9 0 0 0 12 15.5a5.9 5.9 0 0 0-3.5 1.14L12 21zm0-18C7.31 3 3.07 4.9 0 7.98L2.12 10.1A13.96 13.96 0 0 1 12 6c3.87 0 7.37 1.57 9.88 4.1L24 7.98A16.9 16.9 0 0 0 12 3zm0 6c-2.76 0-5.26 1.12-7.07 2.93l2.12 2.12A6.98 6.98 0 0 1 12 12c1.93 0 3.68.78 4.95 2.05l2.12-2.12A9.94 9.94 0 0 0 12 9z';
  const P_SIG = 'M2 22h20V2L2 22z';
  const P_BATT = 'M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z';
  const P_BIKE = 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.3-9.3l2.2-2.3.7.7c1.3 1.3 3.2 2.1 5.1 2.1V10c-1.5 0-2.9-.6-3.9-1.6l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.2 8.9c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.1zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z';

  // status bar
  const bar = document.createElement('div');
  bar.id = 'fgs-sysbar';
  bar.innerHTML = `<span id="fgs-clock">17:42</span>
    <span class="icons">
      ${svgEl(P_LOC, 12, '#7ee2a8').outerHTML}
      ${svgEl(P_WIFI, 13, '#fff').outerHTML}
      ${svgEl(P_SIG, 12, '#fff').outerHTML}
      ${svgEl(P_BATT, 15, '#fff').outerHTML}
    </span>`;
  document.body.prepend(bar);

  // pill de gestos
  const pill = document.createElement('div');
  pill.id = 'fgs-pill';
  document.body.appendChild(pill);

  // caption
  const cap = document.createElement('div');
  cap.id = 'fgs-caption';
  cap.style.opacity = '0';
  document.body.appendChild(cap);
  window.__fgsCaption = (txt) => {
    if (!txt) { cap.style.opacity = '0'; return; }
    cap.innerHTML = '';
    cap.appendChild(document.createTextNode(txt));
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.id = 'fgs-capdots';
    dots.innerHTML = '<i></i><i></i><i></i>';
    cap.appendChild(dots);
    cap.style.opacity = '1';
  };
  // latido de los puntos: garantiza un frame nuevo ~3 veces por segundo
  // (el grabador descarta frames “similares” y comprimiría la duración)
  let hbPhase = 0;
  setInterval(() => {
    hbPhase = (hbPhase + 1) % 3;
    document.querySelectorAll('#fgs-capdots i').forEach((el, idx) => {
      el.style.opacity = idx === hbPhase ? '1' : '.3';
    });
  }, 100);

  // title card
  const tc = document.createElement('div');
  tc.id = 'fgs-titlecard';
  tc.innerHTML = `
    <div class="brand">Cumbre<span>30</span></div>
    <div class="sub">Demostración de uso de la ubicación<br>en servicio en primer plano</div>
    <div class="meta">cl.cumbre30.app · Cumbre GEO · v1.8.2 (build 27)<br>
    Permiso declarado: android.permission.FOREGROUND_SERVICE_LOCATION</div>
    <div class="hb"><i id="fgs-title-hb"></i></div>`;
  document.body.appendChild(tc);
  const t0 = performance.now();
  window.__fgsTitleTimer = setInterval(() => {
    const el = document.getElementById('fgs-title-hb');
    if (!el) return;
    el.style.width = (((performance.now() - t0) / 3400) % 1) * 100 + '%';
  }, 90);
  window.__fgsTitleOut = () => {
    clearInterval(window.__fgsTitleTimer);
    tc.style.opacity = '0'; setTimeout(() => tc.remove(), 500);
  };

  // diálogo de permiso Android
  window.__fgsDialog = () => new Promise((resolve) => {
    const scrim = document.createElement('div');
    scrim.id = 'fgs-dialog-scrim';
    scrim.innerHTML = `
      <div id="fgs-dialog">
        <div class="appicon">${svgEl(P_BIKE, 26, '#04140d').outerHTML}</div>
        <div class="ttl">¿Permitir que <b>Cumbre30</b> acceda a la ubicación de este dispositivo?</div>
        <div class="sub">Se usa el GPS mientras la app está abierta para fiscalizar el límite de 30 km/h</div>
        <button class="primary">Mientras se usa la app</button>
        <button class="secondary">Solo esta vez</button>
        <button class="text">No permitir</button>
      </div>`;
    document.body.appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add('show'));
    scrim.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      scrim.classList.remove('show');
      setTimeout(() => scrim.remove(), 240);
      resolve(b.textContent);
    }));
  });

  // shade de notificaciones con la notificación EXACTA del FGS
  window.__fgsShade = (down) => new Promise((resolve) => {
    let sh = document.getElementById('fgs-shade');
    if (down) {
      if (sh) { resolve(); return; }
      sh = document.createElement('div');
      sh.id = 'fgs-shade';
      sh.innerHTML = `
        <div class="panel">
          <div class="clockrow">
            <div class="clock" id="fgs-shade-clock">17:42</div>
            <div class="date">vie 7 de noviembre<br><span style="opacity:.7">85% · wifi</span></div>
          </div>
          <div class="chip">● 1 app activa · ubicación en uso</div>
          <div id="fgs-notif" title="Toca para volver a la app">
            <div class="head"><span class="appicon"></span><span>Cumbre30</span><span>·</span><span>ahora</span>
              <span class="exp">⌃</span></div>
            <div class="ttl">Cumbre30 · ride en curso</div>
            <div class="txt">Límite 30 km/h · GPS activo en segundo plano</div>
            <div class="foot"><span class="tag">Notificación continua</span><span class="tag">Canal: Ride en curso</span></div>
          </div>
        </div>`;
      document.body.appendChild(sh);
      requestAnimationFrame(() => requestAnimationFrame(() => sh.classList.add('show')));
      setTimeout(() => {
        document.getElementById('fgs-notif').addEventListener('click', () => {
          window.__fgsShade(false).then(resolve);
        }, { once: true });
      }, 450);
    } else {
      if (!sh) { resolve(); return; }
      sh.classList.remove('show');
      setTimeout(() => { sh.remove(); resolve(); }, 420);
    }
  });

  // end card
  window.__fgsEndcard = () => {
    const e = document.createElement('div');
    e.id = 'fgs-endcard';
    e.innerHTML = `
      <div class="brand">Cumbre<span>30</span></div>
      <div class="row">Servicio en primer plano de ubicación<br><b>RideLocationService</b> · foregroundServiceType="location"</div>
      <div class="code">ACCESS_FINE_LOCATION · ACCESS_COARSE_LOCATION<br>
      FOREGROUND_SERVICE · FOREGROUND_SERVICE_LOCATION<br>POST_NOTIFICATIONS</div>
      <div class="row" style="margin-top:6px">Notificación persistente:<br>“Cumbre30 · ride en curso — Límite 30 km/h · GPS activo en segundo plano”</div>
      <div class="meta">Cumbre GEO · cl.cumbre30.app · v1.8.2 (build 27)</div>
      <div class="hb"><i id="fgs-end-hb"></i></div>`;
    document.body.appendChild(e);
    const t0 = performance.now();
    setInterval(() => {
      const el = document.getElementById('fgs-end-hb');
      if (!el) return;
      el.style.width = (((performance.now() - t0) / 5600) % 1) * 100 + '%';
    }, 90);
    requestAnimationFrame(() => e.classList.add('show'));
  };

  // reloj del sistema + shade
  window.__fgsTickClock = (txt) => {
    const c = document.getElementById('fgs-clock');
    const sc = document.getElementById('fgs-shade-clock');
    if (c) c.textContent = txt;
    if (sc) sc.textContent = txt;
  };
  return true;
})()
"""

# ---------------------------------------------------------- grabación


async def main():
    start, dense, cum = build_route()
    total_m = cum[-1]
    print(f"ruta: {len(dense)} pts, {total_m:.0f} m; inicio {start[0]:.6f},{start[1]:.6f}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            args=[
                "--enable-unsafe-swiftshader",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--disable-dev-shm-usage",
                "--force-color-profile=srgb",
                "--hide-scrollbars",
            ]
        )
        ctx = await browser.new_context(
            viewport={"width": 412, "height": 732},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            locale="es-CL",
            timezone_id="America/Santiago",
            permissions=["geolocation"],
        )
        await ctx.add_init_script(
            "try{localStorage.setItem('theme','dark');localStorage.setItem('color-scheme','dark');}catch(e){}"
        )
        await ctx.set_geolocation({"latitude": start[0], "longitude": start[1], "accuracy": 8})

        page = await ctx.new_page()
        await page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        await page.evaluate(OVERLAY_JS)
        print("página cargada, overlays listos")

        # --- grabación CDP propia: screencast con timestamps de reloj real.
        # (El videoRecorder de Playwright depende de metadata.timestamp, que
        # en headless_shell llega vacío y comprime la duración a frames/25.)
        cdp = await ctx.new_cdp_session(page)
        frames: list[tuple[float, bytes]] = []

        def on_screencast(params):
            frames.append((time.monotonic(), base64.b64decode(params["data"])))
            asyncio.ensure_future(
                cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]})
            )

        cdp.on("Page.screencastFrame", on_screencast)
        await cdp.send(
            "Page.startScreencast",
            {"format": "jpeg", "quality": 90, "maxWidth": 824, "maxHeight": 1465, "everyNthFrame": 1},
        )

        # reloj del sistema: 17:42 → avanza con la grabación
        clock_task = asyncio.create_task(advance_clock(page))

        # feed GPS a 1 Hz (como el FGS nativo)
        feed_task = asyncio.create_task(gps_feed(ctx, dense, cum))

        # espera a que la app esté hidratada y el GPS "activo"
        try:
            await page.wait_for_selector('text=GPS activo', timeout=15000)
            print("GPS activo")
        except Exception:
            print("chip GPS activo no visto (se continúa igual)")

        # título 3.4 s
        await page.wait_for_timeout(3400)
        await page.evaluate("window.__fgsTitleOut()")
        await page.evaluate("window.__fgsCaption('App abierta · GPS activo con la fuente «GPS real»')")
        await page.wait_for_timeout(1200)

        # configuración → fuente GPS real
        await page.locator('[aria-label="Abrir menú"]').click()
        await page.wait_for_timeout(900)
        await page.get_by_role("button", name=re.compile("Configuración")).click()
        await page.wait_for_timeout(900)
        await page.get_by_role("radio", name="GPS real").click()
        await page.evaluate("window.__fgsCaption('Fuente «GPS real» seleccionada en Configuración')")
        await page.wait_for_timeout(1000)
        await page.get_by_role("button", name="Ride", exact=True).click()
        await page.wait_for_timeout(900)

        # iniciar ride → diálogo de permiso Android
        await page.evaluate("window.__fgsCaption('Al iniciar el ride, Android solicita el permiso de ubicación')")
        await page.get_by_role("button", name="Iniciar ride").click()
        await page.wait_for_timeout(500)
        dialog_task = asyncio.create_task(page.evaluate("window.__fgsDialog()"))
        await page.wait_for_timeout(3600)
        await page.locator("#fgs-dialog .primary").click(timeout=15000)
        choice = await dialog_task
        print(f"permiso: {choice}")
        await page.wait_for_timeout(700)

        # ride: GPS en primer plano fiscalizando 30 km/h
        await page.evaluate("window.__fgsCaption('Uso de ubicación en primer plano: la app fiscaliza el límite de 30 km/h')")

        # exceso → esperar el BANNER rojo (role=status con el texto
        # completo; la bitácora usa «¡Exceso!» y no debe matchear)
        await wait_banner(page, 'div[role="status"]:has-text("EXCESO DE VELOCIDAD")', timeout=40)
        print("banner de exceso visible")
        await page.wait_for_timeout(6000)

        # shade de notificaciones (el ride sigue corriendo debajo)
        await page.evaluate("(() => { window.__fgsShade(true); })()")
        await page.wait_for_timeout(600)
        await page.evaluate("window.__fgsCaption('Servicio en primer plano: notificación permanente mientras el GPS sigue activo')")
        await page.wait_for_timeout(6500)
        await page.evaluate("(() => { window.__fgsShade(false); })()")
        await page.evaluate("window.__fgsCaption('Al tocar la notificación vuelves a la app: el ride nunca se detuvo')")
        print("shade demostrado")

        # el exceso aún visible un momento, luego se normaliza y se finaliza
        await page.wait_for_timeout(2500)
        await page.wait_for_timeout(5000)
        await page.locator('button[aria-label="Finalizar y guardar ride"]').click()
        await page.evaluate("window.__fgsCaption('Ride finalizado y guardado · el GPS se detiene con el servicio')")
        await page.wait_for_timeout(1800)

        # end card
        await page.evaluate("window.__fgsEndcard()")
        await page.wait_for_timeout(5600)

        feed_task.cancel()
        clock_task.cancel()
        await cdp.send("Page.stopScreencast")
        await page.wait_for_timeout(400)
        await browser.close()

        if len(frames) < 2:
            raise RuntimeError("no se capturaron frames del screencast")
        outdir = Path("/tmp/fgs-frames")
        shutil.rmtree(outdir, ignore_errors=True)
        outdir.mkdir(parents=True)
        lines = ["ffconcat version 1.0"]
        for i, (t, buf) in enumerate(frames):
            (outdir / f"f{i:06d}.jpg").write_bytes(buf)
            if i + 1 < len(frames):
                dt = frames[i + 1][0] - t
            else:
                dt = frames[-1][0] - frames[-2][0] if len(frames) > 1 else 0.5
            dt = max(0.02, min(5.0, dt))
            lines.append(f"file 'f{i:06d}.jpg'")
            lines.append(f"duration {dt:.3f}")
        lines.append(f"file 'f{len(frames) - 1:06d}.jpg'")
        (outdir / "list.txt").write_text("\n".join(lines) + "\n")
        wall = frames[-1][0] - frames[0][0]
        print(f"frames capturados: {len(frames)} · duración real: {wall:.1f} s → {outdir}")


async def advance_clock(page):
    """Reloj del status bar: 17:42 → 17:43 → … (1 min real)."""
    base_min = 17 * 60 + 42
    for i in range(0, 200, 10):  # se cancela desde main al terminar
        m = base_min + i // 60
        txt = f"{m // 60:02d}:{m % 60:02d}"
        try:
            await page.evaluate(f"window.__fgsTickClock('{txt}')")
        except Exception:
            return
        await page.wait_for_timeout(10_000)


async def gps_feed(ctx, dense, cum):
    """Feed de fixes a 1 Hz: avanza por la ruta según el perfil de
    velocidad; sin ride activo queda detenido en el punto inicial."""
    t0 = asyncio.get_event_loop().time()
    dist = 0.0
    started = False
    t_start = None
    for step in range(300):  # se cancela desde main al terminar
        now = asyncio.get_event_loop().time() - t0
        # el ride arranca ~10.4 s después de cargar la página
        if not started and now >= 10.4:
            started = True
            t_start = now
        if started:
            t_ride = now - t_start
            if t_ride > RIDE_TOTAL_S + 4:
                v = 0.0
            else:
                v = speed_at(t_ride) / 3.6  # m/s
            dist += v * 1.0
            alt = 832 - (dist / max(1.0, cum[-1])) * 70
            acc = 6 + 3 * abs(math.sin(step * 0.7))
            # rumbo hacia el siguiente punto
            here = pos_at(dense, cum, dist)
            nxt = pos_at(dense, cum, min(dist + 12, cum[-1]))
            brg = math.degrees(math.atan2(nxt[1] - here[1], nxt[0] - here[0])) % 360
            jitter = 0.0000055  # ~0.6 m: ruido GPS realista sin disparar
            # picos de velocidad derivada de deltas (la app calcula
            # km/h por haversine entre fixes consecutivos)
            lat = here[0] + (jitter * math.sin(step * 2.1))
            lon = here[1] + (jitter * math.cos(step * 1.7))
            await ctx.set_geolocation({
                "latitude": lat, "longitude": lon,
                "accuracy": round(acc, 1), "altitude": alt,
                "heading": brg, "speed": max(0.0, v),
            })
        await asyncio.sleep(1.0)


async def wait_banner(page, selector, timeout=30, require=True):
    try:
        await page.wait_for_selector(selector, timeout=timeout * 1000, state="visible")
        return True
    except Exception:
        if require:
            print(f"AVISO: banner '{selector}' no apareció")
        return False


if __name__ == "__main__":
    asyncio.run(main())
