export const dynamic = "force-dynamic";

// Perfil Ciclista (v1.13.16): el perfil se recalcula al consultar -
// es una sola pasada por los rides de los últimos 90 días (ms) y
// garantiza frescura sin depender del worker que lo guardó. También
// actualiza el documento materializado (CyclistProfile).
//
//   GET /api/profile  (con sesión) → resumen de arquetipo + 5 ejes +
//                                    rides que lo alimentan.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { recalcularPerfil } from "@/lib/profileServer";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  try {
    const perfil = await recalcularPerfil(me.id);
    return NextResponse.json({ perfil, minRides: 5, ventanaDias: 90 }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "No pudimos calcular tu perfil." }, { status: 500, headers: cors });
  }
}
