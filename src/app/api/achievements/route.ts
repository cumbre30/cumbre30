// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.
export const dynamic = "force-static";


import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ACHIEVEMENT_BY_CODE } from "@/lib/pins";

/** Registra un logro desbloqueado en el cliente (el cliente evalúa los criterios). */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const body = (await req.json()) as { code?: string };
  const code = body.code ?? "";
  if (!ACHIEVEMENT_BY_CODE[code]) return NextResponse.json({ error: "Logro desconocido." }, { status: 400 });
  const row = await db.achievement.upsert({
    where: { userId_code: { userId: me.id, code } },
    create: { userId: me.id, code },
    update: {},
  });
  return NextResponse.json({ ok: true, unlockedAt: row.unlockedAt.toISOString() });
}
