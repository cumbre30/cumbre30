// ============================================================
// Catálogo de aplicaciones de Cumbre GEO — fuente única del sitio
// público (/geo). Agregar una app nueva = agregar un objeto a APPS:
// el carrusel, el modal de detalle y el acceso a planes se generan
// solos desde esta estructura.
//
// Fuentes de los datos reales:
//   · Versión:        src/lib/appVersion.ts (fuente única de la app)
//   · Textos:         download/play-store/ficha-play-store.md
//   · Capturas:       public/apps/cumbre30/ (las mismas de Play Store)
//   · Plan Pro:       /pro (página de venta existente, sin cambios)
// ============================================================

import { APP_VERSION, APP_VERSION_CODE } from "@/lib/appVersion";

export type SeccionDetalle = { titulo: string; cuerpo: string };

export type ImagenApp = { src: string; alt: string };

export type AppCatalogo = {
  id: string;
  nombre: string;
  /** Ruta pública del ícono (vacío en apps aún no lanzadas). */
  icono: string;
  /** false → tarjeta "Próximamente" sin botones. */
  disponible: boolean;
  tagline: string;
  descripcionBreve: string;
  imagenes: ImagenApp[];
  /** null en apps sin versión pública aún. */
  version: string | null;
  versionCode: number | null;
  detalleCompleto: SeccionDetalle[];
  /** Botón de descarga APK: false → deshabilitado con nota. */
  apk: { disponible: boolean; url: string | null; nota: string };
  /** "Ver planes" apunta a la página existente de la app. */
  planes: { publicado: boolean; url: string | null };
};

export const APPS: AppCatalogo[] = [
  {
    id: "cumbre30",
    nombre: "Cumbre30",
    icono: "/icons/icon-512.png",
    disponible: true,
    tagline: "Ciclocomputador del cerro San Cristóbal: límite 30 km/h, GPS y alertas.",
    descripcionBreve:
      "Cumbre30 es el ciclocomputador pensado para pedalear el Cerro San Cristóbal del Parque Metropolitano de Santiago, respetando el límite de 30 km/h. Todo funciona sin señal: descarga la app y pedalea con GPS aunque no tengas datos móviles en el cerro.",
    imagenes: [
      { src: "/apps/cumbre30/01-ride-mapa.png", alt: "Ciclocomputador de Cumbre30 con mapa y velocidad en el cerro" },
      { src: "/apps/cumbre30/02-explorar.png", alt: "Explorar destinos y rutas del Parque Metropolitano" },
      { src: "/apps/cumbre30/03-desafios.png", alt: "Desafíos y recompensas de Cumbre30" },
      { src: "/apps/cumbre30/04-perfil.png", alt: "Perfil del ciclista con credencial digital" },
    ],
    version: APP_VERSION,
    versionCode: APP_VERSION_CODE,
    detalleCompleto: [
      {
        titulo: "Funciones principales",
        cuerpo:
          "• Ciclocomputador completo: velocidad actual y máxima, distancia, tiempo, desnivel acumulado y mapa en tiempo real.\n• Límite 30 km/h con alertas de voz, pitidos y vibración dentro del parque.\n• Rutas y navegación hacia Plaza México, Pío Nono, Pedro de Valdivia, La Pirámide, Piscina Antilén, Jardín Japonés y más.\n• Desafíos por nivel (diarios, semanales y mensuales) con pines exclusivos para tu perfil.\n• Credencial digital de enrolamiento Parquemet con código QR.\n• Historial de rides con trazado GPS, exportación en GPX y resumen para compartir.\n• Detección de viaje en vehículo motorizado para que tus estadísticas reflejen solo tus pedaleos.",
      },
      {
        titulo: "Requisitos y compatibilidad",
        cuerpo:
          "• Android 7.0 o superior.\n• No requiere datos móviles en el cerro: mapas, rutas, GPS y alertas funcionan 100% offline.\n• Tamaño de descarga aproximado: 54 MB.",
      },
      {
        titulo: "Permisos que usa y para qué",
        cuerpo:
          "• Ubicación (precisa): se usa mientras pedaleas, con servicio en primer plano y notificación visible; no se usa en segundo plano.\n• Notificaciones: para la notificación del ride activo y avisos de la app.\n• Vibración: para las alertas cuando te acercas al límite de 30 km/h.\n• Evitar que el teléfono duerma: mantiene el registro del ride mientras lo usas.\n• Tus rides viven en tu teléfono; no se comparten con terceros.",
      },
      {
        titulo: "Novedades de esta versión",
        cuerpo:
          "v1.8.2 (versionCode 27):\n• Nueva marca: Cumbre GEO — sitio oficial cumbregeo.cl\n• Compra Pro con entrega automática: tu código llega solo al correo tras pagar\n• Mejoras de estabilidad",
      },
    ],
    // APK directo: deshabilitado por defecto. Se activa de dos formas:
    //   1. Automática: define APK_DOWNLOAD_URL (URL del asset en GitHub
    //      Releases, DEPLOY.md paso 6) → /api/apk redirige ahí y el botón
    //      del modal se habilita solo.
    //   2. Manual: apk.disponible = true (sirve el archivo local; solo
    //      funciona en despliegue Node, no en Vercel serverless).
    apk: { disponible: false, url: "/api/apk", nota: "Disponible próximamente" },
    planes: { publicado: true, url: "/pro" },
  },
  {
    id: "proxima-app",
    nombre: "Próxima app",
    icono: "",
    disponible: false,
    tagline: "Estamos preparando la siguiente aplicación de Cumbre GEO.",
    descripcionBreve: "",
    imagenes: [],
    version: null,
    versionCode: null,
    detalleCompleto: [],
    apk: { disponible: false, url: null, nota: "" },
    planes: { publicado: false, url: null },
  },
];

/** Busca una app del catálogo por id. */
export function getApp(id: string): AppCatalogo | undefined {
  return APPS.find((a) => a.id === id);
}
