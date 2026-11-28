// ============================================================
// /geo/cumbredocs (v1.29.0): página de la línea DOCUMENTOS &
// PRODUCTIVIDAD. Presenta el ecosistema CumbreDocs y destaca
// RAPIQO como su primer producto.
//   · Solo funcionalidades y alcance definidos por el producto:
//     nada de features inventadas ni integraciones prometidas.
//   · Estado real: versión web 2.9.0 en línea (rapiqo.cumbregeo.cl);
//     licencia PRO por MercadoPago con entrega de clave por correo.
//   · Estética: misma paleta corporativa del sitio (#geo-root),
//     acotada a #cd-root para no filtrarse al resto del sitio.
// ============================================================
import type { Metadata } from "next";
import CumbreDocsSite from "@/components/CumbreDocsSite";

export const metadata: Metadata = {
  // SEO propio de la línea: no compite con Cumbre30 ni con la
  // portada de CumbreGeo — se centra en documentos y productividad.
  title: "CumbreDocs · Documentos y productividad | CumbreGeo",
  description:
    "CumbreDocs es la línea de documentos y productividad de CumbreGeo: herramientas propias para trabajar con PDF, Office, HTML y tablas de forma simple. Su primer producto es RAPIQO, ya disponible como web en rapiqo.cumbregeo.cl.",
  alternates: { canonical: "/geo/cumbredocs" },
  openGraph: {
    title: "CumbreDocs · Documentos y productividad | CumbreGeo",
    description:
      "La línea de documentos y productividad de CumbreGeo. RAPIQO, su primer producto: procesa, convierte y trabaja con documentos PDF, Office y otros formatos. Ya disponible en rapiqo.cumbregeo.cl.",
    url: "/geo/cumbredocs",
    siteName: "CumbreGeo",
    images: [{ url: "/og-cumbregeo.jpg", width: 1200, height: 630, alt: "CumbreDocs por CumbreGeo" }],
    locale: "es_CL",
    type: "website",
  },
};

export default function CumbreDocsPage() {
  return <CumbreDocsSite />;
}
