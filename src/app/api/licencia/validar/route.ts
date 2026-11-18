import { NextResponse } from "next/server";
import { validateAnyProLicenseCode } from "@/lib/proLicenseServer";
import { guard } from "@/lib/rateLimit";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

// ============================================================
// POST /api/licencia/validar - validación server-side de códigos
// Cumbre30 Pro (B-03/R-03): acepta códigos legados y vigentes
// sin que el APK contenga el secreto vigente. La app la consulta
// al activar un código; si no hay red, cae a la validación offline
// del secreto legado (grandfathering).
// Rate limit (C-01): 10 validaciones por minuto por IP para que
// la ruta no sirva de oráculo de fuerza bruta.
// ============================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const limited = guard(req, "licencia-validar", "", 10, 60_000, cors);
  if (limited) return limited;
  try {
    const body = (await req.json()) as { email?: string; code?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const code = (body.code ?? "").trim();
    if (!email || !code) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400, headers: cors });
    }
    const valid = await validateAnyProLicenseCode(email, code);
    // El email devuelto es el normalizado, para que el cliente
    // guarde exactamente la identidad con la que se validó.
    return NextResponse.json({ valid, email }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "No se pudo validar" }, { status: 500, headers: cors });
  }
}
