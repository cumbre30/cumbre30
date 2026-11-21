export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Fotos de una experiencia (propuesta Pro 2026-11-21, Grupo A).
// Sin pipeline de blob storage: el cliente escala la imagen
// (≤1280px, JPEG) y la envía como data URL; se guarda en
// ExperiencePhoto.url (columna existente) con blobPathname null.
// Límites: FREE 1 foto · PRO hasta 6 — el plan lo decide el
// REGISTRO de compras (ProDelivery) vía esProServer, no lo que
// declare el cliente. Solo el autor de la experiencia añade fotos.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { esProServer } from "@/lib/proLicenseServer";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

const MAX_FOTOS_PRO = 6;
const MAX_FOTOS_FREE = 1;
// ~300 KB de binario tras escalar (base64 ≈ ×1,37).
const MAX_DATAURL_CHARS = 400_000;
const FORMATO = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { experienciaId?: string; foto?: string };
  const experienciaId = typeof body.experienciaId === "string" ? body.experienciaId : "";
  const foto = typeof body.foto === "string" ? body.foto : "";
  if (!experienciaId || !foto) return NextResponse.json({ error: "Falta la experiencia o la foto." }, { status: 400, headers: cors });
  if (!FORMATO.test(foto) || foto.length > MAX_DATAURL_CHARS) {
    return NextResponse.json({ error: "Formato o tamaño de foto no válido." }, { status: 400, headers: cors });
  }

  try {
    // La experiencia debe existir, estar viva y pertenecer a ESTA ruta.
    const exp = await db.routeExperience.findFirst({
      where: { id: experienciaId, routeId: id, removedAt: null },
      select: { id: true, userId: true, _count: { select: { photos: true } } },
    });
    if (!exp) return NextResponse.json({ error: "Experiencia no encontrada." }, { status: 404, headers: cors });
    if (exp.userId !== me.id) return NextResponse.json({ error: "Solo el autor añade fotos." }, { status: 403, headers: cors });

    const pro = await esProServer(me.email);
    const limite = pro ? MAX_FOTOS_PRO : MAX_FOTOS_FREE;
    if (exp._count.photos >= limite) {
      return NextResponse.json(
        { error: pro ? "Límite de 6 fotos alcanzado." : "Tu plan gratuito permite 1 foto por experiencia." },
        { status: 403, headers: cors },
      );
    }

    const creada = await db.experiencePhoto.create({
      data: { experienceId: exp.id, url: foto },
      select: { id: true, url: true },
    });
    return NextResponse.json({ ok: true, id: creada.id, url: creada.url }, { headers: cors });
  } catch (e) {
    console.error("[experience.photos]", e);
    return NextResponse.json({ error: "No se pudo guardar la foto." }, { status: 500, headers: cors });
  }
}
