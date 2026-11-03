// ============================================================
// Configuración de monetización de Cumbre30.
// ⚠️ COMPLETAR con tus enlaces reales de Mercado Pago y contacto.
//   · Mercado Pago → "Crear enlace de pago" → copiar la URL
//     (se ve como https://mpago.la/xxxxxxxx o
//      https://link.mercadopago.cl/xxxxxxxx).
//   · Si queda vacío (""), la app muestra el botón deshabilitado
//     con una nota — nunca un enlace roto.
// ============================================================

/** Enlace de pago de Cumbre30 Pro (pago único). */
export const PRO_PAY_URL = "https://mpago.la/1WdyZaW";

/** Etiqueta del precio que se muestra en la tarjeta Pro. */
export const PRO_PRICE_LABEL = "$6.500 · pago único";

/** Aportes voluntarios (botón de pago de Mercado Pago, monto libre). */
export const DONATE_OPTIONS: { label: string; url: string }[] = [
  { label: "Aportar — monto libre", url: "https://link.mercadopago.cl/perfumatch" },
];

/** Contacto para el formulario "prototipo para otro parque". */
export const CONTACT_WHATSAPP = "56942961619"; // código de país + número, sin "+"
export const CONTACT_EMAIL = "contacto.cumbre30@gmail.com";

/** Beneficios Pro que se muestran en la tarjeta. */
export const PRO_BENEFITS = [
  "Export GPX de tus viajes con GPS (Strava, Garmin, Komoot)",
  "Constancias PDF ilimitadas (gratis: 3 al mes)",
  "Segmentos del cerro: Pío Nono → Cumbre con récord personal e historial",
  "Apoyo directo al desarrollo de la app",
];

/**
 * Abre un enlace externo en el navegador del teléfono:
 * Custom Tabs nativas en el APK (@capacitor/browser) y pestaña
 * nueva en la web. No usamos <a href> porque el WebView lo bloquea.
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
