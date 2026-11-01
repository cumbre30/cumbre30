import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; username?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const username = (body.username ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
    }
    if (!/^[a-z0-9_.-]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "El usuario debe tener 3-20 caracteres (letras, números, punto, guion o guion bajo)." },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    const exists = await db.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (exists) {
      const field = exists.email === email ? "correo" : "usuario";
      return NextResponse.json({ error: `Ese ${field} ya está registrado.` }, { status: 409 });
    }

    const user = await db.user.create({
      data: { email, username, passwordHash: hashPassword(password) },
    });

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ username: user.username, email: user.email });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
    return res;
  } catch {
    return NextResponse.json({ error: "No pudimos crear tu cuenta. Intenta de nuevo." }, { status: 500 });
  }
}
