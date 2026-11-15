"use client";

// ============================================================
// Autenticación 100% offline para el APK (export estático).
// En el APK no existe /api/*: usuarios, sesión, perfil y logros
// viven en localStorage con PBKDF2 (WebCrypto). Misma forma de
// datos que el servidor (MeData) para que la UI no cambie.
// Se activa con NEXT_PUBLIC_STATIC=1 en tiempo de build.
// ============================================================

import { bikeOnly, historyStore, removeRidesForAccount, ridesForAccount, type RideSummary } from "@/lib/history";
import { ACHIEVEMENT_BY_CODE, evaluateAchievements, isPinId, normalizeCodes, statsFromRides, type PinId } from "@/lib/pins";
import { isProActive } from "@/lib/proLicense";
import { USERNAME_RE, validateUsername, usernameLocked } from "@/lib/username";
import type { MeData, MeUser } from "@/hooks/useMe";
import { enqueueOp, forgetAllSyncData, forgetToken, linkGoogle, linkPassword, registerAndLink, setServerToken, serverToken, syncNow } from "@/lib/cloudSync";
import { apiUrl } from "@/lib/backend";

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
  /** Última vez que el usuario cambió su nombre de usuario (regla 30 días). */
  usernameChangedAt?: string;
  /** ID estable de la cuenta Google (claim "sub") si la cuenta está vinculada. */
  googleSub?: string;
  /** Origen de la cuenta: contraseña local o inicio con Google. */
  provider?: "local" | "google";
  /** Código de recuperación (XXXX-XXXX): permite restablecer la contraseña
   *  sin perder km/logros. Se genera al crear la cuenta y se muestra en Perfil. */
  recoveryCode?: string;
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

// ---------- código de recuperación (restablecimiento offline) ----------

function newRecoveryCode(): string {
  return `${randomHex(2).toUpperCase()}-${randomHex(2).toUpperCase()}`;
}

/** Garantiza que la cuenta tenga código de recuperación (cuentas antiguas). */
function ensureRecoveryCode(user: OfflineUser): void {
  if (user.recoveryCode) return;
  user.recoveryCode = newRecoveryCode();
  const users = readUsers();
  users[user.email] = user;
  writeJSON(USERS_KEY, users);
}

/**
 * Restablece la contraseña de una cuenta local del dispositivo usando
 * su código de recuperación (se muestra en Perfil → Mis datos).
 * Devuelve el mensaje de error o null si salió bien.
 */
export async function offlineForgotReset(payload: {
  email?: string;
  recoveryCode?: string;
  newPassword?: string;
}): Promise<string | null> {
  const email = (payload.email ?? "").trim().toLowerCase();
  const code = (payload.recoveryCode ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const newPassword = payload.newPassword ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresa un correo válido.";
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return "El código de recuperación tiene el formato XXXX-XXXX.";
  if (newPassword.length < 6) return "La contraseña debe tener al menos 6 caracteres.";

  const users = readUsers();
  const user = users[email];
  if (!user) return "No hay una cuenta con ese correo en este dispositivo.";
  if (!user.recoveryCode) return "Esta cuenta no tiene código de recuperación. Entra con Google para vincularla y protegerla.";
  if (user.recoveryCode.toUpperCase() !== code) return "Código de recuperación incorrecto.";

  user.passwordHash = await hashPassword(newPassword);
  users[email] = user;
  writeJSON(USERS_KEY, users);
  return null;
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
    recoveryCode: newRecoveryCode(),
  };
  users[email] = user;
  writeJSON(USERS_KEY, users);
  setSession(email);
  // Progreso enlazado a la cuenta: crea/vincula la cuenta en el
  // servidor y deja el outbox subiendo en segundo plano.
  void registerAndLink(email, username, password);
  return null;
}

export async function offlineLogin(payload: { email?: string; password?: string }): Promise<string | null> {
  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  const user = readUsers()[email];
  if (!user) return "Correo o contraseña incorrectos.";
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return "Correo o contraseña incorrectos.";
  ensureRecoveryCode(user); // cuentas creadas antes del código de recuperación
  setSession(email);
  // Token de sync: si la contraseña coincide con la del servidor, el
  // progreso se enlaza a la cuenta (push outbox + pull de rides).
  void linkPassword(email, password);
  return null;
}

// ---------- importación de la cuenta web (cumbregeo.cl) ----------

// La APK guarda sus cuentas en el teléfono (localStorage), pero muchas
// personas crearon su cuenta Cumbre30 en el sitio web. Al iniciar sesión
// con un correo que no existe localmente y con internet disponible,
// verificamos contra el servidor e importamos la cuenta al teléfono:
// usuario, pin, datos de la bici y logros. Los km/rides siguen siendo
// por dispositivo (el historial no se transfiere).
const SERVER_ORIGIN = "https://cumbregeo.cl";

type WebLoginPayload = {
  username?: string;
  email?: string;
  /** Token de sesión (solo para orígenes del APK): habilita el sync. */
  token?: string;
  expiresAt?: string;
  selectedPin?: string;
  bikeBrand?: string | null;
  bikeType?: string | null;
  bikeModel?: string | null;
  bikeSize?: string | null;
  bikeColor?: string | null;
  achievements?: string[];
};

function cleanStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, 40) : "";
  return s.length ? s : null;
}

/**
 * Intenta importar la cuenta web al teléfono. Devuelve true si la
 * cuenta quedó creada y con sesión iniciada; false si no corresponde
 * (ya hay cuenta local, sin red, credenciales inválidas) — en ese
 * caso la llamada mostró su propio mensaje.
 */
export async function offlineImportWebAccount(payload: { email?: string; password?: string }): Promise<boolean> {
  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  if (!email || !password) return false;

  // Si ya existe una cuenta local con ese correo, el error real es su
  // contraseña local (se arregla con el código de recuperación), no
  // hay que sobreescribir nada.
  if (readUsers()[email]) return false;

  try {
    const r = await fetch(`${SERVER_ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return false;
    const d = (await r.json()) as WebLoginPayload;
    const webEmail = (d.email ?? "").trim().toLowerCase();
    let username = (d.username ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(webEmail) || !username) return false;
    // El nombre debe cumplir las reglas locales; si no, se deriva del correo.
    if (!USERNAME_RE.test(username)) username = "";

    const users = readUsers();
    const user: OfflineUser = {
      id: `off-${randomHex(8)}`,
      email: webEmail,
      username: username && !Object.values(users).some((u) => u.username === username)
        ? username
        : uniqueUsernameFrom(webEmail, users),
      passwordHash: await hashPassword(password), // misma clave, hasheada local
      selectedPin: isPinId(d.selectedPin ?? "") ? (d.selectedPin as string) : "clasico",
      bikeBrand: cleanStr(d.bikeBrand),
      bikeType: cleanStr(d.bikeType),
      bikeModel: cleanStr(d.bikeModel),
      bikeSize: cleanStr(d.bikeSize),
      bikeColor: cleanStr(d.bikeColor),
      createdAt: new Date().toISOString(),
      provider: "local",
      recoveryCode: newRecoveryCode(),
    };
    users[user.email] = user;
    writeJSON(USERS_KEY, users);
    if (Array.isArray(d.achievements) && d.achievements.length) {
      offlineUnlockAchievements(d.achievements);
    }
    setSession(user.email);
    // Token de sync (el login lo devuelve para orígenes del APK):
    // con él, el progreso del teléfono se enlaza a la cuenta y el
    // pull trae los km/logros guardados en el servidor.
    if (typeof d.token === "string" && d.token) {
      setServerToken(d.token, webEmail, d.expiresAt);
    }
    return true;
  } catch {
    return false; // sin red o servidor caído: queda el error local
  }
}

// ---------- inicio de sesión con Google (offline) ----------

/**
 * Enlaza o crea la cuenta local a partir de la cuenta Google devuelta
 * por el plugin nativo. No hay servidor: el idToken llegó directo del
 * SDK de Google Play Services y solo guardamos sub/email/nombre.
 *   1. Ya vinculada (googleSub) → entra directo.
 *   2. Mismo correo registrado → se vincula a esa cuenta (mantiene km y logros).
 *   3. Cuenta nueva → username derivado del correo, contraseña aleatoria no utilizable.
 */
export async function offlineGoogleSignIn(acct: { sub: string; email: string; name?: string; idToken?: string }): Promise<string | null> {
  const email = (acct.email ?? "").trim().toLowerCase();
  const sub = (acct.sub ?? "").trim();
  if (!sub) return "Google no devolvió el identificador de la cuenta.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Google no devolvió un correo válido.";

  const users = readUsers();
  let user = Object.values(users).find((u) => u.googleSub === sub) ?? null;
  if (!user) {
    const byEmail = users[email] ?? null;
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== sub) {
        return "Ese correo ya está vinculado a otra cuenta de Google.";
      }
      byEmail.googleSub = sub;
      byEmail.provider = "google";
      user = byEmail;
    } else {
      user = {
        id: `off-${randomHex(8)}`,
        email,
        username: uniqueUsernameFrom(email, users),
        passwordHash: await hashPassword(randomHex(24)), // inutilizable a propósito
        selectedPin: "clasico",
        bikeBrand: null,
        bikeType: null,
        bikeModel: null,
        bikeSize: null,
        bikeColor: null,
        createdAt: new Date().toISOString(),
        googleSub: sub,
        provider: "google",
      };
    }
    users[user.email] = user;
    writeJSON(USERS_KEY, users);
  }
  setSession(user.email);
  // Progreso enlazado a la cuenta: el idToken nativo se cambia por un
  // token de sesión en el servidor (validación oficial de Google).
  if (acct.idToken) void linkGoogle(acct.idToken);
  return null;
}

/** Username único a partir del correo, respetando la regla [a-z0-9_.-]{3,20}. */
function uniqueUsernameFrom(email: string, users: Record<string, OfflineUser>): string {
  const taken = new Set(Object.values(users).map((u) => u.username));
  let base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 14);
  if (base.length < 3) base = `${base}0${randomHex(2)}`; // garantiza ≥ 3 caracteres
  base = base.replace(/^[-.]+/, "") || "rider";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`) && n < 999) n++;
  return `${base}${n}`.slice(0, 20);
}

export function offlineLogout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  forgetToken(); // corta el sync: sin sesión, no se sube ni se baja progreso
}

/**
 * Baja definitiva de la cuenta local (Perfil → Mis datos → Eliminar cuenta):
 * borra la cuenta, su sesión y sus viajes enlazados. Los logros y la licencia
 * Pro viven a nivel de dispositivo, así que solo se eliminan si este era el
 * último usuario del teléfono. Es irreversible.
 */
export function offlineDeleteAccount(): void {
  if (typeof window === "undefined") return;
  const email = getSession()?.email ?? null;
  if (email) {
    const users = readUsers();
    delete users[email];
    writeJSON(USERS_KEY, users);
    removeRidesForAccount(email);
  }
  localStorage.removeItem(SESSION_KEY);
  void forgetAllSyncData(); // token + outbox del dispositivo
  if (Object.keys(readUsers()).length === 0) {
    localStorage.removeItem(ACH_KEY);
    localStorage.removeItem("cumbre30-pro-v1"); // licencia Pro del dispositivo
  }
}

// ---------- cambio de nombre de usuario (1 vez cada 30 días) ----------

/**
 * Cambia el nombre de usuario de la cuenta actual. Los kilómetros,
 * logros y pines quedan asociados al correo (clave de la cuenta),
 * así que el cambio no mueve ninguna estadística. Las amistades
 * tampoco: se guardan por id interno, no por nombre.
 * Fuente de verdad del nombre (v1.12.7): el servidor. Con sesión y
 * red, el cambio se aplica allá primero — mismas reglas (formato,
 * 30 días, disponibilidad) y el error real llega al usuario, igual
 * que en la web. Sin red o sin sesión: cambio local + op en cola
 * para el próximo sync. Antes solo tocaba el almacenamiento local y
 * el servidor (y por tanto la lista de amigos) seguía con el nombre
 * viejo.
 * Devuelve el mensaje de error o null si salió bien.
 */
export async function offlineChangeUsername(newUsername: string): Promise<string | null> {
  const user = currentUser();
  if (!user) return "Inicia sesión para cambiar tu nombre de usuario.";
  const username = newUsername.trim().toLowerCase();
  const formatErr = validateUsername(username);
  if (formatErr) return formatErr;
  if (username === user.username) return "Ese ya es tu nombre de usuario actual.";

  const { locked, nextAt } = usernameLocked(user.usernameChangedAt);
  if (locked && nextAt) {
    return `Ya cambiaste tu usuario recientemente. Podrás cambiarlo de nuevo el ${nextAt.toLocaleDateString("es-CL")}.`;
  }

  const users = readUsers();
  if (Object.values(users).some((u) => u.email !== user.email && u.username === username)) {
    return "Ese usuario ya está en uso por otra cuenta.";
  }

  // Servidor primero (si hay sesión): así el nombre nuevo es visible
  // de inmediato para amigos, /rides y /compartir, y un rechazo real
  // (nombre ocupado, regla de 30 días del servidor) llega aquí.
  let enServidor = false;
  const tok = serverToken();
  const base = tok ? apiUrl("") : null;
  if (tok && base) {
    try {
      const r = await fetch(`${base}/api/me`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        signal: AbortSignal.timeout(15_000),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return d.error ?? "No pudimos cambiar tu usuario en el servidor.";
      enServidor = true;
    } catch {
      // sin red: seguimos con el camino local y la op queda en cola
    }
  }

  user.username = username;
  user.usernameChangedAt = new Date().toISOString();
  users[user.email] = user;
  writeJSON(USERS_KEY, users);
  if (!enServidor) void enqueueOp("profile", { username });
  return null;
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
  // Perfil → servidor: el pin y los datos de la bici también quedan
  // enlazados a la cuenta (op de última escritura gana).
  void enqueueOp("profile", patch);
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
    usernameChangedAt: u.usernameChangedAt ?? null,
    selectedPin: u.selectedPin,
    bikeBrand: u.bikeBrand,
    bikeType: u.bikeType,
    bikeModel: u.bikeModel,
    bikeSize: u.bikeSize,
    bikeColor: u.bikeColor,
    recoveryCode: u.recoveryCode ?? null,
  };
}

export function offlineMe(): MeData | null {
  const user = currentUser();
  if (!user) return null;
  ensureRecoveryCode(user); // cuentas antiguas sin código lo obtienen al abrir Perfil

  // Estadísticas y logros: solo viajes con GPS real en bici de la
  // cuenta activa (los demo, los rides en vehículo y otra cuenta no
  // se mezclan ni cuentan).
  const rides: RideSummary[] = bikeOnly(ridesForAccount(historyStore.get(), user.email));
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
    maxRideKm: Number(statsRaw.maxRideKm.toFixed(1)),
    weekendRides: statsRaw.weekendRides,
    totalHours: Number(statsRaw.totalHours.toFixed(1)),
    totalParkKm: Number(statsRaw.totalParkKm.toFixed(1)),
    lastRideDate: rides[0]?.dateISO ?? null,
    incidentCount: 0,
  };

  // Logros: los guardados + los que ya cumple con el historial local.
  // Free/Pro: sin licencia activa, los desafíos Pro no se desbloquean.
  const saved = readAchievements();
  const have = saved.map((a) => a.code);
  const earned = evaluateAchievements(statsRaw, have, { pro: isProActive() });
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