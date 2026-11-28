// ============================================================
// CumbreDocsSite (v1.29.3): contenido de la página /geo/cumbredocs.
// Línea DOCUMENTOS & PRODUCTIVIDAD de CumbreGeo — RAPIQO es su
// primer producto (estado real: versión web 2.9.0 en línea en
// rapiqo.cumbregeo.cl). Componente de servidor (sin estado);
// estilos acotados a #cd-root con la misma paleta corporativa.
// ============================================================
import { CheckCircle2, FileText } from "lucide-react";

const CSS = `
#cd-root{--verde:#14453d;--verde-osc:#0b2b26;--acento-n:#5a8f57;--tierra:#b9a58c;--piedra:#f0ede6;--crema:#f6f4ef;--texto:#24312d;--gris:#6d7c76;--borde:#e3ded4;--blanco:#fff;--radio:16px;--sombra:0 8px 24px rgba(11,43,38,.10);color:var(--texto);background:var(--crema);line-height:1.6;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
#cd-root .contenedor{max-width:1100px;margin:0 auto;padding:0 24px}
#cd-root header{position:sticky;top:0;z-index:50;background:var(--blanco);border-bottom:1px solid var(--borde)}
#cd-root .header-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
#cd-root .logo{display:flex;align-items:center;gap:10px;font-weight:800;color:var(--verde-osc);font-size:1.05rem;text-decoration:none}
#cd-root .logo svg{width:28px;height:28px}
#cd-root .volver{font-size:.85rem;font-weight:700;color:var(--verde);text-decoration:none}
#cd-root section{padding:60px 0}
#cd-root h2.seccion-titulo{font-size:1.7rem;color:var(--verde-osc);margin-bottom:.3rem}
#cd-root .seccion-kicker{display:inline-block;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--acento-n);margin-bottom:.4rem}
#cd-root .seccion-sub{color:var(--gris);max-width:640px;margin-bottom:2rem}
#cd-root .hero{background:linear-gradient(160deg,var(--verde-osc) 0%,var(--verde) 74%);color:#fff;padding:80px 0}
#cd-root .hero h1{font-size:clamp(1.9rem,4vw,2.8rem);line-height:1.15;margin:0 0 1rem;max-width:700px}
#cd-root .hero p{color:#d5e6e1;font-size:1.02rem;max-width:600px;margin:0}
#cd-root .kicker{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#a9d6ab;border:1px solid rgba(169,214,171,.4);border-radius:999px;padding:6px 14px;margin-bottom:1.2rem}
#cd-root .btn{display:inline-block;border:none;border-radius:12px;padding:12px 22px;font-weight:700;text-decoration:none;transition:.2s;cursor:pointer;font:inherit}
#cd-root .btn-acento{background:var(--acento-n);color:#fff}
#cd-root .btn-acento:hover{filter:brightness(1.06)}
#cd-root .btn-secundario{background:transparent;border:2px solid var(--verde);color:var(--verde)}
#cd-root .btn-secundario:hover{background:var(--verde);color:#fff}
#cd-root .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
#cd-root .tarjeta{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);padding:26px;box-shadow:var(--sombra)}
#cd-root .tarjeta h3{margin:0 0 .5rem;color:var(--verde-osc);font-size:1.05rem}
#cd-root .tarjeta p{margin:0;color:#42514b;font-size:.95rem}
#cd-root .producto{background:var(--blanco);border:1px solid var(--borde);border-radius:var(--radio);box-shadow:var(--sombra);overflow:hidden}
#cd-root .producto-head{display:flex;align-items:center;gap:14px;padding:18px 26px;background:var(--piedra)}
#cd-root .producto-head .icono{width:40px;height:40px;border-radius:12px;background:var(--acento-n);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
#cd-root .producto-head h3{margin:0;font-size:1rem;color:var(--verde-osc);letter-spacing:.03em}
#cd-root .producto-cuerpo{display:grid;grid-template-columns:300px 1fr;gap:28px;padding:26px;align-items:center}
#cd-root .estado{display:inline-block;font-size:.72rem;font-weight:700;padding:4px 12px;border-radius:999px;margin-left:8px;vertical-align:middle;background:#f6ecdb;color:#8a6a2f;border:1px solid #ecd9b7}
#cd-root .estado.disponible{background:#e7f2e6;color:#2e5e2b;border:1px solid #cfe4cd}
#cd-root ul.dots{margin:14px 0 18px;padding:0;list-style:none;display:grid;gap:7px}
#cd-root ul.dots li{display:flex;gap:8px;align-items:flex-start;font-size:.92rem;color:#42514b}
#cd-root ul.dots li svg{flex-shrink:0;color:var(--acento-n);margin-top:2px}
#cd-root .nombre{font-size:1.5rem;font-weight:800;color:var(--verde-osc);margin:0}
#cd-root footer{background:var(--verde-osc);color:#9db8b1;text-align:center;padding:26px 0;font-size:.85rem}
#cd-root footer a{color:#c8d9d4;text-decoration:none}
#cd-root footer a:hover{color:#fff}
@media(max-width:800px){
  #cd-root .grid-2{grid-template-columns:1fr}
  #cd-root .producto-cuerpo{grid-template-columns:1fr}
  #cd-root section{padding:44px 0}
}
`;

// Mockup de la interfaz de RAPIQO (mismo del home, tamaño mayor).
function MockupRapiqo() {
  return (
    <svg
      className="mockup"
      viewBox="0 0 360 240"
      role="img"
      aria-label="Mockup de la interfaz de RAPIQO, aplicación web"
      style={{ display: "block", width: "100%", height: "auto" }}
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

// Alcance definido del producto RAPIQO (brief): sin inventar
// funcionalidades — solo lo que la línea contempla hoy.
const ALCANCE_RAPIQO = [
  "Procesamiento de documentos PDF, Office, HTML y tablas",
  "Conversión entre formatos de documento",
  "Edición y gestión centralizada de archivos",
  "Aplicación web: procesamiento en tu navegador, sin subir documentos",
];

export default function CumbreDocsSite() {
  return (
    <main id="cd-root" className="min-h-dvh w-full">
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
          <span className="kicker">CumbreDocs · Línea Documentos &amp; Productividad</span>
          <h1>Documentos, más simples.</h1>
          <p>
            CumbreDocs es el ecosistema de CumbreGeo para trabajar con documentos: herramientas propias en la web,
            pensadas para procesar, convertir y organizar archivos sin fricción.
          </p>
        </div>
      </div>

      {/* Presentación + propósito + filosofía */}
      <section id="linea">
        <div className="contenedor">
          <span className="seccion-kicker">La línea</span>
          <h2 className="seccion-titulo">Un ecosistema documental propio</h2>
          <p className="seccion-sub">
            CumbreDocs agrupa las herramientas de CumbreGeo dedicadas a documentos y productividad. Nace de una
            necesidad real: trabajar con PDF, Office, HTML y tablas sin depender de servicios en línea, con la
            privacidad y autonomía que caracterizan a todos los productos de CumbreGeo.
          </p>
          <div className="grid-2">
            <div className="tarjeta">
              <h3>Propósito</h3>
              <p>
                Simplificar el trabajo cotidiano con documentos: procesar, convertir, editar y gestionar archivos en
                una sola herramienta web, sin subir documentos a ningún servidor — el procesamiento corre en tu
                navegador.
              </p>
            </div>
            <div className="tarjeta">
              <h3>Filosofía de desarrollo</h3>
              <p>
                La misma del estudio: productos funcionales que resuelven problemas concretos, con desarrollo continuo,
                sin publicidad y con tus documentos siempre dentro de tu navegador.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Productos: RAPIQO destacado (brief §4.C) */}
      <section id="rapiqo" style={{ background: "var(--piedra)" }}>
        <div className="contenedor">
          <span className="seccion-kicker">Productos disponibles y futuros</span>
          <h2 className="seccion-titulo">El primer producto: RAPIQO</h2>
          <p className="seccion-sub">
            RAPIQO es el primer producto de CumbreDocs y define el rumbo de la línea. La línea seguirá creciendo con
            nuevas herramientas documentales — aquí se anunciarán cuando estén en camino.
          </p>
          <div className="producto">
            <div className="producto-head">
              <span className="icono">
                <FileText style={{ width: 20, height: 20 }} aria-hidden />
              </span>
              <div>
                <h3>DOCUMENTOS &amp; PRODUCTIVIDAD · CUMBREDOCS</h3>
              </div>
            </div>
            <div className="producto-cuerpo">
              <div style={{ border: "1px solid var(--borde)", borderRadius: 12, background: "var(--blanco)", padding: 10 }}>
                <MockupRapiqo />
                <p style={{ margin: "8px 0 0", fontSize: ".78rem", color: "var(--gris)", textAlign: "center" }}>
                  Interfaz de RAPIQO 2.9.1 · en línea en rapiqo.cumbregeo.cl
                </p>
              </div>
              <div>
                <h4 className="nombre">
                  RAPIQO
                  <span className="estado disponible">Disponible · beta web</span>
                </h4>
                <p style={{ color: "#42514b", fontSize: ".95rem", margin: "8px 0 0" }}>
                  Una herramienta web para procesar, convertir y trabajar con documentos PDF, Office y otros
                  formatos.
                </p>
                <ul className="dots">
                  {ALCANCE_RAPIQO.map((c) => (
                    <li key={c}>
                      <CheckCircle2 style={{ width: 15, height: 15 }} aria-hidden /> {c}
                    </li>
                  ))}
                </ul>
                <p style={{ margin: "0 0 16px", fontSize: ".88rem", color: "var(--gris)" }}>
                  La versión web ya está disponible en <b>rapiqo.cumbregeo.cl</b> — funciona en el navegador, sin
                  instalar nada. La licencia PRO (pago único, $14.990 CLP) se compra por MercadoPago y la clave llega
                  por correo; se activa offline en Ajustes → Licencia.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="btn btn-acento" href="https://rapiqo.cumbregeo.cl" target="_blank" rel="noreferrer">
                    Abrir RAPIQO ↗
                  </a>
                  <a className="btn btn-secundario" href="https://mpago.la/2wvHvUS" target="_blank" rel="noreferrer">
                    Licencia PRO · MercadoPago
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section id="contacto-linea">
        <div className="contenedor" style={{ textAlign: "center" }}>
          <h2 className="seccion-titulo">¿Consulta sobre CumbreDocs o RAPIQO?</h2>
          <p className="seccion-sub" style={{ margin: "0 auto 1.4rem" }}>
            Usa el formulario de contacto del sitio o escríbenos directo: respondemos consultas comerciales y de
            soporte.
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
