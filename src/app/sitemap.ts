import type { MetadataRoute } from "next";

// Sitemap del sitio público (v1.29.0): portada corporativa, línea
// CumbreDocs y páginas legales de Cumbre30 que exige Play Store.
// Las rutas de la app (/demo, /verificar, /compartir, /rides) no se
// indexan: son herramientas de la aplicación, no contenido público.
const BASE = "https://cumbregeo.cl";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/geo`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/geo/cumbredocs`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/geo?vista=planes&app=cumbre30`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/geo/cumbre30/privacidad`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/geo/cumbre30/terminos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/geo/cumbre30/eliminar-cuenta`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
