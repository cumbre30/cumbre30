import crypto from "crypto";

// ============================================================
// Comparación de claves administrativas en tiempo constante (C-04).
// Ambos valores se hashean a SHA-256 antes de comparar: así la
// comparación no filtra la longitud de la clave ni permite un
// ataque de timing byte a byte.
// ============================================================

export function adminKeysEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
