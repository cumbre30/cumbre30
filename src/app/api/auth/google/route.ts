export const dynamic = "force-dynamic";

// ============================================================
// POST /api/auth/google - sesión por token para cuentas Google del APK.
// El plugin nativo devuelve el idToken de Google Play Services; el
// servidor lo valida contra tokeninfo de Google (audiencia, correo
// verificado y vigencia) y de ahí encuentra o crea la cuenta y emite
// un token de sesión (Authorization: Bearer, igual que /api/auth/token).
// Sin SDK de Google en el servidor: la validación es la llamada
// oficial a tokeninfo, gratis y sin dependencias.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asegurarColumnasUsuario, createSession, hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { GOOGLE_WEB_CLIENT_ID } from "@/lib/googleClientId";
import { USERNAME_RE } from "@/lib/username";

type TokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
  sub?: string;
};

async function verifyIdToken(idToken: string): Promise<TokenInfo | null> {
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) return null;
    const info = (await r.json()) as TokenInfo;
    if (info.aud !== GOOGLE_WEB_CLIENT_ID) return null;
    if (String(info.email_verified).toLowerCase() !== "true") return null;
    if (!info.exp || Number(info.exp) * 1000 < Date.now()) return null;
    return info;
  } catch {
    return null;
  }
}

/** Username único a partir del correo, respetando la regla del servidor. */
function usernameFrom(email: string, taken: Set<string>): string {
  let base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 14);
  if (base.length < 3) base = `${base}0${Math.floor(Math.random() * 90 + 10)}`;
  base = base.replace(/^[-.]+/, "") || "rider";
  if (!taken.has(base) && USERNAME_RE.test(base)) return base;
  let n = 2;
  while (n < 999) {
    const c = `${base}${n}`.slice(0, 20);
    if (!taken.has(c) && USERNAME_RE.test(c)) return c;
    n++;
  }
  return `${base}${Date.now().toString(36).slice(-4)}`.slice(0, 20);
}

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const body = (await req.json()) as { idToken?: string };
    const idToken = (body.idToken ?? "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Falta el idToken de Google." }, { status: 400, headers: cors });
    }
    const info = await verifyIdToken(idToken);
    if (!info?.email) {
      return NextResponse.json(
        { error: "No pudimos validar tu cuenta de Google. Intenta de nuevo." },
        { status: 401, headers: cors }
      );
    }
    const email = info.email.trim().toLowerCase();

    // Autorreparo v1.13.17 (el SELECT/CREATE de User incluye las columnas nuevas).
    await asegurarColumnasUsuario();

    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      // Cuenta nueva: username derivado del correo, contraseña aleatoria
      // no utilizable (igual que en la cuenta offline del APK).
      const taken = new Set(
        (await db.user.findMany({ where: { username: { startsWith: email.split("@")[0].slice(0, 10) } }, select: { username: true } })).map((u) => u.username),
      );
      user = await db.user.create({
        data: { email, username: usernameFrom(email, taken), passwordHash: hashPassword(crypto.randomUUID()) },
      });
    }

    const { token, expiresAt } = await createSession(user.id);
    // La cookie de sesión habilita el flujo WEB (cumbregeo.cl): amigos,
    // /rides y /compartir con la misma sesión que el login por
    // contraseña - antes solo la cuenta Cumbre30 podía entrar en la
    // web. El APK sigue usando el token Bearer del cuerpo.
    const res = NextResponse.json(
      { token, expiresAt: expiresAt.toISOString(), email: user.email, username: user.username },
      { headers: cors }
    );
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
    return res;
  } catch {
    return NextResponse.json(
      { error: "No pudimos iniciar sesión con Google. Intenta de nuevo." },
      { status: 500, headers: cors }
    );
  }
}
