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
    eliminarCuenta: string;
  } | null;
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
          "v1.8.3 (versionCode 29):\n• Temas de color para toda la app y pantalla ride personalizable: velocímetro digital, arco, dial o aguja, en tamaño normal, grande o gigante (Cumbre30 Pro)\n• SOS ampliado: Parquemet, Municipalidad de Providencia y Salud Responde además de 133, 131 y 132\n• Datos oficiales del parque: accesos, cumbres, senderos enduro y horario de ciclistas\n• Descenso limpio: resumen cuando recorres el parque respetando los 30 km/h\n• Mejoras de estabilidad\n\nv1.8.2 (versionCode 28):\n• Nueva marca: Cumbre GEO - sitio oficial cumbregeo.cl\n• Compra Pro con entrega automática: tu código llega solo al correo tras pagar\n• Mejoras de estabilidad",
      },
    ],
    // APK directo: ACTIVO - descarga desde Google Drive (link del cliente).
    // La URL "usercontent + confirm=t" baja el archivo de un clic, sin la
    // pantalla de advertencia de Drive ("Download anyway"). El link de
    // visor original, por si hay que compartirlo:
    //   https://drive.google.com/file/d/1JVMc-6oSKQBAP3iYi0cp1caFhbMz-_8u/view?usp=drivesdk
    // Para publicar otro APK: sube el archivo nuevo a Drive, compártelo
    // "Cualquiera con el enlace" y reemplaza el id de la URL de abajo.
    // Alternativa futura (GitHub Releases): dejar url: "/api/apk" y definir
    // la variable APK_DOWNLOAD_URL en el hosting (DEPLOY.md · paso 6).
    apk: {
      disponible: true,
      url: "https://drive.usercontent.google.com/download?id=1JVMc-6oSKQBAP3iYi0cp1caFhbMz-_8u&export=download&confirm=t",
      nota: "",
    },
    planes: { publicado: true, url: "/cumbre30pro" },
    // Play exige estos accesos por app; viven al final del modal de
    // detalle de Cumbre30 (no en el footer del sitio).
    enlaces: {
      contacto: `mailto:${CONTACT_EMAIL}`,
      privacidad: "/privacidad",
      eliminarCuenta: "/eliminar-cuenta",
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
