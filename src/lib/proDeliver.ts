// ============================================================
// Cumbre30 Pro - auto-entrega de códigos (web desplegada).
//
// Flujo: Mercado Pago avisa un pago aprobado de $6.500 CLP →
// verificamos el pago CONTRA LA API DE MP (nunca confiamos en el
// body del webhook) → generamos el código HMAC del correo del
// comprador → enviamos el correo con Gmail SMTP → dejamos registro
// en ProDelivery (paymentId único = idempotencia, nunca dos códigos
// por el mismo pago).
//
// Variables de entorno (ver download/autogestion-codigos.md):
//   MP_ACCESS_TOKEN     token de producción de Mercado Pago
//   GMAIL_USER          contacto.cumbre30@gmail.com
//   GMAIL_APP_PASSWORD  contraseña de aplicación de Google (16 chars)
//   MP_PRO_AMOUNT       monto del plan Pro en CLP (default 6500)
// ============================================================

import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/proLicenseCore";
import { generateCurrentProLicenseCode } from "@/lib/proLicenseServer";

export interface MpPayment {
  id: number | string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  description?: string;
  external_reference?: string | null;
  payer?: { email?: string };
}

function proAmount(): number {
  return Number(process.env.MP_PRO_AMOUNT ?? 6500);
}

/** ¿Este pago de MP corresponde al plan Pro ($6.500 CLP aprobado)? */
export function isProPayment(p: MpPayment): boolean {
  if (p.status !== "approved") return false;
  if ((p.currency_id ?? "").toUpperCase() !== "CLP") return false;
  if (Number(p.transaction_amount) !== proAmount()) return false;
  // El enlace de aporte voluntario comparte cuenta: si el título del
  // link menciona "aporte", nunca es una venta Pro.
  if ((p.description ?? "").toLowerCase().includes("aporte")) return false;
  return true;
}

/** Trae el pago real desde la API de MP (fuente de verdad). */
export async function fetchPaymentFromMp(paymentId: string): Promise<MpPayment | null> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as MpPayment;
}

/** Pagos aprobados recientes (ventana de horas) para el sync por polling. */
export async function fetchRecentApprovedPayments(hours = 48): Promise<MpPayment[]> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return [];
  const begin = `NOW-${hours}HOUR`;
  const url =
    "https://api.mercadopago.com/v1/payments/search" +
    `?sort=date_desc&criteria=desc&range=date_created&begin_date=${encodeURIComponent(begin)}&limit=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: MpPayment[] };
  return data.results ?? [];
}

// --- Correo ---------------------------------------------------

function smtpConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function transporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER as string,
      pass: (process.env.GMAIL_APP_PASSWORD as string).replace(/\s+/g, ""),
    },
  });
}

/** Envío genérico (reusado por auth/forgot para los códigos de
 *  restablecimiento): true si salió, false si SMTP no está
 *  configurado o falló — el llamador decide el fallback. */
export async function enviarCorreo(opts: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  if (!smtpConfigured()) return false;
  try {
    await transporter().sendMail({
      from: `"Cumbre30" <${process.env.GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: process.env.GMAIL_USER,
    });
    return true;
  } catch (e) {
    console.error("[correo] error de envío:", e instanceof Error ? e.message : e);
    return false;
  }
}

export function licenseEmailHtml(email: string, code: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#241A11">
    <p style="text-align:center;letter-spacing:.35em;font-weight:900;margin:24px 0 2px">CUMBRE<span style="font-weight:300">GEO</span></p>
    <h1 style="text-align:center;font-size:22px;margin:16px 0 6px">Tu código Cumbre30 Pro 🚴</h1>
    <p style="text-align:center;font-size:14px;color:#5a5248">¡Gracias por apoyar Cumbre30, tu ciclocomputador de apoyo al ciclista!</p>
    <div style="background:#F2EAD9;border:1.5px solid #35B85F;border-radius:14px;padding:18px;text-align:center;margin:20px 0">
      <p style="margin:0;font-size:12px;color:#8A6A4F;text-transform:uppercase;letter-spacing:.2em">Código · pago único · para siempre</p>
      <p style="margin:10px 0 0;font-size:24px;font-weight:900;letter-spacing:.08em;font-family:'Courier New',monospace">${code}</p>
    </div>
    <p style="font-size:14px"><b>Para activarlo:</b></p>
    <ol style="font-size:14px;padding-left:20px;line-height:1.7">
      <li>Abre <b>Cumbre30</b></li>
      <li><b>Perfil → Pagos y suscripciones</b></li>
      <li>Activa <b>"Habilitar modo Pro"</b></li>
      <li>Ingresa tu correo <b>${email}</b> y el código de arriba</li>
    </ol>
    <p style="font-size:12.5px;color:#5a5248;line-height:1.6">El código está ligado a este correo. Si cambias de teléfono, quita la licencia desde el teléfono antiguo (Pagos y suscripciones → Quitar licencia) y actívala en el nuevo con el mismo correo.</p>
    <p style="font-size:12.5px;color:#5a5248">¿Dudas? Responde este correo.<br/>- Cumbre GEO · App independiente de apoyo al ciclista</p>
  </div>`;
}

export function licenseEmailText(email: string, code: string): string {
  return [
    "¡Gracias por apoyar Cumbre30!",
    "",
    "Tu código Pro (pago único, para siempre):",
    code,
    "",
    "Para activarlo:",
    "1. Abre Cumbre30",
    "2. Perfil → Pagos y suscripciones",
    '3. Activa "Habilitar modo Pro"',
    `4. Ingresa tu correo (${email}) y el código de arriba`,
    "",
    "El código está ligado a este correo. Si cambias de teléfono,",
    "quita la licencia desde el antiguo y actívala en el nuevo.",
    "",
    "- Cumbre GEO",
  ].join("\n");
}

async function sendLicenseEmail(email: string, code: string): Promise<void> {
  if (!smtpConfigured()) {
    throw new Error(
      "SMTP sin configurar: define GMAIL_USER y GMAIL_APP_PASSWORD (ver download/autogestion-codigos.md).",
    );
  }
  await transporter().sendMail({
    from: `"Cumbre30" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Tu código Cumbre30 Pro 🚴",
    text: licenseEmailText(email, code),
    html: licenseEmailHtml(email, code),
    replyTo: process.env.GMAIL_USER,
  });
}

// --- Entrega con idempotencia ---------------------------------

export type DeliverResult =
  | { ok: true; action: "sent" | "already"; code: string }
  | { ok: false; error: string };

/**
 * Entrega el código para un pago ya VERIFICADO. Idempotente: si el
 * paymentId ya tiene registro, devuelve "already" sin reenviar correo.
 * Graba el registro SOLO después de un envío exitoso (si el correo
 * falla, el sync lo reintenta más tarde).
 */
export async function deliverCodeForPayment(params: {
  paymentId: string;
  email: string;
  amount: number;
  via: "webhook" | "sync" | "manual";
}): Promise<DeliverResult> {
  const email = normalizeEmail(params.email);
  const existing = await db.proDelivery.findUnique({ where: { paymentId: params.paymentId } });
  if (existing) {
    return { ok: true, action: "already", code: existing.code };
  }
  // Códigos nuevos bajo el secreto vigente del servidor (B-03).
  const code = await generateCurrentProLicenseCode(email);
  try {
    await sendLicenseEmail(email, code);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fallo de envío" };
  }
  await db.proDelivery.create({
    data: {
      paymentId: params.paymentId,
      email,
      code,
      amount: params.amount,
      via: params.via,
    },
  });
  return { ok: true, action: "sent", code };
}

/** Verifica un id de pago contra MP y entrega si es el plan Pro. */
export async function verifyAndDeliver(
  paymentId: string,
  via: "webhook" | "sync" | "manual",
): Promise<DeliverResult> {
  const payment = await fetchPaymentFromMp(paymentId);
  if (!payment) return { ok: false, error: "pago no encontrado en Mercado Pago (revisa MP_ACCESS_TOKEN)" };
  if (!isProPayment(payment)) return { ok: false, error: "el pago no corresponde al plan Pro" };
  const email = payment.payer?.email ?? payment.external_reference ?? "";
  if (!email) return { ok: false, error: "el pago no tiene correo del pagador" };
  return deliverCodeForPayment({
    paymentId: String(payment.id),
    email,
    amount: Math.round(Number(payment.transaction_amount) || proAmount()),
    via,
  });
}
