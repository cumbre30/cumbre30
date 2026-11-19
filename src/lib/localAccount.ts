"use client";

// ============================================================
// Cuentas LOCALES (APK sin servidor de cuenta configurado).
// El export estático no incluye las rutas /api, y si la persona no
// tiene todavía una web desplegada, el inicio de sesión moría con
// "error de servidor". Con esto, registrar/entrar/salir funciona
// 100% en el dispositivo (misma UX y mismos mensajes que el
// servidor), y las estadísticas salen del historial local de rides.
// Cuando se configure un servidor (Perfil → Servidor de cuenta),
// el servidor vuelve a tener prioridad.
// ============================================================

import { DEFAULT_PIN, isPinId, evaluateAchievements, statsFromRides, ACHIEVEMENT_BY_CODE, normalizeCodes, type PinId } from "@/lib/pins";
import { historyStore, type RideSummary } from "@/lib/history";
import type { MeData } from "@/hooks/useMe";

const USERS_KEY = "cumbre30_local_users_v1";
const SESSION_KEY = "cumbre30_local_session_v1";

type LocalUser = {
  email: string;
  username: string;
  salt: string;
  passwordHash: string;
  selectedPin: PinId;
  bikeBrand: string | null;
  bikeType: string | null;
  bikeModel: string | null;
  bikeSize: string | null;
  bikeColor: string | null;
  // Pesos del conjunto (v1.13.17): respaldo local de rideWeights.
  riderWeightKg: number | null;
  bikeWeightKg: number | null;
  achievements: { code: string; unlockedAt: string }[];
  createdAt: string;
};

// ---- almacenamiento ----

function readUsers(): Record<string, LocalUser> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalUser>) : {};
  } catch {
    return {};
  }
}

function writeUsers(users: Record<string, LocalUser>): void {
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // almacenamiento lleno/bloqueado: no se puede persistir
  }
}

// ---- hash de contraseña (Web Crypto, disponible en el WebView) ----

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newSalt(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---- validaciones (mismos mensajes que /api/auth) ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_RE = /^[a-z0-9_.-]{3,20}$/;

// ---- API pública ----

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function localRegister(payload: { email?: string; username?: string; password?: string }): Promise<AuthResult> {
  const email = (payload.email ?? "").trim().toLowerCase();
  const username = (payload.username ?? "").trim().toLowerCase();
  const password = payload.password ?? "";

  if (!EMAIL_RE.test(email)) return { ok: false, error: "Ingresa un correo válido." };
  if (!USER_RE.test(username))
    return { ok: false, error: "El usuario debe tener 3-20 caracteres (letras, números, punto, guion o guion bajo)." };
  if (password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };

  const users = readUsers();
  const dupEmail = Object.values(users).find((u) => u.email === email);
  if (dupEmail) return { ok: false, error: "Ese correo ya está registrado." };
  const dupUser = Object.values(users).find((u) => u.username === username);
  if (dupUser) return { ok: false, error: "Ese usuario ya está registrado." };

  const salt = newSalt();
  const user: LocalUser = {
    email,
    username,
    salt,
    passwordHash: await hashPassword(password, salt),
    selectedPin: DEFAULT_PIN,
    bikeBrand: null,
    bikeType: null,
    bikeModel: null,
    bikeSize: null,
    bikeColor: null,
    riderWeightKg: null,
    bikeWeightKg: null,
    achievements: [],
    createdAt: new Date().toISOString(),
  };
  users[email] = user;
  writeUsers(users);
  try {
    window.localStorage.setItem(SESSION_KEY, email);
  } catch {
    // sin persistencia de sesión: quedará entrado solo en esta carga
  }
  return { ok: true };
}

export async function localLogin(payload: { email?: string; password?: string }): Promise<AuthResult> {
  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  const users = readUsers();
  const user = users[email];
  if (!user) return { ok: false, error: "Correo o contraseña incorrectos." };
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, error: "Correo o contraseña incorrectos." };
  try {
    window.localStorage.setItem(SESSION_KEY, email);
  } catch {
    // sin persistencia de sesión
  }
  return { ok: true };
}

export function localLogout(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // sin localStorage
  }
}

/** ¿Hay una sesión local activa? (solo tiene sentido sin servidor) */
export function localSessionEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** PUT /api/me en modo local: pin activo y datos de la bici. */
export function localUpdateMe(body: Record<string, unknown>): { ok: true; selectedPin: PinId } | { ok: false; error: string } {
  const email = localSessionEmail();
  if (!email) return { ok: false, error: "Sin sesión" };
  const users = readUsers();
  const user = users[email];
  if (!user) return { ok: false, error: "Sin sesión" };

  for (const k of ["bikeBrand", "bikeType", "bikeModel", "bikeSize", "bikeColor"] as const) {
    if (k in body) {
      const s = typeof body[k] === "string" ? (body[k] as string).trim().slice(0, 40) : "";
      user[k] = s.length ? s : null;
    }
  }
  // Pesos del conjunto (v1.13.17): mismos rangos que PUT /api/me.
  for (const [k, min, max] of [
    ["riderWeightKg", 30, 200],
    ["bikeWeightKg", 5, 50],
  ] as const) {
    if (k in body) {
      const v = body[k];
      if (v === null || v === "") {
        user[k] = null;
      } else {
        const n = typeof v === "number" ? v : Number(v);
        user[k] = isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : null;
      }
    }
  }
  if (typeof body.selectedPin === "string" && isPinId(body.selectedPin)) {
    user.selectedPin = body.selectedPin;
  }
  users[email] = user;
  writeUsers(users);
  return { ok: true, selectedPin: user.selectedPin };
}

/** Registra logros nuevos en la cuenta local (tras guardar un ride). */
export function localUnlockAchievements(codes: string[]): void {
  if (!codes.length) return;
  const email = localSessionEmail();
  if (!email) return;
  const users = readUsers();
  const user = users[email];
  if (!user) return;
  const have = new Set(user.achievements.map((a) => a.code));
  for (const code of codes) {
    if (!have.has(code) && ACHIEVEMENT_BY_CODE[code]) {
      user.achievements.push({ code, unlockedAt: new Date().toISOString() });
    }
  }
  users[email] = user;
  writeUsers(users);
}

/** Pines desbloqueados: el clásico + las recompensas de logros. */
function unlockedPins(user: LocalUser): PinId[] {
  const set = new Set<PinId>(["clasico"]);
  for (const code of normalizeCodes(user.achievements.map((a) => a.code))) {
    const def = ACHIEVEMENT_BY_CODE[code];
    if (def) set.add(def.reward);
  }
  return [...set];
}

/** El /api/me local: usuario en sesión + stats del historial del dispositivo. */
export function localMe(): MeData | null {
  const email = localSessionEmail();
  if (!email) return null;
  const user = readUsers()[email];
  if (!user) return null;

  const rides: RideSummary[] = historyStore.get();
  const stats = statsFromRides(
    rides.map((r) => ({
      distanceKm: r.distanceKm,
      maxKmh: r.maxKmh,
      maxInParkKmh: r.maxInParkKmh,
      gainM: r.gainM,
      overLimitSec: r.overLimitSec,
      dateISO: r.dateISO,
    })),
    0 // incidencias: requieren servidor; en local no hay reportes subidos
  );
  // logros aún no registrados (rides guardados sin sesión activa)
  const have = user.achievements.map((a) => a.code);
  const pending = evaluateAchievements(stats, have);
  let current = user;
  if (pending.length) {
    localUnlockAchievements(pending);
    current = readUsers()[email] ?? user; // releer tras el unlock
  }
  const all = new Set([...have, ...pending]);

  return {
    user: {
      id: `local:${user.email}`,
      email: user.email,
      username: user.username,
      selectedPin: user.selectedPin,
      bikeBrand: user.bikeBrand,
      bikeType: user.bikeType,
      bikeModel: user.bikeModel,
      bikeSize: user.bikeSize,
      bikeColor: user.bikeColor,
      riderWeightKg: user.riderWeightKg ?? null,
      bikeWeightKg: user.bikeWeightKg ?? null,
    },
    stats: {
      totalKm: Number(stats.totalKm.toFixed(1)),
      rideCount: stats.rideCount,
      maxKmh: Number(stats.maxKmh.toFixed(1)),
      totalGainM: Math.round(stats.totalGainM),
      parkRides: stats.parkRides,
      cleanParkRides: stats.cleanParkRides,
      nightRides: stats.nightRides,
      dawnRides: stats.dawnRides,
      maxRideKm: Number(stats.maxRideKm.toFixed(1)),
      weekendRides: stats.weekendRides,
      totalHours: Number(stats.totalHours.toFixed(1)),
      totalParkKm: Number(stats.totalParkKm.toFixed(1)),
      lastRideDate: rides[0]?.dateISO ?? null,
      incidentCount: 0,
    },
    achievements: current.achievements.filter((a) => all.has(a.code)),
    pins: unlockedPins(current),
    friends: [], // amigos compartidos: requieren el servidor de cuenta
  };
}
