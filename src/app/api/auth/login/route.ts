import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { normalizeCodes } from "@/lib/pins";
import { corsHeaders, isAppOrigin } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";

// CORS para la app Android (APK): el WebView sirve la app desde
// https://localhost, así que su llamada al servidor de la web es
// cross-origin. Solo aceptamos los orígenes de Capacitor; el sitio
// web (cumbregeo.cl) es same-origin y no necesita nada de esto.
function corsFor(req: Request): Record<string, string> {
  return corsHeaders(req);
}

export async function OPTIONS(req: Request) {
  // Preflight del fetch cross-origin desde la APK.
  return new NextResponse(null, { status: 204, headers: corsFor(req) });
}

export async function POST(req: Request) {
  const cors = corsFor(req);
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    // Rate limit (C-01): 5 intentos por minuto por IP y correo,
    // con mensaje genérico para no revelar información de la cuenta.
    const limited = guard(req, "login", email, 5, 60_000, cors);
    if (limited) return limited;

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401, headers: cors }
      );
    }

    const { token, expiresAt } = await createSession(user.id);
    // Con la sesión devolvemos también el perfil y los logros: la app
    // Android usa estos datos para importar la cuenta web al teléfono.
    // Para el APK incluimos además el token en el cuerpo (la cookie
    // httpOnly no sirve cross-origin en el WebView): con él, el sync
    // de progreso viaja por Authorization: Bearer.
    const achievements = await db.achievement.findMany({
      where: { userId: user.id },
      select: { code: true },
    });
    const res = NextResponse.json(
      {
        username: user.username,
        email: user.email,
        ...(isAppOrigin(req) ? { token } : {}),
        selectedPin: user.selectedPin,
        bikeBrand: user.bikeBrand,
        bikeType: user.bikeType,
        bikeModel: user.bikeModel,
        bikeSize: user.bikeSize,
        bikeColor: user.bikeColor,
        // normalizeCodes devuelve un Set: se serializa como array explícito.
        achievements: [...normalizeCodes(achievements.map((a) => a.code))],
      },
      { headers: cors }
    );
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
    return res;
  } catch (e) {
    console.error("[login] error real:", e);
    return NextResponse.json(
      { error: "No pudimos iniciar sesión. Intenta de nuevo." },
      { status: 500, headers: cors }
    );
  }
}
