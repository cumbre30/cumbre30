/* ============================================================
   CUMBRE30 · Prototipo navegable - Fase 2 rediseño UX/UI
   Todo simulado en memoria. Sin datos reales del usuario.
   ============================================================ */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- toast ---------------- */
let toastT = 0;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), 2400);
}

/* ---------------- mapa SVG estilizado ---------------- */
function mapSVG() {
  return `
<svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
  <rect width="400" height="640" fill="#0C1512"/>
  <!-- manchas urbanas -->
  <g fill="#0F1A16">
    <rect x="0" y="430" width="400" height="210"/>
    <rect x="260" y="0" width="140" height="430"/>
  </g>
  <!-- cerro: parque -->
  <path d="M150 40 C190 45 225 70 235 110 C245 150 240 190 255 230 C268 268 260 310 235 345 C210 380 170 395 130 385 C95 376 70 345 68 300 C66 260 80 230 75 190 C70 150 85 100 110 70 C122 55 135 45 150 40 Z"
        fill="#123527" stroke="#1D5741" stroke-width="2"/>
  <!-- curvas de nivel -->
  <g fill="none" stroke="#163D2D" stroke-width="1.4">
    <path d="M150 80 C180 84 205 105 210 135 C215 165 210 185 220 215 C230 245 224 275 205 300 C185 326 155 338 128 330"/>
    <path d="M148 120 C170 124 188 140 192 162 C196 184 190 205 200 230 C208 252 202 275 188 292"/>
    <path d="M146 160 C160 163 172 175 175 190 C178 205 174 220 182 238"/>
  </g>
  <!-- calles urbanas -->
  <g stroke="#1B2622" stroke-linecap="round" fill="none">
    <path d="M-10 560 H410" stroke-width="11"/>
    <path d="M-10 600 H410" stroke-width="6"/>
    <path d="M-10 505 H410" stroke-width="6"/>
    <path d="M120 660 L138 430" stroke-width="7"/>
    <path d="M300 660 L285 430" stroke-width="7"/>
    <path d="M40 660 L100 460" stroke-width="5"/>
    <path d="M370 660 L320 440" stroke-width="5"/>
    <path d="M262 0 L300 430" stroke-width="5"/>
    <path d="M60 470 C120 455 220 455 330 470" stroke-width="5"/>
  </g>
  <!-- rótulos urbanos -->
  <g fill="#33453D" font-family="system-ui" font-size="11" font-weight="700">
    <text x="14" y="548">AV. PROVIDENCIA</text>
    <text x="66" y="625">BELLAVISTA</text>
  </g>
  <!-- camino al cerro (vía compartida) -->
  <g fill="none" stroke="#2A3B33" stroke-width="6" stroke-linecap="round">
    <path d="M138 430 C142 390 150 370 148 340 C146 310 158 290 162 260 C166 230 172 200 172 158"/>
  </g>
  <!-- POIs -->
  <g font-family="system-ui" font-size="11.5" font-weight="700" fill="#B9CCC2">
    <circle cx="172" cy="150" r="5" fill="#A7E5BD"/><text x="182" y="146">Cumbre</text>
    <circle cx="212" cy="232" r="4" fill="#5F8A74"/><text x="221" y="229">Tupahue</text>
    <circle cx="148" cy="252" r="4" fill="#5F8A74"/><text x="90" y="249">J. Japonés</text>
    <circle cx="142" cy="378" r="4" fill="#5F8A74"/><text x="80" y="398">Zoológico</text>
    <text x="120" y="446" fill="#4E675B">Pío Nono</text>
  </g>
  <!-- ruta planificada (se activa por JS) -->
  <g id="routeG" style="display:none">
    <path d="M138 470 C140 450 139 445 138 430 C142 390 150 370 148 340 C146 310 158 290 162 260 C166 230 172 200 172 158"
          fill="none" stroke="#0C1512" stroke-width="9" stroke-linecap="round" opacity=".8"/>
    <path d="M138 470 C140 450 139 445 138 430" fill="none" stroke="#A78BFA" stroke-width="5" stroke-linecap="round"/>
    <path d="M138 430 C142 390 150 370 148 340 C146 310 158 290 162 260 C166 230 172 200 172 158"
          fill="none" stroke="#F5F8F6" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="1 9"/>
    <circle cx="138" cy="470" r="6" fill="#101C19" stroke="#A78BFA" stroke-width="3"/>
    <circle cx="172" cy="152" r="7" fill="#075C3B" stroke="#A7E5BD" stroke-width="3"/>
  </g>
  <!-- tú -->
  <g id="userG">
    <circle cx="138" cy="470" r="14" fill="#00A86B" opacity=".18">
      <animate attributeName="r" values="10;18;10" dur="2.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values=".28;.05;.28" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="138" cy="470" r="7" fill="#00A86B" stroke="#04110b" stroke-width="2.5"/>
  </g>
</svg>`;
}
$("#bigMap").innerHTML = mapSVG();
$("#miniMap").innerHTML = mapSVG();

function setRouteVisible(on) {
  $$("#routeG").forEach((g) => (g.style.display = on ? "" : "none"));
}

/* ---------------- navegación de pantallas ---------------- */
const MAIN = new Set(["ride", "explorar", "acceso"]);
function go(name) {
  $$(".screen").forEach((s) => s.classList.remove("on"));
  const sc = $("#screen-" + name);
  if (sc) sc.classList.add("on");
  $$(".bn").forEach((b) => b.classList.toggle("on", b.dataset.go === name));
  closeDrawer();
  if (MAIN.has(name)) $("#bottomNav") && null;
}
$$("[data-go]").forEach((b) =>
  b.addEventListener("click", () => {
    const dest = b.dataset.go;
    if (dest === "premios-toast") {
      closeDrawer();
      toast("Premios y desafíos - sección existente, vivirá dentro de “Mi actividad”");
      return;
    }
    go(dest);
  })
);

/* ---------------- drawer ---------------- */
const drawer = $("#drawer"), backdrop = $("#backdrop");
function openDrawer() { drawer.classList.add("on"); backdrop.classList.add("on"); }
function closeDrawer() { drawer.classList.remove("on"); backdrop.classList.remove("on"); }
$("#btnMenu").addEventListener("click", openDrawer);
$("#drawerX").addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);

/* ---------------- plan FREE / PRO ---------------- */
let plan = localStorage.getItem("c30-proto-plan") || "free";
function setPlan(p, silent) {
  plan = p;
  localStorage.setItem("c30-proto-plan", p);
  const pro = p === "pro";
  // header + menú + perfil
  const hdr = $("#hdrPlan");
  hdr.textContent = pro ? "PRO" : "FREE";
  hdr.classList.toggle("pro", pro);
  $("#menuPlan").textContent = pro ? "PRO" : "FREE";
  $("#menuPlan").classList.toggle("pro", pro);
  $("#menuPlanTxt").textContent = pro ? "Pago único activo · toca para ver beneficios" : "Funciones básicas · toca para ver planes";
  $("#perfilPlan").textContent = pro ? "PRO" : "FREE";
  $("#perfilPlan").classList.toggle("pro", pro);
  // tarjeta del menú
  $("#menuProCard").innerHTML = pro
    ? `<div class="pro-card done"><span class="pro-badge" style="background:rgba(0,168,107,.2);color:var(--verde-luz)">CUMBRE30 PRO</span>
       <p style="margin-bottom:0">Pro activo en este teléfono. Gracias por apoyar el proyecto 🙌</p></div>`
    : `<div class="pro-card"><span class="pro-badge">CUMBRE30 PRO</span>
       <p>Planifica mejor tus rutas y desbloquea herramientas avanzadas para tus subidas.</p>
       <button class="btn btn-primary btn-sm btn-block" id="menuDiscoverPro">Descubrir PRO</button></div>`;
  $("#menuDiscoverPro")?.addEventListener("click", () => { closeDrawer(); go("planes"); });
  // buscador
  $("#searchLock").style.display = pro ? "none" : "";
  // planes
  $("#plansHero").style.display = pro ? "none" : "";
  $("#plansActive").style.display = pro ? "" : "none";
  // historial
  $("#histQuota").textContent = pro ? "PDF: ilimitadas" : "PDF: 2/3 este mes";
  $("#histQuota").classList.toggle("pro", pro);
  $("#histNote").textContent = pro
    ? "PRO activo: constancias PDF ilimitadas y export GPX de tus viajes con GPS."
    : "Las constancias PDF son 3 al mes en FREE. Con PRO: ilimitadas + export GPX de viajes con GPS.";
  // segmentos
  $("#segTeaser").innerHTML = pro
    ? `<span class="emoji" style="font-size:20px">🏁</span>
       <div class="grow"><b style="font-size:13.5px">Segmento Pío Nono → Cumbre</b>
       <div class="tiny muted">Tu récord: 23:41 · 2 intentos registrados</div></div>
       <svg class="ic" style="color:var(--ok)"><use href="#i-check"/></svg>`
    : `<span class="emoji" style="font-size:20px">🏁</span>
       <div class="grow"><b style="font-size:13.5px">Segmentos del cerro</b>
       <div class="tiny muted">Pío Nono → Cumbre · tu récord personal e historial</div></div>
       <span class="tag-pro"><svg class="ic"><use href="#i-lock"/></svg> PRO</span>`;
  // perfil pro
  $("#perfilPro").innerHTML = pro
    ? `<div class="row"><svg class="ic" style="color:var(--ok)"><use href="#i-check"/></svg>
       <div class="grow"><b style="font-size:13.5px">Cumbre30 Pro activo</b><div class="tiny muted">Licencia offline vinculada a martin.rojas@email.cl</div></div></div>
       <button class="btn btn-outline btn-sm btn-block" id="proDeact" style="margin-top:12px">Quitar licencia de este teléfono</button>`
    : `<p class="prose" style="margin-bottom:10px">Activa tu licencia con el código que recibiste al comprar. Funciona 100% sin conexión.</p>
       <div class="row"><input id="proCode" placeholder="C30P-XXXX-XXXX-XXXX-XXXX"
         style="flex:1;background:var(--card-2);border:1px solid var(--line);border-radius:11px;color:var(--tx);padding:11px 12px;font:inherit;font-size:13px;outline:none" />
       <button class="btn btn-primary btn-sm" id="proActivate">Activar</button></div>
       <button class="btn btn-primary btn-sm" id="proBuy2" style="margin-top:10px">No tengo código · Ver planes</button>`;
  $("#proActivate")?.addEventListener("click", () => {
    const v = ($("#proCode")?.value || "").trim();
    if (/^C30P-/i.test(v)) { setPlan("pro"); toast("¡Cumbre30 Pro activado! 🎉"); }
    else toast("Código inválido - prueba con un código C30P-…");
  });
  $("#proBuy2")?.addEventListener("click", () => go("planes"));
  $("#proDeact")?.addEventListener("click", () => { setPlan("free"); toast("Licencia quitada de este teléfono."); });
  // segmento control superior
  $$("#planSeg button").forEach((b) => b.classList.toggle("on", b.dataset.plan === p));
  if (!silent) toast(pro ? "Modo PRO - mira qué se desbloquea" : "Modo FREE");
}
$$("#planSeg button").forEach((b) => b.addEventListener("click", () => setPlan(b.dataset.plan)));

/* ---------------- modal PRO contextual ---------------- */
const proModal = $("#proModal");
function openProModal() { proModal.classList.add("on"); }
function closeProModal() { proModal.classList.remove("on"); }
$("#proModalX").addEventListener("click", closeProModal);
$("#proModalNo").addEventListener("click", () => { closeProModal(); toast("Puedes seguir usando el mapa y los destinos del cerro"); });
$("#proModalCta").addEventListener("click", () => { closeProModal(); go("planes"); });
proModal.addEventListener("click", (e) => { if (e.target === proModal) closeProModal(); });

/* ---------------- buscador universal ---------------- */
const sp = $("#searchPanel"), spInput = $("#spInput"), spList = $("#spList");
function openSearch() {
  if (plan !== "pro") { openProModal(); return; }
  sp.classList.add("on");
  setTimeout(() => spInput.focus(), 60);
}
$("#btnSearch").addEventListener("click", openSearch);
$("#spBack").addEventListener("click", () => sp.classList.remove("on"));

const FAKE_ADDR = [
  { name: "Av. Providencia 1234", detail: "Providencia, Región Metropolitana", emoji: "📍", km: "2.4", min: "10" },
  { name: "Calle Normandie 456", detail: "Providencia, Región Metropolitana", emoji: "🏙️", km: "3.1", min: "13" },
  { name: "Parque Metropolitano · Acceso Pío Nono", detail: "Recoleta, Región Metropolitana", emoji: "🌳", km: "0.4", min: "3" },
  { name: "Cumbre del Cerro San Cristóbal", detail: "Parque Metropolitano de Santiago", emoji: "🏔️", km: "4.8", min: "28" },
];
let debT = 0;
spInput.addEventListener("input", () => {
  clearTimeout(debT);
  const q = spInput.value.trim();
  if (q.length < 4) { spList.innerHTML = `<div class="empty-note">Escribe al menos 4 caracteres.<br/>Ej: <b>Av Providencia 1234</b></div>`; return; }
  spList.innerHTML = `<div class="empty-note">Buscando direcciones…</div>`;
  debT = setTimeout(() => {
    const res = FAKE_ADDR.filter((a) => (a.name + " " + a.detail).toLowerCase().includes(q.toLowerCase().slice(0, 6)));
    if (!res.length) { spList.innerHTML = `<div class="empty-note">Sin resultados para “${q}”.<br/>Prueba con otra dirección cercana.</div>`; return; }
    spList.innerHTML = "";
    res.forEach((a) => {
      const b = document.createElement("button");
      b.className = "addr";
      b.innerHTML = `<span class="emoji">${a.emoji}</span><span class="grow"><b>${a.name}</b><small>${a.detail}</small></span><span class="go"><svg class="ic" style="width:18px;height:18px"><use href="#i-route"/></svg></span>`;
      b.addEventListener("click", () => { traceTo(a.name, `${a.km} km · ~${a.min} min`); sp.classList.remove("on"); });
      spList.appendChild(b);
    });
  }, 450);
});

/* ---------------- rutas a destinos ---------------- */
function traceTo(name, meta) {
  setRouteVisible(true);
  $("#rcName").textContent = name;
  $("#rcMeta").textContent = meta;
  $("#routeChip").classList.add("on");
  $("#miniBadge").textContent = "→ " + name;
  toast("Ruta trazada: " + name + " · " + meta);
}
$$(".poi").forEach((b) =>
  b.addEventListener("click", () => traceTo(b.dataset.poi, `${b.dataset.km} km · ~${b.dataset.min} min`))
);
$("#rcClose").addEventListener("click", () => {
  setRouteVisible(false);
  $("#routeChip").classList.remove("on");
  $("#miniBadge").textContent = "Tu posición";
});

$("#btnLocate").addEventListener("click", () => toast("Centrando en tu posición…"));
$("#btnLayers").addEventListener("click", (e) => { e.currentTarget.classList.toggle("on"); toast("Capas: mapa base · ciclovías · incidencias"); });

/* ---------------- QR ---------------- */
(function makeQR() {
  const svg = $("#qrSvg");
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20);
  let d = "";
  for (let y = 0; y < 29; y++)
    for (let x = 0; x < 29; x++)
      if (!inFinder(x, y) && rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`;
  let f = "";
  const finder = (fx, fy) => {
    f += `M${fx} ${fy}h7v7h-7z M${fx + 1} ${fy + 1}h5v5h-5z M${fx + 2} ${fy + 2}h3v3h-3z`;
    return `<path d="${`M${fx + 1} ${fy + 1}h5v5h-5z M${fx + 2} ${fy + 2}h3v3h-3z`}" fill="#101C19"/>`;
  };
  svg.innerHTML = `<rect width="29" height="29" fill="#fff"/><path d="${d}" fill="#101C19"/>
    ${finder(0, 0)}${finder(22, 0)}${finder(0, 22)}
    <path d="M1 1h5v5h-5z M23 1h5v5h-5z M1 23h5v5h-5z" fill="#101C19"/>`;
})();
$("#btnQrLoad").addEventListener("click", () => toast("En la app: eliges foto o captura del QR de Parquemet"));
$("#btnQrBig").addEventListener("click", () => {
  const f = $("#qrFrame");
  const big = f.style.width !== "290px";
  f.style.width = f.style.height = big ? "290px" : "240px";
  f.style.transition = "all .2s";
  toast(big ? "Pantalla completa + brillo al máximo" : "Tamaño normal");
});
$("#btnMedEdit").addEventListener("click", () => toast("Editar ficha médica (existente en la app)"));
$("#ayudaWsp").addEventListener("click", (e) => { e.preventDefault(); toast("Abriría WhatsApp: +56 9 4296 1619"); });
$("#ayudaMail").addEventListener("click", (e) => { e.preventDefault(); toast("Abriría correo: contacto.cumbre30@gmail.com"); });

/* ---------------- motor de ride (simulado) ---------------- */
const R = {
  state: "idle", speed: 0, target: 22, dist: 0, elapsed: 0, max: 0, gain: 0,
  slope: 4.2, acc: 6, insidePark: false, src: "demo", events: [],
  warned: false, everOver: false,
};
const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const nowT = () => new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

function logEvent(kind, text) {
  R.events.unshift({ kind, text, t: nowT() });
  renderBitacora();
}
function renderBitacora() {
  const ul = $("#bitacora");
  if (!R.events.length) { ul.innerHTML = `<li class="empty-note" style="border:0">Sin eventos aún - los avisos de zona, geocercas y excesos aparecerán aquí.</li>`; return; }
  ul.innerHTML = R.events
    .map((e) => `<li><span class="b-dot ${e.kind}"></span><span class="grow">${e.text}</span><time>${e.t}</time></li>`)
    .join("");
}

function renderRide() {
  $("#spdNum").textContent = Math.round(R.speed);
  $("#distNum").textContent = R.dist.toFixed(2);
  $("#timeNum").textContent = fmtT(R.elapsed);
  $("#stMax").textContent = R.max.toFixed(1);
  $("#stAvg").textContent = R.elapsed > 3 ? (R.dist / (R.elapsed / 3600)).toFixed(1) : "0.0";
  $("#stGain").textContent = Math.round(R.gain);
  $("#stSlope").textContent = (R.slope > 0 ? "+" : "") + R.slope.toFixed(1);
  $("#stAcc").textContent = R.acc;
  $("#stPark").textContent = R.state === "idle" ? "-" : R.insidePark ? "Sí" : "No";
  const off = 628 - Math.min(R.speed / 45, 1) * 628;
  $("#arcVal").style.strokeDashoffset = off;

  const hero = $("#speedHero");
  const over = R.insidePark && R.speed > 30;
  const caution = R.insidePark && !over && R.speed > 26;
  hero.classList.toggle("over", over);
  hero.classList.toggle("caution", caution);
  hero.classList.toggle("idle", R.state === "idle");

  const zb = $("#zoneBanner"), zt = $("#zoneTxt");
  if (R.state === "idle") { zb.className = "zone-banner park"; zt.textContent = "MODO PARQUEMET · límite 30 km/h"; }
  else if (over) { zb.className = "zone-banner over"; zt.textContent = `¡EXCESO! ${Math.round(R.speed)} km/h · límite 30`; }
  else if (caution) { zb.className = "zone-banner warn"; zt.textContent = "PRECAUCIÓN · te acercas al límite de 30 km/h"; }
  else if (R.insidePark) { zb.className = "zone-banner park"; zt.textContent = "MODO PARQUEMET · límite 30 km/h"; }
  else { zb.className = "zone-banner"; zt.textContent = "MODO LIBRE · fuera del parque"; }

  const cta = $("#mainCta");
  if (R.state === "idle")
    cta.innerHTML = `<button class="btn btn-primary btn-start" id="btnStart"><svg class="ic"><use href="#i-play"/></svg> Iniciar ride</button>`;
  else if (R.state === "riding")
    cta.innerHTML = `<button class="btn btn-outline" id="btnPause"><svg class="ic"><use href="#i-pause"/></svg> Pausar</button>
      <button class="btn btn-danger btn-icon-sq" id="btnFinish" aria-label="Finalizar"><svg class="ic"><use href="#i-stop"/></svg></button>`;
  else
    cta.innerHTML = `<button class="btn btn-primary btn-start" id="btnResume"><svg class="ic"><use href="#i-play"/></svg> Reanudar</button>
      <button class="btn btn-danger btn-icon-sq" id="btnFinish" aria-label="Finalizar"><svg class="ic"><use href="#i-stop"/></svg></button>`;
  $("#btnStart")?.addEventListener("click", startRide);
  $("#btnPause")?.addEventListener("click", () => { R.state = "paused"; logEvent("info", "Ride en pausa"); renderRide(); });
  $("#btnResume")?.addEventListener("click", () => { R.state = "riding"; logEvent("info", "Ride reanudado"); renderRide(); });
  $("#btnFinish")?.addEventListener("click", finishRide);
}

function startRide() {
  R.state = "riding";
  R.dist = 0; R.elapsed = 0; R.max = 0; R.gain = 0; R.speed = 0;
  R.events = []; R.insidePark = false; R.warned = false; R.everOver = false;
  logEvent("info", `Ride iniciado · fuente: ${R.src === "demo" ? "Demo" : "GPS real"}`);
  renderRide();
}

function finishRide() {
  const d = R.dist.toFixed(1), t = fmtT(R.elapsed);
  R.state = "idle";
  renderRide();
  // agrega el viaje al historial (stub)
  const list = $("#screen-historial .list-card");
  const div = document.createElement("div");
  div.className = "ride-item";
  div.innerHTML = `<span class="d">HOY</span><span class="grow"><b>Viaje recién terminado</b>
    <small>hoy · ${d} km · ${t} · máx ${R.max.toFixed(1)}</small></span>
    <span class="act"><button class="btn btn-ghost btn-sm">PDF</button></span>`;
  list.prepend(div);
  toast(`Viaje guardado en Historial ✓ · ${d} km en ${t}`);
}

/* tick cada segundo */
setInterval(() => {
  if (R.state !== "riding") return;
  R.elapsed++;
  // física simple
  if (Math.random() < 0.12) R.target = 14 + Math.random() * 14;          // cambia ritmo
  if (R.elapsed === 26 && !R.insidePark) { R.target = 30.5; }            // pique breve de exceso
  if (R.elapsed === 29) { R.target = 21; }
  R.speed += (R.target - R.speed) * 0.35;
  if (Math.random() < 0.08) R.slope = -3 + Math.random() * 11;
  R.dist += R.speed / 3600;
  R.max = Math.max(R.max, R.speed);
  if (R.slope > 0) R.gain += R.speed / 3.6 * (R.slope / 100);
  R.acc = Math.max(3, Math.min(12, R.acc + (Math.random() < 0.2 ? (Math.random() - 0.5) * 4 : 0)));
  R.acc = Math.round(R.acc);

  // geocerca: entrada al parque
  if (!R.insidePark && R.elapsed >= 12) {
    R.insidePark = true;
    logEvent("info", "Ingreso a Parquemet detectado - portada Pío Nono");
  }
  // avisos de velocidad
  const over = R.insidePark && R.speed > 30;
  const caution = R.insidePark && !over && R.speed > 26;
  if (over && !R.everOver) { R.everOver = true; logEvent("danger", `Exceso: ${Math.round(R.speed)} km/h en zona 30`); }
  if (caution && !R.warned) { R.warned = true; logEvent("warn", `Precaución - vas a ${Math.round(R.speed)} km/h, límite 30`); }
  renderRide();
}, 1000);

/* ---------------- configuración ---------------- */
$$("#srcSeg button").forEach((b) =>
  b.addEventListener("click", () => {
    $$("#srcSeg button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    R.src = b.dataset.src;
    toast(`Fuente de datos: ${R.src === "demo" ? "Demo" : "GPS real"} - ya no compite con el botón Iniciar`);
  })
);
$$(".sw").forEach((b) => b.addEventListener("click", () => b.classList.toggle("on")));

/* ---------------- planes: comprar (simulado) ---------------- */
$("#btnBuy").addEventListener("click", () => {
  toast("Demo - en la app abre Mercado Pago (mpago.la/1WdyZaW)");
  setTimeout(() => setPlan("pro"), 700);
});

/* ---------------- arranque ---------------- */
setPlan(plan, true);
renderRide();
renderBitacora();
setTimeout(() => {
  $("#gpsChip").classList.add("active");
  $("#gpsTxt").textContent = "GPS activo";
}, 1600);
