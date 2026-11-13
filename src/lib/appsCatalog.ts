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
        // sincronizados solos) + lista de funcionalidades definida por el
        // cliente. Nota: la línea del banner de horario venía duplicada en
        // el texto original y se dejó una sola vez.
        cuerpo:
          `v${APP_VERSION} (${APP_VERSION_CODE}):\n` +
          "• Ajustes varios, experiencia del usuario.\n" +
          "• Banner de clima (temperatura + condición) y banner de avisos colapsable en la pantalla Ride.\n" +
          "• Banner de horario: avisos de ingreso y cierre del parque según el horario vigente.\n" +
          "• Pantalla Ride personalizable.\n" +
          "• Temas que permiten cambiar el color para toda la app.\n" +
          "• Sesión unificada.\n" +
          "• Fix de login.\n" +
          "• Aviso por voz al entrar a las bajadas fiscalizadas de 30 km/h.\n" +
          "• Nuevo diseño pantalla principal ride.\n" +
          "• Mejoras de estabilidad y errores de trazado.\n" +
          "• Estadísticas afinadas.\n" +
          "• SOS ampliado con números de emergencia, funcionalidad nueva para compartir ubicación actual.\n" +
          "• Capas con datos del parque: accesos, cumbres, senderos enduro y horario de ciclistas.\n" +
          "• Pestaña QR: cargar y mostrar el QR Pedalea Seguro a mano.\n" +
          "• Exportación GPX de rides y estadísticas por nivel.\n" +
          "• Login con Google\n" +
          "• Pantalla completa inmersiva.\n" +
          "• Constancia PDF de cada viaje realizado en el cerro.\n" +
          "• Navegación mejorada, hora llegada y km totales.\n" +
          "• Login cumbre30\n" +
          "• Mapa\n" +
          "• Geocercas.\n" +
          "• Aviso por voz.\n" +
          "• Viaje modo gps.\n" +
          "• Viaje modo demo.",
      },
    ],
    // APK directo: ACTIVO - descarga desde Google Drive (link del cliente,
    // v1.8.7 code 33). La URL "usercontent + confirm=t" baja el archivo de
    // un clic, sin la pantalla de advertencia de Drive ("Download anyway").
    // El link de visor original, por si hay que compartirlo:
    //   https://drive.google.com/file/d/1vv25ViRPFuBFugZAsPMQtjN0BrU0CJcb/view?usp=drive_link
    // Para publicar otro APK: sube el archivo nuevo a Drive, compártelo
    // "Cualquiera con el enlace" y reemplaza el id de la URL de abajo.
    // Alternativa futura (GitHub Releases): dejar url: "/api/apk" y definir
    // la variable APK_DOWNLOAD_URL en el hosting (DEPLOY.md · paso 6).
    apk: {
      disponible: true,
      url: "https://drive.usercontent.google.com/download?id=1vv25ViRPFuBFugZAsPMQtjN0BrU0CJcb&export=download&confirm=t",
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
