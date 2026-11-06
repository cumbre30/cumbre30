// ============================================================
// Configuración de monetización de Cumbre30 (CumbreLabs).
//
// Modelo de compra (decisión nov. 2026):
//   · LA APP no contiene links de pago: solo activación por
//     código (Canje) o compra con Google Play Billing cuando
//     el build es de Play (NEXT_PUBLIC_PLAY_BUILD=1).
//   · LA PÁGINA WEB /pro concentra el pago con Mercado Pago
//     (plan Pro y aporte voluntario) — Google Play prohíbe
//     dirigir la compra de funciones digitales desde la app.
//   · El código C30P-XXXX-XXXX-XXXX-XXXX llega por correo y se
//     valida 100% offline en la app (proLicenseCore).
// ============================================================

/** Build de Google Play (export con PLAY_BUILD=1): muestra compra Billing. */
export const IS_PLAY_BUILD = process.env.NEXT_PUBLIC_PLAY_BUILD === "1";

/** Enlace de pago de Cumbre30 Pro en Mercado Pago (solo página /pro). */
export const PRO_PAY_URL = "https://mpago.la/1WdyZaW";

/** Precio en dinero real (web / Mercado Pago): precio fundador. */
export const PRO_PRICE_LABEL = "$6.500 · pago único";

/**
 * Google Play Billing — producto único (non-consumable).
 * Precio calculado para recibir ~$6.500 netos con la comisión 15%
 * del programa para desarrolladores pequeños: 7.650 × 0,85 = $6.502.
 * El precio que Play muestra al usuario (con IVA aplicable) viene de
 * Play Console; este label es el de referencia en la UI del build Play.
 */
export const PRO_PLAY_PRODUCT_ID = "cumbre30_pro";
export const PRO_PLAY_PRICE_LABEL = "$7.650 · pago único";

/** Aporte voluntario — botón de la página /pro (Mercado Pago, monto libre). */
export const DONATE_OPTIONS: { label: string; url: string }[] = [
  { label: "Aportar — monto libre", url: "https://link.mercadopago.cl/perfumatch" },
];

/** Contacto para soporte (permitido por Play: no es steering de compra). */
export const CONTACT_WHATSAPP = "56942961619"; // código de país + número, sin "+"
export const CONTACT_EMAIL = "contacto.cumbre30@gmail.com";

/** Beneficios Pro que se muestran en la tarjeta (validados en código). */
export const PRO_BENEFITS = [
  "Export GPX de tus viajes con GPS (Strava, Garmin, Komoot)",
  "Constancias PDF ilimitadas (gratis: 3 al mes)",
  "Segmentos del cerro: Pío Nono → Plaza México con récord personal e historial",
  "Buscador universal: escribe cualquier dirección y la ruta ciclable se traza sola + marcadores en el mapa",
  "Historial ilimitado de viajes (gratis: los últimos 20)",
  "Estadísticas avanzadas: resumen mes a mes con desnivel y comparación",
  "Desafíos del cerro completos y todos los pines (gratis: el primero de cada serie)",
  "Apoyo directo al desarrollo de la app",
];

/**
 * Abre un enlace externo en el navegador del teléfono:
 * Custom Tabs nativas en el APK (@capacitor/browser) y pestaña
 * nueva en la web. Reservado para soporte/contacto; NUNCA para
 * pagos dentro de la app (requisito de Google Play).
 */
export async function openExternal(url: string): Promise<void> {
  if (!url) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  }
}
