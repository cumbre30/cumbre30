import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { hashPassword, RESET_MAX_ATTEMPTS } from "@/lib/auth";

// ============================================================
// POST /api/auth/reset - cambia la contraseña con el código
// entregado por soporte. Al éxito invalida el código y cierra
// todas las sesiones activas de la cuenta (seguridad).
// ============================================================

function sameCode(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; code?: string; newPassword?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const code = (body.code ?? "").replace(/\D/g, "");
    const newPassword = body.newPassword ?? "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
    }
    if (code.length !== 6) {
      return NextResponse.json({ error: "El código tiene 6 dígitos." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Código inválido o expirado. Solicita uno nuevo." }, { status: 400 });
    }

    const reset = await db.passwordReset.findFirst({
      where: { email, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!reset) {
      return NextResponse.json({ error: "El código expiró. Solicita uno nuevo." }, { status: 400 });
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
        { status: 400 }
      );
    }

    await db.$transaction([
      db.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
      db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } }),
      // Cierra todas las sesiones activas: la cuenta pudo estar comprometida.
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset] error real:", e);
    return NextResponse.json({ error: "No pudimos restablecer la contraseña. Intenta de nuevo." }, { status: 500 });
  }
}
