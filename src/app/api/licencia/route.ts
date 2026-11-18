// ============================================================
// GET /api/licencia?email=... (cabecera x-admin-key o ?k=ADMIN_KEY)
// Genera el código de licencia Cumbre30 Pro para un correo.
// Solo el dueño del proyecto (con ADMIN_KEY en .env) puede
// generar códigos. Esta ruta NO viaja en el export estático del
// APK (export-web.sh saca src/app/api), así que ADMIN_KEY nunca
// llega al teléfono del usuario. C-04: comparación timing-safe y
// clave preferente por cabecera. B-03: usa el secreto vigente del
// servidor (proLicenseServer.ts), no el legado del APK.
// ============================================================

import { NextRequest } from "next/server";
import { generateCurrentProLicenseCode } from "@/lib/proLicenseServer";
import { adminKeysEqual } from "@/lib/adminKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k") ?? "";
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const adminKey = process.env.ADMIN_KEY ?? "";
  const headerKey = req.headers.get("x-admin-key") ?? "";

  // Cabecera primero (no queda en logs de acceso); query como
  // compatibilidad con los scripts existentes.
  if (!adminKey || !(adminKeysEqual(headerKey, adminKey) || adminKeysEqual(k, adminKey))) {
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

  const code = await generateCurrentProLicenseCode(email);
  return new Response(JSON.stringify({ email, code }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
