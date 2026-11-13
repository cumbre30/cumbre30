"use client";

// ============================================================
// /geo - Sitio público de Cumbre GEO.
// Rediseño aprobado por el cliente a partir del prototipo
// (chat.z.ai/space/e1ffd9t6v9u1-art): paleta verde profundo +
// acento ámbar sobre crema, vistas home ⇄ planes y modal de
// detalle. La paleta anterior (espresso) quedó reemplazada.
//
//   · Paleta:   verde #14453d · verde-osc #0b2b26 · acento #e8a33d
//               crema #f6f4ef · texto #24312d · gris #6d7c76
//   · Vistas:   home (hero, qué/cómo, carrusel) ⇄ planes
//               (cámbio por estado, sin recargar, igual que el prototipo)
//   · Planes:   aquí se integró el contenido de la página /pro tal cual
//               (precio fundador $6.500, beneficios, activación,
//               aporte voluntario y FAQ). Las rutas /cumbre30pro
//               (canónica) y /pro (alias heredado) redirigen acá con
//               ?vista=planes&app=<id>, un enlace nombrado por app.
//   · Modal:    cabecera degradada, botón APK (activo con el link de
//               Google Drive del catálogo), capturas de Play Store,
//               descripción y acordeón de detalle completo. Al final del
//               cuerpo, los accesos exclusivos de la app (correo de
//               contacto, privacidad y eliminar mi cuenta) como pills
//               con el mismo diseño - vienen del campo enlaces del
//               catálogo y solo se muestran si la app los define.
//   · Footer:   solo la marca - sin correo/WhatsApp ni enlaces de la
//               app (privacidad, eliminar cuenta, Cumbre30 Pro son
//               exclusivos de Cumbre30; las rutas siguen vivas para
//               Play Store, enlazadas solo dentro del modal).
// Los estilos del prototipo van incrustados y acotados a #geo-root
// para que no afecten al resto del sitio.
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Download,
  HeartHandshake,
  KeyRound,
  Lock,
  Mail,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { APPS, type AppCatalogo } from "@/lib/appsCatalog";
import { CONTACT_EMAIL, DONATE_OPTIONS, PRO_BENEFITS, PRO_PAY_URL } from "@/lib/proConfig";

const C = {
  verde: "#14453d",
  verdeOsc: "#0b2b26",
  acento: "#e8a33d",
  crema: "#f6f4ef",
  texto: "#24312d",
  gris: "#6d7c76",
  borde: "#e3ded4",
  blanco: "#fff",
  cuerpo: "#42514b",
};

// Estilos del prototipo, acotados a #geo-root para no filtrarse al resto del sitio.
const CSS = `
#geo-root{--verde:#14453d;--verde-osc:#0b2b26;--acento:#e8a33d;--crema:#f6f4ef;--texto:#24312d;--gris:#6d7c76;--borde:#e3ded4;--blanco:#fff;--radio:16px;--sombra:0 8px 24px rgba(11,43,38,.10);color:var(--texto);background:var(--crema);line-height:1.6;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
#geo-root .contenedor{max-width:1100px;margin:0 auto;padding:0 24px}
#geo-root h2.seccion-titulo{font-size:1.7rem;color:var(--verde-osc);margin-bottom:.3rem}
#geo-root .seccion-kicker{display:inline-block;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--acento);margin-bottom:.4rem}
#geo-root .seccion-sub{color:var(--gris);max-width:640px;margin-bottom:2rem}
#geo-root section{padding:64px 0}
#geo-root button{font:inherit;cursor:pointer}
#geo-root header{position:sticky;top:0;z-index:50;background:var(--blanco);border-bottom:1px solid var(--borde)}
#geo-root .header-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
#geo-root .logo{display:flex;align-items:center;gap:10px;font-weight:800;color:var(--verde-osc);font-size:1.05rem;text-decoration:none}
#geo-root .logo svg{width:28px;height:28px}
#geo-root .hero{background:linear-gradient(160deg,var(--verde-osc) 0%,var(--verde) 70%);color:#fff;padding:88px 0;text-align:center}
#geo-root .hero h1{font-size:clamp(1.8rem,4vw,2.8rem);max-width:760px;margin:0 auto 1rem}
#geo-root .hero p{color:#cfe3de;max-width:620px;margin:0 auto 1.6rem}
#geo-root .chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:2rem}
#geo-root .chip{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:#fff;padding:6px 14px;border-radius:999px;font-size:.85rem}
#geo-root .btn{display:inline-block;border:none;border-radius:12px;padding:12px 22px;font-weight:700;text-decoration:none;transition:.2s}
#geo-root .btn-primario{background:var(--acento);color:#2b1c05}
#geo-root .btn-primario:hover{filter:brightness(1.06)}
#geo-root .btn-secundario{background:transparent;border:2px solid var(--verde);color:var(--verde)}
#geo-root .btn-secundario:hover{background:var(--verde);color:#fff}
#geo-root .btn-fantasma{background:var(--crema);border:1px solid var(--borde);color:var(--texto)}
#geo-root .btn:disabled{opacity:.55;cursor:not-allowed;filter:grayscale(.4)}
#geo-root .pilares{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
#geo-root .pilar{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);padding:24px;box-shadow:var(--sombra)}
#geo-root .pilar .icono{font-size:1.6rem}
#geo-root .pilar h3{color:var(--verde-osc);margin:.5rem 0 .35rem;font-size:1.02rem}
#geo-root .pilar p{color:var(--gris);font-size:.92rem}
#geo-root .carrusel-wrap{position:relative}
#geo-root .carrusel{display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding:8px 4px 20px;scrollbar-width:thin}
#geo-root .tarjeta{flex:0 0 300px;scroll-snap-align:start;background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);box-shadow:var(--sombra);padding:28px 24px;text-align:center;display:flex;flex-direction:column;gap:12px}
#geo-root .tarjeta .app-icono{width:72px;height:72px;margin:0 auto;border-radius:18px;overflow:hidden}
#geo-root .tarjeta h3{color:var(--verde-osc)}
#geo-root .tarjeta p{color:var(--gris);font-size:.9rem;flex:1}
#geo-root .tarjeta .acciones{display:flex;flex-direction:column;gap:8px}
#geo-root .carrusel-flecha{position:absolute;top:42%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:1px solid var(--borde);background:var(--blanco);box-shadow:var(--sombra);font-size:1.1rem;z-index:2;color:var(--verde-osc)}
#geo-root .carrusel-flecha.izq{left:-14px}
#geo-root .carrusel-flecha.der{right:-14px}
#geo-root .badge-prox{display:inline-block;background:#fdf3e3;color:#9a6a14;border:1px solid #f2ddb7;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:999px;margin-left:6px}
#geo-root .vista{display:none}
#geo-root .vista.activa{display:block}
#geo-root .barra-volver{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0}
#geo-root .modal-fondo{position:fixed;inset:0;z-index:100;background:rgba(11,43,38,.55);backdrop-filter:blur(3px);display:none;align-items:flex-start;justify-content:center;padding:4vh 16px;overflow-y:auto}
#geo-root .modal-fondo.abierto{display:flex}
#geo-root .modal{background:var(--blanco);border-radius:20px;max-width:780px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;animation:geo-subir .25s ease}
@keyframes geo-subir{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}
#geo-root .modal-cerrar{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:none;background:rgba(255,255,255,.92);font-size:1.15rem;box-shadow:var(--sombra);z-index:2;display:flex;align-items:center;justify-content:center;color:var(--verde-osc)}
#geo-root .modal-head{position:relative;background:linear-gradient(150deg,var(--verde-osc),var(--verde));color:#fff;padding:26px 28px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
#geo-root .modal-head .app-icono{width:64px;height:64px;border-radius:16px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center}
#geo-root .modal-head h3{font-size:1.35rem;margin:0}
#geo-root .modal-head .version{font-size:.85rem;color:#cfe3de}
#geo-root .modal-cuerpo{padding:26px 28px 30px;max-height:72vh;overflow-y:auto}
#geo-root .apk-btn{width:100%;margin:0 0 4px;padding:14px;font-size:1rem;display:flex;align-items:center;justify-content:center;gap:8px;border:none}
#geo-root .apk-nota{text-align:center;font-size:.8rem;color:var(--gris);margin:6px 0 22px}
#geo-root .capturas{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 14px;margin-bottom:20px;scrollbar-width:thin}
#geo-root .capturas img{flex:0 0 auto;height:300px;width:auto;scroll-snap-align:center;border-radius:14px;border:1px solid var(--borde)}
#geo-root .acordeon{border:1px solid var(--borde);border-radius:14px;overflow:hidden;margin-top:10px}
#geo-root .acordeon details+details{border-top:1px solid var(--borde)}
#geo-root .acordeon summary{list-style:none;cursor:pointer;padding:15px 18px;font-weight:700;color:var(--verde-osc);display:flex;justify-content:space-between;align-items:center;background:#fbfaf6}
#geo-root .acordeon summary::-webkit-details-marker{display:none}
#geo-root .acordeon summary svg{transition:.2s;color:var(--acento)}
#geo-root .acordeon details[open] summary svg{transform:rotate(180deg)}
#geo-root .acordeon .cuerpo{padding:4px 18px 16px;color:#42514b;font-size:.93rem;white-space:pre-line}
#geo-root .modal-foot{display:flex;gap:12px;justify-content:flex-end;padding:0 28px 26px}
#geo-root .modal-enlaces{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:24px;padding-top:18px;border-top:1px solid var(--borde)}
#geo-root .enlace-app{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:999px;border:1px solid var(--borde);background:var(--crema);color:var(--verde-osc);font-size:.85rem;font-weight:700;text-decoration:none;transition:.2s}
#geo-root .enlace-app:hover{border-color:var(--verde);background:#fff;box-shadow:var(--sombra)}
#geo-root .enlace-app svg{color:var(--acento);flex-shrink:0}
#geo-root footer{background:var(--verde-osc);color:#9db8b1;text-align:center;padding:28px 0;font-size:.85rem}
#geo-root .bloque-pro{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);box-shadow:var(--sombra);padding:32px 28px;margin-bottom:24px}
#geo-root .bloque-pro h3{color:var(--verde-osc);font-size:1.15rem;margin:0}
#geo-root .beneficio{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f1ede4;font-size:.95rem;color:var(--texto)}
#geo-root .beneficio:last-child{border-bottom:none}
#geo-root .paso-num{width:28px;height:28px;flex-shrink:0;border-radius:50%;background:var(--verde);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800}
#geo-root .faq-card{background:#fbfaf6;border:1px solid var(--borde);border-radius:14px;padding:16px 18px}
#geo-root .faq-card p.q{font-weight:700;color:var(--verde-osc);margin:0}
#geo-root .faq-card p.a{color:#42514b;font-size:.93rem;margin:4px 0 0}
@media(max-width:640px){
  #geo-root .modal-fondo{padding:0}
  #geo-root .modal{border-radius:0;min-height:100vh}
  #geo-root .modal-cuerpo{max-height:none}
  #geo-root .carrusel-flecha{display:none}
}
`;

type Vista = "home" | "planes";

const CHIPS = ["✈️ 100% offline", "🚫 Sin publicidad", "📍 Motor GPS propio", "🗺 Cartografía open source"];

const PILARES = [
  { icono: "📍", titulo: "Motor GPS propio", cuerpo: "Registro y corrección de posición directamente en el dispositivo, sin depender de servicios de terceros." },
  { icono: "🗺️", titulo: "Cartografía open source", cuerpo: "Mapas basados en fuentes abiertas, empaquetados para usarse sin conexión." },
  { icono: "✈️", titulo: "100% offline", cuerpo: "Mapas, rutas y registro funcionan sin datos móviles." },
  { icono: "🚫", titulo: "Sin publicidad", cuerpo: "Cero anuncios y cero rastreo innecesario." },
];

export default function GeoSite({
  apkActivo = false,
  vistaInicial = "home",
  appInicial,
}: {
  apkActivo?: boolean;
  vistaInicial?: Vista;
  /** id de la app cuyos planes se abren (parámetro ?app de la URL).
   *  Se ignora si no existe o si la app no tiene planes publicados. */
  appInicial?: string;
}) {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [appId, setAppId] = useState<string | null>(null);
  const [planAppId, setPlanAppId] = useState<string | null>(() => {
    const a = appInicial ? APPS.find((x) => x.id === appInicial && x.planes.publicado) : null;
    return a ? a.id : null;
  });
  const carruselRef = useRef<HTMLDivElement>(null);
  const app = appId ? APPS.find((a) => a.id === appId) ?? null : null;
  const appPlanes = (planAppId ? APPS.find((a) => a.id === planAppId) : null) ?? APPS.find((a) => a.planes.publicado) ?? null;

  // Esc cierra el modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAppId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // En el export estático (APK) la página no recibe ?vista ni ?app del
  // servidor: se leen directo de la URL al montar, en el cliente.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("vista") === "planes") setVista("planes");
    const a = q.get("app");
    if (a && APPS.some((x) => x.id === a && x.planes.publicado)) setPlanAppId(a);
  }, []);

  // Bloquea el scroll de fondo mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = appId ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [appId]);

  const mostrarVista = (v: Vista) => {
    setVista(v);
    setAppId(null);
    window.scrollTo({ top: 0 });
  };

  const moverCarrusel = (dir: number) => {
    const el = carruselRef.current;
    if (!el) return;
    const tarjeta = el.querySelector<HTMLElement>("[data-tarjeta]");
    const ancho = tarjeta ? tarjeta.offsetWidth + 20 : 320;
    el.scrollBy({ left: dir * ancho, behavior: "smooth" });
  };

  const irAPlanes = (a: AppCatalogo) => {
    if (!a.planes.publicado) return;
    setPlanAppId(a.id);
    mostrarVista("planes");
  };

  return (
    <main id="geo-root" className="min-h-dvh w-full">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ═══════════ VISTA: HOME ═══════════ */}
      <div className={`vista${vista === "home" ? " activa" : ""}`}>
        <header>
          <div className="contenedor header-inner">
            <a
              className="logo"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                mostrarVista("home");
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M3 19L10 6l4 7 2-3 5 9H3z" fill="#14453d" />
                <circle cx="18" cy="5" r="2" fill="#e8a33d" />
              </svg>
              CUMBRE GEO
            </a>
          </div>
        </header>

        {/* Hero */}
        <div className="hero">
          <div className="contenedor">
            <h1>Tecnología para descubrir</h1>
            <p>Desarrollamos herramientas que funcionan donde no llega la señal: en la montaña, en el bosque, en la ruta.</p>
            <div className="chips">
              {CHIPS.map((chip) => (
                <span key={chip} className="chip">
                  {chip}
                </span>
              ))}
            </div>
            <a className="btn btn-primario" href="#aplicaciones">
              Ver aplicaciones ▼
            </a>
          </div>
        </div>

        {/* Qué hacemos */}
        <section id="que-hacemos">
          <div className="contenedor">
            <span className="seccion-kicker">Qué hacemos</span>
            <h2 className="seccion-titulo">Tecnología que no depende de la conexión</h2>
            <p className="seccion-sub">
              <strong>Cumbre GEO</strong> desarrolla aplicaciones 100% offline para actividades al aire libre. Sin
              publicidad, sin dependencia de la conexión: todo funciona en tu dispositivo, incluso sin señal.
            </p>
          </div>
        </section>

        {/* Cómo lo hacemos */}
        <section id="como-lo-hacemos" style={{ paddingTop: 0 }}>
          <div className="contenedor">
            <span className="seccion-kicker">Cómo lo hacemos</span>
            <h2 className="seccion-titulo">Nuestro enfoque</h2>
            <p className="seccion-sub">Cuatro principios guían cada aplicación que desarrollamos.</p>
            <div className="pilares">
              {PILARES.map((p) => (
                <div key={p.titulo} className="pilar">
                  <div className="icono" aria-hidden>
                    {p.icono}
                  </div>
                  <h3>{p.titulo}</h3>
                  <p>{p.cuerpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nuestras aplicaciones (carrusel) */}
        <section id="aplicaciones" style={{ paddingTop: 0 }}>
          <div className="contenedor">
            <span className="seccion-kicker">Nuestras aplicaciones</span>
            <h2 className="seccion-titulo">Explora lo que hacemos</h2>
            <p className="seccion-sub">
              Cada app mantiene el mismo espíritu: offline, sin publicidad y con datos que quedan en tu dispositivo.
            </p>
            <div className="carrusel-wrap">
              <button className="carrusel-flecha izq" onClick={() => moverCarrusel(-1)} aria-label="Aplicación anterior">
                ‹
              </button>
              <div className="carrusel" ref={carruselRef}>
                {APPS.map((a) => (
                  <div key={a.id} className="tarjeta" data-tarjeta>
                    {a.disponible ? (
                      <div className="app-icono">
                        <img src={a.icono} alt={`Ícono de ${a.nombre}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ) : (
                      <div
                        className="app-icono"
                        style={{ border: "1.5px dashed var(--acento)", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Compass style={{ width: 30, height: 30, color: "var(--acento)" }} aria-hidden />
                      </div>
                    )}
                    <h3>
                      {a.nombre}
                      {!a.disponible && <span className="badge-prox">Próximamente</span>}
                    </h3>
                    <p>{a.tagline}</p>
                    {a.disponible ? (
                      <div className="acciones">
                        <button className="btn btn-secundario" onClick={() => setAppId(a.id)}>
                          Ver detalles
                        </button>
                        {a.planes.publicado && (
                          <button className="btn btn-primario" onClick={() => irAPlanes(a)}>
                            Ver planes
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="acciones">
                        <button className="btn btn-fantasma" disabled>
                          Muy pronto
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="carrusel-flecha der" onClick={() => moverCarrusel(1)} aria-label="Aplicación siguiente">
                ›
              </button>
            </div>
          </div>
        </section>

        <footer>© 2026 Cumbre GEO · Tecnología para descubrir. Todos los derechos reservados.</footer>
      </div>

      {/* ═══════════ VISTA: PLANES ═══════════ */}
      <div className={`vista${vista === "planes" ? " activa" : ""}`}>
        <header>
          <div className="contenedor header-inner">
            <a
              className="logo"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                mostrarVista("home");
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M3 19L10 6l4 7 2-3 5 9H3z" fill="#14453d" />
                <circle cx="18" cy="5" r="2" fill="#e8a33d" />
              </svg>
              CUMBRE GEO
            </a>
          </div>
        </header>

        <div className="contenedor" style={{ paddingBottom: 48 }}>
          <div className="barra-volver">
            <button className="btn btn-fantasma" onClick={() => mostrarVista("home")}>
              ← Volver al home
            </button>
            {appPlanes?.disponible && (
              <button className="btn btn-secundario" onClick={() => setAppId(appPlanes.id)}>
                Ver detalles
              </button>
            )}
          </div>

          <span className="seccion-kicker">Planes · {appPlanes?.nombre ?? "Cumbre30"}</span>
          <h2 className="seccion-titulo">Elige tu plan</h2>
          <p className="seccion-sub">Un solo pago y desbloqueas todo, para siempre.</p>

          {/* ── Bloque Plan Pro (contenido de la venta web, antes página /pro,
              hoy integrado tal cual; rutas /cumbre30pro + /pro redirigen acá) ── */}
          {appPlanes && (
            <>
              {/* Precio + compra */}
              <div className="bloque-pro" style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-flex",
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    background: "linear-gradient(150deg, var(--verde-osc), var(--verde))",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Crown style={{ width: 30, height: 30, color: "#fff" }} aria-hidden />
                </span>
                <h3 style={{ fontSize: "1.6rem", marginTop: 12 }}>
                  {appPlanes.nombre} <span style={{ color: "var(--acento)" }}>Pro</span>
                </h3>
                <p style={{ color: "var(--gris)", margin: "4px 0 0" }}>
                  El ciclocomputador del cerro San Cristóbal, con todo desbloqueado.
                </p>

                <p style={{ fontSize: "3rem", fontWeight: 800, color: "var(--verde-osc)", margin: "20px 0 0", lineHeight: 1 }}>
                  $6.500
                </p>
                <p style={{ color: "#8a6a2f", fontSize: ".85rem", margin: "6px 0 18px" }}>
                  precio fundador · pago único · sin suscripción · para siempre
                </p>

                <a
                  href={PRO_PAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primario"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 22px", fontSize: "1rem" }}
                >
                  <ShoppingBag style={{ width: 20, height: 20 }} aria-hidden /> Comprar Pro - $6.500
                </a>
                <p style={{ color: "var(--gris)", fontSize: ".85rem", margin: "14px auto 0", maxWidth: 480 }}>
                  Pagas con Mercado Pago y recibes tu código{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--verde-osc)" }}>C30P-XXXX-…</span> por
                  correo. Después lo activas en la app: <b style={{ color: "var(--texto)" }}>Perfil → Pagos y suscripciones</b>.
                </p>
              </div>

              {/* Qué desbloquea */}
              <div className="bloque-pro">
                <span className="seccion-kicker">Qué desbloquea Pro</span>
                <div>
                  {PRO_BENEFITS.map((b) => (
                    <div key={b} className="beneficio">
                      <BadgeCheck style={{ width: 18, height: 18, flexShrink: 0, color: "var(--verde)", marginTop: 2 }} aria-hidden />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cómo activar */}
              <div className="bloque-pro">
                <span className="seccion-kicker">Cómo activar tu código</span>
                <div style={{ display: "grid", gap: 16, marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span className="paso-num">1</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: "var(--verde-osc)" }}>Paga con Mercado Pago</p>
                      <p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: ".92rem" }}>
                        Desde el botón ámbar de arriba: tarjeta, dinero en cuenta o efectivo en agentes.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span className="paso-num">2</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: "var(--verde-osc)" }}>Recibe tu código por correo</p>
                      <p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: ".92rem" }}>
                        Te enviamos el código C30P- ligado a tu correo (normalmente en minutos; si demora, escríbenos con
                        tu comprobante a {CONTACT_EMAIL}).
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span className="paso-num">3</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: "var(--verde-osc)" }}>Actívalo en la app</p>
                      <p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: ".92rem" }}>
                        Abre Cumbre30 → Perfil → Pagos y suscripciones → Habilitar modo Pro → ingresa tu correo y el
                        código. La validación es local: no necesita internet.
                      </p>
                    </div>
                  </div>
                </div>
                <p
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    background: "#fbfaf6",
                    border: "1px solid var(--borde)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    color: "var(--gris)",
                    fontSize: ".88rem",
                    marginTop: 16,
                  }}
                >
                  <Wifi style={{ width: 18, height: 18, flexShrink: 0, color: "var(--verde)", marginTop: 2 }} aria-hidden />
                  La app funciona 100% offline: una vez activado el código, Pro queda guardado en el teléfono.
                </p>
              </div>

              {/* Aporte voluntario */}
              <div className="bloque-pro">
                <span className="seccion-kicker">Aporte voluntario</span>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <HeartHandshake style={{ width: 24, height: 24, flexShrink: 0, color: "var(--verde)", marginTop: 2 }} aria-hidden />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "var(--verde-osc)" }}>¿Quieres apoyar sin llevar Pro?</p>
                    <p style={{ margin: "4px 0 12px", color: "var(--gris)", fontSize: ".92rem" }}>
                      Cumbre30 es gratis, sin publicidad y hecha en Chile. Tu aporte financia los mapas, los avisos de voz
                      y las próximas funciones. ¡Cualquier monto ayuda!
                    </p>
                    <a
                      href={DONATE_OPTIONS[0]?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secundario"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: ".9rem" }}
                    >
                      <HeartHandshake style={{ width: 16, height: 16 }} aria-hidden /> Aportar - monto libre
                    </a>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="bloque-pro">
                <span className="seccion-kicker">Preguntas frecuentes</span>
                <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                  <div className="faq-card">
                    <p className="q">¿Es un pago único o suscripción?</p>
                    <p className="a">Pago único: activas Pro para siempre en ese teléfono, sin renovaciones ni cobros automáticos.</p>
                  </div>
                  <div className="faq-card">
                    <p className="q">¿Puedo pasar mi Pro a otro teléfono?</p>
                    <p className="a">
                      Sí. Quita la licencia desde el teléfono antiguo (Pagos y suscripciones → Quitar licencia) y activa el
                      mismo código en el nuevo con el mismo correo.
                    </p>
                  </div>
                  <div className="faq-card">
                    <p className="q">¿Compré Pro dentro de Google Play, qué hago?</p>
                    <p className="a">
                      Si compraste desde la app instalada por Google Play, Pro se activa solo con tu cuenta Google. El
                      código de esta página es para quienes pagan por la web.
                    </p>
                  </div>
                  <div className="faq-card">
                    <p className="q">¿La app funciona sin señal en el cerro?</p>
                    <p className="a">Sí: mapas, rutas, GPS y alertas funcionan sin datos móviles. El pago y la primera activación sí necesitan internet.</p>
                  </div>
                </div>
                <p
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--gris)",
                    fontSize: ".78rem",
                    marginTop: 18,
                  }}
                >
                  <KeyRound style={{ width: 13, height: 13 }} aria-hidden /> Pago seguro procesado por Mercado Pago -
                  Cumbre30 no almacena datos de tarjetas.
                </p>
              </div>
            </>
          )}
        </div>

        <footer>© 2026 Cumbre GEO · Tecnología para descubrir. Todos los derechos reservados.</footer>
      </div>

      {/* ═══════════ MODAL: DETALLE DE APP ═══════════ */}
      <div
        className={`modal-fondo${app ? " abierto" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setAppId(null);
        }}
        role="dialog"
        aria-modal="true"
        aria-label={app ? `Detalles de ${app.nombre}` : undefined}
      >
        {app && (
          <div className="modal">
            <div className="modal-head">
              <button className="modal-cerrar" onClick={() => setAppId(null)} aria-label="Cerrar">
                <X style={{ width: 18, height: 18 }} aria-hidden />
              </button>
              <div className="app-icono">
                <img src={app.icono} alt={`Ícono de ${app.nombre}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div>
                <h3>{app.nombre}</h3>
                <div className="version">
                  Versión {app.version} · build {app.versionCode}
                </div>
              </div>
            </div>

            <div className="modal-cuerpo">
              {/* APK: activo con el link de Google Drive del catálogo.
                  La prop apkActivo queda como vía alternativa para el
                  flujo /api/apk + APK_DOWNLOAD_URL (DEPLOY.md · paso 6). */}
              {app.apk.disponible || (apkActivo && !!app.apk.url) ? (
                <>
                  <a
                    href={app.apk.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primario apk-btn"
                  >
                    <Download style={{ width: 20, height: 20 }} aria-hidden /> Descargar APK
                  </a>
                  <p className="apk-nota">Instalación directa desde el archivo APK.</p>
                </>
              ) : (
                <>
                  <button className="btn btn-primario apk-btn" disabled>
                    <Lock style={{ width: 18, height: 18 }} aria-hidden /> Descargar APK
                  </button>
                  <p className="apk-nota">{app.apk.nota || "Disponible próximamente."}</p>
                </>
              )}

              {/* Capturas (las mismas de Play Store) */}
              <div className="capturas">
                {app.imagenes.map((img) => (
                  <img key={img.src} src={img.src} alt={img.alt} />
                ))}
              </div>

              <h4 style={{ color: "var(--verde-osc)", margin: "0 0 6px" }}>Descripción</h4>
              <p style={{ color: C.cuerpo, fontSize: ".95rem", margin: 0 }}>{app.descripcionBreve}</p>

              <h4 style={{ color: "var(--verde-osc)", margin: "22px 0 2px" }}>Detalle completo</h4>
              <div className="acordeon">
                {app.detalleCompleto.map((s, i) => (
                  <details key={s.titulo} open={i === 0}>
                    <summary>
                      {s.titulo}
                      <ChevronDown style={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden />
                    </summary>
                    <div className="cuerpo">{s.cuerpo}</div>
                  </details>
                ))}
              </div>

              {/* Accesos exclusivos de la app (catálogo · enlaces): soporte
                  y privacidad que Play exige por app. Footer del sitio
                  queda limpio: estos enlaces solo viven acá. */}
              {app.enlaces && (
                <div className="modal-enlaces">
                  <a className="enlace-app" href={app.enlaces.contacto}>
                    <Mail style={{ width: 15, height: 15 }} aria-hidden /> Correo de contacto
                  </a>
                  <a
                    className="enlace-app"
                    href={app.enlaces.privacidad}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ShieldCheck style={{ width: 15, height: 15 }} aria-hidden /> Privacidad
                  </a>
                  {app.enlaces.terminos && (
                    <a
                      className="enlace-app"
                      href={app.enlaces.terminos}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ScrollText style={{ width: 15, height: 15 }} aria-hidden /> Términos y condiciones
                    </a>
                  )}
                  <a
                    className="enlace-app"
                    href={app.enlaces.eliminarCuenta}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Trash2 style={{ width: 15, height: 15 }} aria-hidden /> Eliminar mi cuenta
                  </a>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn btn-fantasma" onClick={() => setAppId(null)}>
                Volver al home
              </button>
              {app.planes.publicado && (
                <button className="btn btn-secundario" onClick={() => irAPlanes(app)}>
                  Ver planes
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
