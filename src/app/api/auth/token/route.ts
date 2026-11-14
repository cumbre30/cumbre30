export const dynamic = "force-dynamic";

// ============================================================
// POST /api/auth/token — sesión por TOKEN para el APK.
// El WebView de Capacitor es cross-origin y las cookies third-party
// no son confiables (SameSite/ITP), así que el sync de progreso del
// APK autentica con Authorization: Bearer <token>. Mismo mecanismo de
// credenciales que /api/auth/login (scrypt), misma tabla Session.
// No setea cookie: el token viaja en el cuerpo y el app lo guarda
// en su almacenamiento local.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401, headers: cors }
      );
    }

    const { token, expiresAt } = await createSession(user.id);
    return NextResponse.json(
      {
        token,
        expiresAt: expiresAt.toISOString(),
        email: user.email,
        username: user.username,
      },
      { headers: cors }
    );
  } catch {
    return NextResponse.json(
      { error: "No pudimos iniciar sesión. Intenta de nuevo." },
      { status: 500, headers: cors }
    );
  }
}
