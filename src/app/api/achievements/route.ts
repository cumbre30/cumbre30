export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.



import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ACHIEVEMENT_BY_CODE } from "@/lib/pins";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  // Preflight del fetch cross-origin desde el APK (sync con Bearer).
  return corsPreflight(req);
}

/** Registra un logro desbloqueado en el cliente (el cliente evalúa los criterios). */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const body = (await req.json()) as { code?: string };
  const code = body.code ?? "";
  if (!ACHIEVEMENT_BY_CODE[code]) {
    return NextResponse.json({ error: "Logro desconocido." }, { status: 400, headers: cors });
  }
  const row = await db.achievement.upsert({
    where: { userId_code: { userId: me.id, code } },
    create: { userId: me.id, code },
    update: {},
  });
  return NextResponse.json({ ok: true, unlockedAt: row.unlockedAt.toISOString() }, { headers: cors });
}
