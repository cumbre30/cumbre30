"use client";

// ============================================================
// Autenticación 100% offline para el APK (export estático).
// En el APK no existe /api/*: usuarios, sesión, perfil y logros
// viven en localStorage con PBKDF2 (WebCrypto). Misma forma de
// datos que el servidor (MeData) para que la UI no cambie.
// Se activa con NEXT_PUBLIC_STATIC=1 en tiempo de build.
// ============================================================

import { historyStore, type RideSummary } from "@/lib/history";
import { ACHIEVEMENT_BY_CODE, evaluateAchievements, isPinId, normalizeCodes, statsFromRides, type PinId } from "@/lib/pins";
import type { MeData, MeUser } from "@/hooks/useMe";

const USERS_KEY = "cumbre30-offline-users-v1";
const SESSION_KEY = "cumbre30-offline-session-v1";
const ACH_KEY = "cumbre30-offline-achievements-v1";
const SESSION_DAYS = 30;

export function isOfflineMode(): boolean {
  return process.env.NEXT_PUBLIC_STATIC === "1";
}

type OfflineUser = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  selectedPin: string;
  bikeBrand: string | null;
  bikeType: string | null;
  bikeModel: string | null;
  bikeSize: string | null;
  bikeColor: string | null;
  createdAt: string;
};

type OfflineSession = { email: string; expiresAt: number };

type OfflineAchievement = { code: string; unlockedAt: string };

// ---------- almacenamiento base ----------

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // almacenamiento lleno / no disponible
  }
}

function readUsers(): Record<string, OfflineUser> {
  return readJSON<Record<string, OfflineUser>>(USERS_KEY, {});
}

// ---------- hashing PBKDF2 ----------

const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  const enc = new TextEncoder();
  if (crypto?.subtle?.importKey && crypto.subtle.deriveBits) {
    try {
      const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        key,
        256
      );
      return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${toHex(bits)}`;
    } catch {
      // cae al fallback simple
    }
  }
  // Fallback (WebView sin subtle): SHA-256 con salt. Solo protege datos locales.
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${password}`));
  return `sha256$${salt}$${toHex(digest)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [, iterStr, salt, expectedHex] = parts;
  const enc = new TextEncoder();
  try {
    if (parts[0] === "pbkdf2" && crypto?.subtle?.importKey && crypto.subtle.deriveBits) {
      const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(salt), iterations: Number(iterStr) || PBKDF2_ITERATIONS, hash: "SHA-256" },
        key,
        256
      );
      return toHex(bits) === expectedHex;
    }
    if (parts[0] === "sha256") {
      const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${password}`));
      return toHex(digest) === expectedHex;
    }
  } catch {
    return false;
  }
  return false;
}

// ---------- sesión ----------

function setSession(email: string): void {
  const s: OfflineSession = { email, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 };
  writeJSON(SESSION_KEY, s);
}

function getSession(): OfflineSession | null {
  const s = readJSON<OfflineSession | null>(SESSION_KEY, null);
  if (!s || typeof s.email !== "string") return null;
  if (!s.expiresAt || s.expiresAt < Date.now()) return null;
  return s;
}

function currentUser(): OfflineUser | null {
  const s = getSession();
  if (!s) return null;
  return readUsers()[s.email] ?? null;
}

// ---------- registro / login / logout ----------

export async function offlineRegister(payload: { email?: string; username?: string; password?: string }): Promise<string | null> {
  const email = (payload.email ?? "").trim().toLowerCase();
  const username = (payload.username ?? "").trim().toLowerCase();
  const password = payload.password ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresa un correo válido.";
  if (!/^[a-z0-9_.-]{3,20}$/.test(username))
    return "El usuario debe tener 3-20 caracteres (letras, números, punto, guion o guion bajo).";
  if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";

  const users = readUsers();
  const dupEmail = Object.values(users).some((u) => u.email === email);
  const dupUser = Object.values(users).some((u) => u.username === username);
  if (dupEmail || dupUser) {
    return `Ese ${dupEmail ? "correo" : "usuario"} ya está registrado.`;
  }

  const user: OfflineUser = {
    id: `off-${randomHex(8)}`,
    email,
    username,
    passwordHash: await hashPassword(password),
    selectedPin: "clasico",
    bikeBrand: null,
    bikeType: null,
    bikeModel: null,
    bikeSize: null,
    bikeColor: null,
    createdAt: new Date().toISOString(),
  };
  users[email] = user;
  writeJSON(USERS_KEY, users);
  setSession(email);
  return null;
}

export async function offlineLogin(payload: { email?: string; password?: string }): Promise<string | null> {
  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  const user = readUsers()[email];
  if (!user) return "Correo o contraseña incorrectos.";
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return "Correo o contraseña incorrectos.";
  setSession(email);
  return null;
}

export function offlineLogout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

// ---------- perfil (PUT /api/me offline) ----------

export function offlineUpdateProfile(patch: Record<string, unknown>): { ok: boolean } {
  const user = currentUser();
  if (!user) return { ok: false };
  const users = readUsers();
  for (const k of ["bikeBrand", "bikeType", "bikeModel", "bikeSize", "bikeColor"] as const) {
    if (k in patch) {
      const s = typeof patch[k] === "string" ? (patch[k] as string).trim().slice(0, 40) : "";
      user[k] = s.length ? s : null;
    }
  }
  if (typeof patch.selectedPin === "string" && isPinId(patch.selectedPin)) {
    user.selectedPin = patch.selectedPin;
  }
  users[user.email] = user;
  writeJSON(USERS_KEY, users);
  return { ok: true };
}

// ---------- logros offline ----------

function readAchievements(): OfflineAchievement[] {
  return readJSON<OfflineAchievement[]>(ACH_KEY, []);
}

export function offlineUnlockAchievements(codes: Iterable<string>): void {
  if (typeof window === "undefined") return;
  const have = readAchievements();
  const haveSet = new Set(have.map((a) => a.code));
  const now = new Date().toISOString();
  for (const code of normalizeCodes(codes)) {
    if (!ACHIEVEMENT_BY_CODE[code] || haveSet.has(code)) continue;
    have.push({ code, unlockedAt: now });
    haveSet.add(code);
  }
  writeJSON(ACH_KEY, have);
}

// ---------- MeData offline (equivalente a GET /api/me) ----------

function toMeUser(u: OfflineUser): MeUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    selectedPin: u.selectedPin,
    bikeBrand: u.bikeBrand,
    bikeType: u.bikeType,
    bikeModel: u.bikeModel,
    bikeSize: u.bikeSize,
    bikeColor: u.bikeColor,
  };
}

export function offlineMe(): MeData | null {
  const user = currentUser();
  if (!user) return null;

  const rides: RideSummary[] = historyStore.get();
  const statsRaw = statsFromRides(rides);
  const stats = {
    totalKm: Number(statsRaw.totalKm.toFixed(1)),
    rideCount: statsRaw.rideCount,
    maxKmh: Number(statsRaw.maxKmh.toFixed(1)),
    totalGainM: Math.round(statsRaw.totalGainM),
    parkRides: statsRaw.parkRides,
    cleanParkRides: statsRaw.cleanParkRides,
    nightRides: statsRaw.nightRides,
    dawnRides: statsRaw.dawnRides,
    lastRideDate: rides[0]?.dateISO ?? null,
    incidentCount: 0,
  };

  // Logros: los guardados + los que ya cumple con el historial local.
  const saved = readAchievements();
  const have = saved.map((a) => a.code);
  const earned = evaluateAchievements(statsRaw, have);
  if (earned.some((c) => !have.includes(c))) offlineUnlockAchievements(earned);

  const all = [...have, ...earned.filter((c) => !have.includes(c))];
  const achievements = all
    .map((code) => {
      const hit = saved.find((a) => a.code === code);
      return { code, unlockedAt: hit?.unlockedAt ?? new Date().toISOString() };
    })
    .sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));

  // Pines: el clásico + recompensas de logros.
  const pinSet = new Set<PinId | string>(["clasico"]);
  for (const code of normalizeCodes(all)) {
    const def = ACHIEVEMENT_BY_CODE[code];
    if (def) pinSet.add(def.reward);
  }

  return {
    user: toMeUser(user),
    stats,
    achievements,
    pins: [...pinSet],
    friends: [],
  };
}
