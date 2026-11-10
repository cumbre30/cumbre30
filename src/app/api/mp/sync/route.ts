// ============================================================
// GET|POST /api/mp/sync - polling de pagos (red de seguridad).
//
// Consulta los pagos aprobados de las últimas 48 h en la API de
// Mercado Pago y entrega el código de los que aún no tengan
// registro en ProDelivery (idempotente). Cubre webhooks perdidos
// o fallas de SMTP transitorias.
//
// Protegido por token: Authorization: Bearer MP_SYNC_TOKEN o
// ?token=MP_SYNC_TOKEN. Pensado para un cron externo gratuito
// (cron-job.org) o Vercel Cron cada 10-15 minutos.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchRecentApprovedPayments, isProPayment, deliverCodeForPayment } from "@/lib/proDeliver";

function authorized(req: Request): boolean {
  const token = process.env.MP_SYNC_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${token}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("token") === token;
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!process.env.MP_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "MP_ACCESS_TOKEN no configurado", hint: "ver download/autogestion-codigos.md" },
      { status: 503 },
    );
  }

  const payments = await fetchRecentApprovedPayments(48);
  const pro = payments.filter(isProPayment);
  const summary: { paymentId: string; email: string; action: string }[] = [];
  let delivered = 0;
  let failed = 0;

  for (const p of pro) {
    const email = p.payer?.email ?? p.external_reference ?? "";
    if (!email) {
      failed += 1;
      continue;
    }
    const result = await deliverCodeForPayment({
      paymentId: String(p.id),
      email,
      amount: Math.round(Number(p.transaction_amount) || 0),
      via: "sync",
    });
    if (result.ok) {
      if (result.action === "sent") delivered += 1;
      summary.push({ paymentId: String(p.id), email, action: result.action });
    } else {
      failed += 1;
      console.error(`[mp/sync] pago ${p.id} falló: ${result.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    revisados: payments.length,
    proEncontrados: pro.length,
    enviados: delivered,
    fallos: failed,
    detalle: summary,
  });
}
