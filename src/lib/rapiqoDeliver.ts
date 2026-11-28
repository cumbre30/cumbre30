// ============================================================
// RAPIQO - auto-entrega de licencias RQ1 (web desplegada).
//
// Flujo: Mercado Pago (aplicación RAPIQO, aparte de la de
// Cumbre30) avisa un pago aprobado → verificamos el pago CONTRA
// LA API DE MP con RAPIQO_ACCESS_TOKEN (nunca confiamos en el
// body) → si es el pago único de RAPIQO ($14.990 CLP aprobado)
// firmamos la licencia RQ1 y la enviamos por correo → dejamos
// registro en RapiqoDelivery (paymentId único = idempotencia,
// nunca dos licencias por el mismo pago).
//
// Formato de la licencia: el EXACTO que verifica el dist 2.9.0 —
//   RQ1.<payload b64url>.<sig b64url>
//   payload = { t:'rapiqo-pro', id, n, e }   (e null = perpetual)
//   firma   = ECDSA P-256 SHA-256 sobre los bytes JSON del
//             payload, en r||s crudo (ieee-p1363); el bundle
//             verifica con WebCrypto (subtle.verify, spki).
//   Probado con scripts/rapiqo-license-autotest.mjs (9/9 PASS).
//
// Guard de emisión:
//   RAPIQO_SIGNING_ENABLED=1 → firma y envía la clave al instante.
//   Sin esa variable (hasta recompilar la app con la pública de
//   producción) → registra el pago y avisa al comprador que la
//   clave llega a la brevedad (emisión manual): el dist 2.9.0
//   verifica con la pública del par DEMO, y una clave firmada con
//   el par de producción sería rechazada por esa versión.
//
// Variables: RAPIQO_ACCESS_TOKEN · RAPIQO_AMOUNT (default 14990) ·
//   RAPIQO_LICENSE_PRIVATE_KEY (PEM, solo server-side — jamás en
//   el repo ni en el bundle) · GMAIL_USER · GMAIL_APP_PASSWORD.
// ============================================================

import nodemailer from "nodemailer";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/proLicenseCore";

export interface MpPayment {
  id: number | string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  description?: string;
  external_reference?: string | null;
  payer?: { email?: string };
}

function rapiqoAmount(): number {
  return Number(process.env.RAPIQO_AMOUNT ?? 14990);
}

/** ¿Este pago de MP corresponde a la licencia RAPIQO (aprobado)? */
export function isRapiqoPayment(p: MpPayment): boolean {
  if (p.status !== "approved") return false;
  if ((p.currency_id ?? "").toUpperCase() !== "CLP") return false;
  if (Number(p.transaction_amount) !== rapiqoAmount()) return false;
  // Defensa extra (mismo criterio que el flujo Pro): un aporte
  // voluntario que comparta cuenta nunca es una venta.
  if ((p.description ?? "").toLowerCase().includes("aporte")) return false;
  return true;
}

/** Trae el pago real desde la API de MP (fuente de verdad). */
export async function fetchRapiqoPayment(paymentId: string): Promise<MpPayment | null> {
  const token = process.env.RAPIQO_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as MpPayment;
}

// --- Firma de licencias (formato del dist 2.9.0) ---

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Firma una licencia RQ1: perpetual (e=null) o con días de novedades. */
export function signRapiqoLicense(opts: { id: string; name?: string; days?: number | null }): string {
  const pem = process.env.RAPIQO_LICENSE_PRIVATE_KEY;
  if (!pem) throw new Error("RAPIQO_LICENSE_PRIVATE_KEY no configurada");
  const key = crypto.createPrivateKey(pem);
  const payload = {
    t: "rapiqo-pro",
    id: opts.id,
    n: opts.name ?? "",
    e: opts.days ? Date.now() + opts.days * 86400000 : null,
  };
  const json = JSON.stringify(payload);
  const body = b64url(Buffer.from(json));
  const sig = crypto.sign("sha256", Buffer.from(json), { key, dsaEncoding: "ieee-p1363" });
  return `RQ1.${body}.${b64url(sig)}`;
}

// --- Correo (reutiliza el SMTP de Gmail del sitio) ---

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

function brandFrom() {
  return `"CumbreGeo" <${process.env.GMAIL_USER}>`;
}

const SHELL_HEAD = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#24312d">
  <p style="text-align:center;letter-spacing:.35em;font-weight:900;margin:24px 0 2px">CUMBRE<span style="font-weight:300">GEO</span></p>`;

export function rapiqoLicenseEmailHtml(email: string, license: string): string {
  return `${SHELL_HEAD}
  <h1 style="text-align:center;font-size:22px;margin:16px 0 6px">Tu licencia RAPIQO PRO</h1>
  <p style="text-align:center;font-size:14px;color:#5a6b64">¡Gracias por apoyar CumbreDocs, la línea de documentos de CumbreGeo!</p>
  <div style="background:#F0EDE6;border:1.5px solid #5A8F57;border-radius:14px;padding:18px;text-align:center;margin:20px 0">
    <p style="margin:0;font-size:12px;color:#6d7c76;text-transform:uppercase;letter-spacing:.2em">Clave de licencia · pago único</p>
    <p style="margin:10px 4px 0;font-size:13px;font-weight:700;word-break:break-all;font-family:'Courier New',monospace;color:#14453d">${license}</p>
  </div>
  <p style="font-size:14px"><b>Para activarla</b> (sin conexión):</p>
  <ol style="font-size:14px;padding-left:20px;line-height:1.7">
    <li>Abre <b>rapiqo.cumbregeo.cl</b></li>
    <li>Entra a <b>Ajustes → Licencia</b></li>
    <li>Pega tu clave (empieza por <b>RQ1.</b>) y activa</li>
  </ol>
  <p style="font-size:12.5px;color:#5a6b64;line-height:1.6">La clave es perpetual: la versión PRO queda activada para siempre, y la activación es offline — tus documentos nunca salen de tu navegador.</p>
  <p style="font-size:12.5px;color:#5a6b64">¿Dudas? Responde este correo.<br/>- Cumbre GEO · Línea CumbreDocs</p>
</div>`;
}

export function rapiqoLicenseEmailText(email: string, license: string): string {
  return [
    "¡Gracias por apoyar CumbreDocs, la línea de documentos de CumbreGeo!",
    "",
    "Tu clave de licencia RAPIQO PRO (pago único):",
    license,
    "",
    "Para activarla (sin conexión):",
    "1. Abre rapiqo.cumbregeo.cl",
    "2. Entra a Ajustes → Licencia",
    "3. Pega tu clave (empieza por RQ1.) y activa",
    "",
    "La clave es perpetual: la versión PRO queda activada para siempre.",
    "",
    "- Cumbre GEO · Línea CumbreDocs",
  ].join("\n");
}

function noticeEmailHtml(email: string): string {
  return `${SHELL_HEAD}
  <h1 style="text-align:center;font-size:22px;margin:16px 0 6px">Recibimos tu pago de RAPIQO PRO</h1>
  <p style="text-align:center;font-size:14px;color:#5a6b64">¡Gracias por apoyar CumbreDocs, la línea de documentos de CumbreGeo!</p>
  <div style="background:#F0EDE6;border:1.5px solid #5A8F57;border-radius:14px;padding:18px;text-align:center;margin:20px 0">
    <p style="margin:0;font-size:12px;color:#6d7c76;text-transform:uppercase;letter-spacing:.2em">Pago confirmado · $14.990 CLP</p>
    <p style="margin:10px 0 0;font-size:14px;color:#24312d">Tu clave de licencia llega a este correo a la brevedad.</p>
  </div>
  <p style="font-size:13px;color:#5a6b64;line-height:1.7">Cuando la recibas, actívala en <b>rapiqo.cumbregeo.cl</b> → <b>Ajustes → Licencia</b> (pega la clave que empieza por <b>RQ1.</b>). La activación es offline: tus documentos nunca salen de tu navegador.</p>
  <p style="font-size:12.5px;color:#5a6b64">¿Dudas? Responde este correo.<br/>- Cumbre GEO · Línea CumbreDocs</p>
</div>`;
}

function noticeEmailText(email: string): string {
  return [
    "¡Gracias por apoyar CumbreDocs, la línea de documentos de CumbreGeo!",
    "",
    "Recibimos tu pago de RAPIQO PRO ($14.990 CLP, confirmado).",
    "Tu clave de licencia llega a este correo a la brevedad.",
    "",
    "Cuando la recibas, actívala en rapiqo.cumbregeo.cl →",
    "Ajustes → Licencia (pega la clave que empieza por RQ1.).",
    "",
    "- Cumbre GEO · Línea CumbreDocs",
  ].join("\n");
}

// --- Entrega con idempotencia ---------------------------------

export type RapiqoDeliverResult =
  | { ok: true; action: "sent" | "already" | "queued"; license?: string }
  | { ok: false; error: string };

/**
 * Entrega la licencia para un pago ya VERIFICADO. Idempotente: si
 * el paymentId ya tiene registro, devuelve "already" sin reenviar.
 * Graba el registro SOLO después de un envío exitoso (si el correo
 * falla, el reintento manual/sync lo resolverá más tarde).
 *
 * Guard: sin RAPIQO_SIGNING_ENABLED=1 el correo avisa que la clave
 * llega a la brevedad y el registro queda "(manual)" — la firma
 * automática se activa cuando la app verifica con la pública de
 * producción (ver download/instrucciones-despliegue-rapiqo.md §7).
 */
export async function deliverRapiqoForPayment(params: {
  paymentId: string;
  email: string;
  amount: number;
  via: "webhook" | "sync" | "manual";
}): Promise<RapiqoDeliverResult> {
  const email = normalizeEmail(params.email);
  const existing = await db.rapiqoDelivery.findUnique({ where: { paymentId: params.paymentId } });
  if (existing) return { ok: true, action: "already", license: existing.license };
  if (!smtpConfigured()) {
    return { ok: false, error: "SMTP sin configurar: define GMAIL_USER y GMAIL_APP_PASSWORD" };
  }

  const auto = process.env.RAPIQO_SIGNING_ENABLED === "1";
  const license = auto ? signRapiqoLicense({ id: params.paymentId, name: email, days: null }) : "(manual)";
  try {
    await transporter().sendMail(
      auto
        ? {
            from: brandFrom(),
            to: email,
            subject: "Tu licencia RAPIQO PRO",
            text: rapiqoLicenseEmailText(email, license),
            html: rapiqoLicenseEmailHtml(email, license),
            replyTo: process.env.GMAIL_USER,
          }
        : {
            from: brandFrom(),
            to: email,
            subject: "Recibimos tu pago de RAPIQO PRO",
            text: noticeEmailText(email),
            html: noticeEmailHtml(email),
            replyTo: process.env.GMAIL_USER,
          },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fallo de envío" };
  }

  await db.rapiqoDelivery.create({
    data: {
      paymentId: params.paymentId,
      email,
      license,
      amount: params.amount,
      via: params.via,
    },
  });
  return { ok: true, action: auto ? "sent" : "queued", license: auto ? license : undefined };
}

/** Verifica un id de pago contra MP (app RAPIQO) y entrega si corresponde. */
export async function verifyAndDeliverRapiqo(
  paymentId: string,
  via: "webhook" | "sync" | "manual",
): Promise<RapiqoDeliverResult> {
  const payment = await fetchRapiqoPayment(paymentId);
  if (!payment) return { ok: false, error: "pago no encontrado en Mercado Pago (revisa RAPIQO_ACCESS_TOKEN)" };
  if (!isRapiqoPayment(payment)) return { ok: false, error: "el pago no corresponde a la licencia RAPIQO" };
  const email = payment.payer?.email ?? payment.external_reference ?? "";
  if (!email) return { ok: false, error: "el pago no tiene correo del pagador" };
  return deliverRapiqoForPayment({
    paymentId: String(payment.id),
    email,
    amount: Math.round(Number(payment.transaction_amount) || rapiqoAmount()),
    via,
  });
}
