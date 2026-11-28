"use client";

// ============================================================
// /geo - Sitio público corporativo de CumbreGeo (v1.29.5).
// Rediseño integral (brief cumbregeo.cl): CumbreGeo pasa a ser
// marca matriz con dos líneas de producto:
//   · OUTDOOR & GEOSPATIAL (Cumbre30 y futuras apps geográficas)
//   · DOCUMENTOS & PRODUCTIVIDAD - CumbreDocs (RAPIQO)
//
//   · Paleta:   verde bosque #14453d · verde-osc #0b2b26
//               acento verde natural #5a8f57 · tierra #b9a58c
//               piedra #f0ede6 · crema #f6f4ef (fondos neutros)
//               El COMERCIO (vista planes + modal) conserva el
//               acento ámbar #e8a33d histórico, sin alterar nada
//               de su funcionamiento.
//   · Secciones home: hero corporativo + 3 bloques de identidad +
//               soluciones (2 categorías) + nosotros + contacto
//               (formulario → /api/contacto, DB + Gmail SMTP).
//   · Vistas:   home ⇄ planes (sin recargar, igual que antes).
//   · Planes:   INTACTOS - precio fundador $6.500, beneficios,
//               activación, aporte voluntario y FAQ. Las rutas
//               /cumbre30pro (canónica) y /pro (alias heredado)
//               siguen redirigiendo acá con ?vista=planes&app=<id>.
//   · Modal:    detalle de Cumbre30 (APK, capturas, acordeón,
//               enlaces Play Store) + modal propio de RAPIQO;
//               ambos con evaluaciones y comentarios (v1.29.5).
//   · Footer:   completo (líneas, productos, contacto, legal).
// Los estilos van incrustados y acotados a #geo-root.
// ============================================================

import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Crown,
  Download,
  FileText,
  HeartHandshake,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Menu,
  Mountain,
  ScrollText,
  Send,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { APPS } from "@/lib/appsCatalog";
import ComentariosProducto from "@/components/ComentariosProducto";
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
#geo-root .apk-verificar{display:flex;align-items:center;justify-content:center;width:100%;margin:2px 0 2px;padding:12px;font-size:.95rem;border:1px solid var(--borde);border-radius:10px;color:var(--verde,#2fbf8f);text-decoration:none;background:rgba(47,191,143,.06);transition:background .15s}
#geo-root .apk-verificar:hover{background:rgba(47,191,143,.14)}
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
/* ── Identidad corporativa (v1.29.0): verde bosque como identidad
   (ya era la base), acento VERDE NATURAL y tierra/piedra como
   secundarios para las secciones nuevas. El comercio (planes,
   modal) conserva su acento ámbar histórico intacto. ── */
#geo-root{--acento-n:#5a8f57;--acento-n-osc:#48774a;--tierra:#b9a58c;--piedra:#f0ede6;--cuerpo:#42514b}
/* Kickers de las secciones corporativas en verde natural; los de la
   vista planes (comercio) conservan el ámbar histórico. */
#geo-root #bloques .seccion-kicker,#geo-root #soluciones .seccion-kicker,#geo-root #nosotros .seccion-kicker,#geo-root #contacto .seccion-kicker{color:var(--acento-n)}
#geo-root .nav{display:flex;align-items:center;gap:20px}
#geo-root .nav a{color:var(--texto);text-decoration:none;font-weight:600;font-size:.88rem;opacity:.8;transition:opacity .15s}
#geo-root .nav a:hover{opacity:1;color:var(--verde)}
#geo-root .nav .nav-cta{background:var(--acento-n);color:#fff;opacity:1;padding:9px 16px;border-radius:10px}
#geo-root .nav .nav-cta:hover{background:var(--acento-n-osc);color:#fff}
#geo-root .nav-toggle{display:none;background:var(--blanco);border:1px solid var(--borde);border-radius:10px;width:40px;height:40px;align-items:center;justify-content:center;color:var(--verde-osc)}
#geo-root .nav-movil{display:none;border-top:1px solid var(--borde);background:var(--blanco);padding:10px 24px 16px;flex-direction:column;gap:2px}
#geo-root .nav-movil a{padding:11px 4px;text-decoration:none;color:var(--texto);font-weight:600;border-bottom:1px solid var(--piedra)}
#geo-root .nav-movil .nav-cta{color:#fff;border:none;margin-top:10px;text-align:center;border-radius:10px;padding:12px;background:var(--acento-n)}
#geo-root .hero{position:relative;overflow:hidden;text-align:left;background:linear-gradient(160deg,var(--verde-osc) 0%,var(--verde) 74%);color:#fff;padding:92px 0 80px}
#geo-root .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;position:relative;z-index:1}
#geo-root .hero h1{font-size:clamp(2rem,4.6vw,3.1rem);line-height:1.15;margin:0 0 1rem;max-width:640px}
#geo-root .hero .hero-sub{color:#d5e6e1;font-size:1.05rem;max-width:560px;margin:0 0 1.8rem}
#geo-root .hero .kicker{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#a9d6ab;border:1px solid rgba(169,214,171,.4);border-radius:999px;padding:6px 14px;margin-bottom:1.2rem}
#geo-root .hero-acciones{display:flex;gap:12px;flex-wrap:wrap}
#geo-root .btn-acento{background:var(--acento-n);color:#fff}
#geo-root .btn-acento:hover{background:var(--acento-n-osc)}
#geo-root .btn-borde-blanco{background:transparent;border:2px solid rgba(255,255,255,.55);color:#fff}
#geo-root .btn-borde-blanco:hover{background:rgba(255,255,255,.12)}
#geo-root .hero-topo{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.55}
#geo-root .hero-visual{position:relative}
#geo-root .ventana{background:var(--blanco);border-radius:14px;box-shadow:0 30px 70px rgba(4,20,17,.45);overflow:hidden;transform:rotate(-1.2deg);max-width:340px;margin:0 auto}
#geo-root .ventana .ventana-barra{display:flex;gap:6px;padding:10px 12px;background:var(--piedra)}
#geo-root .ventana .ventana-barra span{width:10px;height:10px;border-radius:50%;background:var(--tierra);opacity:.7}
#geo-root .ventana img{display:block;width:100%;height:auto}
#geo-root .ventana-pie{position:absolute;right:2px;bottom:-14px;background:var(--blanco);color:var(--verde-osc);font-weight:700;font-size:.78rem;padding:9px 15px;border-radius:12px;box-shadow:var(--sombra)}
#geo-root .bloques{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
#geo-root .bloque{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);padding:26px 24px;box-shadow:var(--sombra)}
#geo-root .bloque .num{display:inline-flex;width:34px;height:34px;border-radius:10px;background:var(--piedra);color:var(--verde);font-weight:800;align-items:center;justify-content:center;margin-bottom:12px;font-size:.85rem}
#geo-root .bloque h3{color:var(--verde-osc);margin:0 0 .4rem;font-size:1.05rem}
#geo-root .bloque p{color:var(--gris);font-size:.93rem;margin:0}
#geo-root .categoria{border-radius:var(--radio);border:1px solid var(--borde);overflow:hidden;background:var(--blanco);box-shadow:var(--sombra)}
#geo-root .categoria+.categoria{margin-top:28px}
#geo-root .categoria-head{display:flex;align-items:center;gap:14px;padding:18px 26px;background:var(--piedra)}
#geo-root .categoria-head .cat-icono{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}
#geo-root .categoria-head h3{margin:0;font-size:1rem;color:var(--verde-osc);letter-spacing:.03em}
#geo-root .categoria-head p{margin:2px 0 0;font-size:.86rem;color:var(--gris)}
#geo-root .producto{display:grid;grid-template-columns:280px 1fr;gap:28px;padding:26px;align-items:center}
#geo-root .producto-visual{border-radius:12px;overflow:hidden;border:1px solid var(--borde);background:var(--piedra)}
#geo-root .producto-visual img{display:block;width:100%;height:auto}
#geo-root .producto .linea-de{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--acento-n);margin:0 0 4px}
#geo-root .producto .producto-nombre{font-size:1.35rem;font-weight:800;color:var(--verde-osc);margin:0}
#geo-root .estado{display:inline-block;font-size:.72rem;font-weight:700;padding:4px 12px;border-radius:999px;margin-left:8px;vertical-align:middle}
#geo-root .estado.disponible{background:#e7f2e6;color:#2e5e2b;border:1px solid #cfe4cd}
#geo-root .estado.desarrollo{background:#f6ecdb;color:#8a6a2f;border:1px solid #ecd9b7}
#geo-root .producto ul{margin:14px 0 18px;padding:0;list-style:none;display:grid;gap:7px}
#geo-root .producto ul li{display:flex;gap:8px;align-items:flex-start;font-size:.92rem;color:var(--cuerpo)}
#geo-root .producto ul li svg{flex-shrink:0;color:var(--acento-n);margin-top:2px}
#geo-root .producto-acciones{display:flex;gap:10px;flex-wrap:wrap}
#geo-root .producto-nota{margin:14px 0 0;font-size:.85rem;color:var(--gris)}
#geo-root .mockup-rapiqo{display:block;width:100%;height:auto}
#geo-root .nosotros-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
#geo-root .nosotros-tarjeta{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);padding:26px;box-shadow:var(--sombra)}
#geo-root .nosotros-tarjeta h3{margin:0 0 .5rem;color:var(--verde-osc)}
#geo-root .nosotros-tarjeta p{margin:0;color:var(--cuerpo);font-size:.95rem;line-height:1.65}
#geo-root .valores{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
#geo-root .valor{background:var(--blanco);border:1px solid var(--borde);border-radius:12px;padding:14px;text-align:center;font-weight:700;color:var(--verde-osc);font-size:.9rem}
#geo-root .contacto-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:32px;align-items:start}
#geo-root .contacto-info p{color:var(--cuerpo);font-size:.95rem;line-height:1.7}
#geo-root .contacto-info a{color:var(--verde);font-weight:700;text-decoration:none}
#geo-root .form{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);box-shadow:var(--sombra);padding:26px;position:relative}
#geo-root .form .fila{display:grid;grid-template-columns:1fr 1fr;gap:14px}
#geo-root .form label{display:block;font-size:.82rem;font-weight:700;color:var(--verde-osc);margin:0 0 6px}
#geo-root .form input,#geo-root .form textarea,#geo-root .form select{width:100%;box-sizing:border-box;font:inherit;padding:11px 12px;border:1px solid var(--borde);border-radius:10px;background:var(--blanco);color:var(--texto)}
#geo-root .form input:focus,#geo-root .form textarea:focus,#geo-root .form select:focus{outline:2px solid var(--acento-n);outline-offset:1px;border-color:var(--acento-n)}
#geo-root .form .campo{margin-bottom:14px}
#geo-root .form .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
#geo-root .form-nota{font-size:.8rem;color:var(--gris);margin:10px 0 0}
#geo-root .aviso-forma{display:flex;gap:8px;align-items:center;font-size:.9rem;font-weight:600;padding:12px 14px;border-radius:10px;margin-top:12px}
#geo-root .aviso-forma.ok{background:#e7f2e6;color:#2e5e2b}
#geo-root .aviso-forma.error{background:#f7e9e4;color:#8c3d24}
#geo-root .geo-girando{animation:geo-giro 1s linear infinite}
@keyframes geo-giro{to{transform:rotate(360deg)}}
#geo-root footer.geo-footer{background:var(--verde-osc);color:#9db8b1;padding:44px 0 26px;font-size:.85rem}
#geo-root .footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:26px}
#geo-root .footer-grid h4{color:#fff;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px}
#geo-root .footer-grid a{color:#c8d9d4;text-decoration:none;display:block;padding:3px 0}
#geo-root .footer-grid a:hover{color:#fff}
#geo-root .footer-marca{display:flex;align-items:center;gap:10px;font-weight:800;color:#fff;font-size:1.02rem;margin-bottom:10px}
#geo-root .footer-base{border-top:1px solid rgba(255,255,255,.14);margin-top:26px;padding-top:18px;text-align:center;font-size:.78rem;color:#7f9b94}
@media(max-width:900px){
  #geo-root .nav{display:none}
  #geo-root .nav-toggle{display:inline-flex}
  #geo-root .nav-movil.abierto{display:flex}
  #geo-root .hero-grid{grid-template-columns:1fr;gap:36px}
  #geo-root .bloques{grid-template-columns:1fr}
  #geo-root .producto{grid-template-columns:1fr}
  #geo-root .nosotros-grid{grid-template-columns:1fr}
  #geo-root .contacto-grid{grid-template-columns:1fr}
  #geo-root .footer-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:640px){
  #geo-root .modal-fondo{padding:0}
  #geo-root .modal{border-radius:0;min-height:100vh}
  #geo-root .modal-cuerpo{max-height:none}
  #geo-root .carrusel-flecha{display:none}
  #geo-root .footer-grid{grid-template-columns:1fr}
  #geo-root .form .fila{grid-template-columns:1fr}
  #geo-root section{padding:48px 0}
}
/* ── Comentarios del modal (v1.29.5): evaluación obligatoria +
   comentario, recientes primero. Componente ComentariosProducto. ── */
#geo-root .comentarios{margin-top:24px;padding-top:18px;border-top:1px solid var(--borde)}
#geo-root .comentario-titulo{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--verde-osc);margin:0 0 12px}
#geo-root .comentario-promedio{display:inline-flex;align-items:center;gap:5px;font-size:.85rem;font-weight:700;color:var(--gris)}
#geo-root .comentario-forma{position:relative;display:grid;gap:10px;background:#fbfaf6;border:1px solid var(--borde);border-radius:14px;padding:14px 16px}
#geo-root .campo-etiqueta{display:block;font-size:.8rem;font-weight:700;color:var(--verde-osc);margin:0 0 4px}
#geo-root .estrellas-elegir{display:flex;gap:4px}
#geo-root .estrella-btn{background:none;border:none;padding:2px;color:#d8d3c8}
#geo-root .estrella-btn[aria-checked="true"],#geo-root .estrella-btn:hover{color:var(--acento)}
#geo-root .comentario-forma label{display:block;font-size:.8rem;font-weight:700;color:var(--verde-osc);margin:0 0 4px}
#geo-root .comentario-forma input,#geo-root .comentario-forma textarea{width:100%;box-sizing:border-box;font:inherit;padding:9px 11px;border:1px solid var(--borde);border-radius:10px;background:var(--blanco);color:var(--texto)}
#geo-root .comentario-forma input:focus,#geo-root .comentario-forma textarea:focus{outline:2px solid var(--acento-n);outline-offset:1px;border-color:var(--acento-n)}
#geo-root .comentario-enviar{justify-self:start;display:inline-flex;align-items:center;gap:7px}
#geo-root .comentario-aviso{display:flex;gap:7px;align-items:center;font-size:.85rem;font-weight:600;margin:0}
#geo-root .comentario-aviso.ok{color:#2e5e2b}
#geo-root .comentario-aviso.error{color:#8c3d24}
#geo-root .comentario-lista{display:grid;gap:10px;margin-top:14px}
#geo-root .comentario-item{background:var(--blanco);border:1px solid var(--borde);border-radius:12px;padding:12px 14px}
#geo-root .comentario-cab{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.85rem;color:var(--gris)}
#geo-root .comentario-cab b{color:var(--verde-osc)}
#geo-root .comentario-cab time{margin-left:auto;font-size:.78rem}
#geo-root .comentario-item p{margin:6px 0 0;font-size:.92rem;color:var(--cuerpo);overflow-wrap:anywhere}
#geo-root .comentario-vacio{color:var(--gris);font-size:.88rem;margin:8px 0 0}
#geo-root .comentario-forma .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
`;

type Vista = "home" | "planes" | "planesRapiqo";

// Tres bloques bajo el hero (brief §4.A) — textos del brief tal cual.
const BLOQUES = [
  { titulo: "Desarrollo propio", cuerpo: "Creamos productos digitales con identidad, arquitectura y propósito propios." },
  { titulo: "Tecnología funcional", cuerpo: "Diseñamos soluciones enfocadas en resolver problemas concretos." },
  { titulo: "Experiencias independientes", cuerpo: "Priorizamos rendimiento, simplicidad, privacidad y autonomía tecnológica." },
];

// Nosotros (brief §4.E) — textos del brief tal cual.
const VISION =
  "Construir un ecosistema de soluciones tecnológicas propias que simplifiquen la vida digital, conecten a las personas con su entorno y transformen ideas en herramientas útiles.";
const MISION =
  "Diseñar y desarrollar aplicaciones funcionales, accesibles y confiables, combinando tecnología, innovación y simplicidad para resolver necesidades reales.";
const VALORES = ["Innovación", "Simplicidad", "Autonomía", "Privacidad", "Funcionalidad", "Desarrollo continuo"];

// Características verificadas de Cumbre30 (brief §4.B): tomadas del
// contenido real del producto (catálogo /geo y planes Pro).
const CUMBRE30_FEATURES = [
  "Registro de rides con GPS y mapas 100% offline",
  "Alertas de voz, pitidos y vibración con el límite 30 km/h",
  "Rutas y navegación en el Parque Metropolitano de Santiago",
  "Constancias de ride con QR verificable",
  "Plan Pro de pago único: sin suscripción ni publicidad",
];

// RAPIQO (v1.29.5): datos reales del producto desplegado en
// rapiqo.cumbregeo.cl (dist 2.9.1). Los beneficios de PRO son los
// textos exactos del paywall de la app — nada inventado.
const RAPIQO_VERSION = "2.9.1";
const RAPIQO_URL = "https://rapiqo.cumbregeo.cl";
const RAPIQO_PAY_URL = "https://mpago.la/2wvHvUS";
const RAPIQO_PRECIO = "14.990";
const RAPIQO_PRO_BENEFITS = [
  "Lotes y flujos sin límite de archivos ni de etapas",
  "Plantillas de flujo guardadas y reutilizables",
  "Todas las herramientas actuales y futuras de la plataforma web",
  "Funciones nuevas durante 12 meses; la app ya instalada sigue funcionando para siempre",
];

// Estructura mínima que consume el modal de detalles (las apps del
// catálogo cumplen de sobra; RAPIQO no está en el catálogo y define
// el suyo).
type ModalApp = {
  id: string;
  nombre: string;
  icono: string;
  version: string | null;
  versionCode?: number;
  descripcionBreve: string;
  detalleCompleto: { titulo: string; cuerpo: string }[];
  imagenes: { src: string; alt: string }[];
  apk: { disponible: boolean; url?: string | null; nota?: string };
  planes: { publicado: boolean };
  enlaces?: {
    contacto: string;
    privacidad: string;
    terminos?: string | null;
    eliminarCuenta: string;
  };
};

// Modal «Ver detalles» de RAPIQO: secciones tomadas del producto real.
const RAPIQO_MODAL: ModalApp = {
  id: "rapiqo",
  nombre: "RAPIQO",
  icono: "",
  version: RAPIQO_VERSION,
  descripcionBreve:
    "Una herramienta web para procesar, convertir y trabajar con documentos PDF, Office y otros formatos: unificar, organizar, optimizar, convertir, proteger, extraer, OCR, comparar e inspeccionar. Todo el procesamiento ocurre en tu navegador.",
  detalleCompleto: [
    {
      titulo: "Herramientas",
      cuerpo:
        "Un pack completo para acelerar tus procesos con documentos: unificar, organizar, optimizar, convertir, proteger, extraer, OCR, comparar e inspeccionar. Cada herramienta ejecuta una operación real.",
    },
    {
      titulo: "Flujo por etapas",
      cuerpo:
        "Encadena pasos en procesos reutilizables o procesa muchos archivos de una vez: renombrar, convertir, optimizar y organizar por lotes. Eliges la política de fallos: omitir archivo y seguir, continuar con la etapa siguiente o cancelar el proceso.",
    },
    {
      titulo: "Privacidad local-first",
      cuerpo:
        "Sin cuentas, sin subidas y sin rastreo: RAPIQO se ejecuta íntegramente en tu navegador y el procesamiento funciona incluso sin conexión. Los documentos de la sesión viven en la memoria de la pestaña y se liberan al cerrarla.",
    },
  ],
  imagenes: [],
  apk: { disponible: false },
  planes: { publicado: false },
};

// Mockup de la interfaz de RAPIQO (reutilizable desde la tarjeta
// y desde el modal de detalles).
function MockupRapiqoGeo() {
  return (
    <svg
      className="mockup-rapiqo"
      viewBox="0 0 360 240"
      role="img"
      aria-label="Mockup de la interfaz de RAPIQO, la aplicación web de CumbreDocs"
    >
      {/* Chrome de navegador (RAPIQO es una web) */}
      <rect width="360" height="240" rx="10" fill="#f0ede6" />
      <rect x="0" y="0" width="360" height="26" rx="10" fill="#e3ded4" />
      <rect x="0" y="16" width="360" height="10" fill="#e3ded4" />
      <circle cx="16" cy="13" r="3.5" fill="#e8a33d" />
      <circle cx="29" cy="13" r="3.5" fill="#b9a58c" />
      <path d="M44 9 l-5 4 5 4" stroke="#6d7c76" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 9 l5 4 -5 4" stroke="#c9c4ba" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="64" y="4" width="200" height="18" rx="9" fill="#fff" stroke="#d8d3c8" />
      <circle cx="76" cy="13" r="3" fill="#5a8f57" />
      <text x="84" y="16.5" fontSize="9" fill="#6d7c76">rapiqo.cumbregeo.cl</text>
      <rect x="12" y="38" width="90" height="190" rx="8" fill="#fff" stroke="#e3ded4" />
      <rect x="22" y="50" width="70" height="16" rx="4" fill="#e7f2e6" />
      <text x="30" y="61.5" fontSize="8" fontWeight="700" fill="#2e5e2b">PDF</text>
      <rect x="22" y="74" width="70" height="16" rx="4" fill="#f0ede6" />
      <text x="30" y="85.5" fontSize="8" fontWeight="700" fill="#42514b">DOCX</text>
      <rect x="22" y="98" width="70" height="16" rx="4" fill="#f0ede6" />
      <text x="30" y="109.5" fontSize="8" fontWeight="700" fill="#42514b">XLSX</text>
      <rect x="22" y="122" width="70" height="16" rx="4" fill="#f0ede6" />
      <text x="30" y="133.5" fontSize="8" fontWeight="700" fill="#42514b">HTML</text>
      <rect x="22" y="146" width="70" height="16" rx="4" fill="#f0ede6" />
      <text x="30" y="157.5" fontSize="8" fontWeight="700" fill="#42514b">CSV</text>
      <rect x="116" y="38" width="232" height="190" rx="8" fill="#fff" stroke="#e3ded4" />
      <text x="132" y="62" fontSize="11" fontWeight="700" fill="#14453d">informe-anual.pdf</text>
      <rect x="132" y="74" width="170" height="8" rx="4" fill="#f0ede6" />
      <rect x="132" y="88" width="140" height="8" rx="4" fill="#f0ede6" />
      <rect x="132" y="102" width="160" height="8" rx="4" fill="#f0ede6" />
      <rect x="132" y="116" width="110" height="8" rx="4" fill="#f0ede6" />
      <rect x="132" y="138" width="52" height="20" rx="5" fill="#e7f2e6" />
      <text x="158" y="151.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#2e5e2b">PDF</text>
      <path d="M196 148 h28 m0 0 l-7 -5 m7 5 l-7 5" stroke="#5a8f57" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="236" y="138" width="52" height="20" rx="5" fill="#f0ede6" />
      <text x="262" y="151.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#42514b">DOCX</text>
      <rect x="132" y="186" width="96" height="26" rx="8" fill="#5a8f57" />
      <text x="180" y="202.5" textAnchor="middle" fill="#fff" fontSize="10.5" fontWeight="700">Convertir</text>
    </svg>
  );
}

// Footer corporativo completo (brief §6): compartido por las vistas
// home y planes. Enlaces reales — sin inventar rutas.
function FooterGeo() {
  return (
    <footer className="geo-footer">
      <div className="contenedor">
        <div className="footer-grid">
          <div>
            <div className="footer-marca">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden>
                <path d="M3 19L10 6l4 7 2-3 5 9H3z" fill="#fff" />
                <circle cx="18" cy="5" r="2" fill="#e8a33d" />
              </svg>
              CUMBRE GEO
            </div>
            <p style={{ margin: 0, maxWidth: 300, lineHeight: 1.65 }}>
              Estudio tecnológico que desarrolla aplicaciones y herramientas digitales propias para explorar, trabajar y
              simplificar tareas cotidianas.
            </p>
          </div>
          <div>
            <h4>Líneas</h4>
            <a href="#soluciones">Outdoor &amp; Geospatial</a>
            <a href="/geo/cumbredocs">Documentos &amp; Productividad</a>
          </div>
          <div>
            <h4>Productos</h4>
            <a href="/geo/cumbreoutdoor">CumbreOutdoor</a>
            <a href="/geo/cumbredocs">CumbreDocs</a>
          </div>
          <div>
            <h4>Contacto</h4>
            <a href="#contacto">Formulario de contacto</a>
          </div>
        </div>
        <div className="footer-base">© {new Date().getFullYear()} CumbreGeo · Todos los derechos reservados.</div>
      </div>
    </footer>
  );
}

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
  const app: ModalApp | null =
    appId === "rapiqo"
      ? RAPIQO_MODAL
      : appId
        ? ((APPS.find((a) => a.id === appId) as unknown as ModalApp) ?? null)
        : null;
  const appPlanes = (planAppId ? APPS.find((a) => a.id === planAppId) : null) ?? APPS.find((a) => a.planes.publicado) ?? null;
  const app30 = APPS.find((a) => a.id === "cumbre30") ?? APPS[0];

  // Menú móvil + formulario de contacto (v1.29.0).
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: "", correo: "", tipo: "comercial", mensaje: "", web: "" });
  const [envio, setEnvio] = useState<"idle" | "enviando" | "ok" | "error">("idle");

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

  // Navegación por anclas dentro de la vista home (cierra el menú móvil).
  const irA = (ancla: string) => (e: MouseEvent) => {
    e.preventDefault();
    setMenuAbierto(false);
    const destino = document.querySelector(ancla);
    if (destino) destino.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Formulario de contacto → /api/contacto (DB + correo).
  const enviarContacto = async (e: FormEvent) => {
    e.preventDefault();
    if (envio === "enviando") return;
    setEnvio("enviando");
    try {
      const r = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean };
      if (r.ok && j.ok) {
        setEnvio("ok");
        setForm({ nombre: "", correo: "", tipo: "comercial", mensaje: "", web: "" });
      } else {
        setEnvio("error");
      }
    } catch {
      setEnvio("error");
    }
  };

  const irAPlanes = (a: { id: string; planes: { publicado: boolean } }) => {
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
                setMenuAbierto(false);
                mostrarVista("home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M3 19L10 6l4 7 2-3 5 9H3z" fill="#14453d" />
                <circle cx="18" cy="5" r="2" fill="#e8a33d" />
              </svg>
              CUMBRE GEO
            </a>
            <nav className="nav" aria-label="Navegación principal">
              <a href="#" onClick={irA("#")}>Inicio</a>
              <a href="#soluciones" onClick={irA("#soluciones")}>Soluciones</a>
              <a href="/geo/cumbredocs">CumbreDocs</a>
              <a href="#nosotros" onClick={irA("#nosotros")}>Nosotros</a>
              <a href="#contacto" onClick={irA("#contacto")}>Contacto</a>
              <a className="nav-cta" href="#soluciones" onClick={irA("#soluciones")}>Explorar soluciones</a>
            </nav>
            <button className="nav-toggle" onClick={() => setMenuAbierto((v) => !v)} aria-expanded={menuAbierto} aria-label="Abrir o cerrar el menú">
              {menuAbierto ? <X style={{ width: 20, height: 20 }} aria-hidden /> : <Menu style={{ width: 20, height: 20 }} aria-hidden />}
            </button>
          </div>
          <nav className={`nav-movil${menuAbierto ? " abierto" : ""}`} aria-label="Menú móvil">
            <a href="#" onClick={irA("#")}>Inicio</a>
            <a href="#soluciones" onClick={irA("#soluciones")}>Soluciones</a>
            <a href="/geo/cumbredocs" onClick={() => setMenuAbierto(false)}>CumbreDocs</a>
            <a href="#nosotros" onClick={irA("#nosotros")}>Nosotros</a>
            <a href="#contacto" onClick={irA("#contacto")}>Contacto</a>
            <a className="nav-cta" href="#soluciones" onClick={irA("#soluciones")}>Explorar soluciones</a>
          </nav>
        </header>

        {/* Hero corporativo (brief §4.A): textos del brief tal cual,
            motivo topográfico + mockup real de Cumbre30 en vivo. */}
        <div className="hero" id="top">
          <svg className="hero-topo" viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g fill="none" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1.5">
              <path d="M-50 500 C 150 400, 300 540, 480 450 S 820 320, 1000 400 S 1180 480, 1300 420" />
              <path d="M-50 440 C 140 350, 320 480, 500 400 S 830 270, 1010 350 S 1190 420, 1300 370" />
              <path d="M-50 380 C 130 300, 340 420, 520 350 S 840 220, 1020 300 S 1200 360, 1300 320" />
              <path d="M-50 320 C 120 250, 360 360, 540 300 S 850 180, 1030 250 S 1210 300, 1300 270" />
              <path d="M-50 260 C 110 200, 380 300, 560 250 S 860 140, 1040 200 S 1220 240, 1300 220" />
              <path d="M-50 200 C 100 150, 400 240, 580 200 S 870 100, 1050 150 S 1230 180, 1300 170" />
            </g>
            <circle cx="935" cy="150" r="3.5" fill="#e8a33d" />
            <circle cx="935" cy="150" r="15" fill="none" stroke="#e8a33d" strokeOpacity="0.45" />
            <circle cx="935" cy="150" r="28" fill="none" stroke="#e8a33d" strokeOpacity="0.22" />
          </svg>
          <div className="contenedor hero-grid">
            <div>
              <span className="kicker">CumbreGeo · Estudio tecnológico</span>
              <h1>Tecnología que conecta ideas con soluciones.</h1>
              <p className="hero-sub">
                Desarrollamos aplicaciones y herramientas digitales propias para explorar, trabajar y simplificar tareas
                cotidianas.
              </p>
              <div className="hero-acciones">
                <a className="btn btn-acento" href="#soluciones" onClick={irA("#soluciones")}>Explorar soluciones</a>
                <a className="btn btn-borde-blanco" href="#nosotros" onClick={irA("#nosotros")}>Conocer CumbreGeo</a>
              </div>
            </div>
            <div className="hero-visual">
              <div className="ventana">
                <div className="ventana-barra" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <img src="/apps/cumbre30/01-ride.jpg" alt="Cumbre30 en funcionamiento durante un ride" />
              </div>
              <div className="ventana-pie">Cumbre30 · ride en vivo</div>
            </div>
          </div>
        </div>

        {/* Tres bloques de identidad (brief §4.A) */}
        <section id="bloques">
          <div className="contenedor">
            <div className="bloques">
              {BLOQUES.map((b, i) => (
                <div key={b.titulo} className="bloque">
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{b.titulo}</h3>
                  <p>{b.cuerpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Soluciones (brief §4.B): dos categorías visualmente diferenciadas */}
        <section id="soluciones" style={{ paddingTop: 0 }}>
          <div className="contenedor">
            <span className="seccion-kicker">Soluciones</span>
            <h2 className="seccion-titulo">Dos líneas, un mismo espíritu</h2>
            <p className="seccion-sub">
              Cada línea agrupa productos con identidad y arquitectura propias, unidos por la misma filosofía:
              tecnología simple, funcional e independiente.
            </p>

            {/* ── OUTDOOR & GEOSPATIAL ── */}
            <div className="categoria">
              <div className="categoria-head">
                <span className="cat-icono" style={{ background: "var(--verde)" }}>
                  <Mountain style={{ width: 20, height: 20 }} aria-hidden />
                </span>
                <div>
                  <h3>OUTDOOR &amp; GEOSPATIAL</h3>
                  <p>Soluciones digitales para explorar, navegar y conectar con el entorno.</p>
                </div>
              </div>
              <div className="producto">
                <div className="producto-visual">
                  <img src={app30.imagenes[0]?.src} alt="Cumbre30 registrando un ride con mapa en vivo" />
                </div>
                <div>
                  <p className="linea-de">Línea CumbreOutdoor</p>
                  <h4 className="producto-nombre">
                    {app30.nombre}
                    <span className="estado disponible">Disponible · v{app30.version}</span>
                  </h4>
                  <p style={{ color: "var(--cuerpo)", fontSize: ".95rem", margin: "8px 0 0" }}>
                    Ciclocomputador digital diseñado para acompañar tus recorridos en bicicleta.
                  </p>
                  <ul>
                    {CUMBRE30_FEATURES.map((c) => (
                      <li key={c}>
                        <CheckCircle2 style={{ width: 15, height: 15 }} aria-hidden /> {c}
                      </li>
                    ))}
                  </ul>
                  <div className="producto-acciones">
                    <button className="btn btn-primario" onClick={() => irAPlanes(app30)}>Ver planes</button>
                    <button className="btn btn-secundario" onClick={() => setAppId(app30.id)}>Ver detalles</button>
                    <a className="btn btn-fantasma" href="/demo">Probar demo</a>
                    <a className="btn btn-fantasma" href="/geo/cumbreoutdoor">Conocer CumbreOutdoor</a>
                  </div>
                </div>
              </div>
            </div>

            {/* ── DOCUMENTOS & PRODUCTIVIDAD ── */}
            <div className="categoria">
              <div className="categoria-head">
                <span className="cat-icono" style={{ background: "var(--acento-n)" }}>
                  <FileText style={{ width: 20, height: 20 }} aria-hidden />
                </span>
                <div>
                  <h3>DOCUMENTOS &amp; PRODUCTIVIDAD</h3>
                  <p>Herramientas digitales para trabajar con documentos de forma más simple y eficiente.</p>
                </div>
              </div>
              <div className="producto">
                <div className="producto-visual" style={{ padding: 10 }}>
                  <MockupRapiqoGeo />
                </div>
                <div>
                  <p className="linea-de">Línea CumbreDocs</p>
                  <h4 className="producto-nombre">
                    RAPIQO
                    <span className="estado disponible">Disponible · v{RAPIQO_VERSION}</span>
                  </h4>
                  <p style={{ color: "var(--cuerpo)", fontSize: ".95rem", margin: "8px 0 0" }}>
                    Una herramienta web para procesar, convertir y trabajar con documentos PDF, Office y otros
                    formatos.
                  </p>
                  <ul>
                    {[
                      "Procesamiento de documentos PDF, Office, HTML y tablas",
                      "Conversión entre formatos de documento",
                      "Edición y gestión centralizada de archivos",
                      "Web app: tus documentos no salen de tu navegador",
                    ].map((c) => (
                      <li key={c}>
                        <CheckCircle2 style={{ width: 15, height: 15 }} aria-hidden /> {c}
                      </li>
                    ))}
                  </ul>
                  <div className="producto-acciones">
                    <button className="btn btn-primario" onClick={() => mostrarVista("planesRapiqo")}>Ver planes</button>
                    <button className="btn btn-secundario" onClick={() => setAppId("rapiqo")}>Ver detalles</button>
                    <a className="btn btn-acento" href={RAPIQO_URL} target="_blank" rel="noreferrer">
                      Abrir RAPIQO
                    </a>
                    <a className="btn btn-fantasma" href="/geo/cumbredocs">Conocer CumbreDocs</a>
                  </div>
                </div>
              </div>
            </div>

            <p className="producto-nota">
              La línea Outdoor seguirá creciendo con nuevas aplicaciones geográficas y outdoor; en Documentos &amp;
              Productividad, RAPIQO es el primer producto del ecosistema CumbreDocs.
            </p>
          </div>
        </section>

        {/* Nosotros (brief §4.E): visión, misión y valores del brief tal cual */}
        <section id="nosotros" style={{ background: "var(--piedra)" }}>
          <div className="contenedor">
            <span className="seccion-kicker">Nosotros</span>
            <h2 className="seccion-titulo">Un estudio que construye sus propias herramientas</h2>
            <p className="seccion-sub">
              CumbreGeo desarrolla software propio desde Chile: cada producto nace de una necesidad real y se mantiene
              con independencia técnica, sin publicidad ni dependencias innecesarias.
            </p>
            <div className="nosotros-grid">
              <div className="nosotros-tarjeta">
                <h3>Visión</h3>
                <p>{VISION}</p>
              </div>
              <div className="nosotros-tarjeta">
                <h3>Misión</h3>
                <p>{MISION}</p>
              </div>
            </div>
            <div className="valores">
              {VALORES.map((v) => (
                <div key={v} className="valor">{v}</div>
              ))}
            </div>
          </div>
        </section>

        {/* Contacto (brief §4.F): formulario funcional → /api/contacto.
            El correo es el existente de contacto (CONTACT_EMAIL). */}
        <section id="contacto">
          <div className="contenedor">
            <span className="seccion-kicker">Contacto</span>
            <h2 className="seccion-titulo">Hablemos</h2>
            <div className="contacto-grid" style={{ marginTop: "1.4rem" }}>
              <div className="contacto-info">
                <p>
                  Escríbenos para <strong>consultas comerciales</strong> (alianzas, prensa, distribución) o por el{" "}
                  <strong>soporte de productos</strong> (Cumbre30, RAPIQO). Te responderemos al correo que dejes en el
                  formulario.
                </p>
                <p>
                  ¿Prefieres el correo directo? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                </p>
                <p style={{ fontSize: ".85rem", color: "var(--gris)" }}>
                  El soporte de licencias de Cumbre30 Pro sigue disponible dentro de la app y en la página de planes.
                </p>
              </div>
              <form className="form" onSubmit={enviarContacto}>
                <div className="fila">
                  <div className="campo">
                    <label htmlFor="c-nombre">Nombre</label>
                    <input
                      id="c-nombre"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="c-correo">Correo</label>
                    <input
                      id="c-correo"
                      type="email"
                      value={form.correo}
                      onChange={(e) => setForm({ ...form, correo: e.target.value })}
                      required
                      maxLength={120}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="campo">
                  <label htmlFor="c-tipo">Motivo</label>
                  <select id="c-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="comercial">Consulta comercial</option>
                    <option value="soporte">Soporte de productos</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="c-mensaje">Mensaje</label>
                  <textarea
                    id="c-mensaje"
                    rows={5}
                    value={form.mensaje}
                    onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                </div>
                {/* Honeypot: invisible para personas, tentador para bots */}
                <div className="hp" aria-hidden="true">
                  <label htmlFor="c-web">Web (no completar este campo)</label>
                  <input
                    id="c-web"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.web}
                    onChange={(e) => setForm({ ...form, web: e.target.value })}
                  />
                </div>
                <button className="btn btn-acento" type="submit" disabled={envio === "enviando"} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {envio === "enviando" ? (
                    <Loader2 style={{ width: 16, height: 16 }} className="geo-girando" aria-hidden />
                  ) : (
                    <Send style={{ width: 16, height: 16 }} aria-hidden />
                  )}
                  {envio === "enviando" ? "Enviando…" : "Enviar mensaje"}
                </button>
                {envio === "ok" && (
                  <p className="aviso-forma ok" role="status">
                    <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden /> Mensaje enviado. Te
                    responderemos a tu correo.
                  </p>
                )}
                {envio === "error" && (
                  <p className="aviso-forma error" role="alert">
                    <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden /> No se pudo enviar.
                    Intenta de nuevo o escríbenos a {CONTACT_EMAIL}.
                  </p>
                )}
                <p className="form-nota">Tus datos se usan solo para responder esta consulta.</p>
              </form>
            </div>
          </div>
        </section>

        <FooterGeo />
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
                  Sube tu límite: todo desbloqueado de una vez, para siempre.
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

        <FooterGeo />
      </div>

      {/* ═══════════ VISTA: PLANES RAPIQO (v1.29.5) ═══════════ */}
      <div className={`vista${vista === "planesRapiqo" ? " activa" : ""}`}>
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
            <button className="btn btn-secundario" onClick={() => setAppId("rapiqo")}>
              Ver detalles
            </button>
          </div>

          <span className="seccion-kicker">Planes · RAPIQO</span>
          <h2 className="seccion-titulo">Licencia PRO · pago único</h2>
          <p className="seccion-sub">Desbloquea todo el potencial de RAPIQO de una sola vez, para siempre.</p>

          {/* Precio + compra: link de pago real de MercadoPago (app RAPIQO) */}
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
              <FileText style={{ width: 30, height: 30, color: "#fff" }} aria-hidden />
            </span>
            <h3 style={{ fontSize: "1.6rem", marginTop: 12 }}>
              RAPIQO <span style={{ color: "var(--acento)" }}>Pro</span>
            </h3>
            <p style={{ color: "var(--gris)", margin: "4px 0 0" }}>
              Un pack completo para tus procesos con documentos: sin límites de lotes ni de etapas.
            </p>

            <p style={{ fontSize: "3rem", fontWeight: 800, color: "var(--verde-osc)", margin: "20px 0 0", lineHeight: 1 }}>
              ${RAPIQO_PRECIO}
            </p>
            <p style={{ color: "#8a6a2f", fontSize: ".85rem", margin: "6px 0 18px" }}>
              pago único · sin suscripción · para siempre
            </p>

            <a
              href={RAPIQO_PAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primario"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 22px", fontSize: "1rem" }}
            >
              <ShoppingBag style={{ width: 20, height: 20 }} aria-hidden /> Comprar Pro - ${RAPIQO_PRECIO}
            </a>
            <p style={{ color: "var(--gris)", fontSize: ".85rem", margin: "14px auto 0", maxWidth: 480 }}>
              Pagas con Mercado Pago y recibes tu clave{" "}
              <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--verde-osc)" }}>RQ1.…</span> por
              correo, automáticamente una vez aprobado el pago. Después la activas en la app:{" "}
              <b style={{ color: "var(--texto)" }}>Ajustes → Licencia</b>.
            </p>
          </div>

          {/* Qué desbloquea: textos exactos del paywall de la app (dist 2.9.1) */}
          <div className="bloque-pro">
            <span className="seccion-kicker">Qué desbloquea Pro</span>
            <div>
              {RAPIQO_PRO_BENEFITS.map((b) => (
                <div key={b} className="beneficio">
                  <BadgeCheck style={{ width: 18, height: 18, flexShrink: 0, color: "var(--verde)", marginTop: 2 }} aria-hidden />
                  <span>{b}</span>
                </div>
              ))}
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
              Pago único: la clave se verifica en tu dispositivo, sin registro ni conexión obligatoria. La edición
              gratuita sigue disponible; Pro quita los límites de lotes y flujos y agrega las plantillas guardadas.
            </p>
          </div>

          {/* Cómo activar */}
          <div className="bloque-pro">
            <span className="seccion-kicker">Cómo activar tu clave</span>
            <div style={{ display: "grid", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="paso-num">1</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--verde-osc)" }}>Paga con Mercado Pago</p>
                  <p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: ".92rem" }}>
                    Desde el botón de arriba: tarjeta, dinero en cuenta o efectivo en agentes.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="paso-num">2</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--verde-osc)" }}>Recibe tu clave por correo</p>
                  <p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: ".92rem" }}>
                    La clave empieza por <span style={{ fontFamily: "ui-monospace, monospace" }}>RQ1.</span> y llega
                    automáticamente (normalmente en minutos; si demora, escríbenos con tu comprobante a{" "}
                    {CONTACT_EMAIL}).
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="paso-num">3</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--verde-osc)" }}>Actívala en la app</p>
                  <p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: ".92rem" }}>
                    Abre RAPIQO → Ajustes → Licencia → pega tu clave. La verificación es local en tu dispositivo.
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
              RAPIQO funciona 100% en tu navegador: una vez cargada la página, todo el procesamiento es local,
              incluso sin conexión.
            </p>
          </div>

          {/* FAQ */}
          <div className="bloque-pro">
            <span className="seccion-kicker">Preguntas frecuentes</span>
            <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
              <div className="faq-card">
                <p className="q">¿Es un pago único o suscripción?</p>
                <p className="a">Pago único: activas PRO para siempre en ese dispositivo, sin renovaciones ni cobros automáticos.</p>
              </div>
              <div className="faq-card">
                <p className="q">¿Cuándo llega la clave?</p>
                <p className="a">
                  Automáticamente por correo una vez aprobado el pago (normalmente en minutos). Si demora, escríbenos
                  a {CONTACT_EMAIL} con tu comprobante.
                </p>
              </div>
              <div className="faq-card">
                <p className="q">¿Necesito internet para usar RAPIQO?</p>
                <p className="a">
                  Para pagar, recibir y activar la clave sí. Para usar la app no: una vez cargada, todo el
                  procesamiento ocurre en tu navegador, incluso sin conexión.
                </p>
              </div>
              <div className="faq-card">
                <p className="q">¿La edición gratuita sigue disponible?</p>
                <p className="a">
                  Sí. La versión gratuita procesa lotes con límites de archivos y etapas; PRO los quita y además
                  permite guardar plantillas de flujo reutilizables.
                </p>
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
              CumbreGeo no almacena datos de tarjetas.
            </p>
          </div>
        </div>

        <FooterGeo />
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
                {app.id === "rapiqo" ? (
                  <FileText style={{ width: 30, height: 30, color: "#fff" }} aria-hidden />
                ) : (
                  <img src={app.icono} alt={`Ícono de ${app.nombre}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div>
                <h3>{app.nombre}</h3>
                <div className="version">
                  {app.id === "rapiqo"
                    ? `Versión ${RAPIQO_VERSION} · beta web`
                    : `Versión ${app.version} · build ${app.versionCode}`}
                </div>
              </div>
            </div>

            <div className="modal-cuerpo">
              {app.id === "rapiqo" ? (
                <>
                  {/* RAPIQO (v1.29.5): web en producción, sin APK */}
                  <a href={RAPIQO_URL} target="_blank" rel="noreferrer" className="btn btn-acento apk-btn">
                    Abrir RAPIQO en el navegador
                  </a>
                  <p className="apk-nota">
                    Web app: funciona en el navegador, sin instalar nada. Una vez cargada, procesa incluso sin
                    conexión.
                  </p>
                  <div className="capturas" style={{ justifyContent: "center" }}>
                    <div
                      style={{
                        flex: "0 1 420px",
                        border: "1px solid var(--borde)",
                        borderRadius: 14,
                        background: "var(--piedra)",
                        padding: 10,
                      }}
                    >
                      <MockupRapiqoGeo />
                      <p style={{ margin: "8px 0 0", fontSize: ".78rem", color: "var(--gris)", textAlign: "center" }}>
                        Interfaz de RAPIQO {RAPIQO_VERSION}
                      </p>
                    </div>
                  </div>
                  <h4 style={{ color: "var(--verde-osc)", margin: "0 0 6px" }}>Detalle completo</h4>
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
                </>
              ) : (
                <>
                  {/* Demo en vivo (v1.11.0): la web corre la app en modo demo
                      en el navegador - probar sin instalar. Solo Cumbre30. */}
                  {app.id === "cumbre30" && (
                    <>
                      <a
                        href="/demo"
                        className="btn btn-secundario apk-btn"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                          <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" />
                        </svg>
                        Probar demo en el navegador
                      </a>
                      <p className="apk-nota">Prueba en línea la subida Pío Nono → Plaza México, sin instalar nada.</p>
                    </>
                  )}
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
                      {/* Verificación de constancias (v1.12.0): el QR del PDF
                          llega a /verificar; el enlace directo vive aquí para
                          quien quiera comprobar un ride sin escanear. */}
                      <a href="/verificar" className="apk-verificar">
                        Verificar constancia de un ride
                      </a>
                      <p className="apk-nota">Comprueba el código de integridad de cualquier constancia con QR.</p>
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
                </>
              )}

              {/* Comentarios del modal (v1.29.5): evaluación obligatoria +
                  comentario, recientes primero, para ambos productos. */}
              <ComentariosProducto producto={app.id === "rapiqo" ? "rapiqo" : "cumbre30"} />
            </div>

            <div className="modal-foot">
              <button className="btn btn-fantasma" onClick={() => setAppId(null)}>
                Volver al home
              </button>
              {app.id === "rapiqo" ? (
                <button className="btn btn-secundario" onClick={() => mostrarVista("planesRapiqo")}>
                  Ver planes
                </button>
              ) : (
                app.planes.publicado && (
                  <button className="btn btn-secundario" onClick={() => irAPlanes(app)}>
                    Ver planes
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
