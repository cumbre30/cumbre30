// ============================================================
// /api/pro/send-code - respaldo manual de códigos Pro (con clave).
//
// POST { email, secret }: genera el código del correo y lo envía
// por correo. paymentId = "manual-<ts>" para la auditoría; si el
// mismo correo compra de nuevo, el código es el mismo (HMAC), así
// que reenvíos manuales son inofensivos.
// GET  ?secret=...: lista las últimas entregas (auditoría de ventas).
//
// Útil mientras el webhook/sync no esté configurado, o para
// reenviar un código a un comprador que lo perdió.
// ============================================================

// Ruta dinámica: solo el deploy web la sirve (el export del APK
// excluye /api por completo - scripts/build-apk.mjs).
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deliverCodeForPayment } from "@/lib/proDeliver";

function authorized(secret: unknown): boolean {
  const token = process.env.MP_SYNC_TOKEN;
  return Boolean(token) && secret === token;
}

export async function POST(req: Request) {
  let body: { email?: string; secret?: string };
  try {
    body = (await req.json()) as { email?: string; secret?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!authorized(body.secret)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "correo inválido" }, { status: 400 });
  }

  const result = await deliverCodeForPayment({
    paymentId: `manual-${Date.now()}`,
    email,
    amount: Number(process.env.MP_PRO_AMOUNT ?? 6500),
    via: "manual",
  });

  if (!result.ok) {
    console.error(`[pro/send-code] ${email}: ${result.error}`);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, action: result.action, code: result.code });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authorized(url.searchParams.get("secret"))) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const entregas = await db.proDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { email: true, code: true, amount: true, via: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, total: entregas.length, entregas });
}
