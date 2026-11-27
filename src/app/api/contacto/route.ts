// ============================================================
// /api/contacto (v1.29.0): formulario de contacto del sitio
// corporativo (/geo#contacto). Consultas comerciales y soporte
// de productos.
//   · Validación zod + honeypot ("web" debe llegar vacío: los
//     bots que lo rellenan se descartan con éxito aparente).
//   · Rate-limit por IP en memoria (5 mensajes / 10 min por
//     instancia serverless): disuade spam sin infra extra.
//   · Persistencia en DB (mensajes_contacto) + reenvío por Gmail
//     SMTP al buzón de contacto (CONTACT_EMAIL), el mismo
//     transporte de proDeliver. Si el correo falla (SMTP caído,
//     cuota), el mensaje queda guardado y la respuesta es ok:
//     la DB es la fuente de verdad y el buzón se revisa igual.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { db } from "@/lib/db";
import { CONTACT_EMAIL } from "@/lib/proConfig";

const Esquema = z.object({
  nombre: z.string().trim().min(2).max(80),
  correo: z.string().trim().email().max(120),
  tipo: z.enum(["comercial", "soporte"]),
  mensaje: z.string().trim().min(10).max(2000),
  // Honeypot: campo invisible para humanos. Los bots que lo
  // rellenan se aceptan con éxito falso y no se guardan.
  web: z.string().max(0).optional(),
});

// Rate-limit simple en memoria (por instancia).
const RECIENTES = new Map<string, number[]>();
const VENTANA_MS = 10 * 60_000;
const MAX_POR_VENTANA = 5;

function limitado(ip: string): boolean {
  const ahora = Date.now();
  const previas = (RECIENTES.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  previas.push(ahora);
  RECIENTES.set(ip, previas);
  return previas.length > MAX_POR_VENTANA;
}

export async function POST(req: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "solicitud_invalida" }, { status: 400 });
  }

  const parsed = Esquema.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "datos_invalidos" }, { status: 400 });
  }
  const { nombre, correo, tipo, mensaje } = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  if (limitado(ip)) {
    return NextResponse.json({ ok: false, error: "demasiados_mensajes" }, { status: 429 });
  }

  try {
    await db.mensajeContacto.create({ data: { nombre, correo, tipo, mensaje } });
  } catch (e) {
    console.error("contacto: fallo al guardar en DB:", e);
    return NextResponse.json({ ok: false, error: "fallo_servidor" }, { status: 500 });
  }

  // Reenvío por correo (no bloquea el éxito: el mensaje ya está en DB).
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass: pass.replace(/\s+/g, "") },
      });
      await transporter.sendMail({
        from: `"CumbreGeo · sitio web" <${user}>`,
        to: CONTACT_EMAIL,
        replyTo: correo,
        subject: `[CumbreGeo · ${tipo}] ${nombre}`,
        text: `${nombre} <${correo}> escribió desde el formulario de contacto (${tipo}):\n\n${mensaje}`,
      });
    } catch (e) {
      console.error("contacto: mensaje guardado pero el correo falló:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
