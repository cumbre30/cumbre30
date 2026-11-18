// ============================================================
// Cumbre30 Pro - capa cliente (store reactivo + hook).
// La lógica criptográfica vive en proLicenseCore.ts para poder
// generar códigos también desde el servidor (/api/licencia).
// ============================================================

"use client";

import { useSyncExternalStore } from "react";
import {
  cleanCode,
  normalizeEmail,
  validateProCode,
  type ProLicensePublic,
} from "./proLicenseCore";
import { playProOwned, setPlayProOwned } from "./playBilling";
import { apiUrl } from "./backend";

const STORE_KEY = "cumbre30-pro-v1";

export type ProInfo = { active: boolean; email: string | null; at: number | null };

const INITIAL_PRO: ProInfo = { active: false, email: null, at: null };

// Re-exportaciones útiles para los componentes
export {
  FREE_CONSTANCIA_LIMIT,
  constanciaCount,
  incrConstancia,
  validateProCode,
} from "./proLicenseCore";

/**
 * ¿Licencia Pro activa? Lectura SÍNCRONA para módulos no-React
 * (sync/offlineAuth evalúan logros fuera de componentes).
 * Dos orígenes de Pro:
 *   · Código de canje validado (STORE_KEY) - web y APK directo.
 *   · Compra con Google Play Billing (flag de playBilling) - build Play.
 */
export function isProActive(): boolean {
  return readStored() != null || playProOwned();
}

// --- store reactivo compartido (Perfil e Historial) ---
let snap: ProInfo = INITIAL_PRO;
const listeners = new Set<() => void>();

function readStored(): ProLicensePublic | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ProLicensePublic) : null;
  } catch {
    return null;
  }
}

function notify(): void {
  for (const l of listeners) l();
}

async function recompute(): Promise<void> {
  const s = readStored();
  if (!s) {
    // Sin código de canje: Pro solo si hay compra vigente en Google Play.
    snap = playProOwned() ? { active: true, email: null, at: null } : INITIAL_PRO;
    notify();
    return;
  }
  // Códigos validados por el servidor (B-03) se confían tal cual:
  // el secreto vigente no viaja en el APK, así que la reválida
  // criptográfica offline solo aplica al secreto legado.
  const ok = s.server === true ? true : await validateProCode(s.email, s.code);
  snap = ok ? { active: true, email: s.email, at: s.at } : INITIAL_PRO;
  notify();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  void recompute();
  return () => {
    listeners.delete(l);
  };
}

const getSnap = (): ProInfo => snap;
const getServer = (): ProInfo => INITIAL_PRO;

/** Reevalúa el estado Pro (p. ej. cuando Play Billing confirma una compra). */
export function refreshPro(): void {
  void recompute();
}

export function useProLicense() {
  const pro = useSyncExternalStore(subscribe, getSnap, getServer);
  const activate = async (
    email: string,
    code: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    // Validación server-first (B-03): el secreto vigente vive solo
    // en el servidor. Si no hay red (APK offline) cae al secreto
    // legado, que solo acepta licencias ya emitidas.
    let ok = false;
    let serverOk = false;
    const urlValidar = apiUrl("/api/licencia/validar");
    if (urlValidar) {
      try {
        const r = await fetch(urlValidar, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });
        if (r.ok) {
          const d = (await r.json()) as { valid?: boolean };
          if (d.valid === true) {
            ok = true;
            serverOk = true;
          } else {
            // El servidor conoce el secreto legado Y el vigente: un
            // "no" definitivo no se reintenta offline.
            return { ok: false, error: "El código no corresponde a ese correo. Revisa mayúsculas y guiones." };
          }
        }
      } catch {
        // Sin conexión: el fallback offline decide más abajo.
      }
    }
    if (!ok) {
      ok = await validateProCode(email, code);
    }
    if (!ok) {
      return { ok: false, error: "El código no corresponde a ese correo. Revisa mayúsculas y guiones." };
    }
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        email: normalizeEmail(email),
        code: cleanCode(code),
        at: Date.now(),
        ...(serverOk ? { server: true } : {}),
      }),
    );
    await recompute();
    return { ok: true };
  };
  const deactivate = (): void => {
    localStorage.removeItem(STORE_KEY);
    // También baja el flag de compra Play: en el próximo arranque
    // initPlayBilling lo restaura si la compra sigue vigente en Play.
    setPlayProOwned(false);
    void recompute();
  };
  return { pro, activate, deactivate };
}
