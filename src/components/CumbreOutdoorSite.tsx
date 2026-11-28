// ============================================================
// CumbreOutdoorSite (v1.29.5): contenido de la página
// /geo/cumbreoutdoor. Línea OUTDOOR & GEOSPATIAL de CumbreGeo —
// Cumbre30 es su primer producto (espejo de CumbreDocs → RAPIQO).
// Componente de servidor (sin estado); estilos acotados a
// #co-root con la misma paleta corporativa.
// ============================================================
import { CheckCircle2, Mountain } from "lucide-react";
import { APP_VERSION } from "@/lib/appVersion";
import { CONTACT_EMAIL } from "@/lib/proConfig";

const CSS = `
#co-root{--verde:#14453d;--verde-osc:#0b2b26;--acento-n:#5a8f57;--tierra:#b9a58c;--piedra:#f0ede6;--crema:#f6f4ef;--texto:#24312d;--gris:#6d7c76;--borde:#e3ded4;--blanco:#fff;--radio:16px;--sombra:0 8px 24px rgba(11,43,38,.10);color:var(--texto);background:var(--crema);line-height:1.6;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
#co-root .contenedor{max-width:1100px;margin:0 auto;padding:0 24px}
#co-root header{position:sticky;top:0;z-index:50;background:var(--blanco);border-bottom:1px solid var(--borde)}
#co-root .header-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
#co-root .logo{display:flex;align-items:center;gap:10px;font-weight:800;color:var(--verde-osc);font-size:1.05rem;text-decoration:none}
#co-root .logo svg{width:28px;height:28px}
#co-root .volver{font-size:.85rem;font-weight:700;color:var(--verde);text-decoration:none}
#co-root section{padding:60px 0}
#co-root h2.seccion-titulo{font-size:1.7rem;color:var(--verde-osc);margin-bottom:.3rem}
#co-root .seccion-kicker{display:inline-block;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--acento-n);margin-bottom:.4rem}
#co-root .seccion-sub{color:var(--gris);max-width:640px;margin-bottom:2rem}
#co-root .hero{background:linear-gradient(160deg,var(--verde-osc) 0%,var(--verde) 74%);color:#fff;padding:80px 0}
#co-root .hero h1{font-size:clamp(1.9rem,4vw,2.8rem);line-height:1.15;margin:0 0 1rem;max-width:700px}
#co-root .hero p{color:#d5e6e1;font-size:1.02rem;max-width:600px;margin:0}
#co-root .kicker{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#a9d6ab;border:1px solid rgba(169,214,171,.4);border-radius:999px;padding:6px 14px;margin-bottom:1.2rem}
#co-root .btn{display:inline-block;border:none;border-radius:12px;padding:12px 22px;font-weight:700;text-decoration:none;transition:.2s;cursor:pointer;font:inherit}
#co-root .btn-acento{background:var(--acento-n);color:#fff}
#co-root .btn-acento:hover{filter:brightness(1.06)}
#co-root .btn-secundario{background:transparent;border:2px solid var(--verde);color:var(--verde)}
#co-root .btn-secundario:hover{background:var(--verde);color:#fff}
#co-root .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
#co-root .tarjeta{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);padding:26px;box-shadow:var(--sombra)}
#co-root .tarjeta h3{margin:0 0 .5rem;color:var(--verde-osc);font-size:1.05rem}
#co-root .tarjeta p{margin:0;color:#42514b;font-size:.95rem}
#co-root .producto{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);box-shadow:var(--sombra);overflow:hidden}
#co-root .producto-head{display:flex;align-items:center;gap:14px;padding:18px 26px;background:var(--piedra)}
#co-root .producto-head .icono{width:40px;height:40px;border-radius:12px;background:var(--verde);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
#co-root .producto-head h3{margin:0;font-size:1rem;color:var(--verde-osc);letter-spacing:.03em}
#co-root .producto-cuerpo{display:grid;grid-template-columns:300px 1fr;gap:28px;padding:26px;align-items:center}
#co-root .estado{display:inline-block;font-size:.72rem;font-weight:700;padding:4px 12px;border-radius:999px;margin-left:8px;vertical-align:middle;background:#e7f2e6;color:#2e5e2b;border:1px solid #cfe4cd}
#co-root ul.dots{margin:14px 0 18px;padding:0;list-style:none;display:grid;gap:7px}
#co-root ul.dots li{display:flex;gap:8px;align-items:flex-start;font-size:.92rem;color:#42514b}
#co-root ul.dots li svg{flex-shrink:0;color:var(--acento-n);margin-top:2px}
#co-root .nombre{font-size:1.5rem;font-weight:800;color:var(--verde-osc);margin:0}
#co-root .visual{border:1px solid var(--borde);border-radius:12px;overflow:hidden;background:var(--piedra)}
#co-root .visual img{display:block;width:100%;height:auto}
#co-root footer{background:var(--verde-osc);color:#9db8b1;text-align:center;padding:26px 0;font-size:.85rem}
#co-root footer a{color:#c8d9d4;text-decoration:none}
#co-root footer a:hover{color:#fff}
@media(max-width:800px){
  #co-root .grid-2{grid-template-columns:1fr}
  #co-root .producto-cuerpo{grid-template-columns:1fr}
  #co-root section{padding:44px 0}
}
`;

// Características verificadas de Cumbre30 (las mismas del catálogo /geo).
const CUMBRE30_FEATURES = [
  "Registro de rides con GPS y mapas 100% offline",
  "Alertas de voz, pitidos y vibración con el límite 30 km/h",
  "Rutas y navegación en el Parque Metropolitano de Santiago",
  "Constancias de ride con QR verificable",
  "Plan Pro de pago único: sin suscripción ni publicidad",
];

export default function CumbreOutdoorSite() {
  return (
    <main id="co-root" className="min-h-dvh w-full">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header>
        <div className="contenedor header-inner">
          <a className="logo" href="/geo">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 19L10 6l4 7 2-3 5 9H3z" fill="#14453d" />
              <circle cx="18" cy="5" r="2" fill="#e8a33d" />
            </svg>
            CUMBRE GEO
          </a>
          <a className="volver" href="/geo">← Volver al inicio</a>
        </div>
      </header>

      {/* Hero de la línea */}
      <div className="hero">
        <div className="contenedor">
          <span className="kicker">CumbreOutdoor · Línea Outdoor &amp; Geospatial</span>
          <h1>Explora, con tecnología propia.</h1>
          <p>
            CumbreOutdoor es la línea outdoor y geoespacial de CumbreGeo: aplicaciones propias para explorar, navegar
            y conectar con el entorno, sin depender de servicios de terceros.
          </p>
        </div>
      </div>

      {/* Presentación + propósito + filosofía */}
      <section id="linea">
        <div className="contenedor">
          <span className="seccion-kicker">La línea</span>
          <h2 className="seccion-titulo">Tecnología para el territorio</h2>
          <p className="seccion-sub">
            CumbreOutdoor agrupa las soluciones de CumbreGeo dedicadas al aire libre y lo geoespacial. Nace de una
            necesidad real: recorrer y registrar el territorio con herramientas que funcionen sin conexión y respeten
            la privacidad de quien las usa.
          </p>
          <div className="grid-2">
            <div className="tarjeta">
              <h3>Propósito</h3>
              <p>
                Acompañar el recorrido de principio a fin: registrar, navegar y comprobar lo vivido con datos propios,
                mapas offline y constancias verificables, todo desde el teléfono, sin publicidad.
              </p>
            </div>
            <div className="tarjeta">
              <h3>Filosofía de desarrollo</h3>
              <p>
                La misma del estudio: productos funcionales que resuelven problemas concretos, con desarrollo continuo
                y el procesamiento corriendo en tu propio dispositivo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Productos: Cumbre30 destacado (espejo de RAPIQO en CumbreDocs) */}
      <section id="cumbre30" style={{ background: "var(--piedra)" }}>
        <div className="contenedor">
          <span className="seccion-kicker">Productos disponibles y futuros</span>
          <h2 className="seccion-titulo">El primer producto: Cumbre30</h2>
          <p className="seccion-sub">
            Cumbre30 es el primer producto de CumbreOutdoor y define el rumbo de la línea. La línea seguirá creciendo
            con nuevas aplicaciones geográficas y outdoor; aquí se anunciarán cuando estén en camino.
          </p>
          <div className="producto">
            <div className="producto-head">
              <span className="icono">
                <Mountain style={{ width: 20, height: 20 }} aria-hidden />
              </span>
              <div>
                <h3>OUTDOOR &amp; GEOSPATIAL · CUMBREOUTDOOR</h3>
              </div>
            </div>
            <div className="producto-cuerpo">
              <div className="visual">
                <img src="/apps/cumbre30/01-ride.jpg" alt="Cumbre30 registrando un ride con mapa en vivo" />
                <p style={{ margin: "8px 10px 10px", fontSize: ".78rem", color: "var(--gris)", textAlign: "center" }}>
                  Cumbre30 {APP_VERSION} · ride en vivo con mapa offline
                </p>
              </div>
              <div>
                <h4 className="nombre">
                  Cumbre30
                  <span className="estado">Disponible · v{APP_VERSION}</span>
                </h4>
                <p style={{ color: "#42514b", fontSize: ".95rem", margin: "8px 0 0" }}>
                  Ciclocomputador digital diseñado para acompañar tus recorridos en bicicleta.
                </p>
                <ul className="dots">
                  {CUMBRE30_FEATURES.map((c) => (
                    <li key={c}>
                      <CheckCircle2 style={{ width: 15, height: 15 }} aria-hidden /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section id="contacto-linea">
        <div className="contenedor" style={{ textAlign: "center" }}>
          <h2 className="seccion-titulo">¿Consulta sobre CumbreOutdoor o Cumbre30?</h2>
          <p className="seccion-sub" style={{ margin: "0 auto 1.4rem" }}>
            Usa el formulario de contacto del sitio o escríbenos directo ({CONTACT_EMAIL}): respondemos consultas
            comerciales y de soporte.
          </p>
          <a className="btn btn-acento" href="/geo#contacto">Ir al formulario de contacto</a>
        </div>
      </section>

      <footer>
        © {new Date().getFullYear()} CumbreGeo · Todos los derechos reservados ·{" "}
        <a href="/geo">cumbregeo.cl</a>
      </footer>
    </main>
  );
}
