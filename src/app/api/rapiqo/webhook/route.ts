// ============================================================
// POST /api/rapiqo/webhook - webhook de Mercado Pago (RAPIQO).
//
// Igual que /api/mp/webhook (Cumbre30 Pro) pero para la aplicación
// de Mercado Pago de RAPIQO: MP avisa un pago → lo verificamos
// contra la API de MP con RAPIQO_ACCESS_TOKEN (nunca confiamos en
// el body) → si es la licencia PRO ($14.990 CLP aprobado)
// entregamos la clave RQ1 por correo (idempotente, ver
// src/lib/rapiqoDeliver.ts y download/instrucciones-despliegue-
// rapiqo.md §7).
//
// Sin RAPIQO_SIGNING_ENABLED=1 el pago se registra y se avisa al
// comprador que la clave llega a la brevedad (emisión manual).
// Si algo falla respondemos 200 con el error registrado: MP no
// debe reintentar eternamente; la emisión pendiente queda en la
// tabla rapiqo_delivery vía reintento manual/sync.
// ============================================================

import { NextResponse } from "next/server";
import { verifyAndDeliverRapiqo } from "@/lib/rapiqoDeliver";

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
  if (!process.env.RAPIQO_ACCESS_TOKEN) {
    // Sin token no podemos verificar: 200 para que MP no reintente
    // eternamente; la entrega quedará pendiente hasta configurarlo.
    console.error("[rapiqo/webhook] RAPIQO_ACCESS_TOKEN no configurado");
    return NextResponse.json({ received: true, configured: false });
  }

  const result = await verifyAndDeliverRapiqo(paymentId, "webhook");
  if (result.ok) {
    return NextResponse.json({ received: true, delivered: true, action: result.action });
  }
  console.error(`[rapiqo/webhook] pago ${paymentId} no entregado: ${result.error}`);
  return NextResponse.json({ received: true, delivered: false, error: result.error });
}
