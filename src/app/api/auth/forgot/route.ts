import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { asegurarColumnasUsuario, RESET_TTL_MIN } from "@/lib/auth";
import { guard } from "@/lib/rateLimit";

// ============================================================
// POST /api/auth/forgot - solicita un código de restablecimiento.
// Crea un código de 6 dígitos vigente 30 minutos. El código NO
// viaja en la respuesta (no hay SMTP): lo entrega soporte por
// WhatsApp/correo tras verificar la identidad del ciclista.
// Siempre responde ok para no revelar qué correos existen.
// ============================================================

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    // Rate limit (C-01): 3 solicitudes por 10 minutos por IP.
    const limited = guard(req, "forgot", "", 3, 10 * 60_000);
    if (limited) return limited;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
    }

    // Autorreparo v1.13.17 (el SELECT de User incluye las columnas nuevas).
    await asegurarColumnasUsuario();

    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      // Un solo código activo por correo: invalida solicitudes anteriores.
      await db.passwordReset.updateMany({
        where: { email, used: false },
        data: { used: true },
      });
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);
      await db.passwordReset.create({ data: { email, code, expiresAt } });
      // Registro para el operador del server (así entrega el código por soporte).
      console.log(`[forgot] código de restablecimiento para ${email}: ${code} (vence en ${RESET_TTL_MIN} min)`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[forgot] error real:", e);
    return NextResponse.json({ error: "No pudimos registrar la solicitud. Intenta de nuevo." }, { status: 500 });
  }
}
