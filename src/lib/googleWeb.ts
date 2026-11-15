"use client";

// ============================================================
// Google Identity Services en la web (cumbregeo.cl).
// Carga el script oficial una vez y renderiza el botón
// «Continuar con Google»; el idToken que entrega va a
// /api/auth/google, que lo valida contra tokeninfo y deja la
// sesión en cookie (igual que el login por contraseña). Así los
// usuarios de Google usan amigos, /rides y /compartir en la web,
// que antes solo aceptaban cuenta Cumbre30 (correo+contraseña).
//
// El APK no pasa por aquí: usa el plugin nativo (googleAuth.ts).
//
// ⚠️ CONFIGURACIÓN EN GOOGLE CLOUD CONSOLE (única vez): en el
// mismo Client ID "Web application" del APK, agregar
// https://cumbregeo.cl a "Authorized JavaScript origins".
// ============================================================

import { GOOGLE_WEB_CLIENT_ID } from "./googleClientId";

type GsiCredential = { credential?: string };
type GsiGlobal = {
  accounts: {
    id: {
      initialize(cfg: { client_id: string; callback: (r: GsiCredential) => void }): void;
      renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
    };
  };
};

let carga: Promise<GsiGlobal | null> | null = null;

/** true si hay Client ID configurado (el botón tiene sentido). */
export function googleWebListo(): boolean {
  return GOOGLE_WEB_CLIENT_ID.length > 10;
}

function cargarGsi(): Promise<GsiGlobal | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!googleWebListo()) return Promise.resolve(null);
  if (!carga) {
    carga = new Promise((resolve) => {
      const w = window as unknown as { google?: GsiGlobal };
      if (w.google?.accounts?.id) return resolve(w.google);
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve((window as unknown as { google?: GsiGlobal }).google ?? null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return carga;
}

/** Renderiza el botón oficial de Google en el contenedor; cuando el
 *  usuario elige cuenta, entrega el idToken al callback. Devuelve
 *  false si Google no está disponible (sin Client ID o script
 *  bloqueado por extensión/red) para que la UI muestre su plan B. */
export async function renderBotonGoogle(
  el: HTMLElement,
  alRecibir: (idToken: string) => void,
): Promise<boolean> {
  const gsi = await cargarGsi();
  if (!gsi) return false;
  try {
    gsi.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      callback: (r) => {
        if (r?.credential) alRecibir(r.credential);
      },
    });
    gsi.accounts.id.renderButton(el, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      width: 260,
      locale: "es",
    });
    return true;
  } catch {
    return false;
  }
}
