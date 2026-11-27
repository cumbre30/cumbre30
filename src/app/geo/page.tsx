import type { Metadata } from "next";
import GeoSite from "@/components/GeoSite";

// ============================================================
// /geo - Portada corporativa de CumbreGeo (v1.29.0, brief cumbregeo.cl).
// CumbreGeo como marca matriz: líneas Outdoor & Geospatial y
// Documentos & Productividad (CumbreDocs → RAPIQO). Vistas internas:
// home ⇄ planes. ?vista=planes abre directo la vista de planes y
// ?app=<id> selecciona la app de los planes (lo usan los redirects
// nombrados por app: /cumbre30pro y el alias heredado /pro).
// ============================================================

export const metadata: Metadata = {
  // SEO de la portada (brief §8): posiciona a CumbreGeo como
  // desarrollador de soluciones tecnológicas — sin competir con las
  // palabras clave de cada producto (esas viven en su página).
  title: "CumbreGeo | Desarrollo de aplicaciones y soluciones digitales",
  description:
    "Descubre CumbreGeo, un ecosistema de aplicaciones y herramientas digitales propias para navegación, ciclismo, documentos y productividad.",
  alternates: { canonical: "/geo" },
  openGraph: {
    title: "CumbreGeo | Desarrollo de aplicaciones y soluciones digitales",
    description:
      "Ecosistema de aplicaciones y herramientas digitales propias para navegación, ciclismo, documentos y productividad. Líneas Outdoor & Geospatial y CumbreDocs.",
    url: "/geo",
    siteName: "CumbreGeo",
    images: [{ url: "/og-cumbregeo.jpg", width: 1200, height: 630, alt: "CumbreGeo · Tecnología que conecta ideas con soluciones" }],
    locale: "es_CL",
    type: "website",
  },
};

export default async function GeoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; app?: string }>;
}) {
  // El botón "Descargar APK" vive en el catálogo (appsCatalog.ts → apk):
  // hoy apunta directo al archivo en Google Drive. La prop apkActivo queda
  // como vía alternativa para el flujo /api/apk + APK_DOWNLOAD_URL
  // (GitHub Releases, DEPLOY.md · paso 6) sin tocar el componente.
  const apkActivo = Boolean(process.env.APK_DOWNLOAD_URL);
  // En el export estático (APK) no hay servidor: searchParams no se puede
  // esperar. GeoSite lee ?vista y ?app en el cliente al montar, así que
  // aquí solo se pasan como props cuando hay servidor (web/Vercel).
  if (process.env.STATIC_EXPORT === "1") {
    return <GeoSite apkActivo={apkActivo} />;
  }
  const { vista, app } = await searchParams;
  return (
    <GeoSite
      apkActivo={apkActivo}
      vistaInicial={vista === "planes" ? "planes" : "home"}
      appInicial={app}
    />
  );
}
