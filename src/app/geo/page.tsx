import type { Metadata } from "next";
import GeoSite from "@/components/GeoSite";

// ============================================================
// /geo — Sitio público de Cumbre GEO (diseño del prototipo aprobado).
// Vistas internas: home ⇄ planes. ?vista=planes abre directo la
// vista de planes y ?app=<id> selecciona la app de los planes
// (lo usan los redirects nombrados por app: /cumbre30pro y el
// alias heredado /pro, para mantener vivos los enlaces antiguos).
// ============================================================

export const metadata: Metadata = {
  title: "Cumbre GEO — Aplicaciones 100% offline para el aire libre",
  description:
    "Qué hacemos y cómo lo hacemos: aplicaciones 100% offline, sin publicidad, con motor GPS propio y cartografía open source. Conoce Cumbre30, sus detalles y sus planes.",
};

export default async function GeoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; app?: string }>;
}) {
  const { vista, app } = await searchParams;
  // El botón "Descargar APK" vive en el catálogo (appsCatalog.ts → apk):
  // hoy apunta directo al archivo en Google Drive. La prop apkActivo queda
  // como vía alternativa para el flujo /api/apk + APK_DOWNLOAD_URL
  // (GitHub Releases, DEPLOY.md · paso 6) sin tocar el componente.
  const apkActivo = Boolean(process.env.APK_DOWNLOAD_URL);
  return (
    <GeoSite
      apkActivo={apkActivo}
      vistaInicial={vista === "planes" ? "planes" : "home"}
      appInicial={app}
    />
  );
}
