export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.

// Suscripción Web Push (Ola 2). POST guarda el endpoint del navegador
// (con userId si hay sesión: cookie web o token Bearer del APK);
// DELETE ?endpoint=... lo da de baja.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { asegurarTablaPush } from "@/lib/pushTabla";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400, headers: cors });
  }
  try {
    await asegurarTablaPush();
    // Upsert por endpoint: re-suscribir el mismo navegador renueva llaves.
    await db.$executeRawUnsafe(
      `INSERT INTO "PushSub" (id, endpoint, "p256dh", auth, "userId", "createdAt")
       VALUES (md5(random()::text || clock_timestamp()::text), $1, $2, $3, $4, now())
       ON CONFLICT (endpoint) DO UPDATE SET "p256dh" = $2, auth = $3, "userId" = $4`,
      endpoint,
      p256dh,
      auth,
      me?.id ?? null
    );
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("PUSH_NO_CONFIG")) {
      return NextResponse.json({ error: "PUSH_NO_CONFIG" }, { status: 503, headers: cors });
    }
    return NextResponse.json({ error: "No se pudo guardar la suscripción" }, { status: 500, headers: cors });
  }
}

export async function DELETE(req: Request) {
  const cors = corsHeaders(req);
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "Falta endpoint" }, { status: 400, headers: cors });
  try {
    await asegurarTablaPush();
    await db.$executeRawUnsafe(`DELETE FROM "PushSub" WHERE endpoint = $1`, endpoint);
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "No se pudo dar de baja" }, { status: 500, headers: cors });
  }
}
