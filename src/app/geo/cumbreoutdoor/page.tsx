// ============================================================
// /geo/cumbreoutdoor (v1.29.5): página de la línea OUTDOOR &
// GEOSPATIAL. Espejo de /geo/cumbredocs: presenta el ecosistema
// CumbreOutdoor y destaca Cumbre30 como su primer producto.
//   · Solo funcionalidades y alcance definidos por el producto:
//     nada de features inventadas ni integraciones prometidas.
//   · Estado real: Cumbre30 v1.28.4 disponible (demo web, APK y
//     planes Pro); la línea seguirá creciendo.
//   · Estética: misma paleta corporativa del sitio (#geo-root),
//     acotada a #co-root para no filtrarse al resto del sitio.
// ============================================================
import type { Metadata } from "next";
import CumbreOutdoorSite from "@/components/CumbreOutdoorSite";

export const metadata: Metadata = {
  // SEO propio de la línea: no compite con CumbreDocs ni con la
  // portada de CumbreGeo — se centra en outdoor y geoespacial.
  title: "CumbreOutdoor · Outdoor y geoespacial | CumbreGeo",
  description:
    "CumbreOutdoor es la línea outdoor y geoespacial de CumbreGeo: aplicaciones propias para explorar, navegar y conectar con el entorno. Su primer producto es Cumbre30, ciclocomputador digital con mapas offline, ya disponible.",
  alternates: { canonical: "/geo/cumbreoutdoor" },
  openGraph: {
    title: "CumbreOutdoor · Outdoor y geoespacial | CumbreGeo",
    description:
      "La línea outdoor y geoespacial de CumbreGeo. Cumbre30, su primer producto: registro de rides con GPS y mapas 100% offline, constancias verificables y Plan Pro de pago único. Ya disponible.",
    url: "/geo/cumbreoutdoor",
    siteName: "CumbreGeo",
    images: [{ url: "/og-cumbregeo.jpg", width: 1200, height: 630, alt: "CumbreOutdoor por CumbreGeo" }],
    locale: "es_CL",
    type: "website",
  },
};

export default function CumbreOutdoorPage() {
  return <CumbreOutdoorSite />;
}
