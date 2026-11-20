export const dynamic = "force-dynamic";

// ============================================================
// POST /api/me/password - cambia la contraseña de la sesión actual
// (Cuenta → Gestionar). Es para quien conoce su contraseña actual;
// recuperar una perdida sigue siendo «Olvidé mi contraseña».
// Si la cuenta aún no tiene contraseña (creada vía Google), la fija
// sin pedir la actual. Al cambiar, cierra las sesiones activas en
// otros dispositivos; la sesión que hace el cambio queda viva.
// ============================================================

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const me = await getSessionUser(req);
    if (!me) return NextResponse.json({ error: "Sin sesión." }, { status: 401, headers: cors });

    const body = (await req.json()) as { passwordActual?: string; passwordNueva?: string };
    const actual = body.passwordActual ?? "";
    const nueva = body.passwordNueva ?? "";
    if (nueva.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400, headers: cors }
      );
    }

    const user = await db.user.findUnique({ where: { id: me.id }, select: { id: true, passwordHash: true } });
    if (!user) return NextResponse.json({ error: "Sin sesión." }, { status: 401, headers: cors });
    if (user.passwordHash !== "" && !verifyPassword(actual, user.passwordHash)) {
      return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400, headers: cors });
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(nueva) } });

    // La sesión que cambia la contraseña (cookie o Bearer) queda viva;
    // el resto de dispositivos se cierra con la clave vieja en la mano.
    const bearer = req.headers.get("authorization") ?? "";
    const tokenActual = bearer.toLowerCase().startsWith("bearer ")
      ? bearer.slice(7).trim()
      : (await cookies()).get(SESSION_COOKIE)?.value ?? "-";
    const borradas = await db.session.deleteMany({
      where: { userId: user.id, token: { not: tokenActual } },
    });
    return NextResponse.json({ ok: true, revocadas: borradas.count }, { headers: cors });
  } catch (e) {
    console.error("[me/password] error real:", e);
    return NextResponse.json(
      { error: "No pudimos cambiar la contraseña. Intenta de nuevo." },
      { status: 500, headers: cors }
    );
  }
}
