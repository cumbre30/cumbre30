// ============================================================
// /api/comentarios (v1.29.5): evaluaciones y comentarios públicos
// de productos dentro del modal «Ver detalles» de /geo
// (producto: cumbre30 | rapiqo).
//   · GET  ?producto=<id> → últimos 50, recientes primero.
//   · POST { producto, evaluacion 1-5 (obligatoria), comentario,
//     nombre?, web? (honeypot) } → guarda y devuelve el registro.
//   · Publicación inmediata sin curaduría: la defensa es la
//     validación zod (límites de largo) + honeypot + rate-limit
//     por IP en memoria (mismo patrón de /api/contacto).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const PRODUCTOS = ["cumbre30", "rapiqo"] as const;

const Esquema = z.object({
  producto: z.enum(PRODUCTOS),
  evaluacion: z.number().int().min(1).max(5),
  comentario: z.string().trim().min(4).max(1000),
  // Opcional: sin nombre se guarda «Anónimo» (default de la tabla).
  nombre: z.string().trim().max(60).optional(),
  // Honeypot: campo invisible para personas. Los bots que lo
  // rellenan quedan fuera por validación (igual que /api/contacto).
  web: z.string().max(0).optional(),
});

// Rate-limit simple en memoria (por instancia serverless).
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

export async function GET(req: NextRequest) {
  const producto = req.nextUrl.searchParams.get("producto") ?? "";
  if (!PRODUCTOS.includes(producto as (typeof PRODUCTOS)[number])) {
    return NextResponse.json({ ok: false, error: "producto_invalido" }, { status: 400 });
  }
  try {
    const comentarios = await db.comentario.findMany({
      where: { producto },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, evaluacion: true, comentario: true, nombre: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, comentarios });
  } catch (e) {
    console.error("comentarios: fallo al leer DB:", e);
    return NextResponse.json({ ok: false, error: "fallo_servidor" }, { status: 500 });
  }
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
  const { producto, evaluacion, comentario } = parsed.data;
  const nombre = parsed.data.nombre?.length ? parsed.data.nombre : "Anónimo";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  if (limitado(ip)) {
    return NextResponse.json({ ok: false, error: "demasiados_comentarios" }, { status: 429 });
  }

  try {
    const creado = await db.comentario.create({
      data: { producto, evaluacion, comentario, nombre },
      select: { id: true, evaluacion: true, comentario: true, nombre: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, comentario: creado });
  } catch (e) {
    console.error("comentarios: fallo al guardar en DB:", e);
    return NextResponse.json({ ok: false, error: "fallo_servidor" }, { status: 500 });
  }
}
