import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import {
  asegurarColumnasUsuario,
  createSession,
  hashPassword,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  RESET_MAX_ATTEMPTS,
} from "@/lib/auth";
import { corsHeaders, corsPreflight, isAppOrigin } from "@/lib/apiCors";

// ============================================================
// POST /api/auth/reset - cambia la contraseña con el código de 6
// dígitos enviado al correo registrado: flujo «Olvidé mi
// contraseña» y también «Crea tu contraseña» para cuentas nacidas
// en Google que aún no tienen una. Al éxito invalida el código,
// cierra todas las sesiones activas (seguridad) y DEJA LA SESIÓN
// INICIADA con una nueva: los dos flujos terminan dentro de la
// app sin volver a escribir la contraseña (web: cookie · APK:
// token en el cuerpo).
// ============================================================

function sameCode(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const body = (await req.json()) as { email?: string; code?: string; newPassword?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const code = (body.code ?? "").replace(/\D/g, "");
    const newPassword = body.newPassword ?? "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400, headers: cors });
    }
    if (code.length !== 6) {
      return NextResponse.json({ error: "El código tiene 6 dígitos." }, { status: 400, headers: cors });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400, headers: cors });
    }

    // Autorreparo v1.13.17 (el SELECT/UPDATE de User incluye las columnas nuevas).
    await asegurarColumnasUsuario();

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Código inválido o expirado. Solicita uno nuevo." }, { status: 400, headers: cors });
    }

    const reset = await db.passwordReset.findFirst({
      where: { email, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!reset) {
      return NextResponse.json({ error: "El código expiró. Solicita uno nuevo." }, { status: 400, headers: cors });
    }

    if (!sameCode(reset.code, code)) {
      const attempts = reset.attempts + 1;
      const dead = attempts >= RESET_MAX_ATTEMPTS;
      await db.passwordReset.update({
        where: { id: reset.id },
        data: { attempts, used: dead }, // 5 intentos fallidos invalidan el código
      });
      return NextResponse.json(
        {
          error: dead
            ? "Código incorrecto (5 intentos). Solicita uno nuevo."
            : `Código incorrecto. Quedan ${RESET_MAX_ATTEMPTS - attempts} intentos.`,
        },
        { status: 400, headers: cors }
      );
    }

    await db.$transaction([
      db.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
      db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } }),
      // Cierra todas las sesiones activas: la cuenta pudo estar comprometida.
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);

    // Sesión recién creada DESPUÉS de cerrar las viejas: el flujo
    // termina con la cuenta abierta (mismo patrón que login/register).
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json(
      {
        ok: true,
        email: user.email,
        username: user.username,
        ...(isAppOrigin(req) ? { token, expiresAt: expiresAt.toISOString() } : {}),
      },
      { headers: cors }
    );
    res.cookies.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });
    return res;
  } catch (e) {
    console.error("[reset] error real:", e);
    return NextResponse.json({ error: "No pudimos restablecer la contraseña. Intenta de nuevo." }, { status: 500, headers: cors });
  }
}
