// ============================================================
// Autenticación de servidor: hash scrypt, sesiones en DB y
// cookie httpOnly. Solo para usar en rutas API / servidor.
// ============================================================

import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "cumbre30_session";
const SESSION_DAYS = 30;

// Restablecimiento de contraseña (flujo "olvidé mi contraseña").
export const RESET_TTL_MIN = 30;
export const RESET_MAX_ATTEMPTS = 5;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/** Crea una sesión en DB y devuelve el token opaco. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  usernameChangedAt: Date | null;
  selectedPin: string;
  bikeBrand: string | null;
  bikeType: string | null;
  bikeModel: string | null;
  bikeSize: string | null;
  bikeColor: string | null;
  // Pesos del conjunto (v1.13.17): respaldo para los watts en subida.
  riderWeightKg: number | null;
  bikeWeightKg: number | null;
};

/** Lee la sesión desde la cabecera Authorization: Bearer o la cookie. */
async function sessionFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    void db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return toSessionUser(session.user);
}

function toSessionUser(u: {
  id: string; email: string; username: string; usernameChangedAt: Date | null;
  selectedPin: string; bikeBrand: string | null; bikeType: string | null;
  bikeModel: string | null; bikeSize: string | null; bikeColor: string | null;
  riderWeightKg: number | null; bikeWeightKg: number | null;
}): SessionUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    usernameChangedAt: u.usernameChangedAt,
    selectedPin: u.selectedPin,
    bikeBrand: u.bikeBrand,
    bikeType: u.bikeType,
    bikeModel: u.bikeModel,
    bikeSize: u.bikeSize,
    bikeColor: u.bikeColor,
    riderWeightKg: u.riderWeightKg,
    bikeWeightKg: u.bikeWeightKg,
  };
}

/**
 * Usuario de la sesión actual. Dos vías:
 *  · Web: cookie httpOnly (mismo origen).
 *  · APK: cabecera Authorization: Bearer <token> de /api/auth/token —
 *    el WebView de Capacitor es cross-origin y las cookies third-party
 *    no son confiables, así que el sync viaja con token opaco.
 */
export async function getSessionUser(req?: Request): Promise<SessionUser | null> {
  try {
    const bearer = req?.headers.get("authorization") ?? "";
    if (bearer.toLowerCase().startsWith("bearer ")) {
      return await sessionFromToken(bearer.slice(7).trim() || undefined);
    }
    const jar = await cookies();
    return await sessionFromToken(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function destroyCurrentSession(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) await db.session.deleteMany({ where: { token } });
  } catch {
    // sesión ya inexistente
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
