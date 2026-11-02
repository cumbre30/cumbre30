// ============================================================
// Cumbre30 Pro — capa cliente (store reactivo + hook).
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
    snap = INITIAL_PRO;
    notify();
    return;
  }
  const ok = await validateProCode(s.email, s.code);
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

export function useProLicense() {
  const pro = useSyncExternalStore(subscribe, getSnap, getServer);
  const activate = async (
    email: string,
    code: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const ok = await validateProCode(email, code);
    if (!ok) {
      return { ok: false, error: "El código no corresponde a ese correo. Revisa mayúsculas y guiones." };
    }
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ email: normalizeEmail(email), code: cleanCode(code), at: Date.now() }),
    );
    await recompute();
    return { ok: true };
  };
  const deactivate = (): void => {
    localStorage.removeItem(STORE_KEY);
    void recompute();
  };
  return { pro, activate, deactivate };
}
