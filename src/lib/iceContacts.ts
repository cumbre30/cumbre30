"use client";

// ============================================================
// Contactos de emergencia ICE (In Case of Emergency) - Ola 1.
// ------------------------------------------------------------
// Completa el circuito de la detección de caída: si la cuenta
// regresiva "¿Estás bien?" expira sin respuesta (o el ciclista
// toca "Necesito ayuda"), la app puede avisar solo a los
// contactos que el propio usuario configuró AQUÍ. El aviso es un
// mensaje de texto con la ubicación GPS: se abre la app de
// mensajes o WhatsApp con el texto ya redactado, en el idioma
// activo. Nada sale del teléfono: los contactos viven en
// localStorage y el envío siempre pasa por el sistema operativo.
//
// Máximo 3 contactos: en una emergencia la lista debe poder
// leerse de un vistazo (y el auto-aviso sale al primero).
// ============================================================

import { getLang, t } from "./i18n";
import type { LatLng } from "./park";

const LS_KEY = "cumbre30-ice-v1";
export const ICE_MAX = 3;

export type IceContact = {
  id: string; // id corto estable (crypto.randomUUID o fallback)
  name: string; // nombre visible (1-40 chars)
  phone: string; // como lo escribió el usuario (+56 9 ..., 9 1234 5678...)
};

export type IceConfig = {
  auto: boolean; // avisar automáticamente al expirar la cuenta regresiva
  contacts: IceContact[];
};

export function getIceConfig(): IceConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<IceConfig>;
      return {
        auto: d.auto !== false, // on por defecto, igual que la detección de caída
        contacts: Array.isArray(d.contacts) ? d.contacts.slice(0, ICE_MAX) : [],
      };
    }
  } catch {
    // sin almacenamiento disponible
  }
  return { auto: true, contacts: [] };
}

export function saveIceConfig(cfg: IceConfig): void {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ auto: cfg.auto, contacts: cfg.contacts.slice(0, ICE_MAX) })
    );
  } catch {
    // sin almacenamiento disponible
  }
}

export function setIceAuto(auto: boolean): void {
  saveIceConfig({ ...getIceConfig(), auto });
}

/** Valida al vuelo (sin guardar): devuelve null si el par es válido. */
export function iceValidationError(name: string, phone: string): string | null {
  const n = name.trim();
  const p = phone.trim();
  if (n.length < 1 || n.length > 40) return t("cfg.iceErrNombre");
  const digits = p.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return t("cfg.iceErrTelefono");
  return null;
}

export function upsertIceContact(name: string, phone: string): IceConfig {
  const cfg = getIceConfig();
  const contact: IceContact = {
    id: `ice-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: name.trim().slice(0, 40),
    phone: phone.trim().slice(0, 24),
  };
  cfg.contacts = [...cfg.contacts, contact].slice(-ICE_MAX);
  saveIceConfig(cfg);
  return cfg;
}

export function removeIceContact(id: string): IceConfig {
  const cfg = getIceConfig();
  cfg.contacts = cfg.contacts.filter((c) => c.id !== id);
  saveIceConfig(cfg);
  return cfg;
}

// ---------- redacción y enlaces del aviso ----------

/** Solo dígitos: el teléfono debe servir para sms: y wa.me. */
function digits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  // Chile móvil sin código de país (9 dígitos, parte con 9): anteponer +56.
  if (d.length === 9 && d.startsWith("9")) return `56${d}`;
  return d;
}

/** Texto del aviso, redactado en el idioma activo de la app. */
export function iceMessage(position: LatLng | null, helpMode: boolean): string {
  const lang = getLang();
  const hora = new Date().toLocaleTimeString(lang === "en" ? "en-GB" : lang === "pt" ? "pt-BR" : "es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const base = position
    ? t("ice.mensajeConPos", `https://maps.google.com/?q=${position.lat.toFixed(5)},${position.lon.toFixed(5)}`, hora)
    : t("ice.mensajeSinPos", hora);
  return helpMode ? `${base} ${t("ice.mensajeAyuda")}` : base;
}

/** sms: con el texto pre-cargado (Android e iOS aceptan ?body=). */
export function iceSmsHref(contact: IceContact, position: LatLng | null, helpMode: boolean): string {
  return `sms:${digits(contact.phone)}?body=${encodeURIComponent(iceMessage(position, helpMode))}`;
}

/** WhatsApp web/nativo con el texto pre-cargado. */
export function iceWaHref(contact: IceContact, position: LatLng | null, helpMode: boolean): string {
  return `https://wa.me/${digits(contact.phone)}?text=${encodeURIComponent(iceMessage(position, helpMode))}`;
}

/** Dispara el aviso al contacto principal (auto-aviso al expirar).
 *  window.location con esquema sms: no destruye la página; si el
 *  sistema no tiene handler, la UI sigue mostrando los botones. */
export function triggerIceAutoAlert(position: LatLng | null, helpMode: boolean): boolean {
  const cfg = getIceConfig();
  if (!cfg.auto || cfg.contacts.length === 0) return false;
  try {
    window.location.href = iceSmsHref(cfg.contacts[0], position, helpMode);
    return true;
  } catch {
    return false;
  }
}
