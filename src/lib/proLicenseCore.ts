// ============================================================
// Cumbre30 Pro - núcleo de licencias (SIN React, usable en
// cliente y en rutas de API del servidor).
//   Código = C30P-XXXX-XXXX-XXXX-XXXX = base32(HMAC-SHA256(
//   secreto, correo)). La app lo valida sin servidor.
//
// ROTACIÓN 2026-11-18 (auditoría R-03/B-03): este secreto queda
// SOLO para validar licencias ya emitidas (grandfathering). Los
// códigos nuevos se generan con el secreto actual que vive en
// proLicenseServer.ts (solo servidor, nunca en el APK) y se
// validan en /api/licencia/validar o con Play Billing.
// ============================================================

// Legado: solo verificación de licencias heredadas.
export const PRO_LICENSE_SECRET_LEGACY =
  "1992d7a7763bbde37bea8ba747831c2d40aff7041ddc3c3da895b8b566ebf702";

const CONST_KEY = "cumbre30-const-v1";

/** Constancias PDF gratis por mes (con Pro: ilimitadas). */
export const FREE_CONSTANCIA_LIMIT = 3;

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

// --- base32 (RFC 4648, sin relleno) ---
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

async function hmacEmail(email: string, secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(normalizeEmail(email)));
  return new Uint8Array(sig);
}

/** Código con formato C30P-XXXX-XXXX-XXXX-XXXX (16 caracteres base32). */
export async function generateProLicenseCode(
  email: string,
  secret: string = PRO_LICENSE_SECRET_LEGACY,
): Promise<string> {
  const sig = await hmacEmail(email, secret);
  const raw = toBase32(sig.slice(0, 10)); // 10 bytes → 16 chars
  return `C30P-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

function cleanCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/^C30P/, "");
}
export { cleanCode };

/** Lo que la app guarda en localStorage al activar Pro.
 *  `server: true` = validado por /api/licencia/validar (código nuevo). */
export type ProLicensePublic = { email: string; code: string; at: number; server?: boolean };

/** ¿El código corresponde a este correo? (offline, sin servidor) */
export async function validateProCode(email: string, code: string): Promise<boolean> {
  if (!email.trim() || !code.trim()) return false;
  const expected = cleanCode(await generateProLicenseCode(email));
  const given = cleanCode(code);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// --- cuota mensual de constancias (nivel gratis) ---
export function constanciaCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const d = JSON.parse(localStorage.getItem(CONST_KEY) ?? "null") as
      | { ym: string; n: number }
      | null;
    return d && d.ym === new Date().toISOString().slice(0, 7) ? d.n : 0;
  } catch {
    return 0;
  }
}

export function incrConstancia(): void {
  if (typeof window === "undefined") return;
  const ym = new Date().toISOString().slice(0, 7);
  const n = constanciaCount() + 1;
  localStorage.setItem(CONST_KEY, JSON.stringify({ ym, n }));
}
