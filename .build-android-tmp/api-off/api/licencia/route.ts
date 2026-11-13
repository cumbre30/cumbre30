// ============================================================
// GET /api/licencia?email=...&k=ADMIN_KEY
// Genera el código de licencia Cumbre30 Pro para un correo.
// Solo el dueño del proyecto (con ADMIN_KEY en .env) puede
// generar códigos. Esta ruta NO viaja en el export estático del
// APK (export-web.sh saca src/app/api), así que ADMIN_KEY nunca
// llega al teléfono del usuario.
// ============================================================

import { NextRequest } from "next/server";
import { generateProLicenseCode } from "@/lib/proLicenseCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k") ?? "";
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const adminKey = process.env.ADMIN_KEY ?? "";

  if (!adminKey || k !== adminKey) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "Correo inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const code = await generateProLicenseCode(email);
  return new Response(JSON.stringify({ email, code }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
