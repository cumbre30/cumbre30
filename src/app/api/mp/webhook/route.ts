// ============================================================
// POST /api/mp/webhook - webhook de Mercado Pago (camino rápido).
//
// MP avisa un pago → lo verificamos contra la API de MP (nunca
// confiamos en el body) → si es el plan Pro ($6.500 CLP aprobado)
// entregamos el código por correo (idempotente).
//
// Si algo falla (SMTP caído, etc.) respondemos 200 con el error
// registrado: el sync por polling (/api/mp/sync) es la red de
// seguridad y entregará el código pendiente más tarde.
// Configuración: download/autogestion-codigos.md
// ============================================================

import { NextResponse } from "next/server";
import { verifyAndDeliver } from "@/lib/proDeliver";

export async function POST(req: Request) {
  const url = new URL(req.url);

  // Formato nuevo (webhooks v2): { type: "payment", data: { id } }
  // Formato legacy (IPN): query ?topic=payment&id=123
  let paymentId = url.searchParams.get("id") ?? "";
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type") ?? "";
  if (!paymentId) {
    try {
      const body = (await req.json()) as { type?: string; action?: string; data?: { id?: string | number } };
      if (body?.data?.id != null) paymentId = String(body.data.id);
    } catch {
      // body vacío o no-JSON: MP a veces manda pings - responder ok.
    }
  }

  if (!paymentId || (topic && !topic.includes("payment"))) {
    return NextResponse.json({ received: true, ignored: true });
  }
  if (!process.env.MP_ACCESS_TOKEN) {
    // Sin token no podemos verificar: 200 para que MP no reintente
    // eternamente; el sync no funcionará tampoco hasta configurarlo.
    console.error("[mp/webhook] MP_ACCESS_TOKEN no configurado");
    return NextResponse.json({ received: true, configured: false });
  }

  const result = await verifyAndDeliver(paymentId, "webhook");
  if (result.ok) {
    return NextResponse.json({ received: true, delivered: true, action: result.action });
  }
  console.error(`[mp/webhook] pago ${paymentId} no entregado: ${result.error}`);
  return NextResponse.json({ received: true, delivered: false, error: result.error });
}
