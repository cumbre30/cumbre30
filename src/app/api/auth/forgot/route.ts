import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { asegurarColumnasUsuario, RESET_TTL_MIN } from "@/lib/auth";
import { guard } from "@/lib/rateLimit";
import { enviarCorreo } from "@/lib/proDeliver";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

// El APK consume esta ruta cruzando origen (webview https://localhost →
// cumbregeo.cl): sin CORS el paso «Olvidé mi contraseña» del app muere
// en preflight y solo quedaba el código de recuperación local.
export function OPTIONS(req: Request) {
  return corsPreflight(req);
}

// ============================================================
// POST /api/auth/forgot - solicita un código de restablecimiento.
// Crea un código de 6 dígitos vigente 30 minutos y lo ENVÍA AL
// CORREO REGISTRADO (Gmail SMTP, el mismo transporte del Pro).
// El código nunca viaja en la respuesta. Si el envío falla, el
// código queda en el log del server y soporte lo entrega a mano
// (flujo anterior). Siempre responde ok para no revelar qué
// correos existen.
// ============================================================

function resetEmailHtml(code: string, minutos: number): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#241A11">
    <p style="text-align:center;letter-spacing:.35em;font-weight:900;margin:24px 0 2px">CUMBRE<span style="font-weight:300">GEO</span></p>
    <h1 style="text-align:center;font-size:22px;margin:16px 0 6px">Restablece tu contraseña</h1>
    <p style="text-align:center;font-size:14px;color:#5a5248">Recibimos una solicitud para definir una nueva contraseña en tu cuenta Cumbre30.</p>
    <div style="background:#F2EAD9;border:1.5px solid #35B85F;border-radius:14px;padding:18px;text-align:center;margin:20px 0">
      <p style="margin:0;font-size:12px;color:#8A6A4F;text-transform:uppercase;letter-spacing:.2em">Tu código · vence en ${minutos} minutos</p>
      <p style="margin:10px 0 0;font-size:28px;font-weight:900;letter-spacing:.12em;font-family:'Courier New',monospace">${code}</p>
    </div>
    <p style="font-size:14px">Ingresa este código en la app junto a tu nueva contraseña (mínimo 8 caracteres).</p>
    <p style="font-size:12.5px;color:#5a5248;line-height:1.6">¿No fuiste tú? Ignora este correo: tu contraseña sigue igual y nadie más puede usar el código sin leer este mensaje.</p>
    <p style="font-size:12.5px;color:#5a5248">- Cumbre GEO · App independiente de apoyo al ciclista</p>
  </div>`;
}

function resetEmailText(code: string, minutos: number): string {
  return [
    "Restablece tu contraseña de Cumbre30",
    "",
    `Tu código (vence en ${minutos} minutos): ${code}`,
    "",
    "Ingresa este código en la app junto a tu nueva contraseña (mínimo 8 caracteres).",
    "¿No fuiste tú? Ignora este correo: tu contraseña sigue igual.",
    "",
    "- Cumbre GEO",
  ].join("\n");
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    // Rate limit (C-01): 3 solicitudes por 10 minutos por IP.
    const limited = guard(req, "forgot", "", 3, 10 * 60_000, cors);
    if (limited) return limited;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400, headers: cors });
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
      // Entrega por correo al registro de la cuenta; el log del server
      // queda como respaldo si el envío falla.
      const enviado = await enviarCorreo({
        to: email,
        subject: "Tu código para restablecer la contraseña de Cumbre30",
        text: resetEmailText(code, RESET_TTL_MIN),
        html: resetEmailHtml(code, RESET_TTL_MIN),
      });
      console.log(`[forgot] código para ${email}: ${code} (vence en ${RESET_TTL_MIN} min) · enviado por correo: ${enviado ? "sí" : "NO (fallback soporte)"}`);
    }

    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("[forgot] error real:", e);
    return NextResponse.json({ error: "No pudimos registrar la solicitud. Intenta de nuevo." }, { status: 500, headers: cors });
  }
}
