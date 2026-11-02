// ============================================================
// Reglas del nombre de usuario, compartidas por la UI, el modo
// offline (APK) y la API del servidor:
//   - formato válido: 3-20 caracteres [a-z0-9_.-]
//   - cambio permitido solo 1 vez cada 30 días
// Las estadísticas, logros y pines quedan asociados al correo
// (clave de la cuenta), así que cambiar el usuario no mueve nada.
// ============================================================

export const USERNAME_RE = /^[a-z0-9_.-]{3,20}$/;
export const USERNAME_COOLDOWN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Valida el formato; devuelve el mensaje de error o null si está bien. */
export function validateUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return "El usuario debe tener 3-20 caracteres (letras, números, punto, guion o guion bajo).";
  }
  return null;
}

/** Próxima fecha en que se puede volver a cambiar (null = sin restricción). */
export function nextUsernameChangeAt(
  changedAt: string | Date | null | undefined
): Date | null {
  if (!changedAt) return null;
  const t = typeof changedAt === "string" ? Date.parse(changedAt) : changedAt.getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + USERNAME_COOLDOWN_DAYS * DAY_MS);
}

/** ¿Está bloqueado el cambio por la regla de los 30 días? */
export function usernameLocked(
  changedAt: string | Date | null | undefined,
  now: number = Date.now()
): { locked: boolean; nextAt: Date | null } {
  const nextAt = nextUsernameChangeAt(changedAt);
  return { locked: !!nextAt && nextAt.getTime() > now, nextAt };
}
