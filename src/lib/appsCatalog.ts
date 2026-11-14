// ============================================================
// Catálogo de aplicaciones de Cumbre GEO - fuente única del sitio
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
import { CONTACT_EMAIL } from "@/lib/proConfig";

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
  /** Ruta nombrada de los planes de la app (entry point externo).
   *  El botón "Ver planes" cambia de vista internamente sin recargar;
   *  la URL queda como referencia y para enlaces salientes. */
  planes: { publicado: boolean; url: string | null };
  /**
   * Accesos exclusivos de esta app (soporte y privacidad): se muestran
   * al final de su modal de detalle, con el mismo diseño del sitio.
   * Requeridos por Play Store por app; null en apps que aún no los tienen.
   * NO van en el footer del sitio: ahí solo vive la marca Cumbre GEO.
   */
  enlaces?: {
    contacto: string;
    privacidad: string;
    /** Términos y condiciones de uso (opcional: se muestra solo si existe). */
    terminos?: string;
    eliminarCuenta: string;
  } | null;
};

export const APPS: AppCatalogo[] = [
  {
    id: "cumbre30",
    nombre: "Cumbre30",
    icono: "/icons/icon-512.png",
    disponible: true,
    tagline: "Ciclocomputador de apoyo al ciclista: GPS, límite 30 km/h y alertas.",
    descripcionBreve:
      "Cumbre30 es un ciclocomputador de apoyo al ciclista: registra tus pedaleos con GPS y te acompaña con avisos informativos del Parque Metropolitano de Santiago, como el límite de 30 km/h. Todo funciona sin señal: descarga la app y pedalea con GPS aunque no tengas datos móviles.",
    imagenes: [
      { src: "/apps/cumbre30/01-ride.jpg", alt: "Pantalla Ride del ciclocomputador Cumbre30: velocidad, mapa en vivo, botón SOS y estadísticas del ride" },
      { src: "/apps/cumbre30/02-mapa.jpg", alt: "Mapa de Cumbre30 con búsqueda de direcciones y capas de rutas, senderos, accesos y puntos de interés" },
      { src: "/apps/cumbre30/03-perfil.jpg", alt: "Perfil de Cumbre30 con inicio de sesión y creación de cuenta para guardar tus rides y logros" },
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
          "• Android 7.0 o superior.\n• No requiere datos móviles en el cerro: mapas, rutas, GPS y alertas funcionan 100% offline.\n• Tamaño de descarga aproximado: 61 MB.",
      },
      {
        titulo: "Permisos que usa y para qué",
        cuerpo:
          "• Ubicación (precisa): se usa mientras pedaleas, con servicio en primer plano y notificación visible; no se usa en segundo plano.\n• Notificaciones: para la notificación del ride activo y avisos de la app.\n• Vibración: para las alertas cuando te acercas al límite de 30 km/h.\n• Evitar que el teléfono duerma: mantiene el registro del ride mientras lo usas.\n• Tus rides viven en tu teléfono; no se comparten con terceros.",
      },
      {
        titulo: "Novedades de esta versión",
        // Sólo la última versión + build (salen de appVersion.ts, quedan
        // sincronizados solos) + lista de funcionalidades del release
        // vigente (Ola 2 y 3 del roadmap 2026-11-14).
        cuerpo:
          `v${APP_VERSION} (${APP_VERSION_CODE}):\n` +
          "• Corregido el error al tocar el banner de clima (ya puedes ver viento, calidad del aire e índice UV sin que se cierre la app).\n" +
          "• Control de Spotify en la pantalla ride, al lado del ahorro de batería: pausa, play, siguiente y anterior sin salir de tus métricas (Spotify Connect; requiere Spotify Premium y una vez pegar tu Client ID — el panel te guía).\n" +
          "• Configuración reorganizada por secciones: General (Seguridad, Monitoreo y salud, Personalización) y Acerca de.\n" +
          "• Nuevo control «Confirmación de estado»: cuánto espera el «¿Estás bien?» antes de avisar a tus contactos (15/30/60 s).\n" +
          "• Verificar constancias desde la web: enlace directo bajo el botón de descarga del APK.\n" +
          "• Ranking entre amigos: medallas por km totales y enlace de invitación para conectarte.\n" +
          "• Enlace público del ride desde Historial: comparte tus estadísticas sin exponer tu GPS.\n" +
          "• Tus rides en la web: cumbregeo.cl/rides con tu cuenta, desde cualquier navegador.\n" +
          "• Avisos push del parque en la web (luces, cierres): Configuración → Avisos del parque (web).\n",
      },
    ],
    // APK directo: ACTIVO - descarga vía /api/apk, que redirige al APK de la
    // versión vigente en GitHub Releases (repo cumbre30/cumbre30). Cada tag
    // v* que se publica dispara el workflow build-apk.yml, que construye el
    // APK y crea el Release con dos assets: cumbre30-vX.Y.Z-codeN.apk y
    // cumbre30-latest.apk — el botón siempre sirve la última versión sin
    // tocar código. (Historia: antes apuntaba a Google Drive v1.8.7 code 33.)
    apk: {
      disponible: true,
      url: "/api/apk",
      nota: "",
    },
    planes: { publicado: true, url: "/cumbre30pro" },
    // Play exige estos accesos por app; viven al final del modal de
    // detalle de Cumbre30 (no en el footer del sitio).
    enlaces: {
      contacto: `mailto:${CONTACT_EMAIL}`,
      // Rutas por app (/geo/cumbre30/...) para diferenciar la información
      // entre apps de Cumbre GEO. La raíz (/privacidad, etc.) redirige a
      // estas en la web y sigue existiendo dentro del export del APK.
      privacidad: "/geo/cumbre30/privacidad",
      terminos: "/geo/cumbre30/terminos",
      eliminarCuenta: "/geo/cumbre30/eliminar-cuenta",
    },
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
    enlaces: null,
  },
];

/** Busca una app del catálogo por id. */
export function getApp(id: string): AppCatalogo | undefined {
  return APPS.find((a) => a.id === id);
}
