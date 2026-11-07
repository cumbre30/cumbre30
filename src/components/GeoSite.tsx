"use client";

// ============================================================
// /geo — Sitio público de Cumbre GEO (marca, apps, planes).
// Página aprobada con el cliente (prototipo → implementación):
//   · Qué hacemos / Cómo lo hacemos (4 pilares)
//   · Carrusel de aplicaciones generado desde appsCatalog.ts
//   · "Ver detalles" → MODAL con capturas de Play Store,
//     descripción breve, acordeón de detalle completo y botón
//     APK (deshabilitado hasta que se publique).
//   · "Ver planes" → /pro (contenido actual, tal cual) con
//     ?from=geo para que /pro muestre un botón flotante de regreso.
// Paleta de marca Cumbre GEO (la misma de /pro, del manual):
//   espresso #241A11 · crema #F2EAD9 · verde #35B85F · cobre #8A6A4F
// ============================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Lock,
  Mail,
  Map as MapIcon,
  Navigation,
  WifiOff,
  X,
} from "lucide-react";
import { APPS, type AppCatalogo } from "@/lib/appsCatalog";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/lib/proConfig";

const C = {
  bg: "#241A11",
  cream: "#F2EAD9",
  creamDim: "rgba(242, 234, 217, 0.66)",
  green: "#35B85F",
  greenInk: "#0E2214",
  copper: "#8A6A4F",
  card: "rgba(242, 234, 217, 0.06)",
  cardHover: "rgba(242, 234, 217, 0.1)",
  line: "rgba(242, 234, 217, 0.14)",
};

const CHIPS = ["100% offline", "Sin publicidad", "Motor GPS propio", "Cartografía open source"];

const PILARES = [
  {
    icono: Navigation,
    titulo: "Motor GPS propio",
    cuerpo: "Registro y corrección de posición directamente en el dispositivo, sin depender de servicios de terceros.",
  },
  {
    icono: MapIcon,
    titulo: "Cartografía open source",
    cuerpo: "Mapas basados en fuentes abiertas, empaquetados para usarse sin conexión.",
  },
  {
    icono: WifiOff,
    titulo: "100% offline",
    cuerpo: "Mapas, rutas y registro funcionan sin datos móviles.",
  },
  {
    icono: Ban,
    titulo: "Sin publicidad",
    cuerpo: "Cero anuncios y cero rastreo innecesario.",
  },
];

export default function GeoSite() {
  const router = useRouter();
  const [appId, setAppId] = useState<string | null>(null);
  const carruselRef = useRef<HTMLDivElement>(null);
  const app = appId ? APPS.find((a) => a.id === appId) ?? null : null;

  // Esc cierra el modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAppId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Bloquea el scroll de fondo mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = appId ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [appId]);

  const moverCarrusel = (dir: number) => {
    const el = carruselRef.current;
    if (!el) return;
    const tarjeta = el.querySelector<HTMLElement>("[data-tarjeta]");
    const ancho = tarjeta ? tarjeta.offsetWidth + 20 : 300;
    el.scrollBy({ left: dir * ancho, behavior: "smooth" });
  };

  const irAPlanes = (a: AppCatalogo) => {
    if (!a.planes.publicado || !a.planes.url) return;
    setAppId(null);
    router.push(`${a.planes.url}?from=geo`);
  };

  return (
    <main className="min-h-dvh w-full" style={{ background: C.bg, color: C.cream }}>
      {/* ═══ Marca (idéntica a /pro) ═══ */}
      <div className="pt-10 text-center">
        <p className="text-[15px] font-black tracking-[0.35em]">
          CUMBRE<span className="font-light">GEO</span>
        </p>
        <p className="mt-1 text-[9.5px] font-semibold tracking-[0.45em]" style={{ color: C.copper }}>
          TECNOLOGÍA PARA DESCUBRIR
        </p>
      </div>

      {/* ═══ Hero ═══ */}
      <section className="mx-auto w-full max-w-3xl px-5 pb-14 pt-14 text-center">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Aplicaciones 100% offline
          <br />
          <span style={{ color: C.green }}>para el aire libre</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed" style={{ color: C.creamDim }}>
          Desarrollamos herramientas que funcionan donde no llega la señal: en la montaña, en el bosque, en la ruta.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {CHIPS.map((chip) => (
            <span
              key={chip}
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold"
              style={{ background: C.card, border: `1px solid ${C.line}`, color: C.cream }}
            >
              {chip}
            </span>
          ))}
        </div>
        <a
          href="#aplicaciones"
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[14px] font-bold transition-opacity hover:opacity-90"
          style={{ background: C.green, color: C.greenInk }}
        >
          Ver aplicaciones <ChevronDown className="h-4 w-4" />
        </a>
      </section>

      {/* ═══ Qué hacemos ═══ */}
      <section className="mx-auto w-full max-w-3xl px-5 pb-16">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
          Qué hacemos
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Tecnología que no depende de la conexión</h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed" style={{ color: C.creamDim }}>
          <b style={{ color: C.cream }}>Cumbre GEO</b> desarrolla aplicaciones 100% offline para actividades al aire
          libre. Sin publicidad, sin dependencia de la conexión: todo funciona en tu dispositivo, incluso sin señal.
        </p>
      </section>

      {/* ═══ Cómo lo hacemos ═══ */}
      <section className="mx-auto w-full max-w-3xl px-5 pb-16">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
          Cómo lo hacemos
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Nuestro enfoque</h2>
        <p className="mt-2 max-w-2xl text-[14px]" style={{ color: C.creamDim }}>
          Cuatro principios guían cada aplicación que desarrollamos.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PILARES.map((p) => (
            <div
              key={p.titulo}
              className="rounded-2xl p-5 transition-colors hover:bg-[rgba(242,234,217,0.1)]"
              style={{ background: C.card, border: `1px solid ${C.line}` }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: C.green }}
              >
                <p.icono className="h-5 w-5" style={{ color: C.greenInk }} aria-hidden />
              </span>
              <h3 className="mt-3 text-[15px] font-bold">{p.titulo}</h3>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: C.creamDim }}>
                {p.cuerpo}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Nuestras aplicaciones (carrusel) ═══ */}
      <section id="aplicaciones" className="mx-auto w-full max-w-3xl scroll-mt-6 px-5 pb-20">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
          Nuestras aplicaciones
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Explora lo que hacemos</h2>
        <p className="mt-2 max-w-2xl text-[14px]" style={{ color: C.creamDim }}>
          Cada app mantiene el mismo espíritu: offline, sin publicidad y con datos que quedan en tu dispositivo.
        </p>

        <div className="relative mt-6">
          {/* Flechas (desktop) */}
          <button
            onClick={() => moverCarrusel(-1)}
            aria-label="Aplicación anterior"
            className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
            style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.cream }}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            onClick={() => moverCarrusel(1)}
            aria-label="Aplicación siguiente"
            className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
            style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.cream }}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          <div
            ref={carruselRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3"
            style={{ scrollbarWidth: "thin" }}
          >
            {APPS.map((a) => (
              <article
                key={a.id}
                data-tarjeta
                className="flex w-[270px] shrink-0 snap-start flex-col items-center gap-3 rounded-2xl p-6 text-center"
                style={{ background: C.card, border: `1px solid ${C.line}` }}
              >
                {a.disponible ? (
                  <img src={a.icono} alt={`Ícono de ${a.nombre}`} className="h-20 w-20 rounded-3xl" />
                ) : (
                  <span
                    className="flex h-20 w-20 items-center justify-center rounded-3xl"
                    style={{ border: `1.5px dashed ${C.copper}`, color: C.copper }}
                  >
                    <Compass className="h-8 w-8" aria-hidden />
                  </span>
                )}
                <h3 className="text-[16px] font-bold">
                  {a.nombre}{" "}
                  {!a.disponible && (
                    <span
                      className="ml-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{ background: "rgba(138,106,79,0.18)", border: `1px solid ${C.copper}`, color: C.copper }}
                    >
                      Próximamente
                    </span>
                  )}
                </h3>
                <p className="flex-1 text-[12.5px] leading-relaxed" style={{ color: C.creamDim }}>
                  {a.tagline}
                </p>
                {a.disponible ? (
                  <div className="mt-1 flex w-full flex-col gap-2">
                    <button
                      onClick={() => setAppId(a.id)}
                      className="h-11 w-full rounded-xl text-[13.5px] font-bold transition-colors hover:bg-[rgba(53,184,95,0.12)]"
                      style={{ border: `1.5px solid ${C.green}`, color: C.green }}
                    >
                      Ver detalles
                    </button>
                    {a.planes.publicado && (
                      <button
                        onClick={() => irAPlanes(a)}
                        className="h-11 w-full rounded-xl text-[13.5px] font-bold transition-opacity hover:opacity-90"
                        style={{ background: C.green, color: C.greenInk }}
                      >
                        Ver planes
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    disabled
                    className="mt-1 h-11 w-full rounded-xl text-[13.5px] font-bold"
                    style={{ background: C.card, border: `1px solid ${C.line}`, color: C.copper, opacity: 0.6 }}
                  >
                    Muy pronto
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t px-5 py-8 text-center" style={{ borderColor: C.line }}>
        <p className="text-[11px] leading-relaxed" style={{ color: C.creamDim }}>
          Cumbre GEO · Tecnología para descubrir · Hecho en Chile
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px]" style={{ color: C.creamDim }}>
          <Mail className="h-3.5 w-3.5" aria-hidden />
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.green }}>
            {CONTACT_EMAIL}
          </a>
          <span aria-hidden>·</span>
          <a
            href={`https://wa.me/${CONTACT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.green }}
          >
            WhatsApp
          </a>
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11.5px]" style={{ color: C.creamDim }}>
          <Link href="/privacidad" className="underline" style={{ color: C.copper }}>
            Privacidad
          </Link>
          <Link href="/eliminar-cuenta" className="underline" style={{ color: C.copper }}>
            Eliminar cuenta
          </Link>
          <Link href="/pro" className="underline" style={{ color: C.copper }}>
            Cumbre30 Pro
          </Link>
        </p>
      </footer>

      {/* ═══ Modal: detalle de la app ═══ */}
      {app && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-6"
          style={{ background: "rgba(14,12,9,0.72)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAppId(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalles de ${app.nombre}`}
        >
          <div
            className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl"
            style={{ background: C.bg, border: `1px solid ${C.line}`, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
          >
            {/* Cabecera */}
            <div className="relative flex items-center gap-4 p-6" style={{ borderBottom: `1px solid ${C.line}` }}>
              <img src={app.icono} alt={`Ícono de ${app.nombre}`} className="h-16 w-16 rounded-2xl" />
              <div className="min-w-0">
                <h3 className="text-xl font-extrabold tracking-tight">{app.nombre}</h3>
                <p className="mt-0.5 text-[11.5px]" style={{ color: C.copper }}>
                  Versión {app.version} · build {app.versionCode}
                </p>
              </div>
              <button
                onClick={() => setAppId(null)}
                aria-label="Cerrar detalles"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: C.card, border: `1px solid ${C.line}`, color: C.cream }}
              >
                <X className="h-4.5 w-4.5" aria-hidden />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="max-h-[62dvh] overflow-y-auto p-6">
              {/* APK (aún no disponible) */}
              {app.apk.disponible ? (
                <a
                  href={app.apk.url ?? "#"}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold transition-opacity hover:opacity-90"
                  style={{ background: C.green, color: C.greenInk }}
                >
                  <Download className="h-5 w-5" aria-hidden /> Descargar APK
                </a>
              ) : (
                <>
                  <button
                    disabled
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold"
                    style={{ background: C.green, color: C.greenInk, opacity: 0.45, cursor: "not-allowed" }}
                  >
                    <Lock className="h-4.5 w-4.5" aria-hidden /> Descargar APK
                  </button>
                  <p className="mt-2 text-center text-[11px]" style={{ color: C.copper }}>
                    {app.apk.nota}
                  </p>
                </>
              )}

              {/* Capturas (las mismas de Play Store) */}
              <div className="mt-5 flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                {app.imagenes.map((img) => (
                  <img
                    key={img.src}
                    src={img.src}
                    alt={img.alt}
                    className="h-80 w-auto shrink-0 snap-center rounded-xl"
                    style={{ border: `1px solid ${C.line}` }}
                  />
                ))}
              </div>

              {/* Descripción breve */}
              <h4 className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
                Descripción
              </h4>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: C.creamDim }}>
                {app.descripcionBreve}
              </p>

              {/* Detalle completo (desplegable) */}
              <h4 className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: C.copper }}>
                Detalle completo
              </h4>
              <div className="mt-2 space-y-2.5">
                {app.detalleCompleto.map((s, i) => (
                  <details
                    key={s.titulo}
                    open={i === 0}
                    className="group overflow-hidden rounded-xl"
                    style={{ background: C.card, border: `1px solid ${C.line}` }}
                  >
                    <summary
                      className="flex cursor-pointer list-none items-center justify-between p-4 text-[13.5px] font-bold"
                      style={{ color: C.cream }}
                    >
                      {s.titulo}
                      <ChevronDown
                        className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                        style={{ color: C.copper }}
                        aria-hidden
                      />
                    </summary>
                    <p className="whitespace-pre-line px-4 pb-4 text-[12.5px] leading-relaxed" style={{ color: C.creamDim }}>
                      {s.cuerpo}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            {/* Pie del modal */}
            <div className="flex items-center justify-end gap-3 p-5" style={{ borderTop: `1px solid ${C.line}` }}>
              <button
                onClick={() => setAppId(null)}
                className="rounded-xl px-4 py-2.5 text-[13px] font-bold"
                style={{ background: C.card, border: `1px solid ${C.line}`, color: C.cream }}
              >
                Volver al home
              </button>
              {app.planes.publicado && (
                <button
                  onClick={() => irAPlanes(app)}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90"
                  style={{ background: C.green, color: C.greenInk }}
                >
                  Ver planes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
