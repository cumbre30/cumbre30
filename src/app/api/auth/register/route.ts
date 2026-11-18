import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { corsHeaders, corsPreflight, isAppOrigin } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";

export async function OPTIONS(req: Request) {
  // Preflight del fetch cross-origin desde el APK (registro + sync).
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const body = (await req.json()) as {
      email?: string; username?: string; password?: string;
      terminos?: boolean; edad14?: boolean;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const username = (body.username ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    // Rate limit (C-01): 5 registros por minuto por IP.
    const limited = guard(req, "register", "", 5, 60_000, cors);
    if (limited) return limited;

    // Aceptación explícita de términos y política (A-01) y
    // confirmación de edad mínima de 14 años (B-05).
    if (body.terminos !== true) {
      return NextResponse.json(
        { error: "Debes aceptar los Términos y la Política de Privacidad." },
        { status: 400, headers: cors }
      );
    }
    if (body.edad14 !== true) {
      return NextResponse.json(
        { error: "Debes confirmar que tienes 14 años o más para crear una cuenta." },
        { status: 400, headers: cors }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400, headers: cors });
    }
    if (!/^[a-z0-9_.-]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "El usuario debe tener 3-20 caracteres (letras, números, punto, guion o guion bajo)." },
        { status: 400, headers: cors }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400, headers: cors });
    }

    const exists = await db.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (exists) {
      const field = exists.email === email ? "correo" : "usuario";
      return NextResponse.json({ error: `Ese ${field} ya está registrado.` }, { status: 409, headers: cors });
    }

    const user = await db.user.create({
      data: { email, username, passwordHash: hashPassword(password) },
    });

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json(
      { username: user.username, email: user.email, ...(isAppOrigin(req) ? { token } : {}) },
      { headers: cors }
    );
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
    return res;
  } catch (e) {
    console.error("[register] error real:", e);
    return NextResponse.json({ error: "No pudimos crear tu cuenta. Intenta de nuevo." }, { status: 500, headers: cors });
  }
}
