import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

// ============================================================
// DELETE /api/auth/sessions - cierra TODAS las sesiones de la
// cuenta excepto la actual (C-02: dispositivo perdido). El token
// actual se conserva para no desloguear al usuario que pulsa el
// botón; el resto queda inválido de inmediato.
// ============================================================

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function DELETE(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  }
  // El token de la sesión actual llega por cookie (web) o Bearer (APK).
  const bearer = (req.headers.get("authorization") ?? "").slice(7).trim();
  const current =
    bearer ||
    (await (async () => {
      const { cookies } = await import("next/headers");
      const jar = await cookies();
      return jar.get(SESSION_COOKIE)?.value ?? "";
    })());
  const result = await db.session.deleteMany({
    where: { userId: me.id, token: { not: current } },
  });
  return NextResponse.json({ ok: true, revocadas: result.count }, { headers: cors });
}
